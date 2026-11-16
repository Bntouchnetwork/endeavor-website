// Live Webinar · página pública no navegador (inscrição e sala), com a função webinar simulada pelo Playwright.
// O simulador usa as mesmas regras do servidor (webinar/core.js): relógio, contador real com mínimo, dados pessoais e mensagens programadas.
//   1. python3 -m http.server 8092   2. node tests/webinar-public.e2e.mjs [http://localhost:8092] [pasta-capturas]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const C = require("../webinar/core.js");

const BASE = process.argv[2] || "http://localhost:8092", OUT = process.argv[3] || ".";
const falhas = [];
const ok = (c, n) => { console.log((c ? "✓ " : "✗ ") + n); if (!c) falhas.push(n); };

/* ---------------- servidor simulado ---------------- */
const slides = [{ id: "s1", layout: "capa", titulo: "Como abrir sua LLC", roteiro: "Olá, bem-vindos ao webinar.", duracao: 20 },
  { id: "s2", layout: "topicos", titulo: "Etapas", itens: ["Abrir a empresa", "Pedir o EIN"], roteiro: "Agora as etapas.", duracao: 60 },
  { id: "s3", layout: "encerramento", titulo: "Obrigado", roteiro: "Obrigado por assistir.", duracao: 30 }];
const M = {
  w: { starts_at: new Date(Date.now() + 3600_000).toISOString(), playback: {}, settings: { contador_minimo: 3, convites: [1] }, ai_plan: { faq: [{ slide: 1, pergunta: "Preciso morar nos EUA para abrir a LLC?", resposta: "Não. A LLC pode ser aberta por quem mora fora." }] } },
  regs: {}, msgs: [], vivos: 1, contato: false, agendado: null, link: false, chamadas: [],
};
const linha = () => C.linhaDoTempo(slides, { s1: { duracao_ms: 1000 } }, "normal");
function servidor(b) {
  M.chamadas.push(b.acao);
  const agora = Date.now(), p = C.posicao(M.w, linha(), agora);
  const erro = (st, m) => ({ st, j: { erro: m } });
  const reg = M.regs[b.token];
  switch (b.acao) {
    case "pub_info": return { j: { titulo: "Como abrir sua LLC nos EUA", descricao: "Um passo a passo.", empresa: "Endeavor Business Solutions", starts_at: M.w.starts_at, timezone: "America/New_York", duracao_ms: C.total(linha()), estado: p.estado, idioma: "pt-BR", inscricao_aberta: true, agora } };
    case "pub_inscrever":
      if (!b.aceite) return erro(400, "Confirme que leu o aviso sobre a apresentação e o assistente de IA.");
      if (Object.values(M.regs).some((r) => r.email === b.email)) return { j: { ok: true, ja_inscrito: true, email_enviado: true } };
      { const token = "11111111-2222-4333-8444-" + String(Object.keys(M.regs).length + 1).padStart(12, "0"); M.regs[token] = { nome: b.nome, email: b.email }; return { j: { ok: true, token, email_enviado: true } }; }
    case "pub_entrar":
      if (!reg) return erro(403, "Inscrição não encontrada.");
      return { j: { titulo: "Como abrir sua LLC nos EUA", empresa: "Endeavor Business Solutions", nome: reg.nome, starts_at: M.w.starts_at, timezone: "America/New_York", agora, slides, narracao: { s1: { duracao_ms: 1000 } },
        audios: { s1: BASE + "/audio-teste.wav" }, ritmo: "normal", playback: M.w.playback, estado: p.estado, chat_abre_min: 15, agendamento: "calendario", idioma: "pt-BR", ia: true, contato_ok: M.contato } };
    case "pub_estado": {
      if (!reg) return erro(403, "x");
      if (p.estado !== "antes") for (const m of C.programadas(M.w, linha())) if (m.em <= p.pos && !M.msgs.some((x) => x.chave === m.chave))
        M.msgs.push({ id: M.msgs.length + 1, canal: "publico", autor: m.autor, nome: m.autor === "faq" ? "Pergunta frequente" : "Assistente (IA)", texto: m.texto, extra: m.resposta ? { resposta: m.resposta } : {}, chave: m.chave, created_at: new Date().toISOString() });
      const f = (canal, desde) => M.msgs.filter((m) => m.canal === canal && m.id > desde && !m.oculto && (canal === "publico" || m.token === b.token));
      return { j: { agora, estado: p.estado, pos: p.pos, playback: M.w.playback, contador: C.contadorVisivel(M.vivos, M.w.settings.contador_minimo), publicas: f("publico", b.desde || 0), privadas: f("privado", b.desde_priv || 0), ocultas: M.msgs.filter((m) => m.oculto).map((m) => m.id), ia: true } };
    }
    case "pub_mensagem": {
      const canal = b.canal === "privado" ? "privado" : "publico";
      let texto = b.texto, removido = false;
      if (canal === "publico") ({ texto, removido } = C.mascararDados(texto));
      const add = (o) => M.msgs.push({ id: M.msgs.length + 1, created_at: new Date().toISOString(), extra: {}, ...o });
      add({ canal, autor: "participante", nome: reg.nome.split(" ")[0], texto, token: b.token });
      if (removido) add({ canal: "privado", autor: "sistema", nome: "Aviso", texto: "Para sua segurança, tiramos e-mail e telefone da sua mensagem no chat aberto.", token: b.token });
      add({ canal, autor: "ia", nome: "Assistente (IA)", texto: canal === "publico" ? "Boa pergunta! O prazo depende do estado. Para falar do seu caso, use a caixa privada." : "Claro. Escolha um horário nos botões abaixo.", extra: canal === "publico" ? { convite_privado: true } : { mostrar_agenda: true }, token: b.token });
      return { j: { ok: true, removido } };
    }
    case "pub_contato":
      if (b.consentimento !== true) return erro(400, "Para a equipe entrar em contato, marque a autorização.");
      M.contato = true; M.msgs.push({ id: M.msgs.length + 1, canal: "privado", autor: "sistema", nome: "Confirmação", texto: "Recebemos seus contatos.", token: b.token, created_at: new Date().toISOString(), extra: {} });
      return { j: { ok: true, agendamento: "calendario" } };
    case "pub_horarios": { const d = new Date(Date.now() + 2 * 86400_000); d.setUTCHours(14, 0, 0, 0); return { j: { horarios: [d.toISOString(), new Date(d.getTime() + 1800_000).toISOString()], timezone: "America/New_York", tipos: ["video", "phone", "whatsapp"], telefone_obrigatorio: true } }; }
    case "pub_agendar":
      if (!/^\+[1-9]\d{6,14}$/.test(String(b.telefone || "").replace(/[^\d+]/g, ""))) return erro(400, "Informe o telefone com o código do país, por exemplo +1 407 555 0100.");
      M.agendado = b; M.msgs.push({ id: M.msgs.length + 1, canal: "privado", autor: "sistema", nome: "Agendamento", texto: "Horário confirmado. Você vai receber a confirmação por e-mail.", token: b.token, created_at: new Date().toISOString(), extra: {} });
      return { j: { ok: true } };
    case "pub_link": M.link = true; M.msgs.push({ id: M.msgs.length + 1, canal: "privado", autor: "sistema", nome: "Agendamento", texto: "Aqui está o link: https://endeavorbiz.com/booking.html", extra: { link: "https://endeavorbiz.com/booking.html" }, token: b.token, created_at: new Date().toISOString() }); return { j: { ok: true } };
  }
  return erro(400, "?");
}
function wav(seg = 3, taxa = 8000) {
  const n = seg * taxa, b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24); b.writeUInt32LE(taxa, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}

