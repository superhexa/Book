import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import { Button, TextField, useToast } from "@/src/ui";

export default function ForgotScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [loading, setLoading] = useState(false);

  const requestReset = async () => {
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot", { email: email.trim() }, false);
      if (res.reset_token) {
        setToken(res.reset_token);
        toast.show("Reset code generated. Set a new password.", "success");
        setStage("reset");
      } else {
        toast.show("If the account exists, a reset link was sent", "info");
      }
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    if (password.length < 8) {
      toast.show("Password must be at least 8 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset", { token, password }, false);
      toast.show("Password reset. Please sign in.", "success");
      router.replace("/login");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={[s.form, { paddingTop: insets.top + spacing["2xl"] }]}
      bottomOffset={24}
    >
      <Text style={s.title}>{t("forgotPassword")}</Text>
      {stage === "request" ? (
        <>
          <Text style={s.subtitle}>Enter your email to receive a reset code.</Text>
          <TextField testID="forgot-email" label={t("email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button testID="forgot-submit" title="Send reset code" onPress={requestReset} loading={loading} />
        </>
      ) : (
        <>
          <Text style={s.subtitle}>Enter your new password.</Text>
          <TextField testID="reset-token" label="Reset code" value={token} onChangeText={setToken} />
          <TextField testID="reset-password" label="New password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button testID="reset-submit" title="Reset password" onPress={doReset} loading={loading} />
        </>
      )}
      <Pressable onPress={() => router.replace("/login")} style={{ alignSelf: "center", marginTop: spacing.md }}>
        <Text style={s.link}>Back to {t("login")}</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  form: { padding: spacing.lg, gap: spacing.md },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  subtitle: { color: c.muted, marginBottom: spacing.sm },
  link: { color: c.brandPrimary, fontWeight: "600" },
}));
