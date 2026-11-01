// READ A NEWS ARTICLE inside the app (More → Other → News → tap a story). The site's own page opens in a web view,
// so the writers and the site get their visit and nothing is copied. At the bottom: your Void Verdict on the
// story. Just the four verdicts: no moods and no note.
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, BackHandler, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { VERDICTS, getNewsVerdicts, setNewsVerdict } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";
import { goBackOrHome } from "../../utils/nav";
import VerdictModal from "../../components/title/VerdictModal.js";
import Icon from "../../components/ui/Icon.js";

export default function NewsReaderScreen({ route, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { article } = route.params;
  const web = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => { getNewsVerdicts().then((all) => setVerdict(all[article.url]?.verdict || null)).catch(() => {}); }, [article.url]);

  // Android back: a step back inside the article first, then out of the reader (to the News list in its popup)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!navigation.isFocused()) return false;
      if (canGoBack && web.current) { web.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, navigation]);

  const save = useCallback(async ({ verdict: v }) => { await setNewsVerdict(article, v); setVerdict(v); setPicking(false); }, [article]);
  const remove = useCallback(async () => { await setNewsVerdict(article, null); setVerdict(null); setPicking(false); }, [article]);
  const mine = VERDICTS.find((v) => v.key === verdict);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}>
          <Icon name="back" size={22} color={C.purple} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.source} numberOfLines={1}>{article.sourceName || "News"}</Text>
          <Text style={styles.title} numberOfLines={1}>{article.title}</Text>
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(article.url).catch(() => {})} accessibilityRole="button" accessibilityLabel="Open in browser" hitSlop={10}>
          <Icon name="link" size={20} color={C.sub} />
        </TouchableOpacity>
      </View>

      {failed ? (
        <View style={styles.center}>
          <Text style={styles.msg}>This article didn't load.</Text>
          <TouchableOpacity onPress={() => { setFailed(false); setLoading(true); web.current?.reload(); }} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>Try again</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(article.url).catch(() => {})} accessibilityRole="button"><Text style={{ color: C.purple, fontWeight: "700" }}>Open in your browser</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <WebView
            ref={web}
            source={{ uri: article.url }}
            style={{ flex: 1, backgroundColor: C.bg }}
            incognito                                  // no cookies or logins carried between sites
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}          // no pop-up windows
            mediaPlaybackRequiresUserAction
            onNavigationStateChange={(s) => setCanGoBack(!!s.canGoBack)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setFailed(true); }}
            onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setFailed(true); }}
            // web pages only: a link that tries to open another app (intent://, market://) stays in the page
            onShouldStartLoadWithRequest={(req) => /^https?:\/\//i.test(req.url)}
          />
          {loading && <View style={styles.loading} pointerEvents="none"><ActivityIndicator color={C.purple} /></View>}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footText} numberOfLines={1}>{mine ? "Your verdict on this story" : "What did you make of this story?"}</Text>
        <TouchableOpacity
          onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={mine ? `Your verdict: ${mine.label}. Change it` : "Give a Void Verdict"}
          style={[styles.verdictBtn, mine && { backgroundColor: mine.color, borderColor: mine.color }]}
        >
          <Text style={[styles.verdictText, mine && { color: "#fff" }]}>{mine ? mine.label : "Void Verdict"}</Text>
        </TouchableOpacity>
      </View>

      {picking && <VerdictModal visible simple initial={verdict ? { verdict } : null} onSave={save} onRemove={remove} onClose={() => setPicking(false)} />}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  source: { color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  title: { color: C.text, fontSize: 14, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  msg: { color: C.text, fontSize: 15, fontWeight: "700" },
  btn: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "800" },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },
  footText: { flex: 1, color: C.sub, fontSize: 13 },
  verdictBtn: { borderWidth: 1.5, borderColor: C.purple, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  verdictText: { color: C.purple, fontWeight: "800", fontSize: 13 },
});
