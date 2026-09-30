// VOIDATION WRAPPED — full-screen story slides of your year, ending on a card
// you can share. Tap the right side for next, left side for back.
// Everything comes from your own watch log (shared/wrapped.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Image, Pressable, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadWrapped, wrappedSlides, wrappedYears, defaultWrapped, wrappedLabel } from "@voidation/shared/wrapped";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { shareCardImage } from "../lib/shareCard";
import StoryVideoMaker from "../components/StoryVideoMaker.js";
import { notify } from "../lib/notify";
import { goBackOrHome } from "../lib/nav";
import Voidmon, { VoidmonLoading } from "../components/Voidmon.js";
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from "react-native-svg";
import { reelSlides } from "@voidation/shared/reel";

const BACKGROUNDS = ["#1e0b38", "#361508", "#0b1f3a", "#2e0b22"];
const ORANGE = "#ee8f2e";
const PURPLE = "#a855f7";

export default function WrappedScreen({ navigation }) {
  const [years, setYears] = useState(["all"]);
  const [year, setYear] = useState(null); // "all", "before-2026", or a year number
  const [w, setW] = useState(null);
  const [i, setI] = useState(0);

  useEffect(() => { wrappedYears().then(setYears); defaultWrapped().then(setYear); }, []);
  useEffect(() => { if (year === null) return; setW(null); setI(0); loadWrapped(year).then(setW); }, [year]);
  // back from Pick titles: show the new picks
  const back = useRef(false);
  useFocusEffect(useCallback(() => {
    if (back.current && year !== null) loadWrapped(year).then((x) => { setW(x); setI(0); });
    back.current = true;
  }, [year]));
  const slides = w ? wrappedSlides(w) : [];
  const last = slides.length - 1;
  const go = (d) => setI((x) => Math.max(0, Math.min(last, x + d)));
  const slide = slides[i];

  // Story VIDEO: every slide captured as a story image (720 x 1280), then made
  // into an MP4 in a hidden WebView (StoryVideoMaker), then shared.
  const videoRefs = useRef([]);
  const [video, setVideo] = useState(null); // null, { phase: "frames" } or { phase: "encode", frames }
  const [videoStatus, setVideoStatus] = useState("");
  const makeVideo = () => { if (video) return; setVideoStatus("Getting your slides ready…"); setVideo({ phase: "frames" }); };
  useEffect(() => {
    if (video?.phase !== "frames") return undefined;
    let alive = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 900)); // let the posters load
      const frames = [];
      for (const ref of videoRefs.current.slice(0, slides.length)) {
        if (!alive) return;
        if (ref) frames.push(await captureRef(ref, { format: "jpg", quality: 0.9, result: "base64", width: 720, height: 1280 }));
      }
      if (alive) { setVideo({ phase: "encode", frames }); setVideoStatus("Making video… 0%"); }
    })().catch(() => { if (alive) { setVideo(null); setVideoStatus("Couldn't make the video. Try again."); } });
    return () => { alive = false; };
  }, [video?.phase]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once per request
  const videoDone = async ({ uri, h264, audio }) => {
    setVideo(null);
    const notes = [!h264 && "made without H.264, so Instagram may not take it", !audio && "no music: this phone can't encode audio"].filter(Boolean);
    setVideoStatus(notes.length ? `Video made (${notes.join("; ")}).` : "");
    try { await Sharing.shareAsync(uri, { mimeType: "video/mp4", dialogTitle: "Share your Rewind video" }); } catch { /* closed the share sheet */ }
  };
  const videoFailed = (message) => {
    setVideo(null);
    setVideoStatus(message === "NO_VIDEO" ? "This phone can't make videos. Use Share instead." : "Couldn't make the video. Try again.");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: BACKGROUNDS[i % BACKGROUNDS.length] }]} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <View style={styles.bars}>
          {slides.map((_, k) => <View key={k} style={[styles.bar, k <= i && { backgroundColor: "#fff" }]} />)}
        </View>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={12} accessibilityLabel="Close">
          <Text style={{ color: "#fff", fontSize: 22 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.years}>
        {years.map((y) => (
          <TouchableOpacity key={y} onPress={() => setYear(y)} style={[styles.yearBtn, y === year && { backgroundColor: "#fff" }]}>
            <Text style={{ color: y === year ? "#0b0f19" : "#cbd5e1", fontWeight: "800", fontSize: 12 }}>{wrappedLabel(y)}</Text>
          </TouchableOpacity>
        ))}
        {typeof year === "number" && (
          <TouchableOpacity onPress={() => navigation.navigate("RewindPick", { year })} style={[styles.yearBtn, { borderWidth: 1, borderColor: ORANGE }]}
            accessibilityHint={`Choose what counts in your ${year} Rewind`}>
            <Text style={{ color: ORANGE, fontWeight: "800", fontSize: 12 }}>Pick titles</Text>
          </TouchableOpacity>
        )}
      </View>
      {w && video?.phase === "frames" && (
        <View style={styles.offscreen} pointerEvents="none">
          <Reel w={w} slides={slides} refs={videoRefs} />
        </View>
      )}
      {video?.phase === "encode" && (
        <StoryVideoMaker frames={video.frames} width={720} height={1280} music
          onProgress={(p) => setVideoStatus(`Making video… ${Math.round(p * 100)}%`)} onDone={videoDone} onError={videoFailed} />
      )}
      {!w ? <VoidmonLoading text="Putting your year together…" textColor="#cbd5e1" style={{ marginTop: 60 }} /> : slide.kind === "summary" ? (
        <Summary w={w} onBack={() => go(-1)} onRestart={() => setI(0)} onVideo={makeVideo} videoBusy={!!video} videoStatus={videoStatus} />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.slide} key={`${year}-${i}`}>
            <Slide s={slide} />
          </ScrollView>
          {/* tap zones on top of the slide: left third back, the rest next */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={{ flex: 1, flexDirection: "row" }}>
              <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityLabel="Previous" />
              <Pressable style={{ flex: 2 }} onPress={() => go(1)} accessibilityLabel="Next" />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Slide({ s, compact = false }) {
  return (
    <View style={{ gap: 16 }}>
      {!!s.eyebrow && <Text style={styles.eyebrow}>{s.eyebrow.toUpperCase()}</Text>}
      {s.kind === "list" ? (
        <>
          {!!s.image && !compact && <Image source={{ uri: s.image }} style={styles.hero} />}
          {s.items.map(({ item, count, note }, n) => (
            <View key={item.id} style={styles.listRow}>
              <Text style={styles.rank}>{n + 1}</Text>
              {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.listSub}>{count ? `${count} ${s.unit}` : s.unit === "chapters" ? "Finished" : "Completed"}{note ? ` · ${note}` : ""}</Text>
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={[styles.big, s.color && { color: s.color }]}>{s.big}</Text>
      )}
      {s.rows && s.rows.map(([label, value]) => (
        <View key={label} style={styles.statRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {s.colors?.[label] && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.colors[label] }} />}
            <Text style={styles.statLabel}>{label}</Text>
          </View>
          <Text style={styles.statValue}>{value}</Text>
        </View>
      ))}
      {!!s.sub && <Text style={styles.sub}>{s.sub}</Text>}
    </View>
  );
}

// The end of the story: the card, Share (the card as an image) and Share as video.
function Summary({ w, onBack, onRestart, onVideo, videoBusy, videoStatus }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try { await shareCardImage(ref); } catch { notify("Oops", "Could not create the image."); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={[styles.slide, { alignItems: "center" }]}>
      <SummaryCard w={w} refIn={ref} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 18 }}>
        <TouchableOpacity style={styles.btn} onPress={onBack}><Text style={styles.btnText}>Back</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onRestart}><Text style={styles.btnText}>Again</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, videoBusy && { opacity: 0.6 }]} onPress={onVideo} disabled={videoBusy}><Text style={styles.btnText}>{videoBusy ? "Making…" : "Share as video"}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: PURPLE, borderColor: PURPLE }]} onPress={share}>
          <Text style={styles.btnText}>{busy ? "Preparing…" : "Share"}</Text>
        </TouchableOpacity>
      </View>
      {!!videoStatus && <Text style={[styles.sub, { marginTop: 12, textAlign: "center" }]} accessibilityLiveRegion="polite">{videoStatus}</Text>}
    </ScrollView>
  );
}

