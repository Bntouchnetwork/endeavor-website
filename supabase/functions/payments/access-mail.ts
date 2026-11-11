// Portal access e-mails sent by Endeavor (instead of the generic Supabase text):
// invitation to create the password (with what the portal does and the authenticator steps) and password reset.
// The one-time link is generated with the Admin API (generateLink) and sent over SES (or the support Gmail).
import nodemailer from "npm:nodemailer@6.9.16";

type Lang = "pt" | "en" | "es";
export type AccessKind = "client" | "collab" | "partner";
// deno-lint-ignore no-explicit-any
type Any = any;

const SITE = (Deno.env.get("SITE_URL") || "https://endeavorbiz.com").replace(/\/$/, "");
const SES_HOST = Deno.env.get("SES_SMTP_HOST") ?? "", SES_USER = Deno.env.get("SES_SMTP_USER") ?? "", SES_PASS = Deno.env.get("SES_SMTP_PASS") ?? "";
const G_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const G_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
const SUPPORT = "support@endeavorbiz.com", PHONE = "+1 (407) 436-9567";
const sesOn = () => !!(SES_HOST && SES_USER && SES_PASS);
export const accessMailOn = () => sesOn() || G_PASS.length >= 8;
let tr: ReturnType<typeof nodemailer.createTransport> | null = null;
const transport = () => (tr ??= sesOn()
  ? nodemailer.createTransport({ host: SES_HOST, port: 465, secure: true, auth: { user: SES_USER, pass: SES_PASS } })
  : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: G_USER, pass: G_PASS } }));
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const L = (l: unknown): Lang => (l === "en" || l === "es" ? l : "pt");

