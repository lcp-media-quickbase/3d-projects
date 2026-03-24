// ═══════════════════════════════════════════════════════════════
// Timesheets Tab — Weekly Time Grid
// ═══════════════════════════════════════════════════════════════
(function() {

var tsWeekStart = null; // Monday of current view week
var tsPeople = [];
var tsBookings = [];
var tsCollapsedPods = new Set();
var tsSearch = '';

var tsCSS = [
  '.ts-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--border); flex-shrink:0; gap:12px; }',
  '.ts-topbar-left { display:flex; align-items:center; gap:12px; }',
  '.ts-topbar-center { display:flex; align-items:center; gap:8px; }',
  '.ts-topbar-right { display:flex; align-items:center; gap:10px; }',
  '.ts-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; padding:12px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.ts-kpi { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; }',
  '.ts-kpi-label { font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; }',
  '.ts-kpi-value { font-size:20px; font-weight:700; margin-top:2px; }',
  '.ts-grid { flex:1; overflow:auto; }',
  '.ts-table { width:100%; border-collapse:collapse; font-size:12px; }',
  '.ts-table th { padding:8px 10px; font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:5; }',
  '.ts-table td { padding:6px 10px; border-bottom:1px solid var(--border); text-align:center; }',
  '.ts-name-cell { text-align:left !important; font-weight:500; color:var(--text); white-space:nowrap; }',
  '.ts-pod-row td { background:var(--surface2); font-weight:600; color:var(--text); cursor:pointer; }',
  '.ts-pod-row:hover td { background:var(--surface3); }',
  '.ts-pod-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }',
  '.ts-pod-collapse { font-size:10px; color:var(--text-dim); margin-left:4px; }',
  '.ts-cell { font-family:"JetBrains Mono",monospace; font-size:11px; border-radius:4px; padding:4px 6px; cursor:default; min-width:36px; }',
  '.ts-cell-full { background:rgba(46,213,115,0.15); color:var(--success); font-weight:600; }',
  '.ts-cell-partial { background:var(--warning-dim); color:var(--warning); font-weight:600; }',
  '.ts-cell-over { background:var(--danger-dim); color:var(--danger); font-weight:700; }',
  '.ts-cell-empty { color:var(--text-dim); opacity:0.4; }',
  '.ts-cell-weekend { background:var(--surface2); color:var(--text-dim); opacity:0.3; }',
  '.ts-total { font-family:"JetBrains Mono",monospace; font-size:11px; font-weight:600; }',
  '.ts-total-ok { color:var(--success); }',
  '.ts-total-under { color:var(--warning); }',
  '.ts-total-over { color:var(--danger); }',
  '.ts-util { font-size:10px; color:var(--text-dim); }',
  '.ts-day-today { background:var(--accent-dim); }',
  '.ts-subtotal td { background:var(--surface); font-weight:600; font-family:"JetBrains Mono",monospace; font-size:11px; border-top:2px solid var(--border); }'
].join('\n');

var DOW_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMonday(d) {
  d = new Date(d); d.setHours(0,0,0,0);
  var day = d.getDay(); var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }

function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function fmtShortDate(d) {
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function isToday(d) {
  var t = new Date(); t.setHours(0,0,0,0);
  return d.getTime() === t.getTime();
}

function buildHTML() {
  return '<div class="ts-topbar">' +
    '<div class="ts-topbar-left"></div>' +
    '<div class="ts-topbar-center">' +
      '<button class="btn btn-nav" onclick="tsNavigate(-7)">◀</button>' +
      '<button class="btn" onclick="tsGoToday()">Today</button>' +
      '<div class="date-display" id="tsDateDisplay"></div>' +
      '<button class="btn btn-nav" onclick="tsNavigate(7)">▶</button>' +
    '</div>' +
    '<div class="ts-topbar-right"></div>' +
  '</div>' +
  '<div id="tsKpis" class="ts-kpi-row"></div>' +
  '<div class="ts-grid">' +
    '<table class="ts-table"><thead id="tsThead"></thead><tbody id="tsTbody"></tbody></table>' +
  '</div>';
}

async function loadTimesheetData() {
  var weekEnd = addDays(tsWeekStart, 7);
  var startStr = formatDate(tsWeekStart);
  var endStr = formatDate(weekEnd);

  // Load people (from cache)
  tsPeople = await getCachedPeople();

  // Load bookings for this week
  var records = await qbQuery(TABLES.assignments,
    [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.personName, FIELD.ASSIGN.personPod,
     FIELD.ASSIGN.projectName, FIELD.ASSIGN.start, FIELD.ASSIGN.end, FIELD.ASSIGN.hours],
    '{' + FIELD.ASSIGN.end + '.OAF.' + startStr + '}AND{' + FIELD.ASSIGN.start + '.BF.' + endStr + '}',
    [{fieldId: FIELD.ASSIGN.personName, order: 'ASC'}], 2000);

  tsBookings = (records.records || []).map(function(r) {
    return {
      personKey: String(fv(r, FIELD.ASSIGN.person)),
      personName: fv(r, FIELD.ASSIGN.personName),
      personPod: fv(r, FIELD.ASSIGN.personPod),
      project: fv(r, FIELD.ASSIGN.projectName),
      start: fv(r, FIELD.ASSIGN.start),
      end: fv(r, FIELD.ASSIGN.end),
      hours: parseFloat(fv(r, FIELD.ASSIGN.hours)) || 8
    };
  });
}

function getHoursForDay(personKey, date) {
  var dateStr = formatDate(date);
  var total = 0;
  var projects = [];
  tsBookings.forEach(function(b) {
    if (b.personKey !== personKey) return;
    if (b.start <= dateStr && b.end >= dateStr) {
      total += b.hours;
      projects.push({name: b.project, hours: b.hours});
    }
  });
  return {total: total, projects: projects};
}

var TS_EXCLUDED_PODS = ['Polish office', 'TourBuilder'];

function getFilteredPeople() {
  return tsPeople.filter(function(p) {
    if (TS_EXCLUDED_PODS.indexOf(p.pod) !== -1) return false;
    if (!tsSearch) return true;
    var s = tsSearch.toLowerCase();
    return (p.name && p.name.toLowerCase().indexOf(s) !== -1) ||
           (p.pod && p.pod.toLowerCase().indexOf(s) !== -1);
  });
}

function cellClass(hours, isWeekend) {
  if (isWeekend) return 'ts-cell ts-cell-weekend';
  if (hours === 0) return 'ts-cell ts-cell-empty';
  if (hours > 8) return 'ts-cell ts-cell-over';
  if (hours === 8) return 'ts-cell ts-cell-full';
  return 'ts-cell ts-cell-partial';
}

function cellTitle(info, date) {
  if (!info.projects.length) return '';
  return info.projects.map(function(p) { return p.name + ' (' + p.hours + 'h)'; }).join('\n') + '\n' + fmtShortDate(date);
}

function totalClass(weekTotal, isPartTime) {
  var target = isPartTime ? 20 : 40;
  if (weekTotal >= target) return 'ts-total ts-total-ok';
  if (weekTotal >= target * 0.8) return 'ts-total ts-total-under';
  return 'ts-total ts-total-over';
}

function renderHeader() {
  var el = document.getElementById('tsThead');
  if (!el) return;
  var html = '<tr><th style="text-align:left;min-width:180px">Team Member</th>';
  for (var i = 0; i < 7; i++) {
    var d = addDays(tsWeekStart, i);
    var todayCls = isToday(d) ? ' ts-day-today' : '';
    var weekend = (i >= 5) ? ' style="opacity:0.5"' : '';
    html += '<th class="' + todayCls + '"' + weekend + '>' + DOW_LABELS[i] + '<br>' + d.getDate() + '</th>';
  }
  html += '<th>Total</th><th>Util</th></tr>';
  el.innerHTML = html;
}

function renderGrid() {
  var el = document.getElementById('tsTbody');
  if (!el) return;

  var people = getFilteredPeople();
  var groups = {};
  people.forEach(function(p) {
    var pod = p.pod || 'Unknown';
    if (!groups[pod]) groups[pod] = [];
    groups[pod].push(p);
  });

  var html = '';
  var grandTotals = [0,0,0,0,0,0,0];
  var grandTotal = 0;
  var teamCount = 0;
  var underCount = 0;
  var overCount = 0;

  for (var pod in groups) {
    var members = groups[pod];
    var c = podColor(pod);
    var collapsed = tsCollapsedPods.has(pod);

    // Pod header row
    html += '<tr class="ts-pod-row" onclick="tsTogglePod(\'' + pod.replace(/'/g,"\\'") + '\')">' +
      '<td colspan="10"><span class="ts-pod-dot" style="background:' + c + '"></span>' +
      escapeHtml(pod) + ' (' + members.length + ')' +
      '<span class="ts-pod-collapse">' + (collapsed ? '▶' : '▼') + '</span></td></tr>';

    if (collapsed) continue;

    var podDayTotals = [0,0,0,0,0,0,0];
    var podTotal = 0;

    members.forEach(function(m) {
      var weekTotal = 0;
      html += '<tr><td class="ts-name-cell">' + escapeHtml(m.name) + '</td>';

      for (var i = 0; i < 7; i++) {
        var d = addDays(tsWeekStart, i);
        var isWeekend = (i >= 5);
        var info = getHoursForDay(String(m.tdId), d);
        var hrs = info.total;
        weekTotal += hrs;
        podDayTotals[i] += hrs;
        grandTotals[i] += hrs;

        var cls = cellClass(hrs, isWeekend);
        var title = cellTitle(info, d);
        var todayCls = isToday(d) ? ' ts-day-today' : '';
        html += '<td class="' + todayCls + '"><span class="' + cls + '" title="' + escapeHtml(title) + '">' +
          (hrs > 0 ? hrs : (isWeekend ? '—' : '0')) + '</span></td>';
      }

      var target = m.partTime ? 20 : 40;
      var weekdayTotal = 0;
      for (var j = 0; j < 5; j++) {
        var dd = addDays(tsWeekStart, j);
        weekdayTotal += getHoursForDay(String(m.tdId), dd).total;
      }
      var util = target > 0 ? Math.round((weekdayTotal / target) * 100) : 0;

      podTotal += weekTotal;
      grandTotal += weekTotal;
      teamCount++;
      if (weekdayTotal < target) underCount++;
      if (weekdayTotal > target) overCount++;

      html += '<td class="' + totalClass(weekdayTotal, m.partTime) + '">' + weekdayTotal + 'h</td>';
      html += '<td class="ts-util">' + util + '%</td>';
      html += '</tr>';
    });

    // Pod subtotal row
    html += '<tr class="ts-subtotal"><td style="text-align:right;color:var(--text-dim)">' + escapeHtml(pod) + ' total</td>';
    for (var k = 0; k < 7; k++) {
      html += '<td>' + (podDayTotals[k] > 0 ? podDayTotals[k] : '') + '</td>';
    }
    html += '<td>' + podTotal + 'h</td><td></td></tr>';
  }

  // Grand total row
  html += '<tr class="ts-subtotal" style="border-top:3px solid var(--border)"><td style="text-align:right;font-weight:700;color:var(--text)">TEAM TOTAL</td>';
  for (var g = 0; g < 7; g++) {
    html += '<td style="font-weight:700;color:var(--text)">' + (grandTotals[g] > 0 ? grandTotals[g] : '') + '</td>';
  }
  html += '<td style="font-weight:700;color:var(--text)">' + grandTotal + 'h</td><td></td></tr>';

  el.innerHTML = html;

  // KPIs
  var avgUtil = teamCount > 0 ? Math.round((grandTotal / (teamCount * 40)) * 100) : 0;
  var kpiEl = document.getElementById('tsKpis');
  if (kpiEl) {
    kpiEl.innerHTML =
      '<div class="ts-kpi"><div class="ts-kpi-label">Team Avg Utilization</div><div class="ts-kpi-value" style="color:' + (avgUtil >= 80 ? 'var(--success)' : avgUtil >= 60 ? 'var(--warning)' : 'var(--danger)') + '">' + avgUtil + '%</div></div>' +
      '<div class="ts-kpi"><div class="ts-kpi-label">Total Hours Booked</div><div class="ts-kpi-value" style="color:var(--accent)">' + grandTotal + 'h</div></div>' +
      '<div class="ts-kpi"><div class="ts-kpi-label">Team Members</div><div class="ts-kpi-value">' + teamCount + '</div></div>' +
      '<div class="ts-kpi"><div class="ts-kpi-label">Under 40h</div><div class="ts-kpi-value" style="color:var(--warning)">' + underCount + '</div></div>' +
      '<div class="ts-kpi"><div class="ts-kpi-label">Over 40h</div><div class="ts-kpi-value" style="color:var(--danger)">' + overCount + '</div></div>';
  }
}

function updateDateDisplay() {
  var el = document.getElementById('tsDateDisplay');
  if (!el) return;
  var end = addDays(tsWeekStart, 6);
  el.textContent = fmtShortDate(tsWeekStart) + ' — ' + fmtShortDate(end) + ', ' + end.getFullYear();
}

// ─── NAVIGATION ──────────────────────────────────────────────
window.tsNavigate = function(days) {
  tsWeekStart = addDays(tsWeekStart, days);
  updateDateDisplay();
  renderHeader();
  loadTimesheetData().then(renderGrid);
};

window.tsGoToday = function() {
  tsWeekStart = getMonday(new Date());
  updateDateDisplay();
  renderHeader();
  loadTimesheetData().then(renderGrid);
};

window.tsTogglePod = function(pod) {
  if (tsCollapsedPods.has(pod)) tsCollapsedPods.delete(pod);
  else tsCollapsedPods.add(pod);
  renderGrid();
};

// ─── REGISTER TAB ────────────────────────────────────────────
registerTab('timesheets', {
  icon: '⏱', label: 'Timesheets',
  roles: ALL_ROLES,
  onInit: function() {
    var style = document.createElement('style');
    style.textContent = tsCSS;
    document.head.appendChild(style);

    tsWeekStart = getMonday(new Date());
    document.getElementById('tab-timesheets').innerHTML = buildHTML();
  },
  onActivate: async function() {
    window.onAppSearch = function(v) { tsSearch = v.trim(); renderGrid(); };
    updateDateDisplay();
    renderHeader();
    document.getElementById('tsTbody').innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:40px">Loading timesheets...</td></tr>';
    await loadTimesheetData();
    renderGrid();
  }
});

})();
