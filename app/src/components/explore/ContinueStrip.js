// FILE: app/src/components/explore/ContinueStrip.js — Explore's "Continue" strip: what you're in the middle of, across every kind
// (anime with the next-episode countdown, games with time played, comics and manga with where you are), each with a progress bar.
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getLibraryAll, onDataChange } from "@voidpop/shared/backend/store";
import { continueList } from "@voidpop/shared/features/summaries";
import { entryLine, KIND_LABEL } from "@voidpop/shared/features/entryLine";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import CoverTile from "../ui/CoverTile.js";
import SectionHead from "../ui/SectionHead.js";

export default function ContinueStrip({ onOpen }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const now = useNow(60000);
  const [entries, setEntries] = useState([]);
  const load = useCallback(() => getLibraryAll().then((l) => setEntries(Object.values(l))).catch(() => {}), []);
  useFocusEffect(load);
  useEffect(() => onDataChange(load), [load]);
  const list = useMemo(() => continueList(entries), [entries]);
  if (!list.length) return null;
  return (
    <View>
      <SectionHead title="Continue" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}>
        {list.map((e) => {
          const { kind, line, ratio } = entryLine(e, now);
          return (
            <Pressable key={`${e.item.segment}:${e.item.id}`} onPress={() => onOpen(e.item)} accessibilityRole="button" accessibilityLabel={`${e.item.title}. ${KIND_LABEL[kind]}. ${line}`}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}>
              <CoverTile item={e.item} width={58} height={82} radius={9} />
              <View style={{ flex: 1 }}>
                <Text style={s.kind}>{KIND_LABEL[kind].toUpperCase()}</Text>
                <Text style={s.title} numberOfLines={2}>{e.item.title}</Text>
                <Text style={s.line} numberOfLines={1}>{line}</Text>
                {ratio != null && <View style={s.track}><View style={[s.fill, { width: `${Math.max(3, ratio * 100)}%` }]} /></View>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: { width: 260, flexDirection: "row", gap: 12, backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 14, padding: 10 },
  kind: { color: C.purple, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: C.text, fontSize: 14, fontWeight: "800", marginTop: 2 },
  line: { color: C.faint, fontSize: 12, marginTop: 2 },
  track: { height: 5, borderRadius: 3, backgroundColor: C.border, marginTop: 8, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3, backgroundColor: C.purple },
});
