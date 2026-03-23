// ═══════════════════════════════════════════════════════════════
// Finance Tab — Artist costs + Project budgets
// ═══════════════════════════════════════════════════════════════
(function() {

var fPeople = [];
var fBookings = [];
var fView = 'artists'; // 'artists' or 'budgets'

var EXCLUDED_PODS = ['Polish office', 'TourBuilder'];

var finCSS = [
  '.fin-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.fin-tabs { display:flex; gap:4px; }',
  '.fin-tab { padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:var(--surface); color:var(--text-muted); }',
  '.fin-tab.active { background:var(--accent-dim); color:var(--accent); border-color:var(--accent-border); }',
  '.fin-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; padding:12px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.fin-kpi { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; }',
  '.fin-kpi-label { font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; }',
  '.fin-kpi-value { font-size:20px; font-weight:700; margin-top:2px; }',
  '.fin-grid { flex:1; overflow:auto; }',
  '.fin-table { width:100%; border-collapse:collapse; font-size:12px; }',
  '.fin-table th { padding:8px 12px; font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:5; text-align:left; }',
  '.fin-table th.num { text-align:right; }',
  '.fin-table td { padding:8px 12px; border-bottom:1px solid var(--border); }',
  '.fin-table tr:hover td { background:var(--accent-dim); }',
  '.fin-name { font-weight:500; color:var(--text); }',
  '.fin-num { text-align:right; font-family:"JetBrains Mono",monospace; font-size:11px; }',
  '.fin-bold { font-weight:700; color:var(--text); }',
  '.fin-dim { color:var(--text-dim); }',
  '.fin-pos { color:var(--success); }',
  '.fin-neg { color:var(--danger); }',
  '.fin-total td { background:var(--surface); font-weight:700; border-top:2px solid var(--border); }'
].join('\n');

function fmt$(v) {
  if (!v && v !== 0) return '—';
  return '$' + Number(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function fmtH(v) { return v ? v.toLocaleString() + 'h' : '—'; }

function buildHTML() {
  return '<div class="fin-topbar">' +
    '<div class="fin-tabs">' +
      '<div class="fin-tab active" id="finTabArtists" onclick="finSetView(\'artists\')">Artist Costs</div>' +
      '<div class="fin-tab" id="finTabBudgets" onclick="finSetView(\'budgets\')">Project Budgets</div>' +
    '</div>' +
    '<div></div>' +
  '</div>' +
  '<div id="finKpis" class="fin-kpi-row"></div>' +
  '<div class="fin-grid">' +
    '<table class="fin-table"><thead id="finThead"></thead><tbody id="finTbody"></tbody></table>' +
  '</div>';
}

async function loadFinData() {
  fPeople = await getCachedPeople();

  // Load ALL bookings (no date filter — lifetime totals like TeamDeck shows)
  var records = await qbQuery(TABLES.assignments,
    [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.personName, FIELD.ASSIGN.personPod,
     FIELD.ASSIGN.projectName, FIELD.ASSIGN.hours],
    null, // no where — all bookings
    [{fieldId: FIELD.ASSIGN.personName, order: 'ASC'}], 10000);

  fBookings = (records.records || []).map(function(r) {
    return {
      personKey: String(val(r, FIELD.ASSIGN.person)),
      personName: val(r, FIELD.ASSIGN.personName),
      personPod: val(r, FIELD.ASSIGN.personPod),
      project: val(r, FIELD.ASSIGN.projectName),
      hours: parseFloat(val(r, FIELD.ASSIGN.hours)) || 8
    };
  });
}

function renderArtists() {
  var thead = document.getElementById('finThead');
  var tbody = document.getElementById('finTbody');
  if (!thead || !tbody) return;

  thead.innerHTML = '<tr>' +
    '<th>Name</th><th>Pod</th><th class="num">Hourly Rate</th><th class="num">Bookings</th><th class="num">Booking Cost</th>' +
  '</tr>';

  // Aggregate bookings per person
  var byPerson = {};
  fBookings.forEach(function(b) {
    var key = b.personKey;
    if (!byPerson[key]) byPerson[key] = {hours: 0, name: b.personName, pod: b.personPod};
    byPerson[key].hours += b.hours;
  });

  // Build rows from People (to get hourly rate)
  var rows = fPeople
    .filter(function(p) { return EXCLUDED_PODS.indexOf(p.pod) === -1; })
    .map(function(p) {
      var data = byPerson[String(p.tdId)] || {hours: 0};
      return {
        name: p.name,
        pod: p.pod,
        rate: p.hourlyRate,
        hours: data.hours,
        cost: data.hours * (p.hourlyRate || 0)
      };
    })
    .sort(function(a, b) { return b.hours - a.hours; });

  var totalHours = 0, totalCost = 0;
  var html = rows.map(function(r) {
    totalHours += r.hours;
    totalCost += r.cost;
    return '<tr>' +
      '<td class="fin-name">' + escapeHtml(r.name) + '</td>' +
      '<td class="fin-dim">' + escapeHtml(r.pod) + '</td>' +
      '<td class="fin-num">' + (r.rate ? fmt$(r.rate) : '<span class="fin-dim">—</span>') + '</td>' +
      '<td class="fin-num">' + fmtH(r.hours) + '</td>' +
      '<td class="fin-num fin-bold">' + (r.cost ? fmt$(r.cost) : '—') + '</td>' +
    '</tr>';
  }).join('');

  html += '<tr class="fin-total">' +
    '<td>Total</td><td></td><td></td>' +
    '<td class="fin-num">' + fmtH(totalHours) + '</td>' +
    '<td class="fin-num">' + fmt$(totalCost) + '</td>' +
  '</tr>';

  tbody.innerHTML = html;

  // KPIs
  var kpi = document.getElementById('finKpis');
  if (kpi) {
    var avgRate = rows.filter(function(r){return r.rate;}).reduce(function(s,r){return s+r.rate;},0) / (rows.filter(function(r){return r.rate;}).length || 1);
    kpi.innerHTML =
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Hours</div><div class="fin-kpi-value" style="color:var(--accent)">' + totalHours.toLocaleString() + 'h</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Cost</div><div class="fin-kpi-value" style="color:var(--accent)">' + fmt$(totalCost) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Avg Hourly Rate</div><div class="fin-kpi-value">' + fmt$(avgRate) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Team Members</div><div class="fin-kpi-value">' + rows.length + '</div></div>';
  }
}

function renderBudgets() {
  var thead = document.getElementById('finThead');
  var tbody = document.getElementById('finTbody');
  if (!thead || !tbody) return;

  thead.innerHTML = '<tr>' +
    '<th>Project</th><th class="num">Bookings</th><th class="num">Booking Cost</th><th class="num">Artists</th>' +
  '</tr>';

  // Build rate lookup
  var rateMap = {};
  fPeople.forEach(function(p) { rateMap[String(p.tdId)] = p.hourlyRate || 0; });

  // Aggregate by project
  var byProject = {};
  fBookings.forEach(function(b) {
    var proj = b.project || '(No Project)';
    if (!byProject[proj]) byProject[proj] = {hours: 0, cost: 0, artists: new Set()};
    byProject[proj].hours += b.hours;
    byProject[proj].cost += b.hours * (rateMap[b.personKey] || 0);
    byProject[proj].artists.add(b.personKey);
  });

  var projects = Object.keys(byProject).map(function(name) {
    return {
      name: name,
      hours: byProject[name].hours,
      cost: byProject[name].cost,
      artists: byProject[name].artists.size
    };
  }).sort(function(a, b) { return b.cost - a.cost; });

  var totalHours = 0, totalCost = 0;
  var html = projects.map(function(p) {
    totalHours += p.hours;
    totalCost += p.cost;
    return '<tr>' +
      '<td class="fin-name">' + escapeHtml(p.name) + '</td>' +
      '<td class="fin-num">' + fmtH(p.hours) + '</td>' +
      '<td class="fin-num fin-bold">' + fmt$(p.cost) + '</td>' +
      '<td class="fin-num">' + p.artists + '</td>' +
    '</tr>';
  }).join('');

  html += '<tr class="fin-total">' +
    '<td>Total (' + projects.length + ' projects)</td>' +
    '<td class="fin-num">' + fmtH(totalHours) + '</td>' +
    '<td class="fin-num">' + fmt$(totalCost) + '</td>' +
    '<td></td>' +
  '</tr>';

  tbody.innerHTML = html;

  var kpi = document.getElementById('finKpis');
  if (kpi) {
    kpi.innerHTML =
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Projects</div><div class="fin-kpi-value">' + projects.length + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Booking Cost</div><div class="fin-kpi-value" style="color:var(--accent)">' + fmt$(totalCost) + '</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Total Hours</div><div class="fin-kpi-value">' + totalHours.toLocaleString() + 'h</div></div>' +
      '<div class="fin-kpi"><div class="fin-kpi-label">Avg Cost/Project</div><div class="fin-kpi-value">' + fmt$(projects.length ? totalCost / projects.length : 0) + '</div></div>';
  }
}

function setView(v) {
  fView = v;
  document.getElementById('finTabArtists').className = v === 'artists' ? 'fin-tab active' : 'fin-tab';
  document.getElementById('finTabBudgets').className = v === 'budgets' ? 'fin-tab active' : 'fin-tab';
  if (v === 'artists') renderArtists();
  else renderBudgets();
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
    document.getElementById('finTbody').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:40px">Loading financial data...</td></tr>';
    await loadFinData();
    if (fView === 'artists') renderArtists();
    else renderBudgets();
  }
});

})();
