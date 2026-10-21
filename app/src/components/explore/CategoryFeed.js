// ANIME / MANGA / NOVEL inside Explore: origin chips (Japanese, Korean, Chinese …), a sort row,
// and an endless grid. Same data as Browse, without opening a separate screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { View, FlatList, ActivityIndicator } from "react-native";
import { fetchAniList, SORTS, ANIME_ORIGINS, MANGA_ORIGINS, NOVEL_ORIGINS } from "@voidpop/shared/api/anilist";
import { useGridColumns } from "../../utils/layout";
import { openDetail } from "../../utils/nav";
import Card from "../ui/Card.js";
import Chips from "../ui/Chips.js";
import { SkeletonGrid } from "../ui/Skeleton.js";
import { VoidmonEmpty, VoidmonTrouble } from "../brand/Voidmon.js";

// Anime: Japanese / Korean / Chinese. Manga: manga / manhwa / manhua. Novel: light novels / web novels.
const ORIGINS = {
  anime: ANIME_ORIGINS,
  manga: MANGA_ORIGINS.filter((o) => o.key !== "US"),
  novel: NOVEL_ORIGINS,
};

export default function CategoryFeed({ segment, navigation, header }) {
  const cols = useGridColumns();
  const [origin, setOrigin] = useState("");
  const [sort, setSort] = useState("popular");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const reqId = useRef(0); // answers for an older filter are ignored

  const load = useCallback(async (pageToLoad, reset = false) => {
    if (busy.current && !reset) return;
    const id = ++reqId.current;
    busy.current = true;
    setLoading(true); setError(false);
    try {
      const r = await fetchAniList(segment, { page: pageToLoad, sort, origin });
      if (id !== reqId.current) return;
      setItems((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((i) => i.id));
        return [...base, ...r.items.filter((i) => !seen.has(i.id))];
      });
      setHasMore(r.hasMore);
      setPage(pageToLoad + 1);
    } catch {
      if (id === reqId.current) { setError(true); setHasMore(false); }
    } finally {
      if (id === reqId.current) { setLoading(false); busy.current = false; }
    }
  }, [segment, sort, origin]);

  useEffect(() => { setItems([]); setHasMore(true); load(1, true); }, [load]);

  const top = (
    <View>
      {header}
      <Chips options={ORIGINS[segment]} value={origin} onChange={setOrigin} style={{ paddingHorizontal: 14 }} />
      <Chips options={SORTS} value={sort} onChange={setSort} style={{ paddingHorizontal: 14 }} />
    </View>
  );

  if (error && !items.length) {
    return <FlatList data={[]} renderItem={null} ListHeaderComponent={top} ListFooterComponent={<VoidmonTrouble what="this list" onRetry={() => load(1, true)} navigation={navigation} />} />;
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => `${segment}-${item.id}`}
      key={`grid-${segment}-${cols}`}
      numColumns={cols}
      ListHeaderComponent={top}
      contentContainerStyle={{ paddingBottom: 30 }}
      columnWrapperStyle={cols > 1 ? { paddingHorizontal: 6 } : undefined}
      renderItem={({ item }) => <Card item={item} columns={cols} onPress={() => openDetail(navigation, item)} />}
      onEndReached={() => hasMore && !busy.current && load(page)}
      onEndReachedThreshold={0.6}
      ListFooterComponent={loading && items.length ? <ActivityIndicator style={{ margin: 20 }} /> : null}
      ListEmptyComponent={!loading ? <VoidmonEmpty pose="peeking" text="Nothing here. Try another filter." /> : <SkeletonGrid columns={cols} rows={3} />}
    />
  );
}
