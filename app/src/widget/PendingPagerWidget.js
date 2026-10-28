// The Pending pager widget (4x2): the shows with episodes waiting, one at a time, the longest-waiting first.
// The arrows on each side go to the previous / next one (no upcoming episodes here, only what is pending).
// Tapping the card opens that show. Which one is showing is remembered between redraws (see index.js).
import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { airedAgo } from "@voidpop/shared/lib/format";

const C = { bg: "#0b0f19", card: "#111827", text: "#f3f4f6", sub: "#9ca3af", purple: "#a855f7", orange: "#ee8f2e", rose: "#f43f5e", green: "#10b981", border: "#1f2937" };

export const PAGER_PREV = "PAGER_PREV";
export const PAGER_NEXT = "PAGER_NEXT";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function Brand() {
  return (
    <FlexWidget style={{ flexDirection: "row" }}>
      <TextWidget text="VOID" style={{ fontSize: 12, fontWeight: "800", color: C.text, letterSpacing: 0.1 }} />
      <TextWidget text="POP" style={{ fontSize: 12, fontWeight: "800", color: C.orange, letterSpacing: 0.1 }} />
    </FlexWidget>
  );
}

function Arrow({ action, label, enabled }) {
  return (
    <FlexWidget
      clickAction={action}
      accessibilityLabel={label}
      style={{ width: 34, height: "match_parent", justifyContent: "center", alignItems: "center", backgroundColor: C.card, borderRadius: 12 }}
    >
      <TextWidget text={action === PAGER_PREV ? "‹" : "›"} style={{ fontSize: 28, fontWeight: "800", color: enabled ? C.text : C.border }} />
    </FlexWidget>
  );
}

function ageText(r, now) {
  if (r.airedAt == null) return `${plural(r.pending, "episode", "episodes")} waiting`;
  const ago = airedAgo(r.airedAt, now);
  return r.estimated ? ago.replace("aired ", "aired about ") : ago;
}

// rows: oldest-waiting first (oldestPending().rows); index: which one is showing
export function PendingPagerWidget({ rows, index = 0, total = 0 }) {
  const now = Date.now();
  if (!rows.length) {
    return (
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: "voidation://schedule" }}
        style={{ height: "match_parent", width: "match_parent", backgroundColor: C.bg, borderRadius: 18, padding: 12 }}>
        <Brand />
        <FlexWidget style={{ flex: 1, width: "match_parent", justifyContent: "center", alignItems: "center" }}>
          <TextWidget text="All caught up" style={{ fontSize: 18, fontWeight: "800", color: C.green }} />
          <TextWidget text="No aired episode of an ongoing show is waiting." style={{ fontSize: 12, color: C.sub, marginTop: 4, textAlign: "center" }} />
        </FlexWidget>
      </FlexWidget>
    );
  }
  const r = rows[Math.min(Math.max(0, index), rows.length - 1)];
  const at = rows.indexOf(r) + 1;
  const old = r.airedAt != null && now / 1000 - r.airedAt > 7 * 86400; // a week or more: shown in red
  const many = rows.length > 1;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: C.bg, borderRadius: 18, padding: 12 }}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 }}>
        <Brand />
        <TextWidget text={`Pending ${at} of ${rows.length} · ${plural(total, "episode", "episodes")}`} style={{ fontSize: 11, color: C.sub }} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, width: "match_parent", flexDirection: "row", alignItems: "center" }}>
        <Arrow action={PAGER_PREV} label="Previous show" enabled={many} />
        <FlexWidget
          clickAction="OPEN_URI" clickActionData={{ uri: `voidation://title/anime/${r.id}` }}
          style={{ flex: 1, height: "match_parent", flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 8, marginHorizontal: 6 }}
        >
          {r.image
            ? <ImageWidget image={r.image} imageWidth={40} imageHeight={58} radius={6} />
            : <FlexWidget style={{ width: 40, height: 58, backgroundColor: C.border, borderRadius: 6 }} />}
          <FlexWidget style={{ flex: 1, paddingHorizontal: 10 }}>
            <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 15, fontWeight: "800", color: C.text }} />
            <TextWidget text={`${plural(r.pending, "episode", "episodes")} pending`} style={{ fontSize: 12, fontWeight: "800", color: C.orange }} />
            <TextWidget text={`Oldest: Ep ${r.episode} · ${ageText(r, now)}`} maxLines={1} truncate="END" style={{ fontSize: 11, color: old ? C.rose : C.sub }} />
          </FlexWidget>
        </FlexWidget>
        <Arrow action={PAGER_NEXT} label="Next show" enabled={many} />
      </FlexWidget>
    </FlexWidget>
  );
}
