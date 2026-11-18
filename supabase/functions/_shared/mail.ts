// E-mail transacional da plataforma (mesmo remetente do CRM: SES se configurado, senão o SMTP do Gmail da Endeavor).
// Para empresas clientes, a mensagem vai "em nome de" a empresa: o nome dela no topo e na assinatura, resposta para o
// e-mail dela, e a linha "Enviado pela plataforma Endeavor".
import nodemailer from "npm:nodemailer@6.9.16";
// deno-lint-ignore no-explicit-any
type Db = any;

const SES_HOST = Deno.env.get("SES_SMTP_HOST") ?? "", SES_USER = Deno.env.get("SES_SMTP_USER") ?? "", SES_PASS = Deno.env.get("SES_SMTP_PASS") ?? "";
const G_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const G_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
export const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
export const SUPPORT = "support@endeavorbiz.com";
const PHONE = "+1 (407) 436-9567", WA_NUM = "+1 (630) 689-8702";
// SES só para o transacional quando a AWS liberar produção (secret SES_TRANSACIONAL=on); até lá, Gmail do support@
const sesOn = () => !!(SES_HOST && SES_USER && SES_PASS) && Deno.env.get("SES_TRANSACIONAL") === "on";
export const mailOn = () => sesOn() || G_PASS.length >= 8;
export type Lang = "pt" | "en" | "es";
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

let tr: ReturnType<typeof nodemailer.createTransport> | null = null;
const transport = () => (tr ??= sesOn()
  ? nodemailer.createTransport({ host: SES_HOST, port: 465, secure: true, auth: { user: SES_USER, pass: SES_PASS } })
  : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: G_USER, pass: G_PASS } }));
async function remetente(db: Db) {
  if (!sesOn()) return G_USER;
  const { data } = await db.from("mkt_settings").select("from_email").eq("id", 1).maybeSingle();
  return (data as { from_email?: string } | null)?.from_email || SUPPORT;
}

export type Marca = { endeavor: boolean; nome: string; replyTo?: string | null };
const SIGN: Record<Lang, (n: string) => string> = { pt: (n) => `Equipe ${n}`, en: (n) => `The ${n} team`, es: (n) => `Equipo de ${n}` };
const POR: Record<Lang, string> = { pt: "Enviado pela plataforma Endeavor em nome de", en: "Sent through the Endeavor platform on behalf of", es: "Enviado por la plataforma Endeavor en nombre de" };

export type Corpo = { kicker: string; h1: string; pre: string; paras: string[]; lista?: { texto: string; ok?: boolean }[]; cta?: string; url?: string; foot?: string };
export function shell(l: Lang, m: Marca, o: Corpo) {
  const navy = "#0b1f3a", gold = "#c9a24a";
  const btn = o.cta && o.url ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="border-radius:10px;background:${navy}"><a href="${esc(o.url)}" style="display:inline-block;padding:14px 24px;font:700 15px Arial,sans-serif;color:#fff;text-decoration:none;border-radius:10px">${esc(o.cta)}</a></td></tr></table>` : "";
  const lista = o.lista?.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;width:100%">${o.lista.map((i) =>
    `<tr><td style="padding:6px 10px 6px 0;vertical-align:top;font:15px Arial,sans-serif;color:${i.ok ? "#1e6b3a" : navy}">${i.ok ? "✓" : "•"}</td><td style="padding:6px 0;font:15px/1.5 Arial,sans-serif;color:#1f2937;${i.ok ? "text-decoration:line-through;color:#6b7280" : ""}">${esc(i.texto)}</td></tr>`).join("")}</table>` : "";
  const topo = m.endeavor
    ? `<img src="${SITE}/logo-endeavor-3000px.png" alt="Endeavor Business Solutions" width="190" style="display:block;width:190px;height:auto;border:0">`
    : `<div style="font:700 20px Georgia,serif;color:${navy}">${esc(m.nome)}</div>`;
  const rodape = m.endeavor
    ? `Endeavor Business Solutions · Orlando, FL · ${PHONE} · WhatsApp ${WA_NUM} · <a href="mailto:${SUPPORT}" style="color:#6b7280">${SUPPORT}</a> · <a href="${SITE}" style="color:#6b7280">endeavorbiz.com</a>`
    : `${POR[l]} ${esc(m.nome)}.`;
  return `<!doctype html><html lang="${l === "pt" ? "pt-BR" : l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.h1)}</title></head>
<body style="margin:0;padding:0;background:#eef1f6"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ee">
<tr><td style="padding:22px 30px;border-bottom:1px solid #eef0f4">${topo}</td></tr>
<tr><td style="background:${navy};padding:30px 30px 26px"><div style="font:700 12px/1 Arial,sans-serif;letter-spacing:.14em;color:${gold};margin:0 0 12px">${esc(o.kicker)}</div><div style="font:700 24px/1.25 Georgia,serif;color:#fff">${esc(o.h1)}</div></td></tr>
<tr><td style="padding:26px 30px 8px;font:15px/1.65 Arial,sans-serif;color:#1f2937">${o.paras.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("")}${lista}${btn}</td></tr>
<tr><td style="padding:12px 30px 26px;font:15px/1.6 Arial,sans-serif;color:#1f2937"><p style="margin:0;font-weight:700;color:${navy}">${esc(SIGN[l](m.endeavor ? "Endeavor Business Solutions" : m.nome))}</p>${o.foot ? `<p style="margin:12px 0 0;font:13px/1.55 Arial,sans-serif;color:#6b7280">${esc(o.foot)}</p>` : ""}</td></tr>
<tr><td style="padding:16px 30px;background:#f7f8fb;border-top:1px solid #eef0f4;font:12px/1.6 Arial,sans-serif;color:#6b7280">${rodape}</td></tr>
</table></td></tr></table></body></html>`;
}
export const texto = (l: Lang, m: Marca, o: Corpo) =>
  [o.h1, "", ...o.paras.map((p) => p.replace(/<[^>]+>/g, "")), ...(o.lista?.length ? ["", ...o.lista.map((i) => (i.ok ? "✓ " : "• ") + i.texto)] : []),
    ...(o.cta && o.url ? ["", `${o.cta}: ${o.url}`] : []), "", SIGN[l](m.endeavor ? "Endeavor Business Solutions" : m.nome), ...(o.foot ? ["", o.foot] : [])].join("\n");

/** Envia uma vez por chave (crm_messages.dedupe) e registra o resultado. */
export async function enviarEmail(db: Db, a: { dedupe: string; kind: string; lead_id?: string | null; to: string; l: Lang; marca: Marca; subject: string; corpo: Corpo; by?: string }) {
  if (!mailOn()) return "sem_remetente";
  const ins = await db.from("crm_messages").insert({ dedupe: a.dedupe + ":email", kind: a.kind, channel: "email", lead_id: a.lead_id ?? null, to_addr: a.to, subject: a.subject, created_by: a.by ?? "system" }).select("id").single();
  if (ins.error) return "dup";
  const id = (ins.data as { id: string }).id;
  try {
    await transport().sendMail({ from: { name: a.marca.endeavor ? "Endeavor Business Solutions" : `${a.marca.nome} (via Endeavor)`, address: await remetente(db) }, to: a.to,
      replyTo: a.marca.replyTo || SUPPORT, subject: a.subject, html: shell(a.l, a.marca, a.corpo), text: texto(a.l, a.marca, a.corpo) });
    await db.from("crm_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    return "sent";
  } catch (e) {
    await db.from("crm_messages").update({ status: "failed", error: String((e as Error).message).slice(0, 800) }).eq("id", id);
    return "failed";
  }
}
