/* ═══════════════════════════════════════════════════════════
   LCP 3D Resource Manager — Shared JS Module
   
   Auth Strategy:
   - QB Code Page (same-origin): Session cookies + credentials
     → API calls execute as the logged-in user
     → QB enforces role permissions, table/field/row-level access
     → A viewer role sees only what their role allows
   - Local dev/standalone: Falls back to QB-USER-TOKEN prompt
   ═══════════════════════════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────
const QB_REALM = 'lcpmedia.quickbase.com';
const QB_APP = 'bu8tkk77g';
const TABLES = {
  assignments: 'bvu4s9te6',
  people: 'bu8ttwq2f',
  projects: 'bvaitp9x5',
  milestones: 'bvu4tbpms',
  pods: 'bu8tt69gx'
};

const FIELD = {
  ASSIGN: { id:3, person:6, personName:7, personEmail:8, personPod:9,
    project:10, projectName:11, projectNum:12, projectStage:13, projectPod:14,
    start:15, end:16, hours:17, desc:18, workType:19, draft:20,
    priority:21, weekend:22, tdId:23, color:24 },
  PEOPLE: { id:3, name:7, email:8, role:11, active:19, podName:22, tdId:23, partTime:24 },
  PROJECTS: { id:3, name:19, number:23, type:26, stage:27, pod:82, deal:52 },
  MILESTONES: { id:3, project:6, projectName:7, projectNum:8, name:10, phase:11, start:12, end:13 },
  PODS: { id:3, name:6, tdId:11 }
};

const POD_COLORS = {
  'Max POD':'#ff6b6b', 'Polina POD':'#ffa94d', 'Grzegorz POD':'#69db7c',
  'Evgeniy POD':'#6c8cff', 'George POD':'#cc5de8', 'Polish office':'#868e96',
  'TourBuilder':'#20c997'
};

const PROJECT_COLORS = [
  '#4dabf7','#69db7c','#ffa94d','#ff6b6b','#cc5de8','#20c997','#ffd43b',
  '#748ffc','#f783ac','#63e6be','#a9e34b','#e599f7','#74c0fc','#ffa8a8',
  '#8ce99a','#ffe066','#b197fc','#66d9e8','#fab005','#ff8787'
];

const WORK_TYPES = ['Modelling','GreyScale','FloorPlans','Animatic','SiteMap','Extra'];
const DRAFT_PHASES = ['Draft 1','Draft 2','Final','Animation','Extra 1','Extra 2','Extra 3','Extra 4'];
const PRIORITIES = ['High','Medium','Low'];
const PROJECT_STAGES = ['Pre-Production','In Production','Complete'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── AUTH ──────────────────────────────────────────────────
let _authMode = null;   // 'session' | 'token'
let _userToken = '';     // Only used in token mode

/**
 * Detect environment and set auth mode.
 * 
 * Same-origin (QB Code Page on lcpmedia.quickbase.com):
 *   → fetch() with credentials:'include' sends session cookies
 *   → QB REST API authenticates via session, no token needed
 *   → Data access = logged-in user's role permissions
 *   → Admins see everything, viewers see their filtered view
 *   → Write operations respect the user's add/edit/delete rights
 *
 * Cross-origin (local dev, different domain):
 *   → Requires explicit QB-USER-TOKEN
 *   → Data access = token owner's permissions
 */
function initAuth() {
  const hostname = window.location.hostname;
  const isQBOrigin = hostname === QB_REALM ||
                     hostname.endsWith('.quickbase.com');

  if (isQBOrigin) {
    _authMode = 'session';
    console.log('[Auth] QB Code Page detected — using session credentials.');
    console.log('[Auth] Data access governed by logged-in user\'s role permissions.');
    return true;
  }

  // Local dev fallback
  _authMode = 'token';
  const params = new URLSearchParams(window.location.search);
  _userToken = params.get('token') || '';
  if (!_userToken) {
    _userToken = sessionStorage.getItem('lcp_qb_token') || '';
  }
  if (!_userToken) {
    _userToken = prompt('Enter QuickBase User Token (local dev):') || '';
  }
  if (_userToken) {
    sessionStorage.setItem('lcp_qb_token', _userToken);
    console.log('[Auth] Token mode — using explicit user token.');
    return true;
  }
  console.error('[Auth] No authentication method available.');
  return false;
}

