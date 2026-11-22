# Aquipay - Prep Play Store (Capacitor + Moedas + Permissões)

## O que está preparado

- `package.json` com Capacitor 7 + plugins:
  - `@capacitor/geolocation` (localização)
  - `@capacitor/push-notifications`
  - `@capgo/native-purchases` (Google Play Billing para moedas)
  - status-bar, splash, network, etc.

- `capacitor.config.ts` configurado:
  - appId: `dev.isabstudio.aquipay`
  - webDir: `site`

- `AndroidManifest.xml` com as permissões:
  - Localização (COARSE + FINE)
  - POST_NOTIFICATIONS
  - BILLING
  - CAMERA (opcional)

## Onde colocar cada ficheiro

1. `package.json` → raiz do projeto
2. `capacitor.config.ts` → raiz do projeto
3. `AndroidManifest.xml` → `android/app/src/main/AndroidManifest.xml` (depois de correr `npx cap add android`)

## Comandos no teu computador

```bash
npm install
npx cap add android
npx cap sync
npx cap open android
```

## Produtos de moedas (Play Console)

Cria estes produtos **Consumable**:

| Product ID   | Moedas | Preço sugerido |
|--------------|--------|----------------|
| coins_10     | 10     | 0.99 USD       |
| coins_50     | 50     | 4.99 USD       |
| coins_110    | 110    | 9.99 USD       |
| coins_240    | 240    | 19.99 USD      |
| coins_650    | 650    | 49.99 USD      |

## Permissões importantes

- Localização precisa (FINE) precisa de justificação no Play Console.
- Preferir pedir só COARSE quando der.
- Não uses READ_MEDIA_* se não for necessário (usa Photo Picker).

## Fluxo de compra de moedas

Usar `@capgo/native-purchases`:

```ts
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

// Comprar
await NativePurchases.purchaseProduct({
  productIdentifier: 'coins_50',
  productType: PURCHASE_TYPE.INAPP
});
```

Depois de sucesso, creditar as moedas no backend e consumir a compra.
