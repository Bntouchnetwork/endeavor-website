/* Endeavor · LinkedIn Manager (admin e portal do cliente), em português, inglês e espanhol.
 *   ELiPanel.render(view, ctx, { scope: 'admin' | 'client', clientId })
 * Calendário de posts (rascunho → aprovado → publicado pela API oficial), comentários com etiqueta de lead e
 * configurações (conectar a página, atividade, idioma, horários, modo de resposta, links e a extensão do Chrome).
 * Nada é publicado sem aprovação. Fala só com a função "linkedin"; os tokens nunca chegam aqui. */
(function () {
  'use strict';
  var ZIP = 'downloads/linkedin-manager.zip';
  var T = {
    pt: { titulo: 'LinkedIn Manager', lead_txt: 'Posts da página da empresa, comentários e oportunidades, sempre com a sua aprovação.', empresa: 'Empresa', semEmp: 'O LinkedIn Manager ainda não foi liberado para as suas empresas. Fale com a Endeavor.',
      t_cal: 'Calendário', t_com: 'Comentários', t_cfg: 'Configurações', gerar: 'Gerar semana', gerando: 'Escrevendo os posts…', aprovarTodos: 'Aprovar todos', vazioCal: 'Nenhum post ainda. Clique em "Gerar semana" para a IA escrever os rascunhos.',
      draft: 'Rascunho', approved: 'Aprovado', posted: 'Publicado', failed: 'Falhou', rejected: 'Rejeitado', salvar: 'Salvar', aprovar: 'Aprovar', rejeitar: 'Rejeitar', voltar: 'Voltar a rascunho', texto: 'Texto do post', quando: 'Data e hora', noFuso: 'no fuso',
      nadaSemAprov: 'Nada é publicado sem a sua aprovação. Os aprovados saem no horário, pela API oficial do LinkedIn.', salvo: 'Salvo.', barrado: 'não aprovado', editarVolta: 'Editar um post aprovado volta para rascunho.',
      vazioCom: 'Nenhum comentário pendente.', lead: 'Lead', resposta: 'Resposta', enviar: 'Enviar', ignorar: 'Ignorar', pendentes: 'Pendentes', respondidos: 'Respondidos', noCRM: 'no CRM', comentou: 'comentou', ultimaLeitura: 'Última leitura',
      conectar: 'Conectar o LinkedIn', reconectar: 'Conectar de novo', desconectar: 'Desconectar', conectado: 'Conectado', naoConectado: 'Não conectado', expirado: 'Conexão expirada', pagina: 'Página', appFalta: 'O app do LinkedIn ainda não foi configurado pela Endeavor.',
      atividade: 'Atividade da empresa', atividadeDica: 'Define as palavras-chave, os temas e o tom do agente.', escolha: 'Escolha…', idioma: 'Idioma dos posts', porSemana: 'Posts por semana', horarios: 'Horários (até 4)', fuso: 'Fuso horário',
      modo: 'Respostas aos comentários', manual: 'Manual: eu aprovo e envio (recomendado)', auto: 'Automático: a IA responde sozinha', autoAviso: 'No automático, as respostas saem sem a sua revisão. Respostas que quebrem as regras ficam para você.',
      wa: 'Link do WhatsApp (https://wa.me/…)', agenda: 'Link de agendamento', palavras: 'Palavras-chave extras (separadas por vírgula)', liberar: 'Liberado para o cliente usar no portal',
      ext: 'Extensão do Chrome', extTxt: 'Lê só o que está na sua tela do LinkedIn (feed, grupos e mensagens), destaca oportunidades e sugere a resposta. Você copia, cola ou ignora.', baixar: 'Baixar a extensão', codigo: 'Gerar código de conexão', codigoUma: 'Copie agora: o código aparece uma vez só.', url: 'URL do agente', token: 'Token',
      extModo: 'Modo da extensão', extManual: 'Manual: só sugere (recomendado)', extAuto: 'Automático: digita e envia sozinha', extRisco: 'Risco para a conta: o LinkedIn proíbe automação por extensões e pode restringir ou encerrar o perfil. Mensagens privadas nunca são automáticas. Ligue por sua conta e risco.',
      vel: 'Velocidade de digitação (caracteres/min)', imin: 'Intervalo mínimo entre envios (s)', imax: 'Intervalo máximo (s)', limite: 'Limite diário de envios automáticos', hoje: 'Enviados hoje', navegadores: 'Navegadores conectados', revogar: 'Desligar', nenhum: 'Nenhum.',
      okLi: 'LinkedIn conectado.', erroLi: { negado: 'A conexão foi cancelada no LinkedIn.', sem_pagina: 'Esta conta do LinkedIn não administra nenhuma página de empresa.', estado: 'O pedido de conexão expirou. Tente de novo.', erro: 'Não foi possível conectar. Tente de novo.' },
      regras: 'Regras fixas: nada de promessa de resultado, nada de conselho jurídico ou financeiro individual, sem preços.' },
    en: { titulo: 'LinkedIn Manager', lead_txt: 'Company page posts, comments and opportunities, always with your approval.', empresa: 'Company', semEmp: 'LinkedIn Manager is not enabled for your companies yet. Contact Endeavor.',
      t_cal: 'Calendar', t_com: 'Comments', t_cfg: 'Settings', gerar: 'Generate week', gerando: 'Writing the posts…', aprovarTodos: 'Approve all', vazioCal: 'No posts yet. Click "Generate week" and the AI writes the drafts.',
      draft: 'Draft', approved: 'Approved', posted: 'Posted', failed: 'Failed', rejected: 'Rejected', salvar: 'Save', aprovar: 'Approve', rejeitar: 'Reject', voltar: 'Back to draft', texto: 'Post text', quando: 'Date and time', noFuso: 'time zone',
      nadaSemAprov: 'Nothing is published without your approval. Approved posts go out on time through the official LinkedIn API.', salvo: 'Saved.', barrado: 'not approved', editarVolta: 'Editing an approved post sends it back to draft.',
      vazioCom: 'No pending comments.', lead: 'Lead', resposta: 'Reply', enviar: 'Send', ignorar: 'Ignore', pendentes: 'Pending', respondidos: 'Replied', noCRM: 'in the CRM', comentou: 'commented', ultimaLeitura: 'Last check',
      conectar: 'Connect LinkedIn', reconectar: 'Connect again', desconectar: 'Disconnect', conectado: 'Connected', naoConectado: 'Not connected', expirado: 'Connection expired', pagina: 'Page', appFalta: 'The LinkedIn app has not been set up by Endeavor yet.',
      atividade: 'Business activity', atividadeDica: 'Sets the agent keywords, themes and tone.', escolha: 'Choose…', idioma: 'Post language', porSemana: 'Posts per week', horarios: 'Times (up to 4)', fuso: 'Time zone',
      modo: 'Replies to comments', manual: 'Manual: I approve and send (recommended)', auto: 'Automatic: the AI replies by itself', autoAviso: 'In automatic mode, replies go out without your review. Replies that break the rules wait for you.',
      wa: 'WhatsApp link (https://wa.me/…)', agenda: 'Booking link', palavras: 'Extra keywords (comma separated)', liberar: 'Enabled for the client in the portal',
      ext: 'Chrome extension', extTxt: 'Reads only what is on your LinkedIn screen (feed, groups and messages), highlights opportunities and suggests the reply. You copy, paste or ignore.', baixar: 'Download the extension', codigo: 'Generate connection code', codigoUma: 'Copy it now: the code is shown only once.', url: 'Agent URL', token: 'Token',
      extModo: 'Extension mode', extManual: 'Manual: suggestions only (recommended)', extAuto: 'Automatic: types and sends by itself', extRisco: 'Account risk: LinkedIn forbids automation by extensions and may restrict or close the profile. Private messages are never automatic. Turn it on at your own risk.',
      vel: 'Typing speed (characters/min)', imin: 'Minimum interval between sends (s)', imax: 'Maximum interval (s)', limite: 'Daily limit of automatic sends', hoje: 'Sent today', navegadores: 'Connected browsers', revogar: 'Turn off', nenhum: 'None.',
      okLi: 'LinkedIn connected.', erroLi: { negado: 'The connection was cancelled on LinkedIn.', sem_pagina: 'This LinkedIn account does not manage any company page.', estado: 'The connection request expired. Try again.', erro: 'Could not connect. Try again.' },
      regras: 'Fixed rules: no promises of results, no individual legal or financial advice, no prices.' },
    es: { titulo: 'LinkedIn Manager', lead_txt: 'Publicaciones de la página de la empresa, comentarios y oportunidades, siempre con su aprobación.', empresa: 'Empresa', semEmp: 'LinkedIn Manager aún no está habilitado para sus empresas. Hable con Endeavor.',
      t_cal: 'Calendario', t_com: 'Comentarios', t_cfg: 'Configuración', gerar: 'Generar semana', gerando: 'Escribiendo las publicaciones…', aprovarTodos: 'Aprobar todas', vazioCal: 'Aún no hay publicaciones. Haga clic en "Generar semana" y la IA escribe los borradores.',
      draft: 'Borrador', approved: 'Aprobado', posted: 'Publicado', failed: 'Falló', rejected: 'Rechazado', salvar: 'Guardar', aprovar: 'Aprobar', rejeitar: 'Rechazar', voltar: 'Volver a borrador', texto: 'Texto de la publicación', quando: 'Fecha y hora', noFuso: 'zona horaria',
      nadaSemAprov: 'Nada se publica sin su aprobación. Lo aprobado sale a su hora por la API oficial de LinkedIn.', salvo: 'Guardado.', barrado: 'no aprobado', editarVolta: 'Editar una publicación aprobada la devuelve a borrador.',
      vazioCom: 'No hay comentarios pendientes.', lead: 'Lead', resposta: 'Respuesta', enviar: 'Enviar', ignorar: 'Ignorar', pendentes: 'Pendientes', respondidos: 'Respondidos', noCRM: 'en el CRM', comentou: 'comentó', ultimaLeitura: 'Última lectura',
      conectar: 'Conectar LinkedIn', reconectar: 'Conectar de nuevo', desconectar: 'Desconectar', conectado: 'Conectado', naoConectado: 'No conectado', expirado: 'Conexión vencida', pagina: 'Página', appFalta: 'Endeavor aún no ha configurado la app de LinkedIn.',
      atividade: 'Actividad de la empresa', atividadeDica: 'Define las palabras clave, los temas y el tono del agente.', escolha: 'Elija…', idioma: 'Idioma de las publicaciones', porSemana: 'Publicaciones por semana', horarios: 'Horarios (hasta 4)', fuso: 'Zona horaria',
      modo: 'Respuestas a comentarios', manual: 'Manual: yo apruebo y envío (recomendado)', auto: 'Automático: la IA responde sola', autoAviso: 'En automático, las respuestas salen sin su revisión. Las que rompan las reglas quedan para usted.',
      wa: 'Enlace de WhatsApp (https://wa.me/…)', agenda: 'Enlace de agenda', palavras: 'Palabras clave extra (separadas por coma)', liberar: 'Habilitado para el cliente en el portal',
      ext: 'Extensión de Chrome', extTxt: 'Lee solo lo que está en su pantalla de LinkedIn (feed, grupos y mensajes), destaca oportunidades y sugiere la respuesta. Usted copia, pega o ignora.', baixar: 'Descargar la extensión', codigo: 'Generar código de conexión', codigoUma: 'Cópielo ahora: el código se muestra una sola vez.', url: 'URL del agente', token: 'Token',
      extModo: 'Modo de la extensión', extManual: 'Manual: solo sugiere (recomendado)', extAuto: 'Automático: escribe y envía sola', extRisco: 'Riesgo para la cuenta: LinkedIn prohíbe la automatización con extensiones y puede restringir o cerrar el perfil. Los mensajes privados nunca son automáticos. Actívelo bajo su responsabilidad.',
      vel: 'Velocidad de escritura (caracteres/min)', imin: 'Intervalo mínimo entre envíos (s)', imax: 'Intervalo máximo (s)', limite: 'Límite diario de envíos automáticos', hoje: 'Enviados hoy', navegadores: 'Navegadores conectados', revogar: 'Apagar', nenhum: 'Ninguno.',
      okLi: 'LinkedIn conectado.', erroLi: { negado: 'La conexión fue cancelada en LinkedIn.', sem_pagina: 'Esta cuenta de LinkedIn no administra ninguna página de empresa.', estado: 'La solicitud de conexión venció. Intente de nuevo.', erro: 'No se pudo conectar. Intente de nuevo.' },
      regras: 'Reglas fijas: sin promesas de resultado, sin asesoría legal o financiera individual, sin precios.' }
  };
  var S = { L: 'pt', opt: {}, ctx: null, emp: null, aba: 'cal', d: null, lista: [] };
  function t(k) { return (T[S.L] && T[S.L][k]) || T.pt[k] || k; }
  var esc;
  async function api(body) {
    var c = S.ctx, s = (await c.sb.auth.getSession()).data.session;
    if (S.opt.clientId) body = Object.assign({ clientId: S.opt.clientId }, body);
    var r = await fetch(c.CFG.functionsUrl + '/linkedin', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : c.CFG.supabaseKey) }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.erro || 'LinkedIn Manager'); e.code = j.code; throw e; }
    return j;
  }
  function aviso(txt, tipo) { var m = document.getElementById('li-m'); if (!m) return; m.hidden = false; m.className = 'portal-alert portal-alert--' + (tipo || 'info'); m.textContent = txt; if (tipo !== 'error') setTimeout(function () { if (m.textContent === txt) m.hidden = true; }, 5000); }
  function local(iso, fuso) { // AAAA-MM-DDTHH:MM no fuso da empresa
    var p = {}; new Intl.DateTimeFormat('en-CA', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
  }
  function bonito(iso, fuso) { return new Intl.DateTimeFormat(S.L === 'pt' ? 'pt-BR' : S.L === 'es' ? 'es' : 'en-US', { timeZone: fuso, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  function rotAtiv(a) { return a['label_' + S.L] || a.label_pt; }

  async function render(view, ctx, opt) {
    S.ctx = ctx; S.opt = opt || {}; esc = ctx.esc;
    S.L = T[ctx.L] ? ctx.L : (opt && opt.scope === 'admin' ? 'pt' : (T[(document.documentElement.lang || 'pt').slice(0, 2)] ? document.documentElement.lang.slice(0, 2) : 'pt'));
    var r = await api({ acao: 'li_empresas' });
    S.lista = r.empresas || []; S.admin = !!r.admin;
    if (!S.lista.length) { view.innerHTML = '<div class="console__head"><h1>' + t('titulo') + '</h1></div><p class="portal-alert portal-alert--info">' + t('semEmp') + '</p>'; return; }
    var salvo = null; try { salvo = localStorage.getItem('endeavor-li-emp'); } catch (e) { /* ok */ }
    var interna = S.lista.filter(function (x) { return x.interna; })[0];
    S.emp = (S.lista.filter(function (x) { return x.id === salvo; })[0] || interna || S.lista[0]).id;
    view.innerHTML = '<div class="console__head li-topo"><div><h1>' + t('titulo') + '</h1><p class="portal-muted">' + t('lead_txt') + '</p></div>' +
      (S.lista.length > 1 ? '<div><label class="sr-only" for="li-emp">' + t('empresa') + '</label><select id="li-emp">' + S.lista.map(function (x) { return '<option value="' + x.id + '"' + (x.id === S.emp ? ' selected' : '') + '>' + esc(x.nome + (x.cliente && S.admin ? ' · ' + x.cliente : '')) + '</option>'; }).join('') + '</select></div>' : '') + '</div>' +
      '<div id="li-m" role="status" hidden></div><nav class="subtabs" id="li-abas" aria-label="LinkedIn Manager"></nav><div id="li-corpo"></div>';
    var sel = view.querySelector('#li-emp');
    if (sel) sel.onchange = function () { S.emp = sel.value; try { localStorage.setItem('endeavor-li-emp', S.emp); } catch (e) { /* ok */ } carregar(view); };
    var volta = (location.search.match(/[?&]li=([a-z_]+)/) || [])[1];
    await carregar(view);
    if (volta) { aviso(volta === 'ok' ? t('okLi') : (t('erroLi')[volta] || t('erroLi').erro), volta === 'ok' ? 'ok' : 'error'); try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* ok */ } if (volta !== 'ok') { S.aba = 'cfg'; desenhar(view); } }
  }
  async function carregar(view) {
    S.d = await api({ acao: 'li_painel', company_id: S.emp });
    desenhar(view);
  }
  function desenhar(view) {
    var pend = (S.d.comentarios || []).filter(function (c) { return c.status === 'pending'; }).length;
    var abas = view.querySelector('#li-abas');
    abas.innerHTML = [['cal', t('t_cal')], ['com', t('t_com') + (pend ? ' (' + pend + ')' : '')], ['cfg', t('t_cfg')]].map(function (a) { return '<a href="#" data-aba="' + a[0] + '"' + (a[0] === S.aba ? ' aria-current="page"' : '') + '>' + esc(a[1]) + '</a>'; }).join('');
    abas.querySelectorAll('a').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); S.aba = a.dataset.aba; desenhar(view); }; });
    var corpo = view.querySelector('#li-corpo');
    ({ cal: calendario, com: comentarios, cfg: config })[S.aba](corpo, view);
  }
  function acao(bt, fn, view) { bt.onclick = async function () { bt.disabled = true; var m0 = document.getElementById('li-m'); if (m0) m0.hidden = true; try { var r = await fn(); if (r !== false) await carregar(view); } catch (e) { aviso(e.message, 'error'); } bt.disabled = false; }; }

  /* ---------------- calendário ---------------- */
  function calendario(corpo, view) {
    var d = S.d, fuso = d.ajustes.fuso, posts = d.posts || [], rasc = posts.filter(function (p) { return p.status === 'draft' && new Date(p.scheduled_at) > new Date(); }).length;
    corpo.innerHTML = '<div class="li-barra"><button class="btn btn--gold" id="li-gerar" type="button">' + t('gerar') + '</button><button class="btn btn--navy" id="li-todos" type="button"' + (rasc ? '' : ' disabled') + '>' + t('aprovarTodos') + (rasc ? ' (' + rasc + ')' : '') + '</button>' +
      '<span class="portal-muted li-nota">' + t('nadaSemAprov') + '</span></div>' +
      (d.conta && d.conta.status !== 'connected' ? '<p class="portal-alert portal-alert--info">' + t(d.conta.status === 'expired' ? 'expirado' : 'naoConectado') + '. <a href="#" id="li-ir-cfg">' + t('t_cfg') + '</a></p>' : '') +
      (posts.length ? '<div class="li-cards">' + posts.map(function (p) {
        var trava = p.status === 'posted';
        return '<article class="li-card li-card--' + p.status + '" data-id="' + p.id + '"><header><span class="li-st">' + t(p.status) + '</span><time>' + esc(bonito(p.scheduled_at, fuso)) + '</time></header>' +
          (p.theme ? '<p class="li-tema">' + esc(p.theme) + '</p>' : '') +
          '<label class="sr-only" for="b' + p.id + '">' + t('texto') + '</label><textarea id="b' + p.id + '" rows="8" maxlength="3000"' + (trava ? ' readonly' : '') + '>' + esc(p.body) + '</textarea>' +
          (trava ? '' : '<label class="li-quando"><span>' + t('quando') + ' <small>(' + t('noFuso') + ' ' + esc(fuso.split('/')[1].replace('_', ' ')) + ')</small></span><input type="datetime-local" value="' + local(p.scheduled_at, fuso) + '"></label>') +
          (p.error ? '<p class="li-erro">' + esc(p.error) + '</p>' : '') +
          (trava ? '' : '<div class="li-bts"><button class="btn btn--ghost btn--sm" data-a="salvar" type="button">' + t('salvar') + '</button>' +
            (p.status === 'approved' ? '<button class="btn btn--ghost btn--sm" data-a="draft" type="button">' + t('voltar') + '</button>' : '<button class="btn btn--navy btn--sm" data-a="approved" type="button">' + t('aprovar') + '</button>') +
            (p.status !== 'rejected' ? '<button class="btn btn--ghost btn--sm li-rej" data-a="rejected" type="button">' + t('rejeitar') + '</button>' : '') + '</div>') + '</article>';
      }).join('') + '</div>' : '<div class="portal-card empty-state"><p>' + t('vazioCal') + '</p></div>');
    var ir = corpo.querySelector('#li-ir-cfg'); if (ir) ir.onclick = function (e) { e.preventDefault(); S.aba = 'cfg'; desenhar(view); };
    var g = corpo.querySelector('#li-gerar');
    g.onclick = async function () { g.disabled = true; g.textContent = t('gerando'); try { await api({ acao: 'li_gerar', company_id: S.emp }); await carregar(view); } catch (e) { aviso(e.message, 'error'); g.disabled = false; g.textContent = t('gerar'); } };
    acao(corpo.querySelector('#li-todos'), async function () { var r = await api({ acao: 'li_post_status', company_id: S.emp, todos: true, status: 'approved' }); if (r.barrados && r.barrados.length) aviso(r.barrados.length + ' ' + t('barrado') + ': ' + r.barrados[0].motivo, 'error'); }, view);
    corpo.querySelectorAll('.li-card').forEach(function (card) {
      var id = card.dataset.id, ta = card.querySelector('textarea'), dt = card.querySelector('input[type=datetime-local]');
      var salvar = function () { return api({ acao: 'li_post_salvar', company_id: S.emp, id: id, body: ta.value, local: dt.value }); };
      card.querySelectorAll('[data-a]').forEach(function (bt) {
        acao(bt, async function () {
          if (bt.dataset.a === 'salvar') { await salvar(); aviso(t('salvo'), 'ok'); return; }
          if (bt.dataset.a === 'approved') await salvar(); // aprova exatamente o texto que está na tela
          var r = await api({ acao: 'li_post_status', company_id: S.emp, id: id, status: bt.dataset.a });
          if (r.barrados && r.barrados.length) aviso(t('barrado') + ': ' + r.barrados[0].motivo, 'error');
        }, view);
      });
    });
  }

  /* ---------------- comentários ---------------- */
  function comentarios(corpo, view) {
    var d = S.d, cs = d.comentarios || [], pend = cs.filter(function (c) { return c.status === 'pending'; }), resp = cs.filter(function (c) { return c.status === 'replied'; }).slice(0, 20);
    var um = function (c, aberto) {
      return '<article class="li-com' + (c.is_lead ? ' li-com--lead' : '') + '" data-id="' + c.id + '"><header>' + (c.is_lead ? '<span class="pill pill--report">' + t('lead') + '</span> ' : '') + '<strong>' + esc(c.author_name || 'LinkedIn') + '</strong> <span class="portal-muted">' + t('comentou') + (c.commented_at ? ' · ' + esc(bonito(c.commented_at, d.ajustes.fuso)) : '') +
        (c.is_lead && (c.lead_id || c.ct_contact_id) ? ' · ' + t('noCRM') : '') + '</span></header><blockquote>' + esc(c.body) + '</blockquote>' + (c.lead_reason ? '<p class="portal-muted li-motivo">' + esc(c.lead_reason) + '</p>' : '') +
        (aberto ? '<label for="r' + c.id + '">' + t('resposta') + '</label><textarea id="r' + c.id + '" rows="3" maxlength="1200">' + esc(c.reply || '') + '</textarea>' + (c.error ? '<p class="li-erro">' + esc(c.error) + '</p>' : '') +
          '<div class="li-bts"><button class="btn btn--navy btn--sm" data-a="enviar" type="button">' + t('enviar') + '</button><button class="btn btn--ghost btn--sm" data-a="ignorar" type="button">' + t('ignorar') + '</button></div>'
          : '<p class="li-resp">↳ ' + esc(c.reply || '') + '</p>') + '</article>';
    };
    corpo.innerHTML = '<p class="portal-muted">' + t(d.ajustes.modo_resposta === 'auto' ? 'auto' : 'manual') + (d.conta && d.conta.comments_checked_at ? ' · ' + t('ultimaLeitura') + ': ' + esc(bonito(d.conta.comments_checked_at, d.ajustes.fuso)) : '') + '</p>' +
      '<h2 class="portal-h2">' + t('pendentes') + '</h2>' + (pend.length ? pend.map(function (c) { return um(c, true); }).join('') : '<div class="portal-card empty-state"><p>' + t('vazioCom') + '</p></div>') +
      (resp.length ? '<h2 class="portal-h2" style="margin-top:1.5rem">' + t('respondidos') + '</h2>' + resp.map(function (c) { return um(c, false); }).join('') : '');
    corpo.querySelectorAll('.li-com [data-a]').forEach(function (bt) {
      var card = bt.closest('.li-com');
      acao(bt, function () { return api({ acao: bt.dataset.a === 'enviar' ? 'li_coment_enviar' : 'li_coment_ignorar', company_id: S.emp, id: card.dataset.id, reply: card.querySelector('textarea').value }); }, view);
    });
  }

  /* ---------------- configurações ---------------- */
  function config(corpo, view) {
    var d = S.d, a = d.ajustes, c = d.conta || { status: 'not_connected' }, on = c.status === 'connected';
    var campo = function (rot, html, dica) { return '<div class="field"><label>' + rot + '</label>' + html + (dica ? '<small class="portal-muted">' + dica + '</small>' : '') + '</div>'; };
    var sel = function (nome, ops, v) { return '<select name="' + nome + '">' + ops.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">LinkedIn</h2><p><span class="pill ' + (on ? 'pill--report' : '') + '">' + t(on ? 'conectado' : c.status === 'expired' ? 'expirado' : 'naoConectado') + '</span>' + (on ? ' ' + t('pagina') + ': <strong>' + esc(c.org_name || '') + '</strong>' : '') + '</p>' +
      (c.last_error && !on ? '<p class="li-erro">' + esc(c.last_error) + '</p>' : '') + (!d.config.linkedin ? '<p class="portal-alert portal-alert--info">' + t('appFalta') + '</p>' : '') +
      (on && c.paginas && c.paginas.length > 1 ? '<div class="field"><label for="li-pag">' + t('pagina') + '</label><select id="li-pag">' + c.paginas.map(function (p) { return '<option value="' + esc(p.urn) + '"' + (p.urn === c.org_urn ? ' selected' : '') + '>' + esc(p.nome) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="li-bts"><button class="btn btn--navy" id="li-con" type="button"' + (d.config.linkedin ? '' : ' disabled') + '>' + t(on ? 'reconectar' : 'conectar') + '</button>' + (on ? '<button class="btn btn--ghost btn--sm" id="li-des" type="button">' + t('desconectar') + '</button>' : '') + '</div>' +
      (d.admin && !d.empresa.interna ? '<label class="check" style="margin-top:1rem"><input type="checkbox" id="li-lib"' + (c.enabled ? ' checked' : '') + '> ' + t('liberar') + '</label>' : '') + '</section>' +
      '<form class="portal-card portal-form" id="li-f"><h2 class="portal-h2">' + t('t_cfg') + '</h2><div class="li-form">' +
      campo(t('atividade'), '<select name="atividade"><option value="">' + t('escolha') + '</option>' + d.atividades.map(function (x) { return '<option value="' + x.code + '"' + (x.code === d.empresa.atividade ? ' selected' : '') + '>' + esc(rotAtiv(x)) + '</option>'; }).join('') + '</select>', t('atividadeDica')) +
      campo(t('idioma'), sel('idioma', [['pt', 'Português'], ['en', 'English'], ['es', 'Español']], a.idioma)) +
      campo(t('porSemana'), sel('posts_semana', [1, 2, 3, 4, 5, 6, 7].map(function (n) { return [n, n]; }), a.posts_semana)) +
      campo(t('horarios'), '<div class="li-horas">' + [0, 1, 2, 3].map(function (i) { return '<input type="time" name="h' + i + '" aria-label="' + t('horarios') + ' ' + (i + 1) + '" value="' + (a.horarios[i] || '') + '">'; }).join('') + '</div>') +
      campo(t('fuso'), sel('fuso', d.fusos.map(function (f) { return [f, f.replace('_', ' ')]; }), a.fuso)) +
      campo(t('modo'), sel('modo_resposta', [['manual', t('manual')], ['auto', t('auto')]], a.modo_resposta), t('autoAviso')) +
      campo(t('wa'), '<input name="whatsapp" type="url" inputmode="url" value="' + esc(a.whatsapp) + '" placeholder="https://wa.me/14075550100">') +
      campo(t('agenda'), '<input name="agenda" type="url" inputmode="url" value="' + esc(a.agenda) + '" placeholder="https://">') +
      campo(t('palavras'), '<input name="palavras" value="' + esc(a.palavras.join(', ')) + '">') + '</div>' +
      '<h2 class="portal-h2" style="margin-top:1.5rem">' + t('ext') + '</h2><p class="portal-muted">' + t('extTxt') + '</p><div class="li-form">' +
      campo(t('extModo'), sel('ext_modo', [['manual', t('extManual')], ['auto', t('extAuto')]], a.ext.modo)) +
      campo(t('vel'), '<input name="velocidade" type="range" min="80" max="400" step="10" value="' + a.ext.velocidade + '"><output>' + a.ext.velocidade + '</output>') +
      campo(t('imin'), '<input name="intervalo_min" type="number" min="30" max="3600" value="' + a.ext.intervalo_min + '">') + campo(t('imax'), '<input name="intervalo_max" type="number" min="30" max="7200" value="' + a.ext.intervalo_max + '">') +
      campo(t('limite'), '<input name="limite_dia" type="number" min="1" max="50" value="' + a.ext.limite_dia + '">', t('hoje') + ': ' + d.enviados_hoje) + '</div>' +
      '<p class="portal-alert portal-alert--error" id="li-risco"' + (a.ext.modo === 'auto' ? '' : ' hidden') + '>' + t('extRisco') + '</p>' +
      '<p class="portal-muted" style="font-size:.85rem">' + t('regras') + '</p><button class="btn btn--gold" type="submit">' + t('salvar') + '</button></form>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('ext') + '</h2><div class="li-bts"><a class="btn btn--ghost" href="' + ZIP + '" download>' + t('baixar') + '</a><button class="btn btn--navy" id="li-cod" type="button">' + t('codigo') + '</button></div><div id="li-codbox" hidden></div>' +
      '<h3 class="li-h3">' + t('navegadores') + '</h3>' + (d.dispositivos.length ? '<ul class="li-devs">' + d.dispositivos.map(function (x) { return '<li>' + esc(x.nome || 'Chrome') + ' <span class="portal-muted">· ' + esc(x.last_seen ? bonito(x.last_seen, a.fuso) : '—') + '</span> <button class="btn btn--ghost btn--xs" data-rev="' + x.id + '" type="button">' + t('revogar') + '</button></li>'; }).join('') + '</ul>' : '<p class="portal-muted">' + t('nenhum') + '</p>') + '</section>';
    var f = corpo.querySelector('#li-f');
    f.velocidade.oninput = function () { f.velocidade.nextElementSibling.textContent = f.velocidade.value; };
    f.ext_modo.onchange = function () { corpo.querySelector('#li-risco').hidden = f.ext_modo.value !== 'auto'; };
    f.onsubmit = async function (ev) {
      ev.preventDefault();
      var bt = f.querySelector('[type=submit]'); bt.disabled = true;
      try {
        if (f.atividade.value && f.atividade.value !== d.empresa.atividade) await api({ acao: 'li_atividade', company_id: S.emp, code: f.atividade.value });
        await api({ acao: 'li_ajustes', company_id: S.emp, ajustes: { idioma: f.idioma.value, posts_semana: +f.posts_semana.value, horarios: [f.h0.value, f.h1.value, f.h2.value, f.h3.value].filter(Boolean), fuso: f.fuso.value, modo_resposta: f.modo_resposta.value,
          whatsapp: f.whatsapp.value, agenda: f.agenda.value, palavras: f.palavras.value.split(','), ext: { modo: f.ext_modo.value, velocidade: +f.velocidade.value, intervalo_min: +f.intervalo_min.value, intervalo_max: +f.intervalo_max.value, limite_dia: +f.limite_dia.value } } });
        await carregar(view); aviso(t('salvo'), 'ok');
      } catch (e) { aviso(e.message, 'error'); bt.disabled = false; }
    };
    var con = corpo.querySelector('#li-con');
    con.onclick = async function () { con.disabled = true; try { var r = await api({ acao: 'li_oauth_inicio', company_id: S.emp }); location.href = r.url; } catch (e) { aviso(e.message, 'error'); con.disabled = false; } };
    var des = corpo.querySelector('#li-des'); if (des) acao(des, function () { return api({ acao: 'li_desconectar', company_id: S.emp }); }, view);
    var pag = corpo.querySelector('#li-pag'); if (pag) pag.onchange = function () { api({ acao: 'li_pagina', company_id: S.emp, urn: pag.value }).then(function () { return carregar(view); }).catch(function (e) { aviso(e.message, 'error'); }); };
    var lib = corpo.querySelector('#li-lib'); if (lib) lib.onchange = function () { api({ acao: 'li_liberar', company_id: S.emp, enabled: lib.checked }).then(function () { aviso(t('salvo'), 'ok'); }).catch(function (e) { lib.checked = !lib.checked; aviso(e.message, 'error'); }); };
    var cod = corpo.querySelector('#li-cod');
    cod.onclick = async function () {
      cod.disabled = true;
      try {
        var r = await api({ acao: 'li_ext_conectar', company_id: S.emp, nome: 'Chrome' }), box = corpo.querySelector('#li-codbox');
        box.hidden = false;
        box.innerHTML = '<p class="portal-alert portal-alert--info">' + t('codigoUma') + '</p><div class="field"><label for="li-u">' + t('url') + '</label><input id="li-u" readonly value="' + esc(r.url) + '"></div><div class="field"><label for="li-t">' + t('token') + '</label><input id="li-t" readonly value="' + esc(r.codigo) + '"></div>';
        box.querySelectorAll('input').forEach(function (i) { i.onfocus = function () { i.select(); }; });
      } catch (e) { aviso(e.message, 'error'); }
      cod.disabled = false;
    };
    corpo.querySelectorAll('[data-rev]').forEach(function (bt) { acao(bt, function () { return api({ acao: 'li_ext_revogar', company_id: S.emp, id: bt.dataset.rev }); }, view); });
  }

  /** Dropdown trilíngue de atividades (cadastro da empresa no admin e no portal). */
  var ATIV = null, ROT = { pt: ['Atividade da empresa', 'Escolha…'], en: ['Business activity', 'Choose…'], es: ['Actividad de la empresa', 'Elija…'] };
  async function atividades(sb, sel, L, atual) {
    L = ROT[L] ? L : 'pt';
    try { if (!ATIV) { var r = await sb.from('business_activities').select('code, label_pt, label_en, label_es').order('sort'); if (r.error) throw r.error; ATIV = r.data || []; } } catch (e) { return; }
    sel.innerHTML = '<option value="">' + ROT[L][1] + '</option>' + ATIV.map(function (a) { return '<option value="' + a.code + '"' + (a.code === atual ? ' selected' : '') + '>' + String(a['label_' + L] || a.label_pt).replace(/</g, '&lt;') + '</option>'; }).join('');
  }
  window.ELiPanel = { render: render, T: T, atividades: atividades, rotuloAtividade: function (L) { return (ROT[L] || ROT.pt)[0]; } };
})();
