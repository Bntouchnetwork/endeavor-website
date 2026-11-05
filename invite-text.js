/* Step-by-step invitation email for the client portal (plain text, EN/PT/ES).
   Sent as the FormSubmit auto-response, with a copy to support@endeavorbiz.com. */
(function () {
  'use strict';
  var IOS = 'https://apps.apple.com/app/google-authenticator/id388497605';
  var AND = 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2';
  var HELP = 'support@endeavorbiz.com · +1 (407) 436-9567 · WhatsApp +1 (630) 689-8702';

  var T = {
    pt: function (o) {
      return [
        'Olá ' + o.name + ',',
        '',
        o.accepted ? 'Recebemos o seu aceite da proposta "' + o.accepted + '". Obrigado pela confiança!' + (o.invoiceLine ? ' ' + o.invoiceLine : '')
        : o.referral ? 'A Endeavor Business Solutions convidou você para o Programa de Parceiros. Pelo Portal do Parceiro você indica clientes, acompanha cada etapa e recebe as suas comissões pela sua conta Stripe.'
        : o.partner ? (o.invitedBy || o.clientName) + ' convidou você para o Portal do Parceiro da Endeavor Business Solutions, para acessar os documentos que compartilhou com você.'
        : o.invitedBy ? o.invitedBy + ' convidou você para o portal do cliente da Endeavor Business Solutions' + (o.clientName ? ' (' + o.clientName + ')' : '') + '.'
                    : 'A Endeavor Business Solutions criou o seu acesso ao portal do cliente' + (o.clientName ? ' (' + o.clientName + ')' : '') + '.',
        o.accepted ? 'O próximo passo é o pagamento pelo portal do cliente: ao entrar, você vai direto para a página de faturas e pode pagar com cartão, Pix ou transferência bancária. Por segurança, o acesso usa senha e um código do celular.'
        : o.referral ? 'Por segurança, o acesso usa senha e um código do celular.' : 'Lá você encontra os documentos das suas empresas, os prazos fiscais e os relatórios financeiros. Por segurança, o acesso usa senha e um código do celular.',
        '',
        'PRIMEIRO ACESSO (leva uns 5 minutos)',
        '1. Instale no celular o app gratuito "Google Authenticator". O ícone é um asterisco colorido.',
        '   iPhone: ' + IOS,
        '   Android: ' + AND,
        '2. Você vai receber um segundo e-mail, com o assunto "Crie sua senha do portal Endeavor", enviado para ' + o.email + '. Abra esse e-mail no computador e clique em "Criar minha senha".',
        '3. Crie uma senha com pelo menos 12 caracteres e clique em "Salvar senha". Vai aparecer um QR code (um quadrado de pontinhos).',
        '4. No Google Authenticator, toque no botão "+" e escolha "Ler código QR". Aponte a câmera do celular para o QR code na tela.',
        '5. O app mostra um código de 6 dígitos, que muda a cada 30 segundos. Digite esse código no portal e clique em "Ativar e continuar".',
        'Endereço do portal: ' + o.link,
        'O link de criação de senha vale por 24 horas. Se expirar, abra o portal e clique em "Esqueci a senha" para receber um novo.',
        '',
        'NOS PRÓXIMOS ACESSOS',
        'Entre com e-mail e senha. Quando o portal pedir o código, abra o Google Authenticator e digite o número que aparece em "Endeavor Business Solutions".',
        'Dica: no Google Authenticator, entre com a sua conta Google. Assim o app guarda um backup e você não perde o acesso se trocar de celular.',
        '',
        'Precisa de ajuda? ' + HELP,
        'Endeavor Business Solutions'
      ].join('\n');
    },
    en: function (o) {
      return [
        'Hello ' + o.name + ',',
        '',
        o.accepted ? 'We received your acceptance of the proposal "' + o.accepted + '". Thank you for your trust!' + (o.invoiceLine ? ' ' + o.invoiceLine : '')
        : o.referral ? 'Endeavor Business Solutions invited you to its Partner Program. In the Partner Portal you refer clients, follow every step and receive your commissions through your own Stripe account.'
        : o.partner ? (o.invitedBy || o.clientName) + ' invited you to the Endeavor Business Solutions Partner Portal to access the documents they shared with you.'
        : o.invitedBy ? o.invitedBy + ' invited you to the Endeavor Business Solutions client portal' + (o.clientName ? ' (' + o.clientName + ')' : '') + '.'
                    : 'Endeavor Business Solutions created your access to the client portal' + (o.clientName ? ' (' + o.clientName + ')' : '') + '.',
        o.accepted ? 'The next step is payment in the client portal: after you sign in you go straight to the invoices page and can pay by card, Pix or bank transfer. For security, access uses a password and a code from your phone.'
        : o.referral ? 'For security, access uses a password and a code from your phone.' : 'There you will find your company documents, tax deadlines and financial reports. For security, access uses a password and a code from your phone.',
        '',
        'FIRST ACCESS (about 5 minutes)',
        '1. Install the free "Google Authenticator" app on your phone. The icon is a colorful asterisk.',
        '   iPhone: ' + IOS,
        '   Android: ' + AND,
        '2. You will receive a second email, with the subject "Create your Endeavor portal password", sent to ' + o.email + '. Open it on your computer and click "Create my password".',
        '3. Create a password with at least 12 characters and click "Save password". A QR code (a square of dots) will appear.',
        '4. In Google Authenticator, tap the "+" button and choose "Scan a QR code". Point your phone camera at the QR code on the screen.',
        '5. The app shows a 6-digit code that changes every 30 seconds. Type that code in the portal and click "Activate and continue".',
        'Portal address: ' + o.link,
        'The password link is valid for 24 hours. If it expires, open the portal and click "Forgot password" to get a new one.',
        '',
        'NEXT TIME',
        'Sign in with your email and password. When the portal asks for the code, open Google Authenticator and type the number shown under "Endeavor Business Solutions".',
        'Tip: sign in to Google Authenticator with your Google account so it keeps a backup if you change phones.',
        '',
        'Need help? ' + HELP,
        'Endeavor Business Solutions'
      ].join('\n');
    },
    es: function (o) {
      return [
        'Hola ' + o.name + ',',
        '',
        o.accepted ? 'Recibimos su aceptación de la propuesta "' + o.accepted + '". ¡Gracias por su confianza!' + (o.invoiceLine ? ' ' + o.invoiceLine : '')
        : o.referral ? 'Endeavor Business Solutions lo invitó a su Programa de Socios. En el Portal de Socios usted refiere clientes, sigue cada etapa y recibe sus comisiones en su propia cuenta Stripe.'
        : o.partner ? (o.invitedBy || o.clientName) + ' lo invitó al Portal de Socios de Endeavor Business Solutions para acceder a los documentos que compartió con usted.'
        : o.invitedBy ? o.invitedBy + ' lo invitó al portal del cliente de Endeavor Business Solutions' + (o.clientName ? ' (' + o.clientName + ')' : '') + '.'
                    : 'Endeavor Business Solutions creó su acceso al portal del cliente' + (o.clientName ? ' (' + o.clientName + ')' : '') + '.',
        o.accepted ? 'El siguiente paso es el pago en el portal del cliente: al ingresar irá directo a la página de facturas y podrá pagar con tarjeta, Pix o transferencia bancaria. Por seguridad, el acceso usa contraseña y un código del celular.'
        : o.referral ? 'Por seguridad, el acceso usa contraseña y un código del celular.' : 'Allí encontrará los documentos de sus empresas, los plazos fiscales y los reportes financieros. Por seguridad, el acceso usa contraseña y un código del celular.',
        '',
        'PRIMER ACCESO (unos 5 minutos)',
        '1. Instale en su celular la app gratuita "Google Authenticator". El ícono es un asterisco de colores.',
        '   iPhone: ' + IOS,
        '   Android: ' + AND,
        '2. Recibirá un segundo correo, con el asunto "Cree su contraseña del portal Endeavor", enviado a ' + o.email + '. Ábralo en la computadora y haga clic en "Crear mi contraseña".',
        '3. Cree una contraseña de al menos 12 caracteres y haga clic en "Guardar contraseña". Aparecerá un código QR (un cuadrado de puntitos).',
        '4. En Google Authenticator, toque el botón "+" y elija "Escanear un código QR". Apunte la cámara del celular al código QR de la pantalla.',
        '5. La app muestra un código de 6 dígitos que cambia cada 30 segundos. Escríbalo en el portal y haga clic en "Activar y continuar".',
        'Dirección del portal: ' + o.link,
        'El enlace para crear la contraseña vale por 24 horas. Si vence, abra el portal y haga clic en "Olvidé mi contraseña" para recibir uno nuevo.',
        '',
        'EN LOS PRÓXIMOS ACCESOS',
        'Ingrese con su correo y contraseña. Cuando el portal pida el código, abra Google Authenticator y escriba el número que aparece en "Endeavor Business Solutions".',
        'Consejo: inicie sesión en Google Authenticator con su cuenta de Google para tener una copia de respaldo si cambia de celular.',
        '',
        '¿Necesita ayuda? ' + HELP,
        'Endeavor Business Solutions'
      ].join('\n');
    }
  };

  window.EndeavorInvite = {
    text: function (lang, o) { return (T[lang] || T.pt)(o); },
    subject: function (lang) {
      return { pt: 'Seu acesso ao portal da Endeavor Business Solutions', en: 'Your access to the Endeavor Business Solutions portal', es: 'Su acceso al portal de Endeavor Business Solutions' }[lang] || 'Seu acesso ao portal da Endeavor Business Solutions';
    },
    IOS: IOS, AND: AND
  };
})();
