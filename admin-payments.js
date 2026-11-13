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
  /* ---------- saved services (dropdown on each item + "Salvar na lista") ---------- */
  async function loadVendors(ctx) { try { return await ctx.q(ctx.sb.from('vendors').select('*').order('name')); } catch (e) { return []; } }
  async function loadServices(ctx) { try { return await ctx.q(ctx.sb.from('billing_services').select('*').eq('active', true).order('name')); } catch (e) { return []; } }
  function itemEditor(ctx, box, services, opts) {
    var esc = ctx.esc, monthly = !!(opts && opts.monthly), onChange = (opts && opts.onChange) || function () {}, seq = 0, vendors = (opts && opts.vendors) || [];
    var vendOptions = function () { return '<option value="">Sem fornecedor</option>' + vendors.filter(function (v) { return v.active; }).map(function (v) { return '<option value="' + v.id + '">' + esc(v.name) + '</option>'; }).join(''); };
    var svcOptions = function (rec) {
      var list = services.filter(function (s) { return monthly || s.recurring !== 'month'; });
      return '<option value="">Serviço salvo…</option>' + list.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + (s.amount_cents ? ' · ' + esc(money(s.amount_cents)) : '') + (s.recurring === 'month' ? ' /mês' : '') + '</option>'; }).join('');
    };
    var refresh = function () { box.querySelectorAll('[data-svc]').forEach(function (sel) { var v = sel.value; sel.innerHTML = svcOptions(); sel.value = v; }); };
    var add = function (d, amt, qty, rec, vend, cost) {
      var n = ++seq, div = document.createElement('div'); div.className = 'inv-item inv-item--svc' + (monthly ? ' inv-item--rec' : '');
      div.innerHTML = '<div class="field inv-item__svc"><label for="sv' + n + '">Lista de serviços</label><select id="sv' + n + '" data-svc>' + svcOptions() + '</select></div>' +
        '<div class="field"><label for="it-d' + n + '">Descrição</label><input id="it-d' + n + '" data-d maxlength="300" value="' + esc(d || '') + '"></div>' +
        '<div class="field"><label for="it-q' + n + '">Qtd</label><input id="it-q' + n + '" data-q type="number" min="1" max="1000" value="' + (qty || 1) + '"></div>' +
        '<div class="field"><label for="it-a' + n + '">Valor (US$)</label><input id="it-a' + n + '" data-a type="number" min="0" step="0.01" value="' + (amt != null && amt !== '' ? amt : '') + '"></div>' +
        (monthly ? '<div class="check-row inv-item__rec"><input type="checkbox" id="it-m' + n + '" data-m' + (rec === 'month' ? ' checked' : '') + '><label for="it-m' + n + '">Mensal</label></div>' : '') +
        '<div class="field inv-item__vend"><label for="it-v' + n + '">Fornecedor que faz o serviço <span class="portal-muted">(interno)</span></label><select id="it-v' + n + '" data-v>' + vendOptions() + '</select></div>' +
        '<div class="field inv-item__cost"><label for="it-c' + n + '">Custo do fornecedor (US$)</label><input id="it-c' + n + '" data-c type="number" min="0" step="0.01" value="' + (cost ? (cost / 100).toFixed(2) : '') + '"' + (vend ? '' : ' disabled') + '></div>' +
        '<div class="inv-item__acts"><button class="btn btn--ghost btn--xs" type="button" data-save title="Salvar esta descrição e valor na lista de serviços">Salvar na lista</button><button class="btn btn--ghost btn--xs" type="button" aria-label="Remover item" data-rm>×</button></div>';
      box.appendChild(div);
      if (vend) div.querySelector('[data-v]').value = vend;
      div.querySelector('[data-v]').onchange = function () { var c = div.querySelector('[data-c]'); c.disabled = !this.value; if (!this.value) c.value = ''; else c.focus(); onChange(); };
      div.querySelector('[data-rm]').onclick = function () { if (box.children.length > 1) { div.remove(); onChange(); } };
      div.querySelectorAll('input').forEach(function (i) { i.oninput = onChange; i.onchange = onChange; });
      div.querySelector('[data-svc]').onchange = function () {
        var s = services.find(function (x) { return x.id === this.value; }, this); if (!s) return;
        div.querySelector('[data-d]').value = s.name; if (s.amount_cents) div.querySelector('[data-a]').value = (s.amount_cents / 100).toFixed(2);
        if (monthly) div.querySelector('[data-m]').checked = s.recurring === 'month';
        div.querySelector('[data-v]').value = s.vendor_id || ''; div.querySelector('[data-c]').disabled = !s.vendor_id; div.querySelector('[data-c]').value = s.vendor_id && s.vendor_cost_cents ? (s.vendor_cost_cents / 100).toFixed(2) : '';
        onChange();
      };
      div.querySelector('[data-save]').onclick = async function () {
        var b = this, name = div.querySelector('[data-d]').value.trim(), cents = Math.round((+div.querySelector('[data-a]').value || 0) * 100), rec = monthly && div.querySelector('[data-m]').checked ? 'month' : 'none';
        if (name.length < 2) { div.querySelector('[data-d]').focus(); return; }
        b.disabled = true;
        var u = (await ctx.sb.auth.getUser()).data.user;
        var vid = div.querySelector('[data-v]').value || null, vc = vid ? Math.round((+div.querySelector('[data-c]').value || 0) * 100) : 0;
        var r = await ctx.sb.from('billing_services').upsert({ name: name, amount_cents: cents, recurring: rec, active: true, created_by: u && u.email, vendor_id: vid, vendor_cost_cents: vc }, { onConflict: 'name,recurring' }).select('*').single();
        b.disabled = false;
        if (r.error) { b.textContent = 'Erro'; return; }
        var i = services.findIndex(function (x) { return x.id === r.data.id; }); if (i > -1) services[i] = r.data; else services.push(r.data);
        services.sort(function (a, c) { return a.name.localeCompare(c.name); }); refresh(); div.querySelector('[data-svc]').value = r.data.id;
        b.textContent = 'Salvo ✓'; setTimeout(function () { b.textContent = 'Salvar na lista'; }, 1800);
      };
      return div;
    };
    var items = function () {
      return Array.prototype.map.call(box.children, function (r) {
        var o = { description: r.querySelector('[data-d]').value.trim(), quantity: +r.querySelector('[data-q]').value || 1, amount_cents: Math.round((+r.querySelector('[data-a]').value || 0) * 100) };
        if (monthly && r.querySelector('[data-m]').checked) o.recurring = 'month';
        var v = r.querySelector('[data-v]').value, c = Math.round((+r.querySelector('[data-c]').value || 0) * 100);
        o.vendor_id = v && c > 0 ? v : null; o.cost_cents = v && c > 0 ? c : 0;
        return o;
      });
    };
    return { add: add, items: items };
  }
  function previewBox(ctx, payload) {
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Prévia do e-mail ao cliente</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<p class="portal-muted" id="pv-subj">Carregando…</p><iframe id="pv-f" title="Prévia do e-mail" sandbox="" style="width:100%;height:72vh;border:1px solid #e3e7ee;border-radius:10px;background:#fff"></iframe>');
    o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
    call(ctx, Object.assign({ action: 'invoice_preview' }, payload)).then(function (j) {
      ctx.$('#pv-subj', o).innerHTML = '<strong>Assunto:</strong> ' + ctx.esc(j.subject) + ' · <span class="portal-muted">o cliente também recebe pelo WhatsApp quando o número estiver aprovado</span>';
      ctx.$('#pv-f', o).srcdoc = j.html;
    }).catch(function (e) { ctx.$('#pv-subj', o).textContent = errMsg(ctx, e); });
  }
  function scheduleBox(ctx, title, run) {
    var d = new Date(Date.now() + 864e5); d.setHours(9, 0, 0, 0);
    var local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + ctx.esc(title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="sc-f"><div class="field"><label for="sc-at">Enviar em</label><input type="datetime-local" id="sc-at" value="' + local + '" required></div><div class="portal-alert" id="sc-m" role="alert"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Agendar</button><button class="btn btn--ghost close-x" type="button">Cancelar</button></div></form>', true);
    o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
    ctx.$('#sc-f', o).onsubmit = async function (e) {
      e.preventDefault(); var v = ctx.$('#sc-at', o).value, at = new Date(v);
      if (!v || isNaN(at.getTime()) || at < new Date()) return ctx.msg(ctx.$('#sc-m', o), 'Escolha uma data e hora no futuro.', 'error');
      this.querySelector('button').disabled = true;
      try { await run(at.toISOString()); ctx.closeOverlay(); ctx.route(); } catch (x) { this.querySelector('button').disabled = false; ctx.msg(ctx.$('#sc-m', o), errMsg(ctx, x), 'error'); }
    };
  }

  var KIND = { proposal: 'Proposta', subscription: 'Mensalidade' };
  function invoiceTable(ctx, rows, hidePartner) {
    var esc = ctx.esc;
    var b = function (act, id, label, cls) { return '<button type="button" class="btn ' + (cls || 'btn--ghost') + ' btn--xs" data-act="' + act + '" data-i="' + id + '">' + label + '</button>'; };
    return '<div class="table-wrap"><table class="data inv-table"><thead><tr><th>Fatura</th><th>Cliente</th>' + (hidePartner ? '' : '<th>Parceiro</th>') + '<th class="num">Total</th><th class="num">Parceiro</th><th>Status</th><th>Repasse</th><th>Ações</th></tr></thead><tbody>' +
      rows.map(function (i) {
        var acts = [], editable = i.status === 'draft' && i.kind !== 'proposal';
        if (i.status === 'draft' || i.status === 'open') acts.push(b('preview', i.id, 'Prévia'));
        if (editable) acts.push(b('invoice_send', i.id, 'Enviar agora', 'btn--navy'), b('schedule', i.id, i.scheduled_send_at ? 'Reagendar' : 'Agendar'), '<a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=nova&edit=' + i.id + '">Editar</a>', b('invoice_delete', i.id, 'Excluir rascunho', 'btn--danger'));
        if (i.status === 'open') acts.push(b('invoice_send', i.id, 'Reenviar'));
        if (i.hosted_invoice_url) acts.push('<a class="btn btn--ghost btn--xs" href="' + esc(i.hosted_invoice_url) + '" target="_blank" rel="noopener">Ver no Stripe</a>');
        var ready = i.partners && i.partners.stripe_transfers_active;
        var gp = i.partners && i.partners.payout_method === 'global_payouts';
        if (i.status === 'paid' && (i.transfer_status === 'pending' || i.transfer_status === 'failed') && gp) acts.push(b('manual_paid', i.id, 'Marcar repasse feito', 'btn--navy'));
        else if (i.status === 'paid' && (i.transfer_status === 'pending' || i.transfer_status === 'failed')) acts.push(ready ? b('transfer', i.id, 'Repassar', 'btn--navy') : '<span class="portal-muted" style="font-size:.82rem">Aguardando Stripe do parceiro</span>');
        if (i.status === 'open' || i.status === 'uncollectible') acts.push(b('invoice_sync', i.id, 'Sincronizar'));
        if (i.status === 'open' || (i.status === 'draft' && i.kind === 'proposal')) acts.push(b('invoice_void', i.id, 'Anular', 'btn--danger'));
        if (i.status === 'paid' || i.status === 'void') acts.push(b('invoice_hide', i.id, i.archived_at ? 'Desarquivar' : 'Arquivar'));
        var notes = [];
        if (i.kind && KIND[i.kind]) notes.push(KIND[i.kind]);
        if (i.status === 'draft' && i.scheduled_send_at) notes.push('envio agendado ' + ctx.fmtDT(i.scheduled_send_at));
        if (i.status === 'open' && i.reminders_sent) notes.push(i.reminders_sent + (i.reminders_sent === 1 ? ' lembrete enviado' : ' lembretes enviados'));
        if (i.overdue_notified_at && i.status === 'open') notes.push('sem pagamento após os lembretes');
        return '<tr' + (i.archived_at ? ' class="is-archived"' : '') + '><td><strong>' + esc(i.number || 'Rascunho') + '</strong><span class="sub">' + esc(fmtD(i.created_at)) + (i.due_date ? ' · vence ' + esc(fmtD(i.due_date)) : '') + '</span>' + (notes.length ? '<span class="sub">' + esc(notes.join(' · ')) + '</span>' : '') + '</td><td>' + esc(i.clients ? i.clients.name : '') + '</td>' +
          (hidePartner ? '' : '<td>' + esc(i.partners ? i.partners.name : '—') + '</td>') + '<td class="num">' + esc(money(i.total_cents, i.currency)) + '</td>' +
          '<td class="num">' + (i.partner_id ? esc(money(i.partner_amount_cents, i.currency)) + (i.partner_pct != null ? ' <span class="portal-muted">(' + esc(String(+i.partner_pct)) + '%)</span>' : '') : '—') + '</td>' +
          '<td>' + pill('inv-st', i.status, IS[i.status]) + '</td><td>' + esc(TS[i.transfer_status]) + '</td><td><div class="portal-btn-row inv-acts">' + acts.join('') + '</div><div class="portal-alert" id="ia-' + i.id + '" role="status"></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function wireInvoiceActions(root, ctx) {
    root.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = async function (e) {
        e.stopPropagation();
        var act = b.dataset.act, id = b.dataset.i;
        if (act === 'preview') return previewBox(ctx, { invoice_id: id });
        if (act === 'schedule') return scheduleBox(ctx, 'Agendar o envio da fatura', function (at) { return call(ctx, { action: 'invoice_schedule', invoice_id: id, send_at: at }); });
        if (act === 'invoice_void' && !confirm('Anular esta fatura? O cliente não poderá mais pagá-la e os lembretes param.')) return;
        if (act === 'invoice_delete' && !confirm('Excluir este rascunho de fatura? Isso não pode ser desfeito.')) return;
        if (act === 'invoice_send' && !confirm('Enviar agora a fatura ao cliente por e-mail (e WhatsApp, quando ativo)?')) return;
        if (act === 'transfer' && !confirm('Repassar agora a comissão do parceiro para a conta Stripe dele?')) return;
        if (act === 'manual_paid') {
          var note = prompt('Repasse feito fora do Stripe Connect (Global Payouts ou Pix). Anote uma referência (ex.: ID do pagamento no Stripe):', '');
          if (note === null) return;
          b.disabled = true;
          var ru = await ctx.sb.from('invoices').update({ transfer_status: 'paid', payout_channel: 'global_payouts', payout_note: note.trim().slice(0, 500) || null, payout_paid_at: new Date().toISOString() }).eq('id', id);
          if (ru.error) { b.disabled = false; return ctx.msg(ctx.$('#ia-' + id), ctx.errText(ru.error), 'error'); }
          return ctx.route();
        }
        b.disabled = true;
        try { await call(ctx, { action: act, invoice_id: id }); ctx.route(); }
        catch (x) { b.disabled = false; ctx.msg(ctx.$('#ia-' + id), errMsg(ctx, x), 'error'); }
      };
    });
  }

  async function payments(view, ctx) {
    var esc = ctx.esc, tab = param('tab') || 'faturas';
    var tabs = [['faturas', 'Faturas'], ['propostas', 'Propostas'], ['nova-proposta', 'Nova proposta'], ['modelos', 'Modelos de proposta'], ['nova', 'Nova fatura'], ['servicos', 'Lista de serviços'], ['fornecedores', 'Fornecedores'], ['apagar', 'Contas a pagar'], ['margem', 'Margem por cliente'], ['loja', 'Loja online'], ['stripe', 'Conta Stripe']];
    view.innerHTML = head(esc, 'Pagamentos', 'Propostas, faturas pelo Stripe, lembretes automáticos e repasse da comissão para o parceiro via Stripe Connect.', '<div class="portal-btn-row"><a class="btn btn--ghost" href="#/pagamentos?tab=nova-proposta">Nova proposta</a><a class="btn btn--navy" href="#/pagamentos?tab=nova">Nova fatura</a></div>') +
      '<nav class="subtabs" aria-label="Seções">' + tabs.map(function (t) { return '<a href="#/pagamentos?tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="pg-body"></div>';
    var body = ctx.$('#pg-body');
    if (tab === 'nova') return newInvoice(body, ctx);
    if (tab === 'propostas') return proposalsTab(body, ctx);
    if (tab === 'nova-proposta') return proposalForm(body, ctx, null);
    if (tab === 'modelos') return param('tpl') ? templateForm(body, ctx, param('tpl')) : templatesTab(body, ctx);
    if (tab === 'servicos') return servicesTab(body, ctx);
    if (tab === 'fornecedores') return vendorsTab(body, ctx);
    if (tab === 'apagar') return payablesTab(body, ctx);
    if (tab === 'margem') return marginTab(body, ctx);
    if (tab === 'loja') return storeTab(body, ctx);
    if (tab === 'stripe') return stripeTab(body, ctx);
    var rows = await ctx.q(ctx.sb.from('invoices').select('*, clients(name), partners(name, stripe_transfers_active, payout_method)').order('created_at', { ascending: false }));
    var st = param('status') || '', arch = param('arquivadas') === '1';
    var shown = rows.filter(function (i) { return (!st || i.status === st) && (arch || !i.archived_at); });
    var nArch = rows.filter(function (i) { return i.archived_at; }).length;
    var now = new Date(), ym = now.toISOString().slice(0, 7);
    var open = rows.filter(function (i) { return i.status === 'open'; }).reduce(function (s, i) { return s + i.total_cents - i.amount_paid_cents; }, 0);
    var month = rows.filter(function (i) { return i.status === 'paid' && String(i.paid_at || '').slice(0, 7) === ym; }).reduce(function (s, i) { return s + i.amount_paid_cents; }, 0);
    var toPartners = rows.filter(function (i) { return i.status !== 'void' && ['scheduled', 'pending', 'failed'].indexOf(i.transfer_status) > -1; }).reduce(function (s, i) { return s + i.partner_amount_cents; }, 0);
    var late = rows.filter(function (i) { return i.status === 'open' && i.due_date && i.due_date < now.toISOString().slice(0, 10); }).length;
    body.innerHTML = '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Em aberto', money(open)) + kpi(esc, 'Recebido no mês', money(month)) + kpi(esc, 'Vencidas', late) + kpi(esc, 'Comissões a repassar', money(toPartners)) + '</div>' +
      '<div class="toolbar"><label for="pg-st" class="sr-only">Status</label><select id="pg-st"><option value="">Todos os status</option>' + Object.keys(IS).map(function (k) { return '<option value="' + k + '"' + (st === k ? ' selected' : '') + '>' + IS[k] + '</option>'; }).join('') + '</select>' +
      '<div class="check-row"><input type="checkbox" id="pg-arch"' + (arch ? ' checked' : '') + '><label for="pg-arch">Mostrar arquivadas (' + nArch + ')</label></div></div>' +
      '<p class="portal-muted" style="font-size:.85rem">Fatura enviada: o cliente recebe o e-mail com o link de pagamento e, se não pagar, lembretes 1, 4 e 8 dias após o vencimento. Sem pagamento depois dos lembretes, você recebe o aviso no sino e por e-mail. Paga: recibo ao cliente, aviso para você e lançamento automático no Bookkeeping da Endeavor.</p>' +
      (shown.length ? invoiceTable(ctx, shown) : '<div class="empty-state portal-card"><strong>Nenhuma fatura</strong><p>Crie a primeira em "Nova fatura".</p></div>');
    var go = function () { var q = []; if (ctx.$('#pg-st').value) q.push('status=' + ctx.$('#pg-st').value); if (ctx.$('#pg-arch').checked) q.push('arquivadas=1'); ERoute.set('#/pagamentos' + (q.length ? '?' + q.join('&') : ''), true); ctx.route(); };
    ctx.$('#pg-st').onchange = go; ctx.$('#pg-arch').onchange = go;
    wireInvoiceActions(body, ctx);
  }

  async function servicesTab(body, ctx) {
    var esc = ctx.esc, rows = await ctx.q(ctx.sb.from('billing_services').select('*').order('active', { ascending: false }).order('name')), vendors = await loadVendors(ctx);
    var vsel = function (id, cur) { return '<select ' + id + ' aria-label="Fornecedor"><option value="">Sem fornecedor</option>' + vendors.map(function (v) { return '<option value="' + v.id + '"' + (v.id === cur ? ' selected' : '') + '>' + esc(v.name) + '</option>'; }).join('') + '</select>'; };
    body.innerHTML = '<p class="portal-muted">Serviços que aparecem na lista de cada item da fatura e da proposta, com o valor padrão. Você também salva um serviço novo direto do item, no botão "Salvar na lista".</p>' +
      '<form class="toolbar" id="sv-new" style="flex-wrap:wrap"><label class="sr-only" for="sv-n">Serviço</label><input id="sv-n" maxlength="300" placeholder="Nome do serviço" style="flex:1;min-width:14rem"><label class="sr-only" for="sv-a">Valor</label><input id="sv-a" type="number" min="0" step="0.01" placeholder="Valor (US$)" style="width:9rem">' +
      '<div class="check-row"><input type="checkbox" id="sv-m"><label for="sv-m">Mensal</label></div>' + vsel('id="sv-v"') + '<label class="sr-only" for="sv-c">Custo do fornecedor</label><input id="sv-c" type="number" min="0" step="0.01" placeholder="Custo fornecedor (US$)" style="width:11rem"><button class="btn btn--navy btn--xs" type="submit">Adicionar</button></form><div class="portal-alert" id="sv-msg" role="status"></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Serviço</th><th class="num">Valor padrão</th><th>Cobrança</th><th>Fornecedor</th><th class="num">Custo</th><th>Ativo</th><th></th></tr></thead><tbody>' + rows.map(function (s) {
        return '<tr><td><input data-n="' + s.id + '" value="' + esc(s.name) + '" maxlength="300" aria-label="Nome do serviço" style="width:100%"></td><td class="num"><input data-a="' + s.id + '" type="number" min="0" step="0.01" value="' + (s.amount_cents / 100).toFixed(2) + '" aria-label="Valor" style="width:8rem"></td>' +
          '<td>' + (s.recurring === 'month' ? 'Mensal' : 'Única') + '</td><td>' + vsel('data-v="' + s.id + '"', s.vendor_id) + '</td><td class="num"><input data-c="' + s.id + '" type="number" min="0" step="0.01" value="' + (s.vendor_cost_cents ? (s.vendor_cost_cents / 100).toFixed(2) : '') + '" aria-label="Custo do fornecedor" style="width:7rem"></td><td><input type="checkbox" data-on="' + s.id + '"' + (s.active ? ' checked' : '') + ' aria-label="Ativo"></td><td><button class="btn btn--ghost btn--xs" type="button" data-sv="' + s.id + '">Salvar</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    var m = ctx.$('#sv-msg');
    ctx.$('#sv-new').onsubmit = async function (e) {
      e.preventDefault(); var n = ctx.$('#sv-n').value.trim(); if (n.length < 2) return ctx.$('#sv-n').focus();
      var r = await ctx.sb.from('billing_services').upsert({ name: n, amount_cents: Math.round((+ctx.$('#sv-a').value || 0) * 100), recurring: ctx.$('#sv-m').checked ? 'month' : 'none', active: true, vendor_id: ctx.$('#sv-v').value || null, vendor_cost_cents: ctx.$('#sv-v').value ? Math.round((+ctx.$('#sv-c').value || 0) * 100) : 0 }, { onConflict: 'name,recurring' });
      if (r.error) return ctx.msg(m, ctx.errText(r.error), 'error'); ctx.route();
    };
    body.querySelectorAll('[data-sv]').forEach(function (b) { b.onclick = async function () {
      var id = b.dataset.sv, r = await ctx.sb.from('billing_services').update({ name: body.querySelector('[data-n="' + id + '"]').value.trim(), amount_cents: Math.round((+body.querySelector('[data-a="' + id + '"]').value || 0) * 100), active: body.querySelector('[data-on="' + id + '"]').checked, vendor_id: body.querySelector('[data-v="' + id + '"]').value || null, vendor_cost_cents: body.querySelector('[data-v="' + id + '"]').value ? Math.round((+body.querySelector('[data-c="' + id + '"]').value || 0) * 100) : 0 }).eq('id', id);
      ctx.msg(m, r.error ? ctx.errText(r.error) : 'Salvo.', r.error ? 'error' : 'ok');
    }; });
  }

  /* ---------- online store: prices of the cards on the home page, purchases and active services ---------- */
  var SP = { crm: 'CRM', agenda: 'Agenda Online', esign: 'Assinatura Eletrônica', bookkeeping: 'Bookkeeping com IA', registered_agent: 'Registered Agent', virtual_address: 'Endereço Virtual' };
  async function storeTab(body, ctx) {
    var esc = ctx.esc;
    var res = await Promise.all([ctx.q(ctx.sb.from('store_products').select('*').order('sort')),
      ctx.q(ctx.sb.from('store_orders').select('*, clients(name)').order('created_at', { ascending: false }).limit(100)),
      ctx.q(ctx.sb.from('client_services').select('*, clients(name, primary_email)').order('started_at', { ascending: false }).limit(300))]);
    var prods = res[0], orders = res[1], svcs = res[2];
    var OST = { pending: 'Aguardando pagamento', paid: 'Pago (conta pendente)', fulfilled: 'Pago e conta criada', failed: 'Falhou', expired: 'Expirou' };
    var money = function (c) { return '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }); };
    body.innerHTML = '<p class="portal-muted">Os serviços que aparecem na home com o botão de compra. Quem compra paga pelo Stripe, a conta no portal é criada sozinha e o e-mail de acesso sai na hora. "Em breve" mostra o card sem permitir a compra.</p>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Serviço</th><th class="num">Preço (US$)</th><th>Cobrança</th><th>Situação na home</th><th></th></tr></thead><tbody>' + prods.map(function (p) {
        return '<tr><td><strong>' + esc(SP[p.code] || p.code) + '</strong></td><td class="num"><input data-pp="' + p.code + '" type="number" min="0" step="0.01" value="' + (p.price_cents / 100).toFixed(2) + '" style="width:8rem" aria-label="Preço"></td>' +
          '<td><select data-pi="' + p.code + '" aria-label="Cobrança">' + [['month', 'Mensal'], ['year', 'Anual'], ['once', 'Única']].map(function (x) { return '<option value="' + x[0] + '"' + (p.interval === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></td>' +
          '<td><select data-ps="' + p.code + '" aria-label="Situação">' + [['active', 'À venda'], ['coming_soon', 'Em breve'], ['hidden', 'Escondido']].map(function (x) { return '<option value="' + x[0] + '"' + (p.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></td>' +
          '<td><button class="btn btn--ghost btn--xs" type="button" data-psave="' + p.code + '">Salvar</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="portal-alert" id="st-m" role="status"></div>' +
      '<p class="portal-muted" style="font-size:.85rem">Mudar o preço vale para as novas compras. Quem já assina continua com o preço que contratou.</p>' +
      '<h2 class="portal-h2" style="margin-top:1.5rem">Compras recentes</h2>' + (orders.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Data</th><th>Serviço</th><th>Comprador</th><th>Origem</th><th class="num">Valor</th><th>Situação</th></tr></thead><tbody>' + orders.map(function (o) {
        return '<tr><td>' + esc(ctx.fmtDT(o.created_at)) + '</td><td>' + esc(SP[o.product_code] || o.product_code) + '</td><td>' + esc(o.name) + '<div class="portal-muted" style="font-size:.8rem">' + esc(o.email) + (o.company ? ' · ' + esc(o.company) : '') + (o.phone ? ' · ' + esc(o.phone) : '') + '</div></td><td>' + (o.source === 'portal' ? 'Portal' : 'Site') + '</td><td class="num">' + money(o.amount_cents) + '</td><td><span class="pill' + (o.status === 'fulfilled' ? ' pill--report' : '') + '">' + (OST[o.status] || o.status) + '</span>' + (o.error ? '<div class="portal-muted" style="font-size:.78rem;color:var(--error)">' + esc(o.error) + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Nenhuma compra ainda.</p>') +
      '<h2 class="portal-h2" style="margin-top:1.5rem">Serviços ativos nas contas</h2>' + (svcs.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Cliente</th><th>Serviço</th><th>Desde</th><th>Situação</th></tr></thead><tbody>' + svcs.map(function (x) {
        return '<tr><td>' + esc(x.clients ? x.clients.name : '') + '<div class="portal-muted" style="font-size:.8rem">' + esc(x.clients ? x.clients.primary_email : '') + '</div></td><td>' + esc(SP[x.product_code] || x.product_code) + '</td><td>' + esc(ctx.fmtDT(x.started_at)) + '</td><td>' + ({ active: 'Ativo', past_due: 'Pagamento pendente', canceled: 'Cancelado' }[x.status] || x.status) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Nenhum serviço contratado ainda.</p>');
    body.querySelectorAll('[data-psave]').forEach(function (b) { b.onclick = async function () {
      var c = b.dataset.psave, r = await ctx.sb.from('store_products').update({ price_cents: Math.round((+body.querySelector('[data-pp="' + c + '"]').value || 0) * 100), interval: body.querySelector('[data-pi="' + c + '"]').value, status: body.querySelector('[data-ps="' + c + '"]').value, updated_at: new Date().toISOString() }).eq('code', c);
      ctx.msg(ctx.$('#st-m'), r.error ? ctx.errText(r.error) : 'Salvo. A home já mostra o novo valor.', r.error ? 'error' : 'ok');
    }; });
  }

  /* ---------- vendors, payables, margin ---------- */
  var PAYM = { ach: 'ACH', zelle: 'Zelle', wire: 'Wire', check: 'Cheque', card: 'Cartão', other: 'Outro' };
  async function vendorsTab(body, ctx) {
    var esc = ctx.esc, rows = await loadVendors(ctx);
    body.innerHTML = '<div class="toolbar" style="justify-content:space-between"><p class="portal-muted" style="margin:0">Quem faz parte do serviço que a Endeavor cobra (ex.: o CPA que entrega o imposto de renda). No item da fatura ou proposta você indica o fornecedor e o custo; quando o cliente paga, a conta a pagar é criada sozinha.</p><button class="btn btn--navy btn--xs" type="button" id="vd-new">Novo fornecedor</button></div>' +
      (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Fornecedor</th><th>Serviço</th><th>Contato</th><th>Pagamento</th><th>Prazo</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(function (v) {
        return '<tr><td><strong>' + esc(v.name) + '</strong></td><td>' + esc(v.service || '') + '</td><td>' + esc(v.contact_name || '') + (v.email ? '<span class="sub">' + esc(v.email) + '</span>' : '') + (v.phone ? '<span class="sub">' + esc(v.phone) + '</span>' : '') + '</td><td>' + esc(PAYM[v.pay_method]) + '</td><td>' + v.terms_days + ' dias</td><td>' + (v.active ? 'Ativo' : 'Inativo') + '</td><td><button class="btn btn--ghost btn--xs" data-vd="' + v.id + '">Editar</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty-state portal-card"><strong>Nenhum fornecedor</strong><p>Cadastre o primeiro, por exemplo o CPA.</p></div>');
    var open = function (v) {
      v = v || { active: true, pay_method: 'ach', terms_days: 15 };
      var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (v.id ? 'Editar fornecedor' : 'Novo fornecedor') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><form class="portal-form" id="vd-f" novalidate>' +
        '<div class="field"><label for="vd-n">Nome / empresa</label><input id="vd-n" maxlength="200" required value="' + esc(v.name || '') + '"></div>' +
        '<div class="field"><label for="vd-s">Serviço que faz</label><input id="vd-s" maxlength="200" placeholder="Ex.: Declaração de imposto (CPA)" value="' + esc(v.service || '') + '"></div>' +
        '<div class="portal-grid2"><div class="field"><label for="vd-c">Contato</label><input id="vd-c" maxlength="200" value="' + esc(v.contact_name || '') + '"></div><div class="field"><label for="vd-e">E-mail</label><input id="vd-e" type="email" maxlength="254" value="' + esc(v.email || '') + '"></div></div>' +
        '<div class="portal-grid2"><div class="field"><label for="vd-p">Telefone</label><input id="vd-p" maxlength="40" value="' + esc(v.phone || '') + '"></div><div class="field"><label for="vd-t">Prazo para pagar (dias após o cliente pagar)</label><input id="vd-t" type="number" min="0" max="120" value="' + v.terms_days + '"></div></div>' +
        '<div class="field"><label for="vd-m">Forma de pagamento</label><select id="vd-m">' + Object.keys(PAYM).map(function (k) { return '<option value="' + k + '"' + (k === v.pay_method ? ' selected' : '') + '>' + PAYM[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="vd-o">Observações</label><textarea id="vd-o" rows="3" maxlength="1000">' + esc(v.notes || '') + '</textarea><p class="portal-muted" style="font-size:.82rem;margin:.25rem 0 0">Não anote números de conta bancária aqui. Os dados para pagar ficam no seu banco.</p></div>' +
        '<div class="check-row"><input type="checkbox" id="vd-a"' + (v.active ? ' checked' : '') + '><label for="vd-a">Ativo</label></div><div class="portal-alert" id="vd-msg" role="alert"></div>' +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button><button class="btn btn--ghost close-x" type="button">Cancelar</button></div></form>', true);
      o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
      ctx.$('#vd-f', o).onsubmit = async function (e) {
        e.preventDefault(); var n = ctx.$('#vd-n', o).value.trim(); if (n.length < 2) return ctx.msg(ctx.$('#vd-msg', o), 'Informe o nome.', 'error');
        var row = { name: n, service: ctx.$('#vd-s', o).value.trim() || null, contact_name: ctx.$('#vd-c', o).value.trim() || null, email: ctx.$('#vd-e', o).value.trim() || null, phone: ctx.$('#vd-p', o).value.trim() || null,
          terms_days: Math.max(0, Math.min(120, +ctx.$('#vd-t', o).value || 0)), pay_method: ctx.$('#vd-m', o).value, notes: ctx.$('#vd-o', o).value.trim() || null, active: ctx.$('#vd-a', o).checked };
        var r = v.id ? await ctx.sb.from('vendors').update(row).eq('id', v.id) : await ctx.sb.from('vendors').insert(row);
        if (r.error) return ctx.msg(ctx.$('#vd-msg', o), ctx.errText(r.error), 'error');
        ctx.closeOverlay(); ctx.route();
      };
    };
    ctx.$('#vd-new').onclick = function () { open(null); };
    body.querySelectorAll('[data-vd]').forEach(function (b) { b.onclick = function () { open(rows.find(function (v) { return v.id === b.dataset.vd; })); }; });
  }

  async function houseBankAccounts(ctx) {
    try {
      var h = await ctx.q(ctx.sb.from('companies').select('id').eq('is_house', true).limit(1));
      if (!h.length) return [];
      return await ctx.q(ctx.sb.from('bk_accounts').select('id, code, name, subtype').eq('company_id', h[0].id).in('subtype', ['bank', 'credit_card']).eq('is_active', true).order('code'));
    } catch (e) { return []; }
  }
  async function payablesTab(body, ctx) {
    var esc = ctx.esc, st = param('st') || 'open';
    var res = await Promise.all([ctx.q(ctx.sb.from('payables').select('*, vendors(name, pay_method), clients(name), invoices(number)').order('due_date')), houseBankAccounts(ctx)]);
    var all = res[0], banks = res[1], today = new Date().toISOString().slice(0, 10);
    var rows = all.filter(function (p) { return st === 'all' || p.status === st; });
    var sum = function (f) { return all.filter(f).reduce(function (s, p) { return s + p.amount_cents; }, 0); };
    var STP = { open: 'A pagar', paid: 'Pago', void: 'Anulado' };
    body.innerHTML = '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'A pagar', money(sum(function (p) { return p.status === 'open'; }))) + kpi(esc, 'Vencido', money(sum(function (p) { return p.status === 'open' && p.due_date < today; }))) +
        kpi(esc, 'Pago no mês', money(sum(function (p) { return p.status === 'paid' && String(p.paid_at || '').slice(0, 7) === today.slice(0, 7); }))) + '</div>' +
      '<div class="toolbar"><label for="ap-st" class="sr-only">Status</label><select id="ap-st">' + [['open', 'A pagar'], ['paid', 'Pagas'], ['void', 'Anuladas'], ['all', 'Todas']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === st ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<p class="portal-muted" style="font-size:.85rem">Criadas sozinhas quando o cliente paga uma fatura com custo de fornecedor: o custo entra no Bookkeeping da Endeavor (5100 Subcontratados) e a dívida em 2000 Contas a pagar. Ao marcar como paga, escolha a conta de onde saiu o dinheiro, ou deixe para categorizar pelo extrato (o sistema sugere 2000 quando o valor bate).</p>' +
      (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Fornecedor</th><th>Serviço · cliente</th><th>Fatura</th><th class="num">Valor</th><th>Vencimento</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(function (p) {
        var late = p.status === 'open' && p.due_date < today;
        var acts = p.status === 'open' ? '<button class="btn btn--navy btn--xs" data-pay="' + p.id + '">Marcar como pago</button><button class="btn btn--ghost btn--xs" data-ap="void" data-i="' + p.id + '">Anular</button>' : p.status === 'paid' ? '<button class="btn btn--ghost btn--xs" data-ap="unpay" data-i="' + p.id + '">Desfazer pagamento</button>' : '';
        return '<tr><td><strong>' + esc(p.vendors ? p.vendors.name : '') + '</strong><span class="sub">' + esc(p.vendors ? PAYM[p.vendors.pay_method] : '') + '</span></td><td>' + esc(p.description) + '</td><td>' + esc(p.invoices ? p.invoices.number || '' : '') + '</td><td class="num">' + esc(money(p.amount_cents)) + '</td>' +
          '<td' + (late ? ' class="prop-why"' : '') + '>' + esc(fmtD(p.due_date)) + (late ? ' · vencido' : '') + '</td><td>' + STP[p.status] + (p.paid_at ? '<span class="sub">' + esc(fmtD(p.paid_at)) + (p.paid_note ? ' · ' + esc(p.paid_note) : '') + '</span>' : '') + '</td><td><div class="portal-btn-row inv-acts">' + acts + '</div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty-state portal-card"><strong>Nada aqui</strong><p>As contas a pagar aparecem quando um cliente paga uma fatura com custo de fornecedor.</p></div>');
    ctx.$('#ap-st').onchange = function () { ERoute.set('#/pagamentos?tab=apagar&st=' + this.value, true); ctx.route(); };
    body.querySelectorAll('[data-ap]').forEach(function (b) { b.onclick = async function () {
      if (!confirm(b.dataset.ap === 'void' ? 'Anular esta conta a pagar? O custo sai do Bookkeeping.' : 'Desfazer o pagamento? O lançamento do pagamento é anulado e a conta volta a ficar em aberto.')) return;
      b.disabled = true; var r = await ctx.sb.rpc('bk_payable_action', { p_id: b.dataset.i, p_action: b.dataset.ap }); if (r.error) { b.disabled = false; return alert(ctx.errText(r.error)); } ctx.route();
    }; });
    body.querySelectorAll('[data-pay]').forEach(function (b) { b.onclick = function () {
      var p = all.find(function (x) { return x.id === b.dataset.pay; });
      var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Pagamento a ' + esc(p.vendors.name) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
        '<p><strong>' + esc(money(p.amount_cents)) + '</strong> · ' + esc(p.description) + '</p><form class="portal-form" id="py-f"><div class="field"><label for="py-d">Data do pagamento</label><input type="date" id="py-d" value="' + today + '" required></div>' +
        '<div class="field"><label for="py-a">Pago de qual conta</label><select id="py-a"><option value="">Não lançar agora (vou categorizar pelo extrato em 2000)</option>' + banks.map(function (a) { return '<option value="' + a.id + '">' + esc(a.code + ' ' + a.name) + '</option>'; }).join('') + '</select>' +
        '<p class="portal-muted" style="font-size:.82rem;margin:.25rem 0 0">Se a conta estiver conectada ao Bookkeeping, prefira categorizar pelo extrato para não lançar duas vezes.</p></div>' +
        '<div class="field"><label for="py-n">Referência (opcional)</label><input id="py-n" maxlength="200" placeholder="Ex.: Zelle 11/15"></div><div class="portal-alert" id="py-m" role="alert"></div>' +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Confirmar pagamento</button><button class="btn btn--ghost close-x" type="button">Cancelar</button></div></form>', true);
      o.querySelectorAll('.close-x').forEach(function (x) { x.onclick = ctx.closeOverlay; });
      ctx.$('#py-f', o).onsubmit = async function (e) {
        e.preventDefault(); this.querySelector('button').disabled = true;
        var r = await ctx.sb.rpc('bk_pay_payable', { p_id: p.id, p_date: ctx.$('#py-d', o).value, p_account: ctx.$('#py-a', o).value || null, p_note: ctx.$('#py-n', o).value.trim() || null });
        if (r.error) { this.querySelector('button').disabled = false; return ctx.msg(ctx.$('#py-m', o), ctx.errText(r.error), 'error'); }
        ctx.closeOverlay(); ctx.route();
      };
    }; });
  }

  async function marginTab(body, ctx) {
    var esc = ctx.esc, y = +(param('ano') || new Date().getFullYear());
    var from = y + '-01-01', to = (y + 1) + '-01-01';
    var res = await Promise.all([ctx.q(ctx.sb.from('invoices').select('client_id, amount_paid_cents, partner_amount_cents, paid_at, clients(name)').eq('status', 'paid').gte('paid_at', from).lt('paid_at', to)),
      ctx.q(ctx.sb.from('payables').select('client_id, amount_cents, status, invoices(paid_at)').neq('status', 'void'))]);
    var by = {};
    res[0].forEach(function (i) { var k = i.client_id; by[k] = by[k] || { name: i.clients ? i.clients.name : '—', rec: 0, ven: 0, par: 0 }; by[k].rec += i.amount_paid_cents || 0; by[k].par += i.partner_amount_cents || 0; });
    res[1].forEach(function (p) { var d = p.invoices && p.invoices.paid_at; if (!d || d < from || d >= to || !by[p.client_id]) return; by[p.client_id].ven += p.amount_cents; });
    var rows = Object.keys(by).map(function (k) { var r = by[k]; r.m = r.rec - r.ven - r.par; return r; }).sort(function (a, b) { return b.rec - a.rec; });
    var T = rows.reduce(function (s, r) { s.rec += r.rec; s.ven += r.ven; s.par += r.par; s.m += r.m; return s; }, { rec: 0, ven: 0, par: 0, m: 0 });
    var pct = function (r) { return r.rec ? Math.round(r.m / r.rec * 1000) / 10 + '%' : '—'; };
    body.innerHTML = '<div class="toolbar"><label for="mg-y">Ano</label><select id="mg-y">' + [0, 1, 2, 3].map(function (d) { var v = new Date().getFullYear() - d; return '<option' + (v === y ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
      '<div class="kpis" style="margin-bottom:1.25rem">' + kpi(esc, 'Recebido', money(T.rec)) + kpi(esc, 'Fornecedores', money(T.ven)) + kpi(esc, 'Comissões', money(T.par)) + kpi(esc, 'Margem', money(T.m) + ' · ' + pct(T)) + '</div>' +
      (rows.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Cliente</th><th class="num">Recebido</th><th class="num">Fornecedores</th><th class="num">Comissão de parceiro</th><th class="num">Margem</th><th class="num">%</th></tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td><td class="num">' + money(r.rec) + '</td><td class="num">' + money(r.ven) + '</td><td class="num">' + money(r.par) + '</td><td class="num"><strong>' + money(r.m) + '</strong></td><td class="num">' + pct(r) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="portal-muted" style="font-size:.85rem">Faturas pagas no ano, menos o custo dos fornecedores dessas faturas e a comissão de parceiros.</p>' : '<div class="empty-state portal-card"><strong>Sem faturas pagas em ' + y + '</strong></div>');
    ctx.$('#mg-y').onchange = function () { ERoute.set('#/pagamentos?tab=margem&ano=' + this.value, true); ctx.route(); };
  }

  async function newInvoice(body, ctx) {
    var esc = ctx.esc, sb = ctx.sb, editId = param('edit');
    var res = await Promise.all([ctx.q(sb.from('clients').select('id, name, primary_email').eq('status', 'active').order('name')), ctx.q(sb.from('partners').select('*').neq('status', 'suspended').eq('program_status', 'approved').order('name')),
      ctx.q(sb.from('referrals').select('id, partner_id, client_id, name').not('client_id', 'is', null)), ctx.q(sb.from('stripe_settings').select('*').eq('id', 1).single()), loadServices(ctx),
      editId ? ctx.q(sb.from('invoices').select('*').eq('id', editId).single()) : Promise.resolve(null), loadVendors(ctx),
      editId ? ctx.q(sb.from('item_costs').select('*').eq('invoice_id', editId)) : Promise.resolve([])]);
    var clients = res[0], partners = res[1], refs = res[2], cfg = res[3], services = res[4], ed = res[5], vendors = res[6], edCosts = res[7];
    if (ed && (ed.status !== 'draft' || ed.kind === 'proposal')) { body.innerHTML = '<div class="portal-alert portal-alert--info" style="display:block">Só rascunhos podem ser editados. <a href="#/pagamentos">Voltar às faturas</a></div>'; return; }
    var pre = ed ? ed.client_id : param('client');
    body.innerHTML = '<div class="dash"><section class="portal-card">' + (ed ? '<p class="portal-muted"><strong>Editando o rascunho.</strong> Ao salvar, o rascunho anterior é substituído.</p>' : '') + '<form class="portal-form" id="ni" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="ni-client">Cliente</label><select id="ni-client" required><option value="">Selecione</option>' + clients.map(function (c) { return '<option value="' + c.id + '"' + (pre === c.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.primary_email) + ')</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ni-days">Vencimento (dias após o envio)</label><input id="ni-days" type="number" min="0" max="90" value="' + esc(String(ed && ed.days_until_due != null ? ed.days_until_due : cfg.default_days_until_due)) + '"></div></div>' +
      '<div class="field"><label for="ni-desc">Descrição (aparece na fatura)</label><input id="ni-desc" maxlength="500" placeholder="Ex.: Abertura de LLC na Flórida" value="' + esc(ed ? ed.description || '' : '') + '"></div>' +
      '<fieldset class="perm-box"><legend>Itens</legend><div class="inv-items" id="ni-items"></div><div class="portal-btn-row" style="margin-top:.5rem"><button class="btn btn--ghost btn--xs" type="button" id="ni-add">+ Item</button><a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=servicos">Gerenciar lista de serviços</a></div></fieldset>' +
      '<fieldset class="perm-box"><legend>Parceiro (comissão)</legend><div class="portal-grid2"><div class="field"><label for="ni-partner">Parceiro</label><select id="ni-partner"><option value="">Sem parceiro</option>' + partners.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + (p.company ? ' · ' + esc(p.company) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="ni-pct">Comissão (%)</label><input id="ni-pct" type="number" min="0" max="100" step="0.5" disabled></div></div><p class="portal-muted" id="ni-pinfo" style="font-size:.88rem;margin:0"></p></fieldset>' +
      '<fieldset class="perm-box"><legend>Envio</legend><div class="send-opts" role="radiogroup" aria-label="Quando enviar">' +
        '<label class="check-row"><input type="radio" name="ni-mode" value="now" checked> <span><strong>Enviar agora</strong> · e-mail com as instruções de pagamento (e WhatsApp quando ativo)</span></label>' +
        '<label class="check-row"><input type="radio" name="ni-mode" value="schedule"> <span><strong>Agendar o envio</strong></span></label>' +
        '<div class="field" id="ni-atw" hidden style="margin-left:2rem;max-width:16rem"><label for="ni-at">Data e hora do envio</label><input type="datetime-local" id="ni-at"></div>' +
        '<label class="check-row"><input type="radio" name="ni-mode" value="draft"> <span><strong>Salvar como rascunho</strong> · envia depois pela lista de faturas</span></label></div></fieldset>' +
      '<div class="portal-alert" id="ni-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit" id="ni-go">Criar e enviar</button><button class="btn btn--ghost" type="button" id="ni-prev">Prévia do e-mail</button>' + (ed ? '<a class="btn btn--ghost" href="#/pagamentos">Cancelar</a>' : '') + '</div></form></section>' +
      '<aside class="portal-card"><h2 class="portal-h2">Resumo do pagamento</h2><div class="split-box"><dl class="split-sum" id="ni-sum"></dl></div><p class="portal-muted" style="font-size:.85rem;margin-top:.75rem">O cliente paga o valor cheio. Quando o parceiro tem o Stripe conectado, a parte dele é transferida automaticamente no pagamento. As taxas do Stripe ficam com a Endeavor.</p>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">Depois do envio</h3><ol class="steps-ol" style="font-size:.88rem"><li>Cliente recebe a fatura com o link de pagamento.</li><li>Sem pagamento: lembretes 1, 4 e 8 dias após o vencimento.</li><li>Ainda sem pagamento: aviso para você no sino e por e-mail.</li><li>Pagou: recibo ao cliente, aviso para você e lançamento no Bookkeeping.</li></ol></aside></div>';
    var calc;
    var ed_ = itemEditor(ctx, ctx.$('#ni-items'), services, { vendors: vendors, onChange: function () { calc(); } });
    calc = function () {
      var tot = ed_.items().reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0);
      var pid = ctx.$('#ni-partner').value, pct = pid ? +ctx.$('#ni-pct').value || 0 : 0, share = Math.round(tot * pct / 100);
      var p = partners.find(function (x) { return x.id === pid; });
      var vc = ed_.items().reduce(function (s, i) { return s + (i.cost_cents || 0) * i.quantity; }, 0);
      ctx.$('#ni-sum').innerHTML = '<dt>Cliente paga</dt><dd class="is-total">' + money(tot) + '</dd>' + (pid ? '<dt>Parceiro recebe (' + pct + '%)</dt><dd>' + money(share) + '</dd>' : '') + (vc ? '<dt>Fornecedores (a pagar)</dt><dd>' + money(vc) + '</dd>' : '') + '<dt>Margem da Endeavor*</dt><dd>' + money(tot - share - vc) + '</dd>';
      ctx.$('#ni-pinfo').textContent = !p ? '' : p.stripe_transfers_active ? 'Stripe do parceiro pronto: o repasse será automático no pagamento.' : 'O parceiro ainda não conectou o Stripe: a comissão fica registrada como pendente e você repassa com um clique depois que ele conectar.';
    };
    var pickPartner = function (pid, pct) {
      var p = partners.find(function (x) { return x.id === pid; });
      ctx.$('#ni-partner').value = p ? p.id : ''; ctx.$('#ni-pct').disabled = !p; ctx.$('#ni-pct').value = p ? (pct != null ? +pct : +p.default_share_pct) : ''; calc();
    };
    (ed && ed.items && ed.items.length ? ed.items : [{}]).forEach(function (i, n) { var k = edCosts.find(function (c) { return c.item_index === n; }); ed_.add(i.description, i.amount_cents != null ? (i.amount_cents / 100).toFixed(2) : '', i.quantity, null, k && k.vendor_id, k && k.cost_cents); });
    ctx.$('#ni-add').onclick = function () { var d = ed_.add(); d.querySelector('select').focus(); };
    ctx.$('#ni-partner').onchange = function () { pickPartner(this.value); };
    ctx.$('#ni-pct').oninput = calc;
    var refFor = function (cid) { return refs.find(function (r) { return r.client_id === cid; }); };
    ctx.$('#ni-client').onchange = function () { var r = refFor(this.value); pickPartner(r ? r.partner_id : ''); };
    if (ed) pickPartner(ed.partner_id, ed.partner_pct); else if (pre) { var r0 = refFor(pre); if (r0) pickPartner(r0.partner_id); }
    calc();
    var mode = function () { return (ctx.$('#ni').querySelector('input[name=ni-mode]:checked') || {}).value || 'now'; };
    var LBL = { now: 'Criar e enviar', schedule: 'Criar e agendar', draft: 'Salvar rascunho' };
    ctx.$('#ni').querySelectorAll('input[name=ni-mode]').forEach(function (r) { r.onchange = function () { ctx.$('#ni-atw').hidden = mode() !== 'schedule'; ctx.$('#ni-go').textContent = LBL[mode()]; if (mode() === 'schedule' && !ctx.$('#ni-at').value) { var d = new Date(Date.now() + 864e5); d.setHours(9, 0, 0, 0); ctx.$('#ni-at').value = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); } }; });
    var valid = function () {
      var cid = ctx.$('#ni-client').value, its = ed_.items().filter(function (i) { return i.description || i.amount_cents; });
      if (!cid) { ctx.msg(ctx.$('#ni-m'), 'Selecione o cliente.', 'error'); return null; }
      if (!its.length || its.some(function (i) { return !i.description || i.amount_cents < 1; })) { ctx.msg(ctx.$('#ni-m'), ERR.invalid_items, 'error'); return null; }
      return { cid: cid, its: its };
    };
    ctx.$('#ni-prev').onclick = function () { var v = valid(); if (v) previewBox(ctx, { client_id: v.cid, items: v.its, days_until_due: +ctx.$('#ni-days').value, description: ctx.$('#ni-desc').value.trim() || undefined }); };
    ctx.$('#ni').onsubmit = async function (e) {
      e.preventDefault();
      var v = valid(); if (!v) return;
      var md = mode(), at = null;
      if (md === 'schedule') { at = new Date(ctx.$('#ni-at').value); if (isNaN(at.getTime()) || at < new Date()) return ctx.msg(ctx.$('#ni-m'), 'Escolha uma data e hora de envio no futuro.', 'error'); }
      var pid = ctx.$('#ni-partner').value, r = refFor(v.cid);
      var btns = this.querySelectorAll('button'); btns.forEach(function (b) { b.disabled = true; });
      ctx.msg(ctx.$('#ni-m'), md === 'now' ? 'Criando a fatura e enviando…' : 'Criando a fatura no Stripe…', 'info');
      try {
        await call(ctx, { action: ed ? 'invoice_edit' : 'invoice_create', invoice_id: ed ? ed.id : undefined, client_id: v.cid, items: v.its, days_until_due: +ctx.$('#ni-days').value, description: ctx.$('#ni-desc').value.trim() || undefined,
          partner_id: pid || undefined, partner_pct: pid ? +ctx.$('#ni-pct').value : undefined, referral_id: r && r.partner_id === pid ? r.id : undefined, send: md, send_at: at ? at.toISOString() : undefined });
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
  async function sendProposal(ctx, p) {
    // the server creates the pending invoice and sends the e-mail (and WhatsApp when active) with "Aceitar e pagar fatura" and "Rejeitar"
    return await call(ctx, { action: 'proposal_send', proposal_id: p.id });
  }
  async function proposalsTab(body, ctx) {
    var esc = ctx.esc;
    var rows = await ctx.q(ctx.sb.from('proposals').select('*, clients(name, primary_email, language), invoices!proposals_invoice_id_fkey(number, status)').order('created_at', { ascending: false }));
    body.innerHTML = '<p class="portal-muted">Fluxo: <strong>enviar a proposta</strong> (a fatura vai junto no mesmo e-mail) → o cliente <strong>aceita e paga</strong> na página da proposta, ou <strong>rejeita com o motivo</strong> → pago: recibo, acesso ao portal e o pedido dos documentos de abertura saem automaticamente; a mensalidade, se houver, começa 30 dias depois. Rejeitada: a fatura é cancelada, o lead volta ao CRM e você pode mandar uma nova proposta (cópia). Expirada: a fatura é anulada e você é avisado.</p>' +
      (rows.length ? '<div class="table-wrap"><table class="data inv-table prop-table"><thead><tr><th>Proposta</th><th>Cliente</th><th class="num">Total</th><th>Status</th><th>Andamento</th><th>Ações</th></tr></thead><tbody>' +
        rows.map(function (p) {
          var prog = [p.sent_at ? 'Enviada ' + esc(fmtD(p.sent_at)) : '', p.viewed_at ? 'Vista ' + esc(fmtD(p.viewed_at)) : '', p.accepted_at ? 'Aceita ' + esc(fmtD(p.accepted_at)) + ' por ' + esc(p.accepted_name || '') : '', p.invoices ? 'Fatura ' + esc(p.invoices.number || '') + ' · ' + (IS[p.invoices.status] || '') : '',
            p.declined_at ? '<span class="prop-why">Rejeitada ' + esc(fmtD(p.declined_at)) + (p.declined_reason ? ': “' + esc(p.declined_reason) + '”' : '') + '</span>' : ''].filter(Boolean).join('<br>');
          var acts = [];
          if (p.status === 'draft' || p.status === 'sent' || p.status === 'expired') acts.push('<button class="btn btn--navy btn--xs" data-psend="' + p.id + '">' + (p.status === 'draft' ? 'Enviar' : 'Reenviar') + '</button>');
          if (p.token && p.status !== 'void') acts.push('<button class="btn btn--ghost btn--xs" data-plink="' + p.id + '">Link do cliente</button>');
          if (p.status === 'draft') acts.push('<a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=nova-proposta&id=' + p.id + '">Editar</a>');
          if (p.status === 'accepted' && !p.invoice_id) acts.push('<button class="btn btn--navy btn--xs" data-pinv="' + p.id + '">Gerar fatura</button>');
          if (p.status === 'declined' || p.status === 'expired') acts.push('<a class="btn btn--navy btn--xs" href="#/pagamentos?tab=nova-proposta&copy=' + p.id + '">Nova proposta (cópia)</a>');
          if (p.status === 'draft' || p.status === 'sent') acts.push('<button class="btn btn--danger btn--xs" data-pvoid="' + p.id + '">Anular</button>');
          return '<tr><td><strong>' + esc(p.title) + '</strong><span class="sub">' + esc(fmtD(p.created_at)) + '</span></td><td>' + esc(p.clients ? p.clients.name : '') + '<span class="sub">' + esc(p.clients ? p.clients.primary_email : '') + '</span></td>' +
            '<td class="num">' + esc(money(p.total_cents, p.currency)) + (p.monthly_cents ? '<span class="sub">+ ' + esc(money(p.monthly_cents, p.currency)) + '/mês</span>' : '') + '</td><td><span class="badge badge--' + PS_B[p.status] + '">' + PS[p.status] + '</span></td><td style="font-size:.85rem">' + prog + '</td>' +
            '<td><div class="portal-btn-row" style="flex-wrap:nowrap">' + acts.join('') + '</div><div class="portal-alert" id="pa-' + p.id + '" role="status"></div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty-state portal-card"><strong>Nenhuma proposta ainda</strong><p>Crie a proposta do pacote para o cliente em "Nova proposta".</p></div>');
    var find = function (id) { return rows.find(function (p) { return p.id === id; }); };
    body.querySelectorAll('[data-psend]').forEach(function (b) { b.onclick = async function () {
      var p = find(b.dataset.psend); b.disabled = true;
      try { var r = await sendProposal(ctx, p); ctx.route(); if (!r.mailed) alert('A proposta foi marcada como enviada, mas o e-mail não saiu. Use "Link do cliente" para enviar manualmente.'); }
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
      if (!confirm('Anular esta proposta? O link deixa de funcionar e a fatura que foi junto é anulada.')) return;
      var p = find(b.dataset.pvoid);
      if (p.invoice_id && p.invoices && p.invoices.status !== 'paid') { try { await call(ctx, { action: 'invoice_void', invoice_id: p.invoice_id }); } catch (e) { /* the proposal is voided anyway */ } }
      await ctx.sb.from('proposals').update({ status: 'void' }).eq('id', b.dataset.pvoid); ctx.route();
    }; });
  }

  async function proposalForm(body, ctx) {
    var esc = ctx.esc, sb = ctx.sb, editId = param('id'), copyId = param('copy');
    var res = await Promise.all([ctx.q(sb.from('clients').select('id, name, primary_email, language, status').in('status', ['active', 'prospect']).order('name')), ctx.q(sb.from('partners').select('*').neq('status', 'suspended').eq('program_status', 'approved').order('name')),
      ctx.q(sb.from('referrals').select('id, partner_id, client_id').not('client_id', 'is', null)), ctx.q(sb.from('stripe_settings').select('*').eq('id', 1).single()),
      editId || copyId ? ctx.q(sb.from('proposals').select('*').eq('id', editId || copyId).single()) : Promise.resolve(null),
      ctx.q(sb.from('proposal_templates').select('*').eq('archived', false).order('name')), loadServices(ctx), loadVendors(ctx),
      editId || copyId ? ctx.q(sb.from('item_costs').select('*').eq('proposal_id', editId || copyId)) : Promise.resolve([])]);
    var clients = res[0], partners = res[1], refs = res[2], cfg = res[3], ed = res[4], tpls = res[5], services = res[6], vendors = res[7], srcCosts = res[8];
    var src = ed; if (copyId) ed = null; // copy: same content, saved as a new proposal
    if (src && src.client_id && !clients.some(function (c) { return c.id === src.client_id; })) { var extra = await ctx.q(sb.from('clients').select('id, name, primary_email, language, status').eq('id', src.client_id)); clients = clients.concat(extra); }
    var pre = src ? src.client_id : param('client');
    body.innerHTML = '<div class="dash"><section class="portal-card">' + (copyId && src ? '<div class="portal-alert portal-alert--info" style="display:block">Nova proposta a partir de "' + esc(src.title) + '"' + (src.declined_reason ? '. Motivo da rejeição: “' + esc(src.declined_reason) + '”' : '') + '. Ajuste o que precisar e envie.</div>' : '') + '<div class="tpl-pick"><div class="field"><label for="pp-tpl">Começar de um modelo</label><select id="pp-tpl"><option value="">Selecione o modelo da proposta</option>' +
        Object.keys(STRUCT).map(function (k) { var g = tpls.filter(function (t) { return t.structure === k; }); return g.length ? '<optgroup label="' + esc(STRUCT[k]) + '">' + g.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') +
        '</select></div><button class="btn btn--navy" type="button" id="pp-apply">Usar modelo</button><a class="btn btn--ghost" href="#/pagamentos?tab=modelos">Gerenciar modelos</a></div>' +
      '<p class="portal-muted" id="pp-tplmsg" style="font-size:.85rem;margin:-.25rem 0 1rem">O modelo preenche título, apresentação, o que está incluso, itens, valores e condições. Cliente e parceiro continuam como estão, e você pode ajustar tudo antes de enviar.</p>' +
      '<form class="portal-form" id="pp" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="pp-client">Cliente ou prospect</label><select id="pp-client" required><option value="">Selecione</option>' + clients.map(function (c) { return '<option value="' + c.id + '"' + (pre === c.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.primary_email) + ')' + (c.status === 'prospect' ? ' · prospect' : '') + '</option>'; }).join('') + '</select>' +
        '<p class="portal-muted" style="font-size:.82rem;margin:.3rem 0 0">Prospect vira cliente, com acesso ao portal, só quando aceitar a proposta.</p></div>' +
      '<div class="field"><label for="pp-lang">Idioma da proposta</label><select id="pp-lang"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div></div>' +
      '<div class="field"><label for="pp-title">Título do pacote</label><input id="pp-title" maxlength="200" placeholder="Ex.: Pacote Abertura de LLC na Flórida" value="' + esc(src ? src.title : '') + '"></div>' +
      '<div class="field"><label for="pp-intro">Apresentação (opcional)</label><textarea id="pp-intro" rows="3" maxlength="4000">' + esc(src ? src.intro || '' : '') + '</textarea></div>' +
      '<div class="field"><label for="pp-inc">O que está incluso (um item por linha)</label><textarea id="pp-inc" rows="5" maxlength="4000" placeholder="Registro da LLC na Sunbiz&#10;EIN no IRS&#10;Registered Agent por 12 meses&#10;Operating Agreement">' + esc(src ? (src.included || []).join('\n') : '') + '</textarea></div>' +
      '<fieldset class="perm-box"><legend>Valores</legend><p class="portal-muted" style="font-size:.85rem;margin:0 0 .5rem">Marque <strong>Mensal</strong> nos itens de manutenção: o cliente paga os itens únicos no aceite e a mensalidade começa a ser debitada 30 dias depois, no mesmo cartão ou conta.</p><div class="inv-items" id="pp-items"></div><div class="portal-btn-row" style="margin-top:.5rem"><button class="btn btn--ghost btn--xs" type="button" id="pp-add">+ Item</button><a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=servicos">Gerenciar lista de serviços</a></div></fieldset>' +
      '<div class="portal-grid2"><div class="field"><label for="pp-valid">Validade da proposta (dias)</label><input id="pp-valid" type="number" min="1" max="120" value="30"></div><div class="field"><label for="pp-days">Vencimento da fatura após o aceite (dias)</label><input id="pp-days" type="number" min="0" max="90" value="' + esc(String(src ? src.days_until_due : cfg.default_days_until_due)) + '"></div></div>' +
      '<div class="field"><label for="pp-terms">Condições</label><textarea id="pp-terms" rows="3" maxlength="2000"></textarea></div>' +
      '<fieldset class="perm-box"><legend>Parceiro (comissão na fatura)</legend><div class="portal-grid2"><div class="field"><label for="pp-partner">Parceiro</label><select id="pp-partner"><option value="">Sem parceiro</option>' + partners.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + (p.company ? ' · ' + esc(p.company) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="pp-pct">Comissão (%)</label><input id="pp-pct" type="number" min="0" max="100" step="0.5" disabled></div></div></fieldset>' +
      '<div class="portal-alert" id="pp-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit" data-send="1">Salvar e enviar ao cliente</button><button class="btn btn--ghost" type="submit" data-send="0">Salvar rascunho</button><button class="btn btn--ghost" type="button" id="pp-savetpl">Salvar como modelo</button></div></form></section>' +
      '<aside class="portal-card"><h2 class="portal-h2">Resumo</h2><div class="split-box"><dl class="split-sum" id="pp-sum"></dl></div><h3 class="portal-h2" style="font-size:1rem;margin-top:1.25rem">O que acontece depois</h3><ol class="steps-ol" style="font-size:.88rem">' +
      '<li>O cliente recebe a proposta e a fatura no mesmo e-mail (e WhatsApp quando ativo), com "Aceitar e pagar fatura" e "Rejeitar".</li><li>Para aceitar, confirma as condições com o nome e paga na página (cartão, inclusive do Brasil, ou conta americana). Pagar é o aceite.</li><li>Pago: recibo, acesso ao portal e o pedido dos documentos de abertura saem automaticamente; o pagamento entra no Bookkeeping.</li><li>Itens mensais: o débito começa 30 dias depois do aceite.</li><li>Rejeitou: você recebe o motivo, a fatura é cancelada e o lead volta ao CRM.</li></ol></aside></div>';
    var box = ctx.$('#pp-items'), calc;
    var IE = itemEditor(ctx, box, services, { monthly: true, vendors: vendors, onChange: function () { calc(); } });
    var addItem = function (d, amt, qty, rec, vend, cost) { return IE.add(d, amt != null && amt !== '' ? (+amt).toFixed(2) : '', qty, rec, vend, cost); };
    var items = function () { return IE.items().filter(function (i) { return i.description || i.amount_cents; }); };
    calc = function () {
      var its = items(), once = its.filter(function (i) { return i.recurring !== 'month'; }), mon = its.filter(function (i) { return i.recurring === 'month'; });
      var tot = once.reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0), mt = mon.reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0), pid = ctx.$('#pp-partner').value, pct = pid ? +ctx.$('#pp-pct').value || 0 : 0;
      var vc1 = once.reduce(function (s, i) { return s + (i.cost_cents || 0) * i.quantity; }, 0), vcm = mon.reduce(function (s, i) { return s + (i.cost_cents || 0) * i.quantity; }, 0), com = Math.round(tot * pct / 100);
      ctx.$('#pp-sum').innerHTML = '<dt>Fatura no aceite</dt><dd class="is-total">' + money(tot) + '</dd>' + (mt ? '<dt>Mensalidade (a partir de 30 dias)</dt><dd>' + money(mt) + '/mês</dd>' : '') + (pid ? '<dt>Comissão do parceiro (' + pct + '%)</dt><dd>' + money(com) + '</dd>' : '') +
        (vc1 || vcm ? '<dt>Fornecedores (a pagar)</dt><dd>' + money(vc1) + (vcm ? ' + ' + money(vcm) + '/mês' : '') + '</dd>' : '') + '<dt>Margem da Endeavor</dt><dd>' + money(tot - com - vc1) + (mt ? ' + ' + money(mt - vcm) + '/mês' : '') + '</dd>';
    };
    var pickPartner = function (pid, pct) { var p = partners.find(function (x) { return x.id === pid; }); ctx.$('#pp-partner').value = p ? p.id : ''; ctx.$('#pp-pct').disabled = !p; ctx.$('#pp-pct').value = p ? (pct != null ? +pct : +p.default_share_pct) : ''; calc(); };
    var setLang = function (cid) { var c = clients.find(function (x) { return x.id === cid; }); if (c && !ed) { ctx.$('#pp-lang').value = c.language || 'pt'; ctx.$('#pp-terms').value = DEF_TERMS[c.language] || DEF_TERMS.pt; } };
    (src && src.items.length ? src.items : [{}]).forEach(function (i, n) { var k = srcCosts.find(function (c) { return c.item_index === n; }); addItem(i.description, i.amount_cents != null ? i.amount_cents / 100 : null, i.quantity, i.recurring, k && k.vendor_id, k && k.cost_cents); });
    ctx.$('#pp-terms').value = src ? src.terms || '' : DEF_TERMS.pt;
    if (src) ctx.$('#pp-lang').value = src.language;
    ctx.$('#pp-add').onclick = function () { addItem(); box.lastChild.querySelector('select').focus(); };
    var applyTpl = function (t) {
      ctx.$('#pp-title').value = t.title || ''; ctx.$('#pp-intro').value = t.intro || ''; ctx.$('#pp-inc').value = (t.included || []).join('\n'); ctx.$('#pp-terms').value = t.terms || '';
      ctx.$('#pp-lang').value = t.language || 'pt'; ctx.$('#pp-days').value = t.days_until_due; ctx.$('#pp-valid').value = t.valid_days;
      box.innerHTML = ''; (t.items && t.items.length ? t.items : [{}]).forEach(function (i) { addItem(i.description, i.amount_cents != null ? i.amount_cents / 100 : null, i.quantity, i.recurring); });
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
        included: ctx.$('#pp-inc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), items: items().map(function (i) { return { description: i.description, quantity: i.quantity, amount_cents: i.amount_cents || null, recurring: i.recurring }; }),
        terms: ctx.$('#pp-terms').value.trim() || null, days_until_due: +ctx.$('#pp-days').value || 0, valid_days: +ctx.$('#pp-valid').value || 30, created_by: u && u.email }).select('*').single();
      if (r.error) return ctx.msg(ctx.$('#pp-m'), ctx.errText(r.error), 'error');
      tpls.push(r.data); ctx.msg(ctx.$('#pp-m'), 'Modelo "' + r.data.name + '" salvo. Ajuste o tipo de estrutura em Modelos de proposta.', 'ok');
    };
    ctx.$('#pp-partner').onchange = function () { pickPartner(this.value); };
    ctx.$('#pp-pct').oninput = calc;
    var refFor = function (cid) { return refs.find(function (r) { return r.client_id === cid; }); };
    ctx.$('#pp-client').onchange = function () { setLang(this.value); var r = refFor(this.value); pickPartner(r ? r.partner_id : ''); };
    if (src) pickPartner(src.partner_id, src.partner_pct); else if (pre) { setLang(pre); var r0 = refFor(pre); if (r0) pickPartner(r0.partner_id); }
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
      var pid = ctx.$('#pp-partner').value, r = refFor(cid), total = its.filter(function (i) { return i.recurring !== 'month'; }).reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0);
      var monthlyC = its.filter(function (i) { return i.recurring === 'month'; }).reduce(function (s, i) { return s + i.amount_cents * i.quantity; }, 0);
      if (total < 1) return ctx.msg(m, 'A proposta precisa de pelo menos um item único (a fatura do aceite). Itens mensais começam 30 dias depois.', 'error');
      var valid = new Date(Date.now() + (+ctx.$('#pp-valid').value || 30) * 864e5).toISOString().slice(0, 10);
      var row = { client_id: cid, title: title, intro: ctx.$('#pp-intro').value.trim() || null, included: ctx.$('#pp-inc').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
        items: its.map(function (i) { var o = { description: i.description, quantity: i.quantity, amount_cents: i.amount_cents }; if (i.recurring) o.recurring = i.recurring; return o; }), total_cents: total, monthly_cents: monthlyC, terms: ctx.$('#pp-terms').value.trim() || null, language: ctx.$('#pp-lang').value, days_until_due: +ctx.$('#pp-days').value || 0, valid_until: valid,
        partner_id: pid || null, partner_pct: pid ? +ctx.$('#pp-pct').value : null, referral_id: r && r.partner_id === pid ? r.id : null };
      var btns = this.querySelectorAll('button'); btns.forEach(function (b) { b.disabled = true; });
      var u = (await sb.auth.getUser()).data.user;
      var saved = ed ? await sb.from('proposals').update(row).eq('id', ed.id).select('*').single() : await sb.from('proposals').insert(Object.assign({ created_by: u && u.email }, row)).select('*').single();
      if (!saved.error) { // vendor cost per item stays in item_costs (the client never sees it)
        await sb.from('item_costs').delete().eq('proposal_id', saved.data.id);
        var pcs = its.map(function (i, n) { return i.vendor_id && i.cost_cents > 0 ? { proposal_id: saved.data.id, item_index: n, vendor_id: i.vendor_id, cost_cents: i.cost_cents } : null; }).filter(Boolean);
        if (pcs.length) { var ic = await sb.from('item_costs').insert(pcs); if (ic.error) saved = { error: ic.error }; }
      }
      if (saved.error) { btns.forEach(function (b) { b.disabled = false; }); return ctx.msg(m, ctx.errText(saved.error), 'error'); }
      if (sendFlag) {
        ctx.msg(m, 'Enviando a proposta…', 'info');
        try { var sr = await sendProposal(ctx, saved.data); if (!sr.mailed) alert('Proposta salva, mas o e-mail não saiu. Use "Link do cliente" na lista para enviar manualmente.'); }
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
  var EVK = { invoice_overdue: 'Fatura vencida', proposal_rejected: 'Proposta rejeitada', proposal_expired: 'Proposta expirada', intake_complete: 'Documentos de abertura', ach_authorized: 'Débito ACH', lead_chat: 'Chat do site', proposal_accepted: 'Proposta aceita', payment_received: 'Pagamento recebido', payment_failed: 'Pagamento recusado', referral_new: 'Nova indicação', oa_review: 'Operating Agreement', oa_client: 'Operating Agreement', oa_signature: 'Assinatura', oa_archived: 'Arquivado', booking_new: 'Agenda', booking_cancelled: 'Agenda', booking_rescheduled: 'Agenda', partner_new: 'Parceiros', partner_contract: 'Contrato' };
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
