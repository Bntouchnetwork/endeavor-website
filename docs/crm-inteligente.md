# CRM inteligente e onboarding do parceiro (07/11/2026)

## Próximas ações (Dashboard e CRM)
Lista automática do que precisa da sua atenção, por prioridade:
- **Contatos sem resposta:** lead novo sem resposta há mais de 1 dia, e lead parado há 7 dias.
- **Parceiros em andamento:**
  - interessado no Programa de Parceiros que já fez a conversa (botão "Criar parceiro e enviar convite");
  - indicação nova para contatar;
  - parceiro para aprovar;
  - contrato para a Endeavor assinar;
  - parceiro fora dos EUA aguardando o link do Global Payouts.
- **Pagamentos:** proposta sem resposta há 5 dias e comissão para repassar.

## Automações (CRM → Automações)
Rodam sozinhas a cada 10 minutos (função `crm` + pg_cron). Cada mensagem sai uma vez só e fica registrada.
1. **Follow-up de leads:** no 2º e no 7º dia (ajustável), para quem continua como *Novo* e sem agendamento. O e-mail convida para agendar a conversa. Para quando a pessoa agenda, quando o status muda ou quando você marca "Parar follow-ups".
2. **Avisos ao parceiro em cada etapa:** em contato, proposta enviada, virou cliente, em processamento, concluída, pagamento confirmado e comissão enviada.
3. **Lembretes de onboarding do parceiro:** no 3º e no 7º dia, para criar a senha, escolher como recebe, conectar o Stripe e assinar o contrato.
4. **WhatsApp:** o mesmo aviso, quando a Meta aprovar a conta e o modelo de mensagem `endeavor_status_update`, que tem 2 variáveis: nome e mensagem. Depois disso, é só ligar a opção "Também por WhatsApp".

Nada anterior a 07/11/2026 é enviado, para não disparar mensagens antigas.

## Dentro do lead
- **✦ Sugerir com IA:**
  - faz um resumo do contato e indica o próximo passo;
  - sugere o tipo e o status (botão "Aplicar");
  - escreve um rascunho de resposta no idioma do contato.
- **Responder por e-mail:** o e-mail sai de support@endeavorbiz.com com o layout da Endeavor e fica no histórico do lead.
- **Novo tipo "Parceiro (prospect)":** é marcado sozinho quando a pessoa agenda com o assunto "Programa de Parceiros". O botão "Criar parceiro e enviar convite" já preenche o cadastro.

## Onboarding do parceiro ("Comece aqui" no portal)
- No primeiro acesso, o portal abre direto nessa página.
- **Vídeo de apresentação:** você define em CRM → Automações (ou Parceiros → "Vídeo e automações"). Pode ser um link do YouTube ou Vimeo, ou um arquivo MP4 de até 50 MB.
- **Passos:**
  1. acesso;
  2. vídeo;
  3. como recebe;
  4. contrato;
  5. aprovação.
- **Como recebe:**
  - Conta nos EUA (e Canadá, Reino Unido, Europa): Stripe Connect, com repasse automático.
  - Brasil e América Latina: Stripe Global Payouts. A Endeavor cadastra o parceiro como destinatário no Stripe, o Stripe manda o link para ele informar o banco, e você usa "Marcar repasse feito" na fatura. O pagamento em reais (BRL) depende da liberação do Stripe.
  - Chave Pix opcional, só do tipo e-mail, celular ou aleatória (CPF não), guardada para quando a integração Pix existir (dLocal ou outro).
- Quando tudo está concluído, a conta fica ativa e a página sai do topo do menu.
