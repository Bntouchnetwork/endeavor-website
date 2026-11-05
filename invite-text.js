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
        '2. No computador, abra o portal: ' + o.link,
        '3. Digite este e-mail (' + o.email + ') e crie uma senha com pelo menos 12 caracteres. Depois clique em "Primeiro acesso: criar senha".',
        '4. Você vai receber um e-mail de confirmação. Clique no link desse e-mail.',
        '5. Volte ao portal e clique em "Entrar" com o e-mail e a senha. Vai aparecer um QR code (um quadrado de pontinhos).',
        '6. No Google Authenticator, toque no botão "+" e escolha "Ler código QR". Aponte a câmera do celular para o QR code na tela.',
        '7. O app mostra um código de 6 dígitos, que muda a cada 30 segundos. Digite esse código no portal e clique em "Ativar e continuar".',
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
        '2. On your computer, open the portal: ' + o.link,
        '3. Enter this email (' + o.email + ') and create a password with at least 12 characters. Then click "First access: create password".',
        '4. You will receive a confirmation email. Click the link in that email.',
        '5. Go back to the portal and click "Sign in" with your email and password. A QR code (a square of dots) will appear.',
        '6. In Google Authenticator, tap the "+" button and choose "Scan a QR code". Point your phone camera at the QR code on the screen.',
        '7. The app shows a 6-digit code that changes every 30 seconds. Type that code in the portal and click "Activate and continue".',
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
        '2. En la computadora, abra el portal: ' + o.link,
        '3. Ingrese este correo (' + o.email + ') y cree una contraseña de al menos 12 caracteres. Luego haga clic en "Primer acceso: crear contraseña".',
        '4. Recibirá un correo de confirmación. Haga clic en el enlace de ese correo.',
        '5. Vuelva al portal y haga clic en "Ingresar" con su correo y contraseña. Aparecerá un código QR (un cuadrado de puntitos).',
        '6. En Google Authenticator, toque el botón "+" y elija "Escanear un código QR". Apunte la cámara del celular al código QR de la pantalla.',
        '7. La app muestra un código de 6 dígitos que cambia cada 30 segundos. Escríbalo en el portal y haga clic en "Activar y continuar".',
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
