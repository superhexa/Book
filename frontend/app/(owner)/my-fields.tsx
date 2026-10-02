import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Plus } from "phosphor-react-native";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api";
import { prettyStatus, statusColorKey } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, EmptyState, Loading } from "@/src/ui";

const FALLBACK = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=800&q=80";

export default function MyFields() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["my-facilities"], queryFn: () => api.get("/facilities/mine") });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>My Fields</Text>
        <Pressable testID="add-field" onPress={() => router.push("/field-editor/new")} style={s.addBtn}>
          <Plus size={18} color={colors.onBrandPrimary} weight="bold" />
          <Text style={s.addTxt}>New</Text>
        </Pressable>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => (
            <Pressable testID={`my-field-${item.id}`} onPress={() => router.push(`/field-editor/${item.id}`)} style={s.card}>
              <Image source={{ uri: fileUrl(item.cover_image) || FALLBACK }} style={s.img} contentFit="cover" />
              <View style={s.info}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.meta}>{item.city || "No city"} · {(item.pitches || []).length} pitches</Text>
                <View style={{ marginTop: spacing.xs }}>
                  <Badge label={prettyStatus(item.status)} colorKey={statusColorKey(item.status)} />
                </View>
                {item.status === "REJECTED" && item.rejection_reason ? <Text style={s.reject}>{item.rejection_reason}</Text> : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No fields yet" subtitle="Tap New to create your first facility" testID="fields-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  addTxt: { color: c.onBrandPrimary, fontWeight: "600" },
  card: { flexDirection: "row", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md, borderWidth: 1, borderColor: c.border },
  img: { width: 110, height: 110 },
  info: { flex: 1, padding: spacing.md, justifyContent: "center" },
  name: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  meta: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
  reject: { color: c.error, fontSize: fontSize.sm, marginTop: 4 },
}));
