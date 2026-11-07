/* Partner portal: referrals (pipeline, documents received, timeline), commissions and Stripe Connect payouts.
   Loaded by partner.html; client.js calls EPartnerRef.init(ctx) when the signed-in user is an active referral partner. */
(function () {
  'use strict';
  var STAGES = ['submitted', 'contacted', 'proposal', 'onboarding', 'in_process', 'completed'];
  var SERVICES = ['Start a U.S. Company', 'Registered Agent', 'EIN / ITIN', 'Annual Report / Compliance', 'Tax Services', 'Expand My Business to the U.S.',
    'Start Operations in Paraguay', 'Business Financing', 'Real Estate Structure', 'Family Office', 'Other Business Services'];
  var D = {
    en: {
      ac_nav: "My account", ac_lead: "Your details, login and password.", ac_contact: "Contact details", ac_name: "Full name", ac_phone: "WhatsApp", ac_company: "Company", ac_email2: "Second email (optional)", ac_email2h: "Notifications go to both emails.", ac_save: "Save", ac_saved: "Saved.", ac_login: "Login email", ac_cur: "Current:", ac_newEmail: "New email", ac_curPass: "Current password", ac_changeEmail: "Change email", ac_emailSent: "We sent a confirmation link to the new email. Your login changes only after you click it.", ac_same: "This is already your login email.", ac_pass: "Password", ac_newPass: "New password (min. 12 characters)", ac_confPass: "Repeat the new password", ac_changePass: "Change password", ac_passOk: "Password changed.", ac_passShort: "Use at least 12 characters.", ac_passDiff: "The passwords do not match.", ac_wrong: "The current password is wrong.", ac_many: "Too many attempts. Wait 15 minutes and try again.", ac_close: "Close account", ac_closeTxt: "You stop sending referrals. The account stays open only until you receive the last commission, then it closes automatically. Your contract and payment history are kept for tax purposes (1099).", ac_closeBtn: "Close my account", ac_closeQ: "Close your account?", ac_closeWord: "CLOSE", ac_closeType: "Type {w} to confirm", ac_closeConfirm: "Confirm closing", ac_closing: "Closing requested on {d}. No new referrals. The account closes automatically after your last commission is paid.", ac_cancel: "Keep my account", ac_closingNoRef: "Your account is being closed, so new referrals are turned off.", ac_cancelled: "Your account stays active.", e_phone: "Check the WhatsApp number.", e_email: "Check the email.", e_name2: "Enter your full name.", 
      o2_booked: 'Welcome call scheduled:', o2_resched: 'Reschedule', o2_next: 'Next step:', o2_s1: 'Access and email confirmed', o2_s1d: 'You created your password, which confirmed your email. Two-step verification is on.', o2_vid: 'Watch the video', o2_vidd: 'How the portal works: referrals, follow-up, commissions and services.', o2_ct: 'Sign the partner agreement', o2_ctd: 'Commission of {pct} on the invoices paid by the clients you refer. The agreement is in English (official version) and is signed online in 1 minute.', o2_ctBtn: 'Read and sign the agreement', o2_ctWait: 'Generating your agreement…', o2_pay: 'Set up how you get paid', o2_act: 'Account activated', o2_actd: 'Done automatically when the steps above are complete. Then you can refer clients.', o2_actOk: 'Your account is active. You can refer clients now.', o2_call: 'Book your welcome call', o2_calld: 'A 30-minute call with our team to plan your first referrals.', o2_lock: 'Finish the previous step first.', o2_stripeWait: 'Finish your registration on Stripe. As soon as Stripe receives your details, this step is done.', ref_pending: 'You can refer clients as soon as you finish the onboarding in "Start here".', ch_title: 'Onboarding assistant', ch_lead: 'Questions about any step? Ask here, any time.', ch_ph: 'Type your question…', ch_send: 'Send', ch_hi: 'Hi {n}! I am the Endeavor assistant. I can help you with every onboarding step. What would you like to know?', ch_err: 'The assistant is not available right now. Write to support@endeavorbiz.com.', ch_handoff: 'Our team was notified and will contact you.', ch_open: 'Assistant', ch_close: 'Close', ch_team: 'Endeavor team', ch_rate: 'Message limit reached for today. Write to support@endeavorbiz.com.',
      o_pixKey: 'Key', o_nav: 'Start here', o_title: 'Welcome to the Partner Program', o_lead: 'Watch the video and follow the steps to activate your account.', o_noVideo: 'The welcome video will be here soon.', o_seen: 'I watched it', o_steps: 'Steps to activate your account', o_s1: 'Portal access', o_s1d: 'Password and two-step verification are on.', o_s2: 'Watch the welcome video', o_s2d: 'How to refer, follow each client and get paid.', o_s3: 'How you get paid', o_s3d: 'Choose the country of the bank account that will receive your commissions.', o_country: 'Country of your bank account', o_us: 'You get paid through Stripe: your share goes automatically to your Stripe account when the client pays.', o_gp: 'For bank accounts in Brazil and Latin America, Endeavor sends your commission through Stripe Global Payouts after the client pays. You will receive a Stripe link by email to add your bank. Endeavor never sees these details.', o_pix: 'Pix key (optional)', o_pixNote: 'For Pix payouts, coming soon. Use an email, mobile number or random key (not your CPF).', o_pixType: 'Key type', pt_email: 'Email', pt_phone: 'Mobile', pt_random: 'Random key', o_save: 'Save', o_saved: 'Saved.', o_gpRequested: 'Request received: you will get the Stripe link by email to add your bank.', o_gpLink: 'Link sent: check your email to add your bank.', o_gpReady: 'All set to receive.', o_s4: 'Partner agreement', o_s4none: 'We send it after the onboarding call.', o_s5: 'Account activated', o_s5d: 'After approval you can start referring clients.', o_s5wait: 'Waiting for Endeavor approval.', o_done: 'All set! Your account is active.', o_tour: 'Get to know the portal', o_t1: 'Send a client\'s contact in under a minute.', o_t2: 'Follow each client step by step. You also get an email at every step.', o_t3: 'See what you have earned and what is coming.', o_t4: 'Your Stripe account and payout status.', o_banner: 'Almost there: finish your onboarding to start referring.', o_continue: 'Continue', e_pix: 'Invalid Pix key for the selected type.', o_change: 'Change',
      w_title: 'Welcome! Your registration is under review', w_lead: 'Follow the steps below. After the onboarding call we approve your account and send the partner agreement.', w_s1: 'Portal access created', w_s1d: 'Password and two-step verification are on.', w_s2: 'Create your Stripe account', w_s2d: 'This is where you receive your commissions.', w_s2ok: 'Your Stripe account is enabled to receive payouts.', w_s2rev: 'Stripe is reviewing your details.', w_s2btn: 'Create my Stripe account', w_need: 'Have at hand:', need1: 'A photo ID', need2: 'Your bank account details', need3: 'Your tax number: SSN, ITIN or EIN (if you are in the U.S.)', w_needNote: 'You enter everything directly with Stripe. Endeavor does not receive these details. Stripe also collects your tax form (W-9 or W-8) and issues Form 1099 when required.', w_s3: 'Onboarding call', w_s3none: 'We will agree on a time with you.', w_s4: 'Approval and agreement', w_s4d: 'We set your commission and you sign the partner agreement online.', pct_tbd: 'To be defined', k_contract: 'Partner agreement', ct_sent: 'Waiting for your signature', ct_sign: 'Sign the agreement', ct_partner_signed: 'You signed. Waiting for Endeavor\'s signature.', ct_signed: 'Signed by both parties', ct_download: 'Download signed agreement', p_readyMsg: 'All set! Your Stripe account is enabled and your commissions go straight to it.', p_need: 'What you will need', p_needNote: 'You enter these details directly with Stripe; Endeavor never sees them. Stripe also collects your W-9 or W-8 tax form.',
      r_nav_home: 'Dashboard', r_nav_refs: 'My referrals', r_nav_new: 'New referral', r_nav_comm: 'Commissions', r_nav_pay: 'Stripe payouts', r_sep_clients: 'Shared clients',
      r_hello: 'Hello, {n}', r_homeLead: 'Your referral pipeline with Endeavor Business Solutions.',
      k_refs: 'Referrals', k_active: 'In progress', k_won: 'Became clients', k_earned: 'Commissions received', k_due: 'Commissions to receive',
      r_recent: 'Latest referrals', r_seeAll: 'See all', r_none: 'No referrals yet', r_noneText: 'Refer a client and follow every step here.', r_newBtn: 'Refer a client',
      st_submitted: 'Received', st_contacted: 'In contact', st_proposal: 'Proposal', st_onboarding: 'Onboarding', st_in_process: 'In process', st_completed: 'Completed', st_lost: 'Closed',
      r_refsLead: 'Follow each referral from first contact to completion.', r_board: 'Pipeline', r_list: 'List', r_showLost: 'Show closed',
      r_service: 'Service', r_since: 'Referred on', r_updated: 'Updated', r_progress: 'Progress', r_docs: 'Documents received', r_noDocsReq: 'No document checklist yet.',
      di_pending: 'Pending', di_received: 'Received', di_approved: 'Approved', r_timeline: 'Timeline', r_detailsTitle: 'Referral',
      ev_status: 'Status: {s}', ev_doc_received: 'Document received: {d}', ev_doc_approved: 'Document approved: {d}', r_contact: 'Contact',
      r_newLead: 'Send the client\'s contact details. Endeavor will reach out and you can follow every step here.',
      f_name: 'Client name', f_email: 'Client email', f_phone: 'Phone / WhatsApp', f_country: 'Country', f_company: 'Company (if any)', f_service: 'Service needed',
      f_select: 'Select', f_msg: 'Context for our team (optional)', f_lang: 'Client language', f_consent: 'The client agreed to be contacted by Endeavor Business Solutions.',
      f_privacy: 'Do not include SSN, ITIN, passport, bank or card numbers. We collect documents directly from the client through the secure portal.',
      f_submit: 'Send referral', f_sent: 'Referral sent. Endeavor will contact the client.', e_name: 'Enter the client\'s name and a valid email.', e_consent: 'Confirm that the client agreed to be contacted.', e_rate: 'Daily limit of referrals reached. Try again tomorrow.',
      c_lead: 'Commissions on invoices paid by the clients you referred. Your share is sent automatically to your Stripe account when the client pays.',
      c_date: 'Date', c_inv: 'Invoice', c_client: 'Client', c_total: 'Invoice total', c_share: 'Your share', c_status: 'Invoice', c_payout: 'Payout', c_none: 'No commissions yet.',
      is_open: 'Awaiting payment', is_paid: 'Paid', is_void: 'Canceled', is_uncollectible: 'Uncollectible',
      ts_none: '—', ts_scheduled: 'Automatic on payment', ts_pending: 'Pending (connect Stripe)', ts_paid: 'Sent to Stripe', ts_failed: 'Failed', ts_reversed: 'Reversed',
      p_lead: 'Connect your own Stripe account to receive your commissions automatically. Endeavor never sees your bank details: you enter them directly with Stripe.',
      p_status: 'Stripe account', p_notConnected: 'Not connected', p_incomplete: 'Setup incomplete', p_ready: 'Ready to receive', p_review: 'Under review by Stripe',
      p_country: 'Country of your bank account', p_connect: 'Connect Stripe account', p_continue: 'Continue Stripe setup', p_dashboard: 'Open Stripe dashboard', p_refresh: 'Refresh status',
      p_steps: 'How it works', p_s1: 'Click "Connect Stripe account" and create (or sign in to) your Stripe Express account.', p_s2: 'Enter your details and the bank account that will receive the payouts.', p_s3: 'When a client you referred pays an Endeavor invoice, your share goes straight to your Stripe balance and then to your bank.',
      p_returned: 'Welcome back from Stripe. Status updated.', p_notReady: 'Online payments are being set up by Endeavor. Try again later.',
      p_sharePct: 'Default commission', p_accountId: 'Account', yes: 'Yes', no: 'No', p_payouts: 'Payouts to bank', p_transfers: 'Receives transfers'
    },
    pt: {
      ac_nav: "Minha conta", ac_lead: "Seus dados, login e senha.", ac_contact: "Dados de contato", ac_name: "Nome completo", ac_phone: "WhatsApp", ac_company: "Empresa", ac_email2: "Segundo e-mail (opcional)", ac_email2h: "Os avisos vão para os dois e-mails.", ac_save: "Salvar", ac_saved: "Salvo.", ac_login: "E-mail de login", ac_cur: "Atual:", ac_newEmail: "Novo e-mail", ac_curPass: "Senha atual", ac_changeEmail: "Trocar e-mail", ac_emailSent: "Enviamos um link de confirmação para o novo e-mail. O login só muda depois que você clicar nele.", ac_same: "Este já é o seu e-mail de login.", ac_pass: "Senha", ac_newPass: "Nova senha (mín. 12 caracteres)", ac_confPass: "Repita a nova senha", ac_changePass: "Trocar senha", ac_passOk: "Senha alterada.", ac_passShort: "Use pelo menos 12 caracteres.", ac_passDiff: "As senhas não são iguais.", ac_wrong: "A senha atual está errada.", ac_many: "Muitas tentativas. Espere 15 minutos e tente de novo.", ac_close: "Encerrar conta", ac_closeTxt: "Você deixa de enviar indicações. A conta fica aberta só até você receber a última comissão e depois fecha sozinha. O contrato e o histórico de pagamentos ficam guardados para fins fiscais (1099).", ac_closeBtn: "Encerrar minha conta", ac_closeQ: "Encerrar a sua conta?", ac_closeWord: "ENCERRAR", ac_closeType: "Digite {w} para confirmar", ac_closeConfirm: "Confirmar encerramento", ac_closing: "Encerramento pedido em {d}. Sem novas indicações. A conta fecha sozinha depois que a última comissão for paga.", ac_cancel: "Manter minha conta", ac_closingNoRef: "A sua conta está sendo encerrada, por isso novas indicações estão desligadas.", ac_cancelled: "A sua conta continua ativa.", e_phone: "Confira o número de WhatsApp.", e_email: "Confira o e-mail.", e_name2: "Informe o seu nome completo.", 
      o2_booked: 'Conversa de boas-vindas agendada:', o2_resched: 'Reagendar', o2_next: 'Próximo passo:', o2_s1: 'Acesso e e-mail validado', o2_s1d: 'Você criou a sua senha, o que confirmou o seu e-mail. A verificação em duas etapas está ativa.', o2_vid: 'Assista ao vídeo', o2_vidd: 'Como o portal funciona: indicações, acompanhamento, comissões e serviços.', o2_ct: 'Assine o contrato de parceria', o2_ctd: 'Comissão de {pct} sobre as faturas pagas pelos clientes que você indicar. O contrato está em inglês (versão oficial) e é assinado online em 1 minuto.', o2_ctBtn: 'Ler e assinar o contrato', o2_ctWait: 'Gerando o seu contrato…', o2_pay: 'Configure como você recebe', o2_act: 'Conta ativada', o2_actd: 'Acontece automaticamente quando os passos acima estiverem concluídos. Aí você já pode indicar clientes.', o2_actOk: 'Sua conta está ativa. Você já pode indicar clientes.', o2_call: 'Agende a conversa de boas-vindas', o2_calld: 'Uma conversa de 30 minutos com a nossa equipe para planejar as suas primeiras indicações.', o2_lock: 'Conclua o passo anterior primeiro.', o2_stripeWait: 'Termine o cadastro no Stripe. Assim que o Stripe receber os seus dados, este passo fica concluído.', ref_pending: 'Você poderá indicar clientes assim que concluir o onboarding em "Comece aqui".', ch_title: 'Assistente de onboarding', ch_lead: 'Dúvida em algum passo? Pergunte aqui, a qualquer hora.', ch_ph: 'Escreva a sua dúvida…', ch_send: 'Enviar', ch_hi: 'Olá, {n}! Sou o assistente da Endeavor. Posso ajudar você em cada passo do onboarding. O que você quer saber?', ch_err: 'O assistente não está disponível agora. Escreva para support@endeavorbiz.com.', ch_handoff: 'A nossa equipe foi avisada e vai falar com você.', ch_open: 'Assistente', ch_close: 'Fechar', ch_team: 'Equipe Endeavor', ch_rate: 'Limite de mensagens de hoje atingido. Escreva para support@endeavorbiz.com.',
      o_pixKey: 'Chave', o_nav: 'Comece aqui', o_title: 'Boas-vindas ao Programa de Parceiros', o_lead: 'Assista ao vídeo e siga os passos para ativar a sua conta.', o_noVideo: 'O vídeo de apresentação vai aparecer aqui em breve.', o_seen: 'Já assisti', o_steps: 'Passos para ativar a sua conta', o_s1: 'Acesso ao portal', o_s1d: 'Senha e verificação em duas etapas ativas.', o_s2: 'Assista ao vídeo de apresentação', o_s2d: 'Como indicar, acompanhar cada cliente e receber.', o_s3: 'Como você recebe', o_s3d: 'Escolha o país da conta bancária que vai receber as comissões.', o_country: 'País da sua conta bancária', o_us: 'Você recebe pelo Stripe: a sua parte cai automaticamente na sua conta Stripe quando o cliente paga.', o_gp: 'Para contas no Brasil e na América Latina, a Endeavor envia a sua comissão pelo Stripe Global Payouts depois que o cliente paga. Você recebe por e-mail um link do Stripe para cadastrar o seu banco. A Endeavor não vê esses dados.', o_pix: 'Chave Pix (opcional)', o_pixNote: 'Para o recebimento por Pix, que estará disponível em breve. Use e-mail, celular ou chave aleatória (não use o CPF).', o_pixType: 'Tipo de chave', pt_email: 'E-mail', pt_phone: 'Celular', pt_random: 'Chave aleatória', o_save: 'Salvar', o_saved: 'Salvo.', o_gpRequested: 'Pedido recebido: você vai receber por e-mail o link do Stripe para cadastrar o seu banco.', o_gpLink: 'Link enviado: confira o seu e-mail para cadastrar o banco.', o_gpReady: 'Tudo certo para receber.', o_s4: 'Contrato de parceria', o_s4none: 'Enviamos depois da conversa de onboarding.', o_s5: 'Conta ativada', o_s5d: 'Depois da aprovação, você já pode indicar clientes.', o_s5wait: 'Aguardando a aprovação da Endeavor.', o_done: 'Tudo pronto! Sua conta está ativa.', o_tour: 'Conheça o portal', o_t1: 'Envie o contato de um cliente em menos de um minuto.', o_t2: 'Acompanhe cada cliente etapa por etapa. Você também recebe um e-mail a cada etapa.', o_t3: 'Veja o que já recebeu e o que vai receber.', o_t4: 'Sua conta Stripe e a situação dos repasses.', o_banner: 'Falta pouco: termine o onboarding para começar a indicar.', o_continue: 'Continuar', e_pix: 'Chave Pix inválida para o tipo escolhido.', o_change: 'Alterar',
      w_title: 'Boas-vindas! Seu cadastro está em análise', w_lead: 'Siga os passos abaixo. Depois da conversa de onboarding, aprovamos a sua conta e enviamos o contrato de parceria.', w_s1: 'Acesso ao portal criado', w_s1d: 'Senha e verificação em duas etapas ativas.', w_s2: 'Crie sua conta Stripe', w_s2d: 'É por ela que você recebe as comissões.', w_s2ok: 'Sua conta Stripe está habilitada para receber.', w_s2rev: 'O Stripe está analisando os seus dados.', w_s2btn: 'Criar minha conta no Stripe', w_need: 'Tenha em mãos:', need1: 'Documento com foto', need2: 'Dados da conta bancária', need3: 'Número fiscal: SSN, ITIN ou EIN (se estiver nos EUA)', w_needNote: 'Você informa tudo direto no Stripe. A Endeavor não recebe esses dados. O Stripe também coleta o seu formulário fiscal (W-9 ou W-8) e emite o 1099 quando for o caso.', w_s3: 'Conversa de onboarding', w_s3none: 'Vamos combinar o horário com você.', w_s4: 'Aprovação e contrato', w_s4d: 'Definimos a sua comissão e você assina o contrato de parceria online.', pct_tbd: 'A definir', k_contract: 'Contrato de parceria', ct_sent: 'Aguardando a sua assinatura', ct_sign: 'Assinar contrato', ct_partner_signed: 'Você assinou. Aguardando a assinatura da Endeavor.', ct_signed: 'Assinado pelas duas partes', ct_download: 'Baixar contrato assinado', p_readyMsg: 'Tudo certo! Sua conta Stripe está habilitada e as comissões caem direto nela.', p_need: 'O que você vai precisar', p_needNote: 'Você informa esses dados direto no Stripe; a Endeavor nunca vê. O Stripe também coleta o seu formulário fiscal W-9 ou W-8.',
      r_nav_home: 'Painel', r_nav_refs: 'Minhas indicações', r_nav_new: 'Nova indicação', r_nav_comm: 'Comissões', r_nav_pay: 'Recebimentos Stripe', r_sep_clients: 'Clientes compartilhados',
      r_hello: 'Olá, {n}', r_homeLead: 'Seu pipeline de indicações com a Endeavor Business Solutions.',
      k_refs: 'Indicações', k_active: 'Em andamento', k_won: 'Viraram clientes', k_earned: 'Comissões recebidas', k_due: 'Comissões a receber',
      r_recent: 'Últimas indicações', r_seeAll: 'Ver todas', r_none: 'Nenhuma indicação ainda', r_noneText: 'Indique um cliente e acompanhe cada etapa por aqui.', r_newBtn: 'Indicar cliente',
      st_submitted: 'Recebida', st_contacted: 'Em contato', st_proposal: 'Proposta', st_onboarding: 'Cadastro', st_in_process: 'Em processamento', st_completed: 'Concluída', st_lost: 'Encerrada',
      r_refsLead: 'Acompanhe cada indicação do primeiro contato até a conclusão.', r_board: 'Pipeline', r_list: 'Lista', r_showLost: 'Mostrar encerradas',
      r_service: 'Serviço', r_since: 'Indicado em', r_updated: 'Atualizado', r_progress: 'Andamento', r_docs: 'Documentação recebida', r_noDocsReq: 'Ainda não há lista de documentos.',
      di_pending: 'Pendente', di_received: 'Recebido', di_approved: 'Aprovado', r_timeline: 'Linha do tempo', r_detailsTitle: 'Indicação',
      ev_status: 'Status: {s}', ev_doc_received: 'Documento recebido: {d}', ev_doc_approved: 'Documento aprovado: {d}', r_contact: 'Contato',
      r_newLead: 'Envie os dados de contato do cliente. A Endeavor entra em contato e você acompanha cada etapa por aqui.',
      f_name: 'Nome do cliente', f_email: 'E-mail do cliente', f_phone: 'Telefone / WhatsApp', f_country: 'País', f_company: 'Empresa (se houver)', f_service: 'Serviço de interesse',
      f_select: 'Selecione', f_msg: 'Contexto para a nossa equipe (opcional)', f_lang: 'Idioma do cliente', f_consent: 'O cliente autorizou o contato da Endeavor Business Solutions.',
      f_privacy: 'Não inclua SSN, ITIN, passaporte, dados bancários ou de cartão. Os documentos são coletados direto com o cliente pelo portal seguro.',
      f_submit: 'Enviar indicação', f_sent: 'Indicação enviada. A Endeavor vai entrar em contato com o cliente.', e_name: 'Informe o nome do cliente e um e-mail válido.', e_consent: 'Confirme que o cliente autorizou o contato.', e_rate: 'Limite diário de indicações atingido. Tente amanhã.',
      c_lead: 'Comissões sobre faturas pagas pelos clientes que você indicou. A sua parte vai automaticamente para a sua conta Stripe quando o cliente paga.',
      c_date: 'Data', c_inv: 'Fatura', c_client: 'Cliente', c_total: 'Total da fatura', c_share: 'Sua parte', c_status: 'Fatura', c_payout: 'Repasse', c_none: 'Nenhuma comissão ainda.',
      is_open: 'Aguardando pagamento', is_paid: 'Paga', is_void: 'Cancelada', is_uncollectible: 'Não cobrável',
      ts_none: '—', ts_scheduled: 'Automático no pagamento', ts_pending: 'Pendente (conecte o Stripe)', ts_paid: 'Enviado ao Stripe', ts_failed: 'Falhou', ts_reversed: 'Estornado',
      p_lead: 'Conecte a sua própria conta Stripe para receber as comissões automaticamente. A Endeavor não vê os seus dados bancários: você informa direto no Stripe.',
      p_status: 'Conta Stripe', p_notConnected: 'Não conectada', p_incomplete: 'Cadastro incompleto', p_ready: 'Pronta para receber', p_review: 'Em análise pelo Stripe',
      p_country: 'País da sua conta bancária', p_connect: 'Conectar conta Stripe', p_continue: 'Continuar cadastro no Stripe', p_dashboard: 'Abrir painel Stripe', p_refresh: 'Atualizar status',
      p_steps: 'Como funciona', p_s1: 'Clique em "Conectar conta Stripe" e crie (ou entre na) sua conta Stripe Express.', p_s2: 'Informe seus dados e a conta bancária que vai receber os repasses.', p_s3: 'Quando um cliente indicado por você paga uma fatura da Endeavor, a sua parte cai direto no seu saldo Stripe e depois no seu banco.',
      p_returned: 'Você voltou do Stripe. Status atualizado.', p_notReady: 'Os pagamentos online estão sendo configurados pela Endeavor. Tente mais tarde.',
      p_sharePct: 'Comissão padrão', p_accountId: 'Conta', yes: 'Sim', no: 'Não', p_payouts: 'Saques para o banco', p_transfers: 'Recebe repasses'
    },
    es: {
      ac_nav: "Mi cuenta", ac_lead: "Sus datos, acceso y contraseña.", ac_contact: "Datos de contacto", ac_name: "Nombre completo", ac_phone: "WhatsApp", ac_company: "Empresa", ac_email2: "Segundo correo (opcional)", ac_email2h: "Los avisos van a los dos correos.", ac_save: "Guardar", ac_saved: "Guardado.", ac_login: "Correo de acceso", ac_cur: "Actual:", ac_newEmail: "Nuevo correo", ac_curPass: "Contraseña actual", ac_changeEmail: "Cambiar correo", ac_emailSent: "Enviamos un enlace de confirmación al nuevo correo. El acceso cambia solo después de que haga clic.", ac_same: "Este ya es su correo de acceso.", ac_pass: "Contraseña", ac_newPass: "Nueva contraseña (mín. 12 caracteres)", ac_confPass: "Repita la nueva contraseña", ac_changePass: "Cambiar contraseña", ac_passOk: "Contraseña cambiada.", ac_passShort: "Use al menos 12 caracteres.", ac_passDiff: "Las contraseñas no coinciden.", ac_wrong: "La contraseña actual es incorrecta.", ac_many: "Demasiados intentos. Espere 15 minutos e intente de nuevo.", ac_close: "Cerrar cuenta", ac_closeTxt: "Deja de enviar recomendaciones. La cuenta queda abierta solo hasta que reciba la última comisión y luego se cierra sola. El contrato y el historial de pagos se guardan para fines fiscales (1099).", ac_closeBtn: "Cerrar mi cuenta", ac_closeQ: "¿Cerrar su cuenta?", ac_closeWord: "CERRAR", ac_closeType: "Escriba {w} para confirmar", ac_closeConfirm: "Confirmar cierre", ac_closing: "Cierre solicitado el {d}. Sin nuevas recomendaciones. La cuenta se cierra sola después de pagar su última comisión.", ac_cancel: "Mantener mi cuenta", ac_closingNoRef: "Su cuenta se está cerrando, por eso las nuevas recomendaciones están desactivadas.", ac_cancelled: "Su cuenta sigue activa.", e_phone: "Revise el número de WhatsApp.", e_email: "Revise el correo.", e_name2: "Escriba su nombre completo.", 
      o2_booked: 'Llamada de bienvenida agendada:', o2_resched: 'Reagendar', o2_next: 'Próximo paso:', o2_s1: 'Acceso y correo validado', o2_s1d: 'Usted creó su contraseña, lo que confirmó su correo. La verificación en dos pasos está activa.', o2_vid: 'Mire el video', o2_vidd: 'Cómo funciona el portal: recomendaciones, seguimiento, comisiones y servicios.', o2_ct: 'Firme el contrato de socio', o2_ctd: 'Comisión de {pct} sobre las facturas pagadas por los clientes que usted recomiende. El contrato está en inglés (versión oficial) y se firma en línea en 1 minuto.', o2_ctBtn: 'Leer y firmar el contrato', o2_ctWait: 'Generando su contrato…', o2_pay: 'Configure cómo recibe', o2_act: 'Cuenta activada', o2_actd: 'Ocurre automáticamente cuando los pasos de arriba estén completos. Entonces ya puede recomendar clientes.', o2_actOk: 'Su cuenta está activa. Ya puede recomendar clientes.', o2_call: 'Agende la llamada de bienvenida', o2_calld: 'Una conversación de 30 minutos con nuestro equipo para planear sus primeras recomendaciones.', o2_lock: 'Complete primero el paso anterior.', o2_stripeWait: 'Termine el registro en Stripe. En cuanto Stripe reciba sus datos, este paso queda completo.', ref_pending: 'Podrá recomendar clientes en cuanto complete el onboarding en "Empiece aquí".', ch_title: 'Asistente de onboarding', ch_lead: '¿Dudas en algún paso? Pregunte aquí, a cualquier hora.', ch_ph: 'Escriba su pregunta…', ch_send: 'Enviar', ch_hi: '¡Hola, {n}! Soy el asistente de Endeavor. Puedo ayudarle en cada paso del onboarding. ¿Qué le gustaría saber?', ch_err: 'El asistente no está disponible ahora. Escriba a support@endeavorbiz.com.', ch_handoff: 'Nuestro equipo fue avisado y se comunicará con usted.', ch_open: 'Asistente', ch_close: 'Cerrar', ch_team: 'Equipo Endeavor', ch_rate: 'Límite de mensajes de hoy alcanzado. Escriba a support@endeavorbiz.com.',
      o_pixKey: 'Clave', o_nav: 'Empiece aquí', o_title: 'Bienvenido(a) al Programa de Socios', o_lead: 'Mire el video y siga los pasos para activar su cuenta.', o_noVideo: 'El video de bienvenida estará aquí pronto.', o_seen: 'Ya lo vi', o_steps: 'Pasos para activar su cuenta', o_s1: 'Acceso al portal', o_s1d: 'Contraseña y verificación en dos pasos activas.', o_s2: 'Mire el video de bienvenida', o_s2d: 'Cómo recomendar, seguir a cada cliente y recibir.', o_s3: 'Cómo recibe', o_s3d: 'Elija el país de la cuenta bancaria que recibirá sus comisiones.', o_country: 'País de su cuenta bancaria', o_us: 'Usted recibe por Stripe: su parte va automáticamente a su cuenta Stripe cuando el cliente paga.', o_gp: 'Para cuentas en Brasil y América Latina, Endeavor envía su comisión por Stripe Global Payouts después de que el cliente paga. Recibirá por correo un enlace de Stripe para registrar su banco. Endeavor no ve estos datos.', o_pix: 'Clave Pix (opcional)', o_pixNote: 'Para pagos por Pix, disponibles pronto. Use correo, celular o clave aleatoria (no use el CPF).', o_pixType: 'Tipo de clave', pt_email: 'Correo', pt_phone: 'Celular', pt_random: 'Clave aleatoria', o_save: 'Guardar', o_saved: 'Guardado.', o_gpRequested: 'Solicitud recibida: recibirá por correo el enlace de Stripe para registrar su banco.', o_gpLink: 'Enlace enviado: revise su correo para registrar su banco.', o_gpReady: 'Todo listo para recibir.', o_s4: 'Contrato de socio', o_s4none: 'Lo enviamos después de la llamada de onboarding.', o_s5: 'Cuenta activada', o_s5d: 'Después de la aprobación ya puede recomendar clientes.', o_s5wait: 'Esperando la aprobación de Endeavor.', o_done: '¡Todo listo! Su cuenta está activa.', o_tour: 'Conozca el portal', o_t1: 'Envíe el contacto de un cliente en menos de un minuto.', o_t2: 'Siga a cada cliente paso a paso. También recibe un correo en cada etapa.', o_t3: 'Vea lo que ya recibió y lo que va a recibir.', o_t4: 'Su cuenta Stripe y el estado de los pagos.', o_banner: 'Falta poco: termine el onboarding para empezar a recomendar.', o_continue: 'Continuar', e_pix: 'Clave Pix inválida para el tipo elegido.', o_change: 'Cambiar',
      w_title: '¡Bienvenido(a)! Su registro está en revisión', w_lead: 'Siga los pasos de abajo. Después de la llamada de onboarding, aprobamos su cuenta y enviamos el contrato de socio.', w_s1: 'Acceso al portal creado', w_s1d: 'Contraseña y verificación en dos pasos activas.', w_s2: 'Cree su cuenta Stripe', w_s2d: 'Ahí recibe sus comisiones.', w_s2ok: 'Su cuenta Stripe está habilitada para recibir.', w_s2rev: 'Stripe está revisando sus datos.', w_s2btn: 'Crear mi cuenta en Stripe', w_need: 'Tenga a mano:', need1: 'Un documento con foto', need2: 'Los datos de su cuenta bancaria', need3: 'Su número fiscal: SSN, ITIN o EIN (si está en EE. UU.)', w_needNote: 'Usted ingresa todo directamente en Stripe. Endeavor no recibe estos datos. Stripe también recoge su formulario fiscal (W-9 o W-8) y emite el 1099 cuando corresponde.', w_s3: 'Llamada de onboarding', w_s3none: 'Acordaremos un horario con usted.', w_s4: 'Aprobación y contrato', w_s4d: 'Definimos su comisión y usted firma el contrato de socio en línea.', pct_tbd: 'Por definir', k_contract: 'Contrato de socio', ct_sent: 'Esperando su firma', ct_sign: 'Firmar el contrato', ct_partner_signed: 'Usted firmó. Esperando la firma de Endeavor.', ct_signed: 'Firmado por ambas partes', ct_download: 'Descargar contrato firmado', p_readyMsg: '¡Todo listo! Su cuenta Stripe está habilitada y sus comisiones llegan directo a ella.', p_need: 'Lo que va a necesitar', p_needNote: 'Usted ingresa estos datos directamente en Stripe; Endeavor nunca los ve. Stripe también recoge su formulario fiscal W-9 o W-8.',
      r_nav_home: 'Panel', r_nav_refs: 'Mis referidos', r_nav_new: 'Nuevo referido', r_nav_comm: 'Comisiones', r_nav_pay: 'Pagos Stripe', r_sep_clients: 'Clientes compartidos',
      r_hello: 'Hola, {n}', r_homeLead: 'Su pipeline de referidos con Endeavor Business Solutions.',
      k_refs: 'Referidos', k_active: 'En curso', k_won: 'Se volvieron clientes', k_earned: 'Comisiones recibidas', k_due: 'Comisiones por recibir',
      r_recent: 'Últimos referidos', r_seeAll: 'Ver todos', r_none: 'Aún no hay referidos', r_noneText: 'Refiera un cliente y siga cada etapa aquí.', r_newBtn: 'Referir cliente',
      st_submitted: 'Recibido', st_contacted: 'En contacto', st_proposal: 'Propuesta', st_onboarding: 'Registro', st_in_process: 'En proceso', st_completed: 'Completado', st_lost: 'Cerrado',
      r_refsLead: 'Siga cada referido desde el primer contacto hasta la conclusión.', r_board: 'Pipeline', r_list: 'Lista', r_showLost: 'Mostrar cerrados',
      r_service: 'Servicio', r_since: 'Referido el', r_updated: 'Actualizado', r_progress: 'Avance', r_docs: 'Documentación recibida', r_noDocsReq: 'Aún no hay lista de documentos.',
      di_pending: 'Pendiente', di_received: 'Recibido', di_approved: 'Aprobado', r_timeline: 'Línea de tiempo', r_detailsTitle: 'Referido',
      ev_status: 'Estado: {s}', ev_doc_received: 'Documento recibido: {d}', ev_doc_approved: 'Documento aprobado: {d}', r_contact: 'Contacto',
      r_newLead: 'Envíe los datos de contacto del cliente. Endeavor se comunicará y usted sigue cada etapa aquí.',
      f_name: 'Nombre del cliente', f_email: 'Correo del cliente', f_phone: 'Teléfono / WhatsApp', f_country: 'País', f_company: 'Empresa (si tiene)', f_service: 'Servicio de interés',
      f_select: 'Seleccione', f_msg: 'Contexto para nuestro equipo (opcional)', f_lang: 'Idioma del cliente', f_consent: 'El cliente autorizó el contacto de Endeavor Business Solutions.',
      f_privacy: 'No incluya SSN, ITIN, pasaporte, datos bancarios ni de tarjeta. Los documentos se recogen directamente con el cliente en el portal seguro.',
      f_submit: 'Enviar referido', f_sent: 'Referido enviado. Endeavor se comunicará con el cliente.', e_name: 'Ingrese el nombre del cliente y un correo válido.', e_consent: 'Confirme que el cliente autorizó el contacto.', e_rate: 'Se alcanzó el límite diario de referidos. Intente mañana.',
      c_lead: 'Comisiones sobre facturas pagadas por los clientes que usted refirió. Su parte va automáticamente a su cuenta Stripe cuando el cliente paga.',
      c_date: 'Fecha', c_inv: 'Factura', c_client: 'Cliente', c_total: 'Total de la factura', c_share: 'Su parte', c_status: 'Factura', c_payout: 'Transferencia', c_none: 'Aún no hay comisiones.',
      is_open: 'Esperando pago', is_paid: 'Pagada', is_void: 'Anulada', is_uncollectible: 'Incobrable',
      ts_none: '—', ts_scheduled: 'Automática al pagar', ts_pending: 'Pendiente (conecte Stripe)', ts_paid: 'Enviada a Stripe', ts_failed: 'Falló', ts_reversed: 'Revertida',
      p_lead: 'Conecte su propia cuenta Stripe para recibir sus comisiones automáticamente. Endeavor no ve sus datos bancarios: usted los ingresa directamente en Stripe.',
      p_status: 'Cuenta Stripe', p_notConnected: 'No conectada', p_incomplete: 'Registro incompleto', p_ready: 'Lista para recibir', p_review: 'En revisión por Stripe',
      p_country: 'País de su cuenta bancaria', p_connect: 'Conectar cuenta Stripe', p_continue: 'Continuar registro en Stripe', p_dashboard: 'Abrir panel Stripe', p_refresh: 'Actualizar estado',
      p_steps: 'Cómo funciona', p_s1: 'Haga clic en "Conectar cuenta Stripe" y cree (o ingrese a) su cuenta Stripe Express.', p_s2: 'Ingrese sus datos y la cuenta bancaria que recibirá los pagos.', p_s3: 'Cuando un cliente referido por usted paga una factura de Endeavor, su parte va directo a su saldo Stripe y luego a su banco.',
      p_returned: 'Volvió de Stripe. Estado actualizado.', p_notReady: 'Endeavor está configurando los pagos en línea. Intente más tarde.',
      p_sharePct: 'Comisión estándar', p_accountId: 'Cuenta', yes: 'Sí', no: 'No', p_payouts: 'Retiros al banco', p_transfers: 'Recibe transferencias'
    }
  };
  var COUNTRIES = [['US', 'United States'], ['BR', 'Brasil'], ['PY', 'Paraguay'], ['PT', 'Portugal'], ['MX', 'México'], ['CO', 'Colombia'], ['AR', 'Argentina'], ['CL', 'Chile'], ['ES', 'España'], ['GB', 'United Kingdom'], ['CA', 'Canada']];

  window.EPartnerRef = {
    init: function (C) {
      var L = C.L, P = C.S.partner;
      function t(k, v) { var s = (D[L] && D[L][k] != null) ? D[L][k] : (D.en[k] != null ? D.en[k] : C.t(k, v)); if (v) Object.keys(v).forEach(function (x) { s = s.replace('{' + x + '}', v[x]); }); return s; }
      var esc = C.esc, $ = C.$, $$ = C.$$, sb = C.sb, q = C.q;
      var money = function (cents, cur) { return new Intl.NumberFormat(C.locale, { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((cents || 0) / 100); };
      var stPill = function (s) { return '<span class="ref-st ref-st--' + esc(s) + '">' + esc(t('st_' + s)) + '</span>'; };

      async function pay(payload) {
        var sess = (await sb.auth.getSession()).data.session;
        var r = await fetch(C.CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
        return j;
      }
      var pctTxt = function () { return P.default_share_pct == null ? t('pct_tbd') : String(+P.default_share_pct) + '%'; };
      var pending = function () { return P.program_status === 'pending'; };
      var closing = function () { return !!P.closure_requested_at; };
      var noNew = function () { return pending() || closing(); };
      var noNewMsg = function () { return closing() ? t('ac_closingNoRef') : t('ref_pending'); };
      async function pfn(payload) {
        var sess = (await sb.auth.getSession()).data.session;
        var r = await fetch(C.CFG.functionsUrl + '/partner-invite', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
        return j;
      }
      function needList() { return '<p style="margin:.5rem 0 0;font-weight:600;font-size:.9rem">' + t('w_need') + '</p><ul class="pw-need"><li>' + t('need1') + '</li><li>' + t('need2') + '</li><li>' + t('need3') + '</li></ul><p class="portal-muted" style="font-size:.85rem;margin:.4rem 0 0">' + t('w_needNote') + '</p>'; }
      function contractBox() {
        if (!P.contract_status || P.contract_status === 'none') return '';
        var st = P.contract_status;
        return '<h2 class="portal-h2" style="margin-top:1.25rem">' + t('k_contract') + '</h2><p><span class="stripe-st stripe-st--' + (st === 'signed' ? 'ok' : st === 'sent' ? 'incomplete' : 'review') + '">' + esc(t('ct_' + st)) + '</span></p>' +
          (st === 'sent' && P.contract_partner_token ? '<a class="btn btn--navy btn--xs" href="sign.html?t=' + esc(P.contract_partner_token) + '&lang=' + L + '&ret=partner">' + t('ct_sign') + '</a>' : '') +
          (st !== 'sent' ? '<button class="btn btn--ghost btn--xs" type="button" id="ct-dl">' + t('ct_download') + '</button>' : '');
      }
      function wireContract(root) {
        var b = root.querySelector('#ct-dl'); if (!b) return;
        b.onclick = async function () { b.disabled = true; try { var j = await pfn({ action: 'contract_url' }); window.open(j.url, '_blank', 'noopener'); } catch (e) { alert(C.errText(e)); } b.disabled = false; };
      }
      function stepper(status) {
        var lost = status === 'lost', ix = STAGES.indexOf(status);
        return '<ol class="ref-steps' + (lost ? ' is-lost' : '') + '" aria-label="' + esc(t('r_progress')) + '">' + STAGES.map(function (s, i) {
          var cls = lost ? '' : i < ix ? ' is-done' : i === ix ? ' is-current' : '';
          return '<li class="ref-step' + cls + '"' + (i === ix && !lost ? ' aria-current="step"' : '') + '><span class="ref-step__dot" aria-hidden="true"></span><span>' + esc(t('st_' + s)) + '</span></li>';
        }).join('') + '</ol>' + (lost ? '<p>' + stPill('lost') + '</p>' : '');
      }
      function stripeState() {
        if (!P.stripe_account_id) return ['none', t('p_notConnected')];
        if (P.stripe_transfers_active) return ['ok', t('p_ready')];
        if (P.stripe_details_submitted) return ['review', t('p_review')];
        return ['incomplete', t('p_incomplete')];
      }
      async function loadRefs() { return q(sb.from('referrals').select('*').order('created_at', { ascending: false })); }

      /* ---------- onboarding: video, checklist, how to get paid ---------- */
      var STRIPE_C = ['US', 'CA', 'GB', 'PT', 'ES', 'IE', 'FR', 'DE', 'IT', 'NL', 'CH'];
      var GP_C = [['BR', 'Brasil'], ['PY', 'Paraguay'], ['MX', 'México'], ['CO', 'Colombia'], ['AR', 'Argentina'], ['CL', 'Chile'], ['PE', 'Perú'], ['UY', 'Uruguay']];
      var OB_C = [['US', 'United States'], ['BR', 'Brasil']].concat(GP_C.slice(1)).concat([['CA', 'Canada'], ['GB', 'United Kingdom'], ['PT', 'Portugal'], ['ES', 'España'], ['IE', 'Ireland'], ['FR', 'France'], ['DE', 'Deutschland'], ['IT', 'Italia'], ['NL', 'Nederland'], ['CH', 'Schweiz']]);
      function videoHtml(url) {
        if (!url) return '<div class="ob-video ob-video--empty"><span aria-hidden="true">▶</span><p>' + t('o_noVideo') + '</p></div>';
        var yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url), vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
        if (yt) return '<div class="ob-video"><iframe src="https://www.youtube-nocookie.com/embed/' + yt[1] + '?rel=0" title="' + esc(t('o_title')) + '" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>';
        if (vm) return '<div class="ob-video"><iframe src="https://player.vimeo.com/video/' + vm[1] + '" title="' + esc(t('o_title')) + '" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
        return '<div class="ob-video"><video controls preload="metadata" playsinline src="' + esc(url) + '"></video></div>';
      }
      function payDone() { return P.payout_method === 'global_payouts' || (P.payout_method === 'stripe' && !!(P.stripe_details_submitted || P.stripe_transfers_active)); }
      async function obCheck() { var r = await sb.rpc('partner_onboarding_check'); if (!r.error && r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; } }
      // opens a centered window; runs onClose once when it closes (button, Esc or click outside)
      function obModal(html, onClose, wide) {
        var o = C.openOverlay('<div class="ob-modal__head"><h2 class="portal-h2" style="margin:0">' + html.title + '</h2><button class="close-x" type="button" aria-label="' + esc(t('ch_close')) + '">×</button></div>' + html.body, true);
        var m = o.querySelector('.modal'); if (m) m.classList.add('ob-modal'); if (m && wide) m.classList.add('ob-modal--wide');
        if (onClose) { var mo = new MutationObserver(function () { if (o.hidden) { mo.disconnect(); onClose(); } }); mo.observe(o, { attributes: true, attributeFilter: ['hidden'] }); }
        return o;
      }
      async function vOnb(view) {
        var cfg = (await sb.from('crm_settings').select('partner_video_url, agent_enabled, agent_chat_enabled').eq('id', 1).maybeSingle()).data || {};
        var video = cfg.partner_video_url || '';
        if (!P.onboarding_done_at) await obCheck();
        var vDone = !video || !!P.video_seen_at, cDone = P.contract_status === 'partner_signed' || P.contract_status === 'signed', pDone = payDone(), active = !!P.onboarding_done_at && P.program_status === 'approved';
        var call = null; if (active) { var rb = await sb.rpc('partner_welcome_booking'); call = rb.data && rb.data[0] || null; }
        var ctry = P.payout_country || (L === 'pt' ? 'BR' : 'US'), gp = function (c) { return STRIPE_C.indexOf(c) < 0; };
        var pct = (P.contract_pct != null ? +P.contract_pct : P.default_share_pct != null ? +P.default_share_pct : 10) + '%';
        var callUrl = C.siteUrl('schedule.html') + '?embed=1&lang=' + L + '&topic=welcome&name=' + encodeURIComponent(P.name || '') + '&email=' + encodeURIComponent(P.email || '');
        var whenTxt = call ? new Intl.DateTimeFormat(C.locale, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(call.starts_at)) : '';
        var chatOn = cfg.agent_enabled !== false && cfg.agent_chat_enabled !== false;
        var refresh = function () { vOnb(view); };
        // the steps (timeline); each one opens in a window
        var steps = [{ k: 'access', title: t('o2_s1'), done: true, body: function () { return '<p>' + t('o2_s1d') + '</p>'; } }];
        if (video) steps.push({ k: 'video', title: t('o2_vid'), done: vDone, body: function () { return '<p>' + t('o2_vidd') + '</p>' + (vDone ? '<p><span class="stripe-st stripe-st--ok">✓ ' + t('o_seen') + '</span></p>' : '<div class="portal-btn-row"><button class="btn btn--navy btn--xs" type="button" id="ob-seen2">✓ ' + t('o_seen') + '</button></div>'); } });
        steps.push({ k: 'contract', title: t('o2_ct'), done: cDone, locked: !vDone, body: function () { return '<p>' + t('o2_ctd').replace('{pct}', pct) + '</p>' + (cDone ? '<p><span class="stripe-st stripe-st--ok">' + t(P.contract_status === 'signed' ? 'ct_signed' : 'ct_partner_signed') + '</span></p>' : '<div class="portal-alert" id="ob-cm" role="alert"></div><button class="btn btn--navy" type="button" id="ob-sign">' + t('o2_ctBtn') + '</button>'); } });
        steps.push({ k: 'pay', title: t('o2_pay'), done: pDone, locked: !cDone, body: function () {
          var status = !P.payout_method ? '' : P.payout_method === 'stripe'
            ? '<p><span class="stripe-st stripe-st--' + stripeState()[0] + '">' + esc(stripeState()[1]) + '</span></p>' + (pDone ? '' : '<p>' + t('o2_stripeWait') + '</p><a class="btn btn--navy btn--xs" href="#/payouts" id="ob-stripe">' + t(P.stripe_account_id ? 'p_continue' : 'p_connect') + '</a>')
            : '<p><span class="stripe-st stripe-st--' + (P.global_payouts_status === 'ready' ? 'ok' : 'review') + '">' + esc(t(P.global_payouts_status === 'ready' ? 'o_gpReady' : P.global_payouts_status === 'link_sent' ? 'o_gpLink' : 'o_gpRequested')) + '</span></p>';
          return (P.payout_method ? status + '<button class="linklike" type="button" id="ob-edit">' + t('o_change') + '</button>' : '<p>' + t('o_s3d') + '</p>') +
            '<form class="ob-pay" id="ob-pay"' + (P.payout_method ? ' hidden' : '') + ' novalidate><div class="field"><label for="ob-c">' + t('o_country') + '</label><select id="ob-c">' + OB_C.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === ctry ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></div>' +
            '<p class="portal-muted ob-how" id="ob-how"></p>' +
            '<fieldset class="ob-pix" id="ob-pixbox"><legend>' + t('o_pix') + '</legend><div class="ob-pix__row"><div class="field"><label for="ob-pt">' + t('o_pixType') + '</label><select id="ob-pt"><option value="email">' + t('pt_email') + '</option><option value="phone">' + t('pt_phone') + '</option><option value="random">' + t('pt_random') + '</option></select></div>' +
            '<div class="field"><label for="ob-pk">' + t('o_pixKey') + '</label><input id="ob-pk" maxlength="140" autocomplete="off" value="' + esc(P.pix_key || '') + '"></div></div><p class="portal-muted" style="font-size:.82rem;margin:.2rem 0 0">' + t('o_pixNote') + '</p></fieldset>' +
            '<div class="portal-alert" id="ob-m" role="alert"></div><button class="btn btn--navy btn--xs" type="submit">' + t('o_save') + '</button></form>';
        } });
        steps.push({ k: 'active', title: t('o2_act'), done: active, body: function () { return '<p>' + t(active ? 'o2_actOk' : 'o2_actd') + '</p>'; } });
        steps.push({ k: 'call', title: t('o2_call'), done: !!call, locked: !active, body: null });
        var cur = steps.filter(function (x) { return !x.done && !x.locked; })[0];
        var tl = '<ol class="ob2-tl__list">' + steps.map(function (x, i) {
          var cls = x.done ? 'is-done' : x === cur ? 'is-now' : x.locked ? 'is-locked' : '';
          return '<li class="' + cls + '"><button type="button" data-st="' + i + '"' + (x.locked ? ' aria-disabled="true"' : '') + (x === cur ? ' aria-current="step"' : '') + '><span class="ob2-dot" aria-hidden="true">' + (x.done ? '✓' : i + 1) + '</span><span class="ob2-lbl">' + x.title + '</span></button></li>';
        }).join('') + '</ol>';
        var nextHtml = call ? '<span class="ob2-next__txt"><strong>' + t('o2_booked') + '</strong> ' + esc(whenTxt) + '</span><button class="btn btn--ghost btn--xs" type="button" id="ob-resched">' + t('o2_resched') + '</button>'
          : cur ? '<span class="ob2-next__txt">' + t('o2_next') + ' <strong>' + cur.title + '</strong></span><button class="btn btn--navy btn--xs" type="button" id="ob-go">' + t(cur.k === 'call' ? 'o2_call' : 'o_continue') + '</button>' : '';
        view.innerHTML = '<div class="ob2" id="ob2">' +
          '<div class="ob2-head"><h1 class="portal-h1">' + t('o_title') + '</h1><p class="portal-muted">' + t(active ? 'o2_actOk' : 'o_lead') + '</p></div>' +
          '<nav class="portal-card ob2-tl" aria-label="' + esc(t('o_steps')) + '">' + tl + (nextHtml ? '<div class="ob2-next">' + nextHtml + '</div>' : '') + '</nav>' +
          '<div class="ob2-body' + (chatOn ? '' : ' ob2-body--solo') + '"><section class="portal-card ob2-video">' + videoHtml(video) +
            (video && !P.video_seen_at ? '<div class="portal-btn-row ob2-seen"><button class="btn btn--navy btn--xs" type="button" id="ob-seen">✓ ' + t('o_seen') + '</button></div>' : '') + '</section>' +
            (chatOn ? '<section class="portal-card ob-chat" id="ob-chat"></section>' : '') + '</div></div>';
        // open a step
        var markSeen = async function (b) { if (b) b.disabled = true; var r = await sb.rpc('partner_onboarding_mark', { p_step: 'video' }); if (!r.error && r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; } };
        var openCall = function (url) { obModal({ title: t('o2_call'), body: '<iframe class="ob-sched" src="' + esc(url) + '" title="' + esc(t('o2_call')) + '"></iframe>' }, refresh, true); };
        var openStep = function (x) {
          if (x.locked) return;
          if (x.k === 'call') { openCall(call ? callUrl + '&reschedule=' + call.manage_token : callUrl); return; }
          var o = obModal({ title: x.title, body: '<div class="ob-modal__body">' + x.body() + '</div>' }, null);
          var close = function () { C.closeOverlay(); refresh(); };
          var q = function (sel) { return o.querySelector(sel); };
          if (q('#ob-seen2')) q('#ob-seen2').onclick = async function () { await markSeen(this); close(); };
          if (q('#ob-sign')) q('#ob-sign').onclick = async function () {
            var b = this; b.disabled = true; b.textContent = t('o2_ctWait');
            try { var j = await pfn({ action: 'contract_self' }); if (j.token) { location.assign(C.siteUrl('sign.html') + '?t=' + encodeURIComponent(j.token) + '&lang=' + L + '&ret=partner'); return; } await obCheck(); close(); }
            catch (e) { b.disabled = false; b.textContent = t('o2_ctBtn'); C.msg(q('#ob-cm'), C.errText(e), 'error'); }
          };
          if (q('#ob-stripe')) q('#ob-stripe').onclick = function () { C.closeOverlay(); };
          if (q('#ob-c')) { var how = function () { var c = q('#ob-c').value; q('#ob-how').textContent = t(gp(c) ? 'o_gp' : 'o_us'); q('#ob-pixbox').hidden = c !== 'BR'; }; q('#ob-c').onchange = how; how(); }
          if (P.pix_key_type && q('#ob-pt')) q('#ob-pt').value = P.pix_key_type;
          if (q('#ob-edit')) q('#ob-edit').onclick = function () { q('#ob-pay').hidden = false; this.hidden = true; };
          if (q('#ob-pay')) q('#ob-pay').onsubmit = async function (e) {
            e.preventDefault();
            var c = q('#ob-c').value, pk = c === 'BR' ? q('#ob-pk').value.trim() : '', b = this.querySelector('button[type=submit]');
            b.disabled = true;
            var r = await sb.rpc('partner_set_payout', { p_method: gp(c) ? 'global_payouts' : 'stripe', p_country: c, p_pix: pk || null, p_pix_type: pk ? q('#ob-pt').value : null });
            b.disabled = false;
            if (r.error) return C.msg(q('#ob-m'), /invalid_pix/.test(r.error.message) ? t('e_pix') : C.errText(r.error), 'error');
            if (r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; }
            if (!gp(c) && stripeState()[0] !== 'ok') { C.closeOverlay(); ERoute.set('#/payouts', true); return C.route(); }
            close();
          };
        };
        view.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { openStep(steps[+b.dataset.st]); }; });
        if ($('#ob-go')) $('#ob-go').onclick = function () { if (cur.k === 'video') { var v = view.querySelector('.ob-video'); if (v) v.scrollIntoView({ block: 'nearest' }); var sb2 = $('#ob-seen'); if (sb2) sb2.focus(); } else openStep(cur); };
        if ($('#ob-resched')) $('#ob-resched').onclick = function () { openCall(callUrl + '&reschedule=' + call.manage_token); };
        if ($('#ob-seen')) $('#ob-seen').onclick = async function () { await markSeen(this); refresh(); };
        var vid = view.querySelector('.ob-video video'); if (vid && !P.video_seen_at) vid.addEventListener('ended', function () { var b = $('#ob-seen'); if (b) b.click(); });
        if (chatOn) chat($('#ob-chat'));
        fitOb();
      }
      // desktop: the page fits the screen (no page scroll); the chat scrolls inside
      function fitOb() {
        var el = document.getElementById('ob2'); if (!el) return;
        var go = function () { var e2 = document.getElementById('ob2'); if (!e2) { window.removeEventListener('resize', go); return; } if (innerWidth < 1024 || innerHeight < 620) { e2.style.height = ''; return; } e2.style.height = Math.max(520, innerHeight - e2.getBoundingClientRect().top - 20) + 'px'; };
        go(); window.removeEventListener('resize', window.__obFit || go); window.__obFit = go; window.addEventListener('resize', go);
      }
      /* ---------- chat with the onboarding assistant (Admin agent) ---------- */
      async function chat(box) {
        box.innerHTML = '<div class="ob-chat__head"><span class="ag-ico" aria-hidden="true">✦</span><div><h2 class="portal-h2" style="margin:0;font-size:1.05rem">' + t('ch_title') + '</h2><p class="portal-muted" style="margin:0;font-size:.82rem">' + t('ch_lead') + '</p></div></div>' +
          '<div class="ch-log" id="ch-log" role="log" aria-live="polite"></div><form class="ch-form" id="ch-form"><label for="ch-in" class="sr-only">' + t('ch_ph') + '</label><textarea id="ch-in" rows="2" maxlength="2000" placeholder="' + esc(t('ch_ph')) + '"></textarea><button class="btn btn--navy btn--xs" type="submit">' + t('ch_send') + '</button></form>';
        var log = $('#ch-log', box);
        var bubble = function (role, text, meta) { var d = document.createElement('div'); d.className = 'ch-msg ch-msg--' + (role === 'user' ? 'me' : 'bot'); d.innerHTML = (meta && meta.human ? '<small>' + t('ch_team') + '</small>' : '') + esc(text).replace(/\n/g, '<br>'); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
        var hist = (await sb.from('agent_messages').select('role, content, meta, channel').eq('partner_id', P.id).in('channel', ['portal', 'whatsapp']).in('role', ['user', 'assistant']).order('created_at', { ascending: true }).limit(60)).data || [];
        if (!hist.length) bubble('assistant', t('ch_hi').replace('{n}', String(P.name || '').split(' ')[0]));
        hist.forEach(function (m) { bubble(m.role, m.content, m.meta); });
        var inp = $('#ch-in', box);
        inp.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#ch-form', box).requestSubmit(); } };
        $('#ch-form', box).onsubmit = async function (e) {
          e.preventDefault();
          var text = inp.value.trim(); if (!text) return;
          var b = this.querySelector('button'); b.disabled = true; inp.value = '';
          bubble('user', text); var wait = bubble('assistant', '…'); wait.classList.add('ch-msg--wait');
          try {
            var sess = (await sb.auth.getSession()).data.session;
            var r = await fetch(C.CFG.functionsUrl + '/crm', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify({ action: 'agent_chat', message: text }) });
            var j = await r.json().catch(function () { return {}; });
            wait.remove();
            if (!r.ok || j.error) bubble('assistant', t(j.error === 'rate_limited' ? 'ch_rate' : 'ch_err'));
            else { bubble('assistant', j.reply); if (j.handoff) bubble('assistant', t('ch_handoff')); }
          } catch (x) { wait.remove(); bubble('assistant', t('ch_err')); }
          b.disabled = false; inp.focus();
        };
      }
      function obBanner() {
        if (P.onboarding_done_at) return '';
        return '<div class="portal-alert portal-alert--info ob-banner" style="display:flex;margin-bottom:1.25rem"><span>' + t('o_banner') + '</span><a class="btn btn--navy btn--xs" href="#/onboarding">' + t('o_continue') + '</a></div>';
      }

      /* ---------- dashboard ---------- */
      async function vHome(view) {
        var res = await Promise.all([loadRefs(), sb.rpc('partner_commissions')]);
        var refs = res[0], comm = res[1].data || [];
        var active = refs.filter(function (r) { return r.status !== 'lost' && r.status !== 'completed' && STAGES.indexOf(r.status) < 3; }).length;
        var won = refs.filter(function (r) { return STAGES.indexOf(r.status) >= 3; }).length;
        var earned = comm.filter(function (c) { return c.transfer_status === 'paid'; }).reduce(function (s, c) { return s + c.partner_amount_cents; }, 0);
        var due = comm.filter(function (c) { return c.status !== 'void' && c.status !== 'uncollectible' && c.transfer_status !== 'paid' && c.transfer_status !== 'reversed'; }).reduce(function (s, c) { return s + c.partner_amount_cents; }, 0);
        var ss = stripeState();
        view.innerHTML = C.head(t('r_hello', { n: P.name.split(' ')[0] }), t('r_homeLead'), noNew() ? '' : '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>') + obBanner() +
          '<div class="dash"><div><div class="kpis">' + C.kpi(t('k_refs'), refs.length) + C.kpi(t('k_active'), active) + C.kpi(t('k_won'), won) + C.kpi(t('k_earned'), money(earned), true) + '</div>' +
          '<section class="portal-card" style="margin-top:1.25rem"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + t('r_recent') + '</h2><a href="#/referrals">' + t('r_seeAll') + '</a></div>' +
          (refs.length ? '<ul class="ref-list">' + refs.slice(0, 6).map(refRow).join('') + '</ul>' : '<div class="empty-state"><strong>' + t('r_none') + '</strong><p>' + (noNew() ? noNewMsg() : t('r_noneText')) + '</p>' + (noNew() ? '' : '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>') + '</div>') + '</section></div>' +
          '<aside class="links-panel portal-card"><h2 class="portal-h2">' + t('p_status') + '</h2><p><span class="stripe-st stripe-st--' + ss[0] + '">' + esc(ss[1]) + '</span></p>' +
          '<dl class="kv" style="margin-top:.75rem"><dt>' + t('k_due') + '</dt><dd>' + esc(money(due)) + '</dd><dt>' + t('p_sharePct') + '</dt><dd>' + esc(pctTxt()) + '</dd></dl>' + contractBox() +
          '<ul style="margin-top:1rem"><li><a href="#/payouts"><svg class="icon" aria-hidden="true"><use href="#i-card"/></svg>' + t('r_nav_pay') + '</a></li><li><a href="#/commissions"><svg class="icon" aria-hidden="true"><use href="#i-chart"/></svg>' + t('r_nav_comm') + '</a></li></ul></aside></div>';
        wireContract(view);
        wireRefs(view, refs);
      }
      function refRow(r) {
        return '<li><button type="button" class="ref-row" data-ref="' + r.id + '"><span class="ref-row__main"><strong>' + esc(r.name) + '</strong><span class="portal-muted">' + esc([r.company, r.service].filter(Boolean).join(' · ')) + '</span></span>' +
          '<span class="ref-row__side">' + stPill(r.status) + '<span class="portal-muted">' + esc(C.fmtDate(r.created_at)) + '</span></span></button></li>';
      }
      function wireRefs(root, refs) { $$('[data-ref]', root).forEach(function (b) { b.onclick = function () { detail(refs.find(function (r) { return r.id === b.dataset.ref; })); }; }); }

      /* ---------- pipeline ---------- */
      async function vRefs(view) {
        var refs = await loadRefs();
        var mode = C.param('view') === 'list' ? 'list' : 'board', showLost = C.param('lost') === '1';
        var shown = refs.filter(function (r) { return showLost || r.status !== 'lost'; });
        var tabs = '<div class="subtabs" role="tablist"><a href="#/referrals' + (showLost ? '?lost=1' : '') + '"' + (mode === 'board' ? ' aria-current="page"' : '') + '>' + t('r_board') + '</a><a href="#/referrals?view=list' + (showLost ? '&lost=1' : '') + '"' + (mode === 'list' ? ' aria-current="page"' : '') + '>' + t('r_list') + '</a></div>';
        var body;
        if (!refs.length) body = '<div class="empty-state portal-card"><strong>' + t('r_none') + '</strong><p>' + t('r_noneText') + '</p><a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a></div>';
        else if (mode === 'board') {
          body = '<div class="ref-board">' + STAGES.concat(showLost ? ['lost'] : []).map(function (s) {
            var col = shown.filter(function (r) { return r.status === s; });
            return '<section class="ref-col" aria-label="' + esc(t('st_' + s)) + '"><h2 class="ref-col__h">' + esc(t('st_' + s)) + ' <span>' + col.length + '</span></h2>' +
              col.map(function (r) { return '<button type="button" class="ref-card" data-ref="' + r.id + '"><strong>' + esc(r.name) + '</strong><span>' + esc(r.service || r.company || '') + '</span><small>' + esc(C.fmtDate(r.created_at)) + '</small></button>'; }).join('') + '</section>';
          }).join('') + '</div>';
        } else body = '<section class="portal-card"><ul class="ref-list">' + shown.map(refRow).join('') + '</ul></section>';
        view.innerHTML = C.head(t('r_nav_refs'), t('r_refsLead'), noNew() ? '' : '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>') +
          '<div class="toolbar" style="justify-content:space-between;align-items:center">' + tabs + '<div class="check-row"><input type="checkbox" id="rf-lost"' + (showLost ? ' checked' : '') + '><label for="rf-lost">' + t('r_showLost') + '</label></div></div>' + body;
        $('#rf-lost').onchange = function () { ERoute.set('#/referrals?' + (mode === 'list' ? 'view=list&' : '') + (this.checked ? 'lost=1' : ''), true); C.route(); };
        wireRefs(view, refs);
        var open = C.param('id'); if (open) { var r = refs.find(function (x) { return x.id === open; }); if (r) detail(r); }
      }
      async function detail(r) {
        var o = C.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t('r_detailsTitle') + ': ' + esc(r.name) + '</h2><button class="close-x" type="button" aria-label="' + C.t('close') + '">×</button></div><div id="rd-body"><p class="portal-muted">' + C.t('loading') + '</p></div>');
        var res = await Promise.all([q(sb.from('referral_items').select('*').eq('referral_id', r.id).order('created_at')), q(sb.from('referral_events').select('*').eq('referral_id', r.id).order('at', { ascending: false }))]);
        var items = res[0], evs = res[1];
        var evLabel = function (e) {
          if (e.kind === 'status') return t('ev_status', { s: t('st_' + e.label) });
          if (e.kind === 'document') { var p = e.label.split(':'); return t('ev_doc_' + p[0], { d: p.slice(1).join(':') }); }
          return e.label;
        };
        $('#rd-body', o).innerHTML = stepper(r.status) +
          '<dl class="kv" style="margin:1rem 0"><dt>' + t('r_service') + '</dt><dd>' + esc(r.service || '—') + '</dd><dt>' + t('r_contact') + '</dt><dd>' + esc([r.email, r.phone].filter(Boolean).join(' · ')) + '</dd>' +
          (r.company ? '<dt>' + t('f_company') + '</dt><dd>' + esc(r.company) + '</dd>' : '') + '<dt>' + t('r_since') + '</dt><dd>' + esc(C.fmtDate(r.created_at)) + '</dd><dt>' + t('r_updated') + '</dt><dd>' + esc(C.fmtDT(r.updated_at)) + '</dd></dl>' +
          '<h3 class="portal-h2" style="font-size:1rem">' + t('r_docs') + '</h3>' +
          (items.length ? '<ul class="ref-docs">' + items.map(function (i) { return '<li><span class="ref-doc ref-doc--' + i.status + '" aria-hidden="true"></span><span>' + esc(i.label) + '</span><span class="portal-muted">' + esc(t('di_' + i.status)) + '</span></li>'; }).join('') + '</ul>' : '<p class="portal-muted">' + t('r_noDocsReq') + '</p>') +
          '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">' + t('r_timeline') + '</h3><ol class="timeline">' +
          evs.map(function (e) { return '<li><strong>' + esc(evLabel(e)) + '</strong><span class="portal-muted">' + esc(C.fmtDT(e.at)) + '</span></li>'; }).join('') + '</ol>';
      }

      /* ---------- new referral ---------- */
      async function vNew(view) {
        if (noNew()) { view.innerHTML = C.head(t('r_nav_new'), '') + '<div class="portal-alert portal-alert--info" style="display:block;max-width:44rem">' + noNewMsg() + '</div>'; return; }
        view.innerHTML = C.head(t('r_nav_new'), t('r_newLead')) +
          '<section class="portal-card acc-card rf-card"><form class="portal-form acc-form rf-form" id="rf-form" novalidate>' +
          '<div class="field rf-w2"><label for="rf-name">' + t('f_name') + '</label><input id="rf-name" autocomplete="off" required maxlength="200"></div>' +
          '<div class="field rf-em"><label for="rf-email">' + t('f_email') + '</label><input id="rf-email" type="email" autocomplete="off" required maxlength="254"></div>' +
          '<div class="field rf-ph"><label for="rf-phone">' + t('f_phone') + '</label><div id="rf-phone-box"></div></div>' +
          '<div class="field"><label for="rf-country">' + t('f_country') + '</label><input id="rf-country" maxlength="100"></div>' +
          '<div class="field"><label for="rf-company">' + t('f_company') + '</label><input id="rf-company" maxlength="200"></div>' +
          '<div class="field"><label for="rf-service">' + t('f_service') + '</label><select id="rf-service"><option value="">' + t('f_select') + '</option>' + SERVICES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="rf-lang">' + t('f_lang') + '</label><select id="rf-lang"><option value="pt"' + (L === 'pt' ? ' selected' : '') + '>Português</option><option value="en"' + (L === 'en' ? ' selected' : '') + '>English</option><option value="es"' + (L === 'es' ? ' selected' : '') + '>Español</option></select></div>' +
          '<div class="field rf-full"><label for="rf-msg">' + t('f_msg') + '</label><textarea id="rf-msg" rows="3" maxlength="3000"></textarea></div>' +
          '<p class="portal-alert portal-alert--info rf-full rf-note">' + t('f_privacy') + '</p>' +
          '<div class="check-row rf-full"><input type="checkbox" id="rf-consent" required><label for="rf-consent">' + t('f_consent') + '</label></div>' +
          '<div class="acc-foot"><button class="btn btn--navy" type="submit">' + t('f_submit') + '</button><div class="portal-alert" id="rf-msgbox" role="alert"></div></div></form></section>';
        var rfPhone = window.EPhone ? EPhone.mount($('#rf-phone-box'), { id: 'rf-phone', lang: L }) : null;
        if (!rfPhone) $('#rf-phone-box').innerHTML = '<input id="rf-phone" type="tel" autocomplete="off" maxlength="50">';
        $('#rf-form').onsubmit = async function (e) {
          e.preventDefault();
          var v = function (id) { return $('#' + id).value.trim(); };
          var p = { name: v('rf-name'), email: v('rf-email').toLowerCase(), phone: rfPhone ? (rfPhone.empty() ? '' : rfPhone.valid() ? rfPhone.e164() : v('rf-phone')) : v('rf-phone'), country: v('rf-country'), company: v('rf-company'), service: v('rf-service'), message: v('rf-msg'), language: v('rf-lang'), consent: $('#rf-consent').checked };
          if (p.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return C.msg($('#rf-msgbox'), t('e_name'), 'error');
          if (!p.consent) return C.msg($('#rf-msgbox'), t('e_consent'), 'error');
          var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
          var r = await sb.rpc('submit_referral', { p: p });
          btn.disabled = false;
          if (r.error) return C.msg($('#rf-msgbox'), /rate_limited/.test(r.error.message) ? t('e_rate') : /pending_approval/.test(r.error.message) ? t('ref_pending') : /account_closing/.test(r.error.message) ? t('ac_closingNoRef') : /consent/.test(r.error.message) ? t('e_consent') : /invalid_/.test(r.error.message) ? t('e_name') : C.errText(r.error), 'error');
          ERoute.set('#/referrals?id=' + r.data, true); C.route();
        };
      }

      /* ---------- commissions ---------- */
      async function vComm(view) {
        var rows = (await sb.rpc('partner_commissions')).data || [];
        var paid = rows.filter(function (c) { return c.transfer_status === 'paid'; }).reduce(function (s, c) { return s + c.partner_amount_cents; }, 0);
        var due = rows.filter(function (c) { return c.status !== 'void' && c.status !== 'uncollectible' && c.transfer_status !== 'paid' && c.transfer_status !== 'reversed'; }).reduce(function (s, c) { return s + c.partner_amount_cents; }, 0);
        view.innerHTML = C.head(t('r_nav_comm'), t('c_lead')) + '<div class="kpis" style="margin-bottom:1.25rem">' + C.kpi(t('k_earned'), money(paid), true) + C.kpi(t('k_due'), money(due), true) + '</div>' +
          '<section class="portal-card">' + (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + t('c_date') + '</th><th>' + t('c_client') + '</th><th>' + t('c_inv') + '</th><th class="num">' + t('c_total') + '</th><th class="num">' + t('c_share') + '</th><th>' + t('c_status') + '</th><th>' + t('c_payout') + '</th></tr></thead><tbody>' +
            rows.map(function (c) {
              return '<tr><td>' + esc(C.fmtDate(c.created_at)) + '</td><td>' + esc(c.client_label) + '</td><td>' + esc(c.number || '—') + '</td><td class="num">' + esc(money(c.total_cents, c.currency)) + '</td>' +
                '<td class="num"><strong>' + esc(money(c.partner_amount_cents, c.currency)) + '</strong>' + (c.partner_pct != null ? ' <span class="portal-muted">(' + esc(String(+c.partner_pct)) + '%)</span>' : '') + '</td>' +
                '<td><span class="inv-st inv-st--' + esc(c.status) + '">' + esc(t('is_' + c.status)) + '</span></td><td>' + esc(t('ts_' + c.transfer_status)) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '<div class="empty-state"><strong>' + t('c_none') + '</strong></div>') + '</section>';
      }

      /* ---------- Stripe payouts ---------- */
      async function vPay(view, note) {
        var ss = stripeState();
        view.innerHTML = C.head(t('r_nav_pay'), t('p_lead')) +
          '<div class="dash"><section class="portal-card"><h2 class="portal-h2">' + t('p_status') + '</h2><p><span class="stripe-st stripe-st--' + ss[0] + '">' + esc(ss[1]) + '</span></p>' +
          (P.stripe_account_id ? '<dl class="kv" style="margin:1rem 0"><dt>' + t('p_accountId') + '</dt><dd><code>' + esc(P.stripe_account_id) + '</code></dd><dt>' + t('p_transfers') + '</dt><dd>' + t(P.stripe_transfers_active ? 'yes' : 'no') + '</dd><dt>' + t('p_payouts') + '</dt><dd>' + t(P.stripe_payouts_enabled ? 'yes' : 'no') + '</dd><dt>' + t('p_sharePct') + '</dt><dd>' + esc(pctTxt()) + '</dd></dl>' : '') + (ss[0] === 'ok' ? '<div class="portal-alert portal-alert--ok" style="display:block">' + t('p_readyMsg') + '</div>' : '') +
          (!P.stripe_account_id ? '<div class="field" style="max-width:20rem;margin-top:1rem"><label for="py-country">' + t('p_country') + '</label><select id="py-country">' + COUNTRIES.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('') + '</select></div>' : '') +
          '<div class="portal-alert" id="py-msg" role="status"></div><div class="portal-btn-row" style="margin-top:1rem">' +
          (ss[0] === 'ok' || ss[0] === 'review' ? '<button class="btn btn--navy" type="button" id="py-dash">' + t('p_dashboard') + '</button>' : '<button class="btn btn--navy" type="button" id="py-connect">' + t(P.stripe_account_id ? 'p_continue' : 'p_connect') + '</button>') +
          (P.stripe_account_id ? '<button class="btn btn--ghost" type="button" id="py-refresh">' + t('p_refresh') + '</button>' : '') + '</div></section>' +
          '<aside class="portal-card"><h2 class="portal-h2">' + t('p_steps') + '</h2><ol class="steps-ol"><li>' + t('p_s1') + '</li><li>' + t('p_s2') + '</li><li>' + t('p_s3') + '</li></ol>' +
          '<h2 class="portal-h2" style="margin-top:1rem">' + t('p_need') + '</h2><ul class="pw-need"><li>' + t('need1') + '</li><li>' + t('need2') + '</li><li>' + t('need3') + '</li></ul><p class="portal-muted" style="font-size:.85rem">' + t('p_needNote') + '</p></aside></div>';
        if (note) C.msg($('#py-msg'), note, 'ok');
        var err = function (e) { C.msg($('#py-msg'), /stripe_not_configured|stripe_error/.test(e.message) ? t('p_notReady') : C.errText(e), 'error'); };
        if ($('#py-connect')) $('#py-connect').onclick = async function () {
          this.disabled = true;
          try { var j = await pay({ action: 'partner_onboard', country: $('#py-country') ? $('#py-country').value : undefined, return_to: C.siteUrl('partner.html') + '?lang=' + L }); if (/^#/.test(j.url)) { ERoute.go(j.url); } else window.location.assign(j.url); }
          catch (e) { this.disabled = false; err(e); }
        };
        if ($('#py-dash')) $('#py-dash').onclick = async function () { try { var j = await pay({ action: 'partner_login' }); if (!/^#/.test(j.url)) window.open(j.url, '_blank', 'noopener'); } catch (e) { err(e); } };
        if ($('#py-refresh')) $('#py-refresh').onclick = async function () { try { await refresh(); vPay(view, t('p_returned')); } catch (e) { err(e); } };
      }
      async function refresh() {
        await pay({ action: 'partner_refresh' });
        var r = await sb.from('partners').select('*').eq('id', P.id).single(); if (!r.error) { P = r.data; C.S.partner = P; }
        if (!P.onboarding_done_at) await obCheck();
      }
      // "My account": contact details, second e-mail, login e-mail, password, account closure — one page, no scrolling
      function accErr(e) { var m = (e && e.message) || String(e); return /too_many_attempts/.test(m) ? t('ac_many') : /wrong_password/.test(m) ? t('ac_wrong') : /invalid_phone/.test(m) ? t('e_phone') : /invalid_email/.test(m) ? t('e_email') : /invalid_name/.test(m) ? t('e_name2') : C.errText(e); }
      async function checkPass(pw) { var r = await sb.rpc('verify_my_password', { p_password: pw }); if (r.error) throw r.error; if (r.data !== true) throw new Error('wrong_password'); }
      async function vAccount(view) {
        var u = (await sb.auth.getUser()).data.user || {};
        var fld = function (id, label, type, val, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '"' + (val != null ? ' value="' + esc(val) + '"' : '') + (extra || '') + '></div>'; };
        var closeCard = closing()
          ? '<div class="portal-alert portal-alert--info" style="display:block;margin:0 0 .6rem">' + esc(t('ac_closing', { d: C.fmtDate(P.closure_requested_at) })) + '</div><button class="btn btn--ghost btn--sm" type="button" id="ac-keep">' + t('ac_cancel') + '</button>'
          : '<p class="portal-muted" style="font-size:.86rem;margin:0 0 .7rem">' + t('ac_closeTxt') + '</p><button class="btn btn--danger btn--sm" type="button" id="ac-close">' + t('ac_closeBtn') + '</button>';
        view.innerHTML = C.head(t('ac_nav'), t('ac_lead')) + '<div class="acc-grid">' +
          '<section class="portal-card acc-card acc-card--wide"><h2 class="portal-h2">' + t('ac_contact') + '</h2><form class="portal-form acc-form acc-form--2" id="ac-f1" novalidate>' +
            fld('ac-name', t('ac_name'), 'text', P.name, ' autocomplete="name" maxlength="200" required') +
            '<div class="field"><label for="ac-phone">' + t('ac_phone') + '</label><div id="ac-phone-box"></div></div>' +
            fld('ac-company', t('ac_company'), 'text', P.company || '', ' autocomplete="organization" maxlength="200"') +
            fld('ac-email2', t('ac_email2'), 'email', P.email2 || '', ' autocomplete="email" maxlength="200" aria-describedby="ac-e2h"').replace('</div>', '<p class="acc-hint" id="ac-e2h">' + t('ac_email2h') + '</p></div>') +
            '<div class="acc-foot"><button class="btn btn--navy btn--sm" type="submit">' + t('ac_save') + '</button><div class="portal-alert" id="ac-m1" role="status"></div></div></form></section>' +
          '<section class="portal-card acc-card"><h2 class="portal-h2">' + t('ac_login') + '</h2><p class="acc-cur">' + t('ac_cur') + ' <strong>' + esc(u.email || P.email) + '</strong></p><form class="portal-form acc-form" id="ac-f2" novalidate>' +
            fld('ac-new', t('ac_newEmail'), 'email', null, ' autocomplete="email" maxlength="200" required') +
            fld('ac-p2', t('ac_curPass'), 'password', null, ' autocomplete="current-password" required') +
            '<div class="portal-alert" id="ac-m2" role="status"></div><button class="btn btn--navy btn--sm" type="submit">' + t('ac_changeEmail') + '</button></form></section>' +
          '<section class="portal-card acc-card"><h2 class="portal-h2">' + t('ac_pass') + '</h2><form class="portal-form acc-form" id="ac-f3" novalidate>' +
            fld('ac-p3', t('ac_curPass'), 'password', null, ' autocomplete="current-password" required') +
            fld('ac-n3', t('ac_newPass'), 'password', null, ' autocomplete="new-password" minlength="12" required') +
            fld('ac-c3', t('ac_confPass'), 'password', null, ' autocomplete="new-password" minlength="12" required') +
            '<div class="portal-alert" id="ac-m3" role="status"></div><button class="btn btn--navy btn--sm" type="submit">' + t('ac_changePass') + '</button></form></section>' +
          '<section class="portal-card acc-card acc-card--danger"><h2 class="portal-h2">' + t('ac_close') + '</h2>' + closeCard + '<div class="portal-alert" id="ac-m4" role="status"></div></section>' +
          '</div>';
        var phone = window.EPhone ? EPhone.mount($('#ac-phone-box'), { id: 'ac-phone', lang: L, value: P.phone || '', country: P.payout_country || P.country || undefined }) : null;
        if (!phone) $('#ac-phone-box').innerHTML = '<input id="ac-phone" type="tel" autocomplete="tel" value="' + esc(P.phone || '') + '">';
        var busy = function (f, on) { var b = f.querySelector('button[type=submit]'); if (b) b.disabled = on; };
        $('#ac-f1').onsubmit = async function (e) {
          e.preventDefault(); var f = this, m = $('#ac-m1');
          var ph = phone ? phone.e164() : $('#ac-phone').value.replace(/[^\d+]/g, '');
          if ($('#ac-name').value.trim().length < 2) return C.msg(m, t('e_name2'), 'error');
          if (phone ? !phone.valid() : !/^\+[1-9]\d{6,14}$/.test(ph)) return C.msg(m, t('e_phone'), 'error');
          busy(f, true);
          var r = await sb.rpc('partner_update_profile', { p_name: $('#ac-name').value.trim(), p_phone: ph, p_company: $('#ac-company').value.trim(), p_email2: $('#ac-email2').value.trim() });
          busy(f, false);
          if (r.error) return C.msg(m, accErr(r.error), 'error');
          if (r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; }
          C.msg(m, t('ac_saved'), 'ok');
        };
        $('#ac-f2').onsubmit = async function (e) {
          e.preventDefault(); var f = this, m = $('#ac-m2'), ne = $('#ac-new').value.trim().toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(ne)) return C.msg(m, t('e_email'), 'error');
          if (ne === String(u.email || '').toLowerCase()) return C.msg(m, t('ac_same'), 'error');
          busy(f, true);
          try {
            await checkPass($('#ac-p2').value);
            var r = await sb.auth.updateUser({ email: ne }, { emailRedirectTo: C.siteUrl('partner.html') + '?lang=' + L });
            if (r.error) throw r.error;
            f.reset(); C.msg(m, t('ac_emailSent'), 'ok');
          } catch (er) { C.msg(m, accErr(er), 'error'); }
          busy(f, false);
        };
        $('#ac-f3').onsubmit = async function (e) {
          e.preventDefault(); var f = this, m = $('#ac-m3'), np = $('#ac-n3').value;
          if (np.length < 12) return C.msg(m, t('ac_passShort'), 'error');
          if (np !== $('#ac-c3').value) return C.msg(m, t('ac_passDiff'), 'error');
          busy(f, true);
          try {
            await checkPass($('#ac-p3').value);
            var r = await sb.auth.updateUser({ password: np }); if (r.error) throw r.error;
            f.reset(); C.msg(m, t('ac_passOk'), 'ok');
          } catch (er) { C.msg(m, accErr(er), 'error'); }
          busy(f, false);
        };
        if ($('#ac-keep')) $('#ac-keep').onclick = async function () {
          this.disabled = true; var r = await sb.rpc('partner_cancel_closure');
          if (r.error) { this.disabled = false; return C.msg($('#ac-m4'), accErr(r.error), 'error'); }
          if (r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; }
          await vAccount(view); C.msg($('#ac-m4'), t('ac_cancelled'), 'ok');
        };
        if ($('#ac-close')) $('#ac-close').onclick = function () {
          var w = t('ac_closeWord');
          var o = obModal({ title: t('ac_closeQ'), body: '<p style="margin:0 0 .8rem">' + t('ac_closeTxt') + '</p><form class="portal-form" id="ac-f4" novalidate>' +
            fld('ac-p4', t('ac_curPass'), 'password', null, ' autocomplete="current-password" required') +
            fld('ac-w4', esc(t('ac_closeType', { w: w })), 'text', null, ' autocomplete="off" autocapitalize="characters" required') +
            '<div class="portal-alert" id="ac-m5" role="alert"></div><button class="btn btn--danger" type="submit" disabled>' + t('ac_closeConfirm') + '</button></form>' });
          var fm = o.querySelector('#ac-f4'), sbm = fm.querySelector('button[type=submit]');
          var upd = function () { sbm.disabled = !(fm.querySelector('#ac-w4').value.trim().toUpperCase() === w && fm.querySelector('#ac-p4').value); };
          fm.querySelector('#ac-w4').oninput = upd; fm.querySelector('#ac-p4').oninput = upd;
          fm.querySelector('#ac-p4').focus();
          fm.onsubmit = async function (e) {
            e.preventDefault(); if (sbm.disabled) return; sbm.disabled = true;
            var r = await sb.rpc('partner_request_closure', { p_password: fm.querySelector('#ac-p4').value });
            if (r.error) { sbm.disabled = false; return C.msg(fm.querySelector('#ac-m5'), accErr(r.error), 'error'); }
            if (r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; }
            C.closeOverlay(); vAccount(view);
          };
        };
      }
      async function vPayRoute(view) {
        if (C.param('stripe') === 'return') { try { await refresh(); } catch (e) { /* ignore */ } ERoute.set('#/payouts', true); return vPay(view, t('p_returned')); }
        return vPay(view);
      }

      return {
        nav: (P.onboarding_done_at ? [] : [['onboarding', t('o_nav'), 'i-play']]).concat([['ref-home', t('r_nav_home'), 'i-grid'], ['referrals', t('r_nav_refs'), 'i-users'], ['ref-new', t('r_nav_new'), 'i-plus'], ['commissions', t('r_nav_comm'), 'i-chart'], ['payouts', t('r_nav_pay'), 'i-card']]).concat(P.onboarding_done_at ? [['onboarding', t('o_nav'), 'i-play']] : []),
        sep: t('r_sep_clients'), accLabel: t('ac_nav'),
        views: { onboarding: vOnb, 'ref-home': vHome, referrals: vRefs, 'ref-new': vNew, commissions: vComm, payouts: vPayRoute, settings: vAccount }
      };
    }
  };
})();
