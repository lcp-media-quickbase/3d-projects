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

// TAR (Technical Asset Review dashboard tab) state
var ppTarData   = [];
var ppTarLoaded = false;
var ppTarFilter = { fileType: '', projectName: '', clientName: '' };

var TAR_COLS = [
  { key: 'projectName', label: 'Project',             fid: FIELD.ASSETS.projectName, type: 'text'  },
  { key: 'fileType',    label: 'File Type',           fid: FIELD.ASSETS.fileType,    type: 'text'  },
  { key: 'assetTypes',  label: 'Related Asset Types', fid: FIELD.ASSETS.assetTypes,  type: 'text'  },
  { key: 'notes',       label: 'Notes',               fid: FIELD.ASSETS.notes,       type: 'notes' },
  { key: 'fileLink',    label: 'File Link',           fid: FIELD.ASSETS.fileLink,    type: 'link'  },
  { key: 'received',    label: 'Received?',           fid: FIELD.ASSETS.received,    type: 'check' }
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
  { key: 'complete', label: 'Complete' }
];

// RFP (Ready for Production) report state
var ppRfpData   = [];
var ppRfpLoaded = false;
var ppRfpPods   = [];

// In Production report state
var ppInProdData         = [];
var ppInProdLoaded       = false;
var ppInProdPreProdCount = 0;

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
  .pp-type-badge { display:inline-flex; align-items:center; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; letter-spacing:0.02em; margin:1px 2px; white-space:nowrap; }
  .pp-modal-container { display:flex; gap:0; align-items:stretch; height:88vh; max-height:88vh; }
  .pp-modal { flex-shrink:0; }
  .pp-contract-drawer { overflow:hidden; flex-shrink:0; width:0; transition:width 0.35s cubic-bezier(0.4,0,0.2,1), margin-left 0.35s cubic-bezier(0.4,0,0.2,1); }
  .pp-contract-drawer.open { width:680px; max-width:88vw; margin-left:12px; }
  .pp-contract-drawer-inner { width:680px; max-width:88vw; height:100%; background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.35); display:flex; flex-direction:column; overflow:hidden; }
  .pp-contract-drawer-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .pp-contract-drawer-title { font-size:14px; font-weight:700; color:var(--text); }
  .pp-contract-drawer-body { flex:1; overflow:hidden; position:relative; display:flex; flex-direction:column; }
  .pp-contract-frame { flex:1; width:100%; border:none; display:block; }
  .pp-contract-loading { display:flex; align-items:center; justify-content:center; flex:1; color:var(--text-dim); font-size:14px; }
  .pp-tar-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:12px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }
  .pp-tar-groups { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:8px; min-height:0; }
  .pp-tar-group { border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .pp-tar-group-header { display:flex; align-items:center; gap:8px; padding:9px 14px; cursor:pointer; background:var(--surface); user-select:none; transition:background 0.15s; }
  .pp-tar-group-header:hover { background:var(--bg); }
  .pp-tar-group-chevron { font-size:10px; color:var(--text-muted); transition:transform 0.2s; display:inline-block; line-height:1; }
  .pp-tar-group-header.open .pp-tar-group-chevron { transform:rotate(90deg); }
  .pp-tar-group-label { font-size:13px; font-weight:700; color:var(--text); flex:1; }
  .pp-tar-group-count { font-size:11px; color:var(--text-muted); }
  .pp-tar-group-body { border-top:1px solid var(--border); overflow-x:auto; }
  .pp-tar-group-body .pp-scope-table { border:none; border-radius:0; }
  .pp-inprod-layout { display:flex; flex:1; overflow:hidden; min-height:0; }
  .pp-inprod-main { flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden; border-right:1px solid var(--border); }
  .pp-inprod-sidebar { width:260px; flex-shrink:0; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:12px; }
  .pp-kpi-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:3px; }
  .pp-kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-dim); margin-bottom:2px; }
  .pp-kpi-value { font-size:30px; font-weight:700; color:var(--text); line-height:1.2; }
  .pp-kpi-sub { font-size:11px; color:var(--text-muted); }
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
    if (s.key === 'tar') {
      return '<div class="pp-subtab-pane" id="ppPane-tar">' +
        '<div id="ppTarToolbar" class="pp-tar-toolbar"><span style="color:var(--text-dim);font-size:13px">Loading\u2026</span></div>' +
        '<div id="ppTarContent" class="pp-tar-groups pp-loading">Loading\u2026</div>' +
        '</div>';
    }
    if (s.key === 'ready') {
      return '<div class="pp-subtab-pane" id="ppPane-ready">' +
        '<div id="ppRfpContent" class="pp-loading">Loading\u2026</div>' +
        '</div>';
    }
    if (s.key === 'inprod') {
      return '<div class="pp-subtab-pane" id="ppPane-inprod">' +
        '<div id="ppInProdLayout" class="pp-loading">Loading\u2026</div>' +
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
  if (sub === 'tar'    && !ppTarLoaded)    ppLoadTar();
  if (sub === 'ready'  && !ppRfpLoaded)   ppLoadRfp();
  if (sub === 'inprod' && !ppInProdLoaded) ppLoadInProd();
}

