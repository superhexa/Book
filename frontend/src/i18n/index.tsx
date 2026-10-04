/**
 * i18n setup for Book — Arabic-first (ar-JO default), RTL-native.
 *
 * Exports:
 *   - `I18nProvider`  — wrap the app root with this.
 *   - `useTranslation()` — returns { t, locale, setLocale, isRTL }.
 *   - `DEFAULT_LOCALE`, `FALLBACK_LOCALE`, `RTL_LOCALES`.
 *
 * `t(key, defaultValue?, vars?)` supports default values and
 * {{var}} interpolation. RTL is applied via I18nManager (native)
 * and document.dir (web).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager, Platform } from "react-native";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation as useI18nextTranslation,
} from "react-i18next";

import { ar } from "./ar";
import { en } from "./en";
import type {
  I18nContextValue,
  Locale,
  TranslationVars,
} from "./types";

export const DEFAULT_LOCALE: Locale = "ar-JO";
export const FALLBACK_LOCALE: Locale = "en";
export const RTL_LOCALES: Locale[] = ["ar-JO"];

const STORAGE_KEY = "turfbook.locale";

const resources = {
  "ar-JO": { translation: ar },
  en: { translation: en },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: FALLBACK_LOCALE,
    compatibilityJSON: "v4",
    interpolation: { escapeValue: false },
    // Return the key (not an empty string) when a translation is missing,
    // so our `t()` defaultValue logic stays predictable.
    returnEmptyString: false,
  });
}

/** Apply layout direction for a locale. Returns whether the locale is RTL. */
function applyDirection(locale: Locale): boolean {
  const rtl = RTL_LOCALES.includes(locale);
  try {
    I18nManager.allowRTL(true);
    // NOTE (native): a full RTL flip of already-mounted views takes effect
    // after an app reload. New mounts pick it up immediately.
    I18nManager.forceRTL(rtl);
  } catch {
    // I18nManager is a no-op on web — document.dir handles it below.
  }
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }
  return rtl;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function I18nInner({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isRTL, setIsRTL] = useState<boolean>(true);
  const { t: i18nT } = useI18nextTranslation();

  // Restore the persisted locale on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const next: Locale = saved === "en" ? "en" : DEFAULT_LOCALE;
        await i18n.changeLanguage(next);
        if (cancelled) return;
        setLocaleState(next);
        setIsRTL(applyDirection(next));
      } catch {
        if (!cancelled) setIsRTL(applyDirection(DEFAULT_LOCALE));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    await i18n.changeLanguage(next);
    setLocaleState(next);
    setIsRTL(applyDirection(next));
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory locale still applies.
    }
  }, []);

  const t = useCallback<I18nContextValue["t"]>(
    (key: string, defaultValue?: string, vars?: TranslationVars) => {
      const result = i18nT(key, {
        ...(vars ?? {}),
        defaultValue,
      });
      return typeof result === "string" ? result : (defaultValue ?? key);
    },
    [i18nT]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ t, locale, setLocale, isRTL }),
    [t, locale, setLocale, isRTL]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <I18nInner>{children}</I18nInner>
    </I18nextProvider>
  );
}

/**
 * App-level translation hook. Import from "@/src/i18n" (not "react-i18next").
 *
 * Example: const { t, locale, setLocale, isRTL } = useTranslation();
 *          t("booking.confirmBooking", "Confirm booking")
 *          t("time.minutesAgo", "…", { count: 5 })
 */
export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}

export { ar, en };
export type { I18nContextValue, Locale, TranslationVars };
export default i18n;
