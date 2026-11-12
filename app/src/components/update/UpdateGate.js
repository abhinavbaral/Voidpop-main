// FILE: app/src/components/update/UpdateGate.js — mounted once in App.js. Looks for a published update when VoidPop starts
// and whenever it comes back to the front (at most every 6 hours), downloads it quietly, and opens the update sheet when
// it is ready to apply. Also opens the sheet when About > Check for updates finds one.
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { useAppUpdate, checkNow, downloadNow, restartNow, onSheetRequest, updatesOn } from "../../hooks/useAppUpdate.js";
import UpdateSheet from "./UpdateSheet.js";

const EVERY_MS = 6 * 3600e3;

export default function UpdateGate() {
  const { settings, ready } = useSettings();
  const up = useAppUpdate();
  const [dismissed, setDismissed] = useState(null); // the update the person said "Later" to
  const [forced, setForced] = useState(false);      // opened from About
  const last = useRef(0);
  const on = ready && settings.autoUpdateCheck !== false;

  useEffect(() => onSheetRequest(() => { setForced(true); setDismissed(null); }), []);

  useEffect(() => {
    if (!updatesOn || !on) return undefined;
    const look = async () => {
      if (Date.now() - last.current < EVERY_MS) return;
      last.current = Date.now();
      if ((await checkNow()) === "available") await downloadNow();
    };
    const t = setTimeout(look, 5000);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") look(); });
    return () => { clearTimeout(t); sub.remove(); };
  }, [on]);

  const live = up.phase === "available" || up.phase === "downloading" || up.phase === "ready";
  if (!updatesOn || !live) return null;
  if (!forced && !(on && up.phase !== "available" && dismissed !== up.id)) return null; // a background find opens when downloaded

  return (
    <UpdateSheet
      phase={up.phase} progress={up.progress} notes={up.notes} publishedAt={up.publishedAt}
      onDownload={downloadNow} onRestart={restartNow}
      onLater={() => { setDismissed(up.id); setForced(false); }}
    />
  );
}
