// Admin — Control center dashboard (Volt Pitch design, ar-JO).
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  CurrencyCircleDollar,
  Flag,
  MapPin,
  Newspaper,
  SealCheck,
  ShieldCheck,
  SoccerBall,
  Trophy,
  UsersThree,
  WarningCircle,
} from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { BarChart } from "@/src/components/charts";
import { arDate, jod } from "@/src/components/panels";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";
import { Loading } from "@/src/ui";

type Overview = {
  users_total: number; active_users: number; owners: number;
  facilities_verified: number; facilities_pending: number;
  bookings_total: number; revenue: number; refunds: number;
  cancellations: number; reported_reviews: number; system_health: string;
};

export default function AdminOverview() {
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isTablet = width >= 640;

  const ov = useQuery({ queryKey: ["admin-overview"], queryFn: () => api.get<Overview>("/admin/overview") });
  const an = useQuery({ queryKey: ["admin-analytics"], queryFn: () => api.get("/admin/analytics") });
  const disputes = useQuery({ queryKey: ["admin-disputes-count"], queryFn: () => api.get<{ total: number }>("/disputes?status=OPEN") });

  if (ov.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  const o = ov.data!;
  const today = arDate(new Date().toISOString().slice(0, 10));
  const firstName = user?.name?.split(" ")[0] || "";

  const kpis = [
    { icon: <CurrencyCircleDollar size={24} color={colors.pine} weight="fill" />, label: "إجمالي الإيرادات", value: jod(o.revenue), accent: true },
    { icon: <CalendarCheck size={24} color={colors.pine} weight="fill" />, label: "الحجوزات", value: String(o.bookings_total) },
    { icon: <UsersThree size={24} color={colors.pine} weight="fill" />, label: "المستخدمون", value: String(o.users_total) },
    { icon: <MapPin size={24} color={colors.pine} weight="fill" />, label: "ملاعب موثّقة", value: String(o.facilities_verified) },
  ];

  const actions = [
    { icon: <SealCheck size={22} color={colors.volt} weight="fill" />, label: "توثيق الملاعب", badge: o.facilities_pending, to: "/admin-facilities" },
    { icon: <Flag size={22} color={colors.volt} weight="fill" />, label: "النزاعات", badge: disputes.data?.total || 0, to: "/admin-disputes" },
    { icon: <Trophy size={22} color={colors.volt} weight="fill" />, label: "الدوريات", to: "/admin-leagues" },
    { icon: <Newspaper size={22} color={colors.volt} weight="fill" />, label: "الأخبار", to: "/admin-news" },
    { icon: <Bell size={22} color={colors.volt} weight="fill" />, label: "الإشعارات", to: "/admin-notify" },
    { icon: <UsersThree size={22} color={colors.volt} weight="fill" />, label: "المستخدمون", to: "/admin-users" },
  ];

  const alerts: { icon: React.ReactNode; text: string; to: string }[] = [];
  if (o.facilities_pending > 0) alerts.push({ icon: <WarningCircle size={18} color={colors.warning} weight="fill" />, text: `${o.facilities_pending} ملعب بانتظار التوثيق`, to: "/admin-facilities" });
  if ((disputes.data?.total || 0) > 0) alerts.push({ icon: <Flag size={18} color={colors.error} weight="fill" />, text: `${disputes.data!.total} نزاع مفتوح يحتاج مراجعة`, to: "/admin-disputes" });
  if (o.reported_reviews > 0) alerts.push({ icon: <WarningCircle size={18} color={colors.warning} weight="fill" />, text: `${o.reported_reviews} تقييم مبلغ عنه`, to: "/admin-more" });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
      refreshControl={<RefreshControl refreshing={ov.isFetching} onRefresh={() => { ov.refetch(); an.refetch(); disputes.refetch(); }} tintColor={colors.pine} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ============ HERO ============ */}
      <LinearGradient colors={["#0E3B2C", "#0C1411"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + spacing.lg }]}>
        <View style={s.heroVolt} />
        <View style={s.heroRow}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{firstName.slice(0, 1) || "م"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroHi}>مرحباً {firstName} 👋</Text>
            <Text style={s.heroDate}>{today}</Text>
          </View>
          <View style={s.statusPill}>
            <View style={s.statusDot} />
            <Text style={s.statusTxt}>النظام يعمل</Text>
          </View>
        </View>
        <Text style={s.heroTitle}>لوحة القيادة</Text>
        <Text style={s.heroSub}>نظرة شاملة على منصة Book — الإيرادات، الحجوزات، والنشاط.</Text>
      </LinearGradient>

      <View style={[s.body, isWide && s.bodyWide]}>
        {/* ============ KPI CARDS ============ */}
        <View style={[s.grid, (isWide || isTablet) && s.grid2]}>
          {kpis.map((k) => (
            <View key={k.label} style={[s.kpi, k.accent && s.kpiAccent, shadows.card as any]}>
              <View style={[s.kpiIcon, k.accent && s.kpiIconAccent]}>{k.icon}</View>
              <Text style={[s.kpiValue, k.accent && { color: colors.pine }]}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* ============ ALERTS ============ */}
        {alerts.length > 0 ? (
          <View style={s.alertCard}>
            <View style={s.alertHead}>
              <ShieldCheck size={20} color={colors.warning} weight="fill" />
              <Text style={s.alertTitle}>يحتاج انتباهك</Text>
            </View>
            {alerts.map((a, i) => (
              <Pressable key={i} onPress={() => router.push(a.to as any)} style={s.alertRow}>
                {a.icon}
                <Text style={s.alertTxt}>{a.text}</Text>
                <ArrowLeft size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* ============ CHARTS ============ */}
        {an.data ? (
          <View style={[s.grid, isWide && s.grid2]}>
            <View style={[s.chartCard, shadows.card as any]}>
              <View style={s.chartHead}>
                <Text style={s.chartTitle}>الإيرادات · آخر ٣٠ يوم</Text>
                <Text style={s.chartTotal}>{jod(an.data.revenue_series.reduce((n: number, d: any) => n + d.value, 0))}</Text>
              </View>
              <BarChart data={an.data.revenue_series} valueLabel={(v) => jod(v)} />
            </View>
            <View style={[s.chartCard, shadows.card as any]}>
              <View style={s.chartHead}>
                <Text style={s.chartTitle}>الحجوزات · آخر ٣٠ يوم</Text>
                <Text style={s.chartTotal}>{an.data.booking_series.reduce((n: number, d: any) => n + d.value, 0)}</Text>
              </View>
              <BarChart data={an.data.booking_series} />
            </View>
          </View>
        ) : null}

        {/* ============ SECONDARY STATS ============ */}
        <View style={[s.grid, (isWide || isTablet) && s.grid4]}>
          <MiniStat label="ملاك المنشآت" value={String(o.owners)} />
          <MiniStat label="بانتظار التوثيق" value={String(o.facilities_pending)} warn={o.facilities_pending > 0} />
          <MiniStat label="المبالغ المستردة" value={jod(o.refunds)} />
          <MiniStat label="ملغاة" value={String(o.cancellations)} />
        </View>

        {/* ============ QUICK ACTIONS ============ */}
        <Text style={s.sectionTitle}>إجراءات سريعة</Text>
        <View style={s.actionGrid}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={() => router.push(a.to as any)} style={[s.action, shadows.card as any]}>
              <View style={s.actionIcon}>{a.icon}</View>
              <Text style={s.actionLabel}>{a.label}</Text>
              {a.badge ? (
                <View style={s.badge}><Text style={s.badgeTxt}>{a.badge}</Text></View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={s.brandRow}>
          <SoccerBall size={20} color={colors.pine} weight="fill" />
          <Text style={s.brandTxt}>Book · لوحة تحكم المشرف</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.mini, shadows.card as any]}>
      <Text style={[s.miniValue, warn && { color: colors.warning }]}>{value}</Text>
      <Text style={s.miniLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  /* hero */
  hero: { paddingHorizontal: spacing.xl, paddingBottom: spacing["3xl"], overflow: "hidden", position: "relative" },
  heroVolt: { position: "absolute", top: -60, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: c.volt, opacity: 0.12 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.volt, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: fontSize.xl, fontWeight: "800", color: c.brand },
  heroHi: { fontSize: fontSize.lg, fontWeight: "700", color: "#fff" },
  heroDate: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.6)" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(185,236,46,0.14)", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(185,236,46,0.3)" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.volt },
  statusTxt: { fontSize: fontSize.sm, fontWeight: "700", color: c.volt },
  heroTitle: { fontSize: fontSize["4xl"], fontWeight: "800", color: "#fff", marginTop: spacing.lg },
  heroSub: { fontSize: fontSize.base, color: "rgba(255,255,255,0.65)", marginTop: spacing.xs, lineHeight: 24 },

  body: { padding: spacing.lg, gap: spacing.lg, marginTop: -spacing.xl },
  bodyWide: { maxWidth: 1200, alignSelf: "center", width: "100%" },
  grid: { gap: spacing.md },
  grid2: { flexDirection: "row", flexWrap: "wrap" },
  grid4: { flexDirection: "row", flexWrap: "wrap" },

  /* KPI */
  kpi: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, flex: 1, minWidth: 160, borderWidth: 1, borderColor: c.border },
  kpiAccent: { backgroundColor: c.volt, borderColor: c.volt },
  kpiIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  kpiIconAccent: { backgroundColor: "rgba(12,20,17,0.1)" },
  kpiValue: { fontSize: fontSize["2xl"], fontWeight: "800", color: c.onSurface },
  kpiLabel: { fontSize: fontSize.sm, color: c.muted, fontWeight: "600" },

  /* alerts */
  alertCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: c.warning + "55" },
  alertHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  alertTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  alertRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: 10, padding: spacing.md },
  alertTxt: { flex: 1, fontSize: fontSize.base, color: c.onSurface, fontWeight: "600" },

  /* charts */
  chartCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, flex: 1, minWidth: 300, borderWidth: 1, borderColor: c.border },
  chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chartTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  chartTotal: { fontSize: fontSize.xl, fontWeight: "800", color: c.pine },

  /* mini stats */
  mini: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 4, flex: 1, minWidth: 140, borderWidth: 1, borderColor: c.border, alignItems: "center" },
  miniValue: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  miniLabel: { fontSize: fontSize.sm, color: c.muted },

  /* actions */
  sectionTitle: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  action: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center", gap: spacing.sm, width: 108, borderWidth: 1, borderColor: c.border, position: "relative" },
  actionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.pine, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: fontSize.sm, fontWeight: "700", color: c.onSurface, textAlign: "center" },
  badge: { position: "absolute", top: 8, left: 8, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: c.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeTxt: { color: "#fff", fontSize: fontSize.sm, fontWeight: "800" },

  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingTop: spacing.lg },
  brandTxt: { fontSize: fontSize.sm, color: c.muted, fontWeight: "600" },
}));
