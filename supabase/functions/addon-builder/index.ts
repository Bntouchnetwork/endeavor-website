// Fábrica de add-ons (Admin › Add-ons): plano B de manutenção da plataforma Endeavor, sem depender de uma assinatura pessoal.
// Super admin (JWT + aal2 + is_admin): conversa com a IA (agente "addon-builder" no Hub AI), gera numa branch de teste pelo
//   GitHub Actions (mesmo motor dos agentes do AI Projects), vê a prévia, aprova e publica, pede ajuste, descarta ou desfaz.
// GitHub Actions (x-booking-key = PROJECTS_HOOK_KEY): brief, usage, preview, reverted, failed.
// Regras: nada vai para o site sem aprovação; áreas sensíveis pedem confirmação digitada; limites de custo do Hub AI.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hubExecute, hubOn, parseJsonLoose } from "../_shared/hub-ai.ts";
import { chaveIgual, classificar, limparArquivos, limparPlano, podePublicar, ramo, situacaoCusto } from "./regras.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const GH_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const REPO = Deno.env.get("ADDONS_REPO") || "Bntouchnetwork/endeavor-website";
const HOOK_KEY = Deno.env.get("PROJECTS_HOOK_KEY") || "";
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400, public detail?: string) { super(code); } }
// deno-lint-ignore no-explicit-any
type Any = any;
const now = () => new Date().toISOString();
const UUID = /^[0-9a-f-]{36}$/i;
const AGENTES = ["addon-builder", "addon-dev"];

