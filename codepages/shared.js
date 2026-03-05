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
var QB_REALM = 'lcpmedia.quickbase.com';
var QB_APP = 'bu8tkk77g';
var TABLES = {
  assignments: 'bvu4s9te6',
  people: 'bu8ttwq2f',
  projects: 'bvaitp9x5',
  milestones: 'bvu4tbpms',
  pods: 'bu8tt69gx',
  vacations: 'bvu7e3p7c'
};

var FIELD = {
  ASSIGN: { id:3, person:6, personName:7, personEmail:8, personPod:9,
    project:10, projectName:11, projectNum:12, projectStage:13, projectPod:14,
    start:15, end:16, hours:17, desc:18, workType:19, draft:20,
    priority:21, weekend:22, tdId:23, color:24 },
  PEOPLE: { id:3, name:7, email:8, role:11, active:19, podName:22, tdId:23, partTime:24 },
  PROJECTS: { id:3, name:19, number:23, type:26, stage:27, pod:82, deal:52 },
  MILESTONES: { id:3, project:6, projectName:7, projectNum:8, name:10, phase:11, start:12, end:13 },
  PODS: { id:3, name:6, tdId:11 },
  VACATION: { id:3, person:6, personName:7, personEmail:8, personPod:9, personTdId:10, start:11, end:12, type:13, status:14, notes:15 }
};

var POD_COLORS = {
  'Max POD':'#ff6b6b', 'Polina POD':'#ffa94d', 'Grzegorz POD':'#69db7c',
  'Evgeniy POD':'#68B6E5', 'George POD':'#cc5de8', 'Polish office':'#868e96',
  'TourBuilder':'#20c997'
};

var PROJECT_COLORS = [
  '#4dabf7','#69db7c','#ffa94d','#ff6b6b','#cc5de8','#20c997','#ffd43b',
  '#748ffc','#f783ac','#63e6be','#a9e34b','#e599f7','#74c0fc','#ffa8a8',
  '#8ce99a','#ffe066','#b197fc','#66d9e8','#fab005','#ff8787'
];

var WORK_TYPES = ['Modelling','GreyScale','FloorPlans','Animatic','SiteMap','Extra'];
var DRAFT_PHASES = ['Draft 1','Draft 2','Final','Animation','Extra 1','Extra 2','Extra 3','Extra 4'];
var PRIORITIES = ['High','Medium','Low'];
var VACATION_TYPES = ['Vacation','Sick','Personal','Holiday','Other'];
var VACATION_STATUSES = ['Pending','Approved','Denied'];
var PROJECT_STAGES = ['Pre-Production','In Production','Complete'];
var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];


// ─── THEME ─────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next === 'dark' ? '' : 'light');
  if (next === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', 'light');
  try { localStorage.setItem('lcp3d-theme', next); } catch(e) {}
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon) icon.textContent = next === 'light' ? '🌙' : '☀️';
  if (label) label.textContent = next === 'light' ? 'Dark Mode' : 'Light Mode';
}
// Restore saved theme
(function() {
  try {
    var saved = localStorage.getItem('lcp3d-theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      // Update icon after DOM is ready
      setTimeout(function() {
        var icon = document.getElementById('themeIcon');
        var label = document.getElementById('themeLabel');
        if (icon) icon.textContent = '🌙';
        if (label) label.textContent = 'Dark Mode';
      }, 0);
    }
  } catch(e) {}
})();


// ─── SVG LINE ICONS ──────────────────────────────────────────
var ICONS = {
  scheduler: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>',
  vacations: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  preproduction: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  quotes: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  reports: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  timesheets: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  admin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  ticket: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>'
};
// ─── AUTH ──────────────────────────────────────────────────
var _authMode = null;   // 'session' | 'token'
var _userToken = '';     // Only used in token mode

// Temp token cache: { tableId: { token, expiresAt } }
var _tempTokens = {};
var TEMP_TOKEN_LIFETIME = 4 * 60 * 1000; // Refresh at 4 min (expires at 5)

/**
 * Detect environment and set auth mode.
 * 
 * QB Code Page (on *.quickbase.com):
 *   → Uses getTempTokenDBID endpoint to get per-table temp tokens
 *   → withCredentials:true sends QB session cookie to api.quickbase.com
 *   → Temp tokens scoped to logged-in user's permissions
 *   → Tokens auto-refresh every 4 minutes (5 min expiry)
 *
 * Local dev / standalone:
 *   → Requires explicit QB-USER-TOKEN
 *   → Data access = token owner's permissions
 */
