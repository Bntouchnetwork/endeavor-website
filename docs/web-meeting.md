# Web Meeting

Videoconferência da Endeavor Business Solutions com LiveKit. A própria Endeavor usa, e as empresas clientes usam como serviço quando o admin habilita na ficha do cliente. A sala foi adaptada da sala ao vivo do Noir Hub (repositório NOIR-HUB), com a marca, o login e o controle por empresa da Endeavor.

## Onde fica

| Parte | Arquivo |
| --- | --- |
| Aba **Web Meeting** no admin | `meet-panel.js` (lista e criação), ligado em `admin.js` |
| Liberar para uma empresa e limites | ficha do cliente › aba **Web Meeting** (`admin-clients.js`, `tabMeet`) |
| Aba **Web Meeting** no Portal do Cliente | `meet-panel.js`, ligado em `client.js` (aparece só com o Web Meeting habilitado) |
| Página da sala | `reuniao.html?s=SALA` + `meet/page.js` |
| Sala (vídeo, chat, ferramentas) | `meet/room.js`, `meet/room.css` (do Noir Hub) |
| Slides com IA | `meet/slides.js`, `meet/slides.css` (do Noir Hub) |
| SDK | `meet/vendor/livekit-client.umd.js` |
| Fundo da câmera | `meet/vendor/fundo-suave.js` (fonte `fundo-suave.src.js`, com MediaPipe), `meet/vendor/mediapipe/`, imagens em `meet/img/fundo-*.jpg` |
| Servidor | `supabase/functions/meet` (token, salas, ações do anfitrião, resumo e slides) |
| Webhook do LiveKit | `supabase/functions/meet-webhook` |
| Banco | `supabase/migrations/20261115_web_meeting.sql`, `20261116_meet_actions.sql` |
| Painel de ações (IA) | `meet/acoes-core.js` (regras, o mesmo arquivo na sala e no servidor), `meet/acoes-painel.js` (tela), `supabase/functions/meet/acoes.ts` (integrações) |
| Envio de documentos pelo cliente | `enviar-documentos.html?t=TOKEN` (bucket privado `meet-documents`) |
| Tema claro | `meet/gerar-tema-claro.py` gera o tema claro a partir das cores de `room.css` |
| Testes | `tests/meet-parity.test.ts`, `tests/meet-room.e2e.mjs`, `tests/meet-views.e2e.mjs`, `tests/meet-actions.test.ts`, `tests/meet-actions.e2e.mjs` |

## Como funciona

- **Criar sala:** nome, instantânea ou agendada (data e hora). No admin dá para criar para a Endeavor (reunião interna) ou para uma empresa com o Web Meeting habilitado. No portal, a equipe da empresa cria para a própria empresa.
- **Link:** `https://endeavorbiz.com/reuniao.html?s=eb-xxxxxxxxxx`. O nome da sala é aleatório e difícil de adivinhar. "Copiar link" mostra "Link copiado".
- **Papéis:** o servidor decide. É **anfitrião** quem está logado (com o autenticador) no admin da Endeavor ou no portal da empresa dona da sala. Quem abre o link sem login é **convidado** e entra só com o nome.
- **Cada empresa vê só as próprias salas** (políticas de acesso no banco); o admin vê todas.
- **Status:** agendada, ao vivo (o webhook marca quando a primeira pessoa entra) e encerrada (quando o anfitrião encerra, quando alguém encerra pelo painel, ou quando a sala fica vazia por 10 minutos). Convidados não entram numa sala encerrada; o anfitrião pode reabrir entrando de novo.

## Recursos da sala

Vídeo e áudio, escolha de câmera e microfone na pré-sala, compartilhamento de tela, grade de participantes com destaque de quem fala, chat, mão levantada e reações (👍 👏 ❤️ 😂 🎉 😮).

Anfitrião: silenciar, remover participante, encerrar a sala para todos, gravar, transmitir por RTMP (YouTube e Instagram), enquetes, cronômetro, salas em grupos, legendas ao vivo, resumo da reunião por IA e assistente de slides com IA (apresenta para todos, sincronizado em tempo real).

