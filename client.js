/* Endeavor client portal: companies, documents, tax compliance, QuickBooks reports, uploads and collaborators. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'endeavor-client-auth' } });
  var app = document.getElementById('app');

  /* ---------------- i18n ---------------- */
  var D = {
    en: {
      loading: 'Loading…', signOut: 'Sign out', menu: 'Menu', closeMenu: 'Close menu',
      portal: 'Client Portal', loginTitle: 'Client portal', loginLead: 'Access your companies, documents and deadlines.', email: 'Email', password: 'Password',
      signIn: 'Sign in', firstAccess: 'First access: create password', forgot: 'Forgot password', newPass: 'New password (12+ characters)', savePass: 'Save password',
      badLogin: 'Incorrect email or password.', notConfirmed: 'Confirm your email using the link we sent, then sign in.', noInvite: 'This email does not have an invitation. Please contact Endeavor at support@endeavorbiz.com.',
      passShort: 'Use at least 12 characters in the Password field.', created: 'Account created. Open the confirmation email sent to {e}, click the link and then sign in here.',
      resetSent: 'If this email is registered, you will receive a link to create a new password.', mfaTitle: 'Two-step verification', mfaLead: 'Enter the 6-digit code from your authenticator app.',
      code: 'Code', verify: 'Verify', badCode: 'Invalid code. Check your phone time and try again.', enrollTitle: 'Turn on two-step verification',
      enrollLead: 'Required to protect your tax and company documents. Scan the QR code with Google Authenticator, Microsoft Authenticator or 1Password and enter the code.',
      noCamera: 'No camera? Enter this key in the app:', activate: 'Activate and continue', noAccess: 'No active access', noAccessText: 'Your account is not linked to an active client portal. If you received an invitation, confirm you used the same email. Questions: support@endeavorbiz.com.',
      nav_overview: 'Overview', nav_companies: 'My Companies', nav_documents: 'Documents', nav_compliance: 'Tax Compliance', nav_reports: 'Financial Reports', nav_upload: 'Upload Documents', nav_collab: 'Collaborators', nav_settings: 'Settings',
      account: 'Account', hello: 'Hello, {n}', overviewLead: 'Everything about your U.S. companies in one place.',
      k_companies: 'Companies', k_next: 'Next deadline', k_docs: 'Documents', k_reports: 'Financial reports', none: 'None',
      nextDeadlines: 'Next deadlines', recentDocs: 'Recent documents', seeAll: 'See all', quick: 'Quick actions', qUpload: 'Upload documents for your tax return', qInvite: 'Invite your accountant or bookkeeper', qQbo: 'Connect QuickBooks',
      noCompanies: 'No companies yet', noCompaniesText: 'Endeavor will add your companies here.', formed: 'Formed {d}', docNumber: 'Florida document no.', ein: 'EIN', agent: 'Registered agent', fye: 'Fiscal year end', address: 'Address',
      st_active: 'Active', st_in_formation: 'In formation', st_inactive: 'Inactive', st_dissolved: 'Dissolved',
      tab_docs: 'Documents', tab_deadlines: 'Deadlines', tab_finance: 'QuickBooks & reports', back: 'My Companies',
      cat_formation: 'Formation', cat_tax_return: 'Tax return', cat_report: 'Financial report', cat_uploaded: 'Uploaded', cat_compliance: 'Compliance', cat_other: 'Other',
      allCompanies: 'All companies', allCategories: 'All categories', search: 'Search…', view: 'View', download: 'Download', print: 'Print', close: 'Close',
      noDocs: 'No documents yet', noPreview: 'Preview not available for this file type. Use Download.', viewErr: 'Could not open the file.',
      overdue: 'Overdue by {n} d', dueIn: 'In {n} d', dueToday: 'Due today', done: 'Completed', na: 'Not applicable', inProgress: 'In progress',
      complianceLead: 'Federal and state filing dates for your companies. Endeavor updates this calendar; confirm details with your CPA.', showDone: 'Show completed', addCal: 'Add to my calendar (.ics)', noDeadlines: 'No pending deadlines',
      dl_annual_report: 'Annual report', dl_federal_tax: 'Federal tax', dl_state_tax: 'State tax', dl_payroll: 'Payroll', dl_sales_tax: 'Sales tax', dl_boi: 'BOI', dl_license: 'License', dl_other: 'Other',
      reportsLead: 'Profit and Loss, Balance Sheet and Cash Flow generated from your QuickBooks Online, ready to view, print or save as PDF.',
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
      loading: 'Carregando…', signOut: 'Sair', menu: 'Menu', closeMenu: 'Fechar menu',
      portal: 'Portal do Cliente', loginTitle: 'Portal do cliente', loginLead: 'Acesse suas empresas, documentos e prazos.', email: 'E-mail', password: 'Senha',
      signIn: 'Entrar', firstAccess: 'Primeiro acesso: criar senha', forgot: 'Esqueci a senha', newPass: 'Nova senha (mín. 12 caracteres)', savePass: 'Salvar senha',
      badLogin: 'E-mail ou senha incorretos.', notConfirmed: 'Confirme o seu e-mail pelo link que enviamos e depois entre.', noInvite: 'Este e-mail não tem convite. Fale com a Endeavor pelo support@endeavorbiz.com.',
      passShort: 'Use pelo menos 12 caracteres no campo Senha.', created: 'Conta criada. Abra o e-mail de confirmação enviado para {e}, clique no link e depois entre aqui.',
      resetSent: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.', mfaTitle: 'Verificação em duas etapas', mfaLead: 'Digite o código de 6 dígitos do seu aplicativo autenticador.',
      code: 'Código', verify: 'Verificar', badCode: 'Código inválido. Confira o horário do celular e tente de novo.', enrollTitle: 'Ative a verificação em duas etapas',
      enrollLead: 'Obrigatória para proteger seus documentos fiscais e da empresa. Escaneie o QR code com Google Authenticator, Microsoft Authenticator ou 1Password e digite o código.',
      noCamera: 'Sem câmera? Digite esta chave no app:', activate: 'Ativar e continuar', noAccess: 'Sem acesso ativo', noAccessText: 'Sua conta não está ligada a um portal de cliente ativo. Se você recebeu um convite, confira se usou o mesmo e-mail. Dúvidas: support@endeavorbiz.com.',
      nav_overview: 'Visão geral', nav_companies: 'Minhas empresas', nav_documents: 'Documentos', nav_compliance: 'Prazos fiscais', nav_reports: 'Relatórios financeiros', nav_upload: 'Enviar documentos', nav_collab: 'Colaboradores', nav_settings: 'Configurações',
      account: 'Conta', hello: 'Olá, {n}', overviewLead: 'Tudo sobre as suas empresas nos EUA em um só lugar.',
      k_companies: 'Empresas', k_next: 'Próximo prazo', k_docs: 'Documentos', k_reports: 'Relatórios financeiros', none: 'Nenhum',
      nextDeadlines: 'Próximos prazos', recentDocs: 'Documentos recentes', seeAll: 'Ver todos', quick: 'Ações rápidas', qUpload: 'Enviar documentos para o imposto', qInvite: 'Convidar seu contador ou bookkeeper', qQbo: 'Conectar QuickBooks',
      noCompanies: 'Nenhuma empresa ainda', noCompaniesText: 'A Endeavor vai adicionar suas empresas aqui.', formed: 'Constituída em {d}', docNumber: 'Nº do documento na Flórida', ein: 'EIN', agent: 'Registered agent', fye: 'Fim do ano fiscal', address: 'Endereço',
      st_active: 'Ativa', st_in_formation: 'Em formação', st_inactive: 'Inativa', st_dissolved: 'Dissolvida',
      tab_docs: 'Documentos', tab_deadlines: 'Prazos', tab_finance: 'QuickBooks e relatórios', back: 'Minhas empresas',
      cat_formation: 'Formação', cat_tax_return: 'Declaração de imposto', cat_report: 'Relatório financeiro', cat_uploaded: 'Enviado', cat_compliance: 'Compliance', cat_other: 'Outro',
      allCompanies: 'Todas as empresas', allCategories: 'Todas as categorias', search: 'Buscar…', view: 'Ver', download: 'Baixar', print: 'Imprimir', close: 'Fechar',
      noDocs: 'Nenhum documento ainda', noPreview: 'Pré-visualização indisponível para este tipo de arquivo. Use Baixar.', viewErr: 'Não foi possível abrir o arquivo.',
      overdue: 'Vencido há {n} d', dueIn: 'Em {n} d', dueToday: 'Vence hoje', done: 'Concluído', na: 'Não se aplica', inProgress: 'Em andamento',
      complianceLead: 'Datas de entrega federais e estaduais das suas empresas. A Endeavor atualiza este calendário; confirme os detalhes com o seu contador.', showDone: 'Mostrar concluídos', addCal: 'Adicionar ao meu calendário (.ics)', noDeadlines: 'Nenhum prazo pendente',
      dl_annual_report: 'Annual report', dl_federal_tax: 'Imposto federal', dl_state_tax: 'Imposto estadual', dl_payroll: 'Folha', dl_sales_tax: 'Sales tax', dl_boi: 'BOI', dl_license: 'Licença', dl_other: 'Outro',
      reportsLead: 'Demonstração de resultados (P&L), balanço patrimonial e fluxo de caixa gerados do seu QuickBooks Online, prontos para ver, imprimir ou salvar em PDF.',
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
      loading: 'Cargando…', signOut: 'Salir', menu: 'Menú', closeMenu: 'Cerrar menú',
      portal: 'Portal del Cliente', loginTitle: 'Portal del cliente', loginLead: 'Acceda a sus empresas, documentos y plazos.', email: 'Correo', password: 'Contraseña',
      signIn: 'Ingresar', firstAccess: 'Primer acceso: crear contraseña', forgot: 'Olvidé mi contraseña', newPass: 'Nueva contraseña (mín. 12 caracteres)', savePass: 'Guardar contraseña',
      badLogin: 'Correo o contraseña incorrectos.', notConfirmed: 'Confirme su correo con el enlace que enviamos y luego ingrese.', noInvite: 'Este correo no tiene invitación. Contacte a Endeavor en support@endeavorbiz.com.',
      passShort: 'Use al menos 12 caracteres en el campo Contraseña.', created: 'Cuenta creada. Abra el correo de confirmación enviado a {e}, haga clic en el enlace y luego ingrese aquí.',
      resetSent: 'Si el correo está registrado, recibirá un enlace para crear una nueva contraseña.', mfaTitle: 'Verificación en dos pasos', mfaLead: 'Ingrese el código de 6 dígitos de su app autenticadora.',
      code: 'Código', verify: 'Verificar', badCode: 'Código inválido. Revise la hora del celular e intente de nuevo.', enrollTitle: 'Active la verificación en dos pasos',
      enrollLead: 'Obligatoria para proteger sus documentos fiscales y de la empresa. Escanee el código QR con Google Authenticator, Microsoft Authenticator o 1Password e ingrese el código.',
      noCamera: '¿Sin cámara? Ingrese esta clave en la app:', activate: 'Activar y continuar', noAccess: 'Sin acceso activo', noAccessText: 'Su cuenta no está vinculada a un portal de cliente activo. Si recibió una invitación, confirme que usó el mismo correo. Dudas: support@endeavorbiz.com.',
      nav_overview: 'Resumen', nav_companies: 'Mis empresas', nav_documents: 'Documentos', nav_compliance: 'Plazos fiscales', nav_reports: 'Reportes financieros', nav_upload: 'Enviar documentos', nav_collab: 'Colaboradores', nav_settings: 'Configuración',
      account: 'Cuenta', hello: 'Hola, {n}', overviewLead: 'Todo sobre sus empresas en EE. UU. en un solo lugar.',
      k_companies: 'Empresas', k_next: 'Próximo plazo', k_docs: 'Documentos', k_reports: 'Reportes financieros', none: 'Ninguno',
      nextDeadlines: 'Próximos plazos', recentDocs: 'Documentos recientes', seeAll: 'Ver todos', quick: 'Acciones rápidas', qUpload: 'Enviar documentos para el impuesto', qInvite: 'Invitar a su contador o bookkeeper', qQbo: 'Conectar QuickBooks',
      noCompanies: 'Aún no hay empresas', noCompaniesText: 'Endeavor agregará sus empresas aquí.', formed: 'Constituida el {d}', docNumber: 'N.º de documento en Florida', ein: 'EIN', agent: 'Registered agent', fye: 'Cierre del año fiscal', address: 'Dirección',
      st_active: 'Activa', st_in_formation: 'En constitución', st_inactive: 'Inactiva', st_dissolved: 'Disuelta',
      tab_docs: 'Documentos', tab_deadlines: 'Plazos', tab_finance: 'QuickBooks y reportes', back: 'Mis empresas',
      cat_formation: 'Constitución', cat_tax_return: 'Declaración de impuestos', cat_report: 'Reporte financiero', cat_uploaded: 'Enviado', cat_compliance: 'Cumplimiento', cat_other: 'Otro',
      allCompanies: 'Todas las empresas', allCategories: 'Todas las categorías', search: 'Buscar…', view: 'Ver', download: 'Descargar', print: 'Imprimir', close: 'Cerrar',
      noDocs: 'Aún no hay documentos', noPreview: 'Vista previa no disponible para este tipo de archivo. Use Descargar.', viewErr: 'No se pudo abrir el archivo.',
      overdue: 'Vencido hace {n} d', dueIn: 'En {n} d', dueToday: 'Vence hoy', done: 'Completado', na: 'No aplica', inProgress: 'En curso',
      complianceLead: 'Fechas de presentación federales y estatales de sus empresas. Endeavor actualiza este calendario; confirme los detalles con su contador.', showDone: 'Mostrar completados', addCal: 'Agregar a mi calendario (.ics)', noDeadlines: 'No hay plazos pendientes',
      dl_annual_report: 'Annual report', dl_federal_tax: 'Impuesto federal', dl_state_tax: 'Impuesto estatal', dl_payroll: 'Nómina', dl_sales_tax: 'Sales tax', dl_boi: 'BOI', dl_license: 'Licencia', dl_other: 'Otro',
      reportsLead: 'Estado de resultados (P&L), balance general y flujo de caja generados desde su QuickBooks Online, listos para ver, imprimir o guardar en PDF.',
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
  function t(k, vars) { var s = (D[L] && D[L][k] != null) ? D[L][k] : (D.en[k] != null ? D.en[k] : k); if (vars) Object.keys(vars).forEach(function (v) { s = s.replace('{' + v + '}', vars[v]); }); return s; }
  document.getElementById('btn-signout').textContent = t('signOut');
  document.title = t('portal') + ' | Endeavor Business Solutions';

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
    if (D.en[m]) return t(m);
    return m || t('generic');
  }
  async function q(p) { var r = await p; if (r.error) throw r.error; return r.data; }
  function fmtDate(d) { if (!d) return ''; return new Intl.DateTimeFormat(EP.locale, { dateStyle: 'medium' }).format(new Date(d.length === 10 ? d + 'T12:00:00' : d)); }
  function fmtDT(d) { return d ? new Intl.DateTimeFormat(EP.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : ''; }
  function daysUntil(d) { var n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((new Date(d + 'T00:00:00') - n) / 864e5); }
  function siteUrl(f) { return new URL(f, location.href).href.split('#')[0]; }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function slug(s) { return String(s).normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(0, 80); }
  async function sha256Hex(buf) { var d = await crypto.subtle.digest('SHA-256', buf); return Array.prototype.map.call(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function fileIcon(p) { return ((p.match(/\.([a-z0-9]+)$/i) || ['', 'doc'])[1]).toUpperCase().slice(0, 4); }
  function pill(it) {
    if (it.status === 'done') return '<span class="pill pill--done">' + t('done') + '</span>';
    if (it.status === 'not_applicable') return '<span class="pill">' + t('na') + '</span>';
    var n = daysUntil(it.due_date);
    if (n < 0) return '<span class="pill pill--overdue">' + t('overdue', { n: -n }) + '</span>';
    if (n === 0) return '<span class="pill pill--overdue">' + t('dueToday') + '</span>';
    return '<span class="pill' + (n <= 30 ? ' pill--soon' : '') + '">' + t('dueIn', { n: n }) + '</span>';
  }
  function deadlineRow(it, co) {
    var p = it.due_date.split('-'), mon = new Intl.DateTimeFormat(EP.locale, { month: 'short' }).format(new Date(+p[0], +p[1] - 1, 15)).replace('.', '');
    return '<div class="deadline"><div class="deadline__date"><b>' + p[2] + '</b><span>' + esc(mon) + ' ' + p[0] + '</span></div>' +
      '<div><strong>' + esc(it.title) + '</strong><div class="portal-muted" style="font-size:.85rem">' + esc(co ? co.legal_name : '') + ' · ' + esc(t('dl_' + it.category)) + (it.notes ? ' · ' + esc(it.notes) : '') + '</div></div>' + pill(it) + '</div>';
  }

  /* ---------------- auth ---------------- */
  var S = { memberships: [], client: null, role: null, perms: {}, companies: [], user: null };
  var recovery = false;
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') { recovery = true; renderNewPassword(); } });
  $('#btn-signout').onclick = async function () { await sb.auth.signOut(); location.hash = ''; location.reload(); };

  function authShell(html) {
    document.body.classList.remove('app-shell'); $('#topbar-user').hidden = true; $('#nav-toggle').hidden = true;
    app.innerHTML = '<main class="portal-main"><div class="auth portal-card">' + html + '</div></main>';
  }
  async function boot() {
    if (recovery) return;
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return renderLogin();
    S.user = s.user;
    $('#topbar-user').hidden = false; $('#topbar-email').textContent = s.user.email;
    var aal = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    if (!aal || aal.currentLevel !== 'aal2') return renderMfa();
    var mem = await sb.rpc('claim_invitations');
    S.memberships = mem.data || [];
    if (!S.memberships.length) return authShell('<h1 class="portal-h1">' + t('noAccess') + '</h1><p>' + t('noAccessText') + '</p><button class="btn btn--navy" id="na-out" type="button">' + t('signOut') + '</button>'), ($('#na-out').onclick = function () { $('#btn-signout').click(); });
    var saved = null; try { saved = localStorage.getItem('endeavor-client-id'); } catch (e) { /* ignore */ }
    var m = S.memberships.find(function (x) { return x.client_id === saved; }) || S.memberships[0];
    await selectClient(m.client_id);
    startShell();
  }
  async function selectClient(id) {
    S.client = (await q(sb.from('clients').select('*').eq('id', id).single()));
    var me = (await q(sb.from('client_users').select('*').eq('client_id', id).eq('user_id', S.user.id).eq('status', 'active')))[0] || {};
    S.role = me.role; S.me = me;
    S.perms = { view: me.role === 'owner' || !!me.can_view, upload: me.role === 'owner' || !!me.can_upload, owner: me.role === 'owner' };
    S.companies = await q(sb.from('companies').select('*').eq('client_id', id).order('legal_name'));
    try { localStorage.setItem('endeavor-client-id', id); } catch (e) { /* ignore */ }
  }

  function renderLogin() {
    authShell('<h1 class="portal-h1">' + t('loginTitle') + '</h1><p class="portal-muted">' + t('loginLead') + '</p>' +
      '<form class="portal-form" id="f-login" novalidate><div class="field"><label for="l-email">' + t('email') + '</label><input id="l-email" type="email" autocomplete="username" required></div>' +
      '<div class="field"><label for="l-pass">' + t('password') + '</label><input id="l-pass" type="password" autocomplete="current-password" required></div>' +
      '<div class="portal-alert" id="l-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('signIn') + '</button>' +
      '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="l-first">' + t('firstAccess') + '</button><button class="btn btn--ghost btn--xs" type="button" id="l-forgot">' + t('forgot') + '</button></div></form>');
    var m = $('#l-msg');
    $('#f-login').onsubmit = async function (e) {
      e.preventDefault(); msg(m, t('loading'), 'info');
      var r = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
      if (r.error) return msg(m, errText(r.error), 'error');
      boot();
    };
    $('#l-first').onclick = async function () {
      var email = $('#l-email').value.trim().toLowerCase(), pass = $('#l-pass').value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg(m, t('fillNameEmail'), 'error');
      if (pass.length < 12) return msg(m, t('passShort'), 'error');
      var r = await sb.auth.signUp({ email: email, password: pass, options: { emailRedirectTo: siteUrl('client.html') } });
      if (r.error) return msg(m, errText(r.error), 'error');
      if (r.data.session) return boot();
      msg(m, t('created', { e: email }), 'ok');
    };
    $('#l-forgot').onclick = async function () {
      var r = await sb.auth.resetPasswordForEmail($('#l-email').value.trim(), { redirectTo: siteUrl('client.html') });
      msg(m, r.error ? errText(r.error) : t('resetSent'), r.error ? 'error' : 'ok');
    };
  }
  function renderNewPassword() {
    authShell('<h1 class="portal-h1">' + t('newPass') + '</h1><form class="portal-form" id="f-np"><div class="field"><label for="np">' + t('newPass') + '</label><input id="np" type="password" autocomplete="new-password" minlength="12" required></div>' +
      '<div class="portal-alert" id="np-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('savePass') + '</button></form>');
    $('#f-np').onsubmit = async function (e) {
      e.preventDefault(); var p = $('#np').value;
      if (p.length < 12) return msg($('#np-msg'), t('passShort'), 'error');
      var r = await sb.auth.updateUser({ password: p });
      if (r.error) return msg($('#np-msg'), errText(r.error), 'error');
      recovery = false; history.replaceState(null, '', location.pathname + location.search); boot();
    };
  }
  async function renderMfa() {
    var f = (await sb.auth.mfa.listFactors()).data || { totp: [], all: [] };
    var ok = (f.totp || []).filter(function (x) { return x.status === 'verified'; });
    if (ok.length) {
      authShell('<h1 class="portal-h1">' + t('mfaTitle') + '</h1><p class="portal-muted">' + t('mfaLead') + '</p><form class="portal-form" id="f-mfa"><div class="field"><label for="mfa-code">' + t('code') + '</label><input id="mfa-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
        '<div class="portal-alert" id="mfa-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('verify') + '</button></form>');
      $('#mfa-code').focus();
      $('#f-mfa').onsubmit = async function (e) { e.preventDefault(); var r = await sb.auth.mfa.challengeAndVerify({ factorId: ok[0].id, code: $('#mfa-code').value.trim() }); if (r.error) return msg($('#mfa-msg'), errText(r.error), 'error'); boot(); };
      return;
    }
    for (var i = 0; i < (f.all || []).length; i++) if (f.all[i].status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.all[i].id });
    var en = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Endeavor Portal ' + new Date().toISOString().slice(0, 10) });
    if (en.error) return authShell('<div class="portal-alert portal-alert--error">' + esc(errText(en.error)) + '</div>');
    authShell('<h1 class="portal-h1">' + t('enrollTitle') + '</h1><p class="portal-muted">' + t('enrollLead') + '</p><div class="auth__qr"><img alt="QR code" src="' + esc(en.data.totp.qr_code) + '"></div>' +
      '<p class="portal-muted">' + t('noCamera') + ' <span class="mono">' + esc(en.data.totp.secret) + '</span></p><form class="portal-form" id="f-en"><div class="field"><label for="en-code">' + t('code') + '</label><input id="en-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
      '<div class="portal-alert" id="en-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">' + t('activate') + '</button></form>');
    $('#f-en').onsubmit = async function (e) { e.preventDefault(); var r = await sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: $('#en-code').value.trim() }); if (r.error) return msg($('#en-msg'), errText(r.error), 'error'); boot(); };
  }

  /* ---------------- shell ---------------- */
  function navItems() {
    var n = [['overview', 'nav_overview', 'i-grid'], ['companies', 'nav_companies', 'i-brief']];
    if (S.perms.view) n.push(['documents', 'nav_documents', 'i-file']);
    n.push(['compliance', 'nav_compliance', 'i-cal']);
    if (S.perms.view) n.push(['reports', 'nav_reports', 'i-chart']);
    if (S.perms.upload) n.push(['upload', 'nav_upload', 'i-up']);
    if (S.perms.owner) n.push(['collaborators', 'nav_collab', 'i-users']);
    n.push(['settings', 'nav_settings', 'i-gear']);
    return n;
  }
  function startShell() {
    document.body.classList.add('app-shell');
    var multi = S.memberships.length > 1;
    app.innerHTML = '<div class="console" id="console"><nav class="console__nav" id="console-nav" aria-label="' + t('portal') + '">' +
      '<div class="console__nav-title">' + t('portal') + '</div>' +
      (multi ? '<div style="padding:0 .5rem .75rem"><label for="cl-switch" class="sr-only">' + t('switchClient') + '</label><select id="cl-switch" style="width:100%;min-height:2.4rem;border-radius:8px;border:0;padding:0 .5rem">' +
        S.memberships.map(function (m) { return '<option value="' + m.client_id + '"' + (m.client_id === S.client.id ? ' selected' : '') + '>' + esc(m.client_name) + '</option>'; }).join('') + '</select></div>'
        : '<div style="padding:0 .85rem .75rem;color:#fff;font-weight:600">' + esc(S.client.name) + '</div>') +
      '<ul>' + navItems().map(function (n) { return '<li><a href="#/' + n[0] + '" data-view="' + n[0] + '"><svg class="icon" aria-hidden="true"><use href="#' + n[2] + '"/></svg>' + t(n[1]) + '</a></li>'; }).join('') + '</ul>' +
      '<div class="console__nav-foot">Endeavor Business Solutions<br>support@endeavorbiz.com</div></nav><div class="nav-backdrop" id="nav-backdrop"></div>' +
      '<main class="console__content" id="view" tabindex="-1"></main></div><div class="overlay" id="overlay" hidden></div>';
    var tgl = $('#nav-toggle'), con = $('#console');
    tgl.hidden = false;
    function setNav(o) { con.classList.toggle('nav-open', o); tgl.setAttribute('aria-expanded', String(o)); tgl.setAttribute('aria-label', o ? t('closeMenu') : t('menu')); }
    tgl.onclick = function () { setNav(!con.classList.contains('nav-open')); };
    $('#nav-backdrop').onclick = function () { setNav(false); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && con.classList.contains('nav-open')) { setNav(false); tgl.focus(); } });
    if ($('#cl-switch')) $('#cl-switch').onchange = async function () { await selectClient(this.value); startShell(); };
    window.onhashchange = function () { setNav(false); route(); };
    route();
  }
  function route() {
    var h = location.hash.replace(/^#\/?/, ''), v = h.split('?')[0] || 'overview';
    var allowed = navItems().map(function (n) { return n[0]; });
    if (allowed.indexOf(v) < 0) v = 'overview';
    $$('.console__nav a').forEach(function (a) { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var view = $('#view'); view.innerHTML = '<p class="portal-muted">' + t('loading') + '</p>'; view.scrollTop = 0;
    var V = { overview: vOverview, companies: vCompanies, documents: vDocuments, compliance: vCompliance, reports: vReports, upload: vUpload, collaborators: vCollab, settings: vSettings };
    V[v](view).catch(function (e) { view.innerHTML = '<div class="portal-alert portal-alert--error">' + esc(errText(e)) + '</div>'; console.error(e); });
  }
  function param(k) { var m = location.hash.match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; }
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
  function logAccess(doc, action) { sb.from('doc_access_log').insert({ document_id: doc.id, action: action }).then(function () {}); }
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
      return '<li><span class="ficon" aria-hidden="true">' + fileIcon(d.path) + '</span><div><div class="dname">' + esc(d.title) + (d.year ? ' (' + d.year + ')' : '') + '</div>' +
        '<div class="dmeta"><span class="pill pill--' + d.category + '">' + esc(t('cat_' + d.category)) + '</span> ' + (showCompany && co ? esc(co.legal_name) + ' · ' : '') + esc(fmtDate(d.created_at)) +
        (d.category === 'uploaded' && d.uploaded_by_email ? ' · ' + esc(t('uploadedBy', { e: d.uploaded_by_email })) : '') + '</div></div>' +
        '<button class="btn btn--ghost btn--xs" type="button" data-doc="' + d.id + '">' + t('view') + '</button></li>';
    }).join('') + '</ul>';
  }
  function wireDocs(root, docs) { $$('[data-doc]', root).forEach(function (b) { b.onclick = function () { viewDoc(docs.find(function (d) { return d.id === b.dataset.doc; })); }; }); }

  /* ---------------- views ---------------- */
  async function vOverview(view) {
    var cid = S.client.id;
    var res = await Promise.all([
      q(sb.from('compliance_items').select('*').eq('client_id', cid).in('status', ['pending', 'in_progress']).order('due_date').limit(6)),
      S.perms.view ? q(sb.from('company_documents').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(6)) : Promise.resolve([]),
      S.perms.view ? sb.from('company_documents').select('id', { count: 'exact', head: true }).eq('client_id', cid) : Promise.resolve({ count: 0 }),
      S.perms.view ? sb.from('company_documents').select('id', { count: 'exact', head: true }).eq('client_id', cid).eq('category', 'report') : Promise.resolve({ count: 0 })
    ]);
    var next = res[0][0];
    var first = (S.me && S.me.name ? S.me.name : S.client.name).split(' ')[0];
    view.innerHTML = head(t('hello', { n: first }), t('overviewLead')) +
      '<div class="dash"><div><div class="kpis">' +
        kpi(t('k_companies'), S.companies.length) + kpi(t('k_next'), next ? fmtDate(next.due_date) : t('none'), true) + kpi(t('k_docs'), res[2].count || 0) + kpi(t('k_reports'), res[3].count || 0) + '</div>' +
        '<section class="portal-card" style="margin-top:1.25rem"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + t('nextDeadlines') + '</h2><a href="#/compliance">' + t('seeAll') + '</a></div>' +
          (res[0].length ? res[0].map(function (i) { return deadlineRow(i, coById(i.company_id)); }).join('') : '<div class="empty-state"><strong>' + t('noDeadlines') + '</strong></div>') + '</section>' +
        (S.perms.view ? '<section class="portal-card"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + t('recentDocs') + '</h2><a href="#/documents">' + t('seeAll') + '</a></div>' + docItems(res[1], true) + '</section>' : '') +
      '</div><aside class="links-panel portal-card"><h2 class="portal-h2">' + t('quick') + '</h2><ul>' +
        (S.perms.upload ? '<li><a href="#/upload"><svg class="icon" aria-hidden="true"><use href="#i-up"/></svg>' + t('qUpload') + '</a></li>' : '') +
        (S.perms.owner ? '<li><a href="#/collaborators?invite=1"><svg class="icon" aria-hidden="true"><use href="#i-users"/></svg>' + t('qInvite') + '</a></li><li><a href="#/reports"><svg class="icon" aria-hidden="true"><use href="#i-chart"/></svg>' + t('qQbo') + '</a></li>' : '') +
        '<li><a href="#/companies"><svg class="icon" aria-hidden="true"><use href="#i-brief"/></svg>' + t('nav_companies') + '</a></li>' +
      '</ul><p class="portal-muted" style="font-size:.8rem;margin-top:1rem">' + t('privacyNote') + '</p></aside></div>';
    wireDocs(view, res[1]);
  }
  function kpi(l, v, small) { return '<div class="kpi"><div class="kpi__label">' + esc(l) + '</div><div class="kpi__value"' + (small ? ' style="font-size:1.35rem;padding-top:.35rem"' : '') + '>' + esc(v) + '</div></div>'; }

  async function vCompanies(view) {
    var id = param('id');
    if (id && coById(id)) return companyDetail(view, coById(id));
    view.innerHTML = head(t('nav_companies'), '') + (S.companies.length ? '<div class="cards">' + S.companies.map(function (c) {
      return '<a class="co-card" href="#/companies?id=' + c.id + '"><h3>' + esc(c.legal_name) + '</h3><div class="meta">' + esc(c.state || '') + (c.formation_date ? ' · ' + esc(t('formed', { d: fmtDate(c.formation_date) })) : '') + '</div>' +
        '<div class="row"><span>' + (c.ein ? 'EIN ' + esc(c.ein) : '') + '</span><span class="pill' + (c.status === 'active' ? ' pill--done' : '') + '">' + esc(t('st_' + c.status)) + '</span></div></a>';
    }).join('') + '</div>' : '<div class="portal-card empty-state"><strong>' + t('noCompanies') + '</strong>' + t('noCompaniesText') + '</div>');
  }
  async function companyDetail(view, co) {
    var tab = param('tab') || (S.perms.view ? 'docs' : 'deadlines');
    var tabs = [];
    if (S.perms.view) tabs.push(['docs', t('tab_docs')]);
    tabs.push(['deadlines', t('tab_deadlines')]);
    if (S.perms.view) tabs.push(['finance', t('tab_finance')]);
    var kv = [[t('docNumber'), co.document_number], [t('ein'), co.ein], [t('agent'), co.registered_agent], [t('fye'), co.fiscal_year_end], [t('address'), co.address]].filter(function (x) { return x[1]; });
    view.innerHTML = '<p class="crumbs"><a href="#/companies">' + t('back') + '</a> /</p>' + head(co.legal_name, (co.state || '') + (co.formation_date ? ' · ' + t('formed', { d: fmtDate(co.formation_date) }) : '') + ' · ' + t('st_' + co.status)) +
      (kv.length ? '<section class="portal-card"><dl class="kv">' + kv.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></section>' : '') +
      '<nav class="subtabs" style="margin-top:1.25rem" aria-label="' + esc(co.legal_name) + '">' + tabs.map(function (x) { return '<a href="#/companies?id=' + co.id + '&tab=' + x[0] + '"' + (x[0] === tab ? ' aria-current="page"' : '') + '>' + esc(x[1]) + '</a>'; }).join('') + '</nav><div id="co-body"></div>';
    var body = $('#co-body', view);
    if (tab === 'docs' && S.perms.view) {
      var docs = await q(sb.from('company_documents').select('*').eq('company_id', co.id).order('category').order('created_at', { ascending: false }));
      var groups = ['formation', 'tax_return', 'report', 'compliance', 'uploaded', 'other'].filter(function (c) { return docs.some(function (d) { return d.category === c; }); });
      body.innerHTML = groups.length ? groups.map(function (g) { return '<section class="portal-card"><h2 class="portal-h2">' + esc(t('cat_' + g)) + '</h2>' + docItems(docs.filter(function (d) { return d.category === g; }), false) + '</section>'; }).join('') : '<div class="portal-card empty-state"><strong>' + t('noDocs') + '</strong></div>';
      wireDocs(body, docs);
    } else if (tab === 'finance' && S.perms.view) {
      await reportsFor(body, [co]);
    } else {
      var items = await q(sb.from('compliance_items').select('*').eq('company_id', co.id).order('due_date'));
      body.innerHTML = '<section class="portal-card">' + (items.length ? items.map(function (i) { return deadlineRow(i, co); }).join('') : '<div class="empty-state"><strong>' + t('noDeadlines') + '</strong></div>') + '</section>';
    }
  }

  async function vDocuments(view) {
    var docs = await q(sb.from('company_documents').select('*').eq('client_id', S.client.id).order('created_at', { ascending: false }));
    view.innerHTML = head(t('nav_documents'), t('privacyNote')) +
      '<div class="toolbar"><input type="search" id="d-q" placeholder="' + t('search') + '" aria-label="' + t('search') + '">' +
      '<select id="d-co" aria-label="' + t('company') + '"><option value="">' + t('allCompanies') + '</option>' + S.companies.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select>' +
      '<select id="d-cat" aria-label="Category"><option value="">' + t('allCategories') + '</option>' + ['formation', 'tax_return', 'report', 'compliance', 'uploaded', 'other'].map(function (c) { return '<option value="' + c + '">' + t('cat_' + c) + '</option>'; }).join('') + '</select></div>' +
      '<section class="portal-card" id="d-list"></section>';
    function draw() {
      var s = $('#d-q').value.trim().toLowerCase(), co = $('#d-co').value, cat = $('#d-cat').value;
      var rows = docs.filter(function (d) { return (!co || d.company_id === co) && (!cat || d.category === cat) && (!s || (d.title + ' ' + (d.year || '')).toLowerCase().indexOf(s) > -1); });
      $('#d-list').innerHTML = docItems(rows, true); wireDocs($('#d-list'), rows);
    }
    ['#d-q', '#d-co', '#d-cat'].forEach(function (s) { $(s).addEventListener('input', draw); });
    var pre = param('company'); if (pre) $('#d-co').value = pre;
    draw();
  }

  async function vCompliance(view) {
    var items = await q(sb.from('compliance_items').select('*').eq('client_id', S.client.id).order('due_date'));
    view.innerHTML = head(t('nav_compliance'), t('complianceLead'), '<button class="btn btn--ghost btn--xs" type="button" id="ics">' + t('addCal') + '</button>') +
      '<div class="toolbar" style="align-items:center"><select id="c-co" aria-label="' + t('company') + '"><option value="">' + t('allCompanies') + '</option>' + S.companies.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select>' +
      '<label class="check-row" style="align-items:center"><input type="checkbox" id="c-done"> <span>' + t('showDone') + '</span></label></div><div id="c-list"></div>';
    function draw() {
      var co = $('#c-co').value, all = $('#c-done').checked;
      var rows = items.filter(function (i) { return (!co || i.company_id === co) && (all || (i.status !== 'done' && i.status !== 'not_applicable')); });
      if (!rows.length) { $('#c-list').innerHTML = '<div class="portal-card empty-state"><strong>' + t('noDeadlines') + '</strong></div>'; return; }
      var byMonth = {};
      rows.forEach(function (i) { var k = i.due_date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(i); });
      $('#c-list').innerHTML = Object.keys(byMonth).map(function (k) {
        var p = k.split('-'), title = new Intl.DateTimeFormat(EP.locale, { month: 'long', year: 'numeric' }).format(new Date(+p[0], +p[1] - 1, 15));
        return '<section class="portal-card"><h2 class="portal-h2">' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + '</h2>' + byMonth[k].map(function (i) { return deadlineRow(i, coById(i.company_id)); }).join('') + '</section>';
      }).join('');
    }
    $('#c-co').onchange = draw; $('#c-done').onchange = draw; draw();
    $('#ics').onclick = function () {
      var d = function (s) { return s.replace(/-/g, ''); };
      var ev = items.filter(function (i) { return i.status !== 'done' && i.status !== 'not_applicable'; }).map(function (i) {
        var end = new Date(i.due_date + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 1);
        var co = coById(i.company_id);
        return ['BEGIN:VEVENT', 'UID:' + i.id + '@endeavorbiz.com', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), 'DTSTART;VALUE=DATE:' + d(i.due_date), 'DTEND;VALUE=DATE:' + end.toISOString().slice(0, 10).replace(/-/g, ''),
          'SUMMARY:' + (co ? co.legal_name + ': ' : '') + i.title.replace(/[,;]/g, ' '), 'DESCRIPTION:Endeavor Business Solutions · support@endeavorbiz.com',
          'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + i.title.replace(/[,;]/g, ' '), 'END:VALARM', 'END:VEVENT'].join('\r\n');
      });
      download('endeavor-deadlines.ics', new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Endeavor Business Solutions//Compliance//EN'].concat(ev, ['END:VCALENDAR']).join('\r\n')], { type: 'text/calendar' }));
    };
  }

  async function qboCall(payload) {
    var s = (await sb.auth.getSession()).data.session;
    var r = await fetch(CFG.functionsUrl + '/qbo', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey, Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) throw new Error(j.error || 'generic');
    return j;
  }
  async function reportsFor(body, companies) {
    var docs = await q(sb.from('company_documents').select('*').eq('client_id', S.client.id).eq('category', 'report').order('created_at', { ascending: false }));
    var stats = await Promise.all(companies.map(function (co) { return sb.rpc('qbo_status', { p_company: co.id }).then(function (r) { return (r.data || [])[0] || {}; }); }));
    var y = new Date().getFullYear(), qn = Math.floor(new Date().getMonth() / 3), defQ = qn === 0 ? 4 : qn, defY = qn === 0 ? y - 1 : y;
    var flag = param('qbo');
    body.innerHTML = (flag ? '<div class="portal-alert portal-alert--' + (flag === 'connected' ? 'ok' : 'error') + '">' + t(flag === 'connected' ? 'qboConnected' : flag === 'cancelled' ? 'qboCancelled' : 'qboError') + '</div>' : '') +
      companies.map(function (co, i) {
        var s = stats[i], mine = docs.filter(function (d) { return d.company_id === co.id; });
        return '<section class="portal-card"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + esc(co.legal_name) + '</h2>' +
          (s.connected ? '<span class="qbo-badge">' + t('qboOn') + (s.qbo_company_name ? ': ' + esc(s.qbo_company_name) : '') + '</span>' : '<span class="pill">' + t('qboOff') + '</span>') + '</div>' +
          '<div class="portal-btn-row">' + (s.connected ?
            '<label class="sr-only" for="y-' + co.id + '">' + t('year') + '</label><select id="y-' + co.id + '">' + [y, y - 1, y - 2].map(function (v) { return '<option' + (v === defY ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
            '<label class="sr-only" for="q-' + co.id + '">' + t('period') + '</label><select id="q-' + co.id + '">' + [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (n === defQ ? ' selected' : '') + '>' + t('q' + n) + '</option>'; }).join('') + '<option value="0">' + t('fy') + '</option></select>' +
            '<button class="btn btn--navy btn--xs" data-gen="' + co.id + '">' + t('generate') + '</button>' + (S.perms.owner ? '<button class="btn btn--danger btn--xs" data-disc="' + co.id + '">' + t('disconnect') + '</button>' : '')
            : (S.perms.owner ? '<button class="btn btn--navy btn--xs" data-conn="' + co.id + '">' + t('connect') + '</button>' : '<span class="portal-muted">' + t('ownerConnects') + '</span>')) + '</div>' +
          '<div class="portal-alert" id="qm-' + co.id + '" role="status"></div>' + (mine.length ? docItems(mine, false) : '<p class="portal-muted">' + t('noReports') + '</p>') + '</section>';
      }).join('');
    wireDocs(body, docs);
    var fail = function (id, e) { msg($('#qm-' + id), D.en[e.message] ? t(e.message) : t('generic'), 'error'); };
    $$('[data-conn]', body).forEach(function (b) { b.onclick = async function () { try { var j = await qboCall({ action: 'connect', company_id: b.dataset.conn, return_to: location.href.split('#')[0] }); location.href = j.url; } catch (e) { fail(b.dataset.conn, e); } }; });
    $$('[data-disc]', body).forEach(function (b) { b.onclick = async function () { if (!confirm(t('confirmDisconnect'))) return; try { await qboCall({ action: 'disconnect', company_id: b.dataset.disc }); route(); } catch (e) { fail(b.dataset.disc, e); } }; });
    $$('[data-gen]', body).forEach(function (b) { b.onclick = async function () {
      var id = b.dataset.gen; b.disabled = true; msg($('#qm-' + id), t('generating'), 'info');
      try { await qboCall({ action: 'generate', company_id: id, year: +$('#y-' + id).value, quarter: +$('#q-' + id).value }); route(); } catch (e) { b.disabled = false; fail(id, e); }
    }; });
  }
  async function vReports(view) {
    view.innerHTML = head(t('nav_reports'), t('reportsLead')) + '<div id="r-body"></div>';
    if (!S.companies.length) { $('#r-body').innerHTML = '<div class="portal-card empty-state"><strong>' + t('noCompanies') + '</strong></div>'; return; }
    var pre = param('company'), list = pre && coById(pre) ? [coById(pre)].concat(S.companies.filter(function (c) { return c.id !== pre; })) : S.companies;
    await reportsFor($('#r-body'), list);
  }

  async function vUpload(view) {
    if (!S.companies.length) { view.innerHTML = head(t('nav_upload'), '') + '<div class="portal-card empty-state"><strong>' + t('noCompanies') + '</strong></div>'; return; }
    var mine = await q(sb.from('company_documents').select('*').eq('client_id', S.client.id).eq('category', 'uploaded').eq('uploaded_by', S.user.id).order('created_at', { ascending: false }).limit(50));
    var y = new Date().getFullYear();
    view.innerHTML = head(t('nav_upload'), t('uploadLead')) +
      '<section class="portal-card"><form class="portal-form" id="u-form" novalidate><div class="portal-grid2"><div class="field"><label for="u-co">' + t('company') + '</label><select id="u-co">' + S.companies.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="u-year">' + t('yearOpt') + '</label><select id="u-year"><option value="">—</option>' + [y, y - 1, y - 2, y - 3].map(function (v) { return '<option' + (v === y - 1 ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="u-title">' + t('docTitle') + '</label><input id="u-title" type="text" maxlength="160" placeholder="1099-NEC, bank statements, receipts…"></div>' +
      '<label class="upload-zone" for="u-file" id="u-zone"><input type="file" id="u-file" class="sr-only" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xls,.xlsx,.doc,.docx"><strong>' + t('chooseFiles') + '</strong><span class="portal-muted" id="u-names">' + t('fileHint') + '</span></label>' +
      '<div class="portal-alert" id="u-msg" role="status"></div><button class="btn btn--navy" type="submit" style="justify-self:start">' + t('send') + '</button></form></section>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('myUploads') + '</h2>' + docItems(mine, true) + '</section>';
    wireDocs(view, mine);
    var input = $('#u-file'), zone = $('#u-zone'), files = [];
    var show = function () { $('#u-names').textContent = files.length ? files.map(function (f) { return f.name; }).join(', ') : t('fileHint'); };
    input.onchange = function () { files = Array.prototype.slice.call(input.files); show(); };
    ['dragenter', 'dragover'].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { zone.addEventListener(e, function (ev) { ev.preventDefault(); zone.classList.remove('is-over'); }); });
    zone.addEventListener('drop', function (ev) { files = Array.prototype.slice.call(ev.dataTransfer.files || []); show(); });
    $('#u-form').onsubmit = async function (e) {
      e.preventDefault();
      var m = $('#u-msg'), co = $('#u-co').value, desc = $('#u-title').value.trim(), year = +$('#u-year').value || null;
      if (!files.length) return msg(m, t('pickFile'), 'error');
      var big = files.find(function (f) { return f.size > 25 * 1024 * 1024; }); if (big) return msg(m, t('tooBig', { f: big.name }), 'error');
      var names = [];
      try {
        for (var i = 0; i < files.length; i++) {
          var f = files[i]; msg(m, t('sending', { i: i + 1, n: files.length }), 'info');
          var buf = await f.arrayBuffer();
          var path = S.client.id + '/' + co + '/uploads/' + crypto.randomUUID().slice(0, 8) + '-' + slug(f.name);
          var up = await sb.storage.from('client-docs').upload(path, new Blob([buf], { type: f.type || 'application/octet-stream' }), { contentType: f.type || 'application/octet-stream' });
          if (up.error) throw up.error;
          var title = desc ? (files.length > 1 ? desc + ' · ' + f.name : desc) : f.name.replace(/\.[^.]+$/, '');
          var row = await q(sb.from('company_documents').insert({ company_id: co, client_id: S.client.id, category: 'uploaded', title: title, year: year, path: path, mime: f.type || null, size_bytes: f.size, sha256: await sha256Hex(buf), uploaded_by: S.user.id }).select('id').single());
          sb.from('doc_access_log').insert({ document_id: row.id, action: 'upload' }).then(function () {});
          names.push(f.name);
        }
        fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: 'Client portal upload: ' + S.client.name + ' (' + names.length + ' file' + (names.length > 1 ? 's' : '') + ')', _template: 'table', _captcha: 'false',
          client: S.client.name, company: (coById(co) || {}).legal_name, uploaded_by: S.user.email, files: names.join(', '), tax_year: year || '', note: 'Open the admin console > Clientes > Documentos.' }) }).catch(function () {});
        msg(m, t('sent'), 'ok'); files = []; input.value = ''; show();
        setTimeout(route, 1200);
      } catch (err) { msg(m, errText(err), 'error'); }
    };
  }

  async function vCollab(view) {
    var users = await q(sb.from('client_users').select('*').eq('client_id', S.client.id).order('invited_at'));
    var collabs = users.filter(function (u) { return u.role === 'collaborator'; });
    view.innerHTML = head(t('nav_collab'), t('collabLead'), '<button class="btn btn--navy btn--xs" type="button" id="inv">' + t('invite') + '</button>') +
      '<section class="portal-card">' + (collabs.length ? '<ul class="doclist">' + collabs.map(function (u) {
        return '<li><span class="ficon" aria-hidden="true">' + esc((u.name || u.email).slice(0, 2).toUpperCase()) + '</span><div><div class="dname">' + esc(u.name || u.email) + ' · ' + esc(t('c_' + (u.collab_type || 'other'))) + '</div>' +
          '<div class="dmeta">' + esc(u.email) + ' · ' + [u.can_view ? t('viewOnly') : '', u.can_upload ? t('uploadOnly') : ''].filter(Boolean).join(' + ') + ' · <span class="pill' + (u.status === 'active' ? ' pill--done' : u.status === 'revoked' ? ' pill--overdue' : ' pill--soon') + '">' + t('s_' + u.status) + '</span></div></div>' +
          '<div class="portal-btn-row">' + (u.status === 'invited' ? '<button class="btn btn--ghost btn--xs" data-resend="' + u.id + '">' + t('resend') + '</button>' : '') + (u.status !== 'revoked' ? '<button class="btn btn--danger btn--xs" data-rev="' + u.id + '">' + t('revoke') + '</button>' : '') + '</div></li>';
      }).join('') + '</ul>' : '<div class="empty-state"><strong>' + t('noCollab') + '</strong>' + t('collabLead') + '</div>') + '</section>';
    var find = function (id) { return users.find(function (u) { return u.id === id; }); };
    $$('[data-rev]', view).forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.rev); if (!confirm(t('confirmRevoke', { e: u.email }))) return; await sb.from('client_users').update({ status: 'revoked' }).eq('id', u.id); route(); }; });
    $$('[data-resend]', view).forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.resend); await sendInvite(u.email, u.name || u.email); alert(t('inviteSent', { e: u.email })); }; });
    $('#inv').onclick = inviteForm;
    if (param('invite')) inviteForm();
  }
  async function sendInvite(email, name) {
    var link = siteUrl('client.html') + '?lang=' + L;
    var txt = { en: 'Hello ' + name + ', ' + S.client.name + ' invited you to the Endeavor Business Solutions client portal. Open ' + link + ', choose "First access" with this email, create your password and confirm your email. You will also set up two-step verification. Questions: support@endeavorbiz.com',
      pt: 'Olá ' + name + ', ' + S.client.name + ' convidou você para o portal do cliente da Endeavor Business Solutions. Abra ' + link + ', escolha "Primeiro acesso" com este e-mail, crie sua senha e confirme o e-mail. Você também vai ativar a verificação em duas etapas. Dúvidas: support@endeavorbiz.com',
      es: 'Hola ' + name + ', ' + S.client.name + ' lo invitó al portal del cliente de Endeavor Business Solutions. Abra ' + link + ', elija "Primer acceso" con este correo, cree su contraseña y confirme su correo. También configurará la verificación en dos pasos. Dudas: support@endeavorbiz.com' }[L];
    try { await fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: 'Collaborator invited: ' + name + ' (' + S.client.name + ')', _template: 'table', _captcha: 'false', name: name, email: email, client: S.client.name, invited_by: S.user.email, _autoresponse: txt }) }); } catch (e) { /* best effort */ }
  }
  function inviteForm() {
    openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t('invite') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<form class="portal-form" id="iv-form" novalidate><div class="field"><label for="iv-name">' + t('name') + '</label><input id="iv-name" type="text" required></div><div class="field"><label for="iv-email">' + t('email') + '</label><input id="iv-email" type="email" required></div>' +
      '<div class="field"><label for="iv-type">' + t('type') + '</label><select id="iv-type">' + ['accountant', 'bookkeeping', 'property_management', 'other'].map(function (k) { return '<option value="' + k + '">' + t('c_' + k) + '</option>'; }).join('') + '</select></div>' +
      '<fieldset class="field" style="border:0;padding:0;margin:0"><legend style="font-weight:600;margin-bottom:.4rem">' + t('perms') + '</legend><div class="check-row"><input type="checkbox" id="iv-up" checked><label for="iv-up">' + t('canUpload') + '</label></div><div class="check-row"><input type="checkbox" id="iv-view"><label for="iv-view">' + t('canView') + '</label></div></fieldset>' +
      '<div class="portal-alert" id="iv-msg" role="alert"></div><button class="btn btn--navy" type="submit">' + t('invite') + '</button></form>');
    $('#iv-form').onsubmit = async function (e) {
      e.preventDefault();
      var name = $('#iv-name').value.trim(), email = $('#iv-email').value.trim().toLowerCase();
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg($('#iv-msg'), t('fillNameEmail'), 'error');
      var r = await sb.from('client_users').insert({ client_id: S.client.id, email: email, name: name, role: 'collaborator', collab_type: $('#iv-type').value, can_view: $('#iv-view').checked, can_upload: $('#iv-up').checked });
      if (r.error) return msg($('#iv-msg'), /unique|duplicate/i.test(r.error.message) ? t('inviteDup') : errText(r.error), 'error');
      await sendInvite(email, name);
      closeOverlay(); history.replaceState(null, '', '#/collaborators'); route();
    };
  }

  async function vSettings(view) {
    var u = (await sb.auth.getUser()).data.user;
    view.innerHTML = head(t('nav_settings'), t('settingsLead')) +
      '<section class="portal-card"><h2 class="portal-h2">' + t('account') + '</h2><dl class="kv"><dt>' + t('email') + '</dt><dd>' + esc(u.email) + '</dd><dt>' + t('lastLogin') + '</dt><dd>' + esc(fmtDT(u.last_sign_in_at)) + '</dd>' +
      '<dt>' + t('status') + '</dt><dd>' + esc(S.perms.owner ? t('owner') : t('c_' + (S.me.collab_type || 'other'))) + '</dd><dt>MFA</dt><dd>' + t('mfaOn') + '</dd></dl></section>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('changePass') + '</h2><form class="portal-form" id="pw"><div class="field"><label for="pw-n">' + t('newPass') + '</label><input id="pw-n" type="password" autocomplete="new-password" minlength="12" required></div>' +
      '<div class="portal-alert" id="pw-m" role="status"></div><button class="btn btn--navy" type="submit" style="justify-self:start">' + t('savePass') + '</button></form></section>';
    $('#pw').onsubmit = async function (e) {
      e.preventDefault(); var p = $('#pw-n').value; if (p.length < 12) return msg($('#pw-m'), t('passShort'), 'error');
      var r = await sb.auth.updateUser({ password: p }); msg($('#pw-m'), r.error ? errText(r.error) : t('passChanged'), r.error ? 'error' : 'ok');
    };
  }

  boot();
})();
