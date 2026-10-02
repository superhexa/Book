import { Text, View } from "react-native";

import { fontSize, radius, shadows, spacing, useTheme } from "@/src/theme";

export function BarChart({ data, height = 140, valueLabel }: { data: { date: string; value: number }[]; height?: number; valueLabel?: (v: number) => string }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ height: height + 24 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 3 }}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * height);
          return (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
              <View style={{ width: "72%", height: h, backgroundColor: d.value > 0 ? colors.brandPrimary : colors.border, borderRadius: radius.sm }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 10 }}>{data[0]?.date?.slice(5)}</Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>{data[data.length - 1]?.date?.slice(5)}</Text>
      </View>
    </View>
  );
}

export function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: accent ? colors.brandPrimary : colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: accent ? colors.brandPrimary : colors.border, ...(shadows.sm as any) }}>
      <Text style={{ color: accent ? colors.onBrandPrimary + "CC" : colors.muted, fontSize: fontSize.sm, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: accent ? colors.onBrandPrimary : colors.onSurface, fontSize: fontSize["2xl"], fontWeight: "800", marginTop: 4 }}>{value}</Text>
    </View>
  );
}
