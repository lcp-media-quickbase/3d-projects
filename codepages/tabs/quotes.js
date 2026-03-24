// ═══════════════════════════════════════════════════════════════
// Quotes Tab — 3D Quote management with detail drawer
// ═══════════════════════════════════════════════════════════════
(function() {

var QUOTE_TABLE = 'bvthmr75f';
var LINE_ITEM_TABLE = 'bvthmuw7u';
var QUOTE_TOKEN = 'b9ytiq_f9q7_0_khn6t28ipikncmn55caczkq98b';

var qQuotes = [];
var qLineItems = {};
var qFilter = 'all';
var qSearch = '';
var qLoadedAt = 0;

var quotesCSS = [
  '.quotes-table { width:100%; border-collapse:collapse; font-size:13px; }',
  '.quotes-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:5; }',
  '.quotes-table td { padding:10px 14px; border-bottom:1px solid var(--border); color:var(--text-muted); vertical-align:middle; }',
  '.quotes-table tr { cursor:pointer; transition:background 0.1s; }',
  '.quotes-table tr:hover td { background:var(--accent-dim); }',
  '.q-name { color:var(--text); font-weight:500; }',
  '.q-total { font-family:"JetBrains Mono",monospace; font-size:12px; font-weight:600; }',
  '.q-status { display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; letter-spacing:0.3px; }',
  '.q-status-not-started { background:var(--surface3); color:var(--text-dim); }',
  '.q-status-in-progress { background:var(--accent-dim); color:var(--accent); }',
  '.q-status-ready { background:rgba(46,213,115,0.15); color:var(--success); }',
  '.q-status-in-review { background:var(--warning-dim); color:var(--warning); }',
  '.q-status-approved { background:rgba(46,213,115,0.15); color:var(--success); }',
  '.q-status-rejected { background:var(--danger-dim); color:var(--danger); }',
  '.q-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.q-kpi { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:12px 16px; }',
  '.q-kpi-label { font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; }',
  '.q-kpi-value { font-size:22px; font-weight:700; margin-top:4px; }',
  '.q-kpi-sub { font-size:11px; color:var(--text-dim); margin-top:2px; }',
  '.q-filters { display:flex; gap:6px; }',
  '.q-drawer-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px 16px; margin-bottom:16px; font-size:12px; }',
  '.q-drawer-meta dt { color:var(--text-dim); }',
  '.q-drawer-meta dd { color:var(--text); margin:0 0 6px 0; font-weight:500; }',
  '.q-li-table { width:100%; border-collapse:collapse; font-size:12px; }',
  '.q-li-table th { text-align:left; padding:8px 10px; font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid var(--border); }',
  '.q-li-table td { padding:8px 10px; border-bottom:1px solid var(--border); color:var(--text-muted); }',
  '.q-li-product { color:var(--text); font-weight:500; }',
  '.q-li-total { font-family:"JetBrains Mono",monospace; font-weight:600; color:var(--text); }',
  '.q-drawer-total { display:flex; justify-content:flex-end; padding:12px 10px; font-size:14px; font-weight:700; color:var(--text); border-top:2px solid var(--border); }'
].join('\n');

function statusClass(s) {
  if (!s) return 'q-status-not-started';
  var l = s.toLowerCase();
  if (l === 'not started') return 'q-status-not-started';
  if (l === 'in progress') return 'q-status-in-progress';
  if (l === 'ready to send') return 'q-status-ready';
  if (l === 'in review') return 'q-status-in-review';
  if (l === 'approved') return 'q-status-approved';
  if (l === 'rejected') return 'q-status-rejected';
  return 'q-status-not-started';
}

function fmtCurrency(v) {
  if (!v && v !== 0) return '—';
  return '$' + Number(v).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

function fmtDate(v) {
  if (!v) return '—';
  var d = new Date(v);
  return (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function buildHTML() {
  return '<div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0">' +
    '<div class="sched-topbar-left">' +
      '<div class="q-filters">' +
        '<button class="btn btn-sm btn-active" id="qFilterAll" onclick="qSetFilter(\'all\')">All</button>' +
        '<button class="btn btn-sm" id="qFilterReady" onclick="qSetFilter(\'Ready to Send\')">Ready to Send</button>' +
        '<button class="btn btn-sm" id="qFilterReview" onclick="qSetFilter(\'In Review\')">In Review</button>' +
        '<button class="btn btn-sm" id="qFilterApproved" onclick="qSetFilter(\'Approved\')">Approved</button>' +
      '</div>' +
    '</div>' +
    '<div class="sched-topbar-right" id="qDateFilter"></div>' +
  '</div>' +
  '<div id="qKpis" class="q-kpi-row"></div>' +
  '<div style="flex:1;overflow:auto">' +
    '<table class="quotes-table"><thead><tr>' +
      '<th>Quote</th><th>Company</th><th>Property</th><th>Sales Rep</th><th>Status</th><th>Date</th><th style="text-align:right">Total</th>' +
    '</tr></thead><tbody id="qBody"></tbody></table>' +
  '</div>';
}

async function qbFetch(table, select, where, top) {
  var body = {from: table, select: select, options: {top: top || 500}};
  if (where) body.where = where;
  body.sortBy = [{fieldId: 3, order: 'DESC'}];
  var resp = await fetch('https://api.quickbase.com/v1/records/query', {
    method: 'POST',
    headers: {
      'QB-Realm-Hostname': 'lcpmedia.quickbase.com',
      'Authorization': 'QB-USER-TOKEN ' + QUOTE_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error('QB API error ' + resp.status);
  return (await resp.json()).data || [];
}

async function loadQuotes() {
  var rows = await qbFetch(QUOTE_TABLE, [3,6,7,8,10,12,14,25,35,39]);
  qQuotes = rows.map(function(r) {
    return {
      id: r[3] ? r[3].value : 0,
      name: r[25] ? r[25].value : '',
      date: r[6] ? r[6].value : '',
      expiry: r[7] ? r[7].value : '',
      rep: r[8] ? r[8].value : '',
      status: r[10] ? r[10].value : '',
      company: r[12] ? r[12].value : '',
      property: r[14] ? r[14].value : '',
      version: r[35] ? r[35].value : '',
      total: r[39] ? r[39].value : 0
    };
  });
  qLoadedAt = Date.now();
}

async function loadLineItems(quoteId) {
  quoteId = parseInt(quoteId);
  console.log('[Quotes] Loading line items for quote', quoteId);
  if (qLineItems[quoteId]) { console.log('[Quotes] Returning cached', qLineItems[quoteId].length, 'items'); return qLineItems[quoteId]; }
  var where = '{6.EX.' + quoteId + '}';
  console.log('[Quotes] Query:', where);
  var rows = await qbFetch(LINE_ITEM_TABLE, [3,6,10,11,12,13,14,15], where, 100);
  var items = rows.map(function(r) {
    return {
      id: r[3] ? r[3].value : 0,
      product: r[10] ? r[10].value : '',
      name: r[11] ? r[11].value : '',
      notes: r[12] ? r[12].value : '',
      qty: r[13] ? r[13].value : 0,
      price: r[14] ? r[14].value : 0,
      total: r[15] ? r[15].value : 0
    };
  });
  console.log('[Quotes] Loaded', items.length, 'items for quote', quoteId);
  qLineItems[quoteId] = items;
  return items;
}

function getFiltered() {
  var dr = getDateFilterRange('q');
  return qQuotes.filter(function(q) {
    if (qFilter !== 'all' && q.status !== qFilter) return false;
    if (dr.start && q.date && q.date < dr.start) return false;
    if (dr.end && q.date && q.date > dr.end) return false;
    if (qSearch) {
      var s = qSearch.toLowerCase();
      return (q.name && q.name.toLowerCase().indexOf(s) !== -1) ||
             (q.company && q.company.toLowerCase().indexOf(s) !== -1) ||
             (q.property && q.property.toLowerCase().indexOf(s) !== -1) ||
             (q.rep && q.rep.toLowerCase().indexOf(s) !== -1);
    }
    return true;
  });
}

function renderKpis() {
  var all = qQuotes;
  var total = all.reduce(function(s,q){return s+Number(q.total||0);}, 0);
  var ready = all.filter(function(q){return q.status==='Ready to Send';}).length;
  var review = all.filter(function(q){return q.status==='In Review';}).length;
  var approved = all.filter(function(q){return q.status==='Approved';}).length;

  var el = document.getElementById('qKpis');
  if (!el) return;
  el.innerHTML =
    '<div class="q-kpi"><div class="q-kpi-label">Total Quotes</div><div class="q-kpi-value">' + all.length + '</div></div>' +
    '<div class="q-kpi"><div class="q-kpi-label">Pipeline Value</div><div class="q-kpi-value" style="color:var(--accent)">' + fmtCurrency(total) + '</div></div>' +
    '<div class="q-kpi"><div class="q-kpi-label">Ready to Send</div><div class="q-kpi-value" style="color:var(--success)">' + ready + '</div></div>' +
    '<div class="q-kpi"><div class="q-kpi-label">In Review</div><div class="q-kpi-value" style="color:var(--warning)">' + review + '</div></div>' +
    '<div class="q-kpi"><div class="q-kpi-label">Approved</div><div class="q-kpi-value" style="color:var(--success)">' + approved + '</div></div>';
}

function renderTable() {
  var filtered = getFiltered();
  var el = document.getElementById('qBody');
  if (!el) return;

  if (!filtered.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:40px">No quotes found</td></tr>';
    return;
  }

  el.innerHTML = filtered.map(function(q) {
    return '<tr onclick="qViewQuote(' + q.id + ')">' +
      '<td class="q-name">' + escapeHtml(q.name || 'Quote #' + q.id) + '</td>' +
      '<td>' + escapeHtml(q.company) + '</td>' +
      '<td>' + escapeHtml(q.property) + '</td>' +
      '<td>' + escapeHtml(q.rep) + '</td>' +
      '<td><span class="q-status ' + statusClass(q.status) + '">' + escapeHtml(q.status || 'Not Started') + '</span></td>' +
      '<td>' + fmtDate(q.date) + '</td>' +
      '<td class="q-total" style="text-align:right">' + fmtCurrency(q.total) + '</td>' +
    '</tr>';
  }).join('');
}

// ─── QUOTE DETAIL DRAWER ─────────────────────────────────────
async function viewQuote(quoteId) {
  var q = qQuotes.find(function(x){return x.id === quoteId;});
  if (!q) return;

  // Open drawer
  var overlay = document.getElementById('qDrawerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'qDrawerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:900;opacity:0;transition:opacity 0.2s';
    overlay.onclick = function(e){if(e.target===overlay) closeQuoteDrawer();};
    document.body.appendChild(overlay);
  }
  overlay.style.display = '';
  requestAnimationFrame(function(){overlay.style.opacity='1';});

  var drawer = document.getElementById('qDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'qDrawer';
    drawer.style.cssText = 'position:fixed;top:0;right:-520px;width:520px;height:100vh;background:var(--surface);border-left:1px solid var(--border);z-index:901;display:flex;flex-direction:column;transition:right 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.2)';
    document.body.appendChild(drawer);
  }

  // Show loading
  drawer.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">' +
      '<div style="font-size:15px;font-weight:600;color:var(--text)">' + escapeHtml(q.name || 'Quote #' + q.id) + '</div>' +
      '<button onclick="closeQuoteDrawer()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:18px">&times;</button>' +
    '</div>' +
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-dim)">Loading line items...</div>';

  requestAnimationFrame(function(){drawer.style.right='0';});

  // Load line items
  var items = await loadLineItems(quoteId);
  var liTotal = items.reduce(function(s,i){return s+Number(i.total||0);}, 0);

  drawer.innerHTML =
    // Header
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">' +
      '<div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text)">' + escapeHtml(q.company) + ' — ' + escapeHtml(q.property) + '</div>' +
        '<div style="font-size:12px;color:var(--text-dim);margin-top:2px">' + escapeHtml(q.name || 'Quote #' + q.id) + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span class="q-status ' + statusClass(q.status) + '" style="font-size:11px">' + escapeHtml(q.status || 'Not Started') + '</span>' +
        '<button onclick="closeQuoteDrawer()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:18px">&times;</button>' +
      '</div>' +
    '</div>' +

    // Scrollable body
    '<div style="flex:1;overflow-y:auto;padding:16px 20px">' +
      // Meta
      '<dl class="q-drawer-meta">' +
        '<dt>Sales Rep</dt><dd>' + escapeHtml(q.rep) + '</dd>' +
        '<dt>Quote Date</dt><dd>' + fmtDate(q.date) + '</dd>' +
        '<dt>Expiration</dt><dd>' + fmtDate(q.expiry) + '</dd>' +
        '<dt>Version</dt><dd>' + (q.version || '1') + '</dd>' +
      '</dl>' +

      // Line items
      '<div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Line Items (' + items.length + ')</div>' +
      '<table class="q-li-table"><thead><tr>' +
        '<th>Product</th><th>Name</th><th>Notes</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th>' +
      '</tr></thead><tbody>' +
      items.map(function(i) {
        var notes = (i.notes || '').replace(/<[^>]+>/g, '').trim();
        return '<tr>' +
          '<td class="q-li-product">' + escapeHtml(i.product) + '</td>' +
          '<td>' + escapeHtml(i.name) + '</td>' +
          '<td style="font-size:11px;color:var(--text-dim)">' + escapeHtml(notes).substring(0,40) + '</td>' +
          '<td style="text-align:center">' + (i.qty || 1) + '</td>' +
          '<td style="text-align:right;font-family:JetBrains Mono,monospace;font-size:11px">' + fmtCurrency(i.price) + '</td>' +
          '<td class="q-li-total" style="text-align:right">' + fmtCurrency(i.total) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>' +
      '<div class="q-drawer-total">Total: ' + fmtCurrency(liTotal) + '</div>' +
    '</div>';
}

function closeQuoteDrawer() {
  var drawer = document.getElementById('qDrawer');
  if (drawer) drawer.style.right = '-520px';
  var overlay = document.getElementById('qDrawerOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(function(){overlay.style.display='none';}, 200);
  }
}

function setFilter(f) {
  qFilter = f;
  document.querySelectorAll('.q-filters .btn').forEach(function(b){b.classList.remove('btn-active');});
  var id = f === 'all' ? 'qFilterAll' : f === 'Ready to Send' ? 'qFilterReady' : f === 'In Review' ? 'qFilterReview' : 'qFilterApproved';
  var btn = document.getElementById(id);
  if (btn) btn.classList.add('btn-active');
  renderTable();
}

// Expose to window
window.qViewQuote = viewQuote;
window.qSetFilter = setFilter;
window.closeQuoteDrawer = closeQuoteDrawer;

registerTab('quotes', {
  icon: '💰', label: 'Quotes',
  roles: STANDARD_ROLES,
  onInit: function() {
    var style = document.createElement('style');
    style.textContent = quotesCSS;
    document.head.appendChild(style);
    document.getElementById('tab-quotes').innerHTML = buildHTML();
  },
  onActivate: async function() {
    var dfEl = document.getElementById('qDateFilter');
    if (dfEl && !dfEl.innerHTML) {
      dfEl.innerHTML = buildDateFilter('q', function() { renderKpis(); renderTable(); });
      ['qDateFrom','qDateTo'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function() { renderKpis(); renderTable(); });
      });
    }
    window.onAppSearch = function(v) { qSearch = v.trim(); renderTable(); };
    if (Date.now() - qLoadedAt < 300000) {
      renderKpis();
      renderTable();
    } else {
      document.getElementById('qBody').innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:40px">Loading quotes...</td></tr>';
      await loadQuotes();
      renderKpis();
      renderTable();
    }
  }
});

})();
