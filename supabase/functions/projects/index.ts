// AI Projects — the AI Project Manager and the project pipeline.
// Client (portal, owner only): create a project, talk to the AI Project Manager, send files, ask for the proposal,
//   approve it (then pays the invoice), request changes, request updates, approve or reject what is on staging.
// Admin: review/adjust and send the proposal, quote paid updates, provision GitHub + Firebase, dispatch builds, rollback.
// GitHub Actions (x-booking-key header = PROJECTS_HOOK_KEY): read the brief, report tasks, staging, publish, usage.
// Rules: nothing is built before the payment is confirmed by Stripe; nothing goes to production without the client's approval.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { record } from "../_shared/ai-meter.ts";
import { hubExecute, hubOn, parseJsonLoose } from "../_shared/hub-ai.ts";
import { btn, esc, layout, sendMail } from "../payments/access-mail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const GH_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const GH_OWNER = Deno.env.get("GITHUB_OWNER") || "";
const HOOK_KEY = Deno.env.get("PROJECTS_HOOK_KEY") || "";
const GCP_SA = Deno.env.get("GCP_SA_KEY") || "";            // service account JSON that creates the clients' Firebase projects
const GCP_PARENT = Deno.env.get("GCP_PARENT") || "";        // e.g. folders/123 or organizations/456
const TEMPLATE_BASE = Deno.env.get("PROJECT_TEMPLATE_BASE") || "https://raw.githubusercontent.com/Bntouchnetwork/endeavor-website/main/project-template";
const SITE = (Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
const TEAM = "support@endeavorbiz.com";
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400, public detail?: string) { super(code); } }
// deno-lint-ignore no-explicit-any
type Any = any;
const now = () => new Date().toISOString();
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((c || 0) / 100);
const UUID = /^[0-9a-f-]{36}$/i;

async function event(project: string, kind: string, title: string, detail?: string | null, actor?: string) {
  await db.from("ai_project_events").insert({ project_id: project, kind, title: title.slice(0, 300), detail: detail ? String(detail).slice(0, 4000) : null, actor: actor || null });
}
async function bell(kind: string, title: string, body: string, link: string) {
  await db.from("admin_events").insert({ kind, title: title.slice(0, 300), body: body.slice(0, 2000), link });
}
async function team(subject: string, lines: string[], link: string) {
  try { await sendMail(TEAM, subject, layout(`<h2 style="margin:0 0 12px">${esc(subject)}</h2>${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join("")}${btn(`${SITE}/admin.html${link}`, "Abrir no console")}`), `${subject}\n\n${lines.join("\n")}`); } catch (e) { console.error("team mail", e); }
}
async function settings() { const { data } = await db.from("ai_limits").select("*").eq("id", 1).single(); return data || { project_hour_usd: 85, project_min_usd: 1500, update_price_usd: 450, monthly_cap_usd: 300, alert_pct: 80 }; }

// ---------------- AI Project Manager ----------------
// The AI Project Manager's instructions live in the HUB AI agent "project-manager". Each turn sends a [Project context]
// block (language, project, current plan, integrations) plus the conversation; the agent answers the client and appends
// the complete plan as JSON between <plan> and </plan>, which is saved here and never shown to the client.
function pmContext(p: Any, lang: string, connectors: Any[]) {
  const L = { pt: "Portuguese (Brazil)", en: "English", es: "Spanish" }[lang] || "Portuguese (Brazil)";
  return `[Project context]\nClient language: ${L}.\nProject: "${p.title}". Client's brief: ${p.brief || "(none yet)"}.\nRequirements captured: ${JSON.stringify(p.requirements || {})}.\nIntegrations available for this client: ${connectors.map((c) => c.name).join(", ") || "none yet"}.\nCurrent plan: ${JSON.stringify(p.scope || {})}.\n[/Project context]`;
}
async function pmTurn(p: Any, lang: string) {
  if (!hubOn()) throw new Fail("ai_not_configured", 503);
  const { data: msgs } = await db.from("ai_project_messages").select("role, content").eq("project_id", p.id).in("role", ["client", "pm", "admin"]).order("created_at").limit(60);
  const messages: Any[] = [];
  for (const m of msgs ?? []) {
    const role = m.role === "pm" ? "assistant" : "user";
    const text = m.role === "admin" ? `[Endeavor team note] ${m.content}` : m.content;
    if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += "\n\n" + text;
    else messages.push({ role, content: text });
  }
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", content: `New project: ${p.title}. ${p.brief || ""}` });
  const { data: conns } = await db.rpc("project_connectors_internal", { p_company: p.company_id });
  messages[0].content = pmContext(p, lang, conns || []) + "\n\n" + messages[0].content;
  const r = await hubExecute({ agent: "project-manager", messages, userId: `project:${p.id}`, idempotencyKey: `endeavor-pm-${p.id}-${crypto.randomUUID()}`, task: "project_scoping",
    maxOutputTokens: 5000, timeoutMs: 120_000, meter: { agent: "project-manager", project_id: p.id, client_id: p.client_id, company_id: p.company_id } });
  if (r.kind !== "ok") throw new Fail(r.kind === "limit" ? "ai_limit_reached" : "ai_error", r.kind === "limit" ? 409 : 502, "code" in r ? r.code : r.kind);
  const m = r.output.match(/<plan>([\s\S]*?)<\/plan>/i);
  const plan: Any = m ? parseJsonLoose(m[1]) ?? null : null;
  const reply = r.output.replace(/<plan>[\s\S]*?(<\/plan>|$)/gi, "").trim();
  if (plan) {
    const hours = (plan.phases || []).reduce((s: number, ph: Any) => s + (ph.tasks || []).reduce((t: number, k: Any) => t + (Number(k.hours) || 0), 0), 0);
    const s = await settings();
    const est = Math.max(Number(s.project_min_usd) * 100, Math.round(hours * Number(s.project_hour_usd) * 100));
    await db.from("ai_projects").update({ scope: { ...plan, hours, estimate_cents: est }, weeks: plan.weeks ? Math.max(1, Math.min(104, Math.round(plan.weeks))) : p.weeks, updated_at: now() }).eq("id", p.id);
  }
  if (reply) await db.from("ai_project_messages").insert({ project_id: p.id, role: "pm", content: reply.slice(0, 12000), author: "AI Project Manager" });
  return { reply, plan };
}

