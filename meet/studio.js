/* Endeavor Web Meeting · AI Presentation Studio (fase 2)
 *
 * Usado no admin e no Portal do Cliente, menu Live Webinar › Apresentações (Studio):
 *   EMeetStudio.render(view, ctx, { scope: 'admin'|'client', clientId? })   lista de apresentações
 *   EMeetStudio.abrir(ctx, id, o)                                         editor em tela cheia
 *
 * O editor prepara a apresentação ANTES da reunião: slides (conteúdo, ordem, duplicar, apagar), roteiro falado e
 * duração de cada slide, configurações (idioma, tom, duração, ritmo, pronúncia), IA pelo HUB (criar, refazer slide,
 * escrever roteiro, importar PDF/PowerPoint), voz autorizada (gravar a própria voz com o termo) e narração por slide,
 * linha do tempo e prévia completa. Publicar congela a versão que a sala usa.
 * Tudo vai pelo servidor (função meet); nenhum provedor de IA é chamado daqui, e nada é simulado: quando a voz não está
 * ligada no HUB, o Studio diz isso e a prévia usa o tempo estimado (ou, se você pedir, a voz do navegador, marcada como tal).
 * Depende de meet/slides.js (NoirApresentacao) e meet/studio.css. PDF e PowerPoint usam meet/vendor/pdf.min.js e jszip.min.js. */
