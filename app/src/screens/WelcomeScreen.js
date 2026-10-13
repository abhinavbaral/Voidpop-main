// The first screen on every launch (see App.js): a tilted wall of anime posters,
// the logo in a white disc, a headline, and a "swipe for start" slider.
//   - The slider is there from the first frame; nothing waits on the network.
//   - The poster wall comes from the last launch (links saved on the phone, the
//     images themselves sit in the image cache), so it appears instantly. Fresh
//     posters are fetched quietly in the background for the NEXT launch.
//   - Very first launch only: dark placeholder tiles, then the posters fade in.
//   - In the background it also warms Explore's data, so Explore opens filled.
//   - Always dark, whatever theme is chosen: it's a splash, like the artwork.
//   - Built from what the app already has (Animated, PanResponder, SVG), so it
//     ships as a normal `eas update`, no new native build.
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Animated, PanResponder, StyleSheet, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { loadExplorePools } from "@voidation/shared/explore";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { isOnboarded, getLibrary, getExcited } from "@voidation/shared/backend/store";
import { LOGOS } from "../components/Brand.js";

// ---- the words (change them here) -------------------------------------------
const TITLE = "Start Stream\nUnlimited Anime";
const SUBTITLE = "Discover thousands of series and movies tailored to your taste.";
const SWIPE_LABEL = "SWIPE FOR START";

// ---- colours ----------------------------------------------------------------
const BG = "#05060a";
const POSTER_KEY = "voidation_welcome_posters"; // poster links from the last launch

// ---- poster wall ------------------------------------------------------------
const COLS = 4;
const GAP = 12;
const TILT = "14deg";
// how far each column starts above/below the first row, as a share of a poster
const COL_SHIFT = [0.0, -0.55, -0.2, -0.75];

