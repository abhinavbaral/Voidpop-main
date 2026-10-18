// The start button on the welcome screen: a white pill with the label and a round
// arrow. A plain tap, no swiping.
import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../ui/Icon.js";

export default function ArrowButton({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.pill, pressed && { opacity: 0.85 }]}
    >
      <Text style={s.label}>{label}</Text>
      <View style={s.circle}>
        <Icon name="right" size={24} color="#fff" />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pill: {
    alignSelf: "stretch", height: 76, borderRadius: 38, backgroundColor: "#fff",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 30, paddingRight: 8,
  },
  label: { fontSize: 18, fontWeight: "800", letterSpacing: 0.3, color: "#0d1117" },
  circle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#0d1117", alignItems: "center", justifyContent: "center" },
});
