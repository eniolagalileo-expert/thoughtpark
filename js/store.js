// Pure data logic for ThoughtPark. No DOM access, so it can be tested in Node.
// Every change returns a new state object instead of mutating the old one.

export const MAX_LENGTH = 280;
export const STORAGE_KEY = 'thoughtpark:v1';

export function emptyState() {
  return { pending: [], parked: [], seenHint: false, seenGuide: false, night: emptyNight(), dreams: [] };
}

// Only counts are kept about last night, never the released text.
function emptyNight() {
  return { parked: 0, released: 0, seen: false };
}

export function makeId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

// Trim, collapse whitespace, cap the length. Returns null for empty input.
export function cleanText(text) {
  const clean = String(text ?? '').trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, MAX_LENGTH) : null;
}

// New thoughts go to the top of the pending list.
export function addThought(state, text, now = Date.now()) {
  const clean = cleanText(text);
  if (!clean) return { state, thought: null };
  const thought = { id: makeId(), text: clean, createdAt: now };
  return { state: { ...state, pending: [thought, ...state.pending] }, thought };
}

// "Let it go": removed from pending and never kept anywhere.
export function releaseThought(state, id) {
  const thought = state.pending.find((t) => t.id === id) ?? null;
  if (!thought) return { state, thought: null };
  return { state: { ...state, pending: state.pending.filter((t) => t.id !== id) }, thought };
}

// "Tomorrow": moved from pending to parked. Parking a new thought also clears
// anything already checked off in the morning, so the list starts fresh each night.
export function parkThought(state, id, now = Date.now()) {
  const thought = state.pending.find((t) => t.id === id) ?? null;
  if (!thought) return { state, thought: null };
  const parked = { ...thought, parkedAt: now, done: false };
  return {
    state: {
      ...state,
      pending: state.pending.filter((t) => t.id !== id),
      parked: [parked, ...clearDone(state).parked],
    },
    thought: parked,
  };
}

// Morning check-off, toggled so a mis-tap can be reversed.
export function toggleDone(state, id) {
  return {
    ...state,
    parked: state.parked.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  };
}

export function clearDone(state) {
  return { ...state, parked: state.parked.filter((t) => !t.done) };
}

// Morning "Doesn't matter anymore": the parked thought is let go for good.
export function letGoParked(state, id) {
  return { ...state, parked: state.parked.filter((t) => t.id !== id) };
}

// ---- Last night's summary -------------------------------------------------

// Count a night park or release. Once the morning has been seen, the next
// night action starts a fresh count.
export function recordNight(state, kind) {
  const current = state.night && !state.night.seen ? state.night : emptyNight();
  return { ...state, night: { ...current, [kind]: current[kind] + 1 } };
}

export function markNightSeen(state) {
  if (!state.night || state.night.seen) return state;
  return { ...state, night: { ...state.night, seen: true } };
}

export function nightSummary(night) {
  const parked = night?.parked ?? 0;
  const released = night?.released ?? 0;
  const thoughts = (n) => `${n} thought${n === 1 ? '' : 's'}`;
  if (parked && released) return `Last night you parked ${thoughts(parked)} and let go of ${released}. You slept on it.`;
  if (parked) return `Last night you parked ${thoughts(parked)}. You slept on it.`;
  if (released) return `Last night you let go of ${thoughts(released)}.`;
  return null;
}

// Morning order: open items newest first, then checked-off items.
export function morningList(state) {
  const byNewest = (a, b) => b.parkedAt - a.parkedAt;
  const open = state.parked.filter((t) => !t.done).sort(byNewest);
  const done = state.parked.filter((t) => t.done).sort(byNewest);
  return [...open, ...done];
}

// Morning is 5:00 am up to (not including) 5:00 pm; night is the rest.
export function modeForHour(hour) {
  return hour >= 5 && hour < 17 ? 'morning' : 'night';
}

// ---- Saving on the device -------------------------------------------------

function isThought(t) {
  return t && typeof t.id === 'string' && typeof t.text === 'string';
}

// Keep a saved note only if it's a short string.
function withValidNote(t) {
  const { note, ...rest } = t;
  return typeof note === 'string' && note.trim() ? { ...rest, note: note.slice(0, 160) } : rest;
}

// Accepts anything read from storage and returns a valid state.
export function parseState(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyState();
    return {
      pending: Array.isArray(data.pending) ? data.pending.filter(isThought).map(withValidNote) : [],
      parked: Array.isArray(data.parked)
        ? data.parked.filter(isThought).map((t) => ({ ...withValidNote(t), done: Boolean(t.done) }))
        : [],
      seenHint: Boolean(data.seenHint),
      seenGuide: Boolean(data.seenGuide),
      night: parseNight(data.night),
      dreams: parseDreams(data.dreams),
    };
  } catch {
    return emptyState();
  }
}

