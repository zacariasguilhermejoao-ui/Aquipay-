# AquiPay — Google Play Billing

## Produtos configurados no Play Console

Os cinco pacotes são produtos únicos consumíveis. O Plus é uma subscrição com renovação automática.

| Product ID | Moedas base | Bónus | Total creditado | Preço de referência |
|---|---:|---:|---:|---:|
| `aquipay_coins_10` | 10 | 0 | 10 | **US$ 0,99** |
| `aquipay_coins_50` | 50 | 0 | 50 | **US$ 4,99** |
| `aquipay_coins_110` | 100 | 10 | 110 | **US$ 9,99** |
| `aquipay_coins_240` | 200 | 40 | 240 | **US$ 19,99** |
| `aquipay_coins_650` | 500 | 150 | 650 | **US$ 49,99** |

**AquiPay Plus**
- Product ID: `aquipay_plus_monthly`
- Base plan ID: `monthly`
- Renovação automática mensal.
- Preço configurado no Play Console: **19 EUR**. A Google Play apresenta o preço regional aplicável, incluindo a zona USD configurada para Angola.

O preço efetivamente cobrado é o apresentado no ecrã oficial de compra da Google Play.

## Identificação técnica

- Package name: `com.aquipay.isabstudio`
- Cloudflare Worker: `aquipay-api`
- Endpoint: `POST /api/billing/google/verify`
- Plugin Android: `@capgo/native-purchases`
- Base de dados: Cloudflare D1 `aquipay-db`

## Regras de crédito

- `aquipay_coins_10`: 10 moedas.
- `aquipay_coins_50`: 50 moedas.
- `aquipay_coins_110`: 100 moedas pagas + 10 de bónus.
- `aquipay_coins_240`: 200 moedas pagas + 40 de bónus.
- `aquipay_coins_650`: 500 moedas pagas + 150 de bónus.

As moedas são créditos virtuais de utilização dentro do AquiPay. Não são dinheiro, não podem ser levantadas nem transferidas entre utilizadores.

## Configuração no Cloudflare Worker

O ficheiro `backend/wrangler.jsonc` define os IDs dos produtos e da subscrição. A credencial privada não deve ser guardada no GitHub.

Adicionar no Worker `aquipay-api`, em **Settings → Variables and Secrets → Secrets**, o secret:

`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

O valor deve ser o conteúdo integral do JSON da conta de serviço. Nunca o publiques no repositório, APK, AAB ou mensagens públicas.

A conta de serviço precisa de acesso à Google Play Developer API e às permissões necessárias para consultar e gerir compras e subscrições da aplicação.

## Validação das compras

1. O Android inicia a compra através do Google Play Billing.
2. O aplicativo envia o token e o ID exato do produto para o Worker, com a sessão autenticada.
3. O Worker valida o token na Google Play Developer API.
4. Para moedas, o servidor credita o pacote e o bónus do catálogo, com proteção contra duplicação.
5. Para Plus, o servidor valida o produto, o plano mensal e a data de expiração.
6. O Worker consome compras de moedas e confirma subscrições.

## Antes de produção

- [x] IDs dos cinco pacotes alinhados entre app e Worker.
- [x] ID do produto Plus e base plan alinhados.
- [x] Catálogo de moedas atualizado com os bónus corretos.
- [x] Interface deixa de mostrar preços fixos incorretos.
- [ ] Configurar o secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` no Cloudflare.
- [ ] Confirmar permissões da conta de serviço no Play Console.
- [ ] Executar compras de ponta a ponta numa faixa de teste antes do lançamento em produção.
- [ ] Confirmar recuperação, cancelamento, reembolso e revogação de compras/subscrições.

**Nota:** a compilação do APK/AAB não comprova que as compras estão funcionais. A validação real depende da credencial Google e de uma compra reconhecida pela Play Store.
