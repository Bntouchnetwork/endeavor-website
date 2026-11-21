/* Comunidade: o card e o perfil, iguais na página pública, na prévia do portal e no admin. */
(function () {
  'use strict';
  var TX = {
    en: { company: 'Company', professional: 'Professional', reviews: '{n} reviews', review1: '1 review', noReviews: 'No reviews yet', view: 'View profile', site: 'Website', stars: '{n} out of 5 stars' },
    pt: { company: 'Empresa', professional: 'Profissional', reviews: '{n} avaliações', review1: '1 avaliação', noReviews: 'Ainda sem avaliações', view: 'Ver perfil', site: 'Site', stars: '{n} de 5 estrelas' },
    es: { company: 'Empresa', professional: 'Profesional', reviews: '{n} reseñas', review1: '1 reseña', noReviews: 'Aún sin reseñas', view: 'Ver perfil', site: 'Sitio web', stars: '{n} de 5 estrellas' }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tx(l, k, v) { var s = (TX[l] || TX.en)[k]; Object.keys(v || {}).forEach(function (n) { s = s.split('{' + n + '}').join(v[n]); }); return s; }
  function img(path) { var c = window.ENDEAVOR_CFG || {}; return path && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(path) ? c.supabaseUrl + '/storage/v1/object/public/community/' + path : ''; }
  function site(u) { return /^https?:\/\/[^\s"'<>]+$/i.test(u || '') ? u : ''; }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function stars(l, r) {
    var n = Math.round((+r || 0) * 2) / 2, h = '';
    for (var i = 1; i <= 5; i++) h += '<span class="cm-star' + (n >= i ? ' is-on' : n >= i - .5 ? ' is-half' : '') + '" aria-hidden="true">★</span>';
    return '<span class="cm-stars" role="img" aria-label="' + esc(tx(l, 'stars', { n: (+r || 0).toFixed(1) })) + '">' + h + '</span>';
  }
  function rating(l, p) {
    var n = +p.reviews || 0; if (Array.isArray(p.reviews)) n = p.reviews.length;
    return n ? stars(l, p.rating) + ' <span class="cm-nota">' + (+p.rating || 0).toFixed(1) + ' · ' + esc(n === 1 ? tx(l, 'review1') : tx(l, 'reviews', { n: n })) + '</span>' : '<span class="cm-nota">' + esc(tx(l, 'noReviews')) + '</span>';
  }
  function avatar(p, cls) {
    var u = img(p.kind === 'professional' ? (p.photo_path || p.logo_path) : (p.logo_path || p.photo_path));
    return '<span class="cm-avatar ' + (cls || '') + (p.kind === 'professional' ? ' cm-avatar--round' : '') + '">' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<span aria-hidden="true">' + esc(initials(p.display_name)) + '</span>') + '</span>';
  }
  function place(p) { return [p.city, p.state].filter(Boolean).join(', '); }
  // card do diretório (o card inteiro é o botão que abre o perfil)
  function card(p, l, o) {
    o = o || {};
    var tag = o.preview ? 'div' : 'button', attrs = o.preview ? '' : ' type="button" data-p="' + esc(p.id) + '"';
    return '<' + tag + ' class="cm-card"' + attrs + '>' + avatar(p) +
      '<span class="cm-card__top"><strong class="cm-card__nome">' + esc(p.display_name || '—') + '</strong><span class="cm-tipo">' + esc(tx(l, p.kind === 'professional' ? 'professional' : 'company')) + '</span></span>' +
      '<span class="cm-card__meta">' + esc([p.area, place(p)].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="cm-card__txt">' + esc(p.headline || '') + '</span>' +
      '<span class="cm-card__pe"><span class="cm-card__aval">' + rating(l, p) + '</span>' + (o.preview ? '' : '<span class="cm-card__ver">' + esc(tx(l, 'view')) + ' →</span>') + '</span></' + tag + '>';
  }
  // topo do perfil: banner, logo ou foto, nome e dados
  function profileHead(p, l) {
    var b = img(p.banner_path), s = site(p.website), foto = p.kind !== 'professional' && p.photo_path && p.logo_path ? img(p.photo_path) : '';
    return '<div class="cm-banner"' + (b ? ' style="background-image:url(\'' + esc(b) + '\')"' : '') + '></div>' +
      '<div class="cm-perfil__id">' + avatar(p, 'cm-avatar--lg') + '<div><h2 class="cm-perfil__nome" id="cm-nome">' + esc(p.display_name || '—') + '</h2>' +
      '<p class="cm-perfil__meta"><span class="cm-tipo">' + esc(tx(l, p.kind === 'professional' ? 'professional' : 'company')) + '</span> ' + esc([p.area, place(p)].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="cm-perfil__aval">' + rating(l, p) + (s ? ' · <a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(tx(l, 'site')) + '</a>' : '') + '</p></div>' +
      (foto ? '<img class="cm-perfil__foto" src="' + esc(foto) + '" alt="">' : '') + '</div>';
  }
  window.ECommunity = { card: card, profileHead: profileHead, stars: stars, img: img, esc: esc, site: site };
})();
