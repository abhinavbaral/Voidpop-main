// Opens the phone's own "new event" screen, already filled in (title, first
// episode's time, repeats weekly for the remaining episodes). You tap Save.
// No calendar permission needed, because Voidation never writes to the calendar itself.
import * as Calendar from "expo-calendar";
import { Alert } from "react-native";
import { calendarPlan } from "@voidation/shared/calendar";

export async function addToCalendar(item) {
  const p = calendarPlan(item);
  if (!p) return;
  try {
    await Calendar.createEventInCalendarAsync({
      title: p.title,
      startDate: p.start,
      endDate: p.end,
      notes: p.notes,
      ...(p.count > 1 ? { recurrenceRule: { frequency: Calendar.Frequency.WEEKLY, occurrence: p.count } } : {}),
    });
  } catch {
    // no calendar app that accepts new events (Voidation doesn't open websites for this)
    Alert.alert("No calendar app", "Install a calendar app to add episodes to it.");
  }
}
