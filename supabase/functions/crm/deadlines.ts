// Skill "Prazos fiscais" do Agente Admin.
// O HUB AI não pesquisa na internet: quem baixa as páginas é esta função, e só de sites oficiais (.gov e afins).
// A IA (1) sugere endereços oficiais do estado e do condado e (2) lê o texto baixado e devolve os prazos, cada um com
// um trecho copiado da fonte. Só entra no portal o que passa na conferência (deadlines-core.ts).
import { hubJson, hubOn } from "../_shared/hub-ai.ts";
import { CATS, htmlToText, officialUrl, plan, relevant, validate, type Row } from "./deadlines-core.ts";

const IRS_CAL = "https://www.irs.gov/publications/p509";
const FL_AR = "https://dos.fl.gov/sunbiz/manage-business/efile/annual-report/";
const ENTITY: Record<string, string> = { llc_single: "single-member LLC (disregarded entity, U.S. owner)", llc_foreign: "single-member LLC owned by a foreign person (Form 5472 with pro forma 1120)", llc_multi: "multi-member LLC taxed as a partnership", partnership: "partnership", s_corp: "S corporation", c_corp: "C corporation", sole_prop: "sole proprietorship", other: "other entity" };
const KW: Record<string, string[]> = { llc_multi: ["partnership", "1065"], partnership: ["partnership", "1065"], s_corp: ["s corporation", "1120-s"], c_corp: ["corporation", "1120"], llc_foreign: ["5472", "corporation", "1120"], llc_single: ["individual", "1040", "estimated"], sole_prop: ["individual", "1040", "estimated"] };

async function page(url: string): Promise<string> {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "EndeavorBusinessHub-DeadlineAgent/1.0 (+https://endeavorbiz.com)", Accept: "text/html,text/plain" } });
  if (!r.ok) throw new Error("http_" + r.status);
  if (!officialUrl(r.url)) throw new Error("redirect_off_site");
  if (!/text\/(html|plain)/i.test(r.headers.get("content-type") || "")) throw new Error("not_text");
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 3_000_000) throw new Error("too_big");
  return htmlToText(new TextDecoder().decode(buf));
}
// cidade, estado e CEP do endereço (sem rua nem número) para a IA achar o condado
const lugar = (addr: unknown) => String(addr || "").split(",").map((x) => x.trim()).filter(Boolean).slice(-2).join(", ").slice(0, 80);

