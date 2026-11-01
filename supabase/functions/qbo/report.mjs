// Turns a QuickBooks Online report (JSON) into a clean PDF page set with pdf-lib.
export const REPORTS = {
  ProfitAndLoss: "Profit and Loss",
  BalanceSheet: "Balance Sheet",
  CashFlow: "Statement of Cash Flows",
};

export const safe = (s) => String(s ?? "").normalize("NFC").replace(/[^\x20-\x7E -ÿ]/g, (c) => c.normalize("NFKD").replace(/[^\x20-\x7E]/g, ""));

export function quarterRange(year, quarter) {
  const y = Number(year), q = Number(quarter);
  if (!(y >= 2000 && y <= 2100)) throw new Error("invalid_period");
  if (q === 0) return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y} (full year)` };
  if (!(q >= 1 && q <= 4)) throw new Error("invalid_period");
  const sm = (q - 1) * 3 + 1, em = sm + 2;
  const last = new Date(Date.UTC(y, em, 0)).getUTCDate();
  const p = (n) => String(n).padStart(2, "0");
  return { start: `${y}-${p(sm)}-01`, end: `${y}-${p(em)}-${p(last)}`, label: `Q${q} ${y}` };
}

export function flatten(report) {
  const out = [];
  const walk = (rows, depth) => {
    for (const row of rows || []) {
      if (row.Header?.ColData) out.push({ kind: "header", depth, cells: row.Header.ColData.map((c) => c.value ?? "") });
      if (row.ColData) out.push({ kind: "data", depth, cells: row.ColData.map((c) => c.value ?? "") });
      if (row.Rows?.Row) walk(row.Rows.Row, depth + (row.Header ? 1 : 0));
      if (row.Summary?.ColData) out.push({ kind: "total", depth, cells: row.Summary.ColData.map((c) => c.value ?? "") });
    }
  };
  walk(report?.Rows?.Row, 0);
  return out;
}

export function money(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
}

export async function reportPdf(PDFLib, { report, type, companyName, periodLabel, start, end, generatedAt }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${REPORTS[type]} - ${companyName} - ${periodLabel}`);
  pdf.setProducer("Endeavor Business Solutions");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.12, 0.23), gold = rgb(0.78, 0.64, 0.36), grey = rgb(0.42, 0.45, 0.5), ink = rgb(0.1, 0.1, 0.12);
  const cols = (report?.Columns?.Column || []).map((c) => safe(c.ColTitle || ""));
  const ncol = Math.max(cols.length, 2);
  const W = 612, H = 792, M = 48, labelW = ncol > 2 ? 230 : 330;
  const numW = (W - 2 * M - labelW) / (ncol - 1);
  const rows = flatten(report);
  let page, y;

  const newPage = (first) => {
    page = pdf.addPage([W, H]);
    y = H - M;
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: navy });
    if (first) {
      page.drawText(safe(companyName), { x: M, y: y - 6, size: 16, font: bold, color: navy }); y -= 26;
      page.drawText(safe(REPORTS[type]), { x: M, y, size: 12.5, font: bold, color: ink }); y -= 16;
      page.drawText(safe(`${periodLabel}  |  ${start} to ${end}`), { x: M, y, size: 9.5, font, color: grey }); y -= 12;
      page.drawText(safe(`Basis: ${report?.Header?.ReportBasis || "Accrual"}  |  Currency: ${report?.Header?.Currency || "USD"}  |  Source: QuickBooks Online`), { x: M, y, size: 8.5, font, color: grey }); y -= 10;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: gold }); y -= 18;
    } else {
      page.drawText(safe(`${companyName} - ${REPORTS[type]} - ${periodLabel} (continued)`), { x: M, y: y - 6, size: 9, font, color: grey }); y -= 24;
    }
    // column titles
    cols.forEach((c, i) => {
      if (i === 0) return;
      const t = c.length > 18 ? c.slice(0, 18) : c;
      const tw = bold.widthOfTextAtSize(t, 8);
      page.drawText(t, { x: M + labelW + numW * i - tw, y, size: 8, font: bold, color: grey });
    });
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.8, 0.82, 0.86) }); y -= 13;
  };
  const footer = () => {
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(safe(`Prepared by Endeavor Business Solutions from the company's QuickBooks Online data on ${generatedAt}. Unaudited. Page ${i + 1} of ${pages.length}`), { x: M, y: 28, size: 7, font, color: grey });
    });
  };

  newPage(true);
  if (!rows.length) {
    page.drawText("No activity was recorded in QuickBooks for this period.", { x: M, y, size: 10, font, color: grey });
  }
  for (const r of rows) {
    if (y < 64) newPage(false);
    const isTotal = r.kind === "total", isHead = r.kind === "header";
    const f = isTotal || isHead ? bold : font;
    const size = r.depth === 0 && (isTotal || isHead) ? 9.5 : 9;
    let label = safe(r.cells[0] || "");
    const lx = M + 12 * r.depth;
    while (label.length > 3 && f.widthOfTextAtSize(label, size) > labelW - 12 * r.depth - 6) label = label.slice(0, -2);
    if (isTotal) page.drawLine({ start: { x: M + labelW, y: y + size + 1 }, end: { x: W - M, y: y + size + 1 }, thickness: 0.5, color: rgb(0.6, 0.62, 0.66) });
    page.drawText(label, { x: lx, y, size, font: f, color: isHead ? navy : ink });
    for (let i = 1; i < ncol; i++) {
      const v = money(r.cells[i]);
      if (!v) continue;
      const tw = f.widthOfTextAtSize(v, size);
      page.drawText(v, { x: M + labelW + numW * i - tw, y, size, font: f, color: ink });
    }
    y -= isTotal ? 17 : 14;
  }
  footer();
  return await pdf.save();
}
