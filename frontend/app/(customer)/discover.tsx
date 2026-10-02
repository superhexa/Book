import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bell } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { FacilityLite, FieldCard } from "@/src/components/field-card";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Chip, EmptyState, ErrorState, Loading } from "@/src/ui";

export default function DiscoverScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [sort, setSort] = useState("relevance");

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => api.get("/catalog", false) });
  const notifs = useQuery({ queryKey: ["notif-count"], queryFn: () => api.get("/notifications") });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (city) p.set("city", city);
    p.set("sort", sort);
    return p.toString();
  }, [query, city, sort]);

  const facilities = useQuery({
    queryKey: ["facilities", params],
    queryFn: () => api.get<{ items: FacilityLite[] }>(`/facilities?${params}`, false),
  });

  const cities: { id: string; name: string }[] = catalog.data?.cities || [];
  const sorts = [
    { key: "relevance", label: "Top rated" },
    { key: "popularity", label: "Popular" },
  ];

  const header = (
    <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.titleRow}>
        <View>
          <Text style={s.hello}>Hi, {user?.name?.split(" ")[0] || "there"} 👋</Text>
          <Text style={s.sub}>Find your next pitch</Text>
        </View>
        <Pressable testID="notif-bell" onPress={() => router.push("/notifications")} style={s.bell}>
          <Bell size={22} color={colors.onSurface} />
          {notifs.data?.unread ? <View style={s.dot}><Text style={s.dotTxt}>{notifs.data.unread}</Text></View> : null}
        </Pressable>
      </View>
      <View style={s.searchBar}>
        <TextInput
          testID="search-input"
          placeholder={t("searchPlaceholder")}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setQuery(search)}
          returnKeyType="search"
          style={s.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} style={s.chipsScroll}>
        <Chip label="All cities" selected={!city} onPress={() => setCity(null)} testID="chip-all" />
        {cities.map((cc) => (
          <Chip key={cc.id} label={cc.name} selected={city === cc.name} onPress={() => setCity(cc.name)} testID={`chip-${cc.name}`} />
        ))}
        {sorts.map((so) => (
          <Chip key={so.key} label={so.label} selected={sort === so.key} onPress={() => setSort(so.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={s.container}>
      {header}
      {facilities.isLoading ? (
        <Loading label="Loading fields..." />
      ) : facilities.isError ? (
        <ErrorState onRetry={() => facilities.refetch()} />
      ) : (
        <FlatList
          data={facilities.data?.items || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={facilities.isFetching} onRefresh={() => facilities.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => <FieldCard facility={item} testID={`field-${item.id}`} />}
          ListEmptyComponent={
            <EmptyState title="No fields found" subtitle="Try clearing filters or searching a different city" testID="discover-empty" />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  sub: { color: c.muted, fontSize: fontSize.base },
  bell: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary },
  dot: { position: "absolute", top: 6, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.error, alignItems: "center", justifyContent: "center" },
  dotTxt: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  searchBar: { marginTop: spacing.md, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  searchInput: { height: 46, color: c.onSurface, fontSize: fontSize.lg },
  chipsScroll: { marginTop: spacing.md, height: 56 },
  chipsRow: { gap: spacing.sm, paddingVertical: spacing.sm, alignItems: "center" },
  list: { padding: spacing.lg, paddingTop: spacing.lg },
}));
