// Website startup wiring (imported first in main.jsx): Voidation keeps your
// library in this browser's localStorage. No accounts, no keys.
import { setStorage } from "@voidation/shared/backend/storage";
import { setDeviceOnline } from "@voidation/shared/api/anilist";

setStorage({
  getItem: (key) => {
    try { return window.localStorage.getItem(key); } catch { return null; } // private mode / blocked storage
  },
  setItem: (key, value) => {
    try { window.localStorage.setItem(key, value); } catch { /* storage full or blocked: keep working in memory */ }
  },
  removeItem: (key) => {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  },
});

// "Offline" = the browser says there's no network (not an AniList hiccup).
setDeviceOnline(navigator.onLine !== false);
window.addEventListener("online", () => setDeviceOnline(true));
window.addEventListener("offline", () => setDeviceOnline(false));

// AniList sync (optional): needs a free AniList app's client id in
// VITE_ANILIST_CLIENT_ID; its redirect URL must be <this site>/auth/anilist.
import { configureAniListSync, syncNow } from "@voidation/shared/sync/anilist";
configureAniListSync({
  clientId: import.meta.env.VITE_ANILIST_CLIENT_ID,
  redirectUri: `${window.location.origin}/auth/anilist`,
});
syncNow({ reason: "open" });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncNow({ reason: "focus" });
});
window.addEventListener("online", () => syncNow({ reason: "online" }));
