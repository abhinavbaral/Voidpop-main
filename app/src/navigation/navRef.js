// One navigation ref for the whole app, so code outside a screen (a tapped
// episode alert) can open a title.
import { createNavigationContainerRef } from "@react-navigation/native";

export const navRef = createNavigationContainerRef();
