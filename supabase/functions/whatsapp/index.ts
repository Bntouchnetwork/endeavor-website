// My WhatsApp Manager (função whatsapp). A extensão do Chrome da Endeavor fica ao lado do WhatsApp Web e usa o HUB AI
// (agente whatsapp-assistant) por esta função. Funciona por EMPRESA: a Endeavor (conta "endeavor", no admin) e cada
// empresa cliente liberada pela Endeavor (conta = id do cliente, no portal), cada uma com os próprios ajustes, perfil do
// negócio, regras, fluxos, modelos de documentos, conversas e registro.
//
// Guardamos só os ajustes, o estado de cada conversa e o REGISTRO do que passou pela IA. A conversa vai para a IA só
// para gerar a resposta e não é guardada. Números sensíveis são removidos antes de ir para a IA e para o registro.
// Proteções fixas (regras.ts): nunca informar valores, nunca pedir documentos nem dados bancários; uma resposta
// automática que quebre isso não sai (vira "precisa de você").
//
// Fluxos: no IA Takeover, a IA segue as regras e os fluxos da empresa. Quando um fluxo com passo de CRM tem os dados
// (nome, e-mail…), o servidor passa o pedido para o CRM (crm_requests): o agente do CRM cria a pasta pelo modelo no
// armazenamento conectado, manda o e-mail com a lista e o link da Initial Docs e faz o follow-up.
//
// Painel (Authorization: sessão; admin → conta da Endeavor, ou de um cliente com clientId; cliente → a própria empresa):
//   wa_painel | wa_ajustes { ajustes, version } | wa_config { config, version } | wa_sugerir { tipo: regras|fluxos }
//   wa_conectar { nome } | wa_revogar { id } | wa_registro { antes?, ferramenta?, status? } | wa_conversa { chave, seguir?, takeover? }
//   wa_pedidos | wa_pedido { id, status }
// Extensão (body.token = código de conexão; só o hash fica no banco):
//   ext_iniciar | ext_ping | ext_ajustes | ext_conversa | ext_ia | ext_registrar | ext_lead | ext_horarios | ext_agendar | ext_propostas
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hubJson, hubOn, HubFail } from "../_shared/hub-ai.ts";
import "./core.js";
import { avisoComIA, FERRAMENTAS, limparConfig, limpo, montarEntrada, normalizar, padraoConfig, prontoParaCRM, STATUS, violaProtecao } from "./regras.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWaCore;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
const AGENTE = "whatsapp-assistant";
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "";
const NADA = "00000000-0000-0000-0000-000000000000";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
const agora = () => new Date().toISOString();
const LOG_FERRAMENTAS = [...FERRAMENTAS, "prontas", "agendamento", "takeover", "fluxo"];

async function sha256(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}
function novoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return "wam_" + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------------- empresa (conta) ---------------- */
type Conta = { conta: string; clientId: string | null; endeavor: boolean; nome: string };
const ENDEAVOR: Conta = { conta: "endeavor", clientId: null, endeavor: true, nome: "Endeavor Business Solutions" };
async function contaDe(conta: string): Promise<Conta> {
  if (conta === "endeavor") return ENDEAVOR;
  const { data: cl } = await db.from("clients").select("id, name").eq("id", uuid(conta) || NADA).maybeSingle();
  if (!cl) throw new Erro("Empresa não encontrada.", 404);
  return { conta: cl.id, clientId: cl.id, endeavor: false, nome: cl.name || "sua empresa" };
}
const fone = (v: unknown) => { let f = String(v || "").replace(/[^\d+]/g, ""); if (f && !f.startsWith("+")) f = "+" + f; return f; };
const foneDaChave = (chave: string) => /^\d{8,15}@c\.us$/.test(chave) ? "+" + chave.split("@")[0] : "";

/* ---------------- quem pede ---------------- */
async function quemNoPainel(req: Request, b: Any) {
  const jwt = bearer(req);
  if (!jwt || jwt === ANON) throw new Erro("Entre no portal para usar o WhatsApp Manager.", 401);
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) throw new Erro("Sessão expirada. Entre de novo.", 401);
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  if (aal !== "aal2") throw new Erro("Entre com o autenticador para usar o WhatsApp Manager.", 403);
  const { data: admin } = await user.rpc("is_admin");
  const clientId = uuid(b.clientId);
  if (admin) return { id: data.user.id as string, email: data.user.email || "", admin: true, dono: true, conta: clientId ? await contaDe(clientId) : ENDEAVOR };
  if (!clientId) throw new Erro("O WhatsApp Manager da Endeavor é do admin.", 403);
  const { data: papel } = await user.rpc("my_client_role", { p_client: clientId });
  if (!papel) throw new Erro("Sem acesso a esta empresa.", 403);
  const { data: acesso } = await db.from("wa_access").select("enabled").eq("client_id", clientId).maybeSingle();
  if (!acesso?.enabled) throw new Erro("O WhatsApp Manager não está liberado para esta empresa. Fale com a Endeavor.", 403);
  return { id: data.user.id as string, email: data.user.email || "", admin: false, dono: papel === "owner", conta: await contaDe(clientId) };
}
async function dispositivo(b: Any) {
  const t = String(b.token || "");
  if (!/^wam_[A-Za-z0-9_-]{20,64}$/.test(t)) throw new Erro("Extensão não conectada. Gere o código de conexão na página WhatsApp Manager.", 401);
  const { data: d } = await db.from("wa_devices").select("id, user_id, nome, conta, revoked_at").eq("token_hash", await sha256(t)).maybeSingle();
  if (!d || d.revoked_at) throw new Erro("Este código de conexão foi desligado. Gere um novo na página WhatsApp Manager.", 401);
  const conta = await contaDe(d.conta);
  if (!conta.endeavor) {
    const { data: acesso } = await db.from("wa_access").select("enabled").eq("client_id", conta.clientId).maybeSingle();
    if (!acesso?.enabled) throw new Erro("O WhatsApp Manager não está mais liberado para esta empresa.", 403);
  }
  return { id: d.id as string, user_id: d.user_id as string, nome: d.nome as string, conta };
}
type Disp = Awaited<ReturnType<typeof dispositivo>>;

