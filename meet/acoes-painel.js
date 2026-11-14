/*
 * Web Meeting (Endeavor): painel de ações da reunião (só o organizador vê).
 * A IA acompanha a transcrição e o chat, sugere ações e prepara rascunhos. Nada é enviado sem comando explícito
 * do organizador ("Executar", ou "IA, envia a proposta" por voz ou chat), dados completos e destinatário confirmado.
 *
 * A sala (room.js) cria o painel com EMeetAcoesPainel.criar(api) e avisa cada fala, mensagem e comando.
 * Regras: acoes-core.js (o mesmo arquivo do servidor). Em modo demonstração as integrações são simuladas no navegador.
 */
(function () {
  "use strict";
  const A = () => window.EMeetAcoes;
  const NOME_STATUS = { sugerida: "Sugerida", rascunho: "Rascunho", pronta: "Pronta", executando: "Executando…", concluida: "Concluída", falhou: "Falhou", bloqueada: "Bloqueada", descartada: "Descartada" };
  const ROTULO_CONEXAO = [["email", "E-mail"], ["agenda", "Agenda"], ["documentos", "Documentos"], ["tarefas", "Tarefas"], ["crm", "CRM"], ["proposta", "Propostas"], ["cobranca", "Cobrança"], ["assinatura", "Assinatura"]];

  function criar(api) {
    const { $, esc, toast } = api;
    const chave = "emeet-acoes:" + api.sala();
    const P = {
      ativa: false, pausada: false, linhas: [], contatos: [], acoes: [], decisoes: [], log: [],
      conexoes: null, admin: false, iaServidor: false, editando: "", seq: 0, ultimaIA: 0, linhasIA: 0, pendencias: null,
    };
    try { const s = JSON.parse(localStorage.getItem(chave) || "null"); if (s) Object.assign(P, { linhas: s.linhas || [], contatos: s.contatos || [], acoes: s.acoes || [], decisoes: s.decisoes || [], log: s.log || [] }); } catch (e) { }
    const salvar = () => { try { localStorage.setItem(chave, JSON.stringify({ linhas: P.linhas.slice(-300), contatos: P.contatos, acoes: P.acoes.slice(-80), decisoes: P.decisoes, log: P.log.slice(-30) })); } catch (e) { } };
    const demo = () => api.demo();
    const box = () => $("painelAcoes");
    const registrar = t => { P.log.push({ t, em: Date.now() }); if (P.log.length > 40) P.log.shift(); };

    /* ---------- servidor ---------- */
    async function servidor(corpo) {
      const cab = { "Content-Type": "application/json", Authorization: "Bearer " + api.token() };
      if (api.anonKey) cab.apikey = api.anonKey;
      const r = await fetch(api.url, { method: "POST", headers: cab, body: JSON.stringify(Object.assign({ sala: api.sala(), sessao: api.sessao() || undefined }, corpo)) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.erro || "O servidor não concluiu a ação."); e.status = r.status; throw e; }
      return j;
    }
    async function carregarConexoes() {
      if (demo()) { P.conexoes = { email: true, agenda: true, documentos: true, tarefas: true, crm: true, proposta: true, cobranca: true, assinatura: true }; P.admin = true; P.iaServidor = false; return; }
      try { const j = await servidor({ acao: "acoes_status" }); P.conexoes = j.conexoes; P.admin = !!j.admin; P.iaServidor = !!j.ia; }
      catch (e) { P.conexoes = {}; registrar("Não foi possível ler as integrações: " + e.message); }
      desenhar();
    }

    /* ---------- integrações simuladas (demonstração) ---------- */
    const simuladas = (() => {
      const reg = new Map(); let n = 0;
      const ok = (p, extra) => Object.assign({ id: p + "-" + (++n) }, extra || {});
      return {
        registro: { obter: async k => reg.get(k) || null, salvar: async (k, v) => { reg.set(k, v); } },
        email: { enviar: async () => { } },
        proposta: { criar: async () => ok("prop"), enviar: async () => ({ link: "" }) },
        cobranca: { criar: async () => ok("inv"), enviar: async () => ({}) },
        contrato: { enviar: async () => ok("env") },
        documentos: { solicitar: async () => ok("doc", { link: "" }) },
        agenda: { livre: async () => ({ ok: true }), criar: async () => ok("sala", { link: "" }), remarcar: async q => ({ id: q.id, avisados: [] }) },
        tarefas: { criar: async () => ok("tarefa") },
        crm: { disponivel: true, registrar: async () => ok("crm", { criado: true }) },
        ata: { salvar: async () => { } },
      };
    })();

    /* ---------- leitura da conversa ---------- */
    function participantes() { return api.participantes(); }
    function estado() { return { titulo: api.titulo(), agora: Date.now(), participantes: participantes(), linhas: P.linhas.filter(l => !l.pausada), contatos: P.contatos, acoes: P.acoes }; }
    function analisar() {
      if (!P.ativa) return;
      const r = A().sugerir(estado());
      P.contatos = r.contatos.map(c => { const v = P.contatos.find(x => x.email === c.email); return v ? { ...c, confirmado: v.confirmado, nome: v.nome || c.nome, organizador: v.organizador } : c; });
      P.acoes = A().mesclarAcoes(P.acoes, r.sugestoes);
      P.decisoes = r.decisoes.map(d => d.resumo);
      resolverRemarcar();
      salvar(); desenhar(); api.badge(P.acoes.filter(a => a.status === "sugerida").length);
      if (P.iaServidor && !demo() && P.linhas.length - P.linhasIA >= 4 && Date.now() - P.ultimaIA > 40000) analisarComIA();
    }
    async function analisarComIA() {
      P.ultimaIA = Date.now(); P.linhasIA = P.linhas.length;
      try {
        const j = await servidor({ acao: "acoes_analisar", titulo: api.titulo(), linhas: P.linhas.filter(l => !l.pausada).slice(-200), participantes: participantes(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
        if (j.sugestoes && j.sugestoes.length) { P.acoes = A().mesclarAcoes(P.acoes, j.sugestoes); resolverRemarcar(); salvar(); desenhar(); }
        if (j.removidos && j.removidos.length) registrar("A IA citou dados que não apareceram na conversa e eles foram descartados: " + j.removidos.join(", "));
      } catch (e) { if (e.status !== 503) registrar("IA do servidor: " + e.message + " Seguimos com a leitura local."); }
    }
    function resolverRemarcar() {
      const ultima = [...P.acoes].reverse().find(a => a.tipo === "reuniao" && a.status === "concluida" && a.resultado && a.resultado.reuniao_id);
      P.acoes.forEach(a => { if (a.tipo === "remarcar" && !a.dados.reuniao_id && a.dados.reuniao_ref === "ultima" && ultima) a.dados.reuniao_id = ultima.resultado.reuniao_id; });
    }
    /** Uma fala final (legenda) ou uma mensagem do chat. */
    function linha(l) {
      const nova = { id: (l.via === "chat" ? "c" : "f") + (++P.seq) + "-" + Date.now().toString(36).slice(-4), nome: String(l.nome || "").slice(0, 60), texto: String(l.texto || "").slice(0, 600), via: l.via, anfitriao: !!l.anfitriao, pausada: P.pausada || !P.ativa };
      if (!nova.texto) return;
      P.linhas.push(nova); if (P.linhas.length > 600) P.linhas.shift();
      // comandos: do organizador executam; de convidados são recusados (sem permissão)
      if (A().ehComando(nova.texto)) {
        if (nova.anfitriao) comando(nova.texto, nova.via === "chat" ? "chat" : "voz");
        else { registrar(`Comando de ${nova.nome} ignorado: só o organizador pode pedir ações à IA.`); toast(`${nova.nome} tentou dar um comando à IA. Só o organizador pode.`); desenhar(true); }
        return;
      }
      if (!nova.pausada) analisar(); else salvar();
    }

    /* ---------- comandos ---------- */
    let ultimoComando = { t: "", em: 0 };
    async function comando(texto, via) {
      const c = A().interpretarComando(texto, { agora: Date.now() });
      if (!c) return false;
      // o mesmo comando repetido em seguida (eco da voz, clique duplo) não roda duas vezes
      if (ultimoComando.t === A().norm(c.texto) && Date.now() - ultimoComando.em < 8000) { toast("Comando repetido ignorado."); return true; }
      ultimoComando = { t: A().norm(c.texto), em: Date.now() };
      registrar(`Comando (${via}): ${c.texto}`);
      if (c.intencao === "pausar") { pausar(true); return true; }
      if (c.intencao === "retomar") { pausar(false); return true; }
      if (!P.ativa) ligar(true);
      if (c.intencao === "desconhecido") { toast("Não entendi o comando. Ex.: “IA, prepara a proposta”."); desenhar(true); return true; }
      if (c.intencao === "descartar") { const a = alvo(c.tipo); if (a) { descartar(a.id); toast(A().TIPOS[a.tipo].nome + " descartada."); } return true; }
      let a = c.tipo === "ata" ? prepararAta() : alvo(c.tipo);
      if (!a) a = nova(c.tipo);
      // dados do comando: data/hora, e-mail ou nome do destinatário
      if ((c.tipo === "reuniao" || c.tipo === "remarcar") && (c.data || c.hora)) { if (c.data) a.dados.data = c.data; if (c.hora) a.dados.hora = c.hora; a.editada = true; }
      if (c.tipo === "tarefa" && !a.dados.titulo) { a.dados.titulo = c.texto.replace(/^(cria|crie|criar|registra)\s+(uma\s+)?tarefa\s*(para\s+)?/i, "").slice(0, 140); if (c.data) a.dados.prazo = c.data; }
      const quem = A().resolverDestinatario(c.texto, P.contatos);
      if (quem.emails.length === 1) definirDestinatario(a, quem.emails[0]);
      else if (quem.emails.length > 1) { a.dados.ambiguos = quem.emails; a.dados.destinatario = ""; toast("Mais de um destinatário possível: escolha no painel."); }
      if (c.emails.length) c.emails.forEach(e => adicionarContato(e, "", false));
      api.abrir(); P.editando = c.executar ? "" : a.id;
      if (c.executar) await executar(a.id, true);
      else { a.status = a.status === "sugerida" ? "rascunho" : a.status; toast(A().TIPOS[a.tipo].nome + ": rascunho pronto para revisar."); }
      salvar(); desenhar(true); focar(a.id);
      return true;
    }
    function alvo(tipo) { return [...P.acoes].reverse().find(a => a.tipo === tipo && !["concluida", "descartada"].includes(a.status)) || (tipo === "remarcar" ? null : null); }
    function nova(tipo) {
      const base = { id: A().novoId(tipo), tipo, status: "rascunho", origem: "comando", dados: {}, fonte: [], motivo: "Pedido do organizador", criada_em: Date.now() };
      const ext = P.contatos.filter(c => !c.organizador);
      if (["proposta", "cobranca", "contrato", "documentos"].includes(tipo)) { base.dados = { destinatario: ext.length === 1 ? ext[0].email : "", ambiguos: ext.length > 1 ? ext.map(c => c.email) : [], cliente_nome: ext.length === 1 ? ext[0].nome : "", itens: [] }; if (tipo === "cobranca") base.dados.vencimento_dias = 7; }
      if (tipo === "reuniao") base.dados = { titulo: "Próxima reunião: " + api.titulo(), data: "", hora: "", duracao_min: 30, destinatarios: ext.length === 1 ? [ext[0].email] : [] };
      if (tipo === "remarcar") base.dados = { reuniao_ref: "ultima" };
      if (tipo === "tarefa") base.dados = { titulo: "", responsavel: api.meuNome(), prazo: "" };
      if (tipo === "crm") base.dados = ext.length === 1 ? { email: ext[0].email, nome: ext[0].nome, nota: "" } : { email: "", nome: "", nota: "" };
      if (tipo === "email") base.dados = { destinatarios: [], assunto: "", corpo: "" };
      // proposta/cobrança/contrato partem dos serviços falados
      if (["proposta", "cobranca", "contrato"].includes(tipo)) { const p = P.acoes.find(x => x.tipo === "proposta" && x.dados.itens && x.dados.itens.length); if (p) base.dados.itens = p.dados.itens.map(i => ({ ...i })); }
      P.acoes.push(base); resolverRemarcar();
      return base;
    }
    function definirDestinatario(a, email) {
      if (a.tipo === "reuniao" || a.tipo === "ata" || a.tipo === "email") a.dados.destinatarios = [email];
      else if (a.tipo === "crm") a.dados.email = email;
      else a.dados.destinatario = email;
      a.dados.ambiguos = [];
      const c = P.contatos.find(x => x.email === email); if (c && (a.tipo === "proposta" || a.tipo === "cobranca" || a.tipo === "contrato") && !a.dados.cliente_nome) a.dados.cliente_nome = c.nome || "";
    }

    /* ---------- executar ---------- */
    function contexto(comandoExplicito) { return { papel: "anfitriao", admin: P.admin, conexoes: P.conexoes || {}, contatos: P.contatos, comando: !!comandoExplicito }; }
    async function executar(id, comandoExplicito) {
      const a = P.acoes.find(x => x.id === id); if (!a) return;
      if (a.tipo === "remarcar") resolverRemarcar();
      if (a.tipo === "reuniao" || a.tipo === "remarcar") {
        if (a.dados.data && a.dados.hora) { const d = new Date(a.dados.data + "T" + a.dados.hora + ":00"); if (!isNaN(d)) a.dados.inicio_iso = d.toISOString(); }
        a.dados.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      const pre = A().verificar(a, contexto(comandoExplicito));
      if (!pre.ok) { Object.assign(a, { status: pre.codigo === "faltando" || pre.codigo === "sem_comando" ? "rascunho" : "bloqueada", aviso: pre.mensagem, faltando: pre.faltando, codigo: pre.codigo }); toast(pre.mensagem); salvar(); desenhar(true); return; }
      a.status = "executando"; a.aviso = ""; desenhar(true);
      let r;
      try {
        if (demo()) r = await A().executar(a, contexto(true), simuladas);
        else r = (await servidor({ acao: "acao_executar", item: { id: a.id, tipo: a.tipo, dados: a.dados, reenvio: a.reenvio || 0 }, contatos: P.contatos, comando: true })).acao;
      } catch (e) { r = { ...a, status: "falhou", erro: e.message }; }
      const i = P.acoes.findIndex(x => x.id === id);
      P.acoes[i] = { ...a, ...r, id: a.id, dados: a.dados };
      const x = P.acoes[i];
      if (x.status === "concluida") {
        toast(A().TIPOS[x.tipo].nome + (x.repetido ? ": já tinha sido feita, não repeti." : ": feito" + (demo() ? " (simulação)." : ".")));
        registrar(A().TIPOS[x.tipo].nome + " executada" + (x.resultado && x.resultado.enviado_para ? " para " + x.resultado.enviado_para.join(", ") : "") + (demo() ? " (simulação)" : "") + ".");
        if (x.tipo === "documentos") x.pendentes = (x.resultado && x.resultado.pendentes) || x.dados.itens;
        if (x.tipo === "reuniao") resolverRemarcar();
        if (!demo()) atualizarPendencias();
      } else if (x.status === "falhou") { toast(A().TIPOS[x.tipo].nome + ": " + (x.erro || "falhou.")); registrar(A().TIPOS[x.tipo].nome + " falhou: " + (x.erro || "")); }
      else if (x.aviso) toast(x.aviso);
      salvar(); desenhar(true); focar(x.id);
    }
    function descartar(id) { const a = P.acoes.find(x => x.id === id); if (a) { a.status = "descartada"; P.editando = ""; salvar(); desenhar(true); } }
    async function atualizarPendencias() {
      try { P.pendencias = await servidor({ acao: "acoes_listar" }); desenhar(); } catch (e) { /* segue sem */ }
    }

    /* ---------- ata ---------- */
    function prepararAta() {
      const ata = A().gerarAta(estado());
      let a = P.acoes.find(x => x.tipo === "ata" && x.status !== "concluida" && x.status !== "descartada");
      if (!a) { a = { id: A().novoId("ata"), tipo: "ata", status: "rascunho", origem: "comando", dados: { destinatarios: P.contatos.filter(c => c.confirmado && !c.organizador).map(c => c.email) }, fonte: [], motivo: "Ata da reunião", criada_em: Date.now() }; P.acoes.push(a); }
      a.dados.ata = ata;
      return a;
    }

    /* ---------- estado da IA ---------- */
    function ligar(on) {
      P.ativa = on; P.pausada = false;
      if (on) { api.ligarTranscricao(); if (!P.conexoes) carregarConexoes(); registrar("IA acompanhando a reunião."); }
      else registrar("IA desligada.");
      api.anunciar({ ativa: P.ativa, pausada: P.pausada });
      salvar(); desenhar(true); if (on) analisar();
    }
    function pausar(p) {
      if (!P.ativa) return;
      P.pausada = p; registrar(p ? "IA pausada: o que for dito agora não entra nas ações." : "IA retomada.");
      api.anunciar({ ativa: P.ativa, pausada: P.pausada });
      toast(p ? "IA pausada." : "IA acompanhando de novo.");
      desenhar(true);
    }
    function adicionarContato(email, nome, confirmar) {
      email = String(email || "").trim().toLowerCase();
      if (!A().emailValido(email)) return false;
      const c = P.contatos.find(x => x.email === email);
      if (c) { if (confirmar) c.confirmado = true; if (nome && !c.nome) c.nome = nome; }
      else P.contatos.push({ email, nome: nome || "", confirmado: !!confirmar, organizador: false, manual: true });
      return true;
    }

    /* ---------- desenho ---------- */
    const quandoTxt = a => a.dados.data ? A().dataLegivel(a.dados.data, a.dados.hora) : "";
    function resumo(a) {
      const d = a.dados || {}, tot = (d.itens || []).filter(i => i && i.valor_cents).map(i => A().formatarValor(i.valor_cents, i.moeda) + (i.mensal ? "/mês" : ""));
      switch (a.tipo) {
        case "proposta": case "cobranca": case "contrato": return [(d.itens || []).map(i => i.descricao).filter(Boolean).join(", "), tot.join(" + ")].filter(Boolean).join(" · ") || "Sem serviços ainda";
        case "documentos": return (d.itens || []).join(", ") || "Quais documentos?";
        case "reuniao": return (d.titulo || "") + (quandoTxt(a) ? " · " + quandoTxt(a) : "");
        case "remarcar": return "Nova data: " + (quandoTxt(a) || "?");
        case "tarefa": return (d.titulo || "") + (d.responsavel ? " · " + d.responsavel : "") + (d.prazo ? " · até " + A().dataLegivel(d.prazo) : "");
        case "crm": return [d.nome, d.email].filter(Boolean).join(" · ");
        case "ata": return d.ata ? `${d.ata.decisoes.length} decisões · ${d.ata.tarefas.length} tarefas · ${d.ata.pendencias.length} pendências` : "Gerar ata";
        case "email": return d.assunto || "";
      }
      return "";
    }
    function destinoTxt(a) {
      const l = A().destinatariosDe(a);
      if (l.length) return "Para: " + l.join(", ");
      if (a.dados.ambiguos && a.dados.ambiguos.length > 1) return "Destinatário ambíguo: " + a.dados.ambiguos.join(" ou ");
      return "";
    }
    function cartao(a) {
      const t = A().TIPOS[a.tipo], v = A().verificar(a, contexto(true)), fal = A().faltando(a, P.contatos);
      const fonte = (a.fonte || []).map(id => P.linhas.find(l => l.id === id)).filter(Boolean)[0];
      const podeExec = v.ok, final = ["concluida", "descartada", "executando"].includes(a.status);
      const res = a.resultado || {};
      return `<article class="ac-card st-${a.status}" data-id="${esc(a.id)}" tabindex="-1">
        <header><b>${esc(t.nome)}</b><span class="ac-st">${esc(NOME_STATUS[a.status] || a.status)}</span></header>
        <p class="ac-resumo">${esc(resumo(a))}</p>
        ${destinoTxt(a) ? `<p class="ac-dest">${esc(destinoTxt(a))}</p>` : ""}
        ${a.motivo || fonte ? `<p class="ac-fonte">${esc(a.motivo || "")}${fonte ? `: “${esc(fonte.texto.slice(0, 140))}” <i>(${esc(fonte.nome)})</i>` : ""}</p>` : ""}
        ${!final && fal.length ? `<p class="ac-falta">Falta: ${esc(fal.join(", "))}</p>` : ""}
        ${!final && !fal.length && !podeExec && v.codigo !== "sem_comando" ? `<p class="ac-aviso">${esc(v.mensagem)}</p>` : ""}
        ${a.status === "falhou" ? `<p class="ac-erro">${esc(a.erro || "Falhou.")}</p>` : ""}
        ${a.status === "concluida" ? `<p class="ac-ok">${esc(res.enviado_para ? "Enviado para " + res.enviado_para.join(", ") : res.quando ? "Agendado: " + res.quando : "Feito")}${demo() ? " (simulação)" : ""}${a.repetido ? " · não repetido" : ""}${res.link ? ` · <a href="${esc(res.link)}" target="_blank" rel="noopener">abrir</a>` : ""}</p>` : ""}
        ${a.tipo === "contrato" && !final ? `<p class="ac-nota">Minuta gerada a partir da conversa. Revise com um advogado antes de enviar.</p>` : ""}
        ${P.editando === a.id && !final ? formulario(a) : ""}
        ${!final ? `<div class="ac-botoes">
          <button type="button" class="ac-exec" data-ac="executar" ${podeExec ? "" : "aria-disabled=\"true\""} title="${esc(podeExec ? "Executar agora" : v.mensagem)}">${a.status === "falhou" ? "Tentar de novo" : t.envia ? "Enviar" : "Executar"}</button>
          <button type="button" data-ac="editar">${P.editando === a.id ? "Fechar" : "Editar"}</button>
          <button type="button" data-ac="descartar">Descartar</button></div>` : a.status === "concluida" && t.envia ? `<div class="ac-botoes"><button type="button" data-ac="reenviar">Reenviar</button></div>` : ""}
      </article>`;
    }
    const campo = (rot, nome, valor, tipo, extra) => `<label class="ac-f"><span>${esc(rot)}</span><input name="${nome}" type="${tipo || "text"}" value="${esc(valor == null ? "" : valor)}" ${extra || ""}></label>`;
    function seletorDest(a, multiplo) {
      const ext = P.contatos.filter(c => !c.organizador), atuais = A().destinatariosDe(a);
      if (!ext.length) return `<p class="ac-dica">Nenhum e-mail na conversa ainda. Peça para o participante escrever o e-mail no chat ou adicione em Destinatários.</p>`;
      return `<fieldset class="ac-dests"><legend>${multiplo ? "Destinatários" : "Destinatário"}</legend>${ext.map(c => `<label><input type="${multiplo ? "checkbox" : "radio"}" name="dest" value="${esc(c.email)}" ${atuais.includes(c.email) ? "checked" : ""}> ${esc(c.nome ? c.nome + " · " : "")}${esc(c.email)}${c.confirmado ? "" : " <em>(não confirmado)</em>"}</label>`).join("")}</fieldset>`;
    }
    function itensEditor(a) {
      const itens = (a.dados.itens || []).length ? a.dados.itens : [{ descricao: "", valor_cents: "", moeda: "usd" }];
      return `<div class="ac-itens">${itens.map((i, k) => `<div class="ac-item" data-k="${k}"><input name="i_desc" placeholder="Serviço" value="${esc(i.descricao || "")}" aria-label="Serviço ${k + 1}"><input name="i_valor" inputmode="decimal" placeholder="Valor" value="${i.valor_cents ? (i.valor_cents / 100).toFixed(2) : ""}" aria-label="Valor ${k + 1}"><label class="ac-mensal"><input type="checkbox" name="i_mensal" ${i.mensal ? "checked" : ""}> mensal</label></div>`).join("")}
        <button type="button" data-ac="mais-item" class="ac-link">+ serviço</button></div>`;
    }
    function formulario(a) {
      const d = a.dados;
      let h = "";
      switch (a.tipo) {
        case "proposta": case "cobranca": case "contrato":
          h = seletorDest(a) + campo(a.tipo === "contrato" ? "Contratante" : "Cliente", "cliente_nome", d.cliente_nome) + campo("Título", "titulo", d.titulo) + itensEditor(a) +
            (a.tipo === "cobranca" ? campo("Vence em (dias)", "vencimento_dias", d.vencimento_dias, "number", 'min="0" max="90"') : "") +
            (a.tipo === "contrato" ? campo("Início", "inicio", d.inicio, "date") : "") +
            (a.tipo !== "proposta" ? `<label class="ac-check"><input type="checkbox" name="aprovada" ${d.aprovada ? "checked" : ""}> Aprovo ${a.tipo === "cobranca" ? "esta cobrança" : "este contrato"} para envio</label>` : "");
          break;
        case "documentos":
          h = seletorDest(a) + campo("Nome", "nome", d.nome) + `<label class="ac-f"><span>Documentos (um por linha)</span><textarea name="itens" rows="3">${esc((d.itens || []).join("\n"))}</textarea></label><p class="ac-dica">Só arquivos. Nunca peça números (SSN, ITIN, passaporte, conta bancária).</p>`;
          break;
        case "reuniao":
          h = campo("Título", "titulo", d.titulo) + `<div class="ac-linha">${campo("Data", "data", d.data, "date")}${campo("Hora", "hora", d.hora, "time")}${campo("Minutos", "duracao_min", d.duracao_min || 30, "number", 'min="15" max="240" step="15"')}</div>` + seletorDest(a, true);
          break;
        case "remarcar":
          h = `<div class="ac-linha">${campo("Nova data", "data", d.data, "date")}${campo("Nova hora", "hora", d.hora, "time")}</div>` + (d.reuniao_id ? "" : `<p class="ac-dica">Agende uma reunião por aqui primeiro; a remarcação vale para a última agendada.</p>`);
          break;
        case "tarefa":
          h = campo("Tarefa", "titulo", d.titulo) + `<div class="ac-linha">${campo("Responsável", "responsavel", d.responsavel)}${campo("Prazo", "prazo", d.prazo, "date")}</div>`;
          break;
        case "crm":
          h = campo("E-mail", "email", d.email, "email") + campo("Nome", "nome", d.nome) + campo("Nota", "nota", d.nota);
          break;
        case "ata":
          h = seletorDest(a, true) + `<pre class="ac-ata">${esc(d.ata ? A().ataTexto(d.ata) : "")}</pre><button type="button" data-ac="regerar" class="ac-link">Gerar de novo com o que foi dito até agora</button>`;
          break;
        case "email":
          h = seletorDest(a, true) + campo("Assunto", "assunto", d.assunto) + `<label class="ac-f"><span>Texto</span><textarea name="corpo" rows="4">${esc(d.corpo || "")}</textarea></label>`;
          break;
      }
      return `<form class="ac-form" data-id="${esc(a.id)}">${h}<div class="ac-botoes"><button type="submit">Salvar</button></div></form>`;
    }
    function lerFormulario(a, f) {
      const d = a.dados, v = n => { const x = f.querySelector(`[name="${n}"]`); return x ? (x.type === "checkbox" ? x.checked : x.value.trim()) : undefined; };
      const dests = [...f.querySelectorAll('[name="dest"]:checked')].map(x => x.value);
      ["cliente_nome", "titulo", "nome", "data", "hora", "responsavel", "prazo", "email", "nota", "assunto", "corpo", "inicio"].forEach(k => { const x = v(k); if (x !== undefined) d[k] = x; });
      if (v("duracao_min") !== undefined) d.duracao_min = Number(v("duracao_min")) || 30;
      if (v("vencimento_dias") !== undefined) d.vencimento_dias = v("vencimento_dias") === "" ? "" : Number(v("vencimento_dias"));
      if (v("aprovada") !== undefined) d.aprovada = v("aprovada");
      if (f.querySelector('[name="itens"]')) d.itens = v("itens").split(/\n|,/).map(s => s.trim()).filter(Boolean);
      if (f.querySelector(".ac-item")) {
        d.itens = [...f.querySelectorAll(".ac-item")].map(r => {
          const desc = r.querySelector('[name="i_desc"]').value.trim(), val = A().numero(String(r.querySelector('[name="i_valor"]').value).replace(/[^\d.,]/g, ""));
          return { descricao: desc, valor_cents: isFinite(val) && val > 0 ? Math.round(val * 100) : 0, moeda: (a.dados.itens && a.dados.itens[0] && a.dados.itens[0].moeda) || "usd", quantidade: 1, mensal: r.querySelector('[name="i_mensal"]').checked };
        }).filter(i => i.descricao || i.valor_cents);
      }
      if (f.querySelector('[name="dest"]')) {
        if (["reuniao", "ata", "email"].includes(a.tipo)) d.destinatarios = dests; else d.destinatario = dests[0] || "";
        if (dests.length) d.ambiguos = [];
      }
      a.editada = true; if (a.status === "sugerida") a.status = "rascunho";
    }
    function conexoesHtml() {
      if (!P.conexoes) return `<p class="ac-dica">Verificando integrações…</p>`;
      return `<ul class="ac-con">${ROTULO_CONEXAO.map(([k, n]) => `<li class="${P.conexoes[k] ? "on" : "off"}" title="${P.conexoes[k] ? "Conectado" : "Não conectado: fica como rascunho"}">${esc(n)}</li>`).join("")}</ul>`;
    }
    function pendenciasHtml() {
      const docs = P.acoes.filter(a => a.tipo === "documentos" && a.status === "concluida");
      const srv = P.pendencias && P.pendencias.documentos || [];
      const linhas = srv.length ? srv.map(d => `<li>${esc(d.name || d.email)}: ${d.items.map(i => esc(i.nome) + (i.status === "recebido" ? " ✓" : " (pendente)")).join(", ")}</li>`)
        : docs.map(a => `<li>${esc(a.dados.nome || a.dados.destinatario)}: ${(a.pendentes || a.dados.itens || []).map(i => esc(i) + " (pendente)").join(", ")}</li>`);
      const tarefas = (P.pendencias && P.pendencias.tarefas || []).filter(t => t.status === "open").map(t => `<li>${esc(t.title)}${t.owner_name ? " · " + esc(t.owner_name) : ""}${t.due_date ? " · até " + esc(A().dataLegivel(t.due_date)) : ""}</li>`);
      if (!linhas.length && !tarefas.length) return "";
      return `<section class="ac-sec"><h4>Pendências</h4><ul class="ac-lista">${linhas.join("")}${tarefas.join("")}</ul>${!demo() ? `<button type="button" class="ac-link" data-ac="atualizar">Atualizar</button>` : ""}</section>`;
    }
    function desenhar(forcar) {
      const b = box(); if (!b) return;
      // atualização em segundo plano espera o organizador terminar de editar (não apaga o que está sendo digitado)
      const foco = document.activeElement, digitando = b.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName);
      if (!forcar && (P.editando || digitando)) { P.sujo = true; return; }
      P.sujo = false;
      if (!b._ligado) { b._ligado = true; b.addEventListener("focusout", () => setTimeout(() => { if (P.sujo && !P.editando && !b.contains(document.activeElement)) desenhar(); }, 50)); }
      const ORDEM = ["proposta", "documentos", "reuniao", "remarcar", "cobranca", "contrato", "tarefa", "ata", "email", "crm"];
      const abertas = P.acoes.filter(a => !["concluida", "descartada"].includes(a.status)).sort((x, y) => ORDEM.indexOf(x.tipo) - ORDEM.indexOf(y.tipo));
      const feitas = P.acoes.filter(a => a.status === "concluida").slice(-12).reverse();
      const motor = demo() ? "Simulação: nada sai da sala" : P.iaServidor ? "IA: Endeavor (HUB) + leitura local" : "Leitura local (IA do servidor desligada)";
      const ext = P.contatos.filter(c => !c.organizador);
      b.innerHTML = `
        <div class="ac-topo">
          <div class="ac-estado ${P.ativa ? (P.pausada ? "pausada" : "on") : ""}"><i aria-hidden="true"></i><span>${P.ativa ? (P.pausada ? "IA pausada" : "IA acompanhando") : "IA desligada"}</span></div>
          ${P.ativa ? `<button type="button" data-ac="${P.pausada ? "retomar" : "pausar"}">${P.pausada ? "Retomar" : "Pausar"}</button><button type="button" data-ac="desligar" class="ac-link">Desligar</button>` : `<button type="button" data-ac="ligar" class="ac-prim">Ligar a IA nesta reunião</button>`}
        </div>
        <p class="ac-motor">${esc(motor)}. ${P.ativa ? "Todos na sala veem que a IA está acompanhando." : "Ao ligar, todos veem o aviso e as legendas passam a registrar a conversa."}</p>
        <form class="ac-cmd" id="acCmd"><input id="acCmdTxt" placeholder="Comando: prepara a proposta, envia a ata…" aria-label="Comando para a IA" autocomplete="off"><button type="submit">Pedir</button></form>
        <section class="ac-sec"><h4>Destinatários <small>(e-mails da conversa)</small></h4>
          ${ext.length ? `<ul class="ac-contatos">${ext.map(c => `<li><label><input type="checkbox" data-confirma="${esc(c.email)}" ${c.confirmado ? "checked" : ""}> ${esc(c.nome ? c.nome + " · " : "")}${esc(c.email)}</label>${c.confirmado ? "" : '<em>confirme antes de enviar</em>'}</li>`).join("")}</ul>` : `<p class="ac-dica">Ainda não há e-mails. Peça para o participante escrever o e-mail no chat.</p>`}
          <form class="ac-add" id="acAdd"><input type="email" id="acAddEmail" placeholder="adicionar e-mail" aria-label="Adicionar e-mail"><button type="submit">Adicionar</button></form>
        </section>
        <section class="ac-sec"><h4>Ações ${abertas.length ? `<small>(${abertas.length})</small>` : ""}</h4>
          ${abertas.length ? abertas.map(cartao).join("") : `<p class="ac-dica">${P.ativa ? "Nada para fazer ainda. As sugestões aparecem conforme a conversa." : "Ligue a IA ou dê um comando."}</p>`}
          <div class="ac-novas"><span>Nova:</span>${["proposta", "documentos", "reuniao", "tarefa", "cobranca", "contrato", "crm"].map(t => `<button type="button" class="ac-link" data-nova="${t}">${esc(A().TIPOS[t].nome)}</button>`).join("")}</div>
        </section>
        ${P.decisoes.length ? `<section class="ac-sec"><h4>Decisões</h4><ul class="ac-lista">${P.decisoes.map(d => `<li>${esc(d)}</li>`).join("")}</ul></section>` : ""}
        ${pendenciasHtml()}
        <section class="ac-sec"><button type="button" class="ac-prim ac-ata" data-ac="ata">Gerar ata</button></section>
        ${feitas.length ? `<section class="ac-sec"><h4>Feitas</h4>${feitas.map(cartao).join("")}</section>` : ""}
        <section class="ac-sec"><h4>Integrações</h4>${conexoesHtml()}${!P.admin && !demo() ? `<p class="ac-dica">Proposta, cobrança e contrato saem só com o acesso da equipe Endeavor (admin).</p>` : ""}</section>
        ${P.log.length ? `<details class="ac-log"><summary>Registro</summary><ul>${P.log.slice(-12).reverse().map(l => `<li>${esc(l.t)}</li>`).join("")}</ul></details>` : ""}`;
      ligarEventos(b);
    }
    function focar(id) { setTimeout(() => { const c = box() && box().querySelector(`.ac-card[data-id="${CSS.escape(id)}"]`); if (c) c.scrollIntoView({ block: "nearest" }); }, 30); }
    function ligarEventos(b) {
      b.querySelector("#acCmd").onsubmit = e => { e.preventDefault(); const t = b.querySelector("#acCmdTxt").value.trim(); if (!t) return; comando(A().ehComando(t) ? t : "IA, " + t, "painel"); };
      b.querySelector("#acAdd").onsubmit = e => { e.preventDefault(); const v = b.querySelector("#acAddEmail").value; if (!adicionarContato(v, "", true)) return toast("E-mail inválido."); registrar("E-mail adicionado pelo organizador: " + v.trim().toLowerCase()); salvar(); desenhar(true); };
      b.querySelectorAll("[data-confirma]").forEach(x => x.onchange = () => { const c = P.contatos.find(k => k.email === x.dataset.confirma); if (c) { c.confirmado = x.checked; registrar((x.checked ? "Destinatário confirmado: " : "Confirmação retirada: ") + c.email); } salvar(); desenhar(true); });
      b.querySelectorAll("[data-nova]").forEach(x => x.onclick = () => { const a = nova(x.dataset.nova); P.editando = a.id; salvar(); desenhar(true); focar(a.id); });
      b.querySelectorAll("form.ac-form").forEach(f => f.onsubmit = e => { e.preventDefault(); const a = P.acoes.find(x => x.id === f.dataset.id); if (a) { lerFormulario(a, f); P.editando = ""; salvar(); desenhar(true); focar(a.id); } });
      b.querySelectorAll("[data-ac]").forEach(x => x.onclick = async ev => {
        const card = x.closest(".ac-card"), id = card && card.dataset.id, a = id && P.acoes.find(k => k.id === id), ac = x.dataset.ac;
        if (ac === "ligar") return ligar(true);
        if (ac === "desligar") return ligar(false);
        if (ac === "pausar") return pausar(true);
        if (ac === "retomar") return pausar(false);
        if (ac === "atualizar") return atualizarPendencias();
        if (ac === "ata") { const t = prepararAta(); P.editando = t.id; salvar(); desenhar(true); return focar(t.id); }
        if (!a) return;
        if (ac === "editar") { P.editando = P.editando === a.id ? "" : a.id; return desenhar(true); }
        if (ac === "descartar") return descartar(a.id);
        if (ac === "regerar") { const f = card.querySelector("form.ac-form"); if (f) lerFormulario(a, f); a.dados.ata = A().gerarAta(estado()); return desenhar(true); }
        if (ac === "mais-item") { const f = card.querySelector("form.ac-form"); lerFormulario(a, f); a.dados.itens = (a.dados.itens || []).concat([{ descricao: "", valor_cents: 0, moeda: "usd" }]); return desenhar(true); }
        if (ac === "reenviar") { a.reenvio = (a.reenvio || 0) + 1; a.status = "rascunho"; a.resultado = null; a.repetido = false; P.editando = a.id; salvar(); return desenhar(true); }
        if (ac === "executar") {
          const f = card.querySelector("form.ac-form"); if (f) lerFormulario(a, f);
          P.editando = ""; ev.preventDefault();
          return executar(a.id, true); // clique em Enviar = comando explícito do organizador
        }
      });
    }

    return {
      linha, comando, desenhar, ligar, pausar,
      estado: () => P,
      aoAbrir() { if (!P.conexoes) carregarConexoes(); if (!demo() && P.ativa) atualizarPendencias(); desenhar(true); },
    };
  }
  window.EMeetAcoesPainel = { criar };
})();
