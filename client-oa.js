/* Client portal: company timeline + Operating Agreement assistant (owner only).
   Uses the `oa` edge function for every action (validated and audited server-side) and Supabase Realtime so both
   portals update on their own. Text in EN/PT/ES. Sets window.EClientOA. */
(function () {
  'use strict';
  var D = {
    en: {
      oa: 'Operating Agreement', gen: 'Generate Operating Agreement', cont: 'Continue', open: 'Open',
      introT: 'Your company was approved. The last step is the Operating Agreement.',
      intro: 'We retrieve your company data and the Articles filed with the state. You only confirm what is already filled in and answer what is missing; each question has an explanation. Our AI drafts the agreement using only legal rules approved by Endeavor, Endeavor reviews it, you review and approve it, and everyone signs electronically. The signed PDF is saved in your company folder.',
      steps: ['Confirm the retrieved data', 'Answer the questions (saved automatically)', 'AI drafts with approved rules', 'Endeavor reviews', 'You review and approve', 'Electronic signature and archive'],
      consent: 'I authorize Endeavor to use its document assistant (an AI service from Anthropic or OpenAI, through their official APIs) to read my company records and Articles and to draft the Operating Agreement from my answers. I understand the draft is reviewed by Endeavor before I see it, that it is not legal advice tailored by an attorney unless a reviewer is assigned, and that my actions in this process are recorded for compliance.',
      needConsent: 'Check the authorization box to continue.', starting: 'Retrieving your company data…',
      fromArticles: 'Retrieved from the Articles', fromRecord: 'From your company record', confirmHint: 'Check and change only if it is wrong.',
      saved: 'Saved {t}', saving: 'Saving…', saveErr: 'Not saved. Check your connection.', submit: 'Generate the draft', submitting: 'Sending…',
      incomplete: 'Some answers are missing or need a fix:', willReview: 'These answers will be reviewed by a qualified professional before the draft is released:',
      addMember: 'Add member', addManager: 'Add manager', remove: 'Remove', name: 'Full name', email: 'Email (only for the signature link)', pct: 'Percentage', contribution: 'Contribution (USD or description)',
      total: 'Total: {p}', yes: 'Yes', no: 'No', choose: 'Choose…', what: 'What this means',
      drafting: 'Drafting your Operating Agreement', draftingT: 'Our AI is drafting the agreement with the approved rules for your state. This page updates on its own.',
      review: 'Endeavor is reviewing the draft', reviewT: 'You will be notified here when it is ready for your review.', reviewReq: 'A qualified professional will review these points:',
      returned: 'Endeavor asked you to review some answers:',
      yourReview: 'Review the draft', yourReviewT: 'Read the document. If something must change, leave a comment on the section and request corrections. When everything is right, approve the final version.',
      section: 'Section', general: 'General', comment: 'Comment', addComment: 'Add comment', reqChanges: 'Request corrections', commentSent: 'Comment saved.', changesSent: 'Sent to Endeavor for corrections.',
      approveT: 'Final approval', approveC: 'I reviewed this version, approve it as final and agree to sign it electronically. I understand every listed signer must sign.', typed: 'Type your full name', approve: 'Approve and sign',
      approving: 'Preparing the signature…', comments: 'Comments', resolved: 'Resolved', open2: 'Open',
      signT: 'Signatures', signLead: 'The agreement is signed in the Endeavor e-signature tool, one signer at a time.', signNow: 'Sign now', resend: 'Resend link to the next signer', resent: 'Link sent.', resentAdmin: 'Endeavor will send the link.',
      st_pending: 'Waiting', st_sent: 'Link sent', st_signed: 'Signed',
      doneT: 'Signed and archived', doneL: 'The signed Operating Agreement is in your company folder.', docs: 'Open documents',
      cancelled: 'This Operating Agreement was cancelled by Endeavor. Contact support@endeavorbiz.com.',
      notOwner: 'Only the account owner can prepare the Operating Agreement.', notReady: 'The Operating Agreement becomes available after the company is approved.',
      pdfErr: 'Could not load the document.', err: 'Something went wrong. Try again.', foreignNote: 'Note about foreign owners',
      e_incomplete: 'Some answers are missing.', e_consent_required: 'Confirm the authorization and type your name.', e_invalid_state: 'This step is no longer available. The page was updated.', e_not_your_turn: 'It is not your turn to sign.',
      m_pct_total: 'Percentages must add up to 100% (now {d}).', m_pct_zero: 'Every member needs a percentage above 0.', m_email: 'Enter a valid email for every person.', m_email_dup: 'Each person needs a different email.', m_format: 'Use the MM-DD format.', m_missing: 'Answer: {q}'
    },
    pt: {
      oa: 'Operating Agreement', gen: 'Generate Operating Agreement', cont: 'Continuar', open: 'Abrir',
      introT: 'A sua empresa foi aprovada. A última etapa é o Operating Agreement.',
      intro: 'Buscamos os dados da sua empresa e os Articles arquivados no estado. Você só confirma o que já está preenchido e responde o que falta; cada pergunta tem uma explicação. A nossa IA redige o acordo usando apenas regras jurídicas aprovadas pela Endeavor, a Endeavor revisa, você revisa e aprova, e todos assinam eletronicamente. O PDF assinado fica na pasta da empresa.',
      steps: ['Confirmar os dados recuperados', 'Responder às perguntas (salva sozinho)', 'IA redige com regras aprovadas', 'Revisão da Endeavor', 'Sua revisão e aprovação', 'Assinatura eletrônica e arquivo'],
      consent: 'Autorizo a Endeavor a usar o seu assistente de documentos (um serviço de IA da Anthropic ou da OpenAI, pelas APIs oficiais) para ler os registros e os Articles da minha empresa e redigir o Operating Agreement a partir das minhas respostas. Entendo que a minuta é revisada pela Endeavor antes de chegar a mim, que não é uma orientação jurídica personalizada de advogado salvo quando um revisor é designado, e que as minhas ações neste processo ficam registradas para fins de compliance.',
      needConsent: 'Marque a autorização para continuar.', starting: 'Buscando os dados da empresa…',
      fromArticles: 'Recuperado dos Articles', fromRecord: 'Do cadastro da empresa', confirmHint: 'Confira e altere só se estiver errado.',
      saved: 'Salvo {t}', saving: 'Salvando…', saveErr: 'Não salvou. Verifique a conexão.', submit: 'Gerar a minuta', submitting: 'Enviando…',
      incomplete: 'Faltam respostas ou há algo a corrigir:', willReview: 'Estas respostas serão analisadas por um profissional habilitado antes de liberarmos a minuta:',
      addMember: 'Adicionar sócio', addManager: 'Adicionar gerente', remove: 'Remover', name: 'Nome completo', email: 'E-mail (só para o link de assinatura)', pct: 'Porcentagem', contribution: 'Aporte (USD ou descrição)',
      total: 'Total: {p}', yes: 'Sim', no: 'Não', choose: 'Escolha…', what: 'O que isso significa',
      drafting: 'Redigindo o seu Operating Agreement', draftingT: 'A nossa IA está redigindo o acordo com as regras aprovadas para o seu estado. Esta página se atualiza sozinha.',
      review: 'A Endeavor está revisando a minuta', reviewT: 'Avisaremos aqui quando estiver pronta para a sua revisão.', reviewReq: 'Um profissional habilitado vai analisar estes pontos:',
      returned: 'A Endeavor pediu que você revise algumas respostas:',
      yourReview: 'Revise a minuta', yourReviewT: 'Leia o documento. Se algo precisar mudar, deixe um comentário na cláusula e peça correções. Quando estiver tudo certo, aprove a versão final.',
      section: 'Cláusula', general: 'Geral', comment: 'Comentário', addComment: 'Adicionar comentário', reqChanges: 'Pedir correções', commentSent: 'Comentário salvo.', changesSent: 'Enviado à Endeavor para correção.',
      approveT: 'Aprovação final', approveC: 'Revisei esta versão, aprovo como final e concordo em assiná-la eletronicamente. Entendo que todos os signatários listados precisam assinar.', typed: 'Digite o seu nome completo', approve: 'Aprovar e assinar',
      approving: 'Preparando a assinatura…', comments: 'Comentários', resolved: 'Resolvido', open2: 'Aberto',
      signT: 'Assinaturas', signLead: 'O acordo é assinado na ferramenta de assinatura eletrônica da Endeavor, um signatário por vez.', signNow: 'Assinar agora', resend: 'Reenviar link ao próximo signatário', resent: 'Link enviado.', resentAdmin: 'A Endeavor vai enviar o link.',
      st_pending: 'Aguardando', st_sent: 'Link enviado', st_signed: 'Assinado',
      doneT: 'Assinado e arquivado', doneL: 'O Operating Agreement assinado está na pasta da empresa.', docs: 'Abrir documentos',
      cancelled: 'Este Operating Agreement foi cancelado pela Endeavor. Fale com support@endeavorbiz.com.',
      notOwner: 'Só o titular da conta pode preparar o Operating Agreement.', notReady: 'O Operating Agreement fica disponível depois que a empresa é aprovada.',
      pdfErr: 'Não foi possível carregar o documento.', err: 'Algo deu errado. Tente de novo.', foreignNote: 'Observação sobre sócios estrangeiros',
      e_incomplete: 'Faltam respostas.', e_consent_required: 'Confirme a autorização e digite o seu nome.', e_invalid_state: 'Esta etapa não está mais disponível. A página foi atualizada.', e_not_your_turn: 'Ainda não é a sua vez de assinar.',
      m_pct_total: 'As porcentagens precisam somar 100% (agora {d}).', m_pct_zero: 'Todo sócio precisa de porcentagem acima de 0.', m_email: 'Informe um e-mail válido para cada pessoa.', m_email_dup: 'Cada pessoa precisa de um e-mail diferente.', m_format: 'Use o formato MM-DD.', m_missing: 'Responda: {q}'
    },
    es: {
      oa: 'Operating Agreement', gen: 'Generate Operating Agreement', cont: 'Continuar', open: 'Abrir',
      introT: 'Su empresa fue aprobada. La última etapa es el Operating Agreement.',
      intro: 'Recuperamos los datos de su empresa y los Articles presentados al estado. Usted solo confirma lo que ya está completo y responde lo que falta; cada pregunta tiene una explicación. Nuestra IA redacta el acuerdo usando solo reglas jurídicas aprobadas por Endeavor, Endeavor lo revisa, usted lo revisa y aprueba, y todos firman electrónicamente. El PDF firmado queda en la carpeta de la empresa.',
      steps: ['Confirmar los datos recuperados', 'Responder las preguntas (se guarda solo)', 'La IA redacta con reglas aprobadas', 'Revisión de Endeavor', 'Su revisión y aprobación', 'Firma electrónica y archivo'],
      consent: 'Autorizo a Endeavor a usar su asistente de documentos (un servicio de IA de Anthropic u OpenAI, mediante sus API oficiales) para leer los registros y los Articles de mi empresa y redactar el Operating Agreement a partir de mis respuestas. Entiendo que el borrador lo revisa Endeavor antes de que lo vea, que no es asesoría jurídica personalizada de un abogado salvo que se asigne un revisor, y que mis acciones en este proceso quedan registradas para fines de compliance.',
      needConsent: 'Marque la autorización para continuar.', starting: 'Recuperando los datos de la empresa…',
      fromArticles: 'Recuperado de los Articles', fromRecord: 'Del registro de la empresa', confirmHint: 'Revise y cambie solo si está mal.',
      saved: 'Guardado {t}', saving: 'Guardando…', saveErr: 'No se guardó. Revise la conexión.', submit: 'Generar el borrador', submitting: 'Enviando…',
      incomplete: 'Faltan respuestas o hay algo que corregir:', willReview: 'Estas respuestas serán revisadas por un profesional habilitado antes de liberar el borrador:',
      addMember: 'Agregar socio', addManager: 'Agregar gerente', remove: 'Quitar', name: 'Nombre completo', email: 'Correo (solo para el enlace de firma)', pct: 'Porcentaje', contribution: 'Aporte (USD o descripción)',
      total: 'Total: {p}', yes: 'Sí', no: 'No', choose: 'Elija…', what: 'Qué significa',
      drafting: 'Redactando su Operating Agreement', draftingT: 'Nuestra IA está redactando el acuerdo con las reglas aprobadas para su estado. Esta página se actualiza sola.',
      review: 'Endeavor está revisando el borrador', reviewT: 'Le avisaremos aquí cuando esté listo para su revisión.', reviewReq: 'Un profesional habilitado revisará estos puntos:',
      returned: 'Endeavor le pidió revisar algunas respuestas:',
      yourReview: 'Revise el borrador', yourReviewT: 'Lea el documento. Si algo debe cambiar, deje un comentario en la cláusula y pida correcciones. Cuando todo esté bien, apruebe la versión final.',
      section: 'Cláusula', general: 'General', comment: 'Comentario', addComment: 'Agregar comentario', reqChanges: 'Pedir correcciones', commentSent: 'Comentario guardado.', changesSent: 'Enviado a Endeavor para corrección.',
      approveT: 'Aprobación final', approveC: 'Revisé esta versión, la apruebo como final y acepto firmarla electrónicamente. Entiendo que todos los firmantes indicados deben firmar.', typed: 'Escriba su nombre completo', approve: 'Aprobar y firmar',
      approving: 'Preparando la firma…', comments: 'Comentarios', resolved: 'Resuelto', open2: 'Abierto',
      signT: 'Firmas', signLead: 'El acuerdo se firma en la herramienta de firma electrónica de Endeavor, un firmante a la vez.', signNow: 'Firmar ahora', resend: 'Reenviar enlace al siguiente firmante', resent: 'Enlace enviado.', resentAdmin: 'Endeavor enviará el enlace.',
      st_pending: 'Pendiente', st_sent: 'Enlace enviado', st_signed: 'Firmado',
      doneT: 'Firmado y archivado', doneL: 'El Operating Agreement firmado está en la carpeta de la empresa.', docs: 'Abrir documentos',
      cancelled: 'Endeavor canceló este Operating Agreement. Escriba a support@endeavorbiz.com.',
      notOwner: 'Solo el titular de la cuenta puede preparar el Operating Agreement.', notReady: 'El Operating Agreement está disponible después de que la empresa es aprobada.',
      pdfErr: 'No se pudo cargar el documento.', err: 'Algo salió mal. Intente de nuevo.', foreignNote: 'Nota sobre socios extranjeros',
      e_incomplete: 'Faltan respuestas.', e_consent_required: 'Confirme la autorización y escriba su nombre.', e_invalid_state: 'Esta etapa ya no está disponible. La página se actualizó.', e_not_your_turn: 'Todavía no es su turno de firmar.',
      m_pct_total: 'Los porcentajes deben sumar 100% (ahora {d}).', m_pct_zero: 'Cada socio necesita un porcentaje mayor que 0.', m_email: 'Indique un correo válido para cada persona.', m_email_dup: 'Cada persona necesita un correo distinto.', m_format: 'Use el formato MM-DD.', m_missing: 'Responda: {q}'
    }
  };
  var C, L, U = window.EOAUI;
  function tr(k, v) { var s = (D[L] || D.en)[k]; if (s == null) s = D.en[k] || k; if (v) Object.keys(v).forEach(function (x) { s = String(s).split('{' + x + '}').join(v[x]); }); return s; }
  function lx(o) { return o ? (o[L] || o.en || o.pt || '') : ''; }
  var esc = function (s) { return U.esc(s); };
  async function fn(payload) {
    var sess = (await C.sb.auth.getSession()).data.session;
    var r = await fetch(C.CFG.functionsUrl + '/oa', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'HTTP ' + r.status); e.detail = j.detail; throw e; }
    return j;
  }
  function audit(action, company, entity, details) { try { C.sb.rpc('audit_event', { p_action: action, p_entity_type: entity ? 'operating_agreement' : 'company', p_entity_id: entity || company, p_company: company, p_details: details || {} }).then(function () {}, function () {}); } catch (e) { /* best effort */ } }
  function errMsg(e) { return (D[L] || D.en)['e_' + e.message] ? tr('e_' + e.message) : tr('err'); }

  /* ---------------- timeline (overview + company tab) ---------------- */
  async function loadTL(companyIds) {
    var r = await Promise.all([
      C.sb.from('company_timeline').select('*').in('company_id', companyIds).order('at'),
      C.S.perms.owner ? C.sb.from('operating_agreements').select('id, company_id, status, review_required, updated_at').in('company_id', companyIds).neq('status', 'cancelled') : Promise.resolve({ data: [] })
    ]);
    return { rows: r[0].data || [], oas: r[1].data || [] };
  }
  async function overviewCard(companies) {
    if (!companies.length) return '';
    var d = await loadTL(companies.map(function (c) { return c.id; }));
    return '<section class="portal-card tl-card"><h2 class="portal-h2">' + esc(U.t(L, 'tl_title')) + '</h2>' + companies.map(function (co) {
      var oa = d.oas.find(function (o) { return o.company_id === co.id; });
      var cta = oa && C.S.perms.owner && ['pending_generation', 'questionnaire', 'client_review', 'signing'].indexOf(oa.status) > -1
        ? '<a class="btn ' + (oa.status === 'pending_generation' ? 'btn--gold' : 'btn--navy') + ' btn--xs" href="#/oa?company=' + co.id + '">' + esc(oa.status === 'pending_generation' ? tr('gen') : oa.status === 'signing' ? tr('signNow') : tr('cont')) + '</a>' : '';
      return '<div class="tl-row"><div class="tl-row__head"><a href="#/companies?id=' + co.id + '&tab=timeline"><strong>' + esc(co.legal_name) + '</strong></a>' + cta + '</div>' + U.stepper(L, co, oa) + '</div>';
    }).join('') + '</section>';
  }
  async function companyTab(body, co) {
    var d = await loadTL([co.id]);
    var oa = d.oas[0];
    var cta = '';
    if (co.stage === 'operating_agreement' && oa && C.S.perms.owner) {
      cta = oa.status === 'archived' ? '' : '<div class="oa-cta"><div><strong>' + esc(tr('oa')) + '</strong> · ' + esc(U.t(L, 'ss_' + oa.status)) + '</div><a class="btn ' + (oa.status === 'pending_generation' ? 'btn--gold' : 'btn--navy') + '" href="#/oa?company=' + co.id + '" id="oa-go">' + esc(oa.status === 'pending_generation' ? tr('gen') : tr('open')) + '</a></div>';
    }
    body.innerHTML = '<section class="portal-card">' + cta + U.full(L, co, oa, d.rows) + '</section>';
    audit('timeline.view', co.id);
  }

  /* ---------------- Operating Agreement view ---------------- */
  var state = { saveTimer: null, oaId: null, companyId: null, data: null, dirty: false };
  async function view(view) {
    var cid = C.param('company'), co = C.S.companies.find(function (c) { return c.id === cid; });
    if (!co) { view.innerHTML = '<div class="portal-alert portal-alert--error">' + esc(tr('err')) + '</div>'; return; }
    if (!C.S.perms.owner) { view.innerHTML = C.head(tr('oa'), co.legal_name) + '<div class="portal-card">' + esc(tr('notOwner')) + '</div>'; return; }
    var row = (await C.sb.from('operating_agreements').select('id, status').eq('company_id', co.id).neq('status', 'cancelled').maybeSingle()).data;
    if (!row) { var cx = (await C.sb.from('operating_agreements').select('id, status').eq('company_id', co.id).eq('status', 'cancelled').limit(1)).data; view.innerHTML = C.head(tr('oa'), co.legal_name) + '<div class="portal-card">' + esc(cx && cx.length ? tr('cancelled') : tr('notReady')) + '</div>'; return; }
    state.oaId = row.id; state.companyId = co.id;
    var d = await fn({ action: 'get', oa_id: row.id });
    state.data = d;
    audit('oa.view', co.id, row.id, { status: d.oa.status });
    render(view, co, d);
  }
  function crumbs(co) { return '<p class="crumbs"><a href="#/companies?id=' + co.id + '&tab=timeline">' + esc(co.legal_name) + '</a> /</p>'; }
  function substeps(oa) {
    var order = ['questionnaire', 'drafting', 'in_review', 'client_review', 'signing', 'archived'], ci = U.SUBS.indexOf(oa.status);
    return '<ol class="tl-steps tl-steps--oa">' + order.map(function (s) { var i = U.SUBS.indexOf(s); var cls = i < ci || oa.status === 'archived' ? 'done' : (i === ci || (s === 'signing' && (oa.status === 'approved' || oa.status === 'signed'))) ? 'now' : ''; return '<li class="' + cls + '"><span class="tl-dot" aria-hidden="true"></span><span class="tl-lbl">' + esc(U.t(L, 'ss_' + s)) + '</span></li>'; }).join('') + '</ol>';
  }
  function render(view, co, d) {
    var oa = d.oa;
    var top = crumbs(co) + C.head(tr('oa'), co.legal_name + (d.rules && d.rules.state_name ? ' · ' + d.rules.state_name : '')) + (oa.status !== 'pending_generation' ? substeps(oa) : '');
    var R = { pending_generation: rStart, questionnaire: rForm, drafting: rWait, in_review: rReview, client_review: rClientReview, approved: rSign, signing: rSign, signed: rSign, archived: rDone }[oa.status] || rWait;
    view.innerHTML = top + '<div id="oa-body"></div>';
    R($('#oa-body', view), co, d);
  }
  function go(url) { if (window.EOA_NAVIGATE) window.EOA_NAVIGATE(url); else location.href = url; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function rStart(el, co, d) {
    el.innerHTML = '<section class="portal-card oa-start"><h2 class="portal-h2">' + esc(tr('introT')) + '</h2><p>' + esc(tr('intro')) + '</p><ol class="oa-steps">' + tr('steps').map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<label class="check oa-consent"><input type="checkbox" id="oa-consent"> <span>' + esc(tr('consent')) + '</span></label>' +
      '<div class="portal-alert" id="oa-msg" role="alert"></div><button class="btn btn--gold" type="button" id="oa-gen">' + esc(tr('gen')) + '</button></section>';
    $('#oa-gen', el).onclick = async function () {
      var m = $('#oa-msg', el);
      if (!$('#oa-consent', el).checked) return C.msg(m, tr('needConsent'), 'error');
      this.disabled = true; C.msg(m, tr('starting'), 'info');
      try { await fn({ action: 'start', oa_id: d.oa.id, consent: true }); C.route(); } catch (e) { this.disabled = false; C.msg(m, errMsg(e), 'error'); }
    };
  }

  /* ----- questionnaire ----- */
  function rForm(el, co, d) {
    var a = JSON.parse(JSON.stringify(d.oa.answers || {})), rs = d.rules, src = d.oa.prefill_sources || {};
    if (!Array.isArray(a.members) || !a.members.length) a.members = [{ name: C.S.me && C.S.me.name || '', email: (C.S.user && C.S.user.email) || '', pct: 100, contribution: '', us_person: '' }];
    if (!Array.isArray(a.managers)) a.managers = [];
    var notesFor = function (q) {
      var out = [];
      if (q.note) out.push(lx(q.note));
      if (q.id === 'state' && q.notes_other && a.state === 'other') out.push(lx(q.notes_other));
      if (q.notes_extra && q.notes_extra.foreign && a.members.some(function (m) { return m.us_person === 'no'; })) out.push(lx(q.notes_extra.foreign));
      return out;
    };
    function input(q) {
      var v = a[q.id], id = 'q-' + q.id;
      if (q.type === 'members' || q.type === 'managers') return listUI(q);
      if (q.type === 'select') return '<select id="' + id + '" data-q="' + q.id + '"><option value="">' + esc(tr('choose')) + '</option>' + q.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(lx(o[1])) + '</option>'; }).join('') + '</select>' +
        (q.detail ? '<div class="field oa-detail" data-detail-for="' + q.id + '"' + (v === q.detail.when ? '' : ' hidden') + '><label for="' + id + '_d">' + esc(lx(q.detail.label)) + '</label><input id="' + id + '_d" data-q="' + q.id + '_detail" value="' + esc(a[q.id + '_detail'] || '') + '"></div>' : '');
      return '<input id="' + id + '" data-q="' + q.id + '" type="' + (q.type === 'date' ? 'date' : 'text') + '" value="' + esc(v || '') + '" autocomplete="off">';
    }
    function listUI(q) {
      var members = q.type === 'members', arr = members ? a.members : a.managers;
      return '<div class="oa-list" data-list="' + q.id + '">' + arr.map(function (m, i) {
        return '<div class="oa-person"><div class="portal-grid2"><div class="field"><label>' + esc(tr('name')) + '</label><input data-l="' + q.id + '" data-i="' + i + '" data-k="name" value="' + esc(m.name || '') + '"></div>' +
          '<div class="field"><label>' + esc(tr('email')) + '</label><input type="email" data-l="' + q.id + '" data-i="' + i + '" data-k="email" value="' + esc(m.email || '') + '"></div>' +
          (members ? '<div class="field"><label>' + esc(tr('pct')) + '</label><input type="number" min="0" max="100" step="0.01" data-l="members" data-i="' + i + '" data-k="pct" value="' + esc(m.pct == null ? '' : m.pct) + '"></div>' +
            '<div class="field"><label>' + esc(tr('contribution')) + '</label><input data-l="members" data-i="' + i + '" data-k="contribution" value="' + esc(m.contribution || '') + '"></div>' : '') + '</div>' +
          (members ? '<fieldset class="oa-yn"><legend>' + esc(lx(q.sub.us_person)) + '</legend><label><input type="radio" name="us' + i + '" data-l="members" data-i="' + i + '" data-k="us_person" value="yes"' + (m.us_person === 'yes' ? ' checked' : '') + '> ' + esc(tr('yes')) + '</label><label><input type="radio" name="us' + i + '" data-l="members" data-i="' + i + '" data-k="us_person" value="no"' + (m.us_person === 'no' ? ' checked' : '') + '> ' + esc(tr('no')) + '</label></fieldset>' : '') +
          (arr.length > (members ? 1 : 0) ? '<button class="btn btn--ghost btn--xs" type="button" data-rm="' + q.id + '" data-i="' + i + '">' + esc(tr('remove')) + '</button>' : '') + '</div>';
      }).join('') + '<div class="oa-list__foot"><button class="btn btn--ghost btn--xs" type="button" data-add="' + q.id + '">+ ' + esc(tr(members ? 'addMember' : 'addManager')) + '</button>' +
        (members ? '<span class="oa-total" id="oa-total">' + esc(tr('total', { p: a.members.reduce(function (s, m) { return s + (Number(m.pct) || 0); }, 0) + '%' })) + '</span>' : '') + '</div></div>';
    }
    function card(q) {
      var badge = src[q.prefill] ? '<span class="oa-src">' + esc(src[q.prefill] === 'articles' ? tr('fromArticles') : tr('fromRecord')) + ' · ' + esc(tr('confirmHint')) + '</span>' : '';
      var notes = notesFor(q);
      return '<div class="oa-q" data-qcard="' + q.id + '"><div class="oa-q__main"><label class="oa-q__label" for="q-' + q.id + '">' + esc(lx(q.label)) + (q.essential ? ' <span aria-hidden="true" class="req">*</span>' : '') + '</label>' + badge + input(q) + '</div>' +
        '<aside class="oa-help" aria-label="' + esc(tr('what')) + '"><strong>' + esc(tr('what')) + '</strong><p>' + esc(lx(q.help)) + '</p>' + notes.map(function (n) { return '<p class="oa-help__state">' + esc(n) + '</p>'; }).join('') + '</aside></div>';
    }
    function draw() {
      var vis = window.EOARules ? EOARules.visibleQuestions(rs, a) : rs.questions;
      el.innerHTML = (d.oa.review_note ? '<div class="portal-alert portal-alert--info" style="display:block"><strong>' + esc(tr('returned')) + '</strong> ' + esc(d.oa.review_note) + '</div>' : '') +
        '<div class="oa-savebar"><span id="oa-saved" role="status" aria-live="polite"></span></div>' +
        rs.sections.map(function (s) { var qs = vis.filter(function (q) { return q.section === s[0]; }); return qs.length ? '<section class="portal-card oa-sec"><h2 class="portal-h2">' + esc(lx(s[1])) + '</h2>' + qs.map(card).join('') + '</section>' : ''; }).join('') +
        '<section class="portal-card"><div id="oa-check"></div><div class="portal-alert" id="oa-msg" role="alert"></div><button class="btn btn--gold" type="button" id="oa-submit">' + esc(tr('submit')) + '</button></section>';
      wire(); check();
    }
    function collect(target) {
      var k = target.dataset.q, l = target.dataset.l;
      if (k) a[k] = target.value;
      if (l) { var arr = l === 'members' ? a.members : a.managers, i = +target.dataset.i; arr[i] = arr[i] || {}; arr[i][target.dataset.k] = target.dataset.k === 'pct' ? (target.value === '' ? '' : Number(target.value)) : target.value; }
    }
    function check() {
      var ev = window.EOARules ? EOARules.evaluate(rs, a, d.oa.prefill || {}) : { missing: [], errors: [], review: [] };
      var qlabel = function (id) { var q = rs.questions.find(function (x) { return x.id === id.split('.')[0].replace(/_detail$/, ''); }); return q ? lx(q.label) : id; };
      var errs = ev.errors.map(function (e) { return tr('m_' + e.code, { d: e.detail || '' }); });
      var tot = $('#oa-total', el); if (tot) tot.textContent = tr('total', { p: (Math.round(a.members.reduce(function (s, m) { return s + (Number(m.pct) || 0); }, 0) * 100) / 100) + '%' });
      $('#oa-check', el).innerHTML = (errs.length || ev.missing.length ? '<div class="oa-issues"><strong>' + esc(tr('incomplete')) + '</strong><ul>' + errs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + ev.missing.map(function (x) { return '<li>' + esc(tr('m_missing', { q: qlabel(x) })) + '</li>'; }).join('') + '</ul></div>' : '') +
        (ev.review.length ? '<div class="oa-issues oa-issues--review"><strong>' + esc(tr('willReview')) + '</strong><ul>' + ev.review.map(function (x) { return '<li>' + esc(U.issue(L, x)) + '</li>'; }).join('') + '</ul></div>' : '');
      return ev;
    }
    function save() {
      clearTimeout(state.saveTimer);
      var s = $('#oa-saved', el); if (s) s.textContent = tr('saving');
      state.saveTimer = setTimeout(async function () {
        try { var r = await fn({ action: 'save', oa_id: d.oa.id, answers: a }); d.oa.answers = JSON.parse(JSON.stringify(a)); state.dirty = false; if (state.reload) { state.reload = false; C.route(); return; } var s2 = $('#oa-saved', el); if (s2) s2.textContent = tr('saved', { t: new Date(r.saved_at).toLocaleTimeString(EP.locale, { hour: '2-digit', minute: '2-digit' }) }); }
        catch (e) { var s3 = $('#oa-saved', el); if (s3) { s3.textContent = tr('saveErr'); s3.classList.add('is-err'); } }
      }, 700);
    }
    function wire() {
      $$('[data-q],[data-l]', el).forEach(function (inp) {
        var ev = inp.tagName === 'SELECT' || inp.type === 'radio' || inp.type === 'date' ? 'change' : 'input';
        inp.addEventListener(ev, function () {
          collect(inp); state.dirty = true; if (inp.dataset.q === 'state') state.reload = true;
          var structural = inp.dataset.q === 'management' || inp.dataset.q === 'state' || inp.dataset.k === 'us_person' || (inp.dataset.q && el.querySelector('[data-detail-for="' + inp.dataset.q + '"]'));
          if (structural) { var f = document.activeElement && document.activeElement.id; draw(); if (f && document.getElementById(f)) document.getElementById(f).focus(); }
          else check();
          save();
        });
      });
      $$('[data-add]', el).forEach(function (b) { b.onclick = function () { (b.dataset.add === 'members' ? a.members : a.managers).push(b.dataset.add === 'members' ? { name: '', email: '', pct: '', contribution: '', us_person: '' } : { name: '', email: '' }); draw(); save(); }; });
      $$('[data-rm]', el).forEach(function (b) { b.onclick = function () { (b.dataset.rm === 'members' ? a.members : a.managers).splice(+b.dataset.i, 1); draw(); save(); }; });
      $('#oa-submit', el).onclick = async function () {
        var ev = check(), m = $('#oa-msg', el);
        if (ev.missing.length || ev.errors.length) { C.msg(m, tr('e_incomplete'), 'error'); $('#oa-check', el).scrollIntoView({ block: 'center' }); return; }
        this.disabled = true; C.msg(m, tr('submitting'), 'info');
        try { clearTimeout(state.saveTimer); await fn({ action: 'save', oa_id: d.oa.id, answers: a }); await fn({ action: 'submit', oa_id: d.oa.id }); state.dirty = false; C.route(); }
        catch (e) { this.disabled = false; C.msg(m, errMsg(e), 'error'); }
      };
    }
    draw();
  }

  function rWait(el) { el.innerHTML = '<section class="portal-card oa-wait"><div class="oa-spinner" aria-hidden="true"></div><h2 class="portal-h2">' + esc(tr('drafting')) + '</h2><p class="portal-muted">' + esc(tr('draftingT')) + '</p></section>'; }
  function rReview(el, co, d) {
    var open = (d.oa.issues || []).filter(function (i) { return !i.resolved; });
    el.innerHTML = '<section class="portal-card oa-wait"><h2 class="portal-h2">' + esc(tr('review')) + '</h2><p class="portal-muted">' + esc(tr('reviewT')) + '</p>' +
      (d.oa.review_required && open.length ? '<div class="oa-issues oa-issues--review"><strong>' + esc(tr('reviewReq')) + '</strong><ul>' + open.map(function (i) { return '<li>' + esc(U.issue(L, i)) + '</li>'; }).join('') + '</ul></div>' : '') + '</section>';
  }
  async function pdfInto(box, d, final) {
    try {
      var r = await fn({ action: 'pdf', oa_id: d.oa.id, version: d.oa.version, final: !!final });
      var doc = await EPdf.open(r.url);
      box.innerHTML = '';
      await EPdf.render(doc, box, { maxWidth: 820, pageLabel: 'Page' });
    } catch (e) { box.innerHTML = '<div class="portal-alert portal-alert--error">' + esc(tr('pdfErr')) + '</div>'; }
  }
  function rClientReview(el, co, d) {
    var ver = (d.versions || []).find(function (v) { return v.version === d.oa.version && !v.final; }) || {};
    var secs = []; ((ver.content && ver.content.articles) || []).forEach(function (a) { a.sections.forEach(function (s) { secs.push(s); }); });
    var com = (d.comments || []).filter(function (c) { return c.version === d.oa.version || !c.resolved_at; });
    el.innerHTML = '<div class="oa-review"><section class="portal-card oa-review__doc"><h2 class="portal-h2">' + esc(tr('yourReview')) + ' · v' + d.oa.version + '</h2><p class="portal-muted">' + esc(tr('yourReviewT')) + '</p>' + (d.oa.review_note ? '<div class="portal-alert portal-alert--info" style="display:block">' + esc(d.oa.review_note) + '</div>' : '') + '<div class="viewer__pages oa-pdf" id="oa-pdf"><p class="portal-muted">…</p></div></section>' +
      '<aside class="oa-review__side"><section class="portal-card"><h3 class="portal-h2">' + esc(tr('comments')) + '</h3>' +
      (com.length ? '<ul class="oa-comments">' + com.map(function (c) { return '<li><span class="pill' + (c.resolved_at ? ' pill--done' : '') + '">' + esc(c.resolved_at ? tr('resolved') : tr('open2')) + '</span> <strong>' + esc(c.section || tr('general')) + '</strong><p>' + esc(c.body) + '</p>' + (c.resolution ? '<p class="portal-muted">↳ ' + esc(c.resolution) + '</p>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="field"><label for="oa-sec">' + esc(tr('section')) + '</label><select id="oa-sec"><option value="">' + esc(tr('general')) + '</option>' + secs.map(function (s) { return '<option value="' + esc(s.num) + '">' + esc(s.num + ' ' + s.title) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="oa-com">' + esc(tr('comment')) + '</label><textarea id="oa-com" rows="3" maxlength="2000"></textarea></div><div class="portal-alert" id="oa-cmsg" role="status"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="oa-addc">' + esc(tr('addComment')) + '</button><button class="btn btn--navy btn--xs" type="button" id="oa-req">' + esc(tr('reqChanges')) + '</button></div></section>' +
      '<section class="portal-card oa-approve"><h3 class="portal-h2">' + esc(tr('approveT')) + '</h3><label class="check"><input type="checkbox" id="oa-ok"> <span>' + esc(tr('approveC')) + '</span></label>' +
      '<div class="field"><label for="oa-name">' + esc(tr('typed')) + '</label><input id="oa-name" autocomplete="name"></div><div class="portal-alert" id="oa-amsg" role="alert"></div><button class="btn btn--gold btn--block" type="button" id="oa-approve">' + esc(tr('approve')) + '</button></section></aside></div>';
    pdfInto($('#oa-pdf', el), d, false);
    var sendC = async function (req) {
      var m = $('#oa-cmsg', el), body = $('#oa-com', el).value.trim();
      if (!body) { $('#oa-com', el).focus(); return; }
      try { await fn({ action: 'comment', oa_id: d.oa.id, section: $('#oa-sec', el).value, body: body, request_changes: !!req }); C.msg(m, tr(req ? 'changesSent' : 'commentSent'), 'ok'); $('#oa-com', el).value = ''; if (!req) setTimeout(C.route, 500); else C.route(); } catch (e) { C.msg(m, errMsg(e), 'error'); }
    };
    $('#oa-addc', el).onclick = function () { sendC(false); };
    $('#oa-req', el).onclick = function () { sendC(true); };
    $('#oa-approve', el).onclick = async function () {
      var m = $('#oa-amsg', el), nm = $('#oa-name', el).value.trim();
      if (!$('#oa-ok', el).checked || nm.length < 3) return C.msg(m, tr('e_consent_required'), 'error');
      this.disabled = true; C.msg(m, tr('approving'), 'info');
      try {
        var r = await fn({ action: 'approve', oa_id: d.oa.id, consent: true, typed_name: nm });
        if (r.sign_url) { go(r.sign_url); return; } // opens the Endeavor e-signature tool with the document and fields loaded
        C.route();
      } catch (e) { this.disabled = false; C.msg(m, errMsg(e), 'error'); }
    };
  }
  function rSign(el, co, d) {
    var signers = d.oa.signers || [], next = signers.findIndex(function (s) { return s.status !== 'signed'; });
    el.innerHTML = '<section class="portal-card"><h2 class="portal-h2">' + esc(tr('signT')) + '</h2><p class="portal-muted">' + esc(tr('signLead')) + '</p><ol class="oa-signers">' + signers.map(function (s, i) {
      return '<li class="' + (s.status === 'signed' ? 'is-done' : i === next ? 'is-now' : '') + '"><strong>' + esc(s.name) + '</strong> <span class="portal-muted">' + esc(s.capacity) + '</span> <span class="pill' + (s.status === 'signed' ? ' pill--done' : '') + '">' + esc(tr('st_' + (s.status || 'pending'))) + '</span>' + (s.signed_at ? ' <small>' + esc(U.fmt(L, s.signed_at)) + '</small>' : '') +
        (i === next && s.me && d.oa.status === 'signing' ? ' <button class="btn btn--gold btn--xs" type="button" id="oa-sign">' + esc(tr('signNow')) + '</button>' : '') + '</li>';
    }).join('') + '</ol>' + (next > -1 && !(signers[next] || {}).me && d.oa.status === 'signing' ? '<button class="btn btn--ghost btn--xs" type="button" id="oa-resend">' + esc(tr('resend')) + '</button>' : '') + '<div class="portal-alert" id="oa-smsg" role="status"></div></section>';
    if ($('#oa-sign', el)) $('#oa-sign', el).onclick = async function () { try { var r = await fn({ action: 'sign_link', oa_id: d.oa.id }); go(r.url); } catch (e) { C.msg($('#oa-smsg', el), errMsg(e), 'error'); } };
    if ($('#oa-resend', el)) $('#oa-resend', el).onclick = async function () { try { var r = await fn({ action: 'resend', oa_id: d.oa.id }); C.msg($('#oa-smsg', el), tr(r.emailed ? 'resent' : 'resentAdmin'), 'ok'); } catch (e) { C.msg($('#oa-smsg', el), errMsg(e), 'error'); } };
  }
  function rDone(el, co) {
    el.innerHTML = '<section class="portal-card oa-done"><div class="oa-done__icon" aria-hidden="true">✓</div><h2 class="portal-h2">' + esc(tr('doneT')) + '</h2><p>' + esc(tr('doneL')) + '</p><a class="btn btn--navy" href="#/companies?id=' + co.id + '&tab=docs">' + esc(tr('docs')) + '</a></section>';
  }

  /* ---------------- realtime: both portals update on their own ---------------- */
  var chan = null, rt = null;
  function subscribe() {
    if (!C.sb.channel || chan) return;
    var cid = C.S.client && C.S.client.id; if (!cid) return;
    var onChange = function (payload) {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var h = ERoute.get();
        var row = payload && (payload.new || payload.old) || {};
        if (/^#\/oa/.test(h)) {
          if (row.company_id && row.company_id !== state.companyId) return;
          if (payload.table === 'operating_agreements' && state.data && payload.new && payload.new.status === state.data.oa.status && state.data.oa.status === 'questionnaire') return; // own autosave
          if (state.dirty) return;
          C.route();
        } else if (/^#\/(overview|companies)|^#?\/?$/.test(h) || h === '') {
          if (document.querySelector('#overlay:not([hidden])')) return;
          if (payload.table === 'companies' && payload.new) { var co = C.S.companies.find(function (c) { return c.id === payload.new.id; }); if (co) Object.assign(co, payload.new); }
          C.route();
        }
      }, 400);
    };
    chan = C.sb.channel('endeavor-tl-' + cid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operating_agreements', filter: 'client_id=eq.' + cid }, function (p) { p.table = 'operating_agreements'; onChange(p); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'company_timeline', filter: 'client_id=eq.' + cid }, function (p) { p.table = 'company_timeline'; onChange(p); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'companies', filter: 'client_id=eq.' + cid }, function (p) { p.table = 'companies'; onChange(p); })
      .subscribe();
  }
  function unsubscribe() { if (chan && C.sb.removeChannel) C.sb.removeChannel(chan); chan = null; }

  window.EClientOA = {
    init: function (ctx) { C = ctx; L = ctx.L; unsubscribe(); subscribe(); },
    overviewCard: overviewCard, companyTab: companyTab, view: view, audit: audit, t: tr
  };
})();
