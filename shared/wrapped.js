// VOIDATION REWIND (code still calls it "wrapped") — your year, from your own watch log. One user, one device:
// no "top 1% of fans" (that needs everyone's data); every comparison is with
// yourself: your busiest month, your favourite day, this year vs last year.
//
// Years: only the current year gets its own Rewind; everything else goes in
// "Before <this year>". A title counts in a year when its `rewindYear` says so:
// titles you add get the year you added them, and "Pick titles" lets you put
// older ones (imports, things added before) in this year or take them out.
// Imports and AniList pulls get no year, so old viewing lands in "Before".
//
// What counts in a year: the episodes/chapters you marked that year for its
// titles (+1, typed, History's "Mark watched"); a picked title you never
// marked episode by episode counts in full (all of it if it's Completed).

import { getLog, getLibrary, getReviews, getStats, tierFor, totalFor, VERDICTS, isDone } from "./backend/store.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_EP_MIN = 24;

const isProgress = ([, , change, source]) => change !== 0 && source !== "complete" && !String(source).startsWith("status:");
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const inYear = (t, year) => new Date(t).getFullYear() === year;

// The tabs, whatever year it is: All time · Before <this year> · <this year>.
// Last year's picks move into "Before" when the year turns.
export async function wrappedYears(now = Date.now()) {
  const year = new Date(now).getFullYear();
  return ["all", `before-${year}`, year];
}

// Tab label: "All time", "Before 2026", "2027"
export const wrappedLabel = (which) =>
  which === "all" ? "All time" : String(which).startsWith("before-") ? `Before ${String(which).slice(7)}` : String(which);

// Wrapped opens on All time (your whole history); single years are one tap away.
export async function defaultWrapped() {
  return "all";
}

function sumByKey(entries) {
  const per = new Map();
  entries.forEach(([, key, change]) => per.set(key, (per.get(key) || 0) + change));
  per.forEach((n, k) => { if (n <= 0) per.delete(k); }); // corrections below zero don't count
  return per;
}

// how much of each title counts in `year`: marked that year, or in full for a
// title picked for the year but never marked episode by episode
const fullAmount = (e) => (isDone(e.status) ? Math.max(e.progress || 0, totalFor(e.item) || 0) : e.progress || 0);
function yearAmounts(lib, log, year) {
  const picked = new Set(Object.keys(lib).filter((k) => lib[k].rewindYear === year));
  const prog = log.filter(([t, k]) => inYear(t, year) && picked.has(k)).filter(isProgress);
  const per = sumByKey(prog);
  picked.forEach((k) => { if (!per.has(k) && fullAmount(lib[k]) > 0) per.set(k, fullAmount(lib[k])); });
  return { picked, prog, per };
}

