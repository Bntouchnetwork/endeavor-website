// Endeavor payments: Stripe invoices for clients, Stripe Connect payouts to referral partners, and the Stripe webhook.
// Secrets (Supabase > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY            Endeavor's Stripe secret key (sk_test_... or sk_live_...) — the Connect platform account
//   STRIPE_WEBHOOK_SECRET        signing secret of the webhook endpoint for Endeavor's own events (whsec_...)
//   STRIPE_PUBLISHABLE_KEY       publishable key (pk_test_... / pk_live_...) for the in-portal checkout (Payment Element)
//   STRIPE_CONNECT_WEBHOOK_SECRET (optional) signing secret of the endpoint that listens to events on connected accounts
//   PAYMENTS_RETURN_ORIGINS      (optional) comma-separated site origins allowed as return URLs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { accessEmail, accessMailOn, sendAccessMail, sendMail, sendWa, type AccessKind } from "./access-mail.ts";
import { store, type StoreDeps } from "./store.ts";
import { achEmail, failedEmail, intakeEmail, invoiceEmail, money as fmtMoney, proposalEmail, receiptEmail, teamEmail } from "./billing-mail.ts";

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
  let { data: row } = await admin.from("invoices").select("id, client_id, status, number, archive_path, transfer_status, partner_amount_cents, total_cents, currency, clients(name, primary_email)").eq("stripe_invoice_id", stripeInvoice.id).maybeSingle();
  if (!row && stripeInvoice.subscription) row = await insertSubscriptionInvoice(stripeInvoice);
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
    await afterPaid(row.id).catch((e) => console.error("after paid", e));
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
async function finalizeAndSend(row: any) { await deliverInvoice(row); }

