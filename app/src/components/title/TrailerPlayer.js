// Trailer: the video's thumbnail with a YouTube play button. Tapping opens the
// trailer in the YouTube app (or the browser if YouTube isn't installed).
//
// Why not play it inside the app: since 2025 YouTube rejects embeds that can't
// prove which website they're on ("Error 153: video player configuration
// error"), and an app's WebView has no website to prove.
import { Pressable, ImageBackground, View, Text, Linking, StyleSheet } from "react-native";

export default function TrailerPlayer({ videoId, style }) {
  const open = () =>
    Linking.openURL(`vnd.youtube://watch?v=${videoId}`).catch(() =>
      Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)
    );
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Watch the trailer on YouTube" style={style}>
      <ImageBackground
        source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }}
        style={styles.fill}
        resizeMode="cover"
      >
        <View style={styles.shade} />
        <View style={styles.logo}>
          <View style={styles.play} />
        </View>
        <Text style={styles.label}>Watch trailer on YouTube</Text>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  // YouTube's red rounded-rectangle play button, drawn with views
  logo: {
    width: 68, height: 48, borderRadius: 14, backgroundColor: "#FF0000",
    alignItems: "center", justifyContent: "center",
  },
  play: {
    width: 0, height: 0, marginLeft: 4,
    borderTopWidth: 11, borderBottomWidth: 11, borderLeftWidth: 19,
    borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "#fff",
  },
  label: {
    position: "absolute", bottom: 10, color: "#fff", fontSize: 12, fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden",
  },
});
