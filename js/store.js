// Pure data logic for ThoughtPark. No DOM access, so it can be tested in Node.
// Every change returns a new state object instead of mutating the old one.

export const MAX_LENGTH = 280;
export const STORAGE_KEY = 'thoughtpark:v1';

export function emptyState() {
  return { pending: [], parked: [], seenHint: false };
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

// "Tomorrow": moved from pending to parked.
export function parkThought(state, id, now = Date.now()) {
  const thought = state.pending.find((t) => t.id === id) ?? null;
  if (!thought) return { state, thought: null };
  const parked = { ...thought, parkedAt: now, done: false };
  return {
    state: {
      ...state,
      pending: state.pending.filter((t) => t.id !== id),
      parked: [parked, ...state.parked],
    },
    thought: parked,
  };
}
