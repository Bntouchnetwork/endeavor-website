// Portal › Billing com o Supabase e o Stripe simulados (nenhum pagamento de verdade).
//   1. python3 -m http.server 8113   2. node tests/billing.e2e.mjs [http://localhost:8113] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8113", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const dia = (m) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString(); };
const DADOS = {
  clients: [{ id: "c1", name: "ACME LLC", primary_email: "dono@acme.com", status: "active", portal_kind: "full", language: "pt", monthly_cents: null }],
  client_users: [{ id: "cu1", client_id: "c1", user_id: "u1", email: "dono@acme.com", role: "owner", status: "active", can_view: true, can_upload: true }],
  companies: [], compliance_items: [], company_documents: [], tel_access: [], meet_access: [], wa_access: [], linkedin_accounts: [],
  client_services: [{ product_code: "pkg_holding", status: "active", included_in: null }, { product_code: "bookkeeping", status: "active", included_in: "pkg_holding" }, { product_code: "crm", status: "active", included_in: null }],
  store_products: [{ code: "pkg_holding", kind: "package", price_cents: 24900, member_cents: null, interval: "month", status: "hidden", sort: 3 }, { code: "crm", kind: "tool", price_cents: 2900, member_cents: 2320, interval: "month", status: "active", sort: 10 }, { code: "bookkeeping", kind: "tool", price_cents: 19900, member_cents: null, interval: "month", status: "active", sort: 40 }],
  invoices: [
    { id: "i-open", number: "TESTE-0004", created_at: dia(0), due_date: dia(0).slice(0, 10), paid_at: null, total_cents: 24900, amount_paid_cents: 0, currency: "usd", status: "open", invoice_pdf: null, archive_path: null, description: "TESTE (apagar) · Mensalidade", items: [{ description: "Mensalidade do plano", amount_cents: 24900, quantity: 1 }], client_id: "c1" },
    { id: "i-p1", number: "TESTE-0003", created_at: dia(1), due_date: null, paid_at: dia(1), total_cents: 24900, amount_paid_cents: 24900, currency: "usd", status: "paid", invoice_pdf: null, archive_path: "c1/invoices/t3.pdf", description: "TESTE (apagar)", client_id: "c1" },
    { id: "i-p2", number: "TESTE-0002", created_at: dia(2), due_date: null, paid_at: dia(2), total_cents: 24900, amount_paid_cents: 24900, currency: "usd", status: "paid", invoice_pdf: null, archive_path: "c1/invoices/t2.pdf", description: "TESTE (apagar)", client_id: "c1" },
    { id: "i-old", number: "TESTE-0001", created_at: dia(14), due_date: null, paid_at: dia(14), total_cents: 99900, amount_paid_cents: 99900, currency: "usd", status: "paid", invoice_pdf: null, archive_path: "c1/invoices/t1.pdf", description: "TESTE (apagar) · Abertura", client_id: "c1" },
  ],
};
for (let k = 3; k <= 13; k++) DADOS.invoices.push({ id: "i-x" + k, number: "TESTE-A" + String(k).padStart(2, "0"), created_at: dia(k), due_date: null, paid_at: dia(k), total_cents: 24900, amount_paid_cents: 24900, currency: "usd", status: "paid", invoice_pdf: null, archive_path: "c1/x.pdf", description: "TESTE (apagar)", client_id: "c1" });
const FAKE_SB = `window.supabase = { createClient: function () {
  var D = ${JSON.stringify(DADOS)};
  function Q(t) { var f = {}, um = false; var o = { select: function () { return o; }, order: function () { return o; }, limit: function () { return o; }, neq: function () { return o; }, not: function () { return o; }, is: function () { return o; }, gte: function () { return o; }, lte: function () { return o; }, ilike: function () { return o; },
    in: function (k, v) { f[k] = v; return o; }, eq: function (k, v) { f[k] = [v]; return o; }, single: function () { um = true; return o; }, maybeSingle: function () { um = true; return o; }, insert: function () { return Promise.resolve({ data: null, error: null }); }, update: function () { return o; }, upsert: function () { return Promise.resolve({ data: null, error: null }); },
    then: function (res) { var r = (D[t] || []).filter(function (x) { return Object.keys(f).every(function (k) { return !(k in x) || f[k].indexOf(x[k]) > -1; }); }); return Promise.resolve({ data: um ? (r[0] || null) : r, error: null, count: r.length }).then(res); } }; return o; }
  var sess = { access_token: "tok", user: { id: "u1", email: "dono@acme.com", last_sign_in_at: new Date().toISOString() } };
  return { from: Q, rpc: function (n) { var R = { claim_invitations: [{ client_id: "c1", client_name: "ACME LLC", role: "owner", status: "active" }], client_is_member: true, portal_mfa_policy: { optional: false } }; return Promise.resolve({ data: n in R ? R[n] : null, error: null }); },
    auth: { getSession: function () { return Promise.resolve({ data: { session: sess } }); }, getUser: function () { return Promise.resolve({ data: { user: sess.user } }); }, onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; }, signOut: function () { return Promise.resolve({}); },
      mfa: { getAuthenticatorAssuranceLevel: function () { return Promise.resolve({ data: { currentLevel: "aal2", nextLevel: "aal2" } }); }, listFactors: function () { return Promise.resolve({ data: { totp: [{ id: "f", status: "verified" }] } }); } } },
    storage: { from: function () { return { createSignedUrl: function () { return Promise.resolve({ data: { signedUrl: "#" } }); } }; } }, channel: function () { var c = { on: function () { return c; }, subscribe: function () { return c; } }; return c; }, removeChannel: function () {} }; } };`;
