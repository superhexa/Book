// Terms & conditions — Arabic legal content, clean layout.
import { Text, View } from "react-native";

import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, spacing } from "@/src/theme";

const SECTIONS: { h: string; ps: string[] }[] = [
  {
    h: "1. التعريفات",
    ps: [
      "«المنصة» تعني تطبيق وموقع Book. «المستخدم» أي شخص يستخدم المنصة سواء كان لاعباً أو صاحب ملعب أو زائراً. «الحجز» هو طلب استخدام ملعب في موعد محدد عبر المنصة.",
    ],
  },
  {
    h: "2. استخدام المنصة",
    ps: [
      "يجب أن تكون المعلومات المقدمة عند التسجيل صحيحة ومحدثة. أنت مسؤول عن الحفاظ على سرية بيانات الدخول الخاصة بك.",
      "يُمنع استخدام المنصة لأي غرض غير قانوني، أو إساءة استخدام نظام الحجوزات، أو تقديم تقييمات كاذبة.",
    ],
  },
  {
    h: "3. الحجوزات والدفع",
    ps: [
      "يتم تأكيد الحجز فور إتمام عملية الدفع أو حسب سياسة الدفع الخاصة بكل ملعب. الأسعار معلنة بالدينار الأردني وتشمل أي رسوم موضحة قبل التأكيد.",
      "تخضع كل منشأة لسياسة إلغاء خاصة بها يتم عرضها بوضوح قبل تأكيد الحجز، ويُحتسب الاسترداد تلقائياً وفق تلك السياسة.",
    ],
  },
  {
    h: "4. مسؤوليات أصحاب الملاعب",
    ps: [
      "يلتزم صاحب الملعب بتوفير المرافق كما هو معلن، والالتزام بالمواعيد المحجوزة، والحفاظ على مستوى السلامة والنظافة.",
      "أي معلومات مضللة عن المنشأة قد تؤدي إلى إيقاف الحساب بعد المراجعة.",
    ],
  },
  {
    h: "5. التقييمات والمحتوى",
    ps: [
      "التقييمات تعكس تجارب حقيقية للمستخدمين. نحتفظ بحق إخفاء التقييمات المسيئة أو غير الموضوعية وفق سياسة الإشراف الخاصة بنا.",
    ],
  },
  {
    h: "6. تحديد المسؤولية",
    ps: [
      "المنصة وسيط بين اللاعبين وأصحاب الملاعب، ولا تتحمل المسؤولية عن الإصابات أو الأضرار التي قد تحدث أثناء اللعب، مع التزامنا ببذل العناية اللازمة في التحقق من المنشآت.",
    ],
  },
  {
    h: "7. التعديلات",
    ps: [
      "قد نقوم بتحديث هذه الشروط من وقت لآخر، وسيتم إشعار المستخدمين بالتغييرات الجوهرية عبر المنصة. استمرار استخدامك للمنصة يعني قبولك للشروط المحدثة.",
    ],
  },
  {
    h: "8. التواصل",
    ps: ["لأي استفسار حول هذه الشروط، تواصل معنا عبر صفحة «تواصل معنا» أو البريد الإلكتروني support@turfbook.jo."],
  },
];

export default function TermsPage() {
  const s = useStyles();
  const { t } = useTranslation();
  return (
    <PublicPage title={t("terms.title", "الشروط والأحكام")} testID="terms-page">
      <PageWrap>
        <PageHero
          kicker={t("terms.kicker", "قانوني")}
          title={t("terms.title", "الشروط والأحكام")}
          subtitle={t("terms.updated", "آخر تحديث: أكتوبر 2026")}
        />
        <View style={s.doc}>
          {SECTIONS.map((sec) => (
            <View key={sec.h} style={s.sec}>
              <Text style={s.h}>{sec.h}</Text>
              {sec.ps.map((p, i) => (
                <Text key={i} style={s.p}>{p}</Text>
              ))}
            </View>
          ))}
        </View>
        <View style={{ height: spacing.xl }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  doc: { maxWidth: 800, gap: spacing.xl },
  sec: { gap: spacing.sm },
  h: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800" },
  p: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 28 },
}));