// ---------------- e-mails to the client ----------------
async function clientMail(p: Any, kind: "proposal" | "staging" | "published" | "quote" | "started", extra: Any = {}) {
  const { data: c } = await db.from("clients").select("name, primary_email, language").eq("id", p.client_id).single();
  if (!c?.primary_email) return;
  const lang = ["pt", "en", "es"].includes(c.language) ? c.language : "pt";
  const link = `${SITE}/client.html#/projetos?id=${p.id}`;
  const T: Record<string, Record<string, [string, string, string]>> = {
    proposal: { pt: ["Sua proposta está pronta", `A proposta do projeto "${p.title}" está no seu portal: escopo, prazo e valor. Você pode aprovar ou pedir ajustes.`, "Ver proposta"], en: ["Your proposal is ready", `The proposal for "${p.title}" is in your portal: scope, timeline and price. You can approve it or ask for changes.`, "View proposal"], es: ["Su propuesta está lista", `La propuesta del proyecto "${p.title}" está en su portal: alcance, plazo y valor. Puede aprobarla o pedir ajustes.`, "Ver propuesta"] },
    started: { pt: ["Pagamento confirmado: projeto iniciado", `Recebemos o pagamento e o cronograma de "${p.title}" começou. Você acompanha as tarefas no portal.`, "Acompanhar projeto"], en: ["Payment confirmed: project started", `We received the payment and the schedule of "${p.title}" has started. Follow the tasks in your portal.`, "Follow the project"], es: ["Pago confirmado: proyecto iniciado", `Recibimos el pago y el cronograma de "${p.title}" comenzó. Siga las tareas en su portal.`, "Seguir el proyecto"] },
    staging: { pt: ["Nova versão para você testar", `A versão "${extra.title || ""}" de "${p.title}" está no endereço de teste: ${extra.url || ""}. Teste e aprove ou peça ajustes no portal. Nada vai para o endereço oficial sem a sua aprovação.`, "Revisar versão"], en: ["A new version to test", `Version "${extra.title || ""}" of "${p.title}" is on the test address: ${extra.url || ""}. Test it and approve or ask for changes in your portal. Nothing goes live without your approval.`, "Review version"], es: ["Nueva versión para probar", `La versión "${extra.title || ""}" de "${p.title}" está en la dirección de prueba: ${extra.url || ""}. Pruebe y apruebe o pida ajustes en el portal. Nada se publica sin su aprobación.`, "Revisar versión"] },
    published: { pt: ["Publicado no endereço oficial", `A versão "${extra.title || ""}" de "${p.title}" foi publicada${extra.url ? " em " + extra.url : ""}.`, "Ver projeto"], en: ["Published on the official address", `Version "${extra.title || ""}" of "${p.title}" is live${extra.url ? " at " + extra.url : ""}.`, "View project"], es: ["Publicado en la dirección oficial", `La versión "${extra.title || ""}" de "${p.title}" fue publicada${extra.url ? " en " + extra.url : ""}.`, "Ver proyecto"] },
    quote: { pt: ["Orçamento da sua solicitação", `A solicitação "${extra.title || ""}" de "${p.title}" foi orçada em ${money(extra.price || 0)}. A fatura está no seu portal; o trabalho começa após o pagamento.`, "Ver no portal"], en: ["Quote for your request", `Request "${extra.title || ""}" of "${p.title}" was quoted at ${money(extra.price || 0)}. The invoice is in your portal; work starts after payment.`, "View in portal"], es: ["Presupuesto de su solicitud", `La solicitud "${extra.title || ""}" de "${p.title}" fue presupuestada en ${money(extra.price || 0)}. La factura está en su portal; el trabajo empieza tras el pago.`, "Ver en el portal"] },
  };
  const [subj, body, cta] = T[kind][lang];
  try { await sendMail(c.primary_email, subj, layout(`<p style="margin:0 0 12px">${esc(c.name)},</p><p style="margin:0 0 16px">${esc(body)}</p>${btn(link, cta)}`), `${body}\n\n${link}`); } catch (e) { console.error("client mail", e); }
}

