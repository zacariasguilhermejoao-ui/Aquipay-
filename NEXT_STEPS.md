# Próximos passos - Aquipay Play Store

## 1. Colocar os ficheiros no projeto

Na raiz do repositório:
- package.json
- capacitor.config.ts

Depois de `npx cap add android`:
- Substituir `android/app/src/main/AndroidManifest.xml` pelo que te dei

Opcional (recomendado):
- Criar pasta `site/js/` e meter lá:
  - purchases.js
  - location.js

## 2. Comandos

```bash
npm install
npx cap add android
npx cap sync
npx cap open android
```

## 3. No Android Studio

- Espera o Gradle sincronizar
- Verifica se o appId está correto: `dev.isabstudio.aquipay`
- Gera um keystore para assinatura (se ainda não tiveres)
- Cria um build de teste (Build → Generate Signed Bundle / APK)

## 4. Play Console - Produtos de moedas

Vai a: Monetizar com o Play → Produtos → Produtos na aplicação

Cria estes produtos como **Consumíveis**:

| ID do produto | Nome                  | Descrição                  |
|---------------|-----------------------|----------------------------|
| coins_10      | 10 Moedas             | Pacote de 10 moedas        |
| coins_50      | 50 Moedas             | Pacote de 50 moedas        |
| coins_110     | 110 Moedas (+10 bónus)| Pacote de 110 moedas       |
| coins_240     | 240 Moedas (+40 bónus)| Pacote de 240 moedas       |
| coins_650     | 650 Moedas (+150 bónus)| Pacote de 650 moedas      |

## 5. Integração no app.js (resumo)

```js
// No início
import { buyCoins, initPurchases, COIN_PRODUCTS } from './js/purchases.js';
import { getCurrentPosition, requestLocationPermission } from './js/location.js';

// No arranque
await initPurchases();

// Quando o utilizador clica num pacote de moedas
async function comprar(productId) {
  const res = await buyCoins(productId);
  if (res.success) {
    // Creditar moedas no utilizador + chamar backend
    toast(`Recebeste ${res.coins} moedas!`);
  } else {
    toast(res.error || 'Erro na compra');
  }
}
```

## 6. Data Safety e Localização

No Play Console → Conteúdo da aplicação → Segurança dos dados:
- Declarar que recolhes localização aproximada / precisa
- Explicar: "Para mostrar trabalhos e oportunidades perto de ti"

Na declaração de permissões sensíveis (se pedir FINE):
- Justificar porque precisas de localização precisa

## 7. Testar compras

- Adiciona contas de teste em: Configuração → Licenças de teste
- Usa build interno / closed testing
- As compras de teste não cobram dinheiro real
