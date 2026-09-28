// A simple bottom sheet with a list of choices (Android's Alert only fits 3 buttons).
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export default function OptionsSheet({ visible, title, options, onPick, onClose }) {
  const { C } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          {!!title && <Text style={[styles.title, { color: C.faint }]}>{title}</Text>}
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((o) => (
              <Pressable key={o.key} onPress={() => onPick(o.key)} style={({ pressed }) => [styles.row, { borderTopColor: C.border }, pressed && { opacity: 0.6 }]}>
                <Text style={{ color: o.danger ? C.rose : C.text, fontSize: 15, fontWeight: "600" }}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={[styles.row, { borderTopColor: C.border, alignItems: "center" }]}>
            <Text style={{ color: C.sub, fontWeight: "700" }}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, paddingBottom: 18 },
  title: { fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", padding: 16, paddingBottom: 8 },
  row: { paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1 },
});
