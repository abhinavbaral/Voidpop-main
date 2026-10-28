import { test } from "node:test";
import assert from "node:assert/strict";
import { backupNumber, nextBackupNumber, sortBackups, BACKUP_FOLDER, needsBackupFirst, FRESH_BACKUP_MS } from "../lib/backupNames.js";

test("backup names: popv1, popv2 … with or without the .json", () => {
  assert.equal(BACKUP_FOLDER, "Voidpop");
  assert.equal(backupNumber("popv1"), 1);
  assert.equal(backupNumber("popv12.json"), 12);
  assert.equal(backupNumber("POPV3.JSON"), 3);
  assert.equal(backupNumber("voidpop-backup-2026-09-28-16-21.json"), null);
  assert.equal(backupNumber("popv"), null);
  assert.equal(backupNumber(undefined), null);
});

test("next backup number: one more than the highest, starting at 1", () => {
  assert.equal(nextBackupNumber([]), 1);
  assert.equal(nextBackupNumber(["popv1.json", "popv2.json"]), 3);
  assert.equal(nextBackupNumber(["popv2.json", "notes.txt", "popv9.json", "popv4.json"]), 10); // gaps don't matter
  assert.equal(nextBackupNumber(["voidpop-backup-2026-09-28.json"]), 1);
});

test("restore list: newest popv first, then older-format files", () => {
  const sorted = sortBackups([
    { name: "voidpop-backup-2026-09-01-10-00" },
    { name: "popv2" },
    { name: "popv10" },
    { name: "voidpop-backup-2026-09-28-16-21" },
    { name: "popv1" },
  ]).map((f) => f.name);
  assert.deepEqual(sorted, ["popv10", "popv2", "popv1", "voidpop-backup-2026-09-28-16-21", "voidpop-backup-2026-09-01-10-00"]);
});

test("back up before signing in: only a guest with something to lose and no backup from the last day", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const need = (over) => needsBackupFirst({ signedIn: false, titles: 200, lastBackup: null, now, ...over });

  assert.equal(need({}), true);                                  // a guest with 200 titles and no backup
  assert.equal(need({ titles: 0 }), false);                      // nothing on the phone: nothing to protect
  assert.equal(need({ titles: undefined }), false);
  assert.equal(need({ signedIn: true }), false);                 // only for people without an account
  assert.equal(need({ lastBackup: iso(60 * 1000) }), false);     // just backed up
  assert.equal(need({ lastBackup: iso(FRESH_BACKUP_MS - 1000) }), false); // the daily automatic backup counts
  assert.equal(need({ lastBackup: iso(FRESH_BACKUP_MS + 1000) }), true);  // a day old: make a new one
  assert.equal(need({ lastBackup: "not a date" }), true);
  assert.equal(need({ lastBackup: iso(-3600e3) }), true);        // dated in the future: clock trouble, don't trust it
});
