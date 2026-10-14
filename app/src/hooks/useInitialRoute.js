// Which screen the app opens on: always "Welcome" (the swipe-to-start screen).
// Swiping goes on to Main, or to Onboarding on a first run (see WelcomeScreen).
// If the app is opened from a link (widget tap, notification), React Navigation
// uses that link's screen instead, so Welcome never covers what was tapped.
export default function useInitialRoute() {
  return "Welcome";
}
