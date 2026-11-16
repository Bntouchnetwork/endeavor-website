// Endeavor Live Webinar (função webinar). Ferramenta separada do Web Meeting, no mesmo Endeavor (mesmo login, CRM, agenda e HUB AI).
//
// Um webinar é uma sessão agendada que toca uma apresentação PUBLICADA no AI Presentation Studio, sincronizada pelo relógio
// do servidor (quem chega atrasado entra no ponto certo). O chat é real: só pessoas reais escrevem como participantes. O
// assistente de IA aparece sempre como IA; as perguntas frequentes aparecem como "Pergunta frequente", nunca como alguém do
// público. O contador mostra o número REAL de pessoas assistindo, e só a partir do mínimo escolhido pelo organizador.
// Na caixa privada ("Falar em particular") a pessoa deixa os contatos com consentimento (vira lead no CRM existente) e
// escolhe um horário livre de verdade na agenda existente (book_slot_v2 da Endeavor ou a página de agendamento da empresa).
//
// Painel (Authorization: sessão do Supabase; admin com autenticador, ou equipe da empresa com o Web Meeting liberado):
//   lw_listar { client_id? } | lw_obter { id } | lw_salvar { id?, version?, client_id?, titulo, descricao, studio_id, starts_at, timezone, settings }
//   lw_ia_plano { id } (gera as perguntas frequentes pelo HUB) | lw_plano_salvar { id, faq } | lw_agendar { id } | lw_cancelar { id }
//   lw_duplicar { id, starts_at } (repetir em outra data) | lw_apagar { id }
//   lw_aovivo { id, desde } | lw_controle { id, comando: pausar|retomar|encerrar, version } | lw_moderar { id, msg_id, oculto }
//   lw_anfitriao { id, texto, registration_id? } | lw_relatorio { id }
// Público (sem login; a inscrição dá um token pessoal):
//   pub_info { slug } | pub_inscrever { slug, nome, email, telefone?, aceite, marketing? } | pub_entrar { slug, token }
//   pub_estado { slug, token, sessao, desde, desde_priv, pos?, ping? } | pub_mensagem { slug, token, texto, canal }
//   pub_contato { slug, token, nome, email, telefone?, assunto?, consentimento } | pub_horarios { slug, token }
//   pub_agendar { slug, token, inicio, tipo?, telefone?, assunto? } | pub_link { slug, token }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hubJson, hubKey, hubOn, HubFail } from "../_shared/hub-ai.ts";
import { validar } from "../meet/presentation.ts";
import { hashFala, limparConfig, textoFalado } from "../meet/studio.ts";
import { enviarEmail, mailOn, moldura } from "../meet/acoes.ts";
import "./core.js";
import { calcularRelatorio, limparFaq, limparSettings } from "./regras.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWebinarCore;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "";
const NADA = "00000000-0000-0000-0000-000000000000";
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const quando = (iso: string, tz: string, lang = "pt-BR") => {
  try { return new Intl.DateTimeFormat(lang, { timeZone: tz || "America/New_York", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso)); }
  catch { return new Date(iso).toUTCString(); }
};
const TZS = (() => { try { return new Set((Intl as Any).supportedValuesOf("timeZone")); } catch { return null; } })();

/* ---------------- quem está pedindo (painel) ---------------- */
async function usuario(req: Request) {
  const jwt = bearer(req);
  if (!jwt || jwt === ANON) return null;
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: admin } = await user.rpc("is_admin");
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  return { id: data.user.id, email: data.user.email || "", admin: !!admin && aal === "aal2", user };
}
type U = NonNullable<Awaited<ReturnType<typeof usuario>>>;
async function podeEmpresa(u: U, clientId: string | null) {
  if (u.admin) return true;
  if (!clientId) return false;
  const { data: papel } = await u.user.rpc("my_client_role", { p_client: clientId });
  if (!papel) return false;
  const { data: a } = await db.from("meet_access").select("enabled").eq("client_id", clientId).maybeSingle();
  return !!a?.enabled;
}
async function webinarDoPainel(u: U, id: unknown) {
  const { data: w } = await db.from("lw_webinars").select("*").eq("id", uuid(id) || NADA).is("deleted_at", null).maybeSingle();
  if (!w || !await podeEmpresa(u, w.client_id)) throw new Erro("Webinar não encontrado.", 404);
  return w;
}
const acao = (w: Any, tipo: string, detalhes: Any = {}, regId: string | null = null, status = "ok") =>
  db.from("lw_actions").insert({ webinar_id: w.id, registration_id: regId, tipo, status, detalhes }).then(() => { }, () => { });

const linhaDe = (w: Any) => C.linhaDoTempo(w.content?.slides || [], w.narration || {}, w.ritmo || "normal");

