/* LinkedIn Manager · painel ao lado do LinkedIn.
 * Lê SÓ o que está visível na tela (feed, grupos e mensagens), compara com as palavras-chave e, quando você pede (ou no modo
 * automático que você ligou), chama o agente da Endeavor para escrever a resposta. Nada é guardado nem enviado em massa.
 * Manual por padrão: Copiar, Colar na caixa ou Ignorar. Mensagens privadas nunca são automáticas. */
(function () {
  'use strict';
  if (window.__endeavorLi) return; window.__endeavorLi = true;
  var C = globalThis.ELiCore, L = (navigator.language || 'pt').slice(0, 2); if (['pt', 'en', 'es'].indexOf(L) < 0) L = 'en';
  var TX = {
    pt: { titulo: 'LinkedIn Manager', conectar: 'Abra as opções da extensão e cole a URL do agente e o token.', opcoes: 'Opções', nada: 'Nenhuma oportunidade na tela agora. Role o feed, abra um grupo ou uma conversa.', sugerir: 'Sugerir resposta', pensando: 'Escrevendo…',
      copiar: 'Copiar', colar: 'Colar na caixa', ignorar: 'Ignorar', copiado: 'Copiado.', colado: 'Colado na caixa. Revise e envie.', semCaixa: 'Clique primeiro na caixa de comentário ou de mensagem.', lead: 'Lead', feed: 'Feed', grupo: 'Grupo', dm: 'Mensagem privada',
      manual: 'Manual', auto: 'Automático', autoOn: 'Automático ligado: risco para a conta. Mensagens privadas continuam manuais.', enviado: 'Enviado automaticamente.', bloqueado: 'Sem resposta segura para este texto.', hoje: 'hoje', esconder: 'Esconder', digitando: 'Digitando…', dmManual: 'Mensagem privada: só sugestão, você envia.' },
    en: { titulo: 'LinkedIn Manager', conectar: 'Open the extension options and paste the agent URL and token.', opcoes: 'Options', nada: 'No opportunities on screen right now. Scroll the feed, open a group or a conversation.', sugerir: 'Suggest reply', pensando: 'Writing…',
      copiar: 'Copy', colar: 'Paste in box', ignorar: 'Ignore', copiado: 'Copied.', colado: 'Pasted. Review and send.', semCaixa: 'Click the comment or message box first.', lead: 'Lead', feed: 'Feed', grupo: 'Group', dm: 'Private message',
      manual: 'Manual', auto: 'Automatic', autoOn: 'Automatic is on: account risk. Private messages stay manual.', enviado: 'Sent automatically.', bloqueado: 'No safe reply for this text.', hoje: 'today', esconder: 'Hide', digitando: 'Typing…', dmManual: 'Private message: suggestion only, you send it.' },
    es: { titulo: 'LinkedIn Manager', conectar: 'Abra las opciones de la extensión y pegue la URL del agente y el token.', opcoes: 'Opciones', nada: 'No hay oportunidades en pantalla ahora. Desplace el feed, abra un grupo o una conversación.', sugerir: 'Sugerir respuesta', pensando: 'Escribiendo…',
      copiar: 'Copiar', colar: 'Pegar en la caja', ignorar: 'Ignorar', copiado: 'Copiado.', colado: 'Pegado. Revise y envíe.', semCaixa: 'Haga clic primero en la caja de comentario o de mensaje.', lead: 'Lead', feed: 'Feed', grupo: 'Grupo', dm: 'Mensaje privado',
      manual: 'Manual', auto: 'Automático', autoOn: 'Automático activado: riesgo para la cuenta. Los mensajes privados siguen manuales.', enviado: 'Enviado automáticamente.', bloqueado: 'Sin respuesta segura para este texto.', hoje: 'hoy', esconder: 'Ocultar', digitando: 'Escribiendo…', dmManual: 'Mensaje privado: solo sugerencia, usted lo envía.' }
  }[L];
  var S = { cfg: C.limpar({}), srv: null, itens: [], vistos: {}, ignorados: {}, caixa: null, ocupado: false, proximoAuto: 0, aberto: true };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var api = function (corpo) { return new Promise(function (ok, erro) { try { chrome.runtime.sendMessage({ tipo: 'api', corpo: corpo }, function (r) { if (chrome.runtime.lastError || !r) return erro(new Error('ext')); r.erro ? erro(new Error(r.erro)) : ok(r.ok); }); } catch (e) { erro(e); } }); };
  var espera = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var hash = function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

  /* ---------- painel ---------- */
  var box = document.createElement('aside'); box.id = 'eli'; box.setAttribute('aria-label', 'LinkedIn Manager');
  document.documentElement.appendChild(box);
  function desenhar() {
    var modo = S.cfg.modo === 'auto' && S.srv && S.srv.ext && S.srv.ext.modo === 'auto' ? 'auto' : 'manual';
    box.className = S.aberto ? '' : 'eli-min';
    box.innerHTML = '<header><strong>' + TX.titulo + '</strong><span class="eli-modo eli-modo--' + modo + '">' + TX[modo] + '</span><button type="button" id="eli-x" aria-label="' + TX.esconder + '">' + (S.aberto ? '–' : 'in') + '</button></header>' +
      (!S.aberto ? '' : !S.cfg.token ? '<p class="eli-vazio">' + TX.conectar + '</p><button type="button" class="eli-bt" id="eli-op">' + TX.opcoes + '</button>' :
        (modo === 'auto' ? '<p class="eli-risco">' + TX.autoOn + (S.srv ? ' ' + (S.srv.enviados_hoje || 0) + '/' + S.srv.ext.limite_dia + ' ' + TX.hoje : '') + '</p>' : '') +
        (S.itens.length ? S.itens.map(function (it) {
          return '<article data-k="' + it.k + '"><div class="eli-top"><span class="eli-tag">' + TX[it.origem] + '</span>' + (it.r && it.r.lead ? '<span class="eli-tag eli-lead">' + TX.lead + '</span>' : '') + '<span class="eli-kw">' + esc(it.palavras.join(', ')) + '</span></div>' +
            '<p class="eli-txt"><b>' + esc(it.autor) + '</b> ' + esc(it.texto.slice(0, 220)) + (it.texto.length > 220 ? '…' : '') + '</p>' +
            (it.r && it.r.reply ? '<textarea rows="4" aria-label="' + TX.sugerir + '">' + esc(it.r.reply) + '</textarea>' + (it.origem === 'dm' ? '<p class="eli-nota">' + TX.dmManual + '</p>' : '') +
              '<div class="eli-bts"><button type="button" class="eli-bt" data-a="copiar">' + TX.copiar + '</button><button type="button" class="eli-bt eli-bt--p" data-a="colar">' + TX.colar + '</button><button type="button" class="eli-bt eli-bt--x" data-a="ignorar">' + TX.ignorar + '</button></div>'
              : '<div class="eli-bts"><button type="button" class="eli-bt eli-bt--p" data-a="sugerir"' + (it.espera ? ' disabled' : '') + '>' + (it.espera ? TX.pensando : TX.sugerir) + '</button><button type="button" class="eli-bt eli-bt--x" data-a="ignorar">' + TX.ignorar + '</button></div>') +
            (it.msg ? '<p class="eli-nota" role="status">' + esc(it.msg) + '</p>' : '') + '</article>';
        }).join('') : '<p class="eli-vazio">' + TX.nada + '</p>'));
    box.querySelector('#eli-x').onclick = function () { S.aberto = !S.aberto; desenhar(); };
    var op = box.querySelector('#eli-op'); if (op) op.onclick = function () { chrome.runtime.sendMessage({ tipo: 'opcoes' }); };
    box.querySelectorAll('article').forEach(function (art) {
      var it = S.itens.filter(function (x) { return x.k === art.dataset.k; })[0];
      art.querySelectorAll('[data-a]').forEach(function (bt) { bt.onclick = function () { acao(it, bt.dataset.a, art.querySelector('textarea')); }; });
    });
  }
  async function acao(it, a, ta) {
    if (ta) it.r.reply = ta.value;
    if (a === 'ignorar') { S.ignorados[it.k] = 1; S.itens = S.itens.filter(function (x) { return x !== it; }); api({ acao: 'ext_registrar', origem: it.origem, feito: 'ignorado' }).catch(function () { }); return desenhar(); }
    if (a === 'sugerir') return sugerir(it);
    if (a === 'copiar') { try { await navigator.clipboard.writeText(it.r.reply); it.msg = TX.copiado; } catch (e) { it.msg = 'Ctrl+C'; } api({ acao: 'ext_registrar', origem: it.origem, feito: 'copiado' }).catch(function () { }); return desenhar(); }
    if (a === 'colar') {
      var cx = S.caixa && document.contains(S.caixa) ? S.caixa : null;
      if (!cx) { it.msg = TX.semCaixa; return desenhar(); }
      cx.focus(); document.execCommand('insertText', false, it.r.reply); // cola de uma vez; quem envia é você
      it.msg = TX.colado; api({ acao: 'ext_registrar', origem: it.origem, feito: 'colado' }).catch(function () { }); desenhar();
    }
  }
  async function sugerir(it) {
    it.espera = true; it.msg = ''; desenhar();
    try { it.r = await api({ acao: 'ext_agente', origem: it.origem, texto: it.texto, autor: it.autor }); if (!it.r.reply) it.msg = TX.bloqueado; }
    catch (e) { it.msg = e.message; }
    it.espera = false; desenhar();
    return it.r;
  }

  /* ---------- leitura da tela (só o que está visível) ---------- */
  function visivel(el) { var r = el.getBoundingClientRect(); return r.height > 20 && r.bottom > 80 && r.top < innerHeight - 40; }
  function ler() {
    var origem = C.origemDe(location.pathname), palavras = (S.srv ? S.srv.palavras : []).concat(S.cfg.palavras), achados = [];
    var nos = origem === 'dm' ? document.querySelectorAll('.msg-s-event-listitem:not(.msg-s-event-listitem--other) ~ .msg-s-event-listitem--other, .msg-s-event-listitem--other')
      : document.querySelectorAll('div.feed-shared-update-v2, [data-urn^="urn:li:activity"], [data-id^="urn:li:activity"]');
    nos.forEach(function (el) {
      if (!visivel(el)) return;
      var corpo = el.querySelector(origem === 'dm' ? '.msg-s-event-listitem__body' : '.update-components-text, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text') || el;
      var texto = (corpo.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
      if (texto.length < 20) return;
      var k = hash(texto.slice(0, 300)); if (S.ignorados[k]) return;
      var kw = C.oportunidade(texto, palavras); if (!kw.length) return;
      var au = el.querySelector(origem === 'dm' ? '.msg-s-message-group__name, .msg-s-event-listitem__name' : '.update-components-actor__title span[aria-hidden="true"], .update-components-actor__name');
      achados.push({ k: k, origem: origem, texto: texto, autor: au ? (au.innerText || '').trim().slice(0, 80) : '', palavras: kw, el: el });
    });
    // mantém o que já tem resposta; no máximo 6 cartões
    var novos = achados.filter(function (a) { return !S.itens.some(function (x) { return x.k === a.k; }); });
    var antes = S.itens.length;
    S.itens = S.itens.filter(function (x) { return x.r || achados.some(function (a) { return a.k === x.k; }); }).concat(novos).slice(-6);
    if (novos.length || antes !== S.itens.length) desenhar();
    automatico();
  }

  /* ---------- modo automático (opcional; só feed e grupos; limites conferidos no servidor) ---------- */
  async function digitar(cx, texto) {
    var d = C.atrasos(texto, S.cfg.velocidade);
    cx.focus();
    for (var i = 0; i < texto.length; i++) { document.execCommand('insertText', false, texto[i]); await espera(d[i]); }
  }
  async function automatico() {
    if (S.ocupado || S.cfg.modo !== 'auto' || !S.srv || S.srv.ext.modo !== 'auto' || Date.now() < S.proximoAuto || document.hidden) return;
    var it = S.itens.filter(function (x) { return x.origem !== 'dm' && !x.r && !x.espera && !S.vistos[x.k] && x.el && document.contains(x.el); })[0];
    if (!it) return;
    S.ocupado = true; S.vistos[it.k] = 1;
    try {
      var r = await sugerir(it);
      if (C.podeAuto(S.cfg, it.origem, r)) {
        await espera(1500 + Math.random() * 3500);
        var bt = it.el.querySelector('button[aria-label*="omment" i], button[aria-label*="omentar" i], button.comment-button'); if (bt) bt.click();
        await espera(900 + Math.random() * 900);
        var cx = it.el.querySelector('.ql-editor[contenteditable="true"], [role="textbox"][contenteditable="true"]');
        if (!cx) throw new Error(TX.semCaixa);
        it.msg = TX.digitando; desenhar();
        await api({ acao: 'ext_registrar', origem: it.origem, feito: 'enviado_auto' }); // o servidor confere limite diário e intervalo ANTES de enviar
        await digitar(cx, r.reply);
        await espera(600 + Math.random() * 1200);
        var env = it.el.querySelector('button.comments-comment-box__submit-button, button[class*="submit-button"]');
        if (!env) throw new Error(TX.colado);
        env.click(); it.msg = TX.enviado; if (S.srv) S.srv.enviados_hoje = (S.srv.enviados_hoje || 0) + 1;
        S.proximoAuto = Date.now() + C.proximoIntervalo(S.cfg);
      }
    } catch (e) { it.msg = e.message; S.proximoAuto = Date.now() + 60000; }
    S.ocupado = false; desenhar();
  }

  /* ---------- início ---------- */
  document.addEventListener('focusin', function (e) { var c = e.target && e.target.closest && e.target.closest('[contenteditable="true"]'); if (c && !box.contains(c)) S.caixa = c; });
  async function iniciar() {
    var st = await chrome.storage.local.get('cfg'); S.cfg = C.limpar(st.cfg);
    if (S.cfg.token) { try { S.srv = await api({ acao: 'ext_iniciar' }); } catch (e) { S.srv = null; } }
    desenhar(); ler();
  }
  chrome.storage.onChanged.addListener(function (ch) { if (ch.cfg) iniciar(); });
  var t = null; var agendar = function () { clearTimeout(t); t = setTimeout(ler, 700); };
  window.addEventListener('scroll', agendar, { passive: true, capture: true });
  setInterval(ler, 4000);
  iniciar();
})();
