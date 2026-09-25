// Screens and event handling for ThoughtPark.
import {
  emptyState, addThought, releaseThought, parkThought, MAX_LENGTH,
} from './store.js';

const screen = document.getElementById('screen');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let state = emptyState();

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
    state = result.state;
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
    state = releaseThought(state, thought.id).state;
    animateOut(card, 'is-releasing', '--release-ms');
  });
  park.addEventListener('click', () => {
    state = parkThought(state, thought.id).state;
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

renderNight();
