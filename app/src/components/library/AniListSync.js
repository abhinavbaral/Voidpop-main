// More → AniList: sign in for two-way sync, see its state, sync now, sign out.
// Sign-in opens AniList in a secure browser tab; AniList sends you back to
// voidation://auth with a token (your password never touches Voidation).
import { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { onSyncState, authUrl, finishSignIn, syncNow, signOut, redirectUri } from "@voidation/shared/sync/anilist";
import { timeAgo } from "@voidation/shared/backend/store";
import { VoidmonLoading } from "../brand/Voidmon.js";

export default function AniListSync({ styles, C, onChange }) {
  const [s, setS] = useState(null);
  const [result, setResult] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => onSyncState(setS), []);
  if (!s) return null;

  const signIn = async () => {
    setSigningIn(true);
    setResult("");
    try {
      const res = await WebBrowser.openAuthSessionAsync(authUrl(), redirectUri());
      if (res.type === "success" && res.url) {
        const r = await finishSignIn(res.url);
        setResult(r ? `First sync done: ${r.added} added from AniList, ${r.updated} updated.` : "");
        onChange?.();
      }
    } catch (e) {
      setResult(e.message || "Couldn't sign in to AniList.");
    } finally {
      setSigningIn(false);
    }
  };

  if (!s.configured) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync with AniList</Text>
        <Text style={[styles.note, { marginTop: 6 }]}>
          Sync isn't set up in this build. It needs a free AniList app: register one at anilist.co/settings/developer
          with the redirect URL {redirectUri()}, put its client id in EXPO_PUBLIC_ANILIST_CLIENT_ID, and rebuild.
          Until then, use the import below.
        </Text>
      </View>
    );
  }

  if (!s.connected) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync with AniList</Text>
        <Text style={[styles.note, { marginTop: 6 }]}>
          Sign in once and your anime and manga lists stay the same everywhere: this app, the Voidation website, and
          AniList itself. Status and progress sync both ways. Verdicts, categories, Excited and your watch log stay on
          this phone. The first sync merges both sides; nothing is deleted.
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnOn, { marginTop: 12, flex: undefined }]} onPress={signIn} disabled={signingIn}>
          <Text style={[styles.btnText, { color: "#fff" }]}>{signingIn ? "Signing in…" : "Sign in with AniList"}</Text>
        </TouchableOpacity>
        {!!(result || s.error) && <Text style={{ color: C.rose, fontSize: 12, marginTop: 8 }}>{result || s.error}</Text>}
      </View>
    );
  }

  const run = async () => {
    setResult("");
    const r = await syncNow({ reason: "manual", force: true });
    if (r) {
      setResult(r.added || r.updated || r.removed
        ? `From AniList: ${r.added} added, ${r.updated} updated, ${r.removed} removed.`
        : "Everything's already in sync.");
      onChange?.();
    }
  };

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {s.user?.avatar && <Image source={{ uri: s.user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Synced with AniList</Text>
          <Text style={styles.note}>
            Signed in as {s.user?.name} · {s.busy ? "syncing…" : s.lastSync ? `last synced ${timeAgo(s.lastSync)}` : "not synced yet"}
            {s.pending > 0 ? ` · ${s.pending} change${s.pending === 1 ? "" : "s"} waiting to send` : ""}
          </Text>
        </View>
      </View>
      {s.busy && <VoidmonLoading text="Syncing with AniList…" size={90} />}
      {!!s.error && <Text style={{ color: C.rose, fontSize: 12, marginTop: 8 }}>{s.error}</Text>}
      {!!result && <Text style={[styles.note, { marginTop: 8 }]}>{result}</Text>}
      <View style={[styles.modeRow, { marginTop: 12 }]}>
        <TouchableOpacity style={[styles.btn, styles.btnOn]} onPress={run} disabled={s.busy}>
          <Text style={[styles.btnText, { color: "#fff" }]}>{s.busy ? "Syncing…" : "Sync now"}</Text>
        </TouchableOpacity>
        {/expired/i.test(s.error) ? (
          <TouchableOpacity style={styles.btn} onPress={signIn}><Text style={styles.btnText}>Sign in again</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={() => Alert.alert("Sign out of AniList?", "Your library stays on this phone; it just stops syncing.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => signOut() },
          ])}><Text style={styles.btnText}>Sign out</Text></TouchableOpacity>
        )}
      </View>
      <Text style={[styles.note, { marginTop: 10 }]}>
        Verdicts, categories, Excited and your watch log aren't synced (AniList has no place for them). They're in your backups.
      </Text>
    </View>
  );
}
