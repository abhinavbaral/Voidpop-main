// Two themes: "void" (dark) and "pop" (warm light).
export const THEMES = {
  void: {
    bg: "#0b0f19", card: "#111827", border: "#1f2937", inputBg: "#0f1524",
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
// fallback for anything not yet converted
export const C = THEMES.void;

// Brand constants used by both clients
export const BRAND = { name: "Voidation", orange: "#ee8f2e", purple: "#a855f7", ink: "#0b0f19" };
