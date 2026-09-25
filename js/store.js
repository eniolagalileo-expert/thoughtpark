// Pure data logic for ThoughtPark. No DOM access, so it can be tested in Node.
// Every change returns a new state object instead of mutating the old one.

export const MAX_LENGTH = 280;
export const STORAGE_KEY = 'thoughtpark:v1';

export function emptyState() {
  return { pending: [], parked: [], seenHint: false, seenGuide: false, night: emptyNight(), dreams: [], history: {}, recurring: {}, settings: { ...DEFAULT_SETTINGS } };
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

// "Let it go": removed from pending and never kept anywhere. Only the
// calendar's count for tonight goes up.
export function releaseThought(state, id, now = Date.now()) {
  const thought = state.pending.find((t) => t.id === id) ?? null;
  if (!thought) return { state, thought: null };
  const released = { ...state, pending: state.pending.filter((t) => t.id !== id) };
  return { state: countReleased(released, now), thought };
}

// "Tomorrow": moved from pending to parked. Parking a new thought also clears
// anything already checked off in the morning, so the list starts fresh each night.
export function parkThought(state, id, now = Date.now()) {
  const thought = state.pending.find((t) => t.id === id) ?? null;
  if (!thought) return { state, thought: null };
  const parked = { ...thought, parkedAt: now, done: false };
  const next = {
    ...state,
    pending: state.pending.filter((t) => t.id !== id),
    parked: [parked, ...clearDone(state).parked],
  };
  return { state: rememberParked(next, parked), thought: parked };
}

// Morning check-off, toggled so a mis-tap can be reversed.
export function toggleDone(state, id) {
  const thought = state.parked.find((t) => t.id === id);
  const next = {
    ...state,
    parked: state.parked.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  };
  return thought ? setOutcome(next, id, thought.done ? null : 'done') : next;
}

export function clearDone(state) {
  return { ...state, parked: state.parked.filter((t) => !t.done) };
}

// Morning "Doesn't matter anymore": the parked thought is let go for good.
export function letGoParked(state, id) {
  return setOutcome({ ...state, parked: state.parked.filter((t) => t.id !== id) }, id, 'let-go');
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
      history: parseHistory(data.history),
      recurring: parseRecurring(data.recurring),
      settings: parseSettings(data.settings),
      ...(typeof data.remindedNight === 'string' && DAY_KEY.test(data.remindedNight) ? { remindedNight: data.remindedNight } : {}),
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
  const next = { ...state, pending: state.pending.map(withNote), parked: state.parked.map(withNote) };
  return mapHistoryEntry(next, id, withNote);
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

// ---- Calendar -------------------------------------------------------------

export const MAX_HISTORY_DAYS = 365;
const NIGHT_STARTS_HOUR = 5; // a night runs from 5 am to 5 am

export function dayKey(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The night something happened in: 1 am on the 25th belongs to the night of the 24th.
export function nightKey(time) {
  return dayKey(time - NIGHT_STARTS_HOUR * 3600e3);
}

// A dream noted in the morning belongs to the night before.
export function dreamNightKey(time) {
  if (new Date(time).getHours() < NIGHT_STARTS_HOUR) return nightKey(time);
  const d = new Date(time);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12).getTime());
}

function emptyDay() {
  return { parked: [], released: 0, aids: [], good: [] };
}

function pruneHistory(history) {
  const keys = Object.keys(history).sort();
  if (keys.length <= MAX_HISTORY_DAYS) return history;
  const kept = {};
  for (const key of keys.slice(-MAX_HISTORY_DAYS)) kept[key] = history[key];
  return kept;
}

function withDay(state, key, update) {
  const history = state.history ?? {};
  const day = history[key] ?? emptyDay();
  return { ...state, history: pruneHistory({ ...history, [key]: update(day) }) };
}

function historyEntry(thought) {
  const entry = { id: thought.id, text: thought.text };
  if (thought.note) entry.note = thought.note;
  return entry;
}

function rememberParked(state, thought) {
  return withDay(state, nightKey(thought.parkedAt), (day) => ({
    ...day,
    parked: [historyEntry(thought), ...day.parked.filter((t) => t.id !== thought.id)],
  }));
}

function countReleased(state, now) {
  return withDay(state, nightKey(now), (day) => ({ ...day, released: day.released + 1 }));
}

// Apply `fn` to the history entry with this id, wherever it is.
function mapHistoryEntry(state, id, fn) {
  const history = state.history ?? {};
  for (const [key, day] of Object.entries(history)) {
    if (day.parked.some((t) => t.id === id)) {
      return { ...state, history: { ...history, [key]: { ...day, parked: day.parked.map((t) => (t.id === id ? fn(t) : t)) } } };
    }
  }
  return state;
}

function setOutcome(state, id, outcome) {
  return mapHistoryEntry(state, id, (t) => {
    const { outcome: _old, ...rest } = t;
    return outcome ? { ...rest, outcome } : rest;
  });
}

// Parked thoughts from before the calendar existed are added to it.
export function withHistoryBackfill(state) {
  let next = state;
  for (const thought of state.parked) {
    const known = Object.values(next.history ?? {}).some((day) => day.parked.some((t) => t.id === thought.id));
    if (known || !Number.isFinite(thought.parkedAt)) continue;
    next = rememberParked(next, thought);
    if (thought.done) next = setOutcome(next, thought.id, 'done');
  }
  return next;
}

// Everything the calendar shows for one night.
export function nightDetails(state, key) {
  const day = state.history?.[key] ?? emptyDay();
  const dream = (state.dreams ?? []).find((d) => dreamNightKey(d.createdAt) === key) ?? null;
  return { parked: day.parked, released: day.released, aids: day.aids ?? [], good: day.good ?? [], rating: day.rating ?? null, dream };
}

// Which nights in a month have something saved:
// { 'YYYY-MM-DD': { thoughts, aids, dream } }.
export function monthMarks(state, year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const marks = {};
  for (const [key, day] of Object.entries(state.history ?? {})) {
    const thoughts = day.parked.length + day.released;
    const aids = (day.aids ?? []).length;
    if (key.startsWith(prefix) && (thoughts || aids)) marks[key] = { thoughts, aids, dream: false };
  }
  for (const dream of state.dreams ?? []) {
    const key = dreamNightKey(dream.createdAt);
    if (key.startsWith(prefix)) marks[key] = { thoughts: marks[key]?.thoughts ?? 0, aids: marks[key]?.aids ?? 0, dream: true };
  }
  return marks;
}

// ---- Sleep aids on the calendar ----------------------------------------------

export const SLEEP_AIDS = { breathe: 'Breathe', shuffle: 'Mind shuffle', sounds: 'Sleep sounds', story: 'Sleep story' };

// A sleep tool was started tonight. Returns its id so it can be updated/ended.
export function startSleepAid(state, tool, detail = '', now = Date.now()) {
  const aid = { id: makeId(), tool, startedAt: now };
  if (detail) aid.detail = detail;
  const next = withDay(state, nightKey(now), (day) => ({ ...day, aids: [...(day.aids ?? []), aid] }));
  return { state: next, id: aid.id };
}

function mapAid(state, id, fn) {
  const history = state.history ?? {};
  for (const [key, day] of Object.entries(history)) {
    if ((day.aids ?? []).some((a) => a.id === id)) {
      return { ...state, history: { ...history, [key]: { ...day, aids: day.aids.map((a) => (a.id === id ? fn(a) : a)) } } };
    }
  }
  return state;
}

export function updateSleepAid(state, id, detail) {
  return mapAid(state, id, (a) => ({ ...a, detail }));
}

// `finished`: the tool ran to its end (the screen dimmed) instead of being stopped.
export function endSleepAid(state, id, { finished, now = Date.now() }) {
  return mapAid(state, id, (a) => ({ ...a, minutes: Math.max(0, Math.round((now - a.startedAt) / 60000)), finished: Boolean(finished) }));
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const OUTCOMES = new Set(['done', 'let-go']);

function parseHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return {};
  const clean = {};
  for (const [key, day] of Object.entries(history)) {
    if (!DAY_KEY.test(key) || !day || typeof day !== 'object') continue;
    const parked = Array.isArray(day.parked)
      ? day.parked.filter(isThought).map((t) => {
        const entry = { id: t.id, text: t.text.slice(0, MAX_LENGTH) };
        if (typeof t.note === 'string' && t.note.trim()) entry.note = t.note.slice(0, 160);
        if (OUTCOMES.has(t.outcome)) entry.outcome = t.outcome;
        return entry;
      })
      : [];
    const aids = Array.isArray(day.aids)
      ? day.aids.filter((a) => a && typeof a.id === 'string' && a.tool in SLEEP_AIDS && Number.isFinite(a.startedAt)).map((a) => {
        const aid = { id: a.id, tool: a.tool, startedAt: a.startedAt };
        if (typeof a.detail === 'string' && a.detail) aid.detail = a.detail.slice(0, 120);
        if (Number.isInteger(a.minutes) && a.minutes >= 0) aid.minutes = a.minutes;
        if (typeof a.finished === 'boolean') aid.finished = a.finished;
        return aid;
      })
      : [];
    const good = Array.isArray(day.good) ? day.good.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.slice(0, MAX_LENGTH)).slice(0, MAX_GOOD_THINGS) : [];
    clean[key] = { parked, released: Number.isInteger(day.released) && day.released > 0 ? day.released : 0, aids, good };
    if (Number.isInteger(day.rating) && day.rating >= 1 && day.rating <= 5) clean[key].rating = day.rating;
  }
  return pruneHistory(clean);
}

