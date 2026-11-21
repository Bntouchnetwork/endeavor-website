// Login único (login.html) com o Supabase simulado.
//   1. python3 -m http.server 8104   2. node tests/login.e2e.mjs [http://localhost:8104] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8104", OUT = process.argv[3] || ".";
// sem acesso ao CDN no ambiente de teste: SUPABASE_UMD aponta para uma cópia local de supabase.js
const UMD = process.env.SUPABASE_UMD ? (await import("node:fs")).readFileSync(process.env.SUPABASE_UMD, "utf8") : null;
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (email) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: "u-" + email, email, exp: Math.floor(Date.now() / 1000) + 3600, aal: "aal1", role: "authenticated" }) + ".c2lnbmF0dXJl";
const CONTAS = { "adm@x.com": ["admin"], "cli@x.com": ["client"], "par@x.com": ["partner"], "dois@x.com": ["client", "partner"], "nada@x.com": [] };

const browser = await chromium.launch();
async function pagina(url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(); p.pedidos = [];
  p.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas.push("pageerror " + e.message); });
  if (UMD) await p.route("**/supabase-js@*/**", (r) => r.fulfill({ contentType: "application/javascript", body: UMD }));
  await p.route("**/auth/v1/token*", async (r) => {
    const d = JSON.parse(r.request().postData() || "{}");
    if (!(d.email in CONTAS) || d.password !== "certa") return r.fulfill({ status: 400, json: { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" } });
    const t = jwt(d.email);
    r.fulfill({ json: { access_token: t, refresh_token: "rt", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "u-" + d.email, email: d.email, aud: "authenticated" } } });
  });
  await p.route("**/auth/v1/user*", (r) => { const e = JSON.parse(Buffer.from(r.request().headers().authorization.split(".")[1], "base64url")).email; r.fulfill({ json: { id: "u-" + e, email: e, aud: "authenticated" } }); });
  await p.route("**/auth/v1/logout*", (r) => r.fulfill({ status: 204, body: "" }));
  await p.route("**/rest/v1/rpc/login_route", (r) => { const e = JSON.parse(Buffer.from(r.request().headers().authorization.split(".")[1], "base64url")).email; r.fulfill({ json: CONTAS[e] || [] }); });
  await p.route("**/functions/v1/payments", (r) => { p.pedidos.push(JSON.parse(r.request().postData())); r.fulfill({ json: { ok: true } }); });
  // os portais não fazem parte deste teste: só registramos para onde a pessoa foi
  await p.route(/\/(client|partner|admin)\.html/, (r) => r.fulfill({ contentType: "text/html", body: "<title>portal</title><p id=dest>ok</p>" }));
  await p.goto(BASE + "/" + url); await p.waitForSelector("#card, #dest");
  return p;
}
const entrar = async (p, e, s) => { await p.fill("#l-email", e); await p.fill("#l-pass", s); await p.click("#l-go"); };
const sessao = (p, chave) => p.evaluate((k) => { const v = localStorage.getItem(k) || Object.keys(localStorage).filter((x) => /^sb-.*-auth-token$/.test(x)).map((x) => localStorage.getItem(x))[0]; return k === "padrao" ? Object.keys(localStorage).filter((x) => /^sb-.*-auth-token$/.test(x)).map((x) => JSON.parse(localStorage.getItem(x)).user.email)[0] : (localStorage.getItem(k) ? JSON.parse(localStorage.getItem(k)).user.email : null); }, chave);

try {
  let p = await pagina("login.html?lang=pt");
  ok(await p.locator("#f-login").isVisible() && await p.locator("#l-email").count() === 1 && !(await p.locator(".choice").count()) && (await p.textContent("h1")) === "Entrar", "um formulário só, sem a escolha de portal");
  await p.screenshot({ path: OUT + "/login-unico.png" });
  await entrar(p, "cli@x.com", "errada"); await p.waitForSelector("#l-msg.portal-alert--error");
  const e1 = await p.textContent("#l-msg");
  await entrar(p, "naoexiste@x.com", "certa"); await p.waitForFunction(() => document.querySelector("#l-msg").className.includes("error") && !document.querySelector("#l-go").disabled);
  ok(e1 === "E-mail ou senha incorretos." && (await p.textContent("#l-msg")) === e1, "mesma mensagem para senha errada e para e-mail que não existe");

  for (const [e, dest, chave] of [["cli@x.com", "client.html", "endeavor-client-auth"], ["par@x.com", "partner.html", "endeavor-client-auth"], ["adm@x.com", "admin.html", "padrao"]]) {
    p = await pagina("login.html?lang=pt"); p.on("console", (m) => console.log("console:", m.text().slice(0, 200))); p.on("requestfailed", (r) => console.log("falhou:", r.url().slice(0, 120))); await entrar(p, e, "certa"); await p.waitForSelector("#dest", { timeout: 6000 }).catch(async () => console.log("msg:", await p.textContent("#l-msg"), p.url()));
    ok(p.url().includes("/" + dest) && (dest === "admin.html" || p.url().includes("lang=pt")) && (await sessao(p, chave)) === e, `${e} vai para ${dest} já com a sessão do portal`);
  }
  p = await pagina("login.html?lang=pt"); await entrar(p, "dois@x.com", "certa"); await p.waitForSelector("#pick:not([hidden])");
  const ops = await p.locator("#pick-list button").allTextContents();
  ok(ops.join("|") === "Portal do Cliente|Portal do Parceiro", "e-mail com dois acessos: escolhe o portal depois do login (só os dele)");
  await p.screenshot({ path: OUT + "/login-escolha.png" });
  await p.click("#pick-list button:nth-child(2)"); await p.waitForSelector("#dest");
  ok(p.url().includes("/partner.html"), "a escolha leva ao portal escolhido");
  p = await pagina("login.html?lang=pt"); await entrar(p, "nada@x.com", "certa"); await p.waitForSelector("#l-msg.portal-alert--error");
  ok((await p.textContent("#l-msg")).includes("não tem um acesso ativo") && p.url().includes("login.html"), "conta sem acesso: aviso e continua no login");

  // esqueci a senha
  p = await pagina("login.html?lang=pt"); await p.fill("#l-email", "cli@x.com"); await p.click("#l-forgot");
  ok(await p.locator("#f-forgot").isVisible() && await p.inputValue("#fg-email") === "cli@x.com" && (await p.textContent("h1")) === "Nova senha", "esqueci a senha abre no mesmo card, com o e-mail já preenchido");
  await p.click("#fg-go"); await p.waitForSelector("#fg-msg.portal-alert--ok");
  ok(p.pedidos[0]?.action === "access_reset" && p.pedidos[0].page === "login.html" && p.pedidos[0].lang === "pt" && (await p.textContent("#fg-msg")).startsWith("Se cli@x.com tiver uma conta"), "pedido de nova senha enviado, com a mesma resposta para qualquer e-mail");
  await p.click("#fg-back"); ok(await p.locator("#f-login").isVisible(), "voltar para o login");

  // link de nova senha que chega no login único
  p = await pagina("login.html?lang=es#access_token=" + jwt("par@x.com") + "&refresh_token=r&type=recovery"); await p.waitForSelector("#dest");
  ok(p.url().includes("/partner.html") && p.url().includes("type=recovery") && p.url().includes("lang=es"), "link de nova senha vai para o portal da conta, com o link junto");
  p = await pagina("login.html?lang=pt#access_token=" + jwt("dois@x.com") + "&refresh_token=r&type=recovery"); await p.waitForSelector("#pick:not([hidden])");
  ok((await p.textContent("#pick-lead")).includes("nova senha") && await p.locator("#pick-list button").count() === 2, "link de nova senha com dois acessos: escolhe o portal");
  p = await pagina("login.html?lang=pt#error=access_denied&error_code=otp_expired");
  ok(await p.locator("#f-forgot").isVisible() && await p.locator("#fg-exp").isVisible(), "link vencido: pede um novo");

  // idiomas e celular
  p = await pagina("login.html?lang=en"); ok((await p.textContent("h1")) === "Sign in" && (await p.textContent("#l-go")) === "Sign in", "inglês");
  p = await pagina("login.html?lang=es"); ok((await p.textContent("h1")) === "Ingresar", "espanhol");
  await p.setViewportSize({ width: 360, height: 700 });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "celular: sem rolagem horizontal");

  // site: o botão Login abre o login único, sem menu
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const h = await ctx.newPage();
  await h.route("**/rest/v1/**", (r) => r.fulfill({ json: [] })); await h.route("**/functions/v1/**", (r) => r.fulfill({ json: {} }));
  await h.goto(BASE + "/index.html?lang=pt"); await h.waitForTimeout(600);
  ok(!(await h.locator("#login-menu").count()) && (await h.locator("#login a.js-login").getAttribute("href")) === "login.html?lang=pt", "site: botão Login leva direto ao formulário único");
  await h.locator("#site-header").screenshot({ path: OUT + "/login-botao.png" });
  // portal sem sessão: vai para o login único
  const c2 = await (await browser.newContext()).newPage();
  if (UMD) await c2.route("**/supabase-js@*/**", (r) => r.fulfill({ contentType: "application/javascript", body: UMD }));
  await c2.route("**/auth/v1/**", (r) => r.fulfill({ json: {} })); await c2.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await c2.goto(BASE + "/client.html?lang=pt"); await c2.waitForURL(/login\.html/, { timeout: 8000 }).catch(() => {});
  ok(c2.url().includes("login.html?lang=pt"), "portal do cliente sem sessão abre o login único");
  await c2.goto(BASE + "/admin.html"); await c2.waitForURL(/login\.html/, { timeout: 8000 }).catch(() => {});
  ok(c2.url().includes("login.html"), "admin sem sessão abre o login único");
} catch (e) { console.log("erro:", e.message); falhas.push("erro " + e.message); }
await browser.close();
console.log(falhas.length ? falhas.length + " falha(s)" : "tudo certo");
process.exit(falhas.length ? 1 : 0);
