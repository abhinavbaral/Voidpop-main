// VOIDATION WRAPPED — your year, from your own watch log. One user, one device:
// no "top 1% of fans" (that needs everyone's data); every comparison is with
// yourself: your busiest month, your favourite day, this year vs last year.
//
// What counts: episodes and chapters you marked (+1, typed, History's "Mark
// watched") during the year. Imports, AniList pulls and the progress filled in
// by marking a title Completed don't count, so old viewing isn't mistaken for
// this year's.

import { getLog, getLibrary, getReviews, getStats, tierFor, VERDICTS } from "./backend/store.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_EP_MIN = 24;

const isProgress = ([, , change, source]) => change !== 0 && source !== "complete" && !String(source).startsWith("status:");
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const inYear = (t, year) => new Date(t).getFullYear() === year;

// Years that have anything logged, newest first (always includes this year).
export async function wrappedYears() {
  const years = new Set([new Date().getFullYear()]);
  (await getLog()).forEach(([t]) => years.add(new Date(t).getFullYear()));
  return [...years].sort((a, b) => b - a);
}

function sumByKey(entries) {
  const per = new Map();
  entries.forEach(([, key, change]) => per.set(key, (per.get(key) || 0) + change));
  per.forEach((n, k) => { if (n <= 0) per.delete(k); }); // corrections below zero don't count
  return per;
}

export async function computeWrapped(year = new Date().getFullYear()) {
  const [log, lib, reviews, stats] = await Promise.all([getLog(), getLibrary(), getReviews(), getStats()]);
  const yearLog = log.filter(([t]) => inYear(t, year));
  const prog = yearLog.filter(isProgress);
  const per = sumByKey(prog);
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

  // completed this year, rank climb
  const completedKeys = new Set(yearLog.filter(([, , , s]) => s === "status:completed").map(([, k]) => k));
  const completed = completedKeys.size;
  const tierNow = tierFor(stats.totalCompleted);
  const tierStart = tierFor(Math.max(0, stats.totalCompleted - completed));

  // verdicts given this year
  const yearReviews = reviews.filter((r) => r.date && inYear(new Date(r.date).getTime(), year));
  const verdicts = VERDICTS.map((v) => ({ ...v, count: yearReviews.filter((r) => r.verdict === v.key).length }));
  const latestPeak = yearReviews
    .filter((r) => r.verdict === "peak")
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => lib[`${r.segment}:${r.titleId}`]?.item)
    .find(Boolean) || null;

  // you vs last year (only if last year has anything)
  const lastYearEps = [...sumByKey(log.filter(([t]) => inYear(t, year - 1)).filter(isProgress)).entries()]
    .filter(([k]) => seg(k) === "anime").reduce((n, [, c]) => n + c, 0);

  const first = prog.length ? Math.min(...prog.map(([t]) => t)) : null;
  return {
    year,
    empty: episodes + chapters === 0,
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

const fmt = (n) => n.toLocaleString();
const dateLabel = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long" });

// The story, as plain slide data both the app and the website draw the same way.
// kind: "big" (one headline number), "list" (ranked titles), "stats" (label/value rows), "summary" (the share card)
export function wrappedSlides(w) {
  if (w.empty) {
    return [{
      kind: "big", eyebrow: `Voidation Wrapped ${w.year}`, big: "Nothing yet",
      sub: "Your Wrapped builds itself from the episodes and chapters you mark. Tap +1 as you watch and come back later.",
    }];
  }
  const slides = [];
  slides.push({
    kind: "big", eyebrow: `Voidation Wrapped ${w.year}`, big: `Your ${w.year}`,
    sub: w.startedLogging ? `Everything you marked since ${dateLabel(w.startedLogging)}, when Voidation started keeping track.` : "Everything you watched and read this year.",
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
      kind: "big", eyebrow: "You finished", big: `${w.completed} title${w.completed === 1 ? "" : "s"}`,
      sub: w.tierStart.key !== w.tierNow.key ? `Rank: ${w.tierStart.label} → ${w.tierNow.label}.` : `Rank: ${w.tierNow.label}.`,
      color: w.tierNow.color,
    });
  }
  slides.push({ kind: "summary" });
  return slides;
}
