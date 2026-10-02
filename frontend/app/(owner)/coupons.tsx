import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  arDateShort, FormSection, FInput, FNumber, FSelect, PageHeader, PanelScreen,
  SectionCard, SkeletonList, useConfirm, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, EmptyState, ErrorState, useToast } from "@/src/ui";

type Coupon = {
  id: string; code: string;
  discount_type?: string; discount_value?: number;
  usage_limit?: number; used_count?: number;
  is_active?: boolean; active?: boolean; expires_at?: string;
};

const isActive = (c: Coupon) => c.is_active ?? c.active ?? true;
const cKind = (c: Coupon) => c.discount_type ?? (c as any).kind ?? "percentage";
const cValue = (c: Coupon) => c.discount_value ?? (c as any).value ?? 0;
const cLimit = (c: Coupon) => c.usage_limit ?? (c as any).max_uses;

export default function CouponsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  useRtl();

  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const q = useQuery({ queryKey: ["coupons"], queryFn: () => api.get<Coupon[]>("/coupons") });

  const create = useMutation({
    mutationFn: (body: any) => api.post("/coupons", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      setFormOpen(false); setCode(""); setValue(""); setMaxUses("");
      show(t("coupons.created", "تم إنشاء الكوبون"), "success");
    },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ"), "error"),
  });

  const toggle = useMutation({
    mutationFn: (c: Coupon) => api.patch(`/coupons/${c.id}`, { is_active: !(c.is_active ?? c.active) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/coupons/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons"] }); show(t("coupons.deleted", "تم حذف الكوبون"), "success"); },
  });

  const onCreate = () => {
    const e = v.required(code, t("coupons.code", "رمز الكوبون"))
      || v.required(value, t("coupons.value", "القيمة"))
      || v.positive(value, t("coupons.value", "القيمة"));
    setErr(e || undefined);
    if (e) return;
    create.mutate({
      code: code.trim().toUpperCase(),
      discount_type: kind === "percent" ? "percentage" : "fixed",
      discount_value: Number(value),
      usage_limit: maxUses ? Number(maxUses) : null,
      is_active: true,
    });
  };

  return (
    <PanelScreen scroll={false} testID="coupons">
      <PageHeader
        title={t("coupons.title", "الكوبونات والخصومات")}
        subtitle={t("coupons.sub", "أنشئ رموز خصم للاعبيك")}
        action={<Button title={t("coupons.new", "كوبون جديد")} onPress={() => setFormOpen((o) => !o)} />}
      />
      {formOpen ? (
        <SectionCard title={t("coupons.newTitle", "كوبون جديد")}>
          <FormSection title="">
            <FInput label={t("coupons.code", "رمز الكوبون")} value={code} onChangeText={(x) => setCode(x.toUpperCase())} error={err} required placeholder="WELCOME20" autoCapitalize="characters" />
            <FSelect label={t("coupons.kind", "نوع الخصم")} value={kind} onChange={setKind} options={[
              { key: "percent", label: t("coupons.percent", "نسبة مئوية ٪") },
              { key: "fixed", label: t("coupons.fixed", "مبلغ ثابت (د.أ)") },
            ]} />
            <FNumber label={kind === "percent" ? t("coupons.valueP", "النسبة ٪") : t("coupons.valueF", "المبلغ (د.أ)")} value={value} onChangeNumber={setValue} required placeholder="20" />
            <FNumber label={t("coupons.maxUses", "أقصى عدد استخدامات (اختياري)")} value={maxUses} onChangeNumber={setMaxUses} placeholder="100" />
          </FormSection>
          <Button title={t("common.create", "إنشاء")} loading={create.isPending} onPress={onCreate} />
        </SectionCard>
      ) : null}

      {q.isLoading ? <SkeletonList rows={4} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item: c }) => {
            const active = isActive(c);
            return (
            <View style={[s.card, !active && { opacity: 0.6 }]}>
              <View style={s.codeBox}>
                <Text style={s.code}>{c.code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.val}>{cKind(c) === "percentage" ? `${cValue(c)}٪` : `${cValue(c)} د.أ`} {t("coupons.off", "خصم")}</Text>
                <Text style={s.meta}>{t("coupons.used", "استُخدم")}: {c.used_count || 0}{cLimit(c) ? ` / ${cLimit(c)}` : ""}{c.expires_at ? ` · ${t("coupons.until", "حتى")} ${arDateShort(c.expires_at)}` : ""}</Text>
              </View>
              <View style={s.side}>
                <Badge label={active ? t("coupons.active", "نشط") : t("coupons.paused", "موقوف")} colorKey={active ? "success" : "muted"} />
                <View style={s.rowBtns}>
                  <Pressable onPress={() => toggle.mutate(c)} style={s.mini}>
                    <Text style={s.miniTxt}>{active ? t("coupons.pause", "إيقاف") : t("coupons.resume", "تفعيل")}</Text>
                  </Pressable>
                  <Pressable onPress={() => ask({ title: t("coupons.delTitle", "حذف الكوبون؟"), danger: true, confirmLabel: t("common.delete", "حذف"), onConfirm: () => del.mutateAsync(c.id) })} style={s.mini}>
                    <Text style={[s.miniTxt, { color: colors.error }]}>{t("common.delete", "حذف")}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState title={t("coupons.empty", "لا توجد كوبونات")} subtitle={t("coupons.emptySub", "أنشئ كوبون خصم لجذب المزيد من اللاعبين")} />
          }
        />
      )}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  codeBox: { backgroundColor: c.brandTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: c.brandPrimary, borderStyle: "dashed" },
  code: { color: c.onBrandTertiary, fontSize: fontSize.lg, fontWeight: "800", letterSpacing: 1 },
  val: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  meta: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  side: { alignItems: "flex-end", gap: spacing.sm },
  rowBtns: { flexDirection: "row", gap: spacing.sm },
  mini: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  miniTxt: { color: c.brandPrimary, fontSize: fontSize.sm, fontWeight: "700" },
}));
