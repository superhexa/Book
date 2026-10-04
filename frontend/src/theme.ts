// Book design tokens — "Volt Pitch": deep pine ink, electric volt accent,
// warm paper surfaces. Premium modern sports aesthetic, Arabic-first.
import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0D1512",
  surfaceSecondary: "#F4F6F1",
  onSurfaceSecondary: "#2A332E",
  surfaceTertiary: "#E8ECE1",
  onSurfaceTertiary: "#43514A",
  surfaceInverse: "#0C1411",
  onSurfaceInverse: "#F2F5EC",
  muted: "#68756D",

  brand: "#0C1411",
  onBrand: "#FFFFFF",
  brandPrimary: "#B9EC2E",
  onBrandPrimary: "#0C1411",
  brandSecondary: "#EDF9CF",
  onBrandSecondary: "#4A6B00",
  brandTertiary: "#F6FBE4",
  onBrandTertiary: "#3E5C00",

  // deep pine for dark sections / gradients
  pine: "#0E3B2C",
  pineDeep: "#0A2A20",
  volt: "#B9EC2E",
  voltDeep: "#9CCF1A",

  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#E8A500",
  onWarning: "#0C1411",
  error: "#E5484D",
  onError: "#FFFFFF",
  info: "#0C1411",
  onInfo: "#FFFFFF",

  border: "#E4E9DD",
  borderStrong: "#CFD6C4",
  divider: "#EEF1E8",
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
export const fontSize = { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, "2xl": 26, "3xl": 34, "4xl": 48, "5xl": 60 } as const;

export const fontFamily = {
  sans: "'IBM Plex Sans Arabic','Tajawal','Segoe UI',system-ui,sans-serif",
  display: "'IBM Plex Sans Arabic','Tajawal','Segoe UI',system-ui,sans-serif",
} as const;

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
    web: { boxShadow: "0 12px 28px rgba(158,207,26,0.45)" } as any,
    default: { shadowColor: "#9CCF1A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 8 },
  }),
  glow: Platform.select({
    web: { boxShadow: "0 0 44px rgba(185,236,46,0.5)" } as any,
    default: { shadowColor: "#B9EC2E", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 22, elevation: 6 },
  }),
  card: Platform.select({
    web: { boxShadow: "0 4px 24px rgba(12,20,17,0.08)" } as any,
    default: { shadowColor: "#0C1411", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 3 },
  }),
} as const;
