import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Moon, Palette, Sun } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  FormSection, FSwitch, PageHeader, PanelScreen, SectionCard, SkeletonList, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { usePreferences } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { ErrorState, useToast } from "@/src/ui";

type Prefs = { booking_updates?: boolean; promos?: boolean; reminders?: boolean; league_news?: boolean };

export default function SettingsScreen() {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const { schemePref, setSchemePref } = usePreferences();
  const { show } = useToast();
  const s = useStyles();
  const qc = useQueryClient();
  useRtl();

  const q = useQuery({
    queryKey: ["notif-prefs"],
    queryFn: () => api.get<Prefs>("/notification-prefs"),
  });

  const save = useMutation({
    mutationFn: (prefs: Prefs) => api.put("/notification-prefs", prefs),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notif-prefs"] }); show(t("settings.saved", "تم الحفظ بنجاح"), "success"); },
    onError: () => show(t("settings.saveError", "تعذر الحفظ، حاول مجدداً"), "error"),
  });

  const prefs: Prefs = q.data || {};
  const setPref = (key: keyof Prefs, v: boolean) => save.mutate({ ...prefs, [key]: v });

  const prefLabel = (key: string) =>
    key === "booking_updates" ? t("settings.pBooking", "تحديثات الحجوزات")
    : key === "promos" ? t("settings.pPromos", "العروض والخصومات")
    : key === "reminders" ? t("settings.pReminders", "تذكير قبل المباراة")
    : t("settings.pLeague", "أخبار الدوريات");

  return (
    <PanelScreen testID="settings">
      <PageHeader title={t("settings.title", "الإعدادات")} />
      <SectionCard title={t("settings.theme", "المظهر")}>
        <View style={s.themeRow}>
          {[
            { key: "light", label: t("settings.light", "فاتح"), icon: Sun },
            { key: "dark", label: t("settings.dark", "داكن"), icon: Moon },
            { key: "system", label: t("settings.system", "تلقائي"), icon: Palette },
          ].map((o) => {
            const active = schemePref === o.key;
            const Icon = o.icon;
            return (
              <Pressable
                key={o.key}
                onPress={() => setSchemePref(o.key as any)}
                style={[s.themeOpt, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                accessibilityRole="button"
              >
                <Icon size={20} color={active ? colors.onBrandPrimary : colors.muted} />
                <Text style={[s.themeTxt, active && { color: colors.onBrandPrimary }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.note}>{t("settings.themeNote", "اختر مظهر التطبيق المفضل لديك")}</Text>
      </SectionCard>
      <SectionCard
        title={t("settings.notifs", "الإشعارات")}
        subtitle={t("settings.notifsSub", "اختر ما تريد أن تصلك تنبيهاته")}
      >
        {q.isLoading ? <SkeletonList rows={3} /> : q.isError ? (
          <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
        ) : (
          <FormSection title="">
            {["booking_updates", "promos", "reminders", "league_news"].map((key) => (
              <FSwitch
                key={key}
                label={prefLabel(key)}
                value={!!prefs[key as keyof Prefs]}
                onChange={(v) => setPref(key as keyof Prefs, v)}
              />
            ))}
          </FormSection>
        )}
      </SectionCard>
      <SectionCard title={t("settings.lang", "اللغة")}>
        <View style={s.langRow}>
          <Globe size={20} color={colors.muted} />
          <Text style={s.langTxt}>{locale === "ar" ? t("settings.arabic", "العربية") : t("settings.english", "English")}</Text>
        </View>
        <Text style={s.note}>{t("settings.langNote", "لغة التطبيق الافتراضية هي العربية (الأردن)")}</Text>
      </SectionCard>
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  themeRow: { flexDirection: "row", gap: spacing.md },
  themeOpt: { flex: 1, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  themeTxt: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },
  note: { color: c.muted, fontSize: fontSize.sm, lineHeight: 20 },
  langRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  langTxt: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
}));
