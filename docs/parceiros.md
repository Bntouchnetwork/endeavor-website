# Programa de Parceiros: cadastro, aprovação e contrato

## Fluxo
1. **Cadastro** (`partners.html`, botão "Parceiros" no topo da home e CTA "Quero ser parceiro" dos e-mails). O parceiro preenche o formulário (nome, e-mail, WhatsApp, empresa, profissão, país, idioma) e escolhe o horário da **conversa de onboarding**.
   - O parceiro é criado como **Aguardando aprovação**, com comissão **a definir** (`program_status = pending`, `default_share_pct = null`).
   - O agendamento entra na Agenda, com tópico "Partner onboarding". A confirmação e os lembretes saem como em qualquer agendamento.
   - O e-mail de boas-vindas (PT/EN/ES, com cópia para o support@) leva o link para criar a senha e os próximos passos.
   - O admin recebe o aviso no sino ("Novo parceiro").
   - Proteções: campo oculto anti-robô, tempo mínimo de preenchimento, limite de 5 cadastros por hora por rede e 60 por dia, e bloqueio de e-mail já cadastrado.
2. **Portal do parceiro (pendente)**: o painel mostra uma mensagem de boas-vindas com 4 passos.
   - Acesso criado.
   - Criar a conta Stripe, com a lista do que ter em mãos.
   - Conversa de onboarding, com a data.
   - Aprovação e contrato.
   - As indicações ficam bloqueadas até a aprovação (`submit_referral` retorna `pending_approval`).
3. **Stripe Connect**: em "Recebimentos Stripe", o parceiro clica para criar a conta Stripe Express ligada à conta da Endeavor e termina o cadastro no próprio Stripe.
   - O Stripe coleta o W-9/W-8 e pode emitir os 1099. É preciso ativar isso no painel do Stripe e confirmar com o contador.
   - Quando a conta é habilitada, o portal mostra a confirmação.
   - **Pendente:** as chaves do Stripe da Endeavor no Supabase e o Connect ativado.
4. **Aprovação** (admin → Parceiros → Aprovar, ou aba Contrato): você define a comissão. Se escolher enviar o contrato, o **Referral Partner Agreement** é gerado em PDF com os dados do parceiro e a %, e vai para assinatura eletrônica.
5. **Assinaturas**: o parceiro assina primeiro. Depois o sistema cria o envelope da Endeavor e avisa o support@ por e-mail e no sino. Você assina em Parceiros → Contrato → "Assinar pela Endeavor".
   - Concluído, a cópia fica no portal do parceiro ("Baixar contrato assinado"), na aba Contrato e em Assinaturas.
   - O parceiro recebe o e-mail de confirmação.
6. Faturas e propostas **só aceitam parceiros aprovados** (há um gatilho no banco que bloqueia).

## Contrato
- Arquivo: `supabase/functions/partner-invite/partner-contract.js`, versão 2026-11-06, em inglês.
- **Rascunho: precisa da revisão de um advogado antes do uso com parceiros reais.**
- Confirmar com o advogado:
  - a razão social (Endeavor Tax Solutions LLC d/b/a Endeavor Business Solutions);
  - a base de cálculo da comissão;
  - o foro (Orange County, FL);
  - as regras de referral fee para corretores e advogados.

## Templates de marketing
- Três templates prontos na galeria: "Programa de Parceiros — Template 1, 2 e 3", em PT/EN/ES.
- O botão leva para `partners.html?lang=…#cadastro`.
- O modelo embutido "Programa de parceiros (pronto)" também aponta para o cadastro.
- Logo dos e-mails: arquivo `logo-endeavor-3000px.png` no site, versão leve de 600 px.
