// Screens and event handling for ThoughtPark.
import {
  addThought, releaseThought, parkThought, toggleDone, morningList, modeForHour,
  load, save, MAX_LENGTH,
} from './store.js';

const screen = document.getElementById('screen');
const toggle = document.getElementById('mode-toggle');
const toastArea = document.getElementById('toast');
const notice = document.getElementById('notice');
const themeColor = document.querySelector('meta[name="theme-color"]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const UNDO_MS = 5000;

// localStorage can throw on access in some privacy modes, so reach it lazily.
const storage = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
};

let state = load(storage);
let mode = modeForHour(new Date().getHours());

// Counts for the Goodnight screen, reset each time the Night screen opens.
let session = { parked: 0, released: 0 };

// The state before the most recent park or release, kept only for Undo.
let undo = null;
let undoTimer = null;

function commit(next) {
  state = next;
  if (!save(storage, state)) showSavingOff();
}

function showSavingOff() {
  notice.textContent = 'Saving is off in this browser, so thoughts won’t be kept overnight.';
  notice.hidden = false;
}

// Read the animation length from CSS so JS and CSS stay in sync.
function cssDuration(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return parseFloat(value) || 0;
}

function motionMs(durationVar) {
  return reduceMotion.matches ? 250 : cssDuration(durationVar);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function openCount() {
  return state.parked.filter((t) => !t.done).length;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ---- Mode: night or morning -----------------------------------------------

function setMode(next) {
  mode = next;
  document.body.dataset.theme = mode;
  themeColor.content = mode === 'night' ? '#0e1424' : '#f7efe4';
  for (const button of toggle.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  clearUndo();
  if (mode === 'night') renderNight();
  else renderMorning();
}

toggle.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (button && button.dataset.mode !== mode) setMode(button.dataset.mode);
});

// ---- Undo toast -----------------------------------------------------------

function offerUndo(label, before, kind) {
  clearTimeout(undoTimer);
  undo = { before, kind };
  const button = el('button', { type: 'button', className: 'toast-undo', textContent: 'Undo' });
  button.addEventListener('click', applyUndo);
  toastArea.replaceChildren(el('div', { className: 'toast' }, [el('span', { textContent: label }), button]));
  undoTimer = setTimeout(clearUndo, UNDO_MS);
}

function clearUndo() {
  clearTimeout(undoTimer);
  undo = null;
  toastArea.replaceChildren();
}

function applyUndo() {
  if (!undo) return;
  const { before, kind } = undo;
  clearUndo();
  commit(before);
  session[kind] = Math.max(0, session[kind] - 1);
  renderNight({ keepSession: true });
}

// ---- Night screen ---------------------------------------------------------

function renderNight({ keepSession = false } = {}) {
  if (!keepSession) session = { parked: 0, released: 0 };

  const input = el('textarea', {
    id: 'thought',
    rows: 1,
    maxLength: MAX_LENGTH,
    placeholder: "What's on your mind?",
    autocomplete: 'off',
  });
  const add = el('button', { type: 'submit', className: 'btn btn-primary', textContent: 'Add' });
  const form = el('form', { className: 'compose' }, [
    el('label', { htmlFor: 'thought', className: 'sr-only', textContent: "What's on your mind?" }),
    input,
    add,
  ]);
  const hint = el('p', {
    className: 'hint',
    id: 'hint',
    textContent: 'Type each thought, then park it. They’ll be waiting in the morning.',
    hidden: state.seenHint,
  });
  const list = el('ul', { className: 'cards', id: 'cards' });
  list.setAttribute('aria-live', 'polite');
  const counter = el('p', { className: 'parked-count', id: 'parked-count' });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = addThought(state, input.value);
    if (!result.thought) return;
    commit({ ...result.state, seenHint: true });
    hint.hidden = true;
    list.prepend(cardFor(result.thought));
    input.value = '';
    input.focus();
  });

  // Enter adds the thought; Shift+Enter is ignored so the box stays one thought at a time.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  for (const thought of state.pending) list.append(cardFor(thought));

  screen.replaceChildren(
    el('h1', { className: 'screen-title', textContent: 'Park your thoughts for tonight' }),
    form,
    hint,
    list,
    counter,
  );
  updateCounter(false);
  input.focus();
}

