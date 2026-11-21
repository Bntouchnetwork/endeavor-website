/* Service worker do Endeavor Phone: guarda só a "casca" do app (HTML, CSS, JS e ícones) para abrir rápido.
   Nunca guarda respostas da API, do login ou dos dados (ligações, SMS, contatos). */
var CACHE = 'endeavor-phone-20261212';
var SHELL = ['phone.html', 'telefonia.css?v=20261204', 'tel-phone.js?v=20261204', 'app-config.js', 'img/phone-192.png', 'img/phone-512.png', 'phone.webmanifest'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('endeavor-phone-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API, login e CDN: sempre direto da rede
  var path = u.pathname.replace(/^.*\//, '') + u.search;
  if (SHELL.indexOf(path) < 0 && u.pathname.slice(-10) !== 'phone.html') return;
  // rede primeiro (versão nova), cache só se estiver sem internet
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); return r; }).catch(function () { return caches.match(e.request, { ignoreSearch: false }).then(function (r) { return r || caches.match('phone.html'); }); }));
});
