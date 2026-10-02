import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, TextField, useToast } from "@/src/ui";

const HERO = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85";

export default function RegisterScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { register } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "owner">("customer");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || password.length < 8) return toast.show("Fill all fields (password min 8 chars)", "error");
    setLoading(true);
    try {
      const user = await register({ name: name.trim(), email: email.trim(), phone, password, role });
      if (user.roles.includes("owner")) router.replace("/dashboard");
      else router.replace("/discover");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const Panel = (
    <View style={s.heroPanel}>
      <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" />
      <LinearGradient colors={["rgba(23,20,28,0.55)", "rgba(23,20,28,0.92)"]} style={s.heroScrim} />
      <View style={[s.heroContent, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable testID="back-landing" onPress={() => router.replace("/landing")} style={s.backBtn}><ArrowLeft size={18} color="#FFF" /></Pressable>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Text style={s.heroBrand}>⚽ TurfBook</Text>
          <Text style={s.heroHeadline}>Join the game. Play more, hassle less.</Text>
        </View>
      </View>
    </View>
  );

  const Form = (
    <KeyboardAwareScrollView contentContainerStyle={[s.form, isWide && s.formWide]} bottomOffset={24} showsVerticalScrollIndicator={false}>
      <View style={isWide ? s.formCard : undefined}>
        <Text style={s.welcome}>Create account</Text>
        <Text style={s.subtitle}>Start booking in under a minute.</Text>

        <View style={s.roleRow}>
          {(["customer", "owner"] as const).map((r) => (
            <Pressable key={r} testID={`role-${r}`} onPress={() => setRole(r)}
              style={[s.roleCard, role === r && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}>
              <Text style={{ fontSize: 26 }}>{r === "customer" ? "🏃" : "🏟️"}</Text>
              <Text style={[s.roleLabel, role === r && { color: colors.onBrandTertiary }]}>{r === "customer" ? "I'm a player" : "I own fields"}</Text>
            </Pressable>
          ))}
        </View>

        <TextField testID="reg-name" label={t("name")} value={name} onChangeText={setName} />
        <View style={{ height: spacing.md }} />
        <TextField testID="reg-email" label={t("email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <View style={{ height: spacing.md }} />
        <TextField testID="reg-phone" label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={{ height: spacing.md }} />
        <TextField testID="reg-password" label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
        <View style={{ height: spacing.lg }} />
        <Button testID="register-submit" title={t("register")} onPress={onSubmit} loading={loading} />
        <View style={s.footerRow}>
          <Text style={s.muted}>{t("haveAccount")} </Text>
          <Pressable testID="go-login" onPress={() => router.replace("/login")}>
            <Text style={s.link}>{t("login")}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );

  if (isWide) {
    return (
      <View style={s.split}>
        <View style={{ flex: 1 }}>{Panel}</View>
        <View style={s.formSide}>{Form}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ height: 180 }}>{Panel}</View>
      {Form}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  split: { flex: 1, flexDirection: "row", backgroundColor: c.surface },
  formSide: { flex: 1.1, backgroundColor: c.surfaceSecondary, justifyContent: "center" },
  heroPanel: { flex: 1, backgroundColor: c.surfaceInverse },
  heroImg: { position: "absolute", width: "100%", height: "100%" },
  heroScrim: { position: "absolute", width: "100%", height: "100%" },
  heroContent: { flex: 1, padding: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroBrand: { color: "#FFF", fontSize: fontSize.xl, fontWeight: "700" },
  heroHeadline: { color: "#FFF", fontSize: fontSize["2xl"], fontWeight: "800", marginTop: spacing.sm, maxWidth: 320, lineHeight: 32 },
  form: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
  formWide: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing["3xl"] },
  formCard: { maxWidth: 440, width: "100%", alignSelf: "center" },
  welcome: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: c.muted, fontSize: fontSize.lg, marginTop: 4, marginBottom: spacing.lg },
  roleRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  roleCard: { flex: 1, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  roleLabel: { color: c.onSurfaceSecondary, fontWeight: "700", fontSize: fontSize.base },
  link: { color: c.brandPrimary, fontWeight: "700" },
  muted: { color: c.muted },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
}));
