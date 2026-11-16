// Live Webinar · painel (admin/portal) no navegador, com a função webinar simulada pelo Playwright.
// Lista, criar, configurar e agendar, perguntas frequentes (gerar, editar, salvar), ao vivo (pausar/retomar, conflito de
// comando, moderação, responder como equipe), relatório e CSV, e a aba do Studio dentro do Live Webinar.
//   1. python3 -m http.server 8092   2. node tests/webinar-panel.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

const ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const M = { w: null, chamadas: [], msgs: [
  { id: 1, canal: "publico", autor: "ia", nome: "Assistente (IA)", texto: "Bem-vindo!", extra: {}, created_at: new Date().toISOString() },
  { id: 2, canal: "publico", autor: "participante", nome: "Ana", texto: "Quanto custa?", extra: {}, registration_id: "r1", created_at: new Date().toISOString() },
  { id: 3, canal: "privado", autor: "participante", nome: "Ana Souza", texto: "Quero falar do meu caso", extra: {}, registration_id: "r1", created_at: new Date().toISOString() }] };
const slides = [{ id: "s1", titulo: "Capa" }, { id: "s2", titulo: "Etapas" }, { id: "s3", titulo: "Fim" }];
function servidor(b) {
  M.chamadas.push(b);
  const erro = (st, m) => ({ st, j: { erro: m } });
  const W = () => ({ ...M.w, link: "https://endeavorbiz.com/webinar.html?w=" + M.w.slug });
  switch (b.acao) {
    case "lw_listar": return { j: { webinars: M.w ? [{ id: ID, slug: M.w.slug, titulo: M.w.titulo, empresa: "Empresa", starts_at: M.w.starts_at, timezone: M.w.timezone, status: M.w.status, estado: M.w.estado, inscritos: 12, link: W().link }] : [] } };
    case "lw_novo_dados": return { j: { apresentacoes: [{ id: "st1", titulo: "LLC nos EUA", versao: 3, slides: 3 }] } };
    case "lw_salvar":
      if (!b.id) { M.w = { id: ID, slug: "llc-eua-ab12cd", titulo: b.titulo, descricao: "", studio_id: b.studio_id, starts_at: b.starts_at, timezone: b.timezone, status: "draft", estado: "draft", version: 1, slides: [], narracoes: 0, duracao_ms: 0, faq: [],
        settings: { contador_minimo: 20, chat_abre_min: 15, chat_ia: true, boas_vindas: true, faq: true, cta_final: true, convites: [], agendamento: "calendario", idioma: "pt-BR", texto_boas_vindas: "", texto_convite: "", texto_cta: "" } }; return { j: { webinar: W() } }; }
      if (b.version !== M.w.version) return erro(409, "Este webinar foi alterado em outra janela. Recarregue.");
      Object.assign(M.w, { titulo: b.titulo, descricao: b.descricao, starts_at: b.starts_at, timezone: b.timezone, settings: { ...M.w.settings, ...b.settings }, version: M.w.version + 1 });
      return { j: { webinar: W() } };
    case "lw_obter": return { j: { webinar: W(), apresentacoes: [{ id: "st1", titulo: "LLC nos EUA", versao: 3, slides: 3 }] } };
    case "lw_agendar": Object.assign(M.w, { status: "scheduled", estado: "antes", slides, narracoes: 2, studio_version: 3, duracao_ms: 600000, version: M.w.version + 1 }); return { j: { webinar: W(), aviso: "Alguns slides não têm narração pronta." } };
    case "lw_ia_plano": return { j: { faq: [{ slide: 1, pergunta: "Preciso morar nos EUA?", resposta: "Não necessariamente.", aprovada: true }, { slide: 2, pergunta: "Quanto tempo leva?", resposta: "Depende do estado.", aprovada: true }] } };
    case "lw_plano_salvar": M.w.faq = b.faq; return { j: { faq: b.faq } };
    case "lw_aovivo": return { j: { agora: Date.now(), estado: M.w.estado, pos: 125000, total: 600000, slide: 1, playback: {}, version: M.w.version, ao_vivo: 7, contador_minimo: M.w.settings.contador_minimo, ia_pausada: !!M.w.ia_pausada, mensagens: M.msgs.filter((m) => m.id > (b.desde || 0)) } };
    case "lw_controle":
      if (b.version !== M.w.version) return erro(409, "Outro comando chegou antes deste. A tela foi atualizada; confira e tente de novo.");
      if (b.comando === "pausar") M.w.estado = "pausado"; if (b.comando === "retomar") M.w.estado = "ao_vivo"; if (b.comando === "ia") M.w.ia_pausada = b.pausada;
      M.w.version++; return { j: { ok: true, version: M.w.version } };
    case "lw_moderar": { const m = M.msgs.find((x) => x.id === b.msg_id); m.oculto = b.oculto; return { j: { ok: true } }; }
    case "lw_anfitriao": M.msgs.push({ id: M.msgs.length + 1, canal: b.registration_id ? "privado" : "publico", autor: "anfitriao", nome: "Empresa (equipe)", texto: b.texto, registration_id: b.registration_id, extra: {}, created_at: new Date().toISOString() }); return { j: { ok: true } };
    case "lw_relatorio": return { j: { inscritos: 12, participantes: 9, comparecimento_pct: 75, pico_simultaneo: 8, media_min: 7.4, mediana_min: 8, ficaram_ate_o_fim: 6, sairam_antes: 3, perguntas: 5, leads: 3, agendamentos: 2, links: 1,
      slides: ["Capa", "Etapas", "Fim"], retencao: [{ pct: 100 }, { pct: 89 }, { pct: 67 }], saidas: [{ n: 0 }, { n: 1 }, { n: 2 }],
      pessoas: [{ nome: "Ana Souza", email: "ana@exemplo.com", minutos: 9.5, assistiu_pct: 100, perguntas: 2, lead: true, agendou: true }, { nome: "=HYPERLINK(1)", email: "x@y.com", minutos: 2, assistiu_pct: 20, perguntas: 0, lead: false, agendou: false }] } };
    case "studio_listar": return { j: { apresentacoes: [] } };
    case "studio_status": return { j: { capacidades: { texto: true, voz: false } } };
  }
  return erro(400, "Ação desconhecida: " + b.acao);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
page.on("dialog", (d) => d.type() === "prompt" ? d.accept("Olá, Ana! Já te respondo por aqui.") : d.accept());
await page.route("**/fn/webinar", async (r) => { const res = servidor(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
await page.route("**/fn/meet", async (r) => { const res = servidor(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
await page.goto(`${BASE}/tests/fixtures/webinar-panel.html#/webinar`);
await page.waitForFunction(() => !!window.EWebinarPanel);
await page.evaluate(() => desenhar()); await page.waitForTimeout(300);
ok(/Nenhum webinar ainda/.test(await page.textContent("#view")) && /Apresentações \(Studio\)/.test(await page.textContent(".subtabs")), "lista vazia, com a aba do Studio dentro do Live Webinar");

// criar
await page.click("#lw-new"); await page.waitForSelector("#lw-ns option[value=st1]", { state: "attached" });
await page.fill("#lw-nt", "LLC nos EUA: passo a passo");
await page.selectOption("#lw-nz", "America/New_York"); await page.fill("#lw-nd", "2026-12-10T14:00");
await page.click("#lw-nf button[type=submit]"); await page.waitForSelector("#lw-cf");
const criado = M.chamadas.find((x) => x.acao === "lw_salvar");
ok(criado.studio_id === "st1" && criado.starts_at === "2026-12-10T19:00:00.000Z", "criar: apresentação publicada e horário convertido do fuso (14:00 Nova York = 19:00 UTC)");

// configurar e agendar
await page.fill("#lw-cm", "30"); await page.selectOption("#lw-ag", "link"); await page.uncheck("#lw-bv");
await page.click("#lw-cf button[type=submit]"); await page.waitForTimeout(300);
ok(M.w.settings.contador_minimo === 30 && M.w.settings.agendamento === "link" && M.w.settings.boas_vindas === false, "salvar configurações (contador mínimo, agendamento, boas-vindas)");
await page.click("#lw-ag-btn"); await page.waitForTimeout(600);
ok(M.w.status === "scheduled" && /Agendado/.test(await page.textContent("#view")) && /Inscrições abertas/.test(await page.textContent("#lw-m")), "agendar abre as inscrições e mostra o aviso de narração");
ok(await page.$$eval(".lw-slides-chk input", (x) => x.length) === 3, "convites por slide aparecem depois de agendar");
await page.screenshot({ path: `${OUT}/webinar-painel-config.png`, fullPage: true });

// perguntas frequentes
await page.click('.lw-partes a:has-text("Perguntas frequentes")'); await page.waitForSelector("#lw-fg");
await page.click("#lw-fg"); await page.waitForTimeout(400);
ok(await page.$$eval(".lw-faq-item", (x) => x.length) === 2, "IA gera as perguntas frequentes para revisar");
await page.locator('.lw-faq-item').nth(1).locator('[data-k="aprovada"]').uncheck();
await page.locator('.lw-faq-item').nth(0).locator('[data-k="resposta"]').fill("Não. Quem mora fora também pode abrir.");
await page.click("#lw-fs"); await page.waitForTimeout(300);
ok(M.w.faq[0].resposta === "Não. Quem mora fora também pode abrir." && M.w.faq[1].aprovada === false, "editar e desaprovar perguntas antes do webinar");

// ao vivo
M.w.estado = "ao_vivo";
await page.click('.lw-partes a:has-text("Ao vivo")'); await page.waitForSelector("#lw-k .lw-kpi"); await page.waitForTimeout(400);
ok(/Assistindo agora\s*7/.test(await page.textContent("#lw-k")) && /contador escondido até 30/.test(await page.textContent("#lw-k")), "ao vivo: número real e aviso de contador escondido");
ok(/Quanto custa\?/.test(await page.textContent("#lw-pub")) && /Quero falar do meu caso/.test(await page.textContent("#lw-priv")), "chat aberto e caixas privadas separados");
await page.click('#lw-ctl button:has-text("Pausar")'); await page.waitForTimeout(400);
ok(M.w.estado === "pausado", "pausar");
M.w.version += 5; // outro organizador mandou um comando
await page.click('#lw-ctl button:has-text("Retomar")'); await page.waitForTimeout(400);
ok(/Outro comando chegou antes/.test(await page.textContent("#lw-m")) && M.w.estado === "pausado", "comando em conflito é recusado (sem atropelar)");
await page.waitForTimeout(4300); await page.click('#lw-ctl button:has-text("Retomar")'); await page.waitForTimeout(400);
ok(M.w.estado === "ao_vivo", "depois de atualizar, retomar funciona");
await page.locator('#lw-pub li[data-id="2"] button:has-text("Ocultar")').click(); await page.waitForTimeout(300);
ok(M.msgs[1].oculto === true, "moderação: ocultar mensagem");
await page.fill("#lw-rp input", "Vamos falar de valores na caixa privada."); await page.click("#lw-rp button"); await page.waitForTimeout(500);
ok(M.msgs.some((x) => x.autor === "anfitriao" && x.canal === "publico"), "responder a todos como equipe");
await page.locator('#lw-priv li[data-id="3"] button:has-text("Responder em particular")').click(); await page.waitForTimeout(500);
ok(M.msgs.some((x) => x.autor === "anfitriao" && x.canal === "privado" && x.registration_id === "r1"), "responder em particular (equipe assume a conversa)");
await page.click('#lw-ctl button:has-text("Pausar o assistente")'); await page.waitForTimeout(300);
ok(M.w.ia_pausada === true, "pausar o assistente de IA");
await page.screenshot({ path: `${OUT}/webinar-painel-vivo.png`, fullPage: true });

// relatório
await page.click('.lw-partes a:has-text("Relatório")'); await page.waitForSelector(".lw-ret");
const rel = await page.textContent("#lw-corpo");
ok(/Participaram\s*9/.test(rel) && /Agendamentos\s*2/.test(rel) && /Leads\s*3/.test(rel) && await page.$$eval(".lw-ret-l", (x) => x.length) === 3, "relatório com presença, leads, agendamentos e retenção por slide");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#lw-csv")]);
const csv = require("node:fs").readFileSync(await dl.path(), "utf8");
ok(/"Ana Souza","ana@exemplo.com","9.5","100","2","sim","sim"/.test(csv) && /"'=HYPERLINK\(1\)"/.test(csv), "CSV das pessoas, protegido contra fórmulas");
await page.screenshot({ path: `${OUT}/webinar-painel-relatorio.png`, fullPage: true });

// lista e Studio
await page.evaluate(() => { location.hash = "#/webinar"; }); await page.waitForTimeout(400);
ok(/LLC nos EUA: passo a passo/.test(await page.textContent("#view")) && await page.isVisible('button:has-text("Copiar link")'), "lista com o webinar agendado e o link");
await page.evaluate(() => { location.hash = "#/webinar?aba=studio"; }); await page.waitForTimeout(500);
ok(/Apresentações/.test(await page.textContent("#view h1")) && await page.isVisible("#std-new"), "Studio abre dentro do Live Webinar");
ok(erros.length === 0, "sem erros de JavaScript " + erros.join(" | "));
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
