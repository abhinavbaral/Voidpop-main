// LOGIN — opened by the welcome screen's Login button (shown to anyone who isn't signed in and hasn't chosen Guest mode).
// Login (email, Google, Apple) or Guest mode: a guest uses the whole app on this phone, exactly as before;
// the account only adds comments, shared Void Verdicts and a cloud backup, and can be made later from More → Account.
// Laid out as one centred card: the logo in a ring, the name, then the form. All colours come from the theme.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { chooseGuest, combineWithAccount, localTitleCount, hasCommunity, currentUser } from "@voidpop/shared/api/community";
import { needsBackupFirst } from "@voidpop/shared/lib/backupNames";
import { getBackupConfig } from "../../services/backup";
import { isOnboarded } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";
import { useLogo } from "../../components/brand/Brand";
import AuthForm from "../../components/account/AuthForm.js";

export default function SignInScreen({ navigation, route }) {
  const { C } = useTheme();
  const inApp = !!route?.params?.inApp; // opened from inside the app (the "Want to sign in?" popup): go back there when done
  const logo = useLogo();
  const [bring, setBring] = useState(null); // { count } once signed in with titles already on this phone
  // Before a guest signs in, their library is backed up (signing in combines it with the account). null = checking,
  // { titles } = back up first, false = go ahead. They are taken to the backup page once; if they come back without
  // having made one, this screen shows a card with a button to go there again.
  const [gate, setGate] = useState(null);
  const sent = useRef(false);
  const backedUp = !!route?.params?.backedUp;
  useEffect(() => {
    let live = true;
    (async () => {
      if (backedUp) { setGate(false); return; }
      const [titles, cfg] = await Promise.all([localTitleCount().catch(() => 0), getBackupConfig().catch(() => ({}))]);
      if (!live) return;
      if (!needsBackupFirst({ signedIn: !!currentUser(), titles, lastBackup: cfg.last })) { setGate(false); return; }
      setGate({ titles });
      if (!sent.current) { sent.current = true; navigation.navigate("MorePage", { page: "data", forSignIn: true }); }
    })();
    return () => { live = false; };
  }, [backedUp, navigation]);
  const openBackup = () => navigation.navigate("MorePage", { page: "data", forSignIn: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // then on to what the welcome screen would have opened: the app, or Onboarding on a first run
  const go = async () => {
    if (inApp && navigation.canGoBack()) { navigation.goBack(); return; }
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
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border, shadowColor: C.purple }]}>
          <View style={s.head}>
            <View style={[s.ring, { borderColor: C.purple }]}>
              <Image source={logo} style={s.logo} resizeMode="contain" accessibilityLabel="VoidPop" />
            </View>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: "600" }} accessibilityRole="header">VoidPop</Text>
            <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
              {bring ? "Your library is on this phone." : "Comment, share your Void Verdicts and back up your library. Optional."}
            </Text>
          </View>

          {gate === null && !bring ? (
            <ActivityIndicator color={C.purple} />
          ) : gate && !bring ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }} accessibilityRole="header">Back up first</Text>
              <Text style={{ color: C.sub, fontSize: 14, lineHeight: 21 }}>
                You have {gate.titles} {gate.titles === 1 ? "title" : "titles"} on this phone. Signing in combines them with your account, so keep a safe copy first. It takes a few seconds.
              </Text>
              <TouchableOpacity onPress={openBackup} accessibilityRole="button" style={[s.primary, { backgroundColor: `${C.purple}2e`, borderColor: C.purple }]}>
                <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>Create a backup</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={guest} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 10 }}>
                <Text style={{ color: C.sub, fontWeight: "700" }}>Not now</Text>
              </TouchableOpacity>
            </View>
          ) : bring ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }} accessibilityRole="header">Bring your library?</Text>
              <Text style={{ color: C.sub, fontSize: 14, lineHeight: 21 }}>
                You have {bring.count} {bring.count === 1 ? "title" : "titles"} on this phone. Add them to your account so they are backed up and your verdicts count in the community.
                If your account already has a library, the two are combined. Nothing is deleted from either.
              </Text>
              {!!err && <Text style={{ color: C.rose, fontSize: 13 }} accessibilityRole="alert">{err}</Text>}
              <TouchableOpacity onPress={bringLibrary} disabled={busy} accessibilityRole="button"
                style={[s.primary, { backgroundColor: `${C.purple}2e`, borderColor: C.purple }, busy && { opacity: 0.7 }]}>
                <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{busy ? "Adding..." : "Add my library"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={go} disabled={busy} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 10 }}>
                <Text style={{ color: C.sub, fontWeight: "700" }}>Not now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {backedUp && (
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 19, textAlign: "center", borderWidth: 1, borderColor: C.purple, borderRadius: 10, padding: 10 }}>
                  Backup saved. Now you can sign in.
                </Text>
              )}
              {!hasCommunity() && (
                <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19, textAlign: "center", borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 }}>
                  Accounts need the VoidPop server, which this version of the app isn't connected to yet. Guest mode works fully.
                </Text>
              )}
              <AuthForm onDone={signedIn} onGuest={guest} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { flexGrow: 1, justifyContent: "center", padding: 18 },
  card: { borderWidth: 2, borderRadius: 18, padding: 20, gap: 22, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  head: { alignItems: "center", gap: 10 },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  logo: { width: 52, height: 52 },
  primary: { borderWidth: 2, borderRadius: 10, minHeight: 46, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
});
