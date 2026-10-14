// Every screen that sits on top of the tabs. `initialRouteName` is "Welcome" on
// the first launch and "Main" after that (see hooks/useInitialRoute).
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import DetailScreen from "../screens/title/DetailScreen";
import PersonScreen from "../screens/title/PersonScreen";
import SearchScreen from "../screens/explore/SearchScreen";
import SeasonScreen from "../screens/explore/SeasonScreen";
import BrowseScreen from "../screens/explore/BrowseScreen";
import TrendsScreen from "../screens/explore/TrendsScreen";
import MorePageScreen from "../screens/more/MorePageScreen";
import WelcomeScreen from "../screens/welcome/WelcomeScreen";
import OnboardingScreen from "../screens/welcome/OnboardingScreen";

const Stack = createNativeStackNavigator();
const fade = { animation: "fade", gestureEnabled: false };

export default function RootNavigator({ initialRouteName }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
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
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={fade} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={fade} />
      <Stack.Screen name="Person" component={PersonScreen} getId={({ params }) => (params ? String(params.id) : undefined)} />
      <Stack.Screen name="Trends" component={TrendsScreen} />
    </Stack.Navigator>
  );
}
