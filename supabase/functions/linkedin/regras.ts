// Regras do LinkedIn Manager (sem banco nem rede), testadas em tests/linkedin.test.ts.

export const IDIOMAS = ["pt", "en", "es"] as const;
export const FUSOS = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Sao_Paulo", "Europe/Lisbon", "Europe/Madrid", "America/Mexico_City", "America/Bogota"];

export type Ajustes = { idioma: string; posts_semana: number; horarios: string[]; fuso: string; modo_resposta: "manual" | "auto"; whatsapp: string; agenda: string; palavras: string[];
  ext: { modo: "manual" | "auto"; velocidade: number; intervalo_min: number; intervalo_max: number; limite_dia: number } };

const url = (v: unknown, hosts?: RegExp) => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" && (!hosts || hosts.test(u.hostname)) ? u.href.slice(0, 300) : ""; } catch { return ""; } };
const num = (v: unknown, min: number, max: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

/** Limpa os ajustes vindos da tela. Padrões seguros: resposta MANUAL e extensão MANUAL. */
export function limparAjustes(a: unknown): Ajustes {
  // deno-lint-ignore no-explicit-any
  const x: any = a && typeof a === "object" ? a : {}, e = x.ext && typeof x.ext === "object" ? x.ext : {};
  const horarios = [...new Set((Array.isArray(x.horarios) ? x.horarios : []).map(String).filter((h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)))].sort().slice(0, 4) as string[];
  const min = num(e.intervalo_min, 30, 3600, 90);
  return {
    idioma: IDIOMAS.includes(x.idioma) ? x.idioma : "pt",
    posts_semana: num(x.posts_semana, 1, 7, 3),
    horarios: horarios.length ? horarios : ["09:00"],
    fuso: FUSOS.includes(x.fuso) ? x.fuso : "America/New_York",
    modo_resposta: x.modo_resposta === "auto" ? "auto" : "manual",
    whatsapp: url(x.whatsapp, /(^|\.)wa\.me$|(^|\.)whatsapp\.com$/),
    agenda: url(x.agenda),
    palavras: [...new Set((Array.isArray(x.palavras) ? x.palavras : []).map((p: unknown) => String(p || "").replace(/[<>]/g, "").trim().toLowerCase().slice(0, 60)).filter(Boolean))].slice(0, 40) as string[],
    ext: { modo: e.modo === "auto" ? "auto" : "manual", velocidade: num(e.velocidade, 80, 400, 220), intervalo_min: min, intervalo_max: Math.max(min, num(e.intervalo_max, 30, 7200, 300)), limite_dia: num(e.limite_dia, 1, 50, 15) },
  };
}

/** Instante UTC de uma data/hora local num fuso (sem biblioteca). */
export function utcDe(dia: string, hora: string, fuso: string): Date {
  const [y, m, d] = dia.split("-").map(Number), [hh, mm] = hora.split(":").map(Number);
  let t = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) { // ajusta pelo deslocamento do fuso naquele instante (duas passadas cobrem a troca de horário de verão)
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    t += Date.UTC(y, m - 1, d, hh, mm) - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return new Date(t);
}
const diaLocal = (ms: number, fuso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const semana = (dia: string) => new Date(dia + "T12:00:00Z").getUTCDay();

/** Horários da semana: N posts nos próximos 7 dias, espalhados, dias úteis primeiro, só no futuro e sem bater em horário já usado. */
export function horariosDaSemana(a: Ajustes, agoraMs: number, ocupados: string[] = []): Date[] {
  const dias: string[] = [];
  for (let i = 0; i < 8 && dias.length < 7; i++) { const d = diaLocal(agoraMs + i * 86400000, a.fuso); if (!dias.includes(d)) dias.push(d); }
  const uteis = dias.filter((d) => semana(d) >= 1 && semana(d) <= 5), fds = dias.filter((d) => semana(d) === 0 || semana(d) === 6);
  const ordem: string[] = [];
  // espalha: pega dias úteis alternados (seg, qua, sex, ter, qui) antes do fim de semana
  for (const passo of [0, 1]) for (let i = passo; i < uteis.length; i += 2) ordem.push(uteis[i]);
  ordem.push(...fds);
  const usados = new Set(ocupados.map((o) => new Date(o).toISOString())), out: Date[] = [];
  for (let volta = 0; out.length < a.posts_semana && volta < a.horarios.length; volta++) {
    for (let i = 0; i < ordem.length && out.length < a.posts_semana; i++) {
      const quando = utcDe(ordem[i], a.horarios[(i + volta) % a.horarios.length], a.fuso);
      if (quando.getTime() < agoraMs + 30 * 60000 || usados.has(quando.toISOString())) continue;
      usados.add(quando.toISOString()); out.push(quando);
    }
  }
  return out.sort((x, y) => x.getTime() - y.getTime());
}

/** Compliance: promessa de resultado ou aconselhamento jurídico/financeiro individual não sai (vira revisão manual). */
const PROIBIDO: [RegExp, string][] = [
  [/\b(visto garantido|guaranteed visa|visa garantizada|green card garantido)\b/i, "promessa de visto"],
  [/\b(garanti(mos|a|do|zamos)|guarantee[ds]?|garantizad[oa]s?|100\s?%\s*(garant|guarant|seguro|sure)|aprovação garantida|guaranteed approval|aprobación garantizada|sem risco|risk[- ]free|sin riesgo|lucro certo|resultado garantido)\b/i, "promessa de resultado"],
  [/\b(você deve (investir|processar|declarar)|you should (invest|sue|file)|usted debe (invertir|demandar)|no seu caso,? (a lei|o juiz)|in your case,? (the law|you qualify)|en su caso,? (la ley|usted califica))\b/i, "aconselhamento individual"],
];
export function violacao(texto: string): string {
  const t = String(texto || "");
  for (const [re, motivo] of PROIBIDO) if (re.test(t)) return motivo;
  return "";
}

/** O texto de um post no formato do LinkedIn ("little text"): escapa os caracteres reservados e mantém as hashtags. */
export function textoLinkedIn(t: string): string {
  return String(t || "").replace(/\r/g, "").slice(0, 3000)
    .replace(/[\\|{}@\[\]()<>*_~]/g, (c) => "\\" + c)
    .replace(/#(?![\p{L}\p{N}])/gu, "\\#")
    .replace(/#([\p{L}\p{N}]+)/gu, (_m, tag) => `{hashtag|\\#|${tag}}`);
}

/** A resposta a um comentário só leva convite (WhatsApp ou agenda) quando há interesse, e só com os links cadastrados. */
export function limparResposta(texto: unknown, a: Ajustes, lead: boolean): string {
  let t = String(texto ?? "").replace(/[<>]/g, "").replace(/\s+\n/g, "\n").trim().slice(0, 1200);
  const permitidos = [a.whatsapp, a.agenda].filter(Boolean);
  t = t.replace(/https?:\/\/[^\s)]+/g, (u) => (lead && permitidos.some((p) => u.replace(/[.,;!?]+$/, "") === p || p.startsWith(u.replace(/[.,;!?]+$/, ""))) ? u : "")).replace(/[ \t]{2,}/g, " ").trim();
  return t;
}

/** Palavras-chave do agente: as da atividade + as cadastradas pela empresa. */
export const palavrasChave = (atividade: string[] | null | undefined, extras: string[]) => [...new Set([...(atividade || []), ...extras].map((p) => p.toLowerCase().trim()).filter(Boolean))].slice(0, 60);
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function oportunidade(texto: string, palavras: string[]): string[] {
  const t = " " + semAcento(String(texto || "")) + " ";
  return palavras.filter((p) => { const k = semAcento(p); return k.length >= 3 && t.includes(k); }).slice(0, 5);
}

/** Extensão: mensagens privadas nunca são automáticas; limite diário e intervalo mínimo valem no servidor. */
export function podeAutomatico(a: Ajustes, origem: string, enviadosHoje: number, ultimoEnvioMs: number | null, agoraMs: number) {
  if (a.ext.modo !== "auto") return { ok: false, motivo: "manual" };
  if (origem === "dm") return { ok: false, motivo: "dm" };
  if (enviadosHoje >= a.ext.limite_dia) return { ok: false, motivo: "limite" };
  if (ultimoEnvioMs && agoraMs - ultimoEnvioMs < a.ext.intervalo_min * 1000) return { ok: false, motivo: "intervalo" };
  return { ok: true, motivo: "" };
}

/** state do OAuth assinado (HMAC) com validade curta. */
export async function assinar(dados: Record<string, unknown>, segredo: string): Promise<string> {
  const corpo = btoa(JSON.stringify(dados)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return corpo + "." + await hmac(corpo, segredo);
}
export async function conferir(state: string, segredo: string, agoraMs: number): Promise<Record<string, unknown> | null> {
  const [corpo, sig] = String(state || "").split(".");
  if (!corpo || !sig || sig !== await hmac(corpo, segredo)) return null;
  try { const d = JSON.parse(atob(corpo.replace(/-/g, "+").replace(/_/g, "/"))); return typeof d.exp === "number" && d.exp > agoraMs ? d : null; } catch { return null; }
}
async function hmac(msg: string, segredo: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return Array.from(s, (b) => b.toString(16).padStart(2, "0")).join("");
}
