// Screens and event handling for ThoughtPark.
import {
  addThought, releaseThought, parkThought, toggleDone, morningList, modeForHour,
  load, save, promptAt, breathPhase, letGoParked, recordNight, markNightSeen, nightSummary,
  setNote, crisisCheck, splitLocally, withHistoryBackfill, startSleepAid, updateSleepAid, endSleepAid,
  addGoodThing, goodThingsTonight, MAX_GOOD_THINGS, lastNightKey, rateNight, nightDetails, MAX_LENGTH,
} from './store.js';
import { openTalk, openSettings, showCrisis } from './companion.js';
import { splitThoughts, morningPlan, friendlyError, isDemo } from './ai.js';
import { openGuide } from './guide.js';
import { dreamSection } from './dreams.js';
import { openCalendar } from './calendar.js';
import { startShuffle, startSounds, startStory, stopSleepTools } from './sleep.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
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

let state = withHistoryBackfill(load(storage));
let mode = modeForHour(new Date().getHours());

// Counts for the Goodnight screen, reset each time the Night screen opens.
let session = { parked: 0, released: 0 };

// The state before the most recent park or release, kept only for Undo.
let undo = null;
let undoTimer = null;

let promptTimer = null;
let promptIndex = 0;

let breathingFrame = null;

// The sleep tool running now, recorded on tonight's calendar entry.
let currentAid = null;
const aidTracker = {
  start(tool, detail = '') {
    endAid(false);
    const started = startSleepAid(state, tool, detail);
    commit(started.state);
    currentAid = started.id;
  },
  update(detail) {
    if (currentAid) commit(updateSleepAid(state, currentAid, detail));
  },
};

function endAid(finished) {
  if (!currentAid) return;
  commit(endSleepAid(state, currentAid, { finished }));
  currentAid = null;
}

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
  recognition?.abort();
  endAid(false);
  document.body.classList.remove('is-all-clear', 'is-goodnight');
  for (const flyer of document.querySelectorAll('.falling-star')) flyer.remove();
  if (mode === 'night') renderNight();
  else renderMorning();
}

toggle.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-mode]');
  if (button && button.dataset.mode !== mode) setMode(button.dataset.mode);
});

document.getElementById('open-settings').addEventListener('click', () => openSettings());

function showGuide() {
  openGuide({ onClose: () => { if (!state.seenGuide) commit({ ...state, seenGuide: true }); } });
}

// "How it works" (reopens the welcome guide) and "Your calendar" links.
function howItWorks() {
  const link = el('button', { type: 'button', className: 'how-link', textContent: 'How it works' });
  link.addEventListener('click', showGuide);
  const calendar = el('button', { type: 'button', className: 'how-link', id: 'open-calendar', textContent: 'Your calendar' });
  calendar.addEventListener('click', () => openCalendar({ getState: () => state }));
  return el('div', { className: 'screen-links' }, [link, calendar]);
}

// A note saved from Talk it through, shown under the thought.
function noteLine(thought, className) {
  return thought.note ? [el('span', { className, textContent: thought.note })] : [];
}

function talkButton(label) {
  const button = el('button', { type: 'button', className: 'talk-button' }, [
    el('span', { className: 'talk-icon', textContent: '✦' }),
    label,
  ]);
  return button;
}

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
  const mic = micButton(input);
  const form = el('form', { className: 'compose' }, [
    el('label', { htmlFor: 'thought', className: 'sr-only', textContent: "What's on your mind?" }),
    input,
    ...(mic ? [mic] : []),
    add,
  ]);
  const hint = el('p', {
    className: 'hint',
    id: 'hint',
    textContent: 'Type each thought, then park it. They’ll be waiting in the morning.',
    hidden: state.seenHint,
  });
  const prompt = el('p', { className: 'prompt', id: 'prompt', hidden: true });
  const voiceStatus = el('p', { className: 'voice-status', id: 'voice-status', hidden: true });
  voiceStatus.setAttribute('role', 'status');
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
    howItWorks(),
    form,
    hint,
    voiceStatus,
    prompt,
    list,
    counter,
  );
  updateCounter(false);
  input.focus();
  schedulePrompt(input, prompt);
}

// ---- Speak instead of type -------------------------------------------------

function micButton(input) {
  if (!SpeechRecognition) return null;
  const button = el('button', { type: 'button', className: 'mic-button', id: 'mic' });
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';
  button.setAttribute('aria-label', 'Speak your thoughts');
  button.title = 'Speak your thoughts';
  button.addEventListener('click', () => {
    if (recognition) recognition.stop();
    else listen(button, input);
  });
  return button;
}

