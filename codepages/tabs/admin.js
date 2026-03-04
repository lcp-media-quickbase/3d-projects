// ═══════════════════════════════════════════════════════════════
// Admin Tab — People, Projects, PODs management
// ═══════════════════════════════════════════════════════════════
(function() {

var aPeople = [], aProjects = [], aPods = [];
var adminSubTab = 'people';
var adminSearch = '';

var adminCSS = `
  .admin-tabs { display:flex; gap:0; border-bottom:1px solid var(--border); padding:0 20px; flex-shrink:0; }
  .admin-tab { padding:10px 16px; font-size:13px; font-weight:500; color:var(--text-muted); cursor:pointer; border:none; background:none; font-family:inherit; border-bottom:2px solid transparent; transition:all 0.15s; }
  .admin-tab:hover { color:var(--text); }
  .admin-tab.active { color:var(--accent); border-bottom-color:var(--accent); }
  .admin-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:24px; }
  .admin-subtab { display:none; flex:1; overflow:auto; padding:20px; }
  .admin-subtab.active { display:block; }
  .table-container { overflow:auto; background:var(--surface); border-radius:10px; border:1px solid var(--border); }
  .row-actions { display:flex; gap:4px; opacity:0; transition:opacity 0.15s; }
  tr:hover .row-actions { opacity:1; }
  .pod-dot-lg { width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:6px; }
  .stats-bar { display:flex; gap:20px; padding:10px 20px; border-top:1px solid var(--border); font-size:12px; color:var(--text-dim); flex-shrink:0; }
  .stat-value { color:var(--text); font-weight:600; }
`;

function buildHTML() {
  return `
    <div class="sched-topbar" style="border-bottom:none;flex-shrink:0">
      <div class="sched-topbar-left"></div>
      <div class="sched-topbar-right">
        <button class="btn btn-primary" id="adminAddBtn" onclick="adminHandleAdd()">+ Add Person</button>
      </div>
    </div>
    <div class="admin-tabs">
      <button class="admin-tab active" data-sub="people" onclick="adminSwitchSub('people')">People</button>
      <button class="admin-tab" data-sub="projects" onclick="adminSwitchSub('projects')">Projects</button>
      <button class="admin-tab" data-sub="pods" onclick="adminSwitchSub('pods')">PODs</button>
      <button class="admin-tab" data-sub="overview" onclick="adminSwitchSub('overview')">Overview</button>
    </div>
    <div class="admin-subtab active" id="adminSub-people">
      <div class="table-container"><table class="data-table"><thead><tr>
        <th style="width:30px">#</th><th>Name</th><th>Email</th><th>POD</th><th>Role</th><th>Status</th><th>TD ID</th><th style="width:80px"></th>
      </tr></thead><tbody id="adminPeopleBody"></tbody></table></div>
    </div>
    <div class="admin-subtab" id="adminSub-projects">
      <div class="table-container"><table class="data-table"><thead><tr>
        <th style="width:60px">Proj #</th><th>Name</th><th>Stage</th><th>POD</th><th>Type</th><th style="width:80px"></th>
      </tr></thead><tbody id="adminProjectsBody"></tbody></table></div>
    </div>
    <div class="admin-subtab" id="adminSub-pods"><div id="adminPodsGrid"></div></div>
    <div class="admin-subtab" id="adminSub-overview">
      <div class="admin-grid" id="adminOverviewCards"></div>
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">POD Composition</div>
      <div id="adminPodComp"></div>
    </div>
    <div class="stats-bar">
      <div>Active People: <span class="stat-value" id="adminStatPeople">0</span></div>
      <div>Active Projects: <span class="stat-value" id="adminStatProjects">0</span></div>
      <div>PODs: <span class="stat-value" id="adminStatPods">0</span></div>
    </div>
    <div class="modal-overlay" id="adminModal" onclick="if(event.target===this)adminCloseModal()">
      <div class="modal-content" id="adminModalContent"></div>
    </div>`;
}

function switchSub(sub) {
  adminSubTab = sub;
  document.querySelectorAll('.admin-tab').forEach(function(t){t.classList.toggle('active',t.dataset.sub===sub);});
  document.querySelectorAll('.admin-subtab').forEach(function(t){t.classList.toggle('active',t.id==='adminSub-'+sub);});
  var btn = document.getElementById('adminAddBtn');
  if (sub==='people') { btn.textContent='+ Add Person'; btn.style.display=''; }
  else if (sub==='projects') { btn.textContent='+ Add Project'; btn.style.display=''; }
  else { btn.style.display='none'; }
  renderSub();
}

function renderSub() {
  if (adminSubTab==='people') renderPeople();
  else if (adminSubTab==='projects') renderProjects();
  else if (adminSubTab==='pods') renderPods();
  else if (adminSubTab==='overview') renderOverview();
}

function renderPeople() {
  var q = adminSearch;
  var filtered = aPeople.filter(function(p){
    if (!q) return true;
    return p.name.toLowerCase().includes(q)||
      (p.email||'').toLowerCase().includes(q)||
      p.pod.toLowerCase().includes(q);
  });
  document.getElementById('adminPeopleBody').innerHTML = filtered.map(function(p){
    var pc = podColor(p.pod);
    return '<tr><td class="cell-mono">'+p.id+'</td>'+
      '<td class="cell-name">'+escapeHtml(p.name)+'</td>'+
      '<td>'+(escapeHtml(p.email)||'<span style="color:var(--text-dim)">—</span>')+'</td>'+
      '<td><span class="pod-dot-lg" style="background:'+pc+'"></span>'+escapeHtml(p.pod)+'</td>'+
      '<td>'+(escapeHtml(p.role)||'—')+'</td>'+
      '<td><span class="badge '+(p.active?'badge-success':'badge-neutral')+'">'+(p.active?'Active':'Inactive')+'</span></td>'+
      '<td class="cell-mono">'+(p.tdId||'—')+'</td>'+
      '<td><div class="row-actions">'+
        '<button class="btn btn-sm" onclick="adminEditPerson('+p.id+')">Edit</button>'+
        '<button class="btn btn-sm '+(p.active?'btn-danger':'btn-success')+'" onclick="adminToggleActive('+p.id+')">'+(p.active?'Deactivate':'Activate')+'</button>'+
      '</div></td></tr>';
  }).join('');
  document.getElementById('adminStatPeople').textContent = aPeople.filter(function(p){return p.active;}).length;
}

function renderProjects() {
  var q = adminSearch;
  var filtered = aProjects.filter(function(p){
    if (!q) return true;
    return p.name.toLowerCase().includes(q)||
      String(p.number).includes(q)||
      (p.pod||'').toLowerCase().includes(q);
  });
  document.getElementById('adminProjectsBody').innerHTML = filtered.map(function(p){
    var sc = p.stage==='In Production'?'badge-info':p.stage==='Pre-Production'?'badge-warning':'badge-neutral';
    return '<tr><td class="cell-mono">'+(p.number||'—')+'</td>'+
      '<td class="cell-name">'+escapeHtml(p.name)+'</td>'+
      '<td><span class="badge '+sc+'">'+escapeHtml(p.stage||'—')+'</span></td>'+
      '<td>'+(escapeHtml(p.pod)||'—')+'</td>'+
      '<td>'+(escapeHtml(p.type)||'—')+'</td>'+
      '<td><div class="row-actions"><button class="btn btn-sm" onclick="adminEditProject('+p.id+')">Edit</button></div></td></tr>';
  }).join('');
  document.getElementById('adminStatProjects').textContent = aProjects.filter(function(p){return p.stage!=='Complete';}).length;
}

function renderPods() {
  var podGroups = {};
  aPeople.filter(function(p){return p.active;}).forEach(function(p){(podGroups[p.pod]=podGroups[p.pod]||[]).push(p);});
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">';
  Object.entries(podGroups).sort(function(a,b){return a[0].localeCompare(b[0]);}).forEach(function(entry){
    var pod=entry[0], members=entry[1], c=podColor(pod);
    html += '<div class="card" style="border-top:3px solid '+c+'"><div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'+
      '<span style="background:'+c+';width:12px;height:12px;border-radius:50%;display:inline-block"></span>'+
      '<span style="font-size:15px;font-weight:700">'+escapeHtml(pod)+'</span>'+
      '<span class="badge badge-neutral" style="margin-left:auto">'+members.length+' members</span></div>';
    members.forEach(function(m){
      var ini=m.name.split(' ').map(function(w){return (w[0]||'');}).join('').slice(0,2);
      html += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+c+';display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">'+ini+'</div>'+
        '<div><div style="font-size:13px;font-weight:500;color:var(--text)">'+escapeHtml(m.name)+'</div>'+
        '<div style="font-size:11px;color:var(--text-dim)">'+(escapeHtml(m.email)||'No email')+'</div></div></div>';
    });
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('adminPodsGrid').innerHTML = html;
  document.getElementById('adminStatPods').textContent = Object.keys(podGroups).length;
}

function renderOverview() {
  var active=aPeople.filter(function(p){return p.active;}).length;
  var inactive=aPeople.filter(function(p){return !p.active;}).length;
  var preProd=aProjects.filter(function(p){return p.stage==='Pre-Production';}).length;
  var inProd=aProjects.filter(function(p){return p.stage==='In Production';}).length;
  var complete=aProjects.filter(function(p){return p.stage==='Complete';}).length;
  var podSet=new Set(aPeople.filter(function(p){return p.active;}).map(function(p){return p.pod;}));
  var podCount=podSet.size;
  document.getElementById('adminOverviewCards').innerHTML =
    '<div class="card"><div class="card-title">Active Team</div><div class="card-value">'+active+'</div><div class="card-sub">'+inactive+' inactive</div></div>'+
    '<div class="card"><div class="card-title">In Production</div><div class="card-value" style="color:var(--accent)">'+inProd+'</div><div class="card-sub">'+preProd+' pre-production</div></div>'+
    '<div class="card"><div class="card-title">Completed</div><div class="card-value" style="color:var(--success)">'+complete+'</div><div class="card-sub">all time</div></div>'+
    '<div class="card"><div class="card-title">Active PODs</div><div class="card-value">'+podCount+'</div><div class="card-sub">'+(podCount?Math.round(active/podCount*10)/10:0)+' avg members</div></div>';
  // POD composition bars
  var podGroups={};
  aPeople.filter(function(p){return p.active;}).forEach(function(p){(podGroups[p.pod]=podGroups[p.pod]||[]).push(p);});
  var maxPod=Math.max.apply(null,Object.values(podGroups).map(function(m){return m.length;}));
  var compHtml='';
  Object.entries(podGroups).sort(function(a,b){return b[1].length-a[1].length;}).forEach(function(entry){
    var pod=entry[0],members=entry[1],c=podColor(pod),pct=(members.length/maxPod*100);
    compHtml+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'+
      '<span style="min-width:120px;font-size:13px;font-weight:500;color:var(--text)">'+escapeHtml(pod)+'</span>'+
      '<div style="flex:1;height:24px;background:var(--surface2);border-radius:4px;overflow:hidden">'+
        '<div style="height:100%;width:'+pct+'%;background:'+c+';border-radius:4px;display:flex;align-items:center;padding:0 8px">'+
          '<span style="font-size:11px;font-weight:600;color:#fff">'+members.length+'</span></div></div></div>';
  });
  document.getElementById('adminPodComp').innerHTML = compHtml;
}

// ─── MODALS ───────────────────────────────────────────────
function editPerson(id) {
  var p=aPeople.find(function(x){return x.id===id;});
  if (!p) return;
  var podOpts=[]; var seen={};
  aPeople.forEach(function(x){if(!seen[x.pod]&&x.pod){seen[x.pod]=true;podOpts.push(x.pod);}});
  document.getElementById('adminModalContent').innerHTML =
    '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Edit Person</h3>'+
    '<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="eName" value="'+escapeHtml(p.name)+'"></div>'+
    '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="eEmail" value="'+escapeHtml(p.email||'')+'"></div>'+
    '<div class="form-group"><label class="form-label">Role</label><input class="form-input" id="eRole" value="'+escapeHtml(p.role||'')+'"></div>'+
    '<div class="form-group"><label class="form-label">POD</label><select class="form-select" id="ePod">'+
      podOpts.map(function(po){return '<option'+(po===p.pod?' selected':'')+'>'+escapeHtml(po)+'</option>';}).join('')+'</select></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+
      '<button class="btn" onclick="adminCloseModal()">Cancel</button>'+
      '<button class="btn btn-primary" onclick="adminSavePerson('+id+')">Save</button></div>';
  document.getElementById('adminModal').classList.add('visible');
}

async function savePerson(id) {
  try {
    await qbUpsert(TABLES.people,[{
      [FIELD.PEOPLE.id]:{value:id},
      [FIELD.PEOPLE.name]:{value:document.getElementById('eName').value},
      [FIELD.PEOPLE.email]:{value:document.getElementById('eEmail').value},
      [FIELD.PEOPLE.role]:{value:document.getElementById('eRole').value}
    }]);
    document.getElementById('adminModal').classList.remove('visible');
    showToast('Person updated','success');
    invalidateCache('people');
    aPeople = await getCachedPeople(true);
    renderSub();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function toggleActive(id) {
  var p=aPeople.find(function(x){return x.id===id;});
  if (!p) return;
  try {
    await qbUpsert(TABLES.people,[{[FIELD.PEOPLE.id]:{value:id},[FIELD.PEOPLE.active]:{value:!p.active}}]);
    showToast(p.active?'Deactivated':'Activated','success');
    invalidateCache('people');
    aPeople = await getCachedPeople(true);
    renderSub();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

function editProject(id) {
  var p=aProjects.find(function(x){return x.id===id;});
  if (!p) return;
  document.getElementById('adminModalContent').innerHTML =
    '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Edit Project</h3>'+
    '<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="eProjName" value="'+escapeHtml(p.name)+'"></div>'+
    '<div class="form-group"><label class="form-label">Stage</label><select class="form-select" id="eProjStage">'+
      PROJECT_STAGES.map(function(s){return '<option'+(s===p.stage?' selected':'')+'>'+s+'</option>';}).join('')+'</select></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+
      '<button class="btn" onclick="adminCloseModal()">Cancel</button>'+
      '<button class="btn btn-primary" onclick="adminSaveProject('+id+')">Save</button></div>';
  document.getElementById('adminModal').classList.add('visible');
}

async function saveProject(id) {
  try {
    await qbUpsert(TABLES.projects,[{
      [FIELD.PROJECTS.id]:{value:id},
      [FIELD.PROJECTS.name]:{value:document.getElementById('eProjName').value},
      [FIELD.PROJECTS.stage]:{value:document.getElementById('eProjStage').value}
    }]);
    document.getElementById('adminModal').classList.remove('visible');
    showToast('Project updated','success');
    invalidateCache('projects');
    aProjects = await getCachedProjects(true);
    renderSub();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

function handleAdd() {
  if (adminSubTab==='people') addPerson();
  else if (adminSubTab==='projects') addProject();
}

function addPerson() {
  var podOpts=[]; var seen={};
  aPeople.forEach(function(x){if(!seen[x.pod]&&x.pod){seen[x.pod]=true;podOpts.push(x.pod);}});
  document.getElementById('adminModalContent').innerHTML =
    '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Add Person</h3>'+
    '<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="eName" placeholder="Full name"></div>'+
    '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="eEmail" placeholder="email@lcpmedia.com"></div>'+
    '<div class="form-group"><label class="form-label">Role</label><input class="form-input" id="eRole" placeholder="e.g. 3D Artist"></div>'+
    '<div class="form-group"><label class="form-label">POD</label><select class="form-select" id="ePod"><option value="">Select POD...</option>'+
      podOpts.map(function(po){return '<option>'+escapeHtml(po)+'</option>';}).join('')+'</select></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+
      '<button class="btn" onclick="adminCloseModal()">Cancel</button>'+
      '<button class="btn btn-primary" onclick="adminCreatePerson()">Create</button></div>';
  document.getElementById('adminModal').classList.add('visible');
}

async function createPerson() {
  var name=document.getElementById('eName').value;
  if (!name) { showToast('Name is required','warning'); return; }
  try {
    await qbUpsert(TABLES.people,[{
      [FIELD.PEOPLE.name]:{value:name},
      [FIELD.PEOPLE.email]:{value:document.getElementById('eEmail').value},
      [FIELD.PEOPLE.role]:{value:document.getElementById('eRole').value},
      [FIELD.PEOPLE.active]:{value:true}
    }]);
    document.getElementById('adminModal').classList.remove('visible');
    showToast('Person created','success');
    invalidateCache('people');
    aPeople = await getCachedPeople(true);
    renderSub();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

function addProject() {
  document.getElementById('adminModalContent').innerHTML =
    '<h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Add Project</h3>'+
    '<div class="form-group"><label class="form-label">Name</label><input class="form-input" id="eProjName" placeholder="Project name"></div>'+
    '<div class="form-group"><label class="form-label">Stage</label><select class="form-select" id="eProjStage">'+
      PROJECT_STAGES.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">'+
      '<button class="btn" onclick="adminCloseModal()">Cancel</button>'+
      '<button class="btn btn-primary" onclick="adminCreateProject()">Create</button></div>';
  document.getElementById('adminModal').classList.add('visible');
}

async function createProject() {
  var name=document.getElementById('eProjName').value;
  if (!name) { showToast('Name is required','warning'); return; }
  try {
    await qbUpsert(TABLES.projects,[{
      [FIELD.PROJECTS.name]:{value:name},
      [FIELD.PROJECTS.stage]:{value:document.getElementById('eProjStage').value}
    }]);
    document.getElementById('adminModal').classList.remove('visible');
    showToast('Project created','success');
    invalidateCache('projects');
    aProjects = await getCachedProjects(true);
    renderSub();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

// Expose to window
window.adminSwitchSub = switchSub;
window.adminHandleAdd = handleAdd;
window.adminEditPerson = editPerson;
window.adminSavePerson = savePerson;
window.adminToggleActive = toggleActive;
window.adminEditProject = editProject;
window.adminSaveProject = saveProject;
window.adminCreatePerson = createPerson;
window.adminCreateProject = createProject;
window.adminCloseModal = function(){document.getElementById('adminModal').classList.remove('visible');};

registerTab('admin', {
  icon: '⚙️', label: 'Admin',
  roles: [ROLE.ADMIN, ROLE.ADMIN_COPY],
  onInit: async function() {
    var style=document.createElement('style'); style.textContent=adminCSS; document.head.appendChild(style);
    document.getElementById('tab-admin').innerHTML = buildHTML();
  },
  onActivate: async function() {
    window.onAppSearch = function(val) { adminSearch=val.trim().toLowerCase(); renderSub(); };
    aPeople = await getCachedPeople(true);
    aProjects = await getCachedProjects(true);
    renderSub();
  }
});

})();
