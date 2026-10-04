// Admin — News & content management (real API: CRUD, publish, archive).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  arDateShort,
  DataTable,
  FormSection,
  FInput,
  FSelect,
  FTextArea,
  PageHeader,
  PanelScreen,
  SectionCard,
  useConfirm,
  useRtl,
  v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, EmptyState, useToast } from "@/src/ui";

type Article = {
  id: string;
  title: string;
  body: string;
  kind: string;
  status: string;
  audience: string;
  category: string;
  created_at: string;
  published_at?: string;
};

const STATUS_AR: Record<string, string> = {
  DRAFT: "مسودة",
  SCHEDULED: "مجدول",
  PUBLISHED: "منشور",
  ARCHIVED: "مؤرشف",
};
const KINDS = [
  { key: "news", label: "خبر" },
  { key: "announcement", label: "إعلان" },
];
const AUDIENCES = [
  { key: "all", label: "الجميع" },
  { key: "players", label: "اللاعبون" },
  { key: "teams", label: "الفرق" },
  { key: "referees", label: "الحكام" },
];

export default function AdminNews() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  const qc = useQueryClient();
  useRtl();

  const [statusF, setStatusF] = useState("");
  const [editing, setEditing] = useState<Article | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("news");
  const [audience, setAudience] = useState("all");
  const [err, setErr] = useState<string | undefined>();

  const list = useQuery({
    queryKey: ["admin-news", statusF],
    queryFn: () => api.get<{ items: Article[]; total: number }>(`/news?status=${statusF}&limit=100`),
  });

  const inv = () => qc.invalidateQueries({ queryKey: ["admin-news"] });

  const save = useMutation({
    mutationFn: () => {
      const payload = { title: title.trim(), body: body.trim(), kind, audience };
      return editing ? api.patch(`/news/${editing.id}`, payload) : api.post("/news", payload);
    },
    onSuccess: () => {
      resetForm(); inv(); show(editing ? "تم حفظ التعديلات" : "تم إنشاء الخبر", "success");
    },
    onError: (e: any) => show(e?.message || "تعذر الحفظ", "error"),
  });

  const action = useMutation({
    mutationFn: ({ id, act }: { id: string; act: string }) => api.post(`/news/${id}/${act}`, {}),
    onSuccess: () => { inv(); show("تم", "success"); },
    onError: (e: any) => show(e?.message || "تعذر تنفيذ الإجراء", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/news/${id}`),
    onSuccess: () => { inv(); show("تم حذف الخبر", "success"); },
    onError: (e: any) => show(e?.message || "تعذر الحذف", "error"),
  });

  const resetForm = () => {
    setTitle(""); setBody(""); setKind("news"); setAudience("all");
    setEditing(null); setFormOpen(false); setErr(undefined);
  };

  const startEdit = (a: Article) => {
    setEditing(a);
    setTitle(a.title); setBody(a.body); setKind(a.kind); setAudience(a.audience);
    setFormOpen(true);
  };

  const onSave = () => {
    const e = v.required(title, t("nw.title", "العنوان")) || v.minLen(title, 3, t("nw.title", "العنوان"))
      || v.required(body, t("nw.body", "المحتوى")) || v.minLen(body, 10, t("nw.body", "المحتوى"));
    setErr(e || undefined);
    if (e) return;
    save.mutate();
  };

  const items = list.data?.items || [];

  return (
    <PanelScreen scroll={false} testID="admin-news">
      <PageHeader
        title={t("nw.title", "الأخبار والمحتوى")}
        subtitle={t("nw.sub", "إدارة أخبار المنصة والمقالات")}
        action={<Button title={t("nw.new", "خبر جديد")} onPress={() => { resetForm(); setFormOpen(true); }} />}
      />

      {formOpen ? (
        <SectionCard title={editing ? "تعديل الخبر" : t("nw.newTitle", "خبر جديد")}
          action={<Button title="إلغاء" variant="ghost" onPress={resetForm} />}>
          <FormSection title="">
            <FInput label={t("nw.titleL", "العنوان")} value={title} onChangeText={setTitle} error={err} required />
            <FTextArea label={t("nw.bodyL", "المحتوى")} value={body} onChangeText={setBody} numberOfLines={6} required />
            <FSelect label="النوع" value={kind} onChange={setKind} options={KINDS} />
            <FSelect label="الجمهور" value={audience} onChange={setAudience} options={AUDIENCES} />
          </FormSection>
          <Button title={editing ? "حفظ التعديلات" : "إنشاء كمسودة"} loading={save.isPending} onPress={onSave} />
        </SectionCard>
      ) : null}

      <FSelect
        label="الحالة"
        value={statusF}
        onChange={setStatusF}
        options={[{ key: "", label: "الكل" }, ...Object.entries(STATUS_AR).map(([key, label]) => ({ key, label }))]}
      />

      {list.isError ? (
        <EmptyState title="تعذر تحميل الأخبار" subtitle="تحقق من الاتصال وحاول مجدداً" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
          renderItem={({ item: a }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={2}>{a.title}</Text>
                <Text style={s.meta}>{arDateShort(a.created_at)} · {STATUS_AR[a.status] || a.status}</Text>
              </View>
              <Badge label={STATUS_AR[a.status] || a.status} colorKey={a.status === "PUBLISHED" ? "success" : a.status === "DRAFT" ? "warning" : "info"} />
              <View style={s.actions}>
                {a.status !== "PUBLISHED" ? (
                  <Button title="نشر" variant="ghost" onPress={() => action.mutate({ id: a.id, act: "publish" })} />
                ) : (
                  <Button title="إلغاء النشر" variant="ghost" onPress={() => action.mutate({ id: a.id, act: "unpublish" })} />
                )}
                <Button title="تعديل" variant="ghost" onPress={() => startEdit(a)} />
                <Pressable
                  onPress={() => ask({ title: "حذف هذا الخبر؟", danger: true, confirmLabel: "حذف", onConfirm: () => remove.mutateAsync(a.id) })}
                  style={s.del}
                >
                  <Text style={s.delTxt}>حذف</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            list.isLoading ? null : (
              <EmptyState title={t("nw.empty", "لا توجد أخبار بعد")} subtitle={t("nw.emptySub", "أنشئ أول خبر للمنصة")} />
            )
          }
        />
      )}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, flexWrap: "wrap" },
  title: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  meta: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.xs, alignItems: "center", flexWrap: "wrap" },
  del: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.error + "1A", alignItems: "center", justifyContent: "center" },
  delTxt: { color: c.error, fontWeight: "700" },
}));
