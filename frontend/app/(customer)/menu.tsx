import { router } from "expo-router";
import { Bell, CaretLeft, CreditCard, Gear, SignOut, User } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { PageHeader, PanelScreen, useRtl } from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function CustomerMore() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const s = useStyles();
  useRtl();

  const rows = [
    { to: "/profile", label: t("nav.profile", "الملف الشخصي"), icon: <User size={20} color={colors.brandPrimary} /> },
    { to: "/my-notifications", label: t("nav.notifications", "الإشعارات"), icon: <Bell size={20} color={colors.brandPrimary} /> },
    { to: "/payments", label: t("nav.payments", "المدفوعات"), icon: <CreditCard size={20} color={colors.brandPrimary} /> },
    { to: "/settings", label: t("nav.settings", "الإعدادات"), icon: <Gear size={20} color={colors.brandPrimary} /> },
  ];

  return (
    <PanelScreen testID="customer-more">
      <PageHeader title={t("nav.more", "المزيد")} subtitle={user?.name} />
      <View style={s.list}>
        {rows.map((r) => (
          <Pressable
            key={r.to}
            onPress={() => router.push(r.to as any)}
            style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
          >
            <View style={s.icon}>{r.icon}</View>
            <Text style={s.label}>{r.label}</Text>
            <CaretLeft size={18} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable
          onPress={() => { logout(); router.replace("/landing"); }}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
        >
          <View style={[s.icon, { backgroundColor: colors.error + "1A" }]}>
            <SignOut size={20} color={colors.error} />
          </View>
          <Text style={[s.label, { color: colors.error }]}>{t("app.logout", "تسجيل الخروج")}</Text>
        </Pressable>
      </View>
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.divider },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  label: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", flex: 1 },
}));
