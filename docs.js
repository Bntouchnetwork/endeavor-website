/* Envio seguro de documentos (docs.html?t=TOKEN). Cada documento da lista tem o próprio botão; o arquivo vai do
 * navegador DIRETO para a pasta Initial Docs da empresa no Google Drive (sessão de envio aberta pelo servidor), sem
 * passar pela Endeavor. A página só mostra o que esta pessoa já enviou (nome do documento), nunca o conteúdo da pasta. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG || {};
  var q = new URLSearchParams(location.search), TOKEN = q.get('t') || '';
  var L = /^(pt|en|es)$/.test(q.get('lang') || '') ? q.get('lang') : 'pt';
  var T = {
    pt: { titulo: 'Envio seguro de documentos', oi: function (n) { return n ? 'Olá, ' + n + '!' : 'Olá!'; }, para: 'Envie cada documento no botão ao lado dele. Pode enviar PDF, foto (JPG, PNG, HEIC) ou Word, até 25 MB por arquivo.',
      seg: 'Os arquivos vão direto para a pasta segura do seu atendimento no Google Drive de ', segFim: '. Não envie documentos por WhatsApp nem por e-mail.',
      enviar: 'Enviar', outro: 'Enviar outro', pendente: 'Pendente', recebido: function (n) { return n === 1 ? 'Recebido' : n + ' arquivos recebidos'; }, enviando: 'Enviando…', ok: 'Recebido ✓',
      fim: 'Pronto! Recebemos todos os documentos. A equipe vai revisar e, se precisar de algo, fala com você.', fechado: 'Este pedido já foi concluído.', erro: 'Não foi possível enviar. Tente de novo.', invalido: 'Este link não é válido. Use o link do e-mail.',
      rod: 'Página segura de envio. Seus arquivos não são lidos por inteligência artificial.', modelo: 'Documentos para ' },
    en: { titulo: 'Secure document upload', oi: function (n) { return n ? 'Hi ' + n + ',' : 'Hi,'; }, para: 'Upload each document with the button next to it. PDF, photos (JPG, PNG, HEIC) or Word, up to 25 MB per file.',
      seg: 'Files go straight to the secure folder for your case in the Google Drive of ', segFim: '. Please don\'t send documents over WhatsApp or e-mail.',
      enviar: 'Upload', outro: 'Upload another', pendente: 'Pending', recebido: function (n) { return n === 1 ? 'Received' : n + ' files received'; }, enviando: 'Uploading…', ok: 'Received ✓',
      fim: 'All set! We received all your documents. Our team will review them and reach out if anything else is needed.', fechado: 'This request is already complete.', erro: 'Upload failed. Please try again.', invalido: 'This link is not valid. Please use the link from the e-mail.',
      rod: 'Secure upload page. Your files are not read by artificial intelligence.', modelo: 'Documents for ' },
    es: { titulo: 'Envío seguro de documentos', oi: function (n) { return n ? '¡Hola, ' + n + '!' : '¡Hola!'; }, para: 'Envíe cada documento con el botón a su lado. PDF, fotos (JPG, PNG, HEIC) o Word, hasta 25 MB por archivo.',
      seg: 'Los archivos van directo a la carpeta segura de su caso en el Google Drive de ', segFim: '. No envíe documentos por WhatsApp ni por correo.',
      enviar: 'Enviar', outro: 'Enviar otro', pendente: 'Pendiente', recebido: function (n) { return n === 1 ? 'Recibido' : n + ' archivos recibidos'; }, enviando: 'Enviando…', ok: 'Recibido ✓',
      fim: '¡Listo! Recibimos todos los documentos. El equipo los revisará y le contactará si hace falta algo más.', fechado: 'Esta solicitud ya fue concluida.', erro: 'No se pudo enviar. Intente de nuevo.', invalido: 'Este enlace no es válido. Use el enlace del correo.',
      rod: 'Página segura de envío. Sus archivos no son leídos por inteligencia artificial.', modelo: 'Documentos para ' }
  };
  var t = T[L], main = document.getElementById('main'), D = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function api(body) {
    return fetch(CFG.functionsUrl + '/docs', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey }, body: JSON.stringify(Object.assign({ t: TOKEN }, body)) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || t.erro); return j; }); });
  }
  function desenhar() {
    document.documentElement.lang = L === 'pt' ? 'pt-BR' : L;
    document.title = t.titulo + ' · ' + D.empresa;
    var faltam = D.documentos.filter(function (d) { return !d.enviados; }).length;
    main.innerHTML = '<nav class="dc-lang" aria-label="Idioma">' + ['pt', 'en', 'es'].map(function (x) { return '<a href="?t=' + encodeURIComponent(TOKEN) + '&lang=' + x + '"' + (x === L ? ' aria-current="true"' : '') + '>' + x.toUpperCase() + '</a>'; }).join('') + '</nav>' +
      '<header class="dc-topo"><div class="dc-emp">' + esc(D.empresa) + '</div><h1>' + esc(t.titulo) + '</h1><p>' + esc(t.oi(D.nome)) + ' ' + esc(t.para) + '</p>' + (D.modelo ? '<p class="portal-muted">' + esc(t.modelo + D.modelo) + '</p>' : '') + '</header>' +
      '<p class="dc-seg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 4.5 6v5.6c0 4.6 3.2 8.6 7.5 9.6 4.3-1 7.5-5 7.5-9.6V6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m8.7 12 2.3 2.3 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + esc(t.seg + D.empresa + t.segFim) + '</span></p>' +
      (D.aberto ? '<ul class="dc-lista">' + D.documentos.map(function (d, i) {
        return '<li class="dc-item' + (d.enviados ? ' ok' : '') + '" data-i="' + i + '"><div><div class="dc-nome" id="dn-' + i + '">' + esc(d.nome) + '</div><div class="dc-st" id="ds-' + i + '">' + esc(d.enviados ? t.recebido(d.enviados) : t.pendente) + '</div></div>' +
          '<div class="dc-bt"><input type="file" id="df-' + i + '" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.doc,.docx,application/pdf,image/*" multiple aria-describedby="dn-' + i + ' ds-' + i + '"><label for="df-' + i + '">' + esc(d.enviados ? t.outro : t.enviar) + '</label></div>' +
          '<div class="dc-prog" hidden><i></i></div><p class="dc-msg" role="status" aria-live="polite"></p></li>';
      }).join('') + '</ul>' : '<p class="dc-fim">' + esc(t.fechado) + '</p>') +
      (D.aberto && !faltam ? '<p class="dc-fim" role="status">' + esc(t.fim) + '</p>' : '') +
      '<p class="dc-rod">' + esc(t.rod) + '</p>';
    main.querySelectorAll('input[type=file]').forEach(function (inp) { inp.onchange = function () { enviarArquivos(+inp.closest('.dc-item').dataset.i, Array.prototype.slice.call(inp.files)); inp.value = ''; }; });
  }
  function enviarUm(doc, f, li) {
    var prog = li.querySelector('.dc-prog'), barra = prog.querySelector('i');
    return api({ acao: 'pub_sessao', doc: doc, nome: f.name, tipo: f.type || '', tamanho: f.size }).then(function (s) {
      return new Promise(function (ok, falha) {
        var x = new XMLHttpRequest();
        x.open('PUT', s.url);
        x.setRequestHeader('Content-Type', s.tipo || f.type || 'application/octet-stream');
        prog.hidden = false;
        x.upload.onprogress = function (e) { if (e.lengthComputable) barra.style.width = Math.round(e.loaded / e.total * 100) + '%'; };
        x.onload = function () { if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)); } catch (e) { falha(new Error(t.erro)); } } else falha(new Error(t.erro)); };
        x.onerror = function () { falha(new Error(t.erro)); };
        x.send(f);
      });
    }).then(function (arq) { return api({ acao: 'pub_confirmar', doc: doc, file_id: arq.id }); });
  }
  async function enviarArquivos(i, arquivos) {
    var d = D.documentos[i], li = main.querySelector('.dc-item[data-i="' + i + '"]'), msg = li.querySelector('.dc-msg'), lab = li.querySelector('label');
    if (!arquivos.length) return;
    lab.setAttribute('aria-disabled', 'true'); msg.className = 'dc-msg'; msg.textContent = t.enviando;
    try {
      for (var k = 0; k < arquivos.length; k++) { await enviarUm(d.nome, arquivos[k], li); d.enviados++; }
      msg.textContent = t.ok;
      setTimeout(desenhar, 900);
    } catch (e) { msg.className = 'dc-msg erro'; msg.textContent = e.message || t.erro; li.querySelector('.dc-prog').hidden = true; lab.removeAttribute('aria-disabled'); }
  }
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(TOKEN)) { main.innerHTML = '<p class="dc-fim">' + esc(t.invalido) + '</p>'; return; }
  api({ acao: 'pub_info' }).then(function (j) { D = j; if (!q.get('lang') && j.idioma) { L = j.idioma; t = T[L]; } desenhar(); })
    .catch(function (e) { main.innerHTML = '<p class="dc-fim">' + esc(e.message || t.invalido) + '</p>'; });
})();
