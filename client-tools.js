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
  var TOOL_VIEW = { crm: 'crm', agenda: 'agenda', esign: 'assinaturas', bookkeeping: 'bookkeeping' };
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

  /* ---------------- Serviços (and upgrades) ---------------- */
  async function services(view) {
    var orderBack = C.param('order');
    var rows = await C.q(C.sb.from('store_products').select('*').neq('status', 'hidden').order('sort'));
    var mine = await C.q(C.sb.from('client_services').select('*').eq('client_id', C.S.client.id));
    var by = {}; mine.forEach(function (s) { by[s.product_code] = s; });
    view.innerHTML = C.head(t('sv_title'), t('sv_lead')) + '<div class="portal-alert" id="sv-m" role="status"></div><div class="tl-grid">' + rows.map(function (p) {
      var i = (window.EStore && EStore.info(p.code, L)) || { name: p.code, lead: '', feats: [] }, s = by[p.code], on = s && s.status !== 'canceled';
      return '<section class="portal-card tl-card' + (on ? ' tl-card--on' : '') + '"><div style="display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start"><h2 class="portal-h2" style="margin:0">' + esc(i.name) + '</h2>' +
        (on ? '<span class="pill pill--report">' + t(s.status === 'past_due' ? 'past_due' : 'active') + '</span>' : p.status === 'coming_soon' ? '<span class="pill">' + t('soon') + '</span>' : '') + '</div>' +
        '<p class="portal-muted" style="margin:.4rem 0 .6rem">' + esc(i.lead) + '</p><ul class="tl-feats">' + (i.feats || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<p class="tl-price"><strong>' + EStore.money(p.price_cents) + '</strong> <span class="portal-muted">' + esc(EStore.interval(p.interval, L)) + '</span></p>' +
        '<div class="portal-btn-row">' + (on ? (TOOL_VIEW[p.code] ? '<a class="btn btn--navy btn--sm" href="#/' + TOOL_VIEW[p.code] + '">' + t('open') + '</a>' : '') + '<button class="btn btn--ghost btn--sm" type="button" data-cancel="' + p.code + '">' + t('cancelSub') + '</button>'
          : p.status === 'active' ? '<button class="btn btn--gold btn--sm" type="button" data-buy="' + p.code + '">' + t('buy') + '</button>' : '') + '</div></section>';
    }).join('') + '</div>';
    view.querySelectorAll('[data-buy]').forEach(function (b) { b.onclick = function () { buy(b.dataset.buy); }; });
    view.querySelectorAll('[data-cancel]').forEach(function (b) { b.onclick = async function () {
      if (!confirm(t('cancelQ', { p: svcName(b.dataset.cancel) }))) return;
      b.disabled = true;
      try { await fn('payments', { action: 'store_cancel', client_id: C.S.client.id, product: b.dataset.cancel }); C.msg(document.getElementById('sv-m'), t('cancelled'), 'ok'); }
      catch (e) { b.disabled = false; C.msg(document.getElementById('sv-m'), e.message, 'error'); }
    }; });
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
  async function books(view) {
    var cos = (C.S.companies || []).filter(function (c) { return c.books_provider === 'endeavor'; });
    if (!cos.length) { view.innerHTML = C.head(t('nav_books'), t('bk_lead')) + '<div class="portal-card">' + t('bk_noCo') + '</div>'; return; }
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
    views: { servicos: services, crm: crm, agenda: agenda, assinaturas: esign, bookkeeping: books }
  };
})();
