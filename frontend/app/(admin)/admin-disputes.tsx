// Admin — Dispute resolution center (real API, no placeholders).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import {
  arDateTime,
  DataTable,
  FSelect,
  FTextArea,
  PageHeader,
  PanelScreen,
  SectionCard,
  StatCard,
  StatGrid,
  useConfirm,
  useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import { Badge, Button, EmptyState, useToast } from "@/src/ui";

type Dispute = {
  id: string;
  title: string;
  description: string;
  category: string;
  related_type: string;
  related_id?: string;
  reporter_id: string;
  reporter_name?: string;
  status: string;
  evidence: { file_url: string; file_name?: string; note?: string; at: string }[];
  history: { from_status: string | null; to_status: string; note?: string; at: string }[];
  decision?: { decision: string; notes?: string; at: string } | null;
  created_at: string;
};

const STATUSES = ["", "OPEN", "UNDER_REVIEW", "WAITING_FOR_EVIDENCE", "ESCALATED", "RESOLVED", "REJECTED"];
const TRANSITIONS: Record<string, string[]> = {
  OPEN: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["WAITING_FOR_EVIDENCE", "RESOLVED", "REJECTED", "ESCALATED"],
  WAITING_FOR_EVIDENCE: ["UNDER_REVIEW", "RESOLVED", "REJECTED", "ESCALATED"],
  ESCALATED: ["UNDER_REVIEW", "RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

const STATUS_AR: Record<string, string> = {
  OPEN: "مفتوح",
  UNDER_REVIEW: "قيد المراجعة",
  WAITING_FOR_EVIDENCE: "بانتظار الأدلة",
  ESCALATED: "مُصعّد",
  RESOLVED: "محلول",
  REJECTED: "مرفوض",
};

export default function AdminDisputes() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  const qc = useQueryClient();
  useRtl();

  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<Dispute | null>(null);
  const [note, setNote] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");

  const list = useQuery({
    queryKey: ["admin-disputes", status],
    queryFn: () => api.get<{ items: Dispute[]; total: number }>(`/disputes${status ? `?status=${status}` : ""}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    setDetail(null);
  };

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) =>
      api.post(`/disputes/${id}/transition`, { to, note: note || undefined }),
    onSuccess: () => { setNote(""); invalidate(); show("تم تحديث حالة النزاع", "success"); },
    onError: (e: any) => show(e?.message || "تعذر تحديث الحالة", "error"),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: string }) =>
      api.post(`/disputes/${id}/decision`, { decision, notes: decisionNotes || undefined }),
    onSuccess: () => { setDecisionNotes(""); invalidate(); show("تم تسجيل القرار", "success"); },
    onError: (e: any) => show(e?.message || "تعذر تسجيل القرار", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/disputes/${id}`),
    onSuccess: () => { invalidate(); show("تم حذف النزاع", "success"); },
    onError: (e: any) => show(e?.message || "تعذر الحذف", "error"),
  });

  const items = list.data?.items || [];
  const counts = {
    open: items.filter((d) => d.status === "OPEN").length,
    review: items.filter((d) => d.status === "UNDER_REVIEW").length,
    resolved: items.filter((d) => d.status === "RESOLVED").length,
  };

  return (
    <PanelScreen testID="admin-disputes">
      <PageHeader
        title={t("ad.title", "النزاعات")}
        subtitle={t("ad.sub", "مراجعة وحل النزاعات بين اللاعبين والملاك")}
      />

      <StatGrid>
        <StatCard label="نزاعات مفتوحة" value={counts.open} accent />
        <StatCard label="قيد المراجعة" value={counts.review} />
        <StatCard label="محلولة" value={counts.resolved} />
        <StatCard label="الإجمالي" value={list.data?.total ?? 0} />
      </StatGrid>

      <FSelect
        label={t("ad.filter", "تصفية حسب الحالة")}
        value={status}
        onChange={setStatus}
        options={STATUSES.map((k) => ({ key: k, label: k ? STATUS_AR[k] : "الكل" }))}
      />

      {list.isError ? (
        <EmptyState title="تعذر تحميل النزاعات" subtitle="تحقق من الاتصال وحاول مجدداً" />
      ) : (
        <DataTable<Dispute>
          data={items}
          loading={list.isLoading}
          keyExtractor={(d) => d.id}
          pageSize={10}
          onRowPress={setDetail}
          emptyTitle="لا توجد نزاعات"
          columns={[
            { key: "title", title: "العنوان", value: (d) => d.title, sortable: true },
            { key: "status", title: "الحالة", render: (d) => <Badge label={STATUS_AR[d.status] || d.status} colorKey={d.status === "RESOLVED" ? "success" : d.status === "OPEN" ? "warning" : "info"} />, sortable: true, value: (d) => d.status },
            { key: "category", title: "التصنيف", value: (d) => d.category, hideOnMobile: true },
            { key: "created", title: "التاريخ", value: (d) => d.created_at, render: (d) => <Text style={s.cell}>{arDateTime(d.created_at)}</Text>, sortable: true, hideOnMobile: true },
          ]}
        />
      )}

      {detail ? (
        <SectionCard
          title={detail.title}
          subtitle={`${STATUS_AR[detail.status]} · ${arDateTime(detail.created_at)}`}
          action={<Button title="إغلاق" variant="ghost" onPress={() => setDetail(null)} />}
        >
          <Text style={s.desc}>{detail.description}</Text>
          <View style={s.metaRow}>
            <Text style={s.meta}>التصنيف: {detail.category}</Text>
            {detail.related_type !== "other" ? <Text style={s.meta}>مرتبط بـ: {detail.related_type}</Text> : null}
          </View>

          <Text style={s.h}>الأدلة ({detail.evidence?.length || 0})</Text>
          {(detail.evidence || []).length === 0 ? (
            <Text style={s.muted}>لا توجد أدلة مرفقة بعد.</Text>
          ) : (
            detail.evidence.map((e, i) => (
              <View key={i} style={s.evRow}>
                <Text style={s.evName}>{e.file_name || e.file_url}</Text>
                {e.note ? <Text style={s.muted}>{e.note}</Text> : null}
              </View>
            ))
          )}

          <Text style={s.h}>سجل الحالات</Text>
          {(detail.history || []).map((h, i) => (
            <View key={i} style={s.histRow}>
              <View style={s.histDot} />
              <Text style={s.muted}>
                {h.from_status ? `${STATUS_AR[h.from_status] || h.from_status} ← ` : ""}
                {STATUS_AR[h.to_status] || h.to_status} · {arDateTime(h.at)}
                {h.note ? ` — ${h.note}` : ""}
              </Text>
            </View>
          ))}

          {(TRANSITIONS[detail.status] || []).length > 0 ? (
            <>
              <Text style={s.h}>تغيير الحالة</Text>
              <FTextArea label="ملاحظة (اختياري)" value={note} onChangeText={setNote} numberOfLines={2} />
              <View style={s.btnRow}>
                {(TRANSITIONS[detail.status] || []).map((to) => (
                  <Button
                    key={to}
                    title={STATUS_AR[to]}
                    variant={to === "REJECTED" ? "danger" : "secondary"}
                    loading={transition.isPending}
                    onPress={() => transition.mutate({ id: detail.id, to })}
                  />
                ))}
              </View>
            </>
          ) : null}

          {!["RESOLVED", "REJECTED"].includes(detail.status) ? (
            <>
              <Text style={s.h}>قرار نهائي</Text>
              <FTextArea label="حيثيات القرار" value={decisionNotes} onChangeText={setDecisionNotes} numberOfLines={3} />
              <View style={s.btnRow}>
                <Button title="اعتماد الحل" loading={decide.isPending} onPress={() => decide.mutate({ id: detail.id, decision: "RESOLVED" })} />
                <Button title="رفض النزاع" variant="danger" loading={decide.isPending} onPress={() => decide.mutate({ id: detail.id, decision: "REJECTED" })} />
              </View>
            </>
          ) : detail.decision ? (
            <View style={s.decisionBox}>
              <Text style={s.h}>القرار: {detail.decision.decision === "RESOLVED" ? "تم الحل" : "مرفوض"}</Text>
              {detail.decision.notes ? <Text style={s.muted}>{detail.decision.notes}</Text> : null}
            </View>
          ) : null}

          <Button
            title="حذف النزاع"
            variant="ghost"
            onPress={() => ask({ title: "حذف هذا النزاع نهائياً؟", danger: true, confirmLabel: "حذف", onConfirm: () => remove.mutateAsync(detail.id) })}
          />
        </SectionCard>
      ) : null}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  cell: { fontSize: fontSize.base, color: c.onSurface },
  desc: { fontSize: fontSize.base, color: c.onSurface, lineHeight: 24 },
  metaRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  meta: { fontSize: fontSize.sm, color: c.muted },
  muted: { fontSize: fontSize.sm, color: c.muted },
  h: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface, marginTop: spacing.sm },
  evRow: { backgroundColor: c.surfaceSecondary, borderRadius: 10, padding: spacing.sm, gap: 2 },
  evName: { fontSize: fontSize.sm, color: c.onSurface, fontWeight: "600" },
  histRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  histDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandPrimary, marginTop: 5 },
  btnRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  decisionBox: { backgroundColor: c.brandSecondary, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
}));