/** Build request headers based on auth mode */
function _qbHeaders() {
  const headers = {
    'QB-Realm-Hostname': QB_REALM,
    'Content-Type': 'application/json'
  };
  if (_authMode === 'token' && _userToken) {
    headers['Authorization'] = 'QB-USER-TOKEN ' + _userToken;
  }
  // Session mode: no auth header needed — cookies carry the session
  return headers;
}

/** Fetch options with credentials policy */
function _fetchOpts(method, body) {
  const opts = {
    method,
    headers: _qbHeaders()
  };
  if (body) opts.body = JSON.stringify(body);

  if (_authMode === 'session') {
    // include = send cookies even for same-origin (ensures session auth)
    opts.credentials = 'include';
  }
  return opts;
}

/** Handle API error responses with user-friendly messages */
async function _handleError(resp) {
  const err = await resp.json().catch(() => ({}));
  const msg = err.description || err.message || `API error ${resp.status}`;

  if (resp.status === 401) {
    showToast('Session expired — please refresh the page.', 'error');
  } else if (resp.status === 403) {
    showToast('Permission denied — your role doesn\'t allow this action.', 'error');
  }
  throw new Error(msg);
}

// ─── QB API CLIENT ─────────────────────────────────────────
async function qbQuery(tableId, select, where, sortBy, top=500, skip=0) {
  const body = { from: tableId, select, options: { skip, top } };
  if (where) body.where = where;
  if (sortBy) body.sortBy = sortBy;

  const resp = await fetch(
    `https://${QB_REALM}/v1/records/query`,
    _fetchOpts('POST', body)
  );
  if (!resp.ok) await _handleError(resp);

  const data = await resp.json();
  return { records: data.data || [], metadata: data.metadata || {} };
}

async function qbQueryAll(tableId, select, where, sortBy) {
  let all = [];
  let skip = 0;
  while (true) {
    const { records, metadata } = await qbQuery(tableId, select, where, sortBy, 500, skip);
    all = all.concat(records);
    if (all.length >= (metadata.totalRecords || 0)) break;
    skip += 500;
  }
  return all;
}

async function qbUpsert(tableId, records, fieldsToReturn) {
  const body = { to: tableId, data: records };
  if (fieldsToReturn) body.fieldsToReturn = fieldsToReturn;

  const resp = await fetch(
    `https://${QB_REALM}/v1/records`,
    _fetchOpts('POST', body)
  );
  if (!resp.ok) await _handleError(resp);
  return resp.json();
}

async function qbDelete(tableId, where) {
  const resp = await fetch(
    `https://${QB_REALM}/v1/records`,
    _fetchOpts('DELETE', { from: tableId, where })
  );
  if (!resp.ok) await _handleError(resp);
  return resp.json();
}

// ─── DATA LOADERS ──────────────────────────────────────────
async function loadPeople(activeOnly=true) {
  const where = activeOnly ? `{${FIELD.PEOPLE.active}.EX.true}` : null;
  const rows = await qbQueryAll(TABLES.people,
    [FIELD.PEOPLE.id, FIELD.PEOPLE.name, FIELD.PEOPLE.email, FIELD.PEOPLE.role,
     FIELD.PEOPLE.active, FIELD.PEOPLE.podName, FIELD.PEOPLE.tdId, FIELD.PEOPLE.partTime],
    where);
  return rows.map(r => ({
    id: val(r, FIELD.PEOPLE.id), name: val(r, FIELD.PEOPLE.name),
    email: val(r, FIELD.PEOPLE.email), role: val(r, FIELD.PEOPLE.role),
    active: val(r, FIELD.PEOPLE.active), pod: val(r, FIELD.PEOPLE.podName) || 'Unknown',
    tdId: val(r, FIELD.PEOPLE.tdId), partTime: val(r, FIELD.PEOPLE.partTime)
  })).sort((a,b) => a.pod.localeCompare(b.pod) || a.name.localeCompare(b.name));
}

