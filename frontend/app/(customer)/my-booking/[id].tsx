import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, CalendarBlank, Clock, MapPin, Ticket } from "phosphor-react-native";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { Booking } from "@/src/components/booking-card";
import {
  arDate, arStatus, arTime, jod, PageHeader, PanelScreen, SectionCard,
  SkeletonList, useConfirm, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, EmptyState, ErrorState } from "@/src/ui";
import { statusColorKey } from "@/src/format";

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  useRtl();

  const q = useQuery({
    queryKey: ["booking", id],
    queryFn: () => api.get<Booking>(`/bookings/${id}`),
    enabled: !!id,
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/bookings/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["booking", id] }); qc.invalidateQueries({ queryKey: ["my-bookings"] }); },
  });

  const b = q.data;
  const canCancel = b && ["PENDING", "CONFIRMED"].includes(b.status);

  return (
    <PanelScreen testID="booking-detail">
      <PageHeader
        title={t("booking.title", "تفاصيل الحجز")}
        action={
          <Button title={t("common.back", "رجوع")} variant="ghost" onPress={() => router.back()} />
        }
      />
      {q.isLoading ? <SkeletonList rows={3} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : !b ? (
        <EmptyState title={t("booking.notFound", "الحجز غير موجود")} />
      ) : (
        <>
          <SectionCard title={b.facility_name} subtitle={b.pitch_name}
            action={<Badge label={arStatus(b.status)} colorKey={statusColorKey(b.status)} />}>
            <View style={s.row}>
              <Ticket size={18} color={colors.muted} />
              <Text style={s.label}>{t("booking.ref", "رقم الحجز")}</Text>
              <Text style={s.val}>{b.ref}</Text>
            </View>
            <View style={s.row}>
              <CalendarBlank size={18} color={colors.muted} />
              <Text style={s.label}>{t("booking.date", "التاريخ")}</Text>
              <Text style={s.val}>{arDate(b.date)}</Text>
            </View>
            <View style={s.row}>
              <Clock size={18} color={colors.muted} />
              <Text style={s.label}>{t("booking.time", "الوقت")}</Text>
              <Text style={s.val}>{arTime(b.start_min)} - {arTime(b.end_min)}</Text>
            </View>
            <View style={s.row}>
              <MapPin size={18} color={colors.muted} />
              <Text style={s.label}>{t("booking.amount", "المبلغ")}</Text>
              <Text style={[s.val, { color: colors.brandPrimary, fontWeight: "700" }]}>{jod(b.final_amount)}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>{t("booking.payment", "الدفع")}</Text>
              <Badge label={arStatus(b.payment_status)} colorKey={statusColorKey(b.payment_status)} />
            </View>
          </SectionCard>

          {canCancel ? (
            <Button
              title={t("booking.cancel", "إلغاء الحجز")}
              variant="danger"
              loading={cancel.isPending}
              onPress={() => ask({
                title: t("booking.cancelTitle", "إلغاء الحجز؟"),
                message: t("booking.cancelMsg", "سيتم إلغاء هذا الحجز وفق سياسة الإلغاء الخاصة بالملعب."),
                confirmLabel: t("booking.cancelYes", "نعم، إلغاء الحجز"),
                danger: true,
                onConfirm: () => cancel.mutateAsync(),
              })}
            />
          ) : null}
          {dialog}
        </>
      )}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { color: c.muted, fontSize: fontSize.base, flex: 1 },
  val: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },
}));
