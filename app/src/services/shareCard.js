// Snapshot a View to a PNG file and open the OS share sheet.
//   shareCardImage(ref)                  the view at its own size
//   shareCardImage(ref, { story: true }) a 1080 x 1920 story image (9:16, the
//     size Instagram, WhatsApp and Facebook stories use)
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { notify } from "./notify";

export async function shareCardImage(viewRef, { story = false } = {}) {
  const uri = await captureRef(viewRef, { format: "png", quality: 1, ...(story ? { width: 1080, height: 1920 } : {}) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: story ? "Share your story" : undefined });
  } else {
    notify("Saved", "Card image captured.");
  }
}
