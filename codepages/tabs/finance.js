// ═══════════════════════════════════════════════════════════════
// Finance Tab — Artist costs + Project budgets
// ═══════════════════════════════════════════════════════════════
(function() {

var fPeople = [];
var fBookings = [];
var fProjects = [];
var fScopeByDeal = {};
var fView = 'budgets';
var fSearch = '';
var fCollapsedPods = new Set();
var fCollapsedBudgetPods = new Set();

// Per-view cache — each view only loads what it needs
var fArtistsLoadedAt = 0;
var fArtistsLoadedRange = '';
var fBudgetsLoadedAt = 0;
var fBudgetsLoadedRange = '';
// Set FIELD.PROJECTS.totalDealValue here once the summary field is created in QB.
// That field returns sum(scope.totalValue) per project directly on the project row.
// When set, loadBudgetsData will use it instead of querying the scope table at all.
var SUMMARY_FIELD_ID = null; // e.g. 150 once created

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
  '.fin-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }',
  '.fin-pod-row td { background:var(--surface2); font-weight:600; color:var(--text); cursor:pointer; padding:7px 10px; user-select:none; }',
  '.fin-pod-row:hover td { background:var(--surface3); }',
  '.fin-pod-chevron { font-size:10px; color:var(--text-dim); margin-right:6px; display:inline-block; transition:transform 0.2s; }',
  '.fin-pod-chevron.open { transform:rotate(90deg); }',
  '.fin-rate-cell { display:flex; align-items:center; justify-content:flex-end; gap:6px; }',
  '.fin-edit-btn { opacity:0; cursor:pointer; color:var(--text-dim); background:none; border:none; padding:1px 3px; font-size:10px; transition:opacity 0.15s; }',
  '.fin-table tr:hover .fin-edit-btn { opacity:1; }',
  '.fin-edit-btn:hover { color:var(--accent); }',
  '.fin-rate-input { width:80px; background:var(--surface); border:1px solid var(--accent); border-radius:3px; padding:2px 5px; font-size:11px; color:var(--text); font-family:"JetBrains Mono",monospace; text-align:right; outline:none; }'
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
      '<div class="fin-tab active" id="finTabBudgets" onclick="finSetView(\'budgets\')">Project Budgets</div>' +
      '<div class="fin-tab" id="finTabArtists" onclick="finSetView(\'artists\')">Artist Costs</div>' +
    '</div>' +
    '<div id="finDateFilter"></div>' +
  '</div>' +
  '<div id="finKpis" class="fin-kpi-row"></div>' +
  '<div class="fin-grid"><table class="fin-table"><thead id="finThead"></thead><tbody id="finTbody"></tbody></table></div>';
}

function getBookingWhere(dateRange) {
  return (dateRange.start && dateRange.end)
    ? '{' + FIELD.ASSIGN.end + '.OAF.' + dateRange.start + '}AND{' + FIELD.ASSIGN.start + '.BF.' + dateRange.end + '}'
    : null;
}

function mapBookings(records) {
  return (records.records || []).map(function(r) {
    return {
      personKey: String(fv(r, FIELD.ASSIGN.person)),
      personName: fv(r, FIELD.ASSIGN.personName),
      project: fv(r, FIELD.ASSIGN.projectName),
      hours: parseFloat(fv(r, FIELD.ASSIGN.hours)) || 8
    };
  });
}

// ─── ARTIST COSTS LOADER (people + bookings only) ────────────
async function loadArtistsData() {
  var dateRange = getDateFilterRange('fin');
  var results = await Promise.all([
    getCachedPeople(),
    qbQuery(TABLES.assignments,
      [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.personName,
       FIELD.ASSIGN.personPod, FIELD.ASSIGN.projectName, FIELD.ASSIGN.hours],
      getBookingWhere(dateRange),
      [{fieldId: FIELD.ASSIGN.personName, order: 'ASC'}], 10000)
  ]);
  fPeople = results[0];
  fBookings = mapBookings(results[1]);
  fArtistsLoadedRange = dateRange.start + ':' + dateRange.end;
  fArtistsLoadedAt = Date.now();
}

// ─── PROJECT BUDGETS LOADER (people + projects + bookings, then targeted scope) ─
async function loadBudgetsData() {
  var dateRange = getDateFilterRange('fin');

  // Phase 1: fast queries in parallel — no scope yet
  var phase1 = await Promise.all([
    getCachedPeople(),
    getCachedProjects(false),
    qbQuery(TABLES.assignments,
      [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.personName,
       FIELD.ASSIGN.personPod, FIELD.ASSIGN.projectName, FIELD.ASSIGN.hours],
      getBookingWhere(dateRange),
      [{fieldId: FIELD.ASSIGN.personName, order: 'ASC'}], 10000)
  ]);
  fPeople = phase1[0];
  fProjects = phase1[1];
  fBookings = mapBookings(phase1[2]);

  // Phase 2: scope — targeted to only projects that appear in bookings
  if (SUMMARY_FIELD_ID) {
    // Pull totals directly from project row (no scope query needed)
    fScopeByDeal = {};
    fProjects.forEach(function(p) {
      if (p.deal && p.totalDealValue) {
        fScopeByDeal[String(p.deal)] = {totalValue: p.totalDealValue, assets: p.visualAssets || 0};
      }
    });
  } else {
    // Build the set of deal IDs that actually appear in bookings
    var bookedNames = new Set(fBookings.map(function(b) { return b.project; }));
    var relevantDeals = []; var seen = new Set();
    fProjects.forEach(function(p) {
      if (p.deal && bookedNames.has(p.name)) {
        var key = String(p.deal);
        if (!seen.has(key)) { seen.add(key); relevantDeals.push(p.deal); }
      }
    });

    var scopeRows;
    if (relevantDeals.length === 0) {
      scopeRows = [];
    } else if (relevantDeals.length > 150) {
      // Fallback: too many deals to filter efficiently, fetch all
      scopeRows = await qbQueryAll(TABLES.scope,
        [FIELD.SCOPE.id, FIELD.SCOPE.totalValue, FIELD.SCOPE.projectRef], null);
    } else {
      // Targeted: only the scope rows for projects with bookings in this date range
      var scopeWhere = relevantDeals.map(function(id) {
        return '{' + FIELD.SCOPE.projectRef + '.EX.' + id + '}';
      }).join('OR');
      scopeRows = await qbQueryAll(TABLES.scope,
        [FIELD.SCOPE.id, FIELD.SCOPE.totalValue, FIELD.SCOPE.projectRef], scopeWhere);
    }

    fScopeByDeal = {};
    scopeRows.forEach(function(r) {
      var dealId = String(fv(r, FIELD.SCOPE.projectRef));
      if (!fScopeByDeal[dealId]) fScopeByDeal[dealId] = {totalValue: 0, assets: 0};
      fScopeByDeal[dealId].totalValue += parseFloat(fv(r, FIELD.SCOPE.totalValue)) || 0;
      fScopeByDeal[dealId].assets += 1;
    });
  }

  fBudgetsLoadedRange = dateRange.start + ':' + dateRange.end;
  fBudgetsLoadedAt = Date.now();
}

// ─── ARTIST COSTS VIEW ─────────────────────────────────────
function renderArtists() {
  var thead = document.getElementById('finThead');
  var tbody = document.getElementById('finTbody');
  if (!thead || !tbody) return;

  var canEdit = typeof _currentUser !== 'undefined' &&
    (_currentUser.role === ROLE.ADMIN || _currentUser.role === ROLE.ADMIN_COPY);

  thead.innerHTML = '<tr><th>Name</th><th class="num">Hourly Rate</th><th class="num">Bookings</th><th class="num">Booking Cost</th></tr>';

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
      return { id: p.id, name: p.name, pod: p.pod || 'Unknown', rate: p.hourlyRate, hours: data.hours, cost: data.hours * (p.hourlyRate || 0) };
    })
    .sort(function(a, b) { return a.pod.localeCompare(b.pod) || a.name.localeCompare(b.name); });

  // Group by pod
  var podGroups = {};
  var podOrder = [];
  rows.forEach(function(r) {
    if (!podGroups[r.pod]) { podGroups[r.pod] = []; podOrder.push(r.pod); }
    podGroups[r.pod].push(r);
  });

  var totalH = 0, totalC = 0;
  var editSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var html = '';

  podOrder.forEach(function(pod) {
    var members = podGroups[pod];
    var podH = members.reduce(function(s, r) { return s + r.hours; }, 0);
    var podC = members.reduce(function(s, r) { return s + r.cost; }, 0);
    var collapsed = fCollapsedPods.has(pod);
    var dotColor = (typeof POD_COLORS !== 'undefined' && POD_COLORS[pod]) || '#868e96';
    var chevronCls = 'fin-pod-chevron' + (collapsed ? '' : ' open');
    totalH += podH; totalC += podC;

    html += '<tr class="fin-pod-row" onclick="finTogglePod(\'' + escapeHtml(pod) + '\')">' +
      '<td colspan="4">' +
        '<span class="' + chevronCls + '" id="fin-chev-' + escapeHtml(pod) + '">&#9654;</span>' +
        '<span class="fin-dot" style="background:' + dotColor + '"></span>' +
        escapeHtml(pod) +
        ' <span class="fin-dim" style="font-weight:400;font-size:10px">(' + members.length + ' people &middot; ' + fmtH(podH) + ' &middot; ' + fmt$(podC) + ')</span>' +
      '</td></tr>';

    members.forEach(function(r) {
      var rateHtml;
      if (canEdit) {
        rateHtml = '<td class="fin-num"><div class="fin-rate-cell" id="fin-rate-' + r.id + '">' +
          (r.rate ? fmt$(r.rate) : '<span class="fin-dim">—</span>') +
          '<button class="fin-edit-btn" title="Edit rate" onclick="event.stopPropagation();finEditRate(' + r.id + ',' + (r.rate || 0) + ')">' + editSvg + '</button>' +
          '</div></td>';
      } else {
        rateHtml = '<td class="fin-num">' + (r.rate ? fmt$(r.rate) : '<span class="fin-dim">—</span>') + '</td>';
      }
      html += '<tr class="fin-person-row" data-fin-pod="' + escapeHtml(pod) + '"' + (collapsed ? ' style="display:none"' : '') + '>' +
        '<td class="fin-name">' + escapeHtml(r.name) + '</td>' +
        rateHtml +
        '<td class="fin-num">' + fmtH(r.hours) + '</td>' +
        '<td class="fin-num fin-bold">' + fmt$(r.cost) + '</td></tr>';
    });
  });

  html += '<tr class="fin-total"><td>Total (' + rows.length + ')</td><td></td><td class="fin-num">' + fmtH(totalH) + '</td><td class="fin-num">' + fmt$(totalC) + '</td></tr>';
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

