// Pulsing skeleton block for loading states (theme-aware).
import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function Skeleton({ width, height, style, radius = 12 }) {
  const { C } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: C.border, opacity },
        style,
      ]}
    />
  );
}

// Placeholder shapes that match the real layouts, so the page doesn't jump
// when content arrives.

// list rows: thumbnail + two text lines (History, Out this week, More pages)
export function SkeletonList({ rows = 5, thumb = true, style }) {
  return (
    <View style={[{ paddingHorizontal: 14, paddingTop: 8, gap: 14 }, style]} accessibilityLabel="Loading" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {thumb && <Skeleton width={42} height={58} radius={6} />}
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={`${70 - (i % 3) * 12}%`} height={12} radius={4} />
            <Skeleton width={`${40 + (i % 2) * 15}%`} height={10} radius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

// poster grid (Season chart, Browse)
export function SkeletonGrid({ columns = 3, rows = 3, style }) {
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", padding: 6 }, style]} accessibilityLabel="Loading" accessible>
      {Array.from({ length: columns * rows }, (_, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, padding: 6, gap: 6 }}>
          <Skeleton width="100%" height={150} radius={10} />
          <Skeleton width="80%" height={10} radius={4} />
        </View>
      ))}
    </View>
  );
}

// a person / title header: photo + lines
export function SkeletonHeader({ style }) {
  return (
    <View style={[{ flexDirection: "row", gap: 14, alignItems: "center" }, style]} accessibilityLabel="Loading" accessible>
      <Skeleton width={96} height={128} radius={10} />
      <View style={{ flex: 1, gap: 10 }}>
        <Skeleton width="75%" height={18} radius={5} />
        <Skeleton width="45%" height={12} radius={4} />
        <Skeleton width="60%" height={12} radius={4} />
      </View>
    </View>
  );
}
