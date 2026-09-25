// Worry time: a CBT technique. For 15 minutes in the daytime, go through the
// worries still waiting from last night, one at a time, then stop — the rest
// can wait for the next worry time instead of following you to bed.
import { morningList, toggleDone, letGoParked, setNote } from './store.js';

export const WORRY_TIME_MS = 15 * 60 * 1000;

let timer = null;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

export function stopWorryTime() {
  clearTimeout(timer);
  timer = null;
}

function clock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// getState/commit read and save app state; openTalk opens Talk it through;
// onEnd returns to the Morning screen.
export function startWorryTime(screen, { getState, commit, openTalk, onEnd }) {
  stopWorryTime();
  const queue = morningList(getState()).filter((t) => !t.done).map((t) => t.id);
  const endsAt = Date.now() + WORRY_TIME_MS;
  let index = 0;
  let handled = 0;

  const remaining = el('p', { className: 'worry-clock' });
  remaining.setAttribute('role', 'timer');
  const body = el('div', { className: 'worry-body' });
  const back = el('button', { type: 'button', className: 'link-button worry-back', textContent: 'End worry time' });
  back.addEventListener('click', () => { stopWorryTime(); onEnd(); });

  screen.replaceChildren(el('section', { className: 'worry-time' }, [
    el('h1', { className: 'screen-title worry-title', textContent: 'Worry time' }),
    el('p', { className: 'worry-intro', textContent: 'Fifteen minutes for the worries still waiting. Deal with one, plan it, or let it go. When time’s up, the rest can wait.' }),
    remaining,
    body,
    back,
  ]));

  const tick = () => {
    const left = endsAt - Date.now();
    remaining.textContent = `${clock(left)} left`;
    if (left <= 0) { finish('Worry time is over. The rest can wait until tomorrow’s worry time.'); return; }
    timer = setTimeout(tick, 1000);
  };

  function finish(message) {
    stopWorryTime();
    remaining.textContent = '';
    body.replaceChildren(el('div', { className: 'worry-done' }, [
      el('p', { className: 'worry-done-title', textContent: message }),
      el('p', { className: 'worry-done-count', textContent: `You worked through ${handled} worr${handled === 1 ? 'y' : 'ies'}.` }),
    ]));
    back.textContent = 'Back to the morning';
  }

  function current() {
    while (index < queue.length) {
      const thought = getState().parked.find((t) => t.id === queue[index] && !t.done);
      if (thought) return thought;
      index += 1;
    }
    return null;
  }

  function show() {
    const thought = current();
    if (!thought) { finish('That’s every worry. Worry time is done early.'); return; }
    const done = el('button', { type: 'button', className: 'btn btn-primary', textContent: 'Done ✓' });
    const talk = el('button', { type: 'button', className: 'talk-button worry-talk' }, [el('span', { className: 'talk-icon', textContent: '✦' }), 'Talk it through']);
    const letGo = el('button', { type: 'button', className: 'btn btn-quiet', textContent: 'Let go' });
    const next = el('button', { type: 'button', className: 'inline-link worry-next', textContent: 'Skip for now' });
    done.addEventListener('click', () => { commit(toggleDone(getState(), thought.id)); handled += 1; index += 1; show(); });
    letGo.addEventListener('click', () => { commit(letGoParked(getState(), thought.id)); handled += 1; index += 1; show(); });
    next.addEventListener('click', () => { index += 1; show(); });
    talk.addEventListener('click', () => openTalk({
      thought,
      mode: 'morning',
      onSave: (note) => { commit(setNote(getState(), thought.id, note)); show(); },
    }));
    body.replaceChildren(el('article', { className: 'worry-item' }, [
      el('p', { className: 'worry-count', textContent: `${index + 1} of ${queue.length}` }),
      el('p', { className: 'worry-text', textContent: thought.text }),
      ...(thought.note ? [el('p', { className: 'worry-note', textContent: thought.note })] : []),
      talk,
      el('div', { className: 'worry-actions' }, [letGo, done]),
      next,
    ]));
  }

  tick();
  show();
}