// ---- Three good things ------------------------------------------------------

export const MAX_GOOD_THINGS = 3;

export function addGoodThing(state, text, now = Date.now()) {
  const clean = cleanText(text);
  const key = nightKey(now);
  const current = state.history?.[key]?.good ?? [];
  if (!clean || current.length >= MAX_GOOD_THINGS) return state;
  return withDay(state, key, (day) => ({ ...day, good: [...(day.good ?? []), clean] }));
}

export function goodThingsTonight(state, now = Date.now()) {
  return state.history?.[nightKey(now)]?.good ?? [];
}

// ---- Sleep rating ---------------------------------------------------------------

// In the morning, "last night" is the night that started before now.
export function lastNightKey(now = Date.now()) {
  return nightKey(now - 12 * 3600e3);
}

export function rateNight(state, key, rating) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return state;
  return withDay(state, key, (day) => ({ ...day, rating }));
}

// Average rating on nights with and without a sleep tool.
export function ratingStats(state) {
  const groups = { with: [], without: [] };
  for (const day of Object.values(state.history ?? {})) {
    if (!day.rating) continue;
    groups[(day.aids ?? []).length ? 'with' : 'without'].push(day.rating);
  }
  const summary = (list) => ({ n: list.length, avg: list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null });
  return { with: summary(groups.with), without: summary(groups.without) };
}

