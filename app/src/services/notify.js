// Small wrapper so screens don't depend on Alert directly.
import { Alert } from "react-native";

export function notify(title, message) {
  Alert.alert(title, message);
}
