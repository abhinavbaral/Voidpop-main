// Horizontal row of toggle chips — used for segments, origins, seasons, sorts.

import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function Chips({ options, value, onChange, style }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key || "all"}
            onPress={() => onChange(o.key)}
            style={[styles.chip, active && styles.active]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  row: { gap: 8, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    justifyContent: "center",
  },
  active: { backgroundColor: C.purple, borderColor: C.purple },
  label: { color: C.sub, fontSize: 12, fontWeight: "600" },
  activeLabel: { color: "#fff" },
});
