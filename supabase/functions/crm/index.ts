// crm: Endeavor's CRM automations.
// - tick (pg_cron every 10 min, internal key):
//   1. partners get an e-mail (and WhatsApp, when on) at every step of the clients they referred,
//      when the client pays and when the commission is paid
//   2. leads that did not answer get up to 2 follow-ups (day 2 and day 7 by default) inviting them to book a call
//   3. partners who did not finish onboarding (create the password, choose how to receive, sign the agreement) get reminders
// - admin: status, run_now, ai_suggest (AI reads the lead and drafts the next step and a reply), send_email (reply from the CRM)
// - Admin agent (AI): watches each partner's onboarding, writes a personal e-mail (and WhatsApp) when they get stuck,
//   tells the admin when there is no progress, answers the partner in the portal chat and, when Meta is on, on WhatsApp.
// Every message is logged in crm_messages with a unique key, so nothing is sent twice.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
type Lang = "pt" | "en" | "es";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
const SES_HOST = Deno.env.get("SES_SMTP_HOST") ?? "", SES_USER = Deno.env.get("SES_SMTP_USER") ?? "", SES_PASS = Deno.env.get("SES_SMTP_PASS") ?? "";
const G_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const G_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "", WA_PHONE = Deno.env.get("WHATSAPP_PHONE_ID") ?? "", WA_VER = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const WA_TPL = Deno.env.get("WA_TPL_CRM") ?? "endeavor_status_update";
const WA_VERIFY = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "", WA_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";
const AI_MODEL = Deno.env.get("CRM_MODEL") || Deno.env.get("OA_MODEL") || "claude-sonnet-5-5";
const SUPPORT = "support@endeavorbiz.com", PHONE = "+1 (407) 436-9567", WA_NUM = "+1 (630) 689-8702";
const sesOn = () => !!(SES_HOST && SES_USER && SES_PASS);
const mailOn = () => sesOn() || G_PASS.length >= 8;
const waOn = () => !!(WA_TOKEN && WA_PHONE);
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const lang = (l: unknown): Lang => (l === "en" || l === "es" ? l : "pt");
const first = (n: unknown) => { const w = String(n ?? "").trim().split(/\s+/)[0] || ""; return w.length > 1 && !/[@\d]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""; };
const days = (iso: string) => (Date.now() - new Date(iso).getTime()) / 864e5;
const money = (cents: number, cur = "usd", l: Lang = "pt") => new Intl.NumberFormat(l === "pt" ? "pt-BR" : l === "es" ? "es" : "en-US", { style: "currency", currency: cur.toUpperCase() }).format((cents || 0) / 100);

/* ---------- mail ---------- */
let tr: ReturnType<typeof nodemailer.createTransport> | null = null;
const transport = () => (tr ??= sesOn()
  ? nodemailer.createTransport({ host: SES_HOST, port: 465, secure: true, auth: { user: SES_USER, pass: SES_PASS } })
  : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: G_USER, pass: G_PASS } }));
let FROM = SUPPORT;
async function loadFrom() { if (!sesOn()) { FROM = G_USER; return; } const { data } = await db.from("mkt_settings").select("from_email").eq("id", 1).maybeSingle(); FROM = data?.from_email || SUPPORT; }

const SIGN: Record<Lang, string> = { pt: "Equipe Endeavor Business Solutions", en: "The Endeavor Business Solutions team", es: "Equipo de Endeavor Business Solutions" };
function shell(l: Lang, o: { kicker: string; h1: string; pre: string; paras: string[]; cta?: string; url?: string; foot?: string; sign?: boolean }) {
  const navy = "#0b1f3a", gold = "#c9a24a";
  const btn = o.cta && o.url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="border-radius:10px;background:${navy}"><a href="${esc(o.url)}" style="display:inline-block;padding:14px 24px;font:700 15px Arial,sans-serif;color:#fff;text-decoration:none;border-radius:10px">${esc(o.cta)}</a></td></tr></table>` : "";
  return `<!doctype html><html lang="${l === "pt" ? "pt-BR" : l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.h1)}</title></head>
<body style="margin:0;padding:0;background:#eef1f6"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ee">
<tr><td style="padding:22px 30px;border-bottom:1px solid #eef0f4"><img src="${SITE}/logo-endeavor-3000px.png" alt="Endeavor Business Solutions" width="190" style="display:block;width:190px;height:auto;border:0"></td></tr>
<tr><td style="background:${navy};padding:30px 30px 26px"><div style="font:700 12px/1 Arial,sans-serif;letter-spacing:.14em;color:${gold};margin:0 0 12px">${esc(o.kicker)}</div><div style="font:700 24px/1.25 Georgia,serif;color:#fff">${esc(o.h1)}</div></td></tr>
<tr><td style="padding:26px 30px 8px;font:15px/1.65 Arial,sans-serif;color:#1f2937">${o.paras.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("")}${btn}</td></tr>
<tr><td style="padding:12px 30px 26px;font:15px/1.6 Arial,sans-serif;color:#1f2937">${o.sign === false ? "" : `<p style="margin:0;font-weight:700;color:${navy}">${SIGN[l]}</p>`}${o.foot ? `<p style="margin:12px 0 0;font:13px/1.55 Arial,sans-serif;color:#6b7280">${esc(o.foot)}</p>` : ""}</td></tr>
<tr><td style="padding:16px 30px;background:#f7f8fb;border-top:1px solid #eef0f4;font:12px/1.6 Arial,sans-serif;color:#6b7280">Endeavor Business Solutions · Orlando, FL · ${PHONE} · WhatsApp ${WA_NUM} · <a href="mailto:${SUPPORT}" style="color:#6b7280">${SUPPORT}</a> · <a href="${SITE}" style="color:#6b7280">endeavorbiz.com</a></td></tr>
</table></td></tr></table></body></html>`;
}
const textOf = (o: { h1: string; paras: string[]; cta?: string; url?: string; foot?: string; sign?: boolean }, l: Lang) =>
  [o.h1, "", ...o.paras.map((p) => p.replace(/<[^>]+>/g, "")), ...(o.cta && o.url ? ["", `${o.cta}: ${o.url}`] : []), ...(o.sign === false ? [] : ["", SIGN[l]]), ...(o.foot ? ["", o.foot] : []), "", `${PHONE} · WhatsApp ${WA_NUM} · ${SUPPORT}`].join("\n");

// claim → send → mark (the unique dedupe key makes every message go out once)
async function deliver(m: { dedupe: string; kind: string; name?: string; lead_id?: string; partner_id?: string; referral_id?: string; to: string; l: Lang; subject: string; mail: Parameters<typeof shell>[1]; phone?: string | null; waText?: string; by?: string }) {
  const out: Row = {};
  const ins = await db.from("crm_messages").insert({ dedupe: m.dedupe + ":email", kind: m.kind, channel: "email", lead_id: m.lead_id ?? null, partner_id: m.partner_id ?? null, referral_id: m.referral_id ?? null, to_addr: m.to, subject: m.subject, created_by: m.by ?? "system" }).select("id").single();
  if (!ins.error) {
    try {
      await transport().sendMail({ from: { name: "Endeavor Business Solutions", address: FROM }, to: m.to, replyTo: SUPPORT, subject: m.subject, html: shell(m.l, m.mail), text: textOf(m.mail, m.l) });
      await db.from("crm_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", ins.data.id); out.email = "sent";
    } catch (e) { await db.from("crm_messages").update({ status: "failed", error: String((e as Error).message).slice(0, 800) }).eq("id", ins.data.id); out.email = "failed"; }
  } else out.email = "dup";
  if (m.phone && m.waText && waOn() && S.whatsapp_enabled && /^\+[1-9]\d{6,14}$/.test(m.phone)) {
    const w = await db.from("crm_messages").insert({ dedupe: m.dedupe + ":wa", kind: m.kind, channel: "whatsapp", lead_id: m.lead_id ?? null, partner_id: m.partner_id ?? null, referral_id: m.referral_id ?? null, to_addr: m.phone, subject: m.subject, created_by: m.by ?? "system" }).select("id").single();
    if (!w.error) {
      try {
        const r = await fetch(`https://graph.facebook.com/${WA_VER}/${WA_PHONE}/messages`, { method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: m.phone.replace(/^\+/, ""), type: "template", template: { name: WA_TPL, language: { code: { pt: "pt_BR", en: "en_US", es: "es" }[m.l] },
            components: [{ type: "body", parameters: [{ type: "text", text: first(m.name) || "-" }, { type: "text", text: m.waText.slice(0, 900) }] }] } }) });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error?.message || `whatsapp_${r.status}`);
        await db.from("crm_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", w.data.id); out.whatsapp = "sent";
      } catch (e) { await db.from("crm_messages").update({ status: "failed", error: String((e as Error).message).slice(0, 800) }).eq("id", w.data.id); out.whatsapp = "failed"; }
    }
  }
  return out;
}

