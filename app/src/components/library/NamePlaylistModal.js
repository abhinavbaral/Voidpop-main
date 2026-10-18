// The little "name your playlist" box: for the + button and for renaming.
// onSave(name) returns a message to show (name taken, empty…) or null when it worked.
import { useEffect, useState } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function NamePlaylistModal({ visible, title, initial = "", onSave, onClose }) {
  const { C } = useTheme();
  const [name, setName] = useState(initial);
  const [message, setMessage] = useState("");
  useEffect(() => { if (visible) { setName(initial); setMessage(""); } }, [visible, initial]);
  const save = async () => {
    const problem = await onSave(name);
    if (problem) setMessage(problem); else onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.box, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 17 }} accessibilityRole="header">{title}</Text>
          <TextInput value={name} onChangeText={(t) => { setName(t); setMessage(""); }} autoFocus maxLength={40} placeholder="e.g. Hidden gems" placeholderTextColor={C.faint}
            onSubmitEditing={save} returnKeyType="done" accessibilityLabel="Playlist name"
            style={{ color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14, fontSize: 15 }} />
          {!!message && <Text style={{ color: C.rose, fontSize: 12, marginTop: 6 }}>{message}</Text>}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 22, marginTop: 18 }}>
            <TouchableOpacity onPress={onClose} accessibilityRole="button"><Text style={{ color: C.sub, fontWeight: "700" }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={!name.trim()} accessibilityRole="button" style={!name.trim() && { opacity: 0.4 }}>
              <Text style={{ color: C.purple, fontWeight: "800" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  box: { borderRadius: 16, borderWidth: 1, padding: 20 },
});
