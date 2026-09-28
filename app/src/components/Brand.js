// The Voidation logo + wordmark: countdown-ring V icon, VOID in theme text, ATION in orange.
import { View, Text, Image } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export default function Brand({ size = 20 }) {
  const { C } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Image
        source={require("../../assets/logo.png")}
        style={{ width: size * 1.5, height: size * 1.5 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: 1.5, color: C.text }}>
        VOID<Text style={{ color: C.orange }}>ATION</Text>
      </Text>
    </View>
  );
}
