// App startup wiring (imported first in App.js): VoidPop keeps your library
// on this phone with AsyncStorage. No accounts, no keys.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setStorage } from "@voidpop/shared/backend/storage";
import NetInfo from "@react-native-community/netinfo";
import { setDeviceOnline } from "@voidpop/shared/api/anilist";

setStorage({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
});

// "Offline" = Android says there's no connection, or it's connected (e.g. to
// Wi-Fi) but can't reach the internet. An AniList hiccup is not "offline".
NetInfo.addEventListener((net) => {
  setDeviceOnline(!(net.isConnected === false || net.isInternetReachable === false));
});

// AniList sync (optional): a free AniList app's client id in
// EXPO_PUBLIC_ANILIST_CLIENT_ID; its redirect URL must be voidation://auth
// (in Expo Go the address is different; More → AniList shows the one to use).
import * as Linking from "expo-linking";
import { configureAniListSync } from "@voidpop/shared/sync/anilist";
configureAniListSync({
  clientId: process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID,
  redirectUri: Linking.createURL("auth"),
});
