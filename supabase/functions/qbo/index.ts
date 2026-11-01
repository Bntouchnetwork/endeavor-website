// QuickBooks Online integration: OAuth connect per company, quarterly financial reports as PDFs.
// Secrets (Supabase > Edge Functions > Secrets): QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_ENV ("sandbox" | "production"),
// optional QBO_RETURN_ORIGINS (comma-separated allowed site origins).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as PDFLib from "npm:pdf-lib@1.17.1";
import { REPORTS, quarterRange, reportPdf } from "./report.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const CID = Deno.env.get("QBO_CLIENT_ID") || "";
const CSECRET = Deno.env.get("QBO_CLIENT_SECRET") || "";
const ENV = (Deno.env.get("QBO_ENV") || "sandbox").toLowerCase();
const API = ENV === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
const REDIRECT = SUPABASE_URL + "/functions/v1/qbo";
const ORIGINS = (Deno.env.get("QBO_RETURN_ORIGINS") || "https://bntouchnetwork.github.io,https://endeavorbiz.com,https://www.endeavorbiz.com").split(",").map((s) => s.trim()).filter(Boolean);
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode("qbo-state:" + SERVICE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function makeState(o: Record<string, unknown>) { const p = b64u(enc.encode(JSON.stringify(o))); return p + "." + await hmac(p); }
async function readState(s: string) {
  const [p, sig] = String(s || "").split(".");
  if (!p || !sig || sig !== await hmac(p)) throw new Error("bad_state");
  const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
  if (o.e < Date.now()) throw new Error("state_expired");
  return o;
}
function safeReturn(url: string) {
  try { const u = new URL(url); if (u.protocol === "https:" && ORIGINS.some((o) => u.origin === o)) return u.toString(); } catch { /* ignore */ }
  return null;
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(CID + ":" + CSECRET), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("token_error:" + (j.error || r.status));
  return j;
}

async function accessToken(companyId: string) {
  const { data: c } = await admin.from("qbo_connections").select("*").eq("company_id", companyId).maybeSingle();
  if (!c) throw new Error("qbo_not_connected");
  if (new Date(c.access_expires_at).getTime() - Date.now() > 90_000) return c;
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: c.refresh_token });
    const upd = { access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token,
      access_expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
      refresh_expires_at: t.x_refresh_token_expires_in ? new Date(Date.now() + t.x_refresh_token_expires_in * 1000).toISOString() : c.refresh_expires_at, last_error: null };
    await admin.from("qbo_connections").update(upd).eq("company_id", companyId);
    return { ...c, ...upd };
  } catch (e) {
    await admin.from("qbo_connections").update({ last_error: "Reconnect required" }).eq("company_id", companyId);
    throw new Error("qbo_reconnect_required");
  }
}

async function qboGet(conn: any, path: string) {
  const r = await fetch(`${API}/v3/company/${conn.realm_id}/${path}${path.includes("?") ? "&" : "?"}minorversion=75`, {
    headers: { Authorization: "Bearer " + conn.access_token, Accept: "application/json" },
  });
  if (r.status === 401) throw new Error("qbo_reconnect_required");
  if (!r.ok) throw new Error("qbo_api_error:" + r.status);
  return await r.json();
}

// Who is calling, and may they act on this company?
async function authorize(req: Request, companyId: string, needOwner: boolean) {
  const auth = req.headers.get("Authorization") || "";
  const user = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) throw new Error("unauthorized");
  const { data: co } = await user.from("companies").select("id, client_id, legal_name").eq("id", companyId).maybeSingle();
  if (!co) throw new Error("forbidden");
  const { data: isAdmin } = await user.rpc("is_admin");
  if (isAdmin) return { co, email: u.user.email, isAdmin: true };
  const { data: role } = await user.rpc("my_client_role", { p_client: co.client_id });
  if (!role) throw new Error("forbidden");
  if (needOwner && role !== "owner") throw new Error("forbidden");
  if (!needOwner && role !== "owner") {
    const { data: canView } = await user.rpc("my_client_can", { p_client: co.client_id, p_what: "view" });
    if (!canView) throw new Error("forbidden");
  }
  return { co, email: u.user.email, isAdmin: false };
}

