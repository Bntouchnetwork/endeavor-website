import { htmlToText, officialUrl, plan, quoteInSource, relevant, sameObligation, sig, stale, validate } from "../supabase/functions/crm/deadlines-core.ts";
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const ok = (c: unknown, m = "") => { if (!c) throw new Error(m || "falhou"); };

Deno.test("só aceita páginas de sites oficiais", () => {
  ok(officialUrl("https://www.irs.gov/publications/p509"));
  ok(officialUrl("https://dos.fl.gov/sunbiz/manage-business/efile/annual-report/"));
  ok(officialUrl("https://floridarevenue.com/taxes/taxesfees/Pages/corporate.aspx"));
  ok(officialUrl("https://www.orangecountyfl.net/x") === null, "site que não é .gov fica de fora");
  ok(officialUrl("http://www.irs.gov/x") === null, "sem https");
  ok(officialUrl("https://irs.gov.evil.com/x") === null, "domínio parecido");
  ok(officialUrl("https://127.0.0.1/x") === null && officialUrl("https://www.irs.gov:8443/x") === null && officialUrl("https://www.irs.gov/pub/irs-pdf/p509.pdf") === null);
  ok(officialUrl("javascript:alert(1)") === null && officialUrl("") === null);
});
Deno.test("texto da página e blocos relevantes", () => {
  const t = htmlToText("<html><script>x()</script><h2>Partnerships</h2><p>File Form 1065 by <b>March 16</b>, 2026.</p><p>About us and careers.</p><nav>menu</nav></html>");
  eq(t, "Partnerships\nFile Form 1065 by March 16 , 2026.\nAbout us and careers.");
  eq(relevant(t, ["partnership"], 500), "Partnerships\nFile Form 1065 by March 16 , 2026.");
});
Deno.test("o trecho citado tem de estar na fonte", () => {
  const src = "Partnerships. File a 2025 calendar year return (Form 1065) by March 16, 2026.";
  ok(quoteInSource("file a 2025 calendar year return (Form 1065)", src));
  ok(!quoteInSource("File Form 1065 by April 15, 2026", src), "trecho inventado");
  ok(!quoteInSource("Form 1065", src), "trecho curto demais");
});
Deno.test("mesma obrigação não duplica", () => {
  eq(sig("Form 1065 + K-1 (2025) ou extensão 7004"), ["1065", "k1", "7004"]);
  ok(sameObligation({ title: "Form 1065 + K-1 (2025) ou extensão 7004", category: "federal_tax", due_date: "2026-03-16" }, { title: "Partnership return (Form 1065)", category: "federal_tax", due_date: "2026-03-16" }));
  ok(sameObligation({ title: "Florida Annual Report (Sunbiz)", category: "annual_report", due_date: "2026-05-01" }, { title: "Relatório anual da Flórida", category: "annual_report", due_date: "2026-05-01" }));
  ok(!sameObligation({ title: "Estimated tax Q1", category: "federal_tax", due_date: "2026-04-15" }, { title: "Estimated tax Q2", category: "federal_tax", due_date: "2026-06-15" }), "trimestres diferentes");
  ok(!sameObligation({ title: "Form 1065", category: "federal_tax", due_date: "2026-03-16" }, { title: "Form 1065", category: "federal_tax", due_date: "2027-03-15" }), "anos diferentes");
});
Deno.test("valida a resposta da IA", () => {
  const sources = [{ url: "https://www.irs.gov/publications/p509", text: "Partnerships. File a 2025 calendar year return (Form 1065) by March 16, 2026." }];
  const r = validate({ deadlines: [
    { title: "Form 1065", category: "federal_tax", due_date: "2026-03-16", source: 1, quote: "File a 2025 calendar year return (Form 1065) by March 16, 2026.", note: "Declaração da sociedade referente a 2025. <b>x</b> https://x.com/y" },
    { title: "Form 1120", category: "federal_tax", due_date: "2026-04-15", source: 1, quote: "File Form 1120 by April 15, 2026." },   // trecho não está na fonte
    { title: "Form 1065", category: "federal_tax", due_date: "2029-03-15", source: 1, quote: "File a 2025 calendar year return (Form 1065)" }, // ano fora
    { title: "X", category: "nope", due_date: "2026-01-01", source: 1, quote: "File a 2025 calendar year return" },
    { title: "Form 1065 again", category: "federal_tax", due_date: "2026-02-30", source: 1, quote: "File a 2025 calendar year return (Form 1065)" }, // data que não existe
  ] }, sources, [2026, 2027]);
  eq(r.ok.length, 1); eq(r.rejected, 4); eq(r.ok[0].note, "Declaração da sociedade referente a 2025. x"); eq(r.ok[0].source_url, "https://www.irs.gov/publications/p509");
  eq(validate("lixo", sources, [2026]).ok.length, 0);
});
Deno.test("não duplica nem mexe no que a equipe cadastrou", () => {
  const f = (title: string, due: string) => ({ title, category: "federal_tax", due_date: due, source_url: "https://www.irs.gov/publications/p509", basis: "stated" as const, note: "" });
  const p = plan([f("Form 1065", "2026-03-16"), f("Form 5472", "2026-04-15"), f("Form 1099-NEC", "2026-02-02"), f("Form 7004 extension", "2026-09-15")], [
    { id: "m1", title: "Form 1065 + K-1 (2025)", category: "federal_tax", due_date: "2026-03-16", origin: "manual", status: "pending" },
    { id: "a1", title: "Form 5472", category: "federal_tax", due_date: "2026-04-14", origin: "agent", status: "pending" },
    { id: "a2", title: "Form 1099-NEC", category: "federal_tax", due_date: "2026-01-31", origin: "agent", status: "done" },
  ]);
  eq(p.manual, 1); eq(p.update.map((x) => x.id + ":" + x.from), ["a1:2026-04-14"]); eq(p.keep.map((x) => x.id), ["a2"]); eq(p.create.map((x) => x.title), ["Form 7004 extension"]);
});

