// The AI companion's panels: Talk it through, Settings, and the 988 crisis card.
import { crisisCheck, bedtimeIcs } from './store.js';
import {
  talkStream, noteFor, friendlyError, isDemo, getKey, setKey, removeKey,
} from './ai.js';

const talkDialog = document.getElementById('talk');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const canUseVoice = () => Boolean(SpeechRecognition && window.speechSynthesis);
const settingsDialog = document.getElementById('settings');

// After this many replies, the "park it" button is highlighted.
const WRAP_UP_AFTER = 3;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function closeButton(dialog) {
  const button = el('button', { type: 'button', className: 'icon-button sheet-close', textContent: '×' });
  button.setAttribute('aria-label', 'Close');
  button.addEventListener('click', () => dialog.close());
  return button;
}

// Clicking the dim backdrop closes a panel.
for (const dialog of [talkDialog, settingsDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function demoBanner() {
  const open = el('button', { type: 'button', className: 'inline-link', textContent: 'add your API key' });
  open.addEventListener('click', () => { talkDialog.close(); openSettings(); });
  return el('p', { className: 'demo-banner' }, ['Demo mode: these are sample replies. For real answers from Claude, ', open, '.']);
}

// ---- Crisis card ------------------------------------------------------------

function crisisCard() {
  return el('section', { className: 'crisis' }, [
    el('h2', { className: 'crisis-title', textContent: 'You don’t have to carry this alone.' }),
    el('p', { textContent: 'It sounds like you might be going through something really hard. Please reach out to someone right now.' }),
    el('div', { className: 'crisis-actions' }, [
      el('a', { className: 'btn btn-primary', href: 'tel:988', textContent: 'Call 988' }),
      el('a', { className: 'btn btn-quiet', href: 'sms:988', textContent: 'Text 988' }),
    ]),
    el('p', { className: 'crisis-small' }, [
      '988 Suicide & Crisis Lifeline (US), free and available 24/7. ',
      el('a', { href: 'https://988lifeline.org', target: '_blank', rel: 'noopener', textContent: '988lifeline.org' }),
      '. If you’re in immediate danger, call 911.',
    ]),
  ]);
}

export function showCrisis() {
  talkDialog.replaceChildren(
    el('header', { className: 'sheet-header' }, [
      el('h2', { id: 'talk-title', className: 'sheet-title', textContent: 'Support' }),
      closeButton(talkDialog),
    ]),
    crisisCard(),
  );
  if (!talkDialog.open) talkDialog.showModal();
}

// ---- Talk it through --------------------------------------------------------

// Opens a short chat about one thought. `onSave(note)` receives the note when
// the person parks (night) or saves (morning) it.
export function openTalk({ thought, mode, onSave }) {
  if (crisisCheck(thought.text)) {
    showCrisis();
    return;
  }

  const history = [];
  let busy = false;
  let closed = false;

  const messages = el('ol', { className: 'chat', id: 'chat' });
  messages.setAttribute('aria-live', 'polite');
  const input = el('textarea', { id: 'talk-input', rows: 1, placeholder: 'Write back…', maxLength: 600 });
  const send = el('button', { type: 'submit', className: 'btn btn-primary', textContent: 'Send' });
  const form = el('form', { className: 'compose chat-compose' }, [
    el('label', { htmlFor: 'talk-input', className: 'sr-only', textContent: 'Your reply' }),
    input,
    send,
  ]);
  const save = el('button', {
    type: 'button',
    className: 'btn btn-primary talk-save',
    textContent: { morning: 'Save this note', daytime: 'Save this plan' }[mode] ?? 'Park with this note',
  });
  const close = el('button', { type: 'button', className: 'btn btn-quiet', textContent: 'Close' });
  close.addEventListener('click', () => talkDialog.close());

  // Eyes-closed voice mode: replies are read aloud, then the app listens.
  let voiceOn = false;
  let recognition = null;
  let quietTries = 0;
  const voiceStatus = el('p', { className: 'voice-mode-status', hidden: true });
  voiceStatus.setAttribute('role', 'status');
  const voiceToggle = el('button', { type: 'button', className: 'chip voice-toggle', textContent: '🎧 Voice mode' });
  voiceToggle.setAttribute('aria-pressed', 'false');
  voiceToggle.hidden = !canUseVoice();
  voiceToggle.addEventListener('click', () => setVoice(!voiceOn));

  talkDialog.replaceChildren(
    el('header', { className: 'sheet-header' }, [
      el('h2', { id: 'talk-title', className: 'sheet-title', textContent: mode === 'daytime' ? 'Make a daytime plan' : 'Talk it through' }),
      closeButton(talkDialog),
    ]),
    el('blockquote', { className: 'talk-thought', textContent: thought.label ?? thought.text }),
    ...(isDemo() ? [demoBanner()] : []),
    voiceToggle,
    messages,
    voiceStatus,
    form,
    el('div', { className: 'talk-actions' }, [close, save]),
  );
  talkDialog.addEventListener('close', () => { closed = true; stopVoice(); }, { once: true });
  talkDialog.showModal();

  function bubble(role, text = '') {
    const item = el('li', { className: `bubble bubble-${role}`, textContent: text });
    messages.append(item);
    item.scrollIntoView({ block: 'end' });
    return item;
  }

  function setBusy(value) {
    busy = value;
    send.disabled = value;
    save.disabled = value;
    input.disabled = value;
    if (!value && !closed) input.focus();
  }

  async function reply() {
    setBusy(true);
    const item = bubble('assistant');
    item.classList.add('is-typing');
    try {
      const text = await talkStream({
        thought: thought.text,
        mode,
        history,
        onText: (delta) => {
          if (closed) return;
          item.classList.remove('is-typing');
          item.textContent += delta;
          item.scrollIntoView({ block: 'end' });
        },
      });
      item.classList.remove('is-typing');
      item.textContent = text;
      history.push({ role: 'assistant', content: text });
      if (history.filter((m) => m.role === 'assistant').length >= WRAP_UP_AFTER) save.classList.add('is-ready');
      if (voiceOn && !closed) speakThenListen(text);
    } catch (error) {
      item.remove();
      bubble('error', friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  function sendReply(text) {
    if (!text || busy) return;
    if (crisisCheck(text)) {
      stopVoice();
      showCrisis();
      return;
    }
    input.value = '';
    bubble('user', text);
    history.push({ role: 'user', content: text });
    reply();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendReply(input.value.trim());
  });

  function setVoice(on) {
    voiceOn = on && canUseVoice();
    voiceToggle.setAttribute('aria-pressed', String(voiceOn));
    voiceToggle.textContent = voiceOn ? '🎧 Voice mode on' : '🎧 Voice mode';
    talkDialog.classList.toggle('is-voice', voiceOn);
    voiceStatus.hidden = !voiceOn;
    if (!voiceOn) { stopVoice(); return; }
    quietTries = 0;
    const last = [...history].reverse().find((m) => m.role === 'assistant');
    if (!busy) (last ? speakThenListen(last.content) : listen());
  }

  function stopVoice() {
    window.speechSynthesis?.cancel();
    recognition?.abort();
    recognition = null;
  }

  function speakThenListen(text) {
    voiceStatus.textContent = 'Speaking…';
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    utterance.onend = () => { if (voiceOn && !closed) listen(); };
    window.speechSynthesis.speak(utterance);
  }

  function listen() {
    if (!voiceOn || closed || busy) return;
    voiceStatus.textContent = 'Listening… say your reply.';
    let heard = '';
    recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      heard = [...event.results].map((r) => r[0].transcript).join(' ').trim();
    };
    recognition.onend = () => {
      recognition = null;
      if (!voiceOn || closed) return;
      if (heard) { quietTries = 0; voiceStatus.textContent = 'Thinking…'; sendReply(heard); return; }
      quietTries += 1;
      if (quietTries < 3) listen();
      else { setVoice(false); voiceToggle.textContent = '🎧 Voice mode (paused: didn’t hear anything)'; }
    };
    recognition.start();
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  save.addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    const item = bubble('assistant', 'Writing your note…');
    item.classList.add('is-typing');
    try {
      const note = await noteFor({ thought: thought.text, mode, history });
      if (closed) return;
      talkDialog.close();
      onSave(note);
    } catch (error) {
      item.remove();
      bubble('error', friendlyError(error));
      setBusy(false);
    }
  });

  reply();
}

// ---- Settings ---------------------------------------------------------------

// getSettings()/setSettings(patch) read and save the app's settings.
export function openSettings({ onChange, getSettings, setSettings, installPrompt } = {}) {
  const render = () => {
    const key = getKey();
    const input = el('input', {
      id: 'api-key',
      type: 'password',
      placeholder: 'sk-ant-…',
      autocomplete: 'off',
      spellcheck: false,
    });
    const save = el('button', { type: 'submit', className: 'btn btn-primary', textContent: 'Save key' });
    const form = el('form', { className: 'settings-form' }, [
      el('label', { htmlFor: 'api-key', className: 'settings-label', textContent: 'Your Anthropic API key' }),
      el('div', { className: 'settings-row' }, [input, save]),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      setKey(input.value);
      onChange?.();
      render();
    });

    const status = key
      ? el('p', { className: 'settings-status is-on' }, [`Connected: key ending in ${key.slice(-4)}. `, removeButton()])
      : el('p', { className: 'settings-status', textContent: 'Demo mode: AI answers are samples until you add a key.' });

    settingsDialog.replaceChildren(
      el('header', { className: 'sheet-header' }, [
        el('h2', { id: 'settings-title', className: 'sheet-title', textContent: 'Settings' }),
        closeButton(settingsDialog),
      ]),
      el('p', { textContent: 'Talk it through, voice input, and the morning plan use Claude, Anthropic’s AI, with your own API key.' }),
      status,
      form,
      el('p', { className: 'settings-small' }, [
        'Get a key at ',
        el('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener', textContent: 'console.anthropic.com' }),
        '. Usage costs a few cents per night.',
      ]),
      ...(getSettings ? [worryHourField(), bedtimeField(), installField()] : []),
      el('ul', { className: 'settings-notes' }, [
        el('li', { textContent: 'Your key is stored only in this browser and sent only to Anthropic.' }),
        el('li', { textContent: 'Only thoughts you choose to talk through, speak, or plan are sent to Claude. Everything else stays on this device.' }),
        el('li', { textContent: 'Talk it through is a reflective aid, not therapy or medical advice. In a crisis, call or text 988.' }),
      ]),
    );
  };

  function worryHourField() {
    const select = el('select', { id: 'worry-hour', className: 'settings-select' });
    for (let h = 12; h <= 16; h += 1) {
      const label = new Date(2026, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
      select.append(el('option', { value: String(h), textContent: label, selected: getSettings().worryHour === h }));
    }
    select.addEventListener('change', () => setSettings({ worryHour: Number(select.value) }));
    return el('div', { className: 'settings-field' }, [
      el('label', { htmlFor: 'worry-hour', className: 'settings-label', textContent: 'Worry time each day' }),
      select,
      el('p', { className: 'settings-small', textContent: 'At this hour the Morning screen suggests a 15-minute worry time.' }),
    ]);
  }

  function bedtimeField() {
    const settings = getSettings();
    const time = el('input', { id: 'bedtime', type: 'time', className: 'settings-time', value: settings.bedtime });
    time.addEventListener('change', () => { if (time.value) setSettings({ bedtime: time.value }); });
    const remind = el('input', { id: 'bedtime-remind', type: 'checkbox', checked: settings.remind });
    const note = el('p', { className: 'settings-small', id: 'remind-note' });
    remind.addEventListener('change', async () => {
      setSettings({ remind: remind.checked });
      note.textContent = '';
      if (remind.checked && 'Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') note.textContent = 'Notifications are off, so you’ll see a banner in ThoughtPark instead.';
      }
    });
    const ics = el('button', { type: 'button', className: 'btn btn-quiet', id: 'bedtime-ics', textContent: 'Add to my calendar' });
    ics.addEventListener('click', () => {
      const url = location.href.split('#')[0];
      const blob = new Blob([bedtimeIcs(getSettings().bedtime, Date.now(), url)], { type: 'text/calendar' });
      const link = el('a', { href: URL.createObjectURL(blob), download: 'thoughtpark-bedtime.ics' });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      note.textContent = 'Open the downloaded file to add it to your calendar. It repeats every day and alerts you at bedtime, even when ThoughtPark is closed.';
    });
    return el('div', { className: 'settings-field' }, [
      el('label', { htmlFor: 'bedtime', className: 'settings-label', textContent: 'Bedtime' }),
      time,
      el('label', { className: 'settings-check' }, [remind, ' Remind me while ThoughtPark is open']),
      el('p', { className: 'settings-small', textContent: 'For a reminder even when ThoughtPark is closed, add a daily bedtime event to your phone’s calendar:' }),
      ics,
      note,
    ]);
  }

  function installField() {
    const prompt = installPrompt?.();
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return el('p', { className: 'settings-small', textContent: 'ThoughtPark is installed as an app on this device.' });
    }
    if (prompt) {
      const install = el('button', { type: 'button', className: 'btn btn-primary', id: 'install-app', textContent: 'Install ThoughtPark as an app' });
      install.addEventListener('click', async () => { await prompt.prompt(); });
      return el('div', { className: 'settings-field' }, [install, el('p', { className: 'settings-small', textContent: 'It opens from your home screen and works offline (the AI needs a connection).' })]);
    }
    return el('p', { className: 'settings-small', textContent: 'To install: in Chrome, use the install icon in the address bar; on iPhone, tap Share → Add to Home Screen. It works offline, except the AI.' });
  }

  function removeButton() {
    const button = el('button', { type: 'button', className: 'inline-link', textContent: 'Remove key' });
    button.addEventListener('click', () => {
      removeKey();
      onChange?.();
      render();
    });
    return button;
  }

  render();
  if (!settingsDialog.open) settingsDialog.showModal();
}
