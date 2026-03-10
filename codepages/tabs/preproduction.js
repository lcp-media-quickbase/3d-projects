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

// Scope report state
var ppScopeData   = [];
var ppScopeSortState = { col: 'product', dir: 'asc' };
var ppScopeFilter = '';

var SCOPE_COLS = [
  { key: 'product',     label: 'Product',     fid: FIELD.SCOPE.product,     type: 'text'     },
  { key: 'assetName',   label: 'Asset Name',  fid: FIELD.SCOPE.assetName,   type: 'text'     },
  { key: 'quantity',    label: 'Qty',         fid: FIELD.SCOPE.quantity,    type: 'num'      },
  { key: 'stillsCount', label: 'Stills',      fid: FIELD.SCOPE.stillsCount, type: 'num'      },
  { key: 'panosCount',  label: 'Panos',       fid: FIELD.SCOPE.panosCount,  type: 'num'      },
  { key: 'pricePer',    label: 'Price Per',   fid: FIELD.SCOPE.pricePer,    type: 'currency' },
  { key: 'totalValue',  label: 'Total Value', fid: FIELD.SCOPE.totalValue,  type: 'currency' }
];

// Assets report state
var ppAssetsData    = [];
var ppAssetsChanges = {};   // { recordId: { fid: value, ... } } — buffered until modal close
var ppAssetsFilter  = { received: '', assetType: '' };
var ppAssetsSortState = { col: 'fileType', dir: 'asc' };
var ppAssetDialogState = { id: null, fid: null, key: null };

var ASSETS_COLS = [
  { key: 'fileType',   label: 'File Type',           fid: FIELD.ASSETS.fileType,   type: 'text'  },
  { key: 'assetTypes', label: 'Related Asset Types', fid: FIELD.ASSETS.assetTypes, type: 'text'  },
  { key: 'notes',      label: 'Notes',               fid: FIELD.ASSETS.notes,      type: 'notes' },
  { key: 'fileLink',   label: 'File Link',           fid: FIELD.ASSETS.fileLink,   type: 'link'  },
  { key: 'received',   label: 'Received?',           fid: FIELD.ASSETS.received,   type: 'check' },
  { key: 'hidden',     label: 'Hidden?',             fid: FIELD.ASSETS.hidden,     type: 'check' }
];

var TYPE_COLORS = {
  'Urgent':      '#ff4757',
  'Not Started': '#ffa502',
  'In Progress': '#68B6E5',
  'Cold':        '#868e96',
  'Complete':    '#2ed573'
};

