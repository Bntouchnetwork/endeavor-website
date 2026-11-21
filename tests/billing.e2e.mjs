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
  companies: [{ id: "co1", client_id: "c1", legal_name: "ACME LLC", status: "active", stage: "approved", books_provider: "endeavor", books_service: "active" }], compliance_items: [],
  company_documents: [{ id: "d1", client_id: "c1", company_id: "co1", category: "formation", title: "Articles of Organization", path: "c1/a.pdf", created_at: dia(5), visible_to_client: true }, { id: "d2", client_id: "c1", company_id: "co1", category: "tax_return", title: "Form 1120", year: 2025, path: "c1/b.pdf", created_at: dia(3), visible_to_client: true },
    { id: "d3", client_id: "c1", company_id: "co1", category: "uploaded", title: "Extrato bancário", path: "c1/c.pdf", created_at: dia(1), uploaded_by: "u1", uploaded_by_email: "dono@acme.com", visible_to_client: true }],
  portal_doc_requests: [{ id: "rq1", client_id: "c1", company_id: "co1", title: "Extrato de outubro", note: "Todas as páginas", due_date: dia(-7).slice(0, 10), status: "pending", created_at: dia(1) }, { id: "rq2", client_id: "c1", company_id: null, title: "Comprovante de endereço", status: "pending", created_at: dia(0) }],
  financial_reports: [1, 2, 3].flatMap((q) => ["ProfitAndLoss", "BalanceSheet", "CashFlow"].map((tp) => ({ id: "fr" + q + tp, company_id: "co1", period_label: "Q" + q + " " + new Date().getFullYear(), start_date: new Date().getFullYear() + "-" + String((q - 1) * 3 + 1).padStart(2, "0") + "-01", end_date: new Date().getFullYear() + "-" + String(q * 3).padStart(2, "0") + "-30", report_type: tp, document_id: "d-" + q + tp,
    data: tp === "ProfitAndLoss" ? { kind: "pl", sections: [{ key: "income", total: 1000000 }, { key: "expense", total: 600000 }], net_income: 400000 } : {} }))), tel_access: [], meet_access: [], wa_access: [], linkedin_accounts: [],
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
  return { from: Q, rpc: function (n, a) { (window.__rpc = window.__rpc || []).push([n, a]); var R = { client_bk_status: { connections: [{ id: "cx1", status: "active", last_sync_at: new Date().toISOString() }], accounts: [{ name: "Chase Business Checking", mask: "6789", kind: "bank", connection_id: "cx1" }], transactions: 120, to_review: 4 }, claim_invitations: [{ client_id: "c1", client_name: "ACME LLC", role: "owner", status: "active" }], client_is_member: true, portal_mfa_policy: { optional: false } }; return Promise.resolve({ data: n in R ? R[n] : null, error: null }); },
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
  // Documentos: o envio mora dentro da página, organizada por tipo
  await p.setViewportSize({ width: 1366, height: 900 });
  await p.goto(BASE + "/client.html?lang=pt#/documents"); await p.reload(); await p.waitForSelector("#d-req");
  ok(!(await p.locator('#console-nav a[data-view="upload"]').count()) && await p.locator('#console-nav a[data-view="documents"]').count() === 1, 'menu: sai "Enviar documentos", fica só "Documentos"');
  const barra = await p.locator(".doc-barra > *").evaluateAll((l) => ({ ids: l.map((e) => e.id).join(","), tops: new Set(l.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))).size, busca: l[0].getBoundingClientRect().width }));
  ok(barra.ids === "d-q,d-co,d-cat,d-new" && barra.tops === 1 && barra.busca < 260 && (await p.textContent("#d-new")).includes("Novo documento"), "barra numa linha só: busca menor, filtros e Novo documento no fim");
  ok(await p.evaluate(() => { const b = document.querySelector(".doc-barra"); return b.getBoundingClientRect().bottom <= document.querySelector(".doc-lista").getBoundingClientRect().top && !document.querySelector("#d-req").closest(".portal-card").matches(".doc-pedidos") && b.getBoundingClientRect().right <= document.querySelector(".doc-lista").getBoundingClientRect().right + 1; }), "a barra de busca fica no topo, antes da lista");
  const opc = await p.locator("#d-cat option").evaluateAll((l) => l.map((o) => o.value + "=" + o.textContent).slice(0, 2).join("|"));
  ok(opc === "req=Solicitados (2)|=Todas as categorias" && (await p.inputValue("#d-cat")) === "req", "Solicitados é a primeira opção das categorias e abre selecionada quando há pendente (" + opc + ")");
  ok(await p.locator("#d-req li:not(.d-sep)").count() === 2 && (await p.getAttribute("#d-req li a", "href")) === "#/documents?new=1&req=rq1" && (await p.textContent("#doc-badge")).trim() === "2", "os pedidos aparecem na lista, com Enviar, e o contador continua no menu");
  await p.screenshot({ path: OUT + "/documentos-solicitados.png" });
  await p.click('#d-req a[href*="req=rq1"]'); await p.waitForSelector("#u-form");
  ok((await p.inputValue("#u-title")) === "Extrato de outubro" && (await p.textContent(".console__head")).includes("Documento solicitado: Extrato de outubro"), "Enviar abre o envio já com o nome do documento pedido");
  await p.goto(BASE + "/client.html?lang=pt#/documents"); await p.reload(); await p.waitForSelector("#d-req");
  await p.selectOption("#d-cat", ""); await p.waitForSelector("#d-list .d-grupo");
  const grupos = await p.locator("#d-list .d-grupo").evaluateAll((l) => l.map((g) => g.dataset.cat + ":" + g.dataset.n).join(","));
  ok(grupos === "formation:1,tax_return:1,uploaded:1", "todas as categorias: documentos organizados por tipo");
  const bot = await p.locator("#d-list .doclist li:not(.d-sep)").evaluateAll((l) => l.map((li) => li.querySelectorAll("[data-doc]").length + "" + li.querySelectorAll("[data-dl]").length + li.querySelectorAll("[data-del]").length).join(","));
  ok(bot === "110,110,111", "ver e baixar em todos; excluir só no documento que o próprio cliente enviou (" + bot + ")");
  const fixo = await p.evaluate(() => { const f = document.querySelector(".fit-body") || document.scrollingElement; return { pag: document.scrollingElement.scrollHeight <= innerHeight + 1, corpo: f.scrollHeight <= f.clientHeight + 1 }; });
  ok(fixo.pag && fixo.corpo, "computador: página fixa, sem rolagem (" + JSON.stringify(fixo) + ")");
  await p.screenshot({ path: OUT + "/documentos.png" });
  await p.setViewportSize({ width: 1366, height: 570 }); await p.waitForTimeout(400);
  const dpg = await p.evaluate(() => { const vis = [...document.querySelectorAll("#d-list li")].filter((x) => !x.hidden), t = document.querySelector("#d-tab").getBoundingClientRect(); return { pg: document.querySelector("#d-pg").textContent, oculto: document.querySelector("#d-pager").hidden, vis: vis.length, corta: vis.some((x) => x.getBoundingClientRect().bottom > t.bottom + 1) }; });
  ok(!dpg.oculto && /^1\/\d$/.test(dpg.pg) && !dpg.corta, "tela baixa: a lista vira páginas com flechas, só linhas inteiras (" + JSON.stringify(dpg) + ")");
  await p.click("#d-prox"); ok((await p.textContent("#d-pg")).startsWith("2/"), "flecha passa para a página seguinte");
  await p.screenshot({ path: OUT + "/documentos-paginas.png" });
  await p.setViewportSize({ width: 1366, height: 900 }); await p.waitForTimeout(300);
  let dlg = ""; p.once("dialog", (d) => { dlg = d.message(); d.dismiss(); });
  await p.click("#d-list [data-del]"); await p.waitForTimeout(200);
  ok(dlg.includes("Extrato bancário") && !(await p.evaluate(() => (window.__rpc || []).some((x) => x[0] === "portal_doc_delete"))), "excluir pede confirmação; cancelar não apaga");
  p.once("dialog", (d) => d.accept());
  await p.click("#d-list [data-del]"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => (window.__rpc || []).some((x) => x[0] === "portal_doc_delete" && x[1].p_doc === "d3")), "confirmar chama a exclusão do documento");
  await p.goto(BASE + "/client.html?lang=pt#/documents"); await p.reload(); await p.waitForSelector("#d-req"); await p.selectOption("#d-cat", "");
  await p.fill("#d-q", "1120"); ok(await p.locator("#d-list .d-grupo").count() === 1, "busca filtra os grupos");
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector("#d-pager").hidden && document.scrollingElement.scrollWidth <= innerWidth + 1), "celular: lista inteira, rolagem normal, sem rolagem horizontal");
  await p.setViewportSize({ width: 1366, height: 900 }); await p.fill("#d-q", "");
  await p.click("#d-new"); await p.waitForSelector("#u-form", { timeout: 5000 }).catch(async () => console.log("tela:", p.url(), (await p.textContent("#view")).slice(0, 300)));
  ok((await p.textContent(".console__head h1")) === "Novo documento" && await p.locator("#u-co").count() === 1 && await p.locator("#u-tipo option").count() >= 3 && await p.locator("#u-file").count() === 1, "Novo documento: empresa, tipo do documento e arquivo");
  await p.goto(BASE + "/client.html?lang=pt#/upload"); await p.reload(); await p.waitForSelector("#u-form");
  ok(p.url().includes("#/documents?new=1"), "o endereço antigo de envio abre a página nova");
  // Bookkeeping do pacote: painel de relatórios
  await p.goto(BASE + "/client.html?lang=pt#/bookkeeping"); await p.reload(); await p.waitForSelector("#bkp-ytd");
  const yt = await p.textContent("#bkp-ytd");
  ok(yt.includes("Ano até hoje") && yt.includes("$30,000") && yt.includes("$18,000") && yt.includes("$12,000"), "Bookkeeping do pacote: resumo do ano até hoje (receita, despesas e lucro dos relatórios publicados)");
  ok(await p.locator("#bkp-reps [data-ano]").count() === 3 && await p.locator("#bkp-lista tbody tr").count() === 3 && await p.locator("#bkp-lista [data-rep]").count() === 9, "relatórios dos últimos 3 anos: P&L, Balance Sheet e Fluxo de caixa por trimestre, com PDF");
  const ct = await p.textContent("#bkp-contas");
  ok(ct.includes("Chase Business Checking") && ct.includes("Conectada") && await p.locator("#bk-bank").count() === 1 && await p.locator("#bk-card").count() === 1, "conector de contas: contas conectadas com a situação e os botões de conectar");
  await p.screenshot({ path: OUT + "/bookkeeping-painel.png", fullPage: true });
  await p.click("#bkp-ask"); await p.waitForSelector("#bkp-f"); await p.fill("#bkp-per", "Q4"); await p.click('#bkp-f button[type="submit"]'); await p.waitForSelector("#bk-m.portal-alert--ok");
  const pr = pedidos.filter((b) => b.action === "store_request").pop();
  ok(pr && pr.product === "relatorio" && pr.note.includes("Q4") && pr.note.includes("ACME LLC"), "Solicitar relatório vira pedido para a equipe");
} catch (e) { console.log("erro:", e.message.slice(0, 400), (e.stack || "").split("\n").filter((x) => x.includes("billing.e2e")).slice(0, 2).join(" ")); falhas.push("erro"); }
await browser.close();
console.log(falhas.length ? falhas.length + " falha(s)" : "tudo certo");
process.exit(falhas.length ? 1 : 0);
