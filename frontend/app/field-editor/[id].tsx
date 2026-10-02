import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Camera, Plus, Trash } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError, fileUrl } from "@/src/api";
import { money, prettyStatus, statusColorKey } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Chip, TextField, useToast } from "@/src/ui";
import { pickImage, uploadAsset } from "@/src/upload";

const AMENITIES = ["parking", "changing_rooms", "showers", "bathrooms", "seating", "cafeteria", "wifi", "lighting", "equipment_rental", "ball_rental", "referee", "first_aid"];

export default function FieldEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({ name: "", description: "", city: "", area: "", address: "", contact_phone: "", field_type: "outdoor", currency: "USD", amenities: [], cover_image: null });
  const [uploading, setUploading] = useState(false);

  const facility = useQuery({ queryKey: ["facility-edit", id], enabled: !isNew, queryFn: () => api.get(`/facilities/${id}`) });

  useEffect(() => {
    if (facility.data) setForm({ ...facility.data });
  }, [facility.data]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleAmenity = (a: string) => set("amenities", form.amenities?.includes(a) ? form.amenities.filter((x: string) => x !== a) : [...(form.amenities || []), a]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, description: form.description, city: form.city, area: form.area, address: form.address, contact_phone: form.contact_phone, field_type: form.field_type, currency: form.currency, amenities: form.amenities, cover_image: form.cover_image, gallery: form.gallery || [] };
      if (isNew) return api.post("/facilities", payload);
      return api.patch(`/facilities/${id}`, payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-facilities"] });
      toast.show("Saved", "success");
      if (isNew) router.replace(`/field-editor/${res.id}`);
    },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Save failed", "error"),
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/facilities/${id}/submit`),
    onSuccess: () => { facility.refetch(); qc.invalidateQueries({ queryKey: ["my-facilities"] }); toast.show("Submitted for review", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const uploadCover = async () => {
    const asset = await pickImage();
    if (!asset) { toast.show("Permission needed to pick images", "info"); return; }
    setUploading(true);
    try {
      const res = await uploadAsset(asset);
      set("cover_image", res.path);
      if (!isNew) await api.patch(`/facilities/${id}`, { cover_image: res.path });
      toast.show("Image uploaded", "success");
    } catch { toast.show("Upload failed", "error"); }
    finally { setUploading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="editor-back" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.onSurface} /></Pressable>
        <Text style={s.title}>{isNew ? "New Facility" : form.name || "Edit Facility"}</Text>
        {!isNew && form.status ? <Badge label={prettyStatus(form.status)} colorKey={statusColorKey(form.status)} /> : null}
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.md }} bottomOffset={24} showsVerticalScrollIndicator={false}>
        <Pressable testID="upload-cover" onPress={uploadCover} style={s.cover}>
          {form.cover_image ? <Image source={{ uri: fileUrl(form.cover_image) }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
          <View style={s.coverOverlay}>
            <Camera size={24} color="#FFF" />
            <Text style={s.coverTxt}>{uploading ? "Uploading..." : "Cover image"}</Text>
          </View>
        </Pressable>

        <TextField label="Facility name" value={form.name} onChangeText={(v) => set("name", v)} testID="facility-name" />
        <TextField label="Description" value={form.description} onChangeText={(v) => set("description", v)} multiline testID="facility-desc" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><TextField label="City" value={form.city} onChangeText={(v) => set("city", v)} testID="facility-city" /></View>
          <View style={{ flex: 1 }}><TextField label="Area" value={form.area} onChangeText={(v) => set("area", v)} testID="facility-area" /></View>
        </View>
        <TextField label="Address" value={form.address} onChangeText={(v) => set("address", v)} testID="facility-address" />
        <TextField label="Contact phone" value={form.contact_phone} onChangeText={(v) => set("contact_phone", v)} keyboardType="phone-pad" />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><TextField label="Currency" value={form.currency} onChangeText={(v) => set("currency", v)} autoCapitalize="characters" /></View>
        </View>

        <Text style={s.label}>Field type</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {["outdoor", "indoor"].map((ft) => <Chip key={ft} label={ft} selected={form.field_type === ft} onPress={() => set("field_type", ft)} />)}
        </View>

        <Text style={s.label}>Amenities</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {AMENITIES.map((a) => <Chip key={a} label={a.replace(/_/g, " ")} selected={form.amenities?.includes(a)} onPress={() => toggleAmenity(a)} />)}
        </View>

        <Button title="Save facility" onPress={() => save.mutate()} loading={save.isPending} testID="save-facility" />

        {!isNew ? <PitchManager facilityId={id!} currency={form.currency} /> : null}

        {!isNew && form.status && ["DRAFT", "REJECTED"].includes(form.status) ? (
          <Button title="Submit for review" variant="secondary" onPress={() => submit.mutate()} loading={submit.isPending} testID="submit-review" />
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function PitchManager({ facilityId, currency }: { facilityId: string; currency: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [p, setP] = useState<any>({ name: "", field_size: "5-a-side", grass_type: "Artificial Turf", indoor: false, slot_duration: 60, base_hourly: "100", weekend_multiplier: "1.25" });

  const pitches = useQuery({ queryKey: ["facility-edit", facilityId] });
  const list = (pitches.data as any)?.pitches || [];

  const addPitch = useMutation({
    mutationFn: () => {
      const weekly: any = {};
      for (let d = 0; d < 7; d++) weekly[String(d)] = { closed: false, open_min: 360, close_min: 1380 };
      return api.post(`/facilities/${facilityId}/pitches`, {
        name: p.name, field_size: p.field_size, grass_type: p.grass_type, indoor: p.indoor, slot_duration: Number(p.slot_duration) || 60,
        pricing: { base_hourly: Number(p.base_hourly) || 0, weekend_multiplier: Number(p.weekend_multiplier) || 1, peak_hours: [], special_dates: {} },
        schedule: { weekly, closed_dates: [] },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["facility-edit", facilityId] }); setShowForm(false); setP({ ...p, name: "" }); toast.show("Pitch added", "success"); },
    onError: (e) => toast.show(e instanceof ApiError ? e.message : "Failed", "error"),
  });

  const delPitch = useMutation({
    mutationFn: (pid: string) => api.del(`/pitches/${pid}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["facility-edit", facilityId] }); toast.show("Pitch removed", "success"); },
  });

  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.sectionTitle}>Pitches ({list.length})</Text>
        <Pressable testID="add-pitch" onPress={() => setShowForm((v) => !v)} style={s.addPitchBtn}>
          <Plus size={16} color={colors.onBrandPrimary} weight="bold" />
        </Pressable>
      </View>

      {list.map((pt: any) => (
        <View key={pt.id} style={s.pitchItem} testID={`pitch-item-${pt.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={s.pitchName}>{pt.name}</Text>
            <Text style={s.pitchMeta}>{pt.field_size} · {money(pt.pricing?.base_hourly || 0, currency)}/hr · {pt.slot_duration}min slots</Text>
          </View>
          <Pressable testID={`del-pitch-${pt.id}`} onPress={() => delPitch.mutate(pt.id)} style={s.delBtn}><Trash size={18} color={colors.error} /></Pressable>
        </View>
      ))}

      {showForm ? (
        <View style={s.pitchForm}>
          <TextField label="Pitch name" value={p.name} onChangeText={(v) => setP({ ...p, name: v })} testID="pitch-name-input" />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><TextField label="Field size" value={p.field_size} onChangeText={(v) => setP({ ...p, field_size: v })} /></View>
            <View style={{ flex: 1 }}><TextField label="Grass type" value={p.grass_type} onChangeText={(v) => setP({ ...p, grass_type: v })} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><TextField label="Base price / hr" value={String(p.base_hourly)} onChangeText={(v) => setP({ ...p, base_hourly: v })} keyboardType="numeric" testID="pitch-price-input" /></View>
            <View style={{ flex: 1 }}><TextField label="Weekend x" value={String(p.weekend_multiplier)} onChangeText={(v) => setP({ ...p, weekend_multiplier: v })} keyboardType="numeric" /></View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
            <View style={{ flex: 1 }}><TextField label="Slot minutes" value={String(p.slot_duration)} onChangeText={(v) => setP({ ...p, slot_duration: v })} keyboardType="numeric" /></View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg }}>
              <Text style={{ color: colors.onSurface }}>Indoor</Text>
              <Switch value={p.indoor} onValueChange={(v) => setP({ ...p, indoor: v })} trackColor={{ true: colors.brandPrimary }} />
            </View>
          </View>
          <Button title="Add pitch" onPress={() => addPitch.mutate()} loading={addPitch.isPending} testID="save-pitch" />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  title: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600", flex: 1 },
  cover: { height: 160, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  coverOverlay: { position: "absolute", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.35)", padding: spacing.md, borderRadius: radius.md },
  coverTxt: { color: "#FFF", fontWeight: "600" },
  label: { color: c.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: "500" },
  sectionTitle: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600" },
  addPitchBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  pitchItem: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: c.border },
  pitchName: { color: c.onSurface, fontWeight: "600", fontSize: fontSize.lg },
  pitchMeta: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  delBtn: { padding: spacing.sm },
  pitchForm: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, gap: spacing.md, borderWidth: 1, borderColor: c.border },
}));
