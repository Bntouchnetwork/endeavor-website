/* Sessão da Endeavor, igual no site e nos três portais:
   - quem está logado continua logado até clicar em sair (o botão Login da home fica verde e volta direto ao painel);
   - sem atividade por 30 minutos, sai sozinho; 2 minutos antes aparece um aviso com "Continuar logado".
   Não guarda nada novo de sensível: só a hora da última atividade e o nome do portal. */
(function () {
  'use strict';
  var LIMITE = 30 * 60 * 1000, AVISO = 2 * 60 * 1000;
  var K_ATIVO = 'endeavor-last-active', K_PORTAL = 'endeavor-portal';
  var PAGE = { admin: 'admin.html', client: 'client.html', partner: 'partner.html' };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }, del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } } };
  function chaves() {
    var ref = ''; try { ref = new URL((window.ENDEAVOR_CFG || {}).supabaseUrl).hostname.split('.')[0]; } catch (e) { /* sem config */ }
    return { admin: ref ? 'sb-' + ref + '-auth-token' : null, client: 'endeavor-client-auth', partner: 'endeavor-client-auth' };
  }
  function tem(k) { if (!k) return false; try { var v = JSON.parse(ls.get(k) || 'null'); return !!(v && v.refresh_token && v.access_token); } catch (e) { return false; } }
  function limpar() { var c = chaves(); [c.admin, c.client].forEach(function (k) { if (k) ls.del(k); }); ls.del(K_ATIVO); }
  function parado() { var t = +ls.get(K_ATIVO) || 0; return t ? Date.now() - t : 0; }
  // onde a pessoa está logada (ou null). Sessão parada há mais de 30 minutos é apagada daqui.
  function onde() {
    var c = chaves(), a = tem(c.admin), cl = tem(c.client);
    if (!a && !cl) return null;
    if (parado() >= LIMITE) { limpar(); return null; }
    if (!ls.get(K_ATIVO)) ls.set(K_ATIVO, String(Date.now()));
    var p = ls.get(K_PORTAL), rota = p === 'admin' && a ? 'admin' : (p === 'client' || p === 'partner') && cl ? p : a ? 'admin' : 'client';
    return { route: rota, page: PAGE[rota] };
  }
  function tocar() { ls.set(K_ATIVO, String(Date.now())); }
  window.ESession = { where: onde, touch: tocar, clear: limpar, clearOne: function (r) { var k = chaves()[r]; if (k) ls.del(k); }, setPortal: function (r) { if (PAGE[r]) ls.set(K_PORTAL, r); }, LIMIT: LIMITE, WARN: AVISO };

  var eu = document.currentScript, portal = eu && eu.getAttribute('data-portal'), site = eu && eu.hasAttribute('data-site');
  var lang = (function () { var m = /[?&]lang=(en|pt|es)/.exec(location.search), l = m ? m[1] : (ls.get('endeavor-lang') || document.documentElement.lang || 'en').slice(0, 2); return /^(en|pt|es)$/.test(l) ? l : 'en'; })();
  var TX = {
    en: { on: 'You are signed in. Go to your dashboard', t: 'Are you still there?', p: 'For your security, you will be signed out in {s} for inactivity.', go: 'Stay signed in', out: 'Sign out now' },
    pt: { on: 'Você está logado. Ir para o seu painel', t: 'Você ainda está aí?', p: 'Para a sua segurança, você sai automaticamente em {s} por falta de atividade.', go: 'Continuar logado', out: 'Sair agora' },
    es: { on: 'Tiene la sesión iniciada. Ir a su panel', t: '¿Sigue ahí?', p: 'Por su seguridad, saldrá automáticamente en {s} por inactividad.', go: 'Seguir conectado', out: 'Salir ahora' }
  };
  function tx(k) { var l = (window.EP && EP.lang) || (document.documentElement.lang || lang).slice(0, 2); return (TX[l] || TX[lang] || TX.en)[k]; }

  /* ---------- site (home): o botão Login mostra que a pessoa está logada e volta direto ao painel ---------- */
  function pintaSite() {
    var w = onde();
    Array.prototype.forEach.call(document.querySelectorAll('.js-login, .footer__admin'), function (a) {
      // guarda o endereço do login (com o idioma que o site pôs) para devolver quando a pessoa sair
      var h = a.getAttribute('href') || '';
      if (/^login\.html/.test(h)) a.dataset.hrefSair = h;
      if (w) a.setAttribute('href', w.page + ((a.dataset.hrefSair || '').match(/\?[^#]*/) || [''])[0]);
      else if (a.dataset.hrefSair && !/^login\.html/.test(h)) a.setAttribute('href', a.dataset.hrefSair);
      if (!a.classList.contains('js-login')) return;
      a.classList.toggle('is-logged', !!w);
      if (w) { a.setAttribute('title', tx('on')); a.setAttribute('aria-label', tx('on')); } else { a.removeAttribute('title'); a.removeAttribute('aria-label'); }
    });
    return w;
  }

  /* ---------- atividade e saída automática ---------- */
  var ultimoToque = 0, aviso = null;
  function atividade() { if (aviso) return; var n = Date.now(); if (n - ultimoToque < 10000) return; ultimoToque = n; if (onde()) tocar(); }
  function sair() {
    fechaAviso();
    try { sessionStorage.setItem('endeavor-idle-out', '1'); } catch (e) { /* ignore */ }
    var b = document.getElementById('btn-signout');
    // o botão Sair do portal encerra a sessão no servidor; se ele não responder, apaga a sessão daqui e volta ao login
    if (b) { try { b.click(); } catch (e) { /* ignore */ } }
    setTimeout(function () { limpar(); location.replace('login.html?out=all'); }, b ? 2500 : 0);
  }
  function fechaAviso() { if (aviso) { aviso.remove(); aviso = null; } }
  function mostraAviso() {
    if (aviso) return;
    aviso = document.createElement('div'); aviso.id = 'idle-warn'; aviso.setAttribute('role', 'alertdialog'); aviso.setAttribute('aria-modal', 'true'); aviso.setAttribute('aria-labelledby', 'idle-t'); aviso.setAttribute('aria-describedby', 'idle-p');
    aviso.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgb(7 22 43 / .55);display:flex;align-items:center;justify-content:center;padding:1rem';
    aviso.innerHTML = '<div style="background:#fff;color:#0b1f3a;border-radius:14px;max-width:26rem;width:100%;padding:1.5rem;box-shadow:0 20px 60px rgb(0 0 0 / .3);font:1rem/1.5 system-ui,sans-serif">' +
      '<h2 id="idle-t" style="margin:0 0 .5rem;font:700 1.3rem/1.3 Georgia,serif"></h2><p id="idle-p" style="margin:0 0 1.1rem" aria-live="polite"></p>' +
      '<div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:flex-end"><button type="button" id="idle-out" style="min-height:2.75rem;padding:0 1rem;border-radius:8px;border:1px solid #c9cfdb;background:#fff;color:#0b1f3a;font:inherit;cursor:pointer"></button>' +
      '<button type="button" id="idle-go" style="min-height:2.75rem;padding:0 1.1rem;border-radius:8px;border:0;background:#0b1f3a;color:#fff;font:600 1rem system-ui,sans-serif;cursor:pointer"></button></div></div>';
    document.body.appendChild(aviso);
    aviso.querySelector('#idle-t').textContent = tx('t'); aviso.querySelector('#idle-go').textContent = tx('go'); aviso.querySelector('#idle-out').textContent = tx('out');
    aviso.querySelector('#idle-go').onclick = function () { fechaAviso(); tocar(); };
    aviso.querySelector('#idle-out').onclick = sair;
    aviso.querySelector('#idle-go').focus();
  }
  function conta() {
    var c = chaves();
    if (!tem(c.admin) && !tem(c.client)) { fechaAviso(); return; }       // ainda na tela de login do portal: nada a fazer
    var falta = LIMITE - parado();
    if (falta <= 0) return sair();
    if (falta <= AVISO) {
      mostraAviso(); var s = Math.ceil(falta / 1000), m = Math.floor(s / 60);
      aviso.querySelector('#idle-p').textContent = tx('p').replace('{s}', m + ':' + String(s % 60).padStart(2, '0'));
    } else fechaAviso();                                                    // outra aba renovou a sessão
  }

  if (portal) {
    onde();                                                                 // sessão parada há mais de 30 minutos: sai antes de o portal abrir
    if (!ls.get(K_PORTAL)) ls.set(K_PORTAL, portal);
    setInterval(conta, 1000);
  }
  if (portal || site) ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'].forEach(function (ev) { window.addEventListener(ev, atividade, { passive: true, capture: true }); });
  if (site) {
    var ini = function () { pintaSite(); document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.js-login, .footer__admin')) pintaSite(); }, true); setInterval(pintaSite, 30000); window.addEventListener('pageshow', pintaSite); window.addEventListener('storage', pintaSite); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ini); else ini();
  }
})();
