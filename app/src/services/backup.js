// Backups, the way Mihon does them: the first time, you pick where; the app
// creates a folder called "Voidpop" there and saves popv1, popv2, popv3 … into it,
// by hand (Create backup) or on a schedule. Restore opens that same folder and
// you tap a file. Files in a folder you chose survive uninstalling the app.
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
import { BACKUP_FOLDER, backupNumber, nextBackupNumber, sortBackups } from "@voidpop/shared/lib/backupNames";

const KEY = "voidation:backup:v1";
const HOUR = 3600e3;
export const FREQUENCIES = [
  { key: "off", label: "Off", ms: 0 },
  { key: "12h", label: "Every 12 hours", ms: 12 * HOUR },
  { key: "daily", label: "Daily", ms: 24 * HOUR },
  { key: "weekly", label: "Weekly", ms: 7 * 24 * HOUR },
];
export const KEEP = 5; // newest numbered backups kept in the folder

const DEFAULT = { dirUri: null, dirName: null, freq: "daily", last: null, lastFile: null, lastError: null };

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
// A backup made another way (the iPhone share sheet) still counts as "backed up just now" for the sign-in check
export const markBackedUp = () => saveConfig({ last: new Date().toISOString() });

// A readable name for a SAF folder URI, e.g. ".../tree/primary%3ADownload%2FVoidPop" → "Download/VoidPop"
function folderName(uri) {
  try {
    const tail = decodeURIComponent(uri.split("/tree/")[1] || "");
    return tail.split(":").pop() || tail;
  } catch {
    return "Chosen folder";
  }
}

// the last part of a SAF uri, decoded: ".../document/primary%3ADocuments%2FVoidpop%2Fpopv1.json" → "popv1.json"
function leafName(uri) {
  try {
    return decodeURIComponent(uri).split("/").pop().split(":").pop();
  } catch {
    return "";
  }
}

// Android's folder picker: you choose where, and the backups go in a "Voidpop"
// folder inside it (reused if it is already there, e.g. after reinstalling; used
// as is if you picked a folder with that name). Returns the config, or null if cancelled.
export async function chooseFolder() {
  const res = await SAF.requestDirectoryPermissionsAsync();
  if (!res.granted) return null;
  const picked = res.directoryUri;
  let dirUri = picked;
  let dirName = folderName(picked);
  if (leafName(picked).toLowerCase() !== BACKUP_FOLDER.toLowerCase()) {
    const existing = (await SAF.readDirectoryAsync(picked)).find((u) => leafName(u).toLowerCase() === BACKUP_FOLDER.toLowerCase());
    dirUri = existing || (await SAF.makeDirectoryAsync(picked, BACKUP_FOLDER));
    dirName = `${dirName}/${BACKUP_FOLDER}`;
  }
  return saveConfig({ dirUri, dirName, lastError: null });
}

// Writes the next numbered backup (popv1, popv2 …) into the Voidpop folder, then
// deletes all but the newest KEEP. Returns the config; `lastFile` is the new name.
export async function backupNow() {
  const cfg = await getBackupConfig();
  if (!cfg.dirUri) throw new Error("Choose a backup folder first.");
  try {
    const names = (await SAF.readDirectoryAsync(cfg.dirUri)).map(leafName);
    const name = `popv${nextBackupNumber(names)}`;
    const fileUri = await SAF.createFileAsync(cfg.dirUri, name, "application/json");
    await writeAsStringAsync(fileUri, await exportData());
    await prune(cfg.dirUri);
    return saveConfig({ last: new Date().toISOString(), lastFile: name, lastError: null });
  } catch (e) {
    // most often: the folder was deleted or its permission revoked
    await saveConfig({ lastError: "Couldn't write to the backup folder. Choose it again." });
    throw e;
  }
}

async function prune(dirUri) {
  // only the numbered popv files are ever deleted; anything else in the folder is left alone
  const numbered = (await SAF.readDirectoryAsync(dirUri))
    .map((uri) => ({ uri, name: leafName(uri) }))
    .filter((f) => backupNumber(f.name) != null);
  const extra = sortBackups(numbered).slice(KEEP); // sorted newest first
  for (const { uri } of extra) {
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

// The backups in your Voidpop folder, newest first: [{ uri, name }]. Null when no
// folder has been chosen yet; [] when it can't be read.
export async function listBackups() {
  const cfg = await getBackupConfig();
  if (!cfg.dirUri) return null;
  try {
    const files = (await SAF.readDirectoryAsync(cfg.dirUri))
      .map((uri) => ({ uri, file: leafName(uri) }))
      .filter((f) => backupNumber(f.file) != null || /\.json$/i.test(f.file))
      .map((f) => ({ uri: f.uri, name: f.file.replace(/\.json$/i, "") }));
    return sortBackups(files);
  } catch {
    return [];
  }
}

// Restore the file you tapped in that list. Returns an error message or null on success.
export async function restoreFromUri(uri) {
  try {
    return await importData(await readAsStringAsync(uri));
  } catch {
    return "Couldn't read that file.";
  }
}

// Pick any backup file (Downloads, Drive, another phone's copy…) and restore it.
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
