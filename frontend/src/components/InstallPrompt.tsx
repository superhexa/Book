/**
 * InstallPrompt — PWA install banner (Arabic, RTL).
 *
 * Usage (Expo web): render <InstallPrompt /> once near the app root, e.g. in
 * the root layout. It is a no-op on native and when the app is already
 * installed / the banner was dismissed.
 *
 * Behaviour:
 *  - Android/desktop Chrome: captures `beforeinstallprompt` and shows a
 *    "ثبّت التطبيق" banner with تثبيت / لاحقاً actions.
 *  - iOS Safari (no beforeinstallprompt): shows a one-time hint explaining
 *    Share → "إضافة إلى الشاشة الرئيسية".
 *  - Dismissal is remembered in localStorage (`turfbook-install-dismissed`).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const DISMISS_KEY = 'turfbook-install-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* storage unavailable — still show */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS has no beforeinstallprompt: show the manual-install hint once.
    if (isIOS()) {
      setShowIOSHint(true);
      setVisible(true);
    }

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {}
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  const install = async () => {
    if (!deferred) {
      dismiss();
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {}
    }
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.textWrap}>
        <Text style={styles.title}>ثبّت تطبيق ترف بوك</Text>
        <Text style={styles.subtitle}>
          {showIOSHint && !deferred
            ? 'على آيفون: اضغط زر المشاركة ثم اختر "إضافة إلى الشاشة الرئيسية"'
            : 'وصول أسرع إلى حجوزاتك وإشعارات فورية للمباريات'}
        </Text>
      </View>
      <View style={styles.actions}>
        {!showIOSHint || deferred ? (
          <Pressable style={styles.installBtn} onPress={install}>
            <Text style={styles.installText}>تثبيت</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.laterBtn} onPress={dismiss}>
          <Text style={styles.laterText}>لاحقاً</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'fixed' as any,
    bottom: 16,
    right: 16,
    left: 16,
    zIndex: 50,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0b3d2e',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  textWrap: { flex: 1, marginLeft: 12 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row-reverse', alignItems: 'center' },
  installBtn: {
    backgroundColor: '#f5b301',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  installText: { color: '#0b3d2e', fontWeight: '700', fontSize: 14 },
  laterBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  laterText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
});
