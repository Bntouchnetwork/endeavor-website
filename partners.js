/* Public Partner Program page: benefits + self sign-up with the onboarding call (partner-invite function, action "signup"). */
(function () {
  'use strict';
  var DICT = {
    en: {
      tzNote: 'Times are shown in your time zone ({tz}). Our office is in Orlando, Florida (Eastern Time).', ET: 'ET', loading: 'Loading available times…', pickDayFirst: 'Select an available day.',
      noSlots: 'No times left on this day. Please choose another day.', noDays: 'There are no open times right now. Please write to support@endeavorbiz.com.', loadErr: 'We could not load the calendar. Please try again.',
      errName: 'Enter your full name.', errEmail: 'Enter a valid email address.', errPhone: 'Enter your WhatsApp number with the area code.', errType: 'Select your profession.', errSlot: 'Pick a day and time for the onboarding call.', errOk: 'Please confirm to continue.',
      cc: 'Country code', sending: 'Creating your account…', submit: 'Create my partner account',
      slot_unavailable: 'Sorry, that time was just taken. Please choose another time.', already_registered: 'This email is already registered in the Partner Program. Open the Partner Portal and use "Forgot password", or write to support@endeavorbiz.com.',
      email_in_use: 'This email is already used by another Endeavor account. Please use a different email or write to support@endeavorbiz.com.', rate_limited: 'Too many attempts. Please try again later.',
      too_many_bookings: 'You already have calls booked with us. Please write to support@endeavorbiz.com.', generic: 'Something went wrong. Please try again or write to support@endeavorbiz.com.',
      doneText: 'We sent an email to {email} with the link to create your password and open the Partner Portal. Your onboarding call:', evTitle: 'Partner onboarding call - Endeavor Business Solutions'
    },
    pt: {
      docTitle: 'Programa de Parceiros | Endeavor Business Solutions', skip: 'Pular para o conteúdo', login: 'Entrar no portal', kicker: 'PROGRAMA DE PARCEIROS',
      title: 'Cresça junto com a Endeavor Business Solutions', lead: 'Indique clientes que precisam de empresa nos Estados Unidos. A gente cuida de tudo, você acompanha cada etapa pelo seu portal e recebe a sua comissão automaticamente.',
      cta: 'Quero ser parceiro', howBtn: 'Como funciona', benTitle: 'Por que ser parceiro',
      b1t: 'Comissão em cada indicação', b1: 'Você ganha sobre os serviços contratados pelos clientes que indicar. Sem custo para participar e sem meta mínima.',
      b2t: 'Pagamento automático', b2: 'Conecte a sua conta Stripe uma vez e a sua parte cai direto para você quando o cliente paga. O Stripe também cuida dos seus formulários fiscais.',
      b3t: 'Seu próprio portal', b3: 'Envie indicações, acompanhe cada cliente etapa por etapa e veja o que já recebeu e o que vai receber.',
      b4t: 'Atendimento completo', b4: 'Nossa equipe cuida de abertura de empresa, compliance, coordenação fiscal, conta bancária e imóveis, em português, inglês ou espanhol.',
      howTitle: 'Como funciona', s1t: 'Cadastre-se', s1: 'Preencha o formulário abaixo e escolha o horário da conversa de onboarding. O seu acesso ao portal é criado na hora.',
      s2t: 'Conecte o Stripe', s2: 'No portal, crie a sua conta Stripe para receber as comissões. Leva poucos minutos.',
      s3t: 'Conversa de onboarding', s3: 'Conhecemos o seu trabalho, combinamos a sua comissão e você assina o contrato de parceria online.',
      s4t: 'Indique e receba', s4: 'Indique clientes pelo portal e receba a sua parte a cada pagamento.',
      formTitle: 'Quero ser parceiro', formLead: 'Leva uns 2 minutos. O seu cadastro é analisado pela nossa equipe na conversa de onboarding.',
      yourDetails: '1. Seus dados', name: 'Nome completo', email: 'E-mail', company: 'Empresa (se houver)', profession: 'Profissão', select: 'Selecione',
      t_accountant: 'Contador', t_realtor: 'Corretor de imóveis', t_attorney: 'Advogado', t_bookkeeping: 'Bookkeeping', t_pm: 'Administração de imóveis', t_consultant: 'Consultor / assessor', t_other: 'Outro',
      country: 'País onde você atua', plang: 'Idioma preferido', notes: 'Conte um pouco sobre os seus clientes (opcional)',
      noSensitive: 'Não informe SSN, ITIN, passaporte ou números de conta bancária. Os seus dados fiscais são informados depois, direto no Stripe.',
      pickCall: '2. Conversa de onboarding', callLead: 'Escolha o dia e o horário de uma conversa de 30 minutos com a nossa equipe.', prevMonth: 'Mês anterior', nextMonth: 'Próximo mês',
      meetType: 'Como prefere conversar?', video: 'Videochamada', phoneCall: 'Telefone',
      consent: 'Entendo que o meu cadastro é analisado pela Endeavor, que a comissão e o contrato de parceria são definidos na conversa de onboarding e que posso receber e-mails sobre o Programa de Parceiros (posso cancelar quando quiser).',
      submit: 'Criar minha conta de parceiro', privacy: 'Usamos os seus dados para o Programa de Parceiros, conforme a nossa', pp: 'Política de Privacidade',
      doneTitle: 'Bem-vindo(a) ao Programa de Parceiros!', n1: 'Abra o e-mail que acabamos de enviar e crie a sua senha (ela já ativa a verificação em duas etapas).',
      n2: 'No portal, vá em "Recebimentos Stripe" e crie a sua conta Stripe. Tenha em mãos um documento com foto, os dados bancários e o seu número fiscal (SSN, ITIN ou EIN, se estiver nos EUA). Você informa tudo direto no Stripe.',
      n3: 'Participe da conversa de onboarding. Depois dela, aprovamos a sua conta, definimos a sua comissão e enviamos o contrato de parceria para assinatura eletrônica.',
      openPortal: 'Abrir o Portal do Parceiro', addCal: 'Adicionar a conversa ao calendário',
      tzNote: 'Horários no seu fuso ({tz}). Nosso escritório fica em Orlando, Flórida (horário do Leste dos EUA).', ET: 'horário de Orlando', loading: 'Carregando horários…', pickDayFirst: 'Selecione um dia disponível.',
      noSlots: 'Não há mais horários neste dia. Escolha outro dia.', noDays: 'No momento não há horários abertos. Escreva para support@endeavorbiz.com.', loadErr: 'Não conseguimos carregar o calendário. Tente de novo.',
      errName: 'Informe seu nome completo.', errEmail: 'Informe um e-mail válido.', errPhone: 'Informe o seu WhatsApp com o DDD.', errType: 'Selecione a sua profissão.', errSlot: 'Escolha o dia e o horário da conversa de onboarding.', errOk: 'Confirme para continuar.',
      cc: 'Código do país', sending: 'Criando sua conta…',
      slot_unavailable: 'Esse horário acabou de ser reservado. Escolha outro.', already_registered: 'Este e-mail já está cadastrado no Programa de Parceiros. Abra o Portal do Parceiro e use "Esqueci a senha", ou escreva para support@endeavorbiz.com.',
      email_in_use: 'Este e-mail já é usado em outra conta da Endeavor. Use outro e-mail ou escreva para support@endeavorbiz.com.', rate_limited: 'Muitas tentativas. Tente de novo mais tarde.',
      too_many_bookings: 'Você já tem conversas agendadas com a gente. Escreva para support@endeavorbiz.com.', generic: 'Algo deu errado. Tente de novo ou escreva para support@endeavorbiz.com.',
      doneText: 'Enviamos para {email} o link para criar a sua senha e entrar no Portal do Parceiro. A sua conversa de onboarding:', evTitle: 'Conversa de onboarding de parceiro - Endeavor Business Solutions'
    },
    es: {
      docTitle: 'Programa de Socios | Endeavor Business Solutions', skip: 'Saltar al contenido', login: 'Entrar al portal', kicker: 'PROGRAMA DE SOCIOS',
      title: 'Crezca junto a Endeavor Business Solutions', lead: 'Recomiende clientes que necesitan una empresa en Estados Unidos. Nosotros nos encargamos de todo, usted sigue cada etapa en su portal y recibe su comisión automáticamente.',
      cta: 'Quiero ser socio', howBtn: 'Cómo funciona', benTitle: 'Por qué ser socio',
      b1t: 'Comisión por cada recomendación', b1: 'Usted gana sobre los servicios que contraten los clientes que recomiende. Sin costo para participar y sin metas mínimas.',
      b2t: 'Pago automático', b2: 'Conecte su cuenta Stripe una vez y su parte le llega directo cuando el cliente paga. Stripe también se encarga de sus formularios fiscales.',
      b3t: 'Su propio portal', b3: 'Envíe recomendaciones, siga cada cliente paso a paso y vea lo que ya recibió y lo que va a recibir.',
      b4t: 'Atención completa', b4: 'Nuestro equipo se encarga de constitución de empresas, cumplimiento, coordinación fiscal, cuenta bancaria y bienes raíces, en español, inglés o portugués.',
      howTitle: 'Cómo funciona', s1t: 'Regístrese', s1: 'Complete el formulario de abajo y elija el horario de la llamada de onboarding. Su acceso al portal se crea al instante.',
      s2t: 'Conecte Stripe', s2: 'En el portal, cree su cuenta Stripe para recibir las comisiones. Toma pocos minutos.',
      s3t: 'Llamada de onboarding', s3: 'Conocemos su trabajo, acordamos su comisión y usted firma el contrato de socio en línea.',
      s4t: 'Recomiende y reciba', s4: 'Recomiende clientes en el portal y reciba su parte con cada pago.',
      formTitle: 'Quiero ser socio', formLead: 'Toma unos 2 minutos. Nuestro equipo revisa su registro en la llamada de onboarding.',
      yourDetails: '1. Sus datos', name: 'Nombre completo', email: 'Correo electrónico', company: 'Empresa (si tiene)', profession: 'Profesión', select: 'Seleccione',
      t_accountant: 'Contador', t_realtor: 'Agente inmobiliario', t_attorney: 'Abogado', t_bookkeeping: 'Bookkeeping', t_pm: 'Administración de propiedades', t_consultant: 'Consultor / asesor', t_other: 'Otro',
      country: 'País donde trabaja', plang: 'Idioma preferido', notes: 'Cuéntenos sobre sus clientes (opcional)',
      noSensitive: 'No incluya SSN, ITIN, pasaporte ni números de cuenta bancaria. Sus datos fiscales se ingresan después, directamente en Stripe.',
      pickCall: '2. Llamada de onboarding', callLead: 'Elija el día y la hora de una conversación de 30 minutos con nuestro equipo.', prevMonth: 'Mes anterior', nextMonth: 'Mes siguiente',
      meetType: '¿Cómo prefiere reunirse?', video: 'Videollamada', phoneCall: 'Teléfono',
      consent: 'Entiendo que Endeavor revisa mi registro, que la comisión y el contrato de socio se definen en la llamada de onboarding y que puedo recibir correos sobre el Programa de Socios (puedo cancelar cuando quiera).',
      submit: 'Crear mi cuenta de socio', privacy: 'Usamos sus datos para el Programa de Socios, según nuestra', pp: 'Política de Privacidad',
      doneTitle: '¡Bienvenido(a) al Programa de Socios!', n1: 'Abra el correo que acabamos de enviar y cree su contraseña (también activa la verificación en dos pasos).',
      n2: 'En el portal, vaya a "Pagos Stripe" y cree su cuenta Stripe. Tenga a mano un documento con foto, sus datos bancarios y su número fiscal (SSN, ITIN o EIN, si está en EE. UU.). Usted los ingresa directamente en Stripe.',
      n3: 'Participe en la llamada de onboarding. Después, aprobamos su cuenta, definimos su comisión y enviamos el contrato de socio para firma electrónica.',
      openPortal: 'Abrir el Portal de Socios', addCal: 'Agregar la llamada a mi calendario',
      tzNote: 'Horarios en su zona horaria ({tz}). Nuestra oficina está en Orlando, Florida (hora del Este de EE. UU.).', ET: 'hora de Orlando', loading: 'Cargando horarios…', pickDayFirst: 'Seleccione un día disponible.',
      noSlots: 'No quedan horarios este día. Elija otro día.', noDays: 'En este momento no hay horarios disponibles. Escriba a support@endeavorbiz.com.', loadErr: 'No pudimos cargar el calendario. Intente de nuevo.',
      errName: 'Ingrese su nombre completo.', errEmail: 'Ingrese un correo válido.', errPhone: 'Ingrese su WhatsApp con el código de área.', errType: 'Seleccione su profesión.', errSlot: 'Elija el día y la hora de la llamada de onboarding.', errOk: 'Confirme para continuar.',
      cc: 'Código de país', sending: 'Creando su cuenta…',
      slot_unavailable: 'Ese horario acaba de ser reservado. Elija otro.', already_registered: 'Este correo ya está registrado en el Programa de Socios. Abra el Portal de Socios y use "Olvidé mi contraseña", o escriba a support@endeavorbiz.com.',
      email_in_use: 'Este correo ya se usa en otra cuenta de Endeavor. Use otro correo o escriba a support@endeavorbiz.com.', rate_limited: 'Demasiados intentos. Intente más tarde.',
      too_many_bookings: 'Ya tiene llamadas agendadas con nosotros. Escriba a support@endeavorbiz.com.', generic: 'Algo salió mal. Intente de nuevo o escriba a support@endeavorbiz.com.',
      doneText: 'Enviamos a {email} el enlace para crear su contraseña y entrar al Portal de Socios. Su llamada de onboarding:', evTitle: 'Llamada de onboarding de socio - Endeavor Business Solutions'
    }
  };
  var t = EP.init(DICT);
  var $ = function (id) { return document.getElementById(id); };
  var userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  var info = { timezone: 'America/New_York', slot_minutes: 30, max_days_ahead: 30 };
  var byDay = {}, selectedDay = null, selectedSlot = null, view = new Date(); view.setDate(1);
  var t0 = Date.now();
  $('p-lang').value = EP.lang;
  $('p-submit').textContent = t('submit');

  function dayKey(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtTime(d, tz) { return new Intl.DateTimeFormat(EP.locale, { timeZone: tz || userTz, hour: 'numeric', minute: '2-digit' }).format(d); }
  function fmtLong(d) { return new Intl.DateTimeFormat(EP.locale, { timeZone: userTz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
  var sameTz = function () { return fmtTime(new Date(), userTz) === fmtTime(new Date(), info.timezone); };
  function whenText(start) {
    var end = new Date(start.getTime() + info.slot_minutes * 6e4), s = fmtLong(start) + ', ' + fmtTime(start) + ' – ' + fmtTime(end);
    if (!sameTz()) s += ' (' + fmtTime(start, info.timezone) + ' ' + t('ET') + ')';
    return s;
  }

  var phone = EPhone.mount($('p-phone-box'), { id: 'p-phone', lang: EP.lang, ccLabel: t('cc'), onchange: function () { if (phone && phone.valid()) err('p-phone', ''); } });
  $('tz-note').textContent = t('tzNote').replace('{tz}', userTz.replace(/_/g, ' '));

  var loaded = false;
  async function loadAll() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = new Date(today.getTime() + (info.max_days_ahead + 1) * 864e5);
    draw(true);
    try {
      for (var from = new Date(today.getTime() - 864e5); from < end; from = new Date(from.getTime() + 60 * 864e5)) {
        var to = new Date(Math.min(from.getTime() + 59 * 864e5, end.getTime()));
        var rows = await EP.rpc('get_available_slots', { p_from: ymd(from), p_to: ymd(to) });
        (rows || []).forEach(function (r) { var d = new Date(r.slot || r), k = dayKey(d); byDay[k] = byDay[k] || {}; byDay[k][d.toISOString()] = d; });
      }
      loaded = true;
      var first = Object.keys(byDay).sort()[0]; if (first) { var y = first.split('-'); view = new Date(+y[0], +y[1] - 1, 1); }
    } catch (e) { loaded = true; draw(false); $('slot-hint').textContent = t('loadErr'); return; }
    month();
  }
  function month() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    $('cal-prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    $('cal-next').disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > new Date(today.getTime() + info.max_days_ahead * 864e5);
    draw(!loaded);
  }
  function draw(loading) {
    $('cal-month').textContent = new Intl.DateTimeFormat(EP.locale, { month: 'long', year: 'numeric' }).format(view);
    var html = '', base = new Date(2024, 8, 1);
    for (var i = 0; i < 7; i++) html += '<div class="cal__dow" aria-hidden="true">' + new Intl.DateTimeFormat(EP.locale, { weekday: 'short' }).format(new Date(base.getTime() + i * 864e5)).replace('.', '') + '</div>';
    for (var b = 0; b < view.getDay(); b++) html += '<span></span>';
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (var n = 1; n <= days; n++) {
      var d = new Date(view.getFullYear(), view.getMonth(), n), k = ymd(d), open = !loading && byDay[k] && Object.keys(byDay[k]).length, label = fmtLong(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
      html += open ? '<button type="button" class="cal__day cal__day--open" data-day="' + k + '" aria-pressed="' + (k === selectedDay) + '" aria-label="' + label + '">' + n + '</button>' : '<button type="button" class="cal__day" disabled aria-label="' + label + '">' + n + '</button>';
    }
    $('cal-grid').innerHTML = html;
    $('cal-grid').querySelectorAll('[data-day]').forEach(function (b2) { b2.onclick = function () { pickDay(b2.dataset.day); }; });
    if (loading) $('slot-hint').textContent = t('loading');
    else if (!selectedDay) $('slot-hint').textContent = Object.keys(byDay).length ? t('pickDayFirst') : t('noDays');
  }
  function pickDay(k) {
    selectedDay = k; selectedSlot = null; $('chosen').textContent = '';
    document.querySelectorAll('.cal__day--open').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.day === k)); });
    var list = Object.keys(byDay[k] || {}).sort().map(function (iso) { return byDay[k][iso]; }).filter(function (d) { return d > new Date(); });
    var y = k.split('-'); $('slot-hint').textContent = fmtLong(new Date(+y[0], +y[1] - 1, +y[2], 12));
    if (!list.length) { $('slots').innerHTML = ''; $('slot-hint').textContent = t('noSlots'); return; }
    var showEt = !sameTz();
    $('slots').innerHTML = list.map(function (d) { return '<button type="button" data-iso="' + d.toISOString() + '" aria-pressed="false">' + fmtTime(d) + (showEt ? ' <small style="display:block;font-weight:500;font-size:.75rem;opacity:.8">' + fmtTime(d, info.timezone) + ' ' + t('ET') + '</small>' : '') + '</button>'; }).join('');
    $('slots').querySelectorAll('button').forEach(function (b) {
      b.onclick = function () {
        $('slots').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        selectedSlot = new Date(b.dataset.iso); $('chosen').textContent = whenText(selectedSlot); $('slot-err').textContent = '';
      };
    });
  }
  $('cal-prev').onclick = function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); selectedDay = null; $('slots').innerHTML = ''; month(); };
  $('cal-next').onclick = function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); selectedDay = null; $('slots').innerHTML = ''; month(); };

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
    $('slot-err').textContent = selectedSlot ? '' : t('errSlot');
    var okBox = err('p-ok', $('p-ok').checked ? '' : t('errOk'));
    var bad = checks.filter(function (c) { return !c[1]; })[0];
    if (bad) return $(bad[0]).focus();
    if (!selectedSlot) return $('cal-grid').scrollIntoView({ block: 'center' });
    if (!okBox) return $('p-ok').focus();
    var btn = $('p-submit'), m = $('p-msg');
    btn.disabled = true; btn.textContent = t('sending'); m.className = 'portal-alert'; m.textContent = '';
    var mt = document.querySelector('input[name=mt]:checked').value;
    try {
      var r = await EP.fn('partner-invite', { action: 'signup', name: name, email: email, phone: phone.e164(), company: $('p-company').value.trim(), partner_type: $('p-type').value,
        country: $('p-country').value.trim(), language: $('p-lang').value, notes: $('p-notes').value.trim(), slot: selectedSlot.toISOString(), meeting_type: mt, timezone: userTz,
        consent: true, website: $('p-web').value, elapsed: Date.now() - t0, page_lang: EP.lang });
      done(r, email, mt);
    } catch (e) {
      var code = String(e.code || e.message || '');
      var key = ['slot_unavailable', 'already_registered', 'email_in_use', 'rate_limited', 'too_many_bookings'].filter(function (k) { return code.indexOf(k) > -1; })[0];
      m.className = 'portal-alert portal-alert--error'; m.textContent = t(key || 'generic');
      btn.disabled = false; btn.textContent = t('submit');
      if (key === 'slot_unavailable' && selectedDay) { delete (byDay[selectedDay] || {})[selectedSlot.toISOString()]; pickDay(selectedDay); }
    }
  });

  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function done(r, email, mt) {
    var start = new Date(r.starts_at || selectedSlot.toISOString()), end = new Date(r.ends_at || start.getTime() + info.slot_minutes * 6e4);
    $('pf').hidden = true; $('done').hidden = false;
    $('done-text').textContent = t('doneText').replace('{email}', email);
    $('done-when').textContent = whenText(start);
    $('ics').onclick = function () {
      var title = t('evTitle'), details = (mt === 'video' ? 'Video' : mt === 'phone' ? 'Phone' : 'WhatsApp') + ' · support@endeavorbiz.com · +1 (407) 436-9567';
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Endeavor Business Solutions//Partners//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', 'UID:' + start.getTime() + '-partner@endeavorbiz.com', 'DTSTAMP:' + icsDate(new Date()),
        'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end), 'SUMMARY:' + title, 'DESCRIPTION:' + details, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'endeavor-partner-onboarding.ics';
      document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 300);
    };
    $('done').focus();
  }

  (async function start() {
    try { var r = await EP.rpc('get_booking_info'); if (r && r[0]) info = r[0]; } catch (e) { /* defaults */ }
    loadAll();
    if (location.hash === '#cadastro') setTimeout(function () { $('cadastro').scrollIntoView(); }, 50);
  })();
})();
