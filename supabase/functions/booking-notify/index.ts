// booking-notify: confirmation, reminders, cancellation and reschedule messages for the Endeavor agenda.
// Called by the database (trigger on bookings + pg_cron every 5 minutes) with the internal key kept in Vault,
// and by the admin console ("send a test") with the admin's session.
// E-mail: support Gmail over SMTP (port 465). WhatsApp: Meta Cloud API, only when WHATSAPP_TOKEN and WHATSAPP_PHONE_ID exist.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const SMTP_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
const FROM_NAME = Deno.env.get("SMTP_FROM_NAME") ?? "Endeavor Business Solutions";
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WA_PHONE = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const WA_VER = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";
const WA_TPL: Record<string, string> = {
  confirmation: Deno.env.get("WA_TPL_CONFIRMATION") ?? "endeavor_booking_confirmation",
  reminder: Deno.env.get("WA_TPL_REMINDER") ?? "endeavor_booking_reminder",
  cancelled: Deno.env.get("WA_TPL_CANCELLED") ?? "endeavor_booking_cancelled",
  rescheduled: Deno.env.get("WA_TPL_RESCHEDULED") ?? "endeavor_booking_rescheduled",
  admin: Deno.env.get("WA_TPL_ADMIN") ?? "endeavor_booking_admin_alert",
};
const PHONE = "+1 (407) 436-9567";

const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
const emailOn = () => SMTP_PASS.length >= 8;
const waOn = () => !!(WA_TOKEN && WA_PHONE);

type Lang = "pt" | "en" | "es";
type Kind = "confirmation" | "reminder" | "cancelled" | "rescheduled";
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

/* ---------------- texts ---------------- */
const T: Record<Lang, Record<string, string>> = {
  pt: {
    hi: "Olá, {n}!", sign: "Equipe Endeavor Business Solutions",
    s_confirmation: "Confirmado: sua conversa com a Endeavor em {w}", s_reminder: "Lembrete: sua conversa com a Endeavor é {r}",
    s_cancelled: "Cancelado: sua conversa com a Endeavor em {w}", s_rescheduled: "Remarcado: sua conversa com a Endeavor agora é em {w}",
    h_confirmation: "Sua conversa está confirmada.", h_reminder: "Sua conversa com a Endeavor é {r}.", h_cancelled: "Sua conversa foi cancelada.", h_rescheduled: "Sua conversa foi remarcada.",
    p_cancelled: "Se quiser, você pode agendar outro horário quando for melhor para você.",
    when: "Quando", type: "Formato", topic: "Assunto", gcal: "Adicionar ao Google Calendar", ics: "O convite para Outlook e Apple Calendar está anexo.",
    resched: "Reagendar", cancel: "Cancelar", book: "Agendar outro horário", change: "Precisa mudar? Use os botões abaixo.",
    video: "Videochamada (enviamos o link por e-mail)", phone: "Ligação telefônica", whatsapp: "Chamada por WhatsApp",
    tomorrow: "amanhã", in_d: "em {x} dias", in_h: "em {x} horas", in_1h: "em 1 hora", in_m: "em {x} minutos", your: "seu horário",
  },
  en: {
    hi: "Hi {n},", sign: "Endeavor Business Solutions team",
    s_confirmation: "Confirmed: your call with Endeavor on {w}", s_reminder: "Reminder: your call with Endeavor is {r}",
    s_cancelled: "Cancelled: your call with Endeavor on {w}", s_rescheduled: "Rescheduled: your call with Endeavor is now on {w}",
    h_confirmation: "Your call is confirmed.", h_reminder: "Your call with Endeavor is {r}.", h_cancelled: "Your call was cancelled.", h_rescheduled: "Your call was rescheduled.",
    p_cancelled: "You can book another time whenever it suits you.",
    when: "When", type: "Format", topic: "Topic", gcal: "Add to Google Calendar", ics: "The invitation for Outlook and Apple Calendar is attached.",
    resched: "Reschedule", cancel: "Cancel", book: "Book another time", change: "Need to change it? Use the buttons below.",
    video: "Video call (we email you the link)", phone: "Phone call", whatsapp: "WhatsApp call",
    tomorrow: "tomorrow", in_d: "in {x} days", in_h: "in {x} hours", in_1h: "in 1 hour", in_m: "in {x} minutes", your: "your time",
  },
  es: {
    hi: "¡Hola, {n}!", sign: "Equipo de Endeavor Business Solutions",
    s_confirmation: "Confirmado: su llamada con Endeavor el {w}", s_reminder: "Recordatorio: su llamada con Endeavor es {r}",
    s_cancelled: "Cancelado: su llamada con Endeavor el {w}", s_rescheduled: "Reprogramado: su llamada con Endeavor ahora es el {w}",
    h_confirmation: "Su llamada está confirmada.", h_reminder: "Su llamada con Endeavor es {r}.", h_cancelled: "Su llamada fue cancelada.", h_rescheduled: "Su llamada fue reprogramada.",
    p_cancelled: "Puede agendar otro horario cuando le convenga.",
    when: "Cuándo", type: "Formato", topic: "Tema", gcal: "Agregar a Google Calendar", ics: "La invitación para Outlook y Apple Calendar va adjunta.",
    resched: "Reprogramar", cancel: "Cancelar", book: "Agendar otro horario", change: "¿Necesita cambiarla? Use los botones de abajo.",
    video: "Videollamada (le enviamos el enlace por correo)", phone: "Llamada telefónica", whatsapp: "Llamada por WhatsApp",
    tomorrow: "mañana", in_d: "en {x} días", in_h: "en {x} horas", in_1h: "en 1 hora", in_m: "en {x} minutos", your: "su horario",
  },
};
const L = (l: string | null): Lang => (l === "pt" || l === "es" ? l : "en");
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const LOC: Record<Lang, string> = { pt: "pt-BR", en: "en-US", es: "es" };

