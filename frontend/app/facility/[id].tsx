import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Heart,
  MapPin,
  SealCheck,
  Star,
} from "phosphor-react-native";
import { useState } from "react";
import { Dimensions, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api";
import { useAuth } from "@/src/auth";
import { money } from "@/src/format";
import { useI18n } from "@/src/preferences";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Loading, Stars, useToast } from "@/src/ui";

const { width } = Dimensions.get("window");
const FALLBACK = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

const AMENITY_LABELS: Record<string, string> = {
  parking: "Parking", changing_rooms: "Changing Rooms", showers: "Showers", bathrooms: "Bathrooms",
  seating: "Seating", cafeteria: "Cafeteria", wifi: "Wi-Fi", lighting: "Floodlights",
  equipment_rental: "Equipment", ball_rental: "Ball Rental", referee: "Referee", first_aid: "First Aid",
};

export default function FacilityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [heroIdx, setHeroIdx] = useState(0);

  const q = useQuery({ queryKey: ["facility", id], queryFn: () => api.get(`/facilities/${id}`, false) });
  const reviews = useQuery({ queryKey: ["reviews", id], queryFn: () => api.get(`/facilities/${id}/reviews`, false) });
  const favs = useQuery({ queryKey: ["favorites"], queryFn: () => api.get("/favorites"), enabled: !!user });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Loading /></View>;

  const f = q.data;
  const gallery: string[] = [f.cover_image, ...(f.gallery || [])].filter(Boolean);
  const images = gallery.length ? gallery.map((g: string) => fileUrl(g) || g) : [FALLBACK];
  const isFav = (favs.data || []).some((x: any) => x.id === id);
  const minPrice = Math.min(...(f.pitches || []).map((p: any) => p.pricing?.base_hourly || 0).filter((n: number) => n > 0), Infinity);

  const toggleFav = async () => {
    if (!user) return router.push("/login");
    try {
      await api.post(`/favorites/${id}`);
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast.show(isFav ? "Removed from favorites" : "Added to favorites", "success");
    } catch { toast.show("Failed", "error"); }
  };

  const book = (pitchId: string) => {
    if (!user) return router.push("/login");
    router.push(`/book/${pitchId}`);
  };

  const openMap = () => {
    if (f.latitude && f.longitude) Linking.openURL(`https://maps.google.com/?q=${f.latitude},${f.longitude}`);
    else if (f.address) Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(f.address + " " + f.city)}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={s.hero}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setHeroIdx(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {images.map((uri, i) => <Image key={i} source={{ uri }} style={{ width, height: 320 }} contentFit="cover" />)}
          </ScrollView>
          <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", "transparent"]} style={s.topScrim} pointerEvents="none" />
          <Pressable testID="back-button" onPress={() => router.back()} style={[s.circleBtn, { top: insets.top + 8, left: spacing.lg }]}>
            <ArrowLeft size={20} color="#FFF" />
          </Pressable>
          <Pressable testID="fav-button" onPress={toggleFav} style={[s.circleBtn, { top: insets.top + 8, right: spacing.lg }]}>
            <Heart size={20} color="#FFF" weight={isFav ? "fill" : "regular"} />
          </Pressable>
          {images.length > 1 ? (
            <View style={s.dots}>
              {images.map((_, i) => <View key={i} style={[s.dotItem, i === heroIdx && { backgroundColor: "#FFF", width: 18 }]} />)}
            </View>
          ) : null}
        </View>

        <View style={s.body}>
          <View style={s.titleRow}>
            <Text style={s.name}>{f.name}</Text>
            {f.status === "VERIFIED" ? <SealCheck size={22} color={colors.brandPrimary} weight="fill" /> : null}
          </View>
          <View style={s.metaRow}>
            <Stars rating={f.rating_avg} size={15} />
            <Text style={s.metaMuted}>({f.rating_count} reviews)</Text>
          </View>
          <Pressable style={s.locRow} onPress={openMap}>
            <MapPin size={16} color={colors.brandPrimary} />
            <Text style={s.loc}>{[f.address, f.area, f.city].filter(Boolean).join(", ")}</Text>
          </Pressable>

          {f.description ? <Text style={s.desc}>{f.description}</Text> : null}

          {/* Map snippet */}
          <Pressable style={s.mapSnippet} onPress={openMap} testID="open-map">
            <MapPin size={28} color={colors.brandPrimary} weight="fill" />
            <Text style={s.mapTxt}>View on map</Text>
          </Pressable>

          {/* Amenities */}
          {(f.amenities || []).length ? (
            <>
              <Text style={s.section}>Amenities</Text>
              <View style={s.amenities}>
                {f.amenities.map((a: string) => (
                  <View key={a} style={s.amenity}>
                    <Text style={s.amenityTxt}>{AMENITY_LABELS[a] || a}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Pitches */}
          <Text style={s.section}>Pitches</Text>
          {(f.pitches || []).map((p: any) => (
            <View key={p.id} style={s.pitchCard} testID={`pitch-${p.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.pitchName}>{p.name}</Text>
                <Text style={s.pitchMeta}>{p.field_size} · {p.grass_type} · {p.indoor ? "Indoor" : "Outdoor"}</Text>
                <Text style={s.pitchPrice}>{money(p.pricing?.base_hourly || 0, f.currency)} <Text style={s.pitchUnit}>/ hr</Text></Text>
              </View>
              <Button title={t("bookNow")} onPress={() => book(p.id)} testID={`book-pitch-${p.id}`} style={{ height: 44, paddingHorizontal: spacing.lg }} />
            </View>
          ))}

          {/* Rules */}
          {(f.rules || []).length ? (
            <>
              <Text style={s.section}>Rules</Text>
              {f.rules.map((r: string, i: number) => <Text key={i} style={s.rule}>• {r}</Text>)}
            </>
          ) : null}

          {/* Cancellation policy */}
          <Text style={s.section}>Cancellation policy</Text>
          <Text style={s.rule}>Free cancellation up to {f.cancellation_policy?.free_cancellation_hours ?? 24}h before. {f.cancellation_policy?.partial_refund_percent ?? 50}% refund up to {f.cancellation_policy?.partial_refund_hours ?? 6}h before.</Text>

          {/* Reviews */}
          <Text style={s.section}>Reviews</Text>
          {(reviews.data || []).length === 0 ? (
            <Text style={s.metaMuted}>No reviews yet.</Text>
          ) : (
            (reviews.data || []).slice(0, 10).map((rv: any) => (
              <View key={rv.id} style={s.reviewCard}>
                <View style={s.reviewHead}>
                  <Text style={s.reviewer}>{rv.customer_name}</Text>
                  <View style={{ flexDirection: "row" }}>
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} weight={n <= rv.rating ? "fill" : "regular"} color={colors.warning} />)}
                  </View>
                </View>
                {rv.comment ? <Text style={s.reviewTxt}>{rv.comment}</Text> : null}
                {rv.owner_response ? <View style={s.ownerResp}><Text style={s.ownerRespLabel}>Owner replied</Text><Text style={s.reviewTxt}>{rv.owner_response}</Text></View> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View>
          <Text style={s.barFrom}>From</Text>
          <Text style={s.barPrice}>{minPrice === Infinity ? "—" : money(minPrice, f.currency)} <Text style={s.barUnit}>/ hr</Text></Text>
        </View>
        <Button title={t("bookNow")} testID="book-now-sticky" onPress={() => f.pitches?.[0] && book(f.pitches[0].id)} disabled={!f.pitches?.length} style={{ flex: 1, marginLeft: spacing.lg }} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { height: 320 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  circleBtn: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: spacing.md, alignSelf: "center", flexDirection: "row", gap: 6 },
  dotItem: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  body: { padding: spacing.lg, gap: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600", flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  metaMuted: { color: c.muted, fontSize: fontSize.base },
  locRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  loc: { color: c.onSurfaceSecondary, fontSize: fontSize.base, flexShrink: 1 },
  desc: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 21, marginTop: spacing.md },
  mapSnippet: { height: 90, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", gap: 4, marginTop: spacing.md, flexDirection: "row" },
  mapTxt: { color: c.brandPrimary, fontWeight: "600" },
  section: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "600", marginTop: spacing.xl, marginBottom: spacing.xs },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  amenity: { backgroundColor: c.brandTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  amenityTxt: { color: c.onBrandTertiary, fontSize: fontSize.base, fontWeight: "500" },
  pitchCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: c.border, gap: spacing.md },
  pitchName: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  pitchMeta: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  pitchPrice: { color: c.brandPrimary, fontSize: fontSize.lg, fontWeight: "700", marginTop: spacing.xs },
  pitchUnit: { color: c.muted, fontSize: fontSize.sm, fontWeight: "400" },
  rule: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22 },
  reviewCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: c.border },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewer: { color: c.onSurface, fontWeight: "600" },
  reviewTxt: { color: c.onSurfaceSecondary, marginTop: 4, lineHeight: 20 },
  ownerResp: { marginTop: spacing.sm, paddingStart: spacing.md, borderLeftWidth: 2, borderLeftColor: c.brandPrimary },
  ownerRespLabel: { color: c.brandPrimary, fontSize: fontSize.sm, fontWeight: "600" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  barFrom: { color: c.muted, fontSize: fontSize.sm },
  barPrice: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "700" },
  barUnit: { color: c.muted, fontSize: fontSize.sm, fontWeight: "400" },
}));
