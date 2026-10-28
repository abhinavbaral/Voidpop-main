// Home-screen widget glue. The widget library needs native code that Expo Go
// doesn't have, so everything here is loaded only if that native part exists:
// in Expo Go these calls quietly do nothing; in the real APK they work.
//
// Two widgets:
//   NextEpisodes  "Pending view", 4x4: every ongoing show with its pending count and next episode
//   PendingPager  4x2: the shows with pending episodes, one at a time, with arrows to go to the next one
// (The first keeps its original name so a widget already on the home screen keeps working.)
import { Platform, TurboModuleRegistry } from "react-native";
import { getSettings } from "@voidpop/shared/backend/store";
import { readKey, writeKey } from "@voidpop/shared/backend/storage";

export const WIDGET_NAME = "NextEpisodes";
export const PAGER_NAME = "PendingPager";
export const WIDGET_NAMES = [WIDGET_NAME, PAGER_NAME];
const PAGER_KEY = "voidpop:widget:pager"; // which show the 4x2 is on (kept between redraws)

function lib() {
  if (Platform.OS !== "android") return null;
  try {
    if (!TurboModuleRegistry.get("AndroidWidget")) return null;
    return require("react-native-android-widget");
  } catch {
    return null;
  }
}

// delta: -1 / +1 when an arrow was tapped, 0 for a normal redraw
async function render(name, quick = false, delta = 0) {
  try {
    if (name === PAGER_NAME) {
      const { loadPendingPager } = require("./data");
      const { PendingPagerWidget } = require("./PendingPagerWidget");
      const data = await loadPendingPager({ quick });
      const n = data.rows.length;
      let index = Number(await readKey(PAGER_KEY).catch(() => 0)) || 0;
      index = n ? (((index + delta) % n) + n) % n : 0; // wraps round
      if (delta) await writeKey(PAGER_KEY, String(index)).catch(() => {});
      return <PendingPagerWidget rows={data.rows} index={index} total={data.total} />;
    }
    const { loadPendingView } = require("./data");
    const { PendingViewWidget } = require("./PendingViewWidget");
    const [view, settings] = await Promise.all([loadPendingView({ quick }), getSettings().catch(() => ({}))]);
    return <PendingViewWidget {...view} clock24={!!settings.clock24} />;
  } catch {
    const { WidgetMessage } = require("./PendingViewWidget");
    return <WidgetMessage text="Couldn't load your shows. Tap to open VoidPop." />;
  }
}

// Called by Android: a widget added, resized, tapped, or its 30-minute refresh. widgetInfo says which widget it is.
// Draws at once from saved data (a widget that hasn't been drawn yet shows as
// an empty see-through box), then again with fresh air times from AniList.
async function taskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }) {
  if (widgetAction === "WIDGET_DELETED") return;
  const name = WIDGET_NAMES.includes(widgetInfo?.widgetName) ? widgetInfo.widgetName : WIDGET_NAME;
  if (widgetAction === "WIDGET_CLICK") {
    // only the pager's arrows redraw the widget; taps that open a title or the app are handled by Android
    if (name !== PAGER_NAME || (clickAction !== "PAGER_PREV" && clickAction !== "PAGER_NEXT")) return;
    renderWidget(await render(name, true, clickAction === "PAGER_NEXT" ? 1 : -1));
    return;
  }
  renderWidget(await render(name, true));
  renderWidget(await render(name, false));
}

export function registerWidget() {
  const w = lib();
  if (w) w.registerWidgetTaskHandler(taskHandler);
}

// Called by the app when your library changes or the app comes back to the front: redraws every widget on the home screen.
export async function updateWidget() {
  const w = lib();
  if (!w) return;
  for (const name of WIDGET_NAMES) {
    try {
      await w.requestWidgetUpdate({ widgetName: name, renderWidget: () => render(name, false) });
    } catch { /* this widget isn't on the home screen, or it failed to draw: try again next time */ }
  }
}
