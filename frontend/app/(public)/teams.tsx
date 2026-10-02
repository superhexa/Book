// Public teams directory.
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { MagnifyingGlass, Users } from "phosphor-react-native";

import { TeamCard } from "@/src/components/public/cards";
import { Pagination, useGridCols } from "@/src/components/public/chrome";
import { EmptySearch, EmptyState } from "@/src/components/public/EmptyState";
import { GridSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { useTeams } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const LIMIT = 12;

export default function TeamsPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const cols = useGridCols();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);

  const query = useTeams({ q: appliedQ || undefined, page, limit: LIMIT });
  const items = query.data?.items ?? [];
  const cardWidth = cols === 3 ? "31.8%" : cols === 2 ? "48.5%" : "100%";

  return (
    <PublicPage
      title={t("teams.title", "الفرق")}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      testID="teams-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("teams.kicker", "أندية وفرق")}
          title={t("teams.title", "فرق كرة القدم")}
          subtitle={t("teams.subtitle", "تعرف على فرق الدوريات الأردنية: التشكيلات، الإحصائيات، وآخر المباريات.")}
        />

        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <MagnifyingGlass size={20} color={colors.muted} />
            <TextInput
              testID="teams-search"
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => {
                setAppliedQ(q);
                setPage(1);
              }}
              placeholder={t("teams.search_ph", "ابحث عن فريق...")}
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              returnKeyType="search"
            />
          </View>
        </View>

        {query.isLoading ? (
          <GridSkeleton count={6} />
        ) : query.isError ? (
          <EmptyState
            title={t("common.error_title", "تعذّر تحميل الفرق")}
            actionLabel={t("common.retry", "إعادة المحاولة")}
            onAction={() => query.refetch()}
          />
        ) : items.length === 0 ? (
          appliedQ ? (
            <EmptySearch onReset={() => { setQ(""); setAppliedQ(""); setPage(1); }} />
          ) : (
            <EmptyState
              testID="teams-empty"
              icon={<Users size={34} color="#FF5436" weight="duotone" />}
              title={t("teams.empty", "لا توجد فرق مسجلة بعد")}
              subtitle={t("teams.empty_sub", "نعمل على إضافة فرق الدوريات الأردنية — عُد قريباً.")}
            />
          )
        ) : (
          <>
            <View style={[s.grid, { flexDirection: "row", flexWrap: "wrap" }]}>
              {items.map((tm) => (
                <View key={tm.id} style={{ width: cardWidth as any, marginBottom: spacing.lg }}>
                  <TeamCard team={tm} testID={`team-card-${tm.id}`} />
                </View>
              ))}
            </View>
            <Pagination page={page} total={query.data?.total ?? 0} limit={LIMIT} onChange={setPage} />
          </>
        )}
        <View style={{ height: spacing["2xl"] }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52,
  },
  searchInput: { flex: 1, color: c.onSurface, fontSize: fontSize.lg, height: "100%", textAlign: "right" },
  grid: { justifyContent: "space-between" },
}));
