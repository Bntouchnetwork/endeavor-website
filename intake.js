/* Opening documents (secure link from the e-mail, no login).
   The client gives three company name options, the members and their percentages, and per member uploads
   the passport, proof of address and US visa (if any). Files can be replaced or deleted; each item is
   marked done. Anchors #names #members #passport #address #visa come from the e-mail buttons. */
(function () {
  'use strict';
  var t = EP.init({
    en: {},
    pt: { docTitle: 'Documentos de abertura | Endeavor Business Solutions', loading: 'Carregando…', skip: 'Pular para o conteúdo' },
    es: { docTitle: 'Documentos de constitución | Endeavor Business Solutions', loading: 'Cargando…', skip: 'Saltar al contenido' }
  });
  var L = EP.lang;
  var D = {
    en: { eyebrow: 'Company formation', title: 'Information and documents to open your company', hi: 'Hello, {n}. Fill in each item below. Everything is saved as you go, and you can come back to this link later.',
      sNames: 'Three name options for the company', sNamesLead: 'In order of preference. We check availability in the state and use the first one available.', opt: 'Option {n}',
      sMembers: 'Members and ownership', sMembersLead: 'Full name as in the passport and the percentage of each member. The total must be 100%.', mName: 'Full name', mPct: '%', add: 'Add member', remove: 'Remove', sum: 'Total: {p}%', sumBad: 'Total: {p}% — it must add up to 100%.',
      save: 'Save', saved: 'Saved.', sDocs: 'Documents for each member', sDocsLead: 'PDF or photo (JPG, PNG, HEIC), up to 15 MB each. Visa only if the member has one.', docsFirst: 'Save the members first to send their documents.',
      passport: 'Passport', address: 'Proof of address', visa: 'US visa (if any)', send: 'Send file', replace: 'Replace', del: 'Delete', delQ: 'Delete this file?', uploading: 'Sending…', optional: 'optional',
      progress: 'Your progress', pNames: 'Company names', pMembers: 'Members and percentages', pDocs: 'Passport and proof of address of each member',
      complete: 'All set! Endeavor received everything and will start the formation. You can still replace a file if needed.',
      secure: 'This page is private to you. The files go straight to your encrypted folder at Endeavor and appear in your client portal under "Opening documents". We never ask for document numbers by e-mail or WhatsApp.',
      notFound: 'Link not found or expired', notFoundText: 'Write to support@endeavorbiz.com and we will send you a new link.', err: 'Something went wrong. Try again.', errType: 'Use a PDF, JPG, PNG or HEIC file.', errSize: 'The file is larger than 15 MB.' },
    pt: { eyebrow: 'Abertura da empresa', title: 'Informações e documentos para abrir a sua empresa', hi: 'Olá, {n}. Preencha cada item abaixo. Tudo é salvo conforme você avança e você pode voltar a este link depois.',
      sNames: 'Três opções de nome para a empresa', sNamesLead: 'Em ordem de preferência. Verificamos a disponibilidade no estado e usamos a primeira disponível.', opt: 'Opção {n}',
      sMembers: 'Sócios e participação', sMembersLead: 'Nome completo como no passaporte e o percentual de cada sócio. O total precisa dar 100%.', mName: 'Nome completo', mPct: '%', add: 'Adicionar sócio', remove: 'Remover', sum: 'Total: {p}%', sumBad: 'Total: {p}% — precisa somar 100%.',
      save: 'Salvar', saved: 'Salvo.', sDocs: 'Documentos de cada sócio', sDocsLead: 'PDF ou foto (JPG, PNG, HEIC), até 15 MB cada. Visto só se o sócio tiver.', docsFirst: 'Salve os sócios primeiro para enviar os documentos deles.',
      passport: 'Passaporte', address: 'Comprovante de endereço', visa: 'Visto americano (se tiver)', send: 'Enviar arquivo', replace: 'Substituir', del: 'Excluir', delQ: 'Excluir este arquivo?', uploading: 'Enviando…', optional: 'opcional',
      progress: 'O seu progresso', pNames: 'Nomes da empresa', pMembers: 'Sócios e percentuais', pDocs: 'Passaporte e comprovante de endereço de cada sócio',
      complete: 'Tudo certo! A Endeavor recebeu tudo e vai iniciar a abertura. Você ainda pode substituir um arquivo se precisar.',
      secure: 'Esta página é só sua. Os arquivos vão direto para a sua pasta criptografada na Endeavor e aparecem no portal do cliente em "Documentos de abertura". Nunca pedimos números de documentos por e-mail ou WhatsApp.',
      notFound: 'Link não encontrado ou expirado', notFoundText: 'Escreva para support@endeavorbiz.com que enviamos um novo link.', err: 'Algo deu errado. Tente de novo.', errType: 'Use um arquivo PDF, JPG, PNG ou HEIC.', errSize: 'O arquivo tem mais de 15 MB.' },
    es: { eyebrow: 'Constitución de la empresa', title: 'Información y documentos para abrir su empresa', hi: 'Hola, {n}. Complete cada ítem abajo. Todo se guarda a medida que avanza y puede volver a este enlace después.',
      sNames: 'Tres opciones de nombre para la empresa', sNamesLead: 'En orden de preferencia. Verificamos la disponibilidad en el estado y usamos la primera disponible.', opt: 'Opción {n}',
      sMembers: 'Socios y participación', sMembersLead: 'Nombre completo como en el pasaporte y el porcentaje de cada socio. El total debe ser 100%.', mName: 'Nombre completo', mPct: '%', add: 'Agregar socio', remove: 'Quitar', sum: 'Total: {p}%', sumBad: 'Total: {p}% — debe sumar 100%.',
      save: 'Guardar', saved: 'Guardado.', sDocs: 'Documentos de cada socio', sDocsLead: 'PDF o foto (JPG, PNG, HEIC), hasta 15 MB cada uno. Visa solo si el socio la tiene.', docsFirst: 'Guarde los socios primero para enviar sus documentos.',
      passport: 'Pasaporte', address: 'Comprobante de domicilio', visa: 'Visa estadounidense (si tiene)', send: 'Enviar archivo', replace: 'Reemplazar', del: 'Eliminar', delQ: '¿Eliminar este archivo?', uploading: 'Enviando…', optional: 'opcional',
      progress: 'Su progreso', pNames: 'Nombres de la empresa', pMembers: 'Socios y porcentajes', pDocs: 'Pasaporte y comprobante de domicilio de cada socio',
      complete: '¡Todo listo! Endeavor recibió todo y comenzará la constitución. Aún puede reemplazar un archivo si lo necesita.',
      secure: 'Esta página es solo suya. Los archivos van directo a su carpeta cifrada en Endeavor y aparecen en el portal del cliente en "Documentos de constitución". Nunca pedimos números de documentos por correo o WhatsApp.',
      notFound: 'Enlace no encontrado o vencido', notFoundText: 'Escriba a support@endeavorbiz.com y le enviaremos un nuevo enlace.', err: 'Algo salió mal. Intente de nuevo.', errType: 'Use un archivo PDF, JPG, PNG o HEIC.', errSize: 'El archivo supera los 15 MB.' }
  };
  function T(k, v) { var s = (D[L] || D.en)[k] || D.en[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); }); return s; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var token = new URLSearchParams(location.search).get('t') || window.DEMO_INTAKE_TOKEN || '';
  var state = $('#state'), flow = $('#flow'), S = null, draft = null;
  var MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  var call = function (action, extra) { return EP.fn('intake', Object.assign({ action: action, token: token }, extra || {})); };
  var rid = function () { return Math.random().toString(36).slice(2, 12).padEnd(10, '0'); };
  var size = function (b) { return b ? (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB') : ''; };
  var dot = function (ok) { return '<span class="ik-dot' + (ok ? ' is-ok' : '') + '" aria-hidden="true"></span>'; };

  function apply(r) { if (r.answers) S.answers = r.answers; if (r.progress) S.progress = r.progress; if (r.files) S.files = r.files; if (r.status) S.status = r.status; else if (r.progress && r.progress.complete) S.status = 'complete'; }
  function render() {
    var a = S.answers || {}, names = (a.names || []).concat(['', '', '']).slice(0, 3);
    draft = (a.members && a.members.length ? a.members : [{ id: rid(), name: '', pct: 100 }]).map(function (m) { return { id: m.id, name: m.name, pct: m.pct }; });
    flow.innerHTML =
      '<div class="prop-hero"><p class="prop-eyebrow">' + esc(T('eyebrow')) + '</p><h1 class="portal-h1">' + esc(T('title')) + '</h1><p class="prop-intro">' + esc(T('hi', { n: S.client_name })) + '</p></div>' +
      '<section class="portal-card" id="prog" aria-live="polite"></section>' +
      '<section class="portal-card ik-sec" id="names"><h2 class="portal-h2">1. ' + esc(T('sNames')) + '</h2><p class="portal-muted">' + esc(T('sNamesLead')) + '</p><form class="portal-form" id="f-names" novalidate>' +
        names.map(function (n, i) { return '<div class="field"><label for="nm' + i + '">' + esc(T('opt', { n: i + 1 })) + '</label><input id="nm' + i + '" maxlength="120" value="' + esc(n) + '" autocomplete="off"></div>'; }).join('') +
        '<div class="portal-alert" id="m-names" role="status"></div><button class="btn btn--navy" type="submit">' + esc(T('save')) + '</button></form></section>' +
      '<section class="portal-card ik-sec" id="members"><h2 class="portal-h2">2. ' + esc(T('sMembers')) + '</h2><p class="portal-muted">' + esc(T('sMembersLead')) + '</p><form class="portal-form" id="f-mem" novalidate><div id="mem-list"></div><p class="ik-sum" id="mem-sum"></p>' +
        '<div class="portal-btn-row"><button class="btn btn--ghost" type="button" id="mem-add">+ ' + esc(T('add')) + '</button><button class="btn btn--navy" type="submit">' + esc(T('save')) + '</button></div><div class="portal-alert" id="m-mem" role="status"></div></form></section>' +
      '<section class="portal-card ik-sec" id="docs"><span id="passport"></span><span id="address"></span><span id="visa"></span><h2 class="portal-h2">3. ' + esc(T('sDocs')) + '</h2><p class="portal-muted">' + esc(T('sDocsLead')) + '</p><div id="docs-list"></div></section>' +
      '<p class="ik-note">🔒 ' + esc(T('secure')) + '</p>';
    $('#f-names').onsubmit = function (e) { e.preventDefault(); save($('#m-names'), this); };
    $('#f-mem').onsubmit = function (e) { e.preventDefault(); readMembers(); var p = pctSum(); if (Math.abs(p - 100) > 0.01 || draft.some(function (m) { return m.name.trim().length < 3; })) { msg($('#m-mem'), T('sumBad', { p: fmtP(p) }), true); return; } save($('#m-mem'), this); };
    $('#mem-add').onclick = function () { readMembers(); draft.push({ id: rid(), name: '', pct: 0 }); members(); var i = $$('#mem-list input[data-k=name]').pop(); if (i) i.focus(); };
    members(); docs(); prog();
    if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(function () { (el.closest('section') || el).scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
  }
  function fmtP(p) { return String(Math.round(p * 100) / 100); }
  function pctSum() { return draft.reduce(function (s, m) { return s + (Number(m.pct) || 0); }, 0); }
  function readMembers() { $$('#mem-list .ik-member').forEach(function (row, i) { draft[i].name = $('[data-k=name]', row).value; draft[i].pct = Number(String($('[data-k=pct]', row).value).replace(',', '.')) || 0; }); }
  function members() {
    $('#mem-list').innerHTML = draft.map(function (m, i) {
      return '<div class="ik-member"><div class="field"><label for="mn' + i + '">' + esc(T('mName')) + ' ' + (i + 1) + '</label><input id="mn' + i + '" data-k="name" maxlength="160" value="' + esc(m.name) + '" autocomplete="off"></div>' +
        '<div class="field"><label for="mp' + i + '">' + esc(T('mPct')) + '</label><input id="mp' + i + '" data-k="pct" inputmode="decimal" value="' + esc(m.pct) + '"></div>' +
        (draft.length > 1 ? '<button class="btn btn--ghost btn--danger-text" type="button" data-rm="' + i + '" aria-label="' + esc(T('remove')) + ' ' + esc(m.name || (i + 1)) + '">' + esc(T('remove')) + '</button>' : '<span></span>') + '</div>';
    }).join('');
    $$('#mem-list [data-rm]').forEach(function (b) { b.onclick = function () { readMembers(); draft.splice(Number(b.dataset.rm), 1); members(); }; });
    $$('#mem-list input').forEach(function (i) { i.oninput = function () { readMembers(); sum(); }; });
    sum();
  }
  function sum() { var p = pctSum(), ok = Math.abs(p - 100) < 0.01, el = $('#mem-sum'); el.textContent = ok ? T('sum', { p: fmtP(p) }) : T('sumBad', { p: fmtP(p) }); el.classList.toggle('is-bad', !ok); }
  function msg(el, text, bad) { el.className = 'portal-alert ' + (bad ? 'portal-alert--error' : 'portal-alert--ok'); el.textContent = text; }
  async function save(out, form) {
    readMembers();
    var b = form.querySelector('button[type=submit]'); b.disabled = true;
    try {
      var r = await call('save', { names: [0, 1, 2].map(function (i) { return $('#nm' + i).value; }), members: draft });
      apply(r); draft = S.answers.members.map(function (m) { return { id: m.id, name: m.name, pct: m.pct }; });
      msg(out, T('saved')); members(); docs(); prog();
    } catch (e) { msg(out, T('err'), true); }
    b.disabled = false;
  }
  function docs() {
    var saved = (S.answers && S.answers.members) || [];
    var box = $('#docs-list');
    if (!saved.length) { box.innerHTML = '<p class="portal-alert portal-alert--info" style="display:block">' + esc(T('docsFirst')) + '</p>'; return; }
    box.innerHTML = saved.map(function (m) {
      return '<div class="ik-docs"><h3>' + esc(m.name) + '</h3>' + ['passport', 'address', 'visa'].map(function (k) {
        var f = (S.files || []).find(function (x) { return x.member === m.id && x.kind === k; });
        return '<div class="ik-row"><div class="ik-row__l">' + dot(!!f) + '<div><strong>' + esc(T(k)) + '</strong>' + (k === 'visa' ? ' <span class="portal-muted">(' + esc(T('optional')) + ')</span>' : '') +
          (f ? '<div class="ik-row__f">' + esc(f.name) + (f.size ? ' · ' + esc(size(f.size)) : '') + '</div>' : '') + '</div></div>' +
          '<div class="portal-btn-row"><label class="btn ' + (f ? 'btn--ghost' : 'btn--navy') + '" tabindex="0" role="button">' + esc(f ? T('replace') : T('send')) +
          '<input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*" data-m="' + esc(m.id) + '" data-k="' + k + '"></label>' +
          (f ? '<button class="btn btn--ghost btn--danger-text" type="button" data-del="' + esc(f.id) + '">' + esc(T('del')) + '</button>' : '') + '</div></div>';
      }).join('') + '<div class="portal-alert" role="status" data-out="' + esc(m.id) + '"></div></div>';
    }).join('');
    $$('#docs-list label[role=button]').forEach(function (l) { l.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('input', l).click(); } }; });
    $$('#docs-list input[type=file]').forEach(function (inp) { inp.onchange = function () { if (inp.files[0]) upload(inp.dataset.m, inp.dataset.k, inp.files[0], inp); }; });
    $$('#docs-list [data-del]').forEach(function (b) { b.onclick = async function () { if (!confirm(T('delQ'))) return; b.disabled = true; try { apply(await call('delete', { id: b.dataset.del })); docs(); prog(); } catch (e) { b.disabled = false; } }; });
  }
  async function upload(member, kind, file, inp) {
    var out = $('[data-out="' + member + '"]'), mime = (file.type || '').toLowerCase();
    if (!mime && /\.heic$/i.test(file.name)) mime = 'image/heic';
    if (MIMES.indexOf(mime) < 0) return msg(out, T('errType'), true);
    if (file.size > 15 * 1048576) return msg(out, T('errSize'), true);
    out.className = 'portal-alert portal-alert--info'; out.textContent = T('uploading'); inp.disabled = true;
    try {
      var u = await call('upload_url', { member: member, kind: kind, mime: mime, size: file.size });
      if (u.url !== 'demo') { var r = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: file }); if (!r.ok) throw new Error('upload'); }
      apply(await call('confirm', { member: member, kind: kind, path: u.path, mime: mime, size: file.size, name: file.name }));
      docs(); prog();
    } catch (e) { msg(out, T('err'), true); inp.disabled = false; }
  }
  function prog() {
    var p = S.progress || {};
    $('#prog').innerHTML = '<h2 class="portal-h2">' + esc(T('progress')) + '</h2>' + (p.complete ? '<div class="portal-alert portal-alert--ok" style="display:block">' + esc(T('complete')) + '</div>' : '') +
      '<ol class="ik-steps"><li>' + dot(p.names) + '<a href="#names">' + esc(T('pNames')) + '</a></li><li>' + dot(p.members) + '<a href="#members">' + esc(T('pMembers')) + '</a></li><li>' + dot(p.docs) + '<a href="#docs">' + esc(T('pDocs')) + '</a></li></ol>';
  }

  (async function () {
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) { state.innerHTML = '<h1 class="portal-h2">' + esc(T('notFound')) + '</h1><p>' + esc(T('notFoundText')) + '</p>'; return; }
    try { S = await call('get'); state.hidden = true; flow.hidden = false; render(); }
    catch (e) { state.innerHTML = '<h1 class="portal-h2">' + esc(T('notFound')) + '</h1><p>' + esc(T('notFoundText')) + '</p>'; }
  })();
})();
