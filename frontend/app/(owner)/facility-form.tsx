import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { api } from "@/src/api";
import {
  FormSection, FInput, FTextArea, FSelect, FSwitch, PageHeader, PanelScreen,
  SkeletonList, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { Button, ErrorState, useToast } from "@/src/ui";

const FIELD_TYPES = [
  { key: "outdoor", label: "خارجي" },
  { key: "indoor", label: "داخلي" },
  { key: "hybrid", label: "مختلط" },
];
const APPROVAL_MODES = [
  { key: "auto", label: "تلقائي", hint: "تُقبل الحجوزات فوراً" },
  { key: "manual", label: "يدوي", hint: "تراجع كل حجز قبل قبوله" },
];

export default function FacilityForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const { t } = useTranslation();
  const { show } = useToast();
  const qc = useQueryClient();
  useRtl();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldType, setFieldType] = useState("outdoor");
  const [approvalMode, setApprovalMode] = useState("auto");
  const [amenities, setAmenities] = useState("");
  const [rules, setRules] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const q = useQuery({
    queryKey: ["facility", id],
    queryFn: () => api.get<any>(`/facilities/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    const f = q.data;
    if (f) {
      setName(f.name || ""); setDescription(f.description || ""); setAddress(f.address || "");
      setCity(f.city || ""); setArea(f.area || ""); setPhone(f.contact_phone || "");
      setFieldType(f.field_type || "outdoor"); setApprovalMode(f.approval_mode || "auto");
      setAmenities((f.amenities || []).join("، ")); setRules((f.rules || []).join("\n"));
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (body: any) => isEdit ? api.patch(`/facilities/${id}`, body) : api.post("/facilities", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-facilities"] });
      show(t("ff.saved", "تم حفظ المنشأة بنجاح"), "success");
      router.back();
    },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ، حاول مجدداً"), "error"),
  });

  const onSave = () => {
    const e: Record<string, string | undefined> = {
      name: v.required(name, t("ff.name", "اسم المنشأة")) || v.minLen(name, 2, t("ff.name", "اسم المنشأة")),
      city: v.required(city, t("ff.city", "المدينة")),
      phone: v.required(phone, t("ff.phone", "الهاتف")),
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    save.mutate({
      name: name.trim(), description: description.trim(), address: address.trim(),
      city: city.trim(), area: area.trim(), contact_phone: phone.trim(),
      field_type: fieldType, approval_mode: approvalMode, currency: "JOD",
      amenities: amenities.split("،").map((x) => x.trim()).filter(Boolean),
      rules: rules.split("\n").map((x) => x.trim()).filter(Boolean),
    });
  };

  return (
    <PanelScreen testID="facility-form">
      <PageHeader
        title={isEdit ? t("ff.edit", "تعديل المنشأة") : t("ff.new", "منشأة جديدة")}
        subtitle={t("ff.sub", "املأ بيانات منشأتك الرياضية")}
      />
      {q.isLoading ? <SkeletonList rows={5} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : (
        <>
          <FormSection title={t("ff.basic", "البيانات الأساسية")}>
            <FInput label={t("ff.name", "اسم المنشأة")} value={name} onChangeText={setName} error={errors.name} required placeholder="مثال: ملاعب النخبة" />
            <FTextArea label={t("ff.desc", "الوصف")} value={description} onChangeText={setDescription} placeholder="صف منشأتك ومرافقها..." />
            <FInput label={t("ff.address", "العنوان")} value={address} onChangeText={setAddress} placeholder="الشارع، المنطقة" />
          </FormSection>
          <FormSection title={t("ff.location", "الموقع")}>
            <FInput label={t("ff.city", "المدينة")} value={city} onChangeText={setCity} error={errors.city} required placeholder="عمّان" />
            <FInput label={t("ff.area", "المنطقة")} value={area} onChangeText={setArea} placeholder="الجبيهة" />
            <FInput label={t("ff.phone", "هاتف التواصل")} value={phone} onChangeText={setPhone} error={errors.phone} required keyboardType="phone-pad" placeholder="07xxxxxxxx" />
          </FormSection>
          <FormSection title={t("ff.settings", "إعدادات المنشأة")}>
            <FSelect label={t("ff.type", "نوع المنشأة")} options={FIELD_TYPES} value={fieldType} onChange={setFieldType} />
            <FSelect label={t("ff.approval", "وضع قبول الحجوزات")} options={APPROVAL_MODES} value={approvalMode} onChange={setApprovalMode} />
            <FInput label={t("ff.amenities", "المرافق")} value={amenities} onChangeText={setAmenities} hint={t("ff.amenitiesHint", "افصل بين المرافق بفاصلة: مواقف، كافتيريا، غرف تبديل")} />
            <FTextArea label={t("ff.rules", "القوانين")} value={rules} onChangeText={setRules} hint={t("ff.rulesHint", "اكتب كل قانون في سطر")} />
          </FormSection>
          <Button title={t("common.save", "حفظ")} loading={save.isPending} onPress={onSave} />
          <Button title={t("common.cancel", "إلغاء")} variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </PanelScreen>
  );
}
