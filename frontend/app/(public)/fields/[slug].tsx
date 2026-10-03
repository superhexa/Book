// Public field detail: gallery, info, pitches with booking CTAs, reviews.
import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarCheck, MapPin, Phone, SealCheck, Star } from "phosphor-react-native";

import { EmptyState } from "@/src/components/public/EmptyState";
import { TextSkeleton } from "@/src/components/public/Skeleton";
import { SectionHeader, useIsDesktop } from "@/src/components/public/chrome";
import { PageWrap, PublicPage } from "@/src/components/public/page";
import { useTranslation } from "@/src/i18n";
import { arDateShort, fileUrl, jod, useFacility, useFacilityReviews } from "@/src/sport-api";
import type { Pitch } from "@/src/sport-api";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";
import { Badge, Button, Stars } from "@/src/ui";

const FALLBACK = "https://images.unsplash.com/photo-1567792264121-682b7b4d9376?crop=entropy&cs=srgb&fm=jpg&w=1600&q=80";

export default function FieldDetailPage() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const isDesktop = useIsDesktop();
  const [activeImg, setActiveImg] = useState(0);

  const q = useFacility(typeof slug === "string" ? slug : undefined);
  const rev = useFacilityReviews(typeof slug === "string" ? slug : undefined);
  const f = q.data;

  const images = f ? [f.cover_image, ...(f.images || [])].filter(Boolean) as string[] : [];
  const gallery = images.length ? images : [FALLBACK];

  return (
    <PublicPage
      title={f?.name || t("fields.detail", "تفاصيل الملعب")}
      refreshing={q.isRefetching}
      onRefresh={() => {
        q.refetch();
        rev.refetch();
      }}
      testID="field-detail"
    >
      {q.isLoading ? (
        <PageWrap>
          <View style={{ paddingTop: spacing.xl }}>
            <TextSkeleton lines={1} />
            <View style={{ height: 12 }} />
            <TextSkeleton lines={4} />
          </View>
        </PageWrap>
      ) : !f ? (
        <PageWrap>
          <EmptyState
            testID="field-not-found"
            title={t("fields.not_found", "الملعب غير موجود")}
            subtitle={t("fields.not_found_sub", "ربما تمت إزالة هذا الملعب أو الرابط غير صحيح.")}
            actionLabel={t("fields.browse", "تصفح الملاعب")}
            onAction={() => router.push("/fields")}
          />
        </PageWrap>
      ) : (
        <>
          {/* gallery */}
          <View style={s.gallery}>
            <Image
              source={{ uri: fileUrl(gallery[activeImg]) || FALLBACK }}
              style={s.heroImg}
              contentFit="cover"
            />
            {gallery.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
                {gallery.map((img, i) => (
                  <Pressable key={i} onPress={() => setActiveImg(i)} style={[s.thumb, i === activeImg && s.thumbActive]}>
                    <Image source={{ uri: fileUrl(img) || FALLBACK }} style={s.thumbImg} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <PageWrap>
            {/* header */}
            <View style={[s.headRow, isDesktop && { flexDirection: "row", alignItems: "flex-start" }]}>
              <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                  <Text style={s.title}>{f.name}</Text>
                  {f.status === "VERIFIED" ? (
                    <View style={s.verified}>
                      <SealCheck size={16} weight="fill" color={colors.brandPrimary} />
                      <Text style={s.verifiedTxt}>{t("fields.verified", "موثّق")}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={s.locRow}>
                  <MapPin size={15} color={colors.muted} />
                  <Text style={s.loc}>{[f.area, f.city].filter(Boolean).join("، ") || "الأردن"}</Text>
                </View>
                <View style={s.metaRow}>
                  <Stars rating={f.rating_avg || 0} size={15} />
                  <Text style={s.metaTxt}>
                    {f.rating_count ? `(${f.rating_count} ${t("fields.reviews", "تقييم")})` : t("fields.new", "جديد")}
                  </Text>
                  {f.pitch_count ? <Text style={s.metaTxt}>· {f.pitch_count} {t("fields.pitches", "ملاعب")}</Text> : null}
                </View>
              </View>
              <View style={[s.priceCard, isDesktop && { minWidth: 260 }]}>
                <Text style={s.priceLabel}>{t("fields.from_price", "يبدأ من")}</Text>
                <Text style={s.price}>{jod(f.min_price)} <Text style={s.priceUnit}>/ {t("fields.per_hour", "ساعة")}</Text></Text>
              </View>
            </View>

            {f.description ? (
              <View style={s.block}>
                <Text style={s.blockTitle}>{t("fields.about_field", "عن الملعب")}</Text>
                <Text style={s.body}>{f.description}</Text>
              </View>
            ) : null}

            {f.amenities?.length ? (
              <View style={s.block}>
                <Text style={s.blockTitle}>{t("fields.amenities", "المرافق والخدمات")}</Text>
                <View style={s.chipsWrap}>
                  {f.amenities.map((a) => (
                    <Badge key={a} label={a} colorKey="brandTertiary" />
                  ))}
                </View>
              </View>
            ) : null}

            {/* pitches */}
            <View style={s.block}>
              <SectionHeader title={t("fields.pitches_title", "الملاعب المتاحة")} subtitle={t("fields.pitches_sub", "اختر الملعب المناسب واحجز موعدك مباشرة")} />
              {!f.pitches?.length ? (
                <EmptyState
                  title={t("fields.no_pitches", "لا توجد ملاعب مدرجة بعد")}
                  subtitle={t("fields.no_pitches_sub", "تواصل مع إدارة المنشأة للاستفسار عن الحجز.")}
                />
              ) : (
                <View style={s.pitchList}>
                  {f.pitches.map((p: Pitch) => (
                    <View key={p.id} style={s.pitchCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pitchName}>{p.name || t("fields.pitch", "ملعب")}</Text>
                        <Text style={s.pitchMeta}>
                          {[
                            p.size ? `${t("fields.size", "الحجم")}: ${p.size}` : null,
                            p.grass_type,
                            p.indoor ? t("fields.indoor", "داخلي") : t("fields.outdoor", "خارجي"),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                        {p.pricing?.base_hourly ? (
                          <Text style={s.pitchPrice}>{jod(p.pricing.base_hourly)} <Text style={s.priceUnit}>/ {t("fields.per_hour", "ساعة")}</Text></Text>
                        ) : null}
                      </View>
                      <Button
                        title={t("fields.book", "احجز")}
                        testID={`book-pitch-${p.id}`}
                        onPress={() => router.push(`/book/${p.id}` as any)}
                        icon={<CalendarCheck size={18} color={colors.onBrandPrimary} />}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* contact */}
            <View style={s.block}>
              <Text style={s.blockTitle}>{t("fields.contact", "معلومات التواصل")}</Text>
              <View style={s.contactRow}>
                {f.phone ? (
                  <View style={s.contactItem}>
                    <Phone size={16} color={colors.brandPrimary} />
                    <Text style={[s.contactTxt, { writingDirection: "ltr" }]}>{f.phone}</Text>
                  </View>
                ) : null}
                {f.address ? (
                  <View style={s.contactItem}>
                    <MapPin size={16} color={colors.brandPrimary} />
                    <Text style={s.contactTxt}>{f.address}</Text>
                  </View>
                ) : null}
                {f.owner?.name ? (
                  <View style={s.contactItem}>
                    <Text style={s.contactTxt}>{t("fields.managed_by", "الإدارة")}: {f.owner.name}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* reviews */}
            <View style={s.block}>
              <SectionHeader
                title={t("fields.reviews_title", "تقييمات اللاعبين")}
                subtitle={rev.data?.items?.length ? `${rev.data.items.length} ${t("fields.reviews", "تقييم")}` : undefined}
              />
              {rev.isLoading ? (
                <TextSkeleton lines={3} />
              ) : !rev.data?.items?.length ? (
                <EmptyState
                  title={t("fields.no_reviews", "لا توجد تقييمات بعد")}
                  subtitle={t("fields.no_reviews_sub", "كن أول من يلعب هنا ويشارك تجربته.")}
                />
              ) : (
                <View style={s.reviewList}>
                  {rev.data.items.slice(0, 5).map((r) => (
                    <View key={r.id} style={s.reviewCard}>
                      <View style={s.reviewHead}>
                        <View style={s.avatar}>
                          <Text style={s.avatarTxt}>{(r.customer_name || "ل")[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.reviewName}>{r.customer_name || t("fields.player", "لاعب")}</Text>
                          <Text style={s.reviewDate}>{arDateShort(r.created_at)}</Text>
                        </View>
                        <View style={s.reviewStars}>
                          <Star size={14} color={colors.warning} weight="fill" />
                          <Text style={s.reviewRating}>{r.rating.toFixed(1)}</Text>
                        </View>
                      </View>
                      {r.comment ? <Text style={s.reviewBody}>{r.comment}</Text> : null}
                      {r.owner_response ? (
                        <View style={s.ownerResp}>
                          <Text style={s.ownerRespLabel}>{t("fields.owner_reply", "رد الإدارة")}:</Text>
                          <Text style={s.ownerRespTxt}>{r.owner_response}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={{ height: spacing.xl }} />
          </PageWrap>
        </>
      )}
    </PublicPage>
  );
}

const useStyles = makeStyles((c) => ({
  gallery: { width: "100%", maxWidth: 1200, alignSelf: "center" },
  heroImg: { width: "100%", height: 340, backgroundColor: c.surfaceSecondary },
  thumbs: { gap: spacing.sm, padding: spacing.md },
  thumb: { borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  thumbActive: { borderColor: c.brandPrimary },
  thumbImg: { width: 96, height: 64 },

  headRow: { gap: spacing.lg, marginTop: spacing.xl },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  title: { color: c.onSurface, fontSize: fontSize["3xl"], fontWeight: "800" },
  verified: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brandTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  verifiedTxt: { color: c.onBrandTertiary, fontSize: fontSize.sm, fontWeight: "700" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  loc: { color: c.muted, fontSize: fontSize.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  metaTxt: { color: c.muted, fontSize: fontSize.base },

  priceCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg, alignSelf: "flex-start" },
  priceLabel: { color: c.muted, fontSize: fontSize.sm },
  price: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "800", marginTop: 2 },
  priceUnit: { color: c.muted, fontSize: fontSize.base, fontWeight: "400" },

  block: { marginTop: spacing["2xl"] },
  blockTitle: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800", marginBottom: spacing.md },
  body: { color: c.onSurfaceSecondary, fontSize: fontSize.lg, lineHeight: 30 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  pitchList: { gap: spacing.md },
  pitchCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg,
    ...(shadows.sm as any),
  },
  pitchName: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "700" },
  pitchMeta: { color: c.muted, fontSize: fontSize.base, marginTop: 4 },
  pitchPrice: { color: c.brandPrimary, fontSize: fontSize.lg, fontWeight: "800", marginTop: spacing.sm },

  contactRow: { gap: spacing.sm },
  contactItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  contactTxt: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "600" },

  reviewList: { gap: spacing.md },
  reviewCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.lg },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: c.onBrandTertiary, fontSize: fontSize.lg, fontWeight: "800" },
  reviewName: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  reviewDate: { color: c.muted, fontSize: fontSize.sm, marginTop: 2 },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewRating: { color: c.onSurface, fontWeight: "700" },
  reviewBody: { color: c.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 24, marginTop: spacing.md },
  ownerResp: { marginTop: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  ownerRespLabel: { color: c.onSurface, fontSize: fontSize.sm, fontWeight: "700" },
  ownerRespTxt: { color: c.onSurfaceSecondary, fontSize: fontSize.base, marginTop: 4, lineHeight: 22 },
}));