function initAuth() {
  const hostname = window.location.hostname;
  const isQBOrigin = hostname === QB_REALM ||
                     hostname.endsWith('.quickbase.com');

  if (isQBOrigin) {
    _authMode = 'session';
    console.log('[Auth] QB Code Page detected — using temporary tokens.');
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

/**
 * Get a temporary token for a specific table.
 * QB REST API requires per-table temp tokens when using session auth.
 * Tokens are cached and auto-refreshed before expiry.
 */
async function _getTempToken(tableId) {
  const cached = _tempTokens[tableId];
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const resp = await fetch(
    `https://api.quickbase.com/v1/auth/temporary/${tableId}`,
    {
      method: 'GET',
      headers: {
        'QB-Realm-Hostname': QB_REALM,
        'Content-Type': 'application/json'
      },
      credentials: 'include'  // Sends QB session cookie cross-origin
    }
  );

  if (!resp.ok) {
    if (resp.status === 401) {
      showToast('Session expired — please refresh the page.', 'error');
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `Auth error ${resp.status}`);
  }

  const data = await resp.json();
  const token = data.temporaryAuthorization;

  _tempTokens[tableId] = {
    token,
    expiresAt: Date.now() + TEMP_TOKEN_LIFETIME
  };

  console.log(`[Auth] Temp token acquired for table ${tableId}`);
  return token;
}

/** Build request headers for a specific table */
async function _qbHeaders(tableId) {
  const headers = {
    'QB-Realm-Hostname': QB_REALM,
    'Content-Type': 'application/json'
  };

  if (_authMode === 'session') {
    const tempToken = await _getTempToken(tableId);
    headers['Authorization'] = 'QB-TEMP-TOKEN ' + tempToken;
  } else if (_authMode === 'token' && _userToken) {
    headers['Authorization'] = 'QB-USER-TOKEN ' + _userToken;
  }

  return headers;
}

/** Build fetch options for a specific table */
async function _fetchOpts(method, body, tableId) {
  const headers = await _qbHeaders(tableId);
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  return opts;
}

/** Handle API error responses with user-friendly messages */
async function _handleError(resp, tableId) {
  const err = await resp.json().catch(() => ({}));
  const msg = err.description || err.message || `API error ${resp.status}`;

  if (resp.status === 401) {
    // Clear cached token and retry hint
    if (tableId) delete _tempTokens[tableId];
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
    `https://api.quickbase.com/v1/records/query`,
    await _fetchOpts('POST', body, tableId)
  );
  if (!resp.ok) await _handleError(resp, tableId);

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
    `https://api.quickbase.com/v1/records`,
    await _fetchOpts('POST', body, tableId)
  );
  if (!resp.ok) await _handleError(resp, tableId);
  return resp.json();
}

async function qbDelete(tableId, where) {
  const resp = await fetch(
    `https://api.quickbase.com/v1/records`,
    await _fetchOpts('DELETE', { from: tableId, where }, tableId)
  );
  if (!resp.ok) await _handleError(resp, tableId);
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

async function loadVacations(startDate, endDate) {
  var where = null;
  if (startDate && endDate) {
    where = '{' + FIELD.VACATION.end + '.OAF.' + startDate + '}AND{' + FIELD.VACATION.start + '.BF.' + endDate + '}';
  }
  var rows = await qbQueryAll(TABLES.vacations,
    [FIELD.VACATION.id, FIELD.VACATION.person, FIELD.VACATION.personName,
     FIELD.VACATION.personEmail, FIELD.VACATION.personPod, FIELD.VACATION.personTdId,
     FIELD.VACATION.start, FIELD.VACATION.end, FIELD.VACATION.type,
     FIELD.VACATION.status, FIELD.VACATION.notes],
    where);
  return rows.map(function(r) {
    return {
      id: val(r, FIELD.VACATION.id),
      personKey: String(val(r, FIELD.VACATION.personTdId)),
      personName: val(r, FIELD.VACATION.personName),
      personPod: val(r, FIELD.VACATION.personPod),
      start: val(r, FIELD.VACATION.start),
      end: val(r, FIELD.VACATION.end),
      type: val(r, FIELD.VACATION.type),
      status: val(r, FIELD.VACATION.status),
      notes: val(r, FIELD.VACATION.notes)
    };
  });
}

// ─── UTILITIES ─────────────────────────────────────────────
function val(record, fieldId) {
  const v = record[fieldId]?.value;
  if (v == null) return '';
  if (typeof v === 'object') return v.name || v.email || JSON.stringify(v);
  return v;
}
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
    { id:'vacations', icon:'🏖️', label:'Vacations', file:'vacations.html' },
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
      <div class="sidebar-bottom">
        <button class="nav-item theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode">
          <span class="nav-icon" id="themeIcon">☀️</span>
          <span class="nav-label" id="themeLabel">Light Mode</span>
        </button>
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

var toastStyle = document.createElement('style');
toastStyle.textContent = '@keyframes toastIn { from { transform:translateY(10px);opacity:0 } to { transform:translateY(0);opacity:1 } }';
document.head.appendChild(toastStyle);



// ─── TICKET SYSTEM ───────────────────────────────────────────
var TICKET_APP = 'btnit6q26';
var TICKET_TABLE = 'btnit9gpf';
var TICKET_FIELD = {
  subject: 6,
  details: 10,
  ticketType: 7,
  priority: 9,
  system: 8,
  requestedBy: 19,
  contactEmail: 22,
  department: 20,
  additionalPeople: 23,
  webLink: 38
};

var TICKET_TYPES = ['General Request','Bug Report','Feature Request','Security Issue','Major Development','Future Development','Idea for Improvment'];
var TICKET_PRIORITIES = ['04-Low','03-Medium','02-High','01-Critical'];
var TICKET_SYSTEMS = ['QuickBase','HubSpot','ClickUp','Misc API.','Other'];
var TICKET_DEPARTMENTS = ['3D','Accounting','Business Process','Client Success','Development','Executive Team','Marketing','Operations','Production','Sales Team'];

// ─── ROLE DETECTION ──────────────────────────────────────────
var ROLE = {
  VIEWER: 10,
  ADMIN: 12,
  LEADERSHIP: 13,
  SENIORS: 14,
  ADMIN_COPY: 15
};

var _currentUser = { email: '', role: null, isAdmin: false, isLeadership: false, isSenior: false };

function detectRole() {
  // QB Code Pages inject globals for the logged-in user
  if (typeof gReqRole !== 'undefined' && gReqRole) {
    _currentUser.role = parseInt(gReqRole);
  }
  if (typeof gReqEmail !== 'undefined' && gReqEmail) {
    _currentUser.email = gReqEmail;
  }
  // Fallback for local dev — admin
  if (!_currentUser.role) _currentUser.role = ROLE.ADMIN;

  _currentUser.isAdmin = (_currentUser.role === ROLE.ADMIN || _currentUser.role === ROLE.ADMIN_COPY);
  _currentUser.isLeadership = (_currentUser.role === ROLE.LEADERSHIP);
  _currentUser.isSenior = (_currentUser.role === ROLE.SENIORS);

  console.log('[Role] Detected:', _currentUser.role, 'Admin:', _currentUser.isAdmin);
  return _currentUser;
}

function currentUser() { return _currentUser; }

// ─── DATA CACHE ──────────────────────────────────────────────
// Reference data: loaded once, refreshed on demand
// Time-series data: cached by date range, incremental fetches

var _cache = {
  people: { data: null, ts: 0 },
  projects: { data: null, ts: 0 },
  pods: { data: null, ts: 0 },
  assignments: { data: [], range: { start: null, end: null }, ts: 0 },
  vacations: { data: [], range: { start: null, end: null }, ts: 0 }
};

var CACHE_TTL = {
  reference: 5 * 60 * 1000,   // people/projects/pods: 5 min
  timeseries: 2 * 60 * 1000   // assignments/vacations: 2 min
};

function _isStale(entry, ttl) {
  return !entry.data || (Date.now() - entry.ts > ttl);
}

// Reference data — load once, reuse across tabs
async function getCachedPeople(force) {
  if (!force && !_isStale(_cache.people, CACHE_TTL.reference)) return _cache.people.data;
  _cache.people.data = await loadPeople();
  _cache.people.ts = Date.now();
  return _cache.people.data;
}

async function getCachedProjects(force) {
  if (!force && !_isStale(_cache.projects, CACHE_TTL.reference)) return _cache.projects.data;
  _cache.projects.data = await loadProjects();
  _cache.projects.ts = Date.now();
  return _cache.projects.data;
}

async function getCachedPods(force) {
  if (!force && !_isStale(_cache.pods, CACHE_TTL.reference)) return _cache.pods.data;
  _cache.pods.data = await loadPods();
  _cache.pods.ts = Date.now();
  return _cache.pods.data;
}

// Time-series data — cached by date range, smart refetch
async function getCachedAssignments(startDate, endDate, force) {
  var c = _cache.assignments;
  // If same range and fresh, return cache
  if (!force && c.range.start === startDate && c.range.end === endDate && !_isStale(c, CACHE_TTL.timeseries)) {
    return c.data;
  }
  // Fetch for the requested range
  var vStart = startDate;
  var vEnd = endDate;
  var records = await qbQuery(TABLES.assignments,
    [FIELD.ASSIGN.id, FIELD.ASSIGN.person, FIELD.ASSIGN.personName, FIELD.ASSIGN.personPod,
     FIELD.ASSIGN.project, FIELD.ASSIGN.projectName, FIELD.ASSIGN.projectNum,
     FIELD.ASSIGN.start, FIELD.ASSIGN.end, FIELD.ASSIGN.hours, FIELD.ASSIGN.desc,
     FIELD.ASSIGN.workType, FIELD.ASSIGN.draft, FIELD.ASSIGN.priority, FIELD.ASSIGN.weekend],
    '{' + FIELD.ASSIGN.end + '.OAF.' + vStart + '}AND{' + FIELD.ASSIGN.start + '.BF.' + vEnd + '}',
    [{ fieldId: FIELD.ASSIGN.start, order: 'ASC' }], 2000);

  c.data = records.records.map(function(r) {
    return {
      id: val(r,FIELD.ASSIGN.id), personKey: String(val(r,FIELD.ASSIGN.person)),
      personName: val(r,FIELD.ASSIGN.personName), personPod: val(r,FIELD.ASSIGN.personPod),
      projectId: val(r,FIELD.ASSIGN.project), projectName: val(r,FIELD.ASSIGN.projectName),
      projectNum: val(r,FIELD.ASSIGN.projectNum), start: val(r,FIELD.ASSIGN.start),
      end: val(r,FIELD.ASSIGN.end), hours: val(r,FIELD.ASSIGN.hours),
      desc: val(r,FIELD.ASSIGN.desc), workType: val(r,FIELD.ASSIGN.workType),
      draft: val(r,FIELD.ASSIGN.draft), priority: val(r,FIELD.ASSIGN.priority),
      weekend: val(r,FIELD.ASSIGN.weekend)
    };
  });
  c.range = { start: startDate, end: endDate };
  c.ts = Date.now();
  return c.data;
}

async function getCachedVacations(startDate, endDate, force) {
  var c = _cache.vacations;
  if (!force && c.range.start === startDate && c.range.end === endDate && !_isStale(c, CACHE_TTL.timeseries)) {
    return c.data;
  }
  c.data = await loadVacations(startDate, endDate);
  c.range = { start: startDate, end: endDate };
  c.ts = Date.now();
  return c.data;
}

function invalidateCache(key) {
  if (_cache[key]) { _cache[key].ts = 0; }
}

function invalidateAll() {
  Object.keys(_cache).forEach(function(k) { _cache[k].ts = 0; });
}

// ─── DASHBOARD FRAMEWORK ────────────────────────────────────
// Tab registration and switching system

var _tabs = {};
var _activeTab = null;

function registerTab(id, config) {
  _tabs[id] = {
    id: id,
    icon: config.icon || '',
    label: config.label || id,
    roles: config.roles || [],      // which role IDs can see this tab
    onInit: config.onInit || null,   // called once when tab first activated
    onActivate: config.onActivate || null,  // called every time tab is shown
    onDeactivate: config.onDeactivate || null,
    initialized: false
  };
}

function getVisibleTabs() {
  var role = _currentUser.role;
  return Object.keys(_tabs).filter(function(id) {
    var t = _tabs[id];
    if (!t.roles || t.roles.length === 0) return true; // no restriction
    return t.roles.indexOf(role) !== -1;
  }).map(function(id) { return _tabs[id]; });
}

async function switchTab(id) {
  if (!_tabs[id]) return;
  var tab = _tabs[id];

  // Check role access
  if (tab.roles.length > 0 && tab.roles.indexOf(_currentUser.role) === -1) {
    showToast('You do not have access to this section', 'warning');
    return;
  }

  // Hide ALL tabs first
  document.querySelectorAll('.tab-content').forEach(function(el) { el.style.display = 'none'; });
  if (_activeTab && _tabs[_activeTab] && _tabs[_activeTab].onDeactivate) {
    _tabs[_activeTab].onDeactivate();
  }

  // Activate target
  var container = document.getElementById('tab-' + id);
  if (container) container.style.display = 'flex';

  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';
  if (!tab.initialized && tab.onInit) {
    await tab.onInit();
    tab.initialized = true;
  }

  if (tab.onActivate) await tab.onActivate();

  _activeTab = id;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.tab === id);
  });

  // Update header title and search placeholder
  var headerTitle = document.getElementById('appHeaderTitle');
  if (headerTitle) headerTitle.textContent = tab.label;
  var searchInput = document.getElementById('appSearchInput');
  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = 'Search ' + tab.label.toLowerCase() + '...';
  }

  // Update URL hash
  window.location.hash = id;
}

