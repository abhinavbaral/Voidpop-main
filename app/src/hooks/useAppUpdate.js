// FILE: app/src/hooks/useAppUpdate.js — the update state for the app (EAS Update through expo-updates): which phase it is
// in, and the actions: check, download, restart. Everything is inert in development and on the web, where updates don't exist.
import { Platform } from "react-native";
import * as Updates from "expo-updates";
import { updatePhase, readNotes, progressOf } from "@voidpop/shared/features/otaUpdate";

export const updatesOn = Platform.OS !== "web" && !!Updates.isEnabled;

export function useAppUpdate() {
  const u = Updates.useUpdates();
  const info = u.downloadedUpdate || u.availableUpdate || null;
  return {
    phase: updatesOn ? updatePhase(u) : "off",
    progress: progressOf(u),
    notes: readNotes(info),
    publishedAt: info?.createdAt || null,
    id: info?.updateId || null,
  };
}

// -> "available" | "none" | "error"
export async function checkNow() {
  try { return (await Updates.checkForUpdateAsync()).isAvailable ? "available" : "none"; } catch { return "error"; }
}
export async function downloadNow() {
  try { await Updates.fetchUpdateAsync(); return true; } catch { return false; }
}
export const restartNow = () => Updates.reloadAsync().catch(() => {});

// About's "Check for updates" asks the sheet (mounted once in App.js) to open
const listeners = new Set();
export const requestUpdateSheet = () => listeners.forEach((l) => l());
export const onSheetRequest = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
