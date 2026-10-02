// Public page shell: scroll container with pull-to-refresh, centered content
// wrap, page hero header, and the footer at the end of the scroll.
import React from "react";
import { RefreshControl, ScrollView, Text, View, ViewStyle } from "react-native";

import { BOTTOM_NAV_H, PublicFooter, useIsMobile, usePageTitle } from "@/src/components/public/chrome";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";

export function PublicPage({
  children,
  refreshing,
  onRefresh,
  title,
  testID,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  title?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  usePageTitle(title || "تيرف بوك");
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: colors.surface }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: isMobile ? BOTTOM_NAV_H + 8 : 0 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        ) : undefined
      }
    >
      {children}
      <PublicFooter />
    </ScrollView>
  );
}

export function PageWrap({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: spacing.lg }, style]}>
      {children}
    </View>
  );
}

export function PageHero({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  const s = useStyles();
  return (
    <View style={s.hero}>
      {kicker ? <Text style={s.kicker}>{kicker}</Text> : null}
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { paddingTop: spacing["2xl"], paddingBottom: spacing.lg },
  kicker: { color: c.brandPrimary, fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 1 },
  title: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800", marginTop: spacing.xs, letterSpacing: -0.5 },
  subtitle: { color: c.muted, fontSize: fontSize.lg, lineHeight: 28, marginTop: spacing.sm, maxWidth: 640 },
}));
