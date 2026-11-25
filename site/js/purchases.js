/**
 * AquiPay — integração segura com Google Play Billing.
 * Os IDs são definidos em PLAY_PRODUCTS depois de serem criados no Play Console.
 * Nunca credita moedas no dispositivo: a confirmação vem exclusivamente do Worker.
 */
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';

export const PLAY_PRODUCTS = {
  coins: [
    { id: 'aquipay_coins_10', coins: 10, bonus: 0, priceUsd: 0.99 },
    { id: 'aquipay_coins_50', coins: 50, bonus: 0, priceUsd: 4.99 },
    { id: 'aquipay_coins_110', coins: 100, bonus: 10, priceUsd: 9.99 },
    { id: 'aquipay_coins_240', coins: 200, bonus: 40, priceUsd: 19.99 },
    { id: 'aquipay_coins_650', coins: 500, bonus: 150, priceUsd: 49.99 },
  ],
  plus: { id: 'aquipay_plus_monthly', basePlanId: 'monthly' },
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
  if (!PLAY_PRODUCTS.plus.id || !PLAY_PRODUCTS.plus.basePlanId) throw new Error('O produto e o plano mensal Plus não estão configurados.');
  if (!billingReady) {
    const ready = await initPurchases();
    if (!ready.ok) throw new Error('A Google Play Billing não está disponível neste dispositivo.');
  }
  const { products } = await NativePurchases.getProducts({ productIdentifiers: [PLAY_PRODUCTS.plus.id], productType: PURCHASE_TYPE.SUBS });
  return products || [];
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
  if (!id || !basePlanId) throw new Error('O produto e o plano mensal Plus não estão configurados.');
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

export async function syncPlusSubscription(api) {
  if (!nativeAndroid() || !PLAY_PRODUCTS.plus.id || !api) return { synced: false };
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
  const found = (purchases || []).find(p =>
    p?.purchaseToken &&
    [p.productIdentifier, p.productId, p.planIdentifier].includes(PLAY_PRODUCTS.plus.id)
  );
  if (!found) return { synced: false };
  await sendForVerification(api, 'plus', PLAY_PRODUCTS.plus.id, found);
  return { synced: true };
}

export async function restorePurchases(api) {
  if (!nativeAndroid()) return { success: false, reason: 'android_only' };
  await NativePurchases.restorePurchases();
  const synced = api ? await syncPlusSubscription(api) : { synced: false };
  return { success: true, synced: synced.synced };
}
