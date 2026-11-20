// LinkedIn Manager (função linkedin). Por EMPRESA: a página do LinkedIn (API oficial, Community Management), o calendário
// de posts, os comentários e a extensão do Chrome. Reúne o que o pedido chama de linkedin-oauth, linkedin-calendar,
// linkedin-publisher, linkedin-comments e linkedin-agent (uma função por módulo, como o resto da plataforma).
//
// Regras fixas:
//   - NADA é publicado sem aprovação do dono; respostas a comentários são MANUAIS por padrão.
//   - Tokens do LinkedIn só no Vault; nunca vão para o navegador.
//   - Mensagens privadas (DM) nunca são automáticas. Nada de promessa de resultado nem conselho jurídico/financeiro individual.
//   - A IA passa pelo Hub AI (agente linkedin-assistant), com o consumo medido.
//
// Painel (sessão + autenticador; admin → qualquer empresa; cliente → empresas em que é dono e que a Endeavor liberou):
//   li_painel | li_ajustes | li_atividade | li_liberar (admin) | li_oauth_inicio | li_pagina | li_desconectar
//   li_gerar | li_post_salvar | li_post_status | li_coment_salvar | li_coment_enviar | li_coment_ignorar
//   li_ext_conectar | li_ext_revogar
// Cron (x-booking-key): tick_publicar (5 min) | tick_comentarios (15 min)
// Extensão (body.token = código de conexão; só o hash fica no banco): ext_iniciar | ext_agente | ext_registrar
// GET /linkedin/oauth?code&state → volta do LinkedIn
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hubJson, hubOn } from "../_shared/hub-ai.ts";
import { assinar, conferir, FUSOS, horariosDaSemana, limparAjustes, limparResposta, oportunidade, palavrasChave, podeAutomatico, textoLinkedIn, utcDe, violacao, type Ajustes } from "./regras.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const APP = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
const LI_ID = Deno.env.get("LINKEDIN_CLIENT_ID") || "", LI_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET") || "";
const LI_REDIRECT = Deno.env.get("LINKEDIN_REDIRECT_URI") || `${SUPABASE_URL}/functions/v1/linkedin/oauth`;
const LI_VERSION = Deno.env.get("LINKEDIN_API_VERSION") || "202601";
const ESCOPOS = "w_organization_social r_organization_social rw_organization_admin";
const AGENTE = "linkedin-assistant";
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-booking-key", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
class Erro extends Error { constructor(msg: string, public status = 400, public code = "") { super(msg); } }
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "";
const NADA = "00000000-0000-0000-0000-000000000000";
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, " ").trim().slice(0, max);
const agora = () => new Date().toISOString();
const IDI = { pt: "Brazilian Portuguese", en: "English", es: "Spanish" } as Record<string, string>;
async function sha256(s: string) { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join(""); }

/* ---------------- empresa e permissão ---------------- */
type Emp = { id: string; client_id: string; nome: string; atividade: Any; interna: boolean; conta: Any; ajustes: Ajustes };
async function empresa(companyId: string, criar = false): Promise<Emp> {
  const { data: co } = await db.from("companies").select("id, client_id, legal_name, activity_code, clients(status)").eq("id", uuid(companyId) || NADA).maybeSingle();
  if (!co) throw new Erro("Empresa não encontrada.", 404);
  let { data: conta } = await db.from("linkedin_accounts").select("*").eq("company_id", co.id).maybeSingle();
  if (!conta && criar) { const r = await db.from("linkedin_accounts").insert({ company_id: co.id, client_id: co.client_id }).select("*").single(); conta = r.data; }
  const { data: at } = co.activity_code ? await db.from("business_activities").select("*").eq("code", co.activity_code).maybeSingle() : { data: null };
  return { id: co.id, client_id: co.client_id, nome: co.legal_name, atividade: at, interna: (co as Any).clients?.status === "internal", conta: conta || null, ajustes: limparAjustes(conta?.settings) };
}
async function quem(req: Request, b: Any) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === ANON) throw new Erro("Entre no portal para usar o LinkedIn Manager.", 401);
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) throw new Erro("Sessão expirada. Entre de novo.", 401);
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  if (aal !== "aal2") throw new Erro("Entre com o autenticador para usar o LinkedIn Manager.", 403);
  const { data: admin } = await user.rpc("is_admin");
  return { id: data.user.id as string, email: data.user.email || "", admin: !!admin, user };
}
/** admin: qualquer empresa. Cliente: só dono, e só se a Endeavor liberou. */
async function acesso(q: Awaited<ReturnType<typeof quem>>, companyId: string): Promise<Emp> {
  const e = await empresa(companyId, q.admin);
  if (q.admin) return e;
  const { data: papel } = await q.user.rpc("my_client_role", { p_client: e.client_id });
  if (papel !== "owner") throw new Erro("Só o dono da empresa usa o LinkedIn Manager.", 403);
  if (!e.conta?.enabled) throw new Erro("O LinkedIn Manager não está liberado para esta empresa. Fale com a Endeavor.", 403);
  return e;
}
async function registrar(e: Emp, origem: string, acao: string, o: { device?: string | null; lead?: boolean; detalhe?: string } = {}) {
  await db.from("linkedin_log").insert({ company_id: e.id, client_id: e.client_id, device_id: o.device || null, origem, acao, is_lead: !!o.lead, detalhe: o.detalhe ? o.detalhe.slice(0, 300) : null });
}