/* ---------------- billing flow: send, remind, receipt, books ---------------- */
const SUPPORT_TO = "support@endeavorbiz.com";
const firstName = (n: unknown) => String(n || "").trim().split(/\s+/)[0] || "";
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
async function bell(kind: string, title: string, body: string | null, link: string) { await admin.from("admin_events").insert({ kind, title: title.slice(0, 300), body: body ? body.slice(0, 2000) : null, link }); }
async function team(title: string, lines: [string, string][], link?: string) {
  try { const m = teamEmail(title, lines, link ? { url: SITE + "/admin.html" + link, label: "Abrir no admin" } : undefined); await sendMail(SUPPORT_TO, m.subject, m.html, m.text); } catch (e) { console.error("team mail", e); }
}
async function payUrlFor(row: any, lang: string) {
  const { data: own } = await admin.from("client_users").select("id").eq("client_id", row.client_id).eq("role", "owner").eq("status", "active").limit(1).maybeSingle();
  return own ? `${SITE}/client.html?lang=${lang}#/invoices?pay=${row.id}` : (row.hosted_invoice_url || `${SITE}/client.html?lang=${lang}#/invoices`);
}
// first e-mail (with payment instructions) or reminder n; e-mail + WhatsApp
async function deliverInvoice(row: any, reminder = 0) {
  if (row.status === "draft" && row.stripe_invoice_id) {
    const fin = await stripe("POST", `/invoices/${row.stripe_invoice_id}/finalize`, { auto_advance: false });
    await admin.from("invoices").update(invoiceFields(fin)).eq("id", row.id);
    row = { ...row, ...invoiceFields(fin) };
  }
  if (row.status !== "open") return;
  const { data: cl } = await admin.from("clients").select("name, primary_email, phone, language").eq("id", row.client_id).single();
  const lang = cl?.language || "pt", url = await payUrlFor(row, lang);
  const due = row.total_cents - (row.amount_paid_cents || 0);
  const daysLate = row.due_date ? Math.max(1, Math.floor((Date.now() - new Date(row.due_date + "T12:00:00Z").getTime()) / 864e5)) : 0;
  const m = invoiceEmail({ lang, name: cl?.name || "", number: row.number || "", total: due, cur: row.currency, due: row.due_date, items: row.items || [], description: row.description, payUrl: url, pdfUrl: row.invoice_pdf, reminder, daysLate });
  await sendMail(cl?.primary_email || row.customer_email, m.subject, m.html, m.text);
  await sendWa(cl?.phone, reminder ? "endeavor_invoice_reminder" : "endeavor_invoice", lang, [firstName(cl?.name), row.number || "", fmtMoney(due, row.currency, lang), url]);
  const now = new Date().toISOString();
  await admin.from("invoices").update(reminder ? { reminders_sent: reminder, last_reminder_at: now } : { sent_at: now, scheduled_send_at: null }).eq("id", row.id);
}
// paid: books (Endeavor's own company), receipt to the client, notice to the team, then the proposal follow-up (portal + opening documents)
async function afterPaid(id: string) {
  const { data: r } = await admin.from("invoices").select("*, clients(name, primary_email, phone, language, monthly_cents, subscription_started_at)").eq("id", id).single();
  if (!r) return;
  try { await admin.rpc("bk_record_invoice_payment", { p_invoice: id }); } catch (e) { console.error("books", e); }
  try { await admin.rpc("bk_record_vendor_costs", { p_invoice: id }); } catch (e) { console.error("payables", e); }
  // AI Projects: the payment confirmed by Stripe starts the schedule and the development agents
  if (r.ai_project_id) {
    try {
      const { data: key } = await admin.rpc("internal_hook_key");
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/projects`, { method: "POST", headers: { "Content-Type": "application/json", "x-booking-key": String(key || "") }, body: JSON.stringify({ action: "paid", invoice_id: id }) });
    } catch (e) { console.error("projects paid", e); }
  }
  const cl: any = r.clients || {}, lang = cl.language || "pt";
  if (!r.receipt_sent_at) {
    let receiptUrl: string | null = null;
    try { if (r.stripe_invoice_id) { const inv = await stripe("GET", `/invoices/${r.stripe_invoice_id}`, { expand: ["charge"] }); receiptUrl = inv.charge?.receipt_url || null; } } catch { /* optional */ }
    const portal = `${SITE}/client.html?lang=${lang}#/invoices`;
    const m = receiptEmail({ lang, name: cl.name, number: r.number || "", amount: r.amount_paid_cents, cur: r.currency, paidAt: r.paid_at, items: r.items || [], receiptUrl, pdfUrl: r.invoice_pdf, portalUrl: portal,
      monthly: r.kind === "proposal" && cl.monthly_cents ? { cents: cl.monthly_cents, first: cl.subscription_started_at } : null });
    await sendMail(cl.primary_email || r.customer_email, m.subject, m.html, m.text);
    await sendWa(cl.phone, "endeavor_payment_receipt", lang, [firstName(cl.name), r.number || "", fmtMoney(r.amount_paid_cents, r.currency, lang), receiptUrl || portal]);
    await admin.from("invoices").update({ receipt_sent_at: new Date().toISOString() }).eq("id", id);
    await team(`Pagamento recebido: ${fmtMoney(r.amount_paid_cents, r.currency)} · ${cl.name || ""}`, [["Fatura", r.number || ""], ["Cliente", `${cl.name || ""} (${cl.primary_email || ""})`], ["Lançado no Bookkeeping", "Endeavor Business Solutions LLC"]], "#/pagamentos?tab=faturas");
  }
  if (r.kind === "proposal" && r.proposal_id) await afterProposalPaid(r).catch((e) => console.error("proposal follow-up", e));
}
async function afterProposalPaid(r: any) {
  const cl: any = r.clients || {}, lang = cl.language || "pt";
  const { data: owner } = await admin.from("client_users").select("id, status, email").eq("client_id", r.client_id).eq("role", "owner").maybeSingle();
  if (owner && owner.status !== "active") { try { await sendAccess(String(owner.email).toLowerCase(), "client.html", lang, { kind: "client", name: cl.name }); } catch (e) { console.error("access", e); } }
  await ensureIntake(r.client_id, r.proposal_id, lang, false);
}
// opening documents request (secure link, no login)
async function ensureIntake(clientId: string, proposalId: string | null, lang: string, resend: boolean) {
  let { data: q } = await admin.from("intake_requests").select("*").eq("client_id", clientId).neq("status", "closed").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: cl } = await admin.from("clients").select("name, primary_email, phone, language").eq("id", clientId).single();
  if (!cl) throw new Fail("not_found", 404);
  if (!q) {
    let { data: co } = await admin.from("companies").select("id").eq("client_id", clientId).eq("status", "in_formation").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!co) { const ins = await admin.from("companies").insert({ client_id: clientId, legal_name: "Nova empresa (em formação)", status: "in_formation", entity_type: "llc_foreign", state: "FL" }).select("id").single(); co = ins.data; }
    const ins = await admin.from("intake_requests").insert({ client_id: clientId, company_id: co?.id || null, proposal_id: proposalId, token: newToken(), language: lang || cl.language || "pt" }).select("*").single();
    if (ins.error) throw new Fail("db_error", 500, ins.error.message);
    q = ins.data;
  } else if (!resend && q.sent_at) return q;
  if (q.status === "complete" && !resend) return q;
  const url = `${SITE}/intake.html?t=${q.token}&lang=${q.language}`;
  const m = intakeEmail({ lang: q.language, name: cl.name, url, reminder: !!q.sent_at });
  await sendMail(cl.primary_email, m.subject, m.html, m.text);
  await sendWa(cl.phone, "endeavor_documents_request", q.language, [firstName(cl.name), url]);
  await admin.from("intake_requests").update({ sent_at: new Date().toISOString() }).eq("id", q.id);
  return { ...q, url };
}
// monthly invoices created by Stripe for the maintenance subscription
async function insertSubscriptionInvoice(inv: any) {
  let clientId: string | null = null;
  const { data: c1 } = await admin.from("clients").select("id").eq("stripe_customer_id", inv.customer).maybeSingle();
  clientId = c1?.id || null;
  if (!clientId) { try { const cus = await stripe("GET", `/customers/${inv.customer}`); clientId = cus?.metadata?.client_id || null; } catch { /* ignore */ } }
  if (!clientId) return null;
  const items = (inv.lines?.data || []).map((l: any) => ({ description: String(l.description || "Monthly maintenance").slice(0, 300), amount_cents: l.amount, quantity: 1, recurring: l.price?.recurring ? "month" : undefined }));
  const { data } = await admin.from("invoices").insert({ client_id: clientId, kind: "subscription", stripe_invoice_id: inv.id, stripe_subscription_id: inv.subscription, items, description: inv.subscription_details?.metadata?.store === "1" ? String(items[0]?.description || "Assinatura").slice(0, 300) : "Manutenção mensal",
    customer_email: inv.customer_email, partner_amount_cents: 0, transfer_status: "none", created_by: "stripe", sent_at: new Date().toISOString(), ...invoiceFields(inv) })
    .select("id, client_id, status, number, archive_path, transfer_status, partner_amount_cents, total_cents, currency, clients(name, primary_email)").single();
  // the monthly items keep the vendor cost set on the client's proposal (matched by amount)
  if (data) {
    const { data: lastP } = await admin.from("proposals").select("id, items").eq("client_id", clientId).not("accepted_at", "is", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle();
    if (lastP) {
      const { data: pc } = await admin.from("item_costs").select("*").eq("proposal_id", lastP.id);
      const rows: any[] = [];
      items.forEach((it: any, j: number) => {
        if (it.recurring !== "month") return;
        const k = (pc || []).find((c: any) => { const pi = (lastP.items || [])[c.item_index]; return pi && pi.recurring === "month" && pi.amount_cents * (pi.quantity || 1) === it.amount_cents; });
        if (k) { const pi = lastP.items[k.item_index]; rows.push({ invoice_id: data.id, item_index: j, vendor_id: k.vendor_id, cost_cents: k.cost_cents * (pi.quantity || 1) }); }
      });
      if (rows.length) await admin.from("item_costs").insert(rows);
    }
  }
  return data;
}
// hourly: scheduled sends, reminders after the due date (+1, +4, +8 days), team notice after +10 days, proposal expiry
async function billingTick() {
  const now = new Date(), today = now.toISOString().slice(0, 10), res = { sent: 0, reminders: 0, overdue: 0, expired: 0 };
  const { data: sched } = await admin.from("invoices").select("*").eq("status", "draft").not("scheduled_send_at", "is", null).lte("scheduled_send_at", now.toISOString()).is("archived_at", null).limit(50);
  for (const r of sched ?? []) { try { await deliverInvoice(r); res.sent++; } catch (e) { console.error("scheduled", r.id, e); } }
  const { data: open } = await admin.from("invoices").select("*, clients(name, primary_email)").eq("status", "open").lt("due_date", today).is("archived_at", null).limit(200);
  for (const r of open ?? []) {
    const late = Math.floor((now.getTime() - new Date(r.due_date + "T12:00:00Z").getTime()) / 864e5);
    const want = late >= 8 ? 3 : late >= 4 ? 2 : late >= 1 ? 1 : 0;
    try {
      if (want > (r.reminders_sent || 0) && (!r.last_reminder_at || now.getTime() - new Date(r.last_reminder_at).getTime() > 20 * 36e5)) { await deliverInvoice(r, (r.reminders_sent || 0) + 1); res.reminders++; }
      else if (late >= 10 && (r.reminders_sent || 0) >= 3 && !r.overdue_notified_at) {
        const amt = fmtMoney(r.total_cents - r.amount_paid_cents, r.currency), cl: any = r.clients || {};
        await bell("invoice_overdue", `Fatura em atraso: ${r.number || ""} · ${cl.name || ""} · ${amt}`, `Vencida há ${late} dias, depois de 3 lembretes por e-mail e WhatsApp. Ligue para o cliente ou combine outra forma de pagamento.`, "#/pagamentos?tab=faturas&status=open");
        await team(`Fatura em atraso: ${r.number || ""}`, [["Cliente", `${cl.name || ""} (${cl.primary_email || ""})`], ["Valor", amt], ["Vencimento", r.due_date], ["Situação", `${late} dias de atraso, 3 lembretes enviados. Ação do admin: entrar em contato.`]], "#/pagamentos?tab=faturas&status=open");
        await admin.from("invoices").update({ overdue_notified_at: now.toISOString() }).eq("id", r.id); res.overdue++;
      }
    } catch (e) { console.error("reminder", r.id, e); }
  }
  const { data: exp } = await admin.from("proposals").select("id, title, invoice_id, clients(name)").eq("status", "sent").lt("valid_until", today).limit(50);
  for (const p of exp ?? []) {
    await admin.from("proposals").update({ status: "expired" }).eq("id", p.id);
    if (p.invoice_id) await voidPending(p.invoice_id);
    await bell("proposal_expired", `Proposta vencida sem aceite: ${p.title} · ${(p as any).clients?.name || ""}`, "A fatura da proposta foi anulada. Use \"Nova proposta (cópia)\" para enviar uma nova.", "#/pagamentos?tab=propostas");
    res.expired++;
  }
  return res;
}
async function voidPending(invoiceId: string) {
  const { data: r } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!r || r.status === "paid" || r.status === "void") return;
  try {
    if (r.stripe_subscription_id) await stripe("DELETE", `/subscriptions/${r.stripe_subscription_id}`);
    if (r.stripe_invoice_id && r.status === "draft") await stripe("DELETE", `/invoices/${r.stripe_invoice_id}`);
    else if (r.stripe_invoice_id && r.status === "open") await stripe("POST", `/invoices/${r.stripe_invoice_id}/void`);
  } catch (e) { console.error("void", e); }
  await admin.from("invoices").update({ status: "void", scheduled_send_at: null }).eq("id", r.id);
}

