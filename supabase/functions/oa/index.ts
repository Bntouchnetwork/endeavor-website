// Endeavor Operating Agreement module.
// Flow: pending_generation -> questionnaire (prefilled from the company record and the Articles) -> drafting (AI with approved rules)
//       -> in_review (Endeavor; qualified reviewer when required) -> client_review -> approved -> signing (Endeavor e-signature,
//       one envelope per signer, in sequence) -> signed -> archived (signed PDF + evidence in the company folder).
// Reuses: envelopes/envelope_events + the `esign` function (signing), client-docs + company_documents (archive),
// admin_events (bell), audit_log (protected trail), operating_agreements realtime (both portals update automatically).
// Secrets: ANTHROPIC_API_KEY (or OPENAI_API_KEY), OA_MODEL / OA_OPENAI_MODEL (optional), RESEND_API_KEY + OA_EMAIL_FROM (optional, co-signer e-mails), SITE_URL.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as PDFLib from "npm:pdf-lib@1.17.1";
import "./oa-rules.js";
import "./oa-render.js";
import { meter } from "../_shared/ai-meter.ts";
meter("oa"); // Hub AI: records tokens and cost of this agent

const R: any = (globalThis as any).EOARules;
const RENDER: any = (globalThis as any).EOARender;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SITE = (Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI = Deno.env.get("OPENAI_API_KEY") || "";
const AI_MODEL = ANTHROPIC ? (Deno.env.get("OA_MODEL") || "claude-sonnet-5-5") : (Deno.env.get("OA_OPENAI_MODEL") || "gpt-4.1");
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const MAIL_FROM = Deno.env.get("OA_EMAIL_FROM") || "Endeavor Business Solutions <support@endeavorbiz.com>";
const CONSENT_VERSION = "2026-11-05";
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400, public detail?: unknown) { super(code); } }
const enc = new TextEncoder();
async function sha256(b: Uint8Array | string) { const d = await crypto.subtle.digest("SHA-256", (typeof b === "string" ? enc.encode(b) : b) as BufferSource); return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
const now = () => new Date().toISOString();
const clip = (v: unknown, n = 500) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

/* ---------------- who / where ---------------- */
async function caller(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Fail("unauthorized", 401);
  const [{ data: isAdmin }, { data: isRev }] = await Promise.all([user.rpc("is_admin"), user.rpc("is_legal_reviewer")]);
  return { id: u.user.id, email: (u.user.email || "").toLowerCase(), isAdmin: !!isAdmin, isReviewer: !!isRev, user };
}
async function meta(req: Request) {
  const { data: s } = await admin.from("compliance_settings").select("*").eq("id", 1).maybeSingle();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
  return { ip: s?.capture_ip === false ? null : ip, ua: s?.capture_user_agent === false ? null : (req.headers.get("user-agent") || "").slice(0, 400) || null };
}
type Ctx = { c: Awaited<ReturnType<typeof caller>>; m: { ip: string | null; ua: string | null }; role: string };
async function audit(ctx: Ctx | null, action: string, oa: any, details: Record<string, unknown> = {}) {
  await admin.rpc("audit_write", { p_action: action, p_entity_type: "operating_agreement", p_entity_id: oa?.id || null, p_client: oa?.client_id || null, p_company: oa?.company_id || null,
    p_details: { ...details, oa_version: oa?.version ?? null, rules_version: oa?.rules_version ?? null }, p_actor_email: ctx ? ctx.c.email : "system", p_actor_role: ctx ? ctx.role : "system",
    p_ip: ctx?.m.ip || null, p_ua: ctx?.m.ua || null });
}
async function bell(kind: string, title: string, body: string, link: string) { await admin.from("admin_events").insert({ kind, title: title.slice(0, 300), body: body.slice(0, 2000), link: link.slice(0, 300) }); }

/* ---------------- loading & access ---------------- */
async function loadOA(id: string) {
  const { data: oa } = await admin.from("operating_agreements").select("*, companies(*), clients(id, name, primary_email, language)").eq("id", id).maybeSingle();
  if (!oa) throw new Fail("not_found", 404);
  return oa;
}
async function access(req: Request, oaId: string, need: "owner" | "admin" | "any") {
  const c = await caller(req);
  const oa = await loadOA(oaId);
  let role = c.isAdmin ? "admin" : "";
  if (!c.isAdmin) {
    const { data: r } = await c.user.rpc("my_client_role", { p_client: oa.client_id });
    if (r !== "owner") throw new Fail("forbidden", 403);
    role = "client_owner";
  }
  if (need === "owner" && role !== "client_owner") throw new Fail("owner_only", 403);
  if (need === "admin" && role !== "admin") throw new Fail("forbidden", 403);
  return { oa, ctx: { c, m: await meta(req), role } as Ctx };
}
async function setStatus(oa: any, status: string, actor: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin.from("operating_agreements").update({ status, status_actor: actor, ...extra }).eq("id", oa.id).select("*").single();
  if (error) throw error;
  Object.assign(oa, data);
  return oa;
}

/* ---------------- rules ---------------- */
async function ruleSet(state: string) {
  const { data } = await admin.from("oa_rule_sets").select("*").eq("state", state).eq("status", "approved").order("approved_at", { ascending: false }).limit(1).maybeSingle();
  if (data) return { rs: data.content, id: data.id, approved: true, version: data.version };
  const built = R.buildRuleSet(state);
  return built ? { rs: built, id: null, approved: false, version: built.version } : null;
}
function genericRules() { const rs = R.buildRuleSet("FL"); rs.state = "other"; rs.state_name = ""; rs.questions.forEach((q: any) => { q.note = null; }); return { rs, id: null, approved: false, version: rs.version }; }
async function seedRules() {
  let n = 0;
  for (const st of Object.keys(R.STATES)) {
    const rs = R.buildRuleSet(st), body = JSON.stringify(rs);
    const { data } = await admin.from("oa_rule_sets").select("id").eq("state", st).eq("version", rs.version).maybeSingle();
    if (!data) { await admin.from("oa_rule_sets").insert({ state: st, version: rs.version, content: rs, content_sha256: await sha256(body), status: "pending_approval" }); n++; }
  }
  return n;
}

/* ---------------- AI (official APIs) ---------------- */
function parseJson(t: string) { const s = t.indexOf("{"), e = t.lastIndexOf("}"); if (s < 0 || e < s) throw new Error("no_json"); return JSON.parse(t.slice(s, e + 1)); }
async function ai(system: string, content: any[], maxTokens = 12000) {
  if (ANTHROPIC) {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, temperature: 0, system, messages: [{ role: "user", content }] }) });
    const j = await r.json();
    if (!r.ok) throw new Error("anthropic " + r.status + " " + (j?.error?.message || ""));
    return { text: (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(""), provider: "anthropic", model: j.model || AI_MODEL, id: j.id, usage: j.usage };
  }
  if (OPENAI) {
    const parts = content.map((b: any) => b.type === "document" ? { type: "file", file: { filename: "articles.pdf", file_data: "data:application/pdf;base64," + b.source.data } } : { type: "text", text: b.text });
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + OPENAI, "content-type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: parts }] }) });
    const j = await r.json();
    if (!r.ok) throw new Error("openai " + r.status + " " + (j?.error?.message || ""));
    return { text: j.choices?.[0]?.message?.content || "", provider: "openai", model: j.model || AI_MODEL, id: j.id, usage: j.usage };
  }
  throw new Error("ai_not_configured");
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

