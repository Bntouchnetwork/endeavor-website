/* Endeavor e-signature editor (admin console): upload a PDF, place signer fields, white-out (eraser) and add text, then send. */
(function () {
  'use strict';

  var TOOLS = {
    signature: { label: 'Assinatura', icon: '✍', kind: 'field', w: 180, h: 46, color: 'sig' },
    initials: { label: 'Rubrica', icon: 'AB', kind: 'field', w: 64, h: 36, color: 'sig' },
    date: { label: 'Data da assinatura', icon: '📅', kind: 'field', w: 110, h: 20, color: 'auto' },
    name: { label: 'Nome', icon: 'Aa', kind: 'field', w: 170, h: 20, color: 'auto' },
    email: { label: 'E-mail', icon: '@', kind: 'field', w: 190, h: 20, color: 'auto' },
    text: { label: 'Texto (signatário preenche)', icon: 'T', kind: 'field', w: 170, h: 20, color: 'input' },
    checkbox: { label: 'Caixa de seleção', icon: '☑', kind: 'field', w: 16, h: 16, color: 'input' },
    erase: { label: 'Borracha (apagar área)', icon: '⌫', kind: 'erase', w: 140, h: 22 },
    fixed: { label: 'Texto fixo (editar documento)', icon: '✎', kind: 'text', w: 180, h: 18 }
  };
  var FIELD_ORDER = ['signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox'];
  var EDIT_ORDER = ['erase', 'fixed'];

  function uid() { return 'f' + Math.random().toString(36).slice(2, 9); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.EndeavorEditor = {
    mount: function (view, ctx) {
      var esc = ctx.esc, sb = ctx.sb, CFG = ctx.CFG;
      var items = [], history = [], selected = null, tool = null, pages = [], fileBytes = null, fileName = '', pdfDoc = null;

      view.innerHTML =
        '<div class="console__head"><div><h1>Novo documento para assinatura</h1><p class="portal-muted">Suba o PDF, arraste os campos para o documento e envie. Tudo acontece aqui no console.</p></div>' +
        '<button class="btn btn--ghost btn--xs" type="button" id="esx-cancel">Voltar para a lista</button></div>' +
        '<div class="esx">' +
          '<aside class="esx__tools" aria-label="Ferramentas">' +
            '<h2 class="esx__h">Campos do signatário</h2><div class="esx__toolgrid">' + FIELD_ORDER.map(toolBtn).join('') + '</div>' +
            '<h2 class="esx__h">Editar documento</h2><div class="esx__toolgrid">' + EDIT_ORDER.map(toolBtn).join('') + '</div>' +
            '<h2 class="esx__h">Ações</h2><div class="esx__toolgrid">' +
              '<button type="button" class="esx__tool" id="esx-undo" disabled><span class="esx__ico" aria-hidden="true">↶</span>Desfazer</button>' +
              '<button type="button" class="esx__tool" id="esx-del" disabled><span class="esx__ico" aria-hidden="true">🗑</span>Remover selecionado</button>' +
            '</div>' +
            '<p class="esx__hint" id="esx-hint">Arraste um campo até a página, ou clique no campo e depois no local do documento. Com a borracha, desenhe um retângulo sobre o que quer apagar.</p>' +
          '</aside>' +
          '<div class="esx__stage">' +
            '<label class="esx__drop" id="esx-drop" for="esx-file">' +
              '<input type="file" id="esx-file" accept="application/pdf" class="sr-only">' +
              '<span class="esx__drop-ico" aria-hidden="true">📄</span><strong>Arraste o PDF aqui ou clique para escolher</strong><span class="portal-muted">Somente PDF, até 20 MB</span>' +
            '</label>' +
            '<div class="esx__filebar" id="esx-filebar" hidden><span id="esx-fname"></span><button type="button" class="btn btn--ghost btn--xs" id="esx-change">Trocar arquivo</button></div>' +
            '<div class="esx__pages" id="esx-pages" aria-live="polite"></div>' +
          '</div>' +
          '<aside class="esx__side" aria-label="Destinatário e envio">' +
            '<section class="portal-card"><h2 class="portal-h2">Destinatário</h2>' +
              '<div class="field"><label for="ev-lead">Vincular a um lead (opcional)</label><select id="ev-lead"><option value="">Nenhum</option>' +
                ctx.leads.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === ctx.preLeadId ? ' selected' : '') + '>' + esc(l.name) + ' · ' + esc(l.email) + '</option>'; }).join('') + '</select></div>' +
              field('ev-name', 'Nome do signatário', ctx.preLead ? ctx.preLead.name : '', 'text') +
              field('ev-email', 'E-mail do signatário', ctx.preLead ? ctx.preLead.email : '', 'email') +
              field('ev-title', 'Título do documento', '', 'text') +
              '<div class="field"><label for="ev-msg">Mensagem (opcional)</label><textarea id="ev-msg" rows="3"></textarea></div>' +
              '<div class="field"><label for="ev-days">Link válido por (dias)</label><input id="ev-days" type="number" min="1" max="90" value="30"></div>' +
              '<div class="check-row"><input type="checkbox" id="ev-mail" checked><label for="ev-mail">Enviar o link por e-mail ao signatário (cópia para ' + esc(CFG.adminEmail) + ')</label></div>' +
            '</section>' +
            '<section class="portal-card" id="esx-props" hidden><h2 class="portal-h2">Item selecionado</h2><div id="esx-propbody"></div></section>' +
            '<section class="portal-card"><h2 class="portal-h2">Resumo</h2><ul class="esx__sum" id="esx-sum"></ul>' +
              '<div class="portal-alert" id="esx-msg" role="alert"></div>' +
              '<button class="btn btn--navy btn--block" type="button" id="esx-send">Enviar para assinatura</button></section>' +
          '</aside>' +
        '</div>';

      var $ = function (s) { return view.querySelector(s); };
      var drop = $('#esx-drop'), pagesEl = $('#esx-pages');

      function toolBtn(k) {
        var t = TOOLS[k];
        return '<button type="button" class="esx__tool esx__tool--' + (t.color || t.kind) + '" data-tool="' + k + '" aria-pressed="false"><span class="esx__ico" aria-hidden="true">' + t.icon + '</span>' + t.label + '</button>';
      }
      function field(id, label, val, type) {
        return '<div class="field"><label for="' + id + '">' + label + ' <span class="req" aria-hidden="true">*</span></label><input id="' + id + '" type="' + type + '" value="' + esc(val || '') + '" required></div>';
      }

      $('#esx-cancel').onclick = ctx.onCancel;
      $('#ev-lead').onchange = function () {
        var l = ctx.leads.find(function (x) { return x.id === $('#ev-lead').value; });
        if (l) { $('#ev-name').value = l.name; $('#ev-email').value = l.email; }
      };

      /* ---------- file loading ---------- */
      async function loadFile(file) {
        var m = $('#esx-msg');
        if (!file) return;
        if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return ctx.msg(m, 'Escolha um arquivo PDF.', 'error');
        if (file.size > 20 * 1024 * 1024) return ctx.msg(m, 'O PDF precisa ter até 20 MB.', 'error');
        ctx.msg(m, 'Abrindo o documento…', 'info');
        try {
          fileBytes = new Uint8Array(await file.arrayBuffer());
          fileName = file.name;
          pdfDoc = await EPdf.open(fileBytes);
          items = []; history = []; selected = null;
          drop.hidden = true; $('#esx-filebar').hidden = false; $('#esx-fname').textContent = file.name + ' · ' + pdfDoc.numPages + (pdfDoc.numPages > 1 ? ' páginas' : ' página');
          if (!$('#ev-title').value) $('#ev-title').value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
          pages = await EPdf.render(pdfDoc, pagesEl, { maxWidth: 860, pageLabel: 'Página' });
          pages.forEach(wirePage);
          ctx.msg(m, '', 'info');
          redraw();
        } catch (e) { ctx.msg(m, 'Não foi possível abrir este PDF. Ele pode estar protegido por senha ou corrompido.', 'error'); console.error(e); }
      }
      $('#esx-file').onchange = function (e) { loadFile(e.target.files[0]); };
      $('#esx-change').onclick = function () { if (!items.length || confirm('Trocar o arquivo remove os campos já posicionados. Continuar?')) $('#esx-file').click(); };
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
      drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });

      /* ---------- tools ---------- */
      function setTool(k) {
        tool = tool === k ? null : k;
        view.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === tool)); });
        pagesEl.classList.toggle('is-placing', !!tool);
        pagesEl.classList.toggle('is-erasing', tool === 'erase');
        $('#esx-hint').textContent = !tool ? 'Arraste um campo até a página, ou clique no campo e depois no local do documento. Com a borracha, desenhe um retângulo sobre o que quer apagar.'
          : tool === 'erase' ? 'Borracha ativa: desenhe um retângulo sobre o texto ou área que quer apagar. Clique na borracha de novo para sair.'
          : 'Clique no documento onde o campo "' + TOOLS[tool].label + '" deve ficar.';
      }
      view.querySelectorAll('[data-tool]').forEach(function (btn) {
        var start = null, ghost = null;
        btn.addEventListener('pointerdown', function (e) {
          if (!pages.length) return;
          start = { x: e.clientX, y: e.clientY, id: e.pointerId };
        });
        btn.addEventListener('pointermove', function (e) {
          if (!start) return;
          if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6 && btn.dataset.tool !== 'erase') {
            btn.setPointerCapture(start.id);
            ghost = document.createElement('div'); ghost.className = 'esx-ghost esx-item--' + (TOOLS[btn.dataset.tool].color || TOOLS[btn.dataset.tool].kind);
            ghost.textContent = TOOLS[btn.dataset.tool].label; document.body.appendChild(ghost);
          }
          if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
        });
        btn.addEventListener('pointerup', function (e) {
          if (ghost) {
            ghost.remove(); ghost = null;
            var el = document.elementFromPoint(e.clientX, e.clientY);
            var pg = el && el.closest('.pdfpage');
            if (pg) placeAt(btn.dataset.tool, +pg.dataset.page, e.clientX, e.clientY);
            btn._dragged = true; start = null; return;
          }
          start = null;
        });
        btn.addEventListener('click', function () {
          if (btn._dragged) { btn._dragged = false; return; }
          if (!pages.length) { ctx.msg($('#esx-msg'), 'Primeiro suba o PDF.', 'error'); return; }
          setTool(btn.dataset.tool);
        });
        btn.addEventListener('pointercancel', function () { if (ghost) ghost.remove(); ghost = null; start = null; });
      });

      function pageOf(i) { return pages[i]; }
      function snapshot() { history.push(JSON.stringify(items)); if (history.length > 60) history.shift(); $('#esx-undo').disabled = false; }

      function placeAt(k, pageIndex, clientX, clientY) {
        var p = pageOf(pageIndex), r = p.el.getBoundingClientRect(), t = TOOLS[k];
        var w = t.w / p.width, h = t.h / p.height;
        var x = clamp((clientX - r.left) / r.width - w / 2, 0, 1 - w), y = clamp((clientY - r.top) / r.height - h / 2, 0, 1 - h);
        snapshot();
        var it = { id: uid(), tool: k, kind: t.kind, page: pageIndex, x: x, y: y, w: w, h: h, required: k !== 'checkbox' ? true : false };
        if (k === 'fixed') { it.text = ''; it.size = 11; }
        items.push(it); selected = it.id;
        if (k !== 'erase') setTool(null);
        redraw();
        if (k === 'fixed') setTimeout(function () { var ed = pagesEl.querySelector('[data-id="' + it.id + '"] .esx-item__text'); if (ed) ed.focus(); }, 30);
      }

      function wirePage(p) {
        var drawing = null;
        p.layer.addEventListener('pointerdown', function (e) {
          if (e.target !== p.layer || !tool) { if (e.target === p.layer) { selected = null; redraw(); } return; }
          var r = p.el.getBoundingClientRect();
          if (tool === 'erase') {
            e.preventDefault(); p.layer.setPointerCapture(e.pointerId);
            drawing = { x0: (e.clientX - r.left) / r.width, y0: (e.clientY - r.top) / r.height, el: document.createElement('div') };
            drawing.el.className = 'esx-item esx-item--erase is-drawing'; p.layer.appendChild(drawing.el);
            return;
          }
          placeAt(tool, p.index, e.clientX, e.clientY);
        });
        p.layer.addEventListener('pointermove', function (e) {
          if (!drawing) return;
          var r = p.el.getBoundingClientRect();
          var x1 = clamp((e.clientX - r.left) / r.width, 0, 1), y1 = clamp((e.clientY - r.top) / r.height, 0, 1);
          var x = Math.min(drawing.x0, x1), y = Math.min(drawing.y0, y1);
          drawing.box = { x: x, y: y, w: Math.abs(x1 - drawing.x0), h: Math.abs(y1 - drawing.y0) };
          pos(drawing.el, drawing.box);
        });
        p.layer.addEventListener('pointerup', function (e) {
          if (!drawing) return;
          drawing.el.remove();
          var b = drawing.box; drawing = null;
          if (!b || b.w < 0.01 || b.h < 0.005) { placeAt('erase', p.index, e.clientX, e.clientY); return; }
          snapshot();
          var it = { id: uid(), tool: 'erase', kind: 'erase', page: p.index, x: b.x, y: b.y, w: b.w, h: b.h };
          items.push(it); selected = it.id; redraw();
        });
      }

      function pos(el, it) { el.style.left = it.x * 100 + '%'; el.style.top = it.y * 100 + '%'; el.style.width = it.w * 100 + '%'; el.style.height = it.h * 100 + '%'; }

      /* ---------- rendering items ---------- */
      function redraw() {
        pages.forEach(function (p) { p.layer.querySelectorAll('.esx-item').forEach(function (n) { n.remove(); }); });
        items.forEach(function (it) {
          var p = pageOf(it.page); if (!p) return;
          var t = TOOLS[it.tool];
          var el = document.createElement('div');
          el.className = 'esx-item esx-item--' + (t.color || t.kind) + (it.id === selected ? ' is-selected' : '');
          el.dataset.id = it.id; el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', t.label + ', página ' + (it.page + 1) + (it.kind === 'field' && it.required ? ', obrigatório' : ''));
          pos(el, it);
          if (it.kind === 'text') {
            var tx = document.createElement('span'); tx.className = 'esx-item__text'; tx.setAttribute('data-ph', 'Digite o texto'); tx.setAttribute('aria-label', 'Texto fixo'); tx.contentEditable = 'true'; tx.spellcheck = true; tx.textContent = it.text;
            var pH = p.el.getBoundingClientRect().height;
            tx.style.fontSize = (it.size / p.height * pH) + 'px';
            tx.addEventListener('input', function () { it.text = tx.innerText.replace(/\n$/, ''); });
            tx.addEventListener('focus', function () { if (selected !== it.id) { selected = it.id; markSelected(); } });
            tx.addEventListener('blur', function () { autoSizeText(it, tx, p); });
            el.appendChild(tx);
          } else if (it.kind === 'field') {
            el.innerHTML = '<span class="esx-item__lbl">' + (it.tool === 'checkbox' ? '' : esc(t.label.replace(/ \(.*\)/, ''))) + (it.required && it.tool !== 'checkbox' ? ' *' : '') + '</span>';
          }
          var handle = document.createElement('span'); handle.className = 'esx-item__rs'; handle.setAttribute('aria-hidden', 'true');
          el.appendChild(handle);
          p.layer.appendChild(el);
          wireItem(el, it, p, handle);
        });
        renderProps(); renderSummary();
        $('#esx-del').disabled = !selected;
      }
      function markSelected() {
        pagesEl.querySelectorAll('.esx-item').forEach(function (n) { n.classList.toggle('is-selected', n.dataset.id === selected); });
        renderProps(); $('#esx-del').disabled = !selected;
      }
      function autoSizeText(it, tx, p) {
        var r = p.el.getBoundingClientRect();
        var needH = (tx.scrollHeight + 4) / r.height, needW = (tx.scrollWidth + 6) / r.width;
        if (needH > it.h) it.h = Math.min(needH, 1 - it.y);
        if (needW > it.w) it.w = Math.min(needW, 1 - it.x);
        var el = tx.parentElement; if (el) pos(el, it);
      }

      function wireItem(el, it, p, handle) {
        var drag = null;
        el.addEventListener('pointerdown', function (e) {
          if (e.target.classList.contains('esx-item__text') && document.activeElement === e.target) return;
          e.stopPropagation();
          if (tool && tool !== 'erase') { e.preventDefault(); placeAt(tool, p.index, e.clientX, e.clientY); return; }
          selected = it.id; markSelected();
          var r = p.el.getBoundingClientRect();
          drag = { mode: e.target === handle ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, x: it.x, y: it.y, w: it.w, h: it.h, r: r, moved: false };
          el.setPointerCapture(e.pointerId);
        });
        el.addEventListener('pointermove', function (e) {
          if (!drag) return;
          var dx = (e.clientX - drag.sx) / drag.r.width, dy = (e.clientY - drag.sy) / drag.r.height;
          if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 0.003) return;
          if (!drag.moved) { snapshot(); drag.moved = true; }
          if (drag.mode === 'move') { it.x = clamp(drag.x + dx, 0, 1 - it.w); it.y = clamp(drag.y + dy, 0, 1 - it.h); }
          else { it.w = clamp(drag.w + dx, 0.012, 1 - it.x); it.h = clamp(drag.h + dy, 0.008, 1 - it.y); if (it.tool === 'checkbox') it.h = it.w * p.width / p.height; }
          pos(el, it);
        });
        el.addEventListener('pointerup', function () {
          var wasMoved = drag && drag.moved; drag = null;
          if (!wasMoved && it.kind === 'text') { var tx = el.querySelector('.esx-item__text'); if (tx && document.activeElement !== tx) tx.focus(); }
        });
        el.addEventListener('keydown', function (e) {
          if (e.target.classList.contains('esx-item__text')) { if (e.key === 'Escape') e.target.blur(); return; }
          var step = e.shiftKey ? 0.02 : 0.004, k = e.key;
          if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeSelected(); return; }
          var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (moves[k]) { e.preventDefault(); snapshot(); it.x = clamp(it.x + moves[k][0], 0, 1 - it.w); it.y = clamp(it.y + moves[k][1], 0, 1 - it.h); pos(el, it); }
        });
        el.addEventListener('focus', function () { if (selected !== it.id) { selected = it.id; markSelected(); } });
      }

      function removeSelected() {
        if (!selected) return;
        snapshot();
        items = items.filter(function (x) { return x.id !== selected; }); selected = null; redraw();
      }
      $('#esx-del').onclick = removeSelected;
      $('#esx-undo').onclick = function () {
        if (!history.length) return;
        items = JSON.parse(history.pop()); selected = null; redraw();
        $('#esx-undo').disabled = !history.length;
      };
      function onKey(e) {
        if (!document.body.contains(view.querySelector('.esx'))) { document.removeEventListener('keydown', onKey); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); $('#esx-undo').click(); }
        if (e.key === 'Escape' && tool) setTool(null);
      }
      document.addEventListener('keydown', onKey);

      /* ---------- side panels ---------- */
      function renderProps() {
        var it = items.find(function (x) { return x.id === selected; });
        var box = $('#esx-props');
        if (!it) { box.hidden = true; return; }
        box.hidden = false;
        var t = TOOLS[it.tool], html = '<p><strong>' + esc(t.label) + '</strong> · página ' + (it.page + 1) + '</p>';
        if (it.kind === 'field') html += '<div class="check-row"><input type="checkbox" id="pr-req"' + (it.required ? ' checked' : '') + '><label for="pr-req">Obrigatório</label></div>';
        if (it.kind === 'text') html += '<div class="field"><label for="pr-size">Tamanho da fonte</label><select id="pr-size">' + [8, 9, 10, 11, 12, 14, 16, 18, 22].map(function (s) { return '<option' + (s === it.size ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>';
        if (it.kind === 'erase') html += '<p class="portal-muted" style="font-size:.88rem">O conteúdo dentro da área é removido de verdade do PDF enviado (a página é regravada como imagem). Use "Texto fixo" por cima para escrever o texto novo.</p>';
        if (it.tool === 'date') html += '<p class="portal-muted" style="font-size:.88rem">Preenchido automaticamente com a data da assinatura.</p>';
        if (it.tool === 'name' || it.tool === 'email') html += '<p class="portal-muted" style="font-size:.88rem">Preenchido automaticamente com os dados confirmados pelo signatário.</p>';
        html += '<button type="button" class="btn btn--danger btn--xs" id="pr-del">Remover</button>';
        $('#esx-propbody').innerHTML = html;
        if ($('#pr-req')) $('#pr-req').onchange = function (e) { snapshot(); it.required = e.target.checked; redraw(); };
        if ($('#pr-size')) $('#pr-size').onchange = function (e) { snapshot(); it.size = +e.target.value; redraw(); };
        $('#pr-del').onclick = removeSelected;
      }
      function renderSummary() {
        var c = {}; items.forEach(function (i) { c[i.tool] = (c[i.tool] || 0) + 1; });
        var li = Object.keys(c).map(function (k) { return '<li><span>' + esc(TOOLS[k].label) + '</span><strong>' + c[k] + '</strong></li>'; });
        $('#esx-sum').innerHTML = pages.length ? (li.join('') || '<li class="portal-muted">Nenhum campo ainda. Adicione pelo menos uma Assinatura.</li>') : '<li class="portal-muted">Suba o PDF para começar.</li>';
      }
      renderSummary();

      /* ---------- send ---------- */
      /* Pages with eraser areas are rebuilt as a flattened image so the erased content is really removed
         (not just covered). Other pages keep their original, selectable content. */
      async function flattenPage(doc, L, idx, erases) {
        var page = doc.getPages()[idx], b = page.getCropBox();
        var src = await pdfDoc.getPage(idx + 1);
        if ((src.rotate || 0) % 360 !== 0 || page.getRotation().angle % 360 !== 0) return false;
        var vp = src.getViewport({ scale: 2.5 });
        var c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await src.render({ canvasContext: g, viewport: vp }).promise;
        g.fillStyle = '#fff';
        erases.forEach(function (i) { g.fillRect(i.x * c.width, i.y * c.height, i.w * c.width, i.h * c.height); });
        var blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.92); });
        var img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        page.node.delete(L.PDFName.of('Contents'));
        page.drawImage(img, { x: b.x, y: b.y, width: b.width, height: b.height });
        return true;
      }
      async function bake() {
        var edits = items.filter(function (i) { return i.kind !== 'field'; });
        if (!edits.length) return fileBytes;
        var L = window.PDFLib;
        var doc = await L.PDFDocument.load(fileBytes);
        var font = await doc.embedFont(L.StandardFonts.Helvetica);
        var pg = doc.getPages();
        var erasePages = {};
        edits.forEach(function (i) { if (i.kind === 'erase') (erasePages[i.page] = erasePages[i.page] || []).push(i); });
        var flat = {};
        for (var k in erasePages) flat[k] = await flattenPage(doc, L, +k, erasePages[k]);
        edits.forEach(function (i) {
          var page = pg[i.page], b = page.getCropBox();
          var x = b.x + i.x * b.width, w = i.w * b.width, h = i.h * b.height, y = b.y + b.height - i.y * b.height - h;
          if (i.kind === 'erase') { if (!flat[i.page]) page.drawRectangle({ x: x, y: y, width: w, height: h, color: L.rgb(1, 1, 1) }); }
          else {
            var lines = EPdf.safe(i.text || '').split(/\n/), lh = i.size * 1.2, top = b.y + b.height - i.y * b.height;
            lines.forEach(function (ln, n) { page.drawText(ln, { x: x + 2, y: top - i.size - n * lh + 1, size: i.size, font: font, color: L.rgb(0, 0, 0) }); });
          }
        });
        return new Uint8Array(await doc.save());
      }

      $('#esx-send').onclick = async function () {
        var m = $('#esx-msg'), btn = $('#esx-send');
        var title = $('#ev-title').value.trim(), name = $('#ev-name').value.trim(), email = $('#ev-email').value.trim().toLowerCase();
        if (!fileBytes) return ctx.msg(m, 'Suba o PDF primeiro.', 'error');
        if (name.length < 2) { $('#ev-name').focus(); return ctx.msg(m, 'Informe o nome do signatário.', 'error'); }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('#ev-email').focus(); return ctx.msg(m, 'Informe um e-mail válido para o signatário.', 'error'); }
        if (title.length < 2) { $('#ev-title').focus(); return ctx.msg(m, 'Dê um título ao documento.', 'error'); }
        if (!items.some(function (i) { return i.tool === 'signature'; })) return ctx.msg(m, 'Adicione pelo menos um campo de Assinatura no documento.', 'error');
        if (items.some(function (i) { return i.kind === 'text' && !String(i.text || '').trim(); })) return ctx.msg(m, 'Há um texto fixo vazio. Escreva o texto ou remova o item.', 'error');
        btn.disabled = true; ctx.msg(m, 'Preparando o documento…', 'info');
        try {
          var bytes = await bake();
          var hash = await ctx.sha256Hex(bytes);
          ctx.msg(m, 'Enviando…', 'info');
          var path = 'originals/' + crypto.randomUUID() + '.pdf';
          var up = await sb.storage.from('documents').upload(path, new Blob([bytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false });
          if (up.error) throw up.error;
          var days = Math.min(90, Math.max(1, +$('#ev-days').value || 30));
          var fields = items.filter(function (i) { return i.kind === 'field'; }).map(function (i) {
            return { id: i.id, type: i.tool, page: i.page, x: +i.x.toFixed(5), y: +i.y.toFixed(5), w: +i.w.toFixed(5), h: +i.h.toFixed(5), required: i.tool === 'date' || i.tool === 'name' || i.tool === 'email' ? true : !!i.required };
          });
          var ins = await sb.from('envelopes').insert({ title: title, signer_name: name, signer_email: email, message: $('#ev-msg').value.trim() || null,
            lead_id: $('#ev-lead').value || null, document_path: path, document_sha256: hash, fields: fields,
            token_expires_at: new Date(Date.now() + days * 864e5).toISOString() }).select('*').single();
          if (ins.error) throw ins.error;
          var env = ins.data;
          await sb.from('envelope_events').insert({ envelope_id: env.id, event: 'sent', details: { fields: fields.length, edits: items.length - fields.length, file: fileName } });
          var mailed = false;
          if ($('#ev-mail').checked) mailed = await ctx.emailSigner(env);
          ctx.onDone(env, mailed);
        } catch (err) { btn.disabled = false; ctx.msg(m, ctx.errText(err), 'error'); }
      };
    }
  };
})();