function rel(lang: Lang, min: number) {
  const t = T[lang];
  if (min >= 1440) { const d = Math.round(min / 1440); return d === 1 ? t.tomorrow : fill(t.in_d, { x: String(d) }); }
  if (min >= 60) { const h = Math.round(min / 60); return h === 1 ? t.in_1h : fill(t.in_h, { x: String(h) }); }
  return fill(t.in_m, { x: String(min) });
}
function relPt(min: number) { return rel("pt", min).replace(/^em /, "").replace("amanhã", "1 dia"); }
function when(b: Row, lang: Lang, orgTz: string) {
  const tz = b.timezone || orgTz, s = new Date(b.starts_at), e = new Date(b.ends_at);
  const d = new Intl.DateTimeFormat(LOC[lang], { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(s);
  const h = (x: Date, z: string) => new Intl.DateTimeFormat(LOC[lang], { timeZone: z, hour: "numeric", minute: "2-digit" }).format(x);
  const tzName = new Intl.DateTimeFormat(LOC[lang], { timeZone: tz, timeZoneName: "short" }).formatToParts(s).find((p) => p.type === "timeZoneName")?.value ?? tz;
  let out = `${d}, ${h(s, tz)} – ${h(e, tz)} (${tzName})`;
  if (tz !== orgTz) out += ` · ${h(s, orgTz)} ET`;
  return out;
}
function whenEt(b: Row, orgTz: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: orgTz, dateStyle: "full", timeStyle: "short" }).format(new Date(b.starts_at)) + " ET";
}

/* ---------------- calendar ---------------- */
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function gcalUrl(b: Row, title: string, details: string) {
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + icsDate(new Date(b.starts_at)) + "/" + icsDate(new Date(b.ends_at)) + "&details=" + encodeURIComponent(details);
}
function ics(b: Row, title: string, details: string, cancel: boolean) {
  const fold = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Endeavor Business Solutions//Agenda//EN", "METHOD:" + (cancel ? "CANCEL" : "PUBLISH"), "BEGIN:VEVENT",
    "UID:" + b.id + "@endeavorbiz.com", "SEQUENCE:" + (b.schedule_version ?? 1), "DTSTAMP:" + icsDate(new Date()), "DTSTART:" + icsDate(new Date(b.starts_at)), "DTEND:" + icsDate(new Date(b.ends_at)),
    "SUMMARY:" + fold(title), "DESCRIPTION:" + fold(details), "STATUS:" + (cancel ? "CANCELLED" : "CONFIRMED"), "ORGANIZER;CN=Endeavor Business Solutions:mailto:" + SMTP_USER,
    ...(cancel ? [] : ["BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:" + fold(title), "END:VALARM"]), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}

