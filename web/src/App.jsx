// Voidation website. Same shared logic as the mobile app (see /shared); only
// this UI layer is web-specific. No accounts: your library lives in this browser.
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { TopNav, BottomTabs } from "./components/Nav.jsx";
import Explore from "./pages/Explore.jsx";
import Browse from "./pages/Browse.jsx";
import Schedule from "./pages/Schedule.jsx";
import Title from "./pages/Title.jsx";
import Search from "./pages/Search.jsx";
import Library from "./pages/Library.jsx";
import History from "./pages/History.jsx";
import Season from "./pages/Season.jsx";
import AuthAniList from "./pages/AuthAniList.jsx";
import Wrapped from "./pages/Wrapped.jsx";
import More from "./pages/More.jsx";
import NotFound from "./pages/NotFound.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import RankUp from "./components/RankUp.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { promoteExcitedNow } from "@voidation/shared/excited";

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]); // new page starts at the top
  // Excited anime that came out move to Watching: on open, then every 30 minutes
  useEffect(() => {
    promoteExcitedNow();
    const t = setInterval(promoteExcitedNow, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <TopNav />
      <main id="main" className="page">
        <ErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/new" element={<Navigate to="/schedule" replace />} />
          <Route path="/title/:segment/:id" element={<Title />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<Library />} />
          <Route path="/history" element={<History />} />
          <Route path="/season" element={<Season />} />
          <Route path="/auth/anilist" element={<AuthAniList />} />
          <Route path="/wrapped" element={<Wrapped />} />
          <Route path="/upcoming" element={<Navigate to="/schedule?view=week" replace />} />
          <Route path="/more" element={<More />} />
          <Route path="/more/:page" element={<More />} />
          <Route path="/profile" element={<Navigate to="/more" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <OfflineBanner />
      <RankUp />
      <BottomTabs />
    </>
  );
}
