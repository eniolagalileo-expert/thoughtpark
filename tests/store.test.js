import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, cleanText, addThought, releaseThought, parkThought, MAX_LENGTH,
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
