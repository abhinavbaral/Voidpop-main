// FILE: shared/features/publishUpdate.js — the "Publish update" button's brain: asks GitHub to run the publish-update
// workflow (.github/workflows/publish-update.yml), which tests the code and runs `eas update`; and reads back how that run is going.
// The EAS access token lives in the repository's secrets, never in the app. The app holds only a GitHub token that can do
// one thing: start workflows in this one repository.

export const CHANNELS = ["preview", "production"];
const API = "https://api.github.com/repos/";
const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

// -> { ok: true } | { ok: false, reason: "input" | "token" | "notfound" | "network" | "status" }
export async function dispatchPublish({ repo, workflow, ref, token, notes, channel }, f = globalThis.fetch) {
  const text = String(notes ?? "").trim();
  if (!token || !text || text.length > 300 || !CHANNELS.includes(channel)) return { ok: false, reason: "input" };
  try {
    const res = await f(`${API}${repo}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref, inputs: { notes: text, channel } }),
    });
    if (res.status === 204) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "token" };
    if (res.status === 404 || res.status === 422) return { ok: false, reason: "notfound" }; // wrong repo/workflow/branch, or the token can't see it
    return { ok: false, reason: "status" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

// the newest run of the workflow -> { status, conclusion, createdAt } | null
export async function latestRun({ repo, workflow, token }, f = globalThis.fetch) {
  try {
    const res = await f(`${API}${repo}/actions/workflows/${workflow}/runs?per_page=1`, { headers: headers(token) });
    if (!res.ok) return null;
    const r = (await res.json()).workflow_runs?.[0];
    return r ? { status: r.status, conclusion: r.conclusion, createdAt: r.created_at } : null;
  } catch {
    return null;
  }
}

export function runLabel(run) {
  if (!run) return "No publish yet.";
  if (run.status === "queued" || run.status === "waiting" || run.status === "pending") return "Waiting to start…";
  if (run.status !== "completed") return "Checking the code and publishing…";
  if (run.conclusion === "success") return "Published. Phones get it the next time they open VoidPop.";
  if (run.conclusion === "cancelled") return "Cancelled. Nothing was published.";
  return "Failed. A check or the publish step failed, so nothing reached phones. Open the run on GitHub for the reason.";
}

export const REASONS = {
  input: "Write what's new (up to 300 characters), pick a channel and enter your token.",
  token: "GitHub refused the token. It needs Actions: read and write on this repository.",
  notfound: "GitHub can't find the workflow on that branch. Push .github/workflows/publish-update.yml first.",
  network: "Couldn't reach GitHub. Check your connection.",
  status: "GitHub answered with an unexpected error. Try again in a minute.",
};
