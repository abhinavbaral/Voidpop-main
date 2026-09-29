// A voice actor's or staff member's page: photo, name, occupations, then every
// character they voiced (newest first) and their staff work. Tap a poster to
// open that title.
import { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchPerson } from "@voidation/shared/api/anilist";
import { yearOf } from "@voidation/shared/format";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail, goBackOrHome } from "../lib/nav";

export default function PersonScreen({ route, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { id, name } = route.params || {};
  const [p, setP] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchPerson(id).then((r) => alive && (r ? setP(r) : setError(true))).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [id]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={10}>
          <Text style={{ color: C.purple }}>← Back</Text>
        </TouchableOpacity>
        {!p ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            {error ? <Text style={styles.note}>Couldn't load {name || "this person"}. Check your connection.</Text> : <ActivityIndicator color={C.orange} />}
          </View>
        ) : (
          <>
            <View style={styles.head}>
              {p.image ? <Image source={{ uri: p.image }} style={styles.photo} /> : <View style={[styles.photo, { backgroundColor: C.border }]} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                {!!p.native && <Text style={styles.note}>{p.native}</Text>}
                <Text style={[styles.note, { marginTop: 6 }]}>{[...p.occupations, p.language].filter(Boolean).join(" · ")}</Text>
                <Text style={[styles.note, { marginTop: 2 }]}>
                  {[p.roles.length ? `${p.roles.length} roles` : null, p.work.length ? `${p.work.length} staff credits` : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>

            {p.roles.length > 0 && <Text style={styles.section}>Voice roles</Text>}
            {p.roles.map((r, i) => (
              <TouchableOpacity key={`${r.character.id}-${r.item.id}-${i}`} style={styles.row} onPress={() => openDetail(navigation, r.item)}>
                {r.character.image ? <Image source={{ uri: r.character.image }} style={styles.charImg} /> : <View style={[styles.charImg, { backgroundColor: C.border }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{r.character.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{r.role} · {r.item.title}{yearOf(r.item) ? ` (${yearOf(r.item)})` : ""}</Text>
                </View>
                {r.item.image ? <Image source={{ uri: r.item.image }} style={styles.poster} /> : null}
              </TouchableOpacity>
            ))}

            {p.work.length > 0 && <Text style={styles.section}>Staff work</Text>}
            {p.work.map((w, i) => (
              <TouchableOpacity key={`${w.item.id}-${i}`} style={styles.row} onPress={() => openDetail(navigation, w.item)}>
                {w.item.image ? <Image source={{ uri: w.item.image }} style={styles.charImg} /> : <View style={[styles.charImg, { backgroundColor: C.border }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{w.item.title}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{w.role}{yearOf(w.item) ? ` · ${yearOf(w.item)}` : ""}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <Text style={[styles.note, { marginTop: 16 }]}>From AniList.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", gap: 14, marginTop: 14, alignItems: "center" },
  photo: { width: 96, height: 128, borderRadius: 10 },
  name: { color: C.text, fontSize: 20, fontWeight: "800" },
  note: { color: C.faint, fontSize: 12 },
  section: { color: C.text, fontSize: 15, fontWeight: "800", marginTop: 22, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  charImg: { width: 40, height: 54, borderRadius: 6 },
  poster: { width: 34, height: 48, borderRadius: 4 },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
});
