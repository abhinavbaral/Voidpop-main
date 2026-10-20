// ACCOUNT — sign in or create an account (comments, community verdicts, cloud backup).
// Your library stays on this phone; the account only adds the social parts and an optional backup.
import { useState } from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { register, login, logout, deleteAccount, pushBackup, pullBackup } from "@voidpop/shared/api/community";
import { useAccount } from "@voidpop/shared/backend/useCommunity";
import { useTheme } from "../../context/ThemeContext.js";
import { goBackOrHome } from "../../utils/nav";
import Icon from "../../components/ui/Icon.js";

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
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ identifier: "", email: "", username: "", password: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "restore" | "delete": the second tap does it
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      if (mode === "login") await login({ identifier: f.identifier.trim(), password: f.password });
      else await register({ email: f.email.trim(), username: f.username.trim(), password: f.password });
      setF((x) => ({ ...x, password: "" }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const run = async (fn, ok) => {
    setBusy(true); setMsg(""); setConfirm(null);
    try { const r = await fn(); setMsg(typeof ok === "function" ? ok(r) : ok); }
    catch (e) { setMsg(e.status === 409 ? "Another device saved a newer backup. Restore it first, or you'd overwrite it." : e.message); }
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
              <Text style={styles.sub}>{user.email}</Text>
              <Btn label="Sign out" onPress={logout} />
            </View>
            <View style={styles.card}>
              <Text style={styles.h2}>Cloud backup</Text>
              <Text style={styles.sub}>Your library stays on this phone. Back it up to your account to move to another phone or browser, then restore it there. Restoring replaces what is on the device you restore to.</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn primary label="Back up now" onPress={() => run(pushBackup, "Backed up to your account.")} />
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
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[["login", "Sign in"], ["register", "Create account"]].map(([k, l]) => (
                <TouchableOpacity key={k} onPress={() => { setMode(k); setErr(""); }} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}
                  style={[styles.tab, mode === k && { borderColor: C.purple, backgroundColor: C.inputBg }]}>
                  <Text style={{ color: mode === k ? C.purple : C.sub, fontWeight: "800" }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mode === "login" ? (
              <Field C={C} label="Email or username" value={f.identifier} onChangeText={set("identifier")} textContentType="username" />
            ) : (
              <>
                <Field C={C} label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" textContentType="emailAddress" />
                <Field C={C} label="Username (letters, numbers, _)" value={f.username} onChangeText={set("username")} maxLength={24} />
              </>
            )}
            <Field C={C} label="Password" value={f.password} onChangeText={set("password")} secureTextEntry textContentType={mode === "login" ? "password" : "newPassword"} />
            {mode === "register" && <Text style={styles.sub}>At least 8 characters. Your email is only used to sign in; it is never shown to others.</Text>}
            {!!err && <Text style={{ color: C.rose }} accessibilityRole="alert">{err}</Text>}
            <Btn primary label={mode === "login" ? "Sign in" : "Create account"} onPress={submit} />
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
