// My WhatsApp Manager · a extensão de verdade carregada no Chromium, num WhatsApp Web falso (tests/fixtures/whatsapp-falso.html)
// e com a função whatsapp simulada por um servidor local. Cobre: conectar, painel empurrando a página, IA Takeover com
// tempos humanos e digitação visível, não responder mensagem antiga, abrir conversa não lida, parar quando a pessoa digita,
// painel fixo (barra de progresso com prévia, card do contato com Enviar para o CRM, comando), grupo sem resposta automática, pausar e recolher.
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
const ajustes = { takeover: true, takeover_individual: true, espera_min: 1, espera_max: 1, velocidade: 400, variacao: 0, pausa_min: 0, pausa_max: 0, digitar_max: 6, limite_hora: 20, grupo_intervalo: 10,
  texto_aviso: "Olá! Aqui é o assistente virtual da Endeavor.", idioma: "pt-BR", negocio: "Endeavor", link_agenda: "https://endeavorbiz.com/booking.html", horario: { ativo: false, inicio: "08:00", fim: "20:00", tz: "America/New_York" },
  prontas: [{ titulo: "Saudação", texto: "Olá! Como posso ajudar?" }] };
const conversas = {};
let lembretes = [];
function responder(b) {
  chamadas.push(b);
  if (b.token !== "wam_TESTE_abcdefghijklmnopqrstuvwxyz") return [401, { erro: "Este código de conexão foi desligado." }];
  switch (b.acao) {
    case "ext_iniciar": return [200, { ajustes, version: 3, conversas: Object.values(conversas), usuario: "admin@teste", ia: true }];
    case "ext_ping": return [200, { version: 3, lembretes }];
    case "ext_lembrete_bloqueado": return [200, { ok: true, motivo: "O número não está mais no grupo" }];
    case "ext_conversa": { const c = conversas[b.conversa.chave] = { ...(conversas[b.conversa.chave] || { seguir: true, takeover: !b.conversa.grupo }), ...b.conversa, ...(typeof b.seguir === "boolean" ? { seguir: b.seguir } : {}), ...(typeof b.takeover === "boolean" ? { takeover: b.takeover } : {}) }; return [200, { conversa: c }]; }
    case "ext_ajustes": Object.assign(ajustes, b.ajustes); return [200, { ajustes, version: 4 }];
    case "ext_registrar": return [200, { ok: true }];
    case "ext_lead": return [200, { ok: true, novo: true, lead_id: "L1", link: "https://endeavorbiz.com/admin.html#/crm" }];
    case "ext_horarios": { const h = [1, 2, 3, 4].map((d) => new Date(Date.now() + d * 86400000).toISOString()); return [200, { horarios: h, legiveis: h.map((x, i) => "Dia " + (i + 1) + " 10:00"), timezone: "America/New_York" }]; }
    case "ext_agendar": return [200, { ok: true, quando: "Dia 1 10:00", mensagem: "Pronto! Sua conversa está marcada para Dia 1 10:00." }];
    case "ext_ia": {
      logId++;
      const f = b.ferramenta;
      if (f === "responder" && b.origem_grupo) return [200, { responder: true, texto: "Olá! Aqui é o assistente virtual da Endeavor. Vi sua pergunta no grupo sobre LLC. Como é o seu nome?", escalar: false, log_id: logId, aviso_incluido: true }];
      if (f === "grupo" && /privado/.test(((b.mensagens || []).slice(-1)[0] || {}).texto || "")) { const u = b.mensagens.slice(-1)[0]; return [200, { topicos: [{ assunto: "LLC", resumo: "abrir LLC" }], relevante: true, responder: false, texto: "", interesse: [], privado: { autor: u.autor, assunto: "abrir LLC" }, log_id: logId, grupo_cfg: { modo: modoGrupo, limite_dia: 3, interesse: true, conteudo: true, por_semana: 1 } }]; }
      if (f === "responder" && (b.mensagens || []).some((m) => /lista de documentos/.test(m.texto))) return [200, { responder: true, texto: "Por compliance não recebemos documentos por aqui. Qual é o seu nome completo e e-mail? Vou mandar a lista e um link seguro.", escalar: false, log_id: logId, aviso_incluido: false, fluxo_info: { id: "documentos", nome: "Pedido de documentos", status: "coletando", falta: ["nome", "email"] } }];
      if (f === "responder") return [200, { responder: true, texto: "Olá! Aqui é o assistente virtual da Endeavor. Posso te ajudar com a LLC.", escalar: false, log_id: logId, aviso_incluido: true, contato: { nome: "Maria Teste", email: "maria@exemplo.com" } }];
      if (f === "sugerir") return [200, { resposta: "Sugestão principal", alternativas: ["Alternativa curta"], log_id: logId }];
      if (f === "grupo" && /mecânico/.test(((b.mensagens || []).slice(-1)[0] || {}).texto || "")) return [200, { topicos: [], relevante: false, responder: false, texto: "", interesse: [], log_id: logId, grupo_cfg: { modo: modoGrupo, limite_dia: 3, interesse: true, conteudo: true, por_semana: 1 } }];
      if (f === "grupo") {
        const auto = modoGrupo === "auto" && b.takeover === true;
        return [200, { topicos: [{ assunto: "EIN", resumo: "Perguntas sobre como tirar o EIN" }], relevante: true, responder: auto, texto: auto ? "Oi Pedro! Dá para tirar o EIN sem SSN; posso explicar no privado." : "A Endeavor pode ajudar com o EIN.", log_id: logId,
          interesse: [{ autor: "Carlos Novo", motivo: "quer abrir uma LLC", mensagem: "Oi Carlos, vi sua pergunta no grupo sobre LLC. Posso te ajudar? Quer agendar uma conversa?" }],
          conteudo_devido: true, usadas_hoje: 1, grupo_cfg: { modo: modoGrupo, limite_dia: 3, interesse: true, conteudo: true, por_semana: 1 } }];
      }
      if (f === "lembrete") { lembretes = []; return [200, { postar: true, texto: "Olá, pessoal! Somos a Endeavor e ajudamos a abrir empresa nos EUA. Quer conversar? Responda aqui ou chame no privado.", tema: "apresentação", log_id: logId }]; }
      if (f === "conteudo_grupo") return [200, { texto: "Dica: separe as contas da LLC desde o primeiro dia.", tema: "Contas da LLC", log_id: logId }];
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
let modoGrupo = "aprovar";
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
  ok((await P("#cv-nome").textContent()) === "Maria Teste", "o nome da conversa fica na linha de status do box");
  ok(await P(".geral").count() === 0 && await P("#agora .controles #tk-geral").count() === 1 && await P("#agora .controles #pausar").count() === 1 && await P("#agora .controles #monitorar").count() === 1 && await P("#agora .controles #mic").count() === 1, "IA Takeover, Pausar, Monitorar grupos, Falar e Enviar na linha de baixo do box (sem a seção do topo)");
  ok(await P("#app").evaluate((a) => a.firstElementChild.id === "agora"), "o box fica logo abaixo do cabeçalho do painel");
  const ordemBt = await P("#agora .controles").evaluate((l) => [...l.querySelectorAll("button, input")].map((e) => e.id).filter(Boolean));
  ok(JSON.stringify(ordemBt) === JSON.stringify(["mic", "cmd-ir", "pausar", "monitorar", "tk-geral"]), "botões na ordem Falar, Enviar, Pausar, Monitorar grupos e o switch IA Takeover à direita (" + ordemBt.join(", ") + ")");
  const tops = await P("#agora .controles").evaluate((l) => [...l.querySelectorAll("#mic, #cmd-ir, #pausar, #monitorar, .chave")].map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
  ok(Math.max(...tops) - Math.min(...tops) <= 4, "todos os botões numa linha só, na largura padrão do painel");
  await P("#agora").screenshot({ path: path.join(OUT, "wa-box.png") });
  ok(!(await P("#cmd-ir").textContent()).trim() && await P("#cmd-ir svg").count() === 1 && await P("#cmd-ir").getAttribute("aria-label") === "Enviar", "Enviar só com o ícone de flechinha");
  ok(await P("#monitorar svg").count() === 1 && !(await P("#monitorar").textContent()).trim(), "Monitorar grupos só com o ícone de grupo");
  ok(!(await P("#mic").textContent()).trim() && !(await P("#pausar").textContent()).trim() && await P("#mic").getAttribute("aria-label") === "Falar" && await P("#pausar").getAttribute("aria-label") === "Pausar IA", "Falar e Pausar só com ícones (com nome para leitor de tela)");
  const espaco = await P("#agora .controles").evaluate((l) => { const a = l.querySelector("#mic").getBoundingClientRect(), b = l.querySelector("#cmd-ir").getBoundingClientRect(); return b.left - a.right; });
  ok(espaco >= 8, "mais espaço entre os ícones (" + Math.round(espaco) + " px)");
  const altBox = await P("#agora").evaluate((b) => b.getBoundingClientRect().height / b.closest(".corpo").getBoundingClientRect().height);
  ok(altBox > 0.6, "conversa individual: o box ocupa a maior parte da tela (" + Math.round(altBox * 100) + "%)");
  ok(await P("#c-tk").count() === 0 && await P("#c-seguir").count() === 0, "sem chaves por conversa (só o IA Takeover geral e o Pausar)");
  ok(await P("[data-f]").count() === 0, "sem botões de ferramentas (só o comando)");
  ok(await P("#ct-tel").inputValue() === (process.env.MODERNO ? "" : "+15551230000"), "card do contato: telefone vem da conversa (contato salvo por nome: fica para digitar)");

  /* mensagem nova: Takeover responde com espera, digitação visível e envio */
  await page.evaluate(() => window.chegar("15551230000@c.us", "Vocês atendem em português?"));
  await P("#agora.espera").waitFor({ timeout: 6000 });
  ok(/^esperando para digitar/i.test(await P("#agora-txt").textContent()), "painel mostra a espera antes de digitar (sem o prefixo Takeover)");
  ok(/%$/.test(await P("#barra-pct").textContent()), "porcentagem na barra também durante a espera");
  await P("#agora.digitando").waitFor({ timeout: 4000 });
  await dorme(600);
  const parcial = await caixa();
  ok(parcial.length > 0 && parcial.length < 70, "a IA digita aos poucos na caixa (visível: \"" + parcial.slice(0, 20) + "…\")");
  ok(/%$/.test(await P("#barra-pct").textContent()) && await P("#barra-box.ativa").count() === 1, "barra de progresso com porcentagem enquanto digita");
  const esp = await P("#cmd").inputValue();
  ok(esp.length > 0 && await P("#cmd.espelho").count() === 1 && await P("#cmd").evaluate((e) => e.readOnly), "a área de texto do painel mostra a IA digitando (só leitura)");
  ok(await P(".rot").count() === 0 && await P("#previa").count() === 0, "sem a seção separada de comando e sem a prévia antiga");
  const ordem = await P("#app").evaluate((a) => { const c = a.querySelector("#conv"), t = a.querySelector("#agora"); return !!(t.compareDocumentPosition(c) & 4) && t.contains(a.querySelector("#cmd")) && t.contains(a.querySelector("#barra-box")) && t.contains(a.querySelector("#mic")); });
  ok(ordem, "um box só: barra, velocidade, área de texto e botões; o card do contato fica abaixo");
  await page.screenshot({ path: path.join(OUT, "wa-digitando.png") });
  await page.waitForFunction(() => (window.__enviadas || []).length >= 1, null, { timeout: 15000 });
  const env = await enviadas();
  ok(env[0].t.startsWith("Olá! Aqui é o assistente virtual"), "enviou a resposta com o aviso de assistente virtual");
  await dorme(500);
  ok(await P("#cmd").inputValue() === "" && await P("#cmd.espelho").count() === 0 && !(await P("#cmd").evaluate((e) => e.readOnly)), "depois do envio a área fica vazia e aberta para comandos");
  ok(!/Takeover vai responder/.test(await P("#res").textContent()), "sem a barra de baixo \"Takeover vai responder\"");
  const reg = chamadas.find((c) => c.acao === "ext_registrar" && c.status === "enviado");
  ok(!!reg && reg.aviso_incluido === true && reg.log_id === 1, "registro: enviado, com o aviso marcado");
  ok(ia("responder")[0].mensagens.some((m) => m.texto.includes("português")), "a IA recebeu as mensagens da conversa");
  ok(await P("#ct-nome").inputValue() === "Maria Teste" && await P("#ct-email").inputValue() === "maria@exemplo.com", "card do contato preenchido com o que a pessoa passou");
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

  /* card do contato: Enviar para o CRM */
  await P("#ct-crm").click();
  await P(".contato .tag.ok").waitFor({ timeout: 5000 });
  const lead0 = chamadas.find((c) => c.acao === "ext_lead");
  ok(lead0 && lead0.nome === "Maria Teste" && lead0.email === "maria@exemplo.com" && lead0.telefone === (process.env.MODERNO ? "" : "+15551230000"), "Enviar para o CRM leva nome, e-mail e telefone do card");

  /* comando por texto */
  await P("#cmd").fill("diga que amanhã eu ligo às 10h");
  await P("#cmd-ir").click();
  await P(".cartao textarea").first().waitFor({ timeout: 5000 });
  ok((await P(".cartao textarea").first().inputValue()) === "Amanhã eu ligo às 10h.", "comando vira mensagem pronta para revisar");
  ok(ia("comando")[0].pedido.includes("amanhã"), "o comando vai para a IA");

  /* grupo: área abaixo do box (assuntos, resposta para aprovar, interesse, dica da semana) */
  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  await P("#grupo .gc-sug").waitFor({ timeout: 6000 });
  const rotulos = await P("#grupo .gc .cartao-rot").allTextContents();
  ok(rotulos.length === 4 && /^Assuntos/.test(rotulos[0]) && /^Resposta sugerida/.test(rotulos[1]) && /^Interesse/.test(rotulos[2]) && /^Dica da semana/.test(rotulos[3]), "grupo: 4 cartões fixos na ordem Assuntos, Resposta sugerida, Interesse e Dica da semana");
  ok(await P("#grupo .g-cab").count() === 0 && !/Analisar de novo/.test(await P("#grupo").textContent()), "sem a linha de informações nem o Analisar de novo");
  await P("#grupo .topicos").waitFor({ timeout: 6000 });
  ok((await P("#grupo .topicos").textContent()).includes("EIN") && (await P("#cv-cont").textContent()) === "você aprova", "grupo: assuntos no cartão e o modo no canto da linha de status");
  ok(await P("#grupo").evaluate((g, a) => { const t = a.querySelector("#agora"); return !!(t.compareDocumentPosition(g) & 4); }, await P("#app").elementHandle()), "a área do grupo fica abaixo do box do Takeover");
  ok((await P(".gc-int").textContent()).includes("Carlos Novo") && /Oi Carlos/.test(await P("#gc-int-t").inputValue()), "grupo: avisa quem mostrou interesse, com a mensagem para o privado");
  await page.waitForFunction(() => /separe as contas/.test(document.getElementById("emgr-host").shadowRoot.getElementById("gc-dica-t").value), null, { timeout: 5000 });
  ok(ia("conteudo_grupo").length === 1 && await P(".gc-dica [data-a=dica-ok]").isEnabled(), "grupo: dica da semana já pronta para postar ao abrir o grupo");
  const g0 = ia("responder").length;
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "A Endeavor faz EIN?", "Pedro"));
  await dorme(3000);
  ok(ia("responder").length === g0 && !(await enviadas()).some((e) => e.k.endsWith("@g.us")), "grupo em modo aprovação: nada enviado sozinho");
  ok(ia("grupo").some((x) => x.takeover === true), "mensagem nova no grupo: o servidor decide pelo modo do grupo");
  await page.screenshot({ path: path.join(OUT, "wa-grupo.png") });
  await P(".gc-sug [data-a=sug-ok]").click();
  await page.waitForFunction(() => (window.__enviadas || []).some((e) => e.k.endsWith("@g.us")), null, { timeout: 15000 });
  ok((await enviadas()).some((e) => e.k.endsWith("@g.us") && /EIN/.test(e.t)), "Aprovar e enviar: a resposta vai para o grupo");
  await dorme(600);
  await P(".gc-dica [data-a=dica-ok]").click();
  await page.waitForFunction(() => (window.__enviadas || []).some((e) => /separe as contas/.test(e.t)), null, { timeout: 15000 });
  await dorme(500);
  ok(chamadas.some((c) => c.acao === "ext_registrar" && c.ferramenta === "conteudo_grupo" && c.status === "enviado"), "Aprovar e postar: a dica vai para o grupo e fica registrada");
  /* modo automático (com limite por dia, conferido no servidor) */
  modoGrupo = "auto";
  const nG = (await enviadas()).length;
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "Alguém sabe se precisa de SSN para o EIN?", "Pedro"));
  await page.waitForFunction((n) => (window.__enviadas || []).length > n, nG, { timeout: 90000 });
  ok((await enviadas()).slice(-1)[0].t.includes("sem SSN"), "grupo no automático: a IA respondeu sozinha");
  await dorme(800);
  ok((await P("#cv-cont").textContent()) === "2 de 3", "contador no canto da linha de status: respostas automáticas de hoje (" + (await P("#cv-cont").textContent()) + ")");
  modoGrupo = "aprovar";
  /* puxar para o privado */
  await P(".gc-int [data-a=priv]").click();
  await page.waitForFunction(() => (document.querySelector("#main header") || {}).textContent?.includes("Carlos Novo"), null, { timeout: 6000 });
  await page.waitForFunction(() => /Oi Carlos/.test(document.querySelector("#main footer [contenteditable]").textContent), null, { timeout: 15000 });
  ok(!(await enviadas()).some((e) => /Oi Carlos/.test(e.t)), "Abrir privado: abre a conversa e digita a mensagem, sem enviar");
  await page.evaluate(() => window.abrirConversa("15551230000@c.us")); // troca de conversa no meio da digitação
  await dorme(1200);
  ok(!/Oi Carlos/.test(await caixa()) && /trocou de conversa/.test(await P("#agora-txt").textContent()), "trocar de conversa enquanto a IA digita: ela para e não digita na outra conversa");
  await page.evaluate(() => { document.querySelector("#main footer [contenteditable]").innerHTML = ""; });

  /* grupo novo, só 2 pessoas, sem a lista de participantes no cabeçalho: tem que ser reconhecido como grupo */
  if (process.env.MODERNO) for (const [k, nomeG] of [["novo1@g.us", "Teste Endeavor"], ["novo2@g.us", "Teste Sistema"]]) {
    await page.evaluate((x) => window.abrirConversa(x), k);
    await dorme(1200);
    const r1 = ia("responder").length;
    await page.evaluate((x) => window.chegar(x, "Alguém sabe como abrir LLC?", "Endeavor Teste"), k);
    await dorme(3500);
    ok(await P("#cv-grupo").isVisible() && (await P("#cv-grupo").textContent()) === "Grupo" && await P(".agora-lin > .pt").first().isHidden() && await P("#conv").isHidden(), nomeG + ": reconhecido como grupo (" + (k === "novo1@g.us" ? "cabeçalho com dados do grupo" : "aviso de grupo criado") + ")");
    ok(ia("responder").length === r1 && !(await enviadas()).some((e) => e.k === k), nomeG + ": o Takeover individual não responde no grupo");
    ok(ia("grupo").some((x) => x.conversa.nome === nomeG && x.conversa.grupo === true), nomeG + ": vai para a IA como grupo");
    ok(await P("#grupo .gc").count() === 4 && (await P("#gc-sug-t").getAttribute("placeholder")) === "Nada ainda", nomeG + ": os 4 cartões já montados, com \"Nada ainda\" como texto de espera");
  }

  /* grupo: sem card separado, cartões fixos (o painel não rola) */
  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  await P("#grupo .gc-ass").waitFor({ timeout: 6000 });
  await dorme(800);
  ok(await P("#conv").isHidden() && await P("#cv-grupo").isVisible() && await P("#cv-grupo").evaluate((g) => !!(g.compareDocumentPosition(g.parentElement.querySelector("#cv-nome")) & 4)), "grupo: etiqueta verde Grupo antes do nome, na linha de status");
  const rolG = await page.evaluate(() => { const r = document.getElementById("emgr-host").shadowRoot; const c = r.getElementById("corpo"), g = r.getElementById("grupo"); return [c.scrollHeight <= c.clientHeight + 1, g.scrollHeight <= g.clientHeight + 1]; });
  ok(rolG[0] && rolG[1], "cartões do grupo fixos, sem rolagem");
  await page.screenshot({ path: path.join(OUT, "wa-grupo-box.png") });

  /* Monitorar grupos: ligado, a IA abre sozinha o grupo com mensagem nova */
  const corMon = async () => P("#monitorar").evaluate((b) => getComputedStyle(b).backgroundColor);
  const corOff = await corMon();
  await P("#monitorar").click();
  ok(await P("#monitorar").getAttribute("aria-pressed") === "true" && (await corMon()) !== corOff, "Monitorar grupos: liga com um clique e fica verde");
  await page.evaluate(() => window.abrirConversa("15551230000@c.us"));
  await dorme(1500);
  const gm0 = ia("grupo").filter((x) => x.takeover === true && x.conversa.nome === "Grupo Empreendedores").length;
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "Alguém indica contador nos EUA?", "Ana"));
  await page.waitForFunction(() => (document.querySelector("#main header") || {}).textContent?.includes("Grupo Empreendedores"), null, { timeout: 60000 });
  for (let i = 0; i < 80 && ia("grupo").filter((x) => x.takeover === true && x.conversa.nome === "Grupo Empreendedores").length <= gm0; i++) await dorme(1000); // no máximo uma leitura por minuto em cada grupo
  ok(ia("grupo").filter((x) => x.takeover === true && x.conversa.nome === "Grupo Empreendedores").length > gm0, "Monitorar grupos: a IA abriu o grupo com mensagem nova e leu pelo modo do grupo");
  await P("#monitorar").click();
  ok(await P("#monitorar").getAttribute("aria-pressed") === "false", "Monitorar grupos: desliga com outro clique");

  /* resposta em cima da mensagem da IA (citação): a mensagem vai marcada para a IA continuar a conversa */
  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  await dorme(1200);
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "E quanto tempo demora?", "Pedro", "A Endeavor pode ajudar com o EIN."));
  await dorme(800);
  const lida = await page.evaluate(() => { const m = window.EWaDom ? window.EWaDom.conversaAberta().mensagens : null; return m && m[m.length - 1]; });
  if (lida) ok(lida.cita && lida.cita.eu === true && lida.texto.trim() === "E quanto tempo demora?", "citação: a resposta em cima da mensagem da IA é reconhecida e o texto vem limpo");
  for (let i = 0; i < 80 && !ia("grupo").some((x) => { const u = x.mensagens[x.mensagens.length - 1]; return u && u.cita && u.cita.eu === true; }); i++) await dorme(1000);
  const comCita = ia("grupo").find((x) => { const u = x.mensagens[x.mensagens.length - 1]; return u && u.cita && u.cita.eu; });
  ok(!!comCita && comCita.mensagens[comCita.mensagens.length - 1].texto.trim() === "E quanto tempo demora?", "citação: vai para a IA marcada como resposta à mensagem dela, com o texto limpo");

  /* assunto de outra área: a IA fica quieta e a barra volta a zero, sem texto */
  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  await dorme(1200);
  const nEnv = (await enviadas()).length;
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "Alguém conhece um mecânico brasileiro?", "Ana"));
  for (let i = 0; i < 80 && !ia("grupo").some((x) => /mecânico/.test(x.mensagens[x.mensagens.length - 1].texto)); i++) await dorme(1000);
  await dorme(1500);
  ok((await enviadas()).length === nEnv && (await P("#agora-txt").textContent()) === "" && (await P("#barra-pct").textContent()) === "" && (await P("#barra-box").getAttribute("aria-valuenow")) === "0", "não responde: a barra volta a zero, sem texto");

  /* aceitou o privado no grupo: a extensão abre o privado da pessoa e a IA começa a conversa lá, perguntando o nome */
  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  await dorme(1200);
  await page.evaluate(() => window.chegar("120363000000000001@g.us", "Sim, pode me chamar no privado", "Carlos Novo", "A Endeavor pode ajudar com o EIN."));
  for (let i = 0; i < 90 && !ia("responder").some((x) => x.origem_grupo); i++) await dorme(1000);
  const prv = ia("responder").find((x) => x.origem_grupo);
  ok(!!prv && prv.origem_grupo.grupo === "Grupo Empreendedores" && prv.origem_grupo.assunto === "abrir LLC" && prv.conversa.nome === "Carlos Novo" && prv.conversa.grupo === false, "aceitou o privado: a extensão abriu o privado da pessoa e chamou a IA com o grupo de origem");
  for (let i = 0; i < 20 && !(await enviadas()).some((e) => !e.k.endsWith("@g.us") && /Como é o seu nome/.test(e.t)); i++) await dorme(500);
  ok((await enviadas()).some((e) => !e.k.endsWith("@g.us") && /Como é o seu nome/.test(e.t)), "no privado, a IA se apresenta e pergunta o nome");
  if (process.env.MODERNO) ok(await page.evaluate(() => window.__menuUsado === true), "abriu o privado pelo nome da pessoa no grupo (Conversar com…), sem depender da lista");

  /* velocidade: o controle vale na hora */
  ok(await P("#vel-n").textContent() === "400", "velocidade: mostra o padrão dos Ajustes");
  ok(await P("#vel").getAttribute("max") === "400" && await P("#vel").getAttribute("min") === "80", "velocidade: de 80 a 400 car/min (mais rápido parece robô)");
  ok(await P("#agora").evaluate((t) => { const b = t.querySelector("#barra-box"), v = t.querySelector(".vel"), x = t.querySelector("#cmd"); return b.nextElementSibling === v && !!(v.compareDocumentPosition(x) & 4); }), "velocidade logo abaixo da barra do Takeover");
  await P("#vel").fill("120");
  ok(await P("#vel-n").textContent() === "120", "velocidade: arrastar muda o número na hora");
  ok(!chamadas.some((c) => c.acao === "ext_ajustes" && "velocidade" in (c.ajustes || {})), "velocidade do painel não muda os Ajustes do admin");
  await P("#vel").fill("400");

  /* pausar: nada sai sozinho */
  await page.evaluate(() => window.abrirConversa("15551230000@c.us"));
  await dorme(1200);
  await P("#pausar").click();
  ok(await P("#pausar").getAttribute("aria-label") === "Retomar IA" && await P("#pausar .i-play").isVisible(), "em pausa: o ícone vira play (Retomar IA)");
  const r0 = ia("responder").length;
  await page.evaluate(() => window.chegar("15551230000@c.us", "Oi de novo"));
  await dorme(3000);
  ok(ia("responder").length === r0, "em pausa, o Takeover não responde");
  await P("#pausar").click();

  /* mensagens automáticas: o servidor diz no ping que o grupo está na hora; a extensão abre o grupo e posta sozinha */
  await page.evaluate(() => window.abrirConversa("15551230000@c.us"));
  lembretes = [{ chave: "120363000000000001@g.us", nome: "Grupo Empreendedores" }];
  for (let i = 0; i < 80 && !(await enviadas()).some((e) => e.k === "120363000000000001@g.us" && /Somos a Endeavor/.test(e.t)); i++) await dorme(1000);
  ok(ia("lembrete").length === 1 && ia("lembrete")[0].conversa.grupo === true, "mensagem automática: a IA escreve o lembrete do grupo na hora marcada");
  ok((await enviadas()).some((e) => e.k === "120363000000000001@g.us" && /Somos a Endeavor/.test(e.t)), "mensagem automática: a extensão abriu o grupo e postou sozinha, sem aprovação");
  await dorme(800);
  ok(chamadas.some((c) => c.acao === "ext_registrar" && c.status === "enviado" && /Somos a Endeavor/.test(c.texto || "")), "mensagem automática: o envio fica registrado (o servidor agenda a próxima)");

  /* painel fixo, sem rolagem */
  const rol = await page.evaluate(() => { const c = document.getElementById("emgr-host").shadowRoot.getElementById("corpo"); return [c.scrollHeight, c.clientHeight]; });
  ok(rol[0] <= rol[1] + 1, "painel fixo: sem rolagem (" + rol.join(" / ") + ")");
  await page.screenshot({ path: path.join(OUT, "wa-painel-novo.png") });

  /* modo escuro: botões legíveis (texto claro sobre fundo escuro) */
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);
  const cor = await P('#mic').evaluate((b) => { const s = getComputedStyle(b); return { fundo: s.backgroundColor, texto: s.color }; });
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