/* ---------------- e-mail ---------------- */
let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
async function sendEmail(to: string, subject: string, html: string, text: string, attach?: { name: string; content: string; cancel: boolean }) {
  transport ??= nodemailer.createTransport({ host: SMTP_HOST, port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await transport.sendMail({
    from: { name: FROM_NAME, address: SMTP_USER }, to, subject, html, text, replyTo: SMTP_USER,
    ...(attach ? { icalEvent: { filename: attach.name, method: attach.cancel ? "CANCEL" : "PUBLISH", content: attach.content } } : {}),
  });
}
const btn = (href: string, label: string, primary = false) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:11px 18px;border-radius:8px;font:600 14px Arial,sans-serif;text-decoration:none;${primary ? "background:#0b1f3a;color:#fff" : "background:#fff;color:#0b1f3a;border:1.5px solid #0b1f3a"}">${esc(label)}</a>`;
function layout(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e3e7ee">
<tr><td style="padding:22px 28px;border-bottom:3px solid #c9a24a"><img src="${SITE}/logo-endeavor-3000px.png" alt="Endeavor Business Solutions" width="190" style="display:block;width:190px;height:auto"></td></tr>
<tr><td style="padding:26px 28px;font:15px/1.6 Arial,sans-serif;color:#1f2937">${inner}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e7ee;font:12px/1.5 Arial,sans-serif;color:#6b7280">Endeavor Business Solutions · Orlando, FL · ${PHONE} · <a href="mailto:${SMTP_USER}" style="color:#6b7280">${SMTP_USER}</a></td></tr>
</table></td></tr></table></body></html>`;
}

/* ---------------- WhatsApp (Meta Cloud API) ---------------- */
const WA_LANG: Record<Lang, string> = { pt: "pt_BR", en: "en_US", es: "es" };
async function sendWhatsApp(to: string, template: string, lang: Lang, params: string[]) {
  const r = await fetch(`https://graph.facebook.com/${WA_VER}/${WA_PHONE}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "template",
      template: { name: template, language: { code: WA_LANG[lang] }, components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p.slice(0, 900) })) }] } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.error?.message || `whatsapp_${r.status}`) as Error & { code?: number }; e.code = j?.error?.code; throw e; }
}

/* ---------------- one message ---------------- */
async function claim(b: Row, kind: Kind, off: number, channel: "email" | "whatsapp", audience: "client" | "admin") {
  const { error } = await db.from("booking_messages").insert({ booking_id: b.id, version: b.schedule_version ?? 1, kind, offset_min: off, channel, audience, status: "sending" });
  if (error) { if (error.code === "23505") return false; throw error; }
  return true;
}
async function mark(b: Row, kind: Kind, off: number, channel: string, audience: string, status: string, err?: string) {
  await db.from("booking_messages").update({ status, error: err ? err.slice(0, 1000) : null, sent_at: status === "sent" ? new Date().toISOString() : null })
    .match({ booking_id: b.id, version: b.schedule_version ?? 1, kind, offset_min: off, channel, audience });
}

