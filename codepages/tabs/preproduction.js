// ═══════════════════════════════════════════════════════════════
// Pre-Production Tab — Kanban and pipeline views
// ═══════════════════════════════════════════════════════════════
(function() {

var ppProjects  = [];
var ppSubTab    = 'kanban';
var ppLoading   = false;
var ppColOrder  = {};   // { colKey: [id, id, ...] } — manual ordering per column
var ppDragId    = null; // project id being dragged
var ppDragSrcCol = null; // source column key

var KANBAN_COLS = [
  { key: 'blank',        label: 'Blank',        typeValue: '',             match: function(t){ return !t || t === ''; } },
  { key: 'urgent',       label: 'Urgent',        typeValue: 'Urgent',       match: function(t){ return t === 'Urgent'; } },
  { key: 'not-started',  label: 'Not Started',   typeValue: 'Not Started',  match: function(t){ return t === 'Not Started'; } },
  { key: 'in-progress',  label: 'In Progress',   typeValue: 'In Progress',  match: function(t){ return t === 'In Progress'; } },
  { key: 'cold',         label: 'Cold',          typeValue: 'Cold',         match: function(t){ return t === 'Cold'; } }
];

var COL_COLORS = {
  'blank':       'var(--text-dim)',
  'urgent':      '#ff4757',
  'not-started': '#ffa502',
  'in-progress': '#68B6E5',
  'cold':        '#868e96'
};

var PP_SUBTABS = [
  { key: 'kanban',   label: 'Pre-Production' },
  { key: 'tar',      label: 'Technical Asset Review' },
  { key: 'ready',    label: 'Ready for Production' },
  { key: 'inprod',   label: 'In Production' },
  { key: 'complete', label: 'Complete' },
  { key: 'bookings', label: 'Bookings' }
];

var ppCSS = `
  .pp-subtabs { display:flex; gap:0; border-bottom:1px solid var(--border); padding:0 20px; flex-shrink:0; overflow-x:auto; }
  .pp-subtab-btn { padding:10px 16px; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; border:none; background:none; font-family:inherit; border-bottom:2px solid transparent; transition:all 0.15s; white-space:nowrap; }
  .pp-subtab-btn:hover { color:var(--text); }
  .pp-subtab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
  .pp-subtab-pane { display:none; flex:1; overflow:hidden; min-height:0; }
  .pp-subtab-pane.active { display:flex; flex-direction:column; min-height:0; }
  #ppKanbanContent { display:flex; flex:1; min-height:0; overflow:hidden; }
  #ppKanbanContent.pp-loading { display:flex; align-items:center; justify-content:center; }
  .kanban-board { display:flex; gap:12px; padding:16px; overflow-x:auto; overflow-y:hidden; flex:1; align-items:stretch; min-height:0; }
  .kanban-col { flex:0 0 280px; background:var(--surface); border-radius:10px; border:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; transition:border-color 0.15s, background 0.15s; }
  .kanban-col.drag-over { border-color:var(--accent); background:rgba(104,182,229,0.06); }
  .kanban-col-header { padding:12px 14px 10px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
  .kanban-col-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
  .kanban-col-count { font-size:11px; font-weight:600; padding:2px 7px; border-radius:10px; background:var(--border); color:var(--text-muted); }
  .kanban-cards { padding:8px; display:flex; flex-direction:column; gap:6px; overflow-y:auto; flex:1; min-height:0; }
  .kanban-card { position:relative; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:10px 32px 10px 12px; cursor:grab; user-select:none; transition:border-color 0.15s, box-shadow 0.15s, opacity 0.15s; }
  .kanban-card:hover { border-color:var(--col-color, var(--accent)); box-shadow:0 2px 8px rgba(0,0,0,0.18); }
  .kanban-card:active { cursor:grabbing; }
  .kanban-card.dragging { opacity:0.35; }
  .kanban-card.drop-before { border-top:2px solid var(--col-color, var(--accent)); }
  .kanban-card.drop-after  { border-bottom:2px solid var(--col-color, var(--accent)); }
  .kanban-card-open { position:absolute; top:8px; right:8px; width:20px; height:20px; display:flex; align-items:center; justify-content:center; border:none; background:none; color:var(--text-dim); cursor:pointer; border-radius:4px; padding:0; transition:color 0.15s, background 0.15s; }
  .kanban-card-open:hover { color:var(--col-color, var(--accent)); background:var(--border); }
  .kanban-card-name { font-size:13px; font-weight:700; color:var(--text); margin-bottom:6px; line-height:1.3; }
  .pp-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; z-index:9999; }
  .pp-modal { background:var(--surface); border:1px solid var(--border); border-radius:12px; width:620px; max-width:92vw; max-height:82vh; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.35); }
  .pp-modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .pp-modal-title { font-size:15px; font-weight:700; color:var(--text); }
  .pp-modal-close { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:none; color:var(--text-muted); cursor:pointer; border-radius:6px; font-size:16px; transition:color 0.15s, background 0.15s; }
  .pp-modal-close:hover { color:var(--text); background:var(--border); }
  .pp-modal-body { flex:1; overflow-y:auto; padding:20px; }
  .kanban-card-btns { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
  .kanban-card-btns a, .kanban-card-btns button { font-size:11px !important; padding:3px 10px !important; border-radius:4px !important; line-height:1.5 !important; }
  .kanban-card-sub { font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:3px; line-height:1.3; }
  .kanban-card-detail { font-size:11px; color:var(--text-dim); margin-bottom:6px; line-height:1.3; }
  .kanban-card-bottom { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; padding-top:6px; border-top:1px solid var(--border); }
  .kanban-card-bottom a, .kanban-card-bottom button { font-size:11px !important; padding:3px 10px !important; border-radius:4px !important; line-height:1.5 !important; }
  .kanban-empty { padding:24px 14px; text-align:center; font-size:12px; color:var(--text-dim); }
  .pp-loading { display:flex; align-items:center; justify-content:center; flex:1; color:var(--text-dim); font-size:14px; }
  .pp-placeholder { display:flex; align-items:center; justify-content:center; flex:1; flex-direction:column; gap:12px; color:var(--text-dim); }
`;

// ─── HTML ──────────────────────────────────────────────────────
function buildHTML() {
  var tabs = PP_SUBTABS.map(function(s, i) {
    return '<button class="pp-subtab-btn' + (i === 0 ? ' active' : '') +
      '" data-pp="' + s.key + '" onclick="ppSwitchSub(\'' + s.key + '\')">' +
      escapeHtml(s.label) + '</button>';
  }).join('');

  var panes = PP_SUBTABS.map(function(s, i) {
    var active = i === 0 ? ' active' : '';
    if (s.key === 'kanban') {
      return '<div class="pp-subtab-pane' + active + '" id="ppPane-kanban">' +
        '<div id="ppKanbanContent" class="pp-loading">Loading\u2026</div>' +
        '</div>';
    }
    return '<div class="pp-subtab-pane" id="ppPane-' + s.key + '">' +
      '<div class="pp-placeholder">' +
        '<div style="color:var(--text-dim)">' + ICONS.preproduction + '</div>' +
        '<div style="font-size:14px">' + escapeHtml(s.label) + ' coming soon.</div>' +
      '</div></div>';
  }).join('');

  return '<div class="sched-topbar" style="border-bottom:none;flex-shrink:0">' +
      '<div class="sched-topbar-left"></div>' +
      '<div class="sched-topbar-right">' +
        '<button class="btn btn-sm" onclick="ppRefresh()">&#8635; Refresh</button>' +
      '</div>' +
    '</div>' +
    '<div class="pp-subtabs">' + tabs + '</div>' +
    panes;
}

// ─── SUB-TAB SWITCH ────────────────────────────────────────────
function switchSub(sub) {
  ppSubTab = sub;
  document.querySelectorAll('.pp-subtab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.pp === sub);
  });
  document.querySelectorAll('.pp-subtab-pane').forEach(function(p) {
    p.classList.toggle('active', p.id === 'ppPane-' + sub);
  });
}

// ─── DATA ──────────────────────────────────────────────────────
async function ppLoadData() {
  var rows = await qbQueryAll(
    TABLES.projects,
    [FIELD.PROJECTS.id, FIELD.PROJECTS.name, FIELD.PROJECTS.number,
     FIELD.PROJECTS.type, FIELD.PROJECTS.stage, FIELD.PROJECTS.pod,
     FIELD.PROJECTS.fid49, FIELD.PROJECTS.fid54, FIELD.PROJECTS.fid55,
     FIELD.PROJECTS.fid85, FIELD.PROJECTS.fid137],
    '{' + FIELD.PROJECTS.stage + '.EX.\'Pre-Production\'}'
  );

  ppProjects = rows.map(function(r) {
    return {
      id:     val(r, FIELD.PROJECTS.id),
      name:   val(r, FIELD.PROJECTS.name),
      number: val(r, FIELD.PROJECTS.number),
      type:   val(r, FIELD.PROJECTS.type),
      stage:  val(r, FIELD.PROJECTS.stage),
      pod:    val(r, FIELD.PROJECTS.pod),
      fid54:  val(r, FIELD.PROJECTS.fid54),
      fid55:  (function(v) {
        if (!v) return '';
        var p = v.split('-');
        return p.length === 3 ? p[1] + '/' + p[2] + '/' + p[0].slice(2) : v;
      })(val(r, FIELD.PROJECTS.fid55)),
      // Raw HTML from formula rich-text fields — rendered directly as buttons
      fid49:  (r[FIELD.PROJECTS.fid49]  && r[FIELD.PROJECTS.fid49].value)  || '',
      fid85:  (r[FIELD.PROJECTS.fid85]  && r[FIELD.PROJECTS.fid85].value)  || '',
      fid137: (r[FIELD.PROJECTS.fid137] && r[FIELD.PROJECTS.fid137].value) || ''
    };
  });

  // Build per-column order arrays (preserves order on reload)
  ppColOrder = {};
  KANBAN_COLS.forEach(function(col) {
    ppColOrder[col.key] = ppProjects
      .filter(function(p) { return col.match(p.type); })
      .map(function(p) { return p.id; });
  });
}

function getProj(id) {
  return ppProjects.find(function(p) { return p.id === id; });
}

// ─── RENDER ────────────────────────────────────────────────────
function renderKanban() {
  var container = document.getElementById('ppKanbanContent');
  if (!container) return;

  var html = '<div class="kanban-board">';

  KANBAN_COLS.forEach(function(col) {
    var ids   = ppColOrder[col.key] || [];
    var color = COL_COLORS[col.key];

    html += '<div class="kanban-col" id="ppCol-' + col.key + '"' +
      ' ondragover="ppColDragOver(event,\'' + col.key + '\')"' +
      ' ondragleave="ppColDragLeave(event,\'' + col.key + '\')"' +
      ' ondrop="ppColDrop(event,\'' + col.key + '\')">' +
      '<div class="kanban-col-header">' +
        '<span class="kanban-col-title" style="color:' + color + '">' + escapeHtml(col.label) + '</span>' +
        '<span class="kanban-col-count">' + ids.length + '</span>' +
      '</div>' +
      '<div class="kanban-cards">';

    if (ids.length === 0) {
      html += '<div class="kanban-empty">No projects</div>';
    } else {
      ids.forEach(function(id) {
        var p = getProj(id);
        if (!p) return;
        var btns = '';
        if (p.fid85)  btns += '<span>' + p.fid85  + '</span>';
        if (p.fid137) btns += '<span>' + p.fid137 + '</span>';

        html += '<div class="kanban-card" id="ppCard-' + p.id + '"' +
          ' style="--col-color:' + color + '"' +
          ' draggable="true"' +
          ' ondragstart="ppCardDragStart(event,' + p.id + ',\'' + col.key + '\')"' +
          ' ondragend="ppCardDragEnd()"' +
          ' ondragover="ppCardDragOver(event,' + p.id + ',\'' + col.key + '\')"' +
          ' ondragleave="ppCardDragLeave(event,' + p.id + ')"' +
          ' ondrop="ppCardDrop(event,' + p.id + ',\'' + col.key + '\')">' +
          '<button class="kanban-card-open" draggable="false" onclick="event.stopPropagation();ppOpenModal(' + p.id + ')" title="Open">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8"/></svg>' +
          '</button>' +
          '<div class="kanban-card-name">' + escapeHtml(p.name || '\u2014') + '</div>' +
          (p.fid54 ? '<div class="kanban-card-sub">'    + escapeHtml(p.fid54) + '</div>' : '') +
          (p.fid55 ? '<div class="kanban-card-detail">Deal Closed: ' + escapeHtml(p.fid55) + '</div>' : '') +
          (p.fid49 ? '<div class="kanban-card-btns"><span>' + p.fid49 + '</span></div>' : '') +
          (p.fid85 ? '<div class="kanban-card-btns"><span>' + p.fid85 + '</span></div>' : '') +
          '</div>';
      });
    }

    html += '</div></div>';
  });

  html += '</div>';
  container.className = '';
  container.innerHTML = html;
}

// ─── DRAG & DROP ───────────────────────────────────────────────
window.ppCardDragStart = function(e, id, colKey) {
  ppDragId     = id;
  ppDragSrcCol = colKey;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  setTimeout(function() {
    var el = document.getElementById('ppCard-' + id);
    if (el) el.classList.add('dragging');
  }, 0);
};

window.ppCardDragEnd = function() {
  document.querySelectorAll('.kanban-card.dragging').forEach(function(el) { el.classList.remove('dragging'); });
  document.querySelectorAll('.kanban-card.drop-before, .kanban-card.drop-after').forEach(function(el) {
    el.classList.remove('drop-before', 'drop-after');
  });
  document.querySelectorAll('.kanban-col.drag-over').forEach(function(el) { el.classList.remove('drag-over'); });
  ppDragId = null;
  ppDragSrcCol = null;
};

// Card drag-over: show insertion indicator, suppress column highlight for same-col
window.ppCardDragOver = function(e, targetId, colKey) {
  e.preventDefault();
  e.stopPropagation();
  if (!ppDragId || ppDragId === targetId) return;

  // Show column highlight when dragging from another column
  if (ppDragSrcCol !== colKey) {
    var col = document.getElementById('ppCol-' + colKey);
    if (col) col.classList.add('drag-over');
  }

  // Show insertion line on target card
  document.querySelectorAll('.kanban-card.drop-before, .kanban-card.drop-after').forEach(function(el) {
    el.classList.remove('drop-before', 'drop-after');
  });
  var card = document.getElementById('ppCard-' + targetId);
  if (!card) return;
  var mid = card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
  card.classList.add(e.clientY < mid ? 'drop-before' : 'drop-after');
};

window.ppCardDragLeave = function(e, id) {
  var card = document.getElementById('ppCard-' + id);
  if (card && !card.contains(e.relatedTarget)) {
    card.classList.remove('drop-before', 'drop-after');
  }
};

// Card drop: handles both same-col reorder and cross-col move with precise positioning
window.ppCardDrop = function(e, targetId, colKey) {
  e.preventDefault();
  e.stopPropagation();
  if (!ppDragId || ppDragId === targetId) return;

  var proj = getProj(ppDragId);
  if (!proj) return;

  var card = document.getElementById('ppCard-' + targetId);
  var mid  = card ? card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2 : null;
  var insertAfter = mid !== null && e.clientY >= mid;

  // Remove from source
  ppColOrder[ppDragSrcCol] = (ppColOrder[ppDragSrcCol] || []).filter(function(i) { return i !== ppDragId; });

  // Insert into target column at the right position
  var order  = ppColOrder[colKey] || [];
  var toIdx  = order.indexOf(targetId);
  order.splice(toIdx + (insertAfter ? 1 : 0), 0, ppDragId);
  ppColOrder[colKey] = order;

  var colDef   = KANBAN_COLS.find(function(c) { return c.key === colKey; });
  var newType  = colDef ? colDef.typeValue : '';
  var typeChanged = ppDragSrcCol !== colKey;
  proj.type = newType;

  renderKanban();

  if (typeChanged) {
    var rec = {};
    rec[FIELD.PROJECTS.id]   = { value: proj.id };
    rec[FIELD.PROJECTS.type] = { value: newType };
    qbUpsert(TABLES.projects, [rec])
      .then(function()  { showToast('Project type updated.', 'success'); })
      .catch(function(err) {
        showToast('Failed to update project type.', 'error');
        console.error('[PreProd]', err);
        ppRefresh();
      });
  }

  ppDragId = null;
  ppDragSrcCol = null;
};

// Column drag-over/leave/drop: fallback for drops onto empty column space
window.ppColDragOver = function(e, colKey) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var col = document.getElementById('ppCol-' + colKey);
  if (col) col.classList.add('drag-over');
};

