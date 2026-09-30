// Turns Rewind story images into an MP4 inside a hidden WebView (the phone's
// own browser engine has a video encoder, WebCodecs), so the app needs no
// native video library. The page is src/lib/storyVideoHtml.js, built from
// shared/storyVideo.js.
//
//   <StoryVideoMaker frames={[base64 jpg, …]} width={720} height={1280} music
//     onProgress={(0..1) => …} onDone={({ uri, h264, audio }) => …} onError={(message) => …} />
// music: add the app's own background track (shared/storyMusic.js)
// Mount it to start; unmount it to cancel.
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { cacheDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import { STORY_VIDEO_HTML } from "../lib/storyVideoHtml.js";

export default function StoryVideoMaker({ frames, width = 720, height = 1280, music = false, onProgress, onDone, onError }) {
  const web = useRef(null);
  const chunks = useRef([]);
  const finished = useRef(false);
  const cb = useRef({ onProgress, onDone, onError });
  cb.current = { onProgress, onDone, onError };

  // if the page never answers (very old WebView), give up instead of spinning forever
  useEffect(() => {
    const t = setTimeout(() => { if (!finished.current) { finished.current = true; cb.current.onError?.("TIMEOUT"); } }, 180000);
    return () => clearTimeout(t);
  }, []);

  const onMessage = async (e) => {
    let m;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (finished.current) return;
    if (m.type === "ready") {
      if (!m.webcodecs) { finished.current = true; cb.current.onError?.("NO_VIDEO"); return; }
      frames.forEach((data) => web.current?.postMessage(JSON.stringify({ type: "frame", data })));
      web.current?.postMessage(JSON.stringify({ type: "go", width, height, music }));
    } else if (m.type === "progress") {
      cb.current.onProgress?.(m.p);
    } else if (m.type === "chunk") {
      chunks.current[m.i] = m.data;
    } else if (m.type === "done") {
      finished.current = true;
      try {
        const uri = `${cacheDirectory}voidation-rewind-${Date.now()}.mp4`;
        await writeAsStringAsync(uri, chunks.current.join(""), { encoding: "base64" });
        cb.current.onDone?.({ uri, h264: m.h264, audio: m.audio });
      } catch (err) {
        cb.current.onError?.(String(err?.message || err));
      }
    } else if (m.type === "error") {
      finished.current = true;
      cb.current.onError?.(m.message);
    }
  };

  return (
    <View pointerEvents="none" style={{ position: "absolute", width: 2, height: 2, opacity: 0, left: 0, top: 0 }}>
      <WebView
        ref={web}
        originWhitelist={["*"]}
        // an https address makes the page a "secure context", which WebCodecs needs
        source={{ html: STORY_VIDEO_HTML, baseUrl: "https://voidation.app/" }}
        onMessage={onMessage}
        javaScriptEnabled
        style={{ width: 2, height: 2 }}
      />
    </View>
  );
}
