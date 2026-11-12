/* AI Projects in the client portal (owner only): New Project, My Projects, Timeline, Tasks, Documents, Approvals, Billing.
   The AI Project Manager scopes the project in a chat; Endeavor reviews the proposal; the client approves and pays;
   agents build on a test address; the client approves each version before it goes to the official address.
   Also: "Add New Company" (with the optional Bookkeeping service). */
(function () {
  'use strict';
  var D = {
    pt: { nav: 'AI Projects', title: 'AI Projects', lead: 'Peça uma plataforma para a sua empresa. O AI Project Manager entende o que você precisa, define escopo, prazo e preço, e coordena o desenvolvimento. Você não precisa programar.',
      newP: 'Novo projeto', my: 'Meus projetos', none: 'Nenhum projeto ainda.', noneText: 'Comece um projeto e converse com o AI Project Manager.',
      f_title: 'Nome do projeto', f_company: 'Empresa', f_brief: 'O que você quer construir?', f_brief_ph: 'Ex.: um portal para meus clientes agendarem serviços e pagarem online', f_features: 'Funcionalidades principais', f_users: 'Quem vai usar', f_integr: 'Outras integrações', f_instr: 'Instruções e preferências (cores, estilo, referências)', f_deadline: 'Prazo desejado', f_refs: 'Sites de referência', f_conn: 'Conectores disponíveis', f_logo: 'Logotipo', f_docs: 'Documentos', f_create: 'Criar projeto e falar com o AI PM', noConn: 'Nenhum conector disponível para esta empresa.',
      tabs: { overview: 'Visão geral', timeline: 'Cronograma', tasks: 'Tarefas', docs: 'Documentos', approvals: 'Aprovações', billing: 'Faturamento' },
      pm: 'AI Project Manager', send: 'Enviar', typing: 'O AI Project Manager está escrevendo…', msgPh: 'Escreva sua mensagem…', askProp: 'Pedir proposta', askPropQ: 'Enviar o escopo atual para a Endeavor preparar a proposta?', askPropOk: 'Pedido enviado. A Endeavor revisa e você recebe a proposta por e-mail.',
      scope: 'Escopo', phases: 'Fases', weeks: 'semanas', outScope: 'Fora do escopo', assumptions: 'Premissas', openQ: 'Perguntas em aberto',
      proposal: 'Proposta', price: 'Valor', timeline: 'Prazo', includes: 'Inclui a primeira versão funcional e {n} atualizações dentro do escopo. A partir da {m}ª atualização: {p} cada. Mudanças fora do escopo têm orçamento próprio.',
      approve: 'Aprovar proposta', changes: 'Pedir ajustes', name: 'Seu nome completo', agree: 'Aprovo o escopo, o prazo e o valor desta proposta. Sei que o desenvolvimento começa depois do pagamento.', approved: 'Proposta aprovada. A fatura foi enviada: pague para iniciar o projeto.', payNow: 'Pay Now',
      changesPh: 'O que você quer ajustar?', sendChanges: 'Enviar ajustes',
      st: { scoping: 'Levantando requisitos', proposal_review: 'Proposta em revisão', proposal_sent: 'Proposta enviada', changes_requested: 'Ajustes pedidos', awaiting_payment: 'Aguardando pagamento', provisioning: 'Preparando ambiente', in_progress: 'Em desenvolvimento', staging_review: 'Versão para aprovar', live: 'No ar', paused: 'Pausado', cancelled: 'Cancelado' },
      rs: { requested: 'Solicitada', quote_review: 'Em análise', awaiting_payment: 'Aguardando pagamento', queued: 'Na fila', building: 'Em desenvolvimento', staging: 'No teste: aprove ou peça ajustes', changes_requested: 'Ajustando', approved: 'Aprovada', publishing: 'Publicando', published: 'Publicada', rolled_back: 'Revertida', failed: 'Em revisão pela equipe', cancelled: 'Cancelada' },
      ts: { todo: 'A fazer', queued: 'Na fila', running: 'Em andamento', done: 'Concluída', failed: 'Com problema', blocked: 'Bloqueada', skipped: 'Ignorada' },
      testUrl: 'Endereço de teste', prodUrl: 'Endereço oficial', review: 'Abrir versão de teste', approveRel: 'Aprovar e publicar', feedback: 'Pedir ajustes', feedbackPh: 'Descreva o que precisa mudar', approveRelTxt: 'Aprovo esta versão para publicação no endereço oficial.',
      updates: 'Atualizações', balance: '{u} de {n} atualizações incluídas disponíveis', reqUpdate: 'Solicitar atualização', upTitle: 'Título', upReq: 'O que deve mudar', upSent: 'Solicitação enviada. O AI Project Manager e a equipe avaliam se está dentro do escopo.',
      files: 'Arquivos do projeto', upload: 'Enviar arquivo', kind: { logo: 'Logotipo', document: 'Documento', design: 'Design', other: 'Outro' }, del: 'Excluir', view: 'Ver', delQ: 'Excluir este arquivo?',
      events: 'Histórico', due: 'até', invoices: 'Faturas do projeto', noInv: 'Nenhuma fatura ainda.', paid: 'Paga', open: 'Em aberto', void: 'Anulada', draft: 'Rascunho', back: 'Meus projetos', err: 'Algo deu errado. Tente de novo.',
      addCo: 'Adicionar empresa', addCoT: 'Adicionar nova empresa', coName: 'Nome da empresa', coState: 'Estado (sigla, ex.: FL)', coExisting: 'A empresa já existe', coNew: 'Quero abrir esta empresa', coEin: 'EIN (opcional)', coBooks: 'Quero contratar o serviço de Bookkeeping para esta empresa (assinatura e faturamento próprios)', coSave: 'Adicionar', coDone: 'Empresa adicionada. A equipe Endeavor foi avisada.', coType: 'Tipo' },
    en: { nav: 'AI Projects', title: 'AI Projects', lead: 'Request a platform for your company. The AI Project Manager understands what you need, defines scope, timeline and price, and coordinates the development. You do not need to code.',
      newP: 'New Project', my: 'My Projects', none: 'No projects yet.', noneText: 'Start a project and talk to the AI Project Manager.',
      f_title: 'Project name', f_company: 'Company', f_brief: 'What do you want to build?', f_brief_ph: 'E.g.: a portal where my customers book services and pay online', f_features: 'Main features', f_users: 'Who will use it', f_integr: 'Other integrations', f_instr: 'Instructions and preferences (colors, style, references)', f_deadline: 'Desired deadline', f_refs: 'Reference websites', f_conn: 'Available connectors', f_logo: 'Logo', f_docs: 'Documents', f_create: 'Create project and talk to the AI PM', noConn: 'No connectors available for this company.',
      tabs: { overview: 'Overview', timeline: 'Timeline', tasks: 'Tasks', docs: 'Documents', approvals: 'Approvals', billing: 'Billing' },
      pm: 'AI Project Manager', send: 'Send', typing: 'The AI Project Manager is typing…', msgPh: 'Write your message…', askProp: 'Request proposal', askPropQ: 'Send the current scope to Endeavor to prepare the proposal?', askPropOk: 'Request sent. Endeavor reviews it and you get the proposal by e-mail.',
      scope: 'Scope', phases: 'Phases', weeks: 'weeks', outScope: 'Out of scope', assumptions: 'Assumptions', openQ: 'Open questions',
      proposal: 'Proposal', price: 'Price', timeline: 'Timeline', includes: 'Includes the first functional version and {n} updates within the scope. From update #{m}: {p} each. Changes outside the scope are quoted separately.',
      approve: 'Approve proposal', changes: 'Request changes', name: 'Your full name', agree: 'I approve the scope, timeline and price of this proposal. I understand development starts after payment.', approved: 'Proposal approved. The invoice was sent: pay it to start the project.', payNow: 'Pay Now',
      changesPh: 'What would you like to change?', sendChanges: 'Send changes',
      st: { scoping: 'Gathering requirements', proposal_review: 'Proposal in review', proposal_sent: 'Proposal sent', changes_requested: 'Changes requested', awaiting_payment: 'Awaiting payment', provisioning: 'Preparing environment', in_progress: 'In development', staging_review: 'Version to approve', live: 'Live', paused: 'Paused', cancelled: 'Cancelled' },
      rs: { requested: 'Requested', quote_review: 'Under review', awaiting_payment: 'Awaiting payment', queued: 'Queued', building: 'In development', staging: 'On test: approve or request changes', changes_requested: 'Being adjusted', approved: 'Approved', publishing: 'Publishing', published: 'Published', rolled_back: 'Rolled back', failed: 'Under team review', cancelled: 'Cancelled' },
      ts: { todo: 'To do', queued: 'Queued', running: 'Running', done: 'Done', failed: 'Issue', blocked: 'Blocked', skipped: 'Skipped' },
      testUrl: 'Test address', prodUrl: 'Official address', review: 'Open test version', approveRel: 'Approve and publish', feedback: 'Request changes', feedbackPh: 'Describe what needs to change', approveRelTxt: 'I approve this version for publication on the official address.',
      updates: 'Updates', balance: '{u} of {n} included updates available', reqUpdate: 'Request update', upTitle: 'Title', upReq: 'What should change', upSent: 'Request sent. The AI Project Manager and the team check whether it is within scope.',
      files: 'Project files', upload: 'Upload file', kind: { logo: 'Logo', document: 'Document', design: 'Design', other: 'Other' }, del: 'Delete', view: 'View', delQ: 'Delete this file?',
      events: 'History', due: 'by', invoices: 'Project invoices', noInv: 'No invoices yet.', paid: 'Paid', open: 'Open', void: 'Void', draft: 'Draft', back: 'My Projects', err: 'Something went wrong. Try again.',
      addCo: 'Add New Company', addCoT: 'Add a new company', coName: 'Company name', coState: 'State (e.g. FL)', coExisting: 'The company already exists', coNew: 'I want to form this company', coEin: 'EIN (optional)', coBooks: 'I want the Bookkeeping service for this company (its own subscription and billing)', coSave: 'Add', coDone: 'Company added. The Endeavor team was notified.', coType: 'Type' },
    es: { nav: 'AI Projects', title: 'AI Projects', lead: 'Solicite una plataforma para su empresa. El AI Project Manager entiende lo que necesita, define alcance, plazo y precio, y coordina el desarrollo. No necesita programar.',
      newP: 'Nuevo proyecto', my: 'Mis proyectos', none: 'Aún no hay proyectos.', noneText: 'Comience un proyecto y hable con el AI Project Manager.',
      f_title: 'Nombre del proyecto', f_company: 'Empresa', f_brief: '¿Qué quiere construir?', f_brief_ph: 'Ej.: un portal para que mis clientes reserven servicios y paguen en línea', f_features: 'Funcionalidades principales', f_users: 'Quién lo usará', f_integr: 'Otras integraciones', f_instr: 'Instrucciones y preferencias (colores, estilo, referencias)', f_deadline: 'Plazo deseado', f_refs: 'Sitios de referencia', f_conn: 'Conectores disponibles', f_logo: 'Logotipo', f_docs: 'Documentos', f_create: 'Crear proyecto y hablar con el AI PM', noConn: 'No hay conectores disponibles para esta empresa.',
      tabs: { overview: 'Resumen', timeline: 'Cronograma', tasks: 'Tareas', docs: 'Documentos', approvals: 'Aprobaciones', billing: 'Facturación' },
      pm: 'AI Project Manager', send: 'Enviar', typing: 'El AI Project Manager está escribiendo…', msgPh: 'Escriba su mensaje…', askProp: 'Pedir propuesta', askPropQ: '¿Enviar el alcance actual a Endeavor para preparar la propuesta?', askPropOk: 'Solicitud enviada. Endeavor la revisa y usted recibe la propuesta por correo.',
      scope: 'Alcance', phases: 'Fases', weeks: 'semanas', outScope: 'Fuera del alcance', assumptions: 'Supuestos', openQ: 'Preguntas abiertas',
      proposal: 'Propuesta', price: 'Valor', timeline: 'Plazo', includes: 'Incluye la primera versión funcional y {n} actualizaciones dentro del alcance. Desde la {m}ª actualización: {p} cada una. Cambios fuera del alcance tienen presupuesto propio.',
      approve: 'Aprobar propuesta', changes: 'Pedir ajustes', name: 'Su nombre completo', agree: 'Apruebo el alcance, el plazo y el valor de esta propuesta. Entiendo que el desarrollo empieza después del pago.', approved: 'Propuesta aprobada. La factura fue enviada: pague para iniciar el proyecto.', payNow: 'Pay Now',
      changesPh: '¿Qué quiere ajustar?', sendChanges: 'Enviar ajustes',
      st: { scoping: 'Levantando requisitos', proposal_review: 'Propuesta en revisión', proposal_sent: 'Propuesta enviada', changes_requested: 'Ajustes pedidos', awaiting_payment: 'Esperando pago', provisioning: 'Preparando entorno', in_progress: 'En desarrollo', staging_review: 'Versión para aprobar', live: 'En línea', paused: 'Pausado', cancelled: 'Cancelado' },
      rs: { requested: 'Solicitada', quote_review: 'En análisis', awaiting_payment: 'Esperando pago', queued: 'En cola', building: 'En desarrollo', staging: 'En prueba: apruebe o pida ajustes', changes_requested: 'Ajustando', approved: 'Aprobada', publishing: 'Publicando', published: 'Publicada', rolled_back: 'Revertida', failed: 'En revisión del equipo', cancelled: 'Cancelada' },
      ts: { todo: 'Por hacer', queued: 'En cola', running: 'En curso', done: 'Hecha', failed: 'Con problema', blocked: 'Bloqueada', skipped: 'Omitida' },
      testUrl: 'Dirección de prueba', prodUrl: 'Dirección oficial', review: 'Abrir versión de prueba', approveRel: 'Aprobar y publicar', feedback: 'Pedir ajustes', feedbackPh: 'Describa lo que debe cambiar', approveRelTxt: 'Apruebo esta versión para publicarla en la dirección oficial.',
      updates: 'Actualizaciones', balance: '{u} de {n} actualizaciones incluidas disponibles', reqUpdate: 'Solicitar actualización', upTitle: 'Título', upReq: 'Qué debe cambiar', upSent: 'Solicitud enviada. El AI Project Manager y el equipo evalúan si está dentro del alcance.',
      files: 'Archivos del proyecto', upload: 'Subir archivo', kind: { logo: 'Logotipo', document: 'Documento', design: 'Diseño', other: 'Otro' }, del: 'Eliminar', view: 'Ver', delQ: '¿Eliminar este archivo?',
      events: 'Historial', due: 'hasta', invoices: 'Facturas del proyecto', noInv: 'Aún no hay facturas.', paid: 'Pagada', open: 'Abierta', void: 'Anulada', draft: 'Borrador', back: 'Mis proyectos', err: 'Algo salió mal. Intente de nuevo.',
      addCo: 'Agregar empresa', addCoT: 'Agregar nueva empresa', coName: 'Nombre de la empresa', coState: 'Estado (ej.: FL)', coExisting: 'La empresa ya existe', coNew: 'Quiero constituir esta empresa', coEin: 'EIN (opcional)', coBooks: 'Quiero el servicio de Bookkeeping para esta empresa (suscripción y facturación propias)', coSave: 'Agregar', coDone: 'Empresa agregada. El equipo de Endeavor fue avisado.', coType: 'Tipo' }
  };
  var X, L, T;
  function tr(k, v) { var s = k.split('.').reduce(function (o, x) { return o && o[x]; }, T); if (s == null) s = k.split('.').reduce(function (o, x) { return o && o[x]; }, D.en) || k; if (v) Object.keys(v).forEach(function (x) { s = String(s).replace('{' + x + '}', v[x]); }); return s; }
  function money(c) { return new Intl.NumberFormat(X.locale || 'en-US', { style: 'currency', currency: 'USD' }).format((c || 0) / 100); }
  async function call(payload) {
    var s = (await X.sb.auth.getSession()).data.session;
    var r = await fetch(X.CFG.functionsUrl + '/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: X.CFG.supabaseKey, Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'HTTP ' + r.status); e.code = j.error; throw e; }
    return j;
  }
  function pill(st, label) { return '<span class="pj-pill pj-pill--' + st + '">' + X.esc(label) + '</span>'; }
  function init(ctx) { X = ctx; L = ['pt', 'en', 'es'].indexOf(ctx.L) > -1 ? ctx.L : 'pt'; T = D[L]; }

  async function view(el, ctx) {
    init(ctx);
    var id = ctx.param('id');
    if (ctx.param('new')) return newProject(el);
    if (id) return detail(el, id);
    var esc = X.esc, rows = await X.q(X.sb.from('ai_projects').select('id, title, status, weeks, created_at, staging_url, prod_url, companies(legal_name)').eq('client_id', X.S.client.id).order('created_at', { ascending: false }));
    el.innerHTML = X.head(tr('title'), tr('lead'), '<a class="btn btn--navy" href="#/projetos?new=1">' + tr('newP') + '</a>') +
      '<h2 class="portal-h2">' + tr('my') + '</h2>' + (rows.length ? '<div class="cards">' + rows.map(function (p) {
        return '<a class="co-card" href="#/projetos?id=' + p.id + '"><h3>' + esc(p.title) + '</h3><div class="meta">' + esc(p.companies ? p.companies.legal_name : '') + '</div><div class="row"><span>' + (p.weeks ? p.weeks + ' ' + tr('weeks') : '') + '</span>' + pill(p.status, tr('st.' + p.status)) + '</div></a>';
      }).join('') + '</div>' : '<div class="portal-card empty-state"><strong>' + tr('none') + '</strong>' + tr('noneText') + '</div>');
  }

  async function newProject(el) {
    var esc = X.esc, cos = X.S.companies || [];
    el.innerHTML = X.head(tr('newP'), tr('lead')) + '<section class="portal-card"><form class="portal-form" id="np" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="np-t">' + tr('f_title') + '</label><input id="np-t" maxlength="160" required></div>' +
      '<div class="field"><label for="np-co">' + tr('f_company') + '</label><select id="np-co">' + cos.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + '</option>'; }).join('') + '</select><button class="btn btn--ghost btn--xs" type="button" id="np-addco" style="margin-top:.4rem">+ ' + tr('addCo') + '</button></div></div>' +
      '<div class="field"><label for="np-b">' + tr('f_brief') + '</label><textarea id="np-b" rows="4" maxlength="8000" placeholder="' + esc(tr('f_brief_ph')) + '" required></textarea></div>' +
      '<div class="field"><label for="np-f">' + tr('f_features') + '</label><textarea id="np-f" rows="3" maxlength="4000"></textarea></div>' +
      '<fieldset class="perm-box"><legend>' + tr('f_conn') + '</legend><div id="np-conn" class="pj-conn"><p class="portal-muted">…</p></div></fieldset>' +
      '<div class="field"><label for="np-i">' + tr('f_integr') + '</label><input id="np-i" maxlength="2000"></div>' +
      '<div class="portal-grid2"><div class="field"><label for="np-u">' + tr('f_users') + '</label><input id="np-u" maxlength="1000"></div><div class="field"><label for="np-d">' + tr('f_deadline') + '</label><input id="np-d" maxlength="100"></div></div>' +
      '<div class="field"><label for="np-in">' + tr('f_instr') + '</label><textarea id="np-in" rows="3" maxlength="4000"></textarea></div>' +
      '<div class="field"><label for="np-r">' + tr('f_refs') + '</label><input id="np-r" maxlength="2000"></div>' +
      '<div class="portal-grid2"><div class="field"><label for="np-logo">' + tr('f_logo') + '</label><input type="file" id="np-logo" accept="image/png,image/jpeg,image/svg+xml,image/webp"></div><div class="field"><label for="np-docs">' + tr('f_docs') + '</label><input type="file" id="np-docs" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt,.zip"></div></div>' +
      '<div class="portal-alert" id="np-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + tr('f_create') + '</button><a class="btn btn--ghost" href="#/projetos">' + tr('back') + '</a></div></form></section>';
    var loadConn = async function () {
      var co = X.$('#np-co').value, box = X.$('#np-conn');
      if (!co) { box.innerHTML = '<p class="portal-muted">' + tr('noConn') + '</p>'; return; }
      var r = await X.sb.rpc('project_connectors', { p_company: co }), list = r.data || [];
      box.innerHTML = list.length ? list.map(function (c) { return '<label class="check-row"><input type="checkbox" value="' + esc(c.key) + '"> <span><strong>' + esc(c.name) + '</strong><span class="portal-muted" style="display:block;font-size:.84rem">' + esc(c.description || '') + '</span></span></label>'; }).join('') : '<p class="portal-muted">' + tr('noConn') + '</p>';
    };
    loadConn(); X.$('#np-co').onchange = loadConn;
    X.$('#np-addco').onclick = function () { addCompany(function () { X.route(); }); };
    X.$('#np').onsubmit = async function (e) {
      e.preventDefault();
      var m = X.$('#np-m'), title = X.$('#np-t').value.trim(), brief = X.$('#np-b').value.trim();
      if (title.length < 3 || brief.length < 10) return X.msg(m, L === 'en' ? 'Fill in the project name and what you want to build.' : L === 'es' ? 'Complete el nombre y lo que quiere construir.' : 'Preencha o nome e o que você quer construir.', 'error');
      var b = this.querySelector('button[type=submit]'); b.disabled = true; X.msg(m, tr('typing'), 'info');
      try {
        var r = await call({ action: 'create', client_id: X.S.client.id, company_id: X.$('#np-co').value || null, title: title, brief: brief, features: X.$('#np-f').value, integrations: X.$('#np-i').value, users: X.$('#np-u').value, deadline: X.$('#np-d').value, instructions: X.$('#np-in').value, references: X.$('#np-r').value,
          connectors: Array.prototype.map.call(X.$$('#np-conn input:checked'), function (i) { return i.value; }) });
        var lg = X.$('#np-logo').files[0]; if (lg) await uploadFile(r.id, lg, 'logo');
        for (var i = 0; i < X.$('#np-docs').files.length; i++) await uploadFile(r.id, X.$('#np-docs').files[i], 'document');
        ERoute.go('#/projetos?id=' + r.id);
      } catch (x) { b.disabled = false; X.msg(m, tr('err'), 'error'); }
    };
  }
  async function uploadFile(pid, f, kind) {
    var mime = f.type || (/\.docx$/i.test(f.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : /\.xlsx$/i.test(f.name) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '');
    var u = await call({ action: 'file_url', project_id: pid, mime: mime, size: f.size });
    var r = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': mime }, body: f }); if (!r.ok) throw new Error('upload');
    await call({ action: 'file_confirm', project_id: pid, path: u.path, title: f.name, mime: mime, size: f.size, kind: kind });
  }

  function addCompany(after) {
    var o = X.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + tr('addCoT') + '</h2><button class="close-x" type="button" aria-label="×">×</button></div><form class="portal-form" id="ac" novalidate>' +
      '<div class="field"><label for="ac-n">' + tr('coName') + '</label><input id="ac-n" maxlength="200" required></div>' +
      '<div class="portal-grid2"><div class="field"><label for="ac-s">' + tr('coState') + '</label><input id="ac-s" maxlength="2" style="text-transform:uppercase" value="FL"></div><div class="field"><label for="ac-t">' + tr('coType') + '</label><select id="ac-t"><option value="llc">LLC</option><option value="corp">Corporation</option><option value="other">Other</option></select></div></div>' +
      '<div class="send-opts" role="radiogroup"><label class="check-row"><input type="radio" name="ac-x" value="1" checked> ' + tr('coExisting') + '</label><label class="check-row"><input type="radio" name="ac-x" value="0"> ' + tr('coNew') + '</label></div>' +
      '<div class="field" id="ac-einw"><label for="ac-e">' + tr('coEin') + '</label><input id="ac-e" maxlength="10" inputmode="numeric" placeholder="12-3456789"></div>' +
      '<div class="check-row"><input type="checkbox" id="ac-b"><label for="ac-b">' + tr('coBooks') + '</label></div><div class="portal-alert" id="ac-m" role="alert"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + tr('coSave') + '</button><button class="btn btn--ghost close-x" type="button">×</button></div></form>', true);
    o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = X.closeOverlay; });
    o.querySelectorAll('input[name=ac-x]').forEach(function (r) { r.onchange = function () { X.$('#ac-einw', o).hidden = this.value !== '1'; }; });
    X.$('#ac', o).onsubmit = async function (e) {
      e.preventDefault(); var n = X.$('#ac-n', o).value.trim(); if (n.length < 2) return X.$('#ac-n', o).focus();
      this.querySelector('button').disabled = true;
      try {
        await call({ action: 'add_company', client_id: X.S.client.id, legal_name: n, state: X.$('#ac-s', o).value.trim().toUpperCase(), entity_type: X.$('#ac-t', o).value, existing: o.querySelector('input[name=ac-x]:checked').value === '1', ein: X.$('#ac-e', o).value.trim(), bookkeeping: X.$('#ac-b', o).checked });
        var r = await X.sb.from('companies').select('*').eq('client_id', X.S.client.id).order('legal_name'); if (!r.error) X.S.companies = r.data;
        X.msg(X.$('#ac-m', o), tr('coDone'), 'ok'); setTimeout(function () { X.closeOverlay(); if (after) after(); }, 900);
      } catch (x) { this.querySelector('button').disabled = false; X.msg(X.$('#ac-m', o), tr('err'), 'error'); }
    };
  }

  async function detail(el, id) {
    var esc = X.esc, tab = X.param('tab') || 'overview';
    var res = await Promise.all([X.q(X.sb.from('ai_projects').select('*, companies(legal_name)').eq('id', id).single()),
      X.q(X.sb.from('ai_project_releases').select('*').eq('project_id', id).order('number')),
      X.q(X.sb.from('ai_project_tasks').select('*').eq('project_id', id).order('position')),
      X.q(X.sb.from('ai_project_files').select('*').eq('project_id', id).order('created_at', { ascending: false })),
      X.q(X.sb.from('ai_project_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(60)),
      X.q(X.sb.from('invoices').select('id, number, status, total_cents, due_date, hosted_invoice_url, created_at').eq('ai_project_id', id).order('created_at', { ascending: false }))]);
    var p = res[0], rels = res[1], tasks = res[2], files = res[3], evs = res[4], invs = res[5];
    var usedInc = rels.filter(function (r) { return r.kind === 'included_update' && r.status !== 'cancelled'; }).length;
    var toApprove = rels.filter(function (r) { return r.status === 'staging'; }).length + (p.status === 'proposal_sent' ? 1 : 0);
    el.innerHTML = X.head(p.title, (p.companies ? p.companies.legal_name + ' · ' : '') + tr('st.' + p.status), '<a class="btn btn--ghost" href="#/projetos">' + tr('back') + '</a>') +
      '<nav class="subtabs" aria-label="' + esc(p.title) + '">' + Object.keys(T.tabs).map(function (k) { return '<a href="#/projetos?id=' + id + '&tab=' + k + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + tr('tabs.' + k) + (k === 'approvals' && toApprove ? ' <span class="nav-badge">' + toApprove + '</span>' : '') + '</a>'; }).join('') + '</nav><div id="pj-body"></div>';
    var body = X.$('#pj-body');
    var links = (p.staging_url || p.prod_url) ? '<dl class="kv">' + (p.staging_url ? '<dt>' + tr('testUrl') + '</dt><dd><a href="' + esc(p.staging_url) + '" target="_blank" rel="noopener">' + esc(p.staging_url) + '</a></dd>' : '') + (p.prod_url && p.status === 'live' ? '<dt>' + tr('prodUrl') + '</dt><dd><a href="' + esc(p.prod_url) + '" target="_blank" rel="noopener">' + esc(p.prod_url) + '</a></dd>' : '') + '</dl>' : '';
    if (tab === 'overview') return overview(body, p, links);
    if (tab === 'timeline') {
      var start = p.paid_at ? new Date(p.paid_at) : null;
      body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">' + tr('phases') + '</h2>' + scopeHtml(p, start) + '</section><section class="portal-card"><h2 class="portal-h2">' + tr('events') + '</h2><ul class="pj-events">' +
        evs.map(function (e) { return '<li><time>' + esc(X.fmtDT(e.created_at)) + '</time><strong>' + esc(e.title) + '</strong>' + (e.detail ? '<span>' + esc(e.detail) + '</span>' : '') + '</li>'; }).join('') + '</ul></section>';
      return;
    }
    if (tab === 'tasks') {
      body.innerHTML = '<section class="portal-card">' + (tasks.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>' + tr('phases') + '</th><th>' + tr('tabs.tasks') + '</th><th>Status</th><th>' + tr('due') + '</th></tr></thead><tbody>' + tasks.map(function (t) {
        return '<tr><td>' + esc(t.phase || '') + '</td><td><strong>' + esc(t.title) + '</strong>' + (t.detail ? '<span class="sub">' + esc(t.detail) + '</span>' : '') + '</td><td>' + pill('t-' + t.status, tr('ts.' + t.status)) + '</td><td>' + (t.due_date ? esc(X.fmtDate(t.due_date)) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">' + tr('none') + '</p>') + '</section>';
      return;
    }
    if (tab === 'docs') {
      body.innerHTML = '<section class="portal-card"><div class="toolbar" style="justify-content:space-between"><h2 class="portal-h2" style="margin:0">' + tr('files') + '</h2><div class="portal-btn-row"><select id="fk" aria-label="' + tr('files') + '">' + Object.keys(T.kind).map(function (k) { return '<option value="' + k + '">' + tr('kind.' + k) + '</option>'; }).join('') + '</select><label class="btn btn--navy btn--xs" tabindex="0" role="button">' + tr('upload') + '<input type="file" id="fu" hidden></label></div></div><div class="portal-alert" id="fm" role="status"></div>' +
        (files.length ? '<ul class="doclist">' + files.map(function (f) { return '<li><span class="ficon" aria-hidden="true">📄</span><div><div class="dname">' + esc(f.title) + '</div><div class="dmeta">' + tr('kind.' + f.kind) + ' · ' + esc(X.fmtDT(f.created_at)) + '</div></div><div class="portal-btn-row"><button class="btn btn--ghost btn--xs" data-fv="' + f.id + '">' + tr('view') + '</button><button class="btn btn--ghost btn--xs" data-fd="' + f.id + '">' + tr('del') + '</button></div></li>'; }).join('') + '</ul>' : '') + '</section>';
      X.$('#fu').onchange = async function () { var f = this.files[0]; if (!f) return; X.msg(X.$('#fm'), '…', 'info'); try { await uploadFile(id, f, X.$('#fk').value); X.route(); } catch (e) { X.msg(X.$('#fm'), tr('err'), 'error'); } };
      body.querySelectorAll('[data-fv]').forEach(function (b) { b.onclick = async function () { var r = await call({ action: 'file_view', project_id: id, file_id: b.dataset.fv }); if (r.url) window.open(r.url, '_blank', 'noopener'); }; });
      body.querySelectorAll('[data-fd]').forEach(function (b) { b.onclick = async function () { if (!confirm(tr('delQ'))) return; await call({ action: 'file_delete', project_id: id, file_id: b.dataset.fd }); X.route(); }; });
      return;
    }
    if (tab === 'approvals') return approvals(body, p, rels, usedInc, links);
    if (tab === 'billing') {
      var IS = { paid: tr('paid'), open: tr('open'), void: tr('void'), draft: tr('draft') };
      body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">' + tr('updates') + '</h2><p>' + tr('balance', { u: Math.max(0, p.updates_included - usedInc), n: p.updates_included }) + '</p>' + (p.update_price_cents ? '<p class="portal-muted">' + tr('includes', { n: p.updates_included, m: p.updates_included + 1, p: money(p.update_price_cents) }) + '</p>' : '') + '</section>' +
        '<section class="portal-card"><h2 class="portal-h2">' + tr('invoices') + '</h2>' + (invs.length ? '<div class="table-wrap"><table class="data"><tbody>' + invs.map(function (i) {
          return '<tr><td><strong>' + esc(i.number || '') + '</strong></td><td class="num">' + money(i.total_cents) + '</td><td>' + esc(IS[i.status] || i.status) + '</td><td>' + (i.status === 'open' ? '<a class="btn btn--navy btn--xs" href="#/invoices">' + tr('payNow') + '</a>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="portal-muted">' + tr('noInv') + '</p>') + '</section>';
    }
  }
  function scopeHtml(p, start) {
    var esc = X.esc, s = p.scope || {}, d = start ? new Date(start) : null;
    var list = function (k, arr) { return arr && arr.length ? '<h3 class="pj-h3">' + tr(k) + '</h3><ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; };
    return (s.summary ? '<p>' + esc(s.summary) + '</p>' : '<p class="portal-muted">…</p>') + (s.phases && s.phases.length ? '<ol class="pj-phases">' + s.phases.map(function (ph) {
      var end = d ? new Date(d.getTime() + Math.max(1, ph.weeks || 1) * 7 * 864e5) : null, txt = d ? ' · ' + X.fmtDate(d.toISOString().slice(0, 10)) + ' – ' + X.fmtDate(end.toISOString().slice(0, 10)) : '';
      if (d) d = end;
      return '<li><strong>' + esc(ph.name) + '</strong>' + (ph.weeks ? ' <span class="portal-muted">(' + ph.weeks + ' ' + tr('weeks') + esc(txt) + ')</span>' : '') + '<ul>' + (ph.tasks || []).map(function (t) { return '<li>' + esc(t.title) + '</li>'; }).join('') + '</ul></li>';
    }).join('') + '</ol>' : '') + list('outScope', s.out_of_scope) + list('assumptions', s.assumptions) + list('openQ', s.open_questions);
  }
  async function overview(body, p, links) {
    var esc = X.esc;
    var msgs = await X.q(X.sb.from('ai_project_messages').select('role, content, created_at').eq('project_id', p.id).neq('role', 'system').order('created_at'));
    var canChat = ['scoping', 'changes_requested', 'proposal_sent'].indexOf(p.status) > -1;
    body.innerHTML = '<div class="dash"><section class="portal-card pj-chat"><h2 class="portal-h2">' + tr('pm') + '</h2><div class="pj-msgs" id="pj-msgs" aria-live="polite">' +
        msgs.map(function (m) { return '<div class="pj-msg pj-msg--' + m.role + '"><div>' + esc(m.content).replace(/\n/g, '<br>') + '</div><time>' + esc(X.fmtDT(m.created_at)) + '</time></div>'; }).join('') + '</div>' +
        (canChat ? '<form id="pj-f" class="pj-send"><label for="pj-in" class="sr-only">' + tr('msgPh') + '</label><textarea id="pj-in" rows="2" maxlength="6000" placeholder="' + esc(tr('msgPh')) + '"></textarea><button class="btn btn--navy" type="submit">' + tr('send') + '</button></form>' +
          ((p.status === 'scoping' || p.status === 'changes_requested') && p.scope && p.scope.phases && p.scope.phases.length ? '<div class="portal-btn-row" style="margin-top:.75rem"><button class="btn btn--ghost" type="button" id="pj-prop">' + tr('askProp') + '</button></div>' : '') : '') + '<div class="portal-alert" id="pj-m" role="status"></div></section>' +
      '<aside class="portal-card"><h2 class="portal-h2">' + tr('scope') + '</h2>' + (p.weeks ? '<p><strong>' + tr('timeline') + ':</strong> ' + p.weeks + ' ' + tr('weeks') + '</p>' : '') + scopeHtml(p, p.paid_at) + links + '</aside></div>';
    var box = X.$('#pj-msgs'); box.scrollTop = box.scrollHeight;
    if (X.$('#pj-f')) X.$('#pj-f').onsubmit = async function (e) {
      e.preventDefault(); var t = X.$('#pj-in').value.trim(); if (!t) return;
      var b = this.querySelector('button'); b.disabled = true;
      box.insertAdjacentHTML('beforeend', '<div class="pj-msg pj-msg--client"><div>' + esc(t).replace(/\n/g, '<br>') + '</div></div><div class="pj-msg pj-msg--pm pj-typing" id="pj-typing"><div>' + tr('typing') + '</div></div>'); box.scrollTop = box.scrollHeight; X.$('#pj-in').value = '';
      try { await call({ action: 'message', project_id: p.id, text: t }); X.route(); } catch (x) { b.disabled = false; var ty = X.$('#pj-typing'); if (ty) ty.remove(); X.msg(X.$('#pj-m'), tr('err'), 'error'); }
    };
    if (X.$('#pj-prop')) X.$('#pj-prop').onclick = async function () { if (!confirm(tr('askPropQ'))) return; this.disabled = true; try { await call({ action: 'request_proposal', project_id: p.id }); X.msg(X.$('#pj-m'), tr('askPropOk'), 'ok'); setTimeout(X.route, 1200); } catch (e) { this.disabled = false; X.msg(X.$('#pj-m'), tr('err'), 'error'); } };
  }
  function approvals(body, p, rels, usedInc, links) {
    var esc = X.esc, h = '';
    if (p.status === 'proposal_sent' || p.status === 'awaiting_payment') {
      h += '<section class="portal-card pj-prop"><h2 class="portal-h2">' + tr('proposal') + '</h2><div class="kpis">' + X.kpi(tr('price'), money(p.price_cents), true) + X.kpi(tr('timeline'), (p.weeks || '—') + ' ' + tr('weeks'), true) + '</div>' +
        (p.proposal_note ? '<p>' + esc(p.proposal_note).replace(/\n/g, '<br>') + '</p>' : '') + scopeHtml(p, null) + '<p class="portal-muted">' + tr('includes', { n: p.updates_included, m: p.updates_included + 1, p: money(p.update_price_cents) }) + '</p>' +
        (p.status === 'proposal_sent' ? '<form class="portal-form" id="ap-f" novalidate><div class="field"><label for="ap-n">' + tr('name') + '</label><input id="ap-n" autocomplete="name" maxlength="200"></div><div class="check-row"><input type="checkbox" id="ap-a"><label for="ap-a">' + tr('agree') + '</label></div>' +
          '<div class="portal-alert" id="ap-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + tr('approve') + '</button><button class="btn btn--ghost" type="button" id="ap-ch">' + tr('changes') + '</button></div></form>' +
          '<form class="portal-form" id="ch-f" hidden><div class="field"><label for="ch-t">' + tr('changesPh') + '</label><textarea id="ch-t" rows="3" maxlength="4000"></textarea></div><button class="btn btn--navy" type="submit">' + tr('sendChanges') + '</button></form>'
          : '<div class="portal-alert portal-alert--info" style="display:block">' + tr('approved') + ' <a class="btn btn--navy btn--xs" href="#/invoices">' + tr('payNow') + '</a></div>') + '</section>';
    }
    var stg = rels.filter(function (r) { return r.status === 'staging'; });
    stg.forEach(function (r) {
      h += '<section class="portal-card"><h2 class="portal-h2">' + esc(r.title) + ' <span class="portal-muted" style="font:500 .9rem Inter,sans-serif">#' + r.number + '</span></h2><p>' + tr('rs.staging') + '</p>' +
        '<p><a class="btn btn--ghost" href="' + esc(r.staging_url || p.staging_url || '#') + '" target="_blank" rel="noopener">' + tr('review') + '</a></p>' +
        '<form class="portal-form" data-rel="' + r.id + '" novalidate><div class="field"><label for="rn-' + r.id + '">' + tr('name') + '</label><input id="rn-' + r.id + '" data-n maxlength="200" autocomplete="name"></div><div class="check-row"><input type="checkbox" id="ra-' + r.id + '" data-a><label for="ra-' + r.id + '">' + tr('approveRelTxt') + '</label></div>' +
        '<div class="field"><label for="rf-' + r.id + '">' + tr('feedbackPh') + '</label><textarea id="rf-' + r.id + '" data-f rows="3" maxlength="4000"></textarea></div><div class="portal-alert" data-m role="alert"></div>' +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="button" data-go="approve">' + tr('approveRel') + '</button><button class="btn btn--ghost" type="button" data-go="feedback">' + tr('feedback') + '</button></div></form></section>';
    });
    if (['live', 'staging_review', 'in_progress'].indexOf(p.status) > -1) {
      h += '<section class="portal-card"><h2 class="portal-h2">' + tr('updates') + '</h2><p>' + tr('balance', { u: Math.max(0, p.updates_included - usedInc), n: p.updates_included }) + '</p>' +
        '<form class="portal-form" id="up-f" novalidate><div class="field"><label for="up-t">' + tr('upTitle') + '</label><input id="up-t" maxlength="200"></div><div class="field"><label for="up-r">' + tr('upReq') + '</label><textarea id="up-r" rows="4" maxlength="8000"></textarea></div><div class="portal-alert" id="up-m" role="status"></div><button class="btn btn--navy" type="submit">' + tr('reqUpdate') + '</button></form></section>';
    }
    h += '<section class="portal-card"><h2 class="portal-h2">' + tr('updates') + ' · ' + tr('events') + '</h2>' + links + (rels.length ? '<ul class="pj-events">' + rels.map(function (r) { return '<li><strong>#' + r.number + ' ' + esc(r.title) + '</strong><span>' + tr('rs.' + r.status) + (r.price_cents ? ' · ' + money(r.price_cents) : '') + (r.published_at ? ' · ' + esc(X.fmtDT(r.published_at)) : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="portal-muted">—</p>') + '</section>';
    body.innerHTML = h;
    if (X.$('#ap-f')) {
      X.$('#ap-ch').onclick = function () { X.$('#ch-f').hidden = false; X.$('#ch-t').focus(); };
      X.$('#ap-f').onsubmit = async function (e) {
        e.preventDefault(); var n = X.$('#ap-n').value.trim(); if (n.length < 3 || !X.$('#ap-a').checked) return X.msg(X.$('#ap-m'), tr('name') + ' / ✓', 'error');
        this.querySelector('button').disabled = true;
        try { await call({ action: 'approve_proposal', project_id: p.id, name: n, agree: true }); X.route(); } catch (x) { this.querySelector('button').disabled = false; X.msg(X.$('#ap-m'), tr('err'), 'error'); }
      };
      X.$('#ch-f').onsubmit = async function (e) { e.preventDefault(); var t = X.$('#ch-t').value.trim(); if (t.length < 3) return; this.querySelector('button').disabled = true; try { await call({ action: 'request_changes', project_id: p.id, text: t }); ERoute.go('#/projetos?id=' + p.id); } catch (x) { this.querySelector('button').disabled = false; } };
    }
    body.querySelectorAll('form[data-rel]').forEach(function (f) {
      f.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = async function () {
        var m = f.querySelector('[data-m]'), go = b.dataset.go;
        var payload = go === 'approve' ? { action: 'release_approve', name: f.querySelector('[data-n]').value.trim(), agree: f.querySelector('[data-a]').checked } : { action: 'release_feedback', text: f.querySelector('[data-f]').value.trim() };
        if (go === 'approve' && (payload.name.length < 3 || !payload.agree)) return X.msg(m, tr('name') + ' / ✓', 'error');
        if (go === 'feedback' && payload.text.length < 3) return X.msg(m, tr('feedbackPh'), 'error');
        b.disabled = true; payload.project_id = p.id; payload.release_id = f.dataset.rel;
        try { await call(payload); X.route(); } catch (x) { b.disabled = false; X.msg(m, tr('err'), 'error'); }
      }; });
    });
    if (X.$('#up-f')) X.$('#up-f').onsubmit = async function (e) {
      e.preventDefault(); var t = X.$('#up-t').value.trim(), r = X.$('#up-r').value.trim(); if (t.length < 3 || r.length < 10) return X.msg(X.$('#up-m'), tr('upReq'), 'error');
      this.querySelector('button').disabled = true;
      try { await call({ action: 'request_update', project_id: p.id, title: t, request: r }); X.msg(X.$('#up-m'), tr('upSent'), 'ok'); setTimeout(X.route, 1400); } catch (x) { this.querySelector('button').disabled = false; X.msg(X.$('#up-m'), tr('err'), 'error'); }
    };
  }

  window.EProjects = { view: function (el, ctx) { return view(el, ctx); }, addCompany: function (ctx, after) { init(ctx); addCompany(after); }, label: function (lang) { return (D[lang] || D.pt).nav; }, addLabel: function (lang) { return (D[lang] || D.pt).addCo; } };
})();
