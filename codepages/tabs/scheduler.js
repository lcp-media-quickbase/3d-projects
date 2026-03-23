// ═══════════════════════════════════════════════════════════════
// Scheduler Tab — Gantt Resource Calendar
// ═══════════════════════════════════════════════════════════════

(function() {

// ─── TAB-LOCAL STATE ──────────────────────────────────────────
var viewStart = getMonday(new Date());
var viewDays = 14;
var currentView = 'week';
var sPeople = [];
var sProjects = [];
var sAssignments = [];
var sVacations = [];
var activePods = new Set();
var collapsedPods = new Set();
var searchQuery = '';
var sMilestones = [];
var _dragState = null;
var _dragJustFinished = false;

// ─── CSS (injected once) ──────────────────────────────────────
var schedulerCSS = `
  .milestone-row { height:24px; position:relative; box-sizing:border-box; border-bottom:1px solid var(--border); }
  .milestone-bar { position:absolute; top:3px; height:18px; border-radius:3px; font-size:9px; font-weight:600; color:#fff; display:flex; align-items:center; padding:0 6px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; z-index:2; opacity:0.85; cursor:default; letter-spacing:0.2px; }
  .milestone-bar:hover { opacity:1; filter:brightness(1.1); }
  .milestone-label { height:24px; display:flex; align-items:center; padding:0 14px; font-size:10px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid var(--border); background:var(--surface); }

  :root { --cell-w: 54px; --row-h: 36px; --row-line: rgba(255,255,255,0.06); }
  [data-theme='light'] { --row-line: rgba(0,0,0,0.06); }
  .sched-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--border); flex-shrink:0; gap:12px; flex-wrap:wrap; }
  .sched-topbar-left { display:flex; align-items:center; gap:12px; }
  .sched-topbar-center { display:flex; align-items:center; gap:8px; }
  .sched-topbar-right { display:flex; align-items:center; gap:10px; }

  .scheduler-layout { display:flex; flex:1; overflow:hidden; }
  .resource-panel { width:220px; min-width:180px; border-right:1px solid var(--border); display:flex; flex-direction:column; background:var(--surface); flex-shrink:0; }
  .resource-header { height:52px; padding:8px 14px; border-bottom:1px solid var(--border); font-size:11px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.8px; box-sizing:border-box; flex-shrink:0; }
  .search-input { width:100%; margin-top:6px; padding:5px 8px; background:var(--surface2); border:1px solid var(--border); border-radius:5px; color:var(--text); font-size:12px; font-family:inherit; outline:none; box-sizing:border-box; text-transform:none; letter-spacing:normal; font-weight:400; }
  .search-input:focus { border-color:var(--accent); }
  .search-input::placeholder { color:var(--text-dim); }
  .resource-list { flex:1; overflow-y:auto; overflow-x:hidden; }

  .pod-group { }
  .pod-header-label { height:var(--row-h); display:flex; align-items:center; padding:0 14px; gap:8px; cursor:pointer; font-size:12px; font-weight:600; user-select:none; }
  .pod-header-label:hover { background:var(--surface2); }
  .pod-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .pod-count { font-size:10px; color:var(--text-dim); font-weight:400; }
  .pod-collapse { font-size:10px; color:var(--text-dim); margin-left:auto; }

  .person-row { height:var(--row-h); display:flex; align-items:center; padding:0 14px 0 28px; gap:8px; font-size:12px; color:var(--text-muted); border-bottom:1px solid var(--row-line); }
  .person-avatar { width:22px; height:22px; border-radius:50%; background:var(--accent-dim); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:var(--accent); flex-shrink:0; }

  .timeline-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .timeline-header { height:52px; display:flex; flex-direction:column; justify-content:flex-end; border-bottom:1px solid var(--border); background:var(--surface); overflow:hidden; flex-shrink:0; }
  .timeline-months { display:flex; height:22px; align-items:center; border-bottom:1px solid rgba(42,45,58,0.5); }
  .month-label { font-size:11px; font-weight:600; color:var(--text-dim); padding-left:8px; white-space:nowrap; overflow:hidden; }
  .timeline-days { display:flex; height:30px; align-items:stretch; }
  .day-cell { display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:10px; color:var(--text-dim); border-right:1px solid rgba(42,45,58,0.3); box-sizing:border-box; }
  .day-cell.weekend { background:rgba(255,255,255,0.02); }
  .day-cell.today { background:var(--accent-dim); color:var(--accent); font-weight:700; }
  .day-num { font-size:11px; }
  .day-dots { display:flex; gap:1px; margin-top:1px; }
  .day-dot { width:3px; height:3px; border-radius:50%; }

  .timeline-body { flex:1; overflow:auto; position:relative; }
  .timeline-grid { position:relative; min-height:100%; }
  .grid-col { position:absolute; top:0; bottom:0; border-right:1px solid var(--border); box-sizing:border-box; }
  .grid-col.weekend { background:rgba(255,255,255,0.015); }
  .grid-col.today { background:var(--accent-dim); }

  .timeline-row { height:var(--row-h); position:relative; box-sizing:border-box; border-bottom:1px solid var(--row-line); }
  .timeline-row.pod-header-row { border-bottom:none; }

  .gantt-bar { position:absolute; top:4px; height:calc(var(--row-h) - 8px); border-radius:4px; font-size:10px; color:#fff; display:flex; align-items:center; overflow:hidden; white-space:nowrap; padding:0; text-shadow:0 1px 2px rgba(0,0,0,0.3); z-index:2; }
  .bar-handle { width:5px; min-width:5px; height:100%; cursor:ew-resize; opacity:0; transition:opacity 0.15s; }
  .bar-handle-l { border-radius:4px 0 0 4px; }
  .bar-handle-r { border-radius:0 4px 4px 0; }
  .gantt-bar:hover .bar-handle { opacity:1; background:rgba(255,255,255,0.25); }
  .bar-text { flex:1; cursor:grab; user-select:none; padding:0 6px; overflow:hidden; text-overflow:ellipsis; }
  .bar-text:active { cursor:grabbing; }
  .gantt-bar:hover { filter:brightness(1.15); z-index:3; }
  .gantt-bar.high { box-shadow:0 0 0 1.5px var(--danger); }
  .gantt-bar.weekend-bar { opacity:0.5; }

  .vacation-bar { background:repeating-linear-gradient(45deg, var(--danger-dim), var(--danger-dim) 4px, transparent 4px, transparent 8px) !important; border:1px dashed var(--danger) !important; color:var(--danger) !important; opacity:0.8; cursor:default !important; pointer-events:none; }
  .vacation-bar .bar-text { font-size:10px; font-weight:600; text-shadow:none !important; }

  .btn-danger { background:var(--danger-dim); color:var(--danger); border-color:var(--danger); }
  .btn-danger:hover { background:var(--danger); color:#fff; }

  .now-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--danger);
    z-index: 3;
    pointer-events: none;
    opacity: 0.7;
  }
  .now-line::after {
    content: '';
    position: absolute;
    top: 0;
    left: -3px;
    width: 8px;
    height: 8px;
    background: var(--danger);
    border-radius: 50%;
  }
  #tooltip { position:fixed; z-index:100; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:10px 14px; font-size:12px; color:var(--text); pointer-events:none; box-shadow:0 8px 30px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.15s; max-width:280px; }
  #tooltip.visible { opacity:1; }
  #tooltip .tip-title { font-weight:600; margin-bottom:4px; }
  #tooltip .tip-row { color:var(--text-muted); font-size:11px; margin-top:2px; }
`;

// ─── HTML TEMPLATE ────────────────────────────────────────────
function buildHTML() {
  return `
    <div class="sched-topbar">
      <div class="sched-topbar-left">
        <div class="filter-pills" id="podFilters"></div>
      </div>
      <div class="sched-topbar-center">
        <button class="btn btn-nav" onclick="schedNavigate(-7)">◀</button>
        <button class="btn" onclick="schedGoToday()">Today</button>
        <div class="date-display" id="dateDisplay"></div>
        <button class="btn btn-nav" onclick="schedNavigate(7)">▶</button>
      </div>
      <div class="sched-topbar-right">
        <div class="btn-group">
          <button class="btn btn-active" id="btnWeek" onclick="schedSetView('week')">2 Weeks</button>
          <button class="btn" id="btnMonth" onclick="schedSetView('month')">Month</button>
        </div>
        <button class="btn btn-primary" onclick="schedNewAssignment()">+ Booking</button>
        <button class="btn" onclick="schedNewMilestone()" style="font-size:11px">+ Milestone</button>
      </div>
    </div>
    <div class="scheduler-layout">
      <div class="resource-panel">
        <div class="resource-header" style="display:flex;align-items:center;justify-content:space-between"><span>Team Members</span><span style="display:flex;gap:2px"><button onclick="schedExpandAll()" title="Expand all" style="border:none;background:none;cursor:pointer;color:var(--text-dim);font-size:14px;padding:2px 4px">▼</button><button onclick="schedCollapseAll()" title="Collapse all" style="border:none;background:none;cursor:pointer;color:var(--text-dim);font-size:14px;padding:2px 4px">▲</button></span></div>
        <div class="resource-list" id="resourceList"></div>
      </div>
      <div class="timeline-panel">
        <div class="timeline-header">
          <div class="timeline-months" id="timelineMonths"></div>
          <div class="timeline-days" id="timelineDays"></div>
        </div>
        <div class="timeline-body" id="timelineBody">
          <div class="timeline-grid" id="timelineGrid"></div>
        </div>
      </div>
    </div>
    <div id="tooltip"></div>
    <div id="modalOverlay" class="modal-overlay">
      <div class="modal-content">
        <div id="modalTitle" style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text)">New Booking</div>
        <input type="hidden" id="fldRecordId" value="">
        <div class="form-group"><label class="form-label">Person</label><select class="form-select" id="fldPerson"></select></div>
        <div class="form-group"><label class="form-label">Project</label><div style="display:flex;gap:6px"><select class="form-select" id="fldProject" style="flex:1"></select><button type="button" class="btn" onclick="openProjectDetail(document.getElementById('fldProject').value)" style="flex-shrink:0;padding:6px 10px;font-size:11px" title="View project details">Details</button></div></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="fldStart"></div>
          <div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="fldEnd"></div>
          <div class="form-group"><label class="form-label">Hours/Day</label><input class="form-input" type="number" id="fldHours" value="8" min="1" max="24" step="0.5"></div>
        </div>
        <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="fldDesc" rows="2"></textarea></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
          <button class="btn btn-danger" id="btnDelete" onclick="schedDeleteAssignment()" style="display:none">Delete</button>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn" onclick="schedCloseModal()">Cancel</button>
            <button class="btn btn-primary" onclick="schedSaveAssignment()">Save Booking</button>
          </div>
        </div>
      </div>
    </div>`;
}

// ─── RENDERING ────────────────────────────────────────────────
function getVisiblePeople() {
  return sPeople.filter(function(p) {
    if (!activePods.has(p.pod)) return false;
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    var pa = sAssignments.filter(function(a) { return a.personKey === String(p.tdId); });
    return pa.some(function(a) {
      return (a.projectName && a.projectName.toLowerCase().includes(q)) ||
             (a.projectNum && String(a.projectNum).includes(q));
    });
  });
}

function getGroupedPeople() {
  var groups = {};
  getVisiblePeople().forEach(function(p) { (groups[p.pod] = groups[p.pod] || []).push(p); });
  return groups;
}

function renderPodFilters() {
  var pods = []; var seen = {};
  sPeople.forEach(function(p) { if (!seen[p.pod]) { seen[p.pod]=true; pods.push(p.pod); } });
  var pf = document.getElementById('podFilters'); if (!pf) return;
  pf.innerHTML = pods.map(function(pod) {
    var c = podColor(pod), active = activePods.has(pod);
    return '<button class="pill '+(active?'active':'')+'" onclick="schedTogglePod(\''+pod+'\')" style="'+(active?'border-color:'+c+';color:'+c+';background:'+c+'22':'')+'">'+pod.replace(' POD','')+'</button>';
  }).join('');
}

function renderResourcePanel() {

  var groups = getGroupedPeople();
  var html = '';
  for (var pod in groups) {
    var members = groups[pod];
    var c = podColor(pod);
    var collapsed = collapsedPods.has(pod);
    html += '<div class="pod-group">';
    html += '<div class="pod-header-label" onclick="schedToggleCollapse(\''+pod+'\')">';
    html += '<div class="pod-dot" style="background:'+c+'"></div>';
    html += '<span>'+escapeHtml(pod.replace(' POD','').toUpperCase())+' POD</span>';
    html += '<span class="pod-count">('+members.length+')</span>';
    html += '<span class="pod-collapse">'+(collapsed?'▶':'▼')+'</span></div>';
    if (!collapsed) {
      // Milestone label for this pod
      var podMs = sMilestones.filter(function(ms) { return ms.pod === pod; });
      if (podMs.length > 0) {
        html += '<div class="milestone-label" style="height:24px;display:flex;align-items:center;padding:0 14px;font-size:9px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid var(--border)">Milestones (' + podMs.length + ')</div>';
      }
      members.forEach(function(m) {
        var initials = m.name.split(' ').map(function(n){return n[0]||'';}).join('').substring(0,2);
        html += '<div class="person-row"><div class="person-avatar" style="background:'+c+'22;color:'+c+'">'+initials+'</div><span>'+escapeHtml(m.name)+'</span></div>';
      });
    }
    html += '</div>';
  }
  var rl = document.getElementById('resourceList'); if (rl) rl.innerHTML = html;
}

function renderTimelineHeader() {
  var cellW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-w'));
  var mHtml = '', dHtml = '';
  var curMonth = -1;
  for (var i=0; i<viewDays; i++) {
    var d = addDays(viewStart, i);
    var m = d.getMonth(), dow = d.getDay();
    if (m !== curMonth) {
      mHtml += '<div class="month-label" style="flex:1">'+MONTHS_FULL[m]+' '+d.getFullYear()+'</div>';
      curMonth = m;
    }
    var cls = 'day-cell';
    if (dow===0||dow===6) cls += ' weekend';
    var today = new Date(); today.setHours(0,0,0,0);
    if (d.getTime()===today.getTime()) cls += ' today';
    dHtml += '<div class="'+cls+'" style="width:'+cellW+'px"><div class="day-num">'+d.getDate()+'</div><div style="font-size:9px">'+DOW[dow]+'</div></div>';
  }
  var tm = document.getElementById('timelineMonths'); if (!tm) return;
  tm.innerHTML = mHtml;
  document.getElementById('timelineDays').innerHTML = dHtml;
}

function renderTimeline() {
  var groups = getGroupedPeople();
  var cellW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-w'));
  var totalW = viewDays * cellW;
  var grid = document.getElementById('timelineGrid');
  var bgHtml = '';
  for (var i=0; i<viewDays; i++) {
    var d = addDays(viewStart, i);
    var dow = d.getDay();
    var cls = 'grid-col';
    if (dow===0||dow===6) cls += ' weekend';
    var today = new Date(); today.setHours(0,0,0,0);
    if (d.getTime()===today.getTime()) cls += ' today';
    bgHtml += '<div class="'+cls+'" style="left:'+(i*cellW)+'px;width:'+cellW+'px"></div>';
  }

  // Now line
  var now = new Date();
  var nowDay = Math.floor((now - viewStart) / 86400000);
  var nowLine = '';
  if (nowDay >= 0 && nowDay < viewDays) {
    var hours = now.getHours() + now.getMinutes() / 60;
    var nowX = (nowDay + hours / 24) * cellW;
    nowLine = '<div class="now-line" style="left:' + nowX + 'px"></div>';
  }

  var rowsHtml = '';
  for (var pod in groups) {
    var members = groups[pod];
    rowsHtml += '<div class="timeline-row pod-header-row" style="width:'+totalW+'px"></div>';
    if (!collapsedPods.has(pod)) {
      // Milestone row for this pod
      var podMilestones = sMilestones.filter(function(ms) { return ms.pod === pod; });
      if (podMilestones.length > 0) {
        rowsHtml += '<div class="milestone-row" style="width:' + totalW + 'px">';
        podMilestones.forEach(function(ms) {
          var msStart = parseDate(ms.start), msEnd = parseDate(ms.end);
          if (!msStart || !msEnd) return;
          var s = Math.max(0, Math.round((msStart - viewStart) / 86400000));
          var e = Math.min(viewDays - 1, Math.round((msEnd - viewStart) / 86400000));
          if (e < 0 || s >= viewDays) return;
          var left = s * cellW, width = Math.max((e - s + 1) * cellW - 2, 20);
          var msName = (ms.name || '').toLowerCase();
          var color = '#5b8def';
          if (msName.indexOf('draft 1') !== -1 || msName === 'd1') color = '#5b8def';
          else if (msName.indexOf('draft 2') !== -1 || msName === 'd2') color = '#27ae60';
          else if (msName.indexOf('draft 3') !== -1 || msName === 'd3') color = '#e67e22';
          else if (msName.indexOf('draft 4') !== -1 || msName === 'd4') color = '#e74c3c';
          else if (msName.indexOf('final') !== -1) color = '#8e44ad';
          else if (msName.indexOf('grey') !== -1 || msName.indexOf('gray') !== -1) color = '#7f8c8d';
          var label = ms.name + ' — ' + (ms.projectName || '').replace(/^\d+\s*/, '');
          var tip = ms.name + '\n' + (ms.projectName || '') + '\n' + ms.start + ' → ' + ms.end;
          rowsHtml += '<div class="milestone-bar" style="left:' + left + 'px;width:' + width + 'px;background:' + color + '" title="' + escapeHtml(tip) + '">' + escapeHtml(label) + '</div>';
        });
        rowsHtml += '</div>';
      }
      members.forEach(function(m) {
        rowsHtml += '<div class="timeline-row" data-person="'+m.tdId+'" onclick="schedTimelineClick(event,\''+m.tdId+'\')" style="width:'+totalW+'px">';
        sAssignments.filter(function(a) { return a.personKey === String(m.tdId); }).forEach(function(a) {
          var aStart = parseDate(a.start), aEnd = parseDate(a.end);
          if (!aStart||!aEnd) return;
          var s = Math.max(0, Math.round((aStart-viewStart)/86400000));
          var e = Math.min(viewDays-1, Math.round((aEnd-viewStart)/86400000));
          if (e<0||s>=viewDays) return;
          var left = s*cellW, width = (e-s+1)*cellW-2;
          var color = projectColor(a.projectId);
          var label = (a.projectNum?a.projectNum+' ':'') + (a.projectName||'');
          var desc = a.desc ? ' — '+a.desc : '';
          var pri = '';
          var we = a.weekend?'weekend-bar':'';
          rowsHtml += '<div class="gantt-bar '+pri+' '+we+'" onclick="schedEditAssignment('+a.id+')" onmouseenter="schedShowTip(event,'+a.id+')" onmouseleave="schedHideTip()" style="left:'+left+'px;width:'+width+'px;background:'+color+';cursor:pointer">' +
            '<div class="bar-handle bar-handle-l" onmousedown="schedBarMouseDown(event,'+a.id+',\'left\')"></div>' +
            '<span class="bar-text" onmousedown="schedBarMouseDown(event,'+a.id+',\'move\')">'+escapeHtml(label+desc)+'</span>' +
            '<div class="bar-handle bar-handle-r" onmousedown="schedBarMouseDown(event,'+a.id+',\'right\')"></div></div>';
        });

        // Vacation blocks
        sVacations.filter(function(v) { return v.personKey === String(m.tdId) && v.status === 'Approved'; }).forEach(function(v) {
          var vStart = parseDate(v.start), vEnd = parseDate(v.end);
          if (!vStart||!vEnd) return;
          var s = Math.max(0, Math.round((vStart-viewStart)/86400000));
          var e = Math.min(viewDays-1, Math.round((vEnd-viewStart)/86400000));
          if (e<0||s>=viewDays) return;
          var left = s*cellW, width = (e-s+1)*cellW-2;
          rowsHtml += '<div class="gantt-bar vacation-bar" style="left:'+left+'px;width:'+width+'px" title="'+escapeHtml(v.type||'Vacation')+': '+v.start+' to '+v.end+'"><span class="bar-text">'+escapeHtml(v.type||'Vacation')+'</span></div>';
        });

        rowsHtml += '</div>';
      });
    }
  }
  grid.style.width = totalW+'px';
  grid.innerHTML = bgHtml + nowLine + rowsHtml;
}

// ─── INTERACTIONS ─────────────────────────────────────────────
function showTip(event, id) {
  var a = sAssignments.find(function(x){return x.id===id;});
  if (!a) return;
  var tip = document.getElementById('tooltip');
  tip.innerHTML = '<div class="tip-title">'+(a.projectNum?a.projectNum+' ':'')+escapeHtml(a.projectName)+'</div>'+
    '<div class="tip-row">'+escapeHtml(a.personName)+' ('+escapeHtml(a.personPod)+')</div>'+
    '<div class="tip-row">'+a.start+' → '+a.end+'</div>'+
    (a.hours?'<div class="tip-row">'+a.hours+'h/day</div>':'')+

    (a.desc?'<div class="tip-row" style="margin-top:4px;font-style:italic">'+escapeHtml(a.desc)+'</div>':'');
  tip.classList.add('visible');
  tip.style.left = Math.min(event.clientX+12, window.innerWidth-290)+'px';
  tip.style.top = (event.clientY+12)+'px';
}

function hideTip() { document.getElementById('tooltip').classList.remove('visible'); }

function resizeCells() {
  var panel = document.querySelector('.timeline-panel');
  if (!panel) return;
  var avail = panel.clientWidth;
  var cellW = Math.max(28, Math.floor(avail / viewDays));
  document.documentElement.style.setProperty('--cell-w', cellW+'px');
}

function updateDateDisplay() {
  var el = document.getElementById('dateDisplay');
  if (!el) return;
  var end = addDays(viewStart, viewDays-1);
  el.textContent = MONTHS[viewStart.getMonth()]+' '+viewStart.getDate()+' — '+MONTHS[end.getMonth()]+' '+end.getDate()+', '+end.getFullYear();
}

// ─── MODAL ────────────────────────────────────────────────────
function populateSelects() {
  var ps = document.getElementById('fldPerson');
  ps.innerHTML = '<option value="">Select person...</option>' +
    sPeople.map(function(p){return '<option value="'+p.tdId+'" data-pod="'+escapeHtml(p.pod)+'">'+escapeHtml(p.name)+' ('+escapeHtml(p.pod)+')</option>';}).join('');
  ps.onchange = function() { filterProjects(); };
  filterProjects();
}

function filterProjects(keepValue) {
  var ps = document.getElementById('fldPerson');
  var pj = document.getElementById('fldProject');
  var prev = keepValue || pj.value;
  var sel = ps.options[ps.selectedIndex];
  var pod = sel && sel.dataset && sel.dataset.pod ? sel.dataset.pod : '';
  var podProjects = sProjects, otherProjects = [];
  if (pod) {
    podProjects = sProjects.filter(function(p){return p.pod===pod;});
    otherProjects = sProjects.filter(function(p){return p.pod!==pod;});
  }
  var html = '<option value="">Select project...</option>';
  if (pod && podProjects.length) {
    html += '<optgroup label="'+escapeHtml(pod)+' Projects">';
    html += podProjects.map(function(p){return '<option value="'+(p.tdProjectId||p.id)+'">'+ escapeHtml(p.name)+'</option>';}).join('');
    html += '</optgroup>';
    if (otherProjects.length) {
      html += '<optgroup label="Other Projects">';
      html += otherProjects.map(function(p){return '<option value="'+(p.tdProjectId||p.id)+'">'+ escapeHtml(p.name)+'</option>';}).join('');
      html += '</optgroup>';
    }
  } else {
    html += sProjects.map(function(p){return '<option value="'+(p.tdProjectId||p.id)+'">'+ escapeHtml(p.name)+'</option>';}).join('');
  }
  pj.innerHTML = html;
  if (prev) pj.value = prev;
}

function openNewAssignment(prefillPerson, prefillDate) {
  try {
  populateSelects();
  document.getElementById('modalTitle').textContent = 'New Booking';
  document.getElementById('fldRecordId').value = '';
  document.getElementById('btnDelete').style.display = 'none';
  document.getElementById('fldPerson').value = prefillPerson || '';
  filterProjects();
  document.getElementById('fldStart').value = prefillDate || formatDate(new Date());
  document.getElementById('fldEnd').value = prefillDate ? formatDate(addDays(parseDate(prefillDate),4)) : formatDate(addDays(new Date(),4));
  document.getElementById('fldHours').value = 8;
  document.getElementById('fldDesc').value = '';
  document.getElementById('modalOverlay').classList.add('visible');
  } catch(e) { console.error('[Scheduler] Error opening new booking:', e); showToast('Error: ' + e.message, 'error'); }
}

function openEditAssignment(id) {
  if (_dragJustFinished) { _dragJustFinished = false; return; }
  try {
  var a = sAssignments.find(function(x){return x.id===id;});
  if (!a) { showToast('Booking not found','error'); return; }
  populateSelects();
  document.getElementById('modalTitle').textContent = 'Edit Booking';
  document.getElementById('fldRecordId').value = a.tdId || a.id;
  document.getElementById('btnDelete').style.display = '';
  document.getElementById('fldPerson').value = a.personKey;
  filterProjects(String(a.projectId));
  document.getElementById('fldStart').value = a.start;
  document.getElementById('fldEnd').value = a.end;
  document.getElementById('fldHours').value = a.hours || 8;
  document.getElementById('fldDesc').value = a.desc || '';
  document.getElementById('modalOverlay').classList.add('visible');
  } catch(e) { console.error('[Scheduler] Error opening edit booking:', e); showToast('Error: ' + e.message, 'error'); }
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('visible'); }

async function saveAssignment() {
  var person=document.getElementById('fldPerson').value, project=document.getElementById('fldProject').value;
  var start=document.getElementById('fldStart').value, end=document.getElementById('fldEnd').value;
  if(!person||!project||!start||!end) { showToast('Person, Project, Start and End are required','warning'); return; }
  var recordId = document.getElementById('fldRecordId').value;
  var record = {};
  record[FIELD.ASSIGN.person] = {value:String(person)};
  record[FIELD.ASSIGN.project] = {value:String(project)};
  record[FIELD.ASSIGN.start] = {value:start};
  record[FIELD.ASSIGN.end] = {value:end};
  record[FIELD.ASSIGN.hours] = {value:parseFloat(document.getElementById('fldHours').value)||8};
  record[FIELD.ASSIGN.desc] = {value:document.getElementById('fldDesc').value};
  if (recordId) record[FIELD.ASSIGN.tdId] = {value:String(recordId)};
  var isEdit = !!recordId;
  try {
    await qbUpsert(TABLES.assignments,[record], null, isEdit ? FIELD.ASSIGN.tdId : undefined);
    closeModal();
    showToast(isEdit?'Booking updated':'Booking created','success');
    invalidateCache('assignments');
    await refreshData();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function deleteAssignment() {
  var recordId = document.getElementById('fldRecordId').value;
  if (!recordId || !confirm('Delete this booking?')) return;
  try {
    await qbDelete(TABLES.assignments, '{'+FIELD.ASSIGN.tdId+'.EX.'+recordId+'}');
    closeModal();
    showToast('Booking deleted','success');
    invalidateCache('assignments');
    await refreshData();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

// ─── DRAG ─────────────────────────────────────────────────────
function onBarMouseDown(event, id, edge) {
  event.preventDefault(); event.stopPropagation();
  var a = sAssignments.find(function(x){return x.id===id;});
  if (!a) return;
  var cellW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-w'));
  _dragState = { id:id, edge:edge, startX:event.clientX, origStart:a.start, origEnd:a.end, cellW:cellW, bar:event.target.closest('.gantt-bar') };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  _dragState.bar.style.opacity = '0.7';
}

function onDragMove(event) {
  if (!_dragState) return;
  var dx = event.clientX - _dragState.startX;
  var daysDelta = Math.round(dx / _dragState.cellW);
  if (daysDelta===0) return;
  var a = sAssignments.find(function(x){return x.id===_dragState.id;});
  if (!a) return;
  if (_dragState.edge==='right') { a.end = formatDate(addDays(parseDate(_dragState.origEnd), daysDelta)); }
  else if (_dragState.edge==='left') { a.start = formatDate(addDays(parseDate(_dragState.origStart), daysDelta)); }
  else { a.start = formatDate(addDays(parseDate(_dragState.origStart), daysDelta)); a.end = formatDate(addDays(parseDate(_dragState.origEnd), daysDelta)); }
  renderTimeline();
}

async function onDragEnd() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  if (!_dragState) return;
  var a = sAssignments.find(function(x){return x.id===_dragState.id;});
  if (!a) { _dragState=null; return; }
  var changed = a.start!==_dragState.origStart || a.end!==_dragState.origEnd;
  if (changed) {
    if (parseDate(a.start)>parseDate(a.end)) {
      a.start=_dragState.origStart; a.end=_dragState.origEnd;
      showToast('Start date cannot be after end date','warning');
      renderTimeline(); _dragState=null; return;
    }
    try {
      await qbUpsert(TABLES.assignments,[{[FIELD.ASSIGN.tdId]:{value:String(a.tdId)},[FIELD.ASSIGN.start]:{value:a.start},[FIELD.ASSIGN.end]:{value:a.end}}], null, FIELD.ASSIGN.tdId);
      showToast('Booking updated','success');
    } catch(e) { a.start=_dragState.origStart; a.end=_dragState.origEnd; showToast('Error: '+e.message,'error'); }
    _dragJustFinished = true;
  }
  _dragState=null;
  renderTimeline();
}

function onTimelineClick(event, personTdId) {
  if (_dragJustFinished) { _dragJustFinished=false; return; }
  if (event.target.closest('.gantt-bar')) return;
  var cellW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-w'));
  var rect = event.currentTarget.getBoundingClientRect();
  var x = event.clientX - rect.left;
  var dayOffset = Math.floor(x / cellW);
  var clickedDate = formatDate(addDays(viewStart, dayOffset));
  openNewAssignment(personTdId, clickedDate);
}

// ─── DATA REFRESH ─────────────────────────────────────────────
async function refreshData() {
  var vStart = formatDate(viewStart);
  var vEnd = formatDate(addDays(viewStart, viewDays));
  sAssignments = await getCachedAssignments(vStart, vEnd, true);
  sVacations = (await getCachedVacations(vStart, vEnd)).filter(function(v){return v.status==='Approved';});
  sMilestones = await getCachedMilestones(vStart, vEnd);
  renderResourcePanel();
  renderTimeline();
}

// ─── EXPOSED FUNCTIONS (for onclick handlers) ─────────────────
window.schedNavigate = function(days) { viewStart=addDays(viewStart,days); updateDateDisplay(); renderTimelineHeader(); refreshData(); };
window.schedGoToday = function() { viewStart=getMonday(new Date()); updateDateDisplay(); renderTimelineHeader(); refreshData(); };
window.schedSetView = function(v) {
  currentView=v; viewDays=v==='week'?14:35;
  viewStart=v==='month'?new Date(new Date().getFullYear(),new Date().getMonth(),1):getMonday(new Date());
  document.getElementById('btnWeek').className=v==='week'?'btn btn-active':'btn';
  document.getElementById('btnMonth').className=v==='month'?'btn btn-active':'btn';
  resizeCells(); updateDateDisplay(); renderTimelineHeader(); refreshData();
};
window.schedTogglePod = function(pod) { if(activePods.has(pod))activePods.delete(pod);else activePods.add(pod); renderPodFilters(); renderResourcePanel(); renderTimeline(); };
window.schedToggleCollapse = function(pod) { if(collapsedPods.has(pod))collapsedPods.delete(pod);else collapsedPods.add(pod); renderResourcePanel(); renderTimeline(); };
window.schedNewAssignment = openNewAssignment;
window.schedEditAssignment = openEditAssignment;
window.schedDeleteAssignment = deleteAssignment;
window.schedSaveAssignment = saveAssignment;
window.schedCloseModal = closeModal;
window.schedShowTip = showTip;
window.schedHideTip = hideTip;
window.schedBarMouseDown = onBarMouseDown;
window.schedTimelineClick = onTimelineClick;
window.schedExpandAll = function() { collapsedPods.clear(); renderResourcePanel(); renderTimeline(); };
window.schedCollapseAll = function() {
  sPeople.forEach(function(p) { collapsedPods.add(p.pod); });
  renderResourcePanel(); renderTimeline();
};
window.schedSearch = function(val) {
  clearTimeout(window._schedSearchTimer);
  window._schedSearchTimer = setTimeout(function() { searchQuery=val.trim(); renderResourcePanel(); renderTimeline(); }, 150);
};

// Hook into app header search
window._schedAppSearch = function(val) {
  searchQuery = val.trim();
  var localSearch = document.getElementById('searchBox');
  if (localSearch) localSearch.value = val;
  renderResourcePanel();
  renderTimeline();
};

// ─── REGISTER TAB ─────────────────────────────────────────────


// ─── PROJECT DETAIL DRAWER ──────────────────────────────────
var _projectCache = {};

async function loadProjectDetail(tdProjectId) {
  if (_projectCache[tdProjectId]) return _projectCache[tdProjectId];
  try {
    var resp = await fetch('https://api.quickbase.com/v1/records/query', {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': 'lcpmedia.quickbase.com',
        'Authorization': 'QB-USER-TOKEN b9ytiq_f9q7_0_khn6t28ipikncmn55caczkq98b',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'bvaitp9x5',
        select: [3, 19, 20, 23, 26, 27, 52, 54, 55, 82, 91, 94, 99, 100, 109, 116, 118],
        where: "{94.EX.'" + tdProjectId + "'}",
        options: { top: 1 }
      })
    });
    if (!resp.ok) return null;
    var data = await resp.json();
    if (!data.data || !data.data.length) return null;
    var r = data.data[0];
    var v = function(fid) { return r[fid] ? r[fid].value : ''; };
    var proj = {
      id: v(3), name: v(19), reviewStudio: v(20), number: v(23),
      type: v(26), stage: v(27), deal: v(52), client: v(54), dealClose: v(55),
      pod: v(82), teamsChannel: v(91), tdProjectId: v(94),
      bookingStart: v(99), bookingEnd: v(100), age: v(109),
      receivedAssets: v(116), visibleAssets: v(118)
    };
    _projectCache[tdProjectId] = proj;
    return proj;
  } catch(e) { console.error('[Scheduler] Error loading project:', e); return null; }
}

function fmtProjectDate(v) {
  if (!v) return '—';
  var d = new Date(v);
  return (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function stageColor(stage) {
  if (!stage) return 'var(--text-dim)';
  var s = stage.toLowerCase();
  if (s.indexOf('complete') !== -1) return 'var(--success)';
  if (s.indexOf('production') !== -1 || s.indexOf('active') !== -1) return 'var(--accent)';
  if (s.indexOf('review') !== -1) return 'var(--warning)';
  if (s.indexOf('hold') !== -1 || s.indexOf('cancel') !== -1) return 'var(--danger)';
  return 'var(--text-muted)';
}


async function loadProjectScope(dealId) {
  if (!dealId) return [];
  try {
    var rows = await qbQueryAll(TABLES.scope,
      [FIELD.SCOPE.id, FIELD.SCOPE.product, FIELD.SCOPE.assetName, FIELD.SCOPE.quantity,
       FIELD.SCOPE.stillsCount, FIELD.SCOPE.panosCount, FIELD.SCOPE.pricePer, FIELD.SCOPE.totalValue],
      '{' + FIELD.SCOPE.projectRef + '.EX.' + dealId + '}');
    return rows.map(function(r) {
      return {
        product: val(r, FIELD.SCOPE.product),
        asset: val(r, FIELD.SCOPE.assetName),
        qty: val(r, FIELD.SCOPE.quantity),
        stills: val(r, FIELD.SCOPE.stillsCount),
        panos: val(r, FIELD.SCOPE.panosCount),
        price: val(r, FIELD.SCOPE.pricePer),
        total: val(r, FIELD.SCOPE.totalValue)
      };
    });
  } catch(e) { console.warn('[Scheduler] Could not load scope:', e); return []; }
}

async function openProjectDetail(tdProjectId) {
  if (!tdProjectId) { showToast('No project linked', 'warning'); return; }

  // Create overlay if needed
  var overlay = document.getElementById('projDrawerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'projDrawerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:910;opacity:0;transition:opacity 0.2s';
    overlay.onclick = function(e) { if(e.target===overlay) closeProjectDrawer(); };
    document.body.appendChild(overlay);
  }
  overlay.style.display = '';
  requestAnimationFrame(function(){overlay.style.opacity='1';});

  // Create drawer
  var drawer = document.getElementById('projDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'projDrawer';
    drawer.style.cssText = 'position:fixed;top:0;right:-480px;width:480px;height:100vh;background:var(--surface);border-left:1px solid var(--border);z-index:911;display:flex;flex-direction:column;transition:right 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.25)';
    document.body.appendChild(drawer);
  }

  drawer.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-dim)">Loading project...</div>';
  requestAnimationFrame(function(){drawer.style.right='0';});

  var p = await loadProjectDetail(tdProjectId);
  var scopeItems = p && p.deal ? await loadProjectScope(p.deal) : [];
  if (!p) {
    drawer.innerHTML = '<div style="padding:20px;color:var(--text-dim)">Project not found for TD ID: ' + escapeHtml(tdProjectId) + '<br><button onclick="closeProjectDrawer()" class="btn" style="margin-top:12px">Close</button></div>';
    return;
  }

  var reviewUrl = '';
  if (p.reviewStudio) {
    reviewUrl = typeof p.reviewStudio === 'object' ? (p.reviewStudio.url || p.reviewStudio) : p.reviewStudio;
  }
  var teamsUrl = '';
  if (p.teamsChannel) {
    teamsUrl = typeof p.teamsChannel === 'object' ? (p.teamsChannel.url || p.teamsChannel) : p.teamsChannel;
  }

  drawer.innerHTML =
    // Header
    '<div style="padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="font-size:15px;font-weight:700;color:var(--text)">' + escapeHtml(p.name) + '</div>' +
          '<div style="font-size:12px;color:var(--text-dim);margin-top:2px">' + escapeHtml(p.client || '') + (p.pod ? ' · ' + escapeHtml(p.pod) : '') + '</div>' +
        '</div>' +
        '<button onclick="closeProjectDrawer()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:18px">&times;</button>' +
      '</div>' +
      // Stage + Type badges
      '<div style="display:flex;gap:8px;margin-top:10px">' +
        (p.stage ? '<span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;background:' + stageColor(p.stage) + '22;color:' + stageColor(p.stage) + '">' + escapeHtml(p.stage) + '</span>' : '') +
        (p.type ? '<span style="display:inline-block;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;background:var(--surface3);color:var(--text-muted)">' + escapeHtml(p.type) + '</span>' : '') +
      '</div>' +
    '</div>' +

    // Body
    '<div style="flex:1;overflow-y:auto;padding:16px 20px">' +

      // Action buttons
      (reviewUrl ?
        '<a href="' + escapeHtml(reviewUrl) + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:8px;color:var(--accent);text-decoration:none;font-size:13px;font-weight:600;margin-bottom:8px">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
          'Open in Review Studio</a>' : '') +
      (teamsUrl ?
        '<a href="' + escapeHtml(teamsUrl) + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);text-decoration:none;font-size:13px;font-weight:600;margin-bottom:16px">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
          'Teams Channel</a>' : '') +
      (!reviewUrl && !teamsUrl ? '<div style="margin-bottom:16px"></div>' : '') +

      // Info grid
      '<div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Project Details</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;margin-bottom:20px">' +
        '<div><div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Client</div><div style="font-size:13px;color:var(--text);font-weight:500">' + escapeHtml(p.client || '—') + '</div></div>' +
        '<div><div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Pod</div><div style="font-size:13px;color:var(--text);font-weight:500">' + escapeHtml(p.pod || '—') + '</div></div>' +
        '<div><div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Deal Close</div><div style="font-size:13px;color:var(--text);font-weight:500">' + fmtProjectDate(p.dealClose) + '</div></div>' +
        '<div><div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Project Age</div><div style="font-size:13px;color:var(--text);font-weight:500">' + (p.age || '—') + '</div></div>' +
        '<div><div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Booking Range</div><div style="font-size:13px;color:var(--text);font-weight:500">' + fmtProjectDate(p.bookingStart) + ' — ' + fmtProjectDate(p.bookingEnd) + '</div></div>' +
        '<div><div style="font-size:10px;color:var(--text-dim);margin-bottom:2px">Technical Assets</div><div style="font-size:13px;color:var(--text);font-weight:500">' + (p.receivedAssets || 0) + ' received / ' + (p.visibleAssets || 0) + ' visible</div></div>' +
      '</div>' +

      // Scope
      (scopeItems.length ?
        '<div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Project Scope (' + scopeItems.length + ' items)</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px"><thead><tr>' +
          '<th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;border-bottom:1px solid var(--border)">Product</th>' +
          '<th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;border-bottom:1px solid var(--border)">Asset</th>' +
          '<th style="text-align:center;padding:6px 8px;font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;border-bottom:1px solid var(--border)">Qty</th>' +
          '<th style="text-align:center;padding:6px 8px;font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;border-bottom:1px solid var(--border)">Stills</th>' +
          '<th style="text-align:center;padding:6px 8px;font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;border-bottom:1px solid var(--border)">Panos</th>' +
          '<th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;color:var(--text-dim);text-transform:uppercase;border-bottom:1px solid var(--border)">Value</th>' +
        '</tr></thead><tbody>' +
        scopeItems.map(function(s) {
          return '<tr>' +
            '<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text);font-weight:500">' + escapeHtml(s.product || '') + '</td>' +
            '<td style="padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text-muted)">' + escapeHtml(s.asset || '') + '</td>' +
            '<td style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text-muted)">' + (s.qty || '') + '</td>' +
            '<td style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text-muted)">' + (s.stills || '') + '</td>' +
            '<td style="text-align:center;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text-muted)">' + (s.panos || '') + '</td>' +
            '<td style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border);font-family:JetBrains Mono,monospace;font-weight:600;color:var(--text)">' + (s.total ? '$' + Number(s.total).toLocaleString() : '') + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>'
      : '') +

    '</div>';
}

function closeProjectDrawer() {
  var drawer = document.getElementById('projDrawer');
  if (drawer) drawer.style.right = '-480px';
  var overlay = document.getElementById('projDrawerOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(function(){overlay.style.display='none';}, 200);
  }
}

window.openProjectDetail = openProjectDetail;
window.closeProjectDrawer = closeProjectDrawer;

// ─── NEW MILESTONE ──────────────────────────────────
function newMilestone() {
  // Build a simple modal for creating a milestone
  var overlay = document.getElementById('modalOverlay');
  var content = document.querySelector('.modal-content');
  if (!overlay || !content) return;

  content.innerHTML =
    '<div id="modalTitle" style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text)">New Milestone</div>' +
    '<div class="form-group"><label class="form-label">Milestone Name</label><input class="form-input" type="text" id="fldMsName" placeholder="e.g. Draft 1, Draft 2, Final"></div>' +
    '<div class="form-group"><label class="form-label">Project</label><select class="form-select" id="fldMsProject"></select></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="fldMsStart"></div>' +
      '<div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="fldMsEnd"></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="fldMsDesc" rows="2"></textarea></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
      '<button class="btn" onclick="schedCloseModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="schedSaveMilestone()">Save Milestone</button>' +
    '</div>';

  // Populate project dropdown
  var pj = document.getElementById('fldMsProject');
  pj.innerHTML = '<option value="">Select project...</option>' +
    sProjects.map(function(p) {
      return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>';
    }).join('');

  document.getElementById('fldMsStart').value = formatDate(new Date());
  document.getElementById('fldMsEnd').value = formatDate(addDays(new Date(), 14));
  overlay.classList.add('visible');
}

async function saveMilestone() {
  var name = document.getElementById('fldMsName').value;
  var projectId = document.getElementById('fldMsProject').value;
  var start = document.getElementById('fldMsStart').value;
  var end = document.getElementById('fldMsEnd').value;
  if (!name || !projectId || !start || !end) {
    showToast('Name, Project, Start and End are required', 'warning');
    return;
  }

  // Find project to get pod and name
  var proj = sProjects.find(function(p) { return String(p.id) === String(projectId); });

  try {
    await qbUpsert(TABLES.milestones, [{
      7: {value: name},
      8: {value: proj ? (proj.tdProjectId || '') : ''},
      9: {value: start},
      10: {value: end},
      12: {value: proj ? proj.name : ''},
      13: {value: proj ? proj.pod : ''}
    }]);
    closeModal();
    showToast('Milestone created', 'success');
    await refreshData();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}

window.schedNewMilestone = newMilestone;
window.schedSaveMilestone = saveMilestone;

registerTab('scheduler', {
  icon: '📅',
  label: 'Scheduler',
  roles: ALL_ROLES,
  onInit: async function() {
    // Inject CSS
    var style = document.createElement('style');
    style.textContent = schedulerCSS;
    document.head.appendChild(style);

    // Build DOM
    document.getElementById('tab-scheduler').innerHTML = buildHTML();

    // Setup scroll sync
    document.getElementById('timelineBody').addEventListener('scroll', function() {
      document.getElementById('resourceList').scrollTop = this.scrollTop;
    });
    document.getElementById('resourceList').addEventListener('scroll', function() {
      document.getElementById('timelineBody').scrollTop = this.scrollTop;
    });
    document.getElementById('modalOverlay').addEventListener('click', function(e) { if(e.target===this) closeModal(); });

    // Load reference data
    sPeople = await getCachedPeople();
    sProjects = await getCachedProjects();
    var pods = []; var seen = {};
    sPeople.forEach(function(p) { if (!seen[p.pod]) { seen[p.pod]=true; pods.push(p.pod); } });
    var defaultOff = ['Polish office', 'TourBuilder'];
    pods.forEach(function(p) { if (defaultOff.indexOf(p) === -1) activePods.add(p); });

    resizeCells();
    window.addEventListener('resize', function() { resizeCells(); renderTimelineHeader(); renderTimeline(); });
  },
  onActivate: async function() {
    window.onAppSearch = window._schedAppSearch;
    renderPodFilters();
    updateDateDisplay();
    renderTimelineHeader();
    await refreshData();
  }
});

})();
