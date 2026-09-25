// Screens and event handling for ThoughtPark.
import {
  addThought, releaseThought, parkThought, toggleDone, morningList, modeForHour,
  load, save, promptAt, breathPhase, letGoParked, recordNight, markNightSeen, nightSummary,
  MAX_LENGTH,
} from './store.js';
import { renderSky, shootingStar, hideStarInfo } from './sky.js';

const screen = document.getElementById('screen');
const toggle = document.getElementById('mode-toggle');
const toastArea = document.getElementById('toast');
const notice = document.getElementById('notice');
const themeColor = document.querySelector('meta[name="theme-color"]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const UNDO_MS = 5000;
const PROMPT_IDLE_MS = 6000;

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

let promptTimer = null;
let promptIndex = 0;

let breathingFrame = null;

function commit(next) {
  state = next;
  if (!save(storage, state)) showSavingOff();
  updateSky();
}

function updateSky() {
  renderSky(state.parked.filter((t) => !t.done));
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
  stopPrompts();
  stopBreathing();
  hideStarInfo();
  document.body.classList.remove('is-all-clear', 'is-goodnight');
  for (const flyer of document.querySelectorAll('.falling-star')) flyer.remove();
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
  if (kind in session) session[kind] = Math.max(0, session[kind] - 1);
  if (mode === 'night') renderNight({ keepSession: true });
  else renderMorning({ animate: false });
}

// ---- Night screen ---------------------------------------------------------

function renderNight({ keepSession = false } = {}) {
  if (!keepSession) session = { parked: 0, released: 0 };
  document.body.classList.remove('is-goodnight');
  stopPrompts();

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
  const prompt = el('p', { className: 'prompt', id: 'prompt', hidden: true });
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
    schedulePrompt(input, prompt);
  });

  // Any typing hides the prompt; an empty, untouched box brings it back later.
  input.addEventListener('input', () => schedulePrompt(input, prompt));

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
    prompt,
    list,
    counter,
  );
  updateCounter(false);
  input.focus();
  schedulePrompt(input, prompt);
}

// ---- Gentle prompts -------------------------------------------------------

function schedulePrompt(input, prompt) {
  stopPrompts();
  prompt.hidden = true;
  if (input.value.trim()) return;
  const showNext = () => {
    if (!prompt.isConnected || input.value.trim()) return;
    prompt.textContent = promptAt(promptIndex);
    promptIndex += 1;
    prompt.hidden = false;
    prompt.classList.remove('is-fresh');
    void prompt.offsetWidth; // restart the fade-in
    prompt.classList.add('is-fresh');
    promptTimer = setTimeout(showNext, PROMPT_IDLE_MS);
  };
  promptTimer = setTimeout(showNext, PROMPT_IDLE_MS);
}

