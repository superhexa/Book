import { Redirect } from "expo-router";
import { ChartLineUp, Gear, SquaresFour, Ticket } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/preferences";
import { RoleTabs } from "@/src/role-tabs";
import { Loading } from "@/src/ui";

export default function OwnerLayout() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  if (!user.roles.includes("owner") && !user.roles.includes("super_admin")) return <Redirect href="/discover" />;

  return (
    <RoleTabs
      tabs={[
        { name: "dashboard", title: t("dashboard"), sf: "chart.bar", icon: (c, s) => <ChartLineUp size={s} color={c} /> },
        { name: "owner-bookings", title: t("bookings"), sf: "ticket", icon: (c, s) => <Ticket size={s} color={c} /> },
        { name: "my-fields", title: t("fields"), sf: "square.grid.2x2", icon: (c, s) => <SquaresFour size={s} color={c} /> },
        { name: "owner-profile", title: t("profile"), sf: "gearshape", icon: (c, s) => <Gear size={s} color={c} /> },
      ]}
    />
  );
}
