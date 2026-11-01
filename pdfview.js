/* Shared PDF rendering (pdf.js) for the admin editor, the in-console viewer and the signer page. */
(function () {
  'use strict';
  var PDFJS_VER = '3.11.174';
  function lib() {
    var p = window.pdfjsLib;
    if (!p) throw new Error('pdfjs_not_loaded');
    if (!p.GlobalWorkerOptions.workerSrc) p.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VER + '/pdf.worker.min.js';
    return p;
  }
  window.EPdf = {
    /* src: ArrayBuffer | Uint8Array | URL string */
    open: function (src) {
      var p = lib();
      var params = typeof src === 'string' ? { url: src } : { data: src instanceof Uint8Array ? src.slice() : new Uint8Array(src.slice(0)) };
      return p.getDocument(params).promise;
    },
    /* Renders every page into `container`. Each page gets a .pdfpage wrapper (position:relative) with a canvas and an
       .pdfpage__layer overlay for fields. Returns [{el, layer, index, width, height}] where width/height are PDF points. */
    render: async function (doc, container, opts) {
      opts = opts || {};
      container.innerHTML = '';
      var out = [];
      var maxW = opts.maxWidth || 900;
      var avail = Math.max(260, Math.min(maxW, container.clientWidth || maxW));
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      for (var i = 1; i <= doc.numPages; i++) {
        var page = await doc.getPage(i);
        var base = page.getViewport({ scale: 1 });
        var scale = (avail / base.width) * dpr * (opts.quality || 1);
        var vp = page.getViewport({ scale: scale });
        var wrap = document.createElement('div');
        wrap.className = 'pdfpage';
        wrap.style.aspectRatio = base.width + ' / ' + base.height;
        wrap.dataset.page = String(i - 1);
        wrap.setAttribute('aria-label', (opts.pageLabel || 'Page') + ' ' + i);
        var canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        canvas.setAttribute('aria-hidden', 'true');
        var layer = document.createElement('div');
        layer.className = 'pdfpage__layer';
        wrap.appendChild(canvas); wrap.appendChild(layer);
        var num = document.createElement('span'); num.className = 'pdfpage__num'; num.textContent = i + ' / ' + doc.numPages; num.setAttribute('aria-hidden', 'true');
        wrap.appendChild(num);
        container.appendChild(wrap);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        out.push({ el: wrap, layer: layer, index: i - 1, width: base.width, height: base.height });
      }
      return out;
    },
    /* Strip characters the standard PDF fonts cannot draw (keeps Latin-1 accents). */
    safe: function (s) {
      return String(s == null ? '' : s).normalize('NFC').replace(/[^\x20-\x7E -ÿ]/g, function (c) { return c.normalize('NFKD').replace(/[^\x20-\x7E]/g, ''); });
    }
  };
})();
