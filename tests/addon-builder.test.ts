// Fábrica de add-ons: deno test --allow-read --no-lock tests/addon-builder.test.ts
import { chaveIgual, classificar, limparArquivos, limparPlano, podePublicar, ramo, situacaoCusto } from "../supabase/functions/addon-builder/regras.ts";

const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };

Deno.test("áreas sensíveis: servidor, banco, pagamentos, chaves e workflows", () => {
  const s = classificar(["client-tools.js", "store-catalog.js", "supabase/migrations/x.sql", "supabase/functions/payments/store.ts", "supabase/functions/crm/index.ts", "comprar.js", "app-config.js", ".github/workflows/a.yml", "CNAME", "./index.html"]);
  eq(s.map((x) => x.area), ["banco de dados (migração)", "pagamentos (Stripe)", "servidor (funções)", "pagamentos (checkout e loja)", "configuração e chaves", "workflows do GitHub", "domínio do site"]);
  eq(s.filter((x) => x.servidor).length, 3, "servidor e banco pedem publicação técnica");
  eq(classificar(["client-tools.js", "store-catalog.js", "index.html", "i18n.js"]), [], "telas e textos não são sensíveis");
});

Deno.test("publicar: só da prévia, e área sensível só com PUBLICAR digitado", () => {
  const sens = classificar(["supabase/functions/crm/index.ts"]);
  eq(podePublicar("chatting", [], ""), { ok: false, motivo: "not_ready" });
  eq(podePublicar("preview", [], ""), { ok: true, motivo: "" });
  eq(podePublicar("preview", sens, "sim"), { ok: false, motivo: "confirm_sensitive" });
  eq(podePublicar("preview", sens, " publicar "), { ok: true, motivo: "" });
});

Deno.test("limites de custo do mês", () => {
  eq(situacaoCusto(50, 100, 80), { pct: 50, bloqueado: false, alerta: false });
  eq(situacaoCusto(85, 100, 80), { pct: 85, bloqueado: false, alerta: true });
  eq(situacaoCusto(100, 100, 80).bloqueado, true);
});

Deno.test("plano da IA é limpo: tipo, código do produto, sem HTML", () => {
  const p = limparPlano({ title: "<b>Cartões</b>", kind: "addon", summary: "x", tasks: ["a", 3, ""], ready: "yes",
    product: { code: "Cartão Digital!", category: "marketing", interval: "week", names: { pt: "Cartão <i>digital</i>", fr: "x" } } }) as any;
  eq(p.title, "bCartões/b"); eq(p.ready, false); eq(p.tasks, ["a", "3"]);
  eq(p.product, { code: "cart_o_digital", category: "empresa", interval: "month", names: { pt: "Cartão idigital/i" }, leads: {} });
  eq((limparPlano({ kind: "bugfix", product: { code: "abc" } }) as any).product, undefined, "só add-on tem produto");
  eq((limparPlano({ kind: "xxx" }) as any).kind, "change");
});

Deno.test("branch de teste, arquivos e chave do gancho", () => {
  eq(ramo("3f2a9c1e-1111-4111-8111-111111111111"), "addon/3f2a9c1e");
  eq(limparArquivos(["./a.js", "a.js", "", null, "b.css"]), ["a.js", "b.css"]);
  eq(chaveIgual("abc", "abc"), true); eq(chaveIgual("abc", "abd"), false); eq(chaveIgual("", ""), false);
});
