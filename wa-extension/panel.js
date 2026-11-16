/* My WhatsApp Manager · painel retrátil no WhatsApp Web.
 * - Ferramentas com o Hub AI: sugerir resposta, resumo, respostas prontas, lead no CRM, agendamento, proposta e tradução.
 * - Comando por texto ou por voz (com a transcrição aparecendo enquanto você fala).
 * - A IA digita de forma visível na caixa da mensagem; o painel mostra o que ela está fazendo.
 * - IA Takeover: responde sozinha nas conversas com a chave ligada, com tempos humanos (espera, digitação, pausa),
 *   limite por hora, e para na hora se você começar a digitar.
 * - Grupos: a IA acompanha os assuntos e sugere a resposta; o Takeover do grupo tem chave própria (desligada por padrão).
 * Nada da conversa é guardado: o servidor registra só o que passou pela IA. */
(function () {
  'use strict';
  if (window.__emgrCarregado) return; window.__emgrCarregado = true;
  var C = window.EWaCore, W = window.EWaDom;
  var VERSAO = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '1.0.0';
  var ADMIN = 'https://endeavorbiz.com/admin.html#/whatsapp';

  var S = {
    conectado: false, ajustes: C.limparAjustes({}), version: 0, conversas: {}, usuario: '', pausado: false, aberto: true, largura: 380,
    atual: null, ocupado: false, tratadas: {}, vistas: {}, abertaPelaIA: {}, envios: [], tentativas: {}, ultGrupo: {}, analiseGrupo: {}, humanoEm: 0, teclouEm: 0, acao: null
  };

  /* ---------------- servidor ---------------- */
  function api(body) {
    return new Promise(function (ok, falha) {
      try {
        chrome.runtime.sendMessage({ tipo: 'api', body: body }, function (r) {
          if (chrome.runtime.lastError || !r) return falha(new Error('A extensão foi atualizada. Recarregue a página do WhatsApp Web.'));
          if (r.status >= 200 && r.status < 300) return ok(r.dados);
          var e = new Error((r.dados && r.dados.erro) || 'O servidor não respondeu.'); e.status = r.status; falha(e);
        });
      } catch (e) { falha(new Error('A extensão foi atualizada. Recarregue a página do WhatsApp Web.')); }
    });
  }
  function msgBg(m) { return new Promise(function (ok) { try { chrome.runtime.sendMessage(m, function (r) { void chrome.runtime.lastError; ok(r || {}); }); } catch (e) { ok({}); } }); }
  function guardar(o) { try { chrome.storage.local.set(o); } catch (e) { /* ok */ } }
  function ler(k) { return new Promise(function (r) { try { chrome.storage.local.get(k, r); } catch (e) { r({}); } }); }

  /* ---------------- interface ---------------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var host = document.createElement('div');
  host.id = 'emgr-host';
  var raiz = host.attachShadow({ mode: 'open' });
  var ICONE = chrome.runtime.getURL('icons/icon48.png');
  raiz.innerHTML = '<link rel="stylesheet" href="' + chrome.runtime.getURL('panel.css') + '">' +
    '<aside class="p" id="p" aria-label="My WhatsApp Manager">' +
    '<div class="alca" id="alca" role="separator" aria-orientation="vertical" aria-label="Arraste para ajustar a largura" tabindex="0"></div>' +
    '<header class="topo"><img src="' + ICONE + '" alt=""><div class="marca"><b>My WhatsApp Manager</b><small>Endeavor · Hub AI</small></div>' +
    '<button class="ic" id="recolher" aria-label="Recolher o painel" title="Recolher">›</button></header>' +
    '<div class="corpo" id="corpo">' +
      '<section id="conectar" class="caixa" hidden><h2>Conectar a extensão</h2><p>No admin da Endeavor, abra <b>WhatsApp Manager</b> e clique em <b>Gerar código de conexão</b>. Cole o código aqui.</p>' +
      '<input id="cod" type="password" autocomplete="off" placeholder="wam_…" aria-label="Código de conexão"><button class="bt pri" id="cod-ir">Conectar</button><p class="erro" id="cod-erro" role="alert"></p>' +
      '<a href="' + ADMIN + '" target="_blank" rel="noopener">Abrir o admin</a></section>' +
      '<div id="app" hidden>' +
        '<section class="geral"><label class="chave"><input type="checkbox" id="tk-geral"><span class="tr"></span><span><b>IA Takeover</b><small id="tk-sub">responde sozinha nas conversas ligadas</small></span></label>' +
        '<button class="bt" id="pausar" aria-pressed="false">Pausar IA</button></section>' +
        '<section class="agora" id="agora" aria-live="polite"><span class="pt"></span><span id="agora-txt">Pronta.</span><button class="bt mini" id="parar" hidden>Parar</button><div class="barra"><i id="barra"></i></div></section>' +
        '<section class="conv" id="conv"><p class="mut">Abra uma conversa no WhatsApp.</p></section>' +
        '<section class="cmd"><label for="cmd" class="rot">Comando para a IA</label><textarea id="cmd" rows="2" placeholder="Ex.: responda que amanhã eu ligo às 10h"></textarea>' +
        '<div class="linha"><button class="bt mic" id="mic" aria-pressed="false" title="Falar o comando"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg><span>Falar</span></button>' +
        '<button class="bt pri" id="cmd-ir">Enviar comando</button></div><small class="mut" id="mic-st"></small></section>' +
        '<nav class="ferr" aria-label="Ferramentas">' +
          [['sugerir', 'Sugerir resposta'], ['resumo', 'Resumo'], ['prontas', 'Respostas prontas'], ['lead', 'Lead no CRM'], ['agenda', 'Agendamento'], ['proposta', 'Proposta'], ['traduzir', 'Tradução']]
            .map(function (f) { return '<button class="bt" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</nav>' +
        '<section class="res" id="res"></section>' +
        '<section class="grupo" id="grupo" hidden></section>' +
        '<details class="tempos" id="tempos"><summary>Tempos humanos do Takeover</summary><div class="grade" id="tempos-campos"></div><small class="mut">Cada resposta sorteia um tempo entre o mínimo e o máximo.</small></details>' +
        '<footer class="rodape"><p class="risco">Automação no WhatsApp Web vai contra os termos do WhatsApp e pode bloquear o número. Use o número de teste. Respostas automáticas se identificam como assistente virtual.</p>' +
        '<p><a href="' + ADMIN + '" target="_blank" rel="noopener">Admin · registro e ajustes</a> · <span id="quem"></span> · <button class="lk" id="sair">Desconectar</button> · <button class="lk" id="diag" title="Copia só a estrutura da página, sem o texto das mensagens">Copiar diagnóstico</button></p></footer>' +
      '</div>' +
    '</div></aside>' +
    '<button class="aba" id="aba" hidden aria-label="Abrir o My WhatsApp Manager"><img src="' + ICONE + '" alt=""><span class="pt"></span></button>';
  var $ = function (s) { return raiz.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(raiz.querySelectorAll(s)); };

  // o painel empurra o WhatsApp para o lado (não cobre a conversa)
  var empurra = document.createElement('style');
  empurra.id = 'emgr-empurra';
  empurra.textContent = 'html.emgr-aberto body{width:calc(100vw - var(--emgr-w,380px))!important;min-width:0!important;overflow:hidden}' +
    'html.emgr-aberto #app{width:calc(100vw - var(--emgr-w,380px))!important;min-width:0!important}' +
    '#emgr-host{position:fixed;top:0;right:0;height:100vh;z-index:2147483000}';

  function montar() {
    if (!document.documentElement.contains(host)) document.documentElement.appendChild(host);
    if (!document.head.contains(empurra)) document.head.appendChild(empurra);
  }
  function aplicarAberto() {
    document.documentElement.classList.toggle('emgr-aberto', S.aberto);
    document.documentElement.style.setProperty('--emgr-w', S.largura + 'px');
    $('#p').hidden = !S.aberto; $('#aba').hidden = S.aberto;
    $('#p').style.width = S.largura + 'px';
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 50);
  }
  function alternar(v) { S.aberto = v == null ? !S.aberto : !!v; guardar({ aberto: S.aberto }); aplicarAberto(); }
  $('#recolher').onclick = function () { alternar(false); };
  $('#aba').onclick = function () { alternar(true); };
  chrome.runtime.onMessage.addListener(function (m) { if (m && m.tipo === 'alternar') alternar(); });

  // arrastar a borda para mudar a largura (300 a 640 px)
  (function () {
    var al = $('#alca'), x0 = 0, w0 = 0;
    function mover(e) { S.largura = Math.max(300, Math.min(640, w0 + (x0 - e.clientX))); aplicarAberto(); }
    al.addEventListener('pointerdown', function (e) { x0 = e.clientX; w0 = S.largura; al.setPointerCapture(e.pointerId); al.addEventListener('pointermove', mover); });
    al.addEventListener('pointerup', function (e) { al.releasePointerCapture(e.pointerId); al.removeEventListener('pointermove', mover); guardar({ largura: S.largura }); });
    al.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { S.largura = Math.max(300, Math.min(640, S.largura + (e.key === 'ArrowLeft' ? 20 : -20))); aplicarAberto(); guardar({ largura: S.largura }); e.preventDefault(); } });
  })();

  /* ---------------- o que a IA está fazendo ---------------- */
  function agora(texto, tipo, prog) {
    var a = $('#agora'); a.className = 'agora ' + (tipo || '');
    $('#agora-txt').textContent = texto;
    $('#barra').style.width = prog == null ? '0' : Math.round(prog * 100) + '%';
    $('#parar').hidden = !S.acao;
    pontos();
  }
  function pontos() {
    var on = S.ajustes.takeover && !S.pausado;
    $$('.aba .pt').forEach(function (p) { p.className = 'pt' + (on ? ' on' : ''); });
    $('#tk-geral').checked = !!S.ajustes.takeover;
    $('#tk-sub').textContent = !S.ajustes.takeover ? 'desligado' : S.pausado ? 'em pausa' : 'responde sozinha nas conversas ligadas';
    $('#pausar').textContent = S.pausado ? 'Retomar IA' : 'Pausar IA';
    $('#pausar').setAttribute('aria-pressed', String(S.pausado));
  }
  $('#parar').onclick = function () { if (S.acao) S.acao.parar = true; };
  function esperar(ms, rotulo, ac) {
    return new Promise(function (fim) {
      var ini = Date.now();
      (function passo() {
        if (ac && ac.parar) return fim(false);
        var resta = ms - (Date.now() - ini);
        if (resta <= 0) return fim(true);
        agora(rotulo + ' ' + Math.ceil(resta / 1000) + 's…', 'espera', 1 - resta / ms);
        setTimeout(passo, Math.min(250, resta));
      })();
    });
  }
  async function digitarVisivel(texto, ac, substituir) {
    if (!W.caixa()) throw new Error('Não encontrei a caixa de mensagem. Abra uma conversa.');
    if (W.textoNaCaixa()) { if (!substituir) return { ok: false, motivo: 'ocupada' }; W.limparCaixa(); }
    var ini = Date.now();
    var r = await W.digitar(texto, C.ritmoDigitacao(texto, S.ajustes), {
      parar: function () { return (ac && ac.parar) || S.teclouEm > ini; },
      progresso: function (p) { agora('Digitando na caixa… ' + Math.round(p * 100) + '%', 'digitando', p); }
    });
    return r;
  }

  /* ---------------- pessoa usando o WhatsApp (a IA nunca disputa o teclado) ---------------- */
  function daPessoa(e) { return e.isTrusted && e.target !== host && !(e.composedPath && e.composedPath().indexOf(host) >= 0); }
  document.addEventListener('keydown', function (e) { if (daPessoa(e)) { S.humanoEm = Date.now(); var c = W.caixa(); if (c && (e.target === c || c.contains(e.target))) S.teclouEm = Date.now(); } }, true);
  document.addEventListener('mousedown', function (e) { if (daPessoa(e)) S.humanoEm = Date.now(); }, true);

  /* ---------------- conversa aberta ---------------- */
  function ref(c) { return { chave: c.chave, nome: c.nome, grupo: c.grupo }; }
  function estado(c) {
    return S.conversas[c.chave] || { chave: c.chave, nome: c.nome, grupo: c.grupo, seguir: true, takeover: !c.grupo && S.ajustes.takeover_individual, novo: true };
  }
  function porNome(nome) { for (var k in S.conversas) if (S.conversas[k].nome === nome) return S.conversas[k]; return null; }
  function mesmaConversa(c) { var a = W.conversaAberta(); return !!a && a.chave === c.chave; }

  function desenharConversa(c) {
    var el = $('#conv');
    if (!c) { el.innerHTML = '<p class="mut">Abra uma conversa no WhatsApp.</p>'; $('#grupo').hidden = true; return; }
    var st = estado(c);
    el.innerHTML = '<div class="conv-cab"><b>' + esc(c.nome) + '</b><span class="tag">' + (c.grupo ? 'Grupo' : 'Individual') + '</span></div>' +
      '<label class="chave peq"><input type="checkbox" id="c-seguir"' + (st.seguir ? ' checked' : '') + '><span class="tr"></span><span>Acompanhar' + (c.grupo ? ' os assuntos' : ' e sugerir') + '</span></label>' +
      '<label class="chave peq"><input type="checkbox" id="c-tk"' + (st.takeover ? ' checked' : '') + '><span class="tr"></span><span>IA Takeover nesta ' + (c.grupo ? 'conversa de grupo' : 'conversa') + '</span></label>' +
      '<p class="alerta" id="c-tk-aviso" hidden>No grupo, a IA só responde quando o assunto é com a empresa e no máximo uma vez a cada ' + S.ajustes.grupo_intervalo + ' min. Resposta automática em grupo é o uso mais arriscado para o número. <button class="bt mini" id="c-tk-sim">Ligar mesmo assim</button> <button class="bt mini" id="c-tk-nao">Cancelar</button></p>' +
      '<button class="bt mini" id="c-agora"' + (st.takeover && S.ajustes.takeover ? '' : ' hidden') + '>Responder agora</button>';
    $('#c-seguir').onchange = function () { mudarConversa(c, { seguir: this.checked }); };
    $('#c-tk').onchange = function () {
      var v = this.checked;
      if (v && c.grupo) { this.checked = false; $('#c-tk-aviso').hidden = false; return; }
      mudarConversa(c, { takeover: v });
    };
    if (c.grupo) {
      $('#c-tk-sim').onclick = function () { $('#c-tk-aviso').hidden = true; mudarConversa(c, { takeover: true }); };
      $('#c-tk-nao').onclick = function () { $('#c-tk-aviso').hidden = true; };
    }
    $('#c-agora').onclick = function () { S.tratadas[c.chave] = null; tick(true); };
    $('#grupo').hidden = !c.grupo;
    if (c.grupo && !S.analiseGrupo[c.chave]) $('#grupo').innerHTML = '<h3>Assuntos do grupo</h3><p class="mut">Quando chegarem mensagens novas, a IA resume os assuntos e sugere a resposta.</p><button class="bt mini" id="g-ja">Analisar agora</button>';
    else if (c.grupo) mostrarGrupo(S.analiseGrupo[c.chave].r, c);
    var gj = $('#g-ja'); if (gj) gj.onclick = function () { analisarGrupo(c, true); };
  }
  async function mudarConversa(c, mud) {
    try {
      var r = await api(Object.assign({ acao: 'ext_conversa', conversa: ref(c) }, mud));
      S.conversas[c.chave] = r.conversa;
      if (mud.takeover === true) { var u = C.ultimaRecebida(c.mensagens); S.tratadas[c.chave] = u ? u.id : null; }
      agora(mud.takeover === true ? 'IA Takeover ligado em ' + c.nome + '. Ela responde a próxima mensagem.' : mud.takeover === false ? 'IA Takeover desligado em ' + c.nome + '.' : 'Ajuste salvo.', 'ok');
    } catch (e) { agora(e.message, 'erro'); }
    desenharConversa(W.conversaAberta() || c);
  }

  /* ---------------- resultado das ferramentas ---------------- */
  function res(html) { var r = $('#res'); r.innerHTML = html; return r; }
  function carregando(t) { res('<p class="mut carregando">' + esc(t) + '</p>'); agora(t, 'pensando'); }
  /** Cartão de texto com "Digitar na caixa", "Digitar e enviar", "Copiar" e "Descartar". */
  function cartao(rotulo, texto, o) {
    o = o || {};
    var id = 'k' + Math.random().toString(36).slice(2, 8);
    var html = '<div class="cartao" id="' + id + '"><div class="cartao-rot">' + esc(rotulo) + '</div><textarea rows="' + Math.min(8, Math.max(2, Math.ceil(texto.length / 42))) + '" aria-label="' + esc(rotulo) + '">' + esc(texto) + '</textarea>' +
      '<div class="linha"><button class="bt" data-k="digitar">Digitar na caixa</button><button class="bt pri" data-k="enviar">Digitar e enviar</button><button class="bt mini" data-k="copiar">Copiar</button>' + (o.logId ? '<button class="bt mini" data-k="descartar">Descartar</button>' : '') + '</div></div>';
    return { html: html, ligar: function () {
      var el = $('#' + id); if (!el) return;
      var ta = el.querySelector('textarea');
      el.querySelector('[data-k="digitar"]').onclick = function () { usarTexto(ta.value, false, o); };
      el.querySelector('[data-k="enviar"]').onclick = function () { usarTexto(ta.value, true, o); };
      el.querySelector('[data-k="copiar"]').onclick = function () { navigator.clipboard.writeText(ta.value).then(function () { agora('Copiado.', 'ok'); }); };
      var d = el.querySelector('[data-k="descartar"]'); if (d) d.onclick = function () { el.remove(); api({ acao: 'ext_registrar', log_id: o.logId, status: 'descartado' }).catch(function () { }); };
    } };
  }
  async function usarTexto(texto, enviarJa, o) {
    texto = String(texto || '').trim(); if (!texto) return;
    var c = W.conversaAberta(); if (!c) return agora('Abra a conversa onde a mensagem vai.', 'erro');
    if (S.ocupado) return agora('A IA está terminando outra ação. Tente em instantes.', 'alerta');
    S.ocupado = true; var ac = S.acao = { parar: false };
    try {
      var r = await digitarVisivel(texto, ac, true);
      if (!r.ok) { agora(r.motivo === 'parado' ? 'Parado. O texto ficou na caixa.' : 'Não foi possível digitar.', 'alerta'); return; }
      if (enviarJa) {
        if (!mesmaConversa(c)) { agora('A conversa mudou: não enviei.', 'alerta'); return; }
        W.enviar(); agora('Enviado ✓', 'ok');
      } else agora('Texto na caixa. Revise e envie quando quiser.', 'ok');
      api({ acao: 'ext_registrar', log_id: o.logId, ferramenta: o.ferramenta || 'comando', status: enviarJa ? 'enviado' : 'aprovado', texto: texto, conversa: ref(c) }).catch(function () { });
    } catch (e) { agora(e.message, 'erro'); }
    finally { S.ocupado = false; S.acao = null; $('#parar').hidden = true; }
  }
  function precisaConversa() { var c = W.conversaAberta(); if (!c) { res('<p class="erro">Abra uma conversa no WhatsApp Web primeiro.</p>'); return null; } return c; }
  function ia(ferramenta, c, extra) {
    if (!(c.mensagens || []).length && ['comando', 'traduzir'].indexOf(ferramenta) < 0)
      return Promise.reject(new Error('Não consegui ler as mensagens desta conversa. Clique em "Copiar diagnóstico", no rodapé do painel, e cole no chat com o Claude.'));
    return api(Object.assign({ acao: 'ext_ia', ferramenta: ferramenta, conversa: ref(c), mensagens: c.mensagens }, extra || {}));
  }
  function falhou(e) { res('<p class="erro">' + esc(e.message) + '</p>'); agora(e.message, 'erro'); }

  var FERR = {
    sugerir: async function () {
      var c = precisaConversa(); if (!c) return;
      carregando('Pensando na resposta…');
      var r = await ia('sugerir', c);
      var ks = [cartao('Sugestão', r.resposta, { logId: r.log_id, ferramenta: 'sugerir' })].concat((r.alternativas || []).map(function (t, i) { return cartao('Alternativa ' + (i + 1), t, { ferramenta: 'sugerir' }); }));
      res(ks.map(function (k) { return k.html; }).join('')); ks.forEach(function (k) { k.ligar(); }); agora('Sugestão pronta.', 'ok');
    },
    resumo: async function () {
      var c = precisaConversa(); if (!c) return;
      carregando('Resumindo a conversa…');
      var r = await ia('resumo', c);
      res('<div class="bloco"><h3>Resumo</h3><p>' + esc(r.resumo) + '</p>' + (r.interesse ? '<p><b>Interesse:</b> ' + esc(r.interesse) + '</p>' : '') +
        ((r.pendencias || []).length ? '<p><b>Pendências</b></p><ul>' + r.pendencias.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
        (r.proximo_passo ? '<p><b>Próximo passo:</b> ' + esc(r.proximo_passo) + '</p>' : '') + '</div>');
      agora('Resumo pronto.', 'ok');
    },
    prontas: async function () {
      var ps = S.ajustes.prontas || [];
      res('<div class="bloco"><h3>Respostas prontas</h3>' + (ps.length ? ps.map(function (p, i) {
        return '<div class="pronta"><b>' + esc(p.titulo) + '</b><p>' + esc(p.texto) + '</p><div class="linha"><button class="bt mini" data-p="' + i + '" data-m="usar">Digitar na caixa</button><button class="bt mini" data-p="' + i + '" data-m="ia">Adaptar com IA</button></div></div>';
      }).join('') : '<p class="mut">Nenhuma resposta pronta. Cadastre no admin, em WhatsApp Manager · Ajustes.</p>') + '</div>');
      $$('[data-p]').forEach(function (b) {
        b.onclick = async function () {
          var p = ps[+b.dataset.p];
          if (b.dataset.m === 'usar') return usarTexto(p.texto, false, { ferramenta: 'prontas' });
          var c = precisaConversa(); if (!c) return;
          try { carregando('Adaptando a resposta pronta à conversa…'); var r = await ia('personalizar', c, { base: p.texto }); var k = cartao('Resposta pronta adaptada', r.texto, { logId: r.log_id, ferramenta: 'personalizar' }); res(k.html); k.ligar(); agora('Pronto.', 'ok'); }
          catch (e) { falhou(e); }
        };
      });
    },
    lead: async function () {
      var c = precisaConversa(); if (!c) return;
      if (c.grupo) return res('<p class="erro">Abra a conversa individual do contato para criar o lead.</p>');
      carregando('Lendo os dados do contato na conversa…');
      var r = await ia('lead', c);
      var fone = r.telefone || (/^\d{8,15}@c\.us$/.test(c.chave) ? '+' + c.chave.split('@')[0] : '');
      res('<form class="bloco form" id="f-lead"><h3>Lead no CRM</h3><p class="mut">Confira os dados. Nada é criado até você confirmar.</p>' +
        '<label>Nome<input name="nome" required value="' + esc(r.nome || c.nome) + '"></label><label>E-mail<input name="email" type="email" value="' + esc(r.email) + '"></label>' +
        '<label>Telefone<input name="telefone" value="' + esc(fone) + '" placeholder="+1 407 555 0100"></label><label>Interesse<input name="assunto" value="' + esc(r.assunto) + '"></label>' +
        '<label>Resumo<textarea name="resumo" rows="2">' + esc(r.resumo) + '</textarea></label><button class="bt pri">Criar lead no CRM</button><p class="erro" role="alert"></p></form>');
      agora('Confira os dados do lead.', 'ok');
      $('#f-lead').onsubmit = async function (e) {
        e.preventDefault(); var f = new FormData(this), err = this.querySelector('.erro'); err.textContent = '';
        try {
          var o = await api({ acao: 'ext_lead', conversa: ref(c), nome: f.get('nome'), email: f.get('email'), telefone: f.get('telefone'), assunto: f.get('assunto'), resumo: f.get('resumo') });
          res('<div class="bloco ok"><p>' + (o.novo ? 'Lead criado no CRM.' : 'Contato já estava no CRM: a conversa foi anotada nele.') + '</p><a href="' + esc(o.link) + '" target="_blank" rel="noopener">Abrir o CRM</a></div>');
          agora('Lead salvo no CRM ✓', 'ok');
        } catch (x) { err.textContent = x.message; }
      };
    },
    agenda: async function () {
      var c = precisaConversa(); if (!c) return;
      carregando('Buscando horários livres na agenda…');
      var h = await api({ acao: 'ext_horarios' });
      if (!h.horarios.length) { res('<p class="erro">Não há horários livres nos próximos 14 dias.</p>'); return agora('Sem horários livres.', 'alerta'); }
      var fone = /^\d{8,15}@c\.us$/.test(c.chave) ? '+' + c.chave.split('@')[0] : '';
      var tres = h.legiveis.slice(0, 3);
      var oferta = 'Tenho estes horários livres para conversarmos: ' + tres.join('; ') + '. Qual fica melhor para você? Se preferir, escolha outro aqui: ' + S.ajustes.link_agenda;
      var k = cartao('Oferecer horários', oferta, { ferramenta: 'agendamento' });
      res(k.html + '<form class="bloco form" id="f-ag"><h3>Marcar na agenda</h3><p class="mut">Use quando o contato já escolheu. A confirmação vai por e-mail (e WhatsApp, se ligado).</p>' +
        '<label>Horário<select name="inicio">' + h.horarios.slice(0, 40).map(function (x, i) { return '<option value="' + esc(x) + '">' + esc(h.legiveis[i]) + '</option>'; }).join('') + '</select></label>' +
        '<label>Nome<input name="nome" required value="' + esc(c.grupo ? '' : c.nome) + '"></label><label>E-mail<input name="email" type="email" required></label>' +
        '<label>Telefone<input name="telefone" required value="' + esc(fone) + '" placeholder="+1 407 555 0100"></label>' +
        '<label>Tipo<select name="tipo"><option value="whatsapp">WhatsApp</option><option value="video">Vídeo</option><option value="phone">Telefone</option></select></label>' +
        '<button class="bt pri">Marcar horário</button><p class="erro" role="alert"></p></form>');
      k.ligar(); agora('Horários carregados.', 'ok');
      $('#f-ag').onsubmit = async function (e) {
        e.preventDefault(); var f = new FormData(this), err = this.querySelector('.erro'); err.textContent = '';
        try {
          var o = await api({ acao: 'ext_agendar', conversa: ref(c), inicio: f.get('inicio'), nome: f.get('nome'), email: f.get('email'), telefone: f.get('telefone'), tipo: f.get('tipo'), timezone: h.timezone });
          var k2 = cartao('Confirmar ao contato', o.mensagem, { ferramenta: 'agendamento' });
          res('<div class="bloco ok"><p>Horário marcado: ' + esc(o.quando) + '.</p></div>' + k2.html); k2.ligar();
          agora('Horário marcado ✓', 'ok');
        } catch (x) { err.textContent = x.message; }
      };
    },
    proposta: async function () {
      var c = precisaConversa(); if (!c) return;
      carregando('Escrevendo a mensagem da proposta…');
      var fone = /^\d{8,15}@c\.us$/.test(c.chave) ? '+' + c.chave.split('@')[0] : '';
      var rr = await Promise.all([ia('proposta', c), api({ acao: 'ext_propostas', telefone: fone }).catch(function () { return { propostas: [] }; })]);
      var r = rr[0], ps = rr[1];
      var k = cartao('Mensagem da proposta (sem preços)', r.mensagem, { logId: r.log_id, ferramenta: 'proposta' });
      var lista = (ps.propostas || []).filter(function (p) { return p.link; });
      res(k.html + '<div class="bloco"><h3>Propostas deste contato</h3>' + (lista.length ? lista.map(function (p, i) {
        return '<div class="pronta"><b>' + esc(p.titulo) + '</b> <span class="tag">' + esc(p.status) + '</span><div class="linha"><button class="bt mini" data-pl="' + i + '">Digitar o link</button></div></div>';
      }).join('') : '<p class="mut">Nenhuma proposta enviada para este contato. Os valores ficam só na proposta oficial.</p>') +
        '<a href="' + esc(ps.nova || 'https://endeavorbiz.com/admin.html#/pagamentos?tab=nova-proposta') + '" target="_blank" rel="noopener">Criar proposta no admin</a></div>');
      k.ligar();
      $$('[data-pl]').forEach(function (b) { b.onclick = function () { usarTexto('Aqui está a sua proposta da Endeavor: ' + lista[+b.dataset.pl].link, false, { ferramenta: 'proposta' }); }; });
      agora('Proposta pronta para revisar.', 'ok');
    },
    traduzir: async function () {
      var c = W.conversaAberta();
      var ult = c ? C.ultimaRecebida(c.mensagens) : null;
      res('<div class="bloco form"><h3>Tradução</h3>' +
        (ult ? '<button class="bt" id="t-ult">Traduzir a última mensagem recebida</button>' : '<p class="mut">Sem mensagem recebida para traduzir nesta conversa.</p>') +
        '<label>Meu texto<textarea id="t-txt" rows="3" placeholder="Escreva em português e traduza para o idioma do contato"></textarea></label>' +
        '<label>Para<select id="t-para"><option value="en-US">Inglês</option><option value="es-ES">Espanhol</option><option value="pt-BR">Português</option><option value="fr-FR">Francês</option><option value="it-IT">Italiano</option></select></label>' +
        '<button class="bt pri" id="t-ir">Traduzir meu texto</button></div><div id="t-out"></div>');
      var alvo = { chave: (c && c.chave) || 'sem-conversa', nome: (c && c.nome) || '', grupo: !!(c && c.grupo), mensagens: [] };
      if (ult) $('#t-ult').onclick = async function () {
        try { agora('Traduzindo…', 'pensando'); var r = await ia('traduzir', alvo, { texto: ult.texto, idioma_destino: S.ajustes.idioma });
          $('#t-out').innerHTML = '<div class="bloco"><div class="cartao-rot">Tradução (' + esc(r.idioma_origem || '?') + ' → ' + esc(S.ajustes.idioma) + ')</div><p>' + esc(r.traducao) + '</p></div>'; agora('Traduzido.', 'ok'); }
        catch (e) { falhou(e); }
      };
      $('#t-ir').onclick = async function () {
        var t = $('#t-txt').value.trim(); if (!t) return;
        try { agora('Traduzindo…', 'pensando'); var r = await ia('traduzir', alvo, { texto: t, idioma_destino: $('#t-para').value });
          var k = cartao('Tradução', r.traducao, { logId: r.log_id, ferramenta: 'traduzir' }); $('#t-out').innerHTML = k.html; k.ligar(); agora('Traduzido.', 'ok'); }
        catch (e) { falhou(e); }
      };
    }
  };
  $$('[data-f]').forEach(function (b) {
    b.onclick = function () { $$('[data-f]').forEach(function (x) { x.removeAttribute('aria-current'); }); b.setAttribute('aria-current', 'true'); FERR[b.dataset.f]().catch(falhou); };
  });

  /* ---------------- comando por texto e por voz ---------------- */
  async function comando() {
    var pedido = $('#cmd').value.trim(); if (!pedido) return;
    var c = W.conversaAberta() || { chave: 'sem-conversa', nome: '', grupo: false, mensagens: [] };
    try {
      carregando('Entendendo o comando…');
      var r = await ia('comando', c, { pedido: pedido });
      var mapa = { resumo: 'resumo', lead: 'lead', proposta: 'proposta', traduzir: 'traduzir', agendar: 'agenda' };
      if (mapa[r.acao]) return FERR[mapa[r.acao]]();
      if (r.acao === 'nada' || !r.texto) { res('<div class="bloco"><p>' + esc(r.texto || 'Não entendi o comando. Tente de outro jeito.') + '</p></div>'); return agora('Pronto.', 'ok'); }
      var k = cartao('Mensagem pelo comando', r.texto, { logId: r.log_id, ferramenta: 'comando' }); res(k.html); k.ligar();
      $('#cmd').value = ''; agora('Mensagem pronta. Revise e escolha digitar ou enviar.', 'ok');
    } catch (e) { falhou(e); }
  }
  $('#cmd-ir').onclick = comando;
  $('#cmd').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); comando(); } });
  (function voz() {
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, mic = $('#mic');
    mic.onclick = function () {
      if (!Rec) { $('#mic-st').textContent = 'Comando de voz indisponível neste navegador.'; return; }
      if (rec) { rec.stop(); return; }
      rec = new Rec(); rec.lang = S.ajustes.idioma; rec.interimResults = true; rec.continuous = false;
      var final = '';
      mic.setAttribute('aria-pressed', 'true'); mic.classList.add('gravando'); $('#mic-st').textContent = 'Ouvindo… fale o comando.';
      rec.onresult = function (e) {
        var parcial = ''; final = '';
        for (var i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else parcial += e.results[i][0].transcript; }
        $('#cmd').value = (final + parcial).trim();
      };
      rec.onerror = function (e) { $('#mic-st').textContent = e.error === 'not-allowed' ? 'Permita o microfone para o WhatsApp Web no Chrome.' : 'Não ouvi. Tente de novo.'; };
      rec.onend = function () {
        rec = null; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('gravando');
        if (final.trim()) { $('#mic-st').textContent = 'Transcrito. Enviando o comando…'; setTimeout(comando, 700); } else if (!/Permita/.test($('#mic-st').textContent)) $('#mic-st').textContent = '';
      };
      rec.start();
    };
  })();

  /* ---------------- grupos ---------------- */
  function mostrarGrupo(r, c) {
    var g = $('#grupo'); g.hidden = false;
    g.innerHTML = '<h3>Assuntos do grupo</h3>' + ((r.topicos || []).length ? '<ul class="topicos">' + r.topicos.map(function (t) { return '<li><b>' + esc(t.assunto) + '</b> ' + esc(t.resumo) + '</li>'; }).join('') + '</ul>' : '<p class="mut">Sem assuntos novos.</p>') +
      (r.relevante ? '<p class="tag rel">Assunto com a empresa</p>' : '') + '<div id="g-sug"></div><button class="bt mini" id="g-ja">Analisar de novo</button>';
    if (r.texto) { var k = cartao('Sugestão para o grupo', r.texto, { logId: r.log_id, ferramenta: 'grupo' }); $('#g-sug').innerHTML = k.html; k.ligar(); }
    $('#g-ja').onclick = function () { analisarGrupo(c || W.conversaAberta(), true); };
  }
  async function analisarGrupo(c, manual) {
    if (!c || !c.grupo) return;
    try {
      agora('Lendo os assuntos do grupo…', 'pensando');
      var r = await ia('grupo', c);
      S.analiseGrupo[c.chave] = { em: Date.now(), r: r };
      if (mesmaConversa(c)) mostrarGrupo(r, c);
      agora(r.relevante ? 'Grupo: há assunto com a empresa.' : 'Grupo analisado.', r.relevante ? 'alerta' : 'ok');
    } catch (e) { if (manual) falhou(e); else agora(e.message, 'erro'); }
  }

  /* ---------------- IA Takeover ---------------- */
  async function responderAuto(c) {
    var ult = C.ultimaRecebida(c.mensagens);
    S.tratadas[c.chave] = ult && ult.id;
    S.ocupado = true; var ac = S.acao = { parar: false };
    try {
      agora('Takeover · lendo a conversa com ' + c.nome + '…', 'pensando');
      var r = await ia(c.grupo ? 'grupo' : 'responder', c, { takeover: true });
      if (c.grupo) { S.analiseGrupo[c.chave] = { em: Date.now(), r: r }; mostrarGrupo(r, c); }
      if (r.escalar) {
        agora(c.nome + ' precisa de você: ' + (r.motivo || 'assunto para a equipe'), 'alerta');
        msgBg({ tipo: 'aviso', titulo: c.nome + ' precisa de você', texto: r.motivo || 'A IA não respondeu: assunto para a equipe.' });
        return;
      }
      if (!r.responder) { agora('Takeover · sem resposta' + (r.motivo ? ': ' + r.motivo : '') + '.', 'ok'); return; }
      res('<div class="bloco"><div class="cartao-rot">Takeover vai responder ' + esc(c.nome) + '</div><p>' + esc(r.texto) + '</p></div>');
      var vou = Date.now();
      if (!await esperar(C.espera(S.ajustes), 'Takeover · esperando para digitar', ac)) return cancelar(r, c, 'Parado por você.');
      if (!mesmaConversa(c)) return cancelar(r, c, 'A conversa mudou antes de digitar.');
      if (W.textoNaCaixa() || S.teclouEm > vou) return cancelar(r, c, 'Você começou a escrever: a IA não digitou.');
      var d = await digitarVisivel(r.texto, ac, false);
      if (!d.ok) return cancelar(r, c, d.motivo === 'parado' ? 'Você assumiu a conversa: a IA parou e o texto ficou na caixa para você.' : 'A caixa estava ocupada.');
      if (!mesmaConversa(c)) { W.limparCaixa(); return cancelar(r, c, 'A conversa mudou: não enviei.'); }
      W.enviar();
      S.envios.push(Date.now()); if (c.grupo) S.ultGrupo[c.chave] = Date.now();
      api({ acao: 'ext_registrar', log_id: r.log_id, status: 'enviado', texto: r.texto, conversa: ref(c), aviso_incluido: !!r.aviso_incluido }).then(function () {
        if (r.aviso_incluido && S.conversas[c.chave]) S.conversas[c.chave].aviso_enviado = true;
      }).catch(function () { });
      await esperar(C.pausa(S.ajustes), 'Enviado ✓ · pausa', ac);
      agora('Takeover · respondeu ' + c.nome + ' ✓', 'ok');
    } catch (e) { agora('Takeover: ' + e.message, 'erro'); }
    finally { S.ocupado = false; S.acao = null; $('#parar').hidden = true; }
  }
  function cancelar(r, c, motivo) {
    agora(motivo, 'alerta');
    api({ acao: 'ext_registrar', log_id: r.log_id, status: 'descartado', conversa: ref(c) }).catch(function () { });
  }
  async function sugerirAuto(c) {
    var ult = C.ultimaRecebida(c.mensagens); S.tratadas[c.chave] = ult && ult.id;
    if (c.grupo) {
      var a = S.analiseGrupo[c.chave];
      if (a && Date.now() - a.em < 120000) return; // no máximo uma análise a cada 2 min por grupo
      return analisarGrupo(c, false);
    }
    S.ocupado = true;
    try { await FERR.sugerir(); } catch (e) { agora(e.message, 'erro'); } finally { S.ocupado = false; }
  }

  var ultimaChave = null, tickAgendado = null;
  async function tick(forcar) {
    if (!S.conectado || !W.pronto()) return;
    var c = W.conversaAberta();
    if ((c && c.chave) !== ultimaChave) { if (ultimaChave) res(''); ultimaChave = c && c.chave; S.atual = c; desenharConversa(c); }
    if (!c) return procurarNaoLidas();
    // primeira vez que a conversa aparece: não responde mensagem antiga (só a que chegou agora ou se a IA abriu a conversa)
    var ult = C.ultimaRecebida(c.mensagens);
    if (!(c.chave in S.vistas)) {
      S.vistas[c.chave] = true;
      if (ult && !forcar && !S.abertaPelaIA[c.nome] && !C.recente(ult.hora, new Date(), 2)) S.tratadas[c.chave] = ult.id;
    }
    delete S.abertaPelaIA[c.nome]; delete S.tentativas[c.nome];
    if (S.ocupado || S.pausado) return;
    var st = estado(c);
    if (ult && S.tratadas[c.chave] !== ult.id) {
      if (S.ajustes.takeover && st.takeover && st.seguir) return responderAuto(c);
      if (st.seguir) return sugerirAuto(c);
    }
    procurarNaoLidas();
  }
  function procurarNaoLidas() {
    if (S.ocupado || S.pausado || !S.ajustes.takeover) return;
    if (Date.now() - S.humanoEm < 30000 || W.textoNaCaixa()) return; // a pessoa está usando o WhatsApp
    var alvo = W.naoLidas().find(function (x) {
      var st = porNome(x.nome);
      return st ? st.takeover && st.seguir : S.ajustes.takeover_individual;
    });
    if (!alvo) return;
    // não insiste: se a conversa não abrir, espera 10 min antes de tentar de novo a mesma
    var t = S.tentativas[alvo.nome] || { n: 0, em: 0, ate: 0 };
    if (Date.now() < t.ate || Date.now() - t.em < 6000) return;
    t.n++; t.em = Date.now();
    if (t.n > 2) { t.ate = Date.now() + 600000; t.n = 0; S.tentativas[alvo.nome] = t; agora('Takeover · não consegui abrir a conversa com ' + alvo.nome + '. Abra a conversa para a IA responder.', 'alerta'); return; }
    S.tentativas[alvo.nome] = t;
    S.abertaPelaIA[alvo.nome] = true;
    agora('Takeover · abrindo a conversa com ' + alvo.nome + '…', 'pensando');
    W.abrir(alvo.linha);
  }
  function agendarTick() { clearTimeout(tickAgendado); tickAgendado = setTimeout(function () { tick(false); }, 700); }

  $('#tk-geral').onchange = function () { salvarAjustes({ takeover: this.checked }); };
  $('#pausar').onclick = function () { S.pausado = !S.pausado; if (S.pausado && S.acao) S.acao.parar = true; guardar({ pausado: S.pausado }); pontos(); agora(S.pausado ? 'IA em pausa. Nada é enviado sozinho.' : 'IA retomada.', S.pausado ? 'alerta' : 'ok'); };

  /* ---------------- tempos humanos (ajustáveis no painel; os mesmos do admin) ---------------- */
  var CAMPOS = [['espera_min', 'Esperar antes de digitar · mín (s)'], ['espera_max', 'Esperar · máx (s)'], ['velocidade', 'Velocidade (caracteres/min)'], ['variacao', 'Variação da velocidade (%)'],
    ['pausa_min', 'Pausa depois de enviar · mín (s)'], ['pausa_max', 'Pausa · máx (s)'], ['digitar_max', 'Tempo máximo digitando (s)'], ['limite_hora', 'Respostas automáticas por hora'], ['grupo_intervalo', 'Intervalo no mesmo grupo (min)']];
  function desenharTempos() {
    $('#tempos-campos').innerHTML = CAMPOS.map(function (k) { return '<label>' + k[1] + '<input type="number" step="1" data-t="' + k[0] + '" value="' + esc(S.ajustes[k[0]]) + '"></label>'; }).join('');
    $$('[data-t]').forEach(function (i) { i.onchange = function () { var o = {}; o[i.dataset.t] = Number(i.value); salvarAjustes(o); }; });
  }
  var salvando = null;
  function salvarAjustes(parcial) {
    S.ajustes = C.limparAjustes(Object.assign({}, S.ajustes, parcial)); pontos();
    clearTimeout(salvando);
    salvando = setTimeout(async function () {
      try { var r = await api({ acao: 'ext_ajustes', ajustes: parcial, version: S.version }); S.ajustes = r.ajustes; S.version = r.version; desenharTempos(); pontos(); agora('Ajustes salvos.', 'ok'); }
      catch (e) { agora(e.message, 'erro'); if (e.status === 409) ping(true); }
    }, 500);
  }

  /* ---------------- conexão ---------------- */
  async function iniciar() {
    try {
      var r = await api({ acao: 'ext_iniciar', versao: VERSAO });
      S.conectado = true; S.ajustes = r.ajustes; S.version = r.version; S.usuario = r.usuario;
      S.conversas = {}; (r.conversas || []).forEach(function (x) { S.conversas[x.chave] = x; });
      $('#conectar').hidden = true; $('#app').hidden = false;
      $('#quem').textContent = r.usuario || r.dispositivo || '';
      desenharTempos(); pontos();
      agora(r.ia ? (S.ajustes.takeover ? 'Pronta. IA Takeover ligado nas conversas marcadas.' : 'Pronta.') : 'O Hub AI não está configurado no servidor.', r.ia ? 'ok' : 'erro');
      ultimaChave = undefined; tick(false);
    } catch (e) {
      S.conectado = false;
      $('#app').hidden = true; $('#conectar').hidden = false;
      $('#cod-erro').textContent = e.status === 401 ? (e.message.indexOf('não conectada') >= 0 ? '' : e.message) : e.message;
    }
  }
  $('#cod-ir').onclick = async function () {
    var r = await msgBg({ tipo: 'conectar', token: $('#cod').value });
    if (!r.ok) { $('#cod-erro').textContent = 'Código inválido. Copie de novo o código do admin.'; return; }
    $('#cod').value = ''; iniciar();
  };
  $('#diag').onclick = function () {
    var d; try { d = W.diagnostico(); } catch (e) { d = { erro: String(e && e.message) }; }
    d.extensao = VERSAO; d.navegador = navigator.userAgent.replace(/\d+\.\d+\.\d+(\.\d+)?/g, 'x');
    var txt = 'Diagnóstico My WhatsApp Manager (sem texto das mensagens):\n' + JSON.stringify(d);
    navigator.clipboard.writeText(txt).then(function () { agora('Diagnóstico copiado. Cole no chat com o Claude.', 'ok'); }, function () { agora('Não consegui copiar. Tente de novo.', 'erro'); });
  };
  $('#sair').onclick = async function () { await msgBg({ tipo: 'desconectar' }); S.conectado = false; $('#app').hidden = true; $('#conectar').hidden = false; };
  async function ping(forcar) {
    if (!S.conectado) return;
    try {
      var r = await api({ acao: 'ext_ping', version: forcar ? -1 : S.version, estado: { takeover_ativo: S.ajustes.takeover && !S.pausado, pausado: S.pausado, conversa: S.atual ? S.atual.nome : '', whatsapp: W.pronto() } });
      if (r.ajustes) { S.ajustes = r.ajustes; S.version = r.version; desenharTempos(); pontos(); }
    } catch (e) { if (e.status === 401) iniciar(); }
  }

  /* ---------------- partida ---------------- */
  ler(['aberto', 'largura', 'pausado']).then(function (p) {
    if (p.aberto === false) S.aberto = false;
    if (p.largura) S.largura = Math.max(300, Math.min(640, +p.largura));
    S.pausado = p.pausado === true;
    montar(); aplicarAberto(); pontos(); iniciar();
    new MutationObserver(agendarTick).observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(function () { tick(false); }, 4000);
    setInterval(function () { ping(false); }, 60000);
  });
  window.__emgr = { S: S, tick: tick };
})();
