// voidation://title/anime/123 and voidation://schedule open the right screen
// (used by the home-screen widget).
import { Platform } from "react-native";

export const linking = Platform.OS === "web" ? undefined : {
  prefixes: ["voidation://"],
  config: {
    screens: {
      Main: { screens: { Schedule: "schedule", Library: "library", History: "history" } },
      Detail: "title/:segment/:id",
      Season: "season",
    },
  },
};
