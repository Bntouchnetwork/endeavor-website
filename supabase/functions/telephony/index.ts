// Telefonia (Endeavor Corporate Phone) — função do admin e do portal. Fase 1: provedor de DEMONSTRAÇÃO.
// Tudo que é demonstração sai com demo = true e a tela mostra "Demonstração". Nenhuma ligação, SMS ou número é real.
//
// Admin (admin com autenticador): adm_painel | adm_lista | adm_acesso | adm_buscar | adm_propor | adm_aprovar | adm_status_numero
//   adm_planos_salvar | adm_config_salvar | adm_tarifa_salvar | adm_tarifa_apagar | adm_usuarios | adm_usuario_salvar | adm_usuario_remover
// Portal (membro do cliente, com autenticador, empresa liberada): p_inicio | p_contatos | p_contato_salvar | p_contato_apagar | p_crm_contatos
//   p_importar_crm | p_recentes | p_ligar | p_desligar | p_atender | p_recusar | p_mensagens | p_conversa | p_enviar_sms | p_voicemails
//   p_vm_ouvido | p_routing_salvar | p_estimar | p_consumo | p_novidades | p_simular | p_webrtc
// Segurança: chaves da Telnyx só nos Secrets; compra de número em dois passos (proposta → "CONTRATAR" de um admin) e, na fase 1,
// bloqueada para números reais; isolamento por empresa em todas as ações (company_id conferido contra o cliente e a liberação).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decidirChamada, e164, estimarEncaminhamento, ehDemo, limparRouting, numerosDemo, palavraChave, partesSms, podeEnviarSms, situacaoConsumo, tarifa, tipoDoNumero, TOLLFREE } from "./regras.ts";
import { demo, telnyx, type Provedor } from "./provedor.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const bloco = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f<>]/g, " ").trim().slice(0, max);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : "";
const NADA = "00000000-0000-0000-0000-000000000000";
const agora = () => new Date().toISOString();
const mesAtual = () => new Date().toISOString().slice(0, 7) + "-01";
const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

/* ---------------- provedor ---------------- */
async function ajustes() {
  const { data } = await db.from("tel_settings").select("*").eq("id", 1).maybeSingle();
  return data || { provedor: "demo", margem_encaminhamento_pct: 30, paises_encaminhamento: ["US", "CA"], alertas_pct: [80, 100], limite_mensal_padrao_cents: 5000, retencao_gravacoes_dias: 90, retencao_voicemail_dias: 90 };
}
function provedorDe(cfg: Any): Provedor { return cfg.provedor === "telnyx" ? telnyx((k) => Deno.env.get(k)) : demo; }

/* ---------------- quem pede ---------------- */
type Quem = { id: string; email: string; admin: boolean; clientId: string | null; papelCliente: string | null; user: Any };
async function quem(req: Request, b: Any): Promise<Quem> {
  const jwt = bearer(req);
  if (!jwt || jwt === ANON) throw new Erro("Entre no portal para usar a Telefonia.", 401);
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) throw new Erro("Sessão expirada. Entre de novo.", 401);
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  if (aal !== "aal2") throw new Erro("Entre com o autenticador para usar a Telefonia.", 403);
  const { data: admin } = await user.rpc("is_admin");
  const clientId = uuid(b.clientId) || null;
  let papel: string | null = null;
  if (clientId && !admin) {
    const { data: p } = await user.rpc("my_client_role", { p_client: clientId });
    papel = p || null;
    if (!papel) throw new Erro("Sem acesso a esta empresa.", 403);
  }
  return { id: data.user.id, email: data.user.email || "", admin: !!admin, clientId, papelCliente: papel, user };
}
/** empresa liberada + permissões do usuário nela (isolamento: a empresa tem de ser do cliente informado) */
async function empresa(q: Quem, companyId: unknown) {
  const id = uuid(companyId) || NADA;
  const { data: a } = await db.from("tel_access").select("*, companies(id, legal_name, client_id)").eq("company_id", id).maybeSingle();
  if (!a) throw new Erro("A Telefonia não está liberada para esta empresa.", 403);
  if (q.admin) return { acesso: a, papel: "admin", pode: { ligar: true, sms: true, gravacoes: true, admin: true } };
  if (!a.enabled) throw new Erro("A Telefonia não está liberada para esta empresa. Fale com a Endeavor.", 403);
  if (a.client_id !== q.clientId) throw new Erro("Sem acesso a esta empresa.", 403);
  const { data: alcance } = await q.user.rpc("can_access_company", { p_client: a.client_id, p_company: id });
  if (!alcance) throw new Erro("Sem acesso a esta empresa.", 403);
  if (q.papelCliente === "owner") return { acesso: a, papel: "admin", pode: { ligar: true, sms: true, gravacoes: true, admin: true } };
  const { data: u } = await db.from("tel_users").select("*").eq("company_id", id).eq("user_id", q.id).maybeSingle();
  if (!u) throw new Erro("Você ainda não tem acesso ao telefone desta empresa. Peça ao titular da conta.", 403);
  return { acesso: a, papel: u.papel, pode: { ligar: u.pode_ligar, sms: u.pode_sms, gravacoes: u.pode_gravacoes, admin: u.papel === "admin" } };
}
const soAdmin = (q: Quem) => { if (!q.admin) throw new Erro("Só o admin da Endeavor faz isto.", 403); };
async function auditar(q: Quem | null, acao: string, tipo: string, id: string | null, clientId: string | null, companyId: string | null, det: Any = {}) {
  await db.rpc("audit_write", { p_action: "telefonia." + acao, p_entity_type: tipo, p_entity_id: id, p_client: clientId, p_company: companyId, p_details: det,
    p_actor_email: q?.email || null, p_actor_role: q ? (q.admin ? "admin" : "user") : "system" }).then(() => {}, (e: unknown) => console.error("auditoria", e));
}
async function sino(titulo: string, corpo: string, link: string) {
  await db.from("admin_events").insert({ kind: "telefonia", title: titulo.slice(0, 300), body: corpo.slice(0, 2000), link }).then(() => {}, () => {});
}

