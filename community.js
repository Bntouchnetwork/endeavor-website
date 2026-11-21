/* Comunidade (página pública): diretório de empresas e profissionais que ligaram a opção no portal e foram aprovados.
   Página fixa no computador (cards em páginas com flechas); no celular, rolagem normal.
   O e-mail do dono do perfil nunca aparece: o contato é por formulário. Avaliar exige estar logado no portal. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG, C = window.ECommunity, esc = C.esc;
  var T = EP.init({
    en: { docTitle: 'Community | Endeavor Business Hub', skip: 'Skip to content', title: 'Community', lead: 'Companies and professionals that are part of the Endeavor community. Find a partner for your business and get in touch.', search: 'Search', searchPh: 'Search by name, area or city', all: 'All', companies: 'Companies', professionals: 'Professionals',
      total: '{n} profiles', total1: '1 profile', none: 'No profiles yet', noneText: 'The first companies and professionals will appear here soon.', noMatch: 'No profile matches your search', noMatchText: 'Try another word or clear the filter.', off: 'The Community is not available right now.',
      foot: 'Profiles are created by the companies themselves and reviewed by Endeavor before they appear. Endeavor does not endorse or guarantee the services listed.', prev: 'Previous page', next: 'Next page', pages: 'Pages', close: 'Close', about: 'About',
      tabReviews: 'Reviews', tabContact: 'Contact', contact: 'Contact', c_name: 'Your name', c_email: 'Your e-mail', c_msg: 'Message', c_send: 'Send message', c_hint: 'Your message goes by e-mail to {n}. They answer directly to your e-mail.', c_ok: 'Message sent. {n} will answer to your e-mail.', c_bad: 'Fill in your name, a valid e-mail and a message of at least 10 characters.', c_rate: 'Too many messages. Try again later.', c_err: 'We could not send the message. Try again in a few minutes.',
      noReviewsYet: 'No reviews yet.', rate: 'Write a review', r_login: 'To write a review, sign in to your Endeavor portal first.', r_signin: 'Sign in', r_rating: 'Your rating', r_comment: 'Comment (optional)', r_send: 'Send review', r_ok: 'Thank you. Your review appears after Endeavor approves it.', r_own: 'You cannot review your own profile.', r_dup: 'You already reviewed this profile.', r_pick: 'Choose a rating from 1 to 5.', r_err: 'We could not send the review. Try again.', reply: 'Answer from {n}', notFound: 'This profile is not available.' },
    pt: { docTitle: 'Comunidade | Endeavor Business Hub', skip: 'Pular para o conteúdo', title: 'Comunidade', lead: 'Empresas e profissionais que fazem parte da comunidade Endeavor. Encontre um parceiro para o seu negócio e entre em contato.', search: 'Buscar', searchPh: 'Buscar por nome, área ou cidade', all: 'Todos', companies: 'Empresas', professionals: 'Profissionais',
      total: '{n} perfis', total1: '1 perfil', none: 'Ainda não há perfis', noneText: 'As primeiras empresas e profissionais aparecem aqui em breve.', noMatch: 'Nenhum perfil encontrado', noMatchText: 'Tente outra palavra ou limpe o filtro.', off: 'A Comunidade não está disponível no momento.',
      foot: 'Os perfis são criados pelas próprias empresas e revisados pela Endeavor antes de aparecer. A Endeavor não endossa nem garante os serviços listados.', prev: 'Página anterior', next: 'Próxima página', pages: 'Páginas', close: 'Fechar', about: 'Sobre',
      tabReviews: 'Avaliações', tabContact: 'Contato', contact: 'Contatar', c_name: 'Seu nome', c_email: 'Seu e-mail', c_msg: 'Mensagem', c_send: 'Enviar mensagem', c_hint: 'A sua mensagem vai por e-mail para {n}. A resposta chega direto no seu e-mail.', c_ok: 'Mensagem enviada. {n} responde no seu e-mail.', c_bad: 'Preencha o seu nome, um e-mail válido e uma mensagem de pelo menos 10 caracteres.', c_rate: 'Muitas mensagens. Tente de novo mais tarde.', c_err: 'Não foi possível enviar a mensagem. Tente de novo em alguns minutos.',
      noReviewsYet: 'Ainda sem avaliações.', rate: 'Avaliar', r_login: 'Para avaliar, entre primeiro no seu portal da Endeavor.', r_signin: 'Entrar', r_rating: 'Sua nota', r_comment: 'Comentário (opcional)', r_send: 'Enviar avaliação', r_ok: 'Obrigado. A sua avaliação aparece depois que a Endeavor aprovar.', r_own: 'Você não pode avaliar o seu próprio perfil.', r_dup: 'Você já avaliou este perfil.', r_pick: 'Escolha uma nota de 1 a 5.', r_err: 'Não foi possível enviar a avaliação. Tente de novo.', reply: 'Resposta de {n}', notFound: 'Este perfil não está disponível.' },
    es: { docTitle: 'Comunidad | Endeavor Business Hub', skip: 'Ir al contenido', title: 'Comunidad', lead: 'Empresas y profesionales que forman parte de la comunidad Endeavor. Encuentre un aliado para su negocio y póngase en contacto.', search: 'Buscar', searchPh: 'Buscar por nombre, área o ciudad', all: 'Todos', companies: 'Empresas', professionals: 'Profesionales',
      total: '{n} perfiles', total1: '1 perfil', none: 'Aún no hay perfiles', noneText: 'Las primeras empresas y profesionales aparecerán aquí pronto.', noMatch: 'Ningún perfil encontrado', noMatchText: 'Pruebe otra palabra o quite el filtro.', off: 'La Comunidad no está disponible en este momento.',
      foot: 'Los perfiles son creados por las propias empresas y revisados por Endeavor antes de aparecer. Endeavor no avala ni garantiza los servicios listados.', prev: 'Página anterior', next: 'Página siguiente', pages: 'Páginas', close: 'Cerrar', about: 'Acerca de',
      tabReviews: 'Reseñas', tabContact: 'Contacto', contact: 'Contactar', c_name: 'Su nombre', c_email: 'Su correo', c_msg: 'Mensaje', c_send: 'Enviar mensaje', c_hint: 'Su mensaje va por correo a {n}. La respuesta llega directo a su correo.', c_ok: 'Mensaje enviado. {n} responderá a su correo.', c_bad: 'Complete su nombre, un correo válido y un mensaje de al menos 10 caracteres.', c_rate: 'Demasiados mensajes. Intente más tarde.', c_err: 'No pudimos enviar el mensaje. Intente de nuevo en unos minutos.',
      noReviewsYet: 'Aún sin reseñas.', rate: 'Escribir una reseña', r_login: 'Para escribir una reseña, ingrese primero a su portal de Endeavor.', r_signin: 'Ingresar', r_rating: 'Su calificación', r_comment: 'Comentario (opcional)', r_send: 'Enviar reseña', r_ok: 'Gracias. Su reseña aparece después de que Endeavor la apruebe.', r_own: 'No puede reseñar su propio perfil.', r_dup: 'Ya reseñó este perfil.', r_pick: 'Elija una calificación de 1 a 5.', r_err: 'No pudimos enviar la reseña. Intente de nuevo.', reply: 'Respuesta de {n}', notFound: 'Este perfil no está disponible.' }
  });
  var L = EP.lang, $ = function (s, r) { return (r || document).querySelector(s); };
  function t(k, v) { var s = T(k); Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; }
  $('#cm-q').placeholder = T('searchPh'); $('#cm-ant').setAttribute('aria-label', T('prev')); $('#cm-prox').setAttribute('aria-label', T('next')); $('#cm-pager').setAttribute('aria-label', T('pages'));
  function rpc(fn, args, token) {
    return fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + (token || CFG.supabaseKey) }, body: JSON.stringify(args || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error((j && j.message) || 'http'); throw e; } return j; }); });
  }
  var todos = [], kind = '', pag = 0, porPag = 0;
  var grade = $('#cm-grade'), pager = $('#cm-pager');
  var semAc = function (v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  function filtrados() { var k = semAc($('#cm-q').value.trim()); return todos.filter(function (p) { return (!kind || p.kind === kind) && (!k || semAc([p.display_name, p.headline, p.area, p.city, p.state].join(' ')).indexOf(k) > -1); }); }
  // quantos cards cabem: colunas pela largura e linhas pela altura (no celular, todos)
  function medir() {
    var w = grade.clientWidth, cols = Math.max(1, Math.min(4, Math.floor((w + 16) / 296)));
    grade.style.setProperty('--cols', cols);
    if (window.innerWidth < 860 || window.innerHeight <= 520) return 0;
    var alt = 200, rows = Math.max(1, Math.floor((grade.clientHeight + 16) / (alt + 16)));
    grade.style.setProperty('--alt', Math.floor((grade.clientHeight - (rows - 1) * 16) / rows) > 260 ? '260px' : alt + 'px');
    return cols * rows;
  }
  function desenha() {
    var l = filtrados(), n = medir(); porPag = n;
    var pags = n ? Math.max(1, Math.ceil(l.length / n)) : 1; pag = Math.max(0, Math.min(pag, pags - 1));
    var vis = n ? l.slice(pag * n, pag * n + n) : l;
    grade.innerHTML = vis.length ? vis.map(function (p) { return '<li>' + C.card(p, L) + '</li>'; }).join('')
      : '<li class="cm-vazio"><strong>' + esc(T(todos.length ? 'noMatch' : 'none')) + '</strong>' + esc(T(todos.length ? 'noMatchText' : 'noneText')) + '</li>';
    $('#cm-total').textContent = l.length ? (l.length === 1 ? T('total1') : t('total', { n: l.length })) : '';
    pager.hidden = pags < 2; $('#cm-pg').textContent = (pag + 1) + '/' + pags; $('#cm-ant').disabled = pag === 0; $('#cm-prox').disabled = pag >= pags - 1;
    Array.prototype.forEach.call(grade.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { abrir(b.dataset.p, b); }; });
  }
  $('#cm-q').addEventListener('input', function () { pag = 0; desenha(); });
  Array.prototype.forEach.call(document.querySelectorAll('#cm-filtro button'), function (b) { b.onclick = function () { kind = b.dataset.k; pag = 0; Array.prototype.forEach.call(document.querySelectorAll('#cm-filtro button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); desenha(); }; });
  $('#cm-ant').onclick = function () { pag--; desenha(); }; $('#cm-prox').onclick = function () { pag++; desenha(); };
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (medir() !== porPag) desenha(); }, 120); });

  /* ---------- perfil ---------- */
  var veu = $('#cm-veu'), voltaFoco = null, aberto = 0;
  function fechar() { veu.hidden = true; veu.innerHTML = ''; document.removeEventListener('keydown', tecla); try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])p=[0-9a-f-]+&?/, '$1').replace(/[?&]$/, '')); } catch (e) { /* ignore */ } if (voltaFoco) voltaFoco.focus(); }
  function tecla(e) {
    if (e.key === 'Escape') return fechar();
    if (e.key !== 'Tab') return;
    var f = veu.querySelectorAll('a[href], button:not([disabled]), input:not([tabindex="-1"]), textarea'), a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
  function data(d) { try { return new Intl.DateTimeFormat(EP.locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)); } catch (e) { return ''; } }
  async function abrir(id, de) {
    voltaFoco = de || null; aberto = Date.now();
    var p; try { p = await rpc('community_profile', { p_id: id }); } catch (e) { p = null; }
    if (!p) { veu.hidden = false; veu.innerHTML = '<div class="cm-perfil" role="dialog" aria-modal="true" style="padding:2rem"><button class="cm-fechar" type="button" aria-label="' + esc(T('close')) + '">×</button><p style="margin:0">' + esc(T('notFound')) + '</p></div>'; $('.cm-fechar', veu).onclick = fechar; return; }
    try { var u = new URL(location.href); u.searchParams.set('p', id); history.replaceState(null, '', u.pathname + u.search); } catch (e) { /* ignore */ }
    var nome = p.display_name || '', rv = p.reviews || [], rp = 0, RPP = 2;
    veu.hidden = false;
    veu.innerHTML = '<div class="cm-perfil" role="dialog" aria-modal="true" aria-labelledby="cm-nome"><button class="cm-fechar" type="button" aria-label="' + esc(T('close')) + '">×</button>' +
      '<div>' + C.profileHead(p, L) + '</div><div class="cm-perfil__corpo"><div><h3 class="portal-h2" style="margin-top:0">' + esc(T('about')) + '</h3><p class="cm-bio">' + esc(p.bio || p.headline || '') + '</p></div>' +
      '<div class="cm-lado"><div class="cm-abas" role="tablist"><button type="button" role="tab" id="cm-t-c" aria-controls="cm-p-c" aria-selected="true">' + esc(T('tabContact')) + '</button><button type="button" role="tab" id="cm-t-r" aria-controls="cm-p-r" aria-selected="false">' + esc(T('tabReviews')) + ' (' + rv.length + ')</button></div>' +
      '<div id="cm-p-c" role="tabpanel" aria-labelledby="cm-t-c"><form class="cm-form" id="cm-fc" novalidate><p class="cm-nota" style="margin:0">' + esc(t('c_hint', { n: nome })) + '</p>' +
        '<label>' + esc(T('c_name')) + '<input id="cm-cn" type="text" autocomplete="name" maxlength="100" required></label><label>' + esc(T('c_email')) + '<input id="cm-ce" type="email" autocomplete="email" maxlength="200" required></label>' +
        '<label>' + esc(T('c_msg')) + '<textarea id="cm-cm" rows="3" maxlength="2000" required></textarea></label>' +
        '<div class="cm-isca" aria-hidden="true"><label>Website<input id="cm-cw" type="text" tabindex="-1" autocomplete="off"></label></div>' +
        '<p class="cm-msg" id="cm-cmsg" role="status"></p><button class="cm-btn" type="submit">' + esc(T('c_send')) + '</button></form></div>' +
      '<div id="cm-p-r" role="tabpanel" aria-labelledby="cm-t-r" hidden><div id="cm-rl"></div><nav class="cm-pager" id="cm-rpg" hidden><button type="button" class="cm-seta" id="cm-ra" aria-label="' + esc(T('prev')) + '">‹</button><span id="cm-rn"></span><button type="button" class="cm-seta" id="cm-rp" aria-label="' + esc(T('next')) + '">›</button></nav>' +
        '<div id="cm-rf" style="margin-top:.6rem"><button class="cm-btn cm-btn--claro" type="button" id="cm-rb">' + esc(T('rate')) + '</button></div><p class="cm-msg" id="cm-rmsg" role="status"></p></div></div></div></div>';
    $('.cm-fechar', veu).onclick = fechar; veu.onclick = function (e) { if (e.target === veu) fechar(); };
    document.addEventListener('keydown', tecla); $('.cm-fechar', veu).focus();
    var aba = function (qual) { ['c', 'r'].forEach(function (k) { $('#cm-t-' + k).setAttribute('aria-selected', String(k === qual)); $('#cm-p-' + k).hidden = k !== qual; }); };
    $('#cm-t-c').onclick = function () { aba('c'); }; $('#cm-t-r').onclick = function () { aba('r'); };
    function lista() {
      var pags = Math.max(1, Math.ceil(rv.length / RPP)); rp = Math.max(0, Math.min(rp, pags - 1));
      $('#cm-rl').innerHTML = rv.length ? rv.slice(rp * RPP, rp * RPP + RPP).map(function (r) {
        return '<div class="cm-aval"><div class="cm-aval__topo"><span><strong>' + esc(r.author) + '</strong> ' + C.stars(L, r.rating) + '</span><span>' + esc(data(r.at)) + '</span></div>' + (r.comment ? '<p>' + esc(r.comment) + '</p>' : '') +
          (r.reply ? '<div class="cm-resp"><strong>' + esc(t('reply', { n: nome })) + '</strong><br>' + esc(r.reply) + '</div>' : '') + '</div>'; }).join('') : '<p class="cm-nota" style="margin:0">' + esc(T('noReviewsYet')) + '</p>';
      $('#cm-rpg').hidden = pags < 2; $('#cm-rn').textContent = (rp + 1) + '/' + pags; $('#cm-ra').disabled = rp === 0; $('#cm-rp').disabled = rp >= pags - 1;
    }
    $('#cm-ra').onclick = function () { rp--; lista(); }; $('#cm-rp').onclick = function () { rp++; lista(); }; lista();
    var msg = function (el, txt, ok) { el.className = 'cm-msg ' + (ok ? 'cm-msg--ok' : 'cm-msg--erro'); el.textContent = txt; };
    // contato: vai por e-mail ao dono do perfil, sem mostrar o e-mail dele
    $('#cm-fc').onsubmit = async function (e) {
      e.preventDefault();
      var m = $('#cm-cmsg'), b = this.querySelector('button[type=submit]'), n = $('#cm-cn').value.trim(), em = $('#cm-ce').value.trim(), tx = $('#cm-cm').value.trim();
      if (n.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em) || tx.length < 10) return msg(m, T('c_bad'), false);
      b.disabled = true;
      try {
        var r = await fetch(CFG.functionsUrl + '/crm', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify({ public: 'community_contact', profile_id: id, name: n, email: em, message: tx, website: $('#cm-cw').value, elapsed_ms: Date.now() - aberto }) });
        if (r.status === 429) { b.disabled = false; return msg(m, T('c_rate'), false); }
        if (!r.ok) throw new Error('http');
        this.querySelectorAll('input, textarea').forEach(function (x) { x.value = ''; }); msg(m, t('c_ok', { n: nome }), true);
        setTimeout(function () { b.disabled = false; }, 8000);
      } catch (er) { b.disabled = false; msg(m, T('c_err'), false); }
    };
    // avaliar: só quem está logado no portal
    $('#cm-rb').onclick = async function () {
      var onde = window.ESession && ESession.where(), box = $('#cm-rf'), m = $('#cm-rmsg');
      if (!onde) { box.innerHTML = '<p class="cm-nota" style="margin:0 0 .5rem">' + esc(T('r_login')) + '</p><a class="cm-btn" href="login.html?lang=' + L + '">' + esc(T('r_signin')) + '</a>'; return; }
      box.innerHTML = '<form class="cm-form" id="cm-fr" novalidate><fieldset class="cm-nota-radio"><legend>' + esc(T('r_rating')) + '</legend>' + [1, 2, 3, 4, 5].map(function (i) { return '<label><input type="radio" name="cm-nota" value="' + i + '"><span>' + i + ' ★</span></label>'; }).join('') + '</fieldset>' +
        '<label>' + esc(T('r_comment')) + '<textarea id="cm-rc" rows="2" maxlength="600"></textarea></label><button class="cm-btn" type="submit">' + esc(T('r_send')) + '</button></form>';
      $('#cm-fr').onsubmit = async function (e) {
        e.preventDefault();
        var nota = (this.querySelector('input[name="cm-nota"]:checked') || {}).value, b = this.querySelector('button[type=submit]');
        if (!nota) return msg(m, T('r_pick'), false);
        b.disabled = true;
        try {
          var tok = await token(onde.route);
          if (!tok) { b.disabled = false; return msg(m, T('r_login'), false); }
          await rpc('community_review_add', { p_profile: id, p_rating: +nota, p_comment: $('#cm-rc').value.trim() }, tok);
          box.innerHTML = ''; msg(m, T('r_ok'), true);
        } catch (er) { b.disabled = false; var x = String(er.message || ''); msg(m, /own_profile/.test(x) ? T('r_own') : /already_reviewed/.test(x) ? T('r_dup') : /login_required/.test(x) ? T('r_login') : T('r_err'), false); }
      };
    };
  }
  // sessão do portal (renova o acesso se precisar); a biblioteca só é carregada quando alguém vai avaliar
  function token(rota) {
    return new Promise(function (res) {
      var usa = function () {
        try {
          var o = { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }; if (rota !== 'admin') o.storageKey = 'endeavor-client-auth';
          window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: o }).auth.getSession().then(function (r) { res(r.data && r.data.session ? r.data.session.access_token : null); }, function () { res(null); });
        } catch (e) { res(null); }
      };
      if (window.supabase) return usa();
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js'; s.onload = usa; s.onerror = function () { res(null); }; document.head.appendChild(s);
    });
  }

  rpc('community_on').then(function (on) {
    if (!on) { grade.innerHTML = '<li class="cm-vazio"><strong>' + esc(T('off')) + '</strong></li>'; return; }
    return rpc('community_list').then(function (l) {
      todos = Array.isArray(l) ? l : []; desenha(); requestAnimationFrame(desenha);
      var pid = (/[?&]p=([0-9a-f-]{36})/.exec(location.search) || [])[1]; if (pid) abrir(pid);
    });
  }).catch(function () { grade.innerHTML = '<li class="cm-vazio"><strong>' + esc(T('off')) + '</strong></li>'; });
})();
