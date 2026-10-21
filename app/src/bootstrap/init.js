/**
 * VoidPop startup initialization.
 *
 * Connects React Native storage and network status to the shared logic,
 * then configures optional AniList authentication.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Linking from "expo-linking";

import { setStorage } from "@voidpop/shared/backend/storage";
import { setDeviceOnline } from "@voidpop/shared/api/anilist";
import { configureAniListSync } from "@voidpop/shared/sync/anilist";

// Use AsyncStorage for persistent, device-local library data.
setStorage({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
});

// Track whether the device has an available internet connection.
// A failed AniList request alone does not mean the device is offline.
NetInfo.addEventListener((networkState) => {
  const isOnline =
    networkState.isConnected !== false &&
    networkState.isInternetReachable !== false;

  setDeviceOnline(isOnline);
});

// Configure optional AniList synchronization.
// Set EXPO_PUBLIC_ANILIST_CLIENT_ID to enable authentication.
// The redirect URI may differ between a standalone build and Expo Go.
configureAniListSync({
  clientId: process.env.EXPO_PUBLIC_ANILIST_CLIENT_ID,
  redirectUri: Linking.createURL("auth"),
});
