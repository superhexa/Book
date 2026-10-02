import { useQuery } from "@tanstack/react-query";
import { Receipt } from "phosphor-react-native";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { Booking } from "@/src/components/booking-card";
import {
  arDate, arStatus, arTime, jod, PageHeader, PanelScreen, StatCard, StatGrid,
  SkeletonList, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, EmptyState, ErrorState } from "@/src/ui";
import { statusColorKey } from "@/src/format";

export default function PaymentsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  useRtl();

  // No dedicated customer payments endpoint yet — derive from paid/completed bookings.
  const q = useQuery({
    queryKey: ["payments-history"],
    queryFn: () => api.get<Booking[]>("/bookings?scope=past"),
  });

  const list = (q.data || []).filter((b) => b.final_amount > 0);
  const total = list.reduce((a, b) => a + (b.final_amount || 0), 0);

  return (
    <PanelScreen scroll={false} testID="payments">
      <PageHeader title={t("pay.title", "سجل المدفوعات")} subtitle={t("pay.subtitle", "جميع مدفوعات حجوزاتك")} />
      {q.isLoading ? <SkeletonList rows={5} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : (
        <>
          <StatGrid>
            <StatCard label={t("pay.total", "إجمالي المدفوع")} value={jod(total)} accent />
            <StatCard label={t("pay.count", "عدد العمليات")} value={list.length} />
          </StatGrid>
          <FlatList
            data={list}
            keyExtractor={(b) => b.id}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing["3xl"] }}
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
            renderItem={({ item }) => (
              <View style={s.card}>
                <View style={[s.icon, { backgroundColor: colors.brandTertiary }]}>
                  <Receipt size={20} color={colors.brandPrimary} weight="duotone" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.title} numberOfLines={1}>{item.facility_name} · {item.pitch_name}</Text>
                  <Text style={s.meta}>{arDate(item.date)} · {arTime(item.start_min)}</Text>
                  <Text style={s.meta}>{t("pay.ref", "مرجع")}: {item.ref}</Text>
                </View>
                <View style={s.side}>
                  <Text style={s.amount}>{jod(item.final_amount)}</Text>
                  <Badge label={arStatus(item.payment_status)} colorKey={statusColorKey(item.payment_status)} />
                </View>
              </View>
            )}
            ListEmptyComponent={
              <EmptyState
                title={t("pay.empty", "لا توجد مدفوعات بعد")}
                subtitle={t("pay.emptySub", "ستظهر مدفوعات حجوزاتك هنا")}
              />
            }
          />
        </>
      )}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, alignItems: "center" },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  meta: { color: c.muted, fontSize: fontSize.sm },
  side: { alignItems: "flex-end", gap: spacing.xs },
  amount: { color: c.brandPrimary, fontSize: fontSize.lg, fontWeight: "800" },
}));