/* ---------------- consumo ---------------- */
async function somarUso(companyId: string, d: { min_in?: number; min_out?: number; sms_in?: number; sms_out?: number; custo?: number; preco?: number }) {
  const per = mesAtual();
  const { data: u } = await db.from("tel_usage").select("*").eq("company_id", companyId).eq("periodo", per).maybeSingle();
  const n = { company_id: companyId, periodo: per, minutos_entrada: Number(u?.minutos_entrada || 0) + (d.min_in || 0), minutos_saida: Number(u?.minutos_saida || 0) + (d.min_out || 0),
    sms_entrada: (u?.sms_entrada || 0) + (d.sms_in || 0), sms_saida: (u?.sms_saida || 0) + (d.sms_out || 0), custo: Number(u?.custo || 0) + (d.custo || 0), preco: Number(u?.preco || 0) + (d.preco || 0),
    estimado: true, alertas_enviados: u?.alertas_enviados || [], updated_at: agora() };
  await db.from("tel_usage").upsert(n, { onConflict: "company_id,periodo" });
  // alertas de 80% e 100% da franquia (uma vez por mês cada)
  const [{ data: a }, cfg] = await Promise.all([db.from("tel_access").select("plan_id, limite_mensal_cents, client_id, companies(legal_name)").eq("company_id", companyId).maybeSingle(), ajustes()]);
  if (!a?.plan_id) return;
  const { data: plano } = await db.from("tel_plans").select("*").eq("id", a.plan_id).maybeSingle();
  const s = situacaoConsumo(n, plano, a.limite_mensal_cents, cfg.alertas_pct);
  if (s.alerta && !n.alertas_enviados.includes(s.alerta)) {
    await db.from("tel_usage").update({ alertas_enviados: [...n.alertas_enviados, s.alerta] }).eq("company_id", companyId).eq("periodo", per);
    await sino(`Telefonia: ${(a as Any).companies?.legal_name || "empresa"} chegou a ${s.alerta}% da franquia`, `Minutos: ${s.minutos} (${s.pct_minutos}%). SMS: ${s.sms} (${s.pct_sms}%). Valores estimados.`, "#/telefonia?aba=consumo&empresa=" + companyId);
  }
}
async function rates() { const { data } = await db.from("tel_rates").select("*"); return data || []; }

/* ---------------- dados do portal ---------------- */
async function numerosDa(companyId: string) {
  const { data } = await db.from("tel_numbers").select("*").eq("company_id", companyId).in("status", ["aguardando_aprovacao", "ativo", "suspenso"]).order("created_at");
  return data || [];
}
async function numeroDa(companyId: string, numberId: unknown, ativo = true) {
  const { data: n } = await db.from("tel_numbers").select("*").eq("id", uuid(numberId) || NADA).eq("company_id", companyId).maybeSingle();
  if (!n) throw new Erro("Número não encontrado nesta empresa.", 404);
  if (ativo && n.status !== "ativo") throw new Erro(n.status === "suspenso" ? "Este número está suspenso." : "Este número ainda não está ativo.", 409);
  return n;
}
async function principal(companyId: string) {
  const ns = (await numerosDa(companyId)).filter((n: Any) => n.status === "ativo");
  if (!ns.length) throw new Erro("A empresa ainda não tem número ativo.", 409);
  return ns[0];
}

