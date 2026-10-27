// The first screen on every launch: a drifting wall of anime covers and an arrow
// button (App starts here, see hooks/useInitialRoute). Also opened from
// More > Help > Welcome tour.
// The button goes to Main, or to Onboarding on a first run and for the tour.
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CoverWall from "../../components/welcome/CoverWall";
import ArrowButton from "../../components/welcome/ArrowButton";
import { useLogo } from "../../components/brand/Brand";
import { isOnboarded } from "@voidpop/shared/backend/store";
import { shouldAskSignIn } from "@voidpop/shared/api/community";
import { getCoversForWelcome } from "../../services/swipeCovers";

const COPY = {
  title: "Track every anime, manga and novel",
  sub: "Discover new stories, keep up with your favorites, and never miss a release. All in one place.",
  button: "Let’s go",
};

export default function WelcomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const logo = useLogo();
  const [covers, setCovers] = useState(null);

  useEffect(() => {
    let live = true;
    getCoversForWelcome().then((c) => live && setCovers(c)).catch(() => {});
    return () => { live = false; };
  }, []);

  // replace, not navigate: Welcome leaves the stack. Returning users go straight
  // to Main; a first run (or the tour from More) goes through Onboarding, which
  // lands on Main (first run) or goes back to More (the tour) when it finishes.
  const start = async () => {
    // a build with a VoidPop server: offer sign-in (or guest) first, once. Not for the tour from More.
    if (!route?.params?.tour && await shouldAskSignIn().catch(() => false)) { navigation.replace("SignIn"); return; }
    const done = await isOnboarded().catch(() => true); // can't read it: don't trap the user in Onboarding
    if (done && !route?.params?.tour) navigation.replace("Main");
    else navigation.replace("Onboarding");
  };

  return (
    <View style={s.root}>
      {covers && <CoverWall covers={covers} />}
      <View style={[s.content, { paddingBottom: insets.bottom + 28 }]}>
        <Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="VoidPop" />
        <Text style={s.title} accessibilityRole="header">{COPY.title}</Text>
        <Text style={s.sub}>{COPY.sub}</Text>
        <ArrowButton label={COPY.button} onPress={start} />
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