/* ---------- texts ---------- */
const ST: Record<Lang, Record<string, string>> = {
  pt: { contacted: "Em contato", proposal: "Proposta enviada", onboarding: "Virou cliente (cadastro)", in_process: "Em processamento", completed: "Concluída", lost: "Encerrada" },
  en: { contacted: "In contact", proposal: "Proposal sent", onboarding: "Became a client (onboarding)", in_process: "In process", completed: "Completed", lost: "Closed" },
  es: { contacted: "En contacto", proposal: "Propuesta enviada", onboarding: "Se volvió cliente (registro)", in_process: "En proceso", completed: "Completado", lost: "Cerrado" },
};
const STD: Record<Lang, Record<string, string>> = {
  pt: { contacted: "Nossa equipe já entrou em contato com o cliente.", proposal: "Enviamos a proposta para o cliente.", onboarding: "O cliente aceitou e começou o cadastro com a Endeavor.", in_process: "Os serviços do cliente estão em andamento.", completed: "Os serviços do cliente foram concluídos. Obrigado pela indicação!", lost: "Esta indicação foi encerrada. Se tiver alguma informação nova, fale com a gente." },
  en: { contacted: "Our team has contacted the client.", proposal: "We sent the proposal to the client.", onboarding: "The client accepted and started onboarding with Endeavor.", in_process: "The client's services are in progress.", completed: "The client's services are complete. Thank you for the referral!", lost: "This referral was closed. If you have new information, let us know." },
  es: { contacted: "Nuestro equipo ya contactó al cliente.", proposal: "Enviamos la propuesta al cliente.", onboarding: "El cliente aceptó y comenzó el registro con Endeavor.", in_process: "Los servicios del cliente están en curso.", completed: "Los servicios del cliente fueron concluidos. ¡Gracias por la recomendación!", lost: "Esta recomendación fue cerrada. Si tiene información nueva, escríbanos." },
};
const T: Record<Lang, Record<string, string>> = {
  pt: { hi: "Olá, {n}!", hiAnon: "Olá!", kRef: "SUA INDICAÇÃO", refSubj: "{c}: {s}", refH1: "{c}: {s}", refCta: "Ver no portal",
    paidSubj: "Pagamento confirmado: {c}", paidH1: "{c} pagou a fatura", paidP: "A fatura {i} de {c} foi paga. A sua comissão é de <strong>{a}</strong>.",
    paidAuto: "Ela vai automaticamente para a sua conta Stripe.", paidManual: "Vamos fazer o repasse e avisamos quando for enviado.", paidStripe: "Conecte a sua conta Stripe no portal para receber.",
    commSubj: "Comissão enviada: {a}", commH1: "Sua comissão foi enviada", commP: "Enviamos <strong>{a}</strong> referente à fatura {i} de {c}.", commStripe: "O valor está no seu saldo Stripe e vai para o seu banco no próximo saque automático.", commOther: "O valor deve chegar na sua conta nos próximos dias úteis.",
    kLead: "ENDEAVOR BUSINESS SOLUTIONS", f1Subj: "{n}, podemos conversar?", f1Subj0: "Podemos conversar?", f1H1: "Vamos conversar sobre o seu projeto?", f1P: "Recebemos o seu contato e queremos entender melhor o que você precisa. A forma mais rápida é uma conversa de 30 minutos, por vídeo, telefone ou WhatsApp, no horário que for melhor para você.",
    f1Pp: "Recebemos o seu interesse no Programa de Parceiros. Para combinar os detalhes e a sua comissão, o próximo passo é uma conversa de 30 minutos com a nossa equipe.", f2Subj: "Ainda podemos ajudar?", f2H1: "Ainda podemos ajudar?", f2P: "Passando para saber se ainda faz sentido conversarmos. Se preferir, é só responder este e-mail com a sua dúvida ou chamar no WhatsApp.",
    fCta: "Agendar uma conversa", fStop: "Se não quiser mais receber estes lembretes, responda com \"parar\".",
    kPartner: "PORTAL DO PARCEIRO", invSubj: "Seu acesso ao Portal do Parceiro está esperando", invH1: "Seu acesso está pronto", invP: "Você ainda não criou a sua senha do Portal do Parceiro. Use o link do e-mail de convite. Se ele expirou, responda este e-mail que enviamos um novo.", invCta: "Abrir o portal",
    obSubj: "Falta pouco para ativar a sua conta de parceiro", obH1: "Falta pouco para ativar a sua conta", obP: "Para começar a indicar e receber, ainda falta:", obCta: "Continuar o onboarding",
    m_payout: "Escolher como você recebe as comissões", m_stripe: "Terminar o cadastro no Stripe", m_contract: "Assinar o contrato de parceria", m_video: "Assistir ao vídeo de apresentação" },
  en: { hi: "Hi {n},", hiAnon: "Hello,", kRef: "YOUR REFERRAL", refSubj: "{c}: {s}", refH1: "{c}: {s}", refCta: "View in the portal",
    paidSubj: "Payment confirmed: {c}", paidH1: "{c} paid the invoice", paidP: "Invoice {i} from {c} was paid. Your commission is <strong>{a}</strong>.",
    paidAuto: "It goes automatically to your Stripe account.", paidManual: "We will send your payout and let you know when it is on the way.", paidStripe: "Connect your Stripe account in the portal to get paid.",
    commSubj: "Commission sent: {a}", commH1: "Your commission was sent", commP: "We sent <strong>{a}</strong> for invoice {i} from {c}.", commStripe: "It is in your Stripe balance and goes to your bank with the next automatic payout.", commOther: "It should reach your account in the next business days.",
    kLead: "ENDEAVOR BUSINESS SOLUTIONS", f1Subj: "{n}, can we talk?", f1Subj0: "Can we talk?", f1H1: "Shall we talk about your project?", f1P: "We received your message and want to understand what you need. The fastest way is a 30-minute call, by video, phone or WhatsApp, at the time that works best for you.",
    f1Pp: "We received your interest in the Partner Program. To agree on the details and your commission, the next step is a 30-minute call with our team.", f2Subj: "Can we still help?", f2H1: "Can we still help?", f2P: "Just checking whether it still makes sense to talk. You can also reply to this email with your question or message us on WhatsApp.",
    fCta: "Schedule a call", fStop: "If you do not want these reminders, reply \"stop\".",
    kPartner: "PARTNER PORTAL", invSubj: "Your Partner Portal access is waiting", invH1: "Your access is ready", invP: "You have not created your Partner Portal password yet. Use the link in the invitation email. If it expired, reply to this email and we will send a new one.", invCta: "Open the portal",
    obSubj: "Almost there: activate your partner account", obH1: "Almost there", obP: "To start referring and getting paid, you still need to:", obCta: "Continue onboarding",
    m_payout: "Choose how you receive your commissions", m_stripe: "Finish your Stripe setup", m_contract: "Sign the partner agreement", m_video: "Watch the welcome video" },
  es: { hi: "¡Hola, {n}!", hiAnon: "¡Hola!", kRef: "SU RECOMENDACIÓN", refSubj: "{c}: {s}", refH1: "{c}: {s}", refCta: "Ver en el portal",
    paidSubj: "Pago confirmado: {c}", paidH1: "{c} pagó la factura", paidP: "La factura {i} de {c} fue pagada. Su comisión es de <strong>{a}</strong>.",
    paidAuto: "Va automáticamente a su cuenta Stripe.", paidManual: "Haremos la transferencia y le avisaremos cuando salga.", paidStripe: "Conecte su cuenta Stripe en el portal para recibir.",
    commSubj: "Comisión enviada: {a}", commH1: "Su comisión fue enviada", commP: "Enviamos <strong>{a}</strong> de la factura {i} de {c}.", commStripe: "Está en su saldo Stripe y va a su banco con el próximo retiro automático.", commOther: "Debe llegar a su cuenta en los próximos días hábiles.",
    kLead: "ENDEAVOR BUSINESS SOLUTIONS", f1Subj: "{n}, ¿conversamos?", f1Subj0: "¿Conversamos?", f1H1: "¿Conversamos sobre su proyecto?", f1P: "Recibimos su mensaje y queremos entender lo que necesita. Lo más rápido es una conversación de 30 minutos, por video, teléfono o WhatsApp, en el horario que le quede mejor.",
    f1Pp: "Recibimos su interés en el Programa de Socios. Para acordar los detalles y su comisión, el siguiente paso es una conversación de 30 minutos con nuestro equipo.", f2Subj: "¿Todavía podemos ayudar?", f2H1: "¿Todavía podemos ayudar?", f2P: "Solo queríamos saber si todavía tiene sentido conversar. También puede responder este correo con su pregunta o escribirnos por WhatsApp.",
    fCta: "Agendar una conversación", fStop: "Si no desea recibir estos recordatorios, responda \"parar\".",
    kPartner: "PORTAL DE SOCIOS", invSubj: "Su acceso al Portal de Socios está esperando", invH1: "Su acceso está listo", invP: "Aún no creó su contraseña del Portal de Socios. Use el enlace del correo de invitación. Si venció, responda este correo y le enviamos uno nuevo.", invCta: "Abrir el portal",
    obSubj: "Falta poco para activar su cuenta de socio", obH1: "Falta poco para activar su cuenta", obP: "Para empezar a recomendar y recibir, todavía falta:", obCta: "Continuar el onboarding",
    m_payout: "Elegir cómo recibe sus comisiones", m_stripe: "Terminar el registro en Stripe", m_contract: "Firmar el contrato de socio", m_video: "Ver el video de bienvenida" },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w)\}/g, (_, k) => v[k] ?? "");
