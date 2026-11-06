// marketing: Endeavor's own e-mail campaign sender.
// - every minute (pg_cron, internal key): sends due campaigns in small batches through Amazon SES (SMTP)
// - public: open pixel (?o=token), click redirect (?c=token&l=n), unsubscribe (POST from unsubscribe.html, or one-click ?u=token)
// - admin: status and test e-mail
// The template is shared with the admin preview (mkt-template.js), pinned to a commit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import "https://cdn.jsdelivr.net/gh/Bntouchnetwork/endeavor-website@a9f4dc3ee66974f69231fd266fc126edf139ad65/mkt-template.js";

// deno-lint-ignore no-explicit-any
const EMkt = (globalThis as any).EMkt;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
const FN = `${SB_URL}/functions/v1/marketing`;
// Amazon SES (SMTP credentials created in the SES console)
const SES_HOST = Deno.env.get("SES_SMTP_HOST") ?? "";
const SES_USER = Deno.env.get("SES_SMTP_USER") ?? "";
const SES_PASS = Deno.env.get("SES_SMTP_PASS") ?? "";
// support Gmail: only for test e-mails while SES is not connected
const G_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const G_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
// AI template writer (same key as the Operating Agreement module)
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";
const AI_MODEL = Deno.env.get("MKT_MODEL") || Deno.env.get("OA_MODEL") || "claude-sonnet-5-5";
const sesOn = () => !!(SES_HOST && SES_USER && SES_PASS);
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let ses: ReturnType<typeof nodemailer.createTransport> | null = null;
const sesT = () => (ses ??= nodemailer.createTransport({ host: SES_HOST, port: 465, secure: true, auth: { user: SES_USER, pass: SES_PASS }, pool: true, maxConnections: 2 }));

function renderFor(c: Row, ct: Row, s: Row, token: string | null) {
  return EMkt.render(c, ct, {
    site: SITE, address: s.postal_address, replyTo: s.reply_to,
    unsubUrl: token ? `${SITE}/unsubscribe.html?t=${token}` : `${SITE}/unsubscribe.html`,
    pixel: token ? `${FN}?o=${token}` : null,
    track: token ? (i: number) => `${FN}?c=${token}&l=${i}` : null,
  });
}
async function sendByToken(token: string) {
  const { data } = await db.from("mkt_sends").select("*, mkt_campaigns(*), mkt_contacts(*)").eq("token", token).maybeSingle();
  return data as Row | null;
}
async function unsubscribe(sd: Row, ua: string) {
  const now = new Date().toISOString();
  if (!sd.unsubscribed_at) {
    await db.from("mkt_sends").update({ unsubscribed_at: now }).eq("id", sd.id);
    await db.from("mkt_events").insert({ send_id: sd.id, kind: "unsubscribe", ua: ua.slice(0, 300) });
  }
  if (sd.contact_id) await db.from("mkt_contacts").update({ status: "unsubscribed", unsubscribed_at: now }).eq("id", sd.contact_id).eq("status", "subscribed");
}

