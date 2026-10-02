import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Plus } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Loading, TextField, useToast } from "@/src/ui";

export default function RolesScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: () => api.get("/admin/roles") });
  const perms = useQuery({ queryKey: ["admin-perms"], queryFn: () => api.get("/admin/permissions") });

  const save = useMutation({
    mutationFn: ({ key, permissions }: { key: string; permissions: string[] }) => api.patch(`/admin/roles/${key}`, { permissions }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); setExpanded(null); toast.show("Role updated", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/admin/roles", { name: newName, description: "Custom role", permissions: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); setCreating(false); setNewName(""); toast.show("Role created", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const del = useMutation({
    mutationFn: (key: string) => api.del(`/admin/roles/${key}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); toast.show("Role deleted", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const openRole = (r: any) => {
    setExpanded(r.key === expanded ? null : r.key);
    setDraft(r.permissions.includes("*") ? ["*"] : [...r.permissions]);
  };
  const toggle = (p: string) => setDraft((d) => d.includes(p) ? d.filter((x) => x !== p) : [...d, p]);

  if (roles.isLoading || perms.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  const groups = perms.data?.groups || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="roles-back" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>Roles</Text>
        <Pressable testID="add-role" onPress={() => setCreating((v) => !v)} style={s.addBtn}><Plus size={18} color={colors.onBrandPrimary} weight="bold" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {creating ? (
          <View style={s.card}>
            <TextField label="Role name" value={newName} onChangeText={setNewName} testID="new-role-name" />
            <Button title="Create role" onPress={() => create.mutate()} loading={create.isPending} testID="create-role-btn" style={{ marginTop: spacing.sm }} />
          </View>
        ) : null}

        {(roles.data || []).map((r: any) => {
          const isWild = r.permissions.includes("*");
          return (
            <View key={r.key} style={s.card}>
              <Pressable testID={`role-${r.key}`} onPress={() => openRole(r)} style={s.roleHead}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={s.roleName}>{r.name}</Text>
                    {r.is_system ? <Badge label="System" colorKey="info" /> : null}
                  </View>
                  <Text style={s.roleDesc}>{isWild ? "All permissions" : `${r.permissions.length} permissions`}</Text>
                </View>
                <Text style={s.caret}>{expanded === r.key ? "▲" : "▼"}</Text>
              </Pressable>

              {expanded === r.key ? (
                isWild || r.editable === false ? (
                  <Text style={s.locked}>This role's permissions are fixed and cannot be edited.</Text>
                ) : (
                  <View style={{ marginTop: spacing.md }}>
                    {Object.entries(groups).map(([group, list]: any) => (
                      <View key={group} style={{ marginBottom: spacing.md }}>
                        <Text style={s.groupTitle}>{group}</Text>
                        <View style={s.permGrid}>
                          {list.map((p: string) => {
                            const on = draft.includes(p);
                            return (
                              <Pressable key={p} testID={`perm-${p}`} onPress={() => toggle(p)}
                                style={[s.perm, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                                <Text style={[s.permTxt, on && { color: colors.onBrandPrimary }]}>{p}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", gap: spacing.md }}>
                      <Button title="Save" onPress={() => save.mutate({ key: r.key, permissions: draft })} loading={save.isPending} style={{ flex: 1 }} testID={`save-role-${r.key}`} />
                      {!r.is_system ? <Button title="Delete" variant="danger" onPress={() => del.mutate(r.key)} style={{ flex: 1 }} /> : null}
                    </View>
                  </View>
                )
              ) : null}
            </View>
          );
        })}
        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600", flex: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  roleHead: { flexDirection: "row", alignItems: "center" },
  roleName: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  roleDesc: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
  caret: { color: c.muted, fontSize: 12 },
  locked: { color: c.muted, marginTop: spacing.md, fontStyle: "italic" },
  groupTitle: { color: c.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", marginBottom: spacing.sm },
  permGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  perm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary },
  permTxt: { color: c.onSurfaceTertiary, fontSize: fontSize.sm },
}));
