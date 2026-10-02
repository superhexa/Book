// About page — Arabic content, clean layout.
import { Text, View } from "react-native";
import { Heart, MapPin, ShieldCheck, SoccerBall, Trophy, Users } from "phosphor-react-native";

import { SectionHeader } from "@/src/components/public/chrome";
import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function AboutPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const values = [
    { icon: <SoccerBall size={26} color={colors.brandPrimary} weight="duotone" />, title: "شغف اللعبة", body: "كرة القدم تجمعنا — نبني كل ميزة لتجعل اللعب أسهل وأمتع للجميع." },
    { icon: <ShieldCheck size={26} color={colors.brandPrimary} weight="duotone" />, title: "الثقة أولاً", body: "ملاعب موثّقة، أسعار شفافة، وسياسات واضحة. لا مفاجآت أبداً." },
    { icon: <Users size={26} color={colors.brandPrimary} weight="duotone" />, title: "مجتمع واحد", body: "لاعبون وأصحاب ملاعب ودوريات — مجتمع كروي أردني واحد." },
    { icon: <MapPin size={26} color={colors.brandPrimary} weight="duotone" />, title: "لكل المحافظات", body: "من عمّان إلى العقبة، نغطي ملاعب المملكة الاثنتي عشرة محافظة." },
  ];

  return (
    <PublicPage title={t("about.title", "من نحن")} testID="about-page">
      <PageWrap>
        <PageHero
          kicker={t("about.kicker", "قصتنا")}
          title={t("about.title", "من نحن")}
          subtitle={t("about.subtitle", "تيرف بوك هي منصة كرة القدم الأولى في الأردن — وُلدت من ملاعب الأحياء وحب اللعبة.")}
        />

        <View style={s.story}>
          <Text style={s.storyText}>
            بدأت تيرف بوك بفكرة بسيطة: لماذا يصعب حجز ملعب كرة قدم في الأردن؟ مكالمات لا تُرد، أوقات غير مؤكدة، وأسعار غير واضحة.
          </Text>
          <Text style={s.storyText}>
            اليوم، نجمع أفضل ملاعب المملكة في مكان واحد — بمواعيد لحظية، وحجز فوري، وتقييمات حقيقية من اللاعبين. ونتوسع لنشمل الدوريات والفرق واللاعبين، لنبني البيت الرقمي لكرة القدم الأردنية.
          </Text>
        </View>

        <SectionHeader title={t("about.values", "قيمنا")} />
        <View style={s.grid}>
          {values.map((v) => (
            <View key={v.title} style={s.card}>
              <View style={s.iconWrap}>{v.icon}</View>
              <Text style={s.cardTitle}>{v.title}</Text>
              <Text style={s.cardBody}>{v.body}</Text>
            </View>
          ))}
        </View>

        <View style={s.mission}>
          <Trophy size={32} color={colors.brandPrimary} weight="duotone" />
          <Text style={s.missionTitle}>مهمتنا</Text>
          <Text style={s.missionBody}>
            أن نجعل كرة القدم في متناول كل أردني — ملعب قريب، حجز سهل، وتجربة لا تُنسى في كل مرة.
          </Text>
          <View style={s.heartRow}>
            <Heart size={16} color={colors.brandPrimary} weight="fill" />
            <Text style={s.heartTxt}>صُنع بشغف في الأردن</Text>
          </View>
        </View>
        <View style={{ height: spacing.xl }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  story: { gap: spacing.md, marginBottom: spacing["2xl"], maxWidth: 760 },
  storyText: { color: c.onSurfaceSecondary, fontSize: fontSize.lg, lineHeight: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  card: {
    width: "48%", minWidth: 160, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, padding: spacing.xl, marginBottom: spacing.md,
  },
  iconWrap: {
    width: 54, height: 54, borderRadius: radius.md, backgroundColor: c.brandTertiary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  cardTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  cardBody: { color: c.muted, fontSize: fontSize.base, lineHeight: 24, marginTop: spacing.xs },
  mission: {
    marginTop: spacing["2xl"], backgroundColor: c.surfaceInverse, borderRadius: radius.xl,
    padding: spacing["2xl"], alignItems: "center", gap: spacing.sm,
  },
  missionTitle: { color: "#FFFFFF", fontSize: fontSize["2xl"], fontWeight: "800" },
  missionBody: { color: "#FFFFFFBB", fontSize: fontSize.lg, lineHeight: 30, textAlign: "center", maxWidth: 560 },
  heartRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  heartTxt: { color: c.brandPrimary, fontWeight: "700" },
}));
