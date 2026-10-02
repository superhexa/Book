// Public fields directory: search, governorate/type/sort filters, pagination.
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { FunnelSimple, MagnifyingGlass } from "phosphor-react-native";

import { FieldCard } from "@/src/components/public/cards";
import { Pagination, useGridCols, useIsMobile } from "@/src/components/public/chrome";
import { EmptySearch, EmptyState } from "@/src/components/public/EmptyState";
import { GridSkeleton } from "@/src/components/public/Skeleton";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { GOVERNORATES, useFacilities } from "@/src/sport-api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Chip } from "@/src/ui";

const LIMIT = 12;

export default function FieldsPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string; city?: string; date?: string }>();
  const cols = useGridCols();
  const isMobile = useIsMobile();

  const [q, setQ] = useState(typeof params.q === "string" ? params.q : "");
  const [appliedQ, setAppliedQ] = useState(typeof params.q === "string" ? params.q : "");
  const [city, setCity] = useState(typeof params.city === "string" ? params.city : "");
  const [fieldType, setFieldType] = useState("");
  const [sort, setSort] = useState("rating");
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(typeof params.date === "string" ? params.date : "");
  const [showFilters, setShowFilters] = useState(!isMobile);

  const query = useFacilities({ q: appliedQ || undefined, city: city || undefined, field_type: fieldType || undefined, sort, page, limit: LIMIT });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  const reset = () => {
    setQ("");
    setAppliedQ("");
    setCity("");
    setFieldType("");
    setSort("rating");
    setPage(1);
    setDate("");
  };
  const hasFilters = !!(appliedQ || city || fieldType || sort !== "rating" || date);

  const cardWidth = cols === 3 ? "31.8%" : cols === 2 ? "48.5%" : "100%";

  return (
    <PublicPage
      title={t("fields.title", "الملاعب")}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      testID="fields-page"
    >
      <PageWrap>
        <PageHero
          kicker={t("fields.kicker", "دليل الملاعب")}
          title={t("fields.title", "اكتشف ملاعب كرة القدم")}
          subtitle={t("fields.subtitle", "ملاعب موثّقة في جميع محافظات المملكة — قارن الأسعار والتقييمات واحجز مباشرة.")}
        />

        {/* search row */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <MagnifyingGlass size={20} color={colors.muted} />
            <TextInput
              testID="fields-search"
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => {
                setAppliedQ(q);
                setPage(1);
              }}
              placeholder={t("fields.search_ph", "ابحث باسم الملعب أو المنطقة...")}
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              returnKeyType="search"
            />
          </View>
          <Pressable
            testID="fields-search-btn"
            onPress={() => {
              setAppliedQ(q);
              setPage(1);
            }}
            style={s.searchBtn}
          >
            <Text style={s.searchBtnTxt}>{t("common.search", "بحث")}</Text>
          </Pressable>
          <Pressable
            testID="fields-filters-toggle"
            onPress={() => setShowFilters((v) => !v)}
            style={[s.filterToggle, showFilters && { backgroundColor: colors.brandPrimary }]}
            accessibilityRole="button"
          >
            <FunnelSimple size={20} color={showFilters ? colors.onBrandPrimary : colors.onSurfaceSecondary} />
          </Pressable>
        </View>

        {/* active date chip (from landing search — availability is checked per field) */}
        {date ? (
          <View style={s.dateRow}>
            <Chip
              label={`${t("fields.date", "التاريخ")}: ${date}`}
              selected
              onPress={() => setDate("")}
              testID="fields-date-chip"
            />
            <Text style={s.dateHint}>{t("fields.date_hint", "تحقق من الأوقات المتاحة في صفحة كل ملعب")}</Text>
          </View>
        ) : null}

        {/* governorates */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          <Chip label={t("common.all", "الكل")} selected={!city} onPress={() => { setCity(""); setPage(1); }} testID="gov-all" />
          {GOVERNORATES.map((g) => (
            <Chip key={g.id} label={g.ar} selected={city === g.ar} onPress={() => { setCity(city === g.ar ? "" : g.ar); setPage(1); }} testID={`gov-${g.id}`} />
          ))}
        </ScrollView>

        {showFilters ? (
          <View style={s.filters} testID="fields-filters">
            <View style={s.filterGroup}>
              <Text style={s.filterLabel}>{t("fields.type", "نوع الملعب")}</Text>
              <View style={s.chipsRowWrap}>
                {[
                  { k: "", l: t("common.all", "الكل") },
                  { k: "outdoor", l: t("fields.outdoor", "خارجي") },
                  { k: "indoor", l: t("fields.indoor", "داخلي") },
                ].map((o) => (
                  <Chip key={o.k} label={o.l} selected={fieldType === o.k} onPress={() => { setFieldType(o.k); setPage(1); }} />
                ))}
              </View>
            </View>
            <View style={s.filterGroup}>
              <Text style={s.filterLabel}>{t("fields.sort", "ترتيب حسب")}</Text>
              <View style={s.chipsRowWrap}>
                {[
                  { k: "rating", l: t("fields.sort_rating", "الأعلى تقييماً") },
                  { k: "popularity", l: t("fields.sort_popular", "الأكثر شعبية") },
                  { k: "relevance", l: t("fields.sort_relevant", "الأكثر صلة") },
                ].map((o) => (
                  <Chip key={o.k} label={o.l} selected={sort === o.k} onPress={() => { setSort(o.k); setPage(1); }} />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* results */}
        <View style={s.resultsHead}>
          <Text style={s.resultsCount}>
            {query.isLoading
              ? t("common.loading", "جارٍ التحميل...")
              : total > 0
                ? t("fields.count", `${total} ملعب`)
                : ""}
          </Text>
        </View>

        {query.isLoading ? (
          <GridSkeleton count={6} />
        ) : query.isError ? (
          <EmptyState
            testID="fields-error"
            title={t("common.error_title", "تعذّر تحميل الملاعب")}
            subtitle={t("common.error_sub", "تحقق من اتصالك بالإنترنت وحاول مجدداً.")}
            actionLabel={t("common.retry", "إعادة المحاولة")}
            onAction={() => query.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptySearch onReset={hasFilters ? reset : undefined} />
        ) : (
          <>
            <View style={[s.grid, { flexDirection: "row", flexWrap: "wrap" }]}>
              {items.map((f) => (
                <View key={f.id} style={{ width: cardWidth as any, marginBottom: spacing.lg }}>
                  <FieldCard facility={f} testID={`field-card-${f.id}`} />
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
  searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52,
  },
  searchInput: { flex: 1, color: c.onSurface, fontSize: fontSize.lg, height: "100%", textAlign: "right" },
  searchBtn: { backgroundColor: c.brandPrimary, borderRadius: radius.md, paddingHorizontal: spacing.xl, height: 52, alignItems: "center", justifyContent: "center" },
  searchBtnTxt: { color: c.onBrandPrimary, fontWeight: "700", fontSize: fontSize.lg },
  filterToggle: {
    width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
  },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chipsRowWrap: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  filters: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.lg, marginTop: spacing.sm },
  filterGroup: { gap: spacing.sm },
  filterLabel: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  resultsHead: { marginTop: spacing.lg, marginBottom: spacing.md },
  resultsCount: { color: c.muted, fontSize: fontSize.base, fontWeight: "600" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" },
  dateHint: { color: c.muted, fontSize: fontSize.sm },
  grid: { justifyContent: "space-between", gap: 0 },
}));
