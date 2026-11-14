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
  ok(await page.isVisible('.pre-fundos [data-fundo="desfoque"]') && await page.isVisible(".pre-fundos .fundo-virtual") && !(await page.isVisible(".pre-fundos .fundos-lista")), `${rotulo}: pré-sala mostra Nenhum, Desfocado e Fundo virtual`);
  await page.click(".pre-fundos .fundo-virtual");
  ok(await page.$$eval(".pre-fundos .fundos-lista .fundo-op", (b) => b.length) === 7 && await page.isVisible(".pre-fundos .fundos-lista"), `${rotulo}: Fundo virtual abre a lista (6 imagens + Sua foto)`);
  await page.click("#sPreTitulo");
  ok(!(await page.isVisible(".pre-fundos .fundos-lista")), `${rotulo}: lista fecha ao clicar fora`);
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
  // reconhecimento de voz simulado: "ouve" uma frase até alguém clicar em parar
  await page.addInitScript(() => {
    class FalsoReconhecimento {
      start() { window.__ditadoAtivo = true; setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "Crie 3 slides sobre o plano de vendas" }], { isFinal: true })] }), 150); }
      stop() { window.__ditadoAtivo = false; setTimeout(() => this.onend && this.onend(), 30); }
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = FalsoReconhecimento;
  });
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
  await page.click("#sMenu .fundo-virtual");
  ok(await page.$$eval("#sMenu .fundos-lista .fundo-op", (b) => b.length) === 7, "anfitrião: 6 fundos prontos + Sua foto na lista");
  await page.click('#sMenu [data-fundo="img:claro"]');
  await page.waitForTimeout(2500);
  ok((await page.textContent("#sMenu .fundo-virtual")).includes("Escritório") && (await page.getAttribute("#sMenu .fundo-virtual", "class")).includes("sel") && erros.length === 0, "anfitrião: fundo virtual Escritório " + erros.join(" | "));
  ok(await page.evaluate(() => document.querySelector(".tile.local").classList.contains("sem-espelho")), "anfitrião: fundo virtual não espelhado");
  await page.click("#sMenu .fundo-virtual"); await page.click('#sMenu [data-fundo="img:chicago"]'); await page.waitForTimeout(600);
  ok((await page.textContent("#sMenu .fundo-virtual")).includes("Chicago") && erros.length === 0, "anfitrião: troca de imagem direto pela lista");
  await page.click("#sMenu .fundo-virtual");
  // foto própria: fica só no navegador
  const foto = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1200; c.height = 800; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 1200, 800); gr.addColorStop(0, "#2a6"); gr.addColorStop(1, "#14a"); g.fillStyle = gr; g.fillRect(0, 0, 1200, 800); return c.toDataURL("image/jpeg", 0.9).split(",")[1]; });
  await page.setInputFiles("#sFotoFundo", { name: "minha-foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from(foto, "base64") });
  await page.waitForTimeout(2500);
  ok((await page.textContent("#sMenu .fundo-virtual")).includes("Sua foto"), "anfitrião: fundo com a própria foto");
  if (!(await page.isVisible("#sMenu .fundos-lista"))) await page.click("#sMenu .fundo-virtual");
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
  // layout: apresentação no palco, painel de controle ao lado e câmeras na coluna da direita
  ok(await page.isVisible("#sGrade .tile.apres") && (await page.$$eval("#sGrade .tile", (t) => t.length)) === 1, "anfitrião: rascunho da apresentação ocupa o palco");
  ok((await page.textContent("#sGrade .tile.apres")).includes("Rascunho"), "anfitrião: palco indica que é rascunho");
  ok(await page.isVisible("#sFaixa") && (await page.$$eval("#sFaixaLista .tile", (t) => t.length)) >= 2, "anfitrião: câmeras na coluna da direita");
  const ordem = await page.evaluate(() => ["#sPalco", "#sLateral", "#sFaixa"].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().left)));
  ok(ordem[0] < ordem[1] && ordem[1] < ordem[2], "anfitrião: ordem palco, painel, participantes " + ordem.join(","));
  // arrastar a borda entre o palco e o painel
  const larg0 = await page.$eval("#sLateral", (e) => e.offsetWidth);
  const dv = await page.$eval("#sDivisor", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(dv.x, dv.y); await page.mouse.down(); await page.mouse.move(dv.x - 120, dv.y, { steps: 6 }); await page.mouse.up();
  const larg1 = await page.$eval("#sLateral", (e) => e.offsetWidth);
  ok(larg1 - larg0 > 100, `anfitrião: arrastar a borda alarga o painel (${larg0} → ${larg1})`);
  ok(await page.evaluate(() => Number(localStorage.getItem("emeet-lat-slides"))) === larg1, "anfitrião: largura do painel fica salva");
  // esconder e mostrar a coluna de participantes
  const palco0 = await page.$eval("#sPalco", (e) => e.offsetWidth);
  await page.click("#sFaixaFechar"); await page.waitForTimeout(150);
  ok(!(await page.isVisible("#sFaixa")) && await page.isVisible("#sFaixaAbrir"), "anfitrião: esconde a coluna de participantes");
  ok((await page.$eval("#sPalco", (e) => e.offsetWidth)) > palco0, "anfitrião: palco cresce sem a coluna");
  await page.click("#sFaixaAbrir"); await page.waitForTimeout(150);
  ok(await page.isVisible("#sFaixa"), "anfitrião: mostra a coluna de novo");
  // sugestões num menu suspenso
  ok(!(await page.isVisible("#apSugestoes")) && await page.isVisible("#apSugBtn"), "anfitrião: sugestões ficam fechadas num botão");
  await page.click("#apSugBtn");
  ok(await page.isVisible("#apSugestoes") && (await page.$$eval("#apSugestoes [data-sug]", (b) => b.length)) >= 3, "anfitrião: botão Sugestões abre o menu");
  await page.click('#apSugestoes [data-completar="1"]');
  ok(!(await page.isVisible("#apSugestoes")) && (await page.inputValue("#apTexto")).startsWith("Mude o título"), "anfitrião: escolher sugestão fecha o menu e preenche o pedido");
  await page.fill("#apTexto", "");
  // ditado: um clique grava (botão vira parar), outro clique para e o texto fica na caixa, sem enviar
  const msgs0 = await page.$$eval("#apConversa .ap-msg", (m) => m.length);
  await page.click("#apDitar"); await page.waitForTimeout(500);
  ok((await page.getAttribute("#apDitar", "aria-label")) === "Parar a gravação" && (await page.inputValue("#apTexto")).includes("plano de vendas"), "anfitrião: gravando, botão vira parar e transcreve");
  ok(!(await page.$("#apGravando")), "anfitrião: sem faixa de Gravando");
  await page.click("#apDitar"); await page.waitForTimeout(800);
  ok((await page.inputValue("#apTexto")).includes("plano de vendas") && (await page.$$eval("#apConversa .ap-msg", (m) => m.length)) === msgs0 && (await page.getAttribute("#apDitar", "aria-label")) === "Gravar o pedido por voz", "anfitrião: parar deixa o texto na caixa sem enviar");
  await page.click("#apEnviar"); await page.waitForTimeout(1500);
  ok((await page.textContent("#apConversa")).includes("plano de vendas") && (await page.$$eval("#apConversa .ap-msg", (m) => m.length)) > msgs0, "anfitrião: enviar manda o pedido revisado");
  // apagar a apresentação (com confirmação) e recuperar com Desfazer
  await page.click("#apApagar");
  ok(await page.isVisible("#sModal") && (await page.textContent("#sModalTit")) === "Apagar apresentação", "anfitrião: pede confirmação para apagar");
  await page.click('#sModalAcoes button:has-text("Apagar")'); await page.waitForTimeout(300);
  ok(!(await page.$("#sGrade .tile.apres")) && await page.isDisabled("#apApagar") && !(await page.isVisible("#sFaixa")), "anfitrião: apresentação apagada e o palco volta à grade");
  await page.click("#apDesfazer"); await page.waitForTimeout(300);
  ok(!!(await page.$("#sGrade .tile.apres")), "anfitrião: Desfazer recupera a apresentação");
  await page.screenshot({ path: `${OUT}/meet-anfitriao.png` });
  ok(erros.length === 0, "anfitrião: sem erros de JavaScript " + erros.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
