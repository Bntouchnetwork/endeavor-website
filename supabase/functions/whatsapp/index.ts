// My WhatsApp Manager (função whatsapp). A extensão do Chrome da Endeavor fica ao lado do WhatsApp Web e usa o HUB AI
// (agente whatsapp-assistant) por esta função; a página "WhatsApp Manager" do admin é a central de controle.
//
// Guardamos só os ajustes, o estado de cada conversa e o REGISTRO do que passou pela IA (sugerido, aprovado, enviado,
// escalado). A conversa vai para a IA só para gerar a resposta e não é guardada. Números sensíveis (SSN/ITIN, cartão,
// conta, passaporte) são removidos antes de ir para a IA e para o registro.
//
// Painel (Authorization: sessão do admin com autenticador):
//   wa_painel | wa_ajustes { ajustes, version } | wa_conectar { nome } | wa_revogar { id } | wa_registro { antes?, ferramenta?, status? }
//   wa_conversa { chave, seguir?, takeover? }
// Extensão (body.token = código de conexão gerado no admin; só o hash fica no banco):
//   ext_iniciar { versao } | ext_ping { estado } | ext_ajustes { ajustes, version } | ext_conversa { conversa, seguir?, takeover? }
//   ext_ia { ferramenta, conversa, mensagens, pedido?, idioma_destino?, base? } | ext_registrar { log_id?, ferramenta, status, conversa, texto? }
//   ext_lead { conversa, nome, email?, telefone?, assunto?, resumo? } | ext_horarios | ext_agendar { inicio, nome, email, telefone, tipo?, assunto?, conversa }
//   ext_propostas { email?, telefone? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hubJson, hubOn, HubFail } from "../_shared/hub-ai.ts";
import "./core.js";
import { FERRAMENTAS, limpo, montarEntrada, normalizar, STATUS } from "./regras.ts";

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

const LOG_FERRAMENTAS = [...FERRAMENTAS, "prontas", "agendamento", "takeover"];

async function sha256(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}
function novoCodigo() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return "wam_" + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------------- quem pede ---------------- */
async function adminDoPainel(req: Request) {
  const jwt = bearer(req);
  if (!jwt || jwt === ANON) throw new Erro("Entre no admin para usar o WhatsApp Manager.", 401);
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) throw new Erro("Sessão expirada. Entre de novo.", 401);
  const { data: admin } = await user.rpc("is_admin");
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  if (!admin || aal !== "aal2") throw new Erro("O WhatsApp Manager é do admin, com o autenticador.", 403);
  return { id: data.user.id as string, email: data.user.email || "" };
}
async function dispositivo(b: Any) {
  const t = String(b.token || "");
  if (!/^wam_[A-Za-z0-9_-]{20,64}$/.test(t)) throw new Erro("Extensão não conectada. Gere o código de conexão na página WhatsApp Manager do admin.", 401);
  const { data: d } = await db.from("wa_devices").select("id, user_id, nome, revoked_at").eq("token_hash", await sha256(t)).maybeSingle();
  if (!d || d.revoked_at) throw new Erro("Este código de conexão foi desligado. Gere um novo na página WhatsApp Manager do admin.", 401);
  return d as { id: string; user_id: string; nome: string };
}

