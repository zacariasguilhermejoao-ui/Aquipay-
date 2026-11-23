'use strict';
/* Idiomas do Aquipay: PT (original), EN, FR e 中文.
   O texto-fonte do código está em português; cada linha de DICT é [pt, en, fr, zh].
   - T(texto, params) traduz um texto (tabela exata; depois padrões com dados variáveis).
   - Um MutationObserver traduz o que a app escreve no ecrã (títulos, botões, avisos, erros),
     no mesmo instante em que entra no DOM, antes de o browser desenhar. */
const LANGS = [['pt', 'PT', 'Português'], ['en', 'EN', 'English'], ['fr', 'FR', 'Français'], ['zh', '中文', '中文']];
const LOCALES = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', zh: 'zh-CN' };
const GOOGLE_LOCALES = { pt: 'pt-PT', en: 'en', fr: 'fr', zh: 'zh-CN' };
let LANG = 'pt';

const DICT = [
  /* ——— autenticação ——— */
  ['Cria a tua conta', 'Create your account', 'Créez votre compte', '创建你的账户'],
  ['Nome', 'Name', 'Nom', '姓名'],
  ['Email', 'Email', 'E-mail', '电子邮箱'],
  ['Palavra-passe', 'Password', 'Mot de passe', '密码'],
  ['Mínimo 10 caracteres', 'At least 10 characters', '10 caractères minimum', '至少 10 个字符'],
  ['Criar conta', 'Create account', 'Créer un compte', '创建账户'],
  ['Já tens conta?', 'Already have an account?', 'Vous avez déjà un compte ?', '已有账户？'],
  ['Entrar', 'Sign in', 'Se connecter', '登录'],
  ['Ainda não tens conta?', 'Don’t have an account yet?', 'Pas encore de compte ?', '还没有账户？'],
  ['Explorar perfis públicos', 'Explore public profiles', 'Explorer les profils publics', '浏览公开资料'],
  ['Ao continuar, aceitas os {a} e a {b}.', 'By continuing, you accept the {a} and the {b}.', 'En continuant, vous acceptez les {a} et la {b}.', '继续即表示你接受{a}和{b}。'],
  ['Termos de Uso', 'Terms of Use', 'Conditions d’utilisation', '使用条款'],
  ['Política de Privacidade', 'Privacy Policy', 'Politique de confidentialité', '隐私政策'],
  ['ou', 'or', 'ou', '或'],
  ['Continuar com Google', 'Continue with Google', 'Continuer avec Google', '使用 Google 继续'],
  ['Idioma', 'Language', 'Langue', '语言'],
  ['Preenche todos os campos.', 'Fill in all the fields.', 'Remplissez tous les champs.', '请填写所有字段。'],
  ['Não foi possível entrar. Verifica o email, a palavra-passe e a ligação.', 'Could not sign in. Check your email, password and connection.', 'Connexion impossible. Vérifiez votre e-mail, votre mot de passe et votre connexion.', '无法登录。请检查邮箱、密码和网络连接。'],
  ['Indica o nome e um email válido.', 'Enter your name and a valid email.', 'Indiquez votre nom et une adresse e-mail valide.', '请输入姓名和有效的邮箱。'],
  ['A palavra-passe deve ter pelo menos 10 caracteres.', 'The password must be at least 10 characters long.', 'Le mot de passe doit contenir au moins 10 caractères.', '密码至少需要 10 个字符。'],
  ['Este email já está registado.', 'This email is already registered.', 'Cette adresse e-mail est déjà enregistrée.', '该邮箱已注册。'],
  ['Não foi possível criar a conta online.', 'Could not create the account online.', 'Impossible de créer le compte en ligne.', '无法在线创建账户。'],
  ['Não foi possível ligar ao servidor.', 'Could not connect to the server.', 'Impossible de se connecter au serveur.', '无法连接到服务器。'],
  ['Não foi possível ligar ao servidor. Tenta novamente.', 'Could not connect to the server. Try again.', 'Impossible de se connecter au serveur. Réessayez.', '无法连接到服务器，请重试。'],
  ['Não foi possível entrar com Google.', 'Could not sign in with Google.', 'Connexion avec Google impossible.', '无法使用 Google 登录。'],
  ['Sem ligação ao servidor. Verifica a internet e tenta novamente.', 'No connection to the server. Check your internet and try again.', 'Pas de connexion au serveur. Vérifiez votre Internet et réessayez.', '无法连接服务器。请检查网络后重试。'],
  ['Não foi possível comunicar com o servidor.', 'Could not communicate with the server.', 'Impossible de communiquer avec le serveur.', '无法与服务器通信。'],
  ['O início de sessão com Google ainda não está configurado neste servidor.', 'Google sign-in is not set up on this server yet.', 'La connexion avec Google n’est pas encore configurée sur ce serveur.', '此服务器尚未配置 Google 登录。'],

  /* ——— início, pesquisa, anúncios ——— */
  ['Pesquisar no Aquipay', 'Search Aquipay', 'Rechercher sur Aquipay', '在 Aquipay 中搜索'],
  ['Pesquisar', 'Search', 'Rechercher', '搜索'],
  ['Limpar pesquisa', 'Clear search', 'Effacer la recherche', '清除搜索'],
  ['Notificações', 'Notifications', 'Notifications', '通知'],
  ['Mensagens', 'Messages', 'Messages', '消息'],
  ['Menu', 'Menu', 'Menu', '菜单'],
  ['Fechar', 'Close', 'Fermer', '关闭'],
  ['Publicar', 'Post', 'Publier', '发布'],
  ['Vagas', 'Jobs', 'Offres', '职位'],
  ['Candidaturas', 'Applications', 'Candidatures', '申请'],
  ['Meus anúncios', 'My listings', 'Mes annonces', '我的发布'],
  ['Perfil', 'Profile', 'Profil', '个人资料'],
  ['Perfis encontrados', 'Profiles found', 'Profils trouvés', '找到的资料'],
  ['Ver perfil', 'View profile', 'Voir le profil', '查看资料'],
  ['Local a combinar', 'Location to be agreed', 'Lieu à convenir', '地点待商定'],
  ['A combinar', 'To be agreed', 'À convenir', '面议'],
  ['O teu anúncio', 'Your listing', 'Votre annonce', '你的发布'],
  ['Candidatura enviada', 'Application sent', 'Candidature envoyée', '申请已发送'],
  ['Candidatar-me', 'Apply', 'Postuler', '申请'],
  ['Partilhar', 'Share', 'Partager', '分享'],
  ['Copiar link', 'Copy link', 'Copier le lien', '复制链接'],
  ['Utilizador', 'User', 'Utilisateur', '用户'],
  ['Anúncio removido', 'Listing removed', 'Annonce supprimée', '发布已删除'],
  ['sem custo', 'free', 'gratuit', '免费'],
  ['Trabalho rápido', 'Quick job', 'Petit boulot', '零工'],
  ['Freelancer', 'Freelancer', 'Freelance', '自由职业'],
  ['Emprego', 'Employment', 'Emploi', '全职工作'],
  ['Enviada', 'Sent', 'Envoyée', '已发送'],
  ['Aceite', 'Accepted', 'Acceptée', '已接受'],
  ['Concluída', 'Completed', 'Terminée', '已完成'],
  ['Pagamento confirmado', 'Payment confirmed', 'Paiement confirmé', '付款已确认'],
  ['Pagamento não recebido', 'Payment not received', 'Paiement non reçu', '未收到付款'],
  ['Recebi o pagamento', 'I received the payment', 'J’ai reçu le paiement', '我已收到付款'],
  ['Não recebi', 'I didn’t receive it', 'Je ne l’ai pas reçu', '我没有收到'],
  ['Ver candidatos', 'View applicants', 'Voir les candidats', '查看申请人'],
  ['Ainda não há anúncios', 'No listings yet', 'Pas encore d’annonces', '暂无发布'],
  ['Publica o primeiro trabalho ou emprego da tua zona.', 'Post the first job or opportunity in your area.', 'Publiez la première offre de votre région.', '发布你所在地区的第一份工作。'],
  ['Sem candidaturas', 'No applications', 'Aucune candidature', '暂无申请'],
  ['As vagas a que te candidatares aparecem aqui.', 'The jobs you apply to will appear here.', 'Les offres auxquelles vous postulez apparaîtront ici.', '你申请的职位会显示在这里。'],
  ['Sem anúncios', 'No listings', 'Aucune annonce', '暂无发布'],
  ['Os anúncios que publicares aparecem aqui.', 'The listings you post will appear here.', 'Les annonces que vous publiez apparaîtront ici.', '你发布的内容会显示在这里。'],
  ['Ainda ninguém se candidatou.', 'Nobody has applied yet.', 'Personne n’a encore postulé.', '还没有人申请。'],
  ['{n} candidatura', '{n} application', '{n} candidature', '{n} 份申请'],
  ['{n} candidaturas', '{n} applications', '{n} candidatures', '{n} 份申请'],
  ['-{n} moedas', '-{n} coins', '-{n} pièces', '-{n} 枚金币'],
  ['{n} moedas', '{n} coins', '{n} pièces', '{n} 枚金币'],
  ['moedas', 'coins', 'pièces', '金币'],
  ['+{n} de bónus', '+{n} bonus', '+{n} de bonus', '赠送 {n} 枚'],
  ['agora', 'now', 'à l’instant', '刚刚'],
  ['{n} min', '{n} min', '{n} min', '{n} 分钟'],
  ['{n} h', '{n} h', '{n} h', '{n} 小时'],
  ['{n} d', '{n} d', '{n} j', '{n} 天'],

  /* ——— novo anúncio ——— */
  ['Novo anúncio', 'New listing', 'Nouvelle annonce', '发布新内容'],
  ['Título', 'Title', 'Titre', '标题'],
  ['Ex.: Montagem de móveis', 'E.g. Furniture assembly', 'Ex. : Montage de meubles', '例如：家具安装'],
  ['Tipo', 'Type', 'Type', '类型'],
  ['Preço em Kz (opcional)', 'Price in Kz (optional)', 'Prix en Kz (facultatif)', '价格（Kz，可选）'],
  ['Localização', 'Location', 'Localisation', '地点'],
  ['Ex.: Luanda, Talatona', 'E.g. Luanda, Talatona', 'Ex. : Luanda, Talatona', '例如：罗安达，塔拉托纳'],
  ['Descrição', 'Description', 'Description', '描述'],
  ['Descreve o trabalho, horário e requisitos', 'Describe the job, schedule and requirements', 'Décrivez le travail, les horaires et les exigences', '描述工作内容、时间和要求'],
  ['Adicionar fotos', 'Add photos', 'Ajouter des photos', '添加照片'],
  ['Pré-visualização', 'Preview', 'Aperçu', '预览'],
  ['Remover', 'Remove', 'Retirer', '移除'],
  ['Foto do anúncio', 'Listing photo', 'Photo de l’annonce', '发布照片'],
  ['Indica o título do anúncio', 'Enter a title for the listing', 'Indiquez le titre de l’annonce', '请输入标题'],
  ['Anúncio publicado', 'Listing posted', 'Annonce publiée', '已发布'],
  ['Anúncio publicado, mas não foi possível sincronizá-lo.', 'Listing posted, but it could not be synced.', 'Annonce publiée, mais la synchronisation a échoué.', '已发布，但无法同步。'],

  /* ——— candidaturas ——— */
  ['Candidatura', 'Application', 'Candidature', '申请'],
  ['Incluída no teu plano Plus.', 'Included in your Plus plan.', 'Incluse dans votre formule Plus.', '已包含在你的 Plus 计划中。'],
  ['Esta candidatura custa 5 moedas.', 'This application costs 5 coins.', 'Cette candidature coûte 5 pièces.', '本次申请需要 5 枚金币。'],
  ['A primeira candidatura do dia não tem custo.', 'Your first application of the day is free.', 'La première candidature du jour est gratuite.', '每天第一次申请免费。'],
  ['Enviar candidatura', 'Send application', 'Envoyer la candidature', '发送申请'],
  ['Aceitar', 'Accept', 'Accepter', '接受'],
  ['Marcar como concluído', 'Mark as completed', 'Marquer comme terminé', '标记为已完成'],
  ['Não tens moedas suficientes', 'You don’t have enough coins', 'Vous n’avez pas assez de pièces', '金币不足'],
  ['Candidatura registada, mas não foi possível sincronizá-la.', 'Application saved, but it could not be synced.', 'Candidature enregistrée, mais la synchronisation a échoué.', '申请已保存，但无法同步。'],
  ['Estado atualizado, mas não foi possível sincronizá-lo.', 'Status updated, but it could not be synced.', 'Statut mis à jour, mais la synchronisation a échoué.', '状态已更新，但无法同步。'],
  ['Confirmação registada', 'Confirmation saved', 'Confirmation enregistrée', '确认已记录'],
  ['Tenho interesse nesta oportunidade e gostaria de conversar sobre os detalhes.', 'I’m interested in this opportunity and would like to talk about the details.', 'Cette opportunité m’intéresse et j’aimerais en discuter les détails.', '我对这个机会很感兴趣，希望能聊聊具体细节。'],
  ['{a} candidatou-se a «{b}».', '{a} applied to “{b}”.', '{a} a postulé à « {b} ».', '{a} 申请了「{b}」。'],
  ['A tua candidatura a «{b}» foi aceite.', 'Your application to “{b}” was accepted.', 'Votre candidature à « {b} » a été acceptée.', '你对「{b}」的申请已被接受。'],
  ['O trabalho «{b}» foi concluído. Confirma se recebeste o pagamento.', 'The job “{b}” was completed. Confirm whether you received the payment.', 'Le travail « {b} » est terminé. Confirmez si vous avez reçu le paiement.', '工作「{b}」已完成。请确认你是否收到了付款。'],
  ['{a} confirmou o pagamento de «{b}».', '{a} confirmed payment for “{b}”.', '{a} a confirmé le paiement de « {b} ».', '{a} 已确认「{b}」的付款。'],
  ['{a} indicou que não recebeu o pagamento de «{b}».', '{a} said they did not receive payment for “{b}”.', '{a} indique ne pas avoir reçu le paiement de « {b} ».', '{a} 表示未收到「{b}」的付款。'],
  ['Bem-vindo ao Aquipay. Recebeste 10 moedas de boas-vindas.', 'Welcome to Aquipay. You received 10 welcome coins.', 'Bienvenue sur Aquipay. Vous avez reçu 10 pièces de bienvenue.', '欢迎来到 Aquipay。你获得了 10 枚迎新金币。'],

  /* ——— perfil e reputação ——— */
  ['Pagador de confiança', 'Trusted payer', 'Payeur de confiance', '值得信赖的付款人'],
  ['Bom histórico de pagamentos', 'Good payment history', 'Bon historique de paiements', '付款记录良好'],
  ['Histórico de pagamentos irregular', 'Irregular payment history', 'Historique de paiements irrégulier', '付款记录不稳定'],
  ['Ainda sem histórico de pagamentos', 'No payment history yet', 'Pas encore d’historique de paiements', '暂无付款记录'],
  ['Sim', 'Yes', 'Oui', '是'],
  ['Não', 'No', 'Non', '否'],
  ['Verificado', 'Verified', 'Vérifié', '已验证'],
  ['Interações concluídas', 'Completed interactions', 'Interactions terminées', '已完成的合作'],
  ['avaliação', 'rating', 'avis', '条评价'],
  ['avaliações', 'ratings', 'avis', '条评价'],
  ['Avaliações', 'Reviews', 'Avis', '评价'],
  ['Profissões', 'Professions', 'Métiers', '职业'],
  ['Competências', 'Skills', 'Compétences', '技能'],
  ['Experiência profissional', 'Work experience', 'Expérience professionnelle', '工作经历'],
  ['Formação', 'Education', 'Formation', '教育背景'],
  ['Formação académica', 'Education', 'Formation académique', '学历'],
  ['Portefólio', 'Portfolio', 'Portfolio', '作品集'],
  ['Trabalho', 'Job', 'Travail', '工作'],
  ['Classificações', 'Ratings', 'Notes', '评分'],
  ['{n} de 5', '{n} out of 5', '{n} sur 5', '{n} / 5'],
  ['{n} de 5 estrelas', '{n} out of 5 stars', '{n} étoiles sur 5', '{n} 星（满分 5 星）'],
  ['Ainda sem classificações', 'No ratings yet', 'Pas encore de notes', '暂无评分'],
  ['Sem comentário', 'No comment', 'Pas de commentaire', '无评论'],
  ['Classificar com estrelas', 'Rate with stars', 'Noter avec des étoiles', '星级评分'],
  ['Classificar este perfil', 'Rate this profile', 'Noter ce profil', '为该资料评分'],
  ['Já classificaste este perfil.', 'You already rated this profile.', 'Vous avez déjà noté ce profil.', '你已经评价过该资料。'],
  ['Já classificaste este perfil', 'You already rated this profile', 'Vous avez déjà noté ce profil', '你已经评价过该资料'],
  ['A classificação fica disponível depois de uma interação concluída entre vocês.', 'Rating becomes available after you have completed an interaction together.', 'La notation est disponible après une interaction terminée entre vous.', '双方完成一次合作后即可评分。'],
  ['Histórico', 'History', 'Historique', '历史记录'],
  ['Pago', 'Paid', 'Payé', '已付款'],
  ['Não pago', 'Not paid', 'Non payé', '未付款'],
  ['Ainda não há trabalhos concluídos com este utilizador.', 'There are no completed jobs with this user yet.', 'Aucun travail terminé avec cet utilisateur pour l’instant.', '与该用户尚无已完成的工作。'],
  ['Membro desde {d}', 'Member since {d}', 'Membre depuis {d}', '{d} 加入'],
  ['Ainda sem avaliações.', 'No reviews yet.', 'Pas encore d’avis.', '暂无评价。'],
  ['Documentos públicos', 'Public documents', 'Documents publics', '公开文件'],
  ['{a} · Abrir documento', '{a} · Open document', '{a} · Ouvrir le document', '{a} · 打开文件'],
  ['Perfil indisponível', 'Profile unavailable', 'Profil indisponible', '资料不可用'],
  ['Classificar {a}', 'Rate {a}', 'Noter {a}', '为 {a} 评分'],
  ['Classificar este perfil', 'Rate this profile', 'Noter ce profil', '为该资料评分'],
  ['A tua avaliação deve refletir a experiência real que tiveram.', 'Your review should reflect the real experience you had together.', 'Votre avis doit refléter l’expérience réelle que vous avez vécue.', '你的评价应反映你们的真实合作体验。'],
  ['Estrelas', 'Stars', 'Étoiles', '星级'],
  ['5 — Excelente', '5 — Excellent', '5 — Excellent', '5 — 非常好'],
  ['4 — Muito bom', '4 — Very good', '4 — Très bien', '4 — 很好'],
  ['3 — Bom', '3 — Good', '3 — Bien', '3 — 良好'],
  ['2 — Fraco', '2 — Poor', '2 — Passable', '2 — 较差'],
  ['1 — Muito fraco', '1 — Very poor', '1 — Très mauvais', '1 — 很差'],
  ['Comentário', 'Comment', 'Commentaire', '评论'],
  ['Comentário (opcional)', 'Comment (optional)', 'Commentaire (facultatif)', '评论（可选）'],
  ['Enviar avaliação', 'Submit review', 'Envoyer l’avis', '提交评价'],
  ['Enviar classificação', 'Submit rating', 'Envoyer la note', '提交评分'],
  ['Avaliação enviada', 'Review submitted', 'Avis envoyé', '评价已提交'],
  ['Classificação enviada', 'Rating submitted', 'Note envoyée', '评分已提交'],
  ['Só podes avaliar após uma interação concluída', 'You can only rate after a completed interaction', 'Vous ne pouvez noter qu’après une interaction terminée', '完成合作后才能评价'],

  /* ——— editar perfil ——— */
  ['Alterar foto', 'Change photo', 'Changer de photo', '更换照片'],
  ['Cidade', 'City', 'Ville', '城市'],
  ['Ex.: Luanda', 'E.g. Luanda', 'Ex. : Luanda', '例如：罗安达'],
  ['Telefone', 'Phone', 'Téléphone', '电话'],
  ['Biografia', 'Bio', 'Biographie', '个人简介'],
  ['Profissões (separadas por vírgula)', 'Professions (comma-separated)', 'Métiers (séparés par des virgules)', '职业（用逗号分隔）'],
  ['Ex.: Electricista, Técnico de informática', 'E.g. Electrician, IT technician', 'Ex. : Électricien, Technicien informatique', '例如：电工，信息技术员'],
  ['Competências (separadas por vírgula)', 'Skills (comma-separated)', 'Compétences (séparées par des virgules)', '技能（用逗号分隔）'],
  ['Ex.: Excel, soldadura, atendimento', 'E.g. Excel, welding, customer service', 'Ex. : Excel, soudure, accueil client', '例如：Excel，焊接，客户服务'],
  ['Experiência profissional (uma por linha)', 'Work experience (one per line)', 'Expérience professionnelle (une par ligne)', '工作经历（每行一条）'],
  ['Cargo | Empresa | Período', 'Role | Company | Period', 'Poste | Entreprise | Période', '职位 | 公司 | 时间'],
  ['Formação (uma por linha)', 'Education (one per line)', 'Formation (une par ligne)', '教育背景（每行一条）'],
  ['Curso | Instituição | Ano', 'Course | Institution | Year', 'Cursus | Établissement | Année', '专业 | 学校 | 年份'],
  ['Portefólio (um projeto por linha)', 'Portfolio (one project per line)', 'Portfolio (un projet par ligne)', '作品集（每行一个项目）'],
  ['Projeto | Descrição', 'Project | Description', 'Projet | Description', '项目 | 描述'],
  ['Perfil público', 'Public profile', 'Profil public', '公开资料'],
  ['Qualquer pessoa pode encontrar e ver o perfil', 'Anyone can find and view the profile', 'Tout le monde peut trouver et voir le profil', '任何人都可以找到并查看该资料'],
  ['Qualquer pessoa pode encontrar e ver o teu perfil', 'Anyone can find and view your profile', 'Tout le monde peut trouver et voir votre profil', '任何人都可以找到并查看你的资料'],
  ['Perfil privado', 'Private profile', 'Profil privé', '私密资料'],
  ['Guardar perfil', 'Save profile', 'Enregistrer le profil', '保存资料'],
  ['Perfil guardado', 'Profile saved', 'Profil enregistré', '资料已保存'],
  ['Perfil guardado. Não foi possível sincronizar com o servidor.', 'Profile saved. It could not be synced with the server.', 'Profil enregistré. Impossible de synchroniser avec le serveur.', '资料已保存，但无法与服务器同步。'],
  ['Partilhar perfil', 'Share profile', 'Partager le profil', '分享资料'],
  ['Copiar link do perfil', 'Copy profile link', 'Copier le lien du profil', '复制资料链接'],
  ['Documentos e portefólio', 'Documents and portfolio', 'Documents et portfolio', '文件与作品集'],
  ['Envia CV, certificados, trabalhos e vídeo. Escolhe se cada ficheiro pode aparecer no perfil público.', 'Upload your CV, certificates, work samples and video. Choose whether each file can appear on your public profile.', 'Envoyez votre CV, vos certificats, vos réalisations et une vidéo. Choisissez si chaque fichier peut apparaître sur votre profil public.', '上传简历、证书、作品和视频。可选择每个文件是否显示在公开资料中。'],
  ['Tipo de ficheiro', 'File type', 'Type de fichier', '文件类型'],
  ['CV / Currículo', 'CV / Résumé', 'CV', '简历'],
  ['Certificado', 'Certificate', 'Certificat', '证书'],
  ['Vídeo de apresentação', 'Introduction video', 'Vidéo de présentation', '自我介绍视频'],
  ['Visibilidade do ficheiro', 'File visibility', 'Visibilité du fichier', '文件可见性'],
  ['Privado', 'Private', 'Privé', '私密'],
  ['Visível no perfil público', 'Visible on the public profile', 'Visible sur le profil public', '在公开资料中可见'],
  ['Visível no perfil', 'Visible on the profile', 'Visible sur le profil', '在资料中可见'],
  ['Escolher ficheiro no dispositivo', 'Choose a file on your device', 'Choisir un fichier sur l’appareil', '从设备选择文件'],
  ['Apagar', 'Delete', 'Supprimer', '删除'],
  ['Verificação', 'Verification', 'Vérification', '身份验证'],
  ['A tua conta está verificada.', 'Your account is verified.', 'Votre compte est vérifié.', '你的账户已通过验证。'],
  ['Pedido de verificação enviado.', 'Verification request sent.', 'Demande de vérification envoyée.', '验证申请已发送。'],
  ['Pedido de verificação enviado', 'Verification request sent', 'Demande de vérification envoyée', '验证申请已发送'],
  ['Contas verificadas transmitem mais confiança a quem se candidata.', 'Verified accounts give applicants more confidence.', 'Les comptes vérifiés inspirent plus de confiance aux candidats.', '已验证的账户更让申请人放心。'],
  ['Pedir verificação', 'Request verification', 'Demander la vérification', '申请验证'],
  ['Inicia sessão com ligação à internet para enviar documentos.', 'Sign in with an internet connection to upload documents.', 'Connectez-vous avec une connexion Internet pour envoyer des documents.', '请联网并登录后再上传文件。'],
  ['Ficheiro enviado em segurança', 'File uploaded securely', 'Fichier envoyé en toute sécurité', '文件已安全上传'],
  ['Documento apagado', 'Document deleted', 'Document supprimé', '文件已删除'],
  ['Não foi possível ler a imagem', 'Could not read the image', 'Impossible de lire l’image', '无法读取图片'],

  /* ——— moedas e plano ——— */
  ['Moedas e plano', 'Coins and plan', 'Pièces et formule', '金币与套餐'],
  ['Plus ativo até {d}', 'Plus active until {d}', 'Plus actif jusqu’au {d}', 'Plus 有效期至 {d}'],
  ['Plano Plus', 'Plus plan', 'Formule Plus', 'Plus 套餐'],
  ['Plus · $19.99 / mês', 'Plus · $19.99 / month', 'Plus · 19,99 $ / mois', 'Plus · $19.99 / 月'],
  ['Candidaturas ilimitadas, sem gastar moedas.', 'Unlimited applications, no coins spent.', 'Candidatures illimitées, sans dépenser de pièces.', '无限次申请，无需消耗金币。'],
  ['Ativar Plus', 'Activate Plus', 'Activer Plus', '开通 Plus'],
  ['Comprar moedas', 'Buy coins', 'Acheter des pièces', '购买金币'],
  ['O pagamento não está disponível de momento. Tenta novamente mais tarde.', 'Payment is not available right now. Try again later.', 'Le paiement n’est pas disponible pour le moment. Réessayez plus tard.', '暂时无法付款，请稍后再试。'],

  /* ——— explorar ——— */
  ['Nome, profissão ou cidade', 'Name, profession or city', 'Nom, métier ou ville', '姓名、职业或城市'],
  ['Pesquisa profissionais sem precisares de iniciar sessão.', 'Search for professionals without signing in.', 'Recherchez des professionnels sans vous connecter.', '无需登录即可搜索专业人士。'],
  ['Entrar no Aquipay', 'Sign in to Aquipay', 'Se connecter à Aquipay', '登录 Aquipay'],
  ['Escreve pelo menos 2 caracteres.', 'Type at least 2 characters.', 'Saisissez au moins 2 caractères.', '请至少输入 2 个字符。'],
  ['Nenhum perfil público encontrado.', 'No public profiles found.', 'Aucun profil public trouvé.', '未找到公开资料。'],
  ['Não foi possível pesquisar agora.', 'Could not search right now.', 'Recherche impossible pour le moment.', '暂时无法搜索。'],

  /* ——— notificações e mensagens ——— */
  ['Sem notificações', 'No notifications', 'Aucune notification', '暂无通知'],
  ['Os avisos de candidaturas e pagamentos aparecem aqui.', 'Alerts about applications and payments appear here.', 'Les alertes de candidatures et de paiements apparaissent ici.', '有关申请和付款的提醒会显示在这里。'],
  ['Ainda não tens mensagens', 'No messages yet', 'Pas encore de messages', '暂无消息'],
  ['As conversas sobre propostas e anúncios aparecerão aqui.', 'Conversations about proposals and listings will appear here.', 'Les conversations sur les propositions et les annonces apparaîtront ici.', '有关提案和发布的对话会显示在这里。'],
  ['Conversa', 'Conversation', 'Conversation', '对话'],
  ['Notificações ativas neste dispositivo.', 'Notifications are on for this device.', 'Notifications activées sur cet appareil.', '此设备已开启通知。'],
  ['Este dispositivo não suporta notificações.', 'This device does not support notifications.', 'Cet appareil ne prend pas en charge les notifications.', '此设备不支持通知。'],
  ['Bloqueadas nas definições do navegador.', 'Blocked in the browser settings.', 'Bloquées dans les paramètres du navigateur.', '已在浏览器设置中被屏蔽。'],
  ['Recebe avisos de candidaturas e pagamentos.', 'Get alerts about applications and payments.', 'Recevez des alertes sur les candidatures et les paiements.', '接收有关申请和付款的提醒。'],
  ['Ativar notificações', 'Turn on notifications', 'Activer les notifications', '开启通知'],
  ['Não foi possível ativar as notificações neste dispositivo.', 'Could not turn on notifications on this device.', 'Impossible d’activer les notifications sur cet appareil.', '无法在此设备上开启通知。'],

  /* ——— definições ——— */
  ['Definições', 'Settings', 'Paramètres', '设置'],
  ['Conta', 'Account', 'Compte', '账户'],
  ['Editar perfil', 'Edit profile', 'Modifier le profil', '编辑资料'],
  ['Editar perfil e documentos', 'Edit profile and documents', 'Modifier le profil et les documents', '编辑资料和文件'],
  ['Aparência', 'Appearance', 'Apparence', '外观'],
  ['Tema', 'Theme', 'Thème', '主题'],
  ['Automático', 'Automatic', 'Automatique', '自动'],
  ['Claro', 'Light', 'Clair', '浅色'],
  ['Escuro', 'Dark', 'Sombre', '深色'],
  ['Tipo de letra', 'Font', 'Police', '字体'],
  ['Padrão', 'Default', 'Par défaut', '默认'],
  ['Arredondada', 'Rounded', 'Arrondie', '圆体'],
  ['Clássica', 'Classic', 'Classique', '经典'],
  ['Tamanho da letra', 'Text size', 'Taille du texte', '字号'],
  ['Pequeno', 'Small', 'Petit', '小'],
  ['Normal', 'Normal', 'Normal', '标准'],
  ['Grande', 'Large', 'Grand', '大'],
  ['Muito grande', 'Extra large', 'Très grand', '特大'],
  ['Animações', 'Animations', 'Animations', '动画'],
  ['Normais', 'Normal', 'Normales', '正常'],
  ['Reduzidas', 'Reduced', 'Réduites', '减少'],
  ['Quando alguém se candidata ou responde a uma candidatura', 'When someone applies or replies to an application', 'Quand quelqu’un postule ou répond à une candidature', '有人申请或回复申请时'],
  ['Pagamentos', 'Payments', 'Paiements', '付款'],
  ['Confirmações de pagamento dos trabalhos', 'Payment confirmations for jobs', 'Confirmations de paiement des travaux', '工作付款确认'],
  ['Novidades do Aquipay', 'Aquipay news', 'Nouveautés d’Aquipay', 'Aquipay 动态'],
  ['Dicas e novas funcionalidades', 'Tips and new features', 'Conseils et nouvelles fonctionnalités', '小贴士与新功能'],
  ['Privacidade', 'Privacy', 'Confidentialité', '隐私'],
  ['Dados e armazenamento', 'Data and storage', 'Données et stockage', '数据与存储'],
  ['Qualidade das fotografias', 'Photo quality', 'Qualité des photos', '照片质量'],
  ['Alta', 'High', 'Élevée', '高'],
  ['Poupar dados', 'Save data', 'Économiser les données', '节省流量'],
  ['Exportar os meus dados', 'Export my data', 'Exporter mes données', '导出我的数据'],
  ['Ficheiro gerado', 'File generated', 'Fichier généré', '文件已生成'],
  ['Limpar dados deste dispositivo', 'Clear data on this device', 'Effacer les données de cet appareil', '清除此设备上的数据'],
  ['Remove a sessão, as definições e tudo o que está guardado neste aparelho e ainda não foi sincronizado. Vais ter de iniciar sessão novamente.', 'Removes your session, settings and everything stored on this device that has not been synced. You will need to sign in again.', 'Supprime la session, les paramètres et tout ce qui est stocké sur cet appareil et pas encore synchronisé. Vous devrez vous reconnecter.', '将删除此设备上的登录状态、设置以及尚未同步的所有数据。你需要重新登录。'],
  ['Limpar dados', 'Clear data', 'Effacer les données', '清除数据'],
  ['Cancelar', 'Cancel', 'Annuler', '取消'],
  ['Segurança', 'Security', 'Sécurité', '安全'],
  ['Terminar sessão', 'Sign out', 'Se déconnecter', '退出登录'],
  ['Pedir eliminação da conta', 'Request account deletion', 'Demander la suppression du compte', '申请删除账户'],
  ['Apagamos a conta e os dados pessoais associados em até 30 dias. O pedido deve seguir do email da conta, para confirmarmos que é teu.', 'We delete the account and associated personal data within 30 days. The request must be sent from the account’s email so we can confirm it is yours.', 'Nous supprimons le compte et les données personnelles associées sous 30 jours. La demande doit partir de l’adresse e-mail du compte, pour que nous puissions confirmer qu’il s’agit bien de vous.', '我们将在 30 天内删除账户及相关个人数据。请使用账户邮箱发送申请，以便我们确认是你本人。'],
  ['Enviar pedido por email', 'Send request by email', 'Envoyer la demande par e-mail', '通过邮件发送申请'],
  ['Eliminação da conta Aquipay', 'Aquipay account deletion', 'Suppression du compte Aquipay', '删除 Aquipay 账户'],
  ['Peço a eliminação da minha conta Aquipay ({a}).', 'I request the deletion of my Aquipay account ({a}).', 'Je demande la suppression de mon compte Aquipay ({a}).', '我申请删除我的 Aquipay 账户（{a}）。'],
  ['Legal e ajuda', 'Legal and help', 'Mentions légales et aide', '法律与帮助'],
  ['Termos, privacidade e ajuda', 'Terms, privacy and help', 'Conditions, confidentialité et aide', '条款、隐私与帮助'],
  ['A atualizar…', 'Updating…', 'Mise à jour…', '正在更新…'],
  ['Conteúdo atualizado', 'Content updated', 'Contenu mis à jour', '内容已更新'],
  ['Não foi possível atualizar agora', 'Could not update right now', 'Mise à jour impossible pour le moment', '暂时无法更新'],
  ['Ligação restabelecida', 'Connection restored', 'Connexion rétablie', '网络已恢复'],
  ['Sem ligação. Podes continuar a usar o Aquipay.', 'You’re offline. You can keep using Aquipay.', 'Vous êtes hors ligne. Vous pouvez continuer à utiliser Aquipay.', '当前离线，你仍可继续使用 Aquipay。'],

  /* ——— partilha ——— */
  ['Concluir', 'Done', 'Terminer', '完成'],
  ['Link', 'Link', 'Lien', '链接'],
  ['Link copiado', 'Link copied', 'Lien copié', '链接已复制'],
  ['Link da publicação copiado', 'Post link copied', 'Lien de l’annonce copié', '发布链接已复制'],
  ['Link do perfil copiado', 'Profile link copied', 'Lien du profil copié', '资料链接已复制'],
  ['Vê no Aquipay', 'See it on Aquipay', 'À voir sur Aquipay', '在 Aquipay 上查看'],
  ['Perfil Aquipay', 'Aquipay profile', 'Profil Aquipay', 'Aquipay 资料'],
  ['Publicação Aquipay', 'Aquipay listing', 'Annonce Aquipay', 'Aquipay 发布'],
  ['Publicação', 'Listing', 'Annonce', '发布'],
  ['Link inválido', 'Invalid link', 'Lien invalide', '链接无效'],
  ['Este conteúdo não está disponível.', 'This content is not available.', 'Ce contenu n’est pas disponible.', '该内容不可用。'],
  ['Abrir Aquipay', 'Open Aquipay', 'Ouvrir Aquipay', '打开 Aquipay'],
  ['Publicação partilhada', 'Shared listing', 'Annonce partagée', '已分享的发布'],
  ['Perfil partilhado', 'Shared profile', 'Profil partagé', '已分享的资料'],
  ['No Aquipay desde {d}', 'On Aquipay since {d}', 'Sur Aquipay depuis {d}', '{d} 加入 Aquipay'],
  ['O teu perfil é privado. Ativa o perfil público para o poderes partilhar.', 'Your profile is private. Turn on the public profile to be able to share it.', 'Votre profil est privé. Activez le profil public pour pouvoir le partager.', '你的资料是私密的。请先开启公开资料再分享。'],

  /* ——— legal e ajuda ——— */
  ['Legal', 'Legal', 'Mentions légales', '法律'],
  ['Comunidade e segurança', 'Community and safety', 'Communauté et sécurité', '社区与安全'],
  ['Apoio', 'Support', 'Assistance', '支持'],
  ['Pagamentos e Reembolsos', 'Payments and Refunds', 'Paiements et remboursements', '付款与退款'],
  ['Regras da Comunidade', 'Community Rules', 'Règles de la communauté', '社区规则'],
  ['Dicas de Segurança', 'Safety Tips', 'Conseils de sécurité', '安全提示'],
  ['Cookies e Armazenamento', 'Cookies and Storage', 'Cookies et stockage', 'Cookie 与存储'],
  ['Ajuda e Contacto', 'Help and Contact', 'Aide et contact', '帮助与联系'],
  ['Sobre o Aquipay', 'About Aquipay', 'À propos d’Aquipay', '关于 Aquipay'],
  ['Atualizado em {d}', 'Updated on {d}', 'Mis à jour le {d}', '更新于 {d}'],
  ['Enviar email', 'Send email', 'Envoyer un e-mail', '发送邮件'],
  ['Este documento está disponível apenas em português, que é a versão oficial.', 'This document is only available in Portuguese, which is the official version.', 'Ce document n’est disponible qu’en portugais, qui est la version officielle.', '本文件仅提供葡萄牙语版本，该版本为正式版本。'],

  /* ——— erros devolvidos pela API ——— */
  ['Armazenamento de ficheiros indisponível.', 'File storage is unavailable.', 'Le stockage de fichiers est indisponible.', '文件存储不可用。'],
  ['Classificação inválida.', 'Invalid rating.', 'Note invalide.', '评分无效。'],
  ['Conta indisponível.', 'Account unavailable.', 'Compte indisponible.', '账户不可用。'],
  ['Conversa não encontrada.', 'Conversation not found.', 'Conversation introuvable.', '未找到对话。'],
  ['Credencial Google inválida.', 'Invalid Google credential.', 'Identifiant Google invalide.', 'Google 凭据无效。'],
  ['Dados do anúncio inválidos.', 'Invalid listing data.', 'Données de l’annonce invalides.', '发布数据无效。'],
  ['Demasiadas tentativas. Tenta novamente mais tarde.', 'Too many attempts. Try again later.', 'Trop de tentatives. Réessayez plus tard.', '尝试次数过多，请稍后再试。'],
  ['Documento não encontrado.', 'Document not found.', 'Document introuvable.', '未找到文件。'],
  ['Documento público não encontrado.', 'Public document not found.', 'Document public introuvable.', '未找到公开文件。'],
  ['Email já registado.', 'Email already registered.', 'E-mail déjà enregistré.', '该邮箱已注册。'],
  ['Email ou palavra-passe incorretos.', 'Incorrect email or password.', 'E-mail ou mot de passe incorrect.', '邮箱或密码不正确。'],
  ['Envia o ficheiro em multipart/form-data.', 'Send the file as multipart/form-data.', 'Envoyez le fichier en multipart/form-data.', '请以 multipart/form-data 格式发送文件。'],
  ['Escreve uma mensagem.', 'Write a message.', 'Écrivez un message.', '请输入消息。'],
  ['Estado inválido.', 'Invalid status.', 'Statut invalide.', '状态无效。'],
  ['Ficheiro não encontrado.', 'File not found.', 'Fichier introuvable.', '未找到文件。'],
  ['Ficheiro ou categoria inválidos.', 'Invalid file or category.', 'Fichier ou catégorie invalide.', '文件或类别无效。'],
  ['Formato não permitido. Usa PDF, JPG, PNG, WEBP ou MP4/WEBM para vídeo.', 'Format not allowed. Use PDF, JPG, PNG, WEBP, or MP4/WEBM for video.', 'Format non autorisé. Utilisez PDF, JPG, PNG, WEBP ou MP4/WEBM pour la vidéo.', '不支持该格式。请使用 PDF、JPG、PNG、WEBP，视频请使用 MP4/WEBM。'],
  ['Já classificaste este perfil ou a avaliação não pôde ser guardada.', 'You already rated this profile, or the rating could not be saved.', 'Vous avez déjà noté ce profil, ou la note n’a pas pu être enregistrée.', '你已评价过该资料，或评价无法保存。'],
  ['Nome, email válido e palavra-passe com pelo menos 10 caracteres são obrigatórios.', 'A name, a valid email and a password of at least 10 characters are required.', 'Un nom, une adresse e-mail valide et un mot de passe d’au moins 10 caractères sont obligatoires.', '必须填写姓名、有效邮箱以及至少 10 个字符的密码。'],
  ['Não foi possível criar a conta.', 'Could not create the account.', 'Impossible de créer le compte.', '无法创建账户。'],
  ['O conteúdo do ficheiro não corresponde ao formato indicado.', 'The file content does not match the stated format.', 'Le contenu du fichier ne correspond pas au format indiqué.', '文件内容与所述格式不符。'],
  ['O email da conta Google não está verificado.', 'The Google account’s email is not verified.', 'L’e-mail du compte Google n’est pas vérifié.', 'Google 账户的邮箱尚未验证。'],
  ['O início de sessão com Google ainda não está configurado.', 'Google sign-in is not set up yet.', 'La connexion avec Google n’est pas encore configurée.', 'Google 登录尚未配置。'],
  ['Origem não autorizada.', 'Origin not authorised.', 'Origine non autorisée.', '来源未获授权。'],
  ['Perfil não encontrado ou privado.', 'Profile not found or private.', 'Profil introuvable ou privé.', '资料不存在或为私密。'],
  ['Proposta inválida.', 'Invalid proposal.', 'Proposition invalide.', '提案无效。'],
  ['Proposta não encontrada.', 'Proposal not found.', 'Proposition introuvable.', '未找到提案。'],
  ['Rota não encontrada.', 'Route not found.', 'Route introuvable.', '未找到该路径。'],
  ['Sessão inválida ou expirada.', 'Invalid or expired session.', 'Session invalide ou expirée.', '登录已失效或已过期。'],
  ['Subscrição inválida.', 'Invalid subscription.', 'Abonnement invalide.', '订阅无效。'],
  ['Só os participantes podem concluir uma proposta aceite.', 'Only the participants can complete an accepted proposal.', 'Seuls les participants peuvent terminer une proposition acceptée.', '只有参与双方才能完成已接受的提案。'],
  ['Só podes classificar alguém com quem tiveste uma proposta aceite ou concluída.', 'You can only rate someone you had an accepted or completed proposal with.', 'Vous ne pouvez noter que quelqu’un avec qui vous avez eu une proposition acceptée ou terminée.', '只能评价与你有已接受或已完成提案的人。'],
  ['Só quem publicou o anúncio pode aceitar ou recusar uma proposta enviada.', 'Only the person who posted the listing can accept or decline a proposal.', 'Seule la personne qui a publié l’annonce peut accepter ou refuser une proposition.', '只有发布者才能接受或拒绝提案。'],
  ['Utilizador não encontrado.', 'User not found.', 'Utilisateur introuvable.', '未找到用户。'],
  ['Erro interno. Tenta novamente.', 'Internal error. Try again.', 'Erreur interne. Réessayez.', '内部错误，请重试。'],
  ['Pedido demasiado grande.', 'Request too large.', 'Requête trop volumineuse.', '请求过大。'],
  ['JSON inválido.', 'Invalid JSON.', 'JSON invalide.', 'JSON 无效。'],

  /* ——— conta: palavra-passe, eliminar, denúncias, bloqueios ——— */
  ['Esqueceste-te da palavra-passe?', 'Forgot your password?', 'Mot de passe oublié ?', '忘记密码？'],
  ['Recuperar palavra-passe', 'Recover password', 'Récupérer le mot de passe', '找回密码'],
  ['Indica o email da tua conta e enviamos um link para criares uma nova palavra-passe.', 'Enter your account email and we’ll send you a link to create a new password.', 'Indiquez l’e-mail de votre compte et nous vous enverrons un lien pour créer un nouveau mot de passe.', '请输入账户邮箱，我们会发送链接供你设置新密码。'],
  ['Enviar link', 'Send link', 'Envoyer le lien', '发送链接'],
  ['Se existir uma conta com este email, enviámos um link para criar uma nova palavra-passe. Confere também a pasta de spam.', 'If an account exists with this email, we’ve sent a link to create a new password. Check your spam folder too.', 'Si un compte existe avec cet e-mail, nous avons envoyé un lien pour créer un nouveau mot de passe. Vérifiez aussi vos courriers indésirables.', '如果该邮箱对应有账户，我们已发送设置新密码的链接。请同时检查垃圾邮件文件夹。'],
  ['Indica um email válido.', 'Enter a valid email.', 'Indiquez une adresse e-mail valide.', '请输入有效的邮箱。'],
  ['Nova palavra-passe', 'New password', 'Nouveau mot de passe', '新密码'],
  ['Repete a nova palavra-passe', 'Repeat the new password', 'Répétez le nouveau mot de passe', '再次输入新密码'],
  ['Guardar palavra-passe', 'Save password', 'Enregistrer le mot de passe', '保存密码'],
  ['As palavras-passe não coincidem.', 'The passwords don’t match.', 'Les mots de passe ne correspondent pas.', '两次输入的密码不一致。'],
  ['Palavra-passe alterada. Já podes entrar.', 'Password changed. You can sign in now.', 'Mot de passe modifié. Vous pouvez vous connecter.', '密码已修改，现在可以登录了。'],
  ['Voltar a entrar', 'Back to sign in', 'Retour à la connexion', '返回登录'],
  ['Pedir novo link', 'Request a new link', 'Demander un nouveau lien', '重新获取链接'],
  ['Link de recuperação inválido ou expirado.', 'Recovery link is invalid or has expired.', 'Le lien de récupération est invalide ou a expiré.', '恢复链接无效或已过期。'],
  ['Alterar palavra-passe', 'Change password', 'Changer le mot de passe', '修改密码'],
  ['Palavra-passe atual', 'Current password', 'Mot de passe actuel', '当前密码'],
  ['Palavra-passe atual incorreta.', 'Current password is incorrect.', 'Le mot de passe actuel est incorrect.', '当前密码不正确。'],
  ['Palavra-passe alterada.', 'Password changed.', 'Mot de passe modifié.', '密码已修改。'],
  ['Esta conta usa o Google para entrar.', 'This account signs in with Google.', 'Ce compte se connecte avec Google.', '此账户使用 Google 登录。'],
  ['A nova palavra-passe tem de ser diferente da atual.', 'The new password must be different from the current one.', 'Le nouveau mot de passe doit être différent de l’actuel.', '新密码不能与当前密码相同。'],
  ['Eliminar a minha conta', 'Delete my account', 'Supprimer mon compte', '删除我的账户'],
  ['Esta ação é definitiva. Apagamos o teu perfil, os teus documentos e os teus anúncios, e terminamos a sessão em todos os dispositivos. Não é possível recuperar a conta.', 'This cannot be undone. We delete your profile, your documents and your listings, and sign you out on all devices. The account cannot be recovered.', 'Cette action est définitive. Nous supprimons votre profil, vos documents et vos annonces, et nous vous déconnectons de tous les appareils. Le compte ne peut pas être récupéré.', '此操作无法撤销。我们将删除你的资料、文件和发布内容，并在所有设备上退出登录。账户无法恢复。'],
  ['Para confirmar, escreve a palavra-passe da tua conta.', 'To confirm, type your account password.', 'Pour confirmer, saisissez le mot de passe de votre compte.', '请输入账户密码以确认。'],
  ['Para confirmar, escreve o email da tua conta.', 'To confirm, type your account email.', 'Pour confirmer, saisissez l’e-mail de votre compte.', '请输入账户邮箱以确认。'],
  ['Email da conta', 'Account email', 'E-mail du compte', '账户邮箱'],
  ['Eliminar definitivamente', 'Delete permanently', 'Supprimer définitivement', '永久删除'],
  ['Prefiro pedir por email', 'I’d rather ask by email', 'Je préfère demander par e-mail', '我想通过邮件申请'],
  ['Conta eliminada.', 'Account deleted.', 'Compte supprimé.', '账户已删除。'],
  ['Confirmação incorreta.', 'Incorrect confirmation.', 'Confirmation incorrecte.', '确认信息不正确。'],
  ['Denunciar', 'Report', 'Signaler', '举报'],
  ['Denunciar anúncio', 'Report listing', 'Signaler l’annonce', '举报该发布'],
  ['Denunciar perfil', 'Report profile', 'Signaler le profil', '举报该资料'],
  ['Motivo', 'Reason', 'Motif', '原因'],
  ['Spam ou publicidade', 'Spam or advertising', 'Spam ou publicité', '垃圾信息或广告'],
  ['Fraude ou burla', 'Fraud or scam', 'Fraude ou arnaque', '欺诈或诈骗'],
  ['Assédio ou conteúdo ofensivo', 'Harassment or offensive content', 'Harcèlement ou contenu offensant', '骚扰或冒犯性内容'],
  ['Conteúdo ilegal', 'Illegal content', 'Contenu illégal', '违法内容'],
  ['Perfil ou anúncio falso', 'Fake profile or listing', 'Faux profil ou fausse annonce', '虚假资料或发布'],
  ['Outro motivo', 'Other reason', 'Autre motif', '其他原因'],
  ['Detalhes (opcional)', 'Details (optional)', 'Détails (facultatif)', '详情（可选）'],
  ['Enviar denúncia', 'Send report', 'Envoyer le signalement', '提交举报'],
  ['Denúncia enviada. Obrigado por ajudar a manter o Aquipay seguro.', 'Report sent. Thank you for helping keep Aquipay safe.', 'Signalement envoyé. Merci de contribuer à la sécurité d’Aquipay.', '举报已提交。感谢你帮助维护 Aquipay 的安全。'],
  ['Não foi possível enviar a denúncia. Tenta novamente.', 'Could not send the report. Try again.', 'Impossible d’envoyer le signalement. Réessayez.', '无法提交举报，请重试。'],
  ['Inicia sessão com ligação à internet para denunciar.', 'Sign in with an internet connection to report.', 'Connectez-vous avec une connexion Internet pour signaler.', '请联网并登录后再举报。'],
  ['Denúncia inválida.', 'Invalid report.', 'Signalement invalide.', '举报无效。'],
  ['Bloquear', 'Block', 'Bloquer', '屏蔽'],
  ['Bloquear utilizador', 'Block user', 'Bloquer l’utilisateur', '屏蔽用户'],
  ['Bloquear {a}?', 'Block {a}?', 'Bloquer {a} ?', '屏蔽 {a}？'],
  ['Deixarás de ver os anúncios e o perfil desta pessoa, e ela não poderá enviar-te propostas.', 'You will no longer see this person’s listings and profile, and they won’t be able to send you proposals.', 'Vous ne verrez plus les annonces ni le profil de cette personne, et elle ne pourra plus vous envoyer de propositions.', '你将不再看到此人的发布和资料，对方也无法向你发送提案。'],
  ['Utilizador bloqueado.', 'User blocked.', 'Utilisateur bloqué.', '已屏蔽该用户。'],
  ['Utilizadores bloqueados', 'Blocked users', 'Utilisateurs bloqués', '已屏蔽的用户'],
  ['Não bloqueaste ninguém.', 'You haven’t blocked anyone.', 'Vous n’avez bloqué personne.', '你还没有屏蔽任何人。'],
  ['Desbloquear', 'Unblock', 'Débloquer', '取消屏蔽'],
  ['Utilizador desbloqueado.', 'User unblocked.', 'Utilisateur débloqué.', '已取消屏蔽。'],
  ['Não é possível enviar propostas a este utilizador.', 'You can’t send proposals to this user.', 'Vous ne pouvez pas envoyer de propositions à cet utilisateur.', '无法向该用户发送提案。'],
  ['A nova palavra-passe tem de ser diferente da atual.', 'The new password must be different from the current one.', 'Le nouveau mot de passe doit être différent de l’actuel.', '新密码不能与当前密码相同。'],

  /* ——— descrição do site ——— */
  ['Trabalhos, produtos e serviços no Aquipay', 'Jobs, products and services on Aquipay', 'Emplois, produits et services sur Aquipay', '在 Aquipay 上找工作、产品和服务'],
];

