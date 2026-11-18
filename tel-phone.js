/* Endeavor Phone — o celular virtual da Telefonia (portal e app PWA).
   ETelPhone.abrir({ call, empresa, numero, L, demo, modo: 'janela'|'app' })
   - janela: um celular na tela, arrastável e minimizável; fica no <body>, então a ligação continua enquanto a pessoa usa o portal.
   - app: ocupa a tela inteira (phone.html).
   Tudo passa pela função "telephony"; na fase 1 é demonstração (nenhuma ligação ou SMS real) e a tela diz isso. */
(function () {
  var T = {
    pt: { telefone: 'Telefone', teclado: 'Teclado', recentes: 'Recentes', contatos: 'Contatos', mensagens: 'Mensagens', voicemail: 'Voicemail', whatsapp: 'WhatsApp', inicio: 'Início', ligar: 'Ligar', apagar: 'Apagar',
      minimizar: 'Minimizar', fechar: 'Fechar', demo: 'Demonstração', demoChamada: 'Demonstração: nenhuma ligação real', mudo: 'Mudo', teclas: 'Teclado', desligar: 'Desligar', atender: 'Atender', recusar: 'Recusar',
      chamando: 'Chamando…', emChamada: 'Em ligação', recebendo: 'Ligação recebida', novo: 'Novo contato', salvar: 'Salvar', cancelar: 'Cancelar', nome: 'Nome', tel: 'Telefone', email: 'E-mail', emp: 'Empresa', notas: 'Notas',
      editar: 'Editar', buscar: 'Buscar', crm: 'Puxar do CRM', importar: 'Importar selecionados', nada: 'Nada por aqui ainda.', enviar: 'Enviar', escreva: 'Mensagem', novaMsg: 'Nova mensagem', para: 'Para',
      ouvido: 'Marcar como ouvido', transcricao: 'Transcrição', perdida: 'Perdida', recebida: 'Recebida', feita: 'Feita', recusada: 'Recusada', vmail: 'Voicemail', abrirTel: 'Abrir telefone', voltar: 'Voltar',
      waTexto: 'Por enquanto o WhatsApp abre numa janela ao lado. Com o adicional “Conectar WhatsApp” (API oficial), as conversas aparecem aqui dentro.', waAbrir: 'Abrir WhatsApp Web', optout: 'Esta pessoa pediu para não receber SMS (STOP).',
      arraste: 'Arraste para mover', semNumero: 'A empresa ainda não tem número ativo.', partes: 'partes', entregue: 'Entregue', falhou: 'Falhou', naFila: 'Enviando' },
    en: { telefone: 'Phone', teclado: 'Keypad', recentes: 'Recents', contatos: 'Contacts', mensagens: 'Messages', voicemail: 'Voicemail', whatsapp: 'WhatsApp', inicio: 'Home', ligar: 'Call', apagar: 'Delete',
      minimizar: 'Minimize', fechar: 'Close', demo: 'Demo', demoChamada: 'Demo: no real call', mudo: 'Mute', teclas: 'Keypad', desligar: 'End', atender: 'Answer', recusar: 'Decline',
      chamando: 'Calling…', emChamada: 'On call', recebendo: 'Incoming call', novo: 'New contact', salvar: 'Save', cancelar: 'Cancel', nome: 'Name', tel: 'Phone', email: 'Email', emp: 'Company', notas: 'Notes',
      editar: 'Edit', buscar: 'Search', crm: 'Import from CRM', importar: 'Import selected', nada: 'Nothing here yet.', enviar: 'Send', escreva: 'Message', novaMsg: 'New message', para: 'To',
      ouvido: 'Mark as heard', transcricao: 'Transcript', perdida: 'Missed', recebida: 'Incoming', feita: 'Outgoing', recusada: 'Declined', vmail: 'Voicemail', abrirTel: 'Open phone', voltar: 'Back',
      waTexto: 'For now WhatsApp opens in a window next to this one. With the “Connect WhatsApp” add-on (official API), chats show up right here.', waAbrir: 'Open WhatsApp Web', optout: 'This person opted out of SMS (STOP).',
      arraste: 'Drag to move', semNumero: 'The company has no active number yet.', partes: 'parts', entregue: 'Delivered', falhou: 'Failed', naFila: 'Sending' },
    es: { telefone: 'Teléfono', teclado: 'Teclado', recentes: 'Recientes', contatos: 'Contactos', mensagens: 'Mensajes', voicemail: 'Buzón de voz', whatsapp: 'WhatsApp', inicio: 'Inicio', ligar: 'Llamar', apagar: 'Borrar',
      minimizar: 'Minimizar', fechar: 'Cerrar', demo: 'Demostración', demoChamada: 'Demostración: ninguna llamada real', mudo: 'Silencio', teclas: 'Teclado', desligar: 'Colgar', atender: 'Contestar', recusar: 'Rechazar',
      chamando: 'Llamando…', emChamada: 'En llamada', recebendo: 'Llamada entrante', novo: 'Nuevo contacto', salvar: 'Guardar', cancelar: 'Cancelar', nome: 'Nombre', tel: 'Teléfono', email: 'Correo', emp: 'Empresa', notas: 'Notas',
      editar: 'Editar', buscar: 'Buscar', crm: 'Traer del CRM', importar: 'Importar seleccionados', nada: 'Nada por aquí todavía.', enviar: 'Enviar', escreva: 'Mensaje', novaMsg: 'Nuevo mensaje', para: 'Para',
      ouvido: 'Marcar como escuchado', transcricao: 'Transcripción', perdida: 'Perdida', recebida: 'Recibida', feita: 'Realizada', recusada: 'Rechazada', vmail: 'Buzón', abrirTel: 'Abrir teléfono', voltar: 'Volver',
      waTexto: 'Por ahora WhatsApp se abre en una ventana al lado. Con el adicional “Conectar WhatsApp” (API oficial), los chats aparecen aquí dentro.', waAbrir: 'Abrir WhatsApp Web', optout: 'Esta persona pidió no recibir SMS (STOP).',
      arraste: 'Arrastre para mover', semNumero: 'La empresa aún no tiene número activo.', partes: 'partes', entregue: 'Entregado', falhou: 'Falló', naFila: 'Enviando' }
  };
  var ICONES = {
    telefone: '<path d="M7.5 3.5h2.6l1.4 4-2 1.6a12 12 0 0 0 5.4 5.4l1.6-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16 16 0 0 1 5.5 5.7a2 2 0 0 1 2-2.2z" fill="currentColor"/>',
    recentes: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    contatos: '<circle cx="12" cy="9" r="3.6" fill="currentColor"/><path d="M5 19.5c1.2-3.4 4-5 7-5s5.8 1.6 7 5z" fill="currentColor"/>',
    mensagens: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z" fill="currentColor"/>',
    voicemail: '<circle cx="7" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 15.5h10" stroke="currentColor" stroke-width="2"/>',
    whatsapp: '<path d="M12 3.4a8.6 8.6 0 0 0-7.4 13l-1.1 4.2 4.3-1.1A8.6 8.6 0 1 0 12 3.4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 8.6c.3-.6.6-.6.9-.6h.4c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.6l-.4.5c.4.8 1.3 1.7 2.2 2.1l.5-.5c.2-.2.4-.2.6-.1l1.5.7c.2.1.3.3.3.5 0 .6-.4 1.4-1.1 1.6-1.6.4-5.6-2.6-5.9-5-.1-.6.1-1.2.4-1.7z" fill="currentColor"/>',
    teclado: '<g fill="currentColor"><circle cx="7" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="17" cy="6" r="1.6"/><circle cx="7" cy="11" r="1.6"/><circle cx="12" cy="11" r="1.6"/><circle cx="17" cy="11" r="1.6"/><circle cx="7" cy="16" r="1.6"/><circle cx="12" cy="16" r="1.6"/><circle cx="17" cy="16" r="1.6"/><circle cx="12" cy="21" r="1.6"/></g>',
    mudo: '<path d="M9 9v3a3 3 0 0 0 5 2.2M15 11V6a3 3 0 0 0-6 0M6 11a6 6 0 0 0 10 4.4M18 11a6 6 0 0 1-.4 2M12 17v3M4 4l16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    desligar: '<path d="M3.5 13.5c4.8-4.3 12.2-4.3 17 0l-1.8 2.6-3.3-1.2-.4-2.3a9.4 9.4 0 0 0-6 0l-.4 2.3-3.3 1.2z" fill="currentColor"/>'
  };
  var APPS = ['telefone', 'recentes', 'contatos', 'mensagens', 'voicemail', 'whatsapp'];
  var S = null; // estado do telefone aberto

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var svg = function (k, cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONES[k] + '</svg>'; };
  var fone = function (n) { var m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(n || ''); return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : (n || ''); };
  function e164(v) { var s = String(v || '').trim(), d = s.replace(/[^\d]/g, ''); if (!d) return ''; if (s.charAt(0) !== '+' && d.length === 10) d = '1' + d; return d.length >= 8 && d.length <= 15 ? '+' + d : ''; }
  function t(k) { return (T[S && S.L] || T.pt)[k] || T.pt[k] || k; }
  function hora(iso) { try { return new Intl.DateTimeFormat(S.L === 'pt' ? 'pt-BR' : S.L, { hour: '2-digit', minute: '2-digit' }).format(iso ? new Date(iso) : new Date()); } catch (e) { return ''; } }
  function dia(iso) { try { return new Intl.DateTimeFormat(S.L === 'pt' ? 'pt-BR' : S.L, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return ''; } }
  function nomeDe(n) { var c = (S.contatos || []).find(function (x) { return x.telefone === n; }); return c ? c.nome : fone(n); }
  function guardar(k, v) { try { localStorage.setItem('endeavor-phone-' + k, JSON.stringify(v)); } catch (e) { /* ok */ } }
  function ler(k) { try { return JSON.parse(localStorage.getItem('endeavor-phone-' + k) || 'null'); } catch (e) { return null; } }
  function api(b) { return S.call(Object.assign({ company_id: S.empresa }, b)); }

  /* ---------- montar ---------- */
  function abrir(o) {
    if (S && S.el && document.body.contains(S.el)) { if (S.empresa === o.empresa) { restaurar(); return; } fechar(true); }
    S = { call: o.call, empresa: o.empresa, numero: o.numero || null, L: T[o.L] ? o.L : 'pt', demo: o.demo !== false, modo: o.modo === 'app' ? 'app' : 'janela', tela: 'home', pilha: [], contatos: [], novidades: {}, chamada: null, aoFechar: o.aoFechar };
    var el = document.createElement('div');
    el.className = 'tp' + (S.modo === 'app' ? ' tp--app' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Endeavor Phone');
    el.innerHTML = (S.modo === 'janela' ? '<div class="tp-barra" title="' + t('arraste') + '"><span class="tp-grip" aria-hidden="true"></span><button type="button" class="tp-bt-min" aria-label="' + t('minimizar') + '">–</button><button type="button" class="tp-bt-x" aria-label="' + t('fechar') + '">×</button></div>' : '') +
      '<div class="tp-aparelho"><div class="tp-ilha" aria-hidden="true"></div><div class="tp-status"><span class="tp-hora">' + hora() + '</span>' + (S.demo ? '<span class="tp-demo">' + t('demo') + '</span>' : '') + '<span class="tp-sinal" aria-hidden="true">●●●</span></div>' +
      '<div class="tp-tela" aria-live="polite"></div><button type="button" class="tp-home" aria-label="' + t('inicio') + '"></button></div>';
    document.body.appendChild(el);
    S.el = el; S.tela_el = el.querySelector('.tp-tela');
    if (S.modo === 'janela') {
      var pos = ler('pos');
      if (pos && window.innerWidth > 640) { el.style.left = Math.min(Math.max(0, pos.x), window.innerWidth - 300) + 'px'; el.style.top = Math.min(Math.max(0, pos.y), window.innerHeight - 200) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; }
      arrastar(el, el.querySelector('.tp-barra'));
      el.querySelector('.tp-bt-min').onclick = minimizar;
      el.querySelector('.tp-bt-x').onclick = function () { if (S.chamada && !window.confirm(t('desligar') + '?')) return; fechar(); };
    }
    el.querySelector('.tp-home').onclick = function () { if (!S.chamada || S.tela !== 'chamada') ir('home'); };
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.modo === 'janela') minimizar(); });
    S.relogio = setInterval(function () { var h = el.querySelector('.tp-hora'); if (h) h.textContent = hora(); var ct = el.querySelector('.tp-cron'); if (ct && S.chamada && S.chamada.inicio) ct.textContent = cron(); }, 1000);
    api({ acao: 'p_contatos' }).then(function (r) { S.contatos = r.contatos || []; if (S.tela === 'home') ir('home'); }).catch(function () { });
    ir('home');
    novidades(); S.timer = setInterval(novidades, 5000);
    setTimeout(function () { var b = el.querySelector('.tp-app'); if (b) b.focus(); }, 50);
  }
  function fechar(silencioso) {
    if (!S) return;
    clearInterval(S.timer); clearInterval(S.relogio);
    if (S.chamada && S.chamada.id) api({ acao: 'p_desligar', call_id: S.chamada.id }).catch(function () { });
    if (S.el) S.el.remove();
    var pilula = document.querySelector('.tp-pilula'); if (pilula) pilula.remove();
    var cb = S.aoFechar; S = null;
    if (!silencioso && cb) cb();
  }
  function minimizar() {
    if (!S || S.modo !== 'janela') return;
    S.el.hidden = true;
    var p = document.querySelector('.tp-pilula');
    if (!p) { p = document.createElement('button'); p.type = 'button'; p.className = 'tp-pilula'; document.body.appendChild(p); p.onclick = restaurar; }
    pilula();
    p.focus();
  }
  function pilula() {
    var p = document.querySelector('.tp-pilula'); if (!p || !S) return;
    var n = (S.novidades.sms_nao_lidas || 0) + (S.novidades.voicemails_novos || 0);
    p.innerHTML = svg('telefone') + '<span>' + (S.chamada ? t('emChamada') + ' · <span class="tp-cron">' + cron() + '</span>' : t('telefone')) + '</span>' + (n ? '<b class="tp-badge" aria-label="' + n + '">' + (n > 9 ? '9+' : n) + '</b>' : '');
    p.classList.toggle('tp-pilula--chamada', !!S.chamada);
    p.setAttribute('aria-label', t('abrirTel') + (n ? ' (' + n + ')' : ''));
  }
  function restaurar() { if (!S) return; S.el.hidden = false; var p = document.querySelector('.tp-pilula'); if (p) p.remove(); var b = S.el.querySelector('button, input'); if (b) b.focus(); }
  function arrastar(el, alca) {
    var ini = null;
    alca.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || window.innerWidth <= 640) return;
      var r = el.getBoundingClientRect(); ini = { x: e.clientX - r.left, y: e.clientY - r.top }; alca.setPointerCapture(e.pointerId); el.classList.add('tp--arrastando');
    });
    alca.addEventListener('pointermove', function (e) {
      if (!ini) return;
      var x = Math.min(Math.max(0, e.clientX - ini.x), window.innerWidth - el.offsetWidth), y = Math.min(Math.max(0, e.clientY - ini.y), window.innerHeight - 60);
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    });
    alca.addEventListener('pointerup', function () { if (!ini) return; ini = null; el.classList.remove('tp--arrastando'); var r = el.getBoundingClientRect(); guardar('pos', { x: r.left, y: r.top }); });
  }

  /* ---------- novidades: SMS, voicemail e ligação tocando (a cada 5 s) ---------- */
  function novidades() {
    if (!S) return;
    api({ acao: 'p_novidades' }).then(function (r) {
      if (!S) return;
      var antes = S.novidades; S.novidades = r;
      if (r.tocando && !S.chamada) { S.chamada = { id: r.tocando.id, numero: r.tocando.de, entrada: true, estado: 'tocando' }; if (S.el.hidden) restaurar(); ir('chamada'); }
      if (S.el.hidden) pilula();
      if (S.tela === 'home') ir('home');
      if (S.tela === 'conversa' && (r.sms_nao_lidas || 0) > (antes.sms_nao_lidas || 0)) ir('conversa', S.conversa, true);
      if (S.tela === 'mensagens' && r.sms_nao_lidas !== antes.sms_nao_lidas) ir('mensagens', null, true);
    }).catch(function () { });
  }

  /* ---------- navegação entre telas ---------- */
  function ir(tela, arg, semPilha) {
    if (!S) return;
    if (!semPilha && tela !== S.tela && tela !== 'home') S.pilha.push([S.tela, S.arg]);
    if (tela === 'home') S.pilha = [];
    S.tela = tela; S.arg = arg;
    var f = { home: home, telefone: teclado, recentes: recentes, contatos: contatos, contato: contatoForm, crm: crm, mensagens: mensagens, conversa: conversa, voicemail: voicemail, whatsapp: whatsapp, chamada: chamada }[tela];
    f(arg);
  }
  function topo(titulo, extra) { return '<div class="tp-topo"><button type="button" class="tp-voltar">‹ ' + t('voltar') + '</button><h2>' + esc(titulo) + '</h2>' + (extra || '<span></span>') + '</div>'; }
  function ligarVoltar() { var b = S.tela_el.querySelector('.tp-voltar'); if (b) b.onclick = function () { var p = S.pilha.pop(); if (p) { S.tela = p[0]; ir(p[0], p[1], true); } else ir('home'); }; }

  function home() {
    var n = S.novidades;
    S.tela_el.innerHTML = '<div class="tp-home-tela"><div class="tp-saudacao">' + (S.numero ? '<span>' + esc(fone(S.numero)) + '</span>' : '<span>' + t('semNumero') + '</span>') + '</div><div class="tp-grade">' + APPS.map(function (k) {
      var b = k === 'mensagens' ? n.sms_nao_lidas : k === 'voicemail' ? n.voicemails_novos : 0;
      return '<button type="button" class="tp-app tp-app--' + k + '" data-app="' + k + '"><span class="tp-ico">' + svg(k === 'telefone' ? 'telefone' : k) + (b ? '<b class="tp-badge">' + (b > 9 ? '9+' : b) + '</b>' : '') + '</span><span class="tp-rot">' + t(k) + '</span></button>';
    }).join('') + '</div><div class="tp-dock">' + ['telefone', 'mensagens', 'contatos'].map(function (k) { return '<button type="button" class="tp-app tp-app--' + k + '" data-app="' + k + '" aria-label="' + t(k) + '"><span class="tp-ico">' + svg(k) + '</span></button>'; }).join('') + '</div></div>';
    S.tela_el.querySelectorAll('[data-app]').forEach(function (b) { b.onclick = function () { ir(b.dataset.app); }; });
  }

  /* teclado */
  function teclado(pre) {
    var num = typeof pre === 'string' ? pre : '';
    var teclas = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    S.tela_el.innerHTML = topo(t('teclado')) + '<div class="tp-discador"><label class="sr-only" for="tp-num">' + t('tel') + '</label><input id="tp-num" class="tp-visor" inputmode="tel" autocomplete="off" value="' + esc(num) + '">' +
      '<div class="tp-teclas">' + teclas.map(function (k) { return '<button type="button" class="tp-tecla" data-k="' + k[0] + '"><span>' + k[0] + '</span><small>' + k[1] + '</small></button>'; }).join('') + '</div>' +
      '<div class="tp-acoes"><span></span><button type="button" class="tp-redondo tp-verde" id="tp-ligar" aria-label="' + t('ligar') + '">' + svg('telefone') + '</button><button type="button" class="tp-apagar" aria-label="' + t('apagar') + '">⌫</button></div></div>';
    ligarVoltar();
    var vis = S.tela_el.querySelector('#tp-num');
    S.tela_el.querySelectorAll('.tp-tecla').forEach(function (b) {
      var timer;
      b.onpointerdown = function () { if (b.dataset.k === '0') timer = setTimeout(function () { vis.value += '+'; timer = 'feito'; }, 600); };
      b.onclick = function () { if (timer === 'feito') { timer = null; return; } clearTimeout(timer); vis.value += b.dataset.k; };
    });
    S.tela_el.querySelector('.tp-apagar').onclick = function () { vis.value = vis.value.slice(0, -1); };
    S.tela_el.querySelector('#tp-ligar').onclick = function () { discar(vis.value); };
    vis.addEventListener('keydown', function (e) { if (e.key === 'Enter') discar(vis.value); });
  }
  function discar(v) {
    var n = e164(v);
    if (!n) { var vis = S.tela_el.querySelector('.tp-visor'); if (vis) { vis.classList.add('tp-erro'); setTimeout(function () { vis.classList.remove('tp-erro'); }, 600); } return; }
    S.chamada = { numero: n, entrada: false, estado: 'chamando' };
    ir('chamada');
    api({ acao: 'p_ligar', para: n }).then(function (r) {
      if (!S || !S.chamada) return;
      S.chamada.id = r.chamada.id;
      setTimeout(function () { if (S && S.chamada && S.chamada.id === r.chamada.id) { S.chamada.estado = 'em_andamento'; S.chamada.inicio = Date.now(); if (S.tela === 'chamada') chamada(); } }, 1500);
    }).catch(function (e) { if (S) { S.chamada = null; alertar(e.message); ir('telefone', n, true); } });
  }
  function cron() { if (!S || !S.chamada || !S.chamada.inicio) return '0:00'; var s = Math.floor((Date.now() - S.chamada.inicio) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function chamada() {
    var c = S.chamada; if (!c) return ir('home');
    var tocando = c.entrada && c.estado === 'tocando';
    S.tela_el.innerHTML = '<div class="tp-chamada' + (tocando ? ' tp-chamada--tocando' : '') + '"><div class="tp-quem"><div class="tp-avatar" aria-hidden="true">' + esc((nomeDe(c.numero) || '?').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').charAt(0) || '#') + '</div><h2>' + esc(nomeDe(c.numero)) + '</h2>' +
      '<p class="tp-estado">' + (tocando ? t('recebendo') : c.estado === 'chamando' ? t('chamando') : t('emChamada') + ' · <span class="tp-cron">' + cron() + '</span>') + '</p>' + (S.demo ? '<p class="tp-aviso-demo">' + t('demoChamada') + '</p>' : '') + '</div>' +
      (tocando ? '<div class="tp-botoes tp-botoes--entrada"><button type="button" class="tp-redondo tp-vermelho" id="tp-rec" aria-label="' + t('recusar') + '">' + svg('desligar') + '</button><button type="button" class="tp-redondo tp-verde" id="tp-at" aria-label="' + t('atender') + '">' + svg('telefone') + '</button></div><div class="tp-legendas"><span>' + t('recusar') + '</span><span>' + t('atender') + '</span></div>'
        : '<div class="tp-botoes"><button type="button" class="tp-redondo tp-cinza' + (c.mudo ? ' tp-ligado' : '') + '" id="tp-mudo" aria-pressed="' + !!c.mudo + '" aria-label="' + t('mudo') + '">' + svg('mudo') + '</button><button type="button" class="tp-redondo tp-cinza" id="tp-tecl" aria-label="' + t('teclas') + '">' + svg('teclado') + '</button></div>' +
          '<div id="tp-dtmf" class="tp-dtmf" hidden>' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(function (k) { return '<button type="button" class="tp-tecla tp-tecla--p" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
          '<div class="tp-botoes"><button type="button" class="tp-redondo tp-vermelho tp-grande" id="tp-desl" aria-label="' + t('desligar') + '">' + svg('desligar') + '</button></div>') + '</div>';
    var q = function (s) { return S.tela_el.querySelector(s); };
    if (tocando) {
      q('#tp-at').onclick = function () { api({ acao: 'p_atender', call_id: c.id }).then(function () { c.estado = 'em_andamento'; c.inicio = Date.now(); chamada(); }).catch(function (e) { alertar(e.message); }); };
      q('#tp-rec').onclick = function () { api({ acao: 'p_recusar', call_id: c.id }).catch(function () { }); S.chamada = null; ir('home'); };
      q('#tp-at').focus();
    } else {
      q('#tp-mudo').onclick = function () { c.mudo = !c.mudo; chamada(); };
      q('#tp-tecl').onclick = function () { var d = q('#tp-dtmf'); d.hidden = !d.hidden; };
      S.tela_el.querySelectorAll('.tp-tecla--p').forEach(function (b) { b.onclick = function () { b.classList.add('tp-pisca'); setTimeout(function () { b.classList.remove('tp-pisca'); }, 150); }; });
      q('#tp-desl').onclick = function () { var id = c.id; S.chamada = null; if (id) api({ acao: 'p_desligar', call_id: id }).catch(function () { }); ir('recentes', null, true); };
      q('#tp-desl').focus();
    }
  }

  /* recentes */
  function recentes() {
    S.tela_el.innerHTML = topo(t('recentes')) + '<ul class="tp-lista" id="tp-rl"><li class="tp-vazio">…</li></ul>';
    ligarVoltar();
    api({ acao: 'p_recentes' }).then(function (r) {
      var l = S && S.tela_el.querySelector('#tp-rl'); if (!l) return;
      var cs = r.chamadas || [];
      l.innerHTML = !cs.length ? '<li class="tp-vazio">' + t('nada') + '</li>' : cs.map(function (c) {
        var outro = c.direcao === 'entrada' ? c.de : c.para, perdida = ['perdida', 'recusada'].indexOf(c.status) > -1 && c.direcao === 'entrada';
        var tipo = c.status === 'voicemail' ? t('vmail') : perdida ? t(c.status === 'recusada' ? 'recusada' : 'perdida') : c.direcao === 'entrada' ? t('recebida') : t('feita');
        return '<li><button type="button" class="tp-item" data-n="' + esc(outro) + '"><span class="tp-item-nome' + (perdida ? ' tp-perdida' : '') + '">' + esc(nomeDe(outro)) + '</span><small>' + esc(tipo) + (c.duracao_s ? ' · ' + Math.floor(c.duracao_s / 60) + ':' + String(c.duracao_s % 60).padStart(2, '0') : '') + (c.demo ? ' · ' + t('demo') : '') + '</small><span class="tp-item-hora">' + esc(dia(c.inicio)) + '</span></button></li>';
      }).join('');
      l.querySelectorAll('[data-n]').forEach(function (b) { b.onclick = function () { ir('telefone', b.dataset.n); }; });
    }).catch(function (e) { alertar(e.message); });
  }

  /* contatos: lista, busca, cadastrar/editar, puxar do CRM */
  function contatos() {
    S.tela_el.innerHTML = topo(t('contatos'), '<button type="button" class="tp-mais" aria-label="' + t('novo') + '">+</button>') + '<div class="tp-busca"><label class="sr-only" for="tp-bq">' + t('buscar') + '</label><input id="tp-bq" type="search" placeholder="' + t('buscar') + '"></div>' +
      '<ul class="tp-lista" id="tp-cl"></ul><div class="tp-rodape"><button type="button" class="tp-link" id="tp-crm">' + t('crm') + '</button></div>';
    ligarVoltar();
    var desenhar = function () {
      var f = (S.tela_el.querySelector('#tp-bq').value || '').toLowerCase();
      var cs = S.contatos.filter(function (c) { return !f || (c.nome + ' ' + c.telefone + ' ' + (c.empresa || '')).toLowerCase().indexOf(f) > -1; });
      S.tela_el.querySelector('#tp-cl').innerHTML = !cs.length ? '<li class="tp-vazio">' + t('nada') + '</li>' : cs.map(function (c) {
        return '<li class="tp-contato"><button type="button" class="tp-item" data-ed="' + c.id + '"><span class="tp-item-nome">' + esc(c.nome) + '</span><small>' + esc(fone(c.telefone)) + (c.empresa ? ' · ' + esc(c.empresa) : '') + '</small></button>' +
          '<button type="button" class="tp-mini tp-verde" data-lg="' + esc(c.telefone) + '" aria-label="' + t('ligar') + ' ' + esc(c.nome) + '">' + svg('telefone') + '</button><button type="button" class="tp-mini tp-azul" data-sms="' + esc(c.telefone) + '" aria-label="' + t('mensagens') + ' ' + esc(c.nome) + '">' + svg('mensagens') + '</button></li>';
      }).join('');
      S.tela_el.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { ir('contato', S.contatos.find(function (c) { return c.id === b.dataset.ed; })); }; });
      S.tela_el.querySelectorAll('[data-lg]').forEach(function (b) { b.onclick = function () { discar(b.dataset.lg); }; });
      S.tela_el.querySelectorAll('[data-sms]').forEach(function (b) { b.onclick = function () { ir('conversa', b.dataset.sms); }; });
    };
    S.tela_el.querySelector('#tp-bq').oninput = desenhar;
    S.tela_el.querySelector('.tp-mais').onclick = function () { ir('contato', null); };
    S.tela_el.querySelector('#tp-crm').onclick = function () { ir('crm'); };
    desenhar();
    api({ acao: 'p_contatos' }).then(function (r) { if (!S) return; S.contatos = r.contatos || []; if (S.tela === 'contatos') desenhar(); }).catch(function () { });
  }
  function contatoForm(c) {
    c = c || {};
    var campo = function (id, k, tipo, v) { return '<label for="tp-c-' + id + '">' + t(k) + '</label><input id="tp-c-' + id + '" type="' + tipo + '" value="' + esc(v || '') + '"' + (id === 'tel' ? ' inputmode="tel" required' : id === 'nome' ? ' required' : '') + '>'; };
    S.tela_el.innerHTML = topo(c.id ? t('editar') : t('novo')) + '<form class="tp-form" id="tp-cf">' + campo('nome', 'nome', 'text', c.nome) + campo('tel', 'tel', 'tel', c.telefone ? fone(c.telefone) : '') + campo('email', 'email', 'email', c.email) + campo('emp', 'emp', 'text', c.empresa) +
      '<label for="tp-c-notas">' + t('notas') + '</label><textarea id="tp-c-notas" rows="2">' + esc(c.notas || '') + '</textarea><p class="tp-erro-msg" role="alert" hidden></p>' +
      '<div class="tp-form-bts"><button type="submit" class="tp-bt">' + t('salvar') + '</button>' + (c.id ? '<button type="button" class="tp-bt tp-bt--perigo" id="tp-c-del">' + t('apagar') + '</button>' : '') + '</div></form>';
    ligarVoltar();
    var f = S.tela_el.querySelector('#tp-cf'), err = f.querySelector('.tp-erro-msg');
    f.onsubmit = function (e) {
      e.preventDefault();
      var tel = e164(f.querySelector('#tp-c-tel').value);
      if (!tel) { err.hidden = false; err.textContent = t('tel') + '?'; return; }
      api({ acao: 'p_contato_salvar', id: c.id, nome: f.querySelector('#tp-c-nome').value, telefone: tel, email: f.querySelector('#tp-c-email').value, empresa: f.querySelector('#tp-c-emp').value, notas: f.querySelector('#tp-c-notas').value })
        .then(function () { ir('contatos', null, true); S.pilha = []; }).catch(function (x) { err.hidden = false; err.textContent = x.message; });
    };
    var d = f.querySelector('#tp-c-del');
    if (d) d.onclick = function () { if (!window.confirm(t('apagar') + ' ' + c.nome + '?')) return; api({ acao: 'p_contato_apagar', id: c.id }).then(function () { S.contatos = S.contatos.filter(function (x) { return x.id !== c.id; }); ir('contatos', null, true); S.pilha = []; }); };
    f.querySelector('#tp-c-nome').focus();
  }
  function crm() {
    S.tela_el.innerHTML = topo(t('crm')) + '<form id="tp-crmf"><ul class="tp-lista" id="tp-crml"><li class="tp-vazio">…</li></ul><div class="tp-rodape"><button type="submit" class="tp-bt">' + t('importar') + '</button></div></form>';
    ligarVoltar();
    api({ acao: 'p_crm_contatos' }).then(function (r) {
      var l = S && S.tela_el.querySelector('#tp-crml'); if (!l) return;
      var cs = r.contatos || [];
      l.innerHTML = !cs.length ? '<li class="tp-vazio">' + t('nada') + '</li>' : cs.map(function (c) { return '<li><label class="tp-item tp-check"><input type="checkbox" value="' + c.id + '"><span class="tp-item-nome">' + esc(c.nome) + '</span><small>' + esc(fone(c.telefone)) + '</small></label></li>'; }).join('');
    }).catch(function (e) { alertar(e.message); });
    S.tela_el.querySelector('#tp-crmf').onsubmit = function (e) {
      e.preventDefault();
      var ids = Array.prototype.map.call(S.tela_el.querySelectorAll('#tp-crml input:checked'), function (x) { return x.value; });
      if (!ids.length) return;
      api({ acao: 'p_importar_crm', ids: ids }).then(function () { return api({ acao: 'p_contatos' }); }).then(function (r) { S.contatos = r.contatos || []; S.pilha = []; ir('contatos', null, true); }).catch(function (x) { alertar(x.message); });
    };
  }

  /* mensagens (SMS) */
  function mensagens() {
    S.tela_el.innerHTML = topo(t('mensagens'), '<button type="button" class="tp-mais" aria-label="' + t('novaMsg') + '">✎</button>') + '<ul class="tp-lista" id="tp-ml"><li class="tp-vazio">…</li></ul>';
    ligarVoltar();
    S.tela_el.querySelector('.tp-mais').onclick = function () { ir('conversa', ''); };
    api({ acao: 'p_mensagens' }).then(function (r) {
      var l = S && S.tela_el.querySelector('#tp-ml'); if (!l) return;
      var cs = r.conversas || [];
      l.innerHTML = !cs.length ? '<li class="tp-vazio">' + t('nada') + '</li>' : cs.map(function (c) {
        return '<li><button type="button" class="tp-item" data-c="' + esc(c.contato) + '"><span class="tp-item-nome' + (c.nao_lidas ? ' tp-forte' : '') + '">' + esc(nomeDe(c.contato)) + '</span><small>' + esc(String(c.ultima.texto || '').slice(0, 60)) + '</small><span class="tp-item-hora">' + esc(dia(c.ultima.created_at)) + '</span>' + (c.nao_lidas ? '<b class="tp-badge tp-badge--lista">' + c.nao_lidas + '</b>' : '') + '</button></li>';
      }).join('');
      l.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { ir('conversa', b.dataset.c); }; });
    }).catch(function (e) { alertar(e.message); });
  }
  function conversa(contato) {
    S.conversa = contato;
    var novo = !contato;
    S.tela_el.innerHTML = topo(novo ? t('novaMsg') : nomeDe(contato), !novo ? '<button type="button" class="tp-mais" id="tp-cv-lig" aria-label="' + t('ligar') + '">' + svg('telefone') + '</button>' : '') +
      (novo ? '<div class="tp-para"><label for="tp-para">' + t('para') + '</label><input id="tp-para" inputmode="tel" list="tp-para-l" autocomplete="off"><datalist id="tp-para-l">' + S.contatos.map(function (c) { return '<option value="' + esc(fone(c.telefone)) + '">' + esc(c.nome) + '</option>'; }).join('') + '</datalist></div>' : '') +
      '<div class="tp-bolhas" id="tp-bl"></div><p class="tp-aviso" id="tp-cv-av" hidden></p><form class="tp-compor" id="tp-cp"><label class="sr-only" for="tp-txt">' + t('escreva') + '</label><textarea id="tp-txt" rows="1" maxlength="1600" placeholder="' + t('escreva') + '"></textarea><button type="submit" class="tp-enviar" aria-label="' + t('enviar') + '">↑</button></form>';
    ligarVoltar();
    var bl = S.tela_el.querySelector('#tp-bl');
    var desenhar = function (ms, cons) {
      bl.innerHTML = ms.map(function (m) {
        var st = m.direcao === 'saida' ? '<small class="tp-st">' + esc({ entregue: t('entregue'), falhou: t('falhou'), na_fila: t('naFila'), enviada: t('entregue') }[m.status] || '') + '</small>' : '';
        return '<div class="tp-bolha tp-bolha--' + (m.direcao === 'saida' ? 'eu' : 'ele') + '"><p>' + esc(m.texto) + '</p><time>' + esc(hora(m.created_at)) + '</time>' + st + '</div>';
      }).join('');
      bl.scrollTop = bl.scrollHeight;
      var av = S.tela_el.querySelector('#tp-cv-av'); if (cons && cons.estado === 'opt_out') { av.hidden = false; av.textContent = t('optout'); }
    };
    if (!novo) {
      S.tela_el.querySelector('#tp-cv-lig').onclick = function () { discar(contato); };
      api({ acao: 'p_conversa', contato: contato }).then(function (r) { if (S && S.conversa === contato) desenhar(r.mensagens || [], r.consentimento); }).catch(function (e) { alertar(e.message); });
    }
    var f = S.tela_el.querySelector('#tp-cp'), ta = f.querySelector('#tp-txt');
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    f.onsubmit = function (e) {
      e.preventDefault();
      var para = novo ? e164(S.tela_el.querySelector('#tp-para').value) : contato, texto = ta.value.trim();
      if (!para || !texto) return;
      ta.disabled = true;
      api({ acao: 'p_enviar_sms', para: para, texto: texto }).then(function () { ta.value = ''; ta.disabled = false; if (novo) { S.pilha = [['mensagens']]; ir('conversa', para, true); } else conversa(para); })
        .catch(function (x) { ta.disabled = false; var av = S.tela_el.querySelector('#tp-cv-av'); av.hidden = false; av.textContent = x.message; });
    };
    (novo ? S.tela_el.querySelector('#tp-para') : ta).focus();
  }

  /* voicemail */
  function voicemail() {
    S.tela_el.innerHTML = topo(t('voicemail')) + '<ul class="tp-lista" id="tp-vl"><li class="tp-vazio">…</li></ul>';
    ligarVoltar();
    api({ acao: 'p_voicemails' }).then(function (r) {
      var l = S && S.tela_el.querySelector('#tp-vl'); if (!l) return;
      var vs = r.voicemails || [];
      l.innerHTML = !vs.length ? '<li class="tp-vazio">' + t('nada') + '</li>' : vs.map(function (v) {
        return '<li class="tp-vm' + (v.ouvido ? '' : ' tp-vm--novo') + '"><div class="tp-item"><span class="tp-item-nome">' + esc(nomeDe(v.de)) + '</span><small>' + esc(dia(v.created_at)) + ' · ' + Math.floor(v.duracao_s / 60) + ':' + String(v.duracao_s % 60).padStart(2, '0') + (v.demo ? ' · ' + t('demo') : '') + '</small>' +
          (v.audio_path ? '' : '') + (v.transcricao ? '<p class="tp-transc"><strong>' + t('transcricao') + ':</strong> ' + esc(v.transcricao) + '</p>' : '') + '<div class="tp-vm-bts"><button type="button" class="tp-mini tp-verde" data-lg="' + esc(v.de) + '" aria-label="' + t('ligar') + '">' + svg('telefone') + '</button>' +
          (v.ouvido ? '' : '<button type="button" class="tp-link" data-ouv="' + v.id + '">' + t('ouvido') + '</button>') + '</div></div></li>';
      }).join('');
      l.querySelectorAll('[data-lg]').forEach(function (b) { b.onclick = function () { discar(b.dataset.lg); }; });
      l.querySelectorAll('[data-ouv]').forEach(function (b) { b.onclick = function () { api({ acao: 'p_vm_ouvido', id: b.dataset.ouv }).then(function () { novidades(); voicemail(); }); }; });
    }).catch(function (e) { alertar(e.message); });
  }

  /* WhatsApp: por enquanto abre o WhatsApp Web numa janela ao lado (ele não pode ser mostrado dentro de outro site) */
  function whatsapp() {
    S.tela_el.innerHTML = topo(t('whatsapp')) + '<div class="tp-wa"><span class="tp-ico tp-ico--grande tp-app--whatsapp">' + svg('whatsapp') + '</span><p>' + t('waTexto') + '</p><button type="button" class="tp-bt" id="tp-wa-ab">' + t('waAbrir') + '</button></div>';
    ligarVoltar();
    S.tela_el.querySelector('#tp-wa-ab').onclick = function () { window.open('https://web.whatsapp.com/', 'endeavor-whatsapp', 'noopener,width=1100,height=800'); };
  }

  function alertar(m) {
    if (!S) return;
    var a = document.createElement('p'); a.className = 'tp-toast'; a.setAttribute('role', 'alert'); a.textContent = m;
    S.el.querySelector('.tp-aparelho').appendChild(a); setTimeout(function () { a.remove(); }, 4500);
  }

  window.ETelPhone = { abrir: abrir, fechar: function () { fechar(); }, minimizar: minimizar, aberto: function () { return !!S; }, T: T, fone: fone, e164: e164 };
})();