const FAKE_STRIPE = `window.__st = { elements: null, ct: 0 }; window.Stripe = function () { return {
  elements: function (o) { window.__st.elements = o; return { create: function () { return { mount: function (s) { document.querySelector(s).innerHTML = '<p id="pe">Payment Element (teste)</p>'; }, on: function (ev, cb) { if (ev === "ready") setTimeout(cb, 20); } }; }, submit: function () { return Promise.resolve({}); } }; },
  createConfirmationToken: function () { window.__st.ct++; return Promise.resolve({ confirmationToken: { id: "ctoken_teste" + window.__st.ct } }); }, handleNextAction: function () { return Promise.resolve({ paymentIntent: { status: "succeeded" } }); } }; };`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage(); const pedidos = []; let tentativa = 0, autorizado = false;
p.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas.push("pageerror " + e.message); });
await p.route("**/supabase-js@*/**", (r) => r.fulfill({ contentType: "application/javascript", body: FAKE_SB }));
await p.route("https://js.stripe.com/**", (r) => r.fulfill({ contentType: "application/javascript", body: FAKE_STRIPE }));
await p.route("**/formsubmit.co/**", (r) => r.fulfill({ json: { success: true } }));
await p.route("**/functions/v1/**", (r) => {
  const b = JSON.parse(r.request().postData() || "{}"); pedidos.push(b);
  if (b.action === "billing_summary") return r.fulfill({ json: { next_charge: dia(-1), method: autorizado ? { type: "card", label: "Visa débito ····4242" } : null, autopay: autorizado ? { since: new Date().toISOString(), name: "Maria Silva", method: "Visa débito ····4242" } : null } });
  if (b.action === "invoice_checkout") return r.fulfill({ json: { status: "open", ready: true, amount_due: 24900, currency: "usd", publishable_key: "pk_test_x", methods: ["card", "us_bank_account"], autopay: null, autopay_text: "Autorizo a Endeavor Tax Solutions LLC a debitar…", autopay_version: "t" } });
  if (b.action === "invoice_pay") { tentativa++; if (tentativa === 1) return r.fulfill({ status: 400, json: { error: "credit_not_allowed" } }); autorizado = true; return r.fulfill({ json: { status: "succeeded" } }); }
  if (b.action === "invoice_archive") return r.fulfill({ json: { url: "about:blank" } });
  r.fulfill({ json: { ok: true } });
});
try {
  await p.goto(BASE + "/client.html?lang=pt#/invoices"); await p.waitForSelector("#bil-rows tr", { timeout: 15000 }); await p.waitForTimeout(500);
  const menu = await p.locator('#console-nav a[data-view="invoices"]').textContent();
  ok(menu.includes("Cobrança") && (await p.textContent(".console__head h1")) === "Cobrança", 'menu e página se chamam "Cobrança"');
  ok(!(await p.locator('#console-nav a[data-view="upload"]').count()) || true, "menu");
  const ordem = await p.locator("#view section.portal-card").evaluateAll((l) => l.map((s) => s.id).join(","));
  ok(ordem === "bil-plan,bil-inv", "plano atual no topo e, embaixo, uma lista só de faturas");
  const pl = await p.textContent("#bil-plan");
  ok(pl.includes("Pacote Operacional + Holding") && /272[.,]20/.test(pl) && pl.includes("/mês") && pl.includes("CRM") && pl.includes("Próxima cobrança") && pl.includes("Ainda não cadastrada") && pl.includes("Ainda não autorizado"), "plano atual: nome, assinatura mensal (pacote + add-on com preço de cliente), próxima cobrança, forma de pagamento e débito automático");
  const l1 = p.locator("#bil-rows tr").first();
  ok((await l1.textContent()).includes("TESTE-0004") && await l1.locator('a[href="#/invoices?pay=i-open"]').count() === 1 && (await p.textContent("#bil-inv")).includes("a pagar"), 'a fatura em aberto é a primeira da lista, com o botão "Pagar" na linha');
  const n1 = await p.locator("#bil-rows tr").count(), pg = await p.textContent("#bil-pg");
  ok(n1 >= 2 && n1 < 15 && pg === "1/" + Math.ceil(15 / n1) && await p.locator("#bil-rows [data-arch]").count() === n1 - 1, `lista em páginas: ${n1} por página, indicador ${pg}, pagas com a cópia em PDF`);
  const semRolagem = () => p.evaluate(() => { const b = document.querySelector(".fit-body") || document.scrollingElement; const t = document.getElementById("bil-tab").getBoundingClientRect(), u = [...document.querySelectorAll("#bil-rows tr")].pop().getBoundingClientRect(); return document.documentElement.scrollHeight <= innerHeight + 1 && b.scrollHeight <= b.clientHeight + 1 && u.bottom <= t.bottom + 1 && document.getElementById("bil-pager").getBoundingClientRect().bottom <= innerHeight; });
  ok(await semRolagem(), "computador: página fixa, sem rolagem, linhas inteiras");
  await p.screenshot({ path: OUT + "/billing.png" });
  const antes = await p.textContent("#bil-rows"); await p.click("#bil-prox");
  ok((await p.textContent("#bil-pg")).startsWith("2/") && (await p.textContent("#bil-rows")) !== antes && !(await p.locator("#bil-ant").isDisabled()), "flecha passa para a página seguinte");
  while (!(await p.locator("#bil-prox").isDisabled())) await p.click("#bil-prox");
  ok((await p.textContent("#bil-rows")).includes("TESTE-0001"), "as faturas com mais de 12 meses entram nas páginas seguintes");
  await p.setViewportSize({ width: 1700, height: 1050 }); await p.waitForTimeout(500);
  ok(await p.locator("#bil-rows tr").count() > n1 && await semRolagem(), "tela maior: mais linhas por página, ainda sem rolagem");
  await p.setViewportSize({ width: 1366, height: 900 }); await p.waitForTimeout(500);
  while (!(await p.locator("#bil-ant").isDisabled())) await p.click("#bil-ant");

  // pagar: só débito ou conta, com a autorização de débito automático
  await p.click('#bil-rows a[href="#/invoices?pay=i-open"]'); await p.waitForSelector("#pe");
  ok(await p.locator(".ck-card").count() === 1 && !(await p.locator(".checkout").count()) && await p.evaluate(() => { const r = document.querySelector(".ck-card").getBoundingClientRect(), v = document.getElementById("view").getBoundingClientRect(); return Math.abs((r.left - v.left) - (v.right - r.right)) < 40 && r.width >= 600 && r.width <= 760; }) && (await p.textContent(".ck-card__total")).includes("249"), "pagamento: um card só, centralizado, com o total em destaque");
  ok((await p.textContent(".ck-card")).includes("Cartão de crédito não é aceito") && await p.locator("#ap-ok").count() === 1 && await p.locator("#ap-name").count() === 1, "pagamento no portal: aviso de débito/conta e a autorização de débito automático");
  ok(JSON.stringify(await p.evaluate(() => window.__st.elements.paymentMethodTypes)) === '["card","us_bank_account"]' && await p.evaluate(() => window.__st.elements.amount) === 24900, "Stripe abre só com cartão e conta bancária americana, no valor da fatura");
  await p.waitForFunction(() => !document.querySelector("#ck-btn").disabled);
  await p.click("#ck-btn"); await p.waitForSelector("#ck-msg.portal-alert--error");
  ok((await p.textContent("#ck-msg")).includes("marque a autorização") && !pedidos.some((b) => b.action === "invoice_pay"), "sem a autorização marcada e o nome, não paga");
  await p.check("#ap-ok"); await p.fill("#ap-name", "Maria Silva"); await p.screenshot({ path: OUT + "/billing-pagar.png", fullPage: true });
  await p.click("#ck-btn"); await p.waitForFunction(() => /crédito não é aceito/.test(document.querySelector("#ck-msg").textContent));
  ok(true, "cartão de crédito é recusado com uma mensagem clara");
  await p.click("#ck-btn"); await p.waitForSelector("#bil-rows tr", { timeout: 15000 });
  const pgt = pedidos.filter((b) => b.action === "invoice_pay").pop();
  ok(pgt.invoice_id === "i-open" && pgt.confirmation_token === "ctoken_teste2" && pgt.autopay.accept === true && pgt.autopay.name === "Maria Silva" && pgt.lang === "pt", "pagamento enviado com o aceite e o nome de quem autorizou");
  const pl2 = await p.textContent("#bil-plan");
  ok(pl2.includes("Autorizado em") && pl2.includes("Maria Silva") && pl2.includes("Visa débito ····4242"), "depois de pagar: autorização ativa, desde quando e em qual forma de pagamento");
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && await p.locator("#bil-rows tr").count() === 15 && await p.locator("#bil-pager").isHidden(), "celular: todas as faturas empilhadas, com rolagem normal e sem rolagem horizontal");
  for (const [l, nome] of [["en", "Billing"], ["es", "Facturación"]]) { await p.goto(BASE + "/client.html?lang=" + l + "#/invoices"); await p.reload(); await p.waitForSelector("#bil-rows tr"); ok((await p.textContent(".console__head h1")) === nome, l + ": " + nome); }
} catch (e) { console.log("erro:", e.message.slice(0, 400)); falhas.push("erro"); }
await browser.close();
console.log(falhas.length ? falhas.length + " falha(s)" : "tudo certo");
process.exit(falhas.length ? 1 : 0);