// company record + Articles/Certificate (read by the AI when configured; only facts printed in the document are kept)
async function prefill(oa: any) {
  const co = oa.companies || {};
  const p: Record<string, unknown> = {}, src: Record<string, string> = {};
  const put = (k: string, v: unknown, s: string) => { if (v != null && String(v).trim()) { p[k] = typeof v === "string" ? v.trim() : v; src[k] = s; } };
  put("legal_name", co.legal_name, "company_record"); put("state", co.state, "company_record"); put("filing_number", co.document_number, "company_record");
  put("formation_date", co.formation_date, "company_record"); put("principal_address", co.address, "company_record"); put("registered_agent", co.registered_agent, "company_record");
  put("fiscal_year", co.fiscal_year_end ? (co.fiscal_year_end === "12-31" ? "12-31" : "other") : null, "company_record");
  let articles: any = null, note = "";
  const { data: docs } = await admin.from("company_documents").select("id, title, path, mime").eq("company_id", oa.company_id).eq("category", "formation").order("created_at", { ascending: false });
  const art = (docs || []).find((d: any) => /\.pdf$/i.test(d.path) && /articles|certificate of formation|formation|organiza|constitui|arquivamento/i.test(d.title));
  if (art && (ANTHROPIC || OPENAI)) {
    try {
      const { data: f } = await admin.storage.from("client-docs").download(art.path);
      const bytes = new Uint8Array(await f!.arrayBuffer());
      if (bytes.length < 9_000_000) {
        const r = await ai("You extract facts from a U.S. limited liability company formation filing (Articles of Organization or Certificate of Formation). Return only JSON. Use null for anything not printed in the document. Never guess.",
          [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64(bytes) } },
           { type: "text", text: 'Return JSON: {"legal_name":string|null,"state":"two-letter code"|null,"filing_number":string|null,"formation_date":"YYYY-MM-DD"|null,"principal_address":string|null,"registered_agent":string|null,"management":"member"|"manager"|null,"listed_managers_or_members":[string],"document_type":string|null}. "management" only if the document states whether the company is managed by managers or by members.' }], 1500);
        articles = parseJson(r.text);
        articles._ai = { provider: r.provider, model: r.model, id: r.id, document_id: art.id };
      }
    } catch (e) { note = "articles_read_failed: " + String((e as Error).message).slice(0, 120); }
  } else if (!art) note = "articles_not_found";
  if (articles) {
    put("legal_name", articles.legal_name, "articles"); put("state", /^[A-Z]{2}$/.test(articles.state || "") ? articles.state : null, "articles"); put("filing_number", articles.filing_number, "articles");
    put("formation_date", /^\d{4}-\d{2}-\d{2}$/.test(articles.formation_date || "") ? articles.formation_date : null, "articles");
    put("principal_address", articles.principal_address, "articles"); put("registered_agent", articles.registered_agent, "articles");
    if (articles.management === "member" || articles.management === "manager") put("management", articles.management, "articles");
  }
  return { prefill: p, sources: { ...src, _articles_document: art?.id || null, _articles_ai: articles?._ai || null, _note: note || null } };
}

