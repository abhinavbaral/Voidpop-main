// "Offline · showing info saved 2 hr ago" — floats above the tab bar when
// AniList can't be reached and saved answers are shown (shared/api/cache.js).
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { onNetState } from "@voidation/shared/api/anilist";
import { timeAgo } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";

export default function OfflineBanner() {
  const { C } = useTheme();
  const [net, setNet] = useState({ offline: false, since: null });
  useEffect(() => onNetState(setNet), []);
  if (!net.offline) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={[styles.pill, { backgroundColor: C.card, borderColor: C.amber || "#f59e0b", color: C.sub }]}>
        <Text style={{ color: C.amber || "#f59e0b", fontWeight: "800" }}>Offline</Text>
        {" · "}{net.since ? `showing info saved ${timeAgo(new Date(net.since).toISOString())}` : "nothing saved for this page yet"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 64, alignItems: "center" },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, fontSize: 12, overflow: "hidden" },
});
