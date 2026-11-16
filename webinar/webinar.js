/* Endeavor Live Webinar · página pública (webinar.html?w=<slug>[&t=<token>])
 *
 * Sem token: dados do webinar e inscrição. Com token: a sala do webinar.
 * - A apresentação anda pelo relógio do servidor (EWebinarCore.posicao): quem chega atrasado entra no ponto certo,
 *   e a pausa ou o encerramento feitos pelo organizador chegam a todos em poucos segundos.
 * - Narração: um áudio por slide (link assinado), tocado a partir do ponto certo; sem áudio, o slide passa no tempo do roteiro.
 * - Chat aberto: participantes reais; o assistente aparece como IA e as perguntas frequentes como "Pergunta frequente".
 * - "Falar em particular": só a pessoa e a equipe/assistente. Contatos com autorização viram lead; horários vêm da agenda real.
 * - Contador: o servidor só manda o número quando há pelo menos o mínimo escolhido pelo organizador (e é sempre o número real). */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG, C = window.EWebinarCore, NA = window.NoirApresentacao;
  var main = document.getElementById('main');
  var qs = new URLSearchParams(location.search), SLUG = (qs.get('w') || '').toLowerCase(), TOKEN = qs.get('t') || '';
  var TZ = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch (e) { return 'America/New_York'; } })();
  var D = {
    pt: { carregando: 'Carregando…', naoEncontrado: 'Webinar não encontrado. Confira o link.', inscrever: 'Garanta sua vaga', nome: 'Nome', email: 'E-mail', telefone: 'WhatsApp ou telefone (opcional)',
      aviso: 'Entendo que a apresentação é pré-gravada com a voz autorizada do organizador e que as respostas do chat são de um assistente de IA, acompanhado pela equipe.',
      marketing: 'Quero receber novidades por e-mail (opcional).', enviar: 'Inscrever', inscrito: 'Inscrição confirmada!', entrar: 'Entrar no webinar', jaInscrito: 'Você já estava inscrito. Mandamos o seu link pessoal para o e-mail.',
      emailFalhou: 'Guarde este link: não conseguimos mandar o e-mail agora.', encerradas: 'As inscrições deste webinar estão encerradas.', quando: 'Quando', duracao: 'Duração', min: 'min',
      aoVivo: 'AO VIVO', pausado: 'PAUSADO', comeca: 'Começa em', encerrado: 'Este webinar terminou. Obrigado por participar!', cancelado: 'Este webinar foi cancelado.',
      assistindo: 'assistindo', chat: 'Chat', particular: 'Falar em particular', escreva: 'Escreva sua pergunta…', mandar: 'Enviar', chatFechado: 'O chat abre {n} minutos antes do início.',
      ia: 'IA', equipe: 'Equipe', faq: 'Pergunta frequente', iaResponde: 'Assistente (IA)', semIA: 'O assistente de IA está pausado; a equipe responde por aqui.',
      rodape: 'Apresentação pré-gravada com a voz autorizada do organizador · As respostas do chat são de um assistente de IA, acompanhado pela equipe.',
      som: 'Clique para ativar o som', rodapeTeste: 'Apresentação pré-gravada · Narração com voz sintética de TESTE do navegador (não é a voz do organizador) · As respostas do chat são de um assistente de IA, acompanhado pela equipe.', vozTeste: 'Voz de teste', abertura: 'Abertura', privIntro: 'Aqui a conversa é só entre você e a equipe (com a ajuda do assistente de IA). Para falar do seu caso ou marcar um horário, deixe seus contatos.',
      assunto: 'Sobre o que você quer conversar?', autorizo: 'Autorizo {empresa} a me contatar sobre este assunto e a guardar estes dados no seu CRM.', salvarContato: 'Enviar contatos',
      verHorarios: 'Escolher um horário', soLink: 'Prefiro receber o link por e-mail', tipo: 'Como prefere a conversa?', video: 'Vídeo', fone: 'Telefone', whatsapp: 'WhatsApp',
      foneObrig: 'Telefone com código do país (ex.: +1 407 555 0100)', confirmar: 'Confirmar horário', semHorarios: 'Não há horários livres nos próximos dias. Peça o link e escolha depois.',
      fusoInfo: 'Horários no seu fuso ({tz}).', nada: 'Nada por aqui ainda.', ateLogo: 'Obrigado!', abrirPriv: 'Falar em particular' },
    en: { carregando: 'Loading…', naoEncontrado: 'Webinar not found. Please check the link.', inscrever: 'Save your seat', nome: 'Name', email: 'Email', telefone: 'WhatsApp or phone (optional)',
      aviso: 'I understand the presentation is pre-recorded with the organizer\'s authorized voice and that chat answers come from an AI assistant, monitored by the team.',
      marketing: 'Send me news by email (optional).', enviar: 'Register', inscrito: 'You are registered!', entrar: 'Join the webinar', jaInscrito: 'You were already registered. We sent your personal link to your email.',
      emailFalhou: 'Save this link: we could not send the email right now.', encerradas: 'Registration for this webinar is closed.', quando: 'When', duracao: 'Length', min: 'min',
      aoVivo: 'LIVE', pausado: 'PAUSED', comeca: 'Starts in', encerrado: 'This webinar has ended. Thank you for joining!', cancelado: 'This webinar was cancelled.',
      assistindo: 'watching', chat: 'Chat', particular: 'Talk privately', escreva: 'Type your question…', mandar: 'Send', chatFechado: 'Chat opens {n} minutes before the start.',
      ia: 'AI', equipe: 'Team', faq: 'Frequently asked', iaResponde: 'Assistant (AI)', semIA: 'The AI assistant is paused; the team answers here.',
      rodape: 'Pre-recorded presentation with the organizer\'s authorized voice · Chat answers come from an AI assistant, monitored by the team.',
      som: 'Click to turn on the sound', rodapeTeste: 'Pre-recorded presentation · Narration uses a synthetic TEST voice from your browser (not the organizer\'s voice) · Chat answers come from an AI assistant, monitored by the team.', vozTeste: 'Test voice', abertura: 'Opening', privIntro: 'This conversation is only between you and the team (helped by the AI assistant). To talk about your case or book a time, leave your contact details.',
      assunto: 'What would you like to talk about?', autorizo: 'I authorize {empresa} to contact me about this and to keep these details in its CRM.', salvarContato: 'Send details',
      verHorarios: 'Choose a time', soLink: 'Email me the booking link instead', tipo: 'How would you like to meet?', video: 'Video', fone: 'Phone', whatsapp: 'WhatsApp',
      foneObrig: 'Phone with country code (e.g. +1 407 555 0100)', confirmar: 'Confirm time', semHorarios: 'No open times in the next days. Ask for the link and pick later.',
      fusoInfo: 'Times in your time zone ({tz}).', nada: 'Nothing here yet.', ateLogo: 'Thank you!', abrirPriv: 'Talk privately' },
    es: { carregando: 'Cargando…', naoEncontrado: 'Webinar no encontrado. Revise el enlace.', inscrever: 'Reserve su lugar', nome: 'Nombre', email: 'Correo', telefone: 'WhatsApp o teléfono (opcional)',
      aviso: 'Entiendo que la presentación está pregrabada con la voz autorizada del organizador y que las respuestas del chat son de un asistente de IA, supervisado por el equipo.',
      marketing: 'Quiero recibir novedades por correo (opcional).', enviar: 'Inscribirme', inscrito: '¡Inscripción confirmada!', entrar: 'Entrar al webinar', jaInscrito: 'Ya estaba inscrito. Enviamos su enlace personal a su correo.',
      emailFalhou: 'Guarde este enlace: no pudimos enviar el correo ahora.', encerradas: 'Las inscripciones de este webinar están cerradas.', quando: 'Cuándo', duracao: 'Duración', min: 'min',
      aoVivo: 'EN VIVO', pausado: 'EN PAUSA', comeca: 'Empieza en', encerrado: 'Este webinar terminó. ¡Gracias por participar!', cancelado: 'Este webinar fue cancelado.',
      assistindo: 'mirando', chat: 'Chat', particular: 'Hablar en privado', escreva: 'Escriba su pregunta…', mandar: 'Enviar', chatFechado: 'El chat abre {n} minutos antes del inicio.',
      ia: 'IA', equipe: 'Equipo', faq: 'Pregunta frecuente', iaResponde: 'Asistente (IA)', semIA: 'El asistente de IA está en pausa; el equipo responde aquí.',
      rodape: 'Presentación pregrabada con la voz autorizada del organizador · Las respuestas del chat son de un asistente de IA, supervisado por el equipo.',
      som: 'Haga clic para activar el sonido', rodapeTeste: 'Presentación pregrabada · La narración usa una voz sintética de PRUEBA del navegador (no es la voz del organizador) · Las respuestas del chat son de un asistente de IA, supervisado por el equipo.', vozTeste: 'Voz de prueba', abertura: 'Apertura', privIntro: 'Esta conversación es solo entre usted y el equipo (con ayuda del asistente de IA). Para hablar de su caso o agendar, deje sus datos.',
      assunto: '¿De qué quiere hablar?', autorizo: 'Autorizo a {empresa} a contactarme sobre este tema y a guardar estos datos en su CRM.', salvarContato: 'Enviar datos',
      verHorarios: 'Elegir un horario', soLink: 'Prefiero recibir el enlace por correo', tipo: '¿Cómo prefiere la reunión?', video: 'Video', fone: 'Teléfono', whatsapp: 'WhatsApp',
      foneObrig: 'Teléfono con código de país (ej.: +1 407 555 0100)', confirmar: 'Confirmar horario', semHorarios: 'No hay horarios libres en los próximos días. Pida el enlace y elija después.',
      fusoInfo: 'Horarios en su zona horaria ({tz}).', nada: 'Nada por aquí todavía.', ateLogo: '¡Gracias!', abrirPriv: 'Hablar en privado' }
  };
  var L = 'pt';
  function t(k, v) { var s = (D[L] && D[L][k]) || D.pt[k] || k; if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  function idiomaDe(cod) { var l = (qs.get('lang') || cod || 'pt').slice(0, 2).toLowerCase(); L = D[l] ? l : 'pt'; document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[L]; }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (k === 'value') e.value = v; else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  async function api(body) {
    var r = await fetch(CFG.functionsUrl + '/webinar', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify(Object.assign({ slug: SLUG }, body)) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.erro || 'Erro'); e.status = r.status; throw e; }
    return j;
  }
  function dataHora(iso, tz) {
    try { return new Intl.DateTimeFormat(document.documentElement.lang, { timeZone: tz || TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso)); }
    catch (e) { return new Date(iso).toLocaleString(); }
  }
  function hora(iso) { try { return new Intl.DateTimeFormat(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return ''; } }
  function falta(ms) { var s = Math.max(0, Math.round(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); }

  if (!SLUG) { main.innerHTML = ''; main.appendChild(el('div', { class: 'portal-card lw-msg', text: D.pt.naoEncontrado })); return; }
  if (TOKEN) sala(); else inscricao();

  /* ---------------- inscrição ---------------- */
  async function inscricao() {
    var w;
    try { w = await api({ acao: 'pub_info' }); } catch (e) { idiomaDe(); main.innerHTML = ''; main.appendChild(el('div', { class: 'portal-card lw-msg', text: e.status === 404 ? t('naoEncontrado') : e.message })); return; }
    idiomaDe(w.idioma); document.title = w.titulo;
    main.innerHTML = '';
    var info = el('section', { class: 'lw-inscr-info' }, [
      el('p', { class: 'lw-empresa', text: w.empresa }), el('h1', { text: w.titulo }),
      w.descricao ? el('p', { class: 'lw-desc', text: w.descricao }) : null,
      el('dl', { class: 'lw-meta' }, [el('dt', { text: t('quando') }), el('dd', { text: dataHora(w.starts_at) }), el('dt', { text: t('duracao') }), el('dd', { text: Math.max(1, Math.round(w.duracao_ms / 60000)) + ' ' + t('min') })]),
      el('p', { class: 'lw-nota', text: t('rodape') })]);
    var caixa = el('section', { class: 'portal-card lw-inscr-form' });
    main.appendChild(el('div', { class: 'lw-inscr' }, [info, caixa]));
    if (!w.inscricao_aberta) { caixa.appendChild(el('p', { text: w.estado === 'cancelado' ? t('cancelado') : t('encerradas') })); return; }
    var f = el('form', { class: 'portal-form', novalidate: true });
    var campo = function (id, rot, attrs) { var i = el('input', Object.assign({ id: id }, attrs)); f.appendChild(el('div', { class: 'field' }, [el('label', { for: id, text: rot }), i])); return i; };
    f.appendChild(el('h2', { class: 'portal-h2', text: t('inscrever') }));
    var nome = campo('lw-n', t('nome'), { autocomplete: 'name', required: true, maxlength: '120' });
    var email = campo('lw-e', t('email'), { type: 'email', autocomplete: 'email', required: true, maxlength: '254' });
    var fone = campo('lw-f', t('telefone'), { type: 'tel', autocomplete: 'tel', maxlength: '40' });
    var hp = el('input', { class: 'lw-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', name: 'website' });
    var aceite = el('input', { type: 'checkbox', id: 'lw-a', required: true }), mk = el('input', { type: 'checkbox', id: 'lw-m' });
    f.appendChild(el('label', { class: 'lw-check', for: 'lw-a' }, [aceite, ' ' + t('aviso')]));
    f.appendChild(el('label', { class: 'lw-check', for: 'lw-m' }, [mk, ' ' + t('marketing')]));
    f.appendChild(hp);
    var msg = el('div', { class: 'portal-alert', role: 'alert' });
    f.appendChild(msg);
    var btn = el('button', { class: 'btn btn--gold', type: 'submit', text: t('enviar') }); f.appendChild(btn);
    caixa.appendChild(f);
    f.onsubmit = async function (e) {
      e.preventDefault(); msg.textContent = ''; msg.className = 'portal-alert';
      btn.disabled = true;
      try {
        var r = await api({ acao: 'pub_inscrever', nome: nome.value, email: email.value, telefone: fone.value, aceite: aceite.checked, marketing: mk.checked, website: hp.value });
        caixa.innerHTML = '';
        caixa.appendChild(el('h2', { class: 'portal-h2', text: t('inscrito') }));
        if (r.ja_inscrito) caixa.appendChild(el('p', { text: t('jaInscrito') }));
        else {
          caixa.appendChild(el('p', { text: dataHora(w.starts_at) }));
          if (!r.email_enviado) caixa.appendChild(el('p', { class: 'portal-muted', text: t('emailFalhou') }));
          caixa.appendChild(el('a', { class: 'btn btn--navy', href: 'webinar.html?w=' + encodeURIComponent(SLUG) + '&t=' + encodeURIComponent(r.token) + (qs.get('lang') ? '&lang=' + qs.get('lang') : ''), text: t('entrar') }));
        }
      } catch (err) { btn.disabled = false; msg.textContent = err.message; msg.className = 'portal-alert portal-alert--error'; }
    };
  }

  /* ---------------- sala ---------------- */
  async function sala() {
    var E;
    try { E = await api({ acao: 'pub_entrar', token: TOKEN }); }
    catch (e) { idiomaDe(); main.innerHTML = ''; main.appendChild(el('div', { class: 'portal-card lw-msg' }, [el('p', { text: e.status === 404 ? t('naoEncontrado') : e.message }), el('a', { class: 'btn btn--navy', href: 'webinar.html?w=' + encodeURIComponent(SLUG), text: t('inscrever') })])); return; }
    idiomaDe(E.idioma); document.title = E.titulo; document.body.classList.add('lw-escuro');
    if (E.cancelado) { main.innerHTML = ''; main.appendChild(el('div', { class: 'lw-msg', text: t('cancelado') })); return; }
    var S = { offset: E.agora - Date.now(), w: { starts_at: E.starts_at, playback: E.playback || {} }, linha: C.linhaDoTempo(E.slides, E.narracao, E.ritmo, E.intro ? E.intro.duracao_ms : 0), video: null, falando: null,
      estado: E.estado, desde: 0, desdePriv: 0, slide: null, audio: null, somOk: false, ia: E.ia, contato: E.contato_ok, aba: 'chat', vistas: {}, n: 0,
      sessao: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 32) };
    var abre = Date.parse(E.starts_at) - E.chat_abre_min * 60000;

    main.innerHTML = '';
    var selo = el('span', { class: 'lw-selo', id: 'lwSelo' }), conta = el('span', { class: 'lw-conta', id: 'lwConta', hidden: true });
    var palco = el('div', { class: 'lw-palco', id: 'lwPalco' }), leg = el('p', { class: 'lw-legenda', 'aria-live': 'off' });
    var somBtn = el('button', { class: 'lw-som', type: 'button', hidden: true, onclick: function () { S.somOk = true; somBtn.hidden = true; if (S.video) S.video.muted = false; S.falando = null; sincronizar(true); } }, ['🔊 ' + t('som')]);
    var seloVoz = el('span', { class: 'lw-selo-voz', hidden: true, text: t('vozTeste') });
    var temTeste = E.voz_teste && 'speechSynthesis' in window && E.slides.some(function (x) { return x.roteiro && !E.audios[x.id]; });
    var espera = el('div', { class: 'lw-espera', hidden: true });
    var abaChat = el('button', { type: 'button', role: 'tab', 'aria-selected': 'true', onclick: function () { trocarAba('chat'); } }, [t('chat')]);
    var abaPriv = el('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: function () { trocarAba('priv'); } }, [t('particular')]);
    var listaPub = el('ol', { class: 'lw-msgs', 'aria-live': 'polite' }), listaPriv = el('ol', { class: 'lw-msgs' });
    var formPub = form('publico'), formPriv = form('privado');
    var painelPub = el('div', { class: 'lw-painel' }, [listaPub, formPub]), painelPriv = el('div', { class: 'lw-painel', hidden: true }, [el('p', { class: 'lw-priv-intro', text: t('privIntro') }), listaPriv, el('div', { id: 'lwContato' }), formPriv]);
    main.appendChild(el('div', { class: 'lw-sala' }, [
      el('header', { class: 'lw-topo' }, [el('div', {}, [el('p', { class: 'lw-empresa', text: E.empresa }), el('h1', { text: E.titulo })]), el('div', { class: 'lw-topo-dir' }, [conta, selo])]),
      el('section', { class: 'lw-video', 'aria-label': E.titulo }, [palco, espera, somBtn, seloVoz, leg]),
      el('aside', { class: 'lw-chat' }, [el('div', { class: 'lw-abas', role: 'tablist' }, [abaChat, abaPriv]), painelPub, painelPriv]),
      el('footer', { class: 'lw-rodape', text: t(temTeste ? 'rodapeTeste' : 'rodape') })]));
    desenharContato();

    function trocarAba(a) {
      S.aba = a; abaChat.setAttribute('aria-selected', String(a === 'chat')); abaPriv.setAttribute('aria-selected', String(a === 'priv'));
      painelPub.hidden = a !== 'chat'; painelPriv.hidden = a !== 'priv'; abaPriv.classList.remove('novo');
    }
    function form(canal) {
      var i = el('input', { type: 'text', maxlength: '600', placeholder: t('escreva'), 'aria-label': t('escreva') });
      var b = el('button', { class: 'lw-enviar', type: 'submit', text: t('mandar') });
      var aviso = el('p', { class: 'lw-aviso', role: 'status' });
      var f = el('form', { class: 'lw-form' }, [aviso, el('div', { class: 'lw-form-linha' }, [i, b])]);
      f.onsubmit = async function (e) {
        e.preventDefault(); var v = i.value.trim(); if (!v) return;
        b.disabled = true; aviso.textContent = '';
        try { await api({ acao: 'pub_mensagem', token: TOKEN, texto: v, canal: canal }); i.value = ''; estado(); }
        catch (err) { aviso.textContent = err.message; }
        b.disabled = false; i.focus();
      };
      f._aviso = aviso; f._input = i; f._btn = b;
      return f;
    }
    function msgEl(m) {
      var cls = 'lw-m lw-m--' + m.autor, rot = null;
      if (m.autor === 'ia') rot = el('span', { class: 'lw-tag lw-tag--ia', text: t('ia') });
      if (m.autor === 'anfitriao') rot = el('span', { class: 'lw-tag lw-tag--eq', text: t('equipe') });
      if (m.autor === 'faq') {
        return el('li', { class: cls, 'data-id': m.id }, [el('p', { class: 'lw-faq-t' }, [el('span', { class: 'lw-tag lw-tag--faq', text: t('faq') })]), el('p', { class: 'lw-faq-p', text: m.texto }),
          m.extra && m.extra.resposta ? el('p', { class: 'lw-faq-r' }, [el('strong', { text: t('iaResponde') + ': ' }), m.extra.resposta]) : null]);
      }
      var nome = m.autor === 'ia' ? t('iaResponde') : m.nome;
      var li = el('li', { class: cls, 'data-id': m.id }, [el('p', { class: 'lw-m-quem' }, [el('strong', { text: nome }), rot ? ' ' : null, rot, el('time', { text: hora(m.created_at) })]), el('p', { class: 'lw-m-txt', text: m.texto })]);
      if (m.extra && m.extra.link) li.appendChild(el('a', { class: 'lw-link', href: m.extra.link, target: '_blank', rel: 'noopener', text: m.extra.link }));
      if (m.extra && (m.extra.convite_privado || m.extra.mostrar_agenda)) li.appendChild(el('button', { class: 'lw-cta', type: 'button', text: m.extra.mostrar_agenda ? t('verHorarios') : t('abrirPriv'), onclick: function () { trocarAba('priv'); if (m.extra.mostrar_agenda && S.contato) mostrarHorarios(); } }));
      return li;
    }
    function acrescentar(lista, msgs) {
      var perto = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
      msgs.forEach(function (m) { if (!lista.querySelector('[data-id="' + m.id + '"]')) lista.appendChild(msgEl(m)); });
      if (perto || msgs.length) lista.scrollTop = lista.scrollHeight;
    }

    /* ----- contatos e agenda (caixa privada) ----- */
    function desenharContato() {
      var c = document.getElementById('lwContato'); c.innerHTML = '';
      if (S.contato) {
        if (E.agendamento === 'calendario') c.appendChild(el('div', { class: 'lw-botoes' }, [el('button', { class: 'lw-cta', type: 'button', onclick: mostrarHorarios, text: t('verHorarios') }), el('button', { class: 'lw-cta lw-cta--sec', type: 'button', onclick: pedirLink, text: t('soLink') })]));
        else if (E.agendamento === 'link') c.appendChild(el('div', { class: 'lw-botoes' }, [el('button', { class: 'lw-cta', type: 'button', onclick: pedirLink, text: t('soLink') })]));
        return;
      }
      var f = el('form', { class: 'lw-contato', novalidate: true });
      var n = el('input', { value: E.nome || '', maxlength: '120', autocomplete: 'name', 'aria-label': t('nome'), placeholder: t('nome') });
      var em = el('input', { type: 'email', maxlength: '254', autocomplete: 'email', 'aria-label': t('email'), placeholder: t('email') });
      var fo = el('input', { type: 'tel', maxlength: '40', autocomplete: 'tel', 'aria-label': t('telefone'), placeholder: t('telefone') });
      var as = el('input', { maxlength: '300', 'aria-label': t('assunto'), placeholder: t('assunto') });
      var ok = el('input', { type: 'checkbox', id: 'lwAut' });
      var m = el('p', { class: 'lw-aviso', role: 'alert' });
      var b = el('button', { class: 'lw-cta', type: 'submit', text: t('salvarContato') });
      [n, em, fo, as].forEach(function (i) { f.appendChild(i); });
      f.appendChild(el('label', { class: 'lw-check', for: 'lwAut' }, [ok, ' ' + t('autorizo', { empresa: E.empresa })]));
      f.appendChild(m); f.appendChild(b);
      f.onsubmit = async function (e) {
        e.preventDefault(); m.textContent = ''; b.disabled = true;
        try { await api({ acao: 'pub_contato', token: TOKEN, nome: n.value, email: em.value, telefone: fo.value, assunto: as.value, consentimento: ok.checked }); S.contato = true; S.fone = fo.value; desenharContato(); estado(); }
        catch (err) { m.textContent = err.message; b.disabled = false; }
      };
      c.appendChild(f);
    }
    async function pedirLink() { try { await api({ acao: 'pub_link', token: TOKEN }); estado(); } catch (e) { formPriv._aviso.textContent = e.message; } }
    async function mostrarHorarios() {
      var c = document.getElementById('lwContato'); c.innerHTML = '';
      var r;
      try { r = await api({ acao: 'pub_horarios', token: TOKEN }); } catch (e) { c.appendChild(el('p', { class: 'lw-aviso', text: e.message })); return; }
      if (!r.horarios.length) { c.appendChild(el('p', { text: t('semHorarios') })); c.appendChild(el('button', { class: 'lw-cta', type: 'button', onclick: pedirLink, text: t('soLink') })); return; }
      var escolha = null, box = el('div', { class: 'lw-agenda' });
      box.appendChild(el('p', { class: 'lw-aviso', text: t('fusoInfo', { tz: TZ }) }));
      var dias = {}; r.horarios.forEach(function (h) { var d = new Intl.DateTimeFormat(document.documentElement.lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(h)); (dias[d] = dias[d] || []).push(h); });
      Object.keys(dias).slice(0, 7).forEach(function (d) {
        box.appendChild(el('p', { class: 'lw-dia', text: d }));
        box.appendChild(el('div', { class: 'lw-horas' }, dias[d].map(function (h) {
          return el('button', { type: 'button', class: 'lw-hora', 'aria-pressed': 'false', text: hora(h), onclick: function () { escolha = h; box.querySelectorAll('.lw-hora').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); this.setAttribute('aria-pressed', 'true'); conf.disabled = false; } });
        })));
      });
      var tipo = null, fone = null;
      if (r.tipos && r.tipos.length) {
        tipo = el('select', { 'aria-label': t('tipo') }, r.tipos.map(function (x) { return el('option', { value: x, text: t({ video: 'video', phone: 'fone', whatsapp: 'whatsapp' }[x]) }); }));
        box.appendChild(el('label', { class: 'lw-campo' }, [t('tipo'), tipo]));
      }
      if (r.telefone_obrigatorio) { fone = el('input', { type: 'tel', value: S.fone || '', placeholder: '+1 407 555 0100', maxlength: '40' }); box.appendChild(el('label', { class: 'lw-campo' }, [t('foneObrig'), fone])); }
      var m = el('p', { class: 'lw-aviso', role: 'alert' });
      var conf = el('button', { class: 'lw-cta', type: 'button', disabled: true, text: t('confirmar'), onclick: async function () {
        conf.disabled = true; m.textContent = '';
        try { await api({ acao: 'pub_agendar', token: TOKEN, inicio: escolha, tipo: tipo ? tipo.value : undefined, telefone: fone ? fone.value : undefined, timezone: TZ }); c.innerHTML = ''; c.appendChild(el('p', { class: 'lw-ok', text: t('ateLogo') })); estado(); }
        catch (e) { m.textContent = e.message; conf.disabled = false; }
      } });
      box.appendChild(m); box.appendChild(conf);
      box.appendChild(el('button', { class: 'lw-cta lw-cta--sec', type: 'button', onclick: pedirLink, text: t('soLink') }));
      c.appendChild(box);
    }

    /* ----- reprodução sincronizada ----- */
    function agora() { return Date.now() + S.offset; }
    function sincronizar(forcar) {
      var p = C.posicao(S.w, S.linha, agora());
      S.estado = p.estado;
      selo.className = 'lw-selo' + (p.estado === 'ao_vivo' ? ' vivo' : '');
      selo.textContent = p.estado === 'ao_vivo' ? '● ' + t('aoVivo') : p.estado === 'pausado' ? '❚❚ ' + t('pausado') : p.estado === 'antes' ? t('comeca') + ' ' + falta(p.faltam) : '';
      var podeChat = agora() >= abre && p.estado !== 'encerrado';
      [formPub, formPriv].forEach(function (f) { f._input.disabled = f._btn.disabled = !podeChat && !(f === formPriv && p.estado === 'encerrado'); });
      var base = !podeChat && p.estado === 'antes' ? t('chatFechado', { n: E.chat_abre_min }) : (!S.ia && podeChat ? t('semIA') : '');
      if (formPub._base !== base) { formPub._aviso.textContent = base; formPub._base = base; }
      if (p.estado === 'antes') {
        mostrarSlide(0, 0, false); espera.hidden = false; espera.textContent = t('comeca') + ' ' + falta(p.faltam); return;
      }
      espera.hidden = p.estado !== 'encerrado';
      if (p.estado === 'encerrado') { espera.textContent = t('encerrado'); pararAudio(); if (S.video) S.video.pause(); leg.textContent = ''; return; }
      var s = C.slideNa(S.linha, p.pos);
      mostrarSlide(s.i, s.offset, p.estado === 'ao_vivo', forcar);
    }
    function mostrarSlide(i, offset, tocando, forcar) {
      if (i < 0) return mostrarAbertura(offset, tocando, forcar);
      if (S.video) { S.video.pause(); S.video.removeAttribute('src'); S.video = null; }
      var sl = E.slides[i];
      if (S.slide !== i) {
        S.slide = i; palco.innerHTML = ''; calar();
        var no = NA.renderizar(NA.validar({ titulo: E.titulo, slides: [sl] }).slides[0], { numero: i + 1, total: E.slides.length });
        no.classList.add('lw-entra'); palco.appendChild(no);
        leg.textContent = sl.roteiro || '';
        pararAudio();
        if (E.audios[sl.id]) { S.audio = new Audio(E.audios[sl.id]); S.audio.preload = 'auto'; }
      }
      var a = S.audio;
      if (!a) { falarTeste(sl, i, offset, tocando); return; }
      if (!tocando) { if (!a.paused) a.pause(); return; }
      var alvo = offset / 1000;
      if (isFinite(a.duration) && alvo >= a.duration) { if (!a.paused) a.pause(); return; }
      if (forcar || a.paused || Math.abs(a.currentTime - alvo) > 1.5) {
        try { a.currentTime = alvo; } catch (e) { }
        if (a.paused) a.play().then(function () { somBtn.hidden = true; }).catch(function () { somBtn.hidden = false; });
      }
    }
    function pararAudio() { if (S.audio) { S.audio.pause(); S.audio.removeAttribute('src'); S.audio = null; } calar(); }
    /* vídeo de abertura gravado pelo organizador, sincronizado como o resto */
    function mostrarAbertura(offset, tocando, forcar) {
      if (S.slide !== -1) {
        S.slide = -1; palco.innerHTML = ''; pararAudio(); leg.textContent = '';
        S.video = el('video', { class: 'lw-intro', playsinline: true, preload: 'auto', src: E.intro.url });
        palco.appendChild(S.video);
      }
      var v = S.video, alvo = offset / 1000;
      if (!tocando) { if (!v.paused) v.pause(); return; }
      if (isFinite(v.duration) && alvo >= v.duration) return;
      if (forcar || v.paused || Math.abs(v.currentTime - alvo) > 1.5) {
        try { v.currentTime = alvo; } catch (e) { }
        if (v.paused) v.play().then(function () { if (!v.muted) somBtn.hidden = true; }).catch(function () {
          // sem clique ainda: toca sem som e mostra o botão para ativar
          v.muted = true; v.play().catch(function () { }); somBtn.hidden = false;
        });
      }
    }
    /* voz de teste do navegador (só quando o organizador ligou e o slide não tem narração gravada) */
    function calar() { if (S.falando != null) { try { speechSynthesis.cancel(); } catch (e) { } S.falando = null; } seloVoz.hidden = true; }
    function falarTeste(sl, i, offset, tocando) {
      if (!temTeste || !sl.roteiro || E.audios[sl.id]) return;
      if (!tocando) { calar(); return; }
      if (!S.somOk) { somBtn.hidden = false; return; }
      if (S.falando === i) return;
      var it = S.linha[i], resto = C.restoDoRoteiro(sl.roteiro, offset, it ? it.dur : 0);
      if (!resto) return;
      try {
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(resto); u.lang = document.documentElement.lang === 'en' ? 'en-US' : document.documentElement.lang === 'es' ? 'es-ES' : 'pt-BR';
        u.rate = E.ritmo === 'rapido' ? 1.1 : E.ritmo === 'calmo' ? 0.9 : 1;
        var vs = speechSynthesis.getVoices() || [], vz = vs.find(function (v) { return v.lang.toLowerCase() === u.lang.toLowerCase(); }) || vs.find(function (v) { return v.lang.toLowerCase().indexOf(u.lang.slice(0, 2)) === 0; });
        if (vz) u.voice = vz;
        speechSynthesis.speak(u); S.falando = i; seloVoz.hidden = false;
      } catch (e) { }
    }

    /* ----- servidor: estado, chat e presença ----- */
    async function estado() {
      S.n++;
      try {
        var r = await api({ acao: 'pub_estado', token: TOKEN, sessao: S.sessao, desde: S.desde, desde_priv: S.desdePriv, ping: S.n % 5 === 1 });
        S.offset = r.agora - Date.now(); S.w.playback = r.playback || {}; S.ia = r.ia;
        if (r.contador) { conta.hidden = false; conta.textContent = r.contador + ' ' + t('assistindo'); } else conta.hidden = true;
        if (r.publicas.length) { acrescentar(listaPub, r.publicas); S.desde = r.publicas[r.publicas.length - 1].id; }
        if (r.privadas.length) { acrescentar(listaPriv, r.privadas); S.desdePriv = r.privadas[r.privadas.length - 1].id; if (S.aba !== 'priv') abaPriv.classList.add('novo'); }
        (r.ocultas || []).forEach(function (id) { var x = listaPub.querySelector('[data-id="' + id + '"]'); if (x) x.remove(); });
      } catch (e) { /* tenta de novo no próximo ciclo */ }
    }
    estado(); sincronizar();
    setInterval(estado, 3000);
    setInterval(function () { sincronizar(false); }, 250);
  }
})();
