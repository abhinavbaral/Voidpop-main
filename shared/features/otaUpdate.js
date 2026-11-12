// FILE: shared/features/otaUpdate.js — pure helpers for the in-app update sheet (EAS Update): which phase the update is in,
// and the "what's new" text that travels inside the update itself. No network, no storage.
// The phone side (expo-updates) is app/src/hooks/useAppUpdate.js.

// u: what expo-updates' useUpdates() returns. -> "downloading" | "ready" | "available" | "checking" | "error" | "idle"
export function updatePhase(u) {
  if (!u) return "idle";
  if (u.isDownloading) return "downloading";
  if (u.isUpdatePending) return "ready";      // downloaded: restarting applies it
  if (u.isUpdateAvailable) return "available"; // published but not downloaded yet
  if (u.isChecking) return "checking";
  if (u.checkError || u.downloadError) return "error";
  return "idle";
}

const EMOJI = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;

// The notes are put into the update when it is published (extra.updateNotes in app.config.js).
// update: { manifest } as given by expo-updates. -> plain text, at most 400 characters
export function readNotes(update) {
  const m = update?.manifest;
  const raw = m?.extra?.expoClient?.extra?.updateNotes ?? m?.extra?.updateNotes ?? "";
  let t = String(raw).replace(EMOJI, "").replace(/\r/g, "").trim();
  if (t.length > 400) t = t.slice(0, 400).replace(/\s+\S*$/, "") + "…";
  return t;
}

// 0..1 or null (unknown: show a plain "Downloading")
export function progressOf(u) {
  const p = u?.downloadProgress;
  return typeof p === "number" && p >= 0 ? Math.min(1, p) : null;
}
