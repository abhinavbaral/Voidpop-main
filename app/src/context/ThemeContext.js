// Theme: you choose System / Light / Dark, plus Pure black for dark.
// "System" follows the phone's dark mode live. Persists across restarts.
import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES, resolveTheme } from "@voidation/shared/theme";

const KEY = "voidation_theme"; // "system" | "light" | "dark" (older saves: "void" / "pop")
const BLACK_KEY = "voidation_black";
const Ctx = createContext({ mode: "void", dark: true, C: THEMES.void, pref: "system", setPref: () => {}, pureBlack: false, setPureBlack: () => {} });

export function ThemeProvider({ children }) {
  const scheme = useColorScheme();
  const [pref, setPrefState] = useState("system");
  const [pureBlack, setBlackState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "void") setPrefState("dark");
      else if (v === "pop") setPrefState("light");
      else if (["system", "light", "dark"].includes(v)) setPrefState(v);
    });
    AsyncStorage.getItem(BLACK_KEY).then((v) => setBlackState(v === "1"));
  }, []);

  const mode = resolveTheme(pref, pureBlack, scheme !== "light");
  const setPref = (p) => { setPrefState(p); AsyncStorage.setItem(KEY, p); };
  const setPureBlack = (b) => { setBlackState(b); AsyncStorage.setItem(BLACK_KEY, b ? "1" : "0"); };
  const setMode = (m) => setPref(m === "pop" ? "light" : "dark");

  return (
    <Ctx.Provider value={{ mode, dark: mode !== "pop", C: THEMES[mode], pref, setPref, pureBlack, setPureBlack, setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