/* ---------------- drafting ---------------- */
function sanitizeAnswers(rs: any, input: any, prev: any) {
  const out = { ...(prev || {}) }, ids = new Set<string>();
  rs.questions.forEach((q: any) => { ids.add(q.id); if (q.detail) ids.add(q.id + "_detail"); });
  for (const [k, v] of Object.entries(input || {})) {
    if (!ids.has(k)) continue;
    if (k === "members") out.members = (Array.isArray(v) ? v : []).slice(0, 20).map((m: any) => ({ name: clip(m?.name, 120), email: clip(m?.email, 254).toLowerCase(), pct: Math.max(0, Math.min(100, Number(m?.pct) || 0)), contribution: clip(m?.contribution, 120), us_person: m?.us_person === "yes" ? "yes" : m?.us_person === "no" ? "no" : "" }));
    else if (k === "managers") out.managers = (Array.isArray(v) ? v : []).slice(0, 10).map((m: any) => ({ name: clip(m?.name, 120), email: clip(m?.email, 254).toLowerCase() }));
    else { const q = rs.questions.find((x: any) => x.id === k); const s = clip(v, k.endsWith("_detail") ? 500 : 300); if (q?.options && s && !q.options.some((o: any) => o[0] === s)) continue; out[k] = s; }
  }
  return out;
}
const SYSTEM = [
  "You are drafting a U.S. limited liability company operating agreement for Endeavor Business Solutions.",
  "You may ONLY use the approved clauses supplied in the input. Each clause has a rule id, a title and an approved model text that already contains the client's facts.",
  "For every clause, return a final text that has exactly the same legal effect as the model text, adapted for clarity and consistency with the other clauses (defined terms, singular/plural, cross-references).",
  "Do not add, remove or change any right, obligation, threshold, percentage, number, deadline, name, statute or election. Do not add provisions, warranties, recitals or legal advice that are not in the model texts.",
  "Keep every name, number, percentage, dollar amount and section reference of the model text exactly as written. Use plain, professional U.S. legal English. No markdown.",
  "If a clause cannot be drafted from the facts given, or two clauses conflict, keep the model text and add a short explanation to review_reasons and set needs_review to true.",
  'Return only JSON: {"sections":[{"rule":"<rule id>","text":"<final text>"}],"needs_review":boolean,"review_reasons":[string]} with one entry per supplied rule id, in the same order.'
].join("\n");
async function draft(oaId: string, opts: { reasons?: any[]; notes?: string; actor: string; ctx?: Ctx | null }) {
  const oa = await loadOA(oaId);
  try {
    const rsInfo = await ruleSet(oa.answers.state || oa.state);
    if (!rsInfo) throw new Error("no_rules_for_state");
    const rs = rsInfo.rs;
    const model = R.compose(rs, oa.answers, oa.companies || {});
    const validation: any[] = [];
    let source = "template", prov: any = null, promptHash: string | null = null;
    const reasons: any[] = (opts.reasons || []).slice();
    if (!rsInfo.approved) reasons.push({ q: "state", code: "rules_not_approved" });
    if (ANTHROPIC || OPENAI) {
      const { data: comments } = await admin.from("oa_comments").select("section, body").eq("oa_id", oa.id).is("resolved_at", null);
      const clauses: any[] = []; model.articles.forEach((a: any) => a.sections.forEach((s: any) => clauses.push({ rule: s.rule, article: a.title, title: s.title, model_text: s.model, references: s.refs.map((x: any) => x.cite) })));
      const input = { company: model.company, state: rs.state_name, governing_act: rs.act, single_member: model.single, approved_clauses: clauses, reviewer_notes: opts.notes || null, client_comments: (comments || []).map((c: any) => ({ section: c.section, comment: c.body })) };
      const prompt = JSON.stringify(input);
      promptHash = await sha256(SYSTEM + "\n" + prompt);
      try {
        const r = await ai(SYSTEM, [{ type: "text", text: prompt }]);
        const out = parseJson(r.text);
        prov = { provider: r.provider, model: r.model, id: r.id, usage: r.usage };
        const byRule: Record<string, string> = {}; (out.sections || []).forEach((s: any) => { if (s && typeof s.text === "string") byRule[s.rule] = s.text.trim(); });
        const candidate = { company: model.company, articles: model.articles.map((a: any) => ({ ...a, sections: a.sections.map((s: any) => ({ rule: s.rule, text: byRule[s.rule] ?? "" })) })) };
        const issues = R.checkDraft(model, candidate);
        issues.forEach((i: any) => validation.push(i));
        const bad = new Set(issues.map((i: any) => i.rule));
        model.articles.forEach((a: any) => a.sections.forEach((s: any) => { if (byRule[s.rule] && !bad.has(s.rule)) { s.text = byRule[s.rule]; s.ai = true; } else s.ai = false; }));
        if (out.needs_review) (out.review_reasons || []).slice(0, 10).forEach((t: string) => reasons.push({ q: "draft", code: "ai_flag", detail: clip(t, 300) }));
        source = "ai";
      } catch (e) { validation.push({ code: "ai_failed", detail: String((e as Error).message).slice(0, 200) }); }
    } else validation.push({ code: "ai_not_configured" });
    const v = (oa.version || 0) + 1;
    const pdf = await RENDER.render(PDFLib, model, { watermark: "DRAFT FOR REVIEW", footerLeft: "Draft v" + v + " - not for signature", footerRight: "Rules " + rs.version });
    const hash = await sha256(pdf.bytes), path = `oa/${oa.id}/v${v}.pdf`;
    const up = await admin.storage.from("documents").upload(path, pdf.bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    const { data: ver, error } = await admin.from("oa_versions").insert({ oa_id: oa.id, version: v, source, content: model, pdf_path: path, pdf_sha256: hash, pages: pdf.pages, fields: pdf.fields,
      ai_provider: prov?.provider || null, ai_model: prov?.model || null, ai_request_id: prov?.id || null, ai_usage: prov?.usage || null, prompt_sha256: promptHash,
      rules_version: rs.version, rule_set_id: rsInfo.id, validation, created_by: opts.actor, note: opts.notes || null }).select("id").single();
    if (error) throw error;
    const issues = reasons.map((r) => ({ ...r, resolved: false }));
    await setStatus(oa, "in_review", "system", { version: v, current_version_id: ver.id, rule_set_id: rsInfo.id, rules_version: rs.version, issues, review_required: issues.length > 0, last_error: null });
    await audit(opts.ctx || null, "oa.draft_generated", oa, { version_id: ver.id, source, ai_provider: prov?.provider || null, ai_model: prov?.model || null, ai_request_id: prov?.id || null, prompt_sha256: promptHash, pdf_sha256: hash, rules_approved: rsInfo.approved, review_reasons: issues.map((i) => i.code), validation_issues: validation.length });
    await bell("oa_review", (issues.length ? "Revisão habilitada necessária: " : "Minuta para revisar: ") + "Operating Agreement · " + (oa.companies?.legal_name || ""), issues.length ? "Motivos: " + issues.map((i) => i.code).join(", ") : "Minuta v" + v + " pronta. Revise e libere para o cliente.", "#/compliance?tab=oa&id=" + oa.id);
  } catch (e) {
    console.error("draft", e);
    await setStatus(oa, "in_review", "system", { review_required: true, last_error: String((e as Error).message).slice(0, 300), issues: [...(oa.issues || []), { q: "draft", code: "draft_failed", resolved: false }] });
    await bell("oa_review", "Falha ao gerar minuta: " + (oa.companies?.legal_name || ""), String((e as Error).message).slice(0, 300), "#/compliance?tab=oa&id=" + oa.id);
  }
}
async function newVersionFrom(oa: any, content: any, actor: string, note: string, source: "edit") {
  const v = (oa.version || 0) + 1;
  const pdf = await RENDER.render(PDFLib, content, { watermark: "DRAFT FOR REVIEW", footerLeft: "Draft v" + v + " - not for signature", footerRight: "Rules " + (oa.rules_version || "") });
  const hash = await sha256(pdf.bytes), path = `oa/${oa.id}/v${v}.pdf`;
  const up = await admin.storage.from("documents").upload(path, pdf.bytes, { contentType: "application/pdf", upsert: true }); if (up.error) throw up.error;
  const { data: ver, error } = await admin.from("oa_versions").insert({ oa_id: oa.id, version: v, source, content, pdf_path: path, pdf_sha256: hash, pages: pdf.pages, fields: pdf.fields, rules_version: oa.rules_version, rule_set_id: oa.rule_set_id, created_by: actor, note }).select("id").single();
  if (error) throw error;
  await admin.from("operating_agreements").update({ version: v, current_version_id: ver.id }).eq("id", oa.id);
  oa.version = v; oa.current_version_id = ver.id;
  return { id: ver.id, version: v, sha: hash };
}

/* ---------------- signing (Endeavor e-signature module) ---------------- */
function signUrl(token: string, lang: string) { return `${SITE}/sign.html?t=${token}&lang=${lang || "en"}&ret=client`; }
async function mailSigner(oa: any, s: any, env: any) {
  const lang = oa.clients?.language || "pt";
  const link = signUrl(env.token, lang);
  if (!RESEND) {
    await bell("oa_signature", "Enviar link de assinatura: " + s.name, "Operating Agreement de " + (oa.companies?.legal_name || "") + ". Abra Assinaturas e use \"Enviar e-mail\" para " + s.email + ".", "#/assinaturas");
    return false;
  }
  const subj = { pt: "Assinatura do Operating Agreement: ", en: "Please sign the Operating Agreement: ", es: "Firma del Operating Agreement: " }[lang as "pt"] || "Please sign the Operating Agreement: ";
  const body = { pt: `Olá ${s.name},\n\nO Operating Agreement de ${oa.companies?.legal_name} foi aprovado e aguarda a sua assinatura eletrônica.\n\nAssinar: ${link}\n\nO link é pessoal. Endeavor Business Solutions · support@endeavorbiz.com`,
    en: `Hello ${s.name},\n\nThe Operating Agreement of ${oa.companies?.legal_name} was approved and is waiting for your electronic signature.\n\nSign here: ${link}\n\nThis link is personal. Endeavor Business Solutions · support@endeavorbiz.com`,
    es: `Hola ${s.name},\n\nEl Operating Agreement de ${oa.companies?.legal_name} fue aprobado y espera su firma electrónica.\n\nFirmar: ${link}\n\nEl enlace es personal. Endeavor Business Solutions · support@endeavorbiz.com` }[lang as "pt"];
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND, "content-type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [s.email], subject: subj + (oa.companies?.legal_name || ""), text: body }) });
  if (r.ok) { await admin.from("envelope_events").insert({ envelope_id: env.id, event: "emailed", details: { to: s.email, via: "oa-module" } }); return true; }
  await bell("oa_signature", "Falha ao enviar link de assinatura: " + s.name, "Use Assinaturas → Enviar e-mail.", "#/assinaturas");
  return false;
}
async function createEnvelope(oa: any, i: number, docPath: string, docSha: string, fields: any[]) {
  const s = oa.signers[i];
  const { data: env, error } = await admin.from("envelopes").insert({
    title: ("Operating Agreement - " + (oa.companies?.legal_name || "")).slice(0, 200), signer_name: s.name, signer_email: s.email,
    message: "Operating Agreement approved in the Endeavor client portal. Signer " + (i + 1) + " of " + oa.signers.length + ".",
    document_path: docPath, document_sha256: docSha, fields: fields.filter((f) => f.signer === i).map(({ signer: _s, ...f }) => f),
    oa_id: oa.id, signer_index: i, id_stamped: i > 0, created_by: "oa-module" }).select("*").single();
  if (error) throw error;
  await admin.from("envelope_events").insert({ envelope_id: env.id, event: "sent", details: { oa_id: oa.id, signer_index: i, fields: env.fields.length } });
  oa.signers[i] = { ...s, envelope_id: env.id, status: "sent", sent_at: now() };
  await admin.from("operating_agreements").update({ signers: oa.signers }).eq("id", oa.id);
  return env;
}
// idempotent: marks signed envelopes, opens the next signer's envelope on the signed PDF, archives when everyone signed
async function advance(oaId: string, ctx: Ctx | null) {
  const oa = await loadOA(oaId);
  if (oa.status !== "signing") return oa;
  const { data: envs } = await admin.from("envelopes").select("*").eq("oa_id", oa.id).order("signer_index");
  let changed = false, last: any = null;
  for (const e of envs || []) {
    const s = oa.signers[e.signer_index]; if (!s) continue;
    if (e.status === "signed" && s.status !== "signed") { oa.signers[e.signer_index] = { ...s, status: "signed", signed_at: e.signed_at }; changed = true; }
    if (e.status === "signed") last = e;
  }
  if (changed) await admin.from("operating_agreements").update({ signers: oa.signers }).eq("id", oa.id);
  const next = oa.signers.findIndex((s: any) => s.status !== "signed");
  if (next >= 0) {
    if (!oa.signers[next].envelope_id && last) {
      const { data: fin } = await admin.from("oa_versions").select("fields").eq("oa_id", oa.id).eq("final", true).order("version", { ascending: false }).limit(1).single();
      const env = await createEnvelope(oa, next, last.signed_document_path, last.signed_document_sha256, fin!.fields || []);
      await audit(ctx, "oa.signature_requested", oa, { signer_index: next, envelope_id: env.id });
      await mailSigner(oa, oa.signers[next], env);
    }
    return oa;
  }
  await setStatus(oa, "signed", "system", { signed_at: now() });
  await audit(ctx, "oa.signed", oa, { envelopes: (envs || []).map((e: any) => e.id), final_signed_sha256: last?.signed_document_sha256 });
  await archive(oa, last, envs || [], ctx);
  return oa;
}
async function evidencePdf(oa: any, envs: any[], versions: any[], events: any[]) {
  const pdf = await PDFLib.PDFDocument.create();
  const f = await pdf.embedFont(PDFLib.StandardFonts.Helvetica), b = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]), y = 740;
  const S = RENDER.safe;
  const line = (t: string, size = 9, font = f, indent = 0) => {
    const words = S(t).split(/\s+/); let cur = "";
    const flush = () => { if (y < 54) { page = pdf.addPage([612, 792]); y = 740; } page.drawText(cur, { x: 54 + indent, y, size, font, color: PDFLib.rgb(0.1, 0.12, 0.16) }); y -= size + 4; cur = ""; };
    for (const w of words) { const tst = cur ? cur + " " + w : w; if (font.widthOfTextAtSize(tst, size) > 504 - indent && cur) { flush(); cur = w; } else cur = tst; }
    if (cur) flush();
  };
  line("Operating Agreement - Signature and Compliance Evidence", 15, b); y -= 4;
  line("Endeavor Business Solutions (a trade name of Endeavor Tax Solutions LLC). Generated " + now().replace("T", " ").slice(0, 19) + " UTC.", 8.5); y -= 8;
  const rows: [string, string][] = [["Company", oa.companies?.legal_name || ""], ["Operating Agreement ID", oa.id], ["State / rules version", (oa.answers?.state || oa.state) + " / " + (oa.rules_version || "")],
    ["Final version", "v" + oa.version], ["Approved by client", (oa.approved_by_email || "") + " at " + String(oa.approved_at || "").replace("T", " ").slice(0, 19) + " UTC"]];
  rows.forEach(([k, v]) => { line(k, 8.5, b); line(v, 9, f, 10); });
  y -= 6; line("Versions", 11, b);
  versions.forEach((v: any) => line(`v${v.version}${v.final ? " (final)" : ""} - ${v.source}${v.ai_model ? " - AI " + v.ai_provider + "/" + v.ai_model + " request " + (v.ai_request_id || "") : ""} - rules ${v.rules_version} - SHA-256 ${v.pdf_sha256}`, 8, f, 10));
  y -= 6; line("Consents", 11, b);
  (oa.consents || []).forEach((c: any) => line(`${c.type} v${c.version} - ${c.by} - ${String(c.at).replace("T", " ").slice(0, 19)} UTC${c.ip ? " - IP " + c.ip : ""}`, 8, f, 10));
  y -= 6; line("Signatures (Endeavor e-signature)", 11, b);
  envs.forEach((e: any) => line(`Signer ${e.signer_index + 1}: ${e.signer_name} <${e.signer_email}> - envelope ${e.id} - signed ${String(e.signed_at || "").replace("T", " ").slice(0, 19)} UTC - IP ${e.signer_ip || "-"} - document SHA-256 ${e.document_sha256} - signed SHA-256 ${e.signed_document_sha256}`, 8, f, 10));
  y -= 6; line("Audit trail", 11, b);
  events.forEach((a: any) => line(`${String(a.at).replace("T", " ").slice(0, 19)} UTC - ${a.action} - ${a.actor_role || ""} ${a.actor_email || ""}${a.ip ? " - IP " + a.ip : ""} - hash ${String(a.hash || "").slice(0, 16)}`, 7.5, f, 10));
  return await pdf.save();
}
async function archive(oa: any, last: any, envs: any[], ctx: Ctx | null) {
  const { data: f } = await admin.storage.from("documents").download(last.signed_document_path);
  const bytes = new Uint8Array(await f!.arrayBuffer());
  const day = now().slice(0, 10), base = `${oa.client_id}/${oa.company_id}/formation`;
  const name = `Operating-Agreement-signed-${day}-${oa.id.slice(0, 8)}.pdf`;
  const up = await admin.storage.from("client-docs").upload(`${base}/${name}`, bytes, { contentType: "application/pdf", upsert: true }); if (up.error) throw up.error;
  const sha = await sha256(bytes);
  const { data: doc } = await admin.from("company_documents").insert({ company_id: oa.company_id, client_id: oa.client_id, category: "formation", title: "Operating Agreement (signed)", year: +day.slice(0, 4),
    path: `${base}/${name}`, mime: "application/pdf", size_bytes: bytes.length, sha256: sha, visible_to_client: true, uploaded_by: null, uploaded_by_email: "Endeavor e-signature", note: "Signed by " + envs.map((e: any) => e.signer_name).join(", ") }).select("id").single();
  const { data: versions } = await admin.from("oa_versions").select("version, final, source, ai_provider, ai_model, ai_request_id, rules_version, pdf_sha256").eq("oa_id", oa.id).order("version");
  const { data: events } = await admin.from("audit_log").select("at, action, actor_role, actor_email, ip, hash").eq("company_id", oa.company_id).or(`entity_id.eq.${oa.id},action.like.esign.*`).order("id").limit(400);
  const ev = await evidencePdf(oa, envs, versions || [], events || []);
  const evName = `Operating-Agreement-evidence-${day}-${oa.id.slice(0, 8)}.pdf`;
  await admin.storage.from("client-docs").upload(`${base}/${evName}`, ev, { contentType: "application/pdf", upsert: true });
  const { data: evDoc } = await admin.from("company_documents").insert({ company_id: oa.company_id, client_id: oa.client_id, category: "compliance", title: "Operating Agreement - signature evidence", year: +day.slice(0, 4),
    path: `${base}/${evName}`, mime: "application/pdf", size_bytes: ev.length, sha256: await sha256(ev), visible_to_client: false, uploaded_by: null, uploaded_by_email: "Endeavor compliance" }).select("id").single();
  await setStatus(oa, "archived", "system", { archived_at: now(), final_document_id: doc?.id || null, evidence_document_id: evDoc?.id || null, final_sha256: sha });
  await audit(ctx, "oa.archived", oa, { document_id: doc?.id, evidence_document_id: evDoc?.id, final_sha256: sha });
  await bell("oa_archived", "Operating Agreement assinado e arquivado: " + (oa.companies?.legal_name || ""), "PDF final e evidências na pasta da empresa.", "#/clientes?id=" + oa.client_id + "&tab=documentos");
}

