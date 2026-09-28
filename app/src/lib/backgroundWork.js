// Work Voidation does while it's CLOSED (Android's scheduled background jobs,
// roughly every hour when the phone allows it):
//   - the automatic backup, if one is due
//   - rebuilding episode alerts (so they don't run out if you don't open the app)
//   - refreshing the home-screen widget
//   - AniList sync, when you're signed in
// Android decides the exact timing, and some phone brands (Xiaomi, Oppo, Vivo…)
// stop background jobs to save battery; opening the app still does all of it.
//
// defineTask must run when the JS bundle loads, so this file is imported by index.js.
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { Platform } from "react-native";

export const TASK = "voidation-background";

async function runAll() {
  const jobs = [
    () => (Platform.OS === "android" ? require("./backup").maybeAutoBackup() : null),
    () => require("./episodeAlerts").rescheduleEpisodeAlerts(),
    () => require("../widget").updateWidget(),
    () => require("@voidation/shared/sync/anilist").syncNow({ reason: "background" }),
  ];
  // one failing job (no network, folder permission lost…) doesn't stop the rest
  for (const job of jobs) {
    try { await job(); } catch { /* next time */ }
  }
}

try {
  TaskManager.defineTask(TASK, async () => {
    try {
      await runAll();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
} catch { /* not available (web, or an Expo Go without it) */ }

export async function registerBackgroundWork() {
  if (Platform.OS === "web") return false;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
    }
    return true;
  } catch {
    return false;
  }
}