function renderDashboardNav() {
  var tabs = getVisibleTabs();
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var themeIcon = isLight ? ICONS.moon : ICONS.sun;
  var themeLabel = isLight ? 'Dark Mode' : 'Light Mode';

  return '<div class="sidebar">' +
    '<div class="nav-items">' +
    tabs.map(function(t) {
      var icon = ICONS[t.id] || t.icon;
      return '<a class="nav-item" data-tab="' + t.id + '" onclick="switchTab(\x27' + t.id + '\x27)" href="javascript:void(0)">' +
        '<span class="nav-icon">' + icon + '</span>' +
        '<span class="nav-label">' + t.label + '</span>' +
      '</a>';
    }).join('') +
    '</div>' +
    '<div class="sidebar-bottom">' +
      '<a class="nav-item" onclick="toggleTheme()" href="javascript:void(0)">' +
        '<span class="nav-icon" id="themeIcon">' + themeIcon + '</span>' +
        '<span class="nav-label" id="themeLabel">' + themeLabel + '</span>' +
      '</a>' +
    '</div>' +
  '</div>';
}


function renderAppHeader() {
  var darkLogo = 'https://www.lcpmedia.com/hs-fs/hubfs/LCP_Media_Logo_White_Green_PNG%20(2).png?width=600&height=206&name=LCP_Media_Logo_White_Green_PNG%20(2).png';
  var lightLogo = 'https://www.lcpmedia.com/hs-fs/hubfs/LCP%20Media_Logo-2.png?width=800&height=275&name=LCP%20Media_Logo-2.png';
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var lcpLogo = '<img src="' + (isLight ? lightLogo : darkLogo) + '" id="appLogo" alt="LCP Media" style="height:22px;width:auto">';
  var searchIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var ticketIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';

  return '<div class="app-header">' +
    '<div class="app-header-logo">' + lcpLogo + '<span>3D Projects</span>' +
      '<span class="app-header-sep">›</span>' +
      '<span class="app-header-title" id="appHeaderTitle">Scheduler</span>' +
    '</div>' +
    '<div class="app-header-search">' +
      '<span class="app-header-search-icon">' + searchIcon + '</span>' +
      '<input type="text" id="appSearchInput" placeholder="Search this app..." autocomplete="off">' +
    '</div>' +
    '<div class="app-header-right">' +
      '<button class="btn-ticket" onclick="openTicketDrawer()">' + ICONS.ticket + ' Tickets</button>' +
    '</div>' +
  '</div>';
}

