// Web Meeting · AI Presentation Studio: fluxos do editor no navegador, com a função meet simulada pelo Playwright.
// O servidor simulado segue o contrato de supabase/meet/studio.ts (versão, 409 de conflito, voz "não ligada" = 409).
//   1. python3 -m http.server 8092   2. node tests/meet-studio.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const JSZip = require("../meet/vendor/jszip.min.js");

const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

/* ---------------- servidor simulado ---------------- */
const M = { voz: false, studios: {}, vozes: [], narr: {}, chamadas: [] };
const estimar = (t, r = "normal") => { const n = (String(t || "").match(/\S+/g) || []).length; return n ? Math.max(3, Math.round(n / ({ calmo: 130, normal: 150, rapido: 170 }[r] || 150) * 60)) : 0; };
function narracoes(s) {
  return s.content.slides.map((sl) => {
    if (!sl.roteiro) return { slide_id: sl.id, situacao: "sem_roteiro", estimado_s: 0 };
    const n = M.narr[s.id + sl.id + sl.roteiro + (s.settings.voz_id || "")];
    return n ? { slide_id: sl.id, situacao: "pronta", duracao_ms: 1000, url: BASE + "/audio-teste.wav", estimado_s: estimar(sl.roteiro) } : { slide_id: sl.id, situacao: "pendente", estimado_s: estimar(sl.roteiro) };
  });
}
const pub = (s) => ({ id: s.id, client_id: "c1", titulo: s.title, settings: s.settings, content: s.content, version: s.version, status: s.status, published_version: s.pv || null, dono: true, updated_at: new Date().toISOString() });
function servidor(b) {
  M.chamadas.push(b.acao);
  const s = b.id ? M.studios[b.id] : null;
  const erro = (st, m) => ({ st, j: { erro: m } });
  switch (b.acao) {
    case "studio_status": return { j: { capacidades: { texto: true, voz: M.voz, provedor_voz: M.voz ? "elevenlabs" : null, imagens: false, video: false }, termo: "Eu declaro que a voz gravada nesta amostra é a minha própria voz e autorizo…", termo_versao: "voz-2026-11" } };
    case "studio_listar": return { j: { apresentacoes: Object.values(M.studios).filter((x) => !x.apagada).map((x) => ({ id: x.id, titulo: x.title, status: x.status, version: x.version, published_version: x.pv || null, updated_at: new Date().toISOString(), slides: x.content.slides.length, empresa: "Empresa Teste" })) } };
    case "studio_criar": { const id = "00000000-0000-4000-8000-00000000000" + (Object.keys(M.studios).length + 1); M.studios[id] = { id, title: b.titulo, version: 1, status: "draft", settings: { idioma: "pt-BR", tom: "profissional e acolhedor", duracao_min: 10, ritmo: "normal", legendas: true, transicao: "suave", abertura: "ao_vivo", voz_id: null, pronuncia: [] }, content: { formato: "noir.apresentacao", versao: 1, titulo: b.titulo, slides: [{ id: "s1", layout: "capa", titulo: b.titulo }] } }; return { j: { id } }; }
    case "studio_obter": return { j: { apresentacao: pub(s), vozes: M.vozes, narracoes: narracoes(s) } };
    case "studio_salvar":
      if (b.version !== s.version) return erro(409, "Esta apresentação foi alterada em outra janela. Recarregue para ver a versão mais nova.");
      Object.assign(s, { title: b.titulo, settings: b.settings, content: b.content, version: s.version + 1 });
      return { j: { apresentacao: pub(s), narracoes: narracoes(s) } };
    case "studio_ia":
      if (b.modo === "criar") return { j: { mensagem: "Criei 5 slides com roteiro.", content: { formato: "noir.apresentacao", versao: 1, titulo: "Como abrir sua LLC", slides: ["Como abrir sua LLC", "Etapas", "Documentos", "Erros comuns", "Próximos passos"].map((t, i) => ({ id: "s" + (i + 1), layout: i === 0 ? "capa" : i === 4 ? "encerramento" : "topicos", titulo: t, itens: i && i < 4 ? ["Ponto um", "Ponto dois"] : undefined, roteiro: `Neste slide eu falo sobre ${t.toLowerCase()} com calma e exemplos simples para todos.`, duracao: 5 })) } } };
      if (b.modo === "importar") return { j: { mensagem: "Organizei o arquivo.", content: { formato: "noir.apresentacao", versao: 1, titulo: "Importada", slides: b.paginas.map((p, i) => ({ id: "s" + (i + 1), layout: "topicos", titulo: p.texto.split("\n")[0], roteiro: p.notas || "Roteiro da página " + (i + 1) })) } } };
      if (b.modo === "abertura") return { j: { mensagem: "Pronto.", texto: "Olá! Eu sou o Christiano.\n\nHoje vou mostrar como abrir sua LLC.\n\nDepois desta abertura, a apresentação continua pré-gravada e o chat tem um assistente de IA.", estimado_s: 12 } };
      if (b.modo === "roteiro") return { j: { mensagem: "Roteiro pronto.", roteiro: "Roteiro escrito pela IA para este slide, curto e natural." } };
      return { j: { mensagem: "Slide refeito.", slide: { id: b.slide_id, layout: "topicos", titulo: "Slide refeito pela IA", itens: ["Novo ponto"] } } };
    case "studio_publicar": if (b.version !== s.version) return erro(409, "Salve as últimas alterações antes de publicar."); s.status = "published"; s.pv = s.version; return { j: { ok: true, published_version: s.version, published_at: new Date().toISOString() } };
    case "studio_duplicar": { const id = "00000000-0000-4000-8000-0000000000" + (90 + Object.keys(M.studios).length); M.studios[id] = { ...structuredClone(s), id, title: "Cópia de " + s.title, status: "draft", pv: null }; return { j: { id } }; }
    case "studio_apagar": s.apagada = true; return { j: { ok: true } };
    case "voz_criar":
      if (!M.voz) return erro(409, "A voz ainda não está ligada no HUB AI. Um administrador precisa conectar o ElevenLabs em AI Providers. Nada foi gravado.");
      if (b.consentimento !== true) return erro(400, "Aceite o termo.");
      M.vozes.push({ id: "11111111-1111-4111-8111-111111111111", name: b.nome, status: "ready", consent_at: new Date().toISOString() });
      return { j: { id: M.vozes[0].id, vozes: M.vozes, verificacao: false } };
    case "voz_apagar": M.vozes = []; return { j: { ok: true, vozes: [] } };
    case "narrar":
      if (!M.voz) return erro(409, "A voz ainda não está ligada no HUB AI.");
      if (!s.settings.voz_id) return erro(400, "Escolha a sua voz nas configurações da apresentação e salve.");
      s.content.slides.forEach((sl) => { if (sl.roteiro) M.narr[s.id + sl.id + sl.roteiro + s.settings.voz_id] = 1; });
      return { j: { feitos: s.content.slides.filter((x) => x.roteiro).map((x) => ({ slide_id: x.id, ok: true })), restantes: 0, narracoes: narracoes(s) } };
    case "narracoes": return { j: { narracoes: narracoes(s) } };
    case "abertura_upload_url": M.upload = b; return { j: { path: `abertura/${s.id}/novo.webm`, url: "https://x/assinada", token: "tok" } };
    case "abertura_confirmar": s.version++; s.settings = { ...s.settings, abertura_video: { path: b.path, duracao_ms: b.duracao_ms, mime: b.mime }, abertura: "video" }; return { j: { version: s.version, abertura_video: s.settings.abertura_video } };
    case "abertura_url": return { j: s.settings.abertura_video ? { url: BASE + "/tests/fixtures/intro-teste.webm", duracao_ms: s.settings.abertura_video.duracao_ms } : { url: null } };
    case "abertura_apagar": s.version++; s.settings = { ...s.settings, abertura_video: null, abertura: "ao_vivo" }; return { j: { version: s.version } };
  }
  return erro(400, "Ação desconhecida.");
}
function wav(seg = 1, taxa = 8000) {
  const n = seg * taxa, b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24); b.writeUInt32LE(taxa, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}
