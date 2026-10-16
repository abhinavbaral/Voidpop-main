// Filler guide on an anime's page: how much of it is filler, where the next filler
// block is, and (for titles in your library) a way to skip filler and anime-canon
// episodes. Skipped episodes count toward finishing but not as watched. Only shows
// when the filler database (shared/data/fillers.js) has this show.
import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getLibrary, skipEpisodes, unskipEpisodes, skippedOf, totalFor } from "@voidpop/shared/backend/store";
import { fillerFor, fillerSummary, blocksOf, nextBlock, countIn, FILLER_LABEL, SKIPPABLE, lastListed } from "@voidpop/shared/features/fillers";
import { useTheme } from "../../context/ThemeContext.js";

const SHOWN = 5; // blocks listed before "Show all"
const range = (b) => (b.from === b.to ? `${b.from}` : `${b.from}–${b.to}`);

export default function FillerGuide({ item, progress = 0 }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [entry, setEntry] = useState(null);
  const [all, setAll] = useState(false);
  const info = fillerFor(item);

  const read = useCallback(() => { getLibrary().then((lib) => setEntry(lib[`anime:${item.id}`] || null)).catch(() => {}); }, [item.id]);
  useFocusEffect(read);
  useEffect(() => { read(); }, [progress, read]);

  if (!info) return null;
  const colors = { filler: C.orange, animeCanon: "#22d3ee", mixed: "#eab308" };
  const total = totalFor(item) || lastListed(info);
  const sum = fillerSummary(info, item);
  const skipped = skippedOf(entry);
  const blocks = blocksOf(info, total);
  const next = nextBlock(info, progress, total);
  const canSkip = !!entry && entry.status !== "completed";
  const upcomingSkippable = blocks.filter((b) => SKIPPABLE.includes(b.type) && b.to > progress);
  const hasToSkip = upcomingSkippable.some((b) => countIn(skipped, Math.max(b.from, progress + 1), b.to) < b.to - Math.max(b.from, progress + 1) + 1);
  const hasSkippedAhead = countIn(skipped, progress + 1, 999999) > 0;
  const skippedTotal = countIn(skipped, 1, total);

  const act = async (fn) => { await fn(); read(); };
  const first = Math.max(0, blocks.findIndex((b) => b.to > progress));
  const ordered = [...blocks.slice(first), ...blocks.slice(0, first)]; // upcoming first, earlier ones after
  const listed = all ? ordered : ordered.slice(0, SHOWN);

  // the bar: the whole show left to right, filler coloured, with a marker where you are
  const segs = [];
  let pos = 1;
  blocks.forEach((b) => {
    if (b.from > pos) segs.push({ len: b.from - pos, color: C.border });
    segs.push({ len: b.to - b.from + 1, color: colors[b.type] });
    pos = b.to + 1;
  });
  if (total >= pos) segs.push({ len: total - pos + 1, color: C.border });

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Filler guide</Text>
      <Text style={styles.line}>
        {[`${sum.filler} filler`, sum.animeCanon ? `${sum.animeCanon} anime canon` : null, sum.mixed ? `${sum.mixed} mixed` : null].filter(Boolean).join(" · ")}
        {` of ${sum.total} episodes (${sum.percent}% filler)`}
      </Text>
      {sum.skippable > 0 && <Text style={styles.faint}>Skipping all the filler and anime canon would save about {sum.hours} hour{sum.hours === 1 ? "" : "s"}.</Text>}

      <View style={styles.bar} accessible accessibilityLabel={`Where the filler is across ${sum.total} episodes`}>
        {segs.map((s, i) => <View key={i} style={{ flex: s.len, backgroundColor: s.color }} />)}
        {progress > 0 && total > 0 && <View style={[styles.marker, { left: `${Math.min(100, (progress / total) * 100)}%`, backgroundColor: C.text }]} />}
      </View>
      <View style={styles.legend}>
        {["filler", sum.animeCanon ? "animeCanon" : null, sum.mixed ? "mixed" : null].filter(Boolean).map((t) => (
          <View key={t} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors[t] }]} /><Text style={styles.faint}>{FILLER_LABEL[t]}</Text></View>
        ))}
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: C.border }]} /><Text style={styles.faint}>Canon</Text></View>
      </View>

      {next && (
        <Text style={[styles.line, { marginTop: 10 }]}>
          {next.away > 0
            ? `Next to skip: ${FILLER_LABEL[next.type].toLowerCase()} episodes ${range(next)}, ${next.away} canon episode${next.away === 1 ? "" : "s"} away.`
            : `${FILLER_LABEL[next.type]} episodes ${range(next)} are next.`}
        </Text>
      )}
      {skippedTotal > 0 && <Text style={styles.faint}>You've skipped {skippedTotal} episode{skippedTotal === 1 ? "" : "s"} of this show. They count toward finishing but not as watched.</Text>}

      {canSkip && (hasToSkip || hasSkippedAhead) && (
        <View style={styles.actions}>
          {hasToSkip && (
            <TouchableOpacity style={styles.btn} onPress={() => act(() => skipEpisodes(item, progress + 1, 999999))} accessibilityRole="button">
              <Text style={styles.btnText}>Skip all upcoming filler</Text>
            </TouchableOpacity>
          )}
          {hasSkippedAhead && (
            <TouchableOpacity style={styles.btnQuiet} onPress={() => act(() => unskipEpisodes(item, progress + 1, 999999))} accessibilityRole="button">
              <Text style={styles.btnQuietText}>Unskip all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {listed.map((b) => {
        const lo = Math.max(b.from, progress + 1);
        const upcoming = b.to > progress;
        const len = b.to - b.from + 1;
        const done = countIn(skipped, b.from, b.to);
        const upcomingLen = upcoming ? b.to - lo + 1 : 0;
        const upcomingSkipped = upcoming ? countIn(skipped, lo, b.to) : 0;
        const skippable = SKIPPABLE.includes(b.type);
        return (
          <View key={`${b.type}${b.from}`} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: colors[b.type], marginTop: 5 }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{FILLER_LABEL[b.type]} · episodes {range(b)} ({len})</Text>
              <Text style={styles.faint}>
                {!upcoming ? (done === len ? "Skipped" : done ? `${done} skipped, the rest passed` : "Passed")
                  : upcomingSkipped === upcomingLen ? "Skipped"
                    : upcomingSkipped ? `${upcomingSkipped} of ${upcomingLen} skipped`
                      : skippable ? "Not skipped" : "Has real story: can't be skipped"}
              </Text>
            </View>
            {canSkip && upcoming && skippable && (
              upcomingSkipped === upcomingLen
                ? <TouchableOpacity onPress={() => act(() => unskipEpisodes(item, lo, b.to))} accessibilityRole="button" accessibilityLabel={`Unskip episodes ${range(b)}`}><Text style={styles.link}>Unskip</Text></TouchableOpacity>
                : <TouchableOpacity onPress={() => act(() => skipEpisodes(item, lo, b.to))} accessibilityRole="button" accessibilityLabel={`Skip episodes ${range(b)}`}><Text style={styles.link}>Skip</Text></TouchableOpacity>
            )}
          </View>
        );
      })}
      {ordered.length > SHOWN && (
        <TouchableOpacity onPress={() => setAll((v) => !v)} accessibilityRole="button"><Text style={[styles.link, { marginTop: 8 }]}>{all ? "Show fewer" : `Show all ${ordered.length} blocks`}</Text></TouchableOpacity>
      )}
      {!entry && <Text style={[styles.faint, { marginTop: 8 }]}>Add it to your library to skip episodes.</Text>}
      <Text style={[styles.faint, { marginTop: 8 }]}>Source: animefillerlist.com. Only filler and anime canon can be skipped.</Text>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  box: { marginTop: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, backgroundColor: C.card },
  title: { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 6 },
  line: { color: C.text, fontSize: 13, lineHeight: 19 },
  faint: { color: C.faint, fontSize: 11, lineHeight: 16, marginTop: 2 },
  bar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 10 },
  marker: { position: "absolute", top: 0, bottom: 0, width: 2 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  btn: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  btnQuiet: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnQuietText: { color: C.text, fontWeight: "800", fontSize: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  link: { color: C.purple, fontWeight: "800", fontSize: 12 },
});