window.finTogglePod = function(pod) {
  if (fCollapsedPods.has(pod)) fCollapsedPods.delete(pod); else fCollapsedPods.add(pod);
  var collapsed = fCollapsedPods.has(pod);
  document.querySelectorAll('[data-fin-pod="' + pod + '"]').forEach(function(row) {
    row.style.display = collapsed ? 'none' : '';
  });
  var chev = document.getElementById('fin-chev-' + pod);
  if (chev) chev.className = 'fin-pod-chevron' + (collapsed ? '' : ' open');
};

window.finToggleBudgetPod = function(pod) {
  if (fCollapsedBudgetPods.has(pod)) fCollapsedBudgetPods.delete(pod); else fCollapsedBudgetPods.add(pod);
  var collapsed = fCollapsedBudgetPods.has(pod);
  document.querySelectorAll('[data-fin-bpod="' + pod + '"]').forEach(function(row) {
    row.style.display = collapsed ? 'none' : '';
  });
  var chev = document.getElementById('fin-bchev-' + pod);
  if (chev) chev.className = 'fin-pod-chevron' + (collapsed ? '' : ' open');
};

window.finEditAssets = function(projId, currentCount) {
  var cell = document.getElementById('fin-assets-' + projId);
  if (!cell) return;
  var editSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  function restore(count) {
    cell.innerHTML = (count ? count : '<span class="fin-dim">—</span>') +
      '<button class="fin-edit-btn" title="Edit asset count" onclick="event.stopPropagation();finEditAssets(' + projId + ',' + (count || 0) + ')">' + editSvg + '</button>';
  }
  var input = document.createElement('input');
  input.className = 'fin-rate-input';
  input.type = 'number'; input.min = '0'; input.step = '1'; input.value = currentCount || '';
  input.onclick = function(e) { e.stopPropagation(); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { restore(currentCount); }
  };
  input.onblur = function() {
    var count = parseInt(input.value, 10);
    if (isNaN(count) || count < 0) { restore(currentCount); return; }
    // Update local cache and re-render (recalculates Asset Cost column too)
    var proj = fProjects.find(function(x) { return x.id == projId; });
    if (proj) proj.visualAssets = count;
    renderBudgets();
    var rec = {}; rec[FIELD.PROJECTS.id] = {value: parseInt(projId, 10)}; rec[FIELD.PROJECTS.fid118] = {value: count};
    qbUpsert(TABLES.projects, [rec])
      .then(function() { showToast('Asset count updated', 'success'); })
      .catch(function(e) {
        showToast('Failed to save asset count', 'error'); console.error(e);
        if (proj) proj.visualAssets = currentCount;
        renderBudgets();
      });
  };
  cell.innerHTML = ''; cell.appendChild(input);
  input.focus(); input.select();
};

