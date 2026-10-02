import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { prettyStatus } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Loading } from "@/src/ui";

export default function AuditLogs() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["audit"], queryFn: () => api.get("/admin/audit-logs") });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="audit-back" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>Audit Logs</Text>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data?.items || []}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <View style={s.row} testID={`audit-${item.id}`}>
              <View style={s.dot} />
              <View style={{ flex: 1 }}>
                <Text style={s.action}>{prettyStatus(item.action)}</Text>
                <Text style={s.meta}>{item.resource}{item.resource_id ? ` · ${String(item.resource_id).slice(0, 8)}` : ""}</Text>
                <Text style={s.actor}>{item.actor_email || "system"} · {new Date(item.created_at).toLocaleString()}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No audit records" testID="audit-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  row: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandPrimary, marginTop: 6 },
  action: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  meta: { color: c.onSurfaceSecondary, fontSize: fontSize.base, marginTop: 1 },
  actor: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
}));
