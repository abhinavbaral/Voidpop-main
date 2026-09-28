// Entry point (SDK 52+ style): registers the root component.
import { registerRootComponent } from "expo";
import App from "./App";
import { registerWidget } from "./src/widget";

registerRootComponent(App);
registerWidget(); // Android home-screen widget (no-op in Expo Go)
