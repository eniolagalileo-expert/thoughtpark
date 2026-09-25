import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, cleanText, addThought, releaseThought, parkThought, MAX_LENGTH,
  toggleDone, clearDone, morningList, modeForHour, parseState, load, save, STORAGE_KEY,
  starPosition, hashString, promptAt, PROMPTS,
} from '../js/store.js';

test('cleanText trims, collapses whitespace, and rejects empty input', () => {
  assert.equal(cleanText('  call   mom \n tomorrow  '), 'call mom tomorrow');
  assert.equal(cleanText('   '), null);
  assert.equal(cleanText(''), null);
  assert.equal(cleanText(undefined), null);
});

test('cleanText caps text at the maximum length', () => {
  assert.equal(cleanText('a'.repeat(MAX_LENGTH + 50)).length, MAX_LENGTH);
});

test('addThought puts the new thought at the top of pending', () => {
  let { state } = addThought(emptyState(), 'first', 1);
  ({ state } = addThought(state, 'second', 2));
  assert.deepEqual(state.pending.map((t) => t.text), ['second', 'first']);
  assert.equal(state.pending[0].createdAt, 2);
});

test('addThought ignores empty text and leaves state unchanged', () => {
  const before = emptyState();
  const { state, thought } = addThought(before, '   ');
  assert.equal(thought, null);
  assert.equal(state, before);
});

test('releaseThought removes the thought and keeps it nowhere', () => {
  const { state: s1, thought } = addThought(emptyState(), 'let me go');
  const { state: s2, thought: released } = releaseThought(s1, thought.id);
  assert.equal(released.text, 'let me go');
  assert.equal(s2.pending.length, 0);
  assert.equal(s2.parked.length, 0);
});

test('parkThought moves the thought from pending to parked', () => {
  const { state: s1, thought } = addThought(emptyState(), 'pay the bill');
  const { state: s2, thought: parked } = parkThought(s1, thought.id, 99);
  assert.equal(s2.pending.length, 0);
  assert.equal(s2.parked.length, 1);
  assert.equal(parked.parkedAt, 99);
  assert.equal(parked.done, false);
});

test('unknown ids leave state unchanged', () => {
  const before = emptyState();
  assert.equal(releaseThought(before, 'nope').state, before);
  assert.equal(parkThought(before, 'nope').state, before);
});

test('state is never mutated in place', () => {
  const before = emptyState();
  addThought(before, 'hello');
  assert.deepEqual(before, emptyState());
});

// ---- Slice 2: morning handoff and saving ---------------------------------

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

function withParked(...texts) {
  let state = emptyState();
  texts.forEach((text, i) => {
    const added = addThought(state, text, i);
    state = parkThought(added.state, added.thought.id, 100 + i).state;
  });
  return state;
}

test('modeForHour switches at 5 am and 5 pm', () => {
  assert.equal(modeForHour(4), 'night');
  assert.equal(modeForHour(5), 'morning');
  assert.equal(modeForHour(16), 'morning');
  assert.equal(modeForHour(17), 'night');
  assert.equal(modeForHour(0), 'night');
  assert.equal(modeForHour(23), 'night');
});

test('toggleDone checks and unchecks a parked thought', () => {
  const state = withParked('a');
  const id = state.parked[0].id;
  assert.equal(toggleDone(state, id).parked[0].done, true);
  assert.equal(toggleDone(toggleDone(state, id), id).parked[0].done, false);
});

test('morningList shows open items newest first, then checked items', () => {
  let state = withParked('oldest', 'middle', 'newest');
  const middle = state.parked.find((t) => t.text === 'middle').id;
  state = toggleDone(state, middle);
  assert.deepEqual(morningList(state).map((t) => t.text), ['newest', 'oldest', 'middle']);
});

test('parking a new thought clears items checked off in the morning', () => {
  let state = withParked('done already', 'still open');
  state = toggleDone(state, state.parked.find((t) => t.text === 'done already').id);
  const added = addThought(state, 'new tonight');
  state = parkThought(added.state, added.thought.id).state;
  assert.deepEqual(state.parked.map((t) => t.text).sort(), ['new tonight', 'still open']);
  assert.equal(clearDone(state).parked.length, 2);
});

test('save then load round-trips pending and parked thoughts', () => {
  const storage = memoryStorage();
  let state = withParked('parked one');
  state = addThought(state, 'not parked yet').state;
  assert.equal(save(storage, state), true);
  const loaded = load(storage);
  assert.deepEqual(loaded.parked.map((t) => t.text), ['parked one']);
  assert.deepEqual(loaded.pending.map((t) => t.text), ['not parked yet']);
});

test('load returns an empty state for missing or corrupted data', () => {
  const storage = memoryStorage();
  assert.deepEqual(load(storage), emptyState());
  storage.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(load(storage), emptyState());
  assert.deepEqual(parseState('"a string"'), emptyState());
  assert.deepEqual(parseState('{"pending":[{"nope":1}],"parked":"bad"}'), emptyState());
});

test('save and load survive a storage that throws', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  assert.equal(save(broken, emptyState()), false);
  assert.deepEqual(load(broken), emptyState());
});

// ---- Slice 4: night sky and prompts --------------------------------------

test('starPosition is stable for the same id', () => {
  assert.deepEqual(starPosition('abc123'), starPosition('abc123'));
  assert.equal(hashString('abc123'), hashString('abc123'));
});

test('starPosition stays inside the visible sky', () => {
  for (let i = 0; i < 500; i += 1) {
    const { x, y, size } = starPosition(`id-${i}-${Math.random()}`);
    assert.ok(x >= 6 && x < 94, `x ${x}`);
    assert.ok(y >= 4 && y < 60, `y ${y}`);
    assert.ok(size >= 3 && size <= 5, `size ${size}`);
  }
});

test('different ids usually land in different places', () => {
  const spots = new Set(Array.from({ length: 50 }, (_, i) => {
    const { x, y } = starPosition(`thought-${i}`);
    return `${Math.round(x)},${Math.round(y)}`;
  }));
  assert.ok(spots.size > 40);
});

test('promptAt cycles through the prompt list', () => {
  assert.equal(promptAt(0), PROMPTS[0]);
  assert.equal(promptAt(PROMPTS.length), PROMPTS[0]);
  assert.equal(promptAt(PROMPTS.length + 2), PROMPTS[2]);
  assert.equal(promptAt(-1), PROMPTS[PROMPTS.length - 1]);
});
