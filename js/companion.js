// The AI companion's panels: Talk it through, Settings, and the 988 crisis card.
import { crisisCheck } from './store.js';
import {
  talkStream, noteFor, friendlyError, isDemo, getKey, setKey, removeKey,
} from './ai.js';

const talkDialog = document.getElementById('talk');
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

function showCrisis() {
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
    textContent: mode === 'morning' ? 'Save this note' : 'Park with this note',
  });
  const close = el('button', { type: 'button', className: 'btn btn-quiet', textContent: 'Close' });
  close.addEventListener('click', () => talkDialog.close());

  talkDialog.replaceChildren(
    el('header', { className: 'sheet-header' }, [
      el('h2', { id: 'talk-title', className: 'sheet-title', textContent: 'Talk it through' }),
      closeButton(talkDialog),
    ]),
    el('blockquote', { className: 'talk-thought', textContent: thought.text }),
    ...(isDemo() ? [demoBanner()] : []),
    messages,
    form,
    el('div', { className: 'talk-actions' }, [close, save]),
  );
  talkDialog.addEventListener('close', () => { closed = true; }, { once: true });
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
    } catch (error) {
      item.remove();
      bubble('error', friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    if (crisisCheck(text)) {
      showCrisis();
      return;
    }
    input.value = '';
    bubble('user', text);
    history.push({ role: 'user', content: text });
    reply();
  });
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

export function openSettings({ onChange } = {}) {
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
        el('h2', { id: 'settings-title', className: 'sheet-title', textContent: 'AI companion' }),
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
      el('ul', { className: 'settings-notes' }, [
        el('li', { textContent: 'Your key is stored only in this browser and sent only to Anthropic.' }),
        el('li', { textContent: 'Only thoughts you choose to talk through, speak, or plan are sent to Claude. Everything else stays on this device.' }),
        el('li', { textContent: 'Talk it through is a reflective aid, not therapy or medical advice. In a crisis, call or text 988.' }),
      ]),
    );
  };

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
