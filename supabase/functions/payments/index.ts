// Endeavor payments: Stripe invoices for clients, Stripe Connect payouts to referral partners, and the Stripe webhook.
// Secrets (Supabase > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY            Endeavor's Stripe secret key (sk_test_... or sk_live_...) — the Connect platform account
//   STRIPE_WEBHOOK_SECRET        signing secret of the webhook endpoint for Endeavor's own events (whsec_...)
//   STRIPE_PUBLISHABLE_KEY       publishable key (pk_test_... / pk_live_...) for the in-portal checkout (Payment Element)
//   STRIPE_CONNECT_WEBHOOK_SECRET (optional) signing secret of the endpoint that listens to events on connected accounts
//   PAYMENTS_RETURN_ORIGINS      (optional) comma-separated site origins allowed as return URLs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SK = Deno.env.get("STRIPE_SECRET_KEY") || "";
const PK = (Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "").startsWith("pk_") ? Deno.env.get("STRIPE_PUBLISHABLE_KEY")! : "";
const WH = [Deno.env.get("STRIPE_WEBHOOK_SECRET"), Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")].filter(Boolean) as string[];
const ORIGINS = (Deno.env.get("PAYMENTS_RETURN_ORIGINS") || "https://endeavorbiz.com,https://www.endeavorbiz.com,https://bntouchnetwork.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const STRIPE_VERSION = "2024-06-20"; // pinned: keeps invoice.charge and invoice transfer_data semantics stable
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400, public detail?: string) { super(code); } }

/* ---------------- Stripe REST ---------------- */
function form(o: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}
async function stripe(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, idem?: string) {
  if (!SK) throw new Fail("stripe_not_configured", 503);
  const headers: Record<string, string> = { Authorization: "Bearer " + SK, "Stripe-Version": STRIPE_VERSION };
  let url = "https://api.stripe.com/v1" + path, payload: string | undefined;
  if (body && method === "GET") url += "?" + form(body).toString();
  else if (body) { payload = form(body).toString(); headers["Content-Type"] = "application/x-www-form-urlencoded"; }
  if (idem) headers["Idempotency-Key"] = idem;
  const r = await fetch(url, { method, headers, body: payload });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("stripe", path, r.status, j?.error?.message); throw new Fail("stripe_error", 502, j?.error?.message || ("HTTP " + r.status)); }
  return j;
}

/* ---------------- webhook signature ---------------- */
const enc = new TextEncoder();
async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEq(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function verifySig(raw: string, header: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2 && p[0] === "t"));
  const t = parts.t, sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  for (const s of WH) { const h = await hmacHex(s, `${t}.${raw}`); if (sigs.some((x) => safeEq(x, h))) return true; }
  return false;
}

/* ---------------- who is calling ---------------- */
async function caller(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Fail("unauthorized", 401);
  const [{ data: isAdmin }, { data: partnerId }] = await Promise.all([user.rpc("is_admin"), user.rpc("my_partner_id")]);
  return { email: u.user.email || "", isAdmin: !!isAdmin, partnerId: (partnerId as string) || null, user };
}
const needAdmin = (c: { isAdmin: boolean }) => { if (!c.isAdmin) throw new Fail("forbidden", 403); };
function safeReturn(url: string) {
  try { const u = new URL(url); if (u.protocol === "https:" && ORIGINS.includes(u.origin)) return u.origin + u.pathname + u.search; } catch { /* ignore */ }
  return null;
}

