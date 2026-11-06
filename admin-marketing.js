/* Admin console: Marketing (own e-mail campaigns).
   Campaigns (editor with live preview, test, schedule, report per lead), contacts and lists (CSV / Excel import), sender settings.
   Sending runs on the server (marketing function, every minute) through Amazon SES. */
(function () {
  'use strict';
  var KIND = { realtor: 'Corretor de imóveis', accountant: 'Contador', attorney: 'Advogado', bookkeeping: 'Bookkeeping', property_management: 'Property management', financial: 'Financeiro / bancário', other: 'Outro' };
  var LANGS = { pt: 'Português', en: 'English', es: 'Español' };
  var CST = { draft: 'Rascunho', scheduled: 'Agendada', sending: 'Enviando', sent: 'Enviada', paused: 'Pausada', cancelled: 'Cancelada' };
  var CST_B = { draft: 'new', scheduled: 'contacted', sending: 'qualified', sent: 'client', paused: 'contacted', cancelled: 'lost' };
  var MST = { subscribed: 'Inscrito', unsubscribed: 'Descadastrado', bounced: 'E-mail inválido', complained: 'Marcou como spam' };
  var ctx, esc, sb, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function param(k) { return (ERoute.get().match(new RegExp('[?&]' + k + '=([^&]+)')) || [])[1]; }
  function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 + '%' : '—'; }
  function lc(s) { return String(s || '').trim().toLowerCase(); }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  async function fnCall(payload) {
    var sess = (await sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (sess ? sess.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return null; });
    return j || { error: 'HTTP ' + r.status };
  }
  async function rpc(name, args) { var r = await sb.rpc(name, args || {}); return r.error ? [] : (r.data || []); }
  // all rows of a table in pages of 1000
  async function all(q) { var out = [], from = 0; for (;;) { var r = await q().range(from, from + 999); if (r.error) throw r.error; out = out.concat(r.data || []); if (!r.data || r.data.length < 1000) return out; from += 1000; } }

  async function view(v, c) {
    ctx = c; esc = c.esc; sb = c.sb;
    var tab = param('tab') || 'campanhas', cid = param('c'), rid = param('r');
    var TABS = [['campanhas', 'Campanhas'], ['templates', 'Templates'], ['contatos', 'Contatos e listas'], ['config', 'Envio e configurações']];
    v.innerHTML = (cid ? '<h1 class="sr-only">Marketing</h1>' : '<div class="console__head"><div><h1>Marketing</h1><p class="portal-muted">Campanhas de e-mail próprias: listas, agendamento, descadastro, aberturas e cliques por lead.</p></div></div>') +
      '<nav class="subtabs' + (cid ? ' mk-subtabs--tight' : '') + '" aria-label="Marketing">' + TABS.map(function (t) { return '<a href="#/marketing?tab=' + t[0] + '"' + (t[0] === tab && !cid && !rid ? ' aria-current="page"' : (t[0] === 'campanhas' && (cid || rid) ? ' aria-current="page"' : '')) + '>' + t[1] + '</a>'; }).join('') + '</nav><div id="mk-body"></div>';
    var body = $('#mk-body', v);
    var st = (await sb.from('mkt_settings').select('*').eq('id', 1).maybeSingle()).data || {};
    if (!st.ses_connected && tab !== 'config' && !cid) body.insertAdjacentHTML('beforebegin', '<div class="portal-alert portal-alert--info" style="display:block">A Amazon SES ainda não está conectada. Você já pode montar listas e campanhas; as campanhas agendadas saem sozinhas assim que a conexão for feita (veja <a href="#/marketing?tab=config">Envio e configurações</a>).</div>');
    if (cid) return editor(body, cid, st);
    if (rid) return report(body, rid);
    if (tab === 'templates') return gallery(body, st);
    if (tab === 'contatos') return contacts(body);
    if (tab === 'config') return settings(body, st);
    return campaigns(body);
  }

  /* ---------------- campaigns ---------------- */
  async function campaigns(body) {
    var res = await Promise.all([ctx.q(sb.from('mkt_campaigns').select('*').order('created_at', { ascending: false })), ctx.q(sb.from('mkt_lists').select('id,name'))]);
    var cs = res[0], lists = res[1];
    var stats = cs.length ? await rpc('mkt_campaign_stats', { p_ids: cs.map(function (c) { return c.id; }) }) : [];
    var S = {}; stats.forEach(function (x) { S[x.campaign_id] = x; });
    var lname = function (ids) { return (ids || []).map(function (id) { var l = lists.find(function (x) { return x.id === id; }); return l ? l.name : ''; }).filter(Boolean).join(', '); };
    body.innerHTML = '<div class="portal-btn-row" style="justify-content:flex-end;margin-bottom:1rem"><a class="btn btn--navy btn--xs" href="#/marketing?c=novo">Nova campanha</a></div>' +
      (cs.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Campanha</th><th>Status</th><th>Listas</th><th>Quando</th><th class="num">Enviados</th><th class="num">Aberturas</th><th class="num">Cliques</th><th class="num">Descadastros</th></tr></thead><tbody>' +
        cs.map(function (c) {
          var x = S[c.id] || { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 };
          var when = c.status === 'sent' ? c.finished_at : c.scheduled_at;
          return '<tr data-id="' + c.id + '" data-st="' + c.status + '" tabindex="0"><td><strong>' + esc(c.name) + '</strong><span class="sub">' + esc(c.template === 'partners' ? 'Modelo: Programa de parceiros' : 'Modelo: personalizado') + '</span></td>' +
            '<td><span class="badge badge--' + CST_B[c.status] + '">' + CST[c.status] + '</span></td><td>' + esc(lname(c.list_ids) || '—') + '</td><td>' + esc(when ? ctx.fmtDT(when) : '—') + '</td>' +
            '<td class="num">' + (+x.sent) + '</td><td class="num">' + pct(+x.opened, +x.sent) + '</td><td class="num">' + pct(+x.clicked, +x.sent) + '</td><td class="num">' + (+x.unsubscribed) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state portal-card"><strong>Nenhuma campanha ainda</strong><p>Importe a sua lista em Contatos e listas e crie a primeira campanha. O modelo "Programa de parceiros" já vem pronto em português, inglês e espanhol.</p></div>');
    $$('tr[data-id]', body).forEach(function (tr) {
      var go = function () { ERoute.go('#/marketing?' + (/draft|scheduled/.test(tr.dataset.st) ? 'c=' : 'r=') + tr.dataset.id); };
      tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    });
  }

  async function editor(body, cid, st) {
    var isNew = cid === 'novo';
    var c = isNew ? { name: '', template: 'partners', language: 'auto', list_ids: [], status: 'draft' } : (await sb.from('mkt_campaigns').select('*').eq('id', cid).single()).data;
    if (!c) { body.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">Campanha não encontrada.</div>'; return; }
    if (!/draft|scheduled/.test(c.status)) return ERoute.go('#/marketing?r=' + cid);
    var res = await Promise.all([ctx.q(sb.from('mkt_lists').select('*').order('name')), rpc('mkt_list_counts'), ctx.q(sb.from('mkt_templates').select('*').order('created_at', { ascending: false }))]);
    var lists = res[0], cnt = {}, tpls = res[2] || []; res[1].forEach(function (x) { cnt[x.list_id] = x; });
    var T = window.EMkt.texts, plang = 'pt', pname = 'Maria';
    var tplId = c.template_id || null, tplData = c.tpl_data || null;
    var pre = isNew && param('tpl') ? tpls.find(function (t) { return t.id === param('tpl'); }) : null;
    if (pre) { c.template = 'ai'; tplId = pre.id; tplData = pre.data; }
    var fld = function (id, label, val, ph, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(val || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (extra || '') + '></div>'; };
    var local = function (d) { if (!d) return ''; var x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
    body.innerHTML = '<div class="mk-edhead"><p class="crumbs" style="margin:0"><a href="#/marketing">Campanhas</a> / ' + esc(isNew ? 'Nova campanha' : c.name) + '</p>' +
      '<div class="portal-btn-row" style="margin:0"><button class="btn btn--ghost btn--xs" type="button" id="mk-prev"><svg class="icon" aria-hidden="true"><use href="#i-mail"/></svg> Ver prévia</button><button class="btn btn--navy btn--xs" type="button" id="mk-save">Salvar rascunho</button>' + (isNew ? '' : '<button class="btn btn--danger btn--xs" type="button" id="mk-del">Excluir</button>') + '</div></div>' +
      (c.status === 'scheduled' ? '<div class="portal-alert portal-alert--info" style="display:block;margin:0 0 .6rem">Agendada para ' + esc(ctx.fmtDT(c.scheduled_at)) + '. Para mudar, edite e agende de novo, ou cancele o agendamento.</div>' : '') +
      '<div class="portal-alert" id="mk-msg" role="status" style="margin:0 0 .6rem"></div>' +
      '<div class="mk-editor"><section class="portal-card mk-col"><h2 class="mk-colh">Para quem e quando</h2>' +
      '<div class="mk-row32">' + fld('mk-name', 'Nome interno da campanha', c.name, 'Ex.: Parceiros - corretores Orlando - nov/2026') +
      '<div class="field"><label for="mk-lang">Idioma</label><select id="mk-lang" title="Automático: cada contato recebe no idioma dele"><option value="auto">Automático (do contato)</option><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div></div>' +
      '<div class="field"><span style="font-weight:600">Enviar para as listas</span><div class="mk-lists">' + (lists.length ? lists.map(function (l) { var n = cnt[l.id] ? +cnt[l.id].subscribed : 0; return '<label class="check-row"><input type="checkbox" value="' + l.id + '"' + ((c.list_ids || []).indexOf(l.id) > -1 ? ' checked' : '') + '> ' + esc(l.name) + ' <span class="portal-muted">(' + n + ' inscritos)</span></label>'; }).join('') : '<p class="portal-muted">Nenhuma lista ainda. Crie em <a href="#/marketing?tab=contatos">Contatos e listas</a>.</p>') + '</div><p class="portal-muted" id="mk-reach" style="font-size:.84rem;margin:.25rem 0 0"></p></div>' +
      '<div class="mk-box"><strong class="mk-boxh">Enviar teste</strong><div class="mk-inline"><input id="mk-to" type="email" value="' + esc(st.reply_to || '') + '" aria-label="E-mail para o teste"><select id="mk-tlang" aria-label="Idioma do teste"><option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option></select><button class="btn btn--ghost btn--xs" type="button" id="mk-test">Enviar teste</button></div></div>' +
      '<div class="mk-box"><strong class="mk-boxh">Enviar a campanha</strong><div class="mk-inline"><input id="mk-when" type="datetime-local" value="' + esc(local(c.scheduled_at)) + '" aria-label="Data e hora do envio"><button class="btn btn--navy btn--xs" type="button" id="mk-sched">Agendar</button><button class="btn btn--ghost btn--xs" type="button" id="mk-now">Enviar agora</button>' +
        (c.status === 'scheduled' ? '<button class="btn btn--ghost btn--xs" type="button" id="mk-unsched">Cancelar agendamento</button>' : '') + '</div>' +
        '<p class="portal-muted" style="font-size:.8rem;margin:.35rem 0 0">Horário do seu computador. Todo e-mail leva descadastro e endereço.</p></div>' +
      '</section><section class="portal-card mk-col mk-form"><h2 class="mk-colh">Conteúdo</h2>' +
      '<div class="field"><label for="mk-tpl">Modelo</label><div class="mk-inline mk-tplrow"><select id="mk-tpl"></select><button class="btn btn--ghost btn--xs" type="button" id="mk-ai"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg> Criar template com IA</button></div><p class="portal-muted" id="mk-tplnote" style="font-size:.8rem;margin:.3rem 0 0"></p></div>' +
      '<div class="portal-grid2">' + fld('mk-subject', 'Assunto', c.subject, '') + fld('mk-pre', 'Pré-cabeçalho', c.preheader, '', ' title="Texto curto que aparece ao lado do assunto na caixa de entrada"') + '</div>' + fld('mk-heading', 'Título', c.heading, '') +
      '<div class="field"><label for="mk-text">Texto</label><textarea id="mk-text" rows="3" placeholder="">' + esc(c.body || '') + '</textarea><p class="portal-muted" style="font-size:.8rem;margin:.25rem 0 0">Use {{nome}} e {{empresa}} para personalizar; uma linha em branco separa parágrafos.</p></div>' +
      '<div class="portal-grid2">' + fld('mk-btn', 'Texto do botão', c.button_label, '') + fld('mk-url', 'Link do botão (https://…)', c.button_url, '', ' type="url"') + '</div>' +
      '</section></div>';
    function tplOptions() {
      var hasSnap = c.template === 'ai' && c.tpl_data && !tpls.some(function (t) { return t.id === c.template_id; });
      return '<option value="partners">Programa de parceiros (pronto)</option>' +
        (tpls.length ? '<optgroup label="Galeria de templates">' + tpls.map(function (t) { return '<option value="ai:' + t.id + '">' + esc(t.name) + '</option>'; }).join('') + '</optgroup>' : '') +
        (hasSnap ? '<option value="ai:snap">Template desta campanha</option>' : '') +
        '<option value="custom">Texto simples (eu escrevo)</option><option value="__new">+ Personalizado: criar com IA…</option>';
    }
    var sel = $('#mk-tpl', body), prevSel;
    function setTplSel() { sel.innerHTML = tplOptions(); sel.value = c.template === 'ai' ? (tplId && tpls.some(function (t) { return t.id === tplId; }) ? 'ai:' + tplId : 'ai:snap') : c.template; prevSel = sel.value; }
    setTplSel(); $('#mk-lang', body).value = c.language;
    function openCreator() {
      aiCreator(null, function (t) { tpls.unshift(t); c.template = 'ai'; tplId = t.id; tplData = t.data; setTplSel(); preview(); ctx.msg($('#mk-msg'), 'Template salvo na galeria e escolhido para esta campanha.', 'ok'); });
    }
    sel.onchange = function () {
      var v = sel.value;
      if (v === '__new') { sel.value = prevSel; openCreator(); return; }
      if (v.indexOf('ai:') === 0) { c.template = 'ai'; if (v !== 'ai:snap') { var t = tpls.find(function (x) { return 'ai:' + x.id === v; }); tplId = t.id; tplData = t.data; } else { tplId = c.template_id; tplData = c.tpl_data; } }
      else { c.template = v; tplId = null; tplData = null; }
      prevSel = v; preview();
    };
    $('#mk-ai', body).onclick = openCreator;
    function read() {
      var tpl = c.template;
      return { name: $('#mk-name').value.trim(), template: tpl, template_id: tpl === 'ai' ? tplId : null, tpl_data: tpl === 'ai' ? tplData : null, language: $('#mk-lang').value, subject: $('#mk-subject').value.trim() || null, preheader: $('#mk-pre').value.trim() || null,
        heading: $('#mk-heading').value.trim() || null, body: $('#mk-text').value.trim() || null, button_label: $('#mk-btn').value.trim() || null, button_url: $('#mk-url').value.trim() || null,
        list_ids: $$('.mk-lists input:checked', body).map(function (i) { return i.value; }) };
    }
    function placeholders() {
      var tpl = c.template, t = T[plang], ph, note;
      if (tpl === 'partners') { ph = { subject: t.subject.replace('{nome}', '{{nome}}'), pre: t.pre, heading: t.h1, body: 'Opcional: substitui o parágrafo de apresentação.', btn: t.cta, url: 'https://endeavorbiz.com/schedule.html (agendar conversa)' }; note = 'Textos prontos em PT, EN e ES. Campo em branco usa o texto do modelo.'; }
      else if (tpl === 'ai' && tplData) {
        var d = tplData[plang] || tplData[(tplData.languages || [])[0]] || {};
        ph = { subject: d.subject || '', pre: d.preheader || '', heading: d.heading || '', body: 'Opcional: substitui a introdução do template.', btn: d.cta || '', url: tplData.button_url || 'https://endeavorbiz.com/schedule.html (agendar conversa)' };
        note = 'Template da galeria (' + (tplData.languages || []).map(function (l) { return l.toUpperCase(); }).join(', ') + '). Campo em branco usa o texto do template.';
      } else { ph = { subject: 'Assunto do e-mail', pre: 'Resumo curto', heading: 'Título no topo do e-mail', body: 'Olá, {{nome}}!\n\nEscreva aqui a mensagem.', btn: 'Ex.: Agendar uma conversa', url: 'https://' }; note = 'Você escreve o texto; ele é o mesmo para todos os contatos.'; }
      $('#mk-subject').placeholder = ph.subject; $('#mk-pre').placeholder = ph.pre; $('#mk-heading').placeholder = ph.heading; $('#mk-text').placeholder = ph.body; $('#mk-btn').placeholder = ph.btn; $('#mk-url').placeholder = ph.url;
      $('#mk-tplnote').textContent = note;
    }
    function renderNow() { return window.EMkt.render(read(), { name: pname, company: 'Exemplo Realty', language: plang }, { site: 'https://endeavorbiz.com', address: st.postal_address, replyTo: st.reply_to, unsubUrl: 'https://endeavorbiz.com/unsubscribe.html' }); }
    function preview() {
      placeholders();
      var o = $('#overlay'); if (o.hidden || !$('#pv-frame', o)) return;
      var r = renderNow(); $('#pv-subject', o).innerHTML = '<strong>Assunto:</strong> ' + esc(r.subject); $('#pv-frame', o).srcdoc = r.html;
    }
    $('#mk-prev', body).onclick = function () {
      var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Prévia do e-mail</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
        '<div class="mk-inline" style="margin:0 0 .5rem"><select id="pv-lang" aria-label="Idioma da prévia"><option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option></select><input id="pv-name" value="' + esc(pname) + '" aria-label="Nome de exemplo" style="width:8rem"></div>' +
        '<p class="portal-muted" id="pv-subject" style="margin:0 0 .5rem;font-size:.9rem"></p><iframe id="pv-frame" class="mk-frame" title="Prévia do e-mail" sandbox=""></iframe>');
      o.firstChild.classList.add('drawer--wide');
      $('#pv-lang', o).value = plang;
      $('#pv-lang', o).onchange = function () { plang = this.value; preview(); };
      $('#pv-name', o).oninput = function () { pname = this.value; preview(); };
      preview();
    };
    async function reach() {
      var ids = read().list_ids; if (!ids.length) { $('#mk-reach').textContent = 'Escolha pelo menos uma lista.'; return; }
      var mem = await all(function () { return sb.from('mkt_list_members').select('contact_id, mkt_contacts(status)').in('list_id', ids); });
      var u = {}; mem.forEach(function (m) { if (m.mkt_contacts && m.mkt_contacts.status === 'subscribed') u[m.contact_id] = 1; });
      $('#mk-reach').textContent = Object.keys(u).length + ' contatos inscritos vão receber (sem repetir quem está em mais de uma lista).';
    }
    $$('.mk-lists input', body).forEach(function (i) { i.addEventListener('change', reach); });
    placeholders(); reach();
    async function save(extra) {
      var row = Object.assign(read(), extra || {}), m = $('#mk-msg');
      if (row.name.length < 2) { ctx.msg(m, 'Dê um nome interno à campanha.', 'error'); return null; }
      if (row.button_url && !/^https:\/\//.test(row.button_url)) { ctx.msg(m, 'O link do botão precisa começar com https://', 'error'); return null; }
      if (row.template === 'custom' && (!row.subject || !row.body)) { ctx.msg(m, 'No texto simples, preencha o assunto e o texto.', 'error'); return null; }
      if (row.template === 'ai' && !row.tpl_data) { ctx.msg(m, 'Escolha um template da galeria.', 'error'); return null; }
      var r = isNew ? await sb.from('mkt_campaigns').insert(Object.assign(row, { created_by: (await sb.auth.getUser()).data.user.email })).select('id').single() : await sb.from('mkt_campaigns').update(row).eq('id', cid).select('id').single();
      if (r.error) { ctx.msg(m, ctx.errText(r.error), 'error'); return null; }
      if (isNew) { isNew = false; cid = r.data.id; ERoute.set('#/marketing?c=' + cid, true); }
      return cid;
    }
    $('#mk-save').onclick = async function () { if (await save()) ctx.msg($('#mk-msg'), 'Rascunho salvo.', 'ok'); };
    if ($('#mk-del', body)) $('#mk-del').onclick = async function () { if (!confirm('Excluir esta campanha?')) return; await sb.from('mkt_campaigns').delete().eq('id', cid); ERoute.go('#/marketing'); };
    $('#mk-test').onclick = async function () {
      var b = this, to = $('#mk-to').value.trim(); if (!EMAIL.test(to)) return ctx.msg($('#mk-msg'), 'Digite um e-mail válido para o teste.', 'error');
      b.disabled = true; var id = await save(); if (!id) { b.disabled = false; return; }
      var j = await fnCall({ action: 'test', campaign_id: id, to: to, language: $('#mk-tlang').value, name: pname }); b.disabled = false;
      ctx.msg($('#mk-msg'), j.ok ? 'Teste enviado para ' + j.to + (j.via === 'gmail' ? ' (pelo Gmail do support, enquanto a Amazon SES não está conectada).' : '.') : 'O teste não saiu: ' + (j.error === 'no_sender' ? 'nenhum serviço de envio conectado.' : j.error), j.ok ? 'ok' : 'error');
    };
    async function schedule(when) {
      var row = read(), m = $('#mk-msg');
      if (!row.list_ids.length) return ctx.msg(m, 'Escolha pelo menos uma lista.', 'error');
      if (!when || isNaN(when.getTime())) return ctx.msg(m, 'Escolha a data e a hora do envio.', 'error');
      var txt = (when <= new Date(Date.now() + 60000) ? 'Enviar a campanha agora' : 'Agendar a campanha para ' + ctx.fmtDT(when.toISOString())) + ' para ' + $('#mk-reach').textContent.replace(/ vão receber.*/, '') + '?';
      if (!confirm(txt)) return;
      var id = await save({ status: 'scheduled', scheduled_at: when.toISOString() }); if (!id) return;
      ERoute.go('#/marketing?r=' + id);
    }
    $('#mk-sched').onclick = function () { var v = $('#mk-when').value; schedule(v ? new Date(v) : null); };
    $('#mk-now').onclick = function () { schedule(new Date()); };
    if ($('#mk-unsched', body)) $('#mk-unsched').onclick = async function () { await sb.from('mkt_campaigns').update({ status: 'draft', scheduled_at: null }).eq('id', cid); ctx.route(); };
  }

  /* ---------------- template gallery + AI creator ---------------- */
  var SAMPLE = { name: 'Maria', company: 'Exemplo Realty' };
  function renderTpl(data, lang, st) {
    return window.EMkt.render({ template: data === 'partners' ? 'partners' : 'ai', tpl_data: data === 'partners' ? null : data, language: lang }, Object.assign({ language: lang }, SAMPLE), { site: 'https://endeavorbiz.com', address: (st || {}).postal_address, replyTo: (st || {}).reply_to, unsubUrl: 'https://endeavorbiz.com/unsubscribe.html' });
  }
  async function gallery(body, st) {
    var tpls = await ctx.q(sb.from('mkt_templates').select('*').order('created_at', { ascending: false }));
    var card = function (id, name, sub, data, builtIn) {
      var langs = data === 'partners' ? ['pt', 'en', 'es'] : (data.languages || []);
      return '<article class="mk-tcard portal-card"><div class="mk-thumb"><iframe tabindex="-1" aria-hidden="true" sandbox="" data-tpl="' + id + '"></iframe></div>' +
        '<div class="mk-tcard__body"><strong>' + esc(name) + '</strong><span class="portal-muted">' + esc(sub) + ' · ' + langs.map(function (l) { return l.toUpperCase(); }).join(' ') + '</span>' +
        '<div class="portal-btn-row" style="margin:.5rem 0 0"><a class="btn btn--navy btn--xs" href="#/marketing?c=novo' + (builtIn ? '' : '&tpl=' + id) + '">Usar em campanha</a><button class="btn btn--ghost btn--xs" type="button" data-act="view" data-id="' + id + '">Ver</button>' +
        (builtIn ? '' : '<button class="btn btn--ghost btn--xs" type="button" data-act="ai" data-id="' + id + '">Ajustar com IA</button><button class="btn btn--ghost btn--xs" type="button" data-act="ren" data-id="' + id + '">Renomear</button><button class="btn btn--danger btn--xs" type="button" data-act="del" data-id="' + id + '">Excluir</button>') + '</div></div></article>';
    };
    body.innerHTML = '<div class="console__head" style="margin-top:0"><div><h2 class="portal-h2" style="margin:0">Galeria de templates</h2><p class="portal-muted" style="margin:.2rem 0 0">Descreva o e-mail e a IA cria o template no padrão da Endeavor (logo, cores, endereço, telefone, WhatsApp e e-mails). Você revisa, ajusta e salva aqui para usar nas campanhas.</p></div>' +
      '<button class="btn btn--navy" type="button" id="tg-new"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg> Criar template com IA</button></div>' +
      '<div class="mk-tgrid">' + card('partners', 'Programa de parceiros', 'Modelo pronto', 'partners', true) + tpls.map(function (t) { return card(t.id, t.name, 'Criado ' + ctx.fmtDT(t.created_at), t.data, false); }).join('') + '</div>' +
      (tpls.length ? '' : '<p class="portal-muted" style="margin-top:1rem">Nenhum template criado ainda. Clique em "Criar template com IA".</p>');
    var get = function (id) { return id === 'partners' ? 'partners' : (tpls.find(function (t) { return t.id === id; }) || {}).data; };
    $$('iframe[data-tpl]', body).forEach(function (f) { var d = get(f.dataset.tpl); f.srcdoc = renderTpl(d, d === 'partners' ? 'pt' : (d.languages || ['pt'])[0], st).html; });
    $('#tg-new').onclick = function () { aiCreator(null, function () { ctx.route(); }); };
    $$('[data-act]', body).forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.id, t = tpls.find(function (x) { return x.id === id; });
        if (b.dataset.act === 'view') return previewTpl(id === 'partners' ? 'Programa de parceiros' : t.name, get(id), st);
        if (b.dataset.act === 'ai') return aiCreator(t, function () { ctx.route(); });
        if (b.dataset.act === 'ren') { var n = prompt('Novo nome do template:', t.name); if (!n || n.trim().length < 2) return; await sb.from('mkt_templates').update({ name: n.trim(), updated_at: new Date().toISOString() }).eq('id', id); return ctx.route(); }
        if (b.dataset.act === 'del') { if (!confirm('Excluir o template "' + t.name + '"? As campanhas que já usam ele continuam iguais.')) return; await sb.from('mkt_templates').delete().eq('id', id); ctx.route(); }
      };
    });
  }
  function previewTpl(name, data, st) {
    var langs = data === 'partners' ? ['pt', 'en', 'es'] : data.languages;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + esc(name) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<div class="mk-inline" style="margin:0 0 .5rem"><select id="tv-lang" aria-label="Idioma da prévia">' + langs.map(function (l) { return '<option value="' + l + '">' + l.toUpperCase() + '</option>'; }).join('') + '</select></div>' +
      '<p class="portal-muted" id="tv-subject" style="margin:0 0 .5rem;font-size:.9rem"></p><iframe id="tv-frame" class="mk-frame" title="Prévia do e-mail" sandbox=""></iframe>');
    o.firstChild.classList.add('drawer--wide');
    var draw = function () { var r = renderTpl(data, $('#tv-lang', o).value, st); $('#tv-subject', o).innerHTML = '<strong>Assunto:</strong> ' + esc(r.subject); $('#tv-frame', o).srcdoc = r.html; };
    $('#tv-lang', o).onchange = draw; draw();
  }
  var AI_ERR = { no_ai_key: 'A IA ainda não está conectada: falta a chave ANTHROPIC_API_KEY no Supabase (Edge Functions → Secrets), a mesma do Operating Agreement. Assim que ela for adicionada, este botão funciona.', brief: 'Descreva o e-mail com um pouco mais de detalhe.', ai_format: 'A IA respondeu num formato inesperado. Tente de novo.', ai_failed: 'A IA não respondeu agora. Tente de novo em instantes.' };
  // existing: template row to adjust (or null to create); done(savedRow)
  function aiCreator(existing, done) {
    var st = null, data = existing ? existing.data : null;
    sb.from('mkt_settings').select('*').eq('id', 1).maybeSingle().then(function (r) { st = r.data; });
    var langs0 = existing ? existing.data.languages : ['pt', 'en', 'es'];
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (existing ? 'Ajustar template' : 'Criar template com IA') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<div class="mk-ai"><div class="mk-ai__form">' +
      '<div class="field"><label for="ai-brief">O que este e-mail deve dizer?</label><textarea id="ai-brief" rows="7" placeholder="Ex.: Convite para contadores brasileiros que atendem clientes com empresa nos EUA. Explicar que cuidamos da abertura da LLC, EIN e compliance, e que o contador continua com a parte fiscal. Tom próximo e profissional. Botão para agendar uma conversa de 20 minutos.">' + esc(existing ? existing.brief || '' : '') + '</textarea></div>' +
      '<div class="field"><span style="font-weight:600">Idiomas</span><div class="mk-inline">' + ['pt', 'en', 'es'].map(function (l) { return '<label class="check-row"><input type="checkbox" class="ai-l" value="' + l + '"' + (langs0.indexOf(l) > -1 ? ' checked' : '') + '> ' + LANGS[l] + '</label>'; }).join('') + '</div></div>' +
      '<p class="portal-muted" style="font-size:.84rem;margin:.2rem 0 .7rem">A IA escreve o texto e escolhe o layout; o logo, as cores, o endereço, o telefone, o WhatsApp, os e-mails e o rodapé com descadastro da Endeavor entram automaticamente.</p>' +
      '<button class="btn btn--navy" type="button" id="ai-gen">' + (existing ? 'Gerar de novo' : 'Gerar com IA') + '</button>' +
      '<div class="field" id="ai-adj" style="margin-top:1rem"' + (data ? '' : ' hidden') + '><label for="ai-adjust">Quer mudar algo? Diga o que ajustar</label><textarea id="ai-adjust" rows="3" placeholder="Ex.: deixe mais curto, troque o título, use cor verde, acrescente um passo sobre a conta bancária."></textarea><button class="btn btn--ghost btn--xs" type="button" id="ai-apply" style="margin-top:.4rem">Aplicar ajuste</button></div>' +
      '<div class="portal-alert" id="ai-msg" role="status"></div>' +
      '<div class="field" style="margin-top:.8rem"><label for="ai-name">Nome na galeria</label><input id="ai-name" value="' + esc(existing ? existing.name : '') + '" placeholder="Ex.: Contadores Brasil - apresentação"></div>' +
      '<button class="btn btn--navy" type="button" id="ai-save"' + (data ? '' : ' disabled') + '>Salvar na galeria</button>' +
      '</div><div class="mk-ai__prev"><div class="mk-inline" style="margin:0 0 .4rem"><strong>Prévia</strong><select id="ai-plang" aria-label="Idioma da prévia"></select></div><p class="portal-muted" id="ai-subject" style="margin:0 0 .4rem;font-size:.88rem"></p>' +
      '<iframe id="ai-frame" class="mk-frame" title="Prévia do template" sandbox=""></iframe></div></div>');
    o.firstChild.classList.add('drawer--wide', 'drawer--xl');
    var msg = $('#ai-msg', o);
    function draw() {
      var ps = $('#ai-plang', o);
      if (!data) { ps.innerHTML = ''; $('#ai-frame', o).srcdoc = '<p style="font:15px Arial,sans-serif;color:#6b7280;padding:2rem;text-align:center">A prévia aparece aqui depois de gerar.</p>'; return; }
      var cur = ps.value; ps.innerHTML = data.languages.map(function (l) { return '<option value="' + l + '">' + l.toUpperCase() + '</option>'; }).join(''); ps.value = data.languages.indexOf(cur) > -1 ? cur : data.languages[0];
      var r = renderTpl(data, ps.value, st); $('#ai-subject', o).innerHTML = '<strong>Assunto:</strong> ' + esc(r.subject); $('#ai-frame', o).srcdoc = r.html;
    }
    $('#ai-plang', o).onchange = draw; draw();
    async function gen(adjust) {
      var brief = $('#ai-brief', o).value.trim(), langs = $$('.ai-l:checked', o).map(function (i) { return i.value; });
      if (brief.length < 10) return ctx.msg(msg, 'Descreva o e-mail com um pouco mais de detalhe.', 'error');
      if (!langs.length) return ctx.msg(msg, 'Escolha pelo menos um idioma.', 'error');
      var bs = [$('#ai-gen', o), $('#ai-apply', o), $('#ai-save', o)]; bs.forEach(function (b) { b.disabled = true; });
      ctx.msg(msg, 'A IA está escrevendo o template… (leva uns 20 a 40 segundos)', 'info');
      var j = await fnCall({ action: 'ai_template', brief: brief, languages: langs, adjust: adjust || undefined, previous: adjust ? data : undefined });
      bs.forEach(function (b) { b.disabled = false; });
      if (!j.ok) { $('#ai-save', o).disabled = !data; return ctx.msg(msg, AI_ERR[j.error] || ('Não foi possível gerar: ' + (j.error || '')), 'error'); }
      data = j.data; if (!$('#ai-name', o).value.trim() && j.name) $('#ai-name', o).value = j.name;
      $('#ai-adj', o).hidden = false; $('#ai-adjust', o).value = ''; draw();
      ctx.msg(msg, 'Pronto. Confira a prévia; se quiser, peça um ajuste ou salve na galeria.', 'ok');
    }
    $('#ai-gen', o).onclick = function () { gen(null); };
    $('#ai-apply', o).onclick = function () { var a = $('#ai-adjust', o).value.trim(); if (a.length < 3) return ctx.msg(msg, 'Diga o que ajustar.', 'error'); gen(a); };
    $('#ai-save', o).onclick = async function () {
      var name = $('#ai-name', o).value.trim(); if (name.length < 2) return ctx.msg(msg, 'Dê um nome ao template.', 'error');
      var row = { name: name, brief: $('#ai-brief', o).value.trim() || null, data: data, updated_at: new Date().toISOString() };
      var r = existing ? await sb.from('mkt_templates').update(row).eq('id', existing.id).select('*').single() : await sb.from('mkt_templates').insert(Object.assign(row, { created_by: (await sb.auth.getUser()).data.user.email })).select('*').single();
      if (r.error) return ctx.msg(msg, ctx.errText(r.error), 'error');
      ctx.closeOverlay(); done(r.data);
    };
  }

  async function report(body, id) {
    var c = (await sb.from('mkt_campaigns').select('*').eq('id', id).single()).data;
    if (!c) { body.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">Campanha não encontrada.</div>'; return; }
    var sends = await all(function () { return sb.from('mkt_sends').select('id, email, name, language, status, error, sent_at, opened_at, open_count, clicked_at, click_count, unsubscribed_at').eq('campaign_id', id).order('id'); });
    var n = function (f) { return sends.filter(f).length; };
    var sent = n(function (s) { return s.status === 'sent'; }), opened = n(function (s) { return s.opened_at; }), clicked = n(function (s) { return s.clicked_at; }), uns = n(function (s) { return s.unsubscribed_at; }), failed = n(function (s) { return s.status === 'failed'; }), queued = n(function (s) { return /queued|sending/.test(s.status); });
    var kpi = function (l, v, sub) { return '<div class="kpi portal-card"><span>' + l + '</span><strong>' + v + '</strong>' + (sub ? '<small class="portal-muted">' + sub + '</small>' : '') + '</div>'; };
    body.innerHTML = '<p class="crumbs"><a href="#/marketing">Campanhas</a> /</p><div class="console__head" style="margin-top:0"><div><h2 class="portal-h2" style="margin:0">' + esc(c.name) + '</h2><p class="portal-muted">' +
      '<span class="badge badge--' + CST_B[c.status] + '">' + CST[c.status] + '</span> ' + (c.scheduled_at ? 'Início ' + esc(ctx.fmtDT(c.scheduled_at)) : '') + (c.finished_at ? ' · concluída ' + esc(ctx.fmtDT(c.finished_at)) : '') + '</p></div>' +
      '<div class="portal-btn-row">' + (c.status === 'sending' ? '<button class="btn btn--ghost btn--xs" id="mk-pause">Pausar</button>' : '') + (c.status === 'paused' ? '<button class="btn btn--navy btn--xs" id="mk-resume">Retomar</button>' : '') +
      (/scheduled|paused/.test(c.status) ? '<button class="btn btn--danger btn--xs" id="mk-cancel">Cancelar campanha</button>' : '') + '<button class="btn btn--ghost btn--xs" id="mk-dup">Duplicar</button><button class="btn btn--ghost btn--xs" id="mk-csv">Exportar CSV</button></div></div>' +
      (c.status === 'scheduled' && !sends.length ? '<div class="portal-alert portal-alert--info" style="display:block">A lista de envio é montada na hora de começar. Até lá, você ainda pode <a href="#/marketing?c=' + id + '">editar a campanha</a>.</div>' : '') +
      '<div class="kpis mk-kpis">' + kpi('Destinatários', sends.length || '—', queued ? queued + ' na fila' : '') + kpi('Enviados', sent, failed ? failed + ' com falha' : '') + kpi('Aberturas', pct(opened, sent), opened + ' pessoas') + kpi('Cliques', pct(clicked, sent), clicked + ' pessoas') + kpi('Descadastros', uns, pct(uns, sent)) + '</div>' +
      '<p class="portal-muted" style="font-size:.84rem">Aberturas dependem das imagens do e-mail serem carregadas; alguns aplicativos (como o Apple Mail) abrem sozinhos, então use os cliques como o sinal mais confiável.</p>' +
      '<div class="toolbar"><input type="search" id="rp-q" placeholder="Buscar e-mail ou nome…" aria-label="Buscar"><select id="rp-f" aria-label="Filtrar"><option value="">Todos</option><option value="opened">Abriram</option><option value="clicked">Clicaram</option><option value="notopened">Não abriram</option><option value="unsub">Descadastraram</option><option value="failed">Falhas</option><option value="queued">Na fila</option></select></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Contato</th><th>Envio</th><th>Abriu</th><th>Clicou</th><th>Descadastro</th></tr></thead><tbody id="rp-body"></tbody></table></div>';
    function draw() {
      var q = lc($('#rp-q').value), f = $('#rp-f').value;
      var rows = sends.filter(function (s) {
        if (q && (s.email + ' ' + (s.name || '')).toLowerCase().indexOf(q) < 0) return false;
        return !f || (f === 'opened' && s.opened_at) || (f === 'clicked' && s.clicked_at) || (f === 'notopened' && s.status === 'sent' && !s.opened_at) || (f === 'unsub' && s.unsubscribed_at) || (f === 'failed' && s.status === 'failed') || (f === 'queued' && /queued|sending/.test(s.status));
      });
      $('#rp-body').innerHTML = rows.length ? rows.slice(0, 1000).map(function (s) {
        var stt = s.status === 'sent' ? esc(ctx.fmtDT(s.sent_at)) : s.status === 'failed' ? '<span class="badge badge--lost" title="' + esc(s.error || '') + '">Falhou</span>' : s.status === 'skipped' ? '<span class="pill">Ignorado</span>' : '<span class="pill">Na fila</span>';
        return '<tr><td><strong>' + esc(s.name || '—') + '</strong><span class="sub">' + esc(s.email) + ' · ' + esc((s.language || '').toUpperCase()) + '</span></td><td>' + stt + '</td>' +
          '<td>' + (s.opened_at ? esc(ctx.fmtDT(s.opened_at)) + (s.open_count > 1 ? ' <span class="pill">' + s.open_count + 'x</span>' : '') : '—') + '</td>' +
          '<td>' + (s.clicked_at ? esc(ctx.fmtDT(s.clicked_at)) + (s.click_count > 1 ? ' <span class="pill">' + s.click_count + 'x</span>' : '') : '—') + '</td><td>' + (s.unsubscribed_at ? esc(ctx.fmtDT(s.unsubscribed_at)) : '—') + '</td></tr>';
      }).join('') + (rows.length > 1000 ? '<tr><td colspan="5" class="portal-muted">Mostrando 1.000 de ' + rows.length + '. Use a busca ou o CSV.</td></tr>' : '') : '<tr><td colspan="5" class="empty">Nada aqui.</td></tr>';
    }
    $('#rp-q').oninput = draw; $('#rp-f').onchange = draw; draw();
    var set = function (st2) { return async function () { await sb.from('mkt_campaigns').update({ status: st2 }).eq('id', id); ctx.route(); }; };
    if ($('#mk-pause')) $('#mk-pause').onclick = set('paused');
    if ($('#mk-resume')) $('#mk-resume').onclick = set('sending');
    if ($('#mk-cancel')) $('#mk-cancel').onclick = async function () { if (confirm('Cancelar a campanha? Quem ainda está na fila não recebe.')) { await sb.from('mkt_sends').update({ status: 'skipped', error: 'cancelled' }).eq('campaign_id', id).eq('status', 'queued'); await set('cancelled')(); } };
    $('#mk-dup').onclick = async function () {
      var copy = { name: c.name + ' (cópia)', template: c.template, template_id: c.template_id, tpl_data: c.tpl_data, language: c.language, subject: c.subject, preheader: c.preheader, heading: c.heading, body: c.body, button_label: c.button_label, button_url: c.button_url, list_ids: c.list_ids, created_by: c.created_by };
      var r = await sb.from('mkt_campaigns').insert(copy).select('id').single(); if (!r.error) ERoute.go('#/marketing?c=' + r.data.id);
    };
    $('#mk-csv').onclick = function () {
      var cols = ['email', 'name', 'language', 'status', 'sent_at', 'opened_at', 'open_count', 'clicked_at', 'click_count', 'unsubscribed_at', 'error'];
      var csv = cols.join(',') + '\n' + sends.map(function (s) { return cols.map(function (k) { var v = s[k] == null ? '' : String(s[k]); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      ctx.download('campanha-' + c.name.replace(/[^\w-]+/g, '-').slice(0, 40) + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
    };
  }

  /* ---------------- contacts and lists ---------------- */
  async function contacts(body) {
    var res = await Promise.all([ctx.q(sb.from('mkt_lists').select('*').order('name')), rpc('mkt_list_counts')]);
    var lists = res[0], cnt = {}; res[1].forEach(function (x) { cnt[x.list_id] = x; });
    var cur = param('lista') || '';
    var people = await all(function () { return sb.from('mkt_contacts').select('*, mkt_list_members(list_id)').order('created_at', { ascending: false }); });
    body.innerHTML = '<div class="mk-contacts"><aside class="portal-card mk-listbar"><strong>Listas</strong><ul class="mk-listnav">' +
      '<li><a href="#/marketing?tab=contatos"' + (!cur ? ' aria-current="page"' : '') + '>Todos os contatos <span>' + people.length + '</span></a></li>' +
      lists.map(function (l) { return '<li><a href="#/marketing?tab=contatos&lista=' + l.id + '"' + (cur === l.id ? ' aria-current="page"' : '') + '>' + esc(l.name) + ' <span>' + (cnt[l.id] ? +cnt[l.id].total : 0) + '</span></a></li>'; }).join('') +
      '</ul><button class="btn btn--ghost btn--xs" type="button" id="mk-newlist">+ Nova lista</button>' + (cur ? '<button class="btn btn--danger btn--xs" type="button" id="mk-dellist" style="margin-top:.4rem">Excluir esta lista</button>' : '') + '</aside>' +
      '<div><div class="portal-btn-row" style="justify-content:flex-end;margin-bottom:.8rem"><button class="btn btn--ghost btn--xs" type="button" id="mk-export">Exportar CSV</button><button class="btn btn--ghost btn--xs" type="button" id="mk-add">Adicionar contato</button><button class="btn btn--navy btn--xs" type="button" id="mk-import">Importar CSV / Excel</button></div>' +
      '<div class="toolbar"><input type="search" id="ct-q" placeholder="Buscar e-mail, nome, empresa…" aria-label="Buscar contatos"><select id="ct-s" aria-label="Filtrar por status"><option value="">Todos os status</option>' + Object.keys(MST).map(function (k) { return '<option value="' + k + '">' + MST[k] + '</option>'; }).join('') + '</select>' +
      '<select id="ct-k" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '">' + KIND[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Contato</th><th>Tipo</th><th>Idioma</th><th>Listas</th><th>Status</th></tr></thead><tbody id="ct-body"></tbody></table></div><p class="portal-muted" id="ct-count" style="font-size:.85rem"></p></div></div>';
    var lname = function (id) { var l = lists.find(function (x) { return x.id === id; }); return l ? l.name : ''; };
    function rows() {
      var q = lc($('#ct-q').value), s = $('#ct-s').value, k = $('#ct-k').value;
      return people.filter(function (p) {
        var ids = (p.mkt_list_members || []).map(function (m) { return m.list_id; });
        return (!cur || ids.indexOf(cur) > -1) && (!s || p.status === s) && (!k || p.kind === k) && (!q || [p.email, p.name, p.company].join(' ').toLowerCase().indexOf(q) > -1);
      });
    }
    function draw() {
      var r = rows();
      $('#ct-body').innerHTML = r.length ? r.slice(0, 500).map(function (p) {
        return '<tr data-id="' + p.id + '" tabindex="0"><td><strong>' + esc(p.name || '—') + '</strong><span class="sub">' + esc(p.email) + (p.company ? ' · ' + esc(p.company) : '') + '</span></td><td>' + esc(KIND[p.kind] || p.kind) + '</td><td>' + esc((p.language || '').toUpperCase()) + '</td>' +
          '<td>' + esc((p.mkt_list_members || []).map(function (m) { return lname(m.list_id); }).filter(Boolean).join(', ') || '—') + '</td><td><span class="badge badge--' + (p.status === 'subscribed' ? 'client' : 'lost') + '">' + MST[p.status] + '</span></td></tr>';
      }).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>Nenhum contato aqui</strong>Use "Importar CSV / Excel" para subir a sua lista.</div></td></tr>';
      $('#ct-count').textContent = r.length > 500 ? 'Mostrando 500 de ' + r.length + ' contatos. Use a busca ou os filtros.' : r.length + ' contato(s).';
      $$('#ct-body tr[data-id]').forEach(function (tr) { var go = function () { contactForm(people.find(function (x) { return x.id === tr.dataset.id; }), lists); }; tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
    }
    ['#ct-q', '#ct-s', '#ct-k'].forEach(function (s) { $(s).addEventListener('input', draw); }); draw();
    $('#mk-newlist').onclick = async function () { var n = prompt('Nome da nova lista (ex.: Corretores Orlando):'); if (!n || n.trim().length < 2) return; var r = await sb.from('mkt_lists').insert({ name: n.trim() }).select('id').single(); if (r.error) return alert(ctx.errText(r.error)); ERoute.go('#/marketing?tab=contatos&lista=' + r.data.id); };
    if ($('#mk-dellist')) $('#mk-dellist').onclick = async function () { if (!confirm('Excluir a lista "' + lname(cur) + '"? Os contatos continuam cadastrados, só saem da lista.')) return; await sb.from('mkt_lists').delete().eq('id', cur); ERoute.go('#/marketing?tab=contatos'); };
    $('#mk-add').onclick = function () { contactForm(null, lists, cur); };
    $('#mk-import').onclick = function () { importer(lists, cur); };
    $('#mk-export').onclick = function () {
      var cols = ['email', 'name', 'company', 'phone', 'kind', 'language', 'status', 'source', 'created_at', 'unsubscribed_at'];
      var csv = cols.join(',') + ',lists\n' + rows().map(function (p) { return cols.map(function (k) { var v = p[k] == null ? '' : String(p[k]); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(',') + ',"' + (p.mkt_list_members || []).map(function (m) { return lname(m.list_id); }).join('; ').replace(/"/g, '""') + '"'; }).join('\n');
      ctx.download('contatos-marketing.csv', '﻿' + csv, 'text/csv;charset=utf-8');
    };
  }

  function contactForm(p, lists, preList) {
    var edit = !!p; p = p || { kind: 'other', language: 'pt', status: 'subscribed', mkt_list_members: preList ? [{ list_id: preList }] : [] };
    var mine = (p.mkt_list_members || []).map(function (m) { return m.list_id; });
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (edit ? 'Editar contato' : 'Novo contato') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="cf" novalidate><div class="field"><label for="cf-email">E-mail</label><input id="cf-email" type="email" value="' + esc(p.email || '') + '"' + (edit ? ' readonly' : '') + '></div>' +
      '<div class="portal-grid2"><div class="field"><label for="cf-name">Nome</label><input id="cf-name" value="' + esc(p.name || '') + '"></div><div class="field"><label for="cf-co">Empresa</label><input id="cf-co" value="' + esc(p.company || '') + '"></div>' +
      '<div class="field"><label for="cf-phone">Telefone</label><input id="cf-phone" value="' + esc(p.phone || '') + '"></div><div class="field"><label for="cf-kind">Tipo</label><select id="cf-kind">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '">' + KIND[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="cf-lang">Idioma</label><select id="cf-lang">' + Object.keys(LANGS).map(function (k) { return '<option value="' + k + '">' + LANGS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="cf-st">Status</label><select id="cf-st">' + Object.keys(MST).map(function (k) { return '<option value="' + k + '">' + MST[k] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><span style="font-weight:600">Listas</span>' + (lists.length ? lists.map(function (l) { return '<label class="check-row"><input type="checkbox" value="' + l.id + '"' + (mine.indexOf(l.id) > -1 ? ' checked' : '') + '> ' + esc(l.name) + '</label>'; }).join('') : '<p class="portal-muted">Nenhuma lista ainda.</p>') + '</div>' +
      '<div class="field"><label for="cf-notes">Notas</label><textarea id="cf-notes" rows="2">' + esc(p.notes || '') + '</textarea></div>' +
      (p.status === 'unsubscribed' ? '<p class="portal-muted" style="font-size:.85rem">Esta pessoa pediu para não receber. Só mude o status se ela pedir para voltar.</p>' : '') +
      '<div class="portal-alert" id="cf-msg" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button>' + (edit ? '<button class="btn btn--danger btn--xs" type="button" id="cf-del">Excluir contato</button>' : '') + '</div></form>');
    $('#cf-kind', o).value = p.kind; $('#cf-lang', o).value = p.language; $('#cf-st', o).value = p.status;
    $('#cf', o).onsubmit = async function (e) {
      e.preventDefault();
      var row = { email: lc($('#cf-email', o).value), name: $('#cf-name', o).value.trim() || null, company: $('#cf-co', o).value.trim() || null, phone: $('#cf-phone', o).value.trim() || null,
        kind: $('#cf-kind', o).value, language: $('#cf-lang', o).value, status: $('#cf-st', o).value, notes: $('#cf-notes', o).value.trim() || null };
      if (!EMAIL.test(row.email)) return ctx.msg($('#cf-msg', o), 'Digite um e-mail válido.', 'error');
      if (row.status === 'unsubscribed' && p.status !== 'unsubscribed') row.unsubscribed_at = new Date().toISOString();
      if (!edit) row.source = 'manual';
      var r = edit ? await sb.from('mkt_contacts').update(row).eq('id', p.id).select('id').single() : await sb.from('mkt_contacts').insert(row).select('id').single();
      if (r.error) return ctx.msg($('#cf-msg', o), /duplicate|unique/i.test(r.error.message) ? 'Este e-mail já está nos contatos.' : ctx.errText(r.error), 'error');
      var id = r.data.id, want = $$('input[type=checkbox]:checked', o).map(function (i) { return i.value; });
      var add = want.filter(function (x) { return mine.indexOf(x) < 0; }), rem = mine.filter(function (x) { return want.indexOf(x) < 0; });
      if (add.length) await sb.from('mkt_list_members').insert(add.map(function (l) { return { list_id: l, contact_id: id }; }));
      if (rem.length) await sb.from('mkt_list_members').delete().eq('contact_id', id).in('list_id', rem);
      ctx.closeOverlay(); ctx.route();
    };
    if ($('#cf-del', o)) $('#cf-del', o).onclick = async function () { if (!confirm('Excluir este contato? O histórico de envios dele continua nos relatórios.')) return; await sb.from('mkt_contacts').delete().eq('id', p.id); ctx.closeOverlay(); ctx.route(); };
  }

  /* CSV / Excel import */
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '', d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.indexOf('\t') > -1 ? '\t' : ',');
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
      if (ch === '"') q = true; else if (ch === d) { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = function () { ok(window.XLSX); }; s.onerror = bad; document.head.appendChild(s); });
  }
  var GUESS = { email: /e-?mail|correo/i, name: /^(nome|name|nombre|contato|contact|full ?name)/i, company: /empresa|company|compa[nñ]ia|imobili|broker|firm/i, phone: /tel|phone|fone|celular|whats|mobile/i, kind: /tipo|type|categor|profiss|profession/i, language: /idioma|lang/i };
  function mapKind(v) { v = lc(v); if (/realt|corret|imobil|broker|real estate|agente/.test(v)) return 'realtor'; if (/account|contad|cpa|contab/.test(v)) return 'accountant'; if (/attorn|advog|abogad|lawyer|law/.test(v)) return 'attorney'; if (/bookkeep/.test(v)) return 'bookkeeping'; if (/property|administr/.test(v)) return 'property_management'; if (/financ|bank|banc|loan|mortg|hipotec/.test(v)) return 'financial'; return null; }
  function mapLang(v) { v = lc(v); if (/^(pt|port|br)/.test(v)) return 'pt'; if (/^(en|ing|eng)/.test(v)) return 'en'; if (/^(es|esp|span)/.test(v)) return 'es'; return null; }

  function importer(lists, preList) {
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Importar contatos</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<p class="portal-muted">Arquivo CSV ou Excel (.xlsx) com uma linha por contato. A primeira linha deve ter os nomes das colunas (ex.: Nome, E-mail, Empresa, Telefone, Tipo, Idioma).</p>' +
      '<div class="field"><input type="file" id="im-file" accept=".csv,.txt,.xlsx,.xls"></div><div id="im-step"></div>');
    $('#im-file', o).onchange = async function () {
      var file = this.files[0]; if (!file) return;
      var step = $('#im-step', o); step.innerHTML = '<p class="portal-muted">Lendo o arquivo…</p>';
      var rows;
      try {
        if (/\.xlsx?$/i.test(file.name)) { var X = await loadXlsx(); var wb = X.read(await file.arrayBuffer(), { type: 'array' }); rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); }
        else rows = parseCsv(await file.text());
      } catch (e) { step.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">Não foi possível ler este arquivo. Salve como CSV ou .xlsx e tente de novo.</div>'; return; }
      rows = (rows || []).filter(function (r) { return r && r.some(function (x) { return String(x).trim(); }); });
      if (rows.length < 2) { step.innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">O arquivo não tem linhas de contatos.</div>'; return; }
      var head = rows[0].map(function (h) { return String(h).trim(); }), data = rows.slice(1);
      var guess = {}; Object.keys(GUESS).forEach(function (k) { var i = head.findIndex(function (h) { return GUESS[k].test(h); }); if (i < 0 && k === 'email') i = head.findIndex(function (h, j) { return data.slice(0, 5).some(function (r) { return EMAIL.test(String(r[j] || '').trim()); }); }); guess[k] = i; });
      var LBL = { email: 'E-mail *', name: 'Nome', company: 'Empresa', phone: 'Telefone', kind: 'Tipo', language: 'Idioma' };
      var opt = function (k) { return '<option value="-1">(não usar)</option>' + head.map(function (h, i) { return '<option value="' + i + '"' + (guess[k] === i ? ' selected' : '') + '>' + esc(h || 'Coluna ' + (i + 1)) + '</option>'; }).join(''); };
      step.innerHTML = '<h3 class="portal-h2" style="font-size:1rem">1. Colunas</h3><div class="portal-grid2">' + Object.keys(LBL).map(function (k) { return '<div class="field"><label for="im-' + k + '">' + LBL[k] + '</label><select id="im-' + k + '">' + opt(k) + '</select></div>'; }).join('') + '</div>' +
        '<h3 class="portal-h2" style="font-size:1rem">2. Padrões e lista</h3><div class="portal-grid2"><div class="field"><label for="im-dkind">Tipo (quando vazio)</label><select id="im-dkind">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (k === 'realtor' ? ' selected' : '') + '>' + KIND[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="im-dlang">Idioma (quando vazio)</label><select id="im-dlang">' + Object.keys(LANGS).map(function (k) { return '<option value="' + k + '">' + LANGS[k] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="im-list">Adicionar à lista</label><select id="im-list"><option value="__new">+ Criar nova lista</option>' + lists.map(function (l) { return '<option value="' + l.id + '"' + (preList === l.id ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field" id="im-newwrap"><label for="im-newname">Nome da nova lista</label><input id="im-newname" value="' + esc(file.name.replace(/\.[^.]+$/, '')) + '"></div>' +
        '<div class="field"><label for="im-source">Origem (para o seu controle)</label><input id="im-source" placeholder="Ex.: feira imobiliária out/2026"></div></div>' +
        '<div id="im-summary" class="mk-box"></div>' +
        '<label class="check-row"><input type="checkbox" id="im-ok"> <span>Confirmo que são contatos profissionais com quem a Endeavor tem relação ou interesse legítimo. Não são listas compradas. Cada e-mail terá o link de descadastro.</span></label>' +
        '<div class="portal-alert" id="im-msg" role="alert"></div><button class="btn btn--navy" type="button" id="im-go">Importar</button>';
      if (preList) $('#im-list', o).value = preList;
      var sync = function () { $('#im-newwrap', o).hidden = $('#im-list', o).value !== '__new'; summary(); };
      function parsed() {
        var col = function (k) { return +$('#im-' + k, o).value; }, dk = $('#im-dkind', o).value, dl = $('#im-dlang', o).value;
        var seen = {}, ok = [], bad = 0, dup = 0;
        data.forEach(function (r) {
          var g = function (k) { var i = col(k); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
          var em = lc(g('email')).replace(/^mailto:/, '');
          if (!EMAIL.test(em)) { bad++; return; } if (seen[em]) { dup++; return; } seen[em] = 1;
          ok.push({ email: em, name: g('name').slice(0, 200) || null, company: g('company').slice(0, 200) || null, phone: g('phone').slice(0, 50) || null, kind: mapKind(g('kind')) || dk, language: mapLang(g('language')) || dl });
        });
        return { ok: ok, bad: bad, dup: dup };
      }
      function summary() {
        var p = parsed();
        $('#im-summary', o).innerHTML = '<strong>' + p.ok.length + ' contatos válidos</strong>' + (p.bad ? ' · ' + p.bad + ' sem e-mail válido (ignorados)' : '') + (p.dup ? ' · ' + p.dup + ' repetidos no arquivo' : '') +
          '<div class="table-wrap" style="margin-top:.5rem"><table class="data"><thead><tr><th>E-mail</th><th>Nome</th><th>Empresa</th><th>Tipo</th><th>Idioma</th></tr></thead><tbody>' +
          p.ok.slice(0, 5).map(function (x) { return '<tr><td>' + esc(x.email) + '</td><td>' + esc(x.name || '') + '</td><td>' + esc(x.company || '') + '</td><td>' + esc(KIND[x.kind]) + '</td><td>' + x.language.toUpperCase() + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }
      $$('select, input', step).forEach(function (i) { i.addEventListener('change', sync); }); sync();
      $('#im-go', o).onclick = async function () {
        var m = $('#im-msg', o), p = parsed();
        if (!$('#im-ok', o).checked) return ctx.msg(m, 'Marque a confirmação antes de importar.', 'error');
        if (!p.ok.length) return ctx.msg(m, 'Nenhum contato válido para importar.', 'error');
        var btn = this; btn.disabled = true;
        try {
          var listId = $('#im-list', o).value;
          if (listId === '__new') { var nm = $('#im-newname', o).value.trim(); if (nm.length < 2) throw new Error('Dê um nome à nova lista.'); listId = (await ctx.q(sb.from('mkt_lists').insert({ name: nm }).select('id').single())).id; }
          var src = $('#im-source', o).value.trim() || ('Importação ' + new Date().toLocaleDateString(window.ADMIN_LOCALE || 'pt-BR'));
          var made = 0, ids = [];
          for (var i = 0; i < p.ok.length; i += 500) {
            var chunk = p.ok.slice(i, i + 500);
            ctx.msg(m, 'Importando ' + Math.min(i + 500, p.ok.length) + ' de ' + p.ok.length + '…', 'info');
            // new contacts are inserted; existing ones (and their unsubscribe status) are kept as they are
            var ins = await sb.from('mkt_contacts').upsert(chunk.map(function (x) { return Object.assign({ source: src.slice(0, 120), consent_note: 'Importação confirmada pelo admin' }, x); }), { onConflict: 'email', ignoreDuplicates: true }).select('id');
            if (ins.error) throw ins.error; made += (ins.data || []).length;
            var got = await ctx.q(sb.from('mkt_contacts').select('id').in('email', chunk.map(function (x) { return x.email; })));
            ids = ids.concat(got.map(function (g) { return g.id; }));
          }
          for (var j = 0; j < ids.length; j += 500) {
            var r2 = await sb.from('mkt_list_members').upsert(ids.slice(j, j + 500).map(function (id) { return { list_id: listId, contact_id: id }; }), { onConflict: 'list_id,contact_id', ignoreDuplicates: true });
            if (r2.error) throw r2.error;
          }
          ctx.msg(m, made + ' contatos novos e ' + (ids.length - made) + ' que já existiam foram colocados na lista.', 'ok');
          setTimeout(function () { ctx.closeOverlay(); ERoute.go('#/marketing?tab=contatos&lista=' + listId); }, 1200);
        } catch (e) { btn.disabled = false; ctx.msg(m, e.message || ctx.errText(e), 'error'); }
      };
    };
  }

  /* ---------------- settings ---------------- */
  async function settings(body, st) {
    var f = function (id, label, val, type, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '></div>'; };
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Serviço de envio</h2><ul class="list"><li><div class="list__main"><strong>Amazon SES</strong><span id="ses-st">' + (st.ses_connected ? 'Conectada: as campanhas saem pela Amazon SES.' : 'Ainda não conectada. As campanhas podem ser criadas e agendadas, e saem sozinhas quando a conexão for feita.') + '</span></div>' +
      '<span class="badge badge--' + (st.ses_connected ? 'client' : 'new') + '">' + (st.ses_connected ? 'Ativa' : 'Pendente') + '</span></li>' +
      '<li><div class="list__main"><strong>Templates com IA</strong><span id="ai-st">Clique em Verificar conexão para ver o status.</span></div><span class="badge badge--new" id="ai-badge">…</span></li></ul>' +
      '<button class="btn btn--ghost btn--xs" type="button" id="ses-check">Verificar conexão</button>' +
      '<details style="margin-top:1rem"><summary><strong>Como conectar a Amazon SES</strong></summary><ol class="mk-steps">' +
        '<li>Crie a conta na Amazon Web Services (aws.amazon.com) e abra o serviço <strong>Amazon SES</strong> (a Endeavor usa a região <strong>Ohio, us-east-2</strong>).</li>' +
        '<li>Em <strong>Identities</strong>, verifique o domínio <strong>endeavorbiz.com</strong>: a Amazon mostra 3 registros CNAME (DKIM) para colocar no DNS do Squarespace. Recomendado também: registro SPF e DMARC.</li>' +
        '<li>Em <strong>Account dashboard</strong>, peça a saída do modo sandbox (<strong>Request production access</strong>), explicando que são e-mails para parceiros profissionais com descadastro.</li>' +
        '<li>Em <strong>SMTP settings</strong>, crie as credenciais SMTP.</li>' +
        '<li>No Supabase, em Edge Functions → Secrets, crie: <code>SES_SMTP_HOST</code> = email-smtp.us-east-2.amazonaws.com (o endereço mostrado em SMTP settings), <code>SES_SMTP_USER</code> e <code>SES_SMTP_PASS</code> (as credenciais do passo 4).</li>' +
        '<li>Volte aqui e clique em <strong>Verificar conexão</strong>. Depois, envie um teste de uma campanha.</li></ol></details></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Remetente e rodapé</h2><div class="portal-grid2">' + f('ms-name', 'Nome do remetente', st.from_name) + f('ms-from', 'E-mail do remetente (domínio verificado na SES)', st.from_email, 'email') +
        f('ms-reply', 'Respostas vão para', st.reply_to, 'email') + f('ms-addr', 'Endereço da empresa (obrigatório no rodapé)', st.postal_address) + '</div>' +
        '<p class="portal-muted" style="font-size:.85rem">Sugestão: use um endereço só para campanhas, como partners@endeavorbiz.com, para proteger a reputação do support@ (que envia os e-mails dos clientes).</p></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Ritmo de envio</h2><div class="portal-grid2">' + f('ms-day', 'Máximo por dia', st.daily_limit, 'number', ' min="1" max="100000"') + f('ms-min', 'Máximo por minuto', st.per_minute, 'number', ' min="1" max="3000"') + '</div>' +
        '<p class="portal-muted" style="font-size:.85rem">Comece devagar (por exemplo, 200 por dia) nas primeiras semanas. Isso aquece o domínio e evita cair no spam. Respeite também o limite que a Amazon liberar para a sua conta.</p></section>' +
      '<div class="portal-alert" id="ms-msg" role="status"></div><button class="btn btn--navy" type="button" id="ms-save">Salvar</button>';
    $('#ses-check').onclick = async function () {
      var b = this; b.disabled = true; var j = await fnCall({ action: 'status' }); b.disabled = false;
      if (!j.error) { $('#ai-st').textContent = j.ai ? 'Conectada: a IA cria templates na aba Templates.' : 'Pendente: falta a chave ANTHROPIC_API_KEY no Supabase (a mesma do Operating Agreement).'; $('#ai-badge').textContent = j.ai ? 'Ativa' : 'Pendente'; $('#ai-badge').className = 'badge badge--' + (j.ai ? 'client' : 'new'); }
      ctx.msg($('#ms-msg'), j.ses ? 'Amazon SES conectada.' : j.error ? 'Não foi possível verificar: ' + j.error : 'Ainda não conectada: faltam os segredos SES_SMTP_HOST, SES_SMTP_USER e SES_SMTP_PASS no Supabase.', j.ses ? 'ok' : 'error');
      if (j.ses && !st.ses_connected) { st.ses_connected = true; $('#ses-st').textContent = 'Conectada: as campanhas saem pela Amazon SES.'; }
    };
    $('#ms-save').onclick = async function () {
      var row = { from_name: $('#ms-name').value.trim(), from_email: lc($('#ms-from').value), reply_to: lc($('#ms-reply').value), postal_address: $('#ms-addr').value.trim(), daily_limit: +$('#ms-day').value, per_minute: +$('#ms-min').value, updated_at: new Date().toISOString() };
      if (!EMAIL.test(row.from_email) || !EMAIL.test(row.reply_to)) return ctx.msg($('#ms-msg'), 'Confira os e-mails do remetente e de resposta.', 'error');
      if (row.postal_address.length < 5) return ctx.msg($('#ms-msg'), 'Informe o endereço da empresa.', 'error');
      var r = await sb.from('mkt_settings').update(row).eq('id', 1);
      ctx.msg($('#ms-msg'), r.error ? ctx.errText(r.error) : 'Configurações salvas.', r.error ? 'error' : 'ok');
    };
  }

  window.AdminMkt = { view: view };
})();
