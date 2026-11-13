// site-chat: the AI sales and support assistant on the public website (endeavorbiz.com).
// - action "msg": one turn of the conversation (rate limited per chat, per visitor and per day)
// - action "lead": the visitor leaves name and e-mail for a proposal -> CRM lead (source "chat"), admin bell, e-mail to the team
// The answers come from Endeavor's central HUB AI ("Customer Service Agent"): the HUB holds the prompt, model,
// limits, conversation memory (session_id per visitor conversation) and usage. No direct calls to Anthropic here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import { hubExecute, hubOn } from "../_shared/hub-ai.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
type Lang = "pt" | "en" | "es";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SES_HOST = Deno.env.get("SES_SMTP_HOST") ?? "", SES_USER = Deno.env.get("SES_SMTP_USER") ?? "", SES_PASS = Deno.env.get("SES_SMTP_PASS") ?? "";
const G_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const G_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
const SUPPORT = "support@endeavorbiz.com";
const ORIGINS = ["https://endeavorbiz.com", "https://www.endeavorbiz.com", "https://bntouchnetwork.github.io"];
const LIMIT_CHAT = 40, LIMIT_IP_DAY = 120, LIMIT_ALL_DAY = 3000;
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

const cors = (req: Request) => {
  const o = req.headers.get("origin") || "";
  return { "Access-Control-Allow-Origin": ORIGINS.includes(o) || /^http:\/\/localhost(:\d+)?$/.test(o) ? o : ORIGINS[0], "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
};
const lang = (l: unknown): Lang => (l === "en" || l === "es" ? l : "pt");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
// sensitive numbers are removed before anything is stored or sent to the AI
const luhn = (d: string) => { let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; };
const scrub = (s: string) => s
  .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[removido]") // SSN / ITIN
  .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[removido]") // CPF
  .replace(/(?<![+\d])(?:\d[ -]?){12,18}\d\b/g, (m) => { const d = m.replace(/\D/g, ""); return d.length >= 13 && d.length <= 19 && luhn(d) ? "[removido]" : m; }); // card numbers
async function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "0";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|" + SB_SERVICE.slice(-16)));
  return Array.from(new Uint8Array(d)).slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Actions the website understands at the end of a reply: [[LEAD]] (proposal form), [[BOOK]] (schedule a call),
// [[PARTNER]] (partner sign-up), [[HUMAN]] (talk to the team). The HUB agent's prompt should use them.
// Without a token, a clear buying intent from the visitor still opens the proposal form once per conversation.
const INTENT = /\b(pre[cç]o|preco|valor|quanto custa|or[cç]amento|proposta|contratar|como (come[cç]o|comecar|fa[cç]o para abrir)|quero abrir|price|pricing|cost|how much|quote|proposal|get started|sign up|hire|precio|cu[aá]nto cuesta|cotizaci[oó]n|propuesta|contratar|empezar)\b/i;

let tr: ReturnType<typeof nodemailer.createTransport> | null = null;
const sesOn = () => !!(SES_HOST && SES_USER && SES_PASS);
const mailOn = () => sesOn() || G_PASS.length >= 8;
const transport = () => (tr ??= sesOn()
  ? nodemailer.createTransport({ host: SES_HOST, port: 465, secure: true, auth: { user: SES_USER, pass: SES_PASS } })
  : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: G_USER, pass: G_PASS } }));

const REVIEW_MSG: Record<Lang, string> = {
  pt: "Essa pergunta precisa da análise da nossa equipe. Deixe seu nome e e-mail abaixo que respondemos por lá, ou fale pelo WhatsApp +1 (630) 689-8702.",
  en: "This question needs a review by our team. Leave your name and email below and we will answer there, or message us on WhatsApp +1 (630) 689-8702.",
  es: "Esta pregunta necesita la revisión de nuestro equipo. Deje su nombre y correo abajo y le respondemos por allí, o escriba por WhatsApp +1 (630) 689-8702.",
};
const BUSY_MSG: Record<Lang, string> = {
  pt: "Estou recebendo muitas mensagens agora. Tente de novo em instantes ou fale com a equipe pelo WhatsApp +1 (630) 689-8702.",
  en: "I am getting a lot of messages right now. Please try again in a moment or message our team on WhatsApp +1 (630) 689-8702.",
  es: "Estoy recibiendo muchos mensajes ahora. Intente de nuevo en un momento o escriba al equipo por WhatsApp +1 (630) 689-8702.",
};
const FALLBACK: Record<Lang, string> = {
  pt: "Estou com uma instabilidade agora. Você pode falar com a nossa equipe pelo WhatsApp +1 (630) 689-8702 ou pelo e-mail support@endeavorbiz.com.",
  en: "I am having trouble right now. You can reach our team on WhatsApp +1 (630) 689-8702 or at support@endeavorbiz.com.",
  es: "Tengo un problema en este momento. Puede escribir a nuestro equipo por WhatsApp +1 (630) 689-8702 o a support@endeavorbiz.com.",
};
const LIMIT_MSG: Record<Lang, string> = {
  pt: "Chegamos ao limite de mensagens desta conversa. Para continuar, fale com a equipe pelo WhatsApp +1 (630) 689-8702 ou agende uma conversa em https://endeavorbiz.com/schedule.html.",
  en: "This conversation reached its message limit. To continue, message our team on WhatsApp +1 (630) 689-8702 or book a call at https://endeavorbiz.com/schedule.html.",
  es: "Esta conversación llegó al límite de mensajes. Para continuar, escriba al equipo por WhatsApp +1 (630) 689-8702 o agende en https://endeavorbiz.com/schedule.html.",
};