// Vendor cost per item (e.g. the CPA's fee inside "Tax return"). Kept in item_costs, which only the admin reads,
// so the client never sees it; becomes a payable when the client pays.
function vendorCosts(raw: any): { item_index: number; vendor_id: string; cost_cents: number }[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.slice(0, 20).map((i: any, n: number) => ({ item_index: n, vendor_id: String(i?.vendor_id || ""), cost_cents: Math.round(Number(i?.cost_cents) || 0) }))
    .filter((c) => /^[0-9a-f-]{36}$/i.test(c.vendor_id) && c.cost_cents > 0 && c.cost_cents <= 10_000_000);
  return raw.some((i: any) => i && "vendor_id" in i) ? out : null;
}
async function saveCosts(key: { invoice_id: string }, costs: { item_index: number; vendor_id: string; cost_cents: number }[]) {
  await admin.from("item_costs").delete().eq("invoice_id", key.invoice_id);
  if (costs.length) await admin.from("item_costs").insert(costs.map((c) => ({ ...c, invoice_id: key.invoice_id })));
}
async function copyProposalCosts(p: any, invoiceId: string, which: "once" | "month") {
  const { data: pc } = await admin.from("item_costs").select("*").eq("proposal_id", p.id);
  if (!pc?.length) return;
  const idx: number[] = []; (p.items || []).forEach((i: any, n: number) => { if ((i.recurring === "month") === (which === "month")) idx.push(n); });
  const rows = idx.map((orig, j) => { const k = pc.find((c: any) => c.item_index === orig); return k ? { invoice_id: invoiceId, item_index: j, vendor_id: k.vendor_id, cost_cents: k.cost_cents } : null; }).filter((x): x is NonNullable<typeof x> => !!x);
  await admin.from("item_costs").delete().eq("invoice_id", invoiceId);
  if (rows.length) await admin.from("item_costs").insert(rows);
}
async function createInvoice(body: any) {
    const clientId = String(body.client_id || "");
    const { data: client } = await admin.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Fail("not_found", 404);
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 20).map((i: any) => ({
      description: String(i.description || "").trim().slice(0, 300), amount_cents: Math.round(Number(i.amount_cents)), quantity: Math.max(1, Math.min(1000, Math.round(Number(i.quantity) || 1))),
      // vendor cost (e.g. the CPA's fee inside "Tax return"): becomes a payable when the client pays; never shown to the client
 }));
    const costs = vendorCosts(body.items);
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
      items, description: body.description || null, customer_email: client.primary_email, created_by: body.created_by || null, kind: body.kind || "one_time", days_until_due: days, ...invoiceFields(fresh) };
    const { data: saved, error } = body.row_id ? await admin.from("invoices").update(row).eq("id", body.row_id).select("*").single() : await admin.from("invoices").insert(row).select("*").single();
    if (error) throw error;
    if (costs) await saveCosts({ invoice_id: saved.id }, costs);
    const mode = body.send === true || body.send === "now" ? "now" : body.send === "schedule" ? "schedule" : "draft";
    if (mode === "now") await deliverInvoice(saved);
    else if (mode === "schedule") {
      const at = new Date(String(body.send_at || "")); if (isNaN(at.getTime())) throw new Fail("invalid_date");
      await admin.from("invoices").update({ scheduled_send_at: at.toISOString() }).eq("id", saved.id);
    } else if (body.finalize) { // ready to pay in the portal; the portal e-mail replaces Stripe's own e-mail
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
  const { data: p } = await admin.from("proposals").select("*, clients(name, primary_email, language), invoices!proposals_invoice_id_fkey(number, status)").eq("token", token).maybeSingle();
  if (!p || p.status === "draft" || p.status === "void") throw new Fail("not_found", 404);
  if (p.status === "sent" && p.valid_until && p.valid_until < new Date().toISOString().slice(0, 10)) { await admin.from("proposals").update({ status: "expired" }).eq("id", p.id); p.status = "expired"; }
  return p;
}
function publicProposal(p: any) {
  return { title: p.title, intro: p.intro, included: p.included, items: p.items, total_cents: p.total_cents, currency: p.currency, terms: p.terms, language: p.language,
    valid_until: p.valid_until, status: p.status, client_name: p.clients?.name, accepted_at: p.accepted_at, accepted_name: p.accepted_name, sent_at: p.sent_at,
    monthly_cents: p.monthly_cents || 0, declined_at: p.declined_at, invoice_number: p.invoices?.number || null, invoice_status: p.invoices?.status || null };
}
const likeEsc = (v: string) => v.replace(/[\\%_]/g, (m) => "\\" + m);
// Portal access e-mail: one-time link from the Admin API, sent by Endeavor in the client's language
// (welcome with what the portal does and the authenticator steps, or password reset). Falls back to Supabase's own mail if no SMTP is set.
async function sendAccess(email: string, page: string, lang: string, o: { kind?: AccessKind; name?: string; clientName?: string; reset?: boolean; services?: string[] } = {}) {
  const l = ["pt", "en", "es"].includes(lang) ? lang : "pt";
  const redirectTo = `${SITE}/${page}?lang=${l}`;
  if (!accessMailOn()) {
    const inv = o.reset ? { error: { message: "already" } } : await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!inv.error) return "invite";
    if (!/already|registered|exists/i.test(inv.error.message)) throw new Fail("access_email_failed", 502, inv.error.message);
    const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const r = await anon.auth.resetPasswordForEmail(email, { redirectTo });
    if (r.error) throw new Fail("access_email_failed", 502, r.error.message);
    return "reset";
  }
  let kindOut = "invite";
  let gen = o.reset ? null : await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (!gen || gen.error) {
    if (gen?.error && !/already|registered|exists/i.test(gen.error.message)) throw new Fail("access_email_failed", 502, gen.error.message);
    gen = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } });
    if (gen.error) throw new Fail("access_email_failed", 502, gen.error.message);
    kindOut = "reset";
  }
  const link = (gen.data as any)?.properties?.action_link;
  if (!link) throw new Fail("access_email_failed", 502, "no_link");
  const kind: AccessKind = o.kind || (page === "client.html" ? "client" : "collab");
  await sendAccessMail(email, accessEmail({ lang: l, kind, reset: !!o.reset, name: o.name, clientName: o.clientName, link, page, services: o.services }));
  return kindOut;
}
// "Forgot password" on the portals: same branded e-mail; never says whether the address exists; at most 3 per hour per address
async function accessReset(body: any) {
  const email = String(body.email || "").trim().toLowerCase();
  const page = body.page === "partner.html" ? "partner.html" : "client.html";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Fail("invalid_email");
  const since = new Date(Date.now() - 36e5).toISOString();
  const { count } = await admin.from("access_mail_log").select("id", { count: "exact", head: true }).eq("email", email).gte("sent_at", since);
  if ((count ?? 0) >= 3) return { ok: true };
  await admin.from("access_mail_log").insert({ email, kind: "reset" });
  try {
    const { data: cu } = await admin.from("client_users").select("name").ilike("email", likeEsc(email)).limit(1).maybeSingle();
    await sendAccess(email, page, String(body.lang || "pt"), { reset: true, name: cu?.name || "" });
  } catch (e) { console.error("access reset", (e as Error).message); }
  return { ok: true };
}

