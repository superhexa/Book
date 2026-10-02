import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Palette, Sun } from "phosphor-react-native";
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

export default function OwnerSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { schemePref, setSchemePref } = usePreferences();
  const { show } = useToast();
  const s = useStyles();
  const qc = useQueryClient();
  useRtl();

  const q = useQuery({ queryKey: ["notif-prefs"], queryFn: () => api.get<Prefs>("/notification-prefs") });
  const save = useMutation({
    mutationFn: (prefs: Prefs) => api.put("/notification-prefs", prefs),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notif-prefs"] }); show(t("settings.saved", "تم الحفظ بنجاح"), "success"); },
    onError: () => show(t("settings.saveError", "تعذر الحفظ"), "error"),
  });

  const prefs: Prefs = q.data || {};
  const labels: Record<string, string> = {
    booking_updates: t("oset.pBooking", "تنبيهات الحجوزات الجديدة"),
    promos: t("oset.pPromos", "تنبيهات العروض"),
    reminders: t("oset.pReminders", "تذكير بمواعيد اليوم"),
    league_news: t("oset.pLeague", "أخبار المنصة"),
  };

  return (
    <PanelScreen testID="owner-settings">
      <PageHeader title={t("oset.title", "الإعدادات")} subtitle={t("oset.sub", "تفضيلات حسابك كمالك منشأة")} />
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
              <Pressable key={o.key} onPress={() => setSchemePref(o.key as any)}
                style={[s.themeOpt, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                <Icon size={20} color={active ? colors.onBrandPrimary : colors.muted} />
                <Text style={[s.themeTxt, active && { color: colors.onBrandPrimary }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>
      <SectionCard title={t("oset.notifs", "تنبيهات المالك")}>
        {q.isLoading ? <SkeletonList rows={3} /> : q.isError ? (
          <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
        ) : (
          <FormSection title="">
            {Object.keys(labels).map((key) => (
              <FSwitch key={key} label={labels[key]} value={!!prefs[key as keyof Prefs]}
                onChange={(v) => save.mutate({ ...prefs, [key]: v })} />
            ))}
          </FormSection>
        )}
      </SectionCard>
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  themeRow: { flexDirection: "row", gap: spacing.md },
  themeOpt: { flex: 1, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  themeTxt: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },
}));
