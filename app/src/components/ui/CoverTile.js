// FILE: app/src/components/ui/CoverTile.js — a cover at any size: the picture if there is one, else a coloured tile with the
// title (games and comics have no pictures yet), else a plain tile.
import { View, Text, Image } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function CoverTile({ item, width, height, radius = 12 }) {
  const { C } = useTheme();
  const src = item.imageSmall || item.image;
  const box = { width, height, borderRadius: radius, overflow: "hidden", backgroundColor: item.color || C.border };
  if (src) return <View style={box}><Image source={{ uri: src }} style={{ width, height }} resizeMode="cover" resizeMethod="resize" /></View>;
  return (
    <View style={[box, { padding: 8, justifyContent: "flex-end" }]}>
      {item.color ? <Text style={{ color: "#fff", fontWeight: "900", fontSize: Math.max(11, Math.round(width / 8)), lineHeight: Math.max(13, Math.round(width / 7)) }} numberOfLines={4}>{item.title}</Text> : null}
    </View>
  );
}
