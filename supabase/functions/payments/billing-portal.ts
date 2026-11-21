// Portal › Billing: pagamento de fatura só por conta bancária americana (ACH) ou cartão de débito, com a autorização de
// débito automático registrada no primeiro pagamento, e o resumo do plano (próxima cobrança e forma de pagamento).
// As regras de decisão ficam em funções puras, testadas em tests/billing-portal.test.ts.
// deno-lint-ignore-file no-explicit-any
type Any = any;

/** Texto da autorização. RASCUNHO: precisa da revisão de um advogado antes de valer para clientes de verdade. */
export const AUTOPAY_VERSION = "2026-11-20-rascunho";
export const AUTOPAY_TEXT: Record<string, string> = {
  en: "I authorize Endeavor Tax Solutions LLC, d/b/a Endeavor Business Hub, to charge the payment method I provide today (U.S. bank account or debit card) for this invoice and, automatically, for the recurring monthly charges of my plan and the services I add, on their due dates, until I cancel this authorization in writing at support@endeavorbiz.com at least 3 business days before the next charge. I confirm that I am authorized to use this account or card.",
  pt: "Autorizo a Endeavor Tax Solutions LLC, d/b/a Endeavor Business Hub, a debitar da forma de pagamento que informo hoje (conta bancária americana ou cartão de débito) o valor desta fatura e, automaticamente, as cobranças mensais recorrentes do meu plano e dos serviços que eu adicionar, nas datas de vencimento, até que eu cancele esta autorização por escrito em support@endeavorbiz.com com pelo menos 3 dias úteis de antecedência da próxima cobrança. Confirmo que tenho autorização para usar esta conta ou cartão.",
  es: "Autorizo a Endeavor Tax Solutions LLC, d/b/a Endeavor Business Hub, a debitar del medio de pago que informo hoy (cuenta bancaria de EE. UU. o tarjeta de débito) el valor de esta factura y, automáticamente, los cargos mensuales recurrentes de mi plan y de los servicios que agregue, en sus fechas de vencimiento, hasta que cancele esta autorización por escrito en support@endeavorbiz.com con al menos 3 días hábiles de anticipación al próximo cargo. Confirmo que tengo autorización para usar esta cuenta o tarjeta.",
};
export const autopayLang = (l: unknown) => (l === "pt" || l === "es" ? l : "en");

/** Só conta bancária americana ou cartão de débito. Crédito, pré-pago e cartão sem tipo identificado são recusados. */
export function metodoAceito(preview: Any): { ok: true; type: "card" | "us_bank_account"; label: string } | { ok: false; code: string } {
  const t = preview?.type;
  if (t === "us_bank_account") return { ok: true, type: t, label: `${preview.us_bank_account?.bank_name || "Bank"} ····${preview.us_bank_account?.last4 || ""}`.slice(0, 120) };
  if (t === "card") {
    const c = preview.card || {};
    if (c.funding !== "debit") return { ok: false, code: c.funding === "credit" ? "credit_not_allowed" : "debit_only" };
    return { ok: true, type: t, label: `${String(c.brand || "card").replace(/^./, (x: string) => x.toUpperCase())} débito ····${c.last4 || ""}`.slice(0, 120) };
  }
  return { ok: false, code: "method_not_allowed" };
}
/** Aceite da autorização: caixa marcada e nome completo (nome e sobrenome). */
export function aceiteValido(a: Any): string | null {
  const nome = String(a?.name || "").trim().replace(/\s+/g, " ");
  return a?.accept === true && nome.length >= 5 && nome.length <= 200 && /\S+\s+\S+/.test(nome) ? nome : null;
}
export function rotuloMetodo(pm: Any): { type: string; label: string } | null {
  if (!pm || typeof pm !== "object") return null;
  if (pm.type === "us_bank_account") return { type: pm.type, label: `${pm.us_bank_account?.bank_name || "Bank"} ····${pm.us_bank_account?.last4 || ""}` };
  if (pm.type === "card") return { type: pm.type, label: `${String(pm.card?.brand || "card").replace(/^./, (x: string) => x.toUpperCase())}${pm.card?.funding === "debit" ? " débito" : ""} ····${pm.card?.last4 || ""}` };
  return { type: String(pm.type || ""), label: String(pm.type || "") };
}

