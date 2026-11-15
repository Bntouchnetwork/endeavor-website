// meet: servidor do Web Meeting (videoconferência com LiveKit) da Endeavor Business Solutions.
// Adaptado das funções livekit-token, livekit-admin, resumo-encontro e assistente-ia do Noir Hub.
//
// Ações (POST { acao, ... }):
//   Públicas
//     info   { sala }                       dados públicos da sala (título, situação, empresa, marca) e se o LiveKit está ligado
//     token  { sala, nome }                 token LiveKit. Anfitrião = equipe Endeavor (admin com autenticador) ou usuário
//                                           da empresa dona da sala (portal com autenticador), pelo Authorization do Supabase.
//                                           Convidado = qualquer pessoa com o link, só com o nome.
//   Painel (Authorization: sessão do Supabase)
//     criar  { titulo, tipo: instant|scheduled, quando?, client_id? }   cria a sala (admin: Endeavor ou cliente; cliente: a própria)
//     encerrar_sala { room_id }             encerra pelo painel
//     gravacao_url  { recording_id }        link assinado (10 min) do vídeo
//   Anfitrião dentro da sala (Authorization: token LiveKit de anfitrião da mesma sala)
//     iniciar_gravacao | parar_gravacao { egressId? } | silenciar { identidade } | remover { identidade } | encerrar
//     voltar_grupos { grupos } | iniciar_transmissao { destinos[] } | parar_transmissao { egressId }
//     resumo { titulo, duracaoMin, participantes[], transcricao[], enquetes[], pitches[] }   (IA do HUB: meeting-summary)
//     gerar { instrucao, apresentacao?, slideAtual?, contexto? } | ultima | apagar_apresentacao                     (IA do HUB: meeting-slides)
//     Painel de ações (regras em acoes-core.js; integrações em acoes.ts):
//     acoes_status { sessao? }              conexões disponíveis (e-mail, proposta, cobrança, assinatura, documentos, agenda, tarefas, CRM)
//     acoes_analisar { linhas[], participantes[], titulo }   sugestões da IA do HUB (meeting-actions), conferidas contra a conversa
//     acao_executar { acao, contatos[], comando, sessao? }    executa (só com comando explícito, dados completos e conexão ativa)
//     acoes_listar                          ações executadas, tarefas e pedidos de documentos da sala
//   Página pública de envio de documentos (enviar-documentos.html?t=TOKEN)
//     docs_info { t } | docs_upload_url { t, item, nome, tipo, tamanho } | docs_confirmar { t, item, path }
//   Painel (admin e portal): doc_arquivo_url { pedido_id, path }  link de 10 minutos para um arquivo recebido
//   AI Presentation Studio (painel; detalhes em studio.ts): studio_* | voz_* | narrar | narracoes
//   Anfitrião dentro da sala: studio_sala_lista | studio_sala_abrir { studio_id }   abre uma apresentação publicada do Studio
//
// Segredos: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, HUB_AI_API_KEY (motor de IA).
// Gravação: MEET_S3_ENDPOINT, MEET_S3_REGION, MEET_S3_ACCESS_KEY, MEET_S3_SECRET (S3 do Supabase Storage, bucket meet-recordings).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  AccessToken, DataPacket_Kind, EgressClient, EncodedFileOutput, EncodedFileType, RoomServiceClient, S3Upload,
  StreamOutput, StreamProtocol, TokenVerifier, TrackType,
} from "npm:livekit-server-sdk@2.19.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hubAsk, hubJson, hubKey, hubOn, HubFail } from "../_shared/hub-ai.ts";
import { ApresentacaoInvalida, montarPedido, validar } from "./presentation.ts";
import { A as Acoes, docArquivoUrl, docsPublico, integracoes } from "./acoes.ts";
import { studio, studioNaSala } from "./studio.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const LK_URL = (Deno.env.get("LIVEKIT_URL") || "").trim();
const LK_KEY = (Deno.env.get("LIVEKIT_API_KEY") || "").trim();
const LK_SECRET = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();
const lkOn = () => !!(LK_URL && LK_KEY && LK_SECRET);
const lkHost = () => LK_URL.replace(/^ws(s?):\/\//, "http$1://");
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
class Erro extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const salaValida = (s: unknown): s is string => typeof s === "string" && /^[a-z0-9][a-z0-9-]{2,63}$/.test(s);
const salaBase = (s: string) => s.replace(/-g\d+$/, "");
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const bearer = (req: Request) => (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
const looksLiveKit = (jwt: string) => { try { const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return !!p.video; } catch { return false; } };

/* ---------------- quem está pedindo ---------------- */
async function usuario(req: Request, jwtExplicito?: string) {
  const jwt = jwtExplicito || bearer(req);
  if (!jwt || jwt === ANON || looksLiveKit(jwt)) return null;
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: "Bearer " + jwt } }, auth: { persistSession: false } });
  const { data } = await user.auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: admin } = await user.rpc("is_admin");
  const aal = (() => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { return ""; } })();
  return { id: data.user.id, email: data.user.email || "", admin: !!admin && aal === "aal2", user, jwt };
}
type U = NonNullable<Awaited<ReturnType<typeof usuario>>>;
async function papelNoCliente(u: U, clientId: string) { const { data } = await u.user.rpc("my_client_role", { p_client: clientId }); return data as string | null; }
async function acesso(clientId: string) {
  const { data } = await db.from("meet_access").select("*").eq("client_id", clientId).maybeSingle();
  return data;
}
async function sala(slug: string) {
  const { data } = await db.from("meet_rooms").select("*, clients(name, status)").eq("slug", salaBase(slug)).maybeSingle();
  return data;
}

