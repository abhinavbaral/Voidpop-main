// EXPLORE — the homepage.
// Sections: Talk of the Week, Don't Miss This (Anime / Manga), and daily
// Voidation Recommendations (6 anime, 4 manga). Picks rotate each day.

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PosterRow from "../components/PosterRow.js";
import Brand from "../components/Brand.js";
import { loadExplorePools, buildExplore, knownKeys, loadVerdictRows, loadNewSeasons } from "@voidation/shared/explore";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";
import { useIsWide } from "../lib/layout";

export default function ExploreScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const wide = useIsWide();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [verdictRows, setVerdictRows] = useState([]);
  const [newSeasons, setNewSeasons] = useState([]);

  // your verdicts change as you use the app, so these rows refresh on every visit
  useFocusEffect(useCallback(() => {
    loadVerdictRows().then(setVerdictRows).catch(() => {});
    loadNewSeasons().then(setNewSeasons).catch(() => {});
  }, []));

  const [pools, setPools] = useState(null);
  useEffect(() => {
    // same sections, same daily picks as the website
    loadExplorePools()
      .then(setPools)
      .catch(() => setLoading(false));
  }, []);
  // anything you add to your library disappears from Explore when you come back
  useFocusEffect(useCallback(() => {
    if (!pools) return;
    knownKeys().then((known) => { setData(buildExplore(pools, known)); setLoading(false); }).catch(() => {});
  }, [pools]));

  const open = (item) => openDetail(navigation, item);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {!wide && (
        <View style={styles.header}>
          <Brand size={20} />
          <TouchableOpacity
            onPress={() => navigation.navigate("Search")}
            style={styles.searchBtn}
          >
            <Text style={{ color: C.faint, fontSize: 13 }}>
              Search anime and manga...
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {newSeasons.length > 0 && <PosterRow title="🆕 New seasons of shows you watched" items={newSeasons} onOpen={open} />}
        {data.coming?.length > 0 && <PosterRow title={`📅 ${data.comingTitle}`} items={data.coming} onOpen={open} />}
        {verdictRows.map((r) => (
          <PosterRow key={r.verdict} title={r.title} dot={r.color} items={r.items} onOpen={open} />
        ))}
        <PosterRow title="🔥 Talk of the Week" items={data.talk} loading={loading} onOpen={open} />
        <PosterRow title="🎌 Don't Miss This — Anime" items={data.dontMissAnime} loading={loading} onOpen={open} />
        <PosterRow title="📖 Don't Miss This — Manga" items={data.dontMissManga} loading={loading} onOpen={open} />
        <PosterRow title="⭐ Voidation Recommendations" items={data.voidpicks} loading={loading} onOpen={open} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 14, paddingTop: 8 },
  brand: { color: C.text, fontSize: 22, fontWeight: "800" },
  searchBtn: {
    marginTop: 10, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card,
    justifyContent: "center", paddingHorizontal: 14,
  },
});