/* ================================================================ painel ================================================================ */
async function painel(req: Request, b: Any) {
  const u = await usuario(req);
  if (!u) throw new Erro("Entre no painel para usar o Live Webinar.", 401);
  switch (b.acao) {
    case "lw_listar": {
      let q = db.from("lw_webinars").select("id, client_id, slug, title, starts_at, timezone, status, playback, content->slides, narration, ritmo, studio_version, clients(name)").is("deleted_at", null).order("starts_at", { ascending: false }).limit(200);
      const c = String(b.client_id || "");
      if (!u.admin) { if (!uuid(c) || !await podeEmpresa(u, c)) throw new Erro("Sem acesso ao Live Webinar desta empresa.", 403); q = q.eq("client_id", c); }
      else if (c === "endeavor") q = q.is("client_id", null);
      else if (uuid(c)) q = q.eq("client_id", c);
      const { data, error } = await q;
      if (error) throw new Erro("Não foi possível listar: " + error.message, 500);
      const ids = (data || []).map((w: Any) => w.id);
      const regs: Record<string, number> = {};
      if (ids.length) { const { data: r } = await db.from("lw_registrations").select("webinar_id").in("webinar_id", ids); (r || []).forEach((x: Any) => { regs[x.webinar_id] = (regs[x.webinar_id] || 0) + 1; }); }
      const agora = Date.now();
      return { webinars: (data || []).map((w: Any) => {
        const linha = C.linhaDoTempo(w.slides || [], w.narration || {}, w.ritmo);
        const p = w.status === "scheduled" ? C.posicao(w, linha, agora) : { estado: w.status };
        return { id: w.id, slug: w.slug, titulo: w.title, empresa: w.client_id ? w.clients?.name : "Endeavor", client_id: w.client_id, starts_at: w.starts_at, timezone: w.timezone,
          status: w.status, estado: p.estado, duracao_ms: C.total(linha), inscritos: regs[w.id] || 0, link: `${SITE}/webinar.html?w=${w.slug}` };
      }) };
    }

    case "lw_obter": {
      const w = await webinarDoPainel(u, b.id);
      return { webinar: painelW(w), apresentacoes: await publicadas(w.client_id) };
    }

    case "lw_novo_dados": {
      const c = b.client_id && b.client_id !== "endeavor" ? String(b.client_id) : null;
      if (!await podeEmpresa(u, c)) throw new Erro("Sem acesso.", 403);
      return { apresentacoes: await publicadas(c) };
    }

    case "lw_salvar": {
      const novo = !b.id;
      const w = novo ? null : await webinarDoPainel(u, b.id);
      if (w && w.status !== "draft" && C.posicao(w, linhaDe(w), Date.now()).estado !== "antes") throw new Erro("Este webinar já começou; não dá para mudar a apresentação ou o horário.", 409);
      if (w && Number(b.version) !== w.version) throw new Erro("Este webinar foi alterado em outra janela. Recarregue.", 409);
      const c = novo ? (b.client_id && b.client_id !== "endeavor" ? String(b.client_id) : null) : w.client_id;
      if (novo && c && !uuid(c)) throw new Erro("Empresa inválida.");
      if (novo && !c && !u.admin) throw new Erro("Escolha a empresa.", 403);
      if (novo && !await podeEmpresa(u, c)) throw new Erro("O Web Meeting não está habilitado para esta empresa.", 403);
      const titulo = txt(b.titulo, 140);
      if (titulo.length < 3) throw new Erro("Dê um título ao webinar.");
      const ini = new Date(String(b.starts_at || ""));
      if (isNaN(ini.getTime())) throw new Erro("Escolha a data e a hora.");
      const tz = String(b.timezone || "America/New_York");
      if (TZS && !TZS.has(tz)) throw new Erro("Fuso horário inválido.");
      const studioId = uuid(b.studio_id) || null;
      if (studioId) {
        const { data: s } = await db.from("meet_studio").select("id, client_id, published_version").eq("id", studioId).is("deleted_at", null).maybeSingle();
        if (!s || (s.client_id || null) !== (c || null)) throw new Erro("Apresentação não encontrada nesta empresa.");
        if (!s.published_version) throw new Erro("Publique a apresentação no Studio antes de usá-la num webinar.");
      }
      const row: Any = { title: titulo, description: txt(b.descricao, 2000), studio_id: studioId, starts_at: ini.toISOString(), timezone: tz,
        settings: limparSettings({ ...(w?.settings || {}), ...(b.settings || {}) }), updated_at: new Date().toISOString() };
      if (novo) {
        const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "webinar";
        row.slug = `${base}-${crypto.randomUUID().slice(0, 6)}`.replace(/^-/, "");
        if (row.slug.length < 6) row.slug = "webinar-" + crypto.randomUUID().slice(0, 6);
        const { data, error } = await db.from("lw_webinars").insert({ ...row, client_id: c, owner_id: u.id }).select("*").single();
        if (error) throw new Erro("Não foi possível criar: " + error.message, 500);
        await acao(data, "criar", { por: u.id });
        return { webinar: painelW(data) };
      }
      // mudou a apresentação ou o horário de um webinar agendado: volta a rascunho até agendar de novo (nova cópia)
      if (w.status === "scheduled" && (studioId !== w.studio_id)) row.status = "draft";
      const { data, error } = await db.from("lw_webinars").update({ ...row, version: w.version + 1 }).eq("id", w.id).eq("version", w.version).select("*").maybeSingle();
      if (error) throw new Erro("Não foi possível salvar: " + error.message, 500);
      if (!data) throw new Erro("Este webinar foi alterado em outra janela. Recarregue.", 409);
      return { webinar: painelW(data) };
    }

    case "lw_ia_plano": {
      const w = await webinarDoPainel(u, b.id);
      const content = await conteudoPublicado(w);
      if (!hubOn()) throw new Erro("A IA da Endeavor (HUB AI) não está configurada no servidor.", 503);
      const slides = content.slides.map((s: Any, i: number) => ({ i, titulo: s.titulo, itens: s.itens, roteiro: String(s.roteiro || "").slice(0, 900) }));
      let j: Any;
      try {
        j = await hubJson({ agent: "webinar-host", input: `<modo>faq</modo>\n<idioma>${limparSettings(w.settings).idioma}</idioma>\n<webinar>${txt(w.title, 140)}</webinar>\n<apresentacao>${JSON.stringify(slides).slice(0, 24000)}</apresentacao>`,
          userId: `webinar:${u.id}`, idempotencyKey: hubKey("lw-faq", w.id, Date.now()), maxOutputTokens: 2500, timeoutMs: 90_000, meter: { agent: "webinar-host", client_id: w.client_id } });
      } catch (e) { throw new Erro(e instanceof HubFail && e.kind === "limit" ? "O limite de uso da IA foi atingido." : "A IA não respondeu agora. Tente de novo.", 502); }
      const faq = limparFaq(j?.faq, content.slides.length);
      if (!faq.length) throw new Erro("A IA não devolveu perguntas. Tente de novo.", 502);
      await db.from("lw_webinars").update({ ai_plan: { faq, gerado_em: new Date().toISOString() } }).eq("id", w.id);
      await acao(w, "ia_faq", { itens: faq.length });
      return { faq };
    }
    case "lw_plano_salvar": {
      const w = await webinarDoPainel(u, b.id);
      const faq = limparFaq(b.faq, (w.content?.slides || []).length || 30);
      await db.from("lw_webinars").update({ ai_plan: { ...(w.ai_plan || {}), faq, revisado_em: new Date().toISOString() } }).eq("id", w.id);
      return { faq };
    }

    case "lw_agendar": {
      const w = await webinarDoPainel(u, b.id);
      if (!w.studio_id) throw new Erro("Escolha a apresentação do Studio.");
      if (new Date(w.starts_at).getTime() < Date.now() + 2 * 60_000) throw new Erro("Escolha um horário no futuro (pelo menos 2 minutos a partir de agora).");
      const { data: s } = await db.from("meet_studio").select("*").eq("id", w.studio_id).is("deleted_at", null).maybeSingle();
      if (!s?.published_version) throw new Erro("Publique a apresentação no Studio antes de agendar.");
      const { data: v } = await db.from("meet_studio_versions").select("content, settings").eq("studio_id", s.id).eq("version", s.published_version).maybeSingle();
      if (!v) throw new Erro("Versão publicada não encontrada.", 404);
      const content = validar(v.content);
      const cfg = limparConfig(v.settings);
      // narração pronta para o texto exato desta versão (mesma voz, idioma, ritmo e pronúncia)
      const narration: Record<string, Any> = {};
      if (cfg.voz_id) {
        const { data: ns } = await db.from("meet_narrations").select("slide_id, script_hash, audio_path, duration_ms").eq("studio_id", s.id).eq("voice_profile_id", cfg.voz_id).eq("status", "ready");
        for (const sl of content.slides) {
          if (!sl.roteiro) continue;
          const h = await hashFala(cfg.idioma, cfg.ritmo, textoFalado(sl.roteiro, cfg.pronuncia));
          const n = (ns || []).find((x: Any) => x.slide_id === sl.id && x.script_hash === h);
          if (n?.audio_path) narration[sl.id] = { path: n.audio_path, duracao_ms: n.duration_ms || 0 };
        }
      }
      const { data, error } = await db.from("lw_webinars").update({ status: "scheduled", content, narration, ritmo: cfg.ritmo, studio_version: s.published_version,
        settings: limparSettings({ ...w.settings, idioma: w.settings?.idioma || cfg.idioma, legendas: cfg.legendas }), playback: {}, version: w.version + 1, updated_at: new Date().toISOString() })
        .eq("id", w.id).eq("version", w.version).select("*").maybeSingle();
      if (error) throw new Erro("Não foi possível agendar: " + error.message, 500);
      if (!data) throw new Erro("Este webinar foi alterado em outra janela. Recarregue.", 409);
      await acao(w, "agendar", { studio_version: s.published_version, narracoes: Object.keys(narration).length, slides: content.slides.length });
      return { webinar: painelW(data), aviso: Object.keys(narration).length < content.slides.filter((x: Any) => x.roteiro).length
        ? "Alguns slides não têm narração pronta com a sua voz: eles passam no tempo do roteiro, com legenda." : "" };
    }
    case "lw_cancelar": {
      const w = await webinarDoPainel(u, b.id);
      await db.from("lw_webinars").update({ status: "cancelled", version: w.version + 1 }).eq("id", w.id);
      await acao(w, "cancelar", { por: u.id });
      return { ok: true };
    }
    case "lw_duplicar": {
      const w = await webinarDoPainel(u, b.id);
      const ini = new Date(String(b.starts_at || ""));
      if (isNaN(ini.getTime()) || ini.getTime() < Date.now()) throw new Erro("Escolha uma data futura para a nova sessão.");
      const slug = (w.slug.replace(/-[a-z0-9]{6}$/, "") + "-" + crypto.randomUUID().slice(0, 6)).slice(0, 60);
      const { data, error } = await db.from("lw_webinars").insert({ client_id: w.client_id, owner_id: u.id, slug, title: w.title, description: w.description, studio_id: w.studio_id,
        starts_at: ini.toISOString(), timezone: w.timezone, settings: w.settings, ai_plan: w.ai_plan, status: "draft" }).select("*").single();
      if (error) throw new Erro("Não foi possível criar a nova sessão: " + error.message, 500);
      await acao(data, "repetir", { de: w.id });
      return { webinar: painelW(data) };
    }
    case "lw_apagar": {
      const w = await webinarDoPainel(u, b.id);
      await db.from("lw_webinars").update({ deleted_at: new Date().toISOString(), status: "cancelled" }).eq("id", w.id);
      await acao(w, "apagar", { por: u.id });
      return { ok: true };
    }

    case "lw_aovivo": {
      const w = await webinarDoPainel(u, b.id);
      const linha = linhaDe(w), p = C.posicao(w, linha, Date.now());
      const desde = Math.max(0, Number(b.desde) || 0);
      const { data: msgs } = await db.from("lw_messages").select("id, registration_id, canal, autor, nome, texto, extra, oculto, created_at").eq("webinar_id", w.id).gt("id", desde).order("id").limit(300);
      return { agora: Date.now(), estado: p.estado, pos: p.pos, total: C.total(linha), slide: C.slideNa(linha, p.pos).i, playback: w.playback, version: w.version,
        ao_vivo: await assistindo(w.id), contador_minimo: limparSettings(w.settings).contador_minimo, ia_pausada: !!w.settings?.ia_pausada, mensagens: msgs || [] };
    }
    case "lw_controle": {
      const w = await webinarDoPainel(u, b.id);
      if (w.status !== "scheduled") throw new Erro("O webinar não está agendado.");
      if (Number(b.version) !== w.version) throw new Erro("Outro comando chegou antes deste. A tela foi atualizada; confira e tente de novo.", 409);
      const pb = { ...(w.playback || {}) }, agora = new Date();
      const est = C.posicao(w, linhaDe(w), agora.getTime()).estado;
      if (b.comando === "pausar") { if (est !== "ao_vivo") throw new Erro("Só dá para pausar durante a apresentação."); pb.pausado_em = agora.toISOString(); }
      else if (b.comando === "retomar") { if (!pb.pausado_em) throw new Erro("A apresentação não está pausada."); pb.pausa_total_ms = (Number(pb.pausa_total_ms) || 0) + (agora.getTime() - Date.parse(pb.pausado_em)); delete pb.pausado_em; }
      else if (b.comando === "encerrar") { if (est === "antes") throw new Erro("O webinar ainda não começou; use Cancelar."); pb.encerrado_em = agora.toISOString(); delete pb.pausado_em; }
      else if (b.comando === "ia") { await db.from("lw_webinars").update({ settings: { ...w.settings, ia_pausada: !!b.pausada }, version: w.version + 1 }).eq("id", w.id).eq("version", w.version); await acao(w, b.pausada ? "ia_pausar" : "ia_retomar", { por: u.id }); return { ok: true }; }
      else throw new Erro("Comando desconhecido.");
      const { data } = await db.from("lw_webinars").update({ playback: pb, version: w.version + 1 }).eq("id", w.id).eq("version", w.version).select("version").maybeSingle();
      if (!data) throw new Erro("Outro comando chegou antes deste. Confira e tente de novo.", 409);
      await acao(w, "controle_" + b.comando, { por: u.id });
      return { ok: true, version: data.version };
    }
    case "lw_moderar": {
      const w = await webinarDoPainel(u, b.id);
      await db.from("lw_messages").update({ oculto: !!b.oculto }).eq("webinar_id", w.id).eq("id", Number(b.msg_id) || 0);
      await acao(w, "moderar", { msg: Number(b.msg_id) || 0, oculto: !!b.oculto, por: u.id });
      return { ok: true };
    }
    case "lw_anfitriao": {
      const w = await webinarDoPainel(u, b.id);
      const texto = txt(b.texto, 1000);
      if (!texto) throw new Erro("Escreva a mensagem.");
      const regId = uuid(b.registration_id) || null;
      if (regId) { const { data: r } = await db.from("lw_registrations").select("id").eq("id", regId).eq("webinar_id", w.id).maybeSingle(); if (!r) throw new Erro("Participante não encontrado.", 404); }
      const { data: nome } = await db.from("clients").select("name").eq("id", w.client_id || NADA).maybeSingle();
      await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: regId, canal: regId ? "privado" : "publico", autor: "anfitriao", nome: (nome?.name || "Endeavor") + " (equipe)", texto });
      return { ok: true };
    }
    case "lw_relatorio": {
      const w = await webinarDoPainel(u, b.id);
      return await relatorio(w);
    }
  }
  throw new Erro("Ação desconhecida.");
}
function painelW(w: Any) {
  const linha = linhaDe(w);
  return { id: w.id, slug: w.slug, client_id: w.client_id, titulo: w.title, descricao: w.description, studio_id: w.studio_id, studio_version: w.studio_version, starts_at: w.starts_at,
    timezone: w.timezone, status: w.status, settings: limparSettings(w.settings), faq: w.ai_plan?.faq || [], version: w.version, slides: (w.content?.slides || []).map((s: Any) => ({ id: s.id, titulo: s.titulo })),
    narracoes: Object.keys(w.narration || {}).length, duracao_ms: C.total(linha), estado: w.status === "scheduled" ? C.posicao(w, linha, Date.now()).estado : w.status, link: `${SITE}/webinar.html?w=${w.slug}` };
}
async function publicadas(clientId: string | null) {
  let q = db.from("meet_studio").select("id, title, published_version, published_at, content->slides").is("deleted_at", null).not("published_version", "is", null).order("published_at", { ascending: false }).limit(100);
  q = clientId ? q.eq("client_id", clientId) : q.is("client_id", null);
  const { data } = await q;
  return (data || []).map((s: Any) => ({ id: s.id, titulo: s.title, versao: s.published_version, slides: Array.isArray(s.slides) ? s.slides.length : 0 }));
}
async function conteudoPublicado(w: Any) {
  if (w.content?.slides?.length) return w.content;
  if (!w.studio_id) throw new Erro("Escolha a apresentação do Studio primeiro.");
  const { data: s } = await db.from("meet_studio").select("published_version").eq("id", w.studio_id).maybeSingle();
  const { data: v } = await db.from("meet_studio_versions").select("content").eq("studio_id", w.studio_id).eq("version", s?.published_version || -1).maybeSingle();
  if (!v) throw new Erro("Publique a apresentação no Studio primeiro.");
  return validar(v.content);
}
async function assistindo(wid: string) {
  const { data } = await db.from("lw_attendance").select("registration_id").eq("webinar_id", wid).gt("last_seen", new Date(Date.now() - 40_000).toISOString());
  return new Set((data || []).map((x: Any) => x.registration_id)).size;
}

