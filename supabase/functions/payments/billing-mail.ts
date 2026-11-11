// Billing e-mails (PT/EN/ES): invoice, reminders, receipt, payment failed, proposal with the invoice,
// opening documents request, ACH authorization request; plus the team notices (in Portuguese).
import { btn, esc, layout } from "./access-mail.ts";

type Lang = "pt" | "en" | "es";
// deno-lint-ignore no-explicit-any
type Any = any;
const L = (l: unknown): Lang => (l === "en" || l === "es" ? l : "pt");
const LOC: Record<Lang, string> = { pt: "pt-BR", en: "en-US", es: "es" };
export const money = (c: number, cur = "usd", l: unknown = "pt") => new Intl.NumberFormat(LOC[L(l)], { style: "currency", currency: (cur || "usd").toUpperCase() }).format((Number(c) || 0) / 100);
export const dateL = (d: string | null | undefined, l: unknown = "pt") => d ? new Intl.DateTimeFormat(LOC[L(l)], { dateStyle: "long", timeZone: "UTC" }).format(new Date(String(d).slice(0, 10) + "T12:00:00Z")) : "";
const first = (n: unknown) => String(n || "").trim().split(/\s+/)[0] || "";
const P = "font:15px/1.6 Arial,sans-serif;margin:0 0 12px";
const H1 = (s: string) => `<h1 style="font:700 22px/1.35 Georgia,serif;color:#0b1f3a;margin:0 0 14px">${s}</h1>`;
const H2 = (s: string) => `<h2 style="font:700 16px/1.35 Georgia,serif;color:#0b1f3a;margin:22px 0 10px">${s}</h2>`;
const box = (inner: string, gold = false) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 16px;background:${gold ? "#f6f1e4" : "#f7f8fb"};border-radius:10px${gold ? ";border-left:3px solid #c9a24a" : ""}"><tr><td style="padding:14px 16px;font:14px/1.6 Arial,sans-serif;color:#1f2937">${inner}</td></tr></table>`;
const btn2 = (href: string, label: string, ghost = false) => `<a href="${esc(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:13px 22px;border-radius:8px;font:700 15px Arial,sans-serif;text-decoration:none;${ghost ? "background:#fff;color:#0b1f3a;border:1.5px solid #0b1f3a" : "background:#0b1f3a;color:#fff"}">${esc(label)}</a>`;
const itemsTable = (items: Any[], cur: string, l: Lang, extra = "") => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 12px;font:14px/1.5 Arial,sans-serif">${(items || []).map((i: Any) =>
  `<tr><td style="padding:7px 0;border-bottom:1px solid #eef1f5">${esc(i.description)}${(i.quantity || 1) > 1 ? ` <span style="color:#6b7280">× ${i.quantity}</span>` : ""}${i.recurring === "month" ? ` <span style="color:#7a5d1f">(${({ pt: "mensal", en: "monthly", es: "mensual" } as Record<Lang, string>)[l]})</span>` : ""}</td><td style="padding:7px 0;border-bottom:1px solid #eef1f5;text-align:right;white-space:nowrap">${esc(money((i.amount_cents || 0) * (i.quantity || 1), cur, l))}${i.recurring === "month" ? ({ pt: "/mês", en: "/mo", es: "/mes" } as Record<Lang, string>)[l] : ""}</td></tr>`).join("")}${extra}</table>`;
const sign: Record<Lang, string> = { pt: "Equipe Endeavor Business Solutions", en: "The Endeavor Business Solutions team", es: "Equipo de Endeavor Business Solutions" };
const help: Record<Lang, string> = { pt: "Dúvidas? Responda este e-mail ou fale pelo WhatsApp +1 (630) 689-8702.", en: "Questions? Reply to this e-mail or WhatsApp us at +1 (630) 689-8702.", es: "¿Dudas? Responda este correo o escríbanos por WhatsApp al +1 (630) 689-8702." };
const foot = (l: Lang) => `<p style="margin:20px 0 0;font-size:13px;color:#4b5563">${esc(help[l])}</p><p style="margin:14px 0 0">${esc(sign[l])}</p>`;
const strip = (h: string) => h.replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|tr|h1|h2|li)>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
const out = (subject: string, inner: string) => ({ subject, html: layout(inner), text: strip(inner) });
const METHODS: Record<Lang, string> = {
  pt: "Formas de pagamento: cartão de crédito ou débito (Visa, Mastercard, Amex, inclusive cartões internacionais), Apple Pay, Google Pay ou débito em conta americana (ACH). Cartões emitidos no Brasil podem ter IOF cobrado pelo seu banco.",
  en: "Payment options: credit or debit card (Visa, Mastercard, Amex, international cards included), Apple Pay, Google Pay or US bank account (ACH).",
  es: "Formas de pago: tarjeta de crédito o débito (Visa, Mastercard, Amex, incluidas tarjetas internacionales), Apple Pay, Google Pay o débito en cuenta de EE. UU. (ACH).",
};

/* ---------- invoice, reminders, receipt ---------- */
export function invoiceEmail(o: { lang: unknown; name: string; number: string; total: number; cur: string; due: string | null; items: Any[]; description?: string | null; payUrl: string; pdfUrl?: string | null; reminder?: number; daysLate?: number }) {
  const l = L(o.lang), n = first(o.name), r = o.reminder || 0;
  const T = {
    pt: { s: r ? `Lembrete: fatura ${o.number} em aberto` : `Fatura ${o.number} da Endeavor Business Solutions`, hi: n ? `Olá, ${n}!` : "Olá!",
      lead: r ? `A fatura ${o.number} venceu ${o.daysLate && o.daysLate > 1 ? `há ${o.daysLate} dias` : "ontem"} e ainda aparece em aberto. Se você já pagou, pode ignorar este lembrete.` : "Segue a sua fatura. Você pode pagar pelo botão abaixo, num ambiente seguro do Stripe.",
      due: "Vencimento", total: "Total", pay: "Pagar fatura", pdf: "Baixar PDF da fatura", h: r ? `${r}º lembrete` : "Fatura" },
    en: { s: r ? `Reminder: invoice ${o.number} is open` : `Invoice ${o.number} from Endeavor Business Solutions`, hi: n ? `Hi ${n},` : "Hi,",
      lead: r ? `Invoice ${o.number} was due ${o.daysLate && o.daysLate > 1 ? `${o.daysLate} days ago` : "yesterday"} and is still open. If you already paid, please ignore this reminder.` : "Here is your invoice. You can pay with the button below on Stripe's secure page.",
      due: "Due date", total: "Total", pay: "Pay invoice", pdf: "Download the invoice PDF", h: r ? `Reminder ${r}` : "Invoice" },
    es: { s: r ? `Recordatorio: factura ${o.number} pendiente` : `Factura ${o.number} de Endeavor Business Solutions`, hi: n ? `¡Hola, ${n}!` : "¡Hola!",
      lead: r ? `La factura ${o.number} venció ${o.daysLate && o.daysLate > 1 ? `hace ${o.daysLate} días` : "ayer"} y sigue pendiente. Si ya pagó, ignore este recordatorio.` : "Le enviamos su factura. Puede pagar con el botón de abajo, en la página segura de Stripe.",
      due: "Vencimiento", total: "Total", pay: "Pagar factura", pdf: "Descargar el PDF de la factura", h: r ? `Recordatorio ${r}` : "Factura" },
  }[l];
  const inner = `<p style="${P}">${esc(T.hi)}</p>${H1(esc(T.s))}<p style="${P}">${esc(T.lead)}</p>` +
    box(`${o.description ? `<strong>${esc(o.description)}</strong><br>` : ""}${itemsTable(o.items, o.cur, l)}<strong>${esc(T.total)}: ${esc(money(o.total, o.cur, l))}</strong>${o.due ? `<br>${esc(T.due)}: ${esc(dateL(o.due, l))}` : ""}`) +
    btn(o.payUrl, T.pay) + (o.pdfUrl ? `<p style="margin:0 0 12px"><a href="${esc(o.pdfUrl)}" style="color:#0b1f3a">${esc(T.pdf)}</a></p>` : "") +
    `<p style="margin:0 0 6px;font-size:13px;color:#4b5563">${esc(METHODS[l])}</p>` + foot(l);
  return out(T.s, inner);
}
export function receiptEmail(o: { lang: unknown; name: string; number: string; amount: number; cur: string; paidAt: string | null; items: Any[]; receiptUrl?: string | null; pdfUrl?: string | null; portalUrl: string; monthly?: { cents: number; first: string | null } | null }) {
  const l = L(o.lang), n = first(o.name);
  const T = {
    pt: { s: `Pagamento confirmado: fatura ${o.number}`, hi: n ? `Olá, ${n}!` : "Olá!", lead: "Recebemos o seu pagamento. Obrigado! Este e-mail é o seu comprovante.", paid: "Valor pago", on: "Data", rec: "Ver recibo", pdf: "Baixar a fatura paga (PDF)", portal: "Abrir o portal do cliente", m: (v: string, d: string) => `A manutenção mensal de ${v} começa a ser cobrada automaticamente em ${d}, no mesmo meio de pagamento.` },
    en: { s: `Payment confirmed: invoice ${o.number}`, hi: n ? `Hi ${n},` : "Hi,", lead: "We received your payment. Thank you! This e-mail is your receipt.", paid: "Amount paid", on: "Date", rec: "View receipt", pdf: "Download the paid invoice (PDF)", portal: "Open the client portal", m: (v: string, d: string) => `The monthly maintenance of ${v} will be charged automatically from ${d}, with the same payment method.` },
    es: { s: `Pago confirmado: factura ${o.number}`, hi: n ? `¡Hola, ${n}!` : "¡Hola!", lead: "Recibimos su pago. ¡Gracias! Este correo es su comprobante.", paid: "Monto pagado", on: "Fecha", rec: "Ver recibo", pdf: "Descargar la factura pagada (PDF)", portal: "Abrir el portal del cliente", m: (v: string, d: string) => `El mantenimiento mensual de ${v} se cobrará automáticamente desde el ${d}, con el mismo medio de pago.` },
  }[l];
  const inner = `<p style="${P}">${esc(T.hi)}</p>${H1(esc(T.s))}<p style="${P}">${esc(T.lead)}</p>` +
    box(`${itemsTable(o.items, o.cur, l)}<strong>${esc(T.paid)}: ${esc(money(o.amount, o.cur, l))}</strong>${o.paidAt ? `<br>${esc(T.on)}: ${esc(dateL(o.paidAt, l))}` : ""}`) +
    (o.monthly && o.monthly.cents ? box(esc(T.m(money(o.monthly.cents, o.cur, l), dateL(o.monthly.first, l))), true) : "") +
    (o.receiptUrl ? btn2(o.receiptUrl, T.rec) : "") + (o.pdfUrl ? btn2(o.pdfUrl, T.pdf, true) : "") + `<p style="margin:10px 0 0"><a href="${esc(o.portalUrl)}" style="color:#0b1f3a">${esc(T.portal)}</a></p>` + foot(l);
  return out(T.s, inner);
}
export function failedEmail(o: { lang: unknown; name: string; number: string; amount: number; cur: string; payUrl: string }) {
  const l = L(o.lang), n = first(o.name);
  const T = {
    pt: { s: `Não conseguimos cobrar a fatura ${o.number}`, hi: n ? `Olá, ${n}!` : "Olá!", lead: `A cobrança automática de ${money(o.amount, o.cur, l)} foi recusada pelo banco. Isso acontece, por exemplo, com cartões emitidos fora dos EUA. Pelo botão abaixo você paga a fatura ou troca o cartão.`, b: "Pagar ou trocar o cartão" },
    en: { s: `We could not charge invoice ${o.number}`, hi: n ? `Hi ${n},` : "Hi,", lead: `The automatic charge of ${money(o.amount, o.cur, l)} was declined by the bank. Use the button below to pay the invoice or update your card.`, b: "Pay or update card" },
    es: { s: `No pudimos cobrar la factura ${o.number}`, hi: n ? `¡Hola, ${n}!` : "¡Hola!", lead: `El cobro automático de ${money(o.amount, o.cur, l)} fue rechazado por el banco. Con el botón de abajo puede pagar la factura o cambiar la tarjeta.`, b: "Pagar o cambiar la tarjeta" },
  }[l];
  return out(T.s, `<p style="${P}">${esc(T.hi)}</p>${H1(esc(T.s))}<p style="${P}">${esc(T.lead)}</p>${btn(o.payUrl, T.b)}${foot(l)}`);
}

/* ---------- proposal (with the invoice inside) ---------- */
export function proposalEmail(o: { lang: unknown; name: string; title: string; intro?: string | null; included: string[]; items: Any[]; cur: string; oneTime: number; monthly: number; validUntil: string | null; acceptUrl: string; rejectUrl: string; number: string }) {
  const l = L(o.lang), n = first(o.name);
  const T = {
    pt: { s: `Proposta Endeavor: ${o.title}`, hi: n ? `Olá, ${n}!` : "Olá!", lead: "Conforme conversamos, segue a sua proposta. A fatura já está pronta: ao aceitar, você paga na mesma página e o processo começa.", inc: "O que está incluso", inv: `Fatura ${o.number}`, today: "Total hoje", month: (d: string) => `Manutenção mensal: ${d}, cobrada a partir de 30 dias após o pagamento`, valid: "Válida até", acc: "Aceitar e pagar fatura", rej: "Rejeitar", how: "Ao clicar em Aceitar e pagar, você confere os termos, confirma com o seu nome e paga com segurança pelo Stripe." },
    en: { s: `Endeavor proposal: ${o.title}`, hi: n ? `Hi ${n},` : "Hi,", lead: "As discussed, here is your proposal. The invoice is ready: when you accept, you pay on the same page and we get started.", inc: "What's included", inv: `Invoice ${o.number}`, today: "Total today", month: (d: string) => `Monthly maintenance: ${d}, charged from 30 days after payment`, valid: "Valid until", acc: "Accept and pay invoice", rej: "Reject", how: "When you click Accept and pay, you review the terms, confirm with your name and pay securely through Stripe." },
    es: { s: `Propuesta Endeavor: ${o.title}`, hi: n ? `¡Hola, ${n}!` : "¡Hola!", lead: "Como conversamos, le enviamos su propuesta. La factura ya está lista: al aceptar, paga en la misma página y comenzamos.", inc: "Qué incluye", inv: `Factura ${o.number}`, today: "Total hoy", month: (d: string) => `Mantenimiento mensual: ${d}, cobrado desde 30 días después del pago`, valid: "Válida hasta", acc: "Aceptar y pagar factura", rej: "Rechazar", how: "Al hacer clic en Aceptar y pagar, revisa los términos, confirma con su nombre y paga de forma segura con Stripe." },
  }[l];
  const inner = `<p style="${P}">${esc(T.hi)}</p>${H1(esc(o.title))}<p style="${P}">${esc(T.lead)}</p>` +
    (o.intro ? `<p style="${P}">${esc(o.intro).replace(/\n/g, "<br>")}</p>` : "") +
    (o.included.length ? H2(esc(T.inc)) + `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${o.included.map((x) => `<tr><td valign="top" style="width:22px;padding:3px 0;color:#c9a24a;font:700 15px Arial,sans-serif">✓</td><td style="padding:3px 0;font:14px/1.5 Arial,sans-serif">${esc(x)}</td></tr>`).join("")}</table>` : "") +
    H2(esc(T.inv)) + box(`${itemsTable(o.items, o.cur, l)}<strong>${esc(T.today)}: ${esc(money(o.oneTime, o.cur, l))}</strong>${o.monthly ? `<br>${esc(T.month(money(o.monthly, o.cur, l)))}` : ""}${o.validUntil ? `<br><span style="color:#6b7280">${esc(T.valid)}: ${esc(dateL(o.validUntil, l))}</span>` : ""}`) +
    btn2(o.acceptUrl, T.acc) + btn2(o.rejectUrl, T.rej, true) + `<p style="margin:10px 0 0;font-size:13px;color:#4b5563">${esc(T.how)}</p><p style="margin:6px 0 0;font-size:13px;color:#4b5563">${esc(METHODS[l])}</p>` + foot(l);
  return out(T.s, inner);
}

/* ---------- opening documents ---------- */
export function intakeEmail(o: { lang: unknown; name: string; url: string; reminder?: boolean }) {
  const l = L(o.lang), n = first(o.name);
  const T = {
    pt: { s: o.reminder ? "Lembrete: documentos para a abertura da sua empresa" : "Próximo passo: informações e documentos para abrir a sua empresa", hi: n ? `Olá, ${n}!` : "Olá!",
      lead: "Para dar continuidade à abertura da sua empresa nos EUA, precisamos das informações abaixo. Cada item tem o seu botão: você responde e envia os arquivos numa página segura, e pode trocar ou excluir um arquivo depois.",
      items: [["Nomes da empresa", "Três opções de nome, em ordem de preferência (verificamos a disponibilidade no estado)."], ["Sócios", "Nome completo de cada sócio e a porcentagem de participação (o total deve dar 100%)."], ["Passaporte", "Cópia do passaporte de cada sócio (página com a foto)."], ["Comprovante de endereço", "Conta de luz, água, telefone ou extrato bancário recente, em nome de cada sócio."], ["Visto americano", "Cópia do visto, se o sócio tiver."]],
      b: "Enviar", all: "Abrir a página dos documentos", sec: "Os arquivos ficam guardados com acesso restrito, aparecem no seu portal em Documentos de abertura e são usados só para a abertura e as obrigações da empresa. Nunca pedimos números de documentos por e-mail ou WhatsApp." },
    en: { s: o.reminder ? "Reminder: documents to form your company" : "Next step: information and documents to form your company", hi: n ? `Hi ${n},` : "Hi,",
      lead: "To continue forming your US company, we need the information below. Each item has its own button: you answer and upload the files on a secure page, and you can replace or delete a file later.",
      items: [["Company names", "Three name options, in order of preference (we check availability with the state)."], ["Members", "Full name of each member and their ownership percentage (total must be 100%)."], ["Passport", "Copy of each member's passport (photo page)."], ["Proof of address", "Recent utility bill, phone bill or bank statement in each member's name."], ["US visa", "Copy of the visa, if the member has one."]],
      b: "Send", all: "Open the documents page", sec: "Files are stored with restricted access, appear in your portal under Opening documents and are used only for forming and maintaining the company. We never ask for document numbers by e-mail or WhatsApp." },
    es: { s: o.reminder ? "Recordatorio: documentos para constituir su empresa" : "Próximo paso: información y documentos para constituir su empresa", hi: n ? `¡Hola, ${n}!` : "¡Hola!",
      lead: "Para continuar con la constitución de su empresa en EE. UU., necesitamos la información de abajo. Cada ítem tiene su botón: responde y sube los archivos en una página segura, y puede cambiar o eliminar un archivo después.",
      items: [["Nombres de la empresa", "Tres opciones de nombre, en orden de preferencia (verificamos la disponibilidad en el estado)."], ["Socios", "Nombre completo de cada socio y su porcentaje de participación (el total debe ser 100%)."], ["Pasaporte", "Copia del pasaporte de cada socio (página con la foto)."], ["Comprobante de domicilio", "Factura de luz, agua, teléfono o extracto bancario reciente a nombre de cada socio."], ["Visa estadounidense", "Copia de la visa, si el socio la tiene."]],
      b: "Enviar", all: "Abrir la página de documentos", sec: "Los archivos se guardan con acceso restringido, aparecen en su portal en Documentos de constitución y se usan solo para constituir y mantener la empresa. Nunca pedimos números de documentos por correo o WhatsApp." },
  }[l];
  const anchors = ["names", "members", "passport", "address", "visa"];
  const rows = T.items.map((it: string[], i: number) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f5;font:14px/1.5 Arial,sans-serif"><strong>${esc(it[0])}</strong><br><span style="color:#4b5563">${esc(it[1])}</span></td><td style="padding:10px 0 10px 12px;border-bottom:1px solid #eef1f5;text-align:right;vertical-align:middle"><a href="${esc(o.url + "#" + anchors[i])}" style="display:inline-block;padding:9px 16px;border-radius:8px;background:#0b1f3a;color:#fff;font:700 13px Arial,sans-serif;text-decoration:none">${esc(T.b)}</a></td></tr>`).join("");
  const inner = `<p style="${P}">${esc(T.hi)}</p>${H1(esc(T.s))}<p style="${P}">${esc(T.lead)}</p><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 16px">${rows}</table>` + btn(o.url, T.all) + box(esc(T.sec), true) + foot(l);
  return out(T.s, inner);
}