/* ---------------- ajustes, conversas e registro ---------------- */
async function ajustesDe(userId: string) {
  const { data } = await db.from("wa_settings").select("settings, version").eq("user_id", userId).maybeSingle();
  return { ajustes: C.limparAjustes(data?.settings || {}), version: data?.version || 0 };
}
async function salvarAjustes(userId: string, novo: Any, version: unknown, parcial = false) {
  const atual = await ajustesDe(userId);
  if (version != null && Number(version) !== atual.version) throw new Erro("Os ajustes mudaram em outro lugar. Recarregue e tente de novo.", 409);
  const a = C.limparAjustes(parcial ? { ...atual.ajustes, ...(novo || {}) } : novo);
  const v = atual.version + 1;
  const { error } = await db.from("wa_settings").upsert({ user_id: userId, settings: a, version: v, updated_at: new Date().toISOString() });
  if (error) throw new Erro("Não foi possível salvar os ajustes.", 500);
  return { ajustes: a, version: v };
}
function lerConversa(c: Any) {
  const chave = txt(c?.chave, 120) || txt(c?.nome, 120);
  if (!chave) throw new Erro("Abra uma conversa no WhatsApp Web.");
  return { chave, nome: txt(c?.nome, 120), grupo: c?.grupo === true || /@g\.us$/.test(chave) };
}
async function conversaDe(userId: string, c: { chave: string; nome: string; grupo: boolean }, ajustes: Any) {
  const { data } = await db.from("wa_chats").select("*").eq("user_id", userId).eq("chave", c.chave).maybeSingle();
  if (data) {
    if (c.nome && c.nome !== data.nome) await db.from("wa_chats").update({ nome: c.nome }).eq("id", data.id);
    return data;
  }
  const { data: novo } = await db.from("wa_chats").upsert({ user_id: userId, chave: c.chave, nome: c.nome, grupo: c.grupo, seguir: true, takeover: !c.grupo && ajustes.takeover_individual },
    { onConflict: "user_id,chave" }).select("*").single();
  return novo;
}
const conversaOut = (x: Any) => ({ chave: x.chave, nome: x.nome, grupo: x.grupo, seguir: x.seguir, takeover: x.takeover, aviso_enviado: !!x.aviso_ia_at, lead_id: x.lead_id, atualizado: x.updated_at });
async function registrar(userId: string, deviceId: string | null, c: { chave?: string; nome?: string; grupo?: boolean } | null, ferramenta: string, status: string, texto?: unknown, detalhes: Any = {}) {
  const { data } = await db.from("wa_log").insert({ user_id: userId, device_id: deviceId, chave: c?.chave || null, nome: c?.nome || null, grupo: !!c?.grupo,
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

async function ia(d: { id: string; user_id: string }, b: Any) {
  const f = String(b.ferramenta || "");
  if (!FERRAMENTAS.includes(f)) throw new Erro("Ferramenta desconhecida.");
  if (!hubOn()) throw new Erro("O HUB AI não está configurado no servidor.", 503);
  const c = lerConversa(b.conversa);
  const mensagens = lerMensagens(b.mensagens);
  const { ajustes } = await ajustesDe(d.user_id);
  const conv = await conversaDe(d.user_id, c, ajustes);
  const extra: Any = { pedido: b.pedido, base: b.base, texto: b.texto };
  if (f === "traduzir") extra.idioma_destino = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(b.idioma_destino || "")) ? b.idioma_destino : ajustes.idioma;
  if (!mensagens.length && !["comando", "traduzir"].includes(f)) throw new Erro("Não encontrei mensagens nesta conversa. Role a conversa até aparecerem as mensagens.");

  // IA Takeover: o servidor também confere o ritmo (limite por hora e intervalo do grupo) antes de chamar a IA
  if (f === "responder" || (f === "grupo" && b.takeover === true)) {
    if (!conv.takeover) return { responder: false, motivo: "Takeover desligado nesta conversa" };
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { data: env } = await db.from("wa_log").select("created_at, chave").eq("user_id", d.user_id).eq("ferramenta", "takeover").eq("status", "enviado").gte("created_at", desde);
    const envios = (env || []).map((x: Any) => Date.parse(x.created_at));
    const { data: ultG } = c.grupo ? await db.from("wa_log").select("created_at").eq("user_id", d.user_id).eq("chave", c.chave).eq("ferramenta", "takeover").eq("status", "enviado").order("created_at", { ascending: false }).limit(1) : { data: [] };
    const pode = C.podeResponder(ajustes, envios, Date.now(), c.grupo, ultG?.[0] ? Date.parse(ultG[0].created_at) : 0);
    if (!pode.ok) return { responder: false, motivo: pode.motivo };
    if (!conv.aviso_ia_at) extra.aviso = ajustes.texto_aviso;
  }
  if (f === "responder" || f === "comando" || f === "sugerir") {
    try { const h = await horariosEndeavor(); extra.horarios = h.horarios.slice(0, 6).map((x) => legivel(x, h.timezone, ajustes.idioma)); } catch { /* sem agenda: a IA usa o link */ }
  }
  let r: Any;
  try {
    r = await hubJson({ agent: AGENTE, input: montarEntrada(f, ajustes, c, mensagens, extra), userId: d.user_id, idempotencyKey: "wa-" + crypto.randomUUID(),
      task: "whatsapp_" + f, metadata: { ferramenta: f, grupo: c.grupo }, maxOutputTokens: 4000, timeoutMs: 45_000,
      meter: { agent: AGENTE } });
  } catch (e) { await registrar(d.user_id, d.id, c, f === "responder" ? "takeover" : f, "erro", null, { erro: e instanceof HubFail ? e.code : "erro" }); throw hubErro(e); }
  const out = normalizar(f, r);
  // o aviso da IA é obrigatório na primeira mensagem automática da conversa
  if (extra.aviso && out.responder && out.texto && !out.texto.toLowerCase().includes(ajustes.texto_aviso.slice(0, 18).toLowerCase())) out.texto = ajustes.texto_aviso + " " + out.texto;
  const textoLog = out.resposta || out.texto || out.mensagem || out.traducao || out.resumo || "";
  const status = out.escalar ? "escalado" : (f === "responder" && !out.responder) || (f === "grupo" && !out.responder && b.takeover === true) ? "ignorado" : "sugerido";
  out.log_id = await registrar(d.user_id, d.id, c, f === "responder" || (f === "grupo" && b.takeover === true) ? "takeover" : f, status, textoLog, out.motivo ? { motivo: txt(out.motivo, 200), ferramenta: f } : { ferramenta: f });
  out.aviso_incluido = !!extra.aviso && !!out.responder;
  return out;
}
/* ---------------- CRM, agenda e propostas existentes ---------------- */
async function criarLead(d: { id: string; user_id: string }, b: Any) {
  const c = lerConversa(b.conversa);
  const nome = txt(b.nome, 120), email = txt(b.email, 160).toLowerCase(), assunto = txt(b.assunto, 200), resumo = limpo(txt(b.resumo, 600), 600);
  let fone = String(b.telefone || "").replace(/[^\d+]/g, "");
  if (!fone && /^\d{8,15}@c\.us$/.test(c.chave)) fone = "+" + c.chave.split("@")[0];
  if (fone && !fone.startsWith("+")) fone = "+" + fone;
  if (fone && !/^\+[1-9]\d{6,14}$/.test(fone)) throw new Erro("Telefone inválido. Use o código do país, por exemplo +1 407 555 0100.");
  if (!nome) throw new Erro("Informe o nome do contato.");
  if (email && !EMAIL.test(email)) throw new Erro("E-mail inválido.");
  if (!email && !fone) throw new Erro("Informe o e-mail ou o telefone do contato.");
  const nota = `WhatsApp (My WhatsApp Manager) · ${new Date().toISOString().slice(0, 10)}${assunto ? " · Interesse: " + assunto : ""}${resumo ? "\n" + resumo : ""}`;
  let q = db.from("leads").select("id, notes").order("created_at", { ascending: false }).limit(1);
  q = email ? q.ilike("email", email) : q.eq("phone", fone);
  const { data: ex } = await q;
  let id: string, novo = false;
  if (ex?.[0]) {
    id = ex[0].id;
    await db.from("leads").update({ notes: ((ex[0].notes ? ex[0].notes + "\n" : "") + nota).slice(-19000), updated_at: new Date().toISOString(), ...(fone ? { phone: fone } : {}) }).eq("id", id);
  } else {
    const { data, error } = await db.from("leads").insert({ name: nome, email: email || null, phone: fone || null, message: assunto || null, assistance: "WhatsApp", source: "whatsapp", status: "contacted",
      marketing_consent: false, notes: nota, last_contact_at: new Date().toISOString() }).select("id").single();
    if (error) { console.error("lead", error); throw new Erro("Não foi possível criar o lead: " + (/email/.test(error.message) ? "confira o e-mail." : /name/.test(error.message) ? "o nome precisa ter pelo menos 2 letras." : "tente de novo."), 500); }
    id = data.id; novo = true;
  }
  await db.from("wa_chats").update({ lead_id: id, updated_at: new Date().toISOString() }).eq("user_id", d.user_id).eq("chave", c.chave);
  await registrar(d.user_id, d.id, c, "lead", "criado", `${nome}${assunto ? " · " + assunto : ""}`, { lead_id: id, novo });
  return { ok: true, lead_id: id, novo, link: `${SITE}/admin.html#/crm` };
}
async function agendar(d: { id: string; user_id: string }, b: Any) {
  const c = lerConversa(b.conversa);
  const ini = new Date(String(b.inicio || ""));
  if (isNaN(ini.getTime()) || ini.getTime() < Date.now()) throw new Erro("Escolha um horário da lista.");
  const nome = txt(b.nome, 120), email = txt(b.email, 160).toLowerCase();
  let fone = String(b.telefone || "").replace(/[^\d+]/g, "");
  if (fone && !fone.startsWith("+")) fone = "+" + fone;
  if (!nome || !EMAIL.test(email)) throw new Erro("Confirme o nome e o e-mail do contato (a confirmação vai por e-mail).");
  if (!/^\+[1-9]\d{6,14}$/.test(fone)) throw new Erro("Informe o telefone com o código do país, por exemplo +1 407 555 0100.");
  const tipo = ["video", "phone", "whatsapp"].includes(b.tipo) ? b.tipo : "whatsapp";
  const { ajustes } = await ajustesDe(d.user_id);
  const tz = txt(b.timezone, 64) || "America/New_York";
  const { data, error } = await db.rpc("book_slot_v2", { p_starts_at: ini.toISOString(), p_name: nome, p_email: email, p_phone: fone, p_topic: txt(b.assunto, 100) || "Conversa pelo WhatsApp",
    p_notes: "Agendado pelo My WhatsApp Manager.", p_meeting_type: tipo, p_language: ajustes.idioma.slice(0, 2), p_timezone: tz });
  if (error) {
    const m = error.message || "";
    await registrar(d.user_id, d.id, c, "agendamento", "erro", null, { erro: m.slice(0, 120) });
    throw new Erro(/slot_unavailable/.test(m) ? "Esse horário acabou de ser ocupado. Escolha outro." : /too_many/.test(m) ? "Este contato já tem horários marcados. Use o link do e-mail para mudar." : /invalid_phone/.test(m) ? "Telefone inválido." : "Não foi possível marcar agora. Tente de novo.", 409);
  }
  const quando = legivel(data?.[0]?.starts_at || ini.toISOString(), tz, ajustes.idioma);
  await registrar(d.user_id, d.id, c, "agendamento", "criado", `Horário marcado: ${quando}`, { booking_id: data?.[0]?.booking_id, inicio: ini.toISOString(), tipo });
  return { ok: true, quando, mensagem: `Pronto! Sua conversa com a Endeavor está marcada para ${quando}. Você vai receber a confirmação por e-mail.` };
}
async function propostas(b: Any) {
  const email = txt(b.email, 160).toLowerCase();
  let fone = String(b.telefone || "").replace(/[^\d+]/g, "");
  if (fone && !fone.startsWith("+")) fone = "+" + fone;
  if (!email && !fone) return { propostas: [], nova: `${SITE}/admin.html#/pagamentos?tab=nova-proposta` };
  let q = db.from("leads").select("id").limit(5);
  q = email ? q.ilike("email", email) : q.eq("phone", fone);
  const { data: ls } = await q;
  const ids = (ls || []).map((l: Any) => l.id);
  let cq = db.from("clients").select("id, name").limit(10);
  cq = ids.length ? cq.in("lead_id", ids) : cq.ilike("primary_email", email || "-");
  const { data: cs } = await cq;
  const cids = (cs || []).map((x: Any) => x.id);
  if (!cids.length) return { propostas: [], nova: `${SITE}/admin.html#/pagamentos?tab=nova-proposta` };
  const { data: ps } = await db.from("proposals").select("id, title, status, token, language, created_at, client_id").in("client_id", cids).in("status", ["sent", "viewed", "accepted", "draft"]).order("created_at", { ascending: false }).limit(10);
  return { propostas: (ps || []).map((p: Any) => ({ id: p.id, titulo: p.title || "Proposta", status: p.status, criada: p.created_at,
    link: p.status === "draft" ? "" : `${SITE}/proposal.html?t=${p.token}&lang=${p.language || "pt"}` })), nova: `${SITE}/admin.html#/pagamentos?tab=nova-proposta` };
}

/* ================================================================ extensão ================================================================ */
async function extensao(b: Any) {
  const d = await dispositivo(b);
  const visto = (extra: Any = {}) => db.from("wa_devices").update({ last_seen: new Date().toISOString(), ...extra }).eq("id", d.id).then(() => { }, () => { });
  switch (b.acao) {
    case "ext_iniciar": {
      await visto({ ext_version: txt(b.versao, 20) || null });
      const [a, { data: cs }, { data: u }] = await Promise.all([ajustesDe(d.user_id), db.from("wa_chats").select("*").eq("user_id", d.user_id).order("updated_at", { ascending: false }).limit(300), db.auth.admin.getUserById(d.user_id)]);
      return { ...a, conversas: (cs || []).map(conversaOut), dispositivo: d.nome, usuario: u?.user?.email || "", ia: hubOn() };
    }
    case "ext_ping": {
      const e = b.estado || {};
      await visto({ estado: { takeover_ativo: e.takeover_ativo === true, pausado: e.pausado === true, conversa: txt(e.conversa, 120), whatsapp: e.whatsapp === true, em: new Date().toISOString() } });
      const a = await ajustesDe(d.user_id);
      return Number(b.version) === a.version ? { version: a.version } : a;
    }
    case "ext_ajustes": return await salvarAjustes(d.user_id, b.ajustes, b.version, true);
    case "ext_conversa": {
      const c = lerConversa(b.conversa);
      const { ajustes } = await ajustesDe(d.user_id);
      const conv = await conversaDe(d.user_id, c, ajustes);
      const up: Any = { updated_at: new Date().toISOString() };
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
        await db.from("wa_log").update(up).eq("id", logId).eq("user_id", d.user_id);
      } else await registrar(d.user_id, d.id, c, String(b.ferramenta || "comando"), status, b.texto, b.detalhes && typeof b.detalhes === "object" ? { motivo: txt(b.detalhes.motivo, 200) } : {});
      // a primeira mensagem automática enviada leva o aviso da IA: marca a conversa
      if (c && status === "enviado" && b.aviso_incluido === true) await db.from("wa_chats").update({ aviso_ia_at: new Date().toISOString() }).eq("user_id", d.user_id).eq("chave", c.chave);
      return { ok: true };
    }
    case "ext_lead": return await criarLead(d, b);
    case "ext_horarios": {
      const h = await horariosEndeavor();
      const { ajustes } = await ajustesDe(d.user_id);
      return { ...h, legiveis: h.horarios.map((x) => legivel(x, h.timezone, ajustes.idioma)) };
    }
    case "ext_agendar": return await agendar(d, b);
    case "ext_propostas": return await propostas(b);
  }
  throw new Erro("Ação desconhecida.");
}

/* ================================================================ painel (admin) ================================================================ */
async function painel(req: Request, b: Any) {
  const u = await adminDoPainel(req);
  switch (b.acao) {
    case "wa_painel": {
      const hoje = new Date(); hoje.setUTCHours(0, 0, 0, 0);
      const [a, { data: ds }, { data: cs }, { data: lg }] = await Promise.all([
        ajustesDe(u.id),
        db.from("wa_devices").select("id, nome, ext_version, estado, created_at, last_seen, revoked_at").eq("user_id", u.id).order("created_at", { ascending: false }),
        db.from("wa_chats").select("*").eq("user_id", u.id).order("updated_at", { ascending: false }).limit(300),
        db.from("wa_log").select("ferramenta, status").eq("user_id", u.id).gte("created_at", hoje.toISOString()).limit(5000)]);
      const hojeRes: Record<string, number> = {};
      (lg || []).forEach((x: Any) => { hojeRes[x.status] = (hojeRes[x.status] || 0) + 1; });
      return { ...a, ia: hubOn(), hoje: hojeRes, conversas: (cs || []).map(conversaOut),
        dispositivos: (ds || []).map((x: Any) => ({ id: x.id, nome: x.nome, versao: x.ext_version, estado: x.estado, criado: x.created_at, visto: x.last_seen, ativo: !x.revoked_at,
          online: !x.revoked_at && !!x.last_seen && Date.now() - Date.parse(x.last_seen) < 150_000 })) };
    }
    case "wa_ajustes": return await salvarAjustes(u.id, b.ajustes, b.version);
    case "wa_conectar": {
      const { count } = await db.from("wa_devices").select("id", { count: "exact", head: true }).eq("user_id", u.id).is("revoked_at", null);
      if ((count || 0) >= 10) throw new Erro("Já há 10 navegadores conectados. Desligue um antes de gerar outro código.", 409);
      const codigo = novoCodigo();
      const { data, error } = await db.from("wa_devices").insert({ user_id: u.id, nome: txt(b.nome, 60) || "Chrome", token_hash: await sha256(codigo) }).select("id").single();
      if (error) throw new Erro("Não foi possível gerar o código.", 500);
      return { id: data.id, codigo };
    }
    case "wa_revogar": {
      const { error } = await db.from("wa_devices").update({ revoked_at: new Date().toISOString() }).eq("id", uuid(b.id) || NADA).eq("user_id", u.id);
      if (error) throw new Erro("Não foi possível desligar.", 500);
      return { ok: true };
    }
    case "wa_registro": {
      let q = db.from("wa_log").select("id, chave, nome, grupo, ferramenta, status, texto, detalhes, created_at").eq("user_id", u.id).order("id", { ascending: false }).limit(Math.min(500, Number(b.limite) || 100));
      if (Number(b.antes)) q = q.lt("id", Number(b.antes));
      if (LOG_FERRAMENTAS.includes(b.ferramenta)) q = q.eq("ferramenta", b.ferramenta);
      if (STATUS.includes(b.status)) q = q.eq("status", b.status);
      const { data, error } = await q;
      if (error) throw new Erro("Não foi possível ler o registro.", 500);
      return { registro: data || [] };
    }
    case "wa_conversa": {
      const chave = txt(b.chave, 120);
      const up: Any = { updated_at: new Date().toISOString() };
      if (typeof b.seguir === "boolean") up.seguir = b.seguir;
      if (typeof b.takeover === "boolean") up.takeover = b.takeover;
      const { data } = await db.from("wa_chats").update(up).eq("user_id", u.id).eq("chave", chave).select("*").maybeSingle();
      if (!data) throw new Erro("Conversa não encontrada.", 404);
      return { conversa: conversaOut(data) };
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