/* ---------------- relatório ---------------- */
async function relatorio(w: Any) {
  const linha = linhaDe(w);
  const [{ data: att }, { data: regs }, { data: msgs }, { data: acts }] = await Promise.all([
    db.from("lw_attendance").select("registration_id, first_seen, last_seen, seconds, first_pos_ms, last_pos_ms").eq("webinar_id", w.id).limit(20000),
    db.from("lw_registrations").select("id, name, email, created_at, lead_id, contact_id").eq("webinar_id", w.id).order("created_at").limit(5000),
    db.from("lw_messages").select("registration_id, canal, autor").eq("webinar_id", w.id).eq("autor", "participante").limit(20000),
    db.from("lw_actions").select("registration_id, tipo, status").eq("webinar_id", w.id).limit(20000)]);
  const r = calcularRelatorio(linha, att || [], (regs || []).length);
  const porReg: Record<string, Any> = {};
  for (const a of att || []) { const p = porReg[a.registration_id] ||= { s: 0, fim: 0 }; p.s += a.seconds || 0; p.fim = Math.max(p.fim, a.last_pos_ms || 0); }
  const perg: Record<string, number> = {}; for (const m of msgs || []) perg[m.registration_id] = (perg[m.registration_id] || 0) + 1;
  const ok = (t: string) => (acts || []).filter((a: Any) => a.tipo === t && a.status === "ok");
  const ag = new Set(ok("agendamento").map((a: Any) => a.registration_id));
  return { ...r, perguntas: (msgs || []).length, perguntas_publicas: (msgs || []).filter((m: Any) => m.canal === "publico").length, leads: ok("lead").length, agendamentos: ok("agendamento").length,
    links: ok("link").length, duracao_ms: C.total(linha), slides: (w.content?.slides || []).map((s: Any) => s.titulo || ""),
    pessoas: (regs || []).map((g: Any) => ({ nome: g.name, email: g.email, inscrito_em: g.created_at, minutos: Math.round((porReg[g.id]?.s || 0) / 6) / 10,
      assistiu_pct: C.total(linha) ? Math.min(100, Math.round(100 * (porReg[g.id]?.fim || 0) / C.total(linha))) : 0, perguntas: perg[g.id] || 0, lead: !!(g.lead_id || g.contact_id), agendou: ag.has(g.id) })) };
}

