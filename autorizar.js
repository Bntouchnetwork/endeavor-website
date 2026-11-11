/* ACH debit authorization on the company's US business account (secure link from e-mail/WhatsApp).
   The client connects the account through Stripe Financial Connections and accepts the ACH mandate.
   From the next charge on, the monthly maintenance is debited from this account. */
(function () {
  'use strict';
  var t = EP.init({
    en: {},
    pt: { docTitle: 'Autorização de débito | Endeavor Business Solutions', loading: 'Carregando…', skip: 'Pular para o conteúdo' },
    es: { docTitle: 'Autorización de débito | Endeavor Business Solutions', loading: 'Cargando…', skip: 'Saltar al contenido' }
  });
  var L = EP.lang;
  var D = {
    en: { eyebrow: 'Monthly payment', title: 'Debit from the company account', lead: 'Hello, {n}. Connect your company\'s US business account so the monthly maintenance ({a}/mo) is debited from it from the next charge on.',
      holder: 'Account holder (company name)', mandate: 'I authorize Endeavor Business Solutions to debit the monthly maintenance and any invoices I approve from this bank account via ACH, on each due date, until I cancel in writing with 3 business days\' notice. I can revoke this authorization at any time by writing to support@endeavorbiz.com.',
      agree: 'I accept the ACH debit authorization above.', connect: 'Connect bank account', how: 'You choose your bank and sign in on Stripe\'s secure window. Endeavor does not see your bank login or the full account number.',
      done: 'Done! Debit authorized', doneText: 'From the next charge, the monthly maintenance will be debited from {b}. You will get the receipt by e-mail every month.',
      notFound: 'Link not found or expired', notFoundText: 'Write to support@endeavorbiz.com and we will send you a new link.', err: 'The account was not connected. Try again or write to support@endeavorbiz.com.', errForm: 'Type the account holder and accept the authorization.', notReady: 'Online authorization is being set up. We will be in touch shortly.', secure: 'Secure connection by Stripe' },
    pt: { eyebrow: 'Pagamento mensal', title: 'Débito na conta da empresa', lead: 'Olá, {n}. Conecte a conta bancária americana da sua empresa para que a manutenção mensal ({a}/mês) seja debitada dela a partir da próxima cobrança.',
      holder: 'Titular da conta (nome da empresa)', mandate: 'Autorizo a Endeavor Business Solutions a debitar a manutenção mensal e as faturas que eu aprovar desta conta bancária via ACH, em cada vencimento, até eu cancelar por escrito com 3 dias úteis de antecedência. Posso revogar esta autorização a qualquer momento escrevendo para support@endeavorbiz.com.',
      agree: 'Aceito a autorização de débito ACH acima.', connect: 'Conectar conta bancária', how: 'Você escolhe o seu banco e entra na janela segura do Stripe. A Endeavor não vê o seu login do banco nem o número completo da conta.',
      done: 'Pronto! Débito autorizado', doneText: 'A partir da próxima cobrança, a manutenção mensal será debitada de {b}. Você recebe o recibo por e-mail todo mês.',
      notFound: 'Link não encontrado ou expirado', notFoundText: 'Escreva para support@endeavorbiz.com que enviamos um novo link.', err: 'A conta não foi conectada. Tente de novo ou escreva para support@endeavorbiz.com.', errForm: 'Digite o titular da conta e aceite a autorização.', notReady: 'A autorização online está sendo configurada. Entraremos em contato em breve.', secure: 'Conexão segura pelo Stripe' },
    es: { eyebrow: 'Pago mensual', title: 'Débito en la cuenta de la empresa', lead: 'Hola, {n}. Conecte la cuenta bancaria estadounidense de su empresa para que el mantenimiento mensual ({a}/mes) se debite de ella desde el próximo cobro.',
      holder: 'Titular de la cuenta (nombre de la empresa)', mandate: 'Autorizo a Endeavor Business Solutions a debitar el mantenimiento mensual y las facturas que yo apruebe de esta cuenta bancaria vía ACH, en cada vencimiento, hasta que cancele por escrito con 3 días hábiles de anticipación. Puedo revocar esta autorización en cualquier momento escribiendo a support@endeavorbiz.com.',
      agree: 'Acepto la autorización de débito ACH anterior.', connect: 'Conectar cuenta bancaria', how: 'Usted elige su banco e inicia sesión en la ventana segura de Stripe. Endeavor no ve su acceso al banco ni el número completo de la cuenta.',
      done: '¡Listo! Débito autorizado', doneText: 'Desde el próximo cobro, el mantenimiento mensual se debitará de {b}. Recibirá el recibo por correo cada mes.',
      notFound: 'Enlace no encontrado o vencido', notFoundText: 'Escriba a support@endeavorbiz.com y le enviaremos un nuevo enlace.', err: 'La cuenta no se conectó. Intente de nuevo o escriba a support@endeavorbiz.com.', errForm: 'Escriba el titular de la cuenta y acepte la autorización.', notReady: 'La autorización en línea se está configurando. Nos comunicaremos pronto.', secure: 'Conexión segura con Stripe' }
  };
  function T(k, v) { var s = (D[L] || D.en)[k] || D.en[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); }); return s; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $ = function (s) { return document.querySelector(s); };
  var money = function (c) { return new Intl.NumberFormat(EP.locale, { style: 'currency', currency: 'USD' }).format((c || 0) / 100); };
  var token = new URLSearchParams(location.search).get('t') || window.DEMO_ACH_TOKEN || '';
  var state = $('#state'), flow = $('#flow');
  function fail(a, b) { state.hidden = false; flow.hidden = true; state.innerHTML = '<h1 class="portal-h2">' + esc(a) + '</h1><p>' + esc(b) + '</p>'; }
  function done(bank) {
    flow.innerHTML = '<section class="portal-card"><div class="prop-ok" role="status"><svg class="prop-ok__ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1e6b3a"/><path d="M7 12.5l3.2 3L17 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<h1 class="portal-h2">' + esc(T('done')) + '</h1><p>' + esc(T('doneText', { b: bank || '—' })) + '</p></div></section>';
  }
  function loadStripe() { return window.Stripe ? Promise.resolve(window.Stripe) : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = function () { ok(window.Stripe); }; s.onerror = no; document.head.appendChild(s); }); }
  function render(r) {
    flow.innerHTML = '<div class="prop-hero"><p class="prop-eyebrow">' + esc(T('eyebrow')) + '</p><h1 class="portal-h1">' + esc(T('title')) + '</h1><p class="prop-intro">' + esc(T('lead', { n: r.client_name, a: money(r.monthly) })) + '</p></div>' +
      '<section class="portal-card"><form class="portal-form" id="f" novalidate><div class="field"><label for="holder">' + esc(T('holder')) + '</label><input id="holder" maxlength="160" autocomplete="organization" value="' + esc(r.client_name || '') + '"></div>' +
      '<div class="prop-auth"><p style="margin:0">' + esc(T('mandate')) + '</p></div><div class="check-row"><input type="checkbox" id="agree"><label for="agree">' + esc(T('agree')) + '</label></div>' +
      '<div class="portal-alert" id="m" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + esc(T('connect')) + '</button></form>' +
      '<p class="ck-secure">🔒 ' + esc(T('secure')) + ' · ' + esc(T('how')) + '</p></section>';
    $('#f').onsubmit = async function (e) {
      e.preventDefault();
      var m = $('#m'), holder = $('#holder').value.trim(), b = this.querySelector('button');
      var bad = function (x) { m.className = 'portal-alert portal-alert--error'; m.textContent = x; };
      if (holder.length < 2 || !$('#agree').checked) return bad(T('errForm'));
      if (!r.client_secret) return bad(T('notReady'));
      b.disabled = true;
      try {
        var Stripe = await loadStripe(), stripe = Stripe(r.pk, { locale: { pt: 'pt-BR', es: 'es', en: 'en' }[L] || 'auto' });
        var c = await stripe.collectBankAccountForSetup({ clientSecret: r.client_secret, params: { payment_method_type: 'us_bank_account', payment_method_data: { billing_details: { name: holder, email: r.email || undefined } } } });
        if (c.error) throw c.error;
        if (c.setupIntent.status === 'requires_payment_method') { b.disabled = false; return; } // closed the window
        var s = c.setupIntent;
        if (s.status === 'requires_confirmation') { var cf = await stripe.confirmUsBankAccountSetup(r.client_secret); if (cf.error) throw cf.error; s = cf.setupIntent; }
        var fin = await EP.fn('payments', { action: 'ach_complete', token: token, setup_intent: s.id });
        done(fin.bank);
      } catch (x) { b.disabled = false; bad((x && x.message && x.type) ? x.message : T('err')); }
    };
  }
  (async function () {
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return fail(T('notFound'), T('notFoundText'));
    try {
      var r = await EP.fn('payments', { action: 'ach_get', token: token });
      state.hidden = true; flow.hidden = false;
      if (r.done) return done(r.bank);
      render(r);
    } catch (e) { if (e.code === 'stripe_not_configured') { state.hidden = true; flow.hidden = false; render({ client_name: '', monthly: 0 }); } else fail(T('notFound'), T('notFoundText')); }
  })();
})();
