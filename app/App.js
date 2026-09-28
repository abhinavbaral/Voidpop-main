// Voidation mobile app (Android + iOS). The website lives in /web; both share
// their logic through @voidation/shared. No accounts: your library lives on the phone.
import "./src/backend/init.js"; // must run first: plugs in AsyncStorage
// Tabs: Explore / Library / Browse / History / Schedule / More.

import {
  NavigationContainer, DarkTheme, DefaultTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, AppState, Platform } from "react-native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { onDataChange } from "@voidation/shared/backend/store";
import { AuthProvider } from "@voidation/shared/backend/AuthContext";
import { SettingsProvider } from "@voidation/shared/backend/SettingsContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext.js";
import ExploreScreen from "./src/screens/ExploreScreen.js";
import BrowseScreen from "./src/screens/BrowseScreen.js";
import ScheduleScreen from "./src/screens/ScheduleScreen.js";
import HistoryScreen from "./src/screens/HistoryScreen.js";
import MoreScreen from "./src/screens/MoreScreen.js";
import MorePageScreen from "./src/screens/MorePageScreen.js";
import DetailScreen from "./src/screens/DetailScreen.js";
import SearchScreen from "./src/screens/SearchScreen.js";
import LibraryScreen from "./src/screens/LibraryScreen.js";

const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();

// Backups and episode alerts: run on launch, whenever the app returns to the
// foreground, and (alerts only) shortly after the library changes.
// Loaded lazily so the website build never touches the native-only modules.
function useBackgroundChores() {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const backup = require("./src/lib/backup");
    const alerts = require("./src/lib/episodeAlerts");
    const chores = () => {
      if (Platform.OS === "android") backup.maybeAutoBackup();
      alerts.rescheduleEpisodeAlerts();
    };
    chores();
    const appState = AppState.addEventListener("change", (s) => { if (s === "active") chores(); });
    let timer;
    const stopData = onDataChange(() => { clearTimeout(timer); timer = setTimeout(alerts.rescheduleEpisodeAlerts, 3000); });
    const stopTap = alerts.onAlertTapped((params) => {
      const go = () => navRef.navigate("Detail", params);
      if (navRef.isReady()) go(); else setTimeout(go, 800);
    });
    return () => { appState.remove(); stopData(); stopTap(); clearTimeout(timer); };
  }, []);
}
const Tabs = createBottomTabNavigator();

const ICONS = {
  Explore: "✦",
  Library: "▤",
  Browse: "▦",
  History: "↺",
  Schedule: "◷",
  More: "•••",
};

function MainTabs() {
  const { C } = useTheme();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.faint,
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 16 }}>{ICONS[route.name]}</Text>
        ),
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "600" },
      })}
    >
      <Tabs.Screen name="Explore" component={ExploreScreen} />
      <Tabs.Screen name="Library" component={LibraryScreen} />
      <Tabs.Screen name="Browse" component={BrowseScreen} />
      <Tabs.Screen name="History" component={HistoryScreen} />
      <Tabs.Screen name="Schedule" component={ScheduleScreen} />
      <Tabs.Screen name="More" component={MoreScreen} />
    </Tabs.Navigator>
  );
}

function ThemedApp() {
  const { C, mode } = useTheme();
  useBackgroundChores();
  const navTheme = {
    ...(mode === "void" ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === "void" ? DarkTheme.colors : DefaultTheme.colors),
      background: C.bg,
      card: C.bg,
      border: C.border,
      text: C.text,
      primary: C.orange,
    },
  };

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <StatusBar style={mode === "void" ? "light" : "dark"} />
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
      </Stack.Navigator>
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
