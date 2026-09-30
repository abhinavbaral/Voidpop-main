// A horizontal scrolling row of posters with a section title — the building
// block of the Explore page (Talk of the Week, Don't Miss This, etc).
// Desktop: bigger cards plus ‹ › buttons, since a plain mouse wheel can't
// scroll sideways.

import { useRef, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Platform } from "react-native";
import Card from "./Card.js";
import Skeleton from "./Skeleton.js";
import { useTheme } from "../context/ThemeContext.js";
import { useIsWide } from "../lib/layout";

// A row with fewer titles than this looks empty, so it isn't shown at all.
export const MIN_ROW = 4;

export default function PosterRow({ title, items, loading, onOpen, dot }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const wide = useIsWide();
  const cardW = wide ? 168 : 130;
  const listRef = useRef(null);
  const [x, setX] = useState(0);
  const [viewW, setViewW] = useState(0);
  const [contentW, setContentW] = useState(0);

  const page = (dir) => {
    const next = Math.max(0, Math.min(contentW - viewW, x + dir * viewW * 0.85));
    listRef.current?.scrollToOffset({ offset: next, animated: true });
  };
  const canLeft = x > 4;
  const canRight = x + viewW < contentW - 4;
  if (!loading && (items?.length || 0) < MIN_ROW) return null;

  return (
    <View style={{ marginTop: wide ? 26 : 18 }}>
      <View style={styles.head}>
        <Text style={[styles.title, wide && { fontSize: 19 }]}>{dot ? <Text style={{ color: dot }}>● </Text> : null}{title}</Text>
        {wide && !loading && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[["‹", -1, canLeft], ["›", 1, canRight]].map(([glyph, dir, enabled]) => (
              <Pressable
                key={glyph}
                disabled={!enabled}
                onPress={() => page(dir)}
                accessibilityLabel={dir < 0 ? `Scroll ${title} left` : `Scroll ${title} right`}
                style={({ hovered }) => [styles.arrow, hovered && enabled && styles.arrowHover, !enabled && { opacity: 0.3 }]}
              >
                <Text style={styles.arrowText}>{glyph}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {loading ? (
        <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
          {Array.from({ length: wide ? 6 : 3 }, (_, i) => (
            <Skeleton key={i} width={cardW - 10} height={cardW * 1.5 + 64} style={{ margin: 6 }} />
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          horizontal
          data={items}
          keyExtractor={(i) => `${i.segment}-${i.id}`}
          showsHorizontalScrollIndicator={Platform.OS === "web" && wide}
          contentContainerStyle={{ paddingHorizontal: 8 }}
          onScroll={(e) => setX(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={32}
          onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
          onContentSizeChange={(w) => setContentW(w)}
          renderItem={({ item }) => (
            <Card item={item} width={cardW} onPress={() => onOpen(item)} />
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  head: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, marginBottom: 4,
  },
  title: { color: C.text, fontWeight: "800", fontSize: 16 },
  arrow: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, alignItems: "center", justifyContent: "center",
  },
  arrowHover: { borderColor: C.purple },
  arrowText: { color: C.text, fontSize: 20, lineHeight: 22, fontWeight: "700" },
});
