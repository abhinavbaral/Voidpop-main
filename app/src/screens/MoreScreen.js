// MORE — laid out like the "More" tab in reader apps: the logo on top, quick
// toggles, then menu rows that open Statistics, Appearance, Data and storage,
// Settings, Help and About (MorePageScreen).

import { ScrollView, View, Text, Image, Pressable, Switch, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useTheme } from "../context/ThemeContext.js";

const GROUPS = [
  [["statistics", "▥", "Statistics"], ["appearance", "◐", "Appearance"], ["data", "▤", "Data and storage"]],
  [["categories", "▦", "Categories"], ["anilist", "⇄", "AniList"]],
  [["settings", "⚙", "Settings"], ["help", "?", "Help"], ["about", "ⓘ", "About"]],
];

export default function MoreScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { settings, update } = useSettings();

  const toggle = (icon, label, hint, key) => (
    <Pressable style={styles.row} onPress={() => update(key, !settings[key])}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(v) => update(key, v)}
        trackColor={{ false: C.border, true: C.purple }}
        thumbColor="#fff"
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.group}>
          {toggle("◷", "24-hour clock", "Airing times as 16:30", "clock24")}
          {toggle("▣", "Countdown badges", "Next episode on posters", "posterBadges")}
        </View>
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]} onPress={() => navigation.navigate("Wrapped")}>
            <Text style={[styles.icon, { color: C.orange }]}>★</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.orange }]}>Wrapped {new Date().getFullYear()}</Text>
              <Text style={styles.hint}>Your year in anime and manga</Text>
            </View>
          </Pressable>
        </View>
        {GROUPS.map((group, i) => (
          <View key={i} style={styles.group}>
            {group.map(([page, icon, label]) => (
              <Pressable
                key={page}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]}
                onPress={() => navigation.navigate("MorePage", { page })}
              >
                <Text style={styles.icon}>{icon}</Text>
                <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  logoWrap: { alignItems: "center", paddingTop: 24, paddingBottom: 28 },
  logo: { width: 96, height: 96 },
  group: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 22, paddingVertical: 16 },
  icon: { color: C.purple, fontSize: 20, width: 24, textAlign: "center" },
  label: { color: C.text, fontSize: 16, fontWeight: "600" },
  hint: { color: C.faint, fontSize: 12, marginTop: 2 },
});
