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
  input: string; sessionId: string; userId: string; idempotencyKey: string;
  agent?: string; task?: string; metadata?: Record<string, unknown>; maxOutputTokens?: number;
}): Promise<HubResult> {
  if (!hubOn()) return { kind: "error", code: "hub_not_configured", status: 0 };
  const body = JSON.stringify({
    input: req.input, agent: req.agent || HUB_AGENT, session_id: req.sessionId, user_id: req.userId,
    ...(req.task ? { task: req.task } : {}), metadata: req.metadata || {},
    ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
  });
  // one retry for 429/5xx/network with the SAME Idempotency-Key, so the HUB never runs or bills twice
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/api/v1/execute`, {
        method: "POST", body, signal: AbortSignal.timeout(45_000),
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json", "Idempotency-Key": req.idempotencyKey },
      });
    } catch (e) {
      if (attempt === 0) { await sleep(800); continue; }
      console.error("hub network", e); return { kind: "error", code: "network_error", status: 0 };
    }
    const data = await res.json().catch(() => ({} as Record<string, any>));
    const code = String(data?.error?.code || data?.status || `http_${res.status}`);
    if (res.status === 200 && data.status === "completed" && typeof data.output === "string") return { kind: "ok", output: data.output.trim(), requestId: String(data.request_id || "") };
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
