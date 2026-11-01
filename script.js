/* Endeavor Business Solutions — script.js
   Minimal, dependency-free behavior: navigation, reveal, accessibility tools, form validation. */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Safe storage ---------- */
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };


  /* ---------- Languages (EN / PT-BR / ES) ---------- */
  var I18N = window.ENDEAVOR_I18N || { text: {}, ui: { en: {} }, meta: {} };
  var LANG_KEY = 'endeavor-lang';
  var LANGS = { en: { html: 'en', code: 'EN', flag: '#flag-us' }, pt: { html: 'pt-BR', code: 'PT', flag: '#flag-br' }, es: { html: 'es', code: 'ES', flag: '#flag-py' } };
  var lang = 'en';
  function ui(k) { var d = I18N.ui[lang] || {}; return d[k] || (I18N.ui.en || {})[k] || k; }
  function tr(s) { if (lang === 'en') return s; var d = I18N.text[lang] || {}; return d[s] || s; }

  // Collect translatable text nodes and aria-labels once (English source)
  var textEntries = [];
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      var p = n.parentElement;
      if (!p || p.closest('script, style, svg, [translate="no"], [data-i18n-skip]')) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  var tn;
  while ((tn = walker.nextNode())) {
    var raw = tn.nodeValue;
    textEntries.push({ node: tn, key: raw.replace(/\s+/g, ' ').trim(), lead: (raw.match(/^\s*/) || [''])[0], trail: (raw.match(/\s*$/) || [''])[0] });
  }
  var ariaEntries = Array.prototype.slice.call(document.querySelectorAll('[aria-label]'))
    .filter(function (el) { return !el.closest('[translate="no"]'); })
    .map(function (el) { return { el: el, key: el.getAttribute('aria-label') }; });

  var langToggle = document.getElementById('lang-toggle');
  var langMenu = document.getElementById('lang-menu');
  var metaDesc = document.querySelector('meta[name="description"]');
  var ogLocale = document.querySelector('meta[property="og:locale"]');

  function setLanguage(next, persist) {
    if (!LANGS[next]) next = 'en';
    lang = next;
    textEntries.forEach(function (e) { e.node.nodeValue = e.lead + tr(e.key) + e.trail; });
    ariaEntries.forEach(function (e) { e.el.setAttribute('aria-label', tr(e.key)); });
    doc.lang = LANGS[lang].html;
    var m = (I18N.meta && I18N.meta[lang]) || null;
    if (m) { document.title = m.title; if (metaDesc) metaDesc.content = m.description; if (ogLocale) ogLocale.content = m.locale; }
    // switcher state
    document.getElementById('lang-current-flag').setAttribute('href', LANGS[lang].flag);
    document.getElementById('lang-current-code').textContent = LANGS[lang].code;
    langToggle.querySelector('[data-i18n-ui="language"]').textContent = ui('language');
    langMenu.querySelectorAll('[data-lang]').forEach(function (b) {
      if (b.getAttribute('data-lang') === lang) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    // dynamic UI
    if (typeof toggleLabel !== 'undefined' && toggleLabel) toggleLabel.textContent = nav.classList.contains('is-open') ? ui('close') : ui('menu');
    // WhatsApp links carry a greeting in the current language
    document.querySelectorAll('#wa-float, .js-wa').forEach(function (l) {
      l.href = 'https://wa.me/16306898702?text=' + encodeURIComponent(ui('waText'));
    });
    if (typeof rules !== 'undefined') {
      rules.forEach(function (r) { if (document.getElementById(r.id).getAttribute('aria-invalid') === 'true') validateField(r); });
      renderSummary();
      if (formSent) statusEl.textContent = ui('success');
      var sl = document.getElementById('form-submit-label'); if (sl && !document.getElementById('form-submit').disabled) sl.textContent = tr('Send Request');
    }
    if (persist) {
      store.set(LANG_KEY, lang);
      try { var u = new URL(window.location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); } catch (e) { /* ignore */ }
    }
  }
  function openLangMenu() { langMenu.hidden = false; langToggle.setAttribute('aria-expanded', 'true'); var cur = langMenu.querySelector('[aria-current="true"]'); (cur || langMenu.querySelector('button')).focus(); }
  function closeLangMenu(returnFocus) { langMenu.hidden = true; langToggle.setAttribute('aria-expanded', 'false'); if (returnFocus) langToggle.focus(); }
  langToggle.addEventListener('click', function () { langMenu.hidden ? openLangMenu() : closeLangMenu(false); });
  langMenu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) { setLanguage(b.getAttribute('data-lang'), true); closeLangMenu(true); }
  });
  langMenu.addEventListener('keydown', function (e) {
    var items = Array.prototype.slice.call(langMenu.querySelectorAll('button'));
    var i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); closeLangMenu(true); }
  });
  document.addEventListener('click', function (e) { if (!langMenu.hidden && !e.target.closest('#lang')) closeLangMenu(false); });
  document.addEventListener('focusin', function (e) { if (!langMenu.hidden && !e.target.closest('#lang')) closeLangMenu(false); });

  function initialLanguage() {
    var q = null;
    try { q = new URL(window.location.href).searchParams.get('lang'); } catch (e) { /* ignore */ }
    if (q && LANGS[q]) return q;
    var saved = store.get(LANG_KEY);
    if (saved && LANGS[saved]) return saved;
    var nl = (navigator.language || 'en').toLowerCase();
    if (nl.indexOf('pt') === 0) return 'pt';
    if (nl.indexOf('es') === 0) return 'es';
    return 'en';
  }

  /* ---------- Header: scrolled state ---------- */
  var header = document.getElementById('site-header');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
  // Keep the mobile menu and anchor offsets aligned with the real header height (it can wrap at large text sizes)
  var syncHeader = function () { doc.style.setProperty('--header-offset', header.offsetHeight + 'px'); };
  if ('ResizeObserver' in window) new ResizeObserver(syncHeader).observe(header);
  syncHeader();
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile navigation ---------- */
  var nav = document.getElementById('primary-nav');
  var toggle = document.querySelector('.menu-toggle');
  var toggleLabel = toggle.querySelector('.menu-toggle__label');
  var desktopQuery = window.matchMedia('(min-width: 1360px)');

  function setMenu(open, returnFocus) {
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? ui('close') : ui('menu');
    nav.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false, true);
  });
  // Keep focus inside the open mobile menu (header + nav)
  document.addEventListener('focusin', function (e) {
    if (nav.classList.contains('is-open') && !header.contains(e.target) && !e.target.closest('.a11y')) {
      var first = nav.querySelector('a');
      if (first) first.focus();
    }
  });
  var onBreakpoint = function () { if (desktopQuery.matches && !doc.classList.contains('a11y-large')) setMenu(false); };
  if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', onBreakpoint);

  /* ---------- Current section in nav ---------- */
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll('.nav__list a[href^="#"]'));
  if ('IntersectionObserver' in window) {
    var sectionMap = {};
    navLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var el = id === 'top' ? null : document.getElementById(id);
      if (el) sectionMap[id] = a;
    });
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          navLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
          var link = sectionMap[entry.target.id];
          if (link) link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(sectionMap).forEach(function (id) { navObserver.observe(document.getElementById(id)); });
  }

  /* ---------- Reveal on scroll (motion only) ---------- */
  function motionAllowed() { return !reduceMotionQuery.matches && !doc.classList.contains('a11y-motion'); }
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && motionAllowed()) {
    doc.classList.add('js-reveal');
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); obs.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Prefill "Type of Assistance" from CTAs ---------- */
  var assistSelect = document.getElementById('f-assist');
  document.querySelectorAll('[data-assist]').forEach(function (a) {
    a.addEventListener('click', function () { assistSelect.value = a.getAttribute('data-assist'); });
  });

  /* ---------- Accessibility tools ---------- */
  var A11Y_KEY = 'endeavor-a11y';
  var sizes = [90, 100, 112.5, 125, 137.5, 150];
  var state = store.get(A11Y_KEY) || {};
  if (typeof state.size !== 'number' || sizes.indexOf(state.size) === -1) state.size = 100;
  state.modes = state.modes || {};

  var panel = document.getElementById('a11y-panel');
  var a11yToggle = document.getElementById('a11y-toggle');
  var a11yClose = document.getElementById('a11y-close');
  var sizeOut = document.getElementById('a11y-size-value');
  var btnDown = panel.querySelector('[data-a11y="text-down"]');
  var btnUp = panel.querySelector('[data-a11y="text-up"]');
  var modeButtons = panel.querySelectorAll('[data-a11y-toggle]');

  function applyA11y() {
    doc.style.fontSize = state.size === 100 ? '' : state.size + '%';
    // Also covers visitors whose browser default font size is larger than 16px
    doc.classList.toggle('a11y-large', parseFloat(getComputedStyle(doc).fontSize) > 17);
    sizeOut.textContent = (state.size % 1 ? state.size.toFixed(1) : state.size) + '%';
    btnDown.disabled = state.size === sizes[0];
    btnUp.disabled = state.size === sizes[sizes.length - 1];
    modeButtons.forEach(function (b) {
      var m = b.getAttribute('data-a11y-toggle');
      var on = !!state.modes[m];
      doc.classList.toggle('a11y-' + m, on);
      b.setAttribute('aria-pressed', String(on));
    });
    if (state.modes.motion) {
      doc.classList.remove('js-reveal');
    }
  }
  function save() { store.set(A11Y_KEY, state); }

  function openPanel() {
    panel.hidden = false;
    a11yToggle.setAttribute('aria-expanded', 'true');
    a11yClose.focus();
  }
  function closePanel(returnFocus) {
    panel.hidden = true;
    a11yToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) a11yToggle.focus();
  }
  a11yToggle.addEventListener('click', function () { panel.hidden ? openPanel() : closePanel(false); });
  a11yClose.addEventListener('click', function () { closePanel(true); });
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); closePanel(true); }
  });
  document.addEventListener('click', function (e) {
    if (!panel.hidden && !e.target.closest('#a11y')) closePanel(false);
  });

  btnDown.addEventListener('click', function () {
    var i = sizes.indexOf(state.size); if (i > 0) { state.size = sizes[i - 1]; applyA11y(); save(); }
  });
  btnUp.addEventListener('click', function () {
    var i = sizes.indexOf(state.size); if (i < sizes.length - 1) { state.size = sizes[i + 1]; applyA11y(); save(); }
  });
  modeButtons.forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.getAttribute('data-a11y-toggle');
      state.modes[m] = !state.modes[m];
      applyA11y(); save();
    });
  });
  panel.querySelector('[data-a11y="reset"]').addEventListener('click', function () {
    state = { size: 100, modes: {} };
    store.del(A11Y_KEY);
    applyA11y();
    sizeOut.textContent = '100%';
  });
  applyA11y();

  /* ---------- Contact form validation ---------- */
  var form = document.getElementById('contact-form');
  var summary = document.getElementById('form-summary');
  var statusEl = document.getElementById('form-status');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var rules = [
    { id: 'f-name', label: 'Name', test: function (v) { return v.trim().length > 1; }, msg: 'errName' },
    { id: 'f-email', label: 'Email', test: function (v) { return emailRe.test(v.trim()); }, msg: 'errEmail' },
    { id: 'f-assist', label: 'Type of Assistance', test: function (v) { return v !== ''; }, msg: 'errAssist' },
    { id: 'f-message', label: 'Message', test: function (v) { return v.trim().length >= 10; }, msg: 'errMessage' }
  ];
  var lastFailed = null;
  var formSent = false;

  function validateField(rule) {
    var el = document.getElementById(rule.id);
    var err = document.getElementById(rule.id + '-err');
    var ok = rule.test(el.value);
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    err.textContent = ok ? '' : ui(rule.msg);
    return ok;
  }

  rules.forEach(function (rule) {
    var el = document.getElementById(rule.id);
    el.addEventListener('blur', function () { if (el.getAttribute('aria-invalid') === 'true' || el.value) validateField(rule); });
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') validateField(rule); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusEl.textContent = '';
    var failed = rules.filter(function (r) { return !validateField(r); });
    formSent = false;
    if (failed.length) {
      lastFailed = failed;
      renderSummary();
      summary.focus();
      return;
    }
    lastFailed = null;
    summary.hidden = true;
    summary.innerHTML = '';
    sendForm();
  });

  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/support@endeavorbiz.com';
  var submitBtn = document.getElementById('form-submit');
  var submitLabel = document.getElementById('form-submit-label');
  function sendForm() {
    var data = new FormData(form);
    if (data.get('_honey')) return; // bot filled the hidden field
    var payload = {};
    data.forEach(function (v, k) { if (k !== '_honey') payload[k] = v; });
    payload.language = doc.lang;
    payload._replyto = payload.email;
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitLabel.textContent = ui('sending');
    statusEl.classList.remove('is-error');
    fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok || String(json.success) === 'false') throw new Error(json.message || 'send failed');
      });
    }).then(function () {
      formSent = true;
      statusEl.textContent = ui('success');
      form.reset();
      rules.forEach(function (r) { document.getElementById(r.id).removeAttribute('aria-invalid'); });
    }).catch(function () {
      formSent = false;
      statusEl.classList.add('is-error');
      statusEl.innerHTML = ui('sendError') + ' <a href="mailto:support@endeavorbiz.com">support@endeavorbiz.com</a>';
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
      submitLabel.textContent = tr('Send Request');
    });
  }
  function renderSummary() {
    if (!lastFailed) return;
    var n = lastFailed.length;
    summary.hidden = false;
    summary.innerHTML = '<strong>' + (n > 1 ? ui('correctN').replace('{n}', n) : ui('correct1')) + '</strong><ul>' +
      lastFailed.map(function (r) { return '<li><a href="#' + r.id + '">' + tr(r.label) + '</a></li>'; }).join('') + '</ul>';
  }
  summary.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (a) { e.preventDefault(); var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) t.focus(); }
  });

  setLanguage(initialLanguage(), false);

  /* ---------- Year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
