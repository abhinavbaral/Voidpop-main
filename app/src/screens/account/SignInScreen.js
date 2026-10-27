// SIGN IN — shown once, after the welcome screen, on a build that has a VoidPop server.
// Sign in (Google, Apple, email) or "Continue as guest": a guest uses the whole app on this phone, exactly as before;
// the account only adds comments, shared Void Verdicts and a cloud backup, and can be made later from More → Account.
import { useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { chooseGuest, combineWithAccount, localTitleCount } from "@voidpop/shared/api/community";
import { isOnboarded } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";
import { useLogo } from "../../components/brand/Brand";
import AuthForm from "../../components/account/AuthForm.js";

export default function SignInScreen({ navigation }) {
  const { C } = useTheme();
  const logo = useLogo();
  const [bring, setBring] = useState(null); // { count } once signed in with titles already on this phone
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // then on to what the welcome screen would have opened: the app, or Onboarding on a first run
  const go = async () => {
    const done = await isOnboarded().catch(() => true);
    navigation.replace(done ? "Main" : "Onboarding");
  };
  const guest = async () => { await chooseGuest(); go(); };

  // someone who used the app as a guest and now signs in: their library is still here, so offer to bring it along
  const signedIn = async () => {
    const count = await localTitleCount().catch(() => 0);
    if (count > 0) setBring({ count }); else go();
  };
  const bringLibrary = async () => {
    setBusy(true); setErr("");
    try { await combineWithAccount(); go(); }
    catch (e) { setErr(e.status === 409 ? "Your account was saved from another phone a moment ago. Try again." : e.message); setBusy(false); }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="VoidPop" />
        {bring ? (
          <>
            <Text style={[s.h1, { color: C.text }]} accessibilityRole="header">Bring your library?</Text>
            <Text style={[s.sub, { color: C.sub }]}>
              You have {bring.count} {bring.count === 1 ? "title" : "titles"} on this phone. Add them to your account so they are backed up and your verdicts count in the community.
              If your account already has a library, the two are combined. Nothing is deleted from either.
            </Text>
            {!!err && <Text style={{ color: C.rose, textAlign: "center" }} accessibilityRole="alert">{err}</Text>}
            <TouchableOpacity onPress={bringLibrary} disabled={busy} accessibilityRole="button"
              style={[s.primary, { backgroundColor: C.purple, borderColor: C.purple }, busy && { opacity: 0.5 }]}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>{busy ? "Adding..." : "Add my library"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={go} disabled={busy} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 12 }}>
              <Text style={{ color: C.sub, fontWeight: "700" }}>Not now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[s.h1, { color: C.text }]} accessibilityRole="header">Sign in to VoidPop</Text>
            <Text style={[s.sub, { color: C.sub }]}>
              Comment, share your Void Verdicts and back up your library. It is optional: skip it and everything stays on this phone.
            </Text>
            <AuthForm onDone={signedIn} onGuest={guest} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 22, paddingBottom: 40, gap: 16 },
  logo: { width: 64, height: 64, alignSelf: "center", marginTop: 8 },
  h1: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  sub: { fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 6 },
  primary: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
});