function openTicket() {
  var user = currentUser();
  // Close the ticket list drawer if open, then open form drawer
  _ticketDrawerOpen = true;

  var overlay = document.getElementById('ticketDrawerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ticketDrawerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:900;opacity:0;transition:opacity 0.2s';
    overlay.onclick = function(e) { if (e.target === overlay) closeTicketDrawer(); };
    document.body.appendChild(overlay);
  }
  overlay.style.display = '';
  requestAnimationFrame(function() { overlay.style.opacity = '1'; });

  var drawer = document.getElementById('ticketDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'ticketDrawer';
    drawer.style.cssText = 'position:fixed;top:0;right:-420px;width:420px;height:100vh;background:var(--surface);border-left:1px solid var(--border);z-index:901;display:flex;flex-direction:column;transition:right 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.2)';
    document.body.appendChild(drawer);
  }

  drawer.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="color:var(--accent)">' + ICONS.ticket + '</span>' +
        '<span style="font-size:15px;font-weight:600;color:var(--text)">New Ticket</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<button onclick="closeTicketDrawer();openTicketDrawer()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:12px;text-decoration:underline">Back to list</button>' +
        '<button onclick="closeTicketDrawer()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:18px;padding:4px">&times;</button>' +
      '</div>' +
    '</div>' +
    '<div style="flex:1;overflow-y:auto;padding:16px 20px">' +
      '<div class="form-group"><label class="form-label">Subject</label><input class="form-input" id="tktSubject" placeholder="Brief description of the issue or request"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Ticket Type</label><select class="form-select" id="tktType">' +
          TICKET_TYPES.map(function(t){return '<option>'+t+'</option>';}).join('') + '</select></div>' +
        '<div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="tktPriority">' +
          TICKET_PRIORITIES.map(function(p){return '<option'+(p==='04-Low'?' selected':'')+'>'+p+'</option>';}).join('') + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">System</label><select class="form-select" id="tktSystem"><option value="">Select...</option>' +
          TICKET_SYSTEMS.map(function(s){return '<option>'+s+'</option>';}).join('') + '</select></div>' +
        '<div class="form-group"><label class="form-label">Department</label><select class="form-select" id="tktDept"><option value="">Select...</option>' +
          TICKET_DEPARTMENTS.map(function(d){return '<option>'+d+'</option>';}).join('') + '</select></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Details</label>' +
        '<textarea class="form-textarea" id="tktDetails" rows="4" placeholder="Describe the issue, steps to reproduce, or what you need..."></textarea></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Requested For / By</label>' +
          '<input class="form-input" id="tktRequestedBy" value="' + escapeHtml(user.email) + '"></div>' +
        '<div class="form-group"><label class="form-label">Contact Email</label>' +
          '<input class="form-input" type="email" id="tktEmail" value="' + escapeHtml(user.email) + '"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Additional People Affected</label>' +
        '<input class="form-input" id="tktAdditional" placeholder="Names or emails of others affected"></div>' +
      '<div class="form-group"><label class="form-label">Web Link</label>' +
        '<input class="form-input" type="url" id="tktWebLink" placeholder="https://..."></div>' +
      '<div class="form-group"><label class="form-label">Supporting File</label>' +
        '<input class="form-input" type="file" id="tktFile" style="padding:6px"></div>' +
    '</div>' +
    '<div style="padding:12px 20px;border-top:1px solid var(--border);flex-shrink:0">' +
      '<button class="btn btn-primary" onclick="submitTicket()" id="tktSubmitBtn" style="width:100%">' +
        '<span id="tktSubmitText">Submit Ticket</span></button>' +
    '</div>';

  requestAnimationFrame(function() { drawer.style.right = '0'; });
  setTimeout(function() { var el = document.getElementById('tktSubject'); if (el) el.focus(); }, 300);
}

