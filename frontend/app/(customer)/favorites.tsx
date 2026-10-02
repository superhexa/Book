import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { FacilityLite, FieldCard } from "@/src/components/field-card";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import { EmptyState, Loading } from "@/src/ui";

export default function FavoritesScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => api.get<FacilityLite[]>("/favorites") });

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>{t("favorites")}</Text>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => <FieldCard facility={item} testID={`fav-${item.id}`} />}
          ListEmptyComponent={<EmptyState title="No favorites yet" subtitle="Tap the heart on a field to save it here" testID="favorites-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  list: { padding: spacing.lg },
}));