function listen(button, input) {
  const status = document.getElementById('voice-status');
  let transcript = '';
  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = true;

  stopPrompts();
  button.classList.add('is-listening');
  button.setAttribute('aria-label', 'Stop listening');
  showVoiceStatus('Listening… say everything on your mind, then tap the microphone again.');

  recognition.onresult = (event) => {
    let interim = '';
    transcript = '';
    for (const result of event.results) {
      if (result.isFinal) transcript += `${result[0].transcript} `;
      else interim += result[0].transcript;
    }
    input.placeholder = (transcript + interim).trim() || "What's on your mind?";
  };
  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showVoiceStatus('Microphone access is blocked. Allow it in your browser to speak your thoughts.');
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showVoiceStatus('Couldn’t hear that. Try again, or type instead.');
    }
  };
  recognition.onend = () => {
    recognition = null;
    button.classList.remove('is-listening');
    button.setAttribute('aria-label', 'Speak your thoughts');
    input.placeholder = "What's on your mind?";
    const spoken = transcript.trim();
    if (spoken) addSpoken(spoken);
    else if (status && !status.dataset.sticky) hideVoiceStatus();
  };
  recognition.start();
}

function showVoiceStatus(text) {
  const status = document.getElementById('voice-status');
  if (!status) return;
  status.textContent = text;
  status.hidden = false;
}

function hideVoiceStatus() {
  const status = document.getElementById('voice-status');
  if (status) status.hidden = true;
}

// Turn what was said into separate thought cards: Claude splits it when a key
// is set; otherwise (or if that fails) a simple local split is used.
async function addSpoken(spoken) {
  if (crisisCheck(spoken)) {
    hideVoiceStatus();
    showCrisis();
    return;
  }
  showVoiceStatus('Sorting what you said into separate thoughts…');
  let thoughts = null;
  let note = '';
  try {
    thoughts = await splitThoughts(spoken);
  } catch (error) {
    note = ` (${friendlyError(error)} Used a simple split instead.)`;
  }
  if (!thoughts || thoughts.length === 0) thoughts = splitLocally(spoken);

  const list = document.getElementById('cards');
  if (mode !== 'night' || !list) return;
  // Add in reverse so the first thing said ends up on top.
  for (const text of [...thoughts].reverse()) {
    const result = addThought(state, text);
    if (!result.thought) continue;
    commit({ ...result.state, seenHint: true });
    list.prepend(cardFor(result.thought));
  }
  document.getElementById('hint')?.setAttribute('hidden', '');
  showVoiceStatus(`Added ${plural(thoughts.length, 'thought')} from what you said.${note}`);
  setTimeout(hideVoiceStatus, 6000);
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
  const talk = talkButton('Talk it through');
  const card = el('li', { className: 'card' }, [
    el('p', { className: 'card-text', textContent: thought.text }),
    ...noteLine(thought, 'card-note'),
    talk,
    el('div', { className: 'card-actions' }, [release, park]),
  ]);
  card.dataset.id = thought.id;

  talk.addEventListener('click', () => {
    openTalk({
      thought: state.pending.find((t) => t.id === thought.id) ?? thought,
      mode: 'night',
      onSave: (note) => {
        commit(setNote(state, thought.id, note));
        park.click();
      },
    });
  });

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

  const tool = (id, name, detail, start) => {
    const button = el('button', { type: 'button', className: `sleep-option sleep-option-${id}` }, [
      el('span', { className: 'sleep-option-name', textContent: name }),
      el('span', { className: 'sleep-option-detail', textContent: detail }),
    ]);
    button.addEventListener('click', () => { clearUndo(); start(); });
    return button;
  };
  const ends = {
    onStop: () => { endAid(false); renderGoodnight(); },
    onDone: () => { endAid(true); renderSleep(); },
    track: aidTracker,
  };
  const tools = el('section', { className: 'sleep-tools' }, [
    el('h2', { className: 'sleep-tools-title', textContent: 'Help me fall asleep' }),
    el('div', { className: 'sleep-grid' }, [
      tool('breathe', 'Breathe', 'One slow minute', renderBreathing),
      tool('shuffle', 'Mind shuffle', 'Picture random calm things', () => startShuffle(screen, ends)),
      tool('sounds', 'Sleep sounds', 'Rain, ocean, brown noise', () => startSounds(screen, ends)),
      tool('story', 'Sleep story ✦', 'A slow story, read aloud', () => startStory(screen, ends)),
    ]),
  ]);
  const more = el('button', { type: 'button', className: 'link-button', textContent: 'Add another thought' });
  more.addEventListener('click', () => renderNight({ keepSession: true }));

  screen.replaceChildren(el('section', { className: 'goodnight' }, [
    el('h1', { className: 'goodnight-title', textContent: 'All parked. Goodnight.' }),
    el('p', { className: 'goodnight-summary', textContent: summary }),
    el('p', { className: 'goodnight-note', textContent: 'Nothing left to hold onto tonight.' }),
    goodThingsCard(),
    tools,
    more,
  ]));
}

