// Agente de documentos do CRM · regras puras (testáveis sem banco, sem Google e sem e-mail).
// deno-lint-ignore no-explicit-any
type Any = any;
export type Lang = "pt" | "en" | "es";

export const TIPOS_OK = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
export const MAX_BYTES = 25 * 1024 * 1024;
/** follow-up: dias depois do envio da lista (e de cada lembrete) */
export const CADENCIA = [2, 5, 9, 16, 23];

export function arquivoOk(tipo: string, tamanho: number, nome: string) {
  const ext = String(nome || "").toLowerCase().split(".").pop() || "";
  const porExt: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  const t = TIPOS_OK.includes(tipo) ? tipo : porExt[ext] || "";
  if (!t) return { ok: false, erro: "tipo" };
  if (!(tamanho > 0) || tamanho > MAX_BYTES) return { ok: false, erro: "tamanho" };
  return { ok: true, tipo: t };
}
/** nome seguro para arquivo/pasta no Drive */
export const nomeSeguro = (s: string, max = 120) => String(s || "").replace(/[\u0000-\u001f\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "sem nome";
export const nomePasta = (nome: string, modelo: string | null, data: Date) => nomeSeguro(`${nome} · ${modelo || "Documentos"} · ${data.toISOString().slice(0, 10)}`, 150);
export const nomeArquivo = (doc: string, original: string) => nomeSeguro(`[${doc}] ${original}`, 180);

/** documentos ainda sem nenhum arquivo enviado */
export function faltando(documentos: string[], recebidos: Any) {
  const r = recebidos && typeof recebidos === "object" ? recebidos : {};
  return (documentos || []).filter((d) => !(Array.isArray(r[d]) && r[d].length));
}
/** a partir dos nomes dos arquivos da Initial Docs ("[Passaporte] foto.pdf"), monta os recebidos (reconcilia envios não confirmados) */
export function recebidosDosArquivos(documentos: string[], arquivos: { id: string; name: string; createdTime?: string }[], atuais: Any) {
  const r: Any = {};
  for (const d of documentos) r[d] = Array.isArray(atuais?.[d]) ? [...atuais[d]] : [];
  for (const a of arquivos || []) {
    const m = /^\[([^\]]+)\]\s/.exec(a.name || "");
    if (!m || !(m[1] in r)) continue;
    if (!r[m[1]].some((x: Any) => x.id === a.id)) r[m[1]].push({ id: a.id, nome: String(a.name).slice(m[0].length, m[0].length + 120), em: a.createdTime || new Date().toISOString() });
  }
  for (const d of documentos) if (!r[d].length) delete r[d];
  return r;
}
/** é hora do próximo lembrete? */
export function followupDevido(p: { enviado_at?: string | null; ultimo_followup_at?: string | null; followups?: number }, agora = Date.now()) {
  if (!p.enviado_at) return false;
  const n = p.followups || 0;
  if (n >= CADENCIA.length) return false;
  return agora - Date.parse(p.enviado_at) >= CADENCIA[n] * 86400_000;
}
export const lang = (l: unknown): Lang => (l === "en" || l === "es" ? l : "pt");
export const primeiro = (n: unknown) => { const w = String(n ?? "").trim().split(/\s+/)[0] || ""; return w.length > 1 && !/[@\d]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""; };

/** textos dos e-mails (lista inicial, lembrete do que falta, reenvio) */
export function textos(tipo: "lista" | "lembrete" | "reenvio", l: Lang, a: { nome: string; empresa: string; modelo: string | null; faltam: string[]; todos: string[]; url: string }) {
  const n = primeiro(a.nome);
  const oi = { pt: n ? `Olá, ${n}!` : "Olá!", en: n ? `Hi ${n},` : "Hi,", es: n ? `¡Hola, ${n}!` : "¡Hola!" }[l];
  const caso = a.modelo ? { pt: ` para ${a.modelo}`, en: ` for ${a.modelo}`, es: ` para ${a.modelo}` }[l] : "";
  const comp = { pt: "Por segurança e compliance, não recebemos documentos pelo WhatsApp nem por e-mail. Use somente o link abaixo: os arquivos vão direto para a pasta segura do seu atendimento.",
    en: "For security and compliance, we don't accept documents over WhatsApp or e-mail. Please use only the link below: files go straight to the secure folder for your case.",
    es: "Por seguridad y cumplimiento, no recibimos documentos por WhatsApp ni por correo. Use solo el enlace de abajo: los archivos van directo a la carpeta segura de su caso." }[l];
  const lista = a.todos.map((d) => ({ texto: d, ok: !a.faltam.includes(d) }));
  if (tipo === "lembrete") return {
    subject: { pt: `Faltam ${a.faltam.length} documento(s)${caso}`, en: `${a.faltam.length} document(s) still missing${caso}`, es: `Faltan ${a.faltam.length} documento(s)${caso}` }[l],
    corpo: { kicker: { pt: "DOCUMENTOS PENDENTES", en: "MISSING DOCUMENTS", es: "DOCUMENTOS PENDIENTES" }[l], h1: { pt: "Ainda faltam alguns documentos", en: "A few documents are still missing", es: "Aún faltan algunos documentos" }[l],
      pre: { pt: `Faltam: ${a.faltam.join(", ")}`, en: `Missing: ${a.faltam.join(", ")}`, es: `Faltan: ${a.faltam.join(", ")}` }[l],
      paras: [oi, { pt: "Recebemos parte dos documentos, obrigado! Os itens marcados com • ainda estão pendentes:", en: "We received part of your documents, thank you! The items marked with • are still pending:", es: "Recibimos parte de los documentos, ¡gracias! Los ítems marcados con • siguen pendientes:" }[l]],
      lista, cta: { pt: "Enviar os documentos que faltam", en: "Upload the missing documents", es: "Enviar los documentos que faltan" }[l], url: a.url, foot: comp } };
  return {
    subject: { pt: `Lista de documentos${caso} — ${a.empresa}`, en: `Document checklist${caso} — ${a.empresa}`, es: `Lista de documentos${caso} — ${a.empresa}` }[l],
    corpo: { kicker: { pt: "LISTA DE DOCUMENTOS", en: "DOCUMENT CHECKLIST", es: "LISTA DE DOCUMENTOS" }[l],
      h1: tipo === "reenvio" ? { pt: "Aqui está de novo a sua lista de documentos", en: "Here is your document checklist again", es: "Aquí está de nuevo su lista de documentos" }[l] : { pt: "Sua lista de documentos", en: "Your document checklist", es: "Su lista de documentos" }[l],
      pre: { pt: "A lista e o link seguro para enviar os arquivos.", en: "Your checklist and the secure upload link.", es: "La lista y el enlace seguro para enviar los archivos." }[l],
      paras: [oi, { pt: `Como combinamos no WhatsApp, estes são os documentos${caso}:`, en: `As we discussed on WhatsApp, these are the documents${caso}:`, es: `Como hablamos por WhatsApp, estos son los documentos${caso}:` }[l]],
      lista, cta: { pt: "Enviar documentos com segurança", en: "Upload documents securely", es: "Enviar documentos con seguridad" }[l], url: a.url, foot: comp } };
}
