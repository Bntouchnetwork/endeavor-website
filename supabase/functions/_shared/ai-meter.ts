// Hub AI meter: every call to the Anthropic Messages API made by an Endeavor agent is recorded in ai_usage
// (agent, model, tokens, cost), so the admin sees consumption, costs and limits per agent, company and project.
// Usage: import { meter } from "../_shared/ai-meter.ts"; meter("crm");   (then fetch as usual)
//        withAiContext({ project_id, client_id, company_id }, () => ...) attributes the calls made inside it.
import { createClient } from "npm:@supabase/supabase-js@2";

// USD per million tokens (input, output); unknown models fall back to the Sonnet price
const PRICES: Record<string, [number, number]> = { haiku: [1, 5], sonnet: [3, 15], opus: [15, 75], fable: [15, 75] };
export function costUsd(model: string, input: number, output: number) {
  const k = Object.keys(PRICES).find((x) => String(model || "").includes(x)) || "sonnet";
  const [i, o] = PRICES[k];
  return (input * i + output * o) / 1_000_000;
}

type Ctx = { project_id?: string | null; client_id?: string | null; company_id?: string | null; billable?: boolean };
let AGENT = "agent";
let CTX: Ctx = {};
let installed = false;
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export async function record(agent: string, model: string, usage: any, ctx: Ctx = {}) {
  const input = Number(usage?.input_tokens || 0) + Number(usage?.cache_creation_input_tokens || 0) + Number(usage?.cache_read_input_tokens || 0);
  const output = Number(usage?.output_tokens || 0);
  if (!input && !output) return;
  try {
    await db().from("ai_usage").insert({ agent, model, input_tokens: input, output_tokens: output, cost_usd: costUsd(model, input, output),
      project_id: ctx.project_id || null, client_id: ctx.client_id || null, company_id: ctx.company_id || null, billable: !!ctx.billable });
  } catch (e) { console.error("ai-meter", e); }
}

export function meter(agent: string) {
  AGENT = agent;
  if (installed) return;
  installed = true;
  const orig = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    const res = await orig(input, init);
    try {
      const url = typeof input === "string" ? input : input?.url || String(input);
      if (url.startsWith("https://api.anthropic.com/v1/messages") && res.ok) {
        const ctx = { ...CTX }, agent = AGENT;
        res.clone().json().then((j: any) => record(agent, j?.model || "", j?.usage, ctx)).catch(() => {});
      }
    } catch { /* never break the caller */ }
    return res;
  };
}

export async function withAiContext<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  const prev = CTX; CTX = ctx;
  try { return await fn(); } finally { CTX = prev; }
}
