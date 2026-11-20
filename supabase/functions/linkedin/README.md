# LinkedIn Manager: deploy

Módulo por empresa: página do LinkedIn (API oficial), calendário de posts, comentários e extensão do Chrome.
Uma função só, `linkedin`, reúne o que o pedido original chamava de linkedin-oauth, linkedin-calendar,
linkedin-publisher, linkedin-comments e linkedin-agent (padrão da plataforma: uma função por módulo).

## 1. Banco
Aplicar `supabase/migrations/20261205_linkedin_manager.sql`. Ela cria:
- `business_activities` (20 atividades, PT/EN/ES) e `companies.activity_code`;
- `linkedin_accounts`, `linkedin_posts`, `linkedin_comments`, `linkedin_devices`, `linkedin_log`, com RLS
  (leitura: admin ou dono da empresa; escrita: só o servidor);
- os tokens no Vault (`li_token_set` / `li_token_get`, só para o service role);
- a origem `linkedin` em `leads`;
- o cron: `linkedin-publisher` (5 min) e `linkedin-comments` (15 min), pela função `li_tick`.

O cron usa o mesmo padrão do Instagram: a chave `booking_hook_key` do Vault vai no cabeçalho `x-booking-key`.
Não é preciso `app.functions_url` nem `app.service_key`, e nenhuma chave fica no SQL.

## 2. Secrets (Supabase › Edge Functions › Secrets; nunca no chat)
| Secret | Para quê |
| --- | --- |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | app do LinkedIn (Developer Portal) |
| `LINKEDIN_REDIRECT_URI` | opcional; padrão `https://<projeto>.supabase.co/functions/v1/linkedin/oauth` |
| `APP_URL` | opcional; padrão `https://endeavorbiz.com` (para onde o LinkedIn devolve a pessoa) |
| `LINKEDIN_API_VERSION` | opcional; versão AAAAMM da API (padrão 202601) |
| `HUB_AI_API_KEY` | já existe; a IA passa pelo Hub AI (agente `linkedin-assistant`), não por `ANTHROPIC_API_KEY` direto |

## 3. App no LinkedIn (ação humana)
1. Em linkedin.com/developers, criar o app ligado à página da Endeavor.
2. Pedir o produto **Community Management API** (o LinkedIn analisa; o nível Development já permite testar).
3. Em Auth, cadastrar a Redirect URL acima, exatamente igual.
4. Escopos usados: `w_organization_social`, `r_organization_social`, `rw_organization_admin`.

## 4. Deploy da função
Função `linkedin`, com `verify_jwt` desligado (ela confere a sessão, o autenticador, a chave do cron e o token da extensão).
A função `projects` também muda (aceita `activity_code` no Add New Company).

## 5. Extensão
Pasta `li-extension/` (Manifest V3); o zip fica em `downloads/linkedin-manager.zip`.
Chrome › Extensões › Modo do desenvolvedor › Carregar sem compactação. Nas opções: URL do agente e token
(gerados em LinkedIn Manager › Configurações).

## 6. Testes
- `deno test --allow-read --allow-env --no-lock tests/linkedin.test.ts` (regras do servidor e da extensão);
- `node tests/linkedin.e2e.mjs` (painel, com a função simulada).
- RLS: ver as consultas no fim deste arquivo.

## 7. Regras que o código garante
- Nada é publicado sem aprovação; editar um post aprovado volta para rascunho.
- Respostas a comentários: manual por padrão. No automático, só sai o que passa nas regras.
- Sem promessa de resultado nem conselho jurídico/financeiro individual (o servidor barra antes de publicar).
- Mensagens privadas nunca são automáticas (servidor e extensão).
- Extensão: manual por padrão; o automático exige ligar nos dois lados e aceitar o aviso de risco;
  limite diário e intervalo mínimo conferidos no servidor.

## Validação do RLS (rodar como um usuário comum, não como service role)
```sql
-- outro cliente não vê nada; dono vê só a própria empresa; ninguém lê tokens
select count(*) from linkedin_posts;                       -- só as do dono
select token_secret_id from linkedin_accounts;             -- erro: permission denied
select token_hash from linkedin_devices;                   -- erro: permission denied
insert into linkedin_posts (company_id, client_id, body, scheduled_at) values (gen_random_uuid(), gen_random_uuid(), 'x', now()); -- erro: RLS
select * from li_token_get(gen_random_uuid());             -- erro: permission denied
```