async function deliver(b: Row, s: Row, kind: Kind, off = 0) {
  const lang = L(b.language), t = T[lang], org = s.timezone || "America/New_York";
  const first = String(b.name || "").split(" ")[0] || b.name;
  const w = when(b, lang, org), r = kind === "reminder" ? rel(lang, off) : "";
  const manage = `${SITE}/booking.html?t=${b.manage_token}&lang=${lang}`, rebook = `${SITE}/schedule.html?lang=${lang}`;
  const title = lang === "pt" ? "Conversa com a Endeavor Business Solutions" : lang === "es" ? "Llamada con Endeavor Business Solutions" : "Call with Endeavor Business Solutions";
  const typ = t[b.meeting_type] || b.meeting_type;
  const details = `${typ}${b.topic ? " · " + b.topic : ""}\n${s.meeting_note || ""}\n${t.resched} / ${t.cancel}: ${manage}\n${SMTP_USER} · ${PHONE}`;
  const out: Row = {};

  // client e-mail
  if (emailOn() && b.email && await claim(b, kind, off, "email", "client")) {
    try {
      const subj = fill(t["s_" + kind], { w, r });
      const live = kind !== "cancelled";
      const html = layout(`<p style="margin:0 0 6px">${esc(fill(t.hi, { n: first }))}</p><h1 style="font:700 21px/1.35 Georgia,serif;color:#0b1f3a;margin:0 0 16px">${esc(fill(t["h_" + kind], { r }))}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;background:#f7f8fb;border-radius:10px"><tr><td style="padding:14px 16px;font:14px/1.6 Arial,sans-serif">
<strong>${esc(t.when)}:</strong> ${esc(w)}<br><strong>${esc(t.type)}:</strong> ${esc(typ)}${b.topic ? `<br><strong>${esc(t.topic)}:</strong> ${esc(b.topic)}` : ""}</td></tr></table>
${kind === "cancelled" ? `<p>${esc(t.p_cancelled)}</p>${btn(rebook, t.book, true)}` : `${s.meeting_note ? `<p style="margin:0 0 14px">${esc(s.meeting_note)}</p>` : ""}
${btn(gcalUrl(b, title, details), t.gcal, true)}<p style="font-size:13px;color:#6b7280;margin:6px 0 18px">${esc(t.ics)}</p>
<p style="margin:0 0 6px">${esc(t.change)}</p>${btn(manage, t.resched)}${btn(manage + "&a=cancel", t.cancel)}`}
<p style="margin:22px 0 0">${esc(t.sign)}</p>`);
      const text = `${fill(t.hi, { n: first })}\n\n${fill(t["h_" + kind], { r })}\n${t.when}: ${w}\n${t.type}: ${typ}\n\n${live ? `${t.gcal}: ${gcalUrl(b, title, details)}\n${t.resched} / ${t.cancel}: ${manage}` : `${t.book}: ${rebook}`}\n\n${t.sign}`;
      await sendEmail(b.email, subj, html, text, kind === "reminder" ? undefined : { name: "endeavor-call.ics", content: ics(b, title, details, !live), cancel: !live });
      await mark(b, kind, off, "email", "client", "sent"); out.client_email = "sent";
    } catch (e) { await mark(b, kind, off, "email", "client", "failed", String((e as Error).message)); out.client_email = "failed"; }
  }

  // admin e-mail (always Portuguese)
  if (emailOn() && s.notify_email && await claim(b, kind, off, "email", "admin")) {
    try {
      const lbl = { confirmation: "Novo agendamento", reminder: "Lembrete (" + relPt(off) + ")", cancelled: "Agendamento cancelado", rescheduled: "Agendamento remarcado" }[kind];
      const subj = `${lbl}: ${b.name} – ${whenEt(b, org)}`;
      const html = layout(`<h1 style="font:700 20px/1.35 Georgia,serif;color:#0b1f3a;margin:0 0 14px">${esc(lbl)}</h1>
<p style="margin:0 0 14px"><strong>${esc(b.name)}</strong><br>${esc(b.email)}${b.phone ? " · WhatsApp " + esc(b.phone) : ""}</p>
<p style="margin:0 0 14px"><strong>Quando:</strong> ${esc(whenEt(b, org))}${b.timezone && b.timezone !== org ? `<br><span style="color:#6b7280">Horário do cliente: ${esc(when(b, "pt", org))}</span>` : ""}<br><strong>Formato:</strong> ${esc(T.pt[b.meeting_type] || b.meeting_type)}${b.topic ? `<br><strong>Assunto:</strong> ${esc(b.topic)}` : ""}${b.notes ? `<br><strong>Observações:</strong> ${esc(b.notes)}` : ""}${b.cancel_reason ? `<br><strong>Motivo:</strong> ${esc(b.cancel_reason)}` : ""}</p>
${kind !== "cancelled" ? btn(gcalUrl(b, "Endeavor · " + b.name, details), "Adicionar ao Google Calendar", true) : ""}${btn(SITE + "/admin.html#/agenda", "Abrir a Agenda")}`);
      await sendEmail(s.notify_email, subj, html, `${lbl}\n${b.name} · ${b.email} · ${b.phone ?? ""}\n${whenEt(b, org)}\n${b.topic ?? ""}`,
        kind === "reminder" ? undefined : { name: "endeavor-call.ics", content: ics(b, "Endeavor · " + b.name, details, kind === "cancelled"), cancel: kind === "cancelled" });
      await mark(b, kind, off, "email", "admin", "sent"); out.admin_email = "sent";
    } catch (e) { await mark(b, kind, off, "email", "admin", "failed", String((e as Error).message)); out.admin_email = "failed"; }
  }

  // WhatsApp (client), skipped when the number is known not to have WhatsApp
  if (waOn() && b.phone && b.whatsapp_ok !== false && await claim(b, kind, off, "whatsapp", "client")) {
    try {
      const p = kind === "reminder" ? [first, r, w, manage] : kind === "cancelled" ? [first, w, rebook] : [first, w, manage];
      await sendWhatsApp(b.phone, WA_TPL[kind], lang, p);
      await mark(b, kind, off, "whatsapp", "client", "sent"); out.client_whatsapp = "sent";
      if (b.whatsapp_ok !== true) await db.from("bookings").update({ whatsapp_ok: true }).eq("id", b.id);
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code === 131026 || code === 131030 || code === 1006) { await db.from("bookings").update({ whatsapp_ok: false }).eq("id", b.id); b.whatsapp_ok = false; }
      await mark(b, kind, off, "whatsapp", "client", "failed", String((e as Error).message)); out.client_whatsapp = "failed";
    }
  }
  // WhatsApp (admin)
  if (waOn() && s.notify_whatsapp && await claim(b, kind, off, "whatsapp", "admin")) {
    try {
      const lbl = { confirmation: "Novo agendamento", reminder: "Lembrete (" + relPt(off) + ")", cancelled: "Cancelado", rescheduled: "Remarcado" }[kind];
      await sendWhatsApp(s.notify_whatsapp, WA_TPL.admin, "pt", [lbl, b.name, whenEt(b, org), [b.phone, b.email].filter(Boolean).join(" · ")]);
      await mark(b, kind, off, "whatsapp", "admin", "sent"); out.admin_whatsapp = "sent";
    } catch (e) { await mark(b, kind, off, "whatsapp", "admin", "failed", String((e as Error).message)); out.admin_whatsapp = "failed"; }
  }
  return out;
}

