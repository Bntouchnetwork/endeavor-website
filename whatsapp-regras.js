/* Endeavor · WhatsApp Manager: Perfil e regras, Fluxos (com modelos de documentos) e Pedidos ao CRM.
 *   EWaRegras.perfilRegras(corpo, ctx, call, d) | EWaRegras.fluxos(...) | EWaRegras.pedidos(...) | EWaRegras.soLeitura(el)
 * Cada empresa escreve as próprias regras e fluxos; a IA pode sugerir (com base no perfil do negócio) e a empresa revisa,
 * edita e salva. As proteções fixas aparecem aqui só para leitura: nenhuma regra muda isso. */
(function () {
  'use strict';
  var PROTECOES = [
    'Nunca informar preços, valores, taxas ou descontos. Valores só na proposta oficial, enviada pela equipe.',
    'Nunca pedir documentos, fotos de documentos, números de documentos (SSN, ITIN, passaporte, CPF) ou dados bancários.',
    'Não receber documentos pelo WhatsApp: por compliance, a lista e o link seguro para enviar os arquivos vão por e-mail.',
    'Identificar-se como assistente virtual na primeira resposta automática de cada conversa.',
    'Nunca prometer aprovações, vistos, resultados ou prazos de governo ou de banco.'];
  var PASSOS = { mensagem: 'Mensagem (o que a IA explica)', coletar: 'Pedir dados', crm_documentos: 'CRM: pedido de documentos (pasta, link da Initial Docs, e-mail e follow-up)',
    crm_proposta: 'CRM: pedido de proposta para a equipe', agendar: 'Oferecer horários / link de agendamento', avisar_equipe: 'Avisar a equipe' };
  var CAMPOS = { nome: 'Nome', email: 'E-mail', telefone: 'Telefone', tipo_caso: 'Tipo de caso (modelo de documentos)' };
  var ST = { novo: ['Novo', 'pill--report'], aguardando_armazenamento: ['Aguardando armazenamento', 'pill--warn'], pendente: ['Pendente', 'pill--warn'], enviado: ['Lista enviada', 'pill--report'],
    recebendo: ['Recebendo documentos', 'pill--report'], em_revisao: ['Em revisão', 'pill--warn'], completo: ['Completo', 'pill--live-ok'], cancelado: ['Cancelado', 'pill--muted'] };
  var uid = function (p) { return p + Math.random().toString(36).slice(2, 7); };
  function msg(el, t, tipo) { el.textContent = t; el.className = 'portal-alert' + (tipo === 'erro' ? ' portal-alert--error' : tipo === 'ok' ? ' portal-alert--ok' : ''); el.hidden = !t; }
  function soLeitura(el) { if (!el) return; el.querySelectorAll('input, textarea, select, button').forEach(function (x) { x.disabled = true; }); }
  /* ---------------- "Me ajude a escrever": a IA reescreve o texto da caixa; dá para desfazer ---------------- */
  var AJUDA = { pt: 'Me ajude a escrever', en: 'Help me write', es: 'Ayúdame a escribir' };
  var DESFAZ = { pt: 'Desfazer', en: 'Undo', es: 'Deshacer' };
  function lang() { var l = (document.documentElement.lang || 'pt').slice(0, 2).toLowerCase(); return AJUDA[l] ? l : 'pt'; }
  function botaoIA() {
    var t = AJUDA[lang()];
    return '<button class="btn btn--ghost btn--xs wa-ia-bt" type="button" data-ia title="' + t + '" aria-label="' + t + '">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 20l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M13.5 7.5l3 3"/><path d="M19 14.5v3M17.5 16h3M5 4v2.5M3.75 5.25h2.5"/></svg></button>' +
      '<button class="btn btn--ghost btn--xs wa-ia-desfazer" type="button" data-desfazer hidden>' + DESFAZ[lang()] + '</button>';
  }
  /** liga o ícone: caixa = textarea a reescrever; contexto() = dados para a IA; o texto novo passa pelo oninput da caixa (atualiza a config) */
  function ligarIA(raiz, caixa, call, tipo, contexto, aviso) {
    var bt = raiz.querySelector('[data-ia]'), un = raiz.querySelector('[data-desfazer]'), antes = null;
    if (!bt || !caixa) return;
    bt.onclick = async function () {
      bt.disabled = true; bt.classList.add('wa-ia-on'); caixa.setAttribute('aria-busy', 'true');
      try {
        var r = await call({ acao: 'wa_melhorar', tipo: tipo, texto: caixa.value, contexto: contexto() });
        antes = caixa.value; caixa.value = r.texto; if (caixa.oninput) caixa.oninput();
        un.hidden = false; caixa.focus();
      } catch (e) { if (aviso) msg(aviso, e.message, 'erro'); }
      bt.disabled = false; bt.classList.remove('wa-ia-on'); caixa.removeAttribute('aria-busy');
    };
    un.onclick = function () { if (antes == null) return; caixa.value = antes; antes = null; if (caixa.oninput) caixa.oninput(); un.hidden = true; caixa.focus(); };
  }
  /** salva a configuração inteira (perfil, regras, fluxos, modelos) com controle de versão */
  async function salvarConfig(call, d) {
    var r = await call({ acao: 'wa_config', config: d.config, version: d.config_version });
    d.config = r.config; d.config_version = r.config_version;
    return r;
  }

  /* ================================================================ Perfil e regras ================================================================ */
  function perfilRegras(corpo, ctx, call, d) {
    var esc = ctx.esc, cfg = d.config, p = cfg.perfil;
    var fluxoOpts = function (sel) { return cfg.fluxos.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.nome) + '</option>'; }).join(''); };
    corpo.innerHTML =
      '<form class="portal-card portal-form" id="wa-perfil" novalidate><h2 class="portal-h2">Perfil do negócio</h2>' +
        '<p class="portal-muted">É o que a IA sabe sobre ' + esc(d.empresa) + '. Ela usa o perfil para responder e para sugerir regras e fluxos.</p>' +
        '<div class="field"><label for="pf-neg">Sobre o negócio</label><textarea id="pf-neg" rows="3" maxlength="3000">' + esc(d.ajustes.negocio) + '</textarea></div>' +
        '<div class="field"><label for="pf-serv">Serviços</label><textarea id="pf-serv" rows="3" maxlength="2000">' + esc(p.servicos) + '</textarea></div>' +
        '<div class="field-row"><div class="field"><label for="pf-pub">Público</label><input id="pf-pub" maxlength="600" value="' + esc(p.publico) + '"></div>' +
        '<div class="field"><label for="pf-tom">Tom de voz</label><input id="pf-tom" maxlength="300" value="' + esc(p.tom) + '" placeholder="Ex.: cordial e objetivo"></div></div>' +
        '<div class="field"><label for="pf-evi">O que a IA deve evitar</label><textarea id="pf-evi" rows="2" maxlength="1000">' + esc(p.evitar) + '</textarea></div>' +
        '<div class="portal-btn-row"><button class="btn btn--navy" type="submit">Salvar perfil</button></div><p class="portal-alert" id="pf-m" role="status" hidden></p></form>' +
      '<section class="portal-card wa-prot"><h2 class="portal-h2">Proteções fixas</h2><p class="portal-muted">Valem para todas as empresas e ficam acima das regras. A Endeavor confere também no servidor: uma resposta automática que cite valor ou peça documento não é enviada e vira “precisa de você”.</p><ul>' +
        PROTECOES.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' +
      '<section class="portal-card"><div class="portal-btn-row" style="justify-content:space-between"><h2 class="portal-h2">Regras</h2>' +
        '<div class="portal-btn-row"><button class="btn btn--ghost btn--sm" type="button" id="rg-ia">Sugerir regras com IA</button><button class="btn btn--ghost btn--sm" type="button" id="rg-add">＋ Nova regra</button></div></div>' +
        '<p class="portal-muted">“Quando acontecer isto na conversa, faça aquilo.” A ação pode ser responder conforme a regra, avisar a equipe ou seguir um fluxo.</p>' +
        '<div id="rg-sug"></div><div id="rg-lista"></div>' +
        '<div class="portal-btn-row" style="margin-top:1rem"><button class="btn btn--navy" type="button" id="rg-salvar">Salvar regras</button></div><p class="portal-alert" id="rg-m" role="status" hidden></p></section>';

    function cartaoRegra(r, i) {
      return '<fieldset class="wa-regra" data-i="' + i + '"><legend class="sr-only">Regra ' + (i + 1) + '</legend>' +
        '<div class="field-row"><div class="field"><label for="rn-' + i + '">Nome</label><input id="rn-' + i + '" data-k="nome" maxlength="80" value="' + esc(r.nome) + '"></div>' +
        '<div class="field"><label for="ra-' + i + '">Ação</label><select id="ra-' + i + '" data-k="acao"><option value="responder"' + (r.acao === 'responder' ? ' selected' : '') + '>Responder conforme a regra</option>' +
          '<option value="escalar"' + (r.acao === 'escalar' ? ' selected' : '') + '>Avisar a equipe (não responde sozinha)</option>' +
          (cfg.fluxos.length ? '<option value="fluxo"' + (r.acao === 'fluxo' ? ' selected' : '') + '>Seguir um fluxo</option>' : '') + '</select></div>' +
        '<div class="field"' + (r.acao === 'fluxo' ? '' : ' hidden') + ' data-fluxo><label for="rf-' + i + '">Fluxo</label><select id="rf-' + i + '" data-k="fluxo">' + fluxoOpts(r.fluxo) + '</select></div></div>' +
        '<div class="field"><label for="rq-' + i + '">Quando</label><input id="rq-' + i + '" data-k="quando" maxlength="400" value="' + esc(r.quando) + '" placeholder="Ex.: perguntarem o prazo"></div>' +
        '<div class="field"><label for="rz-' + i + '">Fazer</label><textarea id="rz-' + i + '" data-k="fazer" rows="2" maxlength="800">' + esc(r.fazer) + '</textarea></div>' +
        '<div class="portal-btn-row"><label class="wa-chave"><input type="checkbox" data-k="ativa"' + (r.ativa ? ' checked' : '') + '><span>Ativa</span></label>' +
        botaoIA() + '<button class="btn btn--ghost btn--xs" type="button" data-del>Remover</button></div></fieldset>';
    }
    function desenhar() {
      var l = ctx.$('#rg-lista');
      l.innerHTML = cfg.regras.length ? cfg.regras.map(cartaoRegra).join('') : '<p class="portal-muted">Nenhuma regra. Use “Sugerir regras com IA” ou “Nova regra”.</p>';
      l.querySelectorAll('.wa-regra').forEach(function (fs) {
        var r = cfg.regras[+fs.dataset.i];
        fs.querySelectorAll('[data-k]').forEach(function (el) {
          el.oninput = el.onchange = function () {
            r[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
            if (el.dataset.k === 'acao') { fs.querySelector('[data-fluxo]').hidden = el.value !== 'fluxo'; if (el.value === 'fluxo' && !r.fluxo && cfg.fluxos[0]) r.fluxo = cfg.fluxos[0].id; }
          };
        });
        fs.querySelector('[data-del]').onclick = function () {
          if (fs.dataset.conf !== '1') { fs.dataset.conf = '1'; this.textContent = 'Confirmar remover'; this.classList.add('btn--danger'); return; }
          cfg.regras.splice(+fs.dataset.i, 1); desenhar();
        };
        ligarIA(fs, fs.querySelector('[data-k="fazer"]'), call, 'regra', function () { return { nome: r.nome, quando: r.quando }; }, ctx.$('#rg-m'));
      });
      if (!d.dono) soLeitura(corpo);
    }
    desenhar();
    ctx.$('#rg-add').onclick = function () { cfg.regras.push({ id: uid('regra'), nome: 'Nova regra', quando: '', fazer: '', acao: 'responder', fluxo: '', ativa: true }); desenhar(); var n = corpo.querySelectorAll('[data-k="quando"]'); n[n.length - 1].focus(); };
    ctx.$('#rg-ia').onclick = async function () {
      var b = this, box = ctx.$('#rg-sug'); b.disabled = true; box.innerHTML = '<p class="portal-muted">A IA está lendo o perfil do negócio…</p>';
      try {
        var r = await call({ acao: 'wa_sugerir', tipo: 'regras' });
        box.innerHTML = r.regras.length ? '<div class="wa-sug"><h3>Sugestões da IA</h3>' + r.regras.map(function (x, i) {
          return '<div class="wa-sug-item"><div><b>' + esc(x.nome) + '</b><br><small>Quando: ' + esc(x.quando) + '</small><br><small>Fazer: ' + esc(x.fazer) + (x.acao === 'escalar' ? ' (avisar a equipe)' : '') + '</small></div>' +
            '<button class="btn btn--ghost btn--xs" type="button" data-sug="' + i + '">Adicionar</button></div>'; }).join('') + '<p class="portal-muted">Revise e clique em Salvar regras.</p></div>' : '<p class="portal-muted">A IA não trouxe sugestões novas. Complete o perfil do negócio e tente de novo.</p>';
        box.querySelectorAll('[data-sug]').forEach(function (bt) { bt.onclick = function () { var x = r.regras[+bt.dataset.sug]; cfg.regras.push(Object.assign({}, x, { id: uid('regra'), ativa: true })); bt.disabled = true; bt.textContent = 'Adicionada'; desenhar(); }; });
      } catch (e) { box.innerHTML = ''; msg(ctx.$('#rg-m'), e.message, 'erro'); }
      b.disabled = false;
    };
    ctx.$('#rg-salvar').onclick = async function () {
      var m = ctx.$('#rg-m'); msg(m, 'Salvando…');
      var vazias = cfg.regras.filter(function (r) { return !r.nome.trim() || !r.quando.trim(); }).length;
      if (vazias) return msg(m, 'Preencha o nome e o “quando” de todas as regras (ou remova as vazias).', 'erro');
      try { await salvarConfig(call, d); cfg = d.config; desenhar(); msg(m, 'Regras salvas. A IA já usa na próxima resposta.', 'ok'); } catch (e) { msg(m, e.message, 'erro'); }
    };
    ctx.$('#wa-perfil').onsubmit = async function (e) {
      e.preventDefault();
      var m = ctx.$('#pf-m'); msg(m, 'Salvando…');
      cfg.perfil = { servicos: ctx.$('#pf-serv').value, publico: ctx.$('#pf-pub').value, tom: ctx.$('#pf-tom').value, evitar: ctx.$('#pf-evi').value };
      try {
        var a = await call({ acao: 'wa_ajustes', ajustes: Object.assign({}, d.ajustes, { negocio: ctx.$('#pf-neg').value }), version: d.version });
        d.ajustes = a.ajustes; d.version = a.version;
        await salvarConfig(call, d); cfg = d.config; desenhar(); // as regras passam a editar a config nova
        msg(m, 'Perfil salvo.', 'ok');
      } catch (x) { msg(m, x.message, 'erro'); }
    };
    if (!d.dono) soLeitura(corpo);
  }

  /* ================================================================ Fluxos e modelos de documentos ================================================================ */
  function fluxos(corpo, ctx, call, d) {
    var esc = ctx.esc, cfg = d.config;
    corpo.innerHTML =
      '<section class="portal-card"><div class="portal-btn-row" style="justify-content:space-between"><h2 class="portal-h2">Fluxos</h2>' +
        '<div class="portal-btn-row"><button class="btn btn--ghost btn--sm" type="button" id="fx-ia">Ideias de fluxos com IA</button><button class="btn btn--ghost btn--sm" type="button" id="fx-add">＋ Novo fluxo</button></div></div>' +
        '<p class="portal-muted">Um fluxo é uma sequência de passos que a IA segue na conversa, no IA Takeover. Os passos de CRM passam o pedido para o CRM, que faz o resto (pasta, e-mail, follow-up). A IA do WhatsApp nunca mexe em arquivos.</p>' +
        '<div id="fx-sug"></div><div id="fx-lista"></div></section>' +
      '<section class="portal-card"><div class="portal-btn-row" style="justify-content:space-between"><h2 class="portal-h2">Modelos de documentos</h2><button class="btn btn--ghost btn--sm" type="button" id="md-add">＋ Novo modelo</button></div>' +
        '<p class="portal-muted">Um modelo por tipo de caso: a lista de documentos que vai por e-mail e as subpastas que o CRM cria no armazenamento conectado (Google Drive ou Dropbox). O link enviado é sempre o da pasta <b>Initial Docs</b>.</p>' +
        '<div id="md-lista"></div></section>' +
      '<div class="portal-btn-row"><button class="btn btn--navy" type="button" id="fx-salvar">Salvar fluxos e modelos</button></div><p class="portal-alert" id="fx-m" role="status" hidden></p>';

    function passoHtml(fi, s, si) {
      var opts = Object.keys(PASSOS).map(function (t) { return '<option value="' + t + '"' + (t === s.tipo ? ' selected' : '') + '>' + PASSOS[t] + '</option>'; }).join('');
      return '<li class="wa-passo" data-si="' + si + '"><div class="field-row"><div class="field"><label for="ps-' + fi + '-' + si + '">Passo ' + (si + 1) + '</label><select id="ps-' + fi + '-' + si + '" data-p="tipo">' + opts + '</select></div>' +
        '<div class="portal-btn-row wa-passo-bt"><button class="btn btn--ghost btn--xs" type="button" data-up aria-label="Subir o passo ' + (si + 1) + '">↑</button><button class="btn btn--ghost btn--xs" type="button" data-down aria-label="Descer o passo ' + (si + 1) + '">↓</button>' + botaoIA() + '<button class="btn btn--ghost btn--xs" type="button" data-rm>Remover</button></div></div>' +
        (s.tipo === 'coletar' ? '<div class="wa-campos" role="group" aria-label="Dados a pedir">' + Object.keys(CAMPOS).map(function (c) { return '<label class="wa-chave"><input type="checkbox" data-campo="' + c + '"' + ((s.campos || []).indexOf(c) > -1 ? ' checked' : '') + '><span>' + CAMPOS[c] + '</span></label>'; }).join('') + '</div>' : '') +
        '<div class="field"><label for="pt-' + fi + '-' + si + '" class="sr-only">Instrução do passo ' + (si + 1) + '</label><textarea id="pt-' + fi + '-' + si + '" data-p="texto" rows="2" maxlength="600" placeholder="Instrução para a IA neste passo">' + esc(s.texto) + '</textarea></div></li>';
    }
    function fluxoHtml(f, fi) {
      return '<fieldset class="wa-fluxo" data-fi="' + fi + '"><legend class="sr-only">Fluxo ' + esc(f.nome) + '</legend>' +
        '<div class="field-row"><div class="field"><label for="fn-' + fi + '">Nome do fluxo</label><input id="fn-' + fi + '" data-f="nome" maxlength="80" value="' + esc(f.nome) + '"></div>' +
        '<div class="portal-btn-row"><label class="wa-chave"><input type="checkbox" data-f="ativo"' + (f.ativo ? ' checked' : '') + '><span>Ativo</span></label>' + (f.padrao ? '<span class="pill pill--report">Padrão</span>' : '') + '</div></div>' +
        '<div class="field"><label for="fg-' + fi + '">Quando começa (gatilho)</label><textarea id="fg-' + fi + '" data-f="gatilho" rows="2" maxlength="400">' + esc(f.gatilho) + '</textarea></div>' +
        '<ol class="wa-passos-lista">' + f.passos.map(function (s, si) { return passoHtml(fi, s, si); }).join('') + '</ol>' +
        '<div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" data-addp>＋ Passo</button><button class="btn btn--ghost btn--xs" type="button" data-delf>Remover fluxo</button></div></fieldset>';
    }
    function modeloHtml(m, mi) {
      return '<fieldset class="wa-modelo" data-mi="' + mi + '"><legend class="sr-only">Modelo ' + esc(m.nome) + '</legend>' +
        '<div class="field"><label for="mn-' + mi + '">Tipo de caso</label><input id="mn-' + mi + '" data-m="nome" maxlength="80" value="' + esc(m.nome) + '"></div>' +
        '<div class="field-row"><div class="field"><label for="md-' + mi + '">Documentos (um por linha)</label><textarea id="md-' + mi + '" data-m="documentos" rows="5">' + esc((m.documentos || []).join('\n')) + '</textarea></div>' +
        '<div class="field"><label for="ms-' + mi + '">Subpastas (uma por linha)</label><textarea id="ms-' + mi + '" data-m="subpastas" rows="5">' + esc((m.subpastas || []).join('\n')) + '</textarea><small class="portal-muted">A Initial Docs entra sempre.</small></div></div>' +
        '<button class="btn btn--ghost btn--xs" type="button" data-delm>Remover modelo</button></fieldset>';
    }
    function desenhar() {
      var l = ctx.$('#fx-lista');
      l.innerHTML = cfg.fluxos.length ? cfg.fluxos.map(fluxoHtml).join('') : '<p class="portal-muted">Nenhum fluxo.</p>';
      l.querySelectorAll('.wa-fluxo').forEach(function (fs) {
        var f = cfg.fluxos[+fs.dataset.fi];
        fs.querySelectorAll('[data-f]').forEach(function (el) { el.oninput = el.onchange = function () { f[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; }; });
        fs.querySelectorAll('.wa-passo').forEach(function (li) {
          var si = +li.dataset.si, s = f.passos[si];
          li.querySelectorAll('[data-p]').forEach(function (el) { el.oninput = el.onchange = function () { s[el.dataset.p] = el.value; if (el.dataset.p === 'tipo') { if (el.value === 'coletar' && !s.campos) s.campos = ['nome', 'email']; desenhar(); } }; });
          li.querySelectorAll('[data-campo]').forEach(function (el) { el.onchange = function () { s.campos = Object.keys(CAMPOS).filter(function (c) { var x = li.querySelector('[data-campo="' + c + '"]'); return x && x.checked; }); }; });
          li.querySelector('[data-up]').onclick = function () { if (si > 0) { f.passos.splice(si - 1, 0, f.passos.splice(si, 1)[0]); desenhar(); } };
          li.querySelector('[data-down]').onclick = function () { if (si < f.passos.length - 1) { f.passos.splice(si + 1, 0, f.passos.splice(si, 1)[0]); desenhar(); } };
          li.querySelector('[data-rm]').onclick = function () { f.passos.splice(si, 1); desenhar(); };
          ligarIA(li, li.querySelector('[data-p="texto"]'), call, 'passo', function () { return { passo: PASSOS[s.tipo] || s.tipo, fluxo: f.nome, gatilho: f.gatilho }; }, ctx.$('#fx-m'));
        });
        fs.querySelector('[data-addp]').onclick = function () { if (f.passos.length >= 10) return; f.passos.push({ tipo: 'mensagem', texto: '' }); desenhar(); };
        fs.querySelector('[data-delf]').onclick = function () {
          if (fs.dataset.conf !== '1') { fs.dataset.conf = '1'; this.textContent = 'Confirmar remover fluxo'; this.classList.add('btn--danger'); return; }
          var id = f.id; cfg.fluxos.splice(+fs.dataset.fi, 1);
          cfg.regras.forEach(function (r) { if (r.fluxo === id) { r.acao = 'responder'; r.fluxo = ''; } });
          desenhar();
        };
      });
      var ml = ctx.$('#md-lista');
      ml.innerHTML = cfg.modelos.length ? cfg.modelos.map(modeloHtml).join('') : '<p class="portal-muted">Nenhum modelo.</p>';
      ml.querySelectorAll('.wa-modelo').forEach(function (fs) {
        var m = cfg.modelos[+fs.dataset.mi];
        fs.querySelectorAll('[data-m]').forEach(function (el) { el.oninput = function () { m[el.dataset.m] = el.dataset.m === 'nome' ? el.value : el.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }; });
        fs.querySelector('[data-delm]').onclick = function () {
          if (fs.dataset.conf !== '1') { fs.dataset.conf = '1'; this.textContent = 'Confirmar remover modelo'; this.classList.add('btn--danger'); return; }
          cfg.modelos.splice(+fs.dataset.mi, 1); desenhar();
        };
      });
      if (!d.dono) soLeitura(corpo);
    }
    desenhar();
    ctx.$('#fx-add').onclick = function () { cfg.fluxos.push({ id: uid('fluxo'), nome: 'Novo fluxo', gatilho: '', ativo: true, passos: [{ tipo: 'mensagem', texto: '' }] }); desenhar(); var n = corpo.querySelectorAll('[data-f="gatilho"]'); n[n.length - 1].focus(); };
    ctx.$('#md-add').onclick = function () { cfg.modelos.push({ id: uid('modelo'), nome: 'Novo tipo de caso', documentos: [], subpastas: ['Initial Docs'] }); desenhar(); };
    ctx.$('#fx-ia').onclick = async function () {
      var b = this, box = ctx.$('#fx-sug'); b.disabled = true; box.innerHTML = '<p class="portal-muted">A IA está pensando em fluxos para ' + esc(d.empresa) + '…</p>';
      try {
        var r = await call({ acao: 'wa_sugerir', tipo: 'fluxos' });
        box.innerHTML = r.fluxos.length ? '<div class="wa-sug"><h3>Ideias da IA</h3>' + r.fluxos.map(function (x, i) {
          return '<div class="wa-sug-item"><div><b>' + esc(x.nome) + '</b><br><small>Quando: ' + esc(x.gatilho) + '</small><ol>' + x.passos.map(function (s) { return '<li><small>' + esc(PASSOS[s.tipo] || s.tipo) + (s.texto ? ': ' + esc(s.texto) : '') + '</small></li>'; }).join('') + '</ol></div>' +
            '<button class="btn btn--ghost btn--xs" type="button" data-sug="' + i + '">Adicionar</button></div>'; }).join('') + '<p class="portal-muted">Revise e clique em Salvar fluxos e modelos.</p></div>' : '<p class="portal-muted">A IA não trouxe ideias novas. Complete o perfil do negócio e tente de novo.</p>';
        box.querySelectorAll('[data-sug]').forEach(function (bt) { bt.onclick = function () { var x = r.fluxos[+bt.dataset.sug]; cfg.fluxos.push(Object.assign({}, x, { id: uid('fluxo'), ativo: true, padrao: false })); bt.disabled = true; bt.textContent = 'Adicionado'; desenhar(); }; });
      } catch (e) { box.innerHTML = ''; msg(ctx.$('#fx-m'), e.message, 'erro'); }
      b.disabled = false;
    };
    ctx.$('#fx-salvar').onclick = async function () {
      var m = ctx.$('#fx-m'); msg(m, 'Salvando…');
      if (cfg.fluxos.some(function (f) { return !f.nome.trim() || !f.gatilho.trim(); })) return msg(m, 'Preencha o nome e o gatilho de todos os fluxos.', 'erro');
      try { await salvarConfig(call, d); cfg = d.config; desenhar(); msg(m, 'Fluxos e modelos salvos.', 'ok'); } catch (e) { msg(m, e.message, 'erro'); }
    };
  }

  /* ================================================================ Pedidos ao CRM ================================================================ */
  function chamarDocs(ctx, d) {
    return async function (body) {
      if (d.opt && d.opt.clientId) body = Object.assign({ clientId: d.opt.clientId }, body);
      var s = (await ctx.sb.auth.getSession()).data.session;
      var r = await fetch(ctx.CFG.functionsUrl + '/docs', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(body) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.erro || 'O agente de documentos não respondeu.');
      return j;
    };
  }
  async function pedidos(corpo, ctx, call, d) {
    var esc = ctx.esc, docs = chamarDocs(ctx, d);
    corpo.innerHTML = '<p class="portal-muted">Carregando…</p>';
    var res = await Promise.all([call({ acao: 'wa_pedidos' }), docs({ acao: 'doc_status' }).catch(function (e) { return { erro: e.message }; })]);
    var r = res[0], st = res[1], con = st.conexao;
    var volta = (location.hash.match(/[?&]google=(ok|erro)/) || [])[1], vmsg = decodeURIComponent((location.hash.match(/[?&]msg=([^&]+)/) || [])[1] || '');
    var quando = function (iso) { try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return iso; } };
    var cartaoGoogle = '<section class="portal-card wa-google"><h2 class="portal-h2">Armazenamento: Google Drive</h2>' +
      (volta === 'ok' ? '<p class="portal-alert portal-alert--ok">Google Drive conectado. Os pedidos que estavam esperando já seguiram.</p>' : volta === 'erro' ? '<p class="portal-alert portal-alert--error">' + esc(vmsg || 'Não foi possível conectar o Google Drive.') + '</p>' : '') +
      (st.erro ? '<p class="portal-alert portal-alert--error">' + esc(st.erro) + '</p>' :
        !st.google_configurado ? '<p class="portal-alert portal-alert--info">O Google ainda não está configurado no servidor. A Endeavor precisa cadastrar o app do Google (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets do Supabase).</p>' :
        con && con.status === 'conectado' ? '<p><span class="pill pill--live-ok">Conectado</span> ' + esc(con.account_email || '') + (con.pasta ? ' · <a href="' + esc(con.pasta) + '" target="_blank" rel="noopener">Abrir a pasta no Drive</a>' : '') + '</p>' +
          '<p class="portal-muted">O CRM cria uma pasta por cliente pelo modelo, manda o e-mail com a lista e o link da Initial Docs, e faz o follow-up até completar. Os arquivos vão do cliente direto para este Drive; nada fica na Endeavor. A permissão é só para as pastas que o app cria.</p>' +
          (d.dono ? '<button class="btn btn--ghost btn--sm" type="button" id="gd-off">Desconectar</button>' : '') :
        '<p>' + (con && con.status === 'erro' ? '<span class="pill pill--overdue">Parou de funcionar</span> ' + esc(con.erro || '') : '<span class="pill pill--warn">Não conectado</span>') + '</p>' +
          '<p class="portal-muted">Conecte a conta Google da empresa. O app só enxerga as pastas que ele mesmo cria (permissão “drive.file”).</p>' +
          (d.dono ? '<button class="btn btn--navy btn--sm" type="button" id="gd-on">Conectar com Google Drive</button>' : '')) +
      '<p class="portal-alert" id="gd-m" role="status" hidden></p></section>';
    corpo.innerHTML = cartaoGoogle + '<section class="portal-card"><h2 class="portal-h2">Pedidos</h2><p class="portal-muted">Pedidos que a IA passou para o CRM durante as conversas.</p>' +
      (r.pedidos.length ? '<div class="wa-pedidos">' + r.pedidos.map(function (p) {
        var s = ST[p.status] || [p.status, ''], docsL = p.documentos || [], rec = p.recebidos || {};
        var falta = docsL.filter(function (x) { return !(rec[x] && rec[x].length); });
        return '<article class="wa-pedido" data-id="' + p.id + '"><div class="wa-pedido-cab"><div><b>' + esc(p.nome) + '</b> <span class="pill ' + s[1] + '">' + s[0] + '</span><br><small>' + esc([p.email, p.email_alt ? '(antes: ' + p.email_alt + ')' : '', p.telefone].filter(Boolean).join(' · ')) + '</small></div><small>' + quando(p.created_at) + '</small></div>' +
          '<p>' + (p.tipo === 'documentos' ? 'Documentos' : 'Proposta') + (p.modelo ? ' · ' + esc(p.modelo) : '') +
            (p.tipo === 'documentos' && docsL.length ? ' · <b>' + (docsL.length - falta.length) + ' de ' + docsL.length + '</b> recebidos' : '') +
            (p.pasta && p.pasta.link ? ' · <a href="' + esc(p.pasta.link) + '" target="_blank" rel="noopener">Pasta no Drive</a>' : '') +
            (p.enviado_at ? ' · lista enviada ' + quando(p.enviado_at) + (p.followups ? ' · ' + p.followups + ' lembrete(s)' : '') : '') + '</p>' +
          (p.tipo === 'documentos' && falta.length && p.enviado_at ? '<p class="portal-muted">Faltam: ' + esc(falta.join(', ')) + '</p>' : '') +
          (d.dono ? '<div class="portal-btn-row">' +
            (p.tipo === 'documentos' && ['completo', 'cancelado'].indexOf(p.status) < 0 ? '<button class="btn btn--ghost btn--xs" type="button" data-env>' + (p.enviado_at ? 'Reenviar a lista' : 'Enviar agora') + '</button><button class="btn btn--ghost btn--xs" type="button" data-outro>Enviar para outro e-mail</button>' : '') +
            '<label class="sr-only" for="ps-' + p.id + '">Situação de ' + esc(p.nome) + '</label><select id="ps-' + p.id + '" data-ped="' + p.id + '">' +
              Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (k === p.status ? ' selected' : '') + '>' + ST[k][0] + '</option>'; }).join('') + '</select></div>' +
            '<form class="wa-outro" hidden><label for="po-' + p.id + '">Novo e-mail</label><div class="portal-btn-row"><input id="po-' + p.id + '" type="email" required placeholder="nome@exemplo.com"><button class="btn btn--navy btn--xs">Enviar</button></div><small class="portal-muted">O e-mail atual fica guardado como alternativo; o contato no CRM ganha o segundo e-mail.</small></form>' : '') +
          '<p class="portal-alert" role="status" hidden></p></article>';
      }).join('') + '</div>' : '<p class="portal-muted">Nenhum pedido ainda. Eles aparecem quando a IA conclui um fluxo com passo de CRM.</p>') + '</section>';
    var gm = ctx.$('#gd-m');
    var on = ctx.$('#gd-on'); if (on) on.onclick = async function () {
      on.disabled = true;
      try { var x = await docs({ acao: 'google_conectar', volta: d.opt && d.opt.scope === 'admin' ? 'admin' : 'portal' }); location.href = x.url; }
      catch (e) { msg(gm, e.message, 'erro'); on.disabled = false; }
    };
    var off = ctx.$('#gd-off'); if (off) off.onclick = async function () {
      if (off.dataset.conf !== '1') { off.dataset.conf = '1'; off.textContent = 'Confirmar desconectar'; off.classList.add('btn--danger'); return; }
      try { await docs({ acao: 'google_desconectar' }); pedidos(corpo, ctx, call, d); } catch (e) { msg(gm, e.message, 'erro'); }
    };
    corpo.querySelectorAll('.wa-pedido').forEach(function (art) {
      var id = art.dataset.id, m = art.querySelector('.portal-alert:last-child');
      var env = art.querySelector('[data-env]'); if (env) env.onclick = async function () {
        env.disabled = true; msg(m, 'Enviando…');
        try { await docs({ acao: 'pedido_enviar', id: id }); msg(m, 'Lista enviada.', 'ok'); setTimeout(function () { pedidos(corpo, ctx, call, d); }, 900); }
        catch (e) { msg(m, e.message, 'erro'); env.disabled = false; }
      };
      var outro = art.querySelector('[data-outro]'), f = art.querySelector('.wa-outro');
      if (outro) outro.onclick = function () { f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus(); };
      if (f) f.onsubmit = async function (e) {
        e.preventDefault(); msg(m, 'Enviando…');
        try { await docs({ acao: 'pedido_reenviar', id: id, email: f.querySelector('input').value }); msg(m, 'Enviado para o novo e-mail.', 'ok'); setTimeout(function () { pedidos(corpo, ctx, call, d); }, 900); }
        catch (x) { msg(m, x.message, 'erro'); }
      };
      var sel = art.querySelector('[data-ped]'); if (sel) sel.onchange = async function () {
        try { await call({ acao: 'wa_pedido', id: id, status: sel.value }); msg(m, 'Situação atualizada.', 'ok'); } catch (e) { msg(m, e.message, 'erro'); }
      };
    });
  }

  window.EWaRegras = { perfilRegras: perfilRegras, fluxos: fluxos, pedidos: pedidos, soLeitura: soLeitura };
})();
