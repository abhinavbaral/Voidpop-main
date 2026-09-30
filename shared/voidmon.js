// Voidmon, Voidation's mascot (an original character by Abhinav Baral).
// The pictures are app/assets/voidmon/voidmon-<pose>.png (made from the .svg
// drawings next to them by app/scripts/voidmon-art.mjs). This file holds what
// the app and website both need to know about each pose.
//   ratio: height / width of the picture
export const VOIDMON_POSES = {
  welcome: { ratio: 1, label: "Voidmon waving" },
  theme: { ratio: 1, label: "Voidmon choosing light or dark" },
  import: { ratio: 1, label: "Voidmon carrying your list" },
  alerts: { ratio: 1, label: "Voidmon ringing a bell" },
  loading: { ratio: 1, label: "Voidmon loading" },
  peeking: { ratio: 0.25, label: "Voidmon peeking" },
  sleeping: { ratio: 0.575, label: "Voidmon sleeping" },
  celebrating: { ratio: 1, label: "Voidmon celebrating" },
  asking: { ratio: 1, label: "Voidmon asking" },
};

// What Voidmon says in the verdict window. It's two steps:
//   1. "verdict": the Void Verdict (Peak / Dive In / One Time / Void It)
//   2. "feel":    moods (up to 3) and an optional note, in one speech bubble
// Vibes aren't asked any more (AniList's themes already say what kind of show
// it was); vibes on older verdicts are kept and still shown.
export function verdictPrompt({ step = "verdict", verdict = null, moods = [] }) {
  if (step === "verdict") return { pose: "asking", text: verdict ? "Got it. Next: how it felt." : "So... how was it? Give it your Void Verdict." };
  return moods.length
    ? { pose: "celebrating", text: "Nice. Add a note if you like, then save." }
    : { pose: "asking", text: "And how did it leave you feeling? Pick up to 3." };
}
