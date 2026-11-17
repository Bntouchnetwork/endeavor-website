// WhatsApp Manager · Perfil e regras, Fluxos (com modelos de documentos) e Pedidos ao CRM, no admin e no portal do cliente.
//   1. python3 -m http.server 8092   2. node tests/whatsapp-regras.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

function servidorNovo(dono) {
  const chamadas = [];
  const A = { takeover: true, takeover_individual: true, espera_min: 4, espera_max: 12, velocidade: 220, variacao: 20, pausa_min: 3, pausa_max: 8, digitar_max: 45, limite_hora: 20, grupo_intervalo: 10,
    texto_aviso: "Olá! Aqui é o assistente virtual da Acme.", idioma: "pt-BR", negocio: "Acme Imóveis", link_agenda: "", horario: { ativo: false, inicio: "08:00", fim: "20:00", tz: "America/New_York" }, prontas: [] };
  let cfg = { perfil: { servicos: "Compra de imóveis", publico: "", tom: "", evitar: "" },
    regras: [{ id: "preco", nome: "Preço", quando: "Perguntarem preço", fazer: "Siga o fluxo de proposta", acao: "fluxo", fluxo: "proposta", ativa: true },
      { id: "pessoa", nome: "Falar com uma pessoa", quando: "Reclamação", fazer: "Avise", acao: "escalar", fluxo: "", ativa: true }],
    fluxos: [{ id: "documentos", nome: "Pedido de documentos", gatilho: "Pedem a lista", ativo: true, padrao: true, passos: [{ tipo: "mensagem", texto: "Compliance" }, { tipo: "coletar", campos: ["nome", "email"], texto: "Peça" }, { tipo: "crm_documentos", texto: "CRM" }] },
      { id: "proposta", nome: "Preço ou caso específico", gatilho: "Preço", ativo: true, padrao: true, passos: [{ tipo: "crm_proposta", texto: "CRM" }] }],
    modelos: [{ id: "purchase-fn", nome: "Purchase Foreign National", documentos: ["Passaporte"], subpastas: ["Initial Docs", "Income"] }] };
  let cv = 1, v = 1;
  const pedidos = [{ id: "p1", tipo: "documentos", nome: "Ana Souza", email: "ana@x.com", telefone: "+14075550100", modelo: "Purchase Foreign National", documentos: ["Passaporte"], status: "aguardando_armazenamento", created_at: new Date().toISOString() }];
  function f(b) {
    chamadas.push(b);
    switch (b.acao) {
      case "wa_painel": return { j: { ajustes: A, version: v, config: cfg, config_version: cv, ia: true, hoje: {}, dispositivos: [], conversas: [], empresa: "Acme Imóveis", endeavor: false, dono, pedidos_abertos: 1 } };
      case "wa_ajustes": Object.assign(A, b.ajustes); v++; return { j: { ajustes: A, version: v } };
      case "wa_config": if (b.version !== cv) return { st: 409, j: { erro: "As regras mudaram." } }; cfg = b.config; cv++; return { j: { config: cfg, config_version: cv } };
      case "wa_sugerir": return { j: b.tipo === "fluxos" ? { fluxos: [{ nome: "Pós-venda", gatilho: "Cliente fechou", passos: [{ tipo: "mensagem", texto: "Boas-vindas" }, { tipo: "avisar_equipe", texto: "Avise" }] }] }
        : { regras: [{ nome: "Prazo", quando: "Perguntarem o prazo", fazer: "Explique que depende do caso", acao: "responder" }] } };
      case "wa_pedidos": return { j: { pedidos } };
      case "wa_pedido": pedidos[0].status = b.status; return { j: { ok: true } };
    }
    return { st: 400, j: { erro: "?" } };
  }
  return { f, chamadas, cfg: () => cfg };
}
const browser = await chromium.launch();
async function pagina(dono) {
  const srv = servidorNovo(dono);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.route("**/fn/whatsapp", async (r) => { const res = srv.f(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
  return { page, srv };
}
try {
  const { page, srv } = await pagina(true);
  await page.goto(`${BASE}/tests/fixtures/whatsapp-panel.html?cliente=c1#/whatsapp?aba=regras`);
  await page.waitForSelector("#wa-perfil");
  ok(srv.chamadas.every((c) => c.clientId === "c1"), "portal do cliente: toda chamada leva a empresa (clientId)");
  ok((await page.textContent("h1")).includes("Acme Imóveis"), "título com o nome da empresa");
  ok(await page.locator(".wa-regra").count() === 2, "regras da empresa aparecem");
  ok((await page.textContent(".wa-prot")).includes("Nunca informar preços"), "proteções fixas visíveis (só leitura)");
  ok(await page.isVisible('.wa-regra[data-i="0"] [data-fluxo]') && !(await page.isVisible('.wa-regra[data-i="1"] [data-fluxo]')), "escolha de fluxo só quando a ação é seguir um fluxo");

  await page.fill("#pf-tom", "Acolhedor");
  await page.click("#wa-perfil button[type=submit]");
  await page.waitForFunction(() => /Perfil salvo/.test(document.getElementById("pf-m").textContent));
  ok(srv.cfg().perfil.tom === "Acolhedor" && srv.chamadas.some((c) => c.acao === "wa_ajustes" && c.ajustes.negocio === "Acme Imóveis"), "perfil salvo (sobre o negócio + perfil)");

  await page.click("#rg-ia");
  await page.waitForSelector(".wa-sug [data-sug]");
  ok((await page.textContent(".wa-sug")).includes("Prazo"), "IA sugere regras para o negócio");
  await page.click(".wa-sug [data-sug]");
  ok(await page.locator(".wa-regra").count() === 3, "sugestão adicionada à lista");
  await page.click("#rg-add");
  await page.click("#rg-salvar");
  await page.waitForFunction(() => /Preencha/.test(document.getElementById("rg-m").textContent));
  ok(true, "não salva regra sem o “quando”");
  await page.locator('[data-k="quando"]').last().fill("Perguntarem se atendem em inglês");
  await page.click("#rg-salvar");
  await page.waitForFunction(() => /Regras salvas/.test(document.getElementById("rg-m").textContent));
  ok(srv.cfg().regras.length === 4 && srv.cfg().regras.some((r) => r.nome === "Prazo"), "regras salvas com a sugestão e a nova");
  await page.screenshot({ path: OUT + "/wa-regras.png", fullPage: true });

  await page.click(".subtabs >> text=Fluxos");
  await page.waitForSelector(".wa-fluxo");
  ok(await page.locator(".wa-fluxo").count() === 2 && (await page.textContent(".wa-fluxo")).includes("Padrão"), "fluxos padrão aparecem");
  ok(await page.locator('.wa-fluxo[data-fi="0"] [data-campo="email"]').isChecked(), "passo de pedir dados mostra os campos");
  await page.click('.wa-fluxo[data-fi="1"] [data-addp]');
  await page.selectOption('.wa-fluxo[data-fi="1"] .wa-passo[data-si="1"] select', "coletar");
  ok(await page.locator('.wa-fluxo[data-fi="1"] .wa-passo[data-si="1"] [data-campo]').count() === 4, "trocar para “Pedir dados” mostra os campos");
  await page.click('.wa-fluxo[data-fi="1"] .wa-passo[data-si="1"] [data-up]');
  await page.click("#fx-ia");
  await page.waitForSelector("#fx-sug [data-sug]");
  await page.click("#fx-sug [data-sug]");
  await page.fill('.wa-modelo[data-mi="0"] [data-m="documentos"]', "Passaporte\nComprovante de renda");
  await page.click("#fx-salvar");
  await page.waitForFunction(() => /salvos/.test(document.getElementById("fx-m").textContent));
  const c = srv.cfg();
  ok(c.fluxos[1].passos[0].tipo === "coletar", "passo movido para cima");
  ok(c.fluxos.length === 3 && c.fluxos[2].nome === "Pós-venda", "ideia de fluxo da IA adicionada");
  ok(c.modelos[0].documentos.length === 2, "lista de documentos do modelo salva");
  await page.screenshot({ path: OUT + "/wa-fluxos.png", fullPage: true });

  await page.click('.wa-fluxo[data-fi="1"] [data-delf]');
  await page.click('.wa-fluxo[data-fi="1"] [data-delf]');
  await page.click("#fx-salvar");
  await page.waitForFunction(() => /salvos/.test(document.getElementById("fx-m").textContent));
  ok(srv.cfg().regras.find((r) => r.id === "preco").acao === "responder", "remover um fluxo solta as regras que apontavam para ele");

  await page.click(".subtabs >> text=Pedidos ao CRM");
  await page.waitForSelector("[data-ped]");
  ok((await page.textContent("#wa-corpo")).includes("Aguardando armazenamento"), "pedido de documentos aguardando o armazenamento");
  await page.selectOption("[data-ped]", "completo");
  await page.waitForFunction(() => /atualizada/.test(document.getElementById("pd-m").textContent));
  ok(srv.chamadas.some((x) => x.acao === "wa_pedido" && x.status === "completo"), "situação do pedido muda");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click(".subtabs >> text=Fluxos");
  await page.waitForSelector(".wa-fluxo");
  ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, "fluxos cabem no celular");
  await page.close();

  const b = await pagina(false);
  await b.page.goto(`${BASE}/tests/fixtures/whatsapp-panel.html?cliente=c1#/whatsapp?aba=regras`);
  await b.page.waitForSelector("#wa-perfil");
  ok(await b.page.isDisabled("#rg-salvar") && await b.page.isDisabled("#pf-tom") && (await b.page.textContent("body")).includes("Só o titular"), "quem não é titular só vê (sem editar)");
  await b.page.close();
} catch (e) { console.error(e); falhas.push("exceção: " + e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
