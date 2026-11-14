// Web Meeting: integrações do painel de ações (servidor).
// As regras (o que falta, quem pode, idempotência, ata) ficam em acoes-core.js, o mesmo arquivo usado na sala.
// Aqui ficam só as conexões reais: e-mail, propostas e cobranças (função payments), assinatura (envelopes),
// documentos (link seguro), agenda (salas agendadas + agenda da Endeavor), tarefas e CRM.
import "./acoes-core.js";
import nodemailer from "npm:nodemailer@6.9.16";
import * as PDFLib from "npm:pdf-lib@1.17.1";

// deno-lint-ignore no-explicit-any
type Any = any;
export const A: Any = (globalThis as Any).EMeetAcoes;

const SITE = (Deno.env.get("SITE_URL") ?? "https://endeavorbiz.com").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO";
const SES_HOST = Deno.env.get("SES_SMTP_HOST") ?? "", SES_USER = Deno.env.get("SES_SMTP_USER") ?? "", SES_PASS = Deno.env.get("SES_SMTP_PASS") ?? "";
const G_USER = Deno.env.get("SMTP_USER") ?? "support@endeavorbiz.com";
const G_PASS = (Deno.env.get("SMTP_PASS") ?? "").replace(/\s+/g, "");
const sesOn = () => !!(SES_HOST && SES_USER && SES_PASS);
export const mailOn = () => sesOn() || G_PASS.length >= 8;
let tr: Any = null;
const transport = () => (tr ??= sesOn()
  ? nodemailer.createTransport({ host: SES_HOST, port: 465, secure: true, auth: { user: SES_USER, pass: SES_PASS } })
  : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: G_USER, pass: G_PASS } }));
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function moldura(titulo: string, corpoHtml: string, cta?: { rot: string; url: string }) {
  const btn = cta ? `<p style="margin:22px 0 6px"><a href="${esc(cta.url)}" style="display:inline-block;background:#0b1f3a;color:#fff;padding:13px 22px;border-radius:10px;font:700 15px Arial,sans-serif;text-decoration:none">${esc(cta.rot)}</a></p>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;background:#eef1f6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;border:1px solid #e3e7ee">
<tr><td style="padding:20px 28px;border-bottom:1px solid #eef0f4"><img src="${SITE}/logo-endeavor-3000px.png" alt="Endeavor Business Solutions" width="180" style="display:block;width:180px;height:auto"></td></tr>
<tr><td style="padding:24px 28px;font:15px/1.6 Arial,sans-serif;color:#1f2937">${corpoHtml}${btn}</td></tr>
<tr><td style="padding:14px 28px 22px;font:12px/1.5 Arial,sans-serif;color:#6b7280;border-top:1px solid #eef0f4">Endeavor Business Solutions · Orlando, FL</td></tr></table></td></tr></table></body></html>`;
}
export async function enviarEmail(para: string[], assunto: string, texto: string, html?: string, replyTo?: string) {
  if (!mailOn()) throw new Error("E-mail não configurado no servidor.");
  const from = sesOn() ? "support@endeavorbiz.com" : G_USER;
  // um e-mail por destinatário: ninguém vê o endereço dos outros
  for (const to of para) {
    await transport().sendMail({ from: { name: "Endeavor Business Solutions", address: from }, to, subject: assunto, text: texto,
      html: html || moldura(assunto, texto.split("\n").map((l) => l.trim() ? `<p style="margin:0 0 10px">${esc(l)}</p>` : "").join("")), replyTo: replyTo || undefined });
  }
}

