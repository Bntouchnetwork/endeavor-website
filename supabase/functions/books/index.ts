// Endeavor Bookkeeping server: bank connections (Stripe Financial Connections or Plaid), transaction sync,
// AI category suggestions and report PDFs published to the client's documents.
// Secrets (Supabase > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY   (already used by payments) — Financial Connections
//   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV ("sandbox" | "production")       — optional, Plaid Link
//   ANTHROPIC_API_KEY                                                           — AI suggestions
// Called by the admin console (admin session with MFA) and by the daily cron job (internal key).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as PDFLib from "npm:pdf-lib@1.17.1";
import { REPORTS, quarterRange, reportPdf } from "./report.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SK = Deno.env.get("STRIPE_SECRET_KEY") || "";
const PK = (Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "").startsWith("pk_") ? Deno.env.get("STRIPE_PUBLISHABLE_KEY")! : "";
const PLAID_ID = Deno.env.get("PLAID_CLIENT_ID") || "", PLAID_SECRET = Deno.env.get("PLAID_SECRET") || "";
const PLAID_ENV = (Deno.env.get("PLAID_ENV") || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY") || "";
const AI_MODEL = Deno.env.get("BOOKS_MODEL") || "claude-haiku-5-5";
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400, public detail?: string) { super(code); } }
// deno-lint-ignore no-explicit-any
type Any = any;
const day = (d: Date) => d.toISOString().slice(0, 10);

/* ---------------- Stripe ---------------- */
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
async function stripe(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  if (!SK) throw new Fail("stripe_not_configured", 503);
  let url = "https://api.stripe.com/v1" + path, payload: string | undefined;
  if (body && method === "GET") url += "?" + form(body).toString(); else if (body) payload = form(body).toString();
  const r = await fetch(url, { method, headers: { Authorization: "Bearer " + SK, "Content-Type": "application/x-www-form-urlencoded" }, body: payload });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Fail("stripe_error", 502, j?.error?.message || String(r.status));
  return j;
}

