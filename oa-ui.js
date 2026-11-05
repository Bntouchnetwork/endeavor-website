/* Shared timeline + Operating Agreement labels (PT/EN/ES) for the admin and client portals.
   One timeline for both portals: stages come from companies.stage, events from company_timeline, and the last stage's
   sub-status from operating_agreements.status. Plain script: sets window.EOAUI. */
(function () {
  'use strict';
  var STAGES = ['onboarding', 'documents', 'filing_prep', 'filed', 'approved', 'operating_agreement'];
  var SUBS = ['pending_generation', 'questionnaire', 'drafting', 'in_review', 'client_review', 'approved', 'signing', 'signed', 'archived'];
  var T = {
    pt: {
      st_onboarding: 'Onboarding', st_documents: 'Documentos recebidos', st_filing_prep: 'Preparação dos Articles', st_filed: 'Protocolado no estado', st_approved: 'Empresa aprovada', st_operating_agreement: 'Operating Agreement',
      ss_pending_generation: 'Pendente de geração', ss_questionnaire: 'Questionário', ss_drafting: 'Redação da minuta', ss_in_review: 'Revisão da Endeavor', ss_client_review: 'Revisão do cliente', ss_approved: 'Aprovado', ss_signing: 'Em assinatura', ss_signed: 'Assinado', ss_archived: 'Arquivado', ss_cancelled: 'Cancelado',
      tl_title: 'Linha do tempo', tl_now: 'Etapa atual', tl_done: 'Concluída', tl_next: 'Próxima', tl_empty: 'Sem eventos ainda.', tl_by_system: 'sistema', tl_review_required: 'encaminhado para revisão habilitada',
      rv_client_unsure: 'O cliente pediu orientação', rv_differs_from_articles: 'Diferente do que consta nos Articles', rv_no_approved_rules: 'Estado sem regras aprovadas', rv_rules_not_approved: 'Regras do estado ainda não aprovadas pelo revisor', rv_s_corp_foreign_member: 'S corp com sócio que não é pessoa dos EUA', rv_c_corp_election: 'Eleição de C corp', rv_specific_purpose: 'Objeto específico', rv_ai_flag: 'A IA sinalizou um ponto', rv_draft_failed: 'Falha na geração da minuta',
      q_legal_name: 'Nome legal', q_state: 'Estado', q_management: 'Administração', q_tax: 'Tributação', q_purpose: 'Objeto', q_draft: 'Minuta'
    },
    en: {
      st_onboarding: 'Onboarding', st_documents: 'Documents received', st_filing_prep: 'Articles preparation', st_filed: 'Filed with the state', st_approved: 'Company approved', st_operating_agreement: 'Operating Agreement',
      ss_pending_generation: 'Pending generation', ss_questionnaire: 'Questionnaire', ss_drafting: 'Drafting', ss_in_review: 'Endeavor review', ss_client_review: 'Your review', ss_approved: 'Approved', ss_signing: 'Signing', ss_signed: 'Signed', ss_archived: 'Archived', ss_cancelled: 'Cancelled',
      tl_title: 'Timeline', tl_now: 'Current step', tl_done: 'Completed', tl_next: 'Upcoming', tl_empty: 'No events yet.', tl_by_system: 'system', tl_review_required: 'sent to a qualified reviewer',
      rv_client_unsure: 'You asked for guidance', rv_differs_from_articles: 'Differs from the Articles', rv_no_approved_rules: 'No approved rules for this state', rv_rules_not_approved: 'State rules pending reviewer approval', rv_s_corp_foreign_member: 'S corporation with a member who is not a U.S. person', rv_c_corp_election: 'C corporation election', rv_specific_purpose: 'Specific purpose', rv_ai_flag: 'The AI flagged a point', rv_draft_failed: 'Draft generation failed',
      q_legal_name: 'Legal name', q_state: 'State', q_management: 'Management', q_tax: 'Tax classification', q_purpose: 'Purpose', q_draft: 'Draft'
    },
    es: {
      st_onboarding: 'Onboarding', st_documents: 'Documentos recibidos', st_filing_prep: 'Preparación de los Articles', st_filed: 'Presentado al estado', st_approved: 'Empresa aprobada', st_operating_agreement: 'Operating Agreement',
      ss_pending_generation: 'Pendiente de generación', ss_questionnaire: 'Cuestionario', ss_drafting: 'Redacción del borrador', ss_in_review: 'Revisión de Endeavor', ss_client_review: 'Su revisión', ss_approved: 'Aprobado', ss_signing: 'En firma', ss_signed: 'Firmado', ss_archived: 'Archivado', ss_cancelled: 'Cancelado',
      tl_title: 'Línea de tiempo', tl_now: 'Etapa actual', tl_done: 'Completada', tl_next: 'Próxima', tl_empty: 'Sin eventos todavía.', tl_by_system: 'sistema', tl_review_required: 'enviado a revisión habilitada',
      rv_client_unsure: 'Usted pidió orientación', rv_differs_from_articles: 'Distinto de lo que figura en los Articles', rv_no_approved_rules: 'Estado sin reglas aprobadas', rv_rules_not_approved: 'Reglas del estado pendientes de aprobación', rv_s_corp_foreign_member: 'S corp con un socio que no es persona de EE. UU.', rv_c_corp_election: 'Elección de C corp', rv_specific_purpose: 'Objeto específico', rv_ai_flag: 'La IA señaló un punto', rv_draft_failed: 'Falló la generación del borrador',
      q_legal_name: 'Nombre legal', q_state: 'Estado', q_management: 'Administración', q_tax: 'Tributación', q_purpose: 'Objeto', q_draft: 'Borrador'
    }
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function t(L, k) { return (T[L] || T.pt)[k] || T.en[k] || k; }
  function fmt(L, at) { try { return new Intl.DateTimeFormat({ pt: 'pt-BR', en: 'en-US', es: 'es' }[L] || 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at)); } catch (e) { return at; } }
  function issue(L, i) { return t(L, 'rv_' + i.code) + (i.q && T.pt['q_' + i.q] ? ' · ' + t(L, 'q_' + i.q) : '') + (i.detail ? ': ' + i.detail : ''); }

  /* Compact stepper for cards. company: {stage}, oa: {status} or null */
  function stepper(L, company, oa) {
    var cur = STAGES.indexOf(company.stage || 'onboarding');
    return '<ol class="tl-steps" aria-label="' + esc(t(L, 'tl_title')) + '">' + STAGES.map(function (s, i) {
      var cls = i < cur || (s === 'operating_agreement' && oa && oa.status === 'archived') ? 'done' : i === cur ? 'now' : '';
      var sub = s === 'operating_agreement' && i === cur && oa ? '<small>' + esc(t(L, 'ss_' + oa.status)) + '</small>' : '';
      return '<li class="' + cls + '"' + (cls === 'now' ? ' aria-current="step"' : '') + '><span class="tl-dot" aria-hidden="true"></span><span class="tl-lbl">' + esc(t(L, 'st_' + s)) + sub + '</span></li>';
    }).join('') + '</ol>';
  }
  /* Full timeline: stages with their events; the last stage lists the Operating Agreement sub-statuses up to Archived */
  function full(L, company, oa, rows, opts) {
    opts = opts || {};
    var cur = STAGES.indexOf(company.stage || 'onboarding');
    var byStage = {}; (rows || []).forEach(function (r) { (byStage[r.stage] = byStage[r.stage] || []).push(r); });
    var who = function (r) { return opts.showActor ? ' · ' + esc(r.actor_email && r.actor_email !== 'system' ? r.actor_email : t(L, 'tl_by_system')) : ''; };
    return '<ol class="tl-full">' + STAGES.map(function (s, i) {
      var state = i < cur || (s === 'operating_agreement' && oa && oa.status === 'archived') ? 'done' : i === cur ? 'now' : 'next';
      var evs = (byStage[s] || []).filter(function (r) { return !r.substatus; });
      var first = evs[0];
      var html = '<li class="tl-' + state + '"><div class="tl-head"><span class="tl-dot" aria-hidden="true"></span><strong>' + esc(t(L, 'st_' + s)) + '</strong><span class="tl-tag">' + esc(t(L, state === 'done' ? 'tl_done' : state === 'now' ? 'tl_now' : 'tl_next')) + '</span></div>' +
        (first ? '<div class="tl-when">' + esc(fmt(L, first.at)) + who(first) + (first.note ? ' · ' + esc(first.note) : '') + '</div>' : '');
      if (s === 'operating_agreement' && (oa || cur === i)) {
        var subEv = {}; (byStage[s] || []).filter(function (r) { return r.substatus; }).forEach(function (r) { subEv[r.substatus] = r; });
        var ci = oa ? SUBS.indexOf(oa.status) : 0;
        html += '<ol class="tl-sub">' + SUBS.map(function (x, j) {
          var st2 = !oa || cur < i ? 'next' : (j < ci || (x === 'archived' && oa.status === 'archived')) ? 'done' : j === ci ? 'now' : 'next';
          var ev = subEv[x];
          return '<li class="tl-' + st2 + '"><span class="tl-dot" aria-hidden="true"></span>' + esc(t(L, 'ss_' + x)) + (ev && st2 !== 'next' ? ' <span class="tl-when">' + esc(fmt(L, ev.at)) + who(ev) + (ev.note === 'review_required' ? ' · ' + esc(t(L, 'tl_review_required')) : '') + '</span>' : '') + '</li>';
        }).join('') + '</ol>';
      }
      return html + '</li>';
    }).join('') + '</ol>';
  }
  window.EOAUI = { STAGES: STAGES, SUBS: SUBS, T: T, t: t, esc: esc, fmt: fmt, issue: issue, stepper: stepper, full: full };
})();
