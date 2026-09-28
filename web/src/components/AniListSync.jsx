// More → AniList: sign in for two-way sync, see its state, sync now, sign out.
import { useEffect, useState } from "react";
import { onSyncState, authUrl, syncNow, signOut, redirectUri } from "@voidation/shared/sync/anilist";
import { timeAgo } from "@voidation/shared/backend/store";

export default function AniListSync({ onChange }) {
  const [s, setS] = useState(null);
  const [result, setResult] = useState("");
  useEffect(() => onSyncState(setS), []);
  if (!s) return null;

  if (!s.configured) {
    return (
      <section className="panel stack-sm">
        <b>Sync with AniList</b>
        <p className="faint small">
          Sync isn't set up on this copy of the website. It needs a free AniList app: register one at
          anilist.co/settings/developer with the redirect URL <code>{redirectUri()}</code>, then put its client id in
          VITE_ANILIST_CLIENT_ID and rebuild. Until then, use the import below.
        </p>
      </section>
    );
  }

  if (!s.connected) {
    return (
      <section className="panel stack-sm">
        <b>Sync with AniList</b>
        <p className="faint small">
          Sign in once and your anime and manga lists stay the same everywhere: this website, the Voidation app, and
          AniList itself. Status and progress sync both ways. Verdicts, categories, Excited and your watch log stay on
          this device. The first sync merges both sides; nothing is deleted.
        </p>
        <div><a className="btn primary" href={authUrl()}>Sign in with AniList</a></div>
        {s.error && <p className="field-error">{s.error}</p>}
      </section>
    );
  }

  const run = async () => {
    setResult("");
    const r = await syncNow({ reason: "manual", force: true });
    if (r) {
      setResult(r.added || r.updated || r.removed
        ? `From AniList: ${r.added} added, ${r.updated} updated, ${r.removed} removed.`
        : "Everything's already in sync.");
      onChange?.();
    }
  };

  return (
    <section className="panel stack-sm">
      <div className="row gap-12">
        {s.user?.avatar && <img src={s.user.avatar} alt="" className="avatar" />}
        <div className="grow">
          <b>Synced with AniList</b>
          <div className="faint small">
            Signed in as {s.user?.name} · {s.busy ? "syncing…" : s.lastSync ? `last synced ${timeAgo(s.lastSync)}` : "not synced yet"}
            {s.pending > 0 && ` · ${s.pending} change${s.pending === 1 ? "" : "s"} waiting to send`}
          </div>
        </div>
      </div>
      {s.error && <p className="field-error">{s.error}</p>}
      {result && <p className="faint small" role="status">{result}</p>}
      <div className="row gap-8 wrap">
        <button className="btn primary" onClick={run} disabled={s.busy}>{s.busy ? "Syncing…" : "Sync now"}</button>
        {/expired/i.test(s.error) && <a className="btn ghost" href={authUrl()}>Sign in again</a>}
        <button className="btn ghost" onClick={() => window.confirm("Sign out of AniList? Your library stays on this device; it just stops syncing.") && signOut()}>
          Sign out
        </button>
      </div>
      <p className="faint small">Verdicts, categories, Excited and your watch log aren't synced (AniList has no place for them). They're in your backups.</p>
    </section>
  );
}
