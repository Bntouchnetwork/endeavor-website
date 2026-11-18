// Pacotes de abertura: o que cada pacote inclui, quais add-ons o carrinho aceita e o total (hoje e por mês).
// Regras puras (sem banco nem Stripe), testadas em tests/pacotes.test.ts.

export type Produto = { code: string; kind: string; price_cents: number; setup_cents: number; interval: string; status: string; member_cents?: number | null };
export type Linha = { code: string; cents: number; recorrente: boolean; abertura?: boolean };

// a abertura nunca é vendida sozinha: sempre com registered agent e endereço virtual
export const PACOTES: Record<string, { incluidos: string[]; addons: string[] }> = {
  pkg_essencial: { incluidos: ["registered_agent", "virtual_address"], addons: ["operating_agreement", "bookkeeping", "telefone"] },
  pkg_completo: { incluidos: ["registered_agent", "virtual_address", "operating_agreement", "bookkeeping", "telefone"], addons: [] },
};
export const ehPacote = (code: string) => Object.prototype.hasOwnProperty.call(PACOTES, code);

export class ErroCarrinho extends Error {}

/** Monta as linhas do Stripe e os totais. "hoje" = abertura + 1º mês + add-ons de pagamento único. */
export function montarCarrinho(pacote: string, produtos: Record<string, Produto>, itens: unknown) {
  const pk = PACOTES[pacote], p = produtos[pacote];
  if (!pk || !p || p.kind !== "package" || p.status !== "active") throw new ErroCarrinho("not_available");
  const lista = Array.isArray(itens) ? [...new Set(itens.map(String))] : [];
  for (const c of lista) if (!pk.addons.includes(c)) throw new ErroCarrinho("invalid_item");
  const linhas: Linha[] = [];
  if (p.setup_cents > 0) linhas.push({ code: pacote, cents: p.setup_cents, recorrente: false, abertura: true });
  linhas.push({ code: pacote, cents: p.price_cents, recorrente: true });
  for (const c of pk.addons.filter((x) => lista.includes(x))) {
    const a = produtos[c];
    if (!a || a.status === "hidden") throw new ErroCarrinho("invalid_item");
    if (a.interval === "year") throw new ErroCarrinho("invalid_item"); // a assinatura do pacote é mensal
    linhas.push({ code: c, cents: a.price_cents, recorrente: a.interval === "month" });
  }
  const mensal = linhas.filter((l) => l.recorrente).reduce((s, l) => s + l.cents, 0);
  const unico = linhas.filter((l) => !l.recorrente).reduce((s, l) => s + l.cents, 0);
  return { linhas, itens: pk.addons.filter((x) => lista.includes(x)), mensal, hoje: unico + mensal, abertura: unico };
}

/** Custo no primeiro ano (hoje + 11 mensalidades), para comparar o Essencial com add-ons e o Completo. */
export const primeiroAno = (c: { hoje: number; mensal: number }) => c.hoje + 11 * c.mensal;

/** Preço na página Add-ons: cliente com pacote paga o preço de cliente, quando houver. */
export const precoCliente = (p: Produto, membro: boolean) => (membro && p.member_cents != null && p.member_cents < p.price_cents ? p.member_cents : p.price_cents);
