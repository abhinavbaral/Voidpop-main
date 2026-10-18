// One row of History, like YouTube's: a wide thumbnail with a badge and a progress bar at the
// bottom, the title and a few grey lines, a ⋮ button, and swipe left to reveal a trash can.
import { useRef } from "react";
import { View, Text, Image, Pressable, Animated, PanResponder, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Path, Polyline } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext.js";

const PANEL = 96; // width of the trash panel

function Trash({ color = "#111", size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </Svg>
  );
}

export default function HistoryRow({ x, lines, badge, onOpen, onMenu, onRemove }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { width } = useWindowDimensions();
  const thumbW = Math.min(190, Math.round(width * 0.44));
  const thumbH = Math.round((thumbW * 9) / 16);
  const shift = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const slide = (to) => {
    open.current = to !== 0;
    Animated.timing(shift, { toValue: to, duration: 160, useNativeDriver: true }).start();
  };
  const pan = useRef(PanResponder.create({
    // only a mostly sideways drag: up and down still scrolls the list
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => shift.setValue(Math.max(-PANEL, Math.min(0, (open.current ? -PANEL : 0) + g.dx))),
    onPanResponderRelease: (_, g) => slide((open.current ? -PANEL : 0) + g.dx < -PANEL / 2 ? -PANEL : 0),
    onPanResponderTerminate: () => slide(open.current ? -PANEL : 0),
  })).current;

  const src = x.item.banner || x.item.image;
  return (
    <View style={styles.wrap}>
      <Pressable style={styles.panel} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${x.item.title} from history`}>
        <Trash />
      </Pressable>
      <Animated.View style={[styles.row, { backgroundColor: C.bg, transform: [{ translateX: shift }] }]} {...pan.panHandlers}>
        <Pressable onPress={() => (open.current ? slide(0) : onOpen())} style={styles.main} accessibilityRole="button"
          accessibilityLabel={`${x.item.title}. ${lines.join(". ")}`} accessibilityHint="Swipe left or use the menu to remove from history">
          <View style={{ width: thumbW, height: thumbH, borderRadius: 10, overflow: "hidden", backgroundColor: C.border }}>
            {src ? <Image source={{ uri: src }} style={{ width: thumbW, height: thumbH }} resizeMode="cover" resizeMethod="resize" /> : null}
            <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((x.fraction || 0) * 100)}%` }]} /></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={3}>{x.item.title}</Text>
            {lines.filter(Boolean).map((l, i) => <Text key={i} style={styles.sub} numberOfLines={1}>{l}</Text>)}
          </View>
        </Pressable>
        <Pressable onPress={onMenu} hitSlop={8} style={styles.dots} accessibilityRole="button" accessibilityLabel={`More for ${x.item.title}`}>
          <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: { overflow: "hidden" },
  panel: { position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL, backgroundColor: "#e6e6e6", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  main: { flex: 1, flexDirection: "row", gap: 12 },
  badge: { position: "absolute", right: 6, bottom: 8, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  fill: { height: 3, backgroundColor: C.purple },
  title: { color: C.text, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  sub: { color: C.faint, fontSize: 13, lineHeight: 19, marginTop: 1 },
  dots: { paddingHorizontal: 6, paddingVertical: 4, gap: 3, alignItems: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.text },
});
