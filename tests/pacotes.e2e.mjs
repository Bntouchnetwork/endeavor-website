// Pacotes de abertura no site e página Add-ons do portal, com o Supabase e o Stripe simulados.
//   1. python3 -m http.server 8093   2. node tests/pacotes.e2e.mjs [http://localhost:8093] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8093", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

const CAT = [
  { code: "pkg_essencial", kind: "package", price_cents: 5900, setup_cents: 99900, member_cents: null, category: "empresa", interval: "month", status: "active", sort: 1 },
  { code: "pkg_completo", kind: "package", price_cents: 19900, setup_cents: 149700, member_cents: null, category: "empresa", interval: "month", status: "active", sort: 2 },
  { code: "crm", kind: "tool", price_cents: 2900, setup_cents: 0, member_cents: 2300, category: "vendas", interval: "month", status: "active", sort: 10 },
  { code: "agenda", kind: "tool", price_cents: 1900, setup_cents: 0, member_cents: 1500, category: "vendas", interval: "month", status: "active", sort: 20 },
  { code: "esign", kind: "tool", price_cents: 1900, setup_cents: 0, member_cents: 1500, category: "documentos", interval: "month", status: "active", sort: 30 },
  { code: "bookkeeping", kind: "tool", price_cents: 19900, setup_cents: 0, member_cents: null, category: "financeiro", interval: "month", status: "active", sort: 40 },
  { code: "operating_agreement", kind: "addon", price_cents: 29700, setup_cents: 0, member_cents: null, category: "documentos", interval: "once", status: "active", sort: 45 },
  { code: "telefone", kind: "tool", price_cents: 1999, setup_cents: 0, member_cents: null, category: "comunicacao", interval: "month", status: "active", sort: 46 },
  { code: "registered_agent", kind: "tool", price_cents: 14900, setup_cents: 0, member_cents: null, category: "empresa", interval: "year", status: "coming_soon", sort: 50 },
  { code: "virtual_address", kind: "tool", price_cents: 4900, setup_cents: 0, member_cents: null, category: "empresa", interval: "month", status: "coming_soon", sort: 60 },
];
const pedidos = [];
const FAKE_STRIPE = "window.Stripe = function () { return { initEmbeddedCheckout: async function () { return { mount: function (el) { document.querySelector(el).innerHTML = '<p id=\"stripe-ok\">Stripe (teste)</p>'; }, destroy: function () {} }; } }; };";

const browser = await chromium.launch();
async function pagina(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas.push("pageerror " + e.message); });
  await page.route("**/rest/v1/store_products*", (r) => r.fulfill({ json: CAT }));
  await page.route("**/functions/v1/payments", async (r) => {
    const b = JSON.parse(r.request().postData() || "{}"); pedidos.push(b);
    await r.fulfill({ json: { client_secret: "cs_test", publishable_key: "pk_test_x", order_id: "o1", product: b.product } });
  });
  await page.route("https://js.stripe.com/**", (r) => r.fulfill({ contentType: "application/javascript", body: FAKE_STRIPE }));
  await page.route("**/rest/v1/rpc/submit_lead", (r) => r.fulfill({ json: null }));
  return page;
}
async function preencher(page) {
  await page.fill("#b-name", "Maria Teste"); await page.fill("#b-company", "ACME LLC"); await page.fill("#b-email", "maria@example.com");
  await page.fill("#b-phone", "4075550123"); await page.check("#b-terms");
  await page.click("#b-go"); await page.waitForSelector("#stripe-ok");
}
const money = async (page, sel) => (await page.textContent(sel)).trim();

