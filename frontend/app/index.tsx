import { Redirect } from "expo-router";
import { View } from "react-native";

import { useAuth } from "@/src/auth";
import { Loading } from "@/src/ui";
import { useTheme } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Loading />
      </View>
    );
  }

  if (!user) return <Redirect href="/landing" />;

  const roles = user.roles;
  if (roles.includes("super_admin") || roles.includes("admin")) return <Redirect href="/admin-overview" />;
  if (roles.includes("owner")) return <Redirect href="/dashboard" />;
  return <Redirect href="/discover" />;
}
