// MOVIE / SERIES PAGE — Detail screen for segment "movie" or "tv".
// Nothing to count: Watchlist, Watched, and your Void Verdict. Below: the community meter,
// where to watch, cast, comments, and more like it.
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Image, TouchableOpacity, Linking, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchCinemaDetail, fetchSimilarCinema, fetchTrendingCinema, hasTmdb } from "@voidpop/shared/api/tmdb";
import { hasCommunity, syncCinemaVerdict } from "@voidpop/shared/api/community";
import { getCinemaEntry, setCinemaStatus, saveCinemaReview, onDataChange } from "@voidpop/shared/backend/store";
import { moreLikeThis } from "@voidpop/shared/features/cinema";
import { useTitleVerdicts } from "@voidpop/shared/backend/useCommunity";
import { useTheme } from "../../context/ThemeContext.js";
import { getCachedItem, cacheItem, openDetail, goBackOrHome } from "../../utils/nav";
import PosterRow from "../../components/ui/PosterRow.js";
import Icon from "../../components/ui/Icon.js";
import ReviewCard from "../../components/title/ReviewCard.js";
import VerdictModal from "../../components/title/VerdictModal.js";
import VerdictMeter from "../../components/community/VerdictMeter.js";
import Comments from "../../components/community/Comments.js";

const LABEL = { movie: "Movie", tv: "Series" };
const CREATOR = { movie: "Directed by", tv: "Created by" };