function stopPrompts() {
  clearTimeout(promptTimer);
  promptTimer = null;
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
    commit(recordNight(releaseThought(state, thought.id).state, 'released'));
    session.released += 1;
    animateOut(card, 'is-releasing', '--release-ms');
    shootingStar();
    offerUndo('Let go', before, 'released');
  });
  park.addEventListener('click', () => {
    const before = state;
    commit(recordNight(parkThought(state, thought.id).state, 'parked'));
    session.parked += 1;
    animateOut(card, 'is-parking', '--park-ms');
    updateCounter(true);
    offerUndo('Parked', before, 'parked');
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
  stopPrompts();
  stopBreathing();
  document.body.classList.add('is-goodnight');
  const summary = [
    session.parked ? `${plural(session.parked, 'thought')} parked` : null,
    session.released ? `${session.released} let go` : null,
  ].filter(Boolean).join(', ');

  const breathe = el('button', { type: 'button', className: 'btn btn-primary breathe-start', textContent: 'Breathe for a minute' });
  breathe.addEventListener('click', renderBreathing);
  const more = el('button', { type: 'button', className: 'link-button', textContent: 'Add another thought' });
  more.addEventListener('click', () => renderNight({ keepSession: true }));

  screen.replaceChildren(el('section', { className: 'goodnight' }, [
    el('h1', { className: 'goodnight-title', textContent: 'All parked. Goodnight.' }),
    el('p', { className: 'goodnight-summary', textContent: summary }),
    el('p', { className: 'goodnight-note', textContent: 'Nothing left to hold onto tonight.' }),
    breathe,
    more,
  ]));
}

// ---- Breathing moment -----------------------------------------------------

const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

function renderBreathing() {
  clearUndo();
  const circle = el('div', { className: 'breath-circle' });
  const label = el('p', { className: 'breath-label', textContent: 'Breathe in' });
  const remaining = el('p', { className: 'breath-remaining' });
  const stop = el('button', { type: 'button', className: 'link-button', textContent: 'Stop' });
  stop.addEventListener('click', renderGoodnight);

  screen.replaceChildren(el('section', { className: 'breathing' }, [
    el('div', { className: 'breath-stage' }, circle),
    label,
    remaining,
    stop,
  ]));

  const start = performance.now();
  let lastPhase = null;
  const tick = (now) => {
    const breath = breathPhase(now - start);
    if (breath.done) {
      breathingFrame = null;
      renderSleep();
      return;
    }
    if (breath.phase !== lastPhase) {
      label.textContent = breath.phase === 'in' ? 'Breathe in' : 'Breathe out';
      lastPhase = breath.phase;
    }
    remaining.textContent = `${breath.remainingSec}s`;
    if (!reduceMotion.matches) {
      const grow = breath.phase === 'in' ? ease(breath.progress) : 1 - ease(breath.progress);
      circle.style.transform = `scale(${(0.55 + 0.45 * grow).toFixed(3)})`;
    }
    breathingFrame = requestAnimationFrame(tick);
  };
  breathingFrame = requestAnimationFrame(tick);
}

function stopBreathing() {
  if (breathingFrame) cancelAnimationFrame(breathingFrame);
  breathingFrame = null;
  document.getElementById('sleep')?.remove();
}

// After the minute: the screen dims almost to black.
function renderSleep() {
  const overlay = el('button', { type: 'button', className: 'sleep-overlay', id: 'sleep' }, [
    el('span', { textContent: 'Goodnight' }),
  ]);
  overlay.setAttribute('aria-label', 'Goodnight. Tap to return.');
  overlay.addEventListener('click', renderGoodnight);
  document.body.append(overlay);
  overlay.focus();
}

// ---- Morning screen -------------------------------------------------------

function renderMorning({ animate = true } = {}) {
  const summaryText = nightSummary(state.night);
  commit(markNightSeen(state));
  const items = morningList(state);

  const toNight = el('button', {
    type: 'button',
    className: 'link-button',
    textContent: 'Park new thoughts',
  });
  toNight.addEventListener('click', () => setMode('night'));

  const header = [el('h1', { className: 'screen-title', textContent: 'Good morning' })];
  if (summaryText) {
    header.push(el('p', { className: 'morning-summary', id: 'morning-summary', textContent: summaryText }));
  }

  if (items.length === 0) {
    document.body.classList.remove('is-all-clear');
    screen.replaceChildren(
      ...header,
      el('p', { className: 'screen-sub', textContent: 'Nothing was parked. Clear mind, clear day.' }),
      toNight,
    );
    return;
  }

  const list = el('ul', { className: 'checklist is-entering', id: 'morning-list' });
  for (const thought of items) list.append(checkItemFor(thought));
  const allClear = el('p', { className: 'all-clear', id: 'all-clear', hidden: true }, [
    el('span', { className: 'all-clear-sun' }),
    'All clear. Have a good day.',
  ]);

  screen.replaceChildren(
    ...header,
    el('p', {
      className: 'screen-sub',
      textContent: 'Here’s what you parked last night. Done with one, or it doesn’t matter anymore? Check it off or let it go.',
    }),
    allClear,
    list,
    toNight,
  );
  updateAllClear(false);
  if (animate) arriveFromSky(list);
}

function checkItemFor(thought) {
  const check = el('button', { type: 'button', className: 'check-item' }, [
    el('span', { className: 'check-box' }),
    el('span', { className: 'check-text', textContent: thought.text }),
  ]);
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', String(thought.done));
  check.addEventListener('click', () => {
    commit(toggleDone(state, thought.id));
    renderMorningList();
    if (!thought.done) sunburst(thought.id);
    updateAllClear(true);
  });

  const item = el('li', { className: `morning-item${thought.done ? ' is-done' : ''}` }, check);
  item.dataset.id = thought.id;

  if (!thought.done) {
    const letGo = el('button', { type: 'button', className: 'morning-letgo', textContent: 'Let go' });
    letGo.title = 'Doesn’t matter anymore';
    letGo.setAttribute('aria-label', `Doesn’t matter anymore: let go of “${thought.text}”`);
    letGo.addEventListener('click', () => {
      const before = state;
      commit(letGoParked(state, thought.id));
      offerUndo('Let go', before, 'dismissed');
      item.classList.add('is-releasing');
      setTimeout(() => {
        if (mode !== 'morning' || !item.isConnected) return;
        if (morningList(state).length === 0) renderMorning({ animate: false });
        else { renderMorningList(); updateAllClear(true); }
      }, motionMs('--release-ms'));
    });
    item.append(letGo);
  }
  return item;
}

// Re-render just the list, keeping focus on the item that was tapped.
function renderMorningList() {
  const list = document.getElementById('morning-list');
  if (!list) return;
  list.classList.remove('is-entering');
  const focusedId = document.activeElement?.closest('li')?.dataset.id;
  list.replaceChildren(...morningList(state).map(checkItemFor));
  if (focusedId) list.querySelector(`li[data-id="${focusedId}"] .check-item`)?.focus();
}

// "All clear" shows only when every item is checked; the sun glows brighter.
function updateAllClear(celebrate) {
  const allClear = document.getElementById('all-clear');
  if (!allClear) return;
  const items = morningList(state);
  const done = items.length > 0 && items.every((t) => t.done);
  const wasHidden = allClear.hidden;
  allClear.hidden = !done;
  document.body.classList.toggle('is-all-clear', done);
  if (celebrate && done && wasHidden) {
    allClear.classList.remove('is-fresh');
    void allClear.offsetWidth; // restart the animation
    allClear.classList.add('is-fresh');
  }
}

// A short burst of sun rays from a checkbox that was just ticked.
function sunburst(id) {
  if (reduceMotion.matches) return;
  const box = document.querySelector(`#morning-list li[data-id="${id}"] .check-box`);
  if (!box) return;
  const burst = el('span', { className: 'sunburst' });
  box.append(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: true });
  setTimeout(() => burst.remove(), 1500);
}

