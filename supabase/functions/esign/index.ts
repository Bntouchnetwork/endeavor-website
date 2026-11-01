// Endeavor e-signature: signer-facing endpoint. Access is controlled by the envelope's secret token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { safe, wrap, cleanFields, validateValues, stampFields, stampEnvelopeId } from "./stamp.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientMeta(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const ua = (req.headers.get("user-agent") || "unknown").slice(0, 400);
  return { ip, ua };
}
async function event(envelope_id: string, ev: string, ip: string, ua: string, details: Record<string, unknown> = {}) {
  await admin.from("envelope_events").insert({ envelope_id, event: ev, ip, user_agent: ua, details });
}
async function signedUrl(path: string, seconds = 600) {
  const { data, error } = await admin.storage.from("documents").createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
const pngBytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
const isPng = (s: string) => s.startsWith("data:image/png;base64,") && s.length <= 600000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { action, token } = body || {};
  if (!token || !UUID.test(String(token))) return json({ error: "invalid_link" }, 404);
  const { ip, ua } = clientMeta(req);

  const { data: env, error } = await admin.from("envelopes").select("*").eq("token", token).maybeSingle();
  if (error || !env) return json({ error: "invalid_link" }, 404);
  if (env.status === "voided") return json({ error: "voided" }, 410);
  if (env.status !== "signed" && new Date(env.token_expires_at) < new Date()) {
    await admin.from("envelopes").update({ status: "expired" }).eq("id", env.id);
    return json({ error: "expired" }, 410);
  }

  try {
    if (action === "get") {
      if (env.status === "signed") {
        return json({ status: "signed", title: env.title, signer_name: env.signer_name, signed_at: env.signed_at,
          signed_url: await signedUrl(env.signed_document_path), signed_sha256: env.signed_document_sha256 });
      }
      const firstView = !env.viewed_at;
      if (firstView) await admin.from("envelopes").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", env.id);
      await event(env.id, "viewed", ip, ua);
      return json({ status: "viewed", first_view: firstView, title: env.title, message: env.message, signer_name: env.signer_name,
        fields: env.fields || [], document_sha256: env.document_sha256, document_url: await signedUrl(env.document_path, 1800) });
    }

    if (action === "download") {
      if (env.status !== "signed") return json({ error: "not_signed" }, 400);
      await event(env.id, "downloaded", ip, ua, { by: "signer" });
      return json({ signed_url: await signedUrl(env.signed_document_path) });
    }

    if (action === "sign") {
      if (env.status === "signed") return json({ error: "already_signed" }, 409);
      const typed = String(body.typed_name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const sig = String(body.signature_png || "");
      const ini = String(body.initials_png || "");
      const values = body.values && typeof body.values === "object" ? body.values : {};
      if (body.consent !== true || body.agree !== true) return json({ error: "consent_required" }, 400);
      if (typed.length < 2 || typed.length > 200) return json({ error: "name_required" }, 400);
      if (email !== String(env.signer_email).toLowerCase()) return json({ error: "email_mismatch" }, 403);
      if (sig && !isPng(sig)) return json({ error: "signature_required" }, 400);
      if (ini && !isPng(ini)) return json({ error: "initials_required" }, 400);

      // download original and verify it was not altered since the envelope was created
      const { data: file, error: dlErr } = await admin.storage.from("documents").download(env.document_path);
      if (dlErr || !file) throw dlErr || new Error("download_failed");
      const original = new Uint8Array(await file.arrayBuffer());
      const originalHash = await sha256Hex(original);
      if (originalHash !== env.document_sha256) return json({ error: "document_integrity_failed" }, 409);

      const pdf = await PDFDocument.load(original, { updateMetadata: false });
      const fields = cleanFields(env.fields, pdf.getPageCount());
      if (fields.length) {
        const bad = validateValues(fields, values, !!sig, !!ini);
        if (bad) return json({ error: bad }, 400);
      } else if (!sig) return json({ error: "signature_required" }, 400);

      const consentAt = new Date().toISOString();
      await event(env.id, "consented", ip, ua, { esign_disclosure_version: "2026-10-31", typed_name: typed });

      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const sigImg = sig ? await pdf.embedPng(pngBytes(sig)) : null;
      const initImg = ini ? await pdf.embedPng(pngBytes(ini)) : null;
      const signedAt = new Date();
      const stamp = signedAt.toISOString().replace("T", " ").slice(0, 19) + " UTC";
      const dateText = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", year: "numeric" }).format(signedAt);

      const cleanValues: Record<string, unknown> = {};
      if (fields.length) {
        for (const f of fields) {
          if (f.type === "text") cleanValues[f.id] = String(values[f.id] ?? "").slice(0, 500);
          if (f.type === "checkbox") cleanValues[f.id] = values[f.id] === true;
        }
        await stampFields(pdf, { rgb, font, bold, fields, values: cleanValues, sigImg, initImg, typedName: typed, email: env.signer_email, dateText, envelopeShort: env.id.slice(0, 8) });
      } else {
        // legacy: signature block on the last page
        const pages = pdf.getPages();
        const last = pages[pages.length - 1];
        const { width } = last.getSize();
        const boxW = 220, boxH = 78, x = width - boxW - 36, y = 36;
        last.drawRectangle({ x, y, width: boxW, height: boxH, color: rgb(1, 1, 1), opacity: 0.92, borderColor: rgb(0.08, 0.16, 0.30), borderWidth: 0.8 });
        const scaled = sigImg!.scaleToFit(boxW - 16, 38);
        last.drawImage(sigImg!, { x: x + 8, y: y + 30, width: scaled.width, height: scaled.height });
        last.drawText(safe("Electronically signed by " + typed), { x: x + 8, y: y + 18, size: 7, font: bold, color: rgb(0.08, 0.16, 0.30) });
        last.drawText(safe(stamp + " | Envelope " + env.id.slice(0, 8)), { x: x + 8, y: y + 8, size: 6.5, font, color: rgb(0.3, 0.3, 0.3) });
      }

      // envelope ID on every document page (documents prepared in the editor already carry it)
      if (!env.id_stamped) stampEnvelopeId(pdf, { font, rgb, id: env.id });

      // certificate of completion
      const { data: evs } = await admin.from("envelope_events").select("at,event,ip,user_agent").eq("envelope_id", env.id).order("at");
      const cert = pdf.addPage([612, 792]);
      stampEnvelopeId(pdf, { font, rgb, id: env.id, pages: [cert] });
      let cy = 740;
      const line = (t: string, size = 9.5, f = font, color = rgb(0.15, 0.15, 0.15), indent = 0) => {
        for (const l of wrap(safe(t), f, size, 540 - indent)) {
          if (cy < 50) return;
          cert.drawText(l, { x: 36 + indent, y: cy, size, font: f, color }); cy -= size + 4;
        }
      };
      line("Certificate of Completion", 18, bold, rgb(0.08, 0.16, 0.30)); cy -= 6;
      line("Endeavor Business Solutions (a trade name of Endeavor Tax Solutions LLC) - Electronic Signature Record", 9, font, rgb(0.4, 0.4, 0.4)); cy -= 8;
      const rows: [string, string][] = [
        ["Envelope ID", env.id], ["Document", env.title], ["Signer", env.signer_name + " <" + env.signer_email + ">"],
        ["Typed signature name", typed], ["Signed at", stamp], ["Signer IP address", ip], ["Signer device", ua],
        ["Consent to electronic records", consentAt.replace("T", " ").slice(0, 19) + " UTC (ESIGN/UETA disclosure v2026-10-31)"],
        ["Fields completed", fields.length ? String(fields.length) + " (" + [...new Set(fields.map((f: any) => f.type))].join(", ") + ")" : "Signature block"],
        ["Original document SHA-256", originalHash],
      ];
      for (const [k, v] of rows) { line(k, 8.5, bold, rgb(0.08, 0.16, 0.30)); line(v, 9, font, rgb(0.15, 0.15, 0.15), 10); cy -= 2; }
      cy -= 6; line("Audit trail", 11, bold, rgb(0.08, 0.16, 0.30));
      for (const e of evs || []) line(String(e.at).replace("T", " ").slice(0, 19) + " UTC  " + e.event + (e.ip ? "  IP " + e.ip : ""), 8.5);
      line(stamp + "  signed  IP " + ip, 8.5);
      cy -= 8;
      line("The signer accessed this document through a unique link sent to the email address above, confirmed that email address, consented to use electronic records and signatures, and adopted the signature shown on the document. The SHA-256 fingerprint of the original document was verified before signing. Any change to this PDF after signing changes its fingerprint, which is recorded by Endeavor.", 8.5, font, rgb(0.3, 0.3, 0.3));

      const signedBytes = await pdf.save();
      const signedHash = await sha256Hex(signedBytes);
      const signedPath = "signed/" + env.id + ".pdf";
      const { error: upErr } = await admin.storage.from("documents").upload(signedPath, signedBytes, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      await admin.from("envelopes").update({
        status: "signed", signed_at: signedAt.toISOString(), consent_at: consentAt, signature_name: typed, field_values: cleanValues,
        signer_ip: ip, signer_user_agent: ua, signed_document_path: signedPath, signed_document_sha256: signedHash,
      }).eq("id", env.id).neq("status", "signed");
      await event(env.id, "signed", ip, ua, { typed_name: typed });
      await event(env.id, "completed", ip, ua, { signed_sha256: signedHash });

      return json({ status: "signed", signed_at: signedAt.toISOString(), signed_sha256: signedHash, signed_url: await signedUrl(signedPath) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
