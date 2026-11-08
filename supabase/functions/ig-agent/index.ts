// ig-agent: Endeavor's Marketing agent for Instagram.
// - admin "plan": the agent researches what is trending (web search) and plans the next posts and stories: topic, hook,
//   art (template + slides), caption and hashtags, with date and time. Everything waits for approval in the admin.
// - admin "redo": rewrites one post with the admin's feedback.
// - admin "publish_now" / cron "tick": publishes approved posts at their time (Instagram Graph API).
// - Meta webhook: comments and DMs; the agent replies by itself (same rules as the website chat, never prices);
//   a DM with an e-mail address after asking for a proposal becomes a CRM lead.
// - Video (Reels / video Stories) is prepared for Creatomate + ElevenLabs and HeyGen and stays off until their keys exist.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("IG_MODEL") || "claude-sonnet-5-5";
const REPLY_MODEL = Deno.env.get("IG_REPLY_MODEL") || "claude-haiku-5-5";
const IG_TOKEN = Deno.env.get("IG_ACCESS_TOKEN") ?? "", IG_USER = Deno.env.get("IG_USER_ID") ?? "";
const IG_HOST = (Deno.env.get("IG_GRAPH_HOST") || "https://graph.facebook.com").replace(/\/$/, ""), IG_VER = Deno.env.get("IG_API_VERSION") || "v21.0";
const IG_VERIFY = Deno.env.get("IG_VERIFY_TOKEN") ?? "", IG_SECRET = Deno.env.get("IG_APP_SECRET") || Deno.env.get("WHATSAPP_APP_SECRET") || "";
const VIDEO_KEYS = { creatomate: !!Deno.env.get("CREATOMATE_API_KEY"), elevenlabs: !!Deno.env.get("ELEVENLABS_API_KEY"), heygen: !!Deno.env.get("HEYGEN_API_KEY") };
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const igOn = () => !!(IG_TOKEN && IG_USER);
const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, n) : "");

/* ---------- what the agent knows ---------- */
const BRAND = `Endeavor Business Solutions (Orlando, FL; https://endeavorbiz.com; WhatsApp +1 (630) 689-8702) helps Brazilian and other foreign entrepreneurs and investors build and run a business in the U.S.: company formation (LLC, corporation, branch of a foreign company), EIN/ITIN guidance, Florida registered agent, compliance and annual reports, tax coordination with licensed CPAs, U.S. bank account support, real estate holding structures, financing referrals, Brazil-U.S. expansion, family office coordination. It also runs a Partner Program for realtors, accountants and attorneys who refer clients.
Endeavor is not a law firm, CPA firm, bank or investment adviser; licensed services are done by independent licensed professionals. It never promises visas, tax results or returns.`;
const RULES_CONTENT = `Content rules (mandatory):
- Educational and trustworthy. No guarantees, no "get rich", no promises of visas, approvals, tax savings or returns. Immigration content is informational only and always says each case needs analysis by an immigration attorney. Tax content is general and says to confirm with a CPA.
- Never state prices. CTA examples: "Fale com a gente pelo link na bio", "Comente QUERO", "Mande DIRECT", "Agende uma conversa gratuita".
- Facts must be accurate and current; if unsure, keep it general. Do not cite numbers you did not verify in the research.
- Write for Brazilian entrepreneurs, investors and professionals (pt = Brazilian Portuguese); en/es when asked.
- Hooks that stop the scroll: a question, a myth vs. fact, a comparison Brazil x USA, a common mistake, a checklist, a surprising (verified) fact.
- Hashtags: 8-15, mix of broad and niche, chosen from the research (what people search in this niche), no banned/spammy tags.`;
const DESIGN = `Art: you design each image as structured text for Endeavor's brand templates (navy #0b1f3a, gold #c8a45d, cream #f6f1e7; serif headlines). Templates:
- "statement": kicker + big title (max 8 words) + short body (max 22 words).
- "list": title + 3-5 short bullets (max 7 words each).
- "compare": title + two columns (left label, right label) and 3-4 rows [left, right] (max 5 words each), e.g. Brasil x EUA.
- "stat": a big number or short word (verified) + title + body.
- "quote": a short strong sentence + attribution "Endeavor Business Solutions".
- "cta": closing slide: title + body + "Link na bio" style action.
Formats: "post" (1 slide, 1080x1350), "carousel" (3-7 slides, first slide is the hook, last slide is "cta"), "story" (1 slide, 1080x1920, short, with a question or poll-like prompt).
Palette per post: "navy" (dark), "cream" (light) or "gold" (accent).`;