async function publicAction(req: Request, body: any) {
  const p = await proposalByToken(String(body.token || ""));
  if (body.action === "proposal_get") {
    if (!p.viewed_at) await admin.from("proposals").update({ viewed_at: new Date().toISOString() }).eq("id", p.id);
    return publicProposal(p);
  }
  if (body.action === "proposal_reject") {
    const reason = String(body.reason || "").trim().slice(0, 2000);
    if (reason.length < 3) throw new Fail("invalid_reason");
    if (!["sent", "expired"].includes(p.status)) throw new Fail("proposal_closed");
    await admin.from("proposals").update({ status: "declined", declined_at: new Date().toISOString(), declined_reason: reason }).eq("id", p.id);
    if (p.invoice_id) await voidPending(p.invoice_id);
    const { data: cl } = await admin.from("clients").select("lead_id, name").eq("id", p.client_id).single();
    if (cl?.lead_id) {
      const { data: ld } = await admin.from("leads").select("notes").eq("id", cl.lead_id).maybeSingle();
      await admin.from("leads").update({ status: "rejected", notes: ((ld?.notes ? ld.notes + "\n\n" : "") + `[${new Date().toISOString().slice(0, 10)}] Proposta rejeitada (${p.title}): ${reason}`).slice(0, 20000) }).eq("id", cl.lead_id);
    }
    await bell("proposal_rejected", `Proposta rejeitada: ${p.title} · ${p.clients?.name || ""}`, `Motivo: ${reason}`, "#/pagamentos?tab=propostas");
    await team(`Proposta rejeitada: ${p.title}`, [["Cliente", `${p.clients?.name || ""} (${p.clients?.primary_email || ""})`], ["Valor", fmtMoney(p.total_cents, p.currency)], ["Motivo", reason], ["Próximo passo", "Use \"Nova proposta (cópia)\" em Pagamentos → Propostas para ajustar e enviar uma segunda oferta."]], "#/pagamentos?tab=propostas");
    return { ok: true, status: "declined" };
  }
  // proposal_accept: registers the acceptance (name, IP, browser) and returns the payment (paying is how the client confirms)
  const lang = p.language || p.clients?.language || "pt";
  if (p.status === "accepted") return { ...publicProposal(p), ...(await proposalPayment(p)) };
  const name = String(body.name || "").trim().slice(0, 200);
  if (name.length < 3 || body.agree !== true) throw new Fail("invalid_acceptance");
  if (p.status !== "sent") throw new Fail("proposal_closed");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null;
  const { data: upd } = await admin.from("proposals").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_name: name, accepted_ip: ip,
    accepted_user_agent: (req.headers.get("user-agent") || "").slice(0, 300) }).eq("id", p.id).eq("status", "sent").select("id").maybeSingle();
  if (!upd) throw new Fail("proposal_closed");
  const email = String(p.clients?.primary_email || "").toLowerCase();
  const { data: owner } = await admin.from("client_users").select("id").eq("client_id", p.client_id).eq("role", "owner").ilike("email", likeEsc(email)).maybeSingle();
  if (!owner && email) await admin.from("client_users").insert({ client_id: p.client_id, email, name: p.clients?.name || name, role: "owner", status: "invited", can_view: true, can_upload: true, invited_by: "proposal" });
  await admin.from("admin_events").insert({ kind: "proposal_accepted", title: `Proposta aceita: ${p.title} · ${p.clients?.name || ""}`, body: `${name} aceitou os termos e foi para o pagamento (${fmtMoney(p.total_cents, p.currency)}).`, link: "#/pagamentos?tab=propostas" });
  const pay = await proposalPayment({ ...p, status: "accepted" });
  return { ...publicProposal({ ...p, status: "accepted", accepted_name: name, accepted_at: new Date().toISOString() }), ...pay, email, lang };
}

