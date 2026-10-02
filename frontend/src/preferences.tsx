import React, { createContext, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import { ColorScheme, setColorScheme } from "@/src/theme";

type Lang = "en" | "ar";
type SchemePref = ColorScheme | "system";

const STR: Record<string, { en: string; ar: string }> = {
  appName: { en: "TurfBook", ar: "تيرف بوك" },
  tagline: { en: "Book the pitch. Play the game.", ar: "احجز الملعب. العب المباراة." },
  login: { en: "Sign in", ar: "تسجيل الدخول" },
  register: { en: "Create account", ar: "إنشاء حساب" },
  logout: { en: "Sign out", ar: "تسجيل الخروج" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  password: { en: "Password", ar: "كلمة المرور" },
  name: { en: "Full name", ar: "الاسم الكامل" },
  phone: { en: "Phone", ar: "الهاتف" },
  forgotPassword: { en: "Forgot password?", ar: "نسيت كلمة المرور؟" },
  noAccount: { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
  haveAccount: { en: "Already have an account?", ar: "لديك حساب بالفعل؟" },
  continueCustomer: { en: "I'm a player", ar: "أنا لاعب" },
  continueOwner: { en: "I own fields", ar: "أملك ملاعب" },
  discover: { en: "Discover", ar: "استكشف" },
  bookings: { en: "Bookings", ar: "الحجوزات" },
  favorites: { en: "Favorites", ar: "المفضلة" },
  profile: { en: "Profile", ar: "الملف" },
  dashboard: { en: "Dashboard", ar: "لوحة التحكم" },
  fields: { en: "Fields", ar: "الملاعب" },
  overview: { en: "Overview", ar: "نظرة عامة" },
  users: { en: "Users", ar: "المستخدمون" },
  verify: { en: "Verify", ar: "التحقق" },
  more: { en: "More", ar: "المزيد" },
  searchPlaceholder: { en: "Search fields, cities...", ar: "ابحث عن ملاعب، مدن..." },
  bookNow: { en: "Book now", ar: "احجز الآن" },
  confirmBooking: { en: "Confirm booking", ar: "تأكيد الحجز" },
  selectDate: { en: "Select date", ar: "اختر التاريخ" },
  availableSlots: { en: "Available slots", ar: "الأوقات المتاحة" },
  noSlots: { en: "No slots available for this date", ar: "لا توجد أوقات متاحة لهذا اليوم" },
  total: { en: "Total", ar: "الإجمالي" },
  upcoming: { en: "Upcoming", ar: "القادمة" },
  past: { en: "Past", ar: "السابقة" },
  noUpcoming: { en: "No upcoming bookings", ar: "لا توجد حجوزات قادمة" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  theme: { en: "Theme", ar: "المظهر" },
  language: { en: "Language", ar: "اللغة" },
  revenue: { en: "Revenue", ar: "الإيرادات" },
  occupancy: { en: "Occupancy", ar: "الإشغال" },
  retry: { en: "Retry", ar: "إعادة المحاولة" },
  save: { en: "Save", ar: "حفظ" },
  apply: { en: "Apply", ar: "تطبيق" },
};

type Ctx = {
  lang: Lang;
  isRTL: boolean;
  schemePref: SchemePref;
  t: (key: keyof typeof STR | string) => string;
  setLang: (l: Lang) => void;
  setSchemePref: (s: SchemePref) => void;
};

const PreferencesContext = createContext<Ctx>(null as any);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [schemePref, setSchemePrefState] = useState<SchemePref>("system");

  useEffect(() => {
    (async () => {
      const l = (await storage.getItem("pref_lang", "en")) as Lang;
      const s = (await storage.getItem("pref_scheme", "system")) as SchemePref;
      setLangState(l || "en");
      setSchemePrefState(s || "system");
      setColorScheme(s === "system" || !s ? null : s);
    })();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    storage.setItem("pref_lang", l);
  };
  const setSchemePref = (s: SchemePref) => {
    setSchemePrefState(s);
    storage.setItem("pref_scheme", s);
    setColorScheme(s === "system" ? null : s);
  };

  const t = (key: string) => STR[key]?.[lang] ?? key;

  return (
    <PreferencesContext.Provider value={{ lang, isRTL: lang === "ar", schemePref, t, setLang, setSchemePref }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);
export const useI18n = () => {
  const { t, isRTL, lang } = useContext(PreferencesContext);
  return { t, isRTL, lang };
};
