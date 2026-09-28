// Genre + studio filters for an already-loaded list (Season chart, Schedule):
// two scrolling rows of chips, most common first, with counts.
import { useMemo } from "react";
import { View } from "react-native";
import { filterOptions } from "@voidation/shared/filters";
import Chips from "./Chips.js";

export default function FilterChips({ items, value, onChange, style }) {
  const { genres, studios } = useMemo(() => filterOptions(items || []), [items]);
  if (!genres.length && !studios.length) return null;
  const opts = (list, all) => [{ key: "", label: all }, ...list.map((o) => ({ key: o.key, label: `${o.label} ${o.count}` }))];
  return (
    <View style={[{ gap: 6 }, style]}>
      <Chips options={opts(genres, "All genres")} value={value.genre} onChange={(genre) => onChange({ ...value, genre })} />
      {studios.length > 0 && (
        <Chips options={opts(studios.slice(0, 25), "All studios")} value={value.studio} onChange={(studio) => onChange({ ...value, studio })} />
      )}
    </View>
  );
}
