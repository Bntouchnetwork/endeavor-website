// My WhatsApp Manager · regras puras do servidor (testáveis sem banco e sem HUB).
import "./core.js";
// deno-lint-ignore no-explicit-any
type Any = any;
// deno-lint-ignore no-explicit-any
const C = (globalThis as any).EWaCore;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const limpo = (s: unknown, max = 2000) => C.limparSensivel(String(s ?? "")).texto.slice(0, max);
export const FERRAMENTAS = ["sugerir", "resumo", "lead", "proposta", "traduzir", "comando", "personalizar", "responder", "grupo"];
export const STATUS = ["sugerido", "aprovado", "enviado", "descartado", "escalado", "criado", "erro", "ignorado"];

export function montarEntrada(f: string, a: Any, c: { nome: string; grupo: boolean }, mensagens: Any[], extra: Any) {
  const partes = [`<modo>${f}</modo>`, `<idioma>${a.idioma}</idioma>`, `<negocio>${a.negocio}</negocio>`, `<link_agenda>${a.link_agenda}</link_agenda>`,
    `<conversa_tipo>${c.grupo ? "grupo" : "individual"}</conversa_tipo>`, `<contato>${txt(c.nome, 80)}</contato>`];
  if (extra.horarios?.length) partes.push(`<horarios>${extra.horarios.join(" | ")}</horarios>`);
  if (extra.aviso) partes.push(`<aviso_ia>${extra.aviso}</aviso_ia>`);
  if (extra.pedido) partes.push(`<pedido_do_usuario>${limpo(extra.pedido, 1500)}</pedido_do_usuario>`);
  if (extra.idioma_destino) partes.push(`<idioma_destino>${extra.idioma_destino}</idioma_destino>`);
  if (extra.base) partes.push(`<base>${limpo(extra.base, 1500)}</base>`);
  if (extra.texto) partes.push(`<texto>${limpo(extra.texto, 3000)}</texto>`);
  partes.push(`<mensagens>\n${C.montarConversa(mensagens, f === "resumo" || f === "grupo" ? 60 : 30)}\n</mensagens>`);
  return partes.join("\n");
}
/** Resposta da IA sempre no formato esperado pela extensão (e sem números sensíveis). */
export function normalizar(f: string, r: Any): Any {
  const s = (v: unknown, max = 2000) => limpo(typeof v === "string" ? v : "", max).trim();
  const lista = (v: unknown, n: number, max = 600) => (Array.isArray(v) ? v : []).map((x) => s(x, max)).filter(Boolean).slice(0, n);
  switch (f) {
    case "sugerir": return { resposta: s(r?.resposta), alternativas: lista(r?.alternativas, 3) };
    case "resumo": return { resumo: s(r?.resumo, 3000), pendencias: lista(r?.pendencias, 8, 300), interesse: s(r?.interesse, 300), proximo_passo: s(r?.proximo_passo, 300) };
    case "lead": return { nome: s(r?.nome, 120), email: EMAIL.test(String(r?.email || "")) ? s(r?.email, 160) : "", telefone: s(r?.telefone, 40), assunto: s(r?.assunto, 200), resumo: s(r?.resumo, 600) };
    case "proposta": return { mensagem: s(r?.mensagem), itens: lista(r?.itens, 10, 120) };
    case "traduzir": return { traducao: s(r?.traducao, 3000), idioma_origem: s(r?.idioma_origem, 10) };
    case "comando": {
      const acoes = ["escrever", "resumo", "lead", "proposta", "traduzir", "agendar", "nada"];
      return { acao: acoes.includes(r?.acao) ? r.acao : "escrever", texto: s(r?.texto) };
    }
    case "personalizar": return { texto: s(r?.texto) };
    case "responder": { const escalar = r?.escalar === true; const texto = s(r?.texto); return { responder: !escalar && r?.responder === true && !!texto, texto, escalar, motivo: s(r?.motivo, 200) }; }
    case "grupo": return { topicos: (Array.isArray(r?.topicos) ? r.topicos : []).slice(0, 8).map((t: Any) => ({ assunto: s(t?.assunto, 120), resumo: s(t?.resumo, 300) })).filter((t: Any) => t.assunto),
      relevante: r?.relevante === true, responder: r?.relevante === true && r?.responder === true && !!s(r?.texto), texto: s(r?.texto), motivo: s(r?.motivo, 200) };
  }
  return {};
}

