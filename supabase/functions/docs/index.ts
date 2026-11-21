// Agente de documentos do CRM (função docs). Recebe os pedidos de documentos (crm_requests, criados pela IA do
// WhatsApp ou pela equipe) e, com o Google Drive da empresa conectado:
//   1. cria a pasta do cliente pelo modelo (subpastas, sempre com a Initial Docs);
//   2. manda o e-mail com a lista de documentos e o link seguro (docs.html?t=…) para enviar cada documento;
//   3. faz o follow-up: confere o que chegou e manda lembretes com o que falta (dias 2, 5, 9, 16, 23);
//   4. com tudo recebido, passa o pedido para "Em revisão" e avisa a equipe.
// Os arquivos vão do navegador do cliente DIRETO para o Google Drive da empresa (sessão de upload do Google): não passam
// nem ficam na Endeavor. A permissão do Google é a mínima (drive.file: só as pastas que o app cria). Nenhum documento é lido.
//
// Painel (sessão do admin ou do titular da empresa; clientId para empresa cliente):
//   doc_status | google_conectar | google_desconectar | pedido_enviar { id } | pedido_reenviar { id, email? }
// Interno (x-interno = service role; a função whatsapp chama): processar { id, reenviar? }
// Agendado (x-booking-key, a cada 10 min): tick
// Público (página docs.html): pub_info { t } | pub_sessao { t, doc, nome, tipo, tamanho } | pub_confirmar { t, doc, file_id }
// GET /docs/google-callback: retorno do consentimento do Google.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarEmail, type Marca, SITE } from "../_shared/mail.ts";
import { arquivoOk, faltando, followupDevido, lang, nomeArquivo, nomePasta, nomeSeguro, recebidosDosArquivos, textos } from "./regras.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const G_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "", G_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REDIRECT = `${SUPABASE_URL}/functions/v1/docs/google-callback`;
const ESCOPOS = "openid email https://www.googleapis.com/auth/drive.file";
const ORIGENS = [SITE, "https://www.endeavorbiz.com", "http://localhost:8092"];
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-interno", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "";
const NADA = "00000000-0000-0000-0000-000000000000";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const agora = () => new Date().toISOString();
const googleOn = () => !!(G_ID && G_SECRET);
const aleatorio = (n = 24) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* ---------------- empresa e marca ---------------- */
type Conta = { conta: string; clientId: string | null; endeavor: boolean; nome: string; email: string | null };
async function contaDe(conta: string): Promise<Conta> {
  if (conta === "endeavor") return { conta, clientId: null, endeavor: true, nome: "Endeavor Business Hub", email: null };
  const { data } = await db.from("clients").select("id, name, primary_email").eq("id", uuid(conta) || NADA).maybeSingle();
  if (!data) throw new Erro("Empresa não encontrada.", 404);
  return { conta: data.id, clientId: data.id, endeavor: false, nome: data.name || "Empresa", email: data.primary_email || null };
}
const marca = (k: Conta): Marca => ({ endeavor: k.endeavor, nome: k.nome, replyTo: k.endeavor ? null : k.email });
async function sino(title: string, body: string, link: string) {
  await db.from("admin_events").insert({ kind: "docs", title: title.slice(0, 300), body: body.slice(0, 2000), link: link.slice(0, 300) }).then(() => { }, () => { });
}
async function evento(p: Any, texto: string, extra: Any = {}) {
  const eventos = [...(p.eventos || []), { em: agora(), evento: texto }].slice(-60);
  await db.from("crm_requests").update({ eventos, updated_at: agora(), ...extra }).eq("id", p.id);
  p.eventos = eventos; Object.assign(p, extra);
}

/* ---------------- quem pede (painel) ---------------- */
async function quemNoPainel(req: Request, b: Any) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt || jwt === ANON) throw new Erro("Entre no portal.", 401);
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) throw new Erro("Sessão expirada. Entre de novo.", 401);
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  if (aal !== "aal2") throw new Erro("Entre com o autenticador.", 403);
  const { data: admin } = await user.rpc("is_admin");
  const clientId = uuid(b.clientId);
  if (admin) return { id: data.user.id as string, email: data.user.email || "", dono: true, conta: await contaDe(clientId || "endeavor") };
  if (!clientId) throw new Erro("Sem acesso.", 403);
  const { data: papel } = await user.rpc("my_client_role", { p_client: clientId });
  if (!papel) throw new Erro("Sem acesso a esta empresa.", 403);
  const { data: acesso } = await db.from("wa_access").select("enabled").eq("client_id", clientId).maybeSingle();
  if (!acesso?.enabled) throw new Erro("O WhatsApp Manager não está liberado para esta empresa.", 403);
  return { id: data.user.id as string, email: data.user.email || "", dono: papel === "owner", conta: await contaDe(clientId) };
}

