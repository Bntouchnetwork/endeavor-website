// Online store: the service cards on the home page and the upgrades in the client portal.
// The buyer fills name, company, e-mail and WhatsApp, pays in the embedded Stripe Checkout, and the account is created
// automatically: client + owner login + the contracted service. The access e-mail (create password, authenticator steps,
// portal link and "forgot my password") goes out right after the payment.
import { sendMail } from "./access-mail.ts";

type Any = any; // deno-lint-ignore no-explicit-any
export type StoreDeps = {
  admin: Any; SITE: string; PK: string;
  stripe: (method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, idem?: string) => Promise<Any>;
  Fail: new (code: string, status?: number, detail?: string) => Error;
  sendAccess: (email: string, page: string, lang: string, o: Any) => Promise<string>;
  syncInvoice: (inv: Any) => Promise<Any>;
};

export const PRODUCTS: Record<string, { pt: string; en: string; es: string }> = {
  crm: { pt: "CRM Endeavor", en: "Endeavor CRM", es: "CRM Endeavor" },
  agenda: { pt: "Agenda Online", en: "Online Scheduling", es: "Agenda en Línea" },
  esign: { pt: "Assinatura Eletrônica", en: "Electronic Signature", es: "Firma Electrónica" },
  bookkeeping: { pt: "Bookkeeping com IA", en: "AI Bookkeeping", es: "Bookkeeping con IA" },
  registered_agent: { pt: "Registered Agent", en: "Registered Agent", es: "Agente Registrado" },
  virtual_address: { pt: "Endereço Virtual", en: "Virtual Address", es: "Dirección Virtual" },
};
const L = (l: unknown) => (["pt", "en", "es"].includes(String(l)) ? String(l) as "pt" | "en" | "es" : "pt");
export const productName = (code: string, lang: string) => (PRODUCTS[code] || { pt: code, en: code, es: code })[L(lang)];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
async function sha(s: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); }

