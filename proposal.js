/* Public proposal page. The client reviews the package and either:
   - "Accept and pay invoice": confirms the terms with the full name (and the monthly debit authorization when there is maintenance)
     and pays on the same page (Stripe Payment Element). Paying is the acceptance.
   - "Reject": writes the reason (required); Endeavor is notified and can send a second offer. */
(function () {
  'use strict';
  var t = EP.init({
    en: {},
    pt: { docTitle: 'Proposta | Endeavor Business Solutions', loading: 'Carregando a sua proposta…', skip: 'Pular para o conteúdo' },
    es: { docTitle: 'Propuesta | Endeavor Business Solutions', loading: 'Cargando su propuesta…', skip: 'Saltar al contenido' }
  });
  var L = EP.lang;
  var D = {
    en: { preparedFor: 'Prepared for', by: 'by Endeavor Business Solutions', included: "What's included", investment: 'Invoice', qty: 'Qty', total: 'Total today', monthly: 'Monthly maintenance', monthlyFrom: 'charged automatically from 30 days after payment', perMonth: '/mo',
      terms: 'Terms', validUntil: 'Valid until', acceptPay: 'Accept and pay invoice', reject: 'Reject', questions: 'Questions? Talk to us first',
      notFound: 'Proposal not found', notFoundText: 'The link may be incomplete or the proposal was replaced. Write to support@endeavorbiz.com.',
      expired: 'This proposal has expired', expiredText: 'Ask us for an updated proposal: support@endeavorbiz.com or WhatsApp +1 (630) 689-8702.',
      mTitle: 'Accept the proposal', mLead: 'Review the terms and confirm with your full name. Next, you pay on this page.', name: 'Full name', agree: 'I have read and accept this proposal and its terms.',
      authTitle: 'Monthly debit authorization', auth: 'I authorize Endeavor Business Solutions to charge {a} per month to the payment method I use now, starting on {d} (30 days after this payment) and then on the same day each month, until I cancel in writing. Card charges in US dollars may include foreign transaction fees from my bank.',
      cont: 'Accept and continue to payment', cancel: 'Back', errName: 'Type your full name and confirm that you accept.', errGeneric: 'Something went wrong. Try again or write to support@endeavorbiz.com.',
      payTitle: 'Payment', payLead: 'Choose how to pay. The payment is processed by Stripe; Endeavor does not see your card details.', pay: 'Pay {a}', save: 'Save payment method', hosted: 'Prefer to pay on a Stripe page?', notReady: 'Online payment is being set up. We will e-mail you the payment link shortly.',
      okTitle: 'Payment confirmed. Thank you!', okText: 'The receipt is on its way to your e-mail. Next you will receive the request for the information and documents to form your company, with a secure page to send them.', okPortal: 'You will also receive the e-mail to create your access to the client portal.',
      paidAlready: 'This proposal was accepted and paid. Thank you!', accepted: 'Proposal accepted on {d}. The payment is pending.',
      rTitle: 'Reject the proposal', rLead: 'Tell us why (required). This helps us review the offer.', reason: 'Reason', rSend: 'Reject proposal', errReason: 'Write the reason (at least a few words).',
      rDone: 'Thank you for letting us know.', rDoneText: 'We received your answer and the Endeavor team will be in touch if we can adjust the proposal.', declined: 'This proposal was rejected.', secure: 'Secure payment by Stripe' },
    pt: { preparedFor: 'Preparada para', by: 'pela Endeavor Business Solutions', included: 'O que está incluso', investment: 'Fatura', qty: 'Qtd', total: 'Total hoje', monthly: 'Manutenção mensal', monthlyFrom: 'cobrada automaticamente a partir de 30 dias após o pagamento', perMonth: '/mês',
      terms: 'Condições', validUntil: 'Válida até', acceptPay: 'Aceitar e pagar fatura', reject: 'Rejeitar', questions: 'Ficou com dúvida? Fale com a gente antes',
      notFound: 'Proposta não encontrada', notFoundText: 'O link pode estar incompleto ou a proposta foi substituída. Escreva para support@endeavorbiz.com.',
      expired: 'Esta proposta expirou', expiredText: 'Peça uma proposta atualizada: support@endeavorbiz.com ou WhatsApp +1 (630) 689-8702.',
      mTitle: 'Aceitar a proposta', mLead: 'Confira as condições e confirme com o seu nome completo. Em seguida, você paga nesta mesma página.', name: 'Nome completo', agree: 'Li e aceito esta proposta e as suas condições.',
      authTitle: 'Autorização de débito mensal', auth: 'Autorizo a Endeavor Business Solutions a cobrar {a} por mês no meio de pagamento que eu usar agora, a partir de {d} (30 dias após este pagamento) e depois todo mês no mesmo dia, até eu cancelar por escrito. Cobranças em dólar no cartão podem ter IOF cobrado pelo meu banco.',
      cont: 'Aceitar e ir para o pagamento', cancel: 'Voltar', errName: 'Digite o seu nome completo e confirme que aceita.', errGeneric: 'Algo deu errado. Tente de novo ou escreva para support@endeavorbiz.com.',
      payTitle: 'Pagamento', payLead: 'Escolha como pagar. O pagamento é processado pelo Stripe; a Endeavor não vê os dados do seu cartão.', pay: 'Pagar {a}', save: 'Salvar meio de pagamento', hosted: 'Prefere pagar numa página do Stripe?', notReady: 'O pagamento online está sendo configurado. Enviaremos o link de pagamento por e-mail em instantes.',
      okTitle: 'Pagamento confirmado. Obrigado!', okText: 'O recibo está a caminho do seu e-mail. Em seguida você recebe o pedido das informações e documentos para abrir a sua empresa, com uma página segura para enviar.', okPortal: 'Você também vai receber o e-mail para criar o seu acesso ao portal do cliente.',
      paidAlready: 'Esta proposta foi aceita e paga. Obrigado!', accepted: 'Proposta aceita em {d}. O pagamento está pendente.',
      rTitle: 'Rejeitar a proposta', rLead: 'Conte o motivo (obrigatório). Isso nos ajuda a rever a oferta.', reason: 'Motivo', rSend: 'Rejeitar proposta', errReason: 'Escreva o motivo (pelo menos algumas palavras).',
      rDone: 'Obrigado por nos avisar.', rDoneText: 'Recebemos a sua resposta e a equipe Endeavor entra em contato se pudermos ajustar a proposta.', declined: 'Esta proposta foi rejeitada.', secure: 'Pagamento seguro pelo Stripe' },
    es: { preparedFor: 'Preparada para', by: 'por Endeavor Business Solutions', included: 'Qué incluye', investment: 'Factura', qty: 'Cant.', total: 'Total hoy', monthly: 'Mantenimiento mensual', monthlyFrom: 'cobrado automáticamente desde 30 días después del pago', perMonth: '/mes',
      terms: 'Condiciones', validUntil: 'Válida hasta', acceptPay: 'Aceptar y pagar factura', reject: 'Rechazar', questions: '¿Tiene dudas? Hable con nosotros primero',
      notFound: 'Propuesta no encontrada', notFoundText: 'El enlace puede estar incompleto o la propuesta fue reemplazada. Escriba a support@endeavorbiz.com.',
      expired: 'Esta propuesta expiró', expiredText: 'Pida una propuesta actualizada: support@endeavorbiz.com o WhatsApp +1 (630) 689-8702.',
      mTitle: 'Aceptar la propuesta', mLead: 'Revise las condiciones y confirme con su nombre completo. Luego paga en esta misma página.', name: 'Nombre completo', agree: 'Leí y acepto esta propuesta y sus condiciones.',
      authTitle: 'Autorización de débito mensual', auth: 'Autorizo a Endeavor Business Solutions a cobrar {a} por mes en el medio de pago que use ahora, desde el {d} (30 días después de este pago) y luego cada mes el mismo día, hasta que cancele por escrito. Los cobros en dólares con tarjeta pueden tener cargos de mi banco.',
      cont: 'Aceptar e ir al pago', cancel: 'Volver', errName: 'Escriba su nombre completo y confirme que acepta.', errGeneric: 'Algo salió mal. Intente de nuevo o escriba a support@endeavorbiz.com.',
      payTitle: 'Pago', payLead: 'Elija cómo pagar. El pago lo procesa Stripe; Endeavor no ve los datos de su tarjeta.', pay: 'Pagar {a}', save: 'Guardar medio de pago', hosted: '¿Prefiere pagar en una página de Stripe?', notReady: 'El pago en línea se está configurando. Le enviaremos el enlace de pago por correo en breve.',
      okTitle: 'Pago confirmado. ¡Gracias!', okText: 'El recibo va camino a su correo. Luego recibirá el pedido de la información y los documentos para constituir su empresa, con una página segura para enviarlos.', okPortal: 'También recibirá el correo para crear su acceso al portal del cliente.',
      paidAlready: 'Esta propuesta fue aceptada y pagada. ¡Gracias!', accepted: 'Propuesta aceptada el {d}. El pago está pendiente.',
      rTitle: 'Rechazar la propuesta', rLead: 'Cuéntenos el motivo (obligatorio). Nos ayuda a revisar la oferta.', reason: 'Motivo', rSend: 'Rechazar propuesta', errReason: 'Escriba el motivo (al menos algunas palabras).',
      rDone: 'Gracias por avisarnos.', rDoneText: 'Recibimos su respuesta y el equipo de Endeavor se comunicará si podemos ajustar la propuesta.', declined: 'Esta propuesta fue rechazada.', secure: 'Pago seguro con Stripe' }
  };
  function T(k, v) { var s = (D[L] || D.en)[k] || D.en[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); }); return s; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var money = function (c, cur) { return new Intl.NumberFormat(EP.locale, { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((c || 0) / 100); };
  var fmtD = function (d) { return d ? new Intl.DateTimeFormat(EP.locale, { dateStyle: 'long' }).format(typeof d === 'number' ? new Date(d * 1000) : new Date(d.length === 10 ? d + 'T12:00:00' : d)) : ''; };
  var params = new URLSearchParams(location.search), token = params.get('t') || window.DEMO_PROPOSAL_TOKEN || '', intent = params.get('a');
  var state = $('#state'), flow = $('#flow'), P = null;
  function fail(title, text) { state.innerHTML = '<h1 class="portal-h2">' + esc(title) + '</h1><p>' + esc(text) + '</p>'; }
  function alertBox(el, text) { el.className = 'portal-alert portal-alert--error'; el.textContent = text; }

  function render(p) {
    P = p;
    var items = p.items || [], once = items.filter(function (i) { return i.recurring !== 'month'; }), monthly = items.filter(function (i) { return i.recurring === 'month'; });
    var oneTotal = once.reduce(function (s, i) { return s + i.amount_cents * (i.quantity || 1); }, 0), mTotal = p.monthly_cents || monthly.reduce(function (s, i) { return s + i.amount_cents * (i.quantity || 1); }, 0);
    var li = function (i) { return '<li><span><strong>' + esc(i.description) + '</strong>' + ((i.quantity || 1) > 1 ? '<small>' + esc(T('qty')) + ' ' + i.quantity + ' × ' + esc(money(i.amount_cents, p.currency)) + '</small>' : '') + '</span><span class="cart__amt">' + esc(money(i.amount_cents * (i.quantity || 1), p.currency)) + (i.recurring === 'month' ? esc(T('perMonth')) : '') + '</span></li>'; };
    flow.innerHTML =
      '<div class="prop-hero"><p class="prop-eyebrow">' + esc(T('preparedFor')) + ' ' + esc(p.client_name) + ' · ' + esc(T('by')) + '</p><h1 class="portal-h1">' + esc(p.title) + '</h1>' +
        (p.intro ? '<p class="prop-intro">' + esc(p.intro).replace(/\n/g, '<br>') + '</p>' : '') + '</div>' +
      (p.included && p.included.length ? '<section class="portal-card"><h2 class="portal-h2">' + esc(T('included')) + '</h2><ul class="prop-check">' + p.included.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<section class="portal-card"><h2 class="portal-h2">' + esc(T('investment')) + (p.invoice_number ? ' <span class="portal-muted" style="font:500 .9rem Inter,sans-serif">' + esc(p.invoice_number) + '</span>' : '') + '</h2><ul class="cart">' + once.map(li).join('') + '</ul>' +
        '<div class="cart__total"><span>' + esc(T('total')) + '</span><strong>' + esc(money(oneTotal, p.currency)) + '</strong></div>' +
        (mTotal ? '<ul class="cart prop-monthly">' + monthly.map(li).join('') + '</ul><p class="portal-muted" style="font-size:.9rem;margin:.25rem 0 0">' + esc(T('monthly')) + ': <strong>' + esc(money(mTotal, p.currency)) + esc(T('perMonth')) + '</strong>, ' + esc(T('monthlyFrom')) + '.</p>' : '') +
        (p.terms ? '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">' + esc(T('terms')) + '</h3><p class="portal-muted" style="font-size:.92rem">' + esc(p.terms).replace(/\n/g, '<br>') + '</p>' : '') +
        (p.valid_until ? '<p class="portal-muted" style="font-size:.88rem">' + esc(T('validUntil')) + ': <strong>' + esc(fmtD(p.valid_until)) + '</strong></p>' : '') + '</section>' +
      '<section class="portal-card" id="act" aria-live="polite"></section>';
    var act = $('#act');
    if (p.invoice_status === 'paid' || params.get('redirect_status') === 'succeeded') return done(true);
    if (p.status === 'declined') { act.innerHTML = '<h2 class="portal-h2">' + esc(T('declined')) + '</h2><p>' + esc(T('rDoneText')) + '</p>'; return; }
    if (p.status === 'expired') { act.innerHTML = '<h2 class="portal-h2">' + esc(T('expired')) + '</h2><p>' + esc(T('expiredText')) + '</p>'; return; }
    if (p.status === 'accepted') { act.innerHTML = '<p>' + esc(T('accepted', { d: fmtD(p.accepted_at) })) + '</p><div id="pay-box"></div>'; return startPay({ name: p.accepted_name, agree: true }); }
    act.innerHTML = '<div class="portal-btn-row prop-cta"><button class="btn btn--navy btn--lg" type="button" id="b-acc">' + esc(T('acceptPay')) + '</button><button class="btn btn--ghost" type="button" id="b-rej">' + esc(T('reject')) + '</button>' +
      '<a class="btn btn--ghost" href="https://wa.me/16306898702" target="_blank" rel="noopener">' + esc(T('questions')) + '</a></div>';
    $('#b-acc').onclick = function () { acceptModal(oneTotal, mTotal); };
    $('#b-rej').onclick = rejectModal;
    if (intent === 'pay') acceptModal(oneTotal, mTotal); else if (intent === 'reject') rejectModal();
  }
  function modal(html) {
    var o = document.createElement('div'); o.className = 'prop-modal'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.innerHTML = '<div class="prop-modal__card">' + html + '</div>'; document.body.appendChild(o);
    var close = function () { o.remove(); document.removeEventListener('keydown', key); };
    var key = function (e) { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', key);
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    setTimeout(function () { var f = o.querySelector('input, textarea, button'); if (f) f.focus(); }, 30);
    return { el: o, close: close };
  }
  function acceptModal(oneTotal, mTotal) {
    var first = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    var m = modal('<h2 class="portal-h2">' + esc(T('mTitle')) + '</h2><p class="portal-muted">' + esc(T('mLead')) + '</p>' +
      (P.terms ? '<div class="prop-terms">' + esc(P.terms).replace(/\n/g, '<br>') + '</div>' : '') +
      (mTotal ? '<div class="prop-auth"><strong>' + esc(T('authTitle')) + '</strong><p>' + esc(T('auth', { a: money(mTotal, P.currency), d: fmtD(first) })) + '</p></div>' : '') +
      '<form class="portal-form" id="acc-f" novalidate><div class="field"><label for="acc-name">' + esc(T('name')) + '</label><input id="acc-name" autocomplete="name" required maxlength="200"></div>' +
      '<div class="check-row"><input type="checkbox" id="acc-agree" required><label for="acc-agree">' + esc(T('agree')) + '</label></div><div class="portal-alert" id="acc-msg" role="alert"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + esc(T('cont')) + '</button><button class="btn btn--ghost" type="button" id="acc-x">' + esc(T('cancel')) + '</button></div></form>');
    $('#acc-x', m.el).onclick = m.close;
    $('#acc-f', m.el).onsubmit = async function (e) {
      e.preventDefault();
      var name = $('#acc-name', m.el).value.trim(), msg = $('#acc-msg', m.el);
      if (name.length < 3 || !$('#acc-agree', m.el).checked) return alertBox(msg, T('errName'));
      var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
      try { m.close(); $('#act').innerHTML = '<div id="pay-box"><p class="portal-muted">…</p></div>'; await startPay({ name: name, agree: true }); }
      catch (x) { btn.disabled = false; alertBox(msg, T('errGeneric')); }
    };
  }
  function rejectModal() {
    var m = modal('<h2 class="portal-h2">' + esc(T('rTitle')) + '</h2><p class="portal-muted">' + esc(T('rLead')) + '</p><form class="portal-form" id="rej-f" novalidate>' +
      '<div class="field"><label for="rej-r">' + esc(T('reason')) + ' <span class="req" aria-hidden="true">*</span></label><textarea id="rej-r" rows="4" maxlength="2000" required aria-required="true"></textarea></div><div class="portal-alert" id="rej-m" role="alert"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--danger" type="submit">' + esc(T('rSend')) + '</button><button class="btn btn--ghost" type="button" id="rej-x">' + esc(T('cancel')) + '</button></div></form>');
    $('#rej-x', m.el).onclick = m.close;
    $('#rej-f', m.el).onsubmit = async function (e) {
      e.preventDefault();
      var r = $('#rej-r', m.el).value.trim(); if (r.length < 3) return alertBox($('#rej-m', m.el), T('errReason'));
      var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
      try { await EP.fn('payments', { action: 'proposal_reject', token: token, reason: r }); m.close(); $('#act').innerHTML = '<div class="prop-ok"><h2 class="portal-h2">' + esc(T('rDone')) + '</h2><p>' + esc(T('rDoneText')) + '</p></div>'; }
      catch (x) { btn.disabled = false; alertBox($('#rej-m', m.el), x.code === 'proposal_closed' ? T('expiredText') : T('errGeneric')); }
    };
  }
  function loadStripe() { return window.Stripe ? Promise.resolve(window.Stripe) : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = function () { ok(window.Stripe); }; s.onerror = no; document.head.appendChild(s); }); }
  async function startPay(acc) {
    var box = $('#pay-box') || $('#act');
    var r;
    try { r = await EP.fn('payments', { action: 'proposal_accept', token: token, name: acc.name, agree: true }); }
    catch (x) { box.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">' + esc(x.code === 'proposal_closed' ? T('expiredText') : T('errGeneric')) + '</div>'; return; }
    if (r.paid) return done(true);
    if (!r.client_secret) { box.innerHTML = '<div class="portal-alert portal-alert--info" style="display:block">' + esc(T('notReady')) + '</div>'; return; }
    var label = r.mode === 'setup' ? T('save') : T('pay', { a: money(r.amount, P.currency) });
    box.innerHTML = '<h2 class="portal-h2">' + esc(T('payTitle')) + '</h2><p class="portal-muted" style="font-size:.9rem">' + esc(T('payLead')) + '</p><form id="pay-f" novalidate><div id="pay-el" class="ck-element"><p class="portal-muted">…</p></div>' +
      '<div class="portal-alert" id="pay-m" role="alert"></div><button class="btn btn--navy btn--block" type="submit" id="pay-b" disabled>' + esc(label) + '</button></form><p class="ck-secure">🔒 ' + esc(T('secure')) + '</p>' +
      (r.hosted ? '<p style="text-align:center;font-size:.88rem"><a href="' + esc(r.hosted) + '" target="_blank" rel="noopener">' + esc(T('hosted')) + '</a></p>' : '');
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var Stripe = await loadStripe(), stripe = Stripe(r.pk, { locale: { pt: 'pt-BR', es: 'es', en: 'en' }[L] || 'auto' });
    var elements = stripe.elements({ clientSecret: r.client_secret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0b1f3a', colorText: '#14213d', borderRadius: '8px', fontFamily: 'Inter, system-ui, sans-serif' } } });
    var pe = elements.create('payment', { layout: { type: 'tabs', defaultCollapsed: false }, defaultValues: { billingDetails: { name: acc.name || '', email: r.email || '' } } });
    $('#pay-el').innerHTML = ''; pe.mount('#pay-el'); pe.on('ready', function () { $('#pay-b').disabled = false; });
    $('#pay-f').onsubmit = async function (e) {
      e.preventDefault(); var b = $('#pay-b'); b.disabled = true;
      var ret = location.href.split('#')[0].replace(/([?&])a=[^&]*/, '$1').replace(/[?&]$/, '');
      var res = r.mode === 'setup' ? await stripe.confirmSetup({ elements: elements, redirect: 'if_required', confirmParams: { return_url: ret } })
        : await stripe.confirmPayment({ elements: elements, redirect: 'if_required', confirmParams: { return_url: ret } });
      if (res.error) { b.disabled = false; return alertBox($('#pay-m'), res.error.message || T('errGeneric')); }
      done(false);
    };
  }
  function done(already) {
    $('#act').innerHTML = '<div class="prop-ok" role="status"><svg class="prop-ok__ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1e6b3a"/><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<h2 class="portal-h2">' + esc(already ? T('paidAlready') : T('okTitle')) + '</h2>' + (already ? '' : '<p>' + esc(T('okText')) + '</p><p class="portal-muted">' + esc(T('okPortal')) + '</p>') + '</div>';
  }

  (async function () {
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return fail(T('notFound'), T('notFoundText'));
    try { var p = await EP.fn('payments', { action: 'proposal_get', token: token }); state.hidden = true; flow.hidden = false; render(p); }
    catch (e) { fail(T('notFound'), T('notFoundText')); }
  })();
})();