async function settings(): Promise<Row> { return (await db.from("crm_settings").select("site_chat_enabled").eq("id", 1).maybeSingle()).data ?? {}; }

async function turn(req: Request, b: Row) {
  const id = String(b.chat_id || ""), l = lang(b.lang);
  if (!UUID.test(id)) return { status: 400, body: { error: "bad_chat" } };
  const text = scrub(String(b.message || "").replace(/\s+/g, " ").trim()).slice(0, 1000);
  if (!text) return { status: 400, body: { error: "empty" } };
  const s = await settings(); if (s.site_chat_enabled === false) return { status: 503, body: { error: "off" } };
  const ih = await ipHash(req), dayAgo = new Date(Date.now() - 864e5).toISOString();
  let { data: chat } = await db.from("site_chats").select("*").eq("id", id).maybeSingle();
  if (chat && chat.ip_hash && chat.ip_hash !== ih && chat.messages > 0) { /* same chat from another network (mobile): allowed */ }
  if (!chat) {
    const { count: ipChats } = await db.from("site_chats").select("id", { count: "exact", head: true }).eq("ip_hash", ih).gte("created_at", dayAgo);
    if ((ipChats ?? 0) >= 15) return { status: 429, body: { reply: LIMIT_MSG[l], limited: true } };
    const ins = await db.from("site_chats").insert({ id, ip_hash: ih, language: l, page: String(b.page || "").slice(0, 200) }).select("*").single();
    chat = ins.data; if (!chat) return { status: 500, body: { error: "db" } };
  }
  if (chat.messages >= LIMIT_CHAT) return { status: 429, body: { reply: LIMIT_MSG[l], limited: true } };
  const [{ count: ipMsgs }, { count: allMsgs }] = await Promise.all([
    db.from("site_chat_messages").select("id, site_chats!inner(ip_hash)", { count: "exact", head: true }).eq("site_chats.ip_hash", ih).eq("role", "user").gte("created_at", dayAgo),
    db.from("site_chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", dayAgo),
  ]);
  if ((ipMsgs ?? 0) >= LIMIT_IP_DAY || (allMsgs ?? 0) >= LIMIT_ALL_DAY) return { status: 429, body: { reply: LIMIT_MSG[l], limited: true } };

  const um = await db.from("site_chat_messages").insert({ chat_id: id, role: "user", content: text }).select("id").single();

  let reply = FALLBACK[l], action: string | null = "human";
  if (hubOn()) {
    const r = await hubExecute({
      input: text,
      sessionId: `endeavor-site-${id}`,                      // HUB conversation memory for this visitor conversation
      userId: `site-visitor:${ih}`,                          // pseudonymous visitor id (hashed IP), for the HUB audit
      idempotencyKey: `endeavor-site-${id}-${um.data?.id ?? crypto.randomUUID()}`, // one key per message: safe retries
      task: "website_chat",
      metadata: { channel: "website_chat", language: l, page: String(b.page || "/").slice(0, 100), lead_already_requested: !!chat.lead_id },
      maxOutputTokens: 450, meter: { agent: "site-chat" },
    });
    if (r.kind === "ok" && r.output) { reply = r.output; action = null; }
    else if (r.kind === "review") { reply = REVIEW_MSG[l]; action = chat.lead_id ? "human" : "lead"; }
    else if (r.kind === "rate") { reply = BUSY_MSG[l]; action = null; }
    else if (r.kind === "blocked") { reply = FALLBACK[l]; action = "human"; }
    else { reply = FALLBACK[l]; action = "human"; console.error("site chat hub", r); } // limit (402), auth or provider errors
  }
  const tok = reply.match(/\[\[(LEAD|BOOK|PARTNER|HUMAN)\]\]/);
  if (tok) action = tok[1].toLowerCase();
  reply = reply.replace(/\s*\[\[(LEAD|BOOK|PARTNER|HUMAN)\]\]\s*/g, " ").trim().slice(0, 2000);
  if (!tok && action === null && !chat.lead_id && !chat.lead_offered && INTENT.test(text)) action = "lead";
  if (chat.lead_id && action === "lead") action = null;
  await db.from("site_chat_messages").insert({ chat_id: id, role: "assistant", content: reply });
  await db.from("site_chats").update({ messages: chat.messages + 1, updated_at: new Date().toISOString(), language: l, ...(action === "human" ? { handoff: true } : {}), ...(action === "lead" ? { lead_offered: true } : {}) }).eq("id", id);
  return { status: 200, body: { reply, action } };
}