/* ---------------- actions ---------------- */
async function handle(req: Request, body: any) {
  const a = String(body.action || "");

  // public, idempotent: called by the signing page after a signature (and safe to call again)
  if (a === "envelope_signed") {
    const t = String(body.token || "");
    if (!/^[0-9a-f-]{36}$/i.test(t)) throw new Fail("not_found", 404);
    const { data: e } = await admin.from("envelopes").select("oa_id, status").eq("token", t).maybeSingle();
    if (!e?.oa_id || e.status !== "signed") return { ok: true };
    const oa = await advance(e.oa_id, null);
    return { ok: true, status: oa.status };
  }

  if (a === "rules_seed") { const c = await caller(req); if (!c.isAdmin) throw new Fail("forbidden", 403); return { ok: true, inserted: await seedRules() }; }

  const { oa, ctx } = await access(req, String(body.oa_id || ""), a.startsWith("admin_") ? "admin" : "any");
  const owner = ctx.role === "client_owner";
  const need = (cond: boolean, code = "invalid_state") => { if (!cond) throw new Fail(code, 409); };

  if (a === "get") {
    if (oa.status === "signing") await advance(oa.id, ctx).then((x) => Object.assign(oa, x));
    const st = oa.answers?.state || oa.state || oa.companies?.state;
    const rsInfo = (st ? await ruleSet(st) : null) || genericRules();
    const [{ data: versions }, { data: comments }] = await Promise.all([
      admin.from("oa_versions").select("id, version, final, created_at, source, ai_provider, ai_model, rules_version, pdf_sha256, pages, validation, note" + (ctx.role === "admin" ? ", content, prompt_sha256, ai_request_id, created_by" : ", content")).eq("oa_id", oa.id).order("version", { ascending: false }),
      admin.from("oa_comments").select("*").eq("oa_id", oa.id).order("at")]);
    const signers = (oa.signers || []).map((s: any) => ({ name: s.name, capacity: s.capacity, status: s.status, signed_at: s.signed_at || null, me: s.email === ctx.c.email, email: ctx.role === "admin" || s.email === ctx.c.email ? s.email : undefined }));
    return { oa: { ...oa, signers, answers: oa.answers, companies: undefined, clients: undefined }, company: oa.companies, client: { name: oa.clients?.name, language: oa.clients?.language },
      rules: rsInfo ? { ...rsInfo.rs, clauses: ctx.role === "admin" ? rsInfo.rs.clauses : undefined, approved: rsInfo.approved, rule_set_id: rsInfo.id } : null,
      versions: (versions || []).map((v: any) => ctx.role === "admin" || v.final || v.version === oa.version ? v : { ...v, content: undefined }), comments: comments || [], ai_configured: !!(ANTHROPIC || OPENAI), email_configured: !!RESEND, reviewer: ctx.c.isReviewer };
  }

  if (a === "pdf") {
    const q = admin.from("oa_versions").select("pdf_path, version, final").eq("oa_id", oa.id);
    const { data: v } = body.version ? await q.eq("version", +body.version).eq("final", !!body.final).maybeSingle() : await q.eq("version", oa.version).order("final", { ascending: false }).limit(1).maybeSingle();
    if (!v?.pdf_path) throw new Fail("not_found", 404);
    if (owner && !(v.version === oa.version && ["client_review", "approved", "signing", "signed", "archived"].includes(oa.status))) throw new Fail("forbidden", 403);
    const s = await admin.storage.from("documents").createSignedUrl(v.pdf_path, 300);
    await audit(ctx, "oa.pdf_view", oa, { version: v.version, final: v.final });
    return { url: s.data?.signedUrl };
  }

  if (a === "start") {
    need(owner, "owner_only"); need(oa.status === "pending_generation" || oa.status === "questionnaire");
    if (body.consent !== true) throw new Fail("consent_required");
    const consent = { type: "ai_drafting_and_data_use", version: CONSENT_VERSION, at: now(), by: ctx.c.email, ip: ctx.m.ip };
    if (oa.status === "questionnaire") return { ok: true };
    const pf = await prefill(oa);
    const st = String(pf.prefill.state || oa.state || "");
    const answers: Record<string, unknown> = {};
    for (const k of ["legal_name", "state", "filing_number", "formation_date", "principal_address", "registered_agent", "management", "fiscal_year"]) if (pf.prefill[k] != null) answers[k] = pf.prefill[k];
    if (answers.state && !R.STATES[answers.state as string]) answers.state = "other";
    await setStatus(oa, "questionnaire", ctx.c.email, { prefill: pf.prefill, prefill_sources: pf.sources, answers, state: st || oa.state, consents: [...(oa.consents || []), consent] });
    await audit(ctx, "oa.consent", oa, { consent: consent.type, version: CONSENT_VERSION });
    await audit(ctx, "oa.start", oa, { prefilled: Object.keys(pf.prefill), sources: pf.sources._articles_document ? "company_record+articles" : "company_record", articles_note: pf.sources._note });
    return { ok: true };
  }

  if (a === "save") {
    need(owner, "owner_only"); need(oa.status === "questionnaire");
    const rs = (await ruleSet(String(body.answers?.state || oa.answers?.state || oa.state || "FL")))?.rs || R.buildRuleSet("FL");
    const answers = sanitizeAnswers(rs, body.answers, oa.answers);
    await admin.from("operating_agreements").update({ answers }).eq("id", oa.id);
    await audit(ctx, "oa.answer", oa, { fields: Object.keys(body.answers || {}).slice(0, 30) });
    const ev = R.evaluate(R.STATES[answers.state] ? rs : R.buildRuleSet("FL"), answers, oa.prefill);
    return { ok: true, saved_at: now(), evaluation: ev };
  }

  if (a === "submit") {
    need(owner, "owner_only"); need(oa.status === "questionnaire");
    const st = String(oa.answers?.state || "");
    const rsInfo = R.STATES[st] ? await ruleSet(st) : null;
    const ev = R.evaluate(rsInfo ? rsInfo.rs : R.buildRuleSet("FL"), oa.answers, oa.prefill);
    if (ev.missing.length || ev.errors.length) throw new Fail("incomplete", 422, ev);
    const reasons = ev.review.slice();
    const consent = { type: "questionnaire_submitted", version: CONSENT_VERSION, at: now(), by: ctx.c.email, ip: ctx.m.ip };
    if (!rsInfo) {
      await setStatus(oa, "in_review", ctx.c.email, { issues: reasons.map((r: any) => ({ ...r, resolved: false })), review_required: true, consents: [...(oa.consents || []), consent] });
      await audit(ctx, "oa.submit", oa, { review_reasons: reasons.map((r: any) => r.code) });
      await bell("oa_review", "Revisão habilitada necessária: Operating Agreement · " + (oa.companies?.legal_name || ""), "Estado sem regras aprovadas.", "#/compliance?tab=oa&id=" + oa.id);
      return { ok: true, status: "in_review" };
    }
    await setStatus(oa, "drafting", ctx.c.email, { consents: [...(oa.consents || []), consent] });
    await audit(ctx, "oa.submit", oa, { review_reasons: reasons.map((r: any) => r.code) });
    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(draft(oa.id, { reasons, actor: ctx.c.email, ctx }));
    return { ok: true, status: "drafting" };
  }

  if (a === "comment") {
    need(owner, "owner_only"); need(oa.status === "client_review");
    const text = clip(body.body, 2000); if (!text) throw new Fail("comment_required");
    await admin.from("oa_comments").insert({ oa_id: oa.id, version: oa.version, author_email: ctx.c.email, author_role: "client_owner", section: clip(body.section, 40) || null, body: text });
    await audit(ctx, "oa.comment", oa, { section: clip(body.section, 40) || null, length: text.length });
    if (body.request_changes) {
      await setStatus(oa, "in_review", ctx.c.email);
      await audit(ctx, "oa.changes_requested", oa, {});
      await bell("oa_review", "Cliente pediu correções: " + (oa.companies?.legal_name || ""), text.slice(0, 300), "#/compliance?tab=oa&id=" + oa.id);
    }
    return { ok: true };
  }

  if (a === "approve") {
    need(owner, "owner_only"); need(oa.status === "client_review");
    if (body.consent !== true || clip(body.typed_name, 200).length < 3) throw new Fail("consent_required");
    const { data: cur } = await admin.from("oa_versions").select("*").eq("id", oa.current_version_id).single();
    const consent = { type: "final_version_approved", version: CONSENT_VERSION, at: now(), by: ctx.c.email, ip: ctx.m.ip, typed_name: clip(body.typed_name, 200), oa_version: oa.version, pdf_sha256: cur.pdf_sha256 };
    const pdf = await RENDER.render(PDFLib, cur.content, { footerLeft: "Final v" + oa.version, footerRight: "OA " + oa.id.slice(0, 8) });
    const sha = await sha256(pdf.bytes), path = `oa/${oa.id}/v${oa.version}-final.pdf`;
    const up = await admin.storage.from("documents").upload(path, pdf.bytes, { contentType: "application/pdf", upsert: true }); if (up.error) throw up.error;
    await admin.from("oa_versions").insert({ oa_id: oa.id, version: oa.version, final: true, source: cur.source, content: cur.content, pdf_path: path, pdf_sha256: sha, pages: pdf.pages, fields: pdf.fields,
      ai_provider: cur.ai_provider, ai_model: cur.ai_model, ai_request_id: cur.ai_request_id, prompt_sha256: cur.prompt_sha256, rules_version: cur.rules_version, rule_set_id: cur.rule_set_id, created_by: ctx.c.email, note: "Approved by client" });
    // signers: the approving owner first when they sign, then the order of the questionnaire
    let signers = R.signers(oa.answers).map((s: any) => ({ ...s, status: "pending" }));
    const mine = signers.findIndex((s: any) => s.email === ctx.c.email); if (mine > 0) signers = [signers[mine], ...signers.filter((_: any, i: number) => i !== mine)];
    const order = R.signers(oa.answers).map((s: any) => s.email);
    const fields = pdf.fields.map((f: any) => ({ ...f, signer: signers.findIndex((s: any) => s.email === order[f.signer]) }));
    await admin.from("oa_versions").update({ fields }).eq("oa_id", oa.id).eq("version", oa.version).eq("final", true);
    oa.signers = signers;
    await setStatus(oa, "approved", ctx.c.email, { approved_at: now(), approved_by_email: ctx.c.email, consents: [...(oa.consents || []), consent], signers });
    await audit(ctx, "oa.approve", oa, { final_pdf_sha256: sha, typed_name: consent.typed_name, signers: signers.length });
    const env = await createEnvelope(oa, 0, path, sha, fields);
    await setStatus(oa, "signing", "system");
    await audit(ctx, "oa.signature_requested", oa, { signer_index: 0, envelope_id: env.id });
    await bell("oa_client", "Operating Agreement aprovado pelo cliente: " + (oa.companies?.legal_name || ""), "Assinaturas em andamento (" + signers.length + " signatário(s)).", "#/compliance?tab=oa&id=" + oa.id);
    if (signers[0].email === ctx.c.email) return { ok: true, sign_url: signUrl(env.token, oa.clients?.language || "en") };
    await mailSigner(oa, signers[0], env);
    return { ok: true };
  }

  if (a === "sign_link") {
    need(oa.status === "signing");
    await advance(oa.id, ctx);
    const cur = await loadOA(oa.id);
    const i = cur.signers.findIndex((s: any) => s.status !== "signed");
    if (i < 0 || cur.signers[i].email !== ctx.c.email || !cur.signers[i].envelope_id) throw new Fail("not_your_turn", 403);
    const { data: env } = await admin.from("envelopes").select("token, status").eq("id", cur.signers[i].envelope_id).single();
    return { url: signUrl(env!.token, cur.clients?.language || "en") };
  }

  if (a === "resend") {
    need(oa.status === "signing");
    const i = oa.signers.findIndex((s: any) => s.status !== "signed"); if (i < 0) return { ok: true };
    const { data: env } = await admin.from("envelopes").select("*").eq("id", oa.signers[i].envelope_id).single();
    const sent = await mailSigner(oa, oa.signers[i], env);
    await audit(ctx, "oa.signature_resent", oa, { signer_index: i, emailed: sent });
    return { ok: true, emailed: sent };
  }

  /* ----- Endeavor (admin) ----- */
  if (a === "admin_regenerate") {
    need(["in_review", "client_review"].includes(oa.status));
    await setStatus(oa, "drafting", ctx.c.email);
    await audit(ctx, "oa.regenerate", oa, { note_length: clip(body.note, 4000).length });
    // @ts-ignore
    EdgeRuntime.waitUntil(draft(oa.id, { reasons: (oa.issues || []).filter((i: any) => !i.resolved), notes: clip(body.note, 4000), actor: ctx.c.email, ctx }));
    return { ok: true };
  }
  if (a === "admin_edit_section") {
    need(["in_review", "client_review"].includes(oa.status));
    const { data: cur } = await admin.from("oa_versions").select("content").eq("id", oa.current_version_id).single();
    const content = cur!.content; let hit = false;
    content.articles.forEach((ar: any) => ar.sections.forEach((s: any) => { if (s.rule === body.rule) { s.text = clip(body.text, 6000); s.edited_by = ctx.c.email; s.ai = false; hit = true; } }));
    if (!hit) throw new Fail("not_found", 404);
    const v = await newVersionFrom(oa, content, ctx.c.email, "Section " + body.rule + " edited", "edit");
    if (oa.status === "client_review") await setStatus(oa, "in_review", ctx.c.email);
    await audit(ctx, "oa.section_edited", oa, { rule: body.rule, version: v.version, pdf_sha256: v.sha });
    return { ok: true, version: v.version };
  }
  if (a === "admin_resolve_issue") {
    if (!ctx.c.isReviewer) throw new Fail("reviewer_required", 403);
    const idx = Number(body.index); const issues = (oa.issues || []).slice(); if (!issues[idx]) throw new Fail("not_found", 404);
    issues[idx] = { ...issues[idx], resolved: true, resolved_by: ctx.c.email, resolved_at: now(), note: clip(body.note, 1000) };
    await admin.from("operating_agreements").update({ issues }).eq("id", oa.id);
    await audit(ctx, "oa.issue_resolved", oa, { code: issues[idx].code, question: issues[idx].q, note: clip(body.note, 300) });
    return { ok: true };
  }
  if (a === "admin_resolve_comment") {
    await admin.from("oa_comments").update({ resolved_at: now(), resolved_by: ctx.c.email, resolution: clip(body.resolution, 2000) }).eq("id", +body.comment_id).eq("oa_id", oa.id);
    await audit(ctx, "oa.comment_resolved", oa, { comment_id: +body.comment_id });
    return { ok: true };
  }
  if (a === "admin_release") {
    need(oa.status === "in_review" && !!oa.current_version_id);
    const open = (oa.issues || []).filter((i: any) => !i.resolved);
    if (open.length) throw new Fail("issues_open", 409, open.map((i: any) => i.code));
    if (oa.review_required && !ctx.c.isReviewer) throw new Fail("reviewer_required", 403);
    const rsOk = oa.rule_set_id ? (await admin.from("oa_rule_sets").select("status").eq("id", oa.rule_set_id).single()).data?.status === "approved" : false;
    if (!rsOk && !ctx.c.isReviewer) throw new Fail("rules_not_approved", 409);
    await setStatus(oa, "client_review", ctx.c.email, { review_note: clip(body.note, 4000) || null });
    await audit(ctx, "oa.released_to_client", oa, { reviewer: ctx.c.isReviewer, rules_approved: rsOk });
    return { ok: true };
  }
  if (a === "admin_return") {
    need(["in_review", "client_review"].includes(oa.status));
    await setStatus(oa, "questionnaire", ctx.c.email, { review_note: clip(body.note, 4000) || null });
    await audit(ctx, "oa.returned_to_client", oa, { note_length: clip(body.note, 4000).length });
    return { ok: true };
  }
  if (a === "admin_cancel") {
    need(!["signed", "archived"].includes(oa.status));
    const { data: envs } = await admin.from("envelopes").select("id, status").eq("oa_id", oa.id);
    for (const e of envs || []) if (!["signed", "voided"].includes(e.status)) { await admin.from("envelopes").update({ status: "voided" }).eq("id", e.id); await admin.from("envelope_events").insert({ envelope_id: e.id, event: "voided", details: { by: ctx.c.email, reason: "oa_cancelled" } }); }
    await setStatus(oa, "cancelled", ctx.c.email, { review_note: clip(body.note, 4000) || null });
    await audit(ctx, "oa.cancelled", oa, { note: clip(body.note, 300) });
    return { ok: true };
  }
  if (a === "admin_restart") {
    need(oa.status === "cancelled");
    const { data: n } = await admin.from("operating_agreements").insert({ company_id: oa.company_id, client_id: oa.client_id, state: oa.state, status: "pending_generation", status_actor: ctx.c.email }).select("id").single();
    await audit(ctx, "oa.restarted", oa, { new_id: n?.id });
    return { ok: true, id: n?.id };
  }
  throw new Fail("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: true, ai: !!(ANTHROPIC || OPENAI), model: AI_MODEL, email: !!RESEND });
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try { return json(await handle(req, body)); }
  catch (e) {
    if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status);
    console.error(e); return json({ error: "server_error" }, 500);
  }
});
