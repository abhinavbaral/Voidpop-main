// VOIDATION WRAPPED — full-screen story slides of your year, ending on a card
// you can share. Tap the right side for next, left side for back.
// Everything comes from your own watch log (shared/wrapped.js).
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Image, Pressable, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadWrapped, wrappedSlides, wrappedYears, defaultWrapped, wrappedLabel } from "@voidation/shared/wrapped";
import { shareCardImage } from "../lib/shareCard";
import { notify } from "../lib/notify";
import { goBackOrHome } from "../lib/nav";
import { VoidmonLoading } from "../components/Voidmon.js";

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
      {!w ? <VoidmonLoading text="Putting your year together…" textColor="#cbd5e1" style={{ marginTop: 60 }} /> : slide.kind === "summary" ? (
        <Summary w={w} onBack={() => go(-1)} onRestart={() => setI(0)} />
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

function Slide({ s }) {
  return (
    <View style={{ gap: 16 }}>
      {!!s.eyebrow && <Text style={styles.eyebrow}>{s.eyebrow.toUpperCase()}</Text>}
      {s.kind === "list" ? (
        <>
          {!!s.image && <Image source={{ uri: s.image }} style={styles.hero} />}
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

// The shareable card: your #1 anime's poster, top 5, top genres, episodes, time.
function Summary({ w, onBack, onRestart }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const hero = w.topAnime[0]?.item || w.topManga[0]?.item;
  const list = w.topAnime.length ? w.topAnime : w.topManga;
  const share = async () => {
    if (busy) return;
    setBusy(true);
    try { await shareCardImage(ref); } catch { notify("Oops", "Could not create the image."); } finally { setBusy(false); }
  };
  const timeLabel = w.allTime || !w.episodes ? "Completed & finished" : w.minutes < 90 ? "Minutes" : "Hours";
  const timeValue = w.allTime || !w.episodes ? w.completed.toLocaleString() : w.minutes < 90 ? Math.round(w.minutes) : w.hours.toLocaleString();
  return (
    <ScrollView contentContainerStyle={[styles.slide, { alignItems: "center" }]}>
      <View ref={ref} collapsable={false} style={styles.card}>
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
      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        <TouchableOpacity style={styles.btn} onPress={onBack}><Text style={styles.btnText}>Back</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onRestart}><Text style={styles.btnText}>Again</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: PURPLE, borderColor: PURPLE }]} onPress={share}>
          <Text style={styles.btnText}>{busy ? "Preparing…" : "Share image"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
});
