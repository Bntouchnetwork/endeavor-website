/* My WhatsApp Manager · leitura e escrita na página do WhatsApp Web.
 * O WhatsApp muda as classes com frequência, então cada busca tenta vários seletores estáveis (#main, data-id,
 * data-pre-plain-text, contenteditable do rodapé, botão Enviar, #pane-side). Se algo não for encontrado, a função
 * devolve null e o painel avisa, em vez de agir às cegas. */
(function (raiz) {
  'use strict';
  var C = raiz.EWaCore;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function principal() { return document.getElementById('main'); }

  var RE_HORA = /(\d{1,2}:\d{2}(?:\s?[AaPp]\.?\s?[Mm]\.?)?)\s*$/;
  function limpo(t) { return String(t || '').replace(/[‎‏​]/g, '').trim(); }
  function topo(lista) { return lista.filter(function (el) { return !lista.some(function (o) { return o !== el && o.contains(el); }); }); }

  /** Linhas de mensagem do chat aberto. O WhatsApp muda a estrutura, então tenta, em ordem:
   *  1) elementos com data-id;  2) linhas role="row";  3) bolhas .message-in/.message-out ou com data-pre-plain-text. */
  function linhas(main) {
    var area = $('[data-tab="8"]', main) || $('[role="application"]', main) || main;
    var porId = topo($$('[data-id]', area).filter(function (el) { return !el.closest('header, footer'); }));
    var rows = topo($$('[role="row"]', area).filter(function (el) { return !el.closest('header, footer'); }));
    var bolhas = topo($$('.message-in, .message-out, [data-pre-plain-text]', area));
    var melhor = [porId, rows, bolhas].map(function (l) { return l.filter(ehMensagem); }).sort(function (a, b) { return b.length - a.length; })[0];
    return melhor || [];
  }
  /** Só linhas que são mensagem (têm texto de mensagem, autor/hora ou mídia), não o separador "Hoje" nem o cartão do perfil. */
  function ehMensagem(el) {
    if ($('[data-pre-plain-text], .copyable-text, span.selectable-text, .message-in, .message-out', el) || /message-(in|out)/.test(el.className || '')) return true;
    if (midiaDa(el)) return true;
    var t = limpo(el.innerText);
    return t.length > 0 && RE_HORA.test(t) && t.length < 6000;
  }
  function textoDa(linha) {
    var spans = topo($$('.copyable-text span.selectable-text, span.selectable-text', linha));
    var t = spans.length ? spans.map(function (s) { return s.innerText || s.textContent || ''; }).join('\n') : '';
    if (!t) { var cp = $('.copyable-text', linha); if (cp) t = cp.innerText || cp.textContent || ''; }
    if (!t) {
      // sem as classes antigas: o texto visível da bolha, sem a hora, "editada" e os vistos do fim
      var linhasTxt = limpo(linha.innerText).split('\n').map(limpo).filter(Boolean);
      while (linhasTxt.length && (/^(\d{1,2}:\d{2}(\s?[AaPp]\.?\s?[Mm]\.?)?|edited|editada|editado|forwarded|encaminhada)$/i.test(linhasTxt[linhasTxt.length - 1]))) linhasTxt.pop();
      if (linhasTxt.length) linhasTxt[linhasTxt.length - 1] = linhasTxt[linhasTxt.length - 1].replace(RE_HORA, '').trim();
      t = linhasTxt.filter(Boolean).join('\n');
    }
    return limpo(t);
  }
  function midiaDa(linha) {
    if ($('audio, [data-icon*="audio"], [data-icon*="ptt"], [aria-label*="voice" i], [aria-label*="áudio" i]', linha)) return 'áudio';
    if ($('img[src^="blob:"], [data-icon*="image"]', linha)) return 'imagem';
    if ($('video, [data-icon*="video"]', linha)) return 'vídeo';
    if ($('[data-icon*="document"], [data-icon*="doc"]', linha)) return 'documento';
    return '';
  }
  /** Minha mensagem? data-id → classe message-out → vistos (✓✓, relógio) → bolha alinhada à direita. */
  function minha(el, main) {
    var interno = $('[data-id]', el);
    var id = C.lerDataId(el.getAttribute('data-id') || (interno ? interno.getAttribute('data-id') : ''));
    if (id) return id.eu;
    if (/message-out/.test(el.className || '') || $('.message-out', el)) return true;
    if (/message-in/.test(el.className || '') || $('.message-in', el)) return false;
    if ($('[data-icon*="check"], [data-icon="msg-time"], [data-icon*="dblcheck"], [aria-label*=" Read " i], [aria-label*=" Delivered " i], [aria-label*=" Sent " i], [aria-label*="Lida" i], [aria-label*="Entregue" i], [aria-label*="Enviada" i]', el)) return true;
    var m = main.getBoundingClientRect(), b = (($('.copyable-text', el) || el.firstElementChild || el).getBoundingClientRect());
    return b.width > 0 && b.width < m.width * 0.9 && (b.left + b.width / 2) > (m.left + m.width / 2);
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function chaveDoNome(nome) { var d = String(nome || '').replace(/[^\d+]/g, ''); return /^\+?\d{8,15}$/.test(d) && /^[\d\s()+\-.]+$/.test(nome) ? d.replace('+', '') + '@c.us' : ''; }
  /** Grupo sem data-id: subtítulo do cabeçalho com a lista de participantes ("Ana, João, Você") ou ícone de grupo. */
  function pareceGrupo(cab, main, autores, nome) {
    if (!cab) return false;
    if ($('[data-icon*="group"], [data-icon="default-group"]', cab)) return true;
    var sub = $$('span[title], span[dir="auto"]', cab).map(function (s) { return s.getAttribute('title') || s.textContent || ''; }).filter(function (t) { return t && t !== nome; });
    if (sub.some(function (t) { return /,/.test(t) && /\b(you|você|voce|tú|tu)\b/i.test(t); })) return true;
    return autores.filter(function (a) { return a && a !== nome; }).length > 0 && autores.length > 1;
  }

  /** Conversa aberta: { chave, nome, grupo, mensagens:[{id, eu, autor, hora, texto, midia}] } ou null. */
  function conversaAberta() {
    var main = principal(); if (!main) return null;
    var cab = $('header', main);
    var nomeEl = cab && ($('span[dir="auto"][title]', cab) || $('[data-testid="conversation-info-header-chat-title"]', cab) || $('span[dir="auto"]', cab));
    var nome = nomeEl ? limpo(nomeEl.getAttribute('title') || nomeEl.textContent) : '';
    var chave = '', grupo = null, msgs = [], vistos = {}, autores = [];
    linhas(main).forEach(function (el) {
      var idAttr = el.getAttribute('data-id') || ($('[data-id]', el) ? $('[data-id]', el).getAttribute('data-id') : '');
      var id = C.lerDataId(idAttr);
      if (id && !chave) { chave = id.chave; grupo = id.grupo; }
      var pre = el.hasAttribute('data-pre-plain-text') ? el : $('[data-pre-plain-text]', el);
      var info = pre ? C.lerPrePlain(pre.getAttribute('data-pre-plain-text')) : null;
      var texto = textoDa(el), midia = texto ? '' : midiaDa(el);
      if (!texto && !midia) return;
      var eu = minha(el, main);
      var hora = info ? info.hora : ((RE_HORA.exec(limpo(el.innerText)) || [])[1] || '');
      if (!eu && info && info.autor) autores.push(info.autor);
      var base = idAttr || ('m' + hash((eu ? '1' : '0') + '|' + hora + '|' + (texto || midia)));
      vistos[base] = (vistos[base] || 0) + 1;
      // grupo sem data-pre-plain-text: o nome de quem escreveu é a primeira linha da bolha, num span[dir="auto"] próprio
      var autorBolha = '';
      if (!eu && !info && texto.indexOf('\n') > 0) {
        var prim = texto.split('\n')[0];
        if (prim.length <= 40 && $$('span[dir="auto"]', el).some(function (sp) { return limpo(sp.textContent) === prim; })) autorBolha = prim;
      }
      msgs.push({ id: vistos[base] > 1 ? base + '#' + vistos[base] : base, eu: eu, autor: eu ? 'EU' : (info && info.autor) || nome, hora: hora, texto: texto || '[' + midia + ']', midia: midia, _autorBolha: autorBolha });
    });
    if (!chave && !nome) return null;
    if (!chave) chave = chaveDoNome(nome);
    if (grupo === null) grupo = /@g\.us$/.test(chave) || pareceGrupo(cab, main, autores, nome);
    msgs.forEach(function (m) {
      if (grupo && m._autorBolha) { m.autor = m._autorBolha; m.texto = m.texto.slice(m._autorBolha.length).trim() || m.texto; }
      delete m._autorBolha;
    });
    return { chave: chave || nome, nome: nome || chave, grupo: grupo, mensagens: msgs };
  }

  /** Diagnóstico SEM o conteúdo das mensagens: só a estrutura da página (tags, papéis, classes, nomes de atributos,
   *  formato do data-id com números trocados por 9 e letras por x). Serve para ajustar a leitura quando o WhatsApp muda. */
  function diagnostico() {
    var main = principal();
    var mascara = function (v) { return String(v || '').replace(/\d/g, '9').replace(/[A-Za-z]/g, 'x').slice(0, 60); };
    function no(el, prof) {
      if (!el || prof > 7) return null;
      var o = { t: el.tagName.toLowerCase() };
      if (el.getAttribute('role')) o.role = el.getAttribute('role');
      if (el.className && typeof el.className === 'string') o.c = el.className.split(/\s+/).filter(function (c) { return /^(message|copyable|selectable|focusable|_a|x)/.test(c) || c.length < 12; }).slice(0, 6).join(' ');
      var at = Array.prototype.slice.call(el.attributes).map(function (a) { return a.name; }).filter(function (n) { return !/^(class|style|role)$/.test(n); });
      if (at.length) o.a = at.join(',');
      if (el.getAttribute('data-id')) o.id = mascara(el.getAttribute('data-id'));
      if (el.getAttribute('data-icon')) o.icon = el.getAttribute('data-icon');
      if (el.getAttribute('data-pre-plain-text')) o.pre = mascara(el.getAttribute('data-pre-plain-text'));
      if (el.getAttribute('aria-label')) o.aria = mascara(el.getAttribute('aria-label'));
      var txt = Array.prototype.slice.call(el.childNodes).filter(function (n) { return n.nodeType === 3 && n.textContent.trim(); }).length;
      if (txt) o.txt = txt;
      var filhos = Array.prototype.slice.call(el.children).slice(0, 6).map(function (c) { return no(c, prof + 1); }).filter(Boolean);
      if (filhos.length) o.f = filhos;
      return o;
    }
    if (!main) return { erro: 'sem #main', paneSide: !!document.getElementById('pane-side') };
    var cands = { dataId: $$('[data-id]', main).length, row: $$('[role="row"]', main).length, msgIn: $$('.message-in', main).length, msgOut: $$('.message-out', main).length,
      pre: $$('[data-pre-plain-text]', main).length, selectable: $$('span.selectable-text', main).length, lidas: linhas(main).length };
    var amostra = (linhas(main).length ? linhas(main) : $$('[role="row"], [data-id]', main)).slice(-3).map(function (el) { return no(el, 0); });
    var c = conversaAberta();
    return { versao: '1', contagem: cands, lidas: c ? c.mensagens.length : 0, grupo: c ? c.grupo : null, chave: c ? mascara(c.chave) : '', amostra: amostra,
      lista: $$('#pane-side [role="listitem"], #pane-side [role="row"]').slice(0, 1).map(function (el) { return no(el, 0); }) };
  }

  function caixa() {
    var main = principal(); if (!main) return null;
    return $('footer div[contenteditable="true"][role="textbox"]', main) || $('footer div[contenteditable="true"]', main) || $('div[contenteditable="true"][data-tab="10"]');
  }
  function textoNaCaixa() { var c = caixa(); return c ? (c.innerText || '').replace(/​/g, '').trim() : ''; }
  function limparCaixa() {
    var c = caixa(); if (!c) return false;
    c.focus(); document.execCommand('selectAll', false, null); document.execCommand('delete', false, null);
    return true;
  }
  function quebraDeLinha(c) {
    var o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true, cancelable: true };
    c.dispatchEvent(new KeyboardEvent('keydown', o));
    if (!document.execCommand('insertLineBreak', false, null)) document.execCommand('insertText', false, '\n');
    c.dispatchEvent(new KeyboardEvent('keyup', o));
  }

  /** Digita o texto na caixa de mensagem, um caractere por vez, com os intervalos dados (ms).
   *  o.parar() → true interrompe (por exemplo, quando a pessoa começa a digitar). o.progresso(0..1) informa o avanço. */
  function digitar(texto, intervalos, o) {
    o = o || {};
    return new Promise(function (resolve) {
      var c = caixa(); if (!c) return resolve({ ok: false, motivo: 'caixa' });
      c.focus();
      var i = 0;
      (function passo() {
        if (o.parar && o.parar()) return resolve({ ok: false, motivo: 'parado', digitado: i });
        if (i >= texto.length) return resolve({ ok: true });
        var ch = texto[i];
        if (document.activeElement !== c) c.focus();
        if (ch === '\n') quebraDeLinha(c); else document.execCommand('insertText', false, ch);
        i++;
        if (o.progresso) o.progresso(i / texto.length);
        setTimeout(passo, (intervalos[i - 1] || 30) * (o.escala ? Math.max(0.1, Math.min(10, o.escala() || 1)) : 1)); // escala: muda a velocidade na hora
      })();
    });
  }

  function botaoEnviar() {
    var main = principal(); if (!main) return null;
    var b = $('footer button[aria-label="Send"], footer button[aria-label="Enviar"], footer button[aria-label="Enviar mensagem"], footer button[aria-label="Enviar mensaje"]', main);
    if (b) return b;
    var ic = $('footer span[data-icon="send"], footer span[data-icon="wds-ic-send-filled"], footer span[data-icon*="send"]', main);
    return ic ? (ic.closest('button') || ic.closest('[role="button"]') || ic) : null;
  }
  /** Envia o que está na caixa (clica em Enviar; sem o botão, aperta Enter). */
  function enviar() {
    var c = caixa(); if (!c || !textoNaCaixa()) return false;
    var b = botaoEnviar();
    if (b) { b.click(); return true; }
    var o = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    c.dispatchEvent(new KeyboardEvent('keydown', o)); c.dispatchEvent(new KeyboardEvent('keyup', o));
    return true;
  }

  /** Conversas com mensagens não lidas na lista da esquerda: [{ nome, linha }] */
  function naoLidas() {
    var lado = document.getElementById('pane-side'); if (!lado) return [];
    var rows = $$('[role="listitem"], [role="row"]', lado);
    return rows.map(function (r) {
      var badge = $('span[aria-label*="unread" i], span[aria-label*="não lida" i], span[aria-label*="nao lida" i], span[aria-label*="no leído" i], span[aria-label*="no leído" i]', r);
      if (!badge) return null;
      var n = $('span[dir="auto"][title]', r) || $('span[title]', r);
      return n ? { nome: (n.getAttribute('title') || '').trim(), linha: r } : null;
    }).filter(Boolean);
  }
  /** Linha da lista com este nome (para abrir o privado de quem falou no grupo), ou null. */
  function linhaPorNome(nome) {
    var lado = document.getElementById('pane-side'); if (!lado || !nome) return null;
    var alvo = String(nome).trim().toLowerCase();
    return $$('[role="listitem"], [role="row"]', lado).find(function (r) {
      var n = $('span[dir="auto"][title]', r) || $('span[title]', r);
      return n && (n.getAttribute('title') || '').trim().toLowerCase() === alvo;
    }) || null;
  }
  /** Abre uma conversa da lista. O WhatsApp reage a pointer/mouse no elemento clicável da linha. */
  function abrir(linha) {
    var nomeEl = $('span[dir="auto"][title]', linha) || $('span[title]', linha) || linha;
    var alvo = nomeEl.closest('[role="button"], [role="gridcell"], [tabindex], [role="listitem"], [role="row"]') || $('[role="gridcell"]', linha) || $('div[tabindex]', linha) || linha;
    var r = alvo.getBoundingClientRect(), o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: r.left + Math.min(40, r.width / 2), clientY: r.top + r.height / 2 };
    if (typeof PointerEvent === 'function') alvo.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerType: 'mouse', isPrimary: true }, o)));
    alvo.dispatchEvent(new MouseEvent('mousedown', o));
    if (typeof PointerEvent === 'function') alvo.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerType: 'mouse', isPrimary: true }, o)));
    alvo.dispatchEvent(new MouseEvent('mouseup', o));
    alvo.dispatchEvent(new MouseEvent('click', o));
  }
  function pronto() { return !!(document.getElementById('pane-side') || principal()); }

  raiz.EWaDom = { diagnostico: diagnostico, conversaAberta: conversaAberta, caixa: caixa, textoNaCaixa: textoNaCaixa, limparCaixa: limparCaixa, digitar: digitar, enviar: enviar, naoLidas: naoLidas, linhaPorNome: linhaPorNome, abrir: abrir, pronto: pronto };
})(typeof globalThis !== 'undefined' ? globalThis : this);
