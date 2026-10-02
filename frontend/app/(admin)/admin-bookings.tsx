import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { Booking } from "@/src/components/booking-card";
import {
  arDate, arStatus, arTime, DataTable, FInput, FSelect, jod,
  PageHeader, PanelScreen, SectionCard, useConfirm, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, spacing } from "@/src/theme";
import { Badge, Button, ErrorState, Segmented, useToast } from "@/src/ui";
import { statusColorKey } from "@/src/format";

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"];

export default function AdminBookings() {
  const { t } = useTranslation();
  const s = useStyles();
  const qc = useQueryClient();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  useRtl();

  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState("CONFIRMED");

  const list = useQuery({
    queryKey: ["admin-bookings", status, q],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const d = await api.get(`/admin/bookings?${params}`);
      return (d.items || d || []) as Booking[];
    },
  });

  const override = useMutation({
    mutationFn: ({ id, st }: { id: string; st: string }) => api.post(`/admin/bookings/${id}/override`, { status: st, reason: "admin override" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      setDetail(null);
      show(t("ab.overridden", "تم تعديل حالة الحجز"), "success");
    },
    onError: () => show(t("common.error", "حدث خطأ"), "error"),
  });

  return (
    <PanelScreen testID="admin-bookings">
      <PageHeader title={t("ab.title", "مراقبة الحجوزات")} subtitle={t("ab.sub", "جميع حجوزات المنصة مع إمكانية التدخل الإداري")} />
      <FInput label={t("ab.search", "بحث")} value={q} onChangeText={setQ} placeholder={t("ab.searchPh", "رقم الحجز أو اسم اللاعب...")} />
      <Segmented
        options={[{ key: "", label: t("ab.all", "الكل") }, ...STATUSES.map((k) => ({ key: k, label: arStatus(k) }))]}
        value={status} onChange={setStatus}
      />

      {list.isError ? <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => list.refetch()} /> : (
        <DataTable<Booking>
          data={list.data || []}
          loading={list.isLoading}
          keyExtractor={(b) => b.id}
          pageSize={10}
          onRowPress={setDetail}
          emptyTitle={t("ab.empty", "لا توجد حجوزات")}
          columns={[
            { key: "ref", title: t("ab.ref", "المرجع"), value: (b) => b.ref, sortable: true },
            { key: "facility", title: t("ab.facility", "المنشأة"), value: (b) => b.facility_name, sortable: true },
            { key: "customer", title: t("ab.customer", "اللاعب"), value: (b) => b.customer_name || "—", hideOnMobile: true },
            {
              key: "when", title: t("ab.when", "الموعد"), value: (b) => `${b.date} ${b.start_min}`,
              render: (b) => <Text style={s.cell}>{arDate(b.date)} · {arTime(b.start_min)}</Text>, sortable: true, hideOnMobile: true,
            },
            { key: "amount", title: t("ab.amount", "المبلغ"), value: (b) => b.final_amount || 0, render: (b) => <Text style={s.amount}>{jod(b.final_amount)}</Text>, sortable: true },
            {
              key: "status", title: t("ab.status", "الحالة"), value: (b) => b.status,
              render: (b) => <Badge label={arStatus(b.status)} colorKey={statusColorKey(b.status)} />,
            },
          ]}
        />
      )}

      {detail ? (
        <SectionCard
          title={`${t("ab.booking", "الحجز")} ${detail.ref}`}
          subtitle={`${detail.facility_name} · ${detail.customer_name || ""}`}
          action={<Button title={t("common.close", "إغلاق")} variant="ghost" onPress={() => setDetail(null)} />}
        >
          <View style={s.dRow}>
            <Text style={s.dk}>{t("ab.current", "الحالة الحالية")}</Text>
            <Badge label={arStatus(detail.status)} colorKey={statusColorKey(detail.status)} />
          </View>
          <FSelect
            label={t("ab.newStatus", "الحالة الجديدة")}
            value={newStatus}
            onChange={setNewStatus}
            options={STATUSES.map((k) => ({ key: k, label: arStatus(k) }))}
          />
          <Button
            title={t("ab.override", "تطبيق التعديل الإداري")}
            variant="danger"
            onPress={() => ask({
              title: t("ab.overrideTitle", "تعديل حالة الحجز؟"),
              message: t("ab.overrideMsg", "سيتم إشعار اللاعب والمالك بهذا التغيير."),
              danger: true, confirmLabel: t("ab.override", "تطبيق"),
              onConfirm: () => override.mutateAsync({ id: detail.id, st: newStatus }),
            })}
          />
        </SectionCard>
      ) : null}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  cell: { color: c.onSurface, fontSize: fontSize.base },
  amount: { color: c.brandPrimary, fontSize: fontSize.base, fontWeight: "700" },
  dRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dk: { color: c.muted, fontSize: fontSize.base },
}));
