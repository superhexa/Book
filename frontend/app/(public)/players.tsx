// Public players directory: search + position filter.
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { MagnifyingGlass, User } from "phosphor-react-native";

import { PlayerCard } from "@/src/components/public/cards";
import { Pagination, useGridCols } from "@/src/components/public/chrome";
import { EmptySearch, EmptyState } from "@/src/components/public/EmptyState";
import { GridSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { positionAr, usePlayers } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Chip } from "@/src/ui";

const LIMIT = 12;
const POSITIONS = ["", "GK", "DF", "MF", "FW"];

export default function PlayersPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const cols = useGridCols();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [position, setPosition] = useState("");
  const [page, setPage] = useState(1);

  const query = usePlayers({ q: appliedQ || undefined, position: position || undefined, page, limit: LIMIT });
  const items = query.data?.items ?? [];
  const cardWidth = cols === 3 ? "31.8%" : cols === 2 ? "48.5%" : "100%";

  return (
    <PublicPage
      title={t("players.title", "اللاعبون")}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      testID="players-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("players.kicker", "نجوم الملاعب")}
          title={t("players.title", "اللاعبون")}
          subtitle={t("players.subtitle", "تعرف على نجوم الدوريات الأردنية وإحصائياتهم.")}
        />

        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <MagnifyingGlass size={20} color={colors.muted} />
            <TextInput
              testID="players-search"
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => {
                setAppliedQ(q);
                setPage(1);
              }}
              placeholder={t("players.search_ph", "ابحث عن لاعب...")}
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              returnKeyType="search"
            />
          </View>
        </View>

        <View style={s.filters}>
          {POSITIONS.map((p) => (
            <Chip
              key={p || "all"}
              label={p ? positionAr(p) : t("common.all", "الكل")}
              selected={position === p}
              onPress={() => {
                setPosition(p);
                setPage(1);
              }}
              testID={`pos-${p || "all"}`}
            />
          ))}
        </View>

        {query.isLoading ? (
          <GridSkeleton count={6} />
        ) : query.isError ? (
          <EmptyState
            title={t("common.error_title", "تعذّر تحميل اللاعبين")}
            actionLabel={t("common.retry", "إعادة المحاولة")}
            onAction={() => query.refetch()}
          />
        ) : items.length === 0 ? (
          appliedQ || position ? (
            <EmptySearch
              onReset={() => {
                setQ("");
                setAppliedQ("");
                setPosition("");
                setPage(1);
              }}
            />
          ) : (
            <EmptyState
              testID="players-empty"
              icon={<User size={34} color="#FF5436" weight="duotone" />}
              title={t("players.empty", "لا يوجد لاعبون مسجلون بعد")}
              subtitle={t("players.empty_sub", "نعمل على إضافة قوائم اللاعبين — عُد قريباً.")}
            />
          )
        ) : (
          <>
            <View style={[s.grid, { flexDirection: "row", flexWrap: "wrap" }]}>
              {items.map((p) => (
                <View key={p.id} style={{ width: cardWidth as any, marginBottom: spacing.lg }}>
                  <PlayerCard player={p} testID={`player-card-${p.id}`} />
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
  searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52,
  },
  searchInput: { flex: 1, color: c.onSurface, fontSize: fontSize.lg, height: "100%", textAlign: "right" },
  filters: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xl },
  grid: { justifyContent: "space-between" },
}));
