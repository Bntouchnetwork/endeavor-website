// Sessão: Login verde na home quando logado, login.html volta direto ao portal, saída automática por inatividade.
//   1. python3 -m http.server 8113   2. SUPABASE_UMD=<supabase.js local> node tests/session.e2e.mjs [http://localhost:8113] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import { readFileSync } from "node:fs";
const BASE = process.argv[2] || "http://localhost:8113", OUT = process.argv[3] || ".";
const UMD = process.env.SUPABASE_UMD ? readFileSync(process.env.SUPABASE_UMD, "utf8") : null;
let falhas = 0; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) falhas++; };
const MIN = 60000;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); const p = await ctx.newPage();
if (UMD) await ctx.route("**/supabase.js", (r) => r.fulfill({ contentType: "application/javascript", body: UMD }));
await ctx.route(/\/(client|admin|partner)\.html/, (r) => r.fulfill({ contentType: "text/html", body: "<title>portal</title><h1 id=portal>portal</h1>" }));
await ctx.route(/portal-stub\.html/, (r) => r.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="pt"><meta charset="utf-8"><body><button id="btn-signout" onclick="window.__saiu=1;localStorage.removeItem(\'endeavor-client-auth\')">Sair</button><script src="app-config.js"></script><script src="session-keep.js" data-portal="client"></script></body></html>' }));
const sessao = (ativoHa) => p.evaluate(([ha]) => { localStorage.setItem("endeavor-client-auth", JSON.stringify({ access_token: "a", refresh_token: "r" })); localStorage.setItem("endeavor-portal", "client"); if (ha == null) localStorage.removeItem("endeavor-last-active"); else localStorage.setItem("endeavor-last-active", String(Date.now() - ha)); }, [ativoHa]);
const botao = () => p.evaluate(() => { const a = document.querySelector(".js-login"); return { verde: a.classList.contains("is-logged"), href: a.getAttribute("href"), cor: getComputedStyle(a).backgroundColor, rodape: document.querySelector(".footer__admin").getAttribute("href") }; });
try {
  await p.goto(BASE + "/index.html"); await p.waitForSelector(".js-login");
  let bt = await botao(); ok(!bt.verde && /^login\.html/.test(bt.href), "home sem login: botão Login normal, abre o login");
  ok(!(await p.locator('.shop-card[data-product="whatsapp"]').count()), "home: o card do WhatsApp Manager saiu do carrossel");
  await sessao(5 * MIN); await p.reload(); await p.waitForSelector(".js-login.is-logged");
  bt = await botao(); ok(bt.verde && /^client\.html/.test(bt.href) && /^client\.html/.test(bt.rodape) && bt.cor === "rgb(26, 127, 75)", "home logado: o botão Login fica verde e aponta direto para o painel (" + JSON.stringify(bt) + ")");
  await p.locator(".header, header").first().screenshot({ path: OUT + "/home-logado.png" });
  await p.click(".js-login"); await p.waitForSelector("#portal"); ok(p.url().includes("client.html"), "um clique volta para o painel, sem passar pelo login");
  await p.goto(BASE + "/login.html?lang=pt"); await p.waitForSelector("#portal"); ok(p.url().includes("client.html?lang=pt"), "login.html com a pessoa logada: volta direto ao portal, sem pedir e-mail, senha nem código");
  await p.goto(BASE + "/index.html"); await sessao(null); await p.evaluate(() => localStorage.setItem("endeavor-portal", "partner")); await p.reload(); await p.waitForSelector(".js-login.is-logged");
  ok(/^partner\.html/.test((await botao()).href), "parceiro logado volta para o Portal do Parceiro");
  await sessao(31 * MIN); await p.reload(); await p.waitForSelector(".js-login"); await p.waitForTimeout(300);
  bt = await botao(); ok(!bt.verde && /^login\.html/.test(bt.href) && await p.evaluate(() => !localStorage.getItem("endeavor-client-auth")), "mais de 30 minutos sem atividade: a sessão é apagada e o botão volta ao normal");
  // portal sem sessão válida manda para login.html?out=client: apaga o resto e mostra o formulário (não fica indo e voltando)
  await sessao(MIN); await p.goto(BASE + "/login.html?lang=pt&out=client"); await p.waitForSelector("#f-login:not([hidden])"); await p.waitForTimeout(300);
  ok(p.url().includes("login.html") && await p.evaluate(() => !localStorage.getItem("endeavor-client-auth")), "sessão que o portal recusou: o login mostra o formulário e apaga o que sobrou");
  // dentro do portal: aviso 2 minutos antes e saída automática
  await p.goto(BASE + "/portal-stub.html"); await sessao(10 * MIN); await p.waitForTimeout(1300);
  ok(!(await p.locator("#idle-warn").count()), "com atividade recente não aparece aviso");
  await sessao(28 * MIN + 30000); await p.waitForSelector("#idle-warn");
  const av = await p.textContent("#idle-warn"); ok(av.includes("Você ainda está aí?") && /1:[0-5]\d/.test(av) && av.includes("Continuar logado"), "28 minutos sem atividade: aviso com a contagem e o botão Continuar logado");
  await p.screenshot({ path: OUT + "/aviso-inatividade.png" });
  await p.mouse.move(200, 200); await p.waitForTimeout(1200); ok(await p.locator("#idle-warn").count() === 1, "com o aviso aberto, só mexer o mouse não renova");
  await p.click("#idle-go"); await p.waitForTimeout(1200);
  ok(!(await p.locator("#idle-warn").count()) && await p.evaluate(() => Date.now() - +localStorage.getItem("endeavor-last-active") < 5000), "Continuar logado zera o tempo e fecha o aviso");
  await sessao(30 * MIN + 2000); await p.waitForURL(/login\.html\?out=all/, { timeout: 8000 });
  await p.waitForSelector("#f-login:not([hidden])");
  ok(await p.evaluate(() => !localStorage.getItem("endeavor-client-auth")) && (await p.textContent("#l-msg")).includes("falta de atividade"), "30 minutos sem resposta: sai sozinho e o login explica o motivo");
  for (const [l, t] of [["en", "Are you still there?"], ["es", "¿Sigue ahí?"]]) { await p.goto(BASE + "/portal-stub.html?lang=" + l); await p.evaluate((x) => { document.documentElement.lang = x; }, l); await sessao(29 * MIN); await p.waitForSelector("#idle-warn"); ok((await p.textContent("#idle-warn")).includes(t), "aviso em " + l); }
} catch (e) { console.log("erro:", e.message); falhas++; }
await b.close(); console.log(falhas ? falhas + " falha(s)" : "tudo certo"); process.exit(falhas ? 1 : 0);
