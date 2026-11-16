// FILE: shared/features/entryLine.js — the one-line "where you are" and progress bar for a library entry of ANY kind, used by
// Explore's Continue strip and the Library grid. Pure.
import { kindOf, totalFor, unitFor } from "../backend/store.js";
import { formatCountdown } from "../lib/format.js";
import { playTime, progressRatio } from "./shelfKinds.js";

// entry: { item, status, progress }. -> { kind, line, ratio (0..1 or null) }
export function entryLine(entry, now = Date.now()) {
  const it = entry.item, p = entry.progress || 0, kind = kindOf(it);
  if (kind === "game") return { kind, line: p ? `${playTime(p)} played` : "Not started", ratio: entry.status === "completed" ? 1 : progressRatio(it, p) };
  if (kind === "comic") return { kind, line: p ? `Issue ${p}${it.chapters ? `/${it.chapters}` : ""}` : "Not started", ratio: entry.status === "completed" ? 1 : progressRatio(it, p) };
  if (kind === "movie" || kind === "tv") return { kind, line: it.dateLabel || "", ratio: entry.status === "completed" ? 1 : null };
  const total = totalFor(it);
  let line = `${unitFor(it.segment)} ${p}${total ? `/${total}` : ""}`;
  const next = it.nextEpisode?.airingAt;
  if (kind === "anime" && next && next * 1000 > now) line += ` · in ${formatCountdown(next, now)}`;
  return { kind, line, ratio: entry.status === "completed" ? 1 : total ? Math.min(1, p / total) : null };
}

export const KIND_LABEL = { anime: "Anime", manga: "Manga", novel: "Novel", movie: "Movie", tv: "Series", game: "Game", comic: "Comic" };
