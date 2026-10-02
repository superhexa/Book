// Match center: score header, status, venue, events timeline.
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Clock, MapPin, SoccerBall, User, Whistle } from "phosphor-react-native";

import { EmptyState } from "@/src/components/public/EmptyState";
import { TextSkeleton } from "@/src/components/public/Skeleton";
import { SectionHeader } from "@/src/components/public/chrome";
import { PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { arDate, arTime, isFinishedStatus, isLiveStatus, matchStatusAr, useMatch } from "@/src/sport-api";
import type { MatchEvent } from "@/src/sport-api";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";

const FALLBACK_LOGO = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?crop=entropy&cs=srgb&fm=jpg&w=400&q=70";

export default function MatchDetailPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useMatch(typeof id === "string" ? id : undefined);
  const m = q.data;
  const live = m ? isLiveStatus(m.status) : false;
  const finished = m ? isFinishedStatus(m.status) : false;
  const showScore = live || finished;

  return (
    <PublicPage
      title={m ? `${m.home?.name} × ${m.away?.name}` : t("matches.detail", "مركز المباراة")}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      testID="match-detail"
    >
      {q.isLoading ? (
        <PageWrap>
          <View style={{ paddingTop: spacing.xl }}>
            <TextSkeleton lines={5} />
          </View>
        </PageWrap>
      ) : !m ? (
        <PageWrap>
          <EmptyState
            testID="match-not-found"
            title={t("matches.not_found", "المباراة غير موجودة")}
            actionLabel={t("matches.browse", "تصفح المباريات")}
            onAction={() => router.push("/matches")}
          />
        </PageWrap>
      ) : (
        <PageWrap>
          <View style={[s.scoreCard, shadows.md as any]}>
            <View style={s.topRow}>
              <View style={s.leagueChip}>
                <Text style={s.leagueTxt} numberOfLines={1}>{m.league || t("matches.match", "مباراة")}</Text>
              </View>
              <View style={[s.statusPill, live && s.statusLive]}>
                {live ? <View style={s.liveDot} /> : null}
                <Text style={[s.statusTxt, live && { color: "#FFFFFF" }]}>{matchStatusAr(m.status)}</Text>
              </View>
            </View>

            <View style={s.teamsRow}>
              <TeamBlock name={m.home?.name} logo={m.home?.logo} />
              <View style={s.scoreBox}>
                {showScore ? (
                  <Text style={s.score}>
                    {m.home_score ?? 0} - {m.away_score ?? 0}
                  </Text>
                ) : (
                  <>
                    <Text style={s.vs}>VS</Text>
                    <Text style={s.kickoff}>{arTime(m.kickoff)}</Text>
                  </>
                )}
                <Text style={s.date}>{arDate(m.kickoff)}</Text>
              </View>
              <TeamBlock name={m.away?.name} logo={m.away?.logo} />
            </View>

            <View style={s.metaGrid}>
              {m.venue ? (
                <View style={s.metaItem}>
                  <MapPin size={16} color={colors.brandPrimary} />
                  <Text style={s.metaTxt}>{m.venue}</Text>
                </View>
              ) : null}
              {m.round ? (
                <View style={s.metaItem}>
                  <SoccerBall size={16} color={colors.brandPrimary} />
                  <Text style={s.metaTxt}>{m.round}</Text>
                </View>
              ) : null}
              {m.referee ? (
                <View style={s.metaItem}>
                  <Whistle size={16} color={colors.brandPrimary} />
                  <Text style={s.metaTxt}>{t("matches.referee", "الحكم")}: {m.referee}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={s.block}>
            <SectionHeader title={t("matches.events", "أحداث المباراة")} />
            {!m.events?.length ? (
              <EmptyState
                icon={<Clock size={30} color={colors.muted} weight="duotone" />}
                title={showScore ? t("matches.no_events", "لا توجد أحداث مسجلة") : t("matches.not_started", "لم تبدأ المباراة بعد")}
                subtitle={showScore ? undefined : t("matches.not_started_sub", "ستظهر الأحداث هنا فور انطلاق المباراة.")}
              />
            ) : (
              <View style={s.timeline}>
                {m.events.map((e, i) => (
                  <EventRow key={e.id || i} event={e} last={i === m.events!.length - 1} />
                ))}
              </View>
            )}
          </View>
          <View style={{ height: spacing.xl }} />
        </PageWrap>
      )}
    </PublicPage>
  );
}

function TeamBlock({ name, logo }: { name?: string; logo?: string }) {
  const s = useStyles();
  return (
    <View style={s.teamBlock}>
      <Image source={{ uri: logo || FALLBACK_LOGO }} style={s.teamLogo} contentFit="cover" />
      <Text style={s.teamName} numberOfLines={2}>{name || "—"}</Text>
    </View>
  );
}

function EventRow({ event, last }: { event: MatchEvent; last?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const icon = eventIcon(event.type, colors);
  return (
    <View style={s.eventRow}>
      <View style={s.eventRail}>
        <View style={s.eventIcon}>{icon}</View>
        {!last ? <View style={s.eventLine} /> : null}
      </View>
      <View style={s.eventBody}>
        <View style={s.eventHead}>
          <Text style={s.eventMinute}>{event.minute != null ? `${event.minute}'` : ""}</Text>
          <Text style={s.eventTitle}>{eventTitle(event)}</Text>
        </View>
        {[event.player, event.team, event.detail].filter(Boolean).map((txt, i) => (
          <Text key={i} style={s.eventSub}>{txt}</Text>
        ))}
      </View>
    </View>
  );
}

function eventTitle(e: MatchEvent): string {
  const t = e.type.toUpperCase();
  if (t.includes("GOAL")) return "هدف";
  if (t.includes("OWN_GOAL")) return "هدف عكسي";
  if (t.includes("PENALTY")) return "ركلة جزاء";
  if (t === "YELLOW" || t.includes("YELLOW_CARD")) return "بطاقة صفراء";
  if (t === "RED" || t.includes("RED_CARD")) return "بطاقة حمراء";
  if (t.includes("SUB")) return "تبديل";
  if (t.includes("VAR")) return "مراجعة VAR";
  return e.type;
}

function eventIcon(type: string, colors: any) {
  const t = type.toUpperCase();
  if (t.includes("GOAL") || t.includes("PENALTY"))
    return <SoccerBall size={18} color={colors.success} weight="fill" />;
  if (t.includes("YELLOW")) return <View style={[eventCardStyle, { backgroundColor: colors.warning }]} />;
  if (t.includes("RED")) return <View style={[eventCardStyle, { backgroundColor: colors.error }]} />;
  if (t.includes("SUB")) return <User size={18} color={colors.info} />;
  return <Clock size={18} color={colors.muted} />;
}
const eventCardStyle = { width: 14, height: 20, borderRadius: 3 };

const useStyles = makeStyles((c) => ({
  scoreCard: { backgroundColor: c.surfaceInverse, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing["2xl"] },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  leagueChip: { backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, maxWidth: "60%" },
  leagueTxt: { color: "#FFFFFFDD", fontSize: fontSize.sm, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.14)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  statusLive: { backgroundColor: c.error },
  statusTxt: { color: "#FFFFFFDD", fontSize: fontSize.base, fontWeight: "700" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },

  teamsRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  teamBlock: { flex: 1, alignItems: "center", gap: spacing.sm },
  teamLogo: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.12)" },
  teamName: { color: "#FFFFFF", fontSize: fontSize.lg, fontWeight: "700", textAlign: "center" },
  scoreBox: { alignItems: "center", paddingHorizontal: spacing.md, minWidth: 130 },
  score: { color: "#FFFFFF", fontSize: 52, fontWeight: "800", letterSpacing: 2 },
  vs: { color: "#FFFFFF88", fontSize: fontSize["2xl"], fontWeight: "800", letterSpacing: 4 },
  kickoff: { color: c.brandPrimary, fontSize: fontSize["2xl"], fontWeight: "800", marginTop: 4 },
  date: { color: "#FFFFFF99", fontSize: fontSize.base, marginTop: spacing.sm, textAlign: "center" },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl, justifyContent: "center" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  metaTxt: { color: "#FFFFFFDD", fontSize: fontSize.sm, fontWeight: "600" },

  block: { marginTop: spacing["2xl"] },
  timeline: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  eventRow: { flexDirection: "row", gap: spacing.md },
  eventRail: { alignItems: "center", width: 32 },
  eventIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  eventLine: { width: 2, flex: 1, backgroundColor: c.border, marginVertical: 4, minHeight: 24 },
  eventBody: { flex: 1, paddingBottom: spacing.lg },
  eventHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  eventMinute: { color: c.brandPrimary, fontWeight: "800", fontSize: fontSize.base, minWidth: 34 },
  eventTitle: { color: c.onSurface, fontWeight: "700", fontSize: fontSize.base },
  eventSub: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
}));
