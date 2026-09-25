// Screens and event handling for ThoughtPark.
import {
  addThought, releaseThought, parkThought, toggleDone, morningList, modeForHour,
  load, save, MAX_LENGTH,
} from './store.js';

const screen = document.getElementById('screen');
const toggle = document.getElementById('mode-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// localStorage can throw on access in some privacy modes, so reach it lazily.
const storage = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
};

let state = load(storage);
let mode = modeForHour(new Date().getHours());

function commit(next) {
  state = next;
  save(storage, state);
}

// Read the animation length from CSS so JS and CSS stay in sync.
function cssDuration(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return parseFloat(value) || 0;
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

// ---- Mode: night or morning -----------------------------------------------

function setMode(next) {
  mode = next;
  document.body.dataset.theme = mode;
  themeColor.content = mode === 'night' ? '#0e1424' : '#f7efe4';
  for (const button of toggle.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  if (mode === 'night') renderNight();
  else renderMorning();
}

toggle.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (button && button.dataset.mode !== mode) setMode(button.dataset.mode);
});

// ---- Night screen ---------------------------------------------------------

function renderNight() {
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
  const list = el('ul', { className: 'cards', id: 'cards' });
  list.setAttribute('aria-live', 'polite');
  const counter = el('p', { className: 'parked-count', id: 'parked-count' });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = addThought(state, input.value);
    if (!result.thought) return;
    commit(result.state);
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
    commit(releaseThought(state, thought.id).state);
    animateOut(card, 'is-releasing', '--release-ms');
  });
  park.addEventListener('click', () => {
    commit(parkThought(state, thought.id).state);
    animateOut(card, 'is-parking', '--park-ms');
    updateCounter(true);
  });
  return card;
}

function animateOut(card, className, durationVar) {
  card.classList.add(className);
  const ms = reduceMotion.matches ? 250 : cssDuration(durationVar);
  setTimeout(() => card.remove(), ms);
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

// ---- Morning screen -------------------------------------------------------

function renderMorning() {
  const list = el('ul', { className: 'checklist is-entering', id: 'morning-list' });
  for (const thought of morningList(state)) list.append(checkItemFor(thought));

  const toNight = el('button', {
    type: 'button',
    className: 'link-button',
    textContent: 'Park new thoughts',
  });
  toNight.addEventListener('click', () => setMode('night'));

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

setMode(mode);