/* ================================================================ público ================================================================ */
async function webinarPublico(slug: unknown) {
  const s = String(slug || "").toLowerCase();
  if (!/^[a-z0-9-]{6,60}$/.test(s)) throw new Erro("Webinar não encontrado.", 404);
  const { data: w } = await db.from("lw_webinars").select("*, clients(name)").eq("slug", s).is("deleted_at", null).maybeSingle();
  if (!w || w.status === "draft") throw new Erro("Webinar não encontrado.", 404);
  return w;
}
async function inscricao(w: Any, token: unknown) {
  const { data: r } = await db.from("lw_registrations").select("*").eq("webinar_id", w.id).eq("token", uuid(token) || NADA).maybeSingle();
  if (!r) throw new Erro("Inscrição não encontrada. Use o link do e-mail ou inscreva-se de novo.", 403);
  return r;
}
const empresaNome = (w: Any) => w.client_id ? (w.clients?.name || "") : "Endeavor Business Solutions";

async function publico(req: Request, b: Any) {
  const w = await webinarPublico(b.slug);
  const cfg = limparSettings(w.settings);
  const agora = Date.now();
  const linha = linhaDe(w);
  const pos = w.status === "scheduled" ? C.posicao(w, linha, agora) : { estado: "cancelado", pos: 0 };

  switch (b.acao) {
    case "pub_info":
      return { titulo: w.title, descricao: w.description, empresa: empresaNome(w), starts_at: w.starts_at, timezone: w.timezone, duracao_ms: C.total(linha), estado: pos.estado,
        idioma: cfg.idioma, inscricao_aberta: w.status === "scheduled" && pos.estado !== "encerrado", agora };

    case "pub_inscrever": {
      if (b.website) return { ok: true };
      if (w.status !== "scheduled" || pos.estado === "encerrado") throw new Erro("As inscrições deste webinar estão encerradas.", 409);
      const nome = txt(b.nome, 120), email = txt(b.email, 254).toLowerCase(), fone = txt(b.telefone, 40);
      if (nome.length < 2) throw new Erro("Escreva o seu nome.");
      if (!EMAIL.test(email)) throw new Erro("E-mail inválido.");
      if (b.aceite !== true) throw new Erro("Confirme que leu o aviso sobre a apresentação e o assistente de IA.");
      const { count } = await db.from("lw_registrations").select("id", { count: "exact", head: true }).eq("webinar_id", w.id).gte("created_at", new Date(agora - 3600_000).toISOString());
      if ((count || 0) > 3000) throw new Erro("Muitas inscrições agora. Tente de novo em alguns minutos.", 429);
      const { data: ja } = await db.from("lw_registrations").select("id, token").eq("webinar_id", w.id).ilike("email", email).maybeSingle();
      const link = (t: string) => `${SITE}/webinar.html?w=${w.slug}&t=${t}`;
      if (ja) {
        // já inscrito: o link pessoal vai só para o e-mail (não aparece na tela de quem digitou)
        await emailInscricao(w, email, nome, link(ja.token)).catch((e) => console.error("email", e));
        return { ok: true, ja_inscrito: true, email_enviado: mailOn() };
      }
      const { data: r, error } = await db.from("lw_registrations").insert({ webinar_id: w.id, name: nome, email, phone: fone || null, marketing_consent: b.marketing === true }).select("id, token").single();
      if (error) throw new Erro("Não foi possível fazer a inscrição. Tente de novo.", 500);
      let enviado = false;
      try { await emailInscricao(w, email, nome, link(r.token)); enviado = true; } catch (e) { console.error("email", e); }
      return { ok: true, token: r.token, link: link(r.token), email_enviado: enviado };
    }

    case "pub_entrar": {
      const r = await inscricao(w, b.token);
      if (w.status === "cancelled") return { cancelado: true, titulo: w.title };
      const fim = new Date(w.starts_at).getTime() + C.total(linha) + 3 * 3600_000;
      const expira = Math.max(3600, Math.round((fim - agora) / 1000));
      const audios: Record<string, string> = {};
      for (const [sid, n] of Object.entries(w.narration || {}) as [string, Any][]) {
        const { data } = await db.storage.from("meet-media").createSignedUrl(n.path, Math.min(expira, 7 * 86400));
        if (data?.signedUrl) audios[sid] = data.signedUrl;
      }
      const legendas = cfg.legendas;
      return { titulo: w.title, descricao: w.description, empresa: empresaNome(w), nome: r.name, starts_at: w.starts_at, timezone: w.timezone, agora,
        slides: (w.content?.slides || []).map((s: Any) => { const { notas: _n, ...resto } = s; return legendas ? resto : (({ roteiro: _r, ...x }) => x)(resto); }),
        narracao: Object.fromEntries(Object.entries(w.narration || {}).map(([k, v]: [string, Any]) => [k, { duracao_ms: v.duracao_ms }])), audios, ritmo: w.ritmo,
        playback: w.playback, estado: pos.estado, chat_abre_min: cfg.chat_abre_min, agendamento: cfg.agendamento, idioma: cfg.idioma,
        ia: cfg.chat_ia && hubOn(), contato_ok: !!(r.lead_id || r.contact_id) };
    }

    case "pub_estado": {
      const r = await inscricao(w, b.token);
      const sessao = txt(b.sessao, 64);
      if (b.ping && sessao.length >= 8 && (pos.estado === "ao_vivo" || pos.estado === "pausado")) await registrarPresenca(w, r, sessao, pos.pos);
      if (pos.estado === "ao_vivo" || pos.estado === "pausado" || pos.estado === "encerrado") await postarProgramadas(w, linha, pos);
      const desde = Math.max(0, Number(b.desde) || 0), desdePriv = Math.max(0, Number(b.desde_priv) || 0);
      const [{ data: pub }, { data: priv }] = await Promise.all([
        db.from("lw_messages").select("id, autor, nome, texto, extra, created_at").eq("webinar_id", w.id).eq("canal", "publico").eq("oculto", false).gt("id", desde).order("id").limit(100),
        db.from("lw_messages").select("id, autor, nome, texto, extra, created_at").eq("webinar_id", w.id).eq("canal", "privado").eq("registration_id", r.id).gt("id", desdePriv).order("id").limit(100)]);
      // depois de um tempo, mensagens ocultadas pela moderação somem também para quem já tinha recebido
      const { data: ocultas } = await db.from("lw_messages").select("id").eq("webinar_id", w.id).eq("oculto", true).gt("created_at", new Date(agora - 3600_000).toISOString()).limit(200);
      const n = await assistindo(w.id);
      return { agora, estado: pos.estado, pos: pos.pos, playback: w.playback, contador: C.contadorVisivel(n, cfg.contador_minimo), publicas: pub || [], privadas: priv || [],
        ocultas: (ocultas || []).map((x: Any) => x.id), ia: cfg.chat_ia && !cfg.ia_pausada && hubOn() };
    }

    case "pub_mensagem": {
      const r = await inscricao(w, b.token);
      const canal = b.canal === "privado" ? "privado" : "publico";
      const abre = new Date(w.starts_at).getTime() - cfg.chat_abre_min * 60_000;
      if (w.status !== "scheduled" || agora < abre) throw new Erro("O chat abre " + cfg.chat_abre_min + " minutos antes do início.", 409);
      if (pos.estado === "encerrado" && canal === "publico" && agora > new Date(w.starts_at).getTime() + C.total(linha) + 30 * 60_000) throw new Erro("O chat deste webinar foi encerrado.", 409);
      let texto = txt(b.texto, 600);
      if (!texto) throw new Erro("Escreva a mensagem.");
      // limite: 1 mensagem a cada 8 s e 40 por pessoa
      const { data: ult } = await db.from("lw_messages").select("created_at").eq("webinar_id", w.id).eq("registration_id", r.id).eq("autor", "participante").order("id", { ascending: false }).limit(40);
      if ((ult || []).length >= 40) throw new Erro("Você chegou ao limite de mensagens deste webinar. Use “Falar em particular” para continuar.", 429);
      if (ult?.[0] && agora - Date.parse(ult[0].created_at) < 8000) throw new Erro("Espere alguns segundos antes de mandar outra mensagem.", 429);
      let removido = false;
      if (canal === "publico") { const m = C.mascararDados(texto); texto = m.texto; removido = m.removido; }
      const primeiroNome = r.name.split(/\s+/)[0];
      const { data: msg } = await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: r.id, canal, autor: "participante", nome: canal === "publico" ? primeiroNome : r.name, texto }).select("id").single();
      if (removido) await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: r.id, canal: "privado", autor: "sistema", nome: "Aviso",
        texto: "Para sua segurança, tiramos e-mail e telefone da sua mensagem no chat aberto. Para deixar seus contatos, use “Falar em particular”." });
      if (cfg.chat_ia && !cfg.ia_pausada && hubOn()) await responderIA(w, r, linha, pos, canal, texto, msg?.id).catch((e) => console.error("ia", e));
      return { ok: true, removido };
    }

    case "pub_contato": {
      const r = await inscricao(w, b.token);
      if (b.consentimento !== true) throw new Erro("Para a equipe entrar em contato, marque a autorização.");
      const nome = txt(b.nome || r.name, 120), email = txt(b.email || r.email, 254).toLowerCase(), fone = txt(b.telefone, 40), assunto = txt(b.assunto, 300);
      if (nome.length < 2 || !EMAIL.test(email)) throw new Erro("Confira o nome e o e-mail.");
      const ids = await criarLead(w, r, { nome, email, fone, assunto });
      await db.from("lw_registrations").update({ ...ids, ...(fone ? { phone: fone } : {}) }).eq("id", r.id);
      await acao(w, "lead", { origem: "caixa privada", ...ids }, r.id);
      await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: r.id, canal: "privado", autor: "sistema", nome: "Confirmação",
        texto: `Recebemos seus contatos, ${nome.split(/\s+/)[0]}. A equipe de ${empresaNome(w)} vai falar com você sobre o seu caso.` + (cfg.agendamento === "calendario" ? " Se quiser, escolha agora um horário abaixo." : "") });
      return { ok: true, agendamento: cfg.agendamento };
    }

    case "pub_horarios": {
      const r = await inscricao(w, b.token);
      if (cfg.agendamento !== "calendario") throw new Erro("Este webinar não oferece agendamento direto.", 409);
      if (!r.lead_id && !r.contact_id) throw new Erro("Deixe seus contatos primeiro.", 409);
      return await horarios(w);
    }

    case "pub_agendar": {
      const r = await inscricao(w, b.token);
      if (cfg.agendamento !== "calendario") throw new Erro("Este webinar não oferece agendamento direto.", 409);
      if (!r.lead_id && !r.contact_id) throw new Erro("Deixe seus contatos primeiro.", 409);
      return await agendar(req, w, r, b);
    }

    case "pub_link": {
      const r = await inscricao(w, b.token);
      const link = await linkAgenda(w);
      if (!link) throw new Erro("Esta empresa ainda não tem uma página de agendamento.", 409);
      await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: r.id, canal: "privado", autor: "sistema", nome: "Agendamento", texto: "Aqui está o link para escolher o melhor horário: " + link, extra: { link } });
      let email = false;
      try {
        await enviarEmail([r.email], `Link para agendar: ${w.title}`, `Olá, ${r.name.split(/\s+/)[0]}.\n\nComo pedido no webinar "${w.title}", aqui está o link para escolher um horário com ${empresaNome(w)}:\n${link}`,
          moldura(`Agendar com ${empresaNome(w)}`, `<p>Olá, ${esc(r.name.split(/\s+/)[0])}.</p><p>Como pedido no webinar <b>${esc(w.title)}</b>, use o botão abaixo para escolher um horário.</p>`, { rot: "Escolher horário", url: link }));
        email = true;
      } catch (e) { console.error("email link", e); }
      await acao(w, "link", { email }, r.id);
      return { ok: true, link, email };
    }
  }
  throw new Erro("Ação desconhecida.");
}

