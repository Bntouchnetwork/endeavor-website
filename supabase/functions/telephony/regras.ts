// Regras da Telefonia, sem banco nem rede (testadas em tests/telefonia.test.ts).
// deno-lint-ignore no-explicit-any
type Any = any;

export const TOLLFREE = ["800", "888", "877", "866", "855", "844", "833"];
export const IDIOMAS = ["pt", "en", "es"];
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** telefone em E.164 (+ e 8 a 15 dígitos). Número dos EUA sem +1 ganha o +1. */
export function e164(v: unknown): string {
  const s = String(v ?? "").trim();
  let d = s.replace(/[^\d]/g, "");
  if (!d) return "";
  if (!s.startsWith("+") && d.length === 10) d = "1" + d;
  return d.length >= 8 && d.length <= 15 ? "+" + d : "";
}
export function ehEUA(n: string) { return /^\+1[2-9]\d{9}$/.test(n); }
export function tipoDoNumero(n: string): "tollfree" | "local" | "" {
  if (!ehEUA(n)) return "";
  return TOLLFREE.includes(n.slice(2, 5)) ? "tollfree" : "local";
}
/** país do destino pelo prefixo (o suficiente para tarifa e antifraude) */
export function paisDe(n: string): string {
  if (/^\+1/.test(n)) return "US";
  if (/^\+55/.test(n)) return "BR";
  if (/^\+351/.test(n)) return "PT";
  if (/^\+52/.test(n)) return "MX";
  if (/^\+44/.test(n)) return "GB";
  if (/^\+34/.test(n)) return "ES";
  return "OUTRO";
}

/* ---------------- números de demonstração ----------------
 * Faixa NPA-555-01XX: reservada para ficção nos EUA, nunca é número real. */
export function numerosDemo(tipo: "local" | "tollfree", prefixo: string, qtd = 6): string[] {
  const p = tipo === "tollfree" ? (TOLLFREE.includes(prefixo) ? prefixo : "888") : (/^[2-9]\d{2}$/.test(prefixo) ? prefixo : "407");
  return Array.from({ length: Math.min(10, qtd) }, (_, i) => `+1${p}5550${String(100 + i * 7).slice(-3)}`.slice(0, 12));
}
export function ehDemo(n: string) { return /^\+1[2-9]\d{2}55501\d{2}$/.test(n); }

