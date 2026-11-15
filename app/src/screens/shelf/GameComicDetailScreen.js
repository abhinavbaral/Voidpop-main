// FILE: app/src/screens/shelf/GameComicDetailScreen.js — the page for a game or a comic (segment "game" or "comic").
// Status (Playing / Reading and the rest), your progress (time played / issues read), the release or next-issue countdown,
// and your Void Verdict. Modelled on the movie page (screens/cinema/CinemaDetailScreen.js); games and comics live on the same shelf.
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchShelfItem } from "@voidpop/shared/api/shelf";
import { getCinemaEntry, setCinemaStatus, saveCinemaReview, setShelfProgress, statusesFor, onDataChange } from "@voidpop/shared/backend/store";
import { SHELF_LABEL, playTime, progressLine, progressRatio, shelfCountdown } from "@voidpop/shared/features/shelfKinds";
import { formatCountdown } from "@voidpop/shared/lib/format";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import { getCachedItem, cacheItem, goBackOrHome } from "../../utils/nav";
import Icon from "../../components/ui/Icon.js";
import ReviewCard from "../../components/title/ReviewCard.js";
import VerdictModal from "../../components/title/VerdictModal.js";

const STEP = { game: 30, comic: 1 }; // minutes of play per tap, issues per tap

export default function GameComicDetailScreen({ route, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { segment, id } = route.params;
  const now = useNow(1000);
  const [item, setItem] = useState(() => route.params?.item || getCachedItem(segment, id));
  const [failed, setFailed] = useState(false);
  const [entry, setEntry] = useState(null);
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchShelfItem(segment, id).then((d) => {
      if (!alive) return;
      if (d) { cacheItem(d); setItem(d); } else setFailed(true);
    });
    return () => { alive = false; };
  }, [segment, id]);

  const refresh = useCallback(() => getCinemaEntry(segment, id).then(setEntry).catch(() => {}), [segment, id]);
  useEffect(() => { refresh(); return onDataChange(refresh); }, [refresh]);

  if (failed && !item) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.h1}>Title not found</Text>
          <Text style={styles.sub}>This link may be broken, or the title was removed.</Text>
          <TouchableOpacity onPress={() => goBackOrHome(navigation)} style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (!item) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={C.purple} /></View></SafeAreaView>;

  const isGame = item.segment === "game";
  const status = entry?.status || null;
  const review = entry?.review || null;
  const progress = entry?.progress || 0;
  const unreleased = !!item.unreleased;
  const countdown = shelfCountdown(item);
  const ratio = progressRatio(item, progress);
  const step = STEP[item.segment];
  const toggle = (next) => setCinemaStatus(item, status === next ? null : next);
  const bump = (delta) => setShelfProgress(item, progress + delta);
  const remove = async () => {
    if (review && !confirmRemove) { setConfirmRemove(true); return; } // a verdict goes with it: tap twice
    setConfirmRemove(false);
    await setCinemaStatus(item, null);
  };
  const meta = [item.dateLabel, isGame ? (item.platforms || []).join(", ") : item.publisher].filter(Boolean).join(" · ");
  const who = isGame ? item.developer : item.writer;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: item.color || C.border }]}>
          <View style={styles.heroShade} />
          <TouchableOpacity onPress={() => goBackOrHome(navigation)} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
            <Icon name="back" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700" }}>Back</Text>
          </TouchableOpacity>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>{SHELF_LABEL[item.segment].toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{item.title}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {!!who && <Text style={styles.creator}>{isGame ? "Developed by" : "Written by"} {who}</Text>}
          {!!meta && <Text style={styles.sub}>{meta}</Text>}
          <View style={styles.chips}>
            {(item.genres?.length ? item.genres : [item.genre]).filter(Boolean).slice(0, 4).map((g) => (
              <View key={g} style={styles.chip}><Text style={styles.chipText}>{g}</Text></View>
            ))}
          </View>

          <View style={styles.statusRow}>
            {statusesFor(item.segment).map((s) => (
              <TouchableOpacity key={s.key} onPress={() => toggle(s.key)} accessibilityRole="button" accessibilityState={{ selected: status === s.key }}
                style={[styles.status, status === s.key && styles.statusOn]}>
                <Text style={[styles.statusText, status === s.key && { color: "#fff" }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!status && (
            <Text onPress={remove} accessibilityRole="button" style={[styles.remove, confirmRemove && { color: C.rose }]}>
              {confirmRemove ? "Tap again: your verdict goes with it" : "Remove from library"}
            </Text>
          )}

          {!!countdown && (
            <View style={[styles.panel, styles.rowBetween]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{isGame ? "RELEASE" : "NEXT ISSUE"}</Text>
                <Text style={styles.big}>{countdown.label}</Text>
                <Text style={styles.small}>{new Date(countdown.airingAt * 1000).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}</Text>
              </View>
              <Text style={styles.countdown}>{formatCountdown(countdown.airingAt, now)}</Text>
            </View>
          )}

          {!!status && (
            <View style={styles.panel}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{isGame ? "TIME PLAYED" : "ISSUES READ"}</Text>
                  <Text style={styles.big}>{isGame ? playTime(progress) : item.chapters ? `${progress} of ${item.chapters}` : String(progress)}</Text>
                  {isGame && !!item.hoursToBeat && <Text style={styles.small}>{progressLine(item, progress)}</Text>}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity disabled={progress <= 0} onPress={() => bump(-step)} accessibilityRole="button" accessibilityLabel={isGame ? "Minus 30 minutes" : "Minus one issue"} style={[styles.step, progress <= 0 && { opacity: 0.4 }]}>
                    <Text style={styles.stepText}>{isGame ? "-30m" : "-"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => bump(step)} accessibilityRole="button" accessibilityLabel={isGame ? "Plus 30 minutes" : "Plus one issue"} style={[styles.step, styles.stepOn]}>
                    <Text style={[styles.stepText, { color: "#fff" }]}>{isGame ? "+30m" : "+1 Issue"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {ratio != null && <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, ratio * 100)}%` }]} /></View>}
            </View>
          )}

          {!unreleased && (
            <TouchableOpacity onPress={() => setVerdictOpen(true)} accessibilityRole="button" style={styles.verdictBtn}>
              <Text style={styles.statusText}>{review ? "Edit verdict" : "Share your verdict"}</Text>
            </TouchableOpacity>
          )}
          {unreleased && <Text style={styles.small}>Not out yet: add it to your Backlog now. Verdicts open when it is released.</Text>}

          {!!item.overview && <Text style={styles.overview}>{item.overview}</Text>}
          {review && <View style={{ marginTop: 8 }}><ReviewCard review={review} onEdit={() => setVerdictOpen(true)} /></View>}
          {item.demo && <Text style={styles.small}>Sample entry. Real games and comics arrive when VoidPop's server is ready.</Text>}
        </View>
      </ScrollView>

      {verdictOpen && (
        <VerdictModal visible initial={review} onClose={() => setVerdictOpen(false)}
          onSave={async ({ verdict, moods, comment }) => { await saveCinemaReview(item, { verdict, moods, comment }); setVerdictOpen(false); }} />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  hero: { height: 230, justifyContent: "space-between", padding: 18 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  heroText: { gap: 4 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  eyebrow: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, opacity: 0.85 },
  heroTitle: { color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: 0.3 },
  body: { padding: 18, gap: 12 },
  h1: { color: C.text, fontSize: 24, fontWeight: "800" },
  creator: { color: C.orange, fontWeight: "700", fontSize: 13 },
  sub: { color: C.sub, fontSize: 13 },
  small: { color: C.faint, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: C.sub, fontSize: 12, fontWeight: "600" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  status: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  statusOn: { backgroundColor: C.purple, borderColor: C.purple },
  statusText: { color: C.text, fontWeight: "700", fontSize: 13 },
  remove: { color: C.faint, fontSize: 12, fontWeight: "700", alignSelf: "flex-start" },
  panel: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  big: { color: C.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  countdown: { color: C.purple, fontSize: 26, fontWeight: "900" },
  step: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  stepOn: { backgroundColor: C.purple, borderColor: C.purple },
  stepText: { color: C.text, fontWeight: "800", fontSize: 14 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.border, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: C.purple },
  verdictBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignSelf: "flex-start" },
  overview: { color: C.text, lineHeight: 22 },
  btnPrimary: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