async function emailInscricao(w: Any, email: string, nome: string, link: string) {
  const qd = quando(w.starts_at, w.timezone);
  await enviarEmail([email], `Inscrição confirmada: ${w.title}`,
    `Olá, ${nome.split(/\s+/)[0]}.\n\nSua inscrição no webinar "${w.title}" está confirmada.\nQuando: ${qd}\nSeu link pessoal (não compartilhe): ${link}\n\nA apresentação é pré-gravada com a voz autorizada do organizador, e o chat tem um assistente de IA identificado como tal. A equipe acompanha as mensagens.`,
    moldura("Inscrição confirmada", `<p>Olá, ${esc(nome.split(/\s+/)[0])}.</p><p>Sua inscrição no webinar <b>${esc(w.title)}</b> está confirmada.</p><p><b>Quando:</b> ${esc(qd)}</p><p style="font-size:13px;color:#6b7280">A apresentação é pré-gravada com a voz autorizada do organizador, e o chat tem um assistente de IA identificado como tal. O link abaixo é pessoal; não compartilhe.</p>`, { rot: "Entrar no webinar", url: link }));
}

async function registrarPresenca(w: Any, r: Any, sessao: string, posMs: number) {
  const { data: a } = await db.from("lw_attendance").select("id, last_seen, seconds").eq("webinar_id", w.id).eq("registration_id", r.id).eq("session_id", sessao).maybeSingle();
  const agora = new Date();
  if (!a) { await db.from("lw_attendance").insert({ webinar_id: w.id, registration_id: r.id, session_id: sessao, first_pos_ms: Math.round(posMs), last_pos_ms: Math.round(posMs) }); return; }
  const delta = Math.min(30, Math.max(0, Math.round((agora.getTime() - Date.parse(a.last_seen)) / 1000)));
  await db.from("lw_attendance").update({ last_seen: agora.toISOString(), seconds: a.seconds + delta, last_pos_ms: Math.round(posMs) }).eq("id", a.id);
}

