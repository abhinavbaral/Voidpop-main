// Slide-in sidebar for Browse. Lists the four segments; the ACTIVE segment
// expands to show its filters as DROPDOWNS (origin, season/year for anime,
// and sort). Changes apply instantly.

import { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  Animated, Pressable, StyleSheet, Dimensions,
} from "react-native";
import { useTheme } from "../context/ThemeContext.js";

const W = Math.min(Dimensions.get("window").width * 0.8, 320);

function Dropdown({ label, value, options, onSelect, C }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: C.faint, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{
          height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border,
          backgroundColor: C.inputBg, paddingHorizontal: 12,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Text style={{ color: C.text, fontSize: 13, fontWeight: "600" }}>
          {current?.label || "Select"}
        </Text>
        <Text style={{ color: C.faint, fontSize: 11 }}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open && (
        <View
          style={{
            borderRadius: 10, borderWidth: 1, borderColor: C.border,
            backgroundColor: C.card, marginTop: 4, overflow: "hidden",
          }}
        >
          {options.map((o) => {
            const active = o.key === value;
            return (
              <TouchableOpacity
                key={o.key || "all"}
                onPress={() => { onSelect(o.key); setOpen(false); }}
                style={{
                  paddingVertical: 11, paddingHorizontal: 12,
                  backgroundColor: active ? C.orange : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : C.sub,
                    fontSize: 13, fontWeight: active ? "800" : "500",
                  }}
                >
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
    Animated.timing(slide, {
      toValue: visible ? 0 : -W,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.panel,
            { width: W, backgroundColor: C.bg, borderRightColor: C.border,
              transform: [{ translateX: slide }] },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={() => {}}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>
                  Browse
                </Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                  <Text style={{ color: C.faint, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {segments.map((s) => {
                const active = segment === s.key;
                return (
                  <View key={s.key} style={{ marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => onSegment(s.key)}
                      style={{
                        height: 46, borderRadius: 12, paddingHorizontal: 14,
                        flexDirection: "row", alignItems: "center",
                        backgroundColor: active ? C.orange : C.card,
                        borderWidth: 1,
                        borderColor: active ? C.orange : C.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? "#fff" : C.text,
                          fontWeight: "800", fontSize: 14, flex: 1,
                        }}
                      >
                        {s.label}
                      </Text>
                      <Text style={{ color: active ? "#fff" : C.faint, fontSize: 11 }}>
                        {active ? "▾" : "▸"}
                      </Text>
                    </TouchableOpacity>

                    {/* the active segment's filter dropdowns */}
                    {active && (
                      <View
                        style={{
                          borderLeftWidth: 2, borderLeftColor: C.orange,
                          paddingLeft: 12, marginLeft: 6, marginTop: 4,
                        }}
                      >
                        {sections.map((sec) => (
                          <Dropdown
                            key={sec.label}
                            label={sec.label}
                            value={sec.value}
                            options={sec.options}
                            onSelect={sec.onSelect}
                            C={C}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  panel: {
    position: "absolute", left: 0, top: 0, bottom: 0, borderRightWidth: 1,
  },
});
