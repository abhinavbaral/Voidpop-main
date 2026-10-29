// Every screen that sits on top of the tabs. `initialRouteName` is "Welcome" on
// the first launch and "Main" after that (see hooks/useInitialRoute).
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import TitleScreen from "../screens/title/TitleScreen";
import AccountScreen from "../screens/account/AccountScreen";
import SignInScreen from "../screens/account/SignInScreen";
import PersonScreen from "../screens/title/PersonScreen";
import SearchScreen from "../screens/explore/SearchScreen";
import SeasonScreen from "../screens/explore/SeasonScreen";
import BrowseScreen from "../screens/explore/BrowseScreen";
import TrendsScreen from "../screens/explore/TrendsScreen";
import ExploreCategoryScreen from "../screens/explore/ExploreCategoryScreen";
import PlaylistScreen from "../screens/library/PlaylistScreen";
import MorePageScreen from "../screens/more/MorePageScreen";
import WelcomeScreen from "../screens/welcome/WelcomeScreen";
import OnboardingScreen from "../screens/welcome/OnboardingScreen";
import VoidAIScreen from "../screens/ai/VoidAIScreen";

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
        component={TitleScreen}
        getId={({ params }) => (params ? `${params.segment}:${params.id}` : undefined)}
      />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={fade} />
      <Stack.Screen name="MorePage" component={MorePageScreen} />
      <Stack.Screen name="Season" component={SeasonScreen} />
      <Stack.Screen name="Browse" component={BrowseScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={fade} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={fade} />
      <Stack.Screen name="Person" component={PersonScreen} getId={({ params }) => (params ? String(params.id) : undefined)} />
      <Stack.Screen name="Trends" component={TrendsScreen} />
      <Stack.Screen name="ExploreCategory" component={ExploreCategoryScreen} />
      <Stack.Screen name="Playlist" component={PlaylistScreen} />
      <Stack.Screen name="VoidAI" component={VoidAIScreen} />
    </Stack.Navigator>
  );
}
