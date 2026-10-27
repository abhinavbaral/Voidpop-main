// Every way into an account, in one place: email + password (sign in or create account), Sign in with Apple (iOS),
// Sign in with Google, and "Continue as guest". Used by the sign-in screen and by More → Account.
// The look follows the VoidPop theme (colours come from the theme, so Void, Ember, Sakura... all apply).
// A social button only appears when the server has that sign-in set up AND this phone can do it.
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { ApiError, register, login, loginWithGoogle, loginWithApple, fetchProviders } from "@voidpop/shared/api/community";
import { useTheme } from "../../context/ThemeContext.js";
import { googleConfigured, signInWithGoogle, appleAvailable, signInWithApple } from "../../services/socialSignIn.js";

const humanError = (e, label) => (e instanceof ApiError ? e.message : `Couldn't sign in with ${label}. Try again.`);

// connect: you are already signed in and are adding Google/Apple to this account. skip: providers already connected.
// divider: an "or" line above the buttons (only drawn when there is a button to show).
export function SocialButtons({ connect = false, skip = [], heading, divider = false, onDone, onError }) {
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
      {divider && (
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: C.border }]} />
          <Text style={{ color: C.faint, fontSize: 12 }}>or</Text>
          <View style={[styles.line, { backgroundColor: C.border }]} />
        </View>
      )}
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
          style={[styles.social, { borderColor: C.border }, busy && { opacity: 0.5 }]}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{connect ? "Connect Google" : "Sign in with Google"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// a bordered input; the border lights up in the accent colour while you type
function Field({ label, C, ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput placeholder={label} accessibilityLabel={label} placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ color: C.text, borderColor: focus ? C.purple : C.border, borderWidth: 2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 }} {...rest} />
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
  const login_ = mode === "login";

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const user = login_
        ? await login({ identifier: f.identifier.trim(), password: f.password })
        : await register({ email: f.email.trim(), username: f.username.trim(), password: f.password });
      setF((x) => ({ ...x, password: "" }));
      onDone?.(user);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <View style={{ gap: 12, alignSelf: "stretch" }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }} accessibilityRole="header">{login_ ? "Sign in" : "Create account"}</Text>

      {login_ ? (
        <Field C={C} label="Email or username" value={f.identifier} onChangeText={set("identifier")} textContentType="username" />
      ) : (
        <>
          <Field C={C} label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" textContentType="emailAddress" />
          <Field C={C} label="Username (letters, numbers, _)" value={f.username} onChangeText={set("username")} maxLength={24} />
        </>
      )}
      <Field C={C} label="Password" value={f.password} onChangeText={set("password")} secureTextEntry textContentType={login_ ? "password" : "newPassword"} />
      {!login_ && <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19 }}>At least 8 characters. Your email is only used to sign in; it is never shown to others.</Text>}
      {!!err && <Text style={{ color: C.rose, fontSize: 13 }} accessibilityRole="alert">{err}</Text>}

      {/* a glass button: a see-through wash of the accent colour with an accent border */}
      <TouchableOpacity onPress={submit} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }}
        style={[styles.primary, { backgroundColor: `${C.purple}2e`, borderColor: C.purple }, busy && { opacity: 0.7 }]}>
        {busy ? <ActivityIndicator color={C.purple} /> : <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{login_ ? "Sign in" : "Create account"}</Text>}
      </TouchableOpacity>

      <Text style={{ textAlign: "center", color: C.sub, fontSize: 13 }}>
        {login_ ? "New to VoidPop?" : "Already have an account?"}
        <Text onPress={() => { setMode(login_ ? "register" : "login"); setErr(""); }} accessibilityRole="link"
          style={{ color: C.purple, fontWeight: "700" }}>{login_ ? "  Create account" : "  Sign in"}</Text>
      </Text>

      <SocialButtons divider onDone={onDone} onError={setErr} />

      {onGuest && (
        <TouchableOpacity onPress={onGuest} accessibilityRole="button" style={[styles.guest, { borderColor: C.border }]}>
          <Text style={{ color: C.sub, fontWeight: "700" }}>Continue as guest</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  social: { height: 46, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  primary: { borderWidth: 2, borderRadius: 10, minHeight: 46, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  guest: { borderWidth: 2, borderRadius: 10, minHeight: 44, alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1 },
});
