// My WhatsApp Manager · a extensão de verdade carregada no Chromium, num WhatsApp Web falso (tests/fixtures/whatsapp-falso.html)
// e com a função whatsapp simulada por um servidor local. Cobre: conectar, painel empurrando a página, IA Takeover com
// tempos humanos e digitação visível, não responder mensagem antiga, abrir conversa não lida, parar quando a pessoa digita,
// ferramentas (sugerir, comando, lead, agenda, prontas), grupo (assuntos e aviso do Takeover), pausar e recolher.
//   node tests/whatsapp-ext.e2e.mjs [pasta-capturas]
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(AQUI, "../wa-extension");
const FAKE = fs.readFileSync(path.join(AQUI, "fixtures/whatsapp-falso.html"), "utf8");
const OUT = process.argv[2] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- função whatsapp simulada ---------- */
const chamadas = [];
let logId = 0;
const ajustes = { takeover: true, takeover_individual: true, espera_min: 1, espera_max: 1, velocidade: 600, variacao: 0, pausa_min: 0, pausa_max: 0, digitar_max: 6, limite_hora: 20, grupo_intervalo: 10,
  texto_aviso: "Olá! Aqui é o assistente virtual da Endeavor.", idioma: "pt-BR", negocio: "Endeavor", link_agenda: "https://endeavorbiz.com/booking.html", horario: { ativo: false, inicio: "08:00", fim: "20:00", tz: "America/New_York" },
  prontas: [{ titulo: "Saudação", texto: "Olá! Como posso ajudar?" }] };
const conversas = {};
function responder(b) {
  chamadas.push(b);
  if (b.token !== "wam_TESTE_abcdefghijklmnopqrstuvwxyz") return [401, { erro: "Este código de conexão foi desligado." }];
  switch (b.acao) {
    case "ext_iniciar": return [200, { ajustes, version: 3, conversas: Object.values(conversas), usuario: "admin@teste", ia: true }];
    case "ext_ping": return [200, { version: 3 }];
    case "ext_conversa": { const c = conversas[b.conversa.chave] = { ...(conversas[b.conversa.chave] || { seguir: true, takeover: !b.conversa.grupo }), ...b.conversa, ...(typeof b.seguir === "boolean" ? { seguir: b.seguir } : {}), ...(typeof b.takeover === "boolean" ? { takeover: b.takeover } : {}) }; return [200, { conversa: c }]; }
    case "ext_ajustes": Object.assign(ajustes, b.ajustes); return [200, { ajustes, version: 4 }];
    case "ext_registrar": return [200, { ok: true }];
    case "ext_lead": return [200, { ok: true, novo: true, lead_id: "L1", link: "https://endeavorbiz.com/admin.html#/crm" }];
    case "ext_horarios": { const h = [1, 2, 3, 4].map((d) => new Date(Date.now() + d * 86400000).toISOString()); return [200, { horarios: h, legiveis: h.map((x, i) => "Dia " + (i + 1) + " 10:00"), timezone: "America/New_York" }]; }
    case "ext_agendar": return [200, { ok: true, quando: "Dia 1 10:00", mensagem: "Pronto! Sua conversa está marcada para Dia 1 10:00." }];
    case "ext_ia": {
      logId++;
      const f = b.ferramenta;
      if (f === "responder" && (b.mensagens || []).some((m) => /lista de documentos/.test(m.texto))) return [200, { responder: true, texto: "Por compliance não recebemos documentos por aqui. Qual é o seu nome completo e e-mail? Vou mandar a lista e um link seguro.", escalar: false, log_id: logId, aviso_incluido: false, fluxo_info: { id: "documentos", nome: "Pedido de documentos", status: "coletando", falta: ["nome", "email"] } }];
      if (f === "responder") return [200, { responder: true, texto: "Olá! Aqui é o assistente virtual da Endeavor. Posso te ajudar com a LLC.", escalar: false, log_id: logId, aviso_incluido: true }];
      if (f === "sugerir") return [200, { resposta: "Sugestão principal", alternativas: ["Alternativa curta"], log_id: logId }];
      if (f === "grupo") return [200, { topicos: [{ assunto: "EIN", resumo: "Perguntas sobre como tirar o EIN" }], relevante: true, responder: false, texto: "A Endeavor pode ajudar com o EIN.", log_id: logId }];
      if (f === "comando") return [200, { acao: "escrever", texto: "Amanhã eu ligo às 10h.", log_id: logId }];
      if (f === "lead") return [200, { nome: "Maria Teste", email: "maria@exemplo.com", telefone: "", assunto: "LLC na Flórida", resumo: "Quer abrir LLC." }];
      return [200, { log_id: logId }];
    }
  }
  return [400, { erro: "Ação desconhecida." }];
}
const srv = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  let d = ""; req.on("data", (c) => d += c); req.on("end", () => { const [st, j] = responder(JSON.parse(d || "{}")); res.writeHead(st, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify(j)); });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const API = `http://127.0.0.1:${srv.address().port}/whatsapp`;

