// Voidation mobile app (Android + iOS). The website lives in /web; both share
// their logic through @voidation/shared. No accounts: your library lives on the phone.
import "./src/backend/init.js"; // must run first: plugs in AsyncStorage
// Tabs: Explore / Library / History / Schedule / More. (Browse opens from Explore.)

import {
  NavigationContainer, DarkTheme, DefaultTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { onDataChange, getPending, isOnboarded } from "@voidation/shared/backend/store";
import { AuthProvider } from "@voidation/shared/backend/AuthContext";
import { SettingsProvider } from "@voidation/shared/backend/SettingsContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext.js";
import ExploreScreen from "./src/screens/ExploreScreen.js";
import BrowseScreen from "./src/screens/BrowseScreen.js";
import PersonScreen from "./src/screens/PersonScreen.js";
import OnboardingScreen from "./src/screens/OnboardingScreen.js";
import ScheduleScreen from "./src/screens/ScheduleScreen.js";
import HistoryScreen from "./src/screens/HistoryScreen.js";
import MoreScreen from "./src/screens/MoreScreen.js";
import MorePageScreen from "./src/screens/MorePageScreen.js";
import DetailScreen from "./src/screens/DetailScreen.js";
import SearchScreen from "./src/screens/SearchScreen.js";
import LibraryScreen from "./src/screens/LibraryScreen.js";
import SeasonScreen from "./src/screens/SeasonScreen.js";
import WrappedScreen from "./src/screens/WrappedScreen.js";
import RewindPickScreen from "./src/screens/RewindPickScreen.js";
import TrendsScreen from "./src/screens/TrendsScreen.js";
import OfflineBanner from "./src/components/OfflineBanner.js";
import RankUp from "./src/components/RankUp.js";
import Icon from "./src/components/Icon.js";

const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();

// voidation://title/anime/123 and voidation://schedule open the right screen
// (used by the home-screen widget). The website has its own URLs.
const linking = Platform.OS === "web" ? undefined : {
  prefixes: ["voidation://"],
  config: {
    screens: {
      Main: { screens: { Schedule: "schedule", Library: "library", History: "history" } },
      Detail: "title/:segment/:id",
      Season: "season",
      Wrapped: "wrapped",
    },
  },
};

// Backups and episode alerts: run on launch, whenever the app returns to the
// foreground, and (alerts only) shortly after the library changes.
// Loaded lazily so the website build never touches the native-only modules.
function useBackgroundChores() {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const backup = require("./src/lib/backup");
    const alerts = require("./src/lib/episodeAlerts");
    const widget = require("./src/widget");
    require("./src/lib/backgroundWork").registerBackgroundWork();
    const sync = require("@voidation/shared/sync/anilist");
    const { promoteExcitedNow } = require("@voidation/shared/excited");
    const chores = () => {
      promoteExcitedNow(); // Excited anime that came out → Watching
      sync.syncNow({ reason: "open" });
      if (Platform.OS === "android") backup.maybeAutoBackup();
      alerts.rescheduleEpisodeAlerts();
      widget.updateWidget();
    };
    chores();
    const appState = AppState.addEventListener("change", (s) => { if (s === "active") chores(); });
    let timer;
    const stopData = onDataChange(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { alerts.rescheduleEpisodeAlerts(); widget.updateWidget(); }, 3000);
    });
    const stopTap = alerts.onAlertTapped((params) => {
      const go = () => navRef.navigate("Detail", params);
      if (navRef.isReady()) go(); else setTimeout(go, 800);
    });
    return () => { appState.remove(); stopData(); stopTap(); clearTimeout(timer); };
  }, []);
}
const Tabs = createBottomTabNavigator();

const ICONS = { Explore: "explore", Library: "library", History: "history", Schedule: "schedule", More: "more" };

// Pending episodes (aired, not watched) for the Schedule tab badge. Rechecked
// when your library changes and once a minute.
function usePendingCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const check = () => getPending().then((p) => setN(p.total)).catch(() => {});
    check();
    const stop = onDataChange(check);
    const timer = setInterval(check, 60000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  return n;
}

function MainTabs() {
  const { C } = useTheme();
  const pending = usePendingCount();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.faint,
        tabBarIcon: ({ color }) => (
          <Icon name={ICONS[route.name]} size={21} color={color} />
        ),
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "600" },
      })}
    >
      <Tabs.Screen name="Explore" component={ExploreScreen} />
      <Tabs.Screen name="Library" component={LibraryScreen} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          tabBarBadge: pending > 0 ? (pending > 99 ? "99+" : pending) : undefined,
          tabBarBadgeStyle: { backgroundColor: C.orange, color: "#fff", fontSize: 10 },
        }}
      />
      <Tabs.Screen name="More" component={MoreScreen} />
    </Tabs.Navigator>
  );
}

function ThemedApp() {
  const { C, dark } = useTheme();
  useBackgroundChores();
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: C.bg,
      card: C.bg,
      border: C.border,
      text: C.text,
      primary: C.orange,
    },
  };

  return (
    <NavigationContainer ref={navRef} theme={navTheme} linking={linking}
      // first run: the welcome screens, once
      onReady={() => { isOnboarded().then((done) => { if (!done) navRef.navigate("Onboarding"); }).catch(() => {}); }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        {/* getId: opening a different title pushes a new screen instead of
            reusing the existing Detail screen with stale state */}
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          getId={({ params }) => (params ? `${params.segment}:${params.id}` : undefined)}
        />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="MorePage" component={MorePageScreen} />
        <Stack.Screen name="Season" component={SeasonScreen} />
        <Stack.Screen name="Browse" component={BrowseScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="Person" component={PersonScreen} getId={({ params }) => (params ? String(params.id) : undefined)} />
        <Stack.Screen name="Wrapped" component={WrappedScreen} options={{ animation: "fade" }} />
        <Stack.Screen name="RewindPick" component={RewindPickScreen} />
        <Stack.Screen name="Trends" component={TrendsScreen} />
      </Stack.Navigator>
      <OfflineBanner />
      <RankUp />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <ThemedApp />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