// ---------------- GitHub ----------------
async function gh(method: string, path: string, body?: unknown) {
  if (!GH_TOKEN || !GH_OWNER) throw new Fail("github_not_configured", 503);
  const r = await fetch("https://api.github.com" + path, { method, headers: { Authorization: "Bearer " + GH_TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "endeavor-projects" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j: Any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Fail("github_error", 502, `${r.status} ${j?.message || ""}`.trim());
  return j;
}
const TEMPLATE_FILES = ["README.md", "CLAUDE.md", "firebase.json", "public/index.html", ".github/workflows/endeavor-build.yml", ".github/workflows/endeavor-promote.yml", ".github/workflows/endeavor-rollback.yml"];
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
function b64(s: string) { const bytes = new TextEncoder().encode(s); let bin = ""; bytes.forEach((b) => bin += String.fromCharCode(b)); return btoa(bin); }

// ---------------- Google Cloud / Firebase (one Firebase project per client) ----------------
async function gToken() {
  if (!GCP_SA) throw new Fail("firebase_not_configured", 503);
  const sa = JSON.parse(GCP_SA);
  const enc = (o: Any) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 })}`;
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  let bin = ""; sig.forEach((b) => bin += String.fromCharCode(b));
  const jwt = unsigned + "." + btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json(); if (!r.ok) throw new Fail("firebase_error", 502, j.error_description || j.error);
  return j.access_token as string;
}
async function gapi(token: string, method: string, url: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw new Fail("firebase_error", 502, `${r.status} ${j?.error?.message || ""}`);
  return { status: r.status, ...j };
}

// Provisioning advances step by step (each call does what is pending), so it survives the function time limit.
async function provision(p: Any, actor: string) {
  const st: Any = { ...(p.provision || {}) };
  const save = async (extra: Any = {}) => { await db.from("ai_projects").update({ provision: st, updated_at: now(), ...extra }).eq("id", p.id); Object.assign(p, extra); };
  const pid = p.firebase_project_id || `edv-${slug(p.title).slice(0, 18)}-${p.id.slice(0, 6)}`.replace(/-+/g, "-");
  // 1) Firebase project for this client (Google Cloud project + Firebase + staging/production hosting sites)
  if (!st.gcp_project) {
    if (!GCP_SA) { st.firebase = "Configure GCP_SA_KEY (and GCP_PARENT) in Supabase secrets, or enter an existing Firebase project ID."; await save(); return { done: false, pending: "firebase_not_configured", provision: st }; }
    const tk = await gToken();
    if (!st.gcp_op) {
      const op = await gapi(tk, "POST", "https://cloudresourcemanager.googleapis.com/v3/projects", { projectId: pid, displayName: p.title.slice(0, 30), ...(GCP_PARENT ? { parent: GCP_PARENT } : {}) });
      st.gcp_op = op.name || "exists"; await save({ firebase_project_id: pid }); await event(p.id, "provision", "Projeto Google Cloud criado", pid, actor);
    }
    st.gcp_project = true; await save();
  }
  if (!st.firebase_added) {
    const tk = await gToken();
    const r = await gapi(tk, "POST", `https://firebase.googleapis.com/v1beta1/projects/${p.firebase_project_id || pid}:addFirebase`, {});
    if (r.status !== 409 && r.name && !r.done) { const op = await gapi(tk, "GET", `https://firebase.googleapis.com/v1beta1/${r.name}`); if (!op.done) { st.firebase = "Adicionando Firebase…"; await save(); return { done: false, pending: "firebase_adding", provision: st }; } }
    st.firebase_added = true; await save(); await event(p.id, "provision", "Firebase ativado", p.firebase_project_id || pid, actor);
  }
  if (!st.sites) {
    const tk = await gToken(), fp = p.firebase_project_id || pid;
    await gapi(tk, "POST", `https://firebasehosting.googleapis.com/v1beta1/projects/${fp}/sites?siteId=${fp}-staging`, {});
    st.sites = true;
    await save({ staging_site: `${fp}-staging`, prod_site: fp, staging_url: p.staging_url || `https://${fp}-staging.web.app`, prod_url: p.prod_url || `https://${fp}.web.app` });
    await event(p.id, "provision", "Sites de teste e produção criados", `${fp}-staging.web.app · ${fp}.web.app`, actor);
  }
  if (!st.domains && (p.staging_domain || p.prod_domain)) {
    const tk = await gToken(), fp = p.firebase_project_id || pid, dns: Any[] = [];
    for (const [site, dom] of [[`${fp}-staging`, p.staging_domain], [fp, p.prod_domain]] as [string, string][]) {
      if (!dom) continue;
      const r = await gapi(tk, "POST", `https://firebasehosting.googleapis.com/v1beta1/projects/${fp}/sites/${site}/customDomains?customDomainId=${encodeURIComponent(dom)}`, {});
      dns.push({ domain: dom, records: r?.requiredDnsUpdates || r?.response?.requiredDnsUpdates || null });
    }
    st.domains = true; st.dns = dns; await save();
    await event(p.id, "provision", "Domínios adicionados no Firebase", "Configure os registros DNS mostrados no console.", actor);
  }
  // 2) GitHub repository with permanent branches main (production) and staging (test)
  if (!st.repo) {
    const name = `${slug(p.title)}-${p.id.slice(0, 6)}`;
    let repo: Any;
    try { repo = await gh("POST", `/orgs/${GH_OWNER}/repos`, { name, private: true, auto_init: true, description: `Endeavor AI Project: ${p.title}`.slice(0, 300) }); }
    catch (e) { if (e instanceof Fail && /404/.test(e.detail || "")) repo = await gh("POST", "/user/repos", { name, private: true, auto_init: true }); else throw e; }
    st.repo = true; await save({ repo_full_name: repo.full_name }); await event(p.id, "provision", "Repositório GitHub criado", repo.full_name, actor);
  }
  if (!st.files) {
    const fp = p.firebase_project_id || pid;
    for (const f of TEMPLATE_FILES) {
      const r = await fetch(`${TEMPLATE_BASE}/${f}`); if (!r.ok) throw new Fail("template_missing", 500, f);
      let content = await r.text();
      content = content.replaceAll("{{PROJECT_TITLE}}", p.title).replaceAll("{{PROJECT_ID}}", p.id).replaceAll("{{FIREBASE_PROJECT}}", fp);
      let sha: string | undefined; try { sha = (await gh("GET", `/repos/${p.repo_full_name}/contents/${f}`)).sha; } catch { sha = undefined; }
      await gh("PUT", `/repos/${p.repo_full_name}/contents/${f}`, { message: `Endeavor setup: ${f}`, content: b64(content), branch: "main", ...(sha ? { sha } : {}) });
    }
    const rc = JSON.stringify({ projects: { default: fp }, targets: { [fp]: { hosting: { staging: [`${fp}-staging`], production: [fp] } } } }, null, 2);
    await gh("PUT", `/repos/${p.repo_full_name}/contents/.firebaserc`, { message: "Endeavor setup: .firebaserc", content: b64(rc), branch: "main" }).catch(() => {});
    st.files = true; await save();
  }
  if (!st.staging_branch) {
    const ref = await gh("GET", `/repos/${p.repo_full_name}/git/ref/heads/main`);
    try { await gh("POST", `/repos/${p.repo_full_name}/git/refs`, { ref: "refs/heads/staging", sha: ref.object.sha }); } catch (e) { if (!(e instanceof Fail && /422/.test(e.detail || ""))) throw e; }
    st.staging_branch = true; await save(); await event(p.id, "provision", "Branches main (produção) e staging (teste) prontas", null, actor);
  }
  if (!st.vars) {
    const vars: Record<string, string> = { FIREBASE_PROJECT_ID: p.firebase_project_id || pid, ENDEAVOR_PROJECT_ID: p.id, ENDEAVOR_HOOK_URL: `${SUPABASE_URL}/functions/v1/projects`, STAGING_URL: p.staging_url || "", PROD_URL: p.prod_url || "" };
    for (const [k, v] of Object.entries(vars)) {
      try { await gh("POST", `/repos/${p.repo_full_name}/actions/variables`, { name: k, value: v || "-" }); }
      catch { await gh("PATCH", `/repos/${p.repo_full_name}/actions/variables/${k}`, { name: k, value: v || "-" }); }
    }
    st.vars = true; await save();
  }
  st.done = true; await save();
  return { done: true, provision: st };
}

