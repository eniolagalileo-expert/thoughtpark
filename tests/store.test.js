import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, cleanText, addThought, releaseThought, parkThought, MAX_LENGTH,
  toggleDone, clearDone, morningList, modeForHour, parseState, load, save, STORAGE_KEY,
  starPosition, hashString, promptAt, PROMPTS, breathPhase,
  letGoParked, recordNight, markNightSeen, nightSummary, crisisCheck, setNote, splitLocally,
  shuffleSequence, SHUFFLE_WORDS, SHUFFLE_ITEMS,
  addDream, updateDream, deleteDream, setDreamReflection, dreamForDay, cleanDream, MAX_DREAMS,
  dayKey, nightKey, dreamNightKey, withHistoryBackfill, nightDetails, monthMarks, MAX_HISTORY_DAYS,
  startSleepAid, updateSleepAid, endSleepAid, addGoodThing, goodThingsTonight, MAX_GOOD_THINGS,
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

test('the welcome guide is remembered once seen', () => {
  const storage = memoryStorage();
  assert.equal(emptyState().seenGuide, false);
  save(storage, { ...emptyState(), seenGuide: true });
  assert.equal(load(storage).seenGuide, true);
  assert.equal(parseState('{"seenGuide":"yes"}').seenGuide, true);
  assert.equal(parseState('{}').seenGuide, false);
});

test('every mind shuffle word has things to picture for each letter', () => {
  for (const word of SHUFFLE_WORDS) {
    for (const letter of word) assert.ok(SHUFFLE_ITEMS[letter]?.length >= 3, `${word}: ${letter}`);
    assert.equal(shuffleSequence(word).length, word.length * 3);
  }
});

test('shuffleSequence walks the word letter by letter', () => {
  const steps = shuffleSequence('bed'.replace('d', 'e'), 2);
  assert.deepEqual(steps.map((s) => s.letter), ['B', 'B', 'E', 'E', 'E', 'E']);
  assert.equal(steps[0].item, 'a bicycle');
  assert.deepEqual(shuffleSequence('xyz'), []);
});

// ---- Dream journal -------------------------------------------------------

const MORNING = new Date(2026, 8, 25, 7, 30).getTime();
const REFLECTION = { title: 'The long train', feelings: ['calm'], themes: ['travel'], reflection: 'A quiet journey.', connection: '', question: 'Where were you going?' };

test('a dream is noted for the day and found again', () => {
  const { state, dream } = addDream(emptyState(), '  I was on a train\n\n\n\nby the sea  ', MORNING);
  assert.equal(dream.text, 'I was on a train\n\nby the sea');
  assert.equal(dreamForDay(state, MORNING + 3 * 3600e3).id, dream.id);
  assert.equal(dreamForDay(state, MORNING + 24 * 3600e3), null);
  assert.equal(addDream(emptyState(), '   ').dream, null);
  assert.equal(cleanDream('x'.repeat(5000)).length, 2000);
});

test('editing a dream clears its reflection; deleting removes it', () => {
  let { state, dream } = addDream(emptyState(), 'Flying over a city', MORNING);
  state = setDreamReflection(state, dream.id, REFLECTION);
  assert.equal(state.dreams[0].reflection.title, 'The long train');
  state = updateDream(state, dream.id, 'Flying over a small town');
  assert.equal(state.dreams[0].text, 'Flying over a small town');
  assert.equal('reflection' in state.dreams[0], false);
  assert.equal(deleteDream(state, dream.id).dreams.length, 0);
});

test('only the newest dreams are kept', () => {
  let state = emptyState();
  for (let i = 0; i < MAX_DREAMS + 5; i += 1) state = addDream(state, `dream ${i}`, MORNING + i).state;
  assert.equal(state.dreams.length, MAX_DREAMS);
  assert.equal(state.dreams[0].text, `dream ${MAX_DREAMS + 4}`);
});

test('dreams and reflections survive saving; bad data is dropped', () => {
  const storage = memoryStorage();
  let { state, dream } = addDream(emptyState(), 'A garden at night', MORNING);
  state = setDreamReflection(state, dream.id, REFLECTION);
  save(storage, state);
  assert.deepEqual(load(storage).dreams[0].reflection, REFLECTION);
  const parsed = parseState(JSON.stringify({ dreams: [{ id: 'a', text: 't', createdAt: 1, reflection: { title: 5 } }, { id: 'b' }, 'x'] }));
  assert.equal(parsed.dreams.length, 1);
  assert.equal('reflection' in parsed.dreams[0], false);
});