Todos: fundo da câmera, ver legendas, votar nas enquetes.

## Visualizações

Botão **Exibir** na barra de baixo. Cada pessoa escolhe a sua; a escolha fica salva no navegador.

- **Destaque** (padrão): ao entrar, o organizador aparece grande e os outros numa coluna ao lado (no celular, numa faixa embaixo).
- **Trocar quem fica grande:** clique num quadro da coluna, ou arraste o quadro para o palco. Clique duas vezes no quadro grande (ou de novo no mesmo) para voltar ao organizador.
- **Palco automático:** quem fala vai para o centro sozinho (depois de falar por um instante; volta quando a fala termina).
- **Reunião de negócio:** organizador e cliente lado a lado; os outros na coluna.
- **Grade de 4** (com páginas) e **Grade com todos**.
- **Só o destaque:** a pessoa em destaque ocupa a tela toda, sem a coluna.
- **Palco (oratória):** quem está em destaque (ou quem fala) aparece recortado sobre um palco virtual, e os outros ficam como plateia embaixo. Combina com o cronômetro e as reações. O recorte é feito no navegador de quem assiste.
- **Minha câmera sobre o slide:** quando o organizador apresenta, a câmera dele aparece recortada no canto do slide (estilo telejornal), para todos. Liga e desliga no mesmo menu.
- **Tela cheia** limpa: só a reunião; a coluna de participantes fica recolhida numa aba na borda direita e os controles aparecem ao mexer o mouse (Esc sai).
- **Coluna de participantes:** arraste a borda esquerda dela para alargar ou estreitar (também na tela cheia). Duplo clique volta ao tamanho padrão.
- Para o organizador, **Aplicar para todos**: a visualização e o destaque escolhidos passam a valer na tela de todos.
- Com apresentação ou tela compartilhada, o conteúdo ocupa o palco e as câmeras ficam na coluna.

## Fundo da câmera

Na pré-sala e no menu **Mais**, três botões: **Nenhum**, **Desfocado** e **Fundo virtual**. O Fundo virtual abre uma lista para escolher: Marca (logo da empresa, se cadastrado; senão a marca Endeavor), Sala de reunião, Escritório claro, Chicago, Belo Horizonte, Biblioteca ou **Sua foto**. As imagens prontas são fotos realistas em 1920×1080, a maioria com uma mesa embaixo (como se a pessoa estivesse sentada numa reunião). Trocar de imagem é instantâneo (o processador continua rodando, só a imagem muda).

- **Recorte suave e estável:** o processador próprio (`fundo-suave.js`) usa a máscara de confiança do MediaPipe (em vez da máscara binária), mistura cada máscara com a anterior (rápido onde a pessoa se mexe, lento onde é só ruído), suaviza a borda e, no desfoque, tira a pessoa da média para não formar halo. Isso acaba com o "pisca" e com o fundo real aparecendo na borda. Para não acumular atraso, quadros atrasados são descartados (a câmera mostra sempre o quadro mais recente).
- **Sua foto:** a imagem é reduzida no navegador e guardada só naquele computador (localStorage). Nunca é enviada ao servidor. Dá para trocar ou remover.
- A última escolha fica lembrada no navegador e volta na próxima reunião.
- Sem rastro: quando a pessoa se mexe, o recorte acompanha na hora; só tremidas pequenas na borda são suavizadas.
- O fundo virtual aparece sem espelho para a própria pessoa, para textos e logos ficarem legíveis.

## Apresentação com IA (anfitrião)

