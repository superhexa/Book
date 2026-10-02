import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Booking, BookingCard } from "@/src/components/booking-card";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, spacing, useTheme } from "@/src/theme";
import { EmptyState, Loading, Segmented } from "@/src/ui";

export default function MyBookingsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState("upcoming");

  const q = useQuery({
    queryKey: ["my-bookings", scope],
    queryFn: () => api.get<Booking[]>(`/bookings?scope=${scope}`),
  });

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>{t("bookings")}</Text>
        <View style={{ marginTop: spacing.md }}>
          <Segmented
            options={[{ key: "upcoming", label: t("upcoming") }, { key: "past", label: t("past") }]}
            value={scope}
            onChange={setScope}
          />
        </View>
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data || []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => <BookingCard booking={item} testID={`booking-${item.id}`} />}
          ListEmptyComponent={<EmptyState title={scope === "upcoming" ? t("noUpcoming") : "No past bookings"} subtitle="Your bookings will appear here" testID="bookings-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  list: { padding: spacing.lg },
}));
