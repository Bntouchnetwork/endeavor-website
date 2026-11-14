// Web Meeting: painel de ações (IA) no navegador, em modo demonstração (integrações simuladas).
// Roteiro: participante informa o e-mail no chat, conversa define serviços e valores, a IA prepara a proposta,
// o organizador confirma o destinatário e manda enviar, pede documentos, cria tarefa, agenda e remarca,
// gera e envia a ata. Também: destinatário ambíguo, comando de convidado (sem permissão), comando repetido,
// pausa da IA e tema claro.
//   1. python3 -m http.server 8092      2. node tests/meet-actions.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8092";
const OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] });
const page = await ctx.newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.route("**/functions/v1/meet", (r) => r.fulfill({ status: 404, json: { erro: "Sala não encontrada" } }));
await page.goto(`${BASE}/reuniao.html?s=eb-acoes12345`);
await page.waitForFunction(() => !!window.EMeetRoom && !!window.EMeetAcoesPainel);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } window.EMeetRoom.abrir({ sala: "eb-acoes12345", titulo: "Abertura ACME", papel: "mentor", nome: "Ana Organizadora", demo: true }); });
await page.click("#sEntrar");
await page.waitForSelector(".sala.no-ar");

const card = (tipo) => page.locator(`#painelAcoes .ac-card[data-id^="${tipo}-"]`).first();
const textoCard = async (tipo) => (await card(tipo).count()) ? await card(tipo).innerText() : "";
const fala = (nome, t) => page.evaluate(([n, x]) => window.EMeetRoom.simular.fala(n, x), [nome, t]);
const chat = (nome, t) => page.evaluate(([n, x]) => window.EMeetRoom.simular.chat(n, x), [nome, t]);
const comandoChat = async (t) => { if (!(await page.isVisible("#sTexto"))) await page.click('.abas [data-aba="chat"]'); await page.fill("#sTexto", t); await page.press("#sTexto", "Enter"); await page.waitForTimeout(250); await page.click('.abas [data-aba="acoes"]'); };

// abrir o painel e ligar a IA
await page.click("#sMais"); await page.click('#sMenu [data-f="acoes"]');
ok(await page.isVisible("#painelAcoes"), "painel de ações abre pelo menu Mais");
ok((await page.textContent("#painelAcoes")).includes("IA desligada"), "começa desligada");
await page.click('#painelAcoes [data-ac="ligar"]');
ok(await page.isVisible("#sIA.on") && (await page.textContent("#sIA")).includes("IA acompanhando"), "selo visível: IA acompanhando");
ok((await page.textContent("#sEstLeg").catch(() => "")) !== "Desligadas", "transcrição (legendas) ligada junto");

// conversa
await chat("Carlos Lima", "Meu e-mail é carlos@acme.com");
await fala("Carlos Lima", "Queremos abrir a LLC e precisamos da contabilidade mensal.");
await fala("Ana Organizadora", "A abertura de LLC fica por US$ 1.500 e a contabilidade sai por US$ 300 por mês.");
await fala("Carlos Lima", "Fechado, vamos com os dois serviços.");
await fala("Ana Organizadora", "Vou te mandar a proposta hoje. Também preciso do passaporte e do comprovante de endereço até sexta.");
await page.waitForTimeout(300);
const prop = await textoCard("proposta");
ok(/Abertura de LLC/.test(prop) && /1,500\.00/.test(prop) && /300\.00\/mês/.test(prop), "proposta com os serviços e valores falados");
ok(/carlos@acme\.com/.test(prop) && /confirmar o destinatário/.test(prop), "destinatário do chat, pedindo confirmação");
ok((await page.textContent("#painelAcoes")).includes("Fechado, vamos com os dois serviços."), "decisão registrada");
await page.screenshot({ path: `${OUT}/acoes-sugestoes.png` });

// enviar antes de confirmar: não envia
await card("proposta").locator('[data-ac="executar"]').click({ force: true }); await page.waitForTimeout(200);
ok(!/Concluída/.test(await textoCard("proposta")), "sem confirmar o destinatário, não envia");
// organizador confirma e manda enviar pelo chat (comando não vai para a sala)
await page.check('#painelAcoes [data-confirma="carlos@acme.com"]');
await comandoChat("IA, envia a proposta para o Carlos");
ok(!(await page.textContent("#sMsgs")).includes("Ana Organizadora (você)IA, envia") && (await page.textContent("#sMsgs")).includes("Comando para a IA"), "comando do organizador fica fora do chat da sala");
await page.waitForTimeout(300);
const feitas = await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts();
ok(feitas.some((t) => /Proposta/.test(t) && /Enviado para carlos@acme\.com/.test(t)), "proposta enviada (simulação) ao destinatário confirmado");

// documentos + tarefa
await comandoChat("IA, solicita os documentos");
await page.waitForTimeout(300);
ok((await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts()).some((t) => /Pedido de documentos/.test(t)), "pedido de documentos enviado");
ok(/Passaporte \(pendente\)/.test(await page.textContent("#painelAcoes")), "documentos pendentes acompanhados");
const tarefa = page.locator("#painelAcoes .ac-card", { hasText: "Vou te mandar a proposta hoje." }).first();
ok(/Ana Organizadora/.test(await tarefa.innerText()), "tarefa com responsável");
await tarefa.locator('[data-ac="executar"]').click(); await page.waitForTimeout(300);
ok((await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts()).some((t) => /Tarefa/.test(t)), "compromisso virou tarefa");

