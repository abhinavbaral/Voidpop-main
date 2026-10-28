// Every way into an account, in one place: email + password (Login or Sign up), Log in with Google, Log in with Apple,
// and Guest mode. Used by the login screen and by More → Account. Colours come from the theme (Void, Ember, Sakura...).
//
// The Google and Apple buttons are always shown here. When one can't work yet (no server set up, not switched on, this build
// is older than the library, Apple on Android) it looks muted and tells you why when tapped, instead of silently doing nothing.
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { ApiError, register, login, loginWithGoogle, loginWithApple, fetchProviders, hasCommunity } from "@voidpop/shared/api/community";
import { useTheme } from "../../context/ThemeContext.js";
import { appleModule, googleConfigured, googleSupported, signInWithGoogle, appleAvailable, signInWithApple } from "../../services/socialSignIn.js";

const humanError = (e, label) => (e instanceof ApiError || e?.message ? e.message : `Couldn't log in with ${label}. Try again.`);

// connect: you are already signed in and are adding Google/Apple to this account (unavailable buttons are hidden, not explained).
// showAll: show both buttons even when one can't work yet. skip: providers already connected. divider: an "or" line above.
export function SocialButtons({ connect = false, showAll = false, skip = [], heading, divider = false, onDone, onError }) {
  const { C, dark } = useTheme();
  const [providers, setProviders] = useState(null); // null = still asking the server
  const [appleOk, setAppleOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchProviders().then((p) => live && setProviders(p));
    appleAvailable().then((ok) => live && setAppleOk(ok)).catch(() => {});
    return () => { live = false; };
  }, []);

  // why a button can't work right now; null = it can
  const whyNot = (kind) => {
    if (!hasCommunity()) return "Login needs the VoidPop server, which this version of the app isn't connected to yet. Guest mode works fully.";
    if (!providers) return "One moment, checking what is available. Try again.";
    if (!providers[kind]) return `${kind === "google" ? "Google" : "Apple"} login isn't switched on on the server yet.`;
    if (kind === "google") {
      if (!googleConfigured()) return "Google login isn't set up in this version yet.";
      if (!googleSupported()) return "Google login needs the latest version of the app.";
      return null;
    }
    if (Platform.OS !== "ios") return "Apple login is only available on iPhone and iPad.";
    if (!appleModule()) return "Apple login needs the latest version of the app.";
    return appleOk ? null : "Sign in with Apple isn't available on this device.";
  };
  const show = (kind) => !skip.includes(kind) && (showAll || whyNot(kind) === null);
  if (!show("google") && !show("apple")) return null;

  // get() asks Google/Apple (null = they closed it); send() gives the token to VoidPop
  const run = (kind, label, get, send) => async () => {
    const why = whyNot(kind);
    if (why) { onError?.(why); return; }
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

  const ready = (kind) => whyNot(kind) === null;
  const apple = appleModule();
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

      {show("google") && (
        <TouchableOpacity onPress={run("google", "Google", signInWithGoogle, loginWithGoogle)} disabled={busy} accessibilityRole="button"
          style={[styles.social, { borderColor: C.border }, (busy || !ready("google")) && { opacity: busy ? 0.5 : 0.6 }]}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{connect ? "Connect Google" : "Log in with Google"}</Text>
        </TouchableOpacity>
      )}

      {show("apple") && (ready("apple") && apple?.AppleAuthenticationButton ? (
        // Apple's own button: Apple decides its wording ("Sign in with Apple")
        <apple.AppleAuthenticationButton
          buttonType={apple.AppleAuthenticationButtonType[connect ? "CONTINUE" : "SIGN_IN"]}
          buttonStyle={apple.AppleAuthenticationButtonStyle[dark ? "WHITE" : "BLACK"]}
          cornerRadius={10} style={{ height: 46, opacity: busy ? 0.5 : 1 }}
          onPress={run("apple", "Apple", signInWithApple, loginWithApple)} />
      ) : (
        <TouchableOpacity onPress={run("apple", "Apple", signInWithApple, loginWithApple)} accessibilityRole="button"
          style={[styles.social, { borderColor: C.border, opacity: 0.6 }]}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{connect ? "Connect Apple" : "Log in with Apple"}</Text>
        </TouchableOpacity>
      ))}
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

// onDone(user): signed in. onGuest: when given, a "Guest mode" button is shown (the login screen).
export default function AuthForm({ onDone, onGuest }) {
  const { C } = useTheme();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ identifier: "", email: "", username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const isLogin = mode === "login";

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const user = isLogin
        ? await login({ identifier: f.identifier.trim(), password: f.password })
        : await register({ email: f.email.trim(), username: f.username.trim(), password: f.password });
      setF((x) => ({ ...x, password: "" }));
      onDone?.(user);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <View style={{ gap: 12, alignSelf: "stretch" }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }} accessibilityRole="header">{isLogin ? "Login" : "Sign up"}</Text>

      {isLogin ? (
        <Field C={C} label="Email or username" value={f.identifier} onChangeText={set("identifier")} textContentType="username" />
      ) : (
        <>
          <Field C={C} label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" textContentType="emailAddress" />
          <Field C={C} label="Username (letters, numbers, _)" value={f.username} onChangeText={set("username")} maxLength={24} />
        </>
      )}
      <Field C={C} label="Password" value={f.password} onChangeText={set("password")} secureTextEntry textContentType={isLogin ? "password" : "newPassword"} />
      {!isLogin && <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19 }}>At least 8 characters. Your email is only used to log in; it is never shown to others.</Text>}
      {!!err && <Text style={{ color: C.rose, fontSize: 13, lineHeight: 19 }} accessibilityRole="alert">{err}</Text>}

      {/* a glass button: a see-through wash of the accent colour with an accent border */}
      <TouchableOpacity onPress={submit} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }}
        style={[styles.primary, { backgroundColor: `${C.purple}2e`, borderColor: C.purple }, busy && { opacity: 0.7 }]}>
        {busy ? <ActivityIndicator color={C.purple} /> : <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{isLogin ? "Login" : "Sign up"}</Text>}
      </TouchableOpacity>

      <Text style={{ textAlign: "center", color: C.sub, fontSize: 13 }}>
        {isLogin ? "New to VoidPop?" : "Already have an account?"}
        <Text onPress={() => { setMode(isLogin ? "register" : "login"); setErr(""); }} accessibilityRole="link"
          style={{ color: C.purple, fontWeight: "700" }}>{isLogin ? "  Sign up" : "  Login"}</Text>
      </Text>

      <SocialButtons divider showAll onDone={onDone} onError={setErr} />

      {onGuest && (
        <TouchableOpacity onPress={onGuest} accessibilityRole="button" style={[styles.guest, { borderColor: C.border }]}>
          <Text style={{ color: C.text, fontWeight: "700" }}>Guest mode</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  social: { height: 46, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  primary: { borderWidth: 2, borderRadius: 10, minHeight: 46, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  guest: { borderWidth: 2, borderRadius: 10, minHeight: 46, alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1 },
});