/* ---------------- ajustes, configuração (perfil/regras/fluxos/modelos), conversas e registro ---------------- */
async function padraoAjustes(k: Conta) {
  if (k.endeavor) return C.limparAjustes({});
  const { data: pg } = await db.from("ct_booking_pages").select("slug").eq("client_id", k.clientId).limit(1);
  return C.limparAjustes({ negocio: "", texto_aviso: `Olá! Aqui é o assistente virtual da ${k.nome}.`, link_agenda: pg?.[0]?.slug ? `${SITE}/agendar.html?p=${pg[0].slug}` : "",
    prontas: [{ titulo: "Saudação", texto: `Olá! Obrigado por falar com a ${k.nome}. Como posso ajudar?` }, { titulo: "Retorno", texto: "Recebi sua mensagem e já vou verificar. Retorno em breve." }] });
}
async function linhaDe(k: Conta) {
  const { data } = await db.from("wa_settings").select("settings, version, config, config_version").eq("conta", k.conta).maybeSingle();
  return data;
}
async function ajustesDe(k: Conta) {
  const l = await linhaDe(k);
  return { ajustes: l ? C.limparAjustes(l.settings || {}) : await padraoAjustes(k), version: l?.version || 0 };
}
async function configDe(k: Conta) {
  const l = await linhaDe(k);
  const vazio = !l || !l.config || !Object.keys(l.config).length;
  return { config: vazio ? padraoConfig(k.endeavor) : limparConfig(l.config), config_version: l?.config_version || 0 };
}
async function salvarAjustes(k: Conta, userId: string, novo: Any, version: unknown, parcial = false) {
  const atual = await ajustesDe(k);
  if (version != null && Number(version) !== atual.version) throw new Erro("Os ajustes mudaram em outro lugar. Recarregue e tente de novo.", 409);
  const a = C.limparAjustes(parcial ? { ...atual.ajustes, ...(novo || {}) } : novo);
  const v = atual.version + 1;
  const { error } = await db.from("wa_settings").upsert({ conta: k.conta, user_id: userId, settings: a, version: v, updated_at: agora() }, { onConflict: "conta" });
  if (error) throw new Erro("Não foi possível salvar os ajustes.", 500);
  return { ajustes: a, version: v };
}
async function salvarConfig(k: Conta, userId: string, novo: Any, version: unknown) {
  const atual = await configDe(k);
  if (version != null && Number(version) !== atual.config_version) throw new Erro("As regras mudaram em outro lugar. Recarregue e tente de novo.", 409);
  const cfg = limparConfig(novo);
  const v = atual.config_version + 1;
  const l = await linhaDe(k);
  const base = l ? {} : { settings: (await padraoAjustes(k)), version: 0 };
  const { error } = await db.from("wa_settings").upsert({ conta: k.conta, user_id: userId, ...base, config: cfg, config_version: v, updated_at: agora() }, { onConflict: "conta" });
  if (error) throw new Erro("Não foi possível salvar as regras.", 500);
  return { config: cfg, config_version: v };
}
function lerConversa(c: Any) {
  const chave = txt(c?.chave, 120) || txt(c?.nome, 120);
  if (!chave) throw new Erro("Abra uma conversa no WhatsApp Web.");
  return { chave, nome: txt(c?.nome, 120), grupo: c?.grupo === true || /@g\.us$/.test(chave) };
}
async function conversaDe(k: Conta, c: { chave: string; nome: string; grupo: boolean }, ajustes: Any, userId: string) {
  const { data } = await db.from("wa_chats").select("*").eq("conta", k.conta).eq("chave", c.chave).maybeSingle();
  if (data) {
    if (c.nome && c.nome !== data.nome) await db.from("wa_chats").update({ nome: c.nome }).eq("id", data.id);
    return data;
  }
  const { data: novo, error } = await db.from("wa_chats").upsert({ conta: k.conta, user_id: userId, chave: c.chave, nome: c.nome, grupo: c.grupo, seguir: true, takeover: !c.grupo && ajustes.takeover_individual },
    { onConflict: "conta,chave" }).select("*").single();
  if (error) throw new Erro("Não foi possível registrar a conversa.", 500);
  return novo;
}
const conversaOut = (x: Any) => ({ chave: x.chave, nome: x.nome, grupo: x.grupo, seguir: x.seguir, takeover: x.takeover, aviso_enviado: !!x.aviso_ia_at, lead_id: x.lead_id,
  fluxo: x.fluxo ? { id: x.fluxo.id, status: x.fluxo.status } : null, atualizado: x.updated_at });
