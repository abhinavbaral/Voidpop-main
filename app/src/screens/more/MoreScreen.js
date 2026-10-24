// MORE — laid out like the "More" tab in reader apps: Voidmon on top with your rank
// badge right beside him (just the badge: tap it for Ranks and badges), then menu rows
// that open Statistics, Data and storage,
// Appearance and Settings (24-hour clock, countdown badges, welcome tour…),
// Help and About (MorePageScreen).

import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUserTier } from "@voidpop/shared/backend/store";
import { hasCommunity } from "@voidpop/shared/api/community";
import { useTheme } from "../../context/ThemeContext.js";
import Voidmon from "../../components/brand/Voidmon.js";
import AnimatedBanner from "../../components/brand/AnimatedBanner.js";
import Icon from "../../components/ui/Icon.js";
import OtherPopup from "../../components/more/OtherPopup.js";

const GROUPS = [
  [["statistics", "stats", "Statistics"], ["compare", "list", "Compare"], ["data", "storage", "Data and storage"]],
  [["other", "menu", "Other"]], // opens a popup with You're watching and New announcements
  [["anilist", "sync", "Sync"], ["account", "profile", "Account"]],
  [["settings", "palette", "Appearance and Settings"], ["help", "help", "Help"], ["about", "info", "About"]],
];

export default function MoreScreen({ navigation }) {
  const { C, dark } = useTheme();
  const styles = makeStyles(C);
  const [rank, setRank] = useState(null);
  const [otherOpen, setOtherOpen] = useState(false);
  useFocusEffect(useCallback(() => {
    getUserTier().then(setRank).catch(() => {});
  }, []));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.logoWrap}>
          <View style={StyleSheet.absoluteFill}><AnimatedBanner accent={C.purple} dark={dark} height={190} /></View>
          {/* Voidmon peeks over the bottom edge of the banner */}
          <Voidmon pose="peeking" size={220} />
          {/* the rank badge sits on Voidmon's right, level with his bottom edge */}
          {rank && (
            <Pressable
              onPress={() => navigation.navigate("MorePage", { page: "badge" })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Your rank: ${rank.tier.label}. Opens ranks and achievements.`}
              style={({ pressed }) => [styles.badge, { borderColor: rank.tier.color }, pressed && { opacity: 0.8 }]}
            >
              <Icon name={rank.tier.key === "addicted" ? "coffee" : "star"} size={24} color={rank.tier.color} fill={rank.tier.key !== "addicted"} />
            </Pressable>
          )}
        </View>
        {GROUPS.map((group, i) => (
          <View key={i} style={styles.group}>
            {group.filter(([page]) => page !== "account" || hasCommunity()).map(([page, icon, label]) => (
              <Pressable
                key={page}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]}
                onPress={() => (page === "other" ? setOtherOpen(true) : page === "account" ? navigation.navigate("Account") : navigation.navigate("MorePage", { page }))}
              >
                <View style={styles.icon}><Icon name={icon} size={21} color={C.purple} /></View>
                <Text style={[styles.label, { flex: 1 }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      <OtherPopup visible={otherOpen} onClose={() => setOtherOpen(false)} navigation={navigation} />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  // Voidmon's drawing fills the middle 56% of his 220-wide picture (±62), so the badge starts just past that
  badge: { position: "absolute", bottom: 8, left: "50%", marginLeft: 74, width: 52, height: 52, borderRadius: 26, borderWidth: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#171226" },
  safe: { flex: 1, backgroundColor: C.bg },
  logoWrap: { height: 190, alignItems: "center", justifyContent: "flex-end", marginBottom: 8, overflow: "hidden" },
  group: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 22, paddingVertical: 16 },
  icon: { width: 24, alignItems: "center" },
  label: { color: C.text, fontSize: 16, fontWeight: "600" },
});
