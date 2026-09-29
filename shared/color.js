// Colour helpers for tinting a title page with its cover colour.
// AniList gives each cover a main colour ("#e4a15d"). Used as-is it can be
// too dark on the dark theme or too pale for white text, so readableAccent()
// nudges it until its brightness sits where both work: visible against the
// page background (light or dark) and readable with white text on top.

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export const toHex = (rgb) => "#" + rgb.map((v) => clamp(v).toString(16).padStart(2, "0")).join("");

// WCAG relative luminance, 0 (black) … 1 (white)
export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const mix = (rgb, target, t) => rgb.map((v, i) => v + (target[i] - v) * t);

// Keeps luminance within [0.12, 0.3]: ≥ 3:1 against near-black and against
// white both ways, so it works as text/borders on either theme and as a button
// with white text. null → fallback.
export function readableAccent(hex, fallback) {
  let rgb = parseHex(hex);
  if (!rgb) return fallback;
  for (let i = 0; i < 20 && luminance(rgb) < 0.12; i++) rgb = mix(rgb, [255, 255, 255], 0.1);
  for (let i = 0; i < 20 && luminance(rgb) > 0.3; i++) rgb = mix(rgb, [0, 0, 0], 0.1);
  return toHex(rgb);
}

// "#rrggbb" + alpha 0…1 → "rgba(…)"
export function withAlpha(hex, a) {
  const rgb = parseHex(hex);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : hex;
}