/* ---------------- sync helpers ---------------- */
async function syncPartner(partnerId: string, acct?: any) {
  const { data: p } = await admin.from("partners").select("id, stripe_account_id").eq("id", partnerId).single();
  if (!p?.stripe_account_id) return null;
  acct = acct || await stripe("GET", `/accounts/${p.stripe_account_id}`);
  const upd = { stripe_details_submitted: !!acct.details_submitted, stripe_charges_enabled: !!acct.charges_enabled, stripe_payouts_enabled: !!acct.payouts_enabled,
    stripe_transfers_active: acct.capabilities?.transfers === "active" };
  await admin.from("partners").update(upd).eq("id", partnerId);
  return upd;
}
function invoiceFields(inv: any) {
  const st = ["draft", "open", "paid", "void", "uncollectible"].includes(inv.status) ? inv.status : "open";
  return { status: st, number: inv.number || null, hosted_invoice_url: inv.hosted_invoice_url || null, invoice_pdf: inv.invoice_pdf || null,
    total_cents: inv.total ?? 0, amount_paid_cents: inv.amount_paid ?? 0, currency: inv.currency || "usd",
    due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
    paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null };
}
async function syncInvoice(stripeInvoice: any) {
  const { data: row } = await admin.from("invoices").select("id, client_id, status, number, archive_path, transfer_status, partner_amount_cents, total_cents, currency, clients(name, primary_email)").eq("stripe_invoice_id", stripeInvoice.id).maybeSingle();
  if (!row) return null;
  const upd: Record<string, unknown> = invoiceFields(stripeInvoice);
  // destination charge: Stripe moves the partner share automatically when the invoice is paid
  if (stripeInvoice.status === "paid" && row.transfer_status === "scheduled") upd.transfer_status = "paid";
  await admin.from("invoices").update(upd).eq("id", row.id);
  if (stripeInvoice.status === "paid" && row.status !== "paid") {
    const cl: any = (row as any).clients || {};
    const amt = ((stripeInvoice.amount_paid ?? row.total_cents) / 100).toLocaleString("en-US", { style: "currency", currency: (stripeInvoice.currency || "usd").toUpperCase() });
    await admin.from("admin_events").insert({ kind: "payment_received", title: `Pagamento recebido: ${amt} · ${cl.name || ""}`, body: `Fatura ${stripeInvoice.number || ""} paga pelo portal/Stripe (${cl.primary_email || ""}).`, link: "#/pagamentos?tab=faturas" });
    if (!row.archive_path) await archiveInvoice({ ...row, number: stripeInvoice.number || row.number }, stripeInvoice).catch((e) => console.error("archive", e));
  }
  return { id: row.id, ...upd };
}
// keeps a copy of the paid invoice PDF in the client's private storage (history even if Stripe links change)
async function archiveInvoice(row: any, inv: any) {
  if (!inv.invoice_pdf) return;
  const r = await fetch(inv.invoice_pdf, { redirect: "follow" });
  if (!r.ok) return;
  const bytes = new Uint8Array(await r.arrayBuffer());
  const path = `${row.client_id}/billing/${String(row.number || row.id).replace(/[^\w.-]+/g, "-")}.pdf`;
  const up = await admin.storage.from("client-docs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (!up.error) await admin.from("invoices").update({ archive_path: path }).eq("id", row.id);
}

async function ensureCustomer(client: any) {
  if (client.stripe_customer_id) return client.stripe_customer_id;
  const loc = { pt: "pt-BR", es: "es", en: "en" }[client.language as string] || "en";
  const c = await stripe("POST", "/customers", { name: client.name, email: client.primary_email, phone: client.phone || undefined, preferred_locales: [loc], metadata: { client_id: client.id } }, "cust-" + client.id);
  await admin.from("clients").update({ stripe_customer_id: c.id }).eq("id", client.id);
  return c.id;
}
async function finalizeAndSend(row: any) {
  let inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`);
  if (inv.status === "draft") inv = await stripe("POST", `/invoices/${row.stripe_invoice_id}/finalize`, { auto_advance: true });
  try { inv = await stripe("POST", `/invoices/${row.stripe_invoice_id}/send`); } catch (e) { console.error("send", e); }
  await admin.from("invoices").update({ ...invoiceFields(inv), sent_at: new Date().toISOString() }).eq("id", row.id);
  return inv;
}

async function createInvoice(body: any) {
    const clientId = String(body.client_id || "");
    const { data: client } = await admin.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Fail("not_found", 404);
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 20).map((i: any) => ({
      description: String(i.description || "").trim().slice(0, 300), amount_cents: Math.round(Number(i.amount_cents)), quantity: Math.max(1, Math.min(1000, Math.round(Number(i.quantity) || 1))) }));
    if (!items.length || items.some((i: any) => !i.description || !(i.amount_cents >= 1 && i.amount_cents <= 10_000_000))) throw new Fail("invalid_items");
    const total = items.reduce((s: number, i: any) => s + i.amount_cents * i.quantity, 0);
    const days = Math.max(0, Math.min(90, Math.round(Number(body.days_until_due ?? 7))));
    let partner: any = null, pct: number | null = null, share = 0;
    if (body.partner_id) {
      const { data: p } = await admin.from("partners").select("*").eq("id", String(body.partner_id)).single();
      if (!p) throw new Fail("partner_not_found");
      partner = p;
      pct = body.partner_pct != null && body.partner_pct !== "" ? Number(body.partner_pct) : Number(p.default_share_pct);
      if (!(pct >= 0 && pct <= 100)) throw new Fail("invalid_share");
      share = body.partner_amount_cents != null && body.partner_amount_cents !== "" ? Math.round(Number(body.partner_amount_cents)) : Math.round(total * pct / 100);
      if (!(share >= 0 && share <= total)) throw new Fail("invalid_share");
    }
    const auto = !!(partner && share > 0 && partner.stripe_account_id && partner.stripe_transfers_active);
    const customer = await ensureCustomer(client);
    const key = "inv-" + (body.proposal_id ? "prop-" + body.proposal_id : crypto.randomUUID());
    const inv = await stripe("POST", "/invoices", {
      customer, collection_method: "send_invoice", days_until_due: days, auto_advance: false, pending_invoice_items_behavior: "exclude",
      description: body.description ? String(body.description).slice(0, 500) : undefined,
      metadata: { client_id: client.id, partner_id: partner?.id, referral_id: body.referral_id || undefined, proposal_id: body.proposal_id || undefined },
      ...(auto ? { transfer_data: { destination: partner.stripe_account_id, amount: share }, transfer_group: key } : {}),
    }, key);
    for (const [n, i] of items.entries()) {
      await stripe("POST", "/invoiceitems", { customer, invoice: inv.id, description: i.description, unit_amount: i.amount_cents, quantity: i.quantity, currency: "usd" }, key + "-" + n);
    }
    const fresh = await stripe("GET", `/invoices/${inv.id}`);
    const row = { client_id: client.id, referral_id: body.referral_id || null, partner_id: partner?.id || null, partner_pct: partner ? pct : null, proposal_id: body.proposal_id || null,
      partner_amount_cents: share, transfer_status: partner && share > 0 ? (auto ? "scheduled" : "pending") : "none", stripe_invoice_id: inv.id,
      items, description: body.description || null, customer_email: client.primary_email, created_by: body.created_by || null, ...invoiceFields(fresh) };
    const { data: saved, error } = await admin.from("invoices").insert(row).select("*").single();
    if (error) throw error;
    if (body.send) await finalizeAndSend(saved);
    else if (body.finalize) { // ready to pay in the portal; the portal e-mail replaces Stripe's own e-mail
      const fin = await stripe("POST", `/invoices/${inv.id}/finalize`, { auto_advance: false });
      await admin.from("invoices").update(invoiceFields(fin)).eq("id", saved.id);
    }
    return saved.id as string;
}

/* ---------------- proposals (public accept page + admin) ---------------- */
const SITE = (Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
const tokenOk = (t: string) => /^[A-Za-z0-9_-]{32,64}$/.test(t);
async function proposalByToken(token: string) {
  if (!tokenOk(token)) throw new Fail("not_found", 404);
  const { data: p } = await admin.from("proposals").select("*, clients(name, primary_email, language)").eq("token", token).maybeSingle();
  if (!p || p.status === "draft" || p.status === "void") throw new Fail("not_found", 404);
  if (p.status === "sent" && p.valid_until && p.valid_until < new Date().toISOString().slice(0, 10)) { await admin.from("proposals").update({ status: "expired" }).eq("id", p.id); p.status = "expired"; }
  return p;
}
function publicProposal(p: any) {
  return { title: p.title, intro: p.intro, included: p.included, items: p.items, total_cents: p.total_cents, currency: p.currency, terms: p.terms, language: p.language,
    valid_until: p.valid_until, status: p.status, client_name: p.clients?.name, accepted_at: p.accepted_at, accepted_name: p.accepted_name, sent_at: p.sent_at };
}
const likeEsc = (v: string) => v.replace(/[\\%_]/g, (m) => "\\" + m);
// Portal access e-mail sent by Supabase Auth: invitation (new user, link to create the password) or password reset (existing user).
async function sendAccess(email: string, page: string, lang: string) {
  const redirectTo = `${SITE}/${page}?lang=${["pt", "en", "es"].includes(lang) ? lang : "pt"}`;
  const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!inv.error) return "invite";
  if (!/already|registered|exists/i.test(inv.error.message)) throw new Fail("access_email_failed", 502, inv.error.message);
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
  const r = await anon.auth.resetPasswordForEmail(email, { redirectTo });
  if (r.error) throw new Fail("access_email_failed", 502, r.error.message);
  return "reset";
}

async function publicAction(req: Request, body: any) {
  const p = await proposalByToken(String(body.token || ""));
  if (body.action === "proposal_get") {
    if (!p.viewed_at) await admin.from("proposals").update({ viewed_at: new Date().toISOString() }).eq("id", p.id);
    return publicProposal(p);
  }
  // proposal_accept
  const name = String(body.name || "").trim().slice(0, 200);
  if (name.length < 3 || body.agree !== true) throw new Fail("invalid_acceptance");
  const lang = p.language || p.clients?.language || "pt";
  const portal = `${SITE}/client.html?lang=${lang}#/invoices`;
  if (p.status === "accepted") return { ...publicProposal(p), portal_url: portal, already: true };
  if (p.status !== "sent") throw new Fail("proposal_closed");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null;
  const { data: upd } = await admin.from("proposals").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_name: name, accepted_ip: ip,
    accepted_user_agent: (req.headers.get("user-agent") || "").slice(0, 300) }).eq("id", p.id).eq("status", "sent").select("id").maybeSingle();
  if (!upd) throw new Fail("proposal_closed");
  // portal access for the client (owner), if not yet invited
  const email = String(p.clients?.primary_email || "").toLowerCase();
  const { data: owner } = await admin.from("client_users").select("id, status").eq("client_id", p.client_id).eq("role", "owner").ilike("email", likeEsc(email)).maybeSingle();
  let firstAccess = !owner || owner.status !== "active";
  if (!owner) await admin.from("client_users").insert({ client_id: p.client_id, email, name: p.clients?.name || name, role: "owner", status: "invited", can_view: true, can_upload: true, invited_by: "proposal" });
  let accessEmail: string | null = null;
  if (firstAccess && email) { try { accessEmail = await sendAccess(email, "client.html", lang); } catch (e) { console.error("access email", e); } }
  // invoice ready to pay in the portal
  let invoice: any = null;
  if (SK && !p.invoice_id) {
    try {
      const id = await createInvoice({ client_id: p.client_id, items: p.items, days_until_due: p.days_until_due, description: p.title, partner_id: p.partner_id, partner_pct: p.partner_pct,
        referral_id: p.referral_id, proposal_id: p.id, finalize: true, created_by: "proposal" });
      await admin.from("proposals").update({ invoice_id: id }).eq("id", p.id);
      const { data: inv } = await admin.from("invoices").select("number, total_cents, currency, due_date").eq("id", id).single();
      invoice = inv;
    } catch (e) { console.error("proposal invoice", e); }
  }
  const total = (p.total_cents / 100).toLocaleString("en-US", { style: "currency", currency: (p.currency || "usd").toUpperCase() });
  await admin.from("admin_events").insert({ kind: "proposal_accepted", title: `Proposta aceita: ${p.title} · ${p.clients?.name || ""}`,
    body: `${name} aceitou (${total}).` + (invoice ? ` Fatura ${invoice.number} criada e aguardando pagamento no portal.` : " Gere a fatura em Pagamentos."), link: "#/pagamentos?tab=propostas" });
  return { ...publicProposal({ ...p, status: "accepted", accepted_name: name, accepted_at: new Date().toISOString() }), portal_url: portal, first_access: firstAccess, access_email: accessEmail, email, invoice };
}

