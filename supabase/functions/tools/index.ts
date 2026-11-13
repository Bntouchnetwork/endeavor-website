// Client tools sold online (portal): public scheduling page of each client, booking e-mails, and the e-mail that
// sends a client's document for electronic signature. CRM and the booking-page settings are plain tables under RLS.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { layout, btn, sendMail } from "../payments/access-mail.ts";

type Any = any; // deno-lint-ignore no-explicit-any
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SITE = (Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400) { super(code); } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const L = (l: unknown) => (["pt", "en", "es"].includes(String(l)) ? String(l) as "pt" | "en" | "es" : "pt");
const LOC = { pt: "pt-BR", en: "en-US", es: "es" };
function when(iso: string, tz: string, lang: "pt" | "en" | "es") {
  let zone = tz; try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { zone = "America/New_York"; }
  return new Intl.DateTimeFormat(LOC[lang], { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}

const T = {
  pt: { conf: (b: string) => `Agendamento confirmado com ${b}`, hi: (n: string) => `Olá, ${n}!`, confLead: (b: string, w: string) => `O seu horário com <strong>${b}</strong> está confirmado para <strong>${w}</strong>.`,
    how: "Como vai ser", video: "Videochamada", phone: "Ligação telefônica", in_person: "Presencial", cancelQ: "Precisa cancelar?", cancelBtn: "Cancelar o agendamento",
    newT: (n: string, w: string) => `Novo agendamento: ${n} · ${w}`, newLead: "Alguém marcou um horário pela sua página de agendamento.", openPortal: "Ver na minha agenda",
    canT: (b: string) => `Agendamento cancelado com ${b}`, canLead: (b: string, w: string) => `O horário com <strong>${b}</strong> em <strong>${w}</strong> foi cancelado.`, canOwnerT: (n: string, w: string) => `Cancelado: ${n} · ${w}`,
    rebook: "Marcar outro horário", sign: "Enviado pela plataforma Endeavor Business Solutions", name: "Nome", email: "E-mail", phoneL: "Telefone", notes: "Observações",
    esT: (c: string, t: string) => `${c} enviou "${t}" para você assinar`, esLead: (c: string, t: string) => `<strong>${c}</strong> enviou o documento <strong>${t}</strong> para a sua assinatura eletrônica, pela plataforma da Endeavor Business Solutions.`,
    esBtn: "Revisar e assinar", esExp: (d: string) => `Link pessoal, válido até ${d}. Não encaminhe este e-mail.` },
  en: { conf: (b: string) => `Your appointment with ${b} is confirmed`, hi: (n: string) => `Hello, ${n}!`, confLead: (b: string, w: string) => `Your time with <strong>${b}</strong> is confirmed for <strong>${w}</strong>.`,
    how: "How it works", video: "Video call", phone: "Phone call", in_person: "In person", cancelQ: "Need to cancel?", cancelBtn: "Cancel the appointment",
    newT: (n: string, w: string) => `New booking: ${n} · ${w}`, newLead: "Someone booked a time on your scheduling page.", openPortal: "See my schedule",
    canT: (b: string) => `Appointment with ${b} cancelled`, canLead: (b: string, w: string) => `Your time with <strong>${b}</strong> on <strong>${w}</strong> was cancelled.`, canOwnerT: (n: string, w: string) => `Cancelled: ${n} · ${w}`,
    rebook: "Book another time", sign: "Sent through the Endeavor Business Solutions platform", name: "Name", email: "E-mail", phoneL: "Phone", notes: "Notes",
    esT: (c: string, t: string) => `${c} sent you "${t}" to sign`, esLead: (c: string, t: string) => `<strong>${c}</strong> sent you <strong>${t}</strong> for electronic signature through the Endeavor Business Solutions platform.`,
    esBtn: "Review and sign", esExp: (d: string) => `Personal link, valid until ${d}. Do not forward this e-mail.` },
  es: { conf: (b: string) => `Cita confirmada con ${b}`, hi: (n: string) => `¡Hola, ${n}!`, confLead: (b: string, w: string) => `Su horario con <strong>${b}</strong> está confirmado para <strong>${w}</strong>.`,
    how: "Cómo será", video: "Videollamada", phone: "Llamada telefónica", in_person: "Presencial", cancelQ: "¿Necesita cancelar?", cancelBtn: "Cancelar la cita",
    newT: (n: string, w: string) => `Nueva cita: ${n} · ${w}`, newLead: "Alguien reservó un horario en su página de agenda.", openPortal: "Ver mi agenda",
    canT: (b: string) => `Cita cancelada con ${b}`, canLead: (b: string, w: string) => `Su horario con <strong>${b}</strong> el <strong>${w}</strong> fue cancelado.`, canOwnerT: (n: string, w: string) => `Cancelada: ${n} · ${w}`,
    rebook: "Reservar otro horario", sign: "Enviado por la plataforma de Endeavor Business Solutions", name: "Nombre", email: "Correo", phoneL: "Teléfono", notes: "Notas",
    esT: (c: string, t: string) => `${c} le envió "${t}" para firmar`, esLead: (c: string, t: string) => `<strong>${c}</strong> le envió el documento <strong>${t}</strong> para firma electrónica, por la plataforma de Endeavor Business Solutions.`,
    esBtn: "Revisar y firmar", esExp: (d: string) => `Enlace personal, válido hasta ${d}. No reenvíe este correo.` },
};
// mails that go out "on behalf of" a client: reply goes to the client, never to Endeavor's support
async function mail(to: string, subject: string, inner: string, text: string, replyTo?: string | null) {
  await sendMail(to, subject, layout(inner + `<p style="margin:22px 0 0;font-size:12px;color:#6b7280">Endeavor Business Solutions · endeavorbiz.com</p>`), text, replyTo ? { replyTo } : {})
    .catch((e) => console.error("mail", subject, e));
}

async function pageWithOwner(slug: string) {
  const { data: p } = await db.from("ct_booking_pages").select("*, clients(name, primary_email, language)").eq("slug", slug.toLowerCase()).maybeSingle();
  return p;
}
function ownerTo(p: Any) { return p.notify_email && EMAIL.test(p.notify_email) ? p.notify_email : p.clients?.primary_email; }

async function apptMails(kind: "booked" | "cancelled", a: Any, p: Any, lang: "pt" | "en" | "es", by: "customer" | "owner") {
  const biz = p.clients?.name || "", t = T[lang], ol = L(p.clients?.language), ot = T[ol];
  const wC = when(a.start_at, a.timezone || p.timezone, lang), wO = when(a.start_at, p.timezone, ol);
  const cancelUrl = `${SITE}/agendar.html?lang=${lang}&t=${a.token}`, bookUrl = `${SITE}/agendar.html?lang=${lang}&p=${p.slug}`;
  const portal = `${SITE}/client.html?lang=${ol}#/agenda`;
  const info = `<p style="margin:14px 0 4px"><strong>${esc(t.how)}:</strong> ${esc(t[p.location_kind as "video"] || "")}</p>${p.meeting_info ? `<p style="margin:0;white-space:pre-line">${esc(p.meeting_info)}</p>` : ""}`;
  const who = `<table role="presentation" style="margin:12px 0;font:14px/1.6 Arial,sans-serif"><tr><td style="color:#6b7280;padding-right:12px">${ot.name}</td><td>${esc(a.name)}</td></tr><tr><td style="color:#6b7280;padding-right:12px">${ot.email}</td><td>${esc(a.email)}</td></tr>${a.phone ? `<tr><td style="color:#6b7280;padding-right:12px">${ot.phoneL}</td><td>${esc(a.phone)}</td></tr>` : ""}${a.notes ? `<tr><td style="color:#6b7280;padding-right:12px;vertical-align:top">${ot.notes}</td><td>${esc(a.notes)}</td></tr>` : ""}</table>`;
  if (kind === "booked") {
    await mail(a.email, t.conf(biz), `<p>${esc(t.hi(a.name.split(" ")[0]))}</p><p>${t.confLead(esc(biz), esc(wC))}</p>${info}<p style="margin:20px 0 0;font-size:14px">${esc(t.cancelQ)}</p>${btn(cancelUrl, t.cancelBtn)}`,
      `${t.hi(a.name)}\n${t.confLead(biz, wC).replace(/<[^>]+>/g, "")}\n${p.meeting_info || ""}\n${t.cancelQ} ${cancelUrl}`, ownerTo(p));
    const to = ownerTo(p);
    if (to) await mail(to, ot.newT(a.name, wO), `<p>${esc(ot.newLead)}</p><p><strong>${esc(wO)}</strong></p>${who}${btn(portal, ot.openPortal)}`, `${ot.newLead}\n${wO}\n${a.name} <${a.email}> ${a.phone || ""}\n${a.notes || ""}\n${portal}`, a.email);
  } else {
    await mail(a.email, t.canT(biz), `<p>${esc(t.hi(a.name.split(" ")[0]))}</p><p>${t.canLead(esc(biz), esc(wC))}</p>${btn(bookUrl, t.rebook)}`, `${t.canLead(biz, wC).replace(/<[^>]+>/g, "")}\n${bookUrl}`, ownerTo(p));
    const to = ownerTo(p);
    if (to && by === "customer") await mail(to, ot.canOwnerT(a.name, wO), `<p>${ot.canLead(esc(a.name), esc(wO))}</p>${who}${btn(portal, ot.openPortal)}`, `${a.name} · ${wO}`, a.email);
  }
}

// a booking also becomes a contact in the client's CRM (when the client has the CRM)
async function toCrm(a: Any) {
  const { data: has } = await db.rpc("client_has_service", { p_client: a.client_id, p_code: "crm" });
  if (!has) return;
  const { data: ex } = await db.from("ct_contacts").select("id").eq("client_id", a.client_id).ilike("email", a.email).limit(1);
  let id = ex?.[0]?.id;
  if (!id) { const { data: c } = await db.from("ct_contacts").insert({ client_id: a.client_id, name: a.name, email: a.email, phone: a.phone, source: "Agenda", stage: "new" }).select("id").single(); id = c?.id; }
  if (id) await db.from("ct_notes").insert({ contact_id: id, client_id: a.client_id, created_by: "agenda", body: `Agendou pela página de agendamento: ${when(a.start_at, a.timezone || "America/New_York", "pt")}${a.notes ? " — " + a.notes : ""}` });
}

async function owner(req: Request, clientId: string, tool: string) {
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Fail("unauthorized", 401);
  const { data: ok } = await user.rpc("my_tool", { p_client: clientId, p_code: tool });
  if (!ok) throw new Fail("forbidden", 403);
  return u.user;
}

async function handle(req: Request, b: Any) {
  const a = String(b.action || "");
  if (a === "agenda_page") {
    const slug = clean(b.slug, 40).toLowerCase();
    const { data } = await db.rpc("ct_page_public", { p_slug: slug });
    if (!data?.[0]) throw new Fail("not_found", 404);
    return data[0];
  }
  if (a === "agenda_slots") {
    const from = String(b.from || "").slice(0, 10), to = String(b.to || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Fail("bad_dates");
    const { data, error } = await db.rpc("ct_slots", { p_slug: clean(b.slug, 40).toLowerCase(), p_from: from, p_to: to });
    if (error) throw new Fail("server_error", 500);
    return { slots: (data || []).map((x: Any) => typeof x === "string" ? x : x.ct_slots) };
  }
  if (a === "agenda_book") {
    if (b.website) return { ok: true }; // bots fill the hidden field
    const slug = clean(b.slug, 40).toLowerCase(), name = clean(b.name, 120), email = clean(b.email, 254).toLowerCase();
    if (name.length < 2) throw new Fail("invalid_name");
    if (!EMAIL.test(email)) throw new Fail("invalid_email");
    const start = new Date(String(b.start || ""));
    if (isNaN(start.getTime())) throw new Fail("slot_unavailable");
    const since = new Date(Date.now() - 36e5).toISOString();
    const { count } = await db.from("ct_appointments").select("id", { count: "exact", head: true }).ilike("email", email).gte("created_at", since);
    if ((count ?? 0) >= 4) throw new Fail("too_many_attempts", 429);
    const { data: r, error } = await db.rpc("ct_book", { p_slug: slug, p_start: start.toISOString(), p_name: name, p_email: email, p_phone: clean(b.phone, 40) || null, p_notes: clean(b.notes, 1000) || null, p_tz: clean(b.tz, 64) || null });
    if (error) throw new Fail(/slot_unavailable/.test(error.message) ? "slot_unavailable" : /page_not_found/.test(error.message) ? "not_found" : "server_error", /server/.test(error.message) ? 500 : 409);
    const p = await pageWithOwner(slug);
    await apptMails("booked", r, p, L(b.lang), "customer");
    await toCrm(r).catch((e) => console.error("crm", e));
    return { ok: true, start_at: r.start_at, end_at: r.end_at, token: r.token };
  }
  if (a === "agenda_get" || a === "agenda_cancel") {
    const tok = String(b.token || "");
    if (!UUID.test(tok)) throw new Fail("not_found", 404);
    const { data: r } = await db.from("ct_appointments").select("*, ct_booking_pages(*, clients(name, primary_email, language))").eq("token", tok).maybeSingle();
    if (!r) throw new Fail("not_found", 404);
    const p = r.ct_booking_pages;
    if (a === "agenda_get") return { business: p.clients?.name, title: p.title, slug: p.slug, start_at: r.start_at, end_at: r.end_at, status: r.status, name: r.name, location_kind: p.location_kind, timezone: r.timezone || p.timezone };
    if (r.status !== "confirmed" || new Date(r.start_at) < new Date()) throw new Fail("not_changeable", 409);
    await db.from("ct_appointments").update({ status: "cancelled", cancelled_by: "customer" }).eq("id", r.id);
    await apptMails("cancelled", r, p, L(b.lang), "customer");
    return { ok: true };
  }
  if (a === "agenda_owner_cancel") {
    const { data: r } = await db.from("ct_appointments").select("*, ct_booking_pages(*, clients(name, primary_email, language))").eq("id", String(b.appointment_id || "")).maybeSingle();
    if (!r) throw new Fail("not_found", 404);
    await owner(req, r.client_id, "agenda");
    if (r.status !== "confirmed") throw new Fail("not_changeable", 409);
    await db.from("ct_appointments").update({ status: "cancelled", cancelled_by: "owner" }).eq("id", r.id);
    await apptMails("cancelled", r, r.ct_booking_pages, L(b.lang || r.ct_booking_pages?.clients?.language), "owner");
    return { ok: true };
  }
  if (a === "esign_mail") {
    const { data: e } = await db.from("envelopes").select("*, clients(name, primary_email)").eq("id", String(b.envelope_id || "")).maybeSingle();
    if (!e?.client_id) throw new Fail("not_found", 404);
    const u = await owner(req, e.client_id, "esign");
    if (!["sent", "viewed"].includes(e.status)) throw new Fail("not_changeable", 409);
    const lang = L(b.lang), t = T[lang], c = e.clients?.name || "";
    const link = `${SITE}/sign.html?t=${encodeURIComponent(e.token)}&lang=${lang}`;
    const exp = new Intl.DateTimeFormat(LOC[lang], { day: "numeric", month: "long", year: "numeric" }).format(new Date(e.token_expires_at));
    await sendMail(e.signer_email, t.esT(c, e.title), layout(`<p>${esc(t.hi(String(e.signer_name).split(" ")[0]))}</p><p>${t.esLead(esc(c), esc(e.title))}</p>${e.message ? `<p style="white-space:pre-line;border-left:3px solid #c9a24a;padding-left:12px">${esc(e.message)}</p>` : ""}${btn(link, t.esBtn)}<p style="font-size:13px;color:#6b7280">${esc(t.esExp(exp))}</p>`),
      `${t.esLead(c, e.title).replace(/<[^>]+>/g, "")}\n${e.message || ""}\n${link}\n${t.esExp(exp)}`, { replyTo: u.email || e.clients?.primary_email });
    await db.from("envelope_events").insert({ envelope_id: e.id, event: "emailed", details: { to: e.signer_email, by: "client" } });
    return { ok: true };
  }
  throw new Fail("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b: Any = {};
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try { return json(await handle(req, b)); }
  catch (e) { if (e instanceof Fail) return json({ error: e.code }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
});
