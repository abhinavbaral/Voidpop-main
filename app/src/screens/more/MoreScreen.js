// MORE — laid out like the "More" tab in reader apps: Voidmon on top with your rank
// badge right beside him (just the badge: tap it for Ranks and badges), then menu rows
// that open Statistics, Data and storage,
// Appearance (theme, colour, name) and Settings (24-hour clock, countdown badges,
// episode alerts, welcome tour),
// Help and About (MorePageScreen).
// When a VoidPop server is set up, the account rows sit next to Sync: someone who is not signed in (a guest, or
// anyone who skipped the login screen) sees "Sign in"; someone signed in sees "Account" (their username) and "Log out".

import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUserTier } from "@voidpop/shared/backend/store";
import { logout } from "@voidpop/shared/api/community";
import { useAccount } from "@voidpop/shared/backend/useCommunity";
import { useTheme } from "../../context/ThemeContext.js";
import Voidmon from "../../components/brand/Voidmon.js";
import AnimatedBanner from "../../components/brand/AnimatedBanner.js";
import Icon from "../../components/ui/Icon.js";
import OtherPopup from "../../components/more/OtherPopup.js";

const GROUPS = [
  [["statistics", "stats", "Statistics"], ["compare", "list", "Compare"], ["data", "storage", "Data and storage"]],
  [["voidai", "explore", "Void AI"], ["other", "menu", "Other"]], // opens a popup with You're watching and New announcements
  [["anilist", "sync", "Sync"], ["account", "profile", "Account"]], // the account rows are worked out below (Sign in / Account + Log out)
  [["appearance", "palette", "Appearance"], ["settings", "settings", "Settings"], ["help", "help", "Help"], ["about", "info", "About"]],
];

export default function MoreScreen({ navigation }) {
  const { C, dark } = useTheme();
  const styles = makeStyles(C);
  const [rank, setRank] = useState(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const { user, ready, enabled } = useAccount();
  const [confirmLogout, setConfirmLogout] = useState(false); // logging out takes two taps, since Alert doesn't exist on web
  useEffect(() => {
    if (!confirmLogout) return undefined;
    const t = setTimeout(() => setConfirmLogout(false), 4000);
    return () => clearTimeout(t);
  }, [confirmLogout]);

  // the rows of a group: the Account row turns into "Sign in", or "Account" and "Log out"
  const rowsOf = (group) => group.flatMap(([page, icon, label]) => {
    if (page !== "account") return [{ page, icon, label }];
    if (!enabled || !ready) return [];
    if (!user) return [{ page: "signin", icon: "login", label: "Sign in", sub: "Comments, shared Void Verdicts and cloud backup" }];
    return [
      { page: "account", icon: "profile", label: "Account", sub: user.username },
      { page: "logout", icon: "logout", label: confirmLogout ? "Tap again to log out" : "Log out", danger: confirmLogout },
    ];
  });
  const open = (page) => {
    if (page === "voidai") navigation.navigate("VoidAI");
    else if (page === "other") setOtherOpen(true);
    else if (page === "signin") navigation.navigate("SignIn", { inApp: true }); // the same login page; backs up a guest's library first, then returns here
    else if (page === "account") navigation.navigate("Account");
    else if (page === "logout") {
      if (!confirmLogout) { setConfirmLogout(true); return; }
      setConfirmLogout(false);
      logout().catch(() => {}); // signed out; the app carries on in guest mode with everything still on this phone
    } else navigation.navigate("MorePage", { page });
  };
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
            {rowsOf(group).map(({ page, icon, label, sub, danger }) => (
              <Pressable
                key={page}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.card }]}
                onPress={() => open(page)}
                accessibilityRole="button"
              >
                <View style={styles.icon}><Icon name={icon} size={21} color={danger ? C.rose : C.purple} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, danger && { color: C.rose }]}>{label}</Text>
                  {!!sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
                </View>
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
  sub: { color: C.sub, fontSize: 12, marginTop: 2 },
});