/* ---------------- actions ---------------- */
async function handle(req: Request, body: any) {
  const c = await caller(req);
  const a = String(body.action || "");

  // client checkout: the invoice must be visible to the caller under RLS (owner of the client with MFA, or admin)
  if (a === "invoice_checkout" || a === "invoice_refresh") {
    const { data: row } = await c.user.from("invoices").select("id, stripe_invoice_id, status").eq("id", String(body.invoice_id || "")).maybeSingle();
    if (!row?.stripe_invoice_id) throw new Fail("not_found", 404);
    if (a === "invoice_refresh") { const s = await syncInvoice(await stripe("GET", `/invoices/${row.stripe_invoice_id}`)); return { ok: true, status: s?.status }; }
    const inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`, { expand: ["payment_intent"] });
    await syncInvoice(inv);
    const base = { status: inv.status, hosted_invoice_url: inv.hosted_invoice_url || null, invoice_pdf: inv.invoice_pdf || null, amount_due: inv.amount_due, currency: inv.currency };
    const pi = inv.payment_intent;
    if (inv.status !== "open" || !pi?.client_secret || !PK) return base;
    return { ...base, client_secret: pi.client_secret, publishable_key: PK };
  }

  // (re)send the portal access e-mail: admin for anyone; a client owner for the people of their own client
  if (a === "send_access") {
    let email = "", page = "client.html", lang = "pt";
    if (body.partner_id) {
      needAdmin(c);
      const { data: p } = await admin.from("partners").select("email, language").eq("id", String(body.partner_id)).single();
      if (!p) throw new Fail("not_found", 404);
      email = p.email; page = "partner.html"; lang = p.language;
    } else {
      const { data: cu } = await admin.from("client_users").select("email, role, status, client_id, clients(language)").eq("client_id", String(body.client_id || "")).ilike("email", likeEsc(String(body.email || ""))).neq("status", "revoked").maybeSingle();
      if (!cu) throw new Fail("not_found", 404);
      if (!c.isAdmin) { const { data: role } = await c.user.rpc("my_client_role", { p_client: cu.client_id }); if (role !== "owner") throw new Fail("forbidden", 403); }
      email = cu.email; page = cu.role === "owner" ? "client.html" : "partner.html"; lang = (cu as any).clients?.language || "pt";
    }
    return { ok: true, sent: await sendAccess(email.toLowerCase(), page, lang) };
  }

  if (a === "invoice_archive") {
    const { data: row } = await c.user.from("invoices").select("id, archive_path, invoice_pdf").eq("id", String(body.invoice_id || "")).maybeSingle();
    if (!row) throw new Fail("not_found", 404);
    if (row.archive_path) { const sg = await admin.storage.from("client-docs").createSignedUrl(row.archive_path, 300); if (!sg.error) return { url: sg.data.signedUrl }; }
    if (row.invoice_pdf) return { url: row.invoice_pdf };
    throw new Fail("not_found", 404);
  }

  if (a === "proposal_send" || a === "proposal_invoice") {
    needAdmin(c);
    const { data: p } = await admin.from("proposals").select("*").eq("id", String(body.proposal_id || "")).single();
    if (!p) throw new Fail("not_found", 404);
    if (a === "proposal_send") {
      if (!["draft", "sent", "expired"].includes(p.status)) throw new Fail("proposal_closed");
      const token = p.token || Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
      const valid = p.valid_until && p.valid_until >= new Date().toISOString().slice(0, 10) ? p.valid_until : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      await admin.from("proposals").update({ token, status: "sent", sent_at: new Date().toISOString(), valid_until: valid }).eq("id", p.id);
      return { ok: true, url: `${SITE}/proposal.html?t=${token}&lang=${p.language}` };
    }
    if (p.status !== "accepted") throw new Fail("proposal_not_accepted");
    if (p.invoice_id) return { ok: true, id: p.invoice_id };
    const id = await createInvoice({ client_id: p.client_id, items: p.items, days_until_due: p.days_until_due, description: p.title, partner_id: p.partner_id, partner_pct: p.partner_pct,
      referral_id: p.referral_id, proposal_id: p.id, finalize: true, created_by: c.email });
    await admin.from("proposals").update({ invoice_id: id }).eq("id", p.id);
    return { ok: true, id };
  }

  if (a === "status") {
    needAdmin(c);
    if (!SK) return { configured: false, webhook_configured: WH.length > 0, checkout_ready: !!PK };
    const acct = await stripe("GET", "/account");
    let connect_ready = true, connect_error: string | null = null;
    try { await stripe("GET", "/accounts", { limit: 1 }); } catch (e) { connect_ready = false; connect_error = (e as Fail).detail || "connect_unavailable"; }
    const s = { account_id: acct.id, account_name: acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.email || acct.id,
      livemode: SK.startsWith("sk_live_") || SK.startsWith("rk_live_"), charges_enabled: !!acct.charges_enabled, payouts_enabled: !!acct.payouts_enabled,
      connect_ready, webhook_configured: WH.length > 0, checked_at: new Date().toISOString(), last_error: connect_error };
    await admin.from("stripe_settings").update(s).eq("id", 1);
    return { configured: true, checkout_ready: !!PK, ...s };
  }

  if (a === "partner_onboard" || a === "partner_refresh" || a === "partner_login") {
    const pid = c.isAdmin && body.partner_id ? String(body.partner_id) : c.partnerId;
    if (!pid) throw new Fail("forbidden", 403);
    const { data: p } = await admin.from("partners").select("*").eq("id", pid).single();
    if (!p) throw new Fail("not_found", 404);
    if (a === "partner_refresh") return { ok: true, ...(await syncPartner(pid)) };
    if (a === "partner_login") {
      if (!p.stripe_account_id || !p.stripe_details_submitted) throw new Fail("stripe_not_connected");
      const l = await stripe("POST", `/accounts/${p.stripe_account_id}/login_links`);
      return { url: l.url };
    }
    const ret = safeReturn(String(body.return_to || ""));
    if (!ret) throw new Fail("bad_return_url");
    let acctId = p.stripe_account_id;
    if (!acctId) {
      const country = /^[A-Z]{2}$/.test(String(body.country || "")) ? String(body.country) : "US";
      const acct = await stripe("POST", "/accounts", {
        type: "express", country, email: p.email,
        capabilities: { transfers: { requested: true } },
        ...(country !== "US" ? { tos_acceptance: { service_agreement: "recipient" } } : {}),
        business_profile: { product_description: "Referral partner of Endeavor Business Solutions" },
        metadata: { partner_id: p.id },
      }, "acct-" + p.id + "-" + country);
      acctId = acct.id;
      await admin.from("partners").update({ stripe_account_id: acctId }).eq("id", p.id);
    }
    const link = await stripe("POST", "/account_links", { account: acctId, type: "account_onboarding",
      refresh_url: ret + "#/payouts?stripe=refresh", return_url: ret + "#/payouts?stripe=return" });
    return { url: link.url };
  }

  if (a === "invoice_create") {
    needAdmin(c);
    const id = await createInvoice({ ...body, created_by: c.email });
    return { ok: true, id };
  }

  if (["invoice_send", "invoice_void", "invoice_sync", "transfer"].includes(a)) {
    needAdmin(c);
    const { data: row } = await admin.from("invoices").select("*").eq("id", String(body.invoice_id || "")).single();
    if (!row?.stripe_invoice_id) throw new Fail("not_found", 404);
    if (a === "invoice_send") { await finalizeAndSend(row); return { ok: true }; }
    if (a === "invoice_sync") { await syncInvoice(await stripe("GET", `/invoices/${row.stripe_invoice_id}`)); return { ok: true }; }
    if (a === "invoice_void") {
      if (row.status === "draft") { await stripe("DELETE", `/invoices/${row.stripe_invoice_id}`); await admin.from("invoices").update({ status: "void" }).eq("id", row.id); }
      else { const inv = await stripe("POST", `/invoices/${row.stripe_invoice_id}/void`); await syncInvoice(inv); }
      return { ok: true };
    }
    // manual partner payout for an invoice paid before the partner finished Stripe onboarding
    if (row.status !== "paid") throw new Fail("invoice_not_paid");
    if (!row.partner_id || row.partner_amount_cents <= 0 || !["pending", "failed"].includes(row.transfer_status)) throw new Fail("nothing_to_transfer");
    const { data: p } = await admin.from("partners").select("*").eq("id", row.partner_id).single();
    if (!p?.stripe_account_id || !p.stripe_transfers_active) throw new Fail("partner_not_ready");
    const inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`);
    const tr = await stripe("POST", "/transfers", { amount: row.partner_amount_cents, currency: row.currency, destination: p.stripe_account_id,
      source_transaction: inv.charge || undefined, transfer_group: "inv-" + row.id, metadata: { invoice_id: row.id, partner_id: p.id } }, "tr-" + row.id);
    await admin.from("invoices").update({ transfer_status: "paid", stripe_transfer_id: tr.id }).eq("id", row.id);
    return { ok: true, transfer: tr.id };
  }
  throw new Fail("unknown_action");
}