- **Layout:** com o painel de Slides aberto, a apresentação aparece grande no palco (com o selo "Rascunho: só você vê" até clicar em Apresentar para todos). Da esquerda para a direita: apresentação, painel de controle dos slides e a coluna com as câmeras dos participantes.
- **Coluna de participantes:** tem rolagem, destaca quem está falando e rola até a pessoa quando ela começa a falar. A seta no topo esconde a coluna (a apresentação cresce); a aba "Participantes" na borda direita mostra de novo. A escolha fica salva no navegador. No celular, as câmeras ficam numa faixa embaixo.
- **Largura do painel:** arraste a borda entre a apresentação e o painel (ou use as setas do teclado com a borda selecionada). Duplo clique volta ao padrão. A largura fica salva no navegador.
- **Pedido por voz:** um clique no microfone começa a gravar (o botão fica vermelho e vira "parar"); outro clique para e o texto transcrito fica na caixa. Você revisa, ajusta se quiser e clica em enviar. Esc descarta a gravação.
- **Painel de controle:** a barra dos slides (navegar, desfazer, PDF, apagar), o botão Apresentar e as miniaturas ficam fixos no topo; só a conversa com o assistente rola. O botão **Assistente** (ícone de IA) na barra de baixo abre e fecha o painel.
- **Sugestões:** ficam no botão **Sugestões**, que abre um menu com pedidos prontos (ex.: deixar o slide mais curto, mudar o título).
- **Apagar apresentação:** botão da lixeira, com confirmação. Se estava ao vivo, para de aparecer para os participantes. Apaga também a cópia guardada no servidor; logo depois, Desfazer ainda recupera.

## AI Presentation Studio (Apresentações)

Fica em **Live Webinar › Apresentações (Studio)**, no admin e no Portal do Cliente (antes ficava no Web Meeting; o endereço antigo redireciona). Veja também `docs/live-webinar.md`. Ali a apresentação é preparada **antes** da reunião, e depois de publicada abre em qualquer sala da mesma empresa.

- **Lista:** apresentações da empresa (o admin vê todas e filtra por empresa), com a situação (rascunho ou publicada vN) e as ações Editar, Duplicar e Apagar. No topo aparece o que está ligado no HUB AI: texto, voz, imagens e vídeo.
- **Editor em tela cheia:**
  - à esquerda, os slides. Arraste para reordenar ou use ↑ ↓; duplique, apague ou adicione (até 30);
  - no centro, o slide grande e os campos do layout (capa, tópicos, passos, duas colunas, número, citação, gráfico e encerramento);
  - à direita, quatro abas: Roteiro, Criar com IA, Configurações e Voz;
  - embaixo, a **linha do tempo**, com o total planejado e um trecho por slide (verde quando a narração está pronta).
- **Roteiro:** cada slide tem a fala completa, a duração e o tempo estimado (palavras ÷ ritmo). "Escrever com IA" cria o roteiro do slide.
- **Criar com IA:** você descreve o assunto, e o agente `presentation-studio` do HUB cria os slides e o roteiro, de acordo com idioma, tom, duração e ritmo. Ele não inventa números nem promessas: o que falta aparece como [completar]. Também dá para refazer um slide só.
- **Importar PDF ou PowerPoint (.pptx):**
  - o arquivo é lido no navegador e não sai do computador;
  - vai para a IA só o texto de cada página, além das anotações do PowerPoint, que viram o roteiro;
  - é possível importar sem a IA (um slide por página);
  - imagens, formatação e PDFs escaneados não são trazidos.