async function dispatch(p: Any, rel: Any, workflow: string, inputs: Record<string, string>, actor: string) {
  if (!p.repo_full_name) throw new Fail("not_provisioned");
  await gh("POST", `/repos/${p.repo_full_name}/actions/workflows/${workflow}/dispatches`, { ref: "main", inputs });
  await event(p.id, "dispatch", `${workflow === "endeavor-build.yml" ? "Desenvolvimento iniciado" : workflow === "endeavor-promote.yml" ? "Publicação em produção iniciada" : "Rollback iniciado"}: ${rel.title}`, null, actor);
}
async function startBuild(p: Any, rel: Any, actor: string) {
  // usage limit of the project's agents (Hub AI)
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
  const { data: u } = await db.from("ai_usage").select("cost_usd").eq("project_id", p.id).gte("created_at", since.toISOString());
  const spent = (u ?? []).reduce((s: number, x: Any) => s + Number(x.cost_usd || 0), 0);
  if (p.ai_budget_cents && spent * 100 >= p.ai_budget_cents) {
    await bell("ai_limit", `Limite de IA atingido: ${p.title}`, `Gasto no mês US$ ${spent.toFixed(2)}. Aumente o limite do projeto para continuar.`, `#/projetos?id=${p.id}`);
    throw new Fail("ai_limit_reached", 409);
  }
  await db.from("ai_project_releases").update({ status: "building", error: null, updated_at: now() }).eq("id", rel.id);
  await db.from("ai_project_tasks").update({ status: "queued" }).eq("release_id", rel.id).in("status", ["todo", "failed"]);
  await db.from("ai_projects").update({ status: "in_progress", updated_at: now() }).eq("id", p.id);
  try { await dispatch(p, rel, "endeavor-build.yml", { release_id: rel.id }, actor); }
  catch (e) { await db.from("ai_project_releases").update({ status: "queued", error: e instanceof Fail ? `${e.code} ${e.detail || ""}` : String(e) }).eq("id", rel.id); throw e; }
}

// brief the development agent receives (fetched by the workflow, never stored in the repo)
async function brief(rel: Any, p: Any) {
  const { data: tasks } = await db.from("ai_project_tasks").select("id, phase, title, detail, status").eq("release_id", rel.id).order("position");
  const { data: files } = await db.from("ai_project_files").select("kind, title, path").eq("project_id", p.id);
  const signed: string[] = [];
  for (const f of files ?? []) { const { data } = await db.storage.from("client-docs").createSignedUrl(f.path, 3600); if (data) signed.push(`- ${f.kind}: ${f.title} → ${data.signedUrl}`); }
  return `# Endeavor AI Project: ${p.title}
Release ${rel.number} (${rel.kind}): ${rel.title}
${rel.request ? "Request from the client:\n" + rel.request + "\n" : ""}${rel.feedback ? "Feedback from the client on the last staging version (fix these):\n" + rel.feedback + "\n" : ""}
## Scope
${p.scope?.summary || p.brief || ""}
Out of scope: ${(p.scope?.out_of_scope || []).join("; ") || "—"}
Assumptions: ${(p.scope?.assumptions || []).join("; ") || "—"}
Requirements: ${JSON.stringify(p.requirements || {})}
Integrations requested: ${(p.connectors || []).join(", ") || "none"} (credentials are injected at runtime by Endeavor; never hard-code secrets).
## Tasks for this release
${(tasks ?? []).filter((t: Any) => t.status !== "done" && t.status !== "skipped").map((t: Any) => `- [${t.id}] ${t.phase ? t.phase + ": " : ""}${t.title}${t.detail ? " — " + t.detail : ""}`).join("\n") || "- Apply the request above."}
## Client files (links valid for 1 hour; download what you need into the repo, e.g. the logo)
${signed.join("\n") || "- none"}
## Rules
Work on the staging branch only. Keep the build output in dist/ (Firebase Hosting serves it). Write or update automated tests and make them pass. Report each task as done with the task id.`;
}

