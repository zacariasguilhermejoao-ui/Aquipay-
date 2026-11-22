import { PushNotifications } from '@capacitor/push-notifications';

// Expose only the official Capacitor plugin API to the existing plain-JS app.
window.AquipayNativePush = PushNotifications;
