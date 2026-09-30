// An animated scene used where a page has no banner image (idea from Animite's
// shader banners, drawn here with SVG + native-driver animations so it needs
// no native code): a sky tinted with the page's colour, mountains, and — by
// local time — a slowly floating sun with drifting clouds (day) or a moon with
// twinkling stars (night). Motion stops when the phone's Reduce motion is on.
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Animated, Easing, AccessibilityInfo, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { parseHex, toHex } from "@voidation/shared/color";

const mixHex = (a, b, t) => {
  const x = parseHex(a) || [168, 85, 247];
  const y = parseHex(b) || [0, 0, 0];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
// deterministic "random" so stars don't jump around between renders
const rand = (i) => { const x = Math.sin(i * 999.13) * 10000; return x - Math.floor(x); };

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduce);
    return () => sub?.remove?.();
  }, []);
  return reduce;
}

// a looping 0 → 1 animation value
function useLoop(duration, { delay = 0, still = false, back = true } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { v.setValue(0.5); return undefined; }
    const steps = [Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true })];
    if (back) steps.push(Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    else steps.push(Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }));
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [duration, delay, still, back, v]);
  return v;
}

function Star({ x, y, size, delay, still }) {
  const t = useLoop(1800 + delay, { delay, still });
  return <Animated.View style={[styles.star, { left: x, top: y, width: size, height: size, borderRadius: size / 2, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]} />;
}

function Cloud({ y, width, speed, offset, still, color }) {
  const t = useLoop(speed, { delay: offset, still, back: false });
  return (
    <Animated.View style={[styles.cloud, { top: y, backgroundColor: color,
      transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-140, width + 40] }) }] }]}>
      <View style={[styles.puff, { backgroundColor: color, left: 18, top: -12, width: 40, height: 40 }]} />
      <View style={[styles.puff, { backgroundColor: color, left: 46, top: -6, width: 30, height: 30 }]} />
    </Animated.View>
  );
}

export default function AnimatedBanner({ accent = "#a855f7", height = 180, dark = true, night: forceNight }) {
  const [width, setWidth] = useState(0);
  const still = useReduceMotion();
  const hour = new Date().getHours();
  const night = forceNight ?? (hour < 6 || hour >= 19);
  const float = useLoop(5200, { still });

  const c = useMemo(() => night
    ? { top: "#060913", bottom: mixHex(accent, "#0b0f19", 0.55), far: mixHex(accent, "#0b0f19", 0.72), near: mixHex(accent, "#05070d", 0.86), cloud: "rgba(255,255,255,0.06)" }
    : { top: mixHex(accent, "#ffffff", 0.45), bottom: mixHex(accent, "#fff4e0", 0.78), far: mixHex(accent, "#ffffff", 0.2), near: mixHex(accent, "#0b0f19", 0.35), cloud: "rgba(255,255,255,0.85)" },
  [accent, night]);

  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: rand(i + 1) * width, y: rand(i + 50) * height * 0.55, size: 1.5 + rand(i + 99) * 2, delay: Math.round(rand(i + 7) * 1600) })), [width, height]);
  const w = width || 1;
  const h = height;
  // two ridges of mountains, the near one with a tall centre peak
  const far = `M0 ${h * 0.72} L${w * 0.12} ${h * 0.55} L${w * 0.24} ${h * 0.66} L${w * 0.38} ${h * 0.5} L${w * 0.52} ${h * 0.63} L${w * 0.68} ${h * 0.48} L${w * 0.84} ${h * 0.62} L${w} ${h * 0.54} L${w} ${h} L0 ${h} Z`;
  const near = `M0 ${h * 0.86} L${w * 0.18} ${h * 0.74} L${w * 0.32} ${h * 0.8} L${w * 0.5} ${h * 0.46} L${w * 0.56} ${h * 0.5} L${w * 0.6} ${h * 0.47} L${w * 0.78} ${h * 0.76} L${w} ${h * 0.7} L${w} ${h} L0 ${h} Z`;
  const snow = `M${w * 0.44} ${h * 0.57} L${w * 0.5} ${h * 0.46} L${w * 0.56} ${h * 0.5} L${w * 0.6} ${h * 0.47} L${w * 0.645} ${h * 0.55} L${w * 0.6} ${h * 0.53} L${w * 0.56} ${h * 0.57} L${w * 0.5} ${h * 0.53} Z`;

  return (
    <View style={{ height, overflow: "hidden" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible={false} importantForAccessibility="no-hide-descendants">
      {width > 0 && (
        <>
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.top} />
                <Stop offset="1" stopColor={c.bottom} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={w} height={h} fill="url(#sky)" />
          </Svg>
          {night && stars.map((s, i) => <Star key={i} {...s} still={still} />)}
          <Animated.View style={[styles.orb, night ? styles.moon : styles.sun,
            { left: w * 0.72, top: h * 0.14, transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) }] }]} />
          {!night && [0, 1, 2].map((i) => (
            <Cloud key={i} y={h * (0.12 + i * 0.13)} width={w} speed={38000 + i * 14000} offset={i * 9000} still={still} color={c.cloud} />
          ))}
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Path d={far} fill={c.far} opacity={night ? 0.9 : 0.55} />
            <Path d={near} fill={c.near} />
            <Path d={snow} fill={night ? "#cfd6e6" : "#ffffff"} opacity={0.9} />
          </Svg>
          {/* fade into the page below */}
          <View style={[styles.fade, { backgroundColor: dark ? "rgba(11,15,25,0.35)" : "rgba(255,255,255,0.25)" }]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  star: { position: "absolute", backgroundColor: "#ffffff" },
  orb: { position: "absolute", width: 42, height: 42, borderRadius: 21 },
  sun: { backgroundColor: "#ffd27a", shadowColor: "#ffb347", shadowOpacity: 0.9, shadowRadius: 18, elevation: 8 },
  moon: { backgroundColor: "#f2efe4", shadowColor: "#ffffff", shadowOpacity: 0.6, shadowRadius: 14, elevation: 6 },
  cloud: { position: "absolute", left: 0, width: 96, height: 22, borderRadius: 11 },
  puff: { position: "absolute", borderRadius: 999 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 18 },
});
