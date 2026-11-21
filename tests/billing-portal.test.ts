// Portal › Billing: deno test --allow-read --no-lock tests/billing-portal.test.ts
function assertEquals(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); }
import { aceiteValido, metodoAceito, rotuloMetodo, AUTOPAY_TEXT, autopayLang } from "../supabase/functions/payments/billing-portal.ts";

Deno.test("billing: só conta bancária americana ou cartão de débito", () => {
  assertEquals(metodoAceito({ type: "card", card: { funding: "debit", brand: "visa", last4: "4242" } }), { ok: true, type: "card", label: "Visa débito ····4242" });
  assertEquals(metodoAceito({ type: "us_bank_account", us_bank_account: { bank_name: "Chase", last4: "6789" } }), { ok: true, type: "us_bank_account", label: "Chase ····6789" });
  assertEquals(metodoAceito({ type: "card", card: { funding: "credit", brand: "visa", last4: "1111" } }), { ok: false, code: "credit_not_allowed" });
  assertEquals(metodoAceito({ type: "card", card: { funding: "prepaid" } }), { ok: false, code: "debit_only" });
  assertEquals(metodoAceito({ type: "card", card: { funding: "unknown" } }), { ok: false, code: "debit_only" });
  assertEquals(metodoAceito({ type: "card" }), { ok: false, code: "debit_only" });
  assertEquals(metodoAceito({ type: "pix" }), { ok: false, code: "method_not_allowed" });
  assertEquals(metodoAceito(null), { ok: false, code: "method_not_allowed" });
});
Deno.test("billing: aceite da autorização exige caixa marcada e nome completo", () => {
  assertEquals(aceiteValido({ accept: true, name: "  Maria   Silva " }), "Maria Silva");
  assertEquals(aceiteValido({ accept: false, name: "Maria Silva" }), null);
  assertEquals(aceiteValido({ accept: true, name: "Maria" }), null);
  assertEquals(aceiteValido({ accept: "true", name: "Maria Silva" }), null);
  assertEquals(aceiteValido(null), null);
});
Deno.test("billing: rótulo da forma de pagamento mostra só os 4 últimos dígitos", () => {
  assertEquals(rotuloMetodo({ type: "card", card: { brand: "mastercard", funding: "debit", last4: "5555" } }), { type: "card", label: "Mastercard débito ····5555" });
  assertEquals(rotuloMetodo({ type: "us_bank_account", us_bank_account: { bank_name: "Bank of America", last4: "0001" } }), { type: "us_bank_account", label: "Bank of America ····0001" });
  assertEquals(rotuloMetodo("pm_123"), null);
});
Deno.test("billing: texto da autorização nos três idiomas", () => {
  for (const l of ["en", "pt", "es"]) assertEquals(AUTOPAY_TEXT[l].includes("Endeavor Tax Solutions LLC"), true);
  assertEquals(autopayLang("fr"), "en");
});
