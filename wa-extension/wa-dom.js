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

  /** Linhas de mensagem do chat aberto (só as de nível mais alto com data-id válido). */
  function linhas(main) {
    var todas = $$('[data-id]', main).filter(function (el) { return C.lerDataId(el.getAttribute('data-id')); });
    return todas.filter(function (el) { var p = el.parentElement; while (p && p !== main) { if (p.hasAttribute && p.hasAttribute('data-id') && C.lerDataId(p.getAttribute('data-id'))) return false; p = p.parentElement; } return true; });
  }
  function textoDa(linha) {
    var spans = $$('.copyable-text span.selectable-text, span.selectable-text', linha);
    var t = spans.length ? spans.map(function (s) { return s.innerText || s.textContent || ''; }).join('\n') : '';
    if (!t) { var cp = $('.copyable-text', linha); if (cp) t = cp.innerText || cp.textContent || ''; }
    return String(t || '').replace(/‎|‏/g, '').trim();
  }
  function midiaDa(linha) {
    if ($('audio, [data-icon*="audio"], [data-icon*="ptt"], [aria-label*="voice" i], [aria-label*="áudio" i]', linha)) return 'áudio';
    if ($('img[src^="blob:"], [data-icon*="image"]', linha)) return 'imagem';
    if ($('video, [data-icon*="video"]', linha)) return 'vídeo';
    if ($('[data-icon*="document"], [data-icon*="doc"]', linha)) return 'documento';
    return '';
  }

  /** Conversa aberta: { chave, nome, grupo, mensagens:[{id, eu, autor, hora, texto, midia}] } ou null. */
  function conversaAberta() {
    var main = principal(); if (!main) return null;
    var cab = $('header', main);
    var nomeEl = cab && ($('span[dir="auto"][title]', cab) || $('[data-testid="conversation-info-header-chat-title"]', cab) || $('span[dir="auto"]', cab));
    var nome = nomeEl ? (nomeEl.getAttribute('title') || nomeEl.textContent || '').trim() : '';
    var ls = linhas(main), chave = '', grupo = false, msgs = [];
    ls.forEach(function (el) {
      var id = C.lerDataId(el.getAttribute('data-id'));
      if (!chave) { chave = id.chave; grupo = id.grupo; }
      var pre = $('[data-pre-plain-text]', el), info = pre ? C.lerPrePlain(pre.getAttribute('data-pre-plain-text')) : null;
      var texto = textoDa(el), midia = texto ? '' : midiaDa(el);
      if (!texto && !midia) return;
      msgs.push({ id: el.getAttribute('data-id'), eu: id.eu, autor: id.eu ? 'EU' : (info && info.autor) || nome, hora: info ? info.hora : '', texto: texto || '[' + midia + ']', midia: midia });
    });
    if (!chave && !nome) return null;
    if (!chave) grupo = !!$('header [data-icon*="group"], header [data-icon="default-group"]', main);
    return { chave: chave || nome, nome: nome || chave, grupo: grupo, mensagens: msgs };
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
        setTimeout(passo, intervalos[i - 1] || 30);
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
  /** Abre uma conversa da lista (o WhatsApp responde ao mousedown). */
  function abrir(linha) {
    var alvo = $('[role="gridcell"]', linha) || $('div[tabindex]', linha) || linha;
    ['mousedown', 'mouseup', 'click'].forEach(function (t) { alvo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })); });
  }
  function pronto() { return !!(document.getElementById('pane-side') || principal()); }

  raiz.EWaDom = { conversaAberta: conversaAberta, caixa: caixa, textoNaCaixa: textoNaCaixa, limparCaixa: limparCaixa, digitar: digitar, enviar: enviar, naoLidas: naoLidas, abrir: abrir, pronto: pronto };
})(typeof globalThis !== 'undefined' ? globalThis : this);
