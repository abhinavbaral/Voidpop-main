// MORE — your profile on top (name, rank, and Login or Log out), a row of numbers (titles, finished, this week), then the menus
// as rounded cards: Statistics, Compare, Data and storage; Void AI, Other; Sync (and Account when signed in); Appearance,
// Settings, Help and About (MorePageScreen).
//   - Signed in (needs a VoidPop server): your username and a Log out button (two taps, since Alert doesn't exist on web).
//   - A guest (everyone, until the server exists): a Login button. With a server it opens the sign-in page, which backs up the
//     library first; without one it opens Create backup, the way to keep your library safe.

import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUserTier, getRanksCollected, getLibraryAll, getLog } from "@voidpop/shared/backend/store";
import { libraryStats, weekSummary } from "@voidpop/shared/features/summaries";
import { logout } from "@voidpop/shared/api/community";
import { useAccount } from "@voidpop/shared/backend/useCommunity";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { useTheme } from "../../context/ThemeContext.js";
import Voidmon from "../../components/brand/Voidmon.js";
import Icon from "../../components/ui/Icon.js";
import OtherPopup from "../../components/more/OtherPopup.js";

const GROUPS = [
  [["statistics", "stats", "Statistics"], ["compare", "list", "Compare"], ["data", "storage", "Data and storage"]],
  [["voidai", "explore", "Void AI"], ["other", "menu", "Other"]], // Other opens a popup with You're watching and New announcements
  [["anilist", "sync", "Sync"], ["account", "profile", "Account"]], // Account only when signed in
  [["appearance", "palette", "Appearance"], ["settings", "settings", "Settings"], ["help", "help", "Help"], ["about", "info", "About"]],
];
const RANKS_TOTAL = 15;

export default function MoreScreen({ navigation, route }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { settings } = useSettings();
  const [rank, setRank] = useState(null);
  const [collected, setCollected] = useState(0);
  const [entries, setEntries] = useState([]);
  const [log, setLog] = useState([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherSection, setOtherSection] = useState(null); // which section Other opens on (Explore's "View more" sends "announced")
  const wanted = route?.params?.openOther;
  useEffect(() => {
    if (!wanted) return;
    setOtherSection(wanted);
    setOtherOpen(true);
    navigation.setParams({ openOther: undefined }); // used up: coming back to More later shouldn't reopen it
  }, [wanted, navigation]);
  const { user, enabled } = useAccount();
  const [confirmLogout, setConfirmLogout] = useState(false);
  useEffect(() => {
    if (!confirmLogout) return undefined;
    const t = setTimeout(() => setConfirmLogout(false), 4000);
    return () => clearTimeout(t);
  }, [confirmLogout]);

  useFocusEffect(useCallback(() => {
    getUserTier().then(setRank).catch(() => {});
    getRanksCollected().then(setCollected).catch(() => {});
    getLibraryAll().then((l) => setEntries(Object.values(l))).catch(() => {});
    getLog().then(setLog).catch(() => {});
  }, []));
  const stats = useMemo(() => libraryStats(entries), [entries]);
  const week = useMemo(() => weekSummary(log), [log]);

  const login = () => {
    if (enabled) navigation.navigate("SignIn", { inApp: true }); // backs up a guest's library first, then returns here
    else navigation.navigate("MorePage", { page: "data", startBackup: true }); // no server yet: Create backup opens
  };
  const doLogout = () => {
    if (!confirmLogout) { setConfirmLogout(true); return; }
    setConfirmLogout(false);
    logout().catch(() => {}); // signed out; the app carries on as a guest with everything still on this phone
  };
  const open = (page) => {
    if (page === "voidai") navigation.navigate("VoidAI");
    else if (page === "other") setOtherOpen(true);
    else if (page === "account") navigation.navigate("Account");
    else navigation.navigate("MorePage", { page });
  };
  const rowsOf = (group) => group.filter(([page]) => page !== "account" || !!user);

  const name = (settings.name || "").trim() || "You";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.screenTitle} accessibilityRole="header">More</Text>

        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}><Voidmon pose="peeking" size={74} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.sub} numberOfLines={1}>{user ? `@${user.username}` : "Guest · saved on this phone"}</Text>
              {rank && <Text style={[styles.rank, { color: rank.tier.color }]} numberOfLines={1}>{rank.tier.label}</Text>}
            </View>
            {user ? (
              <Pressable onPress={doLogout} accessibilityRole="button" style={[styles.pill, confirmLogout && { borderColor: C.rose }]}>
                <Text style={[styles.pillText, confirmLogout && { color: C.rose }]}>{confirmLogout ? "Tap again" : "Log out"}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={login} accessibilityRole="button" accessibilityLabel="Login. Opens Create backup" style={[styles.pill, { backgroundColor: C.purple, borderColor: C.purple }]}>
                <Text style={[styles.pillText, { color: "#fff" }]}>Login</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => navigation.navigate("MorePage", { page: "badge" })} accessibilityRole="button" accessibilityLabel={`Rank collector: ${collected} of ${RANKS_TOTAL} ranks. Opens ranks and achievements.`} style={{ marginTop: 14 }}>
            <View style={styles.rankHead}>
              <Text style={styles.label}>RANK COLLECTOR</Text>
              <Text style={styles.small}>{collected} of {RANKS_TOTAL} ranks</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(3, (collected / RANKS_TOTAL) * 100)}%` }]} /></View>
          </Pressable>
        </View>

        <View style={styles.tiles}>
          {[["TITLES", stats.titles], ["FINISHED", stats.done], ["THIS WEEK", week.total]].map(([label, value]) => (
            <View key={label} style={styles.tile}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.tileValue}>{value}</Text>
            </View>
          ))}
        </View>

        {GROUPS.map((group, i) => (
          <View key={i} style={styles.group}>
            {rowsOf(group).map(([page, icon, label], k, rows) => (
              <Pressable key={page} onPress={() => open(page)} accessibilityRole="button"
                style={({ pressed }) => [styles.row, k < rows.length - 1 && styles.rowLine, pressed && { backgroundColor: C.bg }]}>
                <View style={styles.icon}><Icon name={icon} size={20} color={C.purple} /></View>
                <Text style={styles.rowText}>{page === "account" && user ? `Account · @${user.username}` : label}</Text>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      <OtherPopup visible={otherOpen} initial={otherSection} onClose={() => { setOtherOpen(false); setOtherSection(null); }} navigation={navigation} />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  screenTitle: { color: C.text, fontSize: 32, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 18, padding: 16, marginHorizontal: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: C.bg, borderWidth: 2, borderColor: C.purple, alignItems: "center", justifyContent: "flex-end" },
  name: { color: C.text, fontSize: 24, fontWeight: "900", letterSpacing: 0.3 },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  rank: { fontSize: 13, fontWeight: "800", marginTop: 3 },
  pill: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  pillText: { color: C.text, fontWeight: "800", fontSize: 13 },
  label: { color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  small: { color: C.faint, fontSize: 12 },
  rankHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  track: { height: 6, borderRadius: 3, backgroundColor: C.border, marginTop: 8, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: C.purple },
  tiles: { flexDirection: "row", gap: 10, paddingHorizontal: 14, marginTop: 12 },
  tile: { flex: 1, backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 14 },
  tileValue: { color: C.text, fontSize: 28, fontWeight: "900", marginTop: 2 },
  group: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 18, marginHorizontal: 14, marginTop: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.border },
  icon: { width: 24, alignItems: "center" },
  rowText: { flex: 1, color: C.text, fontSize: 16, fontWeight: "700" },
  chev: { color: C.faint, fontSize: 22 },
});
