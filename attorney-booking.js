/* Attorney consultations.
   - Partner Portal (attorney partners): "Minha agenda" — weekly availability, blocked dates, how the meeting happens, upcoming consultations.
   - Client Portal: "Advogados" — all active attorney partners; the client books, reschedules or cancels a free consultation
     (the platform does not charge; any fees are agreed directly with the attorney).
   E-mails to the client, the attorney and Endeavor are sent by the booking-notify function. */
(function () {
  'use strict';
  var T = {
    en: {
      c_title: 'Partner attorneys', c_lead: 'Book a free consultation through the platform with an Endeavor partner attorney.', fee: 'Booking through the platform is free. Any fees are agreed directly with the attorney.',
      c_mine: 'My consultations', c_none: 'No attorney is available for booking right now. Please check back soon or talk to us.', c_book: 'Book a consultation', c_with: 'Consultation with {a}',
      c_pickDay: 'Choose a day', c_pickTime: 'Choose a time', c_noSlots: 'No free times in the next 30 days.', c_format: 'Format', c_topic: 'Subject', c_notes: 'Anything the attorney should know (optional)', c_phone: 'Phone / WhatsApp (with country code)',
      c_confirm: 'Confirm booking', c_done: 'Booked! You will receive the confirmation by email.', c_resched: 'Reschedule', c_cancel: 'Cancel', c_cancelQ: 'Cancel this consultation?', c_reason: 'Reason (optional)', c_cancelOk: 'Cancel consultation', c_keep: 'Keep',
      c_cancelled: 'Consultation cancelled.', c_moved: 'Consultation rescheduled.', c_tz: 'Times shown in your time zone ({z}).', back: 'Back',
      video: 'Video call', phone: 'Phone call', whatsapp: 'WhatsApp call', e_slot: 'This time was just taken. Please choose another one.', e_many: 'You already have 2 upcoming consultations with this attorney.', e_phone: 'Enter the phone with the country code, e.g. +1 407 555 0100.', e_changes: 'This consultation was changed too many times. Please cancel and book again.',
      a_title: 'My calendar', a_lead: 'Set when clients of the Endeavor platform can book a consultation with you.', a_on: 'Receive bookings through the platform', a_practice: 'Practice areas', a_practiceP: 'e.g. Immigration, Business law, Real estate',
      a_bio: 'Short bio (shown to clients)', a_how: 'How the meeting happens', a_howP: 'e.g. Zoom link, phone or office address', a_len: 'Length of each consultation', a_tz: 'Time zone', a_week: 'Weekly availability', a_second: '2nd period',
      a_block: 'Days off', a_add: 'Add', a_save: 'Save calendar', a_saved: 'Calendar saved.', a_next: 'Upcoming consultations', a_noneNext: 'No consultations booked yet.', a_client: 'Client', a_cancelQ: 'Cancel this consultation? The client and Endeavor are notified by email.',
      a_min: 'min', days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], a_invalid: 'Check the times: the end must be after the start.', nav: 'My calendar', c_nav: 'Attorneys'
    },
    pt: {
      c_title: 'Advogados parceiros', c_lead: 'Agende pela plataforma uma consulta gratuita com um advogado parceiro da Endeavor.', fee: 'O agendamento pela plataforma não tem custo. Os honorários, se houver, são combinados diretamente com o advogado.',
      c_mine: 'Minhas consultas', c_none: 'Nenhum advogado está disponível para agendamento agora. Volte em breve ou fale com a gente.', c_book: 'Agendar consulta', c_with: 'Consulta com {a}',
      c_pickDay: 'Escolha o dia', c_pickTime: 'Escolha o horário', c_noSlots: 'Sem horários livres nos próximos 30 dias.', c_format: 'Formato', c_topic: 'Assunto', c_notes: 'O que o advogado deve saber (opcional)', c_phone: 'Telefone / WhatsApp (com o código do país)',
      c_confirm: 'Confirmar agendamento', c_done: 'Agendado! Você vai receber a confirmação por e-mail.', c_resched: 'Reagendar', c_cancel: 'Cancelar', c_cancelQ: 'Cancelar esta consulta?', c_reason: 'Motivo (opcional)', c_cancelOk: 'Cancelar consulta', c_keep: 'Manter',
      c_cancelled: 'Consulta cancelada.', c_moved: 'Consulta remarcada.', c_tz: 'Horários no seu fuso ({z}).', back: 'Voltar',
      video: 'Videochamada', phone: 'Ligação telefônica', whatsapp: 'Chamada por WhatsApp', e_slot: 'Esse horário acabou de ser ocupado. Escolha outro.', e_many: 'Você já tem 2 consultas marcadas com este advogado.', e_phone: 'Informe o telefone com o código do país, ex.: +55 11 99999-9999.', e_changes: 'Esta consulta já foi alterada muitas vezes. Cancele e agende de novo.',
      a_title: 'Minha agenda', a_lead: 'Defina quando os clientes da plataforma Endeavor podem agendar uma consulta com você.', a_on: 'Receber agendamentos pela plataforma', a_practice: 'Áreas de atuação', a_practiceP: 'Ex.: Imigração, Direito empresarial, Imobiliário',
      a_bio: 'Mini-bio (aparece para os clientes)', a_how: 'Como acontece a consulta', a_howP: 'Ex.: link do Zoom, telefone ou endereço do escritório', a_len: 'Duração de cada consulta', a_tz: 'Fuso horário', a_week: 'Disponibilidade semanal', a_second: '2º período',
      a_block: 'Dias bloqueados', a_add: 'Adicionar', a_save: 'Salvar agenda', a_saved: 'Agenda salva.', a_next: 'Próximas consultas', a_noneNext: 'Nenhuma consulta agendada ainda.', a_client: 'Cliente', a_cancelQ: 'Cancelar esta consulta? O cliente e a Endeavor recebem um aviso por e-mail.',
      a_min: 'min', days: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'], a_invalid: 'Confira os horários: o fim precisa ser depois do início.', nav: 'Minha agenda', c_nav: 'Advogados'
    },
    es: {
      c_title: 'Abogados socios', c_lead: 'Agende por la plataforma una consulta gratuita con un abogado socio de Endeavor.', fee: 'Agendar por la plataforma no tiene costo. Los honorarios, si los hay, se acuerdan directamente con el abogado.',
      c_mine: 'Mis consultas', c_none: 'Ningún abogado está disponible para agendar ahora. Vuelva pronto o escríbanos.', c_book: 'Agendar consulta', c_with: 'Consulta con {a}',
      c_pickDay: 'Elija el día', c_pickTime: 'Elija la hora', c_noSlots: 'Sin horarios libres en los próximos 30 días.', c_format: 'Formato', c_topic: 'Tema', c_notes: 'Lo que el abogado debe saber (opcional)', c_phone: 'Teléfono / WhatsApp (con código de país)',
      c_confirm: 'Confirmar cita', c_done: '¡Agendado! Recibirá la confirmación por correo.', c_resched: 'Reprogramar', c_cancel: 'Cancelar', c_cancelQ: '¿Cancelar esta consulta?', c_reason: 'Motivo (opcional)', c_cancelOk: 'Cancelar consulta', c_keep: 'Mantener',
      c_cancelled: 'Consulta cancelada.', c_moved: 'Consulta reprogramada.', c_tz: 'Horarios en su zona ({z}).', back: 'Volver',
      video: 'Videollamada', phone: 'Llamada telefónica', whatsapp: 'Llamada por WhatsApp', e_slot: 'Ese horario se acaba de ocupar. Elija otro.', e_many: 'Ya tiene 2 consultas agendadas con este abogado.', e_phone: 'Escriba el teléfono con el código de país, ej.: +595 981 000 000.', e_changes: 'Esta consulta ya se cambió muchas veces. Cancele y agende de nuevo.',
      a_title: 'Mi agenda', a_lead: 'Defina cuándo los clientes de la plataforma Endeavor pueden agendar una consulta con usted.', a_on: 'Recibir citas por la plataforma', a_practice: 'Áreas de práctica', a_practiceP: 'Ej.: Inmigración, Derecho empresarial, Inmobiliario',
      a_bio: 'Mini biografía (la ven los clientes)', a_how: 'Cómo será la consulta', a_howP: 'Ej.: enlace de Zoom, teléfono o dirección de la oficina', a_len: 'Duración de cada consulta', a_tz: 'Zona horaria', a_week: 'Disponibilidad semanal', a_second: '2º período',
      a_block: 'Días bloqueados', a_add: 'Agregar', a_save: 'Guardar agenda', a_saved: 'Agenda guardada.', a_next: 'Próximas consultas', a_noneNext: 'Aún no hay consultas agendadas.', a_client: 'Cliente', a_cancelQ: '¿Cancelar esta consulta? El cliente y Endeavor reciben un aviso por correo.',
      a_min: 'min', days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], a_invalid: 'Revise los horarios: el fin debe ser después del inicio.', nav: 'Mi agenda', c_nav: 'Abogados'
    }
  };
  var TZS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Sao_Paulo', 'America/Manaus', 'America/Asuncion', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Mexico_City', 'America/Santiago', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/London'];
  function tt(ctx) { var D = T[ctx.L] || T.en; return function (k, v) { var s = D[k] != null ? D[k] : (T.en[k] || k); if (v && typeof s === 'string') Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }; }
  function loc(ctx) { return ctx.L === 'pt' ? 'pt-BR' : ctx.L === 'es' ? 'es' : 'en-US'; }
  function errOf(ctx, t, e) { var m = (e && e.message) || ''; return /slot_unavailable/.test(m) ? t('e_slot') : /too_many_bookings/.test(m) ? t('e_many') : /invalid_phone/.test(m) ? t('e_phone') : /too_many_changes/.test(m) ? t('e_changes') : ctx.errText(e); }
  function initials(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function myTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch (e) { return 'America/New_York'; } }
  function cap(x) { x = String(x || ''); return x.charAt(0).toUpperCase() + x.slice(1); }
  function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------------- slot picker (shared by book and reschedule) ---------------- */
  async function slotPicker(ctx, t, box, attorneyId, onPick) {
    var esc = ctx.esc, from = new Date(), to = new Date(Date.now() + 30 * 864e5);
    box.innerHTML = '<p class="portal-muted">…</p>';
    var r = await ctx.sb.rpc('attorney_slots', { p_attorney: attorneyId, p_from: dayKey(from), p_to: dayKey(to) });
    if (r.error) { box.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">' + esc(ctx.errText(r.error)) + '</div>'; return; }
    var by = {}; (r.data || []).forEach(function (x) { var d = new Date(x.slot), k = dayKey(d); (by[k] = by[k] || []).push(d); });
    var keys = Object.keys(by).sort();
    if (!keys.length) { box.innerHTML = '<p class="empty">' + esc(t('c_noSlots')) + '</p>'; return; }
    var dfmt = new Intl.DateTimeFormat(loc(ctx), { weekday: 'short', day: 'numeric', month: 'short' }), hfmt = new Intl.DateTimeFormat(loc(ctx), { hour: 'numeric', minute: '2-digit' });
    box.innerHTML = '<p class="att-tz">' + esc(t('c_tz', { z: myTz() })) + '</p><p class="att-step">' + esc(t('c_pickDay')) + '</p><div class="att-days" role="listbox">' +
      keys.map(function (k, i) { return '<button type="button" class="att-day' + (i === 0 ? ' is-on' : '') + '" data-k="' + k + '" aria-selected="' + (i === 0) + '">' + esc(cap(dfmt.format(by[k][0]))) + '<small>' + by[k].length + '</small></button>'; }).join('') +
      '</div><p class="att-step">' + esc(t('c_pickTime')) + '</p><div class="att-times" id="att-times"></div>';
    function times(k) {
      box.querySelector('#att-times').innerHTML = by[k].map(function (d) { return '<button type="button" class="att-time" data-iso="' + d.toISOString() + '">' + esc(hfmt.format(d)) + '</button>'; }).join('');
      box.querySelectorAll('.att-time').forEach(function (b) { b.onclick = function () { box.querySelectorAll('.att-time').forEach(function (x) { x.classList.remove('is-on'); }); b.classList.add('is-on'); onPick(b.dataset.iso, b.textContent, cap(dfmt.format(new Date(b.dataset.iso)))); }; });
    }
    box.querySelectorAll('.att-day').forEach(function (b) { b.onclick = function () { box.querySelectorAll('.att-day').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', String(x === b)); }); times(b.dataset.k); onPick(null); }; });
    times(keys[0]);
  }

  /* ---------------- Client Portal ---------------- */
  async function clientView(view, ctx) {
    var t = tt(ctx), esc = ctx.esc, sb = ctx.sb, S = ctx.S;
    view.innerHTML = '<p class="portal-muted">…</p>';
    var res = await Promise.all([sb.rpc('attorney_list'), sb.from('bookings').select('id, starts_at, ends_at, status, meeting_type, topic, attorney_id').eq('client_id', S.client.id).not('attorney_id', 'is', null).eq('status', 'confirmed').gte('starts_at', new Date(Date.now() - 36e5).toISOString()).order('starts_at')]);
    var list = (res[0].data || []), mine = (res[1].data || []);
    var name = function (id) { var a = list.find(function (x) { return x.id === id; }); return a ? a.name : (ctx.L === 'pt' ? 'Advogado' : ctx.L === 'es' ? 'Abogado' : 'Attorney'); };
    var dt = new Intl.DateTimeFormat(loc(ctx), { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
    view.innerHTML = ctx.head(t('c_title'), t('c_lead')) + '<p class="att-fee">' + esc(t('fee')) + '</p>' +
      (mine.length ? '<section class="portal-card"><h2 class="portal-h2">' + esc(t('c_mine')) + '</h2><ul class="list">' + mine.map(function (b) {
        return '<li><div class="list__main"><strong>' + esc(t('c_with', { a: name(b.attorney_id) })) + '</strong><span>' + esc(cap(dt.format(new Date(b.starts_at)))) + ' · ' + esc(t(b.meeting_type)) + (b.topic ? ' · ' + esc(b.topic) : '') + '</span></div>' +
          '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" data-rs="' + b.id + '" data-a="' + b.attorney_id + '">' + esc(t('c_resched')) + '</button><button class="btn btn--ghost btn--xs" type="button" data-cx="' + b.id + '">' + esc(t('c_cancel')) + '</button></div></li>';
      }).join('') + '</ul></section>' : '') +
      (list.length ? '<div class="att-grid">' + list.map(function (a) {
        return '<article class="portal-card att-card"><div class="att-card__top"><span class="att-av" aria-hidden="true">' + esc(initials(a.name)) + '</span><div><h2 class="portal-h2">' + esc(a.name) + '</h2>' + (a.company ? '<p class="portal-muted">' + esc(a.company) + '</p>' : '') + '</div></div>' +
          (a.practice ? '<p class="att-practice">' + esc(a.practice) + '</p>' : '') + (a.bio ? '<p class="att-bio">' + esc(a.bio) + '</p>' : '') +
          '<button class="btn btn--navy btn--sm" type="button" data-book="' + a.id + '">' + esc(t('c_book')) + '</button></article>';
      }).join('') + '</div>' : '<div class="empty-state"><p class="empty">' + esc(t('c_none')) + '</p></div>');
    var reload = function () { clientView(view, ctx); };
    view.querySelectorAll('[data-book]').forEach(function (b) { b.onclick = function () { book(ctx, t, list.find(function (a) { return a.id === b.dataset.book; }), reload); }; });
    view.querySelectorAll('[data-rs]').forEach(function (b) { b.onclick = function () { resched(ctx, t, b.dataset.rs, b.dataset.a, name(b.dataset.a), reload); }; });
    view.querySelectorAll('[data-cx]').forEach(function (b) { b.onclick = function () { cancelModal(ctx, t, t('c_cancelQ'), function (reason) { return sb.rpc('client_cancel_attorney_booking', { p_booking: b.dataset.cx, p_reason: reason }); }, reload); }; });
  }
  function book(ctx, t, a, done) {
    var esc = ctx.esc, pick = null;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(t('c_with', { a: a.name })) + '</h2><button class="close-x" type="button" aria-label="' + esc(t('back')) + '">×</button></div>' +
      '<div id="att-pick"></div><form class="portal-form" id="att-f" novalidate hidden>' +
      '<p class="att-chosen" id="att-chosen"></p>' +
      '<fieldset class="field att-set"><legend>' + esc(t('c_format')) + '</legend><div class="att-fmt">' + ['video', 'phone', 'whatsapp'].map(function (m, i) { return '<label><input type="radio" name="fmt" value="' + m + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(t(m)) + '</label>'; }).join('') + '</div></fieldset>' +
      '<div class="field"><label for="att-topic">' + esc(t('c_topic')) + '</label><input id="att-topic" maxlength="100" required></div>' +
      '<div class="field"><label for="att-phone">' + esc(t('c_phone')) + '</label><input id="att-phone" type="tel" autocomplete="tel" maxlength="24" placeholder="+1 407 555 0100"></div>' +
      '<div class="field"><label for="att-notes">' + esc(t('c_notes')) + '</label><textarea id="att-notes" rows="3" maxlength="2000"></textarea></div>' +
      '<p class="att-fee">' + esc(t('fee')) + '</p><div class="portal-alert" id="att-m" role="alert"></div><button class="btn btn--navy" type="submit">' + esc(t('c_confirm')) + '</button></form>');
    var f = ctx.$('#att-f', o);
    slotPicker(ctx, t, ctx.$('#att-pick', o), a.id, function (iso, time, day) {
      pick = iso; f.hidden = !iso; if (iso) { ctx.$('#att-chosen', o).textContent = day + ' · ' + time; ctx.$('#att-topic', o).focus(); }
    });
    f.onsubmit = async function (e) {
      e.preventDefault(); var m = ctx.$('#att-m', o), btn = f.querySelector('button[type=submit]');
      var fmt = (f.querySelector('input[name=fmt]:checked') || {}).value || 'video', ph = ctx.$('#att-phone', o).value.trim(), phone = ph ? '+' + ph.replace(/\D/g, '').replace(/^00/, '') : '';
      if (!pick) return; if (ctx.$('#att-topic', o).value.trim().length < 2) { ctx.$('#att-topic', o).focus(); return; }
      if ((ph || fmt !== 'video') && !/^\+[1-9]\d{6,14}$/.test(phone)) { ctx.msg(m, t('e_phone'), 'error'); ctx.$('#att-phone', o).focus(); return; }
      btn.disabled = true;
      var r = await ctx.sb.rpc('client_book_attorney', { p_client: ctx.S.client.id, p_attorney: a.id, p_start: pick, p_meeting_type: fmt, p_topic: ctx.$('#att-topic', o).value.trim(), p_notes: ctx.$('#att-notes', o).value.trim(), p_timezone: myTz(), p_phone: phone || null });
      btn.disabled = false;
      if (r.error) { ctx.msg(m, errOf(ctx, t, r.error), 'error'); if (/slot_unavailable/.test(r.error.message)) slotPicker(ctx, t, ctx.$('#att-pick', o), a.id, function (iso, time, day) { pick = iso; f.hidden = !iso; if (iso) ctx.$('#att-chosen', o).textContent = day + ' · ' + time; }); return; }
      ctx.closeOverlay(); done(); setTimeout(function () { var v = document.querySelector('.console__head, h1'); if (v) { var p = document.createElement('div'); p.className = 'portal-alert portal-alert--ok'; p.style.display = 'block'; p.setAttribute('role', 'status'); p.textContent = t('c_done'); v.parentNode.insertBefore(p, v.nextSibling); } }, 400);
    };
  }
  function resched(ctx, t, id, attorneyId, name, done) {
    var esc = ctx.esc, pick = null;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(t('c_resched')) + ' · ' + esc(name) + '</h2><button class="close-x" type="button" aria-label="' + esc(t('back')) + '">×</button></div>' +
      '<div id="att-pick"></div><div class="portal-alert" id="att-m" role="alert"></div><button class="btn btn--navy" type="button" id="att-go" disabled>' + esc(t('c_resched')) + '</button>');
    slotPicker(ctx, t, ctx.$('#att-pick', o), attorneyId, function (iso) { pick = iso; ctx.$('#att-go', o).disabled = !iso; });
    ctx.$('#att-go', o).onclick = async function () {
      if (!pick) return; this.disabled = true;
      var r = await ctx.sb.rpc('client_reschedule_attorney_booking', { p_booking: id, p_new_start: pick });
      if (r.error) { this.disabled = false; return ctx.msg(ctx.$('#att-m', o), errOf(ctx, t, r.error), 'error'); }
      ctx.closeOverlay(); done();
    };
  }
  function cancelModal(ctx, t, question, run, done) {
    var esc = ctx.esc;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(question) + '</h2><button class="close-x" type="button" aria-label="' + esc(t('c_keep')) + '">×</button></div>' +
      '<div class="field"><label for="att-why">' + esc(t('c_reason')) + '</label><textarea id="att-why" rows="3" maxlength="500"></textarea></div><div class="portal-alert" id="att-m" role="alert"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--danger" type="button" id="att-ok">' + esc(t('c_cancelOk')) + '</button><button class="btn btn--ghost" type="button" id="att-no">' + esc(t('c_keep')) + '</button></div>', true);
    ctx.$('#att-no', o).onclick = function () { ctx.closeOverlay(); };
    ctx.$('#att-ok', o).onclick = async function () {
      this.disabled = true; var r = await run(ctx.$('#att-why', o).value.trim());
      if (r.error) { this.disabled = false; return ctx.msg(ctx.$('#att-m', o), errOf(ctx, t, r.error), 'error'); }
      ctx.closeOverlay(); done();
    };
  }

  /* ---------------- Partner Portal (attorney) ---------------- */
  async function partnerView(view, ctx) {
    var t = tt(ctx), esc = ctx.esc, sb = ctx.sb, P = ctx.S.partner;
    view.innerHTML = '<p class="portal-muted">…</p>';
    var res = await Promise.all([sb.from('attorney_availability').select('weekday, start_time, end_time').eq('partner_id', P.id).order('start_time'), sb.from('attorney_blackouts').select('day').eq('partner_id', P.id).order('day'),
      sb.from('bookings').select('id, starts_at, ends_at, name, email, phone, topic, notes, meeting_type, status').eq('attorney_id', P.id).eq('status', 'confirmed').gte('starts_at', new Date(Date.now() - 36e5).toISOString()).order('starts_at').limit(50)]);
    var rules = res[0].data || [], blocks = (res[1].data || []).map(function (x) { return x.day; }), next = res[2].data || [];
    var tz = P.attorney_timezone || 'America/New_York', tzs = TZS.indexOf(tz) > -1 ? TZS : [tz].concat(TZS);
    var hm = function (x) { return String(x || '').slice(0, 5); };
    var row = function (d) {
      var r = rules.filter(function (x) { return x.weekday === d; });
      return '<div class="att-wk" data-d="' + d + '"><div class="check-row att-wk__day"><input type="checkbox" class="att-wk__on" id="atc-d' + d + '"' + (r.length ? ' checked' : '') + '><label for="atc-d' + d + '">' + esc(t('days')[d]) + '</label></div>' +
        '<span class="att-wk__p"><input type="time" class="att-s1" value="' + hm(r[0] ? r[0].start_time : '09:00') + '" aria-label="' + esc(t('days')[d]) + ' 1"> – <input type="time" class="att-e1" value="' + hm(r[0] ? r[0].end_time : '12:00') + '" aria-label="' + esc(t('days')[d]) + ' 1"></span>' +
        '<span class="att-wk__p att-wk__p2"><input type="time" class="att-s2" value="' + hm(r[1] ? r[1].start_time : '') + '" aria-label="' + esc(t('days')[d] + ' · ' + t('a_second')) + '"> – <input type="time" class="att-e2" value="' + hm(r[1] ? r[1].end_time : '') + '" aria-label="' + esc(t('days')[d] + ' · ' + t('a_second')) + '"></span></div>';
    };
    var dt = new Intl.DateTimeFormat(loc(ctx), { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    view.innerHTML = ctx.head(t('a_title'), t('a_lead')) + '<div class="att-cols"><section class="portal-card"><form class="portal-form" id="atc-f" novalidate>' +
      '<div class="check-row"><input type="checkbox" id="atc-on"' + (P.attorney_bookable !== false ? ' checked' : '') + '><label for="atc-on">' + esc(t('a_on')) + '</label></div>' +
      '<div class="portal-grid2"><div class="field"><label for="atc-pr">' + esc(t('a_practice')) + '</label><input id="atc-pr" maxlength="200" placeholder="' + esc(t('a_practiceP')) + '" value="' + esc(P.attorney_practice || '') + '"></div>' +
      '<div class="field"><label for="atc-how">' + esc(t('a_how')) + '</label><input id="atc-how" maxlength="500" placeholder="' + esc(t('a_howP')) + '" value="' + esc(P.attorney_meeting_info || '') + '"></div></div>' +
      '<div class="field"><label for="atc-bio">' + esc(t('a_bio')) + '</label><textarea id="atc-bio" rows="2" maxlength="1200">' + esc(P.attorney_bio || '') + '</textarea></div>' +
      '<div class="portal-grid2"><div class="field"><label for="atc-len">' + esc(t('a_len')) + '</label><select id="atc-len">' + [15, 20, 30, 45, 60, 90].map(function (n) { return '<option value="' + n + '"' + ((P.attorney_slot_minutes || 30) === n ? ' selected' : '') + '>' + n + ' ' + esc(t('a_min')) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="atc-tz">' + esc(t('a_tz')) + '</label><select id="atc-tz">' + tzs.map(function (z) { return '<option' + (z === tz ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></div></div>' +
      '<fieldset class="field att-set"><legend>' + esc(t('a_week')) + '</legend><div class="att-week">' + [1, 2, 3, 4, 5, 6, 0].map(row).join('') + '</div></fieldset>' +
      '<fieldset class="field att-set"><legend>' + esc(t('a_block')) + '</legend><div class="att-blk"><input type="date" id="atc-day" min="' + dayKey(new Date()) + '"><button class="btn btn--ghost btn--xs" type="button" id="atc-add">' + esc(t('a_add')) + '</button></div><div class="att-chips" id="atc-chips"></div></fieldset>' +
      '<div class="portal-alert" id="atc-m" role="alert"></div><button class="btn btn--navy" type="submit">' + esc(t('a_save')) + '</button></form></section>' +
      '<section class="portal-card"><h2 class="portal-h2">' + esc(t('a_next')) + '</h2>' + (next.length ? '<ul class="list att-next">' + next.map(function (b) {
        return '<li><div class="list__main"><strong>' + esc(dt.format(new Date(b.starts_at))) + ' · ' + esc(t(b.meeting_type)) + '</strong><span>' + esc(t('a_client')) + ': ' + esc(b.name) + ' · ' + esc(b.email) + (b.phone ? ' · ' + esc(b.phone) : '') + '</span>' +
          (b.topic ? '<span>' + esc(b.topic) + '</span>' : '') + (b.notes ? '<span class="portal-muted">' + esc(b.notes) + '</span>' : '') + '</div><button class="btn btn--ghost btn--xs" type="button" data-cx="' + b.id + '">' + esc(t('c_cancel')) + '</button></li>';
      }).join('') + '</ul>' : '<p class="empty">' + esc(t('a_noneNext')) + '</p>') + '<p class="att-fee">' + esc(t('fee')) + '</p></section></div>';
    var chips = function () { ctx.$('#atc-chips').innerHTML = blocks.map(function (d, i) { return '<span class="att-chip">' + esc(new Intl.DateTimeFormat(loc(ctx), { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00Z'))) + '<button type="button" data-i="' + i + '" aria-label="×">×</button></span>'; }).join(''); ctx.$('#atc-chips').querySelectorAll('button').forEach(function (b) { b.onclick = function () { blocks.splice(+b.dataset.i, 1); chips(); }; }); };
    chips();
    ctx.$('#atc-add').onclick = function () { var v = ctx.$('#atc-day').value; if (v && blocks.indexOf(v) < 0) { blocks.push(v); blocks.sort(); chips(); } };
    ctx.$('#atc-f').onsubmit = async function (e) {
      e.preventDefault(); var m = ctx.$('#atc-m'), out = [], bad = false;
      view.querySelectorAll('.att-wk').forEach(function (w) {
        if (!w.querySelector('.att-wk__on').checked) return;
        [['.att-s1', '.att-e1'], ['.att-s2', '.att-e2']].forEach(function (p) { var s = w.querySelector(p[0]).value, en = w.querySelector(p[1]).value; if (!s && !en) return; if (!s || !en || en <= s) { bad = true; return; } out.push({ weekday: +w.dataset.d, start: s, end: en }); });
      });
      if (bad) return ctx.msg(m, t('a_invalid'), 'error');
      var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
      var r = await sb.rpc('attorney_save_calendar', { p_bookable: ctx.$('#atc-on').checked, p_practice: ctx.$('#atc-pr').value, p_bio: ctx.$('#atc-bio').value, p_meeting_info: ctx.$('#atc-how').value, p_slot: +ctx.$('#atc-len').value, p_timezone: ctx.$('#atc-tz').value, p_rules: out, p_blackouts: blocks });
      btn.disabled = false;
      if (r.error) return ctx.msg(m, ctx.errText(r.error), 'error');
      Object.assign(P, { attorney_bookable: ctx.$('#atc-on').checked, attorney_practice: ctx.$('#atc-pr').value.trim(), attorney_bio: ctx.$('#atc-bio').value.trim(), attorney_meeting_info: ctx.$('#atc-how').value.trim(), attorney_slot_minutes: +ctx.$('#atc-len').value, attorney_timezone: ctx.$('#atc-tz').value });
      ctx.msg(m, t('a_saved'), 'ok');
    };
    view.querySelectorAll('[data-cx]').forEach(function (b) { b.onclick = function () { cancelModal(ctx, t, t('a_cancelQ'), function (reason) { return sb.rpc('attorney_cancel_booking', { p_booking: b.dataset.cx, p_reason: reason }); }, function () { partnerView(view, ctx); }); }; });
  }

  window.EAttorney = { clientView: clientView, partnerView: partnerView, label: function (L, k) { return (T[L] || T.en)[k]; } };
})();
