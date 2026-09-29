// YOUR SHOWS — "Your next episodes" and "Watching this season" in one: every
// anime you follow with an episode coming (big countdown) or episodes you
// haven't watched yet (Pending, +1). Schedule shows them stacked; Explore as a
// sideways "Up next" row.
import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import {
  getLibrary, yourShows, setProgress, setStatus, addReview, onDataChange, noteAiring,
} from "@voidation/shared/backend/store";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import CountdownCard from "./CountdownCard.js";
import VerdictModal from "./VerdictModal.js";
import { useTheme } from "../context/ThemeContext.js";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

export default function YourShows({ now, layout = "stack", title = "⏳ Your shows", emptyText, onOpen, refreshKey = 0 }) {
  const { C } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { clock24 } = useSettings().settings;
  const [lib, setLib] = useState(null);
  const [fresh, setFresh] = useState({});
  const [finishing, setFinishing] = useState(null);

  const readLib = useCallback(() => getLibrary(user).then(setLib).catch(() => setLib({})), [user]);
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const l = await getLibrary(user);
      if (!alive) return;
      setLib(l);
      const ids = Object.values(l).filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status)).map((e) => e.item.id);
      const f = await fetchNextEpisodes(ids).catch(() => ({}));
      if (!alive) return;
      setFresh(f);
      if (await noteAiring(f)) readLib();
    })();
    return () => { alive = false; };
  }, [user, readLib, refreshKey]));
  useEffect(() => onDataChange(readLib), [readLib]);

  if (!lib) return null;
  const shows = yourShows(lib, fresh, now);
  const pending = shows.reduce((n, s) => n + s.pending, 0);
  const head = (
    <View style={styles.head}>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>{title}</Text>
      {shows.length > 0 && (
        <Text style={{ color: pending ? C.orange : C.green, fontWeight: "800", fontSize: 12 }}>{pending ? `${pending} pending` : "All caught up"}</Text>
      )}
    </View>
  );
  if (!shows.length) {
    return layout === "stack" && emptyText ? (
      <View>{head}<Text style={{ color: C.faint, fontSize: 13, paddingHorizontal: 14, lineHeight: 19 }}>{emptyText}</Text></View>
    ) : null;
  }

  const plus = async (entry) => {
    const r = await setProgress(user, entry.item, (entry.progress || 0) + 1, "plus");
    if (r.reachedEnd) setFinishing(entry.item);
  };
  const finish = async ({ verdict, vibes, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, comment });
    setFinishing(null);
  };
  const card = (s, w) => <CountdownCard key={s.item.id} show={s} now={now} clock24={clock24} onPlus={plus} onOpen={onOpen} width={w} />;

  return (
    <View style={{ marginTop: 14 }}>
      {head}
      {layout === "row" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}>
          {shows.map((s) => card(s, Math.min(340, width * 0.86)))}
        </ScrollView>
      ) : (
        <View style={{ gap: 10, paddingHorizontal: 14 }}>{shows.map((s) => card(s))}</View>
      )}
      {finishing && <VerdictModal visible initial={null} onSave={finish} onClose={() => setFinishing(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 },
});
