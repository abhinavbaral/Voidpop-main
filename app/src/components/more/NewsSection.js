// More → Other → News: the latest anime, manga and novel news, from a few public feeds. Tap a story to read it in the
// app (NewsReaderScreen) and give it a Void Verdict (no moods). The chip on a story is your own verdict on it.
import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { fetchNews } from "@voidpop/shared/api/news";
import { NEWS_TABS, filterNews } from "@voidpop/shared/features/news";
import { VERDICTS, getNewsVerdicts, onDataChange, timeAgo } from "@voidpop/shared/backend/store";
import Chips from "../ui/Chips.js";
import { SkeletonList } from "../ui/Skeleton.js";

const KIND_LABEL = { anime: "Anime", manga: "Manga", novel: "Novel", other: "" };
const PAGE = 20;

export default function NewsSection({ styles, C, onOpenArticle }) {
  const [tab, setTab] = useState("all");
  const [data, setData] = useState(null); // null = loading
  const [verdicts, setVerdicts] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async (force) => {
    setRefreshing(!!force);
    try { setData(await fetchNews({ force })); } catch { setData({ items: [], failed: ["all sites"], stale: false }); }
    setRefreshing(false);
  }, []);
  useEffect(() => { load(false); }, [load]);
  // your verdict chips stay right after you come back from reading a story
  useEffect(() => {
    const read = () => getNewsVerdicts().then(setVerdicts).catch(() => {});
    read();
    return onDataChange(read);
  }, []);
  useEffect(() => { setShown(PAGE); }, [tab]);

  if (!data) return <SkeletonList rows={5} style={{ paddingHorizontal: 0 }} />;
  const items = filterNews(data.items, tab);
  return (
    <>
      <Chips options={NEWS_TABS} value={tab} onChange={setTab} style={{ paddingHorizontal: 0 }} />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
        <Text style={[styles.note, { flex: 1 }]}>
          {data.stale ? "You're offline: showing the last news saved on this phone." : "The latest from Anime News Network, MyAnimeList and Anime Corner."}
        </Text>
        <TouchableOpacity onPress={() => load(true)} disabled={refreshing} accessibilityRole="button" accessibilityLabel="Refresh news" hitSlop={8}>
          <Text style={{ color: C.purple, fontWeight: "800", fontSize: 12, opacity: refreshing ? 0.5 : 1 }}>{refreshing ? "Refreshing…" : "Refresh"}</Text>
        </TouchableOpacity>
      </View>
      {data.failed.length > 0 && data.items.length > 0 && !data.stale && (
        <Text style={[styles.note, { color: C.orange, marginTop: 4 }]}>Couldn't reach {data.failed.join(" or ")} just now.</Text>
      )}

      {!items.length ? (
        <Text style={[styles.note, { marginTop: 14 }]}>
          {data.items.length ? `No ${tab} news right now.` : "Couldn't load the news. Check your connection and tap Refresh."}
        </Text>
      ) : (
        <View style={{ paddingVertical: 6 }}>
          {items.slice(0, shown).map((a, i) => {
            const mine = VERDICTS.find((v) => v.key === verdicts[a.url]?.verdict);
            return (
              <TouchableOpacity
                key={a.url} onPress={() => onOpenArticle(a)} accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.sourceName}`}
                style={[styles.entry, { alignItems: "flex-start", paddingVertical: 10 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}
              >
                {a.image
                  ? <Image source={{ uri: a.image }} style={{ width: 84, height: 62, borderRadius: 8, backgroundColor: C.border }} />
                  : <View style={{ width: 84, height: 62, borderRadius: 8, backgroundColor: C.border }} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={3}>{a.title}</Text>
                  <Text style={[styles.note, { marginTop: 3 }]} numberOfLines={1}>
                    {[a.sourceName, timeAgo(new Date(a.publishedAt).toISOString()), KIND_LABEL[a.kind]].filter(Boolean).join(" · ")}
                  </Text>
                  {mine && (
                    <View style={{ alignSelf: "flex-start", marginTop: 5, backgroundColor: mine.color, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{mine.label}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {items.length > shown && (
            <TouchableOpacity onPress={() => setShown((n) => n + PAGE)} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 20 }}>
              <Text style={{ color: C.purple, fontWeight: "800" }}>Show more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
}
