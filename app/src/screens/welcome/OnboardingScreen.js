// First-run welcome, shown once (More > Help can show it again):
//   1. Welcome   2. Rating (the four Void Verdicts)   3. Look (light / dark and a
//   colour)   4. Bring your list (MAL file / AniList username / start fresh)
//   5. Never miss an episode (alerts)   → Explore
// Every step can be skipped; nothing here is required to use the app.
// Voidmon (the mascot) guides each step.
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { readAsStringAsync } from "expo-file-system/legacy";
import { setOnboarded, importAniListEntries, VERDICTS } from "@voidpop/shared/backend/store";
import { THEMES, PALETTES } from "@voidpop/shared/lib/theme";
import { fetchAniListUserList } from "@voidpop/shared/api/anilist";
import { importMalFile, base64ToBytes } from "@voidpop/shared/features/malImport";
import { useTheme } from "../../context/ThemeContext.js";
import { ensurePermission, rescheduleEpisodeAlerts } from "../../services/episodeAlerts";
import AnimatedBanner from "../../components/brand/AnimatedBanner.js";
import Icon from "../../components/ui/Icon.js";
import { useLogo } from "../../components/brand/Brand.js";
import Voidmon, { VoidmonLoading } from "../../components/brand/Voidmon.js";

const STEPS = 5;

// what each verdict means, in words that fit a film, a show, a manga or a novel
const VERDICT_INFO = {
  peak: { icon: "heart", sub: "An all-time favorite" }, // not a star: Void Verdicts replace star ratings
  divein: { icon: "check", sub: "Worth your time" },
  onetime: { icon: "clock", sub: "Good once, no need to return" },
  voidit: { icon: "close", sub: "Not for me" },
};

