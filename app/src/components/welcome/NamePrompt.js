// Asked once: "What should we call you?". Shown the first time Explore opens,
// and once to anyone who was already using the app before names existed.
// Saving or "Not now" both end it for good; the name can be changed any time in
// More > Settings. It's used for the greeting on Explore, nowhere else.
import { useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { useTheme } from "../../context/ThemeContext.js";

export default function NamePrompt() {
  const { C } = useTheme();
  const { settings, update, ready } = useSettings();
  const [name, setName] = useState("");
  if (!ready || settings.nameAsked) return null;

  const finish = async (value) => {
    if (value) await update("name", value);
    await update("nameAsked", true);
  };
  const clean = name.trim().slice(0, 24);

  return (
    <Modal transparent animationType="fade" onRequestClose={() => finish("")}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]} accessibilityViewIsModal>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }} accessibilityRole="header">What should we call you?</Text>
          <Text style={{ color: C.faint, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
            Just for the greeting on your home page. It stays on this phone.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={C.faint}
            maxLength={24}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => finish(clean)}
            accessibilityLabel="Your name"
            style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
          />
          <View style={styles.buttons}>
            <TouchableOpacity onPress={() => finish("")} style={styles.ghost} accessibilityRole="button">
              <Text style={{ color: C.faint, fontWeight: "700" }}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => finish(clean)}
              disabled={!clean}
              style={[styles.save, { backgroundColor: C.purple, opacity: clean ? 1 : 0.4 }]}
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 20, borderWidth: 1, padding: 20 },
  input: { marginTop: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 16 },
  ghost: { paddingHorizontal: 14, paddingVertical: 12 },
  save: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
});