export async function computeWrapped(year = new Date().getFullYear()) {
  const [log, lib, reviews, stats] = await Promise.all([getLog(), getLibrary(), getReviews(), getStats()]);
  const { picked, prog, per } = yearAmounts(lib, log, year);
  const itemOf = (key) => lib[key]?.item || null;
  const seg = (key) => key.split(":")[0];

  // totals
  let episodes = 0, chapters = 0, minutes = 0;
  per.forEach((n, key) => {
    if (seg(key) === "manga") chapters += n;
    else { episodes += n; minutes += n * (itemOf(key)?.duration || DEFAULT_EP_MIN); }
  });

  // top titles (titles you've since removed from the library can't be shown by name)
  const top = (segment) => [...per.entries()]
    .filter(([k]) => seg(k) === segment && itemOf(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, n]) => ({ item: itemOf(k), count: n }));
  const topAnime = top("anime");
  const topManga = top("manga");

  // genres and studios, weighted by how much you watched/read
  const weigh = (pick) => {
    const m = new Map();
    per.forEach((n, key) => pick(itemOf(key), key).forEach((v) => v && m.set(v, (m.get(v) || 0) + n)));
    const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, share: Math.round((n / total) * 100) }));
  };
  const genres = weigh((it) => it?.genres || []);
  const studios = weigh((it, key) => (seg(key) === "anime" && it?.creator ? [it.creator] : []));

  // habits: by day, month, weekday. Counted in episodes (or chapters if you
  // only read manga this year), never a mix of the two.
  const habitSeg = episodes ? "anime" : "manga";
  const habitUnit = episodes ? "episodes" : "chapters";
  const byDay = new Map();
  const months = Array(12).fill(0);
  const weekdays = Array(7).fill(0);
  prog.forEach(([t, key, change]) => {
    if (change <= 0 || seg(key) !== habitSeg) return;
    const d = new Date(t);
    const k = dayKey(t);
    const day = byDay.get(k) || { t, n: 0, keys: new Map() };
    day.n += change;
    day.keys.set(key, (day.keys.get(key) || 0) + change);
    byDay.set(k, day);
    months[d.getMonth()] += change;
    weekdays[d.getDay()] += change;
  });
  let binge = null;
  byDay.forEach((d) => {
    if (!binge || d.n > binge.n) {
      const [mainKey] = [...d.keys.entries()].sort((a, b) => b[1] - a[1])[0];
      binge = { date: d.t, count: d.n, item: itemOf(mainKey) };
    }
  });
  // longest run of days in a row with something marked
  const days = [...byDay.values()].map((d) => { const x = new Date(d.t); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); }).sort((a, b) => a - b);
  let streak = days.length ? 1 : 0, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = Math.round((days[i] - days[i - 1]) / 864e5) === 1 ? run + 1 : 1;
    streak = Math.max(streak, run);
  }
  const busiestMonth = months.some(Boolean) ? MONTHS[months.indexOf(Math.max(...months))] : null;
  const favDay = weekdays.some(Boolean) ? DAYS[weekdays.indexOf(Math.max(...weekdays))] : null;

  // completed: this year's titles that are Completed / Finished; rank climb
  const completed = [...picked].filter((k) => isDone(lib[k].status)).length;
  const tierNow = tierFor(stats.totalCompleted);
  const tierStart = tierFor(Math.max(0, stats.totalCompleted - completed));

  // verdicts on this year's titles
  const yearReviews = reviews.filter((r) => picked.has(`${r.segment}:${r.titleId}`));
  const verdicts = VERDICTS.map((v) => ({ ...v, count: yearReviews.filter((r) => r.verdict === v.key).length }));
  const latestPeak = yearReviews
    .filter((r) => r.verdict === "peak")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map((r) => lib[`${r.segment}:${r.titleId}`]?.item)
    .find(Boolean) || null;

  // you vs last year (only if last year has anything)
  const lastYearEps = [...yearAmounts(lib, log, year - 1).per.entries()]
    .filter(([k]) => seg(k) === "anime").reduce((n, [, c]) => n + c, 0);

  const first = prog.length ? Math.min(...prog.map(([t]) => t)) : null;
  return {
    year,
    label: String(year),
    empty: episodes + chapters === 0 && !completed,
    picked: picked.size,
    startedLogging: first && new Date(first).getMonth() > 0 ? first : null, // log began mid-year
    episodes, chapters, minutes, hours: Math.round(minutes / 60),
    topAnime, topManga,
    topShare: topAnime[0] && episodes ? Math.round((topAnime[0].count / episodes) * 100) : 0,
    genres, studios,
    habitUnit, binge, streak, busiestMonth, busiestMonthCount: Math.max(...months), favDay,
    completed, tierStart, tierNow,
    verdicts, verdictTotal: yearReviews.length, latestPeak,
    lastYearEps, vsLastYear: lastYearEps ? Math.round(((episodes - lastYearEps) / lastYearEps) * 100) : null,
  };
}

/* ---------- All time: your whole library, however long ago you watched ---------- */

const VERDICT_SCORE = { peak: 3, divein: 2, onetime: 1, voidit: -1 };

