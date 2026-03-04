(function() {
registerTab('admin', {
  icon: '⚙️', label: 'Admin',
  roles: [ROLE.ADMIN, ROLE.ADMIN_COPY],
  onInit: function() {
    document.getElementById('tab-admin').innerHTML =
      '<div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0"><div class="sched-topbar-left"></div></div>' +
      '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-dim)">' +
        '<div style="margin-bottom:12px;color:var(--text-dim)">' + ICONS.admin + '</div>' +
        '<div style="font-size:14px">People, project, and POD management coming soon.</div></div>';
  }
});
})();
