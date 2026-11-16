# My WhatsApp Manager

Extensão do Chrome da Endeavor com um painel retrátil ao lado do WhatsApp Web. Usa o Hub AI (agente `whatsapp-assistant`) pela função `whatsapp`. A página **WhatsApp Manager** do admin é a central de controle.

## Partes
- `wa-extension/`: extensão MV3 (`manifest.json`, `background.js`, `core.js`, `wa-dom.js`, `panel.js`, `panel.css`). O .zip para baixar fica em `downloads/my-whatsapp-manager.zip`.
- `supabase/functions/whatsapp/`: função (`index.ts`, `regras.ts`, `core.js`, uma cópia idêntica do core da extensão).
- `whatsapp-panel.js` e `whatsapp-panel.css`: página do admin (Início, Registro, Ajustes).
- Migração `20261120_whatsapp_manager.sql`: `wa_settings`, `wa_devices`, `wa_chats`, `wa_log` (só service role) e a origem de lead `whatsapp`.

## Como funciona
- **Conexão:** o admin (com autenticador) gera um código de conexão. O banco guarda só o hash do código. O código é colado no painel da extensão e pode ser desligado no admin.
- **Ferramentas:** sugerir resposta, resumo, respostas prontas (com "Adaptar com IA"), lead no CRM (confirmado antes de criar), agendamento (horários reais, `book_slot_v2`), proposta (mensagem sem preços e o link das propostas oficiais) e tradução.
- **Comandos:** por texto ou por voz. A voz usa o reconhecimento de fala do Chrome, e a transcrição aparece enquanto a pessoa fala.
- **Digitação visível:** a IA digita na caixa da mensagem, um caractere por vez, e o painel mostra o que ela está fazendo ("esperando", "digitando %", "enviado", "precisa de você").
- **IA Takeover:**
  - Ligado por padrão nas conversas individuais e desligado nos grupos.
  - Tempos humanos ajustáveis e sorteados: espera, velocidade, variação, pausa e tempo máximo digitando.
  - Limite por hora e intervalo mínimo por grupo, conferidos também no servidor.
  - Horário de atendimento opcional.
  - Não responde mensagens antigas ao abrir uma conversa.
  - Abre conversas não lidas só quando a pessoa não está usando o WhatsApp (30 s sem atividade).
  - Para na hora se a pessoa digitar, e o texto fica na caixa.
  - Escala para a pessoa (aviso do Chrome) em caso de reclamação, preço, documentos ou pagamento.
  - A primeira resposta automática de cada conversa leva o aviso de assistente virtual.
- **Grupos:** a IA resume os assuntos e sugere a resposta (no máximo uma análise a cada 2 min). O Takeover do grupo exige uma confirmação, com aviso de risco.
- **Privacidade:**
  - As conversas vão para a IA só para gerar a resposta e não são guardadas.
  - O registro guarda só o que a IA produziu ou enviou, em qual conversa e quando.
  - SSN/ITIN, cartões (Luhn), contas, routing e passaporte são removidos antes de ir para a IA e para o registro.

## Riscos
Automatizar o WhatsApp Web vai contra os termos do WhatsApp e pode bloquear o número. Use o número de teste (tablet com Google Voice). O número principal fica para a API oficial do WhatsApp Business.

## Testes
- `deno test --allow-read tests/whatsapp.test.ts`
- `node tests/whatsapp-ext.e2e.mjs`: a extensão real no Chromium, com um WhatsApp Web falso.
- `node tests/whatsapp-panel.e2e.mjs http://localhost:8092`: a página do admin.
