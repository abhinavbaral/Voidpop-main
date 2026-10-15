// Themes: "void" (dark), "black" (pure black dark) and "pop" (warm light).
// You choose System / Light / Dark (+ Pure black); resolveTheme picks the palette.
export function resolveTheme(pref, pureBlack, systemDark) {
  const dark = pref === "dark" || (pref === "system" && systemDark);
  return dark ? (pureBlack ? "black" : "void") : "pop";
}
export const THEMES = {
  void: {
    bg: "#0b0f19", card: "#111827", border: "#1f2937", inputBg: "#0f1524",
    text: "#f3f4f6", sub: "#9ca3af", faint: "#6b7280",
    purple: "#a855f7", orange: "#ee8f2e",
    green: "#10b981", amber: "#f59e0b", rose: "#f43f5e",
  },
  // dark with a pure black background (saves battery on OLED screens)
  black: {
    bg: "#000000", card: "#0d0d10", border: "#1c1c22", inputBg: "#08080a",
    text: "#f3f4f6", sub: "#9ca3af", faint: "#6b7280",
    purple: "#a855f7", orange: "#ee8f2e",
    green: "#10b981", amber: "#f59e0b", rose: "#f43f5e",
  },
  pop: {
    bg: "#faf7f2", card: "#ffffff", border: "#e8e0d4", inputBg: "#f3ede3",
    text: "#1c1917", sub: "#57534e", faint: "#a8a29e",
    purple: "#9333ea", orange: "#d97a16",
    green: "#059669", amber: "#d97706", rose: "#e11d48",
  },
};
// Colour themes (idea from Mihon's named themes). Each one swaps the accent
// pair everywhere and tints the dark background; light mode and Pure black
// only take the accents, so Pure black stays truly black.
// Accents are picked dark enough for white text on buttons.
export const PALETTES = [
  { key: "void", label: "Void" },
  { key: "ember", label: "Ember", accent: ["#ef4444", "#dc2626"], second: "#f59e0b",
    tint: { bg: "#130a0c", card: "#1e1013", border: "#35191e", inputBg: "#170c0f" } },
  { key: "sakura", label: "Sakura", accent: ["#ec4899", "#db2777"], second: "#fb923c",
    tint: { bg: "#140b13", card: "#20121e", border: "#361f33", inputBg: "#190e18" } },
  { key: "tide", label: "Tide", accent: ["#0891b2", "#0e7490"], second: "#f59e0b",
    tint: { bg: "#07121a", card: "#0c1d27", border: "#17323f", inputBg: "#0a1720" } },
  { key: "matcha", label: "Matcha", accent: ["#16a34a", "#15803d"], second: "#eab308",
    tint: { bg: "#09120c", card: "#101d15", border: "#1c3325", inputBg: "#0c170f" } },
  { key: "frost", label: "Frost", accent: ["#5e81ac", "#4c6a92"], second: "#ebcb8b",
    tint: { bg: "#1b1f27", card: "#242a35", border: "#343c4b", inputBg: "#20252f", sub: "#b4bccb", faint: "#8791a3" } },
];

export function applyPalette(theme, mode, key) {
  const p = PALETTES.find((x) => x.key === key);
  if (!p || !p.accent) return theme;
  const light = mode === "pop";
  return {
    ...theme,
    ...(mode === "void" ? p.tint : {}),
    purple: light ? p.accent[1] : p.accent[0],
    orange: light ? theme.orange : p.second,
  };
}

// fallback for anything not yet converted
export const C = THEMES.void;

// Brand constants used by both clients
export const BRAND = { name: "VoidPop", orange: "#ee8f2e", purple: "#a855f7", ink: "#0b0f19" };
