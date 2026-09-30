// The Rewind VIDEO's slides ("reel"), in the anime-carousel style: a number
// (01, 02…), a big two-colour headline, a short line, and one of your top
// titles large on the side, all tinted with your #1 title's own colour.
// Built from the same slides you tap through (wrapped.js), so the video tells
// the same story. The app and the website draw these the same way.
//
// reelSlides(w, slides) → { accent, glow, frames: [{ num, eyebrow, white, colored, sub, rows, items, hero, thumb, summary }] }

import { readableAccent, parseHex, toHex } from "./color.js";

// "29 episodes" → white "29", coloured "episodes"; one word → all coloured
export function splitHeadline(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { white: "", colored: words.join(" ") };
  const cut = Math.ceil(words.length / 2);
  return { white: words.slice(0, cut).join(" "), colored: words.slice(cut).join(" ") };
}

export function reelSlides(w, slides) {
  const tops = [...(w.topAnime || []), ...(w.topManga || [])].map((x) => x.item).filter((it) => it?.image);
  const base = readableAccent(tops[0]?.color, "#a855f7");
  const rgb = parseHex(base) || [168, 85, 247];
  // a brighter version for headline text on the dark background, and the glow
  const accent = toHex(rgb.map((v) => v + (255 - v) * 0.35));
  const glow = `rgba(${rgb.join(",")},0.55)`;
  const pic = (k) => (tops.length ? tops[k % tops.length] : null);
  const frames = slides.map((s, k) => {
    const headline = s.kind === "big" ? s.big : s.kind === "stats" ? s.big || s.eyebrow : s.eyebrow;
    const { white, colored } = splitHeadline(headline);
    const hero = pic(k);
    return {
      num: String(k + 1).padStart(2, "0"),
      eyebrow: s.kind === "big" || s.kind === "stats" ? s.eyebrow : null,
      white, colored,
      sub: s.sub || null,
      rows: s.rows ? s.rows.slice(0, 5) : null,
      items: s.kind === "list" ? s.items.slice(0, 5) : null,
      unit: s.unit || null,
      hero: hero?.image || null,
      thumb: tops.length > 1 ? pic(k + 1)?.image : null,
      summary: s.kind === "summary",
    };
  });
  return { accent, glow, frames };
}