/* ---------- Chromium com a extensão ---------- */
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "emgr-"));
const ctx = await chromium.launchPersistentContext(perfil, { channel: "chromium", headless: true, viewport: { width: 1400, height: 860 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
await sw.evaluate((u) => new Promise((r) => chrome.storage.local.set({ api_base: u }, r)), API);
await ctx.route("https://web.whatsapp.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: FAKE }));
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("https://web.whatsapp.com/" + (process.env.MODERNO ? "?moderno=1" : ""));
const P = (s) => page.locator("#emgr-host " + s);
const ia = (f) => chamadas.filter((c) => c.acao === "ext_ia" && c.ferramenta === f);
const enviadas = () => page.evaluate(() => window.__enviadas || []);
const caixa = () => page.evaluate(() => document.querySelector("#main footer [contenteditable]")?.innerText || "");

try {
  /* conectar */
  await P("#conectar").waitFor({ state: "visible", timeout: 10000 });
  ok(true, "sem código, o painel pede a conexão");
  await P("#cod").fill("wam_TESTE_abcdefghijklmnopqrstuvwxyz");
  await P("#cod-ir").click();
  await P("#app").waitFor({ state: "visible", timeout: 5000 });
  ok(await P("#quem").textContent() === "admin@teste", "conectado: mostra a conta");
  ok(await page.evaluate(() => document.documentElement.classList.contains("emgr-aberto")), "painel aberto empurra o WhatsApp (classe na página)");
  const largApp = await page.evaluate(() => document.getElementById("app").getBoundingClientRect().width);
  ok(largApp <= 1400 - 370, "o WhatsApp encolhe para o painel não cobrir a conversa (" + Math.round(largApp) + "px)");
  ok(await P("#tk-geral").isChecked(), "IA Takeover começa ligado");

  /* mensagem antiga não é respondida */
  await page.evaluate(() => window.abrirConversa("15551230000@c.us"));
  await dorme(2500);
  ok(ia("responder").length === 0, "ao abrir a conversa, a mensagem antiga (08:00) não é respondida");
  ok((await P("#conv").textContent()).includes("Maria Teste"), "o painel mostra a conversa aberta");
  ok(await P("#c-tk").isChecked(), "conversa individual entra com Takeover ligado");

  /* mensagem nova: Takeover responde com espera, digitação visível e envio */
  await page.evaluate(() => window.chegar("15551230000@c.us", "Vocês atendem em português?"));
  await P("#agora.espera").waitFor({ timeout: 6000 });
  ok(/esperando para digitar/i.test(await P("#agora-txt").textContent()), "painel mostra a espera antes de digitar");
  await P("#agora.digitando").waitFor({ timeout: 4000 });
  await dorme(600);
  const parcial = await caixa();
  ok(parcial.length > 0 && parcial.length < 70, "a IA digita aos poucos na caixa (visível: \"" + parcial.slice(0, 20) + "…\")");
  await page.screenshot({ path: path.join(OUT, "wa-digitando.png") });
  await page.waitForFunction(() => (window.__enviadas || []).length >= 1, null, { timeout: 15000 });
  const env = await enviadas();
  ok(env[0].t.startsWith("Olá! Aqui é o assistente virtual"), "enviou a resposta com o aviso de assistente virtual");
  await dorme(500);
  const reg = chamadas.find((c) => c.acao === "ext_registrar" && c.status === "enviado");
  ok(!!reg && reg.aviso_incluido === true && reg.log_id === 1, "registro: enviado, com o aviso marcado");
  ok(ia("responder")[0].mensagens.some((m) => m.texto.includes("português")), "a IA recebeu as mensagens da conversa");
  await page.screenshot({ path: path.join(OUT, "wa-enviado.png") });

  /* fluxo de documentos: o painel mostra o andamento (coletando · falta nome, e-mail) */
  await page.evaluate(() => window.chegar("15551230000@c.us", "Me manda a lista de documentos"));
  await page.waitForFunction(() => (window.__enviadas || []).some((e) => /compliance/.test(e.t)), null, { timeout: 15000 });
  await P("#conv-fluxo").waitFor({ timeout: 3000 });
  ok(/Pedido de documentos.*falta nome, e-mail/.test(await P("#conv-fluxo").textContent()), "fluxo: painel mostra o andamento e o que falta");
  await page.waitForTimeout(800);

  /* conversa não lida (outra conversa): o Takeover abre e responde */
  await page.evaluate(() => window.chegar("15559990000@c.us", "Olá, quero informações"));
  await page.waitForFunction(() => (window.__enviadas || []).some((e) => e.k === "15559990000@c.us"), null, { timeout: 20000 });
  ok(true, "conversa não lida com Takeover: a IA abriu e respondeu");

  /* a pessoa começa a digitar: a IA para e deixa o texto */
  await page.evaluate(() => window.abrirConversa("15551230000@c.us"));
  await dorme(1500);
  const antes = (await enviadas()).length;
  await page.evaluate(() => window.chegar("15551230000@c.us", "E o EIN?"));
  await P("#agora.digitando").waitFor({ timeout: 8000 });
  await page.click("#main footer [contenteditable]");
  await page.keyboard.type(" eu");
  await dorme(2500);
  ok((await enviadas()).length === antes, "quando a pessoa digita, a IA não envia");
  ok(/Você assumiu/.test(await P("#agora-txt").textContent()), "painel avisa que você assumiu");
  ok(chamadas.some((c) => c.acao === "ext_registrar" && c.status === "descartado"), "registro: descartado");
  await page.evaluate(() => { document.querySelector("#main footer [contenteditable]").innerHTML = ""; });

  /* ferramentas: sugerir e digitar na caixa (sem enviar) */
  await P('[data-f="sugerir"]').click();
  await P(".cartao").first().waitFor({ timeout: 5000 });
  ok(await P(".cartao").count() === 2, "sugerir: sugestão e alternativa");
  const n = (await enviadas()).length;
  await P('.cartao [data-k="digitar"]').first().click();
  await page.waitForFunction(() => (document.querySelector("#main footer [contenteditable]")?.innerText || "").includes("Sugestão principal"), null, { timeout: 8000 });
  await dorme(400);
  ok((await enviadas()).length === n, "\"Digitar na caixa\" escreve sem enviar");
  ok(chamadas.some((c) => c.acao === "ext_registrar" && c.status === "aprovado"), "registro: aprovado");
  await page.evaluate(() => { document.querySelector("#main footer [contenteditable]").innerHTML = ""; });

  /* comando por texto */
  await P("#cmd").fill("diga que amanhã eu ligo às 10h");
  await P("#cmd-ir").click();
  await P(".cartao textarea").first().waitFor({ timeout: 5000 });
  ok((await P(".cartao textarea").first().inputValue()) === "Amanhã eu ligo às 10h.", "comando vira mensagem pronta para revisar");
  ok(ia("comando")[0].pedido.includes("amanhã"), "o comando vai para a IA");

  /* lead no CRM com confirmação */
  await P('[data-f="lead"]').click();
  await P("#f-lead").waitFor({ timeout: 5000 });
  if (process.env.MODERNO) { ok(await P('#f-lead [name="telefone"]').inputValue() === "", "lead: contato salvo por nome, sem número na página: telefone fica para digitar"); await P('#f-lead [name="telefone"]').fill("+15551230000"); }
  else ok(await P('#f-lead [name="telefone"]').inputValue() === "+15551230000", "lead: telefone vem da conversa");
  ok(!chamadas.some((c) => c.acao === "ext_lead"), "lead: nada é criado antes de confirmar");
  await P("#f-lead button").click();
  await P(".bloco.ok").waitFor({ timeout: 5000 });
  const lead = chamadas.find((c) => c.acao === "ext_lead");
  ok(lead && lead.email === "maria@exemplo.com" && lead.nome === "Maria Teste", "lead criado com os dados confirmados");

  /* agendamento */
  await P('[data-f="agenda"]').click();
  await P("#f-ag").waitFor({ timeout: 5000 });
  ok((await P(".cartao textarea").first().inputValue()).includes("Dia 1 10:00"), "agenda: mensagem com horários livres reais");
  await P('#f-ag [name="email"]').fill("maria@exemplo.com");
  if (process.env.MODERNO) await P('#f-ag [name="telefone"]').fill("+15551230000");
  await P("#f-ag button").click();
  await P(".bloco.ok").waitFor({ timeout: 5000 });
  ok(chamadas.some((c) => c.acao === "ext_agendar" && c.telefone === "+15551230000"), "agenda: marcou com os dados confirmados");

  /* respostas prontas */
  await P('[data-f="prontas"]').click();
  ok((await P("#res").textContent()).includes("Olá! Como posso ajudar?"), "respostas prontas aparecem no painel");

  /* grupo: assuntos e sugestão; Takeover do grupo pede confirmação */
  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  await dorme(1500);
  ok(await P("#grupo").isVisible(), "grupo: seção de assuntos aparece");
  ok(!(await P("#c-tk").isChecked()), "grupo: Takeover começa desligado");
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "A Endeavor faz EIN?", "Pedro"));
  await P("#grupo .topicos").waitFor({ timeout: 8000 });
  ok((await P("#grupo").textContent()).includes("EIN"), "grupo: a IA resume os assuntos");
  ok(await P("#grupo .cartao").count() === 1, "grupo: sugere a resposta");
  ok(ia("grupo").at(-1).takeover !== true && ia("grupo").at(-1).mensagens.some((m) => m.autor === "Pedro"), "grupo: monitorando (sem Takeover) e com o autor de cada mensagem");
  ok(!(await enviadas()).some((e) => e.k.endsWith("@g.us")), "grupo: nada enviado sozinho");
  await P("#c-tk").click({ force: true });
  ok(await P("#c-tk-aviso").isVisible(), "grupo: ligar o Takeover mostra o aviso de risco");
  await P("#c-tk-sim").click();
  await dorme(500);
  ok(chamadas.some((c) => c.acao === "ext_conversa" && c.takeover === true && c.conversa.grupo === true), "grupo: Takeover ligado só depois de confirmar");
  await page.screenshot({ path: path.join(OUT, "wa-grupo.png") });

  /* pausar: nada sai sozinho */
  await page.evaluate(() => window.abrirConversa("15551230000@c.us"));
  await dorme(1200);
  await P("#pausar").click();
  const r0 = ia("responder").length;
  await page.evaluate(() => window.chegar("15551230000@c.us", "Oi de novo"));
  await dorme(3000);
  ok(ia("responder").length === r0, "em pausa, o Takeover não responde");
  await P("#pausar").click();

  /* tempos humanos ajustáveis */
  await P("#tempos summary").click();
  await P('[data-t="velocidade"]').fill("300");
  await P('[data-t="velocidade"]').dispatchEvent("change");
  await dorme(1200);
  ok(chamadas.some((c) => c.acao === "ext_ajustes" && c.ajustes.velocidade === 300), "tempos: velocidade salva");

  /* modo escuro: botões legíveis (texto claro sobre fundo escuro) */
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);
  const cor = await P('[data-f="resumo"]').evaluate((b) => { const s = getComputedStyle(b); return { fundo: s.backgroundColor, texto: s.color }; });
  const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const L1 = lum(cor.texto), L2 = lum(cor.fundo), contraste = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  ok(contraste >= 4.5, "modo escuro: botões com contraste legível (" + contraste.toFixed(1) + ":1)");
  await page.screenshot({ path: path.join(OUT, "wa-escuro.png") });
  await page.emulateMedia({ colorScheme: "light" });

  /* recolher e abrir */
  await P("#recolher").click();
  ok(await P("#aba").isVisible() && !(await page.evaluate(() => document.documentElement.classList.contains("emgr-aberto"))), "recolhido: só a aba fica e o WhatsApp volta à largura toda");
  await P("#aba").click();
  ok(await P("#p").isVisible(), "a aba abre o painel de novo");
} catch (e) {
  console.error(e); falhas.push("exceção: " + e.message);
  await page.screenshot({ path: path.join(OUT, "wa-falha.png") }).catch(() => { });
} finally {
  await ctx.close(); srv.close(); fs.rmSync(perfil, { recursive: true, force: true });
}
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
