// Contact page — info cards + message form (opens the mail app).
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Envelope, MapPin, PaperPlaneTilt, Phone, WhatsappLogo } from "phosphor-react-native";

import { PageHero, PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";
import { Button, TextField, useToast } from "@/src/ui";

const SUPPORT_EMAIL = "support@turfbook.jo";
const SUPPORT_PHONE = "+96260000000";

export default function ContactPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const openMail = () => {
    const subject = encodeURIComponent(`رسالة من ${name || "زائر"} — تيرف بوك`);
    const body = encodeURIComponent(`الاسم: ${name}\nالهاتف: ${phone}\n\n${message}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const submit = () => {
    if (!message.trim()) {
      toast.show(t("contact.need_msg", "فضلاً اكتب رسالتك أولاً"), "error");
      return;
    }
    openMail();
    toast.show(t("contact.opening", "جارٍ فتح تطبيق البريد لإرسال رسالتك"), "success");
  };

  const channels = [
    { icon: <Phone size={22} color={colors.brandPrimary} />, title: t("contact.phone", "الهاتف"), value: "+962 6 000 0000", onPress: () => Linking.openURL(`tel:${SUPPORT_PHONE}`) },
    { icon: <WhatsappLogo size={22} color={colors.success} weight="fill" />, title: t("contact.whatsapp", "واتساب"), value: "+962 6 000 0000", onPress: () => Linking.openURL(`https://wa.me/962600000000`) },
    { icon: <Envelope size={22} color={colors.brandPrimary} />, title: t("contact.email", "البريد الإلكتروني"), value: SUPPORT_EMAIL, onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
    { icon: <MapPin size={22} color={colors.brandPrimary} />, title: t("contact.address", "العنوان"), value: t("contact.address_v", "عمّان، الأردن"), onPress: undefined },
  ];

  return (
    <PublicPage title={t("contact.title", "تواصل معنا")} testID="contact-page">
      <PageWrap>
        <PageHero
          kicker={t("contact.kicker", "نسمعك")}
          title={t("contact.title", "تواصل معنا")}
          subtitle={t("contact.subtitle", "فريقنا جاهز لمساعدتك — سواء كنت لاعباً أو صاحب ملعب.")}
        />

        <View style={s.grid}>
          {channels.map((ch) => (
            <Pressable
              key={ch.title}
              onPress={ch.onPress}
              disabled={!ch.onPress}
              style={({ pressed }) => [s.card, pressed && ch.onPress && { opacity: 0.85 }]}
            >
              <View style={s.iconWrap}>{ch.icon}</View>
              <Text style={s.cardTitle}>{ch.title}</Text>
              <Text style={s.cardValue}>{ch.value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[s.form, shadows.sm as any]}>
          <Text style={s.formTitle}>{t("contact.form_title", "أرسل لنا رسالة")}</Text>
          <TextField label={t("contact.name", "الاسم")} value={name} onChangeText={setName} testID="contact-name" placeholder="اسمك الكريم" />
          <TextField
            label={t("contact.phone_l", "رقم الهاتف")}
            value={phone}
            onChangeText={setPhone}
            testID="contact-phone"
            keyboardType="phone-pad"
            placeholder="07X XXX XXXX"
          />
          <TextField
            label={t("contact.message", "رسالتك")}
            value={message}
            onChangeText={setMessage}
            testID="contact-message"
            placeholder="اكتب استفسارك هنا..."
            multiline
            numberOfLines={5}
            style={{ height: 130, textAlignVertical: "top", paddingTop: spacing.md }}
          />
          <Button
            title={t("contact.send", "إرسال الرسالة")}
            testID="contact-send"
            onPress={submit}
            icon={<PaperPlaneTilt size={18} color={colors.onBrandPrimary} />}
          />
          <Text style={s.formNote}>{t("contact.note", "سيتم فتح تطبيق البريد لديك لإتمام الإرسال.")}</Text>
        </View>
        <View style={{ height: spacing.xl }} />
      </PageWrap>
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  card: {
    width: "48%", minWidth: 160, backgroundColor: c.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, padding: spacing.xl, marginBottom: spacing.md, gap: spacing.xs,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.brandTertiary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  cardTitle: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  cardValue: { color: c.muted, fontSize: fontSize.base },
  form: {
    marginTop: spacing.xl, backgroundColor: c.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, padding: spacing.xl, gap: spacing.md, maxWidth: 640,
  },
  formTitle: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800" },
  formNote: { color: c.muted, fontSize: fontSize.sm, textAlign: "center" },
}));
