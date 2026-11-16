// AI Presentation Studio do Web Meeting (fase 2).
// Apresentações preparadas antes da reunião: slides, notas, roteiro de narração e duração por slide,
// perfis de voz autorizados (a própria voz, com consentimento) e um áudio de narração por slide.
// Toda IA passa pelo HUB AI: texto pelo agente presentation-studio, voz por /api/v1/speech e /api/v1/voices.
// Nada é simulado: sem provedor de voz conectado no HUB, a narração responde 409 com o motivo.
//
// Ações do painel (Authorization: sessão do Supabase; admin com autenticador ou equipe da empresa):
//   studio_status                                   IA de texto ligada? voz ligada? (capacidades do HUB)
//   studio_listar { client_id? }                    apresentações da empresa ("endeavor" = internas)
//   studio_criar  { client_id?, titulo }            nova apresentação (rascunho)
//   studio_obter  { id }                            conteúdo, versão, narrações, minhas vozes
//   studio_salvar { id, version, titulo, settings, content }   grava se a versão bate (senão 409)
//   studio_ia     { id, modo: criar|importar|slide|roteiro, pedido?, slide_id?, paginas?, content?, settings? }  só propõe
//   studio_publicar { id, version }                 congela a versão (meet_studio_versions)
//   studio_duplicar { id } | studio_apagar { id }
//   voz_listar | voz_criar { nome, mime, amostra_base64, segundos, consentimento: true, termo_versao } | voz_apagar { id }
//   abertura_upload_url { id, mime, tamanho } | abertura_confirmar { id, path, duracao_ms, mime } | abertura_url { id } | abertura_apagar { id }
//                                                   vídeo de abertura gravado pela câmera (com teleprompter) ou enviado
//   narrar { id, voz_id, slide_ids? }               gera o áudio dos slides cujo roteiro mudou (até 6 por chamada)
//   narracoes { id }                                links assinados (1 h) dos áudios prontos para a prévia
// Anfitrião dentro da sala (token LiveKit): studio_sala_lista | studio_sala_abrir { studio_id }
import { HubFail, hubCapabilities, hubJson, hubKey, hubOn, hubSpeech, HubVoiceError, hubVoiceCreate, hubVoiceDelete } from "../_shared/hub-ai.ts";
import { ApresentacaoInvalida, validar } from "./presentation.ts";

// deno-lint-ignore no-explicit-any
type Any = any;
export interface Deps {
  // deno-lint-ignore no-explicit-any
  db: any;
  usuario: (req: Request) => Promise<Any>;
  papelNoCliente: (u: Any, clientId: string) => Promise<string | null>;
  acesso: (clientId: string) => Promise<Any>;
  Erro: new (msg: string, status?: number) => Error;
}

export const TERMO_VERSAO = "voz-2026-11";
export const TERMO_VOZ = "Eu declaro que a voz gravada nesta amostra é a minha própria voz e autorizo a Endeavor Business Solutions, " +
  "por meio do seu HUB AI e do provedor de voz contratado (ElevenLabs), a criar uma voz sintética a partir dela, usada somente para narrar " +
  "as minhas apresentações no Web Meeting. Não vou usar esta função para imitar outra pessoa. Posso apagar esta voz a qualquer momento, " +
  "e com ela os áudios gerados.";
const IDIOMAS = ["pt-BR", "en-US", "es-ES"];
const RITMOS: Record<string, number> = { calmo: 0.92, normal: 1, rapido: 1.08 };
const POR_LOTE = 6;
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "";

