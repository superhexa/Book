// FAQ page — accordion of common questions in Arabic.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CaretDown, Question } from "phosphor-react-native";
import { router } from "expo-router";

import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button } from "@/src/ui";

const FAQS: { q: string; a: string }[] = [
  {
    q: "كيف أحجز ملعباً؟",
    a: "تصفح دليل الملاعب، اختر الملعب المناسب، ثم اختر الملعب الفرعي (5×5، 7×7...) والموعد الذي يناسبك. أكّد الحجز وادفع إلكترونياً أو عند الوصول حسب سياسة الملعب.",
  },
  {
    q: "هل أحتاج إلى حساب للحجز؟",
    a: "نعم، تحتاج إلى إنشاء حساب مجاني لتتمكن من إدارة حجوزاتك، استلام التذكيرات، وتقييم الملاعب. التسجيل يستغرق أقل من دقيقة.",
  },
  {
    q: "ما هي طرق الدفع المتاحة؟",
    a: "ندعم الدفع الإلكتروني بالبطاقات والمحافظ الرقمية، بالإضافة إلى الدفع عند الوصول في الملاعب التي تتيح ذلك. جميع الأسعار بالدينار الأردني وبدون رسوم خفية.",
  },
  {
    q: "هل يمكنني إلغاء أو تعديل الحجز؟",
    a: "نعم. يمكنك إلغاء الحجز من صفحة حجوزاتك وفق سياسة الإلغاء الخاصة بكل ملعب، ويتم احتساب الاسترداد تلقائياً. ننصح بمراجعة سياسة الملعب قبل التأكيد.",
  },
  {
    q: "كيف أسجّل ملعبي على المنصة؟",
    a: "أنشئ حساب مالك من صفحة التسجيل، أضف بيانات منشأتك والملاعب والأسعار، وسيقوم فريقنا بمراجعة الطلب والتحقق من الملعب قبل نشره — عادة خلال 48 ساعة.",
  },
  {
    q: "هل الملاعب المعروضة موثّقة؟",
    a: "نعم. كل ملعب يحمل شارة «موثّق» تمت زيارته أو مراجعة بياناته من فريقنا للتأكد من جودة المرافق ودقة المعلومات.",
  },
  {
    q: "ماذا أفعل إذا واجهت مشكلة في الملعب؟",
    a: "يمكنك تقييم تجربتك بعد كل حجز، والإبلاغ عن أي مشكلة من صفحة التقييم أو عبر صفحة «تواصل معنا» — وفريقنا يتابع جميع البلاغات.",
  },
  {
    q: "هل تغطون جميع المحافظات؟",
    a: "نعمل على تغطية جميع محافظات المملكة الاثنتي عشرة. إذا لم تجد ملاعب في محافظتك بعد، سجّل اهتمامك وسنعلمك فور توفرها.",
  },
];

export default function FaqPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <PublicPage title={t("faq.title", "الأسئلة الشائعة")} testID="faq-page">
      <PageWrap>
        <PageHero
          kicker={t("faq.kicker", "مركز المساعدة")}
          title={t("faq.title", "الأسئلة الشائعة")}
          subtitle={t("faq.subtitle", "إجابات عن أكثر الأسئلة التي تصلنا من اللاعبين وأصحاب الملاعب.")}
        />

        <View style={s.list}>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <View key={i} style={[s.item, isOpen && s.itemOpen]}>
                <Pressable
                  testID={`faq-${i}`}
                  onPress={() => setOpen(isOpen ? null : i)}
                  style={s.qRow}
                  accessibilityRole="button"
                >
                  <View style={s.qIcon}>
                    <Question size={18} color={colors.brandPrimary} weight="duotone" />
                  </View>
                  <Text style={s.q}>{f.q}</Text>
                  <CaretDown
                    size={18}
                    color={colors.muted}
                    weight="bold"
                    style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
                {isOpen ? <Text style={s.a}>{f.a}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={s.cta}>
          <Text style={s.ctaTitle}>{t("faq.more", "لم تجد إجابتك؟")}</Text>
          <Text style={s.ctaSub}>{t("faq.more_sub", "فريق الدعم جاهز لمساعدتك على مدار الساعة.")}</Text>
          <Button title={t("faq.contact", "تواصل معنا")} variant="secondary" onPress={() => router.push("/contact")} testID="faq-contact" />
        </View>
        <View style={{ height: spacing.xl }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.sm, maxWidth: 800 },
  item: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  itemOpen: { borderColor: c.brandPrimary },
  qRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  qIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  q: { flex: 1, color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  a: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 26, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  cta: { marginTop: spacing["2xl"], backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: spacing.sm, maxWidth: 800 },
  ctaTitle: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800" },
  ctaSub: { color: c.muted, fontSize: fontSize.base },
}));
