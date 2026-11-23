/**
 * AquiPay — integração segura com Google Play Billing.
 * Os IDs são definidos em PLAY_PRODUCTS depois de serem criados no Play Console.
 * Nunca credita moedas no dispositivo: a confirmação vem exclusivamente do Worker.
 */
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';

export const PLAY_PRODUCTS = {
  coins: [
    { id: 'coins_10', coins: 10, bonus: 0 },
    { id: 'coins_50', coins: 50, bonus: 0 },
    { id: 'coins_110', coins: 110, bonus: 10 },
    { id: 'coins_240', coins: 240, bonus: 40 },
    { id: 'coins_650', coins: 650, bonus: 150 },
  ],
  plus: { id: '', basePlanId: '' },
};

const nativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
let billingReady = false;

export async function initPurchases() {
  if (!nativeAndroid()) return { ok: false, reason: 'android_only' };
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    billingReady = !!isBillingSupported;
    return { ok: billingReady, reason: billingReady ? null : 'billing_unavailable' };
  } catch (error) {
    billingReady = false;
    return { ok: false, reason: error?.message || 'billing_error' };
  }
}

export async function loadCoinProducts() {
  if (!nativeAndroid()) throw new Error('Compras disponíveis apenas na aplicação Android.');
  if (!billingReady) {
    const ready = await initPurchases();
    if (!ready.ok) throw new Error('A Google Play Billing não está disponível neste dispositivo.');
  }
  const ids = PLAY_PRODUCTS.coins.map(x => x.id);
  const { products } = await NativePurchases.getProducts({ productIdentifiers: ids, productType: PURCHASE_TYPE.INAPP });
  return products || [];
}

export async function loadPlusProduct() {
  if (!nativeAndroid()) throw new Error('O Plus só pode ser comprado na aplicação Android.');
  if (!PLAY_PRODUCTS.plus.id || !PLAY_PRODUCTS.plus.basePlanId) throw new Error('O produto e o plano mensal Plus serão ligados quando forem criados no Play Console.');
  if (!billingReady) {
    const ready = await initPurchases();
    if (!ready.ok) throw new Error('A Google Play Billing não está disponível neste dispositivo.');
  }
  const { products } = await NativePurchases.getProducts({ productIdentifiers: [PLAY_PRODUCTS.plus.id], productType: PURCHASE_TYPE.SUBS });
  return (products || []).filter(p => p.identifier === PLAY_PRODUCTS.plus.basePlanId || p.planIdentifier === PLAY_PRODUCTS.plus.id);
}

async function sendForVerification(api, type, productId, transaction) {
  const purchaseToken = transaction?.purchaseToken;
  if (!purchaseToken) throw new Error('A Google Play não devolveu o token da compra. Não foi efetuada qualquer creditação.');
  return api('/api/billing/google/verify', {
    method: 'POST',
    body: JSON.stringify({ type, productId, purchaseToken }),
  });
}

export async function buyCoins(productId, api) {
  if (!nativeAndroid()) throw new Error('Compras só disponíveis na aplicação Android.');
  const pack = PLAY_PRODUCTS.coins.find(x => x.id === productId);
  if (!pack) throw new Error('Pacote de moedas inválido.');
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.INAPP,
    quantity: 1,
    isConsumable: true,
    autoAcknowledgePurchases: false,
  });
  const verified = await sendForVerification(api, 'coins', productId, transaction);
  return { success: true, credited: verified.credited === true, balance: verified.coins, productId };
}

export async function buyPlus(api) {
  if (!nativeAndroid()) throw new Error('O Plus só pode ser comprado na aplicação Android.');
  const { id, basePlanId } = PLAY_PRODUCTS.plus;
  if (!id || !basePlanId) throw new Error('O produto e o plano mensal Plus ainda não foram ligados ao Play Console.');
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: id,
    planIdentifier: basePlanId,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
    autoAcknowledgePurchases: false,
  });
  const verified = await sendForVerification(api, 'plus', id, transaction);
  return { success: true, plusActive: verified.plusActive === true, expiresAt: verified.expiresAt };
}

export async function restorePurchases() {
  if (!nativeAndroid()) return { success: false, reason: 'android_only' };
  await NativePurchases.restorePurchases();
  return { success: true, message: 'Compras recuperadas. O estado e os direitos devem ser sincronizados com o servidor.' };
}