/* ---------------- atendimento: horário, ausência, destino ---------------- */
export const DIAS = [0, 1, 2, 3, 4, 5, 6];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const FUSOS = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Sao_Paulo"];
export function limparRouting(r: Any, permissoes: { encaminhamento: boolean; gravacao: boolean }) {
  r = r && typeof r === "object" ? r : {};
  const msgs = (m: Any) => Object.fromEntries(IDIOMAS.map((l) => [l, txt(m?.[l], 400)]).filter(([, v]) => v));
  const h = r.horario && typeof r.horario === "object" ? r.horario : {};
  const dias: Any = {};
  for (const d of DIAS) {
    const faixas = (Array.isArray(h.dias?.[d]) ? h.dias[d] : []).filter((f: Any) => Array.isArray(f) && HORA.test(f[0]) && HORA.test(f[1]) && f[1] > f[0]).slice(0, 3);
    if (faixas.length) dias[d] = faixas.map((f: Any) => [f[0], f[1]]);
  }
  const feriados = (Array.isArray(r.feriados) ? r.feriados : []).filter((x: Any) => /^\d{4}-\d{2}-\d{2}$/.test(x?.data)).slice(0, 60).map((x: Any) => ({ data: x.data, nome: txt(x.nome, 80) }));
  let destino = ["app", "numero", "voicemail", "encerrar"].includes(r.destino) ? r.destino : "app";
  const para = e164(r.encaminhar_para);
  if (destino === "numero" && (!permissoes.encaminhamento || !para)) destino = "app";
  return {
    greeting: msgs(r.greeting), away: msgs(r.away),
    horario: { ativo: h.ativo === true, tz: FUSOS.includes(h.tz) ? h.tz : "America/New_York", dias },
    feriados, nao_perturbe: r.nao_perturbe === true, destino,
    encaminhar_para: destino === "numero" ? para : null,
    voicemail: r.voicemail !== false, gravar: permissoes.gravacao && r.gravar === true,
  };
}
function local(ms: number, tz: string) {
  const p: Any = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
/** o que acontece com uma chamada recebida agora: atender (no destino configurado) ou mensagem de ausência */
export function decidirChamada(r: Any, ms: number) {
  if (r.nao_perturbe) return { aberto: false, motivo: "nao_perturbe", acao: r.voicemail ? "voicemail" : "encerrar" };
  if (r.horario?.ativo) {
    const l = local(ms, r.horario.tz);
    if ((r.feriados || []).some((f: Any) => f.data === l.data)) return { aberto: false, motivo: "feriado", acao: r.voicemail ? "voicemail" : "encerrar" };
    const faixas = r.horario.dias?.[l.dow] || [];
    if (!faixas.some((f: string[]) => l.hora >= f[0] && l.hora < f[1])) return { aberto: false, motivo: "fora_do_horario", acao: r.voicemail ? "voicemail" : "encerrar" };
  }
  return { aberto: true, motivo: "", acao: r.destino === "encerrar" ? "encerrar" : r.destino === "voicemail" ? "voicemail" : r.destino === "numero" ? "encaminhar" : "app" };
}

/* ---------------- custos ----------------
 * Encaminhar soma DUAS pernas: a entrada no nosso número (local ou toll-free) e a saída para o destino.
 * Sem tarifa conferida para uma perna, não há estimativa (e o encaminhamento não pode ser aceito). */
export function tarifa(rates: Any[], item: string) {
  const r = rates.filter((x) => x.item === item).sort((a, b) => String(b.verificado_em).localeCompare(String(a.verificado_em)))[0];
  return r ? { custo: Number(r.custo), verificado_em: r.verificado_em } : null;
}
export function estimarEncaminhamento(rates: Any[], tipoNumero: "local" | "tollfree", destino: string, margemPct: number) {
  const pais = paisDe(destino);
  const entrada = tarifa(rates, tipoNumero === "tollfree" ? "voz_entrada_tollfree" : "voz_entrada_local");
  const saida = tarifa(rates, "voz_saida_" + pais);
  if (!entrada || !saida) return { ok: false, pais, falta: [!entrada ? "entrada " + tipoNumero : "", !saida ? "saída para " + pais : ""].filter(Boolean) };
  const custo = entrada.custo + saida.custo;
  const preco = Math.round(custo * (1 + margemPct / 100) * 10000) / 10000;
  return { ok: true, pais, custo_minuto: custo, preco_minuto: preco, entrada: entrada.custo, saida: saida.custo, verificado_em: [entrada.verificado_em, saida.verificado_em].sort()[0] };
}
/** consumo do mês contra a franquia; alertas de 80% e 100% e limite de gasto */
export function situacaoConsumo(uso: Any, plano: Any, limiteCents: number | null, alertas = [80, 100]) {
  const min = Number(uso?.minutos_entrada || 0) + Number(uso?.minutos_saida || 0), sms = Number(uso?.sms_entrada || 0) + Number(uso?.sms_saida || 0);
  const pmin = plano?.minutos ? Math.round((min / plano.minutos) * 100) : 0, psms = plano?.sms ? Math.round((sms / plano.sms) * 100) : 0;
  const pior = Math.max(pmin, psms);
  const gastoExtra = Math.round(Number(uso?.preco || 0) * 100);
  return {
    minutos: min, sms, pct_minutos: pmin, pct_sms: psms,
    alerta: [...alertas].sort((a, b) => b - a).find((a) => pior >= a) || 0,
    bloqueado: limiteCents != null && limiteCents > 0 && gastoExtra >= limiteCents,
    estimado: uso?.estimado !== false,
  };
}

/* ---------------- SMS: STOP / HELP e consentimento ---------------- */
const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|parar|sair|cancelar)\s*[.!]?\s*$/i;
const START = /^\s*(start|unstop|yes|voltar)\s*[.!]?\s*$/i;
const HELP = /^\s*(help|info|ajuda)\s*[.!]?\s*$/i;
export function palavraChave(t: string): "stop" | "start" | "help" | "" {
  return STOP.test(t) ? "stop" : START.test(t) ? "start" : HELP.test(t) ? "help" : "";
}
/** pode mandar SMS para este número? (opt-out bloqueia; número toll-free/local precisa do registro aprovado fora do modo demonstração) */
export function podeEnviarSms(numero: Any, consentimento: Any, demo: boolean) {
  if (consentimento?.estado === "opt_out") return { ok: false, motivo: "A pessoa pediu para não receber SMS (STOP)." };
  if (!demo && numero.sms_registro !== "aprovado") return { ok: false, motivo: numero.tipo === "tollfree" ? "O número toll-free ainda não tem a verificação aprovada para SMS." : "O número ainda não tem o registro A2P 10DLC aprovado para SMS." };
  return { ok: true, motivo: "" };
}
export function partesSms(t: string) {
  const unicode = /[^\x00-\x7F]/.test(t);
  const n = t.length, um = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  return n <= um ? 1 : Math.ceil(n / multi);
}
