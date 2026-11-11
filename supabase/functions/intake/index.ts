// Opening documents (secure link from the e-mail, no login): three company name options, members and percentages,
// and per member the passport, proof of address and US visa (optional). Files go to the client's private folder
// (company_documents, category "onboarding") and show up in the portal and in the admin.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Fail extends Error { constructor(public code: string, public status = 400) { super(code); } }
// deno-lint-ignore no-explicit-any
type Any = any;
const KINDS = ["passport", "address", "visa"] as const;
const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const LABEL: Record<string, Record<string, string>> = {
  pt: { passport: "Passaporte", address: "Comprovante de endereço", visa: "Visto americano" },
  en: { passport: "Passport", address: "Proof of address", visa: "US visa" },
  es: { passport: "Pasaporte", address: "Comprobante de domicilio", visa: "Visa estadounidense" },
};

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) throw new Fail("not_found", 404);
  const { data: q } = await db.from("intake_requests").select("*, clients(name, primary_email)").eq("token", token).maybeSingle();
  if (!q || q.status === "closed" || new Date(q.expires_at) < new Date()) throw new Fail("not_found", 404);
  if (!q.company_id) {
    const { data: co } = await db.from("companies").insert({ client_id: q.client_id, legal_name: "Nova empresa (em formação)", status: "in_formation", entity_type: "llc_foreign", state: "FL" }).select("id").single();
    await db.from("intake_requests").update({ company_id: co!.id }).eq("id", q.id); q.company_id = co!.id;
  }
  return q;
}
async function files(q: Any) {
  const { data } = await db.from("company_documents").select("id, title, note, mime, size_bytes, created_at").eq("company_id", q.company_id).eq("category", "onboarding").like("note", "intake:%");
  return (data ?? []).map((d: Any) => { const [, member, kind] = String(d.note).split(":"); return { id: d.id, member, kind, name: d.title, mime: d.mime, size: d.size_bytes, at: d.created_at }; });
}
function progress(q: Any, fl: Any[]) {
  const a = q.answers || {}, names = (a.names || []).filter((x: string) => String(x || "").trim().length >= 2);
  const members = (a.members || []).filter((m: Any) => String(m.name || "").trim().length >= 3);
  const pct = members.reduce((s: number, m: Any) => s + (Number(m.pct) || 0), 0);
  const docsOk = members.length > 0 && members.every((m: Any) => ["passport", "address"].every((k) => fl.some((f) => f.member === m.id && f.kind === k)));
  return { names: names.length >= 3, members: members.length > 0 && Math.abs(pct - 100) < 0.01, docs: docsOk, complete: names.length >= 3 && members.length > 0 && Math.abs(pct - 100) < 0.01 && docsOk };
}
async function maybeComplete(q: Any) {
  const fl = await files(q), pr = progress(q, fl);
  if (pr.complete && q.status !== "complete") {
    await db.from("intake_requests").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", q.id);
    const a = q.answers || {};
    await db.from("admin_events").insert({ kind: "intake_complete", title: `Documentos de abertura completos: ${q.clients?.name || ""}`.slice(0, 300),
      body: `Nomes: ${(a.names || []).join(" / ")}. Sócios: ${(a.members || []).map((m: Any) => `${m.name} (${m.pct}%)`).join(", ")}.`.slice(0, 2000), link: "#/clientes?id=" + q.client_id + "&tab=abertura" });
  }
  return { progress: pr, files: fl };
}