function cardFor(thought) {
  const release = el('button', { type: 'button', className: 'btn btn-quiet', textContent: 'Let it go' });
  const park = el('button', { type: 'button', className: 'btn btn-primary', textContent: 'Tomorrow' });
  const card = el('li', { className: 'card' }, [
    el('p', { className: 'card-text', textContent: thought.text }),
    el('div', { className: 'card-actions' }, [release, park]),
  ]);
  card.dataset.id = thought.id;

  release.addEventListener('click', () => {
    const before = state;
    commit(releaseThought(state, thought.id).state);
    session.released += 1;
    animateOut(card, 'is-releasing', '--release-ms');
    offerUndo('Let go', before, 'released');
  });
  park.addEventListener('click', () => {
    const before = state;
    commit(parkThought(state, thought.id).state);
    session.parked += 1;
    animateOut(card, 'is-parking', '--park-ms');
    updateCounter(true);
    offerUndo('Parked for tomorrow', before, 'parked');
  });
  return card;
}

// Remove the card after its animation; if it was the last one, say goodnight.
function animateOut(card, className, durationVar) {
  card.classList.add(className);
  setTimeout(() => {
    card.remove();
    const nothingLeft = state.pending.length === 0;
    const handledSome = session.parked + session.released > 0;
    if (mode === 'night' && nothingLeft && handledSome && document.getElementById('cards')) {
      renderGoodnight();
    }
  }, motionMs(durationVar));
}

function updateCounter(bump) {
  const counter = document.getElementById('parked-count');
  if (!counter) return;
  counter.replaceChildren('Parked for tomorrow: ', el('strong', { textContent: String(openCount()) }));
  if (bump) {
    counter.classList.remove('bump');
    void counter.offsetWidth; // restart the animation
    counter.classList.add('bump');
  }
}

// ---- Goodnight screen -----------------------------------------------------

function renderGoodnight() {
  const summary = [
    session.parked ? `${plural(session.parked, 'thought')} parked` : null,
    session.released ? `${session.released} let go` : null,
  ].filter(Boolean).join(', ');

  const more = el('button', { type: 'button', className: 'link-button', textContent: 'Add another thought' });
  more.addEventListener('click', () => renderNight({ keepSession: true }));

  screen.replaceChildren(el('section', { className: 'goodnight' }, [
    el('h1', { className: 'goodnight-title', textContent: 'All parked. Goodnight.' }),
    el('p', { className: 'goodnight-summary', textContent: summary }),
    el('p', { className: 'goodnight-note', textContent: 'Nothing left to hold onto tonight.' }),
    more,
  ]));
}

// ---- Morning screen -------------------------------------------------------

function renderMorning() {
  const items = morningList(state);
  const toNight = el('button', {
    type: 'button',
    className: 'link-button',
    textContent: 'Park new thoughts',
  });
  toNight.addEventListener('click', () => setMode('night'));

  if (items.length === 0) {
    screen.replaceChildren(
      el('h1', { className: 'screen-title', textContent: 'Good morning' }),
      el('p', { className: 'screen-sub', textContent: 'Nothing was parked. Clear mind, clear day.' }),
      toNight,
    );
    return;
  }

  const list = el('ul', { className: 'checklist is-entering', id: 'morning-list' });
  for (const thought of items) list.append(checkItemFor(thought));

  screen.replaceChildren(
    el('h1', { className: 'screen-title', textContent: 'Good morning' }),
    el('p', { className: 'screen-sub', textContent: 'Here’s what you parked last night.' }),
    list,
    toNight,
  );
}

function checkItemFor(thought) {
  const button = el('button', { type: 'button', className: 'check-item' }, [
    el('span', { className: 'check-box' }),
    el('span', { className: 'check-text', textContent: thought.text }),
  ]);
  button.setAttribute('role', 'checkbox');
  button.setAttribute('aria-checked', String(thought.done));
  button.addEventListener('click', () => {
    commit(toggleDone(state, thought.id));
    renderMorningList();
  });
  const item = el('li', { className: thought.done ? 'is-done' : '' }, button);
  item.dataset.id = thought.id;
  return item;
}

// Re-render just the list, keeping focus on the item that was tapped.
function renderMorningList() {
  const list = document.getElementById('morning-list');
  list.classList.remove('is-entering');
  const focusedId = document.activeElement?.closest('li')?.dataset.id;
  list.replaceChildren(...morningList(state).map(checkItemFor));
  if (focusedId) list.querySelector(`li[data-id="${focusedId}"] button`)?.focus();
}

// Check once at startup whether this browser lets us save at all.
if (!save(storage, state)) showSavingOff();
setMode(mode);
