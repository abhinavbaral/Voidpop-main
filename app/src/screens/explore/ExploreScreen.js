import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Brand from "../../components/brand/Brand.js";
import { buildExplore } from "@voidpop/shared/features/explore";
import { billboardPick } from "@voidpop/shared/features/exploreMix";
import { GRID_KEYS, ROW_KEYS, viewTile } from "@voidpop/shared/features/exploreTiles";
import { greetingFor } from "@voidpop/shared/lib/greeting";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import NamePrompt from "../../components/welcome/NamePrompt.js";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import { useIsWide } from "../../utils/layout";
import Icon from "../../components/ui/Icon.js";
import AnimatedBanner from "../../components/brand/AnimatedBanner.js";
import { NewEpisodeCards, Countdowns } from "../../components/explore/ExploreCards.js";
import Billboard from "../../components/explore/Billboard.js";
import TileGrid from "../../components/explore/TileGrid.js";
import { useExplore, initExplore, refreshPersonal, rerollAll } from "../../state/explore";
import PosterRow from "../../components/ui/PosterRow.js";

export default function ExploreScreen({ navigation }) {
  const { C, dark } = useTheme();
  const styles = makeStyles(C);
  const wide = useIsWide();
  const { settings } = useSettings();
  const ex = useExplore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { initExplore(); }, []);
  // what's in your library and your verdicts change as you use the app, so these refresh on every visit
  useFocusEffect(useCallback(() => {
    refreshPersonal();
  }, []));

  const refresh = async () => {
    setRefreshing(true);
    try { await initExplore(); await rerollAll(); } catch { /* offline: keep what's shown */ }
    setRefreshing(false);
  };

  const open = (item) => openDetail(navigation, item);
  // the Billboard changes on every refresh: a trending anime, movie or TV series (never manga or a novel)
  const featured = useMemo(
    () => (ex.pools ? billboardPick(ex.pools, ex.billboardSeed) || buildExplore(ex.pools, ex.known).featured : null),
    [ex.pools, ex.known, ex.billboardSeed],
  );
  const openCategory = (key) => navigation.navigate("ExploreCategory", { key });
  const searchRow = (
    <View style={styles.header}>
      {/* search (everything) and Browse in one row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TouchableOpacity onPress={() => navigation.navigate("Search")} style={[styles.searchBtn, { flex: 1, marginTop: 0 }]} accessibilityRole="search">
          <Text style={{ color: C.faint, fontSize: 13 }} numberOfLines={1}>Search anime, manga, novels, movies, TV...</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Browse")} style={[styles.searchBtn, { marginTop: 0 }]} accessibilityRole="button">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="browse" size={14} color={C.text} /><Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>Browse</Text></View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const row = (key, render) => ({ key, render });
  const sections = [
    featured && row("billboard", () => <Billboard item={featured} onOpen={open} />),
    row("new-eps", () => <NewEpisodeCards onOpen={open} />),
    row("coming-up", () => <Countdowns onOpen={open} />),
    !wide && row("search", () => searchRow),
    row("tiles", () => <TileGrid state={ex} keys={GRID_KEYS} onOpen={openCategory} />),
    // poster rows below the tiles, each a mix of all five kinds
    ...ROW_KEYS.filter((key) => !viewTile(key, ex).hidden).map((key) => row(`row-${key}`, () => {
      const v = viewTile(key, ex);
      return <PosterRow title={v.title} items={v.items || undefined} loading={v.loading} onOpen={open} onMore={() => openCategory(key)} />;
    })),
  ].filter(Boolean);

  const header = !wide && (
    <>
    <View style={styles.hero}>
      {/* the same animated sky as More (sun by day, moon and stars by night) */}
      <View style={StyleSheet.absoluteFill}><AnimatedBanner accent={C.purple} dark={dark} height={170} /></View>
      <View style={styles.heroTop}><Brand size={20} /></View>
      <Text style={styles.hello} accessibilityRole="header">{greetingFor(new Date().getHours(), settings.name)}</Text>
    </View>
    </>
    ) || null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <NamePrompt />
      {/* One vertical list of rows, drawn only near the screen: rows (and their
          posters) appear as you scroll to them and are dropped once they're
          well above or below, so Explore never holds every poster at once. */}
      <FlatList
        data={sections}
        keyExtractor={(x) => x.key}
        renderItem={({ item: x }) => x.render()}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 30 }}
        initialNumToRender={4}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} colors={[C.purple]} />}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 14, paddingTop: 10 },
  hero: { height: 170, overflow: "hidden", justifyContent: "space-between", padding: 14, paddingBottom: 18 },
  heroTop: { flexDirection: "row", alignItems: "center" },
  hello: { color: "#fff", fontSize: 30, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  brand: { color: C.text, fontSize: 22, fontWeight: "800" },
  searchBtn: {
    marginTop: 10, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card,
    justifyContent: "center", paddingHorizontal: 14,
  },
});
