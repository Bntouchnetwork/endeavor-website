/* Signer page: consent, guided field-by-field signing on the document, finish. */
(function () {
  'use strict';
  var DICT = {
    en: { invalid_link: 'This signing link is not valid. Please check the link in your email or contact support@endeavorbiz.com.',
      voided: 'This document was withdrawn by Endeavor and can no longer be signed. Contact support@endeavorbiz.com if you have questions.',
      expired: 'This signing link has expired. Contact support@endeavorbiz.com to receive a new one.',
      already_signed: 'This document has already been signed.', consent_required: 'Please check both consent boxes before signing.',
      name_required: 'Type your full legal name.', email_mismatch: 'This email does not match the address the document was sent to.',
      signature_required: 'Please sign every signature field.', initials_required: 'Please initial every initials field.', fields_required: 'Please complete every required field.',
      document_integrity_failed: 'We could not verify the document. Please contact support@endeavorbiz.com before signing.',
      generic: 'Something went wrong. Please try again in a moment or contact support@endeavorbiz.com.', signing: 'Signing…', signBtn: 'Sign document',
      needConsent: 'Check the consent box to continue.', needEmail: 'Enter the email where you received this link.',
      backPortal: 'Back to the client portal', alreadyTitle: 'This document is already signed', signedOn: 'Signed on', download: 'Download signed PDF',
      progress: '{d} of {n} required fields completed', allDone: 'All required fields are complete. Select Finish.', noFields: 'Review the document, then select Finish.',
      signHere: 'Sign', initialHere: 'Initial', fieldSig: 'Signature field', fieldIni: 'Initials field', fieldText: 'Text field', fieldCheck: 'Checkbox', page: 'page', required: 'required',
      adoptTitle: 'Adopt your signature', adoptIniTitle: 'Adopt your initials', adText: 'Text', drawFirst: 'Draw your signature or choose Type.', typeFirst: 'Type the text for your signature.',
      needAgree: 'Check the box to adopt your signature.', needLegacy: 'Adopt your signature first.', pageLabel: 'Page' },
    pt: { docTitle: 'Revisar e assinar | Endeavor Business Solutions', skip: 'Pular para o conteúdo', loading: 'Carregando seu documento…',
      sentTo: 'Preparado para', sentBy: 'enviado pela Endeavor Business Solutions', step1: '1. Antes de começar',
      discTitle: 'Aviso sobre registros e assinatura eletrônica', discBody: '<p>A Endeavor Tax Solutions LLC, que atua como Endeavor Business Solutions ("Endeavor"), pede que você receba e assine este documento eletronicamente. Pela lei federal dos EUA (Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 e seguintes) e pela lei da Flórida (Uniform Electronic Transaction Act, Fla. Stat. § 668.50), a assinatura eletrônica tem o mesmo efeito legal da assinatura à mão quando as partes concordam em contratar eletronicamente.</p><h3>Cópia em papel e retirada do consentimento</h3><p>Você pode pedir uma cópia em papel deste documento, ou retirar seu consentimento para registros eletrônicos, a qualquer momento e sem custo, escrevendo para support@endeavorbiz.com ou ligando para +1 (407) 436-9567. A retirada não afeta a validade de documentos já assinados. Se preferir não assinar eletronicamente, não continue e fale conosco para assinar em papel.</p><h3>Abrangência</h3><p>Este consentimento vale apenas para o documento desta página e seus avisos relacionados.</p><h3>Requisitos técnicos</h3><p>Você precisa de um navegador atualizado, conexão com a internet, um e-mail válido e um programa que abra arquivos PDF. Você pode baixar e guardar uma cópia do documento assinado. Se esses requisitos mudarem de forma que afete seu acesso, avisaremos você.</p><h3>Registros e trilha de auditoria</h3><p>Para proteger você e a Endeavor, registramos a data e a hora em que você abre e assina o documento, seu endereço IP, os dados do navegador, o nome digitado e a assinatura adotada. O PDF final inclui um certificado com essas informações e a impressão digital do documento original.</p><h3>Atualização de contato</h3><p>Escreva para support@endeavorbiz.com para atualizar o e-mail onde recebe documentos.</p><p><em>Esta tradução é informativa. O documento a ser assinado prevalece conforme o seu próprio texto.</em></p>',
      consentLabel: 'Li o aviso acima, consigo acessar e guardar registros eletrônicos e concordo em usar registros e assinaturas eletrônicas para este documento.',
      emailLabel: 'Seu e-mail', emailHint: 'O e-mail em que você recebeu este link.', nameLabel: 'Nome completo (como no documento oficial)', continue: 'Continuar para o documento',
      step2: '2. Preencha e assine os campos', next: 'Próximo campo', finish: 'Concluir', fingerprint: 'Impressão digital do documento (SHA-256):',
      step3: '3. Concluir', legacyHint: 'Adote sua assinatura. Ela será colocada na última página do documento.', adoptSig: 'Adotar assinatura',
      agreeLabel: 'Ao selecionar "Assinar documento", adoto a assinatura acima como minha assinatura eletrônica, confirmo que sou a pessoa indicada e concordo em me obrigar por este documento.',
      signBtn: 'Assinar documento', doneTitle: 'Documento assinado', doneText: 'Obrigado. Sua cópia assinada, com o certificado de conclusão, está pronta. Baixe e guarde para os seus registros. A Endeavor já foi notificada.',
      signedFp: 'Impressão digital do documento assinado (SHA-256):', download: 'Baixar PDF assinado',
      adoptTitle: 'Adote sua assinatura', adoptIniTitle: 'Adote sua rubrica', draw: 'Desenhar', type: 'Digitar', adText: 'Texto', sigArea: 'Área de assinatura',
      sigHint: 'Assine aqui com o mouse, o dedo ou uma caneta', clear: 'Limpar', cancel: 'Cancelar', adoptOk: 'Adotar e assinar',
      invalid_link: 'Este link de assinatura não é válido. Confira o link no seu e-mail ou fale com support@endeavorbiz.com.',
      voided: 'Este documento foi retirado pela Endeavor e não pode mais ser assinado. Em caso de dúvida, escreva para support@endeavorbiz.com.',
      expired: 'Este link de assinatura expirou. Escreva para support@endeavorbiz.com para receber um novo.',
      already_signed: 'Este documento já foi assinado.', consent_required: 'Marque as duas caixas de consentimento antes de assinar.',
      name_required: 'Digite seu nome completo.', email_mismatch: 'Este e-mail não corresponde ao endereço para o qual o documento foi enviado.',
      signature_required: 'Assine todos os campos de assinatura.', initials_required: 'Rubrique todos os campos de rubrica.', fields_required: 'Preencha todos os campos obrigatórios.',
      document_integrity_failed: 'Não conseguimos verificar o documento. Fale com support@endeavorbiz.com antes de assinar.',
      generic: 'Algo deu errado. Tente de novo em instantes ou fale com support@endeavorbiz.com.', signing: 'Assinando…',
      needConsent: 'Marque a caixa de consentimento para continuar.', needEmail: 'Informe o e-mail em que recebeu este link.',
      backPortal: 'Voltar ao portal do cliente', alreadyTitle: 'Este documento já está assinado', signedOn: 'Assinado em',
      progress: '{d} de {n} campos obrigatórios concluídos', allDone: 'Todos os campos obrigatórios estão prontos. Selecione Concluir.', noFields: 'Revise o documento e selecione Concluir.',
      signHere: 'Assinar', initialHere: 'Rubricar', fieldSig: 'Campo de assinatura', fieldIni: 'Campo de rubrica', fieldText: 'Campo de texto', fieldCheck: 'Caixa de seleção', page: 'página', required: 'obrigatório',
      drawFirst: 'Desenhe sua assinatura ou escolha Digitar.', typeFirst: 'Digite o texto da assinatura.', needAgree: 'Marque a caixa para adotar sua assinatura.', needLegacy: 'Adote sua assinatura primeiro.', pageLabel: 'Página' },
    es: { docTitle: 'Revisar y firmar | Endeavor Business Solutions', skip: 'Saltar al contenido', loading: 'Cargando su documento…',
      sentTo: 'Preparado para', sentBy: 'enviado por Endeavor Business Solutions', step1: '1. Antes de comenzar',
      discTitle: 'Aviso sobre registros y firma electrónica', discBody: '<p>Endeavor Tax Solutions LLC, que opera como Endeavor Business Solutions ("Endeavor"), le pide recibir y firmar este documento electrónicamente. Según la ley federal de EE. UU. (Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 y siguientes) y la ley de Florida (Uniform Electronic Transaction Act, Fla. Stat. § 668.50), la firma electrónica tiene el mismo efecto legal que la firma manuscrita cuando las partes acuerdan contratar electrónicamente.</p><h3>Copia en papel y retiro del consentimiento</h3><p>Puede pedir una copia en papel de este documento, o retirar su consentimiento a los registros electrónicos, en cualquier momento y sin costo, escribiendo a support@endeavorbiz.com o llamando al +1 (407) 436-9567. El retiro no afecta la validez de documentos ya firmados. Si prefiere no firmar electrónicamente, no continúe y contáctenos para firmar en papel.</p><h3>Alcance</h3><p>Este consentimiento aplica solo al documento de esta página y sus avisos relacionados.</p><h3>Requisitos técnicos</h3><p>Necesita un navegador actualizado, conexión a internet, un correo válido y un programa que abra archivos PDF. Puede descargar y conservar una copia del documento firmado. Si estos requisitos cambian de forma que afecte su acceso, le avisaremos.</p><h3>Registros y pista de auditoría</h3><p>Para protegerlo a usted y a Endeavor, registramos la fecha y hora en que abre y firma el documento, su dirección IP, los datos del navegador, el nombre escrito y la firma adoptada. El PDF final incluye un certificado con esta información y la huella digital del documento original.</p><h3>Actualización de contacto</h3><p>Escriba a support@endeavorbiz.com para actualizar el correo donde recibe documentos.</p><p><em>Esta traducción es informativa. El documento a firmar prevalece según su propio texto.</em></p>',
      consentLabel: 'Leí el aviso anterior, puedo acceder y conservar registros electrónicos y acepto usar registros y firmas electrónicas para este documento.',
      emailLabel: 'Su correo electrónico', emailHint: 'El correo donde recibió este enlace.', nameLabel: 'Nombre legal completo', continue: 'Continuar al documento',
      step2: '2. Complete y firme los campos', next: 'Siguiente campo', finish: 'Finalizar', fingerprint: 'Huella digital del documento (SHA-256):',
      step3: '3. Finalizar', legacyHint: 'Adopte su firma. Se colocará en la última página del documento.', adoptSig: 'Adoptar firma',
      agreeLabel: 'Al seleccionar "Firmar documento", adopto la firma anterior como mi firma electrónica, confirmo que soy la persona indicada y acepto obligarme por este documento.',
      signBtn: 'Firmar documento', doneTitle: 'Documento firmado', doneText: 'Gracias. Su copia firmada, con el certificado de finalización, está lista. Descárguela y consérvela para sus registros. Endeavor ya fue notificada.',
      signedFp: 'Huella digital del documento firmado (SHA-256):', download: 'Descargar PDF firmado',
      adoptTitle: 'Adopte su firma', adoptIniTitle: 'Adopte sus iniciales', draw: 'Dibujar', type: 'Escribir', adText: 'Texto', sigArea: 'Área de firma',
      sigHint: 'Firme aquí con el mouse, el dedo o un lápiz', clear: 'Borrar', cancel: 'Cancelar', adoptOk: 'Adoptar y firmar',
      invalid_link: 'Este enlace de firma no es válido. Revise el enlace en su correo o escriba a support@endeavorbiz.com.',
      voided: 'Endeavor retiró este documento y ya no se puede firmar. Si tiene dudas, escriba a support@endeavorbiz.com.',
      expired: 'Este enlace de firma venció. Escriba a support@endeavorbiz.com para recibir uno nuevo.',
      already_signed: 'Este documento ya fue firmado.', consent_required: 'Marque las dos casillas de consentimiento antes de firmar.',
      name_required: 'Escriba su nombre completo.', email_mismatch: 'Este correo no coincide con la dirección a la que se envió el documento.',
      signature_required: 'Firme todos los campos de firma.', initials_required: 'Ponga sus iniciales en todos los campos de iniciales.', fields_required: 'Complete todos los campos obligatorios.',
      document_integrity_failed: 'No pudimos verificar el documento. Escriba a support@endeavorbiz.com antes de firmar.',
      generic: 'Algo salió mal. Intente de nuevo en un momento o escriba a support@endeavorbiz.com.', signing: 'Firmando…',
      needConsent: 'Marque la casilla de consentimiento para continuar.', needEmail: 'Ingrese el correo donde recibió este enlace.',
      backPortal: 'Volver al portal del cliente', alreadyTitle: 'Este documento ya está firmado', signedOn: 'Firmado el',
      progress: '{d} de {n} campos obligatorios completos', allDone: 'Todos los campos obligatorios están listos. Seleccione Finalizar.', noFields: 'Revise el documento y seleccione Finalizar.',
      signHere: 'Firmar', initialHere: 'Iniciales', fieldSig: 'Campo de firma', fieldIni: 'Campo de iniciales', fieldText: 'Campo de texto', fieldCheck: 'Casilla', page: 'página', required: 'obligatorio',
      drawFirst: 'Dibuje su firma o elija Escribir.', typeFirst: 'Escriba el texto de su firma.', needAgree: 'Marque la casilla para adoptar su firma.', needLegacy: 'Adopte su firma primero.', pageLabel: 'Página' }
  };
  var t = EP.init(DICT);
  var $ = function (id) { return document.getElementById(id); };
  function qp(k) { return new URLSearchParams(location.search).get(k) || (window.DEMO_QS || {})[k] || null; }
  var token = qp('t') || '';
  var doc = null, fields = [], els = {}, values = {}, sigPng = null, iniPng = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function errKey(e) { var c = String((e && (e.code || e.message)) || ''); return DICT.en[c] ? c : 'generic'; }
  function showState(html) { $('state').hidden = false; $('state').innerHTML = html; $('flow').hidden = true; }
  function setMsg(el, k, kind) { el.className = 'portal-alert' + (k ? ' portal-alert--' + (kind || 'error') : ''); el.textContent = k ? t(k) : ''; }
  var dateText = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date());

  async function freshDownload() {
    try {
      var r = await EP.fn('esign', { action: 'download', token: token });
      var blob = await (await fetch(r.signed_url)).blob();
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (doc && doc.title ? doc.title : 'document').replace(/[\\/:*?"<>|]+/g, '-') + ' - signed.pdf';
      document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 400);
    } catch (e) { alert(t(errKey(e))); }
  }

  // Operating Agreement envelopes: tell the OA module (idempotent) so it opens the next signer or archives; offer the way back
  function oaAfterSign(box) {
    try { EP.fn('oa', { action: 'envelope_signed', token: token }).catch(function () {}); } catch (e) { /* not an OA envelope */ }
    var ret = qp('ret');
    if (ret === 'client' && box && !box.querySelector('.ret-portal')) {
      var a = document.createElement('a'); a.className = 'btn btn--ghost ret-portal'; a.textContent = t('backPortal');
      a.href = 'client.html?lang=' + encodeURIComponent(qp('lang') || EP.lang || 'en') + '#/overview';
      (box.querySelector('.portal-btn-row') || box).appendChild(a);
    }
  }
  async function load() {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return showState('<div class="portal-alert portal-alert--error">' + esc(t('invalid_link')) + '</div>');
    try { doc = await EP.fn('esign', { action: 'get', token: token }); }
    catch (e) { return showState('<div class="portal-alert portal-alert--error">' + esc(t(errKey(e))) + '</div>'); }
    if (doc.status === 'signed') {
      showState('<h1 class="portal-h1">' + esc(t('alreadyTitle')) + '</h1><p><strong>' + esc(doc.title) + '</strong> · ' + esc(t('signedOn')) + ' ' +
        esc(new Intl.DateTimeFormat(EP.locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(doc.signed_at))) + '</p>' +
        '<button class="btn btn--navy" type="button" id="dl-again">' + esc(t('download')) + '</button>');
      $('dl-again').onclick = freshDownload;
      oaAfterSign($('state'));
      return;
    }
    if (doc.first_view) EP.notify({ _subject: 'Document opened: ' + doc.title + ' (' + doc.signer_name + ')', document: doc.title, signer: doc.signer_name, event: 'The signer opened the signing link.' });
    fields = (doc.fields || []).slice().sort(function (a, b) { return a.page - b.page || a.y - b.y || a.x - b.x; });
    $('state').hidden = true; $('flow').hidden = false;
    $('doc-title').textContent = doc.title;
    $('doc-signer').textContent = doc.signer_name;
    if (doc.message) { $('doc-msg').hidden = false; $('doc-msg').textContent = doc.message; }
    $('doc-hash').textContent = doc.document_sha256;
    $('s-name').value = doc.signer_name || '';
  }

  /* ---------- step 1 ---------- */
  $('start-btn').onclick = async function () {
    var m = $('s1-msg');
    if (!$('c-consent').checked) { setMsg(m, 'needConsent'); $('c-consent').focus(); return; }
    if ($('s-name').value.trim().length < 2) { setMsg(m, 'name_required'); $('s-name').focus(); return; }
    setMsg(m, '');
    if (!$('docwrap').hidden) { $('docwrap').scrollIntoView({ behavior: 'smooth' }); return; }
    $('docwrap').hidden = false; $('sign-form').hidden = false;
    $('start-btn').textContent = t('continue');
    try {
      var pdf = await EPdf.open(doc.document_url);
      var pages = await EPdf.render(pdf, $('sdoc-pages'), { maxWidth: 860, pageLabel: t('pageLabel') });
      buildFields(pages);
    } catch (e) { $('sdoc-pages').innerHTML = '<div class="portal-alert portal-alert--error">' + esc(t('generic')) + '</div>'; console.error(e); }
    if (!fields.length) $('legacy-sig').hidden = false;
    progress();
    $('docwrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('s-name').addEventListener('input', fillAuto);

  /* ---------- fields on the document ---------- */
  function buildFields(pages) {
    fields.forEach(function (f) {
      var p = pages[f.page]; if (!p) return;
      var el;
      var aria = function (k) { return t(k) + ', ' + t('page') + ' ' + (f.page + 1) + (f.required ? ', ' + t('required') : ''); };
      if (f.type === 'signature' || f.type === 'initials') {
        el = document.createElement('button'); el.type = 'button';
        el.className = 'sfield sfield--sig';
        el.textContent = f.type === 'signature' ? t('signHere') : t('initialHere');
        el.setAttribute('aria-label', aria(f.type === 'signature' ? 'fieldSig' : 'fieldIni'));
        el.onclick = function () { applySig(f); };
      } else if (f.type === 'text') {
        el = document.createElement('input'); el.type = 'text'; el.maxLength = 500; el.className = 'sfield sfield--text';
        el.setAttribute('aria-label', aria('fieldText'));
        el.addEventListener('input', function () { values[f.id] = el.value; progress(); });
      } else if (f.type === 'checkbox') {
        el = document.createElement('span'); el.className = 'sfield sfield--check';
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.setAttribute('aria-label', aria('fieldCheck'));
        cb.addEventListener('change', function () { values[f.id] = cb.checked; progress(); });
        el.appendChild(cb);
      } else {
        el = document.createElement('div'); el.className = 'sfield sfield--auto'; el.setAttribute('aria-hidden', 'true');
      }
      el.style.left = f.x * 100 + '%'; el.style.top = f.y * 100 + '%'; el.style.width = f.w * 100 + '%'; el.style.height = f.h * 100 + '%';
      if (f.type === 'text') el.style.fontSize = Math.max(10, Math.min(16, p.el.getBoundingClientRect().height * f.h * 0.6)) + 'px';
      p.layer.appendChild(el); els[f.id] = el;
    });
    fillAuto();
  }
  function fillAuto() {
    fields.forEach(function (f) {
      var el = els[f.id]; if (!el) return;
      if (f.type === 'date') el.textContent = dateText;
      if (f.type === 'name') el.textContent = $('s-name').value.trim();
      if (f.type === 'email') el.textContent = doc.signer_email || '';
    });
  }
  function isDone(f) {
    if (f.type === 'signature' || f.type === 'initials') return !!(els[f.id] && els[f.id].classList.contains('is-done'));
    if (f.type === 'text') return !!String(values[f.id] || '').trim();
    if (f.type === 'checkbox') return values[f.id] === true;
    return true;
  }
  var countable = function (f) { return f.required && ['signature', 'initials', 'text', 'checkbox'].indexOf(f.type) > -1; };
  function progress() {
    var req = fields.filter(countable), done = req.filter(isDone).length;
    $('g-progress').textContent = !fields.length ? t('noFields') : done === req.length ? t('allDone') : t('progress').replace('{d}', done).replace('{n}', req.length);
    return done === req.length;
  }
  function focusField(f) {
    var el = els[f.id]; if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var target = el.tagName === 'SPAN' ? el.querySelector('input') : el;
    setTimeout(function () { target.focus({ preventScroll: true }); }, 350);
    el.classList.remove('is-missing'); void el.offsetWidth; el.classList.add('is-missing');
  }
  $('g-next').onclick = function () {
    var next = fields.filter(function (f) { return countable(f) && !isDone(f); })[0];
    if (next) focusField(next); else $('sign-form').scrollIntoView({ behavior: 'smooth' });
  };
  $('g-finish').onclick = function () { $('sign-form').scrollIntoView({ behavior: 'smooth' }); $('c-agree').focus({ preventScroll: true }); };

  function applySig(f) {
    var kind = f ? f.type : 'signature';
    var have = kind === 'initials' ? iniPng : sigPng;
    if (have && f && !els[f.id].classList.contains('is-done')) return markSig(f, have);
    openAdopt(kind, function (png) {
      if (kind === 'initials') iniPng = png; else sigPng = png;
      // re-apply the new image on every field of that kind already signed
      fields.forEach(function (x) { if (x.type === kind && els[x.id] && els[x.id].classList.contains('is-done')) markSig(x, png); });
      if (f) markSig(f, png);
      else { $('legacy-prev').src = png; $('legacy-prev').hidden = false; }
    });
  }
  function markSig(f, png) {
    var el = els[f.id];
    el.classList.add('is-done'); el.innerHTML = '<img alt="" src="' + png + '">';
    progress();
    var next = fields.filter(function (x) { return countable(x) && !isDone(x); })[0];
    if (next && (next.type === f.type)) setTimeout(function () { focusField(next); }, 250);
  }
  $('legacy-adopt').onclick = function () { applySig(null); };

  /* ---------- adopt dialog (signature pad) ---------- */
  var dlg = $('adopt'), canvas = $('sig-canvas'), ctx = canvas.getContext('2d'), drawn = false, mode = 'draw', adoptKind = 'signature', adoptCb = null, lastFocus = null;
  function sizeCanvas() {
    var r = canvas.getBoundingClientRect(), dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = adoptKind === 'initials' ? 2.2 : 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f3a';
  }
  function clearPad() { var r = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); drawn = false; $('sig-hint').hidden = mode !== 'draw'; }
  function initialsOf(n) { return n.trim().split(/\s+/).filter(Boolean).map(function (w) { return w[0].toUpperCase(); }).slice(0, 3).join(''); }
  function renderTyped() {
    var r = canvas.getBoundingClientRect(), text = $('ad-text').value.trim();
    ctx.clearRect(0, 0, r.width, r.height); drawn = !!text; if (!text) return;
    var px = Math.min(64, r.height * 0.55), f = function () { ctx.font = '600 ' + px + 'px Caveat, "Segoe Script", "Brush Script MT", cursive'; }; f();
    while (ctx.measureText(text).width > r.width - 40 && px > 18) { px -= 2; f(); }
    ctx.fillStyle = '#0b1f3a'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, 20, r.height * 0.68);
  }
  function setMode(m) {
    mode = m; document.querySelectorAll('input[name=am]').forEach(function (x) { x.checked = x.value === m; });
    $('ad-type-wrap').hidden = m !== 'type'; clearPad(); if (m === 'type') { renderTyped(); $('ad-text').focus(); }
  }
  function openAdopt(kind, cb) {
    adoptKind = kind; adoptCb = cb; lastFocus = document.activeElement;
    dlg.classList.toggle('adopt--initials', kind === 'initials');
    $('adopt-title').textContent = kind === 'initials' ? t('adoptIniTitle') : t('adoptTitle');
    var name = $('s-name').value.trim();
    $('ad-text').value = kind === 'initials' ? initialsOf(name) : name;
    setMsg($('ad-msg'), '');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    sizeCanvas(); setMode(mode);
  }
  function closeAdopt() { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); if (lastFocus) lastFocus.focus(); }
  document.querySelectorAll('input[name=am]').forEach(function (r) { r.onchange = function () { setMode(r.value); }; });
  $('ad-text').addEventListener('input', renderTyped);
  $('sig-clear').onclick = function () { if (mode === 'type') { $('ad-text').value = ''; renderTyped(); } else clearPad(); };
  $('ad-cancel').onclick = closeAdopt;
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeAdopt(); });
  var last = null;
  function pt(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', function (e) {
    if (mode !== 'draw') return; canvas.setPointerCapture(e.pointerId); last = pt(e);
    ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#0b1f3a'; ctx.fill(); drawn = true; $('sig-hint').hidden = true;
  });
  canvas.addEventListener('pointermove', function (e) { if (!last) return; var p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { last = null; }); });
  if (document.fonts && document.fonts.load) document.fonts.load('600 40px Caveat').then(function () { if (mode === 'type' && dlg.open) renderTyped(); }).catch(function () {});

  // Crop transparent margins so the signature fills its field.
  function trimmedPng() {
    var w = canvas.width, h = canvas.height, data = ctx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
    var c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
    c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  $('ad-ok').onclick = function () {
    if (mode === 'type') renderTyped();
    if (!drawn) { setMsg($('ad-msg'), mode === 'type' ? 'typeFirst' : 'drawFirst'); return; }
    var png = trimmedPng(); if (!png) { setMsg($('ad-msg'), 'drawFirst'); return; }
    var cb = adoptCb; closeAdopt(); if (cb) cb(png);
  };

  /* ---------- finish ---------- */
  $('sign-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var m = $('s-msg'), btn = $('s-submit');
    if (!$('c-consent').checked) { setMsg(m, 'needConsent'); $('step1').scrollIntoView({ behavior: 'smooth' }); return; }
    var email = doc.signer_email || '', name = $('s-name').value.trim();
    if (name.length < 2) { setMsg(m, 'name_required'); $('s-name').focus(); return; }
    var missing = fields.filter(function (f) { return countable(f) && !isDone(f); })[0];
    if (missing) { setMsg(m, missing.type === 'signature' ? 'signature_required' : missing.type === 'initials' ? 'initials_required' : 'fields_required'); focusField(missing); return; }
    if (!fields.length && !sigPng) { setMsg(m, 'needLegacy'); $('legacy-adopt').focus(); return; }
    if (!$('c-agree').checked) { setMsg(m, 'needAgree'); $('c-agree').focus(); return; }
    btn.disabled = true; btn.textContent = t('signing'); setMsg(m, '');
    var vals = {}; fields.forEach(function (f) { if (f.type === 'text') vals[f.id] = String(values[f.id] || ''); if (f.type === 'checkbox') vals[f.id] = values[f.id] === true; });
    try {
      var res = await EP.fn('esign', { action: 'sign', token: token, typed_name: name, signature_png: sigPng || '', initials_png: iniPng || '', values: vals, consent: true, agree: true });
      EP.notify({ _subject: 'Document signed: ' + doc.title + ' (' + name + ')', document: doc.title, signer: name, signer_email: email,
        signed_at_utc: res.signed_at, signed_sha256: res.signed_sha256, note: 'Open the admin console (Assinaturas) to view the signed PDF and audit trail.' });
      $('flow').hidden = true; $('done').hidden = false;
      $('done-hash').textContent = res.signed_sha256;
      $('done-dl').onclick = freshDownload;
      $('done').focus();
      oaAfterSign($('done'));
    } catch (err) {
      setMsg(m, errKey(err)); btn.disabled = false; btn.textContent = t('signBtn');
      if (errKey(err) === 'already_signed') load();
    }
  });

  load();
})();
