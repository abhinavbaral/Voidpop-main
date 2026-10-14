// Current time that re-renders every `ms` — drives live countdowns.
// One timer per screen, not per countdown.
import { useEffect, useState } from "react";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
