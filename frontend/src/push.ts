/**
 * Web Push client (Expo web).
 *
 *  - registerServiceWorker(): registers /sw.js on web; no-op elsewhere.
 *  - enablePushNotifications(): asks permission (Arabic UX copy lives in the
 *    calling screen), subscribes via the VAPID public key and POSTs the
 *    subscription to the backend.
 *  - disablePushNotifications(): unsubscribes and tells the backend to forget
 *    the endpoint.
 *
 * Env: EXPO_PUBLIC_VAPID_PUBLIC_KEY (falls back to
 * GET /api/notifications/vapid-public-key at runtime).
 */
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
const SW_PATH = '/sw.js';

function api(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH);
    return reg;
  } catch (e) {
    console.warn('تعذّر تسجيل service worker', e);
    return null;
  }
}

async function getVapidKey(): Promise<string | null> {
  const fromEnv = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromEnv) return fromEnv;
  try {
    const res = await api('/api/notifications/vapid-public-key');
    if (!res.ok) return null;
    const { vapid_public_key } = await res.json();
    return vapid_public_key ?? null;
  } catch {
    return null;
  }
}

export type PushEnableResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-key' | 'failed' };

/**
 * Full enable flow. Call from a user gesture (button) so the permission
 * prompt is allowed. Returns { ok } — the caller shows Arabic toasts:
 *  denied   → "تم رفض الإشعارات من إعدادات المتصفح"
 *  no-key   → "خدمة الإشعارات غير مفعّلة حالياً"
 *  failed   → "تعذّر تفعيل الإشعارات، حاول لاحقاً"
 */
export async function enablePushNotifications(
  deviceName?: string
): Promise<PushEnableResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const vapidKey = await getVapidKey();
  if (!vapidKey) return { ok: false, reason: 'no-key' };

  try {
    const reg = (await navigator.serviceWorker.ready) ?? (await registerServiceWorker());
    if (!reg) return { ok: false, reason: 'failed' };

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const res = await api('/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.toJSON().keys,
        device_name: deviceName,
        platform: 'web',
      }),
    });
    if (!res.ok) return { ok: false, reason: 'failed' };
    return { ok: true };
  } catch (e) {
    console.warn('فشل تفعيل الإشعارات', e);
    return { ok: false, reason: 'failed' };
  }
}

export async function disablePushNotifications(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await api('/api/notifications/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint }),
      });
    }
    return true;
  } catch (e) {
    console.warn('فشل إيقاف الإشعارات', e);
    return false;
  }
}

export async function pushPermissionState(): Promise<NotificationPermission | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}
