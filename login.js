/* Login único da Endeavor: um formulário só. Depois da senha, o sistema descobre o tipo da conta (admin, cliente ou parceiro)
   e leva a pessoa para o portal certo, onde segue a verificação em duas etapas. O erro é o mesmo para qualquer e-mail. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG, L = EP.lang;
  var T = EP.init({
    en: { title: 'Sign in', lead: 'One sign-in for every Endeavor account.', email: 'E-mail', password: 'Password', signIn: 'Sign in', forgot: 'Forgot my password', showPass: 'Show password',
      loading: 'Signing in…', bad: 'Incorrect e-mail or password.', limited: 'Too many attempts. Wait a moment and try again.', offline: 'We could not connect. Check your internet and try again.',
      noAccess: 'This account has no active access. Write to support@endeavorbiz.com.', pick: 'Your e-mail has more than one access. Where do you want to go?', pickNew: 'Choose where you want to create your new password.',
      r_admin: 'Endeavor team', r_client: 'Client Portal', r_partner: 'Partner Portal',
      forgotTitle: 'New password', forgotLead: 'Enter your e-mail and we will send a link to create a new password.', sendLink: 'Send the link', backLogin: 'Back to sign in',
      resetSent: 'If {e} has an account, the link to create a new password is on its way. Check your inbox and spam folder.', badEmail: 'Enter a valid e-mail.',
      linkExpired: 'This link has expired or was already used. Ask for a new one below.', help: 'Need access? Write to support@endeavorbiz.com.' },
    pt: { docTitle: 'Entrar | Endeavor Business Hub', title: 'Entrar', lead: 'Um login só para todas as contas da Endeavor.', email: 'E-mail', password: 'Senha', signIn: 'Entrar', forgot: 'Esqueci a senha', showPass: 'Mostrar a senha',
      loading: 'Entrando…', bad: 'E-mail ou senha incorretos.', limited: 'Muitas tentativas. Aguarde um instante e tente de novo.', offline: 'Não conseguimos conectar. Confira a internet e tente de novo.',
      noAccess: 'Esta conta não tem um acesso ativo. Escreva para support@endeavorbiz.com.', pick: 'O seu e-mail tem mais de um acesso. Para onde você quer ir?', pickNew: 'Escolha onde você quer criar a nova senha.',
      r_admin: 'Equipe Endeavor', r_client: 'Portal do Cliente', r_partner: 'Portal do Parceiro',
      forgotTitle: 'Nova senha', forgotLead: 'Digite o seu e-mail e enviamos um link para criar uma nova senha.', sendLink: 'Enviar o link', backLogin: 'Voltar para o login',
      resetSent: 'Se {e} tiver uma conta, o link para criar a nova senha está a caminho. Confira a caixa de entrada e o spam.', badEmail: 'Digite um e-mail válido.',
      linkExpired: 'Este link expirou ou já foi usado. Peça um novo abaixo.', help: 'Precisa de acesso? Escreva para support@endeavorbiz.com.' },
    es: { docTitle: 'Ingresar | Endeavor Business Hub', title: 'Ingresar', lead: 'Un solo ingreso para todas las cuentas de Endeavor.', email: 'Correo', password: 'Contraseña', signIn: 'Ingresar', forgot: 'Olvidé mi contraseña', showPass: 'Mostrar la contraseña',
      loading: 'Ingresando…', bad: 'Correo o contraseña incorrectos.', limited: 'Demasiados intentos. Espere un momento e intente de nuevo.', offline: 'No pudimos conectar. Revise su internet e intente de nuevo.',
      noAccess: 'Esta cuenta no tiene un acceso activo. Escriba a support@endeavorbiz.com.', pick: 'Su correo tiene más de un acceso. ¿A dónde quiere ir?', pickNew: 'Elija dónde quiere crear la nueva contraseña.',
      r_admin: 'Equipo Endeavor', r_client: 'Portal del Cliente', r_partner: 'Portal de Socios',
      forgotTitle: 'Nueva contraseña', forgotLead: 'Escriba su correo y le enviamos un enlace para crear una nueva contraseña.', sendLink: 'Enviar el enlace', backLogin: 'Volver al ingreso',
      resetSent: 'Si {e} tiene una cuenta, el enlace para crear la nueva contraseña está en camino. Revise su bandeja de entrada y el spam.', badEmail: 'Escriba un correo válido.',
      linkExpired: 'Este enlace venció o ya fue usado. Pida uno nuevo abajo.', help: '¿Necesita acceso? Escriba a support@endeavorbiz.com.' }
  });
  var $ = function (s) { return document.querySelector(s); };
  var PAGE = { admin: 'admin.html', client: 'client.html', partner: 'partner.html' };
  // cada portal guarda a sessão num lugar: o admin no padrão do Supabase, cliente e parceiro em "endeavor-client-auth"
  var STORE = { admin: null, client: 'endeavor-client-auth', partner: 'endeavor-client-auth' };
  function msg(el, text, kind) { el.className = 'portal-alert portal-alert--' + (kind || 'info'); el.textContent = text || ''; }
  function show(which) {
    $('#f-login').hidden = which !== 'login'; $('#f-forgot').hidden = which !== 'forgot'; $('#pick').hidden = which !== 'pick';
    $('#lead').hidden = which !== 'login';
    document.querySelector('#card h1').textContent = T(which === 'forgot' ? 'forgotTitle' : 'title');
  }
  function url(route, hash) { return PAGE[route] + '?lang=' + L + (hash || ''); }
  function routesOf(list) { return (Array.isArray(list) ? list : []).filter(function (r) { return PAGE[r]; }); }
  function choose(routes, lead, go) {
    show('pick'); $('#pick-lead').textContent = lead;
    $('#pick-list').innerHTML = '';
    routes.forEach(function (r, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (i ? 'btn--ghost' : 'btn--navy'); b.textContent = T('r_' + r);
      b.onclick = function () { b.disabled = true; go(r); }; $('#pick-list').appendChild(b);
    });
    $('#pick-list').querySelector('button').focus();
  }

  /* ---------- link de convite ou de nova senha que chegou aqui: vai para o portal da conta, com o link junto ---------- */
  var hash = location.hash;
  if (/[#&]error(_code)?=/.test(hash)) { history.replaceState(null, '', location.pathname + location.search); show('forgot'); $('#fg-exp').hidden = false; $('#fg-exp').style.display = 'block'; }
  else if (/[#&]access_token=/.test(hash)) {
    var tok = (hash.match(/[#&]access_token=([^&]+)/) || [])[1];
    $('#f-login').hidden = true; $('#lead').hidden = true;
    fetch(CFG.supabaseUrl + '/rest/v1/rpc/login_route', { method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
      .then(function (list) {
        var rs = routesOf(list);
        if (rs.length === 1) return location.replace(url(rs[0], hash));
        // mais de um acesso (ou não deu para identificar): a pessoa escolhe, e o link segue junto
        choose(rs.length ? rs : ['client', 'partner', 'admin'], T('pickNew'), function (r) { location.href = url(r, hash); });
      });
  }

  /* ---------- entrar ---------- */
  $('#l-eye').onclick = function () { var i = $('#l-pass'), on = i.type === 'password'; i.type = on ? 'text' : 'password'; this.setAttribute('aria-pressed', String(on)); };
  var auth = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'endeavor-login-tmp' } });
  async function enter(route, s) {
    var o = { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }; if (STORE[route]) o.storageKey = STORE[route];
    var c = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: o });
    var r = await c.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
    if (r.error) throw r.error;
    location.href = url(route);
  }
  $('#f-login').onsubmit = async function (e) {
    e.preventDefault();
    var m = $('#l-msg'), btn = $('#l-go'), em = $('#l-email').value.trim(), pw = $('#l-pass').value;
    if (btn.disabled) return;
    if (!em || !pw) return msg(m, T('bad'), 'error');
    btn.disabled = true; msg(m, T('loading'), 'info');
    try {
      var r = await auth.auth.signInWithPassword({ email: em, password: pw });
      if (r.error || !r.data.session) {
        var tx = (r.error && r.error.message) || '';
        // a mesma mensagem para senha errada, e-mail que não existe ou conta não confirmada (não revela quem tem conta)
        msg(m, /rate|too many|limit/i.test(tx) ? T('limited') : /fetch|network/i.test(tx) ? T('offline') : T('bad'), 'error'); btn.disabled = false; return;
      }
      var s = r.data.session, rr = await auth.rpc('login_route'), rs = routesOf(rr.data);
      if (rr.error) rs = ['client', 'partner', 'admin'];
      if (!rs.length) { await auth.auth.signOut().catch(function () {}); msg(m, T('noAccess'), 'error'); btn.disabled = false; return; }
      if (rs.length === 1) return await enter(rs[0], s);
      choose(rs, T('pick'), function (route) { enter(route, s).catch(function () { show('login'); msg(m, T('offline'), 'error'); btn.disabled = false; }); });
    } catch (er) { if (window.console) console.error('login', er && er.message); msg(m, T('offline'), 'error'); btn.disabled = false; }
  };

  /* ---------- esqueci a senha ---------- */
  $('#l-forgot').onclick = function (e) { e.preventDefault(); show('forgot'); $('#fg-email').value = $('#l-email').value.trim(); $('#fg-email').focus(); };
  $('#fg-back').onclick = function (e) { e.preventDefault(); show('login'); $('#l-email').focus(); };
  $('#f-forgot').onsubmit = async function (e) {
    e.preventDefault();
    var em = $('#fg-email').value.trim().toLowerCase(), m = $('#fg-msg'), btn = $('#fg-go');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return msg(m, T('badEmail'), 'error');
    if (btn.disabled) return; btn.disabled = true;
    var limited = false;
    try {
      var fr = await fetch(CFG.functionsUrl + '/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify({ action: 'access_reset', email: em, page: 'login.html', lang: L }) });
      if (!fr.ok) throw new Error('http');
    } catch (er) {
      var back = 'https://endeavorbiz.com/login.html'; try { if (/^https?:/.test(location.protocol)) back = new URL('login.html', location.href).href.split(/[?#]/)[0]; } catch (e2) { /* ignore */ }
      var r = await auth.auth.resetPasswordForEmail(em, { redirectTo: back + '?lang=' + L }).catch(function (x) { return { error: x }; });
      limited = !!(r && r.error && /rate|limit|seconds/i.test(r.error.message || ''));
    }
    // a mesma mensagem, exista ou não a conta
    msg(m, limited ? T('limited') : T('resetSent').replace('{e}', em), limited ? 'error' : 'ok');
    setTimeout(function () { btn.disabled = false; }, limited ? 5000 : 60000);
  };
  if (/[?&]forgot=1/.test(location.search)) show('forgot');
})();
