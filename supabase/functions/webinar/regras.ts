// Live Webinar: regras puras do servidor (configurações, perguntas frequentes revisadas, relatório de audiência).
import "./core.js";
// deno-lint-ignore no-explicit-any
type Any = any;
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWebinarCore;
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/* ---------------- configurações ---------------- */
export function limparSettings(s: Any) {
  s = s && typeof s === "object" ? s : {};
  const n = (v: unknown, a: number, b: number, d: number) => { const x = Math.round(Number(v)); return isFinite(x) ? Math.min(Math.max(x, a), b) : d; };
  return {
    contador_minimo: n(s.contador_minimo, 0, 100000, 20),
    chat_ia: s.chat_ia !== false,
    ia_pausada: s.ia_pausada === true,
    faq: s.faq !== false,
    boas_vindas: s.boas_vindas !== false,
    cta_final: s.cta_final !== false,
    convites: (Array.isArray(s.convites) ? s.convites : []).map((x: unknown) => n(x, 0, 29, 0)).filter((x: number, i: number, a: number[]) => a.indexOf(x) === i).slice(0, 10),
    agendamento: ["calendario", "link", "nenhum"].includes(s.agendamento) ? s.agendamento : "calendario",
    texto_boas_vindas: txt(s.texto_boas_vindas, 300),
    texto_convite: txt(s.texto_convite, 300),
    texto_cta: txt(s.texto_cta, 300),
    chat_abre_min: n(s.chat_abre_min, 0, 120, 15),
    retencao_dias: n(s.retencao_dias, 30, 365, 90),
    idioma: ["pt-BR", "en-US", "es-ES"].includes(s.idioma) ? s.idioma : "pt-BR",
    legendas: s.legendas !== false,
    voz_teste: s.voz_teste === true,
  };
}
export function limparFaq(f: unknown, nSlides: number) {
  return (Array.isArray(f) ? f : []).slice(0, 12).map((x: Any) => ({ slide: Math.min(Math.max(Math.round(Number(x?.slide) || 0), 0), Math.max(nSlides - 1, 0)),
    pergunta: txt(x?.pergunta, 200), resposta: txt(x?.resposta, 700), aprovada: x?.aprovada !== false })).filter((x) => x.pergunta && x.resposta);
}
export function calcularRelatorio(linha: Any[], att: Any[], nRegs: number) {
  const total = C.total(linha);
  // por pessoa: soma o tempo das janelas e guarda o trecho mais longe que viu
  const pessoas: Record<string, { s: number; ini: number; fim: number; first: number; last: number }> = {};
  for (const a of att) {
    const p = pessoas[a.registration_id] ||= { s: 0, ini: Infinity, fim: 0, first: Infinity, last: 0 };
    p.s += a.seconds || 0; p.ini = Math.min(p.ini, a.first_pos_ms || 0); p.fim = Math.max(p.fim, a.last_pos_ms || 0);
    p.first = Math.min(p.first, Date.parse(a.first_seen)); p.last = Math.max(p.last, Date.parse(a.last_seen));
  }
  const lista = Object.values(pessoas), n = lista.length;
  // pico de pessoas ao mesmo tempo (varredura das janelas)
  const ev: [number, number][] = [];
  for (const a of att) { ev.push([Date.parse(a.first_seen), 1], [Date.parse(a.last_seen) + 1, -1]); }
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let cur = 0, pico = 0; for (const [, d] of ev) { cur += d; pico = Math.max(pico, cur); }
  // retenção: % das pessoas presentes no início de cada slide (entre a primeira e a última posição vista)
  const retencao = linha.map((s: Any) => ({ slide: s.i, ini_ms: s.ini, pct: n ? Math.round(100 * lista.filter((p) => p.ini <= s.ini + 1000 && p.fim >= s.ini).length / n) : 0 }));
  const saidas = linha.map((s: Any) => ({ slide: s.i, n: lista.filter((p) => p.fim < total - 5000 && p.fim >= s.ini && p.fim < s.ini + s.dur).length }));
  const segs = lista.map((p) => p.s).sort((a, b) => a - b);
  return { inscritos: nRegs, participantes: n, comparecimento_pct: nRegs ? Math.round(100 * n / nRegs) : 0, pico_simultaneo: pico,
    media_min: n ? Math.round(segs.reduce((a, b) => a + b, 0) / n / 6) / 10 : 0, mediana_min: n ? Math.round(segs[Math.floor(n / 2)] / 6) / 10 : 0,
    ficaram_ate_o_fim: lista.filter((p) => p.fim >= total - 5000).length, sairam_antes: lista.filter((p) => p.fim < total - 5000).length, retencao, saidas };
}