/* ================================================================ Google Drive ================================================================ */
const tokens = new Map<string, { at: string; ate: number }>();
async function acesso(conta: string) {
  const c = tokens.get(conta);
  if (c && c.ate > Date.now() + 60_000) return c.at;
  const { data: refresh } = await db.rpc("storage_get_secret", { p_conta: conta });
  if (!refresh) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: G_ID, client_secret: G_SECRET, refresh_token: String(refresh), grant_type: "refresh_token" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    await db.from("storage_connections").update({ status: "erro", erro: String(j.error_description || j.error || r.status).slice(0, 300), updated_at: agora() }).eq("conta", conta);
    await sino("Google Drive desconectado", `O acesso ao Google Drive da conta ${conta === "endeavor" ? "Endeavor" : conta} parou de funcionar. Conecte de novo em WhatsApp Manager › Pedidos ao CRM.`, "#/whatsapp?aba=pedidos");
    return null;
  }
  tokens.set(conta, { at: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 });
  return j.access_token as string;
}
async function drive(at: string, caminho: string, init: RequestInit = {}) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${caminho}`, { ...init, headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Erro("Google Drive: " + (j?.error?.message || r.status), 502);
  return j;
}
const criarPasta = (at: string, nome: string, pai?: string) =>
  drive(at, "files?fields=id,webViewLink&supportsAllDrives=true", { method: "POST", body: JSON.stringify({ name: nomeSeguro(nome, 150), mimeType: "application/vnd.google-apps.folder", ...(pai ? { parents: [pai] } : {}) }) });
async function raiz(at: string, k: Conta) {
  const { data: s } = await db.from("storage_connections").select("root_folder_id").eq("conta", k.conta).maybeSingle();
  if (s?.root_folder_id) {
    try { const f = await drive(at, `files/${s.root_folder_id}?fields=id,trashed`); if (!f.trashed) return s.root_folder_id as string; } catch { /* recria */ }
  }
  const f = await criarPasta(at, `${k.nome} · Documentos de clientes`);
  await db.from("storage_connections").update({ root_folder_id: f.id, updated_at: agora() }).eq("conta", k.conta);
  return f.id as string;
}
async function arquivosDa(at: string, pasta: string) {
  const q = encodeURIComponent(`'${pasta}' in parents and trashed=false`);
  const j = await drive(at, `files?q=${q}&fields=files(id,name,createdTime)&pageSize=200`);
  return (j.files || []) as { id: string; name: string; createdTime: string }[];
}

/* ================================================================ processar um pedido ================================================================ */
const linkEnvio = (p: Any) => `${SITE}/docs.html?t=${p.upload_token}&lang=${lang(p.idioma)}`;
async function prepararPasta(p: Any, k: Conta, at: string) {
  if (p.pasta?.initial_docs_id) return p.pasta;
  const pai = await raiz(at, k);
  const pasta = await criarPasta(at, nomePasta(p.nome, p.modelo, new Date(p.created_at)), pai);
  const subs: Record<string, string> = {};
  const nomes: string[] = (p.subpastas?.length ? p.subpastas : ["Initial Docs"]);
  if (!nomes.some((n) => n.toLowerCase() === "initial docs")) nomes.unshift("Initial Docs");
  for (const n of nomes) subs[n] = (await criarPasta(at, n, pasta.id)).id;
  const initial = subs[nomes.find((n) => n.toLowerCase() === "initial docs")!];
  const dados = { provider: "google", pasta_id: pasta.id, link: pasta.webViewLink || null, initial_docs_id: initial, subpastas: subs };
  await evento(p, "pasta criada no Google Drive pelo modelo", { pasta: dados, upload_token: p.upload_token || aleatorio(24) });
  return dados;
}
/** Cria a pasta (se preciso) e manda o e-mail com a lista. reenvio: manda de novo (para o e-mail atual do pedido). */
async function processar(p: Any, reenvio = false): Promise<{ ok: boolean; motivo?: string }> {
  if (p.tipo !== "documentos" || ["cancelado", "completo"].includes(p.status)) return { ok: false, motivo: "fora do fluxo" };
  if (!p.email || !EMAIL.test(p.email)) return { ok: false, motivo: "sem e-mail" };
  if (!googleOn()) return { ok: false, motivo: "Google não configurado no servidor" };
  const k = await contaDe(p.conta);
  const at = await acesso(k.conta);
  if (!at) { if (p.status !== "aguardando_armazenamento") await evento(p, "aguardando o Google Drive conectado", { status: "aguardando_armazenamento" }); return { ok: false, motivo: "Google Drive não conectado" }; }
  await prepararPasta(p, k, at);
  if (p.enviado_at && !reenvio) return { ok: true };
  const l = lang(p.idioma), docs: string[] = p.documentos || [];
  const t = textos(reenvio ? "reenvio" : "lista", l, { nome: p.nome, empresa: k.nome, modelo: p.modelo, faltam: faltando(docs, p.recebidos), todos: docs, url: linkEnvio(p) });
  const r = await enviarEmail(db, { dedupe: `docs:${p.id}:${reenvio ? "reenvio" + (p.reenvios + 1) + ":" + p.email : "lista"}`, kind: reenvio ? "docs_reenvio" : "docs_lista", lead_id: p.lead_id, to: p.email, l, marca: marca(k), subject: t.subject, corpo: t.corpo });
  if (r === "sent" || r === "dup") {
    await evento(p, reenvio ? `lista reenviada para ${p.email}` : `lista enviada para ${p.email}`, reenvio ? { reenvios: (p.reenvios || 0) + 1 } : { status: "enviado", enviado_at: agora() });
    return { ok: true };
  }
  await evento(p, `falha ao enviar o e-mail (${r})`);
  return { ok: false, motivo: r === "sem_remetente" ? "o envio de e-mail não está configurado" : "o e-mail não saiu" };
}
/** confere a Initial Docs, manda o lembrete do que falta ou passa para revisão */
async function acompanhar(p: Any) {
  const k = await contaDe(p.conta);
  const at = await acesso(k.conta);
  if (!at || !p.pasta?.initial_docs_id) return;
  const docs: string[] = p.documentos || [];
  const rec = recebidosDosArquivos(docs, await arquivosDa(at, p.pasta.initial_docs_id), p.recebidos);
  const falta = faltando(docs, rec);
  if (JSON.stringify(rec) !== JSON.stringify(p.recebidos || {})) await evento(p, `documentos recebidos: ${docs.length - falta.length} de ${docs.length}`, { recebidos: rec, status: falta.length ? "recebendo" : p.status });
  if (!falta.length) return await completo(p, k);
  if (!followupDevido(p)) return;
  const l = lang(p.idioma);
  const t = textos("lembrete", l, { nome: p.nome, empresa: k.nome, modelo: p.modelo, faltam: falta, todos: docs, url: linkEnvio(p) });
  const r = await enviarEmail(db, { dedupe: `docs:${p.id}:lembrete${(p.followups || 0) + 1}`, kind: "docs_lembrete", lead_id: p.lead_id, to: p.email, l, marca: marca(k), subject: t.subject, corpo: t.corpo });
  await evento(p, `lembrete ${(p.followups || 0) + 1}: faltam ${falta.join(", ")} (${r})`, { followups: (p.followups || 0) + 1, ultimo_followup_at: agora() });
  if ((p.followups || 0) >= 5 && k.endeavor) await sino(`Documentos sem resposta: ${p.nome}`, `Depois de 5 lembretes, ainda faltam: ${falta.join(", ")}.`, "#/whatsapp?aba=pedidos");
}
async function completo(p: Any, k: Conta) {
  if (["em_revisao", "completo"].includes(p.status)) return;
  await evento(p, "todos os documentos recebidos: pronto para a revisão da equipe", { status: "em_revisao" });
  if (k.endeavor) await sino(`Documentos completos: ${p.nome}`, `${p.modelo || "Documentos"}: todos os itens chegaram na Initial Docs. Revise e organize nas subpastas.`, "#/whatsapp?aba=pedidos");
}
async function tick() {
  if (!googleOn()) return { ok: true, google: false };
  const { data: novos } = await db.from("crm_requests").select("*").eq("tipo", "documentos").is("enviado_at", null).in("status", ["novo", "aguardando_armazenamento", "pendente"]).order("created_at").limit(20);
  let enviados = 0, acompanhados = 0;
  for (const p of novos || []) { try { if ((await processar(p)).ok) enviados++; } catch (e) { console.error("processar", p.id, e); } }
  const { data: abertos } = await db.from("crm_requests").select("*").eq("tipo", "documentos").in("status", ["enviado", "recebendo"]).order("updated_at").limit(50);
  for (const p of abertos || []) { try { await acompanhar(p); acompanhados++; } catch (e) { console.error("acompanhar", p.id, e); } }
  await db.from("oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
  return { ok: true, enviados, acompanhados };
}

/* ================================================================ página pública de envio ================================================================ */
async function pedidoDoToken(t: unknown) {
  const tk = String(t || "");
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(tk)) throw new Erro("Link inválido.", 404);
  const { data: p } = await db.from("crm_requests").select("*").eq("upload_token", tk).maybeSingle();
  if (!p || p.status === "cancelado") throw new Erro("Este link não está mais ativo. Fale com a equipe.", 404);
  return p;
}
async function publico(req: Request, b: Any) {
  const p = await pedidoDoToken(b.t);
  const k = await contaDe(p.conta);
  const docs: string[] = p.documentos || [];
  if (b.acao === "pub_info") {
    if (p.status !== "completo" && p.pasta?.initial_docs_id) {
      const at = await acesso(k.conta);
      if (at) { try { const rec = recebidosDosArquivos(docs, await arquivosDa(at, p.pasta.initial_docs_id), p.recebidos); if (JSON.stringify(rec) !== JSON.stringify(p.recebidos || {})) { await evento(p, "conferência dos documentos recebidos", { recebidos: rec }); } } catch { /* mostra o que já sabemos */ } }
    }
    return { empresa: k.nome, endeavor: k.endeavor, nome: (p.nome || "").split(/\s+/)[0], modelo: p.modelo, idioma: lang(p.idioma), aberto: !["completo", "cancelado"].includes(p.status),
      documentos: docs.map((d) => ({ nome: d, enviados: (p.recebidos?.[d] || []).length })) };
  }
  if (["completo", "cancelado"].includes(p.status)) throw new Erro("Este pedido já foi concluído. Fale com a equipe se precisar enviar algo.", 409);
  const doc = String(b.doc || "");
  if (!docs.includes(doc)) throw new Erro("Documento desconhecido.");
  const at = await acesso(k.conta);
  if (!at) throw new Erro("O envio está temporariamente indisponível. Tente mais tarde.", 503);
  if (!p.pasta?.initial_docs_id) await prepararPasta(p, k, at);
  if (b.acao === "pub_sessao") {
    const v = arquivoOk(String(b.tipo || ""), Number(b.tamanho), String(b.nome || ""));
    if (!v.ok) throw new Erro(v.erro === "tamanho" ? "Arquivo muito grande (máximo 25 MB)." : "Tipo de arquivo não aceito. Envie PDF, foto (JPG, PNG, HEIC) ou Word.");
    const origem = req.headers.get("Origin") || SITE;
    const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,parents,createdTime", { method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": v.tipo!, "X-Upload-Content-Length": String(Number(b.tamanho)),
        ...(ORIGENS.includes(origem) ? { Origin: origem } : {}) },
      body: JSON.stringify({ name: nomeArquivo(doc, String(b.nome || "arquivo")), parents: [p.pasta.initial_docs_id] }) });
    const url = r.headers.get("Location");
    if (!r.ok || !url) throw new Erro("Não foi possível iniciar o envio. Tente de novo.", 502);
    return { url, tipo: v.tipo };
  }
  if (b.acao === "pub_confirmar") {
    const f = await drive(at, `files/${encodeURIComponent(String(b.file_id || ""))}?fields=id,name,parents,createdTime`).catch(() => null);
    if (!f || !(f.parents || []).includes(p.pasta.initial_docs_id)) throw new Erro("Não encontramos o arquivo enviado. Tente de novo.", 404);
    const rec = { ...(p.recebidos || {}) };
    rec[doc] = [...(rec[doc] || []).filter((x: Any) => x.id !== f.id), { id: f.id, nome: String(f.name).replace(/^\[[^\]]+\]\s/, "").slice(0, 120), em: f.createdTime || agora() }];
    const falta = faltando(docs, rec);
    await evento(p, `recebido: ${doc}`, { recebidos: rec, status: falta.length ? "recebendo" : p.status });
    if (!falta.length) await completo(p, k);
    return { ok: true, faltam: falta.length };
  }
  throw new Erro("Ação desconhecida.");
}

/* ================================================================ painel ================================================================ */
async function painel(req: Request, b: Any) {
  const u = await quemNoPainel(req, b);
  const k = u.conta;
  const soDono = () => { if (!u.dono) throw new Erro("Só o titular da empresa faz isso.", 403); };
  const pedido = async () => {
    const { data: p } = await db.from("crm_requests").select("*").eq("id", uuid(b.id) || NADA).eq("conta", k.conta).maybeSingle();
    if (!p) throw new Erro("Pedido não encontrado.", 404);
    return p;
  };
  switch (b.acao) {
    case "doc_status": {
      const { data: s } = await db.from("storage_connections").select("provider, account_email, status, erro, connected_at, root_folder_id").eq("conta", k.conta).maybeSingle();
      return { google_configurado: googleOn(), conexao: s ? { ...s, root_folder_id: undefined, pasta: s.root_folder_id ? `https://drive.google.com/drive/folders/${s.root_folder_id}` : null } : null, redirect: REDIRECT };
    }
    case "google_conectar": {
      soDono();
      if (!googleOn()) throw new Erro("O Google ainda não está configurado no servidor (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).", 503);
      const state = aleatorio(24);
      const volta = k.endeavor ? `${SITE}/admin.html#/whatsapp?aba=pedidos` : (b.volta === "admin" ? `${SITE}/admin.html#/whatsapp?cliente=${k.clientId}&aba=pedidos` : `${SITE}/client.html#/whatsapp?aba=pedidos`);
      await db.from("oauth_states").insert({ state, conta: k.conta, user_id: u.id, volta });
      const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: G_ID, redirect_uri: REDIRECT, response_type: "code", scope: ESCOPOS,
        access_type: "offline", prompt: "consent", include_granted_scopes: "false", state });
      return { url };
    }
    case "google_desconectar": {
      soDono();
      const { data: refresh } = await db.rpc("storage_get_secret", { p_conta: k.conta });
      if (refresh) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(String(refresh)), { method: "POST" }).catch(() => { });
      await db.rpc("storage_set_secret", { p_conta: k.conta, p_secret: "", p_email: "" });
      tokens.delete(k.conta);
      return { ok: true };
    }
    case "pedido_enviar": {
      soDono();
      const p = await pedido();
      const r = await processar(p, !!p.enviado_at);
      if (!r.ok) throw new Erro("Não enviado: " + (r.motivo || "tente de novo") + ".", 409);
      return { ok: true };
    }
    case "pedido_reenviar": {
      soDono();
      const p = await pedido();
      const novo = String(b.email || "").trim().toLowerCase();
      if (novo) {
        if (!EMAIL.test(novo)) throw new Erro("E-mail inválido.");
        if (novo !== p.email) await trocarEmail(p, novo, `e-mail trocado pela equipe (${u.email})`);
      }
      const r = await processar(p, !!p.enviado_at);
      if (!r.ok) throw new Erro("Não enviado: " + (r.motivo || "tente de novo") + ".", 409);
      return { ok: true };
    }
  }
  throw new Erro("Ação desconhecida.");
}
/** novo e-mail no pedido; o antigo fica como alternativo; o contato no CRM ganha o segundo e-mail */
async function trocarEmail(p: Any, novo: string, porque: string) {
  const antigo = p.email;
  await evento(p, `${porque}: ${antigo || "—"} → ${novo}`, { email: novo, email_alt: antigo || p.email_alt || null });
  if (p.lead_id) {
    const { data: l } = await db.from("leads").select("id, email, email2").eq("id", p.lead_id).maybeSingle();
    if (l && !l.email) await db.from("leads").update({ email: novo, updated_at: agora() }).eq("id", l.id);
    else if (l && l.email !== novo) await db.from("leads").update({ email2: novo, updated_at: agora() }).eq("id", l.id);
  }
  if (p.ct_contact_id) {
    const { data: c } = await db.from("ct_contacts").select("id, email").eq("id", p.ct_contact_id).maybeSingle();
    if (c && !c.email) await db.from("ct_contacts").update({ email: novo, updated_at: agora() }).eq("id", c.id);
    else if (c && c.email !== novo) await db.from("ct_contacts").update({ email2: novo, updated_at: agora() }).eq("id", c.id);
  }
}