Deno.test("datas de multa ou dissolução ficam de fora; o que o agente criou e não se confirma sai", () => {
  const src = [{ url: "https://dos.fl.gov/x", text: "Annual reports are due by May 1. Entities are administratively dissolved on the third Friday of September." }];
  const r = validate({ deadlines: [
    { title: "Florida Annual Report", category: "annual_report", due_date: "2026-05-01", source: 1, quote: "Annual reports are due by May 1." },
    { title: "Annual Report 2026", category: "annual_report", due_date: "2026-09-18", source: 1, quote: "Entities are administratively dissolved on the third Friday of September." },
  ] }, src, [2026, 2027]);
  eq(r.ok.map((x) => x.due_date), ["2026-05-01"]); eq(r.rejected, 1);
  const ex = [
    { id: "a", origin: "agent", status: "pending", due_date: "2026-12-15", source_url: "https://www.irs.gov/publications/p509" },
    { id: "b", origin: "agent", status: "pending", due_date: "2026-12-20", source_url: "https://outra.gov/x" },       // a fonte não abriu: fica
    { id: "c", origin: "agent", status: "done", due_date: "2026-12-15", source_url: "https://www.irs.gov/publications/p509" },
    { id: "d", origin: "manual", status: "pending", due_date: "2026-12-15", source_url: null },
    { id: "e", origin: "agent", status: "pending", due_date: "2026-01-10", source_url: "https://www.irs.gov/publications/p509" },   // já passou: fica
    { id: "f", origin: "agent", status: "pending", due_date: "2027-03-15", source_url: "https://www.irs.gov/publications/p509" },   // confirmado
  ];
  eq(stale(ex, ["f"], ["https://www.irs.gov/publications/p509"], "2026-11-21", [2026, 2027]).map((x) => x.id), ["a"]);
});