var STAGE_COLORS = {
  'Pre-Production':           '#a29bfe',
  'In Production':            '#74b9ff',
  'Complete':                 '#2ed573',
  'Delivered':                '#00b894',
  'Ready for Production':     '#fdcb6e',
  'Awaiting Client Feedback': '#e17055'
};

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
  .pp-modal { background:var(--surface); border:1px solid var(--border); border-radius:12px; width:680px; max-width:94vw; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.35); }
  .pp-modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; gap:12px; }
  .pp-modal-title-wrap { display:flex; flex-direction:column; gap:7px; flex:1; min-width:0; }
  .pp-modal-title { font-size:15px; font-weight:700; color:var(--text); line-height:1.3; }
  .pp-modal-header-badges { display:flex; gap:6px; flex-wrap:wrap; }
  .pp-modal-close { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; background:none; color:var(--text-muted); cursor:pointer; border-radius:6px; font-size:16px; transition:color 0.15s, background 0.15s; flex-shrink:0; }
  .pp-modal-close:hover { color:var(--text); background:var(--border); }
  .pp-badge { display:inline-flex; align-items:center; font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; letter-spacing:0.02em; }
  .pp-modal-body { flex:1; overflow-y:auto; padding:0; display:flex; flex-direction:column; min-height:0; }
  .pp-modal-info { padding:14px 20px 16px; display:flex; gap:24px; border-bottom:1px solid var(--border); flex-shrink:0; align-items:stretch; }
  .pp-modal-info-col { display:flex; flex-direction:column; gap:12px; min-width:0; }
  .pp-modal-rte { flex:1; min-height:100px; overflow-y:auto; padding:8px 10px; border:1px solid var(--border); border-radius:6px; background:var(--bg); font-size:13px; color:var(--text); line-height:1.6; outline:none; transition:border-color 0.15s; }
  .pp-modal-info-item { display:flex; flex-direction:column; gap:4px; }
  .pp-modal-info-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-dim); }
  .pp-modal-info-value { font-size:13px; color:var(--text); }
  .pp-modal-edit-input { font-size:13px; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:5px; padding:4px 8px; width:100%; font-family:inherit; outline:none; box-sizing:border-box; transition:border-color 0.15s; }
  .pp-modal-edit-input:focus { border-color:var(--accent); }
  .pp-modal-select { font-size:13px; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:5px; padding:4px 8px; width:100%; font-family:inherit; cursor:pointer; outline:none; transition:border-color 0.15s; }
  .pp-modal-select:focus { border-color:var(--accent); }
  .pp-modal-notes { padding:14px 20px 16px; border-bottom:1px solid var(--border); flex-shrink:0; display:flex; flex-direction:column; gap:8px; }
  .pp-modal-rte-toolbar { display:flex; gap:4px; flex-wrap:wrap; align-items:center; }
  .pp-modal-rte-btn { width:28px; height:26px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); background:var(--bg); color:var(--text); cursor:pointer; border-radius:4px; font-size:12px; font-weight:700; transition:background 0.15s, border-color 0.15s; flex-shrink:0; }
  .pp-modal-rte-btn:hover { background:var(--border); }
  .pp-modal-rte-sep { width:1px; height:18px; background:var(--border); margin:0 2px; flex-shrink:0; }
  .pp-modal-rte:focus { border-color:var(--accent); }
  .pp-modal-rte ul, .pp-modal-rte ol { padding-left:20px; margin:4px 0; }
  .pp-modal-rte-save { margin-left:auto; }
  .pp-notes-header { display:flex; align-items:center; justify-content:space-between; }
  .pp-notes-view { flex:1; min-height:100px; overflow-y:auto; padding:8px 10px; border:1px solid var(--border); border-radius:6px; background:var(--bg); font-size:13px; color:var(--text); line-height:1.6; }
  .pp-notes-view ul, .pp-notes-view ol { padding-left:20px; margin:4px 0; }
  .pp-notes-empty { color:var(--text-dim); font-style:italic; }
  .pp-notes-edit-wrap { display:flex; flex-direction:column; gap:6px; flex:1; min-height:0; }
  .pp-modal-tabs { display:flex; gap:0; border-bottom:1px solid var(--border); padding:0 20px; flex-shrink:0; }
  .pp-modal-tab-btn { padding:9px 14px; font-size:12px; font-weight:500; color:var(--text-muted); cursor:pointer; border:none; background:none; font-family:inherit; border-bottom:2px solid transparent; transition:all 0.15s; white-space:nowrap; }
  .pp-modal-tab-btn:hover { color:var(--text); }
  .pp-modal-tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
  .pp-modal-tab-pane { display:none; flex:1; padding:20px; flex-direction:column; gap:12px; min-height:0; }
  .pp-modal-tab-pane.active { display:flex; }
  .pp-modal-report-placeholder { display:flex; align-items:center; justify-content:center; flex:1; color:var(--text-dim); font-size:13px; border:1px dashed var(--border); border-radius:8px; min-height:120px; }
  .kanban-card-btns { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
  .kanban-card-btns a, .kanban-card-btns button { font-size:11px !important; padding:3px 10px !important; border-radius:4px !important; line-height:1.5 !important; }
  .kanban-card-sub { font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:3px; line-height:1.3; }
  .kanban-card-detail { font-size:11px; color:var(--text-dim); margin-bottom:6px; line-height:1.3; }
  .kanban-card-bottom { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; padding-top:6px; border-top:1px solid var(--border); }
  .kanban-card-bottom a, .kanban-card-bottom button { font-size:11px !important; padding:3px 10px !important; border-radius:4px !important; line-height:1.5 !important; }
  .kanban-empty { padding:24px 14px; text-align:center; font-size:12px; color:var(--text-dim); }
  .pp-loading { display:flex; align-items:center; justify-content:center; flex:1; color:var(--text-dim); font-size:14px; }
  .pp-placeholder { display:flex; align-items:center; justify-content:center; flex:1; flex-direction:column; gap:12px; color:var(--text-dim); }
  .pp-scope-toolbar { display:flex; gap:10px; align-items:center; flex-shrink:0; margin-bottom:10px; }
  .pp-scope-filter { flex:1; max-width:260px; font-size:13px; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:5px; padding:5px 10px; font-family:inherit; outline:none; transition:border-color 0.15s; }
  .pp-scope-filter:focus { border-color:var(--accent); }
  .pp-scope-count { font-size:12px; color:var(--text-dim); margin-left:auto; }
  .pp-scope-table-wrap { flex:1; overflow-y:auto; min-height:0; border:1px solid var(--border); border-radius:8px; }
  .pp-scope-table { width:100%; border-collapse:collapse; font-size:13px; }
  .pp-scope-th { padding:8px 12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-dim); text-align:left; background:var(--surface); border-bottom:1px solid var(--border); cursor:pointer; white-space:nowrap; user-select:none; position:sticky; top:0; z-index:1; transition:color 0.15s; }
  .pp-scope-th:hover { color:var(--text); }
  .pp-scope-th.sort-asc::after  { content:' \u2191'; color:var(--accent); }
  .pp-scope-th.sort-desc::after { content:' \u2193'; color:var(--accent); }
  .pp-scope-td { padding:7px 12px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle; }
  .pp-scope-td-num { text-align:right; font-variant-numeric:tabular-nums; }
  .pp-scope-table tbody tr:last-child td { border-bottom:none; }
  .pp-scope-table tbody tr:hover td { background:rgba(104,182,229,0.06); }
  .pp-scope-empty { text-align:center; color:var(--text-dim); font-style:italic; padding:24px; }
  .pp-cell-btn { width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border:none; background:none; color:var(--text-dim); cursor:pointer; border-radius:4px; padding:0; transition:color 0.15s, background 0.15s; vertical-align:middle; flex-shrink:0; }
  .pp-cell-btn:hover { color:var(--accent); background:var(--border); }
  .pp-cell-link { color:var(--accent); text-decoration:none; font-size:13px; }
  .pp-cell-link:hover { text-decoration:underline; }
  .pp-cell-notes { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle; }
  .pp-asset-dialog-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:10000; }
  .pp-asset-dialog { background:var(--surface); border:1px solid var(--border); border-radius:10px; width:380px; max-width:92vw; box-shadow:0 6px 24px rgba(0,0,0,0.35); display:flex; flex-direction:column; }
  .pp-asset-dialog-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); }
  .pp-asset-dialog-title { font-size:13px; font-weight:700; color:var(--text); }
  .pp-asset-dialog-body { padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
  .pp-asset-dialog-input { width:100%; font-size:13px; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:5px; padding:7px 10px; font-family:inherit; outline:none; resize:vertical; box-sizing:border-box; transition:border-color 0.15s; }
  .pp-asset-dialog-input:focus { border-color:var(--accent); }
  .pp-asset-dialog-footer { display:flex; gap:8px; justify-content:flex-end; padding:10px 16px; border-top:1px solid var(--border); }
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
     FIELD.PROJECTS.type, FIELD.PROJECTS.stage, FIELD.PROJECTS.pod, FIELD.PROJECTS.deal,
     FIELD.PROJECTS.fid36, FIELD.PROJECTS.fid49, FIELD.PROJECTS.fid54, FIELD.PROJECTS.fid55,
     FIELD.PROJECTS.fid62, FIELD.PROJECTS.fid85, FIELD.PROJECTS.fid137],
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
      deal:   val(r, FIELD.PROJECTS.deal),
      fid54:  val(r, FIELD.PROJECTS.fid54),
      fid62:  val(r, FIELD.PROJECTS.fid62),
      fid55:  (function(v) {
        if (!v) return '';
        var p = v.split('-');
        return p.length === 3 ? p[1] + '/' + p[2] + '/' + p[0].slice(2) : v;
      })(val(r, FIELD.PROJECTS.fid55)),
      // Raw HTML from formula/rich-text fields
      fid36:  (r[FIELD.PROJECTS.fid36]  && r[FIELD.PROJECTS.fid36].value)  || '',
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

