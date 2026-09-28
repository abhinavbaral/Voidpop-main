// The home-screen widget: a scrolling list of up to 30 upcoming episodes.
// Android redraws widgets at most every 30 minutes on its own (plus whenever
// the app changes your library), so the list shows the air time ("Today
// 8:30 PM") with a rough "in 3h" rather than a ticking countdown.
import { FlexWidget, ListWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import { airTime, dayLabel } from "@voidation/shared/format";

const C = { bg: "#0b0f19", card: "#111827", text: "#f3f4f6", sub: "#9ca3af", purple: "#a855f7", orange: "#ee8f2e", rose: "#f43f5e", border: "#1f2937" };

function roughUntil(airingAt) {
  const s = airingAt - Date.now() / 1000;
  if (s <= 0) return "Out now";
  const m = Math.round(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}

// Shown if loading fails, so the widget is never an empty see-through box.
export function WidgetMessage({ text }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: "match_parent", width: "match_parent", backgroundColor: C.bg, borderRadius: 18, padding: 14, justifyContent: "center", alignItems: "center" }}>
      <TextWidget text="VOIDATION" style={{ fontSize: 13, fontWeight: "800", color: C.text }} />
      <TextWidget text={text} style={{ fontSize: 12, color: C.sub, textAlign: "center", marginTop: 6 }} />
    </FlexWidget>
  );
}

export function NextEpisodesWidget({ rows, clock24 = false }) {
  const now = Date.now();
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: C.bg, borderRadius: 18, padding: 10 }}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: "voidation://schedule" }}
        style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingBottom: 6 }}
      >
        <FlexWidget style={{ flexDirection: "row" }}>
          <TextWidget text="VOID" style={{ fontSize: 13, fontWeight: "800", color: C.text, letterSpacing: 0.1 }} />
          <TextWidget text="ATION" style={{ fontSize: 13, fontWeight: "800", color: C.orange, letterSpacing: 0.1 }} />
        </FlexWidget>
        <TextWidget text={rows.length ? `Next ${rows.length} episode${rows.length === 1 ? "" : "s"}` : "Next episodes"} style={{ fontSize: 11, color: C.sub }} />
      </FlexWidget>
      {rows.length === 0 ? (
        <FlexWidget clickAction="OPEN_APP" style={{ width: "match_parent", height: "match_parent", justifyContent: "center", alignItems: "center", padding: 12 }}>
          <TextWidget
            text="Nothing you follow is airing. Mark an airing anime as Watching or Plan to Watch."
            style={{ fontSize: 12, color: C.sub, textAlign: "center" }}
          />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: "match_parent", width: "match_parent" }}>
          {rows.map((r) => (
            <FlexWidget
              key={r.id}
              clickAction="OPEN_URI"
              clickActionData={{ uri: `voidation://title/anime/${r.id}` }}
              style={{ width: "match_parent", flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 10, padding: 6, marginBottom: 6 }}
            >
              {r.image ? (
                <ImageWidget image={r.image} imageWidth={32} imageHeight={46} radius={5} />
              ) : (
                <FlexWidget style={{ width: 32, height: 46, backgroundColor: C.border, borderRadius: 5 }} />
              )}
              <FlexWidget style={{ flex: 1, paddingHorizontal: 8 }}>
                <TextWidget text={r.title} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: "700", color: C.text }} />
                <TextWidget
                  text={`${r.delayed ? "Delayed · " : ""}Ep ${r.next.episode} · ${dayLabel(r.next.airingAt, now)}, ${airTime(r.next.airingAt, clock24)}`}
                  maxLines={1}
                  truncate="END"
                  style={{ fontSize: 11, color: r.delayed ? C.rose : C.sub }}
                />
              </FlexWidget>
              <TextWidget
                text={roughUntil(r.next.airingAt)}
                style={{ fontSize: 12, fontWeight: "800", color: r.next.airingAt - now / 1000 < 86400 ? C.orange : C.purple }}
              />
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}