async function webhook(raw: string, sig: string) {
  if (!WH.length || !(await verifySig(raw, sig))) return json({ error: "bad_signature" }, 400);
  const ev = JSON.parse(raw), o = ev.data?.object || {};
  try {
    if (ev.type?.startsWith("invoice.")) {
      await syncInvoice(o);
      if (ev.type === "invoice.payment_failed") await admin.from("admin_events").insert({ kind: "payment_failed", title: `Pagamento recusado: fatura ${o.number || ""}`, body: o.customer_email || null, link: "#/pagamentos?tab=faturas" });
    }
    else if (ev.type === "account.updated" && o.metadata?.partner_id) await syncPartner(o.metadata.partner_id, o);
    else if (ev.type === "transfer.reversed" && o.metadata?.invoice_id) await admin.from("invoices").update({ transfer_status: "reversed" }).eq("id", o.metadata.invoice_id);
  } catch (e) { console.error("webhook", ev.type, e); return json({ error: "processing_failed" }, 500); }
  return json({ received: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return json({ ok: true, configured: !!SK, webhook: WH.length > 0 });
  const sig = req.headers.get("stripe-signature");
  if (sig) return webhook(await req.text(), sig);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (body.action === "proposal_get" || body.action === "proposal_accept") {
    try { return json(await publicAction(req, body)); }
    catch (e) { if (e instanceof Fail) return json({ error: e.code }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
  }
  try { return json(await handle(req, body)); }
  catch (e) {
    if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status);
    console.error(e); return json({ error: "server_error" }, 500);
  }
});