const tokenNovo = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
const dataHora = (iso: string, tz: string) => {
  try { return new Intl.DateTimeFormat("pt-BR", { timeZone: tz || "America/New_York", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso)); }
  catch { return new Date(iso).toUTCString(); }
};
const partesNoFuso = (d: Date, tz: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`, h: Number(p.hour) % 24, dow: new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay() };
};
function inicioDe(o: Any) {
  const d = new Date(String(o.inicio_iso || ""));
  if (isNaN(d.getTime())) throw new Error("Data e hora inválidas.");
  if (d.getTime() < Date.now() - 5 * 60_000) throw new Error("Essa data já passou.");
  return d;
}

/** Monta as conexões e as integrações para a sala. sessao = usuário do Supabase (admin da Endeavor ou equipe da empresa). */
export async function integracoes(o: { db: Any; r: Any; sessao: Any; quem: string; jwtSessao: string }) {
  const { db, r, sessao } = o;
  const admin = !!sessao?.admin;
  const { data: st } = admin ? await db.from("stripe_settings").select("account_id, charges_enabled").eq("id", 1).maybeSingle() : { data: null };
  let crmEmpresa = false;
  if (r.client_id) { const { data: s } = await db.from("client_services").select("id").eq("client_id", r.client_id).eq("product_code", "crm").eq("status", "active").limit(1); crmEmpresa = !!s?.length; }
  const conexoes = {
    email: mailOn(), tarefas: true, documentos: true, agenda: true,
    crm: r.client_id ? crmEmpresa : true,
    proposta: admin, cobranca: admin && !!st?.account_id && !!st?.charges_enabled, assinatura: admin && mailOn(),
  };
  const replyTo = sessao?.email || undefined;

  // payments com a sessão do admin (as mesmas regras e e-mails do módulo de Pagamentos)
  async function payments(body: Any) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/payments`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + o.jwtSessao }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error === "forbidden" ? "Sem permissão no módulo de Pagamentos." : `Pagamentos recusou (${j.error || res.status}).`);
    return j;
  }
  // cliente (ou prospect) pelo e-mail; cria o lead e o prospect quando ainda não existe
  async function clientePorEmail(email: string, nome: string) {
    const e = email.toLowerCase();
    const { data: c } = await db.from("clients").select("id, status").ilike("primary_email", e).neq("status", "archived").limit(1);
    if (c?.length) return c[0].id;
    let { data: l } = await db.from("leads").select("id").ilike("email", e).limit(1).then((x: Any) => ({ data: x.data?.[0] }));
    if (!l) {
      const ins = await db.from("leads").insert({ name: (nome || e.split("@")[0]).slice(0, 200), email: e, source: "manual", status: "qualified", kind: "lead", language: "pt",
        notes: `Criado pelo Web Meeting (${r.title}).` }).select("id").single();
      if (ins.error) throw new Error("Não foi possível criar o contato: " + ins.error.message);
      l = ins.data;
    }
    const { data: id, error } = await sessao.user.rpc("admin_prospect_for_proposal", { p_lead: l.id });
    if (error || !id) throw new Error("Não foi possível preparar o cliente da proposta.");
    return id as string;
  }
  const itensPagamento = (itens: Any[]) => itens.map((i: Any) => ({ description: String(i.descricao).slice(0, 300), amount_cents: Math.round(Number(i.valor_cents)), quantity: Math.max(1, Number(i.quantidade) || 1), ...(i.mensal ? { recurring: "month" } : {}) }));

  const integ = {
    registro: {
      async obter(idem: string) {
        const { data } = await db.from("meet_actions").select("status, result").eq("room_id", r.id).eq("idem", idem).maybeSingle();
        return data ? { status: data.status, resultado: data.result } : null;
      },
      async salvar(idem: string, reg: Any) {
        await db.from("meet_actions").upsert({ room_id: r.id, idem, kind: reg.tipo, status: reg.status, result: reg.resultado ?? null, error: reg.erro ? String(reg.erro).slice(0, 1000) : null,
          data: reg.dados ?? {}, created_by: o.quem, updated_at: new Date().toISOString() }, { onConflict: "room_id,idem" });
      },
    },
    email: { enviar: (m: Any) => enviarEmail(m.para, m.assunto, m.texto, m.html, replyTo) },
    proposta: {
      async criar(p: Any) {
        const items = itensPagamento(p.itens);
        const unico = items.filter((i: Any) => !i.recurring).reduce((s: number, i: Any) => s + i.amount_cents * i.quantity, 0);
        const mensal = items.filter((i: Any) => i.recurring).reduce((s: number, i: Any) => s + i.amount_cents * i.quantity, 0);
        if (unico < 1) throw new Error("A proposta precisa de pelo menos um serviço com pagamento único (os mensais começam depois do aceite).");
        const client_id = await clientePorEmail(p.email, p.cliente_nome);
        const { data, error } = await db.from("proposals").insert({ client_id, title: String(p.titulo).slice(0, 200), intro: p.observacoes || null, included: [], items, total_cents: unico, monthly_cents: mensal,
          currency: p.moeda || "usd", terms: null, language: "pt", days_until_due: 7, valid_until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), status: "draft", created_by: sessao.email }).select("id").single();
        if (error) throw new Error("Não foi possível criar a proposta: " + error.message);
        return { id: data.id };
      },
      async enviar(id: string) {
        await payments({ action: "proposal_send", proposal_id: id });
        const { data } = await db.from("proposals").select("token").eq("id", id).maybeSingle();
        return { link: data?.token ? `${SITE}/proposal.html?t=${data.token}` : "" };
      },
    },
    cobranca: {
      async criar(c: Any) {
        const client_id = await clientePorEmail(c.email, c.cliente_nome);
        const j = await payments({ action: "invoice_create", client_id, items: itensPagamento(c.itens).map(({ recurring: _r, ...i }: Any) => i), days_until_due: c.vencimento_dias, description: c.descricao });
        return { id: j.id };
      },
      async enviar(id: string) {
        await payments({ action: "invoice_send", invoice_id: id });
        const { data } = await db.from("invoices").select("hosted_invoice_url").eq("id", id).maybeSingle();
        return { link: data?.hosted_invoice_url || "" };
      },
    },
    contrato: {
      async enviar(c: Any) {
        const pdf = await pdfContrato(c.titulo, c.texto);
        const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", pdf.bytes as unknown as ArrayBuffer)), (b) => b.toString(16).padStart(2, "0")).join("");
        const path = `meet/${r.id}/contrato-${Date.now()}.pdf`;
        const up = await db.storage.from("documents").upload(path, pdf.bytes, { contentType: "application/pdf", upsert: false });
        if (up.error) throw new Error("Não foi possível guardar o contrato: " + up.error.message);
        const { data: cl } = await db.from("clients").select("id").ilike("primary_email", c.email).limit(1);
        const { data: env, error } = await db.from("envelopes").insert({ title: String(c.titulo).slice(0, 200), signer_name: c.cliente_nome, signer_email: c.email, message: "Contrato combinado na reunião " + r.title,
          document_path: path, document_sha256: sha, fields: pdf.fields, id_stamped: false, created_by: "web-meeting", client_id: cl?.[0]?.id || null }).select("id, token, token_expires_at").single();
        if (error) throw new Error("Não foi possível criar o envelope de assinatura: " + error.message);
        await db.from("envelope_events").insert({ envelope_id: env.id, event: "sent", details: { via: "web-meeting", room: r.slug } });
        const link = `${SITE}/sign.html?t=${env.token}&lang=pt`;
        await enviarEmail([c.email], c.titulo + " para assinatura", `Olá, ${c.cliente_nome}.\n\nSegue o contrato combinado na nossa reunião para você revisar e assinar eletronicamente:\n${link}\n\nO link vale por 30 dias.`,
          moldura(c.titulo, `<p>Olá, ${esc(c.cliente_nome)}.</p><p>Segue o contrato combinado na nossa reunião para você revisar e assinar eletronicamente. O link vale por 30 dias.</p>`, { rot: "Revisar e assinar", url: link }), replyTo);
        await db.from("envelope_events").insert({ envelope_id: env.id, event: "emailed", details: { to: c.email, via: "web-meeting" } });
        return { id: env.id };
      },
    },
    documentos: {
      async solicitar(p: Any) {
        const token = tokenNovo();
        const itens = (p.itens as string[]).slice(0, 15).map((n) => ({ nome: String(n).slice(0, 80), status: "pendente", arquivos: [] }));
        const { data, error } = await db.from("meet_doc_requests").insert({ room_id: r.id, client_id: r.client_id, token, email: p.email, name: p.nome || null, items: itens, message: p.mensagem || null, created_by: o.quem }).select("id").single();
        if (error) throw new Error("Não foi possível criar o pedido de documentos: " + error.message);
        const link = `${SITE}/enviar-documentos.html?t=${token}`;
        const lista = itens.map((i) => "- " + i.nome).join("\n");
        await enviarEmail([p.email], "Documentos para enviar com segurança", `Olá${p.nome ? ", " + p.nome : ""}.\n\nComo combinado na reunião, envie os documentos abaixo pelo link seguro:\n${lista}\n\n${link}\n\nO link vale por 14 dias. Não mande documentos nem números (SSN, ITIN, passaporte, conta bancária) por e-mail ou chat: use só o link.`,
          moldura("Documentos para enviar", `<p>Olá${p.nome ? ", " + esc(p.nome) : ""}.</p><p>Como combinado na reunião, envie estes documentos pelo link seguro:</p><ul>${itens.map((i) => `<li>${esc(i.nome)}</li>`).join("")}</ul><p style="font-size:13px;color:#6b7280">O link vale por 14 dias. Não mande documentos nem números (SSN, ITIN, passaporte, conta bancária) por e-mail ou chat: use só o link.</p>`, { rot: "Enviar documentos", url: link }), replyTo);
        return { id: data.id, link };
      },
    },
    agenda: {
      async livre(q: Any) {
        const ini = inicioDe(q), dur = Math.max(15, Math.min(240, Number(q.duracao_min) || 30)) * 60_000, tz = q.tz || "America/New_York";
        const ocupado = async (t: Date) => {
          const de = new Date(t.getTime() - dur + 1).toISOString(), ate = new Date(t.getTime() + dur - 1).toISOString();
          let qr = db.from("meet_rooms").select("id").eq("kind", "scheduled").neq("status", "ended").gte("scheduled_at", de).lte("scheduled_at", ate);
          qr = r.client_id ? qr.eq("client_id", r.client_id) : qr.is("client_id", null);
          if (q.ignorar) qr = qr.neq("id", q.ignorar);
          const { data: salas } = await qr.limit(1);
          if (salas?.length) return true;
          if (!r.client_id) {
            const { data: bk } = await db.from("bookings").select("id").eq("status", "confirmed").lt("starts_at", new Date(t.getTime() + dur).toISOString()).gt("ends_at", t.toISOString()).limit(1);
            if (bk?.length) return true;
          }
          return false;
        };
        if (!await ocupado(ini)) return { ok: true };
        // sugere os próximos horários livres em dias úteis, das 9h às 18h no fuso do organizador
        const sugestoes: Any[] = [];
        for (let k = 1; k < 16 * 5 && sugestoes.length < 3; k++) {
          const t = new Date(ini.getTime() + k * 30 * 60_000), p = partesNoFuso(t, tz);
          if (p.dow === 0 || p.dow === 6 || p.h < 9 || p.h >= 18) continue;
          if (!await ocupado(t)) sugestoes.push({ data: p.data, hora: p.hora, inicio_iso: t.toISOString() });
        }
        return { ok: false, sugestoes };
      },
      async criar(q: Any) {
        const ini = inicioDe(q);
        const a = "abcdefghjkmnpqrstuvwxyz23456789", rnd = crypto.getRandomValues(new Uint8Array(10));
        const slug = "eb-" + Array.from(rnd, (x) => a[x % a.length]).join("");
        const { data, error } = await db.from("meet_rooms").insert({ slug, client_id: r.client_id, title: String(q.titulo).slice(0, 120), kind: "scheduled", scheduled_at: ini.toISOString(), status: "scheduled",
          created_by: sessao?.id || r.created_by, created_by_email: sessao?.email || r.created_by_email }).select("id, slug").single();
        if (error) throw new Error("Não foi possível agendar: " + error.message);
        const link = `${SITE}/reuniao.html?s=${data.slug}`, quando = dataHora(ini.toISOString(), q.tz);
        if (q.convidados?.length) await enviarEmail(q.convidados, "Convite: " + q.titulo, `Você foi convidado para "${q.titulo}".\nQuando: ${quando}\nEntrar: ${link}`,
          moldura("Convite", `<p>Você foi convidado para <b>${esc(q.titulo)}</b>.</p><p>Quando: ${esc(quando)}</p>`, { rot: "Entrar na reunião", url: link }), replyTo);
        return { id: data.id, link };
      },
      async remarcar(q: Any) {
        const ini = inicioDe(q);
        let qr = db.from("meet_rooms").select("id, slug, title, client_id, status").eq("id", String(q.id || ""));
        const { data: alvo } = await qr.maybeSingle();
        if (!alvo || (alvo.client_id || null) !== (r.client_id || null)) throw new Error("Reunião para remarcar não encontrada.");
        if (alvo.status === "ended") throw new Error("Essa reunião já foi encerrada.");
        const { error } = await db.from("meet_rooms").update({ scheduled_at: ini.toISOString(), kind: "scheduled" }).eq("id", alvo.id);
        if (error) throw new Error("Não foi possível remarcar: " + error.message);
        // avisa quem foi convidado quando a reunião foi agendada pelo painel
        const { data: orig } = await db.from("meet_actions").select("data, result").eq("kind", "reuniao").eq("status", "concluida").contains("result", { reuniao_id: alvo.id }).limit(1);
        const avisados: string[] = orig?.[0]?.result?.enviado_para || [];
        const link = `${SITE}/reuniao.html?s=${alvo.slug}`, quando = dataHora(ini.toISOString(), q.tz);
        if (avisados.length) await enviarEmail(avisados, "Reunião remarcada: " + alvo.title, `A reunião "${alvo.title}" foi remarcada.\nNovo horário: ${quando}\nEntrar: ${link}`,
          moldura("Reunião remarcada", `<p>A reunião <b>${esc(alvo.title)}</b> foi remarcada.</p><p>Novo horário: ${esc(quando)}</p>`, { rot: "Entrar na reunião", url: link }), replyTo);
        qr = null;
        return { id: alvo.id, link, avisados };
      },
    },
    tarefas: {
      async criar(t: Any) {
        const { data, error } = await db.from("meet_tasks").insert({ room_id: r.id, client_id: r.client_id, title: String(t.titulo).slice(0, 300), owner_name: t.responsavel || null,
          owner_email: t.responsavel_email || null, due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.prazo || "") ? t.prazo : null, source: t.origem || null, created_by: o.quem }).select("id").single();
        if (error) throw new Error("Não foi possível criar a tarefa: " + error.message);
        return { id: data.id };
      },
    },
    crm: {
      disponivel: conexoes.crm,
      async registrar(c: Any) {
        const e = String(c.email).toLowerCase(), hoje = new Date().toISOString().slice(0, 10);
        const linha = `[${hoje}] Web Meeting "${r.title}": ${[c.nota, c.proxima_acao && "próxima ação: " + c.proxima_acao, c.prazo && "prazo " + c.prazo].filter(Boolean).join("; ")}`;
        if (!r.client_id) {
          const { data: l } = await db.from("leads").select("id, notes").ilike("email", e).limit(1);
          if (l?.length) { await db.from("leads").update({ notes: ((l[0].notes ? l[0].notes + "\n" : "") + linha).slice(-20000), last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", l[0].id); return { id: l[0].id, criado: false }; }
          const { data, error } = await db.from("leads").insert({ name: (c.nome || e.split("@")[0]).slice(0, 200), email: e, source: "manual", status: "contacted", kind: "lead", language: "pt", notes: linha, last_contact_at: new Date().toISOString() }).select("id").single();
          if (error) throw new Error("CRM: " + error.message);
          return { id: data.id, criado: true };
        }
        const { data: ct } = await db.from("ct_contacts").select("id, notes").eq("client_id", r.client_id).ilike("email", e).limit(1);
        const prox = c.proxima_acao ? String(c.proxima_acao).slice(0, 300) : null, quando = /^\d{4}-\d{2}-\d{2}$/.test(c.prazo || "") ? c.prazo + "T12:00:00Z" : null;
        if (ct?.length) { await db.from("ct_contacts").update({ notes: ((ct[0].notes ? ct[0].notes + "\n" : "") + linha).slice(-4000), ...(prox ? { next_action: prox, next_action_at: quando } : {}), updated_at: new Date().toISOString() }).eq("id", ct[0].id); return { id: ct[0].id, criado: false }; }
        const { data, error } = await db.from("ct_contacts").insert({ client_id: r.client_id, name: (c.nome || e.split("@")[0]).slice(0, 160), email: e, stage: "new", source: "web-meeting", next_action: prox, next_action_at: quando, notes: linha.slice(0, 4000) }).select("id").single();
        if (error) throw new Error("CRM: " + error.message);
        return { id: data.id, criado: true };
      },
    },
    ata: {
      async salvar(ata: Any) { await db.from("meet_summaries").insert({ room_id: r.id, summary: A.ataTexto(ata), transcript: [], polls: [], timers: [] }); },
    },
  };
  return { conexoes, admin, integ };
}

/* ---------------- contrato em PDF (texto simples, campo de assinatura na última página) ---------------- */
async function pdfContrato(titulo: string, texto: string) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(titulo); doc.setCreator("Endeavor Business Solutions · Web Meeting");
  const fonte = await doc.embedFont(StandardFonts.Helvetica), negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 64, tam = 11, alt = 16;
  const seguro = (s: string) => s.replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, (c) => ({ "–": "-", "—": "-", "’": "'", "“": '"', "”": '"', "…": "..." }[c] || "?"));
  let pg = doc.addPage([W, H]), y = H - M;
  const quebrar = (linha: string, f: Any) => {
    const out: string[] = []; let atual = "";
    for (const p of linha.split(" ")) { const t = atual ? atual + " " + p : p; if (f.widthOfTextAtSize(t, tam) > W - 2 * M) { out.push(atual); atual = p; } else atual = t; }
    out.push(atual); return out;
  };
  const linhas = seguro(texto).split("\n");
  linhas.forEach((l, i) => {
    const f = i === 0 ? negrito : fonte;
    for (const parte of l ? quebrar(l, f) : [""]) {
      if (y < M + 140) { pg = doc.addPage([W, H]); y = H - M; }
      pg.drawText(parte, { x: M, y, size: i === 0 ? 13 : tam, font: f, color: rgb(0.1, 0.12, 0.16) }); y -= i === 0 ? 24 : alt;
    }
  });
  // bloco de assinatura
  y -= 30;
  pg.drawLine({ start: { x: M, y }, end: { x: M + 260, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.35) });
  pg.drawText("Assinatura do contratante", { x: M, y: y - 14, size: 9, font: fonte, color: rgb(0.4, 0.4, 0.45) });
  const paginas = doc.getPageCount(), sigY = y + 4;
  const fields = [
    { id: "sig-0", page: paginas, type: "signature", label: "Signature", required: true, x: M / W, y: (H - sigY - 40) / H, w: 260 / W, h: 38 / H },
    { id: "name-0", page: paginas, type: "name", label: "Name", required: true, x: M / W, y: (H - (y - 34)) / H, w: 260 / W, h: 14 / H },
    { id: "date-0", page: paginas, type: "date", label: "Date", required: true, x: (M + 300) / W, y: (H - sigY - 18) / H, w: 150 / W, h: 16 / H },
  ];
  return { bytes: await doc.save(), fields };
}