/* ---------------- ações ---------------- */
async function acao(q: Quem, b: Any) {
  const cfg = await ajustes();
  const prov = provedorDe(cfg);
  const modoDemo = prov.nome === "demo";
  switch (b.acao) {
    /* ===== admin ===== */
    case "adm_painel": {
      soAdmin(q);
      const [estado, planos, acessos, numeros, tarifas, uso, chamadas, msgs] = await Promise.all([
        prov.estado(), db.from("tel_plans").select("*").order("ordem"), db.from("tel_access").select("*, companies(legal_name), clients(name)"),
        db.from("tel_numbers").select("*").in("status", ["aguardando_aprovacao", "ativo", "suspenso"]), db.from("tel_rates").select("*").order("verificado_em", { ascending: false }),
        db.from("tel_usage").select("*").eq("periodo", mesAtual()), db.from("tel_calls").select("id", { count: "exact", head: true }).gte("inicio", mesAtual()),
        db.from("tel_messages").select("id", { count: "exact", head: true }).gte("created_at", mesAtual())]);
      const ativos = (acessos.data || []).filter((a: Any) => a.enabled);
      const planoDe = Object.fromEntries((planos.data || []).map((p: Any) => [p.id, p]));
      const receita = ativos.reduce((s: number, a: Any) => s + (planoDe[a.plan_id]?.preco_cents || 0), 0) / 100;
      const custoUso = (uso.data || []).reduce((s: number, u: Any) => s + Number(u.custo || 0), 0);
      const minutos = (uso.data || []).reduce((s: number, u: Any) => s + Number(u.minutos_entrada || 0) + Number(u.minutos_saida || 0), 0);
      return { estado, settings: cfg, planos: planos.data || [], acessos: acessos.data || [], numeros: numeros.data || [], tarifas: tarifas.data || [],
        dashboard: { numeros_ativos: (numeros.data || []).filter((n: Any) => n.status === "ativo").length, aguardando: (numeros.data || []).filter((n: Any) => n.status === "aguardando_aprovacao").length,
          empresas: ativos.length, chamadas: chamadas.count || 0, sms: msgs.count || 0, minutos, receita_estimada: receita, custo_estimado: custoUso, margem_estimada: receita - custoUso } };
    }
    case "adm_lista": {
      soAdmin(q);
      const tab = ({ chamadas: ["tel_calls", "inicio"], mensagens: ["tel_messages", "created_at"], voicemails: ["tel_voicemails", "created_at"], gravacoes: ["tel_recordings", "created_at"], consumo: ["tel_usage", "periodo"], eventos: ["tel_events", "recebido_em"] } as Any)[b.tipo];
      if (b.tipo === "auditoria") {
        let r = db.from("audit_log").select("at, actor_email, actor_role, action, entity_type, entity_id, company_id, details").like("action", "telefonia.%").order("id", { ascending: false }).limit(300);
        if (uuid(b.company_id)) r = r.eq("company_id", b.company_id);
        const { data } = await r; return { itens: data || [] };
      }
      if (!tab) throw new Erro("Lista desconhecida.");
      let r = db.from(tab[0]).select("*").order(tab[1], { ascending: false }).limit(500);
      if (uuid(b.company_id) && b.tipo !== "eventos") r = r.eq("company_id", b.company_id);
      if (uuid(b.number_id) && ["chamadas", "mensagens", "voicemails"].includes(b.tipo)) r = r.eq("number_id", b.number_id);
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.de || "")) r = r.gte(tab[1], b.de);
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.ate || "")) r = r.lte(tab[1], b.ate + (tab[1] === "periodo" ? "" : "T23:59:59Z"));
      const { data, error } = await r;
      if (error) throw new Erro("Não foi possível ler a lista.", 500);
      return { itens: data || [] };
    }
    case "adm_acesso": {
      soAdmin(q);
      const cid = uuid(b.company_id);
      const { data: co } = await db.from("companies").select("id, client_id, legal_name").eq("id", cid || NADA).maybeSingle();
      if (!co) throw new Erro("Empresa não encontrada.", 404);
      const plano = b.plan_id ? (await db.from("tel_plans").select("id").eq("id", txt(b.plan_id, 40)).maybeSingle()).data : null;
      if (b.plan_id && !plano) throw new Erro("Plano não encontrado.");
      const row = { company_id: co.id, client_id: co.client_id, enabled: b.enabled === true, plan_id: plano?.id || null,
        limite_mensal_cents: Number.isFinite(Number(b.limite_mensal_cents)) && b.limite_mensal_cents !== null && b.limite_mensal_cents !== "" ? Math.max(0, Math.round(Number(b.limite_mensal_cents))) : null,
        sms_permitido: b.sms_permitido !== false, encaminhamento_permitido: b.encaminhamento_permitido === true, gravacao_permitida: b.gravacao_permitida === true, updated_at: agora(), updated_by: q.email };
      if (row.enabled && !row.plan_id) throw new Erro("Escolha o plano antes de liberar.");
      const { error } = await db.from("tel_access").upsert(row, { onConflict: "company_id" });
      if (error) throw new Erro("Não foi possível salvar.", 500);
      await auditar(q, row.enabled ? "liberada" : "desligada", "tel_access", co.id, co.client_id, co.id, { plano: row.plan_id, limite: row.limite_mensal_cents, sms: row.sms_permitido, encaminhamento: row.encaminhamento_permitido, gravacao: row.gravacao_permitida });
      return { acesso: row };
    }
    case "adm_buscar": {
      soAdmin(q);
      const tipo = b.tipo === "tollfree" ? "tollfree" : "local";
      const prefixo = txt(b.prefixo, 3).replace(/\D/g, "");
      if (tipo === "tollfree" && prefixo && !TOLLFREE.includes(prefixo)) throw new Erro("Toll-free: use 800, 888, 877, 866, 855, 844 ou 833.");
      const lista = await prov.buscarNumeros(tipo, prefixo);
      const { data: ocupados } = await db.from("tel_numbers").select("e164").in("e164", lista.map((x) => x.e164)).in("status", ["aguardando_aprovacao", "ativo", "suspenso"]);
      const usados = new Set((ocupados || []).map((x: Any) => x.e164));
      return { numeros: lista.filter((x) => !usados.has(x.e164)), demo: modoDemo };
    }
    // Linha da própria Endeavor (cliente interno "Endeavor Business Hub", status internal): mesmo celular virtual dos clientes
    case "adm_endeavor":
    case "adm_endeavor_criar": {
      soAdmin(q);
      const { data: cl } = await db.from("clients").select("id, name").eq("status", "internal").order("created_at").limit(1).maybeSingle();
      if (!cl) throw new Erro("Cadastro interno da Endeavor não encontrado.", 404);
      const { data: co } = await db.from("companies").select("id, legal_name").eq("client_id", cl.id).order("created_at").limit(1).maybeSingle();
      if (!co) throw new Erro("Empresa interna da Endeavor não encontrada.", 404);
      if (b.acao === "adm_endeavor_criar") {
        const tipo = b.tipo === "tollfree" ? "tollfree" : "local";
        const { data: tem } = await db.from("tel_numbers").select("id").eq("company_id", co.id).in("status", ["ativo", "aguardando_aprovacao"]).limit(1);
        if (tem && tem.length) throw new Erro("A Endeavor já tem uma linha.", 409);
        if (!modoDemo) throw new Erro("Fora do modo demonstração, o número da Endeavor segue o fluxo normal: propor e aprovar com CONTRATAR em Números.", 409);
        await db.from("tel_access").upsert({ company_id: co.id, client_id: cl.id, enabled: true, plan_id: tipo === "tollfree" ? "business" : "professional", limite_mensal_cents: null,
          sms_permitido: true, encaminhamento_permitido: true, gravacao_permitida: false, updated_at: agora(), updated_by: q.email }, { onConflict: "company_id" });
        const { data: usados } = await db.from("tel_numbers").select("e164");
        const ocupados = new Set((usados ?? []).map((x: Any) => x.e164));
        const livre = numerosDemo(tipo, tipo === "tollfree" ? "888" : "407", 10).find((n) => !ocupados.has(n));
        if (!livre) throw new Erro("Sem número de demonstração livre.", 409);
        const r = await demo.comprarNumero(livre);
        const { data: n, error } = await db.from("tel_numbers").insert({ company_id: co.id, client_id: cl.id, e164: livre, tipo, status: "ativo", demo: true, provedor: prov.nome, provider_id: r.provider_id,
          sms_registro: "nao_aplicavel", proposto_por: q.email, aprovado_por: q.email, aprovado_em: agora() }).select().single();
        if (error) throw new Erro("Não foi possível criar a linha.", 500);
        await db.from("tel_routing").upsert({ number_id: n.id, company_id: co.id, greeting: {}, away: {}, horario: { ativo: false, tz: "America/New_York", dias: {} }, destino: "app" }, { onConflict: "number_id", ignoreDuplicates: true });
        await auditar(q, "endeavor.linha_criada", "tel_number", n.id, cl.id, co.id, { e164: livre, tipo, demo: true });
      }
      const { data: ac } = await db.from("tel_access").select("enabled, plan_id").eq("company_id", co.id).maybeSingle();
      const { data: nums } = await db.from("tel_numbers").select("id, e164, tipo, status, demo").eq("company_id", co.id).in("status", ["ativo", "aguardando_aprovacao", "suspenso"]).order("created_at");
      return { endeavor: { client_id: cl.id, company_id: co.id, nome: co.legal_name, acesso: ac || null, numeros: nums || [] }, demo: modoDemo };
    }
    case "adm_propor": {
      soAdmin(q);
      const n = e164(b.e164), tipo = tipoDoNumero(n);
      if (!tipo) throw new Erro("Número inválido (EUA, +1).");
      if (modoDemo && !ehDemo(n)) throw new Erro("No modo demonstração só dá para propor números fictícios (555-01XX).");
      const cid = uuid(b.company_id);
      const { data: a } = await db.from("tel_access").select("company_id, client_id, plan_id").eq("company_id", cid || NADA).maybeSingle();
      if (!a) throw new Erro("Libere a Telefonia para a empresa antes de propor um número.");
      const { data, error } = await db.from("tel_numbers").insert({ company_id: a.company_id, client_id: a.client_id, e164: n, tipo, status: "aguardando_aprovacao", demo: modoDemo, provedor: prov.nome,
        sms_registro: modoDemo ? "nao_aplicavel" : "nao_iniciado", proposto_por: q.email }).select().single();
      if (error) throw new Erro(error.code === "23505" ? "Este número já está proposto ou em uso." : "Não foi possível propor o número.", 409);
      await auditar(q, "numero.proposto", "tel_number", data.id, a.client_id, a.company_id, { e164: n, tipo, demo: modoDemo });
      return { numero: data };
    }
    case "adm_aprovar": {
      soAdmin(q);
      const { data: n } = await db.from("tel_numbers").select("*").eq("id", uuid(b.number_id) || NADA).maybeSingle();
      if (!n || n.status !== "aguardando_aprovacao") throw new Erro("Número não está aguardando aprovação.", 409);
      if (b.confirmacao !== "CONTRATAR") throw new Erro('Para contratar, digite CONTRATAR para confirmar.');
      if (!n.demo) throw new Erro("Compra de número real bloqueada nesta fase. Ela precisa da Fase 2 e da sua autorização explícita.", 409);
      const r = await demo.comprarNumero(n.e164);
      const { data, error } = await db.from("tel_numbers").update({ status: "ativo", provider_id: r.provider_id, aprovado_por: q.email, aprovado_em: agora(), updated_at: agora() }).eq("id", n.id).eq("status", "aguardando_aprovacao").select().single();
      if (error || !data) throw new Erro("Não foi possível ativar.", 409);
      await db.from("tel_routing").upsert({ number_id: n.id, company_id: n.company_id, greeting: {}, away: {}, horario: { ativo: false, tz: "America/New_York", dias: {} }, destino: "app" }, { onConflict: "number_id", ignoreDuplicates: true });
      await auditar(q, "numero.aprovado", "tel_number", n.id, n.client_id, n.company_id, { e164: n.e164, demo: true });
      return { numero: data };
    }
    case "adm_status_numero": {
      soAdmin(q);
      const st = ["ativo", "suspenso", "liberado", "recusado"].includes(b.status) ? b.status : "";
      if (!st) throw new Erro("Situação inválida.");
      const { data: n } = await db.from("tel_numbers").select("*").eq("id", uuid(b.number_id) || NADA).maybeSingle();
      if (!n) throw new Erro("Número não encontrado.", 404);
      const ok = ({ ativo: ["suspenso"], suspenso: ["ativo"], liberado: ["ativo", "suspenso"], recusado: ["aguardando_aprovacao"] } as Any)[st].includes(n.status);
      if (!ok) throw new Erro("Não dá para mudar de " + n.status + " para " + st + ".", 409);
      if (st === "liberado" && b.confirmacao !== "LIBERAR") throw new Erro("Para liberar o número (ele deixa de ser da empresa), digite LIBERAR.");
      await db.from("tel_numbers").update({ status: st, updated_at: agora() }).eq("id", n.id);
      await auditar(q, "numero." + st, "tel_number", n.id, n.client_id, n.company_id, { e164: n.e164, antes: n.status });
      return { ok: true };
    }
    case "adm_planos_salvar": {
      soAdmin(q);
      for (const p of (Array.isArray(b.planos) ? b.planos : []).slice(0, 20)) {
        const id = txt(p.id, 40).toLowerCase();
        if (!/^[a-z0-9_-]{2,40}$/.test(id)) throw new Erro("Código do plano inválido.");
        const num = (v: unknown) => v === null || v === "" || v === undefined ? null : Math.max(0, Number(v));
        const row = { id, nome: txt(p.nome, 60) || id, tipo_numero: p.tipo_numero === "tollfree" ? "tollfree" : "local", preco_cents: Math.round(Math.max(0, Number(p.preco_cents) || 0)),
          numeros_incluidos: Math.min(50, Math.max(1, Math.round(Number(p.numeros_incluidos) || 1))), minutos: Math.round(Math.max(0, Number(p.minutos) || 0)), sms: Math.round(Math.max(0, Number(p.sms) || 0)),
          excedente_min_cents: num(p.excedente_min_cents), excedente_sms_cents: num(p.excedente_sms_cents), ativo: p.ativo !== false, ordem: Math.round(Number(p.ordem) || 0), updated_at: agora() };
        const { error } = await db.from("tel_plans").upsert(row, { onConflict: "id" });
        if (error) throw new Erro("Não foi possível salvar o plano " + row.nome + ".", 500);
      }
      await auditar(q, "planos.salvos", "tel_plans", null, null, null, { planos: (b.planos || []).map((p: Any) => p.id) });
      return { planos: (await db.from("tel_plans").select("*").order("ordem")).data };
    }
    case "adm_config_salvar": {
      soAdmin(q);
      const paises = (Array.isArray(b.paises_encaminhamento) ? b.paises_encaminhamento : []).map((p: unknown) => txt(p, 2).toUpperCase()).filter((p: string) => /^[A-Z]{2}$/.test(p)).slice(0, 30);
      const row = { id: 1, margem_encaminhamento_pct: Math.min(500, Math.max(0, Number(b.margem_encaminhamento_pct) || 0)), paises_encaminhamento: paises.length ? paises : ["US"],
        limite_mensal_padrao_cents: Math.max(0, Math.round(Number(b.limite_mensal_padrao_cents) || 0)), retencao_gravacoes_dias: Math.min(3650, Math.max(1, Math.round(Number(b.retencao_gravacoes_dias) || 90))),
        retencao_voicemail_dias: Math.min(3650, Math.max(1, Math.round(Number(b.retencao_voicemail_dias) || 90))), updated_at: agora(), updated_by: q.email };
      await db.from("tel_settings").update(row).eq("id", 1);
      await auditar(q, "config.salva", "tel_settings", "1", null, null, row);
      return { settings: { ...cfg, ...row } };
    }
    case "adm_tarifa_salvar": {
      soAdmin(q);
      const item = txt(b.item, 60).replace(/[^A-Za-z0-9_]/g, "");
      if (!item) throw new Erro("Informe o item da tarifa.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.verificado_em || "")) throw new Erro("Informe a data em que a tarifa foi conferida.");
      const custo = Number(b.custo);
      if (!(custo >= 0)) throw new Erro("Custo inválido.");
      const { data } = await db.from("tel_rates").insert({ provedor: "telnyx", item, pais: txt(b.pais, 2).toUpperCase() || null, unidade: ["minuto", "mensagem", "mes", "unidade"].includes(b.unidade) ? b.unidade : "minuto",
        custo, verificado_em: b.verificado_em, fonte: txt(b.fonte, 200) || null }).select().single();
      await auditar(q, "tarifa.salva", "tel_rate", data?.id || null, null, null, { item, custo, verificado_em: b.verificado_em });
      return { tarifa: data };
    }
    case "adm_tarifa_apagar": {
      soAdmin(q);
      await db.from("tel_rates").delete().eq("id", uuid(b.id) || NADA);
      await auditar(q, "tarifa.apagada", "tel_rate", uuid(b.id), null, null);
      return { ok: true };
    }
    case "adm_usuarios": {
      soAdmin(q);
      const cid = uuid(b.company_id) || NADA;
      const { data: a } = await db.from("tel_access").select("client_id").eq("company_id", cid).maybeSingle();
      const [{ data: us }, { data: membros }] = await Promise.all([db.from("tel_users").select("*").eq("company_id", cid), db.from("client_users").select("user_id, email, name, role, status").eq("client_id", a?.client_id || NADA).eq("status", "active")]);
      return { usuarios: us || [], membros: membros || [] };
    }
    case "adm_usuario_salvar": {
      soAdmin(q);
      const cid = uuid(b.company_id) || NADA;
      const { data: a } = await db.from("tel_access").select("client_id").eq("company_id", cid).maybeSingle();
      if (!a) throw new Erro("Libere a Telefonia para a empresa primeiro.");
      const { data: m } = await db.from("client_users").select("user_id, email").eq("client_id", a.client_id).eq("user_id", uuid(b.user_id) || NADA).eq("status", "active").maybeSingle();
      if (!m?.user_id) throw new Erro("Essa pessoa não é usuária ativa deste cliente.");
      const row = { company_id: cid, client_id: a.client_id, user_id: m.user_id, email: m.email, papel: b.papel === "admin" ? "admin" : "usuario", pode_ligar: b.pode_ligar !== false, pode_sms: b.pode_sms !== false, pode_gravacoes: b.pode_gravacoes === true };
      await db.from("tel_users").upsert(row, { onConflict: "company_id,user_id" });
      await auditar(q, "usuario.salvo", "tel_user", m.user_id, a.client_id, cid, { email: m.email, papel: row.papel, gravacoes: row.pode_gravacoes });
      return { ok: true };
    }
    case "adm_usuario_remover": {
      soAdmin(q);
      const { data: u } = await db.from("tel_users").delete().eq("id", uuid(b.id) || NADA).select().maybeSingle();
      if (u) await auditar(q, "usuario.removido", "tel_user", u.user_id, u.client_id, u.company_id, { email: u.email });
      return { ok: true };
    }

    /* ===== portal ===== */
    case "p_inicio": {
      if (!q.clientId && !q.admin) throw new Erro("Escolha a empresa.");
      const { data: acs } = await db.from("tel_access").select("*, companies(legal_name)").eq("client_id", q.clientId || NADA).eq("enabled", true);
      const out: Any[] = [];
      for (const a of acs || []) {
        let e; try { e = await empresa(q, a.company_id); } catch { continue; }
        const [ns, plano, uso, rt] = await Promise.all([numerosDa(a.company_id), db.from("tel_plans").select("*").eq("id", a.plan_id || "").maybeSingle(),
          db.from("tel_usage").select("*").eq("company_id", a.company_id).eq("periodo", mesAtual()).maybeSingle(), db.from("tel_routing").select("*").eq("company_id", a.company_id)]);
        out.push({ company_id: a.company_id, nome: a.companies?.legal_name || "", plano: plano.data, numeros: ns, routing: rt.data || [], pode: e.pode,
          permissoes: { sms: a.sms_permitido, encaminhamento: a.encaminhamento_permitido, gravacao: a.gravacao_permitida },
          consumo: situacaoConsumo(uso.data, plano.data, a.limite_mensal_cents, cfg.alertas_pct) });
      }
      return { empresas: out, estado: await prov.estado(), demo: modoDemo };
    }
    case "p_contatos": {
      await empresa(q, b.company_id);
      const { data } = await db.from("tel_contacts").select("*").eq("company_id", b.company_id).order("nome").limit(2000);
      return { contatos: data || [] };
    }
    case "p_contato_salvar": {
      const e = await empresa(q, b.company_id);
      const tel = e164(b.telefone);
      if (!tel) throw new Erro("Telefone inválido. Use o formato internacional, ex.: +1 407 555 0123.");
      const nome = txt(b.nome, 120);
      if (!nome) throw new Erro("Informe o nome.");
      const row: Any = { company_id: e.acesso.company_id, client_id: e.acesso.client_id, nome, telefone: tel, email: txt(b.email, 254) || null, empresa: txt(b.empresa, 120) || null, notas: bloco(b.notas, 1000) || null, updated_at: agora() };
      const id = uuid(b.id);
      const r = id ? await db.from("tel_contacts").update(row).eq("id", id).eq("company_id", row.company_id).select().single()
        : await db.from("tel_contacts").insert({ ...row, created_by: q.id }).select().single();
      if (r.error) throw new Erro(r.error.code === "23505" ? "Já existe um contato com este telefone." : "Não foi possível salvar o contato.", 409);
      return { contato: r.data };
    }
    case "p_contato_apagar": {
      const e = await empresa(q, b.company_id);
      await db.from("tel_contacts").delete().eq("id", uuid(b.id) || NADA).eq("company_id", e.acesso.company_id);
      return { ok: true };
    }
    case "p_crm_contatos": {
      const e = await empresa(q, b.company_id);
      const { data } = await db.from("ct_contacts").select("id, name, email, phone").eq("client_id", e.acesso.client_id).not("phone", "is", null).order("name").limit(1000);
      return { contatos: (data || []).map((c: Any) => ({ id: c.id, nome: c.name, email: c.email, telefone: e164(c.phone) })).filter((c: Any) => c.telefone) };
    }
    case "p_importar_crm": {
      const e = await empresa(q, b.company_id);
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(uuid).filter(Boolean).slice(0, 500);
      const { data } = await db.from("ct_contacts").select("id, name, email, phone").eq("client_id", e.acesso.client_id).in("id", ids.length ? ids : [NADA]);
      const rows = (data || []).map((c: Any) => ({ company_id: e.acesso.company_id, client_id: e.acesso.client_id, nome: txt(c.name, 120) || "Contato", telefone: e164(c.phone), email: c.email || null, origem: "crm", ct_contact_id: c.id, created_by: q.id })).filter((r: Any) => r.telefone);
      if (rows.length) await db.from("tel_contacts").upsert(rows, { onConflict: "company_id,telefone", ignoreDuplicates: true });
      return { importados: rows.length };
    }
    case "p_recentes": {
      await empresa(q, b.company_id);
      const { data } = await db.from("tel_calls").select("*").eq("company_id", b.company_id).order("inicio", { ascending: false }).limit(200);
      return { chamadas: data || [] };
    }
    case "p_ligar": {
      const e = await empresa(q, b.company_id);
      if (!e.pode.ligar) throw new Erro("Você não tem permissão para ligar por este número.", 403);
      const n = b.number_id ? await numeroDa(e.acesso.company_id, b.number_id) : await principal(e.acesso.company_id);
      const para = e164(b.para);
      if (!para) throw new Erro("Número inválido.");
      if (!modoDemo) throw new Erro("Ligações reais entram na Fase 3.", 409);
      const { data } = await db.from("tel_calls").insert({ company_id: n.company_id, number_id: n.id, direcao: "saida", de: n.e164, para, status: "em_andamento", usuario_id: q.id, demo: true,
        eventos: [{ em: agora(), evento: "discando (demonstração)" }] }).select().single();
      return { chamada: data, demo: true };
    }
    case "p_desligar": case "p_atender": case "p_recusar": {
      const e = await empresa(q, b.company_id);
      const { data: c } = await db.from("tel_calls").select("*").eq("id", uuid(b.call_id) || NADA).eq("company_id", e.acesso.company_id).maybeSingle();
      if (!c) throw new Erro("Chamada não encontrada.", 404);
      if (b.acao === "p_atender") {
        if (c.status !== "tocando") throw new Erro("Esta chamada não está tocando.", 409);
        await db.from("tel_calls").update({ status: "em_andamento", usuario_id: q.id, eventos: [...c.eventos, { em: agora(), evento: "atendida" }] }).eq("id", c.id);
        return { ok: true };
      }
      if (b.acao === "p_recusar") {
        if (c.status !== "tocando") throw new Erro("Esta chamada não está tocando.", 409);
        await db.from("tel_calls").update({ status: "recusada", fim: agora(), eventos: [...c.eventos, { em: agora(), evento: "recusada" }] }).eq("id", c.id);
        return { ok: true };
      }
      if (!["em_andamento", "tocando"].includes(c.status)) return { ok: true };
      const dur = Math.max(0, Math.min(4 * 3600, Math.round((Date.now() - Date.parse(c.inicio)) / 1000)));
      const minutos = Math.ceil(dur / 60);
      const rt = await rates();
      const n = c.number_id ? (await db.from("tel_numbers").select("tipo").eq("id", c.number_id).maybeSingle()).data : null;
      const t = c.direcao === "saida" ? tarifa(rt, "voz_saida_US") : tarifa(rt, n?.tipo === "tollfree" ? "voz_entrada_tollfree" : "voz_entrada_local");
      const custo = t ? t.custo * minutos : null;
      await db.from("tel_calls").update({ status: c.status === "tocando" ? "perdida" : "completada", fim: agora(), duracao_s: c.status === "tocando" ? 0 : dur, custo, estimado: true,
        eventos: [...c.eventos, { em: agora(), evento: "encerrada" }] }).eq("id", c.id);
      if (c.status === "em_andamento") await somarUso(c.company_id, c.direcao === "saida" ? { min_out: minutos, custo: custo || 0 } : { min_in: minutos, custo: custo || 0 });
      return { ok: true, duracao_s: dur };
    }
    case "p_mensagens": {
      await empresa(q, b.company_id);
      const { data } = await db.from("tel_messages").select("*").eq("company_id", b.company_id).order("created_at", { ascending: false }).limit(1000);
      const conversas: Any = {};
      for (const m of data || []) {
        const outro = m.direcao === "entrada" ? m.de : m.para;
        const c = conversas[outro] || (conversas[outro] = { contato: outro, ultima: m, nao_lidas: 0, total: 0 });
        c.total++; if (m.direcao === "entrada" && !m.lida) c.nao_lidas++;
      }
      return { conversas: Object.values(conversas) };
    }
    case "p_conversa": {
      const e = await empresa(q, b.company_id);
      const outro = e164(b.contato);
      if (!outro) throw new Erro("Contato inválido.");
      const { data } = await db.from("tel_messages").select("*").eq("company_id", e.acesso.company_id).or(`de.eq.${outro},para.eq.${outro}`).order("created_at").limit(500);
      await db.from("tel_messages").update({ lida: true }).eq("company_id", e.acesso.company_id).eq("de", outro).eq("direcao", "entrada").eq("lida", false);
      const { data: cons } = await db.from("tel_sms_consent").select("estado, em").eq("company_id", e.acesso.company_id).eq("telefone", outro).maybeSingle();
      return { mensagens: data || [], consentimento: cons || null };
    }
    case "p_enviar_sms": {
      const e = await empresa(q, b.company_id);
      if (!e.pode.sms || !e.acesso.sms_permitido) throw new Erro("SMS não está liberado para você nesta empresa.", 403);
      const n = b.number_id ? await numeroDa(e.acesso.company_id, b.number_id) : await principal(e.acesso.company_id);
      const para = e164(b.para), texto = bloco(b.texto, 1600);
      if (!para || !texto) throw new Erro("Informe o número e a mensagem.");
      const { data: cons } = await db.from("tel_sms_consent").select("estado").eq("company_id", n.company_id).eq("telefone", para).maybeSingle();
      const pode = podeEnviarSms(n, cons, n.demo);
      if (!pode.ok) throw new Erro(pode.motivo, 409);
      const partes = partesSms(texto), t = tarifa(await rates(), "sms_saida"), custo = t ? t.custo * partes : null;
      const { data } = await db.from("tel_messages").insert({ company_id: n.company_id, number_id: n.id, direcao: "saida", de: n.e164, para, texto, status: n.demo ? "entregue" : "na_fila", lida: true, custo, demo: n.demo }).select().single();
      await somarUso(n.company_id, { sms_out: partes, custo: custo || 0 });
      return { mensagem: data, partes, demo: n.demo };
    }
    case "p_voicemails": {
      await empresa(q, b.company_id);
      const { data } = await db.from("tel_voicemails").select("*").eq("company_id", b.company_id).order("created_at", { ascending: false }).limit(200);
      return { voicemails: data || [] };
    }
    case "p_vm_ouvido": {
      const e = await empresa(q, b.company_id);
      await db.from("tel_voicemails").update({ ouvido: true }).eq("id", uuid(b.id) || NADA).eq("company_id", e.acesso.company_id);
      return { ok: true };
    }
    case "p_estimar": {
      const e = await empresa(q, b.company_id);
      const n = await numeroDa(e.acesso.company_id, b.number_id, false);
      const destino = e164(b.destino);
      if (!destino) throw new Erro("Número de destino inválido.");
      const est = estimarEncaminhamento(await rates(), n.tipo, destino, Number(cfg.margem_encaminhamento_pct));
      return { estimativa: est, permitido: cfg.paises_encaminhamento.includes(est.pais) };
    }
    case "p_routing_salvar": {
      const e = await empresa(q, b.company_id);
      if (!e.pode.admin) throw new Erro("Só o admin da empresa muda o atendimento.", 403);
      const n = await numeroDa(e.acesso.company_id, b.number_id, false);
      const r = limparRouting(b.routing, { encaminhamento: e.acesso.encaminhamento_permitido, gravacao: e.acesso.gravacao_permitida });
      let aceite = null;
      if (r.destino === "numero") {
        const est = estimarEncaminhamento(await rates(), n.tipo, r.encaminhar_para!, Number(cfg.margem_encaminhamento_pct));
        if (!cfg.paises_encaminhamento.includes(est.pais)) throw new Erro("Encaminhar para este país não está liberado.", 409);
        if (!est.ok) throw new Erro("Ainda não há tarifa conferida para este encaminhamento (" + (est as Any).falta.join(", ") + "). Fale com a Endeavor.", 409);
        if (b.aceite !== true) throw new Erro("Confirme o custo estimado do encaminhamento antes de salvar.", 409);
        aceite = { por: q.email, em: agora(), preco_minuto: est.preco_minuto, pais: est.pais, para: r.encaminhar_para };
      }
      const row = { number_id: n.id, company_id: n.company_id, ...r, encaminhamento_aceite: aceite, updated_at: agora(), updated_by: q.email };
      const { error } = await db.from("tel_routing").upsert(row, { onConflict: "number_id" });
      if (error) throw new Erro("Não foi possível salvar o atendimento.", 500);
      await auditar(q, "atendimento.salvo", "tel_routing", n.id, e.acesso.client_id, n.company_id, { destino: r.destino, encaminhar_para: r.encaminhar_para, gravar: r.gravar, aceite });
      return { routing: row, agora: decidirChamada(r, Date.now()) };
    }
    case "p_consumo": {
      const e = await empresa(q, b.company_id);
      const [{ data: usos }, { data: plano }] = await Promise.all([db.from("tel_usage").select("*").eq("company_id", e.acesso.company_id).order("periodo", { ascending: false }).limit(12),
        db.from("tel_plans").select("*").eq("id", e.acesso.plan_id || "").maybeSingle()]);
      return { meses: (usos || []).map((u: Any) => ({ ...u, situacao: situacaoConsumo(u, plano, e.acesso.limite_mensal_cents, cfg.alertas_pct) })), plano };
    }
    case "p_novidades": {
      const e = await empresa(q, b.company_id);
      const cid = e.acesso.company_id;
      const [sms, vm, tocando] = await Promise.all([
        db.from("tel_messages").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("direcao", "entrada").eq("lida", false),
        db.from("tel_voicemails").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("ouvido", false),
        db.from("tel_calls").select("*").eq("company_id", cid).eq("status", "tocando").gte("inicio", new Date(Date.now() - 60_000).toISOString()).order("inicio", { ascending: false }).limit(1)]);
      return { sms_nao_lidas: sms.count || 0, voicemails_novos: vm.count || 0, tocando: tocando.data?.[0] || null };
    }
    case "p_simular": {
      // só no modo demonstração: cria um evento de entrada para testar a tela (SMS, chamada tocando ou voicemail)
      const e = await empresa(q, b.company_id);
      if (!modoDemo) throw new Erro("Simulação só existe no modo demonstração.", 409);
      const n = await principal(e.acesso.company_id);
      const de = e164(b.de) || "+14075550188";
      if (b.tipo === "sms") {
        const texto = bloco(b.texto, 1600) || "Olá! Vi o anúncio de vocês. Podem me ligar? (mensagem de demonstração)";
        const chave = palavraChave(texto);
        await db.from("tel_messages").insert({ company_id: n.company_id, number_id: n.id, direcao: "entrada", de, para: n.e164, texto, status: "recebida", demo: true });
        if (chave === "stop" || chave === "start") await db.from("tel_sms_consent").upsert({ company_id: n.company_id, telefone: de, estado: chave === "stop" ? "opt_out" : "opt_in", origem: "sms:" + chave, em: agora() }, { onConflict: "company_id,telefone" });
        await somarUso(n.company_id, { sms_in: partesSms(texto) });
        return { ok: true, palavra_chave: chave };
      }
      if (b.tipo === "chamada") {
        const { data: rt } = await db.from("tel_routing").select("*").eq("number_id", n.id).maybeSingle();
        const d = decidirChamada(rt || { destino: "app", voicemail: true }, Date.now());
        if (!d.aberto || d.acao === "voicemail") {
          const { data: c } = await db.from("tel_calls").insert({ company_id: n.company_id, number_id: n.id, direcao: "entrada", de, para: n.e164, status: "voicemail", fim: agora(), demo: true, eventos: [{ em: agora(), evento: "ausência: " + (d.motivo || "voicemail") }] }).select().single();
          await db.from("tel_voicemails").insert({ company_id: n.company_id, number_id: n.id, call_id: c?.id, de, duracao_s: 14, transcricao: "Oi, aqui é da demonstração. Me liga de volta quando puder.", demo: true, expira_em: new Date(Date.now() + cfg.retencao_voicemail_dias * 86400_000).toISOString() });
          return { ok: true, decisao: d };
        }
        const { data: c } = await db.from("tel_calls").insert({ company_id: n.company_id, number_id: n.id, direcao: "entrada", de, para: n.e164, status: "tocando", demo: true, eventos: [{ em: agora(), evento: "tocando (demonstração)" }] }).select().single();
        return { ok: true, decisao: d, chamada: c };
      }
      if (b.tipo === "voicemail") {
        await db.from("tel_voicemails").insert({ company_id: n.company_id, number_id: n.id, de, duracao_s: 21, transcricao: "Olá, gostaria de saber mais sobre os serviços. (demonstração)", demo: true, expira_em: new Date(Date.now() + cfg.retencao_voicemail_dias * 86400_000).toISOString() });
        return { ok: true };
      }
      throw new Erro("Tipo de simulação desconhecido.");
    }
    case "p_webrtc": {
      await empresa(q, b.company_id);
      return await prov.tokenWebRTC(q.id);
    }
  }
  throw new Erro("Ação desconhecida.", 404);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  let b: Any;
  try { b = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  try {
    const q = await quem(req, b);
    return json(await acao(q, b));
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: e instanceof Error && /Fase \d|bloqueada/.test(e.message) ? e.message : "Erro interno. Tente de novo." }, 500);
  }
});
