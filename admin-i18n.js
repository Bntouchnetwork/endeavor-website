/* Admin console language (Portuguese or English).
   The console is written in Portuguese; in English, the visible texts are swapped on screen with the ADMIN_EN dictionary.
   Choice: ?lang=en|pt, then the saved choice, then Portuguese. */
(function () {
  'use strict';
  var KEY = 'endeavor-admin-lang';
  var lang = 'pt';
  try { var q = new URLSearchParams(location.search).get('lang'); if (q === 'en' || q === 'pt') { localStorage.setItem(KEY, q); lang = q; } else if (localStorage.getItem(KEY) === 'en') lang = 'en'; } catch (e) { /* storage blocked */ }
  if (window.DEMO_ADMIN_LANG) lang = window.DEMO_ADMIN_LANG;
  window.ADMIN_LANG = lang;
  window.ADMIN_LOCALE = lang === 'en' ? 'en-US' : 'pt-BR';
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';

  // language selector with flags in the header (PT / EN)
  function mountSelector() {
    var right = document.querySelector('.portal-top__right'); if (!right || document.getElementById('admin-lang')) return;
    var nav = document.createElement('nav'); nav.className = 'lang-mini'; nav.id = 'admin-lang'; nav.setAttribute('aria-label', lang === 'en' ? 'Language' : 'Idioma');
    nav.innerHTML = '<a href="?lang=pt" hreflang="pt-BR" data-lang="pt"' + (lang === 'pt' ? ' aria-current="true"' : '') + '>PT</a><a href="?lang=en" hreflang="en" data-lang="en"' + (lang === 'en' ? ' aria-current="true"' : '') + '>EN</a>';
    right.insertBefore(nav, right.firstChild);
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lang]'); if (!a) return;
      e.preventDefault();
      try { localStorage.setItem(KEY, a.dataset.lang); } catch (x) { /* ignore */ }
      if (window.ERoute && ERoute.virtual) { window.DEMO_ADMIN_LANG = a.dataset.lang; }
      location.href = location.pathname + '?lang=' + a.dataset.lang + location.hash; // keep the current screen
    });
    if (window.EP && EP.langMenu) EP.langMenu(lang);
  }

  if (lang !== 'en') { document.addEventListener('DOMContentLoaded', mountSelector); return; }

  var D = window.ADMIN_EN || {}, RX = window.ADMIN_EN_RX || [];
  // longer Portuguese fragments are also replaced inside mixed texts (labels built with names, dates or numbers)
  var FRAG = Object.keys(D).filter(function (k) { return k.length >= 14; }).sort(function (a, b) { return b.length - a.length; });
  function tr(s) {
    if (!s) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), core = m[2];
    if (!core || !/[A-Za-zÀ-ú]/.test(core)) return s;
    if (Object.prototype.hasOwnProperty.call(D, core)) return m[1] + D[core] + m[3];
    for (var i = 0; i < RX.length; i++) if (RX[i][0].test(core)) return m[1] + core.replace(RX[i][0], RX[i][1]) + m[3];
    // compound lines "a · b · c": translate each part that is a known label
    if (core.indexOf(' · ') > -1) {
      var parts = core.split(' · '), changed = false;
      parts = parts.map(function (x) { var y = tr(x); if (y !== x) changed = true; return y; });
      if (changed) return m[1] + parts.join(' · ') + m[3];
    }
    var out = core, hit = false;
    for (var j = 0; j < FRAG.length; j++) if (out.indexOf(FRAG[j]) > -1) { out = out.split(FRAG[j]).join(D[FRAG[j]]); hit = true; }
    return hit ? m[1] + out + m[3] : s;
  }
  window.ADMIN_T = tr;
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  function fixEl(el) {
    for (var i = 0; i < ATTRS.length; i++) { var v = el.getAttribute && el.getAttribute(ATTRS[i]); if (v) { var t = tr(v); if (t !== v) el.setAttribute(ATTRS[i], t); } }
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) { var tv = tr(el.value); if (tv !== el.value) el.value = tv; }
  }
  function walk(root) {
    if (root.nodeType === 3) { var p = root.parentNode; if (p && !SKIP[p.nodeName] && !(p.closest && p.closest('[data-no-i18n]'))) { var t = tr(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; } return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName] || (root.hasAttribute && root.hasAttribute('data-no-i18n'))) return;
    fixEl(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 1) { if (SKIP[n.nodeName]) continue; fixEl(n); continue; }
      var par = n.parentNode; if (!par || SKIP[par.nodeName] || (par.closest && par.closest('[data-no-i18n]'))) continue;
      var tt = tr(n.nodeValue); if (tt !== n.nodeValue) n.nodeValue = tt;
    }
  }
  var busy = false;
  var mo = new MutationObserver(function (list) {
    if (busy) return; busy = true;
    try {
      list.forEach(function (r) {
        if (r.type === 'characterData') walk(r.target);
        else if (r.type === 'attributes') fixEl(r.target);
        else r.addedNodes.forEach(walk);
      });
    } finally { mo.takeRecords(); busy = false; }
  });
  function start() {
    document.title = tr(document.title);
    walk(document.body);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    mountSelector();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  // browser dialogs used by the console
  var A = window.alert, C = window.confirm, P = window.prompt;
  window.alert = function (m) { return A.call(window, tr(String(m))); };
  window.confirm = function (m) { return C.call(window, tr(String(m))); };
  window.prompt = function (m, d) { return P.call(window, tr(String(m)), d); };
})();
