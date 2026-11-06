# Marketing (campanhas de e-mail) — Endeavor

Aba **Marketing** no admin. Envio próprio pela **Amazon SES**. O convite direto em "Novo parceiro" continua igual.

## O que tem
- **Contatos e listas**: importar CSV/Excel (.xlsx), com detecção de colunas, tipo e idioma padrão e confirmação de consentimento. Também dá para adicionar e editar contatos e exportar CSV.
- **Campanhas**: modelo pronto "Programa de parceiros" (PT/EN/ES, no idioma de cada contato) ou modelo personalizado. Campos {{nome}} e {{empresa}}. Prévia, envio de teste, agendamento ou envio imediato, pausar, retomar, cancelar e duplicar.
- **Relatório por campanha**: enviados, aberturas, cliques e descadastros, com tabela por lead, filtros e exportação CSV.
- **Descadastro**: link no rodapé (página `unsubscribe.html`) e cabeçalho one-click (Gmail/Apple). Contatos descadastrados nunca recebem.
- **Ritmo**: limite por minuto e por dia (padrão 50/min). O pg_cron `marketing-send` roda a cada minuto.

## Conectar a Amazon SES (passo a passo)
1. Criar uma conta AWS em aws.amazon.com e escolher a região **us-east-1** (N. Virginia).
2. **SES → Identities → Create identity → Domain**: `endeavorbiz.com`, com Easy DKIM (RSA 2048).
3. Copiar os **3 registros CNAME de DKIM** para o DNS do domínio (Squarespace → Domains → DNS). Recomendado também: um MAIL FROM personalizado (ex.: `mail.endeavorbiz.com`, com MX + TXT SPF) e um registro DMARC `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:support@endeavorbiz.com`.
4. Esperar o status ficar **Verified**.
5. **SES → Account dashboard → Request production access**. Explicar: e-mails B2B para parceiros com opt-in e relação comercial, com link de descadastro e tratamento de bounces. Enquanto isso, a conta fica em sandbox e só envia para endereços verificados.
6. **SES → SMTP settings → Create SMTP credentials**. Isso gera um usuário e uma senha SMTP. O host é `email-smtp.us-east-1.amazonaws.com`.
7. No **Supabase → Edge Functions → Secrets**, você mesmo cria 3 secrets: `SES_SMTP_HOST`, `SES_SMTP_USER` e `SES_SMTP_PASS`. Não cole esses valores no chat.
8. No admin → Marketing → Envio e configurações → **Verificar conexão**.

## Recomendações
- Remetente: `partners@endeavorbiz.com`. Usar outro endereço protege o support@.
- Comece devagar: ~200 por dia nas primeiras semanas, subindo aos poucos.
- Só contatos com relação ou interesse legítimo. Nada de listas compradas.
- O envio de teste já funciona hoje pelo Gmail do support.
