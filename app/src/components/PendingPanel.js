// WATCHING THIS SEASON — your Watching anime that are airing (or that you're
// behind on), with a Pending count: episodes that are out but not watched yet.
// New episodes add to it automatically; +1 takes one off.
import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { getPending, setProgress, setStatus, addReview, onDataChange, totalFor } from "@voidation/shared/backend/store";
import { formatCountdown } from "@voidation/shared/format";
import VerdictModal from "./VerdictModal.js";
import { useTheme } from "../context/ThemeContext.js";

export default function PendingPanel({ now, refreshKey, onOpen }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [finishing, setFinishing] = useState(null);
  const load = useCallback(() => getPending().then(setData).catch(() => {}), []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => onDataChange(load), [load]);
  const minute = Math.floor(now / 60000); // an episode airing now moves into Pending by itself
  useEffect(() => { load(); }, [minute, load]);

  if (!data || !data.items.length) return null;

  const plus = async (entry) => {
    const r = await setProgress(user, entry.item, (entry.progress || 0) + 1, "plus");
    if (r.reachedEnd) setFinishing(entry.item);
  };
  const finish = async ({ verdict, vibes, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, comment });
    setFinishing(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>📺 Watching this season</Text>
        <Text style={[styles.total, data.total > 0 && { color: C.orange }]}>
          {data.total ? `${data.total} pending` : "All caught up"}
        </Text>
      </View>
      {data.items.map(({ entry, pending }) => {
        const it = entry.item;
        const next = it.nextEpisode && it.nextEpisode.airingAt > now / 1000 ? it.nextEpisode : null;
        return (
          <View key={it.id} style={styles.row}>
            <TouchableOpacity style={styles.rowMain} onPress={() => onOpen(it)}>
              {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{it.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  Watched {entry.progress || 0}{totalFor(it) ? ` of ${totalFor(it)}` : ""}
                  {next ? ` · Ep ${next.episode} in ${formatCountdown(next.airingAt, now)}` : ""}
                </Text>
              </View>
            </TouchableOpacity>
            {pending > 0 ? (
              <>
                <Text style={styles.chip}>{pending} pending</Text>
                <TouchableOpacity onPress={() => plus(entry)} style={styles.plus} hitSlop={6}
                  accessibilityLabel={`Watched episode ${(entry.progress || 0) + 1} of ${it.title}`}>
                  <Text style={styles.plusText}>+1</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.caught}>Caught up ✓</Text>
            )}
          </View>
        );
      })}
      {finishing && <VerdictModal visible initial={null} onSave={finish} onClose={() => setFinishing(null)} />}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: { marginHorizontal: 14, marginTop: 14, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 4 },
  title: { color: C.text, fontWeight: "800", fontSize: 15 },
  total: { color: C.green, fontWeight: "800", fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 36, height: 50, borderRadius: 6, backgroundColor: C.border },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  chip: { color: C.orange, fontSize: 11, fontWeight: "800" },
  plus: { borderWidth: 1, borderColor: C.purple, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6 },
  plusText: { color: C.purple, fontWeight: "800", fontSize: 13 },
  caught: { color: C.green, fontSize: 11, fontWeight: "800" },
});