async function postarProgramadas(w: Any, linha: Any[], pos: Any) {
  const devidas = C.programadas(w, linha).filter((m: Any) => m.em <= pos.pos && pos.pos - m.em < 10 * 60_000);
  if (!devidas.length) return;
  const { data: ja } = await db.from("lw_messages").select("chave").eq("webinar_id", w.id).in("chave", devidas.map((m: Any) => m.chave));
  const tem = new Set((ja || []).map((x: Any) => x.chave));
  for (const m of devidas) {
    if (tem.has(m.chave)) continue;
    // a chave única impede repetir quando dois navegadores chegam juntos
    await db.from("lw_messages").insert({ webinar_id: w.id, canal: "publico", autor: m.autor, nome: m.autor === "faq" ? "Pergunta frequente" : "Assistente (IA)", texto: m.texto,
      extra: m.resposta ? { resposta: m.resposta } : {}, chave: m.chave }).then(() => { }, () => { });
  }
}

async function responderIA(w: Any, r: Any, linha: Any[], pos: Any, canal: string, pergunta: string, msgId?: number) {
  // limite do assistente: 30 respostas por minuto por webinar (o resto fica para a equipe)
  const { count } = await db.from("lw_messages").select("id", { count: "exact", head: true }).eq("webinar_id", w.id).eq("autor", "ia").gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((count || 0) >= 30) return;
  const atual = C.slideNa(linha, pos.pos).i;
  const slides = (w.content?.slides || []).map((s: Any, i: number) => ({ i, atual: i === atual || undefined, titulo: s.titulo, itens: s.itens, roteiro: String(s.roteiro || "").slice(0, 700) }));
  const faq = (w.ai_plan?.faq || []).filter((f: Any) => f.aprovada !== false).map((f: Any) => ({ pergunta: f.pergunta, resposta: f.resposta }));
  const { data: hist } = await db.from("lw_messages").select("autor, texto").eq("webinar_id", w.id).eq("canal", canal).eq("oculto", false)
    .match(canal === "privado" ? { registration_id: r.id } : {}).order("id", { ascending: false }).limit(8);
  const cfg = limparSettings(w.settings);
  const input = [`<modo>${canal === "privado" ? "privado" : "responder"}</modo>`, `<idioma>${cfg.idioma}</idioma>`, `<empresa>${empresaNome(w)}</empresa>`,
    `<webinar>${txt(w.title, 140)}</webinar>`, `<agendamento>${cfg.agendamento}</agendamento>`,
    `<apresentacao>${JSON.stringify(slides).slice(0, 20000)}</apresentacao>`, `<faq>${JSON.stringify(faq).slice(0, 6000)}</faq>`,
    `<historico>${JSON.stringify((hist || []).reverse()).slice(0, 4000)}</historico>`, `<pergunta>${pergunta}</pergunta>`].join("\n");
  let j: Any;
  try {
    j = await hubJson({ agent: "webinar-host", input, userId: `webinar:${w.id}:${r.id}`, idempotencyKey: hubKey("lw-chat", w.id, msgId || Date.now()), maxOutputTokens: 600, timeoutMs: 25_000, meter: { agent: "webinar-host", client_id: w.client_id } });
  } catch (e) { await acao(w, "ia_falhou", { erro: String((e as Error).message).slice(0, 200) }, r.id, "erro"); return; }
  let resposta = txt(j?.resposta, 900);
  if (!resposta) return;
  if (canal === "publico") resposta = C.mascararDados(resposta).texto;
  if (j?.inadequada && msgId) await db.from("lw_messages").update({ oculto: true }).eq("id", msgId);
  const extra: Any = {};
  if (j?.convidar_privado) extra.convite_privado = true;
  if (j?.mostrar_agenda) extra.mostrar_agenda = true;
  await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: canal === "privado" ? r.id : null, canal, autor: "ia", nome: "Assistente (IA)", texto: resposta, extra, responde_a: msgId || null });
  if (j?.escalar) await acao(w, "escalar", { msg: msgId, pergunta: pergunta.slice(0, 300) }, r.id, "pendente");
}