async function evento(id: string, kind: string, title: string, detail?: string | null, actor?: string | null, cost?: number) {
  await db.from("addon_build_events").insert({ build_id: id, kind, title: title.slice(0, 300), detail: detail ? String(detail).slice(0, 4000) : null, actor: actor || null, cost_usd: cost ?? null });
}
async function sino(title: string, body: string, id?: string) {
  await db.from("admin_events").insert({ kind: "addon_builder", title: title.slice(0, 300), body: body.slice(0, 2000), link: id ? `#/addons?id=${id}` : "#/addons" });
}
async function gh(method: string, path: string, body?: unknown) {
  if (!GH_TOKEN) throw new Fail("github_not_configured", 503);
  const r = await fetch("https://api.github.com" + path, { method, headers: { Authorization: "Bearer " + GH_TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "endeavor-addon-builder" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j: Any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Fail("github_error", 502, `${r.status} ${j?.message || ""}`.trim());
  return j;
}
async function limites() {
  const { data } = await db.from("ai_limits").select("*").eq("id", 1).maybeSingle();
  return { tarefa: Number(data?.addon_task_cap_usd ?? 15), mes: Number(data?.addon_monthly_cap_usd ?? 100), alerta: Number(data?.alert_pct ?? 80) };
}
async function gastoMes() {
  const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0);
  const { data } = await db.from("ai_usage").select("cost_usd").in("agent", AGENTES).gte("created_at", since.toISOString());
  return (data ?? []).reduce((s: number, x: Any) => s + Number(x.cost_usd || 0), 0);
}
async function carregar(id: string) {
  if (!UUID.test(id)) throw new Fail("bad_request");
  const { data } = await db.from("addon_builds").select("*").eq("id", id).maybeSingle();
  if (!data) throw new Fail("not_found", 404);
  return data;
}
async function salvar(id: string, patch: Record<string, unknown>) {
  const { data, error } = await db.from("addon_builds").update({ ...patch, updated_at: now() }).eq("id", id).select("*").single();
  if (error) throw new Fail("db_error", 500, error.message);
  return data;
}

// ---------------- conversa com a IA (só planeja; o código é escrito pelo agente no GitHub) ----------------
async function turnoIA(b: Any) {
  if (!hubOn()) throw new Fail("ai_not_configured", 503);
  const lim = await limites(), sit = situacaoCusto(await gastoMes(), lim.mes, lim.alerta);
  if (sit.bloqueado) throw new Fail("ai_limit_reached", 409);
  const { data: msgs } = await db.from("addon_build_messages").select("role, content").eq("build_id", b.id).in("role", ["admin", "ai"]).order("id").limit(60);
  const messages: Any[] = [];
  for (const m of msgs ?? []) {
    const role = m.role === "ai" ? "assistant" : "user";
    if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content += "\n\n" + m.content;
    else messages.push({ role, content: m.content });
  }
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", content: b.title });
  const ctx = `[Build context]\nRequest type: ${b.kind}. Title: "${b.title}". Status: ${b.status}.\nCurrent plan: ${JSON.stringify(b.plan || {})}.\n` +
    (b.summary ? `What the development agent did in the last run: ${b.summary}\n` : "") + (b.error ? `Last run failed: ${b.error}\n` : "") + "[/Build context]";
  messages[0].content = ctx + "\n\n" + messages[0].content;
  const r = await hubExecute({ agent: "addon-builder", messages, userId: `addon:${b.id}`, idempotencyKey: `endeavor-addon-${b.id}-${crypto.randomUUID()}`, task: "addon_planning",
    maxOutputTokens: 4000, timeoutMs: 120_000, meter: { agent: "addon-builder" } });
  if (r.kind !== "ok") throw new Fail(r.kind === "limit" ? "ai_limit_reached" : "ai_error", r.kind === "limit" ? 409 : 502, "code" in r ? r.code : r.kind);
  const m = r.output.match(/<plan>([\s\S]*?)<\/plan>/i);
  const bruto = m ? parseJsonLoose(m[1]) : null;
  const resposta = r.output.replace(/<plan>[\s\S]*?(<\/plan>|$)/gi, "").trim();
  let atual = b;
  if (bruto) {
    const plano = limparPlano(bruto) as Any;
    atual = await salvar(b.id, { plan: plano, kind: plano.kind, product_code: plano.product?.code || null, title: plano.title && b.status === "chatting" ? plano.title : b.title });
  }
  if (resposta) await db.from("addon_build_messages").insert({ build_id: b.id, role: "ai", content: resposta.slice(0, 12000), author: "IA" });
  if (sit.alerta) await sino("Fábrica de add-ons: custo do mês perto do limite", `Uso de ${sit.pct}% do limite mensal (US$ ${lim.mes}).`, b.id);
  return { reply: resposta, build: atual };
}

// ---------------- geração no GitHub (branch de teste + prévia) ----------------
async function gerar(b: Any, actor: string) {
  const lim = await limites(), sit = situacaoCusto(await gastoMes(), lim.mes, lim.alerta);
  if (sit.bloqueado) {
    await sino("Fábrica de add-ons: limite mensal atingido", `Gasto do mês chegou a US$ ${lim.mes}. Aumente o limite para continuar.`, b.id);
    throw new Fail("ai_limit_reached", 409);
  }
  if (Number(b.cost_usd || 0) >= lim.tarefa) throw new Fail("task_limit_reached", 409);
  const branch = b.branch || ramo(b.id);
  const atual = await salvar(b.id, { status: "queued", branch, error: null, runs: (b.runs || 0) + 1 });
  try {
    await gh("POST", `/repos/${REPO}/actions/workflows/addon-build.yml/dispatches`, { ref: "main", inputs: { build_id: b.id, branch } });
  } catch (e) {
    await salvar(b.id, { status: b.status === "preview" ? "preview" : "chatting", error: e instanceof Fail ? `${e.code} ${e.detail || ""}` : String(e) });
    throw e;
  }
  await evento(b.id, "dispatch", `Geração ${atual.runs} iniciada na branch de teste ${branch}`, null, actor);
  return atual;
}

// o que o agente de desenvolvimento recebe (buscado pelo workflow; não fica no repositório)
function brief(b: Any) {
  const p = b.plan || {};
  return `# Endeavor platform change: ${b.title}
Type: ${b.kind}. Run ${b.runs || 1} on branch ${b.branch}.
${p.summary ? "## What to build\n" + p.summary + "\n" : ""}${(p.tasks || []).length ? "## Tasks\n" + p.tasks.map((t: string) => "- " + t).join("\n") + "\n" : ""}${(p.files_likely || []).length ? "## Files likely involved\n" + p.files_likely.join(", ") + "\n" : ""}${(p.tests || []).length ? "## Tests\n" + p.tests.map((t: string) => "- " + t).join("\n") + "\n" : ""}${b.feedback ? "## Owner feedback on the last preview (fix these first)\n" + b.feedback + "\n" : ""}${p.product ? `## Store product
This is a new add-on with code "${p.product.code}" (category ${p.product.category}, billing ${p.product.interval}).
- Add its names/lead/features in PT, EN and ES to store-catalog.js (same shape as the other products). Names: ${JSON.stringify(p.product.names || {})}. Leads: ${JSON.stringify(p.product.leads || {})}.
- If the add-on has a screen in the client portal, add the view and its route so the portal Add-ons page "Abrir" button works (see TOOL_VIEW in client-tools.js).
- Do NOT insert the product in the database and do NOT set prices: on publish, the platform creates it hidden and the owner sets price and status in Admin › Pagamentos › Loja online.
` : ""}
## Rules (Endeavor platform)
- Plain HTML/CSS/JS (no framework, no build step); the site is served by GitHub Pages from main. Never push to main.
- Keep the change small and focused on this request. Do not refactor unrelated code.
- Never add or print secrets, keys, tokens or personal data. Keys live only in Supabase Secrets.
- Avoid supabase/ (server functions and migrations), payments (comprar.*, admin-payments.js, supabase/functions/payments), app-config.js, .github/ and CNAME. Touch them only if the request truly needs it and explain why in the summary: those changes need extra approval and, for server and database parts, a technical publication by the Endeavor team.
- Texts clients see: PT, EN and ES. Accessibility: labels, keyboard, contrast AA. Mobile first.
- Bump the ?v= cache-busting query of any JS/CSS file you change in the HTML pages that load it.
- Add or update automated tests when it makes sense (tests/*.test.ts run with deno test; node --check runs on every changed .js).
- At the end, write .endeavor/summary.md in Brazilian Portuguese: what changed, how to try it in the preview, and anything the owner must know (max 15 lines).`;
}

// ---------------- gancho do GitHub Actions ----------------
async function gancho(body: Any) {
  const a = String(body.action || "");
  const b = await carregar(String(body.build_id || ""));
  if (a === "brief") return { brief: brief(b), branch: b.branch, title: b.title };
  if (a === "usage") {
    const custo = Math.max(0, Number(body.cost_usd || 0));
    // o Claude Code informa o custo total da execução: grava uma linha com esse custo (Hub AI › consumo por agente)
    await db.from("ai_usage").insert({ agent: "addon-dev", model: String(body.model || "claude").slice(0, 80), input_tokens: Math.max(0, Math.round(Number(body.input_tokens) || 0)),
      output_tokens: Math.max(0, Math.round(Number(body.output_tokens) || 0)), cost_usd: custo, billable: false });
    const total = Number(b.cost_usd || 0) + custo;
    await salvar(b.id, { cost_usd: total });
    await evento(b.id, "usage", `Custo da geração: US$ ${custo.toFixed(2)}`, null, "github", custo);
    const lim = await limites();
    if (total >= lim.tarefa) await sino(`Add-on "${b.title}" passou do limite por tarefa`, `Gasto US$ ${total.toFixed(2)} (limite US$ ${lim.tarefa}). Novas gerações ficam bloqueadas até aumentar o limite.`, b.id);
    return { ok: true };
  }
  if (a === "building") { await salvar(b.id, { status: "building", run_url: body.run_url || null }); return { ok: true }; }
  if (a === "preview") {
    const files = limparArquivos(body.files), sens = classificar(files);
    let pr = b.pr_number;
    if (!pr && files.length) {
      try { const r = await gh("POST", `/repos/${REPO}/pulls`, { title: `[Add-ons] ${b.title}`, head: b.branch, base: "main", body: `Criado pela fábrica de add-ons (Admin › Add-ons). Só é publicado com a aprovação do super admin.\n\n${String(body.summary || "").slice(0, 3000)}` }); pr = r.number; }
      catch (e) { console.error("pr", e); }
    }
    await salvar(b.id, { status: "preview", preview_url: body.url || null, head_sha: body.sha || null, run_url: body.run_url || null, files, sensitive: sens, summary: String(body.summary || "").slice(0, 6000) || null, pr_number: pr || null, error: null, feedback: null });
    await evento(b.id, "preview", files.length ? `Prévia pronta: ${files.length} arquivo(s) mudado(s)` : "A geração terminou sem mudar arquivos", body.url || null, "github");
    await sino(`Prévia pronta: ${b.title}`, sens.length ? `Atenção: mexe em ${[...new Set(sens.map((s) => s.area))].join(", ")}.` : "Confira a prévia e aprove para publicar.", b.id);
    return { ok: true };
  }
  if (a === "reverted") {
    await salvar(b.id, { status: "reverted", reverted_at: now() });
    if (b.product_code) await db.from("store_products").update({ status: "hidden", updated_at: now() }).eq("code", b.product_code);
    await evento(b.id, "reverted", "Mudança desfeita: o site voltou à versão anterior", body.sha || null, "github");
    await sino(`Desfeito: ${b.title}`, "O site voltou à versão anterior.", b.id);
    return { ok: true };
  }
  if (a === "failed") {
    const voltar = b.status === "reverting" ? "published" : (b.pr_number ? "preview" : "chatting");
    await salvar(b.id, { status: b.status === "reverting" ? voltar : "failed", error: String(body.error || "falha").slice(0, 2000), run_url: body.run_url || null });
    await evento(b.id, "failed", b.status === "reverting" ? "Falha ao desfazer" : "Falha na geração", body.error || null, "github");
    await sino(`Falha: ${b.title}`, String(body.error || "").slice(0, 400), b.id);
    return { ok: true };
  }
  throw new Fail("unknown_action");
}

// ---------------- ações do super admin ----------------
async function admin(req: Request, body: Any) {
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Fail("unauthorized", 401);
  const { data: ok } = await user.rpc("is_admin"); // admins + autenticador (aal2)
  if (!ok) throw new Fail("forbidden", 403);
  const who = u.user.email || "admin";
  const a = String(body.action || "");

  if (a === "status") {
    const lim = await limites(), gasto = await gastoMes();
    let workflow: boolean | null = null;
    if (GH_TOKEN) { try { await gh("GET", `/repos/${REPO}/actions/workflows/addon-build.yml`); workflow = true; } catch { workflow = false; } }
    const falta: string[] = [];
    if (!hubOn()) falta.push("HUB_AI_API_KEY (Supabase › Edge Functions › Secrets): a conversa com a IA");
    if (!GH_TOKEN) falta.push("GITHUB_TOKEN (Supabase › Edge Functions › Secrets): token do GitHub com acesso ao repositório do site (Contents, Pull requests e Actions: leitura e escrita)");
    if (!HOOK_KEY) falta.push("PROJECTS_HOOK_KEY (Supabase › Edge Functions › Secrets): 24+ caracteres aleatórios, o mesmo valor do segredo ENDEAVOR_HOOK_KEY no GitHub");
    if (workflow === false) falta.push("Workflows addon-build.yml e addon-revert.yml na pasta .github/workflows do repositório");
    falta.push("No GitHub (repositório do site › Settings › Secrets and variables › Actions): segredos ANTHROPIC_API_KEY e ENDEAVOR_HOOK_KEY; variável ADDONS_HOOK_URL = https://onaewjlozioderwlvgfm.supabase.co/functions/v1/addon-builder");
    falta.push("Para a prévia com link: segredo GCP_SA_KEY e variável PREVIEW_FIREBASE_PROJECT (projeto Firebase só para prévias). Sem isso, a prévia é a lista de mudanças no GitHub");
    return { ai: hubOn(), github: !!GH_TOKEN, hook: !!HOOK_KEY, workflow, repo: REPO, limites: lim, gasto_mes: gasto, situacao: situacaoCusto(gasto, lim.mes, lim.alerta), falta };
  }
  if (a === "limits_save") {
    const tarefa = Number(body.task_cap), mes = Number(body.monthly_cap);
    if (!(tarefa >= 1 && tarefa <= 500 && mes >= 5 && mes <= 5000)) throw new Fail("bad_request");
    await db.from("ai_limits").update({ addon_task_cap_usd: tarefa, addon_monthly_cap_usd: mes, updated_at: now() }).eq("id", 1);
    return { ok: true };
  }
  if (a === "create") {
    const texto = String(body.text || "").trim().slice(0, 6000);
    const kind = ["addon", "change", "bugfix"].includes(body.kind) ? body.kind : "addon";
    if (texto.length < 5) throw new Fail("bad_request");
    const title = String(body.title || texto.split(/\n|\. /)[0]).trim().slice(0, 120) || "Novo add-on";
    const { data: b, error } = await db.from("addon_builds").insert({ title: title.length >= 2 ? title : "Novo add-on", kind, created_by: who }).select("*").single();
    if (error) throw new Fail("db_error", 500, error.message);
    await db.from("addon_build_messages").insert({ build_id: b.id, role: "admin", content: texto, author: who });
    await evento(b.id, "create", `Pedido criado (${kind === "addon" ? "novo add-on" : kind === "bugfix" ? "correção de bug" : "mudança"})`, null, who);
    try { const r = await turnoIA(b); return { id: b.id, ...r }; }
    catch (e) { return { id: b.id, build: b, ai_error: e instanceof Fail ? e.code : "ai_error" }; }
  }
  const b = await carregar(String(body.id || ""));
  if (a === "message") {
    if (["discarded", "reverted", "building", "queued", "publishing", "reverting"].includes(b.status)) throw new Fail("locked", 409);
    const texto = String(body.text || "").trim().slice(0, 6000);
    if (!texto) throw new Fail("bad_request");
    await db.from("addon_build_messages").insert({ build_id: b.id, role: "admin", content: texto, author: who });
    return await turnoIA(b);
  }
  if (a === "generate") {
    if (!["chatting", "failed", "preview"].includes(b.status)) throw new Fail("locked", 409);
    if (!b.plan || !b.plan.summary) throw new Fail("no_plan", 409);
    return { build: await gerar(b, who) };
  }
  if (a === "feedback") {
    if (b.status !== "preview") throw new Fail("locked", 409);
    const texto = String(body.text || "").trim().slice(0, 4000);
    if (texto.length < 3) throw new Fail("bad_request");
    await db.from("addon_build_messages").insert({ build_id: b.id, role: "admin", content: "Ajuste pedido na prévia: " + texto, author: who });
    await salvar(b.id, { feedback: texto });
    await evento(b.id, "feedback", "Ajuste pedido", texto, who);
    return { build: await gerar({ ...b, feedback: texto }, who) };
  }
  if (a === "publish") {
    const sens = Array.isArray(b.sensitive) ? b.sensitive : [];
    const pode = podePublicar(b.status, sens, body.confirm);
    if (!pode.ok) throw new Fail(pode.motivo, 409);
    if (!b.pr_number) throw new Fail("no_changes", 409);
    await salvar(b.id, { status: "publishing" });
    let merge: Any;
    try { merge = await gh("PUT", `/repos/${REPO}/pulls/${b.pr_number}/merge`, { merge_method: "squash", sha: b.head_sha || undefined, commit_title: `Add-ons: ${b.title} (#${b.pr_number})`, commit_message: `Aprovado por ${who} na fábrica de add-ons.` }); }
    catch (e) { await salvar(b.id, { status: "preview" }); throw e; }
    try { await gh("DELETE", `/repos/${REPO}/git/refs/heads/${b.branch}`); } catch { /* a branch pode ser apagada depois */ }
    const p = b.plan?.product;
    if (b.kind === "addon" && p?.code) {
      await db.from("store_products").upsert({ code: p.code, kind: "tool", price_cents: 0, setup_cents: 0, interval: p.interval || "month", currency: "usd", status: "hidden", sort: 90, category: p.category || "empresa", updated_at: now() }, { onConflict: "code", ignoreDuplicates: true });
    }
    const servidor = sens.some((s: Any) => s.servidor);
    const pub = await salvar(b.id, { status: "published", merge_sha: merge?.sha || null, approved_by: who, approved_at: now(), published_at: now() });
    await evento(b.id, "published", "Aprovado e publicado no site", servidor ? "Inclui servidor ou banco: a parte do servidor só vale depois da publicação técnica." : null, who);
    await sino(`Publicado: ${b.title}`, b.kind === "addon" && p?.code ? "Defina o preço e coloque à venda em Pagamentos › Loja online." : "O site atualiza em alguns minutos.", b.id);
    return { build: pub, server_pending: servidor };
  }
  if (a === "discard") {
    if (["published", "publishing", "reverting", "reverted", "discarded"].includes(b.status)) throw new Fail("locked", 409);
    if (b.pr_number) { try { await gh("PATCH", `/repos/${REPO}/pulls/${b.pr_number}`, { state: "closed" }); } catch (e) { console.error(e); } }
    if (b.branch) { try { await gh("DELETE", `/repos/${REPO}/git/refs/heads/${b.branch}`); } catch { /* já não existe */ } }
    const d = await salvar(b.id, { status: "discarded" });
    await evento(b.id, "discarded", "Descartado (nada foi publicado)", null, who);
    return { build: d };
  }
  if (a === "revert") {
    if (b.status !== "published" || !b.merge_sha) throw new Fail("locked", 409);
    await gh("POST", `/repos/${REPO}/actions/workflows/addon-revert.yml/dispatches`, { ref: "main", inputs: { build_id: b.id, sha: b.merge_sha } });
    const r = await salvar(b.id, { status: "reverting", reverted_by: who });
    await evento(b.id, "revert", "Desfazer pedido: voltando o site à versão anterior", null, who);
    return { build: r };
  }
  throw new Fail("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try {
    if (["brief", "usage", "building", "preview", "reverted", "failed"].includes(body.action)) {
      if (!chaveIgual(req.headers.get("x-booking-key") || "", HOOK_KEY) || HOOK_KEY.length < 24) return json({ error: "forbidden" }, 403);
      return json(await gancho(body));
    }
    return json(await admin(req, body));
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status);
    console.error(e); return json({ error: "server_error" }, 500);
  }
});