/* ================================================================ retorno do Google ================================================================ */
async function retornoGoogle(url: URL) {
  const volta = (destino: string, ok: boolean, msg = "") => Response.redirect(destino + (destino.includes("?") ? "&" : "?") + "google=" + (ok ? "ok" : "erro") + (msg ? "&msg=" + encodeURIComponent(msg) : ""), 302);
  const state = url.searchParams.get("state") || "";
  const { data: st } = await db.from("oauth_states").select("*").eq("state", state).maybeSingle();
  if (!st || Date.now() - Date.parse(st.created_at) > 15 * 60_000) return volta(`${SITE}/admin.html#/whatsapp?aba=pedidos`, false, "O pedido de conexão expirou. Tente de novo.");
  await db.from("oauth_states").delete().eq("state", state);
  if (url.searchParams.get("error")) return volta(st.volta, false, "A conexão com o Google foi cancelada.");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: url.searchParams.get("code") || "", client_id: G_ID, client_secret: G_SECRET, redirect_uri: REDIRECT, grant_type: "authorization_code" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) return volta(st.volta, false, "O Google não devolveu o acesso. Tente de novo e marque a permissão do Google Drive.");
  if (!String(j.scope || "").includes("drive.file")) return volta(st.volta, false, "Marque a permissão do Google Drive na tela do Google.");
  let email = "";
  try { email = JSON.parse(atob(String(j.id_token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email || ""; } catch { /* sem e-mail */ }
  const { error } = await db.rpc("storage_set_secret", { p_conta: st.conta, p_secret: j.refresh_token, p_email: email });
  if (error) return volta(st.volta, false, "Não foi possível guardar o acesso.");
  tokens.set(st.conta, { at: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 });
  try { await raiz(j.access_token, await contaDe(st.conta)); } catch (e) { console.error("raiz", e); }
  // pedidos que esperavam o armazenamento seguem agora
  const { data: pend } = await db.from("crm_requests").select("*").eq("conta", st.conta).eq("tipo", "documentos").is("enviado_at", null).in("status", ["novo", "aguardando_armazenamento", "pendente"]).limit(20);
  for (const p of pend || []) { try { await processar(p); } catch (e) { console.error("processar", e); } }
  return volta(st.volta, true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/google-callback")) {
    try { return await retornoGoogle(url); } catch (e) { console.error(e); return Response.redirect(`${SITE}/admin.html#/whatsapp?aba=pedidos&google=erro`, 302); }
  }
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  let b: Any = {};
  try { b = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  try {
    const a = String(b.acao || "");
    if (a === "tick") {
      const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
      if (!ok) throw new Erro("Não autorizado.", 401);
      return json(await tick());
    }
    if (a === "processar") {
      if ((req.headers.get("x-interno") || "") !== SERVICE) throw new Erro("Não autorizado.", 401);
      const { data: p } = await db.from("crm_requests").select("*").eq("id", uuid(b.id) || NADA).maybeSingle();
      if (!p) throw new Erro("Pedido não encontrado.", 404);
      if (b.email && EMAIL.test(String(b.email)) && String(b.email).toLowerCase() !== p.email) await trocarEmail(p, String(b.email).toLowerCase(), "o cliente pediu outro e-mail no WhatsApp");
      return json(await processar(p, b.reenviar === true && !!p.enviado_at));
    }
    if (a.startsWith("pub_")) return json(await publico(req, b));
    return json(await painel(req, b));
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "O agente de documentos não concluiu a ação. Tente de novo." }, 502);
  }
});
