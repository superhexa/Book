import { router } from "expo-router";
import { CalendarBlank, Clock, MapPin } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { dateLabel, minToLabel, money, prettyStatus, statusColorKey } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge } from "@/src/ui";

export type Booking = {
  id: string;
  ref: string;
  facility_name: string;
  pitch_name: string;
  customer_name?: string;
  date: string;
  start_min: number;
  end_min: number;
  final_amount: number;
  currency: string;
  status: string;
  payment_status: string;
};

export function BookingCard({ booking, showCustomer, onPress, testID }: { booking: Booking; showCustomer?: boolean; onPress?: () => void; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress || (() => router.push(`/booking/${booking.id}`))}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.95 }]}
    >
      <View style={s.notchLeft} />
      <View style={s.notchRight} />
      <View style={s.topRow}>
        <Text style={s.ref}>{booking.ref}</Text>
        <Badge label={prettyStatus(booking.status)} colorKey={statusColorKey(booking.status)} />
      </View>
      <Text style={s.title} numberOfLines={1}>{booking.facility_name}</Text>
      <View style={s.metaRow}>
        <MapPin size={13} color={colors.muted} />
        <Text style={s.meta}>{booking.pitch_name}{showCustomer && booking.customer_name ? ` · ${booking.customer_name}` : ""}</Text>
      </View>
      <View style={s.dashed} />
      <View style={s.bottomRow}>
        <View style={s.metaRow}>
          <CalendarBlank size={14} color={colors.onSurfaceSecondary} />
          <Text style={s.date}>{dateLabel(booking.date)}</Text>
          <Clock size={14} color={colors.onSurfaceSecondary} style={{ marginLeft: spacing.sm }} />
          <Text style={s.date}>{minToLabel(booking.start_min)}</Text>
        </View>
        <Text style={s.amount}>{money(booking.final_amount, booking.currency)}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  notchLeft: { position: "absolute", left: -8, top: "50%", width: 16, height: 16, borderRadius: 8, backgroundColor: c.surface },
  notchRight: { position: "absolute", right: -8, top: "50%", width: 16, height: 16, borderRadius: 8, backgroundColor: c.surface },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: c.muted, fontSize: fontSize.sm, fontWeight: "600", letterSpacing: 0.5 },
  title: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", marginTop: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { color: c.muted, fontSize: fontSize.base },
  dashed: { height: 1, borderBottomWidth: 1, borderStyle: "dashed", borderColor: c.border, marginVertical: spacing.md },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: c.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: "500" },
  amount: { color: c.brandPrimary, fontSize: fontSize.lg, fontWeight: "700" },
}));
