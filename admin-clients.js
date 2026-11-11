/* Admin console: client accounts, companies, documents, deadlines, users and QuickBooks reports. */
(function () {
  'use strict';

  var ENTITY = {
    llc_single: 'LLC, sócio único (EUA)', llc_foreign: 'LLC, sócio único estrangeiro (Form 5472)', llc_multi: 'LLC, vários sócios',
    s_corp: 'S-Corporation', c_corp: 'C-Corporation', partnership: 'Partnership', sole_prop: 'Sole proprietorship', other: 'Outro'
  };
  var DOC_CAT = { formation: 'Formação', tax_return: 'Imposto de renda', compliance: 'Compliance', report: 'Relatório financeiro', uploaded: 'Enviado pelo cliente', other: 'Outro' };
  var DL_CAT = { annual_report: 'Annual Report', federal_tax: 'Imposto federal', state_tax: 'Imposto estadual', payroll: 'Folha', sales_tax: 'Sales tax', boi: 'BOI', license: 'Licença', other: 'Outro' };
  var DL_STATUS = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído', not_applicable: 'Não se aplica' };
  var COLLAB = { accountant: 'Contador', bookkeeping: 'Bookkeeping', property_management: 'Property management', other: 'Outro' };
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function nextBusinessDay(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d));
    while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  /* General U.S. federal and Florida due dates for calendar-year filers. Always confirm with the CPA. */
  function standardDeadlines(co, year) {
    var t = co.entity_type || 'other', py = year - 1, out = [];
    var add = function (title, category, m, d, y) { out.push({ company_id: co.id, title: title, category: category, due_date: nextBusinessDay(y || year, m, d) }); };
    var formed = co.formation_date ? +co.formation_date.slice(0, 4) : 0;
    if ((co.state || 'FL').toUpperCase() === 'FL' && formed < year) add('Florida Annual Report (Sunbiz)', 'annual_report', 5, 1);
    add('Forms 1099-NEC e 1099-MISC (pagamentos de ' + py + ')', 'federal_tax', 1, 31);
    if (t === 'llc_foreign') add('Form 5472 + pro forma 1120 (' + py + ')', 'federal_tax', 4, 15);
    if (t === 'llc_multi' || t === 'partnership') add('Form 1065 + K-1 (' + py + ') ou extensão 7004', 'federal_tax', 3, 15);
    if (t === 's_corp') add('Form 1120-S + K-1 (' + py + ') ou extensão 7004', 'federal_tax', 3, 15);
    if (t === 'c_corp') { add('Form 1120 (' + py + ') ou extensão 7004', 'federal_tax', 4, 15); if ((co.state || 'FL').toUpperCase() === 'FL') add('Florida Corporate Income Tax F-1120 (' + py + ')', 'state_tax', 5, 1); }
    if (t === 'llc_single' || t === 'sole_prop') add('Imposto pessoal com Schedule C (Form 1040, ' + py + ')', 'federal_tax', 4, 15);
    if (t === 'llc_single' || t === 'sole_prop' || t === 'c_corp') {
      add('Estimated tax 1º trimestre ' + year, 'federal_tax', 4, 15); add('Estimated tax 2º trimestre ' + year, 'federal_tax', 6, 15);
      add('Estimated tax 3º trimestre ' + year, 'federal_tax', 9, 15); add('Estimated tax 4º trimestre ' + year, 'federal_tax', 1, 15, year + 1);
    }
    return out;
  }

  function inviteText(lang, name, clientName, link, role, email) {
    return window.EndeavorInvite.text(lang, { name: name, email: email, link: link, clientName: role === 'owner' ? '' : clientName, invitedBy: role === 'owner' ? '' : clientName, partner: role !== 'owner' });
  }
  // the access e-mail (welcome + create password + authenticator steps, in the client's language) is sent by the payments function
  async function sendAccess(ctx, payload) {
    try {
      var sess = (await ctx.sb.auth.getSession()).data.session;
      var r = await fetch(ctx.CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(Object.assign({ action: 'send_access' }, payload)) });
      var j = await r.json().catch(function () { return {}; });
      return r.ok && !j.error;
    } catch (e) { return false; }
  }
  async function sendInvite(ctx, o) {
    var link = ctx.siteUrl(o.role === 'owner' ? 'client.html' : 'partner.html') + '?lang=' + (o.lang || 'pt');
    if (o.clientId) return await sendAccess(ctx, { client_id: o.clientId, email: o.email, lang: o.lang || 'pt' });
    try {
      var r = await fetch(ctx.CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'Convite ao portal do cliente: ' + o.name + ' (' + o.clientName + ')', _template: 'table', _captcha: 'false',
          name: o.name, email: o.email, cliente: o.clientName, perfil: o.role, link: link, _autoresponse: inviteText(o.lang, o.name, o.clientName, link, o.role, o.email) }) });
      var j = await r.json().catch(function () { return {}; });
      return r.ok && String(j.success) !== 'false';
    } catch (e) { return false; }
  }

  function fmtD(d) { if (!d) return ''; var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function daysUntil(d) { var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(d + 'T00:00:00') - t) / 864e5); }
  function dlPill(it) {
    if (it.status === 'done') { var cd = it.completed_at ? it.completed_at.slice(0, 10) : ''; return '<span class="pill pill--done">✓ Concluído' + (cd ? ' em ' + fmtD(cd) + (cd <= it.due_date ? ' · no prazo' : '') : '') + '</span>'; }
    if (it.status === 'not_applicable') return '<span class="pill">Não se aplica</span>';
    var n = daysUntil(it.due_date);
    if (n < 0) return '<span class="pill pill--overdue">Vencido há ' + (-n) + ' d</span>';
    if (n <= 30) return '<span class="pill pill--soon">Em ' + n + ' d</span>';
    return '<span class="pill">Em ' + n + ' d</span>';
  }
  function fileIcon(path) { var e = (path.match(/\.([a-z0-9]+)$/i) || ['', 'doc'])[1].toUpperCase(); return e.slice(0, 4); }
  function slug(s) { return String(s).normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(0, 80); }

  window.AdminClients = {
    /* ---------- list ---------- */
    create: function (ctx, leadId) { return newClient(ctx, leadId); },
    invite: function (ctx, o) { return sendInvite(ctx, o); },
    /* create the portal account from the CRM card (no company yet) and optionally send the invite */
    createAccount: async function (ctx, o) {
      // a prospect (proposal not accepted yet) with this e-mail becomes the client account
      var pr = (await ctx.sb.from('clients').select('*').eq('status', 'prospect').ilike('primary_email', o.email).limit(1)).data || [];
      var c = pr[0] ? await ctx.q(ctx.sb.from('clients').update({ name: o.name, phone: o.phone || pr[0].phone, language: o.lang || pr[0].language, lead_id: o.leadId || pr[0].lead_id, status: o.status === 'archived' ? 'archived' : 'active' }).eq('id', pr[0].id).select('*').single())
        : await ctx.q(ctx.sb.from('clients').insert({ name: o.name, primary_email: o.email, phone: o.phone || null, language: o.lang || 'pt', lead_id: o.leadId || null, status: o.status === 'archived' ? 'archived' : 'active' }).select('*').single());
      var own = (await ctx.sb.from('client_users').select('id').eq('client_id', c.id).eq('role', 'owner').ilike('email', o.email).limit(1)).data || [];
      if (!own.length) await ctx.q(ctx.sb.from('client_users').insert({ client_id: c.id, email: o.email, name: o.name, role: 'owner', can_view: true, can_upload: true }));
      var sent = o.invite ? await sendInvite(ctx, { clientId: c.id, email: o.email, name: o.name, clientName: o.name, role: 'owner', lang: o.lang || 'pt' }) : false;
      return { client: c, sent: sent };
    },
    list: async function (view, ctx) {
      var esc = ctx.esc, sb = ctx.sb;
      var res = await Promise.all([
        ctx.q(sb.from('clients').select('*').neq('status', 'prospect').order('name')),
        ctx.q(sb.from('companies').select('id, client_id')),
        ctx.q(sb.from('client_users').select('client_id, status, role')),
        ctx.q(sb.from('compliance_items').select('client_id, due_date, status').neq('status', 'done').neq('status', 'not_applicable'))
      ]);
      var clients = res[0];
      var count = function (arr, id, f) { return arr.filter(function (x) { return x.client_id === id && (!f || f(x)); }).length; };
      view.innerHTML = '<div class="console__head"><div><h1>Clientes</h1><p class="portal-muted">Contas do portal do cliente: empresas, documentos, prazos, usuários e QuickBooks.</p></div>' +
        '<button class="btn btn--navy btn--xs" type="button" id="cl-new">Novo cliente</button></div>' +
        '<div class="toolbar"><input type="search" id="cl-q" placeholder="Buscar cliente ou e-mail…" aria-label="Buscar clientes"></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>Cliente</th><th>Empresas</th><th>Usuários ativos</th><th>Prazos em 30 dias</th><th>Status</th></tr></thead><tbody id="cl-body"></tbody></table></div>';
      function draw() {
        var t = view.querySelector('#cl-q').value.trim().toLowerCase();
        var rows = clients.filter(function (c) { return !t || (c.name + ' ' + c.primary_email).toLowerCase().indexOf(t) > -1; });
        view.querySelector('#cl-body').innerHTML = rows.length ? rows.map(function (c) {
          var soon = count(res[3], c.id, function (x) { return daysUntil(x.due_date) <= 30; });
          return '<tr data-id="' + c.id + '" tabindex="0"><td><strong>' + esc(c.name) + '</strong><span class="sub">' + esc(c.primary_email) + '</span></td><td>' + count(res[1], c.id) + '</td>' +
            '<td>' + count(res[2], c.id, function (x) { return x.status === 'active'; }) + ' / ' + count(res[2], c.id, function (x) { return x.status !== 'revoked'; }) + '</td>' +
            '<td>' + (soon ? '<span class="pill pill--soon">' + soon + '</span>' : '0') + '</td><td>' + (c.status === 'active' ? '<span class="pill pill--done">Ativo</span>' : '<span class="pill">Arquivado</span>') + '</td></tr>';
        }).join('') : '<tr><td colspan="5"><div class="empty-state"><strong>Nenhum cliente ainda</strong>Crie o primeiro cliente para liberar o portal.</div></td></tr>';
        view.querySelectorAll('#cl-body tr[data-id]').forEach(function (tr) {
          var go = function () { ERoute.set('#/clientes?id=' + tr.dataset.id); };
          tr.onclick = go; tr.onkeydown = function (e) { if (e.key === 'Enter') go(); };
        });
      }
      view.querySelector('#cl-q').oninput = draw; draw();
      view.querySelector('#cl-new').onclick = function () { newClient(ctx); };
      if (/novo=1/.test(ERoute.get())) newClient(ctx);
    },

    /* ---------- detail ---------- */
    detail: async function (view, ctx, id) {
      var esc = ctx.esc, sb = ctx.sb;
      var tab = (ERoute.get().match(/[?&]tab=([a-z]+)/) || [])[1] || 'empresas';
      var c = await ctx.q(sb.from('clients').select('*').eq('id', id).single());
      var companies = await ctx.q(sb.from('companies').select('*').eq('client_id', id).order('legal_name'));
      var TABS = [['empresas', 'Empresas'], ['documentos', 'Documentos'], ['prazos', 'Prazos'], ['usuarios', 'Usuários'], ['financeiro', 'Contabilidade e relatórios']];
      view.innerHTML = '<p class="crumbs"><a href="#/crm?tipo=client">CRM</a> /</p>' +
        '<div class="console__head"><div><h1>' + esc(c.name) + '</h1><p class="portal-muted">' + esc(c.primary_email) + (c.phone ? ' · ' + esc(c.phone) : '') + ' · idioma ' + esc((c.language || 'pt').toUpperCase()) + '</p></div>' +
        '<div class="portal-btn-row"><a class="btn btn--navy btn--xs" href="#/pagamentos?tab=nova-proposta&client=' + id + '">Enviar proposta</a><a class="btn btn--ghost btn--xs" href="#/pagamentos?tab=nova&client=' + id + '">Nova fatura</a><button class="btn btn--ghost btn--xs" type="button" id="c-edit">Editar cliente</button></div></div>' +
        '<nav class="subtabs" aria-label="Seções do cliente">' + TABS.map(function (t) { return '<a href="#/clientes?id=' + id + '&tab=' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>' +
        '<div id="c-body"></div>';
      view.querySelector('#c-edit').onclick = function () { editClient(ctx, c); };
      var body = view.querySelector('#c-body');
      var fn = { empresas: tabCompanies, documentos: tabDocs, prazos: tabDeadlines, usuarios: tabUsers, financeiro: tabFinance }[tab] || tabCompanies;
      await fn(body, ctx, c, companies);
    }
  };

  function field(id, label, val, type, req, extra) {
    return '<div class="field"><label for="' + id + '">' + label + (req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + String(val == null ? '' : val).replace(/"/g, '&quot;') + '"' + (req ? ' required' : '') + (extra || '') + '></div>';
  }
  function select(id, label, map, val) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '">' + Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === val ? ' selected' : '') + '>' + map[k] + '</option>'; }).join('') + '</select></div>';
  }
  var US_STATES = { AL: 'AL – Alabama', AK: 'AK – Alaska', AZ: 'AZ – Arizona', AR: 'AR – Arkansas', CA: 'CA – California', CO: 'CO – Colorado', CT: 'CT – Connecticut', DE: 'DE – Delaware', DC: 'DC – District of Columbia', FL: 'FL – Florida', GA: 'GA – Georgia', HI: 'HI – Hawaii', ID: 'ID – Idaho', IL: 'IL – Illinois', IN: 'IN – Indiana', IA: 'IA – Iowa', KS: 'KS – Kansas', KY: 'KY – Kentucky', LA: 'LA – Louisiana', ME: 'ME – Maine', MD: 'MD – Maryland', MA: 'MA – Massachusetts', MI: 'MI – Michigan', MN: 'MN – Minnesota', MS: 'MS – Mississippi', MO: 'MO – Missouri', MT: 'MT – Montana', NE: 'NE – Nebraska', NV: 'NV – Nevada', NH: 'NH – New Hampshire', NJ: 'NJ – New Jersey', NM: 'NM – New Mexico', NY: 'NY – New York', NC: 'NC – North Carolina', ND: 'ND – North Dakota', OH: 'OH – Ohio', OK: 'OK – Oklahoma', OR: 'OR – Oregon', PA: 'PA – Pennsylvania', RI: 'RI – Rhode Island', SC: 'SC – South Carolina', SD: 'SD – South Dakota', TN: 'TN – Tennessee', TX: 'TX – Texas', UT: 'UT – Utah', VT: 'VT – Vermont', VA: 'VA – Virginia', WA: 'WA – Washington', WV: 'WV – West Virginia', WI: 'WI – Wisconsin', WY: 'WY – Wyoming' };
  // EIN: digits only, shown as 12-3456789
  function einFmt(v) { var d = String(v || '').replace(/\D/g, '').slice(0, 9); return d.length > 2 ? d.slice(0, 2) + '-' + d.slice(2) : d; }
  var $ = function (s) { return document.querySelector(s); };

  async function newClient(ctx, leadId) {
    var leads = await ctx.q(ctx.sb.from('leads').select('id,name,email,phone,language').order('created_at', { ascending: false }).limit(300));
    ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Novo cliente</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="nc-form" novalidate>' +
      '<div class="field"><label for="nc-lead">Criar a partir de um lead (opcional)</label><select id="nc-lead"><option value="">Nenhum</option>' + leads.map(function (l) { return '<option value="' + l.id + '">' + ctx.esc(l.name) + ' · ' + ctx.esc(l.email) + '</option>'; }).join('') + '</select></div>' +
      field('nc-name', 'Nome do cliente (pessoa ou grupo)', '', 'text', true) + field('nc-email', 'E-mail do titular (login do portal)', '', 'email', true) +
      '<div class="portal-grid2">' + field('nc-phone', 'Telefone', '', 'tel') + select('nc-lang', 'Idioma do portal', { pt: 'Português', en: 'English', es: 'Español' }, 'pt') + '</div>' +
      field('nc-co', 'Primeira empresa (razão social, opcional)', '', 'text') +
      select('nc-type', 'Tipo da empresa', ENTITY, 'llc_foreign') +
      '<div class="check-row"><input type="checkbox" id="nc-dl" checked><label for="nc-dl">Criar os prazos padrão de ' + new Date().getFullYear() + ' e ' + (new Date().getFullYear() + 1) + ' para a empresa</label></div>' +
      '<div class="check-row"><input type="checkbox" id="nc-inv" checked><label for="nc-inv">Enviar o convite de acesso por e-mail (cópia para ' + ctx.esc(ctx.CFG.adminEmail) + ')</label></div>' +
      '<div class="portal-alert" id="nc-msg" role="alert"></div><button class="btn btn--navy" type="submit">Criar cliente</button></form>');
    $('#nc-lead').onchange = function () { var l = leads.find(function (x) { return x.id === $('#nc-lead').value; }); if (l) { $('#nc-name').value = l.name; $('#nc-email').value = l.email; $('#nc-phone').value = l.phone || ''; if (l.language) $('#nc-lang').value = l.language; } };
    if (leadId && leads.some(function (x) { return x.id === leadId; })) { $('#nc-lead').value = leadId; $('#nc-lead').onchange(); }
    $('#nc-form').onsubmit = async function (e) {
      e.preventDefault();
      var m = $('#nc-msg'), name = $('#nc-name').value.trim(), email = $('#nc-email').value.trim().toLowerCase();
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return ctx.msg(m, 'Preencha o nome e um e-mail válido.', 'error');
      ctx.msg(m, 'Criando…', 'info');
      try {
        var c = await ctx.q(ctx.sb.from('clients').insert({ name: name, primary_email: email, phone: $('#nc-phone').value.trim() || null, language: $('#nc-lang').value, lead_id: $('#nc-lead').value || null }).select('*').single());
        await ctx.q(ctx.sb.from('client_users').insert({ client_id: c.id, email: email, name: name, role: 'owner', can_view: true, can_upload: true }));
        var coName = $('#nc-co').value.trim();
        if (coName) {
          var co = await ctx.q(ctx.sb.from('companies').insert({ client_id: c.id, legal_name: coName, entity_type: $('#nc-type').value, status: 'in_formation' }).select('*').single());
          if ($('#nc-dl').checked) { var y = new Date().getFullYear(); await ctx.q(ctx.sb.from('compliance_items').insert(standardDeadlines(co, y).concat(standardDeadlines(co, y + 1)).filter(function (d) { return daysUntil(d.due_date) >= 0; }))); }
        }
        if ($('#nc-lead').value) await ctx.sb.from('leads').update({ status: 'client' }).eq('id', $('#nc-lead').value);
        var sent = $('#nc-inv').checked ? await sendInvite(ctx, { clientId: c.id, email: email, name: name, clientName: name, role: 'owner', lang: $('#nc-lang').value }) : false;
        ctx.closeOverlay();
        ERoute.set('#/clientes?id=' + c.id + (sent ? '&convite=1' : ''));
      } catch (err) { ctx.msg(m, ctx.errText(err), 'error'); }
    };
  }

  function editClient(ctx, c) {
    ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Editar cliente</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="ec-form">' + field('ec-name', 'Nome', c.name, 'text', true) + field('ec-phone', 'Telefone', c.phone, 'tel') +
      select('ec-lang', 'Idioma do portal', { pt: 'Português', en: 'English', es: 'Español' }, c.language) +
      select('ec-status', 'Status', { active: 'Ativo', archived: 'Arquivado (bloqueia o acesso ao portal)' }, c.status) +
      '<div class="field"><label for="ec-notes">Notas internas</label><textarea id="ec-notes" rows="4">' + ctx.esc(c.notes || '') + '</textarea></div>' +
      '<p class="portal-muted" style="font-size:.85rem">O e-mail de login do titular é gerenciado na aba Usuários.</p>' +
      '<div class="portal-alert" id="ec-msg" role="alert"></div><button class="btn btn--navy" type="submit">Salvar</button></form>');
    $('#ec-form').onsubmit = async function (e) {
      e.preventDefault();
      var r = await ctx.sb.from('clients').update({ name: $('#ec-name').value.trim(), phone: $('#ec-phone').value.trim() || null, language: $('#ec-lang').value, status: $('#ec-status').value, notes: $('#ec-notes').value }).eq('id', c.id);
      if (r.error) return ctx.msg($('#ec-msg'), ctx.errText(r.error), 'error');
      ctx.closeOverlay(); ctx.route();
    };
  }

  /* ---------- companies ---------- */
  async function tabCompanies(body, ctx, c, companies) {
    var esc = ctx.esc;
    if (/convite=1/.test(ERoute.get())) body.insertAdjacentHTML('beforebegin', '<div class="portal-alert portal-alert--ok">Cliente criado e convite enviado para ' + esc(c.primary_email) + '.</div>');
    body.innerHTML = '<div class="portal-btn-row" style="justify-content:flex-end;margin-bottom:1rem"><button class="btn btn--navy btn--xs" type="button" id="co-new">Adicionar empresa</button></div>' +
      (companies.length ? '<div class="cards">' + companies.map(function (co) {
        return '<div class="co-card"><h3>' + esc(co.legal_name) + '</h3><div class="meta">' + esc(ENTITY[co.entity_type] || co.entity_type || '') + ' · ' + esc(co.state || '') + (co.formation_date ? ' · constituída em ' + fmtD(co.formation_date) : '') + '</div>' +
          '<div class="row"><span>' + (co.document_number ? 'Sunbiz ' + esc(co.document_number) : '') + (co.ein ? ' · EIN ' + esc(co.ein) : '') + '</span><span class="pill' + (co.status === 'active' ? ' pill--done' : '') + '">' + esc({ active: 'Ativa', in_formation: 'Em formação', inactive: 'Inativa', dissolved: 'Dissolvida' }[co.status]) + '</span></div>' +
          (window.AdminOA ? AdminOA.stepper(co, null) : '') +
          '<div class="portal-btn-row" style="margin-top:.85rem">' + (window.AdminOA ? '<button class="btn btn--navy btn--xs" data-tl="' + co.id + '">Timeline</button>' : '') + '<button class="btn btn--ghost btn--xs" data-edit="' + co.id + '">Editar</button><button class="btn btn--ghost btn--xs" data-dl="' + co.id + '">Gerar prazos padrão</button></div></div>';
      }).join('') + '</div>' : '<div class="portal-card empty-state"><strong>Nenhuma empresa cadastrada</strong>Adicione a primeira empresa deste cliente.</div>');
    body.querySelector('#co-new').onclick = function () { editCompany(ctx, c, null); };
    body.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { editCompany(ctx, c, companies.find(function (x) { return x.id === b.dataset.edit; })); }; });
    body.querySelectorAll('[data-tl]').forEach(function (b) { b.onclick = function () { AdminOA.timelineDrawer(ctx, companies.find(function (x) { return x.id === b.dataset.tl; })); }; });
    body.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { genDeadlines(ctx, companies.find(function (x) { return x.id === b.dataset.dl; })); }; });
  }
  function editCompany(ctx, c, co) {
    co = co || { state: 'FL', entity_type: 'llc_foreign', status: 'in_formation', fiscal_year_end: '12-31', registered_agent: 'Endeavor Business Solutions' };
    ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (co.id ? 'Editar empresa' : 'Nova empresa') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="co-form">' + field('co-name', 'Razão social', co.legal_name, 'text', true) +
      '<div class="portal-grid2">' + select('co-type', 'Tipo', ENTITY, co.entity_type) + select('co-state', 'Estado', Object.assign(US_STATES[co.state || 'FL'] ? {} : (function () { var o = {}; o[co.state] = co.state; return o; })(), US_STATES), co.state || 'FL') +
      field('co-date', 'Data de constituição', co.formation_date, 'date') + select('co-status', 'Status', { in_formation: 'Em formação', active: 'Ativa', inactive: 'Inativa', dissolved: 'Dissolvida' }, co.status) +
      field('co-doc', 'Número do documento (Sunbiz)', co.document_number) + field('co-ein', 'EIN', co.ein ? einFmt(co.ein) : '', 'text', false, ' placeholder="12-3456789" inputmode="numeric" maxlength="10" autocomplete="off" pattern="[0-9]{2}-[0-9]{7}"') +
      field('co-fye', 'Fim do ano fiscal (MM-DD)', co.fiscal_year_end) + field('co-ra', 'Registered agent', co.registered_agent) + '</div>' +
      field('co-addr', 'Endereço principal', co.address) +
      '<div class="field"><label for="co-notes">Notas</label><textarea id="co-notes" rows="3">' + ctx.esc(co.notes || '') + '</textarea></div>' +
      '<div class="portal-alert" id="co-msg" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button>' +
      (co.id ? '<button class="btn btn--danger" type="button" id="co-del">Excluir empresa</button>' : '') + '</div></form>');
    $('#co-ein').addEventListener('input', function () { var el = this, pos = el.selectionStart, before = el.value.length; el.value = einFmt(el.value); var np = Math.max(0, pos + el.value.length - before); try { el.setSelectionRange(np, np); } catch (er) { /* ignore */ } });
    $('#co-form').onsubmit = async function (e) {
      e.preventDefault();
      var einV = $('#co-ein').value.trim();
      if (einV && !/^\d{2}-\d{7}$/.test(einV)) { $('#co-ein').focus(); return ctx.msg($('#co-msg'), 'O EIN precisa ter 9 números (12-3456789).', 'error'); }
      var row = { legal_name: $('#co-name').value.trim(), entity_type: $('#co-type').value, state: ($('#co-state').value.trim() || 'FL').toUpperCase(), formation_date: $('#co-date').value || null,
        status: $('#co-status').value, document_number: $('#co-doc').value.trim() || null, ein: einV || null, fiscal_year_end: $('#co-fye').value.trim() || null,
        registered_agent: $('#co-ra').value.trim() || null, address: $('#co-addr').value.trim() || null, notes: $('#co-notes').value };
      if (row.legal_name.length < 2) return ctx.msg($('#co-msg'), 'Informe a razão social.', 'error');
      var r = co.id ? await ctx.sb.from('companies').update(row).eq('id', co.id) : await ctx.sb.from('companies').insert(Object.assign(row, { client_id: c.id }));
      if (r.error) return ctx.msg($('#co-msg'), ctx.errText(r.error), 'error');
      ctx.closeOverlay(); ctx.route();
    };
    if ($('#co-del')) $('#co-del').onclick = async function () {
      if (!confirm('Excluir a empresa "' + co.legal_name + '"? Documentos, prazos e relatórios dela também serão excluídos.')) return;
      var docs = await ctx.q(ctx.sb.from('company_documents').select('path').eq('company_id', co.id));
      if (docs.length) await ctx.sb.storage.from('client-docs').remove(docs.map(function (d) { return d.path; }));
      var r = await ctx.sb.from('companies').delete().eq('id', co.id);
      if (r.error) return ctx.msg($('#co-msg'), ctx.errText(r.error), 'error');
      ctx.closeOverlay(); ctx.route();
    };
  }
  async function genDeadlines(ctx, co) {
    var y = new Date().getFullYear();
    var yr = prompt('Gerar os prazos padrão de qual ano? (empresa: ' + co.legal_name + ')', String(daysUntil(y + '-05-01') < 0 ? y + 1 : y));
    if (!yr || !/^\d{4}$/.test(yr)) return;
    var items = standardDeadlines(co, +yr);
    var existing = await ctx.q(ctx.sb.from('compliance_items').select('title, due_date').eq('company_id', co.id));
    items = items.filter(function (i) { return !existing.some(function (x) { return x.title === i.title && x.due_date === i.due_date; }); });
    if (!items.length) return alert('Os prazos padrão desse ano já existem.');
    var r = await ctx.sb.from('compliance_items').insert(items);
    if (r.error) return alert(ctx.errText(r.error));
    alert(items.length + ' prazos criados. Confira as datas com o contador, principalmente extensões e anos fiscais diferentes do calendário.');
    ERoute.set(ERoute.get().replace(/&tab=[a-z]+/, '') + '&tab=prazos');
  }

  /* ---------- documents ---------- */
  async function tabDocs(body, ctx, c, companies) {
    var esc = ctx.esc;
    if (!companies.length) { body.innerHTML = '<div class="portal-card empty-state"><strong>Cadastre uma empresa primeiro</strong>Os documentos ficam organizados por empresa.</div>'; return; }
    var docs = await ctx.q(ctx.sb.from('company_documents').select('*').eq('client_id', c.id).order('created_at', { ascending: false }));
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Adicionar documento</h2><form class="portal-form" id="up-form">' +
      '<div class="portal-grid2"><div class="field"><label for="up-co">Empresa</label><select id="up-co">' + companies.map(function (co) { return '<option value="' + co.id + '">' + esc(co.legal_name) + '</option>'; }).join('') + '</select></div>' +
      select('up-cat', 'Categoria', { formation: DOC_CAT.formation, tax_return: DOC_CAT.tax_return, compliance: DOC_CAT.compliance, report: DOC_CAT.report, other: DOC_CAT.other }, 'formation') +
      field('up-title', 'Título', '', 'text', true, ' placeholder="Ex.: Articles of Organization"') + field('up-year', 'Ano (opcional)', '', 'number', false, ' min="1990" max="2100"') + '</div>' +
      '<label class="upload-zone" for="up-file"><input type="file" id="up-file" class="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.csv,.xls,.xlsx,.doc,.docx"><strong>Escolher arquivo</strong><span class="portal-muted" id="up-fname">PDF, imagem, planilha ou Word · até 25 MB</span></label>' +
      '<div class="check-row"><input type="checkbox" id="up-vis" checked><label for="up-vis">Visível para o cliente no portal</label></div>' +
      '<div class="portal-alert" id="up-msg" role="status"></div><button class="btn btn--navy" type="submit" style="justify-self:start">Enviar documento</button></form></section>' +
      '<section class="portal-card"><div class="toolbar" style="justify-content:space-between"><h2 class="portal-h2" style="margin:0">Documentos</h2>' +
      '<select id="dl-filter" aria-label="Filtrar por empresa"><option value="">Todas as empresas</option>' + companies.map(function (co) { return '<option value="' + co.id + '">' + esc(co.legal_name) + '</option>'; }).join('') + '</select></div><ul class="doclist" id="doc-list"></ul></section>';
    var fileIn = body.querySelector('#up-file');
    fileIn.onchange = function () { var f = fileIn.files[0]; body.querySelector('#up-fname').textContent = f ? f.name + ' · ' + Math.round(f.size / 1024) + ' KB' : ''; if (f && !body.querySelector('#up-title').value) body.querySelector('#up-title').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '); };
    body.querySelector('#up-form').onsubmit = async function (e) {
      e.preventDefault();
      var m = body.querySelector('#up-msg'), f = fileIn.files[0], title = body.querySelector('#up-title').value.trim();
      if (!f) return ctx.msg(m, 'Escolha um arquivo.', 'error');
      if (f.size > 25 * 1024 * 1024) return ctx.msg(m, 'O arquivo precisa ter até 25 MB.', 'error');
      if (!title) return ctx.msg(m, 'Dê um título ao documento.', 'error');
      var co = body.querySelector('#up-co').value, cat = body.querySelector('#up-cat').value;
      var path = c.id + '/' + co + '/' + cat + '/' + crypto.randomUUID().slice(0, 8) + '-' + slug(f.name);
      ctx.msg(m, 'Enviando…', 'info');
      try {
        var buf = await f.arrayBuffer();
        var up = await ctx.sb.storage.from('client-docs').upload(path, new Blob([buf], { type: f.type || 'application/octet-stream' }), { contentType: f.type || 'application/octet-stream' });
        if (up.error) throw up.error;
        await ctx.q(ctx.sb.from('company_documents').insert({ company_id: co, client_id: c.id, category: cat, title: title, year: +body.querySelector('#up-year').value || null, path: path,
          mime: f.type || null, size_bytes: f.size, sha256: await ctx.sha256Hex(buf), visible_to_client: body.querySelector('#up-vis').checked }));
        ctx.route();
      } catch (err) { ctx.msg(m, ctx.errText(err), 'error'); }
    };
    function draw() {
      var fco = body.querySelector('#dl-filter').value;
      var rows = docs.filter(function (d) { return !fco || d.company_id === fco; });
      body.querySelector('#doc-list').innerHTML = rows.length ? rows.map(function (d) {
        var co = companies.find(function (x) { return x.id === d.company_id; });
        return '<li><span class="ficon" aria-hidden="true">' + fileIcon(d.path) + '</span><div><div class="dname">' + esc(d.title) + (d.year ? ' (' + d.year + ')' : '') + '</div>' +
          '<div class="dmeta"><span class="pill pill--' + d.category + '">' + esc(DOC_CAT[d.category]) + '</span> ' + esc(co ? co.legal_name : '') + ' · ' + esc(ctx.fmtDT(d.created_at)) + ' · ' + esc(d.uploaded_by_email || '') + (d.visible_to_client ? '' : ' · <strong>oculto do cliente</strong>') + '</div></div>' +
          '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" data-view="' + d.id + '">Ver</button><button class="btn btn--ghost btn--xs" data-vis="' + d.id + '">' + (d.visible_to_client ? 'Ocultar' : 'Mostrar') + '</button><button class="btn btn--ghost btn--xs" data-log="' + d.id + '">Acessos</button><button class="btn btn--danger btn--xs" data-del="' + d.id + '">Excluir</button></div></li>';
      }).join('') : '<li><div class="empty-state" style="grid-column:1/-1"><strong>Nenhum documento</strong></div></li>';
      var find = function (id) { return docs.find(function (x) { return x.id === id; }); };
      body.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { var d = find(b.dataset.view); ctx.viewFile('client-docs', d.path, d.title, { mime: d.mime }); }; });
      body.querySelectorAll('[data-vis]').forEach(function (b) { b.onclick = async function () { var d = find(b.dataset.vis); var r = await ctx.sb.from('company_documents').update({ visible_to_client: !d.visible_to_client }).eq('id', d.id); if (!r.error) { d.visible_to_client = !d.visible_to_client; draw(); } }; });
      body.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = async function () {
        var d = find(b.dataset.del); if (!confirm('Excluir "' + d.title + '"? Esta ação não pode ser desfeita.')) return;
        await ctx.sb.storage.from('client-docs').remove([d.path]); var r = await ctx.sb.from('company_documents').delete().eq('id', d.id);
        if (!r.error) { docs = docs.filter(function (x) { return x.id !== d.id; }); draw(); }
      }; });
      body.querySelectorAll('[data-log]').forEach(function (b) { b.onclick = async function () {
        var d = find(b.dataset.log);
        var log = await ctx.q(ctx.sb.from('doc_access_log').select('*').eq('document_id', d.id).order('at', { ascending: false }).limit(100));
        var A = { view: 'Visualizou', download: 'Baixou', upload: 'Enviou' };
        ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Acessos: ' + esc(d.title) + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
          (log.length ? '<ul class="timeline">' + log.map(function (x) { return '<li><strong>' + esc(A[x.action] || x.action) + '</strong> · ' + esc(x.email || '') + ' · ' + esc(ctx.fmtDT(x.at, { timeStyle: 'medium' })) + '</li>'; }).join('') + '</ul>' : '<p class="portal-muted">Nenhum acesso do cliente registrado.</p>'));
      }; });
    }
    body.querySelector('#dl-filter').onchange = draw; draw();
  }

  /* ---------- deadlines ---------- */
  async function tabDeadlines(body, ctx, c, companies) {
    var esc = ctx.esc;
    if (!companies.length) { body.innerHTML = '<div class="portal-card empty-state"><strong>Cadastre uma empresa primeiro</strong></div>'; return; }
    var items = await ctx.q(ctx.sb.from('compliance_items').select('*').eq('client_id', c.id).order('due_date'));
    body.innerHTML = '<div class="portal-btn-row" style="justify-content:space-between;margin-bottom:1rem"><div class="dl-sum dl-sum--mini" id="dl-sum"></div>' +
      '<button class="btn btn--navy btn--xs" type="button" id="dl-new">Adicionar prazo</button></div><section class="portal-card" id="dl-list"></section>' +
      '<p class="portal-muted" style="font-size:.85rem;margin-top:.75rem">Prazos padrão usam datas gerais federais e da Flórida para ano-calendário, já ajustadas para o próximo dia útil. Confirme com o contador.</p>';
    function draw() {
      var rows = items, cnt = { done: 0, pend: 0, over: 0 };
      rows.forEach(function (i) { if (i.status === 'done') cnt.done++; else if (i.status !== 'not_applicable') { if (daysUntil(i.due_date) < 0) cnt.over++; else cnt.pend++; } });
      body.querySelector('#dl-sum').innerHTML = '<span class="dl-sum__i dl-sum__i--done"><b>' + cnt.done + '</b> <span>Concluídos</span></span><span class="dl-sum__i dl-sum__i--pend"><b>' + cnt.pend + '</b> <span>Pendentes</span></span><span class="dl-sum__i dl-sum__i--over"><b>' + cnt.over + '</b> <span>Vencidos</span></span>';
      body.querySelector('#dl-list').innerHTML = rows.length ? rows.map(function (i) {
        var co = companies.find(function (x) { return x.id === i.company_id; }), p = i.due_date.split('-');
        return '<div class="deadline"><div class="deadline__date"><b>' + p[2] + '</b><span>' + MONTHS[+p[1] - 1] + ' ' + p[0] + '</span></div>' +
          '<div><strong>' + esc(i.title) + '</strong><div class="dmeta portal-muted" style="font-size:.85rem">' + esc(co ? co.legal_name : '') + ' · ' + esc(DL_CAT[i.category]) + (i.notes ? ' · ' + esc(i.notes) : '') + '</div></div>' +
          '<div class="portal-btn-row">' + dlPill(i) + (i.status !== 'done' && i.status !== 'not_applicable' ? '<button class="btn btn--ghost btn--xs" data-ok="' + i.id + '" title="Marcar como concluído">✓ Concluído</button>' : '') + '<select data-st="' + i.id + '" aria-label="Status do prazo">' + Object.keys(DL_STATUS).map(function (k) { return '<option value="' + k + '"' + (k === i.status ? ' selected' : '') + '>' + DL_STATUS[k] + '</option>'; }).join('') + '</select>' +
          '<button class="btn btn--ghost btn--xs" data-ed="' + i.id + '">Editar</button></div></div>';
      }).join('') : '<div class="empty-state"><strong>Nenhum prazo pendente</strong>Use "Gerar prazos padrão" na aba Empresas ou adicione manualmente.</div>';
      body.querySelectorAll('[data-st]').forEach(function (s) { s.style.cssText = 'min-height:2.25rem;border:1px solid #c9ced8;border-radius:8px;padding:0 .4rem;font-size:.85rem';
        s.onchange = async function () { var it = items.find(function (x) { return x.id === s.dataset.st; }); var r = await ctx.sb.from('compliance_items').update({ status: s.value, completed_at: s.value === 'done' ? new Date().toISOString() : null }).eq('id', it.id); if (!r.error) { it.status = s.value; draw(); } }; });
      body.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { editDeadline(items.find(function (x) { return x.id === b.dataset.ed; })); }; });
      body.querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = async function () { var it = items.find(function (x) { return x.id === b.dataset.ok; }), now = new Date().toISOString(); var r = await ctx.sb.from('compliance_items').update({ status: 'done', completed_at: now }).eq('id', it.id); if (!r.error) { it.status = 'done'; it.completed_at = now; draw(); } }; });
    }
    function editDeadline(it) {
      it = it || { company_id: companies[0].id, category: 'other', status: 'pending' };
      ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (it.id ? 'Editar prazo' : 'Novo prazo') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
        '<form class="portal-form" id="dl-form"><div class="field"><label for="d-co">Empresa</label><select id="d-co">' + companies.map(function (co) { return '<option value="' + co.id + '"' + (co.id === it.company_id ? ' selected' : '') + '>' + esc(co.legal_name) + '</option>'; }).join('') + '</select></div>' +
        field('d-title', 'Título', it.title, 'text', true) + '<div class="portal-grid2">' + field('d-date', 'Vencimento', it.due_date, 'date', true) + select('d-cat', 'Categoria', DL_CAT, it.category) + '</div>' +
        '<div class="field"><label for="d-notes">Observação (visível ao cliente)</label><textarea id="d-notes" rows="3">' + esc(it.notes || '') + '</textarea></div>' +
        '<div class="portal-alert" id="d-msg" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button>' + (it.id ? '<button class="btn btn--danger" type="button" id="d-del">Excluir</button>' : '') + '</div></form>');
      $('#dl-form').onsubmit = async function (e) {
        e.preventDefault();
        var row = { company_id: $('#d-co').value, title: $('#d-title').value.trim(), due_date: $('#d-date').value, category: $('#d-cat').value, notes: $('#d-notes').value.trim() || null };
        if (row.title.length < 2 || !row.due_date) return ctx.msg($('#d-msg'), 'Preencha título e vencimento.', 'error');
        var r = it.id ? await ctx.sb.from('compliance_items').update(row).eq('id', it.id) : await ctx.sb.from('compliance_items').insert(row);
        if (r.error) return ctx.msg($('#d-msg'), ctx.errText(r.error), 'error');
        ctx.closeOverlay(); ctx.route();
      };
      if ($('#d-del')) $('#d-del').onclick = async function () { if (!confirm('Excluir este prazo?')) return; await ctx.sb.from('compliance_items').delete().eq('id', it.id); ctx.closeOverlay(); ctx.route(); };
    }
    body.querySelector('#dl-new').onclick = function () { editDeadline(null); };
    draw();
  }

  /* ---------- users ---------- */
  var PERM_L = { access: 'Acesso do parceiro', companies: 'Empresas', allCompanies: 'Todas as empresas (inclusive novas)', docs: 'Documentos que pode ver', other: 'Outras permissões',
    cat_formation: 'Formação', cat_tax_return: 'Imposto de renda', cat_report: 'Relatórios financeiros', cat_compliance: 'Compliance', cat_other: 'Outros',
    deadlines: 'Pode ver os prazos fiscais', upload: 'Pode enviar documentos', docsHint: 'O parceiro sempre vê os documentos que ele mesmo enviou.', full: 'Acesso completo',
    docsShort: 'Docs', noDocs: 'Sem documentos', deadlinesShort: 'Prazos', uploadShort: 'Envio', noCompanies: 'Nenhuma empresa' };
  async function tabUsers(body, ctx, c, companies) {
    var esc = ctx.esc;
    companies = companies || [];
    var users = await ctx.q(ctx.sb.from('client_users').select('*').eq('client_id', c.id).order('role', { ascending: false }).order('invited_at'));
    var ST = { invited: 'Convidado', active: 'Ativo', revoked: 'Revogado' };
    body.innerHTML = '<div class="portal-btn-row" style="justify-content:flex-end;margin-bottom:1rem"><button class="btn btn--navy btn--xs" type="button" id="u-new">Adicionar usuário</button></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Usuário</th><th>Perfil</th><th>Acesso</th><th>Status</th><th></th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr style="cursor:default"><td><strong>' + esc(u.name || u.email) + '</strong><span class="sub">' + esc(u.email) + '</span></td><td>' + (u.role === 'owner' ? 'Titular · Portal do Cliente' : 'Parceiro · ' + esc(COLLAB[u.collab_type] || '') + '<span class="sub">Portal do Parceiro</span>') + '</td>' +
          '<td><span class="perm-sum">' + esc(EPerms.summary(u, PERM_L, companies)) + '</span></td>' +
          '<td><span class="pill' + (u.status === 'active' ? ' pill--done' : u.status === 'revoked' ? ' pill--overdue' : ' pill--soon') + '">' + ST[u.status] + '</span>' + (u.accepted_at ? '<span class="sub">desde ' + esc(ctx.fmtDT(u.accepted_at)) + '</span>' : '') + '</td>' +
          '<td><div class="portal-btn-row">' + (u.role !== 'owner' && u.status !== 'revoked' ? '<button class="btn btn--ghost btn--xs" data-perm="' + u.id + '">Permissões</button>' : '') +
          (u.status === 'invited' ? '<button class="btn btn--ghost btn--xs" data-resend="' + u.id + '">Reenviar convite</button>' : '') +
          (u.status !== 'revoked' ? '<button class="btn btn--danger btn--xs" data-revoke="' + u.id + '">Revogar</button>' : '<button class="btn btn--ghost btn--xs" data-restore="' + u.id + '">Reativar</button>') + '</div></td></tr>';
      }).join('') + '</tbody></table></div><p class="portal-muted" style="font-size:.85rem;margin-top:.75rem">O titular entra pelo Portal do Cliente. Contadores, bookkeepers e administradores de imóveis entram pelo Portal do Parceiro e só veem o que estiver liberado. Todos precisam ativar a verificação em duas etapas.</p>';
    var find = function (id) { return users.find(function (x) { return x.id === id; }); };
    body.querySelectorAll('[data-resend]').forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.resend); var ok = await sendInvite(ctx, { clientId: c.id, email: u.email, name: u.name || u.email, clientName: c.name, role: u.role, lang: c.language }); alert(ok ? 'Convite reenviado.' : 'Não foi possível enviar agora.'); }; });
    body.querySelectorAll('[data-revoke]').forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.revoke); if (!confirm('Revogar o acesso de ' + u.email + '?')) return; await ctx.sb.from('client_users').update({ status: 'revoked' }).eq('id', u.id); ctx.route(); }; });
    body.querySelectorAll('[data-restore]').forEach(function (b) { b.onclick = async function () { var u = find(b.dataset.restore); var r = await ctx.sb.from('client_users').update({ status: u.user_id ? 'active' : 'invited' }).eq('id', u.id); if (r.error) alert(ctx.errText(r.error)); ctx.route(); }; });
    body.querySelectorAll('[data-perm]').forEach(function (b) { b.onclick = function () { userForm(find(b.dataset.perm)); }; });
    body.querySelector('#u-new').onclick = function () { userForm(null); };
    function userForm(u) {
      var edit = !!u;
      ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (edit ? 'Permissões: ' + esc(u.name || u.email) : 'Adicionar usuário') + '</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
        '<form class="portal-form" id="u-form" novalidate>' + (edit ? '' : field('u-name', 'Nome', '', 'text', true) + field('u-email', 'E-mail', '', 'email', true) +
        select('u-role', 'Perfil', { collaborator: 'Parceiro (contador, bookkeeping, property management)', owner: 'Titular (acesso completo)' }, 'collaborator')) +
        '<div id="u-collab">' + select('u-type', 'Tipo de parceiro', COLLAB, u ? u.collab_type || 'other' : 'accountant') + EPerms.html('up', PERM_L, companies, u) + '</div>' +
        (edit ? '' : '<div class="check-row"><input type="checkbox" id="u-inv" checked><label for="u-inv">Enviar convite por e-mail</label></div>') +
        '<div class="portal-alert" id="u-msg" role="alert"></div><button class="btn btn--navy" type="submit">' + (edit ? 'Salvar permissões' : 'Adicionar') + '</button></form>');
      var form = $('#u-form');
      EPerms.wire(form, 'up', $('#u-type'), !edit);
      if ($('#u-role')) $('#u-role').onchange = function () { $('#u-collab').hidden = $('#u-role').value === 'owner'; };
      form.onsubmit = async function (e) {
        e.preventDefault();
        var role = edit ? u.role : $('#u-role').value, r;
        var perms = role === 'owner' ? { can_view: true, can_upload: true, perm_doc_categories: EPerms.CATS.slice(), perm_companies: null, perm_deadlines: true } : EPerms.read(form, 'up');
        if (perms.perm_companies && !perms.perm_companies.length) return ctx.msg($('#u-msg'), 'Escolha pelo menos uma empresa ou marque "Todas as empresas".', 'error');
        var row = Object.assign({ collab_type: role === 'owner' ? null : $('#u-type').value }, perms);
        if (edit) r = await ctx.sb.from('client_users').update(row).eq('id', u.id);
        else {
          var email = $('#u-email').value.trim().toLowerCase(), name = $('#u-name').value.trim();
          if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return ctx.msg($('#u-msg'), 'Preencha nome e e-mail válido.', 'error');
          r = await ctx.sb.from('client_users').insert(Object.assign({ client_id: c.id, email: email, name: name, role: role }, row));
          if (!r.error && $('#u-inv').checked) await sendInvite(ctx, { clientId: c.id, email: email, name: name, clientName: c.name, role: role, lang: c.language });
        }
        if (r.error) return ctx.msg($('#u-msg'), /unique|duplicate/i.test(r.error.message) ? 'Este e-mail já tem acesso a este cliente.' : ctx.errText(r.error), 'error');
        ctx.closeOverlay(); ctx.route();
      };
    }
  }

  /* ---------- books & reports: QuickBooks or Endeavor Bookkeeping (chosen by the team; the client only sees the reports) ---------- */
  async function tabFinance(body, ctx, c, companies) {
    var esc = ctx.esc;
    if (!companies.length) { body.innerHTML = '<div class="portal-card empty-state"><strong>Cadastre uma empresa primeiro</strong></div>'; return; }
    var reports = await ctx.q(ctx.sb.from('company_documents').select('*').eq('client_id', c.id).eq('category', 'report').order('created_at', { ascending: false }));
    var stats = await Promise.all(companies.map(function (co) { return ctx.sb.rpc('qbo_status', { p_company: co.id }).then(function (r) { return (r.data || [])[0] || {}; }); }));
    var y = new Date().getFullYear(), qn = Math.floor(new Date().getMonth() / 3);
    var defQ = qn === 0 ? 4 : qn, defY = qn === 0 ? y - 1 : y;
    var periodSel = function (id) { return '<select data-y="' + id + '" aria-label="Ano">' + [y, y - 1, y - 2].map(function (v) { return '<option' + (v === defY ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
      '<select data-q="' + id + '" aria-label="Período"><option value="1">1º trimestre</option><option value="2">2º trimestre</option><option value="3">3º trimestre</option><option value="4">4º trimestre</option><option value="0">Ano completo</option></select>'; };
    body.innerHTML = companies.map(function (co, i) {
      var s = stats[i], mine = reports.filter(function (r) { return r.company_id === co.id; }), prov = co.books_provider || (s.connected ? 'quickbooks' : 'none');
      var badge = prov === 'endeavor' ? '<span class="qbo-badge qbo-badge--bk">Endeavor Bookkeeping</span>' : prov === 'quickbooks' && s.connected ? '<span class="qbo-badge">QuickBooks conectado' + (s.qbo_company_name ? ': ' + esc(s.qbo_company_name) : '') + '</span>' : '<span class="pill">Contabilidade não conectada</span>';
      var actions = prov === 'endeavor'
        ? '<a class="btn btn--ghost btn--xs" href="#/bookkeeping?co=' + co.id + '">Abrir no Bookkeeping</a>' + periodSel(co.id) + '<button class="btn btn--navy btn--xs" data-pub="' + co.id + '">Publicar relatórios</button><button class="btn btn--ghost btn--xs" data-off="' + co.id + '">Desativar</button>'
        : prov === 'quickbooks' && s.connected
        ? periodSel(co.id) + '<button class="btn btn--navy btn--xs" data-gen="' + co.id + '">Gerar relatórios</button><button class="btn btn--danger btn--xs" data-disc="' + co.id + '">Desconectar</button>'
        : '<button class="btn btn--navy btn--xs" data-conn="' + co.id + '">Conectar QuickBooks</button><button class="btn btn--gold btn--xs" data-bk="' + co.id + '">Conectar ao Endeavor Bookkeeping</button>' +
          '<span class="portal-muted" style="font-size:.82rem">Para o QuickBooks, a Endeavor precisa ter acesso à conta do cliente (contador convidado).</span>';
      return '<section class="portal-card"><div class="toolbar" style="justify-content:space-between;align-items:center"><h2 class="portal-h2" style="margin:0">' + esc(co.legal_name) + '</h2>' + badge + '</div>' +
        (prov === 'quickbooks' && s.last_error ? '<div class="portal-alert portal-alert--error">' + esc(s.last_error) + '. É preciso reconectar o QuickBooks.</div>' : '') +
        '<div class="portal-btn-row">' + actions + '</div><div class="portal-alert" id="qm-' + co.id + '" role="status"></div>' +
        (mine.length ? '<ul class="doclist" style="margin-top:.5rem">' + mine.map(function (d) { return '<li><span class="ficon" aria-hidden="true">PDF</span><div><div class="dname">' + esc(d.title) + '</div><div class="dmeta">' + esc(ctx.fmtDT(d.created_at)) + (d.uploaded_by_email ? ' · ' + esc(d.uploaded_by_email) : '') + '</div></div><button class="btn btn--ghost btn--xs" data-rv="' + d.id + '">Ver</button></li>'; }).join('') + '</ul>' : '<p class="portal-muted" style="margin-top:.5rem">Nenhum relatório publicado ainda. O cliente vê aqui os PDFs publicados.</p>') +
        '</section>';
    }).join('');
    body.querySelectorAll('[data-q]').forEach(function (s) { s.value = String(defQ); });
    var call = async function (payload) {
      var sess = (await ctx.sb.auth.getSession()).data.session;
      var r = await fetch(ctx.CFG.functionsUrl + '/qbo', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
      return j;
    };
    var QERR = { qbo_not_configured: 'A integração com o QuickBooks ainda não foi configurada (Client ID e Secret da Intuit).', qbo_reconnect_required: 'A conexão expirou. É preciso reconectar o QuickBooks.', qbo_not_connected: 'QuickBooks não conectado.', future_period: 'Esse período ainda não começou.' };
    var err = function (id, e) { ctx.msg(body.querySelector('#qm-' + id), QERR[e.message] || ctx.errText(e), 'error'); };
    var setProv = function (id, p) { return ctx.sb.rpc('bk_set_provider', { p_company: id, p_provider: p }); };
    body.querySelectorAll('[data-conn]').forEach(function (b) { b.onclick = async function () {
      try { var j = await call({ action: 'connect', company_id: b.dataset.conn, return_to: location.href.split('#')[0] }); await setProv(b.dataset.conn, 'quickbooks'); ERoute.go(j.url); } catch (e) { err(b.dataset.conn, e); }
    }; });
    body.querySelectorAll('[data-bk]').forEach(function (b) { b.onclick = async function () {
      b.disabled = true; var r = await setProv(b.dataset.bk, 'endeavor'); if (r.error) { b.disabled = false; return err(b.dataset.bk, r.error); }
      ERoute.set('#/bookkeeping?co=' + b.dataset.bk + '&tab=overview', false);
    }; });
    body.querySelectorAll('[data-off]').forEach(function (b) { b.onclick = async function () {
      if (!confirm('Desativar o Endeavor Bookkeeping desta empresa? Os lançamentos ficam guardados e voltam se reativar.')) return;
      var r = await setProv(b.dataset.off, 'none'); if (r.error) return err(b.dataset.off, r.error); ctx.route();
    }; });
    body.querySelectorAll('[data-pub]').forEach(function (b) { b.onclick = async function () {
      var id = b.dataset.pub; b.disabled = true; ctx.msg(body.querySelector('#qm-' + id), 'Gerando os PDFs a partir do Bookkeeping…', 'info');
      try { await window.AdminBooks.publish(ctx, id, +body.querySelector('[data-y="' + id + '"]').value, +body.querySelector('[data-q="' + id + '"]').value); ctx.route(); }
      catch (e) { b.disabled = false; err(id, e); }
    }; });
    body.querySelectorAll('[data-disc]').forEach(function (b) { b.onclick = async function () {
      if (!confirm('Desconectar o QuickBooks desta empresa?')) return;
      try { await call({ action: 'disconnect', company_id: b.dataset.disc }); await setProv(b.dataset.disc, 'none'); ctx.route(); } catch (e) { err(b.dataset.disc, e); }
    }; });
    body.querySelectorAll('[data-gen]').forEach(function (b) { b.onclick = async function () {
      var id = b.dataset.gen; b.disabled = true; ctx.msg(body.querySelector('#qm-' + id), 'Gerando relatórios no QuickBooks…', 'info');
      try { await call({ action: 'generate', company_id: id, year: +body.querySelector('[data-y="' + id + '"]').value, quarter: +body.querySelector('[data-q="' + id + '"]').value }); ctx.route(); }
      catch (e) { b.disabled = false; err(id, e); }
    }; });
    body.querySelectorAll('[data-rv]').forEach(function (b) { b.onclick = function () { var d = reports.find(function (x) { return x.id === b.dataset.rv; }); ctx.viewFile('client-docs', d.path, d.title, { mime: 'application/pdf' }); }; });
  }

  window.AdminClients.standardDeadlines = standardDeadlines;
})();
