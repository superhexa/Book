// Skeleton loaders — shimmering placeholders for all async content.
import { useEffect, useRef } from "react";
import { Animated, DimensionValue, View } from "react-native";

import { radius, useTheme } from "@/src/theme";

function usePulse(): Animated.Value {
  const v = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius: r = radius.sm,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: any;
}) {
  const { colors } = useTheme();
  const opacity = usePulse();
  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.surfaceTertiary, opacity }, style]}
    />
  );
}

export function CardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <View style={{ width: "100%", gap: 10, marginBottom: 16 }}>
      <Skeleton height={height} radius={radius.lg} />
      <Skeleton width="70%" height={18} />
      <Skeleton width="45%" height={14} />
    </View>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={{ width: "100%", gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={{ width: "100%", gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Skeleton width={28} height={28} radius={radius.pill} />
          <Skeleton width="40%" height={16} />
          <View style={{ flex: 1 }} />
          <Skeleton width={60} height={16} />
        </View>
      ))}
    </View>
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ width: "100%", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} height={14} />
      ))}
    </View>
  );
}
