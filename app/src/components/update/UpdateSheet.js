// FILE: app/src/components/update/UpdateSheet.js — the update sheet: what's new, then Update now -> download progress ->
// Restart now. Opened by UpdateGate (a new update was found) or by About > Check for updates.
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function UpdateSheet({ phase, progress, notes, publishedAt, onDownload, onRestart, onLater }) {
  const { C } = useTheme();
  const busy = phase === "downloading";
  const title = phase === "ready" ? "Update ready" : "Update available";
  const when = publishedAt ? new Date(publishedAt).toLocaleDateString() : "";
  return (
    <Modal visible transparent animationType="slide" onRequestClose={busy ? undefined : onLater}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.title, { color: C.text }]}>{title}</Text>
          {!!when && <Text style={{ color: C.faint, fontSize: 13, marginTop: 2 }}>Published {when}</Text>}
          <ScrollView style={s.notes} contentContainerStyle={{ paddingVertical: 4 }}>
            <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19 }}>{notes || "Improvements and fixes."}</Text>
          </ScrollView>
          {busy && (
            <View style={[s.track, { backgroundColor: C.border }]}>
              <View style={[s.fill, { backgroundColor: C.purple, width: `${Math.max(4, (progress ?? 0.15) * 100)}%` }]} />
            </View>
          )}
          <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 12 }}>
            {phase === "ready" ? "VoidPop restarts for a moment. Your library stays on the phone." : "A small download. VoidPop keeps working while it downloads."}
          </Text>
          <Pressable
            disabled={busy}
            onPress={phase === "ready" ? onRestart : onDownload}
            style={[s.primary, { backgroundColor: busy ? C.border : C.purple }]}
          >
            <Text style={{ color: busy ? C.text : "#fff", fontWeight: "800", fontSize: 15 }}>
              {busy ? (progress != null ? `Downloading ${Math.round(progress * 100)}%` : "Downloading…") : phase === "ready" ? "Restart now" : "Update now"}
            </Text>
          </Pressable>
          {!busy && (
            <Pressable onPress={onLater} style={s.ghost}>
              <Text style={{ color: C.sub, fontWeight: "700" }}>{phase === "ready" ? "Later (applies next time you open VoidPop)" : "Later"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, padding: 20, paddingBottom: 28 },
  title: { fontSize: 20, fontWeight: "800" },
  notes: { maxHeight: 200, marginTop: 12 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 14 },
  fill: { height: 6, borderRadius: 3 },
  primary: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ghost: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
});
