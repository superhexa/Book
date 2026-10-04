import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/src/api";
import {
  FormSection, FInput, FNumber, PageHeader, PanelScreen,
  SectionCard, SkeletonList, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { Button, ErrorState, useToast } from "@/src/ui";

export default function AdminSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { show } = useToast();
  useRtl();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("JOD");
  const [maxDays, setMaxDays] = useState("30");
  const [minHours, setMinHours] = useState("1");

  const q = useQuery({ queryKey: ["platform-settings"], queryFn: () => api.get<any>("/catalog/settings") });

  useEffect(() => {
    const s = q.data;
    if (s) {
      setName(s.platform_name || ""); setCurrency(s.default_currency || "JOD");
      setMaxDays(String(s.max_booking_days_ahead ?? 30)); setMinHours(String(s.min_booking_hours_ahead ?? 1));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: any) => api.put("/catalog/settings", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-settings"] }); show(t("as.saved", "تم حفظ الإعدادات"), "success"); },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ"), "error"),
  });

  return (
    <PanelScreen testID="admin-settings">
      <PageHeader title={t("as.title", "إعدادات المنصة")} subtitle={t("as.sub", "الإعدادات العامة لمنصة Book")} />
      {q.isLoading ? <SkeletonList rows={4} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : (
        <>
          <SectionCard title={t("as.general", "عام")}>
            <FormSection title="">
              <FInput label={t("as.platformName", "اسم المنصة")} value={name} onChangeText={setName} />
              <FInput label={t("as.currency", "العملة الافتراضية")} value={currency} onChangeText={(x) => setCurrency(x.toUpperCase())} autoCapitalize="characters" hint="JOD" />
            </FormSection>
          </SectionCard>
          <SectionCard title={t("as.booking", "سياسة الحجوزات")}>
            <FormSection title="">
              <FNumber label={t("as.maxDays", "أقصى مدة حجز مسبق (يوم)")} value={maxDays} onChangeNumber={setMaxDays} />
              <FNumber label={t("as.minHours", "أقل مدة قبل الحجز (ساعة)")} value={minHours} onChangeNumber={setMinHours} />
            </FormSection>
          </SectionCard>
          <Button
            title={t("common.save", "حفظ")}
            loading={save.isPending}
            onPress={() => save.mutate({
              platform_name: name.trim() || undefined,
              default_currency: currency.trim() || "JOD",
              max_booking_days_ahead: Number(maxDays) || 30,
              min_booking_hours_ahead: Number(minHours) || 1,
            })}
          />
        </>
      )}
    </PanelScreen>
  );
}
