// Privacy policy — Arabic legal content, clean layout.
import { Text, View } from "react-native";

import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, spacing } from "@/src/theme";

const SECTIONS: { h: string; ps: string[] }[] = [
  {
    h: "1. البيانات التي نجمعها",
    ps: [
      "نجمع البيانات التي تقدمها مباشرة (الاسم، الهاتف، البريد الإلكتروني) وبيانات الاستخدام (الحجوزات، التقييمات، تفضيلات البحث) اللازمة لتشغيل المنصة وتحسينها.",
    ],
  },
  {
    h: "2. استخدام البيانات",
    ps: [
      "نستخدم بياناتك لتنفيذ الحجوزات، إرسال التذكيرات والإشعارات، تحسين تجربة الاستخدام، والتواصل معك بشأن حسابك. لا نبيع بياناتك الشخصية لأي طرف ثالث.",
    ],
  },
  {
    h: "3. مشاركة البيانات",
    ps: [
      "نشارك الحد الأدنى اللازم من البيانات مع أصحاب الملاعب (اسم ورقم هاتف صاحب الحجز) لتنفيذ الحجز، ومع مزودي الدفع لمعالجة المدفوعات وفق معايير الأمان المعتمدة.",
    ],
  },
  {
    h: "4. ملفات الارتباط والتتبع",
    ps: [
      "نستخدم ملفات ارتباط أساسية لتشغيل الموقع وتذكر تفضيلاتك (كاللغة والمظهر). يمكنك التحكم بها من إعدادات متصفحك.",
    ],
  },
  {
    h: "5. أمان البيانات",
    ps: [
      "نطبق إجراءات أمنية مناسبة لحماية بياناتك من الوصول غير المصرح به، بما في ذلك التشفير أثناء النقل والتحكم في الصلاحيات.",
    ],
  },
  {
    h: "6. حقوقك",
    ps: [
      "يحق لك الوصول إلى بياناتك وتصحيحها وحذف حسابك في أي وقت من إعدادات الحساب، أو عبر التواصل معنا. سنستجيب لطلباتك خلال مدة معقولة.",
    ],
  },
  {
    h: "7. الأطفال",
    ps: ["المنصة غير موجهة للأطفال دون سن 13 عاماً، ولا نجمع بياناتهم عن قصد."],
  },
  {
    h: "8. التواصل",
    ps: ["لأي استفسار حول الخصوصية، راسلنا على privacy@turfbook.jo."],
  },
];

export default function PrivacyPage() {
  const s = useStyles();
  const { t } = useTranslation();
  return (
    <PublicPage title={t("privacy.title", "سياسة الخصوصية")} testID="privacy-page">
      <PageWrap>
        <PageHero
          kicker={t("privacy.kicker", "قانوني")}
          title={t("privacy.title", "سياسة الخصوصية")}
          subtitle={t("privacy.updated", "آخر تحديث: أكتوبر 2026")}
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