function closeTicketModal() { closeTicketDrawer(); }

async function submitTicket() {
  var subject = document.getElementById('tktSubject').value.trim();
  if (!subject) { showToast('Subject is required', 'warning'); return; }

  var btn = document.getElementById('tktSubmitBtn');
  var btnText = document.getElementById('tktSubmitText');
  btn.disabled = true;
  btnText.textContent = 'Submitting...';

  var record = {};
  record[TICKET_FIELD.subject] = {value: subject};
  record[TICKET_FIELD.details] = {value: document.getElementById('tktDetails').value};
  record[TICKET_FIELD.ticketType] = {value: document.getElementById('tktType').value};
  record[TICKET_FIELD.priority] = {value: document.getElementById('tktPriority').value};
  var sys = document.getElementById('tktSystem').value;
  if (sys) record[TICKET_FIELD.system] = {value: sys};
  var dept = document.getElementById('tktDept').value;
  if (dept) record[TICKET_FIELD.department] = {value: dept};
  record[TICKET_FIELD.requestedBy] = {value: document.getElementById('tktRequestedBy').value};
  record[TICKET_FIELD.contactEmail] = {value: document.getElementById('tktEmail').value};
  var addl = document.getElementById('tktAdditional').value;
  if (addl) record[TICKET_FIELD.additionalPeople] = {value: addl};
  var link = document.getElementById('tktWebLink').value;
  if (link) record[TICKET_FIELD.webLink] = {value: link};

  try {
    var resp = await fetch('https://lcpmedia.quickbase.com/v1/records', {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': 'lcpmedia.quickbase.com',
        'Authorization': 'QB-USER-TOKEN b9ytiq_f9q7_0_chzcq48b95rhwnbqt4b6jfiuyp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to: TICKET_TABLE, data: [record] })
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function(){return {};});
      throw new Error(err.description || err.message || 'API error ' + resp.status);
    }
    closeTicketDrawer();
    showToast('Ticket submitted successfully', 'success');
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    btn.disabled = false;
    btnText.textContent = 'Submit Ticket';
  }
}


