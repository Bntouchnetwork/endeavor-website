// My WhatsApp Manager · leitura do WhatsApp Web (wa-extension/wa-dom.js) em duas estruturas de página:
// a antiga (data-id, copyable-text, data-pre-plain-text) e a atual (role="row", sem data-id e sem essas classes).
//   1. python3 -m http.server 8092   2. node tests/whatsapp-dom.e2e.mjs [http://localhost:8092]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8092";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };
const browser = await chromium.launch();
for (const modo of ["antigo", "moderno"]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(`${BASE}/tests/fixtures/whatsapp-falso.html${modo === "moderno" ? "?moderno=1" : ""}`);
  await page.addScriptTag({ url: `${BASE}/wa-extension/core.js` });
  await page.addScriptTag({ url: `${BASE}/wa-extension/wa-dom.js` });
  await page.evaluate(() => { window.abrirConversa("15551230000@c.us"); window.chegar("15551230000@c.us", "Vocês atendem em português?"); });
  await page.evaluate(() => { const c = document.querySelector("#main footer [contenteditable]"); c.textContent = "Sim, atendemos."; document.querySelector("#main footer button").click(); });
  let c = await page.evaluate(() => EWaDom.conversaAberta());
  ok(c && c.mensagens.length === 3, `${modo}: lê as 3 mensagens (sem o separador "Today" nem o cartão do perfil) — ${c && c.mensagens.length}`);
  ok(c.mensagens[0].texto === "Oi, quero abrir uma LLC na Flórida. Quanto custa?" && !c.mensagens[0].eu, `${modo}: texto e lado da mensagem recebida`);
  ok(c.mensagens[2].eu === true && c.mensagens[2].texto === "Sim, atendemos.", `${modo}: minha mensagem reconhecida (${c.mensagens[2].eu}, "${c.mensagens[2].texto}")`);
  ok(c.mensagens[0].hora === "08:00", `${modo}: hora da mensagem (${c.mensagens[0].hora})`);
  ok(c.chave === (modo === "moderno" ? "Maria Teste" : "15551230000@c.us") && c.grupo === false, `${modo}: chave da conversa individual (${c.chave})`);
  ok(new Set(c.mensagens.map((m) => m.id)).size === 3, `${modo}: cada mensagem com id próprio`);
  const id1 = c.mensagens[1].id;
  await page.evaluate(() => window.chegar("15551230000@c.us", "Outra"));
  c = await page.evaluate(() => EWaDom.conversaAberta());
  ok(c.mensagens[1].id === id1 && c.mensagens.length === 4, `${modo}: o id não muda quando chega mensagem nova`);

  await page.evaluate(() => window.abrirConversa("120363000000000001@g.us"));
  c = await page.evaluate(() => EWaDom.conversaAberta());
  ok(c.grupo === true, `${modo}: grupo reconhecido`);
  ok(c.mensagens[0].autor === "João" && c.mensagens[0].texto === "Alguém sabe como tirar EIN?", `${modo}: autor e texto no grupo (${c.mensagens[0].autor})`);

  // abrir conversa da lista (não lida)
  await page.evaluate(() => window.chegar("15559990000@c.us", "Olá"));
  const n = await page.evaluate(() => EWaDom.naoLidas().map((x) => x.nome));
  ok(n.includes("Carlos Novo"), `${modo}: acha a conversa não lida`);
  await page.evaluate(() => { const a = EWaDom.naoLidas().find((x) => x.nome === "Carlos Novo"); EWaDom.abrir(a.linha); });
  ok((await page.evaluate(() => EWaDom.conversaAberta().nome)) === "Carlos Novo", `${modo}: abre a conversa não lida`);

  if (modo === "moderno") {
    // cabeçalho com o número (como no print do WhatsApp real): a chave vira o número
    await page.evaluate(() => { document.querySelector("#main header span[title]").setAttribute("title", "+1 (630) 689-8702"); });
    const k = await page.evaluate(() => EWaDom.conversaAberta().chave);
    ok(k === "16306898702@c.us", `moderno: número no cabeçalho vira a chave (${k})`);
  }
  const d = await page.evaluate(() => JSON.stringify(EWaDom.diagnostico()));
  ok(!d.includes("Olá") && !d.includes("Carlos") && d.includes('"lidas"'), `${modo}: diagnóstico sem o texto das mensagens`);
  await page.close();
}
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s)` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
