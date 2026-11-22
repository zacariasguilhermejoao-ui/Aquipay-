/**
 * Aquipay - Localização nativa
 * Usa @capacitor/geolocation
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

/**
 * Verifica e pede permissão de localização
 */
export async function checkLocationPermission() {
  if (!Capacitor.isNativePlatform()) {
    // No browser usamos a API web
    if (!navigator.geolocation) return { granted: false, reason: 'não suportado' };
    return { granted: true, web: true };
  }

  try {
    const status = await Geolocation.checkPermissions();
    return {
      granted: status.location === 'granted',
      status: status.location, // 'granted' | 'denied' | 'prompt'
    };
  } catch (e) {
    return { granted: false, reason: e?.message };
  }
}

/**
 * Pede permissão ao utilizador
 */
export async function requestLocationPermission() {
  if (!Capacitor.isNativePlatform()) {
    return checkLocationPermission();
  }

  try {
    const status = await Geolocation.requestPermissions();
    return {
      granted: status.location === 'granted',
      status: status.location,
    };
  } catch (e) {
    return { granted: false, reason: e?.message };
  }
}

/**
 * Obtém a posição atual
 * @param {object} options
 * @param {boolean} options.precise - true = FINE, false = COARSE (recomendado)
 */
export async function getCurrentPosition({ precise = false } = {}) {
  const perm = await checkLocationPermission();
  if (!perm.granted) {
    const req = await requestLocationPermission();
    if (!req.granted) {
      return { success: false, error: 'Permissão de localização negada' };
    }
  }

  try {
    if (Capacitor.isNativePlatform()) {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: precise,
        timeout: 15000,
        maximumAge: 60000,
      });

      return {
        success: true,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        precise,
      };
    } else {
      // Fallback web
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              success: true,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              precise: false,
            });
          },
          (err) => {
            resolve({ success: false, error: err.message });
          },
          { enableHighAccuracy: precise, timeout: 15000, maximumAge: 60000 }
        );
      });
    }
  } catch (e) {
    return { success: false, error: e?.message || 'Erro ao obter localização' };
  }
}

/**
 * Helper: pede localização e devolve cidade aproximada (via reverse geocoding simples)
 * Nota: para produção, usa um serviço de reverse geocoding (Nominatim, Google, etc.)
 */
export async function getCityFromLocation() {
  const pos = await getCurrentPosition({ precise: false }); // preferir coarse
  if (!pos.success) return pos;

  // Aqui podes chamar um serviço de reverse geocoding
  // Exemplo com Nominatim (gratuito, mas tem limites):
  /*
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json`
    );
    const data = await res.json();
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state;
    return { success: true, city, lat: pos.lat, lng: pos.lng };
  } catch {
    return { success: true, city: null, lat: pos.lat, lng: pos.lng };
  }
  */

  return {
    success: true,
    city: null, // preencher depois com reverse geocoding
    lat: pos.lat,
    lng: pos.lng,
  };
}
