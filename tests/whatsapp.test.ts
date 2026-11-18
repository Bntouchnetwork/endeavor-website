// My WhatsApp Manager: regras compartilhadas (wa-extension/core.js) e regras do servidor (supabase/whatsapp/regras.ts).
//   deno test --allow-read tests/whatsapp.test.ts
import "../wa-extension/core.js";
import { aceitouPrivado, foneDoAutor, tipoDoPost, avisoComIA, conteudoDevido, dentroJanela, grupoCfg, limparAuto, limparConfig, parecido, proximoDepoisDoEnvio, proximoHorario, reclamacao, montarEntrada, normalizar, padraoConfig, prontoParaCRM, violaProtecao } from "../supabase/functions/whatsapp/regras.ts";
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
  eq([a.velocidade, a.pausa_min, a.limite_hora, a.takeover], [400, 0, 120, false]);
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

Deno.test("proteção fixa: resposta com valor não sai", () => {
  for (const t of ["A abertura custa $499.", "O valor é de 300 dólares", "Fica US$ 1.200 por ano", "The fee is 250 USD", "Custa uns 500 reais", "price is $99"]) sim(!!violaProtecao(t), "deveria barrar: " + t);
  for (const t of ["Os valores vão na proposta por e-mail.", "Leva de 3 a 5 dias úteis.", "Temos horário às 10:00 de terça.", "Somos de Orlando, FL 32801."]) eq(violaProtecao(t), "", "não deveria barrar: " + t);
});

Deno.test("proteção fixa: pedir documento ou dado bancário não sai; avisar para NÃO mandar pode", () => {
  for (const t of ["Me envia uma foto do passaporte, por favor.", "Pode me mandar o número da conta?", "Please send me your SSN", "Qual é o seu número do passaporte?", "Anexe o comprovante de endereço aqui."]) sim(!!violaProtecao(t), "deveria barrar: " + t);
  for (const t of ["Por compliance, não mande documentos nem o passaporte pelo WhatsApp: vou enviar por e-mail a lista e um link seguro.", "Please don't send your passport here.", "Vou te mandar por e-mail a lista de documentos."]) eq(violaProtecao(t), "", "não deveria barrar: " + t);
});

Deno.test("configuração padrão: fluxo de documentos (compliance → CRM) e de proposta, com regras ligadas aos fluxos", () => {
  const c = padraoConfig(true);
  const doc = c.fluxos.find((f: any) => f.id === "documentos");
  eq(doc.passos.map((p: any) => p.tipo), ["mensagem", "coletar", "crm_documentos", "mensagem"]);
  eq(doc.passos[1].campos, ["nome", "email", "tipo_caso"]);
  eq(c.regras.find((r: any) => r.id === "preco").fluxo, "proposta");
  sim(c.modelos.every((m: any) => m.subpastas[0] === "Initial Docs"), "Initial Docs sempre presente");
  eq(padraoConfig(false).perfil.servicos, "", "cliente começa com o perfil vazio");
});

Deno.test("configuração: limites, ids únicos, regra apontando para fluxo inexistente vira responder, Initial Docs obrigatória", () => {
  const c = limparConfig({
    regras: [{ id: "x", nome: "A", quando: "q", acao: "fluxo", fluxo: "nao-existe" }, { id: "x", nome: "B", quando: "q2", acao: "hackear" }, { nome: "", quando: "sem nome" }],
    fluxos: [{ id: "f", nome: "F", gatilho: "g", passos: [{ tipo: "rm -rf", texto: "t" }, { tipo: "coletar", campos: ["nome", "senha"], texto: "c" }] }],
    modelos: [{ nome: "M", subpastas: ["Docs/Fiscais", "Outros"] }],
  });
  eq(c.regras.map((r: any) => [r.id, r.acao]), [["x", "responder"], ["x-1", "responder"]]);
  eq(c.fluxos[0].passos.map((p: any) => p.tipo), ["mensagem", "coletar"]);
  eq(c.fluxos[0].passos[1].campos, ["nome"], "campo desconhecido sai");
  eq(c.modelos[0].subpastas, ["Initial Docs", "Docs-Fiscais", "Outros"]);
});

