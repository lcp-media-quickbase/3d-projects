(function() {
registerTab('reports', {
  icon: '📊', label: 'Reports',
  roles: [ROLE.ADMIN, ROLE.LEADERSHIP, ROLE.ADMIN_COPY],
  onInit: function() {
    document.getElementById('tab-reports').innerHTML =
      '<div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0"><div class="sched-topbar-left"></div></div>' +
      '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-dim)">' +
        '<div style="margin-bottom:12px;color:var(--text-dim)">' + ICONS.reports + '</div>' +
        '<div style="font-size:14px">Utilization reports and capacity analysis coming soon.</div></div>';
  }
});
})();
