# AquiPay — Google Play Billing

Este documento descreve a configuração real das compras Android. O código já valida compras no Worker antes de creditar moedas ou ativar o Plus. **As compras não ficam ativas até os produtos serem criados no Play Console e as credenciais do Google Play serem configuradas no Worker.**

## Identificação da aplicação

- Package name Android: `com.aquipay.isabstudio`
- Worker: `aquipay-api`
- API de validação: `POST /api/billing/google/verify`
- Plugin Android: `@capgo/native-purchases`
- Base de dados: D1 `aquipay-db`

## IDs sugeridos para os pacotes de moedas

Podes criar estes IDs exatamente como estão abaixo. Se escolheres outros IDs no Play Console, será necessário atualizar `GOOGLE_PLAY_COIN_PRODUCTS` no Worker.

| Product ID sugerido | Moedas | Bónus | Total |
|---|---:|---:|---:|
| `coins_10` | 10 | 0 | 10 |
| `coins_50` | 50 | 0 | 50 |
| `coins_110` | 110 | 10 | 120 |
| `coins_240` | 240 | 40 | 280 |
| `coins_650` | 650 | 150 | 800 |

Configura-os como produtos únicos consumíveis (one-time products / consumable). Define os preços no Play Console; a aplicação consulta o preço localizado na Google Play e não deve assumir que o valor em USD será igual em todos os países.

## AquiPay Plus

- Product ID sugerido: `aquipay_plus`
- Base plan ID sugerido: `monthly`
- Tipo: subscrição com renovação automática
- Período: 1 mês
- Preço de referência pretendido: **19,99 USD por mês**

O Product ID e o Base plan ID são campos diferentes. Depois de criares o produto e o plano mensal, configura no Worker:
- `GOOGLE_PLAY_PLUS_PRODUCT_ID` = ID do produto
- `GOOGLE_PLAY_PLUS_BASE_PLAN_ID` = ID do plano base mensal

A aplicação mantém o Plus ativo até ao fim do período pago mesmo quando o utilizador cancela a renovação. Ao iniciar a aplicação, volta a consultar a subscrição na Google Play para atualizar a data de expiração após renovações.

## Configurar a validação do Google Play

1. No Google Cloud, abre o projeto associado à aplicação e ativa **Google Play Android Developer API**.
2. Cria uma conta de serviço e gera uma chave JSON.
3. No Play Console, abre **Utilizadores e permissões / API access** e concede a essa conta de serviço acesso à aplicação, incluindo as permissões necessárias para consultar e gerir compras e subscrições.
4. No Cloudflare, abre **Workers & Pages → aquipay-api → Settings → Variables and Secrets**.
5. Cria um secret chamado `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` e coloca nele o conteúdo completo do ficheiro JSON da conta de serviço.
6. Não coloques a chave privada no GitHub, no código da aplicação ou em mensagens de chat. O JSON deve ficar apenas como secret do Worker.

O Worker já está preparado para usar o package name `com.aquipay.isabstudio` e o catálogo de moedas sugerido. Os IDs e o plano Plus devem coincidir exatamente com o Play Console.

## Como o dinheiro e as moedas são processados

1. A aplicação Android consulta os produtos à Google Play e inicia a janela nativa de compra.
2. O Android devolve um purchase token.
3. A aplicação envia o token e o ID do produto ao Worker autenticado.
4. O Worker consulta a Google Play Developer API e confirma que a compra foi efetivamente concluída e corresponde ao produto solicitado.
5. Para moedas, o Worker regista o token de forma única, credita a carteira e consome o produto para permitir uma nova compra do mesmo pacote.
6. Para o Plus, o Worker confirma o produto, o plano base, o estado e a data de expiração; depois atualiza a subscrição e confirma a compra quando necessário.

O token original nunca é guardado na base de dados: é guardado apenas o seu hash. A chave única impede que a mesma compra credite moedas duas vezes.

## Testes antes de produção

- Envia primeiro um AAB para uma faixa de teste interno.
- Adiciona os testadores como testadores de licença.
- Instala a aplicação a partir do link do Google Play, com a mesma conta Google que está autorizada como testadora.
- Testa cada pacote, uma compra repetida, cancelamento do checkout e a subscrição mensal.
- Confirma no AquiPay que o saldo só aumenta depois da validação no servidor.

## Estado atual

- [x] Código do cliente deixa de declarar sucesso sem validação do servidor.
- [x] Worker consulta a Google Play Developer API para validar produtos e subscrições.
- [x] Tokens de compra são protegidos por hash e têm proteção contra duplicação.
- [x] Carteira e ledger recebem as moedas numa operação de base de dados.
- [x] Subscrição Plus atualiza o estado e a expiração.
- [x] Catálogo de moedas preparado com IDs sugeridos.
- [ ] Criar os produtos de moedas no Play Console.
- [ ] Criar o produto Plus e o plano base mensal.
- [ ] Criar a conta de serviço, dar acesso no Play Console e guardar o JSON como secret no Worker.
- [ ] Ligar os IDs reais do Plus, se forem diferentes dos IDs sugeridos.
- [ ] Fazer compras de teste pela faixa interna antes de publicar.

**Não consideres as compras prontas para receber pagamentos reais até todos os passos pendentes acima estarem concluídos e testados.**
