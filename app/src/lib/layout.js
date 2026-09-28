// Layout constants/hooks so one codebase looks right on phones AND desktop browsers.
import { useWindowDimensions } from "react-native";

export const MAX_CONTENT_WIDTH = 1200;

// Poster-grid columns: 2 on phones, up to 6 on a wide desktop window.
export function useGridColumns(minCardWidth = 190) {
  const { width } = useWindowDimensions();
  const usable = Math.min(width, MAX_CONTENT_WIDTH);
  return Math.max(2, Math.min(6, Math.floor(usable / minCardWidth)));
}

// "Desktop website" mode: a browser window wide enough for the top nav,
// multi-column pages and side-by-side panels. Phones and native stay mobile.
import { Platform } from "react-native";
export const WIDE_BREAKPOINT = 900;
export function useIsWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= WIDE_BREAKPOINT;
}
