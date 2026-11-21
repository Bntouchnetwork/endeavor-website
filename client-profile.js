/* Portal do cliente > Configurações > Perfil: dados da pessoa, o perfil da Comunidade (com as imagens),
   a opção "Aparecer na Comunidade" e a prévia. Mudanças num perfil publicado esperam a aprovação da Endeavor. */
(function () {
  'use strict';
  var D = {
    en: { you: 'Your details', name: 'Your name', phone: 'Phone / WhatsApp', lang: 'Language', com: 'Community profile', kind: 'Appears as', company: 'Company', professional: 'Professional', dname: 'Name shown', headline: 'Short description', headlinePh: 'What you do, in one sentence', area: 'Field of work', city: 'City', state: 'State', site: 'Website', bio: 'About (bio)',
      imgs: 'Images', photo: 'Profile photo', logo: 'Company logo', banner: 'Banner', pick: 'Upload', change: 'Change', remove: 'Remove', imgHint: 'JPG, PNG or WebP, up to 3 MB.', imgBad: 'Choose a JPG, PNG or WebP image of up to 3 MB.',
      show: 'Appear in the Community', showHint: 'Your profile appears on the public Community page after Endeavor approves it.', terms: 'I agree that the data of this profile appears on a public page and that visitors can send me messages and reviews.', termsNote: 'Draft terms, under legal review.',
      st_draft: 'Not published', st_pending: 'Waiting for approval', st_published: 'Published', st_changes: 'Published · changes waiting for approval', st_hidden: 'Hidden by Endeavor',
      save: 'Save profile', saved: 'Profile saved.', savedPending: 'Profile saved and sent for approval.', savedChanges: 'Saved. The changes appear after Endeavor approves them; the approved version stays online.', preview: 'Preview', e_name: 'Enter the name shown in the Community (and your name).', e_terms: 'To appear in the Community, accept the terms.', e_phone: 'Enter a valid phone, with the country code.', e_site: 'Enter a valid website address.',
      reviews: 'Reviews ({n})', noReviews: 'No published reviews yet.', reply: 'Reply', replyPh: 'Your public answer', sendReply: 'Publish answer', removeReply: 'Remove answer', replied: 'Answer published.', open: 'Open the Community' },
    pt: { you: 'Seus dados', name: 'Seu nome', phone: 'Telefone / WhatsApp', lang: 'Idioma', com: 'Perfil na Comunidade', kind: 'Aparece como', company: 'Empresa', professional: 'Profissional', dname: 'Nome exibido', headline: 'Descrição curta', headlinePh: 'O que você faz, em uma frase', area: 'Área de atuação', city: 'Cidade', state: 'Estado', site: 'Site', bio: 'Sobre (bio)',
      imgs: 'Imagens', photo: 'Foto do perfil', logo: 'Logo da empresa', banner: 'Banner', pick: 'Enviar', change: 'Trocar', remove: 'Remover', imgHint: 'JPG, PNG ou WebP, até 3 MB.', imgBad: 'Escolha uma imagem JPG, PNG ou WebP de até 3 MB.',
      show: 'Aparecer na Comunidade', showHint: 'O seu perfil aparece na página pública da Comunidade depois que a Endeavor aprovar.', terms: 'Aceito que os dados deste perfil apareçam em página pública e que visitantes me enviem mensagens e avaliações.', termsNote: 'Rascunho do termo, em revisão jurídica.',
      st_draft: 'Não publicado', st_pending: 'Aguardando aprovação', st_published: 'Publicado', st_changes: 'Publicado · alterações aguardando aprovação', st_hidden: 'Oculto pela Endeavor',
      save: 'Salvar perfil', saved: 'Perfil salvo.', savedPending: 'Perfil salvo e enviado para aprovação.', savedChanges: 'Salvo. As alterações aparecem depois que a Endeavor aprovar; a versão aprovada continua no ar.', preview: 'Prévia', e_name: 'Preencha o nome exibido na Comunidade (e o seu nome).', e_terms: 'Para aparecer na Comunidade, aceite o termo.', e_phone: 'Digite um telefone válido, com o código do país.', e_site: 'Digite um endereço de site válido.',
      reviews: 'Avaliações ({n})', noReviews: 'Ainda não há avaliações publicadas.', reply: 'Responder', replyPh: 'A sua resposta pública', sendReply: 'Publicar resposta', removeReply: 'Remover resposta', replied: 'Resposta publicada.', open: 'Abrir a Comunidade' },
    es: { you: 'Sus datos', name: 'Su nombre', phone: 'Teléfono / WhatsApp', lang: 'Idioma', com: 'Perfil en la Comunidad', kind: 'Aparece como', company: 'Empresa', professional: 'Profesional', dname: 'Nombre mostrado', headline: 'Descripción corta', headlinePh: 'Lo que hace, en una frase', area: 'Área de actuación', city: 'Ciudad', state: 'Estado', site: 'Sitio web', bio: 'Acerca de (bio)',
      imgs: 'Imágenes', photo: 'Foto del perfil', logo: 'Logo de la empresa', banner: 'Banner', pick: 'Subir', change: 'Cambiar', remove: 'Quitar', imgHint: 'JPG, PNG o WebP, hasta 3 MB.', imgBad: 'Elija una imagen JPG, PNG o WebP de hasta 3 MB.',
      show: 'Aparecer en la Comunidad', showHint: 'Su perfil aparece en la página pública de la Comunidad después de que Endeavor lo apruebe.', terms: 'Acepto que los datos de este perfil aparezcan en una página pública y que los visitantes me envíen mensajes y reseñas.', termsNote: 'Borrador de los términos, en revisión legal.',
      st_draft: 'No publicado', st_pending: 'Esperando aprobación', st_published: 'Publicado', st_changes: 'Publicado · cambios esperando aprobación', st_hidden: 'Oculto por Endeavor',
      save: 'Guardar perfil', saved: 'Perfil guardado.', savedPending: 'Perfil guardado y enviado para aprobación.', savedChanges: 'Guardado. Los cambios aparecen después de que Endeavor los apruebe; la versión aprobada sigue en línea.', preview: 'Vista previa', e_name: 'Complete el nombre mostrado en la Comunidad (y su nombre).', e_terms: 'Para aparecer en la Comunidad, acepte los términos.', e_phone: 'Escriba un teléfono válido, con el código del país.', e_site: 'Escriba una dirección de sitio válida.',
      reviews: 'Reseñas ({n})', noReviews: 'Aún no hay reseñas publicadas.', reply: 'Responder', replyPh: 'Su respuesta pública', sendReply: 'Publicar respuesta', removeReply: 'Quitar respuesta', replied: 'Respuesta publicada.', open: 'Abrir la Comunidad' }
  };
  async function render(box, X) {
    var L = D[X.L] ? X.L : 'en', T = D[L], esc = X.esc, S = X.S, sb = X.sb, cid = S.client.id;
    var t = function (k, v) { var s = T[k]; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; };
    var res = await Promise.all([sb.from('community_profiles').select('*').eq('client_id', cid).maybeSingle(), sb.rpc('community_on')]);
    var P = res[0].data || { kind: 'company', enabled: false, status: 'draft' }, on = res[1].data !== false;
    var rv = P.id ? ((await sb.from('community_reviews').select('id, author_name, rating, comment, created_at, reply').eq('profile_id', P.id).eq('status', 'published').order('created_at', { ascending: false })).data || []) : [];
    var img = { photo: P.photo_path || '', logo: P.logo_path || '', banner: P.banner_path || '' };
    var fld = function (id, label, val, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="text" value="' + esc(val || '') + '"' + (extra || '') + '></div>'; };
    var st = P.status === 'published' ? (P.pending_changes ? 'changes' : 'published') : P.status;
    box.innerHTML = '<form class="pf-grid portal-form" id="pf" novalidate>' +
      '<section class="portal-card pf-col"><h2 class="portal-h2">' + T.you + '</h2>' + fld('pf-name', T.name, S.me.name || '', ' maxlength="120" autocomplete="name"') + fld('pf-phone', T.phone, S.client.phone || '', ' maxlength="30" inputmode="tel" autocomplete="tel" placeholder="+1 407 555 0100"') +
        '<div class="field"><label for="pf-lang">' + T.lang + '</label><select id="pf-lang">' + [['en', 'English'], ['pt', 'Português'], ['es', 'Español']].map(function (x) { return '<option value="' + x[0] + '"' + ((S.client.language || L) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
        '<h2 class="portal-h2 pf-h2">' + T.imgs + '</h2><div class="pf-imgs">' + ['photo', 'logo', 'banner'].map(function (k) { return '<div class="pf-img" data-img="' + k + '"><span class="pf-thumb pf-thumb--' + k + '" id="pf-th-' + k + '"></span><div><strong>' + T[k] + '</strong><div class="portal-btn-row"><label class="btn btn--ghost btn--xs pf-up" for="pf-f-' + k + '" id="pf-l-' + k + '"></label><input type="file" class="sr-only" id="pf-f-' + k + '" accept="image/jpeg,image/png,image/webp"><button class="btn btn--ghost btn--xs" type="button" data-rm="' + k + '">' + T.remove + '</button></div></div></div>'; }).join('') + '</div><p class="portal-muted pf-hint">' + T.imgHint + '</p></section>' +
      '<section class="portal-card pf-col"><h2 class="portal-h2">' + T.com + '</h2>' +
        '<div class="portal-grid2"><div class="field"><label for="pf-kind">' + T.kind + '</label><select id="pf-kind"><option value="company"' + (P.kind !== 'professional' ? ' selected' : '') + '>' + T.company + '</option><option value="professional"' + (P.kind === 'professional' ? ' selected' : '') + '>' + T.professional + '</option></select></div>' + fld('pf-dname', T.dname, P.display_name || '', ' maxlength="120"') + '</div>' +
        fld('pf-headline', T.headline, P.headline || '', ' maxlength="160" placeholder="' + esc(T.headlinePh) + '"') +
        '<div class="portal-grid2">' + fld('pf-area', T.area, P.area || '', ' maxlength="80"') + fld('pf-site', T.site, P.website || '', ' maxlength="200" inputmode="url" placeholder="https://"') + '</div>' +
        '<div class="portal-grid2">' + fld('pf-city', T.city, P.city || '', ' maxlength="80" autocomplete="address-level2"') + fld('pf-state', T.state, P.state || '', ' maxlength="40" autocomplete="address-level1"') + '</div>' +
        '<div class="field"><label for="pf-bio">' + T.bio + '</label><textarea id="pf-bio" rows="4" maxlength="1500">' + esc(P.bio || '') + '</textarea></div></section>' +
      '<section class="portal-card pf-col"><div class="pf-topo"><h2 class="portal-h2" style="margin:0">' + T.preview + '</h2><span class="pill pf-st pf-st--' + st + '" id="pf-st">' + T['st_' + st] + '</span></div>' +
        '<div class="pf-prev" id="pf-prev"></div>' +
        (on ? '<div class="check-row pf-on"><input type="checkbox" id="pf-on"' + (P.enabled ? ' checked' : '') + ' aria-describedby="pf-onh"><label for="pf-on"><strong>' + T.show + '</strong></label></div><p class="portal-muted pf-hint" id="pf-onh">' + T.showHint + '</p>' +
          '<div class="check-row pf-terms" id="pf-tbox"' + (P.terms_accepted_at || !P.enabled ? ' hidden' : '') + '><input type="checkbox" id="pf-terms"><label for="pf-terms">' + T.terms + ' <span class="portal-muted">(' + T.termsNote + ')</span></label></div>' : '') +
        '<div class="portal-alert" id="pf-m" role="status"></div><div class="portal-btn-row pf-fim"><button class="btn btn--navy" type="submit">' + T.save + '</button>' +
        (rv.length || st === 'published' || st === 'changes' ? '<button class="btn btn--ghost btn--sm" type="button" id="pf-rv">' + t('reviews', { n: rv.length }) + '</button>' : '') + (on ? '<a class="btn btn--ghost btn--sm" href="community.html?lang=' + L + (P.id && P.status === 'published' ? '&p=' + P.id : '') + '" target="_blank" rel="noopener">' + T.open + '</a>' : '') + '</div></section></form>';
    var $ = function (s) { return box.querySelector(s); };
    var atual = function () { return { kind: $('#pf-kind').value, display_name: $('#pf-dname').value.trim(), headline: $('#pf-headline').value.trim(), bio: $('#pf-bio').value.trim(), area: $('#pf-area').value.trim(), city: $('#pf-city').value.trim(), state: $('#pf-state').value.trim(), website: $('#pf-site').value.trim(), photo_path: img.photo, logo_path: img.logo, banner_path: img.banner }; };
    function previa() {
      var p = atual(); p.reviews = rv.length; p.rating = rv.length ? rv.reduce(function (a, r) { return a + r.rating; }, 0) / rv.length : 0;
      if (p.website && !/^https?:\/\//i.test(p.website)) p.website = 'https://' + p.website;
      $('#pf-prev').innerHTML = ECommunity.card(p, L, { preview: true });
      ['photo', 'logo', 'banner'].forEach(function (k) { var u = ECommunity.img(img[k]); $('#pf-th-' + k).style.backgroundImage = u ? 'url("' + u + '")' : ''; $('#pf-th-' + k).classList.toggle('is-on', !!u); $('#pf-l-' + k).textContent = u ? T.change : T.pick; box.querySelector('[data-rm="' + k + '"]').hidden = !u; });
    }
    ['#pf-kind', '#pf-dname', '#pf-headline', '#pf-area', '#pf-city', '#pf-state', '#pf-site'].forEach(function (s) { $(s).addEventListener('input', previa); });
    previa();
    ['photo', 'logo', 'banner'].forEach(function (k) {
      $('#pf-f-' + k).onchange = async function () {
        var f = this.files[0], m = $('#pf-m'); this.value = ''; if (!f) return;
        if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 3 * 1024 * 1024) return X.msg(m, T.imgBad, 'error');
        var path = cid + '/' + k + '-' + crypto.randomUUID().slice(0, 10) + '.' + ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[f.type];
        var up = await sb.storage.from('community').upload(path, f, { contentType: f.type, cacheControl: '3600' });
        if (up.error) return X.msg(m, X.errText(up.error), 'error');
        img[k] = path; X.msg(m, '', 'info'); previa();
      };
      box.querySelector('[data-rm="' + k + '"]').onclick = function () { img[k] = ''; previa(); };
    });
    if ($('#pf-on')) $('#pf-on').onchange = function () { if (!P.terms_accepted_at) $('#pf-tbox').hidden = !this.checked; };
    $('#pf').onsubmit = async function (e) {
      e.preventDefault();
      var m = $('#pf-m'), b = this.querySelector('button[type=submit]'), p = atual(), nome = $('#pf-name').value.trim(), fone = $('#pf-phone').value.trim(), liga = !!($('#pf-on') && $('#pf-on').checked);
      if (nome.length < 2 || (liga && p.display_name.length < 2)) return X.msg(m, T.e_name, 'error');
      if (fone && !/^\+?[0-9 ()-]{7,24}$/.test(fone)) return X.msg(m, T.e_phone, 'error');
      if (p.website && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(p.website)) return X.msg(m, T.e_site, 'error');
      if (liga && !P.terms_accepted_at && !$('#pf-terms').checked) return X.msg(m, T.e_terms, 'error');
      b.disabled = true;
      var r1 = await sb.rpc('client_update_profile', { p_client: cid, p_name: nome, p_phone: fone, p_language: $('#pf-lang').value });
      if (r1.error) { b.disabled = false; return X.msg(m, /bad_phone/.test(r1.error.message || '') ? T.e_phone : X.errText(r1.error), 'error'); }
      p.enabled = liga; p.terms = !!($('#pf-terms') && $('#pf-terms').checked);
      var r2 = await sb.rpc('community_save', { p_client: cid, p: p });
      if (r2.error) { b.disabled = false; return X.msg(m, /name_required/.test(r2.error.message || '') ? T.e_name : /terms_required/.test(r2.error.message || '') ? T.e_terms : X.errText(r2.error), 'error'); }
      S.me.name = nome; S.client.phone = fone || null; if (['en', 'pt', 'es'].indexOf($('#pf-lang').value) > -1) S.client.language = $('#pf-lang').value;
      var novo = r2.data || {}, txt = novo.status === 'pending' ? T.savedPending : novo.pending_changes ? T.savedChanges : T.saved;
      await render(box, X); X.msg(box.querySelector('#pf-m'), txt, 'ok');
    };
    // avaliações publicadas do perfil, com a resposta do dono
    if ($('#pf-rv')) $('#pf-rv').onclick = function () {
      var o = X.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t('reviews', { n: rv.length }) + '</h2><button class="close-x" type="button" aria-label="×">×</button></div>' +
        (rv.length ? rv.map(function (r) { return '<div class="cm-aval" data-rv="' + r.id + '"><div class="cm-aval__topo"><span><strong>' + esc(r.author_name) + '</strong> ' + ECommunity.stars(L, r.rating) + '</span><span>' + esc(X.fmtDate(r.created_at)) + '</span></div>' + (r.comment ? '<p>' + esc(r.comment) + '</p>' : '') +
          '<label class="sr-only" for="rp-' + r.id + '">' + T.reply + '</label><textarea id="rp-' + r.id + '" rows="2" maxlength="600" placeholder="' + esc(T.replyPh) + '" style="width:100%;margin-top:.4rem">' + esc(r.reply || '') + '</textarea><div class="portal-btn-row" style="margin-top:.3rem"><button class="btn btn--navy btn--xs" type="button" data-send="' + r.id + '">' + T.sendReply + '</button>' + (r.reply ? '<button class="btn btn--ghost btn--xs" type="button" data-del="' + r.id + '">' + T.removeReply + '</button>' : '') + '</div></div>'; }).join('') : '<p class="portal-muted">' + T.noReviews + '</p>') + '<div class="portal-alert" id="rp-m" role="status"></div>', false);
      var root = (o && o.querySelector) ? o : document.getElementById('overlay');
      var manda = async function (id, txt) { var r = await sb.rpc('community_review_reply', { p_review: id, p_text: txt }); if (r.error) return X.msg(root.querySelector('#rp-m'), X.errText(r.error), 'error'); var it = rv.filter(function (x) { return x.id === id; })[0]; if (it) it.reply = txt || null; X.msg(root.querySelector('#rp-m'), T.replied, 'ok'); };
      root.querySelectorAll('[data-send]').forEach(function (b) { b.onclick = function () { manda(b.dataset.send, root.querySelector('#rp-' + b.dataset.send).value.trim()); }; });
      root.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { root.querySelector('#rp-' + b.dataset.del).value = ''; manda(b.dataset.del, ''); }; });
    };
  }
  window.EProfile = { render: render };
})();
