// Achievements: badges for HOW you watch (streaks, night owl, bingeing…),
// shown on the Your badge page under the ranks. Ranks answer "how much have
// you finished"; achievements answer "how do you watch", so none of them just
// counts finished titles again. Everything comes from this phone's own data: the watch
// log (every episode/chapter you mark, with its time), the library and your
// Void Verdicts. Nothing is sent anywhere.
//
// computeAchievements() → [{ key, name, text, icon, color, have, need, done, earned }]
//   have / need drive the progress bar ("47 / 90"). `earned` is what the "N earned"
//   count uses. A LEVELED achievement (Blaze, Rank Collector) is one badge that grows
//   through several goals; it also has { levels, level, maxLevel }. `need` is then the
//   next goal, and `done` means the top level is reached.

import { getLog, getLibrary, getReviews, totalFor, isDone, getRanksCollected } from "../backend/store.js";

const dayStart = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const isProgress = ([, , change, source]) => change > 0 && source !== "complete" && !String(source).startsWith("status:");

// How many of the goals (ascending) a count has reached: 0 = none yet.
export const levelFor = (have, levels) => levels.filter((n) => have >= n).length;

// One badge that grows through several goals. `goal(n)` words the goal for n.
function leveled({ key, name, icon, colors, levels, have, goal }) {
  const level = levelFor(have, levels);
  const need = levels[Math.min(level, levels.length - 1)]; // the next goal, or the last once maxed
  return {
    key, name, icon, levels, level, maxLevel: levels.length,
    color: colors[Math.max(level, 1) - 1], text: goal(need),
    have: Math.min(have, need), need, done: level === levels.length, earned: level >= 1,
  };
}

// longest run of days in a row with at least one episode/chapter marked
export function longestStreak(log) {
  const days = [...new Set(log.filter(isProgress).map(([t]) => dayStart(t)))].sort((a, b) => a - b);
  let best = days.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = Math.round((days[i] - days[i - 1]) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export async function computeAchievements() {
  const [log, lib, reviews] = await Promise.all([getLog(), getLibrary(), getReviews()]);
  const entries = Object.values(lib);
  const amount = (e) => (isDone(e.status) ? Math.max(e.progress || 0, totalFor(e.item) || 0) : e.progress || 0);
  const episodes = entries.filter((e) => e.item.segment === "anime").reduce((n, e) => n + amount(e), 0);
  const chapters = entries.filter((e) => e.item.segment === "manga").reduce((n, e) => n + amount(e), 0);
  const doneAll = entries.filter((e) => isDone(e.status)).length;
  const streak = longestStreak(log);
  const progress = log.filter(isProgress);
  // episodes marked between midnight and 4 AM, your phone's time
  const lateNight = progress.filter(([t, key]) => key.startsWith("anime:") && new Date(t).getHours() < 4).reduce((n, [, , c]) => n + c, 0);
  // most episodes marked in one day
  const perDay = new Map();
  progress.filter(([, key]) => key.startsWith("anime:")).forEach(([t, , c]) => perDay.set(dayStart(t), (perDay.get(dayStart(t)) || 0) + c));
  const bestDay = Math.max(0, ...perDay.values());
  const peaks = reviews.filter((r) => r.verdict === "peak").length;
  const ranks = await getRanksCollected();

  const list = [
    { key: "junior", name: "Junior", text: "Finish your first anime or manga", icon: "spring", color: "#10b981", have: doneAll, need: 1 },
    // days in a row with at least one episode or chapter marked
    leveled({
      key: "blaze", name: "Blaze", icon: "flame", have: streak,
      levels: [1, 7, 15, 30, 90], colors: ["#facc15", "#38bdf8", "#fb923c", "#f97316", "#ef4444"],
      goal: (n) => (n === 1 ? "Watch or read on 1 day" : `Keep a ${n}-day streak`),
    }),
    // how many of the 15 ranks you have reached (Newbie counts as the first)
    leveled({
      key: "rankCollector", name: "Rank Collector", icon: "trophy", have: ranks,
      levels: [1, 5, 8, 10, 15], colors: ["#9ca3af", "#38bdf8", "#34d399", "#f59e0b", "#a855f7"],
      goal: (n) => `Collect ${n} ${n === 1 ? "rank" : "ranks"}`,
    }),
    { key: "binger", name: "Binger", text: "Watch 12 episodes in one day", icon: "bolt", color: "#facc15", have: bestDay, need: 12 },
    { key: "owl", name: "Night Owl", text: "Watch 80 episodes between midnight and 4 AM", icon: "moon", color: "#a78bfa", have: lateNight, need: 80 },
    { key: "otaku", name: "Otaku", text: "Watch 2,000 episodes", icon: "tv", color: "#a855f7", have: episodes, need: 2000 },
    { key: "geek", name: "Geek", text: "Read 2,000 chapters", icon: "book", color: "#60a5fa", have: chapters, need: 2000 },
    { key: "critic", name: "Critic's Pen", text: "Give 50 Void Verdicts", icon: "edit", color: "#ec4899", have: reviews.length, need: 50 },
    { key: "peak", name: "Peak Hunter", text: "Call 10 titles Peak", icon: "star", color: "#c084fc", have: peaks, need: 10 },
  ];
  // single-goal badges: earned = done; leveled ones come back finished
  return list.map((a) => (a.levels ? a : { ...a, have: Math.min(a.have, a.need), done: a.have >= a.need, earned: a.have >= a.need }));
}
