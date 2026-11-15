// FILE: shared/features/shelfKinds.js — games and comics: which segments they are, how their progress reads, and their
// release countdowns. Pure. The "shelf" is the storage movies and series already use; games and comics sit on it too.

export const SHELF_SEGMENTS = ["game", "comic"];
export const isShelf = (segment) => SHELF_SEGMENTS.includes(segment);

export const SHELF_LABEL = { game: "Game", comic: "Comic" };

// minutes -> "23 h 30 m", "45 m", "2 h"
export function playTime(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} m`;
  return r ? `${h} h ${r} m` : `${h} h`;
}

// What a game's or comic's progress line says. Games count minutes played, comics count issues read.
export function progressLine(item, progress) {
  if (item.segment === "game") {
    const total = item.hoursToBeat ? ` of about ${item.hoursToBeat} h` : "";
    return `${playTime(progress)} played${total}`;
  }
  return item.chapters ? `Issue ${progress} of ${item.chapters}` : `Issue ${progress}`;
}

// 0..1 for the bar, or null when there is no total to measure against
export function progressRatio(item, progress) {
  const total = item.segment === "game" ? (item.hoursToBeat || 0) * 60 : item.chapters || 0;
  return total > 0 ? Math.min(1, (progress || 0) / total) : null;
}

// The next thing to count down to: a game's release, or a comic's next issue. { label, airingAt (unix s) } | null.
// Past or missing times give null (a released game has no countdown).
export function shelfCountdown(item, now = Date.now()) {
  const nowS = now / 1000;
  if (item.segment === "game" && item.releaseAt > nowS) return { label: "Releases", airingAt: item.releaseAt };
  if (item.segment === "comic" && item.nextIssue?.airingAt > nowS) return { label: `Issue ${item.nextIssue.issue}`, airingAt: item.nextIssue.airingAt };
  return null;
}
