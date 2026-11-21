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
  { code: "pkg_holding", kind: "package", price_cents: 24900, setup_cents: 0, member_cents: null, category: "empresa", interval: "month", status: "hidden", sort: 3 },
  { code: "crm", kind: "tool", price_cents: 2900, setup_cents: 0, member_cents: 2300, category: "vendas", interval: "month", status: "active", sort: 10 },
  { code: "agenda", kind: "tool", price_cents: 1900, setup_cents: 0, member_cents: 1500, category: "vendas", interval: "month", status: "active", sort: 20 },
  { code: "esign", kind: "tool", price_cents: 1900, setup_cents: 0, member_cents: 1500, category: "documentos", interval: "month", status: "active", sort: 30 },
  { code: "bookkeeping", kind: "tool", price_cents: 19900, setup_cents: 0, member_cents: null, category: "financeiro", interval: "month", status: "active", sort: 40 },
  { code: "operating_agreement", kind: "addon", price_cents: 29700, setup_cents: 0, member_cents: null, category: "documentos", interval: "once", status: "active", sort: 45 },
  { code: "telefone", kind: "tool", price_cents: 1999, setup_cents: 0, member_cents: null, category: "comunicacao", interval: "month", status: "active", sort: 46 },
  { code: "webmeeting", kind: "tool", price_cents: 1900, setup_cents: 0, member_cents: null, category: "comunicacao", interval: "month", status: "coming_soon", sort: 47 },
  { code: "webinar", kind: "tool", price_cents: 9900, setup_cents: 0, member_cents: null, category: "comunicacao", interval: "month", status: "coming_soon", sort: 48 },
  { code: "whatsapp", kind: "tool", price_cents: 7900, setup_cents: 0, member_cents: null, category: "vendas", interval: "month", status: "coming_soon", sort: 49 },
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
  for (const [c, nome, preco] of [["webmeeting", "Web Meeting", "$19"], ["webinar", "Live Webinar", "$99"], ["whatsapp", "WhatsApp Manager", "$79"]]) {
    const card = home.locator(`.shop-card[data-product="${c}"]`), tx = await card.textContent();
    ok(tx.includes(nome) && tx.includes(preco) && tx.includes("/mês") && tx.includes("Em breve") && await card.locator(".js-buy").isHidden() && await card.locator(".shop-card__wait").isVisible(), `home: ${nome} em breve, ${preco}/mês, sem botão de contratar`);
  }
  ok(!/Video meetings|Live webinars with|Organize your WhatsApp/.test(await home.textContent(".shop__grid")), "home PT: textos dos três traduzidos");
  await home.locator('.shop-card[data-product="webmeeting"]').scrollIntoViewIfNeeded(); await home.waitForTimeout(700);
  await home.locator(".shop").screenshot({ path: OUT + "/loja-home.png" });
  { // "À venda" no admin: o card do site troca sozinho para o botão de contratar
    const v = await pagina(); await v.unroute("**/rest/v1/store_products*");
    await v.route("**/rest/v1/store_products*", (r) => r.fulfill({ json: CAT.map((p) => p.code === "webinar" ? { ...p, status: "active" } : p.code === "whatsapp" ? { ...p, status: "hidden" } : p) }));
    await v.goto(`${BASE}/index.html?lang=pt`); await v.waitForSelector(".shop__grid"); await v.waitForTimeout(800);
    const w = v.locator('.shop-card[data-product="webinar"]');
    ok(await w.locator(".js-buy").isVisible() && await w.locator(".shop-card__badge").isHidden() && await w.locator(".shop-card__wait").isHidden() && (await w.locator(".js-buy").getAttribute("href")).includes("p=webinar"), "home: À venda mostra o botão de contratar");
    ok(await v.locator('.shop-card[data-product="whatsapp"]').isHidden() && await v.locator('.shop-card[data-product="webmeeting"] .js-buy').isHidden(), "home: Escondido some do site; os outros seguem em breve");
    await v.close();
  }
  { const ct = await home.textContent("#contact"), ft = await home.textContent("footer");
    const hrefs = await home.locator("a.js-wa").evaluateAll((l) => l.map((a) => a.href));
    ok(hrefs.length === 2 && hrefs.every((h) => h === "https://wa.me/16306898702?text=" + encodeURIComponent("Preciso de informações.")), "contatos: o ícone do WhatsApp abre a conversa com a mensagem pronta (PT)");
    ok(!/630\D*689/.test(ct + ft) && /407\) 436-9567/.test(ct) && ct.includes("support@endeavorbiz.com") && ft.includes("support@endeavorbiz.com"), "contatos: sem o número do WhatsApp escrito; telefone e e-mail aparecem");
    ok((await home.locator("#contact a.js-wa").getAttribute("aria-label")).includes("WhatsApp") && await home.locator("#contact a.js-wa svg").isVisible(), "contatos: ícone com nome acessível");
    await home.locator("#contact .contact__list").screenshot({ path: OUT + "/contatos.png" }); }
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

  /* ---------- portal: Serviços (Meu plano e Add-ons), sem rolagem e com páginas ---------- */
  const semRolagem = (p) => p.evaluate(() => { const b = document.querySelector(".fit-body"); return document.documentElement.scrollHeight <= innerHeight + 1 && b.scrollHeight <= b.clientHeight + 1; });
  const cabeTudo = (p) => p.evaluate(() => { const g = document.querySelector("#sv-grid").getBoundingClientRect(); return [...document.querySelectorAll("#sv-grid .sv-card")].every((c) => { const r = c.getBoundingClientRect(), bt = c.querySelector(".btn"); return r.bottom <= g.bottom + 1 && r.right <= g.right + 1 && (!bt || bt.getBoundingClientRect().bottom <= r.bottom + 1); }); });
  const ad = await pagina({ viewport: { width: 1280, height: 720 } });
  await ad.goto(`${BASE}/tests/fixtures/addons.html#/servicos`);
  await ad.waitForSelector("#sv-grid .sv-card"); await ad.waitForTimeout(300);
  const menu = await ad.evaluate(() => window.__nav); ok(menu.includes("servicos") && !menu.includes("addons"), "menu: só Serviços (sem o item Add-ons)");
  ok((await ad.textContent(".subtabs [aria-current]")) === "Meu plano", "abre em Meu plano para quem tem pacote");
  const pl = await ad.textContent("#sv-grid");
  ok(pl.includes("Pacote Essencial") && pl.includes("$59") && pl.includes("Registered agent") && pl.includes("EIN") && !pl.includes("No seu pacote") && await ad.locator("#sv-grid .sv-card").count() === 2 && pl.includes("CRM") && pl.includes("Cancelar"), "Meu plano: pacote com mensalidade, incluídos e o add-on contratado com cancelar");
  ok(await semRolagem(ad) && await cabeTudo(ad), "Meu plano: sem rolagem, cards inteiros na tela");
  await ad.screenshot({ path: OUT + "/servicos-plano.png" });
  await ad.click('.subtabs a[href$="tab=addons"]');
  await ad.waitForSelector("#ad-q"); await ad.waitForTimeout(300);
  const total = 10; // 7 produtos (sem pacotes e sem o Operating Agreement, que a conta não tem) + Web Meeting, Live Webinar e WhatsApp Manager
  const n1 = await ad.locator("#sv-grid .sv-card").count(), pg = await ad.textContent("#sv-pg");
  ok(n1 < total && n1 >= 4 && pg === "1/" + Math.ceil(total / n1), `Add-ons: ${n1} cards por página, indicador ${pg}`);
  ok(await semRolagem(ad) && await cabeTudo(ad), "Add-ons: sem rolagem, cards inteiros na tela");
  ok(await ad.locator("#sv-ant").isDisabled(), "primeira página: flecha anterior desligada");
  ok((await ad.locator("#sv-grid s").first().textContent()) === "$29" && (await ad.textContent("#sv-grid")).includes("Preço de cliente"), "preço cheio riscado e preço de cliente");
  await ad.screenshot({ path: OUT + "/servicos-addons.png" });
  const primeira = await ad.textContent("#sv-grid");
  await ad.click("#sv-prox");
  ok((await ad.textContent("#sv-pg")).startsWith("2/") && (await ad.textContent("#sv-grid")) !== primeira, "flecha passa para a próxima página");
  let vistos = n1; while (!(await ad.locator("#sv-prox").isDisabled())) { vistos += 0; await ad.click("#sv-prox"); }
  ok((await ad.textContent("#sv-grid")).includes("Endereço Virtual") && await ad.locator("#sv-prox").isDisabled(), "última página: flecha próxima desligada");
  await ad.fill("#ad-q", "whats");
  ok(await ad.locator("#sv-grid .sv-card").count() === 1 && await ad.locator("#sv-pager").isHidden(), "busca refaz as páginas (1 resultado, sem flechas)");
  await ad.fill("#ad-q", ""); await ad.click('.ad-chip[data-cat="financeiro"]');
  ok((await ad.locator("#sv-grid .sv-card").count()) === 1 && (await ad.textContent("#sv-grid")).includes("Bookkeeping"), "filtro por tipo refaz as páginas");
  await ad.click('.ad-chip[data-cat="vendas"]');
  const wa = ad.locator("#sv-grid .sv-card", { hasText: "WhatsApp Manager" }), txWa = await wa.textContent();
  ok(txWa.includes("Em breve") && txWa.includes("$79") && txWa.includes("/mês") && await wa.locator("button, a.btn").count() === 0, "WhatsApp Manager: Em breve, com $79/mês e sem botão");
  await ad.click('.ad-chip[data-cat="comunicacao"]');
  const txCom = await ad.textContent("#sv-grid");
  ok(/Web Meeting[\s\S]*\$19[\s\S]*Live Webinar[\s\S]*\$99/.test(txCom) && !txCom.includes("Sob consulta") && await ad.locator("#sv-grid .sv-card", { hasText: /Web Meeting|Live Webinar/ }).locator("button, a.btn").count() === 0 && await ad.locator("#sv-grid .sv-card", { hasText: /Web Meeting|Live Webinar/ }).filter({ hasText: "Em breve" }).count() === 2, "Web Meeting $19 e Live Webinar $99: Em breve, sem contratar e sem pedir ativação");
  await ad.click('.ad-chip[data-cat=""]');
  await ad.setViewportSize({ width: 1700, height: 1000 }); await ad.waitForTimeout(400);
  const n2 = await ad.locator("#sv-grid .sv-card").count();
  ok(n2 > n1 && await semRolagem(ad) && await cabeTudo(ad), `tela maior: mais cards por página (${n2}), ainda sem rolagem`);
  await ad.goto(`${BASE}/tests/fixtures/addons.html#/addons`); await ad.waitForSelector("#ad-q");
  ok((await ad.textContent(".subtabs [aria-current]")) === "Add-ons", "link antigo #/addons abre a aba Add-ons de Serviços");
  const ho = await pagina({ viewport: { width: 1280, height: 720 } });
  await ho.goto(`${BASE}/tests/fixtures/addons.html?plano=holding#/servicos`); await ho.waitForSelector("#sv-grid .sv-card"); await ho.waitForTimeout(300);
  const ht = await ho.textContent("#sv-grid");
  ok((await ho.textContent(".subtabs [aria-current]")) === "Meu plano" && ht.includes("Pacote Operacional + Holding") && ht.includes("$249") && ht.includes("duas empresas"), "Holding: Meu plano mostra o pacote com $249/mês");
  ok(await ho.locator("#sv-grid .sv-card").count() === 1 && !ht.includes("No seu pacote") && ht.includes("Bookkeeping das duas empresas") && ht.includes("Registered agent das duas empresas") && ht.includes("Endereço comercial e de correspondência") && !ht.includes("Cancelar"), "Holding: bookkeeping, registered agent e endereço como ativos no pacote, sem cancelar avulso");
  ok(await semRolagem(ho) && await cabeTudo(ho), "Holding: sem rolagem, cards inteiros");
  await ho.screenshot({ path: OUT + "/servicos-holding.png" });
  await ho.click('.subtabs a[href$="tab=addons"]'); await ho.waitForSelector("#ad-q"); await ho.fill("#ad-q", "book");
  ok(!(await ho.textContent("#sv-grid")).includes("No seu pacote") && (await ho.locator("#sv-grid .sv-card", { hasText: "Bookkeeping" }).textContent()).includes("Ativo") && !(await ho.locator("#sv-grid [data-buy]").count()), "Holding: na aba Add-ons o bookkeeping aparece ativo, sem contratar");
  await ho.fill("#ad-q", "crm");
  ok(await ho.locator('#sv-grid [data-buy="crm"]').count() === 1 && (await ho.textContent("#sv-grid")).includes("Preço de cliente"), "Holding: o resto fica aberto para contratar, com preço de cliente");
  const cel = await pagina({ ...devices["iPhone 13"] });
  await cel.goto(`${BASE}/tests/fixtures/addons.html#/servicos?tab=addons`); await cel.waitForSelector("#sv-grid .sv-card"); await cel.waitForTimeout(300);
  ok(await cel.locator("#sv-grid .sv-card").count() === total && await cel.locator("#sv-pager").isHidden(), "celular: todos os cards, um embaixo do outro, sem páginas");
  ok(await cel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "celular: sem rolagem horizontal");
  await cel.screenshot({ path: OUT + "/servicos-celular.png" });
} catch (e) { console.log("erro:", e.message); falhas.push(e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\ntudo certo");
process.exit(falhas.length ? 1 : 0);
