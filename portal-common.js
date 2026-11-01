/* Shared helpers for the public portal pages (scheduling and signing). */
(function () {
  'use strict';
  var KEY = 'endeavor-lang', LANGS = { en: 'en', pt: 'pt-BR', es: 'es' };
  function pick() {
    var q = null;
    try { q = new URL(location.href).searchParams.get('lang'); } catch (e) { /* ignore */ }
    if (q && LANGS[q]) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch (e) { /* ignore */ } return q; }
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (LANGS[s]) return s; } catch (e) { /* ignore */ }
    var n = (navigator.language || 'en').toLowerCase();
    return n.indexOf('pt') === 0 ? 'pt' : n.indexOf('es') === 0 ? 'es' : 'en';
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
