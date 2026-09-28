// Popup when marking Completed/Finished:
// verdict (Peak / Dive In / One Time / Void It) + vibes + comment.

import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from "react-native";
import { VERDICTS, VIBES } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";

export default function VerdictModal({ visible, initial, onSave, onClose }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [verdict, setVerdict] = useState(initial?.verdict || null);
  const [vibes, setVibes] = useState(initial?.vibes || []);
  const [comment, setComment] = useState(initial?.comment || "");

  const toggleVibe = (v) =>
    setVibes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].slice(-3)
    );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>How was it?</Text>
            <Text style={styles.sub}>Your verdict — no boring numbers.</Text>

            <View style={styles.grid}>
              {VERDICTS.map((v) => {
                const active = verdict === v.key;
                return (
                  <TouchableOpacity
                    key={v.key}
                    onPress={() => setVerdict(v.key)}
                    style={[
                      styles.option,
                      active && { backgroundColor: v.color, borderColor: v.color },
                    ]}
                  >
                    <Text style={[styles.optionText, active && { color: "#fff" }]}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sub, { marginTop: 16 }]}>
              What was the vibe? (pick up to 3)
            </Text>
            <View style={styles.vibeWrap}>
              {VIBES.map((v) => {
                const active = vibes.includes(v);
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => toggleVibe(v)}
                    style={[styles.vibe, active && styles.vibeActive]}
                  >
                    <Text style={[styles.vibeText, active && { color: "#fff" }]}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Tell people about the experience (optional)..."
              placeholderTextColor={C.faint}
              multiline
              style={styles.input}
            />

            <View style={styles.actions}>
              <TouchableOpacity onPress={onClose} style={styles.cancel}>
                <Text style={{ color: C.sub }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!verdict}
                onPress={() => onSave({ verdict, vibes, comment: comment.trim() })}
                style={[styles.save, !verdict && { opacity: 0.4 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center", padding: 20,
  },
  sheet: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 20, maxHeight: "85%",
    width: "100%", maxWidth: 520, alignSelf: "center",
  },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  sub: { color: C.sub, fontSize: 13, marginTop: 4, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    flexBasis: "47%", flexGrow: 1, height: 44, borderRadius: 10,
    borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  optionText: { color: C.sub, fontWeight: "800", fontSize: 13 },
  vibeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vibe: {
    paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, justifyContent: "center",
  },
  vibeActive: { backgroundColor: C.purple, borderColor: C.purple },
  vibeText: { color: C.sub, fontSize: 12, fontWeight: "600" },
  input: {
    marginTop: 16, minHeight: 80, borderRadius: 10, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.inputBg,
    color: C.text, padding: 12, textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 14,
  },
  cancel: { paddingHorizontal: 14, paddingVertical: 10 },
  save: {
    backgroundColor: C.purple, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
});
