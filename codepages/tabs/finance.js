// ═══════════════════════════════════════════════════════════════
// Finance Tab — Artist costs + Project budgets
// ═══════════════════════════════════════════════════════════════
(function() {

var fPeople = [];
var fBookings = [];
var fProjects = [];
var fScopeByDeal = {};
var fView = 'artists';
var fSearch = '';

var EXCLUDED_PODS = ['Polish office', 'TourBuilder'];

var finCSS = [
  '.fin-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.fin-tabs { display:flex; gap:4px; }',
  '.fin-tab { padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:var(--surface); color:var(--text-muted); }',
  '.fin-tab.active { background:var(--accent-dim); color:var(--accent); border-color:var(--accent-border); }',
  '.fin-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; padding:12px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.fin-kpi { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; }',
  '.fin-kpi-label { font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; }',
  '.fin-kpi-value { font-size:20px; font-weight:700; margin-top:2px; }',
  '.fin-grid { flex:1; overflow:auto; }',
  '.fin-table { width:100%; border-collapse:collapse; font-size:12px; }',
  '.fin-table th { padding:8px 10px; font-size:9px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.3px; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:5; text-align:left; white-space:nowrap; }',
  '.fin-table th.num { text-align:right; }',
  '.fin-table td { padding:7px 10px; border-bottom:1px solid var(--border); }',
  '.fin-table tr:hover td { background:var(--accent-dim); }',
  '.fin-name { font-weight:500; color:var(--text); white-space:nowrap; }',
  '.fin-num { text-align:right; font-family:"JetBrains Mono",monospace; font-size:11px; white-space:nowrap; }',
  '.fin-bold { font-weight:700; }',
  '.fin-dim { color:var(--text-dim); }',
  '.fin-pos { color:var(--success); font-weight:600; }',
  '.fin-neg { color:var(--danger); font-weight:600; }',
  '.fin-total td { background:var(--surface); font-weight:700; border-top:2px solid var(--border); }',
  '.fin-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }'
].join('\n');

function fmt$(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  var neg = v < 0;
  return (neg ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function fmtPct(v) { return (v === null || v === undefined || isNaN(v)) ? '—' : v.toFixed(2) + '%'; }
function fmtH(v) { return v ? Math.round(v).toLocaleString() + 'h' : '—'; }

function buildHTML() {
  return '<div class="fin-topbar">' +
    '<div class="fin-tabs">' +
      '<div class="fin-tab active" id="finTabArtists" onclick="finSetView(\'artists\')">Artist Costs</div>' +
      '<div class="fin-tab" id="finTabBudgets" onclick="finSetView(\'budgets\')">Project Budgets</div>' +
    '</div><div></div></div>' +
  '<div id="finKpis" class="fin-kpi-row"></div>' +
  '<div class="fin-grid"><table class="fin-table"><thead id="finThead"></thead><tbody id="finTbody"></tbody></table></div>';
}

async function loadFinData() {
  fPeople = await getCachedPeople();
  fProjects = await getCachedProjects(false); // include complete projects

  // Get date filter range
  var dateRange = getDateFilterRange('fin');
  var bookingWhere = null;
  if (dateRange.start && dateRange.end) {
    bookingWhere = '{' + FIELD.ASSIGN.end + '.OAF.' + dateRange.start + '}AND{' + FIELD.ASSIGN.start + '.BF.' + dateRange.end + '}';
  }

  // Load bookings within date range
  var records = await qbQuery(TABLES.assignments,
    [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.personName, FIELD.ASSIGN.personPod,
     FIELD.ASSIGN.projectName, FIELD.ASSIGN.hours],
    bookingWhere, [{fieldId: FIELD.ASSIGN.personName, order: 'ASC'}], 10000);

  fBookings = (records.records || []).map(function(r) {
    return {
      personKey: String(fv(r, FIELD.ASSIGN.person)),
      personName: fv(r, FIELD.ASSIGN.personName),
      project: fv(r, FIELD.ASSIGN.projectName),
      hours: parseFloat(fv(r, FIELD.ASSIGN.hours)) || 8
    };
  });

  // Load scope data for deal values (via temp tokens — same-app access)
  fScopeByDeal = {};
  try {
    var scopeRows = await qbQueryAll(TABLES.scope,
      [FIELD.SCOPE.id, FIELD.SCOPE.totalValue, FIELD.SCOPE.quantity,
       FIELD.SCOPE.stillsCount, FIELD.SCOPE.panosCount, FIELD.SCOPE.projectRef],
      null); // all scope records
    scopeRows.forEach(function(r) {
      var dealId = String(fv(r, FIELD.SCOPE.projectRef));
      if (!fScopeByDeal[dealId]) fScopeByDeal[dealId] = {totalValue: 0, assets: 0};
      fScopeByDeal[dealId].totalValue += parseFloat(fv(r, FIELD.SCOPE.totalValue)) || 0;
      fScopeByDeal[dealId].assets += 1;
    });
  } catch(e) { console.warn('[Finance] Could not load scope:', e); }
}

// ─── ARTIST COSTS VIEW ─────────────────────────────────────
function renderArtists() {
  var thead = document.getElementById('finThead');
  var tbody = document.getElementById('finTbody');
  if (!thead || !tbody) return;

  thead.innerHTML = '<tr><th>Name</th><th>Pod</th><th class="num">Hourly Rate</th><th class="num">Bookings</th><th class="num">Booking Cost</th></tr>';

  var byPerson = {};
  fBookings.forEach(function(b) {
    if (!byPerson[b.personKey]) byPerson[b.personKey] = {hours: 0};
    byPerson[b.personKey].hours += b.hours;
  });

  var rows = fPeople
    .filter(function(p) {
      if (EXCLUDED_PODS.indexOf(p.pod) !== -1) return false;
      if (fSearch) {
        var s = fSearch.toLowerCase();
        return (p.name && p.name.toLowerCase().indexOf(s) !== -1) || (p.pod && p.pod.toLowerCase().indexOf(s) !== -1);
      }
      return true;
    })
    .map(function(p) {
      var data = byPerson[String(p.tdId)] || {hours: 0};
      return { name: p.name, pod: p.pod, rate: p.hourlyRate, hours: data.hours, cost: data.hours * (p.hourlyRate || 0) };
    })
    .sort(function(a, b) { return b.hours - a.hours; });

  var totalH = 0, totalC = 0;
  var html = rows.map(function(r) {
    totalH += r.hours; totalC += r.cost;
    return '<tr><td class="fin-name">' + escapeHtml(r.name) + '</td>' +
      '<td class="fin-dim">' + escapeHtml(r.pod) + '</td>' +
      '<td class="fin-num">' + (r.rate ? fmt$(r.rate) : '<span class="fin-dim">—</span>') + '</td>' +
      '<td class="fin-num">' + fmtH(r.hours) + '</td>' +
      '<td class="fin-num fin-bold">' + fmt$(r.cost) + '</td></tr>';
  }).join('');
  html += '<tr class="fin-total"><td>Total</td><td></td><td></td><td class="fin-num">' + fmtH(totalH) + '</td><td class="fin-num">' + fmt$(totalC) + '</td></tr>';
  tbody.innerHTML = html;

  var kpi = document.getElementById('finKpis');
  if (kpi) {
    var rp = rows.filter(function(r){return r.rate;});
    var avgR = rp.length ? rp.reduce(function(s,r){return s+r.rate;},0)/rp.length : 0;
    kpi.innerHTML =
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Hours</div><div class="fin-kpi-value" style="color:var(--accent)">' + Math.round(totalH).toLocaleString() + 'h</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Cost</div><div class="fin-kpi-value" style="color:var(--accent)">' + fmt$(totalC) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Avg Hourly Rate</div><div class="fin-kpi-value">' + fmt$(avgR) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Team Members</div><div class="fin-kpi-value">' + rows.length + '</div></div>';
  }
}

// ─── PROJECT BUDGETS VIEW ───────────────────────────────────
function renderBudgets() {
  var thead = document.getElementById('finThead');
  var tbody = document.getElementById('finTbody');
  if (!thead || !tbody) return;

  thead.innerHTML = '<tr>' +
    '<th>Project</th><th class="num">Total Deal Cost</th><th class="num">Project Budget 30%</th>' +
    '<th class="num">Bookings</th><th class="num">Booking Cost</th>' +
    '<th class="num">Total Margin</th><th class="num">Profit Margin</th>' +
    '<th class="num">Profit</th><th class="num">Assets</th><th class="num">Asset Cost</th>' +
  '</tr>';

  var rateMap = {};
  fPeople.forEach(function(p) { rateMap[String(p.tdId)] = p.hourlyRate || 0; });

  // Aggregate bookings by project name
  var byProject = {};
  fBookings.forEach(function(b) {
    var proj = b.project || '(No Project)';
    if (!byProject[proj]) byProject[proj] = {hours: 0, cost: 0, artists: new Set()};
    byProject[proj].hours += b.hours;
    byProject[proj].cost += b.hours * (rateMap[b.personKey] || 0);
    byProject[proj].artists.add(b.personKey);
  });

  // Build project rows — match to fProjects for deal/scope data
  var projRows = [];
  for (var projName in byProject) {
    var bp = byProject[projName];
    var matched = fProjects.find(function(p) { return p.name === projName; });

    var dealCost = 0;
    var assets = 0;
    if (matched && matched.deal) {
      var scope = fScopeByDeal[String(matched.deal)];
      if (scope) {
        dealCost = scope.totalValue;
        assets = scope.assets;
      }
      // Also use visual assets from project if scope didn't have count
      if (!assets && matched.visualAssets) assets = matched.visualAssets;
    }

    var budget30 = dealCost * 0.30;
    var totalMargin = dealCost > 0 ? (bp.cost / dealCost * 100) : null;
    var profitMargin = budget30 > 0 ? ((budget30 - bp.cost) / budget30 * -100) : null;
    var profit = budget30 > 0 ? (budget30 - bp.cost) : null;
    var assetCost = assets > 0 ? (bp.cost / assets) : null;

    // Color dot based on margin
    var dotColor = '#7f8c8d';
    if (profitMargin !== null) {
      if (profitMargin > -20) dotColor = '#27ae60';
      else if (profitMargin > -50) dotColor = '#f39c12';
      else if (profitMargin > -80) dotColor = '#e67e22';
      else dotColor = '#e74c3c';
    }

    projRows.push({
      name: projName, dealCost: dealCost, budget30: budget30,
      hours: bp.hours, cost: bp.cost, totalMargin: totalMargin,
      profitMargin: profitMargin, profit: profit,
      assets: assets, assetCost: assetCost, dotColor: dotColor
    });
  }

  if (fSearch) {
    var s = fSearch.toLowerCase();
    projRows = projRows.filter(function(p) { return p.name.toLowerCase().indexOf(s) !== -1; });
  }

  projRows.sort(function(a, b) {
    // Sort: projects with deals first (by profit margin asc = worst first), then no-deal by cost desc
    if (a.dealCost && !b.dealCost) return -1;
    if (!a.dealCost && b.dealCost) return 1;
    if (a.dealCost && b.dealCost) return (a.profitMargin || 0) - (b.profitMargin || 0);
    return b.cost - a.cost;
  });

  var totalDeal = 0, totalBudget = 0, totalH = 0, totalC = 0, totalProfit = 0;

  var html = projRows.map(function(p) {
    totalDeal += p.dealCost; totalBudget += p.budget30;
    totalH += p.hours; totalC += p.cost;
    if (p.profit !== null) totalProfit += p.profit;

    var pmCls = p.profitMargin !== null ? (p.profitMargin <= 0 ? 'fin-pos' : 'fin-neg') : 'fin-dim';
    var profitCls = p.profit !== null ? (p.profit >= 0 ? 'fin-pos' : 'fin-neg') : 'fin-dim';
    var d = '<span class="fin-dim">—</span>';

    return '<tr>' +
      '<td class="fin-name"><span class="fin-dot" style="background:' + p.dotColor + '"></span>' + escapeHtml(p.name) + '</td>' +
      '<td class="fin-num">' + (p.dealCost ? fmt$(p.dealCost) : d) + '</td>' +
      '<td class="fin-num">' + (p.budget30 ? fmt$(p.budget30) : d) + '</td>' +
      '<td class="fin-num">' + fmtH(p.hours) + '</td>' +
      '<td class="fin-num fin-bold">' + fmt$(p.cost) + '</td>' +
      '<td class="fin-num">' + (p.totalMargin !== null ? fmtPct(p.totalMargin) : d) + '</td>' +
      '<td class="fin-num ' + pmCls + '">' + (p.profitMargin !== null ? fmtPct(p.profitMargin) : '—') + '</td>' +
      '<td class="fin-num ' + profitCls + '">' + (p.profit !== null ? fmt$(p.profit) : '—') + '</td>' +
      '<td class="fin-num">' + (p.assets || d) + '</td>' +
      '<td class="fin-num">' + (p.assetCost !== null ? fmt$(p.assetCost) : d) + '</td>' +
    '</tr>';
  }).join('');

  html += '<tr class="fin-total"><td>Total (' + projRows.length + ')</td>' +
    '<td class="fin-num">' + fmt$(totalDeal) + '</td><td class="fin-num">' + fmt$(totalBudget) + '</td>' +
    '<td class="fin-num">' + fmtH(totalH) + '</td><td class="fin-num">' + fmt$(totalC) + '</td>' +
    '<td></td><td></td><td class="fin-num ' + (totalProfit >= 0 ? 'fin-pos' : 'fin-neg') + '">' + fmt$(totalProfit) + '</td><td></td><td></td></tr>';
  tbody.innerHTML = html;

  var kpi = document.getElementById('finKpis');
  if (kpi) {
    var withDeal = projRows.filter(function(p){return p.dealCost > 0;});
    var overBudget = withDeal.filter(function(p){return p.profit !== null && p.profit < 0;}).length;
    kpi.innerHTML =
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Deal Value</div><div class="fin-kpi-value" style="color:var(--accent)">' + fmt$(totalDeal) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Cost</div><div class="fin-kpi-value">' + fmt$(totalC) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Net Profit (30%)</div><div class="fin-kpi-value" style="color:' + (totalProfit >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + fmt$(totalProfit) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Over Budget</div><div class="fin-kpi-value" style="color:' + (overBudget ? 'var(--danger)' : 'var(--success)') + '">' + overBudget + '/' + withDeal.length + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Projects</div><div class="fin-kpi-value">' + projRows.length + '</div></div>';
  }
}

function setView(v) {
  fView = v;
  document.getElementById('finTabArtists').className = v === 'artists' ? 'fin-tab active' : 'fin-tab';
  document.getElementById('finTabBudgets').className = v === 'budgets' ? 'fin-tab active' : 'fin-tab';
  if (v === 'artists') renderArtists(); else renderBudgets();
}

window.finSetView = setView;

registerTab('finance', {
  icon: '💵', label: 'Finance',
  roles: [ROLE.ADMIN, ROLE.ADMIN_COPY, ROLE.LEADERSHIP],
  onInit: function() {
    var style = document.createElement('style');
    style.textContent = finCSS;
    document.head.appendChild(style);
    document.getElementById('tab-finance').innerHTML = buildHTML();
  },
  onActivate: async function() {
    window.onAppSearch = function(val) { fSearch = val.trim(); if (fView === 'artists') renderArtists(); else renderBudgets(); };
    var dfEl = document.getElementById('finDateFilter');
    if (dfEl && !dfEl.innerHTML) {
      dfEl.innerHTML = buildDateFilter('fin', function() {
        loadFinData().then(function() {
          if (fView === 'artists') renderArtists(); else renderBudgets();
        });
      });
      // Wire change events on date inputs
      ['finDateFrom','finDateTo'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function() {
          loadFinData().then(function() {
            if (fView === 'artists') renderArtists(); else renderBudgets();
          });
        });
      });
    }
    document.getElementById('finTbody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:40px">Loading financial data...</td></tr>';
    await loadFinData();
    if (fView === 'artists') renderArtists(); else renderBudgets();
  }
});

})();
