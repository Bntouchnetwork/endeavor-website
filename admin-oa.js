/* Admin console: Compliance (Operating Agreements review, Audit Reports, legal rules and reviewers, privacy settings)
   and the company timeline control. Everything that changes an Operating Agreement goes through the `oa` function
   (validated + audited); stage changes are table updates audited by database triggers. Sets window.AdminOA. */
(function () {
  'use strict';
  var U = window.EOAUI, L = 'pt';
  var ST_PILL = { pending_generation: '', questionnaire: '', drafting: 'pill--info', in_review: 'pill--warn', client_review: 'pill--info', approved: 'pill--done', signing: 'pill--info', signed: 'pill--done', archived: 'pill--done', cancelled: '' };
  var ROLE = { admin: 'Admin', client_owner: 'Cliente (titular)', collaborator: 'Colaborador', partner: 'Parceiro', signer: 'Signatário', system: 'Sistema', user: 'Usuário' };
  var ACTIONS = [['', 'Todas as ações'], ['portal.', 'Acesso aos portais'], ['doc.', 'Documentos'], ['timeline.', 'Timeline'], ['oa.', 'Operating Agreement'], ['esign.', 'Assinatura eletrônica'], ['rules.', 'Regras jurídicas'], ['compliance.', 'Configurações de compliance'], ['audit.', 'Relatórios de auditoria']];
  var A = {
    'portal.access': 'Acesso ao portal', 'timeline.view': 'Visualizou a timeline', 'timeline.stage': 'Etapa alterada', 'doc.view': 'Visualizou documento', 'doc.download': 'Baixou documento',
    'oa.view': 'Abriu o Operating Agreement', 'oa.consent': 'Consentimento (IA e dados)', 'oa.start': 'Iniciou o Operating Agreement', 'oa.answer': 'Resposta salva', 'oa.submit': 'Enviou o questionário',
    'oa.draft_generated': 'Minuta gerada', 'oa.pdf_view': 'Abriu o PDF', 'oa.comment': 'Comentário do cliente', 'oa.changes_requested': 'Cliente pediu correções', 'oa.approve': 'Cliente aprovou a versão final',
    'oa.signature_requested': 'Assinatura solicitada', 'oa.signature_resent': 'Link de assinatura reenviado', 'oa.signed': 'Todos assinaram', 'oa.archived': 'Arquivado na pasta da empresa',
    'oa.regenerate': 'Nova minuta solicitada', 'oa.section_edited': 'Cláusula editada', 'oa.issue_resolved': 'Pendência resolvida', 'oa.comment_resolved': 'Comentário resolvido', 'oa.released_to_client': 'Liberado para o cliente',
    'oa.returned_to_client': 'Devolvido ao questionário', 'oa.cancelled': 'Cancelado', 'oa.restarted': 'Reiniciado',
    'esign.created': 'Envelope criado', 'esign.sent': 'Envelope enviado', 'esign.emailed': 'Link enviado por e-mail', 'esign.viewed': 'Signatário abriu', 'esign.consented': 'Consentimento eletrônico', 'esign.signed': 'Assinou', 'esign.completed': 'Envelope concluído', 'esign.voided': 'Envelope anulado', 'esign.downloaded': 'PDF assinado baixado', 'esign.link_copied': 'Link copiado',
    'rules.approve': 'Regras aprovadas', 'rules.retire': 'Regras retiradas', 'compliance.reviewer': 'Revisor habilitado alterado', 'compliance.settings': 'Configuração de privacidade', 'audit.view': 'Abriu o relatório', 'audit.export': 'Exportou relatório', 'audit.verify': 'Verificou integridade'
  };
  function pill(st) { return '<span class="pill ' + (ST_PILL[st] || '') + '">' + U.esc(U.t(L, 'ss_' + st)) + '</span>'; }
  async function fn(ctx, payload) {
    var sess = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/oa', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'HTTP ' + r.status); e.detail = j.detail; throw e; }
    return j;
  }
  var ERR = { reviewer_required: 'Só um revisor habilitado pode fazer isso.', issues_open: 'Resolva as pendências antes de liberar.', rules_not_approved: 'As regras deste estado ainda não foram aprovadas por um revisor habilitado.', invalid_state: 'Esta ação não vale para o status atual.', forbidden: 'Sem permissão.', not_found: 'Não encontrado.' };
  var errText = function (ctx, e) { return ERR[e.message] || ctx.errText(e); };
  function param(k) { var m = ERoute.get().match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; }
  function audit(ctx, action, details) { ctx.sb.rpc('audit_event', { p_action: action, p_entity_type: 'audit_report', p_entity_id: null, p_company: null, p_details: details || {} }).then(function () {}, function () {}); }

  /* ================= Compliance shell ================= */
  async function compliance(view, ctx) {
    var tab = param('tab') || 'oa';
    var TABS = [['oa', 'Operating Agreements'], ['audit', 'Audit Reports'], ['regras', 'Regras jurídicas e revisores'], ['privacidade', 'Privacidade']];
    view.innerHTML = '<div class="console__head"><div><h1>Compliance</h1><p class="portal-muted">Operating Agreements, trilha de auditoria protegida, regras aprovadas e privacidade.</p></div></div>' +
      '<nav class="subtabs" aria-label="Compliance">' + TABS.map(function (t) { return '<a href="#/compliance?tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="cp-body"></div>';
    var body = view.querySelector('#cp-body');
    if (tab === 'oa') return param('id') ? oaDetail(body, ctx, param('id')) : oaList(body, ctx);
    if (tab === 'audit') return auditReports(body, ctx);
    if (tab === 'regras') return rulesTab(body, ctx);
    return privacyTab(body, ctx);
  }

  /* ----- queue ----- */
  async function oaList(body, ctx) {
    var esc = ctx.esc;
    var rows = await ctx.q(ctx.sb.from('operating_agreements').select('id, status, state, review_required, updated_at, version, company_id, client_id, companies(legal_name, state), clients(name)').order('updated_at', { ascending: false }).limit(300));
    var f = param('st') || 'open';
    var OPEN = ['questionnaire', 'drafting', 'in_review', 'client_review', 'approved', 'signing', 'signed'];
    var list = rows.filter(function (r) { return f === 'all' || (f === 'open' ? OPEN.indexOf(r.status) > -1 : r.status === f); });
    var count = function (s) { return rows.filter(function (r) { return r.status === s; }).length; };
    body.innerHTML = '<div class="kpis">' + [['Aguardando revisão', count('in_review')], ['Com o cliente', count('questionnaire') + count('client_review')], ['Em assinatura', count('signing')], ['Arquivados', count('archived')]].map(function (k) { return '<div class="kpi"><div class="kpi__label">' + k[0] + '</div><div class="kpi__value">' + k[1] + '</div></div>'; }).join('') + '</div>' +
      '<div class="toolbar"><select id="oa-f" aria-label="Filtrar por status">' + [['open', 'Em andamento'], ['in_review', 'Aguardando revisão'], ['pending_generation', 'Pendente de geração'], ['client_review', 'Revisão do cliente'], ['signing', 'Em assinatura'], ['archived', 'Arquivados'], ['cancelled', 'Cancelados'], ['all', 'Todos']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === f ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<section class="portal-card table-wrap"><table class="table"><thead><tr><th>Empresa</th><th>Cliente</th><th>Estado</th><th>Status</th><th>Versão</th><th>Atualizado</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) { return '<tr data-id="' + r.id + '" tabindex="0" style="cursor:pointer"><td><strong>' + esc(r.companies && r.companies.legal_name) + '</strong>' + (r.review_required && r.status === 'in_review' ? ' <span class="pill pill--overdue">Revisão habilitada</span>' : '') + '</td><td>' + esc(r.clients && r.clients.name) + '</td><td>' + esc(r.state || (r.companies && r.companies.state) || '') + '</td><td>' + pill(r.status) + '</td><td>' + (r.version ? 'v' + r.version : '-') + '</td><td>' + esc(ctx.fmtDT(r.updated_at)) + '</td></tr>'; }).join('')
        : '<tr><td colspan="6" class="portal-muted">Nenhum Operating Agreement neste filtro. Eles aparecem quando a empresa chega à etapa "Empresa aprovada".</td></tr>') + '</tbody></table></section>';
    body.querySelector('#oa-f').onchange = function () { ERoute.set('#/compliance?tab=oa&st=' + this.value); };
    body.querySelectorAll('tr[data-id]').forEach(function (tr) { var go = function () { ERoute.set('#/compliance?tab=oa&id=' + tr.dataset.id); }; tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
  }

  /* ----- detail / review ----- */
  async function oaDetail(body, ctx, id) {
    var esc = ctx.esc;
    var d = await fn(ctx, { action: 'get', oa_id: id });
    var oa = d.oa, co = d.company, rules = d.rules || {};
    var tl = await ctx.q(ctx.sb.from('company_timeline').select('*').eq('company_id', co.id).order('at'));
    var trail = await ctx.q(ctx.sb.from('audit_log').select('*').or('entity_id.eq.' + oa.id + ',and(company_id.eq.' + co.id + ',action.like.esign.*)').order('id', { ascending: false }).limit(60));
    var cur = (d.versions || []).find(function (v) { return v.version === oa.version && !v.final; }) || (d.versions || [])[0];
    var openIssues = (oa.issues || []).filter(function (i) { return !i.resolved; });
    var sub = param('sec') || 'minuta';
    var can = function (sts) { return sts.indexOf(oa.status) > -1; };
    body.innerHTML = '<p class="crumbs"><a href="#/compliance?tab=oa">Operating Agreements</a> / <a href="#/clientes?id=' + oa.client_id + '">' + esc(d.client.name) + '</a> /</p>' +
      '<div class="console__head"><div><h1 style="font-size:1.4rem">' + esc(co.legal_name) + '</h1><p class="portal-muted">' + esc(rules.state_name || oa.state || '') + ' · regras ' + esc(oa.rules_version || rules.version || '-') + (rules.approved ? ' (aprovadas)' : ' (pendentes de aprovação)') + ' · ' + (oa.version ? 'minuta v' + oa.version : 'sem minuta') + ' · IA ' + (d.ai_configured ? 'configurada' : 'não configurada') + '</p></div>' +
      '<div class="portal-btn-row">' + pill(oa.status) + (oa.review_required ? ' <span class="pill pill--overdue">Revisão habilitada</span>' : '') + '</div></div>' +
      (oa.last_error ? '<div class="portal-alert portal-alert--error" style="display:block">Erro na última geração: ' + esc(oa.last_error) + '</div>' : '') +
      '<div class="oa-adm"><div class="oa-adm__main">' +
      '<div class="toolbar oa-actions">' +
        (can(['in_review']) ? '<button class="btn btn--navy btn--xs" id="a-release">Liberar para o cliente</button>' : '') +
        (can(['in_review', 'client_review']) ? '<button class="btn btn--ghost btn--xs" id="a-regen">Nova minuta com IA</button><button class="btn btn--ghost btn--xs" id="a-return">Devolver ao questionário</button>' : '') +
        (can(['signing']) ? '<a class="btn btn--ghost btn--xs" href="#/assinaturas">Ver envelopes em Assinaturas</a>' : '') +
        (!can(['signed', 'archived', 'cancelled']) ? '<button class="btn btn--danger btn--xs" id="a-cancel">Cancelar</button>' : '') +
        (can(['cancelled']) ? '<button class="btn btn--ghost btn--xs" id="a-restart">Reiniciar</button>' : '') +
      '</div><div class="portal-alert" id="a-msg" role="alert"></div>' +
      (oa.issues && oa.issues.length ? '<section class="portal-card"><h2 class="portal-h2">Pendências para revisão habilitada' + (d.reviewer ? '' : ' <span class="portal-muted" style="font-size:.8rem;font-weight:400">(só revisores habilitados resolvem)</span>') + '</h2><ul class="oa-issue-list">' + oa.issues.map(function (i, n) {
        return '<li class="' + (i.resolved ? 'is-done' : '') + '"><span>' + esc(U.issue('pt', i)) + '</span>' + (i.resolved ? '<small>Resolvido por ' + esc(i.resolved_by) + ' · ' + esc(i.note || '') + '</small>' : d.reviewer ? '<button class="btn btn--ghost btn--xs" data-res="' + n + '">Resolver</button>' : '') + '</li>';
      }).join('') + '</ul></section>' : '') +
      '<nav class="subtabs" aria-label="Seções">' + [['minuta', 'Minuta'], ['respostas', 'Respostas'], ['comentarios', 'Comentários (' + (d.comments || []).filter(function (c) { return !c.resolved_at; }).length + ')'], ['versoes', 'Versões'], ['assinaturas', 'Assinaturas'], ['trilha', 'Trilha']].map(function (x) { return '<a href="#/compliance?tab=oa&id=' + oa.id + '&sec=' + x[0] + '"' + (x[0] === sub ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav><div id="oa-sub"></div></div>' +
      '<aside class="oa-adm__side portal-card"><h2 class="portal-h2">Timeline</h2>' + U.full('pt', co, oa, tl, { showActor: true }) + '</aside></div>';
    var subEl = body.querySelector('#oa-sub'), m = body.querySelector('#a-msg');
    var act = async function (payload, okMsg) { try { ctx.msg(m, 'Processando…', 'info'); await fn(ctx, Object.assign({ oa_id: oa.id }, payload)); ctx.msg(m, okMsg || 'Feito.', 'ok'); ctx.route(); } catch (e) { ctx.msg(m, errText(ctx, e) + (e.detail ? ': ' + [].concat(e.detail).join(', ') : ''), 'error'); } };
    var ask = function (title, label, cb, req) {
      ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><form class="portal-form" id="ask-f"><div class="field"><label for="ask-t">' + esc(label) + '</label><textarea id="ask-t" rows="5" maxlength="4000"' + (req ? ' required' : '') + '></textarea></div><button class="btn btn--navy" type="submit">Confirmar</button></form>');
      document.getElementById('ask-f').onsubmit = function (e) { e.preventDefault(); var v = document.getElementById('ask-t').value.trim(); if (req && !v) return; ctx.closeOverlay(); cb(v); };
    };
    var on = function (sel, f) { var b = body.querySelector(sel); if (b) b.onclick = f; };
    on('#a-release', function () { ask('Liberar para o cliente', 'Mensagem ao cliente (opcional)', function (v) { act({ action: 'admin_release', note: v }, 'Liberado. O cliente já vê a minuta no portal.'); }); });
    on('#a-regen', function () { ask('Nova minuta com IA', 'Instruções do revisor (a IA continua limitada às regras aprovadas)', function (v) { act({ action: 'admin_regenerate', note: v }, 'Gerando nova minuta…'); }); });
    on('#a-return', function () { ask('Devolver ao questionário', 'O que o cliente precisa revisar', function (v) { act({ action: 'admin_return', note: v }, 'Devolvido ao cliente.'); }, true); });
    on('#a-cancel', function () { ask('Cancelar Operating Agreement', 'Motivo', function (v) { act({ action: 'admin_cancel', note: v }, 'Cancelado.'); }, true); });
    on('#a-restart', function () { act({ action: 'admin_restart' }, 'Reiniciado.'); });
    body.querySelectorAll('[data-res]').forEach(function (b) { b.onclick = function () { ask('Resolver pendência', 'Fundamento da decisão (fica na trilha de auditoria)', function (v) { act({ action: 'admin_resolve_issue', index: +b.dataset.res, note: v }, 'Pendência resolvida.'); }, true); }; });

    if (sub === 'minuta') {
      if (!cur) { subEl.innerHTML = '<div class="portal-card empty-state"><strong>Sem minuta ainda</strong>' + esc(U.t('pt', 'ss_' + oa.status)) + '</div>'; return; }
      var secs = []; cur.content.articles.forEach(function (a) { a.sections.forEach(function (s) { secs.push([a, s]); }); });
      subEl.innerHTML = '<div class="toolbar"><button class="btn btn--ghost btn--xs" id="m-pdf">Abrir PDF da v' + cur.version + '</button><span class="portal-muted" style="font-size:.85rem">Fonte: ' + esc(cur.source === 'ai' ? 'IA ' + (cur.ai_provider || '') + ' / ' + (cur.ai_model || '') : cur.source === 'edit' ? 'edição manual' : 'modelo aprovado (sem IA)') + ' · validação: ' + ((cur.validation || []).length ? (cur.validation || []).length + ' alerta(s)' : 'ok') + '</span></div>' +
        ((cur.validation || []).length ? '<div class="portal-alert portal-alert--info" style="display:block">' + (cur.validation || []).map(function (v) { return esc(v.code + (v.rule ? ' · ' + v.rule : '') + (v.detail ? ' · ' + v.detail : '')); }).join('<br>') + '<br><small>Cláusulas com alerta usam o texto-modelo aprovado.</small></div>' : '') +
        '<div class="oa-secs">' + secs.map(function (x) {
          var a = x[0], s = x[1];
          return '<article class="oa-secrow"><header><strong>' + esc(s.num + ' ' + s.title) + '</strong> <span class="portal-muted">Art. ' + esc(a.num) + ' · regra ' + esc(s.rule) + '</span>' + (s.ai ? ' <span class="pill pill--info">IA</span>' : s.edited_by ? ' <span class="pill">editada</span>' : ' <span class="pill">modelo</span>') +
            (can(['in_review', 'client_review']) ? ' <button class="btn btn--ghost btn--xs" data-edit="' + esc(s.rule) + '">Editar</button>' : '') + '</header><p>' + esc(s.text) + '</p>' +
            '<details><summary>Texto-modelo aprovado e referências</summary><p class="portal-muted">' + esc(s.model) + '</p><ul class="oa-refs">' + (s.refs || []).map(function (r) { return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.cite) + '</a></li>'; }).join('') + '</ul></details></article>';
        }).join('') + '</div>';
      subEl.querySelector('#m-pdf').onclick = async function () { try { var r = await fn(ctx, { action: 'pdf', oa_id: oa.id, version: cur.version }); window.open(r.url, '_blank', 'noopener'); } catch (e) { ctx.msg(m, errText(ctx, e), 'error'); } };
      subEl.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () {
        var s = secs.find(function (x) { return x[1].rule === b.dataset.edit; })[1];
        ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Editar ' + esc(s.num + ' ' + s.title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><form class="portal-form" id="ed-f"><p class="portal-muted" style="font-size:.85rem">A edição gera uma nova versão e volta para "Revisão da Endeavor". Mantenha o efeito jurídico do texto-modelo aprovado.</p><div class="field"><label for="ed-t">Texto</label><textarea id="ed-t" rows="12">' + esc(s.text) + '</textarea></div><button class="btn btn--navy" type="submit">Salvar nova versão</button></form>');
        document.getElementById('ed-f').onsubmit = function (e) { e.preventDefault(); var v = document.getElementById('ed-t').value.trim(); ctx.closeOverlay(); act({ action: 'admin_edit_section', rule: s.rule, text: v }, 'Nova versão gerada.'); };
      }; });
    } else if (sub === 'respostas') {
      var a = oa.answers || {}, src = oa.prefill_sources || {}, qs = (rules.questions || []);
      var val = function (q) {
        var v = a[q.id];
        if (q.type === 'members') return (a.members || []).map(function (x) { return esc(x.name) + ' · ' + esc(x.pct) + '% · ' + esc(x.contribution) + ' · ' + esc(x.email) + ' · pessoa dos EUA: ' + esc(x.us_person || '-'); }).join('<br>');
        if (q.type === 'managers') return (a.managers || []).map(function (x) { return esc(x.name) + ' · ' + esc(x.email); }).join('<br>');
        var o = q.options && q.options.find(function (x) { return x[0] === v; });
        return esc(o ? o[1].pt : v || '-') + (a[q.id + '_detail'] ? ' · ' + esc(a[q.id + '_detail']) : '');
      };
      subEl.innerHTML = '<section class="portal-card"><dl class="kv kv--wide">' + qs.map(function (q) { return '<dt>' + esc(q.label.pt) + (src[q.prefill] ? ' <span class="pill">' + (src[q.prefill] === 'articles' ? 'Articles' : 'cadastro') + '</span>' : '') + (oa.prefill && q.prefill && oa.prefill[q.prefill] != null && String(oa.prefill[q.prefill]) !== String(a[q.id]) ? ' <span class="pill pill--overdue">alterado</span>' : '') + '</dt><dd>' + val(q) + '</dd>'; }).join('') + '</dl>' +
        '<p class="portal-muted" style="font-size:.85rem;margin-top:1rem">Articles lidos: ' + (src._articles_document ? 'sim' + (src._articles_ai ? ' (IA ' + esc(src._articles_ai.model) + ')' : '') : 'não') + (src._note ? ' · ' + esc(src._note) : '') + '</p>' +
        '<h3 class="portal-h2" style="margin-top:1rem">Consentimentos</h3><ul class="timeline">' + (oa.consents || []).map(function (c) { return '<li><strong>' + esc(c.type) + '</strong> v' + esc(c.version) + ' · ' + esc(c.by) + ' · ' + esc(ctx.fmtDT(c.at)) + (c.ip ? ' · IP ' + esc(c.ip) : '') + (c.typed_name ? ' · "' + esc(c.typed_name) + '"' : '') + '</li>'; }).join('') + '</ul></section>';
    } else if (sub === 'comentarios') {
      var cs = d.comments || [];
      subEl.innerHTML = '<section class="portal-card">' + (cs.length ? '<ul class="oa-comments">' + cs.map(function (c) { return '<li><span class="pill' + (c.resolved_at ? ' pill--done' : '') + '">' + (c.resolved_at ? 'Resolvido' : 'Aberto') + '</span> <strong>' + esc(c.section || 'Geral') + '</strong> · v' + esc(c.version) + ' · ' + esc(c.author_email) + ' · ' + esc(ctx.fmtDT(c.at)) + '<p>' + esc(c.body) + '</p>' + (c.resolution ? '<p class="portal-muted">↳ ' + esc(c.resolution) + ' (' + esc(c.resolved_by) + ')</p>' : '<button class="btn btn--ghost btn--xs" data-cres="' + c.id + '">Marcar como resolvido</button>') + '</li>'; }).join('') + '</ul>' : '<p class="portal-muted">Nenhum comentário.</p>') + '</section>';
      subEl.querySelectorAll('[data-cres]').forEach(function (b) { b.onclick = function () { ask('Resolver comentário', 'Resposta ao cliente', function (v) { act({ action: 'admin_resolve_comment', comment_id: +b.dataset.cres, resolution: v }, 'Comentário resolvido.'); }, true); }; });
    } else if (sub === 'versoes') {
      subEl.innerHTML = '<section class="portal-card table-wrap"><table class="table"><thead><tr><th>Versão</th><th>Fonte</th><th>IA</th><th>Regras</th><th>SHA-256 do PDF</th><th>Criada</th><th></th></tr></thead><tbody>' + (d.versions || []).map(function (v) {
        return '<tr><td>v' + v.version + (v.final ? ' <span class="pill pill--done">final</span>' : '') + '</td><td>' + esc(v.source) + '</td><td>' + esc(v.ai_model ? v.ai_provider + ' / ' + v.ai_model : '-') + '</td><td>' + esc(v.rules_version || '') + '</td><td class="mono" style="font-size:.75rem">' + esc((v.pdf_sha256 || '').slice(0, 20)) + '…</td><td>' + esc(ctx.fmtDT(v.created_at)) + '</td><td><button class="btn btn--ghost btn--xs" data-pdf="' + v.version + '" data-final="' + (v.final ? 1 : 0) + '">PDF</button></td></tr>';
      }).join('') + '</tbody></table></section>';
      subEl.querySelectorAll('[data-pdf]').forEach(function (b) { b.onclick = async function () { try { var r = await fn(ctx, { action: 'pdf', oa_id: oa.id, version: +b.dataset.pdf, final: b.dataset.final === '1' }); window.open(r.url, '_blank', 'noopener'); } catch (e) { ctx.msg(m, errText(ctx, e), 'error'); } }; });
    } else if (sub === 'assinaturas') {
      subEl.innerHTML = '<section class="portal-card">' + ((oa.signers || []).length ? '<ol class="oa-signers">' + oa.signers.map(function (s) { return '<li class="' + (s.status === 'signed' ? 'is-done' : '') + '"><strong>' + esc(s.name) + '</strong> · ' + esc(s.capacity) + ' · ' + esc(s.email || '') + ' <span class="pill' + (s.status === 'signed' ? ' pill--done' : '') + '">' + esc({ pending: 'Aguardando', sent: 'Link enviado', signed: 'Assinado' }[s.status] || s.status) + '</span>' + (s.signed_at ? ' <small>' + esc(ctx.fmtDT(s.signed_at)) + '</small>' : '') + '</li>'; }).join('') + '</ol><p class="portal-muted" style="font-size:.85rem">Cada signatário tem um envelope na ferramenta de assinatura (Assinaturas). O próximo envelope é aberto sobre o PDF já assinado pelo anterior.</p>' : '<p class="portal-muted">Os signatários aparecem quando o cliente aprova a versão final.</p>') +
        (oa.final_document_id ? '<p><a href="#/clientes?id=' + oa.client_id + '&tab=documentos">PDF final e evidências na pasta da empresa</a> · SHA-256 ' + esc(oa.final_sha256 || '') + '</p>' : '') + '</section>';
    } else {
      subEl.innerHTML = auditTable(ctx, trail) + '<p><a href="#/compliance?tab=audit&q=' + encodeURIComponent(co.id) + '">Abrir no Audit Reports</a></p>';
    }
  }

  /* ================= Audit Reports ================= */
  function summary(d) { if (!d) return ''; var k = Object.keys(d).filter(function (x) { return d[x] != null && d[x] !== '' && !(Array.isArray(d[x]) && !d[x].length); }); return k.slice(0, 6).map(function (x) { var v = d[x]; return x + ': ' + (typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80)); }).join(' · '); }
  function auditTable(ctx, rows, names) {
    var esc = ctx.esc; names = names || {};
    return '<section class="portal-card table-wrap"><table class="table table--audit"><thead><tr><th>Data/hora</th><th>Ator</th><th>Ação</th><th>Cliente / empresa</th><th>IP</th><th>Detalhes</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr><td style="white-space:nowrap">' + esc(ctx.fmtDT(r.at, { timeStyle: 'medium' })) + '</td><td>' + esc(r.actor_email || '-') + '<br><small class="portal-muted">' + esc(ROLE[r.actor_role] || r.actor_role || '') + '</small></td><td>' + esc(A[r.action] || r.action) + '<br><small class="portal-muted mono">' + esc(r.action) + '</small></td><td>' + esc(names[r.client_id] || '') + (r.company_id ? '<br><small>' + esc(names[r.company_id] || r.company_id.slice(0, 8)) + '</small>' : '') + '</td><td class="mono" style="font-size:.78rem">' + esc(r.ip || '-') + '</td><td style="font-size:.8rem;max-width:22rem">' + esc(summary(r.details)) + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="portal-muted">Nenhum registro.</td></tr>') + '</tbody></table></section>';
  }
  async function auditReports(body, ctx) {
    var esc = ctx.esc;
    var [clients, companies] = await Promise.all([ctx.q(ctx.sb.from('clients').select('id, name').order('name')), ctx.q(ctx.sb.from('companies').select('id, legal_name, client_id').order('legal_name'))]);
    var names = {}; clients.forEach(function (c) { names[c.id] = c.name; }); companies.forEach(function (c) { names[c.id] = c.legal_name; });
    var today = new Date().toISOString().slice(0, 10), from0 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    var pre = param('q');
    body.innerHTML = '<section class="portal-card"><form class="audit-filters" id="af"><div class="field"><label for="af-from">De</label><input type="date" id="af-from" value="' + from0 + '"></div><div class="field"><label for="af-to">Até</label><input type="date" id="af-to" value="' + today + '"></div>' +
      '<div class="field"><label for="af-cl">Cliente</label><select id="af-cl"><option value="">Todos</option>' + clients.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="af-co">Empresa</label><select id="af-co"><option value="">Todas</option>' + companies.map(function (c) { return '<option value="' + c.id + '"' + (pre === c.id ? ' selected' : '') + '>' + esc(c.legal_name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="af-role">Perfil</label><select id="af-role"><option value="">Todos</option>' + Object.keys(ROLE).map(function (k) { return '<option value="' + k + '">' + ROLE[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="af-act">Ação</label><select id="af-act">' + ACTIONS.map(function (a) { return '<option value="' + a[0] + '">' + a[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="af-who">E-mail do ator</label><input id="af-who" type="search" placeholder="contém…"></div>' +
      '<div class="audit-filters__btns"><button class="btn btn--navy btn--xs" type="submit">Filtrar</button><button class="btn btn--ghost btn--xs" type="button" id="af-csv">Exportar CSV</button><button class="btn btn--ghost btn--xs" type="button" id="af-pdf">Exportar PDF</button><button class="btn btn--ghost btn--xs" type="button" id="af-ver">Verificar integridade</button></div></form>' +
      '<div class="portal-alert" id="af-msg" role="status"></div><p class="portal-muted" style="font-size:.82rem;margin:.5rem 0 0">Registro somente de inclusão: nenhuma linha pode ser alterada ou apagada, e cada linha carrega o hash da anterior. IP e dispositivo são guardados quando permitidos em Compliance → Privacidade. Até 2.000 linhas por consulta.</p></section><div id="af-out"></div>';
    var rows = [], filters = {};
    var $ = function (s) { return body.querySelector(s); };
    async function run() {
      filters = { from: $('#af-from').value, to: $('#af-to').value, client: $('#af-cl').value, company: $('#af-co').value, role: $('#af-role').value, action: $('#af-act').value, who: $('#af-who').value.trim() };
      var q = ctx.sb.from('audit_log').select('*').order('id', { ascending: false }).limit(2000);
      if (filters.from) q = q.gte('at', filters.from + 'T00:00:00Z');
      if (filters.to) q = q.lte('at', filters.to + 'T23:59:59.999Z');
      if (filters.client) q = q.eq('client_id', filters.client);
      if (filters.company) q = q.eq('company_id', filters.company);
      if (filters.role) q = q.eq('actor_role', filters.role);
      if (filters.action) q = q.like('action', filters.action + '%');
      if (filters.who) q = q.ilike('actor_email', '%' + filters.who.replace(/[%_\\]/g, '') + '%');
      rows = await ctx.q(q);
      $('#af-out').innerHTML = '<p class="portal-muted" style="margin:.75rem 0">' + rows.length + ' registro(s)</p>' + auditTable(ctx, rows, names);
    }
    $('#af').onsubmit = function (e) { e.preventDefault(); run(); };
    var fdesc = function () { return ['Período ' + (filters.from || '-') + ' a ' + (filters.to || '-'), filters.client ? 'cliente ' + names[filters.client] : '', filters.company ? 'empresa ' + names[filters.company] : '', filters.role ? 'perfil ' + ROLE[filters.role] : '', filters.action ? 'ações ' + filters.action + '*' : '', filters.who ? 'ator contém ' + filters.who : ''].filter(Boolean).join(' · '); };
    var cols = ['id', 'at', 'actor_email', 'actor_role', 'action', 'entity_type', 'entity_id', 'client', 'company', 'ip', 'user_agent', 'details', 'prev_hash', 'hash'];
    var cell = function (r, c) { var v = c === 'client' ? names[r.client_id] || r.client_id : c === 'company' ? names[r.company_id] || r.company_id : c === 'details' ? JSON.stringify(r.details || {}) : r[c]; return v == null ? '' : String(v); };
    $('#af-csv').onclick = function () {
      if (!rows.length) return ctx.msg($('#af-msg'), 'Filtre primeiro.', 'error');
      var csv = '﻿' + cols.join(',') + '\n' + rows.map(function (r) { return cols.map(function (c) { var v = cell(r, c); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      ctx.download('audit-report-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv');
      audit(ctx, 'audit.export', { format: 'csv', rows: rows.length, filters: filters });
    };
    $('#af-pdf').onclick = async function () {
      if (!rows.length) return ctx.msg($('#af-msg'), 'Filtre primeiro.', 'error');
      var P = window.PDFLib, pdf = await P.PDFDocument.create(), f = await pdf.embedFont(P.StandardFonts.Helvetica), b = await pdf.embedFont(P.StandardFonts.HelveticaBold);
      var W = 792, H = 612, M = 32, page, y, safe = window.EOARender ? EOARender.safe : function (s) { return String(s || '').replace(/[^\x20-\x7E -ÿ]/g, ''); };
      var me = ((await ctx.sb.auth.getSession()).data.session || {}).user || {};
      var C = [[M, 92, 'Data/hora (UTC)'], [M + 92, 150, 'Ator'], [M + 242, 150, 'Ação'], [M + 392, 120, 'Cliente / empresa'], [M + 512, 70, 'IP'], [M + 582, W - M - (M + 582), 'Detalhes']];
      var fit = function (s, w, size) { s = safe(s); while (s.length > 1 && f.widthOfTextAtSize(s, size) > w - 4) s = s.slice(0, -2) + '.'; return s; };
      var head = function () {
        page = pdf.addPage([W, H]); y = H - M;
        page.drawText('Endeavor Business Solutions - Audit Report', { x: M, y: y - 12, size: 13, font: b, color: P.rgb(0.05, 0.13, 0.26) }); y -= 28;
        page.drawText(fit(fdesc() + ' · ' + rows.length + ' registro(s) · gerado por ' + (me.email || '') + ' em ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC', W - 2 * M, 7.5), { x: M, y: y, size: 7.5, font: f, color: P.rgb(0.35, 0.37, 0.42) }); y -= 16;
        page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 14, color: P.rgb(0.92, 0.94, 0.97) });
        C.forEach(function (c) { page.drawText(c[2], { x: c[0] + 2, y: y, size: 7.5, font: b }); }); y -= 16;
      };
      head();
      rows.slice().reverse().forEach(function (r) {
        if (y < M + 22) head();
        var vals = [String(r.at).replace('T', ' ').slice(0, 19), (r.actor_email || '-') + ' (' + (ROLE[r.actor_role] || r.actor_role || '') + ')', (A[r.action] || r.action) + ' [' + r.action + ']', (names[r.client_id] || '') + (r.company_id ? ' / ' + (names[r.company_id] || '') : ''), r.ip || '-', summary(r.details)];
        C.forEach(function (c, i) { page.drawText(fit(vals[i], c[1], 7), { x: c[0] + 2, y: y, size: 7, font: f }); });
        page.drawText(fit('hash ' + (r.hash || '') + '  prev ' + (r.prev_hash || '').slice(0, 16), W - 2 * M, 5.5), { x: M + 2, y: y - 7, size: 5.5, font: f, color: P.rgb(0.55, 0.57, 0.6) });
        y -= 18;
      });
      var ps = pdf.getPages(); ps.forEach(function (p, i) { p.drawText('Página ' + (i + 1) + ' de ' + ps.length, { x: W / 2 - 25, y: 16, size: 7.5, font: f, color: P.rgb(0.4, 0.4, 0.45) }); });
      var bytes = await pdf.save();
      ctx.download('audit-report-' + new Date().toISOString().slice(0, 10) + '.pdf', new Blob([bytes], { type: 'application/pdf' }), 'application/pdf');
      audit(ctx, 'audit.export', { format: 'pdf', rows: rows.length, filters: filters });
    };
    $('#af-ver').onclick = async function () {
      var r = await ctx.sb.rpc('audit_verify'); var x = (r.data || [])[0];
      audit(ctx, 'audit.verify', { ok: x && x.ok, checked: x && x.checked });
      ctx.msg($('#af-msg'), r.error ? ctx.errText(r.error) : x.ok ? 'Integridade confirmada: ' + x.checked + ' registro(s), cadeia de hashes intacta.' : 'ATENÇÃO: cadeia quebrada no registro #' + x.first_bad + '.', r.error || !x.ok ? 'error' : 'ok');
    };
    audit(ctx, 'audit.view', {});
    run();
  }

  /* ================= rules, reviewers, privacy ================= */
  async function rulesTab(body, ctx) {
    var esc = ctx.esc;
    var [sets, admins, rev] = await Promise.all([ctx.q(ctx.sb.from('oa_rule_sets').select('id, state, version, status, content_sha256, created_at, approved_at, approved_by, approval_note').order('state').order('created_at', { ascending: false })), ctx.q(ctx.sb.from('admins').select('*').order('email')), ctx.sb.rpc('is_legal_reviewer')]);
    var isRev = !!rev.data, anyRev = admins.some(function (a) { return a.legal_reviewer; });
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Regras jurídicas do Operating Agreement</h2><p class="portal-muted" style="font-size:.88rem">A IA só redige com o conjunto aprovado de cada estado. Um revisor habilitado (advogado) confere as perguntas, as caixas explicativas, as cláusulas-modelo e as referências antes de aprovar. Cada aprovação fica na trilha de auditoria com o hash do conteúdo.</p>' +
      '<div class="toolbar"><button class="btn btn--ghost btn--xs" id="r-seed">Carregar/atualizar regras do sistema (versão ' + esc(window.EOARules ? EOARules.VERSION : '') + ')</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Estado</th><th>Versão</th><th>Status</th><th>Aprovação</th><th>SHA-256</th><th></th></tr></thead><tbody>' + (sets.length ? sets.map(function (s) {
        return '<tr><td><strong>' + esc(s.state) + '</strong></td><td>' + esc(s.version) + '</td><td><span class="pill ' + (s.status === 'approved' ? 'pill--done' : s.status === 'retired' ? '' : 'pill--warn') + '">' + ({ approved: 'Aprovado', pending_approval: 'Aguardando revisor', retired: 'Retirado' }[s.status]) + '</span></td><td>' + (s.approved_by ? esc(s.approved_by) + '<br><small>' + esc(ctx.fmtDT(s.approved_at)) + '</small>' : '-') + '</td><td class="mono" style="font-size:.72rem">' + esc(s.content_sha256.slice(0, 16)) + '…</td>' +
          '<td class="portal-btn-row"><button class="btn btn--ghost btn--xs" data-view="' + s.id + '">Ver</button>' + (isRev && s.status !== 'approved' ? '<button class="btn btn--navy btn--xs" data-ok="' + s.id + '">Aprovar</button>' : '') + (isRev && s.status === 'approved' ? '<button class="btn btn--ghost btn--xs" data-ret="' + s.id + '">Retirar</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="portal-muted">Nenhum conjunto carregado. Clique em "Carregar regras do sistema".</td></tr>') + '</tbody></table></div><div class="portal-alert" id="r-msg" role="status"></div></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Revisores habilitados</h2><p class="portal-muted" style="font-size:.88rem">Só revisores habilitados aprovam regras, resolvem pendências de revisão e liberam minutas marcadas para revisão. ' + (anyRev ? 'Apenas um revisor pode alterar esta lista.' : 'Ainda não há revisor: o primeiro pode ser indicado por qualquer admin.') + '</p><ul class="rev-list">' +
      admins.map(function (a) { return '<li><span>' + esc(a.email) + '</span><label class="check"><input type="checkbox" data-rev="' + esc(a.email) + '"' + (a.legal_reviewer ? ' checked' : '') + (anyRev && !isRev ? ' disabled' : '') + '> Revisor habilitado</label></li>'; }).join('') + '</ul></section>';
    var m = body.querySelector('#r-msg');
    body.querySelector('#r-seed').onclick = async function () { try { var r = await fn(ctx, { action: 'rules_seed', oa_id: '' }); ctx.msg(m, r.inserted ? r.inserted + ' conjunto(s) carregado(s) para aprovação.' : 'Já está tudo carregado.', 'ok'); setTimeout(ctx.route, 600); } catch (e) { ctx.msg(m, errText(ctx, e), 'error'); } };
    body.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = async function () {
      var s = await ctx.q(ctx.sb.from('oa_rule_sets').select('*').eq('id', b.dataset.view).single()), c = s.content;
      ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(c.state_name + ' · ' + s.version) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><div class="rules-view"><p class="portal-muted">' + esc(c.act) + '</p>' +
        '<h3>Perguntas e caixas explicativas</h3>' + c.questions.map(function (q) { return '<div class="rv-q"><strong>' + esc(q.label.pt) + '</strong><p>' + esc(q.help.pt) + '</p>' + (q.note ? '<p class="portal-muted">' + esc(q.note.pt) + '</p>' : '') + '</div>'; }).join('') +
        '<h3>Cláusulas-modelo</h3>' + c.clauses.map(function (k) { return '<div class="rv-q"><strong>' + esc(k.title) + '</strong> <span class="mono portal-muted">' + esc(k.id) + (k.when ? ' · quando ' + esc(JSON.stringify(k.when)) : '') + '</span><p>' + esc(k.text) + '</p><ul class="oa-refs">' + k.refs.map(function (r) { return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.cite) + '</a></li>'; }).join('') + '</ul></div>'; }).join('') + '</div>');
    }; });
    var note = function (title, cb) { ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><form class="portal-form" id="rn"><div class="field"><label for="rn-t">Parecer / observação (fica na trilha)</label><textarea id="rn-t" rows="5" required></textarea></div><button class="btn btn--navy" type="submit">Confirmar</button></form>'); document.getElementById('rn').onsubmit = function (e) { e.preventDefault(); var v = document.getElementById('rn-t').value.trim(); if (!v) return; ctx.closeOverlay(); cb(v); }; };
    body.querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = function () { note('Aprovar regras', async function (v) { var r = await ctx.sb.rpc('approve_rule_set', { p_id: b.dataset.ok, p_note: v }); if (r.error) ctx.msg(m, errText(ctx, { message: r.error.message }), 'error'); else ctx.route(); }); }; });
    body.querySelectorAll('[data-ret]').forEach(function (b) { b.onclick = function () { note('Retirar regras', async function (v) { var r = await ctx.sb.rpc('retire_rule_set', { p_id: b.dataset.ret, p_note: v }); if (r.error) ctx.msg(m, errText(ctx, { message: r.error.message }), 'error'); else ctx.route(); }); }; });
    body.querySelectorAll('[data-rev]').forEach(function (c) { c.onchange = async function () { var r = await ctx.sb.rpc('set_legal_reviewer', { p_email: c.dataset.rev, p_on: c.checked }); if (r.error) { c.checked = !c.checked; alert(errText(ctx, { message: r.error.message })); } else ctx.route(); }; });
  }
  async function privacyTab(body, ctx) {
    var s = (await ctx.sb.from('compliance_settings').select('*').eq('id', 1).single()).data || {};
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Privacidade da trilha de auditoria</h2><p class="portal-muted" style="font-size:.88rem">Defina se o IP e o dispositivo (user agent) entram nos novos registros. Desligar não apaga o que já foi registrado (a trilha é imutável). A assinatura eletrônica sempre guarda o IP do signatário no certificado, porque faz parte da prova da assinatura.</p>' +
      '<label class="check"><input type="checkbox" id="pv-ip"' + (s.capture_ip !== false ? ' checked' : '') + '> Registrar endereço IP</label><label class="check"><input type="checkbox" id="pv-ua"' + (s.capture_user_agent !== false ? ' checked' : '') + '> Registrar dispositivo/navegador</label>' +
      '<p class="portal-muted" style="font-size:.82rem">Última alteração: ' + ctx.esc(s.updated_by || '-') + ' · ' + ctx.esc(s.updated_at ? ctx.fmtDT(s.updated_at) : '-') + '</p><div class="portal-alert" id="pv-msg" role="status"></div><button class="btn btn--navy btn--xs" id="pv-save">Salvar</button></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Proteção de dados no módulo</h2><ul class="clean-list"><li>O questionário não pede SSN, ITIN, passaporte nem dados bancários.</li><li>Os e-mails dos sócios servem só para o link de assinatura e não aparecem no documento.</li><li>Para a IA vão apenas os fatos impressos no acordo (nomes, porcentagens, aportes, endereço comercial); e-mails não são enviados.</li><li>Rascunhos e PDFs ficam no armazenamento privado; o cliente vê só a versão liberada para ele.</li><li>Colaboradores do cliente veem a timeline, mas não o Operating Agreement.</li></ul></section>';
    body.querySelector('#pv-save').onclick = async function () { var r = await ctx.sb.from('compliance_settings').update({ capture_ip: body.querySelector('#pv-ip').checked, capture_user_agent: body.querySelector('#pv-ua').checked }).eq('id', 1); ctx.msg(body.querySelector('#pv-msg'), r.error ? ctx.errText(r.error) : 'Salvo.', r.error ? 'error' : 'ok'); };
  }

  /* ================= timeline control (client detail → company card) ================= */
  async function timelineDrawer(ctx, co) {
    var esc = ctx.esc;
    var [rows, oa] = await Promise.all([ctx.q(ctx.sb.from('company_timeline').select('*').eq('company_id', co.id).order('at')), ctx.sb.from('operating_agreements').select('id, status, review_required').eq('company_id', co.id).neq('status', 'cancelled').maybeSingle()]);
    var o = oa.data;
    ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Timeline · ' + esc(co.legal_name) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="tl-f"><div class="field"><label for="tl-st">Etapa atual</label><select id="tl-st">' + U.STAGES.map(function (s) { return '<option value="' + s + '"' + (s === co.stage ? ' selected' : '') + '>' + esc(U.t('pt', 'st_' + s)) + '</option>'; }).join('') + '</select></div>' +
      '<p class="portal-muted" style="font-size:.85rem;margin:0">A mudança aparece na hora no portal do cliente. Ao marcar "Empresa aprovada", a timeline avança sozinha para "Operating Agreement · Pendente de geração" e o cliente vê o botão Generate Operating Agreement.</p>' +
      '<div class="portal-alert" id="tl-msg" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar etapa</button>' + (o ? '<a class="btn btn--ghost" href="#/compliance?tab=oa&id=' + o.id + '">Abrir Operating Agreement</a>' : '') + '</div></form>' +
      '<div style="margin-top:1rem">' + U.full('pt', co, o, rows, { showActor: true }) + '</div>');
    document.getElementById('tl-f').onsubmit = async function (e) {
      e.preventDefault();
      var st = document.getElementById('tl-st').value;
      if (st === co.stage) return ctx.closeOverlay();
      var r = await ctx.sb.from('companies').update({ stage: st }).eq('id', co.id);
      if (r.error) return ctx.msg(document.getElementById('tl-msg'), ctx.errText(r.error), 'error');
      ctx.closeOverlay(); ctx.route();
    };
  }

  /* ================= realtime for the console ================= */
  var chan = null, rt = null;
  function subscribe(ctx) {
    if (chan || !ctx.sb.channel) return;
    var go = function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var h = ERoute.get();
        if (!/^#\/(compliance\?tab=oa|clientes\?id=)/.test(h)) return;
        if (document.querySelector('#overlay:not([hidden])')) return;
        var a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
        ctx.route();
      }, 500);
    };
    chan = ctx.sb.channel('endeavor-admin-tl').on('postgres_changes', { event: '*', schema: 'public', table: 'operating_agreements' }, go)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'company_timeline' }, go).subscribe();
  }

  window.AdminOA = { compliance: compliance, timelineDrawer: timelineDrawer, subscribe: subscribe, stepper: function (co, oa) { return U.stepper('pt', co, oa); } };
})();
