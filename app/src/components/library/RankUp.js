// Rank-up celebration: when you reach a new rank ("You are an Elite"), a
// full-screen medal pops in, glows and shines, with confetti. Shown once per rank.
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Animated, Easing, StyleSheet, useWindowDimensions, AccessibilityInfo } from "react-native";
import { checkRankUp, markRankSeen, onDataChange, onCelebrate, TIERS } from "@voidation/shared/backend/store";
import Icon from "../ui/Icon.js";

const COLORS = ["#a855f7", "#ee8f2e", "#22d3ee", "#10b981", "#f43f5e", "#f59e0b"];

export default function RankUp() {
  const [tier, setTier] = useState(null);
  const check = useCallback(() => { checkRankUp().then((t) => t && setTier(t)).catch(() => {}); }, []);
  useEffect(() => { check(); return onDataChange(check); }, [check]);
  useEffect(() => onCelebrate(setTier), []); // replay from More → Your badge
  if (!tier) return null;
  return <Celebration tier={tier} onClose={async () => { await markRankSeen(tier.key); setTier(null); }} />;
}

function Celebration({ tier, onClose }) {
  const { width, height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => r && setCalm(true)).catch(() => {});
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ])).start();
    Animated.timing(fall, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }).start();
  }, [pop, spin, glow, text, fall]);

  const rank = TIERS.findIndex((t) => t.key === tier.key) + 1;
  const addict = tier.key === "addicted";
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const rotate = pop.interpolate({ inputRange: [0, 1], outputRange: ["-40deg", "0deg"] });
  const ringRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] });
  const textShift = text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: "#07060d" }]}>
        {!calm && Array.from({ length: 24 }, (_, i) => (
          <Animated.View key={i} pointerEvents="none" style={[styles.confetti, {
            left: ((i * 37) % 100) / 100 * width,
            backgroundColor: COLORS[i % COLORS.length],
            transform: [
              { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-40 - (i % 5) * 60, height + 40] }) },
              { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: [`${(i * 47) % 360}deg`, `${(i * 47) % 360 + 540}deg`] }) },
            ],
          }]} />
        ))}
        <Text style={[styles.eyebrow, { color: tier.color }]}>NEW RANK · {rank} OF {TIERS.length}</Text>
        <Animated.View style={[styles.medal, { transform: calm ? [] : [{ scale }, { rotate }] }]}>
          <Animated.View style={[styles.glow, { backgroundColor: tier.color, opacity: glowOpacity }]} />
          <Animated.View style={[styles.ring, { borderColor: tier.color, transform: calm ? [] : [{ rotate: ringRotate }] }]}>
            <View style={[styles.ringMark, { backgroundColor: "#fff" }]} />
          </Animated.View>
          <View style={styles.face}>
            <Icon name={addict ? "coffee" : "star"} size={32} color={tier.color} fill={!addict} />
            <Text style={[styles.label, { color: tier.color }]}>{tier.label.toUpperCase()}</Text>
            <Text style={styles.min}>{tier.min}+ titles</Text>
          </View>
        </Animated.View>
        <Animated.View style={{ opacity: text, transform: [{ translateY: textShift }], alignItems: "center", gap: 10, paddingHorizontal: 28 }}>
          <Text style={styles.title}>{tier.title}</Text>
          <Text style={styles.message}>{tier.message}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: tier.color }]}>
            <Text style={styles.btnText}>{addict ? "Okay, break time" : "Let's go"}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  confetti: { position: "absolute", top: 0, width: 8, height: 14, borderRadius: 2 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 18 },
  medal: { width: 180, height: 180, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  glow: { position: "absolute", width: 210, height: 210, borderRadius: 105 },
  ring: { position: "absolute", width: 180, height: 180, borderRadius: 90, borderWidth: 12 },
  ringMark: { position: "absolute", top: -9, left: 78, width: 10, height: 10, borderRadius: 5 },
  face: { width: 150, height: 150, borderRadius: 75, backgroundColor: "#171226", alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  min: { color: "#9ca3af", fontSize: 11, fontWeight: "700" },
  title: { color: "#f3f4f6", fontSize: 28, fontWeight: "900", textAlign: "center" },
  message: { color: "#cbd5e1", fontSize: 15, lineHeight: 22, textAlign: "center" },
  btn: { marginTop: 8, borderRadius: 12, paddingHorizontal: 26, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
