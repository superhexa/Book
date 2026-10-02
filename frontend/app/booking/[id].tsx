import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Star } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { dateLabel, minToLabel, money, prettyStatus, statusColorKey } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Loading, TextField, useToast } from "@/src/ui";

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");

  const q = useQuery({ queryKey: ["booking", id], queryFn: () => api.get(`/bookings/${id}`) });
  const existingReview = useQuery({
    queryKey: ["booking-review", id],
    enabled: !!q.data && q.data.status === "COMPLETED",
    queryFn: async () => {
      const list = await api.get(`/facilities/${q.data.facility_id}/reviews`, false);
      return list.find((r: any) => r.booking_id === id) || null;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["booking", id] });
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
    qc.invalidateQueries({ queryKey: ["owner-bookings"] });
  };

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: any }) => api.post(path, body),
    onSuccess: () => { invalidate(); toast.show("Updated", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/bookings/${id}/cancel`, { reason }),
    onSuccess: (res) => {
      invalidate();
      toast.show(res.refund_detail ? `Cancelled. Refund: ${money(res.refund_detail.refund, res.currency)}` : "Cancelled", "success");
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const review = useMutation({
    mutationFn: () => api.post("/reviews", { booking_id: id, rating, comment }),
    onSuccess: () => { existingReview.refetch(); toast.show("Review submitted", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  if (q.isLoading || !q.data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  const b = q.data;
  const isOwner = user?.id === b.owner_id || user?.roles?.includes("super_admin");
  const isCustomer = user?.id === b.customer_id;
  const active = ["PENDING", "CONFIRMED"].includes(b.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="booking-back" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>Booking</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={s.topRow}>
          <Text style={s.ref}>{b.ref}</Text>
          <Badge label={prettyStatus(b.status)} colorKey={statusColorKey(b.status)} />
        </View>
        <Text style={s.facility}>{b.facility_name}</Text>
        <Text style={s.pitch}>{b.pitch_name}</Text>

        <View style={s.card}>
          <Row label="Date" value={dateLabel(b.date)} />
          <Row label="Time" value={`${minToLabel(b.start_min)} – ${minToLabel(b.end_min)}`} />
          <Row label="Duration" value={`${b.duration_min / 60} hr`} />
          {isOwner && b.customer_name ? <Row label="Customer" value={b.customer_name} /> : null}
          <View style={s.divider} />
          <Row label="Subtotal" value={money(b.subtotal, b.currency)} />
          {b.discount > 0 ? <Row label={`Discount (${b.coupon_code})`} value={`- ${money(b.discount, b.currency)}`} /> : null}
          <Row label="Total" value={money(b.final_amount, b.currency)} bold />
          <Row label="Payment" value={`${prettyStatus(b.payment_status)} · ${prettyStatus(b.payment_method)}`} />
          {b.refund_amount > 0 ? <Row label="Refunded" value={money(b.refund_amount, b.currency)} /> : null}
        </View>

        {b.cancellation_reason ? <Text style={s.reason}>Reason: {b.cancellation_reason}</Text> : null}

        {/* Owner actions */}
        {isOwner && b.status === "PENDING" ? (
          <View style={s.actions}>
            <Button title="Approve" testID="approve-btn" onPress={() => act.mutate({ path: `/bookings/${id}/approve` })} style={{ flex: 1 }} />
            <Button title="Reject" variant="danger" testID="reject-btn" onPress={() => act.mutate({ path: `/bookings/${id}/reject`, body: { reason: "Not available" } })} style={{ flex: 1 }} />
          </View>
        ) : null}
        {isOwner && b.status === "CONFIRMED" ? (
          <View style={s.actions}>
            <Button title="Mark completed" testID="complete-btn" onPress={() => act.mutate({ path: `/bookings/${id}/complete` })} style={{ flex: 1 }} />
            <Button title="No-show" variant="secondary" testID="noshow-btn" onPress={() => act.mutate({ path: `/bookings/${id}/no-show` })} style={{ flex: 1 }} />
          </View>
        ) : null}

        {/* Cancel */}
        {active && (isCustomer || isOwner) ? (
          <View style={{ marginTop: spacing.lg }}>
            <TextField placeholder="Cancellation reason (optional)" value={reason} onChangeText={setReason} testID="cancel-reason" />
            <Button title="Cancel booking" variant="danger" testID="cancel-booking-btn" loading={cancel.isPending} onPress={() => cancel.mutate()} style={{ marginTop: spacing.sm }} />
          </View>
        ) : null}

        {/* Review */}
        {isCustomer && b.status === "COMPLETED" ? (
          existingReview.data ? (
            <View style={[s.card, { marginTop: spacing.lg }]}>
              <Text style={s.cardTitle}>Your review</Text>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={18} weight={n <= existingReview.data.rating ? "fill" : "regular"} color={colors.warning} />)}
              </View>
              {existingReview.data.comment ? <Text style={s.reviewTxt}>{existingReview.data.comment}</Text> : null}
            </View>
          ) : (
            <View style={[s.card, { marginTop: spacing.lg }]}>
              <Text style={s.cardTitle}>Leave a review</Text>
              <View style={{ flexDirection: "row", gap: 6, marginVertical: spacing.sm }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} testID={`star-${n}`} onPress={() => setRating(n)}>
                    <Star size={30} weight={n <= rating ? "fill" : "regular"} color={colors.warning} />
                  </Pressable>
                ))}
              </View>
              <TextField placeholder="Share your experience" value={comment} onChangeText={setComment} multiline testID="review-comment" />
              <Button title="Submit review" testID="submit-review" loading={review.isPending} onPress={() => review.mutate()} style={{ marginTop: spacing.sm }} />
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
      <Text style={{ color: colors.muted, fontSize: fontSize.base }}>{label}</Text>
      <Text style={{ color: bold ? colors.brandPrimary : colors.onSurface, fontSize: bold ? fontSize.lg : fontSize.base, fontWeight: bold ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: c.muted, fontWeight: "600", letterSpacing: 0.5 },
  facility: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600", marginTop: spacing.sm },
  pitch: { color: c.muted, fontSize: fontSize.lg },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: c.border },
  cardTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.sm },
  reason: { color: c.muted, marginTop: spacing.md, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  reviewTxt: { color: c.onSurfaceSecondary, marginTop: spacing.sm, lineHeight: 20 },
}));