/* ---------------- logo da empresa para o fundo "Marca" ---------------- */
async function logoEmpresa(clientId: string | null) {
  if (!clientId) return null;
  const { data: co } = await db.from("companies").select("logo_path").eq("client_id", clientId).not("logo_path", "is", null).order("created_at").limit(1);
  const p = co?.[0]?.logo_path; if (!p) return null;
  const { data } = await db.storage.from("client-docs").createSignedUrl(p, 6 * 3600);
  return data?.signedUrl || null;
}

/* ---------------- ações públicas ---------------- */
async function info(b: Any) {
  if (!salaValida(b.sala)) throw new Erro("Sala inválida.");
  const r = await sala(b.sala);
  if (!r) throw new Erro("Esta sala não existe. Confira o link.", 404);
  let habilitada = true;
  if (r.client_id) { const a = await acesso(r.client_id); habilitada = !!a?.enabled && r.clients?.status !== "archived"; }
  return { titulo: r.title, situacao: r.status, quando: r.scheduled_at, tipo: r.kind, empresa: r.client_id ? r.clients?.name : "Endeavor Business Solutions",
    configurado: lkOn(), habilitada, logo: await logoEmpresa(r.client_id) };
}

async function token(req: Request, b: Any) {
  if (!salaValida(b.sala)) throw new Erro("Sala inválida.");
  if (!lkOn()) throw new Erro("O Web Meeting ainda não está configurado no servidor.", 503);
  const r = await sala(b.sala);
  if (!r) throw new Erro("Esta sala não existe. Confira o link.", 404);
  const u = await usuario(req);
  let host = false, nome = txt(b.nome, 60);
  if (u) {
    if (u.admin) host = true;
    else if (r.client_id && await papelNoCliente(u, r.client_id)) host = true;
    else if (r.created_by && r.created_by === u.id) host = true;
    if (host) {
      if (r.client_id && !u.admin) { const { data: me } = await u.user.from("client_users").select("name").eq("client_id", r.client_id).eq("user_id", u.id).maybeSingle(); nome = nome || me?.name || ""; }
      nome = nome || u.email.split("@")[0];
    }
  }
  if (!nome) throw new Erro("Informe seu nome para entrar.");
  if (r.status === "ended" && !host) throw new Erro("Esta reunião foi encerrada.", 410);

  // empresa: Web Meeting habilitado e dentro dos limites
  let maxP = 100;
  if (r.client_id) {
    const a = await acesso(r.client_id);
    if (!a?.enabled) throw new Erro("O Web Meeting não está habilitado para esta empresa.", 403);
    if (a.max_participants) maxP = a.max_participants;
    if (a.max_minutes_month != null) {
      const { data: uso } = await db.rpc("meet_usage", { p_client: r.client_id });
      if ((uso?.minutes_month ?? 0) >= a.max_minutes_month) throw new Erro("O limite de minutos de reunião deste mês foi atingido. Fale com a Endeavor.", 403);
    }
  }
  const salas = new RoomServiceClient(lkHost(), LK_KEY, LK_SECRET);
  const nomeSala = b.sala as string;
  try { await salas.createRoom({ name: nomeSala, emptyTimeout: 600, departureTimeout: 120, maxParticipants: maxP }); } catch (e) { console.error("createRoom", e); }
  try {
    const ps = await salas.listParticipants(nomeSala);
    if (ps.length >= maxP && !host) throw new Erro(`A sala está cheia (limite de ${maxP} participantes).`, 403);
  } catch (e) { if (e instanceof Erro) throw e; }
  if (r.status === "ended" && host) await db.from("meet_rooms").update({ status: "scheduled", ended_at: null }).eq("id", r.id);

  const papel = host ? "mentor" : "aluno"; // nomes internos da sala: mentor = anfitrião, aluno = convidado
  const identidade = (host && u ? "h-" + u.id.slice(0, 8) + "-" : "c-") + crypto.randomUUID().slice(0, 8);
  const at = new AccessToken(LK_KEY, LK_SECRET, { identity: identidade, name: nome, ttl: "6h", attributes: { papel } });
  at.addGrant({ room: nomeSala, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: host, roomRecord: host });
  return { token: await at.toJwt(), url: LK_URL, identidade, papel };
}

