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
export const FERRAMENTAS = ["sugerir", "resumo", "lead", "proposta", "traduzir", "comando", "personalizar", "responder", "grupo"];
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
  return { perfil, regras, fluxos, modelos };
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
  if (mensagens.length || !["sugerir_regras", "sugerir_fluxos", "melhorar_texto"].includes(f)) partes.push(`<mensagens>\n${C.montarConversa(mensagens, f === "resumo" || f === "grupo" ? 60 : 30)}\n</mensagens>`);
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
      relevante: r?.relevante === true, responder: r?.relevante === true && r?.responder === true && !!s(r?.texto), texto: s(r?.texto), motivo: s(r?.motivo, 200) };
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
