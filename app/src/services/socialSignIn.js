// Google and Apple sign-in on the phone. All this does is ask them who you are and hand back their ID token;
// the VoidPop server checks that token (server/src/oidc.js). If a library here is ever swapped for another,
// only this file changes.
//
//   Google  needs a development build or an APK (it can't run in Expo Go) and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
//           the WEB OAuth client id from Google Cloud Console (see server/README.md → Sign in with Google / Apple).
//   Apple   exists on iOS only; on Android the button is simply not shown.
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
export const googleConfigured = () => !!GOOGLE_WEB_CLIENT_ID;

let googleReady = false;
// → the ID token, or null when the person closed the Google sheet
export async function signInWithGoogle() {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Google sign-in isn't set up in this build.");
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
  return AppleAuthentication.isAvailableAsync();
}

// → { identityToken, name }, or null when the person closed the Apple sheet.
// Apple gives the name only the very first time, so it is sent along now (the server uses it for a username).
export async function signInWithApple() {
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!c.identityToken) throw new Error("Apple didn't send a sign-in token.");
    const name = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(" ") || null;
    return { identityToken: c.identityToken, name };
  } catch (e) {
    if (e?.code === "ERR_REQUEST_CANCELED") return null;
    throw e;
  }
}
