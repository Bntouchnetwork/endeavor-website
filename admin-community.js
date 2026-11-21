/* Admin > Comunidade: aprovar, editar, ocultar e remover perfis; aprovar, ocultar e remover avaliações; chave geral. */
(function () {
  'use strict';
  var ST = { draft: 'Rascunho (cliente desligou)', pending: 'Aguardando aprovação', published: 'Publicado', hidden: 'Oculto' };
  var RS = { pending: 'Aguardando aprovação', published: 'Publicada', hidden: 'Oculta' };
  async function view(el, X) {
    var sb = X.sb, esc = X.esc, aba = (location.hash.match(/[?&]aba=([a-z]+)/) || [])[1] === 'avaliacoes' ? 'avaliacoes' : 'perfis';
    var res = await Promise.all([sb.from('community_profiles').select('*, clients(name, primary_email)').order('updated_at', { ascending: false }), sb.from('community_reviews').select('*, community_profiles(display_name, published)').order('created_at', { ascending: false }).limit(300), sb.from('crm_settings').select('community_enabled').eq('id', 1).single()]);
    var perfis = res[0].data || [], avals = res[1].data || [], on = !res[2].data || res[2].data.community_enabled !== false;
    var espera = perfis.filter(function (p) { return p.enabled && (p.status === 'pending' || p.pending_changes); }).length, esperaR = avals.filter(function (r) { return r.status === 'pending'; }).length;
    var sit = function (p) { return !p.enabled && p.status !== 'hidden' ? 'Desligado pelo cliente' : p.status === 'published' && p.pending_changes ? 'Publicado · alterações para aprovar' : ST[p.status]; };
    el.innerHTML = '<div class="console__head"><div><h1>Comunidade</h1><p class="portal-muted">Diretório público de empresas e profissionais clientes. Nada aparece antes da sua aprovação.</p></div>' +
      '<div class="portal-btn-row"><div class="check-row" style="margin:0"><input type="checkbox" id="cmn-on"' + (on ? ' checked' : '') + '><label for="cmn-on">Página Comunidade e link na home ligados</label></div><a class="btn btn--ghost btn--xs" href="community.html?lang=pt" target="_blank" rel="noopener">Abrir a página</a></div></div>' +
      '<div class="portal-alert" id="cmn-m" role="status"></div>' +
      '<nav class="subtabs" aria-label="Comunidade"><a href="#/comunidade"' + (aba === 'perfis' ? ' aria-current="page"' : '') + '>Perfis' + (espera ? ' (' + espera + ')' : '') + '</a><a href="#/comunidade?aba=avaliacoes"' + (aba === 'avaliacoes' ? ' aria-current="page"' : '') + '>Avaliações' + (esperaR ? ' (' + esperaR + ')' : '') + '</a></nav>' +
      (aba === 'perfis' ? '<div class="table-wrap"><table class="data" id="cmn-tab"><thead><tr><th>Perfil</th><th>Cliente</th><th>Tipo</th><th>Situação</th><th>Atualizado</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        (perfis.length ? perfis.map(function (p) { var pode = p.enabled && (p.status === 'pending' || p.pending_changes || p.status === 'hidden');
          return '<tr><td><strong>' + esc(p.display_name || '(sem nome)') + '</strong><div class="portal-muted" style="font-size:.85rem">' + esc([p.area, p.city, p.state].filter(Boolean).join(' · ')) + '</div></td><td>' + esc(p.clients ? p.clients.name : '') + '</td><td>' + (p.kind === 'professional' ? 'Profissional' : 'Empresa') + '</td>' +
            '<td><span class="pill' + (p.status === 'published' && !p.pending_changes && p.enabled ? ' pill--done' : '') + '">' + esc(sit(p)) + '</span></td><td>' + esc(X.fmtDT(p.updated_at)) + '</td>' +
            '<td><div class="portal-btn-row" style="justify-content:flex-end"><button class="btn btn--ghost btn--xs" type="button" data-ver="' + p.id + '">Ver e editar</button>' + (pode ? '<button class="btn btn--navy btn--xs" type="button" data-ap="' + p.id + '">' + (p.status === 'published' ? 'Aprovar alterações' : 'Aprovar') + '</button>' : '') +
            (p.status === 'published' ? '<button class="btn btn--ghost btn--xs" type="button" data-oc="' + p.id + '">Ocultar</button>' : '') + '<button class="btn btn--ghost btn--xs btn--danger-text" type="button" data-rm="' + p.id + '">Remover</button></div></td></tr>'; }).join('')
          : '<tr><td colspan="6"><div class="empty-state"><strong>Nenhum perfil ainda</strong>Os perfis aparecem aqui quando um cliente preenche o Perfil em Configurações.</div></td></tr>') + '</tbody></table></div>'
      : '<div class="table-wrap"><table class="data" id="cmn-rev"><thead><tr><th>Perfil</th><th>Quem avaliou</th><th>Nota</th><th>Comentário e resposta</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        (avals.length ? avals.map(function (r) {
          return '<tr><td>' + esc(r.community_profiles ? r.community_profiles.display_name : '') + '</td><td>' + esc(r.author_name) + '<div class="portal-muted" style="font-size:.85rem">' + esc(X.fmtDT(r.created_at)) + '</div></td><td>' + r.rating + ' ★</td>' +
            '<td style="max-width:26rem">' + esc(r.comment || '(sem comentário)') + (r.reply ? '<div class="portal-muted" style="font-size:.85rem;margin-top:.25rem">Resposta do perfil: ' + esc(r.reply) + ' <button class="btn btn--ghost btn--xs" type="button" data-rr="' + r.id + '">Remover resposta</button></div>' : '') + '</td>' +
            '<td><span class="pill' + (r.status === 'published' ? ' pill--done' : '') + '">' + RS[r.status] + '</span></td><td><div class="portal-btn-row" style="justify-content:flex-end">' + (r.status !== 'published' ? '<button class="btn btn--navy btn--xs" type="button" data-ra="' + r.id + '">Aprovar</button>' : '') + (r.status !== 'hidden' ? '<button class="btn btn--ghost btn--xs" type="button" data-ro="' + r.id + '">Ocultar</button>' : '') + '<button class="btn btn--ghost btn--xs btn--danger-text" type="button" data-rx="' + r.id + '">Remover</button></div></td></tr>'; }).join('')
          : '<tr><td colspan="6"><div class="empty-state"><strong>Nenhuma avaliação ainda</strong></div></td></tr>') + '</tbody></table></div>');
    var m = el.querySelector('#cmn-m'), de = function () { return view(el, X); };
    var faz = async function (p) { var r = await p; if (r.error) { X.msg(m, X.errText(r.error), 'error'); return false; } await de(); return true; };
    var quem = async function () { try { return ((await sb.auth.getUser()).data.user || {}).email || ''; } catch (e) { return ''; } };
    el.querySelector('#cmn-on').onchange = async function () { var r = await sb.from('crm_settings').update({ community_enabled: this.checked, updated_at: new Date().toISOString() }).eq('id', 1); X.msg(m, r.error ? X.errText(r.error) : (this.checked ? 'Comunidade ligada: a página e o link na home aparecem.' : 'Comunidade desligada: a página e o link na home somem.'), r.error ? 'error' : 'ok'); };
    var acha = function (id) { return perfis.filter(function (p) { return p.id === id; })[0]; };
    el.querySelectorAll('[data-ap]').forEach(function (b) { b.onclick = function () { faz(sb.rpc('community_admin_set', { p_id: b.dataset.ap, p_action: 'approve' })); }; });
    el.querySelectorAll('[data-oc]').forEach(function (b) { b.onclick = function () { if (confirm('Ocultar este perfil? Ele sai da página até você aprovar de novo.')) faz(sb.rpc('community_admin_set', { p_id: b.dataset.oc, p_action: 'hide' })); }; });
    el.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { var p = acha(b.dataset.rm); if (confirm('Remover o perfil "' + (p.display_name || '') + '" e as avaliações dele? Não dá para desfazer.')) faz(sb.from('community_profiles').delete().eq('id', p.id)); }; });
    el.querySelectorAll('[data-ra]').forEach(function (b) { b.onclick = async function () { faz(sb.from('community_reviews').update({ status: 'published', reviewed_at: new Date().toISOString(), reviewed_by: await quem() }).eq('id', b.dataset.ra)); }; });
    el.querySelectorAll('[data-ro]').forEach(function (b) { b.onclick = async function () { faz(sb.from('community_reviews').update({ status: 'hidden', reviewed_at: new Date().toISOString(), reviewed_by: await quem() }).eq('id', b.dataset.ro)); }; });
    el.querySelectorAll('[data-rx]').forEach(function (b) { b.onclick = function () { if (confirm('Remover esta avaliação? Não dá para desfazer.')) faz(sb.from('community_reviews').delete().eq('id', b.dataset.rx)); }; });
    el.querySelectorAll('[data-rr]').forEach(function (b) { b.onclick = function () { if (confirm('Remover a resposta do perfil a esta avaliação?')) faz(sb.from('community_reviews').update({ reply: null, reply_at: null }).eq('id', b.dataset.rr)); }; });
    // ver e editar: mostra como o perfil vai aparecer (a versão que o cliente gravou) e deixa a equipe corrigir os textos
    el.querySelectorAll('[data-ver]').forEach(function (b) { b.onclick = function () {
      var p = acha(b.dataset.ver), C = window.ECommunity, f = function (id, label, val, max) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="text" maxlength="' + max + '" value="' + esc(val || '') + '"></div>'; };
      var o = X.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(p.display_name || 'Perfil') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
        '<p class="portal-muted" style="margin:0 0 .6rem">' + esc(sit(p)) + ' · cliente: ' + esc(p.clients ? p.clients.name : '') + '</p>' +
        (C ? '<div style="border:1px solid #e3e7ee;border-radius:14px;overflow:hidden;margin-bottom:1rem">' + C.profileHead(Object.assign({ reviews: 0 }, p), 'pt') + '<div style="padding:1rem 1.25rem"><p class="cm-bio">' + esc(p.bio || p.headline || '') + '</p></div></div>' : '') +
        '<form class="portal-form" id="cmn-f" novalidate><div class="portal-grid2"><div class="field"><label for="cmn-kind">Tipo</label><select id="cmn-kind"><option value="company"' + (p.kind !== 'professional' ? ' selected' : '') + '>Empresa</option><option value="professional"' + (p.kind === 'professional' ? ' selected' : '') + '>Profissional</option></select></div>' + f('cmn-name', 'Nome exibido', p.display_name, 120) + '</div>' +
        f('cmn-head', 'Descrição curta', p.headline, 160) + '<div class="portal-grid2">' + f('cmn-area', 'Área de atuação', p.area, 80) + f('cmn-site', 'Site', p.website, 200) + '</div><div class="portal-grid2">' + f('cmn-city', 'Cidade', p.city, 80) + f('cmn-state', 'Estado', p.state, 40) + '</div>' +
        '<div class="field"><label for="cmn-bio">Bio</label><textarea id="cmn-bio" rows="5" maxlength="1500">' + esc(p.bio || '') + '</textarea></div>' +
        '<div class="check-row"><input type="checkbox" id="cmn-xb"><label for="cmn-xb">Tirar o banner</label></div><div class="check-row"><input type="checkbox" id="cmn-xl"><label for="cmn-xl">Tirar o logo</label></div><div class="check-row"><input type="checkbox" id="cmn-xp"><label for="cmn-xp">Tirar a foto</label></div>' +
        '<div class="portal-alert" id="cmn-fm" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar e aprovar</button><button class="btn btn--ghost" type="button" id="cmn-so">Só salvar</button></div></form>', false);
      var root = (o && o.querySelector) ? o : document.getElementById('overlay'), q = function (s) { return root.querySelector(s); };
      var salva = async function (aprova) {
        var site = q('#cmn-site').value.trim(); if (site && !/^https?:\/\//i.test(site)) site = 'https://' + site;
        var row = { kind: q('#cmn-kind').value, display_name: q('#cmn-name').value.trim() || null, headline: q('#cmn-head').value.trim() || null, area: q('#cmn-area').value.trim() || null, website: site || null, city: q('#cmn-city').value.trim() || null, state: q('#cmn-state').value.trim() || null, bio: q('#cmn-bio').value.trim() || null, updated_at: new Date().toISOString() };
        if (q('#cmn-xb').checked) row.banner_path = null; if (q('#cmn-xl').checked) row.logo_path = null; if (q('#cmn-xp').checked) row.photo_path = null;
        var r = await sb.from('community_profiles').update(row).eq('id', p.id);
        if (r.error) return X.msg(q('#cmn-fm'), X.errText(r.error), 'error');
        if (aprova) { var a = await sb.rpc('community_admin_set', { p_id: p.id, p_action: 'approve' }); if (a.error) return X.msg(q('#cmn-fm'), /name_required/.test(a.error.message || '') ? 'O perfil precisa de um nome para ser publicado.' : X.errText(a.error), 'error'); }
        X.closeOverlay(); de();
      };
      q('#cmn-f').onsubmit = function (e) { e.preventDefault(); salva(true); }; q('#cmn-so').onclick = function () { salva(false); };
    }; });
  }
  window.EAdminCommunity = { view: view };
})();