window.finEditRate = function(personId, currentRate) {
  var cell = document.getElementById('fin-rate-' + personId);
  if (!cell) return;
  var editSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  function restore(rate) {
    cell.innerHTML = (rate ? fmt$(rate) : '<span class="fin-dim">—</span>') +
      '<button class="fin-edit-btn" title="Edit rate" onclick="event.stopPropagation();finEditRate(' + personId + ',' + (rate || 0) + ')">' + editSvg + '</button>';
  }
  var input = document.createElement('input');
  input.className = 'fin-rate-input';
  input.type = 'number'; input.min = '0'; input.step = '1'; input.value = currentRate || '';
  input.onclick = function(e) { e.stopPropagation(); };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { restore(currentRate); }
  };
  input.onblur = function() {
    var rate = parseFloat(input.value);
    if (isNaN(rate) || rate < 0) { restore(currentRate); return; }
    restore(rate);
    var p = fPeople.find(function(x) { return x.id == personId; });
    if (p) p.hourlyRate = rate;
    // Also update fArtistsLoadedAt=0 so cost totals recalc next render
    var rec = {}; rec[FIELD.PEOPLE.id] = {value: parseInt(personId, 10)}; rec[FIELD.PEOPLE.hourlyRate] = {value: rate};
    qbUpsert(TABLES.people, [rec])
      .then(function() { showToast('Hourly rate updated', 'success'); getCachedPeople(true); })
      .catch(function(e) { showToast('Failed to save rate', 'error'); console.error(e); restore(currentRate); });
  };
  cell.innerHTML = ''; cell.appendChild(input);
  input.focus(); input.select();
};

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

  var byProject = {};
  fBookings.forEach(function(b) {
    var proj = b.project || '(No Project)';
    if (!byProject[proj]) byProject[proj] = {hours: 0, cost: 0, artists: new Set()};
    byProject[proj].hours += b.hours;
    byProject[proj].cost += b.hours * (rateMap[b.personKey] || 0);
    byProject[proj].artists.add(b.personKey);
  });

  var projRows = [];
  for (var projName in byProject) {
    var bp = byProject[projName];
    var matched = fProjects.find(function(p) { return p.name === projName; });

    var dealCost = 0, assets = 0;
    if (matched && matched.deal) {
      var scope = fScopeByDeal[String(matched.deal)];
      if (scope) dealCost = scope.totalValue;
      // Manual override (visualAssets) takes priority over scope record count
      assets = matched.visualAssets || (scope ? scope.assets : 0);
    }

    var budget30 = dealCost * 0.30;
    var totalMargin = dealCost > 0 ? (bp.cost / dealCost * 100) : null;
    var profitMargin = budget30 > 0 ? ((budget30 - bp.cost) / budget30 * -100) : null;
    var profit = budget30 > 0 ? (budget30 - bp.cost) : null;
    var assetCost = assets > 0 ? (bp.cost / assets) : null;

    var dotColor = '#7f8c8d';
    if (profitMargin !== null) {
      if (profitMargin > -20) dotColor = '#27ae60';
      else if (profitMargin > -50) dotColor = '#f39c12';
      else if (profitMargin > -80) dotColor = '#e67e22';
      else dotColor = '#e74c3c';
    }

    projRows.push({
      name: projName,
      pod: (matched && matched.pod) || 'Unknown',
      number: (matched && matched.number) || 0,
      projId: matched ? matched.id : null,
      dealCost: dealCost, budget30: budget30,
      hours: bp.hours, cost: bp.cost, totalMargin: totalMargin,
      profitMargin: profitMargin, profit: profit,
      assets: assets, assetCost: assetCost, dotColor: dotColor
    });
  }

  if (fSearch) {
    var s = fSearch.toLowerCase();
    projRows = projRows.filter(function(p) { return p.name.toLowerCase().indexOf(s) !== -1; });
  }

  // Group by pod
  var podGroups = {};
  var podOrder = [];
  projRows.forEach(function(p) {
    if (!podGroups[p.pod]) { podGroups[p.pod] = []; podOrder.push(p.pod); }
    podGroups[p.pod].push(p);
  });

  // Sort pods: pods with booking hours first (desc total hours), then alphabetical
  podOrder.sort(function(a, b) {
    var aH = podGroups[a].reduce(function(s, r) { return s + r.hours; }, 0);
    var bH = podGroups[b].reduce(function(s, r) { return s + r.hours; }, 0);
    if (aH && !bH) return -1;
    if (!aH && bH) return 1;
    if (aH !== bH) return bH - aH;
    return a.localeCompare(b);
  });

  // Sort projects within each pod by number high to low
  podOrder.forEach(function(pod) {
    podGroups[pod].sort(function(a, b) { return (b.number || 0) - (a.number || 0); });
  });

  var canEdit = typeof _currentUser !== 'undefined' &&
    (_currentUser.role === ROLE.ADMIN || _currentUser.role === ROLE.ADMIN_COPY);
  var editSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

  var totalDeal = 0, totalBudget = 0, totalH = 0, totalC = 0, totalProfit = 0, totalCount = 0;
  var html = '';
  var d = '<span class="fin-dim">—</span>';

  podOrder.forEach(function(pod) {
    var members = podGroups[pod];
    var podH = members.reduce(function(s, r) { return s + r.hours; }, 0);
    var podC = members.reduce(function(s, r) { return s + r.cost; }, 0);
    var podDeal = members.reduce(function(s, r) { return s + r.dealCost; }, 0);
    var collapsed = fCollapsedBudgetPods.has(pod);
    var dotColor = (typeof POD_COLORS !== 'undefined' && POD_COLORS[pod]) || '#868e96';
    var chevronCls = 'fin-pod-chevron' + (collapsed ? '' : ' open');
    totalH += podH; totalC += podC; totalCount += members.length;

    html += '<tr class="fin-pod-row" onclick="finToggleBudgetPod(\'' + escapeHtml(pod) + '\')">' +
      '<td colspan="10">' +
        '<span class="' + chevronCls + '" id="fin-bchev-' + escapeHtml(pod) + '">&#9654;</span>' +
        '<span class="fin-dot" style="background:' + dotColor + '"></span>' +
        escapeHtml(pod) +
        ' <span class="fin-dim" style="font-weight:400;font-size:10px">(' + members.length + ' projects &middot; ' + fmtH(podH) + ' &middot; ' + fmt$(podC) + (podDeal ? ' &middot; deal ' + fmt$(podDeal) : '') + ')</span>' +
      '</td></tr>';

    members.forEach(function(p) {
      totalDeal += p.dealCost; totalBudget += p.budget30;
      if (p.profit !== null) totalProfit += p.profit;

      var pmCls = p.profitMargin !== null ? (p.profitMargin <= 0 ? 'fin-pos' : 'fin-neg') : 'fin-dim';
      var profitCls = p.profit !== null ? (p.profit >= 0 ? 'fin-pos' : 'fin-neg') : 'fin-dim';

      html += '<tr data-fin-bpod="' + escapeHtml(pod) + '"' + (collapsed ? ' style="display:none"' : '') + '>' +
        '<td class="fin-name"><span class="fin-dot" style="background:' + p.dotColor + '"></span>' + escapeHtml(p.name) + '</td>' +
        '<td class="fin-num">' + (p.dealCost ? fmt$(p.dealCost) : d) + '</td>' +
        '<td class="fin-num">' + (p.budget30 ? fmt$(p.budget30) : d) + '</td>' +
        '<td class="fin-num">' + fmtH(p.hours) + '</td>' +
        '<td class="fin-num fin-bold">' + fmt$(p.cost) + '</td>' +
        '<td class="fin-num">' + (p.totalMargin !== null ? fmtPct(p.totalMargin) : d) + '</td>' +
        '<td class="fin-num ' + pmCls + '">' + (p.profitMargin !== null ? fmtPct(p.profitMargin) : '—') + '</td>' +
        '<td class="fin-num ' + profitCls + '">' + (p.profit !== null ? fmt$(p.profit) : '—') + '</td>' +
        (canEdit && p.projId
          ? '<td class="fin-num"><div class="fin-rate-cell" id="fin-assets-' + p.projId + '">' +
              (p.assets ? p.assets : '<span class="fin-dim">—</span>') +
              '<button class="fin-edit-btn" title="Edit asset count" onclick="event.stopPropagation();finEditAssets(' + p.projId + ',' + (p.assets || 0) + ')">' + editSvg + '</button>' +
            '</div></td>'
          : '<td class="fin-num">' + (p.assets || d) + '</td>') +
        '<td class="fin-num">' + (p.assetCost !== null ? fmt$(p.assetCost) : d) + '</td>' +
      '</tr>';
    });
  });

  html += '<tr class="fin-total"><td>Total (' + totalCount + ')</td>' +
    '<td class="fin-num">' + fmt$(totalDeal) + '</td><td class="fin-num">' + fmt$(totalBudget) + '</td>' +
    '<td class="fin-num">' + fmtH(totalH) + '</td><td class="fin-num">' + fmt$(totalC) + '</td>' +
    '<td></td><td></td><td class="fin-num ' + (totalProfit >= 0 ? 'fin-pos' : 'fin-neg') + '">' + fmt$(totalProfit) + '</td><td></td><td></td></tr>';
  tbody.innerHTML = html;

  var kpi = document.getElementById('finKpis');
  if (kpi) {
    var allRows = projRows;
    var withDeal = allRows.filter(function(p){return p.dealCost > 0;});
    var overBudget = withDeal.filter(function(p){return p.profit !== null && p.profit < 0;}).length;
    kpi.innerHTML =
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Deal Value</div><div class="fin-kpi-value" style="color:var(--accent)">' + fmt$(totalDeal) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Cost</div><div class="fin-kpi-value">' + fmt$(totalC) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Net Profit (30%)</div><div class="fin-kpi-value" style="color:' + (totalProfit >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + fmt$(totalProfit) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Over Budget</div><div class="fin-kpi-value" style="color:' + (overBudget ? 'var(--danger)' : 'var(--success)') + '">' + overBudget + '/' + withDeal.length + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Projects</div><div class="fin-kpi-value">' + totalCount + '</div></div>';
  }
}

