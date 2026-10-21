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

const TAB_ICONS = {
  Explore: "explore",
  Library: "library",
  History: "history",
  Schedule: "schedule",
  More: "more",
};

// Count aired episodes that have not yet been watched.
// Refresh when library data changes and periodically while the app is open.
function usePendingCount() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;

    const refreshPendingCount = async () => {
      try {
        const pending = await getPending();

        if (active) {
          setPendingCount(pending?.total ?? 0);
        }
      } catch {
        // Keep the last known count if pending episodes cannot be loaded.
      }
    };

    refreshPendingCount();

    const unsubscribe = onDataChange(refreshPendingCount);
    const interval = setInterval(refreshPendingCount, 60_000);

    return () => {
      active = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return pendingCount;
}

export default function MainTabs() {
  const { C } = useTheme();
  const pendingCount = usePendingCount();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
        },

        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.faint,

        tabBarIcon: ({ color }) => (
          <Icon
            name={TAB_ICONS[route.name]}
            size={21}
            color={color}
          />
        ),

        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: "600",
        },
      })}
    >
      <Tabs.Screen
        name="Explore"
        component={ExploreScreen}
      />

      <Tabs.Screen
        name="Library"
        component={LibraryScreen}
      />

      <Tabs.Screen
        name="History"
        component={HistoryScreen}
      />

      <Tabs.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{
          tabBarBadge:
            pendingCount > 0
              ? pendingCount > 99
                ? "99+"
                : pendingCount
              : undefined,

          tabBarBadgeStyle: {
            backgroundColor: C.orange,
            color: "#fff",
            fontSize: 10,
          },
        }}
      />

      <Tabs.Screen
        name="More"
        component={MoreScreen}
      />
    </Tabs.Navigator>
  );
}
