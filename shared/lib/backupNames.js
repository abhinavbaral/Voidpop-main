// Backup files live in one folder called "Voidpop" and are numbered in order:
// popv1, popv2, popv3 … (Android adds the .json). Pure helpers, so they can be tested.
export const BACKUP_FOLDER = "Voidpop";

const NUMBERED = /^popv(\d+)(\.json)?$/i;

// "popv12.json" → 12; anything else → null
export const backupNumber = (name) => {
  const m = NUMBERED.exec(String(name || "").trim());
  return m ? Number(m[1]) : null;
};

// the next name's number: one more than the highest already in the folder
export const nextBackupNumber = (names) =>
  Math.max(0, ...names.map(backupNumber).filter((n) => n != null)) + 1;

// Newest first: numbered backups by number (popv9 before popv2), then any other
// file (older backups made before the numbering) by name, newest-looking first.
export function sortBackups(files) {
  return [...files].sort((a, b) => {
    const na = backupNumber(a.name), nb = backupNumber(b.name);
    if (na != null && nb != null) return nb - na;
    if (na != null) return -1;
    if (nb != null) return 1;
    return String(b.name).localeCompare(String(a.name));
  });
}

// Before someone without an account signs in, their library gets a backup first: signing in combines it with the
// account, so keep a copy of what is on the phone. Only when there is something to lose (titles on the phone), only
// while nobody is signed in, and not when a backup from the last day already exists (the daily automatic one counts).
export const FRESH_BACKUP_MS = 24 * 3600e3;
export function needsBackupFirst({ signedIn, titles, lastBackup, now = Date.now() }) {
  if (signedIn || !(titles > 0)) return false;
  const t = lastBackup ? new Date(lastBackup).getTime() : NaN;
  const age = now - t;
  return !(Number.isFinite(t) && age < FRESH_BACKUP_MS && age > -60000); // a backup dated in the future isn't trusted
}