export function limparConfig(c: Any) {
  c = c && typeof c === "object" ? c : {};
  const pron = (Array.isArray(c.pronuncia) ? c.pronuncia : []).slice(0, 50)
    .map((p: Any) => ({ de: txt(p?.de, 60), para: txt(p?.para, 120) })).filter((p: Any) => p.de && p.para);
  return {
    idioma: IDIOMAS.includes(c.idioma) ? c.idioma : "pt-BR",
    tom: txt(c.tom, 60) || "profissional e acolhedor",
    duracao_min: Math.min(Math.max(Math.round(Number(c.duracao_min) || 10), 1), 120),
    ritmo: c.ritmo in RITMOS ? c.ritmo : "normal",
    publico: txt(c.publico, 160),
    transicao: ["corte", "suave"].includes(c.transicao) ? c.transicao : "suave",
    legendas: c.legendas !== false,
    abertura: ["ao_vivo", "video", "nenhuma"].includes(c.abertura) ? c.abertura : "ao_vivo",
    abertura_texto: String(c.abertura_texto ?? "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000),
    abertura_video: videoValido(c.abertura_video),
    voz_teste: c.voz_teste === true,
    voz_id: uuid(c.voz_id) || null,
    pronuncia: pron,
  };
}
/** Vídeo de abertura guardado no bucket meet-media (o caminho é sempre do próprio Studio; o servidor é quem grava). */
function videoValido(v: Any) {
  if (!v || typeof v !== "object" || !/^abertura\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{4,80}$/.test(String(v.path || ""))) return null;
  return { path: String(v.path), duracao_ms: Math.min(Math.max(Math.round(Number(v.duracao_ms) || 0), 1000), 15 * 60_000), mime: /^video\/(webm|mp4)$/.test(String(v.mime)) ? String(v.mime) : "video/webm" };
}
const VIDEO_MAX = 100 * 1024 * 1024;
/** Roteiro final que vai para a voz: aplica o dicionário de pronúncia (palavra inteira, sem diferenciar maiúsculas). */
export function textoFalado(roteiro: string, pron: { de: string; para: string }[]) {
  let t = roteiro;
  for (const p of pron) {
    const esc = p.de.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "giu"), p.para);
  }
  return t;
}
export async function hashFala(idioma: string, ritmo: string, texto: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${idioma}|${ritmo}|${texto}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
/** Segundos estimados de fala (sem áudio): palavras ÷ ritmo. */
export function estimarSegundos(roteiro: string, ritmo: string) {
  const ppm = ritmo === "calmo" ? 130 : ritmo === "rapido" ? 170 : 150;
  const n = (roteiro.match(/\S+/g) || []).length;
  return n ? Math.max(3, Math.round(n / ppm * 60)) : 0;
}
const novoSlide = (titulo: string) => ({ formato: "noir.apresentacao", versao: 1, titulo, slides: [{ id: "s1", layout: "capa", titulo }] });

export async function studio(req: Request, b: Any, d: Deps) {
  const { db, Erro } = d;
  const u = await d.usuario(req);
  if (!u) throw new Erro("Entre no painel para usar o Studio.", 401);
  const audit = (studioId: string | null, action: string, details: Any = {}) =>
    db.from("meet_studio_audit").insert({ studio_id: studioId, actor_id: u.id, action, details }).then(() => { }, () => { });

  async function podeEmpresa(clientId: string | null) {
    if (u.admin) return true;
    if (!clientId) return false;
    if (!await d.papelNoCliente(u, clientId)) return false;
    const a = await d.acesso(clientId);
    return !!a?.enabled;
  }
  async function carregar(id: unknown) {
    const { data: s } = await db.from("meet_studio").select("*").eq("id", uuid(id) || "00000000-0000-0000-0000-000000000000").is("deleted_at", null).maybeSingle();
    if (!s || !await podeEmpresa(s.client_id)) throw new Erro("Apresentação não encontrada.", 404);
    return s;
  }
  async function minhasVozes() {
    const { data } = await db.from("meet_voice_profiles").select("id, name, status, provider, consent_at, consent_version, sample_seconds, error, created_at")
      .eq("owner_id", u.id).is("deleted_at", null).order("created_at", { ascending: false });
    return data || [];
  }
  async function capacidades() {
    if (!hubOn()) return { texto: false, voz: false, provedor_voz: null, imagens: false, video: false, erro: "A chave do HUB AI não está configurada no servidor." };
    try {
      const c = await hubCapabilities();
      return { texto: !!c.text, voz: !!c.speech, provedor_voz: c.speech_provider, imagens: !!c.images, video: !!c.video };
    } catch (e) {
      return { texto: true, voz: false, provedor_voz: null, imagens: false, video: false, erro: "O HUB AI não informou as capacidades: " + (e as Error).message };
    }
  }

  switch (b.acao) {
    case "studio_status":
      return { capacidades: await capacidades(), termo: TERMO_VOZ, termo_versao: TERMO_VERSAO };

    case "studio_listar": {
      let q = db.from("meet_studio").select("id, client_id, title, status, version, published_version, published_at, updated_at, content->slides, clients(name)")
        .is("deleted_at", null).order("updated_at", { ascending: false }).limit(200);
      const c = b.client_id ? String(b.client_id) : "";
      if (!u.admin) {
        if (!uuid(c) || !await podeEmpresa(c)) throw new Erro("Sem acesso ao Studio desta empresa.", 403);
        q = q.eq("client_id", c);
      } else if (c === "endeavor") q = q.is("client_id", null);
      else if (uuid(c)) q = q.eq("client_id", c);
      const { data, error } = await q;
      if (error) throw new Erro("Não foi possível listar: " + error.message, 500);
      return { apresentacoes: (data || []).map((s: Any) => ({ id: s.id, client_id: s.client_id, empresa: s.client_id ? s.clients?.name : "Endeavor", titulo: s.title, status: s.status,
        version: s.version, published_version: s.published_version, published_at: s.published_at, updated_at: s.updated_at, slides: Array.isArray(s.slides) ? s.slides.length : 0 })) };
    }

    case "studio_criar": {
      const c = b.client_id && b.client_id !== "endeavor" ? String(b.client_id) : null;
      if (c && !uuid(c)) throw new Erro("Empresa inválida.");
      if (!c && !u.admin) throw new Erro("Escolha a empresa.", 403);
      if (!await podeEmpresa(c)) throw new Erro("O Web Meeting não está habilitado para esta empresa.", 403);
      const titulo = txt(b.titulo, 120) || "Nova apresentação";
      const { data, error } = await db.from("meet_studio").insert({ client_id: c, owner_id: u.id, title: titulo, settings: limparConfig(b.settings), content: novoSlide(titulo) }).select("id").single();
      if (error) throw new Erro("Não foi possível criar: " + error.message, 500);
      await audit(data.id, "create", { titulo });
      return { id: data.id };
    }

    case "studio_obter": {
      const s = await carregar(b.id);
      return { apresentacao: publico(s), vozes: await minhasVozes(), narracoes: await narracoesAtuais(s) };
    }

    case "studio_salvar": {
      const s = await carregar(b.id);
      if (Number(b.version) !== s.version) throw new Erro("Esta apresentação foi alterada em outra janela. Recarregue para ver a versão mais nova.", 409);
      let content;
      try { content = validar(b.content); } catch (e) { throw new Erro(e instanceof ApresentacaoInvalida ? e.message : "Apresentação inválida."); }
      const titulo = txt(b.titulo, 120) || content.titulo;
      content.titulo = titulo;
      const settings = limparConfig(b.settings);
      settings.abertura_video = limparConfig(s.settings).abertura_video; // só as ações de abertura mudam o vídeo
      if (settings.abertura === "video" && !settings.abertura_video) settings.abertura = "ao_vivo";
      if (settings.voz_id) {
        const { data: v } = await db.from("meet_voice_profiles").select("id").eq("id", settings.voz_id).eq("owner_id", s.owner_id).is("deleted_at", null).maybeSingle();
        if (!v) settings.voz_id = null; // só a voz do dono da apresentação
      }
      const { data, error } = await db.from("meet_studio").update({ title: titulo, content, settings, version: s.version + 1, updated_at: new Date().toISOString() })
        .eq("id", s.id).eq("version", s.version).select("*").maybeSingle();
      if (error) throw new Erro("Não foi possível salvar: " + error.message, 500);
      if (!data) throw new Erro("Esta apresentação foi alterada em outra janela. Recarregue para ver a versão mais nova.", 409);
      await audit(s.id, "save", { version: data.version, slides: content.slides.length });
      return { apresentacao: publico(data), narracoes: await narracoesAtuais(data) };
    }

    case "studio_ia": return await ia(await carregar(b.id));

    case "studio_publicar": {
      const s = await carregar(b.id);
      if (Number(b.version) !== s.version) throw new Erro("Salve as últimas alterações antes de publicar.", 409);
      const { error } = await db.from("meet_studio_versions").insert({ studio_id: s.id, version: s.version, content: s.content, settings: s.settings, created_by: u.id });
      if (error && !/duplicate/.test(error.message)) throw new Erro("Não foi possível publicar: " + error.message, 500);
      const at = new Date().toISOString();
      await db.from("meet_studio").update({ status: "published", published_version: s.version, published_at: at }).eq("id", s.id);
      await audit(s.id, "publish", { version: s.version });
      return { ok: true, published_version: s.version, published_at: at };
    }

    case "studio_duplicar": {
      const s = await carregar(b.id);
      const { data, error } = await db.from("meet_studio").insert({ client_id: s.client_id, owner_id: u.id, title: txt("Cópia de " + s.title, 120), settings: { ...s.settings, voz_id: s.owner_id === u.id ? s.settings?.voz_id ?? null : null, abertura_video: null, abertura: s.settings?.abertura === "video" ? "ao_vivo" : s.settings?.abertura },
        content: { ...s.content, titulo: txt("Cópia de " + s.title, 120) } }).select("id").single();
      if (error) throw new Erro("Não foi possível duplicar: " + error.message, 500);
      await audit(data.id, "duplicate", { de: s.id });
      return { id: data.id };
    }

    case "studio_apagar": {
      const s = await carregar(b.id);
      const { data: ns } = await db.from("meet_narrations").select("audio_path").eq("studio_id", s.id);
      const paths = (ns || []).map((n: Any) => n.audio_path).filter(Boolean);
      const vid = limparConfig(s.settings).abertura_video;
      if (vid && !await videoEmUso(s.id, vid.path)) paths.push(vid.path);
      if (paths.length) await db.storage.from("meet-media").remove(paths);
      await db.from("meet_narrations").delete().eq("studio_id", s.id);
      await db.from("meet_studio").update({ deleted_at: new Date().toISOString() }).eq("id", s.id);
      await audit(s.id, "delete", { audios: paths.length });
      return { ok: true };
    }

    case "voz_listar": return { vozes: await minhasVozes(), termo: TERMO_VOZ, termo_versao: TERMO_VERSAO };

    case "voz_criar": {
      if (b.consentimento !== true || b.termo_versao !== TERMO_VERSAO) throw new Erro("Para criar a sua voz, leia e aceite o termo de autorização.");
      const nome = txt(b.nome, 80) || "Minha voz";
      const mime = String(b.mime || "").split(";")[0].trim().toLowerCase();
      if (!/^audio\/(webm|ogg|mpeg|mp4|wav|x-wav|aac)$/.test(mime)) throw new Erro("Formato de áudio não aceito. Grave pelo navegador ou envie MP3, WAV ou M4A.");
      const amostra = String(b.amostra_base64 || "").replace(/^data:[^;]+;base64,/, "");
      const bytes = Math.floor(amostra.length * 3 / 4);
      const segundos = Number(b.segundos) || 0;
      if (bytes < 20_000 || (segundos && segundos < 30)) throw new Erro("A amostra está curta. Grave pelo menos 30 segundos, de preferência 1 minuto, falando naturalmente.");
      if (bytes > 1_400_000) throw new Erro("A amostra ficou grande demais. Grave até 2 minutos ou envie um arquivo menor.");
      const { count } = await db.from("meet_voice_profiles").select("id", { count: "exact", head: true }).eq("owner_id", u.id).is("deleted_at", null);
      if ((count || 0) >= 3) throw new Erro("Você já tem 3 vozes. Apague uma antes de criar outra.");
      const caps = await capacidades();
      if (!caps.voz) throw new Erro("A voz ainda não está ligada no HUB AI. Um administrador precisa conectar o ElevenLabs em AI Providers. Nada foi gravado.", 409);
      const consentAt = new Date().toISOString();
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 60);
      let r;
      try {
        r = await hubVoiceCreate({ name: `${nome} (${u.email.split("@")[0]})`.slice(0, 80), mime, sampleBase64: amostra,
          consent: { statement: TERMO_VOZ, subject: u.id, accepted_at: consentAt }, metadata: { platform: "endeavor-web-meeting", termo_versao: TERMO_VERSAO } });
      } catch (e) {
        await audit(null, "voice_create_failed", { erro: (e as Error).message.slice(0, 300) });
        throw new Erro(mensagemVoz(e), e instanceof HubVoiceError && e.status === 409 ? 409 : 502);
      }
      const { data, error } = await db.from("meet_voice_profiles").insert({ owner_id: u.id, client_id: uuid(b.client_id) || null, name: nome, provider: caps.provedor_voz || "elevenlabs",
        provider_voice_id: r.voice_id, status: "ready", consent_text: TERMO_VOZ, consent_version: TERMO_VERSAO, consent_at: consentAt, consent_ip: ip, sample_seconds: segundos || null }).select("id").single();
      if (error) { await hubVoiceDelete(r.voice_id).catch(() => { }); throw new Erro("Não foi possível guardar a voz: " + error.message, 500); }
      await audit(null, "voice_create", { voz: data.id, termo_versao: TERMO_VERSAO });
      // a amostra não fica guardada na Endeavor: foi enviada uma vez ao provedor pelo HUB
      return { id: data.id, vozes: await minhasVozes(), verificacao: !!r.requires_verification };
    }

    case "voz_apagar": {
      const { data: v } = await db.from("meet_voice_profiles").select("*").eq("id", uuid(b.id) || "00000000-0000-0000-0000-000000000000").eq("owner_id", u.id).is("deleted_at", null).maybeSingle();
      if (!v) throw new Erro("Voz não encontrada.", 404);
      if (v.provider_voice_id) {
        try { await hubVoiceDelete(v.provider_voice_id); }
        catch (e) { throw new Erro("Não foi possível apagar a voz no provedor agora: " + mensagemVoz(e) + " Tente de novo.", 502); }
      }
      const { data: ns } = await db.from("meet_narrations").select("audio_path").eq("voice_profile_id", v.id);
      const paths = (ns || []).map((n: Any) => n.audio_path).filter(Boolean);
      if (paths.length) await db.storage.from("meet-media").remove(paths);
      await db.from("meet_narrations").delete().eq("voice_profile_id", v.id);
      await db.from("meet_voice_profiles").update({ status: "deleted", deleted_at: new Date().toISOString(), provider_voice_id: null }).eq("id", v.id);
      const { data: usam } = await db.from("meet_studio").select("id, settings").eq("settings->>voz_id", v.id);
      for (const st of usam || []) await db.from("meet_studio").update({ settings: { ...st.settings, voz_id: null } }).eq("id", st.id);
      await audit(null, "voice_delete", { voz: v.id, audios: paths.length });
      return { ok: true, vozes: await minhasVozes() };
    }

    case "abertura_upload_url": {
      const s = await carregar(b.id);
      const mime = String(b.mime || "").split(";")[0].trim().toLowerCase();
      if (!/^video\/(webm|mp4)$/.test(mime)) throw new Erro("Formato de vídeo não aceito. Grave pelo Studio ou envie MP4/WebM.");
      if (!(Number(b.tamanho) > 10_000)) throw new Erro("O vídeo está vazio.");
      if (Number(b.tamanho) > VIDEO_MAX) throw new Erro("O vídeo passou de 100 MB. Grave uma introdução mais curta (até 5 minutos).");
      const path = `abertura/${s.id}/${crypto.randomUUID()}.${mime === "video/mp4" ? "mp4" : "webm"}`;
      const { data, error } = await db.storage.from("meet-media").createSignedUploadUrl(path);
      if (error || !data) throw new Erro("Não foi possível preparar o envio: " + (error?.message || ""), 500);
      return { path, url: data.signedUrl, token: data.token };
    }
    case "abertura_confirmar": {
      const s = await carregar(b.id);
      const v = videoValido({ path: b.path, duracao_ms: b.duracao_ms, mime: b.mime });
      if (!v || !v.path.startsWith(`abertura/${s.id}/`)) throw new Erro("Envio inválido.");
      const pasta = v.path.split("/").slice(0, 2).join("/"), nome = v.path.split("/")[2];
      const { data: arq } = await db.storage.from("meet-media").list(pasta, { search: nome, limit: 1 });
      if (!arq?.length) throw new Erro("O vídeo não chegou ao servidor. Tente enviar de novo.", 409);
      const antigo = limparConfig(s.settings).abertura_video;
      const settings = { ...s.settings, abertura_video: v, abertura: "video" };
      const { data, error } = await db.from("meet_studio").update({ settings, version: s.version + 1, updated_at: new Date().toISOString() }).eq("id", s.id).eq("version", s.version).select("*").maybeSingle();
      if (error || !data) { await db.storage.from("meet-media").remove([v.path]); throw new Erro("A apresentação mudou enquanto o vídeo era enviado. Envie de novo.", 409); }
      if (antigo && antigo.path !== v.path && !await videoEmUso(s.id, antigo.path)) await db.storage.from("meet-media").remove([antigo.path]);
      await audit(s.id, "intro_video", { duracao_ms: v.duracao_ms });
      return { version: data.version, abertura_video: v };
    }
    case "abertura_url": {
      const s = await carregar(b.id);
      const v = limparConfig(s.settings).abertura_video;
      if (!v) return { url: null };
      const { data } = await db.storage.from("meet-media").createSignedUrl(v.path, 3600);
      return { url: data?.signedUrl || null, duracao_ms: v.duracao_ms, mime: v.mime };
    }
    case "abertura_apagar": {
      const s = await carregar(b.id);
      const v = limparConfig(s.settings).abertura_video;
      const settings = { ...s.settings, abertura_video: null, abertura: s.settings?.abertura === "video" ? "ao_vivo" : s.settings?.abertura };
      const { data } = await db.from("meet_studio").update({ settings, version: s.version + 1 }).eq("id", s.id).eq("version", s.version).select("version").maybeSingle();
      if (!data) throw new Erro("A apresentação mudou em outra janela. Recarregue.", 409);
      if (v && !await videoEmUso(s.id, v.path)) await db.storage.from("meet-media").remove([v.path]);
      await audit(s.id, "intro_delete", {});
      return { version: data.version };
    }

    case "narrar": return await narrar(await carregar(b.id));
    case "narracoes": { const s = await carregar(b.id); return { narracoes: await narracoesAtuais(s, true) }; }
  }
  throw new Erro("Ação desconhecida.");

  /* ---------------- helpers que usam o contexto ---------------- */
  /** O vídeo continua em uso se uma versão publicada ou um webinar agendado ainda aponta para ele. */
  async function videoEmUso(studioId: string, path: string) {
    const [{ data: vs }, { data: ws }] = await Promise.all([
      db.from("meet_studio_versions").select("id").eq("studio_id", studioId).eq("settings->abertura_video->>path", path).limit(1),
      db.from("lw_webinars").select("id").eq("intro->>path", path).is("deleted_at", null).limit(1)]);
    return !!(vs?.length || ws?.length);
  }
  function publico(s: Any) {
    return { id: s.id, client_id: s.client_id, titulo: s.title, settings: limparConfig(s.settings), content: s.content, version: s.version, status: s.status,
      published_version: s.published_version, published_at: s.published_at, updated_at: s.updated_at, dono: s.owner_id === u.id };
  }

  /** Para cada slide do conteúdo salvo: situação da narração do roteiro ATUAL (pronta, desatualizada, sem roteiro). */
  async function narracoesAtuais(s: Any, comLinks = false) {
    const cfg = limparConfig(s.settings);
    const { data: rows } = await db.from("meet_narrations").select("slide_id, script_hash, voice_profile_id, status, audio_path, duration_ms, error, updated_at").eq("studio_id", s.id);
    const out: Any[] = [];
    for (const sl of (s.content?.slides || []) as Any[]) {
      const rot = String(sl.roteiro || "");
      if (!rot) { out.push({ slide_id: sl.id, situacao: "sem_roteiro", estimado_s: 0 }); continue; }
      const h = await hashFala(cfg.idioma, cfg.ritmo, textoFalado(rot, cfg.pronuncia));
      const r = (rows || []).find((x: Any) => x.slide_id === sl.id && x.script_hash === h && x.voice_profile_id === cfg.voz_id);
      const antiga = (rows || []).some((x: Any) => x.slide_id === sl.id && x.status === "ready");
      const item: Any = { slide_id: sl.id, estimado_s: estimarSegundos(rot, cfg.ritmo),
        situacao: r ? (r.status === "ready" ? "pronta" : r.status === "failed" ? "falhou" : "gerando") : (antiga ? "desatualizada" : "pendente"),
        duracao_ms: r?.duration_ms || null, erro: r?.status === "failed" ? r.error : null };
      if (comLinks && r?.status === "ready" && r.audio_path) {
        const { data } = await db.storage.from("meet-media").createSignedUrl(r.audio_path, 3600);
        item.url = data?.signedUrl || null;
      }
      out.push(item);
    }
    return out;
  }

  async function narrar(s: Any) {
    const cfg = limparConfig(s.settings);
    const vozId = uuid(b.voz_id) || cfg.voz_id;
    if (!vozId) throw new Erro("Escolha a sua voz nas configurações da apresentação e salve.");
    const { data: v } = await db.from("meet_voice_profiles").select("*").eq("id", vozId).is("deleted_at", null).maybeSingle();
    // só a própria pessoa usa a própria voz, e só em apresentações dela
    if (!v || v.owner_id !== u.id || s.owner_id !== u.id) throw new Erro("Só o dono da apresentação pode narrá-la, com a própria voz autorizada.", 403);
    if (v.status !== "ready" || !v.provider_voice_id) throw new Erro("Esta voz não está pronta. Crie a voz de novo no gerenciador de vozes.", 409);
    if (vozId !== cfg.voz_id) throw new Erro("Salve a apresentação com esta voz antes de narrar.", 409);
    const caps = await capacidades();
    if (!caps.voz) throw new Erro("A voz ainda não está ligada no HUB AI. Um administrador precisa conectar o ElevenLabs em AI Providers.", 409);
    const pedidos = Array.isArray(b.slide_ids) ? new Set(b.slide_ids.map(String)) : null;
    const fila: Any[] = [];
    for (const sl of (s.content?.slides || []) as Any[]) {
      if (pedidos && !pedidos.has(sl.id)) continue;
      if (!sl.roteiro) continue;
      const fala = textoFalado(String(sl.roteiro), cfg.pronuncia);
      const h = await hashFala(cfg.idioma, cfg.ritmo, fala);
      const { data: ja } = await db.from("meet_narrations").select("id, status, attempts").eq("studio_id", s.id).eq("slide_id", sl.id).eq("script_hash", h).eq("voice_profile_id", vozId).maybeSingle();
      if (ja?.status === "ready") continue;
      fila.push({ sl, fala, h, ja });
    }
    const agora = fila.slice(0, POR_LOTE), feitos: Any[] = [];
    for (const f of agora) {
      const base = { studio_id: s.id, slide_id: f.sl.id, script_hash: f.h, voice_profile_id: vozId, language: cfg.idioma };
      await db.from("meet_narrations").upsert({ ...base, status: "running", attempts: (f.ja?.attempts || 0) + 1, error: null, updated_at: new Date().toISOString() },
        { onConflict: "studio_id,slide_id,script_hash,voice_profile_id" });
      try {
        const r = await hubSpeech({ text: f.fala, voiceId: v.provider_voice_id, language: cfg.idioma, speed: RITMOS[cfg.ritmo], userId: `meet-studio:${u.id}`, meter: { client_id: s.client_id } });
        const path = `narracoes/${s.id}/${f.sl.id}-${f.h.slice(0, 12)}.mp3`;
        const up = await db.storage.from("meet-media").upload(path, r.audio, { contentType: r.mime, upsert: true });
        if (up.error) throw new Error("armazenamento: " + up.error.message);
        await db.from("meet_narrations").update({ status: "ready", audio_path: path, duration_ms: Math.round(r.seconds * 1000), characters: r.characters, hub_request_id: r.requestId, updated_at: new Date().toISOString() })
          .match({ studio_id: s.id, slide_id: f.sl.id, script_hash: f.h, voice_profile_id: vozId });
        feitos.push({ slide_id: f.sl.id, ok: true });
      } catch (e) {
        const msg = mensagemVoz(e);
        await db.from("meet_narrations").update({ status: "failed", error: msg.slice(0, 400), updated_at: new Date().toISOString() })
          .match({ studio_id: s.id, slide_id: f.sl.id, script_hash: f.h, voice_profile_id: vozId });
        feitos.push({ slide_id: f.sl.id, ok: false, erro: msg });
        // provedor fora, limite ou credencial: para o lote em vez de repetir o erro em todos os slides
        if (e instanceof HubVoiceError && ["voice_provider_not_connected", "provider_auth", "hard_limit", "daily_limit", "company_inactive", "provider_rate_limited", "rate_limited"].includes(e.code)) break;
      }
    }
    await audit(s.id, "narrate", { voz: vozId, gerados: feitos.filter((x) => x.ok).length, falhas: feitos.filter((x) => !x.ok).length });
    return { feitos, restantes: Math.max(0, fila.length - feitos.length), narracoes: await narracoesAtuais(s) };
  }

  async function ia(s: Any) {
    if (!hubOn()) throw new Erro("A IA da Endeavor (HUB AI) não está configurada no servidor.", 503);
    const modo = ["criar", "importar", "slide", "roteiro", "abertura"].includes(b.modo) ? b.modo : "criar";
    const cfg = limparConfig(b.settings ?? s.settings);
    let atual: Any = null;
    try { atual = validar(b.content ?? s.content); } catch { atual = null; }
    const pedido = txt(b.pedido, 4000);
    const partes = [`<modo>${modo}</modo>`,
      `<configuracao>idioma: ${cfg.idioma}; tom: ${cfg.tom}; duração total: ${cfg.duracao_min} minutos; ritmo: ${cfg.ritmo}${cfg.publico ? "; público: " + cfg.publico : ""}</configuracao>`];
    if (modo === "criar") {
      if (pedido.length < 5) throw new Erro("Descreva o assunto da apresentação.");
      partes.push(`<pedido>${pedido}</pedido>`);
      if (atual && atual.slides.length > 1) partes.push(`<apresentacao_atual>${JSON.stringify(atual)}</apresentacao_atual>`);
    } else if (modo === "abertura") {
      if (!atual) throw new Erro("Apresentação inválida.");
      partes.push(`<apresentacao_atual>${JSON.stringify({ titulo: atual.titulo, slides: atual.slides.map((x: Any) => ({ titulo: x.titulo, itens: x.itens })) })}</apresentacao_atual>`,
        `<pedido>${pedido || "Escreva a introdução que eu vou gravar na câmera."}</pedido>`);
    } else if (modo === "importar") {
      const paginas = (Array.isArray(b.paginas) ? b.paginas : []).slice(0, 30).map((p: Any, i: number) => ({ n: i + 1, texto: txt(p?.texto, 2500), notas: txt(p?.notas, 1500) })).filter((p: Any) => p.texto || p.notas);
      if (!paginas.length) throw new Erro("Não encontrei texto no arquivo. PDFs escaneados (só imagem) ainda não são lidos.");
      partes.push(`<origem>${txt(b.origem, 120) || "arquivo"}</origem>`, `<paginas>${JSON.stringify(paginas)}</paginas>`);
      if (pedido) partes.push(`<pedido>${pedido}</pedido>`);
    } else {
      if (!atual) throw new Erro("Apresentação inválida.");
      const alvo = atual.slides.find((x: Any) => x.id === String(b.slide_id));
      if (!alvo) throw new Erro("Slide não encontrado.");
      partes.push(`<apresentacao_atual>${JSON.stringify(atual)}</apresentacao_atual>`, `<slide_alvo>${alvo.id}</slide_alvo>`, `<pedido>${pedido || (modo === "slide" ? "Melhore este slide." : "Escreva o roteiro falado deste slide.")}</pedido>`);
    }
    let j: Any;
    try {
      j = await hubJson({ agent: "presentation-studio", input: partes.join("\n"), userId: `meet-studio:${u.id}`, idempotencyKey: hubKey("studio", s.id, modo, Date.now()),
        maxOutputTokens: modo === "roteiro" || modo === "abertura" ? 2000 : modo === "slide" ? 3000 : 12000, timeoutMs: 140_000, meter: { agent: "presentation-studio", client_id: s.client_id } });
    } catch (e) {
      console.error("studio ia", e);
      throw new Erro(e instanceof HubFail && e.kind === "limit" ? "O limite de uso da IA foi atingido. Fale com a Endeavor." : "A IA não conseguiu responder agora. Tente de novo em instantes.", 502);
    }
    await audit(s.id, "ai_" + modo, { pedido: pedido.slice(0, 200) });
    const mensagem = txt(j?.mensagem, 400) || "Pronto. Revise antes de salvar.";
    if (modo === "abertura") {
      const texto = String(j?.roteiro ?? j?.abertura ?? "").replace(/[<>]/g, " ").trim().slice(0, 4000);
      if (!texto) throw new Erro("A IA não devolveu o texto. Tente de novo.", 502);
      return { mensagem, texto, estimado_s: estimarSegundos(texto, cfg.ritmo) };
    }
    if (modo === "roteiro") {
      const roteiro = txt(j?.roteiro, 3000);
      if (!roteiro) throw new Erro("A IA não devolveu um roteiro. Tente de novo.", 502);
      return { mensagem, roteiro, estimado_s: estimarSegundos(roteiro, cfg.ritmo) };
    }
    if (modo === "slide") {
      let ap;
      try { ap = validar({ titulo: atual.titulo, slides: [{ ...j?.slide, id: String(b.slide_id) }] }); } catch { throw new Erro("A IA devolveu um slide inválido. Tente de novo.", 502); }
      return { mensagem, slide: { ...ap.slides[0], id: String(b.slide_id) } };
    }
    let ap;
    try { ap = validar(j?.apresentacao); } catch { throw new Erro("A IA devolveu uma apresentação inválida. Tente de novo.", 502); }
    for (const sl of ap.slides) if (sl.roteiro && !sl.duracao) sl.duracao = estimarSegundos(sl.roteiro, cfg.ritmo);
    return { mensagem, content: ap };
  }
}

