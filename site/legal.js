'use strict';
/* Conteúdo das páginas legais e de ajuda.
   Cada secção: [título, [parágrafo | ['item', 'item']]]. Um array dentro da lista é uma lista de pontos. */
const LEGAL_UPDATED = '23 de novembro de 2026';

const DOCS = {
  termos: {
    icon: 'scroll', title: 'Termos de Uso',
    intro: 'Estes termos regulam o uso do Aquipay. Ao criar uma conta ou usar a aplicação, aceitas estas condições.',
    sections: [
      ['1. O que é o Aquipay', ['O Aquipay é uma plataforma que aproxima quem oferece trabalhos, serviços e empregos de quem procura oportunidades. O Aquipay não é empregador, agência de recrutamento nem parte nos acordos feitos entre utilizadores.']],
      ['2. Conta e elegibilidade', [['Tens de ter pelo menos 18 anos para criar uma conta.', 'As informações que forneces devem ser verdadeiras e atualizadas.', 'És responsável pela segurança da tua palavra-passe e por tudo o que acontece na tua conta.', 'Cada pessoa pode ter uma única conta.']]],
      ['3. Anúncios e candidaturas', ['Quem publica um anúncio deve descrever o trabalho com clareza: tarefa, local, valor e condições. Quem se candidata deve fazê-lo de boa-fé e cumprir o que combinar.', 'O Aquipay pode remover anúncios que sejam enganosos, ilegais ou que violem as Regras da Comunidade.']],
      ['4. Pagamentos entre utilizadores', ['O pagamento de um trabalho é combinado e feito diretamente entre as partes, fora do Aquipay. A aplicação regista apenas a confirmação de quem recebeu ou não o pagamento, para construir o histórico de cada perfil.', 'O Aquipay não garante o pagamento nem a qualidade de qualquer trabalho.']],
      ['5. Perfis verificados e classificações', ['O selo de verificado indica que a conta passou pelo processo de verificação do Aquipay. Não é uma garantia de pagamento, de qualidade ou de comportamento futuro.', 'As classificações só podem ser feitas depois de uma interação concluída e devem refletir a experiência real. Avaliações falsas ou combinadas levam à suspensão da conta.']],
      ['6. Moedas e plano Plus', ['Algumas ações, como candidaturas adicionais no mesmo dia, consomem moedas. O plano Plus permite candidaturas sem gastar moedas durante o período ativo. As regras de compra, cancelamento e devolução estão na página Pagamentos e Reembolsos.']],
      ['7. Conteúdo que publicas', ['Manténs a propriedade do que publicas (textos, fotografias, documentos). Dás ao Aquipay a licença necessária para o mostrar na aplicação, no âmbito do serviço. Só podes publicar conteúdo que tenhas o direito de usar.']],
      ['8. Condutas proibidas', [['Fraude, burla ou pedidos de pagamento adiantado para conceder um trabalho.', 'Assédio, ameaças, discriminação ou conteúdo ofensivo.', 'Publicar trabalhos ilegais ou que envolvam exploração de pessoas.', 'Criar contas falsas, copiar perfis ou recolher dados de outros utilizadores.', 'Tentar aceder a áreas do serviço sem autorização ou prejudicar o seu funcionamento.']]],
      ['9. Suspensão e encerramento', ['Podemos limitar, suspender ou encerrar contas que violem estes termos. Podes encerrar a tua conta a qualquer momento, através do pedido de eliminação nas Definições.']],
      ['10. Responsabilidade', ['Fazemos o possível para manter o serviço estável e seguro, mas ele é prestado tal como está disponível. Na medida permitida pela lei, o Aquipay não responde por prejuízos resultantes de acordos feitos entre utilizadores, nem por indisponibilidades fora do nosso controlo.']],
      ['11. Alterações', ['Podemos atualizar estes termos. Quando a alteração for relevante, avisamos na aplicação antes de entrar em vigor. Continuar a usar o Aquipay depois disso significa que aceitas a nova versão.']],
      ['12. Lei aplicável', ['Estes termos regem-se pela lei da República de Angola. Os litígios serão resolvidos nos tribunais competentes de Luanda, sem prejuízo dos direitos que a lei reconhece aos consumidores.']],\n      ['13. Contacto', ['Para apoio geral, problemas técnicos ou questões sobre estes termos, escreve para {{SUPPORT_EMAIL}}. Para propostas comerciais e parcerias, utiliza {{PARTNERSHIP_EMAIL}}.']]
    ]
  },

  privacidade: {
    icon: 'lock', title: 'Política de Privacidade',
    intro: 'Explicamos que dados recolhemos, para que os usamos e que direitos tens. Tratamos os dados pessoais de acordo com a Lei n.º 22/11, de 17 de Junho, da Protecção de Dados Pessoais de Angola.',
    sections: [
      ['1. Dados que recolhemos', [['Conta: nome, email e palavra-passe (guardada de forma cifrada). Se entrares com Google, recebemos o teu nome e email da tua conta Google.', 'Perfil: cidade, telefone, biografia, profissões, competências, experiência, formação e portefólio, conforme preencheres.', 'Documentos e fotografias que enviares, como CV, certificados e imagens dos anúncios.', 'Atividade: anúncios, candidaturas, classificações e confirmações de pagamento.', 'Dados técnicos básicos necessários ao funcionamento e à segurança do serviço.']]],
      ['2. Para que usamos os dados', [['Criar e gerir a tua conta e o teu perfil.', 'Mostrar anúncios e perfis a quem os procura.', 'Calcular o histórico de pagamentos e as classificações de cada perfil.', 'Enviar avisos sobre candidaturas, pagamentos e segurança da conta.', 'Prevenir fraude e abusos, e cumprir obrigações legais.']]],
      ['3. O que é público', ['Se o teu perfil estiver público, outras pessoas veem o teu nome, cidade, biografia, profissões, competências, classificações e os documentos que marcares como visíveis. O telefone e o email nunca aparecem no perfil público. Podes tornar o perfil privado nas Definições.']],
      ['4. Com quem partilhamos', ['Não vendemos os teus dados. Partilhamos apenas com prestadores que tornam o serviço possível, nos limites necessários:', ['Cloudflare, para alojamento, armazenamento e segurança.', 'Google, apenas se escolheres entrar com Google.', 'Processador de pagamentos, quando comprares moedas ou o plano Plus.'], 'Podemos ainda divulgar dados quando a lei o exigir ou por decisão de uma autoridade competente.']],
      ['5. Quanto tempo guardamos', ['Quando pedes a eliminação da conta, desativamos o acesso e ocultamos o teu perfil e anúncios imediatamente. A eliminação permanente dos dados é agendada para 30 dias depois do pedido. Podes cancelar o pedido ao iniciar sessão na aplicação durante esse prazo. No fim dos 30 dias, apagamos permanentemente os dados pessoais, exceto os dados que formos obrigados a conservar por lei.']],
      ['6. Os teus direitos', [['Aceder aos dados que temos sobre ti e obter uma cópia (Definições, Exportar os meus dados).', 'Corrigir dados incorretos (Editar perfil).', 'Pedir a eliminação da conta e dos dados na aplicação ou em https://aquipay.isabstudio.dev/delete-account.html.', 'Opor-te a certos tratamentos e retirar consentimentos dados.', 'Apresentar reclamação à Agência de Protecção de Dados de Angola.']]],
      ['7. Segurança', ['Usamos ligação cifrada, controlo de acesso e armazenamento protegido. Nenhum sistema é infalível; se ocorrer um incidente que afete os teus dados, avisamos-te e às autoridades, conforme a lei.']],
      ['8. Menores', ['O Aquipay destina-se a maiores de 18 anos. Se descobrirmos uma conta de menor, encerramo-la e apagamos os dados.']],
      ['9. Contacto e pedidos de privacidade', ['Para exercer os teus direitos, pedir acesso, correção ou eliminação de dados, ou esclarecer dúvidas sobre esta política, escreve diretamente para {{PRIVACY_EMAIL}}. Para apoio técnico relacionado com a conta, utiliza {{SUPPORT_EMAIL}}.']]
    ]
  },

  reembolso: {
    icon: 'receipt', title: 'Pagamentos e Reembolsos',
    intro: 'Como funcionam as moedas e o plano Plus, e em que casos devolvemos o dinheiro.',
    sections: [
      ['1. Moedas', [['As moedas são compradas em pacotes e usadas dentro do Aquipay, por exemplo em candidaturas adicionais.', 'Não têm valor em dinheiro e não podem ser transferidas, vendidas ou levantadas.', 'As moedas de boas-vindas e de bónus não são reembolsáveis.']]],
      ['2. Reembolso de moedas', [['Moedas compradas e ainda não usadas podem ser devolvidas se o pedido for feito até 7 dias após a compra.', 'Moedas já gastas não são reembolsadas.', 'Se um anúncio a que te candidataste for removido por violar as regras, devolvemos as moedas gastas nessa candidatura.']]],
      ['3. Plano Plus', [['O plano renova-se mensalmente até o cancelares.', 'Podes cancelar a qualquer momento e manténs o acesso até ao fim do período já pago.', 'Não fazemos reembolso parcial de períodos em curso, exceto em caso de cobrança indevida ou falha do serviço da nossa parte.']]],
      ['4. Cobranças indevidas', ['Se fores cobrado duas vezes, ou se pagares e não receberes as moedas ou o plano, devolvemos o valor na totalidade ou corrigimos a situação, conforme preferires.']],
      ['5. Como pedir um reembolso', ['Envia o pedido para {{ACCOUNTS_EMAIL}}, indicando o email associado à conta Aquipay, a data da compra, o valor, o pacote ou plano adquirido e o comprovativo ou referência da transação. Não envies palavras-passe, códigos de autenticação ou dados completos do cartão.', 'A equipa de Contas analisa o pedido e responde em até 5 dias úteis. Quando aprovado, o reembolso é processado pelo mesmo meio de pagamento, sempre que possível, ou corrigimos a cobrança indevida.', 'Se a compra tiver sido processada por uma loja de aplicações ou prestador externo, o pedido também poderá ter de ser apresentado através desse canal e ficará sujeito às respetivas regras, sem prejuízo dos direitos obrigatórios previstos na lei aplicável.', 'Para questões técnicas de acesso à conta, contacta {{SUPPORT_EMAIL}}.']],
      ['6. Pagamentos de trabalhos', ['O dinheiro de um trabalho é pago diretamente entre as partes e não passa pelo Aquipay. Por isso, o Aquipay não reembolsa nem cobra valores de trabalhos. Em caso de desacordo, podes denunciar o perfil e deixar uma classificação.']]
    ]
  },

  conduta: {
    icon: 'shield', title: 'Regras da Comunidade',
    intro: 'O Aquipay funciona quando as pessoas confiam umas nas outras. Estas regras protegem toda a gente.',
    sections: [
      ['Sê honesto', [['Descreve os trabalhos, os valores e as condições como realmente são.', 'Usa a tua identidade real e mantém o perfil atualizado.', 'Avalia com sinceridade, só depois de uma interação concluída.']]],
      ['Respeita os outros', [['Sem insultos, assédio, ameaças ou discriminação.', 'Não partilhes dados de outras pessoas sem autorização.']]],
      ['Não é permitido', [['Pedir pagamento antecipado, taxas de inscrição ou depósitos para dar um trabalho.', 'Publicar ofertas falsas, repetidas ou enganosas.', 'Anunciar trabalhos ilegais ou perigosos.', 'Contornar a plataforma para burlar utilizadores.']]],
      ['O que acontece se violares', ['Podemos remover conteúdo, limitar funcionalidades, suspender ou encerrar a conta, consoante a gravidade e a reincidência.']],
      ['Denunciar', ['Se vires algo que viole estas regras, envia a denúncia para {{REPORT_EMAIL}}, indicando o perfil ou o anúncio em causa, a data e uma descrição do sucedido. Também podes usar a função Denunciar dentro da aplicação.']]
    ]
  },

  seguranca: {
    icon: 'shield', title: 'Dicas de Segurança',
    intro: 'Cuidados simples para proteger o teu dinheiro e os teus dados.',
    sections: [
      ['Antes de aceitar um trabalho', [['Vê o perfil de quem oferece: se está verificado e qual é o histórico de pagamentos.', 'Desconfia de ofertas com ganhos demasiado bons para a tarefa pedida.', 'Combina por escrito o valor, o prazo e a forma de pagamento.']]],
      ['Sinais de burla', [['Pedem dinheiro adiantado para te dar o trabalho.', 'Pedem fotografia de documentos, códigos ou dados do banco.', 'Pressionam para decidires depressa ou para sair da aplicação.']]],
      ['Encontros presenciais', [['Marca em locais públicos, de dia, sempre que possível.', 'Avisa alguém de confiança do local e da hora.']]],
      ['A tua conta', [['Usa uma palavra-passe longa e que não uses noutros sítios.', 'Nunca partilhes a palavra-passe. O Aquipay nunca a pede.', 'Termina a sessão em dispositivos que não são teus.']]],
      ['Aconteceu algo?', ['Guarda as mensagens e comprovativos e denuncia o perfil através da aplicação ou escreve para {{REPORT_EMAIL}}. Se o problema envolver acesso ou segurança da tua conta, contacta também {{SUPPORT_EMAIL}}.']]
    ]
  },

  cookies: {
    icon: 'cookie', title: 'Cookies e Armazenamento',
    intro: 'Como o Aquipay guarda informação no teu dispositivo.',
    sections: [
      ['O que guardamos no dispositivo', [['A tua sessão, para não teres de iniciar sessão sempre que abres a aplicação.', 'As tuas definições, como tema, tamanho e tipo de letra.', 'Cópias de dados e ficheiros da aplicação, para que ela abra mais depressa e funcione com pouca ligação.']]],
      ['Cookies de publicidade', ['Não usamos cookies de publicidade nem de seguimento entre sites.']],
      ['Google', ['Se escolheres entrar com Google, a Google pode usar cookies próprios durante o início de sessão, segundo a política dela.']],
      ['Como limpar', ['Em Definições, Limpar dados deste dispositivo, apagas tudo o que a aplicação guardou localmente. Terás de iniciar sessão novamente.']],\n      ['Dúvidas sobre privacidade', ['Para questões sobre dados pessoais, escreve para {{PRIVACY_EMAIL}}.']]
    ]
  },

  ajuda: {
    icon: 'help', title: 'Ajuda e Contacto',
    intro: 'Respostas às dúvidas mais comuns e como falar connosco.',
    sections: [
      ['Como me candidato a um trabalho?', ['Abre o anúncio, vê o perfil de quem o publicou e toca em Enviar candidatura. A primeira candidatura do dia não gasta moedas.']],
      ['Como publico um anúncio?', ['No ecrã inicial, toca no botão de adicionar, preenche o título, o tipo, o valor e a localização, junta até 4 fotografias e publica.']],
      ['O que significa o selo de verificado?', ['A conta passou pelo processo de verificação do Aquipay. Para pedir, vai a Perfil e toca em Pedir verificação.']],
      ['Como funciona o histórico de pagamentos?', ['Quando um trabalho é concluído, quem trabalhou confirma se recebeu ou não o pagamento. Essas confirmações formam o histórico visível no perfil de quem paga.']],
      ['Como altero ou apago a minha conta?', ['Altera os dados em Perfil. Para apagar, vai a Definições e usa Pedir eliminação da conta.']],
      ['Apoio ao utilizador', ['Dúvidas gerais, problemas técnicos ou dificuldades com a conta: {{SUPPORT_EMAIL}}.']],\n      ['Pagamentos e contas', ['Compras, moedas, plano Plus, cobranças e reembolsos: {{ACCOUNTS_EMAIL}}.']],\n      ['Privacidade e dados pessoais', ['Pedidos sobre os teus dados pessoais: {{PRIVACY_EMAIL}}.']],\n      ['Denúncias e segurança', ['Fraude, abuso, assédio ou conteúdos indevidos: {{REPORT_EMAIL}}.']],\n      ['Parcerias', ['Propostas comerciais e parcerias: {{PARTNERSHIP_EMAIL}}.']]
    ]
  },

  sobre: {
    icon: 'info', title: 'Sobre o Aquipay',
    intro: 'Trabalhos e oportunidades perto de ti.',
    sections: [
      ['A nossa missão', ['Tornar mais simples e mais seguro encontrar trabalho e contratar serviços em Angola, com perfis transparentes e um histórico de pagamentos que se vê antes de aceitar.']],
      ['O que podes fazer', [['Publicar trabalhos, serviços e empregos com fotografias.', 'Candidatar-te vendo antes quem está do outro lado.', 'Construir um perfil com experiência, formação e portefólio.', 'Receber classificações depois de cada trabalho concluído.']]],
      ['Parcerias e contacto', ['Para propostas comerciais e parcerias, escreve para {{PARTNERSHIP_EMAIL}}. Para apoio geral, contacta {{SUPPORT_EMAIL}}.']],\n      ['Versão', ['Aquipay {{VERSION}}']]
    ]
  }
};

