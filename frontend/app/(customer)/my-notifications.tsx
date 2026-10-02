import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRinging, CalendarCheck, Info, Ticket, Warning } from "phosphor-react-native";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  arDateTime, PageHeader, PanelScreen, SkeletonList, useRtl,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, ErrorState } from "@/src/ui";

type Notif = { id: string; title: string; body?: string; kind?: string; read_at?: string; created_at: string };

const KIND_ICON: Record<string, any> = {
  booking: Ticket, reminder: CalendarCheck, promo: BellRinging, alert: Warning,
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  useRtl();

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const d = await api.get("/notifications");
      return (d.items || d || []) as Notif[];
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const list = q.data || [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <PanelScreen scroll={false} testID="notifications">
      <PageHeader
        title={t("notif.title", "الإشعارات")}
        subtitle={unread > 0 ? t("notif.unread", `${unread} غير مقروءة`) : undefined}
        action={unread > 0 ? <Button title={t("notif.readAll", "تعيين الكل كمقروء")} variant="ghost" loading={markAll.isPending} onPress={() => markAll.mutate()} /> : undefined}
      />
      {q.isLoading ? <SkeletonList rows={5} /> : q.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item }) => {
            const Icon = KIND_ICON[item.kind || ""] || Info;
            const unreadN = !item.read_at;
            return (
              <Pressable
                onPress={() => unreadN && markRead.mutate(item.id)}
                style={[s.card, unreadN && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary + "55" }]}
              >
                <View style={[s.icon, { backgroundColor: colors.surfaceTertiary }]}>
                  <Icon size={20} color={unreadN ? colors.brandPrimary : colors.muted} weight="duotone" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={s.top}>
                    <Text style={[s.title, unreadN && { fontWeight: "800" }]}>{item.title}</Text>
                    {unreadN ? <View style={s.dot} /> : null}
                  </View>
                  {item.body ? <Text style={s.body} numberOfLines={3}>{item.body}</Text> : null}
                  <Text style={s.time}>{arDateTime(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              title={t("notif.empty", "لا توجد إشعارات")}
              subtitle={t("notif.emptySub", "سنخبرك هنا عن حجوزاتك والعروض الجديدة")}
            />
          }
        />
      )}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600", flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brandPrimary },
  body: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 },
  time: { color: c.muted, fontSize: fontSize.sm },
}));
