// Automatic backups, the way Mihon does them: you pick a folder once (say
// Downloads/VoidPop), and a backup file is written there on a schedule.
// Files in a folder you chose survive uninstalling the app, unlike app storage.
//
// The check runs when the app starts, when it comes back to the foreground,
// and in Android's background jobs while it's closed (see backgroundWork.js).
//
// Config lives in its own AsyncStorage key (not in the library), so restoring a
// backup from another phone can't point this phone at a folder it can't reach.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StorageAccessFramework as SAF, writeAsStringAsync, readAsStringAsync,
} from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { exportData, importData } from "@voidpop/shared/backend/store";

const KEY = "voidation:backup:v1";
const HOUR = 3600e3;
export const FREQUENCIES = [
  { key: "off", label: "Off", ms: 0 },
  { key: "12h", label: "Every 12 hours", ms: 12 * HOUR },
  { key: "daily", label: "Daily", ms: 24 * HOUR },
  { key: "weekly", label: "Weekly", ms: 7 * 24 * HOUR },
];
export const KEEP = 5; // newest backup files kept in the folder
const PREFIX = "voidpop-backup-";

const DEFAULT = { dirUri: null, dirName: null, freq: "daily", last: null, lastError: null };

export async function getBackupConfig() {
  try {
    return { ...DEFAULT, ...JSON.parse((await AsyncStorage.getItem(KEY)) || "{}") };
  } catch {
    return { ...DEFAULT };
  }
}

async function saveConfig(patch) {
  const next = { ...(await getBackupConfig()), ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export const setFrequency = (freq) => saveConfig({ freq });

// A readable name for a SAF folder URI, e.g. ".../tree/primary%3ADownload%2FVoidPop" → "Download/VoidPop"
function folderName(uri) {
  try {
    const tail = decodeURIComponent(uri.split("/tree/")[1] || "");
    return tail.split(":").pop() || tail;
  } catch {
    return "Chosen folder";
  }
}

// Android's folder picker. Returns the new config, or null if cancelled.
export async function chooseFolder() {
  const res = await SAF.requestDirectoryPermissionsAsync();
  if (!res.granted) return null;
  return saveConfig({ dirUri: res.directoryUri, dirName: folderName(res.directoryUri), lastError: null });
}

// Writes one backup file now, then deletes all but the newest KEEP.
export async function backupNow() {
  const cfg = await getBackupConfig();
  if (!cfg.dirUri) throw new Error("Choose a backup folder first.");
  try {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"); // 2026-09-28-16-21
    const fileUri = await SAF.createFileAsync(cfg.dirUri, `${PREFIX}${stamp}`, "application/json");
    await writeAsStringAsync(fileUri, await exportData());
    await prune(cfg.dirUri);
    return saveConfig({ last: new Date().toISOString(), lastError: null });
  } catch (e) {
    // most often: the folder was deleted or its permission revoked
    await saveConfig({ lastError: "Couldn't write to the backup folder. Choose it again." });
    throw e;
  }
}

async function prune(dirUri) {
  const files = (await SAF.readDirectoryAsync(dirUri))
    .filter((u) => decodeURIComponent(u).includes(PREFIX))
    .sort(); // timestamped names sort oldest → newest
  const extra = files.slice(0, Math.max(0, files.length - KEEP));
  for (const uri of extra) {
    try { await SAF.deleteAsync(uri); } catch { /* keep going */ }
  }
}

// Called on app start and when the app returns to the foreground.
export async function maybeAutoBackup() {
  const cfg = await getBackupConfig();
  const freq = FREQUENCIES.find((f) => f.key === cfg.freq);
  if (!cfg.dirUri || !freq?.ms) return false;
  if (cfg.last && Date.now() - new Date(cfg.last).getTime() < freq.ms) return false;
  try {
    await backupNow();
    return true;
  } catch {
    return false;
  }
}

// Pick any backup file (from the backup folder, Downloads, Drive…) and restore it.
// Returns an error message, "cancelled", or null on success.
export async function restoreFromFile() {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return "cancelled";
  try {
    return await importData(await readAsStringAsync(res.assets[0].uri));
  } catch {
    return "Couldn't read that file.";
  }
}