/* ---------------- Plaid ---------------- */
async function plaid(path: string, body: Record<string, unknown>) {
  if (!PLAID_ID || !PLAID_SECRET) throw new Fail("plaid_not_configured", 503);
  const r = await fetch(`https://${PLAID_ENV}.plaid.com${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: PLAID_ID, secret: PLAID_SECRET, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Fail("plaid_error", 502, j?.error_message || j?.error_code || String(r.status));
  return j;
}

/* ---------------- helpers ---------------- */
async function company(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Fail("bad_request");
  const { data } = await db.from("companies").select("id, client_id, legal_name, books_provider, logo_path, is_house, ein, address, state, entity_type").eq("id", id).maybeSingle();
  if (!data) throw new Fail("not_found", 404);
  return data;
}
async function addAccount(companyId: string, connId: string, ext: string, name: string, mask: string | null, kind: string, cur: string, balance: number | null) {
  const { data, error } = await db.rpc("bk_add_bank_account", { p_company: companyId, p_connection: connId, p_external: ext, p_name: name, p_mask: mask, p_kind: kind, p_currency: cur, p_balance: balance });
  if (error) throw new Fail("db_error", 500, error.message);
  return data as string;
}
const kindOf = (s: string) => (/credit/.test(s) ? "credit_card" : /saving/.test(s) ? "savings" : /checking/.test(s) ? "checking" : "other");

/* ---------------- sync ---------------- */
async function syncStripe(conn: Any) {
  const { data: accts } = await db.from("bk_bank_accounts").select("id, external_id").eq("connection_id", conn.id).eq("is_active", true);
  let n = 0;
  for (const a of accts ?? []) {
    try { await stripe("POST", `/financial_connections/accounts/${a.external_id}/refresh`, { features: ["transactions", "balance"] }); } catch { /* refresh may be rate limited */ }
    const acc = await stripe("GET", `/financial_connections/accounts/${a.external_id}`);
    const bal = acc?.balance?.current?.usd;
    if (typeof bal === "number") await db.from("bk_bank_accounts").update({ balance_cents: acc.subcategory === "credit_card" ? -bal : bal, balance_at: new Date().toISOString() }).eq("id", a.id);
    const since = Math.floor((conn.last_sync_at ? new Date(conn.last_sync_at).getTime() - 10 * 864e5 : Date.now() - 365 * 864e5) / 1000);
    let after: string | undefined;
    for (let page = 0; page < 20; page++) {
      const list = await stripe("GET", "/financial_connections/transactions", { account: a.external_id, limit: 100, starting_after: after, transacted_at: { gte: since } });
      const rows = (list.data || []).filter((t: Any) => t.status !== "void").map((t: Any) => ({
        external_id: t.id, date: day(new Date(t.transacted_at * 1000)), description: String(t.description || "").slice(0, 300), amount_cents: t.amount, pending: t.status === "pending",
      }));
      if (rows.length) { const { data } = await db.rpc("bk_import_core", { p_bank: a.id, p_rows: rows }); n += Number(data || 0); }
      if (!list.has_more || !list.data?.length) break;
      after = list.data[list.data.length - 1].id;
    }
  }
  return n;
}
async function syncPlaid(conn: Any) {
  const { data: sec } = await db.from("bk_secrets").select("access_token, cursor").eq("connection_id", conn.id).single();
  if (!sec?.access_token) throw new Fail("plaid_token_missing");
  const { data: accts } = await db.from("bk_bank_accounts").select("id, external_id").eq("connection_id", conn.id);
  const map: Record<string, string> = {}; (accts ?? []).forEach((a: Any) => { map[a.external_id] = a.id; });
  const bal = await plaid("/accounts/get", { access_token: sec.access_token });
  for (const a of bal.accounts || []) {
    let id = map[a.account_id];
    const cents = a.balances?.current == null ? null : Math.round(a.balances.current * 100) * (a.type === "credit" ? -1 : 1);
    if (!id) { id = await addAccount(conn.company_id, conn.id, a.account_id, `${conn.institution || "Bank"} ${a.name}`, a.mask, a.type === "credit" ? "credit_card" : kindOf(String(a.subtype || "")), a.balances?.iso_currency_code || "usd", cents); map[a.account_id] = id; }
    else await db.from("bk_bank_accounts").update({ balance_cents: cents, balance_at: new Date().toISOString() }).eq("id", id);
  }
  let cursor = sec.cursor || undefined, n = 0;
  for (let i = 0; i < 30; i++) {
    const r = await plaid("/transactions/sync", { access_token: sec.access_token, cursor, count: 500 });
    const by: Record<string, Any[]> = {};
    for (const t of [...(r.added || []), ...(r.modified || [])]) {
      const bank = map[t.account_id]; if (!bank) continue;
      (by[bank] = by[bank] || []).push({ external_id: t.transaction_id, date: t.date, description: String(t.name || t.original_description || "").slice(0, 300), merchant: t.merchant_name || null,
        amount_cents: -Math.round(Number(t.amount) * 100), pending: !!t.pending });
    }
    for (const [bank, rows] of Object.entries(by)) { const { data } = await db.rpc("bk_import_core", { p_bank: bank, p_rows: rows }); n += Number(data || 0); }
    const removed = (r.removed || []).map((x: Any) => x.transaction_id);
    if (removed.length) await db.from("bk_transactions").delete().in("external_id", removed).eq("status", "review").eq("company_id", conn.company_id);
    cursor = r.next_cursor;
    await db.from("bk_secrets").update({ cursor }).eq("connection_id", conn.id);
    if (!r.has_more) break;
  }
  return n;
}
async function syncConnection(conn: Any) {
  try {
    const n = conn.provider === "stripe" ? await syncStripe(conn) : conn.provider === "plaid" ? await syncPlaid(conn) : 0;
    await db.from("bk_connections").update({ last_sync_at: new Date().toISOString(), last_error: null, status: "active" }).eq("id", conn.id);
    return n;
  } catch (e) {
    const m = e instanceof Fail ? (e.detail || e.code) : String((e as Error).message);
    await db.from("bk_connections").update({ last_error: m.slice(0, 300), status: "error" }).eq("id", conn.id);
    throw e;
  }
}

/* ---------------- AI suggestions ---------------- */
async function aiSuggest(companyId: string, limit = 80) {
  if (!ANTHROPIC) return { suggested: 0, ai: false };
  const { data: txns } = await db.from("bk_transactions").select("id, txn_date, description, merchant, amount_cents")
    .eq("company_id", companyId).eq("status", "review").or("suggest_source.is.null,suggest_source.eq.ai").order("txn_date", { ascending: false }).limit(limit);
  if (!txns?.length) return { suggested: 0, ai: true };
  const { data: accts } = await db.from("bk_accounts").select("id, code, name, type, subtype").eq("company_id", companyId).eq("is_active", true).in("type", ["income", "expense", "asset", "liability", "equity"]);
  const usable = (accts ?? []).filter((a: Any) => !["bank", "credit_card", "retained_earnings"].includes(a.subtype));
  const { data: hist } = await db.from("bk_transactions").select("description, merchant, amount_cents, account_id").eq("company_id", companyId).eq("status", "posted").order("txn_date", { ascending: false }).limit(60);
  const codeOf: Record<string, string> = {}; usable.forEach((a: Any) => { codeOf[a.id] = a.code; });
  const co = await company(companyId);
  const prompt = `You are a US small-business bookkeeper working in Endeavor Bookkeeping (QuickBooks-style double entry) for "${co.legal_name}", a US LLC.
Suggest the best account for each bank transaction. Money in (amount > 0) usually goes to income, owner contributions (equity) or loans; money out (amount < 0) usually goes to expenses, cost of goods sold, owner distributions (equity), fixed assets or loan payments.
Use only the account codes listed. If unsure, use 6999 (Uncategorized Expense) for money out or 4999 (Uncategorized Income) for money in, with low confidence. Transfers between the company's own accounts or credit card payments: pick the matching balance-sheet account if listed, otherwise uncategorized with low confidence.
Reply by calling the tool save_suggestions once with every transaction.

Accounts:
${usable.map((a: Any) => `${a.code} | ${a.name} | ${a.subtype}`).join("\n")}

How this company categorized similar items before:
${(hist ?? []).filter((h: Any) => codeOf[h.account_id]).slice(0, 40).map((h: Any) => `${(h.merchant || h.description).slice(0, 60)} | ${(h.amount_cents / 100).toFixed(2)} -> ${codeOf[h.account_id]}`).join("\n") || "(none yet)"}

Transactions:
${txns.map((t: Any) => `${t.id} | ${t.txn_date} | ${(t.merchant ? t.merchant + " - " : "") + t.description.slice(0, 120)} | ${(t.amount_cents / 100).toFixed(2)}`).join("\n")}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 8000, tool_choice: { type: "auto" }, messages: [{ role: "user", content: prompt }],
      tools: [{ name: "save_suggestions", description: "Save one account suggestion per transaction.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object",
        properties: { id: { type: "string" }, account_code: { type: "string" }, confidence: { type: "number", description: "0 to 1" }, reason: { type: "string", description: "short, in English" } },
        required: ["id", "account_code", "confidence"] } } }, required: ["items"] } }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Fail("ai_error", 502, j?.error?.message || String(r.status));
  const use = (j.content || []).find((c: Any) => c.type === "tool_use");
  const byCode: Record<string, string> = {}; usable.forEach((a: Any) => { byCode[a.code] = a.id; });
  const rows = (use?.input?.items || []).filter((x: Any) => byCode[x.account_code]).map((x: Any) => ({ id: x.id, account_id: byCode[x.account_code], confidence: x.confidence, reason: String(x.reason || "").slice(0, 200) }));
  const { data } = await db.rpc("bk_save_ai", { p_rows: rows });
  return { suggested: Number(data || 0), ai: true };
}

