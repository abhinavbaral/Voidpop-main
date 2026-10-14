// Each Void Verdict asks for its own five moods.
import test from "node:test";
import assert from "node:assert/strict";
import { VERDICTS, MOODS, MOODS_BY_VERDICT, moodsFor } from "../backend/store.js";

test("every verdict has five different moods of its own", () => {
  VERDICTS.forEach((v) => assert.equal(new Set(moodsFor(v.key)).size, 5, v.key));
  assert.equal(MOODS.length, 20);
  assert.equal(new Set(MOODS).size, 20);
  assert.deepEqual(Object.keys(MOODS_BY_VERDICT), VERDICTS.map((v) => v.key));
});

test("moodsFor gives nothing for no verdict", () => {
  assert.deepEqual(moodsFor(null), []);
  assert.deepEqual(moodsFor("nope"), []);
});
