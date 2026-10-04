import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, SealCheck } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";
import { Button, TextField, useToast } from "@/src/ui";

const HERO = "https://images.unsplash.com/photo-1789476332262-3f9826198129?crop=entropy&cs=srgb&fm=jpg&w=1400&q=85";

export default function LoginScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { login } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) return toast.show("Please enter email and password", "error");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      const r = user.roles;
      if (r.includes("super_admin") || r.includes("admin")) router.replace("/admin-overview");
      else if (r.includes("owner")) router.replace("/dashboard");
      else router.replace("/discover");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const Panel = (
    <View style={s.heroPanel}>
      <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" />
      <LinearGradient colors={["rgba(23,20,28,0.55)", "rgba(23,20,28,0.92)"]} style={s.heroScrim} />
      <View style={[s.heroContent, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable testID="back-landing" onPress={() => router.replace("/landing")} style={s.backBtn}>
          <ArrowLeft size={18} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Text style={s.heroBrand}>⚽ Book</Text>
          <Text style={s.heroHeadline}>Your next match is one tap away.</Text>
          <View style={s.heroBadge}>
            <SealCheck size={16} color={colors.brandPrimary} weight="fill" />
            <Text style={s.heroBadgeTxt}>500+ verified pitches</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const Form = (
    <KeyboardAwareScrollView contentContainerStyle={[s.form, isWide && s.formWide]} bottomOffset={24} showsVerticalScrollIndicator={false}>
      <View style={isWide ? s.formCard : undefined}>
        <Text style={s.welcome}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to manage your bookings.</Text>
        <View style={{ height: spacing.lg }} />
        <TextField testID="login-email" label={t("email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
        <View style={{ height: spacing.md }} />
        <TextField testID="login-password" label={t("password")} value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <Pressable testID="forgot-link" onPress={() => router.push("/forgot")} style={{ alignSelf: "flex-end", marginTop: spacing.sm }}>
          <Text style={s.link}>{t("forgotPassword")}</Text>
        </Pressable>
        <View style={{ height: spacing.lg }} />
        <Button testID="login-submit" title={t("login")} onPress={onSubmit} loading={loading} />
        <View style={s.footerRow}>
          <Text style={s.muted}>{t("noAccount")} </Text>
          <Pressable testID="go-register" onPress={() => router.push("/register")}>
            <Text style={s.link}>{t("register")}</Text>
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
      <View style={{ height: 260 }}>{Panel}</View>
      {Form}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  split: { flex: 1, flexDirection: "row", backgroundColor: c.surface },
  formSide: { flex: 1, backgroundColor: c.surfaceSecondary, justifyContent: "center" },
  heroPanel: { flex: 1, backgroundColor: c.surfaceInverse },
  heroImg: { position: "absolute", width: "100%", height: "100%" },
  heroScrim: { position: "absolute", width: "100%", height: "100%" },
  heroContent: { flex: 1, padding: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroBrand: { color: "#FFF", fontSize: fontSize.xl, fontWeight: "700" },
  heroHeadline: { color: "#FFF", fontSize: fontSize["2xl"], fontWeight: "800", marginTop: spacing.sm, maxWidth: 320, lineHeight: 32 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, marginTop: spacing.lg },
  heroBadgeTxt: { color: "#FFF", fontWeight: "600", fontSize: fontSize.sm },
  form: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
  formWide: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing["3xl"] },
  formCard: { maxWidth: 420, width: "100%", alignSelf: "center" },
  welcome: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: c.muted, fontSize: fontSize.lg, marginTop: 4 },
  link: { color: c.brandPrimary, fontWeight: "700", fontSize: fontSize.base },
  muted: { color: c.muted, fontSize: fontSize.base },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
}));