function PosterWall({ posters, width, height }) {
  const pw = Math.round(width * 0.36);
  const ph = Math.round(pw * 1.46);
  // the wall is bigger than the screen so the tilt never shows an edge
  const wallW = COLS * (pw + GAP);
  const wallH = Math.round(height * 1.35);
  const rows = Math.ceil(wallH / (ph + GAP)) + 2;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (posters.length) Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [posters.length, fade]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: wallW,
        height: wallH,
        left: (width - wallW) / 2 - width * 0.04,
        top: -height * 0.12,
        flexDirection: "row",
        gap: GAP,
        opacity: fade,
        transform: [{ rotate: TILT }],
      }}
    >
      {Array.from({ length: COLS }, (_, c) => (
        <View key={c} style={{ width: pw, gap: GAP, marginTop: COL_SHIFT[c] * ph }}>
          {Array.from({ length: rows }, (_, r) => {
            // walk through the list with a different start per column, so
            // neighbours never show the same poster
            const p = posters[(c * 5 + r * 3 + c * r) % posters.length];
            return (
              <Image
                key={r}
                source={{ uri: p.imageSmall || p.image }}
                style={{ width: pw, height: ph, borderRadius: 14, backgroundColor: "#12151f" }}
                resizeMode="cover"
                fadeDuration={0}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

// dark placeholder tiles for when there are no posters yet (offline)
function PlaceholderWall({ width, height }) {
  const pw = Math.round(width * 0.36);
  const ph = Math.round(pw * 1.46);
  const wallW = COLS * (pw + GAP);
  const wallH = Math.round(height * 1.35);
  const rows = Math.ceil(wallH / (ph + GAP)) + 2;
  return (
    <View pointerEvents="none" style={{
      position: "absolute", width: wallW, height: wallH,
      left: (width - wallW) / 2 - width * 0.04, top: -height * 0.12,
      flexDirection: "row", gap: GAP, transform: [{ rotate: TILT }],
    }}>
      {Array.from({ length: COLS }, (_, c) => (
        <View key={c} style={{ width: pw, gap: GAP, marginTop: COL_SHIFT[c] * ph }}>
          {Array.from({ length: rows }, (_, r) => (
            <View key={r} style={{ width: pw, height: ph, borderRadius: 14, backgroundColor: (c + r) % 2 ? "#10131c" : "#151927" }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ---- swipe slider -------------------------------------------------------------
const KNOB_H = 46;
const KNOB_W = 62; // Voidmon is wider than tall
const PAD = 7;
const KNOB_PIC = require("../../assets/voidmon/voidmon-corrupted-knob.png");

function SwipeButton({ width, onComplete }) {
  const maxX = width - KNOB_W - PAD * 2;
  const maxRef = useRef(maxX);
  maxRef.current = maxX;
  const doneRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const x = useRef(new Animated.Value(0)).current;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(x, { toValue: maxRef.current, duration: 140, useNativeDriver: true }).start(() => completeRef.current());
  };
  const snapBack = () => Animated.spring(x, { toValue: 0, bounciness: 8, useNativeDriver: true }).start();

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !doneRef.current,
    onMoveShouldSetPanResponder: () => !doneRef.current,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(maxRef.current, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (g.dx > maxRef.current * 0.65 || (g.vx > 1.1 && g.dx > maxRef.current * 0.3)) finish();
      else snapBack();
    },
    onPanResponderTerminate: snapBack,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [x]);

  // the label fades out as the knob passes over it
  const labelOpacity = x.interpolate({ inputRange: [0, maxX * 0.55], outputRange: [1, 0], extrapolate: "clamp" });

  return (
    <View
      style={[styles.pill, { width }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Swipe for start"
      accessibilityHint="Double tap to start"
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={finish}
    >
      <Animated.Text style={[styles.pillText, { opacity: labelOpacity }]}>{SWIPE_LABEL}</Animated.Text>
      <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <Image source={KNOB_PIC} style={{ width: KNOB_W, height: KNOB_H }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" />
      </Animated.View>
    </View>
  );
}

// ---- screen -------------------------------------------------------------------
export default function WelcomeScreen({ navigation, route }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const [posters, setPosters] = useState([]);
  const tour = !!route?.params?.tour;

  // the logo you picked in More › Appearance; the dark-on-light version, since
  // it sits on a white disc
  const logo = (LOGOS[settings?.logo] || LOGOS.classic).light;

  useEffect(() => {
    let alive = true;
    let shown = false; // is a wall on screen already?
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const within = (p, ms) => Promise.race([p, wait(ms)]);
    const url = (i) => i.imageSmall || i.image;

    // 1. last launch's posters: straight onto the screen
    AsyncStorage.getItem(POSTER_KEY).then((raw) => {
      const saved = raw ? JSON.parse(raw) : [];
      if (alive && Array.isArray(saved) && saved.length >= 8) { shown = true; setPosters(saved); }
    }).catch(() => {});

    // 2. in the background: fresh posters for next time (and for this screen
    //    if there was nothing saved yet), plus Explore's data so it opens filled
    const comingUp = (async () => {
      const [lib, ex] = await Promise.all([getLibrary(), getExcited()]);
      const picked = [
        ...Object.values(lib).filter((e) => e.status === "watching"),
        ...Object.values(ex),
      ].map((e) => e.item).filter((i) => i.segment === "anime");
      await fetchNextEpisodes([...new Set(picked.map((i) => i.id))]);
    })().catch(() => {});

    (async () => {
      await wait(400); // let the first frame draw before any network work
      let pools = null;
      for (let i = 0; i < 3 && alive; i++) { // AniList can be briefly slow or busy
        pools = await loadExplorePools().catch(() => null);
        if (pools && (pools.trA.length || pools.popA.length)) break;
        await wait(1500);
      }
      if (!alive || !pools) return;
      const seen = new Set();
      const list = [...pools.trA, ...pools.popA]
        .filter((i) => url(i) && !seen.has(i.id) && seen.add(i.id))
        .slice(0, 30)
        .map((i) => ({ id: i.id, imageSmall: url(i) }));
      if (list.length < 8) return;
      // download the covers now so next launch finds them in the image cache
      await within(Promise.all(list.slice(0, 14).map((i) => Image.prefetch(i.imageSmall).catch(() => {}))), 6000);
      AsyncStorage.setItem(POSTER_KEY, JSON.stringify(list)).catch(() => {});
      if (alive && !shown) setPosters(list); // first launch ever: fade the wall in
      await comingUp;
    })();

    return () => { alive = false; };
  }, []);

  // first run (or "Welcome tour" in More): on to the welcome steps.
  // Every other launch: straight into Explore.
  const start = async () => {
    const done = await isOnboarded().catch(() => false);
    if (done && !tour) navigation.replace("Main");
    else navigation.replace("Onboarding");
  };

  const s = Math.min(1.15, width / 390); // text scales a little with the screen
  const sideMargin = Math.round(width * 0.125);
  const discSize = Math.round(84 * s);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {posters.length ? <PosterWall posters={posters} width={width} height={height} /> : <PlaceholderWall width={width} height={height} />}

      {/* darkens the wall, more toward the bottom where the words sit */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BG} stopOpacity="0.25" />
            <Stop offset="0.35" stopColor={BG} stopOpacity="0.38" />
            <Stop offset="0.58" stopColor={BG} stopOpacity="0.78" />
            <Stop offset="0.78" stopColor={BG} stopOpacity="0.94" />
            <Stop offset="1" stopColor={BG} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#shade)" />
      </Svg>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 28 }]}>
        <View style={[styles.discRing, { width: discSize + 12, height: discSize + 12, borderRadius: (discSize + 12) / 2 }]}>
          <View style={[styles.disc, { width: discSize, height: discSize, borderRadius: discSize / 2 }]}>
            <Image source={logo} style={{ width: discSize * 0.82, height: discSize * 0.82 }} resizeMode="contain" accessibilityLabel="Voidation" />
          </View>
        </View>

        <Text style={[styles.title, { fontSize: 34 * s, lineHeight: 42 * s }]} accessibilityRole="header">{TITLE}</Text>
        <Text style={[styles.subtitle, { fontSize: 16 * s, lineHeight: 23 * s, maxWidth: width * 0.72 }]}>{SUBTITLE}</Text>

        <View style={{ marginTop: 30 * s }}>
          <SwipeButton width={width - sideMargin * 2} onComplete={start} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, overflow: "hidden" },
  content: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", alignItems: "center" },
  discRing: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.28)", marginBottom: 22 },
  disc: { backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 8 },
  title: { color: "#fff", fontWeight: "800", textAlign: "center", letterSpacing: 0.2 },
  subtitle: { color: "rgba(255,255,255,0.82)", textAlign: "center", marginTop: 14 },
  pill: { height: KNOB_H + PAD * 2, borderRadius: (KNOB_H + PAD * 2) / 2, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  pillText: { color: "#111", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  knob: { position: "absolute", left: PAD, top: PAD, width: KNOB_W, height: KNOB_H, alignItems: "center", justifyContent: "center" },
});