export function store(d: StoreDeps) {
  const { admin, stripe, Fail, SITE, PK } = d;

  async function product(code: string) {
    const { data: p } = await admin.from("store_products").select("*").eq("code", code).maybeSingle();
    if (!p || p.status === "hidden") throw new Fail("not_found", 404);
    if (p.status !== "active") throw new Fail("not_available", 409);
    return p;
  }

  /* start a purchase. Public (site) or by the owner of a client account in the portal (upgrade). */
  async function checkout(req: Request, body: Any, portal: { clientId: string; email: string; name: string; lang: string; customer: string | null } | null) {
    if (!PK) throw new Fail("stripe_not_configured", 503);
    const p = await product(clean(body.product, 40));
    const lang = L(portal ? portal.lang : body.lang);
    let o: Any;
    if (portal) {
      const { data: has } = await admin.rpc("client_has_service", { p_client: portal.clientId, p_code: p.code });
      if (has) throw new Fail("already_active", 409);
      o = { product_code: p.code, email: portal.email, name: portal.name || portal.email, lang, client_id: portal.clientId, source: "portal", amount_cents: p.price_cents };
    } else {
      const name = clean(body.name, 120), email = clean(body.email, 254).toLowerCase(), phone = clean(body.phone, 40), company = clean(body.company, 160);
      if (name.length < 2) throw new Fail("invalid_name");
      if (!EMAIL.test(email)) throw new Fail("invalid_email");
      if (!/^\+?[1-9][\d\s()-]{6,20}$/.test(phone)) throw new Fail("invalid_phone");
      if (company.length < 2) throw new Fail("invalid_company");
      if (body.terms !== true) throw new Fail("terms_required");
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
      const ipHash = (await sha("store:" + ip)).slice(0, 32), since = new Date(Date.now() - 36e5).toISOString();
      const [{ count: byMail }, { count: byIp }] = await Promise.all([
        admin.from("store_orders").select("id", { count: "exact", head: true }).ilike("email", email).gte("created_at", since),
        admin.from("store_orders").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since)]);
      if ((byMail ?? 0) >= 6 || (byIp ?? 0) >= 12) throw new Fail("too_many_attempts", 429);
      // an e-mail that already has this service: sign in instead of paying twice
      const { data: owners } = await admin.from("client_users").select("client_id").eq("role", "owner").neq("status", "revoked").ilike("email", email);
      for (const ow of owners ?? []) { const { data: has } = await admin.rpc("client_has_service", { p_client: ow.client_id, p_code: p.code }); if (has) throw new Fail("already_active", 409); }
      o = { product_code: p.code, email, name, phone, company, lang, source: "site", amount_cents: p.price_cents, ip_hash: ipHash };
    }
    const { data: order, error } = await admin.from("store_orders").insert(o).select("*").single();
    if (error) throw new Fail("db_error", 500, error.message);

    const label = productName(p.code, lang), recurring = p.interval !== "once";
    const meta = { order_id: order.id, product: p.code, store: "1" };
    const ret = portal ? `${SITE}/client.html?lang=${lang}#/servicos?order=${order.id}` : `${SITE}/comprar.html?lang=${lang}&o=${order.id}&session_id={CHECKOUT_SESSION_ID}`;
    const session = await stripe("POST", "/checkout/sessions", {
      ui_mode: "embedded", mode: recurring ? "subscription" : "payment",
      line_items: [{ quantity: 1, price_data: { currency: p.currency || "usd", unit_amount: p.price_cents, product_data: { name: `${label} · Endeavor Business Solutions`, metadata: { product: p.code } }, ...(recurring ? { recurring: { interval: p.interval } } : {}) } }],
      ...(portal?.customer ? { customer: portal.customer } : { customer_email: order.email }),
      metadata: meta, client_reference_id: order.id,
      ...(recurring ? { subscription_data: { metadata: meta, description: label } } : { payment_intent_data: { metadata: meta, description: label }, customer_creation: portal?.customer ? undefined : "always" }),
      locale: lang === "pt" ? "pt-BR" : lang, return_url: ret, redirect_on_completion: portal ? "if_required" : "always",
    }, "store-" + order.id);
    await admin.from("store_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return { client_secret: session.client_secret, publishable_key: PK, order_id: order.id, product: p.code, amount_cents: p.price_cents, interval: p.interval };
  }

  /* after the payment: the page asks for the status (the webhook does the same, whichever comes first) */
  async function status(body: Any) {
    const id = clean(body.order_id, 40), sid = clean(body.session_id, 200);
    const { data: o } = await admin.from("store_orders").select("*").eq("id", id).maybeSingle();
    if (!o || !o.stripe_session_id || (sid && sid !== o.stripe_session_id)) throw new Fail("not_found", 404);
    if (o.status !== "fulfilled") {
      const s = await stripe("GET", `/checkout/sessions/${o.stripe_session_id}`);
      if (s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required")) await fulfill(o.id, s);
      else if (s.status === "expired") await admin.from("store_orders").update({ status: "expired" }).eq("id", o.id).eq("status", "pending");
    }
    const { data: n } = await admin.from("store_orders").select("status, email, product_code, lang, error").eq("id", id).single();
    const [u, dom] = String(n.email).split("@");
    return { status: n.status, product: n.product_code, email_hint: u.slice(0, 2) + "•••@" + dom, failed: !!n.error && n.status !== "fulfilled" };
  }

  async function fulfill(orderId: string, s: Any) {
    // claim the order once (webhook and the page can arrive together)
    const { data: claimed } = await admin.from("store_orders").update({ status: "paid", stripe_subscription_id: s.subscription || null, stripe_customer_id: s.customer || null })
      .eq("id", orderId).eq("status", "pending").select("*").maybeSingle();
    if (!claimed) return;
    const o = claimed;
    try {
      let clientId: string | null = o.client_id, newAccount = false, ownerUserId: string | null = null;
      if (!clientId) {
        const { data: owners } = await admin.from("client_users").select("client_id, user_id, status").eq("role", "owner").neq("status", "revoked").ilike("email", o.email).limit(1);
        if (owners?.[0]) { clientId = owners[0].client_id; ownerUserId = owners[0].user_id; }
      }
      if (!clientId) {
        const { data: c, error } = await admin.from("clients").insert({ name: o.company || o.name, primary_email: o.email, phone: o.phone || null, language: o.lang, status: "active", portal_kind: "tools", stripe_customer_id: s.customer || null,
          notes: `Conta criada pela compra online (${productName(o.product_code, "pt")}).` }).select("id").single();
        if (error) throw new Error(error.message);
        clientId = c.id; newAccount = true;
        const { error: e2 } = await admin.from("client_users").insert({ client_id: clientId, email: o.email, name: o.name, role: "owner", can_view: true, can_upload: true });
        if (e2) throw new Error(e2.message);
      } else if (s.customer) {
        await admin.from("clients").update({ stripe_customer_id: s.customer }).eq("id", clientId).is("stripe_customer_id", null);
      }
      if (s.customer) { try { await stripe("POST", `/customers/${s.customer}`, { metadata: { client_id: clientId } }); } catch { /* metadata only */ } }
      // bookkeeping is done by Endeavor on a company of the client
      if (o.product_code === "bookkeeping") {
        const { data: cos } = await admin.from("companies").select("id, books_provider").eq("client_id", clientId).order("created_at").limit(1);
        if (cos?.[0]) await admin.from("companies").update({ books_provider: "endeavor", books_service: "active" }).eq("id", cos[0].id).neq("books_provider", "quickbooks");
        else await admin.from("companies").insert({ client_id: clientId, legal_name: (o.company || o.name).slice(0, 200), status: "active", stage: "approved", state: null, registered_agent: null, books_provider: "endeavor", books_service: "active" });
      }
      await admin.from("client_services").upsert({ client_id: clientId, product_code: o.product_code, status: "active", stripe_subscription_id: s.subscription || null, order_id: o.id, started_at: new Date().toISOString(), canceled_at: null }, { onConflict: "client_id,product_code" });
      await admin.from("store_orders").update({ status: "fulfilled", client_id: clientId, fulfilled_at: new Date().toISOString(), error: null }).eq("id", o.id);
      const amt = (o.amount_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
      await admin.from("admin_events").insert({ kind: "store_purchase", title: `Compra online: ${productName(o.product_code, "pt")} · ${amt}`, body: `${o.name} (${o.email})${o.company ? " · " + o.company : ""}${newAccount ? " · conta nova criada" : ""}`, link: "#/pagamentos?tab=loja" });
      // keep the first invoice in the client's history
      if (s.invoice) { try { await d.syncInvoice(await stripe("GET", `/invoices/${typeof s.invoice === "string" ? s.invoice : s.invoice.id}`)); } catch (e) { console.error("store invoice", e); } }
      // access: new account (or owner who never accepted the invite) gets the create-password e-mail; an active owner gets a short notice
      if (newAccount || !ownerUserId) await d.sendAccess(o.email, "client.html", o.lang, { kind: "store", name: o.name, services: [productName(o.product_code, o.lang)] });
      else await activatedMail(o);
    } catch (e) {
      console.error("store fulfill", orderId, e);
      await admin.from("store_orders").update({ status: "paid", error: String((e as Error).message || e).slice(0, 500) }).eq("id", orderId);
      await admin.from("admin_events").insert({ kind: "store_error", title: `Compra paga sem conta criada: ${o.email}`, body: String((e as Error).message || e).slice(0, 1500), link: "#/pagamentos?tab=loja" });
    }
  }

  async function activatedMail(o: Any) {
    const l = L(o.lang), name = productName(o.product_code, l), first = String(o.name || "").split(/\s+/)[0];
    const url = `${SITE}/client.html?lang=${l}`;
    const T = {
      pt: { s: `${name} ativado no seu portal`, h: `Olá, ${first}!`, b: `Recebemos o seu pagamento e o serviço ${name} já está liberado no seu Portal do Cliente.`, btn: "Abrir o portal" },
      en: { s: `${name} is active in your portal`, h: `Hello, ${first}!`, b: `We received your payment and ${name} is now available in your Client Portal.`, btn: "Open the portal" },
      es: { s: `${name} activado en su portal`, h: `¡Hola, ${first}!`, b: `Recibimos su pago y ${name} ya está disponible en su Portal del Cliente.`, btn: "Abrir el portal" },
    }[l];
    const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#1f2937;max-width:560px"><p>${T.h}</p><p>${T.b}</p><p><a href="${url}" style="display:inline-block;background:#0b1f3a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${T.btn}</a></p><p style="color:#6b7280;font-size:13px">Endeavor Business Solutions · support@endeavorbiz.com</p></div>`;
    await sendMail(o.email, T.s, html, `${T.h}\n\n${T.b}\n${url}`).catch((e) => console.error("activated mail", e));
  }

  async function subscriptionChanged(sub: Any) {
    const st = ["active", "trialing"].includes(sub.status) ? "active" : ["past_due", "unpaid"].includes(sub.status) ? "past_due" : ["canceled", "incomplete_expired"].includes(sub.status) ? "canceled" : null;
    if (!st || !sub.id) return;
    await admin.from("client_services").update({ status: st, canceled_at: st === "canceled" ? new Date().toISOString() : null }).eq("stripe_subscription_id", sub.id);
  }

  // the owner cancels a tool from the portal: the subscription ends at the end of the paid period
  async function cancel(clientId: string, code: string) {
    const { data: cs } = await admin.from("client_services").select("*").eq("client_id", clientId).eq("product_code", code).maybeSingle();
    if (!cs || cs.status === "canceled") throw new Fail("not_found", 404);
    if (cs.stripe_subscription_id) await stripe("POST", `/subscriptions/${cs.stripe_subscription_id}`, { cancel_at_period_end: true });
    else await admin.from("client_services").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", cs.id);
    await admin.from("admin_events").insert({ kind: "store_cancel", title: `Cancelamento pedido: ${productName(code, "pt")}`, body: `Cliente ${clientId}`, link: "#/pagamentos?tab=loja" });
    return { ok: true };
  }

  return { checkout, status, fulfill, subscriptionChanged, cancel };
}