/* ---------------- reminders ---------------- */
async function tick(s: Row) {
  const offs: number[] = (s.reminder_offsets ?? [1440, 720, 120]).filter((n: number) => n > 0);
  if (!offs.length || (!emailOn() && !waOn())) return { reminders: 0 };
  const now = Date.now(), maxOff = Math.max(...offs);
  const { data, error } = await db.from("bookings").select("*").eq("status", "confirmed")
    .gt("starts_at", new Date(now).toISOString()).lte("starts_at", new Date(now + (maxOff + 10) * 6e4).toISOString());
  if (error) throw error;
  let n = 0;
  for (const b of data ?? []) {
    const start = new Date(b.starts_at).getTime(), booked = new Date(b.scheduled_at ?? b.created_at).getTime();
    // the closest reminder that is due now; earlier ones that were missed are not sent late
    const due = offs.filter((o) => now >= start - o * 6e4 && now < start - o * 6e4 + 60 * 6e4 && booked <= start - o * 6e4 + 5 * 6e4).sort((a, c) => a - c)[0];
    if (due === undefined) continue;
    const r = await deliver(b, s, "reminder", due);
    if (Object.keys(r).length) n++;
  }
  return { reminders: n };
}

/* ---------------- handler ---------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const body = await req.json().catch(() => ({}));
  const { data: settings } = await db.from("booking_settings").select("*").eq("id", 1).single();
  const s = settings ?? {};
  // keep the flags the pages read up to date
  if (s.server_email !== emailOn() || s.whatsapp_connected !== waOn()) {
    await db.from("booking_settings").update({ server_email: emailOn(), whatsapp_connected: waOn() }).eq("id", 1);
  }

  // admin console: status and test message
  if (body.action === "status" || body.action === "test") {
    const auth = req.headers.get("Authorization") ?? "";
    const user = createClient(SB_URL, SB_ANON || SB_SERVICE, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: isAdmin } = await user.rpc("is_admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    if (body.action === "status") return json({ email: emailOn(), whatsapp: waOn(), from: SMTP_USER });
    if (!emailOn()) return json({ email: false, error: "smtp_not_configured" });
    try {
      await sendEmail(s.notify_email || SMTP_USER, "Teste da Agenda Endeavor", layout("<h1 style=\"font:700 20px Georgia,serif;color:#0b1f3a\">Tudo certo</h1><p>Os e-mails automáticos da Agenda estão saindo por " + esc(SMTP_USER) + ".</p>"), "Os e-mails automáticos da Agenda estão funcionando.");
      return json({ email: true, to: s.notify_email || SMTP_USER });
    } catch (e) { return json({ email: false, error: String((e as Error).message).slice(0, 300) }); }
  }

  // database calls (trigger and cron) carry the internal key
  const key = req.headers.get("x-booking-key") ?? "";
  const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: key });
  if (!ok) return json({ error: "forbidden" }, 403);

  try {
    if (body.event === "tick") return json(await tick(s));
    if (!body.booking_id) return json({ error: "booking_id" }, 400);
    const { data: b } = await db.from("bookings").select("*").eq("id", body.booking_id).single();
    if (!b) return json({ error: "not_found" }, 404);
    const kind: Kind | undefined = ({ created: "confirmation", cancelled: "cancelled", rescheduled: "rescheduled" } as Record<string, Kind>)[body.event];
    if (!kind) return json({ error: "event" }, 400);
    return json(await deliver(b, s, kind, 0));
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message).slice(0, 300) }, 500);
  }
});
