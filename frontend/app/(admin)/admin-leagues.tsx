// Admin — League management: leagues, seasons, registrations, fixtures, standings.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import {
  arDate,
  DataTable,
  FInput,
  FSelect,
  FTextArea,
  PageHeader,
  PanelScreen,
  SectionCard,
  StatCard,
  StatGrid,
  useConfirm,
  useRtl,
  v,
} from "@/src/components/panels";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, spacing } from "@/src/theme";
import { Badge, Button, EmptyState, useToast } from "@/src/ui";

type League = {
  id: string; name: string; description: string; governorate: string;
  format: string; max_teams?: number; status: string; created_at: string;
};
type Season = { id: string; name: string; league_id: string; starts_at?: string; ends_at?: string };
type Registration = { id: string; team_id: string; team_name?: string; status: string; created_at: string };
type Standing = { team_id: string; team_name?: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number };

const LSTATUS: Record<string, string> = { DRAFT: "مسودة", PUBLISHED: "منشور", ACTIVE: "نشط", COMPLETED: "مكتمل", FROZEN: "مجمّد" };
const FORMATS = [
  { key: "league", label: "دوري" },
  { key: "knockout", label: "خروج المغلوب" },
  { key: "mixed", label: "مختلط" },
];

export default function AdminLeagues() {
  const { t } = useTranslation();
  const s = useStyles();
  const { show } = useToast();
  const { ask, dialog } = useConfirm();
  const qc = useQueryClient();
  useRtl();

  const [statusF, setStatusF] = useState("");
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState(false);

  // create league form
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [gov, setGov] = useState("");
  const [format, setFormat] = useState("league");
  const [maxTeams, setMaxTeams] = useState("");
  const [err, setErr] = useState<string | undefined>();
  // season form
  const [sName, setSName] = useState("");
  const [sErr, setSErr] = useState<string | undefined>();

  const leagues = useQuery({
    queryKey: ["admin-leagues", statusF],
    queryFn: () => api.get<{ items: League[]; total: number }>(`/leagues?status=${statusF || "DRAFT"}&limit=100`),
  });
  const seasons = useQuery({
    queryKey: ["league-seasons", league?.id],
    queryFn: () => api.get<Season[]>(`/leagues/${league!.id}/seasons`),
    enabled: !!league,
  });
  const regs = useQuery({
    queryKey: ["league-regs", league?.id, season?.id],
    queryFn: () => api.get<Registration[]>(`/leagues/${league!.id}/seasons/${season!.id}/registrations`),
    enabled: !!league && !!season,
  });
  const standings = useQuery({
    queryKey: ["league-standings", league?.id, season?.id],
    queryFn: () => api.get<Standing[]>(`/leagues/${league!.id}/seasons/${season!.id}/standings`),
    enabled: !!league && !!season,
  });

  const inv = (extra: string[] = []) => {
    ["admin-leagues", "league-seasons", "league-regs", "league-standings"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }));
    extra.forEach(() => {});
  };

  const createLeague = useMutation({
    mutationFn: () => api.post("/leagues", {
      name: name.trim(), description: desc.trim(), governorate: gov.trim(),
      format, max_teams: maxTeams ? parseInt(maxTeams, 10) : undefined,
    }),
    onSuccess: () => {
      setName(""); setDesc(""); setGov(""); setMaxTeams(""); setShowCreate(false);
      inv(); show("تم إنشاء الدوري", "success");
    },
    onError: (e: any) => show(e?.message || "تعذر إنشاء الدوري", "error"),
  });

  const patchLeague = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/leagues/${id}`, body),
    onSuccess: () => { inv(); show("تم الحفظ", "success"); },
    onError: (e: any) => show(e?.message || "تعذر الحفظ", "error"),
  });

  const leagueAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/leagues/${id}/${action}`, {}),
    onSuccess: (_, v) => { inv(); show(v.action === "publish" ? "تم النشر" : "تم التجميد", "success"); if (league) setLeague({ ...league, status: v.action === "publish" ? "PUBLISHED" : "FROZEN" }); },
    onError: (e: any) => show(e?.message || "تعذر تنفيذ الإجراء", "error"),
  });

  const deleteLeague = useMutation({
    mutationFn: (id: string) => api.del(`/leagues/${id}`),
    onSuccess: () => { setLeague(null); inv(); show("تم حذف الدوري", "success"); },
    onError: (e: any) => show(e?.message || "تعذر الحذف", "error"),
  });

  const createSeason = useMutation({
    mutationFn: () => api.post(`/leagues/${league!.id}/seasons`, { name: sName.trim() }),
    onSuccess: () => { setSName(""); setShowSeasonForm(false); inv(); show("تم إنشاء الموسم", "success"); },
    onError: (e: any) => show(e?.message || "تعذر إنشاء الموسم", "error"),
  });

  const regAction = useMutation({
    mutationFn: ({ rid, action }: { rid: string; action: string }) => api.post(`/league-registrations/${rid}/${action}`, {}),
    onSuccess: () => { inv(); show("تم", "success"); },
    onError: (e: any) => show(e?.message || "تعذر التنفيذ", "error"),
  });

  const genFixtures = useMutation({
    mutationFn: (fmt: string) => api.post(`/leagues/${league!.id}/seasons/${season!.id}/generate-fixtures`, { format: fmt }),
    onSuccess: (r: any) => { show(`تم توليد ${r.created} مباراة`, "success"); },
    onError: (e: any) => show(e?.message || "تعذر توليد المباريات", "error"),
  });

  const recalc = useMutation({
    mutationFn: () => api.post(`/leagues/${league!.id}/seasons/${season!.id}/standings/recalculate`, {}),
    onSuccess: () => { inv(); show("تمت إعادة حساب الترتيب", "success"); },
    onError: (e: any) => show(e?.message || "تعذر إعادة الحساب", "error"),
  });

  const onCreate = () => {
    const e = v.required(name, "اسم الدوري") || v.minLen(name, 2, "اسم الدوري");
    setErr(e || undefined);
    if (e) return;
    createLeague.mutate();
  };
  const onCreateSeason = () => {
    const e = v.required(sName, "اسم الموسم");
    setSErr(e || undefined);
    if (e) return;
    createSeason.mutate();
  };

  const items = leagues.data?.items || [];

  return (
    <PanelScreen testID="admin-leagues">
      <PageHeader
        title={t("al.title", "الدوريات والمواسم")}
        subtitle={t("al.sub", "إدارة المسابقات والفرق والمباريات")}
        action={!league ? <Button title="دوري جديد" onPress={() => setShowCreate((o) => !o)} /> : undefined}
      />

      {!league ? (
        <>
          <StatGrid>
            <StatCard label="إجمالي الدوريات" value={leagues.data?.total ?? 0} accent />
            <StatCard label="مسودات" value={items.filter((l) => l.status === "DRAFT").length} />
            <StatCard label="نشطة" value={items.filter((l) => l.status === "ACTIVE").length} />
          </StatGrid>

          {showCreate ? (
            <SectionCard title="دوري جديد">
              <FInput label="اسم الدوري" value={name} onChangeText={setName} error={err} required />
              <FTextArea label="الوصف" value={desc} onChangeText={setDesc} numberOfLines={3} />
              <FInput label="المحافظة" value={gov} onChangeText={setGov} placeholder="عمّان" />
              <FSelect label="النظام" value={format} onChange={setFormat} options={FORMATS} />
              <FInput label="أقصى عدد فرق (اختياري)" value={maxTeams} onChangeText={setMaxTeams} keyboardType="decimal-pad" />
              <Button title="إنشاء الدوري" loading={createLeague.isPending} onPress={onCreate} />
            </SectionCard>
          ) : null}

          <FSelect
            label="الحالة"
            value={statusF}
            onChange={setStatusF}
            options={[{ key: "", label: "الكل" }, ...Object.entries(LSTATUS).map(([key, label]) => ({ key, label }))]}
          />

          <DataTable<League>
            data={items}
            loading={leagues.isLoading}
            keyExtractor={(l) => l.id}
            pageSize={10}
            onRowPress={setLeague}
            emptyTitle="لا توجد دوريات"
            columns={[
              { key: "name", title: "الدوري", value: (l) => l.name, sortable: true },
              { key: "status", title: "الحالة", render: (l) => <Badge label={LSTATUS[l.status] || l.status} colorKey={l.status === "ACTIVE" ? "success" : l.status === "DRAFT" ? "warning" : "info"} />, value: (l) => l.status },
              { key: "gov", title: "المحافظة", value: (l) => l.governorate || "—", hideOnMobile: true },
              { key: "format", title: "النظام", value: (l) => (FORMATS.find((f) => f.key === l.format)?.label || l.format), hideOnMobile: true },
            ]}
          />
        </>
      ) : (
        <>
          <Button title="← عودة للدوريات" variant="ghost" onPress={() => { setLeague(null); setSeason(null); }} />
          <SectionCard
            title={league.name}
            subtitle={`${LSTATUS[league.status]} · ${league.governorate || "—"}`}
            action={
              <Button title="حذف" variant="ghost"
                onPress={() => ask({ title: `حذف دوري ${league.name}؟`, danger: true, confirmLabel: "حذف", onConfirm: () => deleteLeague.mutateAsync(league.id) })} />
            }
          >
            {league.description ? <Text style={s.desc}>{league.description}</Text> : null}
            <View style={s.btnRow}>
              {league.status === "DRAFT" ? (
                <Button title="نشر الدوري" loading={leagueAction.isPending} onPress={() => leagueAction.mutate({ id: league.id, action: "publish" })} />
              ) : null}
              {league.status !== "FROZEN" && league.status !== "COMPLETED" ? (
                <Button title="تجميد" variant="secondary" loading={leagueAction.isPending} onPress={() => leagueAction.mutate({ id: league.id, action: "freeze" })} />
              ) : null}
            </View>
          </SectionCard>

          {/* seasons */}
          <SectionCard
            title="المواسم"
            action={<Button title="موسم جديد" variant="ghost" onPress={() => setShowSeasonForm((o) => !o)} />}
          >
            {showSeasonForm ? (
              <View style={s.formRow}>
                <View style={{ flex: 1 }}>
                  <FInput label="اسم الموسم" value={sName} onChangeText={setSName} error={sErr} placeholder="موسم 2026" />
                </View>
                <Button title="إنشاء" loading={createSeason.isPending} onPress={onCreateSeason} />
              </View>
            ) : null}
            {(seasons.data || []).length === 0 && !seasons.isLoading ? (
              <Text style={s.muted}>لا توجد مواسم بعد.</Text>
            ) : (
              <View style={s.seasonList}>
                {(seasons.data || []).map((sn) => (
                  <Button
                    key={sn.id}
                    title={sn.name}
                    variant={season?.id === sn.id ? "primary" : "secondary"}
                    onPress={() => setSeason(sn)}
                  />
                ))}
              </View>
            )}
          </SectionCard>

          {season ? (
            <>
              {/* registrations */}
              <SectionCard title={`طلبات التسجيل — ${season.name}`}>
                {(regs.data || []).length === 0 ? (
                  <Text style={s.muted}>لا توجد طلبات تسجيل.</Text>
                ) : (
                  (regs.data || []).map((r) => (
                    <View key={r.id} style={s.regRow}>
                      <Text style={s.regName}>{r.team_name || r.team_id}</Text>
                      <Badge label={r.status} colorKey={r.status === "APPROVED" ? "success" : r.status === "PENDING" ? "warning" : "info"} />
                      {r.status === "PENDING" ? (
                        <View style={s.btnRow}>
                          <Button title="قبول" variant="ghost" onPress={() => regAction.mutate({ rid: r.id, action: "approve" })} />
                          <Button title="رفض" variant="ghost" onPress={() => regAction.mutate({ rid: r.id, action: "reject" })} />
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </SectionCard>

              {/* fixtures */}
              <SectionCard title="توليد المباريات">
                <Text style={s.muted}>يولّد المباريات للفرق المعتمدة في هذا الموسم.</Text>
                <View style={s.btnRow}>
                  <Button title="ذهاب فقط" loading={genFixtures.isPending} onPress={() => genFixtures.mutate("round_robin")} />
                  <Button title="ذهاب وإياب" variant="secondary" loading={genFixtures.isPending} onPress={() => genFixtures.mutate("double_round_robin")} />
                  <Button title="خروج المغلوب" variant="secondary" loading={genFixtures.isPending} onPress={() => genFixtures.mutate("knockout")} />
                </View>
              </SectionCard>

              {/* standings */}
              <SectionCard
                title="جدول الترتيب"
                action={<Button title="إعادة الحساب" variant="ghost" loading={recalc.isPending} onPress={() => recalc.mutate()} />}
              >
                <DataTable<Standing>
                  data={standings.data || []}
                  loading={standings.isLoading}
                  keyExtractor={(st) => st.team_id}
                  pageSize={20}
                  emptyTitle="لا يوجد ترتيب بعد"
                  columns={[
                    { key: "team", title: "الفريق", value: (st) => st.team_name || st.team_id },
                    { key: "p", title: "لعب", value: (st) => st.played, sortable: true },
                    { key: "w", title: "فوز", value: (st) => st.won, hideOnMobile: true },
                    { key: "d", title: "تعادل", value: (st) => st.drawn, hideOnMobile: true },
                    { key: "l", title: "خسارة", value: (st) => st.lost, hideOnMobile: true },
                    { key: "gd", title: "فرق", value: (st) => st.gd, sortable: true, hideOnMobile: true },
                    { key: "pts", title: "نقاط", value: (st) => st.points, sortable: true },
                  ]}
                />
              </SectionCard>
            </>
          ) : null}
        </>
      )}
      {dialog}
    </PanelScreen>
  );
}

const useStyles = makeStyles((c) => ({
  desc: { fontSize: fontSize.base, color: c.onSurface, lineHeight: 24 },
  muted: { fontSize: fontSize.sm, color: c.muted },
  btnRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" },
  formRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
  seasonList: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  regRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: 10, padding: spacing.sm },
  regName: { fontSize: fontSize.base, color: c.onSurface, fontWeight: "600", flex: 1 },
}));
