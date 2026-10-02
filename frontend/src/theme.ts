// TurfBook design tokens — "Coral Night": warm plum-ink neutrals, a vivid
// coral accent and soft warm surfaces. Modern, energetic, light mode only.
import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#17141C",
  surfaceSecondary: "#F8F6FA",
  onSurfaceSecondary: "#322D38",
  surfaceTertiary: "#F0EDF4",
  onSurfaceTertiary: "#4C4654",
  surfaceInverse: "#17141C",
  onSurfaceInverse: "#F7F4FA",
  muted: "#857E8D",

  brand: "#17141C",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF5436",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FFE7E1",
  onBrandSecondary: "#C13A22",
  brandTertiary: "#FFF3EF",
  onBrandTertiary: "#E0452A",

  success: "#12A150",
  onSuccess: "#FFFFFF",
  warning: "#E8A500",
  onWarning: "#17141C",
  error: "#E5484D",
  onError: "#FFFFFF",
  info: "#17141C",
  onInfo: "#FFFFFF",

  border: "#ECE9F0",
  borderStrong: "#D8D3DE",
  divider: "#F2EFF5",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(_scheme?: ColorScheme | null) {
  Appearance.setColorScheme?.("light");
}
setColorScheme();

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  useColorScheme();
  return { scheme: "light", colors: light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48, "4xl": 64 } as const;
export const radius = { sm: 8, md: 14, lg: 22, xl: 30, pill: 999 } as const;
export const fontSize = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 26, "3xl": 34, "4xl": 48 } as const;

export const shadows = {
  sm: Platform.select({
    web: { boxShadow: "0 2px 12px rgba(23,20,28,0.07)" } as any,
    default: { shadowColor: "#17141C", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  }),
  md: Platform.select({
    web: { boxShadow: "0 14px 34px rgba(23,20,28,0.14)" } as any,
    default: { shadowColor: "#17141C", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 8 },
  }),
  brand: Platform.select({
    web: { boxShadow: "0 12px 28px rgba(255,84,54,0.4)" } as any,
    default: { shadowColor: "#FF5436", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8 },
  }),
} as const;