/* ---------- ACH on the company's US account ---------- */
export function achEmail(o: { lang: unknown; name: string; url: string; monthly: number; cur: string }) {
  const l = L(o.lang), n = first(o.name);
  const T = {
    pt: { s: "Autorize a mensalidade pela conta da sua empresa", hi: n ? `Olá, ${n}!` : "Olá!", lead: `Agora que a conta bancária da empresa está aberta, a manutenção mensal${o.monthly ? ` (${money(o.monthly, o.cur, l)})` : ""} pode ser debitada direto dela, sem IOF e sem depender do cartão. É só conectar a conta e autorizar o débito (ACH). A partir da próxima cobrança, o débito sai da conta da empresa; mantenha saldo na data.`, b: "Conectar a conta e autorizar" },
    en: { s: "Authorize the monthly fee from your company account", hi: n ? `Hi ${n},` : "Hi,", lead: `Now that your company's bank account is open, the monthly maintenance${o.monthly ? ` (${money(o.monthly, o.cur, l)})` : ""} can be debited directly from it. Just connect the account and authorize the ACH debit. From the next charge on, it comes from the company account; keep funds available on the date.`, b: "Connect the account and authorize" },
    es: { s: "Autorice la mensualidad desde la cuenta de su empresa", hi: n ? `¡Hola, ${n}!` : "¡Hola!", lead: `Ahora que la cuenta bancaria de la empresa está abierta, el mantenimiento mensual${o.monthly ? ` (${money(o.monthly, o.cur, l)})` : ""} puede debitarse directamente de ella. Solo conecte la cuenta y autorice el débito (ACH). Desde el próximo cobro, sale de la cuenta de la empresa; mantenga saldo en la fecha.`, b: "Conectar la cuenta y autorizar" },
  }[l];
  return out(T.s, `<p style="${P}">${esc(T.hi)}</p>${H1(esc(T.s))}<p style="${P}">${esc(T.lead)}</p>${btn(o.url, T.b)}${foot(l)}`);
}

/* ---------- notices to the team ---------- */
export function teamEmail(title: string, lines: [string, string][], link?: { url: string; label: string }) {
  const inner = H1(esc(title)) + box(lines.filter((x) => x[1]).map(([k, v]) => `<strong>${esc(k)}:</strong> ${esc(v).replace(/\n/g, "<br>")}`).join("<br>")) + (link ? btn(link.url, link.label) : "");
  return out(title, inner);
}
