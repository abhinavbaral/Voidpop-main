// Google and Apple sign-in on the phone. All this does is ask them who you are and hand back their ID token;
// the VoidPop server checks that token (server/src/oidc.js). If a library here is ever swapped for another,
// only this file changes.
//
//   Google  needs a build that includes the library (an APK, not an over-the-air update to an older APK, and not
//           Expo Go) and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, the WEB OAuth client id from Google Cloud Console
//           (see server/README.md → Sign in with Google / Apple).
//   Apple   exists on iOS only.
//
// The two native libraries are loaded here, lazily and inside try/catch, never with a top-level import: an
// `eas update` can reach an APK that was built before they were added, and a top-level import of a native module
// that APK doesn't have would crash the whole app on launch. This way the buttons just explain instead.
import { Platform } from "react-native";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let appleLib, googleLib; // undefined = not tried yet, null = this build doesn't have it
export function appleModule() {
  if (appleLib === undefined) { try { appleLib = require("expo-apple-authentication"); } catch { appleLib = null; } }
  return appleLib;
}
export function googleModule() {
  if (googleLib === undefined) { try { googleLib = require("@react-native-google-signin/google-signin"); } catch { googleLib = null; } }
  return googleLib;
}

export const googleConfigured = () => !!GOOGLE_WEB_CLIENT_ID;
export const googleSupported = () => !!googleModule();

let googleReady = false;
// → the ID token, or null when the person closed the Google sheet
export async function signInWithGoogle() {
  const lib = googleModule();
  if (!lib) throw new Error("Google login needs the latest version of the app.");
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Google login isn't set up in this version yet.");
  const { GoogleSignin, statusCodes } = lib;
  if (!googleReady) { GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID }); googleReady = true; }
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices();
    const r = await GoogleSignin.signIn();
    if (r?.type === "cancelled") return null;      // newer versions of the library say so this way...
    const idToken = r?.data?.idToken ?? r?.idToken; // ...and return { data: { idToken } } (older: idToken directly)
    if (!idToken) throw new Error("Google didn't send a sign-in token.");
    return idToken;
  } catch (e) {
    if (e?.code === statusCodes?.SIGN_IN_CANCELLED || e?.code === "SIGN_IN_CANCELLED") return null; // ...and older ones throw
    throw e;
  }
}

export async function appleAvailable() {
  if (Platform.OS !== "ios") return false;
  const lib = appleModule();
  if (!lib) return false;
  try { return await lib.isAvailableAsync(); } catch { return false; }
}

// → { identityToken, name }, or null when the person closed the Apple sheet.
// Apple gives the name only the very first time, so it is sent along now (the server uses it for a username).
export async function signInWithApple() {
  const lib = appleModule();
  if (!lib) throw new Error("Apple login needs the latest version of the app.");
  try {
    const c = await lib.signInAsync({ requestedScopes: [lib.AppleAuthenticationScope.FULL_NAME, lib.AppleAuthenticationScope.EMAIL] });
    if (!c.identityToken) throw new Error("Apple didn't send a sign-in token.");
    const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(" ") || null;
    return { identityToken: c.identityToken, name };
  } catch (e) {
    if (e?.code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}
