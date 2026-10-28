// VoidPop mobile app (Android + iOS). No accounts: your library lives on the phone.
// This file only wires things together; the screens are in src/screens, the
// navigation in src/navigation, and the logic in @voidpop/shared.
import "./src/bootstrap/init.js"; // must run first: plugs in AsyncStorage

import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { AuthProvider } from "@voidpop/shared/backend/AuthContext";
import { SettingsProvider } from "@voidpop/shared/backend/SettingsContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { navRef } from "./src/navigation/navRef";
import { linking } from "./src/navigation/linking";
import useBackgroundChores from "./src/hooks/useBackgroundChores";
import useInitialRoute from "./src/hooks/useInitialRoute";
import OfflineBanner from "./src/components/ui/OfflineBanner";
import RankUp from "./src/components/library/RankUp";
import SignInNudge from "./src/components/account/SignInNudge";

function ThemedApp() {
  const { C, dark } = useTheme();
  const initialRoute = useInitialRoute();
  useBackgroundChores();

  if (!initialRoute) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: C.bg, card: C.bg, border: C.border, text: C.text, primary: C.orange },
  };

  return (
    <NavigationContainer ref={navRef} theme={navTheme} linking={linking}>
      <StatusBar style={dark ? "light" : "dark"} />
      <RootNavigator initialRouteName={initialRoute} />
      <OfflineBanner />
      <RankUp />
      <SignInNudge />
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
