/* Endeavor admin console: login + MFA, dashboard, CRM, scheduling and e-signature. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  var app = document.getElementById('app');
  var state = { settings: null, leads: [], bookings: [], envelopes: [] };

  /* ---------- helpers ---------- */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var STATUS_PT = { new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', proposal: 'Proposta', client: 'Cliente', lost: 'Perdido',
    sent: 'Enviado', viewed: 'Visualizado', signed: 'Assinado', voided: 'Anulado', expired: 'Expirado',
    confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído', no_show: 'Não compareceu' };
  var SOURCE_PT = { contact_form: 'Formulário', booking: 'Agendamento', manual: 'Manual' };
  var MEET_PT = { video: 'Vídeo', phone: 'Telefone', whatsapp: 'WhatsApp' };
  function badge(s) { return '<span class="badge badge--' + esc(s) + '">' + esc(STATUS_PT[s] || s) + '</span>'; }
  function tz() { return (state.settings && state.settings.timezone) || 'America/New_York'; }
  function fmtDT(iso, opts) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('pt-BR', Object.assign({ timeZone: tz(), dateStyle: 'short', timeStyle: 'short' }, opts || {})).format(new Date(iso));
  }
  function fmtDay(iso) { return new Intl.DateTimeFormat('pt-BR', { timeZone: tz(), weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(iso)); }
  function msg(el, text, kind) { if (!el) return; el.className = 'portal-alert portal-alert--' + (kind || 'info'); el.textContent = text || ''; }
  function errText(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link enviado pelo Supabase antes de entrar.';
    if (/Invalid TOTP|invalid.*code/i.test(m)) return 'Código inválido. Confira o horário do celular e tente de novo.';
    if (/row-level security|permission denied/i.test(m)) return 'Sem permissão. Entre novamente com verificação em duas etapas.';
    return m;
  }
  function download(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  async function sha256Hex(buf) {
    var d = await crypto.subtle.digest('SHA-256', buf);
    return Array.prototype.map.call(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function siteUrl(file) { return new URL(file, location.href).href.split('#')[0]; }
  function copy(text, btn) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
      if (btn) { var t = btn.textContent; btn.textContent = 'Copiado ✓'; setTimeout(function () { btn.textContent = t; }, 1600); }
    }).catch(function () { window.prompt('Copie o link:', text); });
  }

  /* ---------- auth flow ---------- */
  var recoveryMode = false;
  sb.auth.onAuthStateChange(function (ev) {
    if (ev === 'PASSWORD_RECOVERY') { recoveryMode = true; renderNewPassword(); }
    if (ev === 'SIGNED_OUT') { renderLogin(); }
  });
  document.getElementById('btn-signout').addEventListener('click', async function () { await sb.auth.signOut(); location.hash = ''; renderLogin(); });

  async function boot() {
    if (recoveryMode) return;
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return renderLogin();
    var u = s.user;
    $('#topbar-user').hidden = false; $('#topbar-email').textContent = u.email;
    if (String(u.email).toLowerCase() !== String(CFG.adminEmail).toLowerCase()) {
      var ok = (await sb.rpc('is_admin_email')).data;
      if (!ok) return renderDenied(u.email);
    }
    var aal = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    if (!aal || aal.currentLevel !== 'aal2') return renderMfa();
    var isAdmin = (await sb.rpc('is_admin')).data;
    if (!isAdmin) return renderDenied(u.email);
    startConsole();
  }

  function authShell(inner) {
    $('#topbar-user').hidden = true;
    app.innerHTML = '<main class="portal-main"><div class="auth portal-card">' + inner + '</div></main>';
  }

  function renderLogin() {
    authShell(
      '<h1 class="portal-h1">Console Admin</h1><p class="portal-muted">Acesso restrito à equipe da Endeavor.</p>' +
      '<form class="portal-form" id="f-login" novalidate>' +
      '<div class="field"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required value="' + esc(CFG.adminEmail) + '"></div>' +
      '<div class="field"><label for="l-pass">Senha</label><input id="l-pass" type="password" autocomplete="current-password" required minlength="10"></div>' +
      '<div class="portal-alert" id="l-msg" role="alert"></div>' +
      '<button class="btn btn--navy btn--block" type="submit">Entrar</button>' +
      '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="l-first">Primeiro acesso: criar senha</button>' +
      '<button class="btn btn--ghost btn--xs" type="button" id="l-forgot">Esqueci a senha</button></div></form>');
    var m = $('#l-msg');
    $('#f-login').addEventListener('submit', async function (e) {
      e.preventDefault();
      msg(m, 'Entrando…', 'info');
      var r = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
      if (r.error) return msg(m, errText(r.error), 'error');
      boot();
    });
    $('#l-first').addEventListener('click', async function () {
      var email = $('#l-email').value.trim().toLowerCase(), pass = $('#l-pass').value;
      if (email !== CFG.adminEmail.toLowerCase()) return msg(m, 'O primeiro acesso só pode ser criado para ' + CFG.adminEmail + '.', 'error');
      if (pass.length < 12) return msg(m, 'Escolha uma senha com pelo menos 12 caracteres e digite no campo Senha.', 'error');
      var r = await sb.auth.signUp({ email: email, password: pass, options: { emailRedirectTo: siteUrl('admin.html') } });
      if (r.error) return msg(m, errText(r.error), 'error');
      if (r.data.session) return boot();
      msg(m, 'Conta criada. Abra o e-mail de confirmação enviado para ' + email + ', clique no link e depois entre aqui.', 'ok');
    });
    $('#l-forgot').addEventListener('click', async function () {
      var email = $('#l-email').value.trim();
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl('admin.html') });
      msg(m, r.error ? errText(r.error) : 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.', r.error ? 'error' : 'ok');
    });
  }

  function renderNewPassword() {
    authShell('<h1 class="portal-h1">Nova senha</h1><form class="portal-form" id="f-np">' +
      '<div class="field"><label for="np">Nova senha (mín. 12 caracteres)</label><input id="np" type="password" autocomplete="new-password" minlength="12" required></div>' +
      '<div class="portal-alert" id="np-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">Salvar senha</button></form>');
    $('#f-np').addEventListener('submit', async function (e) {
      e.preventDefault();
      var p = $('#np').value; if (p.length < 12) return msg($('#np-msg'), 'Use pelo menos 12 caracteres.', 'error');
      var r = await sb.auth.updateUser({ password: p });
      if (r.error) return msg($('#np-msg'), errText(r.error), 'error');
      recoveryMode = false; history.replaceState(null, '', location.pathname); boot();
    });
  }

  function renderDenied(email) {
    authShell('<h1 class="portal-h1">Acesso negado</h1><p>A conta <strong>' + esc(email) + '</strong> não tem permissão de administrador.</p>' +
      '<button class="btn btn--navy" type="button" id="d-out">Sair</button>');
    $('#d-out').addEventListener('click', async function () { await sb.auth.signOut(); renderLogin(); });
  }

  async function renderMfa() {
    var f = (await sb.auth.mfa.listFactors()).data || { totp: [], all: [] };
    var verified = (f.totp || []).filter(function (x) { return x.status === 'verified'; });
    if (verified.length) {
      authShell('<h1 class="portal-h1">Verificação em duas etapas</h1><p class="portal-muted">Digite o código de 6 dígitos do seu aplicativo autenticador.</p><p class="portal-muted" style="font-size:.88rem">Abra o Google Authenticator e use o código que aparece em <strong>Endeavor Business Solutions</strong>. Perdeu o celular? Peça para resetar a verificação da conta no Supabase (Authentication → Users).</p>' +
        '<form class="portal-form" id="f-mfa"><div class="field"><label for="mfa-code">Código</label><input id="mfa-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
        '<div class="portal-alert" id="mfa-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">Verificar</button></form>');
      $('#mfa-code').focus();
      $('#f-mfa').addEventListener('submit', async function (e) {
        e.preventDefault();
        var r = await sb.auth.mfa.challengeAndVerify({ factorId: verified[0].id, code: $('#mfa-code').value.trim() });
        if (r.error) return msg($('#mfa-msg'), errText(r.error), 'error');
        boot();
      });
      return;
    }
    // remove abandoned, unverified factors, then enroll a new one
    for (var i = 0; i < (f.all || []).length; i++) { if (f.all[i].status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.all[i].id }); }
    var en = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'Endeavor Business Solutions', friendlyName: 'Endeavor Console ' + new Date().toISOString().slice(0, 10) });
    if (en.error) { authShell('<div class="portal-alert portal-alert--error">' + esc(errText(en.error)) + '</div>'); return; }
    authShell('<h1 class="portal-h1">Ative a verificação em duas etapas</h1>' +
      '<p class="portal-muted">Obrigatória para acessar o console.</p>' +
      '<ol class="mfa-steps"><li>Instale no celular o app gratuito <strong>Google Authenticator</strong> (<a href="' + EndeavorInvite.IOS + '" target="_blank" rel="noopener">iPhone</a> · <a href="' + EndeavorInvite.AND + '" target="_blank" rel="noopener">Android</a>). O ícone é um asterisco colorido.</li>' +
      '<li>No app, toque no <strong>+</strong> e escolha <strong>Ler código QR</strong>. Aponte a câmera para o código abaixo.</li>' +
      '<li>Digite o código de 6 dígitos que aparece no app (muda a cada 30 segundos) e clique em <strong>Ativar e entrar</strong>.</li></ol>' +
      '<div class="auth__qr"><img alt="QR code para o aplicativo autenticador" src="' + esc(en.data.totp.qr_code) + '"></div>' +
      '<p class="portal-muted">Sem câmera? Digite esta chave no app: <span class="mono">' + esc(en.data.totp.secret) + '</span></p>' +
      '<form class="portal-form" id="f-enroll"><div class="field"><label for="en-code">Código de 6 dígitos</label><input id="en-code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>' +
      '<div class="portal-alert" id="en-msg" role="alert"></div><button class="btn btn--navy btn--block" type="submit">Ativar e entrar</button></form>');
    $('#f-enroll').addEventListener('submit', async function (e) {
      e.preventDefault();
      var r = await sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: $('#en-code').value.trim() });
      if (r.error) return msg($('#en-msg'), errText(r.error), 'error');
      boot();
    });
  }

  /* ---------- console shell ---------- */
  var NAV = [
    ['dashboard', 'Dashboard', 'i-grid'], ['crm', 'CRM', 'i-users'], ['clientes', 'Clientes', 'i-brief'], ['agenda', 'Agenda', 'i-cal'],
    ['assinaturas', 'Assinaturas', 'i-pen'], ['config', 'Configurações', 'i-gear']];

  function startConsole() {
    $('#topbar-user').hidden = false;
    document.body.classList.add('app-shell');
    app.innerHTML = '<div class="console" id="console"><nav class="console__nav" id="console-nav" aria-label="Console"><div class="console__nav-title">Endeavor Console</div><ul>' +
      NAV.map(function (n) { return '<li><a href="#/' + n[0] + '" data-view="' + n[0] + '"><svg class="icon" aria-hidden="true"><use href="#' + n[2] + '"/></svg>' + n[1] + '</a></li>'; }).join('') +
      '</ul><div class="console__nav-foot">Endeavor Business Solutions<br>Acesso restrito</div></nav><div class="nav-backdrop" id="nav-backdrop"></div><main class="console__content" id="view" tabindex="-1"></main></div>' +
      '<div class="overlay" id="overlay" hidden></div>';
    var tgl = $('#nav-toggle'), con = $('#console');
    tgl.hidden = false;
    function setNav(open) { con.classList.toggle('nav-open', open); tgl.setAttribute('aria-expanded', String(open)); tgl.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); }
    tgl.onclick = function () { setNav(!con.classList.contains('nav-open')); if (con.classList.contains('nav-open')) { var a = $('.console__nav a'); if (a) a.focus(); } };
    $('#nav-backdrop').onclick = function () { setNav(false); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && con.classList.contains('nav-open')) { setNav(false); tgl.focus(); } });
    window.addEventListener('hashchange', function () { setNav(false); route(); });
    loadSettings().then(route);
  }
  async function loadSettings() { var r = await sb.from('booking_settings').select('*').eq('id', 1).single(); if (!r.error) state.settings = r.data; }

  function route() {
    var v = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    if (!NAV.some(function (n) { return n[0] === v; })) v = 'dashboard';
    $$('.console__nav a').forEach(function (a) { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var view = $('#view'); view.innerHTML = '<p class="portal-muted">Carregando…</p>'; view.scrollTop = 0;
    ({ dashboard: viewDashboard, crm: viewCrm, clientes: viewClients, agenda: viewAgenda, assinaturas: viewEnvelopes, config: viewConfig })[v](view).catch(function (e) {
      view.innerHTML = '<div class="portal-alert portal-alert--error">' + esc(errText(e)) + '</div>';
    });
  }
  async function q(promise) { var r = await promise; if (r.error) throw r.error; return r.data; }

  /* ---------- overlay ---------- */
  function openOverlay(html, center) {
    var o = $('#overlay');
    o.className = 'overlay' + (center ? ' overlay--center' : '');
    o.innerHTML = '<div class="' + (center ? 'modal' : 'drawer') + '" role="dialog" aria-modal="true">' + html + '</div>';
    o.hidden = false;
    var first = o.querySelector('input,select,textarea,button'); if (first) first.focus();
    o.onclick = function (e) { if (e.target === o) closeOverlay(); };
    $$('.close-x', o).forEach(function (b) { b.onclick = closeOverlay; });
    document.onkeydown = function (e) { if (e.key === 'Escape') closeOverlay(); };
    return o;
  }
  function closeOverlay() { var o = $('#overlay'); o.hidden = true; o.innerHTML = ''; document.onkeydown = null; }

  /* ---------- dashboard ---------- */
  async function viewDashboard(view) {
    var now = new Date(), week = new Date(now - 7 * 864e5).toISOString(), month = new Date(now - 30 * 864e5).toISOString();
    var res = await Promise.all([
      q(sb.from('leads').select('id,name,email,assistance,source,status,created_at').order('created_at', { ascending: false }).limit(6)),
      q(sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', week)).catch(function () { return null; }),
      q(sb.from('bookings').select('*').eq('status', 'confirmed').gte('starts_at', now.toISOString()).order('starts_at').limit(6)),
      q(sb.from('envelopes').select('id,status,title,signer_name,signed_at,created_at').order('created_at', { ascending: false }).limit(50))
    ]);
    var newLeads = (await sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', week)).count || 0;
    var upcoming = (await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('starts_at', now.toISOString())).count || 0;
    var envs = res[3];
    var pending = envs.filter(function (e) { return e.status === 'sent' || e.status === 'viewed'; }).length;
    var signed30 = envs.filter(function (e) { return e.status === 'signed' && e.signed_at >= month; }).length;
    var schedUrl = siteUrl('schedule.html');
    view.innerHTML =
      '<div class="console__head"><div><h1>Dashboard</h1><p class="portal-muted">' + esc(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(now)) + '</p></div></div>' +
      '<div class="dash"><div>' +
        '<div class="kpis">' +
          kpi('Novos leads (7 dias)', newLeads) + kpi('Próximos agendamentos', upcoming) + kpi('Assinaturas pendentes', pending) + kpi('Assinados (30 dias)', signed30) +
        '</div>' +
        '<section class="portal-card" style="margin-top:1.5rem"><h2 class="portal-h2">Próximos agendamentos</h2>' +
          (res[2].length ? '<ul class="list">' + res[2].map(function (b) {
            return '<li><div class="list__main"><strong>' + esc(fmtDT(b.starts_at)) + ' · ' + esc(b.name) + '</strong><span>' + esc(b.topic || '') + ' · ' + esc(MEET_PT[b.meeting_type] || '') + ' · ' + esc(b.email) + '</span></div>' + badge(b.status) + '</li>';
          }).join('') + '</ul>' : '<p class="empty">Nenhum agendamento futuro.</p>') +
          '<a class="btn btn--ghost btn--xs" href="#/agenda">Abrir agenda</a></section>' +
        '<section class="portal-card"><h2 class="portal-h2">Leads recentes</h2>' +
          (res[0].length ? '<ul class="list">' + res[0].map(function (l) {
            return '<li><div class="list__main"><strong>' + esc(l.name) + '</strong><span>' + esc(l.email) + ' · ' + esc(l.assistance || '') + ' · ' + esc(SOURCE_PT[l.source]) + ' · ' + esc(fmtDT(l.created_at)) + '</span></div>' + badge(l.status) + '</li>';
          }).join('') + '</ul>' : '<p class="empty">Nenhum lead ainda.</p>') +
          '<a class="btn btn--ghost btn--xs" href="#/crm">Abrir CRM</a></section>' +
      '</div>' +
      '<aside class="links-panel portal-card" aria-label="Links rápidos"><h2 class="portal-h2">Links rápidos</h2><ul>' +
        '<li><a href="#/assinaturas?novo=1"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>Enviar documento para assinatura</a></li>' +
        '<li><a href="#/crm?novo=1"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>Adicionar lead</a></li>' +
        '<li><a href="#/clientes?novo=1"><svg class="icon" aria-hidden="true"><use href="#i-brief"/></svg>Novo cliente no portal</a></li>' +
        '<li><button type="button" id="ql-copy"><svg class="icon" aria-hidden="true"><use href="#i-link"/></svg>Copiar link de agendamento</button></li>' +
        '<li><a href="schedule.html" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-cal"/></svg>Página pública de agendamento</a></li>' +
        '<li><a href="#/agenda?tab=disp"><svg class="icon" aria-hidden="true"><use href="#i-gear"/></svg>Definir dias e horários</a></li>' +
        '<li><button type="button" id="ql-csv"><svg class="icon" aria-hidden="true"><use href="#i-down"/></svg>Exportar CRM (CSV)</button></li>' +
        '<li><a href="index.html" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-globe"/></svg>Ver o site</a></li>' +
        '<li><a href="https://supabase.com/dashboard/project/onaewjlozioderwlvgfm" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-db"/></svg>Banco de dados (Supabase)</a></li>' +
      '</ul></aside></div>';
    $('#ql-copy').addEventListener('click', function (e) { copy(schedUrl, e.currentTarget); });
    $('#ql-csv').addEventListener('click', exportCsv);
  }
  function kpi(label, value) { return '<div class="kpi"><div class="kpi__label">' + esc(label) + '</div><div class="kpi__value">' + esc(value) + '</div></div>'; }

  async function exportCsv() {
    var rows = await q(sb.from('leads').select('*').order('created_at', { ascending: false }).limit(5000));
    var cols = ['created_at', 'name', 'email', 'phone', 'country', 'company', 'assistance', 'source', 'status', 'marketing_consent', 'language', 'message', 'notes'];
    var csv = cols.join(',') + '\n' + rows.map(function (r) {
      return cols.map(function (c) { var v = r[c] == null ? '' : String(r[c]); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    download('endeavor-crm-' + new Date().toISOString().slice(0, 10) + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  }

  /* ---------- CRM ---------- */
  async function viewCrm(view) {
    state.leads = await q(sb.from('leads').select('*').order('created_at', { ascending: false }).limit(1000));
    view.innerHTML = '<div class="console__head"><div><h1>CRM</h1><p class="portal-muted">Contatos do formulário do site, dos agendamentos e cadastros manuais.</p></div>' +
      '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="crm-csv">Exportar CSV</button><button class="btn btn--navy btn--xs" type="button" id="crm-new">Novo lead</button></div></div>' +
      '<div class="toolbar"><input type="search" id="crm-q" placeholder="Buscar nome, e-mail, empresa…" aria-label="Buscar leads">' +
      '<select id="crm-status" aria-label="Filtrar por status"><option value="">Todos os status</option>' + Object.keys(STATUS_PT).slice(0, 6).map(function (k) { return '<option value="' + k + '">' + STATUS_PT[k] + '</option>'; }).join('') + '</select>' +
      '<select id="crm-source" aria-label="Filtrar por origem"><option value="">Todas as origens</option><option value="contact_form">Formulário</option><option value="booking">Agendamento</option><option value="manual">Manual</option></select></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Data</th><th>Nome</th><th>Contato</th><th>Assistência</th><th>Origem</th><th>Status</th></tr></thead><tbody id="crm-body"></tbody></table></div>';
    function draw() {
      var term = $('#crm-q').value.trim().toLowerCase(), st = $('#crm-status').value, so = $('#crm-source').value;
      var rows = state.leads.filter(function (l) {
        return (!st || l.status === st) && (!so || l.source === so) &&
          (!term || [l.name, l.email, l.company, l.phone, l.country].join(' ').toLowerCase().indexOf(term) > -1);
      });
      $('#crm-body').innerHTML = rows.length ? rows.map(function (l) {
        return '<tr data-id="' + esc(l.id) + '" tabindex="0"><td>' + esc(fmtDT(l.created_at, { timeStyle: undefined })) + '</td><td><strong>' + esc(l.name) + '</strong><span class="sub">' + esc(l.company || '') + '</span></td>' +
          '<td>' + esc(l.email) + '<span class="sub">' + esc(l.phone || '') + ' ' + esc(l.country || '') + '</span></td><td>' + esc(l.assistance || '') + '</td><td>' + esc(SOURCE_PT[l.source]) + '</td><td>' + badge(l.status) + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">Nenhum lead encontrado.</td></tr>';
      $$('#crm-body tr[data-id]').forEach(function (tr) {
        tr.onclick = function () { openLead(tr.dataset.id); };
        tr.onkeydown = function (e) { if (e.key === 'Enter') openLead(tr.dataset.id); };
      });
    }
    ['#crm-q', '#crm-status', '#crm-source'].forEach(function (s) { $(s).addEventListener('input', draw); });
    $('#crm-csv').addEventListener('click', exportCsv);
    $('#crm-new').addEventListener('click', function () { openLead(null); });
    draw();
    if (/novo=1/.test(location.hash)) openLead(null);
  }

  async function openLead(id) {
    var l = id ? state.leads.find(function (x) { return x.id === id; }) : { status: 'new', source: 'manual' };
    var related = id ? await Promise.all([
      q(sb.from('bookings').select('*').eq('lead_id', id).order('starts_at', { ascending: false })),
      q(sb.from('envelopes').select('id,title,status,created_at').eq('lead_id', id).order('created_at', { ascending: false }))
    ]) : [[], []];
    var o = openOverlay('<div class="drawer__head"><div><h2 class="portal-h2" style="margin:0">' + (id ? esc(l.name) : 'Novo lead') + '</h2>' +
      (id ? '<p class="portal-muted">' + esc(SOURCE_PT[l.source]) + ' · ' + esc(fmtDT(l.created_at)) + (l.marketing_consent ? ' · Aceitou marketing' : '') + '</p>' : '') + '</div><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="lead-form">' +
      '<div class="portal-grid2">' +
        fld('ld-name', 'Nome', l.name, 'text', true) + fld('ld-email', 'E-mail', l.email, 'email', true) +
        fld('ld-phone', 'Telefone', l.phone, 'tel') + fld('ld-country', 'País', l.country) +
        fld('ld-company', 'Empresa', l.company) + fld('ld-assist', 'Assistência', l.assistance) +
      '</div>' +
      '<div class="field"><label for="ld-status">Status</label><select id="ld-status">' + Object.keys(STATUS_PT).slice(0, 6).map(function (k) { return '<option value="' + k + '"' + (l.status === k ? ' selected' : '') + '>' + STATUS_PT[k] + '</option>'; }).join('') + '</select></div>' +
      (id && l.message ? '<div class="field"><span class="portal-muted">Mensagem enviada</span><p style="white-space:pre-wrap;margin:0">' + esc(l.message) + '</p></div>' : '') +
      '<div class="field"><label for="ld-notes">Notas internas</label><textarea id="ld-notes" rows="5">' + esc(l.notes || '') + '</textarea></div>' +
      '<div class="portal-alert" id="ld-msg" role="alert"></div>' +
      '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar</button>' +
      (id ? '<a class="btn btn--ghost" href="mailto:' + esc(l.email) + '">Enviar e-mail</a><a class="btn btn--ghost" href="#/assinaturas?novo=1&lead=' + esc(id) + '">Enviar documento</a>' : '') + '</div></form>' +
      (id ? '<h3 style="margin-top:1.5rem">Agendamentos</h3>' + (related[0].length ? '<ul class="list">' + related[0].map(function (b) { return '<li><div class="list__main"><strong>' + esc(fmtDT(b.starts_at)) + '</strong><span>' + esc(b.topic || '') + '</span></div>' + badge(b.status) + '</li>'; }).join('') + '</ul>' : '<p class="empty">Nenhum.</p>') +
        '<h3>Documentos</h3>' + (related[1].length ? '<ul class="list">' + related[1].map(function (e) { return '<li><div class="list__main"><strong>' + esc(e.title) + '</strong><span>' + esc(fmtDT(e.created_at)) + '</span></div>' + badge(e.status) + '</li>'; }).join('') + '</ul>' : '<p class="empty">Nenhum.</p>') : ''));
    $('#lead-form', o).addEventListener('submit', async function (e) {
      e.preventDefault();
      var row = { name: $('#ld-name').value.trim(), email: $('#ld-email').value.trim().toLowerCase(), phone: $('#ld-phone').value.trim() || null,
        country: $('#ld-country').value.trim() || null, company: $('#ld-company').value.trim() || null, assistance: $('#ld-assist').value.trim() || null,
        status: $('#ld-status').value, notes: $('#ld-notes').value };
      if (row.name.length < 2 || row.email.indexOf('@') < 1) return msg($('#ld-msg'), 'Preencha nome e e-mail.', 'error');
      var r = id ? await sb.from('leads').update(row).eq('id', id) : await sb.from('leads').insert(Object.assign(row, { source: 'manual' }));
      if (r.error) return msg($('#ld-msg'), errText(r.error), 'error');
      closeOverlay(); if (/novo=1/.test(location.hash)) location.hash = '#/crm'; else route();
    });
  }
  function fld(id, label, val, type, req) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + (req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label><input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '"' + (req ? ' required' : '') + '></div>';
  }

  /* ---------- Agenda ---------- */
  async function viewAgenda(view) {
    var tab = /tab=disp/.test(location.hash) ? 'disp' : 'prox';
    view.innerHTML = '<div class="console__head"><div><h1>Agenda</h1><p class="portal-muted">Horários no fuso ' + esc(tz()) + '.</p></div>' +
      '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="ag-copy">Copiar link público</button><a class="btn btn--ghost btn--xs" href="schedule.html" target="_blank" rel="noopener">Abrir página</a></div></div>' +
      '<div class="tabs" role="tablist"><button role="tab" type="button" data-tab="prox" aria-selected="' + (tab === 'prox') + '">Próximos</button><button role="tab" type="button" data-tab="hist" aria-selected="false">Histórico</button><button role="tab" type="button" data-tab="disp" aria-selected="' + (tab === 'disp') + '">Disponibilidade</button></div>' +
      '<div id="ag-body"></div>';
    $('#ag-copy').addEventListener('click', function (e) { copy(siteUrl('schedule.html'), e.currentTarget); });
    $$('.tabs button', view).forEach(function (b) { b.onclick = function () { $$('.tabs button', view).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); drawTab(b.dataset.tab); }; });
    drawTab(tab);
  }
  async function drawTab(tab) {
    var body = $('#ag-body'); body.innerHTML = '<p class="portal-muted">Carregando…</p>';
    if (tab === 'disp') return drawAvailability(body);
    var nowIso = new Date().toISOString();
    var query = sb.from('bookings').select('*');
    query = tab === 'prox' ? query.gte('ends_at', nowIso).order('starts_at') : query.lt('ends_at', nowIso).order('starts_at', { ascending: false }).limit(200);
    var rows = await q(query);
    if (!rows.length) { body.innerHTML = '<p class="empty">Nenhum agendamento.</p>'; return; }
    var html = '', lastDay = '';
    rows.forEach(function (b) {
      var d = fmtDay(b.starts_at);
      if (d !== lastDay) { html += (lastDay ? '</ul></section>' : '') + '<section class="portal-card"><h2 class="portal-h2">' + esc(d.charAt(0).toUpperCase() + d.slice(1)) + '</h2><ul class="list">'; lastDay = d; }
      html += '<li><div class="list__main"><strong>' + esc(fmtDT(b.starts_at, { dateStyle: undefined })) + ' – ' + esc(fmtDT(b.ends_at, { dateStyle: undefined })) + ' · ' + esc(b.name) + '</strong>' +
        '<span>' + esc(MEET_PT[b.meeting_type]) + ' · ' + esc(b.email) + (b.phone ? ' · ' + esc(b.phone) : '') + ' · ' + esc(b.topic || '') + (b.language ? ' · ' + esc(b.language) : '') + '</span>' +
        (b.notes ? '<span>“' + esc(b.notes) + '”</span>' : '') + '</div><div class="portal-btn-row">' + badge(b.status) +
        (b.status === 'confirmed' ? '<button class="btn btn--ghost btn--xs" data-act="completed" data-id="' + esc(b.id) + '">Concluir</button><button class="btn btn--ghost btn--xs" data-act="no_show" data-id="' + esc(b.id) + '">Não veio</button><button class="btn btn--danger btn--xs" data-act="cancelled" data-id="' + esc(b.id) + '">Cancelar</button>' : '') +
        '<a class="btn btn--ghost btn--xs" href="mailto:' + esc(b.email) + '">E-mail</a></div></li>';
    });
    body.innerHTML = html + '</ul></section>';
    $$('button[data-act]', body).forEach(function (btn) {
      btn.onclick = async function () {
        if (btn.dataset.act === 'cancelled' && !confirm('Cancelar este agendamento? O horário volta a ficar disponível. Avise o cliente por e-mail.')) return;
        var r = await sb.from('bookings').update({ status: btn.dataset.act }).eq('id', btn.dataset.id);
        if (r.error) return alert(errText(r.error));
        drawTab(tab);
      };
    });
  }

  var DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  async function drawAvailability(body) {
    var res = await Promise.all([q(sb.from('availability_rules').select('*').order('weekday').order('start_time')), q(sb.from('blackout_dates').select('*').order('day')), q(sb.from('booking_settings').select('*').eq('id', 1).single())]);
    var rules = res[0], blk = res[1], s = res[2];
    var zones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'America/Asuncion'];
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Horários semanais</h2><p class="portal-muted">Defina os intervalos em que clientes podem agendar.</p><div class="week" id="week">' +
      DAYS.map(function (d, i) {
        var mine = rules.filter(function (r) { return r.weekday === i; });
        return '<div class="week__day" data-day="' + i + '"><strong>' + d + '</strong><div class="week__slots">' + mine.map(slotRow).join('') +
          '<button class="btn btn--ghost btn--xs add-slot" type="button" style="align-self:flex-start">+ Intervalo</button></div></div>';
      }).join('') + '</div></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Regras</h2><div class="portal-grid2">' +
        '<div class="field"><label for="st-tz">Fuso horário</label><select id="st-tz">' + zones.map(function (z) { return '<option' + (z === s.timezone ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="st-slot">Duração da chamada (min)</label><input id="st-slot" type="number" min="15" max="240" step="5" value="' + s.slot_minutes + '"></div>' +
        '<div class="field"><label for="st-buf">Intervalo entre chamadas (min)</label><input id="st-buf" type="number" min="0" max="120" step="5" value="' + s.buffer_minutes + '"></div>' +
        '<div class="field"><label for="st-notice">Antecedência mínima (horas)</label><input id="st-notice" type="number" min="0" max="720" value="' + s.min_notice_hours + '"></div>' +
        '<div class="field"><label for="st-max">Agendar até (dias à frente)</label><input id="st-max" type="number" min="1" max="180" value="' + s.max_days_ahead + '"></div>' +
      '</div><div class="field" style="margin-top:1rem"><label for="st-note">Mensagem mostrada na confirmação</label><textarea id="st-note" rows="2">' + esc(s.meeting_note || '') + '</textarea></div></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Datas bloqueadas</h2><p class="portal-muted">Feriados, viagens ou dias sem atendimento.</p><ul class="list" id="blk-list">' +
        blk.map(function (b) { return '<li><div class="list__main"><strong>' + esc(b.day) + '</strong><span>' + esc(b.reason || '') + '</span></div><button class="btn btn--danger btn--xs" data-del-day="' + esc(b.day) + '">Remover</button></li>'; }).join('') +
      '</ul><div class="portal-btn-row" style="margin-top:.75rem"><input type="date" id="blk-day" aria-label="Data bloqueada" class="toolbar-like"><input type="text" id="blk-reason" placeholder="Motivo (opcional)" aria-label="Motivo"><button class="btn btn--ghost btn--xs" type="button" id="blk-add">Bloquear data</button></div></section>' +
      '<div class="portal-alert" id="av-msg" role="status"></div><button class="btn btn--navy" type="button" id="av-save">Salvar disponibilidade</button>';
    $$('#blk-day, #blk-reason', body).forEach(function (i) { i.style.cssText = 'min-height:2.5rem;padding:.3rem .6rem;border:1.5px solid #8a95a8;border-radius:6px'; });
    function wireRows() {
      $$('.add-slot', body).forEach(function (b) { b.onclick = function () { b.insertAdjacentHTML('beforebegin', slotRow({ start_time: '09:00', end_time: '12:00' })); wireRows(); }; });
      $$('.rm-slot', body).forEach(function (b) { b.onclick = function () { b.closest('.week__slot').remove(); }; });
    }
    wireRows();
    $('#blk-add').onclick = async function () {
      var d = $('#blk-day').value; if (!d) return;
      var r = await sb.from('blackout_dates').upsert({ day: d, reason: $('#blk-reason').value.trim() || null });
      if (r.error) return msg($('#av-msg'), errText(r.error), 'error');
      drawAvailability(body);
    };
    $$('[data-del-day]', body).forEach(function (b) { b.onclick = async function () { await sb.from('blackout_dates').delete().eq('day', b.dataset.delDay); drawAvailability(body); }; });
    $('#av-save').onclick = async function () {
      var out = [], bad = false;
      $$('.week__day', body).forEach(function (d) {
        $$('.week__slot', d).forEach(function (r) {
          var a = $('input[data-k=start]', r).value, z = $('input[data-k=end]', r).value;
          if (!a || !z || z <= a) bad = true; else out.push({ weekday: +d.dataset.day, start_time: a, end_time: z });
        });
      });
      if (bad) return msg($('#av-msg'), 'Confira os intervalos: o horário final precisa ser depois do inicial.', 'error');
      var settings = { timezone: $('#st-tz').value, slot_minutes: +$('#st-slot').value, buffer_minutes: +$('#st-buf').value, min_notice_hours: +$('#st-notice').value, max_days_ahead: +$('#st-max').value, meeting_note: $('#st-note').value.trim() };
      var r1 = await sb.from('booking_settings').update(settings).eq('id', 1); if (r1.error) return msg($('#av-msg'), errText(r1.error), 'error');
      var r2 = await sb.from('availability_rules').delete().gte('weekday', 0); if (r2.error) return msg($('#av-msg'), errText(r2.error), 'error');
      if (out.length) { var r3 = await sb.from('availability_rules').insert(out); if (r3.error) return msg($('#av-msg'), errText(r3.error), 'error'); }
      state.settings = Object.assign(state.settings || {}, settings);
      msg($('#av-msg'), 'Disponibilidade salva. A página pública já mostra os novos horários.', 'ok');
    };
  }
  function slotRow(r) {
    return '<div class="week__slot"><input type="time" data-k="start" value="' + esc(String(r.start_time).slice(0, 5)) + '" aria-label="Início"> até <input type="time" data-k="end" value="' + esc(String(r.end_time).slice(0, 5)) + '" aria-label="Fim"><button class="btn btn--danger btn--xs rm-slot" type="button" aria-label="Remover intervalo">Remover</button></div>';
  }

  /* ---------- E-signature ---------- */
  async function viewEnvelopes(view) {
    if (/novo=1/.test(location.hash)) return viewEditor(view);
    state.envelopes = await q(sb.from('envelopes').select('*').order('created_at', { ascending: false }).limit(500));
    view.innerHTML = '<div class="console__head"><div><h1>Assinaturas</h1><p class="portal-muted">Prepare documentos, posicione os campos de assinatura e acompanhe tudo por aqui.</p></div>' +
      '<a class="btn btn--navy btn--xs" href="#/assinaturas?novo=1" id="env-new">Novo documento</a></div>' +
      '<div class="toolbar"><input type="search" id="env-q" placeholder="Buscar título ou signatário…" aria-label="Buscar documentos"><select id="env-st" aria-label="Filtrar por status"><option value="">Todos</option><option value="sent">Enviado</option><option value="viewed">Visualizado</option><option value="signed">Assinado</option><option value="voided">Anulado</option><option value="expired">Expirado</option></select></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Documento</th><th>Signatário</th><th>Status</th><th>Enviado</th><th>Assinado</th></tr></thead><tbody id="env-body"></tbody></table></div>';
    function draw() {
      var t = $('#env-q').value.trim().toLowerCase(), st = $('#env-st').value;
      var rows = state.envelopes.filter(function (e) { return (!st || e.status === st) && (!t || (e.title + ' ' + e.signer_name + ' ' + e.signer_email).toLowerCase().indexOf(t) > -1); });
      $('#env-body').innerHTML = rows.length ? rows.map(function (e) {
        return '<tr data-id="' + esc(e.id) + '" tabindex="0"><td><strong>' + esc(e.title) + '</strong></td><td>' + esc(e.signer_name) + '<span class="sub">' + esc(e.signer_email) + '</span></td><td>' + badge(e.status) + '</td><td>' + esc(fmtDT(e.created_at)) + '</td><td>' + esc(fmtDT(e.signed_at)) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="empty">Nenhum documento.</td></tr>';
      $$('#env-body tr[data-id]').forEach(function (tr) { tr.onclick = function () { openEnvelope(tr.dataset.id); }; tr.onkeydown = function (ev) { if (ev.key === 'Enter') openEnvelope(tr.dataset.id); }; });
    }
    $('#env-q').addEventListener('input', draw); $('#env-st').addEventListener('input', draw);
    draw();
  }

  function signLink(e) { return siteUrl('sign.html') + '?t=' + encodeURIComponent(e.token); }

  /* Emails the signing link through the account's FormSubmit form: the signer receives the auto-response with the link,
     and support@endeavorbiz.com receives the notification copy. */
  async function emailSigner(e) {
    var link = signLink(e), exp = new Date(e.token_expires_at).toLocaleDateString('pt-BR');
    var text = 'Olá ' + e.signer_name + ', a Endeavor Business Solutions enviou o documento "' + e.title + '" para sua assinatura eletrônica. ' +
      (e.message ? e.message + ' ' : '') + 'Abra o link para revisar e assinar: ' + link + ' (link pessoal, válido até ' + exp + '). ' +
      '— Hello ' + e.signer_name + ', Endeavor Business Solutions sent you "' + e.title + '" for electronic signature. Review and sign here: ' + link + ' — ' +
      'Hola ' + e.signer_name + ', Endeavor Business Solutions le envió "' + e.title + '" para firma electrónica. Revise y firme aquí: ' + link +
      ' — Endeavor Business Solutions · ' + CFG.adminEmail + ' · +1 (407) 436-9567';
    try {
      var r = await fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'Documento enviado para assinatura: ' + e.title + ' → ' + e.signer_name, _template: 'table', _captcha: 'false',
          name: e.signer_name, email: e.signer_email, documento: e.title, link_de_assinatura: link, expira_em: exp, mensagem: e.message || '', _autoresponse: text }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || String(j.success) === 'false') throw new Error(j.message || 'send failed');
      await sb.from('envelope_events').insert({ envelope_id: e.id, event: 'emailed', details: { to: e.signer_email, cc: CFG.adminEmail } });
      return true;
    } catch (err) { console.warn(err); return false; }
  }

  async function viewEditor(view) {
    var leads = await q(sb.from('leads').select('id,name,email').order('created_at', { ascending: false }).limit(500));
    var pre = (location.hash.match(/lead=([0-9a-f-]{36})/) || [])[1];
    view.innerHTML = '<p class="portal-muted">Carregando editor…</p>';
    if (!window.EPdf || !window.pdfjsLib || !window.PDFLib || !window.EndeavorEditor) {
      view.innerHTML = '<div class="portal-alert portal-alert--error">Não foi possível carregar o editor de PDF. Verifique a conexão e recarregue a página.</div>'; return;
    }
    EndeavorEditor.mount(view, {
      sb: sb, CFG: CFG, esc: esc, msg: msg, errText: errText, sha256Hex: sha256Hex, leads: leads, preLeadId: pre,
      preLead: leads.find(function (l) { return l.id === pre; }), emailSigner: emailSigner,
      onCancel: function () { location.hash = '#/assinaturas'; },
      onDone: function (e, mailed) {
        history.replaceState(null, '', '#/assinaturas');
        view.innerHTML = '<div class="console__head"><h1>Documento enviado</h1></div><section class="portal-card esx-done">' +
          '<p class="portal-alert portal-alert--ok">' + (mailed ? 'O link de assinatura foi enviado para <strong>' + esc(e.signer_email) + '</strong> e uma cópia foi para ' + esc(CFG.adminEmail) + '.' : 'Documento criado. Copie o link abaixo e envie ao signatário.') + '</p>' +
          '<dl class="kv"><dt>Documento</dt><dd>' + esc(e.title) + '</dd><dt>Signatário</dt><dd>' + esc(e.signer_name) + ' · ' + esc(e.signer_email) + '</dd><dt>Campos</dt><dd>' + (e.fields || []).length + '</dd><dt>Expira</dt><dd>' + esc(fmtDT(e.token_expires_at)) + '</dd></dl>' +
          '<div class="field"><label for="ev-link">Link de assinatura</label><input id="ev-link" readonly value="' + esc(signLink(e)) + '"></div>' +
          '<div class="portal-btn-row"><button class="btn btn--navy" type="button" id="ev-copy">Copiar link</button>' +
          (mailed ? '' : '<button class="btn btn--ghost" type="button" id="ev-mail">Enviar por e-mail</button>') +
          '<button class="btn btn--ghost" type="button" id="ev-view">Ver documento</button><a class="btn btn--ghost" href="#/assinaturas?novo=1">Novo documento</a><a class="btn btn--ghost" href="#/assinaturas">Ver lista</a></div>' +
          '<div class="portal-alert" id="ev-out" role="status"></div></section>';
        $('#ev-copy').onclick = function (b) { copy(signLink(e), b.currentTarget); sb.from('envelope_events').insert({ envelope_id: e.id, event: 'link_copied' }).then(function () {}); };
        $('#ev-view').onclick = function () { viewPdf(e.document_path, e.title, e); };
        if ($('#ev-mail')) $('#ev-mail').onclick = async function (b) { var ok = await emailSigner(e); msg($('#ev-out'), ok ? 'E-mail enviado.' : 'Não foi possível enviar o e-mail agora. Copie o link e envie manualmente.', ok ? 'ok' : 'error'); };
      }
    });
  }

  function clientsCtx() {
    return { sb: sb, CFG: CFG, esc: esc, q: q, msg: msg, errText: errText, fmtDT: fmtDT, openOverlay: openOverlay, closeOverlay: closeOverlay,
      copy: copy, download: download, viewFile: viewFile, sha256Hex: sha256Hex, siteUrl: siteUrl, route: route };
  }
  async function viewClients(view) {
    if (!window.AdminClients) { view.innerHTML = '<div class="portal-alert portal-alert--error">Módulo de clientes não carregou. Recarregue a página.</div>'; return; }
    var id = (location.hash.match(/[?&]id=([0-9a-f-]{36})/) || [])[1];
    return id ? AdminClients.detail(view, clientsCtx(), id) : AdminClients.list(view, clientsCtx());
  }

  /* Generic in-console file viewer for any private bucket: PDFs and images render inline, other types download. */
  async function viewFile(bucket, path, title, opts) {
    opts = opts || {};
    var isImg = /\.(png|jpe?g|webp|gif)$/i.test(path), isPdf = /\.pdf$/i.test(path) || opts.mime === 'application/pdf';
    var o = openOverlay('<div class="viewer"><div class="viewer__bar"><strong>' + esc(title) + '</strong><div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="vw-print"' + (isPdf ? '' : ' hidden') + '>Imprimir</button><button class="btn btn--ghost btn--xs" type="button" id="vw-dl">Baixar</button><button class="close-x" type="button" aria-label="Fechar">×</button></div></div>' +
      '<div class="viewer__pages" id="vw-pages"><p class="portal-muted">Carregando…</p></div></div>', true);
    o.querySelector('.modal').classList.add('modal--wide');
    var r = await sb.storage.from(bucket).createSignedUrl(path, 600);
    if (r.error) { $('#vw-pages').innerHTML = '<div class="portal-alert portal-alert--error">' + esc(errText(r.error)) + '</div>'; return; }
    var blob = null;
    try {
      blob = await (await fetch(r.data.signedUrl)).blob();
      if (isPdf) { var doc = await EPdf.open(new Uint8Array(await blob.arrayBuffer())); await EPdf.render(doc, $('#vw-pages'), { maxWidth: 900, pageLabel: 'Página' }); }
      else if (isImg) { $('#vw-pages').innerHTML = '<img alt="' + esc(title) + '" style="max-width:100%;display:block;margin:0 auto;background:#fff" src="' + URL.createObjectURL(blob) + '">'; }
      else $('#vw-pages').innerHTML = '<div class="empty-state"><strong>Pré-visualização indisponível para este tipo de arquivo.</strong>Use o botão Baixar.</div>';
    } catch (err) { $('#vw-pages').innerHTML = '<div class="portal-alert portal-alert--error">Não foi possível exibir o arquivo.</div>'; }
    var name = (title.replace(/[\\/:*?"<>|]+/g, '-') + (path.match(/\.[a-z0-9]+$/i) || [''])[0]);
    $('#vw-dl').onclick = function () { if (blob) download(name, blob); if (opts.onDownload) opts.onDownload(); };
    $('#vw-print').onclick = function () {
      if (!blob) return;
      var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
      f.src = URL.createObjectURL(blob); document.body.appendChild(f);
      f.onload = function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { download(name, blob); } setTimeout(function () { f.remove(); }, 60000); };
    };
  }

  /* In-console PDF viewer with download (no new tabs). */
  async function viewPdf(path, title, e) {
    var o = openOverlay('<div class="viewer"><div class="viewer__bar"><strong>' + esc(title) + '</strong><div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" id="vw-dl">Baixar PDF</button><button class="close-x" type="button" aria-label="Fechar">×</button></div></div>' +
      '<div class="viewer__pages" id="vw-pages"><p class="portal-muted">Carregando documento…</p></div></div>', true);
    o.querySelector('.modal').classList.add('modal--wide');
    var r = await sb.storage.from('documents').createSignedUrl(path, 600);
    if (r.error) { $('#vw-pages').innerHTML = '<div class="portal-alert portal-alert--error">' + esc(errText(r.error)) + '</div>'; return; }
    var bytes;
    try {
      bytes = new Uint8Array(await (await fetch(r.data.signedUrl)).arrayBuffer());
      var doc = await EPdf.open(bytes);
      await EPdf.render(doc, $('#vw-pages'), { maxWidth: 900, pageLabel: 'Página' });
    } catch (err) { $('#vw-pages').innerHTML = '<div class="portal-alert portal-alert--error">Não foi possível exibir o PDF.</div>'; }
    $('#vw-dl').onclick = function () {
      if (!bytes) return;
      download(title.replace(/[\\/:*?"<>|]+/g, '-') + '.pdf', new Blob([bytes], { type: 'application/pdf' }));
      if (e) sb.from('envelope_events').insert({ envelope_id: e.id, event: 'downloaded', details: { file: path.split('/')[0] } }).then(function () {});
    };
  }

  async function openEnvelope(id) {
    var e = await q(sb.from('envelopes').select('*').eq('id', id).single());
    var evs = await q(sb.from('envelope_events').select('*').eq('envelope_id', id).order('at'));
    var EV = { created: 'Criado', sent: 'Enviado', emailed: 'E-mail enviado ao signatário', viewed: 'Visualizado', consented: 'Consentiu com registros eletrônicos', signed: 'Assinado', completed: 'Concluído (PDF final gerado)', voided: 'Anulado', downloaded: 'Baixado', link_copied: 'Link copiado' };
    var open = e.status === 'sent' || e.status === 'viewed';
    var o = openOverlay('<div class="drawer__head"><div><h2 class="portal-h2" style="margin:0">' + esc(e.title) + '</h2><p>' + badge(e.status) + '</p></div><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<dl class="kv"><dt>Signatário</dt><dd>' + esc(e.signer_name) + '<br>' + esc(e.signer_email) + '</dd><dt>Criado</dt><dd>' + esc(fmtDT(e.created_at)) + ' por ' + esc(e.created_by || '') + '</dd>' +
      '<dt>Campos</dt><dd>' + ((e.fields || []).length || 'Bloco de assinatura padrão') + '</dd>' +
      '<dt>Expira</dt><dd>' + esc(fmtDT(e.token_expires_at)) + '</dd>' + (e.signed_at ? '<dt>Assinado</dt><dd>' + esc(fmtDT(e.signed_at)) + ' · IP ' + esc(e.signer_ip) + '</dd><dt>Nome adotado</dt><dd>' + esc(e.signature_name) + '</dd>' : '') +
      '<dt>SHA-256 original</dt><dd class="mono">' + esc(e.document_sha256) + '</dd>' + (e.signed_document_sha256 ? '<dt>SHA-256 assinado</dt><dd class="mono">' + esc(e.signed_document_sha256) + '</dd>' : '') + '</dl>' +
      '<div class="portal-btn-row">' +
        (e.signed_document_path ? '<button class="btn btn--navy btn--xs" type="button" id="e-signed">Ver assinado</button>' : '') +
        '<button class="btn btn--ghost btn--xs" type="button" id="e-orig">Ver original</button>' +
        (open ? '<button class="btn btn--ghost btn--xs" type="button" id="e-copy">Copiar link</button><button class="btn btn--ghost btn--xs" type="button" id="e-mail">Reenviar e-mail</button>' : '') +
        '<button class="btn btn--ghost btn--xs" type="button" id="e-audit">Exportar trilha</button>' +
        (open ? '<button class="btn btn--danger btn--xs" type="button" id="e-void">Anular</button>' : '') +
      '</div><div class="portal-alert" id="e-msg" role="status"></div>' +
      '<h3 style="margin-top:1.25rem">Trilha de auditoria</h3><ul class="timeline">' + evs.map(function (x) {
        return '<li><strong>' + esc(EV[x.event] || x.event) + '</strong> · ' + esc(fmtDT(x.at, { timeStyle: 'medium' })) + (x.ip ? '<br><span class="portal-muted">IP ' + esc(x.ip) + ' · ' + esc(String(x.user_agent || '').slice(0, 90)) + '</span>' : '') + '</li>';
      }).join('') + '</ul>');
    if ($('#e-copy', o)) $('#e-copy', o).onclick = function (b) { copy(signLink(e), b.currentTarget); sb.from('envelope_events').insert({ envelope_id: e.id, event: 'link_copied' }).then(function () {}); };
    if ($('#e-mail', o)) $('#e-mail', o).onclick = async function () { var ok = await emailSigner(e); msg($('#e-msg'), ok ? 'E-mail reenviado para ' + e.signer_email + '.' : 'Não foi possível enviar agora. Use "Copiar link".', ok ? 'ok' : 'error'); };
    $('#e-orig', o).onclick = function () { viewPdf(e.document_path, e.title + ' - original', e); };
    if ($('#e-signed', o)) $('#e-signed', o).onclick = function () { viewPdf(e.signed_document_path, e.title + ' - assinado', e); };
    $('#e-audit', o).onclick = function () {
      download('trilha-' + e.id + '.json', JSON.stringify({ envelope: { id: e.id, title: e.title, signer_name: e.signer_name, signer_email: e.signer_email, status: e.status, created_at: e.created_at, signed_at: e.signed_at, signer_ip: e.signer_ip, signer_user_agent: e.signer_user_agent, signature_name: e.signature_name, document_sha256: e.document_sha256, signed_document_sha256: e.signed_document_sha256, fields: e.fields, field_values: e.field_values }, events: evs }, null, 2), 'application/json');
    };
    if ($('#e-void', o)) $('#e-void', o).onclick = async function () {
      if (!confirm('Anular este documento? O link deixa de funcionar.')) return;
      var r = await sb.from('envelopes').update({ status: 'voided' }).eq('id', e.id);
      if (r.error) return msg($('#e-msg'), errText(r.error), 'error');
      await sb.from('envelope_events').insert({ envelope_id: e.id, event: 'voided' });
      closeOverlay(); route();
    };
  }

  /* ---------- Settings ---------- */
  async function viewConfig(view) {
    var u = (await sb.auth.getUser()).data.user;
    var f = (await sb.auth.mfa.listFactors()).data || { totp: [] };
    view.innerHTML = '<div class="console__head"><h1>Configurações</h1></div>' +
      '<section class="portal-card"><h2 class="portal-h2">Conta</h2><dl class="kv"><dt>E-mail</dt><dd>' + esc(u.email) + '</dd><dt>Último acesso</dt><dd>' + esc(fmtDT(u.last_sign_in_at)) + '</dd>' +
      '<dt>Duas etapas</dt><dd>' + ((f.totp || []).filter(function (x) { return x.status === 'verified'; }).length ? 'Ativa (aplicativo autenticador)' : 'Inativa') + '</dd></dl></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Alterar senha</h2><form class="portal-form" id="pw-form"><div class="field"><label for="pw-new">Nova senha (mín. 12 caracteres)</label><input id="pw-new" type="password" autocomplete="new-password" minlength="12" required></div>' +
      '<div class="portal-alert" id="pw-msg" role="status"></div><button class="btn btn--navy" type="submit">Salvar nova senha</button></form></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Segurança</h2><ul class="list"><li><div class="list__main"><strong>Acesso restrito</strong><span>Só o e-mail autorizado, com verificação em duas etapas, consegue ver os dados. As regras ficam no banco de dados.</span></div></li>' +
      '<li><div class="list__main"><strong>Documentos privados</strong><span>Os PDFs ficam em armazenamento privado e só abrem por links temporários.</span></div></li>' +
      '<li><div class="list__main"><strong>Notificações</strong><span>Novos contatos e agendamentos também chegam em ' + esc(CFG.adminEmail) + '.</span></div></li></ul></section>';
    $('#pw-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var p = $('#pw-new').value; if (p.length < 12) return msg($('#pw-msg'), 'Use pelo menos 12 caracteres.', 'error');
      var r = await sb.auth.updateUser({ password: p });
      msg($('#pw-msg'), r.error ? errText(r.error) : 'Senha alterada.', r.error ? 'error' : 'ok');
    });
  }

  boot();
})();
