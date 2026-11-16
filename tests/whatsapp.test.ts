// My WhatsApp Manager: regras compartilhadas (wa-extension/core.js) e regras do servidor (supabase/whatsapp/regras.ts).
//   deno test --allow-read tests/whatsapp.test.ts
import "../wa-extension/core.js";
import { montarEntrada, normalizar } from "../supabase/functions/whatsapp/regras.ts";
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWaCore;
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const sim = (c: boolean, m: string) => { if (!c) throw new Error(m); };
const fixo = (v: number) => () => v;

Deno.test("cópia do core no servidor é idêntica à da extensão", async () => {
  eq(await Deno.readTextFile(new URL("../supabase/functions/whatsapp/core.js", import.meta.url)), await Deno.readTextFile(new URL("../wa-extension/core.js", import.meta.url)), "core.js");
});

Deno.test("ajustes: padrão com Takeover ligado e limites seguros", () => {
  const p = C.limparAjustes({});
  eq([p.takeover, p.takeover_individual, p.espera_min, p.espera_max, p.velocidade], [true, true, 4, 12, 220]);
  const a = C.limparAjustes({ espera_min: 30, espera_max: 2, velocidade: 99999, pausa_min: -5, limite_hora: 1000, takeover: "sim", link_agenda: "javascript:alert(1)", idioma: "xx_yy", prontas: [{ titulo: "", texto: "  " }, { texto: "Oi" }] });
  eq([a.espera_min, a.espera_max], [30, 30], "máximo nunca menor que o mínimo");
  eq([a.velocidade, a.pausa_min, a.limite_hora, a.takeover], [900, 0, 120, false]);
  eq(a.link_agenda, "https://endeavorbiz.com/booking.html", "só link https");
  eq(a.idioma, "pt-BR");
  eq(a.prontas, [{ titulo: "Resposta", texto: "Oi" }], "respostas prontas vazias saem");
});

Deno.test("tempos humanos: espera e pausa sorteadas entre mínimo e máximo", () => {
  const a = C.limparAjustes({ espera_min: 4, espera_max: 12, pausa_min: 3, pausa_max: 8 });
  eq([C.espera(a, fixo(0)), C.espera(a, fixo(1)), C.espera(a, fixo(0.5))], [4000, 12000, 8000]);
  eq([C.pausa(a, fixo(0)), C.pausa(a, fixo(1))], [3000, 8000]);
});

Deno.test("digitação: velocidade normal, pausas na pontuação e teto de tempo", () => {
  const a = C.limparAjustes({ velocidade: 240, variacao: 0, digitar_max: 45 });
  const r = C.ritmoDigitacao("Oi, tudo bem?", a, fixo(0.5));
  eq(r.length, 13);
  eq(r[0], 250, "240 car/min = 250 ms por letra");
  sim(r[2] > r[1] && r[12] > r[2], "vírgula e interrogação levam mais tempo");
  const longo = "a".repeat(2000);
  const t = C.tempoDigitacao(longo, a, fixo(0.5));
  sim(t <= 45000 + 2000 && t >= 40000, "mensagem longa acelera para caber em digitar_max (" + t + ")");
  const v = C.ritmoDigitacao("abcd", C.limparAjustes({ velocidade: 240, variacao: 20 }), fixo(1));
  eq(v[0], 300, "variação de 20% para cima");
});

Deno.test("leitura do WhatsApp: data-id e data-pre-plain-text", () => {
  eq(C.lerDataId("false_15551230000@c.us_3EB0ABC"), { eu: false, chave: "15551230000@c.us", grupo: false });
  eq(C.lerDataId("true_120363000000000001@g.us_XYZ_15551230000@c.us"), { eu: true, chave: "120363000000000001@g.us", grupo: true });
  eq(C.lerDataId("false_123456@lid_ABC").chave, "123456@lid");
  eq(C.lerDataId("lixo"), null);
  eq(C.lerPrePlain("[10:15, 11/16/2026] Maria Souza: "), { hora: "10:15", data: "11/16/2026", autor: "Maria Souza" });
  eq(C.lerPrePlain("[9:05 PM, 11/16/2026] +1 (407) 555-0100: ").autor, "+1 (407) 555-0100");
});

Deno.test("números sensíveis saem antes da IA e do registro (telefone e e-mail ficam)", () => {
  const t = C.limparSensivel("Meu SSN é 123-45-6789, cartão 4111 1111 1111 1111, routing 021000021 e conta: 123456789. Fone +1 407 555 0100, maria@x.com").texto;
  sim(!t.includes("123-45-6789") && !t.includes("4111") && !t.includes("021000021") && !t.includes("123456789"), t);
  sim(t.includes("+1 407 555 0100") && t.includes("maria@x.com"), "telefone e e-mail continuam: " + t);
  sim(C.limparSensivel("passaporte n° AB1234567").texto.includes("[número removido]"), "passaporte");
  eq(C.limparSensivel("Pedido 1234567890123").removido, false, "número qualquer que não passa no Luhn fica");
});

