// Popup when marking Completed/Finished, in two steps with Voidmon asking:
//   1. your Void Verdict (Peak / Dive In / One Time / Void It)
//   2. moods (up to 3, five to pick from for each verdict) and an optional note,
//      in one speech bubble, then Save
// Vibes aren't asked any more; any already on this verdict are kept as they are.

import { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from "react-native";
import { VERDICTS, moodsFor } from "@voidpop/shared/backend/store";
import { verdictPrompt } from "@voidpop/shared/features/voidmon";
import { useTheme } from "../../context/ThemeContext.js";
import Voidmon from "../brand/Voidmon.js";

// moods from an older review (or another verdict) that this verdict doesn't offer are dropped
const keepMoods = (verdict, moods) => (moods || []).filter((m) => moodsFor(verdict).includes(m));

export default function VerdictModal({ visible, initial, onSave, onClose }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [step, setStep] = useState("verdict");
  const [verdict, setVerdict] = useState(initial?.verdict || null);
  const [moods, setMoods] = useState(keepMoods(initial?.verdict, initial?.moods));
  const [comment, setComment] = useState(initial?.comment || "");
  // opening again starts at step 1 with what's saved (the window can stay mounted)
  useEffect(() => {
    if (!visible) return;
    setStep("verdict"); setVerdict(initial?.verdict || null); setMoods(keepMoods(initial?.verdict, initial?.moods)); setComment(initial?.comment || "");
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when it opens
  const toggleMood = (m) => setMoods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].slice(-3)));
  const prompt = verdictPrompt({ step, verdict, moods });
  const pick = (key) => { setVerdict(key); setMoods((prev) => keepMoods(key, prev)); setStep("feel"); };
  const save = () => onSave({ verdict, vibes: initial?.vibes || [], moods, comment: comment.trim() });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dotOn]} />
              <View style={[styles.dot, step === "feel" && styles.dotOn]} />
            </View>
            <View style={styles.guide}>
              <Voidmon pose={prompt.pose} size={72} />
              {step === "verdict" && <View style={styles.bubble}><Text style={styles.bubbleText}>{prompt.text}</Text></View>}
            </View>

            {step === "verdict" ? (
              <>
                <View style={styles.grid}>
                  {VERDICTS.map((v) => {
                    const active = verdict === v.key;
                    return (
                      <TouchableOpacity key={v.key} onPress={() => pick(v.key)} accessibilityRole="button" accessibilityState={{ selected: active }}
                        style={[styles.option, active && { backgroundColor: v.color, borderColor: v.color }]}>
                        <Text style={[styles.optionText, active && { color: "#fff" }]}>{v.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={onClose} style={styles.cancel}><Text style={{ color: C.sub }}>Cancel</Text></TouchableOpacity>
                  {verdict && (
                    <TouchableOpacity onPress={() => setStep("feel")} style={styles.save}><Text style={{ color: "#fff", fontWeight: "700" }}>Next</Text></TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <>
                {/* one speech bubble: the question, the moods and the note */}
                <View style={[styles.bubble, styles.bigBubble]}>
                  <Text style={styles.bubbleText}>{prompt.text}</Text>
                  <View style={[styles.moodWrap, { marginTop: 10 }]}>
                    {moodsFor(verdict).map((m) => {
                      const active = moods.includes(m);
                      return (
                        <TouchableOpacity key={m} onPress={() => toggleMood(m)} accessibilityRole="button" accessibilityState={{ selected: active }}
                          style={[styles.mood, active && styles.moodActive]}>
                          <Text style={[styles.moodText, active && { color: "#fff" }]}>{m}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput value={comment} onChangeText={setComment} multiline maxLength={2000}
                    placeholder="A note about it (optional)" placeholderTextColor={C.faint} style={styles.input} />
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => setStep("verdict")} style={styles.cancel}>
                    <Text style={{ color: C.sub }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={save} style={styles.save} accessibilityRole="button">
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20 },
  sheet: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20,
    maxHeight: "85%", width: "100%", maxWidth: 520, alignSelf: "center",
  },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center", marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotOn: { width: 22, backgroundColor: C.purple },
  guide: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  bubble: { flex: 1, backgroundColor: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 9 },
  bigBubble: { flex: 0, borderBottomLeftRadius: 14, borderTopLeftRadius: 4, marginTop: -6 },
  bubbleText: { color: C.text, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    flexBasis: "47%", flexGrow: 1, height: 48, borderRadius: 10, borderWidth: 2, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  optionText: { color: C.sub, fontWeight: "800", fontSize: 14 },
  moodWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mood: { paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, maxWidth: "100%", borderRadius: 16, borderWidth: 1, borderColor: C.border, justifyContent: "center", backgroundColor: C.card },
  moodActive: { backgroundColor: C.orange, borderColor: C.orange },
  moodText: { color: C.sub, fontSize: 12, fontWeight: "600" },
  input: {
    marginTop: 12, minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.inputBg,
    color: C.text, padding: 10, textAlignVertical: "top",
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 14 },
  cancel: { paddingHorizontal: 14, paddingVertical: 10 },
  save: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
});
