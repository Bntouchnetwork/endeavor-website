/* Fixed-page layout for the consoles (admin, client and partner portals).
   On desktop, the page frame never scrolls: the title, tabs, KPIs and toolbars stay fixed, and only the
   content panels below them scroll inside their own area. On phones the page scrolls normally. */
(function () {
  'use strict';
  var FIXED = '.console__head, .subtabs, .kpis, .toolbar, .tpl-pick, .portal-alert, .back-link, .tl-steps--oa';
  // a short paragraph made only of in-app links ("← Back", breadcrumbs like "Clientes /")
  function isBackLink(el) { return el.tagName === 'P' && el.children.length > 0 && el.textContent.trim().length < 80 && Array.prototype.every.call(el.children, function (c) { return c.tagName === 'A' && /^#/.test(c.getAttribute('href') || ''); }); }
  function fixedEl(el) { return el.matches(FIXED) || isBackLink(el); }
  var busy = false;
  function fit(view) {
    if (busy || view.classList.contains('is-editor')) return;
    var kids = Array.prototype.slice.call(view.children);
    if (!kids.length) return;
    var bi = kids.findIndex(function (k) { return k.classList.contains('fit-body'); });
    if (bi === kids.length - 1 && kids.slice(0, bi).every(function (k) { return k.classList.contains('fit-fixed'); })) return;
    busy = true;
    var body = view.querySelector(':scope > .fit-body');
    if (!body) { body = document.createElement('div'); body.className = 'fit-body'; }
    var started = false;
    kids.forEach(function (k) {
      if (k === body) { started = true; return; }
      if (!started && fixedEl(k) && !(k.classList.contains('portal-alert') && !k.textContent.trim())) { k.classList.add('fit-fixed'); return; }
      started = true; body.appendChild(k);
    });
    if (!body.parentNode) view.appendChild(body);
    view.classList.toggle('fit-has-dash', !!body.querySelector(':scope > .dash, :scope > .checkout, :scope > .ref-board'));
    busy = false;
  }
  function watch(view) {
    if (view.__fit) return; view.__fit = true;
    new MutationObserver(function () { fit(view); }).observe(view, { childList: true });
    fit(view);
  }
  function scan() { var v = document.getElementById('view'); if (v) watch(v); }
  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('app') || document.body;
    new MutationObserver(scan).observe(app, { childList: true, subtree: true });
    scan();
  });
})();
