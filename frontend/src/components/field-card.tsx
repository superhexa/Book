import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { MapPin, SealCheck } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { fileUrl } from "@/src/api";
import { money } from "@/src/format";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Stars } from "@/src/ui";

const FALLBACK = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

export type FacilityLite = {
  id: string;
  name: string;
  city?: string;
  area?: string;
  cover_image?: string;
  rating_avg?: number;
  rating_count?: number;
  status?: string;
  min_price?: number;
  currency?: string;
  pitch_count?: number;
};

export function FieldCard({ facility, testID }: { facility: FacilityLite; testID?: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const img = fileUrl(facility.cover_image) || FALLBACK;
  return (
    <Pressable testID={testID} onPress={() => router.push(`/facility/${facility.id}`)} style={({ pressed }) => [s.card, pressed && { opacity: 0.95 }]}>
      <Image source={{ uri: img }} style={s.image} contentFit="cover" transition={200} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.78)"]} style={s.scrim} />
      {facility.status === "VERIFIED" ? (
        <View style={s.badge}>
          <SealCheck size={14} weight="fill" color="#FFFFFF" />
          <Text style={s.badgeTxt}>Verified</Text>
        </View>
      ) : null}
      <View style={s.ratingPill}>
        <Stars rating={facility.rating_avg || 0} size={12} />
      </View>
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{facility.name}</Text>
        <View style={s.locRow}>
          <MapPin size={13} color="#FFFFFFCC" />
          <Text style={s.loc} numberOfLines={1}>
            {[facility.area, facility.city].filter(Boolean).join(", ") || "Location"}
          </Text>
        </View>
        <View style={s.bottomRow}>
          {facility.min_price ? (
            <Text style={s.price}>
              {money(facility.min_price, facility.currency)} <Text style={s.priceUnit}>/ hr</Text>
            </Text>
          ) : <View />}
          {facility.pitch_count ? <Text style={s.pitches}>{facility.pitch_count} pitches</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { height: 220, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.lg, backgroundColor: c.surfaceSecondary },
  image: { width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 140 },
  badge: { position: "absolute", top: spacing.md, left: spacing.md, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandPrimary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeTxt: { color: "#FFFFFF", fontSize: fontSize.sm, fontWeight: "600" },
  ratingPill: { position: "absolute", top: spacing.md, right: spacing.md, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  info: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  name: { color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "600" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  loc: { color: "#FFFFFFCC", fontSize: fontSize.base },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  price: { color: "#FFFFFF", fontSize: fontSize.lg, fontWeight: "600" },
  priceUnit: { color: "#FFFFFFAA", fontSize: fontSize.sm, fontWeight: "400" },
  pitches: { color: "#FFFFFFCC", fontSize: fontSize.sm },
}));
