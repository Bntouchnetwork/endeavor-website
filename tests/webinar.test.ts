// Live Webinar: regras compartilhadas (webinar/core.js) e regras do servidor (supabase/webinar/regras.ts).
//   deno test --allow-read tests/webinar.test.ts
import "../webinar/core.js";
import { calcularRelatorio, limparFaq, limparSettings } from "../supabase/functions/webinar/regras.ts";
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWebinarCore;
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };

const slides = [{ id: "a", duracao: 10 }, { id: "b", roteiro: Array(150).fill("p").join(" ") }, { id: "c" }];
const linha = C.linhaDoTempo(slides, { a: { duracao_ms: 4000 } }, "normal");

Deno.test("linha do tempo: narração pronta manda (com folga), senão duração, senão roteiro, senão 8 s", () => {
  eq(linha.map((x: { dur: number }) => x.dur), [4600, 60000, 8000]);
  eq(linha.map((x: { ini: number }) => x.ini), [0, 4600, 64600]);
  eq(C.total(linha), 72600);
});

Deno.test("posição pelo relógio do servidor: antes, ao vivo (atrasado entra no ponto certo), pausado, encerrado", () => {
  const ini = Date.parse("2026-12-01T15:00:00Z");
  const w = { starts_at: "2026-12-01T15:00:00Z", playback: {} };
  eq(C.posicao(w, linha, ini - 5000).estado, "antes");
  const p = C.posicao(w, linha, ini + 30000);
  eq([p.estado, p.pos], ["ao_vivo", 30000]);
  eq(C.slideNa(linha, p.pos), { i: 1, offset: 25400 }, "quem chega aos 30 s cai no slide 2");
  const pausado = { starts_at: w.starts_at, playback: { pausado_em: new Date(ini + 20000).toISOString(), pausa_total_ms: 5000 } };
  eq(C.posicao(pausado, linha, ini + 99999), { estado: "pausado", pos: 15000 }, "pausa congela e desconta pausas anteriores");
  const retomado = { starts_at: w.starts_at, playback: { pausa_total_ms: 10000 } };
  eq(C.posicao(retomado, linha, ini + 30000).pos, 20000, "depois de retomar, desconta o tempo parado");
  eq(C.posicao(w, linha, ini + 999999).estado, "encerrado");
  eq(C.posicao({ starts_at: w.starts_at, playback: { encerrado_em: "x" } }, linha, ini + 1000).estado, "encerrado", "encerrado pelo organizador");
});

Deno.test("contador mostra só o número real e só a partir do mínimo", () => {
  eq(C.contadorVisivel(7, 20), null); eq(C.contadorVisivel(20, 20), 20); eq(C.contadorVisivel(0, 0), null); eq(C.contadorVisivel(3, 0), 3);
});

Deno.test("chat aberto: e-mail e telefone são removidos; números curtos ficam", () => {
  const r = C.mascararDados("meu email é ana@exemplo.com e o zap +1 (407) 555-0100, abri em 2024 com 3 sócios");
  eq(r.removido, true);
  eq(r.texto, "meu email é [e-mail removido] e o zap [número removido], abri em 2024 com 3 sócios");
  eq(C.mascararDados("Quanto tempo leva?").removido, false);
});

Deno.test("mensagens programadas: boas-vindas, perguntas frequentes aprovadas, convites e convite final", () => {
  const w = { settings: { convites: [1] }, ai_plan: { faq: [{ slide: 1, pergunta: "Preciso morar nos EUA?", resposta: "Não necessariamente." }, { slide: 2, pergunta: "x", resposta: "y", aprovada: false }] } };
  const p = C.programadas(w, linha);
  eq(p.map((x: { chave: string }) => x.chave), ["boas-vindas", "convite-1", "faq-0", "cta-final"]);
  eq(p.find((x: { chave: string }) => x.chave === "faq-0").autor, "faq", "pergunta frequente aparece como tal, não como alguém do público");
  eq(C.programadas({ settings: { faq: false, boas_vindas: false, cta_final: false } , ai_plan: w.ai_plan }, linha).length, 0, "tudo desligado");
});