/* ---------------- painel (admin e portal) ---------------- */
function slugNovo() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789", r = crypto.getRandomValues(new Uint8Array(10));
  return "eb-" + Array.from(r, (x) => a[x % a.length]).join("");
}
async function criar(req: Request, b: Any) {
  const u = await usuario(req);
  if (!u) throw new Erro("Entre no portal para criar salas.", 401);
  const titulo = txt(b.titulo, 120);
  if (titulo.length < 2) throw new Erro("Dê um nome para a sala.");
  const tipo = b.tipo === "scheduled" ? "scheduled" : "instant";
  let quando: string | null = null;
  if (b.quando) { const d = new Date(String(b.quando)); if (isNaN(d.getTime())) throw new Erro("Data e hora inválidas."); quando = d.toISOString(); }
  if (tipo === "scheduled" && !quando) throw new Erro("Informe a data e a hora da reunião agendada.");
  let clientId: string | null = b.client_id ? String(b.client_id) : null;
  if (!u.admin) {
    if (!clientId || !await papelNoCliente(u, clientId)) throw new Erro("Sem permissão para criar salas nesta empresa.", 403);
  }
  if (clientId) {
    const a = await acesso(clientId);
    if (!a?.enabled) throw new Erro("O Web Meeting não está habilitado para esta empresa.", 403);
    if (a.max_rooms_month != null) {
      const { data: uso } = await db.rpc("meet_usage", { p_client: clientId });
      if ((uso?.rooms_month ?? 0) >= a.max_rooms_month) throw new Erro(`O limite de ${a.max_rooms_month} salas por mês foi atingido.`, 403);
    }
  }
  const { data, error } = await db.from("meet_rooms").insert({ slug: slugNovo(), client_id: clientId, title: titulo, kind: tipo, scheduled_at: quando, status: "scheduled", created_by: u.id, created_by_email: u.email }).select("*").single();
  if (error) throw new Erro("Não foi possível criar a sala: " + error.message, 500);
  return { sala: data };
}
async function podeGerenciar(u: U, r: Any) { return u.admin || (r.client_id && await papelNoCliente(u, r.client_id)); }
async function encerrarSala(req: Request, b: Any) {
  const u = await usuario(req); if (!u) throw new Erro("Entre no portal.", 401);
  const { data: r } = await db.from("meet_rooms").select("*").eq("id", String(b.room_id || "")).maybeSingle();
  if (!r || !await podeGerenciar(u, r)) throw new Erro("Sala não encontrada.", 404);
  if (lkOn()) { try { await new RoomServiceClient(lkHost(), LK_KEY, LK_SECRET).deleteRoom(r.slug); } catch { /* já vazia */ } }
  await db.from("meet_rooms").update({ status: "ended", ended_at: r.ended_at || new Date().toISOString() }).eq("id", r.id);
  return { ok: true };
}
async function gravacaoUrl(req: Request, b: Any) {
  const u = await usuario(req); if (!u) throw new Erro("Entre no portal.", 401);
  const { data: g } = await db.from("meet_recordings").select("*, meet_rooms(client_id)").eq("id", String(b.recording_id || "")).maybeSingle();
  if (!g || !g.file_path || !await podeGerenciar(u, { client_id: g.meet_rooms?.client_id })) throw new Erro("Gravação não encontrada.", 404);
  const { data, error } = await db.storage.from("meet-recordings").createSignedUrl(g.file_path, 600);
  if (error) throw new Erro("O vídeo ainda não está disponível.", 404);
  return { url: data.signedUrl };
}

