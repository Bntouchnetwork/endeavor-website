/* Reschedule or cancel a call through the private link sent by e-mail and WhatsApp (booking.html?t=TOKEN). */
(function () {
  'use strict';
  var DICT = {
    en: { title: 'Your call with Endeavor', resched: 'Reschedule', cancel: 'Cancel the call', pickNew: 'Choose a new time', confirmNew: 'Confirm new time', back: 'Back',
      cancelTitle: 'Cancel this call?', reason: 'Reason (optional)', cancelYes: 'Yes, cancel the call', keep: 'Keep the call', bookAgain: 'Book another time', site: 'Back to site', loading: 'Loading…', video: 'Video call', phone: 'Phone call', whatsapp: 'WhatsApp call', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed', no_show: 'Missed',
      notFound: 'We could not find this booking. The link may be incomplete. Write to support@endeavorbiz.com and we will help.', past: 'This call has already happened or was cancelled, so it can no longer be changed.',
      tz: 'Times are shown in your time zone ({tz}).', noSlots: 'There are no open times right now. Write to support@endeavorbiz.com.', pickDay: 'Choose a day first.',
      reschedDone: 'Your call was rescheduled', reschedText: 'New time: {w}. We sent the updated confirmation to your email and WhatsApp.',
      cancelDone: 'Your call was cancelled', cancelText: 'We sent the confirmation to your email. You can book another time whenever it suits you.',
      slot_unavailable: 'Sorry, that time was just taken. Please choose another one.', too_many_changes: 'This call was already rescheduled several times. Please write to support@endeavorbiz.com.',
      not_changeable: 'This call can no longer be changed.', generic: 'Something went wrong. Please try again or write to support@endeavorbiz.com.', saving: 'Saving…', left: 'You can still reschedule {n} time(s).' },
    pt: { title: 'Sua conversa com a Endeavor', loading: 'Carregando…', resched: 'Reagendar', cancel: 'Cancelar a conversa', pickNew: 'Escolha o novo horário', confirmNew: 'Confirmar novo horário', back: 'Voltar',
      cancelTitle: 'Cancelar esta conversa?', reason: 'Motivo (opcional)', cancelYes: 'Sim, cancelar', keep: 'Manter a conversa', bookAgain: 'Agendar outro horário', site: 'Voltar ao site',
      video: 'Videochamada', phone: 'Ligação telefônica', whatsapp: 'Chamada por WhatsApp', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Concluída', no_show: 'Não compareceu',
      notFound: 'Não encontramos este agendamento. O link pode estar incompleto. Escreva para support@endeavorbiz.com que ajudamos.', past: 'Esta conversa já aconteceu ou foi cancelada, então não pode mais ser alterada.',
      tz: 'Horários no seu fuso ({tz}).', noSlots: 'No momento não há horários livres. Escreva para support@endeavorbiz.com.', pickDay: 'Escolha um dia primeiro.',
      reschedDone: 'Conversa remarcada', reschedText: 'Novo horário: {w}. Enviamos a confirmação atualizada para o seu e-mail e WhatsApp.',
      cancelDone: 'Conversa cancelada', cancelText: 'Enviamos a confirmação para o seu e-mail. Você pode agendar outro horário quando quiser.',
      slot_unavailable: 'Esse horário acabou de ser reservado. Escolha outro.', too_many_changes: 'Esta conversa já foi remarcada várias vezes. Escreva para support@endeavorbiz.com.',
      not_changeable: 'Esta conversa não pode mais ser alterada.', generic: 'Algo deu errado. Tente de novo ou escreva para support@endeavorbiz.com.', saving: 'Salvando…', left: 'Você ainda pode reagendar {n} vez(es).' },
    es: { title: 'Su llamada con Endeavor', loading: 'Cargando…', resched: 'Reprogramar', cancel: 'Cancelar la llamada', pickNew: 'Elija el nuevo horario', confirmNew: 'Confirmar nuevo horario', back: 'Volver',
      cancelTitle: '¿Cancelar esta llamada?', reason: 'Motivo (opcional)', cancelYes: 'Sí, cancelar', keep: 'Mantener la llamada', bookAgain: 'Agendar otro horario', site: 'Volver al sitio',
      video: 'Videollamada', phone: 'Llamada telefónica', whatsapp: 'Llamada por WhatsApp', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Realizada', no_show: 'No asistió',
      notFound: 'No encontramos esta cita. El enlace puede estar incompleto. Escriba a support@endeavorbiz.com y le ayudamos.', past: 'Esta llamada ya ocurrió o fue cancelada, así que ya no puede cambiarse.',
      tz: 'Horarios en su zona horaria ({tz}).', noSlots: 'En este momento no hay horarios libres. Escriba a support@endeavorbiz.com.', pickDay: 'Elija un día primero.',
      reschedDone: 'Llamada reprogramada', reschedText: 'Nuevo horario: {w}. Enviamos la confirmación actualizada a su correo y WhatsApp.',
      cancelDone: 'Llamada cancelada', cancelText: 'Enviamos la confirmación a su correo. Puede agendar otro horario cuando quiera.',
      slot_unavailable: 'Ese horario acaba de ser reservado. Elija otro.', too_many_changes: 'Esta llamada ya fue reprogramada varias veces. Escriba a support@endeavorbiz.com.',
      not_changeable: 'Esta llamada ya no puede cambiarse.', generic: 'Algo salió mal. Intente de nuevo o escriba a support@endeavorbiz.com.', saving: 'Guardando…', left: 'Todavía puede reprogramar {n} vez(ces).' }
  };
  var t = EP.init(DICT);
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search), token = q.get('t') || '';
  var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  var b = null, pick = null, byDay = {};
  function fmtDay(d) { return new Intl.DateTimeFormat(EP.locale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
  function fmtShort(d) { return new Intl.DateTimeFormat(EP.locale, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(d); }
  function fmtTime(d) { return new Intl.DateTimeFormat(EP.locale, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d); }
  function dayKey(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  function whenText(s, e) { return fmtDay(s) + ', ' + fmtTime(s) + ' – ' + fmtTime(e); }
  function err(e) { var c = String((e && (e.code || e.message)) || ''); var k = ['slot_unavailable', 'too_many_changes', 'not_changeable'].filter(function (x) { return c.indexOf(x) > -1; })[0]; return t(k || 'generic'); }
  function show(m, kind) { var el = $('m-msg'); el.className = 'portal-alert' + (m ? ' portal-alert--' + (kind || 'error') : ''); el.textContent = m || ''; }
  function done(title, text, rebook) {
    ['m-card', 'r-box', 'c-box'].forEach(function (id) { $(id).hidden = true; });
    $('done-title').textContent = title; $('done-text').textContent = text; $('done-book').hidden = !rebook; $('done').hidden = false; $('done').focus();
  }

  async function load() {
    if (!/^[0-9a-f-]{36}$/i.test(token)) { $('m-loading').hidden = true; return show(t('notFound')); }
    try { var r = await EP.rpc('get_booking_by_token', { p_token: token }); b = r && r[0]; } catch (e) { b = null; }
    $('m-loading').hidden = true;
    if (!b) return show(t('notFound'));
    var s = new Date(b.starts_at), e = new Date(b.ends_at);
    $('m-when').textContent = whenText(s, e);
    $('m-info').textContent = [t(b.meeting_type), b.topic, t('tz').replace('{tz}', tz.replace(/_/g, ' '))].filter(Boolean).join(' · ');
    $('m-status').innerHTML = '<span class="badge badge--' + (b.status === 'confirmed' ? 'client' : 'lost') + '">' + t(b.status) + '</span>';
    $('m-card').hidden = false;
    if (!b.can_change) { $('m-actions').hidden = true; show(t('past'), 'info'); return; }
    $('m-resched').hidden = b.changes_left < 1;
    if (q.get('a') === 'cancel') openCancel();
  }

  function openCancel() { $('r-box').hidden = true; $('c-box').hidden = false; $('c-reason').focus(); }
  $('m-cancel').onclick = openCancel;
  $('c-back').onclick = function () { $('c-box').hidden = true; };
  $('c-ok').onclick = async function () {
    var btn = this; btn.disabled = true; btn.textContent = t('saving'); show('');
    try { await EP.rpc('cancel_booking_by_token', { p_token: token, p_reason: $('c-reason').value.trim() || null }); done(t('cancelDone'), t('cancelText'), true); }
    catch (e) { btn.disabled = false; btn.textContent = t('cancelYes'); show(err(e)); }
  };

  $('m-resched').onclick = async function () {
    $('c-box').hidden = true; $('r-box').hidden = false; $('r-tz').textContent = t('tz').replace('{tz}', tz.replace(/_/g, ' ')) + (b.changes_left < 3 ? ' ' + t('left').replace('{n}', b.changes_left) : '');
    $('r-days').innerHTML = '<p class="portal-muted">' + t('loading') + '</p>'; $('r-slots').innerHTML = '';
    try {
      var info = (await EP.rpc('get_booking_info'))[0] || { max_days_ahead: 30 };
      var from = new Date(), to = new Date(Date.now() + (info.max_days_ahead || 30) * 864e5), ymd = function (d) { return d.toISOString().slice(0, 10); };
      var rows = await EP.rpc('get_available_slots', { p_from: ymd(from), p_to: ymd(to) });
      byDay = {};
      (rows || []).forEach(function (r) { var d = new Date(r.slot); if (d > new Date()) (byDay[dayKey(d)] = byDay[dayKey(d)] || []).push(d); });
      var days = Object.keys(byDay).sort();
      if (!days.length) { $('r-days').innerHTML = '<p class="portal-muted">' + t('noSlots') + '</p>'; return; }
      $('r-days').innerHTML = days.map(function (k) { return '<button type="button" data-day="' + k + '" aria-pressed="false">' + fmtShort(byDay[k][0]) + '</button>'; }).join('');
      $('r-days').querySelectorAll('button').forEach(function (x) { x.onclick = function () { selectDay(x.dataset.day); }; });
      selectDay(days[0]);
    } catch (e) { $('r-days').innerHTML = ''; show(t('generic')); }
  };
  function selectDay(k) {
    pick = null; $('r-ok').disabled = true;
    $('r-days').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.day === k)); });
    $('r-slots').innerHTML = byDay[k].sort(function (a, c) { return a - c; }).map(function (d) { return '<button type="button" data-iso="' + d.toISOString() + '" aria-pressed="false">' + fmtTime(d) + '</button>'; }).join('');
    $('r-slots').querySelectorAll('button').forEach(function (x) { x.onclick = function () { pick = x.dataset.iso; $('r-slots').querySelectorAll('button').forEach(function (y) { y.setAttribute('aria-pressed', String(y === x)); }); $('r-ok').disabled = false; }; });
  }
  $('r-back').onclick = function () { $('r-box').hidden = true; };
  $('r-ok').onclick = async function () {
    if (!pick) return show(t('pickDay'));
    var btn = this; btn.disabled = true; btn.textContent = t('saving'); show('');
    try {
      var r = await EP.rpc('reschedule_booking_by_token', { p_token: token, p_new_start: pick }); r = r && r[0];
      done(t('reschedDone'), t('reschedText').replace('{w}', whenText(new Date(r.starts_at), new Date(r.ends_at))), false);
    } catch (e) { btn.disabled = false; btn.textContent = t('confirmNew'); show(err(e)); if (/slot_unavailable/.test(String(e.code || e.message))) $('m-resched').onclick(); }
  };
  load();
})();
