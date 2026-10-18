// MORE — laid out like the "More" tab in reader apps: Voidmon on top, your
// badge, then menu rows that open Statistics, Data and storage,
// Appearance and Settings (24-hour clock, countdown badges, welcome tour…),
// Help and About (MorePageScreen).

import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUserTier, TIERS } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";
import Voidmon from "../../components/brand/Voidmon.js";
import AnimatedBanner from "../../components/brand/AnimatedBanner.js";
import Icon from "../../components/ui/Icon.js";

const GROUPS = [
  [["statistics", "stats", "Statistics"], ["compare", "list", "Compare"], ["data", "storage", "Data and storage"]],
  [["youwatching", "play", "You're watching"], ["announced", "bell", "New announcements"]],
  [["anilist", "sync", "Sync"]],
  [["settings", "palette", "Appearance and Settings"], ["help", "help", "Help"], ["about", "info", "About"]],
];

export default function MoreScreen({ navigation }) {
  const { C, dark } = useTheme();
  const styles = makeStyles(C);
  const [rank, setRank] = useState(null);
  useFocusEffect(useCallback(() => {
    getUserTier().then(setRank).catch(() => {});
  }, []));
  const next = rank && TIERS.find((t) => t.min > rank.stats.totalCompleted);


  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.logoWrap}>
          <View style={StyleSheet.absoluteFill}><AnimatedBanner accent={C.purple} dark={dark} height={190} /></View>
          {/* Voidmon peeks over the bottom edge of the banner */}
          <Voidmon pose="peeking" size={220} />
        </View>
        {rank && (
          <Pressable onPress={() => navigation.navigate("MorePage", { page: "badge" })}
            style={({ pressed }) => [styles.badgeRow, { borderColor: rank.tier.color }, pressed && { opacity: 0.8 }]}>
            <View style={[styles.miniMedal, { borderColor: rank.tier.color }]}>
              <Icon name={rank.tier.key === "addicted" ? "coffee" : "star"} size={18} color={rank.tier.color} fill={rank.tier.key !== "addicted"} />
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
        {GROUPS.map((group, i) => (
          <View key={i} style={styles.group}>
            {group.map(([page, icon, label]) => (
              <Pressable
                key={page}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]}
                onPress={() => navigation.navigate("MorePage", { page })}
              >
                <View style={styles.icon}><Icon name={icon} size={21} color={C.purple} /></View>
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
  logoWrap: { height: 190, alignItems: "center", justifyContent: "flex-end", marginBottom: 8, overflow: "hidden" },
  group: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 22, paddingVertical: 16 },
  icon: { width: 24, alignItems: "center" },
  label: { color: C.text, fontSize: 16, fontWeight: "600" },
  hint: { color: C.faint, fontSize: 12, marginTop: 2 },
});
