// Sound effects synthesized with Web Audio: knocks of wood and stone, rustling leaves.
// No audio files. Nothing plays until the player has interacted with the page.

const VOLUME = 0.5;
const CUE_DELAY = 0.06; // a card's own voice comes just after the knock of it landing

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : VOLUME;
}

export const isMuted = () => muted;

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq, to = freq, type = 'sine', start = 0, dur = 0.2, gain = 0.3, attack = 0.004 }) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const env = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ start = 0, dur = 0.1, gain = 0.2, freq = 1200, q = 0.8, type = 'bandpass' }) {
  const a = audio();
  if (!a) return;
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + start;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = a.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// ---------- Recorded card cues ----------
//
// Each card may have its own sound in audio/cards/<id>.<ext> (see audio/README.md). They play
// through the same master gain as everything else, so the mute button covers them, and a card
// without a file simply doesn't add anything over the wooden knock every placement makes.

let cueFiles = {};
const cues = new Map(); // card id -> AudioBuffer, or null once we know there isn't one

/** Called once the art manifest has loaded, with its `sounds` map. */
export function setCardCues(files) {
  cueFiles = files ?? {};
}

async function cueFor(cardId) {
  if (cues.has(cardId)) return cues.get(cardId);
  const file = cueFiles[cardId];
  if (!file) {
    cues.set(cardId, null);
    return null;
  }
  const a = audio();
  if (!a) return null; // muted, or no Web Audio: don't fetch what we can't play
  try {
    const res = await fetch(`audio/cards/${file}`);
    const buffer = await a.decodeAudioData(await res.arrayBuffer());
    cues.set(cardId, buffer);
    return buffer;
  } catch {
    cues.set(cardId, null); // a missing or broken file falls back, quietly and once
    return null;
  }
}

/** Fetches and decodes the cues for these cards, so the first play of each isn't late. */
export function warmCardCues(cardIds) {
  for (const id of new Set(cardIds)) cueFor(id).catch(() => {});
}

export const sfx = {
  select() {
    tone({ freq: 640, to: 560, dur: 0.06, gain: 0.07 });
  },
  // A card set down on stone. Every placement gets this; a card with its own cue gets that too.
  place() {
    tone({ freq: 150, to: 70, dur: 0.2, gain: 0.5 });
    noise({ dur: 0.08, gain: 0.22, freq: 650 });
  },
  /**
   * Playing a card: the knock of it landing, then the card's own voice a beat later, so the two
   * read as one event rather than talking over each other.
   */
  card(cardId) {
    this.place();
    cueFor(cardId).then((buffer) => {
      const a = audio();
      if (!buffer || !a) return;
      const src = a.createBufferSource();
      const env = a.createGain();
      env.gain.value = 0.9;
      src.buffer = buffer;
      src.connect(env).connect(master);
      src.start(a.currentTime + CUE_DELAY);
    }).catch(() => {});
  },
  // An attack rakes out: a short leafy whoosh, then either a soft thud as it bites or a dull
  // stone knock as the defender turns it aside. `start` is seconds from now.
  strike(start = 0, landed = true) {
    noise({ start, dur: 0.09, gain: 0.1, freq: 2800, q: 0.5, type: 'highpass' });
    if (landed) {
      tone({ freq: 260, to: 120, type: 'sawtooth', start: start + 0.09, dur: 0.07, gain: 0.09 });
    } else {
      tone({ freq: 190, to: 140, type: 'square', start: start + 0.13, dur: 0.07, gain: 0.08 });
      noise({ start: start + 0.13, dur: 0.07, gain: 0.13, freq: 420, q: 1.6 });
    }
  },
  // A wooden clack for each captured card, timed with the flip animation. `start` is seconds from now.
  flip(start = 0.25) {
    tone({ freq: 520, to: 300, type: 'triangle', start, dur: 0.1, gain: 0.22 });
    noise({ start, dur: 0.05, gain: 0.1, freq: 2400 });
  },
  // Two soft hollow notes when a card gains Advantage.
  advantage() {
    tone({ freq: 587, dur: 0.4, gain: 0.14, start: 0.08 });
    tone({ freq: 880, dur: 0.5, gain: 0.1, start: 0.17 });
  },
  // Leaves rustling as a card is drawn.
  draw() {
    noise({ dur: 0.18, gain: 0.08, freq: 3200, q: 0.4, type: 'highpass' });
  },
  // Clicks that slow down as the token spins, then a stone thunk.
  coinToss(seconds) {
    let t = 0;
    let gap = 0.045;
    while (t < seconds * 0.92) {
      tone({ freq: 1300, type: 'triangle', start: t, dur: 0.02, gain: 0.04 });
      t += gap;
      gap *= 1.09;
    }
    tone({ freq: 210, to: 110, type: 'sine', start: seconds, dur: 0.28, gain: 0.45 });
    noise({ start: seconds, dur: 0.1, gain: 0.25, freq: 500 });
  },
  win() {
    [392, 523, 659].forEach((freq, i) => tone({ freq, type: 'triangle', start: i * 0.14, dur: 0.55, gain: 0.17 }));
  },
  lose() {
    [330, 247].forEach((freq, i) => tone({ freq, type: 'triangle', start: i * 0.24, dur: 0.7, gain: 0.17 }));
  },
  unlock() {
    tone({ freq: 784, type: 'triangle', dur: 0.3, gain: 0.14 });
    tone({ freq: 1175, type: 'triangle', start: 0.12, dur: 0.5, gain: 0.12 });
  },
};
