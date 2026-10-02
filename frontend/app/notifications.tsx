import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Loading } from "@/src/ui";

export default function NotificationsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api.get("/notifications") });

  const readOne = useMutation({
    mutationFn: (nid: string) => api.post(`/notifications/${nid}/read`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notif-count"] }); },
  });
  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["notif-count"] }); },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="notif-back" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>Notifications</Text>
        <Pressable testID="read-all" onPress={() => readAll.mutate()}><Text style={s.readAll}>Mark all</Text></Pressable>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data?.items || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <Pressable testID={`notif-${item.id}`} onPress={() => {
              readOne.mutate(item.id);
              if (item.data?.booking_id) router.push(`/booking/${item.data.booking_id}`);
              else if (item.data?.facility_id) router.push(`/facility/${item.data.facility_id}`);
            }} style={[s.item, !item.read && { backgroundColor: colors.brandTertiary }]}>
              <View style={[s.dot, { backgroundColor: item.read ? colors.border : colors.brandPrimary }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{item.title}</Text>
                <Text style={s.itemBody}>{item.body}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No notifications" subtitle="You're all caught up" testID="notif-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600", flex: 1 },
  readAll: { color: c.brandPrimary, fontWeight: "600" },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  itemBody: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
}));