const DOC_ORDER = [
  ['Legal', ['termos', 'privacidade', 'reembolso', 'cookies']],
  ['Comunidade e segurança', ['conduta', 'seguranca']],
  ['Apoio', ['ajuda', 'sobre']]
];

function docHtml(id) {
  const d = DOCS[id];
  if (!d) return '';
  const mail = (typeof CFG !== 'undefined' && CFG.supportEmail) || '';
  const ver = (typeof APP_VERSION !== 'undefined' && APP_VERSION) || '';
  const CONTACTS = {
    '{{SUPPORT_EMAIL}}': 'suporte@isabstudio.dev',
    '{{PARTNERSHIP_EMAIL}}': 'parceria@isabstudio.dev',
    '{{PRIVACY_EMAIL}}': 'privacidade@isabstudio.dev',
    '{{ACCOUNTS_EMAIL}}': 'contas@isabstudio.dev',
    '{{REPORT_EMAIL}}': 'denuncia@isabstudio.dev'
  };
  const fill = t => Object.entries(CONTACTS).reduce((value, [token, address]) => value.replaceAll(token, address), t).replace('{{VERSION}}', ver);
  const esc2 = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const body = d.sections.map(([t, parts]) =>
    '<h3>' + esc2(t) + '</h3>' + parts.map(p => Array.isArray(p) ? '<ul>' + p.map(li => '<li>' + esc2(li) + '</li>').join('') + '</ul>' : '<p>' + esc2(fill(p)).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, email => '<a class="link" href="mailto:' + email + '">' + email + '</a>') + '</p>').join('')
  ).join('');
  const upd = ['sobre', 'ajuda'].includes(id) ? '' : '<p class="upd">Atualizado em ' + LEGAL_UPDATED + '</p>';
  const cta = id === 'ajuda' ? '<div class="stack"><a class="btn" href="mailto:suporte@isabstudio.dev">Contactar suporte</a><a class="btn secondary" href="mailto:contas@isabstudio.dev">Pagamentos e reembolsos</a><a class="btn secondary" href="mailto:privacidade@isabstudio.dev">Privacidade</a><a class="btn secondary" href="mailto:denuncia@isabstudio.dev">Fazer denúncia</a><a class="btn secondary" href="mailto:parceria@isabstudio.dev">Parcerias</a></div>' : '';
  return '<article class="doc"><h1>' + esc2(d.title) + '</h1>' + upd + '<p>' + esc2(d.intro) + '</p>' + body + cta + '</article>';
}