// ─── SCOPE REPORT ──────────────────────────────────────────────
async function ppLoadScope(dealId) {
  ppScopeData   = [];
  ppScopeFilter = '';
  ppScopeSortState = { col: 'product', dir: 'asc' };
  var pane = document.getElementById('ppModalPane-scope');
  if (!pane) return;
  pane.innerHTML = '<div class="pp-loading">Loading\u2026</div>';
  try {
    var fids = [FIELD.SCOPE.id].concat(SCOPE_COLS.map(function(c) { return c.fid; }));
    var rows = await qbQueryAll(
      TABLES.scope, fids,
      '{' + FIELD.SCOPE.projectRef + '.EX.' + dealId + '}'
    );
    ppScopeData = rows.map(function(r) {
      var obj = { id: val(r, FIELD.SCOPE.id) };
      SCOPE_COLS.forEach(function(c) { obj[c.key] = val(r, c.fid); });
      return obj;
    });
    ppRenderScope();
  } catch(err) {
    var p = document.getElementById('ppModalPane-scope');
    if (p) p.innerHTML = '<div class="pp-loading">Failed to load scope data.</div>';
    console.error('[PreProd scope]', err);
  }
}

function ppRenderScope() {
  var pane = document.getElementById('ppModalPane-scope');
  if (!pane) return;

  // Unique product options from loaded data (sorted alpha)
  var products = [];
  ppScopeData.forEach(function(r) {
    var p = r.product || '';
    if (p && products.indexOf(p) < 0) products.push(p);
  });
  products.sort(function(a, b) { return a.localeCompare(b); });

  var rows = ppScopeData.filter(function(r) {
    if (!ppScopeFilter) return true;
    return r.product === ppScopeFilter;
  });

  var col = ppScopeSortState.col;
  var dir = ppScopeSortState.dir === 'asc' ? 1 : -1;
  rows.sort(function(a, b) {
    var av = a[col] || '';
    var bv = b[col] || '';
    var colDef = SCOPE_COLS.find(function(c) { return c.key === col; });
    if (colDef && (colDef.type === 'num' || colDef.type === 'currency')) {
      return (parseFloat(av) || 0 - parseFloat(bv) || 0) * dir;
    }
    return String(av).localeCompare(String(bv)) * dir;
  });

  var thead = SCOPE_COLS.map(function(c) {
    var cls = ppScopeSortState.col === c.key ? ' sort-' + ppScopeSortState.dir : '';
    return '<th class="pp-scope-th' + cls + '" onclick="ppScopeSetSort(\'' + c.key + '\')">' + escapeHtml(c.label) + '</th>';
  }).join('');

  var tbody = rows.length === 0
    ? '<tr><td class="pp-scope-empty" colspan="' + SCOPE_COLS.length + '">No records found.</td></tr>'
    : rows.map(function(r) {
        return '<tr>' + SCOPE_COLS.map(function(c) {
          var v = r[c.key];
          var display = '';
          if (v !== '' && v !== null && v !== undefined) {
            if (c.type === 'currency') {
              display = '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else {
              display = escapeHtml(String(v));
            }
          }
          var numCls = (c.type === 'num' || c.type === 'currency') ? ' pp-scope-td-num' : '';
          return '<td class="pp-scope-td' + numCls + '">' + display + '</td>';
        }).join('') + '</tr>';
      }).join('');

  var selectOpts = '<option value="">All Products</option>' +
    products.map(function(p) {
      return '<option value="' + escapeHtml(p) + '"' + (p === ppScopeFilter ? ' selected' : '') + '>' + escapeHtml(p) + '</option>';
    }).join('');

  pane.innerHTML =
    '<div class="pp-scope-toolbar">' +
      '<select class="pp-scope-filter" onchange="ppScopeFilterChange(this.value)">' + selectOpts + '</select>' +
      '<span class="pp-scope-count">' + rows.length + ' of ' + ppScopeData.length + ' items</span>' +
    '</div>' +
    '<div class="pp-scope-table-wrap">' +
      '<table class="pp-scope-table">' +
        '<thead><tr>' + thead + '</tr></thead>' +
        '<tbody>' + tbody + '</tbody>' +
      '</table>' +
    '</div>';
}

