import { PushNotifications } from '@capacitor/push-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Expose only the official Capacitor plugin API to the existing plain-JS app.
window.AquipayNativePush = PushNotifications;

// Native tactile feedback for Android; the web app keeps a browser fallback.
window.AquipayFeedback = {
  impact: async kind => {
    if (kind === 'success') return Haptics.notification({ type: NotificationType.Success });
    if (kind === 'error') return Haptics.notification({ type: NotificationType.Error });
    return Haptics.impact({ style: ImpactStyle.Light });
  }
};

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
