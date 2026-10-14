// The very first screen: a drifting wall of anime covers and a swipe-to-start
// button. Shown on first launch (App picks it as the starting screen) and again
// from More > Help > Welcome tour. Swiping goes to Onboarding.
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoverWall from "../../components/welcome/CoverWall";
import SwipeButton from "../../components/welcome/SwipeButton";
import { useLogo } from "../../components/brand/Brand";
import { getCoversForWelcome } from "../../services/swipeCovers";

const COPY = {
  title: "Track every anime, manga and novel",
  sub: "Discover new stories, keep up with your favorites, and never miss a release. All in one place.",
  button: "Let’s go",
};

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const logo = useLogo();
  const [covers, setCovers] = useState(null);

  useEffect(() => {
    let live = true;
    getCoversForWelcome().then((c) => live && setCovers(c)).catch(() => {});
    return () => { live = false; };
  }, []);

  // replace, not navigate: Welcome leaves the stack, so when Onboarding finishes
  // it lands on Main (first run) or goes back to More (the tour)
  const start = () => navigation.replace("Onboarding");

  return (
    <View style={s.root}>
      {covers && <CoverWall covers={covers} />}
      <View style={[s.content, { paddingBottom: insets.bottom + 28 }]}>
        <Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="Voidation" />
        <Text style={s.title} accessibilityRole="header">{COPY.title}</Text>
        <Text style={s.sub}>{COPY.sub}</Text>
        <SwipeButton
          label={COPY.button}
          knobSource={require("../../../assets/voidmon/voidmon-corrupted-knob.png")}
          onComplete={start}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 28, gap: 14 },
  logo: { width: 72, height: 72 },
  title: { color: "#fff", fontSize: 36, fontWeight: "800", textAlign: "center", lineHeight: 42, marginTop: 10 },
  sub: { color: "rgba(255,255,255,0.78)", fontSize: 16, lineHeight: 23, textAlign: "center", marginBottom: 18, maxWidth: 340 },
});
