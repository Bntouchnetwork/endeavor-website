/* Admin: AI Projects (proposals, payments, agents, tasks, releases, publications), Connectors catalog and Hub AI (usage, costs, limits). */
(function () {
  'use strict';
  var money = function (c) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format((c || 0) / 100); };
  var usd = function (n) { return 'US$ ' + Number(n || 0).toFixed(2); };
  function param(k) { var m = ERoute.get().match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; }
  function head(esc, t, lead, act) { return '<div class="console__head"><div><h1>' + esc(t) + '</h1>' + (lead ? '<p class="portal-muted">' + esc(lead) + '</p>' : '') + '</div>' + (act || '') + '</div>'; }
  function kpi(esc, l, v) { return '<div class="kpi"><div class="kpi__label">' + esc(l) + '</div><div class="kpi__value" style="font-size:1.35rem;padding-top:.35rem">' + esc(v) + '</div></div>'; }
  async function call(ctx, payload) {
    var s = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'HTTP ' + r.status); e.code = j.error; e.detail = j.detail; throw e; }
    return j;
  }
  var ERR = { github_not_configured: 'GitHub não configurado: defina GITHUB_TOKEN e GITHUB_OWNER nos Secrets do Supabase.', firebase_not_configured: 'Firebase não configurado: defina GCP_SA_KEY (e GCP_PARENT) nos Secrets do Supabase, ou informe um projeto Firebase existente.',
    ai_not_configured: 'ANTHROPIC_API_KEY não configurada.', not_paid: 'O pagamento ainda não foi confirmado pelo Stripe: nada é desenvolvido antes disso.', not_provisioned: 'Provisione o GitHub e o Firebase primeiro.', ai_limit_reached: 'Limite mensal de IA do projeto atingido. Aumente o limite em Infraestrutura.', invalid_price: 'Informe um valor maior que zero.', invalid_status: 'Ação não disponível neste status.' };
  var E = function (ctx, e) { return (ERR[e.code] || ctx.errText(e)) + (e.detail ? ' (' + e.detail + ')' : ''); };
  var ST = { scoping: 'Levantando requisitos', proposal_review: 'Proposta para revisar', proposal_sent: 'Proposta enviada', changes_requested: 'Ajustes pedidos', awaiting_payment: 'Aguardando pagamento', provisioning: 'Provisionando', in_progress: 'Em desenvolvimento', staging_review: 'Aguardando aprovação do cliente', live: 'No ar', paused: 'Pausado', cancelled: 'Cancelado' };
  var RS = { requested: 'Solicitada', quote_review: 'Para analisar', awaiting_payment: 'Aguardando pagamento', queued: 'Na fila', building: 'Agentes desenvolvendo', staging: 'No teste (cliente revisa)', changes_requested: 'Ajustes pedidos', approved: 'Aprovada', publishing: 'Publicando', published: 'Publicada', rolled_back: 'Revertida', failed: 'Falhou', cancelled: 'Cancelada' };
  var RK = { initial: 'Versão inicial', included_update: 'Atualização incluída', paid_update: 'Atualização paga', out_of_scope: 'Fora do escopo' };
  var pill = function (st, label) { return '<span class="pj-pill pj-pill--' + st + '">' + label + '</span>'; };

  /* ================= Projects ================= */
  async function projects(view, ctx) {
    var esc = ctx.esc, id = param('id');
    if (id) return detail(view, ctx, id);
    var st = param('st') || '';
    var rows = await ctx.q(ctx.sb.from('ai_projects').select('id, title, status, price_cents, weeks, created_at, updated_at, paid_at, clients(name), companies(legal_name)').order('updated_at', { ascending: false }));
    var shown = rows.filter(function (p) { return !st || p.status === st; });
    var c = function (f) { return rows.filter(f).length; };
    view.innerHTML = head(esc, 'AI Projects', 'Plataformas pedidas pelos clientes: o AI Project Manager levanta o escopo, você revisa a proposta, o cliente aprova e paga, os agentes desenvolvem no teste e o cliente aprova antes da produção.') +
      '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Propostas para revisar', c(function (p) { return p.status === 'proposal_review'; })) + kpi(esc, 'Aguardando pagamento', c(function (p) { return p.status === 'awaiting_payment'; })) + kpi(esc, 'Em desenvolvimento', c(function (p) { return ['provisioning', 'in_progress', 'staging_review'].indexOf(p.status) > -1; })) + kpi(esc, 'No ar', c(function (p) { return p.status === 'live'; })) + '</div>' +
      '<div class="toolbar"><label for="pj-st" class="sr-only">Status</label><select id="pj-st"><option value="">Todos os status</option>' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (k === st ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join('') + '</select><a class="btn btn--ghost btn--xs" href="#/conectores">Conectores</a><a class="btn btn--ghost btn--xs" href="#/hubai">Hub AI</a></div>' +
      (shown.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Projeto</th><th>Cliente</th><th>Status</th><th class="num">Valor</th><th>Prazo</th><th>Atualizado</th></tr></thead><tbody>' + shown.map(function (p) {
        return '<tr class="row-link" data-href="#/projetos?id=' + p.id + '"><td><a href="#/projetos?id=' + p.id + '"><strong>' + esc(p.title) + '</strong></a><span class="sub">' + esc(p.companies ? p.companies.legal_name : '') + '</span></td><td>' + esc(p.clients ? p.clients.name : '') + '</td><td>' + pill(p.status, ST[p.status]) + '</td><td class="num">' + (p.price_cents ? money(p.price_cents) : '—') + '</td><td>' + (p.weeks ? p.weeks + ' sem.' : '—') + '</td><td>' + esc(ctx.fmtDT(p.updated_at)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty-state portal-card"><strong>Nenhum projeto</strong><p>Os clientes pedem projetos no portal, em AI Projects.</p></div>');
    ctx.$('#pj-st').onchange = function () { ERoute.set('#/projetos' + (this.value ? '?st=' + this.value : ''), true); ctx.route(); };
    view.querySelectorAll('tr[data-href]').forEach(function (tr) { tr.onclick = function (e) { if (e.target.tagName !== 'A') ERoute.go(tr.dataset.href); }; });
  }

  async function detail(view, ctx, id) {
    var esc = ctx.esc, tab = param('tab') || 'resumo';
    var res = await Promise.all([ctx.q(ctx.sb.from('ai_projects').select('*, clients(name, primary_email), companies(legal_name)').eq('id', id).single()),
      ctx.q(ctx.sb.from('ai_project_releases').select('*').eq('project_id', id).order('number')),
      ctx.q(ctx.sb.from('ai_project_tasks').select('*').eq('project_id', id).order('position')),
      ctx.q(ctx.sb.from('ai_project_messages').select('*').eq('project_id', id).order('created_at')),
      ctx.q(ctx.sb.from('ai_project_files').select('*').eq('project_id', id).order('created_at', { ascending: false })),
      ctx.q(ctx.sb.from('ai_project_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(100)),
      ctx.q(ctx.sb.from('ai_usage').select('agent, cost_usd, input_tokens, output_tokens, created_at').eq('project_id', id)),
      ctx.q(ctx.sb.from('invoices').select('id, number, status, total_cents, created_at').eq('ai_project_id', id).order('created_at', { ascending: false }))]);
    var p = res[0], rels = res[1], tasks = res[2], msgs = res[3], files = res[4], evs = res[5], use = res[6], invs = res[7];
    var aiCost = use.reduce(function (s, u) { return s + Number(u.cost_usd || 0); }, 0);
    var tabs = [['resumo', 'Resumo e proposta'], ['conversa', 'Conversa com o AI PM'], ['versoes', 'Versões e publicações'], ['tarefas', 'Tarefas'], ['infra', 'Infraestrutura'], ['arquivos', 'Arquivos'], ['historico', 'Histórico']];
    view.innerHTML = head(esc, p.title, (p.clients ? p.clients.name : '') + (p.companies ? ' · ' + p.companies.legal_name : ''), '<div class="portal-btn-row"><a class="btn btn--ghost" href="#/projetos">Projetos</a>' + (p.status !== 'cancelled' ? '<button class="btn btn--ghost btn--xs" id="pj-pause">' + (p.status === 'paused' ? 'Retomar' : 'Pausar') + '</button><button class="btn btn--danger btn--xs" id="pj-cancel">Cancelar projeto</button>' : '') + '</div>') +
      '<p>' + pill(p.status, ST[p.status]) + (p.paid_at ? ' <span class="portal-muted">Pago em ' + esc(ctx.fmtDT(p.paid_at)) + '</span>' : '') + ' <span class="portal-muted">· IA usada: ' + usd(aiCost) + ' · limite mensal ' + money(p.ai_budget_cents) + '</span></p>' +
      '<nav class="subtabs">' + tabs.map(function (t) { return '<a href="#/projetos?id=' + id + '&tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="pd" ></div><div class="portal-alert" id="pd-m" role="status"></div>';
    var body = ctx.$('#pd'), M = ctx.$('#pd-m');
    var run = async function (btn, payload, okMsg) { btn.disabled = true; try { var r = await call(ctx, Object.assign({ project_id: id }, payload)); if (okMsg) ctx.msg(M, okMsg, 'ok'); setTimeout(ctx.route, okMsg ? 900 : 0); return r; } catch (e) { btn.disabled = false; ctx.msg(M, E(ctx, e), 'error'); } };
    if (ctx.$('#pj-pause')) ctx.$('#pj-pause').onclick = function () { run(this, { action: p.status === 'paused' ? 'resume' : 'pause' }); };
    if (ctx.$('#pj-cancel')) ctx.$('#pj-cancel').onclick = function () { if (confirm('Cancelar este projeto? Os agentes param e nada mais é publicado.')) run(this, { action: 'cancel' }); };

    if (tab === 'resumo') {
      var s = p.scope || {}, est = s.estimate_cents || 0;
      body.innerHTML = '<div class="dash"><section class="portal-card"><h2 class="portal-h2">Escopo do AI Project Manager</h2>' + (s.summary ? '<p>' + esc(s.summary) + '</p>' : '<p class="portal-muted">Ainda levantando requisitos.</p>') +
        (s.phases || []).map(function (ph) { return '<h3 class="pj-h3">' + esc(ph.name) + (ph.weeks ? ' · ' + ph.weeks + ' sem.' : '') + '</h3><ul>' + (ph.tasks || []).map(function (t) { return '<li>' + esc(t.title) + (t.hours ? ' <span class="portal-muted">(' + t.hours + ' h)</span>' : '') + '</li>'; }).join('') + '</ul>'; }).join('') +
        ((s.out_of_scope || []).length ? '<h3 class="pj-h3">Fora do escopo</h3><ul>' + s.out_of_scope.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        ((s.open_questions || []).length ? '<h3 class="pj-h3">Perguntas em aberto</h3><ul>' + s.open_questions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="portal-muted">Pedido do cliente: ' + esc(p.brief || '') + '</p>' + (p.connectors && p.connectors.length ? '<p class="portal-muted">Conectores: ' + esc(p.connectors.join(', ')) + '</p>' : '') + '</section>' +
        '<aside class="portal-card"><h2 class="portal-h2">Proposta</h2><p class="portal-muted" style="font-size:.88rem">Estimativa do AI PM: <strong>' + money(est) + '</strong> · ' + (s.hours || 0) + ' h · ' + (p.weeks || '?') + ' semanas. O cliente só vê o valor depois que você enviar.</p>' +
        '<form class="portal-form" id="pp"><div class="portal-grid2"><div class="field"><label for="pp-v">Valor (US$)</label><input id="pp-v" type="number" min="1" step="0.01" value="' + ((p.price_cents || est) / 100).toFixed(2) + '"></div><div class="field"><label for="pp-w">Prazo (semanas)</label><input id="pp-w" type="number" min="1" max="104" value="' + (p.weeks || 4) + '"></div></div>' +
        '<div class="portal-grid2"><div class="field"><label for="pp-u">Atualizações incluídas</label><input id="pp-u" type="number" min="0" max="50" value="' + p.updates_included + '"></div><div class="field"><label for="pp-up">Preço por atualização extra (US$)</label><input id="pp-up" type="number" min="0" step="0.01" value="' + (p.update_price_cents / 100).toFixed(2) + '"></div></div>' +
        '<div class="field"><label for="pp-b">Limite mensal de IA do projeto (US$)</label><input id="pp-b" type="number" min="0" step="1" value="' + (p.ai_budget_cents / 100).toFixed(0) + '"></div>' +
        '<div class="field"><label for="pp-n">Mensagem ao cliente (opcional)</label><textarea id="pp-n" rows="3" maxlength="4000">' + esc(p.proposal_note || '') + '</textarea></div>' +
        (['scoping', 'proposal_review', 'changes_requested', 'proposal_sent'].indexOf(p.status) > -1 ? '<button class="btn btn--navy" type="submit">' + (p.status === 'proposal_sent' ? 'Reenviar proposta' : 'Aprovar e enviar ao cliente') + '</button>' : '<p class="portal-muted">Proposta ' + (p.client_approved_at ? 'aprovada por ' + esc(p.client_approved_name) + ' em ' + esc(ctx.fmtDT(p.client_approved_at)) : 'fechada') + '.</p>') + '</form>' +
        '<h3 class="pj-h3">Faturas</h3>' + (invs.length ? '<ul>' + invs.map(function (i) { return '<li>' + esc(i.number || '') + ' · ' + money(i.total_cents) + ' · ' + esc(i.status) + '</li>'; }).join('') + '</ul>' : '<p class="portal-muted">Nenhuma.</p>') + '</aside></div>';
      ctx.$('#pp').onsubmit = function (e) {
        e.preventDefault(); if (!this.querySelector('button')) return;
        if (!confirm('Enviar a proposta ao cliente por e-mail?')) return;
        run(this.querySelector('button'), { action: 'send_proposal', price_cents: Math.round(+ctx.$('#pp-v').value * 100), weeks: +ctx.$('#pp-w').value, updates_included: +ctx.$('#pp-u').value, update_price_cents: Math.round(+ctx.$('#pp-up').value * 100), ai_budget_cents: Math.round(+ctx.$('#pp-b').value * 100), note: ctx.$('#pp-n').value.trim() }, 'Proposta enviada ao cliente.');
      };
      return;
    }
    if (tab === 'conversa') {
      body.innerHTML = '<section class="portal-card pj-chat"><div class="pj-msgs" style="max-height:60vh">' + msgs.map(function (m) { return '<div class="pj-msg pj-msg--' + m.role + '"><div>' + esc(m.content).replace(/\n/g, '<br>') + '</div><time>' + esc((m.author || m.role) + ' · ' + ctx.fmtDT(m.created_at)) + '</time></div>'; }).join('') + '</div>' +
        '<form id="an" class="pj-send"><label for="an-t" class="sr-only">Nota da equipe</label><textarea id="an-t" rows="2" placeholder="Nota da equipe Endeavor para o AI PM e o cliente (ex.: ajuste de escopo)"></textarea><button class="btn btn--navy" type="submit">Enviar nota</button></form></section>';
      ctx.$('#an').onsubmit = function (e) { e.preventDefault(); var t = ctx.$('#an-t').value.trim(); if (t) run(this.querySelector('button'), { action: 'message', text: t, as_admin: true }); };
      return;
    }
    if (tab === 'versoes') {
      body.innerHTML = '<section class="portal-card"><p class="portal-muted">Cada versão: agentes desenvolvem na branch staging → publicam no endereço de teste → o cliente aprova (nome, IP e data registrados) → promoção para main e publicação no domínio oficial, com tag para rollback. O pacote inclui ' + p.updates_included + ' atualizações; depois, ' + money(p.update_price_cents) + ' cada.</p>' +
        (rels.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Versão</th><th>Tipo</th><th>Status</th><th class="num">Valor</th><th>Ações</th></tr></thead><tbody>' + rels.map(function (r) {
          var a = [];
          if (r.status === 'quote_review') a.push('<button class="btn btn--navy btn--xs" data-q="' + r.id + '">Analisar e aprovar</button>');
          if (['queued', 'failed', 'changes_requested'].indexOf(r.status) > -1 && p.paid_at) a.push('<button class="btn btn--navy btn--xs" data-b="' + r.id + '">Iniciar desenvolvimento</button>');
          if (r.status === 'published' && r.tag) a.push('<button class="btn btn--ghost btn--xs" data-rb="' + r.id + '">Rollback para esta</button>');
          if (['requested', 'quote_review', 'awaiting_payment', 'queued', 'failed'].indexOf(r.status) > -1) a.push('<button class="btn btn--ghost btn--xs" data-c="' + r.id + '">Cancelar</button>');
          if (r.run_url) a.push('<a class="btn btn--ghost btn--xs" href="' + esc(r.run_url) + '" target="_blank" rel="noopener">Execução</a>');
          if (r.staging_url) a.push('<a class="btn btn--ghost btn--xs" href="' + esc(r.staging_url) + '" target="_blank" rel="noopener">Teste</a>');
          return '<tr><td>' + r.number + '</td><td><strong>' + esc(r.title) + '</strong>' + (r.request ? '<span class="sub">' + esc(r.request.slice(0, 220)) + '</span>' : '') + (r.feedback ? '<span class="sub">Ajustes: ' + esc(r.feedback.slice(0, 220)) + '</span>' : '') + (r.error ? '<span class="sub prop-why">' + esc(r.error.slice(0, 200)) + '</span>' : '') + (r.approved_name ? '<span class="sub">Aprovada por ' + esc(r.approved_name) + ' · ' + esc(ctx.fmtDT(r.approved_at)) + '</span>' : '') + '</td><td>' + RK[r.kind] + '</td><td>' + pill('r-' + r.status, RS[r.status]) + '</td><td class="num">' + (r.price_cents ? money(r.price_cents) : '—') + '</td><td><div class="portal-btn-row inv-acts">' + a.join('') + '</div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="portal-muted">A primeira versão é criada quando o cliente aprova a proposta.</p>') + '</section>';
      body.querySelectorAll('[data-b]').forEach(function (b) { b.onclick = function () { if (confirm('Disparar os agentes de desenvolvimento para esta versão?')) run(b, { action: 'build', release_id: b.dataset.b }, 'Desenvolvimento iniciado.'); }; });
      body.querySelectorAll('[data-rb]').forEach(function (b) { b.onclick = function () { if (confirm('Republicar esta versão no domínio oficial (rollback)?')) run(b, { action: 'rollback', release_id: b.dataset.rb }, 'Rollback iniciado.'); }; });
      body.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { if (confirm('Cancelar esta versão?')) run(b, { action: 'cancel_release', release_id: b.dataset.c }); }; });
      body.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () {
        var r = rels.find(function (x) { return x.id === b.dataset.q; });
        var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(r.title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><p>' + esc(r.request || '') + '</p>' +
          '<form class="portal-form" id="qf"><div class="field"><label for="qf-k">Classificação</label><select id="qf-k"><option value="included_update"' + (r.kind === 'included_update' ? ' selected' : '') + '>Atualização incluída no pacote (sem custo)</option><option value="paid_update"' + (r.kind === 'paid_update' ? ' selected' : '') + '>Atualização paga (dentro do escopo)</option><option value="out_of_scope">Fora do escopo (orçamento próprio)</option></select></div>' +
          '<div class="field"><label for="qf-p">Valor (US$)</label><input id="qf-p" type="number" min="0" step="0.01" value="' + (r.price_cents / 100).toFixed(2) + '"></div>' +
          '<div class="field"><label for="qf-t">Tarefas para os agentes (uma por linha)</label><textarea id="qf-t" rows="5">' + esc(r.title) + '</textarea></div><div class="portal-alert" id="qf-m" role="alert"></div>' +
          '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Confirmar</button><button class="btn btn--ghost close-x" type="button">Cancelar</button></div><p class="portal-muted" style="font-size:.85rem">Incluída: os agentes começam já. Paga ou fora do escopo: a fatura vai para o cliente e o desenvolvimento só começa após o pagamento.</p></form>', true);
        o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
        ctx.$('#qf', o).onsubmit = async function (e) {
          e.preventDefault(); var bt = this.querySelector('button'); bt.disabled = true;
          try { await call(ctx, { action: 'quote_release', project_id: id, release_id: r.id, kind: ctx.$('#qf-k', o).value, price_cents: Math.round(+ctx.$('#qf-p', o).value * 100), tasks: ctx.$('#qf-t', o).value.split('\n').map(function (x) { return { title: x.trim() }; }).filter(function (x) { return x.title; }) }); ctx.closeOverlay(); ctx.route(); }
          catch (x) { bt.disabled = false; ctx.msg(ctx.$('#qf-m', o), E(ctx, x), 'error'); }
        };
      }; });
      return;
    }
    if (tab === 'tarefas') {
      body.innerHTML = '<section class="portal-card">' + (tasks.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Fase</th><th>Tarefa</th><th>Horas</th><th>Status</th><th>Prazo</th></tr></thead><tbody>' + tasks.map(function (t) {
        return '<tr><td>' + esc(t.phase || '') + '</td><td><strong>' + esc(t.title) + '</strong>' + (t.detail ? '<span class="sub">' + esc(t.detail) + '</span>' : '') + '</td><td>' + (t.hours || '—') + '</td><td>' + pill('t-' + t.status, t.status) + '</td><td>' + (t.due_date || '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">As tarefas são criadas a partir das fases quando o cliente aprova a proposta.</p>') + '</section>';
      return;
    }
    if (tab === 'infra') {
      var pr = p.provision || {};
      var step = function (ok, t) { return '<li><span class="ik-dot' + (ok ? ' is-ok' : '') + '" aria-hidden="true"></span>' + t + '</li>'; };
      body.innerHTML = '<div class="dash"><section class="portal-card"><h2 class="portal-h2">Ambientes</h2><ul class="ik-steps">' + step(pr.gcp_project, 'Projeto Firebase do cliente' + (p.firebase_project_id ? ': ' + esc(p.firebase_project_id) : '')) + step(pr.sites, 'Sites de teste e produção') + step(pr.domains || !(p.staging_domain || p.prod_domain), 'Domínios personalizados') + step(pr.repo, 'Repositório GitHub' + (p.repo_full_name ? ': ' + esc(p.repo_full_name) : '')) + step(pr.files, 'Workflows dos agentes') + step(pr.staging_branch, 'Branches main e staging') + step(pr.vars, 'Variáveis do repositório') + '</ul>' +
        (pr.firebase ? '<p class="portal-muted">' + esc(pr.firebase) + '</p>' : '') + (pr.dns && pr.dns.length ? '<h3 class="pj-h3">DNS a configurar</h3><pre class="mono" style="white-space:pre-wrap;font-size:.8rem">' + esc(JSON.stringify(pr.dns, null, 2)) + '</pre>' : '') +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="button" id="pv"' + (p.paid_at ? '' : ' disabled title="Só depois do pagamento"') + '>' + (pr.done ? 'Verificar de novo' : 'Provisionar GitHub e Firebase') + '</button>' + (p.repo_full_name ? '<a class="btn btn--ghost" href="https://github.com/' + esc(p.repo_full_name) + '" target="_blank" rel="noopener">Abrir no GitHub</a>' : '') + '</div></section>' +
        '<aside class="portal-card"><h2 class="portal-h2">Configuração</h2><form class="portal-form" id="inf"><div class="field"><label for="inf-sd">Domínio de teste</label><input id="inf-sd" placeholder="test.cliente.com" value="' + esc(p.staging_domain || '') + '"></div><div class="field"><label for="inf-pd">Domínio oficial</label><input id="inf-pd" placeholder="cliente.com" value="' + esc(p.prod_domain || '') + '"></div>' +
        '<div class="field"><label for="inf-fp">Projeto Firebase existente (opcional)</label><input id="inf-fp" value="' + esc(p.firebase_project_id || '') + '"></div><div class="field"><label for="inf-b">Limite mensal de IA (US$)</label><input id="inf-b" type="number" min="0" value="' + (p.ai_budget_cents / 100).toFixed(0) + '"></div><button class="btn btn--navy" type="submit">Salvar</button></form>' +
        '<dl class="kv"><dt>Teste</dt><dd>' + esc(p.staging_url || '—') + '</dd><dt>Produção</dt><dd>' + esc(p.prod_url || '—') + '</dd></dl></aside></div>';
      ctx.$('#pv').onclick = async function () {
        var b = this; b.disabled = true; ctx.msg(M, 'Provisionando…', 'info');
        try { for (var i = 0; i < 8; i++) { var r = await call(ctx, { action: 'provision', project_id: id }); if (r.done || r.pending === 'firebase_not_configured') break; await new Promise(function (ok) { setTimeout(ok, 6000); }); } ctx.route(); }
        catch (e) { b.disabled = false; ctx.msg(M, E(ctx, e), 'error'); }
      };
      ctx.$('#inf').onsubmit = function (e) { e.preventDefault(); run(this.querySelector('button'), { action: 'set_infra', staging_domain: ctx.$('#inf-sd').value, prod_domain: ctx.$('#inf-pd').value, firebase_project_id: ctx.$('#inf-fp').value || undefined, ai_budget_cents: Math.round(+ctx.$('#inf-b').value * 100) }, 'Salvo.'); };
      return;
    }
    if (tab === 'arquivos') {
      body.innerHTML = '<section class="portal-card">' + (files.length ? '<ul class="doclist">' + files.map(function (f) { return '<li><span class="ficon" aria-hidden="true">📄</span><div><div class="dname">' + esc(f.title) + '</div><div class="dmeta">' + esc(f.kind) + ' · ' + esc(ctx.fmtDT(f.created_at)) + '</div></div><button class="btn btn--ghost btn--xs" data-v="' + f.id + '">Ver</button></li>'; }).join('') + '</ul>' : '<p class="portal-muted">Nenhum arquivo.</p>') + '</section>';
      body.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = async function () { var r = await call(ctx, { action: 'file_view', project_id: id, file_id: b.dataset.v }); if (r.url) window.open(r.url, '_blank', 'noopener'); }; });
      return;
    }
    body.innerHTML = '<section class="portal-card"><ul class="pj-events">' + evs.map(function (e) { return '<li><time>' + esc(ctx.fmtDT(e.created_at)) + '</time><strong>' + esc(e.title) + '</strong>' + (e.detail ? '<span>' + esc(e.detail) + '</span>' : '') + (e.actor ? '<span class="portal-muted">' + esc(e.actor) + '</span>' : '') + '</li>'; }).join('') + '</ul></section>';
  }

  /* ================= Connectors ================= */
  async function connectors(view, ctx) {
    var esc = ctx.esc, co = param('co');
    var res = await Promise.all([ctx.q(ctx.sb.from('connectors').select('*').order('position').order('name')), ctx.q(ctx.sb.from('companies').select('id, legal_name, books_service, clients(name)').neq('status', 'dissolved').order('legal_name'))]);
    var cat = res[0], cos = res[1];
    var CATS = { email: 'E-mail', storage: 'Arquivos', messaging: 'Mensagens', marketing: 'Marketing', payments: 'Pagamentos', productivity: 'Produtividade', data: 'Dados', other: 'Outro' };
    var AUTH = { oauth: 'OAuth (consentimento da conta)', api_key: 'Chave de API / token', none: 'Sem credencial' };
    view.innerHTML = head(esc, 'Conectores', 'Catálogo de integrações técnicas que aparecem no formulário New Project. As credenciais de cada empresa ficam no cofre (Vault), nunca em tabelas ou no código. Endeavor Bookkeeping não é um conector: é um serviço contratado à parte.', '<button class="btn btn--navy" id="cn-new">Novo conector</button>') +
      '<section class="portal-card"><h2 class="portal-h2">Catálogo</h2><div class="table-wrap"><table class="data"><thead><tr><th>Conector</th><th>Categoria</th><th>Autorização</th><th>Disponível para</th><th>Status</th><th></th></tr></thead><tbody>' + cat.map(function (c) {
        return '<tr><td><strong>' + esc(c.name) + '</strong> <code>' + esc(c.key) + '</code><span class="sub">' + esc(c.description || '') + '</span></td><td>' + CATS[c.category] + '</td><td>' + AUTH[c.auth_type] + '</td><td>' + (c.available_to === 'all' ? 'Todas as empresas' : 'Empresas selecionadas') + '</td><td>' + (c.active ? 'Ativo' : 'Desativado') + '</td><td><div class="portal-btn-row"><button class="btn btn--ghost btn--xs" data-e="' + c.id + '">Editar</button><button class="btn btn--ghost btn--xs" data-t="' + c.id + '">' + (c.active ? 'Desativar' : 'Ativar') + '</button></div></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Por empresa</h2><div class="toolbar"><label for="cn-co">Empresa</label><select id="cn-co"><option value="">Selecione</option>' + cos.map(function (c) { return '<option value="' + c.id + '"' + (c.id === co ? ' selected' : '') + '>' + esc(c.legal_name) + (c.clients ? ' · ' + esc(c.clients.name) : '') + '</option>'; }).join('') + '</select></div><div id="cn-box"></div></section><div class="portal-alert" id="cn-m" role="status"></div>';
    var edit = function (c) {
      c = c || { active: true, available_to: 'all', auth_type: 'oauth', category: 'other', position: cat.length + 1 };
      var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (c.id ? 'Editar conector' : 'Novo conector') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><form class="portal-form" id="cf">' +
        '<div class="portal-grid2"><div class="field"><label for="cf-n">Nome</label><input id="cf-n" maxlength="80" value="' + esc(c.name || '') + '" required></div><div class="field"><label for="cf-k">Chave técnica</label><input id="cf-k" maxlength="40" pattern="[a-z0-9_]{2,40}" value="' + esc(c.key || '') + '"' + (c.id ? ' readonly' : '') + ' placeholder="ex.: slack"></div></div>' +
        '<div class="field"><label for="cf-d">Descrição (o cliente vê)</label><textarea id="cf-d" rows="2" maxlength="600">' + esc(c.description || '') + '</textarea></div>' +
        '<div class="portal-grid2"><div class="field"><label for="cf-c">Categoria</label><select id="cf-c">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (k === c.category ? ' selected' : '') + '>' + CATS[k] + '</option>'; }).join('') + '</select></div><div class="field"><label for="cf-a">Autorização</label><select id="cf-a">' + Object.keys(AUTH).map(function (k) { return '<option value="' + k + '"' + (k === c.auth_type ? ' selected' : '') + '>' + AUTH[k] + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="portal-grid2"><div class="field"><label for="cf-v">Disponível para</label><select id="cf-v"><option value="all"' + (c.available_to === 'all' ? ' selected' : '') + '>Todas as empresas</option><option value="selected"' + (c.available_to === 'selected' ? ' selected' : '') + '>Só empresas que eu liberar</option></select></div><div class="field"><label for="cf-p">Ordem</label><input id="cf-p" type="number" value="' + (c.position || 0) + '"></div></div>' +
        '<div class="field"><label for="cf-s">Como configurar (nota interna)</label><textarea id="cf-s" rows="2" maxlength="1000">' + esc(c.setup_note || '') + '</textarea></div><div class="portal-alert" id="cf-m" role="alert"></div>' +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button><button class="btn btn--ghost close-x" type="button">Cancelar</button></div></form>', true);
      o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
      ctx.$('#cf', o).onsubmit = async function (e) {
        e.preventDefault(); var k = ctx.$('#cf-k', o).value.trim();
        if (/bookkeeping|books/i.test(k + ' ' + ctx.$('#cf-n', o).value)) return ctx.msg(ctx.$('#cf-m', o), 'Bookkeeping é um serviço da Endeavor, não um conector de projetos.', 'error');
        var row = { name: ctx.$('#cf-n', o).value.trim(), description: ctx.$('#cf-d', o).value.trim() || null, category: ctx.$('#cf-c', o).value, auth_type: ctx.$('#cf-a', o).value, available_to: ctx.$('#cf-v', o).value, position: +ctx.$('#cf-p', o).value || 0, setup_note: ctx.$('#cf-s', o).value.trim() || null };
        if (!c.id) { row.key = k; row.active = true; }
        var r = c.id ? await ctx.sb.from('connectors').update(row).eq('id', c.id) : await ctx.sb.from('connectors').insert(row);
        if (r.error) return ctx.msg(ctx.$('#cf-m', o), ctx.errText(r.error), 'error'); ctx.closeOverlay(); ctx.route();
      };
    };
    ctx.$('#cn-new').onclick = function () { edit(null); };
    view.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { edit(cat.find(function (c) { return c.id === b.dataset.e; })); }; });
    view.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = async function () { var c = cat.find(function (x) { return x.id === b.dataset.t; }); await ctx.sb.from('connectors').update({ active: !c.active }).eq('id', c.id); ctx.route(); }; });
    ctx.$('#cn-co').onchange = function () { ERoute.set('#/conectores' + (this.value ? '?co=' + this.value : ''), true); ctx.route(); };
    if (!co) return;
    var links = await ctx.q(ctx.sb.from('company_connectors').select('*').eq('company_id', co));
    var box = ctx.$('#cn-box');
    box.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th>Conector</th><th>Liberado</th><th>Credencial</th><th></th></tr></thead><tbody>' + cat.filter(function (c) { return c.active; }).map(function (c) {
      var l = links.find(function (x) { return x.connector_id === c.id; }) || {};
      var on = c.available_to === 'all' || l.enabled;
      return '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + (c.available_to === 'all' ? 'Todas' : '<label class="check-row"><input type="checkbox" data-en="' + c.id + '"' + (l.enabled ? ' checked' : '') + '> Liberar</label>') + '</td><td>' + (l.status === 'connected' ? 'Conectado' + (l.account_label ? ' · ' + esc(l.account_label) : '') : 'Não conectado') + '</td><td>' + (on && c.auth_type !== 'none' ? '<button class="btn btn--ghost btn--xs" data-cr="' + c.id + '">' + (l.status === 'connected' ? 'Trocar' : 'Configurar') + '</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="portal-muted" style="font-size:.85rem">Para OAuth (Gmail, Drive), o token de atualização obtido no consentimento da conta da empresa é guardado aqui. Para chaves de API, cole a chave. Ninguém consegue ler a credencial de volta pela tela.</p>';
    box.querySelectorAll('[data-en]').forEach(function (i) { i.onchange = async function () { var r = await ctx.sb.from('company_connectors').upsert({ company_id: co, connector_id: i.dataset.en, enabled: i.checked }, { onConflict: 'company_id,connector_id' }); if (r.error) ctx.msg(ctx.$('#cn-m'), ctx.errText(r.error), 'error'); }; });
    box.querySelectorAll('[data-cr]').forEach(function (b) { b.onclick = function () {
      var c = cat.find(function (x) { return x.id === b.dataset.cr; });
      var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(c.name) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' + (c.setup_note ? '<p class="portal-muted">' + esc(c.setup_note) + '</p>' : '') +
        '<form class="portal-form" id="cr"><div class="field"><label for="cr-l">Conta (ex.: e-mail ou número; não é segredo)</label><input id="cr-l" maxlength="200"></div><div class="field"><label for="cr-s">Credencial (vai para o cofre)</label><textarea id="cr-s" rows="3" autocomplete="off" spellcheck="false"></textarea></div><div class="portal-alert" id="cr-m" role="alert"></div>' +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar no cofre</button><button class="btn btn--ghost" type="button" id="cr-x">Remover credencial</button></div></form>', true);
      o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
      var save = async function (secret) { var r = await ctx.sb.rpc('connector_set_secret', { p_company: co, p_connector: c.id, p_secret: secret, p_label: ctx.$('#cr-l', o).value.trim() || null }); if (r.error) return ctx.msg(ctx.$('#cr-m', o), ctx.errText(r.error), 'error'); ctx.closeOverlay(); ctx.route(); };
      ctx.$('#cr', o).onsubmit = function (e) { e.preventDefault(); var s = ctx.$('#cr-s', o).value; if (s.trim().length < 8) return ctx.msg(ctx.$('#cr-m', o), 'Cole a credencial.', 'error'); save(s); };
      ctx.$('#cr-x', o).onclick = function () { if (confirm('Remover a credencial desta empresa?')) save(null); };
    }; });
  }

  /* ================= Hub AI ================= */
  async function hub(view, ctx) {
    var esc = ctx.esc, m = param('mes') || new Date().toISOString().slice(0, 7);
    var from = m + '-01', d = new Date(from + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); var to = d.toISOString().slice(0, 10);
    var res = await Promise.all([ctx.q(ctx.sb.from('ai_usage').select('*, companies(legal_name), ai_projects(title)').gte('created_at', from).lt('created_at', to).order('created_at', { ascending: false }).limit(5000)), ctx.q(ctx.sb.from('ai_limits').select('*').eq('id', 1).single())]);
    var rows = res[0], lim = res[1];
    var total = rows.reduce(function (s, r) { return s + Number(r.cost_usd || 0); }, 0);
    var group = function (key, label) { var g = {}; rows.forEach(function (r) { var k = key(r) || '—'; g[k] = g[k] || { n: 0, c: 0, i: 0, o: 0, label: label(r) || '—' }; g[k].n++; g[k].c += Number(r.cost_usd || 0); g[k].i += r.input_tokens; g[k].o += r.output_tokens; }); return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.c - a.c; }); };
    var table = function (title, list) { return '<section class="portal-card"><h2 class="portal-h2">' + title + '</h2>' + (list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th></th><th class="num">Chamadas</th><th class="num">Tokens (entrada / saída)</th><th class="num">Custo</th></tr></thead><tbody>' + list.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td class="num">' + x.n + '</td><td class="num">' + x.i.toLocaleString('pt-BR') + ' / ' + x.o.toLocaleString('pt-BR') + '</td><td class="num">' + usd(x.c) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Sem uso no período.</p>') + '</section>'; };
    var pct = lim.monthly_cap_usd ? Math.round(total / lim.monthly_cap_usd * 100) : 0;
    var months = []; for (var i = 0; i < 6; i++) { var x = new Date(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() - i); months.push(x.toISOString().slice(0, 7)); }
    view.innerHTML = head(esc, 'Hub AI', 'Todos os agentes da Endeavor num só lugar: chat do site, CRM, Instagram, Marketing, Operating Agreement, Bookkeeping, AI Project Manager e agentes de desenvolvimento. Consumo, custo e limites por agente, empresa e projeto.') +
      '<div class="toolbar"><label for="hb-m">Mês</label><select id="hb-m">' + months.map(function (x) { return '<option' + (x === m ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Custo no mês', usd(total)) + kpi(esc, 'Limite mensal', usd(lim.monthly_cap_usd) + ' · ' + pct + '%') + kpi(esc, 'Chamadas', rows.length) + kpi(esc, 'Faturável a clientes (+' + lim.markup_pct + '%)', usd(rows.filter(function (r) { return r.billable || r.project_id; }).reduce(function (s, r) { return s + Number(r.cost_usd || 0); }, 0) * (1 + lim.markup_pct / 100))) + '</div>' +
      (pct >= lim.alert_pct ? '<div class="portal-alert portal-alert--error" style="display:block">O consumo passou de ' + lim.alert_pct + '% do limite mensal.</div>' : '') +
      table('Por agente', group(function (r) { return r.agent; }, function (r) { return r.agent; })) +
      table('Por empresa', group(function (r) { return r.company_id; }, function (r) { return r.companies ? r.companies.legal_name : 'Endeavor (interno)'; })) +
      table('Por projeto', group(function (r) { return r.project_id; }, function (r) { return r.ai_projects ? r.ai_projects.title : 'Fora de projetos'; })) +
      '<section class="portal-card"><h2 class="portal-h2">Limites e preços</h2><form class="portal-form" id="lm"><div class="portal-grid2"><div class="field"><label for="lm-c">Limite mensal total (US$)</label><input id="lm-c" type="number" min="0" step="1" value="' + lim.monthly_cap_usd + '"></div><div class="field"><label for="lm-a">Alerta em (% do limite)</label><input id="lm-a" type="number" min="10" max="100" value="' + lim.alert_pct + '"></div></div>' +
      '<div class="portal-grid2"><div class="field"><label for="lm-k">Margem sobre o custo de IA faturado (%)</label><input id="lm-k" type="number" min="0" max="500" value="' + lim.markup_pct + '"></div><div class="field"><label for="lm-h">Valor-hora da estimativa do AI PM (US$)</label><input id="lm-h" type="number" min="1" step="1" value="' + lim.project_hour_usd + '"></div></div>' +
      '<div class="portal-grid2"><div class="field"><label for="lm-mn">Projeto mínimo (US$)</label><input id="lm-mn" type="number" min="0" step="1" value="' + lim.project_min_usd + '"></div><div class="field"><label for="lm-u">Preço padrão por atualização extra (US$)</label><input id="lm-u" type="number" min="0" step="1" value="' + lim.update_price_usd + '"></div></div>' +
      '<button class="btn btn--navy" type="submit">Salvar</button><div class="portal-alert" id="lm-m" role="status"></div></form></section>';
    ctx.$('#hb-m').onchange = function () { ERoute.set('#/hubai?mes=' + this.value, true); ctx.route(); };
    ctx.$('#lm').onsubmit = async function (e) {
      e.preventDefault();
      var r = await ctx.sb.from('ai_limits').update({ monthly_cap_usd: +ctx.$('#lm-c').value, alert_pct: +ctx.$('#lm-a').value, markup_pct: +ctx.$('#lm-k').value, project_hour_usd: +ctx.$('#lm-h').value, project_min_usd: +ctx.$('#lm-mn').value, update_price_usd: +ctx.$('#lm-u').value, updated_at: new Date().toISOString() }).eq('id', 1);
      ctx.msg(ctx.$('#lm-m'), r.error ? ctx.errText(r.error) : 'Salvo.', r.error ? 'error' : 'ok');
    };
  }

  window.AdminProjects = { projects: projects, connectors: connectors, hub: hub };
})();