async function registrar(k: Conta, userId: string | null, deviceId: string | null, c: { chave?: string; nome?: string; grupo?: boolean } | null, ferramenta: string, status: string, texto?: unknown, detalhes: Any = {}) {
  const { data } = await db.from("wa_log").insert({ conta: k.conta, user_id: userId, device_id: deviceId, chave: c?.chave || null, nome: c?.nome || null, grupo: !!c?.grupo,
    ferramenta: LOG_FERRAMENTAS.includes(ferramenta) ? ferramenta : "comando", status: STATUS.includes(status) ? status : "sugerido",
    texto: texto ? limpo(texto) : null, detalhes }).select("id").single();
  return data?.id as number | undefined;
}

/* ---------------- IA (HUB) ---------------- */
function lerMensagens(v: unknown) {
  return (Array.isArray(v) ? v : []).slice(-80).map((m: Any) => ({ eu: m?.eu === true, autor: txt(m?.autor, 60), texto: String(m?.texto ?? "").slice(0, 1500), hora: txt(m?.hora, 20), midia: txt(m?.midia, 20) }))
    .filter((m) => m.texto || m.midia);
}
const hubErro = (e: unknown) => {
  if (e instanceof HubFail) {
    if (e.kind === "limit") return new Erro("O limite de uso da IA foi atingido. Veja o Hub AI no admin.", 402);
    if (e.kind === "rate") return new Erro("Muitos pedidos à IA agora. Tente em alguns segundos.", 429);
    if (e.kind === "blocked") return new Erro("A IA não respondeu a este conteúdo.", 422);
    if (e.kind === "format") return new Erro("A IA respondeu fora do formato. Tente de novo.", 502);
  }
  return new Erro("A IA não respondeu agora. Tente de novo.", 502);
};
async function chamarIA(k: Conta, userId: string, f: string, entrada: string, maxTokens = 4000) {
  return await hubJson({ agent: AGENTE, input: entrada, userId, idempotencyKey: "wa-" + crypto.randomUUID(), task: "whatsapp_" + f,
    metadata: { ferramenta: f, conta: k.endeavor ? "endeavor" : "cliente", client_id: k.clientId }, maxOutputTokens: maxTokens, timeoutMs: 50_000, meter: { agent: AGENTE } });
}

async function horariosEndeavor() {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const [{ data: s, error }, { data: info }] = await Promise.all([
    db.rpc("get_available_slots", { p_from: ymd(new Date()), p_to: ymd(new Date(Date.now() + 14 * 86400_000)) }), db.rpc("get_booking_info")]);
  if (error) throw new Erro("A agenda não respondeu agora. Tente de novo.", 502);
  return { horarios: (s || []).map((x: Any) => x.slot).filter((x: string) => Date.parse(x) > Date.now() + 3600_000).slice(0, 60) as string[], timezone: info?.[0]?.timezone || "America/New_York" };
}
const legivel = (iso: string, tz: string, lang = "pt-BR") => {
  try { return new Intl.DateTimeFormat(lang, { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso)); }
  catch { return iso; }
};

