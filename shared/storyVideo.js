// The Rewind story as a VIDEO: each story image (1080 x 1920 on the website,
// 720 x 1280 in the app) is shown for a few seconds with a slow zoom and a
// soft fade into the next, then encoded as an MP4 (H.264), which Instagram,
// WhatsApp, Facebook and YouTube Shorts all accept.
//
// It runs in a browser engine using WebCodecs: on the website directly, and in
// the app inside a hidden WebView (app/src/components/StoryVideoMaker.js), so
// no native video library is needed. Mp4Muxer comes from the mp4-muxer package
// (passed in, because the WebView gets it as a plain script).
//
// makeStoryVideo(Mp4Muxer, images, { width, height, fps, seconds, fade, music, onProgress })
//   images: things canvas can draw (canvas, ImageBitmap, <img>) in story shape
//   music: an AudioBuffer to put underneath (see storyMusic.js), or null
//   → { bytes: Uint8Array of the .mp4, h264: true/false, audio: true/false }. H.264 is what every
//     app accepts; browsers without it (open-source Chromium builds) fall back
//     to VP9 inside the MP4, which plays almost everywhere but Instagram may
//     refuse. Throws Error("NO_VIDEO") if neither works.

const CODECS = [
  ...["avc1.640028", "avc1.4d0028", "avc1.42002a", "avc1.42001f"].map((codec) => ({ codec, mux: "avc" })),
  { codec: "vp09.00.10.08", mux: "vp9" },
];

// the soundtrack as AAC (what every app plays), else Opus
async function audioConfig(music) {
  if (!music || typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") return null;
  for (const [codec, mux] of [["mp4a.40.2", "aac"], ["opus", "opus"]]) {
    const c = { codec, sampleRate: music.sampleRate, numberOfChannels: music.numberOfChannels, bitrate: 128000 };
    try { if ((await AudioEncoder.isConfigSupported(c)).supported) return { config: c, mux }; } catch { /* next */ }
  }
  return null;
}

// feed the whole AudioBuffer to the encoder in 0.1 s pieces
async function encodeAudio(music, config, muxer) {
  let failure = null;
  const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failure = e; } });
  enc.configure(config);
  const rate = music.sampleRate, channels = music.numberOfChannels, step = Math.round(rate / 10);
  const planes = Array.from({ length: channels }, (_, c) => music.getChannelData(c));
  for (let off = 0; off < music.length; off += step) {
    const n = Math.min(step, music.length - off);
    const data = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) data.set(planes[c].subarray(off, off + n), c * n);
    const ad = new AudioData({ format: "f32-planar", sampleRate: rate, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round((off / rate) * 1e6), data });
    enc.encode(ad);
    ad.close();
    if (failure) throw failure;
  }
  await enc.flush();
  enc.close();
  if (failure) throw failure;
}

export async function makeStoryVideo(Mp4Muxer, images, {
  width = 1080, height = 1920, fps = 30, seconds = 3, fade = 0.5, music = null, onProgress,
} = {}) {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") throw new Error("NO_VIDEO");
  let config = null;
  let mux = null;
  for (const option of CODECS) {
    const c = { codec: option.codec, width, height, framerate: fps, bitrate: Math.round(5e6 * (width * height) / (1080 * 1920)) };
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) { config = c; mux = option.mux; break; } } catch { /* try the next one */ }
  }
  if (!config) throw new Error("NO_VIDEO");

  const audio = await audioConfig(music);
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: mux, width, height, frameRate: fps },
    ...(audio ? { audio: { codec: audio.mux, sampleRate: music.sampleRate, numberOfChannels: music.numberOfChannels } } : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e; },
  });
  encoder.configure(config);

  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  const per = Math.round(seconds * fps);
  const fadeFrames = Math.round(fade * fps);
  const total = per * images.length;
  // t: 0 → 1 through a slide's time on screen; the picture grows 5% (slow zoom)
  const draw = (img, t, alpha) => {
    const z = 1 + 0.05 * t;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (width - width * z) / 2, (height - height * z) / 2, width * z, height * z);
  };

  for (let f = 0; f < total; f++) {
    if (failure) throw failure;
    const i = Math.floor(f / per);
    const local = f % per;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, width, height);
    draw(images[i], local / per, 1);
    if (i + 1 < images.length && local >= per - fadeFrames) draw(images[i + 1], 0, (local - (per - fadeFrames)) / fadeFrames);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / fps), duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    // let the encoder catch up instead of queueing hundreds of frames
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    if (onProgress && f % 10 === 0) onProgress(f / total);
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  if (audio) await encodeAudio(music, audio.config, muxer);
  muxer.finalize();
  onProgress?.(1);
  return { bytes: new Uint8Array(muxer.target.buffer), h264: mux === "avc", audio: !!audio };
}
