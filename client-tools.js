/* Client portal: services bought online and their tools.
   - Serviços: what the account has, and upgrades (embedded Stripe Checkout, same login)
   - CRM: contacts and sales pipeline of the client's own business
   - Agenda: the client's public booking page (agendar.html?p=SLUG) and the bookings
   - Assinaturas: send the client's own PDFs for electronic signature (same editor and signer page as Endeavor)
   - Bookkeeping: done by Endeavor; the client connects bank and card accounts and invites the accountant
   Data is protected by RLS: only the account owner (with the authenticator) of a client that has the service. */
(function () {
  'use strict';
  var T = {
    en: {
      nav_addons: 'Add-ons', ad_title: 'Add-ons', ad_lead: 'Tools and services to add to your account, with the same login. New add-ons appear here as they launch.', ad_search: 'Search add-ons…', ad_all: 'All', cat_empresa: 'Company', cat_vendas: 'Sales', cat_comunicacao: 'Communication', cat_financeiro: 'Finance', cat_documentos: 'Documents', ad_member: 'Client price', ad_plan: 'Your plan', ad_included: 'Included in your plan', ad_request: 'Request activation', ad_requested: 'Request sent. Our team will contact you to turn it on.', ad_quote: 'On request', ad_none: 'No add-ons match your search.', e_included_in_package: 'This service is part of your package and is cancelled together with it.', cancelledNow: 'Add-on removed. The unused part of the month becomes a credit on your next invoice.', inPackage: 'In your package', x_webmeeting: 'Video meetings in the browser with your own room link, recording and notes.', x_webinar: 'Live webinars with registration page, reminders and replay.', x_whatsapp: 'Organize your WhatsApp conversations, groups and automatic replies.',
      cancelShort: 'Cancel', tab_plan: 'My plan', tab_addons: 'Add-ons', sv_empty: 'You have no active services yet. See what you can add.', pg_prev: 'Previous page', pg_next: 'Next page', pg_label: 'Pages',
      nav_services: 'Services', nav_crm: 'CRM', nav_agenda: 'Scheduling', nav_esign: 'E-signature', nav_books: 'Bookkeeping',
      sv_title: 'Services', sv_lead: 'The Endeavor services on your account. Add more whenever you want, with the same login.', active: 'Active', past_due: 'Payment pending', soon: 'Coming soon', open: 'Open', buy: 'Add to my account', cancelSub: 'Cancel subscription',
      cancelQ: 'Cancel {p}? You keep access until the end of the period already paid.', cancelled: 'Cancellation scheduled. You keep access until the end of the paid period.', paying: 'Secure payment', checking: 'Confirming the payment…', activated: '{p} is active on your account.', payErr: 'The payment could not be started',
      e_already_active: 'This service is already active.', e_stripe_not_configured: 'Online payment is being set up. Please write to support@endeavorbiz.com.',
      ov_lead: 'Your Endeavor services in one place.', ov_more: 'Add services', ov_none: 'No services yet.',
      crm_lead: 'Your leads and clients, by stage of the sale.', newContact: 'New contact', search: 'Search name, e-mail or company…', board: 'Pipeline', list: 'List',
      st_new: 'New', st_contacted: 'Contacted', st_proposal: 'Proposal', st_won: 'Won', st_lost: 'Lost', k_contacts: 'Contacts', k_open: 'Open pipeline', k_won: 'Won (this month)', k_todo: 'Actions due',
      name: 'Name', email: 'E-mail', phone: 'Phone / WhatsApp', company: 'Company', stage: 'Stage', value: 'Deal value (US$)', source: 'Source', next: 'Next action', nextAt: 'Next action date', notes: 'Notes', save: 'Save', del: 'Delete', delQ: 'Delete this contact and its notes?', saved: 'Saved.',
      history: 'History', addNote: 'Add note', notePh: 'Call summary, what was agreed, next steps…', noContacts: 'No contacts yet. Add the first one, or share your booking page: each booking becomes a contact.', due: 'due',
      ag_lead: 'Your booking page: clients choose a free time and get the confirmation by e-mail.', ag_setup: 'Create your booking page', ag_link: 'Your booking link', copy: 'Copy', copied: 'Copied ✓', openPage: 'Open page',
      ag_settings: 'Page settings', slug: 'Link name (letters, numbers and hyphen)', title: 'Title', desc: 'Description (optional)', dur: 'Meeting length (minutes)', buffer: 'Break between meetings (minutes)', tz: 'Time zone',
      loc: 'Format', video: 'Video call', phoneCall: 'Phone call', in_person: 'In person', meet: 'Meeting details sent in the confirmation (link, phone or address)', notify: 'E-mail for new bookings', notice: 'Minimum notice (hours)', ahead: 'Bookable up to (days ahead)',
      hours: 'Weekly hours', from: 'from', to: 'to', and: 'and', off: 'Days off (one date per line, YYYY-MM-DD)', activeP: 'Page active (accepting bookings)', upcoming: 'Next bookings', past: 'Past and cancelled', noAppts: 'No bookings yet.', cancelAppt: 'Cancel', cancelApptQ: 'Cancel the booking with {n}? They will be notified by e-mail.', st_confirmed: 'Confirmed', st_cancelled: 'Cancelled',
      e_slug: 'This link name is already in use. Try another one.', e_slugFmt: 'Use 3 to 40 lowercase letters, numbers or hyphens.',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      es_lead: 'Send your PDFs for electronic signature. The signer receives a private link; the signed copy with the audit certificate comes back here.', newDoc: 'New document', noDocs: 'No documents sent yet.',
      doc: 'Document', signer: 'Signer', sent: 'Sent', status: 'Status', s_sent: 'Sent', s_viewed: 'Viewed', s_signed: 'Signed', s_voided: 'Withdrawn', s_expired: 'Expired',
      copyLink: 'Copy link', resend: 'E-mail again', viewDoc: 'View', signedDoc: 'Signed copy', voidQ: 'Withdraw this document? The signing link stops working.', voidB: 'Withdraw', mailed: 'E-mail sent to {e}.', docSent: 'Document sent', docSentMail: 'The signing link was sent to {e}.', docSentLink: 'Document created. Copy the link and send it to the signer.', backList: 'Back to the list',
      bk_lead: 'Endeavor keeps your books with AI. You connect your accounts; our team categorizes the transactions and publishes your monthly reports.', bk_how: 'How it works', bk_s1: 'Connect your business bank accounts and credit cards below (read-only access through Stripe or Plaid).', bk_s2: 'Our team reviews and categorizes every transaction, with AI suggestions.', bk_s3: 'Each month you get Profit and Loss, Balance Sheet and Cash Flow under Financial Reports.', bk_s4: 'Invite your accountant under Collaborators to see the reports.',
      bk_bank: 'Connect bank account', bk_card: 'Connect credit card', bk_accounts: 'Connected accounts', bk_none: 'No accounts connected yet.', bk_tx: 'Transactions received', bk_review: 'Being reviewed by Endeavor', bk_sync: 'Last update', bk_off: 'Bank connection is being set up by Endeavor. Please try again later or write to support@endeavorbiz.com.', bk_done: 'Connected. {n} transactions imported; new ones arrive automatically.', bk_reports: 'Financial reports', bk_invite: 'Invite my accountant', bk_noCo: 'Endeavor is setting up your company for bookkeeping. Please check back soon.',
      k_checking: 'checking', k_savings: 'savings', k_credit_card: 'credit card', k_other: 'account', loading: 'Loading…', close: 'Close', generic: 'Something went wrong. Please try again.'
    },
    pt: {
      nav_addons: 'Add-ons', ad_title: 'Add-ons', ad_lead: 'Ferramentas e serviços para adicionar à sua conta, com o mesmo login. Os novos add-ons aparecem aqui conforme forem lançados.', ad_search: 'Buscar add-ons…', ad_all: 'Todos', cat_empresa: 'Empresa', cat_vendas: 'Vendas', cat_comunicacao: 'Comunicação', cat_financeiro: 'Financeiro', cat_documentos: 'Documentos', ad_member: 'Preço de cliente', ad_plan: 'Seu plano', ad_included: 'Incluído no seu plano', ad_request: 'Pedir ativação', ad_requested: 'Pedido enviado. A nossa equipe entra em contato para ativar.', ad_quote: 'Sob consulta', ad_none: 'Nenhum add-on encontrado.', e_included_in_package: 'Este serviço faz parte do seu pacote e só é cancelado junto com ele.', cancelledNow: 'Add-on removido. A parte não usada do mês vira crédito na próxima fatura.', inPackage: 'No seu pacote', x_webmeeting: 'Reuniões por vídeo no navegador, com sala própria, gravação e anotações.', x_webinar: 'Webinars ao vivo com página de inscrição, lembretes e replay.', x_whatsapp: 'Organize as conversas, os grupos e as respostas automáticas do seu WhatsApp.',
      cancelShort: 'Cancelar', tab_plan: 'Meu plano', tab_addons: 'Add-ons', sv_empty: 'Você ainda não tem serviços ativos. Veja o que dá para adicionar.', pg_prev: 'Página anterior', pg_next: 'Próxima página', pg_label: 'Páginas',
      nav_services: 'Serviços', nav_crm: 'CRM', nav_agenda: 'Agenda', nav_esign: 'Assinatura eletrônica', nav_books: 'Bookkeeping',
      sv_title: 'Serviços', sv_lead: 'Os serviços da Endeavor na sua conta. Contrate mais quando quiser, com o mesmo login.', active: 'Ativo', past_due: 'Pagamento pendente', soon: 'Em breve', open: 'Abrir', buy: 'Contratar', cancelSub: 'Cancelar assinatura',
      cancelQ: 'Cancelar {p}? Você continua com acesso até o fim do período já pago.', cancelled: 'Cancelamento agendado. O acesso continua até o fim do período pago.', paying: 'Pagamento seguro', checking: 'Confirmando o pagamento…', activated: '{p} está ativo na sua conta.', payErr: 'Não foi possível iniciar o pagamento',
      e_already_active: 'Este serviço já está ativo.', e_stripe_not_configured: 'O pagamento online está sendo configurado. Escreva para support@endeavorbiz.com.',
      ov_lead: 'Os seus serviços da Endeavor num só lugar.', ov_more: 'Contratar serviços', ov_none: 'Nenhum serviço ainda.',
      crm_lead: 'Seus leads e clientes, por etapa da venda.', newContact: 'Novo contato', search: 'Buscar nome, e-mail ou empresa…', board: 'Funil', list: 'Lista',
      st_new: 'Novo', st_contacted: 'Contatado', st_proposal: 'Proposta', st_won: 'Ganho', st_lost: 'Perdido', k_contacts: 'Contatos', k_open: 'Funil em aberto', k_won: 'Ganhos (no mês)', k_todo: 'Ações vencendo',
      name: 'Nome', email: 'E-mail', phone: 'Telefone / WhatsApp', company: 'Empresa', stage: 'Etapa', value: 'Valor do negócio (US$)', source: 'Origem', next: 'Próxima ação', nextAt: 'Data da próxima ação', notes: 'Observações', save: 'Salvar', del: 'Excluir', delQ: 'Excluir este contato e as anotações?', saved: 'Salvo.',
      history: 'Histórico', addNote: 'Adicionar anotação', notePh: 'Resumo da conversa, o que foi combinado, próximos passos…', noContacts: 'Nenhum contato ainda. Adicione o primeiro, ou divulgue a sua página de agendamento: cada agendamento vira um contato.', due: 'vence',
      ag_lead: 'A sua página de agendamento: o cliente escolhe um horário livre e recebe a confirmação por e-mail.', ag_setup: 'Criar a minha página de agendamento', ag_link: 'Seu link de agendamento', copy: 'Copiar', copied: 'Copiado ✓', openPage: 'Abrir página',
      ag_settings: 'Configurações da página', slug: 'Nome do link (letras, números e hífen)', title: 'Título', desc: 'Descrição (opcional)', dur: 'Duração do encontro (minutos)', buffer: 'Intervalo entre encontros (minutos)', tz: 'Fuso horário',
      loc: 'Formato', video: 'Videochamada', phoneCall: 'Ligação telefônica', in_person: 'Presencial', meet: 'Detalhes enviados na confirmação (link, telefone ou endereço)', notify: 'E-mail que recebe os novos agendamentos', notice: 'Antecedência mínima (horas)', ahead: 'Agendamento até (dias à frente)',
      hours: 'Horários da semana', from: 'das', to: 'às', and: 'e', off: 'Folgas (uma data por linha, AAAA-MM-DD)', activeP: 'Página ativa (aceitando agendamentos)', upcoming: 'Próximos agendamentos', past: 'Passados e cancelados', noAppts: 'Nenhum agendamento ainda.', cancelAppt: 'Cancelar', cancelApptQ: 'Cancelar o agendamento com {n}? A pessoa será avisada por e-mail.', st_confirmed: 'Confirmado', st_cancelled: 'Cancelado',
      e_slug: 'Este nome de link já está em uso. Tente outro.', e_slugFmt: 'Use de 3 a 40 letras minúsculas, números ou hífens.',
      days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
      es_lead: 'Envie seus PDFs para assinatura eletrônica. O signatário recebe um link pessoal; a cópia assinada, com o certificado de auditoria, volta para cá.', newDoc: 'Novo documento', noDocs: 'Nenhum documento enviado ainda.',
      doc: 'Documento', signer: 'Signatário', sent: 'Enviado', status: 'Status', s_sent: 'Enviado', s_viewed: 'Visualizado', s_signed: 'Assinado', s_voided: 'Retirado', s_expired: 'Expirado',
      copyLink: 'Copiar link', resend: 'Enviar de novo', viewDoc: 'Ver', signedDoc: 'Cópia assinada', voidQ: 'Retirar este documento? O link de assinatura para de funcionar.', voidB: 'Retirar', mailed: 'E-mail enviado para {e}.', docSent: 'Documento enviado', docSentMail: 'O link de assinatura foi enviado para {e}.', docSentLink: 'Documento criado. Copie o link e envie ao signatário.', backList: 'Voltar à lista',
      bk_lead: 'A Endeavor cuida da sua contabilidade com IA. Você conecta as contas; a nossa equipe categoriza as transações e publica os relatórios do mês.', bk_how: 'Como funciona', bk_s1: 'Conecte abaixo as contas bancárias e os cartões da empresa (acesso só de leitura, pelo Stripe ou Plaid).', bk_s2: 'A nossa equipe revisa e categoriza cada transação, com sugestões da IA.', bk_s3: 'Todo mês você recebe DRE (P&L), balanço e fluxo de caixa em Relatórios financeiros.', bk_s4: 'Convide o seu contador em Colaboradores para ver os relatórios.',
      bk_bank: 'Conectar conta bancária', bk_card: 'Conectar cartão de crédito', bk_accounts: 'Contas conectadas', bk_none: 'Nenhuma conta conectada ainda.', bk_tx: 'Transações recebidas', bk_review: 'Em revisão pela Endeavor', bk_sync: 'Última atualização', bk_off: 'A conexão bancária está sendo configurada pela Endeavor. Tente mais tarde ou escreva para support@endeavorbiz.com.', bk_done: 'Conectado. {n} transações importadas; as novas chegam sozinhas.', bk_reports: 'Relatórios financeiros', bk_invite: 'Convidar o meu contador', bk_noCo: 'A Endeavor está preparando a sua empresa para o bookkeeping. Volte em breve.',
      k_checking: 'conta corrente', k_savings: 'poupança', k_credit_card: 'cartão de crédito', k_other: 'conta', loading: 'Carregando…', close: 'Fechar', generic: 'Algo deu errado. Tente de novo.'
    },
    es: {
      nav_addons: 'Add-ons', ad_title: 'Add-ons', ad_lead: 'Herramientas y servicios para agregar a su cuenta, con el mismo login. Los nuevos add-ons aparecen aquí a medida que se lanzan.', ad_search: 'Buscar add-ons…', ad_all: 'Todos', cat_empresa: 'Empresa', cat_vendas: 'Ventas', cat_comunicacao: 'Comunicación', cat_financeiro: 'Finanzas', cat_documentos: 'Documentos', ad_member: 'Precio de cliente', ad_plan: 'Su plan', ad_included: 'Incluido en su plan', ad_request: 'Pedir activación', ad_requested: 'Pedido enviado. Nuestro equipo lo contactará para activarlo.', ad_quote: 'A consultar', ad_none: 'Ningún add-on encontrado.', e_included_in_package: 'Este servicio es parte de su paquete y solo se cancela junto con él.', cancelledNow: 'Add-on eliminado. La parte no usada del mes queda como crédito en la próxima factura.', inPackage: 'En su paquete', x_webmeeting: 'Reuniones por video en el navegador, con sala propia, grabación y notas.', x_webinar: 'Webinars en vivo con página de inscripción, recordatorios y repetición.', x_whatsapp: 'Organice las conversaciones, grupos y respuestas automáticas de su WhatsApp.',
      cancelShort: 'Cancelar', tab_plan: 'Mi plan', tab_addons: 'Add-ons', sv_empty: 'Aún no tiene servicios activos. Vea lo que puede agregar.', pg_prev: 'Página anterior', pg_next: 'Página siguiente', pg_label: 'Páginas',
      nav_services: 'Servicios', nav_crm: 'CRM', nav_agenda: 'Agenda', nav_esign: 'Firma electrónica', nav_books: 'Bookkeeping',
      sv_title: 'Servicios', sv_lead: 'Los servicios de Endeavor en su cuenta. Contrate más cuando quiera, con el mismo login.', active: 'Activo', past_due: 'Pago pendiente', soon: 'Próximamente', open: 'Abrir', buy: 'Contratar', cancelSub: 'Cancelar suscripción',
      cancelQ: '¿Cancelar {p}? Mantiene el acceso hasta el fin del período ya pagado.', cancelled: 'Cancelación programada. El acceso sigue hasta el fin del período pagado.', paying: 'Pago seguro', checking: 'Confirmando el pago…', activated: '{p} está activo en su cuenta.', payErr: 'No se pudo iniciar el pago',
      e_already_active: 'Este servicio ya está activo.', e_stripe_not_configured: 'El pago en línea se está configurando. Escriba a support@endeavorbiz.com.',
      ov_lead: 'Sus servicios de Endeavor en un solo lugar.', ov_more: 'Contratar servicios', ov_none: 'Ningún servicio todavía.',
      crm_lead: 'Sus prospectos y clientes, por etapa de la venta.', newContact: 'Nuevo contacto', search: 'Buscar nombre, correo o empresa…', board: 'Embudo', list: 'Lista',
      st_new: 'Nuevo', st_contacted: 'Contactado', st_proposal: 'Propuesta', st_won: 'Ganado', st_lost: 'Perdido', k_contacts: 'Contactos', k_open: 'Embudo abierto', k_won: 'Ganados (este mes)', k_todo: 'Acciones vencidas',
      name: 'Nombre', email: 'Correo', phone: 'Teléfono / WhatsApp', company: 'Empresa', stage: 'Etapa', value: 'Valor del negocio (US$)', source: 'Origen', next: 'Próxima acción', nextAt: 'Fecha de la próxima acción', notes: 'Notas', save: 'Guardar', del: 'Eliminar', delQ: '¿Eliminar este contacto y sus notas?', saved: 'Guardado.',
      history: 'Historial', addNote: 'Agregar nota', notePh: 'Resumen de la llamada, lo acordado, próximos pasos…', noContacts: 'Ningún contacto todavía. Agregue el primero, o comparta su página de citas: cada cita se vuelve un contacto.', due: 'vence',
      ag_lead: 'Su página de citas: el cliente elige un horario libre y recibe la confirmación por correo.', ag_setup: 'Crear mi página de citas', ag_link: 'Su enlace de citas', copy: 'Copiar', copied: 'Copiado ✓', openPage: 'Abrir página',
      ag_settings: 'Configuración de la página', slug: 'Nombre del enlace (letras, números y guion)', title: 'Título', desc: 'Descripción (opcional)', dur: 'Duración de la reunión (minutos)', buffer: 'Pausa entre reuniones (minutos)', tz: 'Zona horaria',
      loc: 'Formato', video: 'Videollamada', phoneCall: 'Llamada telefónica', in_person: 'Presencial', meet: 'Detalles enviados en la confirmación (enlace, teléfono o dirección)', notify: 'Correo que recibe las nuevas citas', notice: 'Anticipación mínima (horas)', ahead: 'Citas hasta (días adelante)',
      hours: 'Horarios de la semana', from: 'de', to: 'a', and: 'y', off: 'Días libres (una fecha por línea, AAAA-MM-DD)', activeP: 'Página activa (aceptando citas)', upcoming: 'Próximas citas', past: 'Pasadas y canceladas', noAppts: 'Ninguna cita todavía.', cancelAppt: 'Cancelar', cancelApptQ: '¿Cancelar la cita con {n}? Recibirá un aviso por correo.', st_confirmed: 'Confirmada', st_cancelled: 'Cancelada',
      e_slug: 'Este nombre de enlace ya está en uso. Pruebe otro.', e_slugFmt: 'Use de 3 a 40 letras minúsculas, números o guiones.',
      days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
      es_lead: 'Envíe sus PDF para firma electrónica. El firmante recibe un enlace personal; la copia firmada, con el certificado de auditoría, vuelve aquí.', newDoc: 'Nuevo documento', noDocs: 'Ningún documento enviado todavía.',
      doc: 'Documento', signer: 'Firmante', sent: 'Enviado', status: 'Estado', s_sent: 'Enviado', s_viewed: 'Visto', s_signed: 'Firmado', s_voided: 'Retirado', s_expired: 'Vencido',
      copyLink: 'Copiar enlace', resend: 'Enviar de nuevo', viewDoc: 'Ver', signedDoc: 'Copia firmada', voidQ: '¿Retirar este documento? El enlace de firma deja de funcionar.', voidB: 'Retirar', mailed: 'Correo enviado a {e}.', docSent: 'Documento enviado', docSentMail: 'El enlace de firma fue enviado a {e}.', docSentLink: 'Documento creado. Copie el enlace y envíelo al firmante.', backList: 'Volver a la lista',
      bk_lead: 'Endeavor lleva su contabilidad con IA. Usted conecta las cuentas; nuestro equipo categoriza las transacciones y publica los informes del mes.', bk_how: 'Cómo funciona', bk_s1: 'Conecte abajo las cuentas bancarias y tarjetas de la empresa (acceso de solo lectura, por Stripe o Plaid).', bk_s2: 'Nuestro equipo revisa y categoriza cada transacción, con sugerencias de la IA.', bk_s3: 'Cada mes recibe estado de resultados, balance y flujo de caja en Informes financieros.', bk_s4: 'Invite a su contador en Colaboradores para ver los informes.',
      bk_bank: 'Conectar cuenta bancaria', bk_card: 'Conectar tarjeta de crédito', bk_accounts: 'Cuentas conectadas', bk_none: 'Ninguna cuenta conectada todavía.', bk_tx: 'Transacciones recibidas', bk_review: 'En revisión por Endeavor', bk_sync: 'Última actualización', bk_off: 'La conexión bancaria está siendo configurada por Endeavor. Intente más tarde o escriba a support@endeavorbiz.com.', bk_done: 'Conectado. {n} transacciones importadas; las nuevas llegan solas.', bk_reports: 'Informes financieros', bk_invite: 'Invitar a mi contador', bk_noCo: 'Endeavor está preparando su empresa para el bookkeeping. Vuelva pronto.',
      k_checking: 'cuenta corriente', k_savings: 'ahorro', k_credit_card: 'tarjeta de crédito', k_other: 'cuenta', loading: 'Cargando…', close: 'Cerrar', generic: 'Algo salió mal. Intente de nuevo.'
    }
  };
  var TOOL_VIEW = { crm: 'crm', agenda: 'agenda', esign: 'assinaturas', bookkeeping: 'bookkeeping', telefone: 'telefonia' };
  var STAGES = ['new', 'contacted', 'proposal', 'won', 'lost'];
  var C, L, t;
  function init(ctx) { C = ctx; L = T[ctx.L] ? ctx.L : 'en'; t = function (k, v) { var s = T[L][k] != null ? T[L][k] : T.en[k]; if (v && typeof s === 'string') Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }; }
  function esc(s) { return C.esc(s); }
  function svcName(code) { var i = window.EStore && EStore.info(code, L); return i ? i.name : code; }
  function has(code) { return (C.S.services || []).indexOf(code) > -1; }
  async function fn(name, body) {
    var sess = (await C.sb.auth.getSession()).data.session;
    var r = await fetch(C.CFG.functionsUrl + '/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(T[L]['e_' + j.error] ? t('e_' + j.error) : (j.detail || j.error || t('generic'))); e.code = j.error; throw e; }
    return j;
  }
  function copyText(text, btn) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { if (btn) { var o = btn.textContent; btn.textContent = t('copied'); setTimeout(function () { btn.textContent = o; }, 1500); } }, function () { window.prompt('', text); }); }
  function money(c) { return '$' + (Number(c || 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

  /* ---------------- navigation (called by client.js) ---------------- */
  function nav() {
    var n = [];
    if (has('crm')) n.push(['crm', 'nav_crm', 'i-users']);
    if (has('agenda')) n.push(['agenda', 'nav_agenda', 'i-cal']);
    if (has('esign')) n.push(['assinaturas', 'nav_esign', 'i-file']);
    if (has('bookkeeping')) n.push(['bookkeeping', 'nav_books', 'i-chart']);
    n.push(['servicos', 'nav_services', 'i-grid']);
    return n.map(function (x) { return [x[0], t(x[1]), x[2]]; });
  }

  /* ---------------- overview for accounts created by an online purchase ---------------- */
  async function overview(view) {
    var first = String((C.S.me && C.S.me.name) || C.S.client.name).split(' ')[0];
    var list = (C.S.services || []);
    view.innerHTML = C.head(C.t('hello', { n: first }), t('ov_lead'), '<a class="btn btn--navy btn--sm" href="#/servicos">' + t('ov_more') + '</a>') +
      (C.S.openInv && C.S.openInv.n ? '<div class="portal-alert portal-alert--info" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem"><strong>' + esc(C.t('inv_banner', { n: C.S.openInv.n, a: money(C.S.openInv.cents) })) + '</strong><a class="btn btn--navy btn--xs" href="#/invoices">' + C.t('inv_bannerBtn') + '</a></div>' : '') +
      (list.length ? '<div class="tl-grid">' + list.map(function (code) {
        var i = window.EStore ? EStore.info(code, L) : { name: code, lead: '' };
        return '<a class="portal-card tl-card" href="#/' + (TOOL_VIEW[code] || 'servicos') + '" style="text-decoration:none;color:inherit"><h2 class="portal-h2" style="margin:0 0 .35rem">' + esc(i.name) + '</h2><p class="portal-muted" style="margin:0 0 .75rem">' + esc(i.lead) + '</p><span class="btn btn--ghost btn--xs">' + t('open') + ' →</span></a>';
      }).join('') + '</div>' : '<div class="portal-card empty-state"><strong>' + t('ov_none') + '</strong><p><a class="btn btn--navy" href="#/servicos">' + t('ov_more') + '</a></p></div>');
  }

  /* ---------------- Serviços: uma página só, com as abas "Meu plano" e "Add-ons" ----------------
     No computador a página não rola: os cards vêm em páginas (flechas e "1/3"), e a quantidade por página é
     calculada pelo tamanho da tela. No celular os cards ficam um embaixo do outro, com rolagem normal. */
  /* Web Meeting, Live Webinar e WhatsApp Manager são produtos da loja; quem já tem o acesso liberado pela Endeavor vê "Ativo". */
  var LIBERADO = { webmeeting: 'meetOn', webinar: 'meetOn', whatsapp: 'waOn' };
  var CATS = ['empresa', 'vendas', 'comunicacao', 'financeiro', 'documentos'];
  var PACOTES = ['pkg_holding', 'pkg_completo', 'pkg_essencial'];
  var CARD_W = 224, CARD_H = 216, CARD_MAX = 280, GAP = 16, svObs = null;
  /** Quantos cards cabem: colunas × linhas no espaço livre (0 = celular, mostra todos). */
  function cabem(w, h) {
    if (window.innerWidth < 1000 || window.innerHeight < 560) return { cols: 0, rows: 0, n: 0 };
    var cols = Math.max(1, Math.min(4, Math.floor((w + GAP) / (CARD_W + GAP)))), rows = Math.max(1, Math.floor((h + GAP) / (CARD_H + GAP)));
    // a linha usa a altura livre, até um teto, para o card não ficar esticado quando sobra espaço
    return { cols: cols, rows: rows, n: cols * rows, alt: Math.min(CARD_MAX, Math.floor((h - (rows - 1) * GAP) / rows)) };
  }
  async function services(view, forcarAba) {
    var cid = C.S.client.id, orderBack = C.param('order');
    var res = await Promise.all([C.q(C.sb.from('store_products').select('*').neq('status', 'hidden').order('sort')), C.q(C.sb.from('client_services').select('*').eq('client_id', cid)),
      C.sb.rpc('client_is_member', { p_client: cid }),
      // o pacote da conta, mesmo quando é vendido só por proposta (escondido na loja)
      C.sb.from('store_products').select('*').in('code', PACOTES)]);
    var prod = {}; res[0].forEach(function (p) { prod[p.code] = p; });
    ((res[3] && res[3].data) || []).forEach(function (p) { prod[p.code] = p; });
    var by = {}; res[1].forEach(function (x) { if (x.status !== 'canceled') by[x.product_code] = x; });
    var member = !!(res[2] && res[2].data), plan = PACOTES.filter(function (c) { return by[c]; })[0];
    // em Meu plano, só o card do pacote e o que foi contratado à parte (o que é do pacote já está na descrição dele)
    var meus = res[1].filter(function (x) { return x.status !== 'canceled' && PACOTES.indexOf(x.product_code) < 0 && !x.included_in; });
    var aba = forcarAba || C.param('tab') || (plan || meus.length ? 'plano' : 'addons'); if (aba !== 'addons') aba = 'plano';
    var info = function (code) { return (window.EStore && EStore.info(code, L)) || { name: code, lead: '', feats: [] }; };
    var q = '', cat = '', pag = 0, medida = { cols: 0, rows: 0, n: 0 };

    view.innerHTML = C.head(t('sv_title'), t('sv_lead')) +
      '<nav class="subtabs" aria-label="' + t('sv_title') + '">' + [['plano', t('tab_plan')], ['addons', t('tab_addons')]].map(function (a) { return '<a href="#/servicos?tab=' + a[0] + '"' + (a[0] === aba ? ' aria-current="page"' : '') + '>' + a[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="portal-alert" id="sv-m" role="status"></div><div class="sv-fit">' +
      (aba === 'addons' ? '<div class="ad-tools"><label class="sr-only" for="ad-q">' + t('ad_search') + '</label><input id="ad-q" type="search" placeholder="' + t('ad_search') + '" autocomplete="off">' +
        '<div class="ad-chips" role="group" aria-label="' + t('ad_all') + '">' + [''].concat(CATS).map(function (c) { return '<button type="button" class="ad-chip" data-cat="' + c + '" aria-pressed="' + (c === '' ? 'true' : 'false') + '">' + t(c ? 'cat_' + c : 'ad_all') + '</button>'; }).join('') + '</div></div>' : '') +
      '<div class="sv-grid" id="sv-grid"></div>' +
      '<nav class="sv-pager" id="sv-pager" aria-label="' + t('pg_label') + '" hidden><button type="button" class="sv-seta" id="sv-ant" aria-label="' + t('pg_prev') + '">‹</button><span id="sv-pg" aria-live="polite"></span><button type="button" class="sv-seta" id="sv-prox" aria-label="' + t('pg_next') + '">›</button></nav></div>';
    var grid = view.querySelector('#sv-grid'), pager = view.querySelector('#sv-pager'), m = view.querySelector('#sv-m');

    /* ----- cards ----- */
    function cardPlano() {
      var p = prod[plan] || {}, i = info(plan), inc = res[1].filter(function (x) { return x.included_in === plan && x.status !== 'canceled'; });
      // a lista do que o pacote inclui vem da descrição do pacote; sem ela, os serviços incluídos ligados na conta
      var itens = (i.feats && i.feats.length ? i.feats : inc.map(function (x) { return svcName(x.product_code); }));
      return '<section class="portal-card tl-card tl-card--on sv-card sv-card--plano' + (medida.cols >= 2 ? ' sv-card--largo' : '') + (medida.cols >= 2 && medida.rows >= 2 ? ' sv-card--alto' : '') + '"><div class="sv-top"><h2 class="portal-h2">' + esc(svcName(plan)) + '</h2><span class="pill pill--report">' + t(by[plan].status === 'past_due' ? 'past_due' : 'active') + '</span></div>' +
        '<p class="ad-cat portal-muted">' + t('ad_plan') + '</p>' + (p.price_cents != null ? '<p class="tl-price"><strong>' + EStore.money(p.price_cents) + '</strong> <span class="portal-muted">' + esc(EStore.interval(p.interval, L)) + '</span></p>' : '') +
        (i.lead ? '<p class="sv-lead">' + esc(i.lead) + '</p>' : '') +
        (itens.length ? '<h3 class="sv-inc-t">' + t('ad_included') + '</h3><ul class="sv-inc" role="list">' + itens.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
    }
    function cardMeu(s) {
      var code = s.product_code, p = prod[code] || {}, i = info(code);
      return '<section class="portal-card tl-card tl-card--on sv-card"><div class="sv-top"><h2 class="portal-h2">' + esc(i.name) + '</h2><span class="pill pill--report">' + (s.included_in ? t('inPackage') : t(s.status === 'past_due' ? 'past_due' : 'active')) + '</span></div>' +
        '<p class="sv-lead">' + esc(i.lead) + '</p>' + (s.included_in || p.price_cents == null ? '' : '<p class="tl-price"><strong>' + EStore.money(p.price_cents) + '</strong> <span class="portal-muted">' + esc(EStore.interval(p.interval, L)) + '</span></p>') +
        '<div class="portal-btn-row">' + (TOOL_VIEW[code] ? '<a class="btn btn--navy btn--sm" href="#/' + TOOL_VIEW[code] + '">' + t('open') + '</a>' : '') +
        (s.included_in || p.interval === 'once' ? '' : '<button class="btn btn--ghost btn--sm" type="button" data-cancel="' + code + '" aria-label="' + t('cancelSub') + ': ' + esc(i.name) + '">' + t('cancelShort') + '</button>') + '</div></section>';
    }
    function cardAddon(x) {
      var on = !!x.mine || x.lib, soon = x.p.status === 'coming_soon', tela = x.lib ? x.code : TOOL_VIEW[x.code];
      var btn = on ? (tela ? '<a class="btn btn--navy btn--sm" href="#/' + tela + '">' + t('open') + '</a>' : '')
        : soon ? '' : '<button class="btn btn--gold btn--sm" type="button" data-buy="' + x.code + '">' + t('buy') + '</button>';
      var pill = on ? '<span class="pill pill--report">' + t('active') + '</span>' : soon ? '<span class="pill">' + t('soon') + '</span>' : '';
      var price = (x.mine && x.mine.included_in) ? '' :
        '<p class="tl-price">' + (x.full ? '<s class="portal-muted">' + EStore.money(x.full) + '</s> ' : '') + '<strong>' + EStore.money(x.price) + '</strong> <span class="portal-muted">' + esc(EStore.interval(x.p.interval, L)) + '</span>' + (x.full ? ' <span class="pill pill--report">' + t('ad_member') + '</span>' : '') + '</p>';
      return '<section class="portal-card tl-card sv-card' + (on ? ' tl-card--on' : '') + '"><div class="sv-top"><h2 class="portal-h2">' + esc(x.name) + '</h2>' + pill + '</div>' +
        '<p class="portal-muted ad-cat">' + t('cat_' + x.cat) + '</p><p class="sv-lead">' + esc(x.lead) + '</p>' + price + '<div class="portal-btn-row">' + btn + '</div></section>';
    }
    var catalogo = res[0].filter(function (p) { return p.kind !== 'package'; }).map(function (p) {
      var i = info(p.code), price = member && p.member_cents != null && p.member_cents < p.price_cents ? p.member_cents : p.price_cents;
      return { code: p.code, name: i.name, lead: i.lead, cat: p.category || 'empresa', p: p, price: price, full: price < p.price_cents ? p.price_cents : null, mine: by[p.code], lib: !!(LIBERADO[p.code] && C.S[LIBERADO[p.code]]) };
    }).filter(function (x) { return x.p.kind !== 'addon' || x.mine; });
    var semAc = function (v) { return String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    function lista() {
      // o card do plano ocupa duas colunas quando há espaço (o item vazio guarda o lugar na conta da página)
      if (aba === 'plano') return (plan ? [cardPlano()].concat(medida.cols >= 2 ? (medida.rows >= 2 ? ['', '', ''] : ['']) : []) : []).concat(meus.map(cardMeu));
      var k = semAc(q.trim());
      return catalogo.filter(function (x) { return (!cat || x.cat === cat) && (!k || semAc(x.name + ' ' + x.lead + ' ' + t('cat_' + x.cat)).indexOf(k) > -1); }).map(cardAddon);
    }

    /* ----- páginas ----- */
    function draw() {
      var cards = lista(), n = medida.n, pags = n ? Math.max(1, Math.ceil(cards.length / n)) : 1;
      pag = Math.min(pag, pags - 1);
      grid.style.gridTemplateColumns = n ? 'repeat(' + medida.cols + ', minmax(0, 1fr))' : '';
      grid.style.gridTemplateRows = n ? 'repeat(' + medida.rows + ', ' + medida.alt + 'px)' : '';
      grid.classList.toggle('sv-grid--fixo', !!n);
      grid.innerHTML = cards.length ? (n ? cards.slice(pag * n, pag * n + n) : cards).join('')
        : '<div class="portal-card empty-state sv-vazio"><p>' + t(aba === 'plano' ? 'sv_empty' : 'ad_none') + '</p>' + (aba === 'plano' ? '<a class="btn btn--gold btn--sm" href="#/servicos?tab=addons">' + t('tab_addons') + '</a>' : '') + '</div>';
      pager.hidden = pags < 2;
      view.querySelector('#sv-pg').textContent = (pag + 1) + '/' + pags;
      view.querySelector('#sv-ant').disabled = pag === 0; view.querySelector('#sv-prox').disabled = pag >= pags - 1;
      grid.querySelectorAll('[data-buy]').forEach(function (b) { b.onclick = function () { buy(b.dataset.buy); }; });
      grid.querySelectorAll('[data-cancel]').forEach(function (b) { b.onclick = async function () {
        if (!confirm(t('cancelQ', { p: svcName(b.dataset.cancel) }))) return;
        b.disabled = true;
        try { var rc = await fn('payments', { action: 'store_cancel', client_id: cid, product: b.dataset.cancel }); C.msg(m, t(rc.now ? 'cancelledNow' : 'cancelled'), 'ok'); if (rc.now) setTimeout(function () { C.reload(); }, 1500); }
        catch (e) { b.disabled = false; C.msg(m, e.message, 'error'); }
      }; });
    }
    function medir() {
      var nova = cabem(grid.clientWidth, grid.clientHeight);
      if (nova.cols === medida.cols && nova.rows === medida.rows && nova.alt === medida.alt) return;
      var primeiro = medida.n ? pag * medida.n : 0; // mantém na tela o primeiro card que estava visível
      medida = nova; pag = nova.n ? Math.floor(primeiro / nova.n) : 0; draw();
    }
    view.querySelector('#sv-ant').onclick = function () { if (pag > 0) { pag--; draw(); } };
    view.querySelector('#sv-prox').onclick = function () { pag++; draw(); };
    view.querySelector('.sv-fit').onkeydown = function (e) { if (e.target.tagName === 'INPUT' || pager.hidden) return; if (e.key === 'ArrowRight') view.querySelector('#sv-prox').click(); if (e.key === 'ArrowLeft') view.querySelector('#sv-ant').click(); };
    var busca = view.querySelector('#ad-q');
    if (busca) busca.oninput = function (e) { q = e.target.value; pag = 0; draw(); };
    view.querySelectorAll('.ad-chip').forEach(function (b) { b.onclick = function () { cat = b.dataset.cat; pag = 0; view.querySelectorAll('.ad-chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); }; });
    draw();
    // mede quando a página assenta e sempre que a janela muda de tamanho
    if (svObs) svObs.disconnect();
    if (window.ResizeObserver) { svObs = new ResizeObserver(function () { if (document.contains(grid)) medir(); }); svObs.observe(grid); }
    requestAnimationFrame(medir);
    if (orderBack) waitOrder(orderBack, null);
  }
  async function buy(code) {
    var o = C.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(svcName(code)) + ' · ' + t('paying') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div><div id="tl-co" style="min-height:24rem"><p class="portal-muted">' + t('loading') + '</p></div><div class="portal-alert" id="tl-com" role="alert"></div>');
    o.querySelector('.drawer').classList.add('drawer--wide');
    try {
      var s = await fn('payments', { action: 'store_checkout', client_id: C.S.client.id, product: code, lang: L });
      var Stripe = await EStore.loadStripe();
      var box = o.querySelector('#tl-co'); box.innerHTML = '';
      var co = await Stripe(s.publishable_key).initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(s.client_secret); }, onComplete: function () { try { co.destroy(); } catch (e) { /* ignore */ } waitOrder(s.order_id, box); } });
      co.mount(box);
      var closeBtn = o.querySelector('.close-x'); closeBtn.onclick = function () { try { co.destroy(); } catch (e) { /* ignore */ } C.closeOverlay(); };
    } catch (e) { C.msg(o.querySelector('#tl-com'), t('payErr') + ': ' + e.message, 'error'); o.querySelector('#tl-co').innerHTML = ''; }
  }
  async function waitOrder(orderId, box) {
    var m = box || document.getElementById('sv-m');
    if (m) { if (box) box.innerHTML = '<p class="portal-muted">' + t('checking') + '</p>'; else C.msg(m, t('checking'), 'info'); }
    var r = null;
    for (var i = 0; i < 12; i++) {
      try { r = await fn('payments', { action: 'store_status', order_id: orderId }); } catch (e) { r = null; }
      if (r && (r.status === 'fulfilled' || r.failed)) break;
      await new Promise(function (ok) { setTimeout(ok, 2500); });
    }
    C.closeOverlay();
    await C.reload();
    if (r && r.status === 'fulfilled') setTimeout(function () { var mm = document.getElementById('sv-m'); if (mm) C.msg(mm, t('activated', { p: svcName(r.product) }), 'ok'); }, 300);
  }


  /* ---------------- CRM ---------------- */
  async function crm(view) {
    var cid = C.S.client.id, mode = C.param('v') === 'list' ? 'list' : 'board', term = '';
    var list = await C.q(C.sb.from('ct_contacts').select('*').eq('client_id', cid).order('updated_at', { ascending: false }).limit(2000));
    var today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
    function kpis() {
      var open = list.filter(function (c) { return ['new', 'contacted', 'proposal'].indexOf(c.stage) > -1; });
      return '<div class="kpis">' + C.kpi(t('k_contacts'), list.length) + C.kpi(t('k_open'), money(open.reduce(function (a, c) { return a + Number(c.value_cents || 0); }, 0))) +
        C.kpi(t('k_won'), money(list.filter(function (c) { return c.stage === 'won' && String(c.updated_at).slice(0, 7) === month; }).reduce(function (a, c) { return a + Number(c.value_cents || 0); }, 0))) +
        C.kpi(t('k_todo'), open.filter(function (c) { return c.next_action_at && c.next_action_at <= today; }).length) + '</div>';
    }
    function match(c) { var q = term.toLowerCase(); return !q || [c.name, c.email, c.company, c.phone].some(function (x) { return String(x || '').toLowerCase().indexOf(q) > -1; }); }
    function cardH(c) {
      var late = c.next_action_at && c.next_action_at <= today && ['won', 'lost'].indexOf(c.stage) < 0;
      return '<button type="button" class="crm-card" data-id="' + c.id + '"><strong>' + esc(c.name) + '</strong>' + (c.company ? '<span>' + esc(c.company) + '</span>' : '') +
        (c.value_cents ? '<span class="crm-card__v">' + money(c.value_cents) + '</span>' : '') + (c.next_action ? '<span class="crm-card__n' + (late ? ' is-late' : '') + '">→ ' + esc(c.next_action) + (c.next_action_at ? ' · ' + esc(C.fmtDate(c.next_action_at)) : '') + '</span>' : '') + '</button>';
    }
    function body() {
      var f = list.filter(match);
      if (!list.length) return '<div class="portal-card empty-state"><p>' + t('noContacts') + '</p></div>';
      if (mode === 'board') return '<div class="crm-board">' + STAGES.map(function (s) { var col = f.filter(function (c) { return c.stage === s; }); return '<section class="crm-col"><h2 class="crm-col__h">' + t('st_' + s) + ' <span>' + col.length + '</span></h2>' + col.map(cardH).join('') + '</section>'; }).join('') + '</div>';
      return '<div class="table-wrap portal-card"><table class="data"><thead><tr><th>' + t('name') + '</th><th>' + t('company') + '</th><th>' + t('stage') + '</th><th class="num">' + t('value') + '</th><th>' + t('next') + '</th></tr></thead><tbody>' +
        f.map(function (c) { return '<tr data-id="' + c.id + '" style="cursor:pointer"><td><strong>' + esc(c.name) + '</strong><div class="portal-muted" style="font-size:.8rem">' + esc(c.email || c.phone || '') + '</div></td><td>' + esc(c.company || '') + '</td><td><span class="pill">' + t('st_' + c.stage) + '</span></td><td class="num">' + (c.value_cents ? money(c.value_cents) : '') + '</td><td>' + esc(c.next_action || '') + (c.next_action_at ? ' <span class="portal-muted">' + esc(C.fmtDate(c.next_action_at)) + '</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    function paint() {
      view.innerHTML = C.head(t('nav_crm'), t('crm_lead'), '<button class="btn btn--navy btn--sm" type="button" id="crm-new">＋ ' + t('newContact') + '</button>') + kpis() +
        '<div class="toolbar" style="margin-top:1rem"><input id="crm-q" type="search" placeholder="' + t('search') + '" value="' + esc(term) + '" style="flex:1;min-width:12rem"><div class="seg"><a href="#/crm" class="btn btn--xs ' + (mode === 'board' ? 'btn--navy' : 'btn--ghost') + '">' + t('board') + '</a><a href="#/crm?v=list" class="btn btn--xs ' + (mode === 'list' ? 'btn--navy' : 'btn--ghost') + '">' + t('list') + '</a></div></div><div id="crm-body">' + body() + '</div>';
      view.querySelector('#crm-new').onclick = function () { edit(null); };
      var qi = view.querySelector('#crm-q'); qi.oninput = function () { term = qi.value; view.querySelector('#crm-body').innerHTML = body(); wire(); };
      wire();
    }
    function wire() { view.querySelectorAll('[data-id]').forEach(function (b) { b.onclick = function () { edit(list.find(function (c) { return c.id === b.dataset.id; })); }; }); }
    async function edit(c) {
      var notes = c ? await C.q(C.sb.from('ct_notes').select('*').eq('contact_id', c.id).order('created_at', { ascending: false })) : [];
      c = c || { stage: 'new' };
      var f = function (id, k, type, extra) { return '<div class="field"><label for="' + id + '">' + t(k) + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(c[id.replace('cc-', '')] == null ? '' : c[id.replace('cc-', '')]) + '" ' + (extra || '') + '></div>'; };
      var o = C.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(c.id ? c.name : t('newContact')) + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
        '<form class="portal-form" id="cc-f">' + f('cc-name', 'name', 'text', 'required maxlength="160"') + '<div class="portal-grid2">' + f('cc-email', 'email', 'email', 'maxlength="254"') + f('cc-phone', 'phone', 'tel', 'maxlength="40"') + '</div>' +
        '<div class="portal-grid2">' + f('cc-company', 'company', 'text', 'maxlength="160"') + f('cc-source', 'source', 'text', 'maxlength="60"') + '</div>' +
        '<div class="portal-grid2"><div class="field"><label for="cc-stage">' + t('stage') + '</label><select id="cc-stage">' + STAGES.map(function (s) { return '<option value="' + s + '"' + (c.stage === s ? ' selected' : '') + '>' + t('st_' + s) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="cc-value">' + t('value') + '</label><input id="cc-value" type="number" min="0" step="1" value="' + (c.value_cents ? Math.round(c.value_cents / 100) : '') + '"></div></div>' +
        '<div class="portal-grid2">' + f('cc-next_action', 'next', 'text', 'maxlength="300"') + f('cc-next_action_at', 'nextAt', 'date') + '</div>' +
        '<div class="field"><label for="cc-notes">' + t('notes') + '</label><textarea id="cc-notes" rows="3" maxlength="4000">' + esc(c.notes || '') + '</textarea></div>' +
        '<div class="portal-alert" id="cc-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + t('save') + '</button>' + (c.id ? '<button class="btn btn--ghost" type="button" id="cc-del">' + t('del') + '</button>' : '') + '</div></form>' +
        (c.id ? '<h3 class="portal-h2" style="margin-top:1.5rem">' + t('history') + '</h3><form id="cn-f" class="portal-form"><textarea id="cn-b" rows="2" maxlength="4000" placeholder="' + t('notePh') + '"></textarea><button class="btn btn--ghost btn--sm" type="submit">' + t('addNote') + '</button></form><ul class="crm-notes">' +
          notes.map(function (n) { return '<li><span class="portal-muted">' + esc(C.fmtDT(n.created_at)) + (n.created_by === 'agenda' ? ' · ' + t('nav_agenda') : '') + '</span><p>' + esc(n.body) + '</p></li>'; }).join('') + '</ul>' : ''));
      o.querySelector('.drawer').classList.add('drawer--wide');
      var $o = function (s) { return o.querySelector(s); };
      $o('#cc-f').onsubmit = async function (e) {
        e.preventDefault();
        var v = function (id) { var x = $o('#cc-' + id).value.trim(); return x || null; };
        var row = { client_id: cid, name: v('name'), email: v('email'), phone: v('phone'), company: v('company'), source: v('source'), stage: $o('#cc-stage').value,
          value_cents: Math.max(0, Math.round(Number($o('#cc-value').value || 0) * 100)), next_action: v('next_action'), next_action_at: v('next_action_at'), notes: v('notes') };
        if (!row.name) return C.msg($o('#cc-m'), t('name'), 'error');
        var r = c.id ? await C.sb.from('ct_contacts').update(row).eq('id', c.id).select('*').single() : await C.sb.from('ct_contacts').insert(row).select('*').single();
        if (r.error) return C.msg($o('#cc-m'), C.errText(r.error), 'error');
        if (c.id) list = list.map(function (x) { return x.id === c.id ? r.data : x; }); else list.unshift(r.data);
        C.closeOverlay(); paint();
      };
      if ($o('#cc-del')) $o('#cc-del').onclick = async function () { if (!confirm(t('delQ'))) return; var r = await C.sb.from('ct_contacts').delete().eq('id', c.id); if (r.error) return C.msg($o('#cc-m'), C.errText(r.error), 'error'); list = list.filter(function (x) { return x.id !== c.id; }); C.closeOverlay(); paint(); };
      if ($o('#cn-f')) $o('#cn-f').onsubmit = async function (e) { e.preventDefault(); var b = $o('#cn-b').value.trim(); if (!b) return; var r = await C.sb.from('ct_notes').insert({ contact_id: c.id, client_id: cid, body: b, created_by: C.S.user.email }); if (r.error) return alert(C.errText(r.error)); edit(c); };
    }
    paint();
  }

  /* ---------------- Agenda ---------------- */
  var TZS = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Sao_Paulo', 'America/Asuncion', 'America/Argentina/Buenos_Aires', 'America/Mexico_City', 'America/Bogota', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid'];
  function bookUrl(slug) { return C.siteUrl('agendar.html') + '?p=' + encodeURIComponent(slug) + '&lang=' + L; }
  function slugify(s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'agenda'; }
  async function agenda(view) {
    var cid = C.S.client.id;
    var page = (await C.q(C.sb.from('ct_booking_pages').select('*').eq('client_id', cid)))[0] || null;
    var appts = page ? await C.q(C.sb.from('ct_appointments').select('*').eq('client_id', cid).order('start_at', { ascending: true }).limit(500)) : [];
    var now = new Date().toISOString();
    var up = appts.filter(function (a) { return a.status === 'confirmed' && a.end_at >= now; }), old = appts.filter(function (a) { return !(a.status === 'confirmed' && a.end_at >= now); }).reverse().slice(0, 30);
    var p = page || { slug: slugify(C.S.client.name), title: C.S.client.name, duration_min: 30, buffer_min: 0, timezone: 'America/New_York', location_kind: 'video', min_notice_hours: 4, max_days_ahead: 45, active: true, blackouts: [],
      rules: { 1: [['09:00', '17:00']], 2: [['09:00', '17:00']], 3: [['09:00', '17:00']], 4: [['09:00', '17:00']], 5: [['09:00', '17:00']] }, notify_email: C.S.user.email };
    function apptRow(a, cancel) {
      return '<li class="ag-item"><div><strong>' + esc(new Intl.DateTimeFormat(C.locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(a.start_at))) + '</strong> · ' + esc(a.name) +
        '<div class="portal-muted" style="font-size:.85rem">' + esc(a.email) + (a.phone ? ' · ' + esc(a.phone) : '') + (a.notes ? ' — ' + esc(a.notes) : '') + '</div></div>' +
        (cancel ? '<button class="btn btn--ghost btn--xs" type="button" data-cx="' + a.id + '">' + t('cancelAppt') + '</button>' : '<span class="pill">' + t('st_' + a.status) + '</span>') + '</li>';
    }
    var dayRows = [1, 2, 3, 4, 5, 6, 7].map(function (d) {
      var iv = (p.rules && p.rules[d]) || [], a = iv[0] || ['09:00', '17:00'], b = iv[1] || ['', ''];
      return '<div class="ag-day"><label class="ag-day__on"><input type="checkbox" data-on="' + d + '"' + (iv.length ? ' checked' : '') + '> ' + t('days')[d - 1] + '</label>' +
        '<span>' + t('from') + ' <input type="time" data-a1="' + d + '" value="' + a[0] + '"> ' + t('to') + ' <input type="time" data-a2="' + d + '" value="' + a[1] + '"></span>' +
        '<span class="portal-muted">' + t('and') + ' <input type="time" data-b1="' + d + '" value="' + (b[0] || '') + '"> ' + t('to') + ' <input type="time" data-b2="' + d + '" value="' + (b[1] || '') + '"></span></div>';
    }).join('');
    view.innerHTML = C.head(t('nav_agenda'), t('ag_lead')) +
      (page ? '<section class="portal-card"><h2 class="portal-h2">' + t('ag_link') + '</h2><div class="toolbar" style="align-items:center"><input readonly id="ag-url" value="' + esc(bookUrl(page.slug)) + '" style="flex:1;min-width:14rem"><button class="btn btn--navy btn--sm" type="button" id="ag-copy">' + t('copy') + '</button><a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + esc(bookUrl(page.slug)) + '">' + t('openPage') + '</a></div></section>' : '') +
      (page ? '<section class="portal-card"><h2 class="portal-h2">' + t('upcoming') + '</h2>' + (up.length ? '<ul class="ag-list">' + up.map(function (a) { return apptRow(a, true); }).join('') + '</ul>' : '<p class="portal-muted">' + t('noAppts') + '</p>') + '<div class="portal-alert" id="ag-cm" role="status"></div>' +
        (old.length ? '<details style="margin-top:1rem"><summary>' + t('past') + '</summary><ul class="ag-list">' + old.map(function (a) { return apptRow(a, false); }).join('') + '</ul></details>' : '') + '</section>' : '') +
      '<section class="portal-card"><h2 class="portal-h2">' + (page ? t('ag_settings') : t('ag_setup')) + '</h2><form class="portal-form" id="ag-f">' +
        '<div class="portal-grid2"><div class="field"><label for="ag-slug">' + t('slug') + '</label><input id="ag-slug" value="' + esc(p.slug) + '" maxlength="40" required pattern="[a-z0-9-]{3,40}"></div><div class="field"><label for="ag-title">' + t('title') + '</label><input id="ag-title" value="' + esc(p.title) + '" maxlength="120" required></div></div>' +
        '<div class="field"><label for="ag-desc">' + t('desc') + '</label><textarea id="ag-desc" rows="2" maxlength="1000">' + esc(p.description || '') + '</textarea></div>' +
        '<div class="portal-grid2"><div class="field"><label for="ag-dur">' + t('dur') + '</label><input id="ag-dur" type="number" min="10" max="240" step="5" value="' + p.duration_min + '"></div><div class="field"><label for="ag-buf">' + t('buffer') + '</label><input id="ag-buf" type="number" min="0" max="120" step="5" value="' + p.buffer_min + '"></div></div>' +
        '<div class="portal-grid2"><div class="field"><label for="ag-tz">' + t('tz') + '</label><select id="ag-tz">' + TZS.concat(TZS.indexOf(p.timezone) < 0 ? [p.timezone] : []).map(function (z) { return '<option' + (z === p.timezone ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="ag-loc">' + t('loc') + '</label><select id="ag-loc">' + [['video', 'video'], ['phone', 'phoneCall'], ['in_person', 'in_person']].map(function (x) { return '<option value="' + x[0] + '"' + (p.location_kind === x[0] ? ' selected' : '') + '>' + t(x[1]) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="field"><label for="ag-meet">' + t('meet') + '</label><textarea id="ag-meet" rows="2" maxlength="500">' + esc(p.meeting_info || '') + '</textarea></div>' +
        '<div class="portal-grid2"><div class="field"><label for="ag-not">' + t('notice') + '</label><input id="ag-not" type="number" min="0" max="336" value="' + p.min_notice_hours + '"></div><div class="field"><label for="ag-ahead">' + t('ahead') + '</label><input id="ag-ahead" type="number" min="1" max="180" value="' + p.max_days_ahead + '"></div></div>' +
        '<div class="field"><label for="ag-mail">' + t('notify') + '</label><input id="ag-mail" type="email" maxlength="254" value="' + esc(p.notify_email || '') + '"></div>' +
        '<fieldset class="ag-hours"><legend class="portal-h2" style="font-size:1rem">' + t('hours') + '</legend>' + dayRows + '</fieldset>' +
        '<div class="field"><label for="ag-off">' + t('off') + '</label><textarea id="ag-off" rows="2">' + esc((p.blackouts || []).join('\n')) + '</textarea></div>' +
        '<div class="check-row"><input type="checkbox" id="ag-act"' + (p.active ? ' checked' : '') + '><label for="ag-act">' + t('activeP') + '</label></div>' +
        '<div class="portal-alert" id="ag-m" role="alert"></div><button class="btn btn--navy" type="submit">' + t('save') + '</button></form></section>';
    var $v = function (s) { return view.querySelector(s); };
    if ($v('#ag-copy')) $v('#ag-copy').onclick = function () { copyText($v('#ag-url').value, this); };
    view.querySelectorAll('[data-cx]').forEach(function (b) { b.onclick = async function () {
      var a = appts.find(function (x) { return x.id === b.dataset.cx; });
      if (!confirm(t('cancelApptQ', { n: a.name }))) return;
      b.disabled = true;
      try { await fn('tools', { action: 'agenda_owner_cancel', appointment_id: a.id, lang: L }); agenda(view); } catch (e) { b.disabled = false; C.msg($v('#ag-cm'), e.message, 'error'); }
    }; });
    $v('#ag-f').onsubmit = async function (e) {
      e.preventDefault();
      var m = $v('#ag-m'), slug = $v('#ag-slug').value.trim().toLowerCase();
      if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return C.msg(m, t('e_slugFmt'), 'error');
      var rules = {};
      [1, 2, 3, 4, 5, 6, 7].forEach(function (d) {
        if (!view.querySelector('[data-on="' + d + '"]').checked) return;
        var iv = [], a1 = view.querySelector('[data-a1="' + d + '"]').value, a2 = view.querySelector('[data-a2="' + d + '"]').value, b1 = view.querySelector('[data-b1="' + d + '"]').value, b2 = view.querySelector('[data-b2="' + d + '"]').value;
        if (a1 && a2 && a1 < a2) iv.push([a1, a2]);
        if (b1 && b2 && b1 < b2) iv.push([b1, b2]);
        if (iv.length) rules[d] = iv;
      });
      var row = { client_id: cid, slug: slug, title: $v('#ag-title').value.trim(), description: $v('#ag-desc').value.trim() || null, duration_min: +$v('#ag-dur').value || 30, buffer_min: +$v('#ag-buf').value || 0,
        timezone: $v('#ag-tz').value, location_kind: $v('#ag-loc').value, meeting_info: $v('#ag-meet').value.trim() || null, min_notice_hours: +$v('#ag-not').value || 0, max_days_ahead: +$v('#ag-ahead').value || 45,
        notify_email: $v('#ag-mail').value.trim() || null, rules: rules, active: $v('#ag-act').checked,
        blackouts: $v('#ag-off').value.split(/[\s,;]+/).filter(function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); }) };
      var r = page ? await C.sb.from('ct_booking_pages').update(row).eq('id', page.id) : await C.sb.from('ct_booking_pages').insert(row);
      if (r.error) return C.msg(m, /duplicate|unique/i.test(r.error.message) ? t('e_slug') : C.errText(r.error), 'error');
      agenda(view).then(function () { var mm = view.querySelector('#ag-m'); if (mm) C.msg(mm, t('saved'), 'ok'); });
    };
  }

  /* ---------------- E-signature ---------------- */
  function signLink(e) { return C.siteUrl('sign.html') + '?t=' + encodeURIComponent(e.token) + '&lang=' + L; }
  async function openDoc(path) { var r = await C.sb.storage.from('documents').createSignedUrl(path, 300); if (r.error) return alert(C.errText(r.error)); window.open(r.data.signedUrl, '_blank', 'noopener'); }
  async function esign(view) {
    var cid = C.S.client.id;
    if (C.param('novo')) return editor(view);
    view.classList.remove('is-editor');
    var list = await C.q(C.sb.from('envelopes').select('id, title, signer_name, signer_email, status, created_at, signed_at, token, token_expires_at, document_path, signed_document_path').eq('client_id', cid).order('created_at', { ascending: false }).limit(300));
    view.innerHTML = C.head(t('nav_esign'), t('es_lead'), '<a class="btn btn--navy btn--sm" href="#/assinaturas?novo=1">＋ ' + t('newDoc') + '</a>') + '<div class="portal-alert" id="es-m" role="status"></div>' +
      (list.length ? '<div class="table-wrap portal-card"><table class="data"><thead><tr><th>' + t('doc') + '</th><th>' + t('signer') + '</th><th>' + t('sent') + '</th><th>' + t('status') + '</th><th></th></tr></thead><tbody>' + list.map(function (e) {
        var open = e.status === 'sent' || e.status === 'viewed';
        return '<tr><td><strong>' + esc(e.title) + '</strong></td><td>' + esc(e.signer_name) + '<div class="portal-muted" style="font-size:.8rem">' + esc(e.signer_email) + '</div></td><td>' + esc(C.fmtDate(e.created_at)) + '</td><td><span class="pill' + (e.status === 'signed' ? ' pill--report' : '') + '">' + t('s_' + e.status) + '</span>' + (e.signed_at ? '<div class="portal-muted" style="font-size:.8rem">' + esc(C.fmtDT(e.signed_at)) + '</div>' : '') + '</td><td><div class="portal-btn-row" style="justify-content:flex-end">' +
          (e.status === 'signed' ? '<button class="btn btn--navy btn--xs" type="button" data-open="' + esc(e.signed_document_path) + '">' + t('signedDoc') + '</button>' : '<button class="btn btn--ghost btn--xs" type="button" data-open="' + esc(e.document_path) + '">' + t('viewDoc') + '</button>') +
          (open ? '<button class="btn btn--ghost btn--xs" type="button" data-copy="' + e.id + '">' + t('copyLink') + '</button><button class="btn btn--ghost btn--xs" type="button" data-mail="' + e.id + '">' + t('resend') + '</button><button class="btn btn--ghost btn--xs" type="button" data-void="' + e.id + '">' + t('voidB') + '</button>' : '') +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="portal-card empty-state"><p>' + t('noDocs') + '</p><a class="btn btn--navy" href="#/assinaturas?novo=1">' + t('newDoc') + '</a></div>');
    var m = view.querySelector('#es-m'), find = function (id) { return list.find(function (x) { return x.id === id; }); };
    view.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { openDoc(b.dataset.open); }; });
    view.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { copyText(signLink(find(b.dataset.copy)), b); C.sb.from('envelope_events').insert({ envelope_id: b.dataset.copy, event: 'link_copied' }).then(function () {}); }; });
    view.querySelectorAll('[data-mail]').forEach(function (b) { b.onclick = async function () { b.disabled = true; try { await fn('tools', { action: 'esign_mail', envelope_id: b.dataset.mail, lang: L }); C.msg(m, t('mailed', { e: find(b.dataset.mail).signer_email }), 'ok'); } catch (e) { C.msg(m, e.message, 'error'); } b.disabled = false; }; });
    view.querySelectorAll('[data-void]').forEach(function (b) { b.onclick = async function () { if (!confirm(t('voidQ'))) return; var r = await C.sb.rpc('client_void_envelope', { p_id: b.dataset.void }); if (r.error || !r.data) return C.msg(m, C.errText(r.error || t('generic')), 'error'); esign(view); }; });
  }
  function editor(view) {
    if (!window.EndeavorEditor || !window.PDFLib) { view.innerHTML = '<div class="portal-alert portal-alert--error">' + t('generic') + '</div>'; return; }
    view.classList.add('is-editor');
    EndeavorEditor.mount(view, { sb: C.sb, CFG: C.CFG, esc: C.esc, msg: C.msg, errText: C.errText, sha256Hex: C.sha256Hex, leads: [], clientId: C.S.client.id,
      emailSigner: async function (e) { try { await fn('tools', { action: 'esign_mail', envelope_id: e.id, lang: L }); return true; } catch (x) { return false; } },
      onCancel: function () { view.classList.remove('is-editor'); location.hash = '#/assinaturas'; },
      onDone: function (e, mailed) {
        view.classList.remove('is-editor');
        history.replaceState(null, '', location.pathname + location.search + '#/assinaturas');
        view.innerHTML = C.head(t('docSent')) + '<section class="portal-card"><p class="portal-alert portal-alert--ok">' + esc(mailed ? t('docSentMail', { e: e.signer_email }) : t('docSentLink')) + '</p>' +
          '<div class="field"><label for="es-link">' + t('copyLink') + '</label><input id="es-link" readonly value="' + esc(signLink(e)) + '"></div><div class="portal-btn-row"><button class="btn btn--navy" type="button" id="es-copy">' + t('copyLink') + '</button><a class="btn btn--ghost" href="#/assinaturas">' + t('backList') + '</a></div></section>';
        view.querySelector('#es-copy').onclick = function () { copyText(signLink(e), this); };
      }
    });
  }

  /* ---------------- Bookkeeping ---------------- */
  /* Bookkeeping como serviço do pacote (a Endeavor faz a contabilidade): painel de relatórios, pedido de relatório e conector de contas.
     Quem comprou o Bookkeeping avulso continua com a página da ferramenta (books). */
  var BKP = {
    en: { lead: 'Endeavor keeps the books of your company. Here are your reports and your connected accounts.', ytd: 'Year to date · {y}', rev: 'Revenue', exp: 'Expenses', net: 'Net income', ytdNone: 'The numbers of {y} appear here when the first report of the year is published.', upTo: 'Published through {d}',
      reps: 'Reports', repsLead: 'Profit and Loss, Balance Sheet and Cash Flow of the last 3 years.', none: 'No reports published for {y} yet.', period: 'Period', full: 'Full year', open: 'Open PDF', notYet: '—', ask: 'Request a report', askT: 'Request a report', askWhat: 'Which report do you need?', askPeriod: 'Period', askNote: 'Details (optional)', askSend: 'Send request', askOk: 'Request sent. Our team will prepare the report and let you know.', cancel: 'Cancel',
      accts: 'Connected accounts', acctsLead: 'Connect the bank account and the card of your company. Endeavor reads the transactions to keep your books.', st_ok: 'Connected', st_err: 'Needs attention', lastSync: 'Last update: {d}', pl: 'P&L', bs: 'Balance Sheet', cf: 'Cash Flow', other: 'Other' },
    pt: { lead: 'A Endeavor faz a contabilidade da sua empresa. Aqui estão os seus relatórios e as contas conectadas.', ytd: 'Ano até hoje · {y}', rev: 'Receita', exp: 'Despesas', net: 'Lucro', ytdNone: 'Os números de {y} aparecem aqui quando o primeiro relatório do ano for publicado.', upTo: 'Publicado até {d}',
      reps: 'Relatórios', repsLead: 'P&L, Balance Sheet e Fluxo de caixa dos últimos 3 anos.', none: 'Nenhum relatório publicado para {y} ainda.', period: 'Período', full: 'Ano inteiro', open: 'Abrir PDF', notYet: '—', ask: 'Solicitar relatório', askT: 'Solicitar relatório', askWhat: 'Qual relatório você precisa?', askPeriod: 'Período', askNote: 'Detalhes (opcional)', askSend: 'Enviar pedido', askOk: 'Pedido enviado. A nossa equipe prepara o relatório e avisa você.', cancel: 'Cancelar',
      accts: 'Contas conectadas', acctsLead: 'Conecte a conta bancária e o cartão da sua empresa. A Endeavor lê as transações para fazer a sua contabilidade.', st_ok: 'Conectada', st_err: 'Precisa de atenção', lastSync: 'Última atualização: {d}', pl: 'P&L', bs: 'Balance Sheet', cf: 'Fluxo de caixa', other: 'Outro' },
    es: { lead: 'Endeavor lleva la contabilidad de su empresa. Aquí están sus informes y las cuentas conectadas.', ytd: 'Año hasta hoy · {y}', rev: 'Ingresos', exp: 'Gastos', net: 'Utilidad', ytdNone: 'Los números de {y} aparecen aquí cuando se publique el primer informe del año.', upTo: 'Publicado hasta {d}',
      reps: 'Informes', repsLead: 'Estado de resultados, balance y flujo de caja de los últimos 3 años.', none: 'Aún no hay informes publicados para {y}.', period: 'Período', full: 'Año completo', open: 'Abrir PDF', notYet: '—', ask: 'Solicitar informe', askT: 'Solicitar informe', askWhat: '¿Qué informe necesita?', askPeriod: 'Período', askNote: 'Detalles (opcional)', askSend: 'Enviar pedido', askOk: 'Pedido enviado. Nuestro equipo prepara el informe y le avisa.', cancel: 'Cancelar',
      accts: 'Cuentas conectadas', acctsLead: 'Conecte la cuenta bancaria y la tarjeta de su empresa. Endeavor lee las transacciones para llevar su contabilidad.', st_ok: 'Conectada', st_err: 'Requiere atención', lastSync: 'Última actualización: {d}', pl: 'Resultados', bs: 'Balance', cf: 'Flujo de caja', other: 'Otro' }
  };
  function bk(k, v) { var x = (BKP[L] || BKP.en)[k] || k; Object.keys(v || {}).forEach(function (n) { x = x.split('{' + n + '}').join(v[n]); }); return x; }
  var TIPOS = [['ProfitAndLoss', 'pl'], ['BalanceSheet', 'bs'], ['CashFlow', 'cf']];
  /** Receita, despesas e lucro do ano com o que já foi publicado: o ano inteiro, se houver; senão, a soma dos trimestres. */
  function ytdDe(reps, ano) {
    var pl = reps.filter(function (r) { return r.report_type === 'ProfitAndLoss' && String(r.start_date).slice(0, 4) === String(ano) && r.data; });
    var cheio = pl.filter(function (r) { return String(r.start_date).slice(5) === '01-01' && String(r.end_date).slice(5) === '12-31'; })[0];
    var usar = cheio ? [cheio] : pl.filter(function (r) { return !(String(r.start_date).slice(5) === '01-01' && String(r.end_date).slice(5) === '12-31'); });
    if (!usar.length) return null;
    var tot = function (d, k) { var s = (d.sections || []).filter(function (x) { return x.key === k; })[0]; return s ? Number(s.total || 0) : 0; };
    var o = { rev: 0, exp: 0, net: 0, ate: '' };
    usar.forEach(function (r) { o.rev += tot(r.data, 'income') + tot(r.data, 'other_income'); o.exp += tot(r.data, 'cogs') + tot(r.data, 'expense') + tot(r.data, 'other_expense'); o.net += Number(r.data.net_income || 0); if (String(r.end_date) > o.ate) o.ate = String(r.end_date); });
    return o;
  }
  async function booksPainel(view, cos) {
    var cid = C.S.client.id, co = cos.find(function (c) { return c.id === C.param('co'); }) || cos[0], ano = new Date().getFullYear(), anos = [ano, ano - 1, ano - 2];
    var res = await Promise.all([
      C.sb.from('financial_reports').select('id, period_label, start_date, end_date, report_type, document_id, data').eq('company_id', co.id).gte('start_date', (ano - 2) + '-01-01').order('start_date', { ascending: false }),
      C.sb.rpc('client_bk_status', { p_company: co.id })]);
    var reps = (res[0] && res[0].data) || [], st = (res[1] && res[1].data) || { connections: [], accounts: [] };
    var sel = +C.param('y') || ano; if (anos.indexOf(sel) < 0) sel = ano;
    var y = ytdDe(reps, ano), dinheiro = function (c) { return money(c); }, dataCurta = function (d) { return C.fmtDate ? C.fmtDate(d) : d; };
    var conex = st.connections || [], ult = conex.reduce(function (a, c) { return c.last_sync_at && (!a || c.last_sync_at > a) ? c.last_sync_at : a; }, null);
    function tabela(a) {
      var doAno = reps.filter(function (r) { return String(r.start_date).slice(0, 4) === String(a); });
      if (!doAno.length) return '<p class="portal-muted" style="margin:.5rem 0 0">' + bk('none', { y: a }) + '</p>';
      var periodos = []; doAno.forEach(function (r) { var k = r.start_date + '|' + r.end_date; if (!periodos.some(function (p) { return p.k === k; })) periodos.push({ k: k, label: r.period_label, s: r.start_date, e: r.end_date }); });
      periodos.sort(function (p, q) { return p.s < q.s ? -1 : p.s > q.s ? 1 : (p.e < q.e ? -1 : 1); });
      return '<div class="table-wrap"><table class="data bkp-tab"><thead><tr><th>' + bk('period') + '</th>' + TIPOS.map(function (tp) { return '<th>' + bk(tp[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' + periodos.map(function (p) {
        var cheio = String(p.s).slice(5) === '01-01' && String(p.e).slice(5) === '12-31';
        return '<tr><td><strong>' + esc(cheio ? bk('full') : p.label || (p.s + ' – ' + p.e)) + '</strong></td>' + TIPOS.map(function (tp) { var r = doAno.filter(function (x) { return x.report_type === tp[0] && x.start_date === p.s && x.end_date === p.e; })[0];
          return '<td>' + (r && r.document_id ? '<button class="btn btn--ghost btn--xs" type="button" data-rep="' + r.document_id + '">' + bk('open') + '</button>' : '<span class="portal-muted">' + bk('notYet') + '</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    view.innerHTML = C.head(t('nav_books'), bk('lead'), '<button class="btn btn--gold btn--sm" type="button" id="bkp-ask">' + bk('ask') + '</button>') +
      (cos.length > 1 ? '<div class="toolbar"><select id="bk-co" aria-label="' + esc(t('nav_books')) + '">' + cos.map(function (c) { return '<option value="' + c.id + '"' + (c.id === co.id ? ' selected' : '') + '>' + esc(c.legal_name) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="portal-alert" id="bk-m" role="status"></div>' +
      '<section class="portal-card bkp-ytd" id="bkp-ytd"><div class="bil-plano__top"><h2 class="portal-h2">' + bk('ytd', { y: ano }) + ' · ' + esc(co.legal_name) + '</h2>' + (y && y.ate ? '<span class="portal-muted" style="font-size:.85rem">' + esc(bk('upTo', { d: dataCurta(y.ate) })) + '</span>' : '') + '</div>' +
        (y ? '<div class="kpis">' + C.kpi(bk('rev'), dinheiro(y.rev), true) + C.kpi(bk('exp'), dinheiro(y.exp), true) + C.kpi(bk('net'), dinheiro(y.net), true) + '</div>' : '<p class="portal-muted" style="margin:0">' + bk('ytdNone', { y: ano }) + '</p>') + '</section>' +
      '<div class="bkp-grid"><section class="portal-card" id="bkp-reps"><div class="bil-plano__top"><h2 class="portal-h2">' + bk('reps') + '</h2><div class="seg" role="group" aria-label="' + bk('reps') + '">' + anos.map(function (a) { return '<button type="button" data-ano="' + a + '" aria-pressed="' + (a === sel) + '">' + a + '</button>'; }).join('') + '</div></div>' +
        '<p class="portal-muted" style="margin:-.25rem 0 .5rem;font-size:.9rem">' + bk('repsLead') + '</p><div id="bkp-lista">' + tabela(sel) + '</div></section>' +
      '<section class="portal-card" id="bkp-contas"><h2 class="portal-h2">' + bk('accts') + '</h2><p class="portal-muted" style="margin:-.25rem 0 .75rem;font-size:.9rem">' + bk('acctsLead') + '</p>' +
        ((st.accounts || []).length ? '<ul class="ag-list">' + st.accounts.map(function (a) { var cx = conex.filter(function (c) { return c.id === a.connection_id; })[0], ruim = cx && (cx.status === 'error' || cx.last_error);
          return '<li class="ag-item"><div><strong>' + esc(a.name) + '</strong>' + (a.mask ? ' ••' + esc(a.mask) : '') + '<div class="portal-muted" style="font-size:.85rem">' + (String(t('k_' + (a.kind || 'other'))).indexOf('k_') === 0 || t('k_' + (a.kind || 'other')) == null ? '' : t('k_' + (a.kind || 'other'))) + '</div></div><span class="inv-st inv-st--' + (ruim ? 'uncollectible' : 'paid') + '">' + bk(ruim ? 'st_err' : 'st_ok') + '</span></li>'; }).join('') + '</ul>'
          : '<p class="portal-muted">' + t('bk_none') + '</p>') +
        (ult ? '<p class="portal-muted" style="font-size:.85rem;margin:.6rem 0 0">' + esc(bk('lastSync', { d: C.fmtDT(ult) })) + '</p>' : '') +
        '<div class="portal-btn-row" style="margin-top:.9rem"><button class="btn btn--navy btn--sm" type="button" id="bk-bank">' + t('bk_bank') + '</button><button class="btn btn--ghost btn--sm" type="button" id="bk-card">' + t('bk_card') + '</button></div></section></div>';
    var abrir = function () { view.querySelectorAll('[data-rep]').forEach(function (b) { b.onclick = async function () {
      b.disabled = true;
      try { var d = (await C.sb.from('company_documents').select('*').eq('id', b.dataset.rep).single()).data; if (d && C.viewDoc) C.viewDoc(d); else location.hash = '#/reports?company=' + co.id; } catch (e) { location.hash = '#/reports?company=' + co.id; }
      b.disabled = false; }; }); };
    abrir();
    view.querySelectorAll('[data-ano]').forEach(function (b) { b.onclick = function () { view.querySelectorAll('[data-ano]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); view.querySelector('#bkp-lista').innerHTML = tabela(+b.dataset.ano); abrir(); }; });
    if (view.querySelector('#bk-co')) view.querySelector('#bk-co').onchange = function () { location.hash = '#/bookkeeping?co=' + this.value; };
    view.querySelector('#bk-bank').onclick = function () { connect(co, 'bank', view); };
    view.querySelector('#bk-card').onclick = function () { connect(co, 'card', view); };
    // pedir um relatório: vira aviso no sino da equipe e e-mail para o suporte
    view.querySelector('#bkp-ask').onclick = function () {
      var ov = C.openOverlay('<h2 class="portal-h2">' + bk('askT') + '</h2><form class="portal-form" id="bkp-f" novalidate>' +
        '<div class="field"><label for="bkp-tipo">' + bk('askWhat') + '</label><select id="bkp-tipo">' + TIPOS.map(function (tp) { return '<option>' + bk(tp[1]) + '</option>'; }).join('') + '<option>' + bk('other') + '</option></select></div>' +
        '<div class="field"><label for="bkp-per">' + bk('askPeriod') + '</label><input id="bkp-per" type="text" maxlength="80" placeholder="Q3 ' + ano + '"></div>' +
        '<div class="field"><label for="bkp-nota">' + bk('askNote') + '</label><textarea id="bkp-nota" rows="3" maxlength="400"></textarea></div>' +
        '<div class="portal-alert" id="bkp-fm" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + bk('askSend') + '</button><button class="btn btn--ghost" type="button" id="bkp-x">' + bk('cancel') + '</button></div></form>');
      var root = (ov && ov.querySelector) ? ov : document.getElementById('overlay') || document;
      root.querySelector('#bkp-x').onclick = function () { C.closeOverlay(); };
      root.querySelector('#bkp-f').onsubmit = async function (e) {
        e.preventDefault();
        var nota = [root.querySelector('#bkp-tipo').value, root.querySelector('#bkp-per').value.trim(), co.legal_name, root.querySelector('#bkp-nota').value.trim()].filter(Boolean).join(' · ');
        var btn = this.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await fn('payments', { action: 'store_request', client_id: cid, product: 'relatorio', note: nota });
          if (window.EP && EP.notify) EP.notify({ _subject: 'Pedido de relatório de Bookkeeping: ' + C.S.client.name, name: C.S.client.name, email: C.S.client.primary_email, pedido: nota });
          C.closeOverlay(); C.msg(view.querySelector('#bk-m'), bk('askOk'), 'ok');
        } catch (er) { btn.disabled = false; C.msg(root.querySelector('#bkp-fm'), er.message, 'error'); }
      };
    };
  }
  async function books(view) {
    var cos = (C.S.companies || []).filter(function (c) { return c.books_provider === 'endeavor'; });
    if (!cos.length) { view.innerHTML = C.head(t('nav_books'), t('bk_lead')) + '<div class="portal-card">' + t('bk_noCo') + '</div>'; return; }
    // Bookkeeping dentro do pacote (serviço feito pela Endeavor): painel de relatórios; avulso: a página da ferramenta
    var sv = await C.sb.from('client_services').select('included_in, status').eq('client_id', C.S.client.id).eq('product_code', 'bookkeeping').neq('status', 'canceled');
    if (((sv && sv.data) || []).some(function (x) { return x.included_in; })) return booksPainel(view, cos);
    var co = cos.find(function (c) { return c.id === C.param('co'); }) || cos[0];
    var st = (await C.sb.rpc('client_bk_status', { p_company: co.id })).data || { connections: [], accounts: [] };
    view.innerHTML = C.head(t('nav_books'), t('bk_lead')) +
      (cos.length > 1 ? '<div class="toolbar"><select id="bk-co">' + cos.map(function (c) { return '<option value="' + c.id + '"' + (c.id === co.id ? ' selected' : '') + '>' + esc(c.legal_name) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="dash"><div><section class="portal-card"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + t('bk_accounts') + ' · ' + esc(co.legal_name) + '</h2>' +
        '<div class="portal-btn-row"><button class="btn btn--navy btn--sm" type="button" id="bk-bank">' + t('bk_bank') + '</button><button class="btn btn--ghost btn--sm" type="button" id="bk-card">' + t('bk_card') + '</button></div></div>' +
        '<div class="portal-alert" id="bk-m" role="status"></div>' +
        ((st.accounts || []).length ? '<ul class="ag-list">' + st.accounts.map(function (a) { return '<li class="ag-item"><div><strong>' + esc(a.name) + '</strong>' + (a.mask ? ' ••' + esc(a.mask) : '') + '<div class="portal-muted" style="font-size:.85rem">' + t('k_' + (a.kind || 'other')) + '</div></div></li>'; }).join('') + '</ul>' : '<p class="portal-muted">' + t('bk_none') + '</p>') +
        '<div class="kpis" style="margin-top:1rem">' + C.kpi(t('bk_tx'), st.transactions || 0) + C.kpi(t('bk_review'), st.to_review || 0) + C.kpi(t('bk_sync'), (st.connections || []).reduce(function (a, c) { return c.last_sync_at && (!a || c.last_sync_at > a) ? c.last_sync_at : a; }, null) ? C.fmtDT((st.connections || []).reduce(function (a, c) { return c.last_sync_at && (!a || c.last_sync_at > a) ? c.last_sync_at : a; }, null)) : '—', true) + '</div></section></div>' +
      '<aside class="links-panel portal-card"><h2 class="portal-h2">' + t('bk_how') + '</h2><ol class="bk-how">' + ['bk_s1', 'bk_s2', 'bk_s3', 'bk_s4'].map(function (k) { return '<li>' + t(k) + '</li>'; }).join('') + '</ol>' +
        '<ul><li><a href="#/reports"><svg class="icon" aria-hidden="true"><use href="#i-chart"/></svg>' + t('bk_reports') + '</a></li><li><a href="#/collaborators?invite=1"><svg class="icon" aria-hidden="true"><use href="#i-users"/></svg>' + t('bk_invite') + '</a></li></ul></aside></div>';
    if (view.querySelector('#bk-co')) view.querySelector('#bk-co').onchange = function () { location.hash = '#/bookkeeping?co=' + this.value; };
    view.querySelector('#bk-bank').onclick = function () { connect(co, 'bank', view); };
    view.querySelector('#bk-card').onclick = function () { connect(co, 'card', view); };
  }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  async function connect(co, kind, view) {
    var m = view.querySelector('#bk-m');
    try {
      var cfg = await fn('books', { action: 'config' });
      if (cfg.stripe) {
        C.msg(m, t('loading'), 'info');
        var s = await fn('books', { action: 'stripe_session', company_id: co.id, kind: kind });
        var Stripe = await EStore.loadStripe();
        var res = await Stripe(s.pk).collectFinancialConnectionsAccounts({ clientSecret: s.client_secret });
        if (res.error) throw new Error(res.error.message);
        var j = await fn('books', { action: 'stripe_complete', company_id: co.id, connection_id: s.connection_id, session_id: res.financialConnectionsSession.id });
        await books(view); C.msg(view.querySelector('#bk-m'), t('bk_done', { n: j.imported || 0 }), 'ok');
      } else if (cfg.plaid) {
        var lk = await fn('books', { action: 'plaid_link', company_id: co.id, lang: L, kind: kind });
        if (!window.Plaid) await loadScript('https://cdn.plaid.com/link/v2/stable/link-initialize.js');
        window.Plaid.create({ token: lk.link_token, onSuccess: async function (pub, meta) {
          try { var r = await fn('books', { action: 'plaid_exchange', company_id: co.id, public_token: pub, institution: meta && meta.institution ? meta.institution.name : 'Bank' }); await books(view); C.msg(view.querySelector('#bk-m'), t('bk_done', { n: r.imported || 0 }), 'ok'); }
          catch (e) { C.msg(view.querySelector('#bk-m'), e.message, 'error'); }
        } }).open();
      } else C.msg(m, t('bk_off'), 'error');
    } catch (e) { C.msg(m, e.message || t('generic'), 'error'); }
  }

  window.ETools = {
    init: init, nav: nav, has: has, overview: overview,
    views: { servicos: services, addons: function (view) { return services(view, 'addons'); }, crm: crm, agenda: agenda, assinaturas: esign, bookkeeping: books }
  };
})();