try {
  /* ---------- home: três cards ---------- */
  const home = await pagina();
  await home.goto(`${BASE}/index.html?lang=pt`);
  await home.waitForSelector(".pkgs__grid");
  await home.waitForTimeout(800);
  const txt = await home.textContent(".pkgs");
  ok(txt.includes("Essencial") && txt.includes("Completo") && txt.includes("Operacional + Holding"), "home PT: três pacotes");
  ok(txt.includes("$999") && txt.includes("$1,497") && txt.includes("$199"), "home: preços dos pacotes vindos do catálogo");
  ok(txt.includes("Portal do Cliente para gerenciar a sua empresa"), "home: os cards citam o Portal do Cliente");
  ok(txt.includes("Pedir orçamento") && !/\$3,?500/.test(txt), "holding: pedir orçamento, sem preço");
  ok(!(await home.locator('.shop-card[data-product="formation"]').count()), "abertura sozinha não é vendida");
  await home.locator(".pkgs").screenshot({ path: OUT + "/pacotes-home.png" });
  await home.click('[data-product="pkg_holding"] .shop-card__cta');
  ok(await home.inputValue("#f-assist") === "Operating LLC + Holding", "holding: abre o contato com o tipo já escolhido (vira lead no CRM)");

  /* ---------- Essencial: dois "sim" e troca para o Completo ---------- */
  const p1 = await pagina();
  await p1.goto(`${BASE}/comprar.html?p=pkg_essencial&lang=pt`);
  await p1.waitForSelector("[name=socios]");
  ok(await money(p1, "#cart-today") === "$1,058" && await money(p1, "#cart-month") === "$59/mês", "carrinho: hoje $1,058 (abertura + 1º mês) e $59/mês");
  await p1.check("[name=socios][value=multi]"); await p1.click("#pk-next");
  await p1.waitForSelector(".pk-addon");
  ok((await p1.textContent(".pk-count")).includes("1 de 3") && (await p1.textContent(".pk-addon h2")).includes("Operating Agreement"), "upsell: 1º Operating Agreement");
  ok(await p1.locator("#pk-skip").isVisible(), "upsell: 'Pular e finalizar' visível");
  await p1.screenshot({ path: OUT + "/pacotes-upsell.png", fullPage: true });
  await p1.click("#pk-add");
  ok(await money(p1, "#cart-today") === "$1,355", "OA soma $297 no hoje");
  ok((await p1.textContent(".pk-addon h2")).includes("Bookkeeping"), "upsell: 2º bookkeeping");
  await p1.click("#pk-add");
  await p1.waitForSelector(".pk-offer");
  ok(await money(p1, "#cart-month") === "$258/mês", "bookkeeping soma na mensalidade");
  ok((await p1.textContent(".pk-offer")).includes("$507"), "depois de dois sim: oferece o Completo com a economia do 1º ano ($507)");
  await p1.screenshot({ path: OUT + "/pacotes-oferta.png", fullPage: true });
  await p1.click("#pk-switch");
  await p1.waitForSelector("#b-name");
  ok((await p1.textContent("#cart h1")).includes("Completo") && await money(p1, "#cart-month") === "$199/mês", "trocou para o Completo");
  await preencher(p1);
  const c1 = pedidos.filter((b) => b.action === "store_checkout").pop();
  ok(c1.product === "pkg_completo" && c1.items.length === 0 && c1.socios === "multi" && c1.terms === true, "checkout: Completo, sem add-ons, LLC com sócio");

  /* ---------- Essencial: só telefone; sem oferta; pular ---------- */
  const p2 = await pagina();
  await p2.goto(`${BASE}/comprar.html?p=pkg_essencial&lang=en`);
  await p2.click("#pk-next");
  await p2.click("#pk-no"); await p2.click("#pk-no");
  ok((await p2.textContent(".pk-addon h2")).includes("Business Phone"), "upsell: 3º telefone (EN)");
  await p2.click("#pk-add");
  await p2.waitForSelector("#b-name");
  ok(await money(p2, "#cart-month") === "$78.99/month", "telefone soma $19.99/mês");
  await preencher(p2);
  const c2 = pedidos.filter((b) => b.action === "store_checkout").pop();
  ok(c2.product === "pkg_essencial" && JSON.stringify(c2.items) === '["telefone"]' && c2.socios === "single", "checkout: Essencial + telefone, single member");

  const p3 = await pagina({ ...devices["iPhone 13"] });
  await p3.goto(`${BASE}/comprar.html?p=pkg_essencial&lang=es`);
  await p3.click("#pk-next");
  await p3.click("#pk-add");
  await p3.click("#pk-skip");
  await p3.waitForSelector("#b-name");
  ok(await money(p3, "#cart-today") === "$1,355", "pular e finalizar mantém o que já foi adicionado");
  ok(await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "celular: sem rolagem horizontal");
  await p3.screenshot({ path: OUT + "/pacotes-celular.png", fullPage: true });
  const p4 = await pagina();
  await p4.goto(`${BASE}/comprar.html?p=operating_agreement&lang=pt`);
  await p4.waitForSelector(".portal-card");
  ok((await p4.textContent("#app")).includes("não encontrado"), "add-on não é vendido sozinho no site");

  /* ---------- portal: Add-ons ---------- */
  const ad = await pagina();
  await ad.goto(`${BASE}/tests/fixtures/addons.html`);
  await ad.waitForSelector("#ad-grid .tl-card");
  const g = await ad.textContent("#view");
  ok(g.includes("Seu plano") && g.includes("Pacote Essencial"), "add-ons: mostra o plano do cliente");
  ok((await ad.locator('#ad-grid s').first().textContent()) === "$29" && g.includes("$23") && g.includes("Preço de cliente"), "add-ons: preço cheio riscado e preço de cliente");
  ok(!g.includes("Pacote Completo de Abertura") && g.includes("WhatsApp Manager") && g.includes("Sob consulta"), "add-ons: sem pacotes; WhatsApp sob consulta");
  await ad.fill("#ad-q", "whats");
  ok(await ad.locator("#ad-grid .tl-card").count() === 1, "busca por nome");
  await ad.fill("#ad-q", "");
  await ad.click('.ad-chip[data-cat="financeiro"]');
  ok((await ad.locator("#ad-grid .tl-card").count()) === 1 && (await ad.textContent("#ad-grid")).includes("Bookkeeping"), "filtro por tipo");
  await ad.click('.ad-chip[data-cat=""]');
  await ad.click('[data-req="whatsapp"]');
  await ad.waitForSelector("#ad-m:has-text('Pedido enviado')");
  ok(pedidos.some((b) => b.action === "store_request" && b.product === "whatsapp"), "pedir ativação do WhatsApp Manager");
  await ad.screenshot({ path: OUT + "/addons-portal.png", fullPage: true });
} catch (e) { console.log("erro:", e.message); falhas.push(e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\ntudo certo");
process.exit(falhas.length ? 1 : 0);