window.ppScopeSetSort = function(col) {
  if (ppScopeSortState.col === col) {
    ppScopeSortState.dir = ppScopeSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    ppScopeSortState.col = col;
    ppScopeSortState.dir = 'asc';
  }
  ppRenderScope();
};

window.ppScopeFilterChange = function(v) {
  ppScopeFilter = v;
  ppRenderScope();
};

// ─── ASSETS REPORT ─────────────────────────────────────────────
async function ppLoadAssets(projId) {
  ppAssetsData    = [];
  ppAssetsChanges = {};
  ppAssetsFilter  = { received: '', assetType: '' };
  ppAssetsSortState = { col: 'fileType', dir: 'asc' };
  var pane = document.getElementById('ppModalPane-assets');
  if (!pane) return;
  pane.innerHTML = '<div class="pp-loading">Loading\u2026</div>';
  try {
    var fids = [FIELD.ASSETS.id, FIELD.ASSETS.fileType, FIELD.ASSETS.assetTypes,
                FIELD.ASSETS.notes, FIELD.ASSETS.fileLink, FIELD.ASSETS.received, FIELD.ASSETS.hidden];
    var rows = await qbQueryAll(
      TABLES.assets, fids,
      '{' + FIELD.ASSETS.projectRef + '.EX.' + projId + '}'
    );
    ppAssetsData = rows.map(function(r) {
      return {
        id:         val(r, FIELD.ASSETS.id),
        fileType:   val(r, FIELD.ASSETS.fileType),
        assetTypes: val(r, FIELD.ASSETS.assetTypes),
        notes:      val(r, FIELD.ASSETS.notes),
        fileLink:   val(r, FIELD.ASSETS.fileLink),
        received:   val(r, FIELD.ASSETS.received),
        hidden:     val(r, FIELD.ASSETS.hidden)
      };
    });
    ppRenderAssets();
  } catch(err) {
    var p = document.getElementById('ppModalPane-assets');
    if (p) p.innerHTML = '<div class="pp-loading">Failed to load assets.</div>';
    console.error('[PreProd assets]', err);
  }
}

