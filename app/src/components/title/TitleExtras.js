// Extra sections for a title page:
//   WatchOrder    the franchise in release order (anime), with your status
//   Discussions   AniList forum threads, opening in the browser
import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchWatchOrder } from "@voidpop/shared/api/anilist";
import { getLibrary, statusesFor } from "@voidpop/shared/backend/store";
import { yearOf } from "@voidpop/shared/lib/format";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";

const FORMAT = { TV: "TV", TV_SHORT: "TV short", MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special" };

// Watch order on every anime's page (and in Browse → Watch order, where
// `finder` makes every row tappable and drops "You're here").
export function WatchOrder({ item, navigation, finder = false }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [list, setList] = useState(null);
  const [lib, setLib] = useState({});
  useEffect(() => { let alive = true; fetchWatchOrder(item.id).then((l) => alive && setList(l)).catch(() => alive && setList([])); return () => { alive = false; }; }, [item.id]);
  useFocusEffect(useCallback(() => { getLibrary().then(setLib).catch(() => {}); }, []));
  if (!list) return null;
  const label = (k) => statusesFor("anime").find((s) => s.key === k)?.label;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.title}>Watch order</Text>
      {list.length < 2 && <Text style={styles.faint}>Just this one so far: no other seasons, movies or specials.</Text>}
      {list.map((it, i) => {
        const here = !finder && it.id === item.id;
        const status = lib[`anime:${it.id}`]?.status;
        return (
          <TouchableOpacity key={it.id} disabled={here} onPress={() => openDetail(navigation, it)} style={[styles.row, here && { backgroundColor: C.card }]}>
            <Text style={styles.num}>{i + 1}</Text>
            {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: C.border }]} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, here && { color: C.purple }]} numberOfLines={2}>{it.title}</Text>
              <Text style={styles.faint}>{[it.orderLabel, FORMAT[it.format] || it.format, yearOf(it), here ? "You're here" : null].filter(Boolean).join(" · ")}</Text>
            </View>
            {status ? <Text style={styles.status}>{label(status)}</Text> : null}
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.faint, { marginTop: 6 }]}>In release order. Recaps and remakes are left out.</Text>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  title: { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 6 },
  faint: { color: C.faint, fontSize: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8 },
  num: { color: C.faint, fontWeight: "800", width: 18, textAlign: "right" },
  thumb: { width: 34, height: 48, borderRadius: 5 },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  status: { color: C.orange, fontSize: 11, fontWeight: "800" },
});
