// Skill "Prazos fiscais" do Agente Admin: partes puras (sem rede), para poder testar.
// A IA só lê páginas oficiais que a plataforma baixou; cada prazo precisa de um trecho copiado da fonte.
export type Row = Record<string, any>;
export const CATS = ["annual_report", "federal_tax", "state_tax", "payroll", "sales_tax", "boi", "license", "other"];

// só sites oficiais: .gov, domínios estaduais .us e os dois sites oficiais da Flórida que não são .gov
const EXTRA_HOSTS = ["sunbiz.org", "floridarevenue.com"];
export function officialUrl(u: unknown): string | null {
  let x: URL;
  try { x = new URL(String(u || "").trim()); } catch { return null; }
  if (x.protocol !== "https:" || x.port || x.username || x.password) return null;
  const h = x.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(h) || /^\d+(\.\d+){3}$/.test(h) || !h.includes(".")) return null;
  const ok = h.endsWith(".gov") || /\.[a-z]{2}\.us$/.test(h) || EXTRA_HOSTS.some((e) => h === e || h.endsWith("." + e));
  if (!ok) return null;
  if (/\.(pdf|zip|docx?|xlsx?|epub)$/i.test(x.pathname)) return null;      // só páginas de texto
  x.hash = "";
  return x.toString();
}

export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table|ul|ol|dd|dt)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;|&#34;/g, '"').replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&ndash;|&mdash;/g, "-").replace(/&[a-z]+;|&#\d+;/gi, " ")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 2).join("\n");
}

// guarda, na ordem da página, os blocos que falam de datas ou do assunto, até o limite de caracteres
const MESES = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan\.|feb\.|mar\.|apr\.|aug\.|sept?\.|oct\.|nov\.|dec\.)\b/i;
export function relevant(text: string, keywords: string[], max: number): string {
  const kw = keywords.map((k) => k.toLowerCase()).filter(Boolean);
  const out: string[] = []; let n = 0;
  for (const b of text.split("\n")) {
    const l = b.toLowerCase();
    const hit = MESES.test(b) || /\b(due|deadline|file by|filed by|no later than|15th day|last day|on or before)\b/i.test(b) || kw.some((k) => l.includes(k));
    if (!hit) continue;
    const piece = b.slice(0, 900);
    if (n + piece.length + 1 > max) break;
    out.push(piece); n += piece.length + 1;
  }
  return out.join("\n");
}

const norm = (s: unknown) => String(s || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
// o trecho citado precisa existir na fonte (é o que impede data ou regra inventada)
export function quoteInSource(quote: unknown, source: string): boolean {
  const q = norm(quote);
  return q.length >= 15 && q.length <= 600 && norm(source).includes(q);
}

// "assinatura" de uma obrigação, para não duplicar o que a equipe ou o agente já cadastrou
export function sig(title: unknown): string[] {
  const t = String(title || "").toLowerCase();
  const forms = (t.match(/\b(?:f-)?\d{3,4}(?:-[a-z]{1,4})?\b|\bw-?[23]\b|\bk-?1\b/g) || []).map((x) => x.replace(/^f-/, "f").replace(/^(w|k)-?/, "$1")).filter((x) => !/^(19|20)\d\d$/.test(x));
  const words: string[] = [];
  if (/annual report|relat[óo]rio anual|informe anual/.test(t)) words.push("annualreport");
  if (/estimated|estimad/.test(t)) words.push("estimated");
  if (/\bboi\b|beneficial ownership/.test(t)) words.push("boi");
  if (/business tax receipt|local business tax|\bbtr\b|alvar[áa]|licen[çcs]/.test(t)) words.push("license");
  if (/sales (and use )?tax|imposto sobre vendas/.test(t)) words.push("salestax");
  if (/franchise/.test(t)) words.push("franchise");
  return [...new Set([...forms, ...words])];
}
const dias = (a: string, b: string) => Math.abs((Date.parse(a + "T12:00:00Z") - Date.parse(b + "T12:00:00Z")) / 864e5);
export function sameObligation(a: { title: string; category: string; due_date: string }, b: { title: string; category: string; due_date: string }): boolean {
  if (a.category !== b.category) return false;
  const d = dias(a.due_date, b.due_date);
  if (d > 45) return false;
  const sa = sig(a.title), sb = sig(b.title);
  if (sa.length && sb.length) {
    // pagamentos estimados repetem a cada trimestre: só é o mesmo se a data estiver perto
    if (sa.includes("estimated") && sb.includes("estimated")) return d <= 20;
    return sa.some((x) => sb.includes(x));
  }
  return d === 0 && norm(a.title).slice(0, 24) === norm(b.title).slice(0, 24);
}

export type Found = { title: string; category: string; due_date: string; source_url: string; basis: "stated" | "rule"; note: string };
// confere o que a IA devolveu: categoria, data nos dois anos, fonte válida e o trecho copiado da fonte
export function validate(raw: unknown, sources: { url: string; text: string }[], years: number[]): { ok: Found[]; rejected: number } {
  const list = Array.isArray((raw as Row)?.deadlines) ? (raw as Row).deadlines as Row[] : [];
  const ok: Found[] = []; let rejected = 0;
  for (const d of list.slice(0, 60)) {
    const title = String(d?.title || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
    const due = String(d?.due_date || ""), src = sources[Number(d?.source) - 1];
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(due) && !isNaN(Date.parse(due + "T12:00:00Z")) && new Date(due + "T12:00:00Z").toISOString().slice(0, 10) === due && years.includes(+due.slice(0, 4));
    if (title.length < 3 || !CATS.includes(d?.category) || !dateOk || !src || !quoteInSource(d?.quote, src.text)) { rejected++; continue; }
    if (ok.some((x) => sameObligation(x, { title, category: d.category, due_date: due }))) continue;
    // anotação curta do que vence (o que é e a que período se refere), escrita pela IA só com o que está na fonte
    const note = String(d?.note || "").replace(/<[^>]*>/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 280);
    ok.push({ title, category: d.category, due_date: due, source_url: src.url, basis: d?.basis === "rule" ? "rule" : "stated", note });
  }
  return { ok, rejected };
}

// o que fazer com cada prazo encontrado: criar, atualizar a data (só do que o próprio agente criou) ou deixar como está
export function plan(found: Found[], existing: Row[]): { create: Found[]; update: { id: string; found: Found; from: string }[]; keep: { id: string; found: Found }[]; manual: number } {
  const out = { create: [] as Found[], update: [] as { id: string; found: Found; from: string }[], keep: [] as { id: string; found: Found }[], manual: 0 };
  for (const f of found) {
    const m = existing.find((e) => sameObligation({ title: e.title, category: e.category, due_date: e.due_date }, f));
    if (!m) { out.create.push(f); continue; }
    if (m.origin !== "agent") { out.manual++; continue; }                   // o que a equipe cadastrou continua valendo
    if (m.due_date !== f.due_date && m.status !== "done" && m.status !== "not_applicable") out.update.push({ id: m.id, found: f, from: m.due_date });
    else out.keep.push({ id: m.id, found: f });
  }
  return out;
}
