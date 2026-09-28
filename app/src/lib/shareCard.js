// Snapshot a View to a PNG file and open the OS share sheet.
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { notify } from "./notify";

export async function shareCardImage(viewRef) {
  const uri = await captureRef(viewRef, { format: "png", quality: 1 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  } else {
    notify("Saved", "Card image captured.");
  }
}
