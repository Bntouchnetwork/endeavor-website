// Envio seguro de documentos (docs.html): lista, envio de cada documento direto para a sessão do Google (simulada),
// confirmação, tudo recebido, idioma e erros. O servidor (função docs) e o Google são simulados pelo Playwright.
//   1. python3 -m http.server 8092   2. node tests/docs.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const TOKEN = "tok_TESTE_abcdefghijklmnopqrstuv";
const docs = ["Passaporte de cada sócio", "Comprovante de endereço"];
const rec = {}; const chamadas = []; const puts = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.route("**/functions/v1/docs", async (r) => {
  const b = JSON.parse(r.request().postData() || "{}"); chamadas.push(b);
  if (b.t !== TOKEN) return r.fulfill({ status: 404, json: { erro: "Este link não está mais ativo." } });
  if (b.acao === "pub_info") return r.fulfill({ json: { empresa: "Endeavor Business Solutions", nome: "Ana", modelo: "Abertura de empresa (LLC)", idioma: "pt", aberto: true, documentos: docs.map((d) => ({ nome: d, enviados: (rec[d] || 0) })) } });
  if (b.acao === "pub_sessao") { if (/\.zip$/.test(b.nome)) return r.fulfill({ status: 400, json: { erro: "Tipo de arquivo não aceito." } }); return r.fulfill({ json: { url: "https://upload.googleapis.test/sessao/" + chamadas.length, tipo: "application/pdf" } }); }
  if (b.acao === "pub_confirmar") { rec[b.doc] = (rec[b.doc] || 0) + 1; return r.fulfill({ json: { ok: true, faltam: docs.filter((d) => !rec[d]).length } }); }
  return r.fulfill({ status: 400, json: { erro: "?" } });
});
await page.route("https://upload.googleapis.test/**", async (r) => { puts.push({ url: r.request().url(), metodo: r.request().method(), tipo: r.request().headers()["content-type"] }); await r.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, json: { id: "arq" + puts.length } }); });
const pdf = OUT + "/teste-doc.pdf"; fs.writeFileSync(pdf, "%PDF-1.4 teste");
const zip = OUT + "/teste.zip"; fs.writeFileSync(zip, "PK");
try {
  await page.goto(`${BASE}/docs.html?t=${TOKEN}`);
  await page.waitForSelector(".dc-item");
  ok(await page.locator(".dc-item").count() === 2, "mostra a lista de documentos");
  ok((await page.textContent(".dc-seg")).includes("Google Drive de Endeavor"), "explica que vai direto para o Drive da empresa e não por WhatsApp");
  await page.setInputFiles("#df-0", pdf);
  await page.waitForFunction(() => document.querySelector('.dc-item[data-i="0"]').classList.contains("ok"), null, { timeout: 5000 });
  ok(puts.length === 1 && puts[0].metodo === "PUT" && puts[0].tipo === "application/pdf", "arquivo vai por PUT direto para a sessão do Google");
  ok(chamadas.some((c) => c.acao === "pub_confirmar" && c.doc === docs[0] && c.file_id === "arq1"), "confirma o arquivo enviado no documento certo");
  ok((await page.textContent('.dc-item[data-i="0"] .dc-st')) === "Recebido", "item marcado como recebido");
  ok(!(await page.textContent("body")).includes("teste-doc.pdf"), "não mostra nomes de arquivos nem o conteúdo da pasta");
  await page.setInputFiles("#df-1", zip);
  await page.waitForSelector('.dc-item[data-i="1"] .dc-msg.erro');
  ok((await page.textContent('.dc-item[data-i="1"] .dc-msg')).includes("não aceito"), "erro de tipo de arquivo aparece no item");
  await page.setInputFiles("#df-1", pdf);
  await page.waitForSelector(".dc-fim", { timeout: 5000 });
  ok((await page.textContent(".dc-fim")).includes("Recebemos todos"), "tudo recebido: mensagem final");
  await page.screenshot({ path: OUT + "/docs-pagina.png", fullPage: true });
  await page.click("text=EN");
  await page.waitForSelector(".dc-item");
  ok((await page.textContent("h1")) === "Secure document upload", "troca de idioma");
  await page.setViewportSize({ width: 390, height: 800 });
  ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, "cabe no celular");
  await page.goto(`${BASE}/docs.html?t=curto`);
  await page.waitForSelector(".dc-fim");
  ok((await page.textContent(".dc-fim")).includes("não é válido"), "link inválido avisa");
} catch (e) { console.error(e); falhas.push("exceção: " + e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
