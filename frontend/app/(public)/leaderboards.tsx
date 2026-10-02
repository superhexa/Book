// Leaderboards: top scorers / top assists.
import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Target } from "phosphor-react-native";

import { EmptyState } from "@/src/components/public/EmptyState";
import { TableSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { useTopAssists, useTopScorers } from "@/src/sport-api";
import type { Scorer } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing } from "@/src/theme";
import { Segmented } from "@/src/ui";

const FALLBACK = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?crop=entropy&cs=srgb&fm=jpg&w=400&q=70";

export default function LeaderboardsPage() {
  const s = useStyles();
  const { t } = useTranslation();
  const [tab, setTab] = useState("scorers");

  const scorers = useTopScorers(15);
  const assists = useTopAssists(15);
  const active = tab === "scorers" ? scorers : assists;
  const rows = active.data?.items ?? [];
  const statKey = tab === "scorers" ? "goals" : "assists";
  const statLabel = tab === "scorers" ? t("board.goals", "أهداف") : t("board.assists", "تمريرات");

  return (
    <PublicPage
      title={t("board.title", "الهدافون")}
      refreshing={active.isRefetching}
      onRefresh={() => {
        scorers.refetch();
        assists.refetch();
      }}
      testID="leaderboards-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("board.kicker", "قوائم الشرف")}
          title={t("board.title", "ترتيب الهدافين")}
          subtitle={t("board.subtitle", "نجوم التهديف وصناعة اللعب في الدوريات الأردنية.")}
        />

        <View style={s.tabs}>
          <Segmented
            options={[
              { key: "scorers", label: t("board.scorers", "الهدافون") },
              { key: "assists", label: t("board.assists_tab", "صناع اللعب") },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {active.isLoading ? (
          <TableSkeleton rows={8} />
        ) : !rows.length ? (
          <EmptyState
            testID="board-empty"
            icon={<Target size={34} color="#FF5436" weight="duotone" />}
            title={t("board.empty", "لا توجد إحصائيات بعد")}
            subtitle={t("board.empty_sub", "ستظهر قوائم الهدافين فور انطلاق المباريات.")}
          />
        ) : (
          <View style={s.card}>
            {rows.map((r: Scorer, i: number) => (
              <Pressable
                key={r.player_id}
                testID={`board-row-${r.player_id}`}
                onPress={() => router.push(`/players/${r.player_id}` as any)}
                style={[s.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={[s.rankBadge, i < 3 && s.rankTop]}>
                  <Text style={[s.rankTxt, i < 3 && { color: "#FFFFFF" }]}>{i + 1}</Text>
                </View>
                <Image source={{ uri: r.photo || FALLBACK }} style={s.photo} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{r.player_name}</Text>
                  <Text style={s.team} numberOfLines={1}>{r.team_name || ""}</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statNum}>{statKey === "goals" ? r.goals : (r.assists ?? 0)}</Text>
                  <Text style={s.statLbl}>{statLabel}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ height: spacing["2xl"] }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  tabs: { marginBottom: spacing.xl, maxWidth: 480 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  rankBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  rankTop: { backgroundColor: c.brandPrimary },
  rankTxt: { color: c.onSurfaceTertiary, fontWeight: "800", fontSize: fontSize.base },
  photo: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.surfaceTertiary },
  name: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  team: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  statBox: { alignItems: "center", backgroundColor: c.brandTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 72 },
  statNum: { color: c.onBrandTertiary, fontSize: fontSize.xl, fontWeight: "800" },
  statLbl: { color: c.onBrandTertiary, fontSize: fontSize.sm },
}));