/* ---------------- anfitrião dentro da sala ---------------- */
async function anfitriao(req: Request, slug: string) {
  if (!lkOn()) throw new Erro("O Web Meeting ainda não está configurado no servidor.", 503);
  let claims: Any;
  try { claims = await new TokenVerifier(LK_KEY, LK_SECRET).verify(bearer(req)); }
  catch { throw new Erro("Acesso expirado. Entre de novo na sala.", 401); }
  const doToken = claims.video?.room ?? "";
  const mesma = doToken === slug || doToken.startsWith(slug + "-g") || slug.startsWith(doToken + "-g");
  if (!claims.video?.roomAdmin || !mesma) throw new Erro("Só o anfitrião pode fazer isso.", 403);
  const r = await sala(slug);
  if (!r) throw new Erro("Sala não encontrada.", 404);
  return { claims, r, a: r.client_id ? await acesso(r.client_id) : null };
}
function s3() {
  const e = Deno.env.get("MEET_S3_ENDPOINT"), k = Deno.env.get("MEET_S3_ACCESS_KEY"), sct = Deno.env.get("MEET_S3_SECRET");
  if (!e || !k || !sct) throw new Erro("A gravação ainda não está configurada no servidor (chaves S3 do Storage).", 503);
  return new S3Upload({ endpoint: e, region: Deno.env.get("MEET_S3_REGION") || "us-east-1", bucket: Deno.env.get("MEET_S3_BUCKET") || "meet-recordings", accessKey: k, secret: sct, forcePathStyle: true });
}

