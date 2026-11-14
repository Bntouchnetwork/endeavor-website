// Web Meeting: teste de ponta a ponta da sala no navegador, em modo demonstração (sem LiveKit).
// Câmera e microfone falsos do Chromium; a função `meet` é simulada.
//   1. sirva a pasta do site:  python3 -m http.server 8092
//   2. node tests/meet-room.e2e.mjs [http://localhost:8092] [pasta-para-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8092";
const OUT = process.argv[3] || ".";
const falhas = [];
const ok = (cond, nome) => { console.log((cond ? "✓ " : "✗ ") + nome); if (!cond) falhas.push(nome); };

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
for (const [rotulo, viewport] of [["desktop", { width: 1366, height: 820 }], ["celular", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  const erros = []; page.on("pageerror", (e) => erros.push(e.message));
  await page.route("**/functions/v1/meet", (r) => {
    const b = r.request().postDataJSON();
    if (b.acao === "info") return r.fulfill({ json: { titulo: "Alinhamento semanal", situacao: "scheduled", empresa: "ACME LLC", configurado: false, habilitada: true, logo: null } });
    return r.fulfill({ status: 503, json: { erro: "não configurado" } });
  });
  await page.goto(`${BASE}/reuniao.html?s=eb-teste12345`);
  await page.waitForSelector("#sNome", { state: "visible", timeout: 15000 });
  ok(await page.textContent("#sPreTitulo") === "Alinhamento semanal", `${rotulo}: pré-sala mostra o título`);
  ok((await page.textContent("#sAvisoDemo")).includes("demonstração"), `${rotulo}: aviso de modo demonstração`);
  ok(await page.$$eval(".pre-fundos .fundo-img", (b) => b.length) === 7, `${rotulo}: pré-sala mostra os fundos virtuais`);
  await page.fill("#sNome", "Convidado Teste");
  await page.screenshot({ path: `${OUT}/meet-pre-${rotulo}.png` });
  await page.click("#sEntrar");
  await page.waitForSelector(".sala.no-ar", { timeout: 15000 });
  ok(true, `${rotulo}: entrou na sala`);
  await page.waitForTimeout(1500);
  ok(await page.$$eval("#sGrade .tile", (t) => t.length) >= 2, `${rotulo}: grade com participantes`);
  // reação
  await page.click("#sReagir"); await page.click('#sReacoes [data-e="👏"]');
  ok(!!(await page.$(".reacao-voa")), `${rotulo}: reação aparece no palco`);
  // chat
  await page.click("#sChat");
  await page.fill("#sTexto", "Olá, todos!"); await page.press("#sTexto", "Enter");
  ok((await page.textContent("#sMsgs")).includes("Olá, todos!"), `${rotulo}: mensagem no chat`);
  // mão levantada
  await page.click("#sMao"); await page.waitForTimeout(400);
  ok((await page.getAttribute("#sMao", "class")).includes("ativo"), `${rotulo}: mão levantada`);
  // controles do anfitrião ficam escondidos para convidado
  ok(!(await page.isVisible("#sEncerrar")), `${rotulo}: convidado não vê Encerrar`);
  await page.waitForTimeout(9500); // o anfitrião simulado liga as legendas e lança uma enquete
  ok(await page.isVisible("#sEnquete"), `${rotulo}: enquete do anfitrião aparece`);
  await page.screenshot({ path: `${OUT}/meet-sala-${rotulo}.png` });
  ok(erros.length === 0, `${rotulo}: sem erros de JavaScript ${erros.join(" | ")}`);
  await ctx.close();
}
// anfitrião (modo demonstração): controles do anfitrião, assistente de slides e fundo desfocado
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, permissions: ["camera", "microphone"] });
  const page = await ctx.newPage();
  const erros = []; page.on("pageerror", (e) => erros.push(e.message));
  await page.route("**/functions/v1/meet", (r) => r.fulfill({ status: 404, json: { erro: "Sala não encontrada" } }));
  await page.goto(`${BASE}/reuniao.html?s=eb-host12345`);
  await page.waitForFunction(() => !!window.EMeetRoom);
  await page.evaluate(() => window.EMeetRoom.abrir({ sala: "eb-host12345", titulo: "Reunião do anfitrião", papel: "mentor", nome: "Ana Anfitriã", demo: true }));
  await page.waitForSelector("#sEntrar", { state: "visible" });
  await page.click("#sEntrar");
  await page.waitForSelector(".sala.no-ar");
  ok(await page.isVisible("#sEncerrar") && await page.isVisible("#sGravar"), "anfitrião: vê Gravar e Encerrar");
  await page.click("#sGravar"); await page.waitForTimeout(300);
  ok(await page.isVisible("#sRec"), "anfitrião: selo Gravando aparece");
  await page.click("#sGravar");
  await page.click("#sMais"); await page.waitForTimeout(200);
  ok(await page.isVisible('#sMenu [data-f="cronometro"]') && await page.isVisible('#sMenu [data-f="grupos"]') && await page.isVisible('#sMenu [data-f="resumo"]'), "anfitrião: ferramentas no menu Mais");
  // nenhum pedido de rede pode levar a foto do fundo
  const envios = []; page.on("request", (r) => { const d = r.postData(); if (d && d.length > 20000) envios.push(r.url()); });
  await page.click('#sMenu [data-fundo="desfoque"]');
  await page.waitForTimeout(6000);
  ok(erros.length === 0, "anfitrião: fundo desfocado sem erro " + erros.join(" | "));
  ok(await page.evaluate(() => { const t = document.querySelector(".tile.local video"); return !!(t && t.srcObject && t.srcObject.getVideoTracks()[0]); }), "anfitrião: vídeo local com fundo");
  ok(await page.$$eval("#sMenu .fundos-grade .fundo-img", (b) => b.length) === 7, "anfitrião: 6 fundos prontos + Sua foto no menu");
  await page.click('#sMenu [data-fundo="img:escritorio"]');
  await page.waitForTimeout(2500);
  ok((await page.getAttribute('#sMenu [data-fundo="img:escritorio"]', "class")).includes("sel") && erros.length === 0, "anfitrião: fundo virtual Escritório " + erros.join(" | "));
  ok(await page.evaluate(() => document.querySelector(".tile.local").classList.contains("sem-espelho")), "anfitrião: fundo virtual não espelhado");
  // foto própria: fica só no navegador
  const foto = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1200; c.height = 800; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 1200, 800); gr.addColorStop(0, "#2a6"); gr.addColorStop(1, "#14a"); g.fillStyle = gr; g.fillRect(0, 0, 1200, 800); return c.toDataURL("image/jpeg", 0.9).split(",")[1]; });
  await page.setInputFiles("#sFotoFundo", { name: "minha-foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from(foto, "base64") });
  await page.waitForTimeout(2500);
  ok((await page.getAttribute('#sMenu [data-fundo="foto"]', "class")).includes("sel"), "anfitrião: fundo com a própria foto");
  ok(await page.evaluate(() => (localStorage.getItem("emeet-fundo-foto") || "").startsWith("data:image/jpeg")), "anfitrião: foto guardada só no navegador");
  ok(await page.isVisible("#sMenu .fundo-nota"), "anfitrião: aviso de que a foto fica no computador");
  await page.click("#sMenu .fundo-remover"); await page.waitForTimeout(800);
  ok(await page.evaluate(() => localStorage.getItem("emeet-fundo-foto") === null) && (await page.getAttribute('#sMenu [data-fundo="nenhum"]', "class")).includes("sel"), "anfitrião: remover a foto volta para Nenhum");
  ok(envios.length === 0, "anfitrião: a foto não foi enviada pela rede " + envios.join(" "));
  ok(erros.length === 0, "anfitrião: fundos sem erro " + erros.join(" | "));
  await page.screenshot({ path: `${OUT}/meet-fundos-menu.png` });
  await page.keyboard.press("Escape");
  await page.click('.abas [data-aba="slides"]').catch(async () => { await page.click("#sChat"); await page.click('.abas [data-aba="slides"]'); });
  await page.fill("#apTexto", "Crie 4 slides sobre o lançamento do serviço");
  await page.press("#apTexto", "Enter");
  await page.waitForTimeout(2500);
  ok(!!(await page.$("#apPrevia .slide")), "anfitrião: assistente criou os slides");
  await page.screenshot({ path: `${OUT}/meet-anfitriao.png` });
  ok(erros.length === 0, "anfitrião: sem erros de JavaScript " + erros.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
