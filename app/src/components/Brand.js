// The Voidation logo, icon only (no wordmark). You pick one in More ›
// Appearance: the classic countdown ring around a V, the ring with Voidmon in
// place of the orange dot, or Voidmon peeking. The V is light on dark themes
// and dark on the light theme, so it never vanishes.
// On the phone the home-screen icon changes to match (app version 1.0.1+).
import { Image, Platform } from "react-native";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useTheme } from "../context/ThemeContext.js";

export const LOGOS = {
  classic: { label: "Classic", dark: require("../../assets/logo.png"), light: require("../../assets/logo-light.png") },
  voidmon: { label: "Voidmon ring", dark: require("../../assets/logo-voidmon.png"), light: require("../../assets/logo-voidmon-light.png") },
  peeking: { label: "Voidmon peeking", dark: require("../../assets/logo-peeking.png"), light: require("../../assets/logo-peeking.png") },
};
export const LOGO = { dark: LOGOS.classic.dark, light: LOGOS.classic.light };

// Home-screen icon: the native part only exists in builds from version 1.0.1
// on, so an older APK (or Expo Go) skips it instead of crashing.
let appIcons = null;
try { appIcons = Platform.OS === "web" ? null : require("expo-alternate-app-icons"); } catch { appIcons = null; }
const ICON_NAME = { classic: null, voidmon: "Voidmon", peeking: "Peeking" };

// Point the home-screen icon at the chosen logo. Resolves to true if it changed.
export async function applyAppIcon(logo) {
  if (!appIcons?.supportsAlternateIcons) return false;
  const want = ICON_NAME[logo] ?? null;
  try {
    if ((appIcons.getAppIconName?.() ?? null) === want) return false;
    await appIcons.setAlternateAppIcon(want);
    return true;
  } catch { return false; }
}
export const canChangeAppIcon = () => !!appIcons?.supportsAlternateIcons;

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
