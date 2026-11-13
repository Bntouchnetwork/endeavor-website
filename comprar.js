/* Online checkout for the services on the home page (comprar.html?p=CODE).
   1. The buyer fills name, company, e-mail and WhatsApp.  2. Pays in the embedded Stripe Checkout.
   3. Back here, the page confirms the payment; the account is created and the access e-mail is sent
      (create password, authenticator, portal link and "forgot my password"). */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG, app = document.getElementById('app');
  var D = {
    en: { loading: 'Loading…', skip: 'Skip to content', notFound: 'This service was not found.', back: 'Back to services', soon: 'This service is coming soon. Join the waiting list and we will let you know.', wait: 'Join the waiting list',
      s1: 'Your details', s2: 'Payment', s3: 'Portal access', name: 'Full name', company: 'Company name', email: 'E-mail', emailHint: 'Your login to the portal. We will send the access link here.', phone: 'Cell phone / WhatsApp', phoneHint: 'Choose the country and type the number. U.S. and Brazilian numbers are accepted, among others.', cc: 'Country code',
      terms: 'I agree to the <a href="terms-of-use.html" target="_blank" rel="noopener">Terms of Use</a> and the <a href="privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>, and I understand the plan renews automatically until I cancel it in the portal.',
      termsOnce: 'I agree to the <a href="terms-of-use.html" target="_blank" rel="noopener">Terms of Use</a> and the <a href="privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>.',
      cont: 'Continue to payment', edit: 'Edit my details', secure: 'Payment is processed by Stripe. Endeavor never sees or stores your card details.', included: 'What is included', perMonth: 'Billed monthly. Cancel anytime in the portal.', perYear: 'Billed yearly.',
      already: 'Already a client? Sign in to the portal and add this service under Services, with the same login.', signIn: 'Sign in to the portal',
      e_invalid_name: 'Enter your full name.', e_invalid_company: 'Enter the company name (or your name, if you work on your own).', e_invalid_email: 'Enter a valid e-mail.', e_invalid_phone: 'Check the cell phone number: choose the country and type the full number.', e_terms_required: 'Please accept the terms to continue.',
      e_already_active: 'This e-mail already has this service. Sign in to the portal to use it.', e_too_many_attempts: 'Too many attempts. Please wait a few minutes and try again.', e_not_available: 'This service is not available right now.', e_stripe_not_configured: 'Online payment is being set up. Please write to support@endeavorbiz.com.', e_generic: 'Something went wrong. Please try again or write to support@endeavorbiz.com.',
      checking: 'Confirming your payment…', okTitle: 'Payment confirmed. Welcome to Endeavor!', okLead: 'Your portal account is ready with {p} turned on.', okSteps: ['Open the e-mail we sent to <strong>{e}</strong> (check spam too).', 'Click <strong>Create my password</strong> to confirm your e-mail and create your password.', 'Turn on two-step verification with Google Authenticator or Microsoft Authenticator.', 'Done: your service is waiting for you in the portal.'],
      openPortal: 'Open the portal', forgot: 'Forgot my password', noMail: 'Did not get the e-mail in 10 minutes? Use “Forgot my password” with the same e-mail, or write to support@endeavorbiz.com.',
      pending: 'Your payment is still being processed. This can take a moment for bank payments. You will receive the access e-mail as soon as it is confirmed.', failed: 'We received your payment, but could not finish creating your account automatically. Our team was notified and will contact you shortly.', expired: 'This checkout expired. Please start again.', again: 'Start again' },
    pt: { loading: 'Carregando…', skip: 'Pular para o conteúdo', notFound: 'Serviço não encontrado.', back: 'Voltar aos serviços', soon: 'Este serviço chega em breve. Entre na lista de espera que avisamos você.', wait: 'Entrar na lista de espera',
      s1: 'Seus dados', s2: 'Pagamento', s3: 'Acesso ao portal', name: 'Nome completo', company: 'Nome da empresa', email: 'E-mail', emailHint: 'É o seu login no portal. Vamos mandar o link de acesso para cá.', phone: 'Celular / WhatsApp', phoneHint: 'Escolha o país e digite o número. Aceita números dos EUA e do Brasil, entre outros.', cc: 'Código do país',
      terms: 'Concordo com os <a href="terms-of-use.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="privacy-policy.html" target="_blank" rel="noopener">Política de Privacidade</a>, e entendo que o plano renova automaticamente até eu cancelar no portal.',
      termsOnce: 'Concordo com os <a href="terms-of-use.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="privacy-policy.html" target="_blank" rel="noopener">Política de Privacidade</a>.',
      cont: 'Continuar para o pagamento', edit: 'Editar meus dados', secure: 'Pagamento processado pelo Stripe. A Endeavor não vê nem guarda os dados do seu cartão.', included: 'O que está incluído', perMonth: 'Cobrança mensal. Cancele quando quiser pelo portal.', perYear: 'Cobrança anual.',
      already: 'Já é cliente? Entre no portal e contrate este serviço em Serviços, com o mesmo login.', signIn: 'Entrar no portal',
      e_invalid_name: 'Informe o seu nome completo.', e_invalid_company: 'Informe o nome da empresa (ou o seu nome, se trabalha por conta própria).', e_invalid_email: 'Informe um e-mail válido.', e_invalid_phone: 'Confira o celular: escolha o país e digite o número completo, com DDD.', e_terms_required: 'Aceite os termos para continuar.',
      e_already_active: 'Este e-mail já tem este serviço. Entre no portal para usar.', e_too_many_attempts: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.', e_not_available: 'Este serviço não está disponível no momento.', e_stripe_not_configured: 'O pagamento online está sendo configurado. Escreva para support@endeavorbiz.com.', e_generic: 'Algo deu errado. Tente de novo ou escreva para support@endeavorbiz.com.',
      checking: 'Confirmando o seu pagamento…', okTitle: 'Pagamento confirmado. Bem-vindo à Endeavor!', okLead: 'A sua conta no portal está pronta, com {p} liberado.', okSteps: ['Abra o e-mail que enviamos para <strong>{e}</strong> (confira também o spam).', 'Clique em <strong>Criar minha senha</strong> para validar o e-mail e criar a sua senha.', 'Ative a verificação em duas etapas com o Google Authenticator ou o Microsoft Authenticator.', 'Pronto: o seu serviço já está esperando por você no portal.'],
      openPortal: 'Abrir o portal', forgot: 'Esqueci minha senha', noMail: 'Não recebeu o e-mail em 10 minutos? Use “Esqueci minha senha” com o mesmo e-mail, ou escreva para support@endeavorbiz.com.',
      pending: 'O seu pagamento ainda está sendo processado. Pagamentos bancários podem levar alguns instantes. Você recebe o e-mail de acesso assim que ele for confirmado.', failed: 'Recebemos o seu pagamento, mas não conseguimos terminar a criação da conta automaticamente. A nossa equipe já foi avisada e entra em contato em breve.', expired: 'Este pagamento expirou. Comece de novo.', again: 'Começar de novo' },
    es: { loading: 'Cargando…', skip: 'Saltar al contenido', notFound: 'Servicio no encontrado.', back: 'Volver a los servicios', soon: 'Este servicio llega pronto. Únase a la lista de espera y le avisamos.', wait: 'Unirse a la lista de espera',
      s1: 'Sus datos', s2: 'Pago', s3: 'Acceso al portal', name: 'Nombre completo', company: 'Nombre de la empresa', email: 'Correo', emailHint: 'Es su login en el portal. Le enviaremos aquí el enlace de acceso.', phone: 'Celular / WhatsApp', phoneHint: 'Elija el país y escriba el número. Acepta números de EE. UU. y de Brasil, entre otros.', cc: 'Código de país',
      terms: 'Acepto los <a href="terms-of-use.html" target="_blank" rel="noopener">Términos de Uso</a> y la <a href="privacy-policy.html" target="_blank" rel="noopener">Política de Privacidad</a>, y entiendo que el plan se renueva automáticamente hasta que lo cancele en el portal.',
      termsOnce: 'Acepto los <a href="terms-of-use.html" target="_blank" rel="noopener">Términos de Uso</a> y la <a href="privacy-policy.html" target="_blank" rel="noopener">Política de Privacidad</a>.',
      cont: 'Continuar al pago', edit: 'Editar mis datos', secure: 'Pago procesado por Stripe. Endeavor no ve ni guarda los datos de su tarjeta.', included: 'Qué incluye', perMonth: 'Cobro mensual. Cancele cuando quiera en el portal.', perYear: 'Cobro anual.',
      already: '¿Ya es cliente? Entre al portal y contrate este servicio en Servicios, con el mismo login.', signIn: 'Entrar al portal',
      e_invalid_name: 'Escriba su nombre completo.', e_invalid_company: 'Escriba el nombre de la empresa (o su nombre, si trabaja por cuenta propia).', e_invalid_email: 'Escriba un correo válido.', e_invalid_phone: 'Revise el celular: elija el país y escriba el número completo.', e_terms_required: 'Acepte los términos para continuar.',
      e_already_active: 'Este correo ya tiene este servicio. Entre al portal para usarlo.', e_too_many_attempts: 'Demasiados intentos. Espere unos minutos y vuelva a intentar.', e_not_available: 'Este servicio no está disponible por ahora.', e_stripe_not_configured: 'El pago en línea se está configurando. Escriba a support@endeavorbiz.com.', e_generic: 'Algo salió mal. Intente de nuevo o escriba a support@endeavorbiz.com.',
      checking: 'Confirmando su pago…', okTitle: 'Pago confirmado. ¡Bienvenido a Endeavor!', okLead: 'Su cuenta en el portal está lista, con {p} activado.', okSteps: ['Abra el correo que enviamos a <strong>{e}</strong> (revise también el spam).', 'Haga clic en <strong>Crear mi contraseña</strong> para validar el correo y crear su contraseña.', 'Active la verificación en dos pasos con Google Authenticator o Microsoft Authenticator.', 'Listo: su servicio lo espera en el portal.'],
      openPortal: 'Abrir el portal', forgot: 'Olvidé mi contraseña', noMail: '¿No recibió el correo en 10 minutos? Use “Olvidé mi contraseña” con el mismo correo, o escriba a support@endeavorbiz.com.',
      pending: 'Su pago todavía se está procesando. Los pagos bancarios pueden tardar un momento. Recibirá el correo de acceso en cuanto se confirme.', failed: 'Recibimos su pago, pero no pudimos terminar de crear su cuenta automáticamente. Nuestro equipo ya fue avisado y lo contactará pronto.', expired: 'Este pago venció. Comience de nuevo.', again: 'Comenzar de nuevo' }
  };
  var qs = new URLSearchParams(location.search);
  var L = (function () { var l = qs.get('lang'); if (D[l]) return l; try { l = localStorage.getItem('endeavor-lang'); } catch (e) { l = null; } if (D[l]) return l; return /^pt/i.test(navigator.language) ? 'pt' : /^es/i.test(navigator.language) ? 'es' : 'en'; })();
  function t(k, v) { var s = (D[L][k] != null ? D[L][k] : D.en[k]); if (v && typeof s === 'string') Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  document.documentElement.lang = L === 'pt' ? 'pt-BR' : L;
  document.querySelectorAll('[data-t]').forEach(function (e) { e.textContent = t(e.getAttribute('data-t')); });
  document.querySelectorAll('.lang-mini a').forEach(function (a) {
    var u = new URL(location.href); u.searchParams.set('lang', a.getAttribute('data-lang')); a.href = u.pathname.split('/').pop() + u.search;
    if (a.getAttribute('data-lang') === L) a.setAttribute('aria-current', 'true');
  });
  document.getElementById('home-link').href = 'index.html?lang=' + L + '#online-services';
  try { localStorage.setItem('endeavor-lang', L); } catch (e) { /* ignore */ }

  async function api(body) {
    var r = await fetch(CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'generic'); e.code = j.error || 'generic'; throw e; }
    return j;
  }
  function errMsg(e) { var k = 'e_' + (e && e.code); return D[L][k] || D.en[k] ? t(k) : t('e_generic'); }
  function steps(n) { return '<ol class="buy__steps">' + [t('s1'), t('s2'), t('s3')].map(function (s, i) { return '<li' + (i === n ? ' class="is-on"' : '') + '><span>' + (i + 1) + '</span>' + esc(s) + '</li>'; }).join('') + '</ol>'; }
  function summary(code, p) {
    var info = EStore.info(code, L);
    return '<aside class="portal-card buy__sum"><p class="eyebrow">Endeavor Business Solutions</p><h1>' + esc(info.name) + '</h1><p class="portal-muted">' + esc(info.lead) + '</p>' +
      '<div class="buy__price"><strong>' + EStore.money(p.price_cents) + '</strong><span class="portal-muted">' + esc(EStore.interval(p.interval, L)) + '</span></div>' +
      '<h2 class="portal-h2" style="font-size:1rem">' + t('included') + '</h2><ul class="buy__feats">' + info.feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      '<p class="portal-muted" style="font-size:.88rem">' + t(p.interval === 'year' ? 'perYear' : p.interval === 'month' ? 'perMonth' : 'secure') + '</p>' +
      '<p class="portal-muted" style="font-size:.88rem;margin-top:1rem">' + t('already') + ' <a href="client.html?lang=' + L + '">' + t('signIn') + '</a></p></aside>';
  }

  var code = (qs.get('p') || '').toLowerCase(), order = qs.get('o'), sid = qs.get('session_id');
  var saved = {};
  try { saved = JSON.parse(sessionStorage.getItem('endeavor-buy') || '{}'); } catch (e) { saved = {}; }

  async function start() {
    if (order && sid) return confirmPage();
    var rows = [];
    try { rows = await EStore.loadCatalog(CFG); } catch (e) { /* below */ }
    var p = rows.find(function (r) { return r.code === code; });
    if (!p || !EStore.info(code, L)) { app.innerHTML = '<div class="portal-card"><p>' + t('notFound') + '</p><a class="btn btn--navy" href="index.html?lang=' + L + '#online-services">' + t('back') + '</a></div>'; return; }
    document.title = EStore.info(code, L).name + ' | Endeavor Business Solutions';
    if (p.status !== 'active') { app.innerHTML = '<div class="buy">' + summary(code, p) + '<section class="portal-card"><p>' + t('soon') + '</p><a class="btn btn--gold" href="index.html?lang=' + L + '#contact">' + t('wait') + '</a></section></div>'; return; }
    formView(p);
  }

  function field(id, label, type, val, extra, hint) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" value="' + esc(val || '') + '" ' + (extra || '') + (hint ? ' aria-describedby="' + id + '-h"' : '') + '>' + (hint ? '<p class="portal-muted" id="' + id + '-h" style="font-size:.82rem;margin:.3rem 0 0">' + hint + '</p>' : '') + '</div>';
  }
  function formView(p) {
    app.innerHTML = '<div class="buy">' + summary(code, p) + '<section class="portal-card">' + steps(0) +
      '<form class="portal-form" id="f" novalidate>' +
      field('b-name', t('name'), 'text', saved.name, 'autocomplete="name" required maxlength="120"') +
      field('b-company', t('company'), 'text', saved.company, 'autocomplete="organization" required maxlength="160"') +
      field('b-email', t('email'), 'email', saved.email, 'autocomplete="email" required maxlength="254"', t('emailHint')) +
      '<div class="field"><label for="b-phone">' + t('phone') + '</label><div id="b-phone-box"></div><p class="portal-muted" id="b-phone-h" style="font-size:.82rem;margin:.3rem 0 0">' + t('phoneHint') + '</p></div>' +
      '<div class="hp" aria-hidden="true"><label for="b-web">Website</label><input id="b-web" tabindex="-1" autocomplete="off"></div>' +
      '<label class="buy__check"><input type="checkbox" id="b-terms"><span>' + t(p.interval === 'once' ? 'termsOnce' : 'terms') + '</span></label>' +
      '<div class="portal-alert" id="b-msg" role="alert"></div>' +
      '<button class="btn btn--gold btn--block" type="submit" id="b-go">' + t('cont') + '</button>' +
      '<p class="buy__secure"><span aria-hidden="true">🔒</span><span>' + t('secure') + '</span></p></form><div id="checkout" hidden></div></section></div>';
    var f = document.getElementById('f'), msg = document.getElementById('b-msg');
    // country selector (U.S., Brazil and others): the number is formatted as typed and sent in international format
    var ph = EPhone.mount(document.getElementById('b-phone-box'), { id: 'b-phone', lang: L, ccLabel: t('cc'), country: L === 'pt' ? 'BR' : L === 'en' ? 'US' : undefined, value: saved.phone || '' });
    ph.input.setAttribute('aria-describedby', 'b-phone-h'); ph.input.required = true;
    function show(m) { msg.textContent = m; msg.className = 'portal-alert portal-alert--error'; }
    f.onsubmit = async function (e) {
      e.preventDefault(); msg.className = 'portal-alert'; msg.textContent = '';
      if (document.getElementById('b-web').value) return;
      var d = { name: document.getElementById('b-name').value.trim(), company: document.getElementById('b-company').value.trim(), email: document.getElementById('b-email').value.trim().toLowerCase(), phone: ph.e164() };
      if (d.name.length < 2) { document.getElementById('b-name').focus(); return show(t('e_invalid_name')); }
      if (d.company.length < 2) { document.getElementById('b-company').focus(); return show(t('e_invalid_company')); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { document.getElementById('b-email').focus(); return show(t('e_invalid_email')); }
      if (ph.empty() || !ph.valid()) { ph.input.focus(); return show(t('e_invalid_phone')); }
      if (!document.getElementById('b-terms').checked) return show(t('e_terms_required'));
      try { sessionStorage.setItem('endeavor-buy', JSON.stringify(d)); } catch (x) { /* ignore */ }
      var btn = document.getElementById('b-go'); btn.disabled = true; btn.textContent = t('loading');
      try {
        var s = await api(Object.assign({ action: 'store_checkout', product: code, lang: L, terms: true }, d));
        var Stripe = await EStore.loadStripe();
        f.hidden = true;
        var box = document.getElementById('checkout'); box.hidden = false;
        document.querySelector('.buy__steps').outerHTML = steps(1);
        var co = await Stripe(s.publishable_key).initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(s.client_secret); } });
        co.mount('#checkout');
        var back = document.createElement('button'); back.type = 'button'; back.className = 'btn btn--ghost btn--sm'; back.style.marginTop = '1rem'; back.textContent = t('edit');
        back.onclick = function () { try { co.destroy(); } catch (x) { /* ignore */ } formView(p); };
        box.after(back);
      } catch (err) { btn.disabled = false; btn.textContent = t('cont'); show(errMsg(err)); }
    };
  }

  async function confirmPage() {
    app.innerHTML = '<section class="portal-card" style="max-width:44rem;margin:0 auto">' + steps(2) + '<p class="portal-muted">' + t('checking') + '</p></section>';
    var r = null;
    for (var i = 0; i < 12; i++) {
      try { r = await api({ action: 'store_status', order_id: order, session_id: sid }); } catch (e) { r = { status: 'error' }; }
      if (r.status === 'fulfilled' || r.status === 'expired' || r.failed) break;
      await new Promise(function (ok) { setTimeout(ok, 2500); });
    }
    var box = app.querySelector('.portal-card'), portal = 'client.html?lang=' + L;
    if (r && r.status === 'fulfilled') {
      try { sessionStorage.removeItem('endeavor-buy'); } catch (e) { /* ignore */ }
      var info = EStore.info(r.product, L) || { name: r.product };
      box.innerHTML = steps(2) + '<div class="buy__done"><div class="ok" aria-hidden="true">✓</div><h1 class="portal-h1">' + t('okTitle') + '</h1><p>' + t('okLead', { p: '<strong>' + esc(info.name) + '</strong>' }) + '</p>' +
        '<ol>' + t('okSteps').map(function (s) { return '<li>' + s.replace('{e}', esc(r.email_hint)) + '</li>'; }).join('') + '</ol>' +
        '<div class="portal-btn-row" style="justify-content:center"><a class="btn btn--navy" href="' + portal + '">' + t('openPortal') + '</a><a class="btn btn--ghost" href="' + portal + '&forgot=1">' + t('forgot') + '</a></div>' +
        '<p class="portal-muted" style="font-size:.85rem;margin-top:1rem">' + t('noMail') + '</p></div>';
      box.querySelector('h1').setAttribute('tabindex', '-1'); box.querySelector('h1').focus();
    } else if (r && r.status === 'expired') {
      box.innerHTML = '<p>' + t('expired') + '</p><a class="btn btn--navy" href="comprar.html?p=' + esc(r.product || code) + '&lang=' + L + '">' + t('again') + '</a>';
    } else if (r && r.failed) {
      box.innerHTML = '<p class="portal-alert portal-alert--error">' + t('failed') + '</p>';
    } else {
      box.innerHTML = '<p class="portal-alert portal-alert--info">' + t('pending') + '</p><a class="btn btn--ghost" href="' + portal + '">' + t('openPortal') + '</a>';
    }
  }

  // the checkout script expects EStore (store-catalog.js)
  if (!window.EStore) { var s = document.createElement('script'); s.src = 'store-catalog.js?v=20261114'; s.onload = start; document.head.appendChild(s); } else start();
})();
