# Live Webinar

Ferramenta separada do Web Meeting, com menu próprio (**Live Webinar**) no admin e no Portal do Cliente para as empresas com o Web Meeting liberado. Usa o mesmo login, o mesmo CRM, a mesma agenda e o HUB AI. O Web Meeting continua para reuniões.

## Abas

- **Webinars:** lista, criação e cada webinar, que tem quatro partes:
  - Configurar;
  - Perguntas frequentes;
  - Ao vivo;
  - Relatório.
- **Apresentações (Studio):** o AI Presentation Studio, que antes ficava no Web Meeting. Ali você prepara os slides, o roteiro e a narração, e depois publica.

## Como funciona

1. Prepare e **publique** a apresentação no Studio.
2. Em Live Webinar, clique em **Novo webinar**. Dê um título e escolha a apresentação, a data, a hora e o fuso.
3. Em **Configurar**:
   - o contador (veja abaixo);
   - o assistente de IA;
   - os slides em que o público é convidado a perguntar;
   - o que acontece na caixa privada (horários da agenda, só o link ou só registrar o contato);
   - os textos.
4. Em **Perguntas frequentes**, gere com IA a partir da apresentação, revise, edite ou desmarque, e salve.
5. Clique em **Agendar e abrir inscrições**. O webinar guarda uma cópia da versão publicada e das narrações prontas. Se você publicar uma versão nova no Studio, clique em Agendar de novo.
6. Divulgue o link de inscrição (`webinar.html?w=…`). Cada pessoa recebe por e-mail um link pessoal para entrar.
7. Para repetir o mesmo webinar, use **Repetir em outra data**. Ele cria uma nova sessão com a mesma apresentação e as mesmas perguntas.

## Na sala (público)

- **Reprodução:**
  - a apresentação anda pelo relógio do servidor, e quem chega atrasado entra no slide e no ponto certos;
  - a narração de cada slide toca a partir desse ponto, com legenda do roteiro;
  - os slides sem narração passam no tempo do roteiro;
  - se o navegador bloquear o som, aparece o botão "Clique para ativar o som".
- **Contador:** mostra sempre o número **real** de pessoas assistindo, e só a partir do mínimo que você escolher. Abaixo disso, fica escondido.
- **Chat aberto:**
  - só pessoas reais escrevem como participantes;
  - o assistente aparece como **Assistente (IA)**, com o selo IA;
  - as perguntas frequentes aparecem como **Pergunta frequente**, nunca como alguém do público;
  - e-mail e telefone escritos no chat aberto são removidos, e a pessoa é orientada a usar a caixa privada.
- **Funil:** o assistente responde só com base nos slides, no roteiro e nas perguntas aprovadas, sem inventar preços, prazos ou promessas. Quando a pessoa mostra interesse no próprio caso, ele convida para **Falar em particular**.
- **Falar em particular:** a conversa fica só entre a pessoa e a equipe, com a ajuda do assistente.
  1. A pessoa deixa nome, e-mail, telefone e assunto, e **autoriza** o contato. Os dados entram no CRM: `leads` (origem "Live Webinar") para a Endeavor, ou `ct_contacts` para empresas que usam o CRM do Endeavor. Se o e-mail já existe, o registro é atualizado em vez de duplicado.
  2. Ela escolhe um **horário livre de verdade**:
     - para a Endeavor, pela `get_available_slots`, e o agendamento é feito pela `book_slot_v2`;
     - para as empresas, pela página de agendamento delas.

     A confirmação aparece na caixa privada e sai por e-mail (e por WhatsApp quando estiver ligado), pelas notificações que já existem.
  3. Se preferir, ela pede só o link de agendamento, que vai pela caixa privada e por e-mail.
- **Rodapé:** uma linha discreta avisa que a apresentação é pré-gravada com a voz autorizada e que o chat tem assistente de IA. A mesma informação aparece no aceite da inscrição.

## Ao vivo (equipe)

- Mostra a situação, as pessoas assistindo agora, o slide e o tempo.
- **Pausar, Retomar e Encerrar** chegam a todos em poucos segundos. Dois comandos ao mesmo tempo não se atropelam: o segundo é recusado (controle por versão).
- Pausar ou ligar o assistente de IA.
- Ocultar mensagens. Elas somem também para quem já tinha recebido.
- Responder a todos como equipe, ou **em particular** a uma pessoa (a equipe assume a conversa).

## Relatório

- inscritos, participantes e comparecimento;
- pico de pessoas ao mesmo tempo;
- tempo médio e mediano;
- quantos ficaram até o fim e quantos saíram antes;
- **retenção por slide** e quantos saíram em cada slide;
- perguntas, leads e agendamentos;
- lista de pessoas, com minutos, quanto assistiu, perguntas, lead e agendamento, e exportação em CSV (protegido contra fórmulas).

## Técnico

- **Função `webinar`:** ações `lw_*` no painel e `pub_*` no público. As regras ficam em `supabase/functions/webinar/regras.ts` e em `webinar/core.js`, um arquivo usado pelo navegador e pelo servidor.
- **Tabelas** (escrita só pela função; leitura por RLS conforme a empresa):
  - `lw_webinars`;
  - `lw_registrations` (token pessoal);
  - `lw_attendance` (presença real, a cada ~15 s);
  - `lw_messages` (chat aberto e privado, com mensagens programadas que não se repetem);
  - `lw_actions` (trilha de lead, agendamento, link, escalar, moderação e controles).
- **Agente do HUB:** `webinar-host`, nos modos faq, responder e privado. Ele responde só com o conteúdo do webinar, se identifica como IA e nunca pede SSN, ITIN, passaporte ou contas bancárias.
- **Limites:**
  - por pessoa, 1 mensagem a cada 8 s e 40 por webinar;
  - o assistente dá até 30 respostas por minuto por webinar;
  - cada pessoa pode marcar 1 horário por webinar.
- **Sem LiveKit:** não é preciso. A sala do webinar usa o servidor e não a sala de vídeo. A câmera ao vivo do organizador ("passar a palavra para a IA e retomar") é a próxima fase e usa o LiveKit do Web Meeting.

## Testes

- `deno test --allow-read tests/webinar.test.ts` testa as regras: linha do tempo, relógio, pausa, atraso, contador, remoção de dados pessoais, mensagens programadas, configurações e relatório.
- `node tests/webinar-public.e2e.mjs http://localhost:8092` testa a inscrição e a sala: aviso, contagem regressiva, entrada atrasada, perguntas frequentes identificadas, nenhum participante inventado, contador real com mínimo, e-mail removido, resposta da IA, caixa privada com autorização, horários, telefone, agendamento, pausa, encerramento e celular.
- `node tests/webinar-panel.e2e.mjs http://localhost:8092` testa o painel: criar (com conversão de fuso), configurar, agendar, perguntas frequentes, ao vivo (pausar, conflito, retomar, moderar, responder como equipe e em particular, pausar a IA), relatório, CSV e o Studio dentro do Live Webinar.
