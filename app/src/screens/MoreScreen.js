// MORE — laid out like the "More" tab in reader apps: the logo on top, quick
// toggles, then menu rows that open Statistics, Data and storage, Appearance
// and Others, Help and About (MorePageScreen). Categories shows at 500+ completed.

import { ScrollView, View, Text, Image, Pressable, Switch, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUserTier, TIERS, categoriesUnlocked } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";

const GROUPS = [
  [["statistics", "▥", "Statistics"], ["data", "▤", "Data and storage"]],
  [["announced", "✦", "New announcements"]],
  [["categories", "▦", "Categories"], ["anilist", "⇄", "AniList"]],
  [["settings", "⚙", "Appearance and Others"], ["help", "?", "Help"], ["about", "ⓘ", "About"]],
];

export default function MoreScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { settings, update } = useSettings();
  const [rank, setRank] = useState(null);
  const [catsOpen, setCatsOpen] = useState(false); // Categories unlock at 500 completed anime
  useFocusEffect(useCallback(() => {
    getUserTier().then(setRank).catch(() => {});
    categoriesUnlocked().then(setCatsOpen).catch(() => {});
  }, []));
  const next = rank && TIERS.find((t) => t.min > rank.stats.totalCompleted);

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
        {rank && (
          <Pressable onPress={() => navigation.navigate("MorePage", { page: "badge" })}
            style={({ pressed }) => [styles.badgeRow, { borderColor: rank.tier.color }, pressed && { opacity: 0.8 }]}>
            <View style={[styles.miniMedal, { borderColor: rank.tier.color }]}>
              <Text style={{ color: rank.tier.color, fontSize: 18 }}>{rank.tier.key === "addicted" ? "☕" : "★"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hint}>Your badge</Text>
              <Text style={{ color: rank.tier.color, fontWeight: "900", fontSize: 17 }}>{rank.tier.label}</Text>
              <Text style={styles.hint}>
                {next ? `${next.min - rank.stats.totalCompleted} more to ${next.label}` : "Top rank. Take a break!"} · {rank.stats.anime} completed, {rank.stats.manga} finished
              </Text>
            </View>
            <Text style={{ color: C.faint, fontSize: 20 }}>›</Text>
          </Pressable>
        )}
        <View style={styles.group}>
          <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]} onPress={() => navigation.navigate("Wrapped")}>
            <Text style={[styles.icon, { color: C.orange }]}>★</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.orange }]}>Voidation Rewind</Text>
              <Text style={styles.hint}>All time, or year by year</Text>
            </View>
          </Pressable>
        </View>
        {GROUPS.map((group, i) => (
          <View key={i} style={styles.group}>
            {group.filter(([page]) => page !== "categories" || catsOpen).map(([page, icon, label]) => (
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
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 14, marginTop: 6, marginBottom: 4, padding: 12, borderRadius: 14, borderWidth: 1, backgroundColor: C.card },
  miniMedal: { width: 44, height: 44, borderRadius: 22, borderWidth: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#171226" },
  safe: { flex: 1, backgroundColor: C.bg },
  logoWrap: { alignItems: "center", paddingTop: 24, paddingBottom: 28 },
  logo: { width: 96, height: 96 },
  group: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 22, paddingVertical: 16 },
  icon: { color: C.purple, fontSize: 20, width: 24, textAlign: "center" },
  label: { color: C.text, fontSize: 16, fontWeight: "600" },
  hint: { color: C.faint, fontSize: 12, marginTop: 2 },
});
