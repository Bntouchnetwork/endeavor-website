/* Endeavor website assistant: AI sales and support chat (bottom-right). Prices are never given in the chat; the team sends a proposal by e-mail. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG || {};
  if (!CFG.functionsUrl || document.getElementById('sc-root')) return;
  var doc = document.documentElement;
  var T = {
    pt: { title: 'Assistente Endeavor', sub: 'Online · responde na hora', open: 'Abrir o chat', close: 'Fechar o chat', min: 'Minimizar', teaser: 'Olá! 👋 Tem alguma dúvida sobre abrir ou manter sua empresa nos EUA, ou sobre o Programa de Parceiros?', teaserX: 'Dispensar',
      hi: 'Olá! Sou o assistente da Endeavor. Posso explicar nossos serviços, como funciona a abertura de empresa nos EUA e o Programa de Parceiros. Como posso ajudar?',
      chips: ['Abrir empresa nos EUA', 'Registered Agent', 'Impostos, EIN e ITIN', 'Programa de Parceiros'], ph: 'Escreva a sua mensagem…', send: 'Enviar', typing: 'Digitando…',
      leadT: 'Receba a sua proposta por e-mail', leadD: 'Nossa equipe prepara uma proposta personalizada e envia no seu e-mail.', name: 'Nome', email: 'E-mail', phone: 'WhatsApp (opcional)', interest: 'Interesse',
      leadBtn: 'Quero receber a proposta', leadNo: 'Agora não', leadOk: 'Pronto, {n}! Recebemos o seu pedido. A nossa equipe vai enviar a proposta para {e} em breve.', priv: 'Não envie SSN, ITIN, passaporte ou dados bancários pelo chat.',
      book: 'Agendar uma conversa', partner: 'Quero ser parceiro', human: 'Falar no WhatsApp', err: 'Não consegui responder agora. Tente de novo ou fale pelo WhatsApp +1 (630) 689-8702.',
      eName: 'Informe o seu nome.', eEmail: 'Confira o e-mail.', ePhone: 'Confira o WhatsApp, com o código do país (ex.: +55 11 99999-9999).', eRate: 'Muitos pedidos agora. Tente mais tarde.', foot: 'Assistente com IA. Pode cometer erros.', restart: 'Nova conversa' },
    en: { title: 'Endeavor Assistant', sub: 'Online · replies instantly', open: 'Open chat', close: 'Close chat', min: 'Minimize', teaser: 'Hi! 👋 Any questions about opening or running your company in the U.S., or about our Partner Program?', teaserX: 'Dismiss',
      hi: 'Hi! I am the Endeavor assistant. I can explain our services, how forming a U.S. company works and our Partner Program. How can I help?',
      chips: ['Form a U.S. company', 'Registered Agent', 'Taxes, EIN and ITIN', 'Partner Program'], ph: 'Type your message…', send: 'Send', typing: 'Typing…',
      leadT: 'Get your proposal by email', leadD: 'Our team prepares a personalized proposal and sends it to your email.', name: 'Name', email: 'Email', phone: 'WhatsApp (optional)', interest: 'Interest',
      leadBtn: 'Send me the proposal', leadNo: 'Not now', leadOk: 'All set, {n}! We received your request. Our team will email the proposal to {e} soon.', priv: 'Do not send SSN, ITIN, passport or bank details in the chat.',
      book: 'Book a call', partner: 'Become a partner', human: 'Chat on WhatsApp', err: 'I could not reply right now. Try again or message us on WhatsApp +1 (630) 689-8702.',
      eName: 'Enter your name.', eEmail: 'Check the email.', ePhone: 'Check the WhatsApp number, with the country code (e.g. +1 407 555 0100).', eRate: 'Too many requests right now. Please try later.', foot: 'AI assistant. It can make mistakes.', restart: 'New chat' },
    es: { title: 'Asistente Endeavor', sub: 'En línea · responde al instante', open: 'Abrir el chat', close: 'Cerrar el chat', min: 'Minimizar', teaser: '¡Hola! 👋 ¿Tiene dudas sobre abrir o mantener su empresa en EE. UU., o sobre el Programa de Socios?', teaserX: 'Descartar',
      hi: '¡Hola! Soy el asistente de Endeavor. Puedo explicarle nuestros servicios, cómo se abre una empresa en EE. UU. y el Programa de Socios. ¿En qué le ayudo?',
      chips: ['Abrir empresa en EE. UU.', 'Registered Agent', 'Impuestos, EIN e ITIN', 'Programa de Socios'], ph: 'Escriba su mensaje…', send: 'Enviar', typing: 'Escribiendo…',
      leadT: 'Reciba su propuesta por correo', leadD: 'Nuestro equipo prepara una propuesta personalizada y la envía a su correo.', name: 'Nombre', email: 'Correo', phone: 'WhatsApp (opcional)', interest: 'Interés',
      leadBtn: 'Quiero recibir la propuesta', leadNo: 'Ahora no', leadOk: '¡Listo, {n}! Recibimos su pedido. Nuestro equipo enviará la propuesta a {e} pronto.', priv: 'No envíe SSN, ITIN, pasaporte ni datos bancarios por el chat.',
      book: 'Agendar una conversación', partner: 'Quiero ser socio', human: 'Hablar por WhatsApp', err: 'No pude responder ahora. Intente de nuevo o escríbanos por WhatsApp +1 (630) 689-8702.',
      eName: 'Escriba su nombre.', eEmail: 'Revise el correo.', ePhone: 'Revise el WhatsApp, con el código del país (ej.: +595 981 000 000).', eRate: 'Demasiadas solicitudes ahora. Intente más tarde.', foot: 'Asistente con IA. Puede cometer errores.', restart: 'Nueva conversación' }
  };
  var SVCS = { pt: ['Abertura de empresa (LLC/Corp)', 'Registered Agent', 'Compliance / Annual Report', 'Impostos, EIN ou ITIN', 'Expansão Brasil-EUA', 'Operação no Paraguai', 'Financiamento', 'Estrutura para imóveis', 'Family Office', 'Outro'],
    en: ['Company formation (LLC/Corp)', 'Registered Agent', 'Compliance / Annual Report', 'Taxes, EIN or ITIN', 'Brazil-U.S. expansion', 'Operations in Paraguay', 'Financing', 'Real estate structure', 'Family Office', 'Other'],
    es: ['Apertura de empresa (LLC/Corp)', 'Registered Agent', 'Compliance / Annual Report', 'Impuestos, EIN o ITIN', 'Expansión a EE. UU.', 'Operación en Paraguay', 'Financiamiento', 'Estructura inmobiliaria', 'Family Office', 'Otro'] };
  function L() { var l = (doc.lang || 'en').slice(0, 2).toLowerCase(); return T[l] ? l : 'en'; }
  function t(k, v) { var s = T[L()][k]; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // light formatting: **bold**, bullets, links to endeavorbiz.com, e-mail and line breaks (everything else stays text)
  function fmt(s) {
    var h = esc(s).replace(/\*\*([^*]{1,80})\*\*/g, '<strong>$1</strong>');
    h = h.replace(/https:\/\/(?:www\.)?endeavorbiz\.com\/[\w./#?=&-]*/g, function (u) { var clean = u.replace(/[.,]+$/, ''); return '<a href="' + clean + '">' + clean.replace(/^https:\/\/(www\.)?/, '') + '</a>' + u.slice(clean.length); });
    h = h.replace(/\bsupport@endeavorbiz\.com\b/g, '<a href="mailto:support@endeavorbiz.com">support@endeavorbiz.com</a>');
    return h.replace(/\n/g, '<br>');
  }

  var KEY = 'endeavor-chat', state = { id: ss.get(KEY + '-id') || uuid(), log: [], lead: false, open: false, busy: false };
  ss.set(KEY + '-id', state.id);
  try { var saved = JSON.parse(ss.get(KEY + '-log') || 'null'); if (saved && saved.id === state.id) { state.log = saved.log || []; state.lead = !!saved.lead; } } catch (e) { /* ignore */ }
  function save() { ss.set(KEY + '-log', JSON.stringify({ id: state.id, log: state.log.slice(-60), lead: state.lead })); }

  var ICON_CHAT = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.5 1.2 4.7 3.2 6.3L4.4 21.3a.6.6 0 0 0 .9.6l3.8-2.1c.9.2 1.9.3 2.9.3 5.5 0 10-3.9 10-8.7S17.5 3 12 3Zm-4.5 10.2a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm4.5 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Zm4.5 0a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8Z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';

  var root = document.createElement('div'); root.id = 'sc-root'; root.className = 'sc';
  root.innerHTML =
    '<div class="sc-teaser" id="sc-teaser" hidden><button type="button" class="sc-teaser__x" id="sc-teaser-x"></button><button type="button" class="sc-teaser__body" id="sc-teaser-b"><span class="sc-av sc-av--sm" aria-hidden="true">E</span><span id="sc-teaser-t"></span></button></div>' +
    '<section class="sc-panel" id="sc-panel" role="dialog" aria-modal="false" aria-labelledby="sc-title" hidden>' +
      '<header class="sc-head"><span class="sc-av" aria-hidden="true">E<i class="sc-dot"></i></span><div class="sc-head__t"><h2 id="sc-title"></h2><p id="sc-sub"></p></div>' +
        '<button type="button" class="sc-icon-btn sc-restart" id="sc-restart"></button><button type="button" class="sc-icon-btn" id="sc-x">' + ICON_X + '</button></header>' +
      '<div class="sc-log" id="sc-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="sc-chips" id="sc-chips"></div>' +
      '<form class="sc-form" id="sc-form" autocomplete="off"><label for="sc-in" class="sc-sr" id="sc-in-l"></label><textarea id="sc-in" rows="1" maxlength="1000"></textarea><button type="submit" class="sc-send" id="sc-send">' + ICON_SEND + '<span class="sc-sr" id="sc-send-l"></span></button></form>' +
      '<p class="sc-foot" id="sc-foot"></p>' +
    '</section>' +
    '<button type="button" class="sc-launch" id="sc-launch" aria-controls="sc-panel" aria-expanded="false"><span class="sc-launch__i sc-launch__i--chat">' + ICON_CHAT + '</span><span class="sc-launch__i sc-launch__i--x">' + ICON_X + '</span><span class="sc-badge" id="sc-badge" hidden>1</span></button>';
  document.body.appendChild(root);
  document.body.classList.add('has-sc');
  var $ = function (id) { return document.getElementById(id); };
  var panel = $('sc-panel'), log = $('sc-log'), inp = $('sc-in'), launch = $('sc-launch'), teaser = $('sc-teaser');

  function texts() {
    $('sc-title').textContent = t('title'); $('sc-sub').textContent = t('sub'); $('sc-in').placeholder = t('ph'); $('sc-in-l').textContent = t('ph');
    $('sc-send-l').textContent = t('send'); $('sc-foot').textContent = t('priv'); $('sc-x').setAttribute('aria-label', t('min'));
    $('sc-restart').textContent = t('restart'); $('sc-teaser-t').textContent = t('teaser'); $('sc-teaser-x').setAttribute('aria-label', t('teaserX')); $('sc-teaser-x').innerHTML = ICON_X;
    launch.setAttribute('aria-label', state.open ? t('close') : t('open'));
  }
  function bubble(role, html, cls) {
    var d = document.createElement('div'); d.className = 'sc-msg sc-msg--' + role + (cls ? ' ' + cls : ''); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function render() {
    log.innerHTML = '';
    bubble('bot', fmt(t('hi')));
    state.log.forEach(function (m) { if (m.r === 'u') bubble('me', esc(m.c)); else if (m.r === 'b') { bubble('bot', fmt(m.c)); } else if (m.r === 'ok') bubble('bot', esc(m.c), 'sc-msg--ok'); });
    var last = state.log[state.log.length - 1];
    if (last && last.r === 'b' && last.a) actionCard(last.a, true);
    chips();
  }
  function chips() {
    var box = $('sc-chips'); var show = !state.log.some(function (m) { return m.r === 'u'; });
    box.hidden = !show; box.innerHTML = show ? T[L()].chips.map(function (c) { return '<button type="button" class="sc-chip">' + esc(c) + '</button>'; }).join('') : '';
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.onclick = function () { send(b.textContent); }; });
  }
  function actionCard(a, restoring) {
    var l = L();
    if (a === 'lead' && !state.lead) return leadCard();
    var href = a === 'book' ? 'schedule.html?lang=' + l : a === 'partner' ? 'partners.html?lang=' + l + '#cadastro' : a === 'human' ? 'https://wa.me/16306898702' : null;
    if (!href) return;
    var d = bubble('bot', '<a class="sc-cta" href="' + href + '"' + (a === 'human' ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t(a)) + ' →</a>', 'sc-msg--cta');
    if (restoring) d.classList.add('is-restored');
  }
  function leadCard() {
    if (log.querySelector('.sc-lead')) return;
    var opts = SVCS[L()].map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    var d = bubble('bot', '<form class="sc-lead" novalidate><strong>' + esc(t('leadT')) + '</strong><p>' + esc(t('leadD')) + '</p>' +
      '<label>' + esc(t('name')) + '<input name="name" autocomplete="name" maxlength="200" required></label>' +
      '<label>' + esc(t('email')) + '<input name="email" type="email" autocomplete="email" maxlength="254" required></label>' +
      '<label>' + esc(t('phone')) + '<input name="phone" type="tel" autocomplete="tel" maxlength="24" placeholder="+1 407 555 0100"></label>' +
      '<label>' + esc(t('interest')) + '<select name="interest">' + opts + '</select></label>' +
      '<input name="website" tabindex="-1" autocomplete="off" class="sc-hp" aria-hidden="true">' +
      '<p class="sc-lead__err" role="alert"></p><div class="sc-lead__btns"><button type="submit" class="sc-btn">' + esc(t('leadBtn')) + '</button><button type="button" class="sc-btn sc-btn--ghost">' + esc(t('leadNo')) + '</button></div></form>', 'sc-msg--form');
    var f = d.querySelector('form'), er = f.querySelector('.sc-lead__err');
    f.querySelector('.sc-btn--ghost').onclick = function () { d.remove(); inp.focus(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      var name = f.name.value.trim(), email = f.email.value.trim(), ph = f.phone.value.trim(), phone = ph ? '+' + ph.replace(/\D/g, '').replace(/^00/, '') : '';
      if (name.length < 2) { er.textContent = t('eName'); f.name.focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { er.textContent = t('eEmail'); f.email.focus(); return; }
      if (ph && !/^\+[1-9]\d{6,14}$/.test(phone)) { er.textContent = t('ePhone'); f.phone.focus(); return; }
      er.textContent = ''; var b = f.querySelector('.sc-btn'); b.disabled = true;
      api({ action: 'lead', chat_id: state.id, lang: L(), name: name, email: email, phone: phone, interest: f.interest.value, website: f.website.value }).then(function (j) {
        state.lead = true; d.remove(); var msg = t('leadOk', { n: name.split(' ')[0], e: email }); state.log.push({ r: 'ok', c: msg }); save(); bubble('bot', esc(msg), 'sc-msg--ok');
      }).catch(function (x) { b.disabled = false; er.textContent = /rate/.test(x.message) ? t('eRate') : /phone/.test(x.message) ? t('ePhone') : /email/.test(x.message) ? t('eEmail') : t('err'); });
    };
    setTimeout(function () { f.name.focus(); }, 50);
  }
  function api(body) {
    return fetch(CFG.functionsUrl + '/site-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok && !j.reply) throw new Error(j.error || 'http_' + r.status); return j; }); });
  }
  function send(text) {
    text = String(text || '').trim(); if (!text || state.busy) return;
    state.busy = true; $('sc-send').disabled = true; $('sc-chips').hidden = true;
    state.log.push({ r: 'u', c: text }); save(); bubble('me', esc(text)); inp.value = ''; grow();
    var ty = bubble('bot', '<span class="sc-typing" aria-label="' + esc(t('typing')) + '"><i></i><i></i><i></i></span>', 'sc-msg--typing');
    var t0 = Date.now();
    api({ action: 'msg', chat_id: state.id, lang: L(), message: text, page: location.pathname }).then(function (j) {
      // a short "typing" pause, longer for longer answers, so it does not feel instant
      var want = Math.min(4200, 1400 + String(j.reply || '').length * 9), wait = Math.max(0, want - (Date.now() - t0));
      return new Promise(function (res) { setTimeout(function () { res(j); }, wait); });
    }).then(function (j) {
      ty.remove(); var m = { r: 'b', c: j.reply || t('err'), a: j.action || null }; state.log.push(m); save(); bubble('bot', fmt(m.c)); if (m.a) actionCard(m.a);
    }).catch(function () { ty.remove(); bubble('bot', esc(t('err')), 'sc-msg--err'); })
      .then(function () { state.busy = false; $('sc-send').disabled = false; if (state.open && !matchMedia('(max-width: 600px)').matches) inp.focus(); });
  }
  function grow() { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; }
  function setOpen(o) {
    state.open = o; panel.hidden = !o; root.classList.toggle('is-open', o); launch.setAttribute('aria-expanded', String(o)); texts();
    document.body.classList.toggle('sc-lock', o && matchMedia('(max-width: 600px)').matches); document.body.classList.toggle('sc-open', o);
    if (o) { hideTeaser(true); $('sc-badge').hidden = true; if (!log.childElementCount) render(); log.scrollTop = log.scrollHeight; setTimeout(function () { inp.focus(); }, 60); }
    else launch.focus();
  }
  function hideTeaser(seen) { teaser.hidden = true; if (seen) ss.set(KEY + '-teased', '1'); }
  launch.onclick = function () { setOpen(!state.open); };
  $('sc-x').onclick = function () { setOpen(false); };
  $('sc-restart').onclick = function () { state.id = uuid(); state.log = []; state.lead = false; ss.set(KEY + '-id', state.id); save(); render(); inp.focus(); };
  $('sc-teaser-b').onclick = function () { setOpen(true); };
  $('sc-teaser-x').onclick = function () { hideTeaser(true); ls.set(KEY + '-dismissed', String(Date.now())); };
  $('sc-form').onsubmit = function (e) { e.preventDefault(); send(inp.value); };
  inp.addEventListener('input', grow);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(inp.value); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) setOpen(false); });
  // language switch on the site: refresh the texts (the conversation stays)
  new MutationObserver(function () { texts(); if (state.open || log.childElementCount) render(); }).observe(doc, { attributes: true, attributeFilter: ['lang'] });
  texts();

  // chat on/off and the popup delay come from the admin (Agentes IA)
  fetch(CFG.supabaseUrl + '/rest/v1/rpc/site_chat_config', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: '{}' })
    .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (rows) {
      var c = (rows && rows[0]) || { enabled: true, popup_seconds: 8 };
      if (c.enabled === false) { root.remove(); document.body.classList.remove('has-sc'); return; }
      root.classList.add('is-ready');
      var dismissed = +(ls.get(KEY + '-dismissed') || 0), recently = Date.now() - dismissed < 3 * 864e5;
      if (state.log.length || ss.get(KEY + '-teased') || recently || c.popup_seconds === 0) return;
      setTimeout(function () { if (state.open) return; teaser.hidden = false; $('sc-badge').hidden = false; ss.set(KEY + '-teased', '1'); }, Math.max(2, c.popup_seconds || 8) * 1000);
    });
})();
