/* Admin console: referral partners (pipeline, documents, timeline), Stripe invoices with partner split, and Endeavor's Stripe connection. */
(function () {
  'use strict';
  var TYPE = { referral: 'Indicação', accountant: 'Contador', bookkeeping: 'Bookkeeping', property_management: 'Property management', attorney: 'Advogado', realtor: 'Corretor de imóveis', other: 'Outro' };
  var PSTATUS = { invited: 'Convidado', active: 'Ativo', suspended: 'Suspenso' };
  var STAGES = ['submitted', 'contacted', 'proposal', 'onboarding', 'in_process', 'completed', 'lost'];
  var ST = { submitted: 'Recebida', contacted: 'Em contato', proposal: 'Proposta', onboarding: 'Cadastro', in_process: 'Em processamento', completed: 'Concluída', lost: 'Encerrada' };
  var DI = { pending: 'Pendente', received: 'Recebido', approved: 'Aprovado' };
  var IS = { draft: 'Rascunho', open: 'Em aberto', paid: 'Paga', void: 'Anulada', uncollectible: 'Não cobrável' };
  var TS = { none: '—', scheduled: 'Automático no pagamento', pending: 'Pendente', paid: 'Repassado', failed: 'Falhou', reversed: 'Estornado' };
  var ERR = { stripe_not_configured: 'A conta Stripe da Endeavor ainda não foi conectada (veja Pagamentos → Conta Stripe).', stripe_error: 'O Stripe recusou a operação', invalid_items: 'Revise os itens: descrição e valor são obrigatórios.',
    invalid_share: 'Percentual ou valor do parceiro inválido.', invoice_not_paid: 'A fatura ainda não foi paga.', nothing_to_transfer: 'Não há repasse pendente nesta fatura.', partner_not_ready: 'O parceiro ainda não concluiu o cadastro no Stripe.', bad_return_url: 'Endereço de retorno não permitido.' };
  var DOC_TEMPLATES = ['Passaporte do(s) sócio(s)', 'Comprovante de endereço', 'Nome e atividade da empresa', 'Formulário de cadastro (KYC)', 'Contrato de serviços assinado'];

  var money = function (c, cur) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((c || 0) / 100); };
  var fmtD = function (d) { if (!d) return ''; var x = new Date(d.length === 10 ? d + 'T12:00:00' : d); return x.toLocaleDateString('pt-BR'); };
  var pill = function (cls, s, label) { return '<span class="' + cls + ' ' + cls + '--' + s + '">' + label + '</span>'; };
  function stripeOf(p) {
    if (!p.stripe_account_id) return pill('stripe-st', 'none', 'Stripe não conectado');
    if (p.stripe_transfers_active) return pill('stripe-st', 'ok', 'Stripe pronto');
    if (p.stripe_details_submitted) return pill('stripe-st', 'review', 'Stripe em análise');
    return pill('stripe-st', 'incomplete', 'Cadastro Stripe incompleto');
  }
  async function call(ctx, payload) {
    var sess = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'HTTP ' + r.status); e.detail = j.detail; throw e; }
    return j;
  }
  var errMsg = function (ctx, e) { return (ERR[e.message] || ctx.errText(e)) + (e.detail ? ': ' + e.detail : ''); };
  function param(k) { var m = ERoute.get().match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; }
  function head(esc, title, lead, actions) { return '<div class="console__head"><div><h1>' + esc(title) + '</h1>' + (lead ? '<p class="portal-muted">' + esc(lead) + '</p>' : '') + '</div>' + (actions || '') + '</div>'; }
  function kpi(esc, l, v) { return '<div class="kpi"><div class="kpi__label">' + esc(l) + '</div><div class="kpi__value" style="font-size:1.35rem;padding-top:.35rem">' + esc(v) + '</div></div>'; }

  async function sendInvite(ctx, p) {
    var link = ctx.siteUrl('partner.html') + '?lang=' + (p.language || 'pt');
    try {
      var r = await fetch(ctx.CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'Convite ao Programa de Parceiros: ' + p.name, _template: 'table', _captcha: 'false', name: p.name, email: p.email, empresa: p.company || '', link: link,
          _autoresponse: window.EndeavorInvite.text(p.language || 'pt', { name: p.name, email: p.email, link: link, referral: true }) }) });
      var j = await r.json().catch(function () { return {}; });
      return r.ok && String(j.success) !== 'false';
    } catch (e) { return false; }
  }

  /* ================= Parceiros ================= */
  async function partnersList(view, ctx) {
    var esc = ctx.esc, sb = ctx.sb;
    var res = await Promise.all([ctx.q(sb.from('partners').select('*').order('name')), ctx.q(sb.from('referrals').select('partner_id, status')), ctx.q(sb.from('invoices').select('partner_id, partner_amount_cents, transfer_status, status').not('partner_id', 'is', null))]);
    var parts = res[0], refs = res[1], invs = res[2];
    var total = function (pid, f) { return invs.filter(function (i) { return i.partner_id === pid && f(i); }).reduce(function (s, i) { return s + i.partner_amount_cents; }, 0); };
    var pendingAll = invs.filter(function (i) { return i.status === 'paid' && i.transfer_status === 'pending'; }).reduce(function (s, i) { return s + i.partner_amount_cents; }, 0);
    view.innerHTML = head(esc, 'Parceiros', 'Programa de indicações: convide parceiros, acompanhe as indicações e os repasses de comissão via Stripe Connect.', '<button class="btn btn--navy" type="button" id="pt-new">Novo parceiro</button>') +
      '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Parceiros ativos', parts.filter(function (p) { return p.status === 'active'; }).length) + kpi(esc, 'Indicações', refs.length) +
      kpi(esc, 'Viraram clientes', refs.filter(function (r) { return ['onboarding', 'in_process', 'completed'].indexOf(r.status) > -1; }).length) + kpi(esc, 'Repasses pendentes', money(pendingAll)) + '</div>' +
      (parts.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Parceiro</th><th>Tipo</th><th>Status</th><th class="num">Comissão</th><th>Stripe</th><th class="num">Indicações</th><th class="num">Repassado</th><th class="num">A repassar</th></tr></thead><tbody>' +
        parts.map(function (p) {
          var n = refs.filter(function (r) { return r.partner_id === p.id; }).length;
          return '<tr data-id="' + p.id + '" tabindex="0"><td><strong>' + esc(p.name) + '</strong><span class="sub">' + esc([p.company, p.email].filter(Boolean).join(' · ')) + '</span></td><td>' + esc(TYPE[p.partner_type]) + '</td>' +
            '<td><span class="badge badge--' + (p.status === 'active' ? 'client' : p.status === 'invited' ? 'new' : 'lost') + '">' + PSTATUS[p.status] + '</span></td><td class="num">' + esc(String(+p.default_share_pct)) + '%</td><td>' + stripeOf(p) + '</td>' +
            '<td class="num">' + n + '</td><td class="num">' + esc(money(total(p.id, function (i) { return i.transfer_status === 'paid'; }))) + '</td><td class="num">' + esc(money(total(p.id, function (i) { return ['scheduled', 'pending', 'failed'].indexOf(i.transfer_status) > -1 && i.status !== 'void'; }))) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state portal-card"><strong>Nenhum parceiro ainda</strong><p>Convide contadores, corretores, advogados e outros parceiros que indicam clientes.</p></div>');
    view.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var go = function () { ERoute.go('#/parceiros?id=' + tr.dataset.id); };
      tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    });
    ctx.$('#pt-new').onclick = function () { partnerForm(ctx, null); };
    if (param('novo')) partnerForm(ctx, null);
  }

  function partnerForm(ctx, p) {
    var esc = ctx.esc, edit = !!p; p = p || { language: 'pt', partner_type: 'referral', default_share_pct: 10 };
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (edit ? 'Editar parceiro' : 'Novo parceiro') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="pf" novalidate><div class="field"><label for="pf-name">Nome</label><input id="pf-name" required maxlength="200" value="' + esc(p.name || '') + '"></div>' +
      '<div class="field"><label for="pf-email">E-mail (login do parceiro)</label><input id="pf-email" type="email" required value="' + esc(p.email || '') + '"' + (edit && p.user_id ? ' readonly' : '') + '></div>' +
      '<div class="portal-grid2"><div class="field"><label for="pf-company">Empresa</label><input id="pf-company" maxlength="200" value="' + esc(p.company || '') + '"></div><div class="field"><label for="pf-phone">Telefone</label><input id="pf-phone" maxlength="50" value="' + esc(p.phone || '') + '"></div>' +
      '<div class="field"><label for="pf-type">Tipo</label><select id="pf-type">' + Object.keys(TYPE).map(function (k) { return '<option value="' + k + '"' + (p.partner_type === k ? ' selected' : '') + '>' + TYPE[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="pf-pct">Comissão padrão (%)</label><input id="pf-pct" type="number" min="0" max="100" step="0.5" value="' + esc(String(+p.default_share_pct)) + '"></div>' +
      '<div class="field"><label for="pf-lang">Idioma</label><select id="pf-lang"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div>' +
      (edit ? '<div class="field"><label for="pf-status">Status</label><select id="pf-status">' + Object.keys(PSTATUS).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? ' selected' : '') + '>' + PSTATUS[k] + '</option>'; }).join('') + '</select></div>' : '') + '</div>' +
      '<div class="field"><label for="pf-notes">Notas internas (o parceiro não vê)</label><textarea id="pf-notes" rows="3" maxlength="5000">' + esc(p.notes || '') + '</textarea></div>' +
      (edit ? '' : '<p class="portal-muted" style="font-size:.88rem">O parceiro recebe por e-mail o passo a passo para criar a senha e ativar o código do Google Authenticator.</p>') +
      '<div class="portal-alert" id="pf-msg" role="alert"></div><button class="btn btn--navy" type="submit">' + (edit ? 'Salvar' : 'Criar e enviar convite') + '</button></form>');
    ctx.$('#pf-lang', o).value = p.language || 'pt';
    ctx.$('#pf', o).onsubmit = async function (e) {
      e.preventDefault();
      var v = function (id) { return ctx.$('#' + id, o).value.trim(); };
      var row = { name: v('pf-name'), email: v('pf-email').toLowerCase(), company: v('pf-company') || null, phone: v('pf-phone') || null, partner_type: v('pf-type'), default_share_pct: Number(v('pf-pct')), language: v('pf-lang'), notes: v('pf-notes') || null };
      if (edit) row.status = v('pf-status');
      if (row.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) return ctx.msg(ctx.$('#pf-msg', o), 'Informe nome e e-mail válidos.', 'error');
      if (!(row.default_share_pct >= 0 && row.default_share_pct <= 100)) return ctx.msg(ctx.$('#pf-msg', o), 'Comissão entre 0 e 100%.', 'error');
      var r = edit ? await ctx.sb.from('partners').update(row).eq('id', p.id) : await ctx.sb.from('partners').insert(row).select('id').single();
      if (r.error) return ctx.msg(ctx.$('#pf-msg', o), /duplicate|unique/i.test(r.error.message) ? 'Já existe um parceiro com este e-mail.' : ctx.errText(r.error), 'error');
      if (!edit) { var ok = await sendInvite(ctx, row); ctx.closeOverlay(); ERoute.go('#/parceiros?id=' + r.data.id + (ok ? '' : '&invite=erro')); return; }
      ctx.closeOverlay(); ctx.route();
    };
  }

  async function partnerDetail(view, ctx, id) {
    var esc = ctx.esc, sb = ctx.sb;
    var p = await ctx.q(sb.from('partners').select('*').eq('id', id).single());
    var tab = param('tab') || 'indicacoes';
    var tabs = [['indicacoes', 'Indicações'], ['comissoes', 'Comissões'], ['stripe', 'Stripe'], ['dados', 'Dados']];
    view.innerHTML = '<p><a href="#/parceiros">← Parceiros</a></p>' + head(esc, p.name, [TYPE[p.partner_type], p.company, p.email].filter(Boolean).join(' · '),
      '<div class="portal-btn-row">' + (p.status === 'invited' ? '<button class="btn btn--ghost" type="button" id="pd-resend">Reenviar convite</button>' : '') + '<button class="btn btn--ghost" type="button" id="pd-edit">Editar</button></div>') +
      (param('invite') === 'erro' ? '<div class="portal-alert portal-alert--error">O parceiro foi criado, mas o e-mail de convite não saiu. Use "Reenviar convite".</div>' : '') +
      '<p style="display:flex;gap:.5rem;flex-wrap:wrap"><span class="badge badge--' + (p.status === 'active' ? 'client' : p.status === 'invited' ? 'new' : 'lost') + '">' + PSTATUS[p.status] + '</span>' + stripeOf(p) + '<span class="badge badge--new">Comissão padrão ' + esc(String(+p.default_share_pct)) + '%</span></p>' +
      '<nav class="subtabs" aria-label="Seções">' + tabs.map(function (t) { return '<a href="#/parceiros?id=' + id + '&tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="pd-body"></div>';
    ctx.$('#pd-edit').onclick = function () { partnerForm(ctx, p); };
    if (ctx.$('#pd-resend')) ctx.$('#pd-resend').onclick = async function () { this.disabled = true; var ok = await sendInvite(ctx, p); this.textContent = ok ? 'Convite reenviado' : 'Falhou, tente de novo'; this.disabled = false; };
    var body = ctx.$('#pd-body');
    if (tab === 'indicacoes') return tabReferrals(body, ctx, p);
    if (tab === 'comissoes') return tabCommissions(body, ctx, p);
    if (tab === 'stripe') return tabStripe(body, ctx, p);
    body.innerHTML = '<section class="portal-card"><dl class="kv"><dt>E-mail</dt><dd>' + esc(p.email) + '</dd><dt>Telefone</dt><dd>' + esc(p.phone || '—') + '</dd><dt>Empresa</dt><dd>' + esc(p.company || '—') + '</dd><dt>Idioma</dt><dd>' + esc(p.language) + '</dd>' +
      '<dt>Convidado em</dt><dd>' + esc(ctx.fmtDT(p.invited_at)) + '</dd><dt>Aceitou em</dt><dd>' + esc(p.accepted_at ? ctx.fmtDT(p.accepted_at) : '—') + '</dd><dt>Notas</dt><dd>' + esc(p.notes || '—') + '</dd></dl></section>';
  }

  async function tabReferrals(body, ctx, p) {
    var esc = ctx.esc;
    var refs = await ctx.q(ctx.sb.from('referrals').select('*').eq('partner_id', p.id).order('created_at', { ascending: false }));
    body.innerHTML = refs.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Indicado</th><th>Serviço</th><th>Status</th><th>Indicado em</th><th>Atualizado</th></tr></thead><tbody>' +
      refs.map(function (r) { return '<tr data-r="' + r.id + '" tabindex="0"><td><strong>' + esc(r.name) + '</strong><span class="sub">' + esc([r.company, r.email].filter(Boolean).join(' · ')) + '</span></td><td>' + esc(r.service || '—') + '</td><td>' + pill('ref-st', r.status, ST[r.status]) + '</td><td>' + esc(fmtD(r.created_at)) + '</td><td>' + esc(ctx.fmtDT(r.updated_at)) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<div class="empty-state portal-card"><strong>Nenhuma indicação deste parceiro</strong></div>';
    body.querySelectorAll('tr[data-r]').forEach(function (tr) { var go = function () { referralDrawer(ctx, refs.find(function (r) { return r.id === tr.dataset.r; })); }; tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
    var open = param('ref'); if (open) { var r = refs.find(function (x) { return x.id === open; }); if (r) referralDrawer(ctx, r); }
  }

  async function referralDrawer(ctx, r) {
    var esc = ctx.esc, sb = ctx.sb;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Indicação: ' + esc(r.name) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><div id="rd"><p class="portal-muted">Carregando…</p></div>');
    var res = await Promise.all([ctx.q(sb.from('referral_items').select('*').eq('referral_id', r.id).order('created_at')), ctx.q(sb.from('referral_events').select('*').eq('referral_id', r.id).order('at', { ascending: false })), ctx.q(sb.from('clients').select('id, name').order('name'))]);
    var items = res[0], evs = res[1], clients = res[2];
    var evLabel = function (e) { if (e.kind === 'status') return 'Status: ' + (ST[e.label] || e.label); if (e.kind === 'document') { var x = e.label.split(':'); return 'Documento ' + (DI[x[0]] || x[0]).toLowerCase() + ': ' + x.slice(1).join(':'); } return e.label; };
    ctx.$('#rd', o).innerHTML =
      '<dl class="kv"><dt>Contato</dt><dd>' + esc([r.email, r.phone].filter(Boolean).join(' · ')) + '</dd><dt>País</dt><dd>' + esc(r.country || '—') + '</dd><dt>Serviço</dt><dd>' + esc(r.service || '—') + '</dd><dt>Mensagem</dt><dd>' + esc(r.message || '—') + '</dd>' +
      '<dt>CRM</dt><dd>' + (r.lead_id ? '<a href="#/crm?lead=' + r.lead_id + '">Abrir lead no CRM</a>' : '—') + '</dd></dl>' +
      '<form class="portal-form" id="rd-f"><div class="portal-grid2"><div class="field"><label for="rd-st">Etapa (o parceiro vê)</label><select id="rd-st">' + STAGES.map(function (s) { return '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' + ST[s] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="rd-cl">Cliente no portal</label><select id="rd-cl"><option value="">Ainda não é cliente</option>' + clients.map(function (c) { return '<option value="' + c.id + '"' + (r.client_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="portal-alert" id="rd-m" role="status"></div><button class="btn btn--navy btn--xs" type="submit" style="justify-self:start">Salvar etapa</button></form>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">Documentação (o parceiro vê só o nome e o status, nunca o arquivo)</h3><ul class="ref-docs" id="rd-items">' +
      items.map(function (i) { return '<li><span class="ref-doc ref-doc--' + i.status + '" aria-hidden="true"></span><span>' + esc(i.label) + '</span><select data-item="' + i.id + '" aria-label="Status de ' + esc(i.label) + '">' + Object.keys(DI).map(function (k) { return '<option value="' + k + '"' + (i.status === k ? ' selected' : '') + '>' + DI[k] + '</option>'; }).join('') + '</select></li>'; }).join('') + '</ul>' +
      '<form class="toolbar" id="rd-add" style="margin-top:.75rem"><label for="rd-new" class="sr-only">Novo documento</label><input id="rd-new" list="rd-tpl" placeholder="Ex.: Passaporte do sócio" maxlength="200"><datalist id="rd-tpl">' + DOC_TEMPLATES.map(function (d) { return '<option value="' + esc(d) + '">'; }).join('') + '</datalist><button class="btn btn--ghost btn--xs" type="submit">Adicionar</button>' +
      (items.length ? '' : '<button class="btn btn--ghost btn--xs" type="button" id="rd-std">Usar lista padrão</button>') + '</form>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">Linha do tempo</h3><form class="portal-form" id="rd-note"><div class="field"><label for="rd-n">Nova atualização</label><input id="rd-n" maxlength="500" placeholder="Ex.: Artigos de organização protocolados na Sunbiz"></div>' +
      '<div class="check-row"><input type="checkbox" id="rd-vis" checked><label for="rd-vis">Visível para o parceiro</label></div><button class="btn btn--ghost btn--xs" type="submit" style="justify-self:start">Adicionar à linha do tempo</button></form>' +
      '<ol class="timeline" style="margin-top:1rem">' + evs.map(function (e) { return '<li><strong>' + esc(evLabel(e)) + (e.visible_to_partner ? '' : ' <span class="portal-muted">(interno)</span>') + '</strong><span class="portal-muted">' + esc(ctx.fmtDT(e.at)) + (e.created_by ? ' · ' + esc(e.created_by) : '') + '</span></li>'; }).join('') + '</ol>';
    var reload = async function () { var nr = await ctx.q(sb.from('referrals').select('*').eq('id', r.id).single()); referralDrawer(ctx, nr); };
    ctx.$('#rd-f', o).onsubmit = async function (e) {
      e.preventDefault();
      var x = await sb.from('referrals').update({ status: ctx.$('#rd-st', o).value, client_id: ctx.$('#rd-cl', o).value || null }).eq('id', r.id);
      if (x.error) return ctx.msg(ctx.$('#rd-m', o), ctx.errText(x.error), 'error');
      reload();
    };
    o.querySelectorAll('[data-item]').forEach(function (s) { s.onchange = async function () { await sb.from('referral_items').update({ status: s.value }).eq('id', s.dataset.item); reload(); }; });
    ctx.$('#rd-add', o).onsubmit = async function (e) { e.preventDefault(); var l = ctx.$('#rd-new', o).value.trim(); if (!l) return; await sb.from('referral_items').insert({ referral_id: r.id, label: l }); reload(); };
    if (ctx.$('#rd-std', o)) ctx.$('#rd-std', o).onclick = async function () { await sb.from('referral_items').insert(DOC_TEMPLATES.map(function (l) { return { referral_id: r.id, label: l }; })); reload(); };
    ctx.$('#rd-note', o).onsubmit = async function (e) {
      e.preventDefault(); var l = ctx.$('#rd-n', o).value.trim(); if (!l) return;
      var u = (await sb.auth.getUser()).data.user;
      await sb.from('referral_events').insert({ referral_id: r.id, kind: 'note', label: l, visible_to_partner: ctx.$('#rd-vis', o).checked, created_by: u && u.email }); reload();
    };
  }

  async function tabCommissions(body, ctx, p) {
    var esc = ctx.esc;
    var rows = await ctx.q(ctx.sb.from('invoices').select('*, clients(name), partners(name, stripe_transfers_active)').eq('partner_id', p.id).neq('status', 'draft').order('created_at', { ascending: false }));
    body.innerHTML = rows.length ? invoiceTable(ctx, rows, true) : '<div class="empty-state portal-card"><strong>Nenhuma fatura com este parceiro</strong><p>Ao criar uma fatura em Pagamentos, selecione o parceiro para registrar a comissão.</p></div>';
    wireInvoiceActions(body, ctx, rows);
  }

  async function tabStripe(body, ctx, p) {
    var esc = ctx.esc;
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Conta Stripe do parceiro</h2><p>' + stripeOf(p) + '</p>' +
      '<dl class="kv" style="margin-top:1rem"><dt>Conta</dt><dd>' + (p.stripe_account_id ? '<code>' + esc(p.stripe_account_id) + '</code>' : '—') + '</dd><dt>Cadastro enviado</dt><dd>' + (p.stripe_details_submitted ? 'Sim' : 'Não') + '</dd>' +
      '<dt>Recebe repasses</dt><dd>' + (p.stripe_transfers_active ? 'Sim' : 'Não') + '</dd><dt>Saques para o banco</dt><dd>' + (p.stripe_payouts_enabled ? 'Sim' : 'Não') + '</dd></dl>' +
      '<p class="portal-muted">O próprio parceiro conecta a conta no Portal do Parceiro, em "Recebimentos Stripe". Se preferir, gere aqui um link de cadastro e envie para ele.</p>' +
      '<div class="portal-alert" id="ps-m" role="status"></div><div class="portal-btn-row"><button class="btn btn--navy" type="button" id="ps-link">Gerar link de cadastro Stripe</button>' + (p.stripe_account_id ? '<button class="btn btn--ghost" type="button" id="ps-ref">Atualizar status</button>' : '') + '</div></section>';
    var m = ctx.$('#ps-m');
    ctx.$('#ps-link').onclick = async function () {
      try { var j = await call(ctx, { action: 'partner_onboard', partner_id: p.id, return_to: ctx.siteUrl('partner.html') }); m.className = 'portal-alert portal-alert--ok'; m.innerHTML = 'Link válido por alguns minutos: <a href="' + esc(j.url) + '" target="_blank" rel="noopener">abrir</a> <button class="btn btn--ghost btn--xs" type="button" id="ps-copy">Copiar</button>'; ctx.$('#ps-copy').onclick = function () { ctx.copy(j.url, this); }; }
      catch (e) { ctx.msg(m, errMsg(ctx, e), 'error'); }
    };
    if (ctx.$('#ps-ref')) ctx.$('#ps-ref').onclick = async function () { try { await call(ctx, { action: 'partner_refresh', partner_id: p.id }); ctx.route(); } catch (e) { ctx.msg(m, errMsg(ctx, e), 'error'); } };
  }

  /* ================= Pagamentos ================= */
  function invoiceTable(ctx, rows, hidePartner) {
    var esc = ctx.esc;
    return '<div class="table-wrap"><table class="data inv-table"><thead><tr><th>Fatura</th><th>Cliente</th>' + (hidePartner ? '' : '<th>Parceiro</th>') + '<th class="num">Total</th><th class="num">Parceiro</th><th>Status</th><th>Repasse</th><th>Ações</th></tr></thead><tbody>' +
      rows.map(function (i) {
        var acts = [];
        if (i.status === 'draft') acts.push('<button class="btn btn--navy btn--xs" data-act="invoice_send" data-i="' + i.id + '">Enviar</button>');
        if (i.hosted_invoice_url) acts.push('<a class="btn btn--ghost btn--xs" href="' + esc(i.hosted_invoice_url) + '" target="_blank" rel="noopener">Ver</a>');
        var ready = i.partners && i.partners.stripe_transfers_active;
        if (i.status === 'paid' && (i.transfer_status === 'pending' || i.transfer_status === 'failed')) acts.push(ready ? '<button class="btn btn--navy btn--xs" data-act="transfer" data-i="' + i.id + '">Repassar</button>' : '<span class="portal-muted" style="font-size:.82rem">Aguardando Stripe do parceiro</span>');
        if (i.status === 'open' || i.status === 'uncollectible') acts.push('<button class="btn btn--ghost btn--xs" data-act="invoice_sync" data-i="' + i.id + '">Sincronizar</button>');
        if (i.status !== 'paid' && i.status !== 'void') acts.push('<button class="btn btn--danger btn--xs" data-act="invoice_void" data-i="' + i.id + '">Anular</button>');
        return '<tr><td><strong>' + esc(i.number || 'Rascunho') + '</strong><span class="sub">' + esc(fmtD(i.created_at)) + (i.due_date ? ' · vence ' + esc(fmtD(i.due_date)) : '') + '</span></td><td>' + esc(i.clients ? i.clients.name : '') + '</td>' +
          (hidePartner ? '' : '<td>' + esc(i.partners ? i.partners.name : '—') + '</td>') + '<td class="num">' + esc(money(i.total_cents, i.currency)) + '</td>' +
          '<td class="num">' + (i.partner_id ? esc(money(i.partner_amount_cents, i.currency)) + (i.partner_pct != null ? ' <span class="portal-muted">(' + esc(String(+i.partner_pct)) + '%)</span>' : '') : '—') + '</td>' +
          '<td>' + pill('inv-st', i.status, IS[i.status]) + '</td><td>' + esc(TS[i.transfer_status]) + '</td><td><div class="portal-btn-row" style="flex-wrap:nowrap">' + acts.join('') + '</div><div class="portal-alert" id="ia-' + i.id + '" role="status"></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function wireInvoiceActions(root, ctx) {
    root.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = async function (e) {
        e.stopPropagation();
        if (b.dataset.act === 'invoice_void' && !confirm('Anular esta fatura no Stripe? O cliente não poderá mais pagá-la.')) return;
        if (b.dataset.act === 'transfer' && !confirm('Repassar agora a comissão do parceiro para a conta Stripe dele?')) return;
        b.disabled = true;
        try { await call(ctx, { action: b.dataset.act, invoice_id: b.dataset.i }); ctx.route(); }
        catch (x) { b.disabled = false; ctx.msg(ctx.$('#ia-' + b.dataset.i), errMsg(ctx, x), 'error'); }
      };
    });
  }

  async function payments(view, ctx) {
    var esc = ctx.esc, tab = param('tab') || 'faturas';
    var tabs = [['faturas', 'Faturas'], ['nova', 'Nova fatura'], ['stripe', 'Conta Stripe']];
    view.innerHTML = head(esc, 'Pagamentos', 'Faturas pelo Stripe, com repasse automático da comissão para o parceiro via Stripe Connect.', '<a class="btn btn--navy" href="#/pagamentos?tab=nova">Nova fatura</a>') +
      '<nav class="subtabs" aria-label="Seções">' + tabs.map(function (t) { return '<a href="#/pagamentos?tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="pg-body"></div>';
    var body = ctx.$('#pg-body');
    if (tab === 'nova') return newInvoice(body, ctx);
    if (tab === 'stripe') return stripeTab(body, ctx);
    var rows = await ctx.q(ctx.sb.from('invoices').select('*, clients(name), partners(name, stripe_transfers_active)').order('created_at', { ascending: false }));
    var st = param('status') || '';
    var shown = rows.filter(function (i) { return !st || i.status === st; });
    var now = new Date(), ym = now.toISOString().slice(0, 7);
    var open = rows.filter(function (i) { return i.status === 'open'; }).reduce(function (s, i) { return s + i.total_cents - i.amount_paid_cents; }, 0);
    var month = rows.filter(function (i) { return i.status === 'paid' && String(i.paid_at || '').slice(0, 7) === ym; }).reduce(function (s, i) { return s + i.amount_paid_cents; }, 0);
    var toPartners = rows.filter(function (i) { return i.status !== 'void' && ['scheduled', 'pending', 'failed'].indexOf(i.transfer_status) > -1; }).reduce(function (s, i) { return s + i.partner_amount_cents; }, 0);
    body.innerHTML = '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Em aberto', money(open)) + kpi(esc, 'Recebido no mês', money(month)) + kpi(esc, 'Comissões a repassar', money(toPartners)) + kpi(esc, 'Faturas', rows.length) + '</div>' +
      '<div class="toolbar"><label for="pg-st" class="sr-only">Status</label><select id="pg-st"><option value="">Todos os status</option>' + Object.keys(IS).map(function (k) { return '<option value="' + k + '"' + (st === k ? ' selected' : '') + '>' + IS[k] + '</option>'; }).join('') + '</select></div>' +
      (shown.length ? invoiceTable(ctx, shown) : '<div class="empty-state portal-card"><strong>Nenhuma fatura</strong><p>Crie a primeira em "Nova fatura".</p></div>');
    ctx.$('#pg-st').onchange = function () { ERoute.set('#/pagamentos' + (this.value ? '?status=' + this.value : ''), true); ctx.route(); };
    wireInvoiceActions(body, ctx);
  }

  async function newInvoice(body, ctx) {
    var esc = ctx.esc, sb = ctx.sb;
    var res = await Promise.all([ctx.q(sb.from('clients').select('id, name, primary_email').eq('status', 'active').order('name')), ctx.q(sb.from('partners').select('*').neq('status', 'suspended').order('name')),
      ctx.q(sb.from('referrals').select('id, partner_id, client_id, name').not('client_id', 'is', null)), ctx.q(sb.from('stripe_settings').select('*').eq('id', 1).single())]);
    var clients = res[0], partners = res[1], refs = res[2], cfg = res[3];
    var pre = param('client');
    body.innerHTML = '<div class="dash"><section class="portal-card"><form class="portal-form" id="ni" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="ni-client">Cliente</label><select id="ni-client" required><option value="">Selecione</option>' + clients.map(function (c) { return '<option value="' + c.id + '"' + (pre === c.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.primary_email) + ')</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ni-days">Vencimento (dias)</label><input id="ni-days" type="number" min="0" max="90" value="' + esc(String(cfg.default_days_until_due)) + '"></div></div>' +
      '<div class="field"><label for="ni-desc">Descrição (aparece na fatura)</label><input id="ni-desc" maxlength="500" placeholder="Ex.: Abertura de LLC na Flórida"></div>' +
      '<fieldset class="perm-box"><legend>Itens</legend><div class="inv-items" id="ni-items"></div><button class="btn btn--ghost btn--xs" type="button" id="ni-add" style="justify-self:start;margin-top:.5rem">+ Item</button></fieldset>' +
      '<fieldset class="perm-box"><legend>Parceiro (comissão)</legend><div class="portal-grid2"><div class="field"><label for="ni-partner">Parceiro</label><select id="ni-partner"><option value="">Sem parceiro</option>' + partners.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + (p.company ? ' · ' + esc(p.company) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ni-pct">Comissão (%)</label><input id="ni-pct" type="number" min="0" max="100" step="0.5" disabled></div></div><p class="portal-muted" id="ni-pinfo" style="font-size:.88rem;margin:0"></p></fieldset>' +
      '<div class="portal-alert" id="ni-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit" data-send="1">Criar e enviar ao cliente</button><button class="btn btn--ghost" type="submit" data-send="0">Salvar como rascunho</button></div></form></section>' +
      '<aside class="portal-card"><h2 class="portal-h2">Resumo do pagamento</h2><div class="split-box"><dl class="split-sum" id="ni-sum"></dl></div><p class="portal-muted" style="font-size:.85rem;margin-top:.75rem">O cliente paga o valor cheio. Quando o parceiro tem o Stripe conectado, a parte dele é transferida automaticamente para a conta Stripe dele no momento do pagamento. As taxas do Stripe ficam com a Endeavor.</p></aside></div>';
    var box = ctx.$('#ni-items');
    var addItem = function (d, amt) {
      var n = box.children.length, div = document.createElement('div'); div.className = 'inv-item';
      div.innerHTML = '<div class="field"><label for="it-d' + n + '">Descrição</label><input id="it-d' + n + '" data-d maxlength="300" value="' + esc(d || '') + '"></div><div class="field"><label for="it-q' + n + '">Qtd</label><input id="it-q' + n + '" data-q type="number" min="1" max="1000" value="1"></div>' +
        '<div class="field"><label for="it-a' + n + '">Valor (US$)</label><input id="it-a' + n + '" data-a type="number" min="0" step="0.01" value="' + (amt || '') + '"></div><button class="btn btn--ghost btn--xs" type="button" aria-label="Remover item" data-rm>×</button>';
      box.appendChild(div); div.querySelector('[data-rm]').onclick = function () { if (box.children.length > 1) { div.remove(); calc(); } };
      div.querySelectorAll('input').forEach(function (i) { i.oninput = calc; });
    };
    var items = function () { return Array.prototype.map.call(box.children, function (r) { return { description: r.querySelector('[data-d]').value.trim(), quantity: +r.querySelector('[data-q]').value || 1, amount_cents: Math.round((+r.querySelector('[data-a]').value || 0) * 100) }; }); };
    var calc = function () {
      var tot = items().reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0);
      var pid = ctx.$('#ni-partner').value, pct = pid ? +ctx.$('#ni-pct').value || 0 : 0, share = Math.round(tot * pct / 100);
      var p = partners.find(function (x) { return x.id === pid; });
      ctx.$('#ni-sum').innerHTML = '<dt>Cliente paga</dt><dd class="is-total">' + money(tot) + '</dd>' + (pid ? '<dt>Parceiro recebe (' + pct + '%)</dt><dd>' + money(share) + '</dd>' : '') + '<dt>Endeavor recebe*</dt><dd>' + money(tot - share) + '</dd>';
      ctx.$('#ni-pinfo').textContent = !p ? '' : p.stripe_transfers_active ? 'Stripe do parceiro pronto: o repasse será automático no pagamento.' : 'O parceiro ainda não conectou o Stripe: a comissão fica registrada como pendente e você repassa com um clique depois que ele conectar.';
    };
    var pickPartner = function (pid) {
      var p = partners.find(function (x) { return x.id === pid; });
      ctx.$('#ni-partner').value = p ? p.id : ''; ctx.$('#ni-pct').disabled = !p; ctx.$('#ni-pct').value = p ? +p.default_share_pct : ''; calc();
    };
    addItem();
    ctx.$('#ni-add').onclick = function () { addItem(); box.lastChild.querySelector('input').focus(); };
    ctx.$('#ni-partner').onchange = function () { pickPartner(this.value); };
    ctx.$('#ni-pct').oninput = calc;
    var refFor = function (cid) { return refs.find(function (r) { return r.client_id === cid; }); };
    ctx.$('#ni-client').onchange = function () { var r = refFor(this.value); pickPartner(r ? r.partner_id : ''); };
    if (pre) { var r0 = refFor(pre); if (r0) pickPartner(r0.partner_id); }
    calc();
    var sendFlag = true;
    ctx.$('#ni').querySelectorAll('button[type=submit]').forEach(function (b) { b.onclick = function () { sendFlag = b.dataset.send === '1'; }; });
    ctx.$('#ni').onsubmit = async function (e) {
      e.preventDefault();
      var cid = ctx.$('#ni-client').value, its = items().filter(function (i) { return i.description || i.amount_cents; });
      if (!cid) return ctx.msg(ctx.$('#ni-m'), 'Selecione o cliente.', 'error');
      if (!its.length || its.some(function (i) { return !i.description || i.amount_cents < 1; })) return ctx.msg(ctx.$('#ni-m'), ERR.invalid_items, 'error');
      var pid = ctx.$('#ni-partner').value, r = refFor(cid);
      var btns = this.querySelectorAll('button'); btns.forEach(function (b) { b.disabled = true; });
      ctx.msg(ctx.$('#ni-m'), 'Criando a fatura no Stripe…', 'info');
      try {
        await call(ctx, { action: 'invoice_create', client_id: cid, items: its, days_until_due: +ctx.$('#ni-days').value, description: ctx.$('#ni-desc').value.trim() || undefined,
          partner_id: pid || undefined, partner_pct: pid ? +ctx.$('#ni-pct').value : undefined, referral_id: r && r.partner_id === pid ? r.id : undefined, send: sendFlag });
        ERoute.go('#/pagamentos?tab=faturas');
      } catch (x) { btns.forEach(function (b) { b.disabled = false; }); ctx.msg(ctx.$('#ni-m'), errMsg(ctx, x), 'error'); }
    };
  }

  async function stripeTab(body, ctx) {
    var esc = ctx.esc, sb = ctx.sb;
    var s = await ctx.q(sb.from('stripe_settings').select('*').eq('id', 1).single());
    var hook = ctx.CFG.functionsUrl + '/payments';
    var line = function (ok, label) { return '<li><span class="ref-doc ref-doc--' + (ok ? 'approved' : 'pending') + '" aria-hidden="true"></span><span>' + label + '</span><span class="portal-muted">' + (ok ? 'OK' : 'Pendente') + '</span></li>'; };
    body.innerHTML = '<div class="dash"><section class="portal-card"><h2 class="portal-h2">Conta Stripe da Endeavor</h2>' +
      (s.account_id ? '<dl class="kv"><dt>Conta</dt><dd>' + esc(s.account_name || '') + ' · <code>' + esc(s.account_id) + '</code></dd><dt>Modo</dt><dd>' + (s.livemode ? '<span class="badge badge--client">Produção</span>' : '<span class="badge badge--contacted">Teste</span>') + '</dd><dt>Verificado em</dt><dd>' + esc(ctx.fmtDT(s.checked_at)) + '</dd></dl>' : '<p class="portal-muted">Ainda não conectada.</p>') +
      '<ul class="ref-docs" style="margin:1rem 0">' + line(!!s.account_id, 'Chave secreta configurada no servidor') + line(!!s.charges_enabled, 'Conta habilitada para receber pagamentos') + line(!!s.connect_ready, 'Stripe Connect ativo (repasses a parceiros)') + line(!!s.webhook_configured, 'Webhook configurado (status automático das faturas)') + '</ul>' +
      (s.last_error ? '<div class="portal-alert portal-alert--error">' + esc(s.last_error) + '</div>' : '') +
      '<div class="portal-alert" id="sx-m" role="status"></div><button class="btn btn--navy" type="button" id="sx-check">Verificar conexão</button>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.5rem">Padrões</h3><form class="portal-form" id="sx-f"><div class="portal-grid2"><div class="field"><label for="sx-days">Vencimento padrão (dias)</label><input id="sx-days" type="number" min="0" max="90" value="' + esc(String(s.default_days_until_due)) + '"></div>' +
      '<div class="field"><label for="sx-pct">Comissão padrão de novos parceiros (%)</label><input id="sx-pct" type="number" min="0" max="100" step="0.5" value="' + esc(String(+s.default_partner_pct)) + '"></div></div><button class="btn btn--ghost btn--xs" type="submit" style="justify-self:start">Salvar padrões</button></form></section>' +
      '<aside class="portal-card"><h2 class="portal-h2">Como conectar</h2><ol class="steps-ol">' +
      '<li>No Stripe da Endeavor, abra <strong>Developers → API keys</strong> e copie a <strong>Secret key</strong> (comece pela de teste, <code>sk_test_…</code>).</li>' +
      '<li>No Supabase, em <strong>Edge Functions → Secrets</strong>, crie <code>STRIPE_SECRET_KEY</code> com essa chave. Ela fica só no servidor e nunca passa pelo navegador.</li>' +
      '<li>No Stripe, ative o <strong>Connect</strong> (Settings → Connect) como plataforma, com contas <strong>Express</strong>.</li>' +
      '<li>Em <strong>Developers → Webhooks</strong>, crie um endpoint para <code>' + esc(hook) + '</code> com os eventos <code>invoice.*</code> e <code>transfer.reversed</code>. Salve o signing secret em <code>STRIPE_WEBHOOK_SECRET</code>.</li>' +
      '<li>Crie um segundo endpoint para o mesmo endereço marcando <strong>eventos de contas conectadas</strong>, com <code>account.updated</code>. Salve em <code>STRIPE_CONNECT_WEBHOOK_SECRET</code>.</li>' +
      '<li>Clique em <strong>Verificar conexão</strong>. Para produção, troque a chave pela <code>sk_live_…</code> e refaça os webhooks no modo live.</li></ol>' +
      '<button class="btn btn--ghost btn--xs" type="button" id="sx-copy">Copiar endereço do webhook</button></aside></div>';
    ctx.$('#sx-copy').onclick = function () { ctx.copy(hook, this); };
    ctx.$('#sx-check').onclick = async function () {
      this.disabled = true; ctx.msg(ctx.$('#sx-m'), 'Consultando o Stripe…', 'info');
      try { var j = await call(ctx, { action: 'status' }); if (!j.configured) { this.disabled = false; return ctx.msg(ctx.$('#sx-m'), 'A chave STRIPE_SECRET_KEY ainda não foi criada no Supabase.', 'error'); } ctx.route(); }
      catch (e) { this.disabled = false; ctx.msg(ctx.$('#sx-m'), errMsg(ctx, e), 'error'); }
    };
    ctx.$('#sx-f').onsubmit = async function (e) {
      e.preventDefault();
      var r = await sb.from('stripe_settings').update({ default_days_until_due: +ctx.$('#sx-days').value, default_partner_pct: +ctx.$('#sx-pct').value }).eq('id', 1);
      ctx.msg(ctx.$('#sx-m'), r.error ? ctx.errText(r.error) : 'Padrões salvos.', r.error ? 'error' : 'ok');
    };
  }

  window.AdminPayments = {
    partners: function (view, ctx) { var id = (ERoute.get().match(/[?&]id=([0-9a-f-]{36})/) || [])[1]; return id ? partnerDetail(view, ctx, id) : partnersList(view, ctx); },
    payments: payments
  };
})();
