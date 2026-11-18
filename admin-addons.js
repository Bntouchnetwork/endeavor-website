/* Admin › Add-ons: criar add-ons, mudanças pequenas e correções com IA (plano B de manutenção da plataforma).
   Fluxo: criar (conversa com a IA) → gerar (branch de teste no GitHub) → testar (prévia) → publicar (só com aprovação; dá para desfazer).
   Preço e situação de venda continuam em Pagamentos › Loja online. Fala com a função addon-builder. */
(function () {
  'use strict';
  var EXTRA = [['webmeeting', 'Web Meeting'], ['webinar', 'Live Webinar'], ['whatsapp', 'WhatsApp Manager']];
  var NOMES = { crm: 'CRM', agenda: 'Agenda Online', esign: 'Assinatura Eletrônica', bookkeeping: 'Bookkeeping', operating_agreement: 'Operating Agreement', telefone: 'Telefone Comercial',
    registered_agent: 'Registered Agent', virtual_address: 'Endereço Virtual' };
  var SIT = { active: ['À venda', 'pill--report'], coming_soon: ['Em breve', ''], hidden: ['Escondido', 'pill--draft'] };
  var INT = { month: 'mensal', year: 'anual', once: 'pagamento único' };
  var KIND = { addon: 'Novo add-on', change: 'Mudança pequena', bugfix: 'Correção de bug' };
  var ST = { chatting: ['Conversando', ''], queued: ['Na fila', 'pill--draft'], building: ['Gerando', 'pill--draft'], preview: ['Prévia pronta', 'pill--report'], publishing: ['Publicando', 'pill--draft'],
    published: ['Publicado', 'pill--paid'], failed: ['Falhou', 'pill--overdue'], discarded: ['Descartado', ''], reverting: ['Desfazendo', 'pill--draft'], reverted: ['Desfeito', ''] };
  var ERR = { github_not_configured: 'O GitHub ainda não está ligado: falta o GITHUB_TOKEN nos Secrets do Supabase.', ai_not_configured: 'A IA ainda não está ligada: falta o HUB_AI_API_KEY nos Secrets do Supabase.',
    ai_limit_reached: 'O limite de custo do mês foi atingido. Aumente o limite abaixo para continuar.', task_limit_reached: 'Esta criação passou do limite de custo por tarefa. Aumente o limite para gerar de novo.',
    confirm_sensitive: 'Esta mudança mexe em área sensível: digite PUBLICAR para confirmar.', no_plan: 'Converse com a IA até ela montar o plano antes de gerar.', locked: 'Não dá para fazer isso agora (veja a situação).',
    no_changes: 'A geração não mudou nenhum arquivo: não há o que publicar.', github_error: 'O GitHub recusou o pedido.', ai_error: 'A IA não respondeu. Tente de novo em instantes.', forbidden: 'Só o super admin com autenticador usa esta página.' };
  var timer = null;

  function param(k) { var m = ERoute.get().match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : null; }
  var usd = function (n) { return 'US$ ' + Number(n || 0).toFixed(2); };
  var money = function (c) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((c || 0) / 100); };
  function pill(esc, st) { var s = ST[st] || [st, '']; return '<span class="pill ' + s[1] + '">' + esc(s[0]) + '</span>'; }
  async function call(ctx, payload) {
    var s = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/addon-builder', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : '') }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var e = new Error(ERR[j.error] || j.error || 'HTTP ' + r.status); e.code = j.error; e.detail = j.detail; throw e; }
    return j;
  }
  function msg(el, t, k) { if (!el) return; el.hidden = false; el.className = 'portal-alert portal-alert--' + (k || 'info'); el.textContent = t; }
  function errMsg(e) { return e.message + (e.code === 'github_error' && e.detail ? ' (' + e.detail + ')' : ''); }
  function nome(code) { var i = window.EStore && EStore.info(code, 'pt'); return (i && i.name) || NOMES[code] || code; }

  async function render(view, ctx) {
    if (timer) { clearTimeout(timer); timer = null; }
    var id = param('id');
    return id ? detalhe(view, ctx, id) : lista(view, ctx);
  }

  /* ---------------- lista: o que existe, o que está sendo criado e o que falta configurar ---------------- */
  async function lista(view, ctx) {
    var esc = ctx.esc;
    var res = await Promise.all([ctx.q(ctx.sb.from('store_products').select('*').order('sort')), ctx.sb.rpc('addon_usage_counts'),
      ctx.q(ctx.sb.from('addon_builds').select('id, title, kind, status, cost_usd, updated_at, product_code').order('updated_at', { ascending: false }).limit(50)),
      call(ctx, { action: 'status' }).catch(function (e) { return { erro: e.message }; })]);
    var usos = {}; ((res[1] && res[1].data) || []).forEach(function (u) { usos[u.product_code] = u.clientes; });
    var prods = res[0].filter(function (p) { return p.kind !== 'package'; }), builds = res[2], st = res[3];
    var faltam = st.falta || [];
    var bloqueio = !st.erro && (!st.ai || !st.github || !st.hook);
    view.innerHTML = '<div class="console__head"><div><h1>Add-ons</h1><p class="portal-muted">Crie add-ons, mudanças pequenas e correções com IA: criar, gerar, testar e publicar. Nada vai para o site sem a sua aprovação. Preço e venda ficam em <a href="#/pagamentos?tab=loja">Pagamentos › Loja online</a>.</p></div>' +
      '<button class="btn btn--gold" id="ad-new" type="button"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg> Criar add-on</button></div>' +
      '<div id="ad-m" hidden></div>' +
      (st.erro ? '<div class="portal-alert portal-alert--error">Não foi possível ler a configuração: ' + esc(st.erro) + '</div>' :
        '<section class="portal-card ad-cfg"><div class="ad-cfg__top"><div><h2 class="portal-h2" style="margin:0">Configuração</h2><p class="portal-muted" style="margin:.25rem 0 0">' +
          [['IA (Hub AI)', st.ai], ['GitHub', st.github], ['Chave do gancho', st.hook], ['Workflows', st.workflow]].map(function (x) { return '<span class="ad-ok ' + (x[1] ? 'is-on' : 'is-off') + '">' + (x[1] ? '✓ ' : '✗ ') + x[0] + '</span>'; }).join('') + '</p></div>' +
          '<div class="ad-gasto"><span>Custo da IA no mês</span><strong>' + usd(st.gasto_mes) + '</strong><small>de ' + usd(st.limites.mes) + ' (' + st.situacao.pct + '%)</small><div class="tel-barra' + (st.situacao.bloqueado ? ' cheio' : st.situacao.alerta ? ' alerta' : '') + '"><i style="width:' + Math.min(100, st.situacao.pct) + '%"></i></div></div></div>' +
          (faltam.length ? '<details class="ad-falta"' + (bloqueio ? ' open' : '') + '><summary>O que falta configurar (' + faltam.length + ')</summary><ol>' + faltam.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol><p class="portal-muted">Chaves e tokens você mesmo digita no Supabase ou no GitHub; nunca no chat.</p></details>' : '') +
          '<form class="ad-lim" id="ad-lim"><label>Limite por tarefa (US$) <input type="number" min="1" max="500" step="1" name="t" value="' + st.limites.tarefa + '"></label><label>Limite por mês (US$) <input type="number" min="5" max="5000" step="1" name="m" value="' + st.limites.mes + '"></label><button class="btn btn--ghost btn--sm" type="submit">Salvar limites</button></form></section>') +
      '<section class="portal-card"><h2 class="portal-h2">Criações</h2>' + (builds.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Pedido</th><th>Tipo</th><th>Situação</th><th class="num">Custo</th><th>Atualizado</th></tr></thead><tbody>' + builds.map(function (b) {
        return '<tr class="row-link" data-href="#/addons?id=' + b.id + '"><td><a href="#/addons?id=' + b.id + '"><strong>' + esc(b.title) + '</strong></a></td><td>' + esc(KIND[b.kind] || b.kind) + '</td><td>' + pill(esc, b.status) + '</td><td class="num">' + usd(b.cost_usd) + '</td><td>' + esc(ctx.fmtDT(b.updated_at)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Nenhuma criação ainda. Clique em "Criar add-on" e descreva o que você quer.</p>') + '</section>' +
      '<section class="portal-card"><h2 class="portal-h2">Add-ons existentes</h2><div class="table-wrap"><table class="data"><thead><tr><th>Add-on</th><th>Cobrança</th><th class="num">Preço</th><th class="num">Preço de cliente</th><th>Situação</th><th class="num">Clientes</th></tr></thead><tbody>' +
        prods.map(function (p) { var s = SIT[p.status] || [p.status, '']; return '<tr><td><strong>' + esc(nome(p.code)) + '</strong><span class="sub">' + esc(p.code) + '</span></td><td>' + esc(INT[p.interval] || p.interval) + '</td><td class="num">' + money(p.price_cents) + '</td><td class="num">' + (p.member_cents != null ? money(p.member_cents) : '—') + '</td><td><span class="pill ' + s[1] + '">' + esc(s[0]) + '</span></td><td class="num">' + (usos[p.code] || 0) + '</td></tr>'; }).join('') +
        EXTRA.map(function (x) { return '<tr><td><strong>' + esc(x[1]) + '</strong><span class="sub">liberado na ficha do cliente</span></td><td>—</td><td class="num">—</td><td class="num">—</td><td><span class="pill">Sob consulta</span></td><td class="num">—</td></tr>'; }).join('') +
      '</tbody></table></div><p class="portal-muted" style="font-size:.85rem">Para mudar preço, preço de cliente ou colocar à venda: <a href="#/pagamentos?tab=loja">Pagamentos › Loja online</a>.</p></section>';
    view.querySelectorAll('tr[data-href]').forEach(function (tr) { tr.onclick = function (e) { if (e.target.tagName !== 'A') ERoute.go(tr.dataset.href); }; });
    view.querySelector('#ad-new').onclick = function () { novo(ctx); };
    var lim = view.querySelector('#ad-lim');
    if (lim) lim.onsubmit = async function (ev) {
      ev.preventDefault();
      try { await call(ctx, { action: 'limits_save', task_cap: +lim.t.value, monthly_cap: +lim.m.value }); msg(view.querySelector('#ad-m'), 'Limites salvos.', 'ok'); }
      catch (e) { msg(view.querySelector('#ad-m'), errMsg(e), 'error'); }
    };
  }

  function novo(ctx) {
    var esc = ctx.esc, ov = ctx.openOverlay('<h2 id="adn-t">Criar com IA</h2>' +
      '<form id="adn-f" class="portal-form"><fieldset class="ad-tipos"><legend>O que você quer?</legend>' + Object.keys(KIND).map(function (k, i) {
        return '<label class="ad-tipo"><input type="radio" name="k" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(KIND[k]) + '</span></label>'; }).join('') + '</fieldset>' +
      '<div class="field"><label for="adn-x">Descreva com as suas palavras</label><textarea id="adn-x" name="x" rows="6" required minlength="5" maxlength="6000" placeholder="Ex.: um add-on de cartão de visita digital para o cliente compartilhar o contato da empresa por link e QR code."></textarea></div>' +
      '<p class="portal-muted" style="font-size:.85rem">A IA faz perguntas e monta o plano. Nada é gerado nem publicado sem você clicar. Não escreva senhas, chaves ou dados de clientes.</p>' +
      '<div id="adn-m" hidden></div><div class="portal-btn-row"><button class="btn btn--gold" type="submit">Começar a conversa</button><button class="btn btn--ghost" type="button" id="adn-c">Cancelar</button></div></form>', true);
    var f = document.getElementById('adn-f');
    document.getElementById('adn-c').onclick = ctx.closeOverlay;
    f.onsubmit = async function (ev) {
      ev.preventDefault();
      var bt = f.querySelector('[type=submit]'); bt.disabled = true; bt.textContent = 'A IA está lendo…';
      try {
        var r = await call(ctx, { action: 'create', kind: (f.querySelector('[name=k]:checked') || {}).value, text: f.x.value });
        ctx.closeOverlay(); ERoute.go('#/addons?id=' + r.id);
      } catch (e) { bt.disabled = false; bt.textContent = 'Começar a conversa'; msg(document.getElementById('adn-m'), errMsg(e), 'error'); }
    };
    return ov;
  }

  /* ---------------- detalhe: conversa, plano, prévia, publicar, desfazer, histórico ---------------- */
  async function detalhe(view, ctx, id) {
    var esc = ctx.esc;
    var res = await Promise.all([ctx.q(ctx.sb.from('addon_builds').select('*').eq('id', id).single()), ctx.q(ctx.sb.from('addon_build_messages').select('*').eq('build_id', id).order('id')),
      ctx.q(ctx.sb.from('addon_build_events').select('*').eq('build_id', id).order('id', { ascending: false }))]);
    var b = res[0], msgs = res[1], evs = res[2], p = b.plan || {};
    var passo = { chatting: 0, failed: 1, queued: 1, building: 1, preview: 2, publishing: 3, published: 3, reverting: 3, reverted: 3, discarded: 0 }[b.status] || 0;
    var repo = 'Bntouchnetwork/endeavor-website', prUrl = b.pr_number ? 'https://github.com/' + repo + '/pull/' + b.pr_number : '';
    var sens = Array.isArray(b.sensitive) ? b.sensitive : [], files = Array.isArray(b.files) ? b.files : [];
    var aberto = ['chatting', 'preview', 'failed'].indexOf(b.status) > -1;
    view.innerHTML = '<p style="margin:0 0 .5rem"><a href="#/addons">← Add-ons</a></p><div class="console__head"><div><h1>' + esc(b.title) + '</h1><p class="portal-muted">' + esc(KIND[b.kind] || b.kind) + ' · ' + pill(esc, b.status) + ' · custo ' + usd(b.cost_usd) + '</p></div></div>' +
      '<ol class="ad-passos">' + ['Criar', 'Gerar', 'Testar', 'Publicar'].map(function (n, i) { return '<li class="' + (i < passo ? 'feito' : i === passo ? 'agora' : '') + '"' + (i === passo ? ' aria-current="step"' : '') + '><span>' + (i + 1) + '</span>' + n + '</li>'; }).join('') + '</ol>' +
      '<div id="ad-m" hidden></div><div class="ad-grid">' +
      '<section class="portal-card ad-chat"><h2 class="portal-h2">Conversa com a IA</h2><div class="ad-msgs" id="ad-msgs" aria-live="polite">' + msgs.map(function (m) {
        return '<div class="ad-msg ad-msg--' + m.role + '"><span class="ad-msg__q">' + (m.role === 'ai' ? 'IA' : m.role === 'admin' ? 'Você' : 'Sistema') + '</span><p>' + esc(m.content) + '</p></div>'; }).join('') + '</div>' +
      (aberto ? '<form id="ad-f" class="ad-compor"><label for="ad-x" class="sr-only">Mensagem para a IA</label><textarea id="ad-x" rows="3" maxlength="6000" placeholder="Responda ou peça mudanças no plano…"></textarea><button class="btn btn--navy" type="submit">Enviar</button></form>' : '') + '</section>' +
      '<div class="ad-lado"><section class="portal-card"><h2 class="portal-h2">Plano</h2>' + (p.summary ? '<p>' + esc(p.summary) + '</p>' +
        (p.tasks && p.tasks.length ? '<h3 class="ad-h3">Tarefas</h3><ul>' + p.tasks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
        (p.product ? '<h3 class="ad-h3">Add-on na loja</h3><p class="portal-muted">' + esc((p.product.names && p.product.names.pt) || p.product.code) + ' · ' + esc(p.product.code) + ' · ' + esc(INT[p.product.interval] || '') + '. Entra escondido; o preço você define na Loja.</p>' : '') +
        (p.risks && p.risks.length ? '<h3 class="ad-h3">Atenção</h3><ul class="ad-risco">' + p.risks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
        (!p.ready && b.status === 'chatting' ? '<p class="portal-alert portal-alert--info">A IA ainda tem perguntas. Dá para gerar assim mesmo, mas o resultado tende a sair melhor depois de responder.</p>' : '')
        : '<p class="portal-muted">O plano aparece aqui quando a IA tiver entendido o pedido.</p>') + '</section>' +
      acoes(esc, b, p, sens, files, prUrl) +
      '<section class="portal-card"><h2 class="portal-h2">Histórico</h2><ul class="ad-hist">' + evs.map(function (e) {
        return '<li><time>' + esc(ctx.fmtDT(e.created_at)) + '</time> ' + esc(e.title) + (e.actor ? ' <span class="portal-muted">· ' + esc(e.actor) + '</span>' : '') + (e.detail ? '<div class="portal-muted ad-det">' + esc(e.detail) + '</div>' : '') + '</li>'; }).join('') + '</ul></section></div></div>';
    var box = view.querySelector('#ad-msgs'); if (box) box.scrollTop = box.scrollHeight;
    var m = view.querySelector('#ad-m');
    var f = view.querySelector('#ad-f');
    if (f) {
      var x = f.querySelector('textarea');
      x.onkeydown = function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) f.requestSubmit(); };
      f.onsubmit = async function (ev) {
        ev.preventDefault(); if (!x.value.trim()) return;
        var bt = f.querySelector('button'); bt.disabled = true; bt.textContent = 'A IA está pensando…';
        box.insertAdjacentHTML('beforeend', '<div class="ad-msg ad-msg--admin"><span class="ad-msg__q">Você</span><p>' + esc(x.value) + '</p></div>');
        try { await call(ctx, { action: 'message', id: id, text: x.value }); ctx.route(); }
        catch (e) { bt.disabled = false; bt.textContent = 'Enviar'; msg(m, errMsg(e), 'error'); }
      };
    }
    function acao(sel, fn) { var el = view.querySelector(sel); if (el) el.onclick = async function () { el.disabled = true; try { await fn(el); ctx.route(); } catch (e) { el.disabled = false; msg(m, errMsg(e), 'error'); } }; }
    acao('#ad-gerar', function () { return call(ctx, { action: 'generate', id: id }); });
    acao('#ad-desc', function () { if (!confirm('Descartar? A branch de teste é apagada e nada é publicado.')) return Promise.reject(new Error('Cancelado.')); return call(ctx, { action: 'discard', id: id }); });
    acao('#ad-pub', function () {
      var c = view.querySelector('#ad-conf');
      if (!c && !confirm('Publicar no site real agora?')) return Promise.reject(new Error('Cancelado.'));
      return call(ctx, { action: 'publish', id: id, confirm: c ? c.value : '' }).then(function (r) { if (r.server_pending) alert('Publicado. Atenção: a parte do servidor ou do banco só passa a valer depois da publicação técnica.'); });
    });
    acao('#ad-undo', function () { if (!confirm('Desfazer? O site volta à versão anterior a esta publicação.')) return Promise.reject(new Error('Cancelado.')); return call(ctx, { action: 'revert', id: id }); });
    var aj = view.querySelector('#ad-aj');
    if (aj) aj.onsubmit = async function (ev) {
      ev.preventDefault(); var bt = aj.querySelector('button'); bt.disabled = true;
      try { await call(ctx, { action: 'feedback', id: id, text: aj.querySelector('textarea').value }); ctx.route(); } catch (e) { bt.disabled = false; msg(m, errMsg(e), 'error'); }
    };
    // acompanha a geração, a publicação e o desfazer sem precisar recarregar
    if (['queued', 'building', 'publishing', 'reverting'].indexOf(b.status) > -1) timer = setTimeout(function () { if (ERoute.get().indexOf('id=' + id) > -1) ctx.route(); }, 8000);
  }

  function acoes(esc, b, p, sens, files, prUrl) {
    var h = '<section class="portal-card ad-acoes"><h2 class="portal-h2">' + ({ chatting: 'Gerar', failed: 'Gerar de novo', queued: 'Gerando', building: 'Gerando', preview: 'Testar e publicar', publishing: 'Publicando', published: 'Publicado', reverting: 'Desfazendo', reverted: 'Desfeito', discarded: 'Descartado' }[b.status] || '') + '</h2>';
    if (b.error && ['chatting', 'failed', 'preview', 'published'].indexOf(b.status) > -1) h += '<p class="portal-alert portal-alert--error">' + esc(b.error) + (b.run_url ? ' <a href="' + esc(b.run_url) + '" target="_blank" rel="noopener">Ver o log</a>' : '') + '</p>';
    if (b.status === 'chatting' || b.status === 'failed') {
      h += '<p class="portal-muted">A IA escreve o código numa branch de teste (' + esc(b.branch || 'addon/…') + '), roda os testes e prepara a prévia. O site real não muda.</p>' +
        '<div class="portal-btn-row"><button class="btn btn--gold" id="ad-gerar" type="button"' + (p.summary ? '' : ' disabled') + '>Gerar na branch de teste</button><button class="btn btn--ghost btn--sm" id="ad-desc" type="button">Descartar</button></div>';
    } else if (b.status === 'queued' || b.status === 'building') {
      h += '<p><span class="ad-spin" aria-hidden="true"></span> ' + (b.status === 'queued' ? 'Na fila do GitHub…' : 'A IA está programando e testando…') + ' Isto costuma levar de 5 a 30 minutos; você pode sair da página.</p>' + (b.run_url ? '<p><a href="' + esc(b.run_url) + '" target="_blank" rel="noopener">Acompanhar no GitHub</a></p>' : '');
    } else if (b.status === 'preview') {
      h += (b.preview_url ? '<p><a class="btn btn--navy" href="' + esc(b.preview_url) + '" target="_blank" rel="noopener">Abrir a prévia</a></p><p class="portal-muted" style="font-size:.85rem">A prévia usa os dados reais do sistema: teste sem apagar nem enviar nada para clientes.</p>'
        : '<p class="portal-alert portal-alert--info">Sem link de prévia (falta configurar a prévia). Confira as mudanças no GitHub' + (prUrl ? ': <a href="' + esc(prUrl) + '" target="_blank" rel="noopener">ver mudanças</a>' : '') + '.</p>') +
        (b.summary ? '<h3 class="ad-h3">O que a IA fez</h3><p class="ad-sum">' + esc(b.summary) + '</p>' : '') +
        '<details><summary>' + files.length + ' arquivo(s) mudado(s)' + (prUrl ? '' : '') + '</summary><ul class="ad-files">' + files.map(function (f) { return '<li><code>' + esc(f) + '</code></li>'; }).join('') + '</ul>' + (prUrl ? '<p><a href="' + esc(prUrl) + '" target="_blank" rel="noopener">Ver as mudanças linha a linha no GitHub</a></p>' : '') + '</details>' +
        (sens.length ? '<div class="portal-alert portal-alert--error ad-sens"><strong>Área sensível:</strong> ' + esc([].concat.apply([], sens.map(function (s) { return [s.area]; })).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '.' +
          (sens.some(function (s) { return s.servidor; }) ? ' A parte do servidor ou do banco só passa a valer depois da publicação técnica.' : '') +
          '<label for="ad-conf" style="display:block;margin-top:.5rem">Para publicar, digite PUBLICAR</label><input id="ad-conf" autocomplete="off" style="max-width:12rem"></div>' : '') +
        '<div class="portal-btn-row"><button class="btn btn--gold" id="ad-pub" type="button"' + (files.length ? '' : ' disabled') + '>Aprovar e publicar</button><button class="btn btn--ghost btn--sm" id="ad-desc" type="button">Descartar</button></div>' +
        '<form id="ad-aj" class="ad-aj"><label for="ad-ajx">Pedir ajuste</label><textarea id="ad-ajx" rows="3" minlength="3" maxlength="4000" required placeholder="O que mudar na prévia…"></textarea><button class="btn btn--ghost btn--sm" type="submit">Pedir ajuste e gerar de novo</button></form>';
    } else if (b.status === 'publishing' || b.status === 'reverting') {
      h += '<p><span class="ad-spin" aria-hidden="true"></span> ' + (b.status === 'publishing' ? 'Publicando…' : 'Voltando o site à versão anterior…') + '</p>';
    } else if (b.status === 'published') {
      h += '<p>Publicado por ' + esc(b.approved_by || '') + '. O site atualiza em alguns minutos.</p>' +
        (b.kind === 'addon' && b.product_code ? '<p class="portal-alert portal-alert--info">O add-on entrou escondido na loja. Defina o preço e coloque à venda em <a href="#/pagamentos?tab=loja">Pagamentos › Loja online</a>; aí ele aparece na página Add-ons dos clientes.</p>' : '') +
        '<div class="portal-btn-row"><button class="btn btn--ghost" id="ad-undo" type="button">Desfazer</button></div>';
    } else if (b.status === 'reverted') {
      h += '<p>O site voltou à versão anterior.' + (b.product_code ? ' O add-on foi escondido na loja.' : '') + '</p>';
    } else if (b.status === 'discarded') {
      h += '<p>Descartado. Nada foi publicado.</p>';
    }
    return h + '</section>';
  }

  window.EAddonsAdmin = { render: render };
})();
