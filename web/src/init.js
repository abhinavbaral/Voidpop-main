// Website startup wiring (imported first in main.jsx): Voidation keeps your
// library in this browser's localStorage. No accounts, no keys.
import { setStorage } from "@voidation/shared/backend/storage";

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
