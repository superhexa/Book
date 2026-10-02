// Public website chrome: RTL gate, header, mobile bottom nav, footer,
// section headers, pagination, theme toggle, responsive helpers.
import React, { useEffect, useState } from "react";
import { I18nManager, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Link, router, usePathname } from "expo-router";
import {
  CaretLeft,
  ChartBar,
  House,
  List,
  MapPin,
  Moon,
  Phone,
  SoccerBall,
  Sun,
  Trophy,
  User,
  Users,
  X,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/src/i18n";
import { usePreferences } from "@/src/preferences";
import { fontSize, makeStyles, radius, shadows, spacing, useTheme } from "@/src/theme";

export const NAV_LINKS = [
  { href: "/landing", label: "الرئيسية", icon: House },
  { href: "/fields", label: "الملاعب", icon: MapPin },
  { href: "/leagues", label: "الدوريات", icon: Trophy },
  { href: "/teams", label: "الفرق", icon: Users },
  { href: "/matches", label: "المباريات", icon: SoccerBall },
  { href: "/rankings", label: "الترتيب", icon: ChartBar },
  { href: "/players", label: "اللاعبون", icon: User },
] as const;

export const BOTTOM_NAV_H = 74;

export function useIsMobile() {
  const { width } = useWindowDimensions();
  return width < 768;
}
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= 1024;
}
// columns for card grids: 1 / 2 / 3
export function useGridCols(): 1 | 2 | 3 {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

// ------------------------------ RTL gate -----------------------------------
export function RtlGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    I18nManager.allowRTL(true);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", "rtl");
      document.documentElement.setAttribute("lang", "ar");
    }
  }, []);
  return <>{children}</>;
}

export function usePageTitle(title: string) {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = `${title} | تيرف بوك`;
    }
  }, [title]);
}

// --------------------------------- logo ------------------------------------
export function AppLogo({ compact }: { compact?: boolean }) {
  const s = useStyles();
  return (
    <Pressable onPress={() => router.push("/landing")} style={s.logoWrap} accessibilityRole="link">
      <View style={s.logoBall}>
        <SoccerBall size={compact ? 20 : 24} color="#FFFFFF" weight="fill" />
      </View>
      <Text style={[s.logoTxt, compact && { fontSize: fontSize.lg }]}>تيرف بوك</Text>
    </Pressable>
  );
}

// ------------------------------ theme toggle -------------------------------
export function ThemeToggle() {
  const s = useStyles();
  const { scheme } = useTheme();
  const { schemePref, setSchemePref } = usePreferences();
  const dark = scheme === "dark";
  return (
    <Pressable
      testID="theme-toggle"
      onPress={() => setSchemePref(dark ? "light" : "dark")}
      style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={dark ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      {dark ? <Sun size={20} color={s.iconBtnColor.color as string} /> : <Moon size={20} color={s.iconBtnColor.color as string} />}
    </Pressable>
  );
}

// --------------------------------- header ----------------------------------
export function PublicHeader() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={[s.header, { paddingTop: insets.top }]}>
      <View style={s.headerInner}>
        <AppLogo />
        {!isMobile ? (
          <View style={s.navLinks}>
            {NAV_LINKS.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link key={l.href} href={l.href as any} asChild>
                  <Pressable style={[s.navLink, active && s.navLinkActive]}>
                    <Text style={[s.navLinkTxt, active && s.navLinkTxtActive]}>{l.label}</Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : null}
        <View style={s.headerActions}>
          <ThemeToggle />
          {!isMobile ? (
            <>
              <Link href="/login" asChild>
                <Pressable style={s.signInBtn}>
                  <Text style={s.signInTxt}>{t("nav.signin", "تسجيل الدخول")}</Text>
                </Pressable>
              </Link>
              <Pressable testID="header-book" onPress={() => router.push("/fields")} style={[s.ctaBtn, shadows.brand as any]}>
                <Text style={s.ctaTxt}>{t("nav.book", "احجز الآن")}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              testID="header-menu"
              onPress={() => setMenuOpen((o) => !o)}
              style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="القائمة"
            >
              {menuOpen ? <X size={22} color={s.iconBtnColor.color as string} /> : <List size={22} color={s.iconBtnColor.color as string} />}
            </Pressable>
          )}
        </View>
      </View>
      {isMobile && menuOpen ? (
        <View style={s.mobileMenu}>
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href as any} asChild>
                <Pressable
                  onPress={() => setMenuOpen(false)}
                  style={[s.mobileMenuItem, active && s.mobileMenuItemActive]}
                >
                  <Icon size={20} color={active ? colors.brandPrimary : colors.muted} weight={active ? "fill" : "regular"} />
                  <Text style={[s.mobileMenuTxt, active && { color: colors.brandPrimary, fontWeight: "700" }]}>{l.label}</Text>
                </Pressable>
              </Link>
            );
          })}
          <View style={s.mobileMenuCtas}>
            <Pressable testID="menu-book" onPress={() => { setMenuOpen(false); router.push("/fields"); }} style={[s.ctaBtn, { flex: 1 }]}>
              <Text style={s.ctaTxt}>{t("nav.book", "احجز الآن")}</Text>
            </Pressable>
            <Pressable testID="menu-signin" onPress={() => { setMenuOpen(false); router.push("/login"); }} style={[s.signInBtn, s.signInOutline, { flex: 1 }]}>
              <Text style={[s.signInTxt, { color: colors.brandPrimary }]}>{t("nav.signin", "تسجيل الدخول")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ------------------------------- bottom nav --------------------------------
const BOTTOM_TABS = [
  { href: "/landing", label: "الرئيسية", icon: House },
  { href: "/fields", label: "الملاعب", icon: MapPin },
  { href: "/matches", label: "المباريات", icon: SoccerBall },
  { href: "/leagues", label: "الدوريات", icon: Trophy },
  { href: "/rankings", label: "الترتيب", icon: ChartBar },
] as const;

export function BottomNav() {
  const s = useStyles();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (!isMobile) return null;
  return (
    <View style={[s.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]} testID="bottom-nav">
      {BOTTOM_TABS.map((tb) => {
        const active = pathname === tb.href || pathname.startsWith(tb.href + "/");
        const Icon = tb.icon;
        return (
          <Pressable
            key={tb.href}
            testID={`tab-${tb.href.replace("/", "") || "home"}`}
            onPress={() => router.push(tb.href as any)}
            style={s.tab}
            accessibilityRole="tab"
          >
            <Icon size={24} color={active ? colors.brandPrimary : colors.muted} weight={active ? "fill" : "regular"} />
            <Text style={[s.tabLabel, active && { color: colors.brandPrimary, fontWeight: "700" }]}>{tb.label}</Text>
            {active ? <View style={s.tabDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// --------------------------------- footer ----------------------------------
export function PublicFooter() {
  const s = useStyles();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const quick = [
    { href: "/fields", label: "الملاعب" },
    { href: "/leagues", label: "الدوريات" },
    { href: "/teams", label: "الفرق" },
    { href: "/matches", label: "المباريات" },
    { href: "/players", label: "اللاعبون" },
    { href: "/leaderboards", label: "الهدافون" },
  ];
  const support = [
    { href: "/about", label: t("footer.about", "من نحن") },
    { href: "/contact", label: t("footer.contact", "تواصل معنا") },
    { href: "/faq", label: t("footer.faq", "الأسئلة الشائعة") },
    { href: "/terms", label: t("footer.terms", "الشروط والأحكام") },
    { href: "/privacy", label: t("footer.privacy", "سياسة الخصوصية") },
  ];
  return (
    <View style={s.footer}>
      <View style={[s.footerInner, isMobile && { flexDirection: "column" }]}>
        <View style={[s.footerCol, s.footerBrand]}>
          <Pressable onPress={() => router.push("/landing")} style={s.logoWrap} accessibilityRole="link">
            <View style={s.logoBall}>
              <SoccerBall size={24} color="#FFFFFF" weight="fill" />
            </View>
            <Text style={[s.logoTxt, { color: s.footerTitleColor.color as string }]}>تيرف بوك</Text>
          </Pressable>
          <Text style={s.footerAbout}>
            {t("footer.about_text", "منصة كرة القدم الأولى في الأردن — احجز أفضل الملاعب، تابع الدوريات والفرق، وعش شغف اللعبة.")}
          </Text>
          <View style={s.footerContactRow}>
            <Phone size={14} color={s.footerMuted.color as string} />
            <Text style={s.footerMuted}>+962 6 000 0000</Text>
          </View>
        </View>
        <FooterCol title={t("footer.quick", "روابط سريعة")} links={quick} />
        <FooterCol title={t("footer.support", "الدعم")} links={support} />
        <View style={s.footerCol}>
          <Text style={s.footerTitle}>{t("footer.owners", "لأصحاب الملاعب")}</Text>
          <Text style={s.footerMuted}>حوّل ملعبك إلى مصدر دخل مع لوحة تحكم كاملة.</Text>
          <Pressable testID="footer-owner-cta" onPress={() => router.push("/register")} style={s.footerCta}>
            <Text style={s.footerCtaTxt}>{t("footer.list_field", "سجّل ملعبك مجاناً")}</Text>
          </Pressable>
          <View style={{ marginTop: spacing.md, alignSelf: "flex-start" }}>
            <ThemeToggle />
          </View>
        </View>
      </View>
      <View style={s.footerBottom}>
        <Text style={s.footerMuted}>© 2026 تيرف بوك — صُنع بشغف لكرة القدم الأردنية</Text>
      </View>
    </View>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  const s = useStyles();
  return (
    <View style={s.footerCol}>
      <Text style={s.footerTitle}>{title}</Text>
      {links.map((l) => (
        <Link key={l.href} href={l.href as any} asChild>
          <Pressable style={s.footerLink}>
            <Text style={s.footerMuted}>{l.label}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

// ----------------------------- section header ------------------------------
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.sectionHead} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [s.sectionAction, pressed && { opacity: 0.7 }]} accessibilityRole="link">
          <Text style={s.sectionActionTxt}>{actionLabel}</Text>
          <CaretLeft size={16} color={colors.brandPrimary} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

// ------------------------------- pagination --------------------------------
export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (p: number) => void;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const nums = pageNums(page, pages);
  return (
    <View style={s.pager} testID="pagination">
      <PagerBtn
        label="السابق"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      {nums.map((n, i) =>
        n === "…" ? (
          <Text key={`e${i}`} style={s.pagerEllipsis}>…</Text>
        ) : (
          <Pressable
            key={n}
            testID={`page-${n}`}
            onPress={() => onChange(n as number)}
            style={[s.pagerNum, n === page && { backgroundColor: colors.brandPrimary }]}
          >
            <Text style={[s.pagerNumTxt, n === page && { color: colors.onBrandPrimary }]}>{n}</Text>
          </Pressable>
        ),
      )}
      <PagerBtn label="التالي" disabled={page >= pages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

function pageNums(page: number, pages: number): (number | "…")[] {
  const set = new Set<number>([1, 2, page - 1, page, page + 1, pages - 1, pages]);
  const arr = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of arr) {
    if (n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

function PagerBtn({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.pagerBtn, disabled && { opacity: 0.4 }]}
    >
      <Text style={[s.pagerBtnTxt, { color: disabled ? colors.muted : colors.brandPrimary }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------- styles ---------------------------------
const useStyles = makeStyles((c) => ({
  logoWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBall: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  logoTxt: { color: c.onSurface, fontSize: fontSize.xl, fontWeight: "800" },

  iconBtn: {
    width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border,
  },
  iconBtnColor: { color: c.onSurfaceSecondary },

  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, zIndex: 50 },
  headerInner: {
    width: "100%", maxWidth: 1200, alignSelf: "center",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, height: 68, gap: spacing.md,
  },
  navLinks: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1, justifyContent: "center", flexWrap: "wrap" },
  navLink: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill },
  navLinkActive: { backgroundColor: c.brandTertiary },
  navLinkTxt: { color: c.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: "600" },
  navLinkTxtActive: { color: c.onBrandTertiary, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  signInBtn: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  signInOutline: { borderWidth: 1.5, borderColor: c.borderStrong },
  signInTxt: { color: c.onSurface, fontSize: fontSize.base, fontWeight: "700" },
  ctaBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: spacing.xl, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  ctaTxt: { color: c.onBrandPrimary, fontSize: fontSize.base, fontWeight: "700" },
  mobileMenu: { borderTopWidth: 1, borderTopColor: c.border, padding: spacing.md, gap: 2 },
  mobileMenuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  mobileMenuItemActive: { backgroundColor: c.brandTertiary },
  mobileMenuTxt: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  mobileMenuCtas: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },

  bottomNav: {
    flexDirection: "row", backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border,
    paddingTop: 8, paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 56 },
  tabLabel: { color: c.muted, fontSize: 11, fontWeight: "600" },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.brandPrimary },

  footer: { backgroundColor: c.surfaceInverse, marginTop: spacing["3xl"] },
  footerInner: { width: "100%", maxWidth: 1200, alignSelf: "center", flexDirection: "row", padding: spacing.xl, gap: spacing.xl, flexWrap: "wrap" },
  footerCol: { flex: 1, minWidth: 180, gap: spacing.sm },
  footerBrand: { flex: 1.4 },
  footerTitle: { color: c.onSurfaceInverse, fontSize: fontSize.lg, fontWeight: "700", marginBottom: spacing.xs },
  footerTitleColor: { color: c.onSurfaceInverse },
  footerAbout: { color: c.onSurfaceInverse, opacity: 0.72, fontSize: fontSize.base, lineHeight: 24, marginTop: spacing.md, maxWidth: 320 },
  footerLink: { paddingVertical: 4, alignSelf: "flex-start" },
  footerMuted: { color: c.onSurfaceInverse, opacity: 0.72, fontSize: fontSize.base },
  footerContactRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  footerCta: { backgroundColor: c.brandPrimary, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 44, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: spacing.sm },
  footerCtaTxt: { color: c.onBrandPrimary, fontWeight: "700" },
  footerBottom: { borderTopWidth: 1, borderTopColor: c.border, padding: spacing.lg, alignItems: "center" },

  sectionHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  sectionTitle: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "800", letterSpacing: -0.3 },
  sectionSub: { color: c.muted, fontSize: fontSize.base, marginTop: 4, lineHeight: 22 },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6 },
  sectionActionTxt: { color: c.brandPrimary, fontSize: fontSize.base, fontWeight: "700" },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.xl, flexWrap: "wrap" },
  pagerBtn: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  pagerBtnTxt: { fontWeight: "700", fontSize: fontSize.base },
  pagerNum: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
  pagerNumTxt: { color: c.onSurface, fontWeight: "700", fontSize: fontSize.base },
  pagerEllipsis: { color: c.muted, paddingHorizontal: 4 },
}));
