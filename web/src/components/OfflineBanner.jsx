// "Offline · showing info from 2 hr ago" — appears when AniList can't be
// reached and saved answers are being shown instead (see shared/api/cache.js).
import { useEffect, useState } from "react";
import { onNetState } from "@voidation/shared/api/anilist";
import { timeAgo } from "@voidation/shared/backend/store";

export default function OfflineBanner() {
  const [net, setNet] = useState({ offline: false, since: null });
  useEffect(() => onNetState(setNet), []);
  if (!net.offline) return null;
  return (
    <div className="offline-banner" role="status">
      <b>Offline</b> · {net.since ? `showing info saved ${timeAgo(new Date(net.since).toISOString())}` : "nothing saved for this page yet"}
    </div>
  );
}