const T: Record<Lang, Any> = {
  pt: {
    s_invite: "Seu acesso ao portal da Endeavor Business Solutions", s_reset: "Redefina sua senha do portal Endeavor",
    hi: (n: string) => (n ? `Olá, ${n}!` : "Olá!"),
    lead: { client: "A Endeavor Business Solutions criou o seu acesso ao <strong>Portal do Cliente</strong>. É nele que você acompanha tudo sobre as suas empresas nos EUA, num só lugar e com segurança.",
      collab: "A Endeavor Business Solutions convidou você para o <strong>Portal do Parceiro</strong> como colaborador{c}. Por ele você acessa as informações que o cliente compartilhou com você.",
      partner: "A Endeavor Business Solutions criou o seu acesso ao <strong>Portal do Parceiro</strong>, onde você envia indicações e acompanha suas comissões." },
    can: "O que você pode fazer no portal",
    feats: {
      client: ["Gerenciar sua conta e os dados das suas empresas", "Ver, imprimir e baixar seus documentos (Articles, EIN, Operating Agreement e outros)", "Acompanhar a linha do tempo de cada serviço e os prazos fiscais, com avisos antes de cada data", "Receber notificações e mensagens da equipe Endeavor", "Convidar colaboradores, como seu contador ou sócio, com o acesso que você escolher", "Ver e pagar faturas, e consultar relatórios financeiros", "Agendar consultas com advogados parceiros"],
      collab: ["Ver os documentos e prazos que o cliente liberou para você", "Enviar documentos para a equipe Endeavor, se o cliente permitir", "Receber notificações sobre as empresas que você acompanha"],
      partner: ["Enviar indicações e acompanhar cada uma pela linha do tempo", "Ver os pacotes fechados e as suas comissões", "Receber seus pagamentos pelo Stripe", "Atualizar seus dados em Minha conta"] },
    steps: "Como entrar pela primeira vez",
    st: { client: ["Clique no botão <strong>Criar minha senha</strong> abaixo.", "Crie uma senha com pelo menos 12 caracteres.", "Ative a verificação em duas etapas: instale no celular o <strong>Google Authenticator</strong> ou o <strong>Microsoft Authenticator</strong>, escaneie o QR code que aparece na tela e digite o código de 6 dígitos.", "Pronto. Nos próximos acessos, entre com e-mail, senha e o código do aplicativo."],
      partner: ["Clique no botão <strong>Criar minha senha</strong> abaixo.", "Crie uma senha com pelo menos 12 caracteres.", "Pronto, você já entra no portal. Se quiser mais proteção, ative a verificação em duas etapas em <strong>Minha conta</strong>."] },
    whyH: "Por que pedimos o código do celular",
    why: "O portal guarda documentos fiscais e dados das suas empresas. Com a verificação em duas etapas, mesmo que alguém descubra a sua senha, não consegue entrar sem o código que aparece só no seu celular. O código muda a cada 30 segundos.",
    btn: "Criar minha senha", btnReset: "Criar nova senha",
    resetLead: "Recebemos um pedido para redefinir a senha do seu acesso ao portal da Endeavor. Clique no botão abaixo para criar uma nova senha.",
    resetIgnore: "Se não foi você, ignore este e-mail. A sua senha continua a mesma.",
    expire: "Por segurança, o link vale por pouco tempo e só pode ser usado uma vez. Se ele expirar, abra o portal e clique em <strong>Esqueci minha senha</strong>.",
    never: "A Endeavor nunca pede a sua senha nem o código do aplicativo por e-mail, telefone ou WhatsApp.",
    help: "Dúvidas? Responda este e-mail ou fale com a gente:", sign: "Equipe Endeavor Business Solutions", portal: "Endereço do portal",
  },
  en: {
    s_invite: "Your access to the Endeavor Business Solutions portal", s_reset: "Reset your Endeavor portal password",
    hi: (n: string) => (n ? `Hi ${n},` : "Hi,"),
    lead: { client: "Endeavor Business Solutions has created your access to the <strong>Client Portal</strong>. It is where you follow everything about your US companies, in one secure place.",
      collab: "Endeavor Business Solutions has invited you to the <strong>Partner Portal</strong> as a collaborator{c}. There you can see the information the client shared with you.",
      partner: "Endeavor Business Solutions has created your access to the <strong>Partner Portal</strong>, where you send referrals and follow your commissions." },
    can: "What you can do in the portal",
    feats: {
      client: ["Manage your account and your companies' details", "View, print and download your documents (Articles, EIN, Operating Agreement and more)", "Follow the timeline of each service and your tax deadlines, with reminders before each date", "Get notifications and messages from the Endeavor team", "Invite collaborators, such as your accountant or partner, with the access you choose", "See and pay invoices, and check financial reports", "Book consultations with partner attorneys"],
      collab: ["See the documents and deadlines the client shared with you", "Send documents to the Endeavor team, if the client allows it", "Get notifications about the companies you follow"],
      partner: ["Send referrals and follow each one on its timeline", "See closed packages and your commissions", "Get paid through Stripe", "Update your details in My account"] },
    steps: "How to sign in the first time",
    st: { client: ["Click <strong>Create my password</strong> below.", "Create a password with at least 12 characters.", "Turn on two-step verification: install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone, scan the QR code shown on screen and type the 6-digit code.", "Done. Next time, sign in with your e-mail, password and the code from the app."],
      partner: ["Click <strong>Create my password</strong> below.", "Create a password with at least 12 characters.", "Done, you are in. For extra protection, turn on two-step verification in <strong>My account</strong>."] },
    whyH: "Why we ask for a code from your phone",
    why: "The portal keeps tax documents and details about your companies. With two-step verification, even if someone finds out your password, they cannot sign in without the code that only your phone shows. The code changes every 30 seconds.",
    btn: "Create my password", btnReset: "Create a new password",
    resetLead: "We received a request to reset the password of your Endeavor portal access. Click the button below to create a new password.",
    resetIgnore: "If this was not you, ignore this e-mail. Your password stays the same.",
    expire: "For security, the link works for a short time and only once. If it expires, open the portal and click <strong>Forgot password</strong>.",
    never: "Endeavor never asks for your password or app code by e-mail, phone or WhatsApp.",
    help: "Questions? Reply to this e-mail or reach us:", sign: "The Endeavor Business Solutions team", portal: "Portal address",
  },
  es: {
    s_invite: "Su acceso al portal de Endeavor Business Solutions", s_reset: "Restablezca su contraseña del portal Endeavor",
    hi: (n: string) => (n ? `¡Hola, ${n}!` : "¡Hola!"),
    lead: { client: "Endeavor Business Solutions creó su acceso al <strong>Portal del Cliente</strong>. Allí sigue todo sobre sus empresas en EE. UU., en un solo lugar y con seguridad.",
      collab: "Endeavor Business Solutions lo invitó al <strong>Portal del Socio</strong> como colaborador{c}. Allí ve la información que el cliente compartió con usted.",
      partner: "Endeavor Business Solutions creó su acceso al <strong>Portal del Socio</strong>, donde envía referidos y sigue sus comisiones." },
    can: "Lo que puede hacer en el portal",
    feats: {
      client: ["Gestionar su cuenta y los datos de sus empresas", "Ver, imprimir y descargar sus documentos (Articles, EIN, Operating Agreement y otros)", "Seguir la línea de tiempo de cada servicio y sus plazos fiscales, con avisos antes de cada fecha", "Recibir notificaciones y mensajes del equipo Endeavor", "Invitar colaboradores, como su contador o socio, con el acceso que usted elija", "Ver y pagar facturas, y consultar informes financieros", "Agendar consultas con abogados socios"],
      collab: ["Ver los documentos y plazos que el cliente compartió con usted", "Enviar documentos al equipo Endeavor, si el cliente lo permite", "Recibir notificaciones sobre las empresas que sigue"],
      partner: ["Enviar referidos y seguir cada uno en su línea de tiempo", "Ver los paquetes cerrados y sus comisiones", "Recibir sus pagos por Stripe", "Actualizar sus datos en Mi cuenta"] },
    steps: "Cómo entrar la primera vez",
    st: { client: ["Haga clic en <strong>Crear mi contraseña</strong> abajo.", "Cree una contraseña de al menos 12 caracteres.", "Active la verificación en dos pasos: instale en el celular <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong>, escanee el código QR de la pantalla y escriba el código de 6 dígitos.", "Listo. En los próximos accesos, entre con correo, contraseña y el código de la aplicación."],
      partner: ["Haga clic en <strong>Crear mi contraseña</strong> abajo.", "Cree una contraseña de al menos 12 caracteres.", "Listo, ya puede entrar. Para más protección, active la verificación en dos pasos en <strong>Mi cuenta</strong>."] },
    whyH: "Por qué pedimos un código del celular",
    why: "El portal guarda documentos fiscales y datos de sus empresas. Con la verificación en dos pasos, aunque alguien descubra su contraseña, no puede entrar sin el código que solo aparece en su celular. El código cambia cada 30 segundos.",
    btn: "Crear mi contraseña", btnReset: "Crear nueva contraseña",
    resetLead: "Recibimos un pedido para restablecer la contraseña de su acceso al portal de Endeavor. Haga clic en el botón de abajo para crear una nueva contraseña.",
    resetIgnore: "Si no fue usted, ignore este correo. Su contraseña sigue igual.",
    expire: "Por seguridad, el enlace vale por poco tiempo y solo una vez. Si vence, abra el portal y haga clic en <strong>Olvidé mi contraseña</strong>.",
    never: "Endeavor nunca pide su contraseña ni el código de la aplicación por correo, teléfono o WhatsApp.",
    help: "¿Dudas? Responda este correo o escríbanos:", sign: "Equipo de Endeavor Business Solutions", portal: "Dirección del portal",
  },
};

