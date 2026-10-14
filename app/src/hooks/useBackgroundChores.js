// Backups and episode alerts: run on launch, whenever the app returns to the
// foreground, and (alerts only) shortly after the library changes.
// Loaded lazily so the website build never touches the native-only modules.
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { onDataChange } from "@voidation/shared/backend/store";
import { navRef } from "../navigation/navRef";

export default function useBackgroundChores() {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const backup = require("../services/backup");
    const alerts = require("../services/episodeAlerts");
    const widget = require("../widget");
    require("../services/backgroundWork").registerBackgroundWork();
    const sync = require("@voidation/shared/sync/anilist");
    const { promoteExcitedNow } = require("@voidation/shared/features/excited");
    const chores = () => {
      promoteExcitedNow(); // Excited anime that came out → Watching
      sync.syncNow({ reason: "open" });
      if (Platform.OS === "android") backup.maybeAutoBackup();
      alerts.rescheduleEpisodeAlerts();
      widget.updateWidget();
    };
    chores();
    const appState = AppState.addEventListener("change", (s) => { if (s === "active") chores(); });
    let timer;
    const stopData = onDataChange(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { alerts.rescheduleEpisodeAlerts(); widget.updateWidget(); }, 3000);
    });
    const stopTap = alerts.onAlertTapped((params) => {
      const go = () => navRef.navigate("Detail", params);
      if (navRef.isReady()) go(); else setTimeout(go, 800);
    });
    return () => { appState.remove(); stopData(); stopTap(); clearTimeout(timer); };
  }, []);
}
