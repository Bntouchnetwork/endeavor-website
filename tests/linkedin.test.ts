// Regras do LinkedIn Manager: deno test --allow-read --allow-env --no-lock tests/linkedin.test.ts
import { assinar, conferir, horariosDaSemana, limparAjustes, limparResposta, oportunidade, palavrasChave, podeAutomatico, textoLinkedIn, utcDe, violacao } from "../supabase/functions/linkedin/regras.ts";
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const sim = (v: unknown, m: string) => { if (!v) throw new Error(m); };

Deno.test("ajustes: manual por padrão, limites e links só https", () => {
  const a = limparAjustes({ idioma: "fr", posts_semana: 99, horarios: ["9h", "18:30", "09:00", "09:00"], fuso: "Mars/Olympus", modo_resposta: "x", whatsapp: "http://wa.me/1", agenda: "https://endeavorbiz.com/agendar.html?p=x",
    palavras: ["LLC ", "<b>ein</b>"], ext: { modo: "x", velocidade: 9999, intervalo_min: 1, intervalo_max: 0, limite_dia: 999 } });
  eq([a.idioma, a.posts_semana, a.horarios, a.fuso, a.modo_resposta, a.whatsapp], ["pt", 7, ["09:00", "18:30"], "America/New_York", "manual", ""]);
  eq(a.agenda, "https://endeavorbiz.com/agendar.html?p=x"); eq(a.palavras, ["llc", "bein/b"]);
  eq(a.ext, { modo: "manual", velocidade: 400, intervalo_min: 30, intervalo_max: 30, limite_dia: 50 });
  eq(limparAjustes({ whatsapp: "https://wa.me/14075550100" }).whatsapp, "https://wa.me/14075550100");
});

Deno.test("fuso: horário local vira UTC certo, no inverno e no verão", () => {
  eq(utcDe("2026-11-23", "09:00", "America/New_York").toISOString(), "2026-11-23T14:00:00.000Z");
  eq(utcDe("2026-07-06", "09:00", "America/New_York").toISOString(), "2026-07-06T13:00:00.000Z");
  eq(utcDe("2026-11-23", "09:00", "America/Sao_Paulo").toISOString(), "2026-11-23T12:00:00.000Z");
});

