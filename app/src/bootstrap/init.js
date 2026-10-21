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

// Movies & TV (optional): a free TMDB API key in EXPO_PUBLIC_TMDB_API_KEY switches Explore → Movies & TV
// from the built-in titles to live data (EXPO_PUBLIC_TMDB_REGION, e.g. "NP", picks the
// country for "where to watch"). A key inside an app can be extracted, so for a public release put a
// proxy in front of TMDB (see shared/api/tmdb.js).
import { configureTmdb } from "@voidpop/shared/api/tmdb";
configureTmdb({ apiKey: process.env.EXPO_PUBLIC_TMDB_API_KEY, region: process.env.EXPO_PUBLIC_TMDB_REGION });

// Accounts, community verdicts and comments (optional): the address of your VoidPop server
// (see server/README.md), e.g. EXPO_PUBLIC_VOIDPOP_API=https://api.example.com. Without it none of that shows.
import { configureCommunity, loadAccount } from "@voidpop/shared/api/community";
configureCommunity({ baseUrl: process.env.EXPO_PUBLIC_VOIDPOP_API });
loadAccount();
