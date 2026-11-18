// Regras da fábrica de add-ons (sem banco nem rede), testadas em tests/addon-builder.test.ts.

// Áreas sensíveis: precisam de aprovação extra; servidor e banco ainda precisam de publicação técnica.
const AREAS: [RegExp, string, boolean][] = [
  [/^supabase\/migrations\//, "banco de dados (migração)", true],
  [/^supabase\/functions\/payments\//, "pagamentos (Stripe)", true],
  [/^supabase\//, "servidor (funções)", true],
  [/^\.github\//, "workflows do GitHub", false],
  [/^app-config\.js$/, "configuração e chaves", false],
  [/^CNAME$/, "domínio do site", false],
  [/^(comprar\.(js|html)|admin-payments\.js)$/, "pagamentos (checkout e loja)", false],
  [/(^|\/)\.env/, "arquivo de segredos", false],
];

export type Sensivel = { file: string; area: string; servidor: boolean };

export function classificar(files: unknown): Sensivel[] {
  const out: Sensivel[] = [];
  for (const f of Array.isArray(files) ? files : []) {
    const file = String(f || "").replace(/^\.\//, "").slice(0, 300);
    if (!file) continue;
    const a = AREAS.find(([re]) => re.test(file));
    if (a) out.push({ file, area: a[1], servidor: a[2] });
  }
  return out;
}

export const limparArquivos = (files: unknown) =>
  [...new Set((Array.isArray(files) ? files : []).map((f) => String(f || "").replace(/^\.\//, "").slice(0, 300)).filter(Boolean))].slice(0, 300);

export const ramo = (id: string) => `addon/${id.replace(/[^0-9a-f]/gi, "").slice(0, 8).toLowerCase()}`;

/** Limpa o plano que a IA devolve (nada de HTML, códigos válidos, listas curtas). */
export function limparPlano(p: unknown) {
  // deno-lint-ignore no-explicit-any
  const x: any = p && typeof p === "object" ? p : {};
  const txt = (v: unknown, n = 600) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
  const lista = (v: unknown, n = 20) => (Array.isArray(v) ? v : []).map((s) => txt(s, 300)).filter(Boolean).slice(0, n);
  const kind = ["addon", "change", "bugfix"].includes(x.kind) ? x.kind : "change";
  const plano: Record<string, unknown> = { title: txt(x.title, 160), kind, summary: txt(x.summary, 1500), tasks: lista(x.tasks), files_likely: lista(x.files_likely, 40),
    tests: lista(x.tests), risks: lista(x.risks), ready: x.ready === true };
  if (kind === "addon" && x.product && typeof x.product === "object") {
    const code = String(x.product.code || "").toLowerCase().replace(/[^a-z_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    const cat = ["empresa", "vendas", "comunicacao", "financeiro", "documentos"].includes(x.product.category) ? x.product.category : "empresa";
    const interval = ["month", "year", "once"].includes(x.product.interval) ? x.product.interval : "month";
    const tri = (o: unknown) => { const r: Record<string, string> = {}; for (const l of ["pt", "en", "es"]) { const v = txt((o as Record<string, unknown> | undefined)?.[l], 300); if (v) r[l] = v; } return r; };
    if (code.length >= 2) plano.product = { code, category: cat, interval, names: tri(x.product.names), leads: tri(x.product.leads) };
  }
  return plano;
}

/** Limites do Hub AI: bloqueia ao atingir o mensal; avisa ao passar do alerta ou do teto por tarefa. */
export function situacaoCusto(gastoMes: number, tetoMes: number, alertaPct: number) {
  const pct = tetoMes > 0 ? Math.round((gastoMes / tetoMes) * 100) : 0;
  return { pct, bloqueado: tetoMes > 0 && gastoMes >= tetoMes, alerta: tetoMes > 0 && pct >= alertaPct };
}

/** Publicar: mudança em área sensível só com a confirmação digitada. */
export function podePublicar(status: string, sensiveis: Sensivel[], confirmacao: unknown) {
  if (status !== "preview") return { ok: false, motivo: "not_ready" };
  if (sensiveis.length && String(confirmacao || "").trim().toUpperCase() !== "PUBLICAR") return { ok: false, motivo: "confirm_sensitive" };
  return { ok: true, motivo: "" };
}

/** Comparação de chave em tempo constante (gancho do GitHub Actions). */
export function chaveIgual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
