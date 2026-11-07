/* Smart CRM (admin): next actions, automations (follow-ups, partner reminders, partner step notifications),
   onboarding video for partners, and the AI assistant + e-mail reply inside a lead. Server side: supabase function "crm". */
(function () {
  'use strict';
  var DAY = 864e5;
  async function call(ctx, payload) {
    var sess = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/crm', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (sess ? sess.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(j.error || 'HTTP ' + r.status); e.detail = j.detail; throw e; }
    return j;
  }
  var ERR = { no_ai_key: 'A IA ainda não está configurada (chave da Anthropic no Supabase).', ai_failed: 'A IA não respondeu agora. Tente de novo em instantes.', ai_format: 'A IA respondeu num formato inesperado. Tente de novo.',
    no_sender: 'O envio de e-mails não está configurado.', send_failed: 'O e-mail não saiu. Tente de novo em instantes.', empty: 'Preencha o assunto e a mensagem.', forbidden: 'Sem permissão.' };
  var err = function (ctx, e) { return ERR[e.message] || ctx.errText(e); };
  var ago = function (d) { var n = Math.floor((Date.now() - new Date(d)) / DAY); return n <= 0 ? 'hoje' : n === 1 ? 'há 1 dia' : 'há ' + n + ' dias'; };
  var KIND_MSG = { referral_contacted: 'Parceiro: indicação em contato', referral_proposal: 'Parceiro: proposta enviada', referral_onboarding: 'Parceiro: virou cliente', referral_in_process: 'Parceiro: em processamento', referral_completed: 'Parceiro: concluída', referral_lost: 'Parceiro: encerrada',
    invoice_paid: 'Parceiro: pagamento confirmado', commission_paid: 'Parceiro: comissão enviada', followup_1: 'Follow-up 1 (lead)', followup_2: 'Follow-up 2 (lead)', partner_invite_reminder: 'Lembrete: criar senha (parceiro)', partner_onboarding_reminder: 'Lembrete: terminar onboarding (parceiro)', manual: 'E-mail enviado pelo CRM' };

  /* ---------- next actions ---------- */
  async function nextActions(ctx, el, leads, onLead) {
    var sb = ctx.sb, esc = ctx.esc, now = Date.now();
    var res = await Promise.all([
      sb.from('bookings').select('lead_id, starts_at, status').not('lead_id', 'is', null),
      sb.from('partners').select('id, name, program_status, contract_status, global_payouts_status, payout_method, status'),
      sb.from('proposals').select('*').eq('status', 'sent'),
      sb.from('invoices').select('id, number, status, transfer_status, partner_id, partners(name, stripe_transfers_active, payout_method)').eq('status', 'paid').in('transfer_status', ['pending', 'failed']),
      sb.from('referrals').select('id, name, status, created_at, partner_id, lead_id, partners(name)').eq('status', 'submitted')
    ]);
    var bk = res[0].data || [], parts = res[1].data || [], props = res[2].data || [], invs = res[3].data || [], refs = res[4].data || [];
    var booked = {}, pastCall = {}; bk.forEach(function (b) { booked[b.lead_id] = 1; if (b.status !== 'cancelled' && new Date(b.starts_at) < now) pastCall[b.lead_id] = 1; });
    var A = [];
    var add = function (prio, title, sub, act) { A.push({ p: prio, title: title, sub: sub, act: act }); };
    leads.forEach(function (l) {
      var age = (now - new Date(l.last_contact_at || l.created_at)) / DAY;
      if (l.status === 'new' && !booked[l.id] && age >= 1) add(age >= 3 ? 3 : 2, 'Responder ' + (l.kind === 'partner' ? 'interessado no Programa de Parceiros' : 'lead') + ': ' + l.name, 'Chegou ' + ago(l.created_at) + ' · ' + (l.assistance || l.email), { lead: l.id });
      else if ((l.status === 'contacted' || l.status === 'qualified') && (now - new Date(l.updated_at || l.created_at)) / DAY >= 7 && l.kind !== 'partner') add(1, 'Fazer follow-up: ' + l.name, 'Sem movimento ' + ago(l.updated_at || l.created_at), { lead: l.id });
      if (l.kind === 'partner' && l.status !== 'partner' && l.status !== 'lost' && pastCall[l.id]) add(3, 'Cadastrar parceiro: ' + l.name, 'A conversa já aconteceu. Crie o parceiro e envie o convite.', { lead: l.id });
    });
    refs.forEach(function (r) { if ((now - new Date(r.created_at)) / DAY >= 1) add(3, 'Contatar indicação: ' + r.name, 'Indicada por ' + (r.partners ? r.partners.name : 'parceiro') + ' ' + ago(r.created_at), r.lead_id ? { lead: r.lead_id } : { href: '#/parceiros?id=' + r.partner_id + '&ref=' + r.id }); });
    parts.forEach(function (p) {
      if (p.status === 'suspended') return;
      if (p.program_status === 'pending') add(2, 'Aprovar parceiro: ' + p.name, 'Definir a comissão e enviar o contrato.', { href: '#/parceiros?id=' + p.id + '&tab=contrato' });
      if (p.contract_status === 'partner_signed') add(3, 'Assinar contrato pela Endeavor: ' + p.name, 'O parceiro já assinou.', { href: '#/parceiros?id=' + p.id + '&tab=contrato' });
      if (p.payout_method === 'global_payouts' && p.global_payouts_status === 'requested') add(2, 'Enviar link Global Payouts: ' + p.name, 'Parceiro com conta bancária fora dos EUA.', { href: '#/parceiros?id=' + p.id + '&tab=stripe' });
    });
    props.forEach(function (pr) { var d = pr.sent_at || pr.updated_at || pr.created_at; if ((now - new Date(d)) / DAY >= 5) add(1, 'Proposta sem resposta: ' + (pr.title || 'Proposta'), 'Enviada ' + ago(d), { href: '#/pagamentos?tab=propostas' }); });
    invs.forEach(function (i) { var p = i.partners || {}; if (p.stripe_transfers_active || p.payout_method === 'global_payouts') add(2, 'Repassar comissão: ' + (p.name || ''), 'Fatura ' + (i.number || '') + ' paga', { href: '#/pagamentos' }); });
    A.sort(function (a, b) { return b.p - a.p; });
    if (!A.length) { el.innerHTML = '<section class="portal-card crm-next"><h2 class="portal-h2" style="margin:0">Próximas ações</h2><p class="portal-muted" style="margin:.3rem 0 0">Nada pendente. Tudo em dia.</p></section>'; return A; }
    var item = function (a, i) { return '<li><button type="button" class="crm-next__item" data-i="' + i + '"><span class="crm-next__dot crm-next__dot--' + a.p + '" aria-hidden="true"></span><span><strong>' + esc(a.title) + '</strong><span>' + esc(a.sub) + '</span></span></button></li>'; };
    el.innerHTML = '<section class="portal-card crm-next"><div class="crm-next__head"><h2 class="portal-h2" style="margin:0">Próximas ações <span class="crm-next__n">' + A.length + '</span></h2>' + (A.length > 6 ? '<button type="button" class="linklike" id="crm-next-all">Ver todas</button>' : '') + '</div>' +
      '<ul class="crm-next__list" id="crm-next-list">' + A.slice(0, 6).map(item).join('') + '</ul></section>';
    var wire = function () {
      el.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { var a = A[+b.dataset.i].act; if (a.lead && onLead) onLead(a.lead); else if (a.href) ERoute.go(a.href); }; });
    };
    if (el.querySelector('#crm-next-all')) el.querySelector('#crm-next-all').onclick = function () { el.querySelector('#crm-next-list').innerHTML = A.map(item).join(''); this.remove(); wire(); };
    wire();
    return A;
  }

  /* ---------- automations + onboarding video ---------- */
  async function automations(ctx) {
    var sb = ctx.sb, esc = ctx.esc;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Automações do CRM</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div><div id="au-body"><p class="portal-muted">Carregando…</p></div>');
    var res = await Promise.all([sb.from('crm_settings').select('*').eq('id', 1).single(), call(ctx, { action: 'status' }).catch(function () { return {}; }),
      sb.from('crm_messages').select('created_at, kind, channel, to_addr, subject, status, error').order('created_at', { ascending: false }).limit(40)]);
    var s = res[0].data || {}, st = res[1] || {}, log = res[2].data || [], dd = s.followup_days || [2, 7];
    var chk = function (id, on, label, note, dis) { return '<div class="check-row au-row"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><label for="' + id + '"><strong>' + label + '</strong><span>' + note + '</span></label></div>'; };
    var B = ctx.$('#au-body', o);
    B.innerHTML =
      '<p class="mk-status">' + '<span class="pill">' + (st.email ? 'E-mail: ' + (st.via === 'ses' ? 'Amazon SES' : 'Gmail') : 'E-mail não configurado') + '</span> <span class="pill">' + (st.whatsapp ? 'WhatsApp conectado' : 'WhatsApp: aguardando a Meta') + '</span> <span class="pill">' + (st.ai ? 'IA ativa' : 'IA não configurada') + '</span></p>' +
      '<form class="portal-form" id="au-f" novalidate>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin:.5rem 0 0">Clientes e leads</h3>' +
      chk('au-fu', s.followup_enabled !== false, 'Follow-up automático de leads', 'Para quem chegou pelo site, agendamento ou indicação e ainda está como <em>Novo</em>, sem agendamento. O e-mail convida para agendar a conversa. Para quando o lead agenda, muda de status ou você marca "Parar follow-ups".') +
      '<div class="portal-grid2 au-days"><div class="field"><label for="au-d1">1º follow-up (dias)</label><input id="au-d1" type="number" min="1" max="30" value="' + (+dd[0] || 2) + '"></div><div class="field"><label for="au-d2">2º follow-up (dias)</label><input id="au-d2" type="number" min="2" max="60" value="' + (+dd[1] || 7) + '"></div></div>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin:.75rem 0 0">Parceiros</h3>' +
      chk('au-pn', s.partner_notify !== false, 'Avisar o parceiro a cada etapa', 'E-mail quando a indicação dele avança (em contato, proposta, virou cliente, concluída), quando o cliente paga e quando a comissão é enviada.') +
      chk('au-pr', s.partner_reminders !== false, 'Lembretes de onboarding', 'No 3º e no 7º dia: criar a senha, escolher como recebe, conectar o Stripe e assinar o contrato.') +
      chk('au-wa', !!s.whatsapp_enabled, 'Também por WhatsApp', st.whatsapp ? 'Usa o modelo de mensagem aprovado na Meta.' : 'Liga depois que a Meta aprovar a conta e o modelo de mensagem.', !st.whatsapp) +
      '<h3 class="portal-h2" style="font-size:1rem;margin:.75rem 0 0">Vídeo de onboarding do parceiro</h3>' +
      '<p class="portal-muted" style="font-size:.88rem;margin:.2rem 0 .4rem">Aparece no topo da página "Comece aqui" do Portal do Parceiro. Cole um link do YouTube ou Vimeo, ou envie o arquivo (MP4, até 50 MB).</p>' +
      '<div class="field"><label for="au-vurl">Link do vídeo</label><input id="au-vurl" type="url" placeholder="https://www.youtube.com/watch?v=…" value="' + esc(s.partner_video_url || '') + '"></div>' +
      '<div class="portal-btn-row" style="align-items:center"><label class="btn btn--ghost btn--xs" for="au-vfile" style="cursor:pointer">Enviar arquivo de vídeo</label><input type="file" id="au-vfile" accept="video/mp4,video/webm,video/quicktime" hidden>' +
        (s.partner_video_url ? '<button type="button" class="btn btn--ghost btn--xs" id="au-vdel">Remover vídeo</button>' : '') + '<span class="portal-muted" id="au-vst" style="font-size:.85rem"></span></div>' +
      '<div id="au-vprev" style="margin-top:.6rem"></div>' +
      '<div class="portal-alert" id="au-m" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button><button class="btn btn--ghost" type="button" id="au-run">Rodar agora</button></div></form>' +
      '<h3 class="portal-h2" style="font-size:1rem;margin-top:1.5rem">Mensagens automáticas recentes</h3>' +
      (log.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Quando</th><th>Mensagem</th><th>Para</th><th>Status</th></tr></thead><tbody>' + log.map(function (m) {
        return '<tr><td>' + esc(ctx.fmtDT(m.created_at)) + '</td><td>' + esc(KIND_MSG[m.kind] || m.kind) + '<span class="sub">' + esc(m.subject || '') + '</span></td><td>' + esc(m.channel === 'whatsapp' ? 'WhatsApp ' : '') + esc(m.to_addr || '') + '</td><td><span class="badge badge--' + (m.status === 'sent' ? 'client' : m.status === 'failed' ? 'lost' : 'new') + '"' + (m.error ? ' title="' + esc(m.error) + '"' : '') + '>' + ({ sent: 'Enviado', failed: 'Falhou', skipped: 'Ignorado', sending: 'Enviando' })[m.status] + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="empty">Nenhuma mensagem automática ainda.</p>');
    var m = ctx.$('#au-m', o), url = ctx.$('#au-vurl', o);
    var prev = function () { var v = url.value.trim(); ctx.$('#au-vprev', o).innerHTML = v ? '<div class="ob-video" style="max-width:26rem">' + (/youtu|vimeo/.test(v) ? '<iframe src="' + esc(embed(v)) + '" title="Prévia" allowfullscreen></iframe>' : '<video controls preload="metadata" src="' + esc(v) + '"></video>') + '</div>' : ''; };
    url.oninput = prev; prev();
    var save = async function (extra) {
      var d1 = Math.max(1, Math.min(30, +ctx.$('#au-d1', o).value || 2)), d2 = Math.max(d1 + 1, Math.min(60, +ctx.$('#au-d2', o).value || 7)), v = url.value.trim();
      if (v && !/^https:\/\//.test(v)) throw new Error('O link do vídeo precisa começar com https://');
      var u = (await sb.auth.getUser()).data.user;
      var row = Object.assign({ followup_enabled: ctx.$('#au-fu', o).checked, followup_days: [d1, d2], partner_notify: ctx.$('#au-pn', o).checked, partner_reminders: ctx.$('#au-pr', o).checked, whatsapp_enabled: ctx.$('#au-wa', o).checked,
        partner_video_url: v || null, updated_at: new Date().toISOString(), updated_by: u && u.email }, v !== (s.partner_video_url || '') ? { partner_video_updated_at: new Date().toISOString() } : {}, extra || {});
      var r = await sb.from('crm_settings').update(row).eq('id', 1);
      if (r.error) throw r.error;
      Object.assign(s, row);
    };
    ctx.$('#au-f', o).onsubmit = async function (e) { e.preventDefault(); var b = this.querySelector('button[type=submit]'); b.disabled = true; try { await save(); ctx.msg(m, 'Salvo.', 'ok'); } catch (x) { ctx.msg(m, x.message && !x.code ? x.message : ctx.errText(x), 'error'); } b.disabled = false; };
    ctx.$('#au-run', o).onclick = async function () {
      var b = this; b.disabled = true; ctx.msg(m, 'Rodando as automações…', 'info');
      try { var r = await call(ctx, { action: 'run_now' }); ctx.msg(m, r.waiting ? 'O envio de e-mails não está configurado.' : 'Pronto: ' + (r.referral + r.paid + r.commission) + ' aviso(s) a parceiros, ' + r.followup + ' follow-up(s), ' + r.partner + ' lembrete(s).', 'ok'); }
      catch (x) { ctx.msg(m, err(ctx, x), 'error'); }
      b.disabled = false;
    };
    ctx.$('#au-vfile', o).onchange = async function () {
      var f = this.files[0]; if (!f) return;
      var vst = ctx.$('#au-vst', o);
      if (f.size > 50 * 1024 * 1024) { vst.textContent = ''; return ctx.msg(m, 'O arquivo passa de 50 MB. Comprima o vídeo ou use um link do YouTube.', 'error'); }
      vst.textContent = 'Enviando ' + f.name + '…';
      var path = 'partner-onboarding/' + Date.now() + '-' + f.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60);
      var up = await sb.storage.from('media').upload(path, f, { contentType: f.type || 'video/mp4', upsert: false });
      if (up.error) { vst.textContent = ''; return ctx.msg(m, ctx.errText(up.error), 'error'); }
      url.value = sb.storage.from('media').getPublicUrl(path).data.publicUrl; prev();
      try { await save(); vst.textContent = 'Vídeo enviado e salvo.'; } catch (x) { ctx.msg(m, ctx.errText(x), 'error'); }
    };
    if (ctx.$('#au-vdel', o)) ctx.$('#au-vdel', o).onclick = async function () { if (!confirm('Remover o vídeo do onboarding dos parceiros?')) return; url.value = ''; prev(); try { await save(); ctx.msg(m, 'Vídeo removido.', 'ok'); this.remove(); } catch (x) { ctx.msg(m, ctx.errText(x), 'error'); } };
  }
  function embed(u) {
    var yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(u), vm = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
    return yt ? 'https://www.youtube-nocookie.com/embed/' + yt[1] : vm ? 'https://player.vimeo.com/video/' + vm[1] : u;
  }

  /* ---------- inside a lead: AI assistant, reply by e-mail, automatic messages ---------- */
  var KIND_PT = { lead: 'Lead', prospect: 'Prospect', partner: 'Parceiro (prospect)' }, ST_PT = { new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', proposal: 'Proposta', lost: 'Perdido' };
  async function leadPanel(ctx, l, el, onApply) {
    var sb = ctx.sb, esc = ctx.esc;
    var msgs = (await sb.from('crm_messages').select('created_at, kind, channel, subject, status').eq('lead_id', l.id).order('created_at', { ascending: false }).limit(20)).data || [];
    el.innerHTML = '<section class="crm-ai"><div class="crm-ai__head"><h3 style="margin:0">Assistente do CRM</h3><button class="btn btn--ghost btn--xs" type="button" id="ai-go">✦ Sugerir com IA</button></div>' +
      '<div id="ai-out"></div>' +
      '<details class="crm-reply" id="ai-reply"><summary>Responder por e-mail</summary><div class="field"><label for="ai-subj">Assunto</label><input id="ai-subj" maxlength="150"></div><div class="field"><label for="ai-body">Mensagem</label><textarea id="ai-body" rows="8" maxlength="6000"></textarea></div>' +
        '<p class="portal-muted" style="font-size:.82rem;margin:0">Sai de support@endeavorbiz.com com o layout da Endeavor. As respostas do cliente chegam no support@.</p><div class="portal-alert" id="ai-sm" role="alert"></div><button class="btn btn--navy btn--xs" type="button" id="ai-send">Enviar e-mail</button></details>' +
      '<div class="check-row" style="margin-top:.6rem"><input type="checkbox" id="ai-stop"' + (l.followup_stop ? ' checked' : '') + '><label for="ai-stop">Parar follow-ups automáticos para este contato</label></div>' +
      (msgs.length ? '<h3 style="margin:1rem 0 .3rem;font-size:.95rem">Mensagens do CRM</h3><ul class="list">' + msgs.map(function (x) { return '<li><div class="list__main"><strong>' + esc(KIND_MSG[x.kind] || x.kind) + '</strong><span>' + esc(ctx.fmtDT(x.created_at)) + ' · ' + esc(x.subject || '') + (x.channel === 'whatsapp' ? ' · WhatsApp' : '') + '</span></div><span class="badge badge--' + (x.status === 'sent' ? 'client' : x.status === 'failed' ? 'lost' : 'new') + '">' + ({ sent: 'Enviado', failed: 'Falhou', skipped: 'Ignorado', sending: 'Enviando' })[x.status] + '</span></li>'; }).join('') + '</ul>' : '') + '</section>';
    ctx.$('#ai-stop', el).onchange = async function () { var r = await sb.from('leads').update({ followup_stop: this.checked }).eq('id', l.id); if (!r.error) l.followup_stop = this.checked; };
    ctx.$('#ai-go', el).onclick = async function () {
      var b = this, out = ctx.$('#ai-out', el); b.disabled = true; b.textContent = 'Analisando…';
      try {
        var r = await call(ctx, { action: 'ai_suggest', lead_id: l.id });
        out.innerHTML = '<div class="crm-ai__card crm-ai__card--' + r.urgency + '"><p style="margin:0 0 .4rem">' + esc(r.summary) + '</p><p style="margin:0"><strong>Próximo passo:</strong> ' + esc(r.next_action) + '</p>' +
          '<p class="portal-muted" style="margin:.4rem 0 0;font-size:.86rem">Sugestão: ' + esc(KIND_PT[r.kind] || r.kind) + ' · ' + esc(ST_PT[r.status] || r.status) + (r.service ? ' · ' + esc(r.service) : '') + '</p>' +
          '<div class="portal-btn-row" style="margin-top:.5rem"><button class="btn btn--ghost btn--xs" type="button" id="ai-apply">Aplicar tipo e status</button></div></div>';
        ctx.$('#ai-apply', el).onclick = function () { if (onApply) onApply(r); this.textContent = 'Aplicado (clique em Salvar)'; this.disabled = true; };
        if (r.reply_subject) ctx.$('#ai-subj', el).value = r.reply_subject;
        if (r.reply_body) ctx.$('#ai-body', el).value = r.reply_body;
        ctx.$('#ai-reply', el).open = true;
      } catch (x) { out.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">' + esc(err(ctx, x)) + '</div>'; }
      b.disabled = false; b.textContent = '✦ Sugerir com IA';
    };
    ctx.$('#ai-send', el).onclick = async function () {
      var b = this, sm = ctx.$('#ai-sm', el), subj = ctx.$('#ai-subj', el).value.trim(), body = ctx.$('#ai-body', el).value.trim();
      if (subj.length < 3 || body.length < 10) return ctx.msg(sm, ERR.empty, 'error');
      if (!confirm('Enviar este e-mail para ' + l.email + '?')) return;
      b.disabled = true;
      try { await call(ctx, { action: 'send_email', lead_id: l.id, subject: subj, body: body }); ctx.msg(sm, 'E-mail enviado para ' + l.email + '.', 'ok'); if (l.status === 'new') l.status = 'contacted'; }
      catch (x) { ctx.msg(sm, err(ctx, x), 'error'); }
      b.disabled = false;
    };
  }

  window.AdminCRM = { nextActions: nextActions, automations: automations, leadPanel: leadPanel, call: call };
})();
