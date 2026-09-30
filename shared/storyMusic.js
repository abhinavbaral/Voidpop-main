// An original background track for the Rewind video, made by the app itself
// (no recording, no licence to worry about): a calm A-minor loop
// (Am – F – C – G) with a soft pad, a bass pulse, a plucked arpeggio with an
// echo, a light kick and hi-hat. Rendered with the browser's OfflineAudioContext
// (website, or the app's hidden WebView), fading in and out.
//
// renderSoundtrack(seconds) → AudioBuffer (48 kHz stereo)

const CHORDS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];
const BEAT = 0.625; // 96 beats a minute
const BAR = BEAT * 4;

export async function renderSoundtrack(seconds, sampleRate = 48000) {
  const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Ctx) throw new Error("NO_AUDIO");
  const ctx = new Ctx(2, Math.ceil(seconds * sampleRate), sampleRate);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.9, 0.8);
  master.gain.setValueAtTime(0.9, Math.max(0.8, seconds - 2));
  master.gain.linearRampToValueAtTime(0, seconds);
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  // echo for the arpeggio
  const echo = ctx.createDelay(1);
  echo.delayTime.value = BEAT * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  echo.connect(feedback).connect(echo);
  echo.connect(master);

  const tone = (type, freq, start, length, peak, { attack = 0.01, release = 0.2, to = master, detune = 0, cutoff = null } = {}) => {
    if (start >= seconds) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.setValueAtTime(peak, start + Math.max(attack, length - release));
    g.gain.linearRampToValueAtTime(0, start + length);
    let node = osc;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cutoff; node.connect(f); node = f; }
    node.connect(g).connect(to);
    osc.start(start);
    osc.stop(start + length + 0.05);
  };

  // noise for the hi-hat
  const noise = ctx.createBuffer(1, sampleRate * 0.1, sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const hat = (start) => {
    if (start >= seconds) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
    src.connect(hp).connect(g).connect(master);
    src.start(start);
  };
  const kick = (start) => {
    if (start >= seconds) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(120, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.25);
    g.gain.setValueAtTime(0.55, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + 0.32);
  };

  for (let bar = 0; bar * BAR < seconds; bar++) {
    const t0 = bar * BAR;
    const chord = CHORDS[bar % CHORDS.length];
    // pad: two slightly detuned saws per note, softened
    chord.forEach((f) => {
      tone("sawtooth", f, t0, BAR + 0.1, 0.035, { attack: 0.5, release: 0.6, detune: -7, cutoff: 1100 });
      tone("sawtooth", f, t0, BAR + 0.1, 0.035, { attack: 0.5, release: 0.6, detune: 7, cutoff: 1100 });
    });
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * BEAT;
      tone("sine", chord[0] / 2, t, BEAT * 0.9, 0.2, { attack: 0.02, release: 0.3 }); // bass
      if (bar > 0 && (b === 0 || b === 2)) kick(t); // drums come in after the first bar
      if (bar > 0) hat(t + BEAT / 2);
    }
    // arpeggio in eighth notes, an octave up, from the second bar
    if (bar > 0) {
      const notes = [chord[0], chord[1], chord[2], chord[1] * 2 > 900 ? chord[1] : chord[1] * 2];
      for (let e = 0; e < 8; e++) {
        const t = t0 + (e * BEAT) / 2;
        tone("triangle", notes[e % 4] * 2, t, 0.28, 0.06, { attack: 0.005, release: 0.2, to: master });
        tone("triangle", notes[e % 4] * 2, t, 0.28, 0.04, { attack: 0.005, release: 0.2, to: echo });
      }
    }
  }
  return ctx.startRendering();
}