async function claude(system: string, user: string, opts: { max?: number; search?: boolean; model?: string } = {}) {
  const body: Row = { model: opts.model || MODEL, max_tokens: opts.max ?? 4000, system, messages: [{ role: "user", content: user }] };
  if (opts.search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message || `ai_${r.status}`);
  return (j.content || []).filter((b: Row) => b.type === "text").map((b: Row) => b.text).join("").trim();
}

// structured output: the AI fills a tool whose input is always valid JSON (no hand-written JSON to parse)
const SLIDE = { type: "object", properties: { template: { type: "string", enum: ["statement", "list", "compare", "stat", "quote", "cta"] }, kicker: { type: "string" }, title: { type: "string" }, body: { type: "string" },
  bullets: { type: "array", items: { type: "string" } }, left: { type: "string" }, right: { type: "string" }, rows: { type: "array", items: { type: "array", items: { type: "string" } } }, stat: { type: "string" } }, required: ["template", "title"] };
const ITEM = { type: "object", properties: { format: { type: "string", enum: ["post", "carousel", "story"] }, language: { type: "string", enum: ["pt", "en", "es"] }, topic: { type: "string" }, hook: { type: "string" },
  palette: { type: "string", enum: ["navy", "cream", "gold"] }, slides: { type: "array", items: SLIDE }, caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, why: { type: "string" },
  reel_script: { type: "string" }, video_style: { type: "string", enum: ["scenes", "presenter"] } }, required: ["format", "topic", "hook", "palette", "slides", "caption", "hashtags", "why"] };
async function claudeItems(system: string, user: string, max = 8000): Promise<Row[]> {
  const tool = { name: "save_items", description: "Save the Instagram items you created.", input_schema: { type: "object", properties: { items: { type: "array", items: ITEM } }, required: ["items"] } };
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: max, system: system + "\n\nAlways deliver your work by calling the save_items tool exactly once (never write JSON in the text).", messages: [{ role: "user", content: user + (attempt ? "\n\nIMPORTANT: call the save_items tool now." : "") }], tools: [tool], tool_choice: { type: "auto" } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error?.message || `ai_${r.status}`);
    const use = (j.content || []).find((b: Row) => b.type === "tool_use");
    const items = use?.input?.items;
    if (Array.isArray(items) && items.length) return items;
    if (j.stop_reason === "max_tokens") max = Math.min(16000, max + 4000);
  }
  throw new Error("ai_format");
}
const chunk = <T,>(a: T[], n: number) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

