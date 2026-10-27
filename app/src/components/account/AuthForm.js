// Every way into an account, in one place: Sign in with Apple (iOS), Continue with Google, or email + password.
// Used by the sign-in screen (with a "Continue as guest" button) and by More → Account.
// A button only appears when the server has that sign-in set up AND this phone can do it.
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { ApiError, register, login, loginWithGoogle, loginWithApple, fetchProviders } from "@voidpop/shared/api/community";
import { useTheme } from "../../context/ThemeContext.js";
import { googleConfigured, signInWithGoogle, appleAvailable, signInWithApple } from "../../services/socialSignIn.js";

const humanError = (e, label) => (e instanceof ApiError ? e.message : `Couldn't sign in with ${label}. Try again.`);

// connect: you are already signed in and are adding Google/Apple to this account. skip: providers already connected.
export function SocialButtons({ connect = false, skip = [], heading, onDone, onError }) {
  const { C, dark } = useTheme();
  const [providers, setProviders] = useState({ google: false, apple: false });
  const [appleOk, setAppleOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchProviders().then((p) => live && setProviders(p));
    appleAvailable().then((ok) => live && setAppleOk(ok)).catch(() => {});
    return () => { live = false; };
  }, []);

  const showGoogle = providers.google && googleConfigured() && !skip.includes("google");
  const showApple = providers.apple && appleOk && !skip.includes("apple");
  if (!showGoogle && !showApple) return null;

  // get() asks Google/Apple (null = they closed it); send() gives the token to VoidPop
  const run = (label, get, send) => async () => {
    if (busy) return;
    setBusy(true); onError?.("");
    try {
      const got = await get();
      if (!got) return;
      const r = await send(got);
      onDone?.(r.user);
    } catch (e) { onError?.(humanError(e, label)); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 10, alignSelf: "stretch" }}>
      {!!heading && <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700" }}>{heading}</Text>}
      {showApple && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType[connect ? "CONTINUE" : "SIGN_IN"]}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle[dark ? "WHITE" : "BLACK"]}
          cornerRadius={10} style={{ height: 46, opacity: busy ? 0.5 : 1 }}
          onPress={run("Apple", signInWithApple, loginWithApple)} />
      )}
      {showGoogle && (
        <TouchableOpacity onPress={run("Google", signInWithGoogle, loginWithGoogle)} disabled={busy} accessibilityRole="button"
          style={[styles.social, { backgroundColor: C.card, borderColor: C.border }, busy && { opacity: 0.5 }]}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{connect ? "Connect Google" : "Continue with Google"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Field({ label, C, ...rest }) {
  return (
    <View style={{ gap: 6, alignSelf: "stretch" }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false} accessibilityLabel={label}
        style={{ color: C.text, backgroundColor: C.inputBg, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 12 }} {...rest} />
    </View>
  );
}

// onDone(user): signed in. onGuest: when given, a "Continue as guest" button is shown (the sign-in screen).
export default function AuthForm({ onDone, onGuest }) {
  const { C } = useTheme();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ identifier: "", email: "", username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const user = mode === "login"
        ? await login({ identifier: f.identifier.trim(), password: f.password })
        : await register({ email: f.email.trim(), username: f.username.trim(), password: f.password });
      setF((x) => ({ ...x, password: "" }));
      onDone?.(user);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <View style={{ gap: 12, alignSelf: "stretch" }}>
      <SocialButtons onDone={onDone} onError={setErr} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[["login", "Sign in"], ["register", "Create account"]].map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => { setMode(k); setErr(""); }} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}
            style={[styles.tab, { borderColor: mode === k ? C.purple : C.border }, mode === k && { backgroundColor: C.inputBg }]}>
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
      {mode === "register" && <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19 }}>At least 8 characters. Your email is only used to sign in; it is never shown to others.</Text>}
      {!!err && <Text style={{ color: C.rose }} accessibilityRole="alert">{err}</Text>}
      <TouchableOpacity onPress={submit} disabled={busy} accessibilityRole="button"
        style={[styles.primary, { backgroundColor: C.purple, borderColor: C.purple }, busy && { opacity: 0.5 }]}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>{mode === "login" ? "Sign in" : "Create account"}</Text>
      </TouchableOpacity>
      {onGuest && (
        <TouchableOpacity onPress={onGuest} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 12 }}>
          <Text style={{ color: C.sub, fontWeight: "700" }}>Continue as guest</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  social: { height: 46, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tab: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primary: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
});