// At sunrise, each star falls from the sky into its checklist item.
function arriveFromSky(list) {
  if (reduceMotion.matches || typeof Element.prototype.animate !== 'function') return;
  [...list.children].forEach((item, i) => {
    const star = document.querySelector(`.sky-star[data-id="${item.dataset.id}"]`);
    const box = item.querySelector('.check-box');
    if (!star || !box) return;
    const from = star.getBoundingClientRect();
    const to = box.getBoundingClientRect();
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const dx = to.left + to.width / 2 - startX;
    const dy = to.top + to.height / 2 - startY;

    item.classList.add('is-waiting');
    const flyer = el('span', { className: 'falling-star' });
    flyer.style.left = `${startX}px`;
    flyer.style.top = `${startY}px`;
    document.body.append(flyer);

    const flight = flyer.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.6}px)) scale(1.5)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.2 },
    ], { duration: 1100, delay: 350 + i * 200, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'both' });

    const land = () => {
      flyer.remove();
      item.classList.remove('is-waiting');
      item.classList.add('is-arriving');
    };
    flight.onfinish = land;
    flight.oncancel = land;
  });
}

// Check once at startup whether this browser lets us save at all.
if (!save(storage, state)) showSavingOff();
updateSky();
// Wait two frames so the page first paints as night; opening in the morning
// then plays the sunrise transition.
requestAnimationFrame(() => requestAnimationFrame(() => setMode(mode)));