/* ---------------- LinkedIn (API oficial) ---------------- */
async function tokenDe(e: Emp): Promise<string> {
  const { data } = await db.rpc("li_token_get", { p_company: e.id });
  const t = Array.isArray(data) ? data[0] : data;
  if (!t?.access_token) throw new Erro("Conecte a página do LinkedIn em Configurações.", 409, "nao_conectado");
  const exp = e.conta?.token_expires_at ? new Date(e.conta.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() < 5 * 60000) {
    if (!t.refresh_token) { await db.from("linkedin_accounts").update({ status: "expired", updated_at: agora() }).eq("company_id", e.id); throw new Erro("A conexão com o LinkedIn expirou. Conecte de novo.", 409, "expirado"); }
    const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: LI_ID, client_secret: LI_SECRET }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) { await db.from("linkedin_accounts").update({ status: "expired", last_error: "refresh", updated_at: agora() }).eq("company_id", e.id); throw new Erro("A conexão com o LinkedIn expirou. Conecte de novo.", 409, "expirado"); }
    await db.rpc("li_token_set", { p_company: e.id, p_access: j.access_token, p_refresh: j.refresh_token || null, p_expires: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString() });
    return j.access_token;
  }
  return t.access_token;
}
async function li(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch("https://api.linkedin.com" + path, { method, headers: { Authorization: "Bearer " + token, "LinkedIn-Version": LI_VERSION, "X-Restli-Protocol-Version": "2.0.0", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j: Any = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  if (!r.ok) throw new Erro(`LinkedIn ${r.status}: ${String(j?.message || t).slice(0, 200)}`, 502, r.status === 401 ? "expirado" : "linkedin");
  return { j, id: r.headers.get("x-restli-id") || r.headers.get("x-linkedin-id") || "" };
}

/* ---------------- IA (Hub AI) ---------------- */
function perfil(e: Emp, a: Ajustes) {
  const at = e.atividade;
  return `Company: ${e.nome}. Business activity: ${at ? at.label_en : "not set (general small business)"}. Keywords and themes: ${palavrasChave(at?.keywords, a.palavras).join(", ") || "none"}.` +
    ` Links the company allows in invitations — WhatsApp: ${a.whatsapp || "none"}; booking: ${a.agenda || "none"}. Never invent links, prices, phone numbers or results.`;
}
async function ia(e: Emp, task: string, input: string, max = 3000): Promise<Any> {
  if (!hubOn()) throw new Erro("A IA ainda não está configurada (Hub AI).", 503, "ia");
  return await hubJson({ agent: AGENTE, userId: `linkedin:${e.id}`, idempotencyKey: `endeavor-li-${e.id}-${crypto.randomUUID()}`, task, input, maxOutputTokens: max, timeoutMs: 120_000,
    meter: { agent: "linkedin", client_id: e.interna ? null : e.client_id, company_id: e.id } as Any });
}

/* ---------------- calendário ---------------- */
async function gerarSemana(e: Emp) {
  const a = e.ajustes;
  const { data: futuros } = await db.from("linkedin_posts").select("scheduled_at").eq("company_id", e.id).in("status", ["draft", "approved"]).gte("scheduled_at", agora());
  const quando = horariosDaSemana(a, Date.now(), (futuros ?? []).map((p: Any) => p.scheduled_at));
  if (!quando.length) throw new Erro("A semana já está cheia: não há horário livre nos próximos 7 dias.", 409);
  const { data: antigos } = await db.from("linkedin_posts").select("theme").eq("company_id", e.id).neq("status", "rejected").order("created_at", { ascending: false }).limit(40);
  const temas = [...new Set((antigos ?? []).map((p: Any) => p.theme).filter(Boolean))];
  const o = await ia(e, "linkedin_calendar", `MODE: calendar\n${perfil(e, a)}\nWrite ${quando.length} LinkedIn company-page posts in ${IDI[a.idioma]}.\nThemes already used (do NOT repeat or rephrase them): ${temas.join(" | ") || "none yet"}.\n` +
    `Reply with ONLY JSON: {"posts":[{"theme":"short theme label","body":"post text"}]}`, 6000);
  const posts = (Array.isArray(o?.posts) ? o.posts : []).slice(0, quando.length);
  if (!posts.length) throw new Erro("A IA não devolveu os posts. Tente de novo.", 502, "ia");
  const rows = posts.map((p: Any, i: number) => ({ company_id: e.id, client_id: e.client_id, status: "draft", theme: txt(p.theme, 120) || null, body: txt(p.body, 3000) || "…", language: a.idioma, scheduled_at: quando[i].toISOString() }));
  const { data, error } = await db.from("linkedin_posts").insert(rows).select("*");
  if (error) throw new Erro("Não foi possível salvar os rascunhos.", 500);
  await registrar(e, "calendario", "sugerido", { detalhe: `${rows.length} rascunho(s)` });
  return data;
}
async function publicarDevidos() {
  const { data: devidos } = await db.from("linkedin_posts").select("*").eq("status", "approved").lte("scheduled_at", agora()).order("scheduled_at").limit(20);
  let ok = 0, falhas = 0;
  for (const p of devidos ?? []) {
    // trava: só um processo publica cada post
    const { data: meu } = await db.from("linkedin_posts").update({ attempts: (p.attempts || 0) + 1, updated_at: agora() }).eq("id", p.id).eq("status", "approved").eq("attempts", p.attempts || 0).select("id").maybeSingle();
    if (!meu) continue;
    try {
      const e = await empresa(p.company_id);
      if (!e.conta?.enabled || e.conta.status !== "connected" || !e.conta.org_urn) throw new Erro("Página do LinkedIn não conectada.", 409);
      const motivo = violacao(p.body);
      if (motivo) throw new Erro("Bloqueado pela regra de compliance: " + motivo + ". Edite o texto e aprove de novo.", 409);
      const r = await li(await tokenDe(e), "POST", "/rest/posts", { author: e.conta.org_urn, commentary: textoLinkedIn(p.body), visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false });
      await db.from("linkedin_posts").update({ status: "posted", posted_at: agora(), post_urn: r.id || null, error: null, updated_at: agora() }).eq("id", p.id);
      ok++;
    } catch (x) {
      const msg = x instanceof Error ? x.message : String(x);
      // falha passageira do LinkedIn: tenta de novo nas próximas rodadas (até 3); o resto vira "failed" para o dono ver
      const passageira = x instanceof Erro && x.code === "linkedin" && /LinkedIn (429|5\d\d)/.test(msg) && (p.attempts || 0) < 2;
      await db.from("linkedin_posts").update({ status: passageira ? "approved" : "failed", error: msg.slice(0, 500), updated_at: agora() }).eq("id", p.id);
      if (!passageira) { falhas++; await db.from("admin_events").insert({ kind: "linkedin", title: "LinkedIn: um post não foi publicado", body: msg.slice(0, 300), link: "#/linkedin" }); }
    }
  }
  return { publicados: ok, falhas };
}

/* ---------------- comentários ---------------- */
async function leadNoCRM(e: Emp, c: Any): Promise<{ lead_id?: string; ct_contact_id?: string }> {
  const nome = txt(c.author_name, 120) || "Contato do LinkedIn", nota = `Comentário no LinkedIn: "${String(c.body).slice(0, 500)}"\nAutor: ${c.author_urn || "—"}\nPost: ${c.post_urn}`;
  if (e.interna) {
    const { data } = await db.from("leads").insert({ name: nome, source: "linkedin", status: "new", kind: "lead", message: String(c.body).slice(0, 1000), notes: nota, language: e.ajustes.idioma }).select("id").single();
    return { lead_id: data?.id };
  }
  const { data } = await db.from("ct_contacts").insert({ client_id: e.client_id, name: nome, stage: "new", source: "linkedin", notes: nota.slice(0, 4000) }).select("id").single();
  return { ct_contact_id: data?.id };
}
async function responder(e: Emp, c: Any, quemEnviou: string) {
  const texto = limparResposta(c.reply, e.ajustes, !!c.is_lead);
  if (texto.length < 2) throw new Erro("Escreva a resposta antes de enviar.");
  const motivo = violacao(texto);
  if (motivo) throw new Erro("A resposta quebra a regra de compliance (" + motivo + "). Edite o texto.", 409, "compliance");
  const r = await li(await tokenDe(e), "POST", `/rest/socialActions/${encodeURIComponent(c.post_urn)}/comments`, { actor: e.conta.org_urn, object: c.post_urn, message: { text: texto }, parentComment: c.parent_urn || c.comment_urn });
  await db.from("linkedin_comments").update({ status: "replied", reply: texto, replied_at: agora(), replied_by: quemEnviou, reply_urn: r.id || r.j?.id || null, error: null }).eq("id", c.id);
}
async function lerComentarios() {
  const { data: contas } = await db.from("linkedin_accounts").select("company_id").eq("enabled", true).eq("status", "connected").limit(50);
  let novos = 0;
  for (const k of contas ?? []) {
    try {
      const e = await empresa(k.company_id), a = e.ajustes, token = await tokenDe(e);
      const { data: posts } = await db.from("linkedin_posts").select("id, post_urn, body").eq("company_id", e.id).eq("status", "posted").not("post_urn", "is", null).gte("posted_at", new Date(Date.now() - 21 * 86400000).toISOString()).order("posted_at", { ascending: false }).limit(15);
      const achados: Any[] = [];
      for (const p of posts ?? []) {
        const r = await li(token, "GET", `/rest/socialActions/${encodeURIComponent(p.post_urn)}/comments?count=50`);
        for (const el of r.j?.elements ?? []) {
          const urn = el.commentUrn || el["$URN"] || (el.id ? `urn:li:comment:(${p.post_urn},${el.id})` : "");
          if (!urn || el.actor === e.conta.org_urn) continue; // as respostas da própria página não entram
          achados.push({ post_id: p.id, post_urn: p.post_urn, post: p.body, comment_urn: urn, parent_urn: el.parentComment || null, author_urn: el.actor || null, body: txt(el.message?.text, 2000), commented_at: el.created?.time ? new Date(el.created.time).toISOString() : null });
        }
      }
      if (!achados.length) { await db.from("linkedin_accounts").update({ comments_checked_at: agora() }).eq("company_id", e.id); continue; }
      const { data: ja } = await db.from("linkedin_comments").select("comment_urn").eq("company_id", e.id).in("comment_urn", achados.map((x) => x.comment_urn));
      const vistos = new Set((ja ?? []).map((x: Any) => x.comment_urn));
      const frescos = achados.filter((x) => x.body && !vistos.has(x.comment_urn)).slice(0, 12);
      if (frescos.length) {
        let cls: Any[] = [];
        try {
          const o = await ia(e, "linkedin_comments", `MODE: comments\n${perfil(e, a)}\nFor each comment: decide if the person shows buying interest or asks for help (lead) and write the page's public reply in the language of the comment. ` +
            `Invite to WhatsApp or the booking link ONLY when lead is true and ONLY with the links above.\nComments:\n${frescos.map((c, i) => `#${i} on post "${String(c.post).slice(0, 200)}": ${c.body}`).join("\n")}\n` +
            `Reply with ONLY JSON: {"items":[{"i":0,"lead":true,"reason":"short reason","reply":"text"}]}`, 4000);
          cls = Array.isArray(o?.items) ? o.items : [];
        } catch (x) { console.error("li ia comentarios", x); }
        for (let i = 0; i < frescos.length; i++) {
          const c = frescos[i], it = cls.find((y) => Number(y.i) === i) || {};
          const lead = it.lead === true, reply = limparResposta(it.reply, a, lead);
          const { data: row, error } = await db.from("linkedin_comments").insert({ company_id: e.id, client_id: e.client_id, post_id: c.post_id, post_urn: c.post_urn, comment_urn: c.comment_urn, parent_urn: c.parent_urn,
            author_urn: c.author_urn, body: c.body, commented_at: c.commented_at, is_lead: lead, lead_reason: txt(it.reason, 200) || null, reply: reply || null }).select("*").single();
          if (error || !row) continue; // outro processo já gravou (unique)
          novos++;
          if (lead) { try { await db.from("linkedin_comments").update(await leadNoCRM(e, row)).eq("id", row.id); await registrar(e, "comentario", "lead", { lead: true }); } catch (x) { console.error("li lead", x); } }
          // modo automático (o dono ligou): responde sozinho se a resposta passa nas regras; senão fica para o dono
          if (a.modo_resposta === "auto" && reply && !violacao(reply)) { try { await responder(e, row, "automático"); } catch (x) { await db.from("linkedin_comments").update({ error: (x as Error).message.slice(0, 300) }).eq("id", row.id); } }
        }
      }
      await db.from("linkedin_accounts").update({ comments_checked_at: agora() }).eq("company_id", e.id);
    } catch (x) {
      const exp = x instanceof Erro && x.code === "expirado";
      await db.from("linkedin_accounts").update({ last_error: (x as Error).message.slice(0, 300), ...(exp ? { status: "expired" } : {}), updated_at: agora() }).eq("company_id", k.company_id);
    }
  }
  return { novos };
}

/* ---------------- OAuth ---------------- */
async function oauthVolta(u: URL): Promise<Response> {
  const st = await conferir(u.searchParams.get("state") || "", SERVICE, Date.now());
  const destino = (ok: string, admin: boolean) => Response.redirect(`${APP}/${admin ? "admin" : "client"}.html?li=${ok}#/linkedin`, 302);
  if (!st) return destino("estado", false);
  const admin = st.a === 1;
  if (u.searchParams.get("error") || !u.searchParams.get("code")) return destino("negado", admin);
  try {
    const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: u.searchParams.get("code")!, client_id: LI_ID, client_secret: LI_SECRET, redirect_uri: LI_REDIRECT }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error("token");
    const e = await empresa(String(st.c), true);
    const acl = await li(j.access_token, "GET", "/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=20");
    const orgs: { urn: string; nome: string }[] = [];
    for (const el of (acl.j?.elements ?? []).slice(0, 10)) {
      const urn = String(el.organization || ""), id = urn.split(":").pop();
      let nome = urn; try { nome = (await li(j.access_token, "GET", `/rest/organizations/${id}`)).j?.localizedName || urn; } catch { /* sem nome */ }
      if (urn) orgs.push({ urn, nome: String(nome).slice(0, 120) });
    }
    if (!orgs.length) { await db.from("linkedin_accounts").update({ status: "error", last_error: "sem_pagina", updated_at: agora() }).eq("company_id", e.id); return destino("sem_pagina", admin); }
    await db.rpc("li_token_set", { p_company: e.id, p_access: j.access_token, p_refresh: j.refresh_token || null, p_expires: new Date(Date.now() + (j.expires_in || 5184000) * 1000).toISOString() });
    await db.from("linkedin_accounts").update({ status: "connected", org_urn: orgs[0].urn, org_name: orgs[0].nome, last_error: null, settings: { ...(e.conta?.settings || {}), paginas: orgs }, updated_at: agora(), updated_by: String(st.e || "") }).eq("company_id", e.id);
    return destino("ok", admin);
  } catch (x) { console.error("li oauth", x); return destino("erro", admin); }
}

/* ---------------- painel ---------------- */
async function painel(req: Request, b: Any) {
  const q = await quem(req, b), acao = String(b.acao || "");
  if (acao === "li_empresas") { // empresas que a pessoa pode gerenciar
    if (q.admin) {
      const { data } = await db.from("companies").select("id, legal_name, client_id, activity_code, clients(name, status), linkedin_accounts(enabled, status, org_name)").order("legal_name").limit(500);
      return { admin: true, empresas: (data ?? []).map((c: Any) => ({ id: c.id, nome: c.legal_name, cliente: c.clients?.name, interna: c.clients?.status === "internal", atividade: c.activity_code, conta: Array.isArray(c.linkedin_accounts) ? c.linkedin_accounts[0] || null : c.linkedin_accounts || null })) };
    }
    const cid = uuid(b.clientId);
    const { data: papel } = await q.user.rpc("my_client_role", { p_client: cid || NADA });
    if (papel !== "owner") return { admin: false, empresas: [] };
    const { data } = await db.from("linkedin_accounts").select("company_id, enabled, status, org_name, companies(legal_name, activity_code)").eq("client_id", cid).eq("enabled", true);
    return { admin: false, empresas: (data ?? []).map((c: Any) => ({ id: c.company_id, nome: c.companies?.legal_name, atividade: c.companies?.activity_code, conta: { enabled: true, status: c.status, org_name: c.org_name } })) };
  }
  const e = await acesso(q, String(b.company_id || ""));
  const conta = () => e.conta ? { enabled: e.conta.enabled, status: e.conta.status, org_urn: e.conta.org_urn, org_name: e.conta.org_name, token_expires_at: e.conta.token_expires_at, last_error: e.conta.last_error, comments_checked_at: e.conta.comments_checked_at, paginas: e.conta.settings?.paginas || [] } : null;
  switch (acao) {
    case "li_painel": {
      const [posts, coment, ativ, devs, uso] = await Promise.all([
        db.from("linkedin_posts").select("*").eq("company_id", e.id).gte("scheduled_at", new Date(Date.now() - 14 * 86400000).toISOString()).order("scheduled_at").limit(120),
        db.from("linkedin_comments").select("*").eq("company_id", e.id).order("created_at", { ascending: false }).limit(80),
        db.from("business_activities").select("code, label_pt, label_en, label_es, keywords").order("sort"),
        db.from("linkedin_devices").select("id, nome, created_at, last_seen, revoked_at").eq("company_id", e.id).is("revoked_at", null),
        db.from("linkedin_log").select("id", { count: "exact", head: true }).eq("company_id", e.id).eq("acao", "enviado_auto").gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString())]);
      return { empresa: { id: e.id, nome: e.nome, atividade: e.atividade?.code || null, interna: e.interna }, conta: conta(), ajustes: e.ajustes, fusos: FUSOS, posts: posts.data ?? [], comentarios: coment.data ?? [], atividades: ativ.data ?? [],
        dispositivos: devs.data ?? [], enviados_hoje: uso.count || 0, config: { ia: hubOn(), linkedin: !!(LI_ID && LI_SECRET), redirect: LI_REDIRECT }, admin: q.admin };
    }
    case "li_ajustes": {
      const novo = limparAjustes(b.ajustes);
      await db.from("linkedin_accounts").update({ settings: { ...novo, paginas: e.conta?.settings?.paginas || [] }, updated_at: agora(), updated_by: q.email }).eq("company_id", e.id);
      return { ajustes: novo };
    }
    case "li_atividade": {
      const code = String(b.code || "");
      const { data: at } = await db.from("business_activities").select("code").eq("code", code).maybeSingle();
      if (!at) throw new Erro("Atividade inválida.");
      await db.from("companies").update({ activity_code: code, updated_at: agora() }).eq("id", e.id);
      return { ok: true };
    }
    case "li_liberar": {
      if (!q.admin) throw new Erro("Só a Endeavor libera o LinkedIn Manager.", 403);
      await db.from("linkedin_accounts").update({ enabled: b.enabled === true, updated_at: agora(), updated_by: q.email }).eq("company_id", e.id);
      return { ok: true };
    }
    case "li_oauth_inicio": {
      if (!LI_ID || !LI_SECRET) throw new Erro("O app do LinkedIn ainda não está configurado (LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET).", 503, "config");
      const state = await assinar({ c: e.id, u: q.id, e: q.email, a: q.admin ? 1 : 0, exp: Date.now() + 10 * 60000, n: crypto.randomUUID() }, SERVICE);
      return { url: "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({ response_type: "code", client_id: LI_ID, redirect_uri: LI_REDIRECT, state, scope: ESCOPOS }) };
    }
    case "li_pagina": {
      const p = (e.conta?.settings?.paginas || []).find((x: Any) => x.urn === b.urn);
      if (!p) throw new Erro("Página não encontrada.");
      await db.from("linkedin_accounts").update({ org_urn: p.urn, org_name: p.nome, updated_at: agora() }).eq("company_id", e.id);
      return { ok: true };
    }
    case "li_desconectar": {
      await db.rpc("li_token_set", { p_company: e.id, p_access: null, p_refresh: null, p_expires: null });
      await db.from("linkedin_accounts").update({ status: "not_connected", org_urn: null, org_name: null, updated_at: agora(), updated_by: q.email }).eq("company_id", e.id);
      return { ok: true };
    }
    case "li_gerar": return { posts: await gerarSemana(e) };
    case "li_post_salvar": {
      const { data: p } = await db.from("linkedin_posts").select("*").eq("id", uuid(b.id) || NADA).eq("company_id", e.id).maybeSingle();
      if (!p || p.status === "posted") throw new Erro("Este post não pode mais ser editado.", 409);
      const patch: Any = { updated_at: agora() };
      if (b.body !== undefined) { patch.body = txt(b.body, 3000); if (!patch.body) throw new Erro("O texto não pode ficar vazio."); }
      if (b.local !== undefined || b.scheduled_at !== undefined) { // "local" = data e hora no fuso da empresa (AAAA-MM-DDTHH:MM)
        const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(b.local || ""));
        const d = m ? utcDe(m[1], m[2], e.ajustes.fuso) : new Date(b.scheduled_at); if (isNaN(d.getTime()) || d.getTime() < Date.now() - 60000) throw new Erro("Escolha um horário no futuro."); patch.scheduled_at = d.toISOString(); }
      // editar um post aprovado volta para rascunho: o que vai ao ar é sempre o que foi aprovado
      if (p.status === "approved" || p.status === "failed") Object.assign(patch, { status: "draft", approved_by: null, approved_at: null, attempts: 0, error: null });
      const { data } = await db.from("linkedin_posts").update(patch).eq("id", p.id).select("*").single();
      return { post: data };
    }
    case "li_post_status": {
      const st = String(b.status || "");
      if (!["approved", "rejected", "draft"].includes(st)) throw new Erro("Situação inválida.");
      let alvo = db.from("linkedin_posts").select("*").eq("company_id", e.id);
      alvo = b.todos === true ? alvo.eq("status", "draft").gte("scheduled_at", agora()) : alvo.eq("id", uuid(b.id) || NADA).in("status", ["draft", "approved", "rejected", "failed"]);
      const { data: lista } = await alvo;
      const out: Any[] = [], barrados: Any[] = [];
      for (const p of lista ?? []) {
        if (st === "approved") {
          const motivo = violacao(p.body);
          if (motivo) { barrados.push({ id: p.id, motivo }); continue; }
          if (new Date(p.scheduled_at).getTime() < Date.now()) { barrados.push({ id: p.id, motivo: "horário no passado" }); continue; }
        }
        const { data } = await db.from("linkedin_posts").update({ status: st, approved_by: st === "approved" ? q.email : null, approved_at: st === "approved" ? agora() : null, attempts: 0, error: null, updated_at: agora() }).eq("id", p.id).select("*").single();
        if (data) out.push(data);
      }
      return { posts: out, barrados };
    }
    case "li_coment_salvar": case "li_coment_enviar": case "li_coment_ignorar": {
      const { data: c } = await db.from("linkedin_comments").select("*").eq("id", uuid(b.id) || NADA).eq("company_id", e.id).maybeSingle();
      if (!c || c.status === "replied") throw new Erro("Comentário não encontrado ou já respondido.", 409);
      if (acao === "li_coment_ignorar") { await db.from("linkedin_comments").update({ status: "ignored" }).eq("id", c.id); return { ok: true }; }
      if (b.reply !== undefined) { c.reply = txt(b.reply, 1200); await db.from("linkedin_comments").update({ reply: c.reply }).eq("id", c.id); }
      if (acao === "li_coment_enviar") await responder(e, c, q.email);
      return { ok: true };
    }
    case "li_ext_conectar": {
      const bts = crypto.getRandomValues(new Uint8Array(24));
      const codigo = "lim_" + btoa(String.fromCharCode(...bts)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await db.from("linkedin_devices").insert({ company_id: e.id, client_id: e.client_id, user_id: q.id, nome: txt(b.nome, 60) || "Chrome", token_hash: await sha256(codigo) });
      return { codigo, url: `${SUPABASE_URL}/functions/v1/linkedin` }; // o código aparece uma vez só
    }
    case "li_ext_revogar": { await db.from("linkedin_devices").update({ revoked_at: agora() }).eq("id", uuid(b.id) || NADA).eq("company_id", e.id); return { ok: true }; }
  }
  throw new Erro("Ação desconhecida.");
}

/* ---------------- extensão do Chrome ---------------- */
async function extensao(b: Any) {
  const t = String(b.token || "");
  if (!/^lim_[A-Za-z0-9_-]{20,64}$/.test(t)) throw new Erro("Extensão não conectada. Gere o código em LinkedIn Manager › Configurações.", 401);
  const { data: d } = await db.from("linkedin_devices").select("id, company_id, revoked_at").eq("token_hash", await sha256(t)).maybeSingle();
  if (!d || d.revoked_at) throw new Erro("Código inválido ou desligado. Gere outro no LinkedIn Manager.", 401);
  const e = await empresa(d.company_id), a = e.ajustes;
  if (!e.conta?.enabled) throw new Erro("O LinkedIn Manager não está liberado para esta empresa.", 403);
  await db.from("linkedin_devices").update({ last_seen: agora() }).eq("id", d.id);
  const hoje = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
  const usoHoje = async () => {
    const { data } = await db.from("linkedin_log").select("created_at").eq("company_id", e.id).eq("acao", "enviado_auto").gte("created_at", hoje).order("created_at", { ascending: false }).limit(60);
    return { n: (data ?? []).length, ultimo: data?.[0] ? new Date(data[0].created_at).getTime() : null };
  };
  const origem = ["feed", "grupo", "dm"].includes(b.origem) ? b.origem : "feed";
  switch (String(b.acao)) {
    case "ext_iniciar": { const u = await usoHoje(); return { empresa: e.nome, palavras: palavrasChave(e.atividade?.keywords, a.palavras), ext: a.ext, links: { whatsapp: a.whatsapp, agenda: a.agenda }, enviados_hoje: u.n }; }
    case "ext_agente": {
      const texto = txt(b.texto, 3000);
      if (texto.length < 8) throw new Erro("Texto curto demais.");
      const achou = oportunidade(texto, palavrasChave(e.atividade?.keywords, a.palavras));
      const o = await ia(e, "linkedin_extension", `MODE: extension (${origem === "dm" ? "private message — suggestion only, the owner sends it" : origem === "grupo" ? "group post" : "feed post"})\n${perfil(e, a)}\n` +
        `Matched keywords: ${achou.join(", ") || "none"}.\nText on screen (from ${txt(b.autor, 80) || "someone"}):\n${texto}\n` +
        `Write a short, helpful, human reply in the language of the text. Invite to WhatsApp or the booking link only if there is real interest.\nReply with ONLY JSON: {"lead":true|false,"reason":"short","reply":"text"}`, 1500);
      const lead = o?.lead === true, reply = limparResposta(o?.reply, a, lead), motivo = violacao(reply);
      const u = await usoHoje(), auto = podeAutomatico(a, origem, u.n, u.ultimo, Date.now());
      await registrar(e, origem, motivo ? "bloqueado" : "sugerido", { device: d.id, lead, detalhe: motivo || undefined });
      if (motivo || !reply) return { lead, reply: "", bloqueado: motivo || "sem resposta", auto: false };
      return { lead, reason: txt(o?.reason, 160), reply, auto: auto.ok, auto_motivo: auto.motivo, enviados_hoje: u.n, limite_dia: a.ext.limite_dia };
    }
    case "ext_registrar": {
      const ac = ["copiado", "colado", "enviado_auto", "ignorado"].includes(b.feito) ? b.feito : "ignorado";
      if (ac === "enviado_auto") { const u = await usoHoje(), p = podeAutomatico(a, origem, u.n, u.ultimo, Date.now()); if (!p.ok) throw new Erro("Envio automático não permitido agora (" + p.motivo + ").", 409); }
      await registrar(e, origem, ac, { device: d.id });
      return { ok: true };
    }
  }
  throw new Erro("Ação desconhecida.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);
  try {
    if (req.method === "GET") return /\/oauth\/?$/.test(u.pathname) ? await oauthVolta(u) : json({ ok: true, ia: hubOn(), linkedin: !!(LI_ID && LI_SECRET) });
    if (req.method !== "POST") return json({ erro: "method" }, 405);
    const b = await req.json().catch(() => ({}));
    const acao = String(b.acao || "");
    if (acao.startsWith("tick_")) {
      const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
      if (!ok) return json({ erro: "forbidden" }, 403);
      return json(acao === "tick_publicar" ? await publicarDevidos() : acao === "tick_comentarios" ? await lerComentarios() : { erro: "tick" });
    }
    if (acao.startsWith("ext_")) return json(await extensao(b));
    return json(await painel(req, b));
  } catch (x) {
    if (x instanceof Erro) return json({ erro: x.message, code: x.code || undefined }, x.status);
    console.error(x); return json({ erro: "Erro no servidor do LinkedIn Manager." }, 500);
  }
});