/* ---------------- envio de documentos pelo link seguro (página pública) ---------------- */
const TIPOS_OK = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
async function pedidoPorToken(db: Any, t: unknown) {
  const token = String(t || "");
  if (!/^[0-9a-f]{64}$/.test(token)) throw Object.assign(new Error("Link inválido."), { status: 404 });
  const { data } = await db.from("meet_doc_requests").select("*, meet_rooms(title, client_id, clients(name))").eq("token", token).maybeSingle();
  if (!data) throw Object.assign(new Error("Link inválido."), { status: 404 });
  if (data.status === "cancelado") throw Object.assign(new Error("Este pedido foi cancelado."), { status: 410 });
  if (new Date(data.expires_at) < new Date() && data.status !== "concluido") throw Object.assign(new Error("Este link expirou. Peça um novo a quem enviou."), { status: 410 });
  return data;
}
const mascarar = (e: string) => { const [u, d] = e.split("@"); return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d; };
export async function docsPublico(db: Any, b: Any) {
  const p = await pedidoPorToken(db, b.t);
  const itens: Any[] = p.items || [];
  if (b.acao === "docs_info") {
    return { empresa: p.meet_rooms?.client_id ? p.meet_rooms?.clients?.name : "Endeavor Business Solutions", reuniao: p.meet_rooms?.title, para: mascarar(p.email), nome: p.name || "",
      itens: itens.map((i, k) => ({ k, nome: i.nome, status: i.status, arquivos: (i.arquivos || []).map((a: Any) => ({ nome: a.nome, tamanho: a.tamanho })) })), status: p.status, expira: p.expires_at, mensagem: p.message || "" };
  }
  const k = Number(b.item);
  if (!Number.isInteger(k) || !itens[k]) throw Object.assign(new Error("Documento não encontrado."), { status: 400 });
  if (b.acao === "docs_upload_url") {
    const tipo = String(b.tipo || ""), tam = Number(b.tamanho || 0);
    if (!TIPOS_OK.includes(tipo)) throw Object.assign(new Error("Formato não aceito. Use PDF, JPG, PNG, HEIC ou Word."), { status: 400 });
    if (!(tam > 0 && tam <= 25 * 1024 * 1024)) throw Object.assign(new Error("Arquivo muito grande. O limite é 25 MB."), { status: 400 });
    if ((itens[k].arquivos || []).length >= 5) throw Object.assign(new Error("Limite de 5 arquivos por documento."), { status: 400 });
    const nome = String(b.nome || "arquivo").normalize("NFD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-80) || "arquivo";
    const path = `${p.id}/${k}-${crypto.randomUUID().slice(0, 8)}-${nome}`;
    const { data, error } = await db.storage.from("meet-documents").createSignedUploadUrl(path);
    if (error) throw new Error("Não foi possível preparar o envio.");
    return { path, url: data.signedUrl, token: data.token };
  }
  if (b.acao === "docs_confirmar") {
    const path = String(b.path || "");
    if (!path.startsWith(p.id + "/" + k + "-")) throw Object.assign(new Error("Envio inválido."), { status: 400 });
    const pasta = path.slice(0, path.lastIndexOf("/")), arq = path.slice(path.lastIndexOf("/") + 1);
    const { data: lista } = await db.storage.from("meet-documents").list(pasta, { search: arq, limit: 1 });
    const obj = lista?.find((x: Any) => x.name === arq);
    if (!obj) throw Object.assign(new Error("O arquivo não chegou. Tente de novo."), { status: 400 });
    itens[k].arquivos = [...(itens[k].arquivos || []).filter((a: Any) => a.path !== path), { path, nome: arq.replace(/^\d+-[0-9a-f]{8}-/, ""), tamanho: obj.metadata?.size || 0, em: new Date().toISOString() }];
    itens[k].status = "recebido";
    const completo = itens.every((i) => i.status === "recebido");
    await db.from("meet_doc_requests").update({ items: itens, status: completo ? "concluido" : "pendente", updated_at: new Date().toISOString() }).eq("id", p.id);
    if (completo && p.created_by && mailOn()) {
      // avisa quem pediu (equipe), sem anexar nada
      const { data: sala } = await db.from("meet_rooms").select("created_by_email, title").eq("id", p.room_id).maybeSingle();
      if (sala?.created_by_email) await enviarEmail([sala.created_by_email], "Documentos recebidos: " + (p.name || p.email), `Todos os documentos pedidos na reunião "${sala.title}" chegaram pelo link seguro. Veja no painel do Web Meeting, em Detalhes da sala.`).catch(() => {});
    }
    return { ok: true, completo };
  }
  throw Object.assign(new Error("Ação desconhecida."), { status: 400 });
}

/** Link para a equipe abrir um arquivo recebido (10 minutos). */
export async function docArquivoUrl(db: Any, reqId: string, path: string) {
  if (!path.startsWith(reqId + "/")) throw new Error("Arquivo não encontrado.");
  const { data, error } = await db.storage.from("meet-documents").createSignedUrl(path, 600);
  if (error) throw new Error("Arquivo não encontrado.");
  return data.signedUrl;
}
