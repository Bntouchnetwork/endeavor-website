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

---

# Atualização: cadastro automático do parceiro e Agente Admin (IA)

## Fluxo do parceiro (sem agendamento antes)
1. **Cadastro:**
   - Pelo "Quero ser parceiro" (partners.html e home). O formulário é curto, com WhatsApp obrigatório e seletor de país.
   - Comissão padrão de **10%**, que você pode mudar por parceiro no admin, na edição do parceiro.
   - O parceiro também entra no CRM, como "Parceiro".
2. **E-mail de boas-vindas:** traz o link para criar a senha. A criação da senha valida o e-mail e ativa a verificação em duas etapas.
3. **"Comece aqui" no portal:** uma linha do tempo de tarefas, em que cada passo só abre depois do anterior:
   1. Acesso e e-mail validado.
   2. Vídeo.
   3. Contrato (rascunho de exemplo, gerado na hora com a comissão do parceiro e assinado online; a Endeavor contra-assina depois).
   4. Como recebe: Stripe Connect nos EUA, Canadá, Reino Unido e Europa; Global Payouts nos outros países, com chave Pix opcional.
4. **Ativação automática:** quando tudo está concluído, a conta é ativada sozinha. As indicações são liberadas e você recebe o aviso no sino.
5. **Conversa de boas-vindas:** depois da ativação aparece o botão "Agende a conversa de boas-vindas", que abre a agenda já com o nome e o e-mail preenchidos.

## Agente Admin (Agentes IA no menu do admin)
- **Acompanha cada parceiro** e mostra o passo atual, os dias parado e os lembretes já enviados.
- **Lembretes:** depois de 2 dias sem avanço (ajustável), a IA escreve um e-mail personalizado sobre o passo que falta, no idioma do parceiro. São no máximo 3.
- **Aviso para a equipe:** depois de 6 dias sem avanço (ajustável), você recebe um aviso no sino para fazer um contato pessoal.
- **Chat no portal:**
  - Responde dúvidas a qualquer hora.
  - Nunca pede documentos ou dados bancários.
  - Quando o parceiro pede uma pessoa, ou quer negociar comissão ou contrato, o agente avisa a equipe.
- **Respostas da equipe:** você responde pela página do agente. A resposta aparece no chat do portal e também no WhatsApp, se o parceiro escreveu lá nas últimas 24 h.
- **WhatsApp:** o código já está pronto e fica desligado até a Meta liberar. Para ligar:
  - Secrets no Supabase: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET`.
  - Webhook na Meta: `https://onaewjlozioderwlvgfm.supabase.co/functions/v1/crm`.
  - Modelo de mensagem aprovado: `endeavor_status_update`, com 2 variáveis (nome e mensagem).
  - Depois, ligar a opção "Também por WhatsApp" em CRM → Automações.
- **Billing e Marketing:** já aparecem na página como "Em breve".

---

# Atualização: "Minha conta" do parceiro

Página única, sem rolagem no computador (no celular as caixas ficam uma embaixo da outra).
- **Dados de contato:** nome, WhatsApp (com seletor de país), empresa e um **segundo e-mail**. Todos os avisos automáticos vão para os dois e-mails.
- **E-mail de login:** o parceiro digita o novo e-mail e a senha atual. O Supabase manda um link de confirmação, e o login só muda depois do clique. No próximo acesso, o cadastro do parceiro é atualizado e você recebe um aviso no sino.
- **Senha:** pede a senha atual, a nova (mínimo de 12 caracteres) e a repetição. Depois de 5 tentativas erradas, o sistema bloqueia por 15 minutos.
- **Encerrar conta:** pede a senha e a palavra ENCERRAR (CLOSE em inglês, CERRAR em espanhol). Depois disso:
  - novas indicações ficam bloqueadas na hora;
  - a conta continua aberta só até a última comissão ser paga, e então fecha sozinha (automação a cada 10 minutos);
  - o parceiro recebe um e-mail e o acesso ao portal é removido;
  - o contrato e o histórico de pagamentos ficam guardados (1099);
  - até o fechamento, o parceiro pode clicar em "Manter minha conta".
- **No admin:** a lista de parceiros mostra "Encerrando" ou "Conta encerrada", e a ficha mostra o segundo e-mail e as datas. Você recebe um aviso no sino quando o parceiro pede o encerramento, quando cancela e quando a conta fecha.

---

# Atualização: Agente de Vendas (chat com IA no site)

- **Onde aparece:** balão no canto inferior direito da home e da página de parceiros.
  - Abre sozinho **6 segundos depois que o visitante rola a página**. O tempo é ajustável, e 0 desliga a abertura automática.
  - No computador, abre a janela do chat. No celular, mostra o balão com as opções.
  - A primeira mensagem pergunta se a pessoa precisa de ajuda com a empresa nos EUA ou quer ser parceira, com três botões: "Quero abrir ou cuidar da minha empresa nos EUA", "Quero ser parceiro" e "Tenho outra dúvida".
  - Abre uma vez por visita. Quem fecha o convite não vê de novo por 1 dia.