/* tabelas: pt → texto, por idioma */
const TR = { en: new Map(), fr: new Map(), zh: new Map() };
for (const [pt, en, fr, zh] of DICT) { if (!TR.en.has(pt)) { TR.en.set(pt, en); TR.fr.set(pt, fr); TR.zh.set(pt, zh); } }

/* padrões: texto com {n}, {a}, {b}, {d} vira expressão regular (só para textos com marcadores) */
const PATS = [];
for (const [pt, en, fr, zh] of DICT) {
  if (!/\{[nabd]\}/.test(pt)) continue;
  const names = [];
  const src = pt.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{([nabd])\}/g, (_, k) => { names.push(k); return k === 'n' ? '(\\d+(?:[.,]\\d+)?)' : '([\\s\\S]+?)'; });
  PATS.push({ re: new RegExp('^' + src + '$'), names, en, fr, zh });
}
/* mais específicos primeiro (mais caracteres fixos) */
PATS.sort((x, y) => y.re.source.length - x.re.source.length);

const fill = (s, p) => s.replace(/\{([nabd])\}/g, (_, k) => (p && p[k] != null ? p[k] : ''));

/* T: traduz um texto-fonte em português. p = valores para {n},{a},{b},{d}. */
function T(s, p) {
  if (typeof s !== 'string' || !s) return s;
  if (LANG === 'pt') return p ? fill(s, p) : s;
  const m = TR[LANG].get(s);
  if (m !== undefined) return p ? fill(m, p) : m;
  if (p) return fill(s, p);
  const t = s.trim();
  if (t !== s) { const x = TR[LANG].get(t); if (x !== undefined) return s.slice(0, s.indexOf(t)) + x + s.slice(s.indexOf(t) + t.length); }
  for (const pat of PATS) {
    const r = pat.re.exec(t);
    if (!r) continue;
    const vals = {}; pat.names.forEach((k, i) => { vals[k] = r[i + 1] });
    /* os valores que são dados do utilizador (nomes, títulos) não se traduzem; datas e números ficam como vêm */
    const out = fill(pat[LANG], vals);
    return s.slice(0, s.indexOf(t)) + out + s.slice(s.indexOf(t) + t.length);
  }
  return s;
}

