// The Voidation logo: a countdown ring around a V. Icon only — no wordmark.
// The V is light on dark themes and dark on the light theme, so it never vanishes.
import { Image } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export const LOGO = { dark: require("../../assets/logo.png"), light: require("../../assets/logo-light.png") };

export default function Brand({ size = 20 }) {
  const { dark } = useTheme();
  return (
    <Image
      source={dark ? LOGO.dark : LOGO.light}
      style={{ width: size * 1.6, height: size * 1.6 }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Voidation"
    />
  );
}
