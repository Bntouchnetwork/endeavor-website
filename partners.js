/* Public Partner Program page: benefits, how it works and a call to schedule a conversation
   (the regular booking page with the "Partner Program" topic). Partners are created by the admin after the call. */
(function () {
  'use strict';
  var DICT = {
    en: {},
    pt: {
      docTitle: 'Programa de Parceiros | Endeavor Business Solutions', skip: 'Pular para o conteúdo', login: 'Entrar no portal', kicker: 'PROGRAMA DE PARCEIROS',
      title: 'Cresça junto com a Endeavor Business Solutions', lead: 'Indique clientes que precisam de empresa nos Estados Unidos. A gente cuida de tudo, você acompanha cada etapa pelo seu portal e recebe a sua comissão automaticamente.',
      cta: 'Quero ser parceiro', howBtn: 'Como funciona', benTitle: 'Por que ser parceiro',
      b1t: 'Comissão em cada indicação', b1: 'Você ganha sobre os serviços contratados pelos clientes que indicar. Sem custo para participar e sem meta mínima.',
      b2t: 'Pagamento automático', b2: 'Conecte a sua conta Stripe uma vez e a sua parte cai direto para você quando o cliente paga. O Stripe também cuida dos seus formulários fiscais.',
      b3t: 'Seu próprio portal', b3: 'Envie indicações, acompanhe cada cliente etapa por etapa e veja o que já recebeu e o que vai receber.',
      b4t: 'Atendimento completo', b4: 'Nossa equipe cuida de abertura de empresa, compliance, coordenação fiscal, conta bancária e imóveis, em português, inglês ou espanhol.',
      howTitle: 'Como funciona', s1t: 'Agende uma conversa', s1: 'Escolha um horário na nossa agenda para uma conversa de 30 minutos com a nossa equipe.',
      s2t: 'Conversa de onboarding', s2: 'Conhecemos o seu trabalho, combinamos a sua comissão e enviamos o contrato de parceria para assinatura eletrônica.',
      s3t: 'Portal e Stripe', s3: 'Você recebe o acesso ao Portal do Parceiro e conecta a sua conta Stripe para receber as comissões.',
      s4t: 'Indique e receba', s4: 'Indique clientes pelo portal e receba a sua parte a cada pagamento.',
      formTitle: 'Agende uma conversa', formLead: 'Escolha um horário de 30 minutos com a nossa equipe. Na conversa, conhecemos o seu trabalho e os seus clientes, combinamos a sua comissão e, se fizer sentido para os dois lados, criamos o seu acesso ao Portal do Parceiro e enviamos o contrato de parceria para assinatura eletrônica.',
      bk1: 'Escolha o dia e o horário na nossa agenda', bk2: 'Videochamada, telefone ou WhatsApp, em português, inglês ou espanhol', bk3: 'Você recebe a confirmação e os lembretes por e-mail',
      bookBtn: 'Agendar uma conversa', already: 'Já é parceiro?'
    },
    es: {
      docTitle: 'Programa de Socios | Endeavor Business Solutions', skip: 'Saltar al contenido', login: 'Entrar al portal', kicker: 'PROGRAMA DE SOCIOS',
      title: 'Crezca junto a Endeavor Business Solutions', lead: 'Recomiende clientes que necesitan una empresa en Estados Unidos. Nosotros nos encargamos de todo, usted sigue cada etapa en su portal y recibe su comisión automáticamente.',
      cta: 'Quiero ser socio', howBtn: 'Cómo funciona', benTitle: 'Por qué ser socio',
      b1t: 'Comisión por cada recomendación', b1: 'Usted gana sobre los servicios que contraten los clientes que recomiende. Sin costo para participar y sin metas mínimas.',
      b2t: 'Pago automático', b2: 'Conecte su cuenta Stripe una vez y su parte le llega directo cuando el cliente paga. Stripe también se encarga de sus formularios fiscales.',
      b3t: 'Su propio portal', b3: 'Envíe recomendaciones, siga cada cliente paso a paso y vea lo que ya recibió y lo que va a recibir.',
      b4t: 'Atención completa', b4: 'Nuestro equipo se encarga de constitución de empresas, cumplimiento, coordinación fiscal, cuenta bancaria y bienes raíces, en español, inglés o portugués.',
      howTitle: 'Cómo funciona', s1t: 'Agende una conversación', s1: 'Elija un horario en nuestra agenda para una conversación de 30 minutos con nuestro equipo.',
      s2t: 'Llamada de onboarding', s2: 'Conocemos su trabajo, acordamos su comisión y enviamos el contrato de socio para firma electrónica.',
      s3t: 'Portal y Stripe', s3: 'Usted recibe el acceso al Portal de Socios y conecta su cuenta Stripe para recibir las comisiones.',
      s4t: 'Recomiende y reciba', s4: 'Recomiende clientes en el portal y reciba su parte con cada pago.',
      formTitle: 'Agende una conversación', formLead: 'Elija un horario de 30 minutos con nuestro equipo. En la conversación conocemos su trabajo y sus clientes, acordamos su comisión y, si tiene sentido para ambos, creamos su acceso al Portal de Socios y enviamos el contrato de socio para firma electrónica.',
      bk1: 'Elija el día y la hora en nuestra agenda', bk2: 'Videollamada, teléfono o WhatsApp, en español, inglés o portugués', bk3: 'Recibe la confirmación y los recordatorios por correo',
      bookBtn: 'Agendar una conversación', already: '¿Ya es socio?'
    }
  };
  EP.init(DICT);
  var b = document.getElementById('pp-book');
  if (b) b.href = 'schedule.html?lang=' + EP.lang + '&topic=partner';
  if (location.hash === '#cadastro') setTimeout(function () { var c = document.getElementById('cadastro'); if (c) c.scrollIntoView(); }, 50);
})();