// ─── TICKET DRAWER ───────────────────────────────────────────
var _ticketDrawerOpen = false;
var _myTickets = [];

function openTicketDrawer() {
  if (_ticketDrawerOpen) { closeTicketDrawer(); return; }
  _ticketDrawerOpen = true;

  var overlay = document.getElementById('ticketDrawerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ticketDrawerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:900;opacity:0;transition:opacity 0.2s';
    overlay.onclick = function(e) { if (e.target === overlay) closeTicketDrawer(); };
    document.body.appendChild(overlay);
  }
  overlay.style.display = '';
  requestAnimationFrame(function() { overlay.style.opacity = '1'; });

  var drawer = document.getElementById('ticketDrawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'ticketDrawer';
    drawer.style.cssText = 'position:fixed;top:0;right:-420px;width:420px;height:100vh;background:var(--surface);border-left:1px solid var(--border);z-index:901;display:flex;flex-direction:column;transition:right 0.25s ease;box-shadow:-4px 0 24px rgba(0,0,0,0.2)';
    document.body.appendChild(drawer);
  }
  drawer.innerHTML = buildDrawerHTML();
  requestAnimationFrame(function() { drawer.style.right = '0'; });

  loadMyTickets();
}

function closeTicketDrawer() {
  _ticketDrawerOpen = false;
  var drawer = document.getElementById('ticketDrawer');
  if (drawer) drawer.style.right = '-420px';
  var overlay = document.getElementById('ticketDrawerOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(function() { overlay.style.display = 'none'; }, 200);
  }
}

