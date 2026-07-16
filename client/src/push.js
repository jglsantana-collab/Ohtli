import { api } from './api.js';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error('Este navegador no soporta notificaciones push.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado.');

  const { publicKey } = await api.pushPublicKey();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
  await api.pushSubscribe(sub.toJSON());
  return sub;
}

export async function unsubscribeFromPush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint);
  await sub.unsubscribe();
}
