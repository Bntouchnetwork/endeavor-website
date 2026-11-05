/* Public proposal page: the client reviews the package, accepts it, and gets the portal link to create a login and pay. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG;
  var t = EP.init({
    en: {},
    pt: { docTitle: 'Proposta | Endeavor Business Solutions', loading: 'Carregando a sua proposta…', skip: 'Pular para o conteúdo' },
    es: { docTitle: 'Propuesta | Endeavor Business Solutions', loading: 'Cargando su propuesta…', skip: 'Saltar al contenido' }
  });
  var L = EP.lang;
  var D = {
    en: { preparedFor: 'Prepared for', by: 'by Endeavor Business Solutions', included: "What's included", investment: 'Investment', item: 'Service', qty: 'Qty', amount: 'Amount', total: 'Total',
      terms: 'Terms', validUntil: 'Valid until', acceptTitle: 'Accept the proposal', acceptLead: 'Type your full name to accept. After that you receive an email with the link to create your access to the client portal and pay the invoice.',
      name: 'Full name', agree: 'I have read and accept this proposal and its terms.', accept: 'Accept proposal', questions: 'Questions? Talk to us first', notFound: 'Proposal not found', notFoundText: 'The link may be incomplete or the proposal was replaced. Write to support@endeavorbiz.com.',
      expired: 'This proposal has expired', expiredText: 'Ask us for an updated proposal: support@endeavorbiz.com or WhatsApp +1 (630) 689-8702.',
      okTitle: 'Proposal accepted. Thank you!', okText: 'We sent the next steps to {e}. Create your login in the client portal: you will go straight to the invoices page to pay by card, Pix or bank transfer.',
      okInvoice: 'Invoice {n} ({a}) is ready for payment in the portal.', okPending: 'Your invoice will be available in the portal shortly.', portalBtn: 'Create my access and pay', portalBtnReturning: 'Sign in and pay',
      already: 'This proposal was accepted by {n} on {d}.', errName: 'Type your full name and confirm that you accept.', errGeneric: 'We could not register the acceptance. Try again or write to support@endeavorbiz.com.',
      emailSubject: 'Proposal accepted: next steps', invoiceLine: 'Invoice {n} for {a} is waiting for you in the portal.', step: 'Step' },
    pt: { preparedFor: 'Preparada para', by: 'pela Endeavor Business Solutions', included: 'O que está incluso', investment: 'Investimento', item: 'Serviço', qty: 'Qtd', amount: 'Valor', total: 'Total',
      terms: 'Condições', validUntil: 'Válida até', acceptTitle: 'Aceitar a proposta', acceptLead: 'Digite o seu nome completo para aceitar. Em seguida você recebe um e-mail com o link para criar o seu acesso ao portal do cliente e pagar a fatura.',
      name: 'Nome completo', agree: 'Li e aceito esta proposta e as suas condições.', accept: 'Aceitar proposta', questions: 'Ficou com dúvida? Fale com a gente antes', notFound: 'Proposta não encontrada', notFoundText: 'O link pode estar incompleto ou a proposta foi substituída. Escreva para support@endeavorbiz.com.',
      expired: 'Esta proposta expirou', expiredText: 'Peça uma proposta atualizada: support@endeavorbiz.com ou WhatsApp +1 (630) 689-8702.',
      okTitle: 'Proposta aceita. Obrigado!', okText: 'Enviamos os próximos passos para {e}. Crie o seu login no portal do cliente: você vai direto para a página de faturas para pagar com cartão, Pix ou transferência.',
      okInvoice: 'A fatura {n} ({a}) já está disponível para pagamento no portal.', okPending: 'A sua fatura estará disponível no portal em instantes.', portalBtn: 'Criar meu acesso e pagar', portalBtnReturning: 'Entrar e pagar',
      already: 'Esta proposta foi aceita por {n} em {d}.', errName: 'Digite o seu nome completo e confirme que aceita.', errGeneric: 'Não conseguimos registrar o aceite. Tente de novo ou escreva para support@endeavorbiz.com.',
      emailSubject: 'Proposta aceita: próximos passos', invoiceLine: 'A fatura {n}, de {a}, já está esperando por você no portal.', step: 'Passo' },
    es: { preparedFor: 'Preparada para', by: 'por Endeavor Business Solutions', included: 'Qué incluye', investment: 'Inversión', item: 'Servicio', qty: 'Cant.', amount: 'Valor', total: 'Total',
      terms: 'Condiciones', validUntil: 'Válida hasta', acceptTitle: 'Aceptar la propuesta', acceptLead: 'Escriba su nombre completo para aceptar. Luego recibirá un correo con el enlace para crear su acceso al portal del cliente y pagar la factura.',
      name: 'Nombre completo', agree: 'Leí y acepto esta propuesta y sus condiciones.', accept: 'Aceptar propuesta', questions: '¿Tiene dudas? Hable con nosotros primero', notFound: 'Propuesta no encontrada', notFoundText: 'El enlace puede estar incompleto o la propuesta fue reemplazada. Escriba a support@endeavorbiz.com.',
      expired: 'Esta propuesta expiró', expiredText: 'Pida una propuesta actualizada: support@endeavorbiz.com o WhatsApp +1 (630) 689-8702.',
      okTitle: 'Propuesta aceptada. ¡Gracias!', okText: 'Enviamos los próximos pasos a {e}. Cree su acceso en el portal del cliente: irá directo a la página de facturas para pagar con tarjeta, Pix o transferencia.',
      okInvoice: 'La factura {n} ({a}) ya está disponible para pago en el portal.', okPending: 'Su factura estará disponible en el portal en instantes.', portalBtn: 'Crear mi acceso y pagar', portalBtnReturning: 'Ingresar y pagar',
      already: 'Esta propuesta fue aceptada por {n} el {d}.', errName: 'Escriba su nombre completo y confirme que acepta.', errGeneric: 'No pudimos registrar la aceptación. Intente de nuevo o escriba a support@endeavorbiz.com.',
      emailSubject: 'Propuesta aceptada: próximos pasos', invoiceLine: 'La factura {n}, de {a}, ya lo espera en el portal.', step: 'Paso' }
  };
  function T(k, v) { var s = (D[L] || D.en)[k] || D.en[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); }); return s; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $ = function (s) { return document.querySelector(s); };
  var money = function (c, cur) { return new Intl.NumberFormat(EP.locale, { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((c || 0) / 100); };
  var fmtD = function (d) { return d ? new Intl.DateTimeFormat(EP.locale, { dateStyle: 'long' }).format(new Date(d.length === 10 ? d + 'T12:00:00' : d)) : ''; };
  var token = '';
  try { token = new URL(location.href).searchParams.get('t') || window.DEMO_PROPOSAL_TOKEN || ''; } catch (e) { token = window.DEMO_PROPOSAL_TOKEN || ''; }
  var state = $('#state'), flow = $('#flow');
  function fail(title, text) { state.innerHTML = '<h1 class="portal-h2">' + esc(title) + '</h1><p>' + esc(text) + '</p>'; }

  function render(p) {
    var items = p.items || [];
    flow.innerHTML =
      '<div class="prop-hero"><p class="prop-eyebrow">' + esc(T('preparedFor')) + ' ' + esc(p.client_name) + ' · ' + esc(T('by')) + '</p><h1 class="portal-h1">' + esc(p.title) + '</h1>' +
        (p.intro ? '<p class="prop-intro">' + esc(p.intro).replace(/\n/g, '<br>') + '</p>' : '') + '</div>' +
      (p.included && p.included.length ? '<section class="portal-card"><h2 class="portal-h2">' + esc(T('included')) + '</h2><ul class="prop-check">' + p.included.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<section class="portal-card"><h2 class="portal-h2">' + esc(T('investment')) + '</h2><ul class="cart">' +
        items.map(function (i) { return '<li><span><strong>' + esc(i.description) + '</strong>' + ((i.quantity || 1) > 1 ? '<small>' + esc(T('qty')) + ' ' + i.quantity + ' × ' + esc(money(i.amount_cents, p.currency)) + '</small>' : '') + '</span><span class="cart__amt">' + esc(money(i.amount_cents * (i.quantity || 1), p.currency)) + '</span></li>'; }).join('') +
        '</ul><div class="cart__total"><span>' + esc(T('total')) + '</span><strong>' + esc(money(p.total_cents, p.currency)) + '</strong></div>' +
        (p.terms ? '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">' + esc(T('terms')) + '</h3><p class="portal-muted" style="font-size:.92rem">' + esc(p.terms).replace(/\n/g, '<br>') + '</p>' : '') +
        (p.valid_until ? '<p class="portal-muted" style="font-size:.88rem">' + esc(T('validUntil')) + ': <strong>' + esc(fmtD(p.valid_until)) + '</strong></p>' : '') + '</section>' +
      '<section class="portal-card" id="accept-box" aria-labelledby="acc-h"></section>';
    var box = $('#accept-box');
    if (p.status === 'accepted') return done(p, { already: true });
    if (p.status === 'expired') { box.innerHTML = '<h2 class="portal-h2" id="acc-h">' + esc(T('expired')) + '</h2><p>' + esc(T('expiredText')) + '</p>'; return; }
    box.innerHTML = '<h2 class="portal-h2" id="acc-h">' + esc(T('acceptTitle')) + '</h2><p class="portal-muted">' + esc(T('acceptLead')) + '</p>' +
      '<form class="portal-form" id="acc-form" novalidate><div class="field"><label for="acc-name">' + esc(T('name')) + '</label><input id="acc-name" autocomplete="name" required maxlength="200"></div>' +
      '<div class="check-row"><input type="checkbox" id="acc-agree" required><label for="acc-agree">' + esc(T('agree')) + '</label></div>' +
      '<div class="portal-alert" id="acc-msg" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + esc(T('accept')) + '</button>' +
      '<a class="btn btn--ghost" href="https://wa.me/16306898702" target="_blank" rel="noopener">' + esc(T('questions')) + '</a></div></form>';
    $('#acc-form').onsubmit = async function (e) {
      e.preventDefault();
      var name = $('#acc-name').value.trim(), msgEl = $('#acc-msg');
      if (name.length < 3 || !$('#acc-agree').checked) { msgEl.className = 'portal-alert portal-alert--error'; msgEl.textContent = T('errName'); return; }
      var btn = this.querySelector('button'); btn.disabled = true;
      try { var r = await EP.fn('payments', { action: 'proposal_accept', token: token, name: name, agree: true }); done(Object.assign({}, p, r), r); }
      catch (x) { btn.disabled = false; msgEl.className = 'portal-alert portal-alert--error'; msgEl.textContent = x.code === 'proposal_closed' ? T('expiredText') : T('errGeneric'); }
    };
  }

  function done(p, r) {
    var box = $('#accept-box'), portal = r.portal_url || ('https://endeavorbiz.com/client.html?lang=' + L + '#/invoices');
    var inv = r.invoice, invAmt = inv ? money(inv.total_cents, inv.currency) : '';
    if (r.already) {
      box.innerHTML = '<div class="prop-ok"><h2 class="portal-h2" id="acc-h">' + esc(T('okTitle')) + '</h2><p>' + esc(T('already', { n: p.accepted_name || '', d: fmtD(p.accepted_at) })) + '</p><a class="btn btn--navy" href="' + esc(portal) + '">' + esc(T('portalBtnReturning')) + '</a></div>';
      return;
    }
    box.innerHTML = '<div class="prop-ok" role="status"><svg class="prop-ok__ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1e6b3a"/><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<h2 class="portal-h2" id="acc-h">' + esc(T('okTitle')) + '</h2><p>' + esc(T('okText', { e: r.email || '' })) + '</p><p><strong>' + esc(inv ? T('okInvoice', { n: inv.number || '', a: invAmt }) : T('okPending')) + '</strong></p>' +
      '<a class="btn btn--navy" id="go-portal" href="' + esc(portal) + '">' + esc(T(r.first_access === false ? 'portalBtnReturning' : 'portalBtn')) + '</a></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // automatic e-mails: next steps to the client (auto-response) and the notification to the Endeavor team
    var text = window.EndeavorInvite.text(L, { name: (p.client_name || '').split(' ')[0] || p.accepted_name, email: r.email, link: portal, accepted: p.title,
      invoiceLine: inv ? T('invoiceLine', { n: inv.number || '', a: invAmt }) : '' });
    EP.notify({ _subject: 'Proposta aceita: ' + p.title + ' (' + (p.client_name || '') + ')', name: p.accepted_name || r.accepted_name, email: r.email, proposta: p.title,
      total: money(p.total_cents, p.currency), fatura: inv ? inv.number : 'a gerar', aceite: new Date().toISOString(), _autoresponse: text });
  }

  (async function () {
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return fail(T('notFound'), T('notFoundText'));
    try { var p = await EP.fn('payments', { action: 'proposal_get', token: token }); state.hidden = true; flow.hidden = false; render(p); }
    catch (e) { fail(T('notFound'), T('notFoundText')); }
  })();
})();
