/* Partner (collaborator) access permissions: form, defaults per partner type and summary.
   Shared by the client portal (account owner) and the admin console. */
(function () {
  'use strict';
  var CATS = ['formation', 'tax_return', 'report', 'compliance', 'other'];
  var DEFAULTS = {
    accountant: { cats: ['formation', 'tax_return', 'report', 'compliance', 'other'], deadlines: true, upload: true },
    bookkeeping: { cats: ['report', 'other'], deadlines: true, upload: true },
    property_management: { cats: ['formation', 'compliance', 'other'], deadlines: false, upload: true },
    other: { cats: [], deadlines: false, upload: true }
  };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* L: labels { access, companies, allCompanies, docs, cat_formation..cat_other, deadlines, upload, docsHint } */
  function html(prefix, L, companies, p) {
    p = p || {};
    var cats = p.perm_doc_categories || [], allCo = !p.perm_companies, coSel = p.perm_companies || [];
    return '<fieldset class="perm-box"><legend>' + esc(L.access) + '</legend>' +
      '<div class="perm-group"><span class="perm-title">' + esc(L.companies) + '</span>' +
        '<div class="check-row"><input type="checkbox" id="' + prefix + '-allco"' + (allCo ? ' checked' : '') + '><label for="' + prefix + '-allco">' + esc(L.allCompanies) + '</label></div>' +
        '<div class="perm-cos" id="' + prefix + '-cos"' + (allCo ? ' hidden' : '') + '>' + companies.map(function (c) {
          return '<div class="check-row"><input type="checkbox" id="' + prefix + '-co-' + c.id + '" data-co="' + c.id + '"' + (coSel.indexOf(c.id) > -1 ? ' checked' : '') + '><label for="' + prefix + '-co-' + c.id + '">' + esc(c.legal_name) + '</label></div>';
        }).join('') + '</div></div>' +
      '<div class="perm-group"><span class="perm-title">' + esc(L.docs) + '</span>' + CATS.map(function (k) {
        return '<div class="check-row"><input type="checkbox" id="' + prefix + '-cat-' + k + '" data-cat="' + k + '"' + (cats.indexOf(k) > -1 ? ' checked' : '') + '><label for="' + prefix + '-cat-' + k + '">' + esc(L['cat_' + k]) + '</label></div>';
      }).join('') + (L.docsHint ? '<p class="perm-hint">' + esc(L.docsHint) + '</p>' : '') + '</div>' +
      '<div class="perm-group"><span class="perm-title">' + esc(L.other) + '</span>' +
        '<div class="check-row"><input type="checkbox" id="' + prefix + '-dl"' + (p.perm_deadlines !== false ? ' checked' : '') + '><label for="' + prefix + '-dl">' + esc(L.deadlines) + '</label></div>' +
        '<div class="check-row"><input type="checkbox" id="' + prefix + '-up"' + (p.can_upload !== false ? ' checked' : '') + '><label for="' + prefix + '-up">' + esc(L.upload) + '</label></div>' +
      '</div></fieldset>';
  }
  function apply(root, prefix, type) {
    var d = DEFAULTS[type] || DEFAULTS.other;
    CATS.forEach(function (k) { var c = root.querySelector('#' + prefix + '-cat-' + k); if (c) c.checked = d.cats.indexOf(k) > -1; });
    root.querySelector('#' + prefix + '-dl').checked = d.deadlines;
    root.querySelector('#' + prefix + '-up').checked = d.upload;
  }
  function wire(root, prefix, typeSelect, applyDefaultsNow) {
    var all = root.querySelector('#' + prefix + '-allco'), box = root.querySelector('#' + prefix + '-cos');
    all.onchange = function () { box.hidden = all.checked; };
    if (typeSelect) typeSelect.addEventListener('change', function () { apply(root, prefix, typeSelect.value); });
    if (applyDefaultsNow && typeSelect) apply(root, prefix, typeSelect.value);
  }
  function read(root, prefix) {
    var cats = CATS.filter(function (k) { var c = root.querySelector('#' + prefix + '-cat-' + k); return c && c.checked; });
    var all = root.querySelector('#' + prefix + '-allco').checked;
    var cos = all ? null : Array.prototype.slice.call(root.querySelectorAll('#' + prefix + '-cos [data-co]')).filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.co; });
    return { perm_doc_categories: cats, perm_companies: cos, perm_deadlines: root.querySelector('#' + prefix + '-dl').checked,
      can_upload: root.querySelector('#' + prefix + '-up').checked, can_view: cats.length > 0 };
  }
  function summary(u, L, companies) {
    if (u.role === 'owner') return L.full;
    var parts = [];
    var cats = u.perm_doc_categories || [];
    parts.push(cats.length ? L.docsShort + ': ' + cats.map(function (k) { return L['cat_' + k]; }).join(', ') : L.noDocs);
    if (u.perm_deadlines) parts.push(L.deadlinesShort);
    if (u.can_upload) parts.push(L.uploadShort);
    if (u.perm_companies) parts.push(u.perm_companies.map(function (id) { var c = (companies || []).find(function (x) { return x.id === id; }); return c ? c.legal_name : ''; }).filter(Boolean).join(', ') || L.noCompanies);
    return parts.join(' · ');
  }
  window.EPerms = { CATS: CATS, DEFAULTS: DEFAULTS, html: html, wire: wire, read: read, summary: summary, apply: apply };
})();