// ---- Calendar -------------------------------------------------------------

const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute).getTime();

test('a night runs from 5 am to 5 am', () => {
  assert.equal(dayKey(at(24, 23)), '2026-09-24');
  assert.equal(nightKey(at(24, 23)), '2026-09-24');
  assert.equal(nightKey(at(25, 1)), '2026-09-24');
  assert.equal(nightKey(at(25, 4, 59)), '2026-09-24');
  assert.equal(nightKey(at(25, 5)), '2026-09-25');
});

test('a morning dream belongs to the night before', () => {
  assert.equal(dreamNightKey(at(25, 7)), '2026-09-24');
  assert.equal(dreamNightKey(at(25, 15)), '2026-09-24');
  assert.equal(dreamNightKey(at(25, 3)), '2026-09-24');
  assert.equal(dreamNightKey(new Date(2026, 9, 1, 8).getTime()), '2026-09-30');
});

function nightOf24() {
  let state = emptyState();
  for (const text of ['Renew passport', 'Reply to Jordan', 'Awkward joke', 'Buy milk']) state = addThought(state, text, at(24, 22)).state;
  const id = (text) => state.pending.find((t) => t.text === text).id;
  const ids = { passport: id('Renew passport'), jordan: id('Reply to Jordan'), joke: id('Awkward joke'), milk: id('Buy milk') };
  state = parkThought(state, ids.passport, at(24, 23)).state;
  state = parkThought(state, ids.jordan, at(25, 0, 30)).state;
  state = parkThought(state, ids.milk, at(25, 0, 40)).state;
  state = releaseThought(state, ids.joke, at(25, 0, 45)).state;
  return { state, ids };
}

test('parking and letting go at night are kept on that night', () => {
  const { state } = nightOf24();
  const night = nightDetails(state, '2026-09-24');
  assert.deepEqual(night.parked.map((t) => t.text).sort(), ['Buy milk', 'Renew passport', 'Reply to Jordan']);
  assert.equal(night.released, 1);
  assert.equal(JSON.stringify(state.history).includes('Awkward joke'), false);
});

test('morning outcomes and notes show on the night', () => {
  let { state, ids } = nightOf24();
  state = setNote(state, ids.passport, 'Open the form first');
  state = toggleDone(state, ids.passport);
  state = letGoParked(state, ids.jordan);
  let night = nightDetails(state, '2026-09-24');
  const byText = Object.fromEntries(night.parked.map((t) => [t.text, t]));
  assert.equal(byText['Renew passport'].outcome, 'done');
  assert.equal(byText['Renew passport'].note, 'Open the form first');
  assert.equal(byText['Reply to Jordan'].outcome, 'let-go');
  assert.equal('outcome' in byText['Buy milk'], false);
  state = toggleDone(state, ids.passport);
  night = nightDetails(state, '2026-09-24');
  assert.equal('outcome' in night.parked.find((t) => t.id === ids.passport), false);
});

test('history outlives the morning list being cleared', () => {
  let { state, ids } = nightOf24();
  state = toggleDone(state, ids.passport);
  const added = addThought(state, 'Next night', at(25, 22));
  state = parkThought(added.state, added.thought.id, at(25, 22)).state;
  assert.equal(state.parked.some((t) => t.id === ids.passport), false);
  assert.equal(nightDetails(state, '2026-09-24').parked.find((t) => t.id === ids.passport).outcome, 'done');
  assert.deepEqual(nightDetails(state, '2026-09-25').parked.map((t) => t.text), ['Next night']);
});

test('dreams and marks appear on the calendar month', () => {
  let { state } = nightOf24();
  state = addDream(state, 'A long train', at(25, 7)).state;
  assert.equal(nightDetails(state, '2026-09-24').dream.text, 'A long train');
  assert.deepEqual(monthMarks(state, 2026, 8), { '2026-09-24': { thoughts: 4, aids: 0, dream: true } });
  assert.deepEqual(monthMarks(state, 2026, 9), {});
  assert.equal(nightDetails(state, '2026-09-20').parked.length, 0);
});

