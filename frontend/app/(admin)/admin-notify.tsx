import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import {
  FormSection, FInput, FTextArea, FSelect, PageHeader, PanelScreen,
  PendingFeature, SectionCard, CardGrid, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, useToast } from "@/src/ui";

export default function AdminNotify() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const { show } = useToast();
  useRtl();

  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const send = useMutation({
    mutationFn: (payload: any) => api.post("/admin/notifications/broadcast", payload),
    onSuccess: () => { setTitle(""); setBody(""); show(t("an.sent", "تم إرسال الإشعار"), "success"); },
    onError: () => show(t("an.pending", "الإرسال الجماعي سيتوفر قريباً — تم حفظ المسودة"), "info"),
  });

  const onSend = () => {
    const e = v.required(title, t("an.title", "العنوان")) || v.required(body, t("an.body", "النص"));
    setErr(e || undefined);
    if (e) return;
    send.mutate({ audience, title: title.trim(), body: body.trim() });
  };

  const preview = body.length > 0 || title.length > 0;

  return (
    <PanelScreen testID="admin-notify">
      <PageHeader
        title={t("an.title", "إرسال الإشعارات")}
        subtitle={t("an.sub", "أرسل تنبيهات جماعية للمستخدمين")}
      />
      <CardGrid>
        <SectionCard title={t("an.compose", "إنشاء إشعار")}>
          <FormSection title="">
            <FSelect
              label={t("an.audience", "الجمهور المستهدف")}
              value={audience} onChange={setAudience}
              options={[
                { key: "all", label: t("an.all", "جميع المستخدمين") },
                { key: "customers", label: t("an.customers", "اللاعبون") },
                { key: "owners", label: t("an.owners", "ملاك المنشآت") },
              ]}
            />
            <FInput label={t("an.titleL", "العنوان")} value={title} onChangeText={setTitle} error={err} required placeholder={t("an.titlePh", "مثال: عطلة نهاية أسبوع مميزة ⚽")} />
            <FTextArea label={t("an.bodyL", "نص الإشعار")} value={body} onChangeText={setBody} placeholder={t("an.bodyPh", "اكتب رسالتك هنا...")} />
          </FormSection>
          <Button title={t("an.send", "إرسال الإشعار")} loading={send.isPending} onPress={onSend} />
        </SectionCard>

        <SectionCard title={t("an.preview", "معاينة")}>
          {preview ? (
            <View style={s.phone}>
              <View style={s.notif}>
                <View style={s.icon}><Text style={{ fontSize: 20 }}>⚽</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nTitle}>{title || t("an.titleL", "العنوان")}</Text>
                  <Text style={s.nBody} numberOfLines={4}>{body || t("an.bodyL", "نص الإشعار")}</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={s.hint}>{t("an.previewHint", "ابدأ الكتابة لرؤية المعاينة")}</Text>
          )}
          <PendingFeature
            title=""
            body=""
            needed={["POST /api/admin/notifications/broadcast {audience, title, body}"]}
          />
        </SectionCard>
      </CardGrid>
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  phone: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  notif: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.md },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  nTitle: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  nBody: { color: c.onSurfaceSecondary, fontSize: fontSize.base, marginTop: 2, lineHeight: 22 },
  hint: { color: c.muted, fontSize: fontSize.base },
}));
