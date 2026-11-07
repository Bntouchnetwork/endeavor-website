/* Partner portal: referrals (pipeline, documents received, timeline), commissions and Stripe Connect payouts.
   Loaded by partner.html; client.js calls EPartnerRef.init(ctx) when the signed-in user is an active referral partner. */
(function () {
  'use strict';
  var STAGES = ['submitted', 'contacted', 'proposal', 'onboarding', 'in_process', 'completed'];
  var SERVICES = ['Start a U.S. Company', 'Registered Agent', 'EIN / ITIN', 'Annual Report / Compliance', 'Tax Services', 'Expand My Business to the U.S.',
    'Start Operations in Paraguay', 'Business Financing', 'Real Estate Structure', 'Family Office', 'Other Business Services'];
  var D = {
    en: {
      o_pixKey: 'Key', o_nav: 'Start here', o_title: 'Welcome to the Partner Program', o_lead: 'Watch the video and follow the steps to activate your account.', o_noVideo: 'The welcome video will be here soon.', o_seen: 'I watched it', o_steps: 'Steps to activate your account', o_s1: 'Portal access', o_s1d: 'Password and two-step verification are on.', o_s2: 'Watch the welcome video', o_s2d: 'How to refer, follow each client and get paid.', o_s3: 'How you get paid', o_s3d: 'Choose the country of the bank account that will receive your commissions.', o_country: 'Country of your bank account', o_us: 'You get paid through Stripe: your share goes automatically to your Stripe account when the client pays.', o_gp: 'For bank accounts in Brazil and Latin America, Endeavor sends your commission through Stripe Global Payouts after the client pays. You will receive a Stripe link by email to add your bank. Endeavor never sees these details.', o_pix: 'Pix key (optional)', o_pixNote: 'For Pix payouts, coming soon. Use an email, mobile number or random key (not your CPF).', o_pixType: 'Key type', pt_email: 'Email', pt_phone: 'Mobile', pt_random: 'Random key', o_save: 'Save', o_saved: 'Saved.', o_gpRequested: 'Request received: you will get the Stripe link by email to add your bank.', o_gpLink: 'Link sent: check your email to add your bank.', o_gpReady: 'All set to receive.', o_s4: 'Partner agreement', o_s4none: 'We send it after the onboarding call.', o_s5: 'Account activated', o_s5d: 'After approval you can start referring clients.', o_s5wait: 'Waiting for Endeavor approval.', o_done: 'All set! Your account is active.', o_tour: 'Get to know the portal', o_t1: 'Send a client\'s contact in under a minute.', o_t2: 'Follow each client step by step. You also get an email at every step.', o_t3: 'See what you have earned and what is coming.', o_t4: 'Your Stripe account and payout status.', o_banner: 'Almost there: finish your onboarding to start referring.', o_continue: 'Continue', e_pix: 'Invalid Pix key for the selected type.', o_change: 'Change',
      w_title: 'Welcome! Your registration is under review', w_lead: 'Follow the steps below. After the onboarding call we approve your account and send the partner agreement.', w_s1: 'Portal access created', w_s1d: 'Password and two-step verification are on.', w_s2: 'Create your Stripe account', w_s2d: 'This is where you receive your commissions.', w_s2ok: 'Your Stripe account is enabled to receive payouts.', w_s2rev: 'Stripe is reviewing your details.', w_s2btn: 'Create my Stripe account', w_need: 'Have at hand:', need1: 'A photo ID', need2: 'Your bank account details', need3: 'Your tax number: SSN, ITIN or EIN (if you are in the U.S.)', w_needNote: 'You enter everything directly with Stripe. Endeavor does not receive these details. Stripe also collects your tax form (W-9 or W-8) and issues Form 1099 when required.', w_s3: 'Onboarding call', w_s3none: 'We will agree on a time with you.', w_s4: 'Approval and agreement', w_s4d: 'We set your commission and you sign the partner agreement online.', pct_tbd: 'To be defined', ref_pending: 'You can send referrals as soon as your account is approved, after the onboarding call.', k_contract: 'Partner agreement', ct_sent: 'Waiting for your signature', ct_sign: 'Sign the agreement', ct_partner_signed: 'You signed. Waiting for Endeavor\'s signature.', ct_signed: 'Signed by both parties', ct_download: 'Download signed agreement', p_readyMsg: 'All set! Your Stripe account is enabled and your commissions go straight to it.', p_need: 'What you will need', p_needNote: 'You enter these details directly with Stripe; Endeavor never sees them. Stripe also collects your W-9 or W-8 tax form.',
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
      o_pixKey: 'Chave', o_nav: 'Comece aqui', o_title: 'Boas-vindas ao Programa de Parceiros', o_lead: 'Assista ao vídeo e siga os passos para ativar a sua conta.', o_noVideo: 'O vídeo de apresentação vai aparecer aqui em breve.', o_seen: 'Já assisti', o_steps: 'Passos para ativar a sua conta', o_s1: 'Acesso ao portal', o_s1d: 'Senha e verificação em duas etapas ativas.', o_s2: 'Assista ao vídeo de apresentação', o_s2d: 'Como indicar, acompanhar cada cliente e receber.', o_s3: 'Como você recebe', o_s3d: 'Escolha o país da conta bancária que vai receber as comissões.', o_country: 'País da sua conta bancária', o_us: 'Você recebe pelo Stripe: a sua parte cai automaticamente na sua conta Stripe quando o cliente paga.', o_gp: 'Para contas no Brasil e na América Latina, a Endeavor envia a sua comissão pelo Stripe Global Payouts depois que o cliente paga. Você recebe por e-mail um link do Stripe para cadastrar o seu banco. A Endeavor não vê esses dados.', o_pix: 'Chave Pix (opcional)', o_pixNote: 'Para o recebimento por Pix, que estará disponível em breve. Use e-mail, celular ou chave aleatória (não use o CPF).', o_pixType: 'Tipo de chave', pt_email: 'E-mail', pt_phone: 'Celular', pt_random: 'Chave aleatória', o_save: 'Salvar', o_saved: 'Salvo.', o_gpRequested: 'Pedido recebido: você vai receber por e-mail o link do Stripe para cadastrar o seu banco.', o_gpLink: 'Link enviado: confira o seu e-mail para cadastrar o banco.', o_gpReady: 'Tudo certo para receber.', o_s4: 'Contrato de parceria', o_s4none: 'Enviamos depois da conversa de onboarding.', o_s5: 'Conta ativada', o_s5d: 'Depois da aprovação, você já pode indicar clientes.', o_s5wait: 'Aguardando a aprovação da Endeavor.', o_done: 'Tudo pronto! Sua conta está ativa.', o_tour: 'Conheça o portal', o_t1: 'Envie o contato de um cliente em menos de um minuto.', o_t2: 'Acompanhe cada cliente etapa por etapa. Você também recebe um e-mail a cada etapa.', o_t3: 'Veja o que já recebeu e o que vai receber.', o_t4: 'Sua conta Stripe e a situação dos repasses.', o_banner: 'Falta pouco: termine o onboarding para começar a indicar.', o_continue: 'Continuar', e_pix: 'Chave Pix inválida para o tipo escolhido.', o_change: 'Alterar',
      w_title: 'Boas-vindas! Seu cadastro está em análise', w_lead: 'Siga os passos abaixo. Depois da conversa de onboarding, aprovamos a sua conta e enviamos o contrato de parceria.', w_s1: 'Acesso ao portal criado', w_s1d: 'Senha e verificação em duas etapas ativas.', w_s2: 'Crie sua conta Stripe', w_s2d: 'É por ela que você recebe as comissões.', w_s2ok: 'Sua conta Stripe está habilitada para receber.', w_s2rev: 'O Stripe está analisando os seus dados.', w_s2btn: 'Criar minha conta no Stripe', w_need: 'Tenha em mãos:', need1: 'Documento com foto', need2: 'Dados da conta bancária', need3: 'Número fiscal: SSN, ITIN ou EIN (se estiver nos EUA)', w_needNote: 'Você informa tudo direto no Stripe. A Endeavor não recebe esses dados. O Stripe também coleta o seu formulário fiscal (W-9 ou W-8) e emite o 1099 quando for o caso.', w_s3: 'Conversa de onboarding', w_s3none: 'Vamos combinar o horário com você.', w_s4: 'Aprovação e contrato', w_s4d: 'Definimos a sua comissão e você assina o contrato de parceria online.', pct_tbd: 'A definir', ref_pending: 'Você poderá enviar indicações assim que a sua conta for aprovada, depois da conversa de onboarding.', k_contract: 'Contrato de parceria', ct_sent: 'Aguardando a sua assinatura', ct_sign: 'Assinar contrato', ct_partner_signed: 'Você assinou. Aguardando a assinatura da Endeavor.', ct_signed: 'Assinado pelas duas partes', ct_download: 'Baixar contrato assinado', p_readyMsg: 'Tudo certo! Sua conta Stripe está habilitada e as comissões caem direto nela.', p_need: 'O que você vai precisar', p_needNote: 'Você informa esses dados direto no Stripe; a Endeavor nunca vê. O Stripe também coleta o seu formulário fiscal W-9 ou W-8.',
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
      o_pixKey: 'Clave', o_nav: 'Empiece aquí', o_title: 'Bienvenido(a) al Programa de Socios', o_lead: 'Mire el video y siga los pasos para activar su cuenta.', o_noVideo: 'El video de bienvenida estará aquí pronto.', o_seen: 'Ya lo vi', o_steps: 'Pasos para activar su cuenta', o_s1: 'Acceso al portal', o_s1d: 'Contraseña y verificación en dos pasos activas.', o_s2: 'Mire el video de bienvenida', o_s2d: 'Cómo recomendar, seguir a cada cliente y recibir.', o_s3: 'Cómo recibe', o_s3d: 'Elija el país de la cuenta bancaria que recibirá sus comisiones.', o_country: 'País de su cuenta bancaria', o_us: 'Usted recibe por Stripe: su parte va automáticamente a su cuenta Stripe cuando el cliente paga.', o_gp: 'Para cuentas en Brasil y América Latina, Endeavor envía su comisión por Stripe Global Payouts después de que el cliente paga. Recibirá por correo un enlace de Stripe para registrar su banco. Endeavor no ve estos datos.', o_pix: 'Clave Pix (opcional)', o_pixNote: 'Para pagos por Pix, disponibles pronto. Use correo, celular o clave aleatoria (no use el CPF).', o_pixType: 'Tipo de clave', pt_email: 'Correo', pt_phone: 'Celular', pt_random: 'Clave aleatoria', o_save: 'Guardar', o_saved: 'Guardado.', o_gpRequested: 'Solicitud recibida: recibirá por correo el enlace de Stripe para registrar su banco.', o_gpLink: 'Enlace enviado: revise su correo para registrar su banco.', o_gpReady: 'Todo listo para recibir.', o_s4: 'Contrato de socio', o_s4none: 'Lo enviamos después de la llamada de onboarding.', o_s5: 'Cuenta activada', o_s5d: 'Después de la aprobación ya puede recomendar clientes.', o_s5wait: 'Esperando la aprobación de Endeavor.', o_done: '¡Todo listo! Su cuenta está activa.', o_tour: 'Conozca el portal', o_t1: 'Envíe el contacto de un cliente en menos de un minuto.', o_t2: 'Siga a cada cliente paso a paso. También recibe un correo en cada etapa.', o_t3: 'Vea lo que ya recibió y lo que va a recibir.', o_t4: 'Su cuenta Stripe y el estado de los pagos.', o_banner: 'Falta poco: termine el onboarding para empezar a recomendar.', o_continue: 'Continuar', e_pix: 'Clave Pix inválida para el tipo elegido.', o_change: 'Cambiar',
      w_title: '¡Bienvenido(a)! Su registro está en revisión', w_lead: 'Siga los pasos de abajo. Después de la llamada de onboarding, aprobamos su cuenta y enviamos el contrato de socio.', w_s1: 'Acceso al portal creado', w_s1d: 'Contraseña y verificación en dos pasos activas.', w_s2: 'Cree su cuenta Stripe', w_s2d: 'Ahí recibe sus comisiones.', w_s2ok: 'Su cuenta Stripe está habilitada para recibir.', w_s2rev: 'Stripe está revisando sus datos.', w_s2btn: 'Crear mi cuenta en Stripe', w_need: 'Tenga a mano:', need1: 'Un documento con foto', need2: 'Los datos de su cuenta bancaria', need3: 'Su número fiscal: SSN, ITIN o EIN (si está en EE. UU.)', w_needNote: 'Usted ingresa todo directamente en Stripe. Endeavor no recibe estos datos. Stripe también recoge su formulario fiscal (W-9 o W-8) y emite el 1099 cuando corresponde.', w_s3: 'Llamada de onboarding', w_s3none: 'Acordaremos un horario con usted.', w_s4: 'Aprobación y contrato', w_s4d: 'Definimos su comisión y usted firma el contrato de socio en línea.', pct_tbd: 'Por definir', ref_pending: 'Podrá enviar recomendaciones en cuanto su cuenta sea aprobada, después de la llamada de onboarding.', k_contract: 'Contrato de socio', ct_sent: 'Esperando su firma', ct_sign: 'Firmar el contrato', ct_partner_signed: 'Usted firmó. Esperando la firma de Endeavor.', ct_signed: 'Firmado por ambas partes', ct_download: 'Descargar contrato firmado', p_readyMsg: '¡Todo listo! Su cuenta Stripe está habilitada y sus comisiones llegan directo a ella.', p_need: 'Lo que va a necesitar', p_needNote: 'Usted ingresa estos datos directamente en Stripe; Endeavor nunca los ve. Stripe también recoge su formulario fiscal W-9 o W-8.',
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
      function obState(video) {
        var ss = stripeState()[0];
        var pay = !P.payout_method ? '' : P.payout_method === 'stripe' ? (ss === 'ok' ? 'done' : 'now') : (P.global_payouts_status === 'ready' ? 'done' : 'now');
        var st = { access: true, video: !video || !!P.video_seen_at, pay: pay === 'done', payNow: pay, contract: P.contract_status === 'signed', approved: P.program_status === 'approved' };
        st.all = st.video && st.pay && st.contract && st.approved;
        return st;
      }
      async function vOnb(view) {
        var cfg = (await sb.from('crm_settings').select('partner_video_url').eq('id', 1).maybeSingle()).data || {};
        var video = cfg.partner_video_url || '', st = obState(video);
        if (st.all && !P.onboarding_done_at) { var rr = await sb.rpc('partner_onboarding_mark', { p_step: 'done' }); if (!rr.error && rr.data && rr.data[0]) { P = rr.data[0]; C.S.partner = P; } }
        var step = function (done, now, n, title, body) { return '<li class="' + (done ? 'is-done' : now ? 'is-now' : '') + '"><span class="pw-dot" aria-hidden="true">' + (done ? '✓' : n) + '</span><div><strong>' + title + '</strong>' + body + '</div></li>'; };
        var ctry = P.payout_country || (L === 'pt' ? 'BR' : 'US'), gp = function (c) { return STRIPE_C.indexOf(c) < 0; };
        var payStatus = !P.payout_method ? '' : P.payout_method === 'stripe'
          ? '<p><span class="stripe-st stripe-st--' + stripeState()[0] + '">' + esc(stripeState()[1]) + '</span></p>' + (st.pay ? '' : '<a class="btn btn--navy btn--xs" href="#/payouts">' + t('p_connect') + '</a>')
          : '<p><span class="stripe-st stripe-st--' + (st.pay ? 'ok' : 'review') + '">' + esc(t(P.global_payouts_status === 'ready' ? 'o_gpReady' : P.global_payouts_status === 'link_sent' ? 'o_gpLink' : 'o_gpRequested')) + '</span></p>';
        var payForm = '<form class="ob-pay" id="ob-pay"' + (P.payout_method ? ' hidden' : '') + ' novalidate><div class="field"><label for="ob-c">' + t('o_country') + '</label><select id="ob-c">' + OB_C.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === ctry ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></div>' +
          '<p class="portal-muted ob-how" id="ob-how"></p>' +
          '<fieldset class="ob-pix" id="ob-pixbox"><legend>' + t('o_pix') + '</legend><div class="ob-pix__row"><div class="field"><label for="ob-pt">' + t('o_pixType') + '</label><select id="ob-pt"><option value="email">' + t('pt_email') + '</option><option value="phone">' + t('pt_phone') + '</option><option value="random">' + t('pt_random') + '</option></select></div>' +
          '<div class="field"><label for="ob-pk">' + t('o_pixKey') + '</label><input id="ob-pk" maxlength="140" autocomplete="off" value="' + esc(P.pix_key || '') + '"></div></div><p class="portal-muted" style="font-size:.82rem;margin:.2rem 0 0">' + t('o_pixNote') + '</p></fieldset>' +
          '<div class="portal-alert" id="ob-m" role="alert"></div><button class="btn btn--navy btn--xs" type="submit">' + t('o_save') + '</button></form>';
        var contract = P.contract_status === 'sent' && P.contract_partner_token ? '<p>' + t('ct_sent') + '</p><a class="btn btn--navy btn--xs" href="sign.html?t=' + esc(P.contract_partner_token) + '&lang=' + L + '&ret=partner">' + t('ct_sign') + '</a>'
          : '<p>' + t(P.contract_status === 'signed' ? 'ct_signed' : P.contract_status === 'partner_signed' ? 'ct_partner_signed' : 'o_s4none') + '</p>';
        var tour = [['ref-new', 'r_nav_new', 'o_t1', 'i-plus'], ['referrals', 'r_nav_refs', 'o_t2', 'i-users'], ['commissions', 'r_nav_comm', 'o_t3', 'i-chart'], ['payouts', 'r_nav_pay', 'o_t4', 'i-card']];
        view.innerHTML = C.head(t('o_title'), t('o_lead'), st.all ? '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>' : '') +
          (st.all ? '<div class="portal-alert portal-alert--ok" style="display:block;margin-bottom:1rem">' + t('o_done') + '</div>' : '') +
          '<div class="ob-grid"><section class="portal-card ob-main">' + videoHtml(video) +
            (video && !P.video_seen_at ? '<div class="portal-btn-row" style="margin-top:.75rem"><button class="btn btn--ghost btn--xs" type="button" id="ob-seen">✓ ' + t('o_seen') + '</button></div>' : '') +
            '</section><section class="portal-card ob-tourc"><h2 class="portal-h2" style="margin:0">' + t('o_tour') + '</h2><ul class="ob-tour">' + tour.map(function (x) { return '<li><a href="#/' + x[0] + '"><svg class="icon" aria-hidden="true"><use href="#' + x[3] + '"/></svg><span><strong>' + t(x[1]) + '</strong><span>' + t(x[2]) + '</span></span></a></li>'; }).join('') + '</ul></section>' +
          '<section class="portal-card pw ob-steps"><h2 class="portal-h2" style="margin:0">' + t('o_steps') + '</h2><ol class="pw-steps">' +
            step(true, false, 1, t('o_s1'), '<p>' + t('o_s1d') + '</p>') +
            (video ? step(st.video, !st.video, 2, t('o_s2'), '<p>' + t('o_s2d') + '</p>') : '') +
            step(st.pay, !st.pay, video ? 3 : 2, t('o_s3'), (P.payout_method ? payStatus + '<button class="linklike" type="button" id="ob-edit">' + t('o_change') + '</button>' : '<p>' + t('o_s3d') + '</p>') + payForm) +
            step(st.contract, P.contract_status === 'sent', video ? 4 : 3, t('o_s4'), contract) +
            step(st.approved, false, video ? 5 : 4, t('o_s5'), '<p>' + t(st.approved ? 'o_s5d' : 'o_s5wait') + '</p>') +
          '</ol></section></div>';
        var how = function () { var c = $('#ob-c').value, g = gp(c); $('#ob-how').textContent = t(g ? 'o_gp' : 'o_us'); $('#ob-pixbox').hidden = c !== 'BR'; };
        $('#ob-c').onchange = how; how();
        if (P.pix_key_type) $('#ob-pt').value = P.pix_key_type;
        if ($('#ob-edit')) $('#ob-edit').onclick = function () { $('#ob-pay').hidden = false; this.hidden = true; };
        if ($('#ob-seen')) $('#ob-seen').onclick = async function () { this.disabled = true; var r = await sb.rpc('partner_onboarding_mark', { p_step: 'video' }); if (!r.error && r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; } vOnb(view); };
        var vid = view.querySelector('.ob-video video'); if (vid && !P.video_seen_at) vid.addEventListener('ended', function () { var b = $('#ob-seen'); if (b) b.click(); });
        $('#ob-pay').onsubmit = async function (e) {
          e.preventDefault();
          var c = $('#ob-c').value, pk = c === 'BR' ? $('#ob-pk').value.trim() : '', b = this.querySelector('button[type=submit]');
          b.disabled = true;
          var r = await sb.rpc('partner_set_payout', { p_method: gp(c) ? 'global_payouts' : 'stripe', p_country: c, p_pix: pk || null, p_pix_type: pk ? $('#ob-pt').value : null });
          b.disabled = false;
          if (r.error) return C.msg($('#ob-m'), /invalid_pix/.test(r.error.message) ? t('e_pix') : C.errText(r.error), 'error');
          if (r.data && r.data[0]) { P = r.data[0]; C.S.partner = P; }
          if (!gp(c) && stripeState()[0] !== 'ok') { ERoute.set('#/payouts', true); return C.route(); }
          vOnb(view);
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
        view.innerHTML = C.head(t('r_hello', { n: P.name.split(' ')[0] }), t('r_homeLead'), pending() ? '' : '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>') + obBanner() +
          '<div class="dash"><div><div class="kpis">' + C.kpi(t('k_refs'), refs.length) + C.kpi(t('k_active'), active) + C.kpi(t('k_won'), won) + C.kpi(t('k_earned'), money(earned), true) + '</div>' +
          '<section class="portal-card" style="margin-top:1.25rem"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + t('r_recent') + '</h2><a href="#/referrals">' + t('r_seeAll') + '</a></div>' +
          (refs.length ? '<ul class="ref-list">' + refs.slice(0, 6).map(refRow).join('') + '</ul>' : '<div class="empty-state"><strong>' + t('r_none') + '</strong><p>' + (pending() ? t('ref_pending') : t('r_noneText')) + '</p>' + (pending() ? '' : '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>') + '</div>') + '</section></div>' +
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
        view.innerHTML = C.head(t('r_nav_refs'), t('r_refsLead'), '<a class="btn btn--navy" href="#/ref-new">' + t('r_newBtn') + '</a>') +
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
        if (pending()) { view.innerHTML = C.head(t('r_nav_new'), '') + '<div class="portal-alert portal-alert--info" style="display:block;max-width:44rem">' + t('ref_pending') + '</div>'; return; }
        view.innerHTML = C.head(t('r_nav_new'), t('r_newLead')) +
          '<section class="portal-card" style="max-width:44rem"><form class="portal-form" id="rf-form" novalidate>' +
          '<div class="portal-grid2"><div class="field"><label for="rf-name">' + t('f_name') + '</label><input id="rf-name" autocomplete="off" required maxlength="200"></div>' +
          '<div class="field"><label for="rf-email">' + t('f_email') + '</label><input id="rf-email" type="email" autocomplete="off" required maxlength="254"></div>' +
          '<div class="field"><label for="rf-phone">' + t('f_phone') + '</label><input id="rf-phone" type="tel" autocomplete="off" maxlength="50"></div>' +
          '<div class="field"><label for="rf-country">' + t('f_country') + '</label><input id="rf-country" maxlength="100"></div>' +
          '<div class="field"><label for="rf-company">' + t('f_company') + '</label><input id="rf-company" maxlength="200"></div>' +
          '<div class="field"><label for="rf-service">' + t('f_service') + '</label><select id="rf-service"><option value="">' + t('f_select') + '</option>' + SERVICES.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="rf-lang">' + t('f_lang') + '</label><select id="rf-lang"><option value="pt"' + (L === 'pt' ? ' selected' : '') + '>Português</option><option value="en"' + (L === 'en' ? ' selected' : '') + '>English</option><option value="es"' + (L === 'es' ? ' selected' : '') + '>Español</option></select></div></div>' +
          '<div class="field"><label for="rf-msg">' + t('f_msg') + '</label><textarea id="rf-msg" rows="4" maxlength="3000"></textarea></div>' +
          '<p class="portal-alert portal-alert--info" style="display:block">' + t('f_privacy') + '</p>' +
          '<div class="check-row"><input type="checkbox" id="rf-consent" required><label for="rf-consent">' + t('f_consent') + '</label></div>' +
          '<div class="portal-alert" id="rf-msgbox" role="alert"></div><button class="btn btn--navy" type="submit" style="justify-self:start">' + t('f_submit') + '</button></form></section>';
        $('#rf-form').onsubmit = async function (e) {
          e.preventDefault();
          var v = function (id) { return $('#' + id).value.trim(); };
          var p = { name: v('rf-name'), email: v('rf-email').toLowerCase(), phone: v('rf-phone'), country: v('rf-country'), company: v('rf-company'), service: v('rf-service'), message: v('rf-msg'), language: v('rf-lang'), consent: $('#rf-consent').checked };
          if (p.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) return C.msg($('#rf-msgbox'), t('e_name'), 'error');
          if (!p.consent) return C.msg($('#rf-msgbox'), t('e_consent'), 'error');
          var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
          var r = await sb.rpc('submit_referral', { p: p });
          btn.disabled = false;
          if (r.error) return C.msg($('#rf-msgbox'), /rate_limited/.test(r.error.message) ? t('e_rate') : /pending_approval/.test(r.error.message) ? t('ref_pending') : /consent/.test(r.error.message) ? t('e_consent') : /invalid_/.test(r.error.message) ? t('e_name') : C.errText(r.error), 'error');
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
      }
      async function vPayRoute(view) {
        if (C.param('stripe') === 'return') { try { await refresh(); } catch (e) { /* ignore */ } ERoute.set('#/payouts', true); return vPay(view, t('p_returned')); }
        return vPay(view);
      }

      return {
        nav: (P.onboarding_done_at ? [] : [['onboarding', t('o_nav'), 'i-play']]).concat([['ref-home', t('r_nav_home'), 'i-grid'], ['referrals', t('r_nav_refs'), 'i-users'], ['ref-new', t('r_nav_new'), 'i-plus'], ['commissions', t('r_nav_comm'), 'i-chart'], ['payouts', t('r_nav_pay'), 'i-card']]).concat(P.onboarding_done_at ? [['onboarding', t('o_nav'), 'i-play']] : []),
        sep: t('r_sep_clients'),
        views: { onboarding: vOnb, 'ref-home': vHome, referrals: vRefs, 'ref-new': vNew, commissions: vComm, payouts: vPayRoute }
      };
    }
  };
})();
