import { test } from "node:test";
import assert from "node:assert/strict";
import { updatePhase, readNotes, progressOf } from "../features/otaUpdate.js";
import { dispatchPublish, latestRun, runLabel } from "../features/publishUpdate.js";

test("update phase follows what expo-updates reports", () => {
  assert.equal(updatePhase(null), "idle");
  assert.equal(updatePhase({}), "idle");
  assert.equal(updatePhase({ isChecking: true }), "checking");
  assert.equal(updatePhase({ isUpdateAvailable: true }), "available");
  assert.equal(updatePhase({ isUpdateAvailable: true, isDownloading: true }), "downloading");
  assert.equal(updatePhase({ isUpdateAvailable: true, isUpdatePending: true }), "ready");
  assert.equal(updatePhase({ checkError: new Error("x") }), "error");
});

test("notes come out of the update's manifest as plain text", () => {
  assert.equal(readNotes({ manifest: { extra: { expoClient: { extra: { updateNotes: " Faster countdowns 🎉 \r\n" } } } } }), "Faster countdowns");
  assert.equal(readNotes({ manifest: { extra: { updateNotes: "Fix" } } }), "Fix");
  assert.equal(readNotes(null), "");
  assert.ok(readNotes({ manifest: { extra: { updateNotes: "word ".repeat(300) } } }).length <= 401);
});

test("download progress is a fraction or unknown", () => {
  assert.equal(progressOf({ downloadProgress: 0.4 }), 0.4);
  assert.equal(progressOf({ downloadProgress: 7 }), 1);
  assert.equal(progressOf({}), null);
});

const cfg = { repo: "o/r", workflow: "publish-update.yml", ref: "main", token: "t", notes: "Fix countdowns", channel: "preview" };
const reply = (status, body) => async (url, opts) => ({ status, ok: status < 300, json: async () => body, _url: url, _opts: opts });

test("publish sends the right request to GitHub", async () => {
  let seen;
  const f = async (url, opts) => { seen = { url, opts }; return { status: 204, ok: true }; };
  assert.deepEqual(await dispatchPublish(cfg, f), { ok: true });
  assert.equal(seen.url, "https://api.github.com/repos/o/r/actions/workflows/publish-update.yml/dispatches");
  assert.equal(seen.opts.headers.Authorization, "Bearer t");
  assert.deepEqual(JSON.parse(seen.opts.body), { ref: "main", inputs: { notes: "Fix countdowns", channel: "preview" } });
});

test("publish refuses bad input without calling GitHub, and maps failures", async () => {
  const never = async () => { throw new Error("should not be called"); };
  for (const bad of [{ notes: "  " }, { token: "" }, { channel: "beta" }, { notes: "x".repeat(301) }]) {
    assert.deepEqual(await dispatchPublish({ ...cfg, ...bad }, never), { ok: false, reason: "input" });
  }
  assert.equal((await dispatchPublish(cfg, reply(401))).reason, "token");
  assert.equal((await dispatchPublish(cfg, reply(404))).reason, "notfound");
  assert.equal((await dispatchPublish(cfg, reply(500))).reason, "status");
  assert.equal((await dispatchPublish(cfg, async () => { throw new Error("offline"); })).reason, "network");
});

test("run status reads the newest run and says it in words", async () => {
  const run = await latestRun(cfg, reply(200, { workflow_runs: [{ status: "completed", conclusion: "success", created_at: "2026-11-12T00:00:00Z" }] }));
  assert.match(runLabel(run), /^Published/);
  assert.match(runLabel({ status: "in_progress" }), /publishing/);
  assert.match(runLabel({ status: "completed", conclusion: "failure" }), /nothing reached phones/);
  assert.equal(await latestRun(cfg, reply(404)), null);
  assert.equal(runLabel(null), "No publish yet.");
});
