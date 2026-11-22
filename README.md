# Aquipay

- `site/`: o site (PWA). Publicado no worker `ancient-star-9c8c`, domínio `aquipay.isabstudio.dev`.
- `backend/`: a API (`aquipay-api`), com D1 `aquipay-db` e R2 `aquipay-blobs`.

## Regra de ouro: nunca pôr segredos no GitHub
Os segredos vivem só na Cloudflare e nunca entram no repositório:
- `VAPID_PRIVATE_KEY` (chave privada das notificações push)
- `GOOGLE_CLIENT_ID` (o ID não é secreto, mas está guardado como segredo no worker)

Se publicares a API com `wrangler deploy`, os segredos já existentes mantêm-se.
Para os recriar: `wrangler secret put GOOGLE_CLIENT_ID`. Se regenerares a chave VAPID,
todos os utilizadores têm de voltar a ativar as notificações.

## Publicar
    cd backend && npx wrangler deploy
    cd site    && npx wrangler deploy

## Base de dados
`backend/migrations/` guarda o histórico do esquema (já aplicado). Novas alterações entram
como `0004_...sql` e correm com:

    npx wrangler d1 execute aquipay-db --remote --file=migrations/0004_nome.sql

## Atenção
- Os Workers só aceitam PBKDF2 até 100 000 iterações (`passHash` já usa esse valor).
- O CSP e os cabeçalhos estão em `site/_headers`.
- Rever os textos legais com um advogado angolano antes de abrir ao público.

## Google: site e APK
`GOOGLE_CLIENT_ID` aceita vários IDs separados por vírgula (ex.: `ID_WEB,ID_ANDROID`).
Na APK nativa, usa o ID **Web** como `serverClientId` e envia o `idToken` para `POST /api/auth/google` (`{"credential": "<idToken>"}`).
Para o login nativo funcionar, regista os SHA-1/SHA-256 da APK no Firebase e volta a descarregar o `google-services.json`.
