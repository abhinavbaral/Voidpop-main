// App-wide settings (24-hour clock, countdown badges on posters), saved on the
// device with the rest of your data. Plain React, so both platforms use it.
import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import { getSettings, setSetting, DEFAULT_SETTINGS } from "./store.js";

const Ctx = createContext({ settings: DEFAULT_SETTINGS, update: async () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);
  const update = useCallback(async (key, value) => {
    setSettings((s) => ({ ...s, [key]: value })); // instant UI, then persist
    setSettings(await setSetting(key, value));
  }, []);
  // re-read after a restore or a clear, which replace settings wholesale
  const reload = useCallback(() => getSettings().then(setSettings), []);
  return createElement(Ctx.Provider, { value: { settings, update, reload } }, children);
}

export const useSettings = () => useContext(Ctx);