function page(title: string, msg: string, back: string | null) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:system-ui,sans-serif;background:#f4f6fa;color:#0b1f3a;display:grid;place-items:center;min-height:100vh;margin:0">
<main style="background:#fff;padding:2rem;border-radius:12px;max-width:28rem;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)">
<h1 style="font-size:1.3rem">${title}</h1><p>${msg}</p>${back ? `<p><a href="${back}" style="color:#0b1f3a;font-weight:600">Return to the portal</a></p><script>setTimeout(function(){location.replace(${JSON.stringify(back)})},1500)</script>` : ""}</main></body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);

  // OAuth redirect from Intuit
  if (req.method === "GET") {
    if (!url.searchParams.get("state")) return json({ ok: true, configured: !!(CID && CSECRET) });
    let st: any;
    try { st = await readState(url.searchParams.get("state")!); } catch { return page("Link expired", "Please start the QuickBooks connection again from the portal.", null); }
    const back = (ok: boolean, code: string) => { const u = new URL(st.r); u.hash = "#/reports?company=" + st.c + "&qbo=" + code; return u.toString(); };
    if (url.searchParams.get("error")) return page("Connection cancelled", "QuickBooks was not connected.", back(false, "cancelled"));
    const code = url.searchParams.get("code"), realm = url.searchParams.get("realmId");
    if (!code || !realm) return page("Connection failed", "QuickBooks did not return the authorization.", back(false, "error"));
    try {
      const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: REDIRECT });
      const conn: any = { company_id: st.c, realm_id: realm, access_token: t.access_token, refresh_token: t.refresh_token,
        access_expires_at: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
        refresh_expires_at: t.x_refresh_token_expires_in ? new Date(Date.now() + t.x_refresh_token_expires_in * 1000).toISOString() : null,
        connected_at: new Date().toISOString(), connected_by: st.u, last_error: null };
      try { const info = await qboGet(conn, `companyinfo/${realm}`); conn.qbo_company_name = info?.CompanyInfo?.CompanyName || null; } catch { /* optional */ }
      const { error } = await admin.from("qbo_connections").upsert(conn);
      if (error) throw error;
      return page("QuickBooks connected", "Your QuickBooks company is now linked to Endeavor.", back(true, "connected"));
    } catch (e) {
      console.error(e);
      return page("Connection failed", "We could not finish the connection. Please try again.", back(false, "error"));
    }
  }

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const action = body.action, companyId = String(body.company_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: "bad_request" }, 400);
  if (!CID || !CSECRET) return json({ error: "qbo_not_configured" }, 503);

  try {
    if (action === "connect") {
      const { co, email } = await authorize(req, companyId, true);
      const ret = safeReturn(String(body.return_to || ""));
      if (!ret) return json({ error: "bad_return_url" }, 400);
      const state = await makeState({ c: co.id, u: email, r: ret, e: Date.now() + 15 * 60_000, n: crypto.randomUUID() });
      const auth = new URL("https://appcenter.intuit.com/connect/oauth2");
      auth.search = new URLSearchParams({ client_id: CID, response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: REDIRECT, state }).toString();
      return json({ url: auth.toString() });
    }

    if (action === "disconnect") {
      await authorize(req, companyId, true);
      const { data: c } = await admin.from("qbo_connections").select("refresh_token").eq("company_id", companyId).maybeSingle();
      if (c) {
        await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", { method: "POST",
          headers: { Authorization: "Basic " + btoa(CID + ":" + CSECRET), "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ token: c.refresh_token }) }).catch(() => {});
        await admin.from("qbo_connections").delete().eq("company_id", companyId);
      }
      return json({ ok: true });
    }

    if (action === "generate") {
      const { co } = await authorize(req, companyId, false);
      const { start, end, label } = quarterRange(body.year, body.quarter);
      if (new Date(start) > new Date()) return json({ error: "future_period" }, 400);
      const types: string[] = (Array.isArray(body.types) && body.types.length ? body.types : Object.keys(REPORTS)).filter((t: string) => REPORTS[t as keyof typeof REPORTS]);
      const conn = await accessToken(companyId);
      const generatedAt = new Date().toISOString().slice(0, 10);
      const out = [];
      for (const type of types) {
        const rep = await qboGet(conn, `reports/${type}?start_date=${start}&end_date=${end}&accounting_method=Accrual`);
        const bytes = await reportPdf(PDFLib, { report: rep, type, companyName: co.legal_name, periodLabel: label, start, end, generatedAt });
        const path = `${co.client_id}/${co.id}/reports/${start}_${end}_${type}.pdf`;
        const up = await admin.storage.from("client-docs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
        if (up.error) throw up.error;
        const title = `${REPORTS[type as keyof typeof REPORTS]} - ${label}`;
        const { data: doc, error: de } = await admin.from("company_documents").upsert({
          company_id: co.id, client_id: co.client_id, category: "report", title, year: Number(start.slice(0, 4)), path, mime: "application/pdf",
          size_bytes: bytes.length, visible_to_client: true, uploaded_by: null, uploaded_by_email: "QuickBooks", note: "Generated from QuickBooks Online",
        }, { onConflict: "path" }).select("id").single();
        if (de) throw de;
        await admin.from("financial_reports").upsert({ company_id: co.id, client_id: co.client_id, period_label: label, start_date: start, end_date: end, report_type: type, document_id: doc.id, data: rep },
          { onConflict: "company_id,report_type,start_date,end_date" });
        out.push({ type, title, document_id: doc.id });
      }
      await admin.from("qbo_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("company_id", companyId);
      return json({ ok: true, period: label, reports: out });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    const m = String((e as Error).message || e);
    const code = ["unauthorized", "forbidden", "qbo_not_connected", "qbo_reconnect_required", "invalid_period"].find((k) => m.startsWith(k)) || "server_error";
    if (code === "server_error") console.error(e);
    return json({ error: code }, code === "unauthorized" ? 401 : code === "forbidden" ? 403 : code === "server_error" ? 500 : 400);
  }
});