- **Configurações:** idioma (português, inglês ou espanhol), tom, duração total, ritmo da fala, público, transição, abertura, legenda e o dicionário de **pronúncia** ("LLC = éle éle cê"). A pronúncia vale só para a voz.
- **Abertura (introdução gravada):** a aba Abertura escolhe como o webinar começa e tem o botão **Gravar introdução**. Tudo da gravação fica dentro dessa tela:
  - **Texto:** escreva, cole ou gere com IA (com um pedido opcional) e edite ali mesmo. O teleprompter atualiza na hora, e o texto fica salvo com a apresentação.
  - **Câmera e microfone:** escolha a câmera e o microfone do computador ou externos (USB, Bluetooth). Uma barra mostra o volume do microfone.
  - **Fundo virtual:** os mesmos do Web Meeting (desfocado, os 6 fundos prontos e a sua foto, que fica só neste computador).
  - **Barra de baixo, nesta ordem:**
    1. Velocidade
    2. Letra
    3. **Ensaiar:** rola o texto sem gravar, com o selo "ENSAIO".
    4. Início do texto
    5. Pausar texto (ou a barra de espaço)
    6. Gravar
    7. Mudo do microfone
    8. Mudo do alto-falante, para não dar microfonia
  - **Contagem:** Ensaiar e Gravar começam com a contagem 3, 2, 1.
  - **Depois de parar:** você assiste e escolhe Regravar ou **Usar esta gravação**, que envia o vídeo e o marca como abertura. A gravação tem até 5 minutos.
  - **Vídeo pronto:** também dá para enviar um vídeo seu (MP4 ou WebM, até 100 MB). O vídeo fica no bucket privado `meet-media` e toca antes do primeiro slide, na prévia e no Live Webinar.
  - **A prévia do Studio mostra só a apresentação:** abertura, slides, narração e legenda. O chat, o contador e a caixa privada aparecem na sala do webinar.
- **Voz de teste:** na aba Voz há a opção de usar a voz do navegador nos slides sem narração, na prévia e no webinar.
  - Serve para ouvir o tom e o ritmo antes de gravar a sua voz.
  - No webinar, o público vê o selo "Voz de teste", e o rodapé avisa que é uma voz sintética de teste, que não é a voz do organizador.
  - Quando a narração com a sua voz existe, ela tem prioridade.
- **Voz (Minha voz):** cada pessoa grava de 1 a 2 minutos da **própria** voz, ou envia um arquivo, e aceita o termo de autorização (versão `voz-2026-11`).
  - O HUB cria a voz no ElevenLabs e guarda o consentimento no audit log.
  - A amostra não fica guardada na Endeavor.
  - Cada pessoa pode ter até 3 vozes. Só o dono da apresentação pode narrá-la, e só com a própria voz.
  - Apagar a voz remove a voz no provedor e todos os áudios gerados com ela.
- **Narração:**
  - "Gerar narração" cria um MP3 por slide, guardado no bucket privado `meet-media`;
  - só os slides cujo roteiro, idioma, ritmo ou pronúncia mudaram são narrados de novo (hash do texto falado);
  - erro de credencial, de limite ou de provedor aparece como aviso e para o lote.
- **Prévia:**
  - toca os slides em sequência, com a narração quando existe e com a legenda;
  - sem narração, usa o tempo estimado. A voz do navegador só entra se você pedir, e fica marcada como prévia.
- **Publicar:**
  - exige a versão salva e a prévia completa dessa versão;
  - congela uma cópia em `meet_studio_versions`.
- **Na sala:** Assistente › **Do Studio** lista as apresentações publicadas da empresa da sala e abre a versão publicada no painel de slides. Os participantes nunca recebem as notas nem o roteiro.
- **Concorrência:** cada gravação sobe a versão. Se outra janela salvou antes, o Studio avisa (409) em vez de sobrescrever.
- **Sem a voz ligada no HUB:** o Studio funciona normalmente para slides e roteiro, os botões de voz ficam desligados com o motivo, e a prévia usa o tempo estimado. Nada é simulado.

## Painel de ações (IA)

Só o organizador vê: aba **Ações** no painel lateral, ou menu **Mais › Ações da reunião (IA)**.

