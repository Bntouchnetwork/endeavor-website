// Pacotes de abertura: deno test --allow-read --no-lock tests/pacotes.test.ts
import { ErroCarrinho, montarCarrinho, PACOTES, precoCliente, primeiroAno, type Produto } from "../supabase/functions/payments/pacotes.ts";

const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const P = (code: string, kind: string, price: number, setup: number, interval: string, member: number | null = null): Produto => ({ code, kind, price_cents: price, setup_cents: setup, interval, status: "active", member_cents: member });
const CAT: Record<string, Produto> = {
  pkg_essencial: P("pkg_essencial", "package", 5900, 99900, "month"), pkg_completo: P("pkg_completo", "package", 19900, 149700, "month"),
  operating_agreement: P("operating_agreement", "addon", 29700, 0, "once"), bookkeeping: P("bookkeeping", "tool", 19900, 0, "month"), telefone: P("telefone", "tool", 1999, 0, "month"),
  crm: P("crm", "tool", 2900, 0, "month", 2300),
};
const erro = (f: () => unknown) => { try { f(); } catch (e) { return e instanceof ErroCarrinho ? e.message : "outro"; } return ""; };

Deno.test("Essencial sozinho: abertura $999 + $59/mês (hoje cobra abertura + 1º mês)", () => {
  const c = montarCarrinho("pkg_essencial", CAT, []);
  eq([c.abertura, c.mensal, c.hoje], [99900, 5900, 105800]);
  eq(c.linhas.map((l) => [l.code, l.recorrente, !!l.abertura]), [["pkg_essencial", false, true], ["pkg_essencial", true, false]]);
});

Deno.test("Essencial com os três add-ons soma certo e na ordem do upsell", () => {
  const c = montarCarrinho("pkg_essencial", CAT, ["telefone", "operating_agreement", "bookkeeping", "telefone"]);
  eq(c.itens, ["operating_agreement", "bookkeeping", "telefone"]);
  eq([c.abertura, c.mensal], [99900 + 29700, 5900 + 19900 + 1999]);
});

Deno.test("Completo: $1,497 + $199/mês, sem add-ons; sai mais barato que o Essencial com tudo", () => {
  const comp = montarCarrinho("pkg_completo", CAT, []);
  eq([comp.abertura, comp.mensal], [149700, 19900]);
  eq(erro(() => montarCarrinho("pkg_completo", CAT, ["bookkeeping"])), "invalid_item");
  const ess = montarCarrinho("pkg_essencial", CAT, ["operating_agreement", "bookkeeping", "telefone"]);
  if (!(primeiroAno(comp) < primeiroAno(ess))) throw new Error("o Completo precisa ser mais barato no primeiro ano");
  // com só Operating Agreement + telefone, o Completo NÃO compensa: a tela não deve oferecer a troca
  const pouco = montarCarrinho("pkg_essencial", CAT, ["operating_agreement", "telefone"]);
  if (!(primeiroAno(comp) > primeiroAno(pouco))) throw new Error("sem bookkeeping o Completo fica mais caro");
});

Deno.test("carrinho recusa item que não é add-on do pacote e pacote fora de venda", () => {
  eq(erro(() => montarCarrinho("pkg_essencial", CAT, ["crm"])), "invalid_item");
  eq(erro(() => montarCarrinho("crm", CAT, [])), "not_available");
  eq(erro(() => montarCarrinho("pkg_essencial", { ...CAT, pkg_essencial: { ...CAT.pkg_essencial, status: "coming_soon" } }, [])), "not_available");
});

Deno.test("abertura nunca sozinha; preço de cliente só para quem tem pacote", () => {
  for (const k of Object.keys(PACOTES)) for (const x of ["registered_agent", "virtual_address"]) if (!PACOTES[k].incluidos.includes(x)) throw new Error(k + " sem " + x);
  eq(precoCliente(CAT.crm, true), 2300); eq(precoCliente(CAT.crm, false), 2900); eq(precoCliente(CAT.bookkeeping, true), 19900);
});
