import { test } from "node:test";
import assert from "node:assert/strict";
import { greetingFor } from "../lib/greeting.js";

test("greeting by the hour: 5 morning, 12 afternoon, 17 evening, 21 until 4:59 still up", () => {
  const at = (h) => greetingFor(h);
  assert.equal(at(5), "Good morning");
  assert.equal(at(11), "Good morning");
  assert.equal(at(12), "Good afternoon");
  assert.equal(at(16), "Good afternoon");
  assert.equal(at(17), "Good evening");
  assert.equal(at(20), "Good evening");
  assert.equal(at(21), "Still up?");
  assert.equal(at(23), "Still up?");
  assert.equal(at(0), "Still up?");
  assert.equal(at(4), "Still up?");
});

test("greeting with a name; blank names are ignored", () => {
  assert.equal(greetingFor(9, "Baral"), "Good morning, Baral");
  assert.equal(greetingFor(22, "Baral"), "Still up, Baral?");
  assert.equal(greetingFor(9, "   "), "Good morning");
  assert.equal(greetingFor(9, null), "Good morning");
});
