// ═══════════════════════════════════════════════════════════════
// Vacations Tab — Monthly calendar + request workflow
// ═══════════════════════════════════════════════════════════════
(function() {

var vPeople = [];
var vVacations = [];
var vBookings = [];
var vMonthStart = null;
var vCollapsedPods = new Set();
var vSearch = '';
var vPtoBalances = {};

var EXCLUDED_PODS = ['Polish office', 'TourBuilder'];

var vacCSS = [
  '.vac-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--border); flex-shrink:0; gap:12px; }',
  '.vac-topbar-center { display:flex; align-items:center; gap:8px; }',
  '.vac-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; padding:12px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
  '.vac-kpi { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; }',
  '.vac-kpi-label { font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; }',
  '.vac-kpi-value { font-size:20px; font-weight:700; margin-top:2px; }',
  '.vac-grid { flex:1; overflow:auto; min-height:0; }',
  '.vac-table { width:100%; border-collapse:collapse; font-size:12px; }',
  '.vac-table th { padding:6px 4px; font-size:9px; font-weight:600; color:var(--text-dim); text-transform:uppercase; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:5; text-align:center; min-width:26px; }',
  '.vac-table th.vac-name-th { text-align:left; min-width:160px; padding-left:10px; }',
  '.vac-table td { padding:3px 2px; text-align:center; border-bottom:1px solid var(--border); }',
  '.vac-name-cell { text-align:left !important; padding-left:10px !important; font-weight:500; color:var(--text); white-space:nowrap; }',
  '.vac-pod-row td { background:var(--surface2); font-weight:600; color:var(--text); cursor:pointer; }',
  '.vac-pod-row:hover td { background:var(--surface3); }',
  '.vac-pod-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }',
  '.vac-cell { width:22px; height:22px; border-radius:3px; display:inline-block; cursor:default; }',
  '.vac-cell-empty { background:transparent; }',
  '.vac-cell-weekend { background:var(--surface2); opacity:0.3; }',
  '.vac-cell-vacation { background:var(--danger); opacity:0.8; }',
  '.vac-cell-vacation-pending { background:var(--warning); opacity:0.7; }',
  '.vac-cell-sick { background:#cc5de8; opacity:0.8; }',
  '.vac-cell-today { box-shadow:inset 0 0 0 2px var(--accent); }',
  '.vac-cell-booked { background:var(--accent); opacity:0.3; }',
  '.vac-legend { display:flex; gap:16px; padding:8px 20px; border-top:1px solid var(--border); flex-shrink:0; font-size:11px; color:var(--text-dim); align-items:center; }',
  '.vac-legend-dot { width:12px; height:12px; border-radius:2px; display:inline-block; margin-right:4px; vertical-align:middle; }',
  '.vac-avail { font-family:"JetBrains Mono",monospace; font-size:11px; font-weight:600; }',
  '.vac-avail-full { color:var(--success); }',
  '.vac-avail-partial { color:var(--warning); }',
  '.vac-avail-none { color:var(--danger); }'
].join('\n');

function getFirstOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getDaysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var DOW_SHORT = ['S','M','T','W','T','F','S'];

function isToday(y, m, day) {
  var t = new Date(); t.setHours(0,0,0,0);
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === day;
}

function isWeekend(y, m, day) {
  var d = new Date(y, m, day);
  return d.getDay() === 0 || d.getDay() === 6;
}

function buildHTML() {
  return '<div class="vac-topbar">' +
    '<div></div>' +
    '<div class="vac-topbar-center">' +
      '<button class="btn btn-nav" onclick="vacNav(-1)">◀</button>' +
      '<button class="btn" onclick="vacToday()">Today</button>' +
      '<div class="date-display" id="vacDateDisplay"></div>' +
      '<button class="btn btn-nav" onclick="vacNav(1)">▶</button>' +
    '</div>' +
    '<div><button class="btn btn-primary" onclick="vacNewRequest()">+ Vacation Request</button></div>' +
  '</div>' +
  '<div id="vacKpis" class="vac-kpi-row"></div>' +
  '<div class="vac-grid">' +
    '<table class="vac-table"><thead id="vacThead"></thead><tbody id="vacTbody"></tbody></table>' +
  '</div>' +
  '<div class="vac-legend">' +
    '<span><span class="vac-legend-dot" style="background:var(--danger)"></span> Vacation</span>' +
    '<span><span class="vac-legend-dot" style="background:var(--warning)"></span> Pending</span>' +
    '<span><span class="vac-legend-dot" style="background:#cc5de8"></span> Sick</span>' +
    '<span><span class="vac-legend-dot" style="background:var(--accent);opacity:0.3"></span> Booked</span>' +
    '<span><span class="vac-legend-dot" style="background:transparent;box-shadow:inset 0 0 0 2px var(--accent)"></span> Today</span>' +
  '</div>';
}

async function loadVacData() {
  var daysInMonth = getDaysInMonth(vMonthStart);
  var startStr = formatDate(vMonthStart);
  var endStr = formatDate(new Date(vMonthStart.getFullYear(), vMonthStart.getMonth(), daysInMonth + 1));

  vPeople = await getCachedPeople();

  // Load vacations for this month
  var vacResult = await qbQuery(TABLES.vacations,
    [FIELD.VACATION.id, FIELD.VACATION.person, FIELD.VACATION.personName, FIELD.VACATION.personPod,
     FIELD.VACATION.personTdId, FIELD.VACATION.start, FIELD.VACATION.end, FIELD.VACATION.type,
     FIELD.VACATION.status, FIELD.VACATION.notes],
    '{' + FIELD.VACATION.end + '.OAF.' + startStr + '}AND{' + FIELD.VACATION.start + '.BF.' + endStr + '}',
    [{fieldId: FIELD.VACATION.start, order: 'ASC'}], 500);

  vVacations = (vacResult.records || []).map(function(r) {
    return {
      id: fv(r, FIELD.VACATION.id),
      personKey: String(fv(r, FIELD.VACATION.person) || fv(r, FIELD.VACATION.personTdId)),
      personName: fv(r, FIELD.VACATION.personName),
      personPod: fv(r, FIELD.VACATION.personPod),
      start: fv(r, FIELD.VACATION.start),
      end: fv(r, FIELD.VACATION.end),
      type: fv(r, FIELD.VACATION.type),
      status: fv(r, FIELD.VACATION.status),
      notes: fv(r, FIELD.VACATION.notes)
    };
  });

  // Load PTO balances (current year)
  try {
    var ptoResult = await qbQuery(TABLES.ptoBalances,
      [FIELD.PTO.id, FIELD.PTO.year, FIELD.PTO.allocation, FIELD.PTO.used,
       FIELD.PTO.pending, FIELD.PTO.personTdId, FIELD.PTO.personName],
      '{' + FIELD.PTO.year + '.EX.2026}',
      [{fieldId: FIELD.PTO.personName, order: 'ASC'}], 100);
    vPtoBalances = {};
    (ptoResult.records || []).forEach(function(r) {
      var tdId = String(fv(r, FIELD.PTO.personTdId));
      vPtoBalances[tdId] = {
        name: fv(r, FIELD.PTO.personName),
        allocation: parseFloat(fv(r, FIELD.PTO.allocation)) || 160,
        used: parseFloat(fv(r, FIELD.PTO.used)) || 0,
        pending: parseFloat(fv(r, FIELD.PTO.pending)) || 0
      };
    });
  } catch(e) { console.warn('[Vacations] Could not load PTO balances:', e); }

  // Load bookings for this month (for available hours calc)
  var bookResult = await qbQuery(TABLES.assignments,
    [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.start, FIELD.ASSIGN.end, FIELD.ASSIGN.hours],
    '{' + FIELD.ASSIGN.end + '.OAF.' + startStr + '}AND{' + FIELD.ASSIGN.start + '.BF.' + endStr + '}',
    [{fieldId: FIELD.ASSIGN.start, order: 'ASC'}], 2000);

  vBookings = (bookResult.records || []).map(function(r) {
    return {
      personKey: String(fv(r, FIELD.ASSIGN.person)),
      start: fv(r, FIELD.ASSIGN.start),
      end: fv(r, FIELD.ASSIGN.end),
      hours: parseFloat(fv(r, FIELD.ASSIGN.hours)) || 8
    };
  });
}

function getVacationForDay(personTdId, dateStr) {
  var key = String(personTdId);
  for (var i = 0; i < vVacations.length; i++) {
    var v = vVacations[i];
    if (v.personKey === key && v.start <= dateStr && v.end >= dateStr) {
      return v;
    }
  }
  return null;
}

function isBookedOnDay(personTdId, dateStr) {
  var key = String(personTdId);
  for (var i = 0; i < vBookings.length; i++) {
    var b = vBookings[i];
    if (b.personKey === key && b.start <= dateStr && b.end >= dateStr) return true;
  }
  return false;
}

function getFilteredPeople() {
  return vPeople.filter(function(p) {
    if (EXCLUDED_PODS.indexOf(p.pod) !== -1) return false;
    if (!vSearch) return true;
    var s = vSearch.toLowerCase();
    return (p.name && p.name.toLowerCase().indexOf(s) !== -1) ||
           (p.pod && p.pod.toLowerCase().indexOf(s) !== -1);
  });
}

function renderHeader() {
  var el = document.getElementById('vacThead');
  if (!el) return;
  var y = vMonthStart.getFullYear(), m = vMonthStart.getMonth();
  var days = getDaysInMonth(vMonthStart);
  var today = new Date(); today.setHours(0,0,0,0);

  var html = '<tr><th class="vac-name-th">Team Member</th><th style="min-width:55px">Used</th><th style="min-width:55px">Left</th>';
  for (var d = 1; d <= days; d++) {
    var dow = new Date(y, m, d).getDay();
    var todayCls = isToday(y, m, d) ? ' style="background:var(--accent-dim)"' : '';
    var we = (dow === 0 || dow === 6) ? ' style="opacity:0.4"' : '';
    html += '<th' + (todayCls || we) + '>' + d + '</th>';
  }
  html += '</tr>';
  el.innerHTML = html;
}

function renderGrid() {
  var el = document.getElementById('vacTbody');
  if (!el) return;
  var people = getFilteredPeople();
  var y = vMonthStart.getFullYear(), m = vMonthStart.getMonth();
  var days = getDaysInMonth(vMonthStart);

  var groups = {};
  people.forEach(function(p) {
    var pod = p.pod || 'Unknown';
    if (!groups[pod]) groups[pod] = [];
    groups[pod].push(p);
  });

  var html = '';
  var totalWorkDays = 0;
  var totalVacDays = 0;
  var pendingCount = 0;
  var onVacNow = 0;
  var todayStr = formatDate(new Date());

  // Count work days in month
  for (var wd = 1; wd <= days; wd++) {
    if (!isWeekend(y, m, wd)) totalWorkDays++;
  }

  for (var pod in groups) {
    var members = groups[pod];
    var c = podColor(pod);
    var collapsed = vCollapsedPods.has(pod);

    html += '<tr class="vac-pod-row" onclick="vacTogglePod(\'' + pod.replace(/'/g, "\\'") + '\')">' +
      '<td colspan="' + (days + 3) + '"><span class="vac-pod-dot" style="background:' + c + '"></span>' +
      escapeHtml(pod) + ' (' + members.length + ')' +
      '<span style="font-size:10px;color:var(--text-dim);margin-left:4px">' + (collapsed ? '▶' : '▼') + '</span></td></tr>';

    if (collapsed) continue;

    members.forEach(function(p) {
      var vacDays = 0;
      var personTarget = p.partTime ? (totalWorkDays * 4) : (totalWorkDays * 8);

            // PTO balance cells (next to name)
      var pto = vPtoBalances[String(p.tdId)] || null;
      var ptoCellsHtml = '';
      if (pto) {
        var remaining = pto.allocation - pto.used - pto.pending;
        var usedPct = pto.allocation > 0 ? (pto.used / pto.allocation) : 0;
        var usedCls = usedPct >= 1 ? 'vac-avail-none' : usedPct >= 0.7 ? 'vac-avail-partial' : 'vac-avail-full';
        var remCls = remaining <= 0 ? 'vac-avail-none' : remaining <= 40 ? 'vac-avail-partial' : 'vac-avail-full';
        ptoCellsHtml = '<td class="vac-avail ' + usedCls + '">' + pto.used + (pto.pending ? '+' + pto.pending : '') + 'h</td>' +
          '<td class="vac-avail ' + remCls + '">' + remaining + 'h</td>';
      } else {
        ptoCellsHtml = '<td class="vac-avail" style="opacity:0.3">—</td><td class="vac-avail" style="opacity:0.3">—</td>';
      }

      html += '<tr><td class="vac-name-cell">' + escapeHtml(p.name) + '</td>' + ptoCellsHtml;
      for (var d = 1; d <= days; d++) {
        var dateStr = formatDate(new Date(y, m, d));
        var we = isWeekend(y, m, d);
        var today = isToday(y, m, d);
        var vac = getVacationForDay(p.tdId, dateStr);
        var booked = !vac && isBookedOnDay(p.tdId, dateStr);

        var cls = 'vac-cell';
        var title = '';
        if (we) {
          cls += ' vac-cell-weekend';
        } else if (vac) {
          if (vac.status === 'Pending') {
            cls += ' vac-cell-vacation-pending';
            pendingCount++;
          } else if (vac.type === 'Sick') {
            cls += ' vac-cell-sick';
          } else {
            cls += ' vac-cell-vacation';
          }
          title = (vac.type || 'Vacation') + ' (' + vac.status + ')';
          if (!we) vacDays++;
          if (dateStr === todayStr) onVacNow++;
        } else if (booked) {
          cls += ' vac-cell-booked';
          title = 'Booked';
        } else {
          cls += ' vac-cell-empty';
        }
        if (today) cls += ' vac-cell-today';

        html += '<td><span class="' + cls + '" title="' + escapeHtml(title) + '"></span></td>';
      }

      totalVacDays += vacDays;
      html += '</tr>';
    });
  }

  el.innerHTML = html;

  // Unique people on vacation today
  var vacToday = new Set();
  vVacations.forEach(function(v) {
    if (v.start <= todayStr && v.end >= todayStr && v.status === 'Approved') {
      vacToday.add(v.personKey);
    }
  });

  // Unique pending
  var pendingSet = new Set();
  vVacations.forEach(function(v) { if (v.status === 'Pending') pendingSet.add(v.id); });

  var kpiEl = document.getElementById('vacKpis');
  if (kpiEl) {
    var teamSize = people.length;
    var availToday = teamSize - vacToday.size;
    kpiEl.innerHTML =
      '<div class="vac-kpi"><div class="vac-kpi-label">Available Today</div><div class="vac-kpi-value" style="color:var(--success)">' + availToday + '/' + teamSize + '</div></div>' +
      '<div class="vac-kpi"><div class="vac-kpi-label">On Vacation Today</div><div class="vac-kpi-value" style="color:var(--danger)">' + vacToday.size + '</div></div>' +
      '<div class="vac-kpi"><div class="vac-kpi-label">Pending Requests</div><div class="vac-kpi-value" style="color:var(--warning)">' + pendingSet.size + '</div></div>' +
      '<div class="vac-kpi"><div class="vac-kpi-label">Vacation Days This Month</div><div class="vac-kpi-value">' + totalVacDays + '</div></div>' +
      '<div class="vac-kpi"><div class="vac-kpi-label">Work Days in Month</div><div class="vac-kpi-value">' + totalWorkDays + '</div></div>';

    // PTO summary
    var totalAlloc = 0, totalUsed = 0, totalPending = 0, ptoCount = 0;
    for (var k in vPtoBalances) {
      var b = vPtoBalances[k];
      totalAlloc += b.allocation;
      totalUsed += b.used;
      totalPending += b.pending;
      ptoCount++;
    }
    var lowPto = 0;
    for (var k2 in vPtoBalances) {
      var b2 = vPtoBalances[k2];
      if ((b2.allocation - b2.used - b2.pending) <= 24) lowPto++;
    }
    if (ptoCount > 0) {
      kpiEl.innerHTML +=
        '<div class="vac-kpi"><div class="vac-kpi-label">Team PTO Used (2026)</div><div class="vac-kpi-value" style="color:var(--accent)">' + totalUsed + 'h</div></div>' +
        '<div class="vac-kpi"><div class="vac-kpi-label">Low PTO (≤24h left)</div><div class="vac-kpi-value" style="color:' + (lowPto > 0 ? 'var(--danger)' : 'var(--success)') + '">' + lowPto + '</div></div>';
    }
  }
}

function updateDateDisplay() {
  var el = document.getElementById('vacDateDisplay');
  if (el) el.textContent = MONTH_NAMES[vMonthStart.getMonth()] + ' ' + vMonthStart.getFullYear();
}

// ─── VACATION REQUEST FORM ──────────────────────────────────
function newRequest() {
  var overlay = document.getElementById('vacModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vacModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.classList.remove('visible'); };
    overlay.innerHTML = '<div class="modal-content" id="vacModalContent"></div>';
    document.body.appendChild(overlay);
  }

  var content = document.getElementById('vacModalContent');
  content.innerHTML =
    '<div style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text)">New Vacation Request</div>' +
    '<div class="form-group"><label class="form-label">Person</label><select class="form-select" id="vacFldPerson">' +
      '<option value="">Select person...</option>' +
      vPeople.filter(function(p) { return EXCLUDED_PODS.indexOf(p.pod) === -1; }).map(function(p) {
        return '<option value="' + p.tdId + '" data-name="' + escapeHtml(p.name) + '" data-pod="' + escapeHtml(p.pod) + '" data-email="' + escapeHtml(p.email || '') + '">' + escapeHtml(p.name) + ' (' + escapeHtml(p.pod) + ')</option>';
      }).join('') +
    '</select></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="vacFldStart"></div>' +
      '<div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="vacFldEnd"></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label class="form-label">Type</label><select class="form-select" id="vacFldType">' +
        '<option value="Vacation">Vacation</option><option value="Sick">Sick</option>' +
        '<option value="Personal">Personal</option><option value="Holiday">Holiday</option>' +
        '<option value="Other">Other</option></select></div>' +
      '<div class="form-group"><label class="form-label">Status</label><select class="form-select" id="vacFldStatus">' +
        '<option value="Pending">Pending</option><option value="Approved">Approved</option>' +
        '<option value="Denied">Denied</option></select></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="vacFldNotes" rows="2"></textarea></div>' +
    '<div id="vacConflicts" style="margin-top:8px"></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
      '<button class="btn" onclick="document.getElementById(\'vacModalOverlay\').classList.remove(\'visible\')">Cancel</button>' +
      '<button class="btn btn-primary" onclick="vacSaveRequest()">Save Request</button>' +
    '</div>';

  // Wire up conflict check on date/person change
  ['vacFldPerson','vacFldStart','vacFldEnd'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', vacCheckConflicts);
  });

  document.getElementById('vacFldStart').value = formatDate(new Date());
  document.getElementById('vacFldEnd').value = formatDate(new Date());
  overlay.classList.add('visible');
}

function vacCheckConflicts() {
  var person = document.getElementById('vacFldPerson').value;
  var start = document.getElementById('vacFldStart').value;
  var end = document.getElementById('vacFldEnd').value;
  var el = document.getElementById('vacConflicts');
  if (!el || !person || !start || !end) { if (el) el.innerHTML = ''; return; }

  // Check bookings that overlap
  var conflicts = vBookings.filter(function(b) {
    return b.personKey === person && b.start <= end && b.end >= start;
  });

  if (conflicts.length > 0) {
    el.innerHTML = '<div style="padding:8px 12px;background:var(--danger-dim);border:1px solid var(--danger);border-radius:6px;font-size:12px;color:var(--danger);font-weight:600">' +
      '⚠ This person has ' + conflicts.length + ' booking(s) during this period. Approving this vacation will conflict with scheduled work.</div>';
  } else {
    el.innerHTML = '<div style="padding:8px 12px;background:var(--success-dim);border:1px solid var(--success);border-radius:6px;font-size:12px;color:var(--success)">✓ No booking conflicts</div>';
  }
}

async function saveRequest() {
  var personEl = document.getElementById('vacFldPerson');
  var person = personEl.value;
  var start = document.getElementById('vacFldStart').value;
  var end = document.getElementById('vacFldEnd').value;
  var type = document.getElementById('vacFldType').value;
  var status = document.getElementById('vacFldStatus').value;
  var notes = document.getElementById('vacFldNotes').value;

  if (!person || !start || !end) {
    showToast('Person, Start and End dates are required', 'warning');
    return;
  }

  var sel = personEl.options[personEl.selectedIndex];
  var record = {};
  record[FIELD.VACATION.person] = {value: person};
  record[FIELD.VACATION.personTdId] = {value: person};
  record[FIELD.VACATION.start] = {value: start};
  record[FIELD.VACATION.end] = {value: end};
  record[FIELD.VACATION.type] = {value: type};
  record[FIELD.VACATION.status] = {value: status};
  record[FIELD.VACATION.notes] = {value: notes};

  try {
    await qbUpsert(TABLES.vacations, [record]);
    document.getElementById('vacModalOverlay').classList.remove('visible');
    showToast('Vacation request saved', 'success');
    invalidateCache('vacations');
    await loadVacData();
    renderGrid();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ─── NAVIGATION ──────────────────────────────────────────────
window.vacNav = function(dir) {
  vMonthStart = addMonths(vMonthStart, dir);
  updateDateDisplay();
  renderHeader();
  loadVacData().then(renderGrid);
};

window.vacToday = function() {
  vMonthStart = getFirstOfMonth(new Date());
  updateDateDisplay();
  renderHeader();
  loadVacData().then(renderGrid);
};

window.vacTogglePod = function(pod) {
  if (vCollapsedPods.has(pod)) vCollapsedPods.delete(pod);
  else vCollapsedPods.add(pod);
  renderGrid();
};

window.vacNewRequest = newRequest;
window.vacSaveRequest = saveRequest;

// ─── REGISTER TAB ────────────────────────────────────────────
registerTab('vacations', {
  icon: '🌴', label: 'Vacations',
  roles: ALL_ROLES,
  onInit: function() {
    var style = document.createElement('style');
    style.textContent = vacCSS;
    document.head.appendChild(style);
    vMonthStart = getFirstOfMonth(new Date());
    document.getElementById('tab-vacations').innerHTML = buildHTML();
  },
  onActivate: async function() {
    window.onAppSearch = function(v) { vSearch = v.trim(); renderGrid(); };
    updateDateDisplay();
    renderHeader();
    document.getElementById('vacTbody').innerHTML = '<tr><td colspan="35" style="text-align:center;color:var(--text-dim);padding:40px">Loading vacations...</td></tr>';
    await loadVacData();
    renderGrid();
  }
});

})();
