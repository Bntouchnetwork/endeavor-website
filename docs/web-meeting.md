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
| SDK e fundos | `meet/vendor/livekit-client.umd.js`, `meet/vendor/livekit-fundos.js` (@livekit/track-processors), `meet/vendor/mediapipe/` |
| Servidor | `supabase/functions/meet` (token, salas, ações do anfitrião, resumo e slides) |
| Webhook do LiveKit | `supabase/functions/meet-webhook` |
| Banco | `supabase/migrations/20261115_web_meeting.sql` |
| Testes | `tests/meet-parity.test.ts`, `tests/meet-room.e2e.mjs` |

## Como funciona

- **Criar sala:** nome, instantânea ou agendada (data e hora). No admin dá para criar para a Endeavor (reunião interna) ou para uma empresa com o Web Meeting habilitado. No portal, a equipe da empresa cria para a própria empresa.
- **Link:** `https://endeavorbiz.com/reuniao.html?s=eb-xxxxxxxxxx`. O nome da sala é aleatório e difícil de adivinhar. "Copiar link" mostra "Link copiado".
- **Papéis:** o servidor decide. É **anfitrião** quem está logado (com o autenticador) no admin da Endeavor ou no portal da empresa dona da sala. Quem abre o link sem login é **convidado** e entra só com o nome.
- **Cada empresa vê só as próprias salas** (políticas de acesso no banco); o admin vê todas.
- **Status:** agendada, ao vivo (o webhook marca quando a primeira pessoa entra) e encerrada (quando o anfitrião encerra, quando alguém encerra pelo painel, ou quando a sala fica vazia por 10 minutos). Convidados não entram numa sala encerrada; o anfitrião pode reabrir entrando de novo.

## Recursos da sala

Vídeo e áudio, escolha de câmera e microfone na pré-sala, compartilhamento de tela, grade de participantes com destaque de quem fala, chat, mão levantada e reações (👍 👏 ❤️ 😂 🎉 😮).

Anfitrião: silenciar, remover participante, encerrar a sala para todos, gravar, transmitir por RTMP (YouTube e Instagram), enquetes, cronômetro, salas em grupos, legendas ao vivo, resumo da reunião por IA e assistente de slides com IA (apresenta para todos, sincronizado em tempo real).

Todos: fundo desfocado ou com a marca (logo da empresa, se cadastrado na empresa; senão a marca Endeavor), ver legendas, votar nas enquetes.

**Gravação:** todos os participantes veem o selo "Gravando" e um aviso quando a gravação começa. A Flórida exige o consentimento de todas as partes para gravar conversas: o aviso na tela ajuda, mas valide os termos de uso com um advogado.

## Limites por empresa (opcional)

Na ficha do cliente › Web Meeting: salas por mês, participantes por sala (padrão 100), minutos de reunião por mês, permitir gravação e permitir transmissão. Vazio = sem limite. O servidor confere os limites ao criar a sala e ao liberar cada entrada.

## Configuração (uma vez)

1. **LiveKit Cloud:** crie um projeto em cloud.livekit.io. Em Settings › Keys, crie uma chave e anote a URL (`wss://…livekit.cloud`), o API key e o API secret.
2. **Segredos no Supabase** (Edge Functions › Secrets): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. O motor de IA usa o `HUB_AI_API_KEY`, que já existe (agentes `meeting-summary` e `meeting-slides` no HUB).
3. **Webhook:** no LiveKit Cloud, Settings › Webhooks, adicione `https://onaewjlozioderwlvgfm.supabase.co/functions/v1/meet-webhook`.
4. **Gravação** (opcional): no Supabase, Storage › Settings › S3 Connection, gere um par de chaves e crie os segredos `MEET_S3_ENDPOINT` (`https://onaewjlozioderwlvgfm.supabase.co/storage/v1/s3`), `MEET_S3_REGION` (a região mostrada na tela), `MEET_S3_ACCESS_KEY` e `MEET_S3_SECRET`. O bucket privado `meet-recordings` já foi criado. Os vídeos são baixados por link assinado de 10 minutos, em Detalhes da sala.

Sem o passo 2, as salas abrem em **modo demonstração**: câmera, microfone e tela reais, outros participantes simulados.

## Testes

- `deno run --allow-read tests/meet-parity.test.ts` confere que o navegador e o servidor validam os slides do mesmo jeito.
- `python3 -m http.server 8092` e `node tests/meet-room.e2e.mjs http://localhost:8092` abrem a sala no Chromium com câmera e microfone falsos, como convidado (computador e celular) e como anfitrião, e conferem entrada, grade, chat, reações, mão levantada, enquete, gravação, menu do anfitrião, fundo desfocado e assistente de slides.
