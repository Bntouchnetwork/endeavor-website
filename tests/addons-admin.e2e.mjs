// Admin › Add-ons com o banco e a função addon-builder simulados.
//   1. python3 -m http.server 8094   2. node tests/addons-admin.e2e.mjs [http://localhost:8094] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8094", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const ID = "3f2a9c1e-1111-4111-8111-111111111111";
const st = {
  build: { id: ID, title: "Cartão de visita digital", kind: "addon", status: "chatting", plan: {}, cost_usd: 0.12, branch: null, files: [], sensitive: [], updated_at: "2026-11-18T12:00:00Z" },
  msgs: [{ id: 1, role: "admin", content: "Quero um cartão de visita digital" }], evs: [{ id: 1, kind: "create", title: "Pedido criado (novo add-on)", actor: "dono@x.com", created_at: "2026-11-18T12:00:00Z" }],
};
const chamadas = [];
const PRODS = [{ code: "crm", kind: "tool", price_cents: 2900, member_cents: 2300, interval: "month", status: "active", sort: 10 }, { code: "pkg_essencial", kind: "package", price_cents: 5900, interval: "month", status: "coming_soon", sort: 1 },
  { code: "telefone", kind: "tool", price_cents: 1999, member_cents: null, interval: "month", status: "coming_soon", sort: 46 }];
function fn(b) {
  chamadas.push(b);
  if (b.action === "status") return { ai: true, github: false, hook: true, workflow: null, repo: "x/y", limites: { tarefa: 15, mes: 100, alerta: 80 }, gasto_mes: 85, situacao: { pct: 85, bloqueado: false, alerta: true }, falta: ["GITHUB_TOKEN (Supabase › Edge Functions › Secrets)"] };
  if (b.action === "limits_save") return { ok: true };
  if (b.action === "create") return { id: ID };
  if (b.action === "message") { st.msgs.push({ id: 9, role: "admin", content: b.text }, { id: 10, role: "ai", content: "Entendi. Plano pronto." });
    st.build.plan = { summary: "Página do cartão com QR code.", tasks: ["Tela no portal", "Textos PT/EN/ES"], risks: ["Sem pagamentos"], ready: true, product: { code: "cartao_digital", interval: "month", names: { pt: "Cartão Digital" } } }; return { reply: "ok" }; }
  if (b.action === "generate") { st.build.status = "building"; st.build.branch = "addon/3f2a9c1e"; return { build: st.build }; }
  if (b.action === "publish") { if (st.build.sensitive.length && b.confirm !== "PUBLICAR") return { __st: 409, error: "confirm_sensitive" }; st.build.status = "published"; st.build.approved_by = "dono@x.com"; st.build.product_code = "cartao_digital"; return { build: st.build, server_pending: false }; }
  if (b.action === "revert") { st.build.status = "reverting"; return { build: st.build }; }
  if (b.action === "feedback") { st.build.status = "queued"; return { build: st.build }; }
  return { __st: 400, error: "x" };
}
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
page.on("pageerror", (e) => { console.log("pageerror:", e.message); falhas.push(e.message); });
await page.route("**/fn/addon-builder", async (r) => { const res = fn(JSON.parse(r.request().postData())); const s = res.__st || 200; delete res.__st; await r.fulfill({ status: s, json: res }); });
await page.route("**/db/**", async (r) => {
  const u = new URL(r.request().url()), t = u.pathname.split("/").pop();
  const d = t === "store_products" ? PRODS : t === "addon_builds" ? [st.build] : t === "addon_build_messages" ? st.msgs : t === "addon_build_events" ? st.evs : [];
  await r.fulfill({ json: d });
});
try {
  await page.goto(`${BASE}/tests/fixtures/addons-admin.html#/addons`);
  await page.waitForSelector("text=Add-ons existentes");
  const t = await page.textContent("#view");
  ok(t.includes("✗ GitHub") && t.includes("O que falta configurar") && t.includes("GITHUB_TOKEN"), "mostra o que falta configurar");
  ok(t.includes("US$ 85.00") && t.includes("85%"), "custo do mês e limite");
  ok(t.includes("CRM") && t.includes("$23.00") && t.includes("Telefone Comercial") && t.includes("Em breve") && !t.includes("Pacote Essencial"), "lista os add-ons existentes (sem pacotes) com situação");
  ok(t.includes("WhatsApp Manager") && t.includes("Sob consulta"), "inclui os sob consulta");
  ok((await page.locator('tr:has-text("CRM") td.num').last().textContent()) === "3", "quantos clientes usam");
  await page.fill("[name=t]", "20"); await page.click("#ad-lim button");
  await page.waitForSelector("#ad-m:has-text('Limites salvos')");
  ok(chamadas.some((c) => c.action === "limits_save" && c.task_cap === 20 && c.monthly_cap === 100), "salva os limites");
  await page.screenshot({ path: OUT + "/addons-admin-lista.png", fullPage: true });

  await page.click("#ad-new");
  await page.check("[name=k][value=addon]");
  await page.fill("#adn-x", "Quero um cartão de visita digital");
  await page.click("#adn-f [type=submit]");
  await page.waitForSelector(".ad-chat");
  ok(chamadas.some((c) => c.action === "create" && c.kind === "addon"), "cria o pedido e abre a conversa");
  ok(await page.locator("#ad-gerar").isDisabled(), "sem plano, não gera");
  await page.fill("#ad-x", "Com QR code e link para compartilhar");
  await page.click("#ad-f button");
  await page.waitForSelector("text=Página do cartão com QR code.");
  ok((await page.textContent(".ad-lado")).includes("Cartão Digital") && (await page.textContent(".ad-lado")).includes("Entra escondido"), "plano mostra o add-on que entra escondido na loja");
  await page.click("#ad-gerar");
  await page.waitForSelector("text=A IA está programando");
  ok(chamadas.some((c) => c.action === "generate"), "gerar na branch de teste");
  // a prévia chega (simula o gancho do GitHub)
  Object.assign(st.build, { status: "preview", preview_url: "https://prev.example/addon", files: ["client-tools.js", "store-catalog.js", "supabase/functions/crm/index.ts"],
    sensitive: [{ file: "supabase/functions/crm/index.ts", area: "servidor (funções)", servidor: true }], pr_number: 12, summary: "Criei a tela do cartão." });
  await page.waitForSelector("text=Abrir a prévia", { timeout: 12000 });
  ok((await page.textContent(".ad-acoes")).includes("servidor (funções)") && (await page.textContent(".ad-acoes")).includes("publicação técnica"), "avisa área sensível");
  await page.screenshot({ path: OUT + "/addons-admin-previa.png", fullPage: true });
  await page.click("#ad-pub");
  await page.waitForSelector("#ad-m:has-text('PUBLICAR')");
  ok(st.build.status === "preview", "sem digitar PUBLICAR não publica");
  await page.fill("#ad-conf", "PUBLICAR"); await page.click("#ad-pub");
  await page.waitForSelector("text=entrou escondido na loja");
  ok(st.build.status === "published", "publica com a confirmação");
  await page.click("#ad-undo");
  await page.waitForSelector("text=Voltando o site");
  ok(chamadas.some((c) => c.action === "revert"), "desfazer");
} catch (e) { console.log("erro:", e.message); falhas.push(e.message); }
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\ntudo certo");
process.exit(falhas.length ? 1 : 0);
