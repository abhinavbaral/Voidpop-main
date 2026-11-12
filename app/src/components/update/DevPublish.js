// FILE: app/src/components/update/DevPublish.js — the "Publish update" button (developer only: More > About, tap the version
// 7 times). It asks GitHub to run .github/workflows/publish-update.yml, which tests the code and runs `eas update`.
// The GitHub token is typed here once and kept on this phone only; it should be a fine-grained token with just
// "Actions: read and write" on the one repository. The EAS token is a repository secret and never comes near the app.
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { readKey, writeKey } from "@voidpop/shared/backend/storage";
import { dispatchPublish, latestRun, runLabel, REASONS, CHANNELS } from "@voidpop/shared/features/publishUpdate";
import { useTheme } from "../../context/ThemeContext.js";
import appConfig from "../../../app.json";

const KEY = "voidation:dev:v1";
const CFG = appConfig.expo.extra.publish; // { repo, workflow, ref }

export default function DevPublish() {
  const { C } = useTheme();
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState("preview");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    readKey(KEY).then((v) => { const t = JSON.parse(v || "{}").token; if (t) { setToken(t); setSaved(true); } }).catch(() => {});
    return () => clearInterval(timer.current);
  }, []);

  const watch = () => {
    clearInterval(timer.current);
    let n = 0;
    const tick = async () => {
      const run = await latestRun({ ...CFG, token });
      setMsg(runLabel(run));
      if ((run && run.status === "completed") || ++n > 50) clearInterval(timer.current);
    };
    timer.current = setInterval(tick, 15000);
    setTimeout(tick, 4000);
  };

  const send = async () => {
    setBusy(true); setMsg("Starting…");
    const r = await dispatchPublish({ ...CFG, token: token.trim(), notes, channel });
    setBusy(false);
    if (!r.ok) { setMsg(REASONS[r.reason]); return; }
    await writeKey(KEY, JSON.stringify({ token: token.trim() })).catch(() => {});
    setSaved(true); setNotes("");
    setMsg("Started. It takes about 5 to 10 minutes.");
    watch();
  };
  const confirm = () => {
    if (channel !== "production") { send(); return; }
    Alert.alert("Publish to production?", "Every installed production copy gets this the next time it opens.", [
      { text: "Cancel", style: "cancel" }, { text: "Publish", style: "destructive", onPress: send },
    ]);
  };
  const forget = async () => { await writeKey(KEY, "{}").catch(() => {}); setToken(""); setSaved(false); };

  const input = [s.input, { color: C.text, borderColor: C.border }];
  return (
    <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>Publish update (developer)</Text>
      <Text style={{ color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
        Checks the code, then sends the latest pushed code to phones as an update. Only code already pushed to {CFG.repo} ({CFG.ref}) is published, not what is on your computer.
      </Text>
      {!saved && (
        <TextInput value={token} onChangeText={setToken} placeholder="GitHub token (Actions: read and write)" placeholderTextColor={C.faint}
          secureTextEntry autoCapitalize="none" autoCorrect={false} style={input} />
      )}
      <TextInput value={notes} onChangeText={setNotes} placeholder="What's new (shown to everyone)" placeholderTextColor={C.faint}
        multiline maxLength={300} style={[...input, { minHeight: 70, textAlignVertical: "top" }]} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {CHANNELS.map((c) => (
          <Pressable key={c} onPress={() => setChannel(c)} style={[s.chip, { borderColor: C.border }, channel === c && { backgroundColor: C.purple, borderColor: C.purple }]}>
            <Text style={{ color: channel === c ? "#fff" : C.sub, fontWeight: "700", fontSize: 13 }}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable disabled={busy} onPress={confirm} style={[s.btn, { backgroundColor: busy ? C.border : C.purple }]}>
        <Text style={{ color: "#fff", fontWeight: "800" }}>{busy ? "Starting…" : "Publish update"}</Text>
      </Pressable>
      {!!msg && <Text style={{ color: C.sub, fontSize: 12, lineHeight: 17, marginTop: 10 }}>{msg}</Text>}
      {saved && <Pressable onPress={forget}><Text style={{ color: C.faint, fontSize: 12, marginTop: 10 }}>Remove the saved token from this phone</Text></Pressable>}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, fontSize: 14 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  btn: { height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 14 },
});
