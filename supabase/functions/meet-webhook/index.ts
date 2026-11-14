// meet-webhook: avisos do LiveKit para o Web Meeting (adaptado do livekit-webhook do Noir Hub).
//   room_started        sala ao vivo (status live, início)
//   room_finished       sala encerrada (status ended, fim) — só a sala principal, não as salas em grupos
//   participant_joined  entrada (meet_participants) e pico de participantes
//   participant_left    saída
//   egress_ended        gravação ou transmissão terminou (arquivo, duração, situação)
// No LiveKit Cloud: Settings > Webhooks > https://<projeto>.supabase.co/functions/v1/meet-webhook
// Segredos: LIVEKIT_API_KEY, LIVEKIT_API_SECRET (a assinatura de cada aviso é conferida).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { WebhookReceiver } from "npm:livekit-server-sdk@2.19.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = (Deno.env.get("LIVEKIT_API_KEY") || "").trim(), SECRET = (Deno.env.get("LIVEKIT_API_SECRET") || "").trim();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const base = (s: string) => s.replace(/-g\d+$/, "");
const quando = (t: unknown) => { const n = Number(t); return n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString(); };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST.", { status: 405 });
  if (!KEY || !SECRET) return new Response("LiveKit não configurado.", { status: 503 });
  // deno-lint-ignore no-explicit-any
  let ev: any;
  try { ev = await new WebhookReceiver(KEY, SECRET).receive(await req.text(), req.headers.get("Authorization") ?? undefined); }
  catch { return new Response("Assinatura inválida.", { status: 401 }); }

  const nome = String(ev.room?.name || ev.egressInfo?.roomName || "");
  if (!nome) return new Response("ok");
  const { data: r } = await db.from("meet_rooms").select("id, slug, status, started_at, peak_participants").eq("slug", base(nome)).maybeSingle();
  if (!r) return new Response("ok"); // sala de outro sistema no mesmo projeto LiveKit
  const principal = nome === r.slug;

  try {
    switch (ev.event) {
      case "room_started":
        if (principal) await db.from("meet_rooms").update({ status: "live", started_at: r.started_at || quando(ev.room?.creationTime), ended_at: null }).eq("id", r.id);
        break;
      case "room_finished":
        if (principal) await db.from("meet_rooms").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", r.id);
        break;
      case "participant_joined": {
        const p = ev.participant || {};
        if (String(p.identity || "").startsWith("EG_")) break; // o próprio gravador do LiveKit
        await db.from("meet_participants").insert({ room_id: r.id, room_name: nome, identity: String(p.identity || "?"), name: p.name || null,
          role: p.attributes?.papel === "mentor" ? "host" : "guest", joined_at: quando(p.joinedAt) });
        if (principal) {
          const n = Number(ev.room?.numParticipants) || 0;
          const upd: Record<string, unknown> = { status: "live" };
          if (!r.started_at) upd.started_at = new Date().toISOString();
          if (n > (r.peak_participants || 0)) upd.peak_participants = n;
          await db.from("meet_rooms").update(upd).eq("id", r.id);
        }
        break;
      }
      case "participant_left": {
        const p = ev.participant || {};
        await db.from("meet_participants").update({ left_at: new Date().toISOString() }).eq("room_id", r.id).eq("identity", String(p.identity || "")).is("left_at", null);
        break;
      }
      case "egress_ended": {
        const info = ev.egressInfo || {};
        const arq = info.fileResults?.[0];
        const falhou = Number(info.status) >= 4 && !arq?.filename; // EGRESS_FAILED / ABORTED sem arquivo
        await db.from("meet_recordings").update({
          status: falhou ? "failed" : "complete", ended_at: new Date().toISOString(),
          file_path: arq?.filename || null, duration_seconds: arq?.duration ? Math.round(Number(arq.duration) / 1e9) : null,
          error: info.error || null,
        }).eq("egress_id", info.egressId);
        break;
      }
    }
  } catch (e) { console.error(ev.event, e); return new Response("erro", { status: 500 }); }
  return new Response("ok");
});