const hi = (l: Lang, name: unknown) => { const n = first(name); return esc(n ? fill(T[l].hi, { n }) : T[l].hiAnon); };
const portal = (l: Lang, h: string) => `${SITE}/partner.html?lang=${l}${h}`;

/* ---------- tick ---------- */
let S: Row = {};
async function tick() {
  S = (await db.from("crm_settings").select("*").eq("id", 1).single()).data ?? {} as Row;
  if (!mailOn()) return { waiting: "no_sender" };
  await loadFrom();
  const out: Row = { referral: 0, paid: 0, commission: 0, followup: 0, partner: 0 };
  // nothing older than 14 days, and nothing from before the automations were turned on
  const since = new Date(Math.max(Date.now() - 14 * 864e5, new Date(S.notify_since || 0).getTime())).toISOString();
  const start = S.notify_since || new Date().toISOString();

  if (S.partner_notify !== false) {
    // 1a. referral steps
    const { data: evs } = await db.from("referral_events").select("id, at, label, referral_id, referrals(id, name, status, partner_id, partners(id, name, email, phone, language, status))")
      .eq("kind", "status").gte("at", since).in("label", ["contacted", "proposal", "onboarding", "in_process", "completed", "lost"]).order("at").limit(200);
    for (const e of evs ?? []) {
      const r = e.referrals as Row | null, p = r?.partners as Row | null;
      if (!r || !p || p.status === "suspended") continue;
      const l = lang(p.language), v = { c: r.name, s: ST[l][e.label] };
      const res = await deliver({ dedupe: `ref:${e.id}`, kind: "referral_" + e.label, partner_id: p.id, referral_id: r.id, name: p.name, to: p.email, l, subject: fill(T[l].refSubj, v), phone: p.phone, waText: `${v.c}: ${v.s}`,
        mail: { kicker: T[l].kRef, h1: fill(T[l].refH1, v), pre: STD[l][e.label], paras: [hi(l, p.name), esc(STD[l][e.label])], cta: T[l].refCta, url: portal(l, `#/referrals?id=${r.id}`) } });
      if (res.email === "sent") out.referral++;
    }
    // 1b. client paid / 1c. commission paid
    const { data: invs } = await db.from("invoices").select("id, number, status, paid_at, payout_paid_at, transfer_status, partner_amount_cents, currency, updated_at, partner_id, referral_id, clients(name), partners(id, name, email, phone, language, status, stripe_transfers_active, payout_method)")
      .not("partner_id", "is", null).gt("partner_amount_cents", 0).gte("updated_at", since).limit(200);
    for (const i of invs ?? []) {
      const p = i.partners as Row | null; if (!p || p.status === "suspended") continue;
      const l = lang(p.language), c = (i.clients as Row | null)?.name || "", a = money(i.partner_amount_cents, i.currency, l), v = { c, a, i: i.number || "" };
      if (i.status === "paid") {
        const how = i.transfer_status === "scheduled" || i.transfer_status === "paid" ? T[l].paidAuto : p.payout_method === "global_payouts" ? T[l].paidManual : p.stripe_transfers_active ? T[l].paidManual : T[l].paidStripe;
        const res = await deliver({ dedupe: `paid:${i.id}`, kind: "invoice_paid", partner_id: p.id, referral_id: i.referral_id, name: p.name, to: p.email, l, subject: fill(T[l].paidSubj, v), phone: p.phone, waText: fill(T[l].paidP, v).replace(/<[^>]+>/g, ""),
          mail: { kicker: T[l].kRef, h1: fill(T[l].paidH1, v), pre: fill(T[l].paidP, v).replace(/<[^>]+>/g, ""), paras: [hi(l, p.name), fill(T[l].paidP, { c: esc(c), a: esc(a), i: esc(v.i) }), esc(how)], cta: T[l].refCta, url: portal(l, "#/commissions") } });
        if (res.email === "sent") out.paid++;
      }
      if (i.transfer_status === "paid") {
        const res = await deliver({ dedupe: `comm:${i.id}`, kind: "commission_paid", partner_id: p.id, referral_id: i.referral_id, name: p.name, to: p.email, l, subject: fill(T[l].commSubj, v), phone: p.phone, waText: fill(T[l].commP, v).replace(/<[^>]+>/g, ""),
          mail: { kicker: T[l].kRef, h1: T[l].commH1, pre: fill(T[l].commP, v).replace(/<[^>]+>/g, ""), paras: [hi(l, p.name), fill(T[l].commP, { c: esc(c), a: esc(a), i: esc(v.i) }), esc(p.payout_method === "global_payouts" ? T[l].commOther : T[l].commStripe)], cta: T[l].refCta, url: portal(l, "#/commissions") } });
        if (res.email === "sent") out.commission++;
      }
    }
  }

  // 2. lead follow-ups (only leads still "new", with no booking, not stopped)
  if (S.followup_enabled !== false) {
    const dd: number[] = (S.followup_days?.length ? S.followup_days : [2, 7]).slice(0, 2);
    const { data: leads } = await db.from("leads").select("id, name, email, phone, language, kind, status, created_at, last_contact_at, followup_stop")
      .eq("status", "new").eq("followup_stop", false).in("kind", ["lead", "partner"]).gte("created_at", new Date(Math.max(Date.now() - 30 * 864e5, new Date(start).getTime())).toISOString()).limit(300);
    const ids = (leads ?? []).map((x) => x.id);
    const booked = new Set(((await db.from("bookings").select("lead_id").in("lead_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])).data ?? []).map((b) => b.lead_id));
    for (const ld of leads ?? []) {
      if (booked.has(ld.id)) continue;
      const age = days(ld.last_contact_at || ld.created_at), l = lang(ld.language), n = first(ld.name), partner = ld.kind === "partner";
      const url = `${SITE}/schedule.html?lang=${l}${partner ? "&topic=partner" : ""}`;
      for (let k = dd.length - 1; k >= 0; k--) {
        if (age < dd[k]) continue;
        const step = k + 1;
        const subj = step === 1 ? (n ? fill(T[l].f1Subj, { n }) : T[l].f1Subj0) : T[l].f2Subj;
        const res = await deliver({ dedupe: `fu${step}:${ld.id}`, kind: "followup_" + step, lead_id: ld.id, name: ld.name, to: ld.email, l, subject: subj, phone: ld.phone, waText: step === 1 ? (partner ? T[l].f1Pp : T[l].f1P) : T[l].f2P,
          mail: { kicker: T[l].kLead, h1: step === 1 ? T[l].f1H1 : T[l].f2H1, pre: step === 1 ? T[l].f1P : T[l].f2P, paras: [hi(l, ld.name), esc(step === 1 ? (partner ? T[l].f1Pp : T[l].f1P) : T[l].f2P)], cta: T[l].fCta, url, foot: T[l].fStop } });
        if (res.email === "sent") out.followup++;
        break; // one step per run; the older step was either sent before or is skipped
      }
    }
  }

  // 3. partners: password reminders, automatic activation, and the Admin agent for stuck onboarding
  {
    const { data: ps } = await db.from("partners").select("*").neq("status", "suspended").is("onboarding_done_at", null).gte("invited_at", new Date(Math.max(Date.now() - 60 * 864e5, new Date(start).getTime())).toISOString()).limit(300);
    const vid = S.partner_video_url, stuck = Number(S.agent_stuck_days) || 2, escal = Number(S.agent_escalate_days) || 6;
    for (const p0 of ps ?? []) {
      let p = p0;
      const l = lang(p.language);
      if (p.status === "invited") {
        if (S.partner_reminders === false) continue;
        for (const d of [7, 3]) if (days(p.invited_at) >= d) {
          const res = await deliver({ dedupe: `pinv${d}:${p.id}`, kind: "partner_invite_reminder", partner_id: p.id, name: p.name, to: p.email, l, subject: T[l].invSubj, phone: p.phone, waText: T[l].invP,
            mail: { kicker: T[l].kPartner, h1: T[l].invH1, pre: T[l].invP, paras: [hi(l, p.name), esc(T[l].invP)], cta: T[l].invCta, url: portal(l, "") } });
          if (res.email === "sent") out.partner++; break;
        }
        continue;
      }
      if (p.status !== "active" || !p.accepted_at) continue;
      // Stripe may have finished in the background: try to activate first
      const act = await db.rpc("partner_try_activate", { p_partner: p.id });
      if (Array.isArray(act.data) && act.data[0]) p = act.data[0];
      if (p.onboarding_done_at) { out.activated = (out.activated || 0) + 1; continue; }
      const step = nextStep(p, vid);
      if (!step) continue;
      const idle = days(p.onboarding_step_at || p.accepted_at);
      if (S.agent_enabled === false) {
        if (S.partner_reminders === false) continue;
        for (const d of [7, 3]) if (days(p.accepted_at) >= d) {
          const res = await deliver({ dedupe: `pob${d}:${p.id}`, kind: "partner_onboarding_reminder", partner_id: p.id, name: p.name, to: p.email, l, subject: T[l].obSubj,
            mail: { kicker: T[l].kPartner, h1: T[l].obH1, pre: T[l].obP, paras: [hi(l, p.name), esc(T[l].obP), "• " + esc(T[l]["m_" + step])], cta: T[l].obCta, url: portal(l, "#/onboarding") } });
          if (res.email === "sent") out.partner++; break;
        }
        continue;
      }
      // agent: a personal nudge after N days without progress (at most 3, spaced by N days)
      if (idle >= stuck && (p.agent_nudges || 0) < 3 && (!p.agent_last_nudge_at || days(p.agent_last_nudge_at) >= stuck)) {
        const n = (p.agent_nudges || 0) + 1;
        const m = await agentNudge(p, step, n);
        const res = await deliver({ dedupe: `agent:${p.id}:${n}`, kind: "agent_nudge", partner_id: p.id, name: p.name, to: p.email, l, subject: m.subject, phone: p.phone, waText: m.short,
          mail: { kicker: T[l].kPartner, h1: m.subject, pre: m.short, paras: m.body.split(/\n\s*\n/).map((x) => esc(x.trim()).replace(/\n/g, "<br>")).filter(Boolean), cta: T[l].obCta, url: portal(l, "#/onboarding"), sign: false } });
        if (res.email === "sent" || res.email === "dup") {
          await db.from("partners").update({ agent_nudges: n, agent_last_nudge_at: new Date().toISOString() }).eq("id", p.id);
          await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel: "email", role: "assistant", content: (m.subject + "\n\n" + m.body).slice(0, 6000), meta: { step, nudge: n, ai: m.ai } });
          if (res.email === "sent") out.agent = (out.agent || 0) + 1;
        }
      }
      // escalate to the admin when there is still no progress
      if (idle >= escal && !p.agent_escalated_at) {
        await db.from("admin_events").insert({ kind: "partner_new", title: ("Parceiro parado no onboarding: " + p.name).slice(0, 300), body: ("Passo: " + STEP_PT[step] + ". Sem avanço há " + Math.floor(idle) + " dias, mesmo com " + (p.agent_nudges || 0) + " lembrete(s) do agente. Vale um contato pessoal" + (p.phone ? " (WhatsApp " + p.phone + ")" : "") + ".").slice(0, 2000), link: "#/agentes?partner=" + p.id });
        await db.from("partners").update({ agent_escalated_at: new Date().toISOString() }).eq("id", p.id);
        await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel: "system", role: "system", content: "Escalado para a equipe: sem avanço em " + STEP_PT[step] + "." });
        out.escalated = (out.escalated || 0) + 1;
      }
    }
  }
  return out;
}