// ─── VIEW SWITCHER ──────────────────────────────────────────
async function activateView(v) {
  fView = v;
  document.getElementById('finTabBudgets').className = v === 'budgets' ? 'fin-tab active' : 'fin-tab';
  document.getElementById('finTabArtists').className = v === 'artists' ? 'fin-tab active' : 'fin-tab';

  var dr = getDateFilterRange('fin');
  var rangeKey = dr.start + ':' + dr.end;

  if (v === 'budgets') {
    if (rangeKey === fBudgetsLoadedRange && Date.now() - fBudgetsLoadedAt < 300000) {
      renderBudgets();
    } else {
      document.getElementById('finTbody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:40px">Loading project budgets...</td></tr>';
      await loadBudgetsData();
      renderBudgets();
    }
  } else {
    if (rangeKey === fArtistsLoadedRange && Date.now() - fArtistsLoadedAt < 300000) {
      renderArtists();
    } else {
      document.getElementById('finTbody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:40px">Loading artist costs...</td></tr>';
      await loadArtistsData();
      renderArtists();
    }
  }
}

function invalidateAndReload() {
  fArtistsLoadedAt = 0;
  fBudgetsLoadedAt = 0;
  activateView(fView);
}

window.finSetView = activateView;

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
    window.onAppSearch = function(val) {
      fSearch = val.trim();
      if (fView === 'budgets') renderBudgets(); else renderArtists();
    };
    var dfEl = document.getElementById('finDateFilter');
    if (dfEl && !dfEl.innerHTML) {
      dfEl.innerHTML = buildDateFilter('fin', invalidateAndReload);
      ['finDateFrom','finDateTo'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', invalidateAndReload);
      });
    }
    await activateView(fView);
  }
});

})();
