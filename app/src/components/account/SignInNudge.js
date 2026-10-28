// "Want to sign in?" — a small popup shown to someone using the app without an account: right after their 1st verdict,
// then after every 30 more (30, 60, 90...). When it is time is decided in the shared code (nextSignInAsk); this only
// watches for changes to the library, waits for the right moment, and shows it.
//
// The right moment: a moment after the verdict is saved (so its own popup has closed), and not while a new rank's
// celebration is on screen. The first verdict is also your first rank, and two popups can't share the screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { nextSignInAsk, markSignInAsked } from "@voidpop/shared/api/community";
import { checkRankUp, onDataChange } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";
import { navRef } from "../../navigation/navRef";

export default function SignInNudge() {
  const { C } = useTheme();
  const [ask, setAsk] = useState(null);
  const showing = useRef(false);
  const timer = useRef(null);

  const check = useCallback(async (tries = 0) => {
    clearTimeout(timer.current);
    if (showing.current) return;
    const next = await nextSignInAsk().catch(() => null);
    if (!next) return;
    if (await checkRankUp().catch(() => null)) { // a rank celebration is up: look again in a moment (for about 100 seconds)
      if (tries < 40) timer.current = setTimeout(() => check(tries + 1), 2500);
      return;
    }
    showing.current = true;
    await markSignInAsked(next.milestone).catch(() => {}); // asked once per milestone, whatever the answer
    setAsk(next);
  }, []);

  useEffect(() => {
    const off = onDataChange(() => { clearTimeout(timer.current); timer.current = setTimeout(() => check(), 900); });
    return () => { off(); clearTimeout(timer.current); };
  }, [check]);

  const close = () => { showing.current = false; setAsk(null); };
  const signIn = () => {
    close();
    if (navRef.isReady()) navRef.navigate("SignIn", { inApp: true }); // inApp: the login screen returns here instead of restarting the app
  };

  if (!ask) return null;
  const first = ask.milestone === 1;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close} accessibilityLabel="Dismiss">
        <Pressable style={[s.card, { backgroundColor: C.card, borderColor: C.border, shadowColor: C.purple }]} onPress={() => {}}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }} accessibilityRole="header">Want to sign in?</Text>
          <Text style={{ color: C.sub, fontSize: 14, lineHeight: 21 }}>
            {first ? "That was your first verdict. " : `You have given ${ask.count} verdicts. `}
            Sign in so they count in the community and your library is backed up. It stays on this phone either way.
          </Text>
          <TouchableOpacity onPress={signIn} accessibilityRole="button" style={[s.primary, { backgroundColor: `${C.purple}2e`, borderColor: C.purple }]}>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={close} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 8 }}>
            <Text style={{ color: C.sub, fontWeight: "700" }}>Not now</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { alignSelf: "stretch", maxWidth: 420, borderWidth: 2, borderRadius: 18, padding: 20, gap: 14, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  primary: { borderWidth: 2, borderRadius: 10, minHeight: 46, alignItems: "center", justifyContent: "center" },
});
