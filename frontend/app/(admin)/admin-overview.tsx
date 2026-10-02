import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { BarChart, Metric } from "@/src/components/charts";
import { money } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Loading } from "@/src/ui";

export default function AdminOverview() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ov = useQuery({ queryKey: ["admin-overview"], queryFn: () => api.get("/admin/overview") });
  const an = useQuery({ queryKey: ["admin-analytics"], queryFn: () => api.get("/admin/analytics") });

  if (ov.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  const o = ov.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.lg }]}
      refreshControl={<RefreshControl refreshing={ov.isFetching} onRefresh={() => { ov.refetch(); an.refetch(); }} tintColor={colors.brandPrimary} />}
      showsVerticalScrollIndicator={false}>
      <Text style={s.title}>Control Center</Text>
      <View style={s.statusRow}>
        <View style={s.statusDot} />
        <Text style={s.statusTxt}>System {o.system_health}</Text>
      </View>

      <View style={s.row}><Metric label="Revenue" value={money(o.revenue)} accent /><Metric label="Bookings" value={String(o.bookings_total)} /></View>
      <View style={s.row}><Metric label="Users" value={String(o.users_total)} /><Metric label="Active" value={String(o.active_users)} /><Metric label="Owners" value={String(o.owners)} /></View>
      <View style={s.row}><Metric label="Verified" value={String(o.facilities_verified)} /><Metric label="Pending" value={String(o.facilities_pending)} /></View>
      <View style={s.row}><Metric label="Refunds" value={money(o.refunds)} /><Metric label="Cancellations" value={String(o.cancellations)} /><Metric label="Reported" value={String(o.reported_reviews)} /></View>

      {an.data ? (
        <>
          <View style={s.card}>
            <Text style={s.cardTitle}>Platform revenue · 30 days</Text>
            <BarChart data={an.data.revenue_series} />
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Bookings · 30 days</Text>
            <BarChart data={an.data.booking_series} />
          </View>
          <View style={s.card}>
            <Text style={s.cardTitle}>Cancellation rate</Text>
            <Text style={s.big}>{an.data.cancellation_rate}%</Text>
          </View>
        </>
      ) : null}
      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  statusTxt: { color: c.muted, fontSize: fontSize.base },
  row: { flexDirection: "row", gap: spacing.md },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border, marginTop: spacing.xs },
  cardTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", marginBottom: spacing.md },
  big: { color: c.brandPrimary, fontSize: fontSize["3xl"], fontWeight: "700" },
}));