// the payment of an accepted proposal: one invoice (one-time items), or a subscription with a 30-day trial when there is a monthly item
async function proposalPayment(p: any) {
  const { data: row } = p.invoice_id ? await admin.from("invoices").select("*").eq("id", p.invoice_id).maybeSingle() : { data: null };
  if (row?.status === "paid") return { paid: true };
  if (!SK || !PK) return { pay_ready: false };
  if (row?.stripe_invoice_id) {
    const inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`, { expand: ["payment_intent"] });
    if (inv.status === "paid") { await syncInvoice(inv); return { paid: true }; }
    if (inv.payment_intent?.client_secret) return { mode: "payment", client_secret: inv.payment_intent.client_secret, pk: PK, amount: inv.amount_due, hosted: inv.hosted_invoice_url, monthly: p.monthly_cents || 0 };
    if (row.stripe_subscription_id) {
      const sub = await stripe("GET", `/subscriptions/${row.stripe_subscription_id}`, { expand: ["pending_setup_intent"] });
      if (sub.pending_setup_intent?.client_secret) return { mode: "setup", client_secret: sub.pending_setup_intent.client_secret, pk: PK, amount: 0, monthly: p.monthly_cents || 0 };
    }
  }
  const { data: client } = await admin.from("clients").select("*").eq("id", p.client_id).single();
  const items = (p.items || []) as any[], once = items.filter((i) => i.recurring !== "month"), monthly = items.filter((i) => i.recurring === "month");
  if (!monthly.length) {
    const id = await createInvoice({ client_id: p.client_id, items: once, days_until_due: p.days_until_due, description: p.title, partner_id: p.partner_id, partner_pct: p.partner_pct,
      referral_id: p.referral_id, proposal_id: p.id, finalize: true, created_by: "proposal", kind: "proposal", row_id: row?.id });
    if (!row) await admin.from("proposals").update({ invoice_id: id }).eq("id", p.id);
    const { data: saved } = await admin.from("invoices").select("stripe_invoice_id").eq("id", id).single();
    const inv = await stripe("GET", `/invoices/${saved!.stripe_invoice_id}`, { expand: ["payment_intent"] });
    return { mode: "payment", client_secret: inv.payment_intent?.client_secret || null, pk: PK, amount: inv.amount_due, hosted: inv.hosted_invoice_url, monthly: 0 };
  }
  const customer = await ensureCustomer(client);
  const prod = async (name: string, k: string) => (await stripe("POST", "/products", { name: String(name || "Service").slice(0, 250), metadata: { kind: k } }, `prod-${p.id}-${k}-${name}`.slice(0, 250))).id;
  const add: any[] = [], subItems: any[] = [];
  for (const i of once) add.push({ price_data: { currency: p.currency || "usd", product: await prod(i.description, "one_time"), unit_amount: i.amount_cents }, quantity: i.quantity || 1 });
  for (const i of monthly) subItems.push({ price_data: { currency: p.currency || "usd", product: await prod(i.description, "monthly"), unit_amount: i.amount_cents, recurring: { interval: "month" } }, quantity: i.quantity || 1 });
  const sub = await stripe("POST", "/subscriptions", { customer, items: subItems, add_invoice_items: add, trial_period_days: 30, payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" }, collection_method: "charge_automatically", description: p.title.slice(0, 500),
    metadata: { client_id: p.client_id, proposal_id: p.id }, expand: ["latest_invoice.payment_intent", "pending_setup_intent"] }, "sub-prop-" + p.id);
  const inv = sub.latest_invoice || {};
  const monthlyCents = monthly.reduce((s: number, i: any) => s + i.amount_cents * (i.quantity || 1), 0);
  const fields = { client_id: p.client_id, kind: "proposal", proposal_id: p.id, stripe_invoice_id: inv.id, stripe_subscription_id: sub.id, items: once, description: p.title, customer_email: client.primary_email,
    created_by: "proposal", days_until_due: p.days_until_due, partner_id: p.partner_id || null, partner_pct: p.partner_id ? p.partner_pct : null,
    partner_amount_cents: p.partner_id ? Math.round(once.reduce((s: number, i: any) => s + i.amount_cents * (i.quantity || 1), 0) * Number(p.partner_pct || 0) / 100) : 0,
    transfer_status: p.partner_id && Number(p.partner_pct) > 0 ? "pending" : "none", ...invoiceFields(inv) };
  if (row) await admin.from("invoices").update(fields).eq("id", row.id);
  else { const { data: ins } = await admin.from("invoices").insert(fields).select("id").single(); await admin.from("proposals").update({ invoice_id: ins!.id }).eq("id", p.id); await copyProposalCosts(p, ins!.id, "once"); }
  await admin.from("clients").update({ stripe_subscription_id: sub.id, subscription_status: sub.status, monthly_cents: monthlyCents, subscription_started_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null }).eq("id", p.client_id);
  if (inv.payment_intent?.client_secret) return { mode: "payment", client_secret: inv.payment_intent.client_secret, pk: PK, amount: inv.amount_due, hosted: inv.hosted_invoice_url, monthly: monthlyCents, first_charge: sub.trial_end };
  return { mode: "setup", client_secret: sub.pending_setup_intent?.client_secret || null, pk: PK, amount: 0, monthly: monthlyCents, first_charge: sub.trial_end };
}

// admin: send the proposal with its invoice (pending until the client accepts and pays); e-mail + WhatsApp from Endeavor
async function sendProposal(p: any) {
  const items = (p.items || []) as any[], once = items.filter((i) => i.recurring !== "month"), monthly = items.filter((i) => i.recurring === "month");
  const oneTime = once.reduce((s: number, i: any) => s + i.amount_cents * (i.quantity || 1), 0), monthlyCents = monthly.reduce((s: number, i: any) => s + i.amount_cents * (i.quantity || 1), 0);
  const token = p.token || newToken();
  const valid = p.valid_until && p.valid_until >= new Date().toISOString().slice(0, 10) ? p.valid_until : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const { data: client } = await admin.from("clients").select("*").eq("id", p.client_id).single();
  let invId = p.invoice_id, number = "";
  const { data: cur } = invId ? await admin.from("invoices").select("id, status, number").eq("id", invId).maybeSingle() : { data: null };
  if (!cur || cur.status === "void") {
    number = `PRO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const share = p.partner_id ? Math.round(oneTime * Number(p.partner_pct || 0) / 100) : 0;
    const { data: ins, error } = await admin.from("invoices").insert({ client_id: p.client_id, kind: "proposal", proposal_id: p.id, status: "draft", number, items: once, total_cents: oneTime, amount_paid_cents: 0, currency: p.currency || "usd",
      description: p.title, customer_email: client.primary_email, created_by: "proposal", days_until_due: p.days_until_due, partner_id: p.partner_id || null, partner_pct: p.partner_id ? p.partner_pct : null,
      partner_amount_cents: share, transfer_status: share > 0 ? "pending" : "none" }).select("id").single();
    if (error) throw new Fail("db_error", 500, error.message);
    invId = ins!.id;
    await copyProposalCosts(p, invId, "once");
  } else number = cur.number || "";
  await admin.from("proposals").update({ token, status: "sent", sent_at: new Date().toISOString(), valid_until: valid, invoice_id: invId, monthly_cents: monthlyCents }).eq("id", p.id);
  const lang = p.language || client.language || "pt", url = `${SITE}/proposal.html?t=${token}&lang=${lang}`;
  let mailed = false;
  try {
    const m = proposalEmail({ lang, name: client.name, title: p.title, intro: p.intro, included: p.included || [], items, cur: p.currency || "usd", oneTime, monthly: monthlyCents, validUntil: valid, acceptUrl: url + "&a=pay", rejectUrl: url + "&a=reject", number });
    await sendMail(client.primary_email, m.subject, m.html, m.text); mailed = true;
  } catch (e) { console.error("proposal mail", e); }
  await sendWa(client.phone, "endeavor_proposal", lang, [firstName(client.name), p.title, url]);
  return { ok: true, url, mailed };
}

