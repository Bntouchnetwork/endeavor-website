/* Endeavor client portal: companies, documents, tax compliance, QuickBooks reports, uploads and collaborators. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG;
  // links from the invitation / password e-mails arrive with #access_token=...&type=invite|recovery (read before Supabase clears it)
  var AUTH_HASH = String(location.hash || '');
  var AUTH_TYPE = (AUTH_HASH.match(/[#&]type=(invite|recovery|signup|magiclink)/) || [])[1] || null;
  var AUTH_ERR = /[#&]error_code=/.test(AUTH_HASH) ? ((AUTH_HASH.match(/[#&]error_code=([^&]+)/) || [])[1] || 'link') : null;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'endeavor-client-auth' } });
  var app = document.getElementById('app');

  /* ---------------- i18n ---------------- */
  var D = {
    en: {
      p_portal: 'Partner Portal', p_loginTitle: 'Partner portal', p_loginLead: 'For referral partners and for accountants, bookkeepers and property managers invited by Endeavor clients.',
      p_overviewLead: 'Documents and deadlines {c} shared with you.', p_clients: 'Client', p_noAccess: 'No partner access', p_noAccessText: 'This account is not linked to a partner program or to any client. If you were invited, confirm you used the same email. Questions: support@endeavorbiz.com.',
      useClientPortal: 'This account is a client account. Open the Client Portal instead.', usePartnerPortal: 'This account has partner access only. Open the Partner Portal instead.', openClient: 'Open Client Portal', openPartner: 'Open Partner Portal',
      access: 'Access', permCompanies: 'Companies', permAll: 'All companies (including new ones)', permDocs: 'Documents they can see', permOther: 'Other permissions',
      permDeadlines: 'Can see tax deadlines', permUpload: 'Can upload documents', permDocsHint: 'They always see the documents they uploaded.', editPerms: 'Permissions', savePerms: 'Save permissions', permsSaved: 'Permissions updated.',
      full: 'Full access', docsShort: 'Docs', noDocs: 'No documents', deadlinesShort: 'Deadlines', uploadShort: 'Upload', noCompanies: 'No companies', myAccess: 'My access', sharedBy: 'Shared by', yourRole: 'Your role',
      ck_title: 'Invoice payment', ck_summary: 'Order summary', ck_total: 'Total due', ck_method: 'Payment method', ck_pay: 'Pay {a}', ck_secure: 'Payments are processed securely by Stripe. Endeavor never sees or stores your card or bank details.', ck_pdf: 'Download invoice (PDF)', ck_hosted: 'Pay on the Stripe page instead', ck_back: 'Back to Billing', ck_ok: 'Payment received. Thank you!', ck_okText: 'Your receipt was sent by email. The invoice is now marked as paid.', ck_processing: 'Payment in process. Bank transfers and Pix can take a moment to confirm; the invoice updates automatically.', ck_err: 'The payment could not be completed', ck_notReady: 'Online payment is still being set up. Use the Stripe link sent by email or write to support@endeavorbiz.com.', ck_paidAlready: 'This invoice is already paid.', ck_methods: 'Card, Pix, U.S. bank transfer (ACH), Apple Pay, Google Pay and other methods enabled by Endeavor.', ck_qty: 'Qty', ck_due: 'Due date', ck_loading: 'Preparing secure payment…', invDetails: 'Pay now', ck_billTo: 'Billed to', ck_from: 'From',
      inv_openTitle: 'To pay', inv_history: 'Payment history', inv_historyLead: 'Paid invoices with a copy of each invoice kept in your portal.', inv_receipt: 'Paid invoice (PDF)', inv_paidOn: 'Paid on {d}', inv_banner: 'You have {n} open invoice(s) totaling {a}.', inv_bannerBtn: 'View and pay', inv_noOpen: 'Nothing to pay right now.', pay_mailSubject: 'Payment received', pay_mail: 'Hello {n},\n\nWe received your payment of {a} for invoice {i}. Thank you!\nA copy of the paid invoice is in the client portal, under Billing > Payment history: {l}\n\nEndeavor Business Hub\nsupport@endeavorbiz.com',
      inv_badge: '{n} open invoice(s) to pay', nav_invoices: 'Billing', invLead: 'Invoices from Endeavor. Pay securely by card or bank transfer through Stripe.', invNone: 'No invoices yet.', invNo: 'Invoice', invDate: 'Issued', invDue: 'Due', invTotal: 'Total', invStatus: 'Status', invPay: 'Pay now', invPdf: 'PDF', inv_open: 'Awaiting payment', inv_paid: 'Paid', inv_uncollectible: 'Overdue', invOpenTotal: 'Open balance', invPaidTotal: 'Paid this year', p_partnerLead: 'Referral partner',
      enrollS1: 'Install the free <strong>Google Authenticator</strong> app on your phone (<a href="{ios}" target="_blank" rel="noopener">iPhone</a> · <a href="{and}" target="_blank" rel="noopener">Android</a>). The icon is a colorful asterisk.', enrollS2: 'In the app, tap <strong>+</strong> and choose <strong>Scan a QR code</strong>. Point the camera at the code below.', enrollS3: 'Type the 6-digit code the app shows (it changes every 30 seconds) and click <strong>Activate and continue</strong>.', mfaHint: 'Open Google Authenticator and use the code shown under <strong>Endeavor Business Hub</strong>. Lost your phone? Write to support@endeavorbiz.com and we will reset your verification.',
      loading: 'Loading…', signOut: 'Sign out', menu: 'Menu', closeMenu: 'Close menu',
      portal: 'Client Portal', loginTitle: 'Client portal', loginLead: 'Access your companies, documents and deadlines.', email: 'Email', password: 'Password',
      signIn: 'Sign in', firstAccess: 'First access: create password', forgot: 'Forgot password', newPass: 'New password (12+ characters)', savePass: 'Save password',
      waText: 'I need information.', waLabel: 'Chat with Endeavor on WhatsApp (opens in a new tab)', loginHelp: 'First access? Use the link in the invitation email to create your password.', forgotTitle: 'Reset password', forgotLead: 'Enter your email. We will send a link to create a new password.', sendLink: 'Send link', backLogin: 'Back to sign in', inviteTitle: 'Create your password', inviteLead: 'Welcome to the Endeavor portal. Create your password to continue; next you will activate the code on your phone.', resetTitle: 'Create a new password', resetLead: 'Choose a new password for your account.', confirmPass: 'Confirm the password', passMismatch: 'The passwords do not match.', linkExpired: 'This link has expired or was already used. Enter your email below to receive a new one.', passSaved: 'Password saved.', passRules: 'At least 8 characters. Use a phrase or a mix of words and numbers.', showPass: 'Show password',
      badLogin: 'Incorrect email or password.', notConfirmed: 'Confirm your email using the link we sent, then sign in.', noInvite: 'This email does not have an invitation. Please contact Endeavor at support@endeavorbiz.com.',
      passShort: 'Use at least 8 characters in the Password field.', created: 'Account created. Open the confirmation email sent to {e}, click the link and then sign in here.',
      resetSent: 'If {e} is registered, you will receive a link to create a new password in a few minutes. Check the spelling of the address and your spam folder. You can ask again in 60 seconds.', weakPass: 'Weak password. Use at least 8 characters with upper and lower case letters, numbers and a symbol.', samePass: 'The new password must be different from the current one.', passMfa: 'Your account uses two-step verification. Enter the 6-digit code shown in Google Authenticator under "Endeavor Business Hub".', passMfaNeed: 'Enter the authenticator code to confirm the new password.', mfaTitle: 'Two-step verification', mfaLead: 'Enter the 6-digit code from your authenticator app.',
      code: 'Code', verify: 'Verify', badCode: 'Invalid code. Check your phone time and try again.', enrollTitle: 'Turn on two-step verification',
      enrollLead: 'Required to protect your tax and company documents. Scan the QR code with Google Authenticator, Microsoft Authenticator or 1Password and enter the code.',
      noCamera: 'No camera? Enter this key in the app:', activate: 'Activate and continue', noAccess: 'No active access', noAccessText: 'Your account is not linked to an active client portal. If you received an invitation, confirm you used the same email. Questions: support@endeavorbiz.com.',
      nav_attorneys: 'Attorneys', nav_projects: 'AI Projects', nav_overview: 'Overview', nav_companies: 'My Companies', nav_documents: 'Documents', nav_compliance: 'Tax Compliance', nav_reports: 'Financial Reports', nav_upload: 'Upload Documents', nav_collab: 'Collaborators', nav_settings: 'Settings',
      account: 'Account', hello: 'Hello, {n}', overviewLead: 'Everything about your U.S. companies in one place.',
      k_companies: 'Companies', k_next: 'Next deadline', k_docs: 'Documents', k_reports: 'Financial reports', none: 'None',
      nextDeadlines: 'Next deadlines', recentDocs: 'Recent documents', seeAll: 'See all', quick: 'Quick actions', qUpload: 'Upload documents for your tax return', qInvite: 'Invite your accountant or bookkeeper', qQbo: 'Connect QuickBooks',
      noCompanies: 'No companies yet', noCompaniesText: 'Endeavor will add your companies here.', formed: 'Formed {d}', docNumber: 'Florida document no.', ein: 'EIN', agent: 'Registered agent', fye: 'Fiscal year end', address: 'Address',
      st_active: 'Active', st_in_formation: 'In formation', st_inactive: 'Inactive', st_dissolved: 'Dissolved',
      tab_timeline: 'Timeline', tab_docs: 'Documents', tab_deadlines: 'Deadlines', tab_finance: 'Reports', back: 'My Companies',
      cat_formation: 'Formation', cat_onboarding: 'Opening documents', cat_tax_return: 'Tax return', cat_report: 'Financial report', cat_uploaded: 'Uploaded', cat_compliance: 'Compliance', cat_other: 'Other',
      allCompanies: 'All companies', allCategories: 'All categories', search: 'Search…', view: 'View', download: 'Download', print: 'Print', close: 'Close',
      noDocs: 'No documents yet', noPreview: 'Preview not available for this file type. Use Download.', viewErr: 'Could not open the file.',
      overdue: 'Overdue by {n} d', dueIn: 'In {n} d', dueToday: 'Due today', done: 'Completed', na: 'Not applicable', inProgress: 'In progress',
      complianceLead: 'Federal and state filing dates for your companies. Endeavor updates this calendar; confirm details with your CPA.', overBy: '{n} d ago', st_pending: 'Pending', st_overdue: 'Overdue', st_done: 'Done', doneOn: 'Done on {d}', onTime: 'on time', late: 'after the due date', v_list: 'List', v_cal: 'Calendar', sum_done: 'Done', sum_pend: 'Pending', sum_over: 'Overdue', dl_year: 'Year', noDeadlinesYear: 'No deadlines in this year.', dl_pickDay: 'Click a highlighted day to see its deadlines.', dl_none_day: 'No deadlines on this day.', newDocs: '{n} new documents', isNew: 'New', showDone: 'Show completed', addCal: 'Add to my calendar (.ics)', noDeadlines: 'No pending deadlines',
      dl_annual_report: 'Annual report', dl_federal_tax: 'Federal tax', dl_state_tax: 'State tax', dl_payroll: 'Payroll', dl_sales_tax: 'Sales tax', dl_boi: 'BOI', dl_license: 'License', dl_other: 'Other',
      reportsLead: 'Profit and Loss, Balance Sheet and Cash Flow prepared by Endeavor from your company\'s books, ready to view, print or save as PDF.', repPreparing: 'Endeavor is preparing your reports. They will appear here as soon as they are published.', repNone: 'Reports appear here when Endeavor keeps your books or connects your accounting.', repBy: 'Prepared by Endeavor',
      qboOn: 'QuickBooks connected', qboOff: 'QuickBooks not connected', connect: 'Connect QuickBooks', disconnect: 'Disconnect', generate: 'Generate reports', year: 'Year', period: 'Period',
      q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4', fy: 'Full year', generating: 'Generating reports from QuickBooks…', noReports: 'No reports yet.', ownerConnects: 'Only the account owner can connect QuickBooks.',
      qbo_not_configured: 'The QuickBooks integration is being set up by Endeavor. Please try again later.', qbo_reconnect_required: 'The QuickBooks connection expired. Please connect again.',
      qbo_not_connected: 'QuickBooks is not connected.', future_period: 'That period has not started yet.', forbidden: 'You do not have permission for this action.',
      qboConnected: 'QuickBooks connected successfully.', qboCancelled: 'QuickBooks connection was cancelled.', qboError: 'We could not connect QuickBooks. Please try again.', confirmDisconnect: 'Disconnect QuickBooks from this company?',
      uploadLead: 'Send receipts, statements, 1099s and other documents for your tax return. Please do not send passwords.', company: 'Company', docTitle: 'Description', yearOpt: 'Tax year (optional)',
      chooseFiles: 'Choose files or drag them here', fileHint: 'PDF, images, spreadsheets or Word · up to 25 MB each', send: 'Send', sending: 'Sending {i} of {n}…', sent: 'Documents sent. Endeavor has been notified.',
      pickFile: 'Choose at least one file.', tooBig: '{f} is larger than 25 MB.', myUploads: 'Documents I sent', uploadedBy: 'by {e}',
      collabLead: 'Give limited access to your accountant, bookkeeper or property manager. They sign in with their own email and password.', invite: 'Invite collaborator', name: 'Name',
      c_accountant: 'Accountant (CPA)', c_bookkeeping: 'Bookkeeping', c_property_management: 'Property management', c_other: 'Other', type: 'Type',
      canView: 'Can view company documents and reports', canUpload: 'Can upload documents', perms: 'Permissions', status: 'Status', s_invited: 'Invited', s_active: 'Active', s_revoked: 'Revoked',
      revoke: 'Revoke', resend: 'Resend invite', confirmRevoke: 'Revoke access for {e}?', inviteSent: 'Invitation sent to {e}.', inviteDup: 'This email already has access.', fillNameEmail: 'Enter a name and a valid email.',
      noCollab: 'No collaborators yet', owner: 'Account owner', viewOnly: 'View', uploadOnly: 'Upload',
      settingsLead: 'Your login and security.', mfaOn: 'Two-step verification is on', changePass: 'Change password', passChanged: 'Password changed.', lastLogin: 'Last sign-in',
      switchClient: 'Account', privacyNote: 'Access to every file is recorded for your security.', generic: 'Something went wrong. Please try again.'
    },
    pt: {
      p_portal: 'Portal do Parceiro', p_loginTitle: 'Portal do parceiro', p_loginLead: 'Para parceiros de indicação e para contadores, bookkeepers e administradores de imóveis convidados por clientes da Endeavor.',
      p_overviewLead: 'Documentos e prazos que {c} compartilhou com você.', p_clients: 'Cliente', p_noAccess: 'Sem acesso de parceiro', p_noAccessText: 'Esta conta não está ligada ao programa de parceiros nem a nenhum cliente. Se você foi convidado, confira se usou o mesmo e-mail. Dúvidas: support@endeavorbiz.com.',
      useClientPortal: 'Esta é uma conta de cliente. Abra o Portal do Cliente.', usePartnerPortal: 'Esta conta tem só acesso de parceiro. Abra o Portal do Parceiro.', openClient: 'Abrir Portal do Cliente', openPartner: 'Abrir Portal do Parceiro',
      access: 'Acesso', permCompanies: 'Empresas', permAll: 'Todas as empresas (inclusive novas)', permDocs: 'Documentos que pode ver', permOther: 'Outras permissões',
      permDeadlines: 'Pode ver os prazos fiscais', permUpload: 'Pode enviar documentos', permDocsHint: 'Ele sempre vê os documentos que ele mesmo enviou.', editPerms: 'Permissões', savePerms: 'Salvar permissões', permsSaved: 'Permissões atualizadas.',
      full: 'Acesso completo', docsShort: 'Docs', noDocs: 'Sem documentos', deadlinesShort: 'Prazos', uploadShort: 'Envio', noCompanies: 'Nenhuma empresa', myAccess: 'Meu acesso', sharedBy: 'Compartilhado por', yourRole: 'Seu perfil',
      ck_title: 'Pagamento da fatura', ck_summary: 'Resumo do pedido', ck_total: 'Total a pagar', ck_method: 'Forma de pagamento', ck_pay: 'Pagar {a}', ck_secure: 'Pagamento processado com segurança pelo Stripe. A Endeavor não vê nem guarda os dados do seu cartão ou da sua conta.', ck_pdf: 'Baixar fatura (PDF)', ck_hosted: 'Prefiro pagar na página do Stripe', ck_back: 'Voltar para Cobrança', ck_ok: 'Pagamento recebido. Obrigado!', ck_okText: 'O recibo foi enviado por e-mail e a fatura já aparece como paga.', ck_processing: 'Pagamento em processamento. Transferência bancária e Pix podem levar alguns instantes para confirmar; a fatura atualiza sozinha.', ck_err: 'Não foi possível concluir o pagamento', ck_notReady: 'O pagamento online ainda está sendo configurado. Use o link do Stripe enviado por e-mail ou escreva para support@endeavorbiz.com.', ck_paidAlready: 'Esta fatura já está paga.', ck_methods: 'Cartão, Pix, transferência bancária nos EUA (ACH), Apple Pay, Google Pay e outras formas habilitadas pela Endeavor.', ck_qty: 'Qtd', ck_due: 'Vencimento', ck_loading: 'Preparando o pagamento seguro…', invDetails: 'Pagar agora', ck_billTo: 'Cobrado de', ck_from: 'Emitido por',
      inv_openTitle: 'A pagar', inv_history: 'Histórico de pagamentos', inv_historyLead: 'Faturas pagas, com uma cópia de cada fatura guardada no seu portal.', inv_receipt: 'Fatura paga (PDF)', inv_paidOn: 'Paga em {d}', inv_banner: 'Você tem {n} fatura(s) em aberto, total de {a}.', inv_bannerBtn: 'Ver e pagar', inv_noOpen: 'Nada a pagar no momento.', pay_mailSubject: 'Pagamento recebido', pay_mail: 'Olá {n},\n\nRecebemos o seu pagamento de {a} referente à fatura {i}. Obrigado!\nA cópia da fatura paga fica no portal do cliente, em Cobrança > Histórico de pagamentos: {l}\n\nEndeavor Business Hub\nsupport@endeavorbiz.com',
      inv_badge: '{n} fatura(s) em aberto para pagar', nav_invoices: 'Cobrança', invLead: 'Faturas da Endeavor. Pague com segurança por cartão ou transferência bancária via Stripe.', invNone: 'Nenhuma fatura ainda.', invNo: 'Fatura', invDate: 'Emissão', invDue: 'Vencimento', invTotal: 'Total', invStatus: 'Status', invPay: 'Pagar agora', invPdf: 'PDF', inv_open: 'Aguardando pagamento', inv_paid: 'Paga', inv_uncollectible: 'Em atraso', invOpenTotal: 'Em aberto', invPaidTotal: 'Pago este ano', p_partnerLead: 'Parceiro de indicações',
      enrollS1: 'Instale no celular o app gratuito <strong>Google Authenticator</strong> (<a href="{ios}" target="_blank" rel="noopener">iPhone</a> · <a href="{and}" target="_blank" rel="noopener">Android</a>). O ícone é um asterisco colorido.', enrollS2: 'No app, toque no <strong>+</strong> e escolha <strong>Ler código QR</strong>. Aponte a câmera para o código abaixo.', enrollS3: 'Digite o código de 6 dígitos que aparece no app (ele muda a cada 30 segundos) e clique em <strong>Ativar e continuar</strong>.', mfaHint: 'Abra o Google Authenticator e use o código que aparece em <strong>Endeavor Business Hub</strong>. Perdeu o celular? Escreva para support@endeavorbiz.com que a Endeavor reseta a sua verificação.',
      loading: 'Carregando…', signOut: 'Sair', menu: 'Menu', closeMenu: 'Fechar menu',
      portal: 'Portal do Cliente', loginTitle: 'Portal do cliente', loginLead: 'Acesse suas empresas, documentos e prazos.', email: 'E-mail', password: 'Senha',
      signIn: 'Entrar', firstAccess: 'Primeiro acesso: criar senha', forgot: 'Esqueci a senha', newPass: 'Nova senha (mín. 8 caracteres)', savePass: 'Salvar senha',
      waText: 'Preciso de informações.', waLabel: 'Falar com a Endeavor pelo WhatsApp (abre em uma nova aba)', loginHelp: 'Primeiro acesso? Use o link do e-mail de convite para criar a sua senha.', forgotTitle: 'Redefinir senha', forgotLead: 'Digite o seu e-mail. Vamos enviar um link para você criar uma nova senha.', sendLink: 'Enviar link', backLogin: 'Voltar ao login', inviteTitle: 'Crie a sua senha', inviteLead: 'Bem-vindo ao portal da Endeavor. Crie a sua senha para continuar; em seguida você ativa o código do celular.', resetTitle: 'Crie uma nova senha', resetLead: 'Escolha uma nova senha para a sua conta.', confirmPass: 'Confirme a senha', passMismatch: 'As senhas não são iguais.', linkExpired: 'Este link expirou ou já foi usado. Digite o seu e-mail abaixo para receber um novo.', passSaved: 'Senha salva.', passRules: 'Pelo menos 8 caracteres. Misture letras maiúsculas e minúsculas, números e um símbolo.', showPass: 'Mostrar senha',
      badLogin: 'E-mail ou senha incorretos.', notConfirmed: 'Confirme o seu e-mail pelo link que enviamos e depois entre.', noInvite: 'Este e-mail não tem convite. Fale com a Endeavor pelo support@endeavorbiz.com.',
      passShort: 'Use pelo menos 8 caracteres no campo Senha.', created: 'Conta criada. Abra o e-mail de confirmação enviado para {e}, clique no link e depois entre aqui.',
      resetSent: 'Se {e} estiver cadastrado, você vai receber em alguns minutos um link para criar uma nova senha. Confira se o endereço está certo e olhe também o spam. Você pode pedir de novo em 60 segundos.', weakPass: 'Senha fraca. Use pelo menos 8 caracteres, com letras maiúsculas e minúsculas, números e um símbolo.', samePass: 'A nova senha precisa ser diferente da atual.', passMfa: 'Sua conta usa verificação em duas etapas. Digite o código de 6 dígitos que aparece no Google Authenticator em "Endeavor Business Hub".', passMfaNeed: 'Digite o código do autenticador para confirmar a nova senha.', mfaTitle: 'Verificação em duas etapas', mfaLead: 'Digite o código de 6 dígitos do seu aplicativo autenticador.',
      code: 'Código', verify: 'Verificar', badCode: 'Código inválido. Confira o horário do celular e tente de novo.', enrollTitle: 'Ative a verificação em duas etapas',
      enrollLead: 'Obrigatória para proteger seus documentos fiscais e da empresa. Escaneie o QR code com Google Authenticator, Microsoft Authenticator ou 1Password e digite o código.',
      noCamera: 'Sem câmera? Digite esta chave no app:', activate: 'Ativar e continuar', noAccess: 'Sem acesso ativo', noAccessText: 'Sua conta não está ligada a um portal de cliente ativo. Se você recebeu um convite, confira se usou o mesmo e-mail. Dúvidas: support@endeavorbiz.com.',
      nav_attorneys: 'Advogados', nav_projects: 'AI Projects', nav_overview: 'Visão geral', nav_companies: 'Minhas empresas', nav_documents: 'Documentos', nav_compliance: 'Prazos fiscais', nav_reports: 'Relatórios financeiros', nav_upload: 'Enviar documentos', nav_collab: 'Colaboradores', nav_settings: 'Configurações',
      account: 'Conta', hello: 'Olá, {n}', overviewLead: 'Tudo sobre as suas empresas nos EUA em um só lugar.',
      k_companies: 'Empresas', k_next: 'Próximo prazo', k_docs: 'Documentos', k_reports: 'Relatórios financeiros', none: 'Nenhum',
      nextDeadlines: 'Próximos prazos', recentDocs: 'Documentos recentes', seeAll: 'Ver todos', quick: 'Ações rápidas', qUpload: 'Enviar documentos para o imposto', qInvite: 'Convidar seu contador ou bookkeeper', qQbo: 'Conectar QuickBooks',
      noCompanies: 'Nenhuma empresa ainda', noCompaniesText: 'A Endeavor vai adicionar suas empresas aqui.', formed: 'Constituída em {d}', docNumber: 'Nº do documento na Flórida', ein: 'EIN', agent: 'Registered agent', fye: 'Fim do ano fiscal', address: 'Endereço',
      st_active: 'Ativa', st_in_formation: 'Em formação', st_inactive: 'Inativa', st_dissolved: 'Dissolvida',
      tab_timeline: 'Linha do tempo', tab_docs: 'Documentos', tab_deadlines: 'Prazos', tab_finance: 'Relatórios', back: 'Minhas empresas',
      cat_formation: 'Formação', cat_onboarding: 'Documentos de abertura', cat_tax_return: 'Declaração de imposto', cat_report: 'Relatório financeiro', cat_uploaded: 'Enviado', cat_compliance: 'Compliance', cat_other: 'Outro',
      allCompanies: 'Todas as empresas', allCategories: 'Todas as categorias', search: 'Buscar…', view: 'Ver', download: 'Baixar', print: 'Imprimir', close: 'Fechar',
      noDocs: 'Nenhum documento ainda', noPreview: 'Pré-visualização indisponível para este tipo de arquivo. Use Baixar.', viewErr: 'Não foi possível abrir o arquivo.',
      overdue: 'Vencido há {n} d', dueIn: 'Em {n} d', dueToday: 'Vence hoje', done: 'Concluído', na: 'Não se aplica', inProgress: 'Em andamento',
      complianceLead: 'Datas de entrega federais e estaduais das suas empresas. A Endeavor atualiza este calendário; confirme os detalhes com o seu contador.', overBy: 'há {n} d', st_pending: 'Pendente', st_overdue: 'Vencido', st_done: 'Concluído', doneOn: 'Concluído em {d}', onTime: 'no prazo', late: 'após o vencimento', v_list: 'Lista', v_cal: 'Calendário', sum_done: 'Concluídos', sum_pend: 'Pendentes', sum_over: 'Vencidos', dl_year: 'Ano', noDeadlinesYear: 'Nenhum prazo neste ano.', dl_pickDay: 'Clique num dia marcado para ver os prazos.', dl_none_day: 'Nenhum prazo neste dia.', newDocs: '{n} documentos novos', isNew: 'Novo', showDone: 'Mostrar concluídos', addCal: 'Adicionar ao meu calendário (.ics)', noDeadlines: 'Nenhum prazo pendente',
      dl_annual_report: 'Annual report', dl_federal_tax: 'Imposto federal', dl_state_tax: 'Imposto estadual', dl_payroll: 'Folha', dl_sales_tax: 'Sales tax', dl_boi: 'BOI', dl_license: 'Licença', dl_other: 'Outro',
      reportsLead: 'Demonstração de resultados (P&L), balanço patrimonial e fluxo de caixa preparados pela Endeavor a partir da contabilidade da sua empresa, prontos para ver, imprimir ou salvar em PDF.', repPreparing: 'A Endeavor está preparando seus relatórios. Eles aparecem aqui assim que forem publicados.', repNone: 'Os relatórios aparecem aqui quando a Endeavor cuida da contabilidade da sua empresa.', repBy: 'Preparado pela Endeavor',
      qboOn: 'QuickBooks conectado', qboOff: 'QuickBooks não conectado', connect: 'Conectar QuickBooks', disconnect: 'Desconectar', generate: 'Gerar relatórios', year: 'Ano', period: 'Período',
      q1: '1º trimestre', q2: '2º trimestre', q3: '3º trimestre', q4: '4º trimestre', fy: 'Ano completo', generating: 'Gerando relatórios no QuickBooks…', noReports: 'Nenhum relatório ainda.', ownerConnects: 'Somente o titular da conta pode conectar o QuickBooks.',
      qbo_not_configured: 'A integração com o QuickBooks está sendo configurada pela Endeavor. Tente mais tarde.', qbo_reconnect_required: 'A conexão com o QuickBooks expirou. Conecte novamente.',
      qbo_not_connected: 'QuickBooks não conectado.', future_period: 'Esse período ainda não começou.', forbidden: 'Você não tem permissão para esta ação.',
      qboConnected: 'QuickBooks conectado com sucesso.', qboCancelled: 'A conexão com o QuickBooks foi cancelada.', qboError: 'Não foi possível conectar o QuickBooks. Tente de novo.', confirmDisconnect: 'Desconectar o QuickBooks desta empresa?',
      uploadLead: 'Envie recibos, extratos, 1099 e outros documentos para a declaração de imposto. Não envie senhas.', company: 'Empresa', docTitle: 'Descrição', yearOpt: 'Ano fiscal (opcional)',
      chooseFiles: 'Escolha os arquivos ou arraste aqui', fileHint: 'PDF, imagens, planilhas ou Word · até 25 MB cada', send: 'Enviar', sending: 'Enviando {i} de {n}…', sent: 'Documentos enviados. A Endeavor foi avisada.',
      pickFile: 'Escolha pelo menos um arquivo.', tooBig: '{f} tem mais de 25 MB.', myUploads: 'Documentos que enviei', uploadedBy: 'por {e}',
      collabLead: 'Dê acesso limitado ao seu contador, bookkeeper ou administrador de imóveis. Eles entram com e-mail e senha próprios.', invite: 'Convidar colaborador', name: 'Nome',
      c_accountant: 'Contador (CPA)', c_bookkeeping: 'Bookkeeping', c_property_management: 'Property management', c_other: 'Outro', type: 'Tipo',
      canView: 'Pode ver documentos e relatórios da empresa', canUpload: 'Pode enviar documentos', perms: 'Permissões', status: 'Status', s_invited: 'Convidado', s_active: 'Ativo', s_revoked: 'Revogado',
      revoke: 'Revogar', resend: 'Reenviar convite', confirmRevoke: 'Revogar o acesso de {e}?', inviteSent: 'Convite enviado para {e}.', inviteDup: 'Este e-mail já tem acesso.', fillNameEmail: 'Informe nome e um e-mail válido.',
      noCollab: 'Nenhum colaborador ainda', owner: 'Titular da conta', viewOnly: 'Ver', uploadOnly: 'Enviar',
      settingsLead: 'Seu login e segurança.', mfaOn: 'Verificação em duas etapas ativa', changePass: 'Alterar senha', passChanged: 'Senha alterada.', lastLogin: 'Último acesso',
      switchClient: 'Conta', privacyNote: 'O acesso a cada arquivo é registrado para a sua segurança.', generic: 'Algo deu errado. Tente de novo.'
    },
    es: {
      p_portal: 'Portal de Socios', p_loginTitle: 'Portal de socios', p_loginLead: 'Para socios de referidos y para contadores, bookkeepers y administradores de propiedades invitados por clientes de Endeavor.',
      p_overviewLead: 'Documentos y plazos que {c} compartió con usted.', p_clients: 'Cliente', p_noAccess: 'Sin acceso de socio', p_noAccessText: 'Esta cuenta no está vinculada al programa de socios ni a ningún cliente. Si fue invitado, confirme que usó el mismo correo. Dudas: support@endeavorbiz.com.',
      useClientPortal: 'Esta es una cuenta de cliente. Abra el Portal del Cliente.', usePartnerPortal: 'Esta cuenta solo tiene acceso de socio. Abra el Portal de Socios.', openClient: 'Abrir Portal del Cliente', openPartner: 'Abrir Portal de Socios',
      access: 'Acceso', permCompanies: 'Empresas', permAll: 'Todas las empresas (incluso nuevas)', permDocs: 'Documentos que puede ver', permOther: 'Otros permisos',
      permDeadlines: 'Puede ver los plazos fiscales', permUpload: 'Puede enviar documentos', permDocsHint: 'Siempre ve los documentos que él mismo envió.', editPerms: 'Permisos', savePerms: 'Guardar permisos', permsSaved: 'Permisos actualizados.',
      full: 'Acceso completo', docsShort: 'Docs', noDocs: 'Sin documentos', deadlinesShort: 'Plazos', uploadShort: 'Envío', noCompanies: 'Ninguna empresa', myAccess: 'Mi acceso', sharedBy: 'Compartido por', yourRole: 'Su perfil',
      ck_title: 'Pago de la factura', ck_summary: 'Resumen del pedido', ck_total: 'Total a pagar', ck_method: 'Forma de pago', ck_pay: 'Pagar {a}', ck_secure: 'Pago procesado con seguridad por Stripe. Endeavor no ve ni guarda los datos de su tarjeta o cuenta.', ck_pdf: 'Descargar factura (PDF)', ck_hosted: 'Prefiero pagar en la página de Stripe', ck_back: 'Volver a Facturación', ck_ok: 'Pago recibido. ¡Gracias!', ck_okText: 'El recibo fue enviado por correo y la factura ya figura como pagada.', ck_processing: 'Pago en proceso. La transferencia bancaria y Pix pueden tardar un momento en confirmarse; la factura se actualiza sola.', ck_err: 'No se pudo completar el pago', ck_notReady: 'El pago en línea aún se está configurando. Use el enlace de Stripe enviado por correo o escriba a support@endeavorbiz.com.', ck_paidAlready: 'Esta factura ya está pagada.', ck_methods: 'Tarjeta, Pix, transferencia bancaria en EE. UU. (ACH), Apple Pay, Google Pay y otras formas habilitadas por Endeavor.', ck_qty: 'Cant.', ck_due: 'Vencimiento', ck_loading: 'Preparando el pago seguro…', invDetails: 'Pagar ahora', ck_billTo: 'Facturado a', ck_from: 'Emitido por',
      inv_openTitle: 'Por pagar', inv_history: 'Historial de pagos', inv_historyLead: 'Facturas pagadas, con una copia de cada factura guardada en su portal.', inv_receipt: 'Factura pagada (PDF)', inv_paidOn: 'Pagada el {d}', inv_banner: 'Tiene {n} factura(s) abierta(s), total de {a}.', inv_bannerBtn: 'Ver y pagar', inv_noOpen: 'Nada por pagar en este momento.', pay_mailSubject: 'Pago recibido', pay_mail: 'Hola {n},\n\nRecibimos su pago de {a} de la factura {i}. ¡Gracias!\nLa copia de la factura pagada está en el portal del cliente, en Facturación > Historial de pagos: {l}\n\nEndeavor Business Hub\nsupport@endeavorbiz.com',
      inv_badge: '{n} factura(s) abierta(s) por pagar', nav_invoices: 'Facturación', invLead: 'Facturas de Endeavor. Pague con seguridad con tarjeta o transferencia bancaria vía Stripe.', invNone: 'Aún no hay facturas.', invNo: 'Factura', invDate: 'Emisión', invDue: 'Vencimiento', invTotal: 'Total', invStatus: 'Estado', invPay: 'Pagar ahora', invPdf: 'PDF', inv_open: 'Esperando pago', inv_paid: 'Pagada', inv_uncollectible: 'Vencida', invOpenTotal: 'Saldo abierto', invPaidTotal: 'Pagado este año', p_partnerLead: 'Socio de referidos',
      enrollS1: 'Instale en su celular la app gratuita <strong>Google Authenticator</strong> (<a href="{ios}" target="_blank" rel="noopener">iPhone</a> · <a href="{and}" target="_blank" rel="noopener">Android</a>). El ícono es un asterisco de colores.', enrollS2: 'En la app, toque <strong>+</strong> y elija <strong>Escanear un código QR</strong>. Apunte la cámara al código de abajo.', enrollS3: 'Escriba el código de 6 dígitos que muestra la app (cambia cada 30 segundos) y haga clic en <strong>Activar y continuar</strong>.', mfaHint: 'Abra Google Authenticator y use el código que aparece en <strong>Endeavor Business Hub</strong>. ¿Perdió su celular? Escriba a support@endeavorbiz.com y Endeavor restablecerá su verificación.',
      loading: 'Cargando…', signOut: 'Salir', menu: 'Menú', closeMenu: 'Cerrar menú',
      portal: 'Portal del Cliente', loginTitle: 'Portal del cliente', loginLead: 'Acceda a sus empresas, documentos y plazos.', email: 'Correo', password: 'Contraseña',
      signIn: 'Ingresar', firstAccess: 'Primer acceso: crear contraseña', forgot: 'Olvidé mi contraseña', newPass: 'Nueva contraseña (mín. 8 caracteres)', savePass: 'Guardar contraseña',
      waText: 'Necesito información.', waLabel: 'Hablar con Endeavor por WhatsApp (se abre en una nueva pestaña)', loginHelp: '¿Primer acceso? Use el enlace del correo de invitación para crear su contraseña.', forgotTitle: 'Restablecer contraseña', forgotLead: 'Ingrese su correo. Le enviaremos un enlace para crear una nueva contraseña.', sendLink: 'Enviar enlace', backLogin: 'Volver al ingreso', inviteTitle: 'Cree su contraseña', inviteLead: 'Bienvenido al portal de Endeavor. Cree su contraseña para continuar; luego activará el código del celular.', resetTitle: 'Cree una nueva contraseña', resetLead: 'Elija una nueva contraseña para su cuenta.', confirmPass: 'Confirme la contraseña', passMismatch: 'Las contraseñas no coinciden.', linkExpired: 'Este enlace venció o ya fue usado. Ingrese su correo abajo para recibir uno nuevo.', passSaved: 'Contraseña guardada.', passRules: 'Al menos 8 caracteres. Combine mayúsculas y minúsculas, números y un símbolo.', showPass: 'Mostrar contraseña',
      badLogin: 'Correo o contraseña incorrectos.', notConfirmed: 'Confirme su correo con el enlace que enviamos y luego ingrese.', noInvite: 'Este correo no tiene invitación. Contacte a Endeavor en support@endeavorbiz.com.',
      passShort: 'Use al menos 8 caracteres en el campo Contraseña.', created: 'Cuenta creada. Abra el correo de confirmación enviado a {e}, haga clic en el enlace y luego ingrese aquí.',
      resetSent: 'Si {e} está registrado, recibirá en unos minutos un enlace para crear una nueva contraseña. Revise que la dirección esté bien escrita y la carpeta de spam. Puede pedirlo de nuevo en 60 segundos.', weakPass: 'Contraseña débil. Use al menos 8 caracteres, con mayúsculas y minúsculas, números y un símbolo.', samePass: 'La nueva contraseña debe ser diferente de la actual.', passMfa: 'Su cuenta usa verificación en dos pasos. Escriba el código de 6 dígitos que aparece en Google Authenticator en "Endeavor Business Hub".', passMfaNeed: 'Escriba el código del autenticador para confirmar la nueva contraseña.', mfaTitle: 'Verificación en dos pasos', mfaLead: 'Ingrese el código de 6 dígitos de su app autenticadora.',
      code: 'Código', verify: 'Verificar', badCode: 'Código inválido. Revise la hora del celular e intente de nuevo.', enrollTitle: 'Active la verificación en dos pasos',
      enrollLead: 'Obligatoria para proteger sus documentos fiscales y de la empresa. Escanee el código QR con Google Authenticator, Microsoft Authenticator o 1Password e ingrese el código.',
      noCamera: '¿Sin cámara? Ingrese esta clave en la app:', activate: 'Activar y continuar', noAccess: 'Sin acceso activo', noAccessText: 'Su cuenta no está vinculada a un portal de cliente activo. Si recibió una invitación, confirme que usó el mismo correo. Dudas: support@endeavorbiz.com.',
      nav_attorneys: 'Abogados', nav_projects: 'AI Projects', nav_overview: 'Resumen', nav_companies: 'Mis empresas', nav_documents: 'Documentos', nav_compliance: 'Plazos fiscales', nav_reports: 'Reportes financieros', nav_upload: 'Enviar documentos', nav_collab: 'Colaboradores', nav_settings: 'Configuración',
      account: 'Cuenta', hello: 'Hola, {n}', overviewLead: 'Todo sobre sus empresas en EE. UU. en un solo lugar.',
      k_companies: 'Empresas', k_next: 'Próximo plazo', k_docs: 'Documentos', k_reports: 'Reportes financieros', none: 'Ninguno',
      nextDeadlines: 'Próximos plazos', recentDocs: 'Documentos recientes', seeAll: 'Ver todos', quick: 'Acciones rápidas', qUpload: 'Enviar documentos para el impuesto', qInvite: 'Invitar a su contador o bookkeeper', qQbo: 'Conectar QuickBooks',
      noCompanies: 'Aún no hay empresas', noCompaniesText: 'Endeavor agregará sus empresas aquí.', formed: 'Constituida el {d}', docNumber: 'N.º de documento en Florida', ein: 'EIN', agent: 'Registered agent', fye: 'Cierre del año fiscal', address: 'Dirección',
      st_active: 'Activa', st_in_formation: 'En constitución', st_inactive: 'Inactiva', st_dissolved: 'Disuelta',
      tab_timeline: 'Línea de tiempo', tab_docs: 'Documentos', tab_deadlines: 'Plazos', tab_finance: 'Reportes', back: 'Mis empresas',
      cat_formation: 'Constitución', cat_onboarding: 'Documentos de constitución', cat_tax_return: 'Declaración de impuestos', cat_report: 'Reporte financiero', cat_uploaded: 'Enviado', cat_compliance: 'Cumplimiento', cat_other: 'Otro',
      allCompanies: 'Todas las empresas', allCategories: 'Todas las categorías', search: 'Buscar…', view: 'Ver', download: 'Descargar', print: 'Imprimir', close: 'Cerrar',
      noDocs: 'Aún no hay documentos', noPreview: 'Vista previa no disponible para este tipo de archivo. Use Descargar.', viewErr: 'No se pudo abrir el archivo.',
      overdue: 'Vencido hace {n} d', dueIn: 'En {n} d', dueToday: 'Vence hoy', done: 'Completado', na: 'No aplica', inProgress: 'En curso',
      complianceLead: 'Fechas de presentación federales y estatales de sus empresas. Endeavor actualiza este calendario; confirme los detalles con su contador.', overBy: 'hace {n} d', st_pending: 'Pendiente', st_overdue: 'Vencido', st_done: 'Completado', doneOn: 'Completado el {d}', onTime: 'a tiempo', late: 'después del vencimiento', v_list: 'Lista', v_cal: 'Calendario', sum_done: 'Completados', sum_pend: 'Pendientes', sum_over: 'Vencidos', dl_year: 'Año', noDeadlinesYear: 'No hay plazos en este año.', dl_pickDay: 'Haga clic en un día marcado para ver sus plazos.', dl_none_day: 'No hay plazos este día.', newDocs: '{n} documentos nuevos', isNew: 'Nuevo', showDone: 'Mostrar completados', addCal: 'Agregar a mi calendario (.ics)', noDeadlines: 'No hay plazos pendientes',
      dl_annual_report: 'Annual report', dl_federal_tax: 'Impuesto federal', dl_state_tax: 'Impuesto estatal', dl_payroll: 'Nómina', dl_sales_tax: 'Sales tax', dl_boi: 'BOI', dl_license: 'Licencia', dl_other: 'Otro',
      reportsLead: 'Estado de resultados (P&L), balance general y flujo de caja preparados por Endeavor a partir de la contabilidad de su empresa, listos para ver, imprimir o guardar en PDF.', repPreparing: 'Endeavor está preparando sus reportes. Aparecen aquí en cuanto se publiquen.', repNone: 'Los reportes aparecen aquí cuando Endeavor lleva la contabilidad de su empresa.', repBy: 'Preparado por Endeavor',
      qboOn: 'QuickBooks conectado', qboOff: 'QuickBooks no conectado', connect: 'Conectar QuickBooks', disconnect: 'Desconectar', generate: 'Generar reportes', year: 'Año', period: 'Período',
      q1: '1.er trimestre', q2: '2.º trimestre', q3: '3.er trimestre', q4: '4.º trimestre', fy: 'Año completo', generating: 'Generando reportes en QuickBooks…', noReports: 'Aún no hay reportes.', ownerConnects: 'Solo el titular de la cuenta puede conectar QuickBooks.',
      qbo_not_configured: 'Endeavor está configurando la integración con QuickBooks. Intente más tarde.', qbo_reconnect_required: 'La conexión con QuickBooks venció. Conéctela de nuevo.',
      qbo_not_connected: 'QuickBooks no está conectado.', future_period: 'Ese período aún no comenzó.', forbidden: 'No tiene permiso para esta acción.',
      qboConnected: 'QuickBooks conectado correctamente.', qboCancelled: 'Se canceló la conexión con QuickBooks.', qboError: 'No se pudo conectar QuickBooks. Intente de nuevo.', confirmDisconnect: '¿Desconectar QuickBooks de esta empresa?',
      uploadLead: 'Envíe recibos, estados de cuenta, 1099 y otros documentos para su declaración. No envíe contraseñas.', company: 'Empresa', docTitle: 'Descripción', yearOpt: 'Año fiscal (opcional)',
      chooseFiles: 'Elija los archivos o arrástrelos aquí', fileHint: 'PDF, imágenes, hojas de cálculo o Word · hasta 25 MB cada uno', send: 'Enviar', sending: 'Enviando {i} de {n}…', sent: 'Documentos enviados. Endeavor fue notificada.',
      pickFile: 'Elija al menos un archivo.', tooBig: '{f} supera los 25 MB.', myUploads: 'Documentos que envié', uploadedBy: 'por {e}',
      collabLead: 'Dé acceso limitado a su contador, bookkeeper o administrador de propiedades. Ingresan con su propio correo y contraseña.', invite: 'Invitar colaborador', name: 'Nombre',
      c_accountant: 'Contador (CPA)', c_bookkeeping: 'Bookkeeping', c_property_management: 'Property management', c_other: 'Otro', type: 'Tipo',
      canView: 'Puede ver documentos y reportes de la empresa', canUpload: 'Puede enviar documentos', perms: 'Permisos', status: 'Estado', s_invited: 'Invitado', s_active: 'Activo', s_revoked: 'Revocado',
      revoke: 'Revocar', resend: 'Reenviar invitación', confirmRevoke: '¿Revocar el acceso de {e}?', inviteSent: 'Invitación enviada a {e}.', inviteDup: 'Este correo ya tiene acceso.', fillNameEmail: 'Ingrese un nombre y un correo válido.',
      noCollab: 'Aún no hay colaboradores', owner: 'Titular de la cuenta', viewOnly: 'Ver', uploadOnly: 'Enviar',
      settingsLead: 'Su acceso y seguridad.', mfaOn: 'Verificación en dos pasos activa', changePass: 'Cambiar contraseña', passChanged: 'Contraseña cambiada.', lastLogin: 'Último acceso',
      switchClient: 'Cuenta', privacyNote: 'El acceso a cada archivo queda registrado para su seguridad.', generic: 'Algo salió mal. Intente de nuevo.'
    }
  };
  var L = EP.lang;
  EP.init({ en: {}, pt: {}, es: {} });
  var PARTNER = window.PORTAL_MODE === 'partner';
  var PK = { portal: 'p_portal', loginTitle: 'p_loginTitle', loginLead: 'p_loginLead', noAccess: 'p_noAccess', noAccessText: 'p_noAccessText' };
  function t(k, vars) {
    if (PARTNER && PK[k]) k = PK[k]; var s = (D[L] && D[L][k] != null) ? D[L][k] : (D.en[k] != null ? D.en[k] : k); if (vars) Object.keys(vars).forEach(function (v) { s = s.replace('{' + v + '}', vars[v]); }); return s; }
  document.getElementById('btn-signout').textContent = t('signOut');
  document.title = t('portal') + ' | Endeavor Business Hub';

  /* ---------------- helpers ---------------- */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function msg(el, text, kind) { if (!el) return; el.className = 'portal-alert portal-alert--' + (kind || 'info'); el.textContent = text || ''; }
  function errText(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/Invalid login credentials/i.test(m)) return t('badLogin');
    if (/Email not confirmed/i.test(m)) return t('notConfirmed');
    if (/Invalid TOTP|invalid.*code/i.test(m)) return t('badCode');
    if (/Password should|weak.?password|pwned|leaked/i.test(m)) return t('weakPass');
    if (/same.?password|different from the old/i.test(m)) return t('samePass');
    if (D.en[m]) return t(m);
    return m || t('generic');
  }
  async function q(p) { var r = await p; if (r.error) throw r.error; return r.data; }
  function fmtDate(d) { if (!d) return ''; return new Intl.DateTimeFormat(EP.locale, { dateStyle: 'medium' }).format(new Date(d.length === 10 ? d + 'T12:00:00' : d)); }
  function fmtDT(d) { return d ? new Intl.DateTimeFormat(EP.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : ''; }
  function daysUntil(d) { var n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((new Date(d + 'T00:00:00') - n) / 864e5); }
  function siteUrl(file) { try { if (/^(https?|file):/.test(location.protocol)) return new URL(file, location.href).href.split('#')[0]; } catch (e) { /* ignore */ } return 'https://endeavorbiz.com/' + file; }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function slug(s) { return String(s).normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(0, 80); }
  async function sha256Hex(buf) { var d = await crypto.subtle.digest('SHA-256', buf); return Array.prototype.map.call(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function fileIcon(p) { return ((p.match(/\.([a-z0-9]+)$/i) || ['', 'doc'])[1]).toUpperCase().slice(0, 4); }
  function pill(it) {
    if (it.status === 'done') {
      var dd = it.completed_at ? it.completed_at.slice(0, 10) : '', ok = !dd || dd <= it.due_date;
      return '<span class="pill pill--done dl-st"><svg class="icon" aria-hidden="true" viewBox="0 0 16 16" style="width:.85em;height:.85em"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg> ' +
        (dd ? t('doneOn', { d: fmtDate(dd + 'T12:00:00') }) + (ok ? ' · ' + t('onTime') : '') : t('st_done')) + '</span>';
    }
    if (it.status === 'not_applicable') return '<span class="pill">' + t('na') + '</span>';
    var n = daysUntil(it.due_date);
    if (n < 0) return '<span class="pill pill--overdue dl-st">' + t('st_overdue') + ' · ' + t('overBy', { n: -n }) + '</span>';
    if (n === 0) return '<span class="pill pill--overdue dl-st">' + t('st_pending') + ' · ' + t('dueToday') + '</span>';
    return '<span class="pill dl-st' + (n <= 30 ? ' pill--soon' : '') + '">' + t('st_pending') + ' · ' + t('dueIn', { n: n }) + '</span>';
  }
  function dlState(it) { return it.status === 'done' ? 'done' : it.status === 'not_applicable' ? 'na' : daysUntil(it.due_date) < 0 ? 'over' : 'pend'; }
  function deadlineRow(it, co) {
    var p = it.due_date.split('-'), mon = new Intl.DateTimeFormat(EP.locale, { month: 'short' }).format(new Date(+p[0], +p[1] - 1, 15)).replace('.', '');
    return '<div class="deadline"><div class="deadline__date"><b>' + p[2] + '</b><span>' + esc(mon) + ' ' + p[0] + '</span></div>' +
      '<div><strong>' + esc(it.title) + '</strong><div class="portal-muted" style="font-size:.85rem">' + esc(co ? co.legal_name : '') + ' · ' + esc(t('dl_' + it.category)) + (it.notes ? ' · ' + esc(it.notes) : '') + (it.source_url && /^https:\/\//.test(it.source_url) ? ' · <a class="dl-fonte" href="' + esc(it.source_url) + '" target="_blank" rel="noopener noreferrer">' + dx('fonte') + '</a>' : '') + '</div></div>' + pill(it) + '</div>';
  }

  /* ---------------- auth ---------------- */
  var S = { memberships: [], client: null, role: null, perms: {}, companies: [], user: null };
  var PAGE = PARTNER ? 'partner.html' : 'client.html';
  var recovery = AUTH_TYPE === 'invite' || AUTH_TYPE === 'recovery';
  var pwShown = false;
  sb.auth.onAuthStateChange(function (ev) {
    if (pwShown) return;
    if (ev === 'PASSWORD_RECOVERY' || (recovery && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION'))) { recovery = true; pwShown = true; renderNewPassword(AUTH_TYPE === 'invite' ? 'invite' : 'reset'); }
  });
  if (recovery) setTimeout(async function () { if (pwShown) return; var s = (await sb.auth.getSession()).data.session; pwShown = true; if (!s) { recovery = false; renderForgot(true); } else renderNewPassword(AUTH_TYPE === 'invite' ? 'invite' : 'reset'); }, 2500);
  $('#btn-signout').onclick = async function () { await sb.auth.signOut(); ERoute.set('', true); location.reload(); };

  function authShell(html) {
    document.body.classList.remove('app-shell'); $('#topbar-user').hidden = true; $('#nav-toggle').hidden = true;
    app.innerHTML = '<main class="portal-main portal-main--auth"><div class="auth portal-card">' + html + '</div></main>';
  }
  async function boot() {
    if (recovery) return;
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return renderLogin();
    S.user = s.user;
    $('#topbar-user').hidden = false; $('#topbar-email').textContent = s.user.email;
    var aal = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    S.aal1 = false;
    if (!aal || aal.currentLevel !== 'aal2') {
      // referral partners may sign in with password only (2-step verification is optional for them); client collaborators always need it
      var skip = false;
      if (PARTNER && window.EPartnerRef && aal && aal.nextLevel !== 'aal2') { var pol = await sb.rpc('portal_mfa_policy'); skip = !pol.error && !!(pol.data && pol.data.optional); }
      if (!skip) return renderMfa();
      S.aal1 = true;
    }
    var mem = await sb.rpc('claim_invitations');
    var allMem = mem.data || [];
    if (S.aal1 && allMem.some(function (x) { return x.role === 'collaborator'; })) return renderMfa();
    S.memberships = allMem.filter(function (x) { return PARTNER ? x.role === 'collaborator' : x.role === 'owner'; });
    if (PARTNER && window.EPartnerRef) { var pr = await sb.rpc('claim_partner'); S.partner = (pr.data || [])[0] || null; if (S.partner) { var se = await sb.rpc('partner_sync_email'); if (!se.error && se.data && se.data[0]) S.partner = se.data[0]; } }
    if (S.partner) { S.ref = EPartnerRef.init(refCtx()); if (!S.memberships.length) { S.client = null; S.perms = {}; S.companies = []; S.me = {}; startShell(); return; } }
    if (!S.memberships.length && allMem.length) {
      var other = PARTNER ? 'client.html' : 'partner.html';
      return authShell('<h1 class="portal-h1">' + t('noAccess') + '</h1><p>' + t(PARTNER ? 'useClientPortal' : 'usePartnerPortal') + '</p><a class="btn btn--navy" href="' + other + '?lang=' + L + '">' + t(PARTNER ? 'openClient' : 'openPartner') + '</a>');
    }
    if (!S.memberships.length) return authShell('<h1 class="portal-h1">' + t('noAccess') + '</h1><p>' + t('noAccessText') + '</p><button class="btn btn--navy" id="na-out" type="button">' + t('signOut') + '</button>'), ($('#na-out').onclick = function () { $('#btn-signout').click(); });
    var saved = null; try { saved = localStorage.getItem('endeavor-client-id'); } catch (e) { /* ignore */ }
    var m = S.memberships.find(function (x) { return x.client_id === saved; }) || S.memberships[0];
    await selectClient(m.client_id);
    await checkOpenInvoices(); await checkNewDocs();
    if (S.openInv.n && !S.landed) { var hh = ERoute.get(); if (!hh || hh === '#' || hh === '#/' || /^#\/overview/.test(hh)) ERoute.set('#/invoices', true); }
    S.landed = true;
    // veio do app Endeavor Phone (phone.html) para entrar: volta para o telefone
    if (/[?&]next=phone(&|$)/.test(location.search) && S.telOn && !PARTNER) { location.replace('phone.html'); return; }
    startShell();
  }
  function refCtx() {
    return { sb: sb, CFG: CFG, L: L, locale: EP.locale, t: t, esc: esc, $: $, $$: $$, msg: msg, q: q, errText: errText, fmtDate: fmtDate, fmtDT: fmtDT,
      head: function (a, b, c) { return head(a, b, c); }, kpi: function (a, b, c) { return kpi(a, b, c); }, openOverlay: function (h, c) { return openOverlay(h, c); }, closeOverlay: function () { closeOverlay(); },
      param: function (k) { return param(k); }, siteUrl: siteUrl, route: function () { route(); }, S: S, sha256Hex: sha256Hex, viewDoc: function (d) { return viewDoc(d); },
      reload: async function () { await selectClient(S.client.id); await checkOpenInvoices(); startShell(); } };
  }
  // red counter next to "Invoices" (and a dot on the mobile menu button) while there are invoices to pay
  function updateInvBadge() {
    var n = (S.openInv && S.openInv.n) || 0, b = document.getElementById('inv-badge'), tg = document.getElementById('nav-toggle');
    if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); b.setAttribute('aria-label', t('inv_badge', { n: n })); b.title = t('inv_badge', { n: n }); }
    if (tg) tg.classList.toggle('has-alert', !!n);
  }
  // documents the user has not opened yet (blue counter next to "Documents")
  async function checkNewDocs() {
    S.docSeen = {}; S.docNew = 0; S.docReq = 0;
    if (S.client && S.perms.upload) { var pr = await sb.from('portal_doc_requests').select('id').eq('client_id', S.client.id).eq('status', 'pending'); S.docReq = (pr.data || []).length; }
    if (!S.client || !S.perms.view) return;
    var r = await Promise.all([sb.rpc('my_doc_views', { p_client: S.client.id }), sb.from('company_documents').select('id, uploaded_by').eq('client_id', S.client.id)]);
    (r[0].data || []).forEach(function (x) { S.docSeen[x.document_id || x] = 1; });
    (r[1].data || []).forEach(function (d) { if (!S.docSeen[d.id] && d.uploaded_by !== S.user.id) S.docNew++; });
  }
  function isNewDoc(d) { return S.docSeen && !S.docSeen[d.id] && d.uploaded_by !== (S.user && S.user.id); }
  function updateDocBadge() {
    // documentos pedidos pela equipe têm prioridade no contador; sem pedidos, ele mostra os documentos novos
    var pend = S.docReq || 0, n = pend || S.docNew || 0, b = document.getElementById('doc-badge'), dica = pend ? dx('pedidos') + ': ' + pend : t('newDocs', { n: n });
    if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); b.setAttribute('aria-label', dica); b.title = dica; }
  }
  async function checkOpenInvoices() {
    S.openInv = { n: 0, cents: 0 };
    if (!S.perms.owner) return;
    var r = await sb.from('invoices').select('total_cents, amount_paid_cents, status').eq('client_id', S.client.id).in('status', ['open', 'uncollectible']);
    (r.data || []).forEach(function (i) { S.openInv.n++; S.openInv.cents += i.total_cents - i.amount_paid_cents; });
  }
  async function selectClient(id) {
    S.client = (await q(sb.from('clients').select('*').eq('id', id).single()));
    var me = (await q(sb.from('client_users').select('*').eq('client_id', id).eq('user_id', S.user.id).eq('status', 'active')))[0] || {};
    // o e-mail de login foi trocado (confirmado pelo link): o cadastro acompanha
    if (me.email && S.user.email && String(me.email).toLowerCase() !== String(S.user.email).toLowerCase()) {
      var sy = await sb.rpc('client_email_sync');
      if (!sy.error) { me.email = S.user.email; S.client = (await q(sb.from('clients').select('*').eq('id', id).single())); }
    }
    S.role = me.role; S.me = me;
    var own = me.role === 'owner', cats = own ? ['formation', 'onboarding', 'tax_return', 'report', 'compliance', 'other'] : (me.perm_doc_categories || []);
    S.perms = { owner: own, cats: cats, view: own || cats.length > 0, reports: own || cats.indexOf('report') > -1,
      deadlines: own || me.perm_deadlines !== false, upload: own || !!me.can_upload };
    S.companies = await q(sb.from('companies').select('*').eq('client_id', id).order('legal_name'));
    // services bought online (CRM, Agenda, E-signature, Bookkeeping...): unlock the tools in the menu
    var sv = await sb.from('client_services').select('product_code, status, included_in').eq('client_id', id).in('status', ['active', 'past_due']);
    S.services = (sv.data || []).map(function (x) { return x.product_code; });
    var bks = (sv.data || []).filter(function (x) { return x.product_code === 'bookkeeping'; });
    S.books = bks.some(function (x) { return !x.included_in; }) ? 'avulso' : (bks.length || S.companies.some(function (c) { return c.books_provider === 'endeavor' || c.books_provider === 'quickbooks'; })) ? 'pacote' : null;
    S.kind = S.client.portal_kind === 'tools' ? 'tools' : 'full';
    // Web Meeting habilitado pela Endeavor na ficha do cliente
    var ma = await sb.from('meet_access').select('enabled').eq('client_id', id).maybeSingle();
    S.meetOn = !!(ma.data && ma.data.enabled);
    // WhatsApp Manager liberado pela Endeavor na ficha do cliente
    var wa = await sb.from('wa_access').select('enabled').eq('client_id', id).maybeSingle();
    S.waOn = !!(wa.data && wa.data.enabled);
    // LinkedIn Manager: liberado pela Endeavor em alguma empresa (a RLS só mostra para o dono)
    var liq = await sb.from('linkedin_accounts').select('company_id').eq('client_id', id).eq('enabled', true).limit(1);
    S.liOn = !!(liq.data && liq.data.length);
    // Telefonia liberada pela Endeavor em alguma empresa do cliente (RLS: só as que a pessoa pode ver)
    var tl = await sb.from('tel_access').select('company_id').eq('client_id', id).eq('enabled', true).limit(1);
    S.telOn = !!(tl.data && tl.data.length);
    try { localStorage.setItem('endeavor-client-id', id); } catch (e) { /* ignore */ }
  }

  function pwField(id, label, auto) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="pw-wrap"><input id="' + id + '" type="password" autocomplete="' + auto + '" required>' +
      '<button type="button" class="pw-eye" data-eye="' + id + '" aria-label="' + t('showPass') + '" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg></button></div></div>';
  }
  function wireEyes() { $$('[data-eye]').forEach(function (b) { b.onclick = function () { var i = document.getElementById(b.dataset.eye), on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.setAttribute('aria-pressed', String(on)); }; }); }
  function renderLogin() {
    // "Forgot my password" button of the access e-mail / checkout page
    if (/[?&]forgot=1/.test(location.search)) { history.replaceState(null, '', location.pathname + location.search.replace(/[?&]forgot=1/, '').replace(/^&/, '?')); return renderForgot(false); }
    if (AUTH_ERR) { var e0 = AUTH_ERR; AUTH_ERR = null; history.replaceState(null, '', location.pathname + location.search); return renderForgot(true, e0); }
    // login único: quem não está logado entra por login.html (os links de convite e de nova senha continuam abrindo aqui)
    if (/^https?:$/.test(location.protocol) && !window.ENDEAVOR_NO_LOGIN_REDIRECT) return location.replace('login.html?lang=' + L + '&out=client');
    authShell('<h1 class="portal-h1">' + t('loginTitle') + '</h1><p class="portal-muted">' + t('loginLead') + '</p>' +
      '<form class="portal-form" id="f-login" novalidate><div class="field"><label for="l-email">' + t('email') + '</label><input id="l-email" type="email" autocomplete="username" required></div>' +
      pwField('l-pass', t('password'), 'current-password') +
      '<div class="portal-alert" id="l-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('signIn') + '</button>' +
      '<p class="auth-links"><a href="#" id="l-forgot">' + t('forgot') + '</a></p><p class="portal-muted auth-help">' + t('loginHelp') + '</p></form>');
    wireEyes();
    var m = $('#l-msg');
    $('#f-login').onsubmit = async function (e) {
      e.preventDefault(); msg(m, t('loading'), 'info');
      var r = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
      if (r.error) return msg(m, errText(r.error), 'error');
      boot();
    };
    $('#l-forgot').onclick = function (e) { e.preventDefault(); renderForgot(false, null, $('#l-email').value.trim()); };
  }
  function renderForgot(expired, code, email) {
    authShell('<h1 class="portal-h1">' + t('forgotTitle') + '</h1><p class="portal-muted">' + t('forgotLead') + '</p>' +
      (expired ? '<div class="portal-alert portal-alert--error" style="display:block">' + t('linkExpired') + '</div>' : '') +
      '<form class="portal-form" id="f-forgot" novalidate><div class="field"><label for="fg-email">' + t('email') + '</label><input id="fg-email" type="email" autocomplete="username" required value="' + esc(email || '') + '"></div>' +
      '<div class="portal-alert" id="fg-msg" role="status"></div><button class="btn btn--navy btn--block" type="submit">' + t('sendLink') + '</button>' +
      '<p class="auth-links"><a href="#" id="fg-back">' + t('backLogin') + '</a></p></form>');
    $('#fg-back').onclick = function (e) { e.preventDefault(); renderLogin(); };
    $('#f-forgot').onsubmit = async function (e) {
      e.preventDefault();
      var em = $('#fg-email').value.trim().toLowerCase(), m = $('#fg-msg');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return msg(m, t('fillNameEmail'), 'error');
      var btn = this.querySelector('button'); if (btn.disabled) return; btn.disabled = true;
      // branded e-mail in the portal's language, sent by Endeavor; Supabase's own e-mail only if that call fails
      var r = { error: null };
      try {
        var fr = await fetch(CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify({ action: 'access_reset', email: em, page: PAGE, lang: L }) });
        if (!fr.ok) throw new Error('http');
      } catch (er) { r = await sb.auth.resetPasswordForEmail(em, { redirectTo: siteUrl(PAGE) + '?lang=' + L }); }
      var limited = r.error && /rate|limit|seconds/i.test(r.error.message);
      // same message whether or not the e-mail exists (no account enumeration); the address is echoed so typos are visible
      msg(m, limited ? errText(r.error) : t('resetSent').replace('{e}', em), limited ? 'error' : 'ok');
      setTimeout(function () { btn.disabled = false; }, limited ? 5000 : 60000);
    };
  }
  function renderNewPassword(mode) {
    authShell('<h1 class="portal-h1">' + t(mode === 'invite' ? 'inviteTitle' : 'resetTitle') + '</h1><p class="portal-muted">' + t(mode === 'invite' ? 'inviteLead' : 'resetLead') + '</p>' +
      '<form class="portal-form" id="f-np" novalidate>' + pwField('np', t('newPass'), 'new-password') + pwField('np2', t('confirmPass'), 'new-password') +
      '<p class="portal-muted" style="font-size:.85rem;margin:-.25rem 0 0">' + t('passRules') + '</p>' +
      '<div class="field" id="np-code-wrap" hidden><label for="np-code">' + t('code') + '</label><input id="np-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6">' +
      '<p class="portal-muted" style="font-size:.85rem;margin:.35rem 0 0">' + t('passMfa') + '</p></div>' +
      '<div class="portal-alert" id="np-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('savePass') + '</button></form>');
    wireEyes();
    var showCode = function () { $('#np-code-wrap').hidden = false; };
    // accounts with two-step verification must confirm the code (AAL2) before Supabase accepts a new password
    sb.auth.mfa.getAuthenticatorAssuranceLevel().then(function (r) { var a = r.data; if (a && a.nextLevel === 'aal2' && a.currentLevel !== 'aal2') showCode(); }, function () {});
    $('#f-np').onsubmit = async function (e) {
      e.preventDefault(); var p = $('#np').value, m = $('#np-msg');
      if (p.length < 8) return msg(m, t('passShort'), 'error');
      if (p !== $('#np2').value) return msg(m, t('passMismatch'), 'error');
      var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        if (!$('#np-code-wrap').hidden) {
          var code = $('#np-code').value.replace(/\D/g, '');
          if (code.length !== 6) { $('#np-code').focus(); return msg(m, t('passMfaNeed'), 'error'); }
          var f = ((await sb.auth.mfa.listFactors()).data || {}).totp || [], v = f.filter(function (x) { return x.status === 'verified'; })[0];
          if (v) { var cv = await sb.auth.mfa.challengeAndVerify({ factorId: v.id, code: code }); if (cv.error) return msg(m, errText(cv.error), 'error'); }
        }
        var r = await sb.auth.updateUser({ password: p });
        if (r.error) {
          if (/aal2/i.test(r.error.message)) { showCode(); $('#np-code').focus(); return msg(m, t('passMfaNeed'), 'error'); }
          return msg(m, errText(r.error), 'error');
        }
        msg(m, t('passSaved'), 'ok');
        recovery = false; history.replaceState(null, '', location.pathname + location.search); boot();
      } finally { btn.disabled = false; }
    };
  }
  async function renderMfa() {
    var f = (await sb.auth.mfa.listFactors()).data || { totp: [], all: [] };
    var ok = (f.totp || []).filter(function (x) { return x.status === 'verified'; });
    if (ok.length) {
      authShell('<h1 class="portal-h1">' + t('mfaTitle') + '</h1><p class="portal-muted">' + t('mfaLead') + '</p><p class="portal-muted" style="font-size:.88rem">' + t('mfaHint') + '</p><form class="portal-form" id="f-mfa"><div class="field"><label for="mfa-code">' + t('code') + '</label><input id="mfa-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
        '<div class="portal-alert" id="mfa-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('verify') + '</button></form>');
      $('#mfa-code').focus();
      $('#f-mfa').onsubmit = async function (e) { e.preventDefault(); var r = await sb.auth.mfa.challengeAndVerify({ factorId: ok[0].id, code: $('#mfa-code').value.trim() }); if (r.error) return msg($('#mfa-msg'), errText(r.error), 'error'); boot(); };
      return;
    }
    for (var i = 0; i < (f.all || []).length; i++) if (f.all[i].status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.all[i].id });
    var en = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'Endeavor Business Hub', friendlyName: 'Endeavor Portal ' + new Date().toISOString().slice(0, 10) });
    if (en.error) return authShell('<div class="portal-alert portal-alert--error">' + esc(errText(en.error)) + '</div>');
    authShell('<div class="enroll"><div class="enroll__info"><h1 class="portal-h1">' + t('enrollTitle') + '</h1><p class="portal-muted">' + t('enrollLead').split('. ')[0] + '.</p>' +
      '<ol class="mfa-steps"><li>' + t('enrollS1').replace('{ios}', EndeavorInvite.IOS).replace('{and}', EndeavorInvite.AND) + '</li><li>' + t('enrollS2') + '</li><li>' + t('enrollS3') + '</li></ol>' +
      '<p class="portal-muted enroll__key">' + t('noCamera') + ' <span class="mono">' + esc(en.data.totp.secret) + '</span></p></div>' +
      '<div class="enroll__act"><div class="auth__qr"><img alt="QR code" src="' + esc(en.data.totp.qr_code) + '"></div><form class="portal-form" id="f-en"><div class="field"><label for="en-code">' + t('code') + '</label><input id="en-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
      '<div class="portal-alert" id="en-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('activate') + '</button></form></div></div>');
    $('.auth').classList.add('auth--wide');
    $('#f-en').onsubmit = async function (e) { e.preventDefault(); var r = await sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: $('#en-code').value.trim() }); if (r.error) return msg($('#en-msg'), errText(r.error), 'error'); boot(); };
  }

  /* ---------------- shell ---------------- */
  function navItems() {
    var out = S.ref ? S.ref.nav.slice() : [];
    var setL = S.ref && S.ref.accLabel ? S.ref.accLabel : t('nav_settings');
    if (!S.client) return out.concat([['settings', setL, 'i-gear']]);
    if (S.ref) out.push(['-', S.ref.sep]);
    return out.concat(clientNav().map(function (x) { return [x[0], x[0] === 'settings' ? setL : x[3] ? x[1] : t(x[1]), x[2]]; }));
  }
  function clientNav() {
    // account created by an online purchase: only what was bought (bookkeeping brings the company, documents and reports)
    if (S.kind === 'tools' && !PARTNER) {
      var b = S.services.indexOf('bookkeeping') > -1, m = [['overview', 'nav_overview', 'i-grid']];
      if (b) m.push(['companies', 'nav_companies', 'i-brief'], ['documents', 'nav_documents', 'i-file']);
      if (S.books) m.push(['reports', 'nav_reports', 'i-chart']);
      if (S.perms.owner && window.ETools) ETools.nav().forEach(function (x) { m.push([x[0], x[1], x[2], 1]); });
      if (S.meetOn && window.EMeetPanel) m.push(['webmeeting', 'Web Meeting', 'i-video', 1]);
      if (S.meetOn && window.EWebinarPanel) m.push(['webinar', 'Live Webinar', 'i-live', 1]);
      if (S.waOn && window.EWaPanel) m.push(['whatsapp', 'WhatsApp Manager', 'i-wa', 1]);
      if (S.liOn && window.ELiPanel) m.push(['linkedin', 'LinkedIn Manager', 'i-linkedin', 1]);
      if (S.telOn && window.ETelPortal) m.push(['telefonia', 'Telefonia', 'i-phone', 1]);
      if (S.perms.owner) m.push(['invoices', 'nav_invoices', 'i-card'], ['collaborators', 'nav_collab', 'i-users']);
      m.push(['settings', 'nav_settings', 'i-gear']);
      return m;
    }
    var n = [['overview', 'nav_overview', 'i-grid'], ['companies', 'nav_companies', 'i-brief']];
    if (S.perms.view) n.push(['documents', 'nav_documents', 'i-file']);
    if (S.perms.deadlines) n.push(['compliance', 'nav_compliance', 'i-cal']);
    if (S.perms.reports && S.books) n.push(['reports', 'nav_reports', 'i-chart']);
    if (S.perms.owner) n.push(['invoices', 'nav_invoices', 'i-card'], ['collaborators', 'nav_collab', 'i-users']);
    if (window.EProjects && S.perms.owner && !PARTNER) n.push(['projetos', 'nav_projects', 'i-bot']);
    if (window.EAttorney) n.push(['advogados', 'nav_attorneys', 'i-law']);
    if (S.perms.owner && !PARTNER && window.ETools) ETools.nav().forEach(function (x) { n.push([x[0], x[1], x[2], 1]); });
    if (S.meetOn && !PARTNER && window.EMeetPanel) n.push(['webmeeting', 'Web Meeting', 'i-video', 1]);
    if (S.meetOn && !PARTNER && window.EWebinarPanel) n.push(['webinar', 'Live Webinar', 'i-live', 1]);
    if (S.waOn && !PARTNER && window.EWaPanel) n.push(['whatsapp', 'WhatsApp Manager', 'i-wa', 1]);
    if (S.liOn && !PARTNER && window.ELiPanel) n.push(['linkedin', 'LinkedIn Manager', 'i-linkedin', 1]);
    if (S.telOn && !PARTNER && window.ETelPortal) n.push(['telefonia', 'Telefonia', 'i-phone', 1]);
    n.push(['settings', 'nav_settings', 'i-gear']);
    return n;
  }
  function startShell() {
    document.body.classList.add('app-shell');
    if (window.ETools && S.client) ETools.init(refCtx());
    if (window.EClientOA && S.client) {
      EClientOA.init(refCtx());
      if (!S.accessLogged) { S.accessLogged = true; sb.rpc('audit_event', { p_action: 'portal.access', p_entity_type: 'portal', p_entity_id: PARTNER ? 'partner' : 'client', p_company: null, p_details: { client_id: S.client.id } }).then(function () {}, function () {}); }
    }
    var multi = S.memberships.length > 1;
    var clientBox = !S.client ? '' : multi ? '<div style="padding:0 .5rem .75rem"><label for="cl-switch" class="sr-only">' + t('switchClient') + '</label><select id="cl-switch" style="width:100%;min-height:2.4rem;border-radius:8px;border:0;padding:0 .5rem;background:#fff;color:#0b1f3a;font:inherit;font-weight:600">' +
        S.memberships.map(function (m) { return '<option value="' + m.client_id + '"' + (m.client_id === S.client.id ? ' selected' : '') + '>' + esc(m.client_name) + '</option>'; }).join('') + '</select></div>'
        : '<div style="padding:0 .85rem .75rem;color:#fff;font-weight:600">' + esc(S.client.name) + '</div>';
    var navLi = function (n) { return n[0] === '-' ? '<li class="nav-sep" role="presentation">' + esc(n[1]) + '</li>' + (S.ref ? '<li role="presentation">' + clientBox + '</li>' : '') : '<li><a href="#/' + n[0] + '" data-view="' + n[0] + '"><svg class="icon" aria-hidden="true"><use href="#' + n[2] + '"/></svg>' + esc(n[1]) + (n[0] === 'invoices' ? '<span class="nav-badge" id="inv-badge" hidden></span>' : '') + (n[0] === 'documents' ? '<span class="nav-badge nav-badge--info" id="doc-badge" hidden></span>' : '') + '</a></li>'; };
    app.innerHTML = '<div class="console" id="console"><nav class="console__nav" id="console-nav" aria-label="' + t('portal') + '">' +
      '<div class="console__nav-title">' + t('portal') + '</div>' +
      (S.ref ? '<div style="padding:0 .85rem .75rem;color:#fff;font-weight:600">' + esc(S.partner.company || S.partner.name) + '<div style="font-weight:400;font-size:.8rem;color:var(--on-dark-muted)">' + esc(t('p_partnerLead')) + '</div></div>' : clientBox) +
      '<ul>' + navItems().map(navLi).join('') + '</ul>' +
      '<div class="console__nav-foot">' + esc(window.ENDEAVOR_FOOT ? ENDEAVOR_FOOT() : CFG.companyName) + '<br><a href="mailto:support@endeavorbiz.com" style="color:inherit">support@endeavorbiz.com</a></div></nav><div class="nav-backdrop" id="nav-backdrop"></div>' +
      '<main class="console__content" id="view" tabindex="-1"></main></div><div class="overlay" id="overlay" hidden></div>';
    var tgl = $('#nav-toggle'), con = $('#console');
    tgl.hidden = false;
    function setNav(o) { con.classList.toggle('nav-open', o); tgl.setAttribute('aria-expanded', String(o)); tgl.setAttribute('aria-label', o ? t('closeMenu') : t('menu')); }
    tgl.onclick = function () { setNav(!con.classList.contains('nav-open')); };
    $('#nav-backdrop').onclick = function () { setNav(false); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && con.classList.contains('nav-open')) { setNav(false); tgl.focus(); } });
    if ($('#cl-switch')) $('#cl-switch').onchange = async function () { await selectClient(this.value); await checkOpenInvoices(); await checkNewDocs(); startShell(); };
    window.onhashchange = function () { setNav(false); route(); };
    updateInvBadge(); updateDocBadge();
    route();
  }
  function route() {
    var items = navItems().filter(function (n) { return n[0] !== '-'; });
    var h = ERoute.get().replace(/^#\/?/, ''), v = h.split('?')[0] || items[0][0];
    var allowed = items.map(function (n) { return n[0]; });
    if (S.client && S.perms.owner && window.EClientOA) allowed.push('oa');
    // endereço antigo do envio de documentos: abre o envio dentro de Documentos
    if (v === 'bookkeeping' && allowed.indexOf('bookkeeping') < 0 && allowed.indexOf('reports') > -1) { ERoute.set('#/reports', true); v = 'reports'; }   // painel antigo do bookkeeping do pacote
    if (v === 'upload' && allowed.indexOf('documents') > -1 && S.perms.upload) { ERoute.set('#/documents?new=1', true); v = 'documents'; }
    if (allowed.indexOf(v) < 0) v = items[0][0];
    $$('.console__nav a').forEach(function (a) { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var view = $('#view'); if (!view) return;
    view.innerHTML = '<p class="portal-muted">' + t('loading') + '</p>'; view.scrollTop = 0;
    var V = { overview: vOverview, companies: vCompanies, documents: vDocuments, compliance: vCompliance, reports: vReports, upload: function (view) { ERoute.set('#/documents?new=1', true); return vDocuments(view); }, invoices: vInvoices, collaborators: vCollab, settings: vSettings };
    if (window.EAttorney) V.advogados = function (view) { return EAttorney.clientView(view, refCtx()); };
    if (S.ref) Object.assign(V, S.ref.views);
    if (window.EClientOA) V.oa = EClientOA.view;
    if (window.EProjects) V.projetos = function (view) { return EProjects.view(view, refCtx()); };
    if (window.EMeetPanel && S.client && S.meetOn && !PARTNER) V.webmeeting = function (view) { return EMeetPanel.render(view, refCtx(), { scope: 'client', clientId: S.client.id, clientName: S.client.name }); };
    if (window.ELiPanel && S.client && S.liOn && !PARTNER) V.linkedin = function (view) { return ELiPanel.render(view, refCtx(), { scope: 'client', clientId: S.client.id }); };
    if (window.EWaPanel && S.client && S.waOn && !PARTNER) V.whatsapp = function (view) { return EWaPanel.render(view, refCtx(), { scope: 'client', clientId: S.client.id }); };
    if (window.ETelPortal && S.client && S.telOn && !PARTNER) V.telefonia = function (view) { return ETelPortal.render(view, refCtx(), { clientId: S.client.id }); };
    if (window.EWebinarPanel && S.client && S.meetOn && !PARTNER) V.webinar = function (view) { return EWebinarPanel.render(view, refCtx(), { scope: 'client', clientId: S.client.id, clientName: S.client.name }); };
    if (window.ETools && S.client && !PARTNER) {
      Object.assign(V, ETools.views);
      if (S.kind === 'tools') V.overview = ETools.overview;
    }
    if (v === 'oa') $$('.console__nav a').forEach(function (a) { if (a.dataset.view === 'companies') a.setAttribute('aria-current', 'page'); });
    V[v](view).catch(function (e) { view.innerHTML = '<div class="portal-alert portal-alert--error">' + esc(errText(e)) + '</div>'; console.error(e); });
  }
  function param(k) { var m = ERoute.get().match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; }
  function head(title, lead, actions) { return '<div class="console__head"><div><h1>' + esc(title) + '</h1>' + (lead ? '<p class="portal-muted">' + esc(lead) + '</p>' : '') + '</div>' + (actions || '') + '</div>'; }
  function coById(id) { return S.companies.find(function (c) { return c.id === id; }); }

  /* overlay + viewer */
  function openOverlay(html, center) {
    var o = $('#overlay'); o.className = 'overlay' + (center ? ' overlay--center' : '');
    o.innerHTML = '<div class="' + (center ? 'modal' : 'drawer') + '" role="dialog" aria-modal="true">' + html + '</div>'; o.hidden = false;
    var f = o.querySelector('input,select,textarea,button'); if (f) f.focus();
    o.onclick = function (e) { if (e.target === o) closeOverlay(); };
    $$('.close-x', o).forEach(function (b) { b.onclick = closeOverlay; });
    document.onkeydown = function (e) { if (e.key === 'Escape') closeOverlay(); };
    return o;
  }
  function closeOverlay() { var o = $('#overlay'); o.hidden = true; o.innerHTML = ''; document.onkeydown = null; }
  function logAccess(doc, action) {
    sb.from('doc_access_log').insert({ document_id: doc.id, action: action }).then(function () {});
    if (isNewDoc(doc)) { S.docSeen[doc.id] = 1; S.docNew = Math.max(0, (S.docNew || 0) - 1); updateDocBadge(); $$('[data-new="' + doc.id + '"]').forEach(function (x) { x.remove(); }); }
  }
  async function viewDoc(d) {
    var isImg = /\.(png|jpe?g|webp|gif)$/i.test(d.path), isPdf = /\.pdf$/i.test(d.path);
    var o = openOverlay('<div class="viewer"><div class="viewer__bar"><strong>' + esc(d.title) + '</strong><div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="vw-print"' + (isPdf ? '' : ' hidden') + '>' + t('print') + '</button><button class="btn btn--ghost btn--xs" type="button" id="vw-dl">' + t('download') + '</button><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div></div>' +
      '<div class="viewer__pages" id="vw-pages"><p class="portal-muted">' + t('loading') + '</p></div></div>', true);
    o.querySelector('.modal').classList.add('modal--wide');
    var blob = null, name = d.title.replace(/[\\/:*?"<>|]+/g, '-') + ((d.path.match(/\.[a-z0-9]+$/i) || [''])[0]);
    try {
      var r = await sb.storage.from('client-docs').createSignedUrl(d.path, 600); if (r.error) throw r.error;
      blob = await (await fetch(r.data.signedUrl)).blob();
      logAccess(d, 'view');
      if (isPdf) { var pdf = await EPdf.open(new Uint8Array(await blob.arrayBuffer())); await EPdf.render(pdf, $('#vw-pages'), { maxWidth: 900, pageLabel: 'Page' }); }
      else if (isImg) $('#vw-pages').innerHTML = '<img alt="' + esc(d.title) + '" style="max-width:100%;display:block;margin:0 auto;background:#fff" src="' + URL.createObjectURL(blob) + '">';
      else $('#vw-pages').innerHTML = '<div class="empty-state"><strong>' + t('noPreview') + '</strong></div>';
    } catch (e) { $('#vw-pages').innerHTML = '<div class="portal-alert portal-alert--error">' + t('viewErr') + '</div>'; }
    $('#vw-dl').onclick = function () { if (blob) { download(name, blob); logAccess(d, 'download'); } };
    $('#vw-print').onclick = function () {
      if (!blob) return;
      var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; f.src = URL.createObjectURL(blob); document.body.appendChild(f);
      f.onload = function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { download(name, blob); } setTimeout(function () { f.remove(); }, 60000); };
    };
  }
  function docItems(docs, showCompany) {
    if (!docs.length) return '<div class="empty-state"><strong>' + t('noDocs') + '</strong></div>';
    return '<ul class="doclist">' + docs.map(function (d) {
      var co = coById(d.company_id);
      return '<li><span class="ficon" aria-hidden="true">' + fileIcon(d.path) + '</span><div><div class="dname">' + esc(d.title) + (d.year ? ' (' + d.year + ')' : '') + (isNewDoc(d) ? ' <span class="pill pill--new" data-new="' + d.id + '">' + t('isNew') + '</span>' : '') + '</div>' +
        '<div class="dmeta"><span class="pill pill--' + d.category + '">' + esc(t('cat_' + d.category)) + '</span> ' + (showCompany && co ? esc(co.legal_name) + ' · ' : '') + esc(fmtDate(d.created_at)) +
        (d.category === 'uploaded' && d.uploaded_by_email ? ' · ' + esc(t('uploadedBy', { e: d.uploaded_by_email })) : '') + '</div></div>' +
        '<div class="doc-acoes"><button class="btn btn--ghost btn--xs" type="button" data-doc="' + d.id + '">' + t('view') + '</button><button class="btn btn--ghost btn--xs" type="button" data-dl="' + d.id + '">' + dx('baixar') + '</button>' +
        (d.category === 'uploaded' && S.user && d.uploaded_by === S.user.id ? '<button class="btn btn--ghost btn--xs doc-del" type="button" data-del="' + d.id + '">' + dx('excluir') + '</button>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }
  function wireDocs(root, docs) {
    var acha = function (id) { return docs.find(function (d) { return d.id === id; }); };
    $$('[data-doc]', root).forEach(function (b) { b.onclick = function () { viewDoc(acha(b.dataset.doc)); }; });
    $$('[data-dl]', root).forEach(function (b) { b.onclick = async function () {
      var d = acha(b.dataset.dl); if (!d) return; b.disabled = true;
      try { var r = await sb.storage.from('client-docs').createSignedUrl(d.path, 300); if (r.error) throw r.error; var blob = await (await fetch(r.data.signedUrl)).blob();
        download(d.title.replace(/[\\/:*?"<>|]+/g, '-') + ((d.path.match(/\.[a-z0-9]+$/i) || [''])[0]), blob); logAccess(d, 'download'); }
      catch (e) { alert(t('viewErr')); }
      b.disabled = false; }; });
    $$('[data-del]', root).forEach(function (b) { b.onclick = async function () {
      var d = acha(b.dataset.del); if (!d || !confirm(dx('excluirQ', { t: d.title }))) return; b.disabled = true;
      var r = await sb.rpc('portal_doc_delete', { p_doc: d.id });
      if (r.error) { b.disabled = false; return alert(errText(r.error)); }
      route(); }; });
  }

  /* ---------------- views ---------------- */
  async function vOverview(view) {
    var cid = S.client.id;
    var res = await Promise.all([
      S.perms.deadlines ? q(sb.from('compliance_items').select('*').eq('client_id', cid).in('status', ['pending', 'in_progress']).order('due_date').limit(40)) : Promise.resolve([]),
      S.perms.view ? q(sb.from('company_documents').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(30)) : Promise.resolve([]),
      S.perms.view ? sb.from('company_documents').select('id', { count: 'exact', head: true }).eq('client_id', cid) : Promise.resolve({ count: 0 }),
      S.perms.reports && S.books ? sb.from('company_documents').select('id', { count: 'exact', head: true }).eq('client_id', cid).eq('category', 'report') : Promise.resolve({ count: 0 })
    ]);
    var next = res[0][0];
    var first = (S.me && S.me.name ? S.me.name : S.client.name).split(' ')[0];
    var kp = kpi(t('k_companies'), S.companies.length) + (S.perms.deadlines ? kpi(t('k_next'), next ? fmtDate(next.due_date) : t('none'), true) : '') +
      (S.perms.view ? kpi(t('k_docs'), res[2].count || 0) : '') + (S.perms.reports && S.books ? kpi(t('k_reports'), res[3].count || 0) : '');
    var topo = function (tit, href) { return '<div class="toolbar ov-top"><h2 class="portal-h2" style="margin:0">' + tit + '</h2><a href="' + href + '">' + t('seeAll') + '</a></div>'; };
    // página fixa: indicadores e andamento em cima; embaixo, prazos, documentos e atalhos lado a lado, cada lista em páginas com flechas
    view.innerHTML = head(t('hello', { n: first }), PARTNER ? t('p_overviewLead', { c: S.client.name }) : t('overviewLead')) +
      '<div class="sv-fit ov-fit">' +
      (S.openInv && S.openInv.n ? '<div class="portal-alert portal-alert--info ov-aviso"><strong>' + esc(t('inv_banner', { n: S.openInv.n, a: money(S.openInv.cents) })) + '</strong><a class="btn btn--danger btn--xs" id="ov-pagar" href="#/invoices">' + t('inv_bannerBtn') + '</a></div>' : '') +
      '<div class="kpis">' + kp + '</div>' + (PARTNER ? '<p class="perm-sum ov-perm"><strong>' + t('myAccess') + ':</strong> ' + esc(EPerms.summary(S.me, permLabels(), S.companies)) + '</p>' : '') +
      '<div class="ov-cols"><div class="ov-col"><div id="tl-ov"></div>' +
        (!S.perms.deadlines ? '' : '<section class="portal-card fp-card" id="ov-dl">' + topo(t('nextDeadlines'), '#/compliance') +
          '<div id="ov-dl-box">' + (res[0].length ? res[0].map(function (i) { return deadlineRow(i, coById(i.company_id)); }).join('') : '<div class="empty-state"><strong>' + t('noDeadlines') + '</strong></div>') + '</div></section>') + '</div>' +
        (S.perms.view ? '<section class="portal-card fp-card" id="ov-docs">' + topo(t('recentDocs'), '#/documents') + '<div id="ov-docs-box">' + docItems(res[1], true) + '</div></section>' : '') +
      '</div></div>';
    wireDocs(view, res[1]);
    var refaz = [];
    if ($('#ov-dl-box', view)) refaz.push(fitPager($('#ov-dl-box', view), '.deadline'));
    if ($('#ov-docs-box', view)) refaz.push(fitPager($('#ov-docs-box', view), '.doclist > li'));
    if (window.EClientOA && S.companies.length) EClientOA.overviewCard(S.companies).then(function (h) { var b = $('#tl-ov', view); if (!b) return; b.innerHTML = h; var c = b.querySelector('.portal-card'); if (c) { c.classList.add('fp-card'); var cx = document.createElement('div'); c.querySelectorAll('.tl-row').forEach(function (r) { cx.appendChild(r); }); c.appendChild(cx); cx.id = 'ov-tl-box'; b.classList.toggle('ov-tl--muitas', S.companies.length > 1); if (S.companies.length > 1) fitPager(cx, '.tl-row'); } refaz.forEach(function (f) { f(); }); }, function () {});
  }
  // Página fixa: divide os itens de uma área em páginas com flechas, pelo que cabe de verdade na tela. No celular mostra tudo, com rolagem normal.
  var fpObs = [];
  function fitPager(box, sel) {
    fpObs = fpObs.filter(function (o) { if (document.body.contains(o.box)) return true; o.obs.disconnect(); return false; });
    var nav = document.createElement('nav'); nav.className = 'sv-pager fp-nav'; nav.hidden = true; nav.setAttribute('aria-label', dx('paginas'));
    nav.innerHTML = '<button type="button" class="sv-seta" data-fp="-1" aria-label="' + dx('anterior') + '">‹</button><span aria-live="polite"></span><button type="button" class="sv-seta" data-fp="1" aria-label="' + dx('proxima') + '">›</button>';
    box.classList.add('fp-box'); box.insertAdjacentElement('afterend', nav);
    var pag = 0, ini = [0], li = [];
    function mostra() {
      pag = Math.max(0, Math.min(pag, ini.length - 1));
      var a = ini[pag], b = pag + 1 < ini.length ? ini[pag + 1] : li.length;
      li.forEach(function (x, i) { x.hidden = i < a || i >= b; });
      nav.hidden = ini.length < 2; nav.querySelector('span').textContent = (pag + 1) + '/' + ini.length;
      nav.querySelector('[data-fp="-1"]').disabled = pag === 0; nav.querySelector('[data-fp="1"]').disabled = pag >= ini.length - 1;
    }
    function paginar() {
      var primeiro = li[ini[pag]]; li = $$(sel, box); li.forEach(function (x) { x.classList.add('fp-item'); x.hidden = false; });
      ini = [0];
      if (window.innerWidth >= 1000 && window.innerHeight >= 560 && li.length) {
        nav.hidden = false;                                    // reserva a altura das flechas enquanto mede
        var cabe = function (a, n) { li.forEach(function (x, i) { x.hidden = i < a || i >= a + n; }); return box.scrollHeight <= box.clientHeight + 1; };
        var a = 0;
        while (a < li.length) {
          var lo = 1, hi = li.length - a;
          if (!cabe(a, hi)) { while (lo < hi) { var mid = Math.ceil((lo + hi) / 2); if (cabe(a, mid)) lo = mid; else hi = mid - 1; } } else lo = hi;
          if (lo > 1 && a + lo < li.length && li[a + lo - 1].classList.contains('d-sep')) lo--;     // título de grupo não fica sozinho no fim
          a += lo; if (a < li.length) ini.push(a);
        }
        if (ini.length < 2) { nav.hidden = true; }
      }
      var k = primeiro ? li.indexOf(primeiro) : 0; pag = 0; if (k > 0) ini.forEach(function (v, i) { if (v <= k) pag = i; });
      mostra();
    }
    nav.querySelectorAll('[data-fp]').forEach(function (b) { b.onclick = function () { pag += +b.dataset.fp; mostra(); }; });
    paginar(); requestAnimationFrame(function () { requestAnimationFrame(paginar); });
    if (window.ResizeObserver) { var w = 0, h = 0, obs = new ResizeObserver(function () { if (!document.body.contains(box)) return; if (box.clientWidth === w && box.clientHeight === h) return; w = box.clientWidth; h = box.clientHeight; paginar(); }); obs.observe(box); fpObs.push({ box: box, obs: obs }); }
    return paginar;
  }
  function kpi(l, v, small) { return '<div class="kpi"><div class="kpi__label">' + esc(l) + '</div><div class="kpi__value"' + (small ? ' style="font-size:1.35rem;padding-top:.35rem"' : '') + '>' + esc(v) + '</div></div>'; }

  // Minhas empresas abre direto no painel da empresa (sem o cartão antes); com mais de uma empresa, um seletor troca de empresa
  async function vCompanies(view) {
    var addBtn = window.EProjects && S.perms.owner && !PARTNER ? '<button class="btn btn--navy btn--sm" type="button" id="co-add">+ ' + esc(EProjects.addLabel(L)) + '</button>' : '';
    var liga = function () { if ($('#co-add')) $('#co-add').onclick = function () { EProjects.addCompany(refCtx(), function () { route(); }); }; };
    if (!S.companies.length) { view.innerHTML = head(t('nav_companies'), '', addBtn) + '<div class="portal-card empty-state"><strong>' + t('noCompanies') + '</strong>' + t('noCompaniesText') + '</div>'; return liga(); }
    var co = coById(param('id')) || S.companies[0];
    var tabs = [];
    if (window.EClientOA) tabs.push(['timeline', t('tab_timeline')]);
    if (S.perms.view) tabs.push(['docs', t('tab_docs')]);
    if (S.perms.deadlines) tabs.push(['deadlines', t('tab_deadlines')]);
    if (S.perms.reports && S.books) tabs.push(['finance', t('tab_finance')]);
    var tab = param('tab'); if (!tabs.some(function (x) { return x[0] === tab; })) tab = tabs[0] ? tabs[0][0] : 'none';
    var kv = [[t('docNumber'), co.document_number], [t('ein'), co.ein], [t('agent'), co.registered_agent], [t('fye'), co.fiscal_year_end], [t('address'), co.address]].filter(function (x) { return x[1]; });
    var meta = [co.state, co.formation_date ? t('formed', { d: fmtDate(co.formation_date) }) : ''].filter(Boolean).join(' · ');
    view.innerHTML = head(t('nav_companies'), '', addBtn) + '<div class="sv-fit co-fit">' +
      '<section class="portal-card co-topo"><div class="co-topo__l">' +
        (S.companies.length > 1 ? '<select id="co-sel" aria-label="' + t('company') + '">' + S.companies.map(function (c) { return '<option value="' + c.id + '"' + (c.id === co.id ? ' selected' : '') + '>' + esc(c.legal_name) + '</option>'; }).join('') + '</select>' : '<h2 class="portal-h2" id="co-nome" style="margin:0">' + esc(co.legal_name) + '</h2>') +
        '<span class="portal-muted">' + esc(meta) + '</span><span class="pill' + (co.status === 'active' ? ' pill--done' : '') + '">' + esc(t('st_' + co.status)) + '</span></div>' +
        (kv.length ? '<dl class="co-kv">' + kv.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '') + '</section>' +
      '<nav class="subtabs" id="co-tabs" aria-label="' + esc(co.legal_name) + '">' + tabs.map(function (x) { return '<a href="#/companies?id=' + co.id + '&tab=' + x[0] + '"' + (x[0] === tab ? ' aria-current="page"' : '') + '>' + esc(x[1]) + '</a>'; }).join('') + '</nav>' +
      '<div id="co-body" class="co-body"></div></div>';
    liga();
    if ($('#co-sel')) $('#co-sel').onchange = function () { ERoute.set('#/companies?id=' + this.value + '&tab=' + tab); };
    var body = $('#co-body', view), vazio = '<section class="portal-card empty-state"><strong>' + t('noDocs') + '</strong></section>';
    if (tab === 'timeline' && window.EClientOA) {
      await EClientOA.companyTab(body, co);
      var cartao = body.querySelector('.portal-card'); if (cartao) { cartao.classList.add('fp-card'); var cx = document.createElement('div'); while (cartao.firstChild) cx.appendChild(cartao.firstChild); cartao.appendChild(cx); fitPager(cx, '.tl-full > li'); }
    } else if (tab === 'docs' && S.perms.view) {
      var docs = await q(sb.from('company_documents').select('*').eq('company_id', co.id).order('category').order('created_at', { ascending: false }));
      var groups = ['onboarding', 'formation', 'tax_return', 'report', 'compliance', 'uploaded', 'other'].filter(function (c) { return docs.some(function (d) { return d.category === c; }); });
      body.innerHTML = groups.length ? '<section class="portal-card fp-card doc-lista"><div id="co-docs"><ul class="doclist">' + groups.map(function (g) { var ds = docs.filter(function (d) { return d.category === g; });
        return '<li class="d-sep" data-cat="' + g + '">' + esc(t('cat_' + g)) + ' <span class="portal-muted">(' + ds.length + ')</span></li>' + docItems(ds, false).replace(/^<ul[^>]*>|<\/ul>$/g, ''); }).join('') + '</ul></div></section>' : vazio;
      wireDocs(body, docs);
      if ($('#co-docs', body)) fitPager($('#co-docs', body), '.doclist > li');
    } else if (tab === 'finance' && S.perms.reports && S.books) {
      // os mesmos relatórios da página Relatórios financeiros
      if (S.books === 'pacote' && window.ETools && ETools.reportsTab && co.books_provider !== 'quickbooks') {
        await ETools.reportsTab(body, co);
        var rc = $('#bkp-reps', body), rl = $('#bkp-lista', body);
        if (rc && rl) { rc.classList.add('fp-card'); var rp = fitPager(rl, 'tbody tr'); $$('[data-ano]', body).forEach(function (b) { b.addEventListener('click', function () { setTimeout(rp, 0); }); }); }
      }
      else await reportsFor(body, [co]);
    } else if (tab === 'deadlines' && S.perms.deadlines) {
      var items = await q(sb.from('compliance_items').select('*').eq('company_id', co.id).order('due_date'));
      body.innerHTML = '<section class="portal-card fp-card"><div id="co-dl">' + (items.length ? items.map(function (i) { return deadlineRow(i, co); }).join('') : '<div class="empty-state"><strong>' + t('noDeadlines') + '</strong></div>') + '</div></section>';
      fitPager($('#co-dl', body), '.deadline');
    } else body.innerHTML = vazio;
  }

  var DOCX = { en: { fonte: 'official source', e_main: 'Main e-mail (sign-in)', e_two: 'Second e-mail', e_twoHint: 'Receives a copy of the automatic notices. Sign-in and password reset stay on the main e-mail.', e_save: 'Save', e_remove: 'Remove', e_saved: 'Second e-mail saved.', e_removed: 'Second e-mail removed.', e_bad: 'Enter a valid e-mail, different from the main one.',
      e_make: 'Make this the main e-mail', e_makeLead: 'To change your sign-in to {e}, confirm your current password. We send a confirmation link to {e}; the sign-in only changes after the click.', e_pass: 'Current password', e_send: 'Send confirmation link', e_wrong: 'Incorrect password.', e_sent: 'We sent a confirmation link to {e}. Your sign-in only changes after you click it; until then, keep using {o}.', e_fail: 'We could not start the change. The e-mail may already be used by another account.', prazoInfo: 'These deadlines are for information only, gathered from official sources. Confirm them with your accountant.', cancelar: 'Cancel', solicitados: 'Requested', categoria: 'Category', paginas: 'Document pages', anterior: 'Previous page', proxima: 'Next page', baixar: 'Download', excluir: 'Delete', excluirQ: 'Delete "{t}"? It leaves your list. This cannot be undone here.', pedidos: 'Requested documents', pedidosLead: 'Endeavor asked for these documents. Send each one here.', enviar: 'Send', prazo: 'Due {d}', paraPedido: 'Requested document: {t}', novo: 'New document', tipo: 'Document type', outro: 'Other', volta: 'Back to Documents', semTipo: 'No documents match your search.' },
    pt: { fonte: 'fonte oficial', e_main: 'E-mail principal (login)', e_two: 'Segundo e-mail', e_twoHint: 'Recebe cópia dos avisos automáticos. O login e a redefinição de senha continuam no e-mail principal.', e_save: 'Salvar', e_remove: 'Remover', e_saved: 'Segundo e-mail salvo.', e_removed: 'Segundo e-mail removido.', e_bad: 'Digite um e-mail válido, diferente do principal.',
      e_make: 'Tornar este o e-mail principal', e_makeLead: 'Para trocar o seu login para {e}, confirme a senha atual. Enviamos um link de confirmação para {e}; o login só muda depois do clique.', e_pass: 'Senha atual', e_send: 'Enviar link de confirmação', e_wrong: 'Senha incorreta.', e_sent: 'Enviamos um link de confirmação para {e}. O login só muda depois do clique; até lá, continue usando {o}.', e_fail: 'Não foi possível iniciar a troca. O e-mail pode já estar em uso por outra conta.', prazoInfo: 'Estes prazos são informativos, buscados em fontes oficiais. Confirme com o seu contador.', cancelar: 'Cancelar', solicitados: 'Solicitados', categoria: 'Categoria', paginas: 'Páginas de documentos', anterior: 'Página anterior', proxima: 'Próxima página', baixar: 'Baixar', excluir: 'Excluir', excluirQ: 'Excluir "{t}"? Ele sai da sua lista. Não dá para desfazer por aqui.', pedidos: 'Documentos solicitados', pedidosLead: 'A Endeavor pediu estes documentos. Envie cada um por aqui.', enviar: 'Enviar', prazo: 'Prazo: {d}', paraPedido: 'Documento solicitado: {t}', novo: 'Novo documento', tipo: 'Tipo do documento', outro: 'Outro', volta: 'Voltar para Documentos', semTipo: 'Nenhum documento encontrado.' },
    es: { fonte: 'fuente oficial', e_main: 'Correo principal (ingreso)', e_two: 'Segundo correo', e_twoHint: 'Recibe copia de los avisos automáticos. El ingreso y el cambio de contraseña siguen en el correo principal.', e_save: 'Guardar', e_remove: 'Quitar', e_saved: 'Segundo correo guardado.', e_removed: 'Segundo correo eliminado.', e_bad: 'Escriba un correo válido, distinto del principal.',
      e_make: 'Hacer de este el correo principal', e_makeLead: 'Para cambiar su ingreso a {e}, confirme la contraseña actual. Enviamos un enlace de confirmación a {e}; el ingreso solo cambia después del clic.', e_pass: 'Contraseña actual', e_send: 'Enviar enlace de confirmación', e_wrong: 'Contraseña incorrecta.', e_sent: 'Enviamos un enlace de confirmación a {e}. Su ingreso solo cambia después del clic; hasta entonces, siga usando {o}.', e_fail: 'No pudimos iniciar el cambio. El correo puede estar en uso por otra cuenta.', prazoInfo: 'Estos plazos son informativos, obtenidos de fuentes oficiales. Confírmelos con su contador.', cancelar: 'Cancelar', solicitados: 'Solicitados', categoria: 'Categoría', paginas: 'Páginas de documentos', anterior: 'Página anterior', proxima: 'Página siguiente', baixar: 'Descargar', excluir: 'Eliminar', excluirQ: '¿Eliminar "{t}"? Sale de su lista. No se puede deshacer aquí.', pedidos: 'Documentos solicitados', pedidosLead: 'Endeavor pidió estos documentos. Envíe cada uno por aquí.', enviar: 'Enviar', prazo: 'Plazo: {d}', paraPedido: 'Documento solicitado: {t}', novo: 'Nuevo documento', tipo: 'Tipo de documento', outro: 'Otro', volta: 'Volver a Documentos', semTipo: 'Ningún documento encontrado.' } };
  function dx(k, v) { var x = (DOCX[L] || DOCX.en)[k]; Object.keys(v || {}).forEach(function (n) { x = x.split('{' + n + '}').join(v[n]); }); return x; }
  async function vDocuments(view) {
    // o envio de documentos mora aqui dentro: botão "Novo documento" (o endereço antigo #/upload também abre esta tela)
    var abrir = param('new') && S.perms.upload ? (param('req') || true) : null;
    if (abrir) ERoute.set('#/documents', true);
    var docs = await q(sb.from('company_documents').select('*').eq('client_id', S.client.id).order('created_at', { ascending: false }));
    var pedidos = S.perms.upload ? ((await sb.from('portal_doc_requests').select('*').eq('client_id', S.client.id).eq('status', 'pending').order('created_at')).data || []) : [];
    S.docReq = pedidos.length; updateDocBadge();
    // página fixa: a barra fica no topo e a lista vem em páginas com flechas. Os documentos solicitados são a primeira opção das categorias (só quando há pendente).
    view.innerHTML = head(t('nav_documents'), t('privacyNote')) +
      '<div class="sv-fit doc-fit"><div class="toolbar doc-barra"><input type="search" id="d-q" placeholder="' + t('search') + '" aria-label="' + t('search') + '">' +
      '<select id="d-co" aria-label="' + t('company') + '"><option value="">' + t('allCompanies') + '</option>' + S.companies.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select>' +
      '<select id="d-cat" aria-label="' + dx('categoria') + '">' + (pedidos.length ? '<option value="req">' + dx('solicitados') + ' (' + pedidos.length + ')</option>' : '') + '<option value="">' + t('allCategories') + '</option>' + S.perms.cats.concat(['uploaded']).map(function (c) { return '<option value="' + c + '">' + t('cat_' + c) + '</option>'; }).join('') + '</select>' +
      (S.perms.upload ? '<button class="btn btn--gold btn--sm doc-novo" id="d-new" type="button"><svg class="icon" aria-hidden="true"><use href="#i-up"/></svg> ' + dx('novo') + '</button>' : '') + '</div>' +
      '<section class="portal-card doc-lista"><div class="doc-tab" id="d-tab"><div id="d-list"></div></div>' +
      '<nav class="sv-pager" id="d-pager" aria-label="' + dx('paginas') + '" hidden><button type="button" class="sv-seta" id="d-ant" aria-label="' + dx('anterior') + '">‹</button><span id="d-pg" aria-live="polite"></span><button type="button" class="sv-seta" id="d-prox" aria-label="' + dx('proxima') + '">›</button></nav></section></div>';
    var tab = $('#d-tab', view), lista = $('#d-list', view), pager = $('#d-pager', view), pag = 0, pags = [[]];
    // divide as linhas em páginas pela altura real de cada uma; um título de categoria nunca fica sozinho no fim da página
    function paginar() {
      var li = $$('#d-list > ul > li', view); li.forEach(function (x) { x.hidden = false; });
      if (window.innerWidth < 1000 || window.innerHeight < 560 || !li.length) { pags = [li]; pag = 0; return mostra(); }
      var alt = tab.clientHeight, primeiro = (pags[pag] || [])[0], atual = [], h = 0; pags = [];
      li.forEach(function (x) {
        var a = x.offsetHeight;
        if (atual.length && h + a > alt) { var sep = atual[atual.length - 1].classList.contains('d-sep') && atual.length > 1 ? atual.pop() : null; pags.push(atual); atual = sep ? [sep] : []; h = sep ? sep.offsetHeight : 0; }
        atual.push(x); h += a;
      });
      if (atual.length) pags.push(atual);
      var k = pags.findIndex(function (g) { return g.indexOf(primeiro) > -1; }); pag = k > -1 ? k : 0; mostra();
    }
    function mostra() {
      pag = Math.max(0, Math.min(pag, pags.length - 1));
      pags.forEach(function (g, k) { g.forEach(function (x) { x.hidden = k !== pag; }); });
      pager.hidden = pags.length < 2; $('#d-pg', view).textContent = (pag + 1) + '/' + pags.length; $('#d-ant', view).disabled = pag === 0; $('#d-prox', view).disabled = pag >= pags.length - 1;
    }
    function draw() {
      var s = $('#d-q').value.trim().toLowerCase(), co = $('#d-co').value, cat = $('#d-cat').value, vazio = function (m) { return '<div class="empty-state"><strong>' + m + '</strong></div>'; };
      if (cat === 'req') {
        var ps = pedidos.filter(function (r) { return (!co || !r.company_id || r.company_id === co) && (!s || (r.title + ' ' + (r.note || '')).toLowerCase().indexOf(s) > -1); });
        lista.innerHTML = ps.length ? '<ul class="doclist doc-pedidos" id="d-req"><li class="d-sep">' + esc(dx('pedidosLead')) + '</li>' + ps.map(function (r) { var c2 = r.company_id && coById(r.company_id);
          return '<li><span class="ficon" aria-hidden="true">!</span><div><div class="dname">' + esc(r.title) + '</div><div class="dmeta">' + [c2 ? esc(c2.legal_name) : '', r.due_date ? esc(dx('prazo', { d: fmtDate(r.due_date + 'T12:00:00') })) : '', r.note ? esc(r.note) : ''].filter(Boolean).join(' · ') + '</div></div><button class="btn btn--navy btn--xs" type="button" data-req="' + r.id + '">' + dx('enviar') + '</button></li>'; }).join('') + '</ul>' : vazio(dx('semTipo'));
      } else {
        var rows = docs.filter(function (d) { return (!co || d.company_id === co) && (!cat || d.category === cat) && (!s || (d.title + ' ' + (d.year || '')).toLowerCase().indexOf(s) > -1); });
        // organizados por tipo: um título para cada tipo que tem documento, na ordem das permissões
        var ordem = S.perms.cats.concat(['uploaded']), outros = rows.filter(function (d) { return ordem.indexOf(d.category) < 0; });
        var blocos = ordem.map(function (c) { return [c, rows.filter(function (d) { return d.category === c; })]; }).filter(function (b) { return b[1].length; });
        if (outros.length) blocos.push(['', outros]);
        lista.innerHTML = blocos.length ? '<ul class="doclist">' + blocos.map(function (b) { return '<li class="d-sep d-grupo" data-cat="' + b[0] + '" data-n="' + b[1].length + '">' + esc(b[0] ? t('cat_' + b[0]) : dx('outro')) + ' <span class="portal-muted">(' + b[1].length + ')</span></li>' + docItems(b[1], true).replace(/^<ul[^>]*>|<\/ul>$/g, ''); }).join('') + '</ul>'
          : vazio(docs.length ? dx('semTipo') : t('noDocs'));
        wireDocs(lista, rows);
      }
      $$('[data-req]', lista).forEach(function (b) { b.onclick = function () { abrirEnvio(b.dataset.req); }; });
      pags = [[]]; pag = 0; paginar();
    }
    ['#d-q', '#d-co', '#d-cat'].forEach(function (x) { $(x).addEventListener('input', draw); });
    $('#d-ant', view).onclick = function () { pag--; mostra(); };
    $('#d-prox', view).onclick = function () { pag++; mostra(); };
    var pre = param('company'); if (pre) $('#d-co').value = pre;
    if ($('#d-new')) $('#d-new').onclick = function () { abrirEnvio(); };
    // depois de um envio, a lista abre nos documentos enviados, com o novo em primeiro
    if (S.docAba) { $('#d-cat').value = ''; S.docAba = null; }
    if (abrir) abrirEnvio(abrir === true ? null : abrir);
    draw(); requestAnimationFrame(function () { requestAnimationFrame(paginar); });
    if (docObs) docObs.disconnect();
    if (window.ResizeObserver) { var larg = 0, altu = 0; docObs = new ResizeObserver(function () { if (!document.body.contains(tab)) return; if (tab.clientHeight === altu && tab.clientWidth === larg) return; altu = tab.clientHeight; larg = tab.clientWidth; paginar(); }); docObs.observe(tab); }
  }
  var docObs = null;

  async function vCompliance(view) {
    var items = await q(sb.from('compliance_items').select('*').eq('client_id', S.client.id).order('due_date'));
    var years = items.map(function (i) { return +i.due_date.slice(0, 4); }).filter(function (y, k, a) { return a.indexOf(y) === k; }).sort();
    var cy = new Date().getFullYear(); [cy, cy + 1].forEach(function (y) { if (years.indexOf(y) < 0) years.push(y); }); years.sort();
    var mode = 'list'; try { mode = localStorage.getItem('endeavor-dl-view') || 'list'; } catch (e) { /* ignore */ }
    view.innerHTML = head(t('nav_compliance'), t('complianceLead'), '<button class="btn btn--ghost btn--xs" type="button" id="ics">' + t('addCal') + '</button>') +
      '<div class="toolbar dl-bar"><select id="c-co" aria-label="' + t('company') + '"><option value="">' + t('allCompanies') + '</option>' + S.companies.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select>' +
      '<select id="c-yr" aria-label="' + t('dl_year') + '">' + years.map(function (y) { return '<option' + (y === cy ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
      '<div class="seg" role="group" aria-label="' + t('nav_compliance') + '"><button type="button" data-m="list">' + t('v_list') + '</button><button type="button" data-m="cal">' + t('v_cal') + '</button></div></div>' +
      '<div class="dl-sum" id="c-sum"></div><div id="c-list"></div><p class="portal-muted dl-info" id="c-info">' + dx('prazoInfo') + '</p>';
    function rowsNow() { var co = $('#c-co').value, yr = $('#c-yr').value; return items.filter(function (i) { return (!co || i.company_id === co) && i.due_date.slice(0, 4) === yr; }); }
    function draw() {
      var rows = rowsNow(), cnt = { done: 0, pend: 0, over: 0 };
      rows.forEach(function (i) { var s0 = dlState(i); if (cnt[s0] != null) cnt[s0]++; });
      $('#c-sum').innerHTML = [['done', 'sum_done'], ['pend', 'sum_pend'], ['over', 'sum_over']].map(function (x) { return '<div class="dl-sum__i dl-sum__i--' + x[0] + '"><b>' + cnt[x[0]] + '</b><span>' + t(x[1]) + '</span></div>'; }).join('');
      $$('.seg button', view).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.m === mode)); });
      if (!rows.length) { $('#c-list').innerHTML = '<div class="portal-card empty-state"><strong>' + t('noDeadlinesYear') + '</strong></div>'; return; }
      if (mode === 'cal') return drawCal(rows);
      var byMonth = {};
      rows.forEach(function (i) { var k = i.due_date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(i); });
      $('#c-list').innerHTML = Object.keys(byMonth).sort().map(function (k) {
        var p = k.split('-'), title = new Intl.DateTimeFormat(EP.locale, { month: 'long', year: 'numeric' }).format(new Date(+p[0], +p[1] - 1, 15));
        return '<section class="portal-card"><h2 class="portal-h2">' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + '</h2>' + byMonth[k].map(function (i) { return deadlineRow(i, coById(i.company_id)); }).join('') + '</section>';
      }).join('');
    }
    function drawCal(rows) {
      var yr = +$('#c-yr').value, byDay = {};
      rows.forEach(function (i) { (byDay[i.due_date] = byDay[i.due_date] || []).push(i); });
      var wd = []; for (var w = 0; w < 7; w++) wd.push(new Intl.DateTimeFormat(EP.locale, { weekday: 'narrow' }).format(new Date(2026, 1, 1 + w)));
      var html = '<div class="dl-cal">';
      for (var m = 0; m < 12; m++) {
        var first = new Date(yr, m, 1), days = new Date(yr, m + 1, 0).getDate(), name = new Intl.DateTimeFormat(EP.locale, { month: 'long' }).format(first);
        html += '<section class="portal-card dl-month"><h3>' + esc(name.charAt(0).toUpperCase() + name.slice(1)) + '</h3><div class="dl-grid">' + wd.map(function (x) { return '<span class="dl-wd">' + esc(x) + '</span>'; }).join('');
        for (var b = 0; b < first.getDay(); b++) html += '<span></span>';
        for (var d = 1; d <= days; d++) {
          var key = yr + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), its = byDay[key];
          if (!its) { html += '<span class="dl-d">' + d + '</span>'; continue; }
          var st = its.some(function (i) { return dlState(i) === 'over'; }) ? 'over' : its.every(function (i) { return dlState(i) === 'done' || dlState(i) === 'na'; }) ? 'done' : 'pend';
          html += '<button type="button" class="dl-d dl-d--' + st + '" data-day="' + key + '" aria-label="' + esc(fmtDate(key + 'T12:00:00') + ': ' + its.map(function (i) { return i.title; }).join(', ')) + '">' + d + '</button>';
        }
        html += '</div></section>';
      }
      $('#c-list').innerHTML = html + '</div><section class="portal-card dl-detail" id="c-day" aria-live="polite"><p class="portal-muted" style="margin:0">' + t('dl_pickDay') + '</p></section>';
      $$('[data-day]', view).forEach(function (bt) { bt.onclick = function () {
        $$('[data-day]', view).forEach(function (x) { x.classList.toggle('is-on', x === bt); });
        var its = byDay[bt.dataset.day] || [];
        $('#c-day').innerHTML = '<h2 class="portal-h2">' + esc(fmtDate(bt.dataset.day + 'T12:00:00')) + '</h2>' + (its.length ? its.map(function (i) { return deadlineRow(i, coById(i.company_id)); }).join('') : '<p>' + t('dl_none_day') + '</p>');
      }; });
    }
    $$('.seg button', view).forEach(function (b) { b.onclick = function () { mode = b.dataset.m; try { localStorage.setItem('endeavor-dl-view', mode); } catch (e) { /* ignore */ } draw(); }; });
    $('#c-co').onchange = draw; $('#c-yr').onchange = draw; draw();
    $('#ics').onclick = function () {
      var d = function (s) { return s.replace(/-/g, ''); };
      var ev = items.filter(function (i) { return i.status !== 'done' && i.status !== 'not_applicable'; }).map(function (i) {
        var end = new Date(i.due_date + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
        var co = coById(i.company_id);
        return ['BEGIN:VEVENT', 'UID:' + i.id + '@endeavorbiz.com', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), 'DTSTART;VALUE=DATE:' + d(i.due_date), 'DTEND;VALUE=DATE:' + end.toISOString().slice(0, 10).replace(/-/g, ''),
          'SUMMARY:' + (co ? co.legal_name + ': ' : '') + i.title.replace(/[,;]/g, ' '), 'DESCRIPTION:Endeavor Business Hub · support@endeavorbiz.com',
          'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + i.title.replace(/[,;]/g, ' '), 'END:VALARM', 'END:VEVENT'].join('\r\n');
      });
      download('endeavor-deadlines.ics', new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Endeavor Business Hub//Compliance//EN'].concat(ev, ['END:VCALENDAR']).join('\r\n')], { type: 'text/calendar' }));
    };
  }

  async function qboCall(payload) {
    var s = (await sb.auth.getSession()).data.session;
    var r = await fetch(CFG.functionsUrl + '/qbo', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) throw new Error(j.error || 'generic');
    return j;
  }
  // the client only sees the published reports; the books (QuickBooks or Endeavor Bookkeeping) are connected by the Endeavor team
  async function reportsFor(body, companies) {
    var docs = await q(sb.from('company_documents').select('*').eq('client_id', S.client.id).eq('category', 'report').order('created_at', { ascending: false }));
    body.innerHTML = companies.map(function (co) {
      var mine = docs.filter(function (d) { return d.company_id === co.id; }), on = co.books_provider === 'endeavor' || co.books_provider === 'quickbooks';
      return '<section class="portal-card"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + esc(co.legal_name) + '</h2>' +
        (on ? '<span class="qbo-badge qbo-badge--bk">' + t('repBy') + '</span>' : '') + '</div>' +
        (mine.length ? docItems(mine, false) : '<p class="portal-muted">' + t(on ? 'repPreparing' : 'repNone') + '</p>') + '</section>';
    }).join('');
    wireDocs(body, docs);
  }
  async function vReports(view) {
    if (!S.books) { ERoute.set('#/overview', true); return vOverview(view); }
    if (S.books === 'pacote' && window.ETools && ETools.reportsPage && S.companies.some(function (c) { return c.books_provider === 'endeavor'; })) return ETools.reportsPage(view);
    view.innerHTML = head(t('nav_reports'), t('reportsLead')) + '<div id="r-body"></div>';
    if (!S.companies.length) { $('#r-body').innerHTML = '<div class="portal-card empty-state"><strong>' + t('noCompanies') + '</strong></div>'; return; }
    var pre = param('company'), list = pre && coById(pre) ? [coById(pre)].concat(S.companies.filter(function (c) { return c.id !== pre; })) : S.companies;
    await reportsFor($('#r-body'), list);
  }

  // envio de documento: janela por cima da página Documentos (não existe mais a página separada)
  async function abrirEnvio(reqId) {
    if (!S.perms.upload) return;
    var y = new Date().getFullYear();
    var tipos = S.perms.cats.filter(function (c) { return c !== 'uploaded'; });
    var pedido = reqId ? ((await sb.from('portal_doc_requests').select('*').eq('id', reqId).eq('status', 'pending').maybeSingle()).data || null) : null;
    if (!S.companies.length) { openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + dx('novo') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div><div class="empty-state"><strong>' + t('noCompanies') + '</strong></div>', true); return; }
    openOverlay('<div class="drawer__head"><div><h2 class="portal-h2" id="u-h" style="margin:0">' + dx('novo') + '</h2><p class="portal-muted" id="u-sub" style="margin:.2rem 0 0">' + esc(pedido ? dx('paraPedido', { t: pedido.title }) : t('uploadLead')) + '</p></div><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<form class="portal-form" id="u-form" novalidate><div class="portal-grid2"><div class="field"><label for="u-co">' + t('company') + '</label><select id="u-co">' + S.companies.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="u-year">' + t('yearOpt') + '</label><select id="u-year"><option value="">—</option>' + [y, y - 1, y - 2, y - 3].map(function (v) { return '<option' + (v === y - 1 ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="portal-grid2"><div class="field"><label for="u-tipo">' + dx('tipo') + '</label><select id="u-tipo"><option value="">' + dx('outro') + '</option>' + tipos.map(function (c) { return '<option value="' + c + '">' + esc(t('cat_' + c)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="u-title">' + t('docTitle') + '</label><input id="u-title" type="text" maxlength="160" placeholder="1099-NEC, bank statements, receipts…"></div></div>' +
      '<label class="upload-zone" for="u-file" id="u-zone"><input type="file" id="u-file" class="sr-only" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xls,.xlsx,.doc,.docx"><strong>' + t('chooseFiles') + '</strong><span class="portal-muted" id="u-names">' + t('fileHint') + '</span></label>' +
      '<div class="portal-alert" id="u-msg" role="status"></div><div class="portal-btn-row" style="justify-content:flex-end"><button class="btn btn--ghost close-x-btn" type="button" id="u-cancel">' + dx('cancelar') + '</button><button class="btn btn--navy" type="submit" id="u-go">' + t('send') + '</button></div></form>', true);
    $('#overlay .modal').setAttribute('aria-labelledby', 'u-h'); $('#overlay .modal').id = 'u-win';
    $('#u-cancel').onclick = closeOverlay;
    if (pedido) { $('#u-title').value = pedido.title; if (pedido.company_id && coById(pedido.company_id)) $('#u-co').value = pedido.company_id; }
    else { var fc = $('#d-co'); if (fc && fc.value) $('#u-co').value = fc.value; }
    var input = $('#u-file'), zone = $('#u-zone'), files = [];
    var show = function () { $('#u-names').textContent = files.length ? files.map(function (f) { return f.name; }).join(', ') : t('fileHint'); };
    input.onchange = function () { files = Array.prototype.slice.call(input.files); show(); };
    ['dragenter', 'dragover'].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.remove('is-over'); }); });
    zone.addEventListener('drop', function (ev) { files = Array.prototype.slice.call(ev.dataTransfer.files || []); show(); });
    $('#u-form').onsubmit = async function (e) {
      e.preventDefault();
      var m = $('#u-msg'), go = $('#u-go'), co = $('#u-co').value, desc = $('#u-title').value.trim(), year = +$('#u-year').value || null;
      if (go.disabled) return;
      if (!files.length) return msg(m, t('pickFile'), 'error');
      var big = files.find(function (f) { return f.size > 25 * 1024 * 1024; }); if (big) return msg(m, t('tooBig', { f: big.name }), 'error');
      var names = []; go.disabled = true;
      try {
        for (var i = 0; i < files.length; i++) {
          var f = files[i]; msg(m, t('sending', { i: i + 1, n: files.length }), 'info');
          var buf = await f.arrayBuffer();
          var path = S.client.id + '/' + co + '/uploads/' + crypto.randomUUID().slice(0, 8) + '-' + slug(f.name);
          var up = await sb.storage.from('client-docs').upload(path, new Blob([buf], { type: f.type || 'application/octet-stream' }), { contentType: f.type || 'application/octet-stream' });
          if (up.error) throw up.error;
          var title = desc ? (files.length > 1 ? desc + ' · ' + f.name : desc) : f.name.replace(/\.[^.]+$/, '');
          // o tipo escolhido entra no nome (o arquivo continua no grupo "enviados", que é onde o cliente pode gravar)
          var tp = $('#u-tipo') && $('#u-tipo').value; if (tp) title = (t('cat_' + tp) + ' · ' + title).slice(0, 160);
          var row = await q(sb.from('company_documents').insert({ company_id: co, client_id: S.client.id, category: 'uploaded', title: title, year: year, path: path, mime: f.type || null, size_bytes: f.size, sha256: await sha256Hex(buf), uploaded_by: S.user.id }).select('id').single());
          sb.from('doc_access_log').insert({ document_id: row.id, action: 'upload' }).then(function () {});
          if (pedido && i === 0) await sb.rpc('portal_doc_request_done', { p_id: pedido.id, p_doc: row.id });
          names.push(f.name);
        }
        fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: 'Client portal upload: ' + S.client.name + ' (' + names.length + ' file' + (names.length > 1 ? 's' : '') + ')',
          client: S.client.name, company: (coById(co) || {}).legal_name, uploaded_by: S.user.email, files: names.join(', '), tax_year: year || '', note: 'Open the admin console > Clientes > Documentos.' }) }).catch(function () {});
        // a janela fecha sozinha e a lista volta já com o documento (o pedido sai de "Solicitados")
        msg(m, t('sent'), 'ok');
        setTimeout(function () { closeOverlay(); S.docAba = 'uploaded'; route(); }, 700);
      } catch (err) { go.disabled = false; msg(m, errText(err), 'error'); }
    };
  }

  async function vCollab(view) {
    var users = await q(sb.from('client_users').select('*').eq('client_id', S.client.id).order('invited_at'));
    var collabs = users.filter(function (u) { return u.role === 'collaborator'; });
    view.innerHTML = head(t('nav_collab'), t('collabLead'), '<button class="btn btn--navy btn--xs" type="button" id="inv">' + t('invite') + '</button>') +
      '<section class="portal-card">' + (collabs.length ? '<ul class="doclist">' + collabs.map(function (u) {
        return '<li><span class="ficon" aria-hidden="true">' + esc((u.name || u.email).slice(0, 2).toUpperCase()) + '</span><div><div class="dname">' + esc(u.name || u.email) + ' · ' + esc(t('c_' + (u.collab_type || 'other'))) + '</div>' +
          '<div class="dmeta">' + esc(u.email) + ' · <span class="pill' + (u.status === 'active' ? ' pill--done' : u.status === 'revoked' ? ' pill--overdue' : ' pill--soon') + '">' + t('s_' + u.status) + '</span></div><div class="perm-sum">' + esc(EPerms.summary(u, permLabels(), S.companies)) + '</div></div>' +
          '<div class="portal-btn-row">' + (u.status !== 'revoked' ? '<button class="btn btn--ghost btn--xs" data-perm="' + u.id + '">' + t('editPerms') + '</button>' : '') + (u.status === 'invited' ? '<button class="btn btn--ghost btn--xs" data-resend="' + u.id + '">' + t('resend') + '</button>' : '') + (u.status !== 'revoked' ? '<button class="btn btn--danger btn--xs" data-rev="' + u.id + '">' + t('revoke') + '</button>' : '') + '</div></li>';
      }).join('') + '</ul>' : '<div class="empty-state"><strong>' + t('noCollab') + '</strong>' + t('collabLead') + '</div>') + '</section>';
    var find = function (id) { return users.find(function (u) { return u.id === id; }); };
    $$('[data-rev]', view).forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.rev); if (!confirm(t('confirmRevoke', { e: u.email }))) return; await sb.from('client_users').update({ status: 'revoked' }).eq('id', u.id); route(); }; });
    $$('[data-resend]', view).forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.resend); await sendInvite(u.email, u.name || u.email); alert(t('inviteSent', { e: u.email })); }; });
    $$('[data-perm]', view).forEach(function (b) { b.onclick = function () { inviteForm(find(b.dataset.perm)); }; });
    $('#inv').onclick = function () { inviteForm(null); };
    if (param('invite')) inviteForm(null);
  }
  async function sendInvite(email, name) {
    var link = siteUrl('partner.html') + '?lang=' + L;
    var txt = window.EndeavorInvite.text(L, { name: name, email: email, link: link, invitedBy: S.client.name, partner: true });
    try { await payCall({ action: 'send_access', client_id: S.client.id, email: email }); } catch (e) { return false; }
    try { await fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: 'Collaborator invited: ' + name + ' (' + S.client.name + ')', _template: 'table', _captcha: 'false', name: name, email: email, client: S.client.name, invited_by: S.user.email, _autoresponse: txt }) }); } catch (e) { /* best effort */ }
    return true;
  }
  function permLabels() {
    return { access: t('access'), companies: t('permCompanies'), allCompanies: t('permAll'), docs: t('permDocs'), other: t('permOther'),
      cat_formation: t('cat_formation'), cat_onboarding: t('cat_onboarding'), cat_tax_return: t('cat_tax_return'), cat_report: t('cat_report'), cat_compliance: t('cat_compliance'), cat_other: t('cat_other'),
      deadlines: t('permDeadlines'), upload: t('permUpload'), docsHint: t('permDocsHint'), full: t('full'), docsShort: t('docsShort'), noDocs: t('noDocs'),
      deadlinesShort: t('deadlinesShort'), uploadShort: t('uploadShort'), noCompanies: t('noCompanies') };
  }
  function inviteForm(u) {
    var edit = !!u;
    openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (edit ? t('editPerms') + ': ' + esc(u.name || u.email) : t('invite')) + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<form class="portal-form" id="iv-form" novalidate>' +
      (edit ? '' : '<div class="field"><label for="iv-name">' + t('name') + '</label><input id="iv-name" type="text" required></div><div class="field"><label for="iv-email">' + t('email') + '</label><input id="iv-email" type="email" required></div>') +
      '<div class="field"><label for="iv-type">' + t('type') + '</label><select id="iv-type">' + ['accountant', 'bookkeeping', 'property_management', 'other'].map(function (k) { return '<option value="' + k + '"' + (u && u.collab_type === k ? ' selected' : '') + '>' + t('c_' + k) + '</option>'; }).join('') + '</select></div>' +
      EPerms.html('iv', permLabels(), S.companies, u) +
      '<div class="portal-alert" id="iv-msg" role="alert"></div><button class="btn btn--navy" type="submit">' + (edit ? t('savePerms') : t('invite')) + '</button></form>');
    var form = $('#iv-form');
    EPerms.wire(form, 'iv', $('#iv-type'), !edit);
    form.onsubmit = async function (e) {
      e.preventDefault();
      var perms = EPerms.read(form, 'iv');
      if (perms.perm_companies && !perms.perm_companies.length) return msg($('#iv-msg'), t('noCompanies'), 'error');
      var row = Object.assign({ collab_type: $('#iv-type').value }, perms), r;
      if (edit) r = await sb.from('client_users').update(row).eq('id', u.id);
      else {
        var name = $('#iv-name').value.trim(), email = $('#iv-email').value.trim().toLowerCase();
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg($('#iv-msg'), t('fillNameEmail'), 'error');
        r = await sb.from('client_users').insert(Object.assign({ client_id: S.client.id, email: email, name: name, role: 'collaborator' }, row));
        if (!r.error) await sendInvite(email, name);
      }
      if (r.error) return msg($('#iv-msg'), /unique|duplicate/i.test(r.error.message) ? t('inviteDup') : errText(r.error), 'error');
      closeOverlay(); ERoute.set('#/collaborators', true); route();
    };
  }

  var money = function (c, cur) { return new Intl.NumberFormat(EP.locale, { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((c || 0) / 100); };
  var stripeUrl = function (u) { return /^https:\/\/(invoice|pay)\.stripe\.com\//.test(u || '') ? u : null; };
  async function payCall(payload) {
    var sess = (await sb.auth.getSession()).data.session;
    var r = await fetch(CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  }
  function loadStripeJs() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = 'https://js.stripe.com/v3/'; sc.onload = function () { res(window.Stripe); }; sc.onerror = rej; document.head.appendChild(sc); });
  }
  /* ---------------- Billing: faturas a pagar, plano atual, histórico e débito automático ---------------- */
  var BIL = {
    en: { due: 'Due {d}', paidOn: 'Paid {d}', when: 'Due / paid', action: 'Action', invoices: 'Invoices', openTotal: '{a} to pay', pages: 'Invoice pages', prev: 'Previous page', nextPg: 'Next page', apOnShort: 'Authorized on {d}', apOffShort: 'Not authorized yet', ckSub: 'Invoice {n}', ckTotal: 'Total to pay', ckItems: 'What you are paying', lead: 'Your invoices, your plan and your automatic payment authorization.', open: 'To pay', noOpen: 'No open invoices. You are all set.', plan: 'Current plan', noPlan: 'No plan on this account yet.', monthly: 'Monthly subscription', perMonth: '/month',
      plus: 'plan {p} + add-ons {a}', next: 'Next charge', method: 'Payment method', noMethod: 'Not registered yet', autopay: 'Automatic payment', apOn: 'Authorized on {d} by {n}', apOff: 'Not authorized yet. You authorize it when you pay your first invoice.',
      hist: 'Paid invoices (last 12 months)', histLead: 'Each one with a copy of the paid invoice to download.', noHist: 'No invoices paid in the last 12 months.', older: 'See older invoices ({n})', olderHide: 'Hide older invoices', copy: 'Paid invoice (PDF)', noCopy: 'Copy not available',
      only: 'We accept only a U.S. bank account (ACH) or a debit card. Credit cards are not accepted.', apTitle: 'Automatic payment authorization', apCheck: 'I have read and I authorize the automatic payment described above.', apName: 'Full name (as your signature)',
      apNeed: 'To pay, check the authorization box and type your full name.', credit: 'Credit cards are not accepted. Use a debit card or a U.S. bank account.', debitOnly: 'We could not confirm that this is a debit card. Use a debit card or a U.S. bank account.',
      notAllowed: 'This payment method is not accepted. Use a debit card or a U.S. bank account.', apActive: 'Automatic payment authorized on {d} by {n}.', manage: 'Manage services' },
    pt: { due: 'Vence em {d}', paidOn: 'Paga em {d}', when: 'Vencimento / pagamento', action: 'Ação', invoices: 'Faturas', openTotal: '{a} a pagar', pages: 'Páginas de faturas', prev: 'Página anterior', nextPg: 'Próxima página', apOnShort: 'Autorizado em {d}', apOffShort: 'Ainda não autorizado', ckSub: 'Fatura {n}', ckTotal: 'Total a pagar', ckItems: 'O que você está pagando', lead: 'Suas faturas, o seu plano e a sua autorização de débito automático.', open: 'A pagar', noOpen: 'Nenhuma fatura em aberto. Está tudo em dia.', plan: 'Plano atual', noPlan: 'Esta conta ainda não tem um plano.', monthly: 'Assinatura mensal', perMonth: '/mês',
      plus: 'plano {p} + add-ons {a}', next: 'Próxima cobrança', method: 'Forma de pagamento', noMethod: 'Ainda não cadastrada', autopay: 'Débito automático', apOn: 'Autorizado em {d} por {n}', apOff: 'Ainda não autorizado. Você autoriza ao pagar a primeira fatura.',
      hist: 'Faturas pagas (últimos 12 meses)', histLead: 'Cada uma com a cópia da fatura paga para baixar.', noHist: 'Nenhuma fatura paga nos últimos 12 meses.', older: 'Ver faturas mais antigas ({n})', olderHide: 'Esconder as faturas mais antigas', copy: 'Fatura paga (PDF)', noCopy: 'Cópia não disponível',
      only: 'Aceitamos só conta bancária americana (ACH) ou cartão de débito. Cartão de crédito não é aceito.', apTitle: 'Autorização de débito automático', apCheck: 'Li e autorizo o débito automático descrito acima.', apName: 'Nome completo (vale como a sua assinatura)',
      apNeed: 'Para pagar, marque a autorização e digite o seu nome completo.', credit: 'Cartão de crédito não é aceito. Use um cartão de débito ou uma conta bancária americana.', debitOnly: 'Não conseguimos confirmar que este cartão é de débito. Use um cartão de débito ou uma conta bancária americana.',
      notAllowed: 'Esta forma de pagamento não é aceita. Use um cartão de débito ou uma conta bancária americana.', apActive: 'Débito automático autorizado em {d} por {n}.', manage: 'Gerenciar serviços' },
    es: { due: 'Vence el {d}', paidOn: 'Pagada el {d}', when: 'Vencimiento / pago', action: 'Acción', invoices: 'Facturas', openTotal: '{a} por pagar', pages: 'Páginas de facturas', prev: 'Página anterior', nextPg: 'Página siguiente', apOnShort: 'Autorizado el {d}', apOffShort: 'Aún no autorizado', ckSub: 'Factura {n}', ckTotal: 'Total a pagar', ckItems: 'Lo que está pagando', lead: 'Sus facturas, su plan y su autorización de débito automático.', open: 'Por pagar', noOpen: 'No hay facturas abiertas. Está al día.', plan: 'Plan actual', noPlan: 'Esta cuenta aún no tiene un plan.', monthly: 'Suscripción mensual', perMonth: '/mes',
      plus: 'plan {p} + add-ons {a}', next: 'Próximo cargo', method: 'Medio de pago', noMethod: 'Aún no registrado', autopay: 'Débito automático', apOn: 'Autorizado el {d} por {n}', apOff: 'Aún no autorizado. Usted lo autoriza al pagar la primera factura.',
      hist: 'Facturas pagadas (últimos 12 meses)', histLead: 'Cada una con la copia de la factura pagada para descargar.', noHist: 'No hay facturas pagadas en los últimos 12 meses.', older: 'Ver facturas más antiguas ({n})', olderHide: 'Ocultar las facturas más antiguas', copy: 'Factura pagada (PDF)', noCopy: 'Copia no disponible',
      only: 'Aceptamos solo cuenta bancaria de EE. UU. (ACH) o tarjeta de débito. No se aceptan tarjetas de crédito.', apTitle: 'Autorización de débito automático', apCheck: 'Leí y autorizo el débito automático descrito arriba.', apName: 'Nombre completo (vale como su firma)',
      apNeed: 'Para pagar, marque la autorización y escriba su nombre completo.', credit: 'No se aceptan tarjetas de crédito. Use una tarjeta de débito o una cuenta bancaria de EE. UU.', debitOnly: 'No pudimos confirmar que esta tarjeta es de débito. Use una tarjeta de débito o una cuenta bancaria de EE. UU.',
      notAllowed: 'Este medio de pago no se acepta. Use una tarjeta de débito o una cuenta bancaria de EE. UU.', apActive: 'Débito automático autorizado el {d} por {n}.', manage: 'Gestionar servicios' }
  };
  function bt(k, v) { var s = (BIL[L] || BIL.en)[k] || BIL.en[k] || k; Object.keys(v || {}).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  var PACOTES_BIL = ['pkg_holding', 'pkg_completo', 'pkg_essencial'];
  async function vInvoices(view) {
    var payId = param('pay'), paidId = param('paid');
    if (payId) return vCheckout(view, payId);
    if (paidId) { try { await payCall({ action: 'invoice_refresh', invoice_id: paidId }); } catch (e) { /* webhook will update */ } }
    var res = await Promise.all([
      q(sb.from('invoices').select('id, number, created_at, due_date, paid_at, total_cents, amount_paid_cents, currency, status, invoice_pdf, archive_path, description').eq('client_id', S.client.id).order('created_at', { ascending: false })),
      sb.from('client_services').select('product_code, status, included_in').eq('client_id', S.client.id).neq('status', 'canceled'),
      sb.from('store_products').select('code, kind, price_cents, member_cents, interval'),
      payCall({ action: 'billing_summary', client_id: S.client.id }).catch(function () { return null; })]);
    var rows = res[0], svcs = (res[1] && res[1].data) || [], prods = {}, sum = res[3] || {};
    ((res[2] && res[2].data) || []).forEach(function (p) { prods[p.code] = p; });
    var isOpen = function (r) { return r.status === 'open' || r.status === 'uncollectible'; };
    var openRows = rows.filter(isOpen), open = openRows.reduce(function (s, r) { return s + r.total_cents - r.amount_paid_cents; }, 0);
    var corte = new Date(); corte.setMonth(corte.getMonth() - 12);
    var pagas = rows.filter(function (r) { return r.status === 'paid'; }), dataPaga = function (r) { return new Date(r.paid_at || r.created_at); };
    var hist = pagas.filter(function (r) { return dataPaga(r) >= corte; }), antigas = pagas.filter(function (r) { return dataPaga(r) < corte; });
    var done = paidId && rows.find(function (r) { return r.id === paidId; });
    S.openInv = { n: openRows.length, cents: open };
    updateInvBadge();
    // plano: pacote da conta + add-ons mensais contratados à parte
    var plano = PACOTES_BIL.filter(function (c) { return svcs.some(function (x) { return x.product_code === c; }); })[0], nomeDe = function (c) { var i = window.EStore && EStore.info(c, L); return i ? i.name : c; };
    var pp = plano && prods[plano], base = pp && pp.interval === 'month' ? pp.price_cents : 0, extras = 0, nomesExtras = [];
    svcs.forEach(function (x) { var p = prods[x.product_code]; if (!p || p.kind === 'package' || x.included_in || p.interval !== 'month') return; extras += (plano && p.member_cents != null && p.member_cents < p.price_cents) ? p.member_cents : p.price_cents; nomesExtras.push(nomeDe(x.product_code)); });
    if (!plano && !extras && S.client.monthly_cents) base = S.client.monthly_cents;
    var mensal = base + extras, temPlano = !!(plano || mensal);
    // uma lista só: mais recentes primeiro; a em aberto com "Pagar" na linha, as pagas com a cópia em PDF
    var lista = rows.filter(function (r) { return isOpen(r) || r.status === 'paid'; }).sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at); });
    var linha = function (r) {
      var aberta = isOpen(r);
      return '<tr' + (aberta ? ' class="bil-aberta"' : '') + '><td><strong style="white-space:nowrap">' + esc(r.number || '—') + '</strong>' + (r.description ? '<div class="portal-muted bil-desc">' + esc(r.description) + '</div>' : '') + '</td><td>' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td>' + esc(aberta ? (r.due_date ? bt('due', { d: fmtDate(r.due_date) }) : '—') : (r.paid_at ? bt('paidOn', { d: fmtDate(r.paid_at) }) : '—')) + '</td>' +
        '<td class="num">' + esc(money(r.total_cents, r.currency)) + '</td><td><span class="inv-st inv-st--' + esc(r.status) + '">' + esc(t('inv_' + r.status)) + '</span></td>' +
        '<td class="bil-acao">' + (aberta ? '<a class="btn btn--navy btn--xs" href="#/invoices?pay=' + r.id + '">' + t('invPay') + '</a>'
          : (r.archive_path || stripeUrl(r.invoice_pdf) ? '<button class="btn btn--ghost btn--xs" type="button" data-arch="' + r.id + '">' + bt('copy') + '</button>' : '<span class="portal-muted" style="font-size:.82rem">' + bt('noCopy') + '</span>')) + '</td></tr>';
    };
    var ap = sum.autopay, cel = function (rot, val) { return '<div class="bil-cel"><dt>' + rot + '</dt><dd>' + val + '</dd></div>'; };
    view.innerHTML = head(t('nav_invoices'), bt('lead')) +
      (done ? '<div class="portal-alert portal-alert--' + (done.status === 'paid' ? 'ok' : 'info') + '" role="status" style="display:block;margin-bottom:1rem"><strong>' + esc(done.status === 'paid' ? t('ck_ok') : t('ck_processing')) + '</strong>' + (done.status === 'paid' ? ' ' + esc(t('ck_okText')) : '') + '</div>' : '') +
      '<div class="sv-fit bil-fit">' +
      '<section class="portal-card bil-plano" id="bil-plan" aria-labelledby="bil-plan-t"><div class="bil-plano__top"><h2 class="portal-h2" id="bil-plan-t">' + bt('plan') + '</h2><a class="btn btn--ghost btn--xs" href="#/servicos">' + bt('manage') + '</a></div>' +
        (!temPlano ? '<p class="portal-muted" style="margin:0">' + bt('noPlan') + '</p>' : '<dl class="bil-faixa">' +
          cel(bt('plan'), '<strong>' + esc(plano ? nomeDe(plano) : '—') + '</strong>' + (nomesExtras.length ? '<small>+ ' + esc(nomesExtras.join(', ')) + '</small>' : '')) +
          cel(bt('monthly'), '<strong>' + esc(money(mensal)) + '</strong> ' + bt('perMonth') + (plano && extras ? '<small>' + esc(bt('plus', { p: money(base), a: money(extras) })) + '</small>' : '')) +
          cel(bt('next'), esc(sum.next_charge ? fmtDate(sum.next_charge) : '—')) +
          cel(bt('method'), esc(sum.method && sum.method.label ? sum.method.label : bt('noMethod'))) +
          cel(bt('autopay'), ap ? '<span class="inv-st inv-st--paid">' + esc(bt('apOnShort', { d: fmtDate(ap.since) })) + '</span><small>' + esc(ap.name) + '</small>' : '<span class="portal-muted">' + bt('apOffShort') + '</span>') + '</dl>') + '</section>' +
      '<section class="portal-card bil-lista" id="bil-inv" aria-labelledby="bil-inv-t"><div class="bil-plano__top"><h2 class="portal-h2" id="bil-inv-t">' + bt('invoices') + '</h2>' + (openRows.length ? '<span class="inv-st inv-st--open">' + esc(bt('openTotal', { a: money(open) })) + '</span>' : '') + '</div>' +
        (lista.length ? '<div class="table-wrap bil-tab" id="bil-tab"><table class="data"><thead><tr><th>' + t('invNo') + '</th><th>' + t('invDate') + '</th><th>' + bt('when') + '</th><th class="num">' + t('invTotal') + '</th><th>' + t('invStatus') + '</th><th><span class="sr-only">' + bt('action') + '</span></th></tr></thead><tbody id="bil-rows"></tbody></table></div>' +
          '<nav class="sv-pager" id="bil-pager" aria-label="' + bt('pages') + '" hidden><button type="button" class="sv-seta" id="bil-ant" aria-label="' + bt('prev') + '">‹</button><span id="bil-pg" aria-live="polite"></span><button type="button" class="sv-seta" id="bil-prox" aria-label="' + bt('nextPg') + '">›</button></nav>'
          : '<p class="portal-muted">' + t('invNone') + '</p>') + '</section></div>';
    if (!lista.length) return;
    // páginas: no computador, a quantidade de linhas que cabe na tela; no celular, todas, com rolagem normal
    var tab = $('#bil-tab', view), corpo = $('#bil-rows', view), pager = $('#bil-pager', view), pag = 0, porPag = 0;
    function cabem() { if (window.innerWidth < 1000 || window.innerHeight < 560) return 0; var th = tab.querySelector('thead').getBoundingClientRect().height || 44; return Math.max(2, Math.floor((tab.clientHeight - th - 2) / 62)); }
    function arquivo() {
      $$('[data-arch]', corpo).forEach(function (b) { b.onclick = async function () {
        b.disabled = true;
        try { var j = await payCall({ action: 'invoice_archive', invoice_id: b.dataset.arch }); window.open(j.url, '_blank', 'noopener'); }
        catch (e) { var r = rows.find(function (x) { return x.id === b.dataset.arch; }); var u = r && stripeUrl(r.invoice_pdf); if (u) window.open(u, '_blank', 'noopener'); }
        b.disabled = false;
      }; });
    }
    function desenha() {
      var pags = porPag ? Math.max(1, Math.ceil(lista.length / porPag)) : 1; pag = Math.min(pag, pags - 1);
      corpo.innerHTML = (porPag ? lista.slice(pag * porPag, pag * porPag + porPag) : lista).map(linha).join('');
      pager.hidden = pags < 2; $('#bil-pg', view).textContent = (pag + 1) + '/' + pags; $('#bil-ant', view).disabled = pag === 0; $('#bil-prox', view).disabled = pag >= pags - 1;
      arquivo();
    }
    function medir() { var n = cabem(); if (n === porPag && corpo.children.length) return; var primeiro = porPag ? pag * porPag : 0; porPag = n; pag = n ? Math.floor(primeiro / n) : 0; desenha(); }
    $('#bil-ant', view).onclick = function () { if (pag > 0) { pag--; desenha(); } };
    $('#bil-prox', view).onclick = function () { pag++; desenha(); };
    desenha(); requestAnimationFrame(function () { requestAnimationFrame(medir); });
    if (bilObs) bilObs.disconnect();
    if (window.ResizeObserver) { bilObs = new ResizeObserver(function () { if (document.body.contains(tab)) medir(); }); bilObs.observe(tab); }
  }
  var bilObs = null;

  /* Pagamento dentro do portal: resumo da fatura + Stripe Payment Element. Só conta bancária americana (ACH) ou cartão de débito:
     o tipo do cartão é conferido no servidor antes de confirmar. No primeiro pagamento o dono autoriza o débito automático. */
  async function vCheckout(view, id) {
    var inv = (await q(sb.from('invoices').select('*').eq('id', id).eq('client_id', S.client.id)))[0];
    if (!inv) { ERoute.set('#/invoices', true); return vInvoices(view); }
    var pdf = stripeUrl(inv.invoice_pdf);
    var items = Array.isArray(inv.items) ? inv.items : [];
    view.innerHTML = '<div class="ck-um"><p class="ck-um__volta"><a href="#/invoices">← ' + t('ck_back') + '</a></p>' +
      '<section class="portal-card ck-card" aria-labelledby="ck-t"><header class="ck-card__top"><div><p class="ck-card__sub">' + esc(bt('ckSub', { n: inv.number || '—' })) + ' · ' + esc(S.client.name) + '</p><h1 class="ck-card__t" id="ck-t">' + t('ck_title') + '</h1>' +
          (inv.due_date ? '<p class="portal-muted" style="margin:.15rem 0 0;font-size:.9rem">' + esc(bt('due', { d: fmtDate(inv.due_date) })) + '</p>' : '') + '</div>' +
          '<div class="ck-card__total"><span>' + bt('ckTotal') + '</span><strong>' + esc(money(inv.total_cents - inv.amount_paid_cents, inv.currency)) + '</strong></div></header>' +
        (items.length ? '<details class="ck-itens"' + (items.length <= 2 ? ' open' : '') + '><summary>' + bt('ckItems') + '</summary><ul class="cart">' + items.map(function (i) { return '<li><span><strong>' + esc(i.description) + '</strong>' + ((i.quantity || 1) > 1 ? '<small>' + t('ck_qty') + ' ' + i.quantity + ' × ' + esc(money(i.amount_cents, inv.currency)) + '</small>' : '') + '</span><span class="cart__amt">' + esc(money(i.amount_cents * (i.quantity || 1), inv.currency)) + '</span></li>'; }).join('') + '</ul></details>' : '') +
        '<h2 class="portal-h2 ck-card__h" id="ck-pay">' + t('ck_method') + '</h2><p class="portal-muted ck-card__so">' + bt('only') + '</p>' +
        '<form id="ck-form" class="checkout__pay" novalidate><div id="ck-element" class="ck-element"><p class="portal-muted">' + t('ck_loading') + '</p></div><div id="ck-autopay"></div><div class="portal-alert" id="ck-msg" role="alert"></div>' +
        '<button class="btn btn--gold btn--block ck-card__btn" type="submit" id="ck-btn" disabled>' + esc(t('ck_pay', { a: money(inv.total_cents - inv.amount_paid_cents, inv.currency) })) + '</button></form>' +
        '<p class="ck-secure"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg>' + t('ck_secure') + '</p>' +
        (pdf ? '<p style="text-align:center;margin:.25rem 0 0;font-size:.88rem"><a href="' + esc(pdf) + '" target="_blank" rel="noopener">' + t('ck_pdf') + '</a></p>' : '') + '</section></div>';
    if (inv.status === 'paid') { $('#ck-element').innerHTML = '<div class="portal-alert portal-alert--ok" style="display:block">' + t('ck_paidAlready') + '</div>'; return; }
    var cfg;
    try { cfg = await payCall({ action: 'invoice_checkout', invoice_id: id, lang: L }); }
    catch (e) { $('#ck-element').innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">' + esc(t('ck_notReady')) + '</div>'; return; }
    if (cfg.status === 'paid') { ERoute.set('#/invoices?paid=' + id, true); return route(); }
    if (!cfg.ready) { $('#ck-element').innerHTML = '<div class="portal-alert portal-alert--info" style="display:block">' + esc(t('ck_notReady')) + '</div>'; return; }
    // autorização de débito automático: pedida uma vez, no primeiro pagamento
    $('#ck-autopay').innerHTML = cfg.autopay
      ? '<p class="portal-alert portal-alert--ok" style="display:block">' + esc(bt('apActive', { d: fmtDate(cfg.autopay.since), n: cfg.autopay.name })) + '</p>'
      : '<fieldset class="ck-autopay"><legend>' + bt('apTitle') + '</legend><p class="ck-autopay__txt">' + esc(cfg.autopay_text || '') + '</p>' +
        '<label class="ck-autopay__ok"><input type="checkbox" id="ap-ok"> <span>' + bt('apCheck') + '</span></label>' +
        '<div class="field"><label for="ap-name">' + bt('apName') + '</label><input id="ap-name" type="text" autocomplete="name" maxlength="200"></div></fieldset>';
    var StripeCtor = await loadStripeJs();
    var stripe = StripeCtor(cfg.publishable_key, { locale: { pt: 'pt-BR', es: 'es', en: 'en' }[L] || 'auto' });
    var elements = stripe.elements({ mode: 'payment', amount: cfg.amount_due, currency: cfg.currency, paymentMethodTypes: cfg.methods || ['card', 'us_bank_account'],
      appearance: { theme: 'stripe', variables: { colorPrimary: '#0b1f3a', colorText: '#14213d', borderRadius: '8px', fontFamily: 'Inter, system-ui, sans-serif' } } });
    var pe = elements.create('payment', { layout: { type: 'tabs', defaultCollapsed: false }, defaultValues: { billingDetails: { name: S.client.name, email: S.client.primary_email } } });
    $('#ck-element').innerHTML = ''; pe.mount('#ck-element');
    pe.on('ready', function () { $('#ck-btn').disabled = false; });
    $('#ck-form').onsubmit = async function (e) {
      e.preventDefault();
      var btn = $('#ck-btn'), m = $('#ck-msg'), falha = function (txt) { btn.disabled = false; msg(m, txt, 'error'); };
      var autopay = null;
      if (!cfg.autopay) {
        var nome = $('#ap-name').value.trim().replace(/\s+/g, ' ');
        if (!$('#ap-ok').checked || !/\S+\s+\S+/.test(nome) || nome.length < 5) { msg(m, bt('apNeed'), 'error'); ($('#ap-ok').checked ? $('#ap-name') : $('#ap-ok')).focus(); return; }
        autopay = { accept: true, name: nome };
      }
      btn.disabled = true; msg(m, '', 'info');
      var volta = siteUrl('client.html') + '?lang=' + L + '#/invoices?paid=' + id;
      var sub = await elements.submit();
      if (sub.error) return falha(sub.error.message || t('ck_err'));
      var ct = await stripe.createConfirmationToken({ elements: elements, params: { return_url: volta, payment_method_data: { billing_details: { name: S.client.name, email: S.client.primary_email } } } });
      if (ct.error) return falha(t('ck_err') + ': ' + (ct.error.message || ''));
      var r;
      try { r = await payCall({ action: 'invoice_pay', invoice_id: id, confirmation_token: ct.confirmationToken.id, autopay: autopay, lang: L, return_url: volta }); }
      catch (er) { var c = String(er.message || ''); return falha(c === 'credit_not_allowed' ? bt('credit') : c === 'debit_only' ? bt('debitOnly') : c === 'method_not_allowed' ? bt('notAllowed') : c === 'autopay_required' ? bt('apNeed') : t('ck_err')); }
      if (r.status === 'requires_action' && r.client_secret) { var na = await stripe.handleNextAction({ clientSecret: r.client_secret }); if (na.error) return falha(t('ck_err') + ': ' + (na.error.message || '')); r.status = (na.paymentIntent && na.paymentIntent.status) || r.status; }
      var amt = money(inv.total_cents - inv.amount_paid_cents, inv.currency), st = r.status;
      // e-mails: confirmation to the client (auto-response) + notification to the Endeavor team (the webhook also logs it in the admin)
      EP.notify({ _subject: (st === 'succeeded' ? 'Pagamento recebido pelo portal: ' : 'Pagamento iniciado pelo portal: ') + amt + ' · ' + S.client.name, name: S.client.name, email: S.client.primary_email,
        fatura: inv.number || '', valor: amt, status: st || '', _autoresponse: st === 'succeeded' ? t('pay_mail', { n: S.client.name.split(' ')[0], a: amt, i: inv.number || '', l: siteUrl('client.html') + '#/invoices' }).replace(/\\n/g, '\n') : undefined });
      ERoute.set('#/invoices?paid=' + id, true); route();
    };
  }

  async function vSettings(view) {
    var u = (await sb.auth.getUser()).data.user;
    var doisEmails = !!(S.client && S.perms.owner && !PARTNER), e2 = doisEmails ? (S.client.email2 || '') : '';
    var contas = S.client && S.perms.owner && !PARTNER && S.books === 'pacote' && window.ETools && ETools.accounts && S.companies.some(function (c) { return c.books_provider === 'endeavor'; });
    view.innerHTML = head(t('nav_settings'), t('settingsLead')) + '<div class="set-grid"><div>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('account') + '</h2><dl class="kv"><dt>' + (doisEmails ? dx('e_main') : t('email')) + '</dt><dd id="set-email">' + esc(u.email) + '</dd><dt>' + t('lastLogin') + '</dt><dd>' + esc(fmtDT(u.last_sign_in_at)) + '</dd>' +
      '<dt>' + t('yourRole') + '</dt><dd>' + esc(S.perms.owner ? t('owner') : [S.partner ? t('p_partnerLead') : '', S.client ? t('c_' + (S.me.collab_type || 'other')) : ''].filter(Boolean).join(' · ')) + '</dd>' + (PARTNER && S.client ? '<dt>' + t('sharedBy') + '</dt><dd>' + esc(S.client.name) + '</dd><dt>' + t('myAccess') + '</dt><dd>' + esc(EPerms.summary(S.me, permLabels(), S.companies)) + '</dd>' : '') + '<dt>MFA</dt><dd>' + t('mfaOn') + '</dd></dl>' +
      (doisEmails ? '<form class="set-e2" id="e2-form" novalidate><label for="e2-in">' + dx('e_two') + '</label><div class="set-e2__l"><input id="e2-in" type="email" autocomplete="email" maxlength="200" value="' + esc(e2) + '" aria-describedby="e2-h"><button class="btn btn--navy btn--sm" type="submit">' + dx('e_save') + '</button>' +
        (e2 ? '<button class="btn btn--ghost btn--sm" type="button" id="e2-del">' + dx('e_remove') + '</button>' : '') + '</div><p class="portal-muted set-e2__h" id="e2-h">' + dx('e_twoHint') + '</p>' +
        (e2 ? '<button class="btn btn--ghost btn--xs" type="button" id="e2-make">' + dx('e_make') + '</button>' : '') +
        '<div class="portal-alert" id="e2-m" role="status"></div></form>' : '') + '</section></div><div>' + (contas ? '<section class="portal-card" id="set-contas"></section>' : '') +
      '<section class="portal-card"><h2 class="portal-h2">' + t('changePass') + '</h2><form class="portal-form" id="pw"><div class="field"><label for="pw-n">' + t('newPass') + '</label><input id="pw-n" type="password" autocomplete="new-password" minlength="8" required></div>' +
      '<div class="portal-alert" id="pw-m" role="status"></div><button class="btn btn--navy" type="submit" style="justify-self:start">' + t('savePass') + '</button></form></section></div></div>';
    // contas que alimentam o bookkeeping incluído no pacote (quem comprou a ferramenta avulsa conecta dentro dela)
    if (contas) ETools.accounts($('#set-contas', view));
    if (doisEmails) {
      var gravaE2 = async function (v) {
        var r = await sb.rpc('client_set_email2', { p_client: S.client.id, p_email: v });
        if (r.error) return msg($('#e2-m'), /same_as_primary|invalid_email/.test(r.error.message || '') ? dx('e_bad') : errText(r.error), 'error');
        S.client.email2 = v || null; await vSettings(view); msg($('#e2-m'), dx(v ? 'e_saved' : 'e_removed'), 'ok');
      };
      $('#e2-form').onsubmit = function (e) {
        e.preventDefault(); var v = $('#e2-in').value.trim().toLowerCase();
        if (!v) return e2 ? gravaE2('') : msg($('#e2-m'), dx('e_bad'), 'error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || v === String(u.email).toLowerCase()) return msg($('#e2-m'), dx('e_bad'), 'error');
        gravaE2(v);
      };
      if ($('#e2-del')) $('#e2-del').onclick = function () { gravaE2(''); };
      if ($('#e2-make')) {
        $('#e2-make').onclick = function () {
          openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + dx('e_make') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div><div id="e2-troca"><p style="margin:0 0 .9rem">' + esc(dx('e_makeLead', { e: e2 })) + '</p>' +
            '<div class="field"><label for="e2-pass">' + dx('e_pass') + '</label><input id="e2-pass" type="password" autocomplete="current-password"></div><div class="portal-alert" id="e2-tm" role="alert"></div>' +
            '<div class="portal-btn-row" style="justify-content:flex-end"><button class="btn btn--navy" type="button" id="e2-go">' + dx('e_send') + '</button></div></div>', true);
          $('#e2-pass').focus(); $('#e2-go').onclick = trocar;
        };
        // troca do login: confere a senha atual e pede a confirmação no e-mail novo; o login só muda depois do clique
        var trocar = async function () {
          var b = this, pw = $('#e2-pass').value, m = $('#e2-tm'); if (!pw) return msg(m, dx('e_wrong'), 'error');
          b.disabled = true;
          try {
            var tmp = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'endeavor-check-tmp' } });
            var ck = await tmp.auth.signInWithPassword({ email: u.email, password: pw });
            if (ck.error || !ck.data.session) { b.disabled = false; return msg(m, dx('e_wrong'), 'error'); }
            tmp.auth.signOut({ scope: 'local' }).catch(function () {});
            var back = 'https://endeavorbiz.com/login.html'; try { if (/^https?:/.test(location.protocol)) back = new URL('login.html', location.href).href.split(/[?#]/)[0]; } catch (e0) { /* ignore */ }
            var r = await sb.auth.updateUser({ email: e2 }, { emailRedirectTo: back + '?lang=' + L });
            if (r.error) { b.disabled = false; return msg(m, dx('e_fail'), 'error'); }
            closeOverlay(); msg($('#e2-m'), dx('e_sent', { e: e2, o: u.email }), 'ok');
          } catch (er) { b.disabled = false; msg(m, dx('e_fail'), 'error'); }
        };
      }
    }
    $('#pw').onsubmit = async function (e) {
      e.preventDefault(); var p = $('#pw-n').value; if (p.length < 8) return msg($('#pw-m'), t('passShort'), 'error');
      var r = await sb.auth.updateUser({ password: p }); msg($('#pw-m'), r.error ? errText(r.error) : t('passChanged'), r.error ? 'error' : 'ok');
    };
  }

  boot();
})();
