// Help me fall asleep: Mind shuffle, Sleep sounds, and Sleep story. Each takes
// over the screen, has a Stop button, and can end in the dim "Goodnight" view.
import { shuffleSequence, SHUFFLE_WORDS } from './store.js';
import { sleepStory, friendlyError, isDemo } from './ai.js';
import * as sounds from './sounds.js';

const SHUFFLE_STEP_MS = 7000;
const SHUFFLE_SESSION_MS = 5 * 60 * 1000;
const STORY_SETTINGS = ['a lighthouse by the sea', 'a night train through the mountains', 'a snowy cabin in the woods', 'a quiet garden at dusk'];

let timers = [];
let active = false;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

// Stop whatever sleep tool is running: timers, sound, and voice.
export function stopSleepTools() {
  active = false;
  for (const timer of timers) clearTimeout(timer);
  timers = [];
  sounds.stop();
  sounds.whenEnded(null);
  window.speechSynthesis?.cancel();
  document.body.classList.remove('is-sleep-dim');
}

function frame(className, children, onStop) {
  const stop = el('button', { type: 'button', className: 'link-button sleep-stop', textContent: 'Stop' });
  stop.addEventListener('click', () => { stopSleepTools(); onStop(); });
  return el('section', { className: `sleep-tool ${className}` }, [...children, stop]);
}

// ---- Mind shuffle ---------------------------------------------------------

export function startShuffle(screen, { onStop, onDone }) {
  stopSleepTools();
  active = true;
  const word = SHUFFLE_WORDS[Math.floor(Math.random() * SHUFFLE_WORDS.length)];
  const steps = shuffleSequence(word);
  const letters = el('p', { className: 'shuffle-word' }, [...word].map((l) => el('span', { textContent: l })));
  const letter = el('p', { className: 'shuffle-letter' });
  const item = el('p', { className: 'shuffle-item' });
  item.setAttribute('aria-live', 'polite');

  screen.replaceChildren(frame('shuffle', [
    el('p', { className: 'sleep-intro', textContent: 'Picture each thing for a moment, then let it go. No need to connect them.' }),
    letters,
    letter,
    item,
  ], onStop));
  document.body.classList.add('is-sleep-dim');

  const started = Date.now();
  let i = 0;
  const show = () => {
    if (!active) return;
    if (Date.now() - started >= SHUFFLE_SESSION_MS) {
      stopSleepTools();
      onDone();
      return;
    }
    const step = steps[i % steps.length];
    const letterIndex = Math.floor((i % steps.length) / 3); // three things per letter
    [...letters.children].forEach((span, n) => span.classList.toggle('is-current', n === letterIndex));
    letter.textContent = step.letter;
    item.textContent = step.item;
    item.classList.remove('is-fresh');
    void item.offsetWidth; // restart the fade
    item.classList.add('is-fresh');
    i += 1;
    later(show, SHUFFLE_STEP_MS);
  };
  show();
}

// ---- Sleep sounds ---------------------------------------------------------

export function startSounds(screen, { onStop, onDone }) {
  stopSleepTools();
  active = true;
  if (!sounds.isSupported()) {
    screen.replaceChildren(frame('sounds', [el('p', { textContent: 'This browser can’t play generated sounds.' })], onStop));
    return;
  }
  let minutes = 30;
  const status = el('p', { className: 'sounds-status', textContent: 'Choose a sound.' });
  status.setAttribute('role', 'status');

  const soundButtons = sounds.SOUNDS.map((s) => {
    const button = el('button', { type: 'button', className: 'chip', textContent: s.label });
    button.dataset.sound = s.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', async () => {
      for (const b of soundButtons) b.setAttribute('aria-pressed', String(b === button));
      await sounds.play(s.id, minutes);
      status.textContent = `${s.label} is playing. It will fade out after ${minutes} minutes.`;
      document.body.classList.add('is-sleep-dim');
    });
    return button;
  });

  const timerButtons = [15, 30, 60].map((m) => {
    const button = el('button', { type: 'button', className: 'chip', textContent: `${m} min` });
    button.dataset.minutes = String(m);
    button.setAttribute('aria-pressed', String(m === minutes));
    button.addEventListener('click', () => {
      minutes = m;
      for (const b of timerButtons) b.setAttribute('aria-pressed', String(b === button));
      const playing = soundButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
      if (playing) playing.click(); // restart with the new timer
    });
    return button;
  });

  sounds.whenEnded(() => { if (active) { stopSleepTools(); onDone(); } });
  screen.replaceChildren(frame('sounds', [
    el('h2', { className: 'sleep-title', textContent: 'Sleep sounds' }),
    el('div', { className: 'chips' }, soundButtons),
    el('p', { className: 'sleep-label', textContent: 'Fade out after' }),
    el('div', { className: 'chips' }, timerButtons),
    status,
  ], onStop));
}