function mensagemVoz(e: unknown) {
  if (e instanceof HubVoiceError) {
    switch (e.code) {
      case "voice_provider_not_connected": return "A voz ainda não está ligada no HUB AI (ElevenLabs não conectado).";
      case "hub_not_configured": return "O HUB AI não está configurado no servidor.";
      case "provider_auth": return "O ElevenLabs recusou a chave ou o plano não permite esta função (clonagem de voz exige plano pago).";
      case "invalid_voice": return "O provedor recusou a voz ou o texto: " + e.message;
      case "consent_required": return "Falta o consentimento da própria pessoa.";
      case "sample_too_short": return "A amostra está curta. Grave pelo menos 30 segundos.";
      case "hard_limit": case "daily_limit": return "O limite de gastos com IA foi atingido.";
      case "rate_limited": case "provider_rate_limited": return "Muitas narrações seguidas. Espere um minuto e tente de novo.";
      default: return "O HUB AI não concluiu: " + e.message;
    }
  }
  return "Não foi possível concluir: " + String((e as Error)?.message || e).slice(0, 200);
}

/* ---------------- dentro da sala: abrir uma apresentação do Studio ---------------- */
export async function studioNaSala(b: Any, r: Any, db: Any, Erro: Deps["Erro"]) {
  // mesma empresa da sala (ou Endeavor interna); só versões publicadas
  let q = db.from("meet_studio").select("id, title, published_version, published_at, updated_at").is("deleted_at", null).eq("status", "published").order("published_at", { ascending: false }).limit(50);
  q = r.client_id ? q.eq("client_id", r.client_id) : q.is("client_id", null);
  if (b.acao === "studio_sala_lista") {
    const { data } = await q;
    return { apresentacoes: (data || []).map((s: Any) => ({ id: s.id, titulo: s.title, versao: s.published_version, publicada: s.published_at })) };
  }
  const { data: s } = await db.from("meet_studio").select("id, client_id, title, published_version").eq("id", uuid(b.studio_id) || "00000000-0000-0000-0000-000000000000").is("deleted_at", null).maybeSingle();
  if (!s || (s.client_id || null) !== (r.client_id || null) || !s.published_version) throw new Erro("Apresentação não encontrada ou ainda não publicada.", 404);
  const { data: v } = await db.from("meet_studio_versions").select("content").eq("studio_id", s.id).eq("version", s.published_version).maybeSingle();
  if (!v) throw new Erro("Versão publicada não encontrada.", 404);
  const apresentacao = validar(v.content);
  await db.from("meet_presentations").insert({ room_id: r.id, instruction: `Studio: ${s.title} (v${s.published_version})`, content: apresentacao, engine: "studio", message: "Aberta do Studio" });
  return { apresentacao, mensagem: `Apresentação "${s.title}" aberta do Studio.`, foco: 0, motor: "studio" };
}
