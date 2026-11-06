/* Public scheduling page: availability calendar + booking (Supabase RPCs). */
(function () {
  'use strict';
  var DICT = {
    en: { tzNote: 'Times are shown in your time zone ({tz}). Our office is in Orlando, Florida (Eastern Time).', noSlots: 'No times left on this day. Please choose another day.',
      loading: 'Loading available times…', loadErr: 'We could not load the calendar. Please try again or write to support@endeavorbiz.com.',
      errName: 'Enter your full name.', errEmail: 'Enter a valid email address.', sending: 'Booking…',
      slot_unavailable: 'Sorry, that time was just taken. Please choose another time.', too_many_bookings: 'You already have two upcoming calls booked. Reply to your confirmation to change them.',
      invalid_email: 'Enter a valid email address.', invalid_name: 'Enter your full name.', generic: 'Something went wrong. Please try again or write to support@endeavorbiz.com.',
      evTitle: 'Call with Endeavor Business Solutions', pickDayFirst: 'Select an available day on the calendar.', noDays: 'There are no open times right now. Please write to support@endeavorbiz.com or message us on WhatsApp.', ET: 'ET', video: 'Video call', phoneCall: 'Phone', confirm: 'Confirm booking',
      errPhone: 'Enter your WhatsApp number with the area code.', invalid_phone: 'Enter your WhatsApp number with the area code.', cc: 'Country code',
      doneText2: 'We sent the confirmation to your email and WhatsApp, with links to reschedule or cancel. You will also get reminders before the call.' },
    pt: { docTitle: 'Agendar uma chamada | Endeavor Business Solutions', skip: 'Pular para o conteúdo', title: 'Agende uma chamada',
      lead: 'Escolha o dia e o horário para uma conversa inicial gratuita. Uma consulta não cria relação de cliente.',
      pickDay: '1. Escolha o dia', pickTime: '2. Escolha o horário', pickDayFirst: 'Selecione um dia disponível no calendário.', yourDetails: '3. Seus dados',
      prevMonth: 'Mês anterior', nextMonth: 'Próximo mês', name: 'Nome completo', email: 'E-mail', phone: 'Telefone / WhatsApp', topic: 'Assunto',
      o1: 'Abertura de empresa', o2: 'Compliance', o3: 'Coordenação fiscal', o4: 'Brasil para os EUA', o5: 'Operações no Paraguai', o6: 'Financiamento empresarial', o7: 'Imóveis', o8: 'Family Office', o9: 'Outro',
      meetType: 'Como prefere conversar?', video: 'Videochamada', phoneCall: 'Telefone', notes: 'Algo que devemos saber antes da chamada?',
      noSensitive: 'Não informe SSN, ITIN, passaporte ou números de conta bancária.', confirm: 'Confirmar agendamento',
      privacy: 'Ao agendar, você concorda que usemos seus dados para contatá-lo sobre esta chamada, conforme a nossa', pp: 'Política de Privacidade',
      doneTitle: 'Agendamento confirmado', doneText: 'Enviamos uma confirmação para o seu e-mail. Entraremos em contato pelo meio que você escolheu. Para remarcar, responda à confirmação ou escreva para support@endeavorbiz.com.',
      addCal: 'Adicionar ao calendário (.ics)', gcal: 'Google Agenda', back: 'Voltar ao site',
      tzNote: 'Horários exibidos no seu fuso ({tz}). Nosso escritório fica em Orlando, Flórida (horário do Leste dos EUA).', noSlots: 'Não há mais horários neste dia. Escolha outro dia.',
      loading: 'Carregando horários…', loadErr: 'Não conseguimos carregar o calendário. Tente de novo ou escreva para support@endeavorbiz.com.',
      errName: 'Informe seu nome completo.', errEmail: 'Informe um e-mail válido.', sending: 'Agendando…',
      slot_unavailable: 'Esse horário acabou de ser reservado. Escolha outro horário.', too_many_bookings: 'Você já tem duas chamadas agendadas. Responda à confirmação para alterá-las.',
      invalid_email: 'Informe um e-mail válido.', invalid_name: 'Informe seu nome completo.', generic: 'Algo deu errado. Tente de novo ou escreva para support@endeavorbiz.com.',
      evTitle: 'Chamada com a Endeavor Business Solutions', noDays: 'No momento não há horários abertos. Escreva para support@endeavorbiz.com ou fale conosco pelo WhatsApp.', ET: 'horário de Orlando',
      waNote: 'Vamos enviar a confirmação e os lembretes desta chamada para este WhatsApp e para o seu e-mail.', errPhone: 'Informe o seu WhatsApp com o DDD.', invalid_phone: 'Informe o seu WhatsApp com o DDD.', cc: 'Código do país',
      doneText2: 'Enviamos a confirmação para o seu e-mail e WhatsApp, com os links para reagendar ou cancelar. Você também vai receber lembretes antes da chamada.' },
    es: { docTitle: 'Agendar una llamada | Endeavor Business Solutions', skip: 'Saltar al contenido', title: 'Agende una llamada',
      lead: 'Elija el día y la hora para una conversación inicial gratuita. Una consulta no crea una relación de cliente.',
      pickDay: '1. Elija el día', pickTime: '2. Elija la hora', pickDayFirst: 'Seleccione un día disponible en el calendario.', yourDetails: '3. Sus datos',
      prevMonth: 'Mes anterior', nextMonth: 'Mes siguiente', name: 'Nombre completo', email: 'Correo electrónico', phone: 'Teléfono / WhatsApp', topic: 'Tema',
      o1: 'Constitución de empresas', o2: 'Cumplimiento', o3: 'Coordinación fiscal', o4: 'Brasil a EE. UU.', o5: 'Operaciones en Paraguay', o6: 'Financiamiento empresarial', o7: 'Bienes raíces', o8: 'Family Office', o9: 'Otro',
      meetType: '¿Cómo prefiere reunirse?', video: 'Videollamada', phoneCall: 'Teléfono', notes: '¿Algo que debamos saber antes de la llamada?',
      noSensitive: 'No incluya SSN, ITIN, pasaporte ni números de cuenta bancaria.', confirm: 'Confirmar cita',
      privacy: 'Al agendar, acepta que usemos sus datos para contactarlo sobre esta llamada, según nuestra', pp: 'Política de Privacidad',
      doneTitle: 'Cita confirmada', doneText: 'Enviamos una confirmación a su correo. Nos comunicaremos por el medio que eligió. Para reprogramar, responda a la confirmación o escriba a support@endeavorbiz.com.',
      addCal: 'Agregar al calendario (.ics)', gcal: 'Google Calendar', back: 'Volver al sitio',
      tzNote: 'Horarios mostrados en su zona horaria ({tz}). Nuestra oficina está en Orlando, Florida (hora del Este de EE. UU.).', noSlots: 'No quedan horarios este día. Elija otro día.',
      loading: 'Cargando horarios…', loadErr: 'No pudimos cargar el calendario. Intente de nuevo o escriba a support@endeavorbiz.com.',
      errName: 'Ingrese su nombre completo.', errEmail: 'Ingrese un correo válido.', sending: 'Agendando…',
      slot_unavailable: 'Ese horario acaba de ser reservado. Elija otro horario.', too_many_bookings: 'Ya tiene dos llamadas agendadas. Responda a la confirmación para cambiarlas.',
      invalid_email: 'Ingrese un correo válido.', invalid_name: 'Ingrese su nombre completo.', generic: 'Algo salió mal. Intente de nuevo o escriba a support@endeavorbiz.com.',
      evTitle: 'Llamada con Endeavor Business Solutions', noDays: 'En este momento no hay horarios disponibles. Escriba a support@endeavorbiz.com o contáctenos por WhatsApp.', ET: 'hora de Orlando',
      waNote: 'Enviaremos la confirmación y los recordatorios de esta llamada a este WhatsApp y a su correo.', errPhone: 'Ingrese su WhatsApp con el código de área.', invalid_phone: 'Ingrese su WhatsApp con el código de área.', cc: 'Código de país',
      doneText2: 'Enviamos la confirmación a su correo y WhatsApp, con enlaces para reprogramar o cancelar. También recibirá recordatorios antes de la llamada.' }
  };
  var t = EP.init(DICT);
  var userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  var info = { timezone: 'America/New_York', slot_minutes: 30, max_days_ahead: 30, meeting_note: '' };
  var byDay = {}, selectedDay = null, selectedSlot = null, view = new Date(); view.setDate(1);
  var $ = function (id) { return document.getElementById(id); };

  function dayKey(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtTime(d, tz) { return new Intl.DateTimeFormat(EP.locale, { timeZone: tz || userTz, hour: 'numeric', minute: '2-digit' }).format(d); }
  function fmtLong(d) { return new Intl.DateTimeFormat(EP.locale, { timeZone: userTz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
  var sameTz = function () { return fmtTime(new Date(), userTz) === fmtTime(new Date(), info.timezone); };

  var phone = EPhone.mount($('b-phone-box'), { id: 'b-phone', lang: EP.lang, ccLabel: t('cc'), onchange: function () { if (phone && phone.valid()) fieldErr('b-phone', ''); } });
  $('tz-note').textContent = t('tzNote').replace('{tz}', userTz.replace(/_/g, ' '));

  var loaded = false;
  async function loadAll() {
    // Load the whole booking window once (in chunks of up to 60 days), then navigate months locally.
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = new Date(today.getTime() + (info.max_days_ahead + 1) * 864e5);
    drawCalendar(true);
    try {
      for (var from = new Date(today.getTime() - 864e5); from < end; from = new Date(from.getTime() + 60 * 864e5)) {
        var to = new Date(Math.min(from.getTime() + 59 * 864e5, end.getTime()));
        var rows = await EP.rpc('get_available_slots', { p_from: ymd(from), p_to: ymd(to) });
        (rows || []).forEach(function (r) {
          var d = new Date(r.slot || r), k = dayKey(d);
          byDay[k] = byDay[k] || {}; byDay[k][d.toISOString()] = d;
        });
      }
      loaded = true;
      var firstDay = Object.keys(byDay).sort()[0];
      if (firstDay) { var y = firstDay.split('-'); view = new Date(+y[0], +y[1] - 1, 1); }
    } catch (e) { $('slot-hint').textContent = t('loadErr'); loaded = true; drawCalendar(false); $('slot-hint').textContent = t('loadErr'); return; }
    loadMonth();
  }
  function loadMonth() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var last = new Date(today.getTime() + info.max_days_ahead * 864e5);
    $('cal-prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    $('cal-next').disabled = new Date(view.getFullYear(), view.getMonth() + 1, 1) > last;
    drawCalendar(!loaded);
  }

  function drawCalendar(loading) {
    $('cal-month').textContent = new Intl.DateTimeFormat(EP.locale, { month: 'long', year: 'numeric' }).format(view);
    var g = $('cal-grid'), html = '';
    var base = new Date(2024, 8, 1); // a Sunday
    for (var i = 0; i < 7; i++) html += '<div class="cal__dow" aria-hidden="true">' + new Intl.DateTimeFormat(EP.locale, { weekday: 'short' }).format(new Date(base.getTime() + i * 864e5)).replace('.', '') + '</div>';
    var first = view.getDay(), days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (var b = 0; b < first; b++) html += '<span></span>';
    for (var dnum = 1; dnum <= days; dnum++) {
      var d = new Date(view.getFullYear(), view.getMonth(), dnum), k = ymd(d);
      var open = !loading && byDay[k] && Object.keys(byDay[k]).length;
      var label = fmtLong(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
      html += open ? '<button type="button" class="cal__day cal__day--open" data-day="' + k + '" aria-pressed="' + (k === selectedDay) + '" aria-label="' + label + '">' + dnum + '</button>'
        : '<button type="button" class="cal__day" disabled aria-label="' + label + '">' + dnum + '</button>';
    }
    g.innerHTML = html;
    g.querySelectorAll('[data-day]').forEach(function (btn) { btn.onclick = function () { selectDay(btn.dataset.day); }; });
    if (loading) $('slot-hint').textContent = t('loading');
    else if (!selectedDay && !Object.keys(byDay).length) $('slot-hint').textContent = t('noDays');
    else if (!selectedDay) $('slot-hint').textContent = t('pickDayFirst');
  }

  function selectDay(k) {
    selectedDay = k; selectedSlot = null; $('book-form').hidden = true;
    document.querySelectorAll('.cal__day--open').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.day === k)); });
    var list = Object.keys(byDay[k] || {}).sort().map(function (iso) { return byDay[k][iso]; }).filter(function (d) { return d > new Date(); });
    var y = k.split('-');
    $('slot-hint').textContent = fmtLong(new Date(+y[0], +y[1] - 1, +y[2], 12));
    if (!list.length) { $('slots').innerHTML = ''; $('slot-hint').textContent = t('noSlots'); return; }
    var showEt = !sameTz();
    $('slots').innerHTML = list.map(function (d) {
      var et = showEt ? ' <small style="display:block;font-weight:500;font-size:.75rem;opacity:.8">' + fmtTime(d, info.timezone) + ' ' + t('ET') + '</small>' : '';
      return '<button type="button" data-iso="' + d.toISOString() + '" aria-pressed="false">' + fmtTime(d) + et + '</button>';
    }).join('');
    $('slots').querySelectorAll('button').forEach(function (b) { b.onclick = function () { selectSlot(b); }; });
    $('slots').querySelector('button').focus();
  }

  function whenText(start) {
    var end = new Date(start.getTime() + info.slot_minutes * 6e4);
    var s = fmtLong(start) + ', ' + fmtTime(start) + ' – ' + fmtTime(end);
    if (!sameTz()) s += ' (' + fmtTime(start, info.timezone) + ' ' + t('ET') + ')';
    return s;
  }
  function selectSlot(btn) {
    $('slots').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    selectedSlot = new Date(btn.dataset.iso);
    $('chosen').textContent = whenText(selectedSlot);
    $('book-form').hidden = false; $('b-name').focus();
  }

  $('cal-prev').onclick = function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); selectedDay = null; $('slots').innerHTML = ''; $('book-form').hidden = true; loadMonth(); };
  $('cal-next').onclick = function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); selectedDay = null; $('slots').innerHTML = ''; $('book-form').hidden = true; loadMonth(); };

  function fieldErr(id, text) {
    var i = $(id), e = $(id + '-err');
    e.textContent = text || ''; i.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (text) i.setAttribute('aria-describedby', id + '-err'); return !text;
  }

  $('book-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var name = $('b-name').value.trim(), email = $('b-email').value.trim();
    var okName = fieldErr('b-name', name.length < 2 ? t('errName') : ''), okMail = fieldErr('b-email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : t('errEmail'));
    var okPhone = fieldErr('b-phone', phone.valid() ? '' : t('errPhone'));
    if (!(okName && okMail && okPhone)) { (!okName ? $('b-name') : !okMail ? $('b-email') : $('b-phone')).focus(); return; }
    var wa = phone.e164();
    var mt = document.querySelector('input[name=mt]:checked').value;
    var topicSel = $('b-topic'), topic = topicSel.value;
    var btn = $('b-submit'), m = $('b-msg');
    btn.disabled = true; btn.textContent = t('sending'); m.className = 'portal-alert'; m.textContent = '';
    try {
      var res = await EP.rpc('book_slot_v2', { p_starts_at: selectedSlot.toISOString(), p_name: name, p_email: email, p_phone: wa,
        p_topic: topic, p_notes: $('b-notes').value.trim() || null, p_meeting_type: mt, p_language: EP.lang, p_timezone: userTz });
      var row = Array.isArray(res) ? res[0] : res;
      var start = new Date(row.starts_at), end = new Date(row.ends_at);
      // the server sends the confirmation (e-mail + WhatsApp) once its e-mail is configured; until then the old confirmation is used
      var server = false; try { server = !!(await EP.rpc('booking_server_email')); } catch (e2) { server = false; }
      if (server) $('done-text').textContent = t('doneText2');
      else EP.notify({
        _subject: 'New call booked: ' + name + ' – ' + new Intl.DateTimeFormat('en-US', { timeZone: info.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(start) + ' ET',
        _replyto: email, email: email, name: name, phone: wa, topic: topic, meeting_type: mt, language: EP.lang,
        when_eastern: new Intl.DateTimeFormat('en-US', { timeZone: info.timezone, dateStyle: 'full', timeStyle: 'short' }).format(start),
        when_client: whenText(start) + ' [' + userTz + ']', notes: $('b-notes').value.trim(),
        _autoresponse: t('doneTitle') + ' – ' + whenText(start) + '. ' + t('doneText')
      });
      showDone(start, end, mt, topicSel.options[topicSel.selectedIndex].text);
    } catch (e) {
      var code = String(e.code || e.message || '');
      var key = ['slot_unavailable', 'too_many_bookings', 'invalid_email', 'invalid_name', 'invalid_phone'].filter(function (k) { return code.indexOf(k) > -1; })[0];
      m.className = 'portal-alert portal-alert--error'; m.textContent = t(key || 'generic');
      btn.disabled = false; btn.textContent = t('confirm');
      if (key === 'slot_unavailable') { delete (byDay[selectedDay] || {})[selectedSlot.toISOString()]; selectDay(selectedDay); }
    }
  });

  function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function showDone(start, end, mt, topicLabel) {
    $('booking').hidden = true; $('done').hidden = false;
    $('done-when').textContent = whenText(start);
    $('done-note').textContent = info.meeting_note || '';
    var title = t('evTitle'), details = topicLabel + ' · ' + (mt === 'video' ? t('video') : mt === 'phone' ? t('phoneCall') : 'WhatsApp') + '\nsupport@endeavorbiz.com · +1 (407) 436-9567';
    $('gcal').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + icsDate(start) + '/' + icsDate(end) + '&details=' + encodeURIComponent(details);
    $('ics').onclick = function () {
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Endeavor Business Solutions//Scheduling//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        'UID:' + start.getTime() + '-' + Math.random().toString(36).slice(2) + '@endeavorbiz.com', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end),
        'SUMMARY:' + title, 'DESCRIPTION:' + details.replace(/\n/g, '\\n'), 'ORGANIZER;CN=Endeavor Business Solutions:mailto:support@endeavorbiz.com',
        'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'endeavor-call.ics';
      document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 300);
    };
    $('done').focus();
  }

  (async function start() {
    try { var r = await EP.rpc('get_booking_info'); if (r && r[0]) info = r[0]; } catch (e) { /* defaults */ }
    loadAll();
  })();
})();
