// Comunidade (página pública): diretório, filtro, busca, perfil, contato e avaliação.
//   1. python3 -m http.server 8113   2. node tests/community.e2e.mjs [http://localhost:8113] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8113", OUT = process.argv[3] || ".";
let falhas = 0; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) falhas++; };
const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const PERFIS = Array.from({ length: 11 }, (_, i) => ({ id: id(i + 1), kind: i % 3 === 2 ? "professional" : "company", display_name: i % 3 === 2 ? "Ana Souza " + (i + 1) : "Acme Logistics " + (i + 1), headline: "Importação e exportação entre o Brasil e os EUA, com armazém em Orlando.", area: i % 2 ? "Contabilidade" : "Logística", city: i % 2 ? "Miami" : "Orlando", state: "FL", website: "https://example.com", photo_path: null, logo_path: null, banner_path: null, rating: i ? 4.5 : null, reviews: i ? 3 : 0 }));
const PERFIL = { ...PERFIS[1], bio: "Somos uma empresa de logística.\nAtendemos importadores brasileiros desde 2019.", reviews: [1, 2, 3].map((n) => ({ id: "r" + n, author: "Carlos M.", rating: 6 - n, comment: "Atendimento muito bom " + n, at: "2026-10-0" + n + "T12:00:00Z", reply: n === 1 ? "Obrigado!" : null })) };
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); const p = await ctx.newPage();
const enviados = []; let ligada = true;
await ctx.route("**/rest/v1/rpc/community_on", (r) => r.fulfill({ json: ligada }));
await ctx.route("**/rest/v1/rpc/community_list", (r) => r.fulfill({ json: PERFIS }));
await ctx.route("**/rest/v1/rpc/community_profile", (r) => r.fulfill({ json: PERFIL }));
await ctx.route("**/functions/v1/crm", (r) => { enviados.push(JSON.parse(r.request().postData() || "{}")); r.fulfill({ json: { ok: true } }); });
p.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas++; });
const semRolar = () => p.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1);
try {
  await p.goto(BASE + "/community.html?lang=pt"); await p.waitForSelector(".cm-card");
  const g = await p.evaluate(() => ({ h1: document.querySelector("h1").textContent, cards: document.querySelectorAll(".cm-card").length, pg: document.querySelector("#cm-pg").textContent, pager: !document.querySelector("#cm-pager").hidden, total: document.querySelector("#cm-total").textContent, email: /@/.test(document.querySelector("#cm-grade").textContent) }));
  ok(g.h1 === "Comunidade" && g.cards >= 4 && g.cards < 11 && g.pager && /^1\/\d$/.test(g.pg) && g.total === "11 perfis" && !g.email && await semRolar(), "diretório em página fixa: cards em páginas com flechas, sem e-mail de ninguém (" + JSON.stringify(g) + ")");
  const c1 = await p.textContent(".cm-card"); ok(c1.includes("Acme Logistics 1") && c1.includes("Empresa") && c1.includes("Logística · Orlando, FL") && c1.includes("Ainda sem avaliações") && (await p.textContent(".cm-grade li:nth-child(2) .cm-card")).includes("4.5 · 3 avaliações"), "card: nome, tipo, área, cidade, descrição e média das avaliações");
  await p.screenshot({ path: OUT + "/comunidade.png" });
  await p.click("#cm-prox"); ok((await p.textContent("#cm-pg")).startsWith("2/"), "flecha passa para a página seguinte");
  await p.click('#cm-filtro [data-k="professional"]'); ok(await p.locator(".cm-card").count() === 3 && (await p.textContent("#cm-grade")).includes("Profissional") && !(await p.textContent("#cm-grade")).includes("Acme"), "filtro por profissional");
  await p.click('#cm-filtro [data-k=""]'); await p.fill("#cm-q", "miami"); ok(await p.locator(".cm-card").count() === 5, "busca por cidade");
  await p.fill("#cm-q", "zzzz"); ok((await p.textContent("#cm-grade")).includes("Nenhum perfil encontrado"), "busca sem resultado mostra o aviso");
  await p.fill("#cm-q", "Acme Logistics 2"); await p.click(".cm-card"); await p.waitForSelector(".cm-perfil #cm-fc");
  const pf = await p.textContent(".cm-perfil");
  ok(pf.includes("Acme Logistics 2") && pf.includes("Somos uma empresa de logística.") && pf.includes("Site") && !/@/.test(pf) && /[?&]p=/.test(p.url()) && await p.locator(".cm-banner").count() === 1, "clicar no card abre o perfil: banner, nome, dados, bio, contato e avaliações, sem e-mail");
  await p.screenshot({ path: OUT + "/comunidade-perfil.png" });
  await p.click('#cm-fc button[type="submit"]'); ok((await p.textContent("#cm-cmsg")).includes("Preencha"), "contato vazio é recusado");
  await p.fill("#cm-cn", "Maria Teste"); await p.fill("#cm-ce", "maria@example.com"); await p.fill("#cm-cm", "Olá, gostaria de um orçamento de frete.");
  await p.click('#cm-fc button[type="submit"]'); await p.waitForSelector("#cm-cmsg.cm-msg--ok");
  const env = enviados.pop();
  ok(env && env.public === "community_contact" && env.profile_id === PERFIL.id && env.email === "maria@example.com" && env.website === "" && env.elapsed_ms > 0, "mensagem enviada ao servidor com o campo isca vazio e o tempo de preenchimento");
  await p.click("#cm-t-r"); const rl = await p.textContent("#cm-rl");
  ok(rl.includes("Carlos M.") && rl.includes("Resposta de Acme Logistics 2") && await p.locator("#cm-rl .cm-aval").count() === 2 && (await p.textContent("#cm-rn")) === "1/2", "avaliações em páginas, com a resposta do perfil");
  await p.click("#cm-rb"); ok((await p.textContent("#cm-rf")).includes("entre primeiro no seu portal") && await p.locator('#cm-rf a[href^="login.html"]').count() === 1, "avaliar sem estar logado pede o login");
  await p.keyboard.press("Escape"); ok(await p.locator("#cm-veu").isHidden() && !/[?&]p=/.test(p.url()), "Esc fecha o perfil");
  for (const [l, t] of [["en", "Community"], ["es", "Comunidad"]]) { await p.goto(BASE + "/community.html?lang=" + l); await p.waitForSelector(".cm-card"); ok((await p.textContent("h1")) === t, "página em " + l); }
  await p.setViewportSize({ width: 390, height: 800 }); await p.goto(BASE + "/community.html?lang=pt"); await p.waitForSelector(".cm-card");
  ok(await p.locator(".cm-card").count() === 11 && await p.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), "celular: todos os cards, rolagem normal, sem rolagem horizontal");
  // home: o link aparece só com a Comunidade ligada
  await p.setViewportSize({ width: 1366, height: 800 }); await p.goto(BASE + "/index.html?lang=pt"); await p.waitForFunction(() => { const l = document.querySelector(".js-community-li"); return l && !l.hidden; });
  ok((await p.textContent(".js-community")).trim() === "Comunidade" && (await p.getAttribute(".js-community", "href")) === "community.html?lang=pt", "home: link Comunidade no menu, no idioma");
  ligada = false; await p.reload(); await p.waitForTimeout(800); ok(await p.evaluate(() => [...document.querySelectorAll(".js-community-li")].every((l) => l.hidden)), "Comunidade desligada no admin: o link some da home");
  await p.goto(BASE + "/community.html?lang=pt"); await p.waitForSelector(".cm-vazio"); ok((await p.textContent("#cm-grade")).includes("não está disponível"), "e a página avisa que não está disponível");
} catch (e) { console.log("erro:", e.message.slice(0, 400)); falhas++; }
await b.close(); console.log(falhas ? falhas + " falha(s)" : "tudo certo"); process.exit(falhas ? 1 : 0);
