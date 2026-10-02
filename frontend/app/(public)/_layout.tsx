// Public website route group layout: RTL gate, header, bottom nav (mobile).
// Pages render their own scroll content and include <PublicFooter /> at the end.
import { Slot } from "expo-router";
import { View } from "react-native";

import { BottomNav, PublicHeader, RtlGate } from "@/src/components/public/chrome";
import { useTheme } from "@/src/theme";

export default function PublicLayout() {
  const { colors } = useTheme();
  return (
    <RtlGate>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <PublicHeader />
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
        <BottomNav />
      </View>
    </RtlGate>
  );
}