// ─── DATA ──────────────────────────────────────────────────────
async function ppLoadData() {
  var rows = await qbQueryAll(
    TABLES.projects,
    [FIELD.PROJECTS.id, FIELD.PROJECTS.name, FIELD.PROJECTS.number,
     FIELD.PROJECTS.type, FIELD.PROJECTS.stage, FIELD.PROJECTS.pod, FIELD.PROJECTS.deal, FIELD.PROJECTS.opportunity,
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
      opportunity: val(r, FIELD.PROJECTS.opportunity),
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
      // Multi-select returns an array; val() would JSON.stringify it, so read raw
      var rawTypes = r[FIELD.ASSETS.assetTypes];
      var typesArr = [];
      if (rawTypes && rawTypes.value) {
        var tv = rawTypes.value;
        if (Array.isArray(tv)) typesArr = tv;
        else if (typeof tv === 'string' && tv) { try { var p = JSON.parse(tv); typesArr = Array.isArray(p) ? p : [tv]; } catch(e) { typesArr = [tv]; } }
      }
      return {
        id:         val(r, FIELD.ASSETS.id),
        fileType:   val(r, FIELD.ASSETS.fileType),
        assetTypes: typesArr,
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

  // Unique individual asset type options from all data (before filter)
  var assetTypes = [];
  ppAssetsData.forEach(function(r) {
    (r.assetTypes || []).forEach(function(t) {
      if (t && assetTypes.indexOf(t) < 0) assetTypes.push(t);
    });
  });
  assetTypes.sort(function(a, b) { return a.localeCompare(b); });

  // Filter rows
  var rows = ppAssetsData.filter(function(r) {
    if (r.hidden === true || r.hidden === 'true') return false;
    if (ppAssetsFilter.received === 'yes'  && !(r.received === true || r.received === 'true')) return false;
    if (ppAssetsFilter.received === 'no'   &&  (r.received === true || r.received === 'true')) return false;
    if (ppAssetsFilter.assetType && (r.assetTypes || []).indexOf(ppAssetsFilter.assetType) < 0) return false;
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
          } else if (c.key === 'assetTypes') {
            var types = Array.isArray(v) ? v : (v ? [v] : []);
            content = types.map(function(t) {
              var color = ppAssetTypeColor(t);
              return '<span class="pp-type-badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44">' + escapeHtml(t) + '</span>';
            }).join('');
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

// ─── TAR REPORT ────────────────────────────────────────────────
async function ppLoadTar() {
  var toolbar  = document.getElementById('ppTarToolbar');
  var groupsEl = document.getElementById('ppTarContent');
  if (groupsEl) { groupsEl.className = 'pp-tar-groups pp-loading'; groupsEl.innerHTML = 'Loading\u2026'; }
  try {
    var fids = [FIELD.ASSETS.id, FIELD.ASSETS.fileType, FIELD.ASSETS.assetTypes,
                FIELD.ASSETS.notes, FIELD.ASSETS.fileLink, FIELD.ASSETS.received,
                FIELD.ASSETS.projectName, FIELD.ASSETS.clientName, FIELD.ASSETS.progress];
    var where = '{' + FIELD.ASSETS.hidden + '.EX.false}AND{' + FIELD.ASSETS.projectStage + '.EX.\'Pre-Production\'}';
    var rows = await qbQueryAll(TABLES.assets, fids, where);
    ppTarData = rows.map(function(r) {
      var rawTypes = r[FIELD.ASSETS.assetTypes];
      var typesArr = [];
      if (rawTypes && rawTypes.value) {
        var tv = rawTypes.value;
        if (Array.isArray(tv)) typesArr = tv;
        else if (typeof tv === 'string' && tv) { try { var p = JSON.parse(tv); typesArr = Array.isArray(p) ? p : [tv]; } catch(e) { typesArr = [tv]; } }
      }
      return {
        id:          val(r, FIELD.ASSETS.id),
        fileType:    val(r, FIELD.ASSETS.fileType),
        assetTypes:  typesArr,
        notes:       val(r, FIELD.ASSETS.notes),
        fileLink:    val(r, FIELD.ASSETS.fileLink),
        received:    val(r, FIELD.ASSETS.received),
        projectName: val(r, FIELD.ASSETS.projectName),
        clientName:  val(r, FIELD.ASSETS.clientName),
        progress:    val(r, FIELD.ASSETS.progress)
      };
    });
    ppTarLoaded = true;
    ppRenderTar();
  } catch(err) {
    if (groupsEl) { groupsEl.className = 'pp-tar-groups pp-loading'; groupsEl.innerHTML = 'Error loading data.'; }
    console.error('[TAR]', err);
  }
}

function ppRenderTar() {
  var toolbar  = document.getElementById('ppTarToolbar');
  var groupsEl = document.getElementById('ppTarContent');
  if (!toolbar || !groupsEl) return;

  // Unique filter option values from full dataset
  var fileTypes = [], projectNames = [], clientNames = [];
  ppTarData.forEach(function(r) {
    if (r.fileType    && fileTypes.indexOf(r.fileType)       < 0) fileTypes.push(r.fileType);
    if (r.projectName && projectNames.indexOf(r.projectName) < 0) projectNames.push(r.projectName);
    if (r.clientName  && clientNames.indexOf(r.clientName)   < 0) clientNames.push(r.clientName);
  });
  fileTypes.sort(); projectNames.sort(); clientNames.sort();

  // Apply filters
  var filtered = ppTarData.filter(function(r) {
    if (ppTarFilter.fileType    && r.fileType    !== ppTarFilter.fileType)    return false;
    if (ppTarFilter.projectName && r.projectName !== ppTarFilter.projectName) return false;
    if (ppTarFilter.clientName  && r.clientName  !== ppTarFilter.clientName)  return false;
    return true;
  });

  // Group by progress (FID 48)
  var groups = {};
  filtered.forEach(function(r) {
    var k = String(r.progress != null ? r.progress : '');
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  });
  // Sort group keys high → low (numeric desc, then alpha desc)
  var groupKeys = Object.keys(groups).sort(function(a, b) {
    var an = parseFloat(a), bn = parseFloat(b);
    if (!isNaN(an) && !isNaN(bn)) return bn - an;
    return b.localeCompare(a);
  });

  // Render toolbar
  function makeOpts(arr, cur, allLabel) {
    return '<option value=""' + (!cur ? ' selected' : '') + '>' + escapeHtml(allLabel) + '</option>' +
      arr.map(function(v) { return '<option value="' + escapeHtml(v) + '"' + (v === cur ? ' selected' : '') + '>' + escapeHtml(v) + '</option>'; }).join('');
  }
  toolbar.innerHTML =
    '<select class="pp-scope-filter" onchange="ppTarFilterChange(\'fileType\',this.value)">'    + makeOpts(fileTypes,    ppTarFilter.fileType,    'All File Types') + '</select>' +
    '<select class="pp-scope-filter" onchange="ppTarFilterChange(\'projectName\',this.value)">' + makeOpts(projectNames, ppTarFilter.projectName, 'All Projects')   + '</select>' +
    '<select class="pp-scope-filter" onchange="ppTarFilterChange(\'clientName\',this.value)">'  + makeOpts(clientNames,  ppTarFilter.clientName,  'All Clients')    + '</select>' +
    '<span class="pp-scope-count">' + filtered.length + ' item' + (filtered.length !== 1 ? 's' : '') + '</span>' +
    '<button class="btn btn-sm" style="margin-left:auto" onclick="ppTarExpandAll()">Expand All</button>' +
    '<button class="btn btn-sm" onclick="ppTarCollapseAll()">Collapse All</button>';

  if (groupKeys.length === 0) {
    groupsEl.className = 'pp-tar-groups';
    groupsEl.innerHTML = '<div class="pp-loading" style="min-height:80px">No records found.</div>';
    return;
  }

  var PENCIL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var thead = TAR_COLS.map(function(c) { return '<th class="pp-scope-th">' + escapeHtml(c.label) + '</th>'; }).join('');

  groupsEl.className = 'pp-tar-groups';
  groupsEl.innerHTML = groupKeys.map(function(gk) {
    var grpRows = groups[gk];
    var tbody = grpRows.map(function(r) {
      var cells = TAR_COLS.map(function(c) {
        var v = r[c.key];
        var cellHtml = '';
        if (c.type === 'check') {
          var chk = (v === true || v === 'true') ? ' checked' : '';
          cellHtml = '<input type="checkbox"' + chk + ' onchange="ppTarCheck(' + r.id + ',' + c.fid + ',this.checked)" style="cursor:pointer;width:15px;height:15px">';
        } else if (c.type === 'notes') {
          var nt = String(v || '');
          cellHtml = '<span class="pp-cell-notes" title="' + escapeHtml(nt) + '">' + escapeHtml(nt) + '</span>' +
            '<button class="pp-cell-btn" onclick="ppTarShowDialog(' + r.id + ',' + c.fid + ',\'' + c.key + '\',\'Notes\',\'notes\')" title="Edit notes">' + PENCIL_SVG + '</button>';
        } else if (c.type === 'link') {
          var lv = String(v || '');
          var isUrl = lv && (lv.indexOf('http') === 0 || lv.indexOf('//') === 0);
          cellHtml = (isUrl ? '<a class="pp-cell-link" href="' + escapeHtml(lv) + '" target="_blank" rel="noopener">Open</a>' : (lv ? '<span>' + escapeHtml(lv) + '</span>' : '')) +
            '<button class="pp-cell-btn" onclick="ppTarShowDialog(' + r.id + ',' + c.fid + ',\'' + c.key + '\',\'File Link\',\'link\')" title="Edit link">' + PENCIL_SVG + '</button>';
        } else if (c.key === 'assetTypes') {
          var types = Array.isArray(v) ? v : (v ? [v] : []);
          cellHtml = types.map(function(t) {
            var color = ppAssetTypeColor(t);
            return '<span class="pp-type-badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44">' + escapeHtml(t) + '</span>';
          }).join('');
        } else {
          cellHtml = escapeHtml(String(v || ''));
        }
        var align = (c.type === 'check') ? ' style="text-align:center"' : '';
        return '<td class="pp-scope-td"' + align + '>' + cellHtml + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    return '<div class="pp-tar-group">' +
      '<div class="pp-tar-group-header" onclick="ppTarToggleGroup(this)">' +
        '<span class="pp-tar-group-chevron">&#9654;</span>' +
        '<span class="pp-tar-group-label">' + escapeHtml(gk || 'No Progress Set') + '</span>' +
        '<span class="pp-tar-group-count">' + grpRows.length + ' item' + (grpRows.length !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div class="pp-tar-group-body" style="display:none">' +
        '<table class="pp-scope-table"><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ─── READY FOR PRODUCTION REPORT ───────────────────────────────
async function ppLoadRfp() {
  var el = document.getElementById('ppRfpContent');
  if (el) { el.className = 'pp-loading'; el.innerHTML = 'Loading\u2026'; }
  try {
    var fids = [FIELD.PROJECTS.id, FIELD.PROJECTS.name, FIELD.PROJECTS.stage,
                FIELD.PROJECTS.folder, FIELD.PROJECTS.pod, FIELD.PROJECTS.fid116, FIELD.PROJECTS.fid118,
                FIELD.PROJECTS.techAssets, FIELD.PROJECTS.rfpDate, FIELD.PROJECTS.sendToProd];
    var where = '{' + FIELD.PROJECTS.stage + '.XEX.\'Complete\'}AND{' + FIELD.PROJECTS.stage + '.XEX.\'Delivered\'}AND{' + FIELD.PROJECTS.stage + '.XEX.\'In Production\'}';
    var results = await Promise.all([qbQueryAll(TABLES.projects, fids, where), getCachedPods()]);
    var rows = results[0];
    ppRfpPods = results[1];
    ppRfpData = rows.map(function(r) {
      var folder = val(r, FIELD.PROJECTS.folder);
      var rfpRaw = val(r, FIELD.PROJECTS.rfpDate) || '';
      // Format ISO date → MM/DD/YY
      var rfpDisplay = rfpRaw;
      if (rfpRaw) {
        var parts = rfpRaw.split('-');
        if (parts.length === 3) rfpDisplay = parts[1] + '/' + parts[2] + '/' + parts[0].slice(2);
      }
      return {
        id:          val(r, FIELD.PROJECTS.id),
        name:        val(r, FIELD.PROJECTS.name),
        stage:       val(r, FIELD.PROJECTS.stage),
        folder:      folder,
        pod:         val(r, FIELD.PROJECTS.pod),
        fid116:      val(r, FIELD.PROJECTS.fid116),
        fid118:      val(r, FIELD.PROJECTS.fid118),
        techAssets:  val(r, FIELD.PROJECTS.techAssets),
        rfpDate:     rfpRaw,
        rfpDisplay:  rfpDisplay,
        sendToProd:  (r[FIELD.PROJECTS.sendToProd] && r[FIELD.PROJECTS.sendToProd].value) || ''
      };
    }).filter(function(r) {
      // Client-side: (116 == 118 && 116 != 0) OR stage == 'Ready for Production'
      var n116 = parseFloat(r.fid116), n118 = parseFloat(r.fid118);
      return (n116 === n118 && n116 !== 0 && !isNaN(n116)) || r.stage === 'Ready for Production';
    }).sort(function(a, b) {
      // Low to high by rfpDate
      return (a.rfpDate || '').localeCompare(b.rfpDate || '');
    });
    ppRfpLoaded = true;
    ppRenderRfp();
  } catch(err) {
    var el2 = document.getElementById('ppRfpContent');
    if (el2) { el2.className = 'pp-loading'; el2.innerHTML = 'Error loading data.'; }
    console.error('[RFP]', err);
  }
}

function ppRenderRfp() {
  var el = document.getElementById('ppRfpContent');
  if (!el) return;

  if (ppRfpData.length === 0) {
    el.className = 'pp-loading';
    el.innerHTML = 'No projects match Ready for Production criteria.';
    return;
  }

  var podOpts = '<option value="">— POD —</option>' +
    ppRfpPods.map(function(p) { return '<option value="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</option>'; }).join('');

  var tbody = ppRfpData.map(function(r) {
    var stageColor = STAGE_COLORS[r.stage] || '#868e96';
    var stageBadge = '<span class="pp-badge" style="background:' + stageColor + '22;color:' + stageColor + ';white-space:nowrap">' + escapeHtml(r.stage || '') + '</span>';
    var folderCell = r.folder
      ? '<a class="pp-cell-link" href="' + escapeHtml(r.folder) + '" target="_blank" rel="noopener">Open Folder</a>'
      : '<span style="color:var(--text-dim)">—</span>';
    var podSel = '<select class="pp-modal-select" style="min-width:110px" onchange="ppSaveField(' + r.id + ',' + FIELD.PROJECTS.pod + ',this.value,\'pod\')">' +
      podOpts.replace('value="' + escapeHtml(r.pod || '') + '"', 'value="' + escapeHtml(r.pod || '') + '" selected') + '</select>';
    return '<tr>' +
      '<td class="pp-scope-td">' + escapeHtml(r.name || '') + '</td>' +
      '<td class="pp-scope-td">' + stageBadge + '</td>' +
      '<td class="pp-scope-td">' + folderCell + '</td>' +
      '<td class="pp-scope-td">' + podSel + '</td>' +
      '<td class="pp-scope-td" style="text-align:center">' + escapeHtml(String(r.techAssets || '')) + '</td>' +
      '<td class="pp-scope-td">' + escapeHtml(r.rfpDisplay || '—') + '</td>' +
      '<td class="pp-scope-td">' + (r.sendToProd || '') + '</td>' +
    '</tr>';
  }).join('');

  el.className = '';
  el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden';
  el.innerHTML =
    '<div style="padding:8px 16px;border-bottom:1px solid var(--border);flex-shrink:0">' +
      '<span class="pp-scope-count">' + ppRfpData.length + ' project' + (ppRfpData.length !== 1 ? 's' : '') + '</span>' +
    '</div>' +
    '<div class="pp-scope-table-wrap">' +
      '<table class="pp-scope-table">' +
        '<thead><tr>' +
          '<th class="pp-scope-th">Project Name</th>' +
          '<th class="pp-scope-th">Stage</th>' +
          '<th class="pp-scope-th">Project Folder</th>' +
          '<th class="pp-scope-th">POD</th>' +
          '<th class="pp-scope-th" style="text-align:center">Tech Assets</th>' +
          '<th class="pp-scope-th">Ready for Production</th>' +
          '<th class="pp-scope-th">Send to Production</th>' +
        '</tr></thead>' +
        '<tbody>' + tbody + '</tbody>' +
      '</table>' +
    '</div>';
}

// ─── IN PRODUCTION REPORT ──────────────────────────────────────
async function ppLoadInProd() {
  var el = document.getElementById('ppInProdLayout');
  if (el) { el.className = 'pp-loading'; el.innerHTML = 'Loading\u2026'; }
  try {
    var fids = [
      FIELD.PROJECTS.id, FIELD.PROJECTS.name, FIELD.PROJECTS.fid54, FIELD.PROJECTS.type,
      FIELD.PROJECTS.folder, FIELD.PROJECTS.teamChannel, FIELD.PROJECTS.reviewStudio,
      FIELD.PROJECTS.earliestBooking, FIELD.PROJECTS.latestBooking, FIELD.PROJECTS.pod, FIELD.PROJECTS.age
    ];
    var results = await Promise.all([
      qbQueryAll(TABLES.projects, fids, '{' + FIELD.PROJECTS.stage + '.EX.\'In Production\'}'),
      qbQueryAll(TABLES.projects, [FIELD.PROJECTS.id], '{' + FIELD.PROJECTS.stage + '.EX.\'Pre-Production\'}')
    ]);
    ppInProdPreProdCount = results[1].length;
    ppInProdData = results[0].map(function(r) {
      return {
        id:              val(r, FIELD.PROJECTS.id),
        name:            val(r, FIELD.PROJECTS.name),
        clientName:      val(r, FIELD.PROJECTS.fid54),
        type:            val(r, FIELD.PROJECTS.type),
        folder:          val(r, FIELD.PROJECTS.folder),
        teamChannel:     val(r, FIELD.PROJECTS.teamChannel),
        reviewStudio:    val(r, FIELD.PROJECTS.reviewStudio),
        earliestBooking: val(r, FIELD.PROJECTS.earliestBooking),
        latestBooking:   val(r, FIELD.PROJECTS.latestBooking),
        pod:             val(r, FIELD.PROJECTS.pod),
        age:             parseFloat(val(r, FIELD.PROJECTS.age)) || 0
      };
    });
    ppInProdLoaded = true;
    ppRenderInProd();
  } catch(err) {
    var el2 = document.getElementById('ppInProdLayout');
    if (el2) { el2.className = 'pp-loading'; el2.innerHTML = 'Error loading data.'; }
    console.error('[InProd]', err);
  }
}

function ppInProdPieChart(slices) {
  var total = slices.reduce(function(s, p) { return s + p.count; }, 0);
  if (total === 0) return '<div style="color:var(--text-dim);font-size:12px;text-align:center">No data</div>';
  var cx = 70, cy = 70, r = 56, ir = 34;
  var angle = -Math.PI / 2;
  var paths = slices.map(function(p) {
    var sweep = (p.count / total) * Math.PI * 2;
    var end = angle + sweep;
    var la = sweep > Math.PI ? 1 : 0;
    var x1 = cx + r  * Math.cos(angle), y1 = cy + r  * Math.sin(angle);
    var x2 = cx + r  * Math.cos(end),   y2 = cy + r  * Math.sin(end);
    var ix1 = cx + ir * Math.cos(angle), iy1 = cy + ir * Math.sin(angle);
    var ix2 = cx + ir * Math.cos(end),   iy2 = cy + ir * Math.sin(end);
    var d = 'M ' + ix1.toFixed(1) + ' ' + iy1.toFixed(1) +
            ' L ' + x1.toFixed(1)  + ' ' + y1.toFixed(1)  +
            ' A ' + r + ' ' + r + ' 0 ' + la + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
            ' L ' + ix2.toFixed(1) + ' ' + iy2.toFixed(1) +
            ' A ' + ir + ' ' + ir + ' 0 ' + la + ' 0 ' + ix1.toFixed(1) + ' ' + iy1.toFixed(1) + ' Z';
    angle = end;
    return '<path d="' + d + '" fill="' + p.color + '" />';
  }).join('');
  return '<svg width="140" height="140" viewBox="0 0 140 140" style="display:block;margin:0 auto">' + paths + '</svg>';
}

function ppInProdFmtDate(v) {
  if (!v) return '\u2014';
  var p = String(v).split('-');
  return p.length === 3 ? p[1] + '/' + p[2] + '/' + p[0].slice(2) : v;
}

function ppRenderInProd() {
  var el = document.getElementById('ppInProdLayout');
  if (!el) return;

  // Group by pod, sort pod names alphabetically
  var groups = {};
  ppInProdData.forEach(function(r) {
    var pod = r.pod || 'Unassigned';
    if (!groups[pod]) groups[pod] = [];
    groups[pod].push(r);
  });
  var podNames = Object.keys(groups).sort();

  // Pie chart slices
  var slices = podNames.map(function(pod, i) {
    return { name: pod, count: groups[pod].length, color: POD_COLORS[pod] || PROJECT_COLORS[i % PROJECT_COLORS.length] };
  });

  var thead = '<tr>' +
    '<th class="pp-scope-th">Project Name</th>' +
    '<th class="pp-scope-th">Client</th>' +
    '<th class="pp-scope-th">Type</th>' +
    '<th class="pp-scope-th">Folder</th>' +
    '<th class="pp-scope-th">Team Channel</th>' +
    '<th class="pp-scope-th">Review Studio</th>' +
    '<th class="pp-scope-th">Earliest Booking</th>' +
    '<th class="pp-scope-th">Latest Booking</th>' +
  '</tr>';

  var groupsHtml = podNames.map(function(pod) {
    var rows = groups[pod];
    var tbody = rows.map(function(r) {
      var typeColor = TYPE_COLORS[r.type] || '#868e96';
      var typeBadge = r.type
        ? '<span class="pp-type-badge" style="background:' + typeColor + '22;color:' + typeColor + ';border:1px solid ' + typeColor + '44">' + escapeHtml(r.type) + '</span>'
        : '\u2014';
      function linkCell(url, label) {
        return url ? '<a class="pp-cell-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + label + '</a>' : '\u2014';
      }
      return '<tr>' +
        '<td class="pp-scope-td">' + escapeHtml(r.name || '') + '</td>' +
        '<td class="pp-scope-td">' + escapeHtml(r.clientName || '\u2014') + '</td>' +
        '<td class="pp-scope-td">' + typeBadge + '</td>' +
        '<td class="pp-scope-td">' + linkCell(r.folder, 'Folder') + '</td>' +
        '<td class="pp-scope-td">' + linkCell(r.teamChannel, 'Channel') + '</td>' +
        '<td class="pp-scope-td">' + linkCell(r.reviewStudio, 'Project') + '</td>' +
        '<td class="pp-scope-td">' + ppInProdFmtDate(r.earliestBooking) + '</td>' +
        '<td class="pp-scope-td">' + ppInProdFmtDate(r.latestBooking) + '</td>' +
      '</tr>';
    }).join('');
    return '<div class="pp-tar-group">' +
      '<div class="pp-tar-group-header" onclick="ppInProdToggleGroup(this)">' +
        '<span class="pp-tar-group-chevron">&#9654;</span>' +
        '<span class="pp-tar-group-label" style="font-weight:700">' + escapeHtml(pod) + '</span>' +
        '<span class="pp-tar-group-count">(' + rows.length + ')</span>' +
      '</div>' +
      '<div class="pp-tar-group-body" style="display:none">' +
        '<table class="pp-scope-table"><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>' +
      '</div>' +
    '</div>';
  }).join('');

  var legendHtml = slices.map(function(p) {
    return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text)">' +
      '<span style="width:10px;height:10px;border-radius:2px;background:' + p.color + ';flex-shrink:0"></span>' +
      escapeHtml(p.name) + ' (' + p.count + ')' +
    '</div>';
  }).join('');

  el.className = '';
  el.style.cssText = 'display:flex;flex:1;overflow:hidden;min-height:0';
  el.innerHTML =
    '<div class="pp-inprod-main">' +
      '<div class="pp-tar-toolbar">' +
        '<span class="pp-scope-count">' + ppInProdData.length + ' project' + (ppInProdData.length !== 1 ? 's' : '') + '</span>' +
        '<button class="btn btn-sm" style="margin-left:auto" onclick="ppInProdExpandAll()">Expand All</button>' +
        '<button class="btn btn-sm" onclick="ppInProdCollapseAll()">Collapse All</button>' +
      '</div>' +
      '<div class="pp-tar-groups">' +
        (groupsHtml || '<div class="pp-loading" style="min-height:80px">No In Production projects found.</div>') +
      '</div>' +
    '</div>' +
    '<div class="pp-inprod-sidebar">' +
      '<div class="pp-kpi-card">' +
        '<span class="pp-kpi-label">Pre-Production</span>' +
        '<span class="pp-kpi-value">' + ppInProdPreProdCount + '</span>' +
        '<span class="pp-kpi-sub">projects</span>' +
      '</div>' +
      '<div class="pp-kpi-card">' +
        '<span class="pp-kpi-label">In Production</span>' +
        '<span class="pp-kpi-value">' + ppInProdData.length + '</span>' +
        '<span class="pp-kpi-sub">projects</span>' +
      '</div>' +
      '<div class="pp-kpi-card">' +
        '<span class="pp-kpi-label">Projects by Pod</span>' +
        '<div style="margin-top:10px">' + ppInProdPieChart(slices) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:5px;margin-top:10px">' + legendHtml + '</div>' +
      '</div>' +
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

window.ppAssetShowDialog = function(recordId, fid, key, label, type, _forTar) {
  ppAssetDialogState.context = _forTar ? 'tar' : 'modal';
  var row = (_forTar ? ppTarData : ppAssetsData).find(function(r) { return r.id == recordId; });
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
  ppAssetDialogClose();
  if (ppAssetDialogState.context === 'tar') {
    var tarRow = ppTarData.find(function(r) { return r.id == id; });
    if (tarRow) tarRow[key] = value;
    var rec = {}; rec[FIELD.ASSETS.id] = { value: parseInt(id, 10) }; rec[parseInt(fid, 10)] = { value: value };
    qbUpsert(TABLES.assets, [rec]).then(function() { showToast('Saved.', 'success'); }).catch(function() { showToast('Save failed.', 'error'); });
    ppRenderTar();
  } else {
    var modRow = ppAssetsData.find(function(r) { return r.id == id; });
    if (modRow) modRow[key] = value;
    if (!ppAssetsChanges[id]) ppAssetsChanges[id] = {};
    ppAssetsChanges[id][fid] = value;
    ppRenderAssets();
  }
};

function ppAssetTypeColor(type) {
  var palette = ['#a29bfe','#74b9ff','#fd79a8','#fdcb6e','#6c5ce7','#00b894','#e17055','#0984e3','#55efc4','#fab005'];
  var h = 0;
  for (var i = 0; i < type.length; i++) h = type.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

window.ppOpenContract = function(projId) {
  var proj = getProj(projId);
  if (!proj || !proj.opportunity) { showToast('No contract reference found.', 'error'); return; }
  var drawer  = document.getElementById('ppContractDrawer');
  var loading = document.getElementById('ppContractLoading');
  var frame   = document.getElementById('ppContractFrame');
  if (!drawer || !frame) return;

  // Reset + open drawer
  frame.style.display = 'none';
  frame.src = '';
  if (loading) loading.style.display = 'flex';
  drawer.classList.add('open');

  // QB iframe.html embed URL (same pattern as formula URL field buttons)
  var fileUrl = 'https://' + QB_REALM + '/db/btprgw56v?a=dbpage&pagename=iframe.html' +
    '&rid=' + proj.opportunity +
    '&tabledbid=' + TABLES.contracts +
    '&myurlroot=https://' + QB_REALM + '/' +
    '&fileattachmentfid=' + FIELD.CONTRACTS.pdf;
  frame.onload = function() {
    if (loading) loading.style.display = 'none';
    frame.style.display = 'block';
  };
  frame.src = fileUrl;
};

window.ppCloseContract = function() {
  var drawer = document.getElementById('ppContractDrawer');
  var frame  = document.getElementById('ppContractFrame');
  if (drawer) drawer.classList.remove('open');
  if (frame)  { frame.src = ''; frame.style.display = 'none'; }
};

// ─── MODAL ─────────────────────────────────────────────────────
function getOrCreateModal() {
  var el = document.getElementById('ppModalOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ppModalOverlay';
    el.className = 'pp-modal-overlay';
    el.innerHTML =
      '<div class="pp-modal-container" id="ppModalContainer">' +
        '<div class="pp-modal" id="ppModal">' +
          '<div class="pp-modal-header">' +
            '<div class="pp-modal-title-wrap">' +
              '<span class="pp-modal-title"></span>' +
              '<div class="pp-modal-header-badges"></div>' +
            '</div>' +
            '<button class="pp-modal-close" onclick="ppCloseModal()" title="Close">&#x2715;</button>' +
          '</div>' +
          '<div class="pp-modal-body"></div>' +
        '</div>' +
        '<div class="pp-contract-drawer" id="ppContractDrawer">' +
          '<div class="pp-contract-drawer-inner">' +
            '<div class="pp-contract-drawer-header">' +
              '<span class="pp-contract-drawer-title">Contract</span>' +
              '<button class="pp-modal-close" onclick="ppCloseContract()" title="Close">&#x2715;</button>' +
            '</div>' +
            '<div class="pp-contract-drawer-body">' +
              '<div id="ppContractLoading" class="pp-contract-loading">Loading contract\u2026</div>' +
              '<iframe id="ppContractFrame" class="pp-contract-frame" style="display:none"></iframe>' +
            '</div>' +
          '</div>' +
        '</div>' +
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
        '<button class="btn btn-sm" style="margin-top:4px;width:100%" onclick="ppOpenContract(' + id + ')">View Contract</button>' +
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

  // Reset contract drawer on each open
  ppCloseContract();

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

window.ppTarFilterChange = function(field, value) {
  ppTarFilter[field] = value;
  ppRenderTar();
};
window.ppTarToggleGroup = function(header) {
  header.classList.toggle('open');
  var body = header.nextElementSibling;
  if (body) body.style.display = header.classList.contains('open') ? 'block' : 'none';
};
window.ppTarExpandAll = function() {
  document.querySelectorAll('#ppTarContent .pp-tar-group-header').forEach(function(h) {
    h.classList.add('open');
    var b = h.nextElementSibling; if (b) b.style.display = 'block';
  });
};
window.ppTarCollapseAll = function() {
  document.querySelectorAll('#ppTarContent .pp-tar-group-header').forEach(function(h) {
    h.classList.remove('open');
    var b = h.nextElementSibling; if (b) b.style.display = 'none';
  });
};
window.ppTarCheck = function(recordId, fid, checked) {
  var row = ppTarData.find(function(r) { return r.id == recordId; });
  if (row) {
    if (fid === FIELD.ASSETS.received) row.received = checked;
    else if (fid === FIELD.ASSETS.hidden) row.hidden = checked;
  }
  var rec = {}; rec[FIELD.ASSETS.id] = { value: parseInt(recordId, 10) }; rec[parseInt(fid, 10)] = { value: checked };
  qbUpsert(TABLES.assets, [rec]).then(function() { showToast('Saved.', 'success'); }).catch(function() { showToast('Save failed.', 'error'); });
};
window.ppTarShowDialog = function(recordId, fid, key, label, type) {
  ppAssetShowDialog(recordId, fid, key, label, type, true);
};

window.ppInProdToggleGroup = function(header) {
  header.classList.toggle('open');
  var body = header.nextElementSibling;
  if (body) body.style.display = header.classList.contains('open') ? 'block' : 'none';
};
window.ppInProdExpandAll = function() {
  var el = document.getElementById('ppInProdLayout');
  if (!el) return;
  el.querySelectorAll('.pp-tar-group-header').forEach(function(h) {
    h.classList.add('open');
    var b = h.nextElementSibling; if (b) b.style.display = 'block';
  });
};
window.ppInProdCollapseAll = function() {
  var el = document.getElementById('ppInProdLayout');
  if (!el) return;
  el.querySelectorAll('.pp-tar-group-header').forEach(function(h) {
    h.classList.remove('open');
    var b = h.nextElementSibling; if (b) b.style.display = 'none';
  });
};

// ─── REGISTER ─────────────────────────────────────────────────
registerTab('preproduction', {
  icon: '', label: 'Projects',
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