function parseNight(night) {
  if (!night || typeof night !== 'object') return emptyNight();
  const count = (n) => (Number.isInteger(n) && n > 0 ? n : 0);
  return { parked: count(night.parked), released: count(night.released), seen: Boolean(night.seen) };
}

export function load(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw == null ? emptyState() : parseState(raw);
  } catch {
    return emptyState();
  }
}

// Returns false when the browser won't let us save.
export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ---- Night sky ------------------------------------------------------------

// Small stable string hash (FNV-1a), so a thought's star never moves.
export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Position in percent of the screen: kept away from the edges, below the
// header, and in the upper part, like a real night sky above the horizon.
export function starPosition(id) {
  const a = hashString(id);
  const b = hashString(`${id}:y`);
  return {
    x: 6 + (a % 8800) / 100,
    y: 11 + (b % 4900) / 100,
    size: 3 + (a % 3),
  };
}

// ---- Gentle prompts -------------------------------------------------------

export const PROMPTS = [
  'Anything about work or school?',
  'Someone you need to reply to?',
  'Something you’re worried might go wrong?',
  'A bill, a form, or a deadline?',
  'Something you said today that’s still bothering you?',
  'Anything you need to buy or pick up?',
  'A plan for tomorrow you keep going over?',
  'Something about family or friends?',
];

export function promptAt(n) {
  const len = PROMPTS.length;
  return PROMPTS[((n % len) + len) % len];
}

// ---- Breathing moment -----------------------------------------------------

export const BREATH_IN_MS = 4000;
export const BREATH_OUT_MS = 6000;
export const BREATH_TOTAL_MS = 60000;

// Where we are in the minute: breathing in or out, which of the six breaths,
// how far through the current phase (0–1), and the seconds left.
export function breathPhase(elapsedMs) {
  const cycleMs = BREATH_IN_MS + BREATH_OUT_MS;
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed >= BREATH_TOTAL_MS) {
    return { done: true, phase: 'out', cycle: BREATH_TOTAL_MS / cycleMs, progress: 1, remainingSec: 0 };
  }
  const inCycle = elapsed % cycleMs;
  const breathingIn = inCycle < BREATH_IN_MS;
  return {
    done: false,
    phase: breathingIn ? 'in' : 'out',
    cycle: Math.floor(elapsed / cycleMs) + 1,
    progress: breathingIn ? inCycle / BREATH_IN_MS : (inCycle - BREATH_IN_MS) / BREATH_OUT_MS,
    remainingSec: Math.ceil((BREATH_TOTAL_MS - elapsed) / 1000),
  };
}

// ---- AI companion ---------------------------------------------------------

// Signs that someone may be in crisis. Checked on the device before any text
// is sent to Claude; a match shows the 988 Lifeline card instead of a chat.
const CRISIS_PATTERN = new RegExp([
  'kill(?:ing)? my ?self',
  'suicid(?:e|al)',
  'end (?:it all|my life)',
  'want(?:ed)? to die',
  'wish i (?:was|were) dead',
  "don'?t want to (?:live|be alive|wake up|be here)",
  'no reason to live',
  'better off dead',
  'hurt(?:ing)? my ?self',
  'self[- ]?harm',
  'cut(?:ting)? my ?self',
].map((p) => `\\b${p}\\b`).join('|'), 'i');

export function crisisCheck(text) {
  return CRISIS_PATTERN.test(String(text ?? '').replace(/[’‘]/g, "'"));
}

export const MAX_NOTE_LENGTH = 160;

// A short note from Talk it through, saved on a pending or parked thought.
export function setNote(state, id, note) {
  const clean = cleanText(note)?.slice(0, MAX_NOTE_LENGTH) ?? null;
  const withNote = (t) => {
    if (t.id !== id) return t;
    const { note: _old, ...rest } = t;
    return clean ? { ...rest, note: clean } : rest;
  };
  return { ...state, pending: state.pending.map(withNote), parked: state.parked.map(withNote) };
}