export async function runCompany(db: any, co: Row, lang: string, today = new Date()): Promise<Row> {
  const cy = today.getUTCFullYear(), years = [cy, cy + 1], state = String(co.state || "FL").toUpperCase().slice(0, 2);
  const facts = { entity: ENTITY[co.entity_type] || ENTITY.other, state, city_state_zip: lugar(co.address), fiscal_year_end: co.fiscal_year_end || "December 31", formed_year: co.formation_date ? +String(co.formation_date).slice(0, 4) : null, today: today.toISOString().slice(0, 10), years };
  const meter = { agent: "admin-deadlines", client_id: co.client_id, company_id: co.id };
  const urls: string[] = [IRS_CAL]; if (state === "FL") urls.push(FL_AR);
  const tried: Row[] = [];
  // 1. endereços oficiais do estado e do condado (a IA sugere; só entra o que é site oficial e abre de verdade)
  try {
    const s: Row = await hubJson({ agent: "tax-deadlines", userId: "endeavor-admin-deadlines", idempotencyKey: `endeavor-dl-src-${co.id}-${today.toISOString().slice(0, 10)}`, task: "tax_deadline_sources", maxOutputTokens: 700, meter,
      input: `[Context]\nTask: list up to 4 official government web pages (HTML pages, not PDF) that state the recurring filing deadlines for this company at STATE level (annual report or franchise tax with the Secretary of State, state corporate or business tax with the state revenue department) and at COUNTY or CITY level (local business tax receipt or business license). Only official sites (.gov, state .us domains, sunbiz.org, floridarevenue.com). If you are not sure a page exists, leave it out.\nReply with ONLY a JSON object {"urls": [{"url": "https://...", "about": "short"}]}.\n[/Context]\n\nCompany facts: ${JSON.stringify(facts)}` });
    for (const u of (Array.isArray(s?.urls) ? s.urls : []).slice(0, 4)) { const ok = officialUrl(u?.url); if (ok && !urls.includes(ok)) urls.push(ok); else if (!ok) tried.push({ url: String(u?.url || "").slice(0, 200), ok: false, why: "not_official" }); }
  } catch (e) { tried.push({ url: "(sugestão de fontes)", ok: false, why: String((e as Error).message || e).slice(0, 80) }); }
  // 2. baixa as páginas
  const kw = (KW[co.entity_type] || []).concat(["annual report", "business tax", "estimated tax", "1099", "franchise", "license"]);
  const sources: { url: string; text: string }[] = [];
  const got = await Promise.allSettled(urls.map((u) => page(u)));
  got.forEach((g, i) => {
    if (g.status === "fulfilled" && g.value.length > 400) { const t = relevant(g.value, kw, urls[i] === IRS_CAL ? 16_000 : 5_000); if (t.length > 200) { sources.push({ url: urls[i], text: t }); tried.push({ url: urls[i], ok: true }); return; } }
    tried.push({ url: urls[i], ok: false, why: g.status === "rejected" ? String((g.reason as Error)?.message || g.reason).slice(0, 80) : "no_text" });
  });
  if (!sources.length) { await db.from("companies").update({ deadlines_checked_at: today.toISOString() }).eq("id", co.id); return { company_id: co.id, error: "no_sources", sources: tried }; }
  // 3. a IA lê as fontes e devolve os prazos, com o trecho que sustenta cada um
  const idioma = lang === "en" ? "English" : lang === "es" ? "Spanish" : "Brazilian Portuguese";
  const raw: Row = await hubJson({ agent: "tax-deadlines", userId: "endeavor-admin-deadlines", idempotencyKey: `endeavor-dl-read-${co.id}-${today.toISOString().slice(0, 10)}`, task: "tax_deadline_extract", maxOutputTokens: 4000, timeoutMs: 80_000, meter,
    input: `[Context]\nTask: from the official sources below, list the filing and tax deadlines that apply to this company with a due date in ${years[0]} or ${years[1]}.\nRules: use ONLY the sources. "basis" is "stated" when the source states the date itself, or "rule" when the source states a rule (for example "the 15th day of the 3rd month after the end of the tax year") and you computed the date from it; when a computed date falls on a Saturday or Sunday use the next Monday. If the sources do not cover a year, do not guess that year. "quote" is one sentence copied EXACTLY from the source that supports the deadline. "title" is short, in ${idioma}, keeping the official form or filing name (for example "Form 1065"). "category" is one of ${CATS.join(", ")}. "source" is the number of the source.\nReply with ONLY a JSON object {"deadlines": [{"title": "...", "category": "...", "due_date": "YYYY-MM-DD", "source": 1, "quote": "...", "basis": "stated"}]}.\n[/Context]\n\nCompany facts: ${JSON.stringify(facts)}\n\n` +
      sources.map((s, i) => `=== SOURCE ${i + 1}: ${s.url} ===\n${s.text}`).join("\n\n") });
  const v = validate(raw, sources, years);
  // 4. grava: cria o que falta, corrige a data do que o próprio agente criou, não mexe no que a equipe cadastrou
  const { data: existing } = await db.from("compliance_items").select("id, title, category, due_date, status, origin").eq("company_id", co.id);
  const p = plan(v.ok, existing ?? []), now = today.toISOString();
  const nota = (f: Row) => f.basis === "rule" ? "Data calculada pela regra da fonte oficial" : null;
  if (p.create.length) { const ins = await db.from("compliance_items").insert(p.create.map((f) => ({ company_id: co.id, client_id: co.client_id, title: f.title, category: f.category, due_date: f.due_date, status: "pending", notes: nota(f), origin: "agent", source_url: f.source_url, verified_at: now }))); if (ins.error) throw new Error("db_insert: " + ins.error.message); }
  for (const u of p.update) await db.from("compliance_items").update({ due_date: u.found.due_date, source_url: u.found.source_url, verified_at: now, notes: nota(u.found) }).eq("id", u.id);
  if (p.keep.length) await db.from("compliance_items").update({ verified_at: now }).in("id", p.keep.map((k) => k.id));
  await db.from("companies").update({ deadlines_checked_at: now }).eq("id", co.id);
  if (p.create.length || p.update.length) {
    await db.from("admin_events").insert({ kind: "deadline_agent", title: `Agente de prazos: ${p.create.length} novo(s), ${p.update.length} alterado(s) · ${String(co.legal_name || "").slice(0, 120)}`.slice(0, 300),
      body: [...p.create.map((f) => `Novo: ${f.title} · ${f.due_date}`), ...p.update.map((u) => `Mudou: ${u.found.title} · ${u.from} → ${u.found.due_date}`)].join("\n").slice(0, 2000), link: `#/clientes?id=${co.client_id}&tab=prazos` });
  }
  return { company_id: co.id, company: co.legal_name, created: p.create.length, changed: p.update.length, confirmed: p.keep.length, already_by_team: p.manual, rejected: v.rejected, sources: tried };
}

// a próxima empresa da fila (nunca verificada primeiro; depois as verificadas há mais tempo que o intervalo)
export async function runNext(db: any, opts: { companyId?: string; force?: boolean } = {}): Promise<Row> {
  if (!hubOn()) return { skipped: "no_ai" };
  const { data: S } = await db.from("crm_settings").select("deadline_agent_enabled, deadline_agent_days").eq("id", 1).single();
  if (!opts.force && S?.deadline_agent_enabled === false) return { skipped: "off" };
  const days = Math.max(7, Math.min(180, Number(S?.deadline_agent_days) || 30)), limite = new Date(Date.now() - days * 864e5).toISOString();
  let q = db.from("companies").select("id, client_id, legal_name, entity_type, state, address, fiscal_year_end, formation_date, status, deadlines_checked_at, clients!inner(status, language)").in("status", ["active", "in_formation"]).eq("clients.status", "active");
  q = opts.companyId ? q.eq("id", opts.companyId) : q.or(`deadlines_checked_at.is.null,deadlines_checked_at.lt.${limite}`).order("deadlines_checked_at", { ascending: true, nullsFirst: true });
  const { data: cos, error } = await q.limit(1);
  if (error) return { error: "db", detail: error.message };
  if (!cos?.length) return { done: true };
  try { return await runCompany(db, cos[0], cos[0].clients?.language || "pt"); }
  catch (e) {
    // erro numa empresa não trava a fila: marca como verificada e segue; a equipe vê o erro no resultado
    await db.from("companies").update({ deadlines_checked_at: new Date().toISOString() }).eq("id", cos[0].id);
    console.error("deadline agent", cos[0].id, e);
    return { company_id: cos[0].id, company: cos[0].legal_name, error: String((e as Error).message || e).slice(0, 200) };
  }
}
