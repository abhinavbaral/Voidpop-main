// One playlist in Your Library: ONE cover (the show you touched last), its name and
// "Playlist • owner • N titles". A list row, or a tile in the grid layout.
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";
import Icon from "../ui/Icon.js";

export function PlaylistCover({ cover, size = 64, kind = "anime", radius = 6 }) {
  const { C } = useTheme();
  const box = { width: size, height: size, borderRadius: radius, overflow: "hidden", backgroundColor: C.card };
  if (cover) return <View style={box}><Image source={{ uri: cover }} style={{ width: size, height: size }} resizeMode="cover" resizeMethod="resize" /></View>;
  return (
    <View style={[box, { alignItems: "center", justifyContent: "center" }]}>
      <Icon name={{ anime: "tv", manga: "book", novel: "novel" }[kind]} size={Math.round(size * 0.4)} color={C.faint} />
    </View>
  );
}

export default function PlaylistItem({ playlist: p, kind, grid = false, width, onPress }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const sub = `Playlist • ${p.owner} • ${p.count} ${p.count === 1 ? "title" : "titles"}`;
  const label = `${p.name}. ${sub}`;
  if (grid) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ width }, pressed && { opacity: 0.8 }]}>
        <PlaylistCover cover={p.cover} size={width} kind={kind} />
        <Text style={[styles.name, { marginTop: 8 }]} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
      <PlaylistCover cover={p.cover} size={64} kind={kind} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (C) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8, paddingHorizontal: 14 },
  name: { color: C.text, fontSize: 16, fontWeight: "700" },
  sub: { color: C.faint, fontSize: 13, marginTop: 2 },
});