function ppRenderAssets() {
  var pane = document.getElementById('ppModalPane-assets');
  if (!pane) return;

  // Unique asset type options from all data (before filter)
  var assetTypes = [];
  ppAssetsData.forEach(function(r) {
    var t = r.assetTypes || '';
    if (t && assetTypes.indexOf(t) < 0) assetTypes.push(t);
  });
  assetTypes.sort(function(a, b) { return a.localeCompare(b); });

  // Filter rows
  var rows = ppAssetsData.filter(function(r) {
    if (r.hidden === true || r.hidden === 'true') return false;
    if (ppAssetsFilter.received === 'yes'  && !(r.received === true || r.received === 'true')) return false;
    if (ppAssetsFilter.received === 'no'   &&  (r.received === true || r.received === 'true')) return false;
    if (ppAssetsFilter.assetType && r.assetTypes !== ppAssetsFilter.assetType) return false;
    return true;
  });

  // Sort
  var col = ppAssetsSortState.col;
  var dir = ppAssetsSortState.dir === 'asc' ? 1 : -1;
  rows.sort(function(a, b) {
    var av = a[col], bv = b[col];
    if (typeof av === 'boolean' || typeof bv === 'boolean') {
      return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
    }
    return String(av || '').localeCompare(String(bv || '')) * dir;
  });

  // Toolbar
  var typeOpts = '<option value="">All Types</option>' +
    assetTypes.map(function(t) {
      return '<option value="' + escapeHtml(t) + '"' + (t === ppAssetsFilter.assetType ? ' selected' : '') + '>' + escapeHtml(t) + '</option>';
    }).join('');

  var toolbar =
    '<div class="pp-scope-toolbar">' +
      '<select class="pp-scope-filter" onchange="ppAssetsTypeFilter(this.value)">' + typeOpts + '</select>' +
      '<select class="pp-scope-filter" style="max-width:160px" onchange="ppAssetsReceivedFilter(this.value)">' +
        '<option value=""' + (!ppAssetsFilter.received ? ' selected' : '') + '>All</option>' +
        '<option value="yes"' + (ppAssetsFilter.received === 'yes' ? ' selected' : '') + '>Received</option>' +
        '<option value="no"'  + (ppAssetsFilter.received === 'no'  ? ' selected' : '') + '>Not Received</option>' +
      '</select>' +
      '<span class="pp-scope-count">' + rows.length + ' of ' + ppAssetsData.filter(function(r){ return !(r.hidden === true || r.hidden === 'true'); }).length + ' items</span>' +
    '</div>';

  // Table headers
  var thead = ASSETS_COLS.map(function(c) {
    var cls = ppAssetsSortState.col === c.key ? ' sort-' + ppAssetsSortState.dir : '';
    return '<th class="pp-scope-th' + cls + '" onclick="ppAssetsSetSort(\'' + c.key + '\')">' + escapeHtml(c.label) + '</th>';
  }).join('');

  // Table body
  var PENCIL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

  var tbody = rows.length === 0
    ? '<tr><td class="pp-scope-empty" colspan="' + ASSETS_COLS.length + '">No records found.</td></tr>'
    : rows.map(function(r) {
        var cells = ASSETS_COLS.map(function(c) {
          var v = r[c.key];
          var content = '';
          if (c.type === 'check') {
            var checked = (v === true || v === 'true') ? ' checked' : '';
            content = '<input type="checkbox"' + checked +
              ' onchange="ppAssetsCheck(' + r.id + ',' + c.fid + ',this.checked)"' +
              ' style="cursor:pointer;width:15px;height:15px">';
          } else if (c.type === 'notes') {
            var noteText = String(v || '');
            content =
              '<span class="pp-cell-notes" title="' + escapeHtml(noteText) + '">' + escapeHtml(noteText) + '</span>' +
              '<button class="pp-cell-btn" onclick="ppAssetShowDialog(' + r.id + ',' + c.fid + ',\'' + c.key + '\',\'Notes\',\'notes\')" title="Edit notes">' + PENCIL_SVG + '</button>';
          } else if (c.type === 'link') {
            var linkVal = String(v || '');
            var isUrl = linkVal && (linkVal.indexOf('http') === 0 || linkVal.indexOf('//') === 0);
            content = (isUrl
              ? '<a class="pp-cell-link" href="' + escapeHtml(linkVal) + '" target="_blank" rel="noopener">Open</a>'
              : (linkVal ? '<span>' + escapeHtml(linkVal) + '</span>' : '')) +
              '<button class="pp-cell-btn" onclick="ppAssetShowDialog(' + r.id + ',' + c.fid + ',\'' + c.key + '\',\'File Link\',\'link\')" title="Edit link">' + PENCIL_SVG + '</button>';
          } else {
            content = escapeHtml(String(v || ''));
          }
          var align = (c.type === 'check') ? ' style="text-align:center"' : '';
          return '<td class="pp-scope-td"' + align + '>' + content + '</td>';
        }).join('');
        return '<tr>' + cells + '</tr>';
      }).join('');

  pane.innerHTML =
    toolbar +
    '<div class="pp-scope-table-wrap">' +
      '<table class="pp-scope-table">' +
        '<thead><tr>' + thead + '</tr></thead>' +
        '<tbody>' + tbody + '</tbody>' +
      '</table>' +
    '</div>';
}

