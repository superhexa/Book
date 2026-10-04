// Book — Arabic-first marketing landing (ar-JO, RTL).
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  CalendarCheck,
  CurrencyCircleDollar,
  Lightning,
  MapPin,
  Play,
  SealCheck,
  ShieldCheck,
  SoccerBall,
  Star,
  Trophy,
} from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api";
import { FacilityLite } from "@/src/components/field-card";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";
import { jod } from "@/src/components/panels";

const HERO =
  "https://images.unsplash.com/photo-1522778119026-d647f0596c20?crop=entropy&cs=srgb&fm=jpg&w=1800&q=85";
const LEAGUE_IMG =
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";
const FALLBACK =
  "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1000&q=80";

const CITIES = ["عمّان", "إربد", "الزرقاء", "العقبة"];

export default function Landing() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [city, setCity] = useState("");

  const facilities = useQuery({
    queryKey: ["landing-facilities"],
    queryFn: () => api.get<{ items: FacilityLite[] }>("/facilities?sort=rating&limit=6", false),
  });

  const goSearch = () =>
    router.push(city ? `/fields?city=${encodeURIComponent(city)}` : "/fields");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* ================= HERO ================= */}
        <View style={[s.hero, { paddingTop: insets.top, minHeight: isWide ? 680 : 600 }]}>
          <Image source={{ uri: HERO }} style={s.heroImg} contentFit="cover" />
          <LinearGradient
            colors={["rgba(10,42,32,0.55)", "rgba(12,20,17,0.82)", "#0C1411"]}
            style={s.heroScrim}
          />

          {/* nav */}
          <View style={[s.navBar, s.wrap]}>
            <Pressable onPress={() => router.push("/landing")} style={s.logoRow}>
              <View style={s.logoBall}>
                <SoccerBall size={22} color={colors.brand} weight="fill" />
              </View>
              <Text style={s.logoTxt}>Book</Text>
            </Pressable>
            <View style={s.navLinks}>
              {isWide ? (
                <>
                  <Pressable onPress={() => router.push("/fields")}><Text style={s.navLink}>الملاعب</Text></Pressable>
                  <Pressable onPress={() => router.push("/leagues")}><Text style={s.navLink}>الدوريات</Text></Pressable>
                  <Pressable onPress={() => router.push("/teams")}><Text style={s.navLink}>الفرق</Text></Pressable>
                </>
              ) : null}
              <Pressable onPress={() => router.push("/login")}>
                <Text style={s.navLink}>دخول</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/register")} style={[s.navCta, shadows.brand as any]}>
                <Text style={s.navCtaTxt}>ابدأ مجاناً</Text>
              </Pressable>
            </View>
          </View>

          {/* hero body */}
          <View style={[s.heroBody, s.wrap]}>
            <View style={s.pill}>
              <View style={s.pillDot} />
              <Text style={s.pillTxt}>منصة كرة القدم الأولى في الأردن</Text>
            </View>
            <Text style={[s.heroTitle, isWide && { fontSize: fontSize["5xl"] }]}>
              احجز ملعبك.{"\n"}
              <Text style={{ color: colors.volt }}>العب لعبتك.</Text>
            </Text>
            <Text style={s.heroSub}>
              اكتشف أفضل ملاعب كرة القدم في الأردن، تحقق من التوفر المباشر، واحجز مكانك
              في ثوانٍ — كل ذلك من مكان واحد.
            </Text>

            {/* search */}
            <View style={[s.searchBar, !isWide && { flexDirection: "column", alignItems: "stretch" }]}>
              <View style={s.searchField}>
                <MapPin size={20} color={colors.muted} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    <Pressable onPress={() => setCity("")} style={[s.cityChip, !city && s.cityChipActive]}>
                      <Text style={[s.cityTxt, !city && s.cityTxtActive]}>كل المدن</Text>
                    </Pressable>
                    {CITIES.map((c) => (
                      <Pressable key={c} onPress={() => setCity(city === c ? "" : c)}
                        style={[s.cityChip, city === c && s.cityChipActive]}>
                        <Text style={[s.cityTxt, city === c && s.cityTxtActive]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <Pressable onPress={goSearch} style={[s.searchBtn, shadows.brand as any]}>
                <Text style={s.searchBtnTxt}>ابحث عن ملعب</Text>
                <ArrowLeft size={18} color={colors.onBrandPrimary} weight="bold" />
              </Pressable>
            </View>

            <View style={s.statsRow}>
              <Stat value="٥٠٠+" label="ملعب موثّق" />
              <View style={s.statDiv} />
              <Stat value="١٢" label="محافظة" />
              <View style={s.statDiv} />
              <Stat value="٤.٩" label="متوسط التقييم" />
            </View>
          </View>
        </View>

        {/* ================= FEATURES ================= */}
        <View style={[s.section, s.wrap]}>
          <Text style={s.kicker}>لماذا Book</Text>
          <Text style={s.sectionTitle}>كل ما تحتاجه للنزول إلى الملعب</Text>
          <View style={[s.grid, isWide && s.grid2]}>
            <Feature
              icon={<Lightning size={26} color={colors.pine} weight="fill" />}
              title="حجز فوري"
              body="توفر مباشر لحظة بلحظة. بدون حجوزات مزدوجة أبداً — ثبّت مكانك في ثوانٍ."
            />
            <Feature
              icon={<SealCheck size={26} color={colors.pine} weight="fill" />}
              title="ملاعب موثّقة"
              body="كل ملعب تتم مراجعته واعتماده من فريقنا قبل ظهوره على المنصة."
            />
            <Feature
              icon={<CurrencyCircleDollar size={26} color={colors.pine} weight="fill" />}
              title="أسعار واضحة بالدينار"
              body="أسعار الذروة وعطلة نهاية الأسبوع بشفافية كاملة، مع الخصومات قبل الدفع."
            />
            <Feature
              icon={<ShieldCheck size={26} color={colors.pine} weight="fill" />}
              title="إلغاء مرن"
              body="سياسات إلغاء يحددها المالك مع حساب تلقائي للمبالغ المستردة."
            />
          </View>
        </View>

        {/* ================= HOW IT WORKS ================= */}
        <View style={s.sectionAlt}>
          <View style={s.wrap}>
            <Text style={s.kicker}>كيف نعمل</Text>
            <Text style={s.sectionTitle}>ثلاث خطوات لصافرة البداية</Text>
            <View style={[s.grid, isWide && s.grid3]}>
              <Step n="٠١" title="اكتشف" body="تصفح أفضل الملاعب القريبة منك حسب المدينة والسعر والتقييم." />
              <Step n="٠٢" title="اختر وقتك" body="شاهد التوفر المباشر، اختر وقتك، وراجع تفاصيل السعر." />
              <Step n="٠٣" title="العب وقيّم" body="احضر مباراتك، استمتع، ثم قيّم الملعب لمساعدة المجتمع." />
            </View>
          </View>
        </View>

        {/* ================= TRENDING ================= */}
        {facilities.data?.items?.length ? (
          <View style={[s.section, s.wrap]}>
            <View style={s.sectionHead}>
              <View>
                <Text style={s.kicker}>الأكثر رواجاً</Text>
                <Text style={s.sectionTitle}>ملاعب يعشقها اللاعبون</Text>
              </View>
              <Pressable onPress={() => router.push("/fields")}>
                <Text style={s.seeAll}>عرض الكل ←</Text>
              </Pressable>
            </View>
            <View style={[s.grid, isWide && s.grid3]}>
              {facilities.data.items.slice(0, isWide ? 6 : 3).map((v) => (
                <Pressable key={v.id} onPress={() => router.push(`/facility/${v.id}`)} style={s.venueCard}>
                  <Image source={{ uri: fileUrl(v.cover_image) || FALLBACK }} style={s.venueImg} contentFit="cover" />
                  <LinearGradient colors={["transparent", "rgba(12,20,17,0.88)"]} style={s.venueScrim} />
                  <View style={s.venueInfo}>
                    <View style={s.venueRating}>
                      <Star size={12} color={colors.volt} weight="fill" />
                      <Text style={s.venueRatingTxt}>{v.rating_avg ? v.rating_avg.toFixed(1) : "جديد"}</Text>
                    </View>
                    <Text style={s.venueName} numberOfLines={1}>{v.name}</Text>
                    <Text style={s.venueMeta}>{[v.area, v.city].filter(Boolean).join("، ")}</Text>
                    <Text style={s.venuePrice}>{v.min_price ? `${jod(v.min_price)} / ساعة` : "عرض"}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ================= LEAGUES ================= */}
        <View style={s.darkSection}>
          <Image source={{ uri: LEAGUE_IMG }} style={s.darkImg} contentFit="cover" />
          <LinearGradient colors={["rgba(12,20,17,0.9)", "rgba(14,59,44,0.88)"]} style={s.heroScrim} />
          <View style={[s.wrap, s.darkBody, isWide && { flexDirection: "row", alignItems: "center" }]}>
            <View style={{ flex: 1 }}>
              <View style={[s.pill, { backgroundColor: "rgba(185,236,46,0.14)" }]}>
                <Trophy size={16} color={colors.volt} weight="fill" />
                <Text style={[s.pillTxt, { color: colors.volt }]}>دوريات Book</Text>
              </View>
              <Text style={s.darkTitle}>انضم إلى دوري.{"\n"}اصنع مجدك.</Text>
              <Text style={s.darkSub}>
                دوريات منظمة للهواة والمحترفين في جميع أنحاء الأردن — جداول تلقائية،
                ترتيب مباشر، وإحصائيات لاعبين.
              </Text>
              <Pressable onPress={() => router.push("/leagues")} style={[s.voltBtn, shadows.glow as any]}>
                <Text style={s.voltBtnTxt}>استكشف الدوريات</Text>
              </Pressable>
            </View>
            {isWide ? (
              <View style={s.leagueCard}>
                <View style={s.leagueRow}>
                  <Text style={s.leagueTeam}>الوحدات</Text>
                  <Text style={s.leagueScore}>٢ - ١</Text>
                  <Text style={s.leagueTeam}>الفيصلي</Text>
                </View>
                <View style={s.leagueDiv} />
                <View style={s.leagueRow}>
                  <Text style={s.leagueTeam}>الرمثا</Text>
                  <Text style={s.leagueScore}>٣ - ٣</Text>
                  <Text style={s.leagueTeam}>الحسين</Text>
                </View>
                <Text style={s.leagueLive}>● مباشر الآن</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ================= TESTIMONIALS ================= */}
        <View style={[s.section, s.wrap]}>
          <Text style={s.kicker}>آراء اللاعبين</Text>
          <Text style={s.sectionTitle}>ماذا يقول مجتمعنا</Text>
          <View style={[s.grid, isWide && s.grid3]}>
            <Quote name="أحمد من عمّان" text="حجزت ملعباً ليلة المباراة في دقيقتين. التوفر المباشر غيّر طريقة لعبنا تماماً." />
            <Quote name="سارة من إربد" text="أخيراً منصة أردنية بالعربية! الأسعار واضحة والحجز سهل حتى من الهاتف." />
            <Quote name="محمد، مالك ملعب" text="زادت حجوزاتي ٤٠٪ منذ انضمامي. لوحة التحكم سهلة وإدارة الأوقات ممتازة." />
          </View>
        </View>

        {/* ================= FINAL CTA ================= */}
        <View style={[s.wrap, { paddingBottom: spacing["3xl"] }]}>
          <LinearGradient colors={["#0E3B2C", "#0C1411"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaBanner}>
            <View style={s.ctaVoltBar} />
            <Text style={s.ctaTitle}>جاهز للعب؟</Text>
            <Text style={s.ctaSub}>انضم إلى آلاف اللاعبين الذين يحجزون ملاعبهم عبر Book. التسجيل مجاني.</Text>
            <View style={[s.ctaRow, !isWide && { flexDirection: "column", alignItems: "stretch" }]}>
              <Pressable onPress={() => router.push("/register")} style={[s.voltBtn, shadows.glow as any]}>
                <Text style={s.voltBtnTxt}>أنشئ حسابك مجاناً</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/register")}>
                <Text style={s.ctaOwner}>تملك ملعباً؟ اعرضه على Book ←</Text>
              </Pressable>
            </View>
          </LinearGradient>
          <Footer />
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const s = useStyles();
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  const s = useStyles();
  return (
    <View style={s.featureCard}>
      <View style={s.featureIcon}>{icon}</View>
      <Text style={s.featureTitle}>{title}</Text>
      <Text style={s.featureBody}>{body}</Text>
    </View>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.stepCard}>
      <View style={s.stepTop}>
        <View style={[s.stepIcon, { backgroundColor: colors.pine }]}>
          <Play size={18} color={colors.volt} weight="fill" />
        </View>
        <Text style={s.stepNum}>{n}</Text>
      </View>
      <Text style={s.stepTitle}>{title}</Text>
      <Text style={s.stepBody}>{body}</Text>
    </View>
  );
}

function Quote({ name, text }: { name: string; text: string }) {
  const s = useStyles();
  return (
    <View style={s.quoteCard}>
      <View style={s.quoteStars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={14} color="#E8A500" weight="fill" />
        ))}
      </View>
      <Text style={s.quoteText}>"{text}"</Text>
      <Text style={s.quoteName}>— {name}</Text>
    </View>
  );
}

function Footer() {
  const s = useStyles();
  const { colors } = useTheme();
  const cols = [
    { h: "المنصة", links: [["الملاعب", "/fields"], ["الدوريات", "/leagues"], ["الفرق", "/teams"], ["المباريات", "/matches"]] },
    { h: "الشركة", links: [["من نحن", "/about"], ["اتصل بنا", "/contact"], ["الأسئلة الشائعة", "/faq"]] },
    { h: "قانوني", links: [["الشروط والأحكام", "/terms"], ["سياسة الخصوصية", "/privacy"]] },
  ];
  return (
    <View style={s.footer}>
      <View style={s.footerTop}>
        <View>
          <View style={s.logoRow}>
            <View style={s.logoBall}>
              <SoccerBall size={20} color={colors.brand} weight="fill" />
            </View>
            <Text style={[s.logoTxt, { color: colors.onSurface }]}>Book</Text>
          </View>
          <Text style={s.footerTag}>منصة كرة القدم الأولى في الأردن</Text>
        </View>
        <View style={s.footerCols}>
          {cols.map((c) => (
            <View key={c.h} style={s.footerCol}>
              <Text style={s.footerHead}>{c.h}</Text>
              {c.links.map(([label, href]) => (
                <Pressable key={href} onPress={() => router.push(href as any)}>
                  <Text style={s.footerLink}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>
      <Text style={s.footerCopy}>© 2026 Book · صُنع بشغف لكرة القدم الأردنية</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { width: "100%", maxWidth: 1200, alignSelf: "center", paddingHorizontal: spacing.xl },
  wrapFull: { width: "100%" },

  /* hero */
  hero: { position: "relative", overflow: "hidden", backgroundColor: c.surfaceInverse },
  heroImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  heroScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.lg, zIndex: 2 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBall: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.volt, alignItems: "center", justifyContent: "center" },
  logoTxt: { fontSize: fontSize.xl, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  navLinks: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  navLink: { color: "rgba(255,255,255,0.85)", fontSize: fontSize.base, fontWeight: "500" },
  navCta: { backgroundColor: c.volt, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  navCtaTxt: { color: c.onBrandPrimary, fontWeight: "700", fontSize: fontSize.base },
  heroBody: { paddingTop: spacing["3xl"], paddingBottom: spacing["4xl"], zIndex: 2, gap: spacing.lg },
  pill: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.volt },
  pillTxt: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  heroTitle: { fontSize: 44, fontWeight: "800", color: "#fff", lineHeight: 58 },
  heroSub: { fontSize: fontSize.lg, color: "rgba(255,255,255,0.78)", lineHeight: 28, maxWidth: 560 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#fff", borderRadius: radius.lg, padding: spacing.sm, maxWidth: 640, marginTop: spacing.sm },
  searchField: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  cityChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary },
  cityChipActive: { backgroundColor: c.pine },
  cityTxt: { fontSize: fontSize.sm, color: c.onSurfaceSecondary, fontWeight: "600" },
  cityTxtActive: { color: "#fff" },
  searchBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.volt, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  searchBtnTxt: { color: c.onBrandPrimary, fontWeight: "800", fontSize: fontSize.lg },
  statsRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl, marginTop: spacing.lg },
  stat: { gap: 2 },
  statValue: { fontSize: fontSize["2xl"], fontWeight: "800", color: c.volt },
  statLabel: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.65)" },
  statDiv: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.18)" },

  /* sections */
  section: { paddingVertical: spacing["3xl"], gap: spacing.lg },
  sectionAlt: { paddingVertical: spacing["3xl"], backgroundColor: c.surfaceSecondary },
  sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  kicker: { fontSize: fontSize.sm, fontWeight: "800", color: c.onBrandSecondary, letterSpacing: 1 },
  sectionTitle: { fontSize: fontSize["3xl"], fontWeight: "800", color: c.onSurface },
  seeAll: { fontSize: fontSize.base, fontWeight: "700", color: c.onBrandSecondary },
  grid: { gap: spacing.md },
  grid2: { flexDirection: "row", flexWrap: "wrap" },
  grid3: { flexDirection: "row", flexWrap: "wrap" },

  featureCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: c.border, flex: 1, minWidth: 260, ...(shadows.card as any) },
  featureIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: c.brandSecondary, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: fontSize.lg, fontWeight: "800", color: c.onSurface },
  featureBody: { fontSize: fontSize.base, color: c.muted, lineHeight: 24 },

  stepCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, flex: 1, minWidth: 260, borderWidth: 1, borderColor: c.border },
  stepTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: fontSize["2xl"], fontWeight: "800", color: c.borderStrong },
  stepTitle: { fontSize: fontSize.xl, fontWeight: "800", color: c.onSurface },
  stepBody: { fontSize: fontSize.base, color: c.muted, lineHeight: 24 },

  /* venues */
  venueCard: { borderRadius: radius.lg, overflow: "hidden", height: 260, position: "relative", flex: 1, minWidth: 280, backgroundColor: c.surfaceInverse },
  venueImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  venueScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  venueInfo: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: 4 },
  venueRating: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  venueRatingTxt: { color: "#fff", fontSize: fontSize.sm, fontWeight: "700" },
  venueName: { color: "#fff", fontSize: fontSize.xl, fontWeight: "800" },
  venueMeta: { color: "rgba(255,255,255,0.75)", fontSize: fontSize.sm },
  venuePrice: { color: c.volt, fontSize: fontSize.base, fontWeight: "800" },

  /* dark leagues section */
  darkSection: { position: "relative", overflow: "hidden", backgroundColor: c.surfaceInverse, paddingVertical: spacing["4xl"] },
  darkImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", opacity: 0.35 },
  darkBody: { gap: spacing.xl, zIndex: 2 },
  darkTitle: { fontSize: fontSize["4xl"], fontWeight: "800", color: "#fff", lineHeight: 60 },
  darkSub: { fontSize: fontSize.lg, color: "rgba(255,255,255,0.75)", lineHeight: 28, maxWidth: 520 },
  voltBtn: { alignSelf: "flex-start", backgroundColor: c.volt, paddingHorizontal: spacing["2xl"], paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.md },
  voltBtnTxt: { color: c.onBrandPrimary, fontWeight: "800", fontSize: fontSize.lg },
  leagueCard: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, minWidth: 300 },
  leagueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leagueTeam: { color: "#fff", fontSize: fontSize.base, fontWeight: "600" },
  leagueScore: { color: c.volt, fontSize: fontSize.xl, fontWeight: "800" },
  leagueDiv: { height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  leagueLive: { color: "#FF6B6B", fontSize: fontSize.sm, fontWeight: "700" },

  /* testimonials */
  quoteCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: c.border, flex: 1, minWidth: 280, ...(shadows.card as any) },
  quoteStars: { flexDirection: "row", gap: 2 },
  quoteText: { fontSize: fontSize.base, color: c.onSurface, lineHeight: 26 },
  quoteName: { fontSize: fontSize.sm, color: c.muted, fontWeight: "600" },

  /* cta + footer */
  ctaBanner: { borderRadius: radius.lg, padding: spacing["3xl"], gap: spacing.md, overflow: "hidden", position: "relative" },
  ctaVoltBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: c.volt },
  ctaTitle: { fontSize: fontSize["3xl"], fontWeight: "800", color: "#fff" },
  ctaSub: { fontSize: fontSize.lg, color: "rgba(255,255,255,0.72)", lineHeight: 28 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl, marginTop: spacing.sm },
  ctaOwner: { color: c.volt, fontSize: fontSize.base, fontWeight: "700" },

  footer: { marginTop: spacing["3xl"], paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: c.border, gap: spacing.lg },
  footerTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xl, flexWrap: "wrap" },
  footerTag: { color: c.muted, fontSize: fontSize.sm, marginTop: spacing.xs },
  footerCols: { flexDirection: "row", gap: spacing["3xl"] },
  footerCol: { gap: spacing.sm },
  footerHead: { fontSize: fontSize.base, fontWeight: "800", color: c.onSurface },
  footerLink: { fontSize: fontSize.sm, color: c.muted, paddingVertical: 2 },
  footerCopy: { fontSize: fontSize.sm, color: c.muted, textAlign: "center", paddingTop: spacing.md },
}));
