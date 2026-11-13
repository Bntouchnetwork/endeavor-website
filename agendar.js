/* Public booking page of an Endeavor client (agendar.html?p=SLUG), and the private link to cancel (agendar.html?t=TOKEN).
   Free times come from the client's weekly hours (Agenda Online in the portal); the confirmation goes by e-mail. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG, app = document.getElementById('app');
  var D = {
    en: { loading: 'Loading…', skip: 'Skip to content', notFound: 'This booking page was not found or is not available.', min: '{n} min', video: 'Video call', phone: 'Phone call', in_person: 'In person',
      pickDay: 'Choose a day', pickTime: 'Choose a time', noSlots: 'No free times on this day.', noSlotsAll: 'There are no free times in the next weeks.', tz: 'Times in your time zone ({z}).',
      yourData: 'Your details', name: 'Full name', email: 'E-mail', phone_l: 'Phone / WhatsApp (optional)', notes: 'Anything you want to share before the meeting (optional)', confirm: 'Confirm booking', change: 'Change time',
      okTitle: 'Booking confirmed', okText: 'We sent the confirmation to {e}, with the details and a link to cancel if you need to.', bookAnother: 'Book another time',
      e_invalid_name: 'Enter your full name.', e_invalid_email: 'Enter a valid e-mail.', e_slot_unavailable: 'That time was just taken. Please choose another one.', e_too_many_attempts: 'Too many bookings in a short time. Please try again later.', e_generic: 'Something went wrong. Please try again.',
      apptTitle: 'Your booking', status_confirmed: 'Confirmed', status_cancelled: 'Cancelled', cancel: 'Cancel this booking', cancelQ: 'Cancel this booking?', cancelYes: 'Yes, cancel', keep: 'Keep it', cancelled: 'Your booking was cancelled. We sent the confirmation by e-mail.', e_not_changeable: 'This booking can no longer be changed.', powered: 'Scheduling by Endeavor Business Solutions' },
    pt: { loading: 'Carregando…', skip: 'Pular para o conteúdo', notFound: 'Esta página de agendamento não foi encontrada ou não está disponível.', min: '{n} min', video: 'Videochamada', phone: 'Ligação telefônica', in_person: 'Presencial',
      pickDay: 'Escolha o dia', pickTime: 'Escolha o horário', noSlots: 'Sem horários livres neste dia.', noSlotsAll: 'Não há horários livres nas próximas semanas.', tz: 'Horários no seu fuso ({z}).',
      yourData: 'Seus dados', name: 'Nome completo', email: 'E-mail', phone_l: 'Telefone / WhatsApp (opcional)', notes: 'Algo que queira contar antes do encontro (opcional)', confirm: 'Confirmar agendamento', change: 'Trocar horário',
      okTitle: 'Agendamento confirmado', okText: 'Enviamos a confirmação para {e}, com os detalhes e um link para cancelar se precisar.', bookAnother: 'Marcar outro horário',
      e_invalid_name: 'Informe o seu nome completo.', e_invalid_email: 'Informe um e-mail válido.', e_slot_unavailable: 'Esse horário acabou de ser reservado. Escolha outro.', e_too_many_attempts: 'Muitos agendamentos em pouco tempo. Tente mais tarde.', e_generic: 'Algo deu errado. Tente de novo.',
      apptTitle: 'Seu agendamento', status_confirmed: 'Confirmado', status_cancelled: 'Cancelado', cancel: 'Cancelar este agendamento', cancelQ: 'Cancelar este agendamento?', cancelYes: 'Sim, cancelar', keep: 'Manter', cancelled: 'O seu agendamento foi cancelado. Enviamos a confirmação por e-mail.', e_not_changeable: 'Este agendamento não pode mais ser alterado.', powered: 'Agenda pela Endeavor Business Solutions' },
    es: { loading: 'Cargando…', skip: 'Saltar al contenido', notFound: 'Esta página de citas no fue encontrada o no está disponible.', min: '{n} min', video: 'Videollamada', phone: 'Llamada telefónica', in_person: 'Presencial',
      pickDay: 'Elija el día', pickTime: 'Elija el horario', noSlots: 'Sin horarios libres este día.', noSlotsAll: 'No hay horarios libres en las próximas semanas.', tz: 'Horarios en su zona ({z}).',
      yourData: 'Sus datos', name: 'Nombre completo', email: 'Correo', phone_l: 'Teléfono / WhatsApp (opcional)', notes: 'Algo que quiera contar antes de la reunión (opcional)', confirm: 'Confirmar cita', change: 'Cambiar horario',
      okTitle: 'Cita confirmada', okText: 'Enviamos la confirmación a {e}, con los detalles y un enlace para cancelar si lo necesita.', bookAnother: 'Reservar otro horario',
      e_invalid_name: 'Escriba su nombre completo.', e_invalid_email: 'Escriba un correo válido.', e_slot_unavailable: 'Ese horario acaba de ser reservado. Elija otro.', e_too_many_attempts: 'Demasiadas citas en poco tiempo. Intente más tarde.', e_generic: 'Algo salió mal. Intente de nuevo.',
      apptTitle: 'Su cita', status_confirmed: 'Confirmada', status_cancelled: 'Cancelada', cancel: 'Cancelar esta cita', cancelQ: '¿Cancelar esta cita?', cancelYes: 'Sí, cancelar', keep: 'Mantener', cancelled: 'Su cita fue cancelada. Enviamos la confirmación por correo.', e_not_changeable: 'Esta cita ya no se puede cambiar.', powered: 'Agenda por Endeavor Business Solutions' }
  };
  var qs = new URLSearchParams(location.search);
  var L = (function () { var l = qs.get('lang'); if (D[l]) return l; return /^pt/i.test(navigator.language) ? 'pt' : /^es/i.test(navigator.language) ? 'es' : 'en'; })();
  var LOC = { en: 'en-US', pt: 'pt-BR', es: 'es' }[L];
  var TZ = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch (e) { return 'America/New_York'; } })();
  function t(k, v) { var s = D[L][k] != null ? D[L][k] : D.en[k]; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  document.documentElement.lang = L === 'pt' ? 'pt-BR' : L;
  document.querySelectorAll('[data-t]').forEach(function (e) { e.textContent = t(e.getAttribute('data-t')); });
  document.querySelectorAll('.lang-mini a').forEach(function (a) { var u = new URL(location.href); u.searchParams.set('lang', a.getAttribute('data-lang')); a.href = u.pathname.split('/').pop() + u.search; if (a.getAttribute('data-lang') === L) a.setAttribute('aria-current', 'true'); });
  document.getElementById('home-link').href = 'index.html?lang=' + L;

  async function api(body) {
    var r = await fetch(CFG.functionsUrl + '/tools', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify(Object.assign({ lang: L }, body)) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'generic'); e.code = j.error || 'generic'; throw e; }
    return j;
  }
  function errMsg(e) { var k = 'e_' + (e && e.code); return (D[L][k] || D.en[k]) ? t(k) : t('e_generic'); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtTime(iso) { return new Intl.DateTimeFormat(LOC, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  function fmtFull(iso, tz) { var o = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }; try { if (tz) o.timeZone = tz; return new Intl.DateTimeFormat(LOC, o).format(new Date(iso)); } catch (e) { delete o.timeZone; return new Intl.DateTimeFormat(LOC, o).format(new Date(iso)); } }
  function side(pg) {
    return '<aside class="portal-card"><p class="eyebrow">' + esc(pg.business || '') + '</p><h1>' + esc(pg.title) + '</h1>' + (pg.description ? '<p class="portal-muted" style="white-space:pre-line">' + esc(pg.description) + '</p>' : '') +
      '<div class="bk__meta"><span>⏱ ' + t('min', { n: pg.duration_min }) + '</span><span>' + (pg.location_kind === 'video' ? '🎥 ' : pg.location_kind === 'phone' ? '📞 ' : '📍 ') + t(pg.location_kind) + '</span></div>' +
      '<p class="portal-muted" style="font-size:.78rem;margin-top:1.5rem">' + t('powered') + '</p></aside>';
  }

  async function bookPage(slug) {
    var pg;
    try { pg = await api({ action: 'agenda_page', slug: slug }); } catch (e) { app.innerHTML = '<div class="portal-card">' + t('notFound') + '</div>'; return; }
    document.title = pg.title + ' · ' + pg.business;
    var today = new Date(), to = new Date(today.getTime() + Math.min(pg.max_days_ahead || 45, 60) * 864e5);
    var r = await api({ action: 'agenda_slots', slug: slug, from: ymd(new Date(today.getTime() - 864e5)), to: ymd(to) }).catch(function () { return { slots: [] }; });
    var byDay = {};
    (r.slots || []).forEach(function (s) { var k = ymd(new Date(s)); (byDay[k] = byDay[k] || []).push(s); });
    var days = Object.keys(byDay).sort();
    app.innerHTML = '<div class="bk">' + side(pg) + '<section class="portal-card" id="pick"></section></div>';
    var pick = document.getElementById('pick'), chosenDay = days[0], chosen = null;
    function render() {
      if (!days.length) { pick.innerHTML = '<p>' + t('noSlotsAll') + '</p>'; return; }
      pick.innerHTML = '<h2 class="portal-h2">' + t('pickDay') + '</h2><div class="days" role="group" aria-label="' + t('pickDay') + '">' + days.map(function (d) {
          var dt = new Date(d + 'T12:00:00');
          return '<button type="button" class="day" data-d="' + d + '" aria-pressed="' + (d === chosenDay) + '"><small>' + new Intl.DateTimeFormat(LOC, { weekday: 'short' }).format(dt) + '</small><strong>' + dt.getDate() + '</strong><small>' + new Intl.DateTimeFormat(LOC, { month: 'short' }).format(dt) + '</small></button>';
        }).join('') + '</div>' +
        '<h2 class="portal-h2">' + t('pickTime') + '</h2><p class="portal-muted" style="font-size:.85rem">' + esc(t('tz', { z: TZ })) + '</p><div class="slots" role="group" aria-label="' + t('pickTime') + '">' +
        (byDay[chosenDay] || []).map(function (s) { return '<button type="button" class="slot" data-s="' + s + '" aria-pressed="' + (s === chosen) + '">' + fmtTime(s) + '</button>'; }).join('') + '</div>' +
        (chosen ? '<form class="portal-form" id="bf" novalidate><h2 class="portal-h2">' + t('yourData') + ' · ' + esc(fmtFull(chosen)) + '</h2>' +
          '<div class="field"><label for="f-n">' + t('name') + '</label><input id="f-n" autocomplete="name" required maxlength="120"></div>' +
          '<div class="field"><label for="f-e">' + t('email') + '</label><input id="f-e" type="email" autocomplete="email" required maxlength="254"></div>' +
          '<div class="field"><label for="f-p">' + t('phone_l') + '</label><input id="f-p" type="tel" autocomplete="tel" maxlength="40"></div>' +
          '<div class="field"><label for="f-x">' + t('notes') + '</label><textarea id="f-x" rows="3" maxlength="1000"></textarea></div>' +
          '<div class="hp" aria-hidden="true"><label for="f-w">Website</label><input id="f-w" tabindex="-1" autocomplete="off"></div>' +
          '<div class="portal-alert" id="f-m" role="alert"></div><button class="btn btn--gold btn--block" type="submit">' + t('confirm') + '</button></form>' : '');
      pick.querySelectorAll('.day').forEach(function (b) { b.onclick = function () { chosenDay = b.dataset.d; chosen = null; render(); }; });
      pick.querySelectorAll('.slot').forEach(function (b) { b.onclick = function () { chosen = b.dataset.s; render(); var n = document.getElementById('f-n'); if (n) n.focus(); }; });
      var bf = document.getElementById('bf');
      if (bf) bf.onsubmit = async function (e) {
        e.preventDefault();
        var m = document.getElementById('f-m'), name = document.getElementById('f-n').value.trim(), email = document.getElementById('f-e').value.trim();
        function show(x) { m.textContent = x; m.className = 'portal-alert portal-alert--error'; }
        if (name.length < 2) return show(t('e_invalid_name'));
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return show(t('e_invalid_email'));
        var btn = bf.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = t('loading');
        try {
          var res = await api({ action: 'agenda_book', slug: slug, start: chosen, name: name, email: email, phone: document.getElementById('f-p').value.trim(), notes: document.getElementById('f-x').value.trim(), tz: TZ, website: document.getElementById('f-w').value });
          pick.innerHTML = '<div style="text-align:center;padding:1rem 0"><div style="font-size:2.2rem;color:var(--success)" aria-hidden="true">✓</div><h2 class="portal-h1" tabindex="-1" id="ok-h">' + t('okTitle') + '</h2><p><strong>' + esc(fmtFull(res.start_at || chosen)) + '</strong></p><p>' + esc(t('okText', { e: email })) + '</p>' +
            '<a class="btn btn--ghost" href="agendar.html?p=' + encodeURIComponent(slug) + '&lang=' + L + '">' + t('bookAnother') + '</a></div>';
          document.getElementById('ok-h').focus();
        } catch (err) {
          btn.disabled = false; btn.textContent = t('confirm'); show(errMsg(err));
          if (err.code === 'slot_unavailable') { byDay[chosenDay] = (byDay[chosenDay] || []).filter(function (s) { return s !== chosen; }); chosen = null; setTimeout(render, 1800); }
        }
      };
    }
    render();
  }

  async function tokenPage(tok) {
    var a;
    try { a = await api({ action: 'agenda_get', token: tok }); } catch (e) { app.innerHTML = '<div class="portal-card">' + t('notFound') + '</div>'; return; }
    var future = new Date(a.start_at) > new Date();
    app.innerHTML = '<div class="bk">' + side({ business: a.business, title: a.title, duration_min: Math.round((new Date(a.end_at) - new Date(a.start_at)) / 6e4), location_kind: a.location_kind }) +
      '<section class="portal-card" id="ap"><h2 class="portal-h2">' + t('apptTitle') + '</h2><p><strong>' + esc(fmtFull(a.start_at)) + '</strong></p><p><span class="pill">' + t('status_' + a.status) + '</span></p>' +
      (a.status === 'confirmed' && future ? '<button class="btn btn--ghost" type="button" id="c1">' + t('cancel') + '</button>' : '') +
      '<div class="portal-alert" id="am" role="status"></div><p style="margin-top:1rem"><a href="agendar.html?p=' + encodeURIComponent(a.slug) + '&lang=' + L + '">' + t('bookAnother') + '</a></p></section></div>';
    var c1 = document.getElementById('c1');
    if (c1) c1.onclick = function () {
      c1.outerHTML = '<p><strong>' + t('cancelQ') + '</strong></p><div class="portal-btn-row"><button class="btn btn--navy" type="button" id="cy">' + t('cancelYes') + '</button><button class="btn btn--ghost" type="button" id="cn">' + t('keep') + '</button></div>';
      document.getElementById('cn').onclick = function () { tokenPage(tok); };
      document.getElementById('cy').onclick = async function () {
        this.disabled = true;
        var m = document.getElementById('am');
        try { await api({ action: 'agenda_cancel', token: tok }); m.textContent = t('cancelled'); m.className = 'portal-alert portal-alert--ok'; document.querySelector('#ap .portal-btn-row').remove(); }
        catch (e) { m.textContent = errMsg(e); m.className = 'portal-alert portal-alert--error'; }
      };
    };
  }

  var tok = qs.get('t'), slug = qs.get('p');
  if (tok) tokenPage(tok); else if (slug) bookPage(slug); else app.innerHTML = '<div class="portal-card">' + t('notFound') + '</div>';
})();