async function ppFlushAssetsChanges() {
  var ids = Object.keys(ppAssetsChanges);
  if (ids.length === 0) return;
  var records = ids.map(function(id) {
    var changes = ppAssetsChanges[id];
    var rec = {};
    rec[FIELD.ASSETS.id] = { value: parseInt(id, 10) };
    Object.keys(changes).forEach(function(fid) {
      rec[parseInt(fid, 10)] = { value: changes[fid] };
    });
    return rec;
  });
  ppAssetsChanges = {};
  try {
    await qbUpsert(TABLES.assets, records);
    showToast('Asset changes saved.', 'success');
  } catch(err) {
    showToast('Failed to save asset changes.', 'error');
    console.error('[PreProd assets]', err);
  }
}

window.ppAssetsSetSort = function(col) {
  if (ppAssetsSortState.col === col) {
    ppAssetsSortState.dir = ppAssetsSortState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    ppAssetsSortState.col = col;
    ppAssetsSortState.dir = 'asc';
  }
  ppRenderAssets();
};

window.ppAssetsTypeFilter = function(v) {
  ppAssetsFilter.assetType = v;
  ppRenderAssets();
};

window.ppAssetsReceivedFilter = function(v) {
  ppAssetsFilter.received = v;
  ppRenderAssets();
};

window.ppAssetsCheck = function(recordId, fid, checked) {
  var row = ppAssetsData.find(function(r) { return r.id == recordId; });
  if (row) {
    var col = ASSETS_COLS.find(function(c) { return c.fid == fid; });
    if (col) row[col.key] = checked;
  }
  if (!ppAssetsChanges[recordId]) ppAssetsChanges[recordId] = {};
  ppAssetsChanges[recordId][fid] = checked;
  // If hidden was just checked, re-render to remove the row
  if (fid === FIELD.ASSETS.hidden && checked) ppRenderAssets();
};

window.ppAssetShowDialog = function(recordId, fid, key, label, type) {
  var row = ppAssetsData.find(function(r) { return r.id == recordId; });
  var currentValue = (row && row[key]) ? String(row[key]) : '';
  ppAssetDialogState = { id: recordId, fid: fid, key: key };

  var overlay = document.getElementById('ppAssetDialogOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ppAssetDialogOverlay';
    overlay.className = 'pp-asset-dialog-overlay';
    overlay.addEventListener('click', function(e) { if (e.target === overlay) ppAssetDialogClose(); });
    document.body.appendChild(overlay);
  }

  var inputHtml = type === 'notes'
    ? '<textarea class="pp-asset-dialog-input" id="ppAssetDialogInput" rows="5">' + escapeHtml(currentValue) + '</textarea>'
    : '<input class="pp-asset-dialog-input" id="ppAssetDialogInput" type="text" value="' + escapeHtml(currentValue) + '" placeholder="https://\u2026">';

  overlay.innerHTML =
    '<div class="pp-asset-dialog">' +
      '<div class="pp-asset-dialog-header">' +
        '<span class="pp-asset-dialog-title">Edit ' + escapeHtml(label) + '</span>' +
        '<button class="pp-modal-close" onclick="ppAssetDialogClose()">&#x2715;</button>' +
      '</div>' +
      '<div class="pp-asset-dialog-body">' + inputHtml + '</div>' +
      '<div class="pp-asset-dialog-footer">' +
        '<button class="btn btn-sm" onclick="ppAssetDialogClose()">Cancel</button>' +
        '<button class="btn btn-sm" onclick="ppAssetDialogSave()">Done</button>' +
      '</div>' +
    '</div>';

  overlay.style.display = 'flex';
  var inp = document.getElementById('ppAssetDialogInput');
  if (inp) { inp.focus(); if (inp.select) inp.select(); }
};

window.ppAssetDialogClose = function() {
  var overlay = document.getElementById('ppAssetDialogOverlay');
  if (overlay) overlay.style.display = 'none';
};

