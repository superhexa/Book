// Beautiful Arabic empty states: illustration/icon, copy and CTA.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SoccerBall } from "phosphor-react-native";

import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const s = useStyles();
  return (
    <View testID={testID} style={s.wrap} accessibilityRole="summary">
      <View style={s.iconWrap}>
        {icon ?? <SoccerBall size={34} color={s.iconColor.color as string} weight="duotone" />}
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          testID={testID ? `${testID}-action` : undefined}
          onPress={onAction}
          style={({ pressed }) => [s.action, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={s.actionTxt}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptySearch({ onReset }: { onReset?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      testID="empty-search"
      title={t("empty.search.title", "لا توجد نتائج مطابقة")}
      subtitle={t("empty.search.subtitle", "جرّب كلمات بحث مختلفة أو وسّع نطاق الفلاتر للعثور على ما تبحث عنه.")}
      actionLabel={onReset ? t("empty.search.reset", "مسح الفلاتر") : undefined}
      onAction={onReset}
    />
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing["3xl"], paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  iconColor: { color: c.brandPrimary },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "700", textAlign: "center" },
  subtitle: { color: c.muted, fontSize: fontSize.base, lineHeight: 24, textAlign: "center", maxWidth: 420 },
  action: {
    marginTop: spacing.md,
    backgroundColor: c.brandPrimary,
    paddingHorizontal: spacing.xl,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 160,
  },
  actionTxt: { color: c.onBrandPrimary, fontSize: fontSize.lg, fontWeight: "700" },
}));