// ---------------- handlers ----------------
async function loadProject(id: string) {
  if (!UUID.test(id)) throw new Fail("bad_request");
  const { data: p } = await db.from("ai_projects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new Fail("not_found", 404);
  return p;
}
async function clientLang(clientId: string) { const { data } = await db.from("clients").select("language, name, primary_email").eq("id", clientId).single(); return data; }

async function nextRelease(p: Any) { const { data } = await db.from("ai_project_releases").select("number").eq("project_id", p.id).order("number", { ascending: false }).limit(1); return ((data ?? [])[0]?.number || 0) + 1; }

async function handleHook(body: Any) {
  // GitHub Actions callbacks
  const a = String(body.action || "");
  const { data: rel } = await db.from("ai_project_releases").select("*").eq("id", String(body.release_id || "")).maybeSingle();
  if (!rel) throw new Fail("not_found", 404);
  const p = await loadProject(rel.project_id);
  if (a === "brief") return { brief: await brief(rel, p), release: { id: rel.id, number: rel.number, title: rel.title }, staging_sha: rel.staging_sha, tag: rel.tag };
  if (a === "usage") { await record("dev-agent", String(body.model || "claude"), { input_tokens: body.input_tokens, output_tokens: body.output_tokens }, { project_id: p.id, client_id: p.client_id, company_id: p.company_id }); if (body.cost_usd) await db.from("ai_usage").update({ cost_usd: Number(body.cost_usd) }).eq("project_id", p.id).eq("agent", "dev-agent").order("id", { ascending: false }).limit(1); return { ok: true }; }
  if (a === "task") {
    const ids: string[] = (Array.isArray(body.done) ? body.done : []).filter((x: string) => UUID.test(x));
    if (ids.length) await db.from("ai_project_tasks").update({ status: "done", done_at: now(), run_url: body.run_url || null }).in("id", ids).eq("release_id", rel.id);
    return { ok: true };
  }
  if (a === "staging") {
    await db.from("ai_project_releases").update({ status: "staging", staging_url: body.url || p.staging_url, staging_sha: body.sha || null, run_url: body.run_url || null, updated_at: now() }).eq("id", rel.id);
    await db.from("ai_project_tasks").update({ status: "done", done_at: now() }).eq("release_id", rel.id).in("status", ["queued", "running"]);
    await db.from("ai_projects").update({ status: "staging_review", updated_at: now() }).eq("id", p.id);
    await event(p.id, "staging", `Versão ${rel.number} publicada no teste`, body.url || p.staging_url);
    await clientMail(p, "staging", { title: rel.title, url: body.url || p.staging_url });
    return { ok: true };
  }
  if (a === "published") {
    await db.from("ai_project_releases").update({ status: "published", prod_sha: body.sha || rel.staging_sha, tag: body.tag || null, published_at: now(), run_url: body.run_url || null, updated_at: now() }).eq("id", rel.id);
    await db.from("ai_projects").update({ status: "live", updated_at: now() }).eq("id", p.id);
    await event(p.id, "published", `Versão ${rel.number} publicada em produção`, body.tag || null);
    await clientMail(p, "published", { title: rel.title, url: p.prod_url });
    return { ok: true };
  }
  if (a === "rolled_back") {
    await db.from("ai_project_releases").update({ status: "rolled_back", updated_at: now() }).eq("project_id", p.id).eq("status", "published").gt("number", Number(body.to_number || 0));
    await event(p.id, "rollback", `Produção voltou para ${body.tag || "a versão anterior"}`);
    return { ok: true };
  }
  if (a === "failed") {
    await db.from("ai_project_releases").update({ status: "failed", error: String(body.error || "build failed").slice(0, 2000), run_url: body.run_url || null, updated_at: now() }).eq("id", rel.id);
    await bell("project_failed", `Falha no desenvolvimento: ${p.title}`, `Versão ${rel.number}: ${String(body.error || "").slice(0, 400)}`, `#/projetos?id=${p.id}`);
    await event(p.id, "failed", `Falha na versão ${rel.number}`, body.error || null);
    return { ok: true };
  }
  throw new Fail("unknown_action");
}

async function handlePaid(body: Any) {
  const { data: inv } = await db.from("invoices").select("id, status, ai_project_id, ai_release_id, paid_at").eq("id", String(body.invoice_id || "")).single();
  if (!inv || inv.status !== "paid" || !inv.ai_project_id) return { ok: false };
  const p = await loadProject(inv.ai_project_id);
  if (inv.ai_release_id) {
    const { data: rel } = await db.from("ai_project_releases").select("*").eq("id", inv.ai_release_id).single();
    if (rel && rel.status === "awaiting_payment") {
      await db.from("ai_project_releases").update({ status: "queued", updated_at: now() }).eq("id", rel.id);
      await event(p.id, "paid", `Pagamento confirmado: ${rel.title}`);
      try { await startBuild(p, rel, "stripe"); } catch (e) { console.error("build", e); }
    }
    return { ok: true };
  }
  if (p.paid_at) return { ok: true };
  // the confirmed payment activates the schedule: tasks get due dates from the phases
  await db.from("ai_projects").update({ paid_at: inv.paid_at || now(), status: "provisioning", updated_at: now() }).eq("id", p.id);
  const { data: rel } = await db.from("ai_project_releases").select("*").eq("project_id", p.id).eq("kind", "initial").maybeSingle();
  let start = new Date();
  const phases = p.scope?.phases || [];
  const { data: tasks } = await db.from("ai_project_tasks").select("id, phase").eq("project_id", p.id).order("position");
  for (const ph of phases) {
    const end = new Date(start.getTime() + Math.max(1, Number(ph.weeks) || 1) * 7 * 864e5);
    const ids = (tasks ?? []).filter((t: Any) => t.phase === ph.name).map((t: Any) => t.id);
    if (ids.length) await db.from("ai_project_tasks").update({ due_date: end.toISOString().slice(0, 10) }).in("id", ids);
    start = end;
  }
  await event(p.id, "paid", "Pagamento confirmado pelo Stripe: cronograma ativado");
  await clientMail(p, "started");
  await bell("project_paid", `Projeto pago: ${p.title}`, "O cronograma foi ativado. O provisionamento do GitHub e do Firebase começa agora.", `#/projetos?id=${p.id}`);
  try {
    let pr = await provision(p, "stripe");
    for (let i = 0; i < 4 && !pr.done && pr.pending === "firebase_adding"; i++) { await new Promise((r) => setTimeout(r, 8000)); pr = await provision(p, "stripe"); }
    if (pr.done && rel) { await db.from("ai_project_releases").update({ status: "queued" }).eq("id", rel.id); await startBuild(p, rel, "stripe"); }
  } catch (e) { console.error("provision", e); await event(p.id, "provision", "Provisionamento pendente", e instanceof Fail ? `${e.code} ${e.detail || ""}` : String(e)); }
  return { ok: true };
}

async function invoiceFor(p: Any, items: Any[], description: string, releaseId: string | null) {
  const { data: key } = await db.rpc("internal_hook_key");
  const r = await fetch(`${SUPABASE_URL}/functions/v1/payments`, { method: "POST", headers: { "Content-Type": "application/json", "x-booking-key": String(key || "") },
    body: JSON.stringify({ action: "project_invoice", client_id: p.client_id, items, description, ai_project_id: p.id, ai_release_id: releaseId }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Fail(j.error || "invoice_error", r.status || 502, j.detail);
  return j.invoice;
}

async function handleUser(req: Request, body: Any) {
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Fail("unauthorized", 401);
  const { data: isAdmin } = await user.rpc("is_admin");
  const who = u.user.email || "user";
  const a = String(body.action || "");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const asOwner = async (clientId: string) => { if (isAdmin) return; const { data: role } = await user.rpc("my_client_role", { p_client: clientId }); if (role !== "owner") throw new Fail("forbidden", 403); };

  if (a === "create") {
    const clientId = String(body.client_id || ""); await asOwner(clientId);
    const title = String(body.title || "").trim().slice(0, 160); if (title.length < 3) throw new Fail("invalid_title");
    let companyId = body.company_id && UUID.test(body.company_id) ? body.company_id : null;
    if (companyId) { const { data: co } = await db.from("companies").select("id").eq("id", companyId).eq("client_id", clientId).maybeSingle(); if (!co) companyId = null; }
    const req2 = { features: String(body.features || "").slice(0, 4000), integrations: String(body.integrations || "").slice(0, 2000), instructions: String(body.instructions || "").slice(0, 4000), users: String(body.users || "").slice(0, 1000), deadline: String(body.deadline || "").slice(0, 100), references: String(body.references || "").slice(0, 2000) };
    const conns = (Array.isArray(body.connectors) ? body.connectors : []).map(String).filter((k: string) => /^[a-z0-9_]{2,40}$/.test(k)).slice(0, 20);
    const s = await settings();
    const { data: p, error } = await db.from("ai_projects").insert({ client_id: clientId, company_id: companyId, title, brief: String(body.brief || "").slice(0, 8000), requirements: req2, connectors: conns, created_by: u.user.id, update_price_cents: Math.round(Number(s.update_price_usd) * 100) }).select("*").single();
    if (error) throw new Fail("db_error", 500, error.message);
    await event(p.id, "created", "Projeto solicitado", title, who);
    const first = [p.brief, req2.features && "Features: " + req2.features, req2.integrations && "Integrations: " + req2.integrations, conns.length && "Connectors: " + conns.join(", "), req2.instructions && "Instructions: " + req2.instructions, req2.users && "Users: " + req2.users, req2.deadline && "Deadline: " + req2.deadline, req2.references && "References: " + req2.references].filter(Boolean).join("\n");
    await db.from("ai_project_messages").insert({ project_id: p.id, role: "client", content: (first || title).slice(0, 12000), author: who });
    await bell("project_new", `Novo projeto: ${title}`, "O AI Project Manager está levantando os requisitos com o cliente.", `#/projetos?id=${p.id}`);
    let reply = "";
    try { const lang = (await clientLang(clientId))?.language || "pt"; reply = (await pmTurn(p, lang)).reply; } catch (e) { console.error("pm", e); }
    return { ok: true, id: p.id, reply };
  }

  if (a === "add_company") {
    // Add New Company (client owner): an existing company or one to be formed; Bookkeeping is an optional separate service
    const clientId = String(body.client_id || ""); await asOwner(clientId);
    const name = String(body.legal_name || "").trim().slice(0, 200); if (name.length < 2) throw new Fail("invalid_name");
    const state = /^[A-Z]{2}$/.test(String(body.state || "")) ? String(body.state) : null;
    const existing = body.existing === true;
    const books = body.bookkeeping === true;
    const { data: co, error } = await db.from("companies").insert({ client_id: clientId, legal_name: name, state, status: existing ? "active" : "in_formation", entity_type: ["llc", "llc_foreign", "corp", "other"].includes(body.entity_type) ? body.entity_type : "llc",
      ein: existing && /^\d{2}-?\d{7}$/.test(String(body.ein || "")) ? String(body.ein).replace("-", "") : null, books_service: books ? "requested" : "none", requested_by: u.user.id }).select("id, legal_name").single();
    if (error) throw new Fail("db_error", 500, error.message);
    const { data: cl } = await db.from("clients").select("name").eq("id", clientId).single();
    await bell("company_added", `Nova empresa cadastrada pelo cliente: ${name}`, `${cl?.name || ""} · ${existing ? "empresa existente" : "quer abrir"}${books ? " · pediu o serviço de Bookkeeping (enviar proposta da assinatura)" : ""}.`, `#/clientes?id=${clientId}`);
    if (books) await team(`Bookkeeping solicitado: ${name}`, [`Cliente: ${cl?.name || ""}.`, "Envie a proposta da assinatura de Bookkeeping (Pagamentos → Nova proposta, item mensal)."], `#/pagamentos?tab=nova-proposta&client=${clientId}`);
    return { ok: true, company: co };
  }

  const p = await loadProject(String(body.project_id || ""));
  await asOwner(p.client_id);
  const lang = (await clientLang(p.client_id))?.language || "pt";

  if (a === "message") {
    if (!["scoping", "changes_requested", "proposal_sent"].includes(p.status) && !isAdmin) throw new Fail("closed_for_scoping");
    const text = String(body.text || "").trim().slice(0, 6000); if (!text) throw new Fail("empty");
    await db.from("ai_project_messages").insert({ project_id: p.id, role: isAdmin && body.as_admin ? "admin" : "client", content: text, author: who });
    if (p.status === "proposal_sent" && !isAdmin) await db.from("ai_projects").update({ status: "scoping", updated_at: now() }).eq("id", p.id);
    const r = await pmTurn({ ...p }, lang);
    return { ok: true, reply: r.reply, ready: !!r.plan?.ready_for_proposal };
  }
  if (a === "file_url") {
    const mime = String(body.mime || ""), size = Number(body.size) || 0;
    const ext: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp", "application/zip": "zip", "text/plain": "txt", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx" };
    if (!ext[mime]) throw new Fail("invalid_type"); if (size <= 0 || size > 25 * 1024 * 1024) throw new Fail("too_big");
    const path = `${p.client_id}/projects/${p.id}/${crypto.randomUUID().slice(0, 8)}.${ext[mime]}`;
    const { data, error } = await db.storage.from("client-docs").createSignedUploadUrl(path);
    if (error) throw new Fail("storage_error", 500);
    return { url: data.signedUrl, path };
  }
  if (a === "file_confirm") {
    const path = String(body.path || ""); if (!path.startsWith(`${p.client_id}/projects/${p.id}/`)) throw new Fail("forbidden", 403);
    const kind = ["logo", "document", "design", "other"].includes(body.kind) ? body.kind : "document";
    await db.from("ai_project_files").insert({ project_id: p.id, client_id: p.client_id, kind, title: String(body.title || "file").slice(0, 200), path, mime: String(body.mime || "").slice(0, 100), size_bytes: Number(body.size) || null, uploaded_by: u.user.id });
    await event(p.id, "file", `Arquivo enviado: ${String(body.title || "").slice(0, 120)}`, kind, who);
    return { ok: true };
  }
  if (a === "file_delete") {
    const { data: f } = await db.from("ai_project_files").select("*").eq("id", String(body.file_id || "")).eq("project_id", p.id).maybeSingle();
    if (!f) throw new Fail("not_found", 404);
    await db.storage.from("client-docs").remove([f.path]); await db.from("ai_project_files").delete().eq("id", f.id);
    return { ok: true };
  }
  if (a === "file_view") {
    const { data: f } = await db.from("ai_project_files").select("path").eq("id", String(body.file_id || "")).eq("project_id", p.id).maybeSingle();
    if (!f) throw new Fail("not_found", 404);
    const { data } = await db.storage.from("client-docs").createSignedUrl(f.path, 300); return { url: data?.signedUrl };
  }
  if (a === "request_proposal") {
    if (!["scoping", "changes_requested"].includes(p.status)) throw new Fail("invalid_status");
    if (!p.scope?.phases?.length) throw new Fail("scope_incomplete");
    await db.from("ai_projects").update({ status: "proposal_review", updated_at: now() }).eq("id", p.id);
    await event(p.id, "proposal", "Cliente pediu a proposta", null, who);
    await bell("project_proposal", `Proposta para revisar: ${p.title}`, `Estimativa do AI Project Manager: ${money(p.scope?.estimate_cents || 0)}, ${p.weeks || "?"} semanas. Revise e envie ao cliente.`, `#/projetos?id=${p.id}`);
    await team(`Proposta de projeto para revisar: ${p.title}`, [`Estimativa: ${money(p.scope?.estimate_cents || 0)} · ${p.scope?.hours || 0} h · ${p.weeks || "?"} semanas.`], `#/projetos?id=${p.id}`);
    return { ok: true };
  }
  if (a === "approve_proposal") {
    if (p.status !== "proposal_sent") throw new Fail("invalid_status");
    const name = String(body.name || "").trim().slice(0, 200); if (name.length < 3 || body.agree !== true) throw new Fail("name_required");
    await db.from("ai_projects").update({ status: "awaiting_payment", client_approved_at: now(), client_approved_name: name, client_approved_ip: ip, updated_at: now() }).eq("id", p.id);
    // first release and its tasks (from the approved phases)
    let { data: rel } = await db.from("ai_project_releases").select("*").eq("project_id", p.id).eq("kind", "initial").maybeSingle();
    if (!rel) ({ data: rel } = await db.from("ai_project_releases").insert({ project_id: p.id, number: 1, kind: "initial", title: lang === "en" ? "First functional version" : lang === "es" ? "Primera versión funcional" : "Primeira versão funcional", status: "awaiting_payment", price_cents: p.price_cents || 0 }).select("*").single());
    await db.from("ai_project_tasks").delete().eq("project_id", p.id).eq("release_id", rel!.id);
    let pos = 0; const rows: Any[] = [];
    for (const ph of p.scope?.phases || []) for (const t of ph.tasks || []) rows.push({ project_id: p.id, release_id: rel!.id, phase: String(ph.name || "").slice(0, 120), position: pos++, title: String(t.title || "").slice(0, 200), detail: t.detail ? String(t.detail).slice(0, 4000) : null, hours: Number(t.hours) || null });
    if (rows.length) await db.from("ai_project_tasks").insert(rows);
    const inv = p.invoice_id ? (await db.from("invoices").select("id, number, hosted_invoice_url, status").eq("id", p.invoice_id).single()).data
      : await invoiceFor(p, [{ description: `${p.title} — ${lang === "en" ? "first functional version + 3 updates" : lang === "es" ? "primera versión funcional + 3 actualizaciones" : "primeira versão funcional + 3 atualizações"}`, amount_cents: p.price_cents, quantity: 1 }], p.title, null);
    await db.from("ai_projects").update({ invoice_id: inv.id }).eq("id", p.id);
    await db.from("ai_project_releases").update({ invoice_id: inv.id }).eq("id", rel!.id);
    await event(p.id, "approved", `Proposta aprovada por ${name}`, `IP ${ip || "—"}`, who);
    await bell("project_approved", `Proposta aprovada: ${p.title}`, `${name} aprovou. Fatura ${inv.number || ""} enviada; o desenvolvimento começa após o pagamento.`, `#/projetos?id=${p.id}`);
    return { ok: true, invoice: inv };
  }
  if (a === "request_changes") {
    if (p.status !== "proposal_sent") throw new Fail("invalid_status");
    const text = String(body.text || "").trim().slice(0, 4000); if (text.length < 3) throw new Fail("text_required");
    await db.from("ai_projects").update({ status: "changes_requested", change_request: text, updated_at: now() }).eq("id", p.id);
    await db.from("ai_project_messages").insert({ project_id: p.id, role: "client", content: text, author: who });
    await event(p.id, "changes", "Cliente pediu ajustes na proposta", text, who);
    await bell("project_changes", `Ajustes pedidos na proposta: ${p.title}`, text, `#/projetos?id=${p.id}`);
    let reply = ""; try { reply = (await pmTurn(p, lang)).reply; } catch (e) { console.error(e); }
    return { ok: true, reply };
  }
  if (a === "request_update") {
    if (!["live", "staging_review", "in_progress"].includes(p.status)) throw new Fail("invalid_status");
    const title = String(body.title || "").trim().slice(0, 200), request = String(body.request || "").trim().slice(0, 8000);
    if (title.length < 3 || request.length < 10) throw new Fail("text_required");
    const { data: used } = await db.from("ai_project_releases").select("id").eq("project_id", p.id).eq("kind", "included_update").neq("status", "cancelled");
    const included = (used ?? []).length < p.updates_included;
    const n = await nextRelease(p);
    const { data: rel } = await db.from("ai_project_releases").insert({ project_id: p.id, number: n, kind: included ? "included_update" : "paid_update", title, request, status: "quote_review", price_cents: included ? 0 : p.update_price_cents }).select("*").single();
    await event(p.id, "update", `Atualização solicitada: ${title}`, included ? "Incluída no pacote" : "Cobrada à parte", who);
    await bell("project_update", `Atualização solicitada: ${p.title}`, `${title}. ${included ? "Incluída no pacote (" + ((used ?? []).length + 1) + "/" + p.updates_included + ")." : "Fora do pacote: confirme o valor."} Revise se está dentro do escopo.`, `#/projetos?id=${p.id}`);
    return { ok: true, release: rel, included };
  }
  if (a === "release_feedback" || a === "release_approve") {
    const { data: rel } = await db.from("ai_project_releases").select("*").eq("id", String(body.release_id || "")).eq("project_id", p.id).single();
    if (!rel || rel.status !== "staging") throw new Fail("invalid_status");
    if (a === "release_feedback") {
      const text = String(body.text || "").trim().slice(0, 4000); if (text.length < 3) throw new Fail("text_required");
      await db.from("ai_project_releases").update({ status: "changes_requested", feedback: text, updated_at: now() }).eq("id", rel.id);
      await event(p.id, "feedback", `Ajustes pedidos na versão ${rel.number}`, text, who);
      try { await startBuild(p, { ...rel, feedback: text }, who); } catch (e) { console.error(e); await bell("project_feedback", `Ajustes na versão de teste: ${p.title}`, text, `#/projetos?id=${p.id}`); }
      return { ok: true };
    }
    const name = String(body.name || "").trim().slice(0, 200); if (name.length < 3 || body.agree !== true) throw new Fail("name_required");
    await db.from("ai_project_releases").update({ status: "publishing", approved_at: now(), approved_name: name, approved_ip: ip, updated_at: now() }).eq("id", rel.id);
    await event(p.id, "approved", `Versão ${rel.number} aprovada para produção por ${name}`, `IP ${ip || "—"}`, who);
    await dispatch(p, rel, "endeavor-promote.yml", { release_id: rel.id, sha: rel.staging_sha || "", tag: `release-${rel.number}` }, who);
    return { ok: true };
  }

  // ---------- admin ----------
  if (!isAdmin) throw new Fail("forbidden", 403);
  if (a === "send_proposal") {
    const price = Math.round(Number(body.price_cents)); if (!(price > 0)) throw new Fail("invalid_price");
    const upd: Any = { price_cents: price, weeks: Math.max(1, Math.min(104, Number(body.weeks) || p.weeks || 4)), updates_included: Math.max(0, Math.min(50, Number(body.updates_included ?? 3))),
      update_price_cents: Math.max(0, Math.round(Number(body.update_price_cents ?? p.update_price_cents))), proposal_note: body.note ? String(body.note).slice(0, 4000) : null, status: "proposal_sent", proposal_sent_at: now(), updated_at: now() };
    if (body.scope && typeof body.scope === "object") upd.scope = { ...p.scope, ...body.scope };
    if (body.ai_budget_cents != null) upd.ai_budget_cents = Math.max(0, Math.round(Number(body.ai_budget_cents)));
    await db.from("ai_projects").update(upd).eq("id", p.id);
    await event(p.id, "proposal", `Proposta enviada: ${money(price)}, ${upd.weeks} semanas`, null, who);
    await clientMail({ ...p, ...upd }, "proposal");
    return { ok: true };
  }
  if (a === "quote_release") {
    const { data: rel } = await db.from("ai_project_releases").select("*").eq("id", String(body.release_id || "")).eq("project_id", p.id).single();
    if (!rel || rel.status !== "quote_review") throw new Fail("invalid_status");
    const kind = ["included_update", "paid_update", "out_of_scope"].includes(body.kind) ? body.kind : rel.kind;
    const price = kind === "included_update" ? 0 : Math.round(Number(body.price_cents ?? rel.price_cents));
    if (kind !== "included_update" && !(price > 0)) throw new Fail("invalid_price");
    if (body.tasks && Array.isArray(body.tasks)) {
      await db.from("ai_project_tasks").delete().eq("release_id", rel.id);
      const rows = body.tasks.slice(0, 50).map((t: Any, i: number) => ({ project_id: p.id, release_id: rel.id, phase: `Versão ${rel.number}`, position: 1000 * rel.number + i, title: String(t.title || "").slice(0, 200), detail: t.detail ? String(t.detail).slice(0, 4000) : null, hours: Number(t.hours) || null })).filter((t: Any) => t.title);
      if (rows.length) await db.from("ai_project_tasks").insert(rows);
    } else {
      const { count } = await db.from("ai_project_tasks").select("id", { count: "exact", head: true }).eq("release_id", rel.id);
      if (!count) await db.from("ai_project_tasks").insert({ project_id: p.id, release_id: rel.id, phase: `Versão ${rel.number}`, position: 1000 * rel.number, title: rel.title.slice(0, 200), detail: rel.request });
    }
    if (kind === "included_update") {
      await db.from("ai_project_releases").update({ kind, price_cents: 0, status: "queued", updated_at: now() }).eq("id", rel.id);
      await event(p.id, "update", `Atualização ${rel.number} aprovada (incluída no pacote)`, null, who);
      try { await startBuild(p, rel, who); } catch (e) { return { ok: true, warning: e instanceof Fail ? e.code : String(e) }; }
      return { ok: true };
    }
    const inv = await invoiceFor(p, [{ description: `${p.title} — ${rel.title}`, amount_cents: price, quantity: 1 }], `${p.title}: ${rel.title}`, rel.id);
    await db.from("ai_project_releases").update({ kind, price_cents: price, status: "awaiting_payment", invoice_id: inv.id, updated_at: now() }).eq("id", rel.id);
    await event(p.id, "quote", `Orçamento enviado: ${rel.title} (${money(price)})`, null, who);
    await clientMail(p, "quote", { title: rel.title, price });
    return { ok: true, invoice: inv };
  }
  if (a === "cancel_release") {
    await db.from("ai_project_releases").update({ status: "cancelled", updated_at: now() }).eq("id", String(body.release_id || "")).eq("project_id", p.id).in("status", ["requested", "quote_review", "awaiting_payment", "queued", "failed"]);
    return { ok: true };
  }
  if (a === "set_infra") {
    const clean = (v: unknown) => v ? String(v).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").slice(0, 200) : null;
    const upd: Any = { staging_domain: clean(body.staging_domain), prod_domain: clean(body.prod_domain), updated_at: now() };
    if (body.firebase_project_id) upd.firebase_project_id = String(body.firebase_project_id).trim().toLowerCase().slice(0, 30);
    if (body.repo_full_name) upd.repo_full_name = String(body.repo_full_name).trim().slice(0, 140);
    if (upd.staging_domain) upd.staging_url = "https://" + upd.staging_domain;
    if (upd.prod_domain) upd.prod_url = "https://" + upd.prod_domain;
    if (body.ai_budget_cents != null) upd.ai_budget_cents = Math.max(0, Math.round(Number(body.ai_budget_cents)));
    await db.from("ai_projects").update(upd).eq("id", p.id);
    return { ok: true };
  }
  if (a === "provision") return await provision(p, who);
  if (a === "build") {
    if (!p.paid_at) throw new Fail("not_paid", 409);   // never build before the payment is confirmed
    const { data: rel } = await db.from("ai_project_releases").select("*").eq("id", String(body.release_id || "")).eq("project_id", p.id).single();
    if (!rel || !["queued", "failed", "changes_requested", "building"].includes(rel.status)) throw new Fail("invalid_status");
    if (rel.invoice_id && rel.kind !== "initial") { const { data: inv } = await db.from("invoices").select("status").eq("id", rel.invoice_id).single(); if (inv?.status !== "paid") throw new Fail("not_paid", 409); }
    await startBuild(p, rel, who); return { ok: true };
  }
  if (a === "rollback") {
    const { data: rel } = await db.from("ai_project_releases").select("*").eq("id", String(body.release_id || "")).eq("project_id", p.id).single();
    if (!rel?.tag || rel.status !== "published") throw new Fail("invalid_status");
    await dispatch(p, rel, "endeavor-rollback.yml", { release_id: rel.id, tag: rel.tag }, who);
    return { ok: true };
  }
  if (a === "pause" || a === "resume" || a === "cancel") {
    const st = a === "pause" ? "paused" : a === "cancel" ? "cancelled" : (p.paid_at ? "in_progress" : "scoping");
    await db.from("ai_projects").update({ status: st, updated_at: now() }).eq("id", p.id);
    await event(p.id, a, a === "pause" ? "Projeto pausado" : a === "cancel" ? "Projeto cancelado" : "Projeto retomado", null, who);
    return { ok: true };
  }
  throw new Fail("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try {
    const key = req.headers.get("x-booking-key") || "";
    if (body.action === "pm_turn") { // internal: re-run the AI Project Manager on a project (retry after an AI outage)
      const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: key });
      if (!ok) return json({ error: "forbidden" }, 403);
      const p = await loadProject(String(body.project_id || ""));
      return json(await pmTurn(p, (await clientLang(p.client_id))?.language || "pt"));
    }
    if (body.action === "paid") {
      const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: key });
      if (!ok) return json({ error: "forbidden" }, 403);
      return json(await handlePaid(body));
    }
    if (["brief", "usage", "task", "staging", "published", "rolled_back", "failed"].includes(body.action)) {
      if (!HOOK_KEY || key.length < 24 || key !== HOOK_KEY) return json({ error: "forbidden" }, 403);
      return json(await handleHook(body));
    }
    return json(await handleUser(req, body));
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status);
    console.error(e); return json({ error: "server_error" }, 500);
  }
});