// Built from the library itself, since years before Voidation have no log.
// "Top" = what you rated highest (Peak, then Dive In, then One Time), then the
// most episodes/chapters: without dates, your own verdicts are the fairest ranking.
//
// With `before` (a year): "Before <year>" is the same, without the titles that
// count in that year or later (see rewindYear at the top).
export async function computeAllTime({ before = null } = {}) {
  const [lib, allReviews, stats] = await Promise.all([getLibrary(), getReviews(), getStats()]);
  const counts = (e) => !before || !(e.rewindYear >= before);
  const reviews = allReviews.filter((r) => { const e = lib[`${r.segment}:${r.titleId}`]; return !e || counts(e); });
  const verdictOf = Object.fromEntries(reviews.map((r) => [`${r.segment}:${r.titleId}`, r.verdict]));
  const entries = Object.entries(lib).filter(([, e]) => counts(e)).map(([key, e]) => ({
    key, e, item: e.item,
    amount: fullAmount(e), // a completed title counts in full even if its progress was never filled in
    verdict: verdictOf[key] || null,
  }));
  const touched = entries.filter((x) => x.amount > 0 || isDone(x.e.status));
  const anime = touched.filter((x) => x.item.segment === "anime");
  const manga = touched.filter((x) => x.item.segment === "manga");

  const episodes = anime.reduce((n, x) => n + x.amount, 0);
  const chapters = manga.reduce((n, x) => n + x.amount, 0);
  const minutes = anime.reduce((n, x) => n + x.amount * (x.item.duration || DEFAULT_EP_MIN), 0);

  const rank = (list) => [...list]
    .filter((x) => x.verdict !== "voidit")
    .sort((a, b) => (VERDICT_SCORE[b.verdict] || 0) - (VERDICT_SCORE[a.verdict] || 0) || b.amount - a.amount)
    .slice(0, 5)
    .map((x) => ({ item: x.item, count: x.amount, verdict: VERDICTS.find((v) => v.key === x.verdict) || null }));

  // genres as a share of your titles: each title counts once (so 380 manga
  // chapters don't outweigh a 12-episode show); "Action 40%" = 40% of your titles
  const g = new Map();
  touched.forEach((x) => (x.item.genres || []).forEach((name) => g.set(name, (g.get(name) || 0) + 1)));
  const genres = [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)
    .map(([name, n]) => ({ name, titles: n, share: Math.round((n / touched.length) * 100) }));
  const studios = new Map();
  anime.forEach((x) => x.item.creator && studios.set(x.item.creator, (studios.get(x.item.creator) || 0) + Math.max(1, x.amount)));
  const topStudio = [...studios.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const count = (seg, status) => entries.filter((x) => x.item.segment === seg && (
    status === "completed" ? isDone(x.e.status) : !before && x.e.status === status
  )).length;
  const done = count("anime", "completed") + count("manga", "completed");
  return {
    year: before ? `before-${before}` : "all",
    label: before ? `Before ${before}` : "All time",
    before,
    allTime: true,
    empty: !touched.length,
    titles: touched.length,
    episodes, chapters, minutes, hours: Math.round(minutes / 60),
    topAnime: rank(anime), topManga: rank(manga),
    genres, studios: topStudio ? [{ name: topStudio }] : [],
    finishedAnime: count("anime", "completed"),
    finishedManga: count("manga", "completed"),
    completed: count("anime", "completed") + count("manga", "completed"),
    watchingNow: count("anime", "watching"),
    readingNow: count("manga", "watching"),
    tierNow: tierFor(before ? done : stats.totalCompleted),
    verdicts: VERDICTS.map((v) => ({ ...v, count: reviews.filter((r) => r.verdict === v.key).length })),
    verdictTotal: reviews.length,
  };
}

export const loadWrapped = (which) =>
  which === "all" ? computeAllTime()
    : String(which).startsWith("before-") ? computeAllTime({ before: Number(String(which).slice(7)) })
      : computeWrapped(Number(which));

function allTimeSlides(w) {
  const eyebrow = `Voidation Rewind · ${w.label}`;
  if (w.empty) {
    return [{ kind: "big", eyebrow, big: "Nothing yet",
      sub: "Add the anime and manga you've watched to your Library (or import them from AniList), and this fills in." }];
  }
  const slides = [
    w.before
      ? { kind: "big", eyebrow, big: `Before ${w.before}`,
        sub: `Everything you'd watched and read before ${w.before}, plus anything not picked for your ${w.before} Rewind.` }
      : { kind: "big", eyebrow, big: "Your anime life",
        sub: "Everything in your library, however long ago you watched it." },
    { kind: "big", eyebrow: "All together", big: `${fmt(w.episodes)} episodes`,
      sub: [
        w.episodes ? (w.minutes < 90 ? `About ${fmt(Math.round(w.minutes))} minutes of anime.` : `About ${fmt(w.hours)} hours of anime${w.hours >= 48 ? `, or ${fmt(Math.round(w.hours / 24))} full days` : ""}.`) : null,
        w.chapters ? `And ${fmt(w.chapters)} manga chapters.` : null,
      ].filter(Boolean).join(" ") },
  ];
  const withVerdict = (items) => items.map((x) => ({ ...x, note: x.verdict?.label || null }));
  if (w.topAnime.length) slides.push({ kind: "list", eyebrow: "Your top anime", unit: "episodes", items: withVerdict(w.topAnime), image: w.topAnime[0].item.image,
    sub: "Ranked by your verdicts, then by how much you watched." });
  if (w.topManga.length) slides.push({ kind: "list", eyebrow: "Your top manga", unit: "chapters", items: withVerdict(w.topManga), image: w.topManga[0].item.image });
  if (w.genres.length) slides.push({ kind: "stats", eyebrow: "Your genres", big: w.genres[0].name,
    rows: w.genres.map((g) => [g.name, `${g.titles} title${g.titles === 1 ? "" : "s"} · ${g.share}%`]),
    sub: `Out of ${fmt(w.titles)} titles you've watched or read (a title can have several genres).${w.studios[0] ? ` Studio you've watched most: ${w.studios[0].name}.` : ""}` });
  slides.push({ kind: "stats", eyebrow: "Completed & finished", big: `${fmt(w.completed)} title${w.completed === 1 ? "" : "s"}`,
    rows: [
      ["Anime completed", fmt(w.finishedAnime)],
      ["Manga finished", fmt(w.finishedManga)],
      w.watchingNow ? ["Watching now", fmt(w.watchingNow)] : null,
      w.readingNow ? ["Reading now", fmt(w.readingNow)] : null,
    ].filter(Boolean),
    sub: `Rank: ${w.tierNow.label}.`, color: w.tierNow.color });
  if (w.verdictTotal) slides.push({ kind: "stats", eyebrow: "Your verdicts", big: `${w.verdictTotal} verdict${w.verdictTotal === 1 ? "" : "s"}`,
    rows: w.verdicts.filter((v) => v.count).map((v) => [v.label, `${v.count}`]),
    colors: Object.fromEntries(w.verdicts.map((v) => [v.label, v.color])) });
  slides.push({ kind: "summary" });
  return slides;
}

const fmt = (n) => n.toLocaleString();
const dateLabel = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long" });

// The story, as plain slide data both the app and the website draw the same way.
// kind: "big" (one headline number), "list" (ranked titles), "stats" (label/value rows), "summary" (the share card)
export function wrappedSlides(w) {
  if (w.allTime) return allTimeSlides(w);
  if (w.empty) {
    return [{
      kind: "big", eyebrow: `Voidation Rewind ${w.year}`, big: "Nothing yet", pick: true,
      sub: `Anime and manga you add in ${w.year} land here by themselves. Watched something this year that was already in your library? Tap Pick titles.`,
    }];
  }
  const slides = [];
  slides.push({
    kind: "big", eyebrow: `Voidation Rewind ${w.year}`, big: `Your ${w.year}`,
    sub: `${fmt(w.picked)} title${w.picked === 1 ? "" : "s"} you watched or read in ${w.year}: added this year, or picked with Pick titles.`,
  });
  slides.push({
    kind: "big", eyebrow: "You watched", big: `${fmt(w.episodes)} episodes`,
    sub: [
      w.episodes ? (w.minutes < 90 ? `About ${fmt(Math.round(w.minutes))} minutes of anime.` : `About ${fmt(w.hours)} hours of anime.`) : null,
      w.chapters ? `And read ${fmt(w.chapters)} manga chapters.` : null,
      w.vsLastYear !== null ? (w.vsLastYear >= 0 ? `${w.vsLastYear}% more than last year.` : `${-w.vsLastYear}% less than last year.`) : null,
    ].filter(Boolean).join(" "),
  });
  if (w.topAnime.length) {
    slides.push({
      kind: "list", eyebrow: "Your top anime", unit: "episodes",
      items: w.topAnime, image: w.topAnime[0].item.image,
      sub: w.topShare >= 20 ? `${w.topAnime[0].item.title} alone was ${w.topShare}% of your episodes.` : null,
    });
  }
  if (w.topManga.length) {
    slides.push({ kind: "list", eyebrow: "Your top manga", unit: "chapters", items: w.topManga, image: w.topManga[0].item.image });
  }
  if (w.genres.length) {
    slides.push({
      kind: "stats", eyebrow: "Your top genre", big: w.genres[0].name,
      rows: w.genres.map((g) => [g.name, `${g.share}%`]),
      sub: w.studios[0] ? `Studio you watched most: ${w.studios[0].name}.` : null,
    });
  }
  const habits = [
    w.binge && [`Longest binge`, `${w.binge.count} ${w.habitUnit} on ${dateLabel(w.binge.date)}${w.binge.item ? ` (mostly ${w.binge.item.title})` : ""}`],
    w.streak > 1 && [`Days in a row`, `${w.streak}`],
    w.busiestMonth && [`Busiest month`, `${w.busiestMonth} (${fmt(w.busiestMonthCount)} ${w.habitUnit})`],
    w.favDay && [`Favourite day`, `${w.favDay}`],
  ].filter(Boolean);
  if (habits.length) slides.push({ kind: "stats", eyebrow: "How you watched", big: w.favDay ? `${w.favDay}s were yours` : "Your habits", rows: habits });
  if (w.verdictTotal) {
    slides.push({
      kind: "stats", eyebrow: "Your verdicts", big: `${w.verdictTotal} verdict${w.verdictTotal === 1 ? "" : "s"}`,
      rows: w.verdicts.filter((v) => v.count).map((v) => [v.label, `${v.count}`]),
      colors: Object.fromEntries(w.verdicts.map((v) => [v.label, v.color])),
      sub: w.latestPeak ? `Your latest Peak: ${w.latestPeak.title}.` : null,
    });
  }
  if (w.completed) {
    slides.push({
      kind: "big", eyebrow: "Completed & finished", big: `${w.completed} title${w.completed === 1 ? "" : "s"}`,
      sub: w.tierStart.key !== w.tierNow.key ? `Rank: ${w.tierStart.label} → ${w.tierNow.label}.` : `Rank: ${w.tierNow.label}.`,
      color: w.tierNow.color,
    });
  }
  slides.push({ kind: "summary" });
  return slides;
}
