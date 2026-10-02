import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  CalendarCheck,
  CurrencyCircleDollar,
  Lightning,
  MapPinLine,
  SealCheck,
  ShieldCheck,
  Star,
} from "phosphor-react-native";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api";
import { FacilityLite } from "@/src/components/field-card";
import { money } from "@/src/format";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";

const HERO = "https://images.unsplash.com/photo-1789476332262-3f9826198129?crop=entropy&cs=srgb&fm=jpg&w=1600&q=85";
const FALLBACK = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80";

export default function Landing() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const facilities = useQuery({ queryKey: ["landing-facilities"], queryFn: () => api.get<{ items: FacilityLite[] }>("/facilities?sort=rating&limit=6", false) });

  const features = [
    { icon: <Lightning size={26} color={colors.brandPrimary} weight="fill" />, title: "Instant booking", body: "Real-time availability. No double bookings, ever. Lock your slot in seconds." },
    { icon: <SealCheck size={26} color={colors.brandPrimary} weight="fill" />, title: "Verified venues", body: "Every field is reviewed and verified by our team before it goes live." },
    { icon: <CurrencyCircleDollar size={26} color={colors.brandPrimary} weight="fill" />, title: "Fair, clear pricing", body: "Transparent peak & weekend rates, with coupons applied before you pay." },
    { icon: <ShieldCheck size={26} color={colors.brandPrimary} weight="fill" />, title: "Flexible cancellation", body: "Owner-set policies with automatic refund calculation. No surprises." },
  ];

  const steps = [
    { n: "01", icon: <MapPinLine size={22} color={colors.onBrandPrimary} />, title: "Discover", body: "Browse top-rated pitches near you by city, price and rating." },
    { n: "02", icon: <CalendarCheck size={22} color={colors.onBrandPrimary} />, title: "Pick a slot", body: "See live availability, choose your time and review the price breakdown." },
    { n: "03", icon: <Star size={22} color={colors.onBrandPrimary} />, title: "Play & review", body: "Show up, play your match, then rate the venue for the community." },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing["3xl"] }}>
        {/* ---------------- HERO ---------------- */}
        <View style={[s.hero, { paddingTop: insets.top + spacing.md, minHeight: isWide ? 620 : 640 }]}>
          <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" />
          <LinearGradient colors={["rgba(23,20,28,0.72)", "rgba(23,20,28,0.86)", "#17141C"]} style={s.heroScrim} />

          <View style={[s.navBar, s.wrap]}>
            <Text style={s.logo}>⚽ TurfBook</Text>
            <View style={s.navRight}>
              <Pressable testID="nav-signin" onPress={() => router.push("/login")} hitSlop={8}>
                <Text style={s.navLink}>Sign in</Text>
              </Pressable>
              <Pressable testID="nav-get-started" onPress={() => router.push("/register")} style={s.navCta}>
                <Text style={s.navCtaTxt}>Get started</Text>
              </Pressable>
            </View>
          </View>

          <View style={[s.heroBody, s.wrap, isWide && { flexDirection: "row", alignItems: "center", gap: spacing["3xl"] }]}>
            <View style={[{ flex: 1 }, isWide && { paddingEnd: spacing["2xl"] }]}>
              <View style={s.pill}>
                <View style={s.pillDot} />
                <Text style={s.pillTxt}>The #1 football pitch marketplace</Text>
              </View>
              <Text style={[s.heroTitle, { fontSize: isWide ? fontSize["4xl"] : 40 }]}>
                Book the pitch.{"\n"}<Text style={{ color: colors.brandPrimary }}>Play the game.</Text>
              </Text>
              <Text style={s.heroSub}>
                Find verified football fields near you, check live availability and secure your slot in seconds — all in one beautiful app.
              </Text>
              <View style={[s.heroCtas, isWide && { justifyContent: "flex-start" }]}>
                <Pressable testID="hero-get-started" onPress={() => router.push("/register")} style={[s.primaryBtn, shadows.brand as any]}>
                  <Text style={s.primaryBtnTxt}>Get started free</Text>
                </Pressable>
                <Pressable testID="hero-explore" onPress={() => router.push("/login")} style={s.ghostBtn}>
                  <Text style={s.ghostBtnTxt}>Sign in</Text>
                </Pressable>
              </View>
              <View style={s.statsRow}>
                <Stat value="500+" label="Verified pitches" />
                <View style={s.statDiv} />
                <Stat value="24/7" label="Instant booking" />
                <View style={s.statDiv} />
                <Stat value="4.9★" label="Avg. rating" />
              </View>
            </View>
            {isWide ? (
              <View style={s.heroCardWrap}>
                <View style={s.floatCard}>
                  <View style={s.floatRow}>
                    <SealCheck size={20} color={colors.brandPrimary} weight="fill" />
                    <Text style={s.floatTitle}>Downtown Turf Arena</Text>
                  </View>
                  <Text style={s.floatMeta}>Marina, Dubai · 5-a-side</Text>
                  <View style={s.floatSlotRow}>
                    {["6:00", "7:00", "8:00"].map((tm, i) => (
                      <View key={tm} style={[s.floatSlot, i === 1 && { backgroundColor: colors.brandPrimary }]}>
                        <Text style={[s.floatSlotTxt, i === 1 && { color: colors.onBrandPrimary }]}>{tm} PM</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.floatConfirm}><Text style={s.floatConfirmTxt}>Booking confirmed ✓</Text></View>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ---------------- FEATURES ---------------- */}
        <View style={[s.section, s.wrap]}>
          <Text style={s.kicker}>WHY TURFBOOK</Text>
          <Text style={s.sectionTitle}>Everything you need to get on the pitch</Text>
          <View style={[s.featureGrid, { flexDirection: isWide ? "row" : "column", flexWrap: "wrap" }]}>
            {features.map((f) => (
              <View key={f.title} style={[s.featureCard, { width: isWide ? "48%" : "100%" }]}>
                <View style={s.featureIcon}>{f.icon}</View>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureBody}>{f.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <View style={[s.section, s.wrap]}>
          <Text style={s.kicker}>HOW IT WORKS</Text>
          <Text style={s.sectionTitle}>Three taps to kickoff</Text>
          <View style={[s.stepsGrid, { flexDirection: isWide ? "row" : "column" }]}>
            {steps.map((st) => (
              <View key={st.n} style={[s.stepCard, { flex: isWide ? 1 : undefined }]}>
                <View style={s.stepIcon}>{st.icon}</View>
                <Text style={s.stepNum}>{st.n}</Text>
                <Text style={s.stepTitle}>{st.title}</Text>
                <Text style={s.stepBody}>{st.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ---------------- TRENDING VENUES ---------------- */}
        {facilities.data?.items?.length ? (
          <View style={[s.section, s.wrap]}>
            <Text style={s.kicker}>TRENDING NOW</Text>
            <Text style={s.sectionTitle}>Popular venues this week</Text>
            <View style={[s.venueGrid, { flexDirection: isWide ? "row" : "column", flexWrap: "wrap" }]}>
              {facilities.data.items.slice(0, isWide ? 6 : 3).map((v) => (
                <Pressable key={v.id} testID={`landing-venue-${v.id}`} onPress={() => router.push(`/facility/${v.id}`)}
                  style={[s.venueCard, { width: isWide ? "32%" : "100%" }]}>
                  <Image source={{ uri: fileUrl(v.cover_image) || FALLBACK }} style={s.venueImg} contentFit="cover" />
                  <LinearGradient colors={["transparent", "rgba(23,20,28,0.85)"]} style={s.venueScrim} />
                  <View style={s.venueInfo}>
                    <Text style={s.venueName} numberOfLines={1}>{v.name}</Text>
                    <Text style={s.venueMeta}>{[v.area, v.city].filter(Boolean).join(", ")}</Text>
                    <View style={s.venueBottom}>
                      <Text style={s.venuePrice}>{v.min_price ? money(v.min_price, v.currency) + " /hr" : "View"}</Text>
                      <View style={s.venueRating}><Star size={12} color={colors.warning} weight="fill" /><Text style={s.venueRatingTxt}>{v.rating_avg ? v.rating_avg.toFixed(1) : "New"}</Text></View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ---------------- FINAL CTA ---------------- */}
        <View style={[s.wrap, { marginTop: spacing["2xl"] }]}>
          <LinearGradient colors={["#17141C", "#FF5436"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaBanner}>
            <Text style={s.ctaTitle}>Ready to play?</Text>
            <Text style={s.ctaSub}>Join thousands of players booking their perfect pitch. It's free to get started.</Text>
            <Pressable testID="cta-join" onPress={() => router.push("/register")} style={[s.primaryBtn, { marginTop: spacing.lg }, shadows.brand as any]}>
              <Text style={s.primaryBtnTxt}>Create your account</Text>
            </Pressable>
            <Pressable testID="cta-owner" onPress={() => router.push("/register")} style={{ marginTop: spacing.md }}>
              <Text style={s.ctaOwner}>Own a field? List it on TurfBook →</Text>
            </Pressable>
          </LinearGradient>
          <Text style={s.footer}>© 2026 TurfBook · Built for the beautiful game</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const s = useStyles();
  return (
    <View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: spacing.lg },
  hero: { backgroundColor: c.surfaceInverse, overflow: "hidden" },
  heroImg: { ...StyleSheetAbsolute(), opacity: 0.9 },
  heroScrim: { ...StyleSheetAbsolute() },
  navBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md },
  logo: { color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "700" },
  navRight: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  navLink: { color: "#FFFFFFDD", fontSize: fontSize.lg, fontWeight: "600" },
  navCta: { backgroundColor: "#FFFFFF", paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  navCtaTxt: { color: "#17141C", fontWeight: "700", fontSize: fontSize.base },
  heroBody: { flex: 1, justifyContent: "center", paddingVertical: spacing["2xl"] },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.brandPrimary },
  pillTxt: { color: "#FFFFFFEE", fontSize: fontSize.sm, fontWeight: "600" },
  heroTitle: { color: "#FFFFFF", fontWeight: "800", marginTop: spacing.lg, lineHeight: 52, letterSpacing: -1 },
  heroSub: { color: "#FFFFFFBB", fontSize: fontSize.lg, lineHeight: 26, marginTop: spacing.md, maxWidth: 520 },
  heroCtas: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, flexWrap: "wrap" },
  primaryBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: spacing.xl, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  primaryBtnTxt: { color: c.onBrandPrimary, fontSize: fontSize.lg, fontWeight: "700" },
  ghostBtn: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", paddingHorizontal: spacing.xl, height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  ghostBtnTxt: { color: "#FFFFFF", fontSize: fontSize.lg, fontWeight: "700" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing["2xl"] },
  statValue: { color: "#FFFFFF", fontSize: fontSize["2xl"], fontWeight: "800" },
  statLabel: { color: "#FFFFFF99", fontSize: fontSize.sm, marginTop: 2 },
  statDiv: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.18)" },
  heroCardWrap: { width: 360, alignItems: "center" },
  floatCard: { width: 320, backgroundColor: "#FFFFFF", borderRadius: radius.lg, padding: spacing.lg, ...(shadows.md as any) },
  floatRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  floatTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  floatMeta: { color: c.muted, fontSize: fontSize.base, marginTop: 2 },
  floatSlotRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  floatSlot: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: c.surfaceTertiary, alignItems: "center" },
  floatSlotTxt: { color: c.onSurfaceTertiary, fontWeight: "600", fontSize: fontSize.sm },
  floatConfirm: { marginTop: spacing.md, backgroundColor: c.brandTertiary, borderRadius: radius.sm, paddingVertical: 10, alignItems: "center" },
  floatConfirmTxt: { color: c.onBrandTertiary, fontWeight: "700" },

  section: { marginTop: spacing["3xl"] },
  kicker: { color: c.brandPrimary, fontSize: fontSize.sm, fontWeight: "800", letterSpacing: 1.5 },
  sectionTitle: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "800", marginTop: spacing.xs, letterSpacing: -0.5, maxWidth: 560 },
  featureGrid: { gap: spacing.md, marginTop: spacing.xl, justifyContent: "space-between" },
  featureCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: c.border, marginBottom: spacing.md },
  featureIcon: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  featureTitle: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "700" },
  featureBody: { color: c.muted, fontSize: fontSize.base, lineHeight: 22, marginTop: spacing.xs },

  stepsGrid: { gap: spacing.md, marginTop: spacing.xl },
  stepCard: { backgroundColor: c.surfaceInverse, borderRadius: radius.lg, padding: spacing.xl, overflow: "hidden" },
  stepIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNum: { color: "rgba(255,255,255,0.25)", fontSize: fontSize["3xl"], fontWeight: "800", marginTop: spacing.md },
  stepTitle: { color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "700", marginTop: spacing.xs },
  stepBody: { color: "#FFFFFFAA", fontSize: fontSize.base, lineHeight: 22, marginTop: spacing.xs },

  venueGrid: { gap: spacing.md, marginTop: spacing.xl, justifyContent: "space-between" },
  venueCard: { height: 220, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md, backgroundColor: c.surfaceSecondary },
  venueImg: { ...StyleSheetAbsolute() },
  venueScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 140 },
  venueInfo: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  venueName: { color: "#FFFFFF", fontSize: fontSize.xl, fontWeight: "700" },
  venueMeta: { color: "#FFFFFFCC", fontSize: fontSize.base },
  venueBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  venuePrice: { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.lg },
  venueRating: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  venueRatingTxt: { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.sm },

  ctaBanner: { borderRadius: radius.xl, padding: spacing["2xl"], alignItems: "center" },
  ctaTitle: { color: "#FFFFFF", fontSize: fontSize["3xl"], fontWeight: "800", letterSpacing: -0.5 },
  ctaSub: { color: "#FFFFFFCC", fontSize: fontSize.lg, textAlign: "center", marginTop: spacing.sm, maxWidth: 440 },
  ctaOwner: { color: "#FFFFFFEE", fontWeight: "600", fontSize: fontSize.base },
  footer: { color: c.muted, textAlign: "center", marginTop: spacing["2xl"], fontSize: fontSize.base },
}));

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0, width: "100%" as const, height: "100%" as const };
}
