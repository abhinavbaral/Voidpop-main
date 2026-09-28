// Theme state: "void" (dark) or "pop" (light). Persists across restarts.
import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEMES } from "@voidation/shared/theme";

const Ctx = createContext({ mode: "void", C: THEMES.void, setMode: () => {} });

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState("void");

  useEffect(() => {
    AsyncStorage.getItem("voidation_theme").then(
      (v) => v && THEMES[v] && setModeState(v)
    );
  }, []);

  const setMode = (m) => {
    setModeState(m);
    AsyncStorage.setItem("voidation_theme", m);
  };

  return (
    <Ctx.Provider value={{ mode, C: THEMES[mode], setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
