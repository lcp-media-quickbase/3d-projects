(function() {
registerTab('quotes', {
  icon: '💰', label: 'Quotes',
  roles: ALL_ROLES,
  onInit: function() {
    document.getElementById('tab-quotes').innerHTML =
      '<div class="sched-topbar" style="border-bottom:1px solid var(--border);flex-shrink:0"><div class="sched-topbar-left"><div class="page-title"><span>💰</span> Quotes</div></div></div>' +
      '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--text-dim)">' +
        '<div style="font-size:40px;margin-bottom:12px">💰</div>' +
        '<div style="font-size:14px">Quote management coming soon.</div></div>';
  }
});
})();
