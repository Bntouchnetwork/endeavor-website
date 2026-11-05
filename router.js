/* Tiny hash router used by the admin console and the client portal.
   Normally it reads and writes location.hash. In embedded previews (iframes rendered from a string, where
   "#/..." links would navigate away), set window.ENDEAVOR_VIRTUAL_ROUTES = true and routes are kept in memory. */
(function () {
  'use strict';
  var virtual = !!window.ENDEAVOR_VIRTUAL_ROUTES, cur = '';
  function fire() { try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { window.dispatchEvent(new Event('hashchange')); } }
  var R = {
    virtual: virtual,
    get: function () { return virtual ? cur : location.hash; },
    set: function (h, replace) {
      h = h || '';
      if (!virtual) {
        if (replace) { try { history.replaceState(null, '', h || location.pathname + location.search); } catch (e) { /* ignore */ } }
        else location.hash = h;
        return;
      }
      var changed = h !== cur; cur = h;
      if (!replace && changed) fire();
    },
    go: function (url) { if (/^#/.test(url)) R.set(url); else location.href = url; }
  };
  if (virtual) {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      var h = a.getAttribute('href');
      e.preventDefault();
      if (/^#\//.test(h)) { R.set(h); return; }
      var t = h.length > 1 && document.getElementById(h.slice(1));
      if (t) { if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1'); t.scrollIntoView(); t.focus({ preventScroll: true }); }
    });
  }
  window.ERoute = R;
})();
