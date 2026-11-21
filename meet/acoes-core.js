/*
 * Web Meeting (Endeavor): núcleo do painel de ações da reunião.
 *
 * Um único arquivo, usado na sala (navegador) e no servidor (função meet, Deno):
 *   - lê a transcrição e o chat e encontra pedidos, compromissos, decisões, responsáveis, prazos,
 *     e-mails, serviços e valores (só o que foi dito; nada é inventado);
 *   - entende comandos ("IA, prepara a proposta", "envia a ata") por voz ou pelo chat;
 *   - monta ações (proposta, cobrança, contrato, documentos, reunião, remarcar, tarefa, CRM, ata, e-mail),
 *     diz o que falta e decide se pode executar;
 *   - executa com integrações recebidas de fora (servidor = reais; demonstração e testes = simuladas),
 *     sem repetir envios (chave de idempotência).
 *
 * Regra de ouro: só executa com comando explícito de quem pode (anfitrião; cobrança, contrato e proposta
 * pedem também permissão do admin da Endeavor), com dados completos, destinatários confirmados e a integração
 * conectada. Se faltar algo, a ação fica como rascunho e mostra o que falta.
 */
(function (raiz) {
  "use strict";

  /* ---------------- texto ---------------- */
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const limpo = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max || 500);
  const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const emailsDe = t => [...new Set((String(t || "").match(RE_EMAIL) || []).map(e => e.toLowerCase().replace(/[.,;:]+$/, "")))];
  const emailValido = e => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(e || ""));
  let seq = 0;
  const novoId = p => (p || "a") + "-" + Date.now().toString(36) + "-" + (++seq).toString(36);

  /* ---------------- valores ---------------- */
  // "US$ 1.500", "$1,500.00", "R$ 2.000,00", "1500 dólares", "€ 300"
  const RE_VALOR = /(us\$|r\$|u\$s|\$|€|eur|usd|brl)\s?(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s?(mil|k))?|(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(mil\s)?(dolares|dolar|reais|real|euros|euro|usd|brl)\b/gi;
  function numero(txt) {
    let t = String(txt).replace(/\s/g, "");
    const virg = t.lastIndexOf(","), pto = t.lastIndexOf(".");
    if (virg > -1 && pto > -1) t = virg > pto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (virg > -1) t = /,\d{3}$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
    else if (pto > -1 && /\.\d{3}$/.test(t)) t = t.replace(/\./g, "");
    const n = Number(t);
    return isFinite(n) ? n : NaN;
  }
  const moedaDe = s => { s = norm(s); return /r\$|real|reais|brl/.test(s) ? "brl" : /€|eur/.test(s) ? "eur" : "usd"; };
  function valoresDe(texto) {
    const out = [], n = norm(texto);
    RE_VALOR.lastIndex = 0;
    let m;
    while ((m = RE_VALOR.exec(n))) {
      const bruto = m[2] || m[5], mil = m[4] || m[6];
      let v = numero(bruto); if (!isFinite(v) || v <= 0) continue;
      if (mil) v *= 1000;
      out.push({ valor_cents: Math.round(v * 100), moeda: moedaDe(m[1] || m[7] || ""), inicio: m.index, fim: m.index + m[0].length, trecho: m[0] });
    }
    return out;
  }
  function formatarValor(cents, moeda) {
    const loc = moeda === "brl" ? "pt-BR" : moeda === "eur" ? "de-DE" : "en-US";
    try { return new Intl.NumberFormat(loc, { style: "currency", currency: String(moeda || "usd").toUpperCase() }).format((cents || 0) / 100); }
    catch (e) { return (cents / 100).toFixed(2); }
  }

  /* ---------------- datas e horas (português; inglês básico) ---------------- */
  const DIAS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  /** Lê uma data e uma hora no texto, relativas a "agora". Devolve { data: "AAAA-MM-DD", hora: "HH:MM", trecho } ou null. */
  function dataDe(texto, agora) {
    const n = norm(texto), base = new Date(agora || Date.now());
    let d = null, trecho = "";
    let m;
    if ((m = n.match(/\bdepois de amanha\b/))) { d = new Date(base); d.setDate(d.getDate() + 2); trecho = m[0]; }
    else if ((m = n.match(/\b(amanha|tomorrow)\b/))) { d = new Date(base); d.setDate(d.getDate() + 1); trecho = m[0]; }
    else if ((m = n.match(/\b(hoje|today)\b/))) { d = new Date(base); trecho = m[0]; }
    else if ((m = n.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      let a = m[3] ? Number(m[3]) : base.getFullYear(); if (a < 100) a += 2000;
      d = new Date(a, Number(m[2]) - 1, Number(m[1])); if (!m[3] && d < startOfDay(base)) d.setFullYear(d.getFullYear() + 1); trecho = m[0];
    } else if ((m = n.match(/\b(?:dia\s)?(\d{1,2})\s(?:de\s)?(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/))) {
      d = new Date(base.getFullYear(), MESES[m[2]] - 1, Number(m[1])); if (d < startOfDay(base)) d.setFullYear(d.getFullYear() + 1); trecho = m[0];
    } else if ((m = n.match(/\b(?:(?:na|no|nesta|neste|proxima|proximo|next|on)\s)*(domingo|segunda|terca|quarta|quinta|sexta|sabado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:-feira| feira)?\b/))) {
      d = new Date(base); const alvo = DIAS[m[1]]; let k = (alvo - d.getDay() + 7) % 7; if (k === 0 || /proxim|next/.test(m[0])) k = k || 7; d.setDate(d.getDate() + k); trecho = m[0];
    } else if ((m = n.match(/\bdia (\d{1,2})\b/))) {
      d = new Date(base.getFullYear(), base.getMonth(), Number(m[1])); if (d < startOfDay(base)) d.setMonth(d.getMonth() + 1); trecho = m[0];
    }
    let hora = "";
    if ((m = n.match(/\b(?:as|a|at|para as)?\s?(\d{1,2})(?::(\d{2})|h(\d{2})?|\s?horas?)\b(?:\s?(da manha|da tarde|da noite|am|pm))?/))) {
      let h = Number(m[1]); const min = Number(m[2] || m[3] || 0); const p = m[4] || "";
      if (/tarde|noite|pm/.test(p) && h < 12) h += 12;
      if (h <= 23 && min <= 59) { hora = String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0"); trecho = (trecho + " " + m[0]).trim(); }
    } else if ((m = n.match(/\b(\d{1,2})\s?(da manha|da tarde|da noite|am|pm)\b/))) {
      let h = Number(m[1]); if (/tarde|noite|pm/.test(m[2]) && h < 12) h += 12;
      if (h <= 23) { hora = String(h).padStart(2, "0") + ":00"; trecho = (trecho + " " + m[0]).trim(); }
    }
    if (!d && !hora) return null;
    return { data: d ? ymd(d) : "", hora, trecho };
  }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  const dataLegivel = (data, hora) => {
    if (!data) return hora || "";
    const [a, m, d] = data.split("-").map(Number), dt = new Date(a, m - 1, d);
    const s = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(dt);
    return s + (hora ? " às " + hora : "");
  };

  /* ---------------- documentos (arquivos; nunca números) ---------------- */
  const DOCS = [
    ["passaporte", "Passaporte"], ["comprovante de endereco", "Comprovante de endereço"], ["comprovante de residencia", "Comprovante de endereço"],
    ["visto", "Visto"], ["contrato social", "Contrato social"], ["documento de identidade", "Documento de identidade"], ["identidade", "Documento de identidade"],
    ["\\brg\\b", "RG"], ["\\bcnh\\b", "CNH"], ["carteira de motorista", "Carteira de motorista"], ["drivers license", "Carteira de motorista"],
    ["procuracao", "Procuração"], ["\\blogo\\b", "Logo da empresa"], ["articles of organization", "Articles of Organization"],
    ["carta do ein", "Carta do EIN (CP 575)"], ["ein letter", "Carta do EIN (CP 575)"], ["operating agreement", "Operating Agreement"],
    ["declaracao de imposto", "Declaração de imposto"], ["imposto de renda", "Declaração de imposto"], ["contrato", "Contrato"], ["proposta assinada", "Proposta assinada"],
  ];
  // números que nunca pedimos por e-mail, chat ou link: só o arquivo, quando necessário
  const PROIBIDOS = /\b(ssn|itin|social security|numero do passaporte|numero da conta|conta bancaria|routing|agencia e conta|cartao de credito|senha)\b/;
  function documentosDe(texto) {
    const n = norm(texto), achados = [];
    for (const [k, rot] of DOCS) if (new RegExp(k).test(n) && !achados.includes(rot)) achados.push(rot);
    // "contrato" sozinho só conta se "contrato social" não foi achado
    if (achados.includes("Contrato social")) { const i = achados.indexOf("Contrato"); if (i > -1) achados.splice(i, 1); }
    return achados;
  }

  /* ---------------- leitura da conversa ---------------- */
  const RX = {
    decisao: /\b(decidimos|decidido|fechado|fechamos|combinado|ficou combinado|aprovado|aprovamos|vamos seguir com|vamos com|bate o martelo|esta decidido|we decided|agreed)\b/,
    compromisso: /\b(vou|eu vou|vamos|eu fico de|fico de|fica comigo|me comprometo|pode deixar que eu|deixa comigo|vai enviar|vai mandar|vai preparar|i will|i'll)\b/,
    pedido: /\b(pode(ria)? (me )?(enviar|mandar|passar|preparar|fazer)|preciso (de|que|do|da)|me (manda|envia|passa)|voce consegue|precisamos (de|do|da)|gostaria de receber|could you|please send)\b/,
    reuniao: /\b(marcar|agendar|marcamos|agendamos|schedule)\b.*\b(reuniao|call|conversa|encontro|meeting|follow.?up)\b|\b(reuniao|call|conversa|meeting)\b.*\b(marcad|agendad)/,
    remarcar: /\b(remarcar|remarca|reagendar|reagenda|mudar a reuniao|mudar a call|adiar a reuniao|transferir a reuniao|reschedule)\b/,
    servico: /\b(servico|plano|pacote|abertura|formacao|contabilidade|bookkeeping|registered agent|endereco virtual|consultoria|site|projeto|mensalidade|manutencao|imposto|tax|itin|ein|llc)\b/,
  };
  const PRAZO = /\b(ate|antes de|no maximo|by|until)\b\s([^.,;!?]{2,40})/;
  /** Nome de quem fica responsável: "o João vai", "a Maria fica de"; senão quem falou. */
  function responsavelDe(texto, falante, nomes) {
    const t = String(texto);
    for (const nm of nomes || []) {
      const p = String(nm).split(/\s+/)[0]; if (!p || p.length < 3) continue;
      if (new RegExp("\\b(o|a)?\\s?" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s(vai|fica|se compromete|pode|envia|manda|prepara)", "i").test(t)) return nm;
    }
    return falante || "";
  }
  /** Lê uma linha da conversa (frase por frase) e devolve os itens encontrados, sem inventar. */
  function analisarLinha(l, ctx) {
    ctx = ctx || {};
    const texto = limpo(l.texto, 2000), itens = [];
    emailsDe(texto).forEach(e => itens.push({ fonte: [l.id], falante: l.nome || "", texto, tipo: "email", email: e, nome: l.via === "chat" && !l.anfitriao ? (l.nome || "") : "", organizador: !!l.anfitriao }));
    const frases = texto.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const f of frases) itens.push(...analisarFrase(f, l, ctx));
    return itens;
  }
  function analisarFrase(texto, l, ctx) {
    const n = norm(texto), itens = [], quem = l.nome || "";
    const base = { fonte: [l.id], falante: quem, texto, anfitriao: !!l.anfitriao };
    const prazoM = n.match(PRAZO), prazoD = prazoM ? dataDe(prazoM[2], ctx.agora) : dataDe(texto, ctx.agora);
    const prazo = prazoD && prazoD.data ? prazoD.data : "";
    const ehDecisao = RX.decisao.test(n), ehPedido = RX.pedido.test(n), ehRemarcar = RX.remarcar.test(n), ehReuniao = !ehRemarcar && RX.reuniao.test(n);
    if (ehDecisao) itens.push({ ...base, tipo: "decisao", resumo: texto });
    if (RX.compromisso.test(n) && !ehPedido && !ehDecisao && !ehReuniao && !ehRemarcar) itens.push({ ...base, tipo: "compromisso", resumo: texto, responsavel: responsavelDe(texto, quem, ctx.nomes), prazo });
    const docs = documentosDe(texto);
    if (ehPedido && !docs.length) itens.push({ ...base, tipo: "pedido", resumo: texto, solicitante: quem, prazo });
    let ultimoFim = 0;
    for (const v of valoresDe(texto)) {
      let desc = texto.slice(ultimoFim, v.inicio);
      for (let k = 0; k < 4; k++) desc = desc.replace(/[\s,:=-]*\b(por|custa|custaria|fica em|fica|sai|sai por|de|no valor de|valor|seria|é|e|são|sao|vale|cobramos|cobra)\s*$/i, "").replace(/[\s,:=-]+$/, "");
      desc = desc.split(/[;:]|,\s/).pop().trim();
      for (let k = 0; k < 4; k++) desc = desc.replace(/^(e|mais|o|a|os|as|então|entao|também|tambem|aí|ai|já|ja|para|pra)\s+/i, "");
      const depois = norm(texto.slice(v.fim, v.fim + 18));
      ultimoFim = v.fim;
      if (desc.length < 3) continue;
      itens.push({ ...base, tipo: "servico", descricao: limpo(desc.charAt(0).toUpperCase() + desc.slice(1), 120), valor_cents: v.valor_cents, moeda: v.moeda, mensal: /\b(por mes|mensa|ao mes|\/mes|monthly|per month|a month)/.test(depois) });
    }
    if (docs.length && (ehPedido || /\b(enviar|mandar|anexar|subir|documento|documentos|solicitar|solicita|precisa|preciso|precisamos)\b/.test(n))) itens.push({ ...base, tipo: "documentos", itens: docs, proibido: PROIBIDOS.test(n) });
    if (ehRemarcar) { const q = dataDe(texto, ctx.agora); itens.push({ ...base, tipo: "remarcar", data: q ? q.data : "", hora: q ? q.hora : "" }); }
    else if (ehReuniao) { const q = dataDe(texto, ctx.agora); itens.push({ ...base, tipo: "reuniao", data: q ? q.data : "", hora: q ? q.hora : "" }); }
    return itens;
  }
  /* ---------------- comandos ---------------- */
  // "IA, ...", "Assistente, ...", "Endeavor, ..." por voz; no chat também "/proposta", "@ia ..."
  const PREFIXO = /^\s*(?:@?ia|@?assistente|endeavor|ok endeavor|hey endeavor)[\s,:!.-]+|^\s*\//i;
  function ehComando(texto) { return PREFIXO.test(String(texto || "")); }
  const VERBO_EXEC = /\b(envia|enviar|envie|manda|mandar|mande|dispara|executa|executar|execute|solicita|solicitar|solicite|pede|pedir|agenda|agendar|marca|marcar|remarca|remarcar|reagenda|reagendar|cria|criar|crie|registra|registrar|atualiza|atualizar|send|schedule|create)\b/;
  const VERBO_PREP = /\b(prepara|preparar|prepare|monta|montar|monte|gera|gerar|gere|rascunha|rascunhar|faz|fazer|faca|draft|prepare)\b/;
  /** Interpreta um comando. Devolve { intencao, tipo?, executar, alvo?, texto } ou null. */
  function interpretarComando(texto, ctx) {
    if (!ehComando(texto)) return null;
    const cru = String(texto).replace(PREFIXO, "").trim(), n = norm(cru);
    if (/\b(pausa|pausar|pare de acompanhar|para de acompanhar|pause)\b/.test(n)) return { intencao: "pausar", texto: cru };
    if (/\b(retoma|retomar|continua|continuar|volta a acompanhar|resume)\b/.test(n)) return { intencao: "retomar", texto: cru };
    const tipo =
      /\b(remarca|remarcar|reagenda|reagendar|adia|adiar|muda a reuniao|reschedule)\b/.test(n) ? "remarcar" :
      /\b(ata|minuta da reuniao|resumo da reuniao|minutes)\b/.test(n) ? "ata" :
      /\b(tarefa|tarefas|task|lembrete)\b/.test(n) ? "tarefa" :
      /\b(proposta|orcamento|proposal|quote)\b/.test(n) ? "proposta" :
      /\b(cobranca|fatura|invoice|boleto|cobrar)\b/.test(n) ? "cobranca" :
      /\b(contrato|assinatura|contract)\b/.test(n) ? "contrato" :
      /\b(documento|documentos|arquivos|upload|passaporte|comprovante)\b/.test(n) ? "documentos" :
      /\b(reuniao|call|meeting|agenda uma|marca uma|agendar|marcar)\b/.test(n) ? "reuniao" :
      /\b(crm|contato|lead)\b/.test(n) ? "crm" :
      /\b(e-?mail|mensagem)\b/.test(n) ? "email" : "";
    if (/\b(descarta|descartar|apaga|apagar|cancela a acao|discard)\b/.test(n)) return { intencao: "descartar", tipo, texto: cru };
    if (!tipo) return { intencao: "desconhecido", texto: cru };
    const executar = VERBO_EXEC.test(n) && !/\b(nao|don't|sem enviar)\b/.test(n);
    const preparar = VERBO_PREP.test(n) && !executar;
    const q = (tipo === "reuniao" || tipo === "remarcar" || tipo === "tarefa") ? dataDe(cru, ctx && ctx.agora) : null;
    const emails = emailsDe(cru);
    // "remarca para quinta às 14h" e "agenda reunião ..." são ordens de execução
    return { intencao: "acao", tipo, executar, preparar, data: q ? q.data : "", hora: q ? q.hora : "", emails, texto: cru };
  }

  /**
   * Destinatário citado num comando: e-mail escrito ("para carlos@acme.com") ou nome ("para o Carlos").
   * Devolve { emails: [...] } com 0, 1 ou vários (vários = ambíguo: o organizador escolhe).
   */
  function resolverDestinatario(texto, contatos) {
    const ditos = emailsDe(texto);
    if (ditos.length) return { emails: ditos, porNome: false };
    const n = " " + norm(texto) + " ", achados = [];
    for (const c of contatos || []) {
      if (c.organizador) continue;
      const partes = [norm(c.nome).split(/\s+/)[0], norm(c.email.split("@")[0]).split(/[._-]/)[0]].filter(p => p && p.length >= 3);
      if (partes.some(p => new RegExp("\\b" + p + "\\b").test(n))) achados.push(c.email);
    }
    return { emails: [...new Set(achados)], porNome: true };
  }

  /* ---------------- ações: dados obrigatórios ---------------- */
  const TIPOS = {
    proposta: { nome: "Proposta", envia: true, admin: true, conexao: "proposta" },
    cobranca: { nome: "Cobrança", envia: true, admin: true, conexao: "cobranca", aprovacao: true },
    contrato: { nome: "Contrato", envia: true, admin: true, conexao: "assinatura", aprovacao: true },
    documentos: { nome: "Pedido de documentos", envia: true, conexao: "documentos" },
    reuniao: { nome: "Agendar reunião", envia: true, conexao: "agenda" },
    remarcar: { nome: "Remarcar reunião", envia: true, conexao: "agenda" },
    tarefa: { nome: "Tarefa", conexao: "tarefas" },
    crm: { nome: "Atualizar CRM", conexao: "crm" },
    ata: { nome: "Ata da reunião", envia: true, conexao: "email" },
    email: { nome: "E-mail", envia: true, conexao: "email" },
  };
  const itensOk = it => Array.isArray(it) && it.length > 0 && it.every(i => limpo(i.descricao).length >= 2 && Number(i.valor_cents) >= 1);
  /** Lista do que falta para a ação poder ser executada (rótulos em português). */
  function faltando(acao, contatos) {
    const d = acao.dados || {}, f = [];
    const dest = () => {
      const lista = destinatariosDe(acao);
      if (!lista.length) f.push("destinatário (e-mail)");
      else {
        if (lista.some(e => !emailValido(e))) f.push("e-mail válido do destinatário");
        if (contatos && lista.some(e => !confirmado(contatos, e))) f.push("confirmar o destinatário");
      }
      if (Array.isArray(d.ambiguos) && d.ambiguos.length > 1 && !d.destinatario) f.push("escolher o destinatário entre " + d.ambiguos.join(", "));
    };
    switch (acao.tipo) {
      case "proposta":
        dest(); if (!limpo(d.cliente_nome)) f.push("nome do cliente");
        if (!itensOk(d.itens)) f.push("serviços com valor"); break;
      case "cobranca":
        dest(); if (!limpo(d.cliente_nome)) f.push("nome do cliente");
        if (!itensOk(d.itens)) f.push("itens com valor");
        if (!(Number(d.vencimento_dias) >= 0) || d.vencimento_dias === "" || d.vencimento_dias == null) f.push("prazo de vencimento");
        if (!d.aprovada) f.push("aprovação da cobrança"); break;
      case "contrato":
        dest(); if (!limpo(d.cliente_nome)) f.push("nome do contratante");
        if (!itensOk(d.itens)) f.push("serviços e valores");
        if (!d.inicio) f.push("data de início");
        if (!d.aprovada) f.push("aprovação do contrato"); break;
      case "documentos":
        dest(); if (!Array.isArray(d.itens) || !d.itens.length) f.push("quais documentos");
        if (d.itens && d.itens.some(x => PROIBIDOS.test(norm(x)))) f.push("remover pedidos de números (peça só o arquivo)"); break;
      case "reuniao":
        if (!limpo(d.titulo)) f.push("título"); if (!d.data) f.push("data"); if (!d.hora) f.push("horário");
        dest(); break;
      case "remarcar":
        if (!d.reuniao_id && !d.reuniao_ref) f.push("qual reunião remarcar"); if (!d.data) f.push("nova data"); if (!d.hora) f.push("novo horário"); break;
      case "tarefa":
        if (!limpo(d.titulo)) f.push("título"); if (!limpo(d.responsavel)) f.push("responsável"); break;
      case "crm":
        if (!emailValido(d.email)) f.push("e-mail do contato"); if (!limpo(d.nome)) f.push("nome do contato"); break;
      case "ata":
        dest(); if (!d.ata) f.push("gerar a ata"); break;
      case "email":
        dest(); if (!limpo(d.assunto)) f.push("assunto"); if (!limpo(d.corpo, 5000)) f.push("texto"); break;
    }
    return f;
  }
  function destinatariosDe(acao) {
    const d = acao.dados || {};
    const l = Array.isArray(d.destinatarios) ? d.destinatarios : d.destinatario ? [d.destinatario] : [];
    return [...new Set(l.map(x => String(x).trim().toLowerCase()).filter(Boolean))];
  }
  const confirmado = (contatos, e) => (contatos || []).some(c => c.email === String(e).toLowerCase() && c.confirmado);

  /**
   * Decide se a ação pode ser executada agora.
   * ctx: { papel: "anfitriao"|"convidado", admin, conexoes: { email, proposta, cobranca, assinatura, documentos, agenda, tarefas, crm }, contatos, comando }
   * Devolve { ok, codigo: "ok"|"sem_comando"|"sem_permissao"|"faltando"|"desconectada", mensagem, faltando[] }.
   */
  function verificar(acao, ctx) {
    ctx = ctx || {};
    const t = TIPOS[acao.tipo];
    if (!t) return { ok: false, codigo: "invalida", mensagem: "Tipo de ação desconhecido.", faltando: [] };
    if (ctx.papel !== "anfitriao") return { ok: false, codigo: "sem_permissao", mensagem: "Só o organizador da reunião pode executar ações.", faltando: [] };
    if (t.admin && !ctx.admin) return { ok: false, codigo: "sem_permissao", mensagem: `${t.nome}: só a equipe da Endeavor (admin) pode enviar.`, faltando: [] };
    const fal = faltando(acao, ctx.contatos);
    if (fal.length) return { ok: false, codigo: "faltando", mensagem: "Falta: " + fal.join(", ") + ".", faltando: fal };
    const con = ctx.conexoes || {};
    if (t.conexao && !con[t.conexao]) return { ok: false, codigo: "desconectada", mensagem: `${t.nome}: integração não conectada (${NOME_CONEXAO[t.conexao] || t.conexao}). O rascunho fica salvo.`, faltando: [] };
    if (t.envia && t.conexao !== "email" && t.conexao !== "tarefas" && t.conexao !== "crm" && !con.email && (acao.tipo === "documentos" || acao.tipo === "reuniao" || acao.tipo === "remarcar"))
      return { ok: false, codigo: "desconectada", mensagem: "E-mail não conectado: o convite ou o link não teria como chegar ao destinatário.", faltando: [] };
    if (!ctx.comando) return { ok: false, codigo: "sem_comando", mensagem: "Pronta. Executa só quando o organizador mandar.", faltando: [] };
    return { ok: true, codigo: "ok", mensagem: "", faltando: [] };
  }
  const NOME_CONEXAO = { email: "e-mail", proposta: "propostas", cobranca: "cobrança (Stripe)", assinatura: "assinatura eletrônica", documentos: "documentos", agenda: "agenda", tarefas: "tarefas", crm: "CRM" };

  /** Chave estável: o mesmo pedido com os mesmos dados não é enviado duas vezes. */
  function chaveIdem(acao) {
    const d = acao.dados || {};
    const base = JSON.stringify([acao.tipo, destinatariosDe(acao), d.itens || "", d.titulo || "", d.data || "", d.hora || "", d.reuniao_id || d.reuniao_ref || "", d.assunto || "", d.email || "", d.ata ? d.ata.gerada_em : "", acao.reenvio || 0]);
    let h = 2166136261; for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = Math.imul(h, 16777619); }
    return acao.tipo + "-" + (h >>> 0).toString(36);
  }

  /**
   * Executa com as integrações recebidas. integ: { registro: { obter(chave), salvar(chave, reg) }, email, proposta, cobranca, contrato,
   * documentos, agenda, tarefas, crm } (cada uma com os métodos usados abaixo). Nunca lança: devolve o novo estado da ação.
   */
  async function executar(acao, ctx, integ) {
    const v = verificar(acao, ctx);
    if (!v.ok) return { ...acao, status: v.codigo === "faltando" || v.codigo === "sem_comando" ? "rascunho" : "bloqueada", aviso: v.mensagem, codigo: v.codigo, faltando: v.faltando };
    const chave = chaveIdem(acao);
    const ja = integ.registro ? await integ.registro.obter(chave) : null;
    if (ja && ja.status === "concluida") return { ...acao, status: "concluida", resultado: ja.resultado, repetido: true, aviso: "Já executada antes; não foi enviada de novo.", codigo: "repetido", idem: chave };
    if (ja && ja.status === "executando") return { ...acao, status: "executando", aviso: "Já está sendo executada.", codigo: "repetido", idem: chave };
    if (integ.registro) await integ.registro.salvar(chave, { status: "executando", tipo: acao.tipo });
    try {
      const resultado = await HANDLERS[acao.tipo](acao.dados || {}, integ, ctx, acao);
      if (integ.registro) await integ.registro.salvar(chave, { status: "concluida", tipo: acao.tipo, resultado });
      return { ...acao, status: "concluida", resultado, aviso: resultado && resultado.aviso || "", codigo: "ok", idem: chave, erro: "" };
    } catch (e) {
      if (integ.registro) await integ.registro.salvar(chave, { status: "falhou", tipo: acao.tipo, erro: String(e && e.message || e) });
      return { ...acao, status: "falhou", erro: String(e && e.message || e || "Falha ao executar."), codigo: "falha", idem: chave };
    }
  }
  const HANDLERS = {
    async email(d, i) { await i.email.enviar({ para: destinatariosDe({ dados: d }), assunto: d.assunto, texto: d.corpo }); return { enviado_para: destinatariosDe({ dados: d }) }; },
    async proposta(d, i) {
      const p = await i.proposta.criar({ cliente_nome: d.cliente_nome, email: destinatariosDe({ dados: d })[0], titulo: d.titulo || "Proposta", itens: d.itens, moeda: d.moeda || d.itens[0].moeda || "usd", observacoes: d.observacoes || "" });
      await i.proposta.enviar(p.id);
      return { proposta_id: p.id, link: p.link || "", enviado_para: destinatariosDe({ dados: d }) };
    },
    async cobranca(d, i) {
      const c = await i.cobranca.criar({ cliente_nome: d.cliente_nome, email: destinatariosDe({ dados: d })[0], itens: d.itens, vencimento_dias: Number(d.vencimento_dias), descricao: d.titulo || "Cobrança" });
      await i.cobranca.enviar(c.id);
      return { cobranca_id: c.id, link: c.link || "", enviado_para: destinatariosDe({ dados: d }) };
    },
    async contrato(d, i) {
      const r = await i.contrato.enviar({ cliente_nome: d.cliente_nome, email: destinatariosDe({ dados: d })[0], itens: d.itens, inicio: d.inicio, titulo: d.titulo || "Contrato de prestação de serviços", texto: textoContrato(d) });
      return { envelope_id: r.id, enviado_para: destinatariosDe({ dados: d }) };
    },
    async documentos(d, i) {
      const r = await i.documentos.solicitar({ email: destinatariosDe({ dados: d })[0], nome: d.nome || "", itens: d.itens, prazo: d.prazo || "", mensagem: d.mensagem || "" });
      return { pedido_id: r.id, link: r.link || "", enviado_para: destinatariosDe({ dados: d }), pendentes: d.itens.slice() };
    },
    async reuniao(d, i) {
      const livre = await i.agenda.livre({ data: d.data, hora: d.hora, inicio_iso: d.inicio_iso, tz: d.tz, duracao_min: Number(d.duracao_min) || 30 });
      if (!livre.ok) { const e = new Error("Horário ocupado na agenda." + (livre.sugestoes && livre.sugestoes.length ? " Livres: " + livre.sugestoes.map(s => dataLegivel(s.data, s.hora)).join("; ") + "." : "")); e.sugestoes = livre.sugestoes; throw e; }
      const r = await i.agenda.criar({ titulo: d.titulo, data: d.data, hora: d.hora, inicio_iso: d.inicio_iso, tz: d.tz, duracao_min: Number(d.duracao_min) || 30, convidados: destinatariosDe({ dados: d }) });
      return { reuniao_id: r.id, link: r.link || "", quando: dataLegivel(d.data, d.hora), enviado_para: destinatariosDe({ dados: d }) };
    },
    async remarcar(d, i) {
      const livre = await i.agenda.livre({ data: d.data, hora: d.hora, inicio_iso: d.inicio_iso, tz: d.tz, duracao_min: Number(d.duracao_min) || 30, ignorar: d.reuniao_id });
      if (!livre.ok) { const e = new Error("Horário ocupado na agenda." + (livre.sugestoes && livre.sugestoes.length ? " Livres: " + livre.sugestoes.map(s => dataLegivel(s.data, s.hora)).join("; ") + "." : "")); e.sugestoes = livre.sugestoes; throw e; }
      const r = await i.agenda.remarcar({ id: d.reuniao_id, data: d.data, hora: d.hora, inicio_iso: d.inicio_iso, tz: d.tz });
      return { reuniao_id: r.id || d.reuniao_id, link: r.link || "", quando: dataLegivel(d.data, d.hora), avisados: r.avisados || [] };
    },
    async tarefa(d, i) {
      const r = await i.tarefas.criar({ titulo: d.titulo, responsavel: d.responsavel, responsavel_email: d.responsavel_email || "", prazo: d.prazo || "", origem: d.origem || "" });
      let crm = null;
      if (i.crm && i.crm.disponivel && d.contato_email) { try { crm = await i.crm.registrar({ email: d.contato_email, nome: d.contato_nome || "", proxima_acao: d.titulo, prazo: d.prazo || "" }); } catch (e) { crm = { erro: String(e.message || e) }; } }
      return { tarefa_id: r.id, crm };
    },
    async crm(d, i) { const r = await i.crm.registrar({ email: d.email, nome: d.nome, nota: d.nota || "", proxima_acao: d.proxima_acao || "", prazo: d.prazo || "" }); return { contato_id: r.id, criado: !!r.criado }; },
    async ata(d, i) {
      const para = destinatariosDe({ dados: d });
      await i.email.enviar({ para, assunto: "Ata: " + (d.ata.titulo || "Reunião"), texto: ataTexto(d.ata), html: ataHtml(d.ata) });
      if (i.ata && i.ata.salvar) await i.ata.salvar(d.ata);
      return { enviado_para: para };
    },
  };

  /* ---------------- montar ações a partir do que foi lido ---------------- */
  /**
   * Junta o estado da reunião em sugestões de ação. Não sobrescreve o que o organizador editou (campo editado).
   * estado: { titulo, participantes[{nome,papel,email?}], linhas[], contatos[], acoes[], agora }
   */
  function sugerir(estado) {
    const itens = [], nomes = (estado.participantes || []).map(p => p.nome);
    for (const l of estado.linhas || []) itens.push(...analisarLinha(l, { agora: estado.agora, nomes }));
    const contatos = mesclarContatos(estado.contatos || [], itens.filter(i => i.tipo === "email"));
    const servicos = unicos(itens.filter(i => i.tipo === "servico" && i.descricao), s => norm(s.descricao) + s.valor_cents);
    const externos = contatos.filter(c => !c.organizador);
    const cliente = externos.length === 1 ? externos[0] : null;
    const ambig = externos.length > 1 ? externos.map(c => c.email) : [];
    const sug = [];
    const destino = () => cliente ? { destinatario: cliente.email, ambiguos: [] } : { destinatario: "", ambiguos: ambig };
    if (servicos.length) {
      const dados = { ...destino(), cliente_nome: cliente ? (cliente.nome || "") : "", titulo: "Proposta: " + limpo(estado.titulo || "serviços", 80),
        itens: servicos.map(s => ({ descricao: s.descricao, valor_cents: s.valor_cents, moeda: s.moeda, quantidade: 1, mensal: !!s.mensal })), moeda: servicos[0].moeda };
      sug.push(montar("proposta", dados, servicos.flatMap(s => s.fonte), "Serviços e valores falados na reunião"));
    }
    const docs = itens.filter(i => i.tipo === "documentos");
    if (docs.length) {
      const lista = [...new Set(docs.flatMap(d => d.itens))];
      sug.push(montar("documentos", { ...destino(), nome: cliente ? cliente.nome : "", itens: lista }, docs.flatMap(d => d.fonte), docs.some(d => d.proibido) ? "Pediram números sensíveis: peça só o arquivo pelo link seguro" : "Documentos citados na conversa"));
    }
    for (const r of itens.filter(i => i.tipo === "reuniao")) sug.push(montar("reuniao", { titulo: "Próxima reunião: " + limpo(estado.titulo || "", 60), data: r.data, hora: r.hora, duracao_min: 30, destinatarios: cliente ? [cliente.email] : [], ambiguos: ambig }, r.fonte, "Reunião combinada na conversa"));
    for (const r of itens.filter(i => i.tipo === "remarcar")) sug.push(montar("remarcar", { reuniao_ref: "ultima", data: r.data, hora: r.hora }, r.fonte, "Pediram para remarcar"));
    for (const c of itens.filter(i => i.tipo === "compromisso")) sug.push(montar("tarefa", { titulo: limpo(c.resumo, 140), responsavel: c.responsavel, prazo: c.prazo, contato_email: cliente ? cliente.email : "", contato_nome: cliente ? cliente.nome : "" }, c.fonte, "Compromisso assumido"));
    // pedido que só repete os serviços já levados para a proposta não vira tarefa
    for (const p of itens.filter(i => i.tipo === "pedido" && !documentosDe(i.texto).length && !(servicos.length && RX.servico.test(norm(i.texto))))) sug.push(montar("tarefa", { titulo: limpo(p.resumo, 140), responsavel: "", prazo: p.prazo, solicitante: p.solicitante }, p.fonte, "Pedido feito na reunião"));
    if (cliente) sug.push(montar("crm", { email: cliente.email, nome: cliente.nome || "", nota: servicos.length ? "Interesse: " + servicos.map(s => s.descricao).join(", ") : "Participou da reunião " + limpo(estado.titulo || "", 80) }, cliente.fonte || [], "Contato informado no chat"));
    return { sugestoes: sug, contatos, decisoes: unicos(itens.filter(i => i.tipo === "decisao"), d => norm(d.resumo)), compromissos: itens.filter(i => i.tipo === "compromisso"), pedidos: itens.filter(i => i.tipo === "pedido"), servicos };
  }
  function montar(tipo, dados, fonte, motivo) { return { id: novoId(tipo), tipo, status: "sugerida", origem: "ia", dados, fonte: [...new Set(fonte || [])], motivo, criada_em: Date.now() }; }
  function unicos(l, k) { const m = new Map(); l.forEach(x => { const kk = k(x); if (!m.has(kk)) m.set(kk, x); }); return [...m.values()]; }
  function mesclarContatos(atuais, achados) {
    const m = new Map(atuais.map(c => [c.email, { ...c }]));
    for (const a of achados) {
      if (!m.has(a.email)) m.set(a.email, { email: a.email, nome: a.nome || "", confirmado: false, fonte: a.fonte, falante: a.falante, organizador: !!a.organizador });
      else if (!m.get(a.email).nome && a.nome) m.get(a.email).nome = a.nome;
    }
    return [...m.values()];
  }
  /**
   * Junta sugestões novas com as ações que já existem: mesma ação (tipo + chave lógica) não duplica;
   * o que o organizador editou, executou ou descartou não volta.
   */
  function mesclarAcoes(atuais, novas) {
    const chave = a => a.tipo + "|" + (a.tipo === "tarefa" ? norm(a.dados.titulo) : a.tipo === "reuniao" || a.tipo === "remarcar" ? (a.dados.data + a.dados.hora + (a.fonte || []).join()) : a.tipo === "crm" ? a.dados.email : "");
    const out = atuais.slice(), idx = new Map(atuais.map((a, i) => [chave(a), i]));
    for (const n of novas) {
      const k = chave(n);
      if (!idx.has(k)) { idx.set(k, out.length); out.push(n); continue; }
      const a = out[idx.get(k)];
      if (a.editada || ["concluida", "executando", "descartada"].includes(a.status)) continue;
      out[idx.get(k)] = { ...a, dados: { ...a.dados, ...completar(a.dados, n.dados) }, fonte: [...new Set([...(a.fonte || []), ...(n.fonte || [])])] };
    }
    return out;
  }
  // só preenche o que está vazio; listas de itens são substituídas pela versão mais completa
  function completar(atual, novo) {
    const r = {};
    for (const k of Object.keys(novo)) {
      const v = novo[k], a = atual[k];
      if (Array.isArray(v)) { if (!Array.isArray(a) || v.length > a.length) r[k] = v; }
      else if ((a == null || a === "") && v != null && v !== "") r[k] = v;
    }
    return r;
  }

  /**
   * Anti-invenção: confere uma sugestão (vinda do HUB, por exemplo) contra o que foi dito.
   * E-mails e valores que não aparecem na conversa são removidos. Devolve { acao, removidos[] }.
   */
  function conferirComFonte(acao, linhas) {
    const tudo = (linhas || []).map(l => l.texto).join("\n");
    const emails = new Set(emailsDe(tudo)), valores = new Set(valoresDe(tudo).map(v => v.valor_cents));
    const d = { ...(acao.dados || {}) }, removidos = [];
    const okEmail = e => emails.has(String(e).toLowerCase());
    if (d.destinatario && !okEmail(d.destinatario)) { removidos.push(d.destinatario); d.destinatario = ""; }
    if (Array.isArray(d.destinatarios)) d.destinatarios = d.destinatarios.filter(e => okEmail(e) || (removidos.push(e), false));
    if (d.email && !okEmail(d.email)) { removidos.push(d.email); d.email = ""; }
    if (Array.isArray(d.itens) && d.itens.length && typeof d.itens[0] === "object") d.itens = d.itens.filter(i => valores.has(Math.round(Number(i.valor_cents))) || (removidos.push(formatarValor(i.valor_cents, i.moeda)), false));
    return { acao: { ...acao, dados: d }, removidos };
  }

  /* ---------------- ata ---------------- */
  function gerarAta(estado, analise) {
    analise = analise || sugerir(estado);
    const acoes = estado.acoes || [];
    const tarefas = acoes.filter(a => a.tipo === "tarefa" && a.status !== "descartada").map(a => ({ titulo: a.dados.titulo, responsavel: a.dados.responsavel || "a definir", prazo: a.dados.prazo || "", status: a.status === "concluida" ? "registrada" : "a confirmar" }));
    const pend = [];
    acoes.filter(a => !["concluida", "descartada"].includes(a.status) && a.tipo !== "ata").forEach(a => pend.push(TIPOS[a.tipo].nome + ": " + (a.aviso || (faltando(a, estado.contatos).length ? "falta " + faltando(a, estado.contatos).join(", ") : "aguardando o organizador"))));
    acoes.filter(a => a.tipo === "documentos" && a.status === "concluida").forEach(a => { const p = (a.pendentes || (a.resultado && a.resultado.pendentes) || []); if (p.length) pend.push("Documentos pendentes de " + (a.dados.destinatario || "") + ": " + p.join(", ")); });
    tarefas.filter(t => !t.prazo).forEach(t => pend.push("Definir prazo: " + t.titulo));
    const assuntos = [];
    if (analise.servicos.length) assuntos.push("Serviços e valores: " + analise.servicos.map(s => s.descricao + " (" + formatarValor(s.valor_cents, s.moeda) + (s.mensal ? "/mês" : "") + ")").join("; "));
    analise.pedidos.forEach(p => assuntos.push("Pedido de " + (p.solicitante || "participante") + ": " + p.resumo));
    acoes.filter(a => a.status === "concluida" && a.tipo !== "ata").forEach(a => assuntos.push(TIPOS[a.tipo].nome + " executada" + (a.resultado && a.resultado.quando ? " (" + a.resultado.quando + ")" : "") + (a.resultado && a.resultado.enviado_para ? " para " + a.resultado.enviado_para.join(", ") : "")));
    return {
      titulo: limpo(estado.titulo || "Reunião", 140), data: new Date(estado.agora || Date.now()).toISOString(), gerada_em: Date.now(),
      participantes: (estado.participantes || []).map(p => ({ nome: p.nome, papel: p.papel === "mentor" || p.papel === "anfitriao" ? "Organizador" : "Participante" })),
      assuntos, decisoes: analise.decisoes.map(d => d.resumo), tarefas, pendencias: [...new Set(pend)],
    };
  }
  function ataTexto(a) {
    const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(a.data));
    const sec = (t, l, f) => l.length ? [t, ...l.map(f || (x => "- " + x)), ""] : [t, "- Nenhum.", ""];
    return [
      "Ata: " + a.titulo, dt, "",
      ...sec("Participantes", a.participantes, p => "- " + p.nome + " (" + p.papel + ")"),
      ...sec("Assuntos", a.assuntos), ...sec("Decisões", a.decisoes),
      ...sec("Tarefas", a.tarefas, t => "- " + t.titulo + " | Responsável: " + t.responsavel + " | Prazo: " + (t.prazo ? dataLegivel(t.prazo) : "a definir")),
      ...sec("Pendências", a.pendencias),
      "Ata gerada pelo Web Meeting da Endeavor Business Hub com apoio de IA. Confira antes de tomar decisões com base nela.",
    ].join("\n");
  }
  const escH = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function ataHtml(a) {
    const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(a.data));
    const lista = (l, f) => l.length ? "<ul>" + l.map(x => "<li>" + (f ? f(x) : escH(x)) + "</li>").join("") + "</ul>" : "<p style=\"color:#6b7280\">Nenhum.</p>";
    const h = t => `<h3 style="font:700 15px Arial,sans-serif;color:#0b1f3a;margin:18px 0 6px">${t}</h3>`;
    return `<div style="font:14px/1.6 Arial,sans-serif;color:#1f2937"><h2 style="font:700 20px Georgia,serif;color:#0b1f3a;margin:0">Ata: ${escH(a.titulo)}</h2><p style="color:#6b7280;margin:4px 0 0">${escH(dt)}</p>` +
      h("Participantes") + lista(a.participantes, p => escH(p.nome) + " <span style=\"color:#6b7280\">(" + escH(p.papel) + ")</span>") +
      h("Assuntos") + lista(a.assuntos) + h("Decisões") + lista(a.decisoes) +
      h("Tarefas") + lista(a.tarefas, t => "<b>" + escH(t.titulo) + "</b><br>Responsável: " + escH(t.responsavel) + " · Prazo: " + escH(t.prazo ? dataLegivel(t.prazo) : "a definir")) +
      h("Pendências") + lista(a.pendencias) +
      `<p style="font-size:12px;color:#6b7280;margin-top:18px">Ata gerada pelo Web Meeting da Endeavor Business Hub com apoio de IA. Confira antes de tomar decisões com base nela.</p></div>`;
  }
  function textoContrato(d) {
    const tot = (d.itens || []).reduce((s, i) => s + Number(i.valor_cents || 0) * (Number(i.quantidade) || 1), 0), moeda = (d.itens && d.itens[0] && d.itens[0].moeda) || d.moeda || "usd";
    return [
      (d.titulo || "Contrato de prestação de serviços").toUpperCase(), "",
      "CONTRATADA: Endeavor Business Hub.", "CONTRATANTE: " + d.cliente_nome + " (" + destinatariosDe({ dados: d })[0] + ").", "",
      "1. SERVIÇOS. A CONTRATADA prestará os serviços abaixo, conforme combinado em reunião:",
      ...(d.itens || []).map((i, k) => `   1.${k + 1}. ${i.descricao}: ${formatarValor(i.valor_cents, i.moeda || moeda)}${i.mensal ? " por mês" : ""}.`),
      "2. VALOR. Total de " + formatarValor(tot, moeda) + ", pago conforme as faturas emitidas pela CONTRATADA.",
      "3. INÍCIO. Os serviços começam em " + dataLegivel(d.inicio) + ".",
      d.observacoes ? "4. CONDIÇÕES COMBINADAS. " + d.observacoes : "",
      "", "As partes concordam com este contrato por assinatura eletrônica.",
    ].filter(x => x !== "").join("\n");
  }

  const api = {
    norm, numero, emailsDe, emailValido, valoresDe, formatarValor, dataDe, dataLegivel, documentosDe, PROIBIDOS,
    analisarLinha, ehComando, interpretarComando, resolverDestinatario, TIPOS, NOME_CONEXAO, faltando, destinatariosDe, verificar, chaveIdem, executar,
    sugerir, mesclarAcoes, mesclarContatos, conferirComFonte, gerarAta, ataTexto, ataHtml, textoContrato, novoId,
  };
  raiz.EMeetAcoes = api;
})(typeof window !== "undefined" ? window : globalThis);