function normPost(o: Row, lang: string) {
  const fmt = ["post", "carousel", "story"].includes(o.format) ? o.format : "post";
  const tpl = ["statement", "list", "compare", "stat", "quote", "cta"];
  let slides = Array.isArray(o.slides) ? o.slides.slice(0, fmt === "carousel" ? 7 : 1) : [];
  slides = slides.map((s: Row) => ({
    template: tpl.includes(s.template) ? s.template : "statement",
    kicker: clean(s.kicker, 60), title: clean(s.title, 120), body: clean(s.body, 260), stat: clean(s.stat, 16),
    bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 5).map((b: unknown) => clean(b, 70)).filter(Boolean) : [],
    left: clean(s.left, 24), right: clean(s.right, 24),
    rows: Array.isArray(s.rows) ? s.rows.slice(0, 4).map((r: unknown) => Array.isArray(r) ? [clean(r[0], 40), clean(r[1], 40)] : ["", ""]) : [],
  })).filter((s: Row) => s.title || s.stat);
  if (!slides.length) slides = [{ template: "statement", kicker: "", title: clean(o.hook, 120) || "Endeavor", body: "", stat: "", bullets: [], left: "", right: "", rows: [] }];
  const tags = (Array.isArray(o.hashtags) ? o.hashtags : String(o.hashtags || "").split(/[\s,]+/)).map((h: unknown) => String(h).trim().replace(/^#*/, "#")).filter((h: string) => /^#[\p{L}\p{N}_]{2,40}$/u.test(h)).slice(0, 15);
  return { format: fmt, language: ["pt", "en", "es"].includes(o.language) ? o.language : lang, topic: clean(o.topic, 200), hook: clean(o.hook, 200),
    design: { palette: ["navy", "cream", "gold"].includes(o.palette) ? o.palette : "navy", slides }, caption: clean(o.caption, 2100), hashtags: tags, research: clean(o.why, 1200),
    video: o.reel_script ? { script: clean(o.reel_script, 3000), style: o.video_style === "presenter" ? "presenter" : "scenes", status: "idea" } : null };
}

// next free slots on the posting days, in the configured time zone
function slots(cfg: Row, n: number, taken: string[]) {
  const out: string[] = [], tz = cfg.timezone || "America/New_York", [hh, mm] = String(cfg.post_time || "12:30").split(":").map(Number);
  const days: number[] = cfg.post_days?.length ? cfg.post_days : [1, 3, 5];
  const offset = (d: Date) => { const s = d.toLocaleString("en-US", { timeZone: tz, timeZoneName: "shortOffset" }); const m = s.match(/GMT([+-]\d+)(?::(\d+))?/); return m ? (Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] || 0)) : 0; };
  for (let i = 1; i < 60 && out.length < n; i++) {
    const d = new Date(Date.now() + i * 864e5);
    const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
    if (!days.includes(local.getDay())) continue;
    const utc = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), hh, mm) - offset(d) * 60000;
    const iso = new Date(utc).toISOString();
    if (!taken.some((t) => Math.abs(new Date(t).getTime() - utc) < 3 * 36e5)) out.push(iso);
  }
  return out;
}


