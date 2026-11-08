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

  var money = function (c, cur) { return new Intl.NumberFormat((window.ADMIN_LOCALE || 'pt-BR'), { style: 'currency', currency: (cur || 'usd').toUpperCase() }).format((c || 0) / 100); };
  var fmtD = function (d) { if (!d) return ''; var x = new Date(d.length === 10 ? d + 'T12:00:00' : d); return x.toLocaleDateString((window.ADMIN_LOCALE || 'pt-BR')); };
  var pill = function (cls, s, label) { return '<span class="' + cls + ' ' + cls + '--' + s + '">' + label + '</span>'; };
  var GPS = { none: 'Global Payouts', requested: 'Global Payouts: enviar link', link_sent: 'Global Payouts: link enviado', ready: 'Global Payouts pronto' };
  function stripeOf(p) {
    if (p.payout_method === 'global_payouts') return pill('stripe-st', p.global_payouts_status === 'ready' ? 'ok' : p.global_payouts_status === 'link_sent' ? 'review' : 'incomplete', GPS[p.global_payouts_status] + (p.payout_country ? ' (' + p.payout_country + ')' : ''));
    if (!p.stripe_account_id) return pill('stripe-st', 'none', 'Stripe não conectado');
    if (p.stripe_transfers_active) return pill('stripe-st', 'ok', 'Stripe pronto');
    if (p.stripe_details_submitted) return pill('stripe-st', 'review', 'Stripe em análise');
    return pill('stripe-st', 'incomplete', 'Cadastro Stripe incompleto');
  }
  function pBadge(p) {
    if (p.closed_at) return '<span class="badge badge--lost" title="Encerrada em ' + new Date(p.closed_at).toLocaleDateString('pt-BR') + '">Conta encerrada</span>';
    if (p.closure_requested_at) return '<span class="badge badge--contacted" title="Sem novas indicações. Fecha sozinha depois do último repasse.">Encerrando</span>';
    if (p.program_status === 'pending') return '<span class="badge badge--contacted">Aguardando aprovação</span>';
    return '<span class="badge badge--' + (p.status === 'active' ? 'client' : p.status === 'invited' ? 'new' : 'lost') + '">' + PSTATUS[p.status] + '</span>';
  }
  var pctOf = function (p) { return p.default_share_pct == null ? 'A definir' : String(+p.default_share_pct) + '%'; };
  var CTS = { none: 'Sem contrato', sent: 'Enviado ao parceiro', partner_signed: 'Parceiro assinou: falta a Endeavor', signed: 'Assinado pelas duas partes' };
  async function piCall(ctx, payload) {
    var sess = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/partner-invite', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (sess ? sess.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  }
  function approveForm(ctx, p) {
    var esc = ctx.esc;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Aprovar parceiro</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<p><strong>' + esc(p.name) + '</strong>' + (p.company ? ' · ' + esc(p.company) : '') + '<br><span class="portal-muted">' + esc(p.email) + '</span></p>' +
      '<form class="portal-form" id="ap" novalidate><div class="field"><label for="ap-pct">Comissão combinada (%)</label><input id="ap-pct" type="number" min="0" max="100" step="0.5" required value="' + (p.default_share_pct != null ? esc(String(+p.default_share_pct)) : '') + '"></div>' +
      '<div class="check-row"><input type="checkbox" id="ap-send" checked><label for="ap-send">Enviar agora o contrato de parceria para assinatura eletrônica</label></div>' +
      '<p class="portal-muted" style="font-size:.86rem">O contrato sai preenchido com os dados do parceiro e a comissão. Ele assina primeiro; depois chega para você assinar pela Endeavor. A cópia final fica no portal dele e aqui.</p>' +
      '<div class="portal-alert portal-alert--info" style="display:block;font-size:.86rem">O modelo do contrato (Referral Partner Agreement) é um rascunho: peça a revisão de um advogado antes de usar com parceiros reais.</div>' +
      '<div class="portal-alert" id="ap-msg" role="alert"></div><button class="btn btn--navy" type="submit">Aprovar</button></form>', true);
    ctx.$('#ap', o).onsubmit = async function (e) {
      e.preventDefault();
      var pct = Number(ctx.$('#ap-pct', o).value), m = ctx.$('#ap-msg', o), b = this.querySelector('button[type=submit]');
      if (ctx.$('#ap-pct', o).value === '' || !(pct >= 0 && pct <= 100)) return ctx.msg(m, 'Informe a comissão entre 0 e 100%.', 'error');
      b.disabled = true; b.textContent = 'Aprovando…';
      try {
        var j = await piCall(ctx, { action: 'approve', partner_id: p.id, pct: pct, send_contract: ctx.$('#ap-send', o).checked });
        ctx.$('#ap', o).innerHTML = '<div class="portal-alert portal-alert--ok" style="display:block"><strong>Parceiro aprovado com ' + esc(String(pct)) + '% de comissão.</strong> ' +
          (j.version ? (j.mailed ? 'O contrato foi enviado para ' + esc(p.email) + '.' : 'O contrato foi criado, mas o e-mail não saiu: use "Reenviar link" na aba Contrato.') : '') + '</div><button class="btn btn--navy" type="button" id="ap-done">Fechar</button>';
        var fin = function () { ctx.closeOverlay(); ERoute.go('#/parceiros?id=' + p.id + '&tab=contrato'); };
        ctx.$('#ap-done', o).onclick = fin; o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = fin; });
      } catch (err) { b.disabled = false; b.textContent = 'Aprovar'; ctx.msg(m, ctx.errText(err), 'error'); }
    };
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
    // branded invitation (one e-mail with the password link) sent by the support Gmail
    try {
      var sess = (await ctx.sb.auth.getSession()).data.session;
      var rr = await fetch(ctx.CFG.functionsUrl + '/partner-invite', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (sess ? sess.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify({ partner_id: p.id }) });
      var jj = await rr.json().catch(function () { return {}; });
      if (rr.ok && jj && jj.ok) return true;
    } catch (e) { /* fall back below */ }
    // fallback: Supabase access e-mail + instructions by FormSubmit
    var link = ctx.siteUrl('partner.html') + '?lang=' + (p.language || 'pt');
    try { await call(ctx, { action: 'send_access', partner_id: p.id }); } catch (e) { return false; }
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
    view.innerHTML = head(esc, 'Parceiros', 'Programa de indicações: convide parceiros, acompanhe as indicações e os repasses de comissão via Stripe Connect.', '<div class="portal-btn-row"><a class="btn btn--ghost" href="#/crm?auto=1">Vídeo e automações</a><button class="btn btn--navy" type="button" id="pt-new">Novo parceiro</button></div>') +
      '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Parceiros ativos', parts.filter(function (p) { return p.status === 'active' && p.program_status !== 'pending'; }).length) + kpi(esc, 'Aguardando aprovação', parts.filter(function (p) { return p.program_status === 'pending'; }).length) + kpi(esc, 'Indicações', refs.length) +
      kpi(esc, 'Viraram clientes', refs.filter(function (r) { return ['onboarding', 'in_process', 'completed'].indexOf(r.status) > -1; }).length) + kpi(esc, 'Repasses pendentes', money(pendingAll)) + '</div>' +
      (parts.length ? '<div class="table-wrap"><table class="data data--partners"><thead><tr><th>Parceiro</th><th>Tipo</th><th>Status</th><th class="num">Comissão</th><th>Stripe</th><th class="num">Indicações</th><th class="num">Repassado</th><th class="num">A repassar</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        parts.map(function (p) {
          var n = refs.filter(function (r) { return r.partner_id === p.id; }).length;
          return '<tr data-id="' + p.id + '" tabindex="0"><td><strong>' + esc(p.name) + '</strong><span class="sub">' + esc([p.company, p.email].filter(Boolean).join(' · ')) + '</span></td><td>' + esc(TYPE[p.partner_type]) + '</td>' +
            '<td>' + pBadge(p) + '</td><td class="num">' + esc(pctOf(p)) + '</td><td>' + stripeOf(p) + '</td>' +
            '<td class="num">' + n + '</td><td class="num">' + esc(money(total(p.id, function (i) { return i.transfer_status === 'paid'; }))) + '</td><td class="num">' + esc(money(total(p.id, function (i) { return ['scheduled', 'pending', 'failed'].indexOf(i.transfer_status) > -1 && i.status !== 'void'; }))) + '</td>' +
            '<td class="row-actions"><button type="button" class="btn btn--ghost btn--xs act-dots" data-menu="' + p.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="Ações do parceiro" title="Ações">⋯</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state portal-card"><strong>Nenhum parceiro ainda</strong><p>Convide contadores, corretores, advogados e outros parceiros que indicam clientes.</p></div>');
    view.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var go = function () { ERoute.go('#/parceiros?id=' + tr.dataset.id); };
      tr.onclick = function (e) { if (!e.target.closest('.row-actions')) go(); };
      tr.onkeydown = function (e) { if (e.key === 'Enter' && e.target === tr) go(); };
    });
    // per-row menu (fixed popover so the table scroll does not cut it)
    var closeMenu = function () { var m = document.getElementById('pt-menu'); if (m) m.remove(); view.querySelectorAll('[data-menu][aria-expanded=true]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); };
    view.querySelectorAll('[data-menu]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var open = btn.getAttribute('aria-expanded') === 'true'; closeMenu(); if (open) return;
        var p = parts.find(function (x) { return x.id === btn.dataset.menu; });
        var m = document.createElement('div'); m.id = 'pt-menu'; m.className = 'act-menu'; m.setAttribute('role', 'menu');
        m.innerHTML = rowActions(esc, p).replace(/btn--ghost btn--xs|btn--danger btn--xs|btn--navy btn--xs/g, function (c) { return c.indexOf('danger') > -1 ? 'act-item act-item--danger' : 'act-item'; }).replace(/class="btn /g, 'role="menuitem" class="');
        document.body.appendChild(m);
        m._place = function () {
          var r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
          m.style.left = Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8)) + 'px';
          m.style.top = (r.bottom + 4 + mh > window.innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + 'px';
        };
        m._place();
        btn.setAttribute('aria-expanded', 'true');
        wireActions(m, ctx, parts, refs, invs, closeMenu);
        var first = m.querySelector('button'); if (first) first.focus();
      };
    });
    if (!window.__ptMenuWired) {
      window.__ptMenuWired = true;
      var kill = function () { var m = document.getElementById('pt-menu'); if (m) m.remove(); document.querySelectorAll('[data-menu][aria-expanded=true]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); };
      document.addEventListener('click', function (e) { if (!e.target.closest('#pt-menu')) kill(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') kill(); });
      window.addEventListener('hashchange', kill); window.addEventListener('resize', kill);
      document.addEventListener('scroll', function () { var m = document.getElementById('pt-menu'); if (m && m._place) m._place(); }, true);
    }
    ctx.$('#pt-new').onclick = function () { partnerForm(ctx, null); };
    if (param('novo')) {
      var lid = param('lead');
      if (lid) sb.from('leads').select('*').eq('id', lid).maybeSingle().then(function (r) { var l = r.data; partnerForm(ctx, null, l ? { name: l.name, email: l.email, phone: l.phone, company: l.company, language: /^(pt|en|es)$/.test(l.language || '') ? l.language : 'pt', notes: l.message ? 'Do CRM: ' + String(l.message).slice(0, 1500) : null, lead_id: l.id } : null); });
      else partnerForm(ctx, null);
    }
  }

  /* row actions: Abrir, Editar, Reenviar convite, Suspender/Reativar, Excluir */
  function rowActions(esc, p) {
    var b = function (act, label, cls) { return '<button type="button" class="btn ' + (cls || 'btn--ghost') + ' btn--xs" data-act="' + act + '" data-pid="' + p.id + '">' + label + '</button>'; };
    return (p.program_status === 'pending' ? b('approve', 'Aprovar', 'btn--navy') : '') + b('open', 'Abrir') + b('edit', 'Editar') + (p.status !== 'active' || !p.user_id ? b('resend', 'Reenviar convite') : '') +
      (p.status === 'suspended' ? b('reactivate', 'Reativar') : b('suspend', 'Suspender')) + b('delete', 'Excluir', 'btn--danger');
  }
  function confirmBox(ctx, title, text, okLabel, danger, run) {
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + title + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<p>' + text + '</p><div class="portal-alert" id="cf-msg" role="alert"></div><div class="portal-btn-row"><button class="btn ' + (danger ? 'btn--danger' : 'btn--navy') + '" type="button" id="cf-ok">' + okLabel + '</button><button class="btn btn--ghost" type="button" id="cf-no">Cancelar</button></div>', true);
    ctx.$('#cf-no', o).onclick = ctx.closeOverlay;
    ctx.$('#cf-ok', o).onclick = async function () {
      var b = this; b.disabled = true;
      var err = await run();
      if (err) { b.disabled = false; return ctx.msg(ctx.$('#cf-msg', o), err, 'error'); }
      ctx.closeOverlay(); ctx.route();
    };
  }
  function partnerActions(ctx, p, act, counts, btn) {
    var esc = ctx.esc;
    if (act === 'open') return ERoute.go('#/parceiros?id=' + p.id);
    if (act === 'edit') return partnerForm(ctx, p);
    if (act === 'approve') return approveForm(ctx, p);
    if (act === 'resend') {
      btn.disabled = true; btn.textContent = 'Enviando…';
      return sendInvite(ctx, p).then(function (ok) {
        btn.disabled = false; btn.textContent = 'Reenviar convite';
        var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (ok ? 'Convite reenviado' : 'Convite não enviado') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
          '<div class="portal-alert portal-alert--' + (ok ? 'ok' : 'error') + '" style="display:block">' + (ok ? 'O convite foi reenviado para ' + esc(p.email) + '. Peça para olhar também o spam.' : 'O e-mail para ' + esc(p.email) + ' não saiu. Tente de novo em alguns segundos.') + '</div>' +
          '<button class="btn btn--navy" type="button" id="rs-ok">Fechar</button>', true);
        ctx.$('#rs-ok', o).onclick = ctx.closeOverlay; ctx.$('#rs-ok', o).focus();
      });
    }
    var set = function (st) { return async function () { var r = await ctx.sb.from('partners').update({ status: st }).eq('id', p.id); return r.error ? ctx.errText(r.error) : null; }; };
    if (act === 'suspend') return confirmBox(ctx, 'Suspender parceiro', '<strong>' + esc(p.name) + '</strong> perde o acesso ao Portal do Parceiro e não pode enviar novas indicações. As indicações e comissões continuam registradas. Você pode reativar depois.', 'Suspender', true, set('suspended'));
    if (act === 'reactivate') return confirmBox(ctx, 'Reativar parceiro', '<strong>' + esc(p.name) + '</strong> volta a ' + (p.user_id ? 'ter acesso ao Portal do Parceiro.' : 'ficar como convidado. Se ainda não criou a senha, use "Reenviar convite".'), 'Reativar', false, set(p.user_id ? 'active' : 'invited'));
    if (act === 'delete') {
      if (counts.refs || counts.invs) return confirmBox(ctx, 'Não é possível excluir', '<strong>' + esc(p.name) + '</strong> tem ' + [counts.refs ? counts.refs + ' indicação(ões)' : '', counts.invs ? counts.invs + ' comissão(ões)' : ''].filter(Boolean).join(' e ') +
        ' registradas. Para não apagar esse histórico, use <strong>Suspender</strong>: o parceiro perde o acesso e os registros ficam guardados.', p.status === 'suspended' ? 'Ok' : 'Suspender', p.status !== 'suspended', p.status === 'suspended' ? async function () { return null; } : set('suspended'));
      return confirmBox(ctx, 'Excluir parceiro', 'Excluir <strong>' + esc(p.name) + '</strong> (' + esc(p.email) + ')? O cadastro é apagado e o parceiro perde o acesso ao portal. Isso não pode ser desfeito.', 'Excluir', true, async function () {
        // the server also removes the partner's login (unless the e-mail is an admin, a client or another partner),
        // so the same e-mail can be invited again as a new partner
        try {
          var sess = (await ctx.sb.auth.getSession()).data.session;
          var rr = await fetch(ctx.CFG.functionsUrl + '/partner-invite', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (sess ? sess.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify({ action: 'delete', partner_id: p.id }) });
          var jj = await rr.json().catch(function () { return null; });
          if (jj && jj.error === 'has_history') return 'Este parceiro tem indicações ou comissões registradas. Use Suspender.';
          if (rr.ok && jj && jj.ok) { if (/[?&]id=/.test(location.hash)) ERoute.go('#/parceiros'); return null; }
        } catch (e) { /* fall back below */ }
        var r = await ctx.sb.from('partners').delete().eq('id', p.id);
        if (r.error) return ctx.errText(r.error);
        if (/[?&]id=/.test(location.hash)) ERoute.go('#/parceiros');
        return null;
      });
    }
  }
  function wireActions(root, ctx, parts, refs, invs, done) {
    root.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation(); if (done) done();
        var p = parts.find(function (x) { return x.id === b.dataset.pid; }); if (!p) return;
        partnerActions(ctx, p, b.dataset.act, { refs: refs.filter(function (r) { return r.partner_id === p.id; }).length, invs: invs.filter(function (i) { return i.partner_id === p.id; }).length }, b);
      };
    });
  }

  function partnerForm(ctx, p, pre) {
    var esc = ctx.esc, edit = !!p; p = p || Object.assign({ language: 'pt', partner_type: 'referral', default_share_pct: 10 }, pre || {});
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (edit ? 'Editar parceiro' : 'Novo parceiro') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="pf" novalidate><div class="field"><label for="pf-name">Nome</label><input id="pf-name" required maxlength="200" value="' + esc(p.name || '') + '"></div>' +
      '<div class="field"><label for="pf-email">E-mail (login do parceiro)</label><input id="pf-email" type="email" required value="' + esc(p.email || '') + '"' + (edit && p.user_id ? ' readonly' : '') + '></div>' +
      '<div class="portal-grid2"><div class="field"><label for="pf-company">Empresa</label><input id="pf-company" maxlength="200" value="' + esc(p.company || '') + '"></div><div class="field"><label for="pf-phone">Telefone</label><input id="pf-phone" maxlength="50" value="' + esc(p.phone || '') + '"></div>' +
      '<div class="field"><label for="pf-type">Tipo</label><select id="pf-type">' + Object.keys(TYPE).map(function (k) { return '<option value="' + k + '"' + (p.partner_type === k ? ' selected' : '') + '>' + TYPE[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="pf-pct">Comissão padrão (%)</label><input id="pf-pct" type="number" min="0" max="100" step="0.5" value="' + (p.default_share_pct == null ? '' : esc(String(+p.default_share_pct))) + '"' + (p.program_status === 'pending' ? ' placeholder="A definir na aprovação"' : '') + '></div>' +
      '<div class="field"><label for="pf-lang">Idioma</label><select id="pf-lang"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div>' +
      (edit ? '<div class="field"><label for="pf-status">Status</label><select id="pf-status">' + Object.keys(PSTATUS).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? ' selected' : '') + '>' + PSTATUS[k] + '</option>'; }).join('') + '</select></div>' : '') + '</div>' +
      '<div class="field"><label for="pf-notes">Notas internas (o parceiro não vê)</label><textarea id="pf-notes" rows="3" maxlength="5000">' + esc(p.notes || '') + '</textarea></div>' +
      (edit ? '' : '<p class="portal-muted" style="font-size:.88rem">O parceiro recebe por e-mail o passo a passo para criar a senha e ativar o código do Google Authenticator.</p>') +
      '<div class="portal-alert" id="pf-msg" role="alert"></div><button class="btn btn--navy" type="submit">' + (edit ? 'Salvar' : 'Criar e enviar convite') + '</button></form>');
    ctx.$('#pf-lang', o).value = p.language || 'pt';
    ctx.$('#pf', o).onsubmit = async function (e) {
      e.preventDefault();
      var v = function (id) { return ctx.$('#' + id, o).value.trim(); };
      var row = { name: v('pf-name'), email: v('pf-email').toLowerCase(), company: v('pf-company') || null, phone: v('pf-phone') || null, partner_type: v('pf-type'), default_share_pct: v('pf-pct') === '' && p.program_status === 'pending' ? null : Number(v('pf-pct')), language: v('pf-lang'), notes: v('pf-notes') || null };
      if (edit) row.status = v('pf-status');
      if (row.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) return ctx.msg(ctx.$('#pf-msg', o), 'Informe nome e e-mail válidos.', 'error');
      if (row.default_share_pct !== null && !(row.default_share_pct >= 0 && row.default_share_pct <= 100)) return ctx.msg(ctx.$('#pf-msg', o), 'Comissão entre 0 e 100%.', 'error');
      var form = this, btn = form.querySelector('button[type=submit]'), m = ctx.$('#pf-msg', o), label = btn.textContent;
      btn.disabled = true; btn.textContent = edit ? 'Salvando…' : 'Enviando convite…';
      var r = edit ? await ctx.sb.from('partners').update(row).eq('id', p.id) : await ctx.sb.from('partners').insert(row).select('id').single();
      if (r.error) { btn.disabled = false; btn.textContent = label; return ctx.msg(m, /duplicate|unique/i.test(r.error.message) ? 'Já existe um parceiro com este e-mail.' : ctx.errText(r.error), 'error'); }
      if (edit) { ctx.closeOverlay(); ctx.route(); return; }
      var ok = await sendInvite(ctx, Object.assign({ id: r.data.id }, row));
      if (p.lead_id) await ctx.sb.from('leads').update({ kind: 'partner', status: 'partner', partner_id: r.data.id }).eq('id', p.lead_id);
      // confirmation stays open until the admin closes it (Fechar or X)
      var finish = function () { ctx.closeOverlay(); ctx.route(); };
      form.innerHTML = '<div class="portal-alert portal-alert--' + (ok ? 'ok' : 'error') + '" role="status" style="display:block">' +
        (ok ? '<strong>Convite enviado.</strong> ' + ctx.esc(row.name) + ' vai receber em ' + ctx.esc(row.email) + ' o link para criar a senha. Peça para olhar também o spam.'
            : '<strong>O parceiro foi criado, mas o e-mail de convite não saiu.</strong> Use "Reenviar convite" na lista de parceiros.') + '</div>' +
        '<button class="btn btn--navy" type="button" id="pf-done">Fechar</button>';
      ctx.$('#pf-done', o).onclick = finish; ctx.$('#pf-done', o).focus();
      o.querySelectorAll('.close-x').forEach(function (b) { b.onclick = finish; });
      o.onclick = function (e) { if (e.target === o) finish(); };
      document.onkeydown = function (e) { if (e.key === 'Escape') finish(); };
    };
  }

  async function partnerDetail(view, ctx, id) {
    var esc = ctx.esc, sb = ctx.sb;
    var p = await ctx.q(sb.from('partners').select('*').eq('id', id).single());
    var tab = param('tab') || 'indicacoes';
    var tabs = [['indicacoes', 'Indicações'], ['comissoes', 'Comissões'], ['stripe', 'Stripe'], ['contrato', 'Contrato'], ['dados', 'Dados']];
    if (p.program_status === 'pending' && !param('tab')) tab = 'contrato';
    view.innerHTML = '<p><a href="#/parceiros">← Parceiros</a></p>' + head(esc, p.name, [TYPE[p.partner_type], p.company, p.email].filter(Boolean).join(' · '),
      '<div class="portal-btn-row row-actions--head">' + rowActions(esc, p).replace(/<button[^>]*data-act="open"[^>]*>Abrir<\/button>/, '') + '</div>') +
      (param('invite') === 'erro' ? '<div class="portal-alert portal-alert--error" style="display:block">O parceiro foi criado, mas o e-mail de convite não saiu. Use "Reenviar convite".</div>' : '') +
      '<p style="display:flex;gap:.5rem;flex-wrap:wrap">' + pBadge(p) + stripeOf(p) + '<span class="badge badge--new">Comissão ' + esc(pctOf(p)) + '</span>' + (p.contract_status !== 'none' ? '<span class="badge badge--' + (p.contract_status === 'signed' ? 'client' : 'contacted') + '">Contrato: ' + CTS[p.contract_status] + '</span>' : '') + '</p>' +
      '<nav class="subtabs" aria-label="Seções">' + tabs.map(function (t) { return '<a href="#/parceiros?id=' + id + '&tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="pd-body"></div>';
    var counts = await Promise.all([sb.from('referrals').select('id', { count: 'exact', head: true }).eq('partner_id', id), sb.from('invoices').select('id', { count: 'exact', head: true }).eq('partner_id', id)]);
    view.querySelectorAll('.row-actions--head [data-act]').forEach(function (b) {
      b.onclick = function () { partnerActions(ctx, p, b.dataset.act, { refs: counts[0].count || 0, invs: counts[1].count || 0 }, b); };
    });
    var body = ctx.$('#pd-body');
    if (tab === 'indicacoes') return tabReferrals(body, ctx, p);
    if (tab === 'comissoes') return tabCommissions(body, ctx, p);
    if (tab === 'stripe') return tabStripe(body, ctx, p);
    if (tab === 'contrato') return tabContract(body, ctx, p);
    body.innerHTML = '<section class="portal-card"><dl class="kv"><dt>E-mail</dt><dd>' + esc(p.email) + '</dd>' + (p.email2 ? '<dt>Segundo e-mail</dt><dd>' + esc(p.email2) + '</dd>' : '') + (p.closure_requested_at ? '<dt>Encerramento</dt><dd>' + (p.closed_at ? 'Conta encerrada em ' + esc(ctx.fmtDT(p.closed_at)) + '. Contrato e histórico de pagamentos guardados.' : 'Pedido em ' + esc(ctx.fmtDT(p.closure_requested_at)) + '. Sem novas indicações; fecha sozinha depois do último repasse.') + '</dd>' : '') + '<dt>Telefone</dt><dd>' + esc(p.phone || '—') + '</dd><dt>Empresa</dt><dd>' + esc(p.company || '—') + '</dd><dt>Idioma</dt><dd>' + esc(p.language) + '</dd>' +
      '<dt>País</dt><dd>' + esc(p.country || '—') + '</dd><dt>Origem</dt><dd>' + (p.signup_source === 'site' ? 'Cadastro pelo site' : 'Convite do admin') + '</dd>' +
      '<dt>Conversa de onboarding</dt><dd>' + (p.onboarding_at ? '<a href="#/agenda">' + esc(ctx.fmtDT(p.onboarding_at)) + '</a>' : '—') + '</dd><dt>Aprovado em</dt><dd>' + esc(p.approved_at ? ctx.fmtDT(p.approved_at) + (p.approved_by ? ' · ' + p.approved_by : '') : (p.program_status === 'pending' ? 'Aguardando' : '—')) + '</dd>' +
      '<dt>Convidado em</dt><dd>' + esc(ctx.fmtDT(p.invited_at)) + '</dd><dt>Aceitou em</dt><dd>' + esc(p.accepted_at ? ctx.fmtDT(p.accepted_at) : '—') + '</dd><dt>Notas</dt><dd>' + esc(p.notes || '—') + '</dd></dl></section>';
  }

  async function tabContract(body, ctx, p) {
    var esc = ctx.esc, sb = ctx.sb, st = p.contract_status || 'none';
    var envE = null; if (p.contract_endeavor_env) envE = (await sb.from('envelopes').select('token, status').eq('id', p.contract_endeavor_env).maybeSingle()).data;
    var step = function (done, now, title, text) { return '<li class="' + (done ? 'is-done' : now ? 'is-now' : '') + '"><span class="pw-dot" aria-hidden="true">' + (done ? '✓' : '•') + '</span><div><strong>' + title + '</strong><p>' + text + '</p></div></li>'; };
    body.innerHTML = '<section class="portal-card pw"><h2 class="portal-h2" style="margin:0">Aprovação e contrato</h2><ol class="pw-steps">' +
      step(true, false, 'Cadastro', p.signup_source === 'site' ? 'Feito pelo site em ' + esc(ctx.fmtDT(p.created_at)) + '.' : 'Criado pelo admin.') +
      step(!!p.onboarding_at && new Date(p.onboarding_at) < new Date(), !!p.onboarding_at && new Date(p.onboarding_at) >= new Date(), 'Conversa de onboarding', p.onboarding_at ? esc(ctx.fmtDT(p.onboarding_at)) : 'Sem horário marcado.') +
      step(p.program_status === 'approved', p.program_status === 'pending', 'Aprovação e comissão', p.program_status === 'pending' ? 'Aguardando a sua aprovação. A comissão fica "a definir" até lá e as indicações ficam bloqueadas.' : 'Aprovado' + (p.approved_at ? ' em ' + esc(ctx.fmtDT(p.approved_at)) : '') + ' · comissão ' + esc(pctOf(p)) + '.') +
      step(st === 'partner_signed' || st === 'signed', st === 'sent', 'Assinatura do parceiro', st === 'none' ? 'Contrato ainda não enviado.' : st === 'sent' ? 'Enviado em ' + esc(ctx.fmtDT(p.contract_sent_at)) + ' (' + esc(String(+p.contract_pct)) + '%). Aguardando o parceiro.' : 'Assinado pelo parceiro.') +
      step(st === 'signed', st === 'partner_signed', 'Assinatura da Endeavor', st === 'signed' ? 'Concluído em ' + esc(ctx.fmtDT(p.contract_signed_at)) + '. Cópia no portal do parceiro e em Assinaturas.' : st === 'partner_signed' ? 'Falta você assinar pela Endeavor.' : '—') +
      '</ol><div class="portal-alert" id="ct-msg" role="status"></div><div class="portal-btn-row" style="margin-top:1rem">' +
      (p.program_status === 'pending' ? '<button class="btn btn--navy" type="button" id="ct-approve">Aprovar e definir comissão</button>' : '') +
      (st === 'partner_signed' && envE && envE.status !== 'signed' ? '<a class="btn btn--navy" href="sign.html?t=' + esc(envE.token) + '&lang=pt&ret=admin">Assinar pela Endeavor</a>' : '') +
      (st === 'sent' || st === 'partner_signed' ? '<button class="btn btn--ghost" type="button" id="ct-resend">Reenviar link' + (st === 'sent' ? ' ao parceiro' : ' para o support@') + '</button>' : '') +
      (st === 'partner_signed' || st === 'signed' ? '<button class="btn btn--ghost" type="button" id="ct-dl">Baixar contrato' + (st === 'signed' ? ' assinado' : '') + '</button>' : '') +
      (p.program_status === 'approved' && st !== 'partner_signed' ? '<button class="btn btn--ghost" type="button" id="ct-new">' + (st === 'none' ? 'Enviar contrato' : 'Gerar novo contrato') + '</button>' : '') +
      '</div><p class="portal-muted" style="font-size:.85rem;margin-top:1rem">Modelo: Referral Partner Agreement v2026-11-06 (em inglês). Precisa da revisão de um advogado antes do uso com parceiros reais. Os dados fiscais (W-9/W-8) e o 1099 ficam com o Stripe.</p></section>';
    var m = ctx.$('#ct-msg');
    if (ctx.$('#ct-approve')) ctx.$('#ct-approve').onclick = function () { approveForm(ctx, p); };
    if (ctx.$('#ct-resend')) ctx.$('#ct-resend').onclick = async function () { this.disabled = true; try { var j = await piCall(ctx, { action: 'contract_resend', partner_id: p.id }); ctx.msg(m, 'Link enviado para ' + j.to + '.', 'ok'); } catch (e) { ctx.msg(m, ctx.errText(e), 'error'); } this.disabled = false; };
    if (ctx.$('#ct-dl')) ctx.$('#ct-dl').onclick = async function () { try { var j = await piCall(ctx, { action: 'contract_url', partner_id: p.id }); window.open(j.url, '_blank', 'noopener'); } catch (e) { ctx.msg(m, ctx.errText(e), 'error'); } };
    if (ctx.$('#ct-new')) ctx.$('#ct-new').onclick = async function () {
      var v = prompt('Comissão do contrato (%):', p.default_share_pct != null ? String(+p.default_share_pct) : ''); if (v == null) return;
      var pct = Number(v); if (v === '' || !(pct >= 0 && pct <= 100)) return ctx.msg(m, 'Informe a comissão entre 0 e 100%.', 'error');
      if (st !== 'none' && !confirm('Gerar um novo contrato? O link anterior deixa de valer.')) return;
      this.disabled = true;
      try { var j = await piCall(ctx, { action: 'contract_send', partner_id: p.id, pct: pct }); if (pct !== +p.default_share_pct) await sb.from('partners').update({ default_share_pct: pct }).eq('id', p.id); ctx.msg(m, j.mailed ? 'Contrato enviado para ' + p.email + '.' : 'Contrato criado, mas o e-mail não saiu. Use "Reenviar link".', j.mailed ? 'ok' : 'error'); setTimeout(ctx.route, 1200); }
      catch (e) { this.disabled = false; ctx.msg(m, ctx.errText(e), 'error'); }
    };
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
    var rows = await ctx.q(ctx.sb.from('invoices').select('*, clients(name), partners(name, stripe_transfers_active, payout_method)').eq('partner_id', p.id).neq('status', 'draft').order('created_at', { ascending: false }));
    body.innerHTML = rows.length ? invoiceTable(ctx, rows, true) : '<div class="empty-state portal-card"><strong>Nenhuma fatura com este parceiro</strong><p>Ao criar uma fatura em Pagamentos, selecione o parceiro para registrar a comissão.</p></div>';
    wireInvoiceActions(body, ctx, rows);
  }

  async function tabStripe(body, ctx, p) {
    var esc = ctx.esc;
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Conta Stripe do parceiro</h2><p>' + stripeOf(p) + '</p>' +
      '<dl class="kv" style="margin-top:1rem"><dt>Conta</dt><dd>' + (p.stripe_account_id ? '<code>' + esc(p.stripe_account_id) + '</code>' : '—') + '</dd><dt>Cadastro enviado</dt><dd>' + (p.stripe_details_submitted ? 'Sim' : 'Não') + '</dd>' +
      '<dt>Recebe repasses</dt><dd>' + (p.stripe_transfers_active ? 'Sim' : 'Não') + '</dd><dt>Saques para o banco</dt><dd>' + (p.stripe_payouts_enabled ? 'Sim' : 'Não') + '</dd></dl>' +
      '<p class="portal-muted">O próprio parceiro conecta a conta no Portal do Parceiro, em "Recebimentos Stripe". Se preferir, gere aqui um link de cadastro e envie para ele.</p>' +
      '<div class="portal-alert" id="ps-m" role="status"></div><div class="portal-btn-row"><button class="btn btn--navy" type="button" id="ps-link">Gerar link de cadastro Stripe</button>' + (p.stripe_account_id ? '<button class="btn btn--ghost" type="button" id="ps-ref">Atualizar status</button>' : '') + '</div></section>' +
      '<section class="portal-card" style="margin-top:1.25rem"><h2 class="portal-h2">Como o parceiro recebe</h2>' +
      '<dl class="kv"><dt>Forma escolhida</dt><dd>' + (p.payout_method === 'global_payouts' ? 'Stripe Global Payouts (conta fora dos EUA)' : p.payout_method === 'stripe' ? 'Stripe Connect (automático)' : 'Ainda não escolheu (no onboarding do portal)') + '</dd><dt>País da conta</dt><dd>' + esc(p.payout_country || '—') + '</dd>' +
      '<dt>Chave Pix (opcional)</dt><dd>' + (p.pix_key ? esc(p.pix_key) + ' <span class="portal-muted">(' + esc({ email: 'e-mail', phone: 'celular', random: 'aleatória' }[p.pix_key_type] || '') + ')</span>' : '—') + '</dd></dl>' +
      (p.payout_method === 'global_payouts' ? '<p class="portal-muted" style="font-size:.88rem">No painel do Stripe, em Global Payouts, cadastre o parceiro como destinatário pelo e-mail dele: o Stripe manda o link para ele informar o banco. Quando o cliente pagar, envie a comissão por lá e use "Marcar repasse feito" na fatura. Pagamentos em reais (BRL) dependem da liberação do Stripe.</p>' +
        '<div class="field" style="max-width:20rem"><label for="gp-st">Situação</label><select id="gp-st">' + Object.keys(GPS).filter(function (k) { return k !== 'none'; }).map(function (k) { return '<option value="' + k + '"' + (p.global_payouts_status === k ? ' selected' : '') + '>' + GPS[k] + '</option>'; }).join('') + '</select></div><div class="portal-alert" id="gp-m" role="status"></div>' +
        '<a class="btn btn--ghost btn--xs" href="https://dashboard.stripe.com/global-payouts" target="_blank" rel="noopener">Abrir Global Payouts no Stripe</a>' : '') + '</section>';
    var m = ctx.$('#ps-m');
    if (ctx.$('#gp-st')) ctx.$('#gp-st').onchange = async function () { var r = await ctx.sb.from('partners').update({ global_payouts_status: this.value }).eq('id', p.id); ctx.msg(ctx.$('#gp-m'), r.error ? ctx.errText(r.error) : 'Salvo.', r.error ? 'error' : 'ok'); if (!r.error) p.global_payouts_status = this.value; };
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
        var gp = i.partners && i.partners.payout_method === 'global_payouts';
        if (i.status === 'paid' && (i.transfer_status === 'pending' || i.transfer_status === 'failed') && gp) acts.push('<button class="btn btn--navy btn--xs" data-act="manual_paid" data-i="' + i.id + '">Marcar repasse feito</button>');
        else if (i.status === 'paid' && (i.transfer_status === 'pending' || i.transfer_status === 'failed')) acts.push(ready ? '<button class="btn btn--navy btn--xs" data-act="transfer" data-i="' + i.id + '">Repassar</button>' : '<span class="portal-muted" style="font-size:.82rem">Aguardando Stripe do parceiro</span>');
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
        if (b.dataset.act === 'manual_paid') {
          var note = prompt('Repasse feito fora do Stripe Connect (Global Payouts ou Pix). Anote uma referência (ex.: ID do pagamento no Stripe):', '');
          if (note === null) return;
          b.disabled = true;
          var ru = await ctx.sb.from('invoices').update({ transfer_status: 'paid', payout_channel: 'global_payouts', payout_note: note.trim().slice(0, 500) || null, payout_paid_at: new Date().toISOString() }).eq('id', b.dataset.i);
          if (ru.error) { b.disabled = false; return ctx.msg(ctx.$('#ia-' + b.dataset.i), ctx.errText(ru.error), 'error'); }
          return ctx.route();
        }
        b.disabled = true;
        try { await call(ctx, { action: b.dataset.act, invoice_id: b.dataset.i }); ctx.route(); }
        catch (x) { b.disabled = false; ctx.msg(ctx.$('#ia-' + b.dataset.i), errMsg(ctx, x), 'error'); }
      };
    });
  }

  async function payments(view, ctx) {
    var esc = ctx.esc, tab = param('tab') || 'faturas';
    var tabs = [['faturas', 'Faturas'], ['propostas', 'Propostas'], ['nova-proposta', 'Nova proposta'], ['modelos', 'Modelos de proposta'], ['nova', 'Nova fatura'], ['stripe', 'Conta Stripe']];
    view.innerHTML = head(esc, 'Pagamentos', 'Propostas, faturas pelo Stripe e repasse automático da comissão para o parceiro via Stripe Connect.', '<div class="portal-btn-row"><a class="btn btn--ghost" href="#/pagamentos?tab=nova-proposta">Nova proposta</a><a class="btn btn--navy" href="#/pagamentos?tab=nova">Nova fatura</a></div>') +
      '<nav class="subtabs" aria-label="Seções">' + tabs.map(function (t) { return '<a href="#/pagamentos?tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="pg-body"></div>';
    var body = ctx.$('#pg-body');
    if (tab === 'nova') return newInvoice(body, ctx);
    if (tab === 'propostas') return proposalsTab(body, ctx);
    if (tab === 'nova-proposta') return proposalForm(body, ctx, null);
    if (tab === 'modelos') return param('tpl') ? templateForm(body, ctx, param('tpl')) : templatesTab(body, ctx);
    if (tab === 'stripe') return stripeTab(body, ctx);
    var rows = await ctx.q(ctx.sb.from('invoices').select('*, clients(name), partners(name, stripe_transfers_active, payout_method)').order('created_at', { ascending: false }));
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
    var res = await Promise.all([ctx.q(sb.from('clients').select('id, name, primary_email').eq('status', 'active').order('name')), ctx.q(sb.from('partners').select('*').neq('status', 'suspended').eq('program_status', 'approved').order('name')),
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


  /* ================= Propostas ================= */
  var PS = { draft: 'Rascunho', sent: 'Enviada', accepted: 'Aceita', declined: 'Recusada', expired: 'Expirada', void: 'Anulada' };
  var PS_B = { draft: 'new', sent: 'contacted', accepted: 'client', declined: 'lost', expired: 'lost', void: 'lost' };
  var DEF_TERMS = { pt: 'Pagamento pelo portal do cliente (cartão, Pix ou transferência bancária). Taxas do governo incluídas quando indicado. Os serviços começam após a confirmação do pagamento.',
    en: 'Payment through the client portal (card, Pix or bank transfer). Government fees included where indicated. Work starts once payment is confirmed.',
    es: 'Pago en el portal del cliente (tarjeta, Pix o transferencia bancaria). Tasas del gobierno incluidas cuando se indica. Los servicios comienzan tras la confirmación del pago.' };
  function proposalEmail(lang, o) {
    var M = {
      pt: ['Olá ' + o.first + ',', '', 'Conforme conversamos, segue a proposta da Endeavor Business Solutions: "' + o.title + '".', '', 'O QUE ESTÁ INCLUSO', o.included.map(function (x) { return '- ' + x; }).join('\n'), '', 'INVESTIMENTO: ' + o.total, o.items, '',
        'Para aprovar, abra o link abaixo, confira os detalhes e clique em "Aceitar proposta":', o.link, '', 'A proposta vale até ' + o.valid + '.', 'Assim que você aceitar, enviamos automaticamente o link para criar o seu acesso ao portal do cliente e pagar a fatura (cartão, Pix ou transferência).', '', 'Dúvidas? support@endeavorbiz.com · WhatsApp +1 (630) 689-8702', 'Endeavor Business Solutions'],
      en: ['Hello ' + o.first + ',', '', 'As discussed, here is the Endeavor Business Solutions proposal: "' + o.title + '".', '', "WHAT'S INCLUDED", o.included.map(function (x) { return '- ' + x; }).join('\n'), '', 'INVESTMENT: ' + o.total, o.items, '',
        'To approve, open the link below, review the details and click "Accept proposal":', o.link, '', 'The proposal is valid until ' + o.valid + '.', 'As soon as you accept, we automatically send the link to create your client portal access and pay the invoice (card, Pix or bank transfer).', '', 'Questions? support@endeavorbiz.com · WhatsApp +1 (630) 689-8702', 'Endeavor Business Solutions'],
      es: ['Hola ' + o.first + ',', '', 'Como conversamos, le enviamos la propuesta de Endeavor Business Solutions: "' + o.title + '".', '', 'QUÉ INCLUYE', o.included.map(function (x) { return '- ' + x; }).join('\n'), '', 'INVERSIÓN: ' + o.total, o.items, '',
        'Para aprobar, abra el enlace, revise los detalles y haga clic en "Aceptar propuesta":', o.link, '', 'La propuesta es válida hasta ' + o.valid + '.', 'En cuanto acepte, le enviamos automáticamente el enlace para crear su acceso al portal del cliente y pagar la factura (tarjeta, Pix o transferencia).', '', '¿Dudas? support@endeavorbiz.com · WhatsApp +1 (630) 689-8702', 'Endeavor Business Solutions']
    };
    return (M[lang] || M.pt).filter(function (x, i, a) { return !(x === '' && a[i - 1] === ''); }).join('\n');
  }
  async function sendProposal(ctx, p, client) {
    var j = await call(ctx, { action: 'proposal_send', proposal_id: p.id });
    var lang = p.language || client.language || 'pt';
    var fresh = await ctx.q(ctx.sb.from('proposals').select('*').eq('id', p.id).single());
    var items = (p.items || []).map(function (i) { return '  ' + i.description + ((i.quantity || 1) > 1 ? ' (x' + i.quantity + ')' : '') + ': ' + money(i.amount_cents * (i.quantity || 1), p.currency); }).join('\n');
    var text = proposalEmail(lang, { first: (client.name || '').split(' ')[0], title: p.title, included: p.included || [], total: money(p.total_cents, p.currency), items: items, link: j.url, valid: fmtD(fresh.valid_until) });
    var subj = { pt: 'Proposta Endeavor: ', en: 'Endeavor proposal: ', es: 'Propuesta Endeavor: ' }[lang] + p.title;
    try {
      var r = await fetch(ctx.CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'Proposta enviada: ' + p.title + ' (' + client.name + ')', _template: 'table', _captcha: 'false', name: client.name, email: client.primary_email, proposta: p.title,
          total: money(p.total_cents, p.currency), link: j.url, _autoresponse: subj + '\n\n' + text }) });
      var k = await r.json().catch(function () { return {}; });
      return { url: j.url, mailed: r.ok && String(k.success) !== 'false' };
    } catch (e) { return { url: j.url, mailed: false }; }
  }

  async function proposalsTab(body, ctx) {
    var esc = ctx.esc;
    var rows = await ctx.q(ctx.sb.from('proposals').select('*, clients(name, primary_email, language), invoices!proposals_invoice_id_fkey(number, status)').order('created_at', { ascending: false }));
    body.innerHTML = '<p class="portal-muted">Fluxo: <strong>enviar a proposta</strong> → o cliente <strong>aceita pelo link</strong> → o sistema <strong>cria a fatura</strong>, libera o acesso ao portal e <strong>envia o e-mail</strong> com o link para criar o login e pagar → você recebe a confirmação do pagamento aqui e por e-mail.</p>' +
      (rows.length ? '<div class="table-wrap"><table class="data inv-table prop-table"><thead><tr><th>Proposta</th><th>Cliente</th><th class="num">Total</th><th>Status</th><th>Andamento</th><th>Ações</th></tr></thead><tbody>' +
        rows.map(function (p) {
          var prog = [p.sent_at ? 'Enviada ' + fmtD(p.sent_at) : '', p.viewed_at ? 'Vista ' + fmtD(p.viewed_at) : '', p.accepted_at ? 'Aceita ' + fmtD(p.accepted_at) + ' por ' + (p.accepted_name || '') : '', p.invoices ? 'Fatura ' + (p.invoices.number || '') + ' · ' + (IS[p.invoices.status] || '') : ''].filter(Boolean).join('<br>');
          var acts = [];
          if (p.status === 'draft' || p.status === 'sent' || p.status === 'expired') acts.push('<button class="btn btn--navy btn--xs" data-psend="' + p.id + '">' + (p.status === 'draft' ? 'Enviar' : 'Reenviar') + '</button>');
          if (p.token && p.status !== 'void') acts.push('<button class="btn btn--ghost btn--xs" data-plink="' + p.id + '">Link do cliente</button>');
          if (p.status === 'draft') acts.push('<a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=nova-proposta&id=' + p.id + '">Editar</a>');
          if (p.status === 'accepted' && !p.invoice_id) acts.push('<button class="btn btn--navy btn--xs" data-pinv="' + p.id + '">Gerar fatura</button>');
          if (p.status !== 'accepted' && p.status !== 'void') acts.push('<button class="btn btn--danger btn--xs" data-pvoid="' + p.id + '">Anular</button>');
          return '<tr><td><strong>' + esc(p.title) + '</strong><span class="sub">' + esc(fmtD(p.created_at)) + '</span></td><td>' + esc(p.clients ? p.clients.name : '') + '<span class="sub">' + esc(p.clients ? p.clients.primary_email : '') + '</span></td>' +
            '<td class="num">' + esc(money(p.total_cents, p.currency)) + '</td><td><span class="badge badge--' + PS_B[p.status] + '">' + PS[p.status] + '</span></td><td style="font-size:.85rem">' + prog + '</td>' +
            '<td><div class="portal-btn-row" style="flex-wrap:nowrap">' + acts.join('') + '</div><div class="portal-alert" id="pa-' + p.id + '" role="status"></div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty-state portal-card"><strong>Nenhuma proposta ainda</strong><p>Crie a proposta do pacote para o cliente em "Nova proposta".</p></div>');
    var find = function (id) { return rows.find(function (p) { return p.id === id; }); };
    body.querySelectorAll('[data-psend]').forEach(function (b) { b.onclick = async function () {
      var p = find(b.dataset.psend); b.disabled = true;
      try { var r = await sendProposal(ctx, p, p.clients); ctx.route(); if (!r.mailed) alert('A proposta foi marcada como enviada, mas o e-mail não saiu. Use "Link do cliente" para enviar manualmente.'); }
      catch (e) { b.disabled = false; ctx.msg(ctx.$('#pa-' + p.id), errMsg(ctx, e), 'error'); }
    }; });
    body.querySelectorAll('[data-plink]').forEach(function (b) { b.onclick = function () {
      var p = find(b.dataset.plink), url = ctx.siteUrl('proposal.html') + '?t=' + p.token + '&lang=' + p.language, m = ctx.$('#pa-' + p.id);
      m.className = 'portal-alert portal-alert--info'; m.innerHTML = '<a href="' + esc(url) + '" target="_blank" rel="noopener" data-open-proposal="' + esc(p.token) + '">Abrir</a> · <button class="btn btn--ghost btn--xs" type="button">Copiar</button>';
      m.querySelector('button').onclick = function () { ctx.copy(url, this); };
    }; });
    body.querySelectorAll('[data-pinv]').forEach(function (b) { b.onclick = async function () {
      b.disabled = true;
      try { await call(ctx, { action: 'proposal_invoice', proposal_id: b.dataset.pinv }); ctx.route(); } catch (e) { b.disabled = false; ctx.msg(ctx.$('#pa-' + b.dataset.pinv), errMsg(ctx, e), 'error'); }
    }; });
    body.querySelectorAll('[data-pvoid]').forEach(function (b) { b.onclick = async function () {
      if (!confirm('Anular esta proposta? O link deixa de funcionar.')) return;
      await ctx.sb.from('proposals').update({ status: 'void' }).eq('id', b.dataset.pvoid); ctx.route();
    }; });
  }

  async function proposalForm(body, ctx) {
    var esc = ctx.esc, sb = ctx.sb, editId = param('id');
    var res = await Promise.all([ctx.q(sb.from('clients').select('id, name, primary_email, language, status').in('status', ['active', 'prospect']).order('name')), ctx.q(sb.from('partners').select('*').neq('status', 'suspended').eq('program_status', 'approved').order('name')),
      ctx.q(sb.from('referrals').select('id, partner_id, client_id').not('client_id', 'is', null)), ctx.q(sb.from('stripe_settings').select('*').eq('id', 1).single()),
      editId ? ctx.q(sb.from('proposals').select('*').eq('id', editId).single()) : Promise.resolve(null),
      ctx.q(sb.from('proposal_templates').select('*').eq('archived', false).order('name'))]);
    var clients = res[0], partners = res[1], refs = res[2], cfg = res[3], ed = res[4], tpls = res[5];
    var pre = ed ? ed.client_id : param('client');
    body.innerHTML = '<div class="dash"><section class="portal-card"><div class="tpl-pick"><div class="field"><label for="pp-tpl">Começar de um modelo</label><select id="pp-tpl"><option value="">Selecione o modelo da proposta</option>' +
        Object.keys(STRUCT).map(function (k) { var g = tpls.filter(function (t) { return t.structure === k; }); return g.length ? '<optgroup label="' + esc(STRUCT[k]) + '">' + g.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') +
        '</select></div><button class="btn btn--navy" type="button" id="pp-apply">Usar modelo</button><a class="btn btn--ghost" href="#/pagamentos?tab=modelos">Gerenciar modelos</a></div>' +
      '<p class="portal-muted" id="pp-tplmsg" style="font-size:.85rem;margin:-.25rem 0 1rem">O modelo preenche título, apresentação, o que está incluso, itens, valores e condições. Cliente e parceiro continuam como estão, e você pode ajustar tudo antes de enviar.</p>' +
      '<form class="portal-form" id="pp" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="pp-client">Cliente ou prospect</label><select id="pp-client" required><option value="">Selecione</option>' + clients.map(function (c) { return '<option value="' + c.id + '"' + (pre === c.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.primary_email) + ')' + (c.status === 'prospect' ? ' · prospect' : '') + '</option>'; }).join('') + '</select>' +
        '<p class="portal-muted" style="font-size:.82rem;margin:.3rem 0 0">Prospect vira cliente, com acesso ao portal, só quando aceitar a proposta.</p></div>' +
      '<div class="field"><label for="pp-lang">Idioma da proposta</label><select id="pp-lang"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div></div>' +
      '<div class="field"><label for="pp-title">Título do pacote</label><input id="pp-title" maxlength="200" placeholder="Ex.: Pacote Abertura de LLC na Flórida" value="' + esc(ed ? ed.title : '') + '"></div>' +
      '<div class="field"><label for="pp-intro">Apresentação (opcional)</label><textarea id="pp-intro" rows="3" maxlength="4000">' + esc(ed ? ed.intro || '' : '') + '</textarea></div>' +
      '<div class="field"><label for="pp-inc">O que está incluso (um item por linha)</label><textarea id="pp-inc" rows="5" maxlength="4000" placeholder="Registro da LLC na Sunbiz&#10;EIN no IRS&#10;Registered Agent por 12 meses&#10;Operating Agreement">' + esc(ed ? (ed.included || []).join('\n') : '') + '</textarea></div>' +
      '<fieldset class="perm-box"><legend>Valores</legend><div class="inv-items" id="pp-items"></div><button class="btn btn--ghost btn--xs" type="button" id="pp-add" style="justify-self:start;margin-top:.5rem">+ Item</button></fieldset>' +
      '<div class="portal-grid2"><div class="field"><label for="pp-valid">Validade da proposta (dias)</label><input id="pp-valid" type="number" min="1" max="120" value="30"></div><div class="field"><label for="pp-days">Vencimento da fatura após o aceite (dias)</label><input id="pp-days" type="number" min="0" max="90" value="' + esc(String(ed ? ed.days_until_due : cfg.default_days_until_due)) + '"></div></div>' +
      '<div class="field"><label for="pp-terms">Condições</label><textarea id="pp-terms" rows="3" maxlength="2000"></textarea></div>' +
      '<fieldset class="perm-box"><legend>Parceiro (comissão na fatura)</legend><div class="portal-grid2"><div class="field"><label for="pp-partner">Parceiro</label><select id="pp-partner"><option value="">Sem parceiro</option>' + partners.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + (p.company ? ' · ' + esc(p.company) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="pp-pct">Comissão (%)</label><input id="pp-pct" type="number" min="0" max="100" step="0.5" disabled></div></div></fieldset>' +
      '<div class="portal-alert" id="pp-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit" data-send="1">Salvar e enviar ao cliente</button><button class="btn btn--ghost" type="submit" data-send="0">Salvar rascunho</button><button class="btn btn--ghost" type="button" id="pp-savetpl">Salvar como modelo</button></div></form></section>' +
      '<aside class="portal-card"><h2 class="portal-h2">Resumo</h2><div class="split-box"><dl class="split-sum" id="pp-sum"></dl></div><h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">O que acontece depois</h3><ol class="steps-ol" style="font-size:.88rem">' +
      '<li>O cliente recebe o e-mail com a proposta e o link para aceitar.</li><li>Ao aceitar, o sistema cria a fatura no Stripe e libera o acesso ao portal.</li><li>O cliente recebe na hora o e-mail de confirmação com o link para criar login e senha.</li><li>Ele entra direto na página de faturas e paga (cartão, Pix ou transferência).</li><li>Você recebe o aviso do pagamento aqui no console e por e-mail; a cópia da fatura fica no histórico do cliente.</li></ol></aside></div>';
    var box = ctx.$('#pp-items');
    var addItem = function (d, amt, qty) {
      var n = box.children.length, div = document.createElement('div'); div.className = 'inv-item';
      div.innerHTML = '<div class="field"><label for="pi-d' + n + '">Descrição</label><input id="pi-d' + n + '" data-d maxlength="300" value="' + esc(d || '') + '"></div><div class="field"><label for="pi-q' + n + '">Qtd</label><input id="pi-q' + n + '" data-q type="number" min="1" max="1000" value="' + (qty || 1) + '"></div>' +
        '<div class="field"><label for="pi-a' + n + '">Valor (US$)</label><input id="pi-a' + n + '" data-a type="number" min="0" step="0.01" value="' + (amt != null ? amt : '') + '"></div><button class="btn btn--ghost btn--xs" type="button" aria-label="Remover item" data-rm>×</button>';
      box.appendChild(div); div.querySelector('[data-rm]').onclick = function () { if (box.children.length > 1) { div.remove(); calc(); } };
      div.querySelectorAll('input').forEach(function (i) { i.oninput = calc; });
    };
    var items = function () { return Array.prototype.map.call(box.children, function (r) { return { description: r.querySelector('[data-d]').value.trim(), quantity: +r.querySelector('[data-q]').value || 1, amount_cents: Math.round((+r.querySelector('[data-a]').value || 0) * 100) }; }).filter(function (i) { return i.description || i.amount_cents; }); };
    var calc = function () {
      var tot = items().reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0), pid = ctx.$('#pp-partner').value, pct = pid ? +ctx.$('#pp-pct').value || 0 : 0;
      ctx.$('#pp-sum').innerHTML = '<dt>Total da proposta</dt><dd class="is-total">' + money(tot) + '</dd>' + (pid ? '<dt>Comissão do parceiro (' + pct + '%)</dt><dd>' + money(Math.round(tot * pct / 100)) + '</dd>' : '');
    };
    var pickPartner = function (pid, pct) { var p = partners.find(function (x) { return x.id === pid; }); ctx.$('#pp-partner').value = p ? p.id : ''; ctx.$('#pp-pct').disabled = !p; ctx.$('#pp-pct').value = p ? (pct != null ? +pct : +p.default_share_pct) : ''; calc(); };
    var setLang = function (cid) { var c = clients.find(function (x) { return x.id === cid; }); if (c && !ed) { ctx.$('#pp-lang').value = c.language || 'pt'; ctx.$('#pp-terms').value = DEF_TERMS[c.language] || DEF_TERMS.pt; } };
    (ed && ed.items.length ? ed.items : [{}]).forEach(function (i) { addItem(i.description, i.amount_cents != null ? i.amount_cents / 100 : null, i.quantity); });
    ctx.$('#pp-terms').value = ed ? ed.terms || '' : DEF_TERMS.pt;
    if (ed) ctx.$('#pp-lang').value = ed.language;
    ctx.$('#pp-add').onclick = function () { addItem(); box.lastChild.querySelector('input').focus(); };
    var applyTpl = function (t) {
      ctx.$('#pp-title').value = t.title || ''; ctx.$('#pp-intro').value = t.intro || ''; ctx.$('#pp-inc').value = (t.included || []).join('\n'); ctx.$('#pp-terms').value = t.terms || '';
      ctx.$('#pp-lang').value = t.language || 'pt'; ctx.$('#pp-days').value = t.days_until_due; ctx.$('#pp-valid').value = t.valid_days;
      box.innerHTML = ''; (t.items && t.items.length ? t.items : [{}]).forEach(function (i) { addItem(i.description, i.amount_cents != null ? i.amount_cents / 100 : null, i.quantity); });
      calc();
      var empty = (t.items || []).some(function (i) { return i.amount_cents == null; });
      ctx.msg(ctx.$('#pp-tplmsg'), 'Modelo "' + t.name + '" aplicado.' + (empty ? ' Preencha os valores que estão em branco.' : ' Confira os valores e ajuste o que precisar.'), 'ok');
      var f = box.querySelector(empty ? '[data-a]' : '#pp-title'); if (empty) { var blank = Array.prototype.find.call(box.querySelectorAll('[data-a]'), function (x) { return !x.value; }); if (blank) blank.focus(); } else if (f) f.focus();
    };
    ctx.$('#pp-apply').onclick = function () {
      var t = tpls.find(function (x) { return x.id === ctx.$('#pp-tpl').value; });
      if (!t) return ctx.msg(ctx.$('#pp-tplmsg'), 'Selecione um modelo na lista.', 'error');
      var dirty = ctx.$('#pp-title').value.trim() || items().some(function (i) { return i.amount_cents; });
      if (dirty && !confirm('Substituir o conteúdo atual da proposta pelo modelo "' + t.name + '"?')) return;
      applyTpl(t);
    };
    ctx.$('#pp-savetpl').onclick = async function () {
      var name = prompt('Nome do modelo (ex.: LLC Flórida - sócio estrangeiro):', ctx.$('#pp-title').value.trim()); if (!name || name.trim().length < 2) return;
      var u = (await sb.auth.getUser()).data.user;
      var r = await sb.from('proposal_templates').insert({ name: name.trim(), structure: 'other', language: ctx.$('#pp-lang').value, title: ctx.$('#pp-title').value.trim() || name.trim(), intro: ctx.$('#pp-intro').value.trim() || null,
        included: ctx.$('#pp-inc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), items: items().map(function (i) { return { description: i.description, quantity: i.quantity, amount_cents: i.amount_cents || null }; }),
        terms: ctx.$('#pp-terms').value.trim() || null, days_until_due: +ctx.$('#pp-days').value || 0, valid_days: +ctx.$('#pp-valid').value || 30, created_by: u && u.email }).select('*').single();
      if (r.error) return ctx.msg(ctx.$('#pp-m'), ctx.errText(r.error), 'error');
      tpls.push(r.data); ctx.msg(ctx.$('#pp-m'), 'Modelo "' + r.data.name + '" salvo. Ajuste o tipo de estrutura em Modelos de proposta.', 'ok');
    };
    ctx.$('#pp-partner').onchange = function () { pickPartner(this.value); };
    ctx.$('#pp-pct').oninput = calc;
    var refFor = function (cid) { return refs.find(function (r) { return r.client_id === cid; }); };
    ctx.$('#pp-client').onchange = function () { setLang(this.value); var r = refFor(this.value); pickPartner(r ? r.partner_id : ''); };
    if (ed) pickPartner(ed.partner_id, ed.partner_pct); else if (pre) { setLang(pre); var r0 = refFor(pre); if (r0) pickPartner(r0.partner_id); }
    calc();
    var preTpl = param('template'); if (preTpl && !ed) { var t0 = tpls.find(function (x) { return x.id === preTpl; }); if (t0) { ctx.$('#pp-tpl').value = t0.id; applyTpl(t0); } }
    var sendFlag = true;
    ctx.$('#pp').querySelectorAll('button[type=submit]').forEach(function (b) { b.onclick = function () { sendFlag = b.dataset.send === '1'; }; });
    ctx.$('#pp').onsubmit = async function (e) {
      e.preventDefault();
      var cid = ctx.$('#pp-client').value, its = items(), title = ctx.$('#pp-title').value.trim(), m = ctx.$('#pp-m');
      if (!cid) return ctx.msg(m, 'Selecione o cliente.', 'error');
      if (title.length < 2) return ctx.msg(m, 'Dê um título ao pacote.', 'error');
      if (!its.length || its.some(function (i) { return !i.description || i.amount_cents < 1; })) return ctx.msg(m, ERR.invalid_items, 'error');
      var pid = ctx.$('#pp-partner').value, r = refFor(cid), total = its.reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0);
      var valid = new Date(Date.now() + (+ctx.$('#pp-valid').value || 30) * 864e5).toISOString().slice(0, 10);
      var row = { client_id: cid, title: title, intro: ctx.$('#pp-intro').value.trim() || null, included: ctx.$('#pp-inc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
        items: its, total_cents: total, terms: ctx.$('#pp-terms').value.trim() || null, language: ctx.$('#pp-lang').value, days_until_due: +ctx.$('#pp-days').value || 0, valid_until: valid,
        partner_id: pid || null, partner_pct: pid ? +ctx.$('#pp-pct').value : null, referral_id: r && r.partner_id === pid ? r.id : null };
      var btns = this.querySelectorAll('button'); btns.forEach(function (b) { b.disabled = true; });
      var u = (await sb.auth.getUser()).data.user;
      var saved = ed ? await sb.from('proposals').update(row).eq('id', ed.id).select('*').single() : await sb.from('proposals').insert(Object.assign({ created_by: u && u.email }, row)).select('*').single();
      if (saved.error) { btns.forEach(function (b) { b.disabled = false; }); return ctx.msg(m, ctx.errText(saved.error), 'error'); }
      if (sendFlag) {
        ctx.msg(m, 'Enviando a proposta…', 'info');
        try { var sr = await sendProposal(ctx, saved.data, clients.find(function (c) { return c.id === cid; })); if (!sr.mailed) alert('Proposta salva, mas o e-mail não saiu. Use "Link do cliente" na lista para enviar manualmente.'); }
        catch (x) { btns.forEach(function (b) { b.disabled = false; }); return ctx.msg(m, errMsg(ctx, x), 'error'); }
      }
      ERoute.go('#/pagamentos?tab=propostas');
    };
  }


  /* ================= Modelos de proposta ================= */
  var STRUCT = { llc_foreign: 'LLC - sócio estrangeiro', llc_single: 'LLC - sócio único (EUA)', llc_multi: 'LLC - vários sócios', c_corp: 'C-Corporation', s_corp: 'S-Corporation', registered_agent: 'Manutenção anual', tax: 'Impostos', bookkeeping: 'Contabilidade', real_estate: 'Imóveis', paraguay: 'Paraguai', other: 'Outros' };
  async function templatesTab(body, ctx) {
    var esc = ctx.esc;
    var tpls = await ctx.q(ctx.sb.from('proposal_templates').select('*').eq('archived', false).order('name'));
    var total = function (t) { var c = (t.items || []).reduce(function (s, i) { return s + (i.amount_cents || 0) * (i.quantity || 1); }, 0), blank = (t.items || []).some(function (i) { return i.amount_cents == null; }); return c ? money(c) + (blank ? ' + itens a definir' : '') : 'Valores a definir'; };
    body.innerHTML = '<div class="toolbar" style="justify-content:space-between;align-items:center"><p class="portal-muted" style="margin:0">Modelos por tipo de estrutura. Ao criar a proposta, escolha o modelo e ele já sobe com o pacote completo.</p><a class="btn btn--navy" href="#/pagamentos?tab=modelos&tpl=novo">Novo modelo</a></div>' +
      (tpls.length ? (function () {
        var g = []; Object.keys(STRUCT).forEach(function (k) { g = g.concat(tpls.filter(function (t) { return t.structure === k; })); });
        return '<div class="tpl-grid" style="margin-top:1rem">' + g.map(function (t) {
          return '<article class="tpl-card"><div><span class="tpl-chip">' + esc(STRUCT[t.structure] || STRUCT.other) + '</span><strong>' + esc(t.name) + '</strong><span class="portal-muted">' + esc(t.title) + '</span></div>' +
            '<ul>' + (t.included || []).slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + ((t.included || []).length > 4 ? '<li>+ ' + ((t.included || []).length - 4) + ((t.included || []).length - 4 === 1 ? ' item' : ' itens') + '</li>' : '') + '</ul>' +
            '<div class="tpl-card__foot"><span><b>' + esc(total(t)) + '</b> · ' + esc((t.language || 'pt').toUpperCase()) + '</span><div class="portal-btn-row" style="flex-wrap:nowrap"><a class="btn btn--navy btn--xs" href="#/pagamentos?tab=nova-proposta&template=' + t.id + '">Usar</a><a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=modelos&tpl=' + t.id + '">Editar</a><button class="btn btn--ghost btn--xs" type="button" data-dup="' + t.id + '">Duplicar</button></div></div></article>';
        }).join('') + '</div>';
      })() : '<div class="empty-state portal-card"><strong>Nenhum modelo ainda</strong><p>Crie modelos para os pacotes que você mais vende.</p></div>');
    body.querySelectorAll('[data-dup]').forEach(function (b) { b.onclick = async function () {
      var t = tpls.find(function (x) { return x.id === b.dataset.dup; }), c = Object.assign({}, t); delete c.id; delete c.created_at; delete c.updated_at; c.name = (t.name + ' (cópia)').slice(0, 120);
      var r = await ctx.sb.from('proposal_templates').insert(c).select('id').single(); if (!r.error) ERoute.go('#/pagamentos?tab=modelos&tpl=' + r.data.id);
    }; });
  }
  async function templateForm(body, ctx, id) {
    var esc = ctx.esc, sb = ctx.sb, isNew = id === 'novo';
    var t = isNew ? { name: '', structure: 'llc_foreign', language: 'pt', title: '', intro: '', included: [], items: [{}], terms: DEF_TERMS.pt, days_until_due: 7, valid_days: 30 } : await ctx.q(sb.from('proposal_templates').select('*').eq('id', id).single());
    body.innerHTML = '<p><a href="#/pagamentos?tab=modelos">← Modelos de proposta</a></p><section class="portal-card" style="max-width:52rem"><h2 class="portal-h2">' + (isNew ? 'Novo modelo' : 'Editar modelo') + '</h2><form class="portal-form" id="tf" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="tf-name">Nome do modelo</label><input id="tf-name" maxlength="120" value="' + esc(t.name) + '" placeholder="Ex.: LLC Flórida - sócio estrangeiro"></div>' +
      '<div class="field"><label for="tf-struct">Tipo de estrutura</label><select id="tf-struct">' + Object.keys(STRUCT).map(function (k) { return '<option value="' + k + '"' + (t.structure === k ? ' selected' : '') + '>' + STRUCT[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="tf-lang">Idioma</label><select id="tf-lang"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div>' +
      '<div class="field"><label for="tf-days">Vencimento da fatura (dias)</label><input id="tf-days" type="number" min="0" max="90" value="' + t.days_until_due + '"></div></div>' +
      '<div class="field"><label for="tf-title">Título que o cliente vê</label><input id="tf-title" maxlength="200" value="' + esc(t.title) + '"></div>' +
      '<div class="field"><label for="tf-intro">Apresentação</label><textarea id="tf-intro" rows="3" maxlength="4000">' + esc(t.intro || '') + '</textarea></div>' +
      '<div class="field"><label for="tf-inc">O que está incluso (um item por linha)</label><textarea id="tf-inc" rows="6" maxlength="4000">' + esc((t.included || []).join('\n')) + '</textarea></div>' +
      '<fieldset class="perm-box"><legend>Itens e valores (deixe o valor em branco para preencher em cada proposta)</legend><div class="inv-items" id="tf-items"></div><button class="btn btn--ghost btn--xs" type="button" id="tf-add" style="justify-self:start;margin-top:.5rem">+ Item</button></fieldset>' +
      '<div class="portal-grid2"><div class="field"><label for="tf-valid">Validade padrão da proposta (dias)</label><input id="tf-valid" type="number" min="1" max="120" value="' + t.valid_days + '"></div></div>' +
      '<div class="field"><label for="tf-terms">Condições</label><textarea id="tf-terms" rows="3" maxlength="2000">' + esc(t.terms || '') + '</textarea></div>' +
      '<div class="portal-alert" id="tf-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar modelo</button>' + (isNew ? '' : '<a class="btn btn--ghost" href="#/pagamentos?tab=nova-proposta&template=' + t.id + '">Usar em nova proposta</a><button class="btn btn--danger" type="button" id="tf-arch">Excluir modelo</button>') + '</div></form></section>';
    ctx.$('#tf-lang').value = t.language || 'pt';
    var box = ctx.$('#tf-items');
    var addItem = function (d, amt, qty) {
      var n = box.children.length, div = document.createElement('div'); div.className = 'inv-item';
      div.innerHTML = '<div class="field"><label for="ti-d' + n + '">Descrição</label><input id="ti-d' + n + '" data-d maxlength="300" value="' + esc(d || '') + '"></div><div class="field"><label for="ti-q' + n + '">Qtd</label><input id="ti-q' + n + '" data-q type="number" min="1" max="1000" value="' + (qty || 1) + '"></div>' +
        '<div class="field"><label for="ti-a' + n + '">Valor (US$)</label><input id="ti-a' + n + '" data-a type="number" min="0" step="0.01" value="' + (amt != null ? amt : '') + '" placeholder="a definir"></div><button class="btn btn--ghost btn--xs" type="button" aria-label="Remover item" data-rm>×</button>';
      box.appendChild(div); div.querySelector('[data-rm]').onclick = function () { if (box.children.length > 1) div.remove(); };
    };
    (t.items && t.items.length ? t.items : [{}]).forEach(function (i) { addItem(i.description, i.amount_cents != null ? i.amount_cents / 100 : null, i.quantity); });
    ctx.$('#tf-add').onclick = function () { addItem(); box.lastChild.querySelector('input').focus(); };
    if (ctx.$('#tf-arch')) ctx.$('#tf-arch').onclick = async function () { if (!confirm('Excluir este modelo? Propostas já criadas não mudam.')) return; await sb.from('proposal_templates').update({ archived: true }).eq('id', t.id); ERoute.go('#/pagamentos?tab=modelos'); };
    ctx.$('#tf').onsubmit = async function (e) {
      e.preventDefault();
      var v = function (x) { return ctx.$('#' + x).value.trim(); }, m = ctx.$('#tf-m');
      var its = Array.prototype.map.call(box.children, function (r) { var a = r.querySelector('[data-a]').value; return { description: r.querySelector('[data-d]').value.trim(), quantity: +r.querySelector('[data-q]').value || 1, amount_cents: a === '' ? null : Math.round(+a * 100) }; }).filter(function (i) { return i.description; });
      if (v('tf-name').length < 2 || v('tf-title').length < 2) return ctx.msg(m, 'Dê um nome ao modelo e um título para o cliente.', 'error');
      var row = { name: v('tf-name'), structure: v('tf-struct'), language: v('tf-lang'), title: v('tf-title'), intro: v('tf-intro') || null, included: ctx.$('#tf-inc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
        items: its, terms: v('tf-terms') || null, days_until_due: +v('tf-days') || 0, valid_days: +v('tf-valid') || 30 };
      var u = (await sb.auth.getUser()).data.user;
      var r = isNew ? await sb.from('proposal_templates').insert(Object.assign({ created_by: u && u.email }, row)) : await sb.from('proposal_templates').update(row).eq('id', t.id);
      if (r.error) return ctx.msg(m, ctx.errText(r.error), 'error');
      ERoute.go('#/pagamentos?tab=modelos');
    };
  }

  /* ================= notifications (bell in the top bar) ================= */
  var EVK = { lead_chat: 'Chat do site', proposal_accepted: 'Proposta aceita', payment_received: 'Pagamento recebido', payment_failed: 'Pagamento recusado', referral_new: 'Nova indicação', oa_review: 'Operating Agreement', oa_client: 'Operating Agreement', oa_signature: 'Assinatura', oa_archived: 'Arquivado', booking_new: 'Agenda', booking_cancelled: 'Agenda', booking_rescheduled: 'Agenda', partner_new: 'Parceiros', partner_contract: 'Contrato' };
  function bell(ctx) {
    var host = document.getElementById('topbar-user'); if (!host || document.getElementById('notif-btn')) return;
    var btn = document.createElement('button'); btn.type = 'button'; btn.id = 'notif-btn'; btn.className = 'notif-btn'; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 20a2 2 0 004 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span class="sr-only">Notificações</span><span class="notif-btn__n" hidden></span>';
    host.insertBefore(btn, host.firstChild);
    var pop = null, events = [];
    var load = async function () {
      var r = await ctx.sb.from('admin_events').select('*').order('at', { ascending: false }).limit(15);
      events = r.data || []; var n = events.filter(function (e) { return !e.read_at; }).length, b = btn.querySelector('.notif-btn__n');
      b.hidden = !n; b.textContent = n > 9 ? '9+' : n; btn.querySelector('.sr-only').textContent = 'Notificações' + (n ? ' (' + n + ' novas)' : '');
    };
    var close = function () { if (pop) { pop.remove(); pop = null; btn.setAttribute('aria-expanded', 'false'); } };
    btn.onclick = async function (e) {
      e.stopPropagation(); if (pop) return close();
      await load();
      pop = document.createElement('div'); pop.className = 'notif-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Notificações');
      pop.innerHTML = '<h2>Notificações <button class="btn btn--ghost btn--xs" type="button" data-readall>Marcar como lidas</button></h2><ul class="notif-list">' +
        (events.length ? events.map(function (ev) { return '<li class="' + (ev.read_at ? '' : 'is-new') + '"><a href="' + ctx.esc(ev.link || '#/dashboard') + '" data-ev="' + ev.id + '"><span class="ev-k ev-k--' + ev.kind + '">' + EVK[ev.kind] + '</span><strong>' + ctx.esc(ev.title) + '</strong>' + (ev.body ? '<span>' + ctx.esc(ev.body) + '</span>' : '') + '<small>' + ctx.esc(ctx.fmtDT(ev.at)) + '</small></a></li>'; }).join('') : '<li class="portal-muted" style="padding:.75rem">Nada por aqui ainda.</li>') + '</ul>';
      document.querySelector('.portal-top').appendChild(pop); btn.setAttribute('aria-expanded', 'true');
      pop.onclick = function (x) { x.stopPropagation(); };
      pop.querySelector('[data-readall]').onclick = async function () { await ctx.sb.from('admin_events').update({ read_at: new Date().toISOString() }).is('read_at', null); close(); load(); };
      pop.querySelectorAll('[data-ev]').forEach(function (a) { a.addEventListener('click', function () { ctx.sb.from('admin_events').update({ read_at: new Date().toISOString() }).eq('id', a.dataset.ev).then(function () { load(); }); close(); }); });
    };
    document.addEventListener('click', close); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) { close(); btn.focus(); } });
    load(); setInterval(load, 60000);
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
      '<li>Crie também <code>STRIPE_PUBLISHABLE_KEY</code> com a <strong>Publishable key</strong> (<code>pk_test_…</code>). Ela liga o checkout dentro do Portal do Cliente.</li>' +
      '<li>Em <strong>Settings → Payment methods</strong>, ative as formas de pagamento: cartões, Apple Pay e Google Pay, Link, transferência bancária dos EUA (ACH) e <strong>Pix</strong> (para clientes no Brasil; o Stripe cobra o IOF do pagador por padrão). Confira também em <strong>Settings → Invoices</strong> as formas aceitas nas faturas.</li>' +
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
    payments: payments,
    bell: bell
  };
})();
