// Agente de documentos do CRM: regras puras (supabase/docs/regras.ts).
//   deno test --allow-read tests/docs.test.ts
import { arquivoOk, CADENCIA, faltando, followupDevido, nomeArquivo, nomePasta, recebidosDosArquivos, textos } from "../supabase/functions/docs/regras.ts";
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const sim = (c: boolean, m: string) => { if (!c) throw new Error(m); };
const DOCS = ["Passaporte de cada sócio", "Comprovante de endereço", "Visto americano (se houver)"];

Deno.test("arquivos aceitos: PDF, fotos e Word até 25 MB (pelo tipo ou pela extensão)", () => {
  eq(arquivoOk("application/pdf", 1000, "a.pdf").ok, true);
  eq(arquivoOk("", 1000, "foto.HEIC").tipo, "image/heic", "iPhone às vezes manda sem tipo");
  eq(arquivoOk("application/zip", 1000, "a.zip").erro, "tipo");
  eq(arquivoOk("text/html", 10, "x.html").erro, "tipo");
  eq(arquivoOk("image/png", 26 * 1024 * 1024, "a.png").erro, "tamanho");
  eq(arquivoOk("image/png", 0, "a.png").erro, "tamanho");
});

Deno.test("nomes no Drive sem caracteres proibidos; arquivo leva o documento entre colchetes", () => {
  eq(nomePasta("Ana/Souza", "Abertura: LLC", new Date("2026-11-16T12:00:00Z")), "Ana Souza · Abertura LLC · 2026-11-16");
  eq(nomeArquivo("Passaporte", "foto 1.jpg"), "[Passaporte] foto 1.jpg");
});

Deno.test("o que falta e a reconciliação pelos nomes dos arquivos da Initial Docs", () => {
  eq(faltando(DOCS, {}), DOCS);
  const rec = recebidosDosArquivos(DOCS, [{ id: "1", name: "[Passaporte de cada sócio] a.pdf" }, { id: "2", name: "solto.pdf" }, { id: "3", name: "[Outro] x.pdf" }], {});
  eq(Object.keys(rec), ["Passaporte de cada sócio"], "só documentos da lista, pelo prefixo");
  eq(rec["Passaporte de cada sócio"][0].nome, "a.pdf");
  eq(faltando(DOCS, rec), DOCS.slice(1));
  const de_novo = recebidosDosArquivos(DOCS, [{ id: "1", name: "[Passaporte de cada sócio] a.pdf" }], rec);
  eq(de_novo["Passaporte de cada sócio"].length, 1, "não duplica o mesmo arquivo");
});

Deno.test("follow-up nos dias 2, 5, 9, 16 e 23 e depois para", () => {
  eq(CADENCIA, [2, 5, 9, 16, 23]);
  const dia = 86400_000, t0 = Date.parse("2026-11-01T00:00:00Z");
  const p = (dias: number, n: number) => followupDevido({ enviado_at: new Date(t0).toISOString(), followups: n }, t0 + dias * dia);
  eq([p(1, 0), p(2, 0), p(4, 1), p(5, 1), p(9, 2), p(30, 5)], [false, true, false, true, true, false]);
  eq(followupDevido({ enviado_at: null }), false, "sem lista enviada, sem lembrete");
});

Deno.test("e-mails: lista inicial, lembrete com o que falta, reenvio; nos três idiomas, com o aviso de compliance", () => {
  const a = { nome: "ana souza", empresa: "Endeavor Business Hub", modelo: "Abertura de empresa (LLC)", faltam: DOCS.slice(1), todos: DOCS, url: "https://endeavorbiz.com/docs.html?t=x" };
  const l = textos("lista", "pt", a);
  sim(l.subject.includes("Abertura de empresa (LLC)") && l.corpo.paras[0] === "Olá, Ana!", "assunto e saudação");
  eq(l.corpo.lista!.map((i) => i.ok), [true, false, false], "o que já chegou aparece marcado");
  sim(/não recebemos documentos pelo WhatsApp/.test(l.corpo.foot!), "aviso de compliance");
  const lb = textos("lembrete", "en", a);
  sim(lb.subject.startsWith("2 document(s) still missing"), lb.subject);
  sim(textos("reenvio", "es", a).corpo.h1.includes("de nuevo"), "reenvio em espanhol");
});