window.ppAssetDialogSave = function() {
  var inp = document.getElementById('ppAssetDialogInput');
  if (!inp) return;
  var value = inp.value;
  var id    = ppAssetDialogState.id;
  var fid   = ppAssetDialogState.fid;
  var key   = ppAssetDialogState.key;
  var row   = ppAssetsData.find(function(r) { return r.id == id; });
  if (row) row[key] = value;
  if (!ppAssetsChanges[id]) ppAssetsChanges[id] = {};
  ppAssetsChanges[id][fid] = value;
  ppAssetDialogClose();
  ppRenderAssets();
};

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
          '<div class="pp-modal-title-wrap">' +
            '<span class="pp-modal-title"></span>' +
            '<div class="pp-modal-header-badges"></div>' +
          '</div>' +
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

  var titleText = proj ? (proj.name || '\u2014') : '';
  if (proj && proj.fid54) titleText += ' \u2014 ' + proj.fid54;
  overlay.querySelector('.pp-modal-title').textContent = titleText;

  var typeColor  = (proj && TYPE_COLORS[proj.type])   || '#868e96';
  var stageColor = (proj && STAGE_COLORS[proj.stage]) || '#868e96';
  var typeBadge  = proj && proj.type
    ? '<span class="pp-badge" style="background:' + typeColor + '22;color:' + typeColor + '">' + escapeHtml(proj.type) + '</span>' : '';
  var stageBadge = proj && proj.stage
    ? '<span class="pp-badge" style="background:' + stageColor + '22;color:' + stageColor + '">' + escapeHtml(proj.stage) + '</span>' : '';
  overlay.querySelector('.pp-modal-header-badges').innerHTML = typeBadge + stageBadge;

  var notesHtml = (proj && proj.fid36) || '';
  overlay.querySelector('.pp-modal-body').innerHTML =
    '<div class="pp-modal-info">' +
      '<div class="pp-modal-info-col" style="flex:1">' +
        '<div class="pp-modal-info-item"><span class="pp-modal-info-label">Deal Closed</span>' +
          '<span class="pp-modal-info-value">' + escapeHtml((proj && proj.fid55) || '\u2014') + '</span></div>' +
        '<div class="pp-modal-info-item"><span class="pp-modal-info-label">Sales Rep</span>' +
          '<span class="pp-modal-info-value">' + escapeHtml((proj && proj.fid62) || '\u2014') + '</span></div>' +
        '<div class="pp-modal-info-item"><span class="pp-modal-info-label">Project #</span>' +
          '<input class="pp-modal-edit-input" id="ppEditProjNum" value="' + escapeHtml((proj && proj.number) || '') + '"' +
          ' onblur="ppSaveField(' + id + ',' + FIELD.PROJECTS.number + ',this.value,\'number\')"' +
          ' onkeydown="if(event.key===\'Enter\')this.blur()"></div>' +
        '<div class="pp-modal-info-item"><span class="pp-modal-info-label">POD</span>' +
          '<select class="pp-modal-select" id="ppEditPod" onchange="ppSaveField(' + id + ',' + FIELD.PROJECTS.pod + ',this.value,\'pod\')">' +
            '<option value="">Loading\u2026</option>' +
          '</select></div>' +
      '</div>' +
      '<div class="pp-modal-info-col" style="flex:2;min-height:0">' +
        '<div class="pp-notes-header">' +
          '<span class="pp-modal-info-label">Notes</span>' +
          '<button class="btn btn-sm" id="ppNotesEditBtn" onclick="ppNotesEdit(' + id + ')">Edit</button>' +
        '</div>' +
        '<div id="ppNotesView" class="pp-notes-view"></div>' +
        '<div id="ppNotesEditWrap" class="pp-notes-edit-wrap" style="display:none">' +
          '<div class="pp-modal-rte-toolbar">' +
            '<button class="pp-modal-rte-btn" onmousedown="event.preventDefault();ppRteCmd(\'bold\')"              title="Bold"><b>B</b></button>' +
            '<button class="pp-modal-rte-btn" onmousedown="event.preventDefault();ppRteCmd(\'italic\')"            title="Italic"><i>I</i></button>' +
            '<button class="pp-modal-rte-btn" onmousedown="event.preventDefault();ppRteCmd(\'underline\')"         title="Underline"><u>U</u></button>' +
            '<button class="pp-modal-rte-btn" onmousedown="event.preventDefault();ppRteCmd(\'strikeThrough\')"     title="Strikethrough"><s>S</s></button>' +
            '<span class="pp-modal-rte-sep"></span>' +
            '<button class="pp-modal-rte-btn" onmousedown="event.preventDefault();ppRteCmd(\'insertUnorderedList\')" title="Bullet list" style="font-size:14px">•</button>' +
            '<button class="pp-modal-rte-btn" onmousedown="event.preventDefault();ppRteCmd(\'insertOrderedList\')"   title="Numbered list" style="font-size:10px;width:32px">1.</button>' +
            '<button class="btn btn-sm" style="margin-left:auto" onclick="ppNotesCancel()">Cancel</button>' +
            '<button class="btn btn-sm" onclick="ppNotesSave(' + id + ')">Save</button>' +
          '</div>' +
          '<div class="pp-modal-rte" id="ppNotesEditor" contenteditable="true"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="pp-modal-tabs">' +
      '<button class="pp-modal-tab-btn active" data-tab="scope"   onclick="ppModalTab(\'scope\')">Project Scope</button>' +
      '<button class="pp-modal-tab-btn"        data-tab="assets"  onclick="ppModalTab(\'assets\')">Technical Assets</button>' +
    '</div>' +
    '<div class="pp-modal-tab-pane active" id="ppModalPane-scope"></div>' +
    '<div class="pp-modal-tab-pane" id="ppModalPane-assets"></div>';

  // Populate notes view (read-only by default)
  var notesView = overlay.querySelector('#ppNotesView');
  if (notesView) {
    notesView.innerHTML = notesHtml || '<span class="pp-notes-empty">No notes yet. Click Edit to add notes.</span>';
  }

  // Load tab reports
  var dealId = proj && proj.deal;
  if (dealId) {
    ppLoadScope(dealId);
  } else {
    var scopePane = overlay.querySelector('#ppModalPane-scope');
    if (scopePane) scopePane.innerHTML = '<div class="pp-loading">No deal reference on this project.</div>';
  }
  if (proj && proj.id) {
    ppLoadAssets(proj.id);
  } else {
    var assetsPane = overlay.querySelector('#ppModalPane-assets');
    if (assetsPane) assetsPane.innerHTML = '<div class="pp-loading">No project reference.</div>';
  }

  // Populate POD dropdown async from cache
  getCachedPods().then(function(pods) {
    var sel = document.getElementById('ppEditPod');
    if (!sel) return;
    var cur = (proj && proj.pod) || '';
    sel.innerHTML = '<option value="">— Select POD —</option>' +
      pods.map(function(p) {
        return '<option value="' + escapeHtml(p.name) + '"' + (p.name === cur ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>';
      }).join('');
  });

  overlay.style.display = 'flex';
};