export function billingPortal(d: {
  admin: Any; stripe: (m: "GET" | "POST" | "DELETE", p: string, b?: Record<string, unknown>, idem?: string) => Promise<Any>;
  Fail: new (code: string, status?: number, detail?: string) => Error; bell: (k: string, t: string, b: string | null, l: string) => Promise<void>;
  syncInvoice: (inv: Any) => Promise<Any>; PK: string;
}) {
  const { admin, stripe, Fail, bell } = d;
  const authOf = async (clientId: string) => (await admin.from("billing_authorizations").select("id, created_at, signer_name, method_type, method_label, method_saved").eq("client_id", clientId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;

  /** Dados para abrir o pagamento no portal. Não devolve o segredo do pagamento: a confirmação é feita aqui, depois da conferência. */
  async function checkout(row: Any, lang: string) {
    const inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`, { expand: ["payment_intent"] });
    await d.syncInvoice(inv);
    const base = { status: inv.status, invoice_pdf: inv.invoice_pdf || null, amount_due: inv.amount_due, currency: inv.currency };
    if (inv.status !== "open" || !inv.payment_intent?.id || !d.PK) return base;
    // a fatura só aceita cartão e conta bancária americana (o tipo do cartão é conferido na hora de pagar)
    try { await stripe("POST", `/invoices/${row.stripe_invoice_id}`, { payment_settings: { payment_method_types: ["card", "us_bank_account"] } }); } catch { /* segue: a conferência abaixo continua valendo */ }
    const a = await authOf(row.client_id);
    return { ...base, ready: true, publishable_key: d.PK, methods: ["card", "us_bank_account"], autopay: a ? { since: a.created_at, name: a.signer_name, method: a.method_label } : null,
      autopay_text: AUTOPAY_TEXT[autopayLang(lang)], autopay_version: AUTOPAY_VERSION };
  }

  /** Confere a forma de pagamento (só débito ou conta), registra a autorização e confirma o pagamento da fatura. */
  async function pay(row: Any, body: Any, who: { email: string; userId: string | null }, req: Request) {
    const ctId = String(body.confirmation_token || "");
    if (!/^ctoken_[A-Za-z0-9]+$/.test(ctId)) throw new Fail("bad_request", 400);
    const inv = await stripe("GET", `/invoices/${row.stripe_invoice_id}`, { expand: ["payment_intent"] });
    const pi = inv.payment_intent;
    if (inv.status === "paid") return { status: "succeeded" };
    if (inv.status !== "open" || !pi?.id) throw new Fail("not_payable", 409);
    const ct = await stripe("GET", `/confirmation_tokens/${ctId}`);
    const m = metodoAceito(ct.payment_method_preview);
    if (!m.ok) throw new Fail(m.code, 400);
    const atual = await authOf(row.client_id);
    const nome = atual ? null : aceiteValido(body.autopay);
    if (!atual && !nome) throw new Fail("autopay_required", 400);
    const lang = autopayLang(body.lang);
    const ret = String(body.return_url || "");
    const conf = (salvar: boolean) => stripe("POST", `/payment_intents/${pi.id}/confirm`, { confirmation_token: ctId, ...(ret.startsWith("https://") ? { return_url: ret } : {}),
      ...(salvar ? { payment_method_options: { [m.type]: { setup_future_usage: "off_session" } } } : {}) });
    // guarda a forma de pagamento para as próximas cobranças; se o Stripe não aceitar guardar nesta fatura, o pagamento segue mesmo assim
    let salvo = true, r: Any;
    try { r = await conf(true); } catch (e) { if (!/setup_future_usage|payment_method_options/i.test(String((e as Any).detail || (e as Error).message))) throw e; salvo = false; r = await conf(false); }
    const st = String(r.status || "");
    if (!["succeeded", "processing", "requires_action"].includes(st)) throw new Fail("payment_failed", 402, r.last_payment_error?.message || st);
    const pmId = typeof r.payment_method === "string" ? r.payment_method : r.payment_method?.id || null;
    if (nome) {
      await admin.from("billing_authorizations").insert({ client_id: row.client_id, user_id: who.userId, user_email: who.email, signer_name: nome, text_version: AUTOPAY_VERSION, consent_text: AUTOPAY_TEXT[lang], language: lang,
        method_type: m.type, method_label: m.label, stripe_payment_method_id: pmId, method_saved: salvo, invoice_id: row.id, payment_status: st,
        ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null, user_agent: (req.headers.get("user-agent") || "").slice(0, 500) || null });
      await bell("autopay_authorized", "Débito automático autorizado pelo portal", `${nome} (${who.email}) · ${m.label}${salvo ? "" : " · a forma de pagamento NÃO ficou guardada no Stripe; conferir"}`, "#/clientes?id=" + row.client_id);
    }
    if (salvo && pmId && st !== "requires_action") {
      try {
        await stripe("POST", `/customers/${inv.customer}`, { invoice_settings: { default_payment_method: pmId } });
        const { data: cl } = await admin.from("clients").select("stripe_subscription_id").eq("id", row.client_id).single();
        if (cl?.stripe_subscription_id) await stripe("POST", `/subscriptions/${cl.stripe_subscription_id}`, { default_payment_method: pmId });
      } catch (e) { console.error("autopay default pm", (e as Error).message); }
    }
    if (st !== "requires_action") { try { await d.syncInvoice(await stripe("GET", `/invoices/${row.stripe_invoice_id}`)); } catch { /* o webhook atualiza */ } }
    return { status: st, client_secret: st === "requires_action" ? r.client_secret : undefined };
  }

  /** Próxima cobrança, forma de pagamento cadastrada (só os 4 últimos dígitos) e a autorização ativa. */
  async function summary(clientId: string) {
    const { data: cl } = await admin.from("clients").select("stripe_customer_id, stripe_subscription_id").eq("id", clientId).single();
    const { data: svc } = await admin.from("client_services").select("stripe_subscription_id").eq("client_id", clientId).neq("status", "canceled").not("stripe_subscription_id", "is", null).limit(1).maybeSingle();
    const out: Any = { next_charge: null, method: null, autopay: null };
    const a = await authOf(clientId);
    if (a) out.autopay = { since: a.created_at, name: a.signer_name, method: a.method_label };
    const subId = cl?.stripe_subscription_id || svc?.stripe_subscription_id;
    try {
      if (subId) {
        const s = await stripe("GET", `/subscriptions/${subId}`, { expand: ["default_payment_method"] });
        if (["active", "trialing", "past_due"].includes(s.status) && !s.cancel_at_period_end && s.current_period_end) out.next_charge = new Date(s.current_period_end * 1000).toISOString();
        out.method = rotuloMetodo(s.default_payment_method);
      }
      if (!out.method && cl?.stripe_customer_id) {
        const c = await stripe("GET", `/customers/${cl.stripe_customer_id}`, { expand: ["invoice_settings.default_payment_method"] });
        out.method = rotuloMetodo(c.invoice_settings?.default_payment_method);
      }
    } catch (e) { console.error("billing summary", (e as Error).message); }
    if (!out.method && a?.method_label) out.method = { type: a.method_type, label: a.method_label };
    return out;
  }
  return { checkout, pay, summary };
}