Deno.test("fluxo vai para o CRM só com os dados completos e o passo de CRM", () => {
  const doc = padraoConfig(true).fluxos.find((f: any) => f.id === "documentos");
  eq(prontoParaCRM(doc, { nome: "Ana Souza", email: "" }).falta, ["email"]);
  eq(prontoParaCRM(doc, { nome: "Ana Souza", email: "ana@x.com" }), { ok: true, falta: [], tipo: "documentos" });
  eq(prontoParaCRM({ passos: [{ tipo: "mensagem" }] }, { nome: "Ana", email: "a@x.com" }).ok, false, "sem passo de CRM");
});

Deno.test("resposta do Takeover com fluxo: só fluxos ativos e modelos existentes", () => {
  const cfg = padraoConfig(true);
  const r = normalizar("responder", { responder: true, texto: "Oi", fluxo: { id: "documentos", dados: { nome: "Ana", email: "ANA@X.COM", tipo_caso: "abertura-llc" }, pronto: true } }, cfg);
  eq(r.fluxo, { id: "documentos", dados: { nome: "Ana", email: "ana@x.com", telefone: "", tipo_caso: "abertura-llc" }, pronto: true, reenviar: false });
  eq(normalizar("responder", { responder: true, texto: "Oi", fluxo: { id: "inventado" } }, cfg).fluxo, null);
  eq(normalizar("responder", { responder: true, texto: "Oi", fluxo: { id: "documentos", dados: { email: "x", tipo_caso: "lua" } } }, cfg).fluxo.dados, { nome: "", email: "", telefone: "", tipo_caso: "" });
});

Deno.test("entrada da IA leva perfil, regras, fluxos, modelos e as proteções fixas", () => {
  const cfg = padraoConfig(true);
  const e = montarEntrada("responder", C.limparAjustes({}), { nome: "Ana", grupo: false }, [{ eu: false, texto: "me manda a lista" }], { cfg, empresa: "Endeavor", fluxo_atual: { id: "documentos", dados: { nome: "Ana" } } });
  for (const t of ["<regras_da_empresa>", "[documentos] Pedido de documentos", "<modelos_documentos>", "[abertura-llc]", "<protecoes_fixas>", "Nunca informar preços", "<fluxo_atual>"]) sim(e.includes(t), "faltou " + t);
});

Deno.test("sugestões da IA de regras e fluxos passam pelos mesmos limites", () => {
  const r = normalizar("sugerir_regras", { regras: [{ nome: "Prazo", quando: "perguntarem prazo", fazer: "explique", acao: "fluxo", fluxo: "x" }, { nome: "", quando: "" }] });
  eq(r.regras.length, 1); eq(r.regras[0].acao, "responder");
  const f = normalizar("sugerir_fluxos", { fluxos: [{ nome: "Pós-venda", gatilho: "cliente novo", passos: [{ tipo: "mensagem", texto: "boas-vindas" }, { tipo: "avisar_equipe", texto: "" }] }] });
  eq(f.fluxos[0].passos.map((p: any) => p.tipo), ["mensagem", "avisar_equipe"]);
});

Deno.test("aviso da primeira resposta sempre diz que é assistente virtual (nome personalizado pode)", () => {
  eq(avisoComIA("Olá! Aqui a Majorie do support Endeavor."), "Olá! Aqui a Majorie do support Endeavor, assistente virtual.");
  eq(avisoComIA("Olá! Aqui é o assistente virtual da Endeavor."), "Olá! Aqui é o assistente virtual da Endeavor.");
  eq(avisoComIA("Hi! This is Majorie from Endeavor", "en-US"), "Hi! This is Majorie from Endeavor, virtual assistant.");
  eq(avisoComIA(""), "assistente virtual.");
});