/* data por idioma (mês e ano; dia completo) */
const DL = () => LOCALES[LANG] || 'pt-PT';
const fmtMonth = ts => new Date(ts).toLocaleDateString(DL(), { month: 'long', year: 'numeric' });
const fmtDate = ts => new Date(ts).toLocaleDateString(DL(), { day: 'numeric', month: 'long', year: 'numeric' });

/* ——— tradução do DOM ——— */
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
function trNode(n) {
  if (LANG === 'pt' || n.nodeType !== 3) return;
  const p = n.parentNode;
  if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('.langbar,[translate=no]'))) return;
  const v = n.nodeValue;
  if (!v || !v.trim() || n.__tr === v) return;
  const out = T(v);
  if (out !== v) { n.nodeValue = out; n.__tr = out; }
}
function trEl(el) {
  if (LANG === 'pt' || !el || el.nodeType !== 1) return;
  if (el.closest && el.closest('.langbar,[translate=no]')) return;
  for (const a of ATTRS) {
    if (el.hasAttribute(a)) { const v = el.getAttribute(a), out = T(v); if (out !== v) el.setAttribute(a, out) }
  }
}
function i18nApply(root) {
  if (LANG === 'pt' || !root) return;
  if (root.nodeType === 3) return trNode(root);
  if (root.nodeType !== 1) return;
  trEl(root);
  root.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(trEl);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = []; let n; while ((n = w.nextNode())) list.push(n);
  list.forEach(trNode);
}
let i18nObs = null;
function i18nWatch() {
  if (i18nObs || typeof MutationObserver === 'undefined') return;
  i18nObs = new MutationObserver(ms => {
    if (LANG === 'pt') return;
    for (const m of ms) {
      if (m.type === 'characterData') trNode(m.target);
      else m.addedNodes.forEach(i18nApply);
    }
  });
  i18nObs.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function langPick() {
  let saved = null;
  try { saved = localStorage.getItem('aquipay.lang') } catch { }
  const q = new URLSearchParams(location.search).get('lang');
  const ok = c => LANGS.some(l => l[0] === c);
  if (q && ok(q)) return q;
  if (saved && ok(saved)) return saved;
  const nav = (navigator.languages && navigator.languages[0] || navigator.language || 'pt').toLowerCase();
  for (const c of ['pt', 'en', 'fr', 'zh']) if (nav.startsWith(c)) return c;
  return 'pt';
}
function setLang(code) {
  if (!LANGS.some(l => l[0] === code)) code = 'pt';
  LANG = code;
  try { localStorage.setItem('aquipay.lang', code) } catch { }
  document.documentElement.lang = code === 'zh' ? 'zh-CN' : code;
  const d = document.querySelector('meta[name=description]');
  if (d) d.content = T('Trabalhos, produtos e serviços no Aquipay');
}
function langbar() {
  return '<div class="langbar" role="group" aria-label="' + T('Idioma') + '">' + LANGS.map(([c, l, n]) =>
    '<button class="lb' + (c === LANG ? ' on' : '') + '" data-a="lang" data-id="' + c + '" lang="' + (c === 'zh' ? 'zh-CN' : c) + '" aria-label="' + n + '" aria-pressed="' + (c === LANG) + '">' + l + '</button>').join('') + '</div>';
}
setLang(langPick());
i18nWatch();