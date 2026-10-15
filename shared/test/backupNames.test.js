import { test } from "node:test";
import assert from "node:assert/strict";
import { backupNumber, nextBackupNumber, sortBackups, BACKUP_FOLDER } from "../lib/backupNames.js";

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