function buildDrawerHTML() {
  return '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">' +
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<span style="color:var(--accent)">' + ICONS.ticket + '</span>' +
      '<span style="font-size:15px;font-weight:600;color:var(--text)">My Tickets</span>' +
    '</div>' +
    '<button onclick="closeTicketDrawer()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:18px;padding:4px">&times;</button>' +
  '</div>' +
  '<div style="display:flex;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border);flex-shrink:0">' +
    '<button class="btn btn-sm btn-active" id="tktFilterAll" onclick="filterDrawerTickets(\x27all\x27)">All</button>' +
    '<button class="btn btn-sm" id="tktFilterOpen" onclick="filterDrawerTickets(\x27open\x27)">Open</button>' +
    '<button class="btn btn-sm" id="tktFilterClosed" onclick="filterDrawerTickets(\x27closed\x27)">Closed</button>' +
  '</div>' +
  '<div id="ticketDrawerList" style="flex:1;overflow-y:auto;padding:12px 20px">' +
    '<div style="text-align:center;color:var(--text-dim);padding:40px 0">Loading tickets...</div>' +
  '</div>' +
  '<div style="padding:12px 20px;border-top:1px solid var(--border);flex-shrink:0">' +
    '<button class="btn btn-primary" onclick="openTicket()" style="width:100%">' + ICONS.ticket + ' New Ticket</button>' +
  '</div>';
}

var _drawerFilter = 'all';

function filterDrawerTickets(filter) {
  _drawerFilter = filter;
  document.querySelectorAll('#ticketDrawer .btn-sm').forEach(function(b) { b.classList.remove('btn-active'); });
  var btnId = filter === 'all' ? 'tktFilterAll' : filter === 'open' ? 'tktFilterOpen' : 'tktFilterClosed';
  var btn = document.getElementById(btnId);
  if (btn) btn.classList.add('btn-active');
  renderDrawerTickets();
}