async function acaoAnfitriao(req: Request, b: Any) {
  const slug = String(b.sala || "");
  if (!salaValida(slug)) throw new Erro("Sala inválida.");
  const { claims, r, a } = await anfitriao(req, slug);
  const salas = new RoomServiceClient(lkHost(), LK_KEY, LK_SECRET);
  const egress = new EgressClient(lkHost(), LK_KEY, LK_SECRET);
  const quem = String(claims.name || claims.sub || "anfitrião");
  switch (b.acao) {
    case "iniciar_gravacao": {
      if (a && !a.recording_allowed) throw new Erro("A gravação não está liberada para esta empresa.", 403);
      const pasta = `${r.client_id || "endeavor"}/${r.slug}`;
      const arquivo = new EncodedFileOutput({ fileType: EncodedFileType.MP4, filepath: `${pasta}/{time}.mp4`, output: { case: "s3", value: s3() } });
      const info = await egress.startRoomCompositeEgress(slug, arquivo, { layout: "speaker" });
      await db.from("meet_recordings").insert({ room_id: r.id, egress_id: info.egressId, kind: "recording", status: "active", started_by: quem });
      return { ok: true, egressId: info.egressId };
    }
    case "parar_gravacao": {
      const ids = b.egressId ? [String(b.egressId)] : (await egress.listEgress({ roomName: slug, active: true })).map((e) => e.egressId);
      await Promise.all(ids.map((id) => egress.stopEgress(id)));
      return { ok: true, paradas: ids.length };
    }
    case "silenciar": {
      if (!b.identidade) throw new Erro("Informe quem silenciar.");
      const p = await salas.getParticipant(slug, String(b.identidade));
      await Promise.all(p.tracks.filter((t) => t.type === TrackType.AUDIO && !t.muted).map((t) => salas.mutePublishedTrack(slug, String(b.identidade), t.sid, true)));
      return { ok: true };
    }
    case "remover": {
      if (!b.identidade) throw new Erro("Informe quem remover.");
      await salas.removeParticipant(slug, String(b.identidade));
      return { ok: true };
    }
    case "encerrar": {
      await salas.deleteRoom(slug);
      if (slug === r.slug) await db.from("meet_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", r.id);
      return { ok: true };
    }
    case "voltar_grupos": {
      const n = Math.min(Math.max(Number(b.grupos) || 0, 0), 50);
      const aviso = new TextEncoder().encode(JSON.stringify({ t: "voltar" }));
      await Promise.allSettled(Array.from({ length: n }, (_, i) => salas.sendData(`${r.slug}-g${i + 1}`, aviso, DataPacket_Kind.RELIABLE, { topic: "emeet" })));
      return { ok: true };
    }
    case "iniciar_transmissao": {
      if (a && !a.streaming_allowed) throw new Erro("A transmissão nas redes não está liberada para esta empresa.", 403);
      const destinos = Array.isArray(b.destinos) ? b.destinos.map(String) : [];
      if (!destinos.length || destinos.length > 3 || !destinos.every((u: string) => /^rtmps?:\/\/[^\s]+$/.test(u))) throw new Erro("Destinos de transmissão inválidos.");
      const info = await egress.startRoomCompositeEgress(slug, new StreamOutput({ protocol: StreamProtocol.RTMP, urls: destinos }), { layout: "speaker" });
      await db.from("meet_recordings").insert({ room_id: r.id, egress_id: info.egressId, kind: "stream", status: "active", started_by: quem });
      return { ok: true, egressId: info.egressId };
    }
    case "parar_transmissao": {
      if (!b.egressId) throw new Erro("Informe a transmissão.");
      await egress.stopEgress(String(b.egressId));
      return { ok: true };
    }
    case "resumo": return await resumo(r, b);
    case "gerar": return await slides(r, b);
    case "apagar_apresentacao": {
      await db.from("meet_presentations").delete().eq("room_id", r.id);
      return { ok: true };
    }
    case "acoes_status": case "acao_executar": case "acoes_analisar": case "acoes_listar":
      return await painelAcoes(req, b, r, quem);
    case "studio_sala_lista": case "studio_sala_abrir":
      return await studioNaSala(b, r, db, Erro);
    case "ultima": {
      const { data } = await db.from("meet_presentations").select("content").eq("room_id", r.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { apresentacao: data?.content ?? null };
    }
  }
  throw new Erro("Ação desconhecida.");
}

/* ---------------- IA (HUB) ---------------- */
type Linha = { nome?: string; texto?: string; hora?: string };
async function resumo(r: Any, d: Any) {
  if (!hubOn()) throw new Erro("A IA da Endeavor não está configurada.", 503);
  const transcricao = (Array.isArray(d.transcricao) ? d.transcricao : []) as Linha[];
  const enquetes = (Array.isArray(d.enquetes) ? d.enquetes : []) as Any[];
  const tempos = (Array.isArray(d.pitches) ? d.pitches : []) as Any[];
  if (!transcricao.length && !enquetes.length && !tempos.length) throw new Erro("Ainda não há falas, enquetes ou tempos cronometrados para resumir.");
  const falas = transcricao.map((l) => `[${txt(l.hora, 8)}] ${txt(l.nome, 60) || "?"}: ${txt(l.texto, 600)}`).join("\n").slice(-120_000);
  const conteudo = [
    `Reunião: ${txt(d.titulo, 160) || r.title}`, `Empresa: ${r.client_id ? r.clients?.name : "Endeavor Business Solutions"}`,
    `Duração: ${Number(d.duracaoMin) || 0} minutos`, `Participantes: ${(Array.isArray(d.participantes) ? d.participantes : []).map((x: unknown) => txt(x, 60)).join(", ")}`,
    "", "<transcricao>", falas || "(sem falas transcritas)", "</transcricao>",
    "", "<enquetes>", enquetes.map((q) => `- ${txt(q.pergunta, 160)}: ${(q.resultados ?? []).map((x: Any) => `${txt(x.opcao, 60)} (${Number(x.votos) || 0})`).join(", ")}`).join("\n") || "(nenhuma)", "</enquetes>",
    "", "<tempos_de_fala>", tempos.map((p) => `- ${txt(p.nome, 60)}: ${Math.round(Number(p.segundos) || 0)} segundos`).join("\n") || "(nenhum)", "</tempos_de_fala>",
  ].join("\n");
  let texto: string;
  try {
    texto = await hubAsk({ agent: "meeting-summary", input: conteudo, sessionId: `meet-${r.slug}`, userId: `meet:${r.slug}`, idempotencyKey: hubKey("meet-sum", r.id, Date.now()),
      maxOutputTokens: 2000, timeoutMs: 90_000, meter: { agent: "meeting-summary", client_id: r.client_id } });
  } catch (e) { console.error("resumo", e); throw new Erro(e instanceof HubFail && e.kind === "limit" ? "O limite de uso da IA foi atingido. Tente mais tarde." : "A IA não conseguiu gerar o resumo agora. Tente de novo em instantes.", 502); }
  await db.from("meet_summaries").insert({ room_id: r.id, summary: texto, transcript: transcricao.slice(-4000), polls: enquetes, timers: tempos });
  return { resumo: texto };
}
async function slides(r: Any, d: Any) {
  if (!hubOn()) throw new Erro("A IA da Endeavor não está configurada.", 503);
  const p = montarPedido(d);
  if (!p.instrucao) throw new Erro("Escreva o que você quer na apresentação.");
  const conteudo = [
    `<pedido>${p.instrucao}</pedido>`, `<slide_atual>${p.slideAtual}</slide_atual>`,
    `<apresentacao_atual>${p.apresentacao ? JSON.stringify(p.apresentacao) : "(nenhuma ainda: crie uma nova)"}</apresentacao_atual>`,
    "<reuniao>", `Reunião: ${p.contexto.encontro || r.title}`, "Transcrição recente:",
    p.contexto.transcricao.map((l) => `${l.nome}: ${l.texto}`).join("\n") || "(sem falas transcritas)", "Enquetes:",
    p.contexto.enquetes.map((q) => `${q.pergunta} → ${q.resultados.map((x) => `${x.opcao}: ${x.votos}`).join("; ")}`).join("\n") || "(nenhuma)", "</reuniao>",
  ].join("\n");
  let j: Any;
  try {
    j = await hubJson({ agent: "meeting-slides", input: conteudo, userId: `meet:${r.slug}`, idempotencyKey: hubKey("meet-sl", r.id, Date.now()),
      maxOutputTokens: 8000, timeoutMs: 120_000, meter: { agent: "meeting-slides", client_id: r.client_id } });
  } catch (e) { console.error("slides", e); throw new Erro("O assistente não conseguiu responder agora. Tente de novo.", 502); }
  let apresentacao;
  try { apresentacao = validar(j?.apresentacao); } catch (e) { throw new Erro(e instanceof ApresentacaoInvalida ? "A IA devolveu uma apresentação inválida. Tente de novo." : "O assistente não conseguiu responder.", 502); }
  const foco = Math.min(Math.max(Math.trunc(Number(j?.foco ?? p.slideAtual) || 0), 0), apresentacao.slides.length - 1);
  const mensagem = txt(j?.mensagem, 400) || "Pronto.";
  await db.from("meet_presentations").insert({ room_id: r.id, instruction: p.instrucao, content: apresentacao, engine: "endeavor", message: mensagem });
  return { apresentacao, mensagem, foco, motor: "endeavor" };
}

/* ---------------- painel de ações ---------------- */
const TIPOS_ACAO = Object.keys(Acoes.TIPOS);
function limparLinhas(l: unknown) {
  return (Array.isArray(l) ? l : []).slice(-400).map((x: Any, i: number) => ({ id: txt(x?.id || "l" + i, 40), nome: txt(x?.nome, 60), texto: txt(x?.texto, 600), via: x?.via === "chat" ? "chat" : "fala", anfitriao: !!x?.anfitriao })).filter((x) => x.texto);
}
function limparContatos(c: unknown) {
  return (Array.isArray(c) ? c : []).slice(0, 50).filter((x: Any) => Acoes.emailValido(x?.email)).map((x: Any) => ({ email: String(x.email).toLowerCase().slice(0, 254), nome: txt(x.nome, 80), confirmado: x.confirmado === true, organizador: !!x.organizador }));
}
function limparAcao(a: Any) {
  if (!a || typeof a !== "object" || !TIPOS_ACAO.includes(a.tipo)) throw new Erro("Ação inválida.");
  const dados = a.dados && typeof a.dados === "object" ? a.dados : {};
  if (JSON.stringify(dados).length > 60_000) throw new Erro("Ação grande demais.");
  return { id: txt(a.id, 60), tipo: a.tipo, dados, reenvio: Number(a.reenvio) || 0 };
}
async function painelAcoes(req: Request, b: Any, r: Any, quem: string) {
  const sessao = b.sessao ? await usuario(req, String(b.sessao)) : null;
  // a sessão do portal só vale se for da equipe dona da sala (ou admin da Endeavor)
  const sessaoValida = sessao && (sessao.admin || (r.client_id && await papelNoCliente(sessao, r.client_id))) ? sessao : null;
  const { conexoes, admin, integ } = await integracoes({ db, r, sessao: sessaoValida, quem, jwtSessao: sessaoValida?.jwt || "" });
  if (b.acao === "acoes_status") return { conexoes, admin, ia: hubOn(), empresa: !!r.client_id };
  if (b.acao === "acoes_listar") {
    const [ac, ta, dc] = await Promise.all([
      db.from("meet_actions").select("idem, kind, status, result, error, created_at, updated_at").eq("room_id", r.id).order("created_at", { ascending: false }).limit(100),
      db.from("meet_tasks").select("*").eq("room_id", r.id).order("created_at"),
      db.from("meet_doc_requests").select("id, email, name, items, status, expires_at, created_at").eq("room_id", r.id).order("created_at"),
    ]);
    return { acoes: ac.data || [], tarefas: ta.data || [], documentos: (dc.data || []).map((d: Any) => ({ ...d, items: (d.items || []).map((i: Any) => ({ nome: i.nome, status: i.status, arquivos: (i.arquivos || []).length })) })) };
  }
  if (b.acao === "acao_executar") {
    const acao = limparAcao(b.acao_dados || b.item);
    const ctx = { papel: "anfitriao", admin, conexoes, contatos: limparContatos(b.contatos), comando: b.comando === true };
    const res = await Acoes.executar(acao, ctx, integ);
    return { acao: res };
  }
  // acoes_analisar: IA do HUB lê a conversa; tudo que ela devolve é conferido contra o que foi dito
  if (!hubOn()) throw new Erro("A IA da Endeavor não está configurada. O painel usa a leitura local.", 503);
  const linhas = limparLinhas(b.linhas);
  if (!linhas.length) return { sugestoes: [], removidos: [] };
  const conteudo = `<reuniao titulo="${txt(b.titulo || r.title, 120)}" data="${new Date().toISOString().slice(0, 10)}" fuso="${txt(b.tz || "America/New_York", 40)}">\n<participantes>${(Array.isArray(b.participantes) ? b.participantes : []).slice(0, 50).map((p: Any) => txt(p?.nome, 60) + (p?.papel === "mentor" ? " (organizador)" : "")).join(", ")}</participantes>\n<conversa>\n${linhas.map((l) => `[${l.id}] ${l.nome}${l.via === "chat" ? " (chat)" : ""}: ${l.texto}`).join("\n")}\n</conversa>\n</reuniao>`;
  let j: Any;
  try {
    j = await hubJson({ agent: "meeting-actions", input: conteudo, userId: `meet:${r.slug}`, idempotencyKey: hubKey("meet-ac", r.id, linhas.length, linhas[linhas.length - 1].id),
      maxOutputTokens: 4000, timeoutMs: 60_000, meter: { agent: "meeting-actions", client_id: r.client_id } });
  } catch (e) { throw new Erro(e instanceof HubFail ? "A IA não respondeu agora; o painel segue com a leitura local." : "A IA não respondeu agora.", 502); }
  const removidos: string[] = [];
  const sugestoes = (Array.isArray(j?.sugestoes) ? j.sugestoes : []).slice(0, 30).filter((s: Any) => TIPOS_ACAO.includes(s?.tipo)).map((s: Any) => {
    const base = { id: Acoes.novoId(s.tipo), tipo: s.tipo, status: "sugerida", origem: "ia", dados: s.dados && typeof s.dados === "object" ? s.dados : {}, fonte: Array.isArray(s.fonte) ? s.fonte.map((x: unknown) => txt(x, 40)) : [], motivo: txt(s.motivo, 200) };
    const c = Acoes.conferirComFonte(base, linhas); removidos.push(...c.removidos); return c.acao;
  });
  return { sugestoes, removidos, decisoes: (Array.isArray(j?.decisoes) ? j.decisoes : []).slice(0, 20).map((d: unknown) => txt(d, 300)) };
}
async function arquivoPedido(req: Request, b: Any) {
  const u = await usuario(req); if (!u) throw new Erro("Entre no portal.", 401);
  const { data: p } = await db.from("meet_doc_requests").select("id, client_id").eq("id", String(b.pedido_id || "")).maybeSingle();
  if (!p || !await podeGerenciar(u, { client_id: p.client_id })) throw new Erro("Pedido não encontrado.", 404);
  return { url: await docArquivoUrl(db, p.id, String(b.path || "")) };
}

/* ---------------- roteador ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  let b: Any = {};
  try { b = await req.json(); } catch { return json({ erro: "Pedido inválido." }, 400); }
  try {
    switch (b.acao) {
      case "info": return json(await info(b));
      case "token": return json(await token(req, b));
      case "criar": return json(await criar(req, b));
      case "encerrar_sala": return json(await encerrarSala(req, b));
      case "gravacao_url": return json(await gravacaoUrl(req, b));
      case "status": return json({ configurado: lkOn(), gravacao: !!Deno.env.get("MEET_S3_ACCESS_KEY"), ia: hubOn() });
      case "docs_info": case "docs_upload_url": case "docs_confirmar":
        try { return json(await docsPublico(db, b)); } catch (e) { return json({ erro: (e as Error).message }, (e as Any).status || 400); }
      case "doc_arquivo_url": return json(await arquivoPedido(req, b));
      case "studio_status": case "studio_listar": case "studio_criar": case "studio_obter": case "studio_salvar": case "studio_ia":
      case "studio_publicar": case "studio_duplicar": case "studio_apagar": case "voz_listar": case "voz_criar": case "voz_apagar":
      case "narrar": case "narracoes":
        return json(await studio(req, b, { db, usuario, papelNoCliente, acesso, Erro }));
      default: return json(await acaoAnfitriao(req, b));
    }
  } catch (e) {
    if (e instanceof Erro) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "O servidor do Web Meeting não concluiu a ação. Tente de novo." }, 502);
  }
});
