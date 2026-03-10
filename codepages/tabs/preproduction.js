// ═══════════════════════════════════════════════════════════════
// Pre-Production Tab — Kanban and pipeline views
// ═══════════════════════════════════════════════════════════════
(function() {

var ppProjects = [];
var ppSubTab = 'kanban';
var ppLoading = false;

var KANBAN_COLS = [
  { key: 'blank',       label: 'Blank',       match: function(t){ return !t || t === ''; } },
  { key: 'urgent',      label: 'Urgent',      match: function(t){ return t === 'Urgent'; } },
  { key: 'not-started', label: 'Not Started', match: function(t){ return t === 'Not Started'; } },
  { key: 'in-progress', label: 'In Progress', match: function(t){ return t === 'In Progress'; } },
  { key: 'cold',        label: 'Cold',        match: function(t){ return t === 'Cold'; } }
];

var COL_COLORS = {
  'blank':       'var(--text-dim)',
  'urgent':      '#ff4757',
  'not-started': '#ffa502',
  'in-progress': '#68B6E5',
  'cold':        '#868e96'
};

var ppCSS = `
  .pp-subtabs { display:flex; gap:0; border-bottom:1px solid var(--border); padding:0 20px; flex-shrink:0; }
  .pp-subtab-btn { padding:10px 16px; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; border:none; background:none; font-family:inherit; border-bottom:2px solid transparent; transition:all 0.15s; }
  .pp-subtab-btn:hover { color:var(--text); }
  .pp-subtab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
  .pp-subtab-pane { display:none; flex:1; overflow:hidden; }
  .pp-subtab-pane.active { display:flex; flex-direction:column; }
  .kanban-board { display:flex; gap:12px; padding:16px; overflow-x:auto; flex:1; align-items:flex-start; }
  .kanban-col { flex:0 0 260px; background:var(--surface); border-radius:10px; border:1px solid var(--border); display:flex; flex-direction:column; max-height:100%; }
  .kanban-col-header { padding:12px 14px 10px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
  .kanban-col-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
  .kanban-col-count { font-size:11px; font-weight:600; padding:2px 7px; border-radius:10px; background:var(--surface-raised,var(--border)); color:var(--text-muted); }
  .kanban-cards { padding:8px; display:flex; flex-direction:column; gap:6px; overflow-y:auto; }
  .kanban-card { background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:10px 12px; cursor:default; transition:border-color 0.15s; }
  .kanban-card:hover { border-color:var(--accent); }
  .kanban-card-name { font-size:13px; font-weight:700; color:var(--text); margin-bottom:4px; line-height:1.3; }
  .kanban-card-sub { font-size:12px; color:var(--text-muted); line-height:1.4; }
  .kanban-empty { padding:20px 14px; text-align:center; font-size:12px; color:var(--text-dim); }
  .pp-loading { display:flex; align-items:center; justify-content:center; flex:1; color:var(--text-dim); font-size:14px; }
`;

function buildHTML() {
  return `
    <div class="sched-topbar" style="border-bottom:none;flex-shrink:0">
      <div class="sched-topbar-left"></div>
      <div class="sched-topbar-right">
        <button class="btn btn-sm" onclick="ppRefresh()" title="Refresh">↻ Refresh</button>
      </div>
    </div>
    <div class="pp-subtabs">
      <button class="pp-subtab-btn active" data-pp="kanban" onclick="ppSwitchSub('kanban')">Kanban</button>
    </div>
    <div class="pp-subtab-pane active" id="ppPane-kanban">
      <div id="ppKanbanContent" class="pp-loading">Loading…</div>
    </div>
    <div class="modal-overlay" id="ppModal" onclick="if(event.target===this)ppCloseModal()">
      <div class="modal-content" id="ppModalContent"></div>
    </div>`;
}

function ppSwitchSub(sub) {
  ppSubTab = sub;
  document.querySelectorAll('.pp-subtab-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.pp === sub);
  });
  document.querySelectorAll('.pp-subtab-pane').forEach(function(p){
    p.classList.toggle('active', p.id === 'ppPane-' + sub);
  });
}

async function ppLoadData() {
  var rows = await qbQueryAll(
    TABLES.projects,
    [FIELD.PROJECTS.id, FIELD.PROJECTS.name, FIELD.PROJECTS.number,
     FIELD.PROJECTS.type, FIELD.PROJECTS.stage, FIELD.PROJECTS.pod,
     FIELD.PROJECTS.fid85, FIELD.PROJECTS.fid141],
    '{' + FIELD.PROJECTS.stage + '.XEX.\'Complete\'}'
  );
  ppProjects = rows.map(function(r) {
    return {
      id:     val(r, FIELD.PROJECTS.id),
      name:   val(r, FIELD.PROJECTS.name),
      number: val(r, FIELD.PROJECTS.number),
      type:   val(r, FIELD.PROJECTS.type),
      stage:  val(r, FIELD.PROJECTS.stage),
      pod:    val(r, FIELD.PROJECTS.pod),
      fid85:  val(r, FIELD.PROJECTS.fid85),
      fid141: val(r, FIELD.PROJECTS.fid141)
    };
  });
}

function renderKanban() {
  var container = document.getElementById('ppKanbanContent');
  if (!container) return;

  var board = '<div class="kanban-board">';
  KANBAN_COLS.forEach(function(col) {
    var cards = ppProjects.filter(function(p){ return col.match(p.type); });
    var color = COL_COLORS[col.key];
    board += '<div class="kanban-col">' +
      '<div class="kanban-col-header">' +
        '<span class="kanban-col-title" style="color:' + color + '">' + escapeHtml(col.label) + '</span>' +
        '<span class="kanban-col-count">' + cards.length + '</span>' +
      '</div>' +
      '<div class="kanban-cards">';

    if (cards.length === 0) {
      board += '<div class="kanban-empty">No projects</div>';
    } else {
      cards.forEach(function(p) {
        var sub1 = escapeHtml(p.fid85);
        var sub2 = escapeHtml(p.fid141);
        var subLine = [sub1, sub2].filter(Boolean).join(' · ');
        board += '<div class="kanban-card">' +
          '<div class="kanban-card-name">' + escapeHtml(p.name || '—') + '</div>' +
          (subLine ? '<div class="kanban-card-sub">' + subLine + '</div>' : '') +
        '</div>';
      });
    }

    board += '</div></div>';
  });
  board += '</div>';

  container.className = '';
  container.innerHTML = board;
}

async function ppRefresh() {
  if (ppLoading) return;
  ppLoading = true;
  var container = document.getElementById('ppKanbanContent');
  if (container) { container.className = 'pp-loading'; container.innerHTML = 'Loading…'; }
  try {
    await ppLoadData();
    renderKanban();
  } catch(e) {
    if (container) { container.className = 'pp-loading'; container.innerHTML = 'Error loading data.'; }
    showToast('Failed to load pre-production data.', 'error');
    console.error('[PreProd]', e);
  } finally {
    ppLoading = false;
  }
}

function ppCloseModal() {
  var m = document.getElementById('ppModal');
  if (m) m.style.display = 'none';
}

registerTab('preproduction', {
  icon: '🎬', label: 'Pre-Production',
  roles: ALL_ROLES,
  onInit: function() {
    var style = document.createElement('style');
    style.textContent = ppCSS;
    document.head.appendChild(style);

    document.getElementById('tab-preproduction').innerHTML = buildHTML();
    ppRefresh();
  },
  onActivate: function() {
    // Refresh if data is stale (no data loaded yet)
    if (ppProjects.length === 0 && !ppLoading) ppRefresh();
  }
});

})();
