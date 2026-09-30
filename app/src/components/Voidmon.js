// Voidmon, Voidation's mascot (an original character by Abhinav Baral).
// The pictures are the PNGs in assets/voidmon/ (see shared/voidmon.js).
//
//   <Voidmon pose="welcome" size={110} />
//   poses: welcome, theme, import, alerts, loading, peeking, sleeping, celebrating, asking
//
//   <VoidmonLoading text="Bringing your list over…" />
//     for waits with no layout to show (import, sync, Rewind). Rows and pages
//     keep their skeletons. Appears only after `delay` ms so quick loads never
//     flash it; the orbit stops spinning when Reduce motion is on.
//
//   <VoidmonEmpty pose="peeking" text="Nothing here yet." />
//     an empty state: Voidmon above a short line of text.
//
//   <VoidmonCheer text="All caught up." />
//     one celebrating Voidmon for a whole list you're caught up on (not one per
//     card: at badge size the eye can't be read, and ten of them is noise).
//
//   <VoidmonTrouble what="Search" onRetry={retry} navigation={navigation} />
//     when AniList couldn't answer. Offline: sleeping Voidmon, "your library
//     works offline" and a button to it; tries again by itself once the phone
//     is back online. Online: AniList is slow or busy, with Try again.
import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Easing, TouchableOpacity } from "react-native";
import { onNetState } from "@voidation/shared/api/anilist";
import { VOIDMON_POSES } from "@voidation/shared/voidmon";
import { useReduceMotion } from "./AnimatedBanner.js";
import { useTheme } from "../context/ThemeContext.js";

// Metro needs every require() spelled out
const PICTURES = {
  welcome: require("../../assets/voidmon/voidmon-welcome.png"),
  theme: require("../../assets/voidmon/voidmon-theme.png"),
  import: require("../../assets/voidmon/voidmon-import.png"),
  alerts: require("../../assets/voidmon/voidmon-alerts.png"),
  loading: require("../../assets/voidmon/voidmon-loading-body.png"),
  peeking: require("../../assets/voidmon/voidmon-peeking.png"),
  sleeping: require("../../assets/voidmon/voidmon-sleeping.png"),
  celebrating: require("../../assets/voidmon/voidmon-celebrating.png"),
  asking: require("../../assets/voidmon/voidmon-asking.png"),
};
const ORBIT = require("../../assets/voidmon/voidmon-loading-orbit.png");

function Orbit({ width, height, still }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { spin.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [still, spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height, transform: [{ rotate }] }}>
      <Image source={ORBIT} style={{ width, height }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function Voidmon({ pose = "welcome", size = 120, style }) {
  const still = useReduceMotion();
  const key = PICTURES[pose] ? pose : "welcome";
  const { ratio, label } = VOIDMON_POSES[key];
  const width = size;
  const height = Math.round(size * ratio);
  return (
    <View style={[{ width, height }, style]} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Image source={PICTURES[key]} style={{ width, height }} resizeMode="contain" fadeDuration={0} />
      {key === "loading" && <Orbit width={width} height={height} still={still} />}
    </View>
  );
}

export function VoidmonLoading({ text, size = 110, delay = 600, style, textColor }) {
  const { C } = useTheme();
  const [show, setShow] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return undefined;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return (
    <View style={[{ alignItems: "center", paddingVertical: 12 }, style]} accessibilityLiveRegion="polite">
      <Voidmon pose="loading" size={size} />
      {!!text && <Text style={{ color: textColor || C.sub, fontSize: 13, marginTop: 6, textAlign: "center" }}>{text}</Text>}
    </View>
  );
}

export function VoidmonEmpty({ pose = "peeking", text, size, style, children }) {
  const { C } = useTheme();
  return (
    <View style={[{ alignItems: "center", paddingHorizontal: 24, marginTop: 28 }, style]}>
      <Voidmon pose={pose} size={size || (pose === "peeking" ? 180 : 120)}
        style={pose === "peeking" ? { borderBottomWidth: 2, borderBottomColor: C.border } : null} />
      {!!text && <Text style={{ color: C.faint, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 10 }}>{text}</Text>}
      {children}
    </View>
  );
}

export function useOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => onNetState((n) => setOffline(!!n.offline)), []);
  return offline;
}

export function VoidmonTrouble({ what = "This page", onRetry, navigation, style }) {
  const { C } = useTheme();
  const offline = useOffline();
  const wasOffline = useRef(offline);
  // back online: try again without making you tap
  useEffect(() => {
    if (wasOffline.current && !offline) onRetry?.();
    wasOffline.current = offline;
  }, [offline, onRetry]);
  const btn = { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1 };
  return (
    <VoidmonEmpty pose="sleeping" style={style}
      text={offline
        ? `You're offline. ${what} needs the internet, but your library and everything you've opened before still work.`
        : "AniList is slow or busy right now. It usually wakes up in a moment."}>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
        {offline && navigation && (
          <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Library" })}
            style={[btn, { backgroundColor: C.purple, borderColor: C.purple }]} accessibilityRole="button">
            <Text style={{ color: "#fff", fontWeight: "800" }}>Open my library</Text>
          </TouchableOpacity>
        )}
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={[btn, { borderColor: C.border, backgroundColor: C.card }]} accessibilityRole="button">
            <Text style={{ color: C.text, fontWeight: "800" }}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    </VoidmonEmpty>
  );
}

export function VoidmonCheer({ text = "All caught up.", sub, style }) {
  const { C } = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 }, style]}>
      <Voidmon pose="celebrating" size={56} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.green, fontWeight: "800", fontSize: 14 }}>{text}</Text>
        {!!sub && <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
    </View>
  );
}
