/* Operating Agreement rules (shared by the client portal, the admin portal, the demo and the `oa` edge function).
   - Questions with neutral explanations in PT/EN/ES and state-specific notes.
   - Clause library: the approved model text of every provision, with verifiable statutory references.
   - Validation: missing answers, conflicts with the Articles, and situations that need a qualified reviewer.
   The rule set used in production is the copy stored in `oa_rule_sets` and approved by a legal reviewer;
   this file is the source used to build it. Plain script: sets globalThis.EOARules (works in browsers and Deno). */
(function (G) {
  'use strict';
  var VERSION = '2026.11-2';
  var L = function (pt, en, es) { return { pt: pt, en: en, es: es }; };

  /* ---------------- states and statutory references ---------------- */
  var WYS = function (sec) { var art = String(sec).split('-')[2].charAt(0); return { cite: 'W.S. § ' + sec, url: 'https://law.justia.com/codes/wyoming/2022/title-17/chapter-29/article-' + art + '/section-' + sec + '/' }; };
  var FLS = function (sec) { return { cite: 'Fla. Stat. § ' + sec, url: 'https://www.flsenate.gov/Laws/Statutes/2025/' + sec }; };
  var DES = function (sec) { var sc = String(sec).split('-')[1]; var n = sc.length === 4 ? sc.slice(0, 2) : '0' + sc.charAt(0); return { cite: '6 Del. C. § ' + sec, url: 'https://delcode.delaware.gov/title6/c018/sc' + n + '/index.html' }; };
  var TXS = function (sec) { var ch = String(sec).split('.')[0]; return { cite: 'Tex. Bus. Orgs. Code § ' + sec, url: 'https://statutes.capitol.texas.gov/Docs/BO/htm/BO.' + ch + '.htm#' + sec }; };
  var STATES = {
    WY: { name: 'Wyoming', act: 'Wyoming Limited Liability Company Act, W.S. 17-29-101 through 17-29-1105', filing: 'Articles of Organization', office: 'Wyoming Secretary of State',
      ueta: { cite: 'W.S. § 40-21-101 et seq. (Uniform Electronic Transactions Act)', url: 'https://wyoleg.gov/statutes/compress/title40.pdf' },
      refs: { act: { cite: 'W.S. §§ 17-29-101 to 17-29-1105', url: 'https://wyoleg.gov/statutes/compress/title17.pdf' }, scope: WYS('17-29-110'), articles: WYS('17-29-201'), name: WYS('17-29-108'),
        agent: { cite: 'W.S. § 17-28-101 et seq. (registered agents)', url: 'https://wyoleg.gov/statutes/compress/title17.pdf' }, purpose: WYS('17-29-104'), liability: WYS('17-29-304'),
        admission: WYS('17-29-401'), management: WYS('17-29-407'), distributions: WYS('17-29-405'), transfer: WYS('17-29-502'), charging: WYS('17-29-503'),
        dissociation: WYS('17-29-602'), dissolution: WYS('17-29-701'), winding: WYS('17-29-702'), indemnification: WYS('17-29-408'), records: WYS('17-29-410') } },
    FL: { name: 'Florida', act: 'Florida Revised Limited Liability Company Act, Chapter 605, Florida Statutes', filing: 'Articles of Organization', office: 'Florida Department of State, Division of Corporations',
      ueta: { cite: 'Fla. Stat. § 668.50 (Uniform Electronic Transaction Act)', url: 'https://www.flsenate.gov/Laws/Statutes/2025/668.50' },
      refs: { act: { cite: 'Fla. Stat. ch. 605', url: 'https://www.flsenate.gov/Laws/Statutes/2025/Chapter605/All' }, scope: FLS('605.0105'), articles: FLS('605.0201'), name: FLS('605.0112'),
        agent: FLS('605.0113'), purpose: FLS('605.0108'), liability: FLS('605.0304'), admission: FLS('605.0401'), management: FLS('605.0407'), distributions: FLS('605.0405'),
        transfer: FLS('605.0502'), charging: FLS('605.0503'), dissociation: FLS('605.0602'), dissolution: FLS('605.0701'), winding: FLS('605.0709'), indemnification: FLS('605.0408'), records: FLS('605.0410') } },
    DE: { name: 'Delaware', act: 'Delaware Limited Liability Company Act, 6 Del. C. § 18-101 et seq.', filing: 'Certificate of Formation', office: 'Delaware Secretary of State, Division of Corporations',
      ueta: { cite: '6 Del. C. ch. 12A (Uniform Electronic Transactions Act)', url: 'https://delcode.delaware.gov/title6/c012a/index.html' },
      refs: { act: { cite: '6 Del. C. ch. 18', url: 'https://delcode.delaware.gov/title6/c018/index.html' }, scope: DES('18-1101'), articles: DES('18-201'), name: DES('18-102'),
        agent: DES('18-104'), purpose: DES('18-106'), liability: DES('18-303'), admission: DES('18-301'), management: DES('18-402'), distributions: DES('18-607'),
        transfer: DES('18-702'), charging: DES('18-703'), dissociation: DES('18-705'), dissolution: DES('18-801'), winding: DES('18-803'), indemnification: DES('18-108'), records: DES('18-305') } },
    TX: { name: 'Texas', act: 'Texas Business Organizations Code, including Title 3, Chapter 101 (Limited Liability Companies)', filing: 'Certificate of Formation', office: 'Texas Secretary of State',
      agreement_term: 'company agreement', continuation: 'one (1) year', no_member_event: 'the termination of the membership of the last remaining Member, unless the Company is continued as permitted by the Act',
      ueta: { cite: 'Tex. Bus. & Com. Code ch. 322 (Uniform Electronic Transactions Act)', url: 'https://statutes.capitol.texas.gov/Docs/BC/htm/BC.322.htm' },
      refs: { act: { cite: 'Tex. Bus. Orgs. Code ch. 101', url: 'https://statutes.capitol.texas.gov/Docs/BO/htm/BO.101.htm' }, scope: TXS('101.052'), articles: TXS('3.010'), name: TXS('5.056'),
        agent: TXS('5.201'), purpose: TXS('2.001'), liability: TXS('101.114'), admission: TXS('101.103'), management: TXS('101.251'), distributions: TXS('101.206'),
        transfer: TXS('101.108'), charging: TXS('101.112'), dissociation: TXS('11.056'), dissolution: TXS('11.051'), winding: TXS('11.052'), indemnification: TXS('101.402'), records: TXS('101.501') } }
  };
  var FED = {
    classification: { cite: '26 C.F.R. § 301.7701-3', url: 'https://www.ecfr.gov/current/title-26/section-301.7701-3' },
    scorp: { cite: '26 U.S.C. § 1361(b)(1)(C)', url: 'https://www.law.cornell.edu/uscode/text/26/1361' },
    f5472: { cite: '26 U.S.C. § 6038A; 26 C.F.R. § 1.6038A-1(c)', url: 'https://www.ecfr.gov/current/title-26/section-1.6038A-1' },
    pr: { cite: '26 U.S.C. § 6223', url: 'https://www.law.cornell.edu/uscode/text/26/6223' },
    esign: { cite: '15 U.S.C. § 7001 (E-SIGN Act)', url: 'https://www.law.cornell.edu/uscode/text/15/7001' }
  };

  /* ---------------- questions ---------------- */
  // when: {members:'single'|'multi'} {management:'manager'} ; prefill: key of the prefill object
  var YESNO = [['yes', L('Sim', 'Yes', 'Sí')], ['no', L('Não', 'No', 'No')]];
  var UNSURE = ['unsure', L('Não tenho certeza: quero orientação da Endeavor', 'I am not sure: I want guidance from Endeavor', 'No estoy seguro: quiero orientación de Endeavor')];
  var SECTIONS = [
    ['company', L('Dados da empresa', 'Company details', 'Datos de la empresa')],
    ['owners', L('Sócios e administração', 'Owners and management', 'Socios y administración')],
    ['money', L('Decisões, lucros e impostos', 'Decisions, profits and taxes', 'Decisiones, utilidades e impuestos')],
    ['changes', L('Mudanças na sociedade', 'Ownership changes', 'Cambios en la sociedad')],
    ['other', L('Outras disposições', 'Other provisions', 'Otras disposiciones')]
  ];
  var Q = [
    { id: 'legal_name', section: 'company', type: 'text', essential: true, prefill: 'legal_name',
      label: L('Nome legal da empresa', 'Legal name of the company', 'Nombre legal de la empresa'),
      help: L('É o nome exatamente como aparece nos Articles arquivados no estado, incluindo "LLC". O Operating Agreement precisa usar o mesmo nome; uma diferença pode gerar dúvidas com bancos, cartórios e autoridades fiscais.',
        'The name exactly as it appears in the Articles filed with the state, including "LLC". The Operating Agreement must use the same name; a mismatch can raise questions with banks, title companies and tax authorities.',
        'Es el nombre exactamente como aparece en los Articles presentados al estado, incluido "LLC". El Operating Agreement debe usar el mismo nombre; una diferencia puede generar dudas con bancos, notarías y autoridades fiscales.') },
    { id: 'state', section: 'company', type: 'select', essential: true, prefill: 'state', options: [['WY', L('Wyoming', 'Wyoming', 'Wyoming')], ['FL', L('Flórida', 'Florida', 'Florida')], ['DE', L('Delaware', 'Delaware', 'Delaware')], ['TX', L('Texas', 'Texas', 'Texas')], ['other', L('Outro estado', 'Another state', 'Otro estado')]],
      label: L('Estado de constituição', 'State of formation', 'Estado de constitución'),
      help: L('A lei do estado onde a LLC foi registrada rege o acordo. As regras sobre administração, distribuições e proteção patrimonial mudam de um estado para outro.',
        'The law of the state where the LLC was registered governs the agreement. Rules on management, distributions and asset protection differ from state to state.',
        'La ley del estado donde se registró la LLC rige el acuerdo. Las reglas sobre administración, distribuciones y protección patrimonial cambian de un estado a otro.'),
      notes: { other: L('Ainda não temos regras aprovadas para este estado. O pedido será encaminhado para a revisão de um profissional habilitado.', 'We do not yet have approved rules for this state. The request will be routed to a qualified reviewer.', 'Aún no tenemos reglas aprobadas para este estado. La solicitud se enviará a la revisión de un profesional habilitado.') } },
    { id: 'filing_number', section: 'company', type: 'text', essential: false, prefill: 'filing_number',
      label: L('Número de registro no estado', 'State filing number', 'Número de registro en el estado'),
      help: L('O número que o estado atribuiu à empresa (no Sunbiz, "Document Number"). Ajuda a identificar a empresa com precisão; se não souber, a Endeavor completa.', 'The number the state assigned to the company (in Florida\'s Sunbiz, the "Document Number"). It identifies the company precisely; if you do not know it, Endeavor will complete it.', 'El número que el estado asignó a la empresa (en Sunbiz, "Document Number"). Identifica a la empresa con precisión; si no lo sabe, Endeavor lo completa.') },
    { id: 'formation_date', section: 'company', type: 'date', essential: true, prefill: 'formation_date',
      label: L('Data de constituição', 'Date of formation', 'Fecha de constitución'),
      help: L('A data em que os Articles foram aceitos pelo estado. O acordo passa a valer a partir dessa data, para que cubra todo o período de existência da empresa.', 'The date the state accepted the Articles. The agreement is made effective as of that date so it covers the whole life of the company.', 'La fecha en que el estado aceptó los Articles. El acuerdo tiene efecto desde esa fecha para cubrir toda la existencia de la empresa.'),
      notes: { DE: L('Em Delaware o documento de constituição se chama Certificate of Formation.', 'In Delaware the formation document is called the Certificate of Formation.', 'En Delaware el documento de constitución se llama Certificate of Formation.'),
        TX: L('No Texas o documento de constituição se chama Certificate of Formation, e a lei chama o Operating Agreement de "company agreement".', 'In Texas the formation document is called the Certificate of Formation, and the law calls the Operating Agreement a "company agreement".', 'En Texas el documento de constitución se llama Certificate of Formation, y la ley llama al Operating Agreement "company agreement".') } },
    { id: 'principal_address', section: 'company', type: 'text', essential: true, prefill: 'principal_address',
      label: L('Endereço principal da empresa', 'Principal office address', 'Dirección principal de la empresa'),
      help: L('O endereço comercial que aparece nos registros da empresa. Não precisa ser residencial. Pode ser alterado depois pelos sócios.', 'The business address shown in the company records. It does not need to be a home address and can be changed later by the members.', 'La dirección comercial que figura en los registros de la empresa. No tiene que ser residencial y puede cambiarse después.') },
    { id: 'registered_agent', section: 'company', type: 'text', essential: true, prefill: 'registered_agent',
      label: L('Agente registrado (registered agent)', 'Registered agent', 'Agente registrado (registered agent)'),
      help: L('Pessoa ou empresa no estado que recebe citações e avisos oficiais em nome da LLC. Todo estado exige um agente registrado ativo; perder um aviso pode levar a decisões à revelia.', 'The person or company in the state that receives lawsuits and official notices for the LLC. Every state requires an active registered agent; a missed notice can lead to default judgments.', 'Persona o empresa en el estado que recibe demandas y avisos oficiales en nombre de la LLC. Todo estado exige un agente registrado activo; perder un aviso puede llevar a decisiones en rebeldía.') },
    // options: [value, labels, approved clause text used in Section "Purpose" (English)]
    { id: 'purpose', section: 'company', type: 'select', essential: true, options: [
        ['any', L('Qualquer atividade lícita (mais flexível)', 'Any lawful business (most flexible)', 'Cualquier actividad lícita (más flexible)')],
        ['real_estate', L('Investimento imobiliário: comprar, manter, alugar e vender imóveis', 'Real estate investment: buy, hold, rent and sell property', 'Inversión inmobiliaria: comprar, mantener, alquilar y vender inmuebles'),
          'to acquire, own, hold, finance, lease (including long-term and short-term rentals), manage, improve, sell, exchange and otherwise deal with real property and interests in real property, and to engage in any lawful activity related to it'],
        ['real_estate_development', L('Desenvolvimento imobiliário: construção, reforma e revenda (flip)', 'Real estate development: construction, renovation and resale (flip)', 'Desarrollo inmobiliario: construcción, remodelación y reventa (flip)'),
          'to acquire real property and to develop, construct, renovate, improve, subdivide, market, lease and sell it, and to engage in any lawful activity related to it'],
        ['property_management', L('Administração de imóveis de terceiros', 'Property management for third parties', 'Administración de inmuebles de terceros'),
          'to provide property management, leasing and related services for real property owned by others, subject to any license required by applicable law, and to engage in any lawful activity related to it'],
        ['holding', L('Holding de participações (deter quotas e ações de outras empresas)', 'Holding company (owning interests in other companies)', 'Holding de participaciones (tener cuotas y acciones de otras empresas)'),
          'to acquire, own, hold, manage, vote, finance and dispose of equity interests, membership interests, shares and other ownership interests in other entities, and to engage in any lawful activity related to it'],
        ['investment', L('Investimentos próprios (ações, fundos e outros ativos financeiros)', 'Own investments (stocks, funds and other financial assets)', 'Inversiones propias (acciones, fondos y otros activos financieros)'),
          'to invest in, hold, manage and dispose of securities, funds, notes and other investment assets for its own account only, and not as an investment adviser, broker or dealer for others, and to engage in any lawful activity related to it'],
        ['real_estate_holding', L('Holding patrimonial: imóveis + participações em outras empresas', 'Asset holding: real estate + interests in other companies', 'Holding patrimonial: inmuebles + participaciones en otras empresas'),
          'to acquire, own, hold, lease, manage and dispose of real property and interests in real property, and to acquire, own, hold, manage, vote and dispose of equity interests in other entities, and to engage in any lawful activity related to it'],
        ['trade', L('Comércio, importação e exportação', 'Trade, import and export', 'Comercio, importación y exportación'),
          'to purchase, sell, import, export and distribute goods and products, and to engage in any lawful activity related to it'],
        ['ecommerce', L('Comércio eletrônico (venda online)', 'E-commerce (online sales)', 'Comercio electrónico (venta en línea)'),
          'to sell goods and services through online and other channels, and to engage in any lawful activity related to it'],
        ['services', L('Consultoria e prestação de serviços', 'Consulting and business services', 'Consultoría y prestación de servicios'),
          'to provide consulting, advisory and business services, other than services that require a professional license unless the Company and its personnel hold that license, and to engage in any lawful activity related to it'],
        ['technology', L('Tecnologia e software', 'Technology and software', 'Tecnología y software'),
          'to develop, license, sell and support software, technology products and related services, and to engage in any lawful activity related to it'],
        ['specific', L('Outra atividade específica (descrever)', 'Another specific business (describe)', 'Otra actividad específica (describir)')]],
      detail: { when: 'specific', label: L('Descreva a atividade', 'Describe the business', 'Describa la actividad') },
      label: L('Objeto da empresa', 'Purpose of the company', 'Objeto de la empresa'),
      help: L('"Qualquer atividade lícita" dá mais flexibilidade e é o mais comum. Os objetos da lista (imóveis, holding de participações, investimentos e outros) descrevem a atividade com o texto aprovado pela Endeavor e ajudam bancos, title companies e investidores a entender a empresa, mas limitam o que ela pode fazer sem alterar o acordo. Uma holding de investimentos próprios não pode administrar dinheiro de terceiros sem as licenças exigidas. "Outra atividade específica" passa pela revisão de um profissional habilitado.',
        '"Any lawful business" gives the most flexibility and is the most common choice. The listed purposes (real estate, holding company, investments and others) describe the business with wording approved by Endeavor and help banks, title companies and investors understand the company, but they limit what it may do without amending the agreement. A company that invests for its own account may not manage other people\'s money without the required licenses. "Another specific business" is reviewed by a qualified professional.',
        '"Cualquier actividad lícita" da más flexibilidad y es lo más común. Los objetos de la lista (inmuebles, holding de participaciones, inversiones y otros) describen la actividad con el texto aprobado por Endeavor y ayudan a bancos, title companies e inversionistas a entender la empresa, pero limitan lo que puede hacer sin modificar el acuerdo. Una empresa que invierte por cuenta propia no puede administrar dinero de terceros sin las licencias exigidas. "Otra actividad específica" pasa por la revisión de un profesional habilitado.') },
    { id: 'members', section: 'owners', type: 'members', essential: true,
      label: L('Sócios (members)', 'Members', 'Socios (members)'),
      help: L('Liste todos os donos da LLC, a porcentagem de cada um (o total deve ser 100%) e o que cada um aportou. As porcentagens definem votos, divisão de lucros e quem assina. O e-mail é usado só para enviar o link de assinatura e não aparece no documento. Não informe SSN, ITIN, passaporte ou dados bancários.',
        'List every owner of the LLC, each one\'s percentage (the total must be 100%) and what each contributed. Percentages determine votes, profit sharing and who signs. The email is used only to send the signing link and is not printed in the document. Do not enter SSN, ITIN, passport or bank details.',
        'Indique todos los dueños de la LLC, el porcentaje de cada uno (el total debe ser 100%) y lo que cada uno aportó. Los porcentajes definen votos, reparto de utilidades y quién firma. El correo se usa solo para enviar el enlace de firma y no aparece en el documento. No indique SSN, ITIN, pasaporte ni datos bancarios.'),
      sub: { us_person: L('Pessoa dos EUA para fins fiscais (cidadão, green card ou residente fiscal)?', 'U.S. person for tax purposes (citizen, green card holder or tax resident)?', '¿Persona de EE. UU. para fines fiscales (ciudadano, green card o residente fiscal)?') } },
    { id: 'management', section: 'owners', type: 'select', essential: true, prefill: 'management', options: [['member', L('Administrada pelos sócios (member-managed)', 'Managed by the members (member-managed)', 'Administrada por los socios (member-managed)')], ['manager', L('Administrada por gerente(s) (manager-managed)', 'Managed by one or more managers (manager-managed)', 'Administrada por gerente(s) (manager-managed)')], UNSURE],
      label: L('Quem administra a empresa', 'Who manages the company', 'Quién administra la empresa'),
      help: L('Na administração pelos sócios, cada sócio participa das decisões e pode representar a empresa. Na administração por gerente, só o(s) gerente(s) nomeado(s) tomam as decisões do dia a dia e assinam pela empresa; os sócios votam apenas em assuntos relevantes. A escolha deve ser igual ao que consta nos Articles, quando eles indicam.',
        'In a member-managed LLC every member takes part in decisions and may act for the company. In a manager-managed LLC only the appointed manager(s) run day-to-day business and sign for the company; members vote only on major matters. The choice must match the Articles when the Articles state it.',
        'En la administración por los socios, cada socio participa en las decisiones y puede representar a la empresa. En la administración por gerente, solo el/los gerente(s) designado(s) toman las decisiones diarias y firman por la empresa; los socios votan solo en asuntos importantes. La elección debe coincidir con los Articles cuando estos la indican.'),
      notes: {
        WY: L('Wyoming: se o acordo não disser nada, a LLC é administrada pelos sócios (W.S. § 17-29-407).', 'Wyoming: if the agreement is silent, the LLC is member-managed (W.S. § 17-29-407).', 'Wyoming: si el acuerdo no dice nada, la LLC es administrada por los socios (W.S. § 17-29-407).'),
        FL: L('Flórida: a lei presume administração pelos sócios, salvo previsão expressa (Fla. Stat. § 605.0407). Os Articles costumam listar gerentes ou representantes autorizados; o acordo deve ser coerente com eles.', 'Florida: the law presumes member management unless expressly provided otherwise (Fla. Stat. § 605.0407). The Articles often list managers or authorized representatives; the agreement should be consistent with them.', 'Florida: la ley presume administración por los socios salvo disposición expresa (Fla. Stat. § 605.0407). Los Articles suelen indicar gerentes o representantes autorizados; el acuerdo debe ser coherente con ellos.'),
        DE: L('Delaware: o Certificate of Formation normalmente não indica a forma de administração; ela é definida neste acordo (6 Del. C. § 18-402).', 'Delaware: the Certificate of Formation usually does not state the management structure; it is set in this agreement (6 Del. C. § 18-402).', 'Delaware: el Certificate of Formation normalmente no indica la forma de administración; se define en este acuerdo (6 Del. C. § 18-402).') ,
        TX: L('Texas: o Certificate of Formation precisa dizer se a LLC terá gerentes, e é ele que define a administração (Tex. Bus. Orgs. Code §§ 3.010 e 101.251). Se a sua escolha for diferente, o certificado terá de ser alterado; por isso o caso vai para revisão.', 'Texas: the Certificate of Formation must state whether the LLC will have managers, and it controls the management structure (Tex. Bus. Orgs. Code §§ 3.010 and 101.251). If your choice differs, the certificate must be amended, so the case goes to review.', 'Texas: el Certificate of Formation debe indicar si la LLC tendrá gerentes, y es el que define la administración (Tex. Bus. Orgs. Code §§ 3.010 y 101.251). Si su elección es distinta, habrá que modificar el certificado; por eso el caso pasa a revisión.') } },
    { id: 'managers', section: 'owners', type: 'managers', essential: true, when: { management: 'manager' },
      label: L('Gerente(s)', 'Manager(s)', 'Gerente(s)'),
      help: L('Indique quem será gerente. Pode ser um sócio ou uma pessoa de fora. O gerente representa a empresa perante bancos e terceiros e assina o acordo nessa qualidade.', 'Name the manager(s). A manager may be a member or an outside person. The manager represents the company before banks and third parties and signs the agreement in that capacity.', 'Indique quién será gerente. Puede ser un socio o una persona externa. El gerente representa a la empresa ante bancos y terceros y firma el acuerdo en esa calidad.') },
    { id: 'voting', section: 'money', type: 'select', essential: true, when: { members: 'multi' }, options: [['majority', L('Maioria das participações (mais de 50%)', 'Majority of percentage interests (over 50%)', 'Mayoría de participaciones (más del 50%)')], ['unanimous', L('Unanimidade', 'Unanimous', 'Unanimidad')]],
      label: L('Decisões do dia a dia', 'Ordinary decisions', 'Decisiones ordinarias'),
      help: L('Por maioria, os sócios com mais de 50% decidem sozinhos, o que agiliza a gestão. Por unanimidade, qualquer sócio pode bloquear uma decisão, o que protege minoritários mas pode travar a empresa em caso de desacordo.', 'With majority voting, members holding more than 50% decide, which keeps management efficient. With unanimity any member can block a decision, which protects minority owners but can deadlock the company if members disagree.', 'Por mayoría, los socios con más del 50% deciden, lo que agiliza la gestión. Por unanimidad, cualquier socio puede bloquear una decisión, lo que protege a los minoritarios pero puede paralizar la empresa si hay desacuerdo.') },
    { id: 'major', section: 'money', type: 'select', essential: true, when: { members: 'multi' }, options: [['unanimous', L('Unanimidade', 'Unanimous', 'Unanimidad')], ['supermajority', L('Dois terços das participações', 'Two-thirds of percentage interests', 'Dos tercios de las participaciones')]],
      label: L('Decisões importantes', 'Major decisions', 'Decisiones importantes'),
      help: L('Vale para vender ou dar em garantia bens relevantes, contrair dívidas fora do comum, admitir novos sócios, alterar o acordo ou dissolver a empresa. Um quórum mais alto dá mais proteção a cada sócio e torna essas decisões mais difíceis.', 'Applies to selling or pledging significant assets, unusual borrowing, admitting new members, amending the agreement or dissolving the company. A higher threshold gives each member more protection and makes these decisions harder to take.', 'Se aplica a vender o gravar bienes relevantes, deudas fuera de lo común, admitir nuevos socios, modificar el acuerdo o disolver la empresa. Un quórum más alto da más protección a cada socio y hace más difíciles estas decisiones.') },
    { id: 'distributions', section: 'money', type: 'select', essential: true, options: [['as_determined', L('Quando os sócios/gerentes decidirem, proporcional às participações', 'When the members/managers decide, in proportion to percentages', 'Cuando los socios/gerentes decidan, en proporción a las participaciones')], ['tax', L('Igual, com distribuição mínima para pagar impostos', 'The same, plus a minimum distribution to cover taxes', 'Igual, con una distribución mínima para pagar impuestos')]],
      label: L('Distribuição de lucros', 'Profit distributions', 'Distribución de utilidades'),
      help: L('Define quando o caixa pode ser distribuído aos sócios. A distribuição para impostos garante que cada sócio receba ao menos o necessário para pagar o imposto sobre o lucro atribuído a ele. Em qualquer caso, a lei proíbe distribuir se a empresa ficar sem conseguir pagar suas dívidas.', 'Sets when cash may be distributed to members. A tax distribution makes sure each member receives at least enough to pay the tax on the profit allocated to them. In every case the law prohibits distributions that would leave the company unable to pay its debts.', 'Define cuándo se puede distribuir el efectivo a los socios. La distribución para impuestos asegura que cada socio reciba al menos lo necesario para pagar el impuesto sobre la utilidad asignada. En cualquier caso, la ley prohíbe distribuir si la empresa queda sin poder pagar sus deudas.') },
    { id: 'tax', section: 'money', type: 'select', essential: true, options: [['default', L('Tratamento padrão (sem eleição)', 'Default treatment (no election)', 'Tratamiento estándar (sin elección)')], ['s_corp', L('Eleição de S corporation', 'S corporation election', 'Elección de S corporation')], ['c_corp', L('Eleição de C corporation', 'C corporation election', 'Elección de C corporation')], UNSURE],
      label: L('Tributação federal', 'Federal tax classification', 'Tributación federal'),
      help: L('Sem eleição, uma LLC de um sócio é desconsiderada (o resultado vai para o sócio) e uma de vários sócios é tributada como sociedade (partnership). A eleição de S corp só é permitida se todos os sócios forem pessoas dos EUA. A eleição de C corp faz a empresa pagar imposto próprio. Converse com seu contador antes de escolher uma eleição.',
        'Without an election, a single-member LLC is disregarded (results flow to the owner) and a multi-member LLC is taxed as a partnership. An S corporation election is only allowed when every member is a U.S. person. A C corporation election makes the company a separate taxpayer. Talk to your accountant before choosing an election.',
        'Sin elección, una LLC de un socio es ignorada (el resultado pasa al socio) y una de varios socios tributa como sociedad (partnership). La elección de S corp solo se permite si todos los socios son personas de EE. UU. La elección de C corp hace que la empresa pague su propio impuesto. Consulte a su contador antes de elegir.'),
      notes: { foreign: L('Se a LLC tiver um único sócio estrangeiro, a lei federal exige o Form 5472 todos os anos, com multas altas se não for entregue.', 'If the LLC has a single foreign owner, federal law requires Form 5472 every year, with heavy penalties if it is not filed.', 'Si la LLC tiene un único socio extranjero, la ley federal exige el Form 5472 cada año, con multas altas si no se presenta.') } },
    { id: 'transfer', section: 'changes', type: 'select', essential: true, options: [['consent', L('Só com consentimento dos demais sócios', 'Only with the consent of the other members', 'Solo con el consentimiento de los demás socios')], ['rofr', L('Consentimento + direito de preferência dos sócios', 'Consent plus a right of first refusal for the members', 'Consentimiento + derecho de preferencia de los socios')]],
      label: L('Venda ou transferência de participação', 'Sale or transfer of an interest', 'Venta o transferencia de participación'),
      help: L('Restringe a entrada de terceiros na sociedade. Com direito de preferência, antes de vender a um terceiro o sócio precisa oferecer a participação aos demais nas mesmas condições.', 'Restricts outsiders from joining the company. With a right of first refusal, before selling to a third party a member must offer the interest to the other members on the same terms.', 'Restringe la entrada de terceros. Con derecho de preferencia, antes de vender a un tercero el socio debe ofrecer la participación a los demás en las mismas condiciones.'),
      notes: {
        WY: L('Wyoming: a ordem de penhora de participação (charging order) é o único meio de um credor pessoal do sócio alcançar a participação, inclusive em LLC de um sócio (W.S. § 17-29-503).', 'Wyoming: a charging order is the exclusive remedy for a member\'s personal creditor against the interest, including in a single-member LLC (W.S. § 17-29-503).', 'Wyoming: la orden de embargo de participación (charging order) es el único medio de un acreedor personal del socio, incluso en LLC de un socio (W.S. § 17-29-503).'),
        FL: L('Flórida: em LLC de um único sócio, o juiz pode permitir que o credor execute a participação se a charging order não bastar (Fla. Stat. § 605.0503(4)). Com dois ou mais sócios, a charging order é o meio exclusivo.', 'Florida: in a single-member LLC a court may allow a creditor to foreclose on the interest if a charging order is not enough (Fla. Stat. § 605.0503(4)). With two or more members the charging order is the exclusive remedy.', 'Florida: en una LLC de un solo socio, el juez puede permitir que el acreedor ejecute la participación si la charging order no basta (Fla. Stat. § 605.0503(4)). Con dos o más socios, la charging order es el medio exclusivo.'),
        DE: L('Delaware: a charging order é o meio exclusivo do credor pessoal do sócio, inclusive em LLC de um sócio (6 Del. C. § 18-703).', 'Delaware: a charging order is the exclusive remedy for a member\'s personal creditor, including in a single-member LLC (6 Del. C. § 18-703).', 'Delaware: la charging order es el medio exclusivo del acreedor personal del socio, incluso en LLC de un socio (6 Del. C. § 18-703).'),
        TX: L('Texas: a charging order é o meio exclusivo do credor pessoal do sócio para alcançar a participação (Tex. Bus. Orgs. Code § 101.112).', 'Texas: a charging order is the exclusive remedy for a member\'s personal creditor against the interest (Tex. Bus. Orgs. Code § 101.112).', 'Texas: la charging order es el medio exclusivo del acreedor personal del socio sobre la participación (Tex. Bus. Orgs. Code § 101.112).') } },
    { id: 'successor', section: 'changes', type: 'text', essential: false, when: { members: 'single' },
      label: L('Sucessor designado (opcional)', 'Designated successor (optional)', 'Sucesor designado (opcional)'),
      help: L('Pessoa que passa a ser sócia se o único sócio falecer ou ficar incapaz. Sem um sucessor, a empresa pode ser dissolvida se ficar 90 dias sem sócios. Pode ser alterado depois.', 'The person who becomes a member if the sole member dies or becomes incapacitated. Without a successor, the company may be dissolved after 90 days without members. It can be changed later.', 'Persona que pasa a ser socia si el único socio fallece o queda incapacitado. Sin sucesor, la empresa puede disolverse tras 90 días sin socios. Puede cambiarse después.'),
      notes: { WY: L('Wyoming: W.S. § 17-29-701(a)(iii).', 'Wyoming: W.S. § 17-29-701(a)(iii).', 'Wyoming: W.S. § 17-29-701(a)(iii).'), FL: L('Flórida: Fla. Stat. § 605.0701(3).', 'Florida: Fla. Stat. § 605.0701(3).', 'Florida: Fla. Stat. § 605.0701(3).'), DE: L('Delaware: 6 Del. C. § 18-801(a)(4).', 'Delaware: 6 Del. C. § 18-801(a)(4).', 'Delaware: 6 Del. C. § 18-801(a)(4).'),
        TX: L('Texas: o prazo é de um ano, e não 90 dias (Tex. Bus. Orgs. Code § 11.056).', 'Texas: the period is one year rather than 90 days (Tex. Bus. Orgs. Code § 11.056).', 'Texas: el plazo es de un año y no de 90 días (Tex. Bus. Orgs. Code § 11.056).') } },
    { id: 'heirs', section: 'changes', type: 'select', essential: true, when: { members: 'multi' }, options: [['transferee', L('Herdeiros recebem só os direitos econômicos', 'Heirs receive economic rights only', 'Los herederos reciben solo derechos económicos')], ['admitted', L('Herdeiros entram como sócios, com aprovação dos demais', 'Heirs are admitted as members, with the others\' approval', 'Los herederos entran como socios, con aprobación de los demás')]],
      label: L('Falecimento ou incapacidade de um sócio', 'Death or incapacity of a member', 'Fallecimiento o incapacidad de un socio'),
      help: L('Com "só direitos econômicos", os herdeiros recebem lucros e o valor da participação, mas não votam nem administram. A segunda opção permite que entrem como sócios plenos se os demais aprovarem.', 'With "economic rights only", heirs receive profits and the value of the interest but do not vote or manage. The second option lets them become full members if the others approve.', 'Con "solo derechos económicos", los herederos reciben utilidades y el valor de la participación, pero no votan ni administran. La segunda opción permite que entren como socios plenos si los demás aprueban.') },
    { id: 'fiscal_year', section: 'other', type: 'select', essential: true, prefill: 'fiscal_year', options: [['12-31', L('Ano-calendário (termina em 31/12)', 'Calendar year (ends December 31)', 'Año calendario (termina el 31/12)')], ['other', L('Outro', 'Other', 'Otro')]],
      detail: { when: 'other', label: L('Último dia do ano fiscal (MM-DD)', 'Last day of the fiscal year (MM-DD)', 'Último día del año fiscal (MM-DD)') },
      label: L('Ano fiscal', 'Fiscal year', 'Año fiscal'),
      help: L('A maioria das LLCs usa o ano-calendário, que também é o exigido pelo IRS para LLCs desconsideradas e para a maioria das partnerships.', 'Most LLCs use the calendar year, which is also what the IRS requires for disregarded LLCs and for most partnerships.', 'La mayoría de las LLC usan el año calendario, que también exige el IRS para LLC ignoradas y para la mayoría de las partnerships.') },
    { id: 'indemnification', section: 'other', type: 'select', essential: true, options: YESNO,
      label: L('Indenização de sócios e gerentes', 'Indemnification of members and managers', 'Indemnización de socios y gerentes'),
      help: L('Se "sim", a empresa reembolsa sócios e gerentes por despesas e condenações decorrentes de atos de boa-fé em nome da empresa, dentro do que a lei permite. Não cobre fraude, má-fé ou violação intencional da lei.', 'If "yes", the company reimburses members and managers for expenses and judgments arising from good-faith acts on its behalf, to the extent the law allows. It does not cover fraud, bad faith or knowing violations of law.', 'Si "sí", la empresa reembolsa a socios y gerentes los gastos y condenas derivados de actos de buena fe en su nombre, dentro de lo que permite la ley. No cubre fraude, mala fe ni violaciones intencionales de la ley.') }
  ];

  /* ---------------- approved model clauses ---------------- */
  // refs: keys of STATES[x].refs or 'fed.<key>' or 'ueta'
  var C = [
    { id: 'f.name', art: 1, title: 'Name', refs: ['name'], text: 'The name of the limited liability company is {{company}} (the "Company"). The business of the Company may be conducted under that name or any other name permitted by the Act and approved by {{decision_body}}.' },
    { id: 'f.formation', art: 1, title: 'Formation', refs: ['articles'], text: 'The Company was formed as a {{state_name}} limited liability company upon the filing of its {{filing}} with the {{office}}{{filing_date_phrase}}{{filing_number_phrase}}. The rights and obligations of the {{member_word_pl}} and the administration of the Company are governed by this Agreement, the {{filing}} and the {{act}} (the "Act"). To the extent permitted by the Act, this Agreement controls over any default rule of the Act.' },
    { id: 'f.purpose', art: 1, title: 'Purpose', refs: ['purpose'], text: 'The purpose of the Company is {{purpose_text}}. The Company has all powers necessary or convenient to carry out its purpose.' },
    { id: 'f.office', art: 1, title: 'Principal Office and Registered Agent', refs: ['agent'], text: 'The principal office of the Company is located at {{principal_address}}, or at any other place designated by {{decision_body}}. The registered agent of the Company in the State of {{state_name}} is {{registered_agent}}, or any successor appointed in accordance with applicable law.' },
    { id: 'f.term', art: 1, title: 'Term', refs: ['dissolution'], text: 'The Company has perpetual existence unless dissolved in accordance with Article {{art_dissolution}} or the Act.' },
    { id: 'm.members', art: 2, title: 'Members', refs: ['admission'], text: 'The name of each Member, the Capital Contribution of each Member and the Percentage Interest of each Member are set forth on Schedule A, which is incorporated into this Agreement. Schedule A shall be updated to reflect any change permitted by this Agreement.' },
    { id: 'm.capital', art: 2, title: 'Capital Contributions', refs: ['scope'], text: 'Each Member has made the Capital Contribution set forth opposite the Member\'s name on Schedule A. No Member is required to make any additional Capital Contribution or loan to the Company. No Member is entitled to interest on, or to the return of, any Capital Contribution except as provided in this Agreement.' },
    { id: 'm.liability', art: 2, title: 'Limited Liability', refs: ['liability'], text: 'Except as otherwise required by the Act, no Member{{or_manager}} is personally liable for any debt, obligation or liability of the Company, whether arising in contract, tort or otherwise, solely by reason of being a Member{{or_manager}}. The failure of the Company to observe formalities relating to the exercise of its powers or the management of its activities is not a ground for imposing personal liability on any Member{{or_manager}}.' },
    { id: 'g.member_single', art: 3, title: 'Management by the Member', when: { management: 'member', members: 'single' }, refs: ['management'], text: 'The Company is managed by its sole Member. The Member has full and complete authority, power and discretion to manage and control the business and affairs of the Company, to make all decisions regarding those matters and to perform any act necessary or appropriate to the conduct of the Company\'s business, including signing documents and opening and operating bank accounts on behalf of the Company.' },
    { id: 'g.member_multi', art: 3, title: 'Management by the Members', when: { management: 'member', members: 'multi' }, refs: ['management'], text: 'The Company is managed by its Members. Except for Major Decisions, every decision of the Company requires the approval of {{voting_text}}. Each Member is an agent of the Company for the purpose of its ordinary business, but no Member may bind the Company to any act that requires the approval of the Members under this Agreement without that approval.' },
    { id: 'g.manager', art: 3, title: 'Management by Managers', when: { management: 'manager' }, refs: ['management'], text: 'The Company is managed by {{managers_phrase}} ({{managers_def}}). The Manager{{managers_s}} {{has_have}} full authority to manage the ordinary business and affairs of the Company, to sign documents and to open and operate bank accounts on its behalf, subject to the matters reserved to the Members in this Agreement. A Manager serves until resignation or removal by {{members_consent}}, and a successor Manager may be appointed by {{members_consent}}. No Member, solely by reason of being a Member, is an agent of the Company or has authority to bind the Company.' },
    { id: 'g.major', art: 3, title: 'Major Decisions', when: { members: 'multi' }, refs: ['management'], text: 'The following actions ("Major Decisions") require the approval of {{major_text}}: (a) the sale, lease, exchange, mortgage or other disposition of all or substantially all of the assets of the Company, or of any real property owned by the Company; (b) incurring indebtedness outside the ordinary course of business; (c) the admission of a new Member; (d) any amendment of this Agreement or of the {{filing}}; (e) a merger, conversion or domestication of the Company; and (f) the dissolution of the Company.' },
    { id: 'g.reliance', art: 3, title: 'Reliance by Third Parties', refs: ['management'], text: 'Any person dealing with the Company may rely on a certificate signed by {{signing_authority}} as to the identity and authority of any Member or Manager and as to any action taken by the Company.' },
    { id: 'd.allocations', art: 4, title: 'Allocations', refs: ['scope'], text: 'The profits, losses, income, gains, deductions and credits of the Company for each fiscal year are allocated among the Members in proportion to their Percentage Interests{{single_alloc}}.' },
    { id: 'd.distributions', art: 4, title: 'Distributions', refs: ['distributions'], text: 'Distributions of available cash shall be made to the Members in proportion to their Percentage Interests at the times and in the amounts determined by {{decision_body}}.{{tax_dist}} No distribution shall be made if, after giving effect to the distribution, the Company would not be able to pay its debts as they become due in the ordinary course of business or the Company\'s total assets would be less than the sum of its total liabilities, or if the distribution would otherwise violate the Act.' },
    { id: 't.classification', art: 5, title: 'Tax Classification', refs: ['fed.classification'], text: '{{tax_text}}' },
    { id: 't.scorp', art: 5, title: 'S Corporation Election', when: { tax: 's_corp' }, refs: ['fed.scorp'], text: 'The Members authorize the Company to elect to be treated as an S corporation for federal income tax purposes. While the election is in effect, the Members shall not transfer any interest to a person who is not an eligible shareholder under Section 1361 of the Internal Revenue Code, and distributions shall be made strictly in proportion to the Percentage Interests.' },
    { id: 't.pr', art: 5, title: 'Partnership Representative', when: { members: 'multi', tax: 'default' }, refs: ['fed.pr'], text: 'For so long as the Company is classified as a partnership for federal income tax purposes, {{pr_name}} is designated as the "partnership representative" of the Company under Section 6223 of the Internal Revenue Code and shall keep the Members reasonably informed of any tax audit or proceeding.' },
    { id: 't.foreign', art: 5, title: 'Foreign-Owned Company Reporting', when: { members: 'single', foreign: true, tax: 'default' }, refs: ['fed.f5472'], text: 'Because the Company is wholly owned by a foreign person and is disregarded as an entity separate from its owner, the Company is treated as a domestic corporation for the limited purposes of Section 6038A of the Internal Revenue Code. The Company shall maintain the records and file the information returns (including IRS Form 5472) required by Section 6038A and the related Treasury Regulations, and the Member shall provide the information necessary to do so.' },
    { id: 'x.transfer', art: 6, title: 'Restrictions on Transfer', refs: ['transfer', 'charging'], text: 'No Member may sell, assign, pledge or otherwise transfer all or any part of the Member\'s interest in the Company without {{transfer_consent}}. Any purported transfer in violation of this Agreement is void. A transferee who is not admitted as a Member has only the right to receive the distributions to which the transferor would have been entitled and has no right to participate in management or to vote. The rights of a judgment creditor of a Member against the Member\'s interest are limited to the remedies provided by the Act.' },
    { id: 'x.rofr', art: 6, title: 'Right of First Refusal', when: { transfer: 'rofr', members: 'multi' }, refs: ['transfer'], text: 'Before transferring any interest to a person who is not a Member, a Member who receives a bona fide written offer shall first offer the interest to the other Members, in proportion to their Percentage Interests, on the same price and terms. The other Members have thirty (30) days after receipt of written notice of the offer to accept. If the offer is not accepted in full, the transferring Member may complete the transfer to the third party within the following sixty (60) days on terms no more favorable to the buyer, subject to the consent required by this Article.' },
    { id: 'x.admission', art: 6, title: 'Admission of New Members', refs: ['admission'], text: 'A person may be admitted as a Member only with {{admission_consent}} and upon signing a joinder to this Agreement. Schedule A shall be updated upon each admission.' },
    { id: 'x.successor', art: 6, title: 'Death or Incapacity of the Member', when: { members: 'single' }, refs: ['dissociation', 'dissolution'], text: '{{successor_text}}' },
    { id: 'x.heirs', art: 6, title: 'Death or Incapacity of a Member', when: { members: 'multi' }, refs: ['dissociation', 'transfer'], text: '{{heirs_text}}' },
    { id: 'w.events', art: 7, title: 'Events of Dissolution', refs: ['dissolution'], text: 'The Company shall be dissolved only upon: (a) the {{dissolution_consent}}; (b) {{no_member_event}}; or (c) the entry of a decree of judicial dissolution or any other event requiring dissolution under the Act.' },
    { id: 'w.winding', art: 7, title: 'Winding Up', refs: ['winding'], text: 'Upon dissolution, {{decision_body}} shall wind up the affairs of the Company, sell or distribute its assets, and apply the proceeds first to the payment of creditors of the Company, including Members who are creditors, then to the establishment of reasonable reserves for contingent liabilities, and finally to the Members in proportion to their Percentage Interests. Upon completion of winding up, the Company shall file the documents required by the Act to terminate its existence.' },
    { id: 'i.exculpation', art: 8, title: 'Exculpation', refs: ['scope'], text: 'To the fullest extent permitted by the Act, no Member{{or_manager}} is liable to the Company or to any other Member for any act or omission performed or omitted in good faith on behalf of the Company, except for acts or omissions involving fraud, bad faith, willful misconduct or a knowing violation of law.' },
    { id: 'i.indemnification', art: 8, title: 'Indemnification', when: { indemnification: 'yes' }, refs: ['indemnification'], text: 'To the fullest extent permitted by the Act, the Company shall indemnify and hold harmless each Member{{or_manager}} from and against any loss, expense (including reasonable attorneys\' fees), judgment or settlement incurred by reason of any act or omission performed in good faith on behalf of the Company, except to the extent arising from fraud, bad faith, willful misconduct or a knowing violation of law. Indemnification is payable only from the assets of the Company, and no Member is personally liable for it.' },
    { id: 'b.fiscal', art: 9, title: 'Fiscal Year', refs: ['scope'], text: 'The fiscal year of the Company {{fiscal_text}}.' },
    { id: 'b.records', art: 9, title: 'Books, Records and Bank Accounts', refs: ['records'], text: 'The Company shall keep complete and accurate books and records, including a current list of Members and Managers, copies of the {{filing}} and of this Agreement and all amendments, and its tax returns for the six (6) most recent years. Each Member may inspect and copy those records during ordinary business hours upon reasonable notice, as provided in the Act. Company funds shall be held in accounts in the name of the Company and shall not be commingled with the funds of any Member.' },
    { id: 'z.entire', art: 10, title: 'Entire Agreement; Amendments', refs: ['scope'], text: 'This Agreement, including Schedule A, is the entire agreement of the {{member_word_pl}} with respect to the Company and supersedes all prior agreements. This Agreement may be amended only by a written instrument signed by {{amend_consent}}.' },
    { id: 'z.law', art: 10, title: 'Governing Law', refs: ['act'], text: 'This Agreement is governed by and construed in accordance with the laws of the State of {{state_name}}, without regard to its conflict of laws rules.' },
    { id: 'z.severability', art: 10, title: 'Severability', refs: ['scope'], text: 'If any provision of this Agreement is held invalid or unenforceable, that provision shall be enforced to the maximum extent permissible and the remaining provisions shall continue in full force and effect.' },
    { id: 'z.binding', art: 10, title: 'Binding Effect', refs: ['scope'], text: 'This Agreement is binding upon and inures to the benefit of the {{member_word_pl}} and their respective heirs, legal representatives, successors and permitted assigns.' },
    { id: 'z.esign', art: 10, title: 'Counterparts and Electronic Signatures', refs: ['fed.esign', 'ueta'], text: 'This Agreement may be signed in counterparts, each of which is an original and all of which together are one instrument. Electronic signatures and electronically signed copies have the same force and effect as original signatures under the Electronic Signatures in Global and National Commerce Act and the electronic transactions law of the State of {{state_name}}.' }
  ];
  var ARTICLES = { 1: 'FORMATION', 2: 'MEMBERS AND CAPITAL', 3: 'MANAGEMENT', 4: 'ALLOCATIONS AND DISTRIBUTIONS', 5: 'TAX MATTERS', 6: 'TRANSFERS AND ADMISSION', 7: 'DISSOLUTION AND WINDING UP', 8: 'EXCULPATION AND INDEMNIFICATION', 9: 'BOOKS, RECORDS AND FISCAL YEAR', 10: 'GENERAL PROVISIONS' };
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  /* ---------------- helpers ---------------- */
  function members(a) { return Array.isArray(a && a.members) ? a.members.filter(function (m) { return m && String(m.name || '').trim(); }) : []; }
  function facts(a) {
    var ms = members(a);
    return { members: ms.length > 1 ? 'multi' : 'single', management: a.management, tax: a.tax, transfer: a.transfer, indemnification: a.indemnification, foreign: ms.some(function (m) { return m.us_person === 'no'; }) };
  }
  function applies(when, f) { if (!when) return true; return Object.keys(when).every(function (k) { return when[k] === f[k]; }); }
  function visibleQuestions(rs, a) { var f = facts(a || {}); return rs.questions.filter(function (q) { return applies(q.when, f); }); }
  function pct(n) { var x = Math.round(Number(n) * 100) / 100; return (x % 1 ? x.toFixed(2).replace(/0$/, '') : String(x)) + '%'; }
  function money(v) { var n = Number(String(v || '').replace(/[^0-9.]/g, '')); return n ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) : null; }
  function list(names) { return names.length < 2 ? names.join('') : names.length === 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; }
  function longDate(d) { if (!d) return ''; var p = String(d).slice(0, 10).split('-'); var M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; return M[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  function normName(s) { return String(s || '').toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').replace(/LIMITED LIABILITY COMPANY|L L C/g, 'LLC').trim(); }

  /* ---------------- rule set for a state (what is stored in oa_rule_sets.content) ---------------- */
  function buildRuleSet(state) {
    var S = STATES[state]; if (!S) return null;
    var resolve = function (k) { if (k === 'ueta') return S.ueta; if (k.indexOf('fed.') === 0) return FED[k.slice(4)]; return S.refs[k]; };
    return {
      version: VERSION, state: state, state_name: S.name, act: S.act, filing: S.filing, office: S.office, articles: ARTICLES,
      agreement_term: S.agreement_term || null, continuation: S.continuation || null, no_member_event: S.no_member_event || null,
      sections: SECTIONS,
      questions: Q.map(function (q) { var o = JSON.parse(JSON.stringify(q)); o.note = q.notes ? (q.notes[state] || null) : null; o.notes_extra = q.notes && q.notes.foreign ? { foreign: q.notes.foreign } : undefined; o.notes_other = q.notes && q.notes.other ? q.notes.other : undefined; delete o.notes; return o; }),
      clauses: C.map(function (c) { return { id: c.id, art: c.art, title: c.title, when: c.when || null, text: c.text, refs: c.refs.map(resolve).filter(Boolean) }; })
    };
  }

  /* ---------------- validation ---------------- */
  // returns { missing: [qid], errors: [{q, code}], review: [{q, code, detail}] }
  function evaluate(rs, a, prefill) {
    a = a || {}; prefill = prefill || {};
    var out = { missing: [], errors: [], review: [] };
    visibleQuestions(rs, a).forEach(function (q) {
      var v = a[q.id];
      if (q.type === 'members') {
        var ms = members(a);
        if (!ms.length) return out.missing.push(q.id);
        var total = ms.reduce(function (s, m) { return s + (Number(m.pct) || 0); }, 0);
        if (Math.abs(total - 100) > 0.01) out.errors.push({ q: q.id, code: 'pct_total', detail: pct(total) });
        if (ms.some(function (m) { return !(Number(m.pct) > 0); })) out.errors.push({ q: q.id, code: 'pct_zero' });
        if (ms.some(function (m) { return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(m.email || '')); })) out.errors.push({ q: q.id, code: 'email' });
        if (ms.some(function (m) { return m.us_person !== 'yes' && m.us_person !== 'no'; })) out.missing.push(q.id + '.us_person');
        if (ms.some(function (m) { return !String(m.contribution || '').trim(); })) out.missing.push(q.id + '.contribution');
        var em = ms.map(function (m) { return String(m.email || '').toLowerCase(); }); if (em.some(function (e, i) { return e && em.indexOf(e) !== i; })) out.errors.push({ q: q.id, code: 'email_dup' });
        return;
      }
      if (q.type === 'managers') {
        var mg = (Array.isArray(v) ? v : []).filter(function (m) { return m && String(m.name || '').trim(); });
        if (!mg.length) return out.missing.push(q.id);
        if (mg.some(function (m) { return !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(m.email || '')); })) out.errors.push({ q: q.id, code: 'email' });
        return;
      }
      var empty = v == null || String(v).trim() === '';
      if (empty) { if (q.essential) out.missing.push(q.id); return; }
      if (q.detail && v === q.detail.when && !String(a[q.id + '_detail'] || '').trim()) out.missing.push(q.id + '_detail');
      if (v === 'unsure') out.review.push({ q: q.id, code: 'client_unsure' });
    });
    if (a.fiscal_year === 'other' && a.fiscal_year_detail && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(a.fiscal_year_detail)) out.errors.push({ q: 'fiscal_year', code: 'format' });
    // conflicts with the Articles / state records (prefill) and with federal rules
    if (prefill.legal_name && a.legal_name && normName(prefill.legal_name) !== normName(a.legal_name)) out.review.push({ q: 'legal_name', code: 'differs_from_articles', detail: prefill.legal_name });
    if (prefill.state && a.state && prefill.state !== a.state) out.review.push({ q: 'state', code: 'differs_from_articles', detail: prefill.state });
    if (prefill.management && a.management && a.management !== 'unsure' && prefill.management !== a.management) out.review.push({ q: 'management', code: 'differs_from_articles', detail: prefill.management });
    if (a.state === 'other') out.review.push({ q: 'state', code: 'no_approved_rules' });
    if (a.tax === 's_corp' && members(a).some(function (m) { return m.us_person === 'no'; })) out.review.push({ q: 'tax', code: 's_corp_foreign_member' });
    if (a.tax === 'c_corp') out.review.push({ q: 'tax', code: 'c_corp_election' });
    if (a.purpose === 'specific') out.review.push({ q: 'purpose', code: 'specific_purpose' });
    return out;
  }

  /* ---------------- composition ---------------- */
  function vars(rs, a, company) {
    var ms = members(a), single = ms.length < 2, mgr = a.management === 'manager';
    var mg = (a.managers || []).filter(function (m) { return m && String(m.name || '').trim(); });
    var majority = a.voting === 'unanimous' ? 'all of the Members' : 'Members holding more than fifty percent (50%) of the Percentage Interests (a "Majority Interest")';
    var membersConsent = single ? 'the Member' : 'Members holding a Majority Interest';
    var major = a.major === 'supermajority' ? 'Members holding at least two-thirds (2/3) of the Percentage Interests' : 'all of the Members';
    var decision = mgr ? (mg.length > 1 ? 'the Managers' : 'the Manager') : single ? 'the Member' : 'the Members';
    var foreign = ms.some(function (m) { return m.us_person === 'no'; });
    var tax = a.tax === 's_corp' ? 'The Company intends to be classified as an association taxable as a corporation that elects to be treated as an S corporation, as provided in Section 5.2.'
      : a.tax === 'c_corp' ? 'The Company shall elect to be classified as an association taxable as a corporation for federal income tax purposes under Treasury Regulations Section 301.7701-3.'
      : single ? 'The Company is intended to be disregarded as an entity separate from its sole Member for federal income tax purposes under Treasury Regulations Section 301.7701-3, unless the Member causes the Company to elect otherwise.'
      : 'The Company is intended to be classified as a partnership for federal income tax purposes under Treasury Regulations Section 301.7701-3, unless the Members, by the vote required for Major Decisions, cause the Company to elect otherwise.';
    var continuation = rs.continuation || 'ninety (90) days';
    var top = ms.slice().sort(function (x, y) { return (Number(y.pct) || 0) - (Number(x.pct) || 0); })[0] || {};
    var S = { company: (a.legal_name || company.legal_name || '').trim(), state_name: rs.state_name, act: rs.act, filing: rs.filing, office: rs.office,
      filing_date_phrase: a.formation_date ? ' on ' + longDate(a.formation_date) : '', filing_number_phrase: a.filing_number ? ' under document number ' + String(a.filing_number).trim() : '',
      purpose_text: a.purpose === 'specific' && a.purpose_detail ? String(a.purpose_detail).trim().replace(/\.$/, '') + ', and any lawful activity related to it' : purposeText(rs, a.purpose) || 'to engage in any lawful business, purpose or activity for which limited liability companies may be formed under the Act',
      principal_address: String(a.principal_address || '').trim(), registered_agent: String(a.registered_agent || '').trim(), decision_body: decision,
      member_word_pl: single ? 'Member' : 'Members', or_manager: mgr ? ' or Manager' : '',
      voting_text: majority, major_text: major, members_consent: membersConsent,
      managers_phrase: list(mg.map(function (m) { return m.name.trim(); })), managers_s: mg.length > 1 ? 's' : '', managers_def: mg.length > 1 ? 'each, a "Manager"' : 'the "Manager"', has_have: mg.length > 1 ? 'have' : 'has',
      signing_authority: mgr ? 'any Manager' : single ? 'the Member' : 'any Member',
      single_alloc: single ? ' (all of which are allocated to the sole Member)' : '',
      tax_dist: a.distributions === 'tax' && !single ? ' To the extent of available cash, the Company shall distribute to each Member, no later than the due date of each quarterly estimated tax payment, an amount reasonably estimated to cover the federal and state income tax attributable to the Company income allocated to that Member, and any such distribution is treated as an advance against other distributions.' : '',
      tax_text: tax, pr_name: (top.name || '').trim() || 'the Member holding the largest Percentage Interest',
      transfer_consent: single ? 'the written consent of the Member' : a.transfer === 'rofr' ? 'complying with the right of first refusal in this Article and obtaining the written consent of ' + major : 'the written consent of ' + major,
      admission_consent: single ? 'the written consent of the Member' : 'the written consent of ' + major,
      successor_text: a.successor && String(a.successor).trim() ? 'Upon the death or adjudicated incapacity of the sole Member, ' + String(a.successor).trim() + ' (or, if that person does not survive or declines, the Member\'s legal representative) shall be admitted as a Member, effective as of the event, so that the Company continues without dissolution. The Member may change this designation at any time by a signed writing delivered to the Company.'
        : 'Upon the death or adjudicated incapacity of the sole Member, the Member\'s legal representative or successor in interest may, within ' + continuation + ', agree in writing to continue the Company and to be admitted as a Member, effective as of the event, so that the Company continues without dissolution.',
      heirs_text: a.heirs === 'admitted' ? 'Upon the death or adjudicated incapacity of a Member, the Member\'s interest passes to the Member\'s heirs or legal representative, who may be admitted as Members with the approval required for Major Decisions (excluding the interest of the affected Member). Until admitted, they hold the rights of a transferee only.'
        : 'Upon the death or adjudicated incapacity of a Member, the Member\'s heirs or legal representative hold only the rights of a transferee to receive distributions and do not become Members, do not vote and do not participate in management, unless admitted under Section 6.' + (a.transfer === 'rofr' ? '3' : '2') + '. The remaining Members shall continue the Company.',
      dissolution_consent: single ? 'written consent of the Member' : 'approval of the Members required for Major Decisions',
      amend_consent: single ? 'the Member' : 'all of the Members',
      fiscal_text: a.fiscal_year === 'other' && a.fiscal_year_detail ? 'ends on the ' + longDate('2000-' + a.fiscal_year_detail).replace(/, 2000$/, '') + ' of each year, unless otherwise required by the Internal Revenue Code' : 'is the calendar year, unless otherwise required by the Internal Revenue Code',
      art_dissolution: 'VII', foreign: foreign,
      no_member_event: rs.no_member_event || 'the passage of ninety (90) consecutive days during which the Company has no Members, unless the Company is continued as permitted by the Act' };
    return S;
  }
  // approved clause wording of the chosen purpose (kept in the rule set, so it is versioned and approved with it)
  function purposeText(rs, val) { var q = (rs.questions || []).find(function (x) { return x.id === 'purpose'; }); var o = q && (q.options || []).find(function (x) { return x[0] === val; }); return o && o[2] ? o[2] : null; }
  function fill(text, v) { return String(text).replace(/\{\{(\w+)\}\}/g, function (m, k) { return v[k] == null ? m : v[k]; }); }
  // Model draft: every applicable approved clause, filled with the answers (the baseline the AI tailors and the reviewer compares against)
  function compose(rs, a, company) {
    var v = vars(rs, a, company), f = facts(a);
    var cl = rs.clauses.filter(function (c) { return applies(c.when, f); });
    var arts = {}; cl.forEach(function (c) { (arts[c.art] = arts[c.art] || []).push(c); });
    var keys = Object.keys(arts).map(Number).sort(function (x, y) { return x - y; });
    var articles = keys.map(function (k, i) {
      return { num: ROMAN[i + 1], title: rs.articles[k], sections: arts[k].map(function (c, j) { return { num: (i + 1) + '.' + (j + 1), rule: c.id, title: c.title, text: fill(c.text, v), model: fill(c.text, v), refs: c.refs }; }) };
    });
    // section numbers referenced inside texts
    var find = function (id) { var s = null; articles.forEach(function (ar) { ar.sections.forEach(function (x) { if (x.rule === id) s = x.num; }); }); return s; };
    articles.forEach(function (ar) { ar.sections.forEach(function (x) {
      var fix = function (t) { return t.replace('as provided in Section 5.2', find('t.scorp') ? 'as provided in Section ' + find('t.scorp') : 'as provided in this Article').replace(/admitted under Section 6\.[23]/, 'admitted under Section ' + (find('x.admission') || '6.2')).replace('Article VII', 'Article ' + (articles.filter(function (q) { return q.title === rs.articles[7]; })[0] || { num: 'VII' }).num); };
      x.text = fix(x.text); x.model = fix(x.model);
    }); });
    var ms = members(a), mg = a.management === 'manager' ? (a.managers || []).filter(function (m) { return m && String(m.name || '').trim(); }) : [];
    return {
      title: 'OPERATING AGREEMENT', company: v.company, subtitle: 'A ' + rs.state_name + ' Limited Liability Company' + (rs.agreement_term ? ' (' + rs.agreement_term.charAt(0).toUpperCase() + rs.agreement_term.slice(1).replace(/ a/g, ' A') + ')' : ''),
      effective: a.formation_date || null, effective_text: a.formation_date ? longDate(a.formation_date) : null,
      intro: 'This Operating Agreement (this "Agreement"' + (rs.agreement_term ? ', which constitutes the ' + rs.agreement_term + ' of the Company under the Act' : '') + ') of ' + v.company + ' is made and entered into' + (a.formation_date ? ' effective as of ' + longDate(a.formation_date) : '') + ' by ' + (ms.length > 1 ? 'the persons listed on Schedule A as Members (each, a "Member" and together, the "Members")' : 'the person listed on Schedule A as the sole member (the "Member")') + '. ' + (ms.length > 1 ? 'The Members agree' : 'The Member agrees') + ' as follows:',
      definitions: [['Capital Contribution', 'the money or property contributed to the Company by a Member, as shown on Schedule A.'], ['Percentage Interest', 'the percentage of ownership of a Member in the Company, as shown on Schedule A.']],
      articles: articles,
      schedule: ms.map(function (m) { return { name: m.name.trim(), contribution: money(m.contribution) || String(m.contribution || '').trim(), pct: pct(m.pct) }; }),
      signers: signers(a),
      state: rs.state, rules_version: rs.version, single: ms.length < 2, managers: mg.map(function (m) { return m.name.trim(); })
    };
  }
  // everyone who must sign: each member; managers who are not members
  function signers(a) {
    var ms = members(a), mgr = a.management === 'manager';
    var mg = mgr ? (a.managers || []).filter(function (m) { return m && String(m.name || '').trim(); }) : [];
    var out = ms.map(function (m) {
      var asMgr = mg.some(function (x) { return String(x.email || '').toLowerCase() === String(m.email || '').toLowerCase() || normName(x.name) === normName(m.name); });
      return { name: m.name.trim(), email: String(m.email || '').trim().toLowerCase(), capacity: ms.length > 1 ? (asMgr ? 'Member and Manager' : 'Member') : (asMgr ? 'Sole Member and Manager' : 'Sole Member') };
    });
    mg.forEach(function (x) { if (!out.some(function (o) { return o.email === String(x.email || '').trim().toLowerCase() || normName(o.name) === normName(x.name); })) out.push({ name: x.name.trim(), email: String(x.email || '').trim().toLowerCase(), capacity: 'Manager' }); });
    return out;
  }

  // check an AI draft against the model: same clause set, required facts present, no leftover placeholders
  function checkDraft(model, draft) {
    var issues = [];
    var mm = {}; model.articles.forEach(function (ar) { ar.sections.forEach(function (s) { mm[s.rule] = s; }); });
    var seen = {};
    (draft.articles || []).forEach(function (ar) { (ar.sections || []).forEach(function (s) {
      if (!mm[s.rule]) issues.push({ code: 'unknown_rule', rule: s.rule });
      if (seen[s.rule]) issues.push({ code: 'duplicate_rule', rule: s.rule });
      seen[s.rule] = true;
      var m = mm[s.rule]; if (!m) return;
      var t = String(s.text || '');
      if (/\{\{|\}\}|\[[A-Z _]+\]/.test(t)) issues.push({ code: 'placeholder', rule: s.rule });
      var r = t.length / Math.max(1, m.text.length);
      if (r < 0.5 || r > 2.5) issues.push({ code: 'length', rule: s.rule, detail: Math.round(r * 100) + '%' });
      // names, percentages, numbers and state-specific terms of the model must survive
      var must = (m.text.match(/\(\d+\)|\d+(?:\.\d+)?%|\$[\d,.]+|Section [\d.]+/g) || []).concat([model.company]).filter(function (x) { return m.text.indexOf(x) > -1; });
      must.forEach(function (x) { if (t.indexOf(x) < 0) issues.push({ code: 'missing_term', rule: s.rule, detail: x }); });
    }); });
    Object.keys(mm).forEach(function (k) { if (!seen[k]) issues.push({ code: 'missing_rule', rule: k }); });
    return issues;
  }

  G.EOARules = { VERSION: VERSION, STATES: STATES, FED: FED, buildRuleSet: buildRuleSet, evaluate: evaluate, compose: compose, signers: signers, checkDraft: checkDraft,
    visibleQuestions: visibleQuestions, facts: facts, members: members, longDate: longDate, normName: normName };
})(typeof globalThis !== 'undefined' ? globalThis : window);
