import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  FormSection, FInput, FNumber, FSelect, FSwitch, jod, PageHeader, PanelScreen,
  SectionCard, SkeletonList, useConfirm, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, ErrorState, useToast } from "@/src/ui";

type Pitch = {
  id: string; name: string; field_size?: string; grass_type?: string; indoor?: boolean;
  slot_duration?: number; pricing?: { base_hourly?: number }; facility_id?: string;
};

const SIZES = ["5-a-side", "6-a-side", "7-a-side", "8-a-side", "11-a-side"].map((k) => ({ key: k, label: k }));
const GRASS = [
  { key: "Artificial Turf", label: "عشب صناعي" },
  { key: "Natural Grass", label: "عشب طبيعي" },
  { key: "Hybrid", label: "هجين" },
];

export default function PitchesScreen() {
  const { facilityId } = useLocalSearchParams<{ facilityId?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  useRtl();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pitch | null>(null);
  const [name, setName] = useState("");
  const [size, setSize] = useState("5-a-side");
  const [grass, setGrass] = useState("Artificial Turf");
  const [indoor, setIndoor] = useState(false);
  const [slot, setSlot] = useState("60");
  const [price, setPrice] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const fac = useQuery({ queryKey: ["facility", facilityId], queryFn: () => api.get<any>(`/facilities/${facilityId}`), enabled: !!facilityId });
  const facilities = useQuery({ queryKey: ["my-facilities"], queryFn: () => api.get<any[]>("/facilities/mine") });
  const facList = facilities.data || [];
  const effFacilityId = facilityId || facList[0]?.id;
  const effFac = facList.find((f: any) => f.id === effFacilityId);
  const q = useQuery({
    queryKey: ["pitches", effFacilityId],
    queryFn: async () => {
      const f = effFac || (await api.get<any>(`/facilities/${effFacilityId}`));
      return (f.pitches || []) as Pitch[];
    },
    enabled: !!effFacilityId,
  });

  useEffect(() => {
    if (editing) {
      setName(editing.name); setSize(editing.field_size || "5-a-side");
      setGrass(editing.grass_type || "Artificial Turf"); setIndoor(!!editing.indoor);
      setSlot(String(editing.slot_duration || 60)); setPrice(String(editing.pricing?.base_hourly ?? ""));
    } else { setName(""); setPrice(""); setErr(undefined); }
  }, [editing, formOpen]);

  const save = useMutation({
    mutationFn: (body: any) => editing ? api.patch(`/pitches/${editing.id}`, body) : api.post(`/facilities/${effFacilityId}/pitches`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pitches", effFacilityId] });
      qc.invalidateQueries({ queryKey: ["facility", effFacilityId] });
      qc.invalidateQueries({ queryKey: ["my-facilities"] });
      setFormOpen(false); setEditing(null);
      show(t("pitches.saved", "تم حفظ الملعب"), "success");
    },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ"), "error"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/pitches/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pitches", effFacilityId] }); show(t("pitches.deleted", "تم حذف الملعب"), "success"); },
  });

  const onSave = () => {
    const e = v.required(name, t("pitches.name", "اسم الملعب")) || v.number(price, t("pitches.price", "السعر"));
    setErr(e || undefined);
    if (e) return;
    save.mutate({
      name: name.trim(), field_size: size, grass_type: grass, indoor,
      slot_duration: Number(slot) || 60,
      pricing: { base_hourly: Number(price) || 0, weekend_multiplier: 1, peak_hours: [], special_dates: {} },
    });
  };

  return (
    <PanelScreen scroll={false} testID="pitches">
      <PageHeader
        title={t("pitches.title", "ملاعب المنشأة")}
        subtitle={effFac?.name || fac.data?.name}
        action={<Button title={t("pitches.add", "أضف ملعب")} onPress={() => { setEditing(null); setFormOpen(true); }} />}
      />
      {facList.length > 1 && !facilityId ? (
        <View style={s.facRow}>
          {facList.map((f: any) => {
            const active = f.id === effFacilityId;
            return (
              <Pressable key={f.id} onPress={() => router.setParams({ facilityId: f.id })} style={[s.chip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                <Text style={[s.chipTxt, active && { color: colors.onBrandPrimary }]} numberOfLines={1}>{f.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {formOpen ? (
        <SectionCard title={editing ? t("pitches.edit", "تعديل الملعب") : t("pitches.new", "ملعب جديد")}>
          <FormSection title="">
            <FInput label={t("pitches.name", "اسم الملعب")} value={name} onChangeText={setName} error={err} required placeholder="ملعب 1" />
            <FSelect label={t("pitches.size", "حجم الملعب")} options={SIZES} value={size} onChange={setSize} />
            <FSelect label={t("pitches.grass", "نوع العشب")} options={GRASS} value={grass} onChange={setGrass} />
            <FSwitch label={t("pitches.indoor", "ملعب مغلق")} value={indoor} onChange={setIndoor} />
            <FNumber label={t("pitches.slot", "مدة الحجز (دقيقة)")} value={slot} onChangeNumber={setSlot} />
            <FNumber label={t("pitches.price", "السعر / ساعة (د.أ)")} value={price} onChangeNumber={setPrice} />
          </FormSection>
          <View style={s.formActions}>
            <Button title={t("common.save", "حفظ")} loading={save.isPending} onPress={onSave} style={{ flex: 1 }} />
            <Button title={t("common.cancel", "إلغاء")} variant="ghost" onPress={() => { setFormOpen(false); setEditing(null); }} style={{ flex: 1 }} />
          </View>
        </SectionCard>
      ) : q.isLoading ? <SkeletonList rows={3} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item: p }) => (
            <View style={s.card}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.meta}>{p.field_size} · {p.grass_type} {p.indoor ? `· ${t("pitches.indoor", "مغلق")}` : ""}</Text>
                <Text style={s.price}>{jod(p.pricing?.base_hourly)} / {t("pitches.hour", "ساعة")}</Text>
              </View>
              <View style={s.rowActions}>
                <Pressable onPress={() => router.push(`/pricing?pitchId=${p.id}&facilityId=${effFacilityId}`)} style={s.chip}>
                  <Text style={s.chipTxt}>{t("pitches.pricing", "التسعير")}</Text>
                </Pressable>
                <Pressable onPress={() => { setEditing(p); setFormOpen(true); }} style={s.chip}>
                  <Text style={s.chipTxt}>{t("common.edit", "تعديل")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => ask({ title: t("pitches.delTitle", "حذف الملعب؟"), danger: true, confirmLabel: t("common.delete", "حذف"), onConfirm: () => del.mutateAsync(p.id) })}
                  style={[s.chip, { backgroundColor: colors.error + "1A" }]}
                >
                  <Text style={[s.chipTxt, { color: colors.error }]}>{t("common.delete", "حذف")}</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState title={t("pitches.empty", "لا توجد ملاعب")} subtitle={t("pitches.emptySub", "أضف أول ملعب لهذه المنشأة")} />
          }
        />
      )}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  facRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.md },
  name: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  meta: { color: c.muted, fontSize: fontSize.base },
  price: { color: c.brandPrimary, fontSize: fontSize.base, fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  chipTxt: { color: c.brandPrimary, fontSize: fontSize.base, fontWeight: "700" },
  formActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
}));