export default function OnboardingScreen({ navigation }) {
  const { C, dark, pref, setPref, pureBlack, setPureBlack, palette, setPalette } = useTheme();
  const styles = makeStyles(C);
  const logo = useLogo();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState("");
  const [alerts, setAlerts] = useState(null);
  const [demoVerdict, setDemoVerdict] = useState("peak"); // only highlights a row here; nothing is saved

  const finish = async () => {
    await setOnboarded(true);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  };
  const next = () => { setMessage(""); if (step < STEPS - 1) setStep(step + 1); else finish(); };

  const run = async (fn) => { setBusy(true); setMessage(""); try { await fn(); } finally { setBusy(false); } };
  const importMal = () => run(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const r = await importMalFile(base64ToBytes(await readAsStringAsync(res.assets[0].uri, { encoding: "base64" })));
      setMessage(`Added ${r.added} from MyAnimeList${r.notFound.length ? ` (${r.notFound.length} not found)` : ""}.`);
      rescheduleEpisodeAlerts();
    } catch (e) { setMessage(e?.message?.includes("MyAnimeList") ? e.message : "Couldn't read that file. Pick the .xml.gz from MAL's Export page."); }
  });
  const importAniList = () => run(async () => {
    if (!user.trim()) return;
    try {
      const r = await importAniListEntries(await fetchAniListUserList(user.trim()));
      setMessage(`Added ${r.added} from your list.`);
      rescheduleEpisodeAlerts();
    } catch { setMessage("Couldn't find that username, or the list is private."); }
  });
  const allowAlerts = () => run(async () => { const ok = await ensurePermission(); setAlerts(ok); if (ok) rescheduleEpisodeAlerts(); });

  const Choice = ({ on, label, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.choice, on && styles.choiceOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Text style={[styles.choiceText, on && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );

  // Voidmon with a speech bubble
  const Guide = ({ pose, says }) => (
    <View style={styles.guide}>
      <Voidmon pose={pose} size={96} />
      <View style={styles.bubble}><Text style={styles.bubbleText}>{says}</Text></View>
    </View>
  );

  const pages = [
    // 1. welcome
    <View key="w">
      <View style={styles.hero}>
        <AnimatedBanner accent={C.purple} dark={dark} height={220} />
        <View style={[styles.logoDisc, { backgroundColor: C.bg }]}>
          <Image source={logo} style={{ width: 76, height: 76 }} accessibilityLabel="VoidPop" />
        </View>
      </View>
      <Guide pose="welcome" says="Hi, I'm Voidmon. I'll show you around." />
      <Text style={styles.h1}>Every story you love.{"\n"}All in one place.</Text>
      <Text style={styles.p}>Track anime, manga, novels, movies and TV shows. Your own Void Verdicts, picks made from them and live countdowns. Everything stays on your phone.</Text>
    </View>,
    // 2. rating
    <View key="r">
      <Guide pose="asking" says="Forget the stars. How did it feel?" />
      <Text style={styles.eyebrow}>VOID VERDICTS</Text>
      <Text style={styles.h1}>A better kind of rating</Text>
      <Text style={styles.p}>When you finish something, pick the verdict that sounds like you. Some stories are all-time favorites, some are just right for one evening. Four verdicts say it better than a number.</Text>
      <View style={styles.verdictCard}>
        {VERDICTS.map((v, i) => {
          const on = demoVerdict === v.key;
          return (
            <TouchableOpacity key={v.key} onPress={() => setDemoVerdict(v.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={[styles.verdictRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border }, { borderLeftColor: on ? v.color : "transparent" }, on && { backgroundColor: v.color + "33" }]}>
              <Icon name={VERDICT_INFO[v.key].icon} size={22} color={v.color} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bigTitle}>{v.label}</Text>
                <Text style={styles.small}>{VERDICT_INFO[v.key].sub}</Text>
              </View>
              <View style={[styles.radio, { borderColor: on ? v.color : C.border }]}>{on && <View style={[styles.radioDot, { backgroundColor: v.color }]} />}</View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.small, { textAlign: "center", marginTop: 10 }]}>Tap one to try it. Nothing is saved here.</Text>
    </View>,
    // 3. look
    <View key="t">
      <Guide pose="theme" says="Light or dark? I look good in both." />
      <Text style={styles.h1}>Pick your look</Text>
      <Text style={styles.p}>Light or dark, and a colour. You can change this any time in More › Appearance.</Text>
      <View style={styles.row}>
        {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => <Choice key={k} on={pref === k} label={l} onPress={() => setPref(k)} />)}
      </View>
      <View style={styles.swatches}>
        {PALETTES.map((p) => {
          const on = palette === p.key;
          const color = p.accent ? p.accent[dark ? 0 : 1] : THEMES[dark ? "void" : "pop"].purple;
          return (
            <TouchableOpacity key={p.key} onPress={() => setPalette(p.key)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.label} colour`}
              style={[styles.swatch, on && { borderColor: color }]}>
              <View style={[styles.swatchDot, { backgroundColor: color }]} />
              <Text style={[styles.choiceText, { fontSize: 13 }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={[styles.toggle, pureBlack && styles.choiceOn]} onPress={() => setPureBlack(!pureBlack)} accessibilityRole="switch" accessibilityState={{ checked: pureBlack }}>
        <Text style={[styles.choiceText, pureBlack && { color: "#fff" }]}>Pure black (dark theme, saves battery on OLED)</Text>
      </TouchableOpacity>
    </View>,
    // 4. bring your list
    <View key="l">
      {busy ? <VoidmonLoading text="Bringing your list over…" delay={0} size={96} /> : <Guide pose="import" says="Tracked something somewhere else? I'll carry it over." />}
      <Text style={styles.h1}>Bring your list</Text>
      <Text style={styles.p}>Already track anime or manga somewhere? Bring it over, or start fresh.</Text>
      <TouchableOpacity style={styles.bigBtn} onPress={importMal} disabled={busy}>
        <Icon name="storage" size={20} color={C.purple} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bigTitle}>From MyAnimeList</Text>
          <Text style={styles.small}>On myanimelist.net: Profile › Export Lists, then pick the file here.</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.bigBtn}>
        <Icon name="sync" size={20} color={C.purple} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bigTitle}>From a username</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput value={user} onChangeText={setUser} placeholder="Username" placeholderTextColor={C.faint} autoCapitalize="none"
              style={styles.input} onSubmitEditing={importAniList} returnKeyType="go" />
            <TouchableOpacity style={[styles.smallBtn, !user.trim() && { opacity: 0.5 }]} onPress={importAniList} disabled={busy || !user.trim()}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Import</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.small}>For two-way sync, sign in later in More › Sync.</Text>
        </View>
      </View>
      {!!message && <Text style={[styles.p, { color: C.text, marginTop: 10 }]}>{message}</Text>}
    </View>,
    // 5. alerts
    <View key="a">
      <Guide pose="alerts" says="I'll ring when a new episode is out." />
      <Text style={styles.h1}>Never miss an episode</Text>
      <Text style={styles.p}>VoidPop can alert you when an episode of a show you follow comes out. You can turn this off in settings.</Text>
      <TouchableOpacity style={[styles.bigBtn, alerts && styles.choiceOn]} onPress={allowAlerts} disabled={busy || alerts}>
        <Icon name="bell" size={20} color={alerts ? "#fff" : C.purple} />
        <Text style={[styles.bigTitle, alerts && { color: "#fff" }]}>{alerts ? "Episode alerts are on" : alerts === false ? "Not allowed. You can enable it in phone settings." : "Turn on episode alerts"}</Text>
      </TouchableOpacity>
      <Text style={[styles.p, { marginTop: 18 }]}>Tip: add the VoidPop widget to your home screen for countdowns at a glance (long-press your home screen › Widgets).</Text>
    </View>,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <View style={styles.dots}>{Array.from({ length: STEPS }, (_, i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}</View>
        <TouchableOpacity onPress={finish} hitSlop={10}><Text style={{ color: C.faint }}>Skip</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">{pages[step]}</ScrollView>
      <View style={styles.bottom}>
        {step > 0 ? <TouchableOpacity onPress={() => { setMessage(""); setStep(step - 1); }} hitSlop={10}><Text style={{ color: C.sub, fontWeight: "700" }}>Back</Text></TouchableOpacity> : <View />}
        <TouchableOpacity style={styles.next} onPress={next}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{step === 0 ? "Get started" : step === STEPS - 1 ? "Start exploring" : step === 3 && !message ? "Start fresh" : "Next"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotOn: { width: 22, backgroundColor: C.purple },
  hero: { height: 220, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  guide: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  bubble: { flex: 1, backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { color: C.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  logoDisc: { position: "absolute", borderRadius: 999, padding: 10 },
  eyebrow: { color: C.purple, fontSize: 12, fontWeight: "800", letterSpacing: 1.6, marginBottom: 6 },
  verdictCard: { marginTop: 18, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.card, overflow: "hidden" },
  verdictRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  swatch: { width: "31%", flexGrow: 1, borderWidth: 2, borderColor: C.border, borderRadius: 12, paddingVertical: 12, alignItems: "center", gap: 8, backgroundColor: C.card },
  swatchDot: { width: 26, height: 26, borderRadius: 13 },
  h1: { color: C.text, fontSize: 26, fontWeight: "900", lineHeight: 32 },
  p: { color: C.sub, fontSize: 14, lineHeight: 21, marginTop: 10 },
  row: { flexDirection: "row", gap: 10, marginTop: 20 },
  choice: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: C.card },
  choiceOn: { backgroundColor: C.purple, borderColor: C.purple },
  choiceText: { color: C.text, fontWeight: "700" },
  toggle: { marginTop: 12, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, backgroundColor: C.card },
  bigBtn: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 16, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, backgroundColor: C.card },
  bigTitle: { color: C.text, fontWeight: "800", fontSize: 15 },
  small: { color: C.faint, fontSize: 12, marginTop: 4 },
  input: { flex: 1, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, height: 40 },
  smallBtn: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  next: { backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
});