test('older parked thoughts are backfilled into the calendar', () => {
  const old = { ...emptyState(), parked: [
    { id: 'a', text: 'From before', createdAt: at(20, 22), parkedAt: at(20, 23), done: true },
    { id: 'b', text: 'No time', createdAt: 1, done: false },
  ] };
  const filled = withHistoryBackfill(old);
  assert.deepEqual(nightDetails(filled, '2026-09-20').parked, [{ id: 'a', text: 'From before', outcome: 'done' }]);
  assert.equal(withHistoryBackfill(filled), filled);
});

test('history is capped and cleaned when loaded', () => {
  let state = emptyState();
  for (let i = 0; i < MAX_HISTORY_DAYS + 3; i += 1) {
    const added = addThought(state, `t${i}`, 0);
    state = parkThought(added.state, added.thought.id, new Date(2025, 0, 1 + i, 22).getTime()).state;
  }
  assert.equal(Object.keys(state.history).length, MAX_HISTORY_DAYS);
  const storage = memoryStorage();
  save(storage, state);
  assert.equal(Object.keys(load(storage).history).length, MAX_HISTORY_DAYS);
  const parsed = parseState(JSON.stringify({ history: { 'bad-key': {}, '2026-09-24': { parked: [{ id: 'x', text: 'y', outcome: 'weird' }, { nope: 1 }], released: -2 } } }));
  assert.deepEqual(parsed.history, { '2026-09-24': { parked: [{ id: 'x', text: 'y' }], released: 0, aids: [], good: [] } });
});

test('sleep tools used at night are kept on that night', () => {
  let { state } = nightOf24();
  let started = startSleepAid(state, 'shuffle', '', at(25, 0, 50));
  state = endSleepAid(started.state, started.id, { finished: true, now: at(25, 0, 55) });
  started = startSleepAid(state, 'sounds', 'Rain, 30 min timer', at(25, 1));
  state = updateSleepAid(started.state, started.id, 'Ocean, 15 min timer');
  state = endSleepAid(state, started.id, { finished: false, now: at(25, 1, 2) });
  const aids = nightDetails(state, '2026-09-24').aids;
  assert.deepEqual(aids.map((a) => [a.tool, a.detail ?? '', a.minutes, a.finished]), [['shuffle', '', 5, true], ['sounds', 'Ocean, 15 min timer', 2, false]]);
  assert.equal(monthMarks(state, 2026, 8)['2026-09-24'].aids, 2);
});

test('a night with only a sleep tool is still marked, and aids survive saving', () => {
  const started = startSleepAid(emptyState(), 'breathe', '', at(20, 23));
  const state = endSleepAid(started.state, started.id, { finished: true, now: at(20, 23, 1) });
  assert.deepEqual(monthMarks(state, 2026, 8), { '2026-09-20': { thoughts: 0, aids: 1, dream: false } });
  const storage = memoryStorage();
  save(storage, state);
  assert.deepEqual(load(storage).history['2026-09-20'].aids[0], { id: started.id, tool: 'breathe', startedAt: at(20, 23), minutes: 1, finished: true });
  const parsed = parseState(JSON.stringify({ history: { '2026-09-20': { parked: [], aids: [{ id: 'a', tool: 'bogus', startedAt: 1 }, { id: 'b', tool: 'story', startedAt: 2, detail: 'a garden', minutes: -1 }] } } }));
  assert.deepEqual(parsed.history['2026-09-20'].aids, [{ id: 'b', tool: 'story', startedAt: 2, detail: 'a garden' }]);
});

test('up to three good things are kept on tonight', () => {
  let state = emptyState();
  for (const g of ['Coffee with Sam', '  a long walk  ', 'Finished the draft', 'One too many']) state = addGoodThing(state, g, at(24, 22));
  assert.deepEqual(goodThingsTonight(state, at(25, 1)), ['Coffee with Sam', 'a long walk', 'Finished the draft']);
  assert.equal(MAX_GOOD_THINGS, 3);
  assert.equal(addGoodThing(state, '   ', at(24, 22)), state);
  assert.deepEqual(nightDetails(state, '2026-09-24').good.length, 3);
  const storage = memoryStorage();
  save(storage, state);
  assert.deepEqual(load(storage).history['2026-09-24'].good, ['Coffee with Sam', 'a long walk', 'Finished the draft']);
});