// ---- Three good things ------------------------------------------------------

function goodThingsCard() {
  const card = el('section', { className: 'good-card', id: 'good-card' });
  const render = () => {
    const things = goodThingsTonight(state);
    const list = el('ul', { className: 'good-list' }, things.map((g) => el('li', { textContent: g })));
    const parts = [el('h2', { className: 'good-title', textContent: 'One good thing about today' })];
    if (things.length) parts.push(list);
    if (things.length < MAX_GOOD_THINGS) {
      const input = el('input', {
        id: 'good-input',
        type: 'text',
        maxLength: MAX_LENGTH,
        placeholder: things.length ? 'Another one?' : 'Something small counts: a warm drink, a kind word…',
        autocomplete: 'off',
      });
      const add = el('button', { type: 'submit', className: 'btn btn-quiet', textContent: 'Add' });
      const form = el('form', { className: 'good-form' }, [
        el('label', { htmlFor: 'good-input', className: 'sr-only', textContent: 'One good thing about today' }),
        input,
        add,
      ]);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const next = addGoodThing(state, input.value);
        if (next === state) return;
        commit(next);
        render();
        document.getElementById('good-input')?.focus();
      });
      parts.push(form);
    }
    card.replaceChildren(...parts);
  };
  render();
  return card;
}

// ---- Breathing moment -----------------------------------------------------

const ease = (t) => 0.5 - Math.cos(Math.PI * t) / 2;

