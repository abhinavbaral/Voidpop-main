// Entry point (SDK 52+ style): registers the root component.
import { registerRootComponent } from "expo";
import App from "./App";
import { registerWidget } from "./src/widget";
import "./src/lib/backgroundWork"; // defines the background job (must load with the bundle)

registerRootComponent(App);
registerWidget(); // Android home-screen widget (no-op in Expo Go)
