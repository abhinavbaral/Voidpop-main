// Share a countdown as an image: "Solo Leveling · Episode 7 · in 2d 4h",
// with the full air time and time zone for friends elsewhere.
import { useRef, useState } from "react";
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { formatCountdown, shareAirTime } from "@voidation/shared/format";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { shareCardImage } from "../lib/shareCard";
import { notify } from "../lib/notify";
import { useTheme } from "../context/ThemeContext.js";

export default function CountdownShareModal({ visible, item, next, onClose }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const shotRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const { clock24 } = useSettings().settings;
  if (!next) return null;

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await shareCardImage(shotRef);
    } catch {
      notify("Oops", "Could not create the share card.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View ref={shotRef} collapsable={false} style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {item.image && <Image source={{ uri: item.image }} style={styles.poster} />}
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
                <Text style={styles.sub}>Episode {next.episode}{item.episodes ? ` of ${item.episodes}` : ""}</Text>
                <Text style={styles.countdown}>{formatCountdown(next.airingAt)}</Text>
                <Text style={styles.sub}>{shareAirTime(next.airingAt, clock24)}</Text>
              </View>
            </View>
            <Text style={styles.brand}>VOID<Text style={{ color: C.orange }}>ATION</Text></Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onClose} style={styles.cancel}><Text style={{ color: C.sub }}>Close</Text></TouchableOpacity>
          <TouchableOpacity onPress={share} style={styles.shareBtn}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>{busy ? "Preparing..." : "Share Image"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 24 },
  cardWrap: { width: "100%", maxWidth: 440, alignSelf: "center" },
  card: { backgroundColor: "#150d26", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.purple },
  poster: { width: 96, aspectRatio: 2 / 3, borderRadius: 10 },
  title: { color: "#f3f4f6", fontSize: 16, fontWeight: "800" },
  sub: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  countdown: { color: C.orange, fontSize: 30, fontWeight: "900", marginTop: 8, fontVariant: ["tabular-nums"] },
  brand: { color: "#f3f4f6", fontWeight: "800", fontSize: 13, marginTop: 16, textAlign: "right", letterSpacing: 1 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 20 },
  cancel: { paddingHorizontal: 16, paddingVertical: 12 },
  shareBtn: { backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
});