// ACH on the company's US account: request (admin), then the public page creates the SetupIntent and switches the subscription
async function achPublic(body: any) {
  const tok = String(body.token || "");
  if (!tokenOk(tok)) throw new Fail("not_found", 404);
  const { data: br } = await admin.from("billing_requests").select("*, clients(*)").eq("token", tok).maybeSingle();
  if (!br || br.status === "closed" || new Date(br.expires_at) < new Date()) throw new Fail("not_found", 404);
  const cl: any = br.clients;
  if (body.action === "ach_get") {
    if (br.status === "done") return { done: true, client_name: cl.name, bank: br.bank_label, language: br.language };
    if (!SK || !PK) throw new Fail("stripe_not_configured", 503);
    const customer = await ensureCustomer(cl);
    const si = await stripe("POST", "/setup_intents", { customer, payment_method_types: ["us_bank_account"], usage: "off_session",
      payment_method_options: { us_bank_account: { verification_method: "automatic", financial_connections: { permissions: ["payment_method"] } } }, metadata: { client_id: cl.id, billing_request: br.id } });
    return { client_secret: si.client_secret, pk: PK, client_name: cl.name, email: cl.primary_email, monthly: cl.monthly_cents || 0, language: br.language };
  }
  // ach_complete
  const si = await stripe("GET", `/setup_intents/${String(body.setup_intent || "")}`, { expand: ["payment_method"] });
  if (si.metadata?.billing_request !== br.id) throw new Fail("forbidden", 403);
  if (!["succeeded", "processing"].includes(si.status)) throw new Fail("not_confirmed");
  const pm = si.payment_method, label = pm?.us_bank_account ? `${pm.us_bank_account.bank_name || "Bank"} ····${pm.us_bank_account.last4 || ""}` : "US bank account";
  await stripe("POST", `/customers/${si.customer}`, { invoice_settings: { default_payment_method: pm.id || pm } });
  if (cl.stripe_subscription_id) await stripe("POST", `/subscriptions/${cl.stripe_subscription_id}`, { default_payment_method: pm.id || pm });
  await admin.from("billing_requests").update({ status: "done", done_at: new Date().toISOString(), bank_label: label }).eq("id", br.id);
  await bell("ach_authorized", `Débito na conta da empresa autorizado: ${cl.name}`, `${label}. A mensalidade passa a ser debitada desta conta a partir da próxima cobrança.`, "#/clientes?id=" + cl.id);
  return { done: true, bank: label };
}