async function loadProjects(excludeComplete=true) {
  const where = excludeComplete ? `{${FIELD.PROJECTS.stage}.XEX.'Complete'}` : null;
  const rows = await qbQueryAll(TABLES.projects,
    [FIELD.PROJECTS.id, FIELD.PROJECTS.name, FIELD.PROJECTS.number,
     FIELD.PROJECTS.type, FIELD.PROJECTS.stage, FIELD.PROJECTS.pod],
    where);
  return rows.map(r => ({
    id: val(r, FIELD.PROJECTS.id), name: val(r, FIELD.PROJECTS.name),
    number: val(r, FIELD.PROJECTS.number), type: val(r, FIELD.PROJECTS.type),
    stage: val(r, FIELD.PROJECTS.stage), pod: val(r, FIELD.PROJECTS.pod)
  })).sort((a,b) => (b.number||0) - (a.number||0));
}

async function loadPods() {
  const rows = await qbQueryAll(TABLES.pods,
    [FIELD.PODS.id, FIELD.PODS.name, FIELD.PODS.tdId]);
  return rows.map(r => ({
    id: val(r, FIELD.PODS.id), name: val(r, FIELD.PODS.name),
    tdId: val(r, FIELD.PODS.tdId)
  }));
}

// ─── UTILITIES ─────────────────────────────────────────────
function val(record, fieldId) { return record[fieldId]?.value ?? ''; }
function projectColor(id) { return PROJECT_COLORS[(id||0) % PROJECT_COLORS.length]; }
function podColor(name) { return POD_COLORS[name] || '#868e96'; }

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function parseDate(s) {
  if (!s) return null;
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function addDays(d, n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function getMonday(d) {
  const dt=new Date(d); const day=dt.getDay();
  const diff=dt.getDate()-day+(day===0?-6:1);
  dt.setDate(diff); dt.setHours(0,0,0,0); return dt;
}
function daysBetween(a,b) { return Math.round((b-a)/86400000); }

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─── NAV RENDERER ──────────────────────────────────────────
function renderNav(activePage) {
  // Page ID mapping (from QB Code Pages admin)
  const PAGE_IDS = {
    'scheduler.html': 15,
    'admin.html': 12,
    'reports.html': 14,
    'timesheets.html': 18,
    'leave.html': 13,
  };

  function pageUrl(name) {
    if (_authMode === 'session') {
      const pid = PAGE_IDS[name];
      if (pid) return `/db/${QB_APP}?a=dbpage&pageID=${pid}`;
      return `/db/${QB_APP}?a=dbpage&pagename=${name}`;
    }
    // Local dev: relative links, carry token
    const tokenParam = _userToken ? `?token=${_userToken}` : '';
    return `${name}${tokenParam}`;
  }

  const pages = [
    { id:'scheduler', icon:'📅', label:'Scheduler', file:'scheduler.html' },
    { id:'admin', icon:'⚙️', label:'Admin', file:'admin.html' },
    { id:'reports', icon:'📊', label:'Reports', file:'reports.html' },
    { id:'timesheets', icon:'⏱️', label:'Timesheets', file:'timesheets.html' },
    { id:'leave', icon:'🏖️', label:'Leave', file:'leave.html' },
  ];

  return `
    <div class="sidebar">
      <div class="sidebar-logo">3D</div>
      <div class="nav-items">
        ${pages.map(p => `
          <a class="nav-item ${p.id===activePage?'active':''}" href="${pageUrl(p.file)}">
            <span class="nav-icon">${p.icon}</span>
            <span class="nav-label">${p.label}</span>
          </a>
        `).join('')}
      </div>
    </div>`;
}

// ─── TOAST NOTIFICATIONS ───────────────────────────────────
function showToast(message, type='info') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const colors = { info:'var(--accent)', success:'var(--success)', error:'var(--danger)', warning:'var(--warning)' };
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position:fixed; bottom:20px; right:20px; z-index:9999;
    padding:10px 18px; border-radius:8px; font-size:13px; font-weight:500;
    background:var(--surface); border:1px solid ${colors[type]||colors.info};
    color:${colors[type]||colors.info}; box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation: toastIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, 3000);
}

const toastStyle = document.createElement('style');
toastStyle.textContent = '@keyframes toastIn { from { transform:translateY(10px);opacity:0 } to { transform:translateY(0);opacity:1 } }';
document.head.appendChild(toastStyle);