Deno.test("configurações: padrões e limites", () => {
  const s = limparSettings({ contador_minimo: -5, agendamento: "x", convites: [1, 1, 99, "2"], chat_abre_min: 999, idioma: "fr" });
  eq([s.contador_minimo, s.agendamento, s.convites, s.chat_abre_min, s.idioma, s.chat_ia, s.legendas], [0, "calendario", [1, 29, 2], 120, "pt-BR", true, true]);
  eq(limparSettings({}).contador_minimo, 20, "padrão do contador");
});

Deno.test("perguntas frequentes: limpa, limita o slide e descarta vazias", () => {
  eq(limparFaq([{ slide: 9, pergunta: " <b>Oi</b> ", resposta: "R" }, { pergunta: "", resposta: "x" }, { slide: -1, pergunta: "P", resposta: "R", aprovada: false }], 3),
    [{ slide: 2, pergunta: "b Oi /b", resposta: "R", aprovada: true }, { slide: 0, pergunta: "P", resposta: "R", aprovada: false }]);
});

Deno.test("relatório: participantes, tempo, pico, retenção e saídas por slide", () => {
  const t = (s: number) => new Date(Date.parse("2026-12-01T15:00:00Z") + s * 1000).toISOString();
  const att = [
    { registration_id: "r1", first_seen: t(0), last_seen: t(72), seconds: 72, first_pos_ms: 0, last_pos_ms: 72600 },          // viu tudo
    { registration_id: "r2", first_seen: t(10), last_seen: t(30), seconds: 20, first_pos_ms: 10000, last_pos_ms: 30000 },     // saiu no slide 2
    { registration_id: "r2", first_seen: t(40), last_seen: t(50), seconds: 10, first_pos_ms: 40000, last_pos_ms: 50000 },     // voltou e saiu de novo
    { registration_id: "r3", first_seen: t(65), last_seen: t(72), seconds: 7, first_pos_ms: 65000, last_pos_ms: 72600 }];     // chegou atrasado
  const r = calcularRelatorio(linha, att, 5);
  eq([r.inscritos, r.participantes, r.comparecimento_pct, r.pico_simultaneo, r.ficaram_ate_o_fim, r.sairam_antes], [5, 3, 60, 2, 2, 1]);
  eq(r.retencao.map((x: { pct: number }) => x.pct), [33, 33, 67], "retenção no início de cada slide");
  eq(r.saidas.map((x: { n: number }) => x.n), [0, 1, 0], "r2 saiu durante o slide 2");
  eq(r.media_min, 0.6);
});

Deno.test("core.js do servidor é cópia do navegador", async () => {
  const a = await Deno.readTextFile(new URL("../webinar/core.js", import.meta.url));
  const b = await Deno.readTextFile(new URL("../supabase/functions/webinar/core.js", import.meta.url)).catch(() => Deno.readTextFile(new URL("../supabase/webinar/core.js", import.meta.url)));
  eq(a === b, true, "supabase/webinar/core.js precisa ser cópia de webinar/core.js");
});

Deno.test("abertura gravada: os slides começam depois dela, e durante ela o slide é -1", () => {
  const l = C.linhaDoTempo([{ id: "a", duracao: 10 }, { id: "b", duracao: 20 }], {}, "normal", 45000);
  eq(l.map((x: { ini: number }) => x.ini), [45000, 55000]);
  eq(C.total(l), 75000);
  eq(C.slideNa(l, 12000), { i: -1, offset: 12000 }, "durante a abertura");
  eq(C.slideNa(l, 50000), { i: 0, offset: 5000 });
  eq(C.slideNa(linha, 0), { i: 0, offset: 0 }, "sem abertura, continua igual");
});

Deno.test("voz de teste: quem entra no meio do slide ouve o resto do roteiro", () => {
  eq(C.restoDoRoteiro("um dois três quatro", 0, 4000), "um dois três quatro");
  eq(C.restoDoRoteiro("um dois três quatro", 2000, 4000), "três quatro");
  eq(C.restoDoRoteiro("um dois três quatro", 9000, 4000), "");
  eq(limparSettings({ voz_teste: true }).voz_teste, true); eq(limparSettings({}).voz_teste, false);
});