async function plan(by: string, b: Row) {
  if (!ANTHROPIC) return { error: "no_ai_key" };
  const cfg: Row = (await db.from("ig_settings").select("*").eq("id", 1).single()).data ?? {};
  const nPosts = Math.min(10, Math.max(1, Number(b.posts) || cfg.posts_per_week || 4)), nStories = Math.min(10, Math.max(0, b.stories != null ? Number(b.stories) : cfg.stories_per_week ?? 3));
  const lang = (cfg.languages || ["pt"])[0] || "pt";
  const { data: recent } = await db.from("ig_posts").select("topic, hook, format").order("created_at", { ascending: false }).limit(30);
  const { data: future } = await db.from("ig_posts").select("scheduled_at").in("status", ["pending", "approved"]).not("scheduled_at", "is", null);
  const role = `You are the Marketing agent of Endeavor Business Solutions: a senior social media strategist and copywriter specialized in the niche of Brazilians doing business, investing and protecting wealth in the United States. You know Instagram growth (hooks, carousels, saves and shares, Stories engagement).\n\n${BRAND}\n\n${RULES_CONTENT}`;
  const themes = (cfg.topics || []).map((t: string) => "\n- " + t).join("");
  // 1. research (web search): a short brief with trends, angles and hashtags
  let brief = "";
  try {
    brief = await claude(role, `Research what is trending right now for this niche on Instagram and in the news (dollar and exchange rate, U.S. taxes for foreigners, Florida real estate, U.S. company rules, visa news for entrepreneurs, what Brazilian investors are searching, popular Portuguese hashtags for this niche).${b.focus ? " Extra focus: " + String(b.focus).slice(0, 300) + "." : ""}
Themes we cover: ${themes}
Write a short brief in Portuguese (max 250 words): 1) 5-8 trending angles with one line each, 2) 20 hashtags people actually use in this niche, 3) what to avoid. Plain text, no JSON.`, { max: 3000, search: true });
  } catch (e) { console.error("ig research", e); }
  // 2. the items, in small batches run in parallel (always valid JSON via tool use)
  const sys = role + "\n\n" + DESIGN + "\n\nBrand notes from the admin: " + (cfg.brand_notes || "-");
  const ctxText = `Language: "${lang}". Themes to rotate (pick the best for now, do not repeat recent topics): ${themes}
Recent posts (avoid repeating): ${JSON.stringify(recent ?? []).slice(0, 2500)}
Research brief: ${brief.slice(0, 3000) || "(not available: stay evergreen and general)"}${b.focus ? "\nExtra focus: " + String(b.focus).slice(0, 300) : ""}`;
  const jobs: Promise<Row[]>[] = [];
  const postBatches = chunk(Array.from({ length: nPosts }, (_, i) => i), 3);
  postBatches.forEach((bt, k) => jobs.push(claudeItems(sys, `${ctxText}\n\nCreate ${bt.length} feed item(s) (mix "carousel" and "post"; carousels 3-7 slides with a "cta" last slide). Batch ${k + 1} of ${postBatches.length}: choose different themes from other batches (start from theme number ${k * 3 + 1} of the list). Captions: value first, line breaks, soft CTA at the end, no hashtags inside. 8-15 hashtags each. Add reel_script only when the topic also works as a 60-120 s Reel. Save them with the tool.`)));
  if (nStories) jobs.push(claudeItems(sys, `${ctxText}\n\nCreate ${nStories} "story" item(s): 1 slide each, short, with a question or an invitation to reply. Caption can be empty. Save them with the tool.`, 5000));
  const settled = await Promise.allSettled(jobs);
  const items: Row[] = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!items.length) { const e = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined; throw new Error(e ? String(e.reason?.message || e.reason) : "ai_format"); }
  const feed = items.filter((x) => x.format !== "story"), st = items.filter((x) => x.format === "story");
  const taken = (future ?? []).map((x) => x.scheduled_at);
  const fs = slots(cfg, feed.length, taken), ss = slots({ ...cfg, post_time: "18:30", post_days: [0, 1, 2, 3, 4, 5, 6] }, st.length, []);
  const rows = feed.map((x, i) => ({ ...normPost(x, lang), scheduled_at: fs[i] || null, created_by: by, research: (clean(x.why, 600) + (brief ? "\n\nPesquisa da semana:\n" + brief.slice(0, 900) : "")).trim() }))
    .concat(st.map((x, i) => ({ ...normPost({ ...x, format: "story" }, lang), scheduled_at: ss[i] || null, created_by: by, research: clean(x.why, 600) })));
  const ins = await db.from("ig_posts").insert(rows).select("id");
  if (ins.error) throw ins.error;
  return { ok: true, created: ins.data?.length ?? 0, partial: settled.some((r) => r.status === "rejected"), research: brief.slice(0, 1500) };
}

async function redo(id: string, feedback: string, by: string) {
  if (!ANTHROPIC) return { error: "no_ai_key" };
  const { data: p } = await db.from("ig_posts").select("*").eq("id", id).single();
  if (!p) return { error: "not_found" };
  const sys = `You are the Marketing agent of Endeavor Business Solutions (Instagram).\n\n${BRAND}\n\n${RULES_CONTENT}\n\n${DESIGN}`;
  const items = await claudeItems(sys, `Rewrite this ${p.format} following the admin's feedback. Keep what works. Feedback: "${feedback.slice(0, 800)}"\nCurrent: ${JSON.stringify({ format: p.format, language: p.language, topic: p.topic, hook: p.hook, palette: p.design?.palette, slides: p.design?.slides, caption: p.caption, hashtags: p.hashtags })}\nSave exactly 1 item with the tool.`, 6000);
  const n = normPost(items[0], p.language);
  const upd = await db.from("ig_posts").update({ ...n, research: n.research || p.research, feedback: (p.feedback ? p.feedback + "\n" : "") + "• " + feedback.slice(0, 500), image_urls: [], status: "pending", updated_at: new Date().toISOString(), video: n.video ?? p.video }).eq("id", id).select("*").single();
  return { ok: true, post: upd.data, by };
}