Deno.test("grupos: ajustes por grupo, interesse e dica da semana", () => {
  const cfg = limparConfig({ grupos: { "120@g.us": { nome: "Empreendedores", modo: "auto", limite_dia: 50, interesse: false, por_semana: 2 }, "x@g.us": { modo: "qualquer" } } });
  eq(cfg.grupos["120@g.us"], { nome: "Empreendedores", modo: "auto", limite_dia: 10, interesse: false, conteudo: true, por_semana: 2, lembrete: false });
  eq(cfg.grupos["x@g.us"].modo, "aprovar", "modo inválido vira aprovar");
  eq(grupoCfg(cfg, "novo@g.us").modo, "aprovar", "grupo sem ajuste: aprovar (a IA sugere, você aprova)");
  const t = Date.parse("2026-11-16T12:00:00Z");
  eq(conteudoDevido(grupoCfg(cfg, "novo@g.us"), 0, t), true, "nunca postou: dica pronta");
  eq(conteudoDevido(grupoCfg(cfg, "novo@g.us"), t - 3 * 86400_000, t), false, "1 por semana: espera 7 dias");
  eq(conteudoDevido(cfg.grupos["120@g.us"], t - 4 * 86400_000, t), true, "2 por semana: a cada 3,5 dias");
  eq(conteudoDevido({ ...cfg.grupos["120@g.us"], modo: "desligado" }, 0, t), false, "grupo desligado: sem dica");
  const r = normalizar("grupo", { relevante: true, responder: true, texto: "Oi", interesse: [{ autor: "João", motivo: "quer abrir LLC", mensagem: "Oi João, vi sua pergunta no grupo." }, { autor: "", mensagem: "x" }] });
  eq(r.interesse.length, 1, "interesse sem autor é descartado");
  eq(normalizar("conteudo_grupo", { texto: "Dica: separe as contas da LLC.", tema: "contas" }).texto, "Dica: separe as contas da LLC.");
  const e = montarEntrada("conteudo_grupo", C.limparAjustes({}), { nome: "Empreendedores", grupo: true }, [], { cfg, empresa: "Endeavor", grupo_cfg: { modo: "aprovar" }, temas_recentes: "contas" });
  eq(e.includes("<temas_recentes>contas") && !e.includes("<mensagens>"), true, "dica: sem conversa, com os temas recentes para não repetir");
});

/* ---------------- mensagens automáticas (lembrete de serviços) ---------------- */
Deno.test("mensagens automáticas: ajustes limpos, desligadas por padrão e no máximo 1 por semana", () => {
  const a = limparAuto({ intervalo_dias: 2, dias: [1, 9, 1, 3], inicio: "18:00", fim: "09:00", tz: "Europe/Paris", ativo: "sim" });
  eq(a.ativo, false);
  eq(a.intervalo_dias, 7);
  eq(a.dias, [1, 3]);
  eq([a.inicio, a.fim], ["10:00", "17:00"]); // fim antes do início: volta ao padrão
  eq(a.tz, "America/New_York");
  eq(limparAuto({ intervalo_dias: 30 }).intervalo_dias, 30);
  const cfg = limparConfig({ grupos: { "g1@g.us": { nome: "G1", lembrete: true } }, auto: { ativo: true } });
  eq(cfg.grupos["g1@g.us"].lembrete, true);
  eq(cfg.auto.ativo, true);
  eq(limparConfig({}).auto.ativo, false);
});
Deno.test("mensagens automáticas: horário sorteado dentro dos dias e horas permitidos (fuso de Nova York)", () => {
  const a = limparAuto({ ativo: true, dias: [2], inicio: "10:00", fim: "12:00", tz: "America/New_York" }); // só terça
  const seg = Date.UTC(2026, 10, 16, 15, 0); // segunda 16/11/2026 10:00 em NY
  for (const sorte of [0, 0.5, 0.999]) {
    const p = proximoHorario(a, seg, () => sorte);
    const d = new Date(p);
    eq(d.getUTCDay(), 2);
    sim(d.getUTCHours() >= 15 && d.getUTCHours() < 17, "entre 10h e 12h em NY (15h–17h UTC no inverno)");
    sim(dentroJanela(a, p), "falhou");
  }
  sim(!dentroJanela(a, seg), "falhou");
  // horário de verão: 10h em NY = 14h UTC em julho
  const v = proximoHorario(a, Date.UTC(2026, 6, 13, 12, 0), () => 0);
  eq(new Date(v).getUTCHours(), 14);
  // depois de postar: nunca antes de ~1 semana
  const depois = proximoDepoisDoEnvio(a, Date.UTC(2026, 10, 17, 15, 30), () => 0.5);
  sim(depois - Date.UTC(2026, 10, 17, 15, 30) >= 6.5 * 86400_000, "falhou");
  eq(proximoHorario(limparAuto({ dias: [] }), seg), 0);
});
Deno.test("mensagens automáticas: reclamação de divulgação para os envios", () => {
  const m = (texto: string, eu = false, extra = {}) => ({ eu, autor: eu ? "" : "Ana", texto, ...extra });
  sim(!!reclamacao([m("Olá, somos a Endeavor…", true), m("Aqui não é lugar para propaganda")]), "falhou");
  sim(!!reclamacao([m("Por favor parem de divulgar serviços aqui")]), "falhou");
  sim(!!reclamacao([m("Isso é spam", false, { cita_eu: true })]), "falhou");
  eq(reclamacao([m("Alguém sabe abrir LLC?"), m("Bom dia a todos")]), "");
  eq(reclamacao([m("isso é spam?"), m("Nova mensagem nossa", true)]), ""); // antes da nossa última: já foi
});
Deno.test("mensagens automáticas: texto parecido com um já postado é recusado", () => {
  const antes = ["Olá! Somos a Endeavor Business Solutions e ajudamos empreendedores a abrir empresa nos Estados Unidos. Responda aqui ou chame no privado."];
  sim(parecido("Olá! Somos a Endeavor Business Solutions e ajudamos empreendedores a abrir empresa nos Estados Unidos. Chame no privado.", antes), "falhou");
  sim(!parecido("Você sabia que o bookkeeping mensal evita surpresas no imposto da sua LLC? Nossa equipe cuida disso. Quer conversar?", antes), "falhou");
});
Deno.test("mensagens automáticas: saída da IA normalizada e reclamação sem texto", () => {
  eq(normalizar("lembrete", { reclamacao: true, texto: "algo", motivo: "admin pediu" }), { texto: "", tema: "", reclamacao: true, motivo: "admin pediu" });
  eq(normalizar("lembrete", { texto: "Oi, grupo!", tema: "LLC" }).reclamacao, false);
});