/* ---------- Admin agent (AI): onboarding guide for partners ---------- */
const STEP_PT: Record<string, string> = { video: "assistir ao vídeo", contract: "assinar o contrato", payout: "configurar como recebe", stripe: "terminar o cadastro no Stripe" };
function nextStep(p: Row, video: string | null) {
  if (video && !p.video_seen_at) return "video";
  if (!["partner_signed", "signed"].includes(p.contract_status)) return "contract";
  if (!p.payout_method) return "payout";
  if (p.payout_method === "stripe" && !(p.stripe_details_submitted || p.stripe_transfers_active)) return "stripe";
  return null;
}
const KNOW = `Endeavor Business Solutions (Orlando, FL; https://endeavorbiz.com) helps foreign entrepreneurs open and keep companies in the U.S. (LLC/corporation formation, registered agent, compliance, tax coordination with CPAs, EIN/ITIN guidance, U.S. bank account support, real estate structure, family office) in Portuguese, English and Spanish.
Partner Program: realtors, accountants, attorneys and advisors refer clients and earn a commission on the invoices paid by those clients (standard 10%, the exact % is in the partner's agreement). No cost, no minimum.
Partner Portal (partner.html), menu: "Start here" (onboarding), Dashboard, My referrals (pipeline: Received, In contact, Proposal, Onboarding, In process, Completed), New referral (client name, email, phone, service; the client must agree to be contacted), Commissions, Stripe payouts.
Onboarding steps in "Start here", in order: 1) portal access (password + two-step verification, already done when they are in the portal); 2) watch the welcome video and click "I watched it"; 3) sign the partner agreement online (button in the step; the agreement is in English; Endeavor countersigns later); 4) choose the country of the bank account: U.S. (also Canada, UK, Europe) = Stripe Connect Express, they click "Connect Stripe account" and finish on Stripe's site (photo ID, bank details, SSN/ITIN/EIN when in the U.S.; Stripe collects the W-9/W-8); other countries such as Brazil = Stripe Global Payouts: Endeavor registers them as a recipient and Stripe emails them a link to add the bank, and Endeavor sends each commission after the client pays (payouts in BRL depend on Stripe enabling them); an optional Pix key (email, phone or random key, never CPF) is kept for a future Pix option. 5) When all steps are done the account is activated automatically, referrals are unlocked and a "Book your welcome call" button appears.
The partner gets an email (and WhatsApp when available) at every step of each referred client, when the client pays and when the commission is sent.
Contact: support@endeavorbiz.com, WhatsApp +1 (630) 689-8702, phone +1 (407) 436-9567.`;
const AGENT_RULES = `You are the Endeavor onboarding assistant (the "Admin agent") talking to a partner.
Rules: reply in the partner's language (pt = Brazilian Portuguese, en, es); be warm, clear and short (at most 120 words, plain text, no markdown headings); guide them to the next pending step with concrete clicks;
never ask for or accept SSN, ITIN, passport, CPF, card or bank numbers (if they send any, tell them not to share it here and that Stripe collects it securely); do not give legal or tax advice and do not change commissions or contract terms (a person from the team handles that);
never invent features, prices, deadlines or promises. If the partner asks for a person, wants to negotiate the commission or contract, reports a problem you cannot solve, or is upset, say the team will contact them and end your message with the exact token [[HANDOFF]].`;
async function claude(system: string, messages: { role: string; content: string }[], max = 700) {
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: max, system, messages }) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `ai_${r.status}`);
  return (j.content || []).filter((b: Row) => b.type === "text").map((b: Row) => b.text).join("").trim();
}
function partnerState(p: Row, video: string | null) {
  return { name: first(p.name), language: lang(p.language), country: p.country, commission_pct: p.contract_pct ?? p.default_share_pct ?? 10, account_active: !!p.onboarding_done_at,
    video_required: !!video, video_seen: !!p.video_seen_at, agreement: p.contract_status, payout_method: p.payout_method, payout_country: p.payout_country,
    stripe: { created: !!p.stripe_account_id, details_submitted: !!p.stripe_details_submitted, ready: !!p.stripe_transfers_active }, global_payouts: p.global_payouts_status, next_step: nextStep(p, video) };
}
async function agentNudge(p: Row, step: string, n: number) {
  const l = lang(p.language), fb = { subject: T[l].obSubj, body: [first(p.name) ? fill(T[l].hi, { n: first(p.name) }) : T[l].hiAnon, T[l].obP + " " + T[l]["m_" + step] + ".", SIGN[l]].join("\n\n"), short: T[l].obP + " " + T[l]["m_" + step], ai: false };
  if (!ANTHROPIC) return fb;
  try {
    const txt = await claude(AGENT_RULES + "\n\nWhat you know:\n" + KNOW + `\n\nWrite reminder e-mail number ${n} (of at most 3) to a partner who stopped at the onboarding step "${step}". Be specific about how to do that step. Reply with ONLY a JSON object {"subject": "...", "body": "plain text, 2-4 short paragraphs, signed with the Endeavor team signature in their language", "short": "one sentence for WhatsApp"}.`,
      [{ role: "user", content: "Partner record: " + JSON.stringify(partnerState(p, S.partner_video_url)) }], 900);
    const o = JSON.parse((txt.match(/\{[\s\S]*\}/) || ["{}"])[0]);
    const clean = (v: unknown, k: number) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, k) : "");
    if (clean(o.subject, 150) && clean(o.body, 3000)) return { subject: clean(o.subject, 150), body: clean(o.body, 3000), short: clean(o.short, 400) || fb.short, ai: true };
  } catch (e) { console.error("agent nudge", e); }
  return fb;
}
// one turn of the conversation (portal chat or WhatsApp); stores both messages, escalates on [[HANDOFF]]
async function agentReply(p: Row, channel: "portal" | "whatsapp", text: string) {
  const S0: Row = (await db.from("crm_settings").select("*").eq("id", 1).single()).data ?? {};
  await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel, role: "user", content: text.slice(0, 4000) });
  const { data: hist } = await db.from("agent_messages").select("role, content, channel").eq("partner_id", p.id).in("role", ["user", "assistant"]).in("channel", ["portal", "whatsapp", "email"]).order("created_at", { ascending: false }).limit(16);
  const msgs: { role: string; content: string }[] = [];
  for (const m of (hist ?? []).reverse()) { const role = m.role === "user" ? "user" : "assistant"; if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += "\n\n" + m.content; else msgs.push({ role, content: m.content }); }
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  let reply = "", handoff = false;
  if (!ANTHROPIC) { reply = { pt: "Obrigado pela mensagem! A nossa equipe vai responder em breve.", en: "Thanks for your message! Our team will reply soon.", es: "¡Gracias por su mensaje! Nuestro equipo responderá pronto." }[lang(p.language)]; handoff = true; }
  else {
    try {
      reply = await claude(AGENT_RULES + "\n\nWhat you know:\n" + KNOW + "\n\nThis partner right now: " + JSON.stringify(partnerState(p, S0.partner_video_url)) + `\nChannel: ${channel === "whatsapp" ? "WhatsApp (keep it very short)" : "chat inside the Partner Portal"}.`, msgs);
    } catch (e) { console.error("agent chat", e); reply = { pt: "Tive um problema agora. A equipe da Endeavor vai responder você em breve.", en: "I had a problem just now. The Endeavor team will reply to you soon.", es: "Tuve un problema ahora. El equipo de Endeavor le responderá pronto." }[lang(p.language)]; handoff = true; }
  }
  if (/\[\[HANDOFF\]\]/.test(reply)) { handoff = true; reply = reply.replace(/\s*\[\[HANDOFF\]\]\s*/g, "").trim(); }
  reply = reply.slice(0, 3000);
  await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel, role: "assistant", content: reply, meta: handoff ? { handoff: true } : {} });
  if (handoff) await db.from("admin_events").insert({ kind: "partner_new", title: ("Parceiro pediu ajuda da equipe: " + p.name).slice(0, 300), body: ("Pelo " + (channel === "whatsapp" ? "WhatsApp" : "chat do portal") + ": \"" + text.slice(0, 300) + "\"").slice(0, 2000), link: "#/agentes?partner=" + p.id });
  return { reply, handoff };
}
async function waText(to: string, body: string) {
  const r = await fetch(`https://graph.facebook.com/${WA_VER}/${WA_PHONE}/messages`, { method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: body.slice(0, 4000) } }) });
  if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error?.message || `whatsapp_${r.status}`); }
}
async function hmacOk(raw: string, sig: string | null) {
  if (!WA_SECRET || !sig?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WA_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)))).map((x) => x.toString(16).padStart(2, "0")).join("");
  const a = mac, b = sig.slice(7); if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
