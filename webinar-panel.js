/* Endeavor Live Webinar · painel (admin e Portal do Cliente), menu "Live Webinar".
 *   EWebinarPanel.render(view, ctx, { scope: 'admin'|'client', clientId? })
 * Abas: Webinars (lista, criar) e Apresentações (Studio). Um webinar abre em #/webinar?id=<id> com quatro partes:
 * Configurar (apresentação publicada, data, contador, assistente, convites, agendamento), Perguntas frequentes (geradas
 * pela IA e revisadas por você), Ao vivo (estado real, pessoas assistindo, pausar/retomar/encerrar, moderação, responder
 * como equipe) e Relatório (inscritos, presença, tempo assistido, saídas por slide, perguntas, leads e agendamentos). */
(function () {
  'use strict';
  var TZS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'America/Asuncion', 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'Europe/Lisbon', 'Europe/Madrid'];
  var ESTADOS = { draft: ['Rascunho', ''], scheduled: ['Agendado', 'pill--report'], antes: ['Agendado', 'pill--report'], ao_vivo: ['Ao vivo', 'pill--live'], pausado: ['Pausado', 'pill--warn'], encerrado: ['Encerrado', ''], cancelled: ['Cancelado', 'pill--muted'] };

  function api(ctx) {
    return async function (body) {
      var s = (await ctx.sb.auth.getSession()).data.session;
      var r = await fetch(ctx.CFG.functionsUrl + '/webinar', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) { var e = new Error(j.erro || 'O servidor do Live Webinar não respondeu.'); e.status = r.status; throw e; }
      return j;
    };
  }
  function abas(atual) {
    return '<nav class="subtabs" aria-label="Live Webinar"><a href="#/webinar"' + (atual === 'lista' ? ' aria-current="page"' : '') + '>Webinars</a><a href="#/webinar?aba=studio"' + (atual === 'studio' ? ' aria-current="page"' : '') + '>Apresentações (Studio)</a></nav>';
  }
  function param(n) { var m = location.hash.match(new RegExp('[?&]' + n + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : ''; }
  function localInput(iso, tz) {
    // "AAAA-MM-DDTHH:MM" no fuso do webinar, para o campo datetime-local
    var p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute;
  }
  function deLocal(v, tz) {
    // converte "AAAA-MM-DDTHH:MM" no fuso escolhido para ISO (UTC), corrigindo a diferença do fuso naquela data
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return '';
    var palpite = new Date(v + ':00Z').getTime();
    for (var k = 0; k < 3; k++) { var visto = new Date(localInput(new Date(palpite).toISOString(), tz) + ':00Z').getTime(); palpite += new Date(v + ':00Z').getTime() - visto; }
    return new Date(palpite).toISOString();
  }
  function quando(iso, tz) { try { return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)); } catch (e) { return iso; } }
  function mmss(ms) { var s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function pill(est) { var e = ESTADOS[est] || [est, '']; return '<span class="pill ' + e[1] + '">' + e[0] + '</span>'; }

  async function render(view, ctx, o) {
    o = o || {};
    if (param('aba') === 'studio') {
      if (!window.EMeetStudio) throw new Error('O Studio não carregou. Recarregue a página.');
      await window.EMeetStudio.render(view, ctx, Object.assign({ hashBase: '#/webinar?aba=studio' }, o));
      view.insertAdjacentHTML('afterbegin', abas('studio'));
      return;
    }
    if (param('id')) return detalhe(view, ctx, o, param('id'));
    return lista(view, ctx, o);
  }

  /* ---------------- lista ---------------- */
  async function lista(view, ctx, o) {
    var esc = ctx.esc, admin = o.scope === 'admin', call = api(ctx);
    var empresa = param('empresa');
    view.innerHTML = abas('lista') + '<p class="portal-muted">Carregando…</p>';
    var res = await Promise.all([call({ acao: 'lw_listar', client_id: admin ? empresa : o.clientId }), admin ? ctx.q(ctx.sb.from('meet_access').select('client_id, clients(name)').eq('enabled', true)) : Promise.resolve([])]);
    var ws = res[0].webinars || [], empresas = res[1] || [];
    view.innerHTML = abas('lista') + '<div class="console__head"><div><h1>Live Webinar</h1><p class="portal-muted">Webinars agendados com uma apresentação do Studio. O chat tem assistente de IA (sempre identificado como IA), perguntas frequentes, caixa privada para contatos e agendamento na agenda real, e relatório de audiência.</p></div>' +
      '<button class="btn btn--navy btn--sm" type="button" id="lw-new">＋ Novo webinar</button></div>' +
      (admin ? '<div class="toolbar"><label class="sr-only" for="lw-emp">Empresa</label><select id="lw-emp"><option value="">Todas as empresas</option><option value="endeavor"' + (empresa === 'endeavor' ? ' selected' : '') + '>Endeavor (interna)</option>' + empresas.map(function (e) { return '<option value="' + e.client_id + '"' + (empresa === e.client_id ? ' selected' : '') + '>' + esc(e.clients ? e.clients.name : '') + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="portal-alert" id="lw-m" role="status"></div>' +
      (ws.length ? '<div class="table-wrap portal-card"><table class="data"><thead><tr><th>Webinar</th>' + (admin ? '<th>Empresa</th>' : '') + '<th>Quando</th><th>Situação</th><th class="num">Inscritos</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        ws.map(function (w) {
          return '<tr><td><strong>' + esc(w.titulo) + '</strong></td>' + (admin ? '<td>' + esc(w.empresa) + '</td>' : '') + '<td>' + esc(quando(w.starts_at, w.timezone)) + '</td><td>' + pill(w.status === 'scheduled' ? w.estado : w.status) + '</td><td class="num">' + w.inscritos + '</td>' +
            '<td><div class="portal-btn-row"><a class="btn btn--gold btn--xs" href="#/webinar?id=' + w.id + '">Abrir</a>' + (w.status === 'scheduled' ? '<button class="btn btn--ghost btn--xs" type="button" data-copy="' + esc(w.link) + '">Copiar link</button>' : '') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="portal-card empty-state"><p>Nenhum webinar ainda. Prepare a apresentação em “Apresentações (Studio)”, publique, e depois crie o webinar aqui.</p></div>');
    var m = view.querySelector('#lw-m');
    if (view.querySelector('#lw-emp')) view.querySelector('#lw-emp').onchange = function () { location.hash = '#/webinar' + (this.value ? '?empresa=' + this.value : ''); };
    view.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { copiar(b.dataset.copy, m, ctx); }; });
    view.querySelector('#lw-new').onclick = function () { novo(ctx, o, empresas); };
  }
  function copiar(t, m, ctx) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { ctx.msg(m, 'Link copiado: ' + t, 'ok'); }, function () { ctx.msg(m, t, 'ok'); });
  }

  function novo(ctx, o, empresas) {
    var esc = ctx.esc, admin = o.scope === 'admin', call = api(ctx);
    var amanha = new Date(Date.now() + 86400000); amanha.setMinutes(0, 0, 0);
    var tzLocal = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'America/New_York'; } })();
    var tzs = TZS.indexOf(tzLocal) < 0 ? [tzLocal].concat(TZS) : TZS;
    var ov = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Novo webinar</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="lw-nf" novalidate><div class="field"><label for="lw-nt">Título</label><input id="lw-nt" required maxlength="140" placeholder="Ex.: Como abrir sua LLC nos Estados Unidos"></div>' +
      (admin ? '<div class="field"><label for="lw-nc">Empresa</label><select id="lw-nc"><option value="endeavor">Endeavor (interna)</option>' + empresas.map(function (e) { return '<option value="' + e.client_id + '">' + esc(e.clients ? e.clients.name : '') + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="field"><label for="lw-ns">Apresentação (publicada no Studio)</label><select id="lw-ns"><option value="">Carregando…</option></select></div>' +
      '<div class="field-row"><div class="field"><label for="lw-nd">Data e hora</label><input id="lw-nd" type="datetime-local" required></div><div class="field"><label for="lw-nz">Fuso horário</label><select id="lw-nz">' + tzs.map(function (z) { return '<option' + (z === tzLocal ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="portal-alert" id="lw-nm" role="alert"></div><button class="btn btn--navy" type="submit">Criar e configurar</button></form>');
    var $o = function (s) { return ov.querySelector(s); };
    $o('#lw-nd').value = localInput(amanha.toISOString(), $o('#lw-nz').value);
    async function carregarApres() {
      var sel = $o('#lw-ns');
      try {
        var j = await call({ acao: 'lw_novo_dados', client_id: admin ? $o('#lw-nc').value : o.clientId });
        sel.innerHTML = j.apresentacoes.length ? j.apresentacoes.map(function (a) { return '<option value="' + a.id + '">' + esc(a.titulo) + ' (v' + a.versao + ', ' + a.slides + ' slides)</option>'; }).join('')
          : '<option value="">Nenhuma apresentação publicada nesta empresa</option>';
      } catch (e) { sel.innerHTML = '<option value="">' + esc(e.message) + '</option>'; }
    }
    carregarApres(); if ($o('#lw-nc')) $o('#lw-nc').onchange = carregarApres;
    $o('#lw-nt').focus();
    $o('#lw-nf').onsubmit = async function (e) {
      e.preventDefault();
      var btn = $o('button[type=submit]'); btn.disabled = true;
      try {
        var tz = $o('#lw-nz').value;
        var j = await call({ acao: 'lw_salvar', titulo: $o('#lw-nt').value, client_id: admin ? $o('#lw-nc').value : o.clientId, studio_id: $o('#lw-ns').value || null, starts_at: deLocal($o('#lw-nd').value, tz), timezone: tz });
        ctx.closeOverlay(); location.hash = '#/webinar?id=' + j.webinar.id;
      } catch (err) { btn.disabled = false; ctx.msg($o('#lw-nm'), err.message, 'error'); }
    };
  }

  /* ---------------- detalhe ---------------- */
  var vivoTimer = null;
  async function detalhe(view, ctx, o, id, aviso) {
    var esc = ctx.esc, call = api(ctx);
    clearInterval(vivoTimer);
    var parte = param('parte') || 'config';
    view.innerHTML = '<p class="portal-muted">Carregando…</p>';
    var j = await call({ acao: 'lw_obter', id: id }), W = j.webinar, aps = j.apresentacoes;
    var base = '#/webinar?id=' + W.id;
    view.innerHTML = abas('lista') +
      '<p><a href="#/webinar">← Webinars</a></p><div class="console__head"><div><h1>' + esc(W.titulo) + '</h1><p class="portal-muted">' + esc(quando(W.starts_at, W.timezone)) + ' · ' + mmss(W.duracao_ms) + ' · ' + pill(W.estado) + '</p></div>' +
      '<div class="portal-btn-row">' + (W.status === 'scheduled' ? '<button class="btn btn--ghost btn--sm" type="button" id="lw-copy">Copiar link de inscrição</button><a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + esc(W.link) + '">Abrir página</a>' : '') +
      '<button class="btn btn--ghost btn--sm" type="button" id="lw-rep">Repetir em outra data</button>' + (W.status !== 'cancelled' ? '<button class="btn btn--ghost btn--sm" type="button" id="lw-can">Cancelar</button>' : '') + '<button class="btn btn--ghost btn--sm" type="button" id="lw-del">Apagar</button></div></div>' +
      '<nav class="subtabs lw-partes" aria-label="Partes do webinar">' + [['config', 'Configurar'], ['faq', 'Perguntas frequentes'], ['vivo', 'Ao vivo'], ['relatorio', 'Relatório']].map(function (p) { return '<a href="' + base + '&parte=' + p[0] + '"' + (parte === p[0] ? ' aria-current="page"' : '') + '>' + p[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="portal-alert" id="lw-m" role="status"></div><div id="lw-corpo"></div>';
    var m = view.querySelector('#lw-m'), corpo = view.querySelector('#lw-corpo');
    if (aviso) ctx.msg(m, aviso, 'ok');
    if (view.querySelector('#lw-copy')) view.querySelector('#lw-copy').onclick = function () { copiar(W.link, m, ctx); };
    view.querySelector('#lw-rep').onclick = function () {
      var v = prompt('Data e hora da nova sessão (AAAA-MM-DD HH:MM, no fuso ' + W.timezone + '):', localInput(new Date(Date.now() + 7 * 86400000).toISOString(), W.timezone).replace('T', ' '));
      if (!v) return;
      call({ acao: 'lw_duplicar', id: W.id, starts_at: deLocal(v.trim().replace(' ', 'T'), W.timezone) }).then(function (r) { location.hash = '#/webinar?id=' + r.webinar.id; }, function (e) { ctx.msg(m, e.message, 'error'); });
    };
    if (view.querySelector('#lw-can')) view.querySelector('#lw-can').onclick = function () { if (confirm('Cancelar este webinar? Quem estiver inscrito verá que foi cancelado.')) call({ acao: 'lw_cancelar', id: W.id }).then(function () { detalhe(view, ctx, o, id); }, function (e) { ctx.msg(m, e.message, 'error'); }); };
    view.querySelector('#lw-del').onclick = function () { if (confirm('Apagar este webinar? Ele sai da lista e o link para de funcionar.')) call({ acao: 'lw_apagar', id: W.id }).then(function () { location.hash = '#/webinar'; }, function (e) { ctx.msg(m, e.message, 'error'); }); };
    ({ config: config, faq: faq, vivo: vivo, relatorio: relatorio })[parte] ? ({ config: config, faq: faq, vivo: vivo, relatorio: relatorio })[parte]() : config();

    function config() {
      var s = W.settings, bloqueado = W.status === 'scheduled' && W.estado !== 'antes';
      var tzs = TZS.indexOf(W.timezone) < 0 ? [W.timezone].concat(TZS) : TZS;
      corpo.innerHTML = '<form class="portal-card portal-form lw-cfg" id="lw-cf" novalidate>' +
        (bloqueado ? '<p class="portal-alert">O webinar já começou: a apresentação e o horário não mudam mais. As outras opções valem na hora.</p>' : '') +
        '<div class="field"><label for="lw-t">Título</label><input id="lw-t" maxlength="140" value="' + esc(W.titulo) + '"></div>' +
        '<div class="field"><label for="lw-d">Descrição (aparece na página de inscrição)</label><textarea id="lw-d" rows="3" maxlength="2000">' + esc(W.descricao) + '</textarea></div>' +
        '<div class="field"><label for="lw-s">Apresentação (publicada no Studio)</label><select id="lw-s"' + (bloqueado ? ' disabled' : '') + '><option value="">Escolha…</option>' + aps.map(function (a) { return '<option value="' + a.id + '"' + (a.id === W.studio_id ? ' selected' : '') + '>' + esc(a.titulo) + ' (v' + a.versao + ', ' + a.slides + ' slides)</option>'; }).join('') + '</select>' +
        (W.status === 'scheduled' ? '<p class="portal-muted" style="font-size:.85rem">Agendado com a versão ' + W.studio_version + ' (' + W.slides.length + ' slides, ' + W.narracoes + ' com narração). Se publicar uma versão nova no Studio, clique em Agendar de novo para usá-la.</p>' : '') + '</div>' +
        '<div class="field-row"><div class="field"><label for="lw-dt">Data e hora</label><input id="lw-dt" type="datetime-local" value="' + localInput(W.starts_at, W.timezone) + '"' + (bloqueado ? ' disabled' : '') + '></div>' +
        '<div class="field"><label for="lw-z">Fuso horário</label><select id="lw-z"' + (bloqueado ? ' disabled' : '') + '>' + tzs.map(function (z) { return '<option' + (z === W.timezone ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="lw-i">Idioma da página e do assistente</label><select id="lw-i">' + [['pt-BR', 'Português'], ['en-US', 'Inglês'], ['es-ES', 'Espanhol']].map(function (x) { return '<option value="' + x[0] + '"' + (s.idioma === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div></div>' +
        '<fieldset><legend>Público</legend><div class="field-row"><div class="field"><label for="lw-cm">Mostrar o contador a partir de</label><input id="lw-cm" type="number" min="0" max="100000" value="' + s.contador_minimo + '"><p class="portal-muted" style="font-size:.82rem">O contador mostra sempre o número real de pessoas assistindo. Abaixo desse número, ele fica escondido.</p></div>' +
        '<div class="field"><label for="lw-ca">O chat abre (minutos antes)</label><input id="lw-ca" type="number" min="0" max="120" value="' + s.chat_abre_min + '"></div></div></fieldset>' +
        '<fieldset><legend>Assistente de IA no chat</legend>' +
        chk('lw-ia', s.chat_ia, 'Responder às perguntas no chat (sempre identificado como IA)') + chk('lw-bv', s.boas_vindas, 'Mensagem de boas-vindas no início') +
        chk('lw-fq', s.faq, 'Publicar as perguntas frequentes aprovadas ao longo da apresentação (aparecem como “Pergunta frequente”)') + chk('lw-ct', s.cta_final, 'Convite final para falar em particular') +
        '<div class="field"><span class="lw-rot">Convidar o público a perguntar nestes slides</span><div class="lw-slides-chk">' + (W.slides.length ? W.slides.map(function (sl, i) { return '<label><input type="checkbox" value="' + i + '"' + (s.convites.indexOf(i) >= 0 ? ' checked' : '') + '> ' + (i + 1) + '. ' + esc(sl.titulo || 'Slide') + '</label>'; }).join('') : '<p class="portal-muted">Agende para ver os slides aqui.</p>') + '</div></div>' +
        '<div class="field"><label for="lw-tb">Texto de boas-vindas (opcional)</label><input id="lw-tb" maxlength="300" value="' + esc(s.texto_boas_vindas) + '"></div>' +
        '<div class="field"><label for="lw-tc">Texto do convite para perguntar (opcional)</label><input id="lw-tc" maxlength="300" value="' + esc(s.texto_convite) + '"></div>' +
        '<div class="field"><label for="lw-tf">Texto do convite final (opcional)</label><input id="lw-tf" maxlength="300" value="' + esc(s.texto_cta) + '"></div></fieldset>' +
        '<fieldset><legend>Caixa privada: contatos e agendamento</legend><div class="field"><label for="lw-ag">Depois que a pessoa deixa os contatos</label><select id="lw-ag">' +
        [['calendario', 'Mostrar os horários livres da agenda e marcar na hora'], ['link', 'Só mandar o link de agendamento (chat e e-mail)'], ['nenhum', 'Só registrar o contato no CRM']].map(function (x) { return '<option value="' + x[0] + '"' + (s.agendamento === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
        '<p class="portal-muted" style="font-size:.82rem">Os contatos só entram no CRM com a autorização da pessoa. Os horários vêm da agenda real, e a confirmação sai pelo chat privado e por e-mail (e por WhatsApp, quando estiver ligado).</p></div></fieldset>' +
        '<div class="portal-alert" id="lw-cfm" role="alert"></div><div class="portal-btn-row"><button class="btn btn--ghost" type="submit">Salvar</button><button class="btn btn--navy" type="button" id="lw-ag-btn">' + (W.status === 'scheduled' ? 'Agendar de novo (atualizar apresentação)' : 'Agendar e abrir inscrições') + '</button></div></form>';
      var f = corpo.querySelector('#lw-cf'), cm = corpo.querySelector('#lw-cfm');
      function dados() {
        var tz = f.querySelector('#lw-z').value;
        return { acao: 'lw_salvar', id: W.id, version: W.version, titulo: f.querySelector('#lw-t').value, descricao: f.querySelector('#lw-d').value, studio_id: f.querySelector('#lw-s').value || null,
          starts_at: deLocal(f.querySelector('#lw-dt').value, tz), timezone: tz,
          settings: { idioma: f.querySelector('#lw-i').value, contador_minimo: Number(f.querySelector('#lw-cm').value), chat_abre_min: Number(f.querySelector('#lw-ca').value),
            chat_ia: f.querySelector('#lw-ia').checked, boas_vindas: f.querySelector('#lw-bv').checked, faq: f.querySelector('#lw-fq').checked, cta_final: f.querySelector('#lw-ct').checked,
            convites: Array.prototype.map.call(f.querySelectorAll('.lw-slides-chk input:checked'), function (x) { return Number(x.value); }),
            texto_boas_vindas: f.querySelector('#lw-tb').value, texto_convite: f.querySelector('#lw-tc').value, texto_cta: f.querySelector('#lw-tf').value, agendamento: f.querySelector('#lw-ag').value } };
      }
      async function salvar() { var r = await call(dados()); W = r.webinar; return W; }
      f.onsubmit = async function (e) { e.preventDefault(); try { await salvar(); ctx.msg(cm, 'Salvo.', 'ok'); } catch (err) { ctx.msg(cm, err.message, 'error'); } };
      corpo.querySelector('#lw-ag-btn').onclick = async function () {
        var b = this; b.disabled = true;
        try { await salvar(); var r = await call({ acao: 'lw_agendar', id: W.id }); W = r.webinar; detalhe(view, ctx, o, id, 'Agendado. Inscrições abertas em ' + W.link + (r.aviso ? ' · ' + r.aviso : '')); }
        catch (err) { b.disabled = false; ctx.msg(cm, err.message, 'error'); }
      };
    }
    function chk(id, on, rot) { return '<label class="lw-chk" for="' + id + '"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + rot + '</label>'; }

    function faq() {
      var lista = (W.faq || []).slice();
      corpo.innerHTML = '<div class="portal-card"><p class="portal-muted">Perguntas que costumam surgir sobre o tema. Elas entram no chat ao longo da apresentação, marcadas como “Pergunta frequente” (não aparecem como alguém do público). Revise, edite ou desmarque antes do webinar.</p>' +
        '<div class="portal-btn-row"><button class="btn btn--ghost btn--sm" type="button" id="lw-fg">✦ Gerar com IA a partir da apresentação</button><button class="btn btn--ghost btn--sm" type="button" id="lw-fa">＋ Adicionar</button></div><div id="lw-fl" class="lw-faq-lista"></div>' +
        '<div class="portal-alert" id="lw-fm" role="alert"></div><button class="btn btn--navy" type="button" id="lw-fs">Salvar perguntas</button></div>';
      var fl = corpo.querySelector('#lw-fl'), fm = corpo.querySelector('#lw-fm');
      function desenhar() {
        fl.innerHTML = lista.length ? lista.map(function (f, i) {
          return '<div class="lw-faq-item" data-i="' + i + '"><div class="field-row"><div class="field"><label>No slide</label><select data-k="slide">' + (W.slides.length ? W.slides : [{ titulo: '1' }]).map(function (s, k) { return '<option value="' + k + '"' + (f.slide === k ? ' selected' : '') + '>' + (k + 1) + '. ' + esc(s.titulo || '') + '</option>'; }).join('') + '</select></div>' +
            '<label class="lw-chk"><input type="checkbox" data-k="aprovada"' + (f.aprovada !== false ? ' checked' : '') + '> Aprovada</label><button class="btn btn--ghost btn--xs" type="button" data-del>Remover</button></div>' +
            '<div class="field"><label>Pergunta</label><input data-k="pergunta" maxlength="200" value="' + esc(f.pergunta) + '"></div><div class="field"><label>Resposta</label><textarea data-k="resposta" rows="2" maxlength="700">' + esc(f.resposta) + '</textarea></div></div>';
        }).join('') : '<p class="portal-muted">Nenhuma pergunta ainda.</p>';
        fl.querySelectorAll('.lw-faq-item').forEach(function (it) {
          var i = Number(it.dataset.i);
          it.querySelectorAll('[data-k]').forEach(function (x) { x.oninput = x.onchange = function () { lista[i][x.dataset.k] = x.type === 'checkbox' ? x.checked : x.dataset.k === 'slide' ? Number(x.value) : x.value; }; });
          it.querySelector('[data-del]').onclick = function () { lista.splice(i, 1); desenhar(); };
        });
      }
      desenhar();
      corpo.querySelector('#lw-fa').onclick = function () { lista.push({ slide: 0, pergunta: '', resposta: '', aprovada: true }); desenhar(); };
      corpo.querySelector('#lw-fg').onclick = async function () {
        if (lista.length && !confirm('Substituir as perguntas atuais pelas da IA?')) return;
        var b = this; b.disabled = true; b.textContent = 'Gerando…';
        try { var r = await call({ acao: 'lw_ia_plano', id: W.id }); lista = r.faq; W.faq = r.faq; desenhar(); ctx.msg(fm, 'Pronto. Revise e salve.', 'ok'); }
        catch (e) { ctx.msg(fm, e.message, 'error'); }
        b.disabled = false; b.textContent = '✦ Gerar com IA a partir da apresentação';
      };
      corpo.querySelector('#lw-fs').onclick = async function () {
        try { var r = await call({ acao: 'lw_plano_salvar', id: W.id, faq: lista }); W.faq = lista = r.faq; desenhar(); ctx.msg(fm, 'Salvo.', 'ok'); } catch (e) { ctx.msg(fm, e.message, 'error'); }
      };
    }

    function vivo() {
      var desde = 0, versao = W.version, regsNome = {};
      corpo.innerHTML = '<div class="lw-vivo"><div class="portal-card lw-vivo-estado"><div class="lw-kpis" id="lw-k"></div><div class="portal-btn-row" id="lw-ctl"></div><p class="portal-muted" style="font-size:.82rem">Pausar, retomar e encerrar valem para todos em poucos segundos. Dois comandos ao mesmo tempo não se atropelam: o segundo é recusado.</p></div>' +
        '<div class="portal-card"><h2 class="portal-h2">Chat aberto</h2><ol class="lw-feed" id="lw-pub"></ol><form id="lw-rp" class="lw-resp"><input maxlength="1000" placeholder="Responder a todos como equipe…" aria-label="Responder a todos como equipe"><button class="btn btn--navy btn--sm">Enviar</button></form></div>' +
        '<div class="portal-card"><h2 class="portal-h2">Caixas privadas</h2><ol class="lw-feed" id="lw-priv"></ol></div></div>';
      var pub = corpo.querySelector('#lw-pub'), priv = corpo.querySelector('#lw-priv');
      corpo.querySelector('#lw-rp').onsubmit = async function (e) {
        e.preventDefault(); var i = this.querySelector('input'); if (!i.value.trim()) return;
        try { await call({ acao: 'lw_anfitriao', id: W.id, texto: i.value }); i.value = ''; tique(); } catch (err) { ctx.msg(m, err.message, 'error'); }
      };
      function item(x) {
        var li = document.createElement('li'); li.className = 'lw-fi lw-fi--' + x.autor + (x.oculto ? ' oculto' : ''); li.dataset.id = x.id;
        var quem = x.autor === 'ia' ? 'Assistente (IA)' : x.autor === 'faq' ? 'Pergunta frequente' : x.nome || x.autor;
        li.innerHTML = '<p><strong>' + esc(quem) + '</strong> <time>' + esc(new Date(x.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) + '</time></p><p>' + esc(x.texto) + '</p>' +
          (x.extra && x.extra.resposta ? '<p class="portal-muted">↳ ' + esc(x.extra.resposta) + '</p>' : '');
        var acoes = document.createElement('div'); acoes.className = 'lw-fi-acoes';
        if (x.canal === 'publico' && x.autor !== 'sistema') { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--ghost btn--xs'; b.textContent = x.oculto ? 'Mostrar' : 'Ocultar'; b.onclick = function () { call({ acao: 'lw_moderar', id: W.id, msg_id: x.id, oculto: !x.oculto }).then(function () { x.oculto = !x.oculto; li.replaceWith(item(x)); }); }; acoes.appendChild(b); }
        if (x.canal === 'privado' && x.registration_id) { var r = document.createElement('button'); r.type = 'button'; r.className = 'btn btn--ghost btn--xs'; r.textContent = 'Responder em particular'; r.onclick = function () { var t = prompt('Mensagem particular para ' + (regsNome[x.registration_id] || 'o participante') + ':'); if (t) call({ acao: 'lw_anfitriao', id: W.id, texto: t, registration_id: x.registration_id }).then(tique, function (e) { ctx.msg(m, e.message, 'error'); }); }; acoes.appendChild(r); }
        li.appendChild(acoes);
        return li;
      }
      function controles(r) {
        var c = corpo.querySelector('#lw-ctl'); c.innerHTML = '';
        var bt = function (rot, cmd, extra, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--sm ' + (cls || 'btn--ghost'); b.textContent = rot; b.onclick = async function () {
          if (cmd === 'encerrar' && !confirm('Encerrar o webinar para todos agora?')) return;
          b.disabled = true; try { await call(Object.assign({ acao: 'lw_controle', id: W.id, comando: cmd, version: versao }, extra || {})); } catch (e) { ctx.msg(m, e.message, 'error'); } tique(); }; c.appendChild(b); };
        if (r.estado === 'ao_vivo') bt('❚❚ Pausar', 'pausar');
        if (r.estado === 'pausado') bt('▶ Retomar', 'retomar', null, 'btn--navy');
        if (r.estado === 'ao_vivo' || r.estado === 'pausado') bt('■ Encerrar', 'encerrar');
        bt(r.ia_pausada ? '▶ Ligar o assistente de IA' : '❚❚ Pausar o assistente de IA', 'ia', { pausada: !r.ia_pausada });
      }
      async function tique() {
        if (!corpo.isConnected) { clearInterval(vivoTimer); return; }
        try {
          var r = await call({ acao: 'lw_aovivo', id: W.id, desde: desde }); versao = r.version;
          corpo.querySelector('#lw-k').innerHTML = kpi('Situação', (ESTADOS[r.estado] || [r.estado])[0]) + kpi('Assistindo agora', r.ao_vivo + (r.ao_vivo < r.contador_minimo ? ' <small>(contador escondido até ' + r.contador_minimo + ')</small>' : '')) +
            kpi('Slide', r.estado === 'antes' ? '—' : (r.slide + 1) + ' de ' + W.slides.length) + kpi('Tempo', mmss(r.pos) + ' / ' + mmss(r.total)) + kpi('Assistente', r.ia_pausada ? 'pausado' : 'ligado');
          controles(r);
          r.mensagens.forEach(function (x) {
            if (x.autor === 'participante' && x.registration_id && x.canal === 'privado') regsNome[x.registration_id] = x.nome;
            var lista = x.canal === 'publico' ? pub : priv, velho = lista.querySelector('[data-id="' + x.id + '"]');
            if (velho) velho.replaceWith(item(x)); else lista.appendChild(item(x));
            desde = Math.max(desde, x.id);
          });
          if (r.mensagens.length) { pub.scrollTop = pub.scrollHeight; priv.scrollTop = priv.scrollHeight; }
        } catch (e) { ctx.msg(m, e.message, 'error'); }
      }
      tique(); vivoTimer = setInterval(tique, 4000);
    }
    function kpi(rot, v) { return '<div class="lw-kpi"><span>' + rot + '</span><strong>' + v + '</strong></div>'; }

    async function relatorio() {
      corpo.innerHTML = '<p class="portal-muted">Calculando…</p>';
      var r;
      try { r = await call({ acao: 'lw_relatorio', id: W.id }); } catch (e) { corpo.innerHTML = ''; ctx.msg(m, e.message, 'error'); return; }
      corpo.innerHTML = '<div class="lw-kpis lw-kpis--grande">' + kpi('Inscritos', r.inscritos) + kpi('Participaram', r.participantes + ' <small>(' + r.comparecimento_pct + '%)</small>') + kpi('Pico ao mesmo tempo', r.pico_simultaneo) +
        kpi('Tempo médio', r.media_min + ' min') + kpi('Até o fim', r.ficaram_ate_o_fim) + kpi('Saíram antes', r.sairam_antes) + kpi('Perguntas', r.perguntas) + kpi('Leads', r.leads) + kpi('Agendamentos', r.agendamentos) + '</div>' +
        '<div class="portal-card"><h2 class="portal-h2">Retenção por slide</h2><p class="portal-muted" style="font-size:.85rem">Porcentagem de quem participou e ainda estava assistindo no começo de cada slide; o número à direita é quantas pessoas saíram durante aquele slide.</p><div class="lw-ret">' +
        r.retencao.map(function (x, i) { return '<div class="lw-ret-l"><span class="lw-ret-n">' + (i + 1) + '. ' + esc(r.slides[i] || '') + '</span><span class="lw-ret-bar"><i style="width:' + x.pct + '%"></i></span><span class="lw-ret-v">' + x.pct + '%</span><span class="lw-ret-s">' + (r.saidas[i].n ? '−' + r.saidas[i].n : '') + '</span></div>'; }).join('') + '</div></div>' +
        '<div class="portal-card"><div class="portal-btn-row" style="justify-content:space-between"><h2 class="portal-h2">Pessoas</h2><button class="btn btn--ghost btn--sm" type="button" id="lw-csv">Baixar CSV</button></div><div class="table-wrap"><table class="data"><thead><tr><th>Nome</th><th>E-mail</th><th class="num">Minutos</th><th class="num">Assistiu</th><th class="num">Perguntas</th><th>Lead</th><th>Agendou</th></tr></thead><tbody>' +
        (r.pessoas.length ? r.pessoas.map(function (p) { return '<tr><td>' + esc(p.nome) + '</td><td>' + esc(p.email) + '</td><td class="num">' + p.minutos + '</td><td class="num">' + p.assistiu_pct + '%</td><td class="num">' + p.perguntas + '</td><td>' + (p.lead ? 'Sim' : '') + '</td><td>' + (p.agendou ? 'Sim' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="portal-muted">Ninguém inscrito ainda.</td></tr>') +
        '</tbody></table></div></div>';
      corpo.querySelector('#lw-csv').onclick = function () {
        var linhas = [['nome', 'email', 'minutos', 'assistiu_pct', 'perguntas', 'lead', 'agendou']].concat(r.pessoas.map(function (p) { return [p.nome, p.email, p.minutos, p.assistiu_pct, p.perguntas, p.lead ? 'sim' : '', p.agendou ? 'sim' : '']; }));
        var csv = linhas.map(function (l) { return l.map(function (c) { c = String(c == null ? '' : c); if (/^[=+\-@]/.test(c)) c = "'" + c; return '"' + c.replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'webinar-' + W.slug + '.csv'; a.click();
      };
    }
  }

  window.EWebinarPanel = { render: render, _deLocal: deLocal, _localInput: localInput };
})();