async function lead(req: Request, b: Row) {
  const id = String(b.chat_id || ""), l = lang(b.lang);
  if (!UUID.test(id)) return { status: 400, body: { error: "bad_chat" } };
  if (b.website) return { status: 200, body: { ok: true } }; // honeypot
  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 200), email = String(b.email || "").trim().toLowerCase().slice(0, 254);
  const phone = String(b.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (name.length < 2) return { status: 400, body: { error: "invalid_name" } };
  if (!EMAIL.test(email)) return { status: 400, body: { error: "invalid_email" } };
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) return { status: 400, body: { error: "invalid_phone" } };
  const { data: chat } = await db.from("site_chats").select("*").eq("id", id).maybeSingle();
  if (!chat) return { status: 400, body: { error: "bad_chat" } };
  if (chat.lead_id) return { status: 200, body: { ok: true, already: true } };
  const { count: recent } = await db.from("leads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", new Date(Date.now() - 36e5).toISOString());
  if ((recent ?? 0) >= 3) return { status: 429, body: { error: "rate_limited" } };
  const { data: hist } = await db.from("site_chat_messages").select("role, content, created_at").eq("chat_id", id).order("created_at").limit(60);
  const transcript = (hist ?? []).filter((m) => m.role !== "system").map((m) => (m.role === "user" ? "Visitante: " : "Assistente: ") + m.content).join("\n");
  const interest = String(b.interest || "").slice(0, 100) || null;
  const msg = ("Pediu proposta pelo chat do site.\n\n" + transcript).slice(0, 4900);
  const ins = await db.from("leads").insert({ name, email, phone: phone || null, assistance: interest, message: msg, language: l, source: "chat", status: "new", kind: "lead", marketing_consent: false }).select("id").single();
  if (ins.error) { console.error(ins.error); return { status: 500, body: { error: "db" } }; }
  await db.from("site_chats").update({ lead_id: ins.data.id, updated_at: new Date().toISOString() }).eq("id", id);
  await db.from("site_chat_messages").insert({ chat_id: id, role: "system", content: `Contato deixado: ${name} <${email}>${phone ? " · " + phone : ""}` });
  await db.from("admin_events").insert({ kind: "lead_chat", title: ("Pedido de proposta pelo chat: " + name).slice(0, 300), body: ((interest ? interest + " · " : "") + email + (phone ? " · " + phone : "") + "\nÚltima mensagem: " + ((hist ?? []).filter((m) => m.role === "user").pop()?.content || "")).slice(0, 2000), link: "#/crm?id=" + ins.data.id });
  if (mailOn()) {
    try {
      const html = `<p><strong>${esc(name)}</strong> pediu uma proposta pelo chat do site.</p><p>E-mail: ${esc(email)}${phone ? "<br>WhatsApp: " + esc(phone) : ""}${interest ? "<br>Interesse: " + esc(interest) : ""}<br>Idioma: ${l}</p><p>Abra o lead no CRM para responder: https://endeavorbiz.com/admin.html#/crm?id=${ins.data.id}</p><hr><pre style="white-space:pre-wrap;font:13px/1.5 Arial,sans-serif">${esc(transcript.slice(0, 8000))}</pre>`;
      await transport().sendMail({ from: { name: "Endeavor Website", address: sesOn() ? SUPPORT : G_USER }, to: SUPPORT, replyTo: email, subject: `Pedido de proposta pelo chat: ${name}`, html, text: html.replace(/<[^>]+>/g, "") });
    } catch (e) { console.error("site chat mail", e); }
  }
  return { status: 200, body: { ok: true } };
}

Deno.serve(async (req) => {
  const H = cors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: { ...H, "Content-Type": "application/json" } });
  let out: { status: number; body: unknown };
  try {
    const b = await req.json().catch(() => ({}));
    out = b.action === "msg" ? await turn(req, b) : b.action === "lead" ? await lead(req, b) : { status: 400, body: { error: "action" } };
  } catch (e) { console.error(e); out = { status: 500, body: { error: "server" } }; }
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { ...H, "Content-Type": "application/json" } });
});
