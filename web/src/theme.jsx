// Void (dark) / Pop (light) themes — the SAME palettes as the app, taken from
// @voidation/shared/theme and exposed to CSS as custom properties (--bg, --card …).
import { createContext, useContext, useEffect, useState } from "react";
import { THEMES } from "@voidation/shared/theme";

const KEY = "voidation_theme";
const Ctx = createContext({ mode: "void", setMode: () => {} });

const cssName = (k) => "--" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()); // inputBg → --input-bg

function readSaved() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES[v] ? v : "void";
  } catch {
    return "void";
  }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readSaved);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = mode === "void" ? "dark" : "light";
    for (const [k, v] of Object.entries(THEMES[mode])) root.style.setProperty(cssName(k), v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[mode].bg);
  }, [mode]);

  const setMode = (m) => {
    setModeState(m);
    try { localStorage.setItem(KEY, m); } catch { /* private mode etc. */ }
  };

  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
