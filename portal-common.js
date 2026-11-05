/* Shared helpers for the public portal pages (scheduling and signing). */
(function () {
  'use strict';
  var KEY = 'endeavor-lang', LANGS = { en: 'en', pt: 'pt-BR', es: 'es' };
  function pick() {
    if (window.DEMO_LANG && LANGS[window.DEMO_LANG]) return window.DEMO_LANG;
    var q = null;
    try { q = new URL(location.href).searchParams.get('lang'); } catch (e) { /* ignore */ }
    if (q && LANGS[q]) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* ignore */ } return q; }
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (LANGS[s]) return s; } catch (e) { /* ignore */ }
    var n = (navigator.language || 'en').toLowerCase();
    return n.indexOf('pt') === 0 ? 'pt' : n.indexOf('es') === 0 ? 'es' : 'en';
  }

  /* Language dropdown with flags (same look as the homepage). Turns every .lang-mini nav into a dropdown. */
  var FLAGS = "  <symbol id=\"flag-us\" viewBox=\"0 0 30 20\"><rect width=\"30\" height=\"20\" fill=\"#B22234\"/><path d=\"M0 2.3h30M0 5.4h30M0 8.5h30M0 11.5h30M0 14.6h30M0 17.7h30\" stroke=\"#fff\" stroke-width=\"1.54\"/><rect width=\"13\" height=\"10.8\" fill=\"#3C3B6E\"/><g fill=\"#fff\"><circle cx=\"2.2\" cy=\"2\" r=\".6\"/><circle cx=\"5.4\" cy=\"2\" r=\".6\"/><circle cx=\"8.6\" cy=\"2\" r=\".6\"/><circle cx=\"11\" cy=\"2\" r=\".6\"/><circle cx=\"3.8\" cy=\"4.3\" r=\".6\"/><circle cx=\"7\" cy=\"4.3\" r=\".6\"/><circle cx=\"10.2\" cy=\"4.3\" r=\".6\"/><circle cx=\"2.2\" cy=\"6.5\" r=\".6\"/><circle cx=\"5.4\" cy=\"6.5\" r=\".6\"/><circle cx=\"8.6\" cy=\"6.5\" r=\".6\"/><circle cx=\"11\" cy=\"6.5\" r=\".6\"/><circle cx=\"3.8\" cy=\"8.8\" r=\".6\"/><circle cx=\"7\" cy=\"8.8\" r=\".6\"/><circle cx=\"10.2\" cy=\"8.8\" r=\".6\"/></g></symbol>\n  <symbol id=\"flag-br\" viewBox=\"0 0 30 20\"><rect width=\"30\" height=\"20\" fill=\"#009C3B\"/><path d=\"M15 2.2L27.4 10 15 17.8 2.6 10z\" fill=\"#FFDF00\"/><circle cx=\"15\" cy=\"10\" r=\"4.6\" fill=\"#002776\"/><path d=\"M10.6 9.1c3-.6 6.2-.2 8.9 1.3\" fill=\"none\" stroke=\"#fff\" stroke-width=\".9\"/></symbol>\n  <symbol id=\"flag-py\" viewBox=\"0 0 30 20\"><rect width=\"30\" height=\"20\" fill=\"#fff\"/><rect width=\"30\" height=\"6.67\" fill=\"#D52B1E\"/><rect y=\"13.33\" width=\"30\" height=\"6.67\" fill=\"#0038A8\"/><circle cx=\"15\" cy=\"10\" r=\"2.6\" fill=\"none\" stroke=\"#1F7A3A\" stroke-width=\".7\"/><circle cx=\"15\" cy=\"10\" r=\".9\" fill=\"#F7C600\"/></symbol>\n";
  var LANG_META = { en: ['us', 'EN', 'English'], pt: ['br', 'PT', 'Português (Brasil)'], es: ['py', 'ES', 'Español'] };
  function buildLangDropdowns(cur) {
    if (!document.getElementById('flag-us')) {
      var sp = document.createElement('div'); sp.setAttribute('aria-hidden', 'true'); sp.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      sp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + FLAGS + '</svg>'; document.body.insertBefore(sp, document.body.firstChild);
    }
    document.querySelectorAll('nav.lang-mini').forEach(function (nav, n) {
      if (nav.classList.contains('lang-dd')) return;
      var links = Array.prototype.slice.call(nav.querySelectorAll('a[data-lang]'));
      var m = LANG_META[cur] || LANG_META.en, id = 'lang-dd-menu-' + n;
      nav.classList.add('lang-dd', 'lang');
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'lang__toggle'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id);
      btn.innerHTML = '<svg class="flag" aria-hidden="true"><use href="#flag-' + m[0] + '"/></svg><span class="sr-only">' + (nav.getAttribute('aria-label') || 'Language') + ': </span><span class="lang__code">' + m[1] + '</span>' +
        '<svg class="icon lang__caret" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var ul = document.createElement('ul'); ul.className = 'lang__menu'; ul.id = id; ul.setAttribute('role', 'list'); ul.hidden = true;
      links.forEach(function (a) {
        var mm = LANG_META[a.dataset.lang]; if (!mm) return;
        a.innerHTML = '<svg class="flag" aria-hidden="true"><use href="#flag-' + mm[0] + '"/></svg>' + mm[2];
        a.setAttribute('lang', a.getAttribute('hreflang') || a.dataset.lang);
        var li = document.createElement('li'); li.appendChild(a); ul.appendChild(li);
      });
      nav.innerHTML = ''; nav.appendChild(btn); nav.appendChild(ul);
      var close = function (focus) { ul.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (focus) btn.focus(); };
      btn.addEventListener('click', function () { if (ul.hidden) { ul.hidden = false; btn.setAttribute('aria-expanded', 'true'); (ul.querySelector('[aria-current]') || ul.querySelector('a')).focus(); } else close(false); });
      ul.addEventListener('keydown', function (e) {
        var items = Array.prototype.slice.call(ul.querySelectorAll('a')), i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Escape') { e.stopPropagation(); close(true); }
      });
      document.addEventListener('click', function (e) { if (!ul.hidden && !nav.contains(e.target)) close(false); });
      document.addEventListener('focusin', function (e) { if (!ul.hidden && !nav.contains(e.target)) close(false); });
    });
  }
  var lang = pick();
  var CFG = window.ENDEAVOR_CFG;
  window.EP = {
    lang: lang,
    locale: LANGS[lang],
    init: function (dict) {
      var d = dict[lang] || {}, en = dict.en;
      var t = function (k) { return d[k] != null ? d[k] : (en[k] != null ? en[k] : k); };
      document.documentElement.lang = LANGS[lang];
      document.querySelectorAll('[data-t]').forEach(function (el) { var k = el.getAttribute('data-t'); if (d[k] != null) el.innerHTML = d[k]; });
      document.querySelectorAll('[data-t-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
      if (d.docTitle) document.title = d.docTitle;
      document.querySelectorAll('.lang-mini a').forEach(function (a) {
        var u = new URL(location.href); u.searchParams.set('lang', a.dataset.lang); a.href = u.pathname.split('/').pop() + u.search;
        if (a.dataset.lang === lang) a.setAttribute('aria-current', 'true');
      });
      buildLangDropdowns(lang);
      document.querySelectorAll('[data-keep-lang]').forEach(function (a) {
        var href = a.getAttribute('href'); a.setAttribute('href', href + (href.indexOf('?') > -1 ? '&' : '?') + 'lang=' + lang);
      });
      return t;
    },
    rpc: async function (fn, args) {
      var r = await fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + fn, {
        method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {})
      });
      var body = await r.json().catch(function () { return null; });
      if (!r.ok) { var e = new Error((body && body.message) || ('HTTP ' + r.status)); e.code = body && body.message; throw e; }
      return body;
    },
    fn: async function (name, payload) {
      var r = await fetch(CFG.functionsUrl + '/' + name, {
        method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      var body = await r.json().catch(function () { return null; });
      if (!r.ok || (body && body.error)) { var e = new Error((body && body.error) || ('HTTP ' + r.status)); e.code = body && body.error; throw e; }
      return body;
    },
    notify: function (fields) {
      // Best-effort email notification to the team through FormSubmit (never blocks the user flow).
      try {
        return fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ _template: 'table', _captcha: 'false' }, fields)) }).catch(function () {});
      } catch (e) { return Promise.resolve(); }
    }
  };
})();