/* ---------------- CRM e agenda existentes ---------------- */
async function criarLead(w: Any, r: Any, o: { nome: string; email: string; fone: string; assunto: string }) {
  const nota = `Live Webinar "${w.title}" (${w.slug}) · ${new Date().toISOString().slice(0, 10)}${o.assunto ? " · Interesse: " + o.assunto : ""}`;
  if (!w.client_id) {
    const { data: ex } = await db.from("leads").select("id, notes").ilike("email", o.email).order("created_at", { ascending: false }).limit(1);
    if (ex?.[0]) {
      await db.from("leads").update({ notes: ((ex[0].notes ? ex[0].notes + "\n" : "") + nota).slice(-19000), updated_at: new Date().toISOString(), ...(o.fone ? { phone: o.fone } : {}) }).eq("id", ex[0].id);
      return { lead_id: ex[0].id };
    }
    const { data, error } = await db.from("leads").insert({ name: o.nome, email: o.email, phone: o.fone || null, message: o.assunto || null, assistance: "Live Webinar", source: "webinar", status: "new",
      marketing_consent: !!r.marketing_consent, notes: nota, language: limparSettings(w.settings).idioma.slice(0, 5) }).select("id").single();
    if (error) throw new Erro("Não foi possível registrar seus contatos agora. Tente de novo.", 500);
    return { lead_id: data.id };
  }
  const { data: has } = await db.rpc("client_has_service", { p_client: w.client_id, p_code: "crm" });
  if (!has) return {}; // a empresa não usa o CRM do Endeavor: o contato fica na inscrição e no relatório
  const { data: ex } = await db.from("ct_contacts").select("id").eq("client_id", w.client_id).ilike("email", o.email).limit(1);
  let id = ex?.[0]?.id;
  if (!id) { const { data } = await db.from("ct_contacts").insert({ client_id: w.client_id, name: o.nome, email: o.email, phone: o.fone || null, source: "Live Webinar", stage: "new" }).select("id").single(); id = data?.id; }
  if (id) await db.from("ct_notes").insert({ contact_id: id, client_id: w.client_id, created_by: "webinar", body: nota });
  return id ? { contact_id: id } : {};
}
async function paginaAgenda(w: Any) {
  const { data } = await db.from("ct_booking_pages").select("slug, timezone").eq("client_id", w.client_id).eq("active", true).order("updated_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}
async function linkAgenda(w: Any) {
  if (!w.client_id) return `${SITE}/booking.html`;
  const p = await paginaAgenda(w);
  return p ? `${SITE}/agendar.html?p=${p.slug}` : "";
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
async function horarios(w: Any) {
  const de = new Date(), ate = new Date(Date.now() + 14 * 86400_000);
  if (!w.client_id) {
    const [{ data: s, error }, { data: info }] = await Promise.all([db.rpc("get_available_slots", { p_from: ymd(de), p_to: ymd(ate) }), db.rpc("get_booking_info")]);
    if (error) throw new Erro("A agenda não respondeu agora. Tente de novo.", 502);
    const tz = info?.[0]?.timezone || "America/New_York";
    return { horarios: (s || []).map((x: Any) => x.slot).filter((x: string) => Date.parse(x) > Date.now()).slice(0, 60), timezone: tz, tipos: ["video", "phone", "whatsapp"], telefone_obrigatorio: true };
  }
  const p = await paginaAgenda(w);
  if (!p) throw new Erro("Esta empresa ainda não tem uma página de agendamento.", 409);
  const { data: s, error } = await db.rpc("ct_slots", { p_slug: p.slug, p_from: ymd(de), p_to: ymd(ate) });
  if (error) throw new Erro("A agenda não respondeu agora. Tente de novo.", 502);
  return { horarios: (s || []).map((x: Any) => typeof x === "string" ? x : x.ct_slots).filter((x: string) => Date.parse(x) > Date.now()).slice(0, 60), timezone: p.timezone, tipos: [], telefone_obrigatorio: false };
}
async function agendar(req: Request, w: Any, r: Any, b: Any) {
  const ini = new Date(String(b.inicio || ""));
  if (isNaN(ini.getTime()) || ini.getTime() < Date.now()) throw new Erro("Escolha um horário da lista.");
  const { count } = await db.from("lw_actions").select("id", { count: "exact", head: true }).eq("webinar_id", w.id).eq("registration_id", r.id).eq("tipo", "agendamento").eq("status", "ok");
  if ((count || 0) >= 1) throw new Erro("Você já marcou um horário a partir deste webinar. Para mudar, use o link do e-mail de confirmação.", 409);
  const assunto = txt(b.assunto, 100) || `Live Webinar: ${w.title}`.slice(0, 100);
  const tz = txt(b.timezone, 64) || w.timezone;
  let quandoTxt = "";
  if (!w.client_id) {
    const fone = String(b.telefone || r.phone || "").replace(/[^\d+]/g, "");
    if (!/^\+[1-9]\d{6,14}$/.test(fone)) throw new Erro("Informe o telefone com o código do país, por exemplo +1 407 555 0100.");
    const tipo = ["video", "phone", "whatsapp"].includes(b.tipo) ? b.tipo : "video";
    const { data, error } = await db.rpc("book_slot_v2", { p_starts_at: ini.toISOString(), p_name: r.name, p_email: r.email, p_phone: fone, p_topic: assunto,
      p_notes: `Agendado pela caixa privada do Live Webinar "${w.title}".`, p_meeting_type: tipo, p_language: limparSettings(w.settings).idioma.slice(0, 2), p_timezone: tz });
    if (error) {
      const m = error.message || "";
      await acao(w, "agendamento", { erro: m.slice(0, 120) }, r.id, "erro");
      throw new Erro(/slot_unavailable/.test(m) ? "Esse horário acabou de ser ocupado. Escolha outro." : /too_many/.test(m) ? "Você já tem horários marcados com a Endeavor. Use o link do e-mail para mudar." : /invalid_phone/.test(m) ? "Telefone inválido." : "Não foi possível marcar agora. Tente de novo.", 409);
    }
    quandoTxt = quando(data?.[0]?.starts_at || ini.toISOString(), tz);
    await acao(w, "agendamento", { booking_id: data?.[0]?.booking_id, inicio: ini.toISOString(), tipo }, r.id);
  } else {
    const p = await paginaAgenda(w);
    if (!p) throw new Erro("Esta empresa ainda não tem uma página de agendamento.", 409);
    // usa a mesma rota pública da página de agendamento da empresa: mesmos e-mails de confirmação e o mesmo CRM
    const res = await fetch(`${SUPABASE_URL}/functions/v1/tools`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
      body: JSON.stringify({ action: "agenda_book", slug: p.slug, start: ini.toISOString(), name: r.name, email: r.email, phone: txt(b.telefone || r.phone, 40), notes: `Live Webinar: ${w.title}`, tz, lang: limparSettings(w.settings).idioma.slice(0, 2) }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      await acao(w, "agendamento", { erro: String(j.error || res.status) }, r.id, "erro");
      throw new Erro(j.error === "slot_unavailable" ? "Esse horário acabou de ser ocupado. Escolha outro." : "Não foi possível marcar agora. Tente de novo.", 409);
    }
    quandoTxt = quando(j.start_at, tz);
    await acao(w, "agendamento", { inicio: j.start_at, pagina: p.slug }, r.id);
  }
  const conf = `Horário confirmado: ${quandoTxt}. Você vai receber a confirmação por e-mail` + (!w.client_id ? " (e por WhatsApp, quando estiver ligado)." : ".");
  await db.from("lw_messages").insert({ webinar_id: w.id, registration_id: r.id, canal: "privado", autor: "sistema", nome: "Agendamento", texto: conf });
  return { ok: true, confirmacao: conf };
}

/* ================================================================ servidor ================================================================ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  let b: Any = {};
  try { b = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  try {
    const a = String(b.acao || "");
    if (a.startsWith("pub_")) return json(await publico(req, b));
    if (a.startsWith("lw_")) return json(await painel(req, b));
    if (a === "status") return json({ ok: true, ia: hubOn(), email: mailOn() });
    throw new Erro("Ação desconhecida.");
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "O servidor do Live Webinar não concluiu a ação. Tente de novo." }, 502);
  }
});
