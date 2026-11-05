/* Operating Agreement PDF renderer (shared by the `oa` edge function and the demo).
   Letter size, 1-inch margins, Times, numbered articles and sections, justified text, clean page breaks
   (headings never stranded at the bottom, signature blocks never split), running header, "Page x of y",
   Schedule A table and a signature page whose signature/date boxes are returned as e-signature fields
   (fractions of the page, origin top-left, the format used by the Endeavor e-signature module).
   Plain script: sets globalThis.EOARender. Usage: EOARender.render(PDFLib, doc, opts) -> {bytes, fields, pages}. */
(function (G) {
  'use strict';
  var W = 612, H = 792, M = 72, TOP = H - M, BOTTOM = M + 18, WIDTH = W - 2 * M;
  var safe = function (s) { return String(s == null ? '' : s).normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, function (c) { return c.normalize('NFKD').replace(/[^\x20-\x7E]/g, ''); }); };

  async function render(PDFLib, doc, opts) {
    opts = opts || {};
    var pdf = await PDFLib.PDFDocument.create();
    pdf.setTitle(safe('Operating Agreement of ' + doc.company));
    pdf.setAuthor('Endeavor Business Solutions'); pdf.setCreator('Endeavor Operating Agreement module'); pdf.setProducer('Endeavor');
    if (opts.fixedDate) { pdf.setCreationDate(new Date(opts.fixedDate)); pdf.setModificationDate(new Date(opts.fixedDate)); }
    var F = { r: await pdf.embedFont(PDFLib.StandardFonts.TimesRoman), b: await pdf.embedFont(PDFLib.StandardFonts.TimesRomanBold), i: await pdf.embedFont(PDFLib.StandardFonts.TimesRomanItalic), h: await pdf.embedFont(PDFLib.StandardFonts.Helvetica) };
    var ink = PDFLib.rgb(0.08, 0.08, 0.1), grey = PDFLib.rgb(0.42, 0.44, 0.48), navy = PDFLib.rgb(0.05, 0.13, 0.26);
    var SIZE = 11.5, LEAD = 15.6;
    var page, y, pages = [];
    function newPage() { page = pdf.addPage([W, H]); pages.push(page); y = TOP; }
    function need(h) { if (y - h < BOTTOM) newPage(); }
    // rich text: runs [{t, f}] -> lines of words with fonts
    function layout(runs, size, width, indent) {
      var words = [];
      runs.forEach(function (r) { safe(r.t).split(/\s+/).filter(Boolean).forEach(function (w) { words.push({ w: w, f: r.f }); }); });
      var lines = [], cur = [], curW = 0, space = function (f) { return f.widthOfTextAtSize(' ', size); };
      var avail = function () { return width - (lines.length === 0 ? (indent || 0) : 0); };
      words.forEach(function (wd) {
        var ww = wd.f.widthOfTextAtSize(wd.w, size), add = cur.length ? space(wd.f) + ww : ww;
        if (cur.length && curW + add > avail()) { lines.push(cur); cur = []; curW = 0; add = ww; }
        cur.push({ w: wd.w, f: wd.f, ww: ww }); curW += add;
      });
      if (cur.length) lines.push(cur);
      return lines;
    }
    function drawLines(lines, size, lead, x0, opt) {
      opt = opt || {};
      lines.forEach(function (ln, li) {
        need(lead);
        var x = x0 + (li === 0 ? (opt.indent || 0) : 0), avail = WIDTH - (x - M) - (opt.right || 0);
        var natural = ln.reduce(function (s, w, i) { return s + w.ww + (i ? w.f.widthOfTextAtSize(' ', size) : 0); }, 0);
        var last = li === lines.length - 1, gap = (!last && opt.justify && ln.length > 1) ? (avail - natural) / (ln.length - 1) : 0;
        if (opt.center) x = M + (WIDTH - natural) / 2;
        ln.forEach(function (w, i) {
          if (i) x += w.f.widthOfTextAtSize(' ', size) + gap;
          page.drawText(w.w, { x: x, y: y - size, size: size, font: w.f, color: opt.color || ink });
          x += w.ww;
        });
        y -= lead;
      });
    }
    function para(runs, o) { o = o || {}; var size = o.size || SIZE, lead = o.lead || LEAD; var lines = layout(runs, size, WIDTH - (o.right || 0) - (o.left || 0), o.indent); drawLines(lines, size, lead, M + (o.left || 0), { justify: o.justify !== false && !o.center, center: o.center, indent: o.indent, color: o.color }); return lines.length; }
    function measure(runs, o) { o = o || {}; return layout(runs, o.size || SIZE, WIDTH - (o.left || 0), o.indent).length * (o.lead || LEAD); }

    newPage();
    // ---------- title block ----------
    y -= 18;
    para([{ t: doc.title || 'OPERATING AGREEMENT', f: F.b }], { size: 20, lead: 26, center: true, color: navy });
    para([{ t: 'OF', f: F.b }], { size: 12, lead: 18, center: true, color: navy });
    para([{ t: doc.company, f: F.b }], { size: 15.5, lead: 21, center: true, color: navy });
    para([{ t: doc.subtitle, f: F.i }], { size: 12, lead: 17, center: true });
    if (doc.effective_text) para([{ t: 'Effective as of ' + doc.effective_text, f: F.r }], { size: 11, lead: 16, center: true, color: grey });
    y -= 8; page.drawLine({ start: { x: M + 120, y: y }, end: { x: W - M - 120, y: y }, thickness: 0.8, color: navy }); y -= 22;
    para([{ t: doc.intro, f: F.r }]); y -= 6;
    if (doc.definitions && doc.definitions.length) {
      need(LEAD * 3);
      para([{ t: 'Definitions.', f: F.b }, { t: 'In this Agreement, capitalized terms not otherwise defined have the following meanings, and terms defined in the Act have the meanings given in the Act:', f: F.r }]);
      doc.definitions.forEach(function (d) { y -= 2; para([{ t: '"' + d[0] + '"', f: F.b }, { t: 'means ' + d[1], f: F.r }], { left: 18 }); });
      y -= 6;
    }
    // ---------- articles ----------
    (doc.articles || []).forEach(function (ar) {
      var first = ar.sections[0];
      var firstH = first ? Math.min(3, layout([{ t: first.num + ' ' + first.title + '.', f: F.b }, { t: first.text, f: F.r }], SIZE, WIDTH).length) * LEAD : 0;
      need(16 + 18 + 14 + firstH);
      y -= 10;
      para([{ t: 'ARTICLE ' + ar.num, f: F.b }], { size: 12, lead: 16, center: true, color: navy });
      para([{ t: ar.title, f: F.b }], { size: 12, lead: 20, center: true, color: navy });
      y -= 2;
      ar.sections.forEach(function (s) {
        var lines = layout([{ t: s.num + '  ' + s.title + '.', f: F.b }, { t: s.text, f: F.r }], SIZE, WIDTH);
        // keep at least 2 lines together; whole section if it is short
        need(Math.min(lines.length, lines.length <= 4 ? lines.length : 2) * LEAD);
        drawLines(lines, SIZE, LEAD, M, { justify: true });
        y -= 7;
      });
    });
    // ---------- signature page ----------
    newPage();
    para([{ t: 'SIGNATURE PAGE', f: F.b }], { size: 12, lead: 18, center: true, color: navy }); y -= 6;
    para([{ t: 'IN WITNESS WHEREOF, the undersigned ' + (doc.signers.length > 1 ? 'have' : 'has') + ' executed this Operating Agreement of ' + doc.company + ' as of the effective date stated above.', f: F.r }]);
    y -= 18;
    var fields = [], BLOCK = 118;
    doc.signers.forEach(function (s, i) {
      if (y - BLOCK < BOTTOM) newPage();
      var top = y, pageIndex = pages.length - 1;
      page.drawText(safe(s.capacity.toUpperCase()), { x: M, y: top - 10, size: 9.5, font: F.b, color: navy });
      var lineY = top - 60;
      page.drawLine({ start: { x: M, y: lineY }, end: { x: M + 280, y: lineY }, thickness: 0.7, color: ink });
      page.drawText('Signature', { x: M, y: lineY - 11, size: 8.5, font: F.i, color: grey });
      page.drawText(safe('Name: ' + s.name), { x: M, y: lineY - 27, size: 11, font: F.r, color: ink });
      page.drawText(safe('Title: ' + s.capacity), { x: M, y: lineY - 42, size: 11, font: F.r, color: ink });
      var dx = M + 320;
      page.drawLine({ start: { x: dx, y: lineY }, end: { x: W - M, y: lineY }, thickness: 0.7, color: ink });
      page.drawText('Date', { x: dx, y: lineY - 11, size: 8.5, font: F.i, color: grey });
      var fx = function (x) { return x / W; }, fy = function (yy) { return (H - yy) / H; };
      fields.push({ id: 'sig-' + i, signer: i, type: 'signature', page: pageIndex, x: fx(M + 2), y: fy(lineY + 40), w: fx(276), h: 38 / H, label: 'Signature: ' + s.name, required: true });
      fields.push({ id: 'date-' + i, signer: i, type: 'date', page: pageIndex, x: fx(dx + 2), y: fy(lineY + 18), w: fx(W - M - dx - 4), h: 16 / H, label: 'Date: ' + s.name, required: true });
      y = top - BLOCK;
    });
    // ---------- Schedule A ----------
    newPage();
    para([{ t: 'SCHEDULE A', f: F.b }], { size: 12, lead: 16, center: true, color: navy });
    para([{ t: 'MEMBERS, CAPITAL CONTRIBUTIONS AND PERCENTAGE INTERESTS', f: F.b }], { size: 11, lead: 16, center: true, color: navy });
    if (doc.effective_text) para([{ t: 'As of ' + doc.effective_text, f: F.i }], { size: 10.5, lead: 18, center: true, color: grey });
    y -= 10;
    var cols = [M, M + 220, M + 345, W - M], rowH = 24;
    var cell = function (t, ci, f, right) { var s = safe(t), size = 10.5, x = right ? cols[ci + 1] - 8 - f.widthOfTextAtSize(s, size) : cols[ci] + 8; while (f.widthOfTextAtSize(s, size) > cols[ci + 1] - cols[ci] - 12 && s.length > 4) s = s.slice(0, -2) + '…'.replace('…', '.'); page.drawText(s, { x: x, y: y - 16, size: size, font: f, color: ink }); };
    var row = function (vals, f, shade) {
      if (y - rowH < BOTTOM) newPage();
      if (shade) page.drawRectangle({ x: cols[0], y: y - rowH, width: cols[3] - cols[0], height: rowH, color: PDFLib.rgb(0.93, 0.95, 0.97) });
      page.drawRectangle({ x: cols[0], y: y - rowH, width: cols[3] - cols[0], height: rowH, borderColor: PDFLib.rgb(0.55, 0.6, 0.66), borderWidth: 0.6 });
      [1, 2].forEach(function (c) { page.drawLine({ start: { x: cols[c], y: y }, end: { x: cols[c], y: y - rowH }, thickness: 0.6, color: PDFLib.rgb(0.55, 0.6, 0.66) }); });
      cell(vals[0], 0, f); cell(vals[1], 1, f, true); cell(vals[2], 2, f, true); y -= rowH;
    };
    row(['Member', 'Capital Contribution', 'Percentage Interest'], F.b, true);
    (doc.schedule || []).forEach(function (r) { row([r.name, r.contribution, r.pct], F.r); });
    row(['Total', '', '100%'], F.b);
    if (doc.managers && doc.managers.length) { y -= 18; para([{ t: 'Manager' + (doc.managers.length > 1 ? 's' : '') + ':', f: F.b }, { t: doc.managers.join('; '), f: F.r }]); }

    // ---------- running header, footer, watermark ----------
    var total = pages.length;
    pages.forEach(function (p, i) {
      if (i > 0) p.drawText(safe('Operating Agreement of ' + doc.company), { x: M, y: H - 44, size: 8.5, font: F.i, color: grey });
      var foot = 'Page ' + (i + 1) + ' of ' + total, fw = F.r.widthOfTextAtSize(foot, 9);
      p.drawText(foot, { x: (W - fw) / 2, y: 40, size: 9, font: F.r, color: grey });
      if (opts.footerLeft) p.drawText(safe(opts.footerLeft), { x: M, y: 40, size: 7.5, font: F.h, color: grey });
      if (opts.footerRight) { var rw = F.h.widthOfTextAtSize(safe(opts.footerRight), 7.5); p.drawText(safe(opts.footerRight), { x: W - M - rw, y: 40, size: 7.5, font: F.h, color: grey }); }
      if (opts.watermark) {
        var wm = safe(opts.watermark), ws = 54, ww = F.b.widthOfTextAtSize(wm, ws);
        p.drawText(wm, { x: W / 2 - ww * 0.35, y: H / 2 - ww * 0.35, size: ws, font: F.b, color: PDFLib.rgb(0.85, 0.2, 0.2), opacity: 0.09, rotate: PDFLib.degrees(45) });
      }
    });
    var bytes = await pdf.save();
    return { bytes: bytes, fields: fields, pages: total };
  }
  G.EOARender = { render: render, safe: safe };
})(typeof globalThis !== 'undefined' ? globalThis : window);
