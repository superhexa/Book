import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import {
  arDateShort, FormSection, FInput, FTextArea, PageHeader, PanelScreen,
  PendingFeature, SectionCard, useConfirm, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, EmptyState, useToast } from "@/src/ui";

type Article = { id: string; title: string; status: "draft" | "published"; created_at: string };

export default function AdminNews() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  useRtl();

  // Local drafts until the CMS backend lands.
  const [drafts, setDrafts] = useState<Article[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const onSave = () => {
    const e = v.required(title, t("nw.title", "العنوان")) || v.required(body, t("nw.body", "المحتوى"));
    setErr(e || undefined);
    if (e) return;
    setDrafts((d) => [{ id: String(Date.now()), title: title.trim(), status: "draft", created_at: new Date().toISOString() }, ...d]);
    setTitle(""); setBody(""); setFormOpen(false);
    show(t("nw.draftSaved", "تم حفظ المسودة محلياً — ستنشر عند توفر الخلفية"), "info");
  };

  return (
    <PanelScreen scroll={false} testID="admin-news">
      <PageHeader
        title={t("nw.title", "الأخبار والمحتوى")}
        subtitle={t("nw.sub", "إدارة أخبار المنصة والمقالات")}
        action={<Button title={t("nw.new", "خبر جديد")} onPress={() => setFormOpen((o) => !o)} />}
      />
      {formOpen ? (
        <SectionCard title={t("nw.newTitle", "خبر جديد")}>
          <FormSection title="">
            <FInput label={t("nw.titleL", "العنوان")} value={title} onChangeText={setTitle} error={err} required />
            <FTextArea label={t("nw.bodyL", "المحتوى")} value={body} onChangeText={setBody} numberOfLines={5} />
          </FormSection>
          <Button title={t("nw.saveDraft", "حفظ كمسودة")} onPress={onSave} />
        </SectionCard>
      ) : null}

      <FlatList
        data={drafts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
        renderItem={({ item: a }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={2}>{a.title}</Text>
              <Text style={s.meta}>{arDateShort(a.created_at)}</Text>
            </View>
            <Badge label={t("nw.draft", "مسودة")} colorKey="warning" />
            <Pressable onPress={() => ask({ title: t("nw.delTitle", "حذف المسودة؟"), danger: true, confirmLabel: t("common.delete", "حذف"), onConfirm: () => setDrafts((d) => d.filter((x) => x.id !== a.id)) })} style={s.del}>
              <Text style={s.delTxt}>{t("common.delete", "حذف")}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState title={t("nw.empty", "لا توجد أخبار بعد")} subtitle={t("nw.emptySub", "أنشئ أول خبر للمنصة")} />
        }
      />
      <PendingFeature
        title={t("nw.cmsSoon", "نظام إدارة المحتوى الكامل قريباً")}
        body={t("nw.cmsBody", "النشر والجدولة وإدارة الوسائط ستتوفر عند اكتمال واجهات الخلفية. المسودات تحفظ محلياً حالياً.")}
        needed={[
          "GET /api/admin/news", "POST /api/admin/news",
          "PATCH /api/admin/news/{id}", "POST /api/admin/news/{id}/publish",
        ]}
      />
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  title: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  meta: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  del: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.error + "1A", alignItems: "center", justifyContent: "center" },
  delTxt: { color: c.error, fontWeight: "700" },
}));
