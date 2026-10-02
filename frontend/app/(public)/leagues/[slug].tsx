// League detail: header, standings table, fixtures.
import { useState } from "react";
import { Image } from "expo-image";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Trophy } from "phosphor-react-native";

import { MatchCard } from "@/src/components/public/cards";
import { EmptyState } from "@/src/components/public/EmptyState";
import { TableSkeleton, TextSkeleton } from "@/src/components/public/Skeleton";
import { PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { leagueStatusAr, useLeague, useLeagueFixtures, useStandings } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Segmented } from "@/src/ui";

export default function LeagueDetailPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [tab, setTab] = useState("standings");

  const q = useLeague(typeof slug === "string" ? slug : undefined);
  const league = q.data;
  const leagueId = league?.id || (typeof slug === "string" ? slug : undefined);
  const standings = useStandings(leagueId);
  const fixtures = useLeagueFixtures(leagueId);

  return (
    <PublicPage
      title={league?.name || t("leagues.detail", "تفاصيل الدوري")}
      refreshing={q.isRefetching}
      onRefresh={() => {
        q.refetch();
        standings.refetch();
        fixtures.refetch();
      }}
      testID="league-detail"
    >
      {q.isLoading ? (
        <PageWrap>
          <View style={{ paddingTop: spacing.xl }}>
            <TextSkeleton lines={4} />
          </View>
        </PageWrap>
      ) : !league ? (
        <PageWrap>
          <EmptyState
            testID="league-not-found"
            title={t("leagues.not_found", "الدوري غير موجود")}
            subtitle={t("leagues.not_found_sub", "ربما تمت إزالة هذا الدوري أو الرابط غير صحيح.")}
            actionLabel={t("leagues.browse", "تصفح الدوريات")}
            onAction={() => router.push("/leagues")}
          />
        </PageWrap>
      ) : (
        <PageWrap>
          {/* header */}
          <View style={s.header}>
            <View style={s.logoWrap}>
              {league.logo ? (
                <Image source={{ uri: league.logo }} style={s.logo} contentFit="contain" />
              ) : (
                <Trophy size={40} color={colors.brandPrimary} weight="duotone" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{league.name}</Text>
              <Text style={s.meta}>
                {[league.season, league.teams_count ? `${league.teams_count} ${t("leagues.teams", "فرق")}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {league.status ? (
              <View style={s.statusPill}>
                <Text style={s.statusTxt}>{leagueStatusAr(league.status)}</Text>
              </View>
            ) : null}
          </View>
          {league.description ? <Text style={s.desc}>{league.description}</Text> : null}

          <View style={s.tabs}>
            <Segmented
              options={[
                { key: "standings", label: t("leagues.standings", "الترتيب") },
                { key: "fixtures", label: t("leagues.fixtures", "المباريات") },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>

          {tab === "standings" ? (
            standings.isLoading ? (
              <TableSkeleton rows={8} />
            ) : !standings.data?.items?.length ? (
              <EmptyState
                testID="standings-empty"
                title={t("leagues.no_standings", "لا يوجد ترتيب بعد")}
                subtitle={t("leagues.no_standings_sub", "سيظهر جدول الترتيب فور انطلاق مباريات الدوري.")}
              />
            ) : (
              <View style={s.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <StandingsHead />
                    {standings.data.items.map((r, i) => (
                      <StandingsRow key={r.team_id} row={r} rank={i + 1} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )
          ) : fixtures.isLoading ? (
            <TableSkeleton rows={4} />
          ) : !fixtures.data?.items?.length ? (
            <EmptyState
              testID="fixtures-empty"
              title={t("leagues.no_fixtures", "لا توجد مباريات مجدولة")}
              subtitle={t("leagues.no_fixtures_sub", "سيتم الإعلان عن جدول المباريات قريباً.")}
            />
          ) : (
            <View style={s.list}>
              {fixtures.data.items.map((m) => (
                <MatchCard key={m.id} match={m} testID={`fixture-${m.id}`} />
              ))}
            </View>
          )}
          <View style={{ height: spacing.xl }} />
        </PageWrap>
      )}
    </PublicPage>
  );
}

function StandingsHead() {
  const s = useStyles();
  const { t } = useTranslation();
  const cols = ["#", t("standings.team", "الفريق"), t("standings.p", "لعب"), t("standings.w", "فاز"), t("standings.d", "تعادل"), t("standings.l", "خسر"), t("standings.gf", "له"), t("standings.ga", "عليه"), t("standings.gd", "الفرق"), t("standings.pts", "نقاط")];
  return (
    <View style={[s.tr, s.trHead]}>
      {cols.map((c, i) => (
        <Text key={i} style={[s.th, i === 1 && s.thTeam]}>{c}</Text>
      ))}
    </View>
  );
}

function StandingsRow({ row, rank }: { row: import("@/src/sport-api").StandingRow; rank: number }) {
  const s = useStyles();
  const { colors } = useTheme();
  const zone = rank <= 2 ? colors.success : rank >= 99 ? colors.error : null;
  return (
    <View style={[s.tr, rank % 2 === 0 && s.trAlt]}>
      <View style={s.rankCell}>
        {zone ? <View style={[s.zoneBar, { backgroundColor: zone }]} /> : null}
        <Text style={s.rank}>{rank}</Text>
      </View>
      <View style={s.teamCell}>
        {row.team_logo ? <Image source={{ uri: row.team_logo }} style={s.teamLogo} contentFit="cover" /> : null}
        <Text style={s.teamName} numberOfLines={1}>{row.team_name}</Text>
      </View>
      {[row.played, row.won, row.drawn, row.lost, row.gf, row.ga, row.gd].map((v, i) => (
        <Text key={i} style={s.td}>{v}</Text>
      ))}
      <Text style={[s.td, s.pts]}>{row.points}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingTop: spacing["2xl"] },
  logoWrap: {
    width: 88, height: 88, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary,
    borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center",
  },
  logo: { width: 64, height: 64 },
  title: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800" },
  meta: { color: c.muted, fontSize: fontSize.base, marginTop: 4 },
  statusPill: { backgroundColor: c.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  statusTxt: { color: c.onBrandTertiary, fontWeight: "700", fontSize: fontSize.base },
  desc: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 24, marginTop: spacing.md, maxWidth: 720 },
  tabs: { marginTop: spacing.xl, marginBottom: spacing.lg },

  tableCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.divider, minHeight: 52 },
  trHead: { backgroundColor: c.surfaceSecondary, minHeight: 44 },
  trAlt: { backgroundColor: c.surfaceSecondary + "55" },
  th: { width: 52, textAlign: "center", color: c.muted, fontSize: fontSize.sm, fontWeight: "700" },
  thTeam: { width: 190, textAlign: "right", paddingHorizontal: spacing.md },
  rankCell: { width: 52, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  zoneBar: { position: "absolute", right: 0, top: 8, bottom: 8, width: 4, borderRadius: 2 },
  rank: { color: c.onSurface, fontWeight: "700", fontSize: fontSize.base },
  teamCell: { width: 190, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  teamLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary },
  teamName: { color: c.onSurface, fontWeight: "700", fontSize: fontSize.base, flex: 1 },
  td: { width: 52, textAlign: "center", color: c.onSurfaceSecondary, fontSize: fontSize.base },
  pts: { color: c.onSurface, fontWeight: "800" },

  list: { gap: spacing.md },
}));