// incoming WhatsApp messages (Meta webhook): the agent answers partners; unknown numbers go to the admin bell
async function waWebhook(payload: Row) {
  const S0: Row = (await db.from("crm_settings").select("whatsapp_enabled, agent_enabled, agent_chat_enabled").eq("id", 1).single()).data ?? {};
  for (const e of payload.entry ?? []) for (const c of e.changes ?? []) for (const m of c.value?.messages ?? []) {
    const from = "+" + String(m.from || "").replace(/\D/g, ""), text = m.type === "text" ? String(m.text?.body || "").slice(0, 4000) : "";
    if (!/^\+\d{7,15}$/.test(from)) continue;
    const digits = from.slice(1);
    const { data: ps } = await db.from("partners").select("*").neq("status", "suspended").limit(500);
    const p = (ps ?? []).find((x) => String(x.phone || "").replace(/\D/g, "") === digits);
    if (!p) { await db.from("admin_events").insert({ kind: "partner_new", title: "WhatsApp de número não cadastrado: " + from, body: (text || "[" + m.type + "]").slice(0, 1000), link: "#/agentes" }); continue; }
    await db.from("partners").update({ whatsapp_last_inbound_at: new Date().toISOString() }).eq("id", p.id);
    if (!text) { await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel: "whatsapp", role: "user", content: "[" + m.type + "]" }); continue; }
    if (!S0.whatsapp_enabled || S0.agent_enabled === false || S0.agent_chat_enabled === false || !waOn()) { await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel: "whatsapp", role: "user", content: text }); continue; }
    const r = await agentReply(p, "whatsapp", text);
    try { await waText(from, r.reply); } catch (err) { console.error("wa reply", err); }
  }
}

