import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, cleanText, addThought, releaseThought, parkThought, MAX_LENGTH,
  toggleDone, clearDone, morningList, modeForHour, parseState, load, save, STORAGE_KEY,
  starPosition, hashString, promptAt, PROMPTS, breathPhase,
  letGoParked, recordNight, markNightSeen, nightSummary, crisisCheck, setNote, splitLocally,
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
    assert.ok(y >= 11 && y < 60, `y ${y}`);
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

// ---- Slice 5: breathing moment -------------------------------------------

test('breathPhase follows 4 s in, 6 s out, six times', () => {
  const at = (s) => breathPhase(s * 1000);
  assert.deepEqual([at(0).phase, at(0).cycle, at(0).done], ['in', 1, false]);
  assert.equal(at(0).remainingSec, 60);
  assert.equal(at(3.9).phase, 'in');
  assert.equal(at(4).phase, 'out');
  assert.equal(at(9.9).phase, 'out');
  assert.deepEqual([at(10).phase, at(10).cycle], ['in', 2]);
  assert.deepEqual([at(59.9).phase, at(59.9).cycle, at(59.9).done], ['out', 6, false]);
  assert.equal(at(59.9).remainingSec, 1);
  assert.equal(at(60).done, true);
  assert.equal(at(75).done, true);
});

test('breathPhase progress runs from 0 to 1 within each phase', () => {
  assert.equal(breathPhase(0).progress, 0);
  assert.equal(breathPhase(2000).progress, 0.5);
  assert.equal(breathPhase(4000).progress, 0);
  assert.equal(breathPhase(7000).progress, 0.5);
  assert.equal(breathPhase(-50).progress, 0);
});

// ---- Morning moments -----------------------------------------------------

test('letGoParked removes a parked thought for good', () => {
  const state = withParked('keep', 'drop');
  const id = state.parked.find((t) => t.text === 'drop').id;
  assert.deepEqual(letGoParked(state, id).parked.map((t) => t.text), ['keep']);
});

test('recordNight counts parks and releases until the morning is seen', () => {
  let state = emptyState();
  state = recordNight(state, 'parked');
  state = recordNight(state, 'parked');
  state = recordNight(state, 'released');
  assert.deepEqual(state.night, { parked: 2, released: 1, seen: false });
  state = markNightSeen(state);
  assert.equal(state.night.seen, true);
  assert.equal(markNightSeen(state), state);
  state = recordNight(state, 'released');
  assert.deepEqual(state.night, { parked: 0, released: 1, seen: false });
});

test('nightSummary describes last night in plain words', () => {
  assert.equal(nightSummary({ parked: 3, released: 2 }), 'Last night you parked 3 thoughts and let go of 2. You slept on it.');
  assert.equal(nightSummary({ parked: 1, released: 0 }), 'Last night you parked 1 thought. You slept on it.');
  assert.equal(nightSummary({ parked: 0, released: 1 }), 'Last night you let go of 1 thought.');
  assert.equal(nightSummary({ parked: 0, released: 0 }), null);
  assert.equal(nightSummary(undefined), null);
});

test('night counts survive saving and bad values are cleaned', () => {
  const storage = memoryStorage();
  save(storage, recordNight(emptyState(), 'parked'));
  assert.deepEqual(load(storage).night, { parked: 1, released: 0, seen: false });
  assert.deepEqual(parseState('{"night":{"parked":-4,"released":"x"}}').night, { parked: 0, released: 0, seen: false });
});

// ---- AI companion --------------------------------------------------------

test('crisisCheck catches signs of crisis', () => {
  for (const text of [
    'I want to kill myself', 'sometimes I feel suicidal', 'I just want to die',
    "I don't want to wake up tomorrow", 'I don’t want to live anymore', 'thinking about hurting myself',
    'self-harm again', 'everyone would be better off dead without me', 'I want to end it all',
  ]) assert.equal(crisisCheck(text), true, text);
});

test('crisisCheck ignores everyday worries', () => {
  for (const text of [
    'Pay the electric bill', 'The presentation might kill me lol', 'My phone battery died',
    'I hurt my knee at the gym', 'Deadline is killing me', 'Die Hard is on tonight', '',
  ]) assert.equal(crisisCheck(text), false, text);
  assert.equal(crisisCheck(undefined), false);
});

test('setNote adds, replaces, and removes a note on pending and parked thoughts', () => {
  let state = withParked('parked one');
  state = addThought(state, 'pending one').state;
  const parkedId = state.parked[0].id;
  const pendingId = state.pending[0].id;
  state = setNote(state, parkedId, '  First step: open the form  ');
  state = setNote(state, pendingId, 'Talk to Sam at lunch');
  assert.equal(state.parked[0].note, 'First step: open the form');
  assert.equal(state.pending[0].note, 'Talk to Sam at lunch');
  state = setNote(state, parkedId, '   ');
  assert.equal('note' in state.parked[0], false);
  assert.equal(setNote(state, pendingId, 'x'.repeat(500)).pending[0].note.length, 160);
});

test('notes survive saving and parking', () => {
  const storage = memoryStorage();
  let { state, thought } = addThought(emptyState(), 'Renew passport');
  state = setNote(state, thought.id, 'Check the form online');
  state = parkThought(state, thought.id).state;
  save(storage, state);
  assert.equal(load(storage).parked[0].note, 'Check the form online');
  assert.equal(parseState('{"parked":[{"id":"a","text":"t","note":42}]}').parked[0].note, undefined);
});

test('splitLocally splits spoken words into separate thoughts', () => {
  assert.deepEqual(
    splitLocally('I need to call mom and the report is due Friday and I keep thinking about the meeting'),
    ['I need to call mom', 'The report is due Friday', 'I keep thinking about the meeting'],
  );
  assert.deepEqual(
    splitLocally('um so pay the electric bill. Also renew my passport!'),
    ['Pay the electric bill', 'Renew my passport'],
  );
});

test('splitLocally keeps short fragments with the previous thought', () => {
  assert.deepEqual(splitLocally('buy bread and milk'), ['Buy bread and milk']);
  assert.deepEqual(splitLocally(''), []);
  assert.deepEqual(splitLocally(undefined), []);
});