export default function CinemaDetailScreen({ route, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { segment, id } = route.params;
  const [item, setItem] = useState(() => route.params?.item || getCachedItem(segment, id));
  const [extra, setExtra] = useState({ cast: [], trailer: null, services: [], demo: false, loaded: false });
  const [failed, setFailed] = useState(false);
  const [entry, setEntry] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const community = useTitleVerdicts(segment, String(id));

  useEffect(() => {
    let alive = true;
    fetchCinemaDetail(segment, id)
      .then(async (d) => {
        if (!alive) return;
        cacheItem(d.item);
        setItem(d.item);
        setExtra({ cast: d.cast, trailer: d.trailer, services: d.services, demo: d.demo, loaded: true });
        const recs = await fetchSimilarCinema(segment, id).catch(() => []);
        const pool = recs.length ? recs : moreLikeThis(d.item, await fetchTrendingCinema().catch(() => []));
        if (alive) setSimilar(pool);
      })
      .catch(() => alive && setFailed(true));
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

  const status = entry?.status || null;
  const review = entry?.review || null;
  const unreleased = !!item.unreleased;
  const sample = extra.demo || item.demo;
  // saved on this phone first; then, if you're signed in, the community is told
  const share = async () => { await syncCinemaVerdict(item, await getCinemaEntry(item.segment, item.id)); community.refresh(); };
  const toggle = async (next) => { await setCinemaStatus(item, status === next ? null : next); share(); };
  const remove = async () => {
    if (review && !confirmRemove) { setConfirmRemove(true); return; } // a verdict goes with it: tap twice
    setConfirmRemove(false);
    await setCinemaStatus(item, null);
    share();
  };
  const meta = [item.dateLabel, LABEL[item.segment], item.runtime].filter(Boolean).join(" · ");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {item.banner ? <Image source={{ uri: item.banner }} style={styles.banner} resizeMethod="resize" /> : null}
        <View style={styles.body}>
          <TouchableOpacity onPress={() => goBackOrHome(navigation)} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
            <Icon name="back" size={18} color={C.purple} /><Text style={{ color: C.purple, fontWeight: "700" }}>Back</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 14 }}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: C.border }]} />}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.eyebrow}>{LABEL[item.segment].toUpperCase()}</Text>
              <Text style={styles.h1}>{item.title}</Text>
              {!!item.creator && <Text style={styles.creator}>{CREATOR[item.segment]} {item.creator}</Text>}
              <Text style={styles.sub}>{meta}</Text>
              {!!(item.vibe || item.altTitle) && <Text style={[styles.sub, { fontStyle: "italic" }]}>{item.vibe || item.altTitle}</Text>}
              <View style={styles.chips}>
                {(item.genres?.length ? item.genres : [item.genre]).filter(Boolean).slice(0, 4).map((g) => (
                  <View key={g} style={styles.chip}><Text style={styles.chipText}>{g}</Text></View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.statusRow}>
            <TouchableOpacity onPress={() => toggle("plan")} accessibilityRole="button" accessibilityState={{ selected: status === "plan" }}
              style={[styles.status, status === "plan" && styles.statusOn]}>
              <Text style={[styles.statusText, status === "plan" && { color: "#fff" }]}>{status === "plan" ? "On your watchlist ✓" : "Add to watchlist"}</Text>
            </TouchableOpacity>
            {!unreleased && (
              <TouchableOpacity onPress={() => toggle("watched")} accessibilityRole="button" accessibilityState={{ selected: status === "watched" }}
                style={[styles.status, status === "watched" && styles.statusOn]}>
                <Text style={[styles.statusText, status === "watched" && { color: "#fff" }]}>{status === "watched" ? "Watched ✓" : "Mark as watched"}</Text>
              </TouchableOpacity>
            )}
            {!unreleased && (
              <TouchableOpacity onPress={() => setVerdictOpen(true)} accessibilityRole="button" style={styles.status}>
                <Text style={styles.statusText}>{review ? "Edit verdict" : "Share your verdict"}</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!status && (
            <Text onPress={remove} accessibilityRole="button" style={[styles.remove, confirmRemove && { color: C.rose }]}>
              {confirmRemove ? "Tap again: your verdict goes with it" : "Remove from shelf"}
            </Text>
          )}
          {unreleased && <Text style={styles.small}>Not out yet: add it to your watchlist now. Verdicts open when it’s released.</Text>}

          {!!item.overview && <Text style={styles.overview}>{item.overview}</Text>}
          {!!extra.trailer && (
            <Text onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${extra.trailer}`)} accessibilityRole="link" style={styles.link}>▶ Watch the trailer</Text>
          )}

          <View style={styles.panel}>
            <Text style={styles.h2}>Find it on</Text>
            {extra.services.length > 0 ? (
              <View style={styles.chips}>{extra.services.map((s) => <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>)}</View>
            ) : <Text style={styles.small}>{extra.loaded ? "No streaming listing for your region." : "Checking…"}</Text>}
            <Text style={styles.small}>
              {sample ? "Sample labels for this demo. Real availability depends on your country." : "Availability depends on your country. Data from JustWatch, via TMDB."}
            </Text>
            {extra.cast.length > 0 && (
              <>
                <Text style={[styles.h2, { marginTop: 12 }]}>In the story</Text>
                <View style={styles.chips}>{extra.cast.map((c) => <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>)}</View>
              </>
            )}
          </View>

          {(hasCommunity() || sample) && (
            <VerdictMeter counts={hasCommunity() ? community.counts : item.sampleVotes} sample={sample && !hasCommunity()} myVerdict={review?.verdict} />
          )}

          {review && <View style={{ marginTop: 16 }}><ReviewCard review={review} onEdit={() => setVerdictOpen(true)} /></View>}

          <Comments segment={item.segment} id={String(item.id)} onSignIn={() => navigation.navigate("Account")} />
        </View>

        {similar.length > 0 && <PosterRow title="More like this" items={similar} onOpen={(it) => openDetail(navigation, it, { push: true })} />}
        {hasTmdb() && !sample && <Text style={[styles.small, { paddingHorizontal: 18, marginTop: 16 }]}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>}
      </ScrollView>

      {verdictOpen && (
        <VerdictModal visible initial={review} onClose={() => setVerdictOpen(false)}
          onSave={async ({ verdict, moods, comment }) => { await saveCinemaReview(item, { verdict, moods, comment }); setVerdictOpen(false); share(); }} />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  banner: { width: "100%", height: 190, backgroundColor: C.border },
  body: { padding: 18, gap: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  poster: { width: 110, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: C.border },
  eyebrow: { color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  h1: { color: C.text, fontSize: 24, fontWeight: "800" },
  h2: { color: C.text, fontSize: 17, fontWeight: "800" },
  creator: { color: C.orange, fontWeight: "700", fontSize: 13 },
  sub: { color: C.sub, fontSize: 13 },
  small: { color: C.faint, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: C.sub, fontSize: 12, fontWeight: "600" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  status: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  statusOn: { backgroundColor: C.purple, borderColor: C.purple },
  statusText: { color: C.text, fontWeight: "700", fontSize: 13 },
  remove: { color: C.faint, fontSize: 12, fontWeight: "700", alignSelf: "flex-start" },
  overview: { color: C.text, lineHeight: 22 },
  link: { color: C.purple, fontWeight: "800" },
  panel: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 8, marginTop: 8 },
  btnPrimary: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