// The video's slides in the anime-carousel style (shared/reel.js): number,
// two-colour headline, a short line, one of your top titles large on the
// right with a glow in its colour. 360 x 640, captured at 720 x 1280.
function Reel({ w, slides, refs }) {
  const { accent, glow, frames } = reelSlides(w, slides);
  return frames.map((f, k) => (
    <View key={k} ref={(el) => { refs.current[k] = el; }} collapsable={false} style={styles.reel}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 640">
        <Defs>
          <RadialGradient id={`g${k}`} cx="280" cy="350" r="260" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={glow.replace(/rgba\((.*),[^,]*\)/, "rgb($1)")} stopOpacity="0.55" />
            <Stop offset="1" stopColor="#06080d" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="640" fill="#07090e" />
        <Rect x="0" y="0" width="360" height="640" fill={`url(#g${k})`} />
      </Svg>
      {f.summary ? (
        <View style={{ position: "absolute", left: 22, right: 22, top: 60, bottom: 90, justifyContent: "center" }}>
          <SummaryCard w={w} />
        </View>
      ) : (
        <>
          {!!f.hero && <Image source={{ uri: f.hero }} style={styles.reelHero} />}
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 640" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={`s${k}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#06080d" stopOpacity="0.97" />
                <Stop offset="0.42" stopColor="#06080d" stopOpacity="0.85" />
                <Stop offset="0.75" stopColor="#06080d" stopOpacity="0.15" />
                <Stop offset="1" stopColor="#06080d" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="360" height="640" fill={`url(#s${k})`} />
          </Svg>
          <View style={styles.reelText}>
            {!!f.eyebrow && <Text style={[styles.reelEyebrow, { color: accent }]}>{f.eyebrow.toUpperCase()}</Text>}
            {!!f.white && <Text style={styles.reelHead}>{f.white.toUpperCase()}</Text>}
            <Text style={[styles.reelHead, { color: accent }]}>{f.colored.toUpperCase()}</Text>
            <View style={[styles.reelRule, { backgroundColor: accent }]} />
            {f.items && f.items.map(({ item, count }, n) => (
              <View key={item.id} style={{ flexDirection: "row", gap: 6, marginBottom: 7 }}>
                <Text style={{ color: accent, fontWeight: "900", fontSize: 13 }}>{n + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
                  {!!count && <Text style={{ color: "#9ca3af", fontSize: 11 }}>{count} {f.unit}</Text>}
                </View>
              </View>
            ))}
            {f.rows && f.rows.map(([label, value]) => (
              <View key={label} style={styles.reelRow}>
                <Text style={{ color: "#d1d5db", fontSize: 13 }}>{label}</Text>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>{value}</Text>
              </View>
            ))}
            {!!f.sub && <Text style={styles.reelSub}>{f.sub}</Text>}
          </View>
          {!!f.thumb && <Image source={{ uri: f.thumb }} style={styles.reelThumb} />}
        </>
      )}
      <View style={styles.reelTag}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{f.num}</Text></View>
      <View style={styles.reelFoot}>
        <Voidmon pose="peeking" size={110} />
        <Text style={styles.reelBrand}>VOID<Text style={{ color: accent }}>ATION</Text> REWIND · {w.label.toUpperCase()}</Text>
      </View>
    </View>
  ));
}

// The shareable card: your #1 anime's poster, top 5, top genres, episodes, time.
function SummaryCard({ w, refIn }) {
  const hero = w.topAnime[0]?.item || w.topManga[0]?.item;
  const list = w.topAnime.length ? w.topAnime : w.topManga;
  const timeLabel = w.allTime || !w.episodes ? "Completed & finished" : w.minutes < 90 ? "Minutes" : "Hours";
  const timeValue = w.allTime || !w.episodes ? w.completed.toLocaleString() : w.minutes < 90 ? Math.round(w.minutes) : w.hours.toLocaleString();
  return (
      <View ref={refIn} collapsable={false} style={styles.card}>
        <View style={styles.cardHero}>
          <Text style={[styles.cardYear, w.allTime && { fontSize: 38 }]}>{w.label}</Text>
          {hero?.image ? <Image source={{ uri: hero.image }} style={styles.cardPoster} /> : null}
        </View>
        <View style={{ padding: 18, gap: 16 }}>
          <View style={styles.cols}>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>{w.topAnime.length ? "Top anime" : "Top manga"}</Text>
              {list.map(({ item }, n) => (
                <Text key={item.id} style={styles.cardItem} numberOfLines={1}><Text style={{ color: PURPLE }}>{n + 1} </Text>{item.title}</Text>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>Top genres</Text>
              {w.genres.slice(0, 5).map((g, n) => (
                <Text key={g.name} style={styles.cardItem} numberOfLines={1}><Text style={{ color: PURPLE }}>{n + 1} </Text>{g.name}</Text>
              ))}
            </View>
          </View>
          <View style={styles.cols}>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>{w.episodes ? "Episodes watched" : "Chapters read"}</Text>
              <Text style={styles.cardNum}>{(w.episodes || w.chapters).toLocaleString()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.small}>{timeLabel}</Text>
              <Text style={styles.cardNum}>{timeValue}</Text>
            </View>
          </View>
          <Text style={styles.brand}>VOID<Text style={{ color: ORANGE }}>ATION</Text> · REWIND</Text>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  bars: { flex: 1, flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  years: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  yearBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.1)" },
  slide: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 60 },
  eyebrow: { color: ORANGE, fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  big: { color: "#f3f4f6", fontSize: 46, fontWeight: "900", lineHeight: 50 },
  sub: { color: "#cbd5e1", fontSize: 16, lineHeight: 23 },
  hero: { width: 130, aspectRatio: 2 / 3, borderRadius: 14 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 26, color: PURPLE, fontSize: 22, fontWeight: "900", textAlign: "center" },
  thumb: { width: 36, height: 52, borderRadius: 6 },
  listTitle: { color: "#f3f4f6", fontSize: 16, fontWeight: "800" },
  listSub: { color: "#9ca3af", fontSize: 13 },
  statRow: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  statLabel: { color: "#cbd5e1", fontSize: 15 },
  statValue: { color: "#f3f4f6", fontSize: 15, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  card: { width: "100%", maxWidth: 360, borderRadius: 22, overflow: "hidden", backgroundColor: "#150d26", borderWidth: 1, borderColor: PURPLE },
  cardHero: { height: 220, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardYear: { position: "absolute", left: 10, top: 0, fontSize: 70, fontWeight: "900", color: "rgba(11,15,25,0.3)" },
  cardPoster: { height: 190, aspectRatio: 2 / 3, borderRadius: 12 },
  cols: { flexDirection: "row", gap: 14 },
  small: { color: "#9ca3af", fontSize: 11, marginBottom: 4 },
  cardItem: { color: "#f3f4f6", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  cardNum: { color: "#f3f4f6", fontSize: 30, fontWeight: "900" },
  brand: { color: "#f3f4f6", fontSize: 12, fontWeight: "900", letterSpacing: 2, textAlign: "right" },
  btn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  btnText: { color: "#fff", fontWeight: "800" },
  reel: { width: 360, height: 640, overflow: "hidden", backgroundColor: "#07090e" },
  reelHero: { position: "absolute", right: -40, bottom: 70, width: 260, height: 390, borderRadius: 22 },
  reelText: { position: "absolute", left: 22, top: 70, width: 215 },
  reelEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  reelHead: { color: "#fff", fontSize: 40, fontWeight: "900", lineHeight: 44, letterSpacing: -0.5 },
  reelRule: { width: 70, height: 3, borderRadius: 2, marginTop: 14, marginBottom: 12 },
  reelRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  reelSub: { color: "#d1d5db", fontSize: 13, lineHeight: 19, marginTop: 10 },
  reelThumb: { position: "absolute", left: 22, bottom: 96, width: 74, height: 50, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  reelTag: { position: "absolute", left: 22, top: 22, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  reelFoot: { position: "absolute", left: 0, right: 0, bottom: 14, alignItems: "center" },
  reelBrand: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 8 },
  offscreen: { position: "absolute", left: -10000, top: 0 },
});