// ---- Key words (for insights and recurring worries) -----------------------------

const STOP_WORDS = new Set(('about above after again against along already always another anything around because '
  + 'before being below between both could didnt doesnt doing done dont during each either enough every everything '
  + 'first from getting going gonna gotta have having here itself just keep kind know later maybe might more most '
  + 'much must myself need needs never next nothing other really right same should since some something still such '
  + 'than that thats their them then there these they thing things think this those though through tomorrow tonight '
  + 'today tried trying under until very want wants wanted wasnt were what whats when where which while whole will '
  + 'with without wont would yesterday your yours abouts forget remember make sure feel feels felt worried worry '
  + 'worrying thinking thought thoughts').split(' '));

// Significant words: 5+ letters, not a stop word, simple plural folded.
export function keyWords(text) {
  const words = String(text ?? '').toLowerCase().replace(/[’']/g, '').match(/[a-z]{5,}/g) ?? [];
  return [...new Set(words.map((w) => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .filter((w) => !STOP_WORDS.has(w)))];
}

function shiftKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days, 12).getTime());
}

// Words that appear in parked thoughts on at least `minNights` of the
// `nights` nights ending with `endKey`, most frequent first.
export function wordNights(state, endKey, nights = 7) {
  const counts = new Map();
  for (let i = 0; i < nights; i += 1) {
    const day = state.history?.[shiftKey(endKey, -i)];
    if (!day) continue;
    const words = new Set(day.parked.flatMap((t) => keyWords(t.text)));
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()].map(([word, n]) => ({ word, nights: n })).sort((a, b) => b.nights - a.nights || a.word.localeCompare(b.word));
}

// ---- Weekly insights ------------------------------------------------------------

// A summary of the seven nights ending with `endKey`, for Claude. It holds
// counts, key words, and the person's own good things, never thought text.
export function weekSummary(state, endKey) {
  const nights = [];
  for (let i = 6; i >= 0; i -= 1) {
    const key = shiftKey(endKey, -i);
    const night = nightDetails(state, key);
    const [y, m, d] = key.split('-').map(Number);
    nights.push({
      night: key,
      weekday: new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' }),
      parked: night.parked.length,
      letGoAtNight: night.released,
      doneNextDay: night.parked.filter((t) => t.outcome === 'done').length,
      letGoNextDay: night.parked.filter((t) => t.outcome === 'let-go').length,
      sleepTools: night.aids.map((a) => ({ tool: SLEEP_AIDS[a.tool], ranToEnd: a.finished === true })),
      sleepRating: night.rating,
      goodThings: night.good,
      dream: night.dream?.reflection?.title ?? (night.dream ? 'noted, not reflected on' : null),
    });
  }
  return { nights, recurringWords: wordNights(state, endKey, 7).filter((w) => w.nights >= 2).slice(0, 6) };
}

export function weekHasData(summary) {
  return summary.nights.some((n) => n.parked || n.letGoAtNight || n.sleepTools.length || n.sleepRating || n.goodThings.length || n.dream);
}

// ---- Worries that keep coming back ---------------------------------------------

export const RECURRING_MIN_NIGHTS = 3;
export const RECURRING_WINDOW_NIGHTS = 14;
const HIDE_RECURRING_MS = 7 * 864e5;