Deno.test("conversa para a IA: últimas mensagens, EU e autores, sem números sensíveis", () => {
  const m = [{ eu: false, autor: "Ana", texto: "SSN 123-45-6789", hora: "10:00" }, { eu: true, texto: "Não mande isso aqui." }, { eu: false, autor: "Ana", texto: "" }];
  eq(C.montarConversa(m), "[10:00] Ana: SSN [número removido]\nEU: Não mande isso aqui.");
  eq(C.montarConversa(Array.from({ length: 50 }, (_, i) => ({ texto: "m" + i })), 5).split("\n").length, 5);
});

Deno.test("Takeover responde uma vez por mensagem nova e nunca à própria mensagem", () => {
  eq(C.ultimaRecebida([{ id: 1, eu: false, texto: "oi" }, { id: 2, eu: true, texto: "olá" }]), null);
  eq(C.ultimaRecebida([{ id: 1, eu: true, texto: "olá" }, { id: 2, eu: false, texto: "", midia: "áudio" }]).id, 2);
});

Deno.test("mensagem recente (para não responder mensagens antigas ao abrir)", () => {
  const agora = new Date(2026, 10, 16, 22, 16);
  eq([C.recente("22:15", agora, 2), C.recente("10:15 PM", agora, 2), C.recente("22:10", agora, 2), C.recente("08:00", agora, 2), C.recente("", agora)], [true, true, false, false, false]);
  eq(C.recente("23:59", new Date(2026, 10, 17, 0, 1), 3), true, "virada da meia-noite");
});

Deno.test("ritmo do Takeover: chave, horário, limite por hora e intervalo do grupo", () => {
  const a = C.limparAjustes({ limite_hora: 2, grupo_intervalo: 10 });
  const t = Date.now();
  eq(C.podeResponder(C.limparAjustes({ takeover: false }), [], t).ok, false);
  eq(C.podeResponder(a, [t - 1000], t).ok, true);
  eq(C.podeResponder(a, [t - 1000, t - 2000], t).motivo, "Limite de 2 respostas por hora");
  eq(C.podeResponder(a, [t - 4000_000, t - 5000_000], t).ok, true, "envios de mais de 1 h não contam");
  eq(C.podeResponder(a, [], t, true, t - 5 * 60000).motivo, "Intervalo mínimo do grupo");
  eq(C.podeResponder(a, [], t, true, t - 11 * 60000).ok, true);
  const h = C.limparAjustes({ horario: { ativo: true, inicio: "08:00", fim: "20:00", tz: "America/New_York" } });
  eq(C.dentroDoHorario(h, new Date("2026-11-16T15:00:00Z")), true, "10h em NY");
  eq(C.dentroDoHorario(h, new Date("2026-11-17T03:00:00Z")), false, "22h em NY");
  const noite = C.limparAjustes({ horario: { ativo: true, inicio: "20:00", fim: "06:00", tz: "America/New_York" } });
  eq(C.dentroDoHorario(noite, new Date("2026-11-17T03:00:00Z")), true, "horário que vira a noite");
});

Deno.test("entrada da IA: modo, negócio, horários, aviso e mensagens limpas", () => {
  const a = C.limparAjustes({});
  const e = montarEntrada("responder", a, { nome: "Maria", grupo: false }, [{ eu: false, autor: "Maria", texto: "cartão 4111 1111 1111 1111" }], { aviso: a.texto_aviso, horarios: ["seg 10:00"], pedido: "conta 12345678" });
  sim(e.includes("<modo>responder</modo>") && e.includes("<aviso_ia>Olá! Aqui é o assistente virtual da Endeavor.</aviso_ia>") && e.includes("<horarios>seg 10:00</horarios>"), e);
  sim(!e.includes("4111") && !e.includes("12345678"), "nada sensível vai para a IA");
  sim(e.includes("<conversa_tipo>individual</conversa_tipo>"), "tipo de conversa");
});

Deno.test("resposta da IA sempre no formato e sem números sensíveis", () => {
  eq(normalizar("responder", { responder: true, texto: "", escalar: false }).responder, false, "sem texto não responde");
  eq(normalizar("responder", { responder: true, texto: "Oi", escalar: true }).responder, false, "escalar nunca responde");
  eq(normalizar("grupo", { relevante: false, responder: true, texto: "Oi" }).responder, false, "grupo só responde assunto relevante");
  eq(normalizar("lead", { nome: "Ana", email: "nao-e-email" }).email, "", "e-mail inválido sai");
  eq(normalizar("comando", { acao: "apagar_tudo", texto: "x" }).acao, "escrever");
  eq(normalizar("sugerir", { resposta: "Seu SSN 123-45-6789", alternativas: ["a", "", 3, "b", "c", "d"] }), { resposta: "Seu SSN [número removido]", alternativas: ["a", "b", "c"] });
});
