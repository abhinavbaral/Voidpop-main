// The greeting on Explore's banner, by the hour on a 24-hour clock:
//   5:00 morning · 12:00 afternoon · 17:00 evening · 21:00 until 4:59 "Still up".
// With a name: "Good morning, Baral" / "Still up, Baral?".
export function greetingFor(hour = new Date().getHours(), name = "") {
  const who = String(name || "").trim();
  if (hour >= 21 || hour < 5) return who ? `Still up, ${who}?` : "Still up?";
  const base = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return who ? `${base}, ${who}` : base;
}