// Key words parked on 3+ different nights in the last 14, with a few recent
// examples, skipping any the person hid for now.
export function recurringWorries(state, now = Date.now()) {
  const endKey = nightKey(now);
  const found = [];
  // Thoughts already covered by a card (shown or hidden), so "passport
  // renewal" makes one card, not one for each word.
  const covered = new Set();
  for (const { word, nights } of wordNights(state, endKey, RECURRING_WINDOW_NIGHTS)) {
    if (nights < RECURRING_MIN_NIGHTS) break;
    const matching = [];
    for (let i = 0; i < RECURRING_WINDOW_NIGHTS; i += 1) {
      const day = state.history?.[shiftKey(endKey, -i)];
      for (const t of day?.parked ?? []) if (keyWords(t.text).includes(word)) matching.push(t);
    }
    if (matching.every((t) => covered.has(t.id))) continue;
    for (const t of matching) covered.add(t.id);
    const info = state.recurring?.[word];
    if (info?.hiddenUntil && info.hiddenUntil > now) continue;
    const examples = [...new Set(matching.map((t) => t.text))].slice(0, 3);
    found.push({ word, nights, examples, plan: info?.plan ?? null });
  }
  return found;
}

export function dismissRecurring(state, word, now = Date.now()) {
  return { ...state, recurring: { ...(state.recurring ?? {}), [word]: { ...(state.recurring?.[word] ?? {}), hiddenUntil: now + HIDE_RECURRING_MS } } };
}

export function setRecurringPlan(state, word, plan) {
  const clean = cleanText(plan)?.slice(0, MAX_NOTE_LENGTH);
  if (!clean) return state;
  return { ...state, recurring: { ...(state.recurring ?? {}), [word]: { ...(state.recurring?.[word] ?? {}), plan: clean } } };
}

function parseRecurring(recurring) {
  if (!recurring || typeof recurring !== 'object' || Array.isArray(recurring)) return {};
  const clean = {};
  for (const [word, info] of Object.entries(recurring)) {
    if (!/^[a-z]{3,40}$/.test(word) || !info || typeof info !== 'object') continue;
    const entry = {};
    if (Number.isFinite(info.hiddenUntil)) entry.hiddenUntil = info.hiddenUntil;
    if (typeof info.plan === 'string' && info.plan.trim()) entry.plan = info.plan.slice(0, MAX_NOTE_LENGTH);
    clean[word] = entry;
  }
  return clean;
}

// ---- Settings -----------------------------------------------------------------

// Worry time must fall in the app's daytime (5 am – 5 pm), when the Morning screen shows.
export const DEFAULT_SETTINGS = { worryHour: 16, bedtime: '22:30', remind: false };

export function updateSettings(state, patch) {
  return { ...state, settings: parseSettings({ ...(state.settings ?? DEFAULT_SETTINGS), ...patch }) };
}

function parseSettings(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  return {
    worryHour: Number.isInteger(s.worryHour) && s.worryHour >= 8 && s.worryHour <= 16 ? s.worryHour : DEFAULT_SETTINGS.worryHour,
    bedtime: typeof s.bedtime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.bedtime) ? s.bedtime : DEFAULT_SETTINGS.bedtime,
    remind: Boolean(s.remind),
  };
}

// Is it within the hour the person set aside for worry time?
export function isWorryTime(state, now = Date.now()) {
  return new Date(now).getHours() === (state.settings ?? DEFAULT_SETTINGS).worryHour;
}

// ---- Bedtime reminder ---------------------------------------------------------

function pad(n) {
  return String(n).padStart(2, '0');
}

// A daily repeating calendar event with an alert at bedtime, so the phone's
// own calendar reminds the person even when ThoughtPark is closed.
export function bedtimeIcs(bedtime, now = Date.now(), url = '') {
  const [hour, minute] = bedtime.split(':').map(Number);
  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  if (start.getTime() <= now) start.setDate(start.getDate() + 1);
  const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ThoughtPark//Bedtime reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:thoughtpark-bedtime-${now}@thoughtpark`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(start)}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Park your thoughts (ThoughtPark)',
    `DESCRIPTION:Time to wind down. Park what's on your mind${url ? `: ${url}` : '.'}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    'DESCRIPTION:Time to park your thoughts',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

// Show the in-app bedtime reminder once per night, within an hour after bedtime.
export function bedtimeReminderDue(state, now = Date.now()) {
  const settings = state.settings ?? DEFAULT_SETTINGS;
  if (!settings.remind) return false;
  const [hour, minute] = settings.bedtime.split(':').map(Number);
  const due = new Date(now);
  due.setHours(hour, minute, 0, 0);
  if (due.getTime() > now) due.setDate(due.getDate() - 1);
  const since = now - due.getTime();
  return since >= 0 && since < 3600e3 && state.remindedNight !== nightKey(due.getTime());
}

export function markReminded(state, now = Date.now()) {
  return { ...state, remindedNight: nightKey(now) };
}