async function tick() {
  const { data: s } = await db.from("mkt_settings").select("*").eq("id", 1).single();
  if (!s) return { error: "settings" };
  if (s.ses_connected !== sesOn()) await db.from("mkt_settings").update({ ses_connected: sesOn() }).eq("id", 1);
  if (!sesOn()) return { waiting: "ses_not_configured" };
  const now = new Date().toISOString();
  const { data: due } = await db.from("mkt_campaigns").select("*").in("status", ["scheduled", "sending"]).lte("scheduled_at", now).order("scheduled_at");
  if (!due?.length) return { idle: true };
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const { count: today } = await db.from("mkt_sends").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", day.toISOString());
  let budget = Math.min(s.per_minute, Math.max(0, s.daily_limit - (today ?? 0)));
  const out: Row = {};
  for (const c of due) {
    if (c.status === "scheduled") {
      await db.rpc("mkt_materialize", { p_campaign: c.id });
      await db.from("mkt_campaigns").update({ status: "sending", started_at: now, last_error: null }).eq("id", c.id);
    }
    if (budget <= 0) break;
    const { data: batch } = await db.from("mkt_sends").select("*, mkt_contacts(*)").eq("campaign_id", c.id).eq("status", "queued").order("id").limit(budget);
    let sent = 0, failed = 0;
    for (const sd of batch ?? []) {
      // claim the row so two runs never send the same e-mail
      const { data: claimed } = await db.from("mkt_sends").update({ status: "sending" }).eq("id", sd.id).eq("status", "queued").select("id");
      if (!claimed?.length) continue;
      const ct = sd.mkt_contacts ?? { email: sd.email, name: sd.name, language: sd.language };
      if (ct.status && ct.status !== "subscribed") { await db.from("mkt_sends").update({ status: "skipped", error: "contact_" + ct.status }).eq("id", sd.id); continue; }
      try {
        const r = renderFor(c, ct, s, sd.token);
        await sesT().sendMail({
          from: { name: s.from_name, address: s.from_email }, to: sd.email, replyTo: s.reply_to, subject: r.subject, html: r.html, text: r.text,
          headers: { "List-Unsubscribe": `<${FN}?u=${sd.token}>, <mailto:${s.reply_to}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        await db.from("mkt_sends").update({ status: "sent", sent_at: new Date().toISOString(), language: r.language, error: null }).eq("id", sd.id);
        sent++; budget--;
      } catch (e) {
        await db.from("mkt_sends").update({ status: "failed", error: String((e as Error).message).slice(0, 1000) }).eq("id", sd.id);
        failed++; budget--;
      }
      if (budget <= 0) break;
    }
    const { count: left } = await db.from("mkt_sends").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).in("status", ["queued", "sending"]);
    if (!left) await db.from("mkt_campaigns").update({ status: "sent", finished_at: new Date().toISOString() }).eq("id", c.id).eq("status", "sending");
    out[c.id] = { sent, failed, left: left ?? 0 };
  }
  return out;
}

/* ---------- AI template writer ---------- */
const AI_SYSTEM = `You write marketing e-mail templates for Endeavor Business Solutions LLC (Orlando, FL; https://endeavorbiz.com).
About Endeavor: helps foreign entrepreneurs and investors open and maintain companies in the United States: LLC and corporation formation, registered agent and compliance, tax coordination with CPAs (ITIN/EIN guidance), U.S. bank account support, real estate and property management support, family office. Serves clients in Portuguese, English and Spanish. Has a Partner Program for realtors, accountants, attorneys and other professionals who refer clients (they earn a commission, follow referrals in their own Partner Portal and get paid automatically through Stripe).
Contact (added automatically by the layout, do not repeat in the text): WhatsApp +1 (630) 689-8702, phone +1 (407) 436-9567, support@endeavorbiz.com. Booking page: https://endeavorbiz.com/schedule.html.
The layout (logo, colours, footer with address and unsubscribe link) is added by the system. You only write the content and choose the design options.
Rules:
- Honest, professional, warm. No exaggerated or false promises, no guaranteed results, no invented numbers, prices, percentages, testimonials or deadlines unless the brief gives them. Never state a commission percentage.
- Subject lines must be truthful and not misleading (CAN-SPAM). No ALL CAPS, no spam words, at most one emoji and only if the brief asks.
- Never ask the reader for SSN, ITIN, passport or bank numbers.
- Use {{nome}} where the contact's first name should go (only in subject or heading if natural) and {{empresa}} for their company, only if useful.
- Write natively in each requested language (pt = Brazilian Portuguese, en = American English, es = neutral Latin American Spanish), not word-for-word translations.
- Keep it scannable: intro 1 to 3 short paragraphs, 1 to 4 sections, each item 1 to 2 sentences.
Reply with ONLY a JSON object, no markdown, in this shape:
{"name": "short internal name in Portuguese",
 "style": {"accent": "gold|teal|sky|emerald|coral", "hero": "navy|light"},
 "button_url": "https://... (only if the brief gives a specific link; otherwise omit)",
 "<lang>": {"kicker": "2-4 word label", "subject": "...", "preheader": "...", "heading": "...", "intro": "paragraphs separated by a blank line",
   "sections": [{"type": "cards|steps|list|highlight|text", "title": "...", "items": [{"title": "...", "text": "..."}], "text": "for highlight/text only"}],
   "cta": "button label (2-5 words)", "closing": "1-2 short sentences", "sign": "signature line"}}
with one "<lang>" object for each requested language. "cards" works best with 2 or 4 items, "steps" with 2 to 4.`;

const LANGS3 = ["pt", "en", "es"];
const SEC_TYPES = ["cards", "steps", "list", "highlight", "text"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, max) : "");
function cleanTemplate(raw: Row, langs: string[]) {
  const out: Row = { languages: [] as string[], style: { accent: ["gold", "teal", "sky", "emerald", "coral"].includes(raw?.style?.accent) ? raw.style.accent : "gold", hero: raw?.style?.hero === "light" ? "light" : "navy" } };
  const bu = str(raw?.button_url, 500); if (/^https:\/\/[^\s"<>]+$/.test(bu)) out.button_url = bu;
  for (const l of langs) {
    const d = raw?.[l]; if (!d || typeof d !== "object") continue;
    out[l] = {
      kicker: str(d.kicker, 40), subject: str(d.subject, 150), preheader: str(d.preheader, 180), heading: str(d.heading, 160), intro: str(d.intro, 2000),
      sections: (Array.isArray(d.sections) ? d.sections : []).slice(0, 5).map((x: Row) => ({
        type: SEC_TYPES.includes(x?.type) ? x.type : "text", title: str(x?.title, 120), text: str(x?.text, 1200),
        items: (Array.isArray(x?.items) ? x.items : []).slice(0, 6).map((it: Row) => ({ title: str(it?.title, 100), text: str(it?.text, 400) })).filter((it: Row) => it.title || it.text),
      })),
      cta: str(d.cta, 60), closing: str(d.closing, 600), sign: str(d.sign, 100),
    };
    if (out[l].subject && out[l].heading) out.languages.push(l);
  }
  return { name: str(raw?.name, 100), data: out };
}
async function aiTemplate(body: Row) {
  if (!ANTHROPIC) return { error: "no_ai_key" };
  const brief = str(body.brief, 4000), adjust = str(body.adjust, 2000);
  const langs = (Array.isArray(body.languages) ? body.languages : LANGS3).filter((l: string) => LANGS3.includes(l));
  if (brief.length < 10 || !langs.length) return { error: "brief" };
  let user = `Brief from the Endeavor team (may be in Portuguese):\n${brief}\n\nLanguages to write: ${langs.join(", ")}.`;
  if (adjust && body.previous) user += `\n\nThis is the current version:\n${JSON.stringify(body.previous).slice(0, 20000)}\n\nApply these changes and return the full JSON again:\n${adjust}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 6000, system: AI_SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) return { error: "ai_failed", detail: String(j?.error?.message || r.status).slice(0, 200) };
  const text = (j.content || []).filter((b: Row) => b.type === "text").map((b: Row) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/); if (!m) return { error: "ai_format" };
  let raw: Row; try { raw = JSON.parse(m[0]); } catch { return { error: "ai_format" }; }
  const t = cleanTemplate(raw, langs);
  if (!t.data.languages.length) return { error: "ai_format" };
  return { ok: true, name: t.name, data: t.data, model: j.model || AI_MODEL };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url), ua = req.headers.get("user-agent") ?? "";
  try {
    // open pixel
    const o = url.searchParams.get("o");
    if (o && UUID.test(o)) {
      const sd = await sendByToken(o);
      if (sd) {
        await db.from("mkt_sends").update({ open_count: (sd.open_count ?? 0) + 1, opened_at: sd.opened_at ?? new Date().toISOString() }).eq("id", sd.id);
        if (!sd.opened_at) await db.from("mkt_events").insert({ send_id: sd.id, kind: "open", ua: ua.slice(0, 300) });
      }
      return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
    }
    // click: the link is taken from the rendered campaign by position (no open redirect)
    const c = url.searchParams.get("c");
    if (c && UUID.test(c)) {
      const sd = await sendByToken(c);
      let target = SITE;
      if (sd?.mkt_campaigns) {
        const { data: s } = await db.from("mkt_settings").select("*").eq("id", 1).single();
        const r = renderFor(sd.mkt_campaigns, sd.mkt_contacts ?? { email: sd.email, name: sd.name, language: sd.language }, s ?? {}, sd.token);
        const i = Number(url.searchParams.get("l"));
        if (Number.isInteger(i) && r.urls[i]) target = r.urls[i];
        const now = new Date().toISOString();
        await db.from("mkt_sends").update({ click_count: (sd.click_count ?? 0) + 1, clicked_at: sd.clicked_at ?? now, opened_at: sd.opened_at ?? now }).eq("id", sd.id);
        await db.from("mkt_events").insert({ send_id: sd.id, kind: "click", url: target.slice(0, 1000), ua: ua.slice(0, 300) });
      }
      return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
    }
    // one-click unsubscribe from the mail app (RFC 8058)
    const u = url.searchParams.get("u");
    if (u && UUID.test(u)) {
      if (req.method !== "POST") return new Response(null, { status: 302, headers: { Location: `${SITE}/unsubscribe.html?t=${u}` } });
      const sd = await sendByToken(u);
      if (sd) await unsubscribe(sd, ua);
      return json({ ok: true });
    }
    if (req.method !== "POST") return json({ error: "method" }, 405);
    const body = await req.json().catch(() => ({}));

    // unsubscribe page (unsubscribe.html)
    if (body.action === "unsub_info" || body.action === "unsub") {
      if (!UUID.test(String(body.token || ""))) return json({ error: "not_found" }, 404);
      const sd = await sendByToken(String(body.token));
      if (!sd) return json({ error: "not_found" }, 404);
      if (body.action === "unsub") await unsubscribe(sd, ua);
      const e = String(sd.email), at = e.indexOf("@");
      const masked = at > 2 ? e.slice(0, 2) + "•••" + e.slice(at) : "•••" + e.slice(at);
      const status = body.action === "unsub" ? "unsubscribed" : (sd.mkt_contacts?.status ?? (sd.unsubscribed_at ? "unsubscribed" : "subscribed"));
      return json({ ok: true, email: masked, status, language: sd.language ?? "pt" });
    }
    if (body.action === "resub") {
      if (!UUID.test(String(body.token || ""))) return json({ error: "not_found" }, 404);
      const sd = await sendByToken(String(body.token));
      if (!sd?.contact_id) return json({ error: "not_found" }, 404);
      await db.from("mkt_contacts").update({ status: "subscribed", unsubscribed_at: null }).eq("id", sd.contact_id).eq("status", "unsubscribed");
      return json({ ok: true, status: "subscribed" });
    }

    // admin
    if (body.action === "status" || body.action === "test" || body.action === "ai_template") {
      const user = createClient(SB_URL, SB_ANON || SB_SERVICE, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
      const { data: isAdmin } = await user.rpc("is_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const { data: s } = await db.from("mkt_settings").select("*").eq("id", 1).single();
      if (s && s.ses_connected !== sesOn()) await db.from("mkt_settings").update({ ses_connected: sesOn() }).eq("id", 1);
      if (body.action === "status") return json({ ses: sesOn(), gmail_test: G_PASS.length >= 8, ai: !!ANTHROPIC });
      if (body.action === "ai_template") { const r = await aiTemplate(body); return json(r, r.error ? (r.error === "no_ai_key" ? 503 : 400) : 200); }
      const { data: c } = await db.from("mkt_campaigns").select("*").eq("id", String(body.campaign_id || "")).single();
      if (!c) return json({ error: "not_found" }, 404);
      const to = String(body.to || s.reply_to).trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "invalid_email" }, 400);
      const sample = { email: to, name: String(body.name || "Maria"), company: "Exemplo Realty", language: body.language || "pt" };
      const r = renderFor(c, sample, s, null);
      const viaSes = sesOn();
      if (!viaSes && G_PASS.length < 8) return json({ error: "no_sender" }, 503);
      const tr = viaSes ? sesT() : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: G_USER, pass: G_PASS } });
      await tr.sendMail({ from: viaSes ? { name: s.from_name, address: s.from_email } : { name: s.from_name, address: G_USER }, to, replyTo: s.reply_to, subject: "[TESTE] " + r.subject, html: r.html, text: r.text });
      return json({ ok: true, to, via: viaSes ? "ses" : "gmail" });
    }

    // every minute from pg_cron
    const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
    if (!ok) return json({ error: "forbidden" }, 403);
    if (body.event === "tick") return json(await tick());
    return json({ error: "event" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
