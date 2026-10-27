// ACCOUNT — sign in or create an account (comments, community verdicts, cloud backup).
// Your library stays on this phone; the account only adds the social parts and an optional backup.
import { useState } from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logout, deleteAccount, pushBackup, pullBackup, combineWithAccount, updateUsername } from "@voidpop/shared/api/community";
import { useAccount } from "@voidpop/shared/backend/useCommunity";
import { useTheme } from "../../context/ThemeContext.js";
import { goBackOrHome } from "../../utils/nav";
import Icon from "../../components/ui/Icon.js";
import AuthForm, { SocialButtons } from "../../components/account/AuthForm.js";

function Field({ label, C, ...rest }) {
  return (
    <View style={{ gap: 6, alignSelf: "stretch" }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false} accessibilityLabel={label}
        style={{ color: C.text, backgroundColor: C.inputBg, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 12 }} {...rest} />
    </View>
  );
}

export default function AccountScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { user, ready, enabled } = useAccount();
  const [msg, setMsg] = useState("");
  const [name, setName] = useState(null);       // the username being typed (null = not changed)
  const [accountErr, setAccountErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "restore" | "delete": the second tap does it
  // people who came in with Google or Apple start with a made-up username: this is where they pick their own
  const saveName = async () => {
    setBusy(true); setAccountErr("");
    try { await updateUsername(name.trim()); setName(null); } catch (e) { setAccountErr(e.message); }
    setBusy(false);
  };
  const run = async (fn, ok) => {
    setBusy(true); setMsg(""); setConfirm(null);
    try { const r = await fn(); setMsg(typeof ok === "function" ? ok(r) : ok); }
    catch (e) { setMsg(e.status === 409 ? "Another device saved a newer backup. Tap Combine to keep both, or Restore to use the account's version (it replaces this phone's)." : e.message); }
    setBusy(false);
  };

  const Btn = ({ label, onPress, primary, danger, disabled }) => (
    <TouchableOpacity onPress={onPress} disabled={disabled || busy} accessibilityRole="button"
      style={[styles.btn, primary && { backgroundColor: C.purple, borderColor: C.purple }, danger && { borderColor: C.rose }, (disabled || busy) && { opacity: 0.5 }]}>
      <Text style={[styles.btnText, primary && { color: "#fff" }, danger && { color: C.rose }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} accessibilityRole="button" accessibilityLabel="Back" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="back" size={18} color={C.purple} /><Text style={{ color: C.purple, fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.h1}>Account</Text>

        {!enabled ? (
          <View style={styles.card}>
            <Text style={styles.sub}>Accounts need a VoidPop server. Set EXPO_PUBLIC_VOIDPOP_API to its address (see server/README.md). Everything else works without one.</Text>
          </View>
        ) : !ready ? null : user ? (
          <>
            <View style={styles.card}>
              <Text style={styles.h2}>{user.username}</Text>
              {!!user.email && <Text style={styles.sub}>{user.email}</Text>}
              <Field C={C} label="Change username" value={name ?? user.username} onChangeText={setName} maxLength={24} />
              <Btn label="Save username" disabled={name === null || name.trim() === user.username} onPress={saveName} />
              <SocialButtons connect skip={user.providers || []} heading="Connect another way to sign in" onDone={() => setAccountErr("")} onError={setAccountErr} />
              {!!accountErr && <Text style={{ color: C.rose }} accessibilityRole="alert">{accountErr}</Text>}
              <Btn label="Sign out" onPress={logout} />
            </View>
            <View style={styles.card}>
              <Text style={styles.h2}>Cloud backup</Text>
              <Text style={styles.sub}>Your library stays on this phone. Back it up to your account to move to another phone or browser, then restore it there. Restoring replaces what is on the device you restore to. Combine keeps everything from both the phone and the account, and shares the verdicts you already gave.</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn primary label="Back up now" onPress={() => run(pushBackup, "Backed up to your account.")} />
                <Btn label="Combine with this phone" onPress={() => run(combineWithAccount, (r) => `Combined: ${r.fromAccount} titles added from your account, ${r.verdicts} verdicts shared.`)} />
                <Btn label={confirm === "restore" ? "Tap again to replace this library" : "Restore from account"}
                  onPress={() => (confirm === "restore" ? run(pullBackup, (ok) => (ok ? "Restored. Restart the app to see everything." : "There's no backup in your account yet.")) : setConfirm("restore"))} />
              </View>
              {!!msg && <Text style={[styles.sub, { color: C.text }]} accessibilityRole="alert">{msg}</Text>}
            </View>
            <View style={styles.card}>
              <Text style={styles.h2}>Delete account</Text>
              <Text style={styles.sub}>Removes your account, your shared verdicts, your comments and your cloud backup from the server. The library on this phone is not touched.</Text>
              <Btn danger label={confirm === "delete" ? "Tap again to delete for good" : "Delete my account"}
                onPress={() => (confirm === "delete" ? run(deleteAccount, "Account deleted.") : setConfirm("delete"))} />
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <AuthForm />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  h1: { color: C.text, fontSize: 28, fontWeight: "800" },
  h2: { color: C.text, fontSize: 18, fontWeight: "800" },
  sub: { color: C.sub, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12, alignItems: "flex-start" },
  tab: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btn: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  btnText: { color: C.text, fontWeight: "800" },
});
