// My WhatsApp Manager · regras puras do servidor (testáveis sem banco e sem HUB).
// - Perfil do negócio, regras, fluxos e modelos de documentos de cada empresa (limparConfig, padraoConfig).
// - Proteções fixas, conferidas também em código (violaProtecao): nunca informar valores, nunca pedir documentos,
//   números de documentos ou dados bancários. Nenhuma regra da empresa desliga isso.
// - Entrada da IA (montarEntrada) e saída sempre no formato (normalizar).
import "./core.js";
// deno-lint-ignore no-explicit-any
type Any = any;
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWaCore;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const bloco = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f<>]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max);
export const limpo = (s: unknown, max = 2000) => C.limparSensivel(String(s ?? "")).texto.slice(0, max);
export const FERRAMENTAS = ["sugerir", "resumo", "lead", "proposta", "traduzir", "comando", "personalizar", "responder", "grupo", "conteudo_grupo", "lembrete"];
export const STATUS = ["sugerido", "aprovado", "enviado", "descartado", "escalado", "criado", "erro", "ignorado"];

/* ================================================================ proteções fixas ================================================================ */
export const PROTECOES = [
  "Nunca informar preços, valores, taxas ou descontos. Valores só na proposta oficial, enviada pela equipe.",
  "Nunca pedir documentos, fotos de documentos, números de documentos (SSN, ITIN, passaporte, CPF) ou dados bancários.",
  "Não receber documentos pelo WhatsApp: por compliance, a lista e o link seguro para enviar os arquivos vão por e-mail.",
  "Identificar-se como assistente virtual na primeira resposta automática de cada conversa.",
  "Nunca prometer aprovações, vistos, resultados ou prazos de governo ou de banco.",
  "As regras e os fluxos da empresa não podem mudar estas proteções.",
];
const RE_VALOR = /(?:US\$|R\$|\$|€|£)\s?\d|\d[\d.,]*\s?(?:k\s)?(?:d[oó]lares?|reais|dollars?|usd|brl|euros?|bucks)\b|\b(?:custa(?:m)?|price is|costs?|fee is|valor (?:é|de)|preço (?:é|de)|tarifa (?:é|de))\s+(?:de\s+|só\s+|apenas\s+|about\s+|around\s+|cerca de\s+|uns?\s+)?\d/i;
const RE_PEDIR = /\b(envie|enviem|mande|mandem|manda|me (?:envia|manda|passa)|pode(?:ria)? (?:me )?(?:enviar|mandar|passar)|preciso (?:d[aeo]s?|que (?:você )?(?:me )?(?:envie|mande))|send (?:me|us)|please send|could you send|can you send|share (?:your|the)|upload|anexe|attach|tire uma foto|take a (?:photo|picture)|qual (?:é )?o (?:seu )?n[uú]mero d[aeo]|what(?:'s| is) your)\b[^.!?\n]{0,60}?\b(passaporte|passport|ssn|itin|social security|cpf|rg\b|cnh|carteira de motorista|driver'?s licen[cs]e|extrato|bank statement|comprovante|n[uú]mero da conta|account number|routing|ag[eê]ncia|cart[aã]o de cr[eé]dito|credit card|foto d[oe] (?:documento|passaporte)|green card|visto|visa)\b/i;
const NEGA = /\b(n[aã]o|nunca|jamais|don'?t|do not|never|nem)\b[^.!?\n]{0,25}$/i;
/** A mensagem que a IA vai enviar quebra uma proteção fixa? Devolve o motivo ou "". */
export function violaProtecao(texto: string): string {
  const t = String(texto || "");
  if (RE_VALOR.test(t)) return "Proteção: a resposta citava um valor. Valores só na proposta oficial.";
  const m = RE_PEDIR.exec(t);
  if (m && !NEGA.test(t.slice(Math.max(0, m.index - 40), m.index))) return "Proteção: a resposta pedia documento ou dado bancário.";
  return "";
}

/** O aviso da primeira resposta automática sempre diz que é assistente virtual (o nome do assistente pode ser personalizado). */
export function avisoComIA(texto: string, idioma = "pt-BR") {
  const t = String(texto || "").trim();
  if (/assistente virtual|virtual assistant|asistente virtual|intelig[eê]ncia artificial|artificial intelligence|\bIA\b|\bAI\b|\bbot\b|chatbot/i.test(t)) return t;
  const sufixo = idioma.startsWith("en") ? "virtual assistant" : idioma.startsWith("es") ? "asistente virtual" : "assistente virtual";
  return (t ? t.replace(/[.!\s]+$/, "") + ", " : "") + sufixo + ".";
}

/* ================================================================ perfil, regras, fluxos e modelos ================================================================ */
export const PASSOS = ["mensagem", "coletar", "crm_documentos", "crm_proposta", "agendar", "avisar_equipe"];
export const CAMPOS = ["nome", "email", "telefone", "tipo_caso"];
export const ACOES_REGRA = ["responder", "escalar", "fluxo"];
const id = (v: unknown, pad: string) => { const s = String(v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32); return s || pad; };
const unico = (lista: Any[]) => { const vistos = new Set<string>(); return lista.map((x) => { let k = x.id, n = 1; while (vistos.has(k)) k = x.id + "-" + n++; vistos.add(k); return { ...x, id: k }; }); };

export function limparConfig(c: Any) {
  c = c && typeof c === "object" ? c : {};
  const p = c.perfil || {};
  const perfil = { servicos: bloco(p.servicos, 2000), publico: bloco(p.publico, 600), tom: bloco(p.tom, 300), evitar: bloco(p.evitar, 1000) };
  const modelos = unico((Array.isArray(c.modelos) ? c.modelos : []).slice(0, 20).map((m: Any, i: number) => ({
    id: id(m?.id, "modelo" + (i + 1)), nome: txt(m?.nome, 80),
    documentos: (Array.isArray(m?.documentos) ? m.documentos : []).map((d: unknown) => txt(d, 160)).filter(Boolean).slice(0, 40),
    subpastas: (Array.isArray(m?.subpastas) ? m.subpastas : []).map((d: unknown) => txt(d, 60).replace(/[\\/:*?"|]/g, "-")).filter(Boolean).slice(0, 30),
  })).filter((m: Any) => m.nome));
  // a pasta de entrada é sempre a Initial Docs
  modelos.forEach((m: Any) => { if (!m.subpastas.some((s: string) => s.toLowerCase() === "initial docs")) m.subpastas.unshift("Initial Docs"); });
  const fluxos = unico((Array.isArray(c.fluxos) ? c.fluxos : []).slice(0, 20).map((f: Any, i: number) => ({
    id: id(f?.id, "fluxo" + (i + 1)), nome: txt(f?.nome, 80), gatilho: bloco(f?.gatilho, 400), ativo: f?.ativo !== false, padrao: f?.padrao === true,
    passos: (Array.isArray(f?.passos) ? f.passos : []).slice(0, 10).map((s: Any) => ({
      tipo: PASSOS.includes(s?.tipo) ? s.tipo : "mensagem", texto: bloco(s?.texto, 600),
      ...(s?.tipo === "coletar" ? { campos: (Array.isArray(s?.campos) ? s.campos : ["nome", "email"]).filter((x: string) => CAMPOS.includes(x)) } : {}),
    })).filter((s: Any) => s.texto || s.tipo !== "mensagem"),
  })).filter((f: Any) => f.nome && f.gatilho));
  const idsFluxo = new Set(fluxos.map((f: Any) => f.id));
  const regras = unico((Array.isArray(c.regras) ? c.regras : []).slice(0, 40).map((r: Any, i: number) => {
    let acao = ACOES_REGRA.includes(r?.acao) ? r.acao : "responder";
    const fluxo = acao === "fluxo" && idsFluxo.has(String(r?.fluxo)) ? String(r.fluxo) : "";
    if (acao === "fluxo" && !fluxo) acao = "responder";
    return { id: id(r?.id, "regra" + (i + 1)), nome: txt(r?.nome, 80), quando: bloco(r?.quando, 400), fazer: bloco(r?.fazer, 800), acao, fluxo, ativa: r?.ativa !== false };
  }).filter((r: Any) => r.nome && r.quando));
  return { perfil, regras, fluxos, modelos, grupos: limparGrupos(c.grupos), auto: limparAuto(c.auto) };
}

/* ---------------- grupos: o que a IA faz em cada grupo ----------------
 * modo: desligado (nada) | aprovar (sugere, você aprova) | auto (responde sozinha, com limite por dia)
 * interesse: avisa quando alguém mostra interesse e sugere a mensagem para o privado
 * conteudo: sugere uma dica para postar (por_semana: 1 ou 2), sempre com a sua aprovação */
export const GRUPO_PADRAO = { modo: "aprovar", limite_dia: 3, interesse: true, conteudo: true, por_semana: 1 };
const MODOS_GRUPO = ["desligado", "aprovar", "auto"];
export function limparGrupos(g: Any) {
  const o: Any = {};
  if (!g || typeof g !== "object" || Array.isArray(g)) return o;
  for (const [k, v] of Object.entries(g).slice(0, 200)) {
    const chave = txt(k, 120); const x: Any = v && typeof v === "object" ? v : {};
    if (!chave) continue;
    const lim = Math.round(Number(x.limite_dia));
    o[chave] = { nome: txt(x.nome, 120), modo: MODOS_GRUPO.includes(x.modo) ? x.modo : GRUPO_PADRAO.modo,
      limite_dia: Number.isFinite(lim) ? Math.max(1, Math.min(10, lim)) : GRUPO_PADRAO.limite_dia,
      interesse: x.interesse !== false, conteudo: x.conteudo !== false, por_semana: Number(x.por_semana) === 2 ? 2 : 1, lembrete: x.lembrete === true };
  }
  return o;
}
export function grupoCfg(cfg: Any, chave: string) {
  const g = cfg?.grupos?.[chave];
  return { ...GRUPO_PADRAO, ...(g || {}) };
}
/** dica do grupo vencida? (1 por semana = a cada 7 dias; 2 por semana = a cada 3,5 dias) */
export function conteudoDevido(g: Any, ultimoEnvio: number, agora = Date.now()) {
  if (!g.conteudo || g.modo === "desligado") return false;
  return !ultimoEnvio || agora - ultimoEnvio >= (7 / (g.por_semana || 1)) * 86400_000;
}

/* ---------------- mensagens automáticas (lembrete de serviços nos grupos) ----------------
 * Ajustes gerais em config.auto; cada grupo liga ou desliga em config.grupos[chave].lembrete.
 * Postado sem aprovação, no máximo 1 vez por semana por grupo, em horário sorteado dentro dos dias e horas permitidos.
 * O estado (próximo envio, parado) fica em wa_chats.auto, no servidor. */
export const INTERVALOS_AUTO = [7, 14, 30];
export const TIPOS_AUTO = ["lembrete", "dica", "alternar"];
export const AUTO_PADRAO = { ativo: false, tipo: "lembrete", intervalo_dias: 7, dias: [1, 2, 3, 4, 5], inicio: "10:00", fim: "17:00", tz: "America/New_York", temas: "", tom: "" };
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FUSOS = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo"];
export function limparAuto(a: Any) {
  a = a && typeof a === "object" ? a : {};
  const dias = (Array.isArray(a.dias) ? a.dias : AUTO_PADRAO.dias).map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);
  let inicio = HORA.test(String(a.inicio)) ? String(a.inicio) : AUTO_PADRAO.inicio, fim = HORA.test(String(a.fim)) ? String(a.fim) : AUTO_PADRAO.fim;
  if (fim <= inicio) { inicio = AUTO_PADRAO.inicio; fim = AUTO_PADRAO.fim; }
  return { ativo: a.ativo === true, tipo: TIPOS_AUTO.includes(a.tipo) ? a.tipo : "lembrete", intervalo_dias: INTERVALOS_AUTO.includes(Number(a.intervalo_dias)) ? Number(a.intervalo_dias) : 7,
    dias: [...new Set(dias)].sort() as number[], inicio, fim, tz: FUSOS.includes(a.tz) ? a.tz : AUTO_PADRAO.tz, temas: bloco(a.temas, 600), tom: txt(a.tom, 200) };
}
/** diferença (min) entre o horário local do fuso e o UTC no instante ms */
function offsetMin(tz: string, ms: number) {
  const p: Any = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000;
}
function localDia(ms: number, tz: string) {
  const p: Any = {};
  new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
function utcDe(y: number, m: number, d: number, hhmm: string, tz: string) {
  const [h, mi] = hhmm.split(":").map(Number);
  let t = Date.UTC(y, m - 1, d, h, mi);
  t -= offsetMin(tz, t) * 60000;
  return Date.UTC(y, m - 1, d, h, mi) - offsetMin(tz, t) * 60000; // segunda passada acerta a virada do horário de verão
}
/** o instante ms está dentro dos dias e das horas permitidos? */
export function dentroJanela(a: Any, ms: number) {
  const x = localDia(ms, a.tz);
  if (!a.dias.includes(x.dow)) return false;
  return ms >= utcDe(x.y, x.m, x.d, a.inicio, a.tz) && ms < utcDe(x.y, x.m, x.d, a.fim, a.tz);
}
/** próximo envio: o primeiro dia permitido a partir de "desde", num horário sorteado dentro da janela */
export function proximoHorario(a: Any, desde: number, sorte = Math.random) {
  if (!a.dias.length) return 0;
  for (let i = 0; i < 70; i++) {
    const x = localDia(desde + i * 86400_000, a.tz);
    if (!a.dias.includes(x.dow)) continue;
    const ini = utcDe(x.y, x.m, x.d, a.inicio, a.tz), fim = utcDe(x.y, x.m, x.d, a.fim, a.tz);
    const lo = Math.max(ini, desde + 5 * 60_000);
    if (lo >= fim - 60_000) continue;
    return Math.round(lo + sorte() * (fim - 60_000 - lo));
  }
  return 0;
}
/** depois de postar: o próximo fica a "intervalo_dias" do último envio (nunca menos de 7 dias) */
export function proximoDepoisDoEnvio(a: Any, enviadoEm: number, sorte = Math.random) {
  return proximoHorario(a, enviadoEm + Math.max(7, a.intervalo_dias) * 86400_000 - 12 * 3600_000, sorte);
}
/** tipo do próximo post: "dica" ou "lembrete". Em "alternar", a maioria é dica: o lembrete de serviços entra a cada 3 posts
 *  (depois de 2 dicas seguidas). ultimos = tipos já postados no grupo, do mais recente para o mais antigo. */
export function tipoDoPost(a: Any, ultimos: string[]) {
  if (a.tipo === "dica" || a.tipo === "lembrete") return a.tipo;
  return ultimos.length >= 2 && ultimos[0] === "dica" && ultimos[1] === "dica" ? "lembrete" : "dica";
}
/** alguém reclamou de divulgação no grupo (mensagens dos outros depois da nossa última)? */
const RE_RECLAMA = /(propaganda|spam|divulga[çc](?:[aã]o|[õo]es)|an[uú]ncio|publicidade|merchan|jab[aá]|n[aã]o (?:é|e) (?:lugar|espa[çc]o) (?:para|pra)|par(?:e|em|a|ar) de (?:mandar|postar|divulgar|anunciar)|chega de|proibid[oa]s? (?:postar|divulgar|propaganda)|regras? do grupo|vou (?:te )?remover|ser[aá] removid|stop (?:posting|spamming|advertising)|no (?:ads|spam|promo(?:tion)?s?)\b|not the place for)/i;
export function reclamacao(mensagens: Any[]) {
  let ultEu = -1;
  mensagens.forEach((m: Any, i: number) => { if (m.eu) ultEu = i; });
  const depois = mensagens.slice(ultEu + 1).filter((m: Any) => !m.eu && m.texto);
  const x = depois.find((m: Any) => RE_RECLAMA.test(m.texto) && (m.cita_eu || ultEu >= 0 || /\b(propaganda|spam|divulga|an[uú]ncio|publicidade|ads|promo)/i.test(m.texto)));
  return x ? `${txt(x.autor, 60) || "Alguém"} reclamou de divulgação no grupo` : "";
}
const palavras = (t: string) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3));
/** texto novo parecido demais com um já postado? (semelhança de palavras > 55%) */
export function parecido(novo: string, anteriores: string[]) {
  const a = palavras(novo);
  if (!a.size) return false;
  return anteriores.some((t) => { const b = palavras(t); if (!b.size) return false; let c = 0; a.forEach((w) => { if (b.has(w)) c++; }); return c / (a.size + b.size - c) > 0.55; });
}

/** Configuração inicial: o fluxo de documentos (compliance → CRM) e o de preço/caso específico já vêm prontos. */
export function padraoConfig(endeavor: boolean) {
  return limparConfig({
    perfil: endeavor ? {
      servicos: "Abertura de empresas nos EUA (LLC e corporação), Operating Agreement, EIN, bookkeeping e contabilidade, orientação para conta bancária empresarial, marketing, sites e projetos de IA.",
      publico: "Empreendedores brasileiros e latino-americanos que querem abrir ou administrar empresa nos EUA.",
      tom: "Cordial, objetivo e em português (ou no idioma do contato).",
      evitar: "Aconselhamento jurídico ou tributário individual; promessas de visto ou de aprovação de banco.",
    } : {},
    modelos: endeavor ? [
      { id: "abertura-llc", nome: "Abertura de empresa (LLC)", documentos: ["Passaporte de cada sócio", "Comprovante de endereço de cada sócio", "Visto americano (se houver)", "Nome desejado para a empresa (3 opções)", "Atividade da empresa"], subpastas: ["Initial Docs", "Formation", "EIN", "Operating Agreement", "Bank"] },
      { id: "bookkeeping", nome: "Bookkeeping e contabilidade", documentos: ["Certificado de formação da empresa", "Carta do EIN", "Extratos bancários dos últimos 3 meses"], subpastas: ["Initial Docs", "Statements", "Reports", "Tax"] },
    ] : [{ id: "padrao", nome: "Atendimento padrão", documentos: ["Documento de identificação", "Comprovante de endereço"], subpastas: ["Initial Docs", "Em análise", "Aprovados"] }],
    fluxos: [
      { id: "documentos", nome: "Pedido de documentos", padrao: true,
        gatilho: "A pessoa pede a lista de documentos, quer enviar documentos ou manda um documento pelo WhatsApp.",
        passos: [
          { tipo: "mensagem", texto: "Explique que, por compliance, não recebemos documentos pelo WhatsApp e que vamos mandar por e-mail a lista de documentos e um link seguro para enviar os arquivos." },
          { tipo: "coletar", campos: ["nome", "email", "tipo_caso"], texto: "Peça o nome completo e o e-mail. O telefone já é o do WhatsApp. Identifique o tipo de caso entre os modelos de documentos." },
          { tipo: "crm_documentos", texto: "Passe para o CRM: ele cria a pasta pelo modelo, gera o link da pasta Initial Docs e manda o e-mail com a lista." },
          { tipo: "mensagem", texto: "Confirme que o e-mail com a lista e o link vai chegar e peça para não enviar documentos pelo WhatsApp." },
        ] },
      { id: "proposta", nome: "Preço ou caso específico", padrao: true,
        gatilho: "A pessoa pergunta preço, valores, quanto custa, ou descreve um caso específico que precisa de análise.",
        passos: [
          { tipo: "mensagem", texto: "Diga que os valores dependem do caso e vão na proposta por e-mail, e ofereça também marcar uma conversa." },
          { tipo: "coletar", campos: ["nome", "email"], texto: "Peça o nome completo e o e-mail para enviar a proposta." },
          { tipo: "crm_proposta", texto: "Passe para o CRM pedir a proposta à equipe." },
          { tipo: "agendar", texto: "Ofereça os horários livres ou o link de agendamento." },
        ] },
    ],
    regras: [
      { id: "preco", nome: "Preço", quando: "Perguntarem preço, valores ou quanto custa.", fazer: "Não informe valores. Siga o fluxo de proposta.", acao: "fluxo", fluxo: "proposta" },
      { id: "documentos", nome: "Documentos", quando: "Pedirem a lista de documentos ou quiserem mandar documentos.", fazer: "Siga o fluxo de pedido de documentos.", acao: "fluxo", fluxo: "documentos" },
      { id: "pessoa", nome: "Falar com uma pessoa", quando: "Reclamação, urgência ou pedido para falar com alguém da equipe.", fazer: "Não responda sozinho: avise a equipe.", acao: "escalar" },
    ],
  });
}

/** Texto das regras, dos fluxos e dos modelos para a IA (só os ativos). */
export function configParaIA(cfg: Any) {
  const regras = cfg.regras.filter((r: Any) => r.ativa).map((r: Any) =>
    `- [${r.id}] ${r.nome}. Quando: ${r.quando} Fazer: ${r.fazer || "-"} (ação: ${r.acao === "fluxo" ? "fluxo " + r.fluxo : r.acao})`).join("\n");
  const fluxos = cfg.fluxos.filter((f: Any) => f.ativo).map((f: Any) =>
    `- [${f.id}] ${f.nome}. Gatilho: ${f.gatilho}\n` + f.passos.map((s: Any, i: number) => `  ${i + 1}) ${s.tipo}${s.campos ? " (" + s.campos.join(", ") + ")" : ""}: ${s.texto}`).join("\n")).join("\n");
  const modelos = cfg.modelos.map((m: Any) => `- [${m.id}] ${m.nome}`).join("\n");
  const p = cfg.perfil;
  const perfil = [p.servicos && "Serviços: " + p.servicos, p.publico && "Público: " + p.publico, p.tom && "Tom: " + p.tom, p.evitar && "Evitar: " + p.evitar].filter(Boolean).join("\n");
  return { regras, fluxos, modelos, perfil };
}

/* ================================================================ entrada e saída da IA ================================================================ */
export function montarEntrada(f: string, a: Any, c: { nome: string; grupo: boolean }, mensagens: Any[], extra: Any) {
  const partes = [`<modo>${f}</modo>`, `<empresa>${txt(extra.empresa || "Endeavor Business Solutions", 120)}</empresa>`, `<idioma>${a.idioma}</idioma>`, `<negocio>${a.negocio}</negocio>`, `<link_agenda>${a.link_agenda}</link_agenda>`,
    `<conversa_tipo>${c.grupo ? "grupo" : "individual"}</conversa_tipo>`, `<contato>${txt(c.nome, 80)}</contato>`];
  if (extra.cfg) {
    const k = configParaIA(extra.cfg);
    if (k.perfil) partes.push(`<perfil>\n${k.perfil}\n</perfil>`);
    if (["responder", "sugerir", "comando", "grupo", "proposta"].includes(f)) {
      if (k.regras) partes.push(`<regras_da_empresa>\n${k.regras}\n</regras_da_empresa>`);
      if (k.fluxos) partes.push(`<fluxos>\n${k.fluxos}\n</fluxos>`);
      if (k.modelos) partes.push(`<modelos_documentos>\n${k.modelos}\n</modelos_documentos>`);
    }
    partes.push(`<protecoes_fixas>\n${PROTECOES.map((x) => "- " + x).join("\n")}\n</protecoes_fixas>`);
  }
  if (extra.fluxo_atual) partes.push(`<fluxo_atual>${JSON.stringify(extra.fluxo_atual)}</fluxo_atual>`);
  if (extra.telefone) partes.push(`<telefone_contato>${extra.telefone}</telefone_contato>`);
  if (extra.horarios?.length) partes.push(`<horarios>${extra.horarios.join(" | ")}</horarios>`);
  if (extra.aviso) partes.push(`<aviso_ia>${extra.aviso}</aviso_ia>`);
  if (extra.pedido) partes.push(`<pedido_do_usuario>${limpo(extra.pedido, 1500)}</pedido_do_usuario>`);
  if (extra.idioma_destino) partes.push(`<idioma_destino>${extra.idioma_destino}</idioma_destino>`);
  if (extra.base) partes.push(`<base>${limpo(extra.base, 1500)}</base>`);
  if (extra.texto) partes.push(`<texto>${limpo(extra.texto, 3000)}</texto>`);
  if (extra.existentes) partes.push(`<existentes>${limpo(extra.existentes, 3000)}</existentes>`);
  if (extra.continuacao) partes.push(`<continuacao>${JSON.stringify(extra.continuacao)}</continuacao>`);
  if (extra.grupo_cfg) partes.push(`<grupo_ajustes>${JSON.stringify(extra.grupo_cfg)}</grupo_ajustes>`);
  if (extra.lembrete_ajustes) partes.push(`<lembrete_ajustes>${JSON.stringify(extra.lembrete_ajustes)}</lembrete_ajustes>`);
  if (extra.temas_recentes) partes.push(`<temas_recentes>${limpo(extra.temas_recentes, 1500)}</temas_recentes>`);
  if (mensagens.length || !["sugerir_regras", "sugerir_fluxos", "melhorar_texto", "conteudo_grupo"].includes(f)) partes.push(`<mensagens>\n${C.montarConversa(mensagens, f === "resumo" || f === "grupo" ? 60 : 30)}\n</mensagens>`);
  return partes.join("\n");
}
function fluxoDaIA(r: Any, cfg: Any) {
  const f = r?.fluxo;
  if (!f || typeof f !== "object" || !cfg) return null;
  const fl = cfg.fluxos.find((x: Any) => x.id === String(f.id) && x.ativo);
  if (!fl) return null;
  const d = f.dados && typeof f.dados === "object" ? f.dados : {};
  const modelo = cfg.modelos.find((m: Any) => m.id === String(d.tipo_caso) || m.nome.toLowerCase() === String(d.tipo_caso || "").toLowerCase());
  return { id: fl.id, dados: { nome: txt(d.nome, 120), email: EMAIL.test(String(d.email || "").trim()) ? txt(d.email, 160).toLowerCase() : "", telefone: txt(d.telefone, 40), tipo_caso: modelo ? modelo.id : "" }, pronto: f.pronto === true, reenviar: f.reenviar === true };
}
/** dados do contato que a pessoa passou na conversa (para o card do painel); só o que for válido */
export function contatoDaIA(c: Any) {
  if (!c || typeof c !== "object") return null;
  const nome = txt(c.nome, 120), email = EMAIL.test(String(c.email || "").trim()) ? txt(c.email, 160).toLowerCase() : "";
  const tel = String(c.telefone || "").replace(/[^\d+]/g, ""), telefone = /^\+?[1-9]\d{6,14}$/.test(tel) ? (tel.startsWith("+") ? tel : "+" + tel) : "";
  const o: Any = {};
  if (nome.length >= 2) o.nome = nome;
  if (email) o.email = email;
  if (telefone) o.telefone = telefone;
  return Object.keys(o).length ? o : null;
}
/** Resposta da IA sempre no formato esperado pela extensão (e sem números sensíveis). */
export function normalizar(f: string, r: Any, cfg?: Any): Any {
  const s = (v: unknown, max = 2000) => limpo(typeof v === "string" ? v : "", max).trim();
  const lista = (v: unknown, n: number, max = 600) => (Array.isArray(v) ? v : []).map((x) => s(x, max)).filter(Boolean).slice(0, n);
  switch (f) {
    case "sugerir": return { resposta: s(r?.resposta), alternativas: lista(r?.alternativas, 3) };
    case "resumo": return { resumo: s(r?.resumo, 3000), pendencias: lista(r?.pendencias, 8, 300), interesse: s(r?.interesse, 300), proximo_passo: s(r?.proximo_passo, 300) };
    case "lead": return { nome: s(r?.nome, 120), email: EMAIL.test(String(r?.email || "")) ? s(r?.email, 160) : "", telefone: s(r?.telefone, 40), assunto: s(r?.assunto, 200), resumo: s(r?.resumo, 600) };
    case "proposta": return { mensagem: s(r?.mensagem), itens: lista(r?.itens, 10, 120) };
    case "traduzir": return { traducao: s(r?.traducao, 3000), idioma_origem: s(r?.idioma_origem, 10) };
    case "comando": {
      const acoes = ["escrever", "resumo", "lead", "proposta", "traduzir", "agendar", "nada"];
      return { acao: acoes.includes(r?.acao) ? r.acao : "escrever", texto: s(r?.texto) };
    }
    case "personalizar": return { texto: s(r?.texto) };
    case "responder": {
      const escalar = r?.escalar === true; const texto = s(r?.texto);
      return { responder: !escalar && r?.responder === true && !!texto, texto, escalar, motivo: s(r?.motivo, 200), regra: txt(r?.regra, 32), fluxo: fluxoDaIA(r, cfg), contato: contatoDaIA(r?.contato) };
    }
    case "grupo": return { topicos: (Array.isArray(r?.topicos) ? r.topicos : []).slice(0, 8).map((t: Any) => ({ assunto: s(t?.assunto, 120), resumo: s(t?.resumo, 300) })).filter((t: Any) => t.assunto),
      relevante: r?.relevante === true, responder: r?.relevante === true && r?.responder === true && !!s(r?.texto), texto: s(r?.texto), motivo: s(r?.motivo, 200),
      interesse: (Array.isArray(r?.interesse) ? r.interesse : []).slice(0, 3).map((x: Any) => ({ autor: s(x?.autor, 80), motivo: s(x?.motivo, 200), mensagem: s(x?.mensagem, 800) })).filter((x: Any) => x.autor && x.mensagem) };
    case "conteudo_grupo": return { texto: s(r?.texto, 1200), tema: s(r?.tema, 120) };
    case "lembrete": { const rec = r?.reclamacao === true; return { texto: rec ? "" : s(r?.texto, 900), tema: s(r?.tema, 120), reclamacao: rec, motivo: s(r?.motivo, 200) }; }
    case "sugerir_regras": return { regras: limparConfig({ regras: (Array.isArray(r?.regras) ? r.regras : []).map((x: Any) => ({ ...x, acao: x?.acao === "fluxo" ? "responder" : x?.acao })), fluxos: [] }).regras.slice(0, 8) };
    case "sugerir_fluxos": return { fluxos: limparConfig({ fluxos: r?.fluxos }).fluxos.slice(0, 5) };
    case "melhorar_texto": return { texto: s(r?.texto, 800) };
  }
  return {};
}

/** O fluxo pode ir para o CRM? (dados obrigatórios do passo "coletar" válidos) */
export function prontoParaCRM(fluxo: Any, dados: Any) {
  const coletar = fluxo.passos.find((p: Any) => p.tipo === "coletar");
  const campos: string[] = coletar?.campos || ["nome", "email"];
  const falta = campos.filter((c) => c !== "telefone" && c !== "tipo_caso" && !(c === "email" ? EMAIL.test(dados.email || "") : String(dados[c] || "").trim().length >= 2));
  const passoCRM = fluxo.passos.find((p: Any) => p.tipo === "crm_documentos" || p.tipo === "crm_proposta");
  return { ok: !falta.length && !!passoCRM, falta, tipo: passoCRM ? (passoCRM.tipo === "crm_documentos" ? "documentos" : "proposta") : "" };
}
