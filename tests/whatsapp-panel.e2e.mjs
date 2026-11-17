// WhatsApp Manager · página do admin no navegador, com a função whatsapp simulada pelo Playwright.
// Status, Baixar extensão / Abrir WhatsApp Web, gerar código de conexão, desligar navegador (com confirmação),
// chave geral do Takeover, registro (filtro, CSV) e ajustes (tempos, respostas prontas, salvar).
//   1. python3 -m http.server 8092   2. node tests/whatsapp-panel.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

const chamadas = [];
const A = { takeover: true, takeover_individual: true, espera_min: 4, espera_max: 12, velocidade: 220, variacao: 20, pausa_min: 3, pausa_max: 8, digitar_max: 45, limite_hora: 20, grupo_intervalo: 10,
  texto_aviso: "Olá! Aqui é o assistente virtual da Endeavor.", idioma: "pt-BR", negocio: "Endeavor", link_agenda: "https://endeavorbiz.com/booking.html", horario: { ativo: false, inicio: "08:00", fim: "20:00", tz: "America/New_York" },
  prontas: [{ titulo: "Saudação", texto: "Olá!" }] };
let version = 2;
const devs = [{ id: "d1", nome: "Chrome Mac", versao: "1.0.0", estado: { conversa: "Maria Teste" }, criado: new Date().toISOString(), visto: new Date().toISOString(), ativo: true, online: true }];
const log = Array.from({ length: 3 }, (_, i) => ({ id: 10 - i, chave: "155@c.us", nome: "Maria Teste", grupo: false, ferramenta: ["takeover", "sugerir", "lead"][i], status: ["enviado", "sugerido", "criado"][i], texto: 'Olá! "Aqui" é o assistente', detalhes: i ? {} : { motivo: "ok" }, created_at: new Date().toISOString() }));
function servidor(b) {
  chamadas.push(b);
  switch (b.acao) {
    case "wa_painel": return { j: { ajustes: A, version, ia: true, dono: true, endeavor: true, empresa: "Endeavor Business Solutions", config: { perfil: {}, regras: [], fluxos: [], modelos: [] }, config_version: 1, hoje: { enviado: 3, sugerido: 5 }, dispositivos: devs, conversas: [{ chave: "155@c.us", nome: "Maria Teste", grupo: false, seguir: true, takeover: true }] } };
    case "wa_ajustes": if (b.version !== version) return { st: 409, j: { erro: "Os ajustes mudaram em outro lugar." } }; Object.assign(A, b.ajustes, { espera_max: Math.max(b.ajustes.espera_max, b.ajustes.espera_min) }); version++; return { j: { ajustes: A, version } };
    case "wa_conectar": return { j: { id: "d2", codigo: "wam_CODIGOtesteABCDEFGHIJKLMNOP" } };
    case "wa_revogar": devs[0].ativo = false; devs[0].online = false; return { j: { ok: true } };
    case "wa_registro": return { j: { registro: b.ferramenta ? log.filter((x) => x.ferramenta === b.ferramenta) : log } };
  }
  return { st: 400, j: { erro: "?" } };
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.route("**/fn/whatsapp", async (r) => { const res = servidor(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
try {
  await page.goto(`${BASE}/tests/fixtures/whatsapp-panel.html#/whatsapp`);
  await page.waitForSelector("h1:text('WhatsApp Manager')");
  ok(await page.getAttribute("#wa-zip", "href") === "downloads/my-whatsapp-manager.zip", "Baixar extensão aponta para o .zip");
  ok(await page.getAttribute("#wa-abrir", "href") === "https://web.whatsapp.com/" && await page.getAttribute("#wa-abrir", "target") === "_blank", "Abrir WhatsApp Web abre em nova aba");
  ok((await page.textContent(".wa-st")).includes("Online"), "status: extensão online");
  ok((await page.textContent(".wa-st")).includes("Enviado: 3"), "status: contagem de hoje");
  ok((await page.textContent(".wa-aviso")).includes("bloquear o número"), "aviso de risco visível");
  ok((await page.textContent(".wa-passos")).includes("Carregar sem compactação"), "passo a passo de instalação");
  await page.screenshot({ path: OUT + "/wa-admin-inicio.png", fullPage: true });

  await page.click("#wa-gerar");
  await page.waitForSelector(".wa-cod input");
  ok(await page.inputValue(".wa-cod input") === "wam_CODIGOtesteABCDEFGHIJKLMNOP", "gera o código de conexão (mostrado uma vez)");
  await page.click("#wa-copiar");
  ok(await page.evaluate(() => window.__copiado) === "wam_CODIGOtesteABCDEFGHIJKLMNOP", "copiar o código");

  await page.click("#wa-tk");
  await page.waitForTimeout(300);
  ok(chamadas.some((c) => c.acao === "wa_ajustes" && c.ajustes.takeover === false), "chave geral desliga o Takeover");

  await page.click("[data-rev]");
  ok(!chamadas.some((c) => c.acao === "wa_revogar"), "desligar navegador pede confirmação");
  await page.click("[data-rev]");
  await page.waitForTimeout(300);
  ok(chamadas.some((c) => c.acao === "wa_revogar" && c.id === "d1"), "desligou o navegador");

  await page.click(".subtabs >> text=Registro");
  await page.waitForSelector(".wa-txt");
  ok(await page.locator("tbody tr").count() === 3, "registro: lista o que passou pela IA");
  await page.selectOption("#wa-f", "lead");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
  ok(chamadas.at(-1).ferramenta === "lead", "registro: filtro por ferramenta");
  await page.click("#wa-csv");
  await page.waitForFunction(() => window.__baixado);
  const csv = await page.evaluate(() => window.__baixado);
  ok(csv.nome.endsWith(".csv") && csv.t.includes('""Aqui""'), "registro: CSV com aspas escapadas");

  await page.click(".subtabs >> text=Ajustes");
  await page.waitForSelector("#wa-aj");
  await page.fill("#wa-espera_min", "20"); await page.fill("#wa-espera_max", "5");
  await page.click("#wa-pr-add");
  await page.locator("[data-px]").last().fill("Já te respondo.");
  await page.click("#wa-aj button[type=submit]");
  await page.waitForFunction(() => /Salvo/.test(document.getElementById("wa-aj-msg").textContent));
  const s = chamadas.filter((c) => c.acao === "wa_ajustes").at(-1);
  ok(s.ajustes.espera_min === 20 && s.ajustes.prontas.length === 2 && s.ajustes.prontas[1].texto === "Já te respondo.", "ajustes: tempos e respostas prontas salvos");
  ok(await page.inputValue("#wa-espera_max") === "20", "ajustes: mostra o valor corrigido (máximo ≥ mínimo)");
  await page.screenshot({ path: OUT + "/wa-admin-ajustes.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 800 });
  const larg = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(larg <= 392, "ajustes cabem no celular sem rolar para o lado (" + larg + "px)");
} catch (e) { console.error(e); falhas.push("exceção: " + e.message); await page.screenshot({ path: OUT + "/wa-admin-falha.png" }).catch(() => { }); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
