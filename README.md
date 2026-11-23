# Aquipay

- `site/`: o site (PWA). Publicado no worker `ancient-star-9c8c`, domínio `aquipay.isabstudio.dev`.
- `backend/`: a API (`aquipay-api`), com D1 `aquipay-db` e R2 `aquipay-blobs`.

## Regra de ouro: nunca pôr segredos no GitHub
Os segredos vivem só na Cloudflare e nunca entram no repositório:
- `VAPID_PRIVATE_KEY` (chave privada das notificações push)
- `GOOGLE_CLIENT_ID` (o ID não é secreto, mas está guardado como segredo no worker)
- `FIREBASE_SERVICE_ACCOUNT_B64` (JSON da conta de serviço Firebase codificado em Base64; guardar como Secret Text para enviar FCM HTTP v1)

Se publicares a API com `wrangler deploy`, os segredos já existentes mantêm-se.
Para os recriar: `wrangler secret put GOOGLE_CLIENT_ID`. Se regenerares a chave VAPID,
todos os utilizadores têm de voltar a ativar as notificações.

## Publicar
    cd backend && npx wrangler deploy
    cd site    && npx wrangler deploy

## Base de dados
`backend/migrations/` guarda o histórico do esquema (já aplicado). Novas alterações entram
como `000X_...sql` e correm com:

    npx wrangler d1 execute aquipay-db --remote --file=migrations/000X_nome.sql

## Notificações Android
A APK usa `@capacitor/push-notifications` com Firebase Cloud Messaging. O token FCM é associado à sessão autenticada em `POST /api/push/fcm/register`; o Worker envia mensagens HTTP v1 usando `FIREBASE_SERVICE_ACCOUNT_B64`. O sistema Web Push (VAPID) continua ativo para navegadores.

## Atenção
- Os Workers só aceitam PBKDF2 até 100 000 iterações (`passHash` já usa esse valor).
- O CSP e os cabeçalhos estão em `site/_headers`.
- Rever os textos legais com um advogado angolano antes de abrir ao público.

## Google: site e APK
`GOOGLE_CLIENT_ID` aceita vários IDs separados por vírgula (ex.: `ID_WEB,ID_ANDROID`).
Na APK nativa, usa o ID **Web** como `serverClientId` e envia o `idToken` para `POST /api/auth/google` (`{"credential": "<idToken>"}`).
Para o login nativo funcionar, regista os SHA-1/SHA-256 da APK no Firebase e volta a descarregar o `google-services.json`.


## SEO e navegação
- A página inicial inclui metadados básicos para motores de busca e pré-visualizações em redes sociais.
- O sitemap está em `site/sitemap.xml` e as regras de indexação em `site/robots.txt`.
- O Worker do site usa `not_found_handling: single-page-application` para permitir abrir diretamente as rotas internas da aplicação.


## Idiomas e segurança da conta
- A interface suporta português, inglês, francês e chinês; as traduções ficam em `site/i18n.js`.
- As páginas de termos, privacidade e ajuda ficam em `site/legal.js`.
- Inclui recuperação de palavra-passe, alteração de palavra-passe, eliminação de conta, exportação dos dados, denúncias e bloqueio/desbloqueio de utilizadores.
- A API filtra perfis bloqueados nas pesquisas e impede propostas entre utilizadores que se bloquearam.
- O esquema de segurança está em `backend/migrations/0006_account_safety.sql`. As tabelas `reports`, `blocks` e `password_resets` foram confirmadas na D1 de produção.
- A recuperação por email usa o binding Cloudflare `EMAIL` e o remetente `MAIL_FROM`. Para enviar mensagens reais, é necessário ativar Email Sending para `isabstudio.dev` na Cloudflare.
- O Service Worker usa a cache `aquipay-v13` para carregar os novos ficheiros de idioma e páginas legais.