async function ia(d: Disp, b: Any) {
  const f = String(b.ferramenta || "");
  if (!FERRAMENTAS.includes(f)) throw new Erro("Ferramenta desconhecida.");
  if (!hubOn()) throw new Erro("O HUB AI não está configurado no servidor.", 503);
  const k = d.conta;
  const c = lerConversa(b.conversa);
  const mensagens = lerMensagens(b.mensagens);
  const [{ ajustes }, { config }] = await Promise.all([ajustesDe(k), configDe(k)]);
  const conv = await conversaDe(k, c, ajustes, d.user_id);
  const extra: Any = { pedido: b.pedido, base: b.base, texto: b.texto, empresa: k.nome, cfg: config };
  if (f === "traduzir") extra.idioma_destino = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(b.idioma_destino || "")) ? b.idioma_destino : ajustes.idioma;
  if (!mensagens.length && !["comando", "traduzir"].includes(f)) throw new Erro("Não encontrei mensagens nesta conversa. Role a conversa até aparecerem as mensagens.");
  const takeover = f === "responder" || (f === "grupo" && b.takeover === true);

  // IA Takeover: o servidor também confere o ritmo (limite por hora e intervalo do grupo) antes de chamar a IA
  if (takeover) {
    if (!conv.takeover) return { responder: false, motivo: "Takeover desligado nesta conversa" };
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { data: env } = await db.from("wa_log").select("created_at").eq("conta", k.conta).eq("ferramenta", "takeover").eq("status", "enviado").gte("created_at", desde);
    const envios = (env || []).map((x: Any) => Date.parse(x.created_at));
    const { data: ultG } = c.grupo ? await db.from("wa_log").select("created_at").eq("conta", k.conta).eq("chave", c.chave).eq("ferramenta", "takeover").eq("status", "enviado").order("created_at", { ascending: false }).limit(1) : { data: [] };
    const pode = C.podeResponder(ajustes, envios, Date.now(), c.grupo, ultG?.[0] ? Date.parse(ultG[0].created_at) : 0);
    if (!pode.ok) return { responder: false, motivo: pode.motivo };
    if (!conv.aviso_ia_at) extra.aviso = avisoComIA(ajustes.texto_aviso, ajustes.idioma);
    if (conv.fluxo && !["enviado_crm", "cancelado"].includes(conv.fluxo.status)) extra.fluxo_atual = { id: conv.fluxo.id, dados: conv.fluxo.dados, status: conv.fluxo.status };
    extra.telefone = foneDaChave(c.chave);
  }
  if (k.endeavor && (f === "responder" || f === "comando" || f === "sugerir")) {
    try { const h = await horariosEndeavor(); extra.horarios = h.horarios.slice(0, 6).map((x) => legivel(x, h.timezone, ajustes.idioma)); } catch { /* sem agenda: a IA usa o link */ }
  }
  let r: Any;
  try { r = await chamarIA(k, d.user_id, f, montarEntrada(f, ajustes, c, mensagens, extra)); }
  catch (e) { await registrar(k, d.user_id, d.id, c, takeover ? "takeover" : f, "erro", null, { erro: e instanceof HubFail ? e.code : "erro" }); throw hubErro(e); }
  const out = normalizar(f, r, config);
  // o aviso da IA é obrigatório na primeira mensagem automática da conversa
  if (extra.aviso && out.responder && out.texto && !/assistente virtual|virtual assistant|asistente virtual/i.test(out.texto)) {
    // a IA começou com o aviso antigo (sem "assistente virtual"): troca pelo aviso completo, sem repetir
    const base = String(ajustes.texto_aviso || "").trim().replace(/[.!\s]+$/, "");
    let resto = out.texto;
    if (base && resto.toLowerCase().startsWith(base.toLowerCase())) resto = resto.slice(base.length).replace(/^[.!,\s]+/, "");
    out.texto = extra.aviso + " " + resto;
  }
  // proteções fixas, conferidas em código: a resposta automática que cita valor ou pede documento não sai
  if (takeover && out.responder) {
    const v = violaProtecao(out.texto);
    if (v) { out.responder = false; out.escalar = true; out.motivo = v; }
  }
  if (!takeover) for (const campo of ["resposta", "texto", "mensagem"]) if (out[campo] && violaProtecao(out[campo])) out.aviso_protecao = violaProtecao(out[campo]);
  // fluxos: guarda o andamento na conversa e, com os dados completos, passa o pedido para o CRM
  if (takeover && !c.grupo && out.fluxo) out.fluxo_info = await andarFluxo(k, d, c, conv, config, out.fluxo, mensagens);
  delete out.fluxo;
  const textoLog = out.resposta || out.texto || out.mensagem || out.traducao || out.resumo || "";
  const status = out.escalar ? "escalado" : takeover && !out.responder ? "ignorado" : "sugerido";
  out.log_id = await registrar(k, d.user_id, d.id, c, takeover ? "takeover" : f, status, textoLog,
    { ferramenta: f, ...(out.motivo ? { motivo: txt(out.motivo, 200) } : {}), ...(out.regra ? { regra: out.regra } : {}), ...(out.fluxo_info ? { fluxo: out.fluxo_info.id, etapa: out.fluxo_info.status } : {}) });
  out.aviso_incluido = !!extra.aviso && !!out.responder;
  if (out.escalar && k.endeavor) await sino("whatsapp", `WhatsApp: ${c.nome || "conversa"} precisa de você`, out.motivo || "A IA não respondeu sozinha.", "#/whatsapp?aba=registro");
  return out;
}

async function sino(kind: string, title: string, body: string, link: string) {
  await db.from("admin_events").insert({ kind, title: title.slice(0, 300), body: String(body || "").slice(0, 2000), link: link.slice(0, 300) }).then(() => { }, () => { });
}

/* ---------------- fluxos → CRM ---------------- */
async function andarFluxo(k: Conta, d: Disp, c: Any, conv: Any, config: Any, fx: Any, mensagens: Any[]) {
  const fluxo = config.fluxos.find((x: Any) => x.id === fx.id);
  if (!fluxo) return null;
  const antes = conv.fluxo && conv.fluxo.id === fx.id && conv.fluxo.status !== "enviado_crm" ? conv.fluxo : { id: fx.id, dados: {}, status: "coletando", inicio: agora() };
  if (conv.fluxo?.id === fx.id && conv.fluxo.status === "enviado_crm") return { id: fx.id, nome: fluxo.nome, status: "enviado_crm", pedido_id: conv.fluxo.pedido_id };
  const dados = { ...antes.dados };
  for (const [kk, v] of Object.entries(fx.dados)) if (v) dados[kk] = v;
  if (!dados.telefone) dados.telefone = foneDaChave(c.chave);
  const pr = prontoParaCRM(fluxo, dados);
  let novo: Any = { ...antes, dados, status: "coletando", atualizado: agora() };
  if (pr.ok && fx.pronto) {
    const pedido = await pedidoCRM(k, d, c, conv, config, pr.tipo, dados, mensagens);
    novo = { ...novo, status: "enviado_crm", pedido_id: pedido.id, enviado: agora() };
  }
  await db.from("wa_chats").update({ fluxo: novo, updated_at: agora() }).eq("id", conv.id);
  return { id: fluxo.id, nome: fluxo.nome, status: novo.status, falta: pr.falta, pedido_id: novo.pedido_id || null };
}
/** Cria ou atualiza o contato no CRM (Endeavor: leads; cliente: ct_contacts) e registra o pedido para o agente do CRM. */
async function pedidoCRM(k: Conta, d: Disp, c: Any, conv: Any, config: Any, tipo: string, dados: Any, mensagens: Any[]) {
  const nome = txt(dados.nome, 120), email = EMAIL.test(dados.email || "") ? String(dados.email).toLowerCase() : null, tel = fone(dados.telefone) || null;
  const modelo = config.modelos.find((m: Any) => m.id === dados.tipo_caso) || (tipo === "documentos" ? config.modelos[0] : null);
  const ultimas = mensagens.filter((m: Any) => !m.eu).slice(-3).map((m: Any) => m.texto).join(" | ");
  const resumo = limpo(`Pelo WhatsApp (IA Takeover). ${tipo === "documentos" ? "Pediu a lista de documentos" : "Pediu proposta / caso específico"}${modelo ? " · Modelo: " + modelo.nome : ""}. Últimas mensagens: ${ultimas}`, 1900);
  let lead_id: string | null = null, ct_contact_id: string | null = null;
  const nota = `${agora().slice(0, 10)} · WhatsApp: ${tipo === "documentos" ? "pedido de documentos" : "pedido de proposta"}${modelo ? " (" + modelo.nome + ")" : ""}`;
  if (k.endeavor) {
    let q = db.from("leads").select("id, notes").order("created_at", { ascending: false }).limit(1);
    q = email ? q.ilike("email", email) : q.eq("phone", tel || "-");
    const { data: ex } = await q;
    if (ex?.[0]) {
      lead_id = ex[0].id;
      await db.from("leads").update({ notes: ((ex[0].notes ? ex[0].notes + "\n" : "") + nota).slice(-19000), updated_at: agora(), last_contact_at: agora(), ...(tel ? { phone: tel } : {}) }).eq("id", lead_id);
    } else {
      const { data, error } = await db.from("leads").insert({ name: nome, email, phone: tel, message: modelo?.nome || (tipo === "proposta" ? "Proposta" : null), assistance: "WhatsApp", source: "whatsapp",
        status: "contacted", marketing_consent: false, notes: nota, last_contact_at: agora() }).select("id").single();
      if (error) throw new Erro("Não foi possível criar o lead.", 500);
      lead_id = data.id;
    }
    await db.from("wa_chats").update({ lead_id }).eq("id", conv.id);
  } else {
    let q = db.from("ct_contacts").select("id, notes").eq("client_id", k.clientId).limit(1);
    q = email ? q.ilike("email", email) : q.eq("phone", tel || "-");
    const { data: ex } = await q;
    if (ex?.[0]) {
      ct_contact_id = ex[0].id;
      await db.from("ct_contacts").update({ notes: ((ex[0].notes ? ex[0].notes + "\n" : "") + nota).slice(-3900), updated_at: agora(), ...(tel ? { phone: tel } : {}) }).eq("id", ct_contact_id);
    } else {
      const { data, error } = await db.from("ct_contacts").insert({ client_id: k.clientId, name: nome, email, phone: tel, source: "whatsapp", stage: "contacted", notes: nota }).select("id").single();
      if (error) { console.error("ct_contacts", error); throw new Erro("Não foi possível criar o contato no CRM.", 500); }
      ct_contact_id = data.id;
    }
    await db.from("wa_chats").update({ ct_contact_id }).eq("id", conv.id);
  }
  const { data: p, error } = await db.from("crm_requests").insert({ conta: k.conta, client_id: k.clientId, tipo, lead_id, ct_contact_id, nome, email, telefone: tel,
    modelo: modelo?.nome || null, documentos: modelo?.documentos || [], subpastas: modelo?.subpastas || [], resumo,
    status: tipo === "documentos" ? "aguardando_armazenamento" : "novo", eventos: [{ em: agora(), evento: "criado pelo WhatsApp (IA Takeover)" }] }).select("id").single();
  if (error) { console.error("crm_requests", error); throw new Erro("Não foi possível passar o pedido para o CRM.", 500); }
  await registrar(k, d.user_id, d.id, c, "fluxo", "criado", `${tipo === "documentos" ? "Pedido de documentos" : "Pedido de proposta"} para ${nome}${modelo ? " · " + modelo.nome : ""}`, { pedido_id: p.id, tipo });
  if (k.endeavor) await sino("whatsapp", `WhatsApp: ${tipo === "documentos" ? "pedido de documentos" : "pedido de proposta"} de ${nome}`,
    `${modelo ? "Modelo: " + modelo.nome + ". " : ""}${tipo === "documentos" ? "O CRM envia a lista e o link da Initial Docs quando o armazenamento estiver conectado." : "Prepare a proposta."}`, "#/whatsapp?aba=pedidos");
  return p;
}

/* ---------------- CRM, agenda e propostas (ferramentas do painel da extensão) ---------------- */
async function criarLead(d: Disp, b: Any) {
  const k = d.conta;
  const c = lerConversa(b.conversa);
  const nome = txt(b.nome, 120), email = txt(b.email, 160).toLowerCase(), assunto = txt(b.assunto, 200), resumo = limpo(txt(b.resumo, 600), 600);
  let tel = fone(b.telefone) || foneDaChave(c.chave);
  if (tel && !/^\+[1-9]\d{6,14}$/.test(tel)) throw new Erro("Telefone inválido. Use o código do país, por exemplo +1 407 555 0100.");
  if (nome.length < 2) throw new Erro("Informe o nome do contato.");
  if (email && !EMAIL.test(email)) throw new Erro("E-mail inválido.");
  if (!email && !tel) throw new Erro("Informe o e-mail ou o telefone do contato.");
  const nota = `WhatsApp (My WhatsApp Manager) · ${agora().slice(0, 10)}${assunto ? " · Interesse: " + assunto : ""}${resumo ? "\n" + resumo : ""}`;
  const tabela = k.endeavor ? "leads" : "ct_contacts";
  let q = db.from(tabela).select("id, notes").limit(1);
  if (!k.endeavor) q = q.eq("client_id", k.clientId);
  q = email ? q.ilike("email", email) : q.eq("phone", tel);
  const { data: ex } = await q;
  let id: string, novo = false;
  if (ex?.[0]) {
    id = ex[0].id;
    await db.from(tabela).update({ notes: ((ex[0].notes ? ex[0].notes + "\n" : "") + nota).slice(k.endeavor ? -19000 : -3900), updated_at: agora(), ...(tel ? { phone: tel } : {}) }).eq("id", id);
  } else {
    const linha: Any = k.endeavor
      ? { name: nome, email: email || null, phone: tel || null, message: assunto || null, assistance: "WhatsApp", source: "whatsapp", status: "contacted", marketing_consent: false, notes: nota, last_contact_at: agora() }
      : { client_id: k.clientId, name: nome, email: email || null, phone: tel || null, source: "whatsapp", stage: "contacted", notes: nota };
    const { data, error } = await db.from(tabela).insert(linha).select("id").single();
    if (error) { console.error("lead", error); throw new Erro("Não foi possível criar o contato: " + (/email/.test(error.message) ? "confira o e-mail." : /name/.test(error.message) ? "o nome precisa ter pelo menos 2 letras." : "tente de novo."), 500); }
    id = data.id; novo = true;
  }
  await db.from("wa_chats").update(k.endeavor ? { lead_id: id, updated_at: agora() } : { ct_contact_id: id, updated_at: agora() }).eq("conta", k.conta).eq("chave", c.chave);
  await registrar(k, d.user_id, d.id, c, "lead", "criado", `${nome}${assunto ? " · " + assunto : ""}`, { lead_id: id, novo });
  return { ok: true, lead_id: id, novo, link: k.endeavor ? `${SITE}/admin.html#/crm` : `${SITE}/client.html#/crm` };
}
async function agendar(d: Disp, b: Any) {
  if (!d.conta.endeavor) throw new Erro("Para esta empresa, mande o link de agendamento.");
  const k = d.conta;
  const c = lerConversa(b.conversa);
  const ini = new Date(String(b.inicio || ""));
  if (isNaN(ini.getTime()) || ini.getTime() < Date.now()) throw new Erro("Escolha um horário da lista.");
  const nome = txt(b.nome, 120), email = txt(b.email, 160).toLowerCase();
  const tel = fone(b.telefone);
  if (!nome || !EMAIL.test(email)) throw new Erro("Confirme o nome e o e-mail do contato (a confirmação vai por e-mail).");
  if (!/^\+[1-9]\d{6,14}$/.test(tel)) throw new Erro("Informe o telefone com o código do país, por exemplo +1 407 555 0100.");
  const tipo = ["video", "phone", "whatsapp"].includes(b.tipo) ? b.tipo : "whatsapp";
  const { ajustes } = await ajustesDe(k);
  const tz = txt(b.timezone, 64) || "America/New_York";
  const { data, error } = await db.rpc("book_slot_v2", { p_starts_at: ini.toISOString(), p_name: nome, p_email: email, p_phone: tel, p_topic: txt(b.assunto, 100) || "Conversa pelo WhatsApp",
    p_notes: "Agendado pelo My WhatsApp Manager.", p_meeting_type: tipo, p_language: ajustes.idioma.slice(0, 2), p_timezone: tz });
  if (error) {
    const m = error.message || "";
    await registrar(k, d.user_id, d.id, c, "agendamento", "erro", null, { erro: m.slice(0, 120) });
    throw new Erro(/slot_unavailable/.test(m) ? "Esse horário acabou de ser ocupado. Escolha outro." : /too_many/.test(m) ? "Este contato já tem horários marcados. Use o link do e-mail para mudar." : /invalid_phone/.test(m) ? "Telefone inválido." : "Não foi possível marcar agora. Tente de novo.", 409);
  }
  const quando = legivel(data?.[0]?.starts_at || ini.toISOString(), tz, ajustes.idioma);
  await registrar(k, d.user_id, d.id, c, "agendamento", "criado", `Horário marcado: ${quando}`, { booking_id: data?.[0]?.booking_id, inicio: ini.toISOString(), tipo });
  return { ok: true, quando, mensagem: `Pronto! Sua conversa com a Endeavor está marcada para ${quando}. Você vai receber a confirmação por e-mail.` };
}
async function propostas(k: Conta, b: Any) {
  const nova = k.endeavor ? `${SITE}/admin.html#/pagamentos?tab=nova-proposta` : "";
  if (!k.endeavor) return { propostas: [], nova };
  const email = txt(b.email, 160).toLowerCase();
  const tel = fone(b.telefone);
  if (!email && !tel) return { propostas: [], nova };
  let q = db.from("leads").select("id").limit(5);
  q = email ? q.ilike("email", email) : q.eq("phone", tel);
  const { data: ls } = await q;
  const ids = (ls || []).map((l: Any) => l.id);
  let cq = db.from("clients").select("id, name").limit(10);
  cq = ids.length ? cq.in("lead_id", ids) : cq.ilike("primary_email", email || "-");
  const { data: cs } = await cq;
  const cids = (cs || []).map((x: Any) => x.id);
  if (!cids.length) return { propostas: [], nova };
  const { data: ps } = await db.from("proposals").select("id, title, status, token, language, created_at, client_id").in("client_id", cids).in("status", ["sent", "viewed", "accepted", "draft"]).order("created_at", { ascending: false }).limit(10);
  return { propostas: (ps || []).map((p: Any) => ({ id: p.id, titulo: p.title || "Proposta", status: p.status, criada: p.created_at,
    link: p.status === "draft" ? "" : `${SITE}/proposal.html?t=${p.token}&lang=${p.language || "pt"}` })), nova };
}

/* ================================================================ extensão ================================================================ */
async function extensao(b: Any) {
  const d = await dispositivo(b);
  const k = d.conta;
  const visto = (extra: Any = {}) => db.from("wa_devices").update({ last_seen: agora(), ...extra }).eq("id", d.id).then(() => { }, () => { });
  switch (b.acao) {
    case "ext_iniciar": {
      await visto({ ext_version: txt(b.versao, 20) || null });
      const [a, { data: cs }, { data: u }] = await Promise.all([ajustesDe(k), db.from("wa_chats").select("*").eq("conta", k.conta).order("updated_at", { ascending: false }).limit(300), db.auth.admin.getUserById(d.user_id)]);
      return { ...a, conversas: (cs || []).map(conversaOut), dispositivo: d.nome, usuario: u?.user?.email || "", empresa: k.nome, endeavor: k.endeavor,
        painel: k.endeavor ? `${SITE}/admin.html#/whatsapp` : `${SITE}/client.html#/whatsapp`, ia: hubOn() };
    }
    case "ext_ping": {
      const e = b.estado || {};
      await visto({ estado: { takeover_ativo: e.takeover_ativo === true, pausado: e.pausado === true, conversa: txt(e.conversa, 120), whatsapp: e.whatsapp === true, em: agora() } });
      const a = await ajustesDe(k);
      return Number(b.version) === a.version ? { version: a.version } : a;
    }
    case "ext_ajustes": return await salvarAjustes(k, d.user_id, b.ajustes, b.version, true);
    case "ext_conversa": {
      const c = lerConversa(b.conversa);
      const { ajustes } = await ajustesDe(k);
      const conv = await conversaDe(k, c, ajustes, d.user_id);
      const up: Any = { updated_at: agora() };
      if (typeof b.seguir === "boolean") up.seguir = b.seguir;
      if (typeof b.takeover === "boolean") up.takeover = b.takeover;
      const { data } = await db.from("wa_chats").update(up).eq("id", conv.id).select("*").single();
      return { conversa: conversaOut(data) };
    }
    case "ext_ia": return await ia(d, b);
    case "ext_registrar": {
      const status = String(b.status || "");
      if (!STATUS.includes(status)) throw new Erro("Status inválido.");
      const c = b.conversa ? lerConversa(b.conversa) : null;
      const logId = Number(b.log_id) || 0;
      if (logId) {
        const up: Any = { status };
        if (b.texto) up.texto = limpo(b.texto);
        await db.from("wa_log").update(up).eq("id", logId).eq("conta", k.conta);
      } else await registrar(k, d.user_id, d.id, c, String(b.ferramenta || "comando"), status, b.texto, b.detalhes && typeof b.detalhes === "object" ? { motivo: txt(b.detalhes.motivo, 200) } : {});
      // a primeira mensagem automática enviada leva o aviso da IA: marca a conversa
      if (c && status === "enviado" && b.aviso_incluido === true) await db.from("wa_chats").update({ aviso_ia_at: agora() }).eq("conta", k.conta).eq("chave", c.chave);
      return { ok: true };
    }
    case "ext_lead": return await criarLead(d, b);
    case "ext_horarios": {
      const { ajustes } = await ajustesDe(k);
      if (!k.endeavor) return { horarios: [], legiveis: [], timezone: "America/New_York", link: ajustes.link_agenda };
      const h = await horariosEndeavor();
      return { ...h, legiveis: h.horarios.map((x) => legivel(x, h.timezone, ajustes.idioma)), link: ajustes.link_agenda };
    }
    case "ext_agendar": return await agendar(d, b);
    case "ext_propostas": return await propostas(k, b);
  }
  throw new Erro("Ação desconhecida.");
}

