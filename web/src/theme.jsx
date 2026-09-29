// Theme: you choose System / Light / Dark, plus Pure black for dark. The SAME
// palettes as the app (@voidation/shared/theme), exposed to CSS as custom
// properties (--bg, --card …). "System" follows the device's dark mode live.
import { createContext, useContext, useEffect, useState } from "react";
import { THEMES, resolveTheme } from "@voidation/shared/theme";

const KEY = "voidation_theme"; // "system" | "light" | "dark" (older saves: "void" / "pop")
const BLACK_KEY = "voidation_black";
const Ctx = createContext({ mode: "void", dark: true, pref: "system", setPref: () => {}, pureBlack: false, setPureBlack: () => {} });

const cssName = (k) => "--" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()); // inputBg → --input-bg
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode etc. */ } };

function readPref() {
  const v = read(KEY);
  if (v === "void") return "dark";
  if (v === "pop") return "light";
  return ["system", "light", "dark"].includes(v) ? v : "system";
}
const systemIsDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false;

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(readPref);
  const [pureBlack, setBlackState] = useState(() => read(BLACK_KEY) === "1");
  const [systemDark, setSystemDark] = useState(systemIsDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  const mode = resolveTheme(pref, pureBlack, systemDark);
  const dark = mode !== "pop";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = dark ? "dark" : "light";
    for (const [k, v] of Object.entries(THEMES[mode])) root.style.setProperty(cssName(k), v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[mode].bg);
  }, [mode, dark]);

  const setPref = (p) => { setPrefState(p); write(KEY, p); };
  const setPureBlack = (b) => { setBlackState(b); write(BLACK_KEY, b ? "1" : "0"); };
  // older code calls setMode("void" | "pop")
  const setMode = (m) => setPref(m === "pop" ? "light" : "dark");

  return <Ctx.Provider value={{ mode, dark, pref, setPref, pureBlack, setPureBlack, setMode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
