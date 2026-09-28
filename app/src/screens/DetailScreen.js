// CONTENT DETAILS — trailer banner (opens YouTube), where to watch, poster, title, genres,
// synopsis, next-episode countdown, tracking buttons, your verdict,
// seasons/related entries. NO numerical ratings anywhere.

import { useCallback, useEffect, useState } from "react";
import {
  ScrollView, View, Text, Image, TouchableOpacity, Linking,
  FlatList, StyleSheet, Modal, Pressable, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TrailerPlayer from "../components/TrailerPlayer";
import WhereToWatch from "../components/WhereToWatch";
import { getCachedItem, cacheItem, openDetail, goBackOrHome } from "../lib/nav";
import { releaseLabel, formatCountdown, dayLabel, airTime } from "@voidation/shared/format";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useIsWide } from "../lib/layout";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import {
  statusesFor, getStatus, setStatus, addReview, getMyReview,
  getExcited, toggleExcited, getEntry, setProgress, noteAiring, totalFor, unitFor, airedFor,
} from "@voidation/shared/backend/store";
import { fetchAniListDetail, fetchAniListItem, fetchNextEpisodes } from "@voidation/shared/api/anilist";
import ReviewCard from "../components/ReviewCard.js";
import VerdictModal from "../components/VerdictModal.js";
import ShareCardModal from "../components/ShareCardModal.js";
import Card from "../components/Card.js";
import { useTheme } from "../context/ThemeContext.js";

const SEGMENTS = ["anime", "manga"];
const CREATOR_LABEL = { manga: "Mangaka", anime: "Studio" };

// Route: /title/:segment/:id. Resolves the item (cache → network), then
// renders the page. This is what makes title pages linkable & refresh-safe on web.
export default function DetailScreen({ route, navigation }) {
  const { C } = useTheme();
  const { segment, id } = route.params || {};
  const [item, setItem] = useState(
    () => route.params?.item || getCachedItem(segment, id)
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (item && !item.partial) return;
    if (!SEGMENTS.includes(segment) || !id) return setFailed(true);
    let alive = true;
    (async () => {
      try {
        const it = await fetchAniListItem(segment, id);
        if (!alive) return;
        // an imported title (item.partial) is shown right away and filled in here
        if (it) { cacheItem(it); setItem(it); } else if (!item) setFailed(true);
      } catch {
        if (alive && !item) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [item, segment, id]);

  // browser tab title on web; harmless on native (header is hidden)
  useEffect(() => {
    if (item) navigation.setOptions({ title: `${item.title} · Voidation` });
  }, [item, navigation]);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        {failed ? (
          <>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 16 }}>Title not found</Text>
            <TouchableOpacity onPress={() => goBackOrHome(navigation)} style={{ marginTop: 14 }}>
              <Text style={{ color: C.purple }}>← Back to Voidation</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={C.orange} />
        )}
      </SafeAreaView>
    );
  }

  return <DetailBody key={`${item.segment}:${item.id}`} item={item} navigation={navigation} />;
}