/* ---------- AI assistant for one lead ---------- */
const AI_SYSTEM = `You are the CRM assistant of Endeavor Business Solutions (Orlando, FL; https://endeavorbiz.com).
Endeavor helps foreign entrepreneurs open and keep companies in the U.S. (LLC/corporation formation, registered agent, compliance, tax coordination with CPAs, EIN/ITIN guidance, U.S. bank account support, real estate structure, family office), in Portuguese, English and Spanish, and runs a Partner Program for realtors, accountants, attorneys and advisors who refer clients (commission, Partner Portal, payouts through Stripe).
You receive one CRM record with its history. Reply with ONLY a JSON object:
{"kind": "lead|prospect|partner", "status": "new|contacted|qualified|proposal|lost", "service": "short service name or empty", "summary": "1-2 sentences in Portuguese about who this is and what they want",
 "next_action": "one concrete next step for the Endeavor team, in Portuguese", "urgency": "high|normal|low",
 "reply_subject": "e-mail subject in the contact's language", "reply_body": "short e-mail reply in the contact's language (pt = Brazilian Portuguese), plain text, 3-6 short paragraphs, signed 'Equipe Endeavor Business Solutions' (or the EN/ES equivalent), inviting them to book a call at https://endeavorbiz.com/schedule.html when useful"}
Rules: be honest and warm; never promise results, prices, timelines or tax outcomes not in the record; never ask for SSN, ITIN, passport or bank numbers by e-mail; do not give legal or tax advice, offer a call instead.`;
async function aiSuggest(leadId: string) {
  if (!ANTHROPIC) return { error: "no_ai_key" };
  const { data: l } = await db.from("leads").select("*").eq("id", leadId).single();
  if (!l) return { error: "not_found" };
  const [bk, msgs, ref] = await Promise.all([
    db.from("bookings").select("starts_at, topic, status, notes").eq("lead_id", leadId).order("starts_at", { ascending: false }).limit(5),
    db.from("crm_messages").select("created_at, kind, subject, status").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10),
    db.from("referrals").select("service, status, message, partners(name)").eq("lead_id", leadId).limit(1),
  ]);
  const rec = { name: l.name, email_domain: String(l.email).split("@")[1], country: l.country, company: l.company, language: l.language, source: l.source, kind: l.kind, status: l.status,
    created_at: l.created_at, interest: l.assistance, message: String(l.message || "").slice(0, 3000), internal_notes: String(l.notes || "").slice(0, 2000),
    bookings: bk.data ?? [], messages_sent: msgs.data ?? [], referred_by: ref.data?.[0] ? { partner: (ref.data[0].partners as Row | null)?.name, service: ref.data[0].service, note: ref.data[0].message } : null };
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 2000, system: AI_SYSTEM, messages: [{ role: "user", content: `CRM record (today is ${new Date().toISOString().slice(0, 10)}):\n${JSON.stringify(rec)}` }] }) });
  const j = await r.json().catch(() => null);
  if (!r.ok) return { error: "ai_failed", detail: String(j?.error?.message || r.status).slice(0, 200) };
  const text = (j.content || []).filter((b: Row) => b.type === "text").map((b: Row) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/); if (!m) return { error: "ai_format" };
  try {
    const o = JSON.parse(m[0]), s = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, n) : "");
    return { ok: true, kind: ["lead", "prospect", "partner"].includes(o.kind) ? o.kind : l.kind, status: ["new", "contacted", "qualified", "proposal", "lost"].includes(o.status) ? o.status : l.status,
      service: s(o.service, 100), summary: s(o.summary, 600), next_action: s(o.next_action, 400), urgency: ["high", "normal", "low"].includes(o.urgency) ? o.urgency : "normal",
      reply_subject: s(o.reply_subject, 150), reply_body: s(o.reply_body, 4000) };
  } catch { return { error: "ai_format" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  // Meta webhook verification (WhatsApp)
  if (req.method === "GET" && url.searchParams.get("hub.mode") === "subscribe") {
    return WA_VERIFY && url.searchParams.get("hub.verify_token") === WA_VERIFY ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const raw = await req.text();
    let body: Row = {}; try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
    // Meta webhook: incoming WhatsApp messages (signed with the app secret)
    if (body.object === "whatsapp_business_account") {
      if (!(await hmacOk(raw, req.headers.get("x-hub-signature-256")))) return new Response("forbidden", { status: 403 });
      try { await waWebhook(body); } catch (e) { console.error("wa webhook", e); }
      return new Response("ok", { status: 200 });
    }
    // partner: chat with the Admin agent in the portal
    if (body.action === "agent_chat") {
      const user = createClient(SB_URL, SB_ANON || SB_SERVICE, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
      const { data: pid } = await user.rpc("my_partner_id");
      if (!pid) return json({ error: "forbidden" }, 403);
      const S0: Row = (await db.from("crm_settings").select("agent_enabled, agent_chat_enabled").eq("id", 1).single()).data ?? {};
      if (S0.agent_enabled === false || S0.agent_chat_enabled === false) return json({ error: "chat_off" }, 503);
      const text = String(body.message || "").trim().slice(0, 2000);
      if (text.length < 1) return json({ error: "empty" }, 400);
      const { count } = await db.from("agent_messages").select("id", { count: "exact", head: true }).eq("partner_id", String(pid)).eq("role", "user").gte("created_at", new Date(Date.now() - 864e5).toISOString());
      if ((count ?? 0) >= 40) return json({ error: "rate_limited" }, 429);
      const { data: p } = await db.from("partners").select("*").eq("id", String(pid)).single();
      if (!p) return json({ error: "forbidden" }, 403);
      return json({ ok: true, ...(await agentReply(p, "portal", text)) });
    }
    if (body.action) {
      const user = createClient(SB_URL, SB_ANON || SB_SERVICE, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
      const { data: isAdmin } = await user.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const email = (await user.auth.getUser()).data.user?.email ?? "admin";
      if (body.action === "status") return json({ email: mailOn(), via: sesOn() ? "ses" : mailOn() ? "gmail" : null, whatsapp: waOn(), whatsapp_webhook: !!(WA_VERIFY && WA_SECRET), ai: !!ANTHROPIC });
      if (body.action === "run_now") return json(await tick());
      if (body.action === "agent_human_reply") {
        // the team answers a partner from the Agents page (portal chat; WhatsApp too when the 24-hour window is open)
        const { data: p } = await db.from("partners").select("*").eq("id", String(body.partner_id || "")).single();
        if (!p) return json({ error: "not_found" }, 404);
        const text = String(body.message || "").trim().slice(0, 3000);
        if (text.length < 2) return json({ error: "empty" }, 400);
        await db.from("agent_messages").insert({ agent: "admin", partner_id: p.id, channel: "portal", role: "assistant", content: text, meta: { human: email } });
        let wa = "off";
        if (waOn() && p.phone && p.whatsapp_last_inbound_at && days(p.whatsapp_last_inbound_at) < 1) { try { await waText(p.phone, text); wa = "sent"; } catch (e) { wa = "failed"; console.error(e); } }
        return json({ ok: true, whatsapp: wa });
      }
      if (body.action === "ai_suggest") { const r = await aiSuggest(String(body.lead_id || "")); return json(r, (r as Row).error ? ((r as Row).error === "no_ai_key" ? 503 : 400) : 200); }
      if (body.action === "send_email") {
        const { data: l } = await db.from("leads").select("*").eq("id", String(body.lead_id || "")).single();
        if (!l) return json({ error: "not_found" }, 404);
        const subject = String(body.subject || "").trim().slice(0, 150), text = String(body.body || "").trim().slice(0, 6000);
        if (subject.length < 3 || text.length < 10) return json({ error: "empty" }, 400);
        if (!mailOn()) return json({ error: "no_sender" }, 503);
        await loadFrom(); S = (await db.from("crm_settings").select("*").eq("id", 1).single()).data ?? {} as Row;
        const lg = lang(l.language), paras = text.split(/\n\s*\n/).map((p) => esc(p.trim()).replace(/\n/g, "<br>")).filter(Boolean);
        const r = await deliver({ dedupe: `manual:${crypto.randomUUID()}`, kind: "manual", lead_id: l.id, to: l.email, l: lg, subject, by: email,
          mail: { kicker: "ENDEAVOR BUSINESS SOLUTIONS", h1: subject, pre: text.slice(0, 140), paras, sign: false } });
        if (r.email !== "sent") return json({ error: "send_failed" }, 502);
        await db.from("leads").update({ last_contact_at: new Date().toISOString(), ...(l.status === "new" ? { status: "contacted" } : {}) }).eq("id", l.id);
        return json({ ok: true });
      }
      return json({ error: "action" }, 400);
    }
    const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
    if (!ok) return json({ error: "forbidden" }, 403);
    if (body.event === "tick") return json(await tick());
    return json({ error: "event" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
