import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { prettyStatus, statusColorKey } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Chip, EmptyState, Loading, TextField, useToast } from "@/src/ui";

const FILTERS = ["PENDING_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED", "DRAFT"];

export default function AdminFacilities() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({ queryKey: ["admin-facilities", status], queryFn: () => api.get(`/admin/facilities?status=${status}`) });

  const act = useMutation({
    mutationFn: ({ fid, action, body }: { fid: string; action: string; body?: any }) => api.post(`/admin/facilities/${fid}/${action}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-facilities"] }); setRejectFor(null); setReason(""); toast.show("Done", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.title}>Verification</Text>
        <FlatList horizontal data={FILTERS} keyExtractor={(i) => i} showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ height: 56 }}
          renderItem={({ item }) => <Chip label={prettyStatus(item)} selected={status === item} onPress={() => setStatus(item)} testID={`vfilter-${item}`} />} />
      </View>
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={q.data?.items || []}
          keyExtractor={(i: any) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => (
            <View style={s.card} testID={`vfac-${item.id}`}>
              <View style={s.rowBetween}>
                <Text style={s.name}>{item.name}</Text>
                <Badge label={prettyStatus(item.status)} colorKey={statusColorKey(item.status)} />
              </View>
              <Text style={s.meta}>{item.city || "—"} · {item.pitch_count} pitches</Text>
              <Text style={s.owner}>Owner: {item.owner_name} ({item.owner_email})</Text>
              {item.rejection_reason ? <Text style={s.reject}>Reason: {item.rejection_reason}</Text> : null}

              {rejectFor === item.id ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <TextField placeholder="Rejection reason" value={reason} onChangeText={setReason} testID={`reject-reason-${item.id}`} />
                  <View style={s.actions}>
                    <Button title="Confirm reject" variant="danger" onPress={() => act.mutate({ fid: item.id, action: "reject", body: { reason } })} style={{ flex: 1 }} testID={`confirm-reject-${item.id}`} />
                    <Button title="Back" variant="ghost" onPress={() => setRejectFor(null)} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                <View style={s.actions}>
                  {item.status !== "VERIFIED" ? <Button title="Verify" onPress={() => act.mutate({ fid: item.id, action: "verify" })} style={{ flex: 1 }} testID={`verify-${item.id}`} /> : null}
                  {item.status !== "REJECTED" ? <Button title="Reject" variant="secondary" onPress={() => setRejectFor(item.id)} style={{ flex: 1 }} testID={`reject-${item.id}`} /> : null}
                  {item.status === "VERIFIED" ? <Button title="Suspend" variant="danger" onPress={() => act.mutate({ fid: item.id, action: "suspend", body: { reason: "Policy" } })} style={{ flex: 1 }} /> : null}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<EmptyState title="Nothing here" subtitle={`No facilities with status ${prettyStatus(status)}`} testID="vfac-empty" />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.divider },
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600" },
  chips: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: c.border },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600", flex: 1 },
  meta: { color: c.muted, marginTop: 2 },
  owner: { color: c.onSurfaceSecondary, fontSize: fontSize.base, marginTop: spacing.xs },
  reject: { color: c.error, fontSize: fontSize.sm, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
}));