- **Ligar a IA:** ao ligar, todos na sala veem o selo **IA acompanhando** (e um aviso), e as legendas passam a registrar a conversa. **Pausar** deixa de fora o que for dito enquanto pausado (o selo mostra **IA pausada**). **Desligar** para tudo.
- **O que ela lê:** a transcrição (legendas) e o chat. Encontra pedidos, compromissos, decisões, responsáveis, prazos, e-mails, serviços e valores. Só usa o que foi dito: e-mails e valores que não aparecem na conversa são descartados (vale também para o que vier da IA do HUB, agente `meeting-actions`).
- **Sugestões:** proposta, pedido de documentos, reunião, remarcação, tarefa, cobrança, contrato, CRM e ata. Cada cartão mostra o resumo, de onde veio (a frase e quem falou) e o que falta. Botões: **Enviar/Executar**, **Editar**, **Descartar**.
- **Comandos:** por voz ou chat, começando com "IA," (ou "Assistente,"), ou no campo de comando do painel. Ex.: "IA, prepara a proposta", "IA, envia a proposta para o Carlos", "IA, solicita os documentos", "IA, agenda a reunião quinta às 10h", "IA, remarca para sexta às 15h", "IA, gera a ata", "IA, pausa". O comando do organizador digitado no chat não aparece para a sala. Comandos de convidados são recusados.
- **Destinatários:** os e-mails escritos no chat aparecem em **Destinatários** e precisam ser confirmados antes de qualquer envio. Com mais de um e-mail possível, a ação pede para escolher (ou diga o nome no comando).
- **Quando executa:** só com comando explícito do organizador, dados completos, destinatário confirmado e a integração conectada. Senão, fica como rascunho e mostra o que falta. Cobrança e contrato pedem também a caixa "Aprovo…". O mesmo comando repetido não envia de novo (para reenviar de propósito, use **Reenviar**).
- **Ata:** participantes, assuntos, decisões, tarefas (responsável e prazo) e pendências. Vai só para os destinatários marcados. Fica salva em Detalhes da sala.
- **Depois da reunião:** em Detalhes da sala (admin e portal) ficam as **tarefas** (dá para marcar como feitas) e os **documentos pedidos** (o que chegou e o que está pendente, com link de 10 minutos para abrir cada arquivo).

### Integrações

| Ação | Como funciona | Depende de |
| --- | --- | --- |
| E-mail (convites, link de documentos, ata) | SMTP da Endeavor (SES ou Gmail), um e-mail por destinatário | Segredos de e-mail já usados pelo CRM |
| Proposta | Cria o cliente/prospect pelo e-mail e envia pela função de Pagamentos (mesmo e-mail e link de aceite) | Organizador logado como **admin da Endeavor** (com autenticador) |
| Cobrança | Fatura no Stripe pela função de Pagamentos | Admin + Stripe conectado |
| Contrato | Gera o PDF da minuta e envia para assinatura eletrônica (Assinaturas) | Admin + e-mail. Revise a minuta com um advogado antes de enviar |
| Documentos | Link seguro (14 dias), arquivos num bucket privado; nunca pede números | E-mail |
| Agenda | Cria ou remarca uma sala agendada, confere conflitos (salas da mesma empresa; na Endeavor, também a agenda de atendimentos) e sugere horários livres | E-mail para os convites. Google Calendar e Outlook ainda não estão conectados |
| Tarefas | Tabela de tarefas da reunião | Sempre |
| CRM | Na Endeavor: leads. Na empresa: CRM da empresa, se ela tiver a ferramenta CRM | Ferramenta CRM ativa, no caso de empresa |
| IA do HUB | Agente `meeting-actions` (plataforma da Endeavor, roteamento balanced) | `HUB_AI_API_KEY` (já existe). Sem ela, o painel usa só a leitura local |

Em **modo demonstração** (sem LiveKit), tudo funciona com integrações simuladas: nada sai da sala.

## Tema claro

Botão **Claro/Escuro** na barra de baixo. A escolha fica salva no navegador. Ao mudar cores em `room.css`, rode `python3 meet/gerar-tema-claro.py`.

**Gravação:** todos os participantes veem o selo "Gravando" e um aviso quando a gravação começa. A Flórida exige o consentimento de todas as partes para gravar conversas: o aviso na tela ajuda, mas valide os termos de uso com um advogado.

## Limites por empresa (opcional)

Na ficha do cliente › Web Meeting: salas por mês, participantes por sala (padrão 100), minutos de reunião por mês, permitir gravação e permitir transmissão. Vazio = sem limite. O servidor confere os limites ao criar a sala e ao liberar cada entrada.

## Configuração (uma vez)

