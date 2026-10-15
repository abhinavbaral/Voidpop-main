// App-wide settings (24-hour clock, countdown badges on posters), saved on the
// device with the rest of your data. Plain React, so both platforms use it.
import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";
import { getSettings, setSetting, DEFAULT_SETTINGS } from "./store.js";

const Ctx = createContext({ settings: DEFAULT_SETTINGS, update: async () => {}, ready: false });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false); // false until the saved settings are read (so nothing flashes)
  useEffect(() => {
    getSettings().then(setSettings).catch(() => {}).finally(() => setReady(true));
  }, []);
  const update = useCallback(async (key, value) => {
    setSettings((s) => ({ ...s, [key]: value })); // instant UI, then persist
    setSettings(await setSetting(key, value));
  }, []);
  // re-read after a restore or a clear, which replace settings wholesale
  const reload = useCallback(() => getSettings().then(setSettings), []);
  return createElement(Ctx.Provider, { value: { settings, update, reload, ready } }, children);
}

export const useSettings = () => useContext(Ctx);
