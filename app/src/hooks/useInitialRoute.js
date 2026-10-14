// Which screen the app opens on: "Welcome" the first time, "Main" after that.
// Null for a moment while the saved flag is read (App shows a blank screen).
import { useEffect, useState } from "react";
import { isOnboarded } from "@voidation/shared/backend/store";

export default function useInitialRoute() {
  const [route, setRoute] = useState(null);
  useEffect(() => {
    let live = true;
    isOnboarded()
      .then((done) => live && setRoute(done ? "Main" : "Welcome"))
      .catch(() => live && setRoute("Main")); // can't read it: don't trap the user on Welcome
    return () => { live = false; };
  }, []);
  return route;
}