// ---- Sleep story ----------------------------------------------------------

export function startStory(screen, { onStop, onDone }) {
  stopSleepTools();
  active = true;
  const settings = STORY_SETTINGS.map((setting) => {
    const button = el('button', { type: 'button', className: 'chip chip-wide', textContent: setting[0].toUpperCase() + setting.slice(1) });
    button.addEventListener('click', () => tellStory(screen, setting, { onStop, onDone }));
    return button;
  });
  screen.replaceChildren(frame('story', [
    el('h2', { className: 'sleep-title', textContent: 'Sleep story' }),
    el('p', { className: 'sleep-intro', textContent: 'Choose where tonight’s story takes place. It’s slow and uneventful on purpose.' }),
    el('div', { className: 'chips chips-column' }, settings),
    ...(isDemo() ? [el('p', { className: 'plan-demo', textContent: 'Demo mode: a sample story. Add your API key in Settings for a new story from Claude each night.' })] : []),
  ], onStop));
}

async function tellStory(screen, setting, { onStop, onDone }) {
  const synth = window.speechSynthesis;
  let readAloud = Boolean(synth);
  let spokenUpTo = 0;
  let pending = 0;
  let streamDone = false;

  const text = el('p', { className: 'story-text' });
  text.setAttribute('aria-live', 'off');
  const aloud = el('button', { type: 'button', className: 'chip', textContent: 'Read aloud: on' });
  aloud.setAttribute('aria-pressed', String(readAloud));
  aloud.hidden = !synth;
  aloud.addEventListener('click', () => {
    readAloud = !readAloud;
    aloud.textContent = `Read aloud: ${readAloud ? 'on' : 'off'}`;
    aloud.setAttribute('aria-pressed', String(readAloud));
    if (!readAloud) synth.cancel();
  });

  screen.replaceChildren(frame('story story-reading', [aloud, text], onStop));
  document.body.classList.add('is-sleep-dim');

  const maybeFinish = () => {
    if (active && streamDone && pending === 0) later(() => { if (active) { stopSleepTools(); onDone(); } }, 5000);
  };
  const speak = (sentence) => {
    if (!readAloud || !sentence.trim()) return;
    const utterance = new SpeechSynthesisUtterance(sentence.trim());
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    pending += 1;
    utterance.onend = () => { pending -= 1; maybeFinish(); };
    utterance.onerror = utterance.onend;
    synth.speak(utterance);
  };
  // Speak each finished sentence as the story streams in.
  const speakFinishedSentences = (all, final = false) => {
    const rest = all.slice(spokenUpTo);
    const match = final ? rest : rest.match(/^[\s\S]*[.!?…](?=\s)/)?.[0];
    if (!match) return;
    spokenUpTo += match.length;
    for (const sentence of match.split(/(?<=[.!?…])\s+/)) speak(sentence);
  };

  try {
    let all = '';
    await sleepStory({
      setting,
      onText: (delta) => {
        if (!active) return;
        all += delta;
        text.textContent = all;
        speakFinishedSentences(all);
      },
    });
    if (!active) return;
    speakFinishedSentences(all, true);
    streamDone = true;
    maybeFinish();
  } catch (error) {
    if (active) text.textContent = friendlyError(error);
  }
}
