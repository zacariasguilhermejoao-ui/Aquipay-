import { SocialLogin } from '@capgo/capacitor-social-login';

let initialized = false;
let configuredClientId = '';

async function initialize(webClientId) {
  if (!webClientId || !String(webClientId).endsWith('.apps.googleusercontent.com')) {
    throw new Error('O Client ID Web do Google não está configurado corretamente.');
  }
  if (initialized && configuredClientId === webClientId) return;
  await SocialLogin.initialize({
    google: {
      webClientId,
      mode: 'online',
      skipAuthOnlyAuthorizationAfterSignIn: true
    }
  });
  initialized = true;
  configuredClientId = webClientId;
}

window.AquipayNativeGoogle = {
  login: async webClientId => {
    await initialize(webClientId);
    const response = await SocialLogin.login({ provider: 'google', options: {} });
    const token = response?.result?.idToken;
    if (!token) throw new Error('O Google não devolveu um token de autenticação. Confirma a configuração OAuth Android.');
    return token;
  }
};
