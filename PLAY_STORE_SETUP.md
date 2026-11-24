# AquiPay — Google Play Billing

## Preços comerciais oficiais do AquiPay

Os preços abaixo são definidos pelo AquiPay. A Google Play é o meio de pagamento Android e aplica a conversão/localização de preço para cada mercado.

| Product ID | Moedas pagas | Bónus grátis | Total creditado | Preço de referência |
|---|---:|---:|---:|---:|
| `coins_10` | 10 | 0 | 10 | **US$ 1** |
| `coins_50` | 50 | 0 | 50 | **US$ 5** |
| `coins_110` | 100 | 10 | 110 | **US$ 10** |
| `coins_240` | 200 | 40 | 240 | **US$ 20** |
| `coins_650` | 500 | 150 | 650 | **US$ 50** |

**AquiPay Plus:** US$ 20 por mês, subscrição com renovação automática.

Regra comercial: 10 moedas pagas = US$ 1. Os bónus são moedas adicionais gratuitas, não alteram o preço.

## Identificação da aplicação

- Package name: `com.aquipay.isabstudio`
- Worker: `aquipay-api`
- API de validação: `POST /api/billing/google/verify`
- Plugin: `@capgo/native-purchases`
- Base de dados: Cloudflare D1 `aquipay-db`

## Configuração dos produtos na Google Play

Criar estes IDs exatamente como estão na tabela. Os cinco pacotes são produtos únicos consumíveis. Criar também:
- Product ID Plus: `aquipay_plus`
- Base plan ID: `monthly`
- Período: 1 mês
- Preço-base: US$ 20 por mês

**Importante:** a Google Play exige que o preço de cada produto seja configurado no Play Console. Define ali os preços-base acima e confirma os preços localizados para os países onde o AquiPay estará disponível. O texto apresentado pela aplicação não será substituído pelo preço devolvido pelo catálogo da loja; a loja continua a cobrar o valor configurado no Play Console.

Se os IDs finais forem diferentes, atualiza `PLAY_PRODUCTS` em `site/js/purchases.js`, `GOOGLE_PLAY_COIN_PRODUCTS` no Worker e as variáveis `GOOGLE_PLAY_PLUS_PRODUCT_ID` / `GOOGLE_PLAY_PLUS_BASE_PLAN_ID`.

## Validação segura

1. A aplicação inicia a compra pelo Google Play Billing.
2. Envia o purchase token para o Worker autenticado.
3. O Worker confirma a compra na Google Play Developer API.
4. O servidor credita apenas as moedas pagas mais o bónus definido no catálogo oficial.
5. O token é protegido por hash e a chave de idempotência impede creditações duplicadas.
6. A subscrição Plus é validada pelo servidor através da Google Play Developer API.

## Credenciais necessárias

No Cloudflare Worker `aquipay-api`, manter o secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` com a conta de serviço autorizada no Play Console. Nunca colocar a chave privada no GitHub ou na aplicação.

## Testes antes da produção

- Criar os produtos e preços no Play Console.
- Configurar a conta de serviço e a API Android Publisher.
- Enviar AAB para faixa de teste interno.
- Testar os cinco pacotes, Plus, cancelamento e compra repetida.
- Confirmar que o saldo só aumenta depois da validação no servidor.

## Estado

- [x] Preços comerciais e bónus definidos no código do AquiPay.
- [x] Catálogo do Worker atualizado para creditar os totais corretos.
- [x] Interface deixa de apresentar “Preço na Google Play”.
- [ ] Configurar os preços correspondentes no Play Console.
- [ ] Confirmar os IDs definitivos e o produto Plus.
- [ ] Testar compras reais na faixa interna antes da publicação.
