// Where AniList sends you back after signing in: /auth/anilist#access_token=…
// Finishes the sign-in, runs the first sync, then goes to More → AniList.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { finishSignIn } from "@voidation/shared/sync/anilist";

export default function AuthAniList() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    const url = window.location.href;
    window.history.replaceState(null, "", window.location.pathname); // don't leave the token in the address bar
    finishSignIn(url)
      .then(() => navigate("/more/anilist", { replace: true }))
      .catch((e) => setError(e.message || "Couldn't sign in to AniList."));
  }, [navigate]);
  return (
    <div className="center-page">
      {error ? (
        <>
          <h1>AniList sign-in didn't work</h1>
          <p className="muted">{error}</p>
          <Link to="/more/anilist" className="btn primary">Back to AniList settings</Link>
        </>
      ) : (
        <>
          <div className="spinner" aria-label="Signing in" />
          <p className="muted">Signing in and syncing your lists…</p>
        </>
      )}
    </div>
  );
}