// agenda e remarca
await comandoChat("IA, agenda a reunião quinta às 10h");
await page.waitForTimeout(300);
ok((await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts()).some((t) => /Agendar reunião/.test(t) && /10:00/.test(t)), "reunião agendada");
await comandoChat("IA, remarca para sexta às 15h");
await page.waitForTimeout(300);
ok((await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts()).some((t) => /Remarcar reunião/.test(t) && /15:00/.test(t)), "reunião remarcada");

// comando repetido
await comandoChat("IA, solicita os documentos"); await comandoChat("IA, solicita os documentos");
const docsFeitos = (await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts()).filter((t) => /Pedido de documentos/.test(t));
ok(docsFeitos.length <= 2 && !(await page.locator("#painelAcoes .ac-card", { hasText: "Pedido de documentos" }).allInnerTexts()).some((t) => /Falhou/.test(t)), "comando repetido não duplica o envio");

// convidado tenta comandar: sem permissão
await chat("Carlos Lima", "IA, envia a cobrança");
await page.waitForTimeout(200);
ok(/ignorado: só o organizador/.test(await page.textContent("#painelAcoes")), "comando de convidado recusado");
ok(!(await page.locator("#painelAcoes .ac-card", { hasText: "Cobrança" }).count()), "nada criado pelo convidado");

// destinatário ambíguo
await chat("Maria Beta", "o meu é maria@beta.com");
await page.click('#painelAcoes [data-nova="cobranca"]'); await page.waitForTimeout(150);
const cob = await page.locator("#painelAcoes .ac-card", { hasText: "Cobrança" }).first().innerText();
ok(/Destinatário ambíguo/.test(cob) && /escolher o destinatário/.test(cob), "destinatário ambíguo: pede para escolher");
ok(/aprovação da cobrança/.test(cob), "cobrança pede aprovação");
await page.locator("#painelAcoes .ac-card", { hasText: "Cobrança" }).first().locator('[data-ac="descartar"]').click();

// pausa: o que é dito pausado não entra
await page.click('#painelAcoes [data-ac="pausar"]');
ok((await page.textContent("#sIA")).includes("IA pausada"), "selo mostra IA pausada");
await fala("Ana Organizadora", "O registered agent sai por US$ 200.");
await page.waitForTimeout(200);
ok(!/Registered agent/i.test(await page.textContent("#painelAcoes")), "fala durante a pausa não vira ação");
await page.click('#painelAcoes [data-ac="retomar"]');

// ata
await page.click('#painelAcoes [data-ac="ata"]'); await page.waitForTimeout(200);
const ataTxt = await page.textContent("#painelAcoes .ac-ata");
ok(/Participantes/.test(ataTxt) && /Decisões/.test(ataTxt) && /Fechado, vamos com os dois serviços/.test(ataTxt) && /Tarefas/.test(ataTxt) && /Pendências/.test(ataTxt), "ata com participantes, decisões, tarefas e pendências");
ok(await page.isChecked('#painelAcoes .ac-form [name="dest"][value="carlos@acme.com"]') && !(await page.isChecked('#painelAcoes .ac-form [name="dest"][value="maria@beta.com"]')), "ata marcada só para os confirmados");
await page.screenshot({ path: `${OUT}/acoes-ata.png` });
await page.locator("#painelAcoes .ac-card", { hasText: "Ata da reunião" }).first().locator('[data-ac="executar"]').click(); await page.waitForTimeout(300);
ok((await page.locator("#painelAcoes .ac-card.st-concluida").allInnerTexts()).some((t) => /Ata da reunião/.test(t) && /Enviado para carlos@acme\.com/.test(t) && !/maria/.test(t)), "ata enviada só para os selecionados");

// tema claro
await page.click("#sTema"); await page.waitForTimeout(150);
const fundo = await page.$eval(".sala-corpo", (e) => getComputedStyle(e.closest(".sala")).backgroundColor);
ok(await page.$eval(".sala", (e) => e.classList.contains("tema-claro")) && fundo.match(/\d+/g).slice(0, 3).every((n) => Number(n) > 200), "tema claro aplicado " + fundo);
ok(await page.evaluate(() => localStorage.getItem("emeet-tema")) === "claro", "tema lembrado");
await page.screenshot({ path: `${OUT}/acoes-claro.png` });
await page.click("#sTema");

ok(erros.length === 0, "sem erros de JavaScript " + erros.join(" | "));

// convidado vê o aviso da IA
{
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] });
  const p2 = await c2.newPage(); const e2 = []; p2.on("pageerror", (e) => e2.push(e.message));
  await p2.route("**/functions/v1/meet", (r) => r.fulfill({ status: 404, json: {} }));
  await p2.goto(`${BASE}/reuniao.html?s=eb-acoes12345`); await p2.waitForFunction(() => !!window.EMeetRoom);
  await p2.evaluate(() => window.EMeetRoom.abrir({ sala: "eb-acoes12345", titulo: "Abertura ACME", papel: "aluno", nome: "Convidado", demo: true }));
  await p2.click("#sEntrar"); await p2.waitForSelector(".sala.no-ar");
  ok(!(await p2.isVisible('.abas [data-aba="acoes"]')), "convidado não vê o painel de ações");
  ok(e2.length === 0, "convidado sem erros " + e2.join(" | "));
  await c2.close();
}
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
