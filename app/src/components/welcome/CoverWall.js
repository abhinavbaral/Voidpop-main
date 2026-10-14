import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const TILE_W = 132;
const TILE_H = 196;
const GAP = 12;
const COLS = 3;

function Tile({ cover }) {
  const style = {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    marginBottom: GAP,
    backgroundColor: cover.color ?? "#161b22",
  };
  if (!cover.uri) return <View style={style} />;
  return <Image source={{ uri: cover.uri }} cachePolicy="disk" contentFit="cover" style={style} />;
}

function Column({ items, dir, seconds, phase, still }) {
  const loop = items.length * (TILE_H + GAP);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    const a = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: true }),
    );
    a.start();
    return () => a.stop();
  }, [still, seconds, t]);

  const from = -loop * phase;
  const to = from - loop;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: dir === "up" ? [from, to] : [to, from] });

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      {/* tripled so the loop never shows a seam */}
      {[...items, ...items, ...items].map((c, i) => (
        <Tile key={`${c.id}-${i}`} cover={c} />
      ))}
    </Animated.View>
  );
}

export default function CoverWall({ covers }) {
  const { width, height } = useWindowDimensions();
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill);
  }, []);

  const cols = useMemo(() => Array.from({ length: COLS }, (_, c) => covers.filter((_, i) => i % COLS === c)), [covers]);
  const size = Math.hypot(width, height) * 1.1;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          left: (width - size) / 2,
          top: (height - size) / 2,
          overflow: "hidden",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: GAP,
          transform: [{ rotate: "-12deg" }, { scale: 1.15 }],
        }}
      >
        {cols.map((items, c) => (
          <Column
            key={c}
            items={items}
            dir={c % 2 ? "down" : "up"}
            seconds={[70, 90, 80][c]}
            phase={[0, 0.35, 0.15][c]}
            still={still}
          />
        ))}
      </View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
      <LinearGradient colors={["transparent", "#000"]} locations={[0.45, 0.8]} style={StyleSheet.absoluteFill} />
    </View>
  );
}