/* ---------- Instagram Graph API ---------- */
async function graph(path: string, params: Row, method = "POST") {
  const u = new URL(`${IG_HOST}/${IG_VER}/${path}`);
  const init: RequestInit = { method };
  if (method === "GET") { for (const [k, v] of Object.entries({ ...params, access_token: IG_TOKEN })) u.searchParams.set(k, String(v)); }
  else init.body = new URLSearchParams(Object.fromEntries(Object.entries({ ...params, access_token: IG_TOKEN }).map(([k, v]) => [k, String(v)])));
  const r = await fetch(u, init); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j?.error?.message || `graph_${r.status}`);
  return j;
}
async function waitReady(container: string) {
  for (let i = 0; i < 10; i++) { const s = await graph(container, { fields: "status_code" }, "GET"); if (s.status_code === "FINISHED") return; if (s.status_code === "ERROR") throw new Error("media_error"); await new Promise((r) => setTimeout(r, 2000)); }
}
async function publish(p: Row) {
  if (!igOn()) throw new Error("instagram_not_connected");
  const imgs: string[] = p.image_urls || [];
  if (!imgs.length) throw new Error("no_art");
  const caption = [p.caption || "", (p.hashtags || []).join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);
  let creation: string;
  if (p.format === "story") creation = (await graph(`${IG_USER}/media`, { image_url: imgs[0], media_type: "STORIES" })).id;
  else if (p.format === "carousel" && imgs.length > 1) {
    const kids: string[] = [];
    for (const u of imgs.slice(0, 10)) kids.push((await graph(`${IG_USER}/media`, { image_url: u, is_carousel_item: "true" })).id);
    creation = (await graph(`${IG_USER}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption })).id;
  } else creation = (await graph(`${IG_USER}/media`, { image_url: imgs[0], caption })).id;
  await waitReady(creation);
  const pub = await graph(`${IG_USER}/media_publish`, { creation_id: creation });
  let link: string | null = null; try { link = (await graph(pub.id, { fields: "permalink" }, "GET")).permalink || null; } catch { /* optional */ }
  return { id: pub.id as string, permalink: link };
}
async function publishDue() {
  const { data: due } = await db.from("ig_posts").select("*").eq("status", "approved").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5);
  const out = { published: 0, failed: 0, waiting: igOn() ? undefined : "instagram_not_connected" };
  if (!igOn()) return out;
  for (const p of due ?? []) {
    try { const r = await publish(p); await db.from("ig_posts").update({ status: "published", ig_media_id: r.id, ig_permalink: r.permalink, published_at: new Date().toISOString(), error: null }).eq("id", p.id); out.published++; }
    catch (e) {
      const msg = String((e as Error).message).slice(0, 500);
      await db.from("ig_posts").update({ status: "failed", error: msg }).eq("id", p.id); out.failed++;
      await db.from("admin_events").insert({ kind: "partner_new", title: "Instagram: post não publicado", body: (p.hook || p.topic || "") + " · " + msg, link: "#/instagram" });
    }
  }
  return out;
}

/* ---------- comments and DMs ---------- */
const REPLY_RULES = `You are the Endeavor Business Solutions account replying on Instagram. Reply in the language of the message (pt = Brazilian Portuguese). Warm, short and human: comments max 25 words (public), DMs max 70 words. Never give prices: say the team sends a personalized proposal. Never ask for or accept SSN, ITIN, passport, CPF or bank numbers. No legal, tax, immigration or investment advice: explain generally and invite to a free call (https://endeavorbiz.com/schedule.html) or to the team. Never promise visas or results.
Comments: thank, answer briefly, and invite to DM ("te chamei no direct" is not allowed; say "manda um direct" or "link na bio"). Ignore spam/insults: reply with exactly [[SKIP]].
DMs: understand the need, answer, and when they want a proposal ask for their full name and e-mail in the DM and end with [[LEAD]]. If they ask for a person or it is a complaint/client issue, say the team will reply and end with [[HUMAN]].`;
async function aiReply(kind: "comment" | "dm", text: string, history: string) {
  if (!ANTHROPIC) return null;
  const t = await claude(REPLY_RULES + "\n\nFacts:\n" + BRAND, (history ? "Conversation so far:\n" + history + "\n\n" : "") + `New ${kind === "dm" ? "direct message" : "comment"}: "${text.slice(0, 1000)}"\nWrite only the reply.`, { max: 400, model: REPLY_MODEL });
  return t.slice(0, 1000);
}
async function hmacOk(raw: string, sig: string | null) {
  if (!IG_SECRET || !sig?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(IG_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)))).map((x) => x.toString(16).padStart(2, "0")).join("");
  const b = sig.slice(7); if (mac.length !== b.length) return false; let d = 0; for (let i = 0; i < mac.length; i++) d |= mac.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
async function handleComment(v: Row) {
  if (!v?.id || v.from?.id === IG_USER) return;
  const ins = await db.from("ig_inbox").insert({ kind: "comment", ig_id: String(v.id), thread_id: v.from?.id || null, username: v.from?.username || null, media_id: v.media?.id || null, text: String(v.text || "").slice(0, 2000) }).select("id").single();
  if (ins.error) return; // already handled
  const cfg: Row = (await db.from("ig_settings").select("auto_reply").eq("id", 1).single()).data ?? {};
  if (!cfg.auto_reply || !igOn()) return;
  try {
    const r = await aiReply("comment", String(v.text || ""), "");
    if (!r || /\[\[SKIP\]\]/.test(r)) { await db.from("ig_inbox").update({ status: "ignored" }).eq("id", ins.data.id); return; }
    await graph(`${v.id}/replies`, { message: r });
    await db.from("ig_inbox").update({ reply: r, replied_at: new Date().toISOString(), status: "replied" }).eq("id", ins.data.id);
  } catch (e) { await db.from("ig_inbox").update({ status: "failed", error: String((e as Error).message).slice(0, 500) }).eq("id", ins.data.id); }
}
async function handleDm(m: Row) {
  const from = String(m.sender?.id || ""), text = String(m.message?.text || "").slice(0, 2000);
  if (!from || from === IG_USER || m.message?.is_echo || !text) return;
  const ins = await db.from("ig_inbox").insert({ kind: "dm", ig_id: String(m.message?.mid || crypto.randomUUID()), thread_id: from, text }).select("id").single();
  if (ins.error) return;
  const { data: hist } = await db.from("ig_inbox").select("text, reply, status, lead_id, username").eq("kind", "dm").eq("thread_id", from).order("created_at", { ascending: false }).limit(10);
  const past = (hist ?? []).slice(1).reverse();
  const askedLead = past.some((h) => /e-?mail|correo/i.test(h.reply || ""));
  const hasLead = past.some((h) => h.lead_id);
  // e-mail in a DM after the agent asked for it -> CRM lead
  const em = text.match(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i);
  if (em && askedLead && !hasLead) {
    const name = text.replace(em[0], "").replace(/[^\p{L}\s'.-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Instagram " + from.slice(-4);
    const convo = past.map((h) => "Visitante: " + (h.text || "") + (h.reply ? "\nEndeavor: " + h.reply : "")).join("\n") + "\nVisitante: " + text;
    const ld = await db.from("leads").insert({ name: name.length >= 2 ? name : "Instagram", email: em[0].toLowerCase(), source: "instagram", status: "new", kind: "lead", language: "pt", marketing_consent: false, message: ("Pediu proposta pelo direct do Instagram.\n\n" + convo).slice(0, 4900) }).select("id").single();
    if (!ld.error) {
      await db.from("ig_inbox").update({ lead_id: ld.data.id }).eq("id", ins.data.id);
      await db.from("admin_events").insert({ kind: "lead_chat", title: "Pedido de proposta pelo Instagram: " + name, body: em[0], link: "#/crm?lead=" + ld.data.id });
    }
  }
  const cfg: Row = (await db.from("ig_settings").select("auto_reply").eq("id", 1).single()).data ?? {};
  if (!cfg.auto_reply || !igOn()) return;
  try {
    let r = await aiReply("dm", text, past.map((h) => "Them: " + (h.text || "") + (h.reply ? "\nYou: " + h.reply : "")).join("\n"));
    if (!r) return;
    const handoff = /\[\[HUMAN\]\]/.test(r);
    r = r.replace(/\s*\[\[(LEAD|HUMAN|SKIP)\]\]\s*/g, " ").trim();
    if (em && askedLead && !hasLead) r = r || "Recebemos! A nossa equipe vai enviar a proposta por e-mail.";
    await graph(`${IG_USER}/messages`, { recipient: JSON.stringify({ id: from }), message: JSON.stringify({ text: r }) });
    await db.from("ig_inbox").update({ reply: r, replied_at: new Date().toISOString(), status: handoff ? "handoff" : "replied" }).eq("id", ins.data.id);
    if (handoff) await db.from("admin_events").insert({ kind: "lead_chat", title: "Instagram: pediram para falar com a equipe", body: text.slice(0, 300), link: "#/instagram?tab=inbox" });
  } catch (e) { await db.from("ig_inbox").update({ status: "failed", error: String((e as Error).message).slice(0, 500) }).eq("id", ins.data.id); }
}
async function webhook(p: Row) {
  for (const e of p.entry ?? []) {
    for (const c of e.changes ?? []) if (c.field === "comments" || c.field === "live_comments") await handleComment(c.value);
    for (const m of e.messaging ?? []) await handleDm(m);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("hub.mode") === "subscribe")
    return IG_VERIFY && url.searchParams.get("hub.verify_token") === IG_VERIFY ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const raw = await req.text(); let b: Row = {}; try { b = JSON.parse(raw || "{}"); } catch { b = {}; }
    if (b.object === "instagram" || b.object === "page") {
      if (!(await hmacOk(raw, req.headers.get("x-hub-signature-256")))) return new Response("forbidden", { status: 403 });
      try { await webhook(b); } catch (e) { console.error("ig webhook", e); }
      return new Response("ok", { status: 200 });
    }
    if (b.event === "tick") {
      const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
      if (!ok) return json({ error: "forbidden" }, 403);
      return json(await publishDue());
    }
    if (b.event === "plan") {
      // scheduled planning (internal key): same as the admin button
      const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
      if (!ok) return json({ error: "forbidden" }, 403);
      const r = await plan("agente (automático)", b); return json(r, (r as Row).error ? 400 : 200);
    }
    const user = createClient(SB_URL, SB_ANON || SB_SERVICE, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
    const { data: isAdmin } = await user.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    const by = (await user.auth.getUser()).data.user?.email ?? "admin";
    if (b.action === "status") return json({ ai: !!ANTHROPIC, instagram: igOn(), webhook: !!(IG_VERIFY && IG_SECRET), video: VIDEO_KEYS });
    if (b.action === "plan") { const r = await plan(by, b); return json(r, (r as Row).error ? 400 : 200); }
    if (b.action === "redo") { const r = await redo(String(b.id || ""), String(b.feedback || "").trim() || "Melhore o gancho e a arte.", by); return json(r, (r as Row).error ? 400 : 200); }
    if (b.action === "publish_now") {
      const { data: p } = await db.from("ig_posts").select("*").eq("id", String(b.id || "")).single();
      if (!p) return json({ error: "not_found" }, 404);
      if (p.status !== "approved") return json({ error: "not_approved" }, 400);
      try { const r = await publish(p); await db.from("ig_posts").update({ status: "published", ig_media_id: r.id, ig_permalink: r.permalink, published_at: new Date().toISOString(), error: null }).eq("id", p.id); return json({ ok: true, ...r }); }
      catch (e) { return json({ error: String((e as Error).message).slice(0, 300) }, 400); }
    }
    if (b.action === "video") return json({ error: "video_not_configured", keys: VIDEO_KEYS }, 400);
    return json({ error: "action" }, 400);
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e).slice(0, 300) }, 500); }
});