(function () {
  'use strict';
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/meet\/studio\.js.*$/, '') : ''; })();
  var LAYOUTS = [['capa', 'Capa'], ['topicos', 'Tópicos'], ['passos', 'Passos'], ['duas-colunas', 'Duas colunas'], ['numero', 'Número em destaque'], ['citacao', 'Citação'], ['grafico', 'Gráfico de barras'], ['encerramento', 'Encerramento']];
  var IDIOMAS = [['pt-BR', 'Português (Brasil)'], ['en-US', 'Inglês'], ['es-ES', 'Espanhol']];
  var RITMOS = [['calmo', 'Calmo'], ['normal', 'Normal'], ['rapido', 'Rápido']];
  var PPM = { calmo: 130, normal: 150, rapido: 170 };
  var LEITURA = 'Olá, eu sou a pessoa que vai apresentar este webinar. Estou gravando esta amostra com a minha própria voz, em um lugar silencioso, ' +
    'falando no meu ritmo normal. Vou ler este texto com calma, como se estivesse explicando um assunto para um cliente. A Endeavor Business Solutions ' +
    'ajuda empresas a abrir e organizar seus negócios nos Estados Unidos, com atendimento próximo e transparente. Em cada etapa, a gente explica o que ' +
    'vai acontecer, quais documentos são necessários e quanto tempo cada parte costuma levar. Quando surgem dúvidas, a melhor coisa é perguntar. ' +
    'Obrigado por ouvir até aqui; agora vou continuar falando por mais alguns segundos para completar um minuto de gravação.';

  /* ---------------- utilidades ---------------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function palavras(t) { return (String(t || '').match(/\S+/g) || []).length; }
  function estimar(t, ritmo) { var n = palavras(t); return n ? Math.max(3, Math.round(n / (PPM[ritmo] || 150) * 60)) : 0; }
  function mmss(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function novoId(slides) { var i = slides.length + 1, ids = {}; slides.forEach(function (s) { ids[s.id] = 1; }); while (ids['s' + i]) i++; return 's' + i; }
  function api(ctx) {
    return async function (body) {
      var s = (await ctx.sb.auth.getSession()).data.session;
      var r = await fetch(ctx.CFG.functionsUrl + '/meet', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) { var e = new Error(j.erro || 'O servidor do Web Meeting não respondeu.'); e.status = r.status; throw e; }
      return j;
    };
  }
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      if (document.querySelector('script[data-std="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = BASE + src; s.dataset.std = src; s.onload = ok; s.onerror = function () { falha(new Error('Não foi possível carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* ---------------- lista (dentro da aba Web Meeting) ---------------- */
  async function render(view, ctx, o) {
    o = o || {};
    var esc = ctx.esc, admin = o.scope === 'admin', call = api(ctx);
    var empresa = (location.hash.match(/[?&]empresa=([a-z0-9-]+)/) || [])[1] || '';
    view.innerHTML = '<div class="portal-card"><p class="portal-muted">Carregando apresentações…</p></div>';
    var res = await Promise.all([
      call({ acao: 'studio_listar', client_id: admin ? empresa : o.clientId }).catch(function (e) { return { erro: e.message, apresentacoes: [] }; }),
      call({ acao: 'studio_status' }).catch(function () { return { capacidades: {} }; }),
      admin ? ctx.q(ctx.sb.from('meet_access').select('client_id, clients(name)').eq('enabled', true)) : Promise.resolve([])]);
    var lista = res[0].apresentacoes || [], cap = res[1].capacidades || {}, empresas = res[2] || [];
    view.innerHTML = '<div class="console__head"><div><h1>Apresentações</h1><p class="portal-muted">AI Presentation Studio: prepare antes da reunião os slides, o roteiro de cada slide e, se quiser, a narração com a sua própria voz. Depois de publicada, a apresentação abre em qualquer sala da empresa.</p></div>' +
      '<button class="btn btn--navy btn--sm" type="button" id="std-new">＋ Nova apresentação</button></div>' +
      '<div class="std-caps">' + chip('Texto (IA)', cap.texto) + chip('Voz' + (cap.provedor_voz ? ' · ' + esc(cap.provedor_voz) : ''), cap.voz, cap.voz ? '' : 'A voz ainda não está ligada no HUB AI') +
      chip('Imagens', cap.imagens, 'Sem provedor de imagem no HUB') + chip('Vídeo', cap.video, 'Sem provedor de vídeo no HUB') + '</div>' +
      (res[0].erro ? '<div class="portal-alert portal-alert--error">' + esc(res[0].erro) + '</div>' : '') +
      '<div class="portal-alert" id="std-m" role="status"></div>' +
      (admin ? '<div class="toolbar"><label class="sr-only" for="std-emp">Empresa</label><select id="std-emp"><option value="">Todas as empresas</option><option value="endeavor"' + (empresa === 'endeavor' ? ' selected' : '') + '>Endeavor (interna)</option>' + empresas.map(function (e) { return '<option value="' + e.client_id + '"' + (empresa === e.client_id ? ' selected' : '') + '>' + esc(e.clients ? e.clients.name : '') + '</option>'; }).join('') + '</select></div>' : '') +
      (lista.length ? '<div class="table-wrap portal-card"><table class="data"><thead><tr><th>Apresentação</th>' + (admin ? '<th>Empresa</th>' : '') + '<th class="num">Slides</th><th>Situação</th><th>Atualizada</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        lista.map(function (a) {
          return '<tr><td><strong>' + esc(a.titulo) + '</strong></td>' + (admin ? '<td>' + esc(a.empresa) + '</td>' : '') + '<td class="num">' + a.slides + '</td><td>' +
            (a.status === 'published' ? '<span class="pill pill--report">Publicada v' + a.published_version + '</span>' + (a.published_version !== a.version ? ' <span class="portal-muted" style="font-size:.82rem">com alterações não publicadas</span>' : '') : '<span class="pill">Rascunho</span>') +
            '</td><td>' + esc(ctx.fmtDT(a.updated_at)) + '</td><td><div class="portal-btn-row"><button class="btn btn--gold btn--xs" type="button" data-ed="' + a.id + '">Editar</button>' +
            '<button class="btn btn--ghost btn--xs" type="button" data-dup="' + a.id + '">Duplicar</button><button class="btn btn--ghost btn--xs" type="button" data-del="' + a.id + '">Apagar</button></div></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="portal-card empty-state"><p>Nenhuma apresentação ainda. Clique em “Nova apresentação” e descreva o assunto: a IA monta os slides e o roteiro, e você revisa.</p></div>');
    function chip(nome, on, dica) { return '<span class="std-chip ' + (on ? 'on' : 'off') + '"' + (dica && !on ? ' title="' + esc(dica) + '"' : '') + '>' + (on ? '● ' : '○ ') + nome + (on ? '' : ': não ligado') + '</span>'; }
    var m = view.querySelector('#std-m');
    var recarregar = function () { render(view, ctx, o); };
    if (view.querySelector('#std-emp')) view.querySelector('#std-emp').onchange = function () { location.hash = (o.hashBase || '#/webinar?aba=studio') + (this.value ? '&empresa=' + this.value : ''); };
    view.querySelector('#std-new').onclick = function () { nova(ctx, o, empresas, function (id) { abrir(ctx, id, { aoFechar: recarregar }); }); };
    view.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { abrir(ctx, b.dataset.ed, { aoFechar: recarregar }); }; });
    view.querySelectorAll('[data-dup]').forEach(function (b) { b.onclick = async function () { b.disabled = true; try { await call({ acao: 'studio_duplicar', id: b.dataset.dup }); recarregar(); } catch (e) { b.disabled = false; ctx.msg(m, e.message, 'error'); } }; });
    view.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        var a = lista.find(function (x) { return x.id === b.dataset.del; });
        if (!confirm('Apagar a apresentação "' + a.titulo + '"? Os áudios de narração também serão apagados.')) return;
        b.disabled = true;
        try { await call({ acao: 'studio_apagar', id: a.id }); recarregar(); } catch (e) { b.disabled = false; ctx.msg(m, e.message, 'error'); }
      };
    });
  }

  function nova(ctx, o, empresas, depois) {
    var esc = ctx.esc, admin = o.scope === 'admin', call = api(ctx);
    var ov = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">Nova apresentação</h2><button class="close-x" type="button" aria-label="Fechar">×</button></div>' +
      '<form class="portal-form" id="std-nf" novalidate><div class="field"><label for="std-nt">Título</label><input id="std-nt" required maxlength="120" placeholder="Ex.: Como abrir sua LLC nos Estados Unidos"></div>' +
      (admin ? '<div class="field"><label for="std-nc">Empresa</label><select id="std-nc"><option value="endeavor">Endeavor (interna)</option>' + empresas.map(function (e) { return '<option value="' + e.client_id + '">' + esc(e.clients ? e.clients.name : '') + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="portal-alert" id="std-nm" role="alert"></div><button class="btn btn--navy" type="submit">Criar e abrir o Studio</button></form>');
    var $o = function (s) { return ov.querySelector(s); };
    $o('#std-nt').focus();
    $o('#std-nf').onsubmit = async function (e) {
      e.preventDefault();
      var t = $o('#std-nt').value.trim();
      if (t.length < 2) return ctx.msg($o('#std-nm'), 'Dê um título.', 'error');
      var btn = $o('button[type=submit]'); btn.disabled = true;
      try { var j = await call({ acao: 'studio_criar', titulo: t, client_id: admin ? $o('#std-nc').value : o.clientId }); ctx.closeOverlay(); depois(j.id); }
      catch (err) { btn.disabled = false; ctx.msg($o('#std-nm'), err.message, 'error'); }
    };
  }

  /* ---------------- editor ---------------- */
  async function abrir(ctx, id, op) {
    op = op || {};
    var call = api(ctx), NA = window.NoirApresentacao;
    var S = { id: id, ap: null, content: null, settings: null, titulo: '', version: 0, status: 'draft', publicada: null, sujo: false, atual: 0,
      narr: {}, vozes: [], cap: {}, termo: '', termoVersao: '', aba: 'roteiro', previaVersao: 0, ocupado: false };
    var raiz = el('div', { class: 'std', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'AI Presentation Studio' });
    raiz.innerHTML = '<div class="std-carregando">Abrindo o Studio…</div>';
    document.body.appendChild(raiz); document.body.classList.add('std-aberto');
    var antesSair = function (e) { if (S.sujo) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', antesSair);
    function fechar() {
      if (S.sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
      pararPrevia(); pararGravacao(); fecharGravador();
      window.removeEventListener('beforeunload', antesSair); document.removeEventListener('keydown', teclas);
      raiz.remove(); document.body.classList.remove('std-aberto');
      if (op.aoFechar) op.aoFechar();
    }
    function teclas(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvar(); }
      if (e.key === 'Escape' && raiz.querySelector('.std-previa')) pararPrevia();
    }
    document.addEventListener('keydown', teclas);

    try {
      var r = await Promise.all([call({ acao: 'studio_obter', id: id }), call({ acao: 'studio_status' }).catch(function () { return { capacidades: {} }; })]);
      aplicarServidor(r[0].apresentacao, r[0].narracoes); S.vozes = r[0].vozes || [];
      S.cap = r[1].capacidades || {}; S.termo = r[1].termo || ''; S.termoVersao = r[1].termo_versao || '';
    } catch (e) {
      raiz.innerHTML = ''; raiz.appendChild(el('div', { class: 'std-carregando' }, [el('p', { text: e.message }), el('button', { class: 'btn btn--navy', type: 'button', text: 'Fechar', onclick: fechar })]));
      return;
    }
    montar();

    function aplicarServidor(ap, narracoes) {
      S.ap = ap; S.content = clone(ap.content); S.settings = clone(ap.settings); S.titulo = ap.titulo; S.version = ap.version; S.status = ap.status;
      S.publicada = ap.published_version; S.dono = ap.dono; S.sujo = false;
      if (narracoes) { S.narr = {}; narracoes.forEach(function (n) { S.narr[n.slide_id] = n; }); }
      if (S.atual >= S.content.slides.length) S.atual = S.content.slides.length - 1;
    }
    function slides() { return S.content.slides; }
    function slideAtual() { return slides()[S.atual]; }
    function mudou() { S.sujo = true; S.content.titulo = S.titulo; atualizarBarra(); }
    function duracaoDe(sl) {
      var n = S.narr[sl.id];
      if (n && n.situacao === 'pronta' && n.duracao_ms && !S.sujo) return n.duracao_ms / 1000;
      return sl.duracao || estimar(sl.roteiro, S.settings.ritmo) || 8;
    }
    function aviso(texto, tipo) {
      var a = raiz.querySelector('#stdAviso'); if (!a) return;
      a.textContent = texto || ''; a.className = 'std-aviso' + (tipo ? ' ' + tipo : ''); a.hidden = !texto;
      clearTimeout(aviso.t); if (texto && tipo !== 'erro') aviso.t = setTimeout(function () { a.hidden = true; }, 5000);
    }

    /* ---------- estrutura ---------- */
    function montar() {
      raiz.innerHTML = '';
      var topo = el('header', { class: 'std-topo' }, [
        el('button', { class: 'std-voltar', type: 'button', onclick: fechar, 'aria-label': 'Voltar para a lista' }, ['← Apresentações']),
        el('input', { class: 'std-titulo', id: 'stdTitulo', value: S.titulo, maxlength: '120', 'aria-label': 'Título da apresentação', oninput: function () { S.titulo = this.value; mudou(); } }),
        el('span', { id: 'stdSit', class: 'std-sit' }),
        el('div', { class: 'std-acoes' }, [
          el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'stdPrevia', onclick: function () { previa(0); } }, ['▶ Prévia']),
          el('button', { class: 'btn btn--navy btn--sm', type: 'button', id: 'stdSalvar', onclick: salvar }, ['Salvar']),
          el('button', { class: 'btn btn--gold btn--sm', type: 'button', id: 'stdPublicar', onclick: publicar }, ['Publicar'])])]);
      var lista = el('nav', { class: 'std-lista', id: 'stdLista', 'aria-label': 'Slides' });
      var centro = el('main', { class: 'std-centro' }, [el('div', { class: 'std-palco', id: 'stdPalco' }), el('section', { class: 'std-form', id: 'stdForm', 'aria-label': 'Conteúdo do slide' })]);
      var lado = el('aside', { class: 'std-lado' }, [
        el('div', { class: 'std-abas', role: 'tablist' }, [['roteiro', 'Roteiro'], ['ia', 'Criar com IA'], ['abertura', 'Abertura'], ['config', 'Configurações'], ['voz', 'Voz']].map(function (a) {
          return el('button', { type: 'button', role: 'tab', 'data-aba': a[0], 'aria-selected': S.aba === a[0] ? 'true' : 'false', onclick: function () { S.aba = a[0]; desenharLado(); } }, [a[1]]);
        })),
        el('div', { class: 'std-lado-corpo', id: 'stdLado', role: 'tabpanel' })]);
      var linha = el('footer', { class: 'std-linha', 'aria-label': 'Linha do tempo' }, [el('div', { class: 'std-linha-info', id: 'stdLinhaInfo' }), el('div', { class: 'std-linha-faixa', id: 'stdFaixa' })]);
      raiz.appendChild(topo);
      raiz.appendChild(el('div', { id: 'stdAviso', class: 'std-aviso', role: 'status', hidden: true }));
      raiz.appendChild(el('div', { class: 'std-corpo' }, [lista, centro, lado]));
      raiz.appendChild(linha);
      desenharTudo();
      raiz.querySelector('#stdTitulo').focus();
    }
    function desenharTudo() { desenharLista(); desenharPalco(); desenharForm(); desenharLado(); desenharLinha(); atualizarBarra(); }
    function atualizarBarra() {
      var s = raiz.querySelector('#stdSit'); if (!s) return;
      s.textContent = (S.sujo ? 'Alterações não salvas' : 'Salvo') + ' · ' + (S.status === 'published' ? 'Publicada v' + S.publicada + (S.publicada !== S.version || S.sujo ? ' (há alterações depois dela)' : '') : 'Rascunho');
      s.className = 'std-sit' + (S.sujo ? ' sujo' : '');
      raiz.querySelector('#stdSalvar').disabled = !S.sujo || S.ocupado;
      raiz.querySelector('#stdPublicar').disabled = S.ocupado;
    }

    /* ---------- lista de slides (arrastar para reordenar) ---------- */
    function desenharLista() {
      var l = raiz.querySelector('#stdLista'); l.innerHTML = '';
      var ol = el('ol', { class: 'std-miniaturas' });
      slides().forEach(function (sl, i) {
        var n = S.narr[sl.id], sit = !sl.roteiro ? 'sem' : (n && n.situacao === 'pronta' && !S.sujo ? 'pronta' : 'pendente');
        var mini = el('div', { class: 'std-mini-slide' }); mini.appendChild(NA.renderizar(sl, { numero: i + 1, total: slides().length }));
        var li = el('li', { class: 'std-mini' + (i === S.atual ? ' atual' : ''), draggable: 'true', 'data-i': i }, [
          el('button', { type: 'button', class: 'std-mini-abrir', 'aria-label': 'Slide ' + (i + 1) + (sl.titulo ? ': ' + sl.titulo : ''), 'aria-current': i === S.atual ? 'true' : null, onclick: function () { S.atual = i; desenharTudo(); } }, [mini]),
          el('div', { class: 'std-mini-rodape' }, [
            el('span', { text: (i + 1) + ' · ' + mmss(duracaoDe(sl)) }),
            el('span', { class: 'std-ponto ' + sit, title: sit === 'pronta' ? 'Narração pronta' : sit === 'sem' ? 'Sem roteiro' : 'Narração por gerar' }),
            el('span', { class: 'std-mini-acoes' }, [
              el('button', { type: 'button', title: 'Subir', 'aria-label': 'Subir slide ' + (i + 1), disabled: i === 0, onclick: function () { mover(i, i - 1); } }, ['↑']),
              el('button', { type: 'button', title: 'Descer', 'aria-label': 'Descer slide ' + (i + 1), disabled: i === slides().length - 1, onclick: function () { mover(i, i + 1); } }, ['↓']),
              el('button', { type: 'button', title: 'Duplicar', 'aria-label': 'Duplicar slide ' + (i + 1), onclick: function () { duplicar(i); } }, ['⧉']),
              el('button', { type: 'button', title: 'Apagar', 'aria-label': 'Apagar slide ' + (i + 1), disabled: slides().length === 1, onclick: function () { apagar(i); } }, ['✕'])])])]);
        li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); li.classList.add('arrastando'); });
        li.addEventListener('dragend', function () { li.classList.remove('arrastando'); });
        li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('alvo'); });
        li.addEventListener('dragleave', function () { li.classList.remove('alvo'); });
        li.addEventListener('drop', function (e) { e.preventDefault(); li.classList.remove('alvo'); var de = Number(e.dataTransfer.getData('text/plain')); if (!isNaN(de) && de !== i) mover(de, i); });
        ol.appendChild(li);
      });
      l.appendChild(ol);
      l.appendChild(el('button', { class: 'btn btn--ghost btn--sm std-mais', type: 'button', onclick: adicionar, disabled: slides().length >= 30 }, ['＋ Slide']));
    }
    function mover(de, para) {
      var arr = slides(); if (para < 0 || para >= arr.length) return;
      var x = arr.splice(de, 1)[0]; arr.splice(para, 0, x);
      S.atual = para; mudou(); desenharTudo();
    }
    function duplicar(i) {
      if (slides().length >= 30) return aviso('O limite é de 30 slides.', 'erro');
      var c = clone(slides()[i]); c.id = novoId(slides()); slides().splice(i + 1, 0, c); S.atual = i + 1; mudou(); desenharTudo();
    }
    function apagar(i) {
      if (slides().length === 1) return;
      if (!confirm('Apagar o slide ' + (i + 1) + '?')) return;
      slides().splice(i, 1); S.atual = Math.min(i, slides().length - 1); mudou(); desenharTudo();
    }
    function adicionar() {
      if (slides().length >= 30) return;
      slides().splice(S.atual + 1, 0, { id: novoId(slides()), layout: 'topicos', titulo: 'Novo slide', itens: ['Primeiro ponto'] });
      S.atual++; mudou(); desenharTudo();
    }

    /* ---------- palco e formulário do slide ---------- */
    function desenharPalco() {
      var p = raiz.querySelector('#stdPalco'); p.innerHTML = '';
      try { p.appendChild(NA.renderizar(NA.validar({ titulo: S.titulo, slides: [slideAtual()] }).slides[0], { numero: S.atual + 1, total: slides().length })); }
      catch (e) { p.appendChild(el('p', { class: 'std-erro', text: 'Este slide está incompleto.' })); }
    }
    function campo(rotulo, input, dica) { var id = 'std-f-' + Math.random().toString(36).slice(2, 8); input.id = id; return el('div', { class: 'std-campo' }, [el('label', { for: id, text: rotulo }), input, dica ? el('p', { class: 'std-dica', text: dica }) : null]); }
    function desenharForm() {
      var f = raiz.querySelector('#stdForm'); f.innerHTML = '';
      var sl = slideAtual();
      var alterar = function (fn) { return function () { fn(this); limparLayout(sl); mudou(); desenharPalco(); desenharLista(); desenharLinha(); }; };
      var sel = el('select', { onchange: function () { sl.layout = this.value; preencherLayout(sl); mudou(); desenharPalco(); desenharForm(); desenharLista(); } },
        LAYOUTS.map(function (l) { return el('option', { value: l[0], selected: sl.layout === l[0] }, [l[1]]); }));
      f.appendChild(el('div', { class: 'std-form-topo' }, [el('h2', { text: 'Slide ' + (S.atual + 1) }), campo('Layout', sel),
        el('button', { class: 'btn btn--ghost btn--xs', type: 'button', onclick: refazerSlide, disabled: !S.cap.texto, title: S.cap.texto ? '' : 'IA de texto não ligada' }, ['✦ Refazer slide com IA'])]));
      f.appendChild(campo('Título', el('input', { value: sl.titulo || '', maxlength: '120', oninput: alterar(function (i) { sl.titulo = i.value; }) })));
      if (['capa', 'encerramento', 'topicos', 'passos', 'duas-colunas', 'numero'].indexOf(sl.layout) >= 0)
        f.appendChild(campo('Subtítulo', el('input', { value: sl.subtitulo || '', maxlength: '200', oninput: alterar(function (i) { sl.subtitulo = i.value; }) })));
      if (['topicos', 'passos', 'capa', 'encerramento'].indexOf(sl.layout) >= 0)
        f.appendChild(campo('Tópicos', el('textarea', { rows: '5', oninput: alterar(function (i) { sl.itens = linhas(i.value, 8, 160); }) }, [(sl.itens || []).join('\n')]), 'Um por linha. Até 8; o ideal são 3 a 5 curtos.'));
      if (sl.layout === 'duas-colunas') {
        sl.colunas = sl.colunas || [{ titulo: '', itens: [] }, { titulo: '', itens: [] }];
        var g = el('div', { class: 'std-duas' });
        sl.colunas.forEach(function (c, k) {
          g.appendChild(el('div', {}, [campo('Coluna ' + (k + 1), el('input', { value: c.titulo || '', maxlength: '60', oninput: alterar(function (i) { c.titulo = i.value; }) })),
            campo('Itens', el('textarea', { rows: '4', oninput: alterar(function (i) { c.itens = linhas(i.value, 6, 120); }) }, [(c.itens || []).join('\n')]))]));
        });
        f.appendChild(g);
      }
      if (sl.layout === 'numero') {
        sl.numero = sl.numero || { valor: '', legenda: '' };
        f.appendChild(el('div', { class: 'std-duas' }, [campo('Número', el('input', { value: sl.numero.valor, maxlength: '16', oninput: alterar(function (i) { sl.numero.valor = i.value; }) })),
          campo('Legenda', el('input', { value: sl.numero.legenda, maxlength: '140', oninput: alterar(function (i) { sl.numero.legenda = i.value; }) }))]));
      }
      if (sl.layout === 'citacao') {
        sl.citacao = sl.citacao || { texto: '', autor: '' };
        f.appendChild(campo('Citação', el('textarea', { rows: '3', maxlength: '280', oninput: alterar(function (i) { sl.citacao.texto = i.value; }) }, [sl.citacao.texto])));
        f.appendChild(campo('Autor', el('input', { value: sl.citacao.autor, maxlength: '80', oninput: alterar(function (i) { sl.citacao.autor = i.value; }) })));
      }
      if (sl.layout === 'grafico') {
        sl.grafico = sl.grafico || { tipo: 'barras', unidade: '', dados: [] };
        f.appendChild(el('div', { class: 'std-duas' }, [
          campo('Barras', el('textarea', { rows: '4', oninput: alterar(function (i) { sl.grafico.dados = linhas(i.value, 8, 80).map(function (x) { var m = x.match(/^(.*?)[:=]\s*(-?[\d.,]+)\s*$/); return m ? { rotulo: m[1].trim().slice(0, 40), valor: Number(m[2].replace(/\./g, '').replace(',', '.')) } : null; }).filter(Boolean); }) },
            [(sl.grafico.dados || []).map(function (d) { return d.rotulo + ': ' + d.valor; }).join('\n')]), 'Uma por linha: “rótulo: valor”. Use só números que você confirmou.'),
          campo('Unidade', el('input', { value: sl.grafico.unidade || '', maxlength: '12', oninput: alterar(function (i) { sl.grafico.unidade = i.value; }) }))]));
      }
      f.appendChild(campo('Notas (só para você)', el('textarea', { rows: '2', maxlength: '600', oninput: alterar(function (i) { sl.notas = i.value; }) }, [sl.notas || ''])));
    }
    function linhas(t, n, max) { return String(t || '').split('\n').map(function (x) { return x.trim().slice(0, max); }).filter(Boolean).slice(0, n); }
    function limparLayout(sl) { ['titulo', 'subtitulo', 'notas'].forEach(function (k) { if (sl[k] === '') delete sl[k]; }); }
    function preencherLayout(sl) {
      if (sl.layout === 'duas-colunas' && !sl.colunas) sl.colunas = [{ titulo: 'Antes', itens: (sl.itens || []).slice(0, 3) }, { titulo: 'Depois', itens: (sl.itens || []).slice(3, 6) }];
      if (sl.layout === 'numero' && !sl.numero) sl.numero = { valor: '[completar]', legenda: '' };
      if (sl.layout === 'citacao' && !sl.citacao) sl.citacao = { texto: sl.subtitulo || '[completar]', autor: '' };
      if (sl.layout === 'grafico' && !sl.grafico) sl.grafico = { tipo: 'barras', unidade: '', dados: [{ rotulo: '[completar]', valor: 1 }] };
    }

    /* ---------- painel lateral ---------- */
    function desenharLado() {
      raiz.querySelectorAll('.std-abas [data-aba]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.aba === S.aba ? 'true' : 'false'); });
      var c = raiz.querySelector('#stdLado'); c.innerHTML = '';
      ({ roteiro: ladoRoteiro, ia: ladoIA, abertura: ladoAbertura, config: ladoConfig, voz: ladoVoz })[S.aba](c);
    }
    function ladoRoteiro(c) {
      var sl = slideAtual(), n = S.narr[sl.id] || {};
      var info = el('p', { class: 'std-dica' });
      var conta = function () { var e = estimar(sl.roteiro, S.settings.ritmo); info.textContent = palavras(sl.roteiro) + ' palavras · cerca de ' + mmss(e) + ' de fala no ritmo ' + S.settings.ritmo + '.'; };
      var ta = el('textarea', { class: 'std-roteiro', rows: '12', maxlength: '3000', placeholder: 'O que será falado neste slide. Escreva como você fala: frases curtas, sem ler os tópicos.', oninput: function () { sl.roteiro = this.value; conta(); mudou(); desenharLinha(); desenharLista(); } }, [sl.roteiro || '']);
      c.appendChild(el('h3', { text: 'Roteiro do slide ' + (S.atual + 1) }));
      c.appendChild(campo('Fala', ta)); c.appendChild(info); conta();
      var dur = el('input', { type: 'number', min: '3', max: '900', step: '1', value: sl.duracao || '', placeholder: String(estimar(sl.roteiro, S.settings.ritmo) || ''), oninput: function () { var v = Math.round(Number(this.value)); if (v >= 3) sl.duracao = Math.min(v, 900); else delete sl.duracao; mudou(); desenharLinha(); } });
      c.appendChild(campo('Duração do slide (segundos)', dur, 'Vazio: usa o tempo da narração, ou o estimado pelo roteiro.'));
      c.appendChild(el('div', { class: 'std-linha-botoes' }, [
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: !S.cap.texto, onclick: escreverRoteiro }, ['✦ Escrever com IA']),
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { previa(S.atual, true); } }, ['▶ Prévia deste slide'])]));
      var st = el('div', { class: 'std-caixa' });
      st.appendChild(el('h4', { text: 'Narração' }));
      var sit = S.sujo ? 'salve para conferir' : ({ pronta: 'pronta', desatualizada: 'o roteiro mudou: gere de novo', pendente: 'ainda não gerada', falhou: 'falhou: ' + (n.erro || ''), gerando: 'gerando…', sem_roteiro: 'sem roteiro' })[n.situacao] || 'ainda não gerada';
      st.appendChild(el('p', { text: 'Situação: ' + sit + (n.situacao === 'pronta' && n.duracao_ms ? ' · ' + mmss(n.duracao_ms / 1000) : '') }));
      if (n.situacao === 'pronta' && !S.sujo) st.appendChild(el('button', { class: 'btn btn--ghost btn--xs', type: 'button', onclick: function () { ouvir(sl.id, this); } }, ['Ouvir']));
      st.appendChild(el('button', { class: 'btn btn--navy btn--xs', type: 'button', disabled: !podeNarrar() || !sl.roteiro, onclick: function () { narrarTodos([sl.id]); } }, ['Gerar narração deste slide']));
      if (!podeNarrar()) st.appendChild(el('p', { class: 'std-dica', text: motivoSemNarrar() }));
      c.appendChild(st);
    }
    function podeNarrar() { return S.cap.voz && S.dono && S.settings.voz_id && S.vozes.some(function (v) { return v.id === S.settings.voz_id && v.status === 'ready'; }); }
    function motivoSemNarrar() {
      if (!S.cap.voz) return 'A voz ainda não está ligada no HUB AI (ElevenLabs). Enquanto isso, a prévia usa o tempo estimado do roteiro.';
      if (!S.dono) return 'Só quem criou a apresentação pode narrá-la, com a própria voz.';
      if (!S.vozes.length) return 'Crie a sua voz na aba Voz.';
      if (!S.settings.voz_id) return 'Escolha a sua voz na aba Voz e salve.';
      return 'A voz escolhida não está pronta.';
    }
    function ladoIA(c) {
      c.appendChild(el('h3', { text: 'Criar com IA' }));
      if (!S.cap.texto) c.appendChild(el('p', { class: 'std-aviso erro', text: S.cap.erro || 'A IA de texto não está disponível no HUB agora.' }));
      var ta = el('textarea', { rows: '6', maxlength: '4000', placeholder: 'Ex.: Webinar de 15 minutos para brasileiros que querem abrir uma LLC na Flórida: etapas, documentos e erros comuns. Termine convidando para uma consulta.' });
      c.appendChild(campo('Sobre o que é a apresentação?', ta, 'A IA usa as Configurações (idioma, tom, duração, ritmo). Ela não inventa números nem promessas: o que faltar aparece como [completar].'));
      c.appendChild(el('button', { class: 'btn btn--navy btn--sm', type: 'button', disabled: !S.cap.texto, onclick: function () { gerarTudo(ta.value, this); } }, ['✦ Gerar slides e roteiro']));
      c.appendChild(el('hr'));
      c.appendChild(el('h3', { text: 'Importar PDF ou PowerPoint' }));
      var arq = el('input', { type: 'file', accept: '.pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      c.appendChild(campo('Arquivo', arq, 'O texto de cada página vira um slide; as anotações do PowerPoint viram o roteiro. Imagens e formatação do original não são trazidas; PDFs escaneados (só imagem) não têm texto para ler.'));
      var comIA = el('input', { type: 'checkbox', checked: S.cap.texto, disabled: !S.cap.texto });
      c.appendChild(el('label', { class: 'std-check' }, [comIA, ' Organizar com IA e escrever o roteiro (mantém o conteúdo do arquivo)']));
      c.appendChild(el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { importar(arq.files[0], comIA.checked, this); } }, ['Importar']));
    }
    function ladoConfig(c) {
      var cfg = S.settings;
      var muda = function (k, conv) { return function () { cfg[k] = conv ? conv(this) : this.value; mudou(); desenharLinha(); }; };
      c.appendChild(el('h3', { text: 'Configurações' }));
      c.appendChild(campo('Idioma', el('select', { onchange: muda('idioma') }, IDIOMAS.map(function (x) { return el('option', { value: x[0], selected: cfg.idioma === x[0] }, [x[1]]); }))));
      c.appendChild(campo('Tom', el('input', { value: cfg.tom, maxlength: '60', oninput: muda('tom') }), 'Ex.: profissional e acolhedor; didático; direto.'));
      c.appendChild(el('div', { class: 'std-duas' }, [
        campo('Duração total (min)', el('input', { type: 'number', min: '1', max: '120', value: cfg.duracao_min, oninput: muda('duracao_min', function (i) { return Math.min(Math.max(Math.round(Number(i.value) || 1), 1), 120); }) })),
        campo('Ritmo da fala', el('select', { onchange: function () { cfg.ritmo = this.value; mudou(); desenharLinha(); desenharLado(); } }, RITMOS.map(function (x) { return el('option', { value: x[0], selected: cfg.ritmo === x[0] }, [x[1]]); })))]));
      c.appendChild(campo('Público', el('input', { value: cfg.publico || '', maxlength: '160', placeholder: 'Ex.: empreendedores brasileiros', oninput: muda('publico') })));
      c.appendChild(el('div', { class: 'std-duas' }, [
        campo('Transição', el('select', { onchange: muda('transicao') }, [['suave', 'Suave'], ['corte', 'Corte seco']].map(function (x) { return el('option', { value: x[0], selected: cfg.transicao === x[0] }, [x[1]]); }))),
        campo('Abertura', el('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: function () { S.aba = 'abertura'; desenharLado(); } }, ['Ver a aba Abertura']))]));
      var leg = el('input', { type: 'checkbox', checked: cfg.legendas, onchange: function () { cfg.legendas = this.checked; mudou(); } });
      c.appendChild(el('label', { class: 'std-check' }, [leg, ' Mostrar legenda do roteiro durante a narração']));
      var pr = el('textarea', { rows: '4', placeholder: 'LLC = éle éle cê\nEIN = í ai én', oninput: function () { cfg.pronuncia = linhas(this.value, 50, 200).map(function (x) { var m = x.split('='); return m.length > 1 ? { de: m[0].trim().slice(0, 60), para: m.slice(1).join('=').trim().slice(0, 120) } : null; }).filter(function (x) { return x && x.de && x.para; }); mudou(); } },
        [(cfg.pronuncia || []).map(function (p) { return p.de + ' = ' + p.para; }).join('\n')]);
      c.appendChild(campo('Pronúncia', pr, 'Uma por linha: “termo = como falar”. Vale só para a voz; o slide continua com o termo original. Mudar a pronúncia pede gerar a narração de novo.'));
      var caps = el('div', { class: 'std-caixa' }, [el('h4', { text: 'O que está ligado no HUB AI' })]);
      [['Texto (slides e roteiro)', S.cap.texto], ['Voz' + (S.cap.provedor_voz ? ' (' + S.cap.provedor_voz + ')' : ''), S.cap.voz], ['Imagens', S.cap.imagens], ['Vídeo', S.cap.video]].forEach(function (x) {
        caps.appendChild(el('p', { class: x[1] ? 'std-ok' : 'std-nao', text: (x[1] ? '● ' : '○ ') + x[0] + (x[1] ? '' : ': não ligado') }));
      });
      caps.appendChild(el('p', { class: 'std-dica', text: 'Imagens e vídeo aparecem aqui quando um provedor for conectado no HUB. Até lá, o Studio não oferece esses botões.' }));
      c.appendChild(caps);
    }
    function ladoVoz(c) {
      c.appendChild(el('h3', { text: 'Minha voz' }));
      var vt = el('input', { type: 'checkbox', checked: S.settings.voz_teste, onchange: function () { S.settings.voz_teste = this.checked; mudou(); } });
      c.appendChild(el('div', { class: 'std-caixa' }, [el('h4', { text: 'Voz de teste' }),
        el('label', { class: 'std-check' }, [vt, ' Usar a voz do navegador nos slides sem narração, na prévia e no webinar']),
        el('p', { class: 'std-dica', text: 'Serve para ouvir o tom e o ritmo antes de gravar a sua voz. É uma voz sintética do próprio navegador (muda de computador para computador), e o público vê o aviso “voz de teste”. Quando a sua narração estiver pronta, ela tem prioridade.' })]));
      if (!S.cap.voz) c.appendChild(el('p', { class: 'std-aviso erro', text: 'A voz ainda não está ligada no HUB AI. Um administrador precisa conectar o ElevenLabs em AI Providers e testar a conexão. Você pode preparar o roteiro normalmente enquanto isso.' }));
      if (!S.dono) c.appendChild(el('p', { class: 'std-dica', text: 'Esta apresentação é de outra pessoa da equipe: só ela pode narrá-la com a própria voz.' }));
      var sel = el('select', { disabled: !S.dono, onchange: function () { S.settings.voz_id = this.value || null; mudou(); desenharLado(); } }, [el('option', { value: '', text: 'Nenhuma (sem narração)' })].concat(S.vozes.filter(function (v) { return v.status === 'ready'; }).map(function (v) { return el('option', { value: v.id, selected: S.settings.voz_id === v.id }, [v.name]); })));
      c.appendChild(campo('Voz desta apresentação', sel));
      var prontas = slides().filter(function (sl) { var n = S.narr[sl.id]; return n && n.situacao === 'pronta'; }).length, comRot = slides().filter(function (sl) { return sl.roteiro; }).length;
      c.appendChild(el('p', { class: 'std-dica', text: S.sujo ? 'Salve para conferir quais narrações estão em dia.' : prontas + ' de ' + comRot + ' slides com roteiro têm narração em dia.' }));
      c.appendChild(el('button', { class: 'btn btn--navy btn--sm', type: 'button', disabled: !podeNarrar() || !comRot, onclick: function () { narrarTodos(null); } }, ['Gerar narração dos slides que mudaram']));
      if (!podeNarrar()) c.appendChild(el('p', { class: 'std-dica', text: motivoSemNarrar() }));
      c.appendChild(el('hr'));
      c.appendChild(el('h4', { text: 'Suas vozes' }));
      if (!S.vozes.length) c.appendChild(el('p', { class: 'std-dica', text: 'Nenhuma voz criada.' }));
      S.vozes.forEach(function (v) {
        c.appendChild(el('div', { class: 'std-voz' }, [el('div', {}, [el('strong', { text: v.name }), el('span', { class: 'std-dica', text: ' · autorizada em ' + ctx.fmtDT(v.consent_at) + (v.status !== 'ready' ? ' · ' + v.status : '') })]),
          el('button', { class: 'btn btn--ghost btn--xs', type: 'button', onclick: function () { apagarVoz(v, this); } }, ['Apagar'])]));
      });
      if (S.vozes.length < 3) c.appendChild(gravador());
    }

    /* ---------- gravação da amostra de voz (com o termo) ---------- */
    var G = { rec: null, partes: [], blob: null, ini: 0, timer: null, stream: null, mime: '' };
    function pararGravacao() { try { if (G.rec && G.rec.state !== 'inactive') G.rec.stop(); } catch (e) { } if (G.stream) G.stream.getTracks().forEach(function (t) { t.stop(); }); G.stream = null; clearInterval(G.timer); }
    function gravador() {
      var box = el('div', { class: 'std-caixa' }, [el('h4', { text: 'Criar minha voz' })]);
      box.appendChild(el('p', { class: 'std-dica', text: 'Grave de 1 a 2 minutos da SUA voz, em lugar silencioso, lendo o texto abaixo ou falando livremente. A amostra é enviada uma vez ao provedor pelo HUB e não fica guardada na Endeavor.' }));
      box.appendChild(el('blockquote', { class: 'std-leitura', text: LEITURA }));
      var tempo = el('span', { class: 'std-tempo', text: '0:00' });
      var ouvir = el('audio', { controls: true, hidden: true });
      var gravar = el('button', { class: 'btn btn--ghost btn--sm', type: 'button' }, ['● Gravar']);
      var arquivo = el('input', { type: 'file', accept: 'audio/*' });
      var termo = el('input', { type: 'checkbox' });
      var nome = el('input', { value: 'Minha voz', maxlength: '80' });
      var criar = el('button', { class: 'btn btn--navy btn--sm', type: 'button', disabled: true }, ['Criar minha voz']);
      var msg = el('p', { class: 'std-dica', role: 'status' });
      var pronto = function () { criar.disabled = !(G.blob && termo.checked && S.cap.voz); };
      gravar.onclick = async function () {
        if (G.rec && G.rec.state === 'recording') { G.rec.stop(); return; }
        try {
          G.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
          G.mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); }) || '';
          G.rec = new MediaRecorder(G.stream, G.mime ? { mimeType: G.mime, audioBitsPerSecond: 64000 } : undefined);
          G.partes = []; G.blob = null; G.ini = Date.now();
          G.rec.ondataavailable = function (e) { if (e.data.size) G.partes.push(e.data); };
          G.rec.onstop = function () {
            clearInterval(G.timer); G.stream.getTracks().forEach(function (t) { t.stop(); });
            G.seg = (Date.now() - G.ini) / 1000;
            G.blob = new Blob(G.partes, { type: (G.rec.mimeType || G.mime || 'audio/webm').split(';')[0] });
            ouvir.src = URL.createObjectURL(G.blob); ouvir.hidden = false;
            gravar.textContent = '● Gravar de novo';
            msg.textContent = G.seg < 30 ? 'Ficou curta (' + Math.round(G.seg) + ' s). Grave pelo menos 30 segundos.' : 'Ouça a gravação antes de criar a voz.';
            if (G.seg < 30) G.blob = null;
            pronto();
          };
          G.rec.start(1000); gravar.textContent = '■ Parar';
          G.timer = setInterval(function () { var s = (Date.now() - G.ini) / 1000; tempo.textContent = mmss(s); if (s >= 120) G.rec.stop(); }, 250);
        } catch (e) { msg.textContent = 'Não foi possível usar o microfone: ' + e.message; }
      };
      arquivo.onchange = function () {
        var f = arquivo.files[0]; if (!f) return;
        if (f.size > 1400000) { msg.textContent = 'Arquivo grande demais (máximo 1,4 MB). Grave pelo navegador ou envie um trecho menor.'; return; }
        G.blob = f; G.seg = 0; ouvir.src = URL.createObjectURL(f); ouvir.hidden = false; msg.textContent = 'Ouça o arquivo antes de criar a voz.'; pronto();
      };
      termo.onchange = pronto;
      criar.onclick = async function () {
        if (!G.blob) return;
        criar.disabled = true; msg.textContent = 'Criando a voz no provedor pelo HUB…';
        try {
          var b64 = await new Promise(function (ok, falha) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(',')[1]); }; fr.onerror = falha; fr.readAsDataURL(G.blob); });
          var j = await call({ acao: 'voz_criar', nome: nome.value, mime: G.blob.type || 'audio/webm', amostra_base64: b64, segundos: Math.round(G.seg || 0), consentimento: true, termo_versao: S.termoVersao, client_id: S.ap.client_id });
          S.vozes = j.vozes || S.vozes;
          if (!S.settings.voz_id && S.dono) { S.settings.voz_id = j.id; mudou(); }
          G.blob = null;
          aviso(j.verificacao ? 'Voz criada. O provedor pediu uma verificação extra: confira o e-mail da conta ElevenLabs.' : 'Voz criada. Salve a apresentação e gere a narração.', 'ok');
          desenharLado();
        } catch (e) { msg.textContent = e.message; criar.disabled = false; }
      };
      box.appendChild(el('div', { class: 'std-linha-botoes' }, [gravar, tempo]));
      box.appendChild(campo('Ou envie um arquivo seu (MP3, WAV, M4A)', arquivo));
      box.appendChild(ouvir);
      box.appendChild(campo('Nome da voz', nome));
      box.appendChild(el('label', { class: 'std-check std-termo' }, [termo, ' ' + S.termo]));
      box.appendChild(criar); box.appendChild(msg);
      if (!S.cap.voz) { gravar.disabled = true; arquivo.disabled = true; }
      return box;
    }
    async function apagarVoz(v, btn) {
      if (!confirm('Apagar a voz "' + v.name + '"? Ela é removida do provedor, e os áudios gerados com ela também são apagados.')) return;
      btn.disabled = true;
      try { var j = await call({ acao: 'voz_apagar', id: v.id }); S.vozes = j.vozes || []; if (S.settings.voz_id === v.id) S.settings.voz_id = null; await recarregarNarr(); desenharLado(); aviso('Voz apagada.', 'ok'); }
      catch (e) { btn.disabled = false; aviso(e.message, 'erro'); }
    }

    /* ---------- servidor ---------- */
    async function ocupar(fn, btn, texto) {
      if (S.ocupado) return;
      S.ocupado = true; atualizarBarra();
      var orig = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; if (texto) btn.textContent = texto; }
      try { return await fn(); }
      catch (e) { aviso(e.message, 'erro'); if (e.status === 409 && /outra janela/.test(e.message)) { /* deixa a pessoa decidir recarregar */ } }
      finally { S.ocupado = false; if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = orig; } atualizarBarra(); }
    }
    function salvar() {
      if (!S.sujo) return Promise.resolve(true);
      return ocupar(async function () {
        var j = await call({ acao: 'studio_salvar', id: S.id, version: S.version, titulo: S.titulo, settings: S.settings, content: S.content });
        aplicarServidor(j.apresentacao, j.narracoes); desenharTudo(); aviso('Salvo.', 'ok'); return true;
      }, raiz.querySelector('#stdSalvar'), 'Salvando…');
    }
    async function recarregarNarr() { try { var j = await call({ acao: 'narracoes', id: S.id }); S.narr = {}; j.narracoes.forEach(function (n) { S.narr[n.slide_id] = n; }); } catch (e) { } }
    async function publicar() {
      if (S.sujo && !(await salvar())) return;
      if (S.previaVersao !== S.version) {
        aviso('Antes de publicar, assista à prévia completa desta versão (botão Prévia). Ela abre agora.', 'ok');
        return previa(0, false, true);
      }
      var semRot = slides().filter(function (sl) { return !sl.roteiro; }).length;
      if (!confirm('Publicar a versão ' + S.version + '? Ela passa a abrir nas salas da empresa.' + (semRot ? '\n\n' + semRot + ' slide(s) estão sem roteiro.' : ''))) return;
      ocupar(async function () {
        var j = await call({ acao: 'studio_publicar', id: S.id, version: S.version });
        S.status = 'published'; S.publicada = j.published_version; atualizarBarra(); aviso('Publicada (versão ' + j.published_version + '). Use no Live Webinar (Novo webinar) ou numa sala do Web Meeting (Assistente › Do Studio).', 'ok');
      }, raiz.querySelector('#stdPublicar'), 'Publicando…');
    }
    function gerarTudo(pedido, btn) {
      if (String(pedido || '').trim().length < 5) return aviso('Descreva o assunto da apresentação.', 'erro');
      if (slides().length > 1 && !confirm('A IA vai propor uma apresentação nova no lugar desta. Você ainda pode revisar antes de salvar. Continuar?')) return;
      ocupar(async function () {
        var j = await call({ acao: 'studio_ia', id: S.id, modo: 'criar', pedido: pedido, settings: S.settings, content: S.content });
        S.content = j.content; S.titulo = j.content.titulo || S.titulo; raiz.querySelector('#stdTitulo').value = S.titulo; S.atual = 0; mudou(); S.aba = 'roteiro'; desenharTudo();
        aviso((j.mensagem || 'Pronto.') + ' Revise e salve.', 'ok');
      }, btn, 'Gerando… (até 1 minuto)');
    }
    function refazerSlide() {
      var pedido = prompt('O que mudar neste slide? (deixe vazio para a IA melhorar)', '');
      if (pedido === null) return;
      ocupar(async function () {
        var j = await call({ acao: 'studio_ia', id: S.id, modo: 'slide', slide_id: slideAtual().id, pedido: pedido, settings: S.settings, content: S.content });
        var sl = j.slide; if (!sl.roteiro && slideAtual().roteiro) sl.roteiro = slideAtual().roteiro;
        slides()[S.atual] = sl; mudou(); desenharTudo(); aviso(j.mensagem || 'Slide refeito.', 'ok');
      }, null);
    }
    function escreverRoteiro() {
      var sl = slideAtual();
      if (sl.roteiro && !confirm('Substituir o roteiro atual deste slide?')) return;
      ocupar(async function () {
        var j = await call({ acao: 'studio_ia', id: S.id, modo: 'roteiro', slide_id: sl.id, settings: S.settings, content: S.content });
        sl.roteiro = j.roteiro; mudou(); desenharLado(); desenharLinha(); desenharLista(); aviso('Roteiro escrito. Revise antes de salvar.', 'ok');
      }, null);
    }
    async function narrarTodos(ids) {
      if (S.sujo && !(await salvar())) return;
      var btns = raiz.querySelectorAll('.std-lado-corpo button'); btns.forEach(function (b) { b.disabled = true; });
      try {
        for (var volta = 0; volta < 10; volta++) {
          aviso('Gerando narração… (pode levar alguns segundos por slide)', 'ok');
          var j = await call({ acao: 'narrar', id: S.id, voz_id: S.settings.voz_id, slide_ids: ids || undefined });
          (j.narracoes || []).forEach(function (n) { S.narr[n.slide_id] = n; });
          desenharLista(); desenharLinha();
          var falhas = (j.feitos || []).filter(function (f) { return !f.ok; });
          if (falhas.length) { aviso('Alguns slides falharam: ' + falhas[0].erro, 'erro'); break; }
          if (!j.restantes) { aviso((j.feitos || []).length ? 'Narração pronta.' : 'Nada para gerar: as narrações já estão em dia.', 'ok'); break; }
        }
      } catch (e) { aviso(e.message, 'erro'); }
      desenharLado();
    }
    function importar(f, comIA, btn) {
      if (!f) return aviso('Escolha um arquivo PDF ou PowerPoint (.pptx).', 'erro');
      if (f.size > 40 * 1024 * 1024) return aviso('Arquivo grande demais (máximo 40 MB).', 'erro');
      ocupar(async function () {
        var paginas = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await lerPdf(f) : /\.pptx$/i.test(f.name) ? await lerPptx(f) : null;
        if (!paginas) throw new Error('Formato não aceito. Use PDF ou PowerPoint (.pptx). Arquivos .ppt antigos: salve como .pptx.');
        paginas = paginas.filter(function (p) { return p.texto || p.notas; }).slice(0, 30);
        if (!paginas.length) throw new Error('Não encontrei texto no arquivo. PDFs escaneados (só imagem) ainda não são lidos.');
        if (slides().length > 1 && !confirm('Substituir os slides atuais pelos ' + paginas.length + ' do arquivo? Você revisa antes de salvar.')) return;
        if (comIA) {
          var j = await call({ acao: 'studio_ia', id: S.id, modo: 'importar', paginas: paginas, origem: f.name, settings: S.settings });
          S.content = j.content;
        } else {
          S.content = NA.validar({ titulo: S.titulo, slides: paginas.map(function (p, i) { var ls = p.texto.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); return { id: 's' + (i + 1), layout: i === 0 ? 'capa' : 'topicos', titulo: ls[0] || 'Slide ' + (i + 1), itens: ls.slice(1, 9), roteiro: p.notas || '' }; }) });
        }
        S.atual = 0; mudou(); desenharTudo(); aviso(paginas.length + ' páginas importadas de ' + f.name + '. Revise e salve.', 'ok');
      }, btn, 'Lendo o arquivo…');
    }

    /* ---------- linha do tempo ---------- */
    function desenharLinha() {
      var faixa = raiz.querySelector('#stdFaixa'), info = raiz.querySelector('#stdLinhaInfo'); if (!faixa) return;
      var total = 0, ds = slides().map(function (sl) { var d = duracaoDe(sl); total += d; return d; });
      var alvo = S.settings.duracao_min * 60, dif = total - alvo;
      info.textContent = 'Total ' + mmss(total) + ' de ' + mmss(alvo) + ' planejados' + (Math.abs(dif) > alvo * 0.15 ? (dif > 0 ? ' · passou ' : ' · faltam ') + mmss(Math.abs(dif)) : ' · dentro do planejado');
      info.className = 'std-linha-info' + (Math.abs(dif) > alvo * 0.15 ? ' fora' : '');
      faixa.innerHTML = '';
      slides().forEach(function (sl, i) {
        var n = S.narr[sl.id], pronta = n && n.situacao === 'pronta' && !S.sujo;
        faixa.appendChild(el('button', { type: 'button', class: 'std-seg' + (i === S.atual ? ' atual' : '') + (pronta ? ' pronta' : ''), style: 'flex-grow:' + Math.max(ds[i], 1),
          title: (i + 1) + '. ' + (sl.titulo || '') + ' · ' + mmss(ds[i]) + (pronta ? ' (narração)' : ' (estimado)'), 'aria-label': 'Slide ' + (i + 1) + ', ' + mmss(ds[i]),
          onclick: function () { S.atual = i; desenharTudo(); } }, [el('span', { text: String(i + 1) })]));
      });
    }

    /* ---------- prévia completa ---------- */
    var P = null;
    function pararPrevia() {
      if (!P) return;
      P.parado = true; clearTimeout(P.t); clearInterval(P.tick);
      if (P.audio) { P.audio.onerror = P.audio.onended = null; P.audio.pause(); P.audio.removeAttribute('src'); }
      if (P.video) { P.video.onended = null; P.video.pause(); P.video.removeAttribute('src'); }
      try { speechSynthesis.cancel(); } catch (e) { }
      if (P.no && P.no.isConnected) P.no.remove();
      P = null;
    }
    async function previa(inicio, soUm, paraPublicar) {
      pararPrevia();
      var links = {};
      if (!S.sujo) { try { var j = await call({ acao: 'narracoes', id: S.id }); j.narracoes.forEach(function (n) { S.narr[n.slide_id] = n; if (n.url) links[n.slide_id] = n.url; }); } catch (e) { } }
      var intro = null;
      if (!soUm && !inicio && S.settings.abertura === 'video' && S.settings.abertura_video) { try { var ja = await call({ acao: 'abertura_url', id: S.id }); if (ja.url) intro = ja.url; } catch (e) { } }
      P = { i: intro ? -1 : (inicio || 0), parado: false, pausa: false, navegador: !!S.settings.voz_teste, viuTudo: false, inicio: inicio || 0 };
      var tela = el('div', { class: 'std-tela' }), leg = el('div', { class: 'std-legenda', 'aria-live': 'off' }), barra = el('div', { class: 'std-prog' }, [el('i')]);
      var rot = el('span', { class: 'std-previa-info' });
      var voz = el('label', { class: 'std-check claro' }, [el('input', { type: 'checkbox', checked: P.navegador, onchange: function () { P.navegador = this.checked; if (P.i >= 0) tocar(); } }), ' Voz de teste do navegador nos slides sem narração (não é a sua voz)']);
      var semAudio = slides().some(function (sl) { return sl.roteiro && !links[sl.id]; });
      P.no = el('div', { class: 'std-previa', role: 'dialog', 'aria-label': 'Prévia da apresentação' }, [
        el('div', { class: 'std-previa-topo' }, [rot, semAudio && 'speechSynthesis' in window ? voz : null, el('button', { class: 'std-fechar', type: 'button', 'aria-label': 'Fechar prévia', onclick: pararPrevia }, ['×'])]),
        tela, leg, barra,
        el('div', { class: 'std-previa-ctl' }, [
          el('button', { type: 'button', 'aria-label': 'Slide anterior', onclick: function () { ir(P.i - 1); } }, ['⏮']),
          el('button', { type: 'button', id: 'stdPlay', 'aria-label': 'Pausar', onclick: function () { P.pausa = !P.pausa; this.textContent = P.pausa ? '▶' : '⏸'; this.setAttribute('aria-label', P.pausa ? 'Continuar' : 'Pausar'); if (P.video) { if (P.pausa) P.video.pause(); else P.video.play().catch(function () { }); } if (P.audio) { if (P.pausa) P.audio.pause(); else P.audio.play().catch(function () { }); } if (P.pausa) { try { speechSynthesis.pause(); } catch (e) { } } else { try { speechSynthesis.resume(); } catch (e) { } } } }, ['⏸']),
          el('button', { type: 'button', 'aria-label': 'Próximo slide', onclick: function () { ir(P.i + 1); } }, ['⏭'])])]);
      raiz.appendChild(P.no);
      P.no.querySelector('.std-fechar').focus();
      function ir(i) { if (!P) return; if (i < 0) i = 0; if (i >= slides().length || (soUm && i !== P.inicio)) return fim(); P.i = i; tocar(); }
      function fim() {
        if (!P) return;
        if (!soUm && P.inicio === 0 && !S.sujo) { S.previaVersao = S.version; }
        tela.innerHTML = ''; tela.appendChild(el('div', { class: 'std-fim' }, [el('p', { text: soUm ? 'Fim do slide.' : 'Fim da prévia.' }),
          !soUm && S.sujo ? el('p', { class: 'std-dica claro', text: 'Salve para que esta prévia valha para publicar.' }) : null,
          paraPublicar && S.previaVersao === S.version ? el('button', { class: 'btn btn--gold', type: 'button', onclick: function () { pararPrevia(); publicar(); } }, ['Publicar agora']) : null]));
        leg.textContent = ''; barra.firstChild.style.width = '100%';
      }
      function tocar() {
        if (!P || P.parado) return;
        clearTimeout(P.t); clearInterval(P.tick);
        if (P.audio) { P.audio.onerror = P.audio.onended = null; P.audio.pause(); P.audio = null; }
        if (P.video) { P.video.onended = null; P.video.pause(); P.video = null; }
        try { speechSynthesis.cancel(); } catch (e) { }
        tela.innerHTML = '';
        if (P.i < 0) {
          // vídeo de abertura gravado: toca antes do primeiro slide
          P.video = el('video', { class: 'std-intro', playsinline: true, src: intro });
          P.video.onended = function () { if (P) ir(0); };
          P.video.onerror = function () { if (P) { rot.textContent = 'O vídeo de abertura não carregou'; ir(0); } };
          P.video.ontimeupdate = function () { if (P && P.video && isFinite(P.video.duration)) barra.firstChild.style.width = Math.min(100, (P.video.currentTime / P.video.duration) / (slides().length + 1) * 100) + '%'; };
          tela.appendChild(P.video); leg.textContent = '';
          rot.textContent = 'Abertura · vídeo gravado';
          P.video.play().catch(function () { rot.textContent += ' · clique em ▶ para tocar'; P.pausa = true; });
          return;
        }
        var sl = slides()[P.i];
        var no = NA.renderizar(NA.validar({ titulo: S.titulo, slides: [sl] }).slides[0], { numero: P.i + 1, total: slides().length });
        if (S.settings.transicao === 'suave') no.classList.add('std-entra');
        tela.appendChild(no);
        leg.textContent = S.settings.legendas ? (sl.roteiro || '') : '';
        var url = links[sl.id];
        rot.textContent = 'Slide ' + (P.i + 1) + ' de ' + slides().length + ' · ' + (url ? 'narração com a sua voz' : P.navegador && sl.roteiro ? 'voz de teste do navegador (não é a sua voz)' : sl.roteiro ? 'sem narração: tempo estimado' : 'sem roteiro');
        var dur = (sl.duracao || estimar(sl.roteiro, S.settings.ritmo) || 6) * 1000, t0 = Date.now();
        var prog = function (fr) { barra.firstChild.style.width = Math.min(100, ((P.i + Math.min(fr, 1)) / slides().length) * 100) + '%'; };
        if (url) {
          P.audio = new Audio(url);
          P.audio.onended = function () { if (P) ir(P.i + 1); };
          P.audio.ontimeupdate = function () { if (P && P.audio && P.audio.duration) prog(P.audio.currentTime / P.audio.duration); };
          P.audio.onerror = function () { if (!P || P.parado) return; rot.textContent += ' · o áudio não carregou'; P.t = setTimeout(function () { if (P) ir(P.i + 1); }, dur); };
          P.audio.play().catch(function () { rot.textContent += ' · clique em ▶ para tocar'; P.pausa = true; });
        } else if (P.navegador && sl.roteiro && 'speechSynthesis' in window) {
          var u = new SpeechSynthesisUtterance(sl.roteiro); u.lang = S.settings.idioma; u.rate = S.settings.ritmo === 'rapido' ? 1.1 : S.settings.ritmo === 'calmo' ? 0.9 : 1;
          var vz = vozDoNavegador(S.settings.idioma); if (vz) u.voice = vz;
          u.onend = function () { if (P && !P.parado) ir(P.i + 1); };
          speechSynthesis.speak(u);
          P.tick = setInterval(function () { prog((Date.now() - t0) / dur); }, 200);
        } else {
          var gasto = 0, ultimo = Date.now();
          P.tick = setInterval(function () { var ag = Date.now(); if (!P.pausa) gasto += ag - ultimo; ultimo = ag; prog(gasto / dur); if (gasto >= dur) { clearInterval(P.tick); ir(P.i + 1); } }, 200);
        }
      }
      tocar();
    }
    /* ---------- abertura: texto do teleprompter, gravação pela câmera e vídeo ---------- */
    function ladoAbertura(c) {
      var cfg = S.settings;
      c.appendChild(el('h3', { text: 'Abertura' }));
      c.appendChild(el('p', { class: 'std-dica', text: 'Grave uma introdução com a sua câmera. Na tela de gravação você escreve (ou gera com IA) o texto do teleprompter, ensaia, escolhe câmera, microfone e fundo virtual, e grava. Ela toca antes do primeiro slide, na prévia e no webinar.' }));
      c.appendChild(campo('Como o webinar começa', el('select', { onchange: function () { cfg.abertura = this.value; mudou(); desenharLado(); } },
        [['video', 'Com a minha introdução gravada'], ['ao_vivo', 'Eu abro ao vivo'], ['nenhuma', 'Direto nos slides']].map(function (x) { return el('option', { value: x[0], selected: cfg.abertura === x[0], disabled: x[0] === 'video' && !cfg.abertura_video }, [x[1] + (x[0] === 'video' && !cfg.abertura_video ? ' (grave primeiro)' : '')]); }))));
      c.appendChild(el('button', { class: 'btn btn--navy btn--sm', type: 'button', onclick: gravarIntro }, ['● Gravar introdução']));
      if (cfg.abertura_texto) c.appendChild(el('p', { class: 'std-dica', text: 'Texto do teleprompter: ' + palavras(cfg.abertura_texto) + ' palavras · cerca de ' + mmss(estimar(cfg.abertura_texto, cfg.ritmo)) + ' de fala.' }));
      var box = el('div', { class: 'std-caixa' }, [el('h4', { text: 'Vídeo de abertura' })]);
      if (cfg.abertura_video) {
        var v = el('video', { controls: true, playsinline: true, class: 'std-intro-mini', preload: 'metadata' });
        call({ acao: 'abertura_url', id: S.id }).then(function (j) { if (j.url) v.src = j.url; }, function () { });
        box.appendChild(v);
        box.appendChild(el('p', { class: 'std-dica', text: 'Duração: ' + mmss(cfg.abertura_video.duracao_ms / 1000) + (cfg.abertura === 'video' ? ' · toca antes do primeiro slide' : ' · não está em uso (escolha “Com a minha introdução gravada”)') }));
        box.appendChild(el('div', { class: 'std-linha-botoes' }, [el('button', { class: 'btn btn--ghost btn--xs', type: 'button', onclick: gravarIntro }, ['Regravar']),
          el('button', { class: 'btn btn--ghost btn--xs', type: 'button', onclick: function () { apagarIntro(this); } }, ['Apagar vídeo'])]));
      } else box.appendChild(el('p', { class: 'std-dica', text: 'Nenhum vídeo ainda.' }));
      var arq = el('input', { type: 'file', accept: 'video/mp4,video/webm' });
      arq.onchange = async function () {
        var f = arq.files[0]; if (!f) return;
        var ms = await duracaoVideo(f);
        enviarIntro(f, ms, f.type || 'video/mp4');
      };
      box.appendChild(campo('Ou envie um vídeo seu (MP4 ou WebM, até 100 MB)', arq));
      c.appendChild(box);
    }
    async function escreverAbertura(pedido) {
      var j = await call({ acao: 'studio_ia', id: S.id, modo: 'abertura', pedido: pedido || '', settings: S.settings, content: S.content });
      S.settings.abertura_texto = j.texto; mudou();
      return j.texto;
    }
    async function apagarIntro(btn) {
      if (!confirm('Apagar o vídeo de abertura?')) return;
      btn.disabled = true;
      try { var j = await call({ acao: 'abertura_apagar', id: S.id }); S.version = j.version; S.settings.abertura_video = null; if (S.settings.abertura === 'video') S.settings.abertura = 'ao_vivo'; atualizarBarra(); desenharLado(); aviso('Vídeo apagado.', 'ok'); }
      catch (e) { btn.disabled = false; aviso(e.message, 'erro'); }
    }
    async function enviarIntro(blob, ms, mime) {
      mime = String(mime || 'video/webm').split(';')[0];
      if (blob.size > 100 * 1024 * 1024) return aviso('O vídeo passou de 100 MB. Grave uma introdução mais curta.', 'erro');
      aviso('Enviando o vídeo… não feche esta janela.', 'ok');
      try {
        var u = await call({ acao: 'abertura_upload_url', id: S.id, mime: mime, tamanho: blob.size });
        var up = await ctx.sb.storage.from('meet-media').uploadToSignedUrl(u.path, u.token, blob, { contentType: mime });
        if (up.error) throw new Error('O envio falhou: ' + up.error.message);
        var j = await call({ acao: 'abertura_confirmar', id: S.id, path: u.path, duracao_ms: Math.round(ms), mime: mime });
        S.version = j.version; S.settings.abertura_video = j.abertura_video; S.settings.abertura = 'video';
        S.aba = 'abertura'; atualizarBarra(); desenharLado(); desenharLinha(); aviso('Introdução salva. Ela toca antes do primeiro slide.', 'ok');
        return true;
      } catch (e) { aviso(e.message, 'erro'); return false; }
    }

    /* ---------- gravador da introdução: texto, câmera, microfone, fundo, ensaio e gravação ---------- */
    var R = null;
    var FUNDOS = [['marca', 'Marca'], ['reuniao', 'Sala de reunião'], ['claro', 'Escritório claro'], ['chicago', 'Chicago'], ['bh', 'Belo Horizonte'], ['biblioteca', 'Biblioteca']];
    var imgFundo = function (id) { return BASE + (id === 'marca' ? 'meet/img/fundo-endeavor.jpg' : 'meet/img/fundo-' + id + '.jpg?v=3'); };
    var miniFundo = function (id) { return BASE + (id === 'marca' ? 'meet/img/fundo-endeavor-mini.jpg' : 'meet/img/fundo-' + id + '-mini.jpg?v=3'); };
    function lerPref(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
    function gravarPref(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function pararCamera() {
      if (!R) return;
      cancelAnimationFrame(R.raf); cancelAnimationFrame(R.rafNivel); clearInterval(R.timer); clearInterval(R.contagem);
      try { if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); } catch (e) { }
      if (R.proc) { try { R.proc.destroy(); } catch (e) { } R.proc = null; }
      if (R.stream) R.stream.getTracks().forEach(function (t) { t.stop(); }); R.stream = null;
      if (R.audioCtx) { try { R.audioCtx.close(); } catch (e) { } R.audioCtx = null; }
    }
    function fecharGravador() {
      if (R && R.telaCheia) document.removeEventListener('fullscreenchange', R.telaCheia);
      if (R && document.fullscreenElement === R.no) document.exitFullscreen().catch(function () { });
      pararCamera(); if (R && R.no) R.no.remove(); R = null;
    }
    async function gravarIntro() {
      fecharGravador();
      var cfg = S.settings, vel = Number(lerPref('std-prompter-vel', 40)) || 40, fonte = Number(lerPref('std-prompter-fonte', 40)) || 40;
      R = { estado: 'pronto', partes: [], blob: null, ms: 0, micMudo: false, somMudo: false, fundo: lerPref('std-grav-fundo', 'nenhum'), foto: lerPref('emeet-fundo-foto', null), painel: cfg.abertura_texto ? '' : 'texto' };
      var SVG = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; };
      var ICO = { mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', micOff: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 4.5 2.6M15 9V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18',
        som: 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11', somOff: 'M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6' };

      /* --- palco --- */
      var cam = el('video', { class: 'std-grav-cam', autoplay: true, muted: true, playsinline: true });
      var texto = el('div', { class: 'std-prompter-texto', style: 'font-size:' + fonte + 'px' });
      var prompter = el('div', { class: 'std-prompter', 'aria-live': 'off' }, [el('div', { class: 'std-prompter-guia' }), texto]);
      var contagem = el('div', { class: 'std-contagem', hidden: true });
      var rev = el('video', { class: 'std-grav-rev', controls: true, playsinline: true, hidden: true });
      var selo = el('span', { class: 'std-grav-selo', hidden: true });
      var tempo = el('span', { class: 'std-grav-tempo', text: '0:00' });
      var msg = el('p', { class: 'std-grav-msg', role: 'status' });
      function mostrarTexto() { texto.textContent = cfg.abertura_texto || 'Escreva o texto do teleprompter em “Texto” (ou gere com IA). Ele aparece aqui.'; }
      mostrarTexto();

      /* --- painel lateral: Texto | Câmera e microfone | Fundo virtual --- */
      /* aba na lateral: desliza por cima (não aperta a tela). Seções: Texto, Câmera e microfone, Fundo virtual, Tela cheia */
      var painel = el('div', { class: 'std-grav-painel' });
      var secoes = [['texto', '✎ Texto'], ['dispositivos', 'Câmera e microfone'], ['fundo', 'Fundo virtual']].map(function (x) {
        return el('button', { type: 'button', class: 'std-grav-aba', 'data-p': x[0], 'aria-pressed': 'false', onclick: function () { abrirPainel(x[0]); } }, [x[1]]);
      });
      var bTela = el('button', { type: 'button', class: 'std-grav-aba', 'data-p': 'tela', 'aria-pressed': 'false', onclick: function () {
        if (document.fullscreenElement) { document.exitFullscreen().catch(function () { }); return; }
        if (R.no.requestFullscreen) R.no.requestFullscreen({ navigationUI: 'hide' }).catch(function () { msg.textContent = 'O navegador não deixou abrir em tela cheia. Tente F11 (Windows) ou Ctrl+Cmd+F (Mac).'; });
      } }, ['⛶ Tela cheia']);
      var gaveta = el('aside', { class: 'std-grav-gaveta', 'aria-label': 'Ajustes da gravação', 'aria-hidden': 'true' }, [
        el('div', { class: 'std-grav-gaveta-topo' }, [el('strong', { text: 'Ajustes' }), el('button', { type: 'button', class: 'std-fechar', 'aria-label': 'Fechar ajustes', onclick: function () { fecharGaveta(); } }, ['›'])]),
        el('div', { class: 'std-grav-secoes' }, secoes.concat([bTela])), painel]);
      var alca = el('button', { type: 'button', class: 'std-grav-alca', 'aria-expanded': 'false', 'aria-label': 'Abrir ajustes: texto, câmera e microfone, fundo virtual e tela cheia', onclick: function () { if (R.painel) fecharGaveta(); else abrirPainel(R.ultimoPainel || 'texto'); } }, [el('span', { text: 'Ajustes' })]);
      function abrirPainel(p) {
        R.painel = p; R.ultimoPainel = p;
        secoes.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.p === p)); });
        gaveta.classList.add('aberta'); gaveta.setAttribute('aria-hidden', 'false'); alca.setAttribute('aria-expanded', 'true');
        painel.innerHTML = '';
        if (p === 'texto') painelTexto(); else if (p === 'dispositivos') painelDispositivos(); else if (p === 'fundo') painelFundo();
      }
      function fecharGaveta() {
        R.painel = ''; gaveta.classList.remove('aberta'); gaveta.setAttribute('aria-hidden', 'true'); alca.setAttribute('aria-expanded', 'false'); alca.focus();
      }
      function painelTexto() {
        var info = el('p', { class: 'std-dica claro' });
        var conta = function () { info.textContent = palavras(cfg.abertura_texto) + ' palavras · cerca de ' + mmss(estimar(cfg.abertura_texto, cfg.ritmo)) + ' de fala.'; };
        var ta = el('textarea', { rows: '12', maxlength: '4000', class: 'std-grav-ta', 'aria-label': 'Texto do teleprompter', placeholder: 'Escreva ou cole aqui o texto que você vai ler. Um parágrafo por ideia.',
          oninput: function () { cfg.abertura_texto = this.value; conta(); mostrarTexto(); mudou(); } }, [cfg.abertura_texto || '']);
        var pedido = el('input', { maxlength: '300', class: 'std-grav-in', placeholder: 'Opcional: o que a IA deve dizer (ex.: mais curto, falar do meu nome)', 'aria-label': 'Pedido para a IA' });
        var bIA = el('button', { class: 'btn btn--gold btn--sm', type: 'button', disabled: !S.cap.texto, onclick: async function () {
          if (cfg.abertura_texto && !confirm('Substituir o texto atual do teleprompter?')) return;
          bIA.disabled = true; bIA.textContent = 'Escrevendo…';
          try { ta.value = await escreverAbertura(pedido.value); conta(); mostrarTexto(); msg.textContent = 'Texto pronto. Revise, ensaie e grave.'; }
          catch (e) { msg.textContent = e.message; }
          bIA.disabled = false; bIA.textContent = '✦ Escrever com IA';
        } }, ['✦ Escrever com IA']);
        painel.appendChild(el('h3', { text: 'Texto do teleprompter' }));
        painel.appendChild(ta); painel.appendChild(info); conta();
        painel.appendChild(pedido); painel.appendChild(bIA);
        painel.appendChild(el('p', { class: 'std-dica claro', text: 'O texto fica salvo junto com a apresentação (clique em Salvar no Studio).' }));
      }
      async function painelDispositivos() {
        painel.appendChild(el('h3', { text: 'Câmera e microfone' }));
        var lista = [];
        try { lista = await navigator.mediaDevices.enumerateDevices(); } catch (e) { }
        if (!R || R.painel !== 'dispositivos') return;
        var opc = function (tipo, atual) { return lista.filter(function (d) { return d.kind === tipo; }).map(function (d, i) { return el('option', { value: d.deviceId, selected: d.deviceId === atual, text: d.label || (tipo === 'videoinput' ? 'Câmera ' : 'Microfone ') + (i + 1) }); }); };
        var trilha = function (k) { var t = R.stream && (k === 'v' ? R.stream.getVideoTracks()[0] : R.stream.getAudioTracks()[0]); return t && t.getSettings ? t.getSettings().deviceId : ''; };
        var sCam = el('select', { class: 'std-grav-in', disabled: R.estado === 'gravando', onchange: function () { gravarPref('std-grav-cam', this.value); ligarCamera(); } }, opc('videoinput', trilha('v')));
        var sMic = el('select', { class: 'std-grav-in', disabled: R.estado === 'gravando', onchange: function () { gravarPref('std-grav-mic', this.value); ligarCamera(); } }, opc('audioinput', trilha('a')));
        painel.appendChild(el('label', { class: 'std-grav-campo' }, ['Câmera', sCam]));
        painel.appendChild(el('label', { class: 'std-grav-campo' }, ['Microfone', sMic]));
        painel.appendChild(el('div', { class: 'std-grav-nivel', 'aria-hidden': 'true' }, [el('i', { id: 'stdNivel' })]));
        painel.appendChild(el('p', { class: 'std-dica claro', text: 'Câmeras e microfones externos (USB, Bluetooth) aparecem aqui depois de conectados. A barra acima mostra o volume do microfone: fale para conferir.' }));
      }
      function painelFundo() {
        painel.appendChild(el('h3', { text: 'Fundo virtual' }));
        var grade = el('div', { class: 'std-grav-fundos', role: 'radiogroup', 'aria-label': 'Fundo virtual' });
        var item = function (id, rot, mini) {
          return el('button', { type: 'button', role: 'radio', class: 'std-grav-fundo', 'aria-checked': String(R.fundo === id), disabled: R.estado === 'gravando' && (R.fundo === 'nenhum') !== (id === 'nenhum'), onclick: function () { escolherFundo(id); } },
            [mini ? el('img', { src: mini, alt: '' }) : el('span', { class: 'std-grav-fundo-ic', text: id === 'nenhum' ? '∅' : '◌' }), el('span', { text: rot })]);
        };
        grade.appendChild(item('nenhum', 'Nenhum')); grade.appendChild(item('desfoque', 'Desfocado'));
        FUNDOS.forEach(function (f) { grade.appendChild(item('img:' + f[0], f[1], miniFundo(f[0]))); });
        if (R.foto) grade.appendChild(item('foto', 'Sua foto', R.foto));
        painel.appendChild(grade);
        var arq = el('input', { type: 'file', accept: 'image/*', class: 'std-grav-in', onchange: function () { if (this.files[0]) usarFoto(this.files[0]); } });
        painel.appendChild(el('label', { class: 'std-grav-campo' }, [R.foto ? 'Trocar a sua foto' : 'Adicionar a sua foto', arq]));
        painel.appendChild(el('p', { class: 'std-dica claro', text: 'Os mesmos fundos do Web Meeting. A sua foto fica só neste computador. Durante a gravação dá para trocar de imagem, mas não ligar ou desligar o fundo.' }));
      }
      async function usarFoto(f) {
        if (!/^image\//.test(f.type)) { msg.textContent = 'Escolha uma imagem (JPG ou PNG).'; return; }
        try {
          var u = URL.createObjectURL(f), img = new Image(); img.src = u; await img.decode();
          var esc = Math.min(1, 1920 / img.naturalWidth, 1920 / img.naturalHeight), cv = document.createElement('canvas');
          cv.width = Math.round(img.naturalWidth * esc); cv.height = Math.round(img.naturalHeight * esc); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
          var d = cv.toDataURL('image/jpeg', 0.85); if (!gravarPref('emeet-fundo-foto', d)) { d = cv.toDataURL('image/jpeg', 0.6); gravarPref('emeet-fundo-foto', d); }
          R.foto = d; await escolherFundo('foto'); if (R.painel === 'fundo') { R.painel = ''; abrirPainel('fundo'); }
        } catch (e) { msg.textContent = 'Não foi possível abrir essa imagem.'; }
      }
      function opFundo(id) { return id === 'desfoque' ? { modo: 'desfoque' } : { modo: 'imagem', imagem: id === 'foto' ? R.foto : imgFundo(id.slice(4)) }; }
      async function carregarFundo() {
        if (window.EndeavorFundo) return;
        await carregarScript('meet/vendor/fundo-suave.js?v=3');
      }
      async function escolherFundo(id) {
        var antes = R.fundo; R.fundo = id; gravarPref('std-grav-fundo', id);
        if (R.painel === 'fundo') { R.painel = ''; abrirPainel('fundo'); }
        try { await aplicarFundo(antes); }
        catch (e) { R.fundo = antes; gravarPref('std-grav-fundo', antes); msg.textContent = e.message || 'Não foi possível aplicar o fundo.'; await aplicarFundo('x').catch(function () { }); }
      }
      /** Liga o processador do fundo (o mesmo do Web Meeting) sobre a trilha da câmera; troca de imagem sem reiniciar. */
      async function aplicarFundo(antes) {
        var v = R.stream && R.stream.getVideoTracks()[0]; if (!v) return;
        if (R.fundo === 'nenhum') {
          if (R.proc) { try { R.proc.destroy(); } catch (e) { } R.proc = null; }
          R.saida = v; cam.srcObject = new MediaStream([v]); cam.classList.remove('sem-espelho'); return;
        }
        if (R.proc && R.proc.trocar && antes !== 'nenhum') { await R.proc.trocar(opFundo(R.fundo)); }
        else {
          msg.textContent = 'Preparando o fundo…';
          await carregarFundo();
          if (!window.EndeavorFundo || !EndeavorFundo.suportado()) throw new Error('Este navegador não suporta fundo virtual.');
          var p = EndeavorFundo.criar(Object.assign({ base: BASE + 'meet/vendor/mediapipe' }, opFundo(R.fundo)));
          await p.init({ track: v });
          if (R.proc) { try { R.proc.destroy(); } catch (e) { } }
          R.proc = p; R.saida = p.processedTrack; cam.srcObject = new MediaStream([p.processedTrack]);
          msg.textContent = '';
        }
        cam.classList.toggle('sem-espelho', R.fundo !== 'desfoque');
      }

      /* --- barra: Velocidade, Letra, Ensaiar, Início do texto, Pausar texto, Gravar, microfone, alto-falante --- */
      var sVel = el('input', { type: 'range', min: '10', max: '140', step: '5', value: String(vel), 'aria-label': 'Velocidade do texto', oninput: function () { vel = Number(this.value); gravarPref('std-prompter-vel', vel); } });
      var sFonte = el('input', { type: 'range', min: '22', max: '72', step: '2', value: String(fonte), 'aria-label': 'Tamanho da letra', oninput: function () { fonte = Number(this.value); texto.style.fontSize = fonte + 'px'; gravarPref('std-prompter-fonte', fonte); } });
      var bEnsaio = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { if (R.estado === 'ensaiando' || R.estado === 'contando-ensaio') pararEnsaio(); else contar('ensaio'); } }, ['▶ Ensaiar']);
      var bTopo = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { prompter.scrollTop = 0; } }, ['↑ Início do texto']);
      var bPausa = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () { R.pausaTexto = !R.pausaTexto; this.textContent = R.pausaTexto ? '▶ Rolar texto' : '❚❚ Pausar texto'; } }, ['❚❚ Pausar texto']);
      var bGravar = el('button', { class: 'std-grav-rec', type: 'button', onclick: function () { if (R.estado === 'ensaiando' || R.estado === 'contando-ensaio') pararEnsaio(); contar('gravar'); } }, ['● Gravar']);
      var bParar = el('button', { class: 'std-grav-rec parar', type: 'button', hidden: true, onclick: parar }, ['■ Parar']);
      var bRegravar = el('button', { class: 'btn btn--ghost btn--sm', type: 'button', hidden: true, onclick: regravar }, ['↺ Regravar']);
      var bUsar = el('button', { class: 'btn btn--gold btn--sm', type: 'button', hidden: true, onclick: async function () { bUsar.disabled = bRegravar.disabled = true; msg.textContent = 'Enviando…'; var ok = await enviarIntro(R.blob, R.ms, R.blob.type); if (ok) fecharGravador(); else { bUsar.disabled = bRegravar.disabled = false; msg.textContent = 'Não foi possível enviar. Tente de novo.'; } } }, ['Usar esta gravação']);
      var bMic = el('button', { class: 'std-grav-ic', type: 'button', 'aria-pressed': 'false', title: 'Desligar o microfone', 'aria-label': 'Desligar o microfone', onclick: function () {
        R.micMudo = !R.micMudo; if (R.stream) R.stream.getAudioTracks().forEach(function (t) { t.enabled = !R.micMudo; });
        this.setAttribute('aria-pressed', String(R.micMudo)); this.innerHTML = SVG(R.micMudo ? ICO.micOff : ICO.mic); this.classList.toggle('off', R.micMudo);
        this.setAttribute('aria-label', R.micMudo ? 'Ligar o microfone' : 'Desligar o microfone'); this.title = this.getAttribute('aria-label');
        if (R.micMudo && R.estado === 'gravando') msg.textContent = 'Microfone desligado: a gravação está sem som.';
      } });
      var bSom = el('button', { class: 'std-grav-ic', type: 'button', 'aria-pressed': 'false', title: 'Desligar o alto-falante', 'aria-label': 'Desligar o alto-falante', onclick: function () {
        R.somMudo = !R.somMudo; rev.muted = R.somMudo;
        this.setAttribute('aria-pressed', String(R.somMudo)); this.innerHTML = SVG(R.somMudo ? ICO.somOff : ICO.som); this.classList.toggle('off', R.somMudo);
        this.setAttribute('aria-label', R.somMudo ? 'Ligar o alto-falante' : 'Desligar o alto-falante'); this.title = this.getAttribute('aria-label');
      } });
      bMic.innerHTML = SVG(ICO.mic); bSom.innerHTML = SVG(ICO.som);

      R.telaCheia = function () {
        var on = !!R && document.fullscreenElement === R.no;
        bTela.setAttribute('aria-pressed', String(on)); bTela.textContent = on ? '✕ Sair da tela cheia' : '⛶ Tela cheia';
        if (R) R.no.classList.toggle('tela-cheia', on);
      };
      document.addEventListener('fullscreenchange', R.telaCheia);
      R.no = el('div', { class: 'std-grav', role: 'dialog', 'aria-label': 'Gravar introdução', tabindex: '-1' }, [
        el('div', { class: 'std-grav-topo' }, [el('strong', { text: 'Gravar introdução' }), selo, tempo, el('span', { class: 'std-grav-espaco' }),
          el('button', { class: 'std-fechar', type: 'button', 'aria-label': 'Fechar', onclick: function () { if (R && R.estado === 'gravando' && !confirm('Parar e descartar a gravação?')) return; fecharGravador(); } }, ['×'])]),
        el('div', { class: 'std-grav-meio' }, [el('div', { class: 'std-grav-palco' }, [el('div', { class: 'std-grav-quadro' }, [cam, prompter, contagem, rev])]), alca, gaveta]),
        msg,
        el('div', { class: 'std-grav-ctl' }, [
          el('label', { class: 'std-grav-ajuste' }, ['Velocidade', sVel]), el('label', { class: 'std-grav-ajuste' }, ['Letra', sFonte]),
          bEnsaio, bTopo, bPausa, bGravar, bParar, bRegravar, bUsar, bMic, bSom])]);
      raiz.appendChild(R.no);
      R.no.addEventListener('keydown', function (e) { if (e.key === ' ' && !/^(TEXTAREA|INPUT|SELECT|BUTTON)$/.test(e.target.tagName)) { e.preventDefault(); bPausa.click(); } });
      if (R.painel) { var p0 = R.painel; R.painel = ''; abrirPainel(p0); }
      R.no.addEventListener('keydown', function (e) { if (e.key === 'Escape' && R && R.painel && !document.fullscreenElement) { e.stopPropagation(); fecharGaveta(); } });
      R.no.focus();

      async function ligarCamera() {
        var gravando = R.estado === 'gravando'; if (gravando) return;
        if (R.proc) { try { R.proc.destroy(); } catch (e) { } R.proc = null; }
        if (R.stream) R.stream.getTracks().forEach(function (t) { t.stop(); });
        var camId = lerPref('std-grav-cam', ''), micId = lerPref('std-grav-mic', '');
        var pedir = function (exato) { return navigator.mediaDevices.getUserMedia({
          video: Object.assign({ width: { ideal: 1280 }, height: { ideal: 720 } }, exato && camId ? { deviceId: { exact: camId } } : { facingMode: 'user' }),
          audio: Object.assign({ echoCancellation: true, noiseSuppression: true }, exato && micId ? { deviceId: { exact: micId } } : {}) }); };
        try {
          try { R.stream = await pedir(true); } catch (e) { if (camId || micId) { R.stream = await pedir(false); } else throw e; }
          R.stream.getAudioTracks().forEach(function (t) { t.enabled = !R.micMudo; });
          R.saida = R.stream.getVideoTracks()[0]; cam.srcObject = new MediaStream([R.saida]); cam.classList.remove('sem-espelho');
          bGravar.disabled = bEnsaio.disabled = false;
          medirNivel();
          if (R.fundo !== 'nenhum') await aplicarFundo('nenhum').catch(function (e) { msg.textContent = e.message; R.fundo = 'nenhum'; });
          if (!msg.textContent) msg.textContent = 'Escreva ou gere o texto em “Texto”, ensaie com Ensaiar e grave quando estiver pronto.';
          if (R.painel === 'dispositivos') { R.painel = ''; abrirPainel('dispositivos'); }
        } catch (e) { msg.textContent = 'Não foi possível usar a câmera e o microfone: ' + e.message; bGravar.disabled = bEnsaio.disabled = true; }
      }
      function medirNivel() {
        try {
          if (R.audioCtx) R.audioCtx.close();
          var a = R.stream.getAudioTracks()[0]; if (!a || !window.AudioContext) return;
          R.audioCtx = new AudioContext(); var an = R.audioCtx.createAnalyser(); an.fftSize = 512;
          R.audioCtx.createMediaStreamSource(new MediaStream([a])).connect(an);
          var buf = new Uint8Array(an.fftSize);
          (function passo() { if (!R || !R.audioCtx) return; an.getByteTimeDomainData(buf); var m = 0; for (var i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128)); var n = document.getElementById('stdNivel'); if (n) n.style.width = Math.min(100, m / 64 * 100) + '%'; R.rafNivel = requestAnimationFrame(passo); })();
        } catch (e) { }
      }
      await ligarCamera();
      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', function () { if (R && R.painel === 'dispositivos') { R.painel = ''; abrirPainel('dispositivos'); } });

      function rolar() {
        var ult = performance.now();
        (function passo(agora) {
          if (!R || (R.estado !== 'gravando' && R.estado !== 'ensaiando')) return;
          if (!R.pausaTexto) prompter.scrollTop += vel * (agora - ult) / 1000;
          ult = agora; R.raf = requestAnimationFrame(passo);
        })(ult);
      }
      /** Contagem 3, 2, 1 antes de ensaiar e antes de gravar. */
      function contar(modo) {
        if (!R.stream) return;
        clearInterval(R.contagem); R.pausaTexto = false; bPausa.textContent = '❚❚ Pausar texto';
        R.estado = modo === 'ensaio' ? 'contando-ensaio' : 'contando'; prompter.scrollTop = 0;
        bGravar.hidden = modo !== 'ensaio'; bEnsaio.textContent = modo === 'ensaio' ? '■ Parar ensaio' : '▶ Ensaiar'; bEnsaio.disabled = modo !== 'ensaio';
        contagem.hidden = false; var n = 3; contagem.textContent = n;
        R.contagem = setInterval(function () {
          n--; if (n > 0) { contagem.textContent = n; return; }
          clearInterval(R.contagem); contagem.hidden = true;
          if (modo === 'ensaio') { R.estado = 'ensaiando'; selo.hidden = false; selo.textContent = 'ENSAIO · não está gravando'; selo.className = 'std-grav-selo ensaio'; msg.textContent = 'Ensaio: o texto rola sem gravar. Depois clique em Início do texto e em Gravar.'; rolar(); }
          else comecarGravacao();
        }, 1000);
      }
      function pararEnsaio() {
        clearInterval(R.contagem); cancelAnimationFrame(R.raf); contagem.hidden = true; selo.hidden = true;
        R.estado = 'pronto'; bEnsaio.textContent = '▶ Ensaiar'; bEnsaio.disabled = false; bGravar.hidden = false;
        msg.textContent = 'Ensaio parado. Clique em Início do texto e em Gravar quando estiver pronto.';
      }
      function comecarGravacao() {
        var mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); }) || '';
        R.partes = [];
        var trilhas = [R.saida].concat(R.stream.getAudioTracks());
        R.rec = new MediaRecorder(new MediaStream(trilhas), mime ? { mimeType: mime, videoBitsPerSecond: 1200000, audioBitsPerSecond: 96000 } : undefined);
        R.rec.ondataavailable = function (e) { if (e.data.size) R.partes.push(e.data); };
        R.rec.onstop = function () {
          R.ms = Date.now() - R.ini; R.estado = 'revisar'; selo.hidden = true; R.no.classList.add('revisando');
          R.blob = new Blob(R.partes, { type: (R.rec.mimeType || mime || 'video/webm').split(';')[0] });
          pararCamera();
          cam.hidden = true; prompter.hidden = true; rev.hidden = false; rev.muted = R.somMudo; rev.src = URL.createObjectURL(R.blob);
          bParar.hidden = true; bRegravar.hidden = false; bUsar.hidden = R.ms < 3000; bEnsaio.disabled = bTopo.disabled = bPausa.disabled = true;
          msg.textContent = R.ms < 3000 ? 'A gravação ficou curta demais. Regrave.' : 'Assista à gravação. Se gostou, clique em “Usar esta gravação”; senão, regrave.';
        };
        R.rec.start(1000); R.ini = Date.now(); R.estado = 'gravando'; bParar.hidden = false;
        selo.hidden = false; selo.textContent = '● GRAVANDO'; selo.className = 'std-grav-selo gravando';
        msg.textContent = R.micMudo ? 'Gravando com o microfone desligado.' : 'Gravando… (até 5 minutos). Espaço pausa o texto.';
        R.timer = setInterval(function () { var s = (Date.now() - R.ini) / 1000; tempo.textContent = '● ' + mmss(s); if (s >= 300) parar(); }, 250);
        rolar();
      }
      function parar() { clearInterval(R.timer); cancelAnimationFrame(R.raf); if (R.rec && R.rec.state !== 'inactive') R.rec.stop(); }
      async function regravar() {
        rev.hidden = true; rev.removeAttribute('src'); cam.hidden = false; prompter.hidden = false; R.no.classList.remove('revisando');
        bUsar.hidden = bRegravar.hidden = true; bGravar.hidden = false; bEnsaio.disabled = bTopo.disabled = bPausa.disabled = false;
        prompter.scrollTop = 0; tempo.textContent = '0:00'; msg.textContent = ''; R.estado = 'pronto';
        await ligarCamera();
      }
    }
    async function ouvir(slideId, btn) {
      try {
        var j = await call({ acao: 'narracoes', id: S.id });
        var n = j.narracoes.find(function (x) { return x.slide_id === slideId; });
        if (!n || !n.url) return aviso('A narração deste slide não está pronta.', 'erro');
        var a = new Audio(n.url); a.play(); btn.textContent = 'Tocando…'; a.onended = function () { btn.textContent = 'Ouvir'; };
      } catch (e) { aviso(e.message, 'erro'); }
    }
  }

  /** Voz do navegador para o idioma (a melhor disponível); null deixa o navegador escolher. */
  function vozDoNavegador(lang) {
    try {
      var vs = speechSynthesis.getVoices() || [], l = String(lang || 'pt-BR').toLowerCase(), base = l.slice(0, 2);
      return vs.find(function (v) { return v.lang.toLowerCase() === l && /google|natural|premium|enhanced/i.test(v.name); }) || vs.find(function (v) { return v.lang.toLowerCase() === l; }) || vs.find(function (v) { return v.lang.toLowerCase().indexOf(base) === 0; }) || null;
    } catch (e) { return null; }
  }
  /** Duração de um vídeo do computador (WebM gravado às vezes não traz a duração: força a leitura até o fim). */
  function duracaoVideo(blob) {
    return new Promise(function (ok) {
      var v = document.createElement('video'), u = URL.createObjectURL(blob), feito = false;
      var fim = function (ms) { if (feito) return; feito = true; URL.revokeObjectURL(u); ok(Math.max(1000, Math.round(ms || 0))); };
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { if (isFinite(v.duration) && v.duration > 0) return fim(v.duration * 1000); v.currentTime = 1e7; v.ontimeupdate = function () { v.ontimeupdate = null; fim(v.duration * 1000); }; };
      v.onerror = function () { fim(0); }; setTimeout(function () { fim(0); }, 8000);
      v.src = u;
    });
  }

  /* ---------------- leitura de arquivos (no navegador; o arquivo não sai do computador) ---------------- */
  async function lerPdf(f) {
    await carregarScript('meet/vendor/pdf.min.js');
    var lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = BASE + 'meet/vendor/pdf.worker.min.js';
    var doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
    var out = [];
    for (var p = 1; p <= Math.min(doc.numPages, 30); p++) {
      var pg = await doc.getPage(p), tc = await pg.getTextContent(), linhas = [], y = null, atual = '';
      tc.items.forEach(function (it) {
        var yy = Math.round(it.transform[5]);
        if (y !== null && Math.abs(yy - y) > 3) { if (atual.trim()) linhas.push(atual.trim()); atual = ''; }
        atual += (atual && !/\s$/.test(atual) && !/^\s/.test(it.str) ? ' ' : '') + it.str; y = yy;
      });
      if (atual.trim()) linhas.push(atual.trim());
      out.push({ texto: linhas.join('\n').replace(/[ \t]+/g, ' ').slice(0, 2500), notas: '' });
    }
    return out;
  }
  async function lerPptx(f) {
    await carregarScript('meet/vendor/jszip.min.js');
    var zip = await window.JSZip.loadAsync(await f.arrayBuffer());
    var nomes = Object.keys(zip.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); })
      .sort(function (a, b) { return Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]); });
    // ordem real da apresentação (presentation.xml + rels); se falhar, usa a numeração dos arquivos
    try {
      var pres = new DOMParser().parseFromString(await zip.file('ppt/presentation.xml').async('string'), 'application/xml');
      var rels = new DOMParser().parseFromString(await zip.file('ppt/_rels/presentation.xml.rels').async('string'), 'application/xml');
      var alvo = {}; Array.prototype.forEach.call(rels.getElementsByTagName('Relationship'), function (r) { alvo[r.getAttribute('Id')] = 'ppt/' + r.getAttribute('Target').replace(/^\/?ppt\//, ''); });
      var ord = Array.prototype.map.call(pres.getElementsByTagNameNS('*', 'sldId'), function (s) { return alvo[s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')]; }).filter(function (n) { return n && zip.file(n); });
      if (ord.length) nomes = ord;
    } catch (e) { }
    var textoDe = function (xml) {
      var d = new DOMParser().parseFromString(xml, 'application/xml');
      return Array.prototype.map.call(d.getElementsByTagNameNS('*', 'p'), function (p) { return Array.prototype.map.call(p.getElementsByTagNameNS('*', 't'), function (t) { return t.textContent; }).join(''); })
        .map(function (x) { return x.trim(); }).filter(Boolean);
    };
    var out = [];
    for (var i = 0; i < Math.min(nomes.length, 30); i++) {
      var n = nomes[i], texto = textoDe(await zip.file(n).async('string')), notas = [];
      var rel = zip.file(n.replace('slides/', 'slides/_rels/') + '.rels');
      if (rel) {
        var m = (await rel.async('string')).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
        if (m && zip.file('ppt/notesSlides/' + m[1])) notas = textoDe(await zip.file('ppt/notesSlides/' + m[1]).async('string')).filter(function (x) { return !/^\d+$/.test(x); });
      }
      out.push({ texto: texto.join('\n').slice(0, 2500), notas: notas.join(' ').slice(0, 1500) });
    }
    return out;
  }

  window.EMeetStudio = { render: render, abrir: abrir, _lerPdf: lerPdf, _lerPptx: lerPptx };
})();
