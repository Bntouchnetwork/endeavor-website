/* Endeavor · WhatsApp Manager (admin e portal do cliente): a central de controle da extensão My WhatsApp Manager.
 *   EWaPanel.render(view, ctx, { scope: 'admin' | 'client', clientId })
 * Cada empresa (a Endeavor no admin; cada cliente liberado no portal) tem perfil do negócio, regras, fluxos, modelos de
 * documentos, conversas, registro e pedidos ao CRM próprios.
 * O WhatsApp Web não pode ser mostrado dentro desta página (o WhatsApp bloqueia), então o painel com a IA fica na
 * própria aba do web.whatsapp.com, pela extensão. Aqui: Baixar extensão, Abrir WhatsApp Web, conectar o navegador,
 * status, registro do que passou pela IA (sem as conversas) e os ajustes (Takeover, tempos humanos, respostas prontas). */
(function () {
  'use strict';
  var ZIP = 'downloads/my-whatsapp-manager.zip';
  var FERR = { sugerir: 'Sugerir resposta', resumo: 'Resumo', prontas: 'Respostas prontas', lead: 'Lead no CRM', agendamento: 'Agendamento', proposta: 'Proposta', traduzir: 'Tradução',
    comando: 'Comando', personalizar: 'Resposta pronta adaptada', responder: 'Takeover', takeover: 'IA Takeover', grupo: 'Grupo', fluxo: 'Fluxo → CRM' };
  var ST = { sugerido: ['Sugerido', 'pill--report'], aprovado: ['Aprovado', 'pill--report'], enviado: ['Enviado', 'pill--live-ok'], descartado: ['Descartado', 'pill--muted'],
    escalado: ['Precisa de você', 'pill--warn'], criado: ['Criado', 'pill--report'], erro: ['Erro', 'pill--overdue'], ignorado: ['Sem resposta', 'pill--muted'] };
  var TEMPOS = [['espera_min', 'Esperar antes de digitar · mínimo (s)'], ['espera_max', 'Esperar antes de digitar · máximo (s)'], ['velocidade', 'Velocidade de digitação (caracteres/min)'],
    ['variacao', 'Variação da velocidade (%)'], ['pausa_min', 'Pausa depois de enviar · mínimo (s)'], ['pausa_max', 'Pausa depois de enviar · máximo (s)'], ['digitar_max', 'Tempo máximo digitando uma mensagem (s)'],
    ['limite_hora', 'Respostas automáticas por hora (todas as conversas)'], ['grupo_intervalo', 'Intervalo mínimo no mesmo grupo (min)']];

  var OPT = {};
  function api(ctx) {
    return async function (body) {
      if (OPT.clientId) body = Object.assign({ clientId: OPT.clientId }, body);
      var s = (await ctx.sb.auth.getSession()).data.session;
      var r = await fetch(ctx.CFG.functionsUrl + '/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) { var e = new Error(j.erro || 'O servidor do WhatsApp Manager não respondeu.'); e.status = r.status; throw e; }
      return j;
    };
  }
  /** endereço de uma aba (no admin olhando um cliente, mantém ?cliente=) */
  function rota(aba, extra) {
    var q = [];
    if (OPT.scope === 'admin' && OPT.clientId) q.push('cliente=' + OPT.clientId);
    if (aba && aba !== 'inicio') q.push('aba=' + aba);
    if (extra) q.push(extra);
    return '#/whatsapp' + (q.length ? '?' + q.join('&') : '');
  }
  function param(n) { var m = location.hash.match(new RegExp('[?&]' + n + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : ''; }
  function quando(iso) { if (!iso) return '—'; try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return iso; } }
  function abas(atual) {
    return '<nav class="subtabs" aria-label="WhatsApp Manager">' + [['inicio', 'Início'], ['regras', 'Perfil e regras'], ['fluxos', 'Fluxos'], ['pedidos', 'Pedidos ao CRM'], ['registro', 'Registro'], ['ajustes', 'Ajustes']].map(function (a) {
      return '<a href="' + rota(a[0]) + '"' + (a[0] === atual ? ' aria-current="page"' : '') + '>' + a[1] + '</a>'; }).join('') + '</nav>';
  }
  function pill(s) { var p = ST[s] || [s, '']; return '<span class="pill ' + p[1] + '">' + p[0] + '</span>'; }

  async function render(view, ctx, o) {
    OPT = o || {};
    // o portal do cliente não tem copy/download no contexto: usa os daqui
    if (!ctx.copy) ctx.copy = function (t, b) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { if (b) { var x = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = x; }, 1600); } }, function () { window.prompt('Copie:', t); }); };
    if (!ctx.download) ctx.download = function (nome, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    var aba = param('aba') || 'inicio', call = api(ctx), esc = ctx.esc;
    view.innerHTML = '<p class="portal-muted">Carregando…</p>';
    var d = await call({ acao: 'wa_painel' });
    var cab = '<div class="console__head"><div><h1>WhatsApp Manager' + (d.endeavor ? '' : ' · ' + esc(d.empresa)) + '</h1><p class="portal-muted">A extensão My WhatsApp Manager coloca um painel com IA ao lado do WhatsApp Web. Aqui ficam o perfil do negócio, as regras e os fluxos que a IA segue, os pedidos que ela passa para o CRM, o registro e os ajustes.</p></div>' +
      '<div class="portal-btn-row"><a class="btn btn--ghost btn--sm" href="' + ZIP + '" download id="wa-zip">Baixar extensão</a><a class="btn btn--navy btn--sm" href="https://web.whatsapp.com/" target="_blank" rel="noopener" id="wa-abrir">Abrir WhatsApp Web</a></div></div>';
    view.innerHTML = cab + abas(aba) + '<div id="wa-corpo"></div>';
    var corpo = ctx.$('#wa-corpo');
    if (!d.dono && ['regras', 'fluxos', 'ajustes'].indexOf(aba) > -1) corpo.insertAdjacentHTML('beforebegin', '<p class="portal-alert portal-alert--info">Só o titular da empresa muda o perfil, as regras, os fluxos e os ajustes. Você pode ver.</p>');
    if (aba === 'registro') return registro(corpo, ctx, call);
    if (aba === 'regras') return EWaRegras.perfilRegras(corpo, ctx, call, d);
    if (aba === 'fluxos') return EWaRegras.fluxos(corpo, ctx, call, d);
    if (aba === 'pedidos') return EWaRegras.pedidos(corpo, ctx, call, d);
    if (aba === 'ajustes') return ajustes(corpo, ctx, call, d);
    return inicio(corpo, ctx, call, d);
  }

  /* ---------------- início: status, conectar, instalar ---------------- */
  function inicio(corpo, ctx, call, d) {
    var esc = ctx.esc, a = d.ajustes, ativos = (d.dispositivos || []).filter(function (x) { return x.ativo; }), online = ativos.filter(function (x) { return x.online; });
    var h = d.hoje || {};
    var tk = (d.conversas || []).filter(function (c) { return c.takeover; });
    corpo.innerHTML =
      '<div class="wa-aviso portal-alert portal-alert--info"><b>Atenção ao risco.</b> Automatizar o WhatsApp Web vai contra os termos do WhatsApp e pode bloquear o número, principalmente com respostas automáticas em grupos. ' + (d.endeavor ? 'Use o número de teste (tablet). ' : 'Comece por um número de teste. ') + 'A API oficial do WhatsApp Business continua sendo o caminho para o número principal.</div>' +
      '<div class="wa-grade">' +
        '<div class="portal-card wa-st"><h2 class="portal-h2">Status</h2><dl>' +
          '<div><dt>Extensão</dt><dd>' + (online.length ? '<span class="pill pill--live-ok">Online</span> ' + esc(online.map(function (x) { return x.nome; }).join(', ')) : ativos.length ? '<span class="pill pill--muted">Fora do ar</span> (abra o WhatsApp Web no navegador conectado)' : '<span class="pill pill--warn">Não conectada</span>') + '</dd></div>' +
          '<div><dt>IA Takeover</dt><dd><label class="wa-chave"><input type="checkbox" id="wa-tk"' + (a.takeover ? ' checked' : '') + '><span>' + (a.takeover ? 'Ligado' : 'Desligado') + '</span></label>' +
            (online.some(function (x) { return x.estado && x.estado.pausado; }) ? ' <span class="pill pill--warn">em pausa no painel</span>' : '') + '<small class="portal-muted"> chave geral: desligar aqui para tudo em até 1 minuto</small></dd></div>' +
          '<div><dt>Conversas com Takeover</dt><dd>' + tk.length + (tk.length ? ' · ' + esc(tk.slice(0, 6).map(function (c) { return c.nome || c.chave; }).join(', ')) + (tk.length > 6 ? '…' : '') : '') + '</dd></div>' +
          '<div><dt>Pedidos ao CRM</dt><dd>' + (d.pedidos_abertos ? '<a href="' + rota('pedidos') + '"><b>' + d.pedidos_abertos + '</b> em aberto</a>' : 'Nenhum em aberto') + '</dd></div>' +
          '<div><dt>Hub AI</dt><dd>' + (d.ia ? '<span class="pill pill--report">Configurado</span> agente whatsapp-assistant' : '<span class="pill pill--overdue">Não configurado</span>') + '</dd></div>' +
          '<div><dt>Hoje</dt><dd>' + ['enviado', 'sugerido', 'aprovado', 'escalado', 'erro'].map(function (s) { return (ST[s] ? ST[s][0] : s) + ': <b>' + (h[s] || 0) + '</b>'; }).join(' · ') + '</dd></div>' +
        '</dl></div>' +
        '<div class="portal-card"><h2 class="portal-h2">Instalar no Chrome (teste)</h2><ol class="wa-passos">' +
          '<li><a href="' + ZIP + '" download>Baixe a extensão (.zip)</a> e descompacte a pasta.</li>' +
          '<li>No Chrome, abra <code>chrome://extensions</code> (copie e cole na barra de endereço).</li>' +
          '<li>Ligue o <b>Modo do desenvolvedor</b>, no canto de cima.</li>' +
          '<li>Clique em <b>Carregar sem compactação</b> e escolha a pasta descompactada.</li>' +
          '<li>Fixe o ícone da Endeavor na barra do Chrome e clique em <b>Abrir WhatsApp Web</b>.</li>' +
          '<li>Gere o código abaixo e cole no painel da extensão.</li></ol>' +
          '<p class="portal-muted">Para atualizar: baixe de novo, substitua a pasta e clique em ↻ na extensão. A publicação na Chrome Web Store fica para depois.</p></div>' +
      '</div>' +
      '<div class="portal-card"><div class="portal-btn-row" style="justify-content:space-between"><h2 class="portal-h2">Navegadores conectados</h2><button class="btn btn--gold btn--sm" type="button" id="wa-gerar">Gerar código de conexão</button></div>' +
        '<div id="wa-codigo"></div>' +
        (d.dispositivos && d.dispositivos.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Navegador</th><th>Versão</th><th>Visto por último</th><th>Situação</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
          d.dispositivos.map(function (x) {
            return '<tr><td>' + esc(x.nome) + '</td><td>' + esc(x.versao || '—') + '</td><td>' + quando(x.visto) + (x.estado && x.estado.conversa ? '<br><small class="portal-muted">em ' + esc(x.estado.conversa) + '</small>' : '') + '</td><td>' +
              (!x.ativo ? '<span class="pill pill--muted">Desligado</span>' : x.online ? '<span class="pill pill--live-ok">Online</span>' : '<span class="pill">Conectado</span>') + '</td><td>' +
              (x.ativo ? '<button class="btn btn--ghost btn--xs" type="button" data-rev="' + x.id + '">Desligar</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Nenhum navegador conectado ainda.</p>') + '</div>';

    if (!d.dono) ctx.$('#wa-tk').disabled = true;
    ctx.$('#wa-tk').onchange = async function () {
      var el = this; el.disabled = true;
      try { var r = await call({ acao: 'wa_ajustes', ajustes: Object.assign({}, d.ajustes, { takeover: el.checked }), version: d.version }); d.ajustes = r.ajustes; d.version = r.version; el.nextElementSibling.textContent = el.checked ? 'Ligado' : 'Desligado'; }
      catch (e) { el.checked = !el.checked; alertaEm(ctx, corpo, e); }
      el.disabled = false;
    };
    ctx.$('#wa-gerar').onclick = async function () {
      var b = this; b.disabled = true;
      try {
        var nome = (navigator.userAgent.match(/Windows|Mac OS X|Linux|Android|CrOS/) || ['Chrome'])[0].replace('Mac OS X', 'Mac') + ' · ' + new Date().toLocaleDateString('pt-BR');
        var r = await call({ acao: 'wa_conectar', nome: 'Chrome ' + nome });
        ctx.$('#wa-codigo').innerHTML = '<div class="portal-alert portal-alert--ok"><p><b>Código de conexão</b> (aparece só agora; quem tiver este código usa a IA como você):</p>' +
          '<div class="wa-cod"><input readonly value="' + esc(r.codigo) + '" aria-label="Código de conexão"><button class="btn btn--navy btn--sm" type="button" id="wa-copiar">Copiar</button></div>' +
          '<p>Cole no painel da extensão, no WhatsApp Web. Se vazar, clique em <b>Desligar</b> na lista.</p></div>';
        ctx.$('#wa-copiar').onclick = function () { ctx.copy(r.codigo, this); };
      } catch (e) { alertaEm(ctx, corpo, e); }
      b.disabled = false;
    };
    corpo.querySelectorAll('[data-rev]').forEach(function (b) {
      b.onclick = async function () {
        if (b.dataset.conf !== '1') { b.dataset.conf = '1'; b.textContent = 'Confirmar desligar'; b.classList.add('btn--danger'); return; }
        try { await call({ acao: 'wa_revogar', id: b.dataset.rev }); ctx.route(); } catch (e) { alertaEm(ctx, corpo, e); }
      };
    });
  }
  function alertaEm(ctx, corpo, e) {
    var a = corpo.querySelector('.wa-erro'); if (!a) { a = document.createElement('div'); a.className = 'portal-alert portal-alert--error wa-erro'; a.setAttribute('role', 'alert'); corpo.prepend(a); }
    a.textContent = e.message || String(e);
  }

  /* ---------------- registro ---------------- */
  async function registro(corpo, ctx, call) {
    var esc = ctx.esc, f = param('f'), s = param('s'), itens = [];
    corpo.innerHTML = '<div class="portal-card"><p class="portal-muted">Só o que passou pela IA: o que ela sugeriu, o que foi aprovado ou enviado, em qual conversa e quando. As conversas não são guardadas.</p>' +
      '<div class="portal-btn-row wa-filtros"><label>Ferramenta <select id="wa-f"><option value="">Todas</option>' + Object.keys(FERR).filter(function (k) { return k !== 'responder'; }).map(function (k) { return '<option value="' + k + '"' + (k === f ? ' selected' : '') + '>' + FERR[k] + '</option>'; }).join('') + '</select></label>' +
      '<label>Situação <select id="wa-s"><option value="">Todas</option>' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (k === s ? ' selected' : '') + '>' + ST[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="wa-csv">Baixar CSV</button></div><div id="wa-tab"><p class="portal-muted">Carregando…</p></div><div class="portal-btn-row"><button class="btn btn--ghost btn--sm" type="button" id="wa-mais" hidden>Carregar mais</button></div></div>';
    function filtrar() { location.hash = rota('registro', [ctx.$('#wa-f').value ? 'f=' + ctx.$('#wa-f').value : '', ctx.$('#wa-s').value ? 's=' + ctx.$('#wa-s').value : ''].filter(Boolean).join('&')); }
    ctx.$('#wa-f').onchange = filtrar; ctx.$('#wa-s').onchange = filtrar;
    async function carregar(antes) {
      var r = await call({ acao: 'wa_registro', ferramenta: f || undefined, status: s || undefined, antes: antes || undefined, limite: 100 });
      itens = itens.concat(r.registro || []);
      ctx.$('#wa-tab').innerHTML = itens.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Quando</th><th>Conversa</th><th>Ferramenta</th><th>Situação</th><th>Texto da IA</th></tr></thead><tbody>' +
        itens.map(function (x) {
          return '<tr><td>' + quando(x.created_at) + '</td><td>' + esc(x.nome || x.chave || '—') + (x.grupo ? ' <span class="pill pill--muted">grupo</span>' : '') + '</td><td>' + esc(FERR[x.ferramenta] || x.ferramenta) + '</td><td>' + pill(x.status) +
            (x.detalhes && x.detalhes.motivo ? '<br><small class="portal-muted">' + esc(x.detalhes.motivo) + '</small>' : '') + '</td><td class="wa-txt">' + esc(x.texto || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Nada registrado ainda.</p>';
      ctx.$('#wa-mais').hidden = (r.registro || []).length < 100;
    }
    ctx.$('#wa-mais').onclick = function () { carregar(itens[itens.length - 1].id).catch(function (e) { alertaEm(ctx, corpo, e); }); };
    ctx.$('#wa-csv').onclick = function () {
      var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var csv = ['quando,conversa,grupo,ferramenta,situacao,motivo,texto'].concat(itens.map(function (x) { return [x.created_at, x.nome || x.chave, x.grupo ? 'sim' : 'não', FERR[x.ferramenta] || x.ferramenta, (ST[x.status] || [x.status])[0], x.detalhes && x.detalhes.motivo, x.texto].map(q).join(','); })).join('\n');
      ctx.download('whatsapp-manager-registro.csv', new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    };
    await carregar();
  }

  /* ---------------- ajustes ---------------- */
  function ajustes(corpo, ctx, call, d) {
    var esc = ctx.esc, a = d.ajustes;
    var prontas = (a.prontas || []).slice();
    corpo.innerHTML = '<form class="portal-card portal-form" id="wa-aj" novalidate>' +
      '<h2 class="portal-h2">IA Takeover</h2>' +
      '<label class="wa-chave"><input type="checkbox" name="takeover"' + (a.takeover ? ' checked' : '') + '><span>IA Takeover ligado (chave geral)</span></label>' +
      '<label class="wa-chave"><input type="checkbox" name="takeover_individual"' + (a.takeover_individual ? ' checked' : '') + '><span>Conversas individuais novas já entram com o Takeover ligado</span></label>' +
      '<p class="portal-muted">Grupos entram sempre com o Takeover desligado; a chave de cada grupo fica no painel da extensão. A primeira resposta automática de cada conversa começa com o aviso abaixo.</p>' +
      '<div class="field"><label for="wa-aviso">Aviso de assistente virtual</label><input id="wa-aviso" name="texto_aviso" maxlength="200" value="' + esc(a.texto_aviso) + '"></div>' +
      '<h2 class="portal-h2">Tempos humanos</h2><p class="portal-muted">Cada resposta sorteia a espera e a pausa entre o mínimo e o máximo; a digitação aparece na caixa, na velocidade escolhida.</p>' +
      '<div class="wa-tempos">' + TEMPOS.map(function (t) { return '<div class="field"><label for="wa-' + t[0] + '">' + t[1] + '</label><input id="wa-' + t[0] + '" name="' + t[0] + '" type="number" step="1" value="' + esc(a[t[0]]) + '"></div>'; }).join('') + '</div>' +
      '<h2 class="portal-h2">Horário de atendimento</h2>' +
      '<label class="wa-chave"><input type="checkbox" name="h_ativo"' + (a.horario.ativo ? ' checked' : '') + '><span>Takeover só dentro do horário</span></label>' +
      '<div class="field-row"><div class="field"><label for="wa-hi">Início</label><input id="wa-hi" name="h_inicio" type="time" value="' + esc(a.horario.inicio) + '"></div><div class="field"><label for="wa-hf">Fim</label><input id="wa-hf" name="h_fim" type="time" value="' + esc(a.horario.fim) + '"></div>' +
      '<div class="field"><label for="wa-hz">Fuso</label><select id="wa-hz" name="h_tz">' + ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo'].map(function (z) { return '<option' + (z === a.horario.tz ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select></div></div>' +
      '<h2 class="portal-h2">Idioma e agenda</h2><p class="portal-muted">O que a IA sabe do negócio fica em <a href="' + rota('regras') + '">Perfil e regras</a>.</p>' +
      '<div class="field-row"><div class="field"><label for="wa-idi">Idioma padrão</label><select id="wa-idi" name="idioma">' + [['pt-BR', 'Português'], ['en-US', 'Inglês'], ['es-ES', 'Espanhol']].map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === a.idioma ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="wa-ag">Link de agendamento</label><input id="wa-ag" name="link_agenda" type="url" value="' + esc(a.link_agenda) + '" placeholder="https://…"></div></div>' +
      '<h2 class="portal-h2">Respostas prontas</h2><div id="wa-prontas"></div><button class="btn btn--ghost btn--sm" type="button" id="wa-pr-add">＋ Resposta pronta</button>' +
      '<div class="portal-btn-row" style="margin-top:1.25rem"><button class="btn btn--navy" type="submit">Salvar ajustes</button><span id="wa-aj-msg" role="status" class="portal-muted"></span></div></form>';
    function desenharProntas() {
      ctx.$('#wa-prontas').innerHTML = prontas.map(function (p, i) {
        return '<div class="wa-pronta"><input data-pt="' + i + '" maxlength="60" value="' + esc(p.titulo) + '" aria-label="Título da resposta ' + (i + 1) + '"><textarea data-px="' + i + '" rows="2" maxlength="1500" aria-label="Texto da resposta ' + (i + 1) + '">' + esc(p.texto) + '</textarea><button class="btn btn--ghost btn--xs" type="button" data-pd="' + i + '" aria-label="Remover resposta ' + (i + 1) + '">Remover</button></div>';
      }).join('') || '<p class="portal-muted">Nenhuma.</p>';
      corpo.querySelectorAll('[data-pt]').forEach(function (el) { el.oninput = function () { prontas[+el.dataset.pt].titulo = el.value; }; });
      corpo.querySelectorAll('[data-px]').forEach(function (el) { el.oninput = function () { prontas[+el.dataset.px].texto = el.value; }; });
      corpo.querySelectorAll('[data-pd]').forEach(function (el) { el.onclick = function () { prontas.splice(+el.dataset.pd, 1); desenharProntas(); }; });
    }
    desenharProntas();
    ctx.$('#wa-pr-add').onclick = function () { prontas.push({ titulo: 'Nova resposta', texto: '' }); desenharProntas(); var t = corpo.querySelectorAll('[data-px]'); t[t.length - 1].focus(); };
    ctx.$('#wa-aj').onsubmit = async function (e) {
      e.preventDefault();
      var f = this, m = ctx.$('#wa-aj-msg'), v = function (n) { return f.elements[n].value; }, c = function (n) { return f.elements[n].checked; };
      var novo = { takeover: c('takeover'), takeover_individual: c('takeover_individual'), texto_aviso: v('texto_aviso'), negocio: d.ajustes.negocio, idioma: v('idioma'), link_agenda: v('link_agenda'),
        horario: { ativo: c('h_ativo'), inicio: v('h_inicio'), fim: v('h_fim'), tz: v('h_tz') }, prontas: prontas.filter(function (p) { return p.texto.trim(); }) };
      TEMPOS.forEach(function (t) { novo[t[0]] = Number(v(t[0])); });
      m.textContent = 'Salvando…';
      try {
        var r = await call({ acao: 'wa_ajustes', ajustes: novo, version: d.version });
        d.ajustes = r.ajustes; d.version = r.version;
        m.textContent = 'Salvo. A extensão recebe os ajustes em até 1 minuto.';
        TEMPOS.forEach(function (t) { f.elements[t[0]].value = r.ajustes[t[0]]; }); // mostra os valores ajustados aos limites seguros
      } catch (x) { m.textContent = x.message; }
    };
    if (!d.dono) EWaRegras.soLeitura(ctx.$('#wa-aj'));
  }

  window.EWaPanel = { render: render };
})();
