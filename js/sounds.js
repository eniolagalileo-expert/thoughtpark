// Sleep sounds generated live with the Web Audio API: rain, ocean, and brown
// noise. Nothing is downloaded. A timer fades the sound out gently.

const FADE_IN_S = 3;
const FADE_OUT_S = 20;

let ctx = null;
let master = null;
let nodes = [];
let timers = [];
let onEnded = null;

export const SOUNDS = [
  { id: 'rain', label: 'Rain' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'brown', label: 'Brown noise' },
];

export function isSupported() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

// Two seconds of noise, looped. Brown noise is white noise integrated, which
// sounds deeper and softer.
function noiseBuffer(kind) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function loop(kind) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(kind);
  source.loop = true;
  source.start();
  nodes.push(source);
  return source;
}

function filter(type, frequency, q = 0.7) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  nodes.push(node);
  return node;
}

function gain(value) {
  const node = ctx.createGain();
  node.gain.value = value;
  nodes.push(node);
  return node;
}

function buildRain() {
  // Steady hiss of rain, plus occasional soft drops.
  loop('white').connect(filter('bandpass', 1200, 0.4)).connect(gain(0.35)).connect(master);
  const drops = gain(0);
  loop('white').connect(filter('highpass', 2500)).connect(drops).connect(master);
  const drip = () => {
    const t = ctx.currentTime;
    drops.gain.cancelScheduledValues(t);
    drops.gain.setValueAtTime(0, t);
    drops.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.1, t + 0.01);
    drops.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    timers.push(setTimeout(drip, 80 + Math.random() * 400));
  };
  drip();
}

function buildOcean() {
  // Deep noise whose volume rises and falls like waves (about every 9 seconds).
  const swell = gain(0.25);
  loop('brown').connect(filter('lowpass', 900)).connect(swell).connect(master);
  const wave = ctx.createOscillator();
  wave.frequency.value = 1 / 9;
  const depth = gain(0.22);
  wave.connect(depth).connect(swell.gain);
  wave.start();
  nodes.push(wave);
}

function buildBrown() {
  loop('brown').connect(filter('lowpass', 500)).connect(gain(0.6)).connect(master);
}

export async function play(id, minutes) {
  stop();
  const Context = window.AudioContext || window.webkitAudioContext;
  ctx ??= new Context();
  if (ctx.state === 'suspended') await ctx.resume();
  master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN_S);
  master.connect(ctx.destination);
  ({ rain: buildRain, ocean: buildOcean, brown: buildBrown })[id]();
  if (minutes) {
    const fadeAt = Math.max(0, minutes * 60 - FADE_OUT_S);
    timers.push(setTimeout(fadeOut, fadeAt * 1000));
  }
}

// Fade to silence, then stop. Returns when the sound has stopped.
export function fadeOut(seconds = FADE_OUT_S) {
  if (!master) return Promise.resolve();
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0, t + seconds);
  return new Promise((resolve) => {
    timers.push(setTimeout(() => { stop(); onEnded?.(); resolve(); }, seconds * 1000));
  });
}

// Called when a timer fade finishes (not when stopped by hand).
export function whenEnded(callback) {
  onEnded = callback;
}

export function stop() {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  for (const node of nodes) {
    try { node.stop?.(); } catch { /* already stopped */ }
    node.disconnect();
  }
  nodes = [];
  master?.disconnect();
  master = null;
}

export function isPlaying() {
  return Boolean(master);
}