function DetailBody({ item, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { user } = useAuth();

  const now = useNow(1000);
  const { clock24 } = useSettings().settings;
  const [status, setStatusState] = useState(null);
  const [nextEpisode, setNextEpisode] = useState(item.nextEpisode || null);
  const [myReview, setMyReview] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isExcited, setIsExcited] = useState(false);
  const [progress, setProgressState] = useState(0);
  const [delay, setDelay] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [zoom, setZoom] = useState(false);

  const [trailer, setTrailer] = useState(null);
  const [related, setRelated] = useState([]);
  const [watch, setWatch] = useState([]);

  const refresh = useCallback(async () => {
    const entry = await getEntry(item.segment, item.id);
    setProgressState(entry?.progress || 0);
    setDelay(entry?.delay?.episode === entry?.item.nextEpisode?.episode ? entry?.delay : null);
    setStatusState(await getStatus(user, item.segment, item.id));
    setMyReview(await getMyReview(user, item.segment, item.id));
    if (item.unreleased) {
      const ex = await getExcited(user);
      setIsExcited(!!ex[`${item.segment}:${item.id}`]);
    }
  }, [user, item]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // trailer + related seasons; and a fresh next-episode time, because items
  // opened from the library are snapshots saved when you tracked them
  useEffect(() => {
    let alive = true;
    fetchAniListDetail(item.segment, item.id)
      .then((d) => { if (alive) { setTrailer(d.trailer); setRelated(d.related); setWatch(d.whereToWatch || []); } })
      .catch(() => {});
    if (item.segment === "anime" && !item.finished) {
      fetchNextEpisodes([item.id])
        .then(async (fresh) => {
          if (!alive || !fresh[item.id]) return;
          setNextEpisode(fresh[item.id].nextEpisode);
          if (await noteAiring(fresh)) refresh();
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [item]);

  const pick = async (key) => {
    if (key === status) {
      await setStatus(user, item.segment, item, null);
      setStatusState(null);
      return;
    }
    if (key === "completed") {
      setModalOpen(true);
      return;
    }
    await setStatus(user, item.segment, item, key);
    setStatusState(key);
  };

  const changeProgress = async (n) => {
    const r = await setProgress(user, item, n);
    setProgressState(r.progress);
    setStatusState(r.status);
    if (r.reachedEnd) setModalOpen(true); // last episode: ask for the verdict
  };

  const saveVerdict = async ({ verdict, vibes, comment }) => {
    await setStatus(user, item.segment, item, "completed");
    await addReview(user, item.segment, item.id, { verdict, vibes, comment });
    setModalOpen(false);
    refresh();
  };

  const creator = item.creator;
  const wide = useIsWide();

  const statusButtons = (
    <>
      <View style={styles.statusRow}>
        {statusesFor(item.segment).map((s) => {
          const active = status === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => pick(s.key)}
              style={[styles.statusBtn, active && styles.statusActive]}
            >
              <Text style={[styles.statusText, active && { color: "#fff" }]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
        {item.unreleased && (
          <TouchableOpacity
            onPress={async () => setIsExcited(await toggleExcited(user, item))}
            style={[styles.statusBtn, isExcited && { backgroundColor: C.orange, borderColor: C.orange }]}
          >
            <Text style={[styles.statusText, isExcited && { color: "#fff" }]}>
              {isExcited ? "Excited \u2713" : "Excited?"}
            </Text>
          </TouchableOpacity>
        )}
        {status === "completed" && (
          <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.statusBtn}>
            <Text style={styles.statusText}>{myReview ? "Edit review" : "Review it"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  const overview = !!item.overview && (
    <Text style={[styles.overview, wide && styles.overviewWide]}>{item.overview}</Text>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* trailer banner */}
        {trailer ? (
          <TrailerPlayer videoId={trailer} style={styles.trailer} />
        ) : item.banner ? (
          <Image source={{ uri: item.banner }} style={styles.banner} />
        ) : null}

        <View style={{ padding: wide ? 24 : 16 }}>
          <TouchableOpacity onPress={() => goBackOrHome(navigation)}>
            <Text style={{ color: C.purple, marginBottom: 10 }}>← Back</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: wide ? 28 : 14 }}>
            <TouchableOpacity onPress={() => setZoom(true)}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={[styles.poster, wide && styles.posterWide]} />
              ) : (
                <View style={[styles.poster, wide && styles.posterWide, styles.noImg]}>
                  <Text style={{ color: C.faint }}>No image</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, wide && styles.titleWide]}>{item.title}</Text>
              {!!creator && (
                <Text style={styles.creator}>
                  <Text style={styles.creatorLabel}>{CREATOR_LABEL[item.segment]}  </Text>
                  {creator}
                </Text>
              )}
              <Text style={styles.sub}>{item.genre} · {releaseLabel(item)}</Text>
              <View style={styles.genreWrap}>
                {(item.genres?.length ? item.genres : [item.genre]).slice(0, 4).map((g) => (
                  <View key={g} style={styles.genreChip}>
                    <Text style={styles.genreText}>{g}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
                <Text style={styles.link}>Source page →</Text>
              </TouchableOpacity>
              {/* desktop: actions + synopsis sit beside the poster */}
              {wide && statusButtons}
              {wide && overview}
            </View>
          </View>

          {!wide && statusButtons}
          {!wide && overview}

          {/* next episode countdown (airing anime) */}
          {nextEpisode && (
            <View style={[styles.box, styles.nextBox]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextLabel}>NEXT EPISODE</Text>
                <Text style={styles.nextTitle}>
                  Episode {nextEpisode.episode}{item.episodes ? ` of ${item.episodes}` : ""}
                </Text>
                <Text style={styles.nextSub}>
                  {dayLabel(nextEpisode.airingAt, now)}, {airTime(nextEpisode.airingAt, clock24)} (your time)
                </Text>
                {delay && (
                  <Text style={styles.delayed}>Delayed · was {dayLabel(delay.from, now)}, {airTime(delay.from, clock24)}</Text>
                )}
              </View>
              <Text style={styles.nextCountdown}>{formatCountdown(nextEpisode.airingAt, now)}</Text>
            </View>
          )}

          {!item.unreleased && (status || progress > 0) && (
            <ProgressBox item={{ ...item, nextEpisode }} progress={progress} onChange={changeProgress} styles={styles} C={C} />
          )}

          <WhereToWatch links={watch} segment={item.segment} />

          {/* your verdict */}
          {myReview && (
            <View style={{ marginTop: 16 }}>
              <ReviewCard review={myReview} onEdit={() => setModalOpen(true)} onShare={() => setShareOpen(true)} />
            </View>
          )}

          {/* related seasons / entries (anime & manga) */}
          {related.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                Seasons & Related — track each one separately
              </Text>
              <FlatList
                horizontal
                data={related}
                keyExtractor={(r) => `${r.item.id}`}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item: r }) => (
                  <Card
                    item={r.item}
                    width={wide ? 150 : 120}
                    onPress={() => openDetail(navigation, r.item, { push: true })}
                  />
                )}
              />
            </>
          )}

        </View>
      </ScrollView>

      {/* poster zoom */}
      <Modal visible={zoom} transparent animationType="fade">
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(false)}>
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.zoomImg} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>

      {modalOpen && (
        <VerdictModal
          visible={modalOpen}
          initial={myReview}
          onSave={saveVerdict}
          onClose={() => setModalOpen(false)}
        />
      )}
      <ShareCardModal
        visible={shareOpen}
        item={item}
        review={myReview}
        onClose={() => setShareOpen(false)}
      />
    </SafeAreaView>
  );
}

// Episodes watched / chapters read: − 7 / 12 +1
function ProgressBox({ item, progress, onChange, styles, C }) {
  const total = totalFor(item);
  const aired = airedFor(item);
  const late = aired == null ? 0 : Math.max(0, aired - progress);
  return (
    <View style={[styles.box, styles.progressBox]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.nextLabel}>{item.segment === "manga" ? "CHAPTERS READ" : "EPISODES WATCHED"}</Text>
        <Text style={styles.nextTitle}>
          {progress}{total ? <Text style={{ color: C.faint }}> / {total}</Text> : null}
        </Text>
        {late > 0 && <Text style={{ color: C.orange, fontSize: 11, fontWeight: "700", marginTop: 2 }}>{late} new to watch</Text>}
        {!!total && (
          <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.min(100, (progress / total) * 100)}%` }]} /></View>
        )}
      </View>
      <TouchableOpacity onPress={() => onChange(progress - 1)} disabled={progress <= 0} style={[styles.stepBtn, progress <= 0 && { opacity: 0.4 }]}>
        <Text style={styles.stepText}>−</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onChange(progress + 1)} disabled={!!total && progress >= total}
        style={[styles.stepBtn, styles.stepPlus, !!total && progress >= total && { opacity: 0.4 }]}>
        <Text style={[styles.stepText, { color: "#fff" }]}>+1 {unitFor(item.segment)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  progressBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  bar: { height: 5, borderRadius: 3, backgroundColor: C.border, overflow: "hidden", marginTop: 6 },
  barFill: { height: "100%", backgroundColor: C.purple },
  stepBtn: { height: 38, minWidth: 38, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  stepPlus: { backgroundColor: C.purple, borderColor: C.purple },
  stepText: { color: C.text, fontWeight: "800", fontSize: 14 },
  delayed: { color: C.rose, fontSize: 11, fontWeight: "800", marginTop: 3 },
  safe: { flex: 1, backgroundColor: C.bg },
  // trailers keep 16:9 so video isn't letterboxed on wide browser windows;
  // a still banner is capped so it doesn't swallow the first screen on desktop
  trailer: { width: "100%", aspectRatio: 16 / 9, maxHeight: 460, backgroundColor: "#000" },
  banner: { width: "100%", aspectRatio: 16 / 9, maxHeight: 260, backgroundColor: "#000" },
  poster: { width: 120, aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: C.card },
  noImg: { alignItems: "center", justifyContent: "center" },
  posterWide: { width: 220, borderRadius: 14 },
  title: { color: C.text, fontSize: 19, fontWeight: "800" },
  titleWide: { fontSize: 30, lineHeight: 36 },
  creator: { color: C.orange, fontSize: 13, fontWeight: "700", marginTop: 6 },
  creatorLabel: { color: C.faint, fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  sub: { color: C.sub, fontSize: 12, marginTop: 4 },
  genreWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  genreChip: {
    borderWidth: 1, borderColor: C.border, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  genreText: { color: C.sub, fontSize: 10 },
  link: { color: C.purple, fontSize: 12, marginTop: 10 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  statusBtn: {
    paddingHorizontal: 12, height: 36, borderRadius: 10, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card, justifyContent: "center",
  },
  statusActive: { backgroundColor: C.purple, borderColor: C.purple },
  statusText: { color: C.sub, fontSize: 12, fontWeight: "700" },
  nextBox: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  nextLabel: { color: C.purple, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  nextTitle: { color: C.text, fontSize: 14, fontWeight: "800", marginTop: 3 },
  nextSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  nextCountdown: {
    color: C.purple, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"],
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, overflow: "hidden",
  },
  overview: { color: C.sub, fontSize: 13, lineHeight: 20, marginTop: 16 },
  overviewWide: { fontSize: 14, lineHeight: 22, maxWidth: 720 },
  panelsWide: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  seasonGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 16 },
  reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  reviewCell: { width: "calc(50% - 6px)" },
  box: {
    marginTop: 20, backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 16,
  },
  sectionTitle: { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 10 },
  seasonRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  seasonThumb: { width: 42, height: 60, borderRadius: 6 },
  seasonName: { color: C.text, fontSize: 13, fontWeight: "600" },
  seasonSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  zoomBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  zoomImg: { width: "92%", height: "80%" },
});