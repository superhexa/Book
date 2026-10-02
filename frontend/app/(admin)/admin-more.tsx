import { router } from "expo-router";
import { ClockCounterClockwise, ShieldCheck } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileView } from "@/src/components/profile-view";
import { fontSize, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function AdminMore() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const links = [
    { title: "Roles & Permissions", subtitle: "Manage RBAC roles", icon: <ShieldCheck size={22} color={colors.brandPrimary} />, to: "/admin/roles" },
    { title: "Audit Logs", subtitle: "Security & admin activity", icon: <ClockCounterClockwise size={22} color={colors.brandPrimary} />, to: "/admin/audit" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Text style={[s.title, { marginTop: insets.top + spacing.lg }]}>More</Text>
      <View style={s.group}>
        {links.map((l) => (
          <Pressable key={l.to} testID={`more-${l.to}`} onPress={() => router.push(l.to as any)} style={s.link}>
            {l.icon}
            <View style={{ flex: 1 }}>
              <Text style={s.linkTitle}>{l.title}</Text>
              <Text style={s.linkSub}>{l.subtitle}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <ProfileView />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  title: { color: c.onSurface, fontSize: fontSize["2xl"], fontWeight: "600", paddingHorizontal: spacing.lg },
  group: { padding: spacing.lg, gap: spacing.sm },
  link: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  linkTitle: { color: c.onSurface, fontSize: fontSize.lg, fontWeight: "600" },
  linkSub: { color: c.muted, fontSize: fontSize.base },
}));
