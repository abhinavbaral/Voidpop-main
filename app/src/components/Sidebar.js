// Slide-in filter panel for Browse. Type (Anime / Manga) as two big tiles,
// then each filter as tappable chips (Genres, Origin, Sort), Season as four
// tiles with the season's icon, Year as a sideways row. Changes apply
// instantly; tap outside or ✕ to close.
//   sections: [{ label, value, options: [{ key, label, icon? }], onSelect, layout?: "chips" | "tiles" | "row" }]

import { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  Animated, Pressable, StyleSheet, Dimensions,
} from "react-native";
import { useTheme } from "../context/ThemeContext.js";
import Icon from "./Icon.js";

const W = Math.min(Dimensions.get("window").width * 0.86, 340);
const TYPE_ICON = { anime: "play", manga: "book" };

function Section({ sec, C }) {
  const layout = sec.layout || "chips";
  const chip = (o) => {
    const on = o.key === sec.value;
    return (
      <TouchableOpacity key={o.key || "all"} onPress={() => sec.onSelect(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
        style={[layout === "tiles" ? s.tile : s.chip, { borderColor: on ? C.purple : C.border, backgroundColor: on ? C.purple : C.card }]}>
        {o.icon && <Icon name={o.icon} size={layout === "tiles" ? 18 : 13} color={on ? "#fff" : C.sub} />}
        <Text style={{ color: on ? "#fff" : C.sub, fontSize: layout === "tiles" ? 12 : 13, fontWeight: on ? "800" : "600" }} numberOfLines={1}>{o.label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: "800", marginBottom: 8 }}>{sec.label}</Text>
      {layout === "row" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{sec.options.map(chip)}</ScrollView>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{sec.options.map(chip)}</View>
      )}
    </View>
  );
}

export default function Sidebar({
  visible, onClose, segments, segment, onSegment, sections,
}) {
  const { C } = useTheme();
  const slide = useRef(new Animated.Value(-W)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 0 : -W, duration: 220, useNativeDriver: true }).start();
  }, [visible, slide]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Animated.View style={[s.panel, { width: W, backgroundColor: C.bg, borderRightColor: C.border, transform: [{ translateX: slide }] }]}>
          <Pressable style={{ flex: 1 }} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>Filters</Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 6 }} accessibilityLabel="Close filters">
                  <Text style={{ color: C.faint, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: C.text, fontSize: 15, fontWeight: "800", marginTop: 16, marginBottom: 8 }}>Type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {segments.map((sg) => {
                  const on = segment === sg.key;
                  return (
                    <TouchableOpacity key={sg.key} onPress={() => onSegment(sg.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      style={[s.type, { backgroundColor: on ? C.purple : C.card, borderColor: on ? C.purple : C.border }]}>
                      <Icon name={TYPE_ICON[sg.key] || "browse"} size={18} color={on ? "#fff" : C.sub} />
                      <Text style={{ color: on ? "#fff" : C.text, fontWeight: "800", fontSize: 14 }}>{sg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {sections.map((sec) => <Section key={sec.label} sec={sec} C={C} />)}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  panel: { position: "absolute", left: 0, top: 0, bottom: 0, borderRightWidth: 1 },
  type: { flex: 1, height: 64, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, height: 32 },
  tile: { flexBasis: "30%", flexGrow: 1, height: 58, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
});
