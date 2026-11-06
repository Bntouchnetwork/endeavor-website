/* WhatsApp / phone field with a country selector. The number is formatted as the person types, following the
   pattern of the chosen country, and is returned in international format (+5511912345678).
   Usage: var ph = EPhone.mount(containerEl, { id: 'b-phone', lang: 'pt', value: '+55…' }); ph.e164(); ph.valid(); */
(function () {
  'use strict';
  // [ISO, dial code, pattern(s) with # for digits]. Patterns list the accepted lengths; the first one is the mobile/WhatsApp pattern.
  var C = [
    ['US', '1', ['(###) ###-####']], ['BR', '55', ['(##) #####-####', '(##) ####-####']], ['PY', '595', ['### ###-###']], ['PT', '351', ['### ### ###']],
    ['ES', '34', ['### ## ## ##']], ['MX', '52', ['## #### ####']], ['AR', '54', ['# ## ####-####', '## ####-####']], ['CO', '57', ['### ### ####']],
    ['CL', '56', ['# #### ####']], ['UY', '598', ['## ### ###']], ['PE', '51', ['### ### ###']], ['BO', '591', ['#### ####']], ['EC', '593', ['## ### ####']],
    ['VE', '58', ['###-#######']], ['CA', '1', ['(###) ###-####']], ['PR', '1', ['(###) ###-####']], ['DO', '1', ['(###) ###-####']],
    ['CR', '506', ['#### ####']], ['PA', '507', ['####-####']], ['GT', '502', ['#### ####']], ['SV', '503', ['#### ####']], ['HN', '504', ['####-####']],
    ['NI', '505', ['#### ####']], ['CU', '53', ['# ### ####']], ['GB', '44', ['#### ######']], ['IE', '353', ['## ### ####']], ['FR', '33', ['# ## ## ## ##']],
    ['IT', '39', ['### ### ####', '### ### ###']], ['DE', '49', ['#### #######', '### ########', '### #######']], ['NL', '31', ['# ########']], ['BE', '32', ['### ## ## ##']],
    ['CH', '41', ['## ### ## ##']], ['AT', '43', ['### #######', '### ######']], ['PL', '48', ['### ### ###']], ['SE', '46', ['## ### ## ##']], ['NO', '47', ['### ## ###']],
    ['DK', '45', ['## ## ## ##']], ['FI', '358', ['## ### ####']], ['GR', '30', ['### ### ####']], ['RO', '40', ['### ### ###']], ['RU', '7', ['### ###-##-##']],
    ['UA', '380', ['## ### ## ##']], ['TR', '90', ['### ### ## ##']], ['IL', '972', ['##-###-####']], ['AE', '971', ['## ### ####']], ['SA', '966', ['## ### ####']],
    ['IN', '91', ['#####-#####']], ['CN', '86', ['### #### ####']], ['JP', '81', ['##-####-####']], ['KR', '82', ['##-####-####']], ['PH', '63', ['### ### ####']],
    ['AU', '61', ['### ### ###']], ['NZ', '64', ['## ### ####']], ['ZA', '27', ['## ### ####']], ['AO', '244', ['### ### ###']], ['MZ', '258', ['## ### ####']],
    ['CV', '238', ['### ## ##']], ['NG', '234', ['### ### ####']], ['EG', '20', ['### ### ####']], ['MA', '212', ['###-######']], ['LB', '961', ['## ### ###']],
    ['JO', '962', ['# #### ####']], ['HK', '852', ['#### ####']], ['SG', '65', ['#### ####']], ['TW', '886', ['### ### ###']], ['TH', '66', ['## ### ####']]
  ];
  var FAV = ['US', 'BR', 'PY', 'PT', 'ES', 'MX', 'AR', 'CO'];
  var TZ = { 'America/Sao_Paulo': 'BR', 'America/Bahia': 'BR', 'America/Fortaleza': 'BR', 'America/Recife': 'BR', 'America/Manaus': 'BR', 'America/Belem': 'BR', 'America/Cuiaba': 'BR', 'America/Campo_Grande': 'BR',
    'America/Asuncion': 'PY', 'Europe/Lisbon': 'PT', 'Europe/Madrid': 'ES', 'America/Mexico_City': 'MX', 'America/Argentina/Buenos_Aires': 'AR', 'America/Bogota': 'CO', 'America/Santiago': 'CL', 'America/Montevideo': 'UY', 'America/Lima': 'PE' };
  function flag(iso) { return iso.replace(/./g, function (c) { return String.fromCodePoint(127397 + c.charCodeAt(0)); }); }
  function names(lang) {
    try { var dn = new Intl.DisplayNames([lang === 'pt' ? 'pt-BR' : lang || 'en'], { type: 'region' }); return function (iso) { return dn.of(iso) || iso; }; } catch (e) { return function (iso) { return iso; }; }
  }
  function guess(lang) {
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZ[tz]) return TZ[tz]; if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Detroit|Indiana|Kentucky|Anchorage|Boise)/.test(tz) || /^Pacific\/Honolulu/.test(tz)) return 'US'; } catch (e) { /* ignore */ }
    var langs = (navigator.languages || [navigator.language || '']);
    for (var i = 0; i < langs.length; i++) { var m = /-([A-Z]{2})$/i.exec(langs[i]); if (m && C.some(function (c) { return c[0] === m[1].toUpperCase(); })) return m[1].toUpperCase(); }
    return lang === 'pt' ? 'BR' : 'US';
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function lens(c) { return c[2].map(function (p) { return (p.match(/#/g) || []).length; }); }
  function pattern(c, n) {
    // the pattern whose length fits the typed digits best (the mobile one first)
    var ls = lens(c), best = 0;
    for (var i = 0; i < ls.length; i++) if (ls[i] === n) return c[2][i];
    for (var j = 0; j < ls.length; j++) if (ls[j] >= n && ls[j] < ls[best]) best = j;
    return c[2][best];
  }
  function format(c, d) {
    var p = pattern(c, d.length), out = '', k = 0;
    for (var i = 0; i < p.length && k < d.length; i++) out += p[i] === '#' ? d[k++] : p[i];
    return out + d.slice(k);
  }
  function find(iso) { return C.filter(function (c) { return c[0] === iso; })[0] || C[0]; }
  function fromE164(v) {
    var d = digits(v), hit = null;
    C.slice().sort(function (a, b) { return b[1].length - a[1].length; }).some(function (c) { if (d.indexOf(c[1]) === 0) { hit = c; return true; } return false; });
    if (hit && hit[1] === '1') hit = find('US');
    return hit ? { c: hit, n: d.slice(hit[1].length) } : null;
  }

  function mount(box, o) {
    o = o || {};
    var name = names(o.lang), id = o.id || 'phone';
    var list = FAV.map(find).concat(C.filter(function (c) { return FAV.indexOf(c[0]) < 0; }).sort(function (a, b) { return name(a[0]).localeCompare(name(b[0])); }));
    box.classList.add('phone-intl');
    box.innerHTML = '<select class="phone-intl__cc" aria-label="' + (o.ccLabel || 'Country code') + '">' +
      list.map(function (c, i) { return (i === FAV.length ? '<option disabled>──────────</option>' : '') + '<option value="' + c[0] + '">' + flag(c[0]) + ' ' + name(c[0]) + ' +' + c[1] + '</option>'; }).join('') +
      '</select><input id="' + id + '" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="24">';
    var sel = box.querySelector('select'), inp = box.querySelector('input');
    var cur = find(o.country || guess(o.lang));
    function place() { inp.placeholder = cur[2][0].replace(/#/g, '0'); }
    function setCountry(iso) { cur = find(iso); sel.value = iso; place(); inp.value = inp.value ? format(cur, digits(inp.value)) : ''; }
    sel.onchange = function () { setCountry(sel.value); inp.focus(); if (o.onchange) o.onchange(); };
    inp.addEventListener('input', function () {
      var raw = inp.value, d = digits(raw);
      // pasted in international format (+55 11 …): switch the country
      if (/^\s*(\+|00)/.test(raw)) {
        var f = fromE164(raw.replace(/^\s*00/, '+'));
        if (!f || !f.n) { inp.value = '+' + d.slice(0, 15); if (o.onchange) o.onchange(); return; } // still typing the country code
        cur = f.c; sel.value = f.c[0]; place(); d = f.n;
      }
      var max = Math.max.apply(null, lens(cur)) || 14; if (d.length > max) d = d.slice(0, max);
      inp.value = format(cur, d);
      if (o.onchange) o.onchange();
    });
    var api = {
      input: inp,
      e164: function () { var d = digits(inp.value).replace(/^0+/, ''); return d ? '+' + cur[1] + d : ''; },
      valid: function () { var n = digits(inp.value).replace(/^0+/, '').length; var ls = lens(cur); return ls.indexOf(n) > -1 || (cur[2].length === 0 && n >= 6 && n <= 14); },
      empty: function () { return !digits(inp.value); },
      country: function () { return cur[0]; },
      set: function (v) { var f = v && fromE164(v); if (f) { cur = f.c; sel.value = f.c[0]; place(); inp.value = format(cur, f.n); } else inp.value = ''; }
    };
    sel.value = cur[0]; place();
    if (o.value) api.set(o.value);
    return api;
  }
  window.EPhone = { mount: mount };
})();