- **O que faz:** responde sobre os serviços e o Programa de Parceiros em português, inglês e espanhol, com o conteúdo do site.
  - **Nunca informa preços.** Quando a pessoa mostra interesse ou pergunta o valor, oferece enviar a proposta por e-mail e mostra um formulário curto: nome, e-mail, WhatsApp (opcional) e interesse.
  - Também mostra botões para agendar uma conversa, para o cadastro de parceiro e para o WhatsApp.
- **Quando alguém pede a proposta:**
  - vira lead no CRM, com origem "Chat do site" e a conversa inteira na mensagem;
  - você recebe um aviso no sino;
  - chega um e-mail em support@endeavorbiz.com com o histórico;
  - o follow-up automático de leads também vale para esses contatos.
- **Admin → Agentes IA → Agente de Vendas:** liga e desliga o chat, ajusta o tempo do balão e mostra as conversas do site, que você pode abrir para ler.
- **Proteções:**
  - limite de 40 mensagens por conversa, 120 por visitante por dia e 3.000 por dia no total;
  - números de SSN, ITIN, CPF e cartão são apagados antes de salvar ou de enviar para a IA;
  - a IA ignora pedidos para mudar as regras.
- **Modelo:** Claude Haiku 5.5, rápido e de menor custo. Para trocar, crie no Supabase o secret `SITE_CHAT_MODEL`.

---

# Atualização: lead → prospect → proposta → cliente

1. **Lead:** o contato chega pelo chat, pelo formulário, pela agenda ou por indicação.
2. **Enviar proposta:** no card do lead tem o botão "Enviar proposta". Quando você clica:
   - o lead vira **prospect** e os follow-ups automáticos param;
   - abre a tela de proposta com a pessoa já selecionada (aparece "· prospect" ao lado do nome);
   - se o contato veio de um parceiro, a comissão já vem ligada à proposta.
3. **Proposta enviada:** o status do prospect muda sozinho para "Proposta enviada".
4. **Proposta aceita:** a pessoa vira **cliente** automaticamente. Ela recebe o acesso ao portal e a fatura é criada para pagamento.

Enquanto é prospect, a pessoa não aparece em Clientes e não tem acesso ao portal. Se você criar a conta de cliente manualmente para um prospect, o sistema aproveita o mesmo cadastro.

---

# Agente de Marketing (Instagram)

**Onde fica:** Admin → Instagram. Também dá para abrir pelo card em Agentes IA.

1. **✦ Planejar com IA:**
   - O agente pesquisa na internet o que está em alta no nicho: dólar, impostos, imóveis na Flórida, regras para empresas, notícias de vistos e as hashtags mais buscadas.
   - Depois cria os posts, carrosséis e stories da semana: tema, gancho, arte (com as cores da Endeavor), legenda, hashtags, dia e horário.
   - Ele explica por que escolheu cada tema. Quando o assunto também rende um Reel, já deixa o roteiro.
2. **Para aprovar:** você vê a arte, edita os textos e a legenda, troca a cor e muda a data. Também pode pedir um ajuste para a IA ("gancho mais forte", "vire carrossel Brasil x EUA").
3. **Aprovar e agendar:** a arte final é gerada e o post fica em "Agendados". A publicação é automática no horário marcado, com verificação a cada 10 minutos. Também existe o botão "Publicar agora".
4. **Comentários e directs:**
   - a IA responde sozinha, sem falar de preço;
   - quando a pessoa quer proposta, a IA pede nome e e-mail no direct, e isso vira lead no CRM com origem "Instagram";
   - pedidos para falar com a equipe chegam no sino.
5. **Configurações:**
   - posts e stories por semana, dias, horário, idioma;
   - lista de temas;
   - tom da marca;
   - respostas automáticas ligadas ou desligadas.

**Temas iniciais:**
- abertura de empresa e tipos de empresa;
- filial e expansão;
- dolarização;
- proteção patrimonial;
- impostos;
- Brasil x EUA;
- imóvel e empresa nos EUA;
- diversificação;
- estrutura pronta;
- vistos de trabalho para empresários (sempre informativo, com advogado de imigração);
- Registered Agent e compliance;
- Programa de Parceiros.

**Regras do agente:** nunca promete visto, resultado fiscal ou retorno, e nunca informa preços.

**Para ligar a publicação (Meta):**
- A conta do Instagram precisa ser profissional e estar ligada a uma página do Facebook.
- É preciso um app na Meta, que pode ser o mesmo do WhatsApp, com as permissões de publicação, comentários e mensagens aprovadas.
- Secrets no Supabase: `IG_ACCESS_TOKEN`, `IG_USER_ID`, `IG_VERIFY_TOKEN` e `IG_APP_SECRET`.
- Webhook: `https://onaewjlozioderwlvgfm.supabase.co/functions/v1/ig-agent`, com os campos comments e messages.

**Vídeos (fase 2), prontos para ligar:**
- `CREATOMATE_API_KEY`: montagem dos vídeos;
- `ELEVENLABS_API_KEY`: narração;
- `HEYGEN_API_KEY`: vídeos com apresentador.
