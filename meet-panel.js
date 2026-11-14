/* Web Meeting: lista e criação de salas, usada no admin (aba Web Meeting) e no Portal do Cliente.
   EMeetPanel.render(view, ctx, { scope: 'admin' | 'client', clientId?, clientName? })
   - Criar sala: nome, instantânea ou agendada (data e hora).
   - Lista com status (agendada, ao vivo, encerrada), Entrar, Copiar link ("Link copiado") e Detalhes
     (participantes, gravações e resumos da IA).
   As salas vêm do banco pelas políticas de acesso: cada empresa vê só as próprias; o admin vê todas. */
(function () {
  'use strict';
  var ST = { scheduled: ['Agendada', ''], live: ['Ao vivo', 'pill--report'], ended: ['Encerrada', 'pill--muted'] };

  function link(slug, host) { var u = new URL('reuniao.html', location.href); u.search = '?s=' + encodeURIComponent(slug); return u.href + (host ? '&host=' + host : ''); }
  async function call(ctx, body) {
    var s = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/meet', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.erro || 'O servidor do Web Meeting não respondeu.');
    return j;
  }
  function copiar(texto, btn, aviso) {
    function feito() {
      if (btn) { var o = btn.textContent; btn.textContent = 'Link copiado ✓'; btn.classList.add('is-copied'); setTimeout(function () { btn.textContent = o; btn.classList.remove('is-copied'); }, 1800); }
      if (aviso) { aviso.textContent = 'Link copiado'; aviso.className = 'portal-alert portal-alert--ok'; setTimeout(function () { aviso.textContent = ''; aviso.className = 'portal-alert'; }, 2500); }
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(feito, function () { window.prompt('Copie o link da sala:', texto); });
    else { window.prompt('Copie o link da sala:', texto); }
  }
  function quando(r, ctx) { return r.scheduled_at ? ctx.fmtDT(r.scheduled_at) : (r.started_at ? 'Iniciada ' + ctx.fmtDT(r.started_at) : 'Instantânea · criada ' + ctx.fmtDT(r.created_at)); }

  async function render(view, ctx, o) {
    o = o || {};
    var esc = ctx.esc, admin = o.scope === 'admin', host = admin ? 'admin' : 'client';
    var filtro = (location.hash.match(/[?&]f=(abertas|encerradas)/) || [])[1] || 'abertas';
    var empresa = (location.hash.match(/[?&]empresa=([a-z0-9-]+)/) || [])[1] || '';
    var qy = ctx.sb.from('meet_rooms').select('*, clients(name)').order('created_at', { ascending: false }).limit(300);
    if (!admin) qy = qy.eq('client_id', o.clientId);
    else if (empresa === 'endeavor') qy = qy.is('client_id', null);
    else if (empresa) qy = qy.eq('client_id', empresa);
    qy = filtro === 'encerradas' ? qy.eq('status', 'ended') : qy.neq('status', 'ended');
    var res = await Promise.all([ctx.q(qy), call(ctx, { acao: 'status' }).catch(function () { return {}; }),
      admin ? ctx.q(ctx.sb.from('meet_access').select('client_id, enabled, clients(name)').eq('enabled', true)) : Promise.resolve([]),
      !admin ? ctx.sb.rpc('meet_usage', { p_client: o.clientId }).then(function (r) { return r.data || {}; }) : Promise.resolve(null),
      !admin ? ctx.sb.from('meet_access').select('*').eq('client_id', o.clientId).maybeSingle().then(function (r) { return r.data || {}; }) : Promise.resolve(null)]);
    var rooms = res[0], status = res[1] || {}, empresas = res[2] || [], uso = res[3], lim = res[4];
    var base = admin ? '#/webmeeting' : '#/webmeeting';
    function hrefF(f, e) { var p = []; if (f !== 'abertas') p.push('f=' + f); if (e) p.push('empresa=' + e); return base + (p.length ? '?' + p.join('&') : ''); }

    view.innerHTML = '<div class="console__head"><div><h1>Web Meeting</h1><p class="portal-muted">' + (admin ? 'Videoconferência da Endeavor e das empresas clientes. Quem cria a sala é o anfitrião; os convidados entram pelo link só com o nome.' : 'Reuniões por vídeo da sua empresa. Crie a sala, entre como anfitrião e mande o link para os convidados: eles entram só com o nome.') + '</p></div>' +
      '<button class="btn btn--navy btn--sm" type="button" id="wm-new">＋ Criar sala</button></div>' +
      (status.configurado === false ? '<div class="portal-alert portal-alert--info">O servidor de vídeo (LiveKit) ainda não foi configurado: as salas abrem em <strong>modo demonstração</strong>, com sua câmera e microfone reais e participantes simulados.</div>' : '') +
      (uso && lim ? '<p class="portal-muted">Neste mês: ' + uso.rooms_month + (lim.max_rooms_month != null ? ' de ' + lim.max_rooms_month : '') + ' salas · ' + uso.minutes_month + (lim.max_minutes_month != null ? ' de ' + lim.max_minutes_month : '') + ' minutos' + (lim.max_participants ? ' · até ' + lim.max_participants + ' participantes por sala' : '') + '</p>' : '') +
      '<div class="portal-alert" id="wm-m" role="status"></div>' +
      '<div class="toolbar"><nav class="subtabs" aria-label="Filtrar salas"><a href="' + hrefF('abertas', empresa) + '"' + (filtro === 'abertas' ? ' aria-current="page"' : '') + '>Agendadas e ao vivo</a><a href="' + hrefF('encerradas', empresa) + '"' + (filtro === 'encerradas' ? ' aria-current="page"' : '') + '>Encerradas</a></nav>' +
      (admin ? '<label class="sr-only" for="wm-emp">Empresa</label><select id="wm-emp"><option value="">Todas as empresas</option><option value="endeavor"' + (empresa === 'endeavor' ? ' selected' : '') + '>Endeavor (interna)</option>' + empresas.map(function (e) { return '<option value="' + e.client_id + '"' + (empresa === e.client_id ? ' selected' : '') + '>' + esc(e.clients ? e.clients.name : e.client_id) + '</option>'; }).join('') + '</select>' : '') + '</div>' +
      (rooms.length ? '<div class="table-wrap portal-card"><table class="data wm-table"><thead><tr><th>Sala</th>' + (admin ? '<th>Empresa</th>' : '') + '<th>Quando</th><th>Status</th><th class="num">Pico</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        rooms.map(function (r) {
          var st = ST[r.status] || [r.status, ''];
          return '<tr><td><strong>' + esc(r.title) + '</strong></td>' + (admin ? '<td>' + (r.client_id ? esc(r.clients ? r.clients.name : '') : '<span class="portal-muted">Endeavor</span>') + '</td>' : '') +
            '<td>' + esc(quando(r, ctx)) + '</td><td><span class="pill ' + st[1] + '">' + (r.status === 'live' ? '● ' : '') + st[0] + '</span></td><td class="num">' + (r.peak_participants || '') + '</td>' +
            '<td><div class="portal-btn-row wm-acts">' + (r.status !== 'ended' ? '<a class="btn btn--gold btn--xs" target="_blank" rel="noopener" href="' + esc(link(r.slug, host)) + '">Entrar</a><button class="btn btn--ghost btn--xs" type="button" data-copy="' + esc(r.slug) + '">Copiar link</button>' : '') +
            '<button class="btn btn--ghost btn--xs" type="button" data-det="' + r.id + '">Detalhes</button>' + (r.status !== 'ended' ? '<button class="btn btn--ghost btn--xs" type="button" data-end="' + r.id + '">Encerrar</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="portal-card empty-state"><p>' + (filtro === 'encerradas' ? 'Nenhuma reunião encerrada ainda.' : 'Nenhuma sala aberta. Crie a primeira com “Criar sala”.') + '</p></div>');

    var m = view.querySelector('#wm-m');
    view.querySelector('#wm-new').onclick = function () { criar(ctx, o, empresas, function () { render(view, ctx, o); }); };
    if (view.querySelector('#wm-emp')) view.querySelector('#wm-emp').onchange = function () { location.hash = hrefF(filtro, this.value); };
    view.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { copiar(link(b.dataset.copy), b, m); }; });
    view.querySelectorAll('[data-det]').forEach(function (b) { b.onclick = function () { detalhes(ctx, rooms.find(function (r) { return r.id === b.dataset.det; }), host); }; });
    view.querySelectorAll('[data-end]').forEach(function (b) {
      b.onclick = async function () {
        var r = rooms.find(function (x) { return x.id === b.dataset.end; });
        if (!confirm('Encerrar a sala “' + r.title + '”? Quem estiver nela sai, e o link deixa de funcionar para os convidados.')) return;
        b.disabled = true;
        try { await call(ctx, { acao: 'encerrar_sala', room_id: r.id }); render(view, ctx, o); } catch (e) { b.disabled = false; ctx.msg(m, e.message, 'error'); }
      };
    });
  }

  function criar(ctx, o, empresas, done) {
    var esc = ctx.esc, admin = o.scope === 'admin';
    var ov = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Criar sala</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="wm-f" novalidate>' +
      '<div class="field"><label for="wm-t">Nome da sala</label><input id="wm-t" required maxlength="120" placeholder="Ex.: Reunião com cliente, alinhamento semanal"></div>' +
      '<fieldset class="wm-kind"><legend>Tipo</legend><label class="check-row"><input type="radio" name="wm-k" value="instant" checked> Instantânea (começa agora)</label><label class="check-row"><input type="radio" name="wm-k" value="scheduled"> Agendada</label></fieldset>' +
      '<div class="field" id="wm-qbox" hidden><label for="wm-q">Data e hora</label><input id="wm-q" type="datetime-local"><p class="portal-muted" style="font-size:.82rem;margin:.3rem 0 0">No seu fuso horário (' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone || '') + ').</p></div>' +
      (admin ? '<div class="field"><label for="wm-c">Para</label><select id="wm-c"><option value="">Endeavor (reunião interna)</option>' + empresas.map(function (e) { return '<option value="' + e.client_id + '">' + esc(e.clients ? e.clients.name : '') + '</option>'; }).join('') + '</select><p class="portal-muted" style="font-size:.82rem;margin:.3rem 0 0">A lista mostra as empresas com o Web Meeting habilitado na ficha do cliente.</p></div>' : '') +
      '<div class="portal-alert" id="wm-fm" role="alert"></div><button class="btn btn--navy" type="submit">Criar sala</button></form>');
    var $o = function (s) { return ov.querySelector(s); };
    ov.querySelectorAll('[name="wm-k"]').forEach(function (r) { r.onchange = function () { $o('#wm-qbox').hidden = $o('[name="wm-k"]:checked').value !== 'scheduled'; }; });
    $o('#wm-t').focus();
    $o('#wm-f').onsubmit = async function (e) {
      e.preventDefault();
      var fm = $o('#wm-fm'), tipo = $o('[name="wm-k"]:checked').value, t = $o('#wm-t').value.trim(), q = $o('#wm-q').value;
      if (t.length < 2) { $o('#wm-t').focus(); return ctx.msg(fm, 'Dê um nome para a sala.', 'error'); }
      if (tipo === 'scheduled' && !q) { $o('#wm-q').focus(); return ctx.msg(fm, 'Informe a data e a hora.', 'error'); }
      var btn = $o('button[type=submit]'); btn.disabled = true;
      try {
        var j = await call(ctx, { acao: 'criar', titulo: t, tipo: tipo, quando: tipo === 'scheduled' ? new Date(q).toISOString() : null, client_id: admin ? ($o('#wm-c').value || null) : o.clientId });
        var url = link(j.sala.slug);
        ov.querySelector('.drawer').innerHTML = '<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Sala criada</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
          '<p><strong>' + esc(j.sala.title) + '</strong>' + (j.sala.scheduled_at ? ' · ' + esc(ctx.fmtDT(j.sala.scheduled_at)) : '') + '</p>' +
          '<div class="field"><label for="wm-l">Link para os convidados</label><input id="wm-l" readonly value="' + esc(url) + '"></div><div class="portal-alert" id="wm-lm" role="status"></div>' +
          '<div class="portal-btn-row"><a class="btn btn--gold" target="_blank" rel="noopener" href="' + esc(link(j.sala.slug, admin ? 'admin' : 'client')) + '">Entrar agora</a><button class="btn btn--navy" type="button" id="wm-cp">Copiar link</button></div>' +
          '<p class="portal-muted" style="font-size:.85rem">Você entra como anfitrião (com o seu login). Quem recebe o link entra como convidado, só com o nome.</p>';
        ov.querySelector('.close-x').onclick = function () { ctx.closeOverlay(); };
        ov.querySelector('#wm-cp').onclick = function () { copiar(url, this, ov.querySelector('#wm-lm')); };
        done();
      } catch (err) { btn.disabled = false; ctx.msg(fm, err.message, 'error'); }
    };
  }

  async function detalhes(ctx, r, host) {
    var esc = ctx.esc;
    var res = await Promise.all([ctx.q(ctx.sb.from('meet_participants').select('*').eq('room_id', r.id).order('joined_at')),
      ctx.q(ctx.sb.from('meet_recordings').select('*').eq('room_id', r.id).order('started_at', { ascending: false })),
      ctx.q(ctx.sb.from('meet_summaries').select('*').eq('room_id', r.id).order('created_at', { ascending: false }))]);
    var ps = res[0], recs = res[1], sums = res[2];
    function dur(a, b) { var s = Math.max(0, Math.round((new Date(b || Date.now()) - new Date(a)) / 1000)); return Math.floor(s / 60) + ' min'; }
    var ov = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(r.title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<p class="portal-muted">' + esc((ST[r.status] || [r.status])[0]) + (r.started_at ? ' · início ' + esc(ctx.fmtDT(r.started_at)) : '') + (r.ended_at ? ' · fim ' + esc(ctx.fmtDT(r.ended_at)) : '') + '</p>' +
      (r.status !== 'ended' ? '<div class="field"><label for="wm-dl">Link da sala</label><input id="wm-dl" readonly value="' + esc(link(r.slug)) + '"></div><div class="portal-btn-row"><a class="btn btn--gold btn--sm" target="_blank" rel="noopener" href="' + esc(link(r.slug, host)) + '">Entrar</a><button class="btn btn--ghost btn--sm" type="button" id="wm-dc">Copiar link</button></div><div class="portal-alert" id="wm-dm" role="status"></div>' : '') +
      '<h3 class="portal-h2" style="margin-top:1.25rem">Gravações</h3>' + (recs.filter(function (g) { return g.kind === 'recording'; }).length ? '<ul class="ag-list">' + recs.filter(function (g) { return g.kind === 'recording'; }).map(function (g) {
        return '<li class="ag-item"><div><strong>' + esc(ctx.fmtDT(g.started_at)) + '</strong><div class="portal-muted" style="font-size:.85rem">' + (g.status === 'complete' ? (g.duration_seconds ? Math.round(g.duration_seconds / 60) + ' min · ' : '') + 'pronta' : g.status === 'active' ? 'gravando ou processando' : 'falhou') + ' · ' + esc(g.started_by || '') + '</div></div>' +
          (g.status === 'complete' && g.file_path ? '<button class="btn btn--navy btn--xs" type="button" data-rec="' + g.id + '">Baixar vídeo</button>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="portal-muted">Nenhuma gravação.</p>') +
      '<h3 class="portal-h2" style="margin-top:1.25rem">Resumos da IA</h3>' + (sums.length ? sums.map(function (s) { return '<details class="wm-sum"><summary>' + esc(ctx.fmtDT(s.created_at)) + '</summary><pre>' + esc(s.summary) + '</pre><button class="btn btn--ghost btn--xs" type="button" data-sum="' + s.id + '">Copiar resumo</button></details>'; }).join('') : '<p class="portal-muted">Nenhum resumo. O anfitrião gera o resumo dentro da sala, no menu Mais › Resumo da reunião.</p>') +
      '<h3 class="portal-h2" style="margin-top:1.25rem">Participantes (' + ps.length + ')</h3>' + (ps.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Nome</th><th>Papel</th><th>Entrou</th><th>Tempo</th></tr></thead><tbody>' + ps.map(function (p) {
        return '<tr><td>' + esc(p.name || p.identity) + '</td><td>' + (p.role === 'host' ? 'Anfitrião' : 'Convidado') + '</td><td>' + esc(ctx.fmtDT(p.joined_at)) + '</td><td>' + dur(p.joined_at, p.left_at) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Ninguém entrou ainda.</p>'));
    ov.querySelector('.drawer').classList.add('drawer--wide');
    if (ov.querySelector('#wm-dc')) ov.querySelector('#wm-dc').onclick = function () { copiar(link(r.slug), this, ov.querySelector('#wm-dm')); };
    ov.querySelectorAll('[data-sum]').forEach(function (b) { b.onclick = function () { var s = sums.find(function (x) { return x.id === b.dataset.sum; }); if (navigator.clipboard) navigator.clipboard.writeText(s.summary).then(function () { b.textContent = 'Copiado ✓'; }); }; });
    ov.querySelectorAll('[data-rec]').forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { var j = await call(ctx, { acao: 'gravacao_url', recording_id: b.dataset.rec }); window.open(j.url, '_blank', 'noopener'); } catch (e) { alert(e.message); }
        b.disabled = false;
      };
    });
  }

  window.EMeetPanel = { render: render, link: link };
})();