/* ---------------- testes ---------------- */
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
const page = await ctx.newPage();
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.route("**/functions/v1/webinar", async (r) => { const res = servidor(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
await page.route("**/audio-teste.wav", (r) => r.fulfill({ status: 200, body: wav(), headers: { "content-type": "audio/wav" } }));

// inscrição
await page.goto(`${BASE}/webinar.html?w=como-abrir-llc-ab12cd`);
await page.waitForSelector("#lw-n");
ok(/Como abrir sua LLC nos EUA/.test(await page.textContent("h1")) && /assistente de IA/.test(await page.textContent(".lw-nota")), "página de inscrição com título e aviso de apresentação pré-gravada e IA");
await page.fill("#lw-n", "Ana Souza"); await page.fill("#lw-e", "ana@exemplo.com");
await page.click(".lw-inscr-form button[type=submit]"); await page.waitForTimeout(200);
ok(/Confirme que leu/.test(await page.textContent(".lw-inscr-form")), "inscrição exige aceitar o aviso");
await page.check("#lw-a"); await page.click(".lw-inscr-form button[type=submit]"); await page.waitForSelector("text=Inscrição confirmada!");
const link = await page.getAttribute(".lw-inscr-form a.btn", "href");
ok(/t=11111111-2222-4333-8444-000000000001/.test(link), "inscrição confirmada com link pessoal");
await page.screenshot({ path: `${OUT}/webinar-inscricao.png` });

// antes do início: contagem regressiva, chat fechado
await page.goto(`${BASE}/${link}`); await page.waitForSelector(".lw-sala");
await page.waitForTimeout(600);
ok(/Começa em/.test(await page.textContent("#lwSelo")) && await page.isDisabled(".lw-chat .lw-form input"), "antes do início: contagem regressiva e chat fechado");
ok(await page.isHidden("#lwConta"), "contador escondido");

// começou há 25 s: quem chega atrasado entra no slide 2, no ponto certo
M.w.starts_at = new Date(Date.now() - 25_000).toISOString();
await page.reload(); await page.waitForSelector(".lw-sala"); await page.waitForTimeout(3500);
ok(/AO VIVO/.test(await page.textContent("#lwSelo")) && /Etapas/.test(await page.textContent("#lwPalco")), "atrasado entra no slide certo (relógio do servidor)");
ok(/Agora as etapas/.test(await page.textContent(".lw-legenda")), "legenda do roteiro");
const pub = await page.textContent(".lw-chat .lw-msgs");
ok(/Bem-vindo! Eu sou o assistente de IA/.test(pub) && /Pergunta frequente/.test(pub) && /Preciso morar nos EUA/.test(pub), "boas-vindas da IA e pergunta frequente identificada como tal");
ok(await page.$$eval(".lw-m--participante", (x) => x.length) === 0, "nenhum participante inventado no chat");
ok(await page.isHidden("#lwConta"), "contador escondido abaixo do mínimo (1 de 3)");
M.vivos = 4; await page.waitForTimeout(3300);
ok(/4 assistindo/.test(await page.textContent("#lwConta")), "contador aparece com o número real ao passar do mínimo");

// chat aberto: pergunta, resposta da IA identificada, convite para o privado, e-mail removido
await page.fill(".lw-chat .lw-painel:not([hidden]) input", "Quanto tempo leva? meu email é ana@exemplo.com");
await page.press(".lw-chat .lw-painel:not([hidden]) input", "Enter"); await page.waitForTimeout(600);
const txt = await page.textContent(".lw-chat .lw-msgs");
ok(/\[e-mail removido\]/.test(txt) && !/ana@exemplo.com/.test(txt), "e-mail removido do chat aberto");
ok(await page.locator(".lw-m--ia .lw-tag--ia").count() >= 1 && /Boa pergunta/.test(txt), "resposta do assistente marcada como IA");
ok(await page.$$eval(".lw-abas button.novo", (x) => x.length) === 1, "aviso de mensagem nova na caixa privada");
await page.screenshot({ path: `${OUT}/webinar-sala.png` });

// caixa privada: contatos com autorização, horários reais, agendar
await page.click(".lw-m--ia .lw-cta");
ok(!(await page.isHidden(".lw-priv-intro")) && /só entre você e a equipe/.test(await page.textContent(".lw-priv-intro")), "convite abre a caixa privada");
ok(/tiramos e-mail e telefone/.test(await page.textContent(".lw-painel:not([hidden]) .lw-msgs")), "aviso de segurança na caixa privada");
await page.click(".lw-contato button[type=submit]"); await page.waitForTimeout(300);
ok(/marque a autorização/.test(await page.textContent(".lw-contato")), "contatos exigem autorização");
await page.check("#lwAut"); await page.fill('.lw-contato input[type=tel]', "+1 407 555 0100"); await page.click(".lw-contato button[type=submit]"); await page.waitForTimeout(600);
ok(M.contato && await page.isVisible("text=Escolher um horário"), "contato salvo (lead) e botão de horários");
await page.click("text=Escolher um horário"); await page.waitForSelector(".lw-hora");
ok(await page.$$eval(".lw-hora", (x) => x.length) === 2 && /Horários no seu fuso/.test(await page.textContent(".lw-agenda")), "horários livres da agenda, no fuso da pessoa");
await page.locator(".lw-hora").first().click(); await page.selectOption(".lw-agenda select", "whatsapp");
await page.fill(".lw-agenda input[type=tel]", "407"); await page.click("text=Confirmar horário"); await page.waitForTimeout(300);
ok(/código do país/.test(await page.textContent(".lw-agenda")), "telefone inválido é recusado com explicação");
await page.fill(".lw-agenda input[type=tel]", "+1 407 555 0100"); await page.click("text=Confirmar horário"); await page.waitForTimeout(3500);
ok(M.agendado && M.agendado.tipo === "whatsapp" && /Horário confirmado/.test(await page.textContent(".lw-painel:not([hidden]) .lw-msgs")), "agendado e confirmado na caixa privada");
await page.click("text=Prefiro receber o link por e-mail").catch(() => { });
// pausa do organizador chega a todos
M.w.playback = { pausado_em: new Date().toISOString() }; await page.waitForTimeout(3500);
ok(/PAUSADO/.test(await page.textContent("#lwSelo")), "pausa do organizador aparece para o público");
M.w.playback = { encerrado_em: new Date().toISOString() }; await page.waitForTimeout(3500);
ok(/terminou/.test(await page.textContent(".lw-espera")), "encerramento aparece para o público");

// celular
const cel = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await cel.route("**/functions/v1/webinar", async (r) => { const res = servidor(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ status: res.st || 200, json: res.j }); });
M.w.playback = {}; M.w.starts_at = new Date(Date.now() - 25_000).toISOString();
await cel.goto(`${BASE}/${link}`); await cel.waitForSelector(".lw-sala"); await cel.waitForTimeout(1500);
ok(await cel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "celular: sem rolagem lateral");
await cel.screenshot({ path: `${OUT}/webinar-celular.png` });
ok(erros.length === 0, "sem erros de JavaScript " + erros.join(" | "));
await browser.close();
console.log(falhas.length ? `\n${falhas.length} falha(s).` : "\nTudo certo.");
process.exit(falhas.length ? 1 : 0);
