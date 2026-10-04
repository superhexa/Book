import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell, CalendarBlank, Heart, MapPin, ShieldCheck, Trophy, UsersThree } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Booking } from "@/src/components/booking-card";
import {
  arDate, arTime, jod, PanelScreen, StatCard, StatGrid, SectionCard, CardGrid,
  SkeletonStats, SkeletonList, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState } from "@/src/ui";

export default function CustomerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const s = useStyles();
  useRtl();

  const upcoming = useQuery({ queryKey: ["dash-upcoming"], queryFn: () => api.get<Booking[]>("/bookings?scope=upcoming") });
  const past = useQuery({ queryKey: ["dash-past"], queryFn: () => api.get<Booking[]>("/bookings?scope=past") });
  const favs = useQuery({ queryKey: ["dash-favs"], queryFn: () => api.get("/favorites") });
  const notifs = useQuery({ queryKey: ["dash-notifs"], queryFn: () => api.get("/notifications?limit=5") });
  const myTeams = useQuery({ queryKey: ["dash-teams"], queryFn: () => api.get<{ items: any[] }>("/teams?mine=true&limit=5") });
  const activeLeagues = useQuery({ queryKey: ["dash-leagues"], queryFn: () => api.get<{ items: any[] }>("/leagues?status=ACTIVE&limit=3") });

  const loading = upcoming.isLoading || past.isLoading;
  const upList: Booking[] = upcoming.data || [];
  const pastList: Booking[] = past.data || [];
  const next: Booking | undefined = upList[0];
  const spent = pastList.reduce((a, b) => a + (b.final_amount || 0), 0);
  const unread = (notifs.data?.items || notifs.data || []).filter((n: any) => !n.read_at).length;

  const hour = new Date().getHours();
  const greet = hour < 12 ? t("dash.morning", "صباح الخير") : hour < 18 ? t("dash.afternoon", "مساء الخير") : t("dash.evening", "مساء النور");

  return (
    <PanelScreen
      testID="customer-dashboard"
    >
      <View style={[s.greetRow, { paddingTop: 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.greet}>{greet}، {user?.name?.split(" ")[0]}</Text>
          <Text style={s.greetSub}>{t("dash.subtitle", "جاهز لمباراتك القادمة؟")}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/my-notifications")}
          style={s.bell}
          accessibilityLabel={t("nav.notifications", "الإشعارات")}
        >
          <Bell size={22} color={colors.onSurface} />
          {unread > 0 ? <View style={s.dot} /> : null}
        </Pressable>
      </View>

      {loading ? (
        <>
          <SkeletonStats count={4} />
          <SkeletonList rows={2} />
        </>
      ) : (
        <>
          <StatGrid>
            <StatCard label={t("dash.upcoming", "حجوزات قادمة")} value={upList.length} accent
              icon={<CalendarBlank size={18} color={colors.onBrandPrimary} />} />
            <StatCard label={t("dash.played", "مباريات لعبتها")} value={pastList.length}
              icon={<Trophy size={18} color={colors.brandPrimary} />} />
            <StatCard label={t("dash.favorites", "ملاعب مفضلة")} value={(favs.data || []).length}
              icon={<Heart size={18} color={colors.brandPrimary} />} />
            <StatCard label={t("dash.spent", "إجمالي الإنفاق")} value={jod(spent)}
              icon={<ShieldCheck size={18} color={colors.brandPrimary} />} />
          </StatGrid>

          <CardGrid>
            <SectionCard
              title={t("dash.nextBooking", "حجزك القادم")}
              action={next ? <Button title={t("dash.details", "التفاصيل")} variant="ghost" onPress={() => router.push(`/my-booking/${next.id}`)} /> : undefined}
            >
              {next ? (
                <Pressable onPress={() => router.push(`/my-booking/${next.id}`)} style={s.nextCard}>
                  <View style={s.nextTop}>
                    <View>
                      <Text style={s.nextTitle}>{next.facility_name}</Text>
                      <Text style={s.nextMeta}>{next.pitch_name}</Text>
                    </View>
                    <View style={s.dateBadge}>
                      <Text style={s.dateBadgeTxt}>{arDate(next.date)}</Text>
                      <Text style={s.dateBadgeTime}>{arTime(next.start_min)} - {arTime(next.end_min)}</Text>
                    </View>
                  </View>
                  <View style={s.nextBottom}>
                    <MapPin size={14} color={colors.muted} />
                    <Text style={s.nextMeta}>{t("dash.beReady", "احضر قبل الموعد بـ 15 دقيقة")}</Text>
                  </View>
                </Pressable>
              ) : (
                <EmptyState
                  title={t("dash.noUpcoming", "لا يوجد حجز قادم")}
                  subtitle={t("dash.noUpcomingSub", "احجز ملعبك القادم وابدأ اللعب")}
                  action={<Button title={t("dash.bookNow", "احجز الآن")} onPress={() => router.push("/discover")} />}
                />
              )}
            </SectionCard>

            <SectionCard title={t("dash.quick", "إجراءات سريعة")}>
              <View style={s.quickGrid}>
                {[
                  { label: t("nav.discover", "استكشف"), icon: <MapPin size={20} color={colors.brandPrimary} />, to: "/discover" },
                  { label: t("nav.bookings", "حجوزاتي"), icon: <CalendarBlank size={20} color={colors.brandPrimary} />, to: "/my-bookings" },
                  { label: t("nav.favorites", "المفضلة"), icon: <Heart size={20} color={colors.brandPrimary} />, to: "/favorites" },
                  { label: t("nav.notifications", "الإشعارات"), icon: <Bell size={20} color={colors.brandPrimary} />, to: "/my-notifications" },
                ].map((q) => (
                  <Pressable key={q.to} onPress={() => router.push(q.to as any)} style={s.quick}>
                    {q.icon}
                    <Text style={s.quickTxt}>{q.label}</Text>
                  </Pressable>
                ))}
              </View>
            </SectionCard>
          </CardGrid>

          <CardGrid>
            <SectionCard
              title={t("dash.team", "فريقي")}
              subtitle={t("dash.teamSub", "فرقك وعضوياتك")}
              action={<Button title="إدارة" variant="ghost" onPress={() => router.push("/teams")} />}
            >
              {(myTeams.data?.items || []).length === 0 ? (
                <View style={s.soonRow}>
                  <UsersThree size={28} color={colors.muted} weight="duotone" />
                  <Text style={s.soonTxt}>{t("dash.noTeam", "لست عضواً في أي فريق بعد — أنشئ فريقك وادعُ أصدقاءك.")}</Text>
                </View>
              ) : (
                (myTeams.data?.items || []).map((tm: any) => (
                  <Pressable key={tm.id} onPress={() => router.push(`/teams/${tm.slug || tm.id}`)} style={s.teamRow}>
                    <UsersThree size={20} color={colors.brandPrimary} />
                    <Text style={s.teamName}>{tm.name}</Text>
                  </Pressable>
                ))
              )}
            </SectionCard>
            <SectionCard
              title={t("dash.league", "الدوري")}
              subtitle={t("dash.leagueSub", "دوريات نشطة الآن")}
              action={<Button title="الدوريات" variant="ghost" onPress={() => router.push("/leagues")} />}
            >
              {(activeLeagues.data?.items || []).length === 0 ? (
                <View style={s.soonRow}>
                  <Trophy size={28} color={colors.muted} weight="duotone" />
                  <Text style={s.soonTxt}>{t("dash.noLeague", "لا توجد دوريات نشطة حالياً.")}</Text>
                </View>
              ) : (
                (activeLeagues.data?.items || []).map((lg: any) => (
                  <Pressable key={lg.id} onPress={() => router.push(`/leagues/${lg.slug || lg.id}`)} style={s.teamRow}>
                    <Trophy size={20} color={colors.brandPrimary} />
                    <Text style={s.teamName}>{lg.name}</Text>
                  </Pressable>
                ))
              )}
            </SectionCard>
          </CardGrid>
        </>
      )}
      <View style={{ height: spacing.xl }} />
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: 10, padding: spacing.sm },
  teamName: { fontSize: fontSize.base, color: c.onSurface, fontWeight: "600" },
  greetRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  greet: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "800" },
  greetSub: { color: c.muted, fontSize: fontSize.base, marginTop: 4 },
  bell: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 12, end: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: c.error },
  nextCard: { backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  nextTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  nextTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  nextMeta: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
  dateBadge: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 2 },
  dateBadgeTxt: { color: c.brandPrimary, fontSize: fontSize.sm, fontWeight: "700" },
  dateBadgeTime: { color: c.onSurface, fontSize: fontSize.sm, fontWeight: "600" },
  nextBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  quick: { flex: 1, minWidth: 100, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", gap: spacing.sm },
  quickTxt: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },
  soonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  soonTxt: { color: c.muted, fontSize: fontSize.base, flex: 1, lineHeight: 24 },
}));
