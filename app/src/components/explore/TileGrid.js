// The Explore grid: one coloured tile per category, with a tilted cover in the
// corner (like Spotify's Search page). The titles are fixed; the cover is the
// first show of the tile's current picks. Tapping a tile opens its category.
import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { TILES, viewTile } from "@voidpop/shared/features/exploreTiles";

const GAP = 12;
const PAD = 14;

function Tile({ v, width, onPress }) {
  const cover = v.items?.[0];
  const src = cover ? cover.imageSmall || cover.image : null;
  const empty = !v.loading && !v.items?.length;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${v.title}${v.subtitle ? `, ${v.subtitle}` : ""}. Opens the list`}
      style={({ pressed }) => [styles.tile, { width, backgroundColor: v.color }, empty && { opacity: 0.7 }, pressed && { opacity: 0.85 }]}>
      <Text style={[styles.title, v.title.length > 26 && { fontSize: 14 }]} numberOfLines={4}>{v.title}</Text>
      {v.subtitle ? <Text style={styles.sub} numberOfLines={2}>{v.subtitle}</Text> : null}
      {src ? <Image source={{ uri: src }} style={styles.cover} resizeMethod="resize" accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </Pressable>
  );
}

// keys: which tiles to show, in order (default: all of them)
export default function TileGrid({ state, onOpen, keys }) {
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const w = (width - PAD * 2 - GAP * (columns - 1)) / columns;
  const views = useMemo(() => (keys || TILES.map((t) => t.key)).map((k) => viewTile(k, state)), [state, keys]);
  return (
    <View style={styles.grid}>
      {views.map((v) => <Tile key={v.key} v={v} width={w} onPress={() => onOpen(v.key)} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: PAD, paddingTop: 16 },
  tile: { height: 104, borderRadius: 10, padding: 12, overflow: "hidden" },
  title: { color: "#fff", fontWeight: "800", fontSize: 16, lineHeight: 20, maxWidth: "66%" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 4, maxWidth: "62%" },
  cover: { position: "absolute", right: -12, bottom: -6, width: 66, height: 94, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.2)", transform: [{ rotate: "25deg" }] },
});