1. **LiveKit Cloud:** crie um projeto em cloud.livekit.io. Em Settings › Keys, crie uma chave e anote a URL (`wss://…livekit.cloud`), o API key e o API secret.
2. **Segredos no Supabase** (Edge Functions › Secrets): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. O motor de IA usa o `HUB_AI_API_KEY`, que já existe (agentes `meeting-summary` e `meeting-slides` no HUB).
3. **Webhook:** no LiveKit Cloud, Settings › Webhooks, adicione `https://onaewjlozioderwlvgfm.supabase.co/functions/v1/meet-webhook`.
4. **Gravação** (opcional): no Supabase, Storage › Settings › S3 Connection, gere um par de chaves e crie os segredos `MEET_S3_ENDPOINT` (`https://onaewjlozioderwlvgfm.supabase.co/storage/v1/s3`), `MEET_S3_REGION` (a região mostrada na tela), `MEET_S3_ACCESS_KEY` e `MEET_S3_SECRET`. O bucket privado `meet-recordings` já foi criado. Os vídeos são baixados por link assinado de 10 minutos, em Detalhes da sala.

5. **Voz do Studio (ElevenLabs, pelo HUB AI):**
   1. No console do HUB (hub.endeavorbiz.com), abra AI Providers › Add Provider e escolha o tipo *ElevenLabs (voice / text-to-speech)*.
   2. Cole a API key do ElevenLabs. Ela vai para o Vault do HUB e não passa pelo Endeavor.
   3. Em Advanced, opcional: `{"tts_model": "eleven_multilingual_v2", "usd_per_1k_chars": 0.30}`.
   4. Clique em **Test Connection**. A voz liga quando o provedor aparece como *connected*.
   5. Para a clonagem da própria voz, o plano do ElevenLabs precisa incluir *Instant Voice Cloning*.

   Não é preciso nenhum segredo novo no Endeavor: a função usa o `HUB_AI_API_KEY`. Os agentes `presentation-studio` e `presentation-voice` já existem no HUB.

Sem o passo 2, as salas abrem em **modo demonstração**: câmera, microfone e tela reais, outros participantes simulados.

## Testes

- `deno test --allow-read tests/meet-actions.test.ts` testa as regras do painel de ações com integrações simuladas: o roteiro completo (e-mail no chat, serviços e valores, proposta, documentos, tarefa, agendar, remarcar, ata) e os casos de destinatário ambíguo, informação ausente, falta de permissão, integração desconectada, falha de envio, comando repetido, agenda ocupada e anti-invenção.
- `node tests/meet-actions.e2e.mjs http://localhost:8092` faz o mesmo roteiro na sala, no navegador, em modo demonstração, e confere o selo da IA, a pausa, o comando de convidado recusado e o tema claro.

- `node tests/meet-studio.e2e.mjs http://localhost:8092` testa o Studio no navegador, com a função simulada. Confere:
  - criar com IA, editar, reordenar (botões e arrasto), duplicar e apagar;
  - roteiro e linha do tempo, configurações e pronúncia;
  - salvar e o conflito de versão;
  - publicar só depois da prévia;
  - a voz desligada com aviso;
  - criar a voz com o termo, narrar e tocar na prévia;
  - importar PowerPoint (ordem e anotações) e PDF;
  - o botão "Do Studio" na sala.
- `deno test --allow-read --allow-env tests/meet-studio.test.ts` testa as regras do servidor do Studio: configuração, pronúncia, hash da fala, tempo estimado e o termo de voz.
- `deno run --allow-read tests/meet-parity.test.ts` confere que o navegador e o servidor validam os slides do mesmo jeito.
- `python3 -m http.server 8092` e `node tests/meet-room.e2e.mjs http://localhost:8092` abrem a sala no Chromium com câmera e microfone falsos, como convidado (computador e celular) e como anfitrião, e conferem entrada, grade, chat, reações, mão levantada, enquete, gravação, menu do anfitrião, fundo desfocado, fundos virtuais, foto própria (confere que fica só no navegador), assistente de slides, layout com a coluna de participantes, arrasto do painel, pedido por voz e apagar apresentação.
