// Public leagues directory.
import { useState } from "react";
import { View } from "react-native";
import { Trophy } from "phosphor-react-native";

import { LeagueCard } from "@/src/components/public/cards";
import { Pagination, SectionHeader, useGridCols } from "@/src/components/public/chrome";
import { EmptyState } from "@/src/components/public/EmptyState";
import { GridSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { useLeagues } from "@/src/sport-api";
import { makeStyles, spacing } from "@/src/theme";
import { Chip } from "@/src/ui";

const LIMIT = 12;

export default function LeaguesPage() {
  const s = useStyles();
  const { t } = useTranslation();
  const cols = useGridCols();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const q = useLeagues(page, LIMIT, status || undefined);
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const cardWidth = cols === 3 ? "31.8%" : cols === 2 ? "48.5%" : "100%";

  return (
    <PublicPage
      title={t("leagues.title", "الدوريات")}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      testID="leagues-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("leagues.kicker", "منافسات")}
          title={t("leagues.title", "الدوريات والبطولات")}
          subtitle={t("leagues.subtitle", "تابع دوريات كرة القدم الأردنية: الترتيب، المباريات، والنتائج لحظة بلحظة.")}
        />

        <View style={s.filters}>
          {[
            { k: "", l: t("common.all", "الكل") },
            { k: "ACTIVE", l: t("leagues.active", "نشطة") },
            { k: "UPCOMING", l: t("leagues.upcoming", "قادمة") },
            { k: "FINISHED", l: t("leagues.finished", "منتهية") },
          ].map((o) => (
            <Chip key={o.k} label={o.l} selected={status === o.k} onPress={() => { setStatus(o.k); setPage(1); }} testID={`league-status-${o.k || "all"}`} />
          ))}
        </View>

        {q.isLoading ? (
          <GridSkeleton count={6} />
        ) : q.isError ? (
          <EmptyState
            title={t("common.error_title", "تعذّر تحميل الدوريات")}
            subtitle={t("common.error_sub", "تحقق من اتصالك بالإنترنت وحاول مجدداً.")}
            actionLabel={t("common.retry", "إعادة المحاولة")}
            onAction={() => q.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            testID="leagues-empty"
            icon={<Trophy size={34} color="#FF5436" weight="duotone" />}
            title={t("leagues.empty", "لا توجد دوريات حالياً")}
            subtitle={t("leagues.empty_sub", "نعمل على إضافة الدوريات والبطولات الأردنية — عُد قريباً.")}
          />
        ) : (
          <>
            <View style={[s.grid, { flexDirection: "row", flexWrap: "wrap" }]}>
              {items.map((l) => (
                <View key={l.id} style={{ width: cardWidth as any, marginBottom: spacing.lg }}>
                  <LeagueCard league={l} testID={`league-card-${l.id}`} />
                </View>
              ))}
            </View>
            <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
          </>
        )}
        <View style={{ height: spacing["2xl"] }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  filters: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xl },
  grid: { justifyContent: "space-between" },
}));