Deno.test("mensagens automáticas: tipo de post (dica, lembrete ou alternar com a maioria dicas)", () => {
  eq(limparAuto({}).tipo, "lembrete");
  eq(limparAuto({ tipo: "qualquer" }).tipo, "lembrete");
  const alt = limparAuto({ tipo: "alternar" });
  eq(tipoDoPost(alt, []), "dica");
  eq(tipoDoPost(alt, ["dica"]), "dica");
  eq(tipoDoPost(alt, ["dica", "dica"]), "lembrete");
  eq(tipoDoPost(alt, ["lembrete", "dica"]), "dica");
  eq(tipoDoPost(limparAuto({ tipo: "dica" }), ["dica", "dica"]), "dica");
  eq(tipoDoPost(limparAuto({ tipo: "lembrete" }), []), "lembrete");
});

Deno.test("grupo → privado: aceite reconhecido, telefone do autor e saídas da IA", () => {
  const m = (texto: string, cita_eu = true) => ({ eu: false, autor: "Carlos", texto, cita_eu });
  sim(aceitouPrivado(m("Sim, pode me chamar no privado")), "aceite com citação");
  sim(aceitouPrivado(m("pode sim, me chama no pv")), "pv");
  sim(!aceitouPrivado(m("Sim, pode me chamar no privado", false)), "sem citar a nossa mensagem não conta");
  sim(!aceitouPrivado(m("Quanto tempo demora?")), "pergunta comum");
  eq(foneDoAutor("+1 (407) 555-0100"), "+14075550100");
  eq(foneDoAutor("~ Carlos"), "");
  eq(normalizar("grupo", { privado: { autor: "Carlos", assunto: "LLC" } }).privado, { autor: "Carlos", assunto: "LLC" });
  eq(normalizar("grupo", {}).privado, null);
  eq(normalizar("responder", { responder: true, texto: "Vou marcar.", agendar: { opcao: 2 } }).agendar, 2);
  eq(normalizar("responder", { responder: true, texto: "x", agendar: { opcao: 9 } }).agendar, 0);
  const e = montarEntrada("responder", C.limparAjustes({}), { nome: "Carlos", grupo: false }, [], { origem_grupo: { grupo: "Empreendedores FL", assunto: "LLC", primeira: true } });
  sim(e.includes("<origem_grupo>") && e.includes("Empreendedores FL"), "a IA recebe o grupo de origem");
});
