// The five bottom tabs: Explore / Library / History / Schedule / More.
// (Browse opens from Explore.)
import { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { onDataChange, getPending } from "@voidpop/shared/backend/store";
import { useTheme } from "../context/ThemeContext";
import Icon from "../components/ui/Icon";
import ExploreScreen from "../screens/explore/ExploreScreen";
import LibraryScreen from "../screens/library/LibraryScreen";
import HistoryScreen from "../screens/schedule/HistoryScreen";
import ScheduleScreen from "../screens/schedule/ScheduleScreen";
import MoreScreen from "../screens/more/MoreScreen";

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

export default function MainTabs() {
  const { C } = useTheme();
  const pending = usePendingCount();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.border },
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.faint,
        tabBarIcon: ({ color }) => <Icon name={ICONS[route.name]} size={21} color={color} />,
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
