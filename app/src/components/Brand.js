// The Voidation logo, icon only (no wordmark). You pick one in More ›
// Appearance: the classic countdown ring around a V, the ring with Voidmon in
// place of the orange dot, or Voidmon peeking. The V is light on dark themes
// and dark on the light theme, so it never vanishes.
// (This is the logo inside the app. The home-screen icon needs a new build to change.)
import { Image } from "react-native";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useTheme } from "../context/ThemeContext.js";

export const LOGOS = {
  classic: { label: "Classic", dark: require("../../assets/logo.png"), light: require("../../assets/logo-light.png") },
  voidmon: { label: "Voidmon ring", dark: require("../../assets/logo-voidmon.png"), light: require("../../assets/logo-voidmon-light.png") },
  peeking: { label: "Voidmon peeking", dark: require("../../assets/logo-peeking.png"), light: require("../../assets/logo-peeking.png") },
};
export const LOGO = { dark: LOGOS.classic.dark, light: LOGOS.classic.light };

// the logo picture for the current setting and theme
export function useLogo() {
  const { dark } = useTheme();
  const { settings } = useSettings();
  const l = LOGOS[settings?.logo] || LOGOS.classic;
  return dark ? l.dark : l.light;
}

export default function Brand({ size = 20 }) {
  const source = useLogo();
  return (
    <Image
      source={source}
      style={{ width: size * 1.6, height: size * 1.6 }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Voidation"
    />
  );
}
