import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Loading, useToast } from "@/src/ui";

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const user = useQuery({ queryKey: ["admin-user", id], queryFn: () => api.get(`/admin/users/${id}`) });
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: () => api.get("/admin/roles") });

  const invalidate = () => { user.refetch(); qc.invalidateQueries({ queryKey: ["admin-users"] }); };

  const setStatus = useMutation({
    mutationFn: (is_active: boolean) => api.patch(`/admin/users/${id}/status`, { is_active }),
    onSuccess: () => { invalidate(); toast.show("Updated", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const setRoles = useMutation({
    mutationFn: (newRoles: string[]) => api.put(`/admin/users/${id}/roles`, { roles: newRoles }),
    onSuccess: () => { invalidate(); toast.show("Roles updated", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  if (user.isLoading || !user.data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  const u = user.data;
  const toggleRole = (key: string) => {
    const has = u.roles.includes(key);
    setRoles.mutate(has ? u.roles.filter((r: string) => r !== key) : [...u.roles, key]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="u-back" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>User</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.name}>{u.name}</Text>
          <Text style={s.email}>{u.email}</Text>
          {u.phone ? <Text style={s.email}>{u.phone}</Text> : null}
          <View style={{ marginTop: spacing.sm }}>
            <Badge label={u.is_active ? "Active" : "Suspended"} colorKey={u.is_active ? "success" : "error"} />
          </View>
          <View style={s.statRow}>
            <Text style={s.stat}>{u.bookings_count} bookings</Text>
            <Text style={s.stat}>{u.facilities_count} facilities</Text>
          </View>
        </View>

        <Text style={s.section}>Roles</Text>
        <View style={s.card}>
          {(roles.data || []).map((r: any) => {
            const has = u.roles.includes(r.key);
            return (
              <Pressable key={r.key} testID={`role-toggle-${r.key}`} onPress={() => toggleRole(r.key)} style={s.roleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.roleName}>{r.name}</Text>
                  <Text style={s.roleDesc}>{r.description}</Text>
                </View>
                <View style={[s.check, has && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                  {has ? <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.section}>Actions</Text>
        {u.is_active ? (
          <Button title="Suspend account" variant="danger" testID="suspend-user" onPress={() => setStatus.mutate(false)} loading={setStatus.isPending} />
        ) : (
          <Button title="Activate account" testID="activate-user" onPress={() => setStatus.mutate(true)} loading={setStatus.isPending} />
        )}

        {u.recent_activity?.length ? (
          <>
            <Text style={s.section}>Recent activity</Text>
            <View style={s.card}>
              {u.recent_activity.slice(0, 10).map((a: any) => (
                <Text key={a.id} style={s.activity}>{a.action} · {a.resource}</Text>
              ))}
            </View>
          </>
        ) : null}
        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  name: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  email: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
  statRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  stat: { color: c.onSurfaceSecondary, fontWeight: "500" },
  section: { color: c.muted, fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  roleRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  roleName: { color: c.onSurface, fontWeight: "600", fontSize: fontSize.lg },
  roleDesc: { color: c.muted, fontSize: fontSize.sm },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  activity: { color: c.onSurfaceSecondary, paddingVertical: 4, fontSize: fontSize.base },
}));
