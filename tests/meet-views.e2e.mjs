// Web Meeting: visualizações da sala (modo demonstração).
// Destaque (organizador grande ao entrar), clicar/arrastar para trocar, palco automático, reunião de negócio,
// grade de 4, grade com todos, só o destaque, Palco (oratória) com recorte e câmera sobre o slide.
//   1. python3 -m http.server 8092   2. node tests/meet-views.e2e.mjs [http://localhost:8092] [pasta-capturas] [video.y4m opcional]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".", Y4M = process.argv[4] || "";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]; if (Y4M) args.push("--use-file-for-fake-video-capture=" + Y4M);
const browser = await chromium.launch({ args });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["camera", "microphone"] })).newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.route("**/functions/v1/meet", (r) => r.fulfill({ status: 404, json: {} }));
await page.goto(`${BASE}/reuniao.html?s=eb-vistas12345`);
await page.waitForFunction(() => !!window.EMeetRoom);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } window.EMeetRoom.abrir({ sala: "eb-vistas12345", titulo: "Aula de oratória", papel: "mentor", nome: "Ana Organizadora", demo: true }); });
await page.click("#sEntrar"); await page.waitForSelector(".sala.no-ar"); await page.waitForTimeout(800);

const noPalco = () => page.$$eval("#sGrade .tile", (t) => t.map((x) => x.querySelector(".rot")?.textContent || ""));
const naFaixa = () => page.$$eval("#sFaixaLista .tile", (t) => t.length);
const escolher = async (modo) => { await page.click("#sVista"); await page.click(`#sVistaPop [data-modo="${modo}"]`); await page.waitForTimeout(400); };

let p = await noPalco();
ok(p.length === 1 && /Ana Organizadora/.test(p[0]) && await naFaixa() === 3, "ao entrar: organizador grande e os outros na coluna");
await page.screenshot({ path: `${OUT}/vista-destaque.png` });
// clicar num convidado troca
await page.locator("#sFaixaLista .tile", { hasText: "Carlos Lima" }).click(); await page.waitForTimeout(300);
p = await noPalco();
ok(/Carlos Lima/.test(p[0]) && await page.locator("#sFaixaLista .tile", { hasText: "Ana Organizadora" }).count() === 1, "clique troca: convidado grande, organizador na coluna");
// arrastar para o palco
await page.locator("#sFaixaLista .tile", { hasText: "Marina Alves" }).dragTo(page.locator("#sPalco")); await page.waitForTimeout(300);
ok(/Marina Alves/.test((await noPalco())[0]), "arrastar para o palco troca o destaque");
// soltar o destaque (clicar de novo no fixado volta ao organizador)
await page.locator("#sGrade .tile").first().dblclick(); await page.waitForTimeout(300);
ok(/Ana Organizadora/.test((await noPalco())[0]), "tirar o fixo volta para o organizador");

await escolher("grade");
ok((await noPalco()).length === 4 && await naFaixa() === 0, "grade com todos");
await escolher("grade4");
ok((await noPalco()).length === 4 && await page.isHidden("#sPager"), "grade de 4 (com 4 pessoas, sem páginas)");
await escolher("negocio");
p = await noPalco();
ok(p.length === 2 && /Ana Organizadora/.test(p[0]) && await naFaixa() === 2, "reunião de negócio: organizador e cliente lado a lado");
await page.screenshot({ path: `${OUT}/vista-negocio.png` });
await escolher("foco");
ok((await noPalco()).length === 1 && !(await page.isVisible("#sFaixa")), "só o destaque ocupa tudo");
await escolher("auto");
// liga as legendas para os simulados "falarem" e espera alguém falar
let trocou = false;
for (let i = 0; i < 20 && !trocou; i++) { await page.waitForTimeout(800); trocou = !/Ana Organizadora/.test((await noPalco())[0] || ""); }
ok(trocou, "palco automático: quem fala vai para o centro");
await escolher("palco");
await page.locator("#sFaixaLista .tile, .plateia .tile", { hasText: "Ana Organizadora" }).first().click().catch(() => { });
await page.waitForTimeout(400);
const fixo = await page.$eval("#sGrade .tile", (t) => t.classList.contains("em-palco"));
ok(fixo && (await page.$$eval("#sPlateia .tile", (t) => t.length)) === 3, "palco: pessoa no palco e os outros como plateia");
let recorte = false;
for (let i = 0; i < 25 && !recorte; i++) { await page.waitForTimeout(600); recorte = await page.$eval("#sGrade .tile", (t) => t.classList.contains("recortando") && !!t.querySelector("canvas.recorte")?.width); }
ok(recorte, "palco: pessoa recortada sobre o palco virtual");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/vista-palco.png` });
await escolher("destaque");
ok(!(await page.$("#sGrade .tile.em-palco")) && !(await page.$("#sGrade canvas.recorte")), "sair do palco desliga o recorte");
// câmera sobre o slide
await page.click("#sAssist"); await page.fill("#apTexto", "Crie 3 slides sobre oratória"); await page.press("#apTexto", "Enter"); await page.waitForTimeout(1500);
ok(!!(await page.$("#sGrade .tile.apres .ap-cam video")), "câmera do apresentador sobre o slide");
let camRec = false;
for (let i = 0; i < 20 && !camRec; i++) { await page.waitForTimeout(500); camRec = await page.$eval("#sGrade .tile.apres .ap-cam", (b) => b.classList.contains("recortando")); }
ok(camRec, "câmera sobre o slide com recorte");
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/vista-slide.png` });
await page.click("#sVista"); await page.click("#sSobreSlide"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
ok(!(await page.$("#sGrade .tile.apres .ap-cam")), "desligar a câmera sobre o slide");
ok(await page.evaluate(() => localStorage.getItem("emeet-vista")) === "destaque", "visualização lembrada");
ok(erros.length === 0, "sem erros de JavaScript " + erros.join(" | "));
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
