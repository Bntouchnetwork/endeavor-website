// LinkedIn Manager (painel) com a função linkedin simulada.
//   1. python3 -m http.server 8096   2. node tests/linkedin.e2e.mjs [http://localhost:8096] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8096", OUT = process.argv[3] || ".";
const falhas = [], ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const em = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const st = { conta: { enabled: true, status: "connected", org_urn: "urn:li:organization:1", org_name: "ACME Page", paginas: [] }, atividade: null,
  ajustes: { idioma: "pt", posts_semana: 3, horarios: ["09:00"], fuso: "America/New_York", modo_resposta: "manual", whatsapp: "", agenda: "", palavras: [], ext: { modo: "manual", velocidade: 220, intervalo_min: 90, intervalo_max: 300, limite_dia: 15 } },
  posts: [], coment: [{ id: "k1", status: "pending", is_lead: true, lead_reason: "pediu orçamento", author_name: "Maria", body: "Quanto custa abrir uma LLC?", reply: "Oi, Maria! Chama a gente no WhatsApp.", ct_contact_id: "x", commented_at: em(-2) },
    { id: "k2", status: "pending", is_lead: false, body: "Ótimo post!", reply: "Obrigado!", commented_at: em(-1) }] };
const chamadas = [];
function fn(b) {
  chamadas.push(b);
  switch (b.acao) {
    case "li_empresas": return { admin: false, empresas: [{ id: "e1", nome: "ACME LLC", conta: st.conta }] };
    case "li_painel": return { empresa: { id: "e1", nome: "ACME LLC", atividade: st.atividade, interna: false }, conta: st.conta, ajustes: st.ajustes, fusos: ["America/New_York", "America/Sao_Paulo"], posts: st.posts, comentarios: st.coment,
      atividades: [{ code: "formation", label_pt: "Abertura de empresas", label_en: "Company formation", label_es: "Apertura de empresas" }, { code: "mortgage", label_pt: "Mortgage (financiamento imobiliário)", label_en: "Mortgage", label_es: "Hipotecas (mortgage)" }],
      dispositivos: [], enviados_hoje: 0, config: { ia: true, linkedin: true }, admin: false };
    case "li_gerar": st.posts = [1, 2, 3].map((i) => ({ id: "p" + i, status: "draft", theme: "Tema " + i, body: "Post " + i + " #LLC", language: "pt", scheduled_at: em(24 * i) })); return { posts: st.posts };
    case "li_post_salvar": { const p = st.posts.find((x) => x.id === b.id); p.body = b.body; if (p.status === "approved") p.status = "draft"; return { post: p }; }
    case "li_post_status": { const alvo = b.todos ? st.posts.filter((p) => p.status === "draft") : st.posts.filter((p) => p.id === b.id); const barrados = [];
      alvo.forEach((p) => { if (b.status === "approved" && /garantid/.test(p.body)) barrados.push({ id: p.id, motivo: "promessa de resultado" }); else p.status = b.status; }); return { posts: alvo, barrados }; }
    case "li_coment_enviar": st.coment.find((c) => c.id === b.id).status = "replied"; st.coment.find((c) => c.id === b.id).reply = b.reply; return { ok: true };
    case "li_coment_ignorar": st.coment.find((c) => c.id === b.id).status = "ignored"; return { ok: true };
    case "li_atividade": st.atividade = b.code; return { ok: true };
    case "li_ajustes": st.ajustes = b.ajustes; st.ajustes.palavras = b.ajustes.palavras.map((x) => x.trim()).filter(Boolean); return { ajustes: st.ajustes };
    case "li_ext_conectar": return { codigo: "lim_ABCDEFGHIJKLMNOPQRSTUVWX", url: "https://x.supabase.co/functions/v1/linkedin" };
  }
  return { __st: 400, erro: "ação " + b.acao };
}
const browser = await chromium.launch();
async function pagina(opts, q = "") {
  const p = await (await browser.newContext(opts)).newPage();
  p.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas.push(e.message); });
  await p.route("**/fn/linkedin", async (r) => { const res = fn(JSON.parse(r.request().postData())); const s = res.__st || 200; delete res.__st; await r.fulfill({ status: s, json: res }); });
  await p.goto(`${BASE}/tests/fixtures/linkedin.html${q}`); await p.waitForSelector("#li-abas a");
  return p;
}
try {
  const page = await pagina({ viewport: { width: 1280, height: 900 } });
  ok(chamadas.every((c) => c.clientId === "c1"), "portal: toda chamada leva o cliente");
  ok((await page.textContent("#li-corpo")).includes("Gerar semana") && (await page.textContent("#li-corpo")).includes("Nada é publicado sem a sua aprovação"), "calendário: vazio com o aviso de aprovação");
  await page.click("#li-gerar"); await page.waitForSelector(".li-card--draft");
  ok(await page.locator(".li-card--draft").count() === 3, "gerar semana: 3 rascunhos");
  await page.locator(".li-card textarea").first().fill("Aprovação garantida para todos!");
  await page.locator(".li-card [data-a=approved]").first().click();
  await page.waitForSelector("#li-m:has-text('promessa de resultado')");
  ok(st.posts[0].status === "draft" && st.posts[0].body.includes("garantida"), "aprovar salva o texto da tela e a regra de compliance barra");
  await page.locator(".li-card textarea").first().fill("Três erros ao abrir uma LLC.");
  await page.locator(".li-card [data-a=approved]").first().click(); await page.waitForSelector(".li-card--approved");
  ok(st.posts[0].status === "approved" && st.posts[0].body === "Três erros ao abrir uma LLC.", "aprova um a um, com o texto editado");
  await page.click("#li-todos"); await page.waitForFunction(() => document.querySelectorAll(".li-card--approved").length === 3);
  ok(st.posts.every((p) => p.status === "approved"), "aprovar todos");
  await page.locator(".li-card [data-a=rejected]").last().click(); await page.waitForSelector(".li-card--rejected");
  ok(st.posts[2].status === "rejected", "rejeitar");
  ok((await page.locator(".li-card input[type=datetime-local]").first().inputValue()).length === 16, "horário editável no fuso da empresa");
  await page.screenshot({ path: OUT + "/li-calendario.png", fullPage: true });

  await page.click("[data-aba=com]"); await page.waitForSelector(".li-com");
  ok((await page.textContent("#li-abas")).includes("(2)") && (await page.locator(".li-com--lead .pill").textContent()) === "Lead" && (await page.textContent(".li-com--lead")).includes("no CRM"), "comentários: pendentes com a etiqueta de lead e CRM");
  await page.locator(".li-com--lead textarea").fill("Oi, Maria! Vamos conversar?");
  await page.locator(".li-com--lead [data-a=enviar]").click(); await page.waitForSelector("text=Respondidos");
  ok(st.coment[0].status === "replied" && st.coment[0].reply === "Oi, Maria! Vamos conversar?", "enviar a resposta editada");
  await page.locator(".li-com [data-a=ignorar]").click(); await page.waitForSelector("text=Nenhum comentário pendente");
  ok(st.coment[1].status === "ignored", "ignorar");
  await page.screenshot({ path: OUT + "/li-comentarios.png", fullPage: true });

  await page.click("[data-aba=cfg]"); await page.waitForSelector("#li-f");
  ok((await page.textContent("#li-corpo")).includes("ACME Page") && (await page.inputValue("[name=modo_resposta]")) === "manual" && (await page.inputValue("[name=ext_modo]")) === "manual", "config: página conectada; resposta e extensão em manual por padrão");
  ok(await page.locator("#li-risco").isHidden(), "aviso de risco escondido no manual");
  await page.selectOption("[name=ext_modo]", "auto");
  ok(await page.locator("#li-risco").isVisible() && (await page.textContent("#li-risco")).includes("Risco para a conta"), "automático mostra o aviso de risco");
  await page.selectOption("[name=ext_modo]", "manual");
  await page.selectOption("[name=atividade]", "formation"); await page.selectOption("[name=posts_semana]", "5"); await page.fill("[name=h1]", "17:30");
  await page.fill("[name=whatsapp]", "https://wa.me/14075550100"); await page.fill("[name=palavras]", "llc, ein");
  await page.click("#li-f [type=submit]"); await page.waitForSelector("#li-m:has-text('Salvo')");
  ok(st.atividade === "formation" && st.ajustes.posts_semana === 5 && st.ajustes.horarios.join() === "09:00,17:30" && st.ajustes.whatsapp === "https://wa.me/14075550100" && st.ajustes.palavras.join() === "llc,ein", "salva atividade, posts por semana, horários, link e palavras");
  await page.click("#li-cod"); await page.waitForSelector("#li-codbox input");
  ok((await page.inputValue("#li-t")).startsWith("lim_") && (await page.textContent("#li-codbox")).includes("uma vez só"), "código da extensão aparece uma vez");
  await page.screenshot({ path: OUT + "/li-config.png", fullPage: true });

  const en = await pagina({ viewport: { width: 1280, height: 900 } }, "?L=en");
  ok((await en.textContent("#view")).includes("Generate week") && (await en.textContent("#li-abas")).includes("Settings"), "inglês");
  const es = await pagina({ ...devices["iPhone 13"] }, "?L=es");
  await es.click("[data-aba=cfg]"); await es.waitForSelector("#li-f");
  ok((await es.textContent("#view")).includes("Actividad de la empresa") && (await es.textContent("[name=atividade]")).includes("Apertura de empresas"), "espanhol, com o dropdown de atividades traduzido");
  ok(await es.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "celular: sem rolagem horizontal");
} catch (e) { console.log("erro:", e.message); falhas.push(e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\ntudo certo");
process.exit(falhas.length ? 1 : 0);