/* ================================================================ painel (admin e portal) ================================================================ */
async function painel(req: Request, b: Any) {
  const u = await quemNoPainel(req, b);
  const k = u.conta;
  const soDono = () => { if (!u.dono) throw new Erro("Só o titular da empresa muda os ajustes do WhatsApp Manager.", 403); };
  switch (b.acao) {
    case "wa_painel": {
      const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
      const [a, cf, { data: ds }, { data: cs }, { data: lg }, { count: pend }] = await Promise.all([
        ajustesDe(k), configDe(k),
        db.from("wa_devices").select("id, nome, ext_version, estado, created_at, last_seen, revoked_at, user_id").eq("conta", k.conta).order("created_at", { ascending: false }),
        db.from("wa_chats").select("*").eq("conta", k.conta).order("updated_at", { ascending: false }).limit(300),
        db.from("wa_log").select("ferramenta, status").eq("conta", k.conta).gte("created_at", hoje.toISOString()).limit(5000),
        db.from("crm_requests").select("id", { count: "exact", head: true }).eq("conta", k.conta).in("status", ["novo", "aguardando_armazenamento", "pendente", "em_revisao"])]);
      const hojeRes: Record<string, number> = {};
      (lg || []).forEach((x: Any) => { hojeRes[x.status] = (hojeRes[x.status] || 0) + 1; });
      return { ...a, ...cf, ia: hubOn(), hoje: hojeRes, conversas: (cs || []).map(conversaOut), empresa: k.nome, endeavor: k.endeavor, dono: u.dono, pedidos_abertos: pend || 0,
        dispositivos: (ds || []).filter((x: Any) => u.dono || x.user_id === u.id).map((x: Any) => ({ id: x.id, nome: x.nome, versao: x.ext_version, estado: x.estado, criado: x.created_at, visto: x.last_seen, ativo: !x.revoked_at,
          online: !x.revoked_at && !!x.last_seen && Date.now() - Date.parse(x.last_seen) < 150_000 })) };
    }
    case "wa_ajustes": soDono(); return await salvarAjustes(k, u.id, b.ajustes, b.version);
    case "wa_config": soDono(); return await salvarConfig(k, u.id, b.config, b.version);
    case "wa_sugerir": {
      soDono();
      if (!hubOn()) throw new Erro("O HUB AI não está configurado no servidor.", 503);
      const tipo = b.tipo === "fluxos" ? "sugerir_fluxos" : "sugerir_regras";
      const [{ ajustes }, { config }] = await Promise.all([ajustesDe(k), configDe(k)]);
      const existentes = tipo === "sugerir_regras" ? config.regras.map((r: Any) => r.nome + ": " + r.quando).join(" | ") : config.fluxos.map((f: Any) => f.nome + ": " + f.gatilho).join(" | ");
      let r: Any;
      try { r = await chamarIA(k, u.id, tipo, montarEntrada(tipo, ajustes, { nome: "", grupo: false }, [], { empresa: k.nome, cfg: config, existentes, pedido: b.pedido })); }
      catch (e) { throw hubErro(e); }
      return normalizar(tipo, r);
    }
    case "wa_conectar": {
      const { count } = await db.from("wa_devices").select("id", { count: "exact", head: true }).eq("conta", k.conta).is("revoked_at", null);
      if ((count || 0) >= 20) throw new Erro("Já há 20 navegadores conectados nesta empresa. Desligue um antes de gerar outro código.", 409);
      const codigo = novoCodigo();
      const { data, error } = await db.from("wa_devices").insert({ user_id: u.id, conta: k.conta, nome: txt(b.nome, 60) || "Chrome", token_hash: await sha256(codigo) }).select("id").single();
      if (error) throw new Erro("Não foi possível gerar o código.", 500);
      return { id: data.id, codigo };
    }
    case "wa_revogar": {
      let q = db.from("wa_devices").update({ revoked_at: agora() }).eq("id", uuid(b.id) || NADA).eq("conta", k.conta);
      if (!u.dono) q = q.eq("user_id", u.id);
      const { error } = await q;
      if (error) throw new Erro("Não foi possível desligar.", 500);
      return { ok: true };
    }
    case "wa_registro": {
      let q = db.from("wa_log").select("id, chave, nome, grupo, ferramenta, status, texto, detalhes, created_at").eq("conta", k.conta).order("id", { ascending: false }).limit(Math.min(500, Number(b.limite) || 100));
      if (Number(b.antes)) q = q.lt("id", Number(b.antes));
      if (LOG_FERRAMENTAS.includes(b.ferramenta)) q = q.eq("ferramenta", b.ferramenta);
      if (STATUS.includes(b.status)) q = q.eq("status", b.status);
      const { data, error } = await q;
      if (error) throw new Erro("Não foi possível ler o registro.", 500);
      return { registro: data || [] };
    }
    case "wa_conversa": {
      const chave = txt(b.chave, 120);
      const up: Any = { updated_at: agora() };
      if (typeof b.seguir === "boolean") up.seguir = b.seguir;
      if (typeof b.takeover === "boolean") up.takeover = b.takeover;
      const { data } = await db.from("wa_chats").update(up).eq("conta", k.conta).eq("chave", chave).select("*").maybeSingle();
      if (!data) throw new Erro("Conversa não encontrada.", 404);
      return { conversa: conversaOut(data) };
    }
    case "wa_pedidos": {
      const { data, error } = await db.from("crm_requests").select("id, tipo, nome, email, telefone, modelo, documentos, status, resumo, eventos, created_at, updated_at, lead_id, ct_contact_id")
        .eq("conta", k.conta).order("created_at", { ascending: false }).limit(200);
      if (error) throw new Erro("Não foi possível ler os pedidos.", 500);
      return { pedidos: data || [] };
    }
    case "wa_pedido": {
      soDono();
      const st = String(b.status || "");
      if (!["novo", "pendente", "enviado", "em_revisao", "completo", "cancelado", "aguardando_armazenamento"].includes(st)) throw new Erro("Situação inválida.");
      const { data: p } = await db.from("crm_requests").select("id, eventos").eq("id", uuid(b.id) || NADA).eq("conta", k.conta).maybeSingle();
      if (!p) throw new Erro("Pedido não encontrado.", 404);
      const eventos = [...(p.eventos || []), { em: agora(), evento: "situação: " + st, por: u.email }].slice(-50);
      await db.from("crm_requests").update({ status: st, eventos, updated_at: agora() }).eq("id", p.id);
      return { ok: true };
    }
  }
  throw new Erro("Ação desconhecida.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  let b: Any = {};
  try { b = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  try {
    const a = String(b.acao || "");
    if (a.startsWith("ext_")) return json(await extensao(b));
    if (a.startsWith("wa_")) return json(await painel(req, b));
    if (a === "status") return json({ ok: true, ia: hubOn() });
    throw new Erro("Ação desconhecida.");
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "O servidor do WhatsApp Manager não concluiu a ação. Tente de novo." }, 502);
  }
});
