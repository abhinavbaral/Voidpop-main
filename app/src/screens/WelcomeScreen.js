// First screen on a fresh install: a tilted wall of anime posters, the logo in
// a white disc, a headline, and a "swipe for start" slider. Swiping all the way
// opens the welcome steps (OnboardingScreen) on a first run, or the app after that.
// It shows on every launch (see App.js).
//   - Posters come from AniList (popular anime). Offline, dark placeholder
//     tiles fill the wall instead.
//   - Always dark, whatever theme is chosen: it's a splash, like the artwork.
//   - Built from what the app already has (Animated, PanResponder, SVG), so it
//     ships as a normal `eas update`, no new native build.
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Animated, PanResponder, StyleSheet, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import { fetchAniList } from "@voidation/shared/api/anilist";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { isOnboarded } from "@voidation/shared/backend/store";
import { LOGOS } from "../components/Brand.js";

// ---- the words (change them here) -------------------------------------------
const TITLE = "Start Stream\nUnlimited Anime";
const SUBTITLE = "Discover thousands of series and movies tailored to your taste.";
const SWIPE_LABEL = "SWIPE FOR START";

// ---- colours ----------------------------------------------------------------
const RED = "#e50914";
const BG = "#05060a";

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
const KNOB = 46;
const PAD = 7;

function DoubleChevron({ size = 20, color = "#fff" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 6l6 6-6 6" />
      <Path d="M12 6l6 6-6 6" />
    </Svg>
  );
}

function SwipeButton({ width, onComplete }) {
  const maxX = width - KNOB - PAD * 2;
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
        <DoubleChevron />
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

  // the logo you picked in More › Appearance; the dark-on-light version, since
  // it sits on a white disc
  const logo = (LOGOS[settings?.logo] || LOGOS.classic).light;

  useEffect(() => {
    let alive = true;
    fetchAniList("anime", { sort: "popular", perPage: 30 })
      .then((r) => { if (alive) setPosters(r.items.filter((i) => i.imageSmall || i.image)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // first run (or "Welcome tour" in More): on to the welcome steps.
  // Every other launch: straight into the app.
  const start = async () => {
    const done = await isOnboarded().catch(() => false);
    if (done && !route?.params?.tour) navigation.goBack();
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
  pill: { height: KNOB + PAD * 2, borderRadius: (KNOB + PAD * 2) / 2, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  pillText: { color: "#111", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  knob: { position: "absolute", left: PAD, top: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: RED, alignItems: "center", justifyContent: "center" },
});
