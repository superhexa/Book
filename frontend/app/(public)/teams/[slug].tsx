// Team detail: crest, info, season stats, squad, recent fixtures.
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MapPin, Users } from "phosphor-react-native";

import { MatchCard, PlayerCard } from "@/src/components/public/cards";
import { EmptyState } from "@/src/components/public/EmptyState";
import { TextSkeleton } from "@/src/components/public/Skeleton";
import { SectionHeader } from "@/src/components/public/chrome";
import { PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { useMatches, useTeam } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FALLBACK_LOGO = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?crop=entropy&cs=srgb&fm=jpg&w=400&q=70";

export default function TeamDetailPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const id = typeof slug === "string" ? slug : undefined;

  const q = useTeam(id);
  const team = q.data;
  const fixtures = useMatches({ team_id: team?.id, limit: 5 });
  const squad = team?.players ?? [];

  const stats = [
    { v: team?.played ?? "—", l: t("team.played", "مباراة") },
    { v: team?.won ?? "—", l: t("team.won", "فوز") },
    { v: team?.drawn ?? "—", l: t("team.drawn", "تعادل") },
    { v: team?.lost ?? "—", l: t("team.lost", "خسارة") },
    { v: team?.goals_for ?? "—", l: t("team.gf", "أهداف له") },
    { v: team?.points ?? "—", l: t("team.points", "نقاط") },
  ];

  return (
    <PublicPage
      title={team?.name || t("teams.detail", "تفاصيل الفريق")}
      refreshing={q.isRefetching}
      onRefresh={() => {
        q.refetch();
        fixtures.refetch();
      }}
      testID="team-detail"
    >
      {q.isLoading ? (
        <PageWrap>
          <View style={{ paddingTop: spacing.xl }}>
            <TextSkeleton lines={4} />
          </View>
        </PageWrap>
      ) : !team ? (
        <PageWrap>
          <EmptyState
            testID="team-not-found"
            title={t("teams.not_found", "الفريق غير موجود")}
            subtitle={t("teams.not_found_sub", "ربما تمت إزالة هذا الفريق أو الرابط غير صحيح.")}
            actionLabel={t("teams.browse", "تصفح الفرق")}
            onAction={() => router.push("/teams")}
          />
        </PageWrap>
      ) : (
        <PageWrap>
          <View style={s.header}>
            <Image source={{ uri: team.logo || FALLBACK_LOGO }} style={s.logo} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{team.name}</Text>
              <View style={s.locRow}>
                <MapPin size={15} color={colors.muted} />
                <Text style={s.loc}>{team.city || "الأردن"}</Text>
              </View>
              <Text style={s.meta}>
                {[team.founded ? `${t("team.founded", "تأسس")} ${team.founded}` : null, team.coach ? `${t("team.coach", "المدرب")}: ${team.coach}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>

          <View style={s.statsGrid}>
            {stats.map((st) => (
              <View key={st.l} style={s.statCard}>
                <Text style={s.statNum}>{st.v}</Text>
                <Text style={s.statLbl}>{st.l}</Text>
              </View>
            ))}
          </View>

          <View style={s.block}>
            <SectionHeader title={t("team.squad", "التشكيلة")} />
            {!squad.length ? (
              <EmptyState
                icon={<Users size={30} color={colors.muted} weight="duotone" />}
                title={t("team.no_squad", "التشكيلة غير متاحة بعد")}
                subtitle={t("team.no_squad_sub", "سيتم إضافة قائمة اللاعبين قريباً.")}
              />
            ) : (
              <View style={s.list}>
                {squad.map((p) => (
                  <PlayerCard key={p.id} player={p} />
                ))}
              </View>
            )}
          </View>

          <View style={s.block}>
            <SectionHeader
              title={t("team.fixtures", "آخر المباريات")}
              actionLabel={fixtures.data?.items?.length ? t("common.view_all", "عرض الكل") : undefined}
              onAction={() => router.push("/matches" as any)}
            />
            {fixtures.isLoading ? (
              <TextSkeleton lines={3} />
            ) : !fixtures.data?.items?.length ? (
              <EmptyState
                title={t("team.no_fixtures", "لا توجد مباريات بعد")}
                subtitle={t("team.no_fixtures_sub", "سيتم جدولة مباريات الفريق قريباً.")}
              />
            ) : (
              <View style={s.list}>
                {fixtures.data.items.map((m) => (
                  <MatchCard key={m.id} match={m} />
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

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingTop: spacing["2xl"] },
  logo: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  title: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  loc: { color: c.muted, fontSize: fontSize.base },
  meta: { color: c.muted, fontSize: fontSize.base, marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  statCard: {
    flexGrow: 1, flexBasis: "28%", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, padding: spacing.lg, alignItems: "center", gap: 4,
  },
  statNum: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "800" },
  statLbl: { color: c.muted, fontSize: fontSize.sm },
  block: { marginTop: spacing["2xl"] },
  list: { gap: spacing.md },
}));