window.ppColDragLeave = function(e, colKey) {
  var col = document.getElementById('ppCol-' + colKey);
  if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
};

window.ppColDrop = function(e, colKey) {
  e.preventDefault();
  if (!ppDragId || ppDragSrcCol === colKey) return;

  var col = document.getElementById('ppCol-' + colKey);
  if (col) col.classList.remove('drag-over');

  var proj = getProj(ppDragId);
  if (!proj) return;

  var colDef  = KANBAN_COLS.find(function(c) { return c.key === colKey; });
  var newType = colDef ? colDef.typeValue : '';

  ppColOrder[ppDragSrcCol] = (ppColOrder[ppDragSrcCol] || []).filter(function(i) { return i !== ppDragId; });
  ppColOrder[colKey] = ppColOrder[colKey] || [];
  ppColOrder[colKey].push(ppDragId);
  proj.type = newType;

  renderKanban();

  var rec = {};
  rec[FIELD.PROJECTS.id]   = { value: proj.id };
  rec[FIELD.PROJECTS.type] = { value: newType };
  qbUpsert(TABLES.projects, [rec])
    .then(function()  { showToast('Project type updated.', 'success'); })
    .catch(function(err) {
      showToast('Failed to update project type.', 'error');
      console.error('[PreProd]', err);
      ppRefresh();
    });

  ppDragId = null;
  ppDragSrcCol = null;
};