// Split spoken words into separate thoughts without AI: sentences first, then
// "and" / "also" joins. Very short fragments stay with the previous thought.
export function splitLocally(transcript) {
  const parts = [];
  for (const sentence of String(transcript ?? '').split(/[.!?;\n]+/)) {
    for (const piece of sentence.split(/,?\s+(?:and also|and then|and|also|plus)\s+/i)) {
      const clean = cleanText(piece.replace(/^(?:(?:um+|uh+|so|okay|ok|well)[,\s]+)+/i, ''));
      if (!clean) continue;
      if (parts.length && clean.split(' ').length < 3) parts[parts.length - 1] += ` and ${clean}`;
      else parts.push(clean);
    }
  }
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

// ---- Mind shuffle ---------------------------------------------------------

// Calm seed words and simple, unrelated things to picture for each letter
// (Luc Beaudoin's cognitive shuffle / serial diverse imagining).
export const SHUFFLE_WORDS = ['BLANKET', 'HARBOR', 'MEADOW', 'LANTERN', 'PILLOW', 'ORCHARD', 'CANDLE', 'WILLOW'];

export const SHUFFLE_ITEMS = {
  A: ['an apple', 'an acorn', 'an armchair', 'an anchor'],
  B: ['a bicycle', 'a blueberry', 'a bucket', 'a butterfly'],
  C: ['a cup of cocoa', 'a candle', 'a cloud', 'a cat'],
  D: ['a daisy', 'a drum', 'a door', 'a duck'],
  E: ['an envelope', 'an egg', 'an elephant', 'an easel'],
  H: ['a hat', 'a honeybee', 'a hammock', 'a harp'],
  I: ['an igloo', 'an ice cube', 'an iris', 'an inkwell'],
  K: ['a kite', 'a kettle', 'a key', 'a koala'],
  L: ['a lemon', 'a leaf', 'a lighthouse', 'a lamb'],
  M: ['a mitten', 'the moon', 'a mug', 'a maple tree'],
  N: ['a nest', 'a notebook', 'a nutshell', 'a napkin'],
  O: ['an owl', 'an orange', 'an oar', 'an oak leaf'],
  P: ['a pebble', 'a pear', 'a paintbrush', 'a pinecone'],
  R: ['a rowboat', 'a raindrop', 'a rabbit', 'a ribbon'],
  T: ['a teapot', 'a tulip', 'a turtle', 'a tent'],
  W: ['a wave', 'a windmill', 'a wool sweater', 'a watering can'],
};

// The steps for one word: each letter, then a few things to picture.
export function shuffleSequence(word, perLetter = 3) {
  const steps = [];
  for (const letter of word.toUpperCase()) {
    const items = SHUFFLE_ITEMS[letter];
    if (!items) continue;
    for (const item of items.slice(0, perLetter)) steps.push({ letter, item });
  }
  return steps;
}

// ---- Dream journal --------------------------------------------------------

export const MAX_DREAM_LENGTH = 2000;
export const MAX_DREAMS = 60;

// Dreams keep their line breaks, unlike thoughts.
export function cleanDream(text) {
  const clean = String(text ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return clean ? clean.slice(0, MAX_DREAM_LENGTH) : null;
}

function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

// The dream noted on the same calendar day as `now`, if any.
export function dreamForDay(state, now = Date.now()) {
  return (state.dreams ?? []).find((d) => sameDay(d.createdAt, now)) ?? null;
}

export function addDream(state, text, now = Date.now()) {
  const clean = cleanDream(text);
  if (!clean) return { state, dream: null };
  const dream = { id: makeId(), text: clean, createdAt: now };
  return { state: { ...state, dreams: [dream, ...(state.dreams ?? [])].slice(0, MAX_DREAMS) }, dream };
}

// Editing a dream clears its old reflection, which no longer fits.
export function updateDream(state, id, text) {
  const clean = cleanDream(text);
  if (!clean) return state;
  return {
    ...state,
    dreams: (state.dreams ?? []).map((d) => (d.id === id ? { id: d.id, text: clean, createdAt: d.createdAt } : d)),
  };
}

export function deleteDream(state, id) {
  return { ...state, dreams: (state.dreams ?? []).filter((d) => d.id !== id) };
}

export function setDreamReflection(state, id, reflection) {
  return { ...state, dreams: (state.dreams ?? []).map((d) => (d.id === id ? { ...d, reflection } : d)) };
}

function isReflection(r) {
  return r && typeof r === 'object' && typeof r.title === 'string' && typeof r.reflection === 'string';
}

function parseDreams(dreams) {
  if (!Array.isArray(dreams)) return [];
  return dreams
    .filter((d) => d && typeof d.id === 'string' && typeof d.text === 'string' && Number.isFinite(d.createdAt))
    .map((d) => {
      const dream = { id: d.id, text: d.text.slice(0, MAX_DREAM_LENGTH), createdAt: d.createdAt };
      if (isReflection(d.reflection)) {
        const r = d.reflection;
        const strings = (list) => (Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, 4) : []);
        dream.reflection = {
          title: r.title,
          feelings: strings(r.feelings),
          themes: strings(r.themes),
          reflection: r.reflection,
          connection: typeof r.connection === 'string' ? r.connection : '',
          question: typeof r.question === 'string' ? r.question : '',
        };
      }
      return dream;
    })
    .slice(0, MAX_DREAMS);
}