window.ppCloseModal = function() {
  ppFlushAssetsChanges(); // fire-and-forget; saves buffered checkbox/edit changes
  var el = document.getElementById('ppModalOverlay');
  if (el) el.style.display = 'none';
};

window.ppModalTab = function(tab) {
  var overlay = document.getElementById('ppModalOverlay');
  if (!overlay) return;
  overlay.querySelectorAll('.pp-modal-tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  overlay.querySelectorAll('.pp-modal-tab-pane').forEach(function(p) {
    p.classList.toggle('active', p.id === 'ppModalPane-' + tab);
  });
};

window.ppSaveField = function(projId, fieldId, value, localKey) {
  var proj = getProj(projId);
  if (!proj) return;
  proj[localKey] = value;
  var rec = {};
  rec[FIELD.PROJECTS.id] = { value: projId };
  rec[fieldId]           = { value: value };
  qbUpsert(TABLES.projects, [rec])
    .then(function()  { showToast('Saved.', 'success'); })
    .catch(function(err) {
      showToast('Failed to save.', 'error');
      console.error('[PreProd]', err);
    });
};

window.ppRteCmd = function(cmd) {
  document.execCommand(cmd, false, null);
  var el = document.getElementById('ppNotesEditor');
  if (el) el.focus();
};

window.ppNotesEdit = function(projId) {
  var view   = document.getElementById('ppNotesView');
  var wrap   = document.getElementById('ppNotesEditWrap');
  var btn    = document.getElementById('ppNotesEditBtn');
  var editor = document.getElementById('ppNotesEditor');
  if (!view || !wrap || !editor) return;
  var proj = getProj(projId);
  editor.innerHTML = (proj && proj.fid36) || '';
  view.style.display = 'none';
  wrap.style.display = 'flex';
  if (btn) btn.style.display = 'none';
  editor.focus();
};

window.ppNotesCancel = function() {
  var view = document.getElementById('ppNotesView');
  var wrap = document.getElementById('ppNotesEditWrap');
  var btn  = document.getElementById('ppNotesEditBtn');
  if (!view || !wrap) return;
  view.style.display = '';
  wrap.style.display = 'none';
  if (btn) btn.style.display = '';
};

window.ppNotesSave = function(projId) {
  var editor = document.getElementById('ppNotesEditor');
  var view   = document.getElementById('ppNotesView');
  if (!editor) return;
  var html = editor.innerHTML;
  if (view) {
    view.innerHTML = html || '<span class="pp-notes-empty">No notes yet. Click Edit to add notes.</span>';
  }
  ppSaveField(projId, FIELD.PROJECTS.fid36, html, 'fid36');
  ppNotesCancel();
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
