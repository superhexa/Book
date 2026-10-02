// Rankings: pick a league, see its standings table.
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { ScrollView, Text, View } from "react-native";
import { ChartBar } from "phosphor-react-native";

import { EmptyState } from "@/src/components/public/EmptyState";
import { TableSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { useLeagues, useStandings } from "@/src/sport-api";
import type { StandingRow } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Chip } from "@/src/ui";

export default function RankingsPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [leagueId, setLeagueId] = useState<string | undefined>();

  const leagues = useLeagues(1, 20, "ACTIVE");
  useEffect(() => {
    if (!leagueId && leagues.data?.items?.length) setLeagueId(leagues.data.items[0].id);
  }, [leagues.data, leagueId]);

  const standings = useStandings(leagueId);
  const rows = standings.data?.items ?? [];

  return (
    <PublicPage
      title={t("rankings.title", "الترتيب")}
      refreshing={standings.isRefetching}
      onRefresh={() => {
        leagues.refetch();
        standings.refetch();
      }}
      testID="rankings-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("rankings.kicker", "جداول الترتيب")}
          title={t("rankings.title", "ترتيب الدوريات")}
          subtitle={t("rankings.subtitle", "جداول ترتيب محدثة لفرق الدوريات الأردنية.")}
        />

        {leagues.isLoading ? (
          <TableSkeleton rows={3} />
        ) : !leagues.data?.items?.length ? (
          <EmptyState
            testID="rankings-empty"
            icon={<ChartBar size={34} color="#FF5436" weight="duotone" />}
            title={t("rankings.empty", "لا توجد دوريات لعرض ترتيبها")}
            subtitle={t("rankings.empty_sub", "نعمل على إضافة الدوريات — عُد قريباً.")}
          />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              {leagues.data.items.map((l) => (
                <Chip
                  key={l.id}
                  label={l.name}
                  selected={leagueId === l.id}
                  onPress={() => setLeagueId(l.id)}
                  testID={`rank-league-${l.id}`}
                />
              ))}
            </ScrollView>

            {standings.isLoading ? (
              <TableSkeleton rows={8} />
            ) : !rows.length ? (
              <EmptyState
                title={t("rankings.no_rows", "لا يوجد ترتيب بعد")}
                subtitle={t("rankings.no_rows_sub", "سيظهر جدول الترتيب فور انطلاق مباريات الدوري.")}
              />
            ) : (
              <View style={s.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={[s.tr, s.trHead]}>
                      {["#", t("standings.team", "الفريق"), t("standings.p", "لعب"), t("standings.w", "فاز"), t("standings.d", "تعادل"), t("standings.l", "خسر"), t("standings.gd", "الفرق"), t("standings.pts", "نقاط")].map((c, i) => (
                        <Text key={i} style={[s.th, i === 1 && s.thTeam]}>{c}</Text>
                      ))}
                    </View>
                    {rows.map((r: StandingRow, i: number) => (
                      <View key={r.team_id} style={[s.tr, i % 2 === 1 && s.trAlt]}>
                        <View style={s.rankCell}>
                          {i < 2 ? <View style={[s.zoneBar, { backgroundColor: colors.success }]} /> : null}
                          <Text style={s.rank}>{i + 1}</Text>
                        </View>
                        <View style={s.teamCell}>
                          {r.team_logo ? <Image source={{ uri: r.team_logo }} style={s.teamLogo} contentFit="cover" /> : null}
                          <Text style={s.teamName} numberOfLines={1}>{r.team_name}</Text>
                        </View>
                        {[r.played, r.won, r.drawn, r.lost, r.gd].map((v, j) => (
                          <Text key={j} style={s.td}>{v}</Text>
                        ))}
                        <Text style={[s.td, s.pts]}>{r.points}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <View style={s.legend}>
                  <View style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: colors.success }]} />
                    <Text style={s.legendTxt}>{t("rankings.legend_top", "مراكز التأهل")}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
        <View style={{ height: spacing["2xl"] }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  chips: { gap: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.lg },
  tableCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.divider, minHeight: 54 },
  trHead: { backgroundColor: c.surfaceSecondary, minHeight: 44 },
  trAlt: { backgroundColor: c.surfaceSecondary + "55" },
  th: { width: 56, textAlign: "center", color: c.muted, fontSize: fontSize.sm, fontWeight: "700" },
  thTeam: { width: 200, textAlign: "right", paddingHorizontal: spacing.md },
  rankCell: { width: 56, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  zoneBar: { position: "absolute", right: 0, top: 10, bottom: 10, width: 4, borderRadius: 2 },
  rank: { color: c.onSurface, fontWeight: "700", fontSize: fontSize.base },
  teamCell: { width: 200, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  teamLogo: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surfaceTertiary },
  teamName: { color: c.onSurface, fontWeight: "700", fontSize: fontSize.base, flex: 1 },
  td: { width: 56, textAlign: "center", color: c.onSurfaceSecondary, fontSize: fontSize.base },
  pts: { color: c.onSurface, fontWeight: "800" },
  legend: { flexDirection: "row", padding: spacing.md, borderTopWidth: 1, borderTopColor: c.divider },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { color: c.muted, fontSize: fontSize.sm },
}));
