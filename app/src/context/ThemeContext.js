// Theme: you choose System / Light / Dark, plus Pure black for dark, and a
// colour theme (Void, Ember, Sakura, Tide, Matcha, Frost).
// "System" follows the phone's dark mode live. Persists across restarts.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES, resolveTheme, applyPalette, PALETTES } from "@voidation/shared/lib/theme";

const KEY = "voidation_theme"; // "system" | "light" | "dark" (older saves: "void" / "pop")
const BLACK_KEY = "voidation_black";
const PALETTE_KEY = "voidation_palette";
const Ctx = createContext({ mode: "void", dark: true, C: THEMES.void, pref: "system", setPref: () => {}, pureBlack: false, setPureBlack: () => {}, palette: "void", setPalette: () => {} });

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();
  const [pref, setPrefState] = useState("system");
  const [pureBlack, setBlackState] = useState(false);
  const [palette, setPaletteState] = useState("void");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "void") setPrefState("dark");
      else if (v === "pop") setPrefState("light");
      else if (["system", "light", "dark"].includes(v)) setPrefState(v);
    });
    AsyncStorage.getItem(BLACK_KEY).then((v) => setBlackState(v === "1"));
    AsyncStorage.getItem(PALETTE_KEY).then((v) => { if (PALETTES.some((p) => p.key === v)) setPaletteState(v); });
  }, []);

  const mode = resolveTheme(pref, pureBlack, scheme !== "light");
  const setPref = (p) => { setPrefState(p); AsyncStorage.setItem(KEY, p); };
  const setPureBlack = (b) => { setBlackState(b); AsyncStorage.setItem(BLACK_KEY, b ? "1" : "0"); };
  const setMode = (m) => setPref(m === "pop" ? "light" : "dark");
  const setPalette = (k) => { setPaletteState(k); AsyncStorage.setItem(PALETTE_KEY, k); };
  const C = useMemo(() => applyPalette(THEMES[mode], mode, palette), [mode, palette]);

  return (
    <Ctx.Provider value={{ mode, dark: mode !== "pop", C, pref, setPref, pureBlack, setPureBlack, setMode, palette, setPalette }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
