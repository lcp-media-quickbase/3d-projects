// ═══════════════════════════════════════════════════════════════
// Vacations Tab — Time-off request management
// ═══════════════════════════════════════════════════════════════

(function() {

var vVacations = [];
var vPeople = [];
var filterStatus = '';
var filterPod = '';

var vacCSS = `
  .vacation-grid { padding: 24px; overflow-y: auto; flex: 1; }
  .vacation-table { width: 100%; border-collapse: collapse; }
  .vacation-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid var(--border); }
  .vacation-table td { padding:10px 14px; font-size:13px; color:var(--text); border-bottom:1px solid var(--border); }
  .vacation-table tr:hover td { background:var(--surface2); }
  .vacation-table tr { cursor:pointer; }
  .status-badge { display:inline-block; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:600; }
  .status-pending { background:var(--warning-dim); color:var(--warning); }
  .status-approved { background:var(--success-dim); color:var(--success); }
  .status-denied { background:var(--danger-dim); color:var(--danger); }
  .type-badge { display:inline-block; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:500; background:var(--accent-dim); color:var(--accent); }
  .type-sick { background:var(--danger-dim); color:var(--danger); }
  .type-personal { background:rgba(204,93,232,0.15); color:#cc5de8; }
  .type-holiday { background:var(--success-dim); color:var(--success); }
  .vacation-stats { display:flex; gap:16px; margin-bottom:20px; }
  .vacation-stat { flex:1; padding:14px; background:var(--surface2); border-radius:10px; border:1px solid var(--border); }
  .vacation-stat-num { font-size:22px; font-weight:700; color:var(--text); }
  .vacation-stat-label { font-size:11px; color:var(--text-dim); margin-top:2px; }
`;

function buildHTML() {
  return `
    <div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0">
      <div class="sched-topbar-left"><div class="page-title"><span>🏖️</span> Vacations</div></div>
      <div class="sched-topbar-right"><button class="btn btn-primary" onclick="vacNewRequest()">+ Vacation Request</button></div>
    </div>
    <div class="vacation-grid">
      <div class="vacation-stats" id="vacStats"></div>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <select class="form-select" id="vacFilterStatus" onchange="vacSetFilterStatus(this.value)" style="min-width:140px">
          <option value="">All Statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Denied">Denied</option>
        </select>
        <select class="form-select" id="vacFilterPod" onchange="vacSetFilterPod(this.value)" style="min-width:140px"></select>
      </div>
      <table class="vacation-table"><thead><tr>
        <th>Person</th><th>Pod</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Status</th><th>Notes</th>
      </tr></thead><tbody id="vacBody"></tbody></table>
    </div>
    <div class="modal-overlay" id="vacModal" onclick="if(event.target===this)vacCloseModal()">
      <div class="modal-content">
        <div id="vacModalTitle" style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text)">New Vacation Request</div>
        <input type="hidden" id="vacId" value="">
        <div class="form-group"><label class="form-label">Person</label><select class="form-select" id="vacPerson"></select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Start Date</label><input class="form-input" type="date" id="vacStart"></div>
          <div class="form-group"><label class="form-label">End Date</label><input class="form-input" type="date" id="vacEnd"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="vacType">${VACATION_TYPES.map(function(t){return '<option>'+t+'</option>';}).join('')}</select></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="vacStatus">${VACATION_STATUSES.map(function(s){return '<option>'+s+'</option>';}).join('')}</select></div>
        </div>
        <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="vacNotes" rows="2"></textarea></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
          <button class="btn btn-danger" id="vacBtnDel" onclick="vacDelete()" style="display:none">Delete</button>
          <div style="display:flex;gap:8px;margin-left:auto">
            <button class="btn" onclick="vacCloseModal()">Cancel</button>
            <button class="btn btn-primary" onclick="vacSave()">Save</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderStats() {
  var now = new Date();
  var pending = vVacations.filter(function(v){return v.status==='Pending';}).length;
  var upcoming = vVacations.filter(function(v){return v.status==='Approved'&&parseDate(v.start)>=now;}).length;
  var active = vVacations.filter(function(v){return v.status==='Approved'&&parseDate(v.start)<=now&&parseDate(v.end)>=now;}).length;
  document.getElementById('vacStats').innerHTML =
    '<div class="vacation-stat"><div class="vacation-stat-num" style="color:var(--warning)">'+pending+'</div><div class="vacation-stat-label">Pending</div></div>'+
    '<div class="vacation-stat"><div class="vacation-stat-num" style="color:var(--success)">'+active+'</div><div class="vacation-stat-label">On Vacation Now</div></div>'+
    '<div class="vacation-stat"><div class="vacation-stat-num" style="color:var(--accent)">'+upcoming+'</div><div class="vacation-stat-label">Upcoming</div></div>'+
    '<div class="vacation-stat"><div class="vacation-stat-num">'+vVacations.length+'</div><div class="vacation-stat-label">Total</div></div>';
}

function renderTable() {
  var filtered = vVacations.filter(function(v) {
    if (filterStatus && v.status!==filterStatus) return false;
    if (filterPod && v.personPod!==filterPod) return false;
    return true;
  }).sort(function(a,b){return a.start>b.start?-1:1;});

  var html = '';
  filtered.forEach(function(v) {
    var days = Math.round((parseDate(v.end)-parseDate(v.start))/86400000)+1;
    var sc = v.status==='Approved'?'status-approved':v.status==='Denied'?'status-denied':'status-pending';
    var tc = v.type==='Sick'?'type-sick':v.type==='Personal'?'type-personal':v.type==='Holiday'?'type-holiday':'type-badge';
    html += '<tr onclick="vacEdit('+v.id+')">'+
      '<td>'+escapeHtml(v.personName)+'</td><td>'+escapeHtml(v.personPod)+'</td>'+
      '<td><span class="'+tc+'">'+escapeHtml(v.type)+'</span></td>'+
      '<td>'+v.start+'</td><td>'+v.end+'</td><td>'+days+'</td>'+
      '<td><span class="status-badge '+sc+'">'+escapeHtml(v.status)+'</span></td>'+
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)">'+escapeHtml(v.notes||'')+'</td></tr>';
  });
  if (!filtered.length) html = '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:40px">No vacation requests found</td></tr>';
  document.getElementById('vacBody').innerHTML = html;
}

function populatePodFilter() {
  var pods=[]; var seen={};
  vPeople.forEach(function(p){if(!seen[p.pod]){seen[p.pod]=true;pods.push(p.pod);}});
  pods.sort();
  document.getElementById('vacFilterPod').innerHTML = '<option value="">All Pods</option>'+
    pods.map(function(p){return '<option>'+escapeHtml(p)+'</option>';}).join('');
}

function openNew() {
  document.getElementById('vacModalTitle').textContent = 'New Vacation Request';
  document.getElementById('vacId').value = '';
  document.getElementById('vacBtnDel').style.display = 'none';
  var ps = document.getElementById('vacPerson');
  ps.innerHTML = '<option value="">Select person...</option>'+
    vPeople.map(function(p){return '<option value="'+p.id+'">'+escapeHtml(p.name)+' ('+escapeHtml(p.pod)+')</option>';}).join('');
  document.getElementById('vacStart').value = formatDate(new Date());
  document.getElementById('vacEnd').value = formatDate(addDays(new Date(),4));
  document.getElementById('vacType').value = 'Vacation';
  document.getElementById('vacStatus').value = 'Pending';
  document.getElementById('vacNotes').value = '';
  document.getElementById('vacModal').classList.add('visible');
}

function openEdit(id) {
  var v = vVacations.find(function(x){return x.id===id;});
  if (!v) return;
  document.getElementById('vacModalTitle').textContent = 'Edit Vacation Request';
  document.getElementById('vacId').value = v.id;
  document.getElementById('vacBtnDel').style.display = '';
  var ps = document.getElementById('vacPerson');
  ps.innerHTML = '<option value="">Select person...</option>'+
    vPeople.map(function(p){return '<option value="'+p.id+'">'+escapeHtml(p.name)+' ('+escapeHtml(p.pod)+')</option>';}).join('');
  var match = vPeople.find(function(p){return p.name===v.personName;});
  if (match) ps.value = match.id;
  document.getElementById('vacStart').value = v.start;
  document.getElementById('vacEnd').value = v.end;
  document.getElementById('vacType').value = v.type;
  document.getElementById('vacStatus').value = v.status;
  document.getElementById('vacNotes').value = v.notes||'';
  document.getElementById('vacModal').classList.add('visible');
}

async function save() {
  var person=document.getElementById('vacPerson').value;
  var start=document.getElementById('vacStart').value, end=document.getElementById('vacEnd').value;
  if (!person||!start||!end) { showToast('Person, Start and End are required','warning'); return; }
  var recordId = document.getElementById('vacId').value;
  var record = {};
  record[FIELD.VACATION.person] = {value:parseInt(person)};
  record[FIELD.VACATION.start] = {value:start};
  record[FIELD.VACATION.end] = {value:end};
  record[FIELD.VACATION.type] = {value:document.getElementById('vacType').value};
  record[FIELD.VACATION.status] = {value:document.getElementById('vacStatus').value};
  record[FIELD.VACATION.notes] = {value:document.getElementById('vacNotes').value};
  if (recordId) record[FIELD.VACATION.id] = {value:parseInt(recordId)};
  try {
    await qbUpsert(TABLES.vacations,[record]);
    document.getElementById('vacModal').classList.remove('visible');
    showToast(recordId?'Vacation updated':'Vacation request created','success');
    invalidateCache('vacations');
    await refreshData();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function del() {
  var recordId = document.getElementById('vacId').value;
  if (!recordId||!confirm('Delete this vacation request?')) return;
  try {
    await qbDelete(TABLES.vacations,'{'+FIELD.VACATION.id+'.EX.'+recordId+'}');
    document.getElementById('vacModal').classList.remove('visible');
    showToast('Vacation deleted','success');
    invalidateCache('vacations');
    await refreshData();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function refreshData() {
  vVacations = await loadVacations();
  renderStats();
  renderTable();
}

// Expose to window
window.vacNewRequest = openNew;
window.vacEdit = openEdit;
window.vacSave = save;
window.vacDelete = del;
window.vacCloseModal = function() { document.getElementById('vacModal').classList.remove('visible'); };
window.vacSetFilterStatus = function(v) { filterStatus=v; renderTable(); };
window.vacSetFilterPod = function(v) { filterPod=v; renderTable(); };

registerTab('vacations', {
  icon: '🏖️',
  label: 'Vacations',
  roles: ALL_ROLES,
  onInit: async function() {
    var style = document.createElement('style');
    style.textContent = vacCSS;
    document.head.appendChild(style);
    document.getElementById('tab-vacations').innerHTML = buildHTML();
    vPeople = await getCachedPeople();
    populatePodFilter();
  },
  onActivate: async function() {
    await refreshData();
  }
});

})();
