// ═══════════════════════════════════════════════════════════════
// Reports Tab — Utilization & capacity analytics
// ═══════════════════════════════════════════════════════════════
(function() {

var rPeople = [], rAssignments = [];
var rangeStart = addDays(getMonday(new Date()), -7);
var rangeEnd = addDays(getMonday(new Date()), 13);

var reportCSS = `
  .report-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin-bottom:24px; }
  .chart-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px; }
  .chart-title { font-size:11px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:16px; }
  .util-row { display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--border); }
  .util-name { min-width:140px; font-size:13px; font-weight:500; color:var(--text); }
  .util-bar { flex:1; height:20px; background:var(--surface3); border-radius:4px; overflow:hidden; }
  .util-fill { height:100%; border-radius:4px; display:flex; align-items:center; padding:0 8px; transition:width 0.5s ease; }
  .util-fill span { font-size:10px; font-weight:600; color:#fff; white-space:nowrap; }
  .util-pct { min-width:45px; text-align:right; font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; }
  .date-range-picker { display:flex; align-items:center; gap:8px; }
  .date-range-picker input { width:130px; }
  @media (max-width:900px) { .chart-row { grid-template-columns:1fr; } }
`;

function buildHTML() {
  return '<div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0">' +
    '<div class="sched-topbar-left"></div>' +
    '<div class="sched-topbar-right">' +
      '<div class="date-range-picker">' +
        '<input class="form-input" type="date" id="rptFrom" value="'+formatDate(rangeStart)+'" onchange="rptUpdateRange()">' +
        '<span style="color:var(--text-dim)">→</span>' +
        '<input class="form-input" type="date" id="rptTo" value="'+formatDate(rangeEnd)+'" onchange="rptUpdateRange()">' +
      '</div>' +
      '<div class="btn-group">' +
        '<button class="btn" onclick="rptSetRange(\'week\')">Week</button>' +
        '<button class="btn btn-active" onclick="rptSetRange(\'2week\')">2 Weeks</button>' +
        '<button class="btn" onclick="rptSetRange(\'month\')">Month</button>' +
        '<button class="btn" onclick="rptSetRange(\'quarter\')">Quarter</button>' +
      '</div>' +
    '</div></div>' +
    '<div style="flex:1;overflow:auto;padding:20px" id="rptBody"><div class="tab-loading"><div class="spinner"></div>Calculating...</div></div>';
}

function calcWorkdays(start, end) {
  var count=0, s=typeof start==='string'?parseDate(start):new Date(start);
  var e=typeof end==='string'?parseDate(end):new Date(end);
  var cur=new Date(s);
  while(cur<=e){var dow=cur.getDay();if(dow!==0&&dow!==6)count++;cur.setDate(cur.getDate()+1);}
  return count;
}

function calcDaysInRange(a) {
  var aS=parseDate(a.start),aE=parseDate(a.end);
  if(!aS||!aE) return 0;
  var eS=aS<rangeStart?rangeStart:aS, eE=aE>rangeEnd?rangeEnd:aE;
  if(eS>eE) return 0;
  return a.weekend ? daysBetween(eS,eE)+1 : calcWorkdays(eS,eE);
}

function calcHoursInRange(a) { return calcDaysInRange(a)*(a.hours||8); }

function getPersonUtil() {
  var tw=calcWorkdays(rangeStart,rangeEnd), mh=tw*8;
  return rPeople.map(function(p){
    var pa=rAssignments.filter(function(a){return a.personKey===String(p.tdId);});
    var bh=pa.reduce(function(s,a){return s+calcHoursInRange(a);},0);
    var ut=mh>0?Math.round(bh/mh*100):0;
    return {name:p.name,pod:p.pod,tdId:p.tdId,bookedHours:bh,maxHours:mh,utilPct:ut,count:pa.length};
  }).sort(function(a,b){return b.utilPct-a.utilPct;});
}

function getPodUtil() {
  var pu=getPersonUtil(), pods={};
  pu.forEach(function(p){
    if(!pods[p.pod])pods[p.pod]={pod:p.pod,tb:0,tm:0,ppl:0};
    pods[p.pod].tb+=p.bookedHours; pods[p.pod].tm+=p.maxHours; pods[p.pod].ppl++;
  });
  return Object.values(pods).map(function(p){p.utilPct=p.tm>0?Math.round(p.tb/p.tm*100):0;return p;}).sort(function(a,b){return b.utilPct-a.utilPct;});
}

function getProjectLoad() {
  var projects={};
  rAssignments.forEach(function(a){
    var k=a.projectId;
    if(!projects[k])projects[k]={id:k,name:a.projectName,number:a.projectNum,pod:a.projectPod||'',totalHours:0,people:{}};
    projects[k].totalHours+=calcHoursInRange(a);
    projects[k].people[a.personKey]=true;
  });
  return Object.values(projects).map(function(p){p.peopleCount=Object.keys(p.people).length;return p;}).sort(function(a,b){return b.totalHours-a.totalHours;});
}

function getWorkTypes() {
  var types={};
  rAssignments.forEach(function(a){var t=a.workType||'Untagged';types[t]=(types[t]||0)+calcHoursInRange(a);});
  return Object.entries(types).sort(function(a,b){return b[1]-a[1];});
}

function utilColor(pct) {
  if(pct>=100)return 'var(--danger)';
  if(pct>=80)return 'var(--warning)';
  if(pct>=40)return 'var(--accent)';
  return 'var(--text-dim)';
}

function renderReports() {
  var pu=getPersonUtil(), podU=getPodUtil(), pl=getProjectLoad(), wt=getWorkTypes();
  var tw=calcWorkdays(rangeStart,rangeEnd);
  var tb=pu.reduce(function(s,p){return s+p.bookedHours;},0);
  var tc=pu.reduce(function(s,p){return s+p.maxHours;},0);
  var avg=tc>0?Math.round(tb/tc*100):0;
  var over=pu.filter(function(p){return p.utilPct>100;}).length;
  var under=pu.filter(function(p){return p.utilPct<40;}).length;

  var h='<div class="report-grid">'+
    '<div class="card"><div class="card-title">Avg Utilization</div><div class="card-value" style="color:'+utilColor(avg)+'">'+avg+'%</div><div class="card-sub">'+tw+' workdays</div></div>'+
    '<div class="card"><div class="card-title">Total Booked</div><div class="card-value">'+Math.round(tb).toLocaleString()+'h</div><div class="card-sub">of '+tc.toLocaleString()+'h capacity</div></div>'+
    '<div class="card"><div class="card-title">Overloaded</div><div class="card-value" style="color:var(--danger)">'+over+'</div><div class="card-sub">over 100%</div></div>'+
    '<div class="card"><div class="card-title">Underutilized</div><div class="card-value" style="color:var(--text-dim)">'+under+'</div><div class="card-sub">under 40%</div></div>'+
    '<div class="card"><div class="card-title">Active Projects</div><div class="card-value">'+pl.length+'</div><div class="card-sub">in range</div></div></div>';

  h+='<div class="chart-row"><div class="chart-card"><div class="chart-title">Utilization by Person</div>'+
    pu.map(function(p){var c=utilColor(p.utilPct),bw=Math.min(p.utilPct,150);
      return '<div class="util-row"><div class="util-name">'+escapeHtml(p.name)+'</div>'+
        '<div class="util-bar"><div class="util-fill" style="width:'+bw+'%;background:'+c+'"><span>'+Math.round(p.bookedHours)+'h</span></div></div>'+
        '<div class="util-pct" style="color:'+c+'">'+p.utilPct+'%</div></div>';
    }).join('')+'</div>'+
    '<div class="chart-card"><div class="chart-title">Utilization by POD</div>'+
    podU.map(function(p){var c=utilColor(p.utilPct),pc=podColor(p.pod);
      return '<div class="util-row"><div class="util-name"><span class="dot" style="background:'+pc+';margin-right:8px"></span>'+escapeHtml(p.pod)+'</div>'+
        '<div class="util-bar"><div class="util-fill" style="width:'+Math.min(p.utilPct,150)+'%;background:'+pc+'"><span>'+Math.round(p.tb)+'h / '+p.ppl+' ppl</span></div></div>'+
        '<div class="util-pct" style="color:'+c+'">'+p.utilPct+'%</div></div>';
    }).join('')+
    '<div style="margin-top:24px"><div class="chart-title">Work Type Breakdown</div>'+
    wt.map(function(e){var maxH=wt[0][1],bw=maxH>0?e[1]/maxH*100:0;
      return '<div class="util-row"><div class="util-name">'+escapeHtml(e[0])+'</div>'+
        '<div class="util-bar"><div class="util-fill" style="width:'+bw+'%;background:var(--accent)"><span>'+Math.round(e[1])+'h</span></div></div></div>';
    }).join('')+'</div></div></div>';

  h+='<div class="chart-card"><div class="chart-title">Top Projects by Hours</div>'+
    '<table class="data-table"><thead><tr><th>Project</th><th>POD</th><th>People</th><th>Hours</th><th>Load</th></tr></thead><tbody>'+
    pl.slice(0,20).map(function(p){var maxH=pl[0]?pl[0].totalHours:1,bw=p.totalHours/maxH*100;
      return '<tr><td class="cell-name">'+(p.number?p.number+' ':'')+escapeHtml(p.name)+'</td>'+
        '<td>'+(escapeHtml(p.pod)||'—')+'</td><td class="cell-mono">'+p.peopleCount+'</td>'+
        '<td class="cell-mono">'+Math.round(p.totalHours)+'h</td>'+
        '<td><div style="width:120px;height:8px;background:var(--surface3);border-radius:4px;overflow:hidden">'+
          '<div style="height:100%;width:'+bw+'%;background:'+projectColor(p.id)+';border-radius:4px"></div></div></td></tr>';
    }).join('')+'</tbody></table></div>';

  document.getElementById('rptBody').innerHTML = h;
}

async function loadData() {
  var sS=formatDate(rangeStart), sE=formatDate(rangeEnd);
  var result = await Promise.all([
    getCachedPeople(),
    qbQuery(TABLES.assignments,
      [FIELD.ASSIGN.id,FIELD.ASSIGN.person,FIELD.ASSIGN.personName,FIELD.ASSIGN.personPod,
       FIELD.ASSIGN.project,FIELD.ASSIGN.projectName,FIELD.ASSIGN.projectNum,FIELD.ASSIGN.projectPod,
       FIELD.ASSIGN.start,FIELD.ASSIGN.end,FIELD.ASSIGN.hours,FIELD.ASSIGN.workType,
       FIELD.ASSIGN.draft,FIELD.ASSIGN.priority,FIELD.ASSIGN.weekend],
      '{'+FIELD.ASSIGN.end+'.OAF.'+sS+'}AND{'+FIELD.ASSIGN.start+'.BF.'+sE+'}',null,5000)
  ]);
  rPeople = result[0];
  rAssignments = result[1].records.map(function(r){
    return {id:val(r,FIELD.ASSIGN.id),personKey:String(val(r,FIELD.ASSIGN.person)),
      personName:val(r,FIELD.ASSIGN.personName),personPod:val(r,FIELD.ASSIGN.personPod),
      projectId:val(r,FIELD.ASSIGN.project),projectName:val(r,FIELD.ASSIGN.projectName),
      projectNum:val(r,FIELD.ASSIGN.projectNum),projectPod:val(r,FIELD.ASSIGN.projectPod),
      start:val(r,FIELD.ASSIGN.start),end:val(r,FIELD.ASSIGN.end),
      hours:val(r,FIELD.ASSIGN.hours),workType:val(r,FIELD.ASSIGN.workType),
      weekend:val(r,FIELD.ASSIGN.weekend)};
  });
}

window.rptSetRange = function(preset) {
  var today=getMonday(new Date());
  if(preset==='week'){rangeStart=today;rangeEnd=addDays(today,6);}
  else if(preset==='2week'){rangeStart=addDays(today,-7);rangeEnd=addDays(today,13);}
  else if(preset==='month'){rangeStart=addDays(today,-7);rangeEnd=addDays(today,27);}
  else if(preset==='quarter'){rangeStart=addDays(today,-14);rangeEnd=addDays(today,76);}
  document.getElementById('rptFrom').value=formatDate(rangeStart);
  document.getElementById('rptTo').value=formatDate(rangeEnd);
  document.getElementById('rptBody').innerHTML='<div class="tab-loading"><div class="spinner"></div>Calculating...</div>';
  loadData().then(renderReports);
};
window.rptUpdateRange = function() {
  rangeStart=parseDate(document.getElementById('rptFrom').value)||rangeStart;
  rangeEnd=parseDate(document.getElementById('rptTo').value)||rangeEnd;
  document.getElementById('rptBody').innerHTML='<div class="tab-loading"><div class="spinner"></div>Calculating...</div>';
  loadData().then(renderReports);
};

registerTab('reports', {
  icon: '📊', label: 'Reports',
  roles: [ROLE.ADMIN, ROLE.LEADERSHIP, ROLE.ADMIN_COPY],
  onInit: function() {
    var style=document.createElement('style'); style.textContent=reportCSS; document.head.appendChild(style);
    document.getElementById('tab-reports').innerHTML = buildHTML();
  },
  onActivate: async function() {
    document.getElementById('rptBody').innerHTML='<div class="tab-loading"><div class="spinner"></div>Calculating...</div>';
    await loadData();
    renderReports();
  }
});

})();
