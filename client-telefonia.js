/* Portal › Serviços › Telefonia (Endeavor Corporate Phone). Fase 1: modo demonstração, sempre identificado.
   Fala só com a função "telephony". O celular virtual fica em tel-phone.js (window.ETelPhone). */
(function () {
  var ctx, opts, D = null, emp = null, aba = 'geral';
  var DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
  var FUSOS = [['America/New_York', 'Leste (Nova York, Miami, Orlando)'], ['America/Chicago', 'Central (Chicago)'], ['America/Denver', 'Montanha (Denver)'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacífico (Los Angeles)'], ['America/Sao_Paulo', 'Brasília']];
  var DEST = [['app', 'Tocar no app (incluído no plano)'], ['numero', 'Encaminhar para outro telefone (custo por minuto)'], ['voicemail', 'Ir direto para o voicemail'], ['encerrar', 'Tocar a mensagem e encerrar']];
  var ST = { completada: 'Atendida', perdida: 'Perdida', voicemail: 'Voicemail', recusada: 'Recusada', tocando: 'Tocando', em_andamento: 'Em andamento', falhou: 'Falhou', encaminhada: 'Encaminhada' };
  var KEY = 'endeavor-tel-emp';

  var esc = function (s) { return ctx.esc(s == null ? '' : String(s)); };
  var fone = function (n) { var m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(n || ''); return m ? '+1 (' + m[1] + ') ' + m[2] + '-' + m[3] : (n || ''); };
  var usd = function (v, d) { return v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d || 2, maximumFractionDigits: d || 2 }).format(v); };
  var quando = function (iso) { if (!iso) return '—'; try { return new Intl.DateTimeFormat(ctx.locale || 'pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return iso; } };
  var dur = function (s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function msg(el, t, k) { if (!el) return; el.hidden = false; ctx.msg(el, t, k === 'erro' ? 'error' : k === 'ok' ? 'ok' : undefined); }

  async function call(body) {
    var s = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/telephony', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) },
      body: JSON.stringify(Object.assign({ clientId: opts.clientId }, body)) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status);
    return j;
  }
  function abrirTelefone() {
    if (!window.ETelPhone || !emp) return;
    var n = (emp.numeros || []).find(function (x) { return x.status === 'ativo'; }) || null;
    ETelPhone.abrir({ call: call, empresa: emp.company_id, numero: n ? n.e164 : null, L: ctx.L, demo: D.demo, modo: 'janela' });
  }

  async function render(view, c, o) {
    ctx = c; opts = o || {};
    view.innerHTML = '<p class="portal-muted">Carregando…</p>';
    D = await call({ acao: 'p_inicio' });
    var lista = D.empresas || [];
    if (!lista.length) {
      view.innerHTML = '<div class="console__head"><h1>Telefonia</h1></div><p class="portal-alert portal-alert--info">A Telefonia ainda não foi liberada para as suas empresas. Fale com a Endeavor para contratar um número americano.</p>';
      return;
    }
    var salvo = null; try { salvo = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    emp = lista.find(function (x) { return x.company_id === salvo; }) || lista[0];
    desenhar(view);
  }

  function desenhar(view) {
    var lista = D.empresas, plano = emp.plano || {}, ativos = (emp.numeros || []).filter(function (n) { return n.status === 'ativo'; });
    var pend = (emp.numeros || []).filter(function (n) { return n.status === 'aguardando_aprovacao'; });
    view.innerHTML = '<div class="console__head tel-topo"><div><h1>Telefonia</h1><p class="portal-muted">Número americano da sua empresa: ligações e SMS pelo app, voicemail e atendimento por horário.</p></div>' +
      '<div class="tel-linha">' + (lista.length > 1 ? '<label class="sr-only" for="tl-emp">Empresa</label><select id="tl-emp">' + lista.map(function (x) { return '<option value="' + x.company_id + '"' + (x.company_id === emp.company_id ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</select>' : '') +
      '<button class="btn btn--navy" id="tl-abrir" type="button"' + (ativos.length ? '' : ' disabled') + '>Abrir telefone</button><button class="btn btn--ghost" id="tl-app" type="button">Baixar o app</button></div></div>' +
      (D.demo ? '<p class="portal-alert portal-alert--info"><strong>Modo demonstração.</strong> Os números, ligações e mensagens desta tela são fictícios (faixa 555-01XX) e servem para conhecer o telefone. Nada é cobrado e nenhuma ligação real é feita.</p>' : '') +
      '<section class="portal-card"><div class="tel-linha"><div><span class="portal-muted">Plano</span><div><strong>' + esc(plano.nome || '—') + '</strong>' + (plano.preco_cents != null ? ' · ' + usd(plano.preco_cents / 100) + '/mês' : '') + '</div></div>' +
      '<div><span class="portal-muted">' + (ativos.length > 1 ? 'Números' : 'Número') + '</span>' + (ativos.length ? ativos.map(function (n) { return '<div class="tel-numero-grande tel-num">' + esc(fone(n.e164)) + (n.demo ? ' <span class="pill pill--report">demo</span>' : '') + '</div>'; }).join('') :
        '<div class="portal-muted">' + (pend.length ? 'Número em aprovação pela Endeavor.' : 'Ainda sem número ativo.') + '</div>') + '</div></div>' +
      '<div id="tl-inst" class="tel-install" hidden></div></section>' +
      '<nav class="subtabs tel-abas" aria-label="Seções da Telefonia" id="tl-abas">' + [['geral', 'Visão geral'], ['atendimento', 'Atendimento'], ['historico', 'Histórico'], ['consumo', 'Consumo']].map(function (a) {
        return '<a href="#/telefonia" data-aba="' + a[0] + '"' + (a[0] === aba ? ' aria-current="page"' : '') + '>' + a[1] + '</a>'; }).join('') + '</nav><div id="tl-corpo"></div>' +
      '<section class="portal-card"><h2 class="portal-h2">WhatsApp</h2><p>O ícone WhatsApp do telefone abre o WhatsApp Web numa janela ao lado, com a sua conta.</p>' +
      '<p class="portal-muted">Em breve: <strong>Conectar WhatsApp Business</strong> pela API oficial (Meta), opcional e cobrado à parte, para ver as conversas dentro do telefone. Ainda não está disponível.</p>' +
      '<div class="tel-linha"><button class="btn btn--ghost" type="button" id="tl-wa">Abrir WhatsApp Web</button><button class="btn btn--ghost" type="button" disabled aria-disabled="true">Conectar WhatsApp (em breve)</button></div></section>';
    var sel = view.querySelector('#tl-emp');
    if (sel) sel.onchange = function () { emp = D.empresas.find(function (x) { return x.company_id === sel.value; }); try { localStorage.setItem(KEY, emp.company_id); } catch (e) { /* ignore */ } if (window.ETelPhone && ETelPhone.aberto()) ETelPhone.fechar(); desenhar(view); };
    view.querySelector('#tl-abrir').onclick = abrirTelefone;
    view.querySelector('#tl-app').onclick = function () { instalar(view.querySelector('#tl-inst')); };
    view.querySelector('#tl-wa').onclick = function () { window.open('https://web.whatsapp.com/', 'endeavor-wa', 'noopener,width=1000,height=760'); };
    view.querySelectorAll('#tl-abas a').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); aba = a.dataset.aba; desenhar(view); }; });
    var corpo = view.querySelector('#tl-corpo');
    ({ geral: geral, atendimento: atendimento, historico: historico, consumo: consumo })[aba](corpo).catch(function (e) { corpo.innerHTML = '<p class="portal-alert portal-alert--error">' + esc(e.message) + '</p>'; });
  }

  /* ---------- baixar o app (PWA) ---------- */
  var promptInst = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptInst = e; });
  function instalar(box) {
    var ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), android = /Android/.test(ua);
    var url = new URL('phone.html', location.href).href;
    box.hidden = false;
    box.innerHTML = '<h3 class="portal-h2">Endeavor Phone no seu aparelho</h3>' +
      (promptInst ? '<p>Este navegador instala o app direto.</p><button class="btn btn--navy" type="button" id="tl-inst-bt">Instalar agora</button>' :
        ios ? '<ol><li>Abra <strong>' + esc(url) + '</strong> no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong> (quadrado com seta).</li><li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li></ol>' :
        android ? '<ol><li>Abra <strong>' + esc(url) + '</strong> no <strong>Chrome</strong>.</li><li>Toque no menu <strong>⋮</strong> e em <strong>Instalar app</strong> (ou Adicionar à tela inicial).</li></ol>' :
        '<ol><li>Abra <a href="phone.html" target="_blank" rel="noopener">o Endeavor Phone</a> no Chrome ou Edge.</li><li>Clique no ícone de instalar na barra de endereço (ou menu › Instalar Endeavor Phone).</li></ol>') +
      '<p class="portal-muted">Entra com o mesmo login e verificação em duas etapas do portal. No iPhone, o app aberto pelo navegador não toca em segundo plano: deixe-o aberto para receber ligações. Versões para App Store e Google Play virão quando houver o app nativo.</p>';
    var bt = box.querySelector('#tl-inst-bt');
    if (bt) bt.onclick = async function () { promptInst.prompt(); try { await promptInst.userChoice; } catch (e) { /* ignore */ } promptInst = null; instalar(box); };
  }

  /* ---------- visão geral ---------- */
  function barra(r, val, max, pct) {
    var c = pct >= 100 ? ' cheio' : pct >= 80 ? ' alerta' : '';
    return '<div><div class="tel-linha" style="justify-content:space-between"><span>' + r + '</span><strong>' + Math.round(val) + ' / ' + (max || '—') + '</strong></div>' +
      '<div class="tel-barra' + c + '" role="progressbar" aria-label="' + r + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, pct) + '"><i style="width:' + Math.min(100, pct) + '%"></i></div><small class="portal-muted">' + pct + '% da franquia</small></div>';
  }
  async function geral(corpo) {
    var s = emp.consumo || {}, p = emp.plano || {};
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Este mês</h2><div class="tel-consumo">' + barra('Minutos', s.minutos || 0, p.minutos, s.pct_minutos || 0) + barra('SMS', s.sms || 0, p.sms, s.pct_sms || 0) + '</div>' +
      (s.alerta ? '<p class="portal-alert portal-alert--' + (s.alerta >= 100 ? 'error' : 'info') + '">' + (s.alerta >= 100 ? 'A franquia do mês acabou. O excedente é cobrado por uso, conforme a tabela do plano.' : 'Você já usou ' + s.alerta + '% da franquia do mês.') + '</p>' : '') +
      (s.bloqueado ? '<p class="portal-alert portal-alert--error">O limite de gasto extra do mês foi atingido. Fale com a Endeavor para aumentar.</p>' : '') +
      '<p class="portal-muted">Valores ' + (s.estimado ? 'estimados' : 'conferidos') + '. Atender pelo app está incluído no plano; o encaminhamento para outro telefone tem custo por minuto.</p></section>' +
      (D.demo ? '<section class="portal-card"><h2 class="portal-h2">Testar a demonstração</h2><p class="portal-muted">Simule uma entrada para ver como o telefone avisa. Tudo fictício.</p>' +
        '<div class="tel-sim"><button class="btn btn--ghost" data-sim="chamada" type="button">Simular ligação</button><button class="btn btn--ghost" data-sim="sms" type="button">Simular SMS</button>' +
        '<button class="btn btn--ghost" data-sim="voicemail" type="button">Simular voicemail</button></div><p id="tl-sim-msg" hidden></p></section>' : '');
    corpo.querySelectorAll('[data-sim]').forEach(function (b) {
      b.onclick = async function () {
        var m = corpo.querySelector('#tl-sim-msg'); b.disabled = true;
        try {
          var r = await call({ acao: 'p_simular', company_id: emp.company_id, tipo: b.dataset.sim });
          abrirTelefone();
          msg(m, b.dataset.sim === 'chamada' ? (r.chamada ? 'Ligação de demonstração tocando no telefone.' : 'Fora do horário de atendimento: a ligação foi para o voicemail.') : b.dataset.sim === 'sms' ? 'SMS de demonstração recebido.' : 'Voicemail de demonstração recebido.', 'ok');
        } catch (e) { msg(m, e.message, 'erro'); }
        b.disabled = false;
      };
    });
  }

  /* ---------- atendimento (saudação, horário, destino, encaminhamento) ---------- */
  async function atendimento(corpo) {
    var ativos = (emp.numeros || []).filter(function (n) { return n.status === 'ativo'; });
    if (!ativos.length) { corpo.innerHTML = '<section class="portal-card"><p class="portal-muted">O atendimento é configurado depois que o número estiver ativo.</p></section>'; return; }
    if (!emp.pode.admin) { corpo.innerHTML = '<section class="portal-card"><p class="portal-muted">Só o administrador da empresa muda o atendimento.</p></section>'; return; }
    corpo.innerHTML = ativos.map(function (n) { return formRouting(n, (emp.routing || []).find(function (r) { return r.number_id === n.id; }) || {}); }).join('');
    ativos.forEach(function (n) { ligarForm(corpo.querySelector('[data-num="' + n.id + '"]'), n); });
  }
  function formRouting(n, r) {
    var h = r.horario || { ativo: false, tz: 'America/New_York', dias: {} }, g = r.greeting || {}, aw = r.away || {}, id = 'r' + n.id.slice(0, 8);
    var perm = emp.permissoes || {};
    return '<form class="portal-card portal-form" data-num="' + n.id + '"><h2 class="portal-h2">' + esc(fone(n.e164)) + '</h2>' +
      '<fieldset><legend>Quando alguém liga</legend><div class="field"><label for="' + id + '-dest">Destino</label><select id="' + id + '-dest" name="destino">' + DEST.map(function (d) {
        var off = d[0] === 'numero' && !perm.encaminhamento;
        return '<option value="' + d[0] + '"' + (r.destino === d[0] ? ' selected' : '') + (off ? ' disabled' : '') + '>' + d[1] + (off ? ' (não liberado no plano)' : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" data-enc hidden><label for="' + id + '-para">Encaminhar para</label><input id="' + id + '-para" name="para" inputmode="tel" autocomplete="off" placeholder="+1 407 555 0111 ou +55 11 91234 5678" value="' + esc(r.encaminhar_para || '') + '">' +
      '<button class="btn btn--ghost" type="button" data-estimar>Ver custo estimado</button><div data-est aria-live="polite"></div></div>' +
      '<label class="check"><input type="checkbox" name="vm"' + (r.voicemail !== false ? ' checked' : '') + '> Voicemail quando não atender</label>' +
      '<label class="check"><input type="checkbox" name="np"' + (r.nao_perturbe ? ' checked' : '') + '> Não perturbe (ninguém toca)</label>' +
      (perm.gravacao ? '<label class="check"><input type="checkbox" name="gravar"' + (r.gravar ? ' checked' : '') + '> Gravar ligações</label><p class="portal-muted">Na Flórida e em outros estados, todas as pessoas precisam consentir com a gravação: a saudação deve avisar que a ligação é gravada.</p>' : '') + '</fieldset>' +
      '<fieldset><legend>Horário de atendimento</legend><label class="check"><input type="checkbox" name="hativo"' + (h.ativo ? ' checked' : '') + '> Atender só no horário abaixo (fora dele, vai para a mensagem de ausência)</label>' +
      '<div class="field"><label for="' + id + '-tz">Fuso</label><select id="' + id + '-tz" name="tz">' + FUSOS.map(function (f) { return '<option value="' + f[0] + '"' + (h.tz === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="tel-dias">' + DIAS.map(function (d) {
        var f = (h.dias && h.dias[d[0]] && h.dias[d[0]][0]) || null;
        return '<div class="tel-dia"><span>' + d[1] + '</span><input type="checkbox" aria-label="Atende ' + d[1] + '" data-dia="' + d[0] + '"' + (f ? ' checked' : '') + '>' +
          '<input type="time" aria-label="' + d[1] + ' início" data-ini="' + d[0] + '" value="' + (f ? f[0] : '09:00') + '"><input type="time" aria-label="' + d[1] + ' fim" data-fim="' + d[0] + '" value="' + (f ? f[1] : '18:00') + '"></div>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Saudações</legend><div class="tel-idiomas">' + [['pt', 'Português'], ['en', 'English'], ['es', 'Español']].map(function (l) {
        return '<div class="field"><label for="' + id + '-g' + l[0] + '">Boas-vindas · ' + l[1] + '</label><textarea id="' + id + '-g' + l[0] + '" name="g_' + l[0] + '" rows="2" maxlength="400">' + esc(g[l[0]] || '') + '</textarea></div>' +
          '<div class="field"><label for="' + id + '-a' + l[0] + '">Ausência · ' + l[1] + '</label><textarea id="' + id + '-a' + l[0] + '" name="a_' + l[0] + '" rows="2" maxlength="400">' + esc(aw[l[0]] || '') + '</textarea></div>'; }).join('') +
      '</div><p class="portal-muted">As saudações serão lidas por voz sintética quando a ligação real entrar (Fase 3).</p></fieldset>' +
      '<div data-aceite hidden><label class="check"><input type="checkbox" name="aceite"> Li o custo estimado do encaminhamento e autorizo a cobrança por minuto.</label></div>' +
      '<button class="btn btn--navy" type="submit">Salvar atendimento</button><p data-msg hidden></p></form>';
  }
  function ligarForm(f, n) {
    var dest = f.querySelector('[name=destino]'), enc = f.querySelector('[data-enc]'), ac = f.querySelector('[data-aceite]'), est = f.querySelector('[data-est]');
    var mostrar = function () { var on = dest.value === 'numero'; enc.hidden = !on; ac.hidden = !on; };
    dest.onchange = mostrar; mostrar();
    f.querySelector('[name=para]').oninput = function () { f.querySelector('[name=aceite]').checked = false; est.innerHTML = ''; };
    f.querySelector('[data-estimar]').onclick = async function () {
      est.innerHTML = '<span class="portal-muted">Calculando…</span>';
      try {
        var r = await call({ acao: 'p_estimar', company_id: emp.company_id, number_id: n.id, destino: f.querySelector('[name=para]').value });
        var e = r.estimativa;
        est.innerHTML = !r.permitido ? '<p class="portal-alert portal-alert--error">Encaminhar para este país não está liberado.</p>' :
          !e.ok ? '<p class="portal-alert portal-alert--info">Ainda não temos a tarifa conferida para este destino (' + esc((e.falta || []).join(', ')) + '). Fale com a Endeavor.</p>' :
          '<p class="portal-alert portal-alert--info">Custo estimado: <strong>' + usd(e.preco_minuto, 3) + ' por minuto</strong> (duas pernas: a chamada que entra no seu número + a que sai para ' + esc(e.pais) + '). Tarifa conferida em ' + esc(e.verificado_em) + '. Uma ligação de 10 minutos ≈ ' + usd(e.preco_minuto * 10) + '.</p>';
      } catch (x) { est.innerHTML = '<p class="portal-alert portal-alert--error">' + esc(x.message) + '</p>'; }
    };
    f.onsubmit = async function (ev) {
      ev.preventDefault();
      var m = f.querySelector('[data-msg]'), dias = {}, txt = function (p) { var o = {}; ['pt', 'en', 'es'].forEach(function (l) { var v = f.querySelector('[name=' + p + '_' + l + ']').value.trim(); if (v) o[l] = v; }); return o; };
      f.querySelectorAll('[data-dia]').forEach(function (c) { if (c.checked) { var d = c.dataset.dia; dias[d] = [[f.querySelector('[data-ini="' + d + '"]').value, f.querySelector('[data-fim="' + d + '"]').value]]; } });
      var g = f.querySelector('[name=gravar]');
      var routing = { destino: dest.value, encaminhar_para: f.querySelector('[name=para]').value, voicemail: f.querySelector('[name=vm]').checked, nao_perturbe: f.querySelector('[name=np]').checked,
        gravar: !!(g && g.checked), horario: { ativo: f.querySelector('[name=hativo]').checked, tz: f.querySelector('[name=tz]').value, dias: dias }, greeting: txt('g'), away: txt('a') };
      if (dest.value === 'numero' && !f.querySelector('[name=aceite]').checked) { msg(m, 'Veja o custo estimado e marque a autorização antes de salvar.', 'erro'); return; }
      try {
        var r = await call({ acao: 'p_routing_salvar', company_id: emp.company_id, number_id: n.id, routing: routing, aceite: dest.value === 'numero' });
        emp.routing = (emp.routing || []).filter(function (x) { return x.number_id !== n.id; }).concat([r.routing]);
        msg(m, 'Atendimento salvo. Agora: ' + (r.agora.aberto ? 'aberto' : 'fechado (' + ({ fora_do_horario: 'fora do horário', feriado: 'feriado', nao_perturbe: 'não perturbe' })[r.agora.motivo] + ')') + '.', 'ok');
      } catch (x) { msg(m, x.message, 'erro'); }
    };
  }

  /* ---------- histórico ---------- */
  async function historico(corpo) {
    var r = await call({ acao: 'p_recentes', company_id: emp.company_id }), cs = r.chamadas || [];
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Ligações</h2>' + (!cs.length ? '<p class="portal-muted">Nenhuma ligação ainda.</p>' :
      '<div class="table-wrap"><table class="table"><thead><tr><th>Quando</th><th>Sentido</th><th>Número</th><th>Situação</th><th>Duração</th></tr></thead><tbody>' + cs.map(function (c) {
        return '<tr><td>' + esc(quando(c.inicio)) + '</td><td>' + (c.direcao === 'entrada' ? 'Recebida' : 'Feita') + '</td><td class="tel-num">' + esc(fone(c.direcao === 'entrada' ? c.de : c.para)) + '</td><td>' + esc(ST[c.status] || c.status) +
          (c.demo ? ' <span class="pill pill--report">demo</span>' : '') + '</td><td>' + dur(c.duracao_s) + '</td></tr>'; }).join('') + '</tbody></table></div>') + '</section>';
  }

  /* ---------- consumo ---------- */
  async function consumo(corpo) {
    var r = await call({ acao: 'p_consumo', company_id: emp.company_id }), ms = r.meses || [];
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Consumo por mês</h2>' + (!ms.length ? '<p class="portal-muted">Sem consumo registrado ainda.</p>' :
      '<div class="table-wrap"><table class="table"><thead><tr><th>Mês</th><th>Minutos</th><th>SMS</th><th>Franquia usada</th><th>Extra estimado</th></tr></thead><tbody>' + ms.map(function (u) {
        return '<tr><td>' + esc(u.periodo) + '</td><td>' + Math.round(u.situacao.minutos) + '</td><td>' + u.situacao.sms + '</td><td>' + Math.max(u.situacao.pct_minutos, u.situacao.pct_sms) + '%</td><td>' + usd(u.preco || 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div>') + '<p class="portal-muted">O excedente segue a tarifa do plano. Valores estimados até o fechamento da fatura.</p></section>';
  }

  window.ETelPortal = { render: render, call: function () { return call.apply(null, arguments); } };
})();
