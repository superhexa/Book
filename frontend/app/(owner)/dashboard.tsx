import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { BarChart, Metric } from "@/src/components/charts";
import { minToLabel, money } from "@/src/format";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Loading } from "@/src/ui";

export default function OwnerDashboard() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["owner-analytics"], queryFn: () => api.get("/owner/analytics") });
  const facilities = useQuery({ queryKey: ["my-facilities"], queryFn: () => api.get("/facilities/mine") });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  const a = q.data;
  const noFacilities = (facilities.data || []).length === 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg }]}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
      showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{t("dashboard")}</Text>

      {noFacilities ? (
        <EmptyState title="No fields yet" subtitle="Create your first facility from the Fields tab to start receiving bookings" testID="owner-empty" />
      ) : (
        <>
          <View style={s.metricRow}>
            <Metric label={t("revenue")} value={money(a.total_revenue)} accent />
            <Metric label="Today" value={String(a.today_count)} />
          </View>
          <View style={s.metricRow}>
            <Metric label="Bookings" value={String(a.booking_count)} />
            <Metric label={t("occupancy")} value={`${a.occupancy}%`} />
            <Metric label="Cancel rate" value={`${a.cancellation_rate}%`} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>{t("revenue")} · last 14 days</Text>
            <BarChart data={a.revenue_series} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Bookings · last 14 days</Text>
            <BarChart data={a.booking_series} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Avg booking value</Text>
            <Text style={s.bigStat}>{money(a.avg_booking_value)}</Text>
          </View>

          {a.top_pitches?.length ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Top pitches</Text>
              {a.top_pitches.map((p: any) => (
                <View key={p.pitch_id} style={s.pitchRow}>
                  <Text style={s.pitchName}>{p.name}</Text>
                  <Text style={s.pitchStat}>{p.count} bookings · {money(p.revenue)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {a.peak_hours?.length ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Popular time slots</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
                {a.peak_hours.slice(0, 6).map((h: any) => (
                  <View key={h.hour} style={s.peakChip}>
                    <Text style={s.peakTxt}>{minToLabel(h.hour * 60)} · {h.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600", marginBottom: spacing.sm },
  metricRow: { flexDirection: "row", gap: spacing.md },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border, marginTop: spacing.xs },
  cardTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", marginBottom: spacing.md },
  bigStat: { color: c.brandPrimary, fontSize: fontSize["3xl"], fontWeight: "700" },
  pitchRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  pitchName: { color: c.onSurface, fontWeight: "500" },
  pitchStat: { color: c.muted, fontSize: fontSize.base },
  peakChip: { backgroundColor: c.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  peakTxt: { color: c.onBrandTertiary, fontWeight: "600", fontSize: fontSize.base },
}));
