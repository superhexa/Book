import { Redirect } from "expo-router";
import { CalendarBlank, Heart, MagnifyingGlass, User } from "phosphor-react-native";

import { useAuth } from "@/src/auth";
import { useI18n } from "@/src/preferences";
import { RoleTabs } from "@/src/role-tabs";
import { Loading } from "@/src/ui";

export default function CustomerLayout() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;

  return (
    <RoleTabs
      tabs={[
        { name: "discover", title: t("discover"), sf: "magnifyingglass", icon: (c, s) => <MagnifyingGlass size={s} color={c} weight="regular" /> },
        { name: "my-bookings", title: t("bookings"), sf: "calendar", icon: (c, s) => <CalendarBlank size={s} color={c} weight="regular" /> },
        { name: "favorites", title: t("favorites"), sf: "heart", icon: (c, s) => <Heart size={s} color={c} weight="regular" /> },
        { name: "profile", title: t("profile"), sf: "person", icon: (c, s) => <User size={s} color={c} weight="regular" /> },
      ]}
    />
  );
}
