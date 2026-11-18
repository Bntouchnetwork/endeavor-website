// Regras da Telefonia (sem banco nem rede): deno test --allow-read --no-lock tests/telefonia.test.ts
import { decidirChamada, e164, ehDemo, estimarEncaminhamento, limparRouting, numerosDemo, paisDe, palavraChave, partesSms, podeEnviarSms, situacaoConsumo, tipoDoNumero } from "../supabase/functions/telephony/regras.ts";
import { demo, telnyx } from "../supabase/functions/telephony/provedor.ts";

const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const sim = (v: unknown, m: string) => { if (!v) throw new Error(m); };

Deno.test("números: E.164, tipo, país e faixa de demonstração", () => {
  eq(e164("(407) 555-0123"), "+14075550123");
  eq(e164("+55 11 91234-5678"), "+5511912345678");
  eq(e164("123"), "");
  eq(tipoDoNumero("+18885550100"), "tollfree");
  eq(tipoDoNumero("+14075550100"), "local");
  eq(tipoDoNumero("+5511912345678"), "");
  eq(paisDe("+5511912345678"), "BR");
  const d = numerosDemo("tollfree", "833");
  sim(d.length === 6 && d.every((n) => n.startsWith("+1833") && ehDemo(n)), "toll-free de demonstração na faixa 555-01XX");
  sim(numerosDemo("local", "305").every((n) => n.startsWith("+1305555") && ehDemo(n)), "local de demonstração");
  sim(!ehDemo("+14075551234"), "número fora da faixa de ficção não é demonstração");
});

Deno.test("atendimento: horário comercial, feriado, não perturbe e destino", () => {
  const r = limparRouting({ horario: { ativo: true, tz: "America/New_York", dias: { 1: [["09:00", "18:00"]], 9: [["01:00", "02:00"]] } }, feriados: [{ data: "2026-11-26", nome: "Thanksgiving" }],
    destino: "numero", encaminhar_para: "+5511912345678", gravar: true, greeting: { pt: "Obrigado por ligar <b>", xx: "não" } }, { encaminhamento: false, gravacao: false });
  eq(r.destino, "app", "sem permissão de encaminhamento volta para o app");
  eq(r.gravar, false, "sem permissão, sem gravação");
  eq(Object.keys(r.horario.dias), ["1"]);
  eq(r.greeting, { pt: "Obrigado por ligar b" });
  const seg10h = Date.UTC(2026, 10, 16, 15, 0), seg20h = Date.UTC(2026, 10, 17, 1, 0), feriado = Date.UTC(2026, 10, 26, 15, 0);
  eq(decidirChamada(r, seg10h).acao, "app");
  eq(decidirChamada(r, seg20h), { aberto: false, motivo: "fora_do_horario", acao: "voicemail" });
  eq(decidirChamada(r, feriado).motivo, "feriado");
  eq(decidirChamada({ ...r, nao_perturbe: true }, seg10h).motivo, "nao_perturbe");
  const enc = limparRouting({ destino: "numero", encaminhar_para: "+14075550111" }, { encaminhamento: true, gravacao: true });
  eq([enc.destino, enc.encaminhar_para], ["numero", "+14075550111"]);
  eq(decidirChamada(enc, seg10h).acao, "encaminhar");
});

Deno.test("encaminhamento: soma as duas pernas e aplica a margem; sem tarifa conferida não estima", () => {
  const rates = [
    { item: "voz_entrada_tollfree", custo: 0.02, verificado_em: "2026-11-18" }, { item: "voz_entrada_local", custo: 0.005, verificado_em: "2026-11-18" },
    { item: "voz_saida_US", custo: 0.007, verificado_em: "2026-11-18" }, { item: "voz_saida_BR", custo: 0.05, verificado_em: "2026-11-10" }];
  const br = estimarEncaminhamento(rates, "tollfree", "+5511912345678", 30) as any;
  sim(br.ok && Math.abs(br.custo_minuto - 0.07) < 1e-9 && Math.abs(br.preco_minuto - 0.091) < 1e-9 && br.verificado_em === "2026-11-10", "Brasil: entrada toll-free + saída BR, com 30%");
  const us = estimarEncaminhamento(rates, "local", "+14075550111", 30) as any;
  sim(us.ok && Math.abs(us.custo_minuto - 0.012) < 1e-9 && us.preco_minuto < br.preco_minuto, "EUA custa diferente do Brasil");
  const mx = estimarEncaminhamento(rates, "local", "+525512345678", 30) as any;
  sim(!mx.ok && mx.falta.includes("saída para MX"), "sem tarifa do México: não estima");
});

Deno.test("consumo: franquia, alertas de 80% e 100% e limite de gasto", () => {
  const plano = { minutos: 500, sms: 250 };
  eq(situacaoConsumo({ minutos_entrada: 300, minutos_saida: 100, sms_entrada: 10 }, plano, null).alerta, 80);
  eq(situacaoConsumo({ minutos_entrada: 500, sms_saida: 1 }, plano, null).alerta, 100);
  eq(situacaoConsumo({ minutos_entrada: 10 }, plano, null).alerta, 0);
  sim(situacaoConsumo({ preco: 50 }, plano, 5000).bloqueado, "gasto extra no limite bloqueia");
  sim(situacaoConsumo({}, plano, null).estimado, "sem reconciliação é estimado");
});

Deno.test("SMS: STOP/HELP, opt-out e registro A2P/toll-free", () => {
  eq(palavraChave("STOP"), "stop"); eq(palavraChave(" parar! "), "stop"); eq(palavraChave("Start"), "start"); eq(palavraChave("ajuda"), "help"); eq(palavraChave("stop by tomorrow"), "");
  sim(!podeEnviarSms({ tipo: "local", sms_registro: "aprovado" }, { estado: "opt_out" }, false).ok, "opt-out bloqueia");
  sim(/10DLC/.test(podeEnviarSms({ tipo: "local", sms_registro: "pendente" }, null, false).motivo), "local sem 10DLC aprovado não envia");
  sim(/toll-free/.test(podeEnviarSms({ tipo: "tollfree", sms_registro: "nao_iniciado" }, null, false).motivo), "toll-free sem verificação não envia");
  sim(podeEnviarSms({ tipo: "local", sms_registro: "nao_aplicavel" }, null, true).ok, "demonstração envia (fictício)");
  eq(partesSms("a".repeat(160)), 1); eq(partesSms("a".repeat(161)), 2); eq(partesSms("ç".repeat(71)), 2);
});

Deno.test("provedor: demonstração identificada; Telnyx nunca compra na fase 1", async () => {
  eq((await demo.estado()).estado, "demonstracao");
  sim((await demo.buscarNumeros("local", "407")).every((n) => n.demo), "busca de demonstração marca demo");
  const semChave = telnyx(() => undefined);
  eq((await semChave.estado()).estado, "nao_configurado");
  const comChave = telnyx((k) => k === "TELNYX_API_KEY" ? "x" : undefined);
  eq((await comChave.estado()).estado, "configurado_nao_verificado");
  let erro = ""; try { await comChave.comprarNumero("+14075550100"); } catch (e) { erro = (e as Error).message; }
  sim(/bloqueada/.test(erro), "compra real bloqueada");
});
