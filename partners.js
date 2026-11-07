/* Public Partner Program page: benefits + self sign-up (partner-invite function, action "signup").
   The partner gets the email to create the password; onboarding happens in the portal ("Start here"),
   the account is activated automatically when every step is done, and the welcome call is booked after that. */
(function () {
  'use strict';
  var DICT = {
    en: {
      cc: 'Country code', sending: 'Creating your account…', submit: 'Create my partner account',
      errName: 'Enter your full name.', errEmail: 'Enter a valid email address.', errPhone: 'Enter your WhatsApp number with the area code.', errType: 'Select your profession.', errOk: 'Please confirm to continue.',
      already_registered: 'This email is already registered in the Partner Program. Open the Partner Portal and use "Forgot password", or write to support@endeavorbiz.com.',
      email_in_use: 'This email is already used by another Endeavor account. Please use a different email or write to support@endeavorbiz.com.', rate_limited: 'Too many attempts. Please try again later.',
      generic: 'Something went wrong. Please try again or write to support@endeavorbiz.com.', doneText: 'We sent an email to {email} with the link to create your password and open the Partner Portal.'
    },
    pt: {
      docTitle: 'Programa de Parceiros | Endeavor Business Solutions', skip: 'Pular para o conteúdo', login: 'Entrar no portal', kicker: 'PROGRAMA DE PARCEIROS',
      title: 'Cresça junto com a Endeavor Business Solutions', lead: 'Indique clientes que precisam de empresa nos Estados Unidos. A gente cuida de tudo, você acompanha cada etapa pelo seu portal e recebe a sua comissão automaticamente.',
      cta: 'Quero ser parceiro', howBtn: 'Como funciona', benTitle: 'Por que ser parceiro',
      b1t: 'Comissão em cada indicação', b1: 'Você ganha sobre os serviços contratados pelos clientes que indicar. Sem custo para participar e sem meta mínima.',
      b2t: 'Pagamento automático', b2: 'Conecte a sua conta Stripe uma vez e a sua parte cai direto para você quando o cliente paga. O Stripe também cuida dos seus formulários fiscais.',
      b3t: 'Seu próprio portal', b3: 'Envie indicações, acompanhe cada cliente etapa por etapa e veja o que já recebeu e o que vai receber.',
      b4t: 'Atendimento completo', b4: 'Nossa equipe cuida de abertura de empresa, compliance, coordenação fiscal, conta bancária e imóveis, em português, inglês ou espanhol.',
      howTitle: 'Como funciona', s1t: 'Cadastre-se', s1: 'Preencha o formulário curto abaixo. O seu acesso ao Portal do Parceiro é criado na hora.',
      s2t: 'Onboarding no portal', s2: 'Assista ao vídeo, assine o contrato de parceria online e configure como você recebe. O nosso assistente ajuda em cada passo.',
      s3t: 'Conta ativada', s3: 'Concluídos os passos, a sua conta é ativada automaticamente e você agenda uma conversa de boas-vindas com a nossa equipe.',
      s4t: 'Indique e receba', s4: 'Indique clientes pelo portal e receba a sua parte a cada pagamento.',
      formTitle: 'Quero ser parceiro', formLead: 'Leva uns 2 minutos. O seu acesso ao Portal do Parceiro é criado na hora.',
      yourDetails: 'Seus dados', name: 'Nome completo', email: 'E-mail', company: 'Empresa (se houver)', profession: 'Profissão', select: 'Selecione',
      t_accountant: 'Contador', t_realtor: 'Corretor de imóveis', t_attorney: 'Advogado', t_bookkeeping: 'Bookkeeping', t_pm: 'Administração de imóveis', t_consultant: 'Consultor / assessor', t_other: 'Outro',
      country: 'País onde você atua', plang: 'Idioma preferido', notes: 'Conte um pouco sobre os seus clientes (opcional)',
      noSensitive: 'Não inclua SSN, ITIN, passaporte ou dados bancários. Os dados para receber são informados depois, direto no Stripe.',
      consent: 'Aceito receber e-mails e mensagens de WhatsApp sobre o Programa de Parceiros e o meu onboarding (posso parar quando quiser). A comissão padrão é de 10% e fica definida no contrato de parceria que vou assinar no portal.',
      privacy: 'Usamos os seus dados para operar o Programa de Parceiros, como descrito na nossa', pp: 'Política de Privacidade', already: 'Já é parceiro?',
      cc: 'Código do país', sending: 'Criando a sua conta…', submit: 'Criar minha conta de parceiro',
      errName: 'Informe o nome completo.', errEmail: 'Informe um e-mail válido.', errPhone: 'Informe o WhatsApp com o DDD.', errType: 'Selecione a sua profissão.', errOk: 'Confirme para continuar.',
      already_registered: 'Este e-mail já está cadastrado no Programa de Parceiros. Abra o Portal do Parceiro e use "Esqueci a senha", ou escreva para support@endeavorbiz.com.',
      email_in_use: 'Este e-mail já é usado por outra conta da Endeavor. Use outro e-mail ou escreva para support@endeavorbiz.com.', rate_limited: 'Muitas tentativas. Tente de novo mais tarde.',
      generic: 'Algo deu errado. Tente de novo ou escreva para support@endeavorbiz.com.',
      doneTitle: 'Boas-vindas ao Programa de Parceiros!', doneText: 'Enviamos um e-mail para {email} com o link para criar a sua senha e entrar no Portal do Parceiro.',
      n1: 'Abra o e-mail que acabamos de enviar e crie a sua senha (isso também ativa a verificação em duas etapas).',
      n2: 'O portal abre em "Comece aqui": assista ao vídeo curto, assine o contrato de parceria e configure como você recebe.',
      n3: 'Concluídos todos os passos, a sua conta é ativada automaticamente e você pode agendar a conversa de boas-vindas e começar a indicar.',
      openPortal: 'Abrir o Portal do Parceiro'
    },
    es: {
      docTitle: 'Programa de Socios | Endeavor Business Solutions', skip: 'Saltar al contenido', login: 'Entrar al portal', kicker: 'PROGRAMA DE SOCIOS',
      title: 'Crezca junto a Endeavor Business Solutions', lead: 'Recomiende clientes que necesitan una empresa en Estados Unidos. Nosotros nos encargamos de todo, usted sigue cada etapa en su portal y recibe su comisión automáticamente.',
      cta: 'Quiero ser socio', howBtn: 'Cómo funciona', benTitle: 'Por qué ser socio',
      b1t: 'Comisión por cada recomendación', b1: 'Usted gana sobre los servicios que contraten los clientes que recomiende. Sin costo para participar y sin metas mínimas.',
      b2t: 'Pago automático', b2: 'Conecte su cuenta Stripe una vez y su parte le llega directo cuando el cliente paga. Stripe también se encarga de sus formularios fiscales.',
      b3t: 'Su propio portal', b3: 'Envíe recomendaciones, siga cada cliente paso a paso y vea lo que ya recibió y lo que va a recibir.',
      b4t: 'Atención completa', b4: 'Nuestro equipo se encarga de constitución de empresas, cumplimiento, coordinación fiscal, cuenta bancaria y bienes raíces, en español, inglés o portugués.',
      howTitle: 'Cómo funciona', s1t: 'Regístrese', s1: 'Complete el formulario corto de abajo. Su acceso al Portal de Socios se crea al instante.',
      s2t: 'Onboarding en el portal', s2: 'Mire el video, firme el contrato de socio en línea y configure cómo recibe. Nuestro asistente lo ayuda en cada paso.',
      s3t: 'Cuenta activada', s3: 'Al completar los pasos, su cuenta se activa automáticamente y usted agenda una llamada de bienvenida con nuestro equipo.',
      s4t: 'Recomiende y reciba', s4: 'Recomiende clientes en el portal y reciba su parte con cada pago.',
      formTitle: 'Quiero ser socio', formLead: 'Toma unos 2 minutos. Su acceso al Portal de Socios se crea al instante.',
      yourDetails: 'Sus datos', name: 'Nombre completo', email: 'Correo', company: 'Empresa (si tiene)', profession: 'Profesión', select: 'Seleccione',
      t_accountant: 'Contador', t_realtor: 'Agente inmobiliario', t_attorney: 'Abogado', t_bookkeeping: 'Bookkeeping', t_pm: 'Administración de propiedades', t_consultant: 'Consultor / asesor', t_other: 'Otro',
      country: 'País donde trabaja', plang: 'Idioma preferido', notes: 'Cuéntenos sobre sus clientes (opcional)',
      noSensitive: 'No incluya SSN, ITIN, pasaporte ni datos bancarios. Los datos para recibir se ingresan después, directamente en Stripe.',
      consent: 'Acepto recibir correos y mensajes de WhatsApp sobre el Programa de Socios y mi onboarding (puedo detenerlos cuando quiera). La comisión estándar es de 10% y queda definida en el contrato de socio que firmaré en el portal.',
      privacy: 'Usamos sus datos para operar el Programa de Socios, como se describe en nuestra', pp: 'Política de Privacidad', already: '¿Ya es socio?',
      cc: 'Código de país', sending: 'Creando su cuenta…', submit: 'Crear mi cuenta de socio',
      errName: 'Ingrese su nombre completo.', errEmail: 'Ingrese un correo válido.', errPhone: 'Ingrese su WhatsApp con el código de área.', errType: 'Seleccione su profesión.', errOk: 'Confirme para continuar.',
      already_registered: 'Este correo ya está registrado en el Programa de Socios. Abra el Portal de Socios y use "Olvidé mi contraseña", o escriba a support@endeavorbiz.com.',
      email_in_use: 'Este correo ya lo usa otra cuenta de Endeavor. Use otro correo o escriba a support@endeavorbiz.com.', rate_limited: 'Demasiados intentos. Intente de nuevo más tarde.',
      generic: 'Algo salió mal. Intente de nuevo o escriba a support@endeavorbiz.com.',
      doneTitle: '¡Bienvenido(a) al Programa de Socios!', doneText: 'Enviamos un correo a {email} con el enlace para crear su contraseña y entrar al Portal de Socios.',
      n1: 'Abra el correo que acabamos de enviar y cree su contraseña (también activa la verificación en dos pasos).',
      n2: 'El portal abre en "Empiece aquí": mire el video corto, firme el contrato de socio y configure cómo recibe.',
      n3: 'Al completar todos los pasos, su cuenta se activa automáticamente y puede agendar la llamada de bienvenida y empezar a recomendar.',
      openPortal: 'Abrir el Portal de Socios'
    }
  };
  EP.init(DICT);
  var t = function (k) { return (DICT[EP.lang] && DICT[EP.lang][k]) || DICT.en[k] || k; };
  var $ = function (id) { return document.getElementById(id); };
  var t0 = Date.now();
  $('p-lang').value = EP.lang;
  var phone = EPhone.mount($('p-phone-box'), { id: 'p-phone', lang: EP.lang, ccLabel: t('cc'), onchange: function () { if (phone && phone.valid()) err('p-phone', ''); } });
  function err(id, text) {
    var i = $(id), e = $(id + '-err'); if (!e) return !text;
    e.textContent = text || ''; if (i) { i.setAttribute('aria-invalid', text ? 'true' : 'false'); if (text) i.setAttribute('aria-describedby', id + '-err'); }
    return !text;
  }
  $('pf').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var name = $('p-name').value.trim(), email = $('p-email').value.trim().toLowerCase();
    var checks = [
      ['p-name', err('p-name', name.length < 2 ? t('errName') : '')],
      ['p-email', err('p-email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : t('errEmail'))],
      ['p-phone', err('p-phone', phone.valid() ? '' : t('errPhone'))],
      ['p-type', err('p-type', $('p-type').value ? '' : t('errType'))]
    ];
    var okBox = err('p-ok', $('p-ok').checked ? '' : t('errOk'));
    var bad = checks.filter(function (c) { return !c[1]; })[0];
    if (bad) return $(bad[0]).focus();
    if (!okBox) return $('p-ok').focus();
    var btn = $('p-submit'), m = $('p-msg');
    btn.disabled = true; btn.textContent = t('sending'); m.className = 'portal-alert'; m.textContent = '';
    try {
      await EP.fn('partner-invite', { action: 'signup', name: name, email: email, phone: phone.e164(), company: $('p-company').value.trim(), partner_type: $('p-type').value,
        country: $('p-country').value.trim(), language: $('p-lang').value, notes: $('p-notes').value.trim(), consent: true, website: $('p-web').value, elapsed: Date.now() - t0 });
      $('pf').hidden = true; $('done').hidden = false;
      $('done-text').textContent = t('doneText').replace('{email}', email);
      $('done').focus();
    } catch (e) {
      var code = String(e.code || e.message || '');
      var key = ['already_registered', 'email_in_use', 'rate_limited'].filter(function (k) { return code.indexOf(k) > -1; })[0];
      m.className = 'portal-alert portal-alert--error'; m.textContent = t(key || 'generic');
      btn.disabled = false; btn.textContent = t('submit');
    }
  });
  if (location.hash === '#cadastro') setTimeout(function () { var c = $('cadastro'); if (c) c.scrollIntoView(); }, 50);
})();
