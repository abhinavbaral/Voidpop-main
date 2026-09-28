// App startup wiring (imported first in App.js): Voidation keeps your library
// on this phone with AsyncStorage. No accounts, no keys.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setStorage } from "@voidation/shared/backend/storage";

setStorage({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
});