async function pptx() {
  const z = new JSZip();
  z.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  z.file("ppt/presentation.xml", '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>');
  z.file("ppt/_rels/presentation.xml.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/></Relationships>');
  const sl = (a, b) => `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${a}</a:t></a:r></a:p><a:p><a:r><a:t>${b}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  z.file("ppt/slides/slide1.xml", sl("Segundo na ordem", "Item do arquivo 1"));
  z.file("ppt/slides/slide2.xml", sl("Primeiro na ordem", "Item do arquivo 2"));
  z.file("ppt/slides/_rels/slide2.xml.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="../notesSlides/notesSlide1.xml"/></Relationships>');
  z.file("ppt/notesSlides/notesSlide1.xml", '<?xml version="1.0"?><p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Fala das anotações do PowerPoint.</a:t></a:r></a:p><a:p><a:r><a:t>2</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>');
  return z.generateAsync({ type: "nodebuffer" });
}
function pdf(paginas) {
  const objs = [], add = (s) => { objs.push(s); return objs.length; };
  const fonte = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids = [];
  const pagesId = objs.length + 1 + paginas.length * 2;
  for (const linhas of paginas) {
    const txt = "BT /F1 24 Tf 72 700 Td " + linhas.map((l, i) => (i ? "0 -36 Td " : "") + `(${l}) Tj`).join(" ") + " ET";
    const c = add(`<< /Length ${txt.length} >>\nstream\n${txt}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${c} 0 R /Resources << /Font << /F1 ${fonte} 0 R >> >> >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`);
  const cat = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let s = "%PDF-1.4\n"; const off = [];
  objs.forEach((o, i) => { off.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(s, "latin1");
}

/* ---------------- testes ---------------- */
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["microphone", "camera"] })).newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
page.on("dialog", (d) => d.type() === "prompt" ? d.accept("") : d.accept());
await page.route("**/fn/meet", async (r) => { const b = JSON.parse(r.request().postData() || "{}"); const res = servidor(b); await r.fulfill({ status: res.st || 200, json: res.j }); });
await page.route("**/audio-teste.wav", (r) => r.fulfill({ status: 200, body: wav(1), headers: { "content-type": "audio/wav" } }));
await page.goto(`${BASE}/tests/fixtures/studio.html`);
await page.waitForFunction(() => !!window.EMeetStudio);
const abrirLista = () => page.evaluate(() => window.EMeetStudio.render(document.getElementById("view"), window.ctx, { scope: "client", clientId: "c1" }));
await abrirLista();
ok(/Nenhuma apresentação ainda/.test(await page.textContent("#view")), "lista vazia");
ok(/Voz: não ligado/.test(await page.textContent(".std-caps")), "capacidades: voz mostrada como não ligada");

// criar
await page.click("#std-new"); await page.fill("#std-nt", "Webinar LLC"); await page.click("#std-nf button[type=submit]");
await page.waitForSelector(".std .std-topo"); await page.waitForTimeout(300);
ok(await page.inputValue("#stdTitulo") === "Webinar LLC" && await page.$$eval(".std-mini", (x) => x.length) === 1, "editor abre com a capa");
// IA cria
await page.click('.std-abas [data-aba="ia"]');
await page.fill(".std-lado-corpo textarea", "Webinar de 10 minutos sobre abrir uma LLC na Flórida");
await page.click("text=✦ Gerar slides e roteiro"); await page.waitForTimeout(500);
ok(await page.$$eval(".std-mini", (x) => x.length) === 5 && /não salvas/.test(await page.textContent("#stdSit")), "IA cria 5 slides com roteiro (ainda não salvo)");
ok(/Neste slide eu falo/.test(await page.inputValue(".std-roteiro")), "aba Roteiro mostra a fala do slide");
// editar conteúdo
await page.locator(".std-mini-abrir").nth(1).click();
await page.locator("#stdForm .std-campo input").first().fill("Etapas principais");
ok(/Etapas principais/.test(await page.textContent("#stdPalco")), "editar título atualiza o slide no palco");
await page.locator("#stdForm textarea").first().fill("Abrir a empresa\nPedir o EIN\nAbrir a conta");
ok(await page.$$eval("#stdPalco li", (x) => x.length) === 3, "tópicos um por linha");
// reordenar, duplicar, apagar
await page.locator(".std-mini").nth(1).locator('button[title="Descer"]').click();
let titulos = await page.$$eval(".std-mini-abrir", (x) => x.map((b) => b.getAttribute("aria-label")));
ok(/Documentos/.test(titulos[1]) && /Etapas principais/.test(titulos[2]), "descer reordena");
await page.locator(".std-mini").nth(2).locator('button[title="Duplicar"]').click();
ok(await page.$$eval(".std-mini", (x) => x.length) === 6, "duplicar");
await page.locator(".std-mini").nth(3).locator('button[title="Apagar"]').click();
ok(await page.$$eval(".std-mini", (x) => x.length) === 5, "apagar (com confirmação)");
await page.locator(".std-mini").nth(4).dragTo(page.locator(".std-mini").nth(0));
titulos = await page.$$eval(".std-mini-abrir", (x) => x.map((b) => b.getAttribute("aria-label")));
ok(/Próximos passos/.test(titulos[0]), "arrastar reordena");
await page.locator(".std-mini").nth(0).dragTo(page.locator(".std-mini").nth(4));
// roteiro e tempo
await page.click('.std-abas [data-aba="roteiro"]');
await page.fill(".std-roteiro", "Agora vou explicar as etapas uma por uma, com exemplos simples e práticos. ".repeat(4));
ok(/palavras · cerca de/.test(await page.textContent(".std-lado-corpo")), "roteiro mostra palavras e tempo estimado");
ok(/Total \d+:\d\d de 10:00/.test(await page.textContent("#stdLinhaInfo")) && await page.$$eval(".std-seg", (x) => x.length) === 5, "linha do tempo com total e um trecho por slide");
// configurações
await page.click('.std-abas [data-aba="config"]');
await page.selectOption(".std-lado-corpo select >> nth=0", "en-US");
await page.fill(".std-lado-corpo textarea", "LLC = éle éle cê");
ok(/Imagens: não ligado/.test(await page.textContent(".std-lado-corpo")), "configurações mostram o que não está ligado no HUB");
// salvar
await page.click("#stdSalvar"); await page.waitForTimeout(300);
const st = Object.values(M.studios)[0];
ok(st.version === 2 && st.settings.idioma === "en-US" && st.settings.pronuncia[0].para === "éle éle cê" && /Salvo/.test(await page.textContent("#stdSit")), "salvar grava conteúdo, idioma e pronúncia");
await page.screenshot({ path: `${OUT}/studio-editor.png` });
// conflito de versão
st.version = 9;
await page.fill("#stdTitulo", "Webinar LLC (editado)"); await page.click("#stdSalvar"); await page.waitForTimeout(300);
ok(/outra janela/.test(await page.textContent("#stdAviso")), "salvar com versão antiga mostra o conflito (409)");
st.version = 2;
await page.click("#stdSalvar"); await page.waitForTimeout(300);
// publicar exige prévia
await page.click("#stdPublicar"); await page.waitForTimeout(400);
ok(!!(await page.$(".std-previa")) && /sem narração: tempo estimado/.test(await page.textContent(".std-previa-info")), "publicar sem prévia abre a prévia (tempo estimado, sem voz)");
ok(/Voz de teste do navegador nos slides sem narração \(não é a sua voz\)/.test(await page.textContent(".std-previa")), "prévia oferece a voz de teste do navegador, avisando que não é a sua voz");
await page.screenshot({ path: `${OUT}/studio-previa.png` });
for (let i = 0; i < 5; i++) { await page.click('.std-previa-ctl [aria-label="Próximo slide"]'); await page.waitForTimeout(80); }
await page.click("text=Publicar agora"); await page.waitForTimeout(400);
ok(st.status === "published" && st.pv === 3 && /Publicada v3/.test(await page.textContent("#stdSit")), "depois da prévia completa, publica a versão");
// voz desligada
await page.click('.std-abas [data-aba="voz"]');
ok(/não está ligada no HUB AI/.test(await page.textContent(".std-lado-corpo")) && await page.isDisabled("text=● Gravar"), "aba Voz: sem provedor, gravação desligada e aviso claro");
await page.click(".std-voltar"); await page.waitForTimeout(300);
ok(/Publicada v3/.test(await page.textContent("#view")), "lista mostra a apresentação publicada");

// voz ligada: criar a voz com o termo, narrar e tocar na prévia
M.voz = true;
await page.click("[data-ed]"); await page.waitForSelector(".std-topo"); await page.click('.std-abas [data-aba="voz"]');
await page.setInputFiles('.std-lado-corpo input[type=file]', { name: "amostra.webm", mimeType: "audio/webm", buffer: Buffer.alloc(40000, 1) });
ok(await page.isDisabled("button:has-text(\"Criar minha voz\")"), "criar voz exige aceitar o termo");
await page.check(".std-termo input"); await page.click("button:has-text(\"Criar minha voz\")"); await page.waitForTimeout(400);
if (!M.vozes.length) console.log("   (mensagem: " + (await page.textContent(".std-caixa [role=status]").catch(() => "?")) + ")");
ok(M.vozes.length === 1 && /Minha voz/.test(await page.textContent(".std-lado-corpo")), "voz criada com consentimento");
await page.click("#stdSalvar"); await page.waitForTimeout(300);
ok(st.settings.voz_id === M.vozes[0].id, "apresentação salva com a voz");
await page.click("text=Gerar narração dos slides que mudaram"); await page.waitForTimeout(600);
ok(await page.$$eval(".std-ponto.pronta", (x) => x.length) === 5 && /5 de 5/.test(await page.textContent(".std-lado-corpo")), "narração gerada para todos os slides com roteiro");
await page.click("#stdPrevia"); await page.waitForTimeout(500);
ok(/narração com a sua voz/.test(await page.textContent(".std-previa-info")), "prévia toca a narração");
await page.keyboard.press("Escape");
// abertura: gravador com texto/IA, câmera e microfone, fundo virtual, ensaio, contagem, mudo; prévia começa pela abertura
await page.click('.std-abas [data-aba="abertura"]');
ok(!(await page.$(".std-lado-corpo textarea")) && await page.isVisible("text=● Gravar introdução"), "aba Abertura só com o essencial (o texto fica no gravador)");
await page.click("text=● Gravar introdução"); await page.waitForSelector(".std-grav video.std-grav-cam");
await page.waitForFunction(() => { const v = document.querySelector(".std-grav-cam"); return v && v.readyState >= 2; });
ok(await page.isVisible(".std-grav-ta"), "sem texto ainda: o gravador abre com o painel Texto");
const barra = await page.$$eval(".std-grav-ctl > *", (x) => x.filter((e) => !e.hidden).map((e) => (e.getAttribute("aria-label") || e.textContent).trim()));
ok(JSON.stringify(barra) === JSON.stringify(["Velocidade", "Letra", "▶ Ensaiar", "↑ Início do texto", "❚❚ Pausar texto", "● Gravar", "Desligar o microfone", "Desligar o alto-falante"]), "barra na ordem: Velocidade, Letra, Ensaiar, Início, Pausar, Gravar, microfone, alto-falante " + JSON.stringify(barra));
await page.click("text=✦ Escrever com IA"); await page.waitForTimeout(500);
ok(/Eu sou o Christiano/.test(await page.inputValue(".std-grav-ta")) && /Eu sou o Christiano/.test(await page.textContent(".std-prompter")), "Escrever com IA dentro do gravador, e o teleprompter atualiza");
await page.fill(".std-grav-ta", "Olá! Eu sou o Christiano.\n\nHoje vou mostrar como abrir a sua LLC.\n\n" + "Esta é uma linha comprida do teleprompter para rolar. ".repeat(30));
ok(/Hoje vou mostrar/.test(await page.textContent(".std-prompter")), "editar o texto ali mesmo atualiza o teleprompter");
// câmera e microfone
await page.click('.std-grav-aba[data-p="dispositivos"]'); await page.waitForTimeout(400);
ok(await page.$$eval(".std-grav-painel select", (x) => x.length) === 2 && await page.$$eval(".std-grav-painel select:first-of-type option", (x) => x.length) >= 1, "escolher câmera e microfone (inclui externos conectados)");
// fundo virtual
await page.click('.std-grav-aba[data-p="fundo"]'); await page.waitForTimeout(300);
ok(await page.$$eval(".std-grav-fundo", (x) => x.length) === 8 && /Desfocado/.test(await page.textContent(".std-grav-painel")) && /Adicionar a sua foto/.test(await page.textContent(".std-grav-painel")), "fundo virtual: nenhum, desfocado, os 6 fundos do Web Meeting e a sua foto");
await page.click('.std-grav-fundo:has-text("Chicago")');
let comFundo = false;
for (let i = 0; i < 40 && !comFundo; i++) { await page.waitForTimeout(500); comFundo = await page.evaluate(() => { const v = document.querySelector(".std-grav-cam"); const t = v && v.srcObject && v.srcObject.getVideoTracks()[0]; return !!t && v.classList.contains("sem-espelho") && t.kind === "video" && !!window.EndeavorFundo; }); }
ok(comFundo && await page.$eval('.std-grav-fundo:has-text("Chicago")', (b) => b.getAttribute("aria-checked")) === "true", "fundo aplicado na câmera (mesmo processador do Web Meeting)");
await page.click('.std-grav-aba[data-p="fundo"]'); // fecha o painel
// mudo
await page.click('.std-grav-ic[aria-label="Desligar o microfone"]');
ok(await page.evaluate(() => document.querySelector(".std-grav-cam") && true) && await page.$eval(".std-grav-ic", (b) => b.getAttribute("aria-pressed")) === "true", "mudo do microfone");
await page.click('.std-grav-ic[aria-label="Ligar o microfone"]');
await page.click('.std-grav-ic[aria-label="Desligar o alto-falante"]');
ok(await page.isVisible('.std-grav-ic[aria-label="Ligar o alto-falante"]'), "mudo do alto-falante (evita microfonia)");
await page.click('.std-grav-ic[aria-label="Ligar o alto-falante"]');
// tamanho e velocidade
await page.locator('.std-grav-ajuste input').nth(1).fill("60");
ok(await page.$eval(".std-prompter-texto", (x) => x.style.fontSize) === "60px", "tamanho da letra ajustável");
await page.locator('.std-grav-ajuste input').nth(0).fill("120");
// ensaiar
await page.click("text=▶ Ensaiar"); await page.waitForTimeout(400);
ok(/^[123]$/.test((await page.textContent(".std-contagem")).trim()), "Ensaiar começa com a contagem 3, 2, 1");
await page.waitForTimeout(4200);
ok(await page.$eval(".std-prompter", (x) => x.scrollTop) > 100 && /ENSAIO/.test(await page.textContent(".std-grav-selo")) && !M.upload, "ensaio rola o texto sem gravar");
await page.click("text=■ Parar ensaio"); await page.click("text=↑ Início do texto");
ok(await page.$eval(".std-prompter", (x) => x.scrollTop) === 0, "Início do texto volta ao começo");
// gravar
await page.click(".std-grav-rec"); await page.waitForTimeout(400);
ok(/^[123]$/.test((await page.textContent(".std-contagem")).trim()), "Gravar começa com a contagem 3, 2, 1");
await page.waitForTimeout(4800);
ok(await page.$eval(".std-prompter", (x) => x.scrollTop) > 100 && /● 0:0[1-3]/.test(await page.textContent(".std-grav-tempo")) && /GRAVANDO/.test(await page.textContent(".std-grav-selo")), "gravando: tempo correndo, selo e texto rolando");
ok(await page.isHidden(".std-contagem") && await page.isHidden("text=↺ Regravar") && await page.isHidden('button:has-text("Usar esta gravação")'), "durante a gravação: contagem some e só aparece Parar");
await page.screenshot({ path: `${OUT}/studio-teleprompter.png` });
await page.waitForTimeout(1500);
await page.click(".std-grav-rec.parar"); await page.waitForSelector(".std-grav-rev:not([hidden])");
ok(await page.isVisible("text=↺ Regravar") && await page.isVisible('button:has-text("Usar esta gravação")'), "depois de parar: assistir, regravar ou usar");
await page.click("text=↺ Regravar"); await page.waitForTimeout(1500);
ok(await page.isVisible(".std-grav-cam") && await page.$eval(".std-prompter", (x) => x.scrollTop) === 0, "regravar volta para a câmera e o texto ao início");
await page.click(".std-grav-rec"); await page.waitForTimeout(6500); await page.click(".std-grav-rec.parar"); await page.waitForSelector('button:has-text("Usar esta gravação"):visible');
await page.click('button:has-text("Usar esta gravação")'); await page.waitForTimeout(800);
const envio = await page.evaluate(() => window.__envio);
ok(envio && envio.size > 1000 && /^video\/(webm|mp4)$/.test(envio.tipo) && M.studios[st.id].settings.abertura === "video" && M.studios[st.id].settings.abertura_video.duracao_ms >= 2500, "gravação enviada e marcada como abertura do webinar");
ok(!(await page.$(".std-grav")) && /Duração: 0:0/.test(await page.textContent(".std-lado-corpo")), "vídeo de abertura aparece na aba, com a duração");
await page.click("#stdSalvar"); await page.waitForTimeout(300);
ok(st.settings.abertura_texto.startsWith("Olá! Eu sou o Christiano.\n\n"), "texto do teleprompter salvo com os parágrafos");
await page.click("#stdPrevia"); await page.waitForTimeout(900);
ok(/Abertura · vídeo gravado/.test(await page.textContent(".std-previa-info")) && !!(await page.$(".std-previa video.std-intro")), "prévia começa pela abertura gravada");
await page.waitForTimeout(4500);
const infoPrev = await page.textContent(".std-previa-info");
ok(/Slide [12] de/.test(infoPrev), "depois da abertura, entram os slides");
await page.keyboard.press("Escape");
// voz de teste do navegador
M.narr = {};
await page.click('.std-abas [data-aba="voz"]');
await page.check(".std-lado-corpo .std-caixa .std-check input");
await page.click("#stdSalvar"); await page.waitForTimeout(300);
ok(st.settings.voz_teste === true, "voz de teste ligada e salva");
await page.click('.std-abas [data-aba="abertura"]'); await page.selectOption(".std-lado-corpo select", "nenhuma"); await page.click("#stdSalvar"); await page.waitForTimeout(300);
await page.click("#stdPrevia"); await page.waitForTimeout(900);
ok(/voz de teste do navegador \(não é a sua voz\)/.test(await page.textContent(".std-previa-info")), "prévia usa a voz de teste nos slides sem narração, avisando que não é a sua voz");
await page.keyboard.press("Escape");

// importar PowerPoint (sem IA): ordem do presentation.xml e notas viram roteiro
await page.click('.std-abas [data-aba="ia"]');
await page.setInputFiles('.std-lado-corpo input[type=file]', { name: "deck.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", buffer: await pptx() });
await page.uncheck(".std-lado-corpo .std-check input"); await page.click('button:text-is("Importar")'); await page.waitForTimeout(800);
titulos = await page.$$eval(".std-mini-abrir", (x) => x.map((b) => b.getAttribute("aria-label")));
ok(titulos.length === 2 && /Primeiro na ordem/.test(titulos[0]), "PowerPoint: um slide por página, na ordem da apresentação");
await page.click('.std-abas [data-aba="roteiro"]');
ok(/Fala das anotações do PowerPoint/.test(await page.inputValue(".std-roteiro")), "PowerPoint: anotações viram o roteiro");
// importar PDF (com IA)
await page.click('.std-abas [data-aba="ia"]');
await page.setInputFiles('.std-lado-corpo input[type=file]', { name: "deck.pdf", mimeType: "application/pdf", buffer: pdf([["Pagina um", "Texto A"], ["Pagina dois", "Texto B"], ["Pagina tres", "Texto C"]]) });
await page.click('button:text-is("Importar")'); await page.waitForTimeout(2500);
titulos = await page.$$eval(".std-mini-abrir", (x) => x.map((b) => b.getAttribute("aria-label")));
ok(titulos.length === 3 && /Pagina um/.test(titulos[0]) && M.chamadas.includes("studio_ia"), "PDF: texto de cada página lido no navegador e organizado pela IA");
await page.click(".std-voltar"); // tem alterações: confirma e sai
ok(!(await page.$(".std")), "sair com alterações pede confirmação");

// sala (modo demonstração): botão "Do Studio"
await page.goto(`${BASE}/reuniao.html?s=eb-studio12345`);
await page.route("**/functions/v1/meet", (r) => r.fulfill({ status: 404, json: {} }));
await page.waitForFunction(() => !!window.EMeetRoom);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { } window.EMeetRoom.abrir({ sala: "eb-studio12345", titulo: "Teste", papel: "mentor", nome: "Ana", demo: true }); });
await page.click("#sEntrar"); await page.waitForSelector(".sala.no-ar"); await page.click("#sAssist");
await page.click("#apStudioBtn"); await page.waitForTimeout(200);
ok(/modo demonstração o Studio não está disponível/.test(await page.textContent("#apStudioMenu")), "sala: “Do Studio” explica que a demonstração não tem Studio");
ok(erros.length === 0, "sem erros de JavaScript " + erros.join(" | "));
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
