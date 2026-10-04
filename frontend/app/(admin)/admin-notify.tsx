// Admin — Broadcast notifications (real API + history).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import {
  arDateTime,
  CardGrid,
  FormSection,
  FInput,
  FSelect,
  FTextArea,
  PageHeader,
  PanelScreen,
  SectionCard,
  StatCard,
  StatGrid,
  useRtl,
  v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, useToast } from "@/src/ui";

type Broadcast = {
  id: string;
  audience: string;
  title: string;
  body: string;
  recipients: number;
  push_sent: number;
  created_at: string;
};

const AUDIENCES = [
  { key: "all", label: "جميع المستخدمين" },
  { key: "customers", label: "اللاعبون" },
  { key: "owners", label: "ملاك المنشآت" },
];
const AUDIENCE_AR: Record<string, string> = { all: "الجميع", customers: "اللاعبون", owners: "الملاك" };

export default function AdminNotify() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const { show } = useToast();
  const qc = useQueryClient();
  useRtl();

  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const history = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: () => api.get<Broadcast[]>("/admin/notifications/broadcasts"),
  });

  const send = useMutation({
    mutationFn: (payload: any) => api.post("/admin/notifications/broadcast", payload),
    onSuccess: (r: any) => {
      setTitle(""); setBody(""); setErr(undefined);
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
      show(`تم الإرسال إلى ${r.recipients} مستخدم`, "success");
    },
    onError: (e: any) => show(e?.message || "تعذر الإرسال", "error"),
  });

  const onSend = () => {
    const e = v.required(title, t("an.title", "العنوان")) || v.minLen(title, 3, t("an.title", "العنوان"))
      || v.required(body, t("an.body", "النص")) || v.minLen(body, 3, t("an.body", "النص"));
    setErr(e || undefined);
    if (e) return;
    send.mutate({ audience, title: title.trim(), body: body.trim() });
  };

  const preview = body.length > 0 || title.length > 0;
  const items = history.data || [];
  const totalRecipients = items.reduce((n, b) => n + (b.recipients || 0), 0);

  return (
    <PanelScreen testID="admin-notify">
      <PageHeader
        title={t("an.title", "إرسال الإشعارات")}
        subtitle={t("an.sub", "أرسل تنبيهات جماعية للمستخدمين")}
      />

      <StatGrid>
        <StatCard label="إشعارات مرسلة" value={items.length} accent />
        <StatCard label="إجمالي المستلمين" value={totalRecipients} />
      </StatGrid>

      <CardGrid>
        <SectionCard title={t("an.compose", "إنشاء إشعار")}>
          <FormSection title="">
            <FSelect
              label={t("an.audience", "الجمهور المستهدف")}
              value={audience} onChange={setAudience}
              options={AUDIENCES}
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
        </SectionCard>
      </CardGrid>

      <SectionCard title="سجل الإشعارات المرسلة">
        {history.isLoading ? (
          <Text style={s.hint}>جاري التحميل...</Text>
        ) : items.length === 0 ? (
          <EmptyState title="لا توجد إشعارات مرسلة بعد" subtitle="أرسل أول إشعار جماعي من الأعلى" />
        ) : (
          items.map((b) => (
            <View key={b.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{b.title}</Text>
                <Text style={s.rowMeta} numberOfLines={2}>{b.body}</Text>
                <Text style={s.rowMeta}>{AUDIENCE_AR[b.audience] || b.audience} · {b.recipients} مستلم · {arDateTime(b.created_at)}</Text>
              </View>
            </View>
          ))
        )}
      </SectionCard>
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  phone: { backgroundColor: c.surfaceInverse, borderRadius: radius.lg, padding: spacing.lg },
  notif: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  nTitle: { fontSize: fontSize.base, fontWeight: "800", color: c.onSurface },
  nBody: { fontSize: fontSize.sm, color: c.onSurfaceSecondary, marginTop: 2 },
  hint: { fontSize: fontSize.sm, color: c.muted },
  row: { backgroundColor: c.surfaceSecondary, borderRadius: 10, padding: spacing.md },
  rowTitle: { fontSize: fontSize.base, fontWeight: "700", color: c.onSurface },
  rowMeta: { fontSize: fontSize.sm, color: c.muted, marginTop: 2 },
}));
