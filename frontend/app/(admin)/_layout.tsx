import { Redirect } from "expo-router";
import { ChartBar, DotsThreeCircle, SealCheck, UsersThree } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/preferences";
import { RoleTabs } from "@/src/role-tabs";
import { Loading } from "@/src/ui";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  const isAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  if (!isAdmin) return <Redirect href="/discover" />;

  return (
    <RoleTabs
      tabs={[
        { name: "admin-overview", title: t("overview"), sf: "chart.bar", icon: (c, s) => <ChartBar size={s} color={c} /> },
        { name: "admin-users", title: t("users"), sf: "person.3", icon: (c, s) => <UsersThree size={s} color={c} /> },
        { name: "admin-facilities", title: t("verify"), sf: "checkmark.seal", icon: (c, s) => <SealCheck size={s} color={c} /> },
        { name: "admin-more", title: t("more"), sf: "ellipsis.circle", icon: (c, s) => <DotsThreeCircle size={s} color={c} /> },
      ]}
    />
  );
}