const btn = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="border-radius:8px;background:#0b1f3a"><a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font:700 15px Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:8px">${esc(label)}</a></td></tr></table>`;
function layout(inner: string) {
  return `<!doctype html><html><head><meta name="color-scheme" content="light only"></head><body style="margin:0;background:#f4f6f9"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #e3e7ee">
<tr><td style="padding:22px 30px;border-bottom:3px solid #c9a24a"><img src="${SITE}/logo-endeavor-3000px.png" alt="Endeavor Business Solutions" width="190" style="display:block;width:190px;height:auto"></td></tr>
<tr><td style="padding:28px 30px;font:15px/1.6 Arial,sans-serif;color:#1f2937">${inner}</td></tr>
<tr><td style="padding:16px 30px;border-top:1px solid #e3e7ee;font:12px/1.5 Arial,sans-serif;color:#6b7280">Endeavor Business Solutions · Orlando, FL · ${PHONE} · <a href="mailto:${SUPPORT}" style="color:#6b7280">${SUPPORT}</a></td></tr>
</table></td></tr></table></body></html>`;
}
const h2 = (s: string) => `<h2 style="font:700 16px/1.35 Georgia,serif;color:#0b1f3a;margin:24px 0 10px">${s}</h2>`;

export function accessEmail(o: { lang: string; kind: AccessKind; reset: boolean; name?: string; clientName?: string; link: string; page: string }) {
  const lang = L(o.lang), t = T[lang], first = String(o.name || "").trim().split(/\s+/)[0] || "";
  const portalUrl = `${SITE}/${o.page}?lang=${lang}`;
  if (o.reset) {
    const inner = `<p style="margin:0 0 6px">${esc(t.hi(first))}</p><h1 style="font:700 22px/1.35 Georgia,serif;color:#0b1f3a;margin:0 0 14px">${esc(t.s_reset)}</h1>
<p style="margin:0">${esc(t.resetLead)}</p>${btn(o.link, t.btnReset)}
<p style="margin:0 0 10px;font-size:13px;color:#4b5563">${t.expire}</p><p style="margin:0 0 10px;font-size:13px;color:#4b5563">${esc(t.resetIgnore)}</p>
<p style="margin:16px 0 0;font-size:13px;color:#4b5563">${esc(t.never)}</p><p style="margin:22px 0 0">${esc(t.sign)}</p>`;
    return { subject: t.s_reset, html: layout(inner), text: `${t.hi(first)}\n\n${t.resetLead}\n${o.link}\n\n${t.resetIgnore}\n\n${t.sign}` };
  }
  const k = o.kind, mfa = k !== "partner";
  const lead = t.lead[k].replace("{c}", o.clientName ? (lang === "en" ? ` of <strong>${esc(o.clientName)}</strong>` : ` de <strong>${esc(o.clientName)}</strong>`) : "");
  const steps: string[] = mfa ? t.st.client : t.st.partner;
  const inner = `<p style="margin:0 0 6px">${esc(t.hi(first))}</p><h1 style="font:700 22px/1.35 Georgia,serif;color:#0b1f3a;margin:0 0 14px">${esc(t.s_invite)}</h1>
<p style="margin:0">${lead}</p>${btn(o.link, t.btn)}
${h2(esc(t.can))}<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${(t.feats[k] as string[]).map((f) => `<tr><td valign="top" style="width:22px;padding:3px 0;color:#c9a24a;font:700 15px Arial,sans-serif">✓</td><td style="padding:3px 0;font:14px/1.5 Arial,sans-serif">${esc(f)}</td></tr>`).join("")}</table>
${h2(esc(t.steps))}<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${steps.map((s, i) => `<tr><td valign="top" style="width:30px;padding:5px 0"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#0b1f3a;color:#fff;font:700 12px/22px Arial,sans-serif;text-align:center">${i + 1}</span></td><td style="padding:5px 0;font:14px/1.55 Arial,sans-serif">${s}</td></tr>`).join("")}</table>
${mfa ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0 0;background:#f6f1e4;border-left:3px solid #c9a24a;border-radius:8px"><tr><td style="padding:14px 16px;font:14px/1.55 Arial,sans-serif;color:#3a3326"><strong>${esc(t.whyH)}</strong><br>${esc(t.why)}</td></tr></table>` : ""}
<p style="margin:20px 0 6px;font-size:13px;color:#4b5563">${t.expire}</p>
<p style="margin:0 0 6px;font-size:13px;color:#4b5563">${esc(t.portal)}: <a href="${esc(portalUrl)}" style="color:#0b1f3a">${esc(portalUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, ""))}</a></p>
<p style="margin:0 0 6px;font-size:13px;color:#4b5563">${esc(t.never)}</p>
<p style="margin:16px 0 0">${esc(t.help)} <a href="mailto:${SUPPORT}" style="color:#0b1f3a">${SUPPORT}</a> · ${PHONE}</p><p style="margin:18px 0 0">${esc(t.sign)}</p>`;
  const text = `${t.hi(first)}\n\n${lead.replace(/<[^>]+>/g, "")}\n\n${t.btn}: ${o.link}\n\n${t.can}:\n- ${(t.feats[k] as string[]).join("\n- ")}\n\n${t.steps}:\n${steps.map((s, i) => `${i + 1}. ${s.replace(/<[^>]+>/g, "")}`).join("\n")}\n\n${mfa ? t.why + "\n\n" : ""}${t.never}\n\n${t.sign}`;
  return { subject: t.s_invite, html: layout(inner), text };
}

export async function sendAccessMail(to: string, m: { subject: string; html: string; text: string }) {
  const from = sesOn() ? SUPPORT : G_USER;
  await transport().sendMail({ from: { name: "Endeavor Business Solutions", address: from }, to, subject: m.subject, html: m.html, text: m.text, replyTo: SUPPORT });
}
