// Shared stamping logic (plain JS so it runs both in Deno and in Node tests).
export const FIELD_TYPES = ["signature", "initials", "date", "name", "email", "text", "checkbox"];

// pdf-lib standard fonts only support WinAnsi; strip anything else
export const safe = (s) => String(s ?? "").normalize("NFC").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, (c) => c.normalize("NFKD").replace(/[^\x20-\x7E]/g, ""));

export function wrap(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function cleanFields(raw, pageCount) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f) => f && FIELD_TYPES.includes(f.type) && Number.isInteger(f.page) && f.page >= 0 && f.page < pageCount)
    .map((f) => ({
      id: String(f.id).slice(0, 40), type: f.type, page: f.page, required: f.required !== false,
      x: Math.min(1, Math.max(0, +f.x || 0)), y: Math.min(1, Math.max(0, +f.y || 0)),
      w: Math.min(1, Math.max(0.01, +f.w || 0.1)), h: Math.min(1, Math.max(0.01, +f.h || 0.04)),
      label: String(f.label || "").slice(0, 80),
    }));
}

// Returns an error code or null.
export function validateValues(fields, values, hasSig, hasInit) {
  for (const f of fields) {
    if (!f.required) continue;
    if (f.type === "signature" && !hasSig) return "signature_required";
    if (f.type === "initials" && !hasInit) return "initials_required";
    if (f.type === "text" && !String(values?.[f.id] ?? "").trim()) return "fields_required";
    if (f.type === "checkbox" && values?.[f.id] !== true) return "fields_required";
  }
  return null;
}

// Draw every placed field onto the document. Coordinates are fractions of the page box, origin top-left.
export async function stampFields(pdf, { rgb, font, bold, fields, values, sigImg, initImg, typedName, email, dateText, envelopeShort }) {
  const pages = pdf.getPages();
  const ink = rgb(0.04, 0.12, 0.27);
  for (const f of fields) {
    const page = pages[f.page];
    const box = page.getCropBox();
    const W = box.width, H = box.height;
    const x = box.x + f.x * W, w = f.w * W, h = f.h * H;
    const y = box.y + H - (f.y * H) - h;
    const fitText = (text, maxSize = 11) => {
      const t = safe(text);
      let size = Math.min(maxSize, h * 0.7);
      while (size > 5 && font.widthOfTextAtSize(t, size) > w - 2) size -= 0.5;
      page.drawText(t, { x: x + 1, y: y + (h - size) / 2 + size * 0.2, size, font, color: ink });
    };
    if (f.type === "signature" || f.type === "initials") {
      const img = f.type === "signature" ? sigImg : initImg;
      if (!img) continue;
      const capH = f.type === "signature" ? h * 0.78 : h;
      const s = img.scaleToFit(w, capH);
      page.drawImage(img, { x: x + (w - s.width) / 2, y: y + (f.type === "signature" ? h * 0.22 : 0) + (capH - s.height) / 2, width: s.width, height: s.height });
      if (f.type === "signature") {
        const tag = safe("e-signed " + dateText + " | " + envelopeShort);
        const ts = Math.max(4, Math.min(6, h * 0.18));
        page.drawText(tag, { x: x + 1, y: y + 1, size: ts, font, color: rgb(0.35, 0.35, 0.4) });
      }
    } else if (f.type === "date") fitText(dateText);
    else if (f.type === "name") fitText(typedName);
    else if (f.type === "email") fitText(email);
    else if (f.type === "text") { const v = String(values?.[f.id] ?? "").slice(0, 500); if (v) fitText(v); }
    else if (f.type === "checkbox" && values?.[f.id] === true) {
      const s = Math.min(w, h);
      page.drawText("X", { x: x + (w - s * 0.7) / 2, y: y + (h - s * 0.7) / 2 + s * 0.08, size: s * 0.85, font: bold, color: ink });
    }
  }
}

// "Endeavor Envelope ID" line at the top-left of every page (like other e-signature platforms).
export function stampEnvelopeId(pdf, { font, rgb, id, pages }) {
  const label = "Endeavor Envelope ID: " + String(id).toUpperCase();
  for (const page of pages || pdf.getPages()) {
    const b = page.getCropBox();
    page.drawText(label, { x: b.x + 18, y: b.y + b.height - 14, size: 7, font, color: rgb(0.35, 0.35, 0.4) });
  }
}
