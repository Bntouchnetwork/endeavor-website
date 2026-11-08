/* Marketing agent — Instagram studio (admin): the AI plans posts, carousels and stories (topic, art, caption, hashtags, date),
   the admin approves, the art is rendered here with the Endeavor brand and the post is published at its time.
   Comments and DMs are answered by the agent. Server side: supabase function "ig-agent". */
(function () {
  'use strict';
  var W = 1080, H_POST = 1350, H_STORY = 1920;
  var PAL = {
    navy: { bg: '#0b1f3a', bg2: '#12305a', ink: '#ffffff', muted: '#b9c5d6', accent: '#c8a45d', line: 'rgba(200,164,93,.45)', card: 'rgba(255,255,255,.06)' },
    cream: { bg: '#f6f1e7', bg2: '#efe6d3', ink: '#0b1f3a', muted: '#4a5568', accent: '#a8833a', line: 'rgba(11,31,58,.18)', card: 'rgba(11,31,58,.05)' },
    gold: { bg: '#c8a45d', bg2: '#b8934c', ink: '#0b1f3a', muted: '#22324a', accent: '#0b1f3a', line: 'rgba(11,31,58,.3)', card: 'rgba(255,255,255,.18)' }
  };
  var SERIF = '"Source Serif 4", Georgia, serif', SANS = 'Inter, system-ui, Arial, sans-serif';
  var ST = { pending: 'Aguardando aprovação', approved: 'Agendado', published: 'Publicado', failed: 'Falhou', rejected: 'Rejeitado' };
  var FMT = { post: 'Post', carousel: 'Carrossel', story: 'Story', reel: 'Reel' };
  var DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var ERR = { no_ai_key: 'A IA ainda não está configurada (chave da Anthropic no Supabase).', ai_format: 'A IA respondeu num formato inesperado. Tente de novo.', instagram_not_connected: 'O Instagram ainda não está conectado (veja Configurações).',
    not_approved: 'Aprove o post antes de publicar.', no_art: 'A arte ainda não foi gerada. Aprove o post de novo.', video_not_configured: 'Os vídeos ficam disponíveis quando as chaves do Creatomate, ElevenLabs e HeyGen estiverem no Supabase.' };

  async function call(ctx, payload) {
    var sess = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/ig-agent', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (sess ? sess.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  }
  function errMsg(ctx, e) { var m = (e && e.message) || String(e); return ERR[m] || ctx.errText(e); }

  /* ---------------- art renderer (canvas) ---------------- */
  function wrap(c, text, maxW) {
    var words = String(text || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  // biggest font size (down to min) that fits the text in maxLines
  function fit(c, text, font, size, min, maxW, maxLines) {
    var s = size, lines;
    do { c.font = font.replace('{s}', s); lines = wrap(c, text, maxW); if (lines.length <= maxLines) break; s -= 4; } while (s > min);
    return { size: s, lines: lines.slice(0, maxLines) };
  }
  function drawLines(c, lines, x, y, lh) { lines.forEach(function (l, i) { c.fillText(l, x, y + i * lh); }); return y + lines.length * lh; }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function renderSlide(post, i, handle) {
    var d = post.design || {}, slides = d.slides || [], s = slides[i] || {}, p = PAL[d.palette] || PAL.navy;
    var story = post.format === 'story', H = story ? H_STORY : H_POST, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), M = 96, maxW = W - M * 2, last = i === slides.length - 1, multi = slides.length > 1;
    // background
    var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, p.bg); g.addColorStop(1, p.bg2); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = p.line; c.lineWidth = 2; c.globalAlpha = .35; c.beginPath(); c.arc(W - 40, story ? 380 : 260, 300, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(W - 40, story ? 380 : 260, 220, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    // brand
    var top = story ? 170 : 110;
    c.fillStyle = p.accent; c.fillRect(M, top - 34, 46, 6); c.fillRect(M, top - 20, 46, 6); c.fillStyle = p.ink; c.fillRect(M, top - 6, 46, 6);
    c.textBaseline = 'alphabetic'; c.fillStyle = p.accent; c.font = '600 34px ' + SERIF; c.fillText('ENDEAVOR', M + 64, top - 8);
    c.fillStyle = p.muted; c.font = '500 15px ' + SANS; c.fillText('B U S I N E S S   S O L U T I O N S', M + 66, top + 14);
    if (multi) { c.font = '600 26px ' + SANS; c.fillStyle = p.muted; var cnt = (i + 1) + '/' + slides.length; c.fillText(cnt, W - M - c.measureText(cnt).width, top - 4); }
    // content area (drawn once to measure, then centred vertically between the brand and the footer)
    var y0 = story ? 430 : 300, bottom = H - (story ? 300 : 170), y;
    function content(c) {
    y = y0;
    var tpl = s.template || 'statement';
    function kicker() { if (!s.kicker) return; c.fillStyle = p.accent; c.font = '600 28px ' + SANS; var k = s.kicker.toUpperCase().split('').join(String.fromCharCode(8202)); c.fillText(k, M, y); y += 64; }
    function title(size, lines) { c.fillStyle = p.ink; var f = fit(c, s.title, '600 {s}px ' + SERIF, size, 52, maxW, lines); y = drawLines(c, f.lines, M, y + f.size * .8, f.size * 1.12) + 20; }
    function body(size) { if (!s.body) return; c.fillStyle = p.muted; var f = fit(c, s.body, '400 {s}px ' + SANS, size, 28, maxW, 6); y = drawLines(c, f.lines, M, y + f.size, f.size * 1.4) + 10; }
    if (tpl === 'stat') {
      kicker(); c.fillStyle = p.accent; var fs = fit(c, s.stat || '', '600 {s}px ' + SERIF, 300, 120, maxW, 1); c.font = '600 ' + fs.size + 'px ' + SERIF; c.fillText(fs.lines[0] || '', M - 6, y + fs.size * .82); y += fs.size + 40;
      title(70, 3); body(38);
    } else if (tpl === 'list') {
      kicker(); title(84, 3); y += 20;
      (s.bullets || []).forEach(function (b, n) {
        c.fillStyle = p.accent; c.beginPath(); c.arc(M + 30, y + 26, 30, 0, Math.PI * 2); c.fill();
        c.fillStyle = p.bg; c.font = '600 30px ' + SANS; var nn = String(n + 1); c.fillText(nn, M + 30 - c.measureText(nn).width / 2, y + 37);
        c.fillStyle = p.ink; var f = fit(c, b, '500 {s}px ' + SANS, 40, 30, maxW - 90, 2); drawLines(c, f.lines, M + 86, y + 38, f.size * 1.3);
        y += Math.max(84, f.lines.length * f.size * 1.3 + 34);
      });
    } else if (tpl === 'compare') {
      kicker(); title(78, 3); y += 24;
      var colW = (maxW - 24) / 2;
      [[s.left || 'Brasil', M], [s.right || 'EUA', M + colW + 24]].forEach(function (h, k) {
        c.fillStyle = k ? p.accent : p.card; roundRect(c, h[1], y, colW, 74, 16); c.fill();
        c.fillStyle = k ? p.bg : p.ink; c.font = '600 32px ' + SANS; c.fillText(h[0], h[1] + 26, y + 48);
      });
      y += 100;
      (s.rows || []).forEach(function (r) {
        c.font = '400 34px ' + SANS; var a = wrap(c, r[0], colW - 30).slice(0, 2), b2 = wrap(c, r[1], colW - 30).slice(0, 2), rh = Math.max(a.length, b2.length) * 44 + 34;
        c.fillStyle = p.muted; drawLines(c, a, M + 26, y + 44, 44);
        c.fillStyle = p.ink; c.font = '600 34px ' + SANS; drawLines(c, b2, M + colW + 50, y + 44, 44);
        c.strokeStyle = p.line; c.lineWidth = 2; c.beginPath(); c.moveTo(M, y + rh); c.lineTo(W - M, y + rh); c.stroke(); y += rh + 6;
      });
    } else if (tpl === 'quote') {
      c.fillStyle = p.accent; c.font = '600 220px ' + SERIF; c.fillText('“', M - 10, y + 150); y += 170;
      c.fillStyle = p.ink; var fq = fit(c, s.title, 'italic 500 {s}px ' + SERIF, 76, 48, maxW, 7); y = drawLines(c, fq.lines, M, y + fq.size, fq.size * 1.2) + 30;
      c.fillStyle = p.accent; c.fillRect(M, y, 60, 4); c.fillStyle = p.muted; c.font = '500 30px ' + SANS; c.fillText(s.body || 'Endeavor Business Solutions', M + 80, y + 12);
    } else if (tpl === 'cta') {
      kicker(); title(92, 4); body(40); y += 40;
      var label = s.bullets && s.bullets[0] ? s.bullets[0] : (post.language === 'en' ? 'Link in bio' : post.language === 'es' ? 'Enlace en la bio' : 'Link na bio');
      c.font = '600 36px ' + SANS; var bw = c.measureText(label).width + 100; c.fillStyle = p.accent; roundRect(c, M, y, bw, 92, 46); c.fill(); c.fillStyle = p.bg; c.fillText(label, M + 50, y + 58);
    } else { kicker(); title(story ? 104 : 96, 6); body(40); }
    return y;
    }
    var scratch = document.createElement('canvas').getContext('2d'); var endY = content(scratch);
    var off = Math.max(0, Math.min((bottom - endY) / 2, story ? 260 : 160));
    c.save(); c.translate(0, off); content(c); c.restore();
    // footer
    c.strokeStyle = p.line; c.lineWidth = 2; c.beginPath(); c.moveTo(M, bottom + 40); c.lineTo(W - M, bottom + 40); c.stroke();
    c.font = '600 28px ' + SANS; c.fillStyle = p.ink; c.fillText(handle || '@endeavorbiz', M, bottom + 96);
    c.fillStyle = p.muted; c.font = '500 26px ' + SANS;
    var right = multi && !last ? (post.language === 'en' ? 'Swipe →' : post.language === 'es' ? 'Desliza →' : 'Arraste →') : 'endeavorbiz.com';
    c.fillText(right, W - M - c.measureText(right).width, bottom + 96);
    return cv;
  }
  async function fontsReady() { try { await Promise.all(['600 80px "Source Serif 4"', 'italic 500 60px "Source Serif 4"', '400 40px Inter', '500 40px Inter', '600 40px Inter'].map(function (f) { return document.fonts.load(f); })); } catch (e) { /* fallback fonts */ } }
  function thumb(post, handle, i) { var cv = renderSlide(post, i || 0, handle); cv.className = 'ig-art'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', ((post.design.slides || [])[i || 0] || {}).title || post.hook || 'Arte'); return cv; }
  async function uploadArt(ctx, post, handle) {
    var urls = [], n = (post.design.slides || []).length || 1, stamp = Date.now();
    for (var i = 0; i < n; i++) {
      var blob = await new Promise(function (res) { renderSlide(post, i, handle).toBlob(res, 'image/jpeg', .92); });
      var path = 'ig/' + post.id + '/' + stamp + '-' + (i + 1) + '.jpg';
      var up = await ctx.sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw up.error;
      urls.push(ctx.sb.storage.from('media').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

  /* ---------------- page ---------------- */
  function localInput(iso) { if (!iso) return ''; var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
  async function view(el, ctx) {
    var sb = ctx.sb, esc = ctx.esc, tab = (ERoute.get().match(/[?&]tab=(\w+)/) || [])[1] || 'fila';
    el.innerHTML = '<p class="portal-muted">Carregando…</p>';
    await fontsReady();
    var res = await Promise.all([sb.from('ig_settings').select('*').eq('id', 1).maybeSingle(), call(ctx, { action: 'status' }).catch(function () { return {}; }),
      sb.from('ig_posts').select('*').order('scheduled_at', { ascending: true, nullsFirst: false }).limit(200), sb.from('ig_inbox').select('*').order('created_at', { ascending: false }).limit(60)]);
    if (res[0].error && /ig_settings|relation/.test(res[0].error.message || '')) { el.innerHTML = '<div class="portal-alert portal-alert--info" style="display:block">O Agente de Marketing está quase pronto: falta aplicar a atualização do banco de dados.</div>'; return; }
    var cfg = res[0].data || {}, st = res[1] || {}, posts = res[2].data || [], inbox = res[3].data || [], handle = cfg.handle || '@endeavorbiz';
    var by = function (f) { return posts.filter(f); };
    var lists = { fila: by(function (p) { return p.status === 'pending'; }), agenda: by(function (p) { return p.status === 'approved'; }), publicados: by(function (p) { return p.status === 'published' || p.status === 'failed'; }).reverse() };
    var chip = function (ok, a, b) { return '<span class="pill ' + (ok ? 'pill--ok' : 'pill--warn') + '">' + (ok ? a : b) + '</span>'; };
    var tabs = [['fila', 'Para aprovar', lists.fila.length], ['agenda', 'Agendados', lists.agenda.length], ['publicados', 'Publicados', lists.publicados.length], ['inbox', 'Comentários e directs', inbox.filter(function (x) { return x.status === 'handoff' || x.status === 'failed'; }).length], ['config', 'Configurações', 0]];
    el.innerHTML = '<div class="console__head"><div><h1>Instagram</h1><p class="portal-muted">O Agente de Marketing pesquisa o que está em alta, cria posts, carrosséis e stories com arte e legenda, e responde comentários e directs.</p></div>' +
      '<div class="portal-btn-row"><button class="btn btn--gold btn--xs" type="button" id="ig-plan">✦ Planejar com IA</button></div></div>' +
      '<p class="mk-status">' + chip(st.ai, 'IA ativa', 'IA não configurada') + ' ' + chip(st.instagram, 'Instagram conectado', 'Instagram: aguardando conexão com a Meta') + ' ' + chip(st.webhook, 'Respostas automáticas ligadas', 'Respostas: aguardando webhook') + ' ' +
        chip(st.video && st.video.creatomate && st.video.elevenlabs, 'Vídeos prontos', 'Vídeos: aguardando chaves') + '</p>' +
      '<nav class="subtabs" aria-label="Instagram">' + tabs.map(function (t) { return '<a href="#/instagram?tab=' + t[0] + '"' + (tab === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + (t[2] ? ' <span class="crm-next__n">' + t[2] + '</span>' : '') + '</a>'; }).join('') + '</nav><div id="ig-body"></div>';
    var body = ctx.$('#ig-body');
    function route() { view(el, ctx); }
    ctx.$('#ig-plan').onclick = function () { planModal(ctx, cfg, function () { if (/tab=fila|^#\/instagram$/.test(ERoute.get())) route(); else ERoute.set('#/instagram?tab=fila'); }); };
    if (tab === 'inbox') return inboxView(body, ctx, inbox);
    if (tab === 'config') return configView(body, ctx, cfg, st);
    var list = lists[tab] || lists.fila;
    if (!list.length) { body.innerHTML = '<div class="empty-state"><p class="empty">' + (tab === 'fila' ? 'Nada para aprovar. Clique em "✦ Planejar com IA" para o agente criar os próximos posts.' : tab === 'agenda' ? 'Nenhum post agendado.' : 'Nenhum post publicado ainda.') + '</p></div>'; return; }
    body.innerHTML = '<div class="ig-grid">' + list.map(function (p) {
      return '<article class="ig-card" data-id="' + p.id + '" tabindex="0"><div class="ig-card__art ig-card__art--' + p.format + '" data-art="' + p.id + '"></div><div class="ig-card__meta"><span class="pill">' + FMT[p.format] + ((p.design.slides || []).length > 1 ? ' · ' + p.design.slides.length : '') + '</span> ' +
        '<span class="badge badge--' + (p.status === 'published' ? 'client' : p.status === 'failed' ? 'lost' : p.status === 'approved' ? 'qualified' : 'new') + '">' + ST[p.status] + '</span>' +
        '<strong>' + esc(p.hook || p.topic || '') + '</strong><span class="portal-muted">' + (p.scheduled_at ? esc(DAYS[new Date(p.scheduled_at).getDay()] + ', ' + ctx.fmtDT(p.scheduled_at)) : 'Sem data') + '</span>' + (p.error ? '<span class="ig-err">' + esc(p.error) + '</span>' : '') + '</div></article>';
    }).join('') + '</div>';
    list.forEach(function (p) { var box = body.querySelector('[data-art="' + p.id + '"]'); if (box) box.appendChild(thumb(p, handle, 0)); });
    body.querySelectorAll('.ig-card').forEach(function (el) { var go = function () { editor(ctx, posts.find(function (x) { return x.id === el.dataset.id; }), cfg, st, function () { route(); }); }; el.onclick = go; el.onkeydown = function (e) { if (e.key === 'Enter') go(); }; });
    var q = (ERoute.get().match(/[?&]id=([0-9a-f-]{36})/) || [])[1]; if (q) { var pq = posts.find(function (x) { return x.id === q; }); if (pq) editor(ctx, pq, cfg, st, route); }
  }

  function planModal(ctx, cfg, done) {
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">✦ Planejar com IA</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<p class="portal-muted">O agente pesquisa o que está em alta no nicho e nas hashtags, escolhe os temas, cria a arte e a legenda e sugere o dia e o horário. Tudo cai em "Para aprovar".</p>' +
      '<form class="portal-form" id="igp-f" novalidate><div class="portal-grid2"><div class="field"><label for="igp-n">Posts e carrosséis</label><input id="igp-n" type="number" min="1" max="10" value="' + (cfg.posts_per_week || 4) + '"></div>' +
      '<div class="field"><label for="igp-s">Stories</label><input id="igp-s" type="number" min="0" max="10" value="' + (cfg.stories_per_week == null ? 3 : cfg.stories_per_week) + '"></div></div>' +
      '<div class="field"><label for="igp-f2">Foco desta vez (opcional)</label><input id="igp-f2" maxlength="300" placeholder="Ex.: dolarização e proteção patrimonial; lançamento do Programa de Parceiros"></div>' +
      '<div class="portal-alert" id="igp-m" role="status"></div><button class="btn btn--navy" type="submit">Criar plano</button></form>');
    ctx.$('#igp-f', o).onsubmit = async function (e) {
      e.preventDefault(); var b = this.querySelector('button'), m = ctx.$('#igp-m', o); b.disabled = true; b.textContent = 'Pesquisando e criando… (1 a 3 minutos)';
      ctx.msg(m, 'O agente está pesquisando tendências e escrevendo os posts. Pode deixar esta janela aberta.', 'info');
      try { var r = await call(ctx, { action: 'plan', posts: +ctx.$('#igp-n', o).value, stories: +ctx.$('#igp-s', o).value, focus: ctx.$('#igp-f2', o).value.trim() }); ctx.closeOverlay(); ctx.toast && ctx.toast(r.created + ' itens criados.'); done(); }
      catch (er) { b.disabled = false; b.textContent = 'Criar plano'; ctx.msg(m, errMsg(ctx, er), 'error'); }
    };
  }

  function editor(ctx, p, cfg, st, done) {
    var esc = ctx.esc, sb = ctx.sb, handle = cfg.handle || '@endeavorbiz', slides = (p.design && p.design.slides) || [];
    var fld = function (k, i, label, val, area) { return '<div class="field"><label>' + label + '</label>' + (area ? '<textarea data-s="' + i + '" data-k="' + k + '" rows="2">' + esc(val || '') + '</textarea>' : '<input data-s="' + i + '" data-k="' + k + '" value="' + esc(val || '') + '">') + '</div>'; };
    var o = ctx.openOverlay('<div class="drawer__head"><div><h2 class="portal-h2" style="margin:0">' + FMT[p.format] + ' · ' + esc(ST[p.status]) + '</h2><p class="portal-muted" style="margin:0">' + esc(p.topic || '') + '</p></div><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<div class="ig-strip" id="ige-strip"></div>' +
      (p.research ? '<details class="ig-why"><summary>Por que o agente escolheu este tema</summary><p>' + esc(p.research).replace(/\n/g, '<br>') + '</p></details>' : '') +
      '<form class="portal-form" id="ige-f" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="ige-when">Publicar em</label><input id="ige-when" type="datetime-local" value="' + localInput(p.scheduled_at) + '"></div>' +
      '<div class="field"><label for="ige-pal">Cores da arte</label><select id="ige-pal"><option value="navy">Azul-marinho</option><option value="cream">Creme</option><option value="gold">Dourado</option></select></div></div>' +
      '<div class="field"><label for="ige-cap">Legenda</label><textarea id="ige-cap" rows="7">' + esc(p.caption || '') + '</textarea></div>' +
      '<div class="field"><label for="ige-tags">Hashtags</label><input id="ige-tags" value="' + esc((p.hashtags || []).join(' ')) + '"></div>' +
      '<details class="ig-slides"><summary>Editar os textos da arte (' + slides.length + ' ' + (slides.length > 1 ? 'telas' : 'tela') + ')</summary>' + slides.map(function (s, i) {
        return '<fieldset class="ig-slide"><legend>Tela ' + (i + 1) + ' · ' + esc(s.template) + '</legend>' + fld('kicker', i, 'Chamada', s.kicker) + fld('title', i, 'Título', s.title, true) + (s.template === 'stat' ? fld('stat', i, 'Número', s.stat) : '') +
          (s.body || s.template === 'statement' || s.template === 'cta' || s.template === 'stat' ? fld('body', i, 'Texto', s.body, true) : '') + (s.bullets && s.bullets.length ? fld('bullets', i, 'Itens (um por linha)', s.bullets.join('\n'), true) : '') + '</fieldset>';
      }).join('') + '</details>' +
      (p.video && p.video.script ? '<details class="ig-why"><summary>Roteiro de Reel sugerido</summary><p>' + esc(p.video.script).replace(/\n/g, '<br>') + '</p><button class="btn btn--ghost btn--xs" type="button" id="ige-video">Gerar vídeo</button></details>' : '') +
      '<div class="field ig-redo"><label for="ige-fb">Pedir ajuste para a IA</label><div class="ig-redo__row"><input id="ige-fb" maxlength="500" placeholder="Ex.: gancho mais forte, mais curto, troque para carrossel comparando Brasil x EUA"><button class="btn btn--ghost btn--xs" type="button" id="ige-redo">✦ Refazer</button></div></div>' +
      '<div class="portal-alert" id="ige-m" role="alert"></div>' +
      '<div class="portal-btn-row">' + (p.status === 'published' ? (p.ig_permalink ? '<a class="btn btn--ghost" href="' + esc(p.ig_permalink) + '" target="_blank" rel="noopener">Ver no Instagram</a>' : '') :
        '<button class="btn btn--navy" type="submit">' + (p.status === 'approved' ? 'Salvar' : 'Aprovar e agendar') + '</button>' + (p.status === 'approved' || p.status === 'failed' ? '<button class="btn btn--gold" type="button" id="ige-now">Publicar agora</button><button class="btn btn--ghost" type="button" id="ige-back">Voltar para aprovação</button>' : '') +
        '<button class="btn btn--ghost" type="button" id="ige-save">Salvar rascunho</button><button class="btn btn--ghost btn--danger-text" type="button" id="ige-rej">Rejeitar</button>') + '</div></form>', true);
    ctx.$('#ige-pal', o).value = (p.design && p.design.palette) || 'navy';
    var strip = ctx.$('#ige-strip', o);
    function collect() {
      var d = JSON.parse(JSON.stringify(p.design || {})); d.palette = ctx.$('#ige-pal', o).value;
      o.querySelectorAll('[data-s]').forEach(function (el) { var s = d.slides[+el.dataset.s]; if (!s) return; s[el.dataset.k] = el.dataset.k === 'bullets' ? el.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : el.value.trim(); });
      var when = ctx.$('#ige-when', o).value;
      return { design: d, caption: ctx.$('#ige-cap', o).value.trim(), hashtags: ctx.$('#ige-tags', o).value.split(/[\s,]+/).map(function (h) { return h.trim(); }).filter(Boolean).map(function (h) { return h.charAt(0) === '#' ? h : '#' + h; }).slice(0, 30),
        scheduled_at: when ? new Date(when).toISOString() : null, updated_at: new Date().toISOString() };
    }
    function paint() { strip.innerHTML = ''; var tmp = Object.assign({}, p, collect()); (tmp.design.slides || []).forEach(function (s, i) { strip.appendChild(thumb(tmp, handle, i)); }); }
    paint(); o.querySelectorAll('#ige-f input, #ige-f textarea, #ige-f select').forEach(function (el) { if (el.id !== 'ige-fb') el.addEventListener('change', paint); });
    var m = ctx.$('#ige-m', o);
    async function save(extra, label, btn) {
      var row = Object.assign(collect(), extra || {}); if (btn) btn.disabled = true;
      try {
        if (row.status === 'approved') {
          if (!row.scheduled_at) throw new Error('Escolha o dia e o horário.');
          ctx.msg(m, 'Gerando a arte…', 'info'); row.image_urls = await uploadArt(ctx, Object.assign({}, p, row), handle);
        }
        var r = await sb.from('ig_posts').update(row).eq('id', p.id).select('*').single(); if (r.error) throw r.error;
        Object.assign(p, r.data); ctx.msg(m, label, 'ok'); if (btn) btn.disabled = false; return true;
      } catch (e) { if (btn) btn.disabled = false; ctx.msg(m, e.message && !/^[a-z_]+$/.test(e.message) ? e.message : errMsg(ctx, e), 'error'); return false; }
    }
    var f = ctx.$('#ige-f', o);
    f.onsubmit = async function (e) { e.preventDefault(); if (await save({ status: 'approved', error: null }, 'Aprovado e agendado.', f.querySelector('button[type=submit]'))) { ctx.closeOverlay(); done(); } };
    if (ctx.$('#ige-save', o)) ctx.$('#ige-save', o).onclick = async function () { if (await save(null, 'Salvo.', this)) done(); };
    if (ctx.$('#ige-rej', o)) ctx.$('#ige-rej', o).onclick = async function () { if (await save({ status: 'rejected' }, 'Rejeitado.', this)) { ctx.closeOverlay(); done(); } };
    if (ctx.$('#ige-back', o)) ctx.$('#ige-back', o).onclick = async function () { if (await save({ status: 'pending' }, 'Voltou para aprovação.', this)) { ctx.closeOverlay(); done(); } };
    if (ctx.$('#ige-now', o)) ctx.$('#ige-now', o).onclick = async function () {
      var b = this; b.disabled = true; ctx.msg(m, 'Publicando…', 'info');
      try { if (p.status !== 'approved') { if (!(await save({ status: 'approved', scheduled_at: new Date().toISOString() }, 'Aprovado.', null))) { b.disabled = false; return; } } await call(ctx, { action: 'publish_now', id: p.id }); ctx.closeOverlay(); done(); }
      catch (e) { b.disabled = false; ctx.msg(m, errMsg(ctx, e), 'error'); }
    };
    ctx.$('#ige-redo', o).onclick = async function () {
      var b = this, fb = ctx.$('#ige-fb', o).value.trim(); if (fb.length < 3) return ctx.msg(m, 'Escreva o que a IA deve mudar.', 'error');
      b.disabled = true; b.textContent = 'Refazendo…';
      try { await call(ctx, { action: 'redo', id: p.id, feedback: fb }); ctx.closeOverlay(); var r = await sb.from('ig_posts').select('*').eq('id', p.id).single(); editor(ctx, r.data, cfg, st, done); done(); }
      catch (e) { b.disabled = false; b.textContent = '✦ Refazer'; ctx.msg(m, errMsg(ctx, e), 'error'); }
    };
    if (ctx.$('#ige-video', o)) ctx.$('#ige-video', o).onclick = function () { ctx.msg(m, ERR.video_not_configured, 'info'); };
  }

  function inboxView(body, ctx, rows) {
    var esc = ctx.esc, SL = { new: 'Nova', replied: 'Respondida pela IA', handoff: 'Pediu a equipe', ignored: 'Ignorada (spam)', failed: 'Falhou' };
    body.innerHTML = rows.length ? '<ul class="list ig-inbox">' + rows.map(function (x) {
      return '<li><div class="list__main"><strong>' + (x.kind === 'dm' ? 'Direct' : 'Comentário') + (x.username ? ' · @' + esc(x.username) : '') + ' <span class="portal-muted" style="font-weight:400">' + esc(ctx.fmtDT(x.created_at)) + '</span></strong>' +
        '<span>' + esc(x.text || '') + '</span>' + (x.reply ? '<span class="ig-reply">↳ ' + esc(x.reply) + '</span>' : '') + (x.error ? '<span class="ig-err">' + esc(x.error) + '</span>' : '') + (x.lead_id ? '<a href="#/crm?lead=' + x.lead_id + '">Abrir lead</a>' : '') + '</div>' +
        '<span class="badge badge--' + (x.status === 'replied' ? 'client' : x.status === 'handoff' || x.status === 'failed' ? 'lost' : 'new') + '">' + SL[x.status] + '</span></li>';
    }).join('') + '</ul>' : '<p class="empty">Nenhum comentário ou direct ainda. Quando o Instagram estiver conectado, as interações aparecem aqui e a IA responde sozinha.</p>';
  }

  function configView(body, ctx, cfg, st) {
    var esc = ctx.esc, days = cfg.post_days || [1, 3, 5, 6];
    var hook = (ctx.CFG.functionsUrl || '') + '/ig-agent';
    body.innerHTML = '<div class="ig-config"><section class="portal-card"><h2 class="portal-h2">Agenda e temas</h2><form class="portal-form" id="igc-f" novalidate>' +
      '<div class="portal-grid2"><div class="field"><label for="igc-n">Posts por semana</label><input id="igc-n" type="number" min="1" max="21" value="' + (cfg.posts_per_week || 4) + '"></div>' +
      '<div class="field"><label for="igc-s">Stories por semana</label><input id="igc-s" type="number" min="0" max="21" value="' + (cfg.stories_per_week == null ? 3 : cfg.stories_per_week) + '"></div></div>' +
      '<fieldset class="field"><legend>Dias de postagem</legend><div class="ig-days">' + DAYS.map(function (d, i) { return '<label class="ig-day"><input type="checkbox" value="' + i + '"' + (days.indexOf(i) > -1 ? ' checked' : '') + '><span>' + d + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<div class="portal-grid2"><div class="field"><label for="igc-t">Horário dos posts (Orlando)</label><input id="igc-t" type="time" value="' + esc(String(cfg.post_time || '12:30').slice(0, 5)) + '"></div>' +
      '<div class="field"><label for="igc-h">Perfil</label><input id="igc-h" value="' + esc(cfg.handle || '@endeavorbiz') + '"></div></div>' +
      '<div class="field"><label for="igc-l">Idioma dos posts</label><select id="igc-l"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></div>' +
      '<div class="check-row"><input type="checkbox" id="igc-r"' + (cfg.auto_reply !== false ? ' checked' : '') + '><label for="igc-r">A IA responde comentários e directs sozinha</label></div>' +
      '<div class="check-row"><input type="checkbox" id="igc-a" checked disabled><label for="igc-a">Todo post passa pela sua aprovação antes de publicar</label></div>' +
      '<div class="field"><label for="igc-topics">Temas do agente (um por linha)</label><textarea id="igc-topics" rows="10">' + esc((cfg.topics || []).join('\n')) + '</textarea></div>' +
      '<div class="field"><label for="igc-b">Tom e marca</label><textarea id="igc-b" rows="3">' + esc(cfg.brand_notes || '') + '</textarea></div>' +
      '<div class="portal-alert" id="igc-m" role="alert"></div><button class="btn btn--navy" type="submit">Salvar</button></form></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Conexões</h2><ul class="ig-conn">' +
      '<li>' + (st.instagram ? '✅' : '⏳') + ' <strong>Instagram (Meta)</strong>: conta profissional ligada a uma página do Facebook, com um app na Meta (pode ser o mesmo do WhatsApp) aprovado para publicação, comentários e mensagens. No Supabase (Edge Functions → Secrets): <code>IG_ACCESS_TOKEN</code> e <code>IG_USER_ID</code>.</li>' +
      '<li>' + (st.webhook ? '✅' : '⏳') + ' <strong>Respostas automáticas</strong>: secrets <code>IG_VERIFY_TOKEN</code> e <code>IG_APP_SECRET</code>; webhook na Meta: <code>' + esc(hook) + '</code> (campos comments e messages).</li>' +
      '<li>' + (st.video && st.video.creatomate ? '✅' : '⏳') + ' <strong>Creatomate</strong> (montagem dos vídeos): <code>CREATOMATE_API_KEY</code></li>' +
      '<li>' + (st.video && st.video.elevenlabs ? '✅' : '⏳') + ' <strong>ElevenLabs</strong> (narração): <code>ELEVENLABS_API_KEY</code></li>' +
      '<li>' + (st.video && st.video.heygen ? '✅' : '⏳') + ' <strong>HeyGen</strong> (apresentador): <code>HEYGEN_API_KEY</code></li></ul>' +
      '<p class="portal-muted" style="font-size:.86rem">As chaves são digitadas por você direto no Supabase. Nunca cole chaves no chat.</p></section></div>';
    ctx.$('#igc-l').value = (cfg.languages || ['pt'])[0] || 'pt';
    ctx.$('#igc-f').onsubmit = async function (e) {
      e.preventDefault(); var m = ctx.$('#igc-m');
      var row = { posts_per_week: Math.max(1, Math.min(21, +ctx.$('#igc-n').value || 4)), stories_per_week: Math.max(0, Math.min(21, +ctx.$('#igc-s').value || 0)),
        post_days: Array.prototype.map.call(body.querySelectorAll('.ig-days input:checked'), function (x) { return +x.value; }), post_time: ctx.$('#igc-t').value || '12:30',
        handle: ctx.$('#igc-h').value.trim() || '@endeavorbiz', languages: [ctx.$('#igc-l').value], auto_reply: ctx.$('#igc-r').checked,
        topics: ctx.$('#igc-topics').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 40), brand_notes: ctx.$('#igc-b').value.trim().slice(0, 1000), updated_at: new Date().toISOString() };
      if (!row.post_days.length) return ctx.msg(m, 'Escolha pelo menos um dia.', 'error');
      var r = await ctx.sb.from('ig_settings').update(row).eq('id', 1);
      ctx.msg(m, r.error ? ctx.errText(r.error) : 'Salvo.', r.error ? 'error' : 'ok');
    };
  }

  window.AdminIG = { view: view, renderSlide: renderSlide };
})();
