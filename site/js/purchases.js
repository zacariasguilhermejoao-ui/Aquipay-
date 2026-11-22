/**
 * Aquipay - Google Play Billing (moedas)
 * Usa @capgo/native-purchases
 */

import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Capacitor } from '@capacitor/core';

// Mapeamento Product ID → quantidade de moedas
export const COIN_PRODUCTS = {
  coins_10:  { coins: 10,  bonus: 0 },
  coins_50:  { coins: 50,  bonus: 0 },
  coins_110: { coins: 110, bonus: 10 },
  coins_240: { coins: 240, bonus: 40 },
  coins_650: { coins: 650, bonus: 150 },
};

/**
 * Verifica se estamos na app nativa Android
 */
export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Inicializa o sistema de compras (chamar no arranque da app)
 */
export async function initPurchases() {
  if (!isNativeAndroid()) return { ok: false, reason: 'web' };

  try {
    // O plugin trata da ligação ao Play Billing automaticamente
    return { ok: true };
  } catch (e) {
    console.error('Erroases init error:', e);
    return { ok: false, reason: e?.message || 'erro' };
  }
}

/**
 * Compra um pacote de moedas
 * @param {string} productId - ex: 'coins_50'
 * @returns {Promise<{success: boolean, coins?: number, error?: string}>}
 */
export async function buyCoins(productId) {
  if (!isNativeAndroid()) {
    return { success: false, error: 'Compras só disponíveis na app Android' };
  }

  const pack = COIN_PRODUCTS[productId];
  if (!pack) {
    return { success: false, error: 'Produto inválido' };
  }

  try {
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.INAPP,
    });

    // Sucesso → creditar moedas
    const totalCoins = pack.coins + (pack.bonus || 0);

    // Aqui deves chamar o teu backend para creditar as moedas de forma segura
    // Exemplo:
    // await api('/api/coins/purchase', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     productId,
    //     purchaseToken: result.purchaseToken,
    //     orderId: result.orderId
    //   })
    // });

    return {
      success: true,
      coins: totalCoins,
      productId,
      // Guarda estes dados se quiseres validar no servidor
      purchaseToken: result?.purchaseToken,
      orderId: result?.orderId,
    };
  } catch (e) {
    // Utilizador cancelou ou erro
    const msg = e?.message || String(e);
    if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user')) {
      return { success: false, error: 'Compra cancelada' };
    }
    return { success: false, error: msg };
  }
}

/**
 * Restaura compras (útil se o utilizador reinstalou a app)
 * Nota: moedas são consumíveis, por isso normalmente não há muito a restaurar
 */
export async function restorePurchases() {
  if (!isNativeAndroid()) return { success: false };

  try {
    await NativePurchases.restorePurchases();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message };
  }
}
