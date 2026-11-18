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
      case "wa_painel": return { j: { ajustes: A, version: v, config: cfg, config_version: cv, ia: true, hoje: {}, dispositivos: [], conversas: [{ chave: "120363@g.us", nome: "Empreendedores FL", grupo: true, lembrete: { parado: true, motivo: "Ana reclamou de divulgação no grupo" } }, { chave: "1555@c.us", nome: "Maria", grupo: false }], empresa: "Acme Imóveis", endeavor: false, dono, pedidos_abertos: 1 } };
      case "wa_ajustes": Object.assign(A, b.ajustes); v++; return { j: { ajustes: A, version: v } };
      case "wa_config": if (b.version !== cv) return { st: 409, j: { erro: "As regras mudaram." } }; cfg = b.config; cv++; return { j: { config: cfg, config_version: cv } };
      case "wa_sugerir": return { j: b.tipo === "fluxos" ? { fluxos: [{ nome: "Pós-venda", gatilho: "Cliente fechou", passos: [{ tipo: "mensagem", texto: "Boas-vindas" }, { tipo: "avisar_equipe", texto: "Avise" }] }] }
        : { regras: [{ nome: "Prazo", quando: "Perguntarem o prazo", fazer: "Explique que depende do caso", acao: "responder" }] } };
      case "wa_melhorar": return { j: { texto: b.tipo === "passo" ? "Explique com calma que a lista vai por e-mail." : "Responda com cordialidade que o prazo depende do caso e convide para agendar." } };
      case "wa_pedidos": return { j: { pedidos } };
      case "wa_lembretes": return { j: { historico: [{ id: 9, chave: "120363@g.us", nome: "Empreendedores FL", status: "enviado", texto: "Olá, pessoal! Somos a Acme Imóveis.", detalhes: { motivo: "Mensagem automática: apresentação" }, created_at: "2026-11-17T15:00:00Z" }] } };
      case "wa_lembrete_previa": return { j: { texto: "Olá, grupo! Aqui é o assistente virtual da Acme Imóveis. Ajudamos quem quer comprar o primeiro imóvel na Flórida. Quer conversar? Responda aqui ou chame no privado.", tema: "primeiro imóvel" } };
      case "wa_lembrete_retomar": return { j: { lembrete: {} } };
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
  srv.docs = [];
  await page.route("**/fn/docs", async (r) => {
    const b = JSON.parse(r.request().postData() || "{}"); srv.docs.push(b);
    if (b.acao === "doc_status") return r.fulfill({ json: { google_configurado: true, conexao: srv.conectado ? { status: "conectado", account_email: "docs@acme.com", pasta: "https://drive.google.com/drive/folders/x" } : null } });
    if (b.acao === "google_conectar") { srv.conectado = true; return r.fulfill({ json: { url: `${BASE}/tests/fixtures/whatsapp-panel.html?cliente=c1#/whatsapp?aba=pedidos&google=ok` } }); }
    if (b.acao === "pedido_reenviar") return b.email.includes("@") ? r.fulfill({ json: { ok: true } }) : r.fulfill({ status: 400, json: { erro: "E-mail inválido." } });
    return r.fulfill({ json: { ok: true } });
  });
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

  /* "Me ajude a escrever": o ícone ao lado de Remover reescreve a caixa, e dá para desfazer */
  const ic = page.locator('.wa-regra[data-i="1"] [data-ia]');
  ok(await ic.getAttribute("title") === "Me ajude a escrever" && await ic.getAttribute("aria-label") === "Me ajude a escrever", "ícone com a dica \"Me ajude a escrever\"");
  ok(await page.locator('.wa-regra[data-i="1"] [data-ia] + [data-desfazer] + [data-del]').count() === 1, "o ícone fica ao lado de Remover");
  await ic.click();
  await page.waitForSelector('.wa-regra[data-i="1"] [data-desfazer]:not([hidden])');
  const m1 = srv.chamadas.find((x) => x.acao === "wa_melhorar");
  ok(m1 && m1.tipo === "regra" && m1.texto === "Avise" && m1.contexto.quando === "Reclamação", "pede à IA com o texto e o contexto da regra");
  ok(/cordialidade/.test(await page.inputValue('.wa-regra[data-i="1"] [data-k="fazer"]')), "a IA reescreveu o texto da caixa");
  await page.click('.wa-regra[data-i="1"] [data-desfazer]');
  ok(await page.inputValue('.wa-regra[data-i="1"] [data-k="fazer"]') === "Avise", "Desfazer volta o texto anterior");
  await ic.click();
  await page.waitForSelector('.wa-regra[data-i="1"] [data-desfazer]:not([hidden])');

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
  ok(/cordialidade/.test(srv.cfg().regras[1].fazer), "o texto aceito da IA é salvo com a regra");
  await page.screenshot({ path: OUT + "/wa-regras.png", fullPage: true });

  await page.click(".subtabs >> text=Fluxos");
  await page.waitForSelector(".wa-fluxo");
  ok(await page.locator(".wa-fluxo").count() === 2 && (await page.textContent(".wa-fluxo")).includes("Padrão"), "fluxos padrão aparecem");
  ok(await page.locator('.wa-fluxo[data-fi="0"] [data-campo="email"]').isChecked(), "passo de pedir dados mostra os campos");
  await page.click('.wa-fluxo[data-fi="1"] [data-addp]');
  await page.selectOption('.wa-fluxo[data-fi="1"] .wa-passo[data-si="1"] select', "coletar");
  ok(await page.locator('.wa-fluxo[data-fi="1"] .wa-passo[data-si="1"] [data-campo]').count() === 4, "trocar para “Pedir dados” mostra os campos");
  await page.click('.wa-fluxo[data-fi="1"] .wa-passo[data-si="1"] [data-up]');
  await page.click('.wa-fluxo[data-fi="0"] .wa-passo[data-si="0"] [data-ia]');
  await page.waitForSelector('.wa-fluxo[data-fi="0"] .wa-passo[data-si="0"] [data-desfazer]:not([hidden])');
  const m2 = srv.chamadas.filter((x) => x.acao === "wa_melhorar").pop();
  ok(m2.tipo === "passo" && m2.contexto.fluxo === "Pedido de documentos", "passo do fluxo: a IA recebe o fluxo e o tipo do passo");
  ok(/lista vai por e-mail/.test(await page.inputValue('.wa-fluxo[data-fi="0"] .wa-passo[data-si="0"] [data-p="texto"]')), "passo do fluxo reescrito pela IA");
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
  ok(/lista vai por e-mail/.test(c.fluxos[0].passos[0].texto), "texto do passo reescrito é salvo");
  await page.screenshot({ path: OUT + "/wa-fluxos.png", fullPage: true });

  await page.click('.wa-fluxo[data-fi="1"] [data-delf]');
  await page.click('.wa-fluxo[data-fi="1"] [data-delf]');
  await page.click("#fx-salvar");
  await page.waitForFunction(() => /salvos/.test(document.getElementById("fx-m").textContent));
  ok(srv.cfg().regras.find((r) => r.id === "preco").acao === "responder", "remover um fluxo solta as regras que apontavam para ele");

  /* Grupos: o que a IA faz em cada grupo */
  await page.click(".subtabs >> text=Grupos");
  await page.waitForSelector(".wa-grupo");
  ok(await page.locator(".wa-grupo").count() === 1 && (await page.textContent(".wa-grupo-nome")) === "Empreendedores FL", "Grupos: lista só os grupos que a extensão já viu");
  ok(await page.inputValue('.wa-grupo [data-gk="modo"]') === "aprovar" && (await page.textContent(".wa-risco")).includes("termos do WhatsApp"), "padrão: sugerir e você aprova, com o aviso de risco");
  ok(await page.locator(".wa-grupo [data-auto]").isHidden(), "limite por dia só aparece no automático");
  await page.selectOption('.wa-grupo [data-gk="modo"]', "auto");
  await page.fill('.wa-grupo [data-gk="limite_dia"]', "2");
  await page.selectOption('.wa-grupo [data-gk="por_semana"]', "2");
  await page.uncheck('.wa-grupo [data-gk="interesse"]');
  await page.click("#gr-salvar");
  await page.waitForFunction(() => /Grupos salvos/.test(document.getElementById("gr-m").textContent));
  const gg = srv.cfg().grupos["120363@g.us"];
  ok(gg && gg.modo === "auto" && gg.limite_dia === 2 && gg.por_semana === 2 && gg.interesse === false && gg.nome === "Empreendedores FL", "ajustes do grupo salvos na configuração");
  await page.screenshot({ path: OUT + "/wa-grupos-admin.png", fullPage: true });
  ok(await page.getAttribute('.wa-seg a[data-v="auto-atendimento"]', "aria-current") === "page", "Grupos abre em Autoatendimento");

  /* Grupos → Mensagens automáticas */
  await page.click('.wa-seg >> text=Mensagens automáticas');
  await page.waitForSelector(".wa-lembrete");
  ok(/Desligadas/.test(await page.textContent(".wa-auto-geral")) && (await page.textContent("#wa-corpo")).includes("chave geral está desligada"), "chave geral desligada por padrão, com aviso");
  ok((await page.textContent(".wa-lembrete .wa-situ")).includes("Ana reclamou"), "grupo parado mostra o motivo");
  ok((await page.textContent(".wa-lembrete")).includes("sem o aviso de interesse"), "avisa que sem o interesse quem responder não entra no fluxo");
  await page.click(".wa-lembrete [data-retomar]");
  await page.waitForFunction(() => /Retomado/.test(document.querySelector(".wa-lembrete .wa-situ").textContent));
  ok(srv.chamadas.some((x) => x.acao === "wa_lembrete_retomar" && x.chave === "120363@g.us"), "Retomar libera o grupo");
  await page.check(".wa-lembrete [data-lk]");
  await page.click(".wa-lembrete [data-previa]");
  await page.waitForSelector(".wa-previa-t");
  ok((await page.textContent(".wa-previa-t")).includes("assistente virtual"), "prévia da próxima mensagem");
  await page.click("#la-salvar");
  await page.waitForFunction(() => /Salvo/.test(document.getElementById("la-m").textContent));
  const gl = srv.cfg().grupos["120363@g.us"];
  ok(gl.lembrete === true && gl.modo === "auto" && gl.interesse === false, "lembrete ligado no grupo sem mexer no Autoatendimento");
  await page.waitForSelector("#la-hist table");
  ok((await page.textContent("#la-hist")).includes("Postado"), "histórico do que foi postado");
  await page.screenshot({ path: OUT + "/wa-grupos-auto.png", fullPage: true });

  /* Ajustes → Mensagens automáticas */
  await page.click("#la-ajustes");
  await page.waitForSelector("#la-aj");
  ok(await page.getAttribute('.wa-seg a[data-v="auto"]', "aria-current") === "page", "Ajustar abre Ajustes → Mensagens automáticas");
  await page.check('#la-aj [name="ativo"]');
  await page.selectOption("#la-tipo", "alternar");
  await page.selectOption("#la-iv", "14");
  await page.uncheck('#la-aj [data-dia="1"]');
  await page.fill("#la-ini", "11:00"); await page.fill("#la-fim", "10:00");
  await page.click('#la-aj button[type="submit"]');
  await page.waitForFunction(() => /depois do inicial/.test(document.getElementById("la-aj-m").textContent));
  ok(!srv.cfg().auto || !srv.cfg().auto.ativo, "não salva com o horário final antes do inicial");
  await page.fill("#la-fim", "16:30");
  await page.fill("#la-temas", "Primeiro imóvel\nFinanciamento para estrangeiros");
  await page.click('#la-aj button[type="submit"]');
  await page.waitForFunction(() => /Salvo/.test(document.getElementById("la-aj-m").textContent));
  const au = srv.cfg().auto;
  ok(au.ativo === true && au.tipo === "alternar" && au.intervalo_dias === 14 && au.dias.join() === "2,3,4,5" && au.inicio === "11:00" && au.fim === "16:30" && au.temas.includes("Financiamento"), "ajustes gerais salvos na configuração");
  ok(srv.cfg().grupos["120363@g.us"].lembrete === true, "salvar os ajustes mantém os grupos");
  await page.click('.wa-seg >> text=Autoatendimento');
  await page.waitForSelector("#wa-aj");
  ok((await page.textContent("#wa-aj h2")) === "Autoatendimento" && (await page.textContent("#wa-aj")).includes("Autoatendimento ligado"), "Ajustes abre em Autoatendimento (antigo IA Takeover)");

  await page.click(".subtabs >> text=Pedidos ao CRM");
  await page.waitForSelector("[data-ped]");
  ok((await page.textContent(".wa-google")).includes("Não conectado"), "Google Drive: mostra não conectado");
  await page.click("#gd-on");
  await page.waitForSelector(".wa-google .portal-alert--ok");
  ok(srv.docs.some((x) => x.acao === "google_conectar" && x.clientId === "c1"), "conectar pede o consentimento do Google para a empresa");
  ok((await page.textContent(".wa-google")).includes("docs@acme.com"), "na volta: conectado, com a conta");
  await page.click("[data-outro]");
  await page.fill(".wa-outro input", "ana.nova@x.com");
  await page.click(".wa-outro button");
  await page.waitForFunction(() => /novo e-mail/.test(document.querySelector(".wa-pedido .portal-alert:last-child").textContent));
  ok(srv.docs.some((x) => x.acao === "pedido_reenviar" && x.email === "ana.nova@x.com"), "enviar para outro e-mail");
  await page.waitForSelector("[data-ped]");
  ok((await page.textContent("#wa-corpo")).includes("Aguardando armazenamento"), "pedido de documentos aguardando o armazenamento");
  await page.selectOption("[data-ped]", "completo");
  await page.waitForFunction(() => [...document.querySelectorAll(".wa-pedido .portal-alert")].some((x) => /atualizada/.test(x.textContent)));
  ok(srv.chamadas.some((x) => x.acao === "wa_pedido" && x.status === "completo"), "situação do pedido muda");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.click(".subtabs >> text=Fluxos");
  await page.waitForSelector(".wa-fluxo");
  ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, "fluxos cabem no celular");
  await page.close();

  const b = await pagina(false);
  await b.page.goto(`${BASE}/tests/fixtures/whatsapp-panel.html?cliente=c1#/whatsapp?aba=regras`);
  await b.page.waitForSelector("#wa-perfil");
  ok(await b.page.locator(".wa-regra [data-ia]").first().isDisabled(), "quem não é titular não usa o \"Me ajude a escrever\"");
  ok(await b.page.isDisabled("#rg-salvar") && await b.page.isDisabled("#pf-tom") && (await b.page.textContent("body")).includes("Só o titular"), "quem não é titular só vê (sem editar)");
  await b.page.close();
} catch (e) { console.error(e); falhas.push("exceção: " + e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
