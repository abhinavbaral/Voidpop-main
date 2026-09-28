// The tier badge shown next to usernames (Rookie -> Legend).

import { View, Text, StyleSheet } from "react-native";

export default function TierBadge({ tier, size = "sm" }) {
  if (!tier) return null;
  const big = size === "lg";
  return (
    <View style={[styles.badge, { borderColor: tier.color }, big && styles.big]}>
      <Text style={[styles.text, { color: tier.color }, big && { fontSize: 12 }]}>
        {tier.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  big: { paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 9, fontWeight: "800" },
});