function renderBreathing() {
  clearUndo();
  aidTracker.start('breathe');
  const circle = el('div', { className: 'breath-circle' });
  const label = el('p', { className: 'breath-label', textContent: 'Breathe in' });
  const remaining = el('p', { className: 'breath-remaining' });
  const stop = el('button', { type: 'button', className: 'link-button', textContent: 'Stop' });
  stop.addEventListener('click', () => { endAid(false); renderGoodnight(); });

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
      endAid(true);
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
  stopSleepTools();
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

  const header = [el('h1', { className: 'screen-title', textContent: 'Good morning' }), howItWorks()];
  if (summaryText) {
    header.push(el('p', { className: 'morning-summary', id: 'morning-summary', textContent: summaryText }));
  }
  header.push(ratingCard());
  header.push(dreamSection({
    getState: () => state,
    commit,
    openThoughts: () => morningList(state).filter((t) => !t.done),
    onCrisis: showCrisis,
  }));

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

  const planButton = el('button', { type: 'button', className: 'talk-button plan-button', id: 'plan-button' }, [
    el('span', { className: 'talk-icon', textContent: '✦' }),
    'Make my morning plan',
  ]);
  const planCard = el('section', { className: 'plan-card', id: 'plan-card', hidden: true });
  planCard.setAttribute('aria-live', 'polite');
  planButton.addEventListener('click', () => makePlan(planButton, planCard));
  planButton.hidden = !items.some((t) => !t.done);

  screen.replaceChildren(
    ...header,
    el('p', {
      className: 'screen-sub',
      textContent: 'Here’s what you parked last night. Done with one, or it doesn’t matter anymore? Check it off or let it go.',
    }),
    planButton,
    planCard,
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
    el('span', { className: 'check-body' }, [
      el('span', { className: 'check-text', textContent: thought.text }),
      ...noteLine(thought, 'check-note'),
    ]),
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
    const talk = el('button', { type: 'button', className: 'morning-side morning-talk', textContent: '✦ Talk' });
    talk.setAttribute('aria-label', `Talk it through: “${thought.text}”`);
    talk.addEventListener('click', () => {
      openTalk({
        thought,
        mode: 'morning',
        onSave: (note) => {
          commit(setNote(state, thought.id, note));
          renderMorningList();
        },
      });
    });
    const letGo = el('button', { type: 'button', className: 'morning-side morning-letgo', textContent: 'Let go' });
    letGo.title = 'Doesn’t matter anymore';
    letGo.setAttribute('aria-label', `Doesn’t matter anymore: let go of “${thought.text}”`);
    letGo.addEventListener('click', () => {
      const before = state;
      commit(letGoParked(state, thought.id));
      offerUndo('Let go', before, 'dismissed');
      item.classList.add('is-releasing');
      sparkle(item);
      setTimeout(() => {
        if (mode !== 'morning' || !item.isConnected) return;
        if (morningList(state).length === 0) renderMorning({ animate: false });
        else { renderMorningList(); updateAllClear(true); }
      }, motionMs('--morning-release-ms'));
    });
    item.append(el('div', { className: 'morning-sides' }, [talk, letGo]));
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

// ---- Sleep rating -------------------------------------------------------------

const RATING_WORDS = ['', 'Rough', 'Restless', 'Okay', 'Good', 'Great'];

function ratingCard() {
  const card = el('section', { className: 'rating-card', id: 'rating-card' });
  const render = () => {
    const key = lastNightKey();
    const rating = nightDetails(state, key).rating;
    const moons = [1, 2, 3, 4, 5].map((n) => {
      const button = el('button', { type: 'button', className: 'rating-moon', textContent: '☾' });
      button.dataset.rating = String(n);
      button.setAttribute('aria-label', `${n} of 5: ${RATING_WORDS[n]}`);
      button.setAttribute('aria-pressed', String(rating === n));
      if (rating && n <= rating) button.classList.add('is-lit');
      button.addEventListener('click', () => { commit(rateNight(state, key, n)); render(); });
      return button;
    });
    card.replaceChildren(
      el('h2', { className: 'rating-title', textContent: 'How did you sleep?' }),
      el('div', { className: 'rating-moons', role: 'group' }, moons),
      el('p', { className: 'rating-note', textContent: rating ? `${RATING_WORDS[rating]} (${rating} of 5). Saved to last night.` : 'Tap a moon. It goes in your calendar.' }),
    );
    card.querySelector('.rating-moons').setAttribute('aria-label', 'Rate last night’s sleep');
  };
  render();
  return card;
}

// ---- Morning plan -----------------------------------------------------------

async function makePlan(button, card) {
  const open = morningList(state).filter((t) => !t.done);
  if (open.length === 0) return;
  if (open.some((t) => crisisCheck(`${t.text} ${t.note ?? ''}`))) {
    showCrisis();
    return;
  }
  button.disabled = true;
  card.hidden = false;
  card.replaceChildren(el('p', { className: 'plan-loading', textContent: 'Making your plan…' }));
  try {
    const plan = await morningPlan(open);
    if (!card.isConnected) return;
    const byId = new Map(open.map((t) => [t.id, t]));
    card.replaceChildren(
      el('h2', { className: 'plan-title', textContent: 'Your morning plan' }),
      el('p', { className: 'plan-opener', textContent: plan.opener }),
      el('ol', { className: 'plan-steps' }, plan.steps.map((step) => el('li', {}, [
        el('span', { className: 'plan-action', textContent: step.action }),
        el('span', { className: 'plan-thought', textContent: byId.get(step.id)?.text ?? '' }),
      ]))),
      ...(isDemo() ? [el('p', { className: 'plan-demo', textContent: 'Demo plan. Add your API key in Settings for a plan from Claude.' })] : []),
    );
    button.lastChild.textContent = 'Make a new plan';
  } catch (error) {
    card.replaceChildren(el('p', { className: 'plan-error', textContent: friendlyError(error) }));
  } finally {
    button.disabled = false;
  }
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
  const planButton = document.getElementById('plan-button');
  if (planButton) planButton.hidden = !items.some((t) => !t.done);
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

// Morning Let go: the item bursts into rainbow sparkles as it fades into light.
function sparkle(item) {
  if (reduceMotion.matches || typeof Element.prototype.animate !== 'function') return;
  const r = item.getBoundingClientRect();
  const count = 22;
  for (let i = 0; i < count; i += 1) {
    const spark = el('span', { className: 'sparkle' });
    const x = r.left + r.width * (0.1 + Math.random() * 0.8);
    const y = r.top + r.height * (0.2 + Math.random() * 0.6);
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 80;
    const size = 7 + Math.random() * 8;
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.width = `${size}px`;
    spark.style.height = `${size}px`;
    spark.style.setProperty('--hue', String(Math.round((i / count) * 360)));
    document.body.append(spark);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 30; // drift slightly upward, toward the sun
    const burst = spark.animate([
      { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${dy * 0.4}px)) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0) rotate(200deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, delay: Math.random() * 250, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'both' });
    burst.onfinish = () => spark.remove();
    burst.oncancel = () => spark.remove();
  }
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
    ], { duration: 1400, delay: 500 + i * 250, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'both' });

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
requestAnimationFrame(() => requestAnimationFrame(() => {
  setMode(mode);
  // First visit: explain what ThoughtPark is before anything else.
  if (!state.seenGuide) showGuide();
}));
