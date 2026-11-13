// HUB AI client: the website and Instagram customer service go through Endeavor's central HUB AI
// (POST {HUB_AI_URL}/api/v1/execute, contract in Bntouchnetwork/HUB-AI docs/INTEGRATION.md).
// The HUB holds the agent's system prompt, model choice, limits, memory (session_id) and billing.
// The key is the Supabase secret HUB_AI_API_KEY (never in code).

const BASE = (Deno.env.get("HUB_AI_URL") || "https://ciqmeyngbbpjowmsjxhj.supabase.co/functions/v1/hub").replace(/\/$/, "");
const KEY = Deno.env.get("HUB_AI_API_KEY") || "";
export const HUB_AGENT = Deno.env.get("HUB_AI_AGENT") || "customer-service";
export const hubOn = () => KEY.length > 10;

export type HubResult =
  | { kind: "ok"; output: string; requestId: string }
  | { kind: "review"; requestId: string }                        // 202 pending_review: a person at Endeavor reviews it
  | { kind: "limit"; code: string }                              // 402 hard_limit, daily_limit, company_inactive, key_spend_limit (do not retry)
  | { kind: "rate"; code: string }                               // 429 rate_limited, daily_request_limit
  | { kind: "blocked"; code: string }                            // 422 blocked / empty_input
  | { kind: "error"; code: string; status: number };             // 401/403/404/5xx, network, timeout

export async function hubExecute(req: {
  input?: string; messages?: { role: string; content: string }[]; sessionId?: string; userId: string; idempotencyKey: string;
  agent?: string; task?: string; metadata?: Record<string, unknown>; maxOutputTokens?: number; timeoutMs?: number;
  meter?: { agent: string; project_id?: string | null; client_id?: string | null; company_id?: string | null };
}): Promise<HubResult> {
  if (!hubOn()) return { kind: "error", code: "hub_not_configured", status: 0 };
  const body = JSON.stringify({
    ...(req.input != null ? { input: req.input } : {}), ...(req.messages ? { messages: req.messages } : {}),
    agent: req.agent || HUB_AGENT, ...(req.sessionId ? { session_id: req.sessionId } : {}), user_id: req.userId,
    ...(req.task ? { task: req.task } : {}), metadata: req.metadata || {},
    ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
  });
  // one retry for 429/5xx/network with the SAME Idempotency-Key, so the HUB never runs or bills twice
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/v1/execute`, {
        method: "POST", body, signal: AbortSignal.timeout(req.timeoutMs || 45_000),
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json", "Idempotency-Key": req.idempotencyKey },
      });
    } catch (e) {
      if (attempt === 0) { await sleep(800); continue; }
      console.error("hub network", e); return { kind: "error", code: "network_error", status: 0 };
    }
    const data = await res.json().catch(() => ({} as Record<string, any>));
    const code = String(data?.error?.code || data?.status || `http_${res.status}`);
    if (res.status === 200 && data.status === "completed" && typeof data.output === "string") {
      if (!data.replayed) await meterUsage(req.meter || { agent: req.agent || HUB_AGENT }, data);
      return { kind: "ok", output: data.output.trim(), requestId: String(data.request_id || "") };
    }
    if (res.status === 202 || data.status === "pending_review") return { kind: "review", requestId: String(data.request_id || "") };
    if (res.status === 402) return { kind: "limit", code };
    if (res.status === 422) return { kind: "blocked", code };
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 0) { await sleep(res.status === 429 ? retryAfter(res) : 800); continue; }
      return res.status === 429 ? { kind: "rate", code } : { kind: "error", code, status: res.status };
    }
    if (res.status === 200 && (data.status === "blocked" || data.status === "rejected")) return { kind: "blocked", code: data.status };
    console.error("hub error", res.status, code, data?.error?.message || "");
    return { kind: "error", code, status: res.status };
  }
  return { kind: "error", code: "unknown", status: 0 };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryAfter = (r: Response) => Math.min(3000, Math.max(500, (Number(r.headers.get("retry-after")) || 1) * 1000));

// The Endeavor console (Hub AI page) keeps showing consumption: each HUB answer is recorded in ai_usage
// with the tokens and the billable amount the HUB reports.
let meterDb: any = null;
async function meterUsage(m: { agent: string; project_id?: string | null; client_id?: string | null; company_id?: string | null }, data: any) {
  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    meterDb ??= createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const u = data.usage || {};
    await meterDb.from("ai_usage").insert({ agent: m.agent, model: String(data.model || "hub").slice(0, 120), input_tokens: Number(u.input_tokens || 0), output_tokens: Number(u.output_tokens || 0),
      cost_usd: Number(u.billable_amount || 0), project_id: m.project_id || null, client_id: m.client_id || null, company_id: m.company_id || null, billable: !!m.project_id });
  } catch (e) { console.error("hub meter", e); }
}

// For back-office agents: returns the text or throws HubFail (the caller shows its own error).
export class HubFail extends Error { constructor(public kind: string, public code: string) { super(`hub_${kind}:${code}`); } }
export async function hubAsk(o: Parameters<typeof hubExecute>[0]): Promise<string> {
  const r = await hubExecute(o);
  if (r.kind === "ok") return r.output;
  if (r.kind === "review") throw new HubFail("review", "pending_review");
  throw new HubFail(r.kind, "code" in r ? r.code : "error");
}
// JSON answers: the HUB is text-only, so the agent replies with a JSON object that we extract and parse (one retry).
export async function hubJson<T = any>(o: Parameters<typeof hubExecute>[0]): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt ? "\n\nIMPORTANT: reply with ONLY the JSON object, no text before or after." : "";
    const txt = await hubAsk({ ...o, idempotencyKey: o.idempotencyKey + (attempt ? "-r" : ""), ...(o.input != null ? { input: o.input + extra } : {}) });
    const parsed = parseJsonLoose(txt);
    if (parsed !== undefined) return parsed as T;
  }
  throw new HubFail("format", "ai_format");
}
export function parseJsonLoose(t: string): unknown {
  const s = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) return undefined;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return undefined; }
}
export const hubKey = (...parts: unknown[]) => parts.map((p) => String(p ?? "")).join("-").slice(0, 180);
