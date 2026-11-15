// Web Meeting · AI Presentation Studio: regras puras do servidor (supabase/meet/studio.ts).
//   deno test --allow-read --allow-env tests/meet-studio.test.ts
import { estimarSegundos, hashFala, limparConfig, textoFalado, TERMO_VOZ } from "../supabase/functions/meet/studio.ts";
import { validar } from "../supabase/functions/meet/presentation.ts";

const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };

Deno.test("configuração: valores fora da lista voltam ao padrão e limites são respeitados", () => {
  const c = limparConfig({ idioma: "fr-FR", ritmo: "turbo", duracao_min: 999, tom: "<b>x</b>", voz_id: "nao-e-uuid", legendas: false, pronuncia: [{ de: "LLC", para: "éle éle cê" }, { de: "", para: "x" }, 5] });
  eq(c.idioma, "pt-BR", "idioma"); eq(c.ritmo, "normal", "ritmo"); eq(c.duracao_min, 120, "duração máxima");
  eq(c.voz_id, null, "voz inválida"); eq(c.legendas, false, "legendas"); eq(c.pronuncia, [{ de: "LLC", para: "éle éle cê" }], "pronúncia limpa");
  eq(/[<>]/.test(c.tom), false, "sem HTML no tom");
});

Deno.test("pronúncia troca só a palavra inteira, sem diferenciar maiúsculas", () => {
  const p = [{ de: "LLC", para: "éle éle cê" }, { de: "EIN", para: "í ai én" }];
  eq(textoFalado("Abra sua LLC e peça o ein. LLCs são comuns.", p), "Abra sua éle éle cê e peça o í ai én. LLCs são comuns.");
});

Deno.test("hash da fala muda com texto, idioma ou ritmo (só o que mudou é narrado de novo)", async () => {
  const a = await hashFala("pt-BR", "normal", "Olá");
  eq(a === await hashFala("pt-BR", "normal", "Olá"), true, "estável");
  eq(a === await hashFala("pt-BR", "normal", "Olá!"), false, "texto");
  eq(a === await hashFala("en-US", "normal", "Olá"), false, "idioma");
  eq(a === await hashFala("pt-BR", "calmo", "Olá"), false, "ritmo");
});

Deno.test("tempo estimado de fala pelo ritmo", () => {
  const t = Array(150).fill("palavra").join(" ");
  eq(estimarSegundos(t, "normal"), 60); eq(estimarSegundos(t, "rapido"), 53); eq(estimarSegundos(t, "calmo"), 69); eq(estimarSegundos("", "normal"), 0);
});

Deno.test("formato do slide guarda roteiro e duração (3 a 900 s)", () => {
  const ap = validar({ titulo: "x", slides: [{ titulo: "a", roteiro: " Olá   mundo ", duracao: 1 }, { titulo: "b", duracao: 5000 }, { titulo: "c", duracao: "x" }] });
  eq(ap.slides[0].roteiro, "Olá mundo"); eq(ap.slides[0].duracao, 3); eq(ap.slides[1].duracao, 900); eq(ap.slides[2].duracao, undefined);
});

Deno.test("o termo de voz fala de voz própria e de não imitar outra pessoa", () => {
  eq(/minha própria voz/.test(TERMO_VOZ) && /imitar outra pessoa/.test(TERMO_VOZ) && /apagar/.test(TERMO_VOZ), true);
});
