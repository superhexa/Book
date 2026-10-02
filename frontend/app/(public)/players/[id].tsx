// Player detail: profile header, season stats, career info.
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { User } from "phosphor-react-native";

import { EmptyState } from "@/src/components/public/EmptyState";
import { TextSkeleton } from "@/src/components/public/Skeleton";
import { PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { positionAr, usePlayer } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FALLBACK = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?crop=entropy&cs=srgb&fm=jpg&w=400&q=70";

export default function PlayerDetailPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = usePlayer(typeof id === "string" ? id : undefined);
  const p = q.data;

  const stats = [
    { v: p?.appearances ?? "—", l: t("player.apps", "مباراة") },
    { v: p?.goals ?? "—", l: t("player.goals", "أهداف") },
    { v: p?.assists ?? "—", l: t("player.assists", "تمريرات حاسمة") },
    { v: p?.yellow_cards ?? "—", l: t("player.yellow", "بطاقات صفراء") },
    { v: p?.red_cards ?? "—", l: t("player.red", "بطاقات حمراء") },
  ];

  return (
    <PublicPage
      title={p?.name || t("players.detail", "ملف اللاعب")}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      testID="player-detail"
    >
      {q.isLoading ? (
        <PageWrap>
          <View style={{ paddingTop: spacing.xl }}>
            <TextSkeleton lines={4} />
          </View>
        </PageWrap>
      ) : !p ? (
        <PageWrap>
          <EmptyState
            testID="player-not-found"
            title={t("players.not_found", "اللاعب غير موجود")}
            actionLabel={t("players.browse", "تصفح اللاعبين")}
            onAction={() => router.push("/players")}
          />
        </PageWrap>
      ) : (
        <PageWrap>
          <View style={s.header}>
            <Image source={{ uri: p.photo || FALLBACK }} style={s.photo} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.pos}>{positionAr(p.position)}</Text>
              {p.team_name ? (
                <Pressable
                  onPress={() => p.team_id && router.push(`/teams/${p.team_id}` as any)}
                  style={s.teamRow}
                >
                  {p.team_logo ? <Image source={{ uri: p.team_logo }} style={s.teamLogo} contentFit="cover" /> : null}
                  <Text style={s.teamName}>{p.team_name}</Text>
                </Pressable>
              ) : null}
              <Text style={s.meta}>
                {[p.nationality, p.age ? `${p.age} ${t("player.years", "سنة")}` : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>{t("player.season_stats", "إحصائيات الموسم")}</Text>
          <View style={s.statsGrid}>
            {stats.map((st) => (
              <View key={st.l} style={s.statCard}>
                <Text style={s.statNum}>{st.v}</Text>
                <Text style={s.statLbl}>{st.l}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: spacing.xl }} />
        </PageWrap>
      )}
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", gap: spacing.lg, paddingTop: spacing["2xl"], alignItems: "center" },
  photo: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border },
  name: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800" },
  pos: { color: c.brandPrimary, fontSize: fontSize.lg, fontWeight: "700", marginTop: 4 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, alignSelf: "flex-start" },
  teamLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceTertiary },
  teamName: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  meta: { color: c.muted, fontSize: fontSize.base, marginTop: 4 },
  sectionTitle: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800", marginTop: spacing["2xl"], marginBottom: spacing.md },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    flexGrow: 1, flexBasis: "28%", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, padding: spacing.lg, alignItems: "center", gap: 4,
  },
  statNum: { color: c.brandPrimary, fontSize: fontSize["2xl"], fontWeight: "800" },
  statLbl: { color: c.muted, fontSize: fontSize.sm, textAlign: "center" },
}));
