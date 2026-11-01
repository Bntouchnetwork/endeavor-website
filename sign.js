/* Signer page: review, ESIGN consent, identity confirmation and signature. */
(function () {
  'use strict';
  var DICT = {
    en: { invalid_link: 'This signing link is not valid. Please check the link in your email or contact support@endeavorbiz.com.',
      voided: 'This document was withdrawn by Endeavor and can no longer be signed. Contact support@endeavorbiz.com if you have questions.',
      expired: 'This signing link has expired. Contact support@endeavorbiz.com to receive a new one.',
      already_signed: 'This document has already been signed.', consent_required: 'Please check both consent boxes before signing.',
      name_required: 'Type your full legal name.', email_mismatch: 'This email does not match the address the document was sent to.',
      signature_required: 'Please draw or type your signature.', document_integrity_failed: 'We could not verify the document. Please contact support@endeavorbiz.com before signing.',
      generic: 'Something went wrong. Please try again in a moment or contact support@endeavorbiz.com.', signing: 'Signing…', signBtn: 'Sign document',
      needConsent: 'Check the consent box in step 2.', needAgree: 'Check the box to adopt your signature.', needEmail: 'Enter the email where you received this link.',
      alreadyTitle: 'This document is already signed', signedOn: 'Signed on', download: 'Download signed PDF' },
    pt: { docTitle: 'Revisar e assinar | Endeavor Business Solutions', skip: 'Pular para o conteúdo', loading: 'Carregando seu documento…',
      sentTo: 'Preparado para', sentBy: 'enviado pela Endeavor Business Solutions', step1: '1. Revise o documento', docFrame: 'Documento',
      openPdf: 'Abrir o PDF em nova aba', fingerprint: 'Impressão digital do documento (SHA-256):',
      step2: '2. Consentimento para registros e assinaturas eletrônicas', discTitle: 'Aviso sobre registros e assinatura eletrônica',
      discBody: '<p>A Endeavor Tax Solutions LLC, que atua como Endeavor Business Solutions ("Endeavor"), pede que você receba e assine este documento eletronicamente. Pela lei federal dos EUA (Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 e seguintes) e pela lei da Flórida (Uniform Electronic Transaction Act, Fla. Stat. § 668.50), a assinatura eletrônica tem o mesmo efeito legal da assinatura à mão quando as partes concordam em contratar eletronicamente.</p><h3>Cópia em papel e retirada do consentimento</h3><p>Você pode pedir uma cópia em papel deste documento, ou retirar seu consentimento para registros eletrônicos, a qualquer momento e sem custo, escrevendo para support@endeavorbiz.com ou ligando para +1 (407) 436-9567. A retirada não afeta a validade de documentos já assinados. Se preferir não assinar eletronicamente, não continue e fale conosco para assinar em papel.</p><h3>Abrangência</h3><p>Este consentimento vale apenas para o documento desta página e seus avisos relacionados.</p><h3>Requisitos técnicos</h3><p>Você precisa de um navegador atualizado, conexão com a internet, um e-mail válido e um programa que abra arquivos PDF. Você pode baixar e guardar uma cópia do documento assinado. Se esses requisitos mudarem de forma que afete seu acesso, avisaremos você.</p><h3>Registros e trilha de auditoria</h3><p>Para proteger você e a Endeavor, registramos a data e a hora em que você abre e assina o documento, seu endereço IP, os dados do navegador, o nome digitado e a assinatura adotada. O PDF final inclui um certificado com essas informações e a impressão digital do documento original.</p><h3>Atualização de contato</h3><p>Escreva para support@endeavorbiz.com para atualizar o e-mail onde recebe documentos.</p><p><em>Esta tradução é informativa. O documento a ser assinado prevalece conforme o seu próprio texto.</em></p>',
      consentLabel: 'Li o aviso acima, consigo acessar e guardar registros eletrônicos e concordo em usar registros e assinaturas eletrônicas para este documento.',
      step3: '3. Confirme sua identidade e assine', emailLabel: 'Seu e-mail', emailHint: 'O e-mail em que você recebeu este link.', nameLabel: 'Nome completo (como no documento oficial)',
      sigMode: 'Assinatura', draw: 'Desenhar', type: 'Digitar', sigArea: 'Área de assinatura', sigHint: 'Assine aqui com o mouse, o dedo ou uma caneta', clear: 'Limpar',
      typeNote: 'Usa só o teclado? Escolha "Digitar" para adotar seu nome digitado como assinatura.',
      agreeLabel: 'Ao selecionar "Assinar documento", adoto a assinatura acima como minha assinatura eletrônica, confirmo que sou a pessoa indicada e concordo em me obrigar por este documento.',
      signBtn: 'Assinar documento', doneTitle: 'Documento assinado', doneText: 'Obrigado. Sua cópia assinada, com o certificado de conclusão, está pronta. Baixe e guarde para os seus registros. A Endeavor já foi notificada.',
      signedFp: 'Impressão digital do documento assinado (SHA-256):', download: 'Baixar PDF assinado',
      invalid_link: 'Este link de assinatura não é válido. Confira o link no seu e-mail ou fale com support@endeavorbiz.com.',
      voided: 'Este documento foi retirado pela Endeavor e não pode mais ser assinado. Em caso de dúvida, escreva para support@endeavorbiz.com.',
      expired: 'Este link de assinatura expirou. Escreva para support@endeavorbiz.com para receber um novo.',
      already_signed: 'Este documento já foi assinado.', consent_required: 'Marque as duas caixas de consentimento antes de assinar.',
      name_required: 'Digite seu nome completo.', email_mismatch: 'Este e-mail não corresponde ao endereço para o qual o documento foi enviado.',
      signature_required: 'Desenhe ou digite sua assinatura.', document_integrity_failed: 'Não conseguimos verificar o documento. Fale com support@endeavorbiz.com antes de assinar.',
      generic: 'Algo deu errado. Tente de novo em instantes ou fale com support@endeavorbiz.com.', signing: 'Assinando…',
      needConsent: 'Marque a caixa de consentimento da etapa 2.', needAgree: 'Marque a caixa para adotar sua assinatura.', needEmail: 'Informe o e-mail em que recebeu este link.',
      alreadyTitle: 'Este documento já está assinado', signedOn: 'Assinado em' },
    es: { docTitle: 'Revisar y firmar | Endeavor Business Solutions', skip: 'Saltar al contenido', loading: 'Cargando su documento…',
      sentTo: 'Preparado para', sentBy: 'enviado por Endeavor Business Solutions', step1: '1. Revise el documento', docFrame: 'Documento',
      openPdf: 'Abrir el PDF en una pestaña nueva', fingerprint: 'Huella digital del documento (SHA-256):',
      step2: '2. Consentimiento para registros y firmas electrónicas', discTitle: 'Aviso sobre registros y firma electrónica',
      discBody: '<p>Endeavor Tax Solutions LLC, que opera como Endeavor Business Solutions ("Endeavor"), le pide recibir y firmar este documento electrónicamente. Según la ley federal de EE. UU. (Electronic Signatures in Global and National Commerce Act, 15 U.S.C. § 7001 y siguientes) y la ley de Florida (Uniform Electronic Transaction Act, Fla. Stat. § 668.50), la firma electrónica tiene el mismo efecto legal que la firma manuscrita cuando las partes acuerdan contratar electrónicamente.</p><h3>Copia en papel y retiro del consentimiento</h3><p>Puede pedir una copia en papel de este documento, o retirar su consentimiento a los registros electrónicos, en cualquier momento y sin costo, escribiendo a support@endeavorbiz.com o llamando al +1 (407) 436-9567. El retiro no afecta la validez de documentos ya firmados. Si prefiere no firmar electrónicamente, no continúe y contáctenos para firmar en papel.</p><h3>Alcance</h3><p>Este consentimiento aplica solo al documento de esta página y sus avisos relacionados.</p><h3>Requisitos técnicos</h3><p>Necesita un navegador actualizado, conexión a internet, un correo válido y un programa que abra archivos PDF. Puede descargar y conservar una copia del documento firmado. Si estos requisitos cambian de forma que afecte su acceso, le avisaremos.</p><h3>Registros y pista de auditoría</h3><p>Para protegerlo a usted y a Endeavor, registramos la fecha y hora en que abre y firma el documento, su dirección IP, los datos del navegador, el nombre escrito y la firma adoptada. El PDF final incluye un certificado con esta información y la huella digital del documento original.</p><h3>Actualización de contacto</h3><p>Escriba a support@endeavorbiz.com para actualizar el correo donde recibe documentos.</p><p><em>Esta traducción es informativa. El documento a firmar prevalece según su propio texto.</em></p>',
      consentLabel: 'Leí el aviso anterior, puedo acceder y conservar registros electrónicos y acepto usar registros y firmas electrónicas para este documento.',
      step3: '3. Confirme su identidad y firme', emailLabel: 'Su correo electrónico', emailHint: 'El correo donde recibió este enlace.', nameLabel: 'Nombre legal completo',
      sigMode: 'Firma', draw: 'Dibujar', type: 'Escribir', sigArea: 'Área de firma', sigHint: 'Firme aquí con el mouse, el dedo o un lápiz', clear: 'Borrar',
      typeNote: '¿Usa solo el teclado? Elija "Escribir" para adoptar su nombre escrito como firma.',
      agreeLabel: 'Al seleccionar "Firmar documento", adopto la firma anterior como mi firma electrónica, confirmo que soy la persona indicada y acepto obligarme por este documento.',
      signBtn: 'Firmar documento', doneTitle: 'Documento firmado', doneText: 'Gracias. Su copia firmada, con el certificado de finalización, está lista. Descárguela y consérvela para sus registros. Endeavor ya fue notificada.',
      signedFp: 'Huella digital del documento firmado (SHA-256):', download: 'Descargar PDF firmado',
      invalid_link: 'Este enlace de firma no es válido. Revise el enlace en su correo o escriba a support@endeavorbiz.com.',
      voided: 'Endeavor retiró este documento y ya no se puede firmar. Si tiene dudas, escriba a support@endeavorbiz.com.',
      expired: 'Este enlace de firma venció. Escriba a support@endeavorbiz.com para recibir uno nuevo.',
      already_signed: 'Este documento ya fue firmado.', consent_required: 'Marque las dos casillas de consentimiento antes de firmar.',
      name_required: 'Escriba su nombre completo.', email_mismatch: 'Este correo no coincide con la dirección a la que se envió el documento.',
      signature_required: 'Dibuje o escriba su firma.', document_integrity_failed: 'No pudimos verificar el documento. Escriba a support@endeavorbiz.com antes de firmar.',
      generic: 'Algo salió mal. Intente de nuevo en un momento o escriba a support@endeavorbiz.com.', signing: 'Firmando…',
      needConsent: 'Marque la casilla de consentimiento del paso 2.', needAgree: 'Marque la casilla para adoptar su firma.', needEmail: 'Ingrese el correo donde recibió este enlace.',
      alreadyTitle: 'Este documento ya está firmado', signedOn: 'Firmado el' }
  };
  var t = EP.init(DICT);
  var $ = function (id) { return document.getElementById(id); };
  var token = new URLSearchParams(location.search).get('t') || '';
  var doc = null;

  function showState(html) { $('state').hidden = false; $('state').innerHTML = html; $('flow').hidden = true; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function errKey(e) { var c = String((e && (e.code || e.message)) || ''); return DICT.en[c] ? c : 'generic'; }

  async function freshDownload() {
    try { var r = await EP.fn('esign', { action: 'download', token: token }); window.open(r.signed_url, '_blank', 'noopener'); }
    catch (e) { alert(t(errKey(e))); }
  }

  async function load() {
    if (!/^[0-9a-f-]{36}$/i.test(token)) return showState('<div class="portal-alert portal-alert--error">' + esc(t('invalid_link')) + '</div>');
    try {
      doc = await EP.fn('esign', { action: 'get', token: token });
    } catch (e) { return showState('<div class="portal-alert portal-alert--error">' + esc(t(errKey(e))) + '</div>'); }
    if (doc.status === 'signed') {
      showState('<h1 class="portal-h1">' + esc(t('alreadyTitle')) + '</h1><p><strong>' + esc(doc.title) + '</strong> · ' + esc(t('signedOn')) + ' ' +
        esc(new Intl.DateTimeFormat(EP.locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(doc.signed_at))) + '</p>' +
        '<button class="btn btn--navy" type="button" id="dl-again">' + esc(t('download')) + '</button>');
      $('dl-again').onclick = freshDownload;
      return;
    }
    $('state').hidden = true; $('flow').hidden = false;
    $('doc-title').textContent = doc.title;
    $('doc-signer').textContent = doc.signer_name;
    if (doc.message) { $('doc-msg').hidden = false; $('doc-msg').textContent = doc.message; }
    $('doc-frame').src = doc.document_url + '#view=FitH';
    $('doc-open').href = doc.document_url;
    $('doc-hash').textContent = doc.document_sha256;
    $('s-name').value = doc.signer_name || '';
    setupPad();
  }

  /* ---------- signature pad ---------- */
  var canvas, ctx, drawn = false, mode = 'draw';
  function setupPad() {
    canvas = $('sig-canvas'); ctx = canvas.getContext('2d');
    var lastW = 0;
    function size() {
      var r = canvas.getBoundingClientRect(), dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      if (Math.round(r.width) === lastW) return; // height-only changes (mobile toolbars) keep the signature
      lastW = Math.round(r.width);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f3a';
      clearPad(); if (mode === 'type') renderTyped();
    }
    var last = null;
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointerdown', function (e) { if (mode !== 'draw') return; canvas.setPointerCapture(e.pointerId); last = pt(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#0b1f3a'; ctx.fill(); mark(); });
    canvas.addEventListener('pointermove', function (e) { if (!last) return; var p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { last = null; }); });
    $('sig-clear').onclick = function () { clearPad(); if (mode === 'type') renderTyped(); };
    document.querySelectorAll('input[name=sm]').forEach(function (r) { r.onchange = function () { mode = r.value; clearPad(); if (mode === 'type') renderTyped(); }; });
    $('s-name').addEventListener('input', function () { if (mode === 'type') renderTyped(); });
    window.addEventListener('resize', size);
    size();
  }
  function mark() { drawn = true; $('sig-hint').hidden = true; }
  function clearPad() { var r = canvas.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); drawn = false; $('sig-hint').hidden = false; }
  function renderTyped() {
    var r = canvas.getBoundingClientRect(), name = $('s-name').value.trim();
    ctx.clearRect(0, 0, r.width, r.height); drawn = false; $('sig-hint').hidden = !!name;
    if (!name) return;
    var px = Math.min(56, r.height * 0.42);
    ctx.font = '600 ' + px + 'px Caveat, "Segoe Script", "Brush Script MT", cursive';
    while (ctx.measureText(name).width > r.width - 48 && px > 18) { px -= 2; ctx.font = '600 ' + px + 'px Caveat, "Segoe Script", "Brush Script MT", cursive'; }
    ctx.fillStyle = '#0b1f3a'; ctx.textBaseline = 'alphabetic'; ctx.fillText(name, 24, r.height - 48);
    drawn = true;
  }
  if (document.fonts && document.fonts.load) document.fonts.load('600 40px Caveat').then(function () { if (mode === 'type' && canvas) renderTyped(); }).catch(function () {});

  $('sign-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var m = $('s-msg'), btn = $('s-submit');
    var fail = function (k, focusEl) { m.className = 'portal-alert portal-alert--error'; m.textContent = t(k); if (focusEl) focusEl.focus(); };
    if (!$('c-consent').checked) return fail('needConsent', $('c-consent'));
    var email = $('s-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('needEmail', $('s-email'));
    var name = $('s-name').value.trim();
    if (name.length < 2) return fail('name_required', $('s-name'));
    if (mode === 'type') renderTyped();
    if (!drawn) return fail('signature_required', mode === 'draw' ? canvas : $('s-name'));
    if (!$('c-agree').checked) return fail('needAgree', $('c-agree'));
    btn.disabled = true; btn.textContent = t('signing'); m.className = 'portal-alert'; m.textContent = '';
    try {
      var res = await EP.fn('esign', { action: 'sign', token: token, typed_name: name, email: email, signature_png: canvas.toDataURL('image/png'), consent: true, agree: true });
      EP.notify({ _subject: 'Document signed: ' + doc.title + ' (' + name + ')', document: doc.title, signer: name, signer_email: email,
        signed_at_utc: res.signed_at, signed_sha256: res.signed_sha256, note: 'Open the admin console (Assinaturas) to download the signed PDF and audit trail.' });
      $('flow').hidden = true; $('done').hidden = false;
      $('done-hash').textContent = res.signed_sha256;
      $('done-dl').href = res.signed_url;
      $('done-dl').onclick = function (ev) { ev.preventDefault(); freshDownload(); };
      $('done').focus();
    } catch (err) {
      var k = errKey(err);
      fail(k); btn.disabled = false; btn.textContent = t('signBtn');
      if (k === 'already_signed') load();
    }
  });

  load();
})();
