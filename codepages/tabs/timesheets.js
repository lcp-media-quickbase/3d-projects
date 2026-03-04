(function() {
registerTab('timesheets', {
  icon: '⏱️', label: 'Timesheets',
  roles: ALL_ROLES,
  onInit: function() {
    document.getElementById('tab-timesheets').innerHTML =
      '<div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0"><div class="sched-topbar-left"><div class="page-title">Timesheets</div></div></div>' +
      '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-dim)">' +
        '<div style="margin-bottom:12px;color:var(--text-dim)">' + ICONS.timesheets + '</div>' +
        '<div style="font-size:14px">Weekly time entry coming soon.</div></div>';
  }
});
})();
