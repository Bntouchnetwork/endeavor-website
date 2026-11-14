// Web Meeting: painel de ações. Testa as regras (meet/acoes-core.js, o mesmo arquivo da sala e do servidor)
// com integrações simuladas: o roteiro completo de uma reunião e os casos de erro.
//   deno test --allow-read tests/meet-actions.test.ts
import "../meet/acoes-core.js";
// deno-lint-ignore no-explicit-any
const A = (globalThis as any).EMeetAcoes;
// deno-lint-ignore no-explicit-any
type Any = any;

function assert(c: unknown, msg: string) { if (!c) throw new Error("Falhou: " + msg); }
function eq(a: unknown, b: unknown, msg: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Falhou: ${msg}\n  esperado ${JSON.stringify(b)}\n  veio     ${JSON.stringify(a)}`); }

/** Integrações simuladas: guardam o que foi feito; dá para desligar ou fazer falhar cada uma. */
function simuladas(op: { falharEmail?: number; ocupado?: string[] } = {}) {
  const log: Any[] = [], reg = new Map<string, Any>();
  let falhas = op.falharEmail || 0, n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const integ = {
    registro: { obter: async (k: string) => reg.get(k) || null, salvar: async (k: string, v: Any) => { reg.set(k, v); } },
    email: { enviar: async (m: Any) => { if (falhas > 0) { falhas--; throw new Error("SMTP recusou a conexão."); } log.push({ tipo: "email", ...m }); } },
    proposta: { criar: async (p: Any) => { const x = { id: id("prop"), ...p }; log.push({ tipo: "proposta.criar", ...x }); return x; }, enviar: async (i: string) => { log.push({ tipo: "proposta.enviar", id: i }); return {}; } },
    cobranca: { criar: async (c: Any) => { const x = { id: id("inv") }; log.push({ tipo: "cobranca.criar", ...c, ...x }); return x; }, enviar: async (i: string) => { log.push({ tipo: "cobranca.enviar", id: i }); return {}; } },
    contrato: { enviar: async (c: Any) => { const x = { id: id("env") }; log.push({ tipo: "contrato", ...c, ...x }); return x; } },
    documentos: { solicitar: async (p: Any) => { const x = { id: id("doc"), link: "https://endeavorbiz.com/enviar-documentos.html?t=x" }; log.push({ tipo: "documentos", ...p, ...x }); return x; } },
    agenda: {
      livre: async (q: Any) => (op.ocupado || []).includes(q.data + " " + q.hora) && !q.ignorar ? { ok: false, sugestoes: [{ data: q.data, hora: "11:00" }] } : { ok: true },
      criar: async (q: Any) => { const x = { id: id("sala"), link: "https://endeavorbiz.com/reuniao.html?s=eb-x" }; log.push({ tipo: "agenda.criar", ...q, ...x }); return x; },
      remarcar: async (q: Any) => { log.push({ tipo: "agenda.remarcar", ...q }); return { id: q.id, avisados: ["carlos@acme.com"] }; },
    },
    tarefas: { criar: async (t: Any) => { const x = { id: id("task") }; log.push({ tipo: "tarefa", ...t, ...x }); return x; } },
    crm: { disponivel: true, registrar: async (c: Any) => { log.push({ tipo: "crm", ...c }); return { id: id("crm"), criado: true }; } },
    ata: { salvar: async (a: Any) => { log.push({ tipo: "ata.salvar", titulo: a.titulo }); } },
  };
  return { integ, log, reg };
}
const TODAS = { email: true, proposta: true, cobranca: true, assinatura: true, documentos: true, agenda: true, tarefas: true, crm: true };
const AGORA = new Date(2026, 10, 16, 10, 0); // segunda-feira, 16/11/2026 10:00
const ORG = { papel: "anfitriao", admin: true, conexoes: TODAS };

function conversa() {
  return [
    { id: "c1", nome: "Carlos Lima", via: "chat", texto: "Meu e-mail é carlos@acme.com" },
    { id: "f1", nome: "Carlos Lima", texto: "Queremos abrir a LLC e precisamos da contabilidade mensal." },
    { id: "f2", nome: "Ana Souza", anfitriao: true, texto: "A abertura de LLC fica por US$ 1.500 e a contabilidade sai por US$ 300 por mês." },
    { id: "f3", nome: "Carlos Lima", texto: "Fechado, vamos com os dois serviços." },
    { id: "f4", nome: "Ana Souza", anfitriao: true, texto: "Vou te mandar a proposta hoje. Também preciso do passaporte e do comprovante de endereço até sexta." },
    { id: "f5", nome: "Ana Souza", anfitriao: true, texto: "Vamos marcar uma reunião na quinta às 10h para revisar os documentos." },
  ];
}
function estado(linhas = conversa()) {
  return { titulo: "Abertura ACME", agora: AGORA, participantes: [{ nome: "Ana Souza", papel: "mentor" }, { nome: "Carlos Lima", papel: "aluno" }], linhas, contatos: [] as Any[], acoes: [] as Any[] };
}
const confirmar = (contatos: Any[], email: string) => contatos.map((c) => c.email === email ? { ...c, confirmado: true } : c);
const pega = (acoes: Any[], tipo: string) => acoes.find((a) => a.tipo === tipo);

Deno.test("roteiro completo da reunião", async () => {
  const st = estado(), { integ, log } = simuladas();
  // 1. a IA lê a conversa
  const an = A.sugerir(st);
  st.contatos = an.contatos; st.acoes = A.mesclarAcoes([], an.sugestoes);
  eq(st.contatos.map((c: Any) => c.email), ["carlos@acme.com"], "e-mail informado no chat");
  eq(an.decisoes.map((d: Any) => d.resumo), ["Fechado, vamos com os dois serviços."], "decisão");
  const prop = pega(st.acoes, "proposta");
  eq(prop.dados.itens.map((i: Any) => [i.descricao, i.valor_cents, i.mensal]), [["Abertura de LLC", 150000, false], ["Contabilidade", 30000, true]], "serviços e valores da conversa");
  eq(prop.dados.destinatario, "carlos@acme.com", "destinatário da proposta");
  eq(prop.dados.cliente_nome, "Carlos Lima", "cliente");
  // 2. sem confirmar o destinatário, não envia
  let r = await A.executar(prop, { ...ORG, contatos: st.contatos, comando: true }, integ);
  eq(r.status, "rascunho", "proposta fica rascunho sem confirmação"); assert(r.faltando.includes("confirmar o destinatário"), "pede confirmação");
  // 3. o organizador confirma e manda enviar
  st.contatos = confirmar(st.contatos, "carlos@acme.com");
  r = await A.executar(prop, { ...ORG, contatos: st.contatos, comando: false }, integ);
  eq(r.codigo, "sem_comando", "sem comando explícito não executa");
  const cmd = A.interpretarComando("IA, envia a proposta para o Carlos", { agora: AGORA });
  eq([cmd.tipo, cmd.executar], ["proposta", true], "comando de enviar a proposta");
  r = await A.executar(prop, { ...ORG, contatos: st.contatos, comando: cmd.executar }, integ);
  eq(r.status, "concluida", "proposta enviada");
  eq(log.filter((x) => x.tipo.startsWith("proposta")).map((x) => x.tipo), ["proposta.criar", "proposta.enviar"], "proposta criada e enviada");
  eq(log.find((x) => x.tipo === "proposta.criar").itens.length, 2, "proposta só com os serviços falados");
  // 4. solicita os documentos e cria a tarefa
  const docs = pega(st.acoes, "documentos");
  eq(docs.dados.itens, ["Passaporte", "Comprovante de endereço"], "documentos citados");
  r = await A.executar(docs, { ...ORG, contatos: st.contatos, comando: A.interpretarComando("IA, solicita os documentos", {}).executar }, integ);
  eq(r.status, "concluida", "pedido de documentos enviado"); eq(r.resultado.pendentes, ["Passaporte", "Comprovante de endereço"], "documentos pendentes acompanhados");
  const tarefa = st.acoes.find((a: Any) => a.tipo === "tarefa" && /proposta/.test(a.dados.titulo));
  eq([tarefa.dados.responsavel, tarefa.dados.prazo], ["Ana Souza", "2026-11-16"], "compromisso com responsável e prazo");
  r = await A.executar(tarefa, { ...ORG, contatos: st.contatos, comando: true }, integ);
  eq(r.status, "concluida", "tarefa criada"); assert(r.resultado.crm && !r.resultado.crm.erro, "CRM atualizado junto com a tarefa");
  // 5. agenda a reunião e depois remarca
  const reu = pega(st.acoes, "reuniao");
  eq([reu.dados.data, reu.dados.hora], ["2026-11-19", "10:00"], "quinta às 10h");
  r = await A.executar(reu, { ...ORG, contatos: st.contatos, comando: true }, integ);
  eq(r.status, "concluida", "reunião agendada"); eq(r.resultado.enviado_para, ["carlos@acme.com"], "convite para o cliente");
  const rem = A.interpretarComando("IA, remarca para sexta às 15h", { agora: AGORA });
  const remarcar = { id: "rm1", tipo: "remarcar", dados: { reuniao_id: r.resultado.reuniao_id, data: rem.data, hora: rem.hora } };
  const r2 = await A.executar(remarcar, { ...ORG, contatos: st.contatos, comando: rem.executar }, integ);
  eq(r2.status, "concluida", "reunião remarcada"); eq(log.find((x) => x.tipo === "agenda.remarcar").hora, "15:00", "novo horário");
  // 6. ata para os destinatários confirmados
  st.acoes = st.acoes.map((a: Any) => a.id === prop.id ? { ...a, status: "concluida", resultado: { enviado_para: ["carlos@acme.com"] } } : a.id === docs.id ? { ...a, status: "concluida", resultado: { pendentes: ["Passaporte", "Comprovante de endereço"] } } : a.id === tarefa.id ? { ...a, status: "concluida" } : a);
  const ata = A.gerarAta(st);
  eq(ata.participantes.map((p: Any) => p.papel), ["Organizador", "Participante"], "participantes na ata");
  assert(ata.decisoes.length === 1 && ata.tarefas.some((t: Any) => t.responsavel === "Ana Souza"), "decisões e tarefas na ata");
  assert(ata.pendencias.some((p: string) => /Passaporte/.test(p)), "pendências de documentos na ata");
  const enviarAta = { id: "ata1", tipo: "ata", dados: { destinatarios: ["carlos@acme.com"], ata } };
  r = await A.executar(enviarAta, { ...ORG, contatos: st.contatos, comando: true }, integ);
  eq(r.status, "concluida", "ata enviada");
  eq(log.filter((x) => x.tipo === "email" && /^Ata/.test(x.assunto)).map((x) => x.para), [["carlos@acme.com"]], "ata só para os confirmados");
});

Deno.test("destinatário ambíguo: dois e-mails no chat", async () => {
  const linhas = [...conversa(), { id: "c2", nome: "Maria Beta", via: "chat", texto: "o meu é maria@beta.com" }];
  const st = estado(linhas), { integ, log } = simuladas();
  const an = A.sugerir(st);
  const prop = pega(an.sugestoes, "proposta");
  eq(prop.dados.destinatario, "", "não escolhe sozinho"); eq(prop.dados.ambiguos, ["carlos@acme.com", "maria@beta.com"], "lista os candidatos");
  const contatos = an.contatos.map((c: Any) => ({ ...c, confirmado: true }));
  const r = await A.executar(prop, { ...ORG, contatos, comando: true }, integ);
  eq(r.status, "rascunho", "fica rascunho"); assert(r.faltando.some((f: string) => /destinat/.test(f)), "pede para escolher o destinatário");
  eq(log.length, 0, "nada enviado");
  // o comando com o nome resolve
  eq(A.resolverDestinatario("envia a proposta para a Maria", contatos).emails, ["maria@beta.com"], "nome no comando escolhe o e-mail");
});

Deno.test("informação ausente: sem valores não há proposta; reunião sem horário fica rascunho", async () => {
  const st = estado([{ id: "c1", nome: "Carlos", via: "chat", texto: "carlos@acme.com" }, { id: "f1", nome: "Ana", anfitriao: true, texto: "Vamos marcar uma reunião na quinta para revisar." }]);
  const an = A.sugerir(st), { integ } = simuladas();
  assert(!pega(an.sugestoes, "proposta"), "nenhuma proposta sem serviços e valores");
  const reu = pega(an.sugestoes, "reuniao");
  const r = await A.executar(reu, { ...ORG, contatos: confirmar(an.contatos, "carlos@acme.com"), comando: true }, integ);
  eq(r.status, "rascunho", "rascunho"); eq(r.faltando, ["horário"], "falta só o horário");
  // proposta feita à mão sem cliente
  const r2 = await A.executar({ id: "p", tipo: "proposta", dados: { destinatario: "carlos@acme.com", itens: [] } }, { ...ORG, contatos: confirmar(an.contatos, "carlos@acme.com"), comando: true }, integ);
  eq(r2.faltando, ["nome do cliente", "serviços com valor"], "lista o que falta na proposta");
});

Deno.test("falta de permissão: convidado e empresa sem admin", async () => {
  const { integ, log } = simuladas();
  const acao = { id: "p", tipo: "proposta", dados: { destinatario: "carlos@acme.com", cliente_nome: "Carlos", itens: [{ descricao: "Abertura", valor_cents: 150000 }] } };
  const contatos = [{ email: "carlos@acme.com", confirmado: true }];
  let r = await A.executar(acao, { papel: "convidado", admin: false, conexoes: TODAS, contatos, comando: true }, integ);
  eq([r.status, r.codigo], ["bloqueada", "sem_permissao"], "convidado não executa");
  r = await A.executar(acao, { papel: "anfitriao", admin: false, conexoes: TODAS, contatos, comando: true }, integ);
  eq(r.codigo, "sem_permissao", "proposta exige admin da Endeavor");
  const cob = { id: "c", tipo: "cobranca", dados: { destinatario: "carlos@acme.com", cliente_nome: "Carlos", itens: [{ descricao: "Abertura", valor_cents: 150000 }], vencimento_dias: 7 } };
  r = await A.executar(cob, { ...ORG, contatos, comando: true }, integ);
  eq(r.status, "rascunho", "cobrança sem aprovação não sai"); assert(r.faltando.includes("aprovação da cobrança"), "pede aprovação");
  r = await A.executar({ ...cob, dados: { ...cob.dados, aprovada: true } }, { ...ORG, contatos, comando: true }, integ);
  eq(r.status, "concluida", "cobrança aprovada sai");
  eq(log.map((x) => x.tipo), ["cobranca.criar", "cobranca.enviar"], "só a cobrança aprovada foi feita");
  // comando de convidado pelo chat: a sala trata como sem permissão (papel convidado)
  assert(A.ehComando("IA, envia a proposta"), "reconhece o comando");
});

Deno.test("integração desconectada: rascunho preservado", async () => {
  const { integ, log } = simuladas();
  const contatos = [{ email: "carlos@acme.com", confirmado: true }];
  const acao = { id: "d", tipo: "documentos", dados: { destinatario: "carlos@acme.com", itens: ["Passaporte"] } };
  const r = await A.executar(acao, { ...ORG, conexoes: { ...TODAS, email: false }, contatos, comando: true }, integ);
  eq([r.status, r.codigo], ["bloqueada", "desconectada"], "sem e-mail não envia o link");
  eq(r.dados, acao.dados, "dados mantidos");
  const r2 = await A.executar({ id: "c", tipo: "contrato", dados: { destinatario: "carlos@acme.com", cliente_nome: "Carlos", itens: [{ descricao: "Abertura", valor_cents: 1 }], inicio: "2026-12-01", aprovada: true } }, { ...ORG, conexoes: { ...TODAS, assinatura: false }, contatos, comando: true }, integ);
  eq(r2.codigo, "desconectada", "assinatura desconectada"); assert(/assinatura/.test(r2.aviso), "explica qual conexão falta");
  eq(log.length, 0, "nada enviado");
});

Deno.test("falha de envio: marca como falhou e permite tentar de novo", async () => {
  const { integ, log } = simuladas({ falharEmail: 1 });
  const contatos = [{ email: "carlos@acme.com", confirmado: true }];
  const ata = A.gerarAta(estado());
  const acao = { id: "a", tipo: "ata", dados: { destinatarios: ["carlos@acme.com"], ata } };
  let r = await A.executar(acao, { ...ORG, contatos, comando: true }, integ);
  eq(r.status, "falhou", "falhou"); assert(/SMTP/.test(r.erro), "mostra o erro");
  r = await A.executar(acao, { ...ORG, contatos, comando: true }, integ);
  eq(r.status, "concluida", "segunda tentativa envia"); eq(log.filter((x) => x.tipo === "email").length, 1, "um envio");
});

Deno.test("comando repetido: não envia duas vezes", async () => {
  const { integ, log } = simuladas();
  const contatos = [{ email: "carlos@acme.com", confirmado: true }];
  const acao = { id: "d", tipo: "documentos", dados: { destinatario: "carlos@acme.com", itens: ["Passaporte"] } };
  const r1 = await A.executar(acao, { ...ORG, contatos, comando: true }, integ);
  const r2 = await A.executar({ ...acao, id: "d2" }, { ...ORG, contatos, comando: true }, integ);
  eq([r1.status, r2.status, r2.repetido], ["concluida", "concluida", true], "segunda vez reconhece a repetição");
  eq(log.filter((x) => x.tipo === "documentos").length, 1, "só um pedido enviado");
  const r3 = await A.executar({ ...acao, reenvio: 1 }, { ...ORG, contatos, comando: true }, integ);
  eq(r3.repetido, undefined, "reenvio pedido de propósito gera nova chave");
});

Deno.test("agenda ocupada: sugere horários livres", async () => {
  const { integ } = simuladas({ ocupado: ["2026-11-19 10:00"] });
  const contatos = [{ email: "carlos@acme.com", confirmado: true }];
  const r = await A.executar({ id: "r", tipo: "reuniao", dados: { titulo: "Revisão", data: "2026-11-19", hora: "10:00", destinatarios: ["carlos@acme.com"] } }, { ...ORG, contatos, comando: true }, integ);
  eq(r.status, "falhou", "não agenda em cima de outra"); assert(/Livres/.test(r.erro), "sugere horário livre");
});

Deno.test("não inventa: e-mails e valores fora da conversa são removidos; números sensíveis não são pedidos", () => {
  const linhas = conversa();
  const vinda = { id: "x", tipo: "proposta", dados: { destinatario: "outro@site.com", itens: [{ descricao: "Abertura de LLC", valor_cents: 150000 }, { descricao: "Bônus", valor_cents: 99900 }] } };
  const c = A.conferirComFonte(vinda, linhas);
  eq(c.acao.dados.destinatario, "", "e-mail inventado removido");
  eq(c.acao.dados.itens.map((i: Any) => i.valor_cents), [150000], "valor inventado removido");
  const st = estado([{ id: "c1", nome: "Carlos", via: "chat", texto: "carlos@acme.com" }, { id: "f1", nome: "Ana", anfitriao: true, texto: "Preciso do passaporte e do número do SSN." }]);
  const docs = pega(A.sugerir(st).sugestoes, "documentos");
  eq(docs.dados.itens, ["Passaporte"], "pede só o arquivo"); assert(/números sensíveis/.test(docs.motivo), "avisa");
  assert(A.faltando({ tipo: "documentos", dados: { destinatario: "carlos@acme.com", itens: ["Número do SSN"] } }, [{ email: "carlos@acme.com", confirmado: true }]).some((f: string) => /números/.test(f)), "bloqueia pedido de número");
});

Deno.test("comandos por voz ou chat", () => {
  const c = (t: string) => A.interpretarComando(t, { agora: AGORA });
  eq(c("Assistente, prepara a proposta").executar, false, "preparar não envia");
  eq(c("/ata").tipo, "ata", "atalho no chat");
  eq(c("IA, pausa").intencao, "pausar", "pausar"); eq(c("IA, continua").intencao, "retomar", "retomar");
  eq(c("vamos enviar a proposta") , null, "fala comum não é comando");
  eq([c("IA, envia a ata para carlos@acme.com").emails, c("IA, envia a ata para carlos@acme.com").executar], [["carlos@acme.com"], true], "e-mail citado no comando");
  eq(c("IA, não envia a proposta ainda").executar, false, "negação não executa");
});

Deno.test("arquivo do servidor é o mesmo da sala", async () => {
  const a = await Deno.readTextFile(new URL("../meet/acoes-core.js", import.meta.url));
  // no repositório a função fica em supabase/functions/meet; na cópia de trabalho, em supabase/meet
  const b = await Deno.readTextFile(new URL("../supabase/functions/meet/acoes-core.js", import.meta.url)).catch(() => Deno.readTextFile(new URL("../supabase/meet/acoes-core.js", import.meta.url)));
  assert(a === b, "supabase/meet/acoes-core.js precisa ser cópia de meet/acoes-core.js");
});
