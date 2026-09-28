// Episode notifications: "Episode 7 of Solo Leveling is out".
//
// Scheduled on the phone itself, so there is no server and no push service.
// AniList only knows each show's NEXT episode, so the alerts are rebuilt every
// time the app opens, comes back to the foreground, or your library changes;
// opening Voidation at least once a week keeps every alert in place.
//
// Followed = Watching, Plan to Watch, On Hold, or Excited (same as History).

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { getLibrary, getExcited, getSettings } from "@voidation/shared/backend/store";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);
const CHANNEL = "episodes";
const TAG = "voidation-episode"; // marks our scheduled alerts so we only cancel our own

// show alerts even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "New episodes",
    description: "When an episode of an anime you follow airs",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// Asks once (Android 13+ shows the system prompt). Returns true if allowed.
export async function ensurePermission() {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function hasPermission() {
  return (await Notifications.getPermissionsAsync()).granted;
}

async function cancelOurs() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content?.data?.tag === TAG)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

let running = null;
// Rebuild every alert from the current library. Safe to call often: calls that
// overlap share one run.
export function rescheduleEpisodeAlerts() {
  running = running || (async () => {
    try {
      await cancelOurs();
      const settings = await getSettings();
      if (!settings.notifyEpisodes || !(await hasPermission())) return 0;
      await ensureChannel();

      const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
      const ids = new Set();
      Object.values(lib).forEach((e) => { if (e.item.segment === "anime" && FOLLOWING.has(e.status)) ids.add(e.item.id); });
      Object.values(excited).forEach((e) => { if (e.item.segment === "anime") ids.add(e.item.id); });
      if (!ids.size) return 0;

      const fresh = await fetchNextEpisodes([...ids]);
      const nowSec = Date.now() / 1000;
      let count = 0;
      for (const item of Object.values(fresh)) {
        const next = item.nextEpisode;
        if (!next || next.airingAt <= nowSec + 30) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Episode ${next.episode} is out`,
            body: next.episode === 1 ? `${item.title} has premiered.` : `${item.title}: episode ${next.episode} just aired.`,
            data: { tag: TAG, segment: "anime", id: item.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(next.airingAt * 1000),
            channelId: CHANNEL,
          },
        });
        count++;
      }
      return count;
    } catch {
      return 0; // offline: keep whatever was cancelled cancelled; next open retries
    } finally {
      running = null;
    }
  })();
  return running;
}

// Tapping an alert opens that anime. `open` receives { segment, id }.
export function onAlertTapped(open) {
  const handle = (response) => {
    const d = response?.notification?.request?.content?.data;
    if (d?.tag === TAG && d.id) open({ segment: d.segment, id: String(d.id) });
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {}); // app launched from an alert
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
