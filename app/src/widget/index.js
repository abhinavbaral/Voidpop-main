// Home-screen widget glue. The widget library needs native code that Expo Go
// doesn't have, so everything here is loaded only if that native part exists:
// in Expo Go these calls quietly do nothing; in the real APK they work.
import { Platform, TurboModuleRegistry } from "react-native";
import { getSettings } from "@voidpop/shared/backend/store";

export const WIDGET_NAME = "NextEpisodes";

function lib() {
  if (Platform.OS !== "android") return null;
  try {
    if (!TurboModuleRegistry.get("AndroidWidget")) return null;
    return require("react-native-android-widget");
  } catch {
    return null;
  }
}

async function render(quick = false) {
  const { loadWidgetRows } = require("./data");
  const { NextEpisodesWidget, WidgetMessage } = require("./NextEpisodesWidget");
  try {
    const [rows, settings] = await Promise.all([loadWidgetRows({ quick }), getSettings().catch(() => ({}))]);
    return <NextEpisodesWidget rows={rows} clock24={!!settings.clock24} />;
  } catch {
    return <WidgetMessage text="Couldn't load your shows. Tap to open VoidPop." />;
  }
}

// Called by Android: widget added, resized, or its 30-minute refresh.
// Draws at once from saved data (a widget that hasn't been drawn yet shows as
// an empty see-through box), then again with fresh air times from AniList.
async function taskHandler({ widgetAction, renderWidget }) {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
  renderWidget(await render(true));
  renderWidget(await render(false));
}

export function registerWidget() {
  const w = lib();
  if (w) w.registerWidgetTaskHandler(taskHandler);
}

// Called by the app when your library changes or the app comes back to the front.
export async function updateWidget() {
  const w = lib();
  if (!w) return;
  try {
    await w.requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => render(false) });
  } catch { /* no widget on the home screen, or it failed to draw: try again next time */ }
}