Deno.test("calendário: N posts em 7 dias, no futuro, espalhados e sem repetir horário", () => {
  const agora = Date.UTC(2026, 10, 20, 16, 0); // sexta 11h em Nova York
  const a = limparAjustes({ posts_semana: 3, horarios: ["09:00"], fuso: "America/New_York" });
  const h = horariosDaSemana(a, agora);
  eq(h.length, 3); sim(h.every((d) => d.getTime() > agora), "tudo no futuro");
  sim(h.every((d) => d.getUTCHours() === 14), "9h de Nova York");
  eq(new Set(h.map((d) => d.toISOString().slice(0, 10))).size, 3, "dias diferentes");
  sim(h.every((d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5), "dias úteis primeiro");
  const mais = horariosDaSemana(a, agora, h.map((d) => d.toISOString()));
  sim(mais.every((d) => !h.some((x) => x.getTime() === d.getTime())), "não repete horário ocupado");
  eq(horariosDaSemana(limparAjustes({ posts_semana: 7, horarios: ["09:00", "17:00"] }), agora).length, 7);
});

Deno.test("compliance: promessa de resultado e conselho individual não passam", () => {
  eq(violacao("Aprovação garantida do seu mortgage!"), "promessa de resultado");
  eq(violacao("We guarantee your loan"), "promessa de resultado");
  eq(violacao("No seu caso, a lei permite deduzir tudo"), "aconselhamento individual");
  eq(violacao("Green card garantido em 6 meses"), "promessa de visto");
  eq(violacao("Três erros comuns ao abrir uma LLC e como evitar."), "");
});

Deno.test("texto do post: reservados escapados e hashtags no formato do LinkedIn", () => {
  eq(textoLinkedIn("LLC (single) custa * menos #Empresas #EUA2026 e nº # 1"), "LLC \\(single\\) custa \\* menos {hashtag|\\#|Empresas} {hashtag|\\#|EUA2026} e nº \\# 1");
});

Deno.test("resposta a comentário: link só para lead e só os cadastrados", () => {
  const a = limparAjustes({ whatsapp: "https://wa.me/14075550100", agenda: "https://endeavorbiz.com/agendar.html" });
  eq(limparResposta("Fale com a gente: https://wa.me/14075550100 ou https://golpe.example/x", a, true), "Fale com a gente: https://wa.me/14075550100 ou");
  eq(limparResposta("Obrigado! https://wa.me/14075550100", a, false), "Obrigado!");
});

Deno.test("oportunidades por palavra-chave (sem acento) e extensão: DM nunca automática, limite e intervalo", () => {
  const p = palavrasChave(["abrir empresa", "LLC"], ["ein"]);
  eq(oportunidade("Alguém indica quem ajuda a ABRIR EMPRESA nos EUA? Preciso de EIN.", p), ["abrir empresa", "ein"]);
  eq(oportunidade("Bom dia a todos", p), []);
  const auto = limparAjustes({ ext: { modo: "auto", limite_dia: 2, intervalo_min: 60 } }), t = 1e12;
  eq(podeAutomatico(limparAjustes({}), "feed", 0, null, t).motivo, "manual");
  eq(podeAutomatico(auto, "dm", 0, null, t).motivo, "dm");
  eq(podeAutomatico(auto, "feed", 2, null, t).motivo, "limite");
  eq(podeAutomatico(auto, "feed", 1, t - 10_000, t).motivo, "intervalo");
  eq(podeAutomatico(auto, "grupo", 1, t - 61_000, t).ok, true);
});

Deno.test("state do OAuth: assinado, com validade", async () => {
  const s = await assinar({ c: "x", exp: 2000 }, "segredo");
  eq((await conferir(s, "segredo", 1000))?.c, "x");
  eq(await conferir(s, "outro", 1000), null); eq(await conferir(s, "segredo", 3000), null);
  eq(await conferir(s.replace(/^./, "A"), "segredo", 1000), null);
});

// ---- extensão (li-extension/core.js) ----
import "../li-extension/core.js";
// deno-lint-ignore no-explicit-any
const X = (globalThis as any).ELiCore;
Deno.test("extensão: manual por padrão; automático só com o risco aceito; token só para o servidor da Endeavor", () => {
  eq(X.limpar({}).modo, "manual");
  eq(X.limpar({ modo: "auto" }).modo, "manual", "sem aceitar o risco continua manual");
  eq(X.limpar({ modo: "auto", aceitouRisco: true }).modo, "auto");
  eq(X.limpar({ url: "https://golpe.example/functions/v1/linkedin" }).url, X.PADRAO.url);
  eq(X.limpar({ token: "abc" }).token, "");
  eq(X.limpar({ intervalo_min: 5, intervalo_max: 1, limite_dia: 500, velocidade: 5 }), { ...X.limpar({}), intervalo_min: 30, intervalo_max: 30, limite_dia: 50, velocidade: 80 });
});
Deno.test("extensão: origem pela página, DM nunca automática e digitação em ritmo humano", () => {
  eq([X.origemDe("/feed/"), X.origemDe("/groups/123/"), X.origemDe("/messaging/thread/1/")], ["feed", "grupo", "dm"]);
  const auto = X.limpar({ modo: "auto", aceitouRisco: true });
  eq(X.podeAuto(auto, "dm", { auto: true, reply: "oi" }), false);
  eq(X.podeAuto(auto, "feed", { auto: false, reply: "oi" }), false, "o servidor também precisa liberar");
  eq(X.podeAuto(auto, "feed", { auto: true, reply: "oi" }), true);
  eq(X.podeAuto(X.limpar({}), "feed", { auto: true, reply: "oi" }), false);
  const d = X.atrasos("Olá, tudo bem? Posso ajudar.", 240);
  eq(d.length, 28); sim(new Set(d).size > 10, "atrasos variam"); sim(d.every((n: number) => n >= 100), "nunca instantâneo");
  const media = d.reduce((s: number, n: number) => s + n, 0) / d.length; sim(media > 200 && media < 900, "ritmo perto de 240 caracteres/min: " + media);
  const i = X.proximoIntervalo(auto, () => 0.5); eq(i, (auto.intervalo_min + 0.5 * (auto.intervalo_max - auto.intervalo_min)) * 1000);
});