async function loadMyTickets() {
  try {
    var userEmail = _currentUser.email || '';
    var where = userEmail ? '{31.EX.' + userEmail + '}' : null;
    var resp = await fetch('https://lcpmedia.quickbase.com/v1/records/query', {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': 'lcpmedia.quickbase.com',
        'Authorization': 'QB-USER-TOKEN b9ytiq_f9q7_0_chzcq48b95rhwnbqt4b6jfiuyp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: TICKET_TABLE,
        select: [3, 6, 7, 9, 12, 24, 29],
        where: where,
        sortBy: [{ fieldId: 29, order: 'DESC' }],
        options: { top: 50 }
      })
    });
    if (!resp.ok) throw new Error('Failed to load tickets');
    var data = await resp.json();
    _myTickets = (data.data || []).map(function(r) {
      return {
        id: r[3] ? r[3].value : '',
        subject: r[6] ? r[6].value : '',
        type: r[7] ? r[7].value : '',
        priority: r[9] ? r[9].value : '',
        status: r[12] ? r[12].value : '',
        ticketId: r[24] ? r[24].value : '',
        dateOpened: r[29] ? r[29].value : ''
      };
    });
    renderDrawerTickets();
  } catch(e) {
    document.getElementById('ticketDrawerList').innerHTML =
      '<div style="text-align:center;color:var(--danger);padding:40px 0">Error loading tickets: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderDrawerTickets() {
  var list = document.getElementById('ticketDrawerList');
  if (!list) return;

  var filtered = _myTickets;
  if (_drawerFilter === 'open') {
    filtered = _myTickets.filter(function(t) { return t.status && t.status !== 'Closed' && t.status !== 'Resolved'; });
  } else if (_drawerFilter === 'closed') {
    filtered = _myTickets.filter(function(t) { return t.status === 'Closed' || t.status === 'Resolved'; });
  }

  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px 0">No tickets found</div>';
    return;
  }

  list.innerHTML = filtered.map(function(t) {
    var priColor = t.priority === '01-Critical' ? 'var(--danger)' :
                   t.priority === '02-High' ? 'var(--warning)' :
                   t.priority === '03-Medium' ? 'var(--accent)' : 'var(--text-dim)';
    var statusClass = (!t.status || t.status === 'Open' || t.status === 'New') ? 'badge-warning' :
                      (t.status === 'In Progress') ? 'badge-info' :
                      (t.status === 'Closed' || t.status === 'Resolved') ? 'badge-success' : 'badge-neutral';
    var dateStr = '';
    if (t.dateOpened) {
      var d = new Date(t.dateOpened);
      dateStr = MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    var url = 'https://lcpmedia.quickbase.com/db/btnit9gpf?a=dr&rid=' + t.id;

    return '<a href="' + url + '" target="_blank" style="text-decoration:none;display:block;padding:12px;margin-bottom:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;transition:border-color 0.15s;cursor:pointer" onmouseenter="this.style.borderColor=\x27var(--accent)\x27" onmouseleave="this.style.borderColor=\x27var(--border)\x27">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
        '<span style="font-size:11px;font-family:JetBrains Mono,monospace;color:var(--text-dim)">' + escapeHtml(t.ticketId || '#' + t.id) + '</span>' +
        '<span class="badge ' + statusClass + '">' + escapeHtml(t.status || 'New') + '</span>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:6px;line-height:1.3">' + escapeHtml(t.subject || 'No subject') + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-dim)">' +
        '<span style="color:' + priColor + '">' + escapeHtml(t.priority || '') + '</span>' +
        (t.type ? '<span>·</span><span>' + escapeHtml(t.type) + '</span>' : '') +
        (dateStr ? '<span style="margin-left:auto">' + dateStr + '</span>' : '') +
      '</div>' +
    '</a>';
  }).join('');
}

function renderTabContainers() {
  var tabs = getVisibleTabs();
  return tabs.map(function(t) {
    return '<div id="tab-' + t.id + '" class="tab-content" style="display:none"></div>';
  }).join('');
}

// Theme toggle (from previous implementation)
function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var next = current === 'light' ? 'dark' : 'light';
  if (next === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', 'light');
  try { localStorage.setItem('lcp3d-theme', next); } catch(e) {}
  var icon = document.getElementById('themeIcon');
  if (icon) icon.innerHTML = next === 'light' ? ICONS.moon : ICONS.sun;
  var label = document.getElementById('themeLabel');
  if (label) label.textContent = next === 'light' ? 'Dark Mode' : 'Light Mode';
  var logo = document.getElementById('appLogo');
  if (logo) logo.src = next === 'light' ? 'https://www.lcpmedia.com/hs-fs/hubfs/LCP%20Media_Logo-2.png?width=800&height=275&name=LCP%20Media_Logo-2.png' : 'https://www.lcpmedia.com/hs-fs/hubfs/LCP_Media_Logo_White_Green_PNG%20(2).png?width=600&height=206&name=LCP_Media_Logo_White_Green_PNG%20(2).png';
}

// Restore theme on load
(function() {
  try {
    var saved = localStorage.getItem('lcp3d-theme');
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch(e) {}
})();
