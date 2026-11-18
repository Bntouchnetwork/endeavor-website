// Camada de provedor da Telefonia. A tela e o resto do sistema falam só com esta interface.
// Fase 1: só o provedor de DEMONSTRAÇÃO funciona. O da Telnyx informa o estado e recusa operações reais até a Fase 2.
import { numerosDemo } from "./regras.ts";

export type EstadoProvedor = { provedor: "demo" | "telnyx"; estado: "demonstracao" | "nao_configurado" | "configurado_nao_verificado" | "teste" | "conectado"; texto: string; faltando: string[] };
export type NumeroDisponivel = { e164: string; tipo: "local" | "tollfree"; regiao: string; custo_mensal: number | null; demo: boolean };

export interface Provedor {
  nome: "demo" | "telnyx";
  estado(): Promise<EstadoProvedor>;
  buscarNumeros(tipo: "local" | "tollfree", prefixo: string): Promise<NumeroDisponivel[]>;
  /** compra real: só depois da aprovação de um Super Admin e, na fase 1, nunca */
  comprarNumero(e164: string): Promise<{ provider_id: string; demo: boolean }>;
  /** credencial curta para o WebRTC do navegador (nunca a API key) */
  tokenWebRTC(usuario: string): Promise<{ demo: boolean; token: string | null; expira_em: string | null }>;
}

export const SECRETS_TELNYX = ["TELNYX_API_KEY", "TELNYX_PUBLIC_KEY", "TELNYX_CONNECTION_ID", "TELNYX_MESSAGING_PROFILE_ID"];

export const demo: Provedor = {
  nome: "demo",
  async estado() { return { provedor: "demo", estado: "demonstracao", texto: "Demonstração: nenhuma ligação, SMS ou número é real.", faltando: [] }; },
  async buscarNumeros(tipo, prefixo) {
    return numerosDemo(tipo, prefixo).map((e164) => ({ e164, tipo, regiao: tipo === "tollfree" ? "Toll-free (EUA)" : "Demonstração", custo_mensal: null, demo: true }));
  },
  async comprarNumero(e164) { return { provider_id: "demo-" + e164.slice(1), demo: true }; },
  async tokenWebRTC() { return { demo: true, token: null, expira_em: null }; },
};

export function telnyx(env: (k: string) => string | undefined): Provedor {
  const faltando = SECRETS_TELNYX.filter((k) => !env(k));
  return {
    nome: "telnyx",
    async estado() {
      if (faltando.length === SECRETS_TELNYX.length) return { provedor: "telnyx", estado: "nao_configurado", texto: "Telnyx não configurada: faltam as chaves nos Secrets do Supabase.", faltando };
      return { provedor: "telnyx", estado: "configurado_nao_verificado", texto: "Chaves da Telnyx cadastradas. A verificação da conta e a busca de números reais entram na Fase 2.", faltando };
    },
    async buscarNumeros() { throw new Error("Busca de números reais da Telnyx: Fase 2. Use o modo demonstração."); },
    async comprarNumero() { throw new Error("Compra de número real bloqueada nesta fase. Precisa da Fase 2 e da sua autorização explícita."); },
    async tokenWebRTC() { throw new Error("WebRTC da Telnyx: Fase 3."); },
  };
}