async function handle(body: Any) {
  const q = await load(String(body.token || ""));
  const a = String(body.action || "get");
  if (a === "get") {
    const r = await maybeComplete(q);
    return { client_name: q.clients?.name || "", language: q.language, status: q.status, answers: q.answers || {}, ...r, labels: LABEL[q.language] || LABEL.pt };
  }
  if (a === "save") {
    const names = (Array.isArray(body.names) ? body.names : []).slice(0, 3).map((x: unknown) => String(x || "").trim().slice(0, 120));
    const members = (Array.isArray(body.members) ? body.members : []).slice(0, 10).map((m: Any) => ({
      id: /^[a-z0-9]{6,16}$/.test(String(m.id || "")) ? String(m.id) : crypto.randomUUID().replace(/-/g, "").slice(0, 10),
      name: String(m.name || "").trim().slice(0, 160), pct: Math.max(0, Math.min(100, Math.round((Number(m.pct) || 0) * 100) / 100)) }));
    const answers = { ...(q.answers || {}), names, members };
    await db.from("intake_requests").update({ answers, updated_at: new Date().toISOString() }).eq("id", q.id);
    // the company record carries the first name option while it is still a placeholder
    const { data: co } = await db.from("companies").select("legal_name").eq("id", q.company_id).single();
    if (names[0] && co && /^Nova empresa/.test(co.legal_name)) await db.from("companies").update({ legal_name: (/\bLLC$/i.test(names[0]) ? names[0] : names[0] + " LLC").slice(0, 200) }).eq("id", q.company_id);
    // files of removed members go away
    const keep = new Set(members.map((m: Any) => m.id));
    for (const f of await files(q)) if (!keep.has(f.member)) await removeDoc(q, f.id);
    q.answers = answers;
    return { ok: true, answers, ...(await maybeComplete(q)) };
  }
  if (a === "upload_url") {
    const member = String(body.member || ""), kind = String(body.kind || ""), mime = String(body.mime || "").toLowerCase(), size = Number(body.size) || 0;
    if (!(q.answers?.members || []).some((m: Any) => m.id === member)) throw new Fail("member_not_found");
    if (!(KINDS as readonly string[]).includes(kind)) throw new Fail("invalid_kind");
    if (!TYPES[mime]) throw new Fail("invalid_type");
    if (size <= 0 || size > 15 * 1024 * 1024) throw new Fail("too_big");
    const path = `${q.client_id}/${q.company_id}/onboarding/${member}-${kind}-${crypto.randomUUID().slice(0, 8)}.${TYPES[mime]}`;
    const { data, error } = await db.storage.from("client-docs").createSignedUploadUrl(path);
    if (error) throw new Fail("storage_error", 500);
    return { url: data.signedUrl, path };
  }
  if (a === "confirm") {
    const path = String(body.path || ""), member = String(body.member || ""), kind = String(body.kind || "");
    if (!path.startsWith(`${q.client_id}/${q.company_id}/onboarding/${member}-${kind}-`)) throw new Fail("forbidden", 403);
    const { data: info } = await db.storage.from("client-docs").list(path.split("/").slice(0, -1).join("/"), { search: path.split("/").pop() });
    if (!info?.length) throw new Fail("upload_missing");
    // one file per member and kind: replace the previous one
    for (const f of await files(q)) if (f.member === member && f.kind === kind) await removeDoc(q, f.id);
    const m = (q.answers?.members || []).find((x: Any) => x.id === member);
    const L = LABEL[q.language] || LABEL.pt;
    await db.from("company_documents").insert({ company_id: q.company_id, client_id: q.client_id, category: "onboarding", title: `${L[kind]} – ${m?.name || ""}`.slice(0, 200), path,
      mime: String(body.mime || "").slice(0, 100) || null, size_bytes: Number(body.size) || null, visible_to_client: true, uploaded_by: null, uploaded_by_email: q.clients?.primary_email || "intake", note: `intake:${member}:${kind}` });
    return { ok: true, ...(await maybeComplete(q)) };
  }
  if (a === "delete") {
    const fl = await files(q), f = fl.find((x: Any) => x.id === String(body.id || ""));
    if (!f) throw new Fail("not_found", 404);
    await removeDoc(q, f.id);
    if (q.status === "complete") await db.from("intake_requests").update({ status: "open", completed_at: null }).eq("id", q.id);
    q.status = "open";
    return { ok: true, ...(await maybeComplete(q)) };
  }
  throw new Fail("unknown_action");
}
async function removeDoc(q: Any, id: string) {
  const { data: d } = await db.from("company_documents").select("id, path").eq("id", id).eq("company_id", q.company_id).maybeSingle();
  if (!d) return;
  await db.storage.from("client-docs").remove([d.path]);
  await db.from("company_documents").delete().eq("id", d.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: Any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  try { return json(await handle(body)); }
  catch (e) { if (e instanceof Fail) return json({ error: e.code }, e.status); console.error(e); return json({ error: "server_error" }, 500); }
});
