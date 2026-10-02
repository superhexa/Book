import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import {
  addDaysISO, arDate, arDateShort, arTime, todayISO, FormSection, FInput, FNumber,
  PageHeader, PanelScreen, SectionCard, SkeletonList, useConfirm, useRtl, v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, ErrorState, useToast } from "@/src/ui";

type Block = { id: string; date: string; start_min: number; end_min: number; reason?: string };

export default function CalendarScreen() {
  const { facilityId: fidParam } = useLocalSearchParams<{ facilityId?: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  useRtl();

  const [date, setDate] = useState(todayISO());
  const [facilityId, setFacilityId] = useState(fidParam || "");
  const [pitchId, setPitchId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const facilities = useQuery({ queryKey: ["my-facilities"], queryFn: () => api.get<any[]>("/facilities/mine") });
  const facList = facilities.data || [];
  const activeFac = facList.find((f: any) => f.id === (facilityId || facList[0]?.id)) || facList[0];
  const pitches: any[] = activeFac?.pitches || [];
  const activePitch = pitches.find((p: any) => p.id === (pitchId || pitches[0]?.id)) || pitches[0];

  const blocks = useQuery({
    queryKey: ["blocks", activePitch?.id, date],
    queryFn: () => api.get<Block[]>(`/pitches/${activePitch.id}/blocks?date=${date}`),
    enabled: !!activePitch?.id,
  });

  const addBlock = useMutation({
    mutationFn: (body: any) => api.post(`/pitches/${activePitch.id}/blocks`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocks", activePitch.id, date] });
      setFormOpen(false); setFrom(""); setTo(""); setReason("");
      show(t("cal.blocked", "تم حجز الفترة بنجاح"), "success");
    },
    onError: (e: any) => show(e?.message || t("common.error", "حدث خطأ"), "error"),
  });

  const delBlock = useMutation({
    mutationFn: (id: string) => api.del(`/blocks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blocks", activePitch.id, date] }); show(t("cal.unblocked", "تم فتح الفترة"), "success"); },
  });

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  const onAdd = () => {
    const e = v.required(from, t("cal.from", "من")) || v.required(to, t("cal.to", "إلى"));
    setErr(e || undefined);
    if (e) return;
    const sMin = toMin(from); const eMin = toMin(to);
    if (eMin <= sMin) { setErr(t("cal.badRange", "وقت النهاية يجب أن يكون بعد البداية")); return; }
    addBlock.mutate({ date, start_min: sMin, end_min: eMin, reason: reason.trim() || t("cal.maintenance", "صيانة") });
  };

  const week = Array.from({ length: 7 }).map((_, i) => addDaysISO(todayISO(), i));

  return (
    <PanelScreen scroll={false} testID="calendar">
      <PageHeader title={t("cal.title", "التقويم والتوافر")} subtitle={t("cal.sub", "احجز فترات للصيانة أو المناسبات الخاصة")} />

      <View style={s.week}>
        {week.map((d) => {
          const active = d === date;
          return (
            <Pressable key={d} onPress={() => setDate(d)} style={[s.day, active && { backgroundColor: colors.brandPrimary }]}>
              <Text style={[s.dayNum, active && { color: colors.onBrandPrimary }]}>{Number(d.slice(8, 10))}</Text>
              <Text style={[s.dayName, active && { color: colors.onBrandPrimary }]}>{arDateShort(d).split(" ")[1] || ""}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.dateLabel}>{arDate(date)}</Text>

      {pitches.length > 1 ? (
        <View style={s.pitchRow}>
          {pitches.map((p: any) => {
            const active = p.id === activePitch?.id;
            return (
              <Pressable key={p.id} onPress={() => setPitchId(p.id)} style={[s.pitchChip, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                <Text style={[s.pitchTxt, active && { color: colors.onBrandPrimary }]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={s.addRow}>
        <Text style={s.secTitle}>{t("cal.blocks", "الفترات المحجوزة")}</Text>
        <Button title={t("cal.addBlock", "حجز فترة")} variant="secondary" onPress={() => setFormOpen((o) => !o)} />
      </View>

      {formOpen ? (
        <SectionCard title={t("cal.newBlock", "فترة محجوزة جديدة")}>
          <FormSection title="">
            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <FInput label={t("cal.from", "من (مثال 14:00)")} value={from} onChangeText={setFrom} placeholder="14:00" error={err} />
              </View>
              <View style={{ flex: 1 }}>
                <FInput label={t("cal.to", "إلى (مثال 16:00)")} value={to} onChangeText={setTo} placeholder="16:00" />
              </View>
            </View>
            <FInput label={t("cal.reason", "السبب")} value={reason} onChangeText={setReason} placeholder={t("cal.maintenance", "صيانة")} />
          </FormSection>
          <Button title={t("common.save", "حفظ")} loading={addBlock.isPending} onPress={onAdd} />
        </SectionCard>
      ) : null}

      {blocks.isLoading ? <SkeletonList rows={3} /> : blocks.isError ? (
        <ErrorState message={t("common.loadError", "تعذر تحميل البيانات")} onRetry={() => blocks.refetch()} />
      ) : (
        <FlatList
          data={blocks.data || []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={blocks.isFetching} onRefresh={() => blocks.refetch()} tintColor={colors.brandPrimary} />}
          renderItem={({ item: b }) => (
            <View style={s.block}>
              <View style={{ flex: 1 }}>
                <Text style={s.blockTime}>{arTime(b.start_min)} - {arTime(b.end_min)}</Text>
                <Text style={s.blockReason}>{b.reason || t("cal.maintenance", "صيانة")}</Text>
              </View>
              <Pressable
                onPress={() => ask({ title: t("cal.unblockTitle", "فتح هذه الفترة؟"), danger: true, confirmLabel: t("cal.unblock", "فتح"), onConfirm: () => delBlock.mutateAsync(b.id) })}
                style={s.unblock}
              >
                <Text style={s.unblockTxt}>{t("cal.unblock", "فتح")}</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState title={t("cal.noBlocks", "لا توجد فترات محجوزة")} subtitle={t("cal.noBlocksSub", "الملعب متاح بالكامل في هذا اليوم")} />
          }
        />
      )}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  week: { flexDirection: "row", gap: spacing.sm },
  day: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, minHeight: 64, justifyContent: "center" },
  dayNum: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "800" },
  dayName: { color: c.muted, fontSize: 11, marginTop: 2 },
  dateLabel: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  pitchRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  pitchChip: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  pitchTxt: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },
  addRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  timeRow: { flexDirection: "row", gap: spacing.md },
  block: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  blockTime: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  blockReason: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  unblock: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.error + "1A", alignItems: "center", justifyContent: "center" },
  unblockTxt: { color: c.error, fontWeight: "700" },
}));
