// "Share Review" — renders a branded card (poster, username, verdict, review,
// Voidation branding), captures it as an image, and opens the share sheet.

import { useRef, useState } from "react";
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { VERDICTS } from "@voidation/shared/backend/store";
import { shareCardImage } from "../lib/shareCard";
import { notify } from "../lib/notify";
import { useTheme } from "../context/ThemeContext.js";

export default function ShareCardModal({ visible, item, review, onClose }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const shotRef = useRef(null);
  const verdict = VERDICTS.find((v) => v.key === review?.verdict);

  const [busy, setBusy] = useState(false);

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

  if (!review) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View ref={shotRef} collapsable={false} style={styles.cardWrap}>
          <View style={styles.cardOuter}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.poster} />
              )}
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.user}>My verdict</Text>
                {verdict && (
                  <View style={[styles.chip, { backgroundColor: verdict.color }]}>
                    <Text style={styles.chipText}>{verdict.label}</Text>
                  </View>
                )}
              </View>
            </View>
            {!!review.comment && (
              <Text style={styles.comment} numberOfLines={6}>
                "{review.comment}"
              </Text>
            )}
            <Text style={styles.brand}>
              Void<Text style={{ color: C.purple }}>Pop</Text>
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onClose} style={styles.cancel}>
            <Text style={{ color: C.sub }}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={share} style={styles.shareBtn}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {busy ? "Preparing..." : "Share Image"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center", padding: 24,
  },
  // keeps the card phone-sized on wide desktop screens
  cardWrap: { width: "100%", maxWidth: 440, alignSelf: "center" },
  cardOuter: {
    backgroundColor: "#150d26", borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: C.purple,
  },
  poster: { width: 90, aspectRatio: 2 / 3, borderRadius: 10 },
  title: { color: C.text, fontSize: 16, fontWeight: "800" },
  user: { color: C.sub, fontSize: 12, marginTop: 4 },
  chip: {
    alignSelf: "flex-start", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  chipText: { color: "#000", fontWeight: "800", fontSize: 11 },
  comment: { color: "#e5e7eb", fontSize: 13, marginTop: 14, lineHeight: 20, fontStyle: "italic" },
  brand: { color: C.text, fontWeight: "800", fontSize: 13, marginTop: 16, textAlign: "right" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 20 },
  cancel: { paddingHorizontal: 16, paddingVertical: 12 },
  shareBtn: {
    backgroundColor: C.purple, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
});
