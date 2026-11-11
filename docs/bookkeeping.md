# Endeavor Bookkeeping

Contabilidade das empresas dos clientes dentro do admin, no padrão QuickBooks (partidas dobradas). Menu **Bookkeeping**.

## Como ligar para uma empresa
- Admin → Clientes → cliente → **Contabilidade e relatórios** → **Conectar ao Endeavor Bookkeeping** (ou no próprio Bookkeeping, "Ativar Endeavor Bookkeeping").
- O plano de contas padrão de uma LLC americana é criado na hora (contas 1000–8100). Dá para criar, editar e desativar contas.
- A outra opção continua sendo **Conectar QuickBooks** (a Endeavor precisa ter acesso à conta do cliente como contador convidado).
- O cliente não conecta nada: no portal ele só vê os relatórios publicados.

## Abas
| Aba | O que faz |
|---|---|
| Visão geral | Saldo nos bancos, transações para revisar, receita, despesas e lucro do ano |
| Bancos e transações | Contas conectadas; fila **Para revisar / Lançadas / Excluídas**; aceitar, criar regra, excluir, desfazer; **Sugerir com IA**; importar CSV |
| Plano de contas | Contas por tipo com saldo; razão (ledger) de cada conta |
| Lançamentos | Diário com lançamentos manuais, de ajuste e saldo inicial; anular |
| Conciliação | Data e saldo do extrato, marcar itens, diferença precisa ser zero para concluir |
| Relatórios | P&L, Balanço, Fluxo de caixa, Balancete; exportar CSV; **Publicar para o cliente** (PDFs em Documentos) |
| Regras | "Se a descrição contiver X, usar a conta Y" |

## Sugestões de categoria (nesta ordem)
1. Regra da empresa.
2. Histórico: a mesma descrição já lançada antes.
3. IA (Claude Haiku), com confiança e motivo. Roda ao sincronizar e no botão "Sugerir com IA". Nada é lançado sem alguém aceitar.

## Conexão bancária
- **Stripe Financial Connections** (padrão): usa as chaves Stripe que já estão no Supabase. Precisa estar habilitado na conta Stripe (Dashboard → Financial Connections).
- **Plaid** (opcional): adicionar em Supabase → Edge Functions → Secrets: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (`sandbox` ou `production`). Os tokens ficam numa tabela que só o servidor lê.
- **CSV**: conta manual + importação de extrato com mapeamento de colunas.
- Sincronização automática diária (cron `books-sync`, 9:17 UTC).

## Peças
- Banco: tabelas `bk_*`, funções `bk_*` (lançamentos só por funções que validam débito = crédito), migração `20261110_review_and_bookkeeping.sql`.
- Função: `supabase/functions/books` (Stripe/Plaid, IA, PDFs).
- Admin: `admin-books.js`; Clientes → Contabilidade e relatórios em `admin-clients.js`.

## Revisão de 10/11 (mesma entrega)
- Parceiro de indicação entra só com senha; verificação em duas etapas opcional em Minha conta. Colaborador de cliente continua obrigado.
- E-mail de acesso ao portal e de "Esqueci a senha" com a marca da Endeavor, no idioma do cliente, com o passo a passo do autenticador.
- Portal do cliente: contador de documentos novos; prazos fiscais com status (Pendente, Vencido, Concluído em dd/mm) e visão Calendário; relatórios sem botão de QuickBooks.
- Admin: EIN com máscara 12-3456789, lista de estados, prazos com "✓ Concluído".
- Pendente: busca de endereço com Google Places (precisa da chave do Google Maps).
