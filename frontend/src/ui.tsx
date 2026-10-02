import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontSize, makeStyles, radius, shadows, spacing, ThemeColors, useTheme } from "@/src/theme";

const haptic = (type: "light" | "success" | "selection" = "light") => {
  if (Platform.OS === "web") return;
  if (type === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (type === "selection") Haptics.selectionAsync();
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ------------------------------- Button -----------------------------------
export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const s = useButtonStyles();
  const bg = {
    primary: colors.brandPrimary,
    secondary: colors.brandSecondary,
    ghost: "transparent",
    danger: colors.error,
  }[variant];
  const fg = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandSecondary,
    ghost: colors.brandPrimary,
    danger: colors.onError,
  }[variant];
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        haptic("light");
        onPress?.();
      }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderWidth: variant === "ghost" ? 1.5 : 0, borderColor: colors.borderStrong },
        variant === "primary" && (shadows.brand as any),
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon}
          <Text style={[s.label, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles((c) => ({
  btn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: fontSize.lg, fontWeight: "600" },
}));

// ------------------------------- TextField ---------------------------------
export function TextField({
  label,
  error,
  testID,
  ...props
}: TextInputProps & { label?: string; error?: string; testID?: string }) {
  const { colors } = useTheme();
  const s = useFieldStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[s.input, focused && { borderColor: colors.brandPrimary }, error && { borderColor: colors.error }]}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: { color: c.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: "500" },
  input: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: spacing.lg,
    height: 52,
    color: c.onSurface,
    fontSize: fontSize.lg,
  },
  error: { color: c.error, fontSize: fontSize.sm },
}));

// ------------------------------- Card --------------------------------------
export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  const s = useCardStyles();
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}
const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    ...(shadows.sm as any),
  },
}));

// ------------------------------- Badge -------------------------------------
export function Badge({ label, colorKey = "muted" }: { label: string; colorKey?: string }) {
  const { colors } = useTheme();
  const bg = (colors as any)[colorKey] ?? colors.muted;
  const fg = (colors as any)["on" + colorKey.charAt(0).toUpperCase() + colorKey.slice(1)] ?? colors.onSurface;
  return (
    <View style={{ backgroundColor: bg + "22", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: bg, fontSize: fontSize.sm, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

// ------------------------------- Chip --------------------------------------
export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic("selection");
        onPress?.();
      }}
      style={{
        height: 36,
        flexShrink: 0,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary,
        borderWidth: 1,
        borderColor: selected ? colors.brandPrimary : colors.border,
      }}
    >
      <Text style={{ color: selected ? colors.onBrandPrimary : colors.onSurfaceTertiary, fontWeight: "500", fontSize: fontSize.base }}>
        {label}
      </Text>
    </Pressable>
  );
}

// --------------------------- Segmented control -----------------------------
export function Segmented({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={`seg-${o.key}`}
            onPress={() => {
              haptic("selection");
              onChange(o.key);
            }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.sm - 1, alignItems: "center", backgroundColor: active ? colors.surface : "transparent" }}
          >
            <Text style={{ color: active ? colors.onSurface : colors.muted, fontWeight: "600", fontSize: fontSize.base }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------- Stars -------------------------------------
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Text style={{ color: colors.warning, fontSize: size }}>★</Text>
      <Text style={{ color: colors.onSurface, fontSize: size, fontWeight: "600" }}>{rating ? rating.toFixed(1) : "New"}</Text>
    </View>
  );
}

// ------------------------------- States ------------------------------------
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      {label ? <Text style={{ color: colors.muted }}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle, action, testID }: { title: string; subtitle?: string; action?: React.ReactNode; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", justifyContent: "center", padding: spacing["2xl"], gap: spacing.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 28 }}>⚽</Text>
      </View>
      <Text style={{ color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "600", textAlign: "center" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.muted, textAlign: "center" }}>{subtitle}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing["2xl"], gap: spacing.md }}>
      <Text style={{ color: colors.onSurface, fontSize: fontSize.lg, fontWeight: "600", textAlign: "center" }}>{message || "Something went wrong"}</Text>
      {onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

// ------------------------------- Toast -------------------------------------
type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
const ToastCtx = createContext<{ show: (m: string, k?: Toast["kind"]) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, kind }]);
    if (kind === "success") haptic("success");
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 0, right: 0, alignItems: "center", gap: 8, zIndex: 9999 }}>
        {toasts.map((t) => {
          const bg = t.kind === "success" ? colors.success : t.kind === "error" ? colors.error : colors.surfaceInverse;
          const fg = t.kind === "info" ? colors.onSurfaceInverse : "#FFFFFF";
          return (
            <Animated.View key={t.id} entering={FadeInDown} exiting={FadeOutUp} style={{ backgroundColor: bg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, maxWidth: "90%" }}>
              <Text testID="toast-message" style={{ color: fg, fontWeight: "500", textAlign: "center" }}>{t.message}</Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ------------------------------- Screen ------------------------------------
export function Screen({ children, scroll, padded = true, style }: { children: React.ReactNode; scroll?: boolean; padded?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  const base: ViewStyle = { flex: 1, backgroundColor: colors.surface };
  if (scroll) {
    return (
      <View style={base}>
        <ScrollView contentContainerStyle={[padded && { padding: spacing.lg }, style]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    );
  }
  return <View style={[base, padded && { padding: spacing.lg }, style]}>{children}</View>;
}

export { haptic, spacing, radius, fontSize };
export type { ThemeColors };
