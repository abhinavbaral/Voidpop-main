// "Source: Manga · One Piece · Reading" under an anime's title. Tapping the
// source opens its page, where you can track it. Your status updates when you
// come back. Sources that aren't on AniList (Original, Video game…) are plain text.
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getStatus, statusesFor } from "@voidation/shared/backend/store";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";

export default function SourceLine({ source, navigation }) {
  const { C } = useTheme();
  const { user } = useAuth();
  const [status, setStatus] = useState({}); // id -> status key
  const ids = (source?.items || []).map((i) => i.id).join(",");
  useFocusEffect(useCallback(() => {
    let alive = true;
    Promise.all((source?.items || []).map(async (i) => [i.id, await getStatus(user, "manga", i.id).catch(() => null)]))
      .then((pairs) => alive && setStatus(Object.fromEntries(pairs)));
    return () => { alive = false; };
  }, [ids, user])); // eslint-disable-line react-hooks/exhaustive-deps

  if (!source) return null;
  const label = (k) => statusesFor("manga").find((s) => s.key === k)?.label;
  if (!source.items.length) {
    return <Text style={{ color: C.faint, fontSize: 12, marginTop: 6 }}>Source: <Text style={{ color: C.sub, fontWeight: "700" }}>{source.label}</Text></Text>;
  }
  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      {source.items.map((it) => (
        <TouchableOpacity key={it.id} onPress={() => openDetail(navigation, it)} accessibilityRole="link"
          accessibilityLabel={`Source: ${it.kindLabel}, ${it.title}${status[it.id] ? `, ${label(status[it.id])}` : ""}`}>
          <Text style={{ color: C.faint, fontSize: 12 }} numberOfLines={1}>
            Source: <Text style={{ color: C.sub, fontWeight: "700" }}>{it.kindLabel}</Text>
            {" · "}<Text style={{ color: C.purple, fontWeight: "700" }}>{it.title}</Text>
            {status[it.id] ? <Text style={{ color: C.orange, fontWeight: "700" }}>{" · "}{label(status[it.id])}</Text> : null}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