/* ---------------- actions ---------------- */
async function handle(req: Request, body: any) {
  const c = await caller(req);
  const a = String(body.action || "");

  // client checkout: the invoice must be visible to the caller under RLS (owner of the client with MFA, or admin)
  if (a === "invoice_checkout" || a === "invoice_refresh") {
    const { data: row } = await c.user.from("invoices").select("id, stripe_invoice_id, status").eq("id", String(body.invoice_id || "")).maybeSingle();
    if (!row?.stripe_invoice_id) throw new Fail("not_found", 404);
    if (a === "invoice_refresh") { const s = await syncInvoice(await stripe("GET", `/invoices/${row.stripe_invoice_id}`)); return { ok: true, status: (s as any)?.status }; }
    const inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`, { expand: ["payment_intent"] });
    await syncInvoice(inv);
    const base = { status: inv.status, hosted_invoice_url: inv.hosted_invoice_url || null, invoice_pdf: inv.invoice_pdf || null, amount_due: inv.amount_due, currency: inv.currency };
    const pi = inv.payment_intent;
    if (inv.status !== "open" || !pi?.client_secret || !PK) return base;
    return { ...base, client_secret: pi.client_secret, publishable_key: PK };
  }

  // (re)send the portal access e-mail: admin for anyone; a client owner for the people of their own client
  if (a === "send_access") {
    let email = "", page = "client.html", lang = "pt", opts: { kind?: AccessKind; name?: string; clientName?: string } = {};
    if (body.partner_id) {
      needAdmin(c);
      const { data: p } = await admin.from("partners").select("email, language, name").eq("id", String(body.partner_id)).single();
      if (!p) throw new Fail("not_found", 404);
      email = p.email; page = "partner.html"; lang = p.language; opts = { kind: "partner", name: p.name };
    } else {
      const { data: cu } = await admin.from("client_users").select("email, name, role, status, client_id, clients(name, language)").eq("client_id", String(body.client_id || "")).ilike("email", likeEsc(String(body.email || ""))).neq("status", "revoked").maybeSingle();
      if (!cu) throw new Fail("not_found", 404);
      if (!c.isAdmin) { const { data: role } = await c.user.rpc("my_client_role", { p_client: cu.client_id }); if (role !== "owner") throw new Fail("forbidden", 403); }
      email = cu.email; page = cu.role === "owner" ? "client.html" : "partner.html"; lang = String(body.lang || (cu as any).clients?.language || "pt");
      opts = { kind: cu.role === "owner" ? "client" : "collab", name: (cu as any).name || "", clientName: cu.role === "owner" ? "" : (cu as any).clients?.name || "" };
    }
    return { ok: true, sent: await sendAccess(email.toLowerCase(), page, lang, opts) };
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
      return await sendProposal(p);
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

  if (a === "invoice_preview") {
    needAdmin(c);
    let r: any = null;
    if (body.invoice_id) { const { data } = await admin.from("invoices").select("*").eq("id", String(body.invoice_id)).single(); r = data; }
    const clientId = r?.client_id || String(body.client_id || "");
    const { data: cl } = await admin.from("clients").select("name, language").eq("id", clientId).maybeSingle();
    const items = r?.items || (Array.isArray(body.items) ? body.items : []);
    const total = r ? r.total_cents - r.amount_paid_cents : items.reduce((s: number, i: any) => s + Math.round(Number(i.amount_cents) || 0) * (Number(i.quantity) || 1), 0);
    const due = r?.due_date || new Date(Date.now() + (Number(body.days_until_due ?? 7)) * 864e5).toISOString().slice(0, 10);
    const m = invoiceEmail({ lang: cl?.language || "pt", name: cl?.name || "", number: r?.number || "INV-XXXX", total, cur: r?.currency || "usd", due, items, description: r?.description || body.description, payUrl: SITE + "/client.html#/invoices", pdfUrl: r?.invoice_pdf, reminder: Number(body.reminder || 0), daysLate: 1 });
    return { subject: m.subject, html: m.html };
  }
  if (["invoice_schedule", "invoice_delete", "invoice_hide", "invoice_edit"].includes(a)) {
    needAdmin(c);
    const { data: r } = await admin.from("invoices").select("*").eq("id", String(body.invoice_id || "")).single();
    if (!r) throw new Fail("not_found", 404);
    if (a === "invoice_hide") { await admin.from("invoices").update({ archived_at: r.archived_at ? null : new Date().toISOString() }).eq("id", r.id); return { ok: true }; }
    if (r.status !== "draft" || r.kind === "proposal") throw new Fail("not_draft");
    if (a === "invoice_schedule") {
      const at = new Date(String(body.send_at || "")); if (isNaN(at.getTime())) throw new Fail("invalid_date");
      await admin.from("invoices").update({ scheduled_send_at: at.toISOString() }).eq("id", r.id); return { ok: true };
    }
    if (r.stripe_invoice_id) { try { await stripe("DELETE", `/invoices/${r.stripe_invoice_id}`); } catch (e) { console.error("delete draft", e); } }
    await admin.from("invoices").delete().eq("id", r.id);
    if (a === "invoice_delete") return { ok: true };
    const id = await createInvoice({ ...body, client_id: body.client_id || r.client_id, created_by: c.email });
    return { ok: true, id };
  }
  if (a === "intake_send") {
    needAdmin(c);
    const { data: cl } = await admin.from("clients").select("id, language").eq("id", String(body.client_id || "")).single();
    if (!cl) throw new Fail("not_found", 404);
    const q: any = await ensureIntake(cl.id, null, cl.language || "pt", true);
    return { ok: true, url: `${SITE}/intake.html?t=${q.token}&lang=${q.language}` };
  }
  if (a === "ach_request") {
    needAdmin(c);
    const { data: cl } = await admin.from("clients").select("*").eq("id", String(body.client_id || "")).single();
    if (!cl) throw new Fail("not_found", 404);
    await admin.from("billing_requests").update({ status: "closed" }).eq("client_id", cl.id).eq("status", "open");
    const { data: br } = await admin.from("billing_requests").insert({ client_id: cl.id, token: newToken(), language: cl.language || "pt", created_by: c.email }).select("*").single();
    const url = `${SITE}/autorizar.html?t=${br!.token}&lang=${br!.language}`;
    const m = achEmail({ lang: br!.language, name: cl.name, url, monthly: cl.monthly_cents || 0, cur: "usd" });
    await sendMail(cl.primary_email, m.subject, m.html, m.text);
    await sendWa(cl.phone, "endeavor_ach_request", br!.language, [firstName(cl.name), url]);
    await admin.from("billing_requests").update({ sent_at: new Date().toISOString() }).eq("id", br!.id);
    return { ok: true, url };
  }
  if (a === "invoice_create") {
    needAdmin(c);
    const id = await createInvoice({ ...body, created_by: c.email });
    return { ok: true, id };
  }

  if (["invoice_send", "invoice_void", "invoice_sync", "transfer"].includes(a)) {
    needAdmin(c);
    const { data: row } = await admin.from("invoices").select("*").eq("id", String(body.invoice_id || "")).single();
    if (row && a === "invoice_void" && (!row.stripe_invoice_id || row.stripe_subscription_id)) { await voidPending(row.id); return { ok: true }; }
    if (!row?.stripe_invoice_id) throw new Fail("not_found", 404);
    if (a === "invoice_send") { await finalizeAndSend(row); await admin.from("invoices").update({ scheduled_send_at: null }).eq("id", row.id); return { ok: true }; }
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
      if (ev.type === "invoice.payment_failed") {
        await admin.from("admin_events").insert({ kind: "payment_failed", title: `Pagamento recusado: fatura ${o.number || ""}`, body: o.customer_email || null, link: "#/pagamentos?tab=faturas" });
        const { data: r } = await admin.from("invoices").select("id, client_id, number, currency, clients(name, primary_email, phone, language)").eq("stripe_invoice_id", o.id).maybeSingle();
        const cl: any = r?.clients;
        if (cl && o.hosted_invoice_url) {
          const m = failedEmail({ lang: cl.language || "pt", name: cl.name, number: o.number || "", amount: o.amount_due, cur: o.currency, payUrl: o.hosted_invoice_url });
          await sendMail(cl.primary_email, m.subject, m.html, m.text).catch((e) => console.error("failed mail", e));
          await sendWa(cl.phone, "endeavor_payment_failed", cl.language || "pt", [firstName(cl.name), o.number || "", fmtMoney(o.amount_due, o.currency, cl.language), o.hosted_invoice_url]);
        }
      }
    }
    else if (ev.type === "checkout.session.completed" && o.metadata?.store === "1" && o.metadata?.order_id) {
      if (o.payment_status === "paid" || o.payment_status === "no_payment_required") await STORE().fulfill(o.metadata.order_id, o);
    }
    else if (ev.type === "checkout.session.async_payment_succeeded" && o.metadata?.store === "1" && o.metadata?.order_id) await STORE().fulfill(o.metadata.order_id, o);
    else if (ev.type?.startsWith("customer.subscription.") && o.id) {
      await admin.from("clients").update({ subscription_status: o.status }).eq("stripe_subscription_id", o.id);
      await STORE().subscriptionChanged(o);
    }
    else if (ev.type === "account.updated" && o.metadata?.partner_id) await syncPartner(o.metadata.partner_id, o);
    else if (ev.type === "transfer.reversed" && o.metadata?.invoice_id) await admin.from("invoices").update({ transfer_status: "reversed" }).eq("id", o.metadata.invoice_id);
  } catch (e) { console.error("webhook", ev.type, e); return json({ error: "processing_failed" }, 500); }
  return json({ received: true });
}

// online store (home page cards and portal upgrades)
let storeMod: ReturnType<typeof store> | null = null;
const STORE = () => (storeMod ??= store({ admin, SITE, PK, stripe, Fail: Fail as StoreDeps["Fail"], sendAccess, syncInvoice }));
async function storeAction(req: Request, body: any) {
  const a = String(body.action);
  if (a === "store_status") return await STORE().status(body);
  if (a === "store_checkout" && !body.client_id) return await STORE().checkout(req, body, null);
  // from the portal: the owner of the client account (with the authenticator)
  const c = await caller(req);
  const clientId = String(body.client_id || "");
  const { data: role } = await c.user.rpc("my_client_role", { p_client: clientId });
  if (role !== "owner") throw new Fail("forbidden", 403);
  if (a === "store_cancel") return await STORE().cancel(clientId, String(body.product || ""));
  if (a === "store_checkout") {
    const { data: cl } = await admin.from("clients").select("name, language, stripe_customer_id").eq("id", clientId).single();
    const { data: me } = await c.user.from("client_users").select("name, email").eq("client_id", clientId).eq("role", "owner").ilike("email", likeEsc(c.email)).maybeSingle();
    return await STORE().checkout(req, body, { clientId, email: c.email.toLowerCase(), name: me?.name || cl?.name || c.email, lang: String(body.lang || cl?.language || "pt"), customer: cl?.stripe_customer_id || null });
  }
  throw new Fail("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return json({ ok: true, configured: !!SK, webhook: WH.length > 0 });
  const sig = req.headers.get("stripe-signature");
  if (sig) return webhook(await req.text(), sig);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (typeof body.action === "string" && body.action.startsWith("store_")) {
    try { return json(await storeAction(req, body)); }
    catch (e) { if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
  }
  if (body.action === "access_reset") {
    try { return json(await accessReset(body)); }
    catch (e) { if (e instanceof Fail) return json({ error: e.code }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
  }
  if (body.action === "billing_tick") {
    const { data: ok } = await admin.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
    if (!ok) return json({ error: "forbidden" }, 403);
    try { return json(await billingTick()); } catch (e) { console.error(e); return json({ error: "server_error" }, 500); }
  }
  // AI Projects (internal, from the projects function): invoice for the approved project or a paid update, sent right away
  if (body.action === "project_invoice") {
    const { data: ok } = await admin.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
    if (!ok) return json({ error: "forbidden" }, 403);
    try {
      const id = await createInvoice({ client_id: body.client_id, items: body.items, description: body.description, days_until_due: body.days_until_due ?? 7, kind: "project", created_by: "ai-projects", send: "now" });
      await admin.from("invoices").update({ ai_project_id: body.ai_project_id || null, ai_release_id: body.ai_release_id || null }).eq("id", id);
      const { data: inv } = await admin.from("invoices").select("id, number, hosted_invoice_url, total_cents").eq("id", id).single();
      return json({ ok: true, invoice: inv });
    } catch (e) { if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
  }
  if (body.action === "ach_get" || body.action === "ach_complete") {
    try { return json(await achPublic(body)); }
    catch (e) { if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
  }
  if (body.action === "proposal_get" || body.action === "proposal_accept" || body.action === "proposal_reject") {
    try { return json(await publicAction(req, body)); }
    catch (e) { if (e instanceof Fail) return json({ error: e.code }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
  }
  try { return json(await handle(req, body)); }
  catch (e) {
    if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status);
    console.error(e); return json({ error: "server_error" }, 500);
  }
});