// ─── REFRESH ───────────────────────────────────────────────────
async function ppRefresh() {
  if (ppLoading) return;
  ppLoading = true;
  var container = document.getElementById('ppKanbanContent');
  if (container) { container.className = 'pp-loading'; container.innerHTML = 'Loading\u2026'; }
  try {
    await ppLoadData();
    renderKanban();
  } catch(err) {
    if (container) { container.className = 'pp-loading'; container.innerHTML = 'Error loading data.'; }
    showToast('Failed to load pre-production data.', 'error');
    console.error('[PreProd]', err);
  } finally {
    ppLoading = false;
  }
}

// ─── MODAL ─────────────────────────────────────────────────────
function getOrCreateModal() {
  var el = document.getElementById('ppModalOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ppModalOverlay';
    el.className = 'pp-modal-overlay';
    el.innerHTML =
      '<div class="pp-modal">' +
        '<div class="pp-modal-header">' +
          '<span class="pp-modal-title"></span>' +
          '<button class="pp-modal-close" onclick="ppCloseModal()" title="Close">&#x2715;</button>' +
        '</div>' +
        '<div class="pp-modal-body"></div>' +
      '</div>';
    el.addEventListener('click', function(e) { if (e.target === el) ppCloseModal(); });
    document.body.appendChild(el);
  }
  return el;
}

window.ppOpenModal = function(id) {
  var proj = getProj(id);
  var overlay = getOrCreateModal();
  overlay.querySelector('.pp-modal-title').textContent = proj ? (proj.name || '\u2014') : '';
  overlay.querySelector('.pp-modal-body').innerHTML = '';
  overlay.style.display = 'flex';
};

window.ppCloseModal = function() {
  var el = document.getElementById('ppModalOverlay');
  if (el) el.style.display = 'none';
};

// ─── GLOBALS ───────────────────────────────────────────────────
window.ppSwitchSub = switchSub;
window.ppRefresh   = ppRefresh;

// ─── REGISTER ─────────────────────────────────────────────────
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
    if (ppProjects.length === 0 && !ppLoading) ppRefresh();
  }
});

})();
