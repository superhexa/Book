import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  FormSection, FInput, FTextArea, PageHeader, PanelScreen, SectionCard,
  SkeletonList, useConfirm, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, EmptyState, ErrorState, useToast } from "@/src/ui";

type Role = { id?: string; key?: string; name: string; description?: string; permissions: string[]; is_system?: boolean; editable?: boolean };

export default function AdminRoles() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  useRtl();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [err, setErr] = useState<string | undefined>();

  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: () => api.get<Role[]>("/admin/roles") });
  const permDefs = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: () => api.get<{ groups: Record<string, string[]>; all: string[] }>("/admin/permissions"),
  });

  const groups: Record<string, string[]> = permDefs.data?.groups || {};
  const allPerms: string[] = permDefs.data?.all || [];

  const save = useMutation({
    mutationFn: (body: any) => editing
      ? api.patch(`/admin/roles/${editing.key || editing.id}`, body)
      : api.post("/admin/roles", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      setFormOpen(false); setEditing(null); setName(""); setDesc(""); setPerms([]);
      show(t("ar.saved", "تم حفظ الدور"), "success");
    },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ"), "error"),
  });

  const del = useMutation({
    mutationFn: (key: string) => api.del(`/admin/roles/${key}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-roles"] }); show(t("ar.deleted", "تم حذف الدور"), "success"); },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ"), "error"),
  });

  const openEdit = (r: Role) => {
    setEditing(r); setName(r.name); setDesc(r.description || ""); setPerms(r.permissions || []); setFormOpen(true);
  };

  const onSave = () => {
    const e = v.required(name, t("ar.name", "اسم الدور")) || (perms.length === 0 ? t("ar.needPerm", "اختر صلاحية واحدة على الأقل") : undefined);
    setErr(e || undefined);
    if (e) return;
    save.mutate({ name: name.trim(), description: desc.trim(), permissions: perms });
  };

  const togglePerm = (p: string) => setPerms((ps) => ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]);
  const roleKey = (r: Role) => r.key || r.id || r.name;

  return (
    <PanelScreen scroll={false} testID="admin-roles">
      <PageHeader
        title={t("ar.title", "الأدوار والصلاحيات")}
        subtitle={t("ar.sub", "تحكم بصلاحيات كل دور في المنصة")}
        action={<Button title={t("ar.new", "دور جديد")} onPress={() => { setEditing(null); setName(""); setDesc(""); setPerms([]); setFormOpen((o) => !o); }} />}
      />

      {formOpen ? (
        <SectionCard title={editing ? t("ar.edit", "تعديل الدور") : t("ar.newTitle", "دور جديد")}>
          <FormSection title="">
            <FInput label={t("ar.name", "اسم الدور")} value={name} onChangeText={setName} error={err} required editable={!editing?.is_system} />
            <FTextArea label={t("ar.desc", "الوصف")} value={desc} onChangeText={setDesc} />
            <Text style={s.permTitle}>{t("ar.perms", "الصلاحيات")}</Text>
            {Object.keys(groups).length > 0 ? Object.entries(groups).map(([g, ps]) => (
              <View key={g} style={s.group}>
                <Text style={s.groupTitle}>{g}</Text>
                <View style={s.permGrid}>
                  {(ps as string[]).map((p) => {
                    const on = perms.includes(p);
                    return (
                      <Pressable key={p} onPress={() => togglePerm(p)} style={[s.perm, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                        <Text style={[s.permTxt, on && { color: colors.onBrandPrimary }]}>{p}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )) : (
              <View style={s.permGrid}>
                {allPerms.map((p) => {
                  const on = perms.includes(p);
                  return (
                    <Pressable key={p} onPress={() => togglePerm(p)} style={[s.perm, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                      <Text style={[s.permTxt, on && { color: colors.onBrandPrimary }]}>{p}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </FormSection>
          <Button title={t("common.save", "حفظ")} loading={save.isPending} onPress={onSave} />
        </SectionCard>
      ) : null}

      {roles.isLoading ? <SkeletonList rows={4} /> : roles.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => roles.refetch()} />
      ) : (
        <FlatList
          data={roles.data || []}
          keyExtractor={(r, i) => roleKey(r) + i}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={roles.isFetching} onRefresh={() => roles.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item: r }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <View style={s.top}>
                  <Text style={s.name}>{r.name}</Text>
                  {r.is_system ? <Badge label={t("ar.system", "نظام")} colorKey="info" /> : null}
                </View>
                {r.description ? <Text style={s.desc}>{r.description}</Text> : null}
                <Text style={s.permCount}>{t("ar.permCount", "الصلاحيات")}: {r.permissions?.length ?? 0}</Text>
              </View>
              <View style={s.sideBtns}>
                {(!r.is_system || r.editable) ? (
                  <Pressable onPress={() => openEdit(r)} style={s.mini}>
                    <Text style={s.miniTxt}>{t("common.edit", "تعديل")}</Text>
                  </Pressable>
                ) : null}
                {!r.is_system ? (
                  <Pressable onPress={() => ask({ title: t("ar.delTitle", "حذف هذا الدور؟"), danger: true, confirmLabel: t("common.delete", "حذف"), onConfirm: () => del.mutateAsync(roleKey(r)) })} style={s.mini}>
                    <Text style={[s.miniTxt, { color: colors.error }]}>{t("common.delete", "حذف")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState title={t("ar.empty", "لا توجد أدوار")} />}
        />
      )}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  permTitle: { color: c.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: "700" },
  group: { gap: spacing.sm },
  groupTitle: { color: c.muted, fontSize: fontSize.sm, fontWeight: "700" },
  permGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  perm: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  permTxt: { color: c.onSurface, fontSize: fontSize.sm, fontWeight: "600" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  desc: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  permCount: { color: c.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 6, fontWeight: "600" },
  sideBtns: { gap: spacing.sm },
  mini: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  miniTxt: { color: c.brandPrimary, fontSize: fontSize.base, fontWeight: "700" },
}));
