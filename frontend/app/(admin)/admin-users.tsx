import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CaretRight } from "phosphor-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Chip, EmptyState, Loading } from "@/src/ui";

const ROLE_FILTERS = [
  { key: "", label: "All" },
  { key: "customer", label: "Players" },
  { key: "owner", label: "Owners" },
  { key: "admin", label: "Admins" },
];

export default function AdminUsers() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  const users = useQuery({
    queryKey: ["admin-users", q, role],
    queryFn: () => api.get(`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}) })}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>Users</Text>
        <View style={s.searchBar}>
          <TextInput testID="user-search" placeholder="Search name or email" placeholderTextColor={colors.muted} value={search}
            onChangeText={setSearch} onSubmitEditing={() => setQ(search)} returnKeyType="search" style={s.searchInput} />
        </View>
        <FlatList horizontal data={ROLE_FILTERS} keyExtractor={(i) => i.key} showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips} style={{ height: 56 }}
          renderItem={({ item }) => <Chip label={item.label} selected={role === item.key} onPress={() => setRole(item.key)} testID={`role-filter-${item.key || "all"}`} />} />
      </View>
      {users.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={users.data?.items || []}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <Pressable testID={`user-${item.id}`} onPress={() => router.push(`/admin/user/${item.id}`)} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.email}>{item.email}</Text>
                <View style={s.badgeRow}>
                  {item.roles.map((r: string) => <Badge key={r} label={r.replace("_", " ")} colorKey="brandPrimary" />)}
                  {!item.is_active ? <Badge label="Suspended" colorKey="error" /> : null}
                </View>
              </View>
              <CaretRight size={18} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No users found" testID="users-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  searchBar: { marginTop: spacing.md, backgroundColor: c.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  searchInput: { height: 44, color: c.onSurface, fontSize: fontSize.lg },
  chips: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
  name: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  email: { color: c.muted, fontSize: fontSize.base, marginTop: 1 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
}));
