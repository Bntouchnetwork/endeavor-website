/* Endeavor Referral Partner Agreement: PDF renderer (pdf-lib).
   Plain script: sets globalThis.EPContract. EPContract.render(PDFLib, data) -> { bytes, fields, pages }
   data: { version, date_text, partner: { name, company, email, country, type }, pct }
   The signature page returns e-signature fields in the format of the Endeavor e-signature module
   (fractions of the page, origin top-left), with signer 0 = Partner and signer 1 = Endeavor.
   TEMPLATE: must be reviewed by an attorney before use with real partners. */
(function (G) {
  'use strict';
  var W = 612, H = 792, M = 72, TOP = H - M, BOTTOM = M + 18, WIDTH = W - 2 * M;
  var VERSION = '2026-11-06';
  var safe = function (s) { return String(s == null ? '' : s).normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, function (c) { return c.normalize('NFKD').replace(/[^\x20-\x7E]/g, ''); }); };
  var pctText = function (p) { var n = Number(p); return (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '') + '%'; };

  function sections(d) {
    var P = d.partner, pct = pctText(d.pct);
    return [
      ['Purpose', 'Endeavor provides business formation, registered agent, compliance, tax coordination and related services to entrepreneurs and investors, mainly foreign nationals doing business in the United States. Partner wishes to refer prospective clients to Endeavor. This Agreement sets the terms of those referrals and of the commissions payable to Partner.'],
      ['Referrals', 'Partner may refer prospective clients ("Referrals") through the Endeavor Partner Portal. A Referral is credited to Partner when it is registered in the Partner Portal (or otherwise recorded by Endeavor) before the client signs up with Endeavor, and the client was not already a client or an open lead of Endeavor. A referred person who becomes a paying client of Endeavor is a "Referred Client". Partner must have the prospective client\'s consent before sharing their contact details with Endeavor. Endeavor may decline any Referral or any engagement at its discretion.'],
      ['Commission', 'For each invoice issued by Endeavor to a Referred Client and linked to Partner in Endeavor\'s system, Endeavor will pay Partner a commission equal to ' + pct + ' of the amount of that invoice actually paid by the Referred Client (the "Commission"), unless a different percentage is stated on that invoice with Partner\'s agreement in writing. No Commission is due on unpaid, voided or refunded amounts, on chargebacks, or on government, state or third-party fees passed through to the client. If an amount on which a Commission was paid is later refunded or charged back, Endeavor may deduct the corresponding Commission from future Commissions or request its repayment.'],
      ['Payment', 'Commissions are paid through Stripe Connect to the Stripe account that Partner creates and keeps in good standing, generally when the Referred Client\'s payment is received. If Partner\'s Stripe account is not ready when a payment is received, the Commission is held as pending and paid once the account is ready. Endeavor does not receive or store Partner\'s bank account details. Partner\'s Commission statement is available in the Partner Portal.'],
      ['Taxes', 'Partner is responsible for all taxes on the Commissions. Partner will provide accurate tax information (Form W-9 for U.S. persons or the applicable Form W-8 for non-U.S. persons) through Stripe when setting up the Stripe account. Endeavor, directly or through Stripe, will issue Form 1099 or other information returns when required by law. Endeavor may withhold amounts when required by law.'],
      ['Independent contractor', 'Partner is an independent contractor. Nothing in this Agreement creates an employment, agency, partnership or joint venture relationship. Partner has no authority to bind Endeavor, to make promises or quote prices on Endeavor\'s behalf, or to give legal, tax or accounting advice on Endeavor\'s behalf. Partner is responsible for its own expenses.'],
      ['Conduct and compliance', 'Partner will describe Endeavor\'s services accurately, will not make false or misleading statements, and will comply with all laws that apply to Partner, including laws on marketing communications, privacy and data protection, and any rules of Partner\'s profession or license (including any limits on referral fees). If Partner\'s professional rules restrict the receipt of referral fees, Partner must inform Endeavor in writing and Endeavor will not pay Commissions that are not allowed. Partner will not send unsolicited bulk messages in Endeavor\'s name.'],
      ['Confidentiality and data', 'Each party will keep confidential the non-public information received from the other party and from clients, and will use it only for the purposes of this Agreement. Partner will not ask clients to send Endeavor sensitive identification or bank data outside of Endeavor\'s secure client portal.'],
      ['Use of name', 'Partner may say that it is an Endeavor referral partner. Partner may use Endeavor\'s name and logo only as provided or approved by Endeavor, and must stop using them when this Agreement ends.'],
      ['Term and termination', 'This Agreement starts on the date it is signed by both parties and continues until terminated. Either party may terminate it at any time by written notice (including by email) with 30 days\' notice, or immediately for a material breach by the other party. Commissions on payments received by Endeavor before the termination date remain due. This Agreement is non-exclusive: both parties may work with others.'],
      ['Limitation of liability', 'Except for breaches of confidentiality, fraud or willful misconduct, neither party is liable to the other for indirect, incidental, consequential or punitive damages, and Endeavor\'s total liability under this Agreement is limited to the Commissions paid or payable to Partner in the 12 months before the claim.'],
      ['Changes', 'Endeavor may update the standard terms of the Partner Program by giving Partner at least 30 days\' written notice. Changes to Partner\'s Commission percentage require Partner\'s agreement. Partner may terminate this Agreement if it does not accept a change.'],
      ['Governing law', 'This Agreement is governed by the laws of the State of Florida, without regard to its conflict of laws rules. The state and federal courts located in Orange County, Florida have exclusive jurisdiction over any dispute arising from this Agreement.'],
      ['Entire agreement and electronic signatures', 'This Agreement is the entire agreement between the parties about its subject and replaces any prior understanding. The parties agree to sign it electronically, and electronic signatures and records have the same effect as handwritten signatures and paper records. If any provision is held unenforceable, the remaining provisions remain in effect.']
    ];
  }

  async function render(PDFLib, d) {
    var pdf = await PDFLib.PDFDocument.create();
    pdf.setTitle(safe('Referral Partner Agreement - ' + d.partner.name)); pdf.setAuthor('Endeavor Business Solutions'); pdf.setCreator('Endeavor Partner Program'); pdf.setProducer('Endeavor');
    var F = { r: await pdf.embedFont(PDFLib.StandardFonts.TimesRoman), b: await pdf.embedFont(PDFLib.StandardFonts.TimesRomanBold), i: await pdf.embedFont(PDFLib.StandardFonts.TimesRomanItalic), h: await pdf.embedFont(PDFLib.StandardFonts.Helvetica) };
    var ink = PDFLib.rgb(0.08, 0.08, 0.1), grey = PDFLib.rgb(0.42, 0.44, 0.48), navy = PDFLib.rgb(0.05, 0.13, 0.26);
    var SIZE = 11, LEAD = 15;
    var page, y, pages = [];
    function newPage() { page = pdf.addPage([W, H]); pages.push(page); y = TOP; }
    function layout(runs, size, width) {
      var words = []; runs.forEach(function (r) { safe(r.t).split(/\s+/).filter(Boolean).forEach(function (w) { words.push({ w: w, f: r.f }); }); });
      var lines = [], cur = [], curW = 0;
      words.forEach(function (wd) {
        var ww = wd.f.widthOfTextAtSize(wd.w, size), add = cur.length ? wd.f.widthOfTextAtSize(' ', size) + ww : ww;
        if (cur.length && curW + add > width) { lines.push(cur); cur = []; curW = 0; add = ww; }
        cur.push({ w: wd.w, f: wd.f, ww: ww }); curW += add;
      });
      if (cur.length) lines.push(cur);
      return lines;
    }
    function para(runs, o) {
      o = o || {}; var size = o.size || SIZE, lead = o.lead || LEAD, lines = layout(runs, size, WIDTH);
      lines.forEach(function (ln, li) {
        if (y - lead < BOTTOM) newPage();
        var natural = ln.reduce(function (s, w, i) { return s + w.ww + (i ? w.f.widthOfTextAtSize(' ', size) : 0); }, 0);
        var gap = (!o.center && li < lines.length - 1 && ln.length > 1) ? (WIDTH - natural) / (ln.length - 1) : 0, x = o.center ? M + (WIDTH - natural) / 2 : M;
        ln.forEach(function (w, i) { if (i) x += w.f.widthOfTextAtSize(' ', size) + gap; page.drawText(w.w, { x: x, y: y - size, size: size, font: w.f, color: o.color || ink }); x += w.ww; });
        y -= lead;
      });
    }
    var P = d.partner, who = P.company ? P.name + ' (' + P.company + ')' : P.name;
    newPage();
    y -= 10;
    para([{ t: 'REFERRAL PARTNER AGREEMENT', f: F.b }], { size: 18, lead: 24, center: true, color: navy });
    para([{ t: 'Endeavor Business Solutions Partner Program', f: F.i }], { size: 12, lead: 18, center: true });
    y -= 6; page.drawLine({ start: { x: M + 120, y: y }, end: { x: W - M - 120, y: y }, thickness: 0.8, color: navy }); y -= 18;
    para([{ t: 'This Referral Partner Agreement (the "Agreement") is made between', f: F.r }, { t: 'Endeavor Tax Solutions LLC, doing business as Endeavor Business Solutions,', f: F.b }, { t: 'with offices in Orlando, Florida ("Endeavor"), and', f: F.r }, { t: who + ',', f: F.b },
      { t: 'email ' + P.email + (P.country ? ', ' + P.country : '') + ' ("Partner"). It takes effect on the date it is signed by both parties.', f: F.r }]);
    y -= 4;
    para([{ t: 'Commission percentage agreed:', f: F.b }, { t: pctText(d.pct) + ' (see Section 3).', f: F.r }]);
    y -= 8;
    sections(d).forEach(function (s, i) {
      var lines = layout([{ t: (i + 1) + '. ' + s[0] + '.', f: F.b }, { t: s[1], f: F.r }], SIZE, WIDTH);
      if (y - Math.min(3, lines.length) * LEAD < BOTTOM) newPage();
      para([{ t: (i + 1) + '. ' + s[0] + '.', f: F.b }, { t: s[1], f: F.r }]);
      y -= 6;
    });
    // signature page
    newPage();
    para([{ t: 'SIGNATURES', f: F.b }], { size: 12, lead: 18, center: true, color: navy }); y -= 4;
    para([{ t: 'The parties sign this Agreement electronically through the Endeavor e-signature system.', f: F.r }]);
    y -= 20;
    var fields = [], fx = function (x) { return x / W; }, fy = function (yy) { return (H - yy) / H; };
    [{ cap: 'PARTNER', name: P.name, title: P.company ? 'For ' + P.company : 'Individually' }, { cap: 'ENDEAVOR TAX SOLUTIONS LLC d/b/a ENDEAVOR BUSINESS SOLUTIONS', name: '', title: 'Title: Authorized representative' }].forEach(function (s, i) {
      var top = y, pageIndex = pages.length - 1;
      page.drawText(safe(s.cap), { x: M, y: top - 10, size: 9.5, font: F.b, color: navy });
      var lineY = top - 60;
      page.drawLine({ start: { x: M, y: lineY }, end: { x: M + 280, y: lineY }, thickness: 0.7, color: ink });
      page.drawText('Signature', { x: M, y: lineY - 11, size: 8.5, font: F.i, color: grey });
      page.drawText(safe('Name: ' + s.name), { x: M, y: lineY - 27, size: 11, font: F.r, color: ink });
      page.drawText(safe(s.title), { x: M, y: lineY - 42, size: 11, font: F.r, color: ink });
      var dx = M + 320;
      page.drawLine({ start: { x: dx, y: lineY }, end: { x: W - M, y: lineY }, thickness: 0.7, color: ink });
      page.drawText('Date', { x: dx, y: lineY - 11, size: 8.5, font: F.i, color: grey });
      fields.push({ id: 'sig-' + i, signer: i, type: 'signature', page: pageIndex, x: fx(M + 2), y: fy(lineY + 40), w: fx(276), h: 38 / H, label: 'Signature', required: true });
      if (i === 1) fields.push({ id: 'name-1', signer: 1, type: 'name', page: pageIndex, x: fx(M + 34), y: fy(lineY - 16), w: fx(240), h: 14 / H, label: 'Name', required: true });
      fields.push({ id: 'date-' + i, signer: i, type: 'date', page: pageIndex, x: fx(dx + 2), y: fy(lineY + 18), w: fx(W - M - dx - 4), h: 16 / H, label: 'Date', required: true });
      y = top - 130;
    });
    var total = pages.length;
    pages.forEach(function (p, i) {
      var foot = 'Page ' + (i + 1) + ' of ' + total, fw = F.r.widthOfTextAtSize(foot, 9);
      p.drawText(foot, { x: (W - fw) / 2, y: 40, size: 9, font: F.r, color: grey });
      p.drawText(safe('Referral Partner Agreement v' + VERSION + ' - ' + (d.date_text || '')), { x: M, y: 40, size: 7.5, font: F.h, color: grey });
      if (i > 0) p.drawText(safe('Endeavor Business Solutions - Referral Partner Agreement - ' + P.name), { x: M, y: H - 44, size: 8.5, font: F.i, color: grey });
    });
    var bytes = await pdf.save();
    return { bytes: bytes, fields: fields, pages: total, version: VERSION };
  }
  G.EPContract = { render: render, version: VERSION };
})(typeof globalThis !== 'undefined' ? globalThis : window);
