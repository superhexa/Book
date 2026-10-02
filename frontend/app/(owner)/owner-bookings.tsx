import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Booking, BookingCard } from "@/src/components/booking-card";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import { Chip, EmptyState, Loading } from "@/src/ui";

const FILTERS = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

export default function OwnerBookings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState("ALL");

  const q = useQuery({
    queryKey: ["owner-bookings", status],
    queryFn: () => api.get<Booking[]>(`/owner/bookings${status !== "ALL" ? `?status=${status}` : ""}`),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>Bookings</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ height: 56 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f.charAt(0) + f.slice(1).toLowerCase()} selected={status === f} onPress={() => setStatus(f)} testID={`filter-${f}`} />
          ))}
        </ScrollView>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => <BookingCard booking={item} showCustomer testID={`owner-booking-${item.id}`} />}
          ListEmptyComponent={<EmptyState title="No bookings" subtitle="Bookings for your fields appear here" testID="owner-bookings-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  chips: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
}));
