// Public matches directory: live / upcoming / finished filters.
import { useState } from "react";
import { Text, View } from "react-native";
import { SoccerBall } from "phosphor-react-native";

import { MatchCard } from "@/src/components/public/cards";
import { Pagination } from "@/src/components/public/chrome";
import { EmptyState } from "@/src/components/public/EmptyState";
import { GridSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { useMatches } from "@/src/sport-api";
import { makeStyles, spacing } from "@/src/theme";
import { Chip } from "@/src/ui";

const LIMIT = 12;

export default function MatchesPage() {
  const s = useStyles();
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const q = useMatches({ status: status || undefined, page, limit: LIMIT });
  const items = q.data?.items ?? [];

  return (
    <PublicPage
      title={t("matches.title", "المباريات")}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      testID="matches-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("matches.kicker", "روزنامة المباريات")}
          title={t("matches.title", "المباريات")}
          subtitle={t("matches.subtitle", "تابع المباريات المباشرة، القادمة، والنتائج النهائية.")}
        />

        <View style={s.filters}>
          {[
            { k: "", l: t("common.all", "الكل") },
            { k: "LIVE", l: t("matches.live", "مباشر الآن") },
            { k: "SCHEDULED", l: t("matches.upcoming", "قادمة") },
            { k: "FINISHED", l: t("matches.finished", "انتهت") },
          ].map((o) => (
            <Chip key={o.k} label={o.l} selected={status === o.k} onPress={() => { setStatus(o.k); setPage(1); }} testID={`match-status-${o.k || "all"}`} />
          ))}
        </View>

        {q.isLoading ? (
          <GridSkeleton count={5} />
        ) : q.isError ? (
          <EmptyState
            title={t("common.error_title", "تعذّر تحميل المباريات")}
            actionLabel={t("common.retry", "إعادة المحاولة")}
            onAction={() => q.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            testID="matches-empty"
            icon={<SoccerBall size={34} color="#FF5436" weight="duotone" />}
            title={t("matches.empty", "لا توجد مباريات")}
            subtitle={t("matches.empty_sub", "لا توجد مباريات مجدولة حالياً — عُد قريباً لمتابعة الجديد.")}
          />
        ) : (
          <>
            <View style={s.list}>
              {items.map((m) => (
                <MatchCard key={m.id} match={m} testID={`match-card-${m.id}`} />
              ))}
            </View>
            <Pagination page={page} total={q.data?.total ?? 0} limit={LIMIT} onChange={setPage} />
          </>
        )}
        <View style={{ height: spacing["2xl"] }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  filters: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xl },
  list: { gap: spacing.md, maxWidth: 820, width: "100%", alignSelf: "center" },
}));
