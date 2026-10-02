import { router } from "expo-router";
import { Bell, Globe, SignOut, UserCircle } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { usePreferences } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Segmented, TextField, useToast } from "@/src/ui";

export function ProfileView() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile } = useAuth();
  const { lang, setLang, t } = usePreferences();
  const toast = useToast();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  const roleLabel = user?.roles.includes("super_admin") ? "Super Admin"
    : user?.roles.includes("admin") ? "Admin"
    : user?.roles.includes("owner") ? "Field Owner" : "Player";

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, phone });
      toast.show("Profile updated", "success");
    } catch {
      toast.show("Could not update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg }]} showsVerticalScrollIndicator={false}>
      <View style={s.headerCard}>
        <UserCircle size={64} color={colors.brandPrimary} weight="fill" />
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <Badge label={roleLabel} colorKey="brandPrimary" />
      </View>

      <Text style={s.section}>Account</Text>
      <View style={s.card}>
        <TextField label={t("name")} value={name} onChangeText={setName} testID="profile-name" />
        <TextField label={t("phone")} value={phone} onChangeText={setPhone} testID="profile-phone" keyboardType="phone-pad" />
        <Button title={t("save")} onPress={save} loading={saving} testID="profile-save" />
      </View>

      <Text style={s.section}>Preferences</Text>
      <View style={s.card}>
        <View style={s.prefRow}>
          <View style={s.prefLabel}><Globe size={18} color={colors.onSurfaceSecondary} /><Text style={s.prefTxt}>{t("language")}</Text></View>
        </View>
        <Segmented
          options={[{ key: "en", label: "English" }, { key: "ar", label: "العربية" }]}
          value={lang}
          onChange={(k) => setLang(k as any)}
        />
      </View>

      <Pressable testID="profile-notifications" style={s.linkRow} onPress={() => router.push("/notifications")}>
        <Bell size={18} color={colors.onSurfaceSecondary} />
        <Text style={s.linkTxt}>Notifications</Text>
      </Pressable>

      <Button title={t("logout")} variant="danger" onPress={logout} testID="logout-button" icon={<SignOut size={18} color={colors.onError} />} style={{ marginTop: spacing.xl }} />
      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.md },
  headerCard: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.lg },
  name: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  email: { color: c.muted, fontSize: fontSize.base, marginBottom: spacing.xs },
  section: { color: c.muted, fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: c.border },
  prefRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  prefLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prefTxt: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "500" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  linkTxt: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "500" },
}));
