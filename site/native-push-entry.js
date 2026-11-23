import { PushNotifications } from '@capacitor/push-notifications';

// Expose only the official Capacitor plugin API to the existing plain-JS app.
window.AquipayNativePush = PushNotifications;

import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

window.AquipayNativeSecurity = {
  checkBiometry: () => BiometricAuth.checkBiometry(),
  authenticate: (options = {}) => BiometricAuth.authenticate({
    reason: 'Confirma a tua identidade para proteger o AquiPay.',
    allowDeviceCredential: true,
    androidTitle: 'Segurança do AquiPay',
    androidSubtitle: 'Confirma a tua identidade',
    androidConfirmationRequired: false,
    ...options
  }),
  secureGet: async key => (await SecureStoragePlugin.get({ key })).value,
  secureSet: async (key, value) => SecureStoragePlugin.set({ key, value }),
  secureRemove: async key => SecureStoragePlugin.remove({ key }),
  secureKeys: async () => (await SecureStoragePlugin.keys()).value
};
