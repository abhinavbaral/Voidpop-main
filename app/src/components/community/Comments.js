// Comments on a title (anime, manga, movie or series). Replaces the old private note.
// Shown only when a VoidPop server is set up. Signed out you can read; to write, reply or like,
// you sign in (More → Account).
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { VERDICTS, timeAgo } from "@voidpop/shared/backend/store";
import { useAccount, useComments } from "@voidpop/shared/backend/useCommunity";
import { useTheme } from "../../context/ThemeContext.js";

function Composer({ placeholder, submitLabel, initial = "", onSubmit, onCancel, autoFocus }) {
  const { C } = useTheme();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setErr("");
    const problem = await onSubmit(text.trim());
    setBusy(false);
    if (problem) setErr(problem); else { setText(""); onCancel?.(); }
  };
  return (
    <View style={{ gap: 8 }}>
      <TextInput value={text} onChangeText={setText} multiline maxLength={1000} autoFocus={autoFocus}
        placeholder={placeholder} placeholderTextColor={C.faint} accessibilityLabel={placeholder}
        style={{ minHeight: 64, color: C.text, backgroundColor: C.inputBg, borderColor: C.border, borderWidth: 1, borderRadius: 10, padding: 10, textAlignVertical: "top" }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Text style={{ color: C.faint, fontSize: 11 }}>{text.length}/1000</Text>
        <View style={{ flex: 1 }} />
        {onCancel && <Text style={{ color: C.sub, fontWeight: "700" }} onPress={onCancel}>Cancel</Text>}
        <TouchableOpacity disabled={!text.trim() || busy} onPress={send} accessibilityRole="button"
          style={{ backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, opacity: !text.trim() || busy ? 0.5 : 1 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
      {!!err && <Text style={{ color: C.rose, fontSize: 13 }} accessibilityRole="alert">{err}</Text>}
    </View>
  );
}

function Comment({ c, me, actions, reply }) {
  const { C } = useTheme();
  const [mode, setMode] = useState(null); // null | "reply" | "edit"
  const [confirmDelete, setConfirmDelete] = useState(false); // two taps, since Alert doesn't exist on web
  const [err, setErr] = useState("");
  const verdict = VERDICTS.find((v) => v.key === c.verdict);
  const act = async (fn) => setErr(await fn());
  const link = { color: C.sub, fontSize: 13, fontWeight: "700" };
  return (
    <View style={[{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 12 },
      reply && { backgroundColor: "transparent", borderWidth: 0, padding: 0 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 12 }}>{c.author.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={{ flex: 1, color: C.text }} numberOfLines={1}>
          <Text style={{ fontWeight: "800" }}>{c.author}</Text>
          {c.mine ? <Text style={{ color: C.purple, fontWeight: "700" }}> · You</Text> : null}
          <Text style={{ color: C.faint, fontSize: 12 }}>  {timeAgo(c.createdAt)}{c.editedAt ? " · edited" : ""}</Text>
        </Text>
        {verdict && <View style={{ backgroundColor: verdict.color, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{verdict.label}</Text></View>}
      </View>

      {c.deleted ? <Text style={{ color: C.faint, fontStyle: "italic", marginTop: 8 }}>This comment was deleted.</Text>
        : mode === "edit" ? (
          <View style={{ marginTop: 8 }}>
            <Composer placeholder="Edit your comment" submitLabel="Save" initial={c.body} autoFocus
              onSubmit={(t) => actions.edit(c.id, t)} onCancel={() => setMode(null)} />
          </View>
        ) : <Text style={{ color: C.text, marginTop: 8, lineHeight: 21 }}>{c.body}</Text>}

      {!c.deleted && mode !== "edit" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
          <Text disabled={!me} accessibilityRole="button" accessibilityState={{ selected: c.liked, disabled: !me }}
            onPress={() => act(() => actions.like(c.id, !c.liked))} style={[link, c.liked && { color: C.rose }, !me && { opacity: 0.5 }]}>
            {c.liked ? "♥" : "♡"} {c.likes || ""}
          </Text>
          {!reply && !!me && <Text style={link} accessibilityRole="button" onPress={() => setMode(mode === "reply" ? null : "reply")}>Reply</Text>}
          {c.mine && <Text style={link} accessibilityRole="button" onPress={() => setMode("edit")}>Edit</Text>}
          {c.mine && (
            <Text style={[link, confirmDelete && { color: C.rose }]} accessibilityRole="button"
              onPress={() => { if (!confirmDelete) { setConfirmDelete(true); return; } act(() => actions.remove(c.id)); }}>
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </Text>
          )}
          {!!err && <Text style={{ color: C.rose, fontSize: 12 }}>{err}</Text>}
        </View>
      )}
      {mode === "reply" && (
        <View style={{ marginTop: 10 }}>
          <Composer placeholder={`Reply to ${c.author}`} submitLabel="Reply" autoFocus onSubmit={(t) => actions.post(t, c.id)} onCancel={() => setMode(null)} />
        </View>
      )}
      {c.replies?.length > 0 && (
        <View style={{ marginTop: 12, marginLeft: 6, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.border, gap: 12 }}>
          {c.replies.map((r) => <Comment key={r.id} c={r} me={me} actions={actions} reply />)}
        </View>
      )}
    </View>
  );
}

export default function Comments({ segment, id, onSignIn }) {
  const { C } = useTheme();
  const { user, enabled } = useAccount();
  const cm = useComments(segment, id);
  if (!enabled) return null;
  return (
    <View style={{ marginTop: 24, gap: 12 }}>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>Comments</Text>
      {user ? (
        <Composer placeholder="Say something about it…" submitLabel="Post" onSubmit={(t) => cm.post(t)} />
      ) : (
        <Text style={{ color: C.sub }}>
          <Text style={{ color: C.purple, fontWeight: "800" }} onPress={onSignIn} accessibilityRole="link">Sign in</Text> to join the conversation. Reading is open to everyone.
        </Text>
      )}
      {!!cm.error && <Text style={{ color: C.rose }}>{cm.error} <Text style={{ color: C.purple, fontWeight: "800" }} onPress={cm.reload}>Retry</Text></Text>}
      {cm.comments.map((c) => <Comment key={c.id} c={c} me={user} actions={cm} />)}
      {!cm.loading && !cm.error && !cm.comments.length && <Text style={{ color: C.faint }}>No comments yet. Be the first.</Text>}
      {cm.loading && <Text style={{ color: C.faint }}>Loading…</Text>}
      {cm.hasMore && !cm.loading && (
        <TouchableOpacity onPress={cm.more} accessibilityRole="button" style={{ alignSelf: "center", borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ color: C.text, fontWeight: "700" }}>Show older comments</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