/* ---------------- reports -> PDF ---------------- */
const m2 = (c: number) => (Number(c || 0) / 100).toFixed(2);
function toQbo(rep: Any) {
  const sec = (s: Any, label?: string) => ({ type: "Section", Header: { ColData: [{ value: label || s.title }, { value: "" }] },
    Rows: { Row: (s.rows || []).map((r: Any) => ({ type: "Data", ColData: [{ value: `${r.code} ${r.name}` }, { value: m2(r.amount) }] })) },
    Summary: { ColData: [{ value: `Total ${label || s.title}` }, { value: m2(s.total) }] } });
  const line = (label: string, v: number) => ({ type: "Section", Summary: { ColData: [{ value: label }, { value: m2(v) }] } });
  const S = (k: string) => (rep.sections || []).find((x: Any) => x.key === k) || { rows: [], total: 0, title: k };
  let rows: Any[] = [];
  if (rep.kind === "pl") {
    rows = [sec(S("income")), sec(S("cogs")), line("Gross Profit", rep.gross_profit), sec(S("expense")), line("Net Operating Income", rep.operating_income), sec(S("other_income")), sec(S("other_expense")), line("Net Income", rep.net_income)];
  } else if (rep.kind === "bs") {
    const grp = (g: string) => (rep.sections || []).filter((x: Any) => x.group === g && (x.rows.length || x.total));
    const eq = S("equity");
    rows = [{ type: "Section", Header: { ColData: [{ value: "ASSETS" }, { value: "" }] }, Rows: { Row: grp("assets").map((s: Any) => sec(s)) }, Summary: { ColData: [{ value: "TOTAL ASSETS" }, { value: m2(rep.total_assets) }] } },
      { type: "Section", Header: { ColData: [{ value: "LIABILITIES AND EQUITY" }, { value: "" }] }, Rows: { Row: [
        { type: "Section", Header: { ColData: [{ value: "Liabilities" }, { value: "" }] }, Rows: { Row: grp("liabilities").map((s: Any) => sec(s)) }, Summary: { ColData: [{ value: "Total Liabilities" }, { value: m2(rep.total_liabilities) }] } },
        { type: "Section", Header: { ColData: [{ value: "Equity" }, { value: "" }] }, Rows: { Row: [...(eq.rows || []).map((r: Any) => ({ type: "Data", ColData: [{ value: `${r.code} ${r.name}` }, { value: m2(r.amount) }] })),
          { type: "Data", ColData: [{ value: "Retained Earnings" }, { value: m2(rep.retained_earnings) }] }, { type: "Data", ColData: [{ value: "Net Income" }, { value: m2(rep.net_income) }] }] },
          Summary: { ColData: [{ value: "Total Equity" }, { value: m2(rep.total_equity) }] } }] },
        Summary: { ColData: [{ value: "TOTAL LIABILITIES AND EQUITY" }, { value: m2(Number(rep.total_liabilities) + Number(rep.total_equity)) }] } }];
  } else if (rep.kind === "cf") {
    const op = S("operating");
    rows = [{ type: "Section", Header: { ColData: [{ value: "OPERATING ACTIVITIES" }, { value: "" }] }, Rows: { Row: [{ type: "Data", ColData: [{ value: "Net Income" }, { value: m2(rep.net_income) }] }, sec(op)] },
      Summary: { ColData: [{ value: "Net cash provided by operating activities" }, { value: m2(rep.operating_total) }] } },
      sec(S("investing"), "Investing Activities"), sec(S("financing"), "Financing Activities"),
      line("Net cash increase for period", rep.net_change), line("Cash at beginning of period", rep.cash_start), line("Cash at end of period", rep.cash_end)];
  }
  return { Header: { ReportBasis: "Accrual", Currency: "USD" }, Columns: { Column: [{ ColTitle: "" }, { ColTitle: "Total" }] }, Rows: { Row: rows } };
}
// Report header: the company's own logo (admin uploads it in the company form), or Endeavor's logo for Endeavor's own company
const SITE = (Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
async function branding(co: Any) {
  let logo: Uint8Array | null = null;
  try {
    if (co.logo_path) { const { data } = await db.storage.from("client-docs").download(co.logo_path); if (data) logo = new Uint8Array(await data.arrayBuffer()); }
    else if (co.is_house) { const r = await fetch(`${SITE}/logo-endeavor-report.png`); if (r.ok) logo = new Uint8Array(await r.arrayBuffer()); }
  } catch { logo = null; }
  const ein = co.ein ? `EIN ${String(co.ein).replace(/^(\d{2})(\d{7})$/, "$1-$2")}` : "";
  const companyLines = [co.address || "", [co.state ? `${co.state} ${co.entity_type && /llc/.test(co.entity_type) ? "LLC" : ""}`.trim() : "", ein].filter(Boolean).join("  |  ")];
  return { logo, companyLines };
}
async function publish(co: Any, year: number, quarter: number) {
  const { start, end, label } = quarterRange(year, quarter);
  if (new Date(start) > new Date()) throw new Fail("future_period");
  const generatedAt = day(new Date()), out = [];
  const { logo, companyLines } = await branding(co);
  for (const [type, kind] of [["ProfitAndLoss", "pl"], ["BalanceSheet", "bs"], ["CashFlow", "cf"]]) {
    const { data: rep, error } = await db.rpc("bk_report", { p_company: co.id, p_kind: kind, p_from: kind === "bs" ? null : start, p_to: end });
    if (error) throw new Fail("db_error", 500, error.message);
    const report = toQbo(rep);
    const bytes = await reportPdf(PDFLib, { report, type, companyName: co.legal_name, periodLabel: label, start, end, generatedAt, source: "Endeavor Bookkeeping", logo, companyLines });
    const path = `${co.client_id}/${co.id}/reports/${start}_${end}_${type}.pdf`;
    const up = await db.storage.from("client-docs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Fail("storage_error", 500, up.error.message);
    const title = `${REPORTS[type as keyof typeof REPORTS]} - ${label}`;
    const { data: doc, error: de } = await db.from("company_documents").upsert({ company_id: co.id, client_id: co.client_id, category: "report", title, year: Number(start.slice(0, 4)), path, mime: "application/pdf",
      size_bytes: bytes.length, visible_to_client: true, uploaded_by: null, uploaded_by_email: "Endeavor Bookkeeping", note: "Prepared by Endeavor from the company's books" }, { onConflict: "path" }).select("id").single();
    if (de) throw new Fail("db_error", 500, de.message);
    await db.from("financial_reports").upsert({ company_id: co.id, client_id: co.client_id, period_label: label, start_date: start, end_date: end, report_type: type, document_id: doc.id, data: rep },
      { onConflict: "company_id,report_type,start_date,end_date" });
    out.push({ type, title, document_id: doc.id });
  }
  return { ok: true, period: label, reports: out };
}

/* ---------------- handler ---------------- */
async function handle(req: Request, body: Any) {
  const a = String(body.action || "");
  if (a === "tick") {
    const { data: ok } = await db.rpc("booking_hook_key_ok", { p_key: req.headers.get("x-booking-key") ?? "" });
    if (!ok) throw new Fail("forbidden", 403);
    const { data: conns } = await db.from("bk_connections").select("*").in("status", ["active", "error"]).in("provider", ["stripe", "plaid"]);
    const res: Any[] = [];
    for (const c of conns ?? []) { try { res.push({ id: c.id, n: await syncConnection(c) }); } catch (e) { res.push({ id: c.id, error: (e as Error).message }); } }
    const cos = [...new Set((conns ?? []).map((c: Any) => c.company_id))];
    for (const id of cos) { try { await aiSuggest(id as string); } catch { /* next time */ } }
    return { ok: true, synced: res };
  }
  // admin session (with the authenticator)
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Fail("unauthorized", 401);
  const { data: isAdmin } = await user.rpc("is_admin");
  if (!isAdmin) throw new Fail("forbidden", 403);
  const who = u.user.email || "admin";

  if (a === "config") return { stripe: !!(SK && PK), pk: PK || null, plaid: !!(PLAID_ID && PLAID_SECRET), plaid_env: PLAID_ENV, ai: !!ANTHROPIC };
  const co = await company(String(body.company_id || ""));
  if (co.books_provider !== "endeavor" && a !== "publish") throw new Fail("books_not_enabled");

  if (a === "stripe_session") {
    let { data: conn } = await db.from("bk_connections").select("*").eq("company_id", co.id).eq("provider", "stripe").neq("status", "disconnected").maybeSingle();
    if (!conn) {
      const cus = await stripe("POST", "/customers", { name: `${co.legal_name} (books)`, description: "Endeavor Bookkeeping bank connection", metadata: { company_id: co.id, purpose: "books" } });
      const ins = await db.from("bk_connections").insert({ company_id: co.id, provider: "stripe", institution: "Stripe Financial Connections", external_id: cus.id, created_by: who }).select("*").single();
      if (ins.error) throw new Fail("db_error", 500, ins.error.message);
      conn = ins.data;
    }
    // separate buttons for bank accounts and credit cards: the session only offers the chosen kind
    const filters: Any = { countries: ["US"] };
    if (body.kind === "card") filters.account_subcategories = ["credit_card"];
    else if (body.kind === "bank") filters.account_subcategories = ["checking", "savings"];
    const s = await stripe("POST", "/financial_connections/sessions", { account_holder: { type: "customer", customer: conn.external_id }, permissions: ["transactions", "balances"], filters });
    return { client_secret: s.client_secret, session_id: s.id, pk: PK, connection_id: conn.id };
  }
  if (a === "stripe_complete") {
    const { data: conn } = await db.from("bk_connections").select("*").eq("id", String(body.connection_id || "")).eq("company_id", co.id).single();
    if (!conn) throw new Fail("not_found", 404);
    const s = await stripe("GET", `/financial_connections/sessions/${String(body.session_id || "")}`);
    let added = 0;
    for (const acc of s.accounts?.data || []) {
      const kind = acc.category === "credit" ? "credit_card" : kindOf(String(acc.subcategory || ""));
      const bal = acc?.balance?.current?.usd;
      await addAccount(co.id, conn.id, acc.id, `${acc.institution_name || "Bank"} ${acc.display_name || ""}`.trim(), acc.last4 || null, kind, "usd", typeof bal === "number" ? (kind === "credit_card" ? -bal : bal) : null);
      try { await stripe("POST", `/financial_connections/accounts/${acc.id}/subscribe`, { features: ["transactions"] }); } catch { /* already subscribed */ }
      added++;
    }
    let synced = 0; try { synced = await syncConnection(conn); } catch { /* transactions may take a few minutes to arrive */ }
    return { ok: true, accounts: added, imported: synced };
  }
  if (a === "plaid_link") {
    const r = await plaid("/link/token/create", { client_name: "Endeavor Business Solutions", user: { client_user_id: co.id }, products: ["transactions"], country_codes: ["US"], language: body.lang === "es" ? "es" : "en",
      transactions: { days_requested: 730 },
      account_filters: body.kind === "card" ? { credit: { account_subtypes: ["credit card"] } } : body.kind === "bank" ? { depository: { account_subtypes: ["checking", "savings"] } } : undefined });
    return { link_token: r.link_token };
  }
  if (a === "plaid_exchange") {
    const r = await plaid("/item/public_token/exchange", { public_token: String(body.public_token || "") });
    const ins = await db.from("bk_connections").insert({ company_id: co.id, provider: "plaid", institution: String(body.institution || "Bank").slice(0, 120), external_id: r.item_id, created_by: who }).select("*").single();
    if (ins.error) throw new Fail("db_error", 500, ins.error.message);
    await db.from("bk_secrets").insert({ connection_id: ins.data.id, access_token: r.access_token });
    let synced = 0; try { synced = await syncConnection(ins.data); } catch { /* first pull can take a moment */ }
    return { ok: true, imported: synced };
  }
  if (a === "sync") {
    const q = db.from("bk_connections").select("*").eq("company_id", co.id).in("provider", ["stripe", "plaid"]).neq("status", "disconnected");
    const { data: conns } = body.connection_id ? await q.eq("id", String(body.connection_id)) : await q;
    let n = 0; const errors: string[] = [];
    for (const c of conns ?? []) { try { n += await syncConnection(c); } catch (e) { errors.push(`${c.institution}: ${e instanceof Fail ? (e.detail || e.code) : (e as Error).message}`); } }
    let ai: Any = null; try { ai = await aiSuggest(co.id); } catch { /* optional */ }
    return { ok: true, imported: n, errors, ai };
  }
  if (a === "ai") return await aiSuggest(co.id, 120);
  if (a === "disconnect") {
    const { data: conn } = await db.from("bk_connections").select("*").eq("id", String(body.connection_id || "")).eq("company_id", co.id).single();
    if (!conn) throw new Fail("not_found", 404);
    if (conn.provider === "plaid") { const { data: sec } = await db.from("bk_secrets").select("access_token").eq("connection_id", conn.id).maybeSingle(); if (sec?.access_token) { try { await plaid("/item/remove", { access_token: sec.access_token }); } catch { /* already removed */ } } }
    if (conn.provider === "stripe") { const { data: accts } = await db.from("bk_bank_accounts").select("external_id").eq("connection_id", conn.id); for (const x of accts ?? []) { try { await stripe("POST", `/financial_connections/accounts/${x.external_id}/disconnect`); } catch { /* ignore */ } } }
    await db.from("bk_secrets").delete().eq("connection_id", conn.id);
    await db.from("bk_connections").update({ status: "disconnected" }).eq("id", conn.id);
    await db.from("bk_bank_accounts").update({ is_active: false }).eq("connection_id", conn.id);
    return { ok: true };
  }
  if (a === "publish") {
    if (co.books_provider !== "endeavor") throw new Fail("books_not_enabled");
    return await publish(co, Number(body.year), Number(body.quarter));
  }
  throw new Fail("unknown_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try { return json(await handle(req, body)); }
  catch (e) {
    if (e instanceof Fail) return json({ error: e.code, detail: e.detail }, e.status);
    const m = String((e as Error).message || e);
    if (m === "invalid_period") return json({ error: "invalid_period" }, 400);
    console.error(e); return json({ error: "server_error" }, 500);
  }
});
