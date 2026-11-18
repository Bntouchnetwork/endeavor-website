// Telefonia · portal (celular virtual, atendimento, baixar o app) e admin (aprovar com CONTRATAR), com a função telephony simulada.
//   1. python3 -m http.server 8092   2. node tests/telefonia.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

const EMP = "11111111-1111-4111-8111-111111111111", NUM = "22222222-2222-4222-8222-222222222222";
const chamadas = [];
const st = { contatos: [{ id: "k1", nome: "Maria Teste", telefone: "+14075550111", empresa: "ACME" }], novidades: { sms_nao_lidas: 0, voicemails_novos: 0, tocando: null }, numeros: [] };
const numero = { id: NUM, company_id: EMP, e164: "+14075550100", tipo: "local", status: "ativo", demo: true, sms_registro: "nao_aplicavel" };
function servidor(b) {
  chamadas.push(b);
  if (b.clientId !== undefined && b.clientId !== "c1") return { st: 403, j: { erro: "cliente" } };
  switch (b.acao) {
    case "p_inicio": return { j: { demo: true, estado: { estado: "demonstracao" }, empresas: [{ company_id: EMP, nome: "ACME Holdings LLC", plano: { id: "professional", nome: "Professional", preco_cents: 1999, minutos: 500, sms: 250 },
      numeros: [numero], routing: [], pode: { ligar: true, sms: true, gravacoes: true, admin: true }, permissoes: { sms: true, encaminhamento: true, gravacao: false },
      consumo: { minutos: 410, sms: 20, pct_minutos: 82, pct_sms: 8, alerta: 80, bloqueado: false, estimado: true } }] } };
    case "p_contatos": return { j: { contatos: st.contatos } };
    case "p_contato_salvar": st.contatos.push({ id: "k" + (st.contatos.length + 1), nome: b.nome, telefone: b.telefone }); return { j: { ok: true } };
    case "p_novidades": return { j: st.novidades };
    case "p_ligar": return { j: { chamada: { id: "call1", status: "em_andamento" }, demo: true } };
    case "p_desligar": case "p_atender": case "p_recusar": if (b.acao !== "p_desligar") st.novidades.tocando = null; return { j: { ok: true } };
    case "p_recentes": return { j: { chamadas: [{ id: "call1", direcao: "saida", de: numero.e164, para: "+14075550123", status: "completada", duracao_s: 65, inicio: new Date().toISOString(), demo: true }] } };
    case "p_mensagens": return { j: { conversas: [{ contato: "+14075550111", nao_lidas: 1, ultima: { texto: "Oi!", created_at: new Date().toISOString() } }] } };
    case "p_conversa": return { j: { mensagens: [{ id: "m1", direcao: "entrada", texto: "Oi!", created_at: new Date().toISOString(), status: "recebida" }], consentimento: null } };
    case "p_enviar_sms": return { j: { ok: true } };
    case "p_voicemails": return { j: { voicemails: [] } };
    case "p_estimar": return { j: { permitido: true, estimativa: { ok: true, pais: "BR", custo_minuto: 0.055, preco_minuto: 0.0715, verificado_em: "2026-11-18" } } };
    case "p_routing_salvar": return { j: { routing: { number_id: NUM, ...b.routing }, agora: { aberto: true, acao: "encaminhar" } } };
    case "p_simular": if (b.tipo === "chamada") { st.novidades.tocando = { id: "call2", de: "+14075550188", status: "tocando" }; return { j: { ok: true, chamada: st.novidades.tocando } }; } return { j: { ok: true } };
    case "p_consumo": return { j: { meses: [] } };
    case "adm_painel": return { j: { estado: { estado: "demonstracao", texto: "Provedor de demonstração." }, settings: { margem_encaminhamento_pct: 30, paises_encaminhamento: ["US", "CA"], alertas_pct: [80, 100], limite_mensal_padrao_cents: 5000 },
      planos: [{ id: "professional", nome: "Professional", tipo_numero: "local", preco_cents: 1999, minutos: 500, sms: 250, numeros_incluidos: 1, ativo: true }], acessos: [{ company_id: EMP, client_id: "c1", enabled: true, plan_id: "professional", companies: { legal_name: "ACME Holdings LLC" }, clients: { name: "ACME" } }],
      numeros: st.numeros, tarifas: [], dashboard: { numeros_ativos: 0, aguardando: st.numeros.filter((n) => n.status === "aguardando_aprovacao").length, empresas: 1, chamadas: 0, sms: 0, minutos: 0, receita_estimada: 0, custo_estimado: 0, margem_estimada: 0 } } };
    case "adm_endeavor": case "adm_endeavor_criar": {
      if (b.acao === "adm_endeavor_criar") st.endeavor = [{ id: "ne", e164: b.tipo === "tollfree" ? "+18885550100" : "+14075550107", tipo: b.tipo, status: "ativo", demo: true }];
      return { j: { demo: true, endeavor: { client_id: "ci", company_id: "co-endeavor", nome: "Endeavor Business Solutions LLC", numeros: st.endeavor || [] } } };
    }
    case "adm_aprovar": if (b.confirmacao !== "CONTRATAR") return { st: 409, j: { erro: "Para contratar, digite CONTRATAR." } }; st.numeros[0].status = "ativo"; return { j: { ok: true } };
  }
  return { st: 400, j: { erro: "ação " + b.acao } };
}
const browser = await chromium.launch();
async function pagina(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas.push("pageerror " + e.message); });
  await page.route("**/fn/telephony", async (r) => { const res = servidor(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
  return page;
}
try {
  /* ---------- portal ---------- */
  const page = await pagina({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/tests/fixtures/telefonia.html`);
  await page.waitForSelector("h1:text('Telefonia')");
  ok((await page.textContent("main, body")).includes("Modo demonstração"), "portal: aviso de demonstração");
  ok((await page.textContent(".tel-numero-grande")).includes("+1 (407) 555-0100"), "portal: número formatado");
  ok((await page.textContent("body")).includes("$19.99/mês"), "portal: plano Professional US$ 19,99");
  ok(await page.getAttribute(".tel-barra.alerta", "aria-valuenow") === "82", "portal: barra de minutos em alerta (82%)");
  ok((await page.textContent("body")).includes("80% da franquia"), "portal: aviso de 80%");
  ok(chamadas.every((c) => c.clientId === "c1"), "toda chamada leva o clientId");

  await page.click("#tl-abrir");
  await page.waitForSelector(".tp .tp-grade");
  ok(await page.locator(".tp-grade .tp-app").count() === 6, "telefone: 6 ícones (Telefone, Recentes, Contatos, Mensagens, Voicemail, WhatsApp)");
  ok((await page.textContent(".tp-status")).includes("Demonstração"), "telefone: marcado como demonstração");
  ok((await page.textContent(".tp-saudacao")).includes("(407) 555-0100"), "telefone: mostra o número da empresa");
  await page.screenshot({ path: OUT + "/tel-portal-telefone.png" });

  // arrastar pela barra
  const antes = await page.locator(".tp").boundingBox();
  const g = await page.locator(".tp-grip").boundingBox();
  await page.mouse.move(g.x + 5, g.y + 2); await page.mouse.down(); await page.mouse.move(g.x - 300, g.y + 40, { steps: 6 }); await page.mouse.up();
  const depois = await page.locator(".tp").boundingBox();
  ok(depois.x < antes.x - 200, "telefone: arrasta pela tela");
  ok(!!(await page.evaluate(() => localStorage.getItem("endeavor-phone-pos"))), "telefone: guarda a posição");

  // redimensionar pelo canto
  const t0 = await page.locator(".tp").boundingBox();
  const h = await page.locator(".tp-redim").boundingBox();
  await page.mouse.move(h.x + 10, h.y + 10); await page.mouse.down(); await page.mouse.move(h.x + 90, h.y + 160, { steps: 8 }); await page.mouse.up();
  const t1 = await page.locator(".tp").boundingBox();
  const prop = (b) => b.height / b.width;
  ok(t1.width > t0.width * 1.15 && Math.abs(prop(t1) - prop(t0)) < 0.08, "redimensionar: cresce mantendo a proporção de celular");
  ok(t1.y + t1.height <= 900 + 1 && t1.x + t1.width <= 1280 + 1, "redimensionar: não sai da tela");
  const tam = await page.evaluate(() => JSON.parse(localStorage.getItem("endeavor-phone-tam")));
  ok(tam > 1.1 && tam <= 1.6, "redimensionar: tamanho salvo no navegador (" + tam + ")");
  await page.screenshot({ path: OUT + "/tel-portal-grande.png" });
  await page.locator(".tp-redim").focus(); await page.keyboard.press("ArrowDown");
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem("endeavor-phone-tam"))) < tam, "redimensionar: setas do teclado");
  await page.dblclick(".tp-redim");
  ok(Math.abs((await page.locator(".tp").boundingBox()).width - t0.width) < 2, "duplo clique volta ao tamanho normal");
  await page.mouse.move(h.x + 10, h.y + 10); await page.mouse.down(); await page.mouse.move(h.x - 200, h.y - 400, { steps: 8 }); await page.mouse.up();
  ok((await page.locator(".tp").boundingBox()).width >= 330 * 0.8 - 2, "tamanho mínimo respeitado");
  await page.dblclick(".tp-redim");

  // teclado e ligação
  await page.click(".tp-grade [data-app=telefone]");
  for (const k of "4075550123") await page.click(`.tp-tecla[data-k="${k}"]`);
  ok(await page.inputValue("#tp-num") === "4075550123", "teclado: digita");
  await page.click("#tp-ligar");
  await page.waitForSelector(".tp-chamada");
  ok(chamadas.some((c) => c.acao === "p_ligar" && c.para === "+14075550123" && c.company_id === EMP), "ligar: envia E.164 e a empresa");
  ok((await page.textContent(".tp-chamada")).includes("nenhuma ligação real"), "ligar: aviso de demonstração na chamada");
  await page.waitForSelector(".tp-cron", { timeout: 4000 });
  // minimiza com a ligação ativa e continua usando o portal
  await page.click(".tp-bt-min");
  ok(await page.locator(".tp").isHidden() && (await page.textContent(".tp-pilula")).includes("Em ligação"), "minimizar: mantém a ligação (pílula com cronômetro)");
  await page.click("[data-aba=historico]");
  await page.waitForSelector("text=Ligações");
  ok(await page.locator(".tp-pilula").isVisible(), "minimizado: navegar no portal não derruba a ligação");
  await page.click(".tp-pilula");
  await page.click("#tp-desl");
  ok(chamadas.some((c) => c.acao === "p_desligar" && c.call_id === "call1"), "desligar");
  await page.waitForSelector("#tp-rl .tp-item");

  // contatos: cadastrar
  await page.click(".tp-home");
  await page.click(".tp-grade [data-app=contatos]");
  await page.waitForSelector("text=Maria Teste");
  await page.click(".tp-mais");
  await page.fill("#tp-c-nome", "João Novo"); await page.fill("#tp-c-tel", "(305) 555-0177");
  await page.click("#tp-cf button[type=submit]");
  await page.waitForSelector("text=João Novo");
  ok(chamadas.some((c) => c.acao === "p_contato_salvar" && c.telefone === "+13055550177"), "contatos: cadastra em E.164");

  // mensagens
  await page.click(".tp-home");
  await page.click(".tp-grade [data-app=mensagens]");
  await page.click("[data-c='+14075550111']");
  await page.waitForSelector(".tp-bolha--ele");
  await page.fill(".tp-compor textarea", "Olá, tudo bem?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok(chamadas.some((c) => c.acao === "p_enviar_sms" && c.para === "+14075550111" && c.texto === "Olá, tudo bem?"), "SMS: envia com Enter");

  // contador de SMS quando minimizado
  await page.click(".tp-home");
  await page.click(".tp-bt-min");
  st.novidades.sms_nao_lidas = 2;
  await page.waitForSelector(".tp-pilula .tp-badge", { timeout: 7000 });
  ok((await page.textContent(".tp-pilula .tp-badge")) === "2", "minimizado: contador de SMS novos");

  // ligação recebida (simulada) restaura o telefone
  await page.click("[data-aba=geral]");
  await page.click("[data-sim=chamada]");
  await page.waitForSelector(".tp-chamada--tocando", { timeout: 7000 });
  ok(await page.locator(".tp").isVisible(), "ligação recebida: telefone volta à tela");
  await page.screenshot({ path: OUT + "/tel-portal-recebendo.png" });
  await page.click("#tp-at");
  await page.waitForSelector("#tp-desl");
  ok(chamadas.some((c) => c.acao === "p_atender" && c.call_id === "call2"), "atender");
  await page.click("#tp-desl");

  // WhatsApp
  await page.click(".tp-home");
  await page.click(".tp-grade [data-app=whatsapp]");
  ok((await page.textContent(".tp-wa")).length > 10, "WhatsApp: tela do ícone");

  // atendimento: encaminhamento precisa do custo + aceite
  await page.click(".tp-bt-x");
  await page.click("[data-aba=atendimento]");
  await page.waitForSelector("form[data-num]");
  await page.selectOption("[name=destino]", "numero");
  await page.fill("[name=para]", "+55 11 91234 5678");
  await page.click("[data-estimar]");
  await page.waitForSelector("[data-est] >> text=por minuto");
  ok((await page.textContent("[data-est]")).includes("$0.072 por minuto") && (await page.textContent("[data-est]")).includes("duas pernas"), "encaminhamento: custo estimado com as duas pernas");
  await page.click("form[data-num] button[type=submit]");
  ok(!chamadas.some((c) => c.acao === "p_routing_salvar"), "encaminhamento: sem aceite não salva");
  await page.check("[name=aceite]");
  await page.check("[name=hativo]"); await page.check("[data-dia=\"1\"]");
  await page.click("form[data-num] button[type=submit]");
  await page.waitForSelector("text=Atendimento salvo");
  const rs = chamadas.find((c) => c.acao === "p_routing_salvar");
  ok(rs && rs.aceite === true && rs.routing.destino === "numero" && rs.routing.horario.ativo && rs.routing.horario.dias["1"][0][0] === "09:00", "atendimento: salva destino, aceite e horário");
  ok(!(await page.locator("[name=gravar]").count()), "gravação escondida quando não liberada no plano");
  await page.screenshot({ path: OUT + "/tel-portal-atendimento.png", fullPage: true });

  // baixar o app
  await page.click("#tl-app");
  ok((await page.textContent("#tl-inst")).includes("Instalar") && (await page.textContent("#tl-inst")).includes("não toca em segundo plano"), "baixar o app: instruções + aviso do iPhone");

  /* ---------- celular (tela cheia) ---------- */
  const cel = await pagina({ ...devices["iPhone 13"] });
  await cel.goto(`${BASE}/tests/fixtures/telefonia.html`);
  await cel.waitForSelector("#tl-abrir");
  await cel.click("#tl-app");
  ok((await cel.textContent("#tl-inst")).includes("Adicionar à Tela de Início"), "iPhone: instruções do Safari");
  await cel.click("#tl-abrir");
  await cel.waitForSelector(".tp-grade");
  const bb = await cel.locator(".tp").boundingBox(), vp = cel.viewportSize();
  ok(Math.abs(bb.width - vp.width) < 2 && bb.height >= vp.height - 2, "celular: telefone ocupa a tela");
  await cel.screenshot({ path: OUT + "/tel-celular.png" });

  /* ---------- admin: aprovar exige CONTRATAR ---------- */
  st.numeros = [{ id: "n9", company_id: EMP, e164: "+14075550101", tipo: "local", status: "aguardando_aprovacao", demo: true, sms_registro: "nao_aplicavel" }];
  const adm = await pagina({ viewport: { width: 1280, height: 900 } });
  await adm.goto(`${BASE}/tests/fixtures/telefonia.html?admin=1#/telefonia?aba=numeros`);
  await adm.waitForSelector("form.tel-aprovar");
  ok((await adm.textContent("body")).includes("Modo demonstração"), "admin: aviso de demonstração");
  await adm.fill("form.tel-aprovar input", "sim");
  await adm.click("form.tel-aprovar button[type=submit]");
  await adm.waitForSelector("#tn-m:not([hidden])");
  ok((await adm.textContent("#tn-m")).includes("CONTRATAR") && st.numeros[0].status === "aguardando_aprovacao", "admin: sem CONTRATAR não aprova");
  await adm.fill("form.tel-aprovar input", "CONTRATAR");
  await adm.click("form.tel-aprovar button[type=submit]");
  await adm.waitForSelector("text=Número ativo");
  ok(st.numeros[0].status === "ativo", "admin: aprova com CONTRATAR");
  await adm.screenshot({ path: OUT + "/tel-admin-numeros.png", fullPage: true });
  for (const aba of ["dashboard", "planos", "integracoes", "config", "chamadas"]) {
    await adm.goto(`${BASE}/tests/fixtures/telefonia.html?admin=1#/telefonia?aba=${aba}`);
    await adm.waitForSelector("#tel-corpo > *", { timeout: 5000 }).catch(() => {});
    ok(!(await adm.textContent("#view")).startsWith("ERRO"), "admin: aba " + aba + " abre");
  }
  /* ---------- admin: telefone da Endeavor ---------- */
  await adm.goto(`${BASE}/tests/fixtures/telefonia.html?admin=1#/telefonia?aba=dashboard`);
  await adm.click("#tel-endeavor");
  await adm.waitForSelector("#te-f");
  ok((await adm.textContent("#te-f")).includes("WhatsApp Business"), "Endeavor: explica o WhatsApp com o código por ligação");
  await adm.check("[name=tp][value=tollfree]");
  await adm.click("#te-f [type=submit]");
  await adm.waitForSelector(".tp .tp-grade");
  ok(chamadas.some((c) => c.acao === "adm_endeavor_criar" && c.tipo === "tollfree"), "Endeavor: cria a linha 888 (demonstração)");
  ok((await adm.textContent(".tp-saudacao")).includes("(888) 555-0100"), "Endeavor: o celular abre com o número da Endeavor");
  await adm.click(".tp-grade [data-app=contatos]");
  await adm.waitForSelector("text=Maria Teste");
  ok(chamadas.some((c) => c.acao === "p_contatos" && c.company_id === "co-endeavor"), "Endeavor: o celular usa a empresa interna");
  await adm.screenshot({ path: OUT + "/tel-admin-endeavor.png" });
  await adm.click(".tp-bt-x");
  await adm.click("#tel-endeavor");
  await adm.waitForSelector(".tp .tp-grade");
  ok(!(await adm.locator("#te-f").count()), "Endeavor: com a linha criada, o botão abre direto o telefone");
} catch (e) { console.log("erro:", e.message); falhas.push(e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\ntudo certo");
process.exit(falhas.length ? 1 : 0);
