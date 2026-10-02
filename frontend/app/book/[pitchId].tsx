import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { dayNum, minToLabel, money, nextDays, weekdayShort } from "@/src/format";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, Loading, TextField, useToast } from "@/src/ui";

type Slot = { start_min: number; end_min: number; label: string; part: string; status: string; price: number; peak: boolean };

export default function BookScreen() {
  const { pitchId } = useLocalSearchParams<{ pitchId: string }>();
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const days = useMemo(() => nextDays(14), []);
  const [date, setDate] = useState(days[0]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");

  const pitch = useQuery({ queryKey: ["pitch", pitchId], queryFn: () => api.get(`/pitches/${pitchId}`, false) });
  const avail = useQuery({
    queryKey: ["availability", pitchId, date],
    queryFn: () => api.get<{ slots: Slot[] }>(`/availability?pitch_id=${pitchId}&date=${date}`, false),
  });

  const currency = pitch.data?.facility?.currency || "USD";

  const quote = useQuery({
    queryKey: ["quote", pitchId, date, selected?.start_min, appliedCoupon],
    enabled: !!selected,
    queryFn: () => api.post("/bookings/quote", {
      pitch_id: pitchId, date, start_min: selected!.start_min, end_min: selected!.end_min,
      coupon_code: appliedCoupon || undefined,
    }),
  });

  const createBooking = useMutation({
    mutationFn: () => api.post("/bookings", {
      pitch_id: pitchId, date, start_min: selected!.start_min, end_min: selected!.end_min,
      coupon_code: appliedCoupon || undefined,
    }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["availability", pitchId, date] });
      toast.show(b.status === "PENDING" ? "Booking requested" : "Booking confirmed", "success");
      router.replace(`/booking/${b.id}`);
    },
    onError: (e) => {
      toast.show(e instanceof ApiError ? e.message : "Could not create booking", "error");
      avail.refetch();
      setSelected(null);
    },
  });

  const slots = avail.data?.slots || [];
  const groups = [
    { key: "morning", label: "Morning" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
  ];

  const applyCoupon = () => {
    setAppliedCoupon(coupon.trim().toUpperCase());
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="book-back" onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color={colors.onSurface} />
        </Pressable>
        <View>
          <Text style={s.title}>{pitch.data?.name || "Select time"}</Text>
          <Text style={s.sub}>{pitch.data?.facility?.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>{t("selectDate")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateRow}>
          {days.map((d) => {
            const active = d === date;
            return (
              <Pressable key={d} testID={`date-${d}`} onPress={() => { setDate(d); setSelected(null); }}
                style={[s.dateChip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                <Text style={[s.dateWd, active && { color: colors.onBrandPrimary }]}>{weekdayShort(d)}</Text>
                <Text style={[s.dateNum, active && { color: colors.onBrandPrimary }]}>{dayNum(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[s.sectionLabel, { marginTop: spacing.xl }]}>{t("availableSlots")}</Text>
        {avail.isLoading ? (
          <Loading />
        ) : slots.length === 0 ? (
          <EmptyState title={t("noSlots")} subtitle="Pick another day" testID="no-slots" />
        ) : (
          groups.map((g) => {
            const gslots = slots.filter((sl) => sl.part === g.key);
            if (!gslots.length) return null;
            return (
              <View key={g.key} style={{ marginBottom: spacing.lg }}>
                <Text style={s.groupLabel}>{g.label}</Text>
                <View style={s.slotGrid}>
                  {gslots.map((sl) => {
                    const disabled = sl.status !== "available";
                    const isSel = selected?.start_min === sl.start_min;
                    return (
                      <Pressable key={sl.start_min} testID={`slot-${sl.start_min}`} disabled={disabled}
                        onPress={() => setSelected(sl)}
                        style={[s.slot,
                          disabled && s.slotDisabled,
                          isSel && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                        <Text style={[s.slotTime, disabled && { color: colors.muted }, isSel && { color: colors.onBrandPrimary }]}>
                          {minToLabel(sl.start_min)}
                        </Text>
                        <Text style={[s.slotPrice, disabled && { color: colors.muted }, isSel && { color: colors.onBrandPrimary }]}>
                          {disabled && sl.status !== "available" ? (sl.status === "reserved" ? "Booked" : sl.status === "past" ? "—" : "Blocked") : money(sl.price, currency)}
                        </Text>
                        {sl.peak && !disabled ? <View style={s.peakDot} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        {selected ? (
          <View style={s.couponRow}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Coupon code" value={coupon} onChangeText={setCoupon} autoCapitalize="characters" testID="coupon-input" />
            </View>
            <Button title={t("apply")} variant="secondary" onPress={applyCoupon} style={{ height: 52, paddingHorizontal: spacing.lg }} />
          </View>
        ) : null}

        {selected && quote.data ? (
          <View style={s.breakdown}>
            <Text style={s.breakdownTitle}>Price breakdown</Text>
            <Row label="Subtotal" value={money(quote.data.subtotal, currency)} />
            {quote.data.peak_applied ? <Row label="Peak pricing" value="included" muted /> : null}
            {quote.data.discount > 0 ? <Row label={`Discount (${appliedCoupon})`} value={`- ${money(quote.data.discount, currency)}`} /> : null}
            {appliedCoupon && quote.data.coupon_valid === false ? <Text style={s.couponErr}>{quote.data.coupon_error}</Text> : null}
            <View style={s.divider} />
            <Row label={t("total")} value={money(quote.data.total, currency)} bold />
          </View>
        ) : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View>
          <Text style={s.footerLabel}>{selected ? `${minToLabel(selected.start_min)} – ${minToLabel(selected.end_min)}` : "Select a slot"}</Text>
          <Text style={s.footerTotal}>{quote.data ? money(quote.data.total, currency) : selected ? money(selected.price, currency) : "—"}</Text>
        </View>
        <Button testID="confirm-booking" title={t("confirmBooking")} disabled={!selected} loading={createBooking.isPending}
          onPress={() => createBooking.mutate()} style={{ flex: 1, marginLeft: spacing.lg }} />
      </View>
    </View>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Text style={{ color: muted ? colors.muted : colors.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: bold ? "700" : "400" }}>{label}</Text>
      <Text style={{ color: bold ? colors.brandPrimary : colors.onSurface, fontSize: bold ? fontSize.lg : fontSize.base, fontWeight: bold ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  sub: { color: c.muted, fontSize: fontSize.base },
  sectionLabel: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", marginBottom: spacing.md },
  dateRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  dateChip: { width: 58, height: 70, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 },
  dateWd: { color: c.muted, fontSize: fontSize.sm, fontWeight: "500" },
  dateNum: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "700" },
  groupLabel: { color: c.muted, fontSize: fontSize.sm, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: { width: "31%", minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm },
  slotDisabled: { backgroundColor: c.surfaceTertiary, opacity: 0.55 },
  slotTime: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },
  slotPrice: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  peakDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: c.warning },
  couponRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  breakdown: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: c.border },
  breakdownTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", marginBottom: spacing.md },
  couponErr: { color: c.error, fontSize: fontSize.sm, marginTop: 4 },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  footerLabel: { color: c.muted, fontSize: fontSize.sm },
  footerTotal: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "700" },
}));
