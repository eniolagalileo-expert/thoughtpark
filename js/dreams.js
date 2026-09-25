// The Morning screen's dream card: note last night's dream (typed or spoken),
// reflect on it with Claude, and look back through the dream journal.
import {
  addDream, updateDream, deleteDream, setDreamReflection, dreamForDay, crisisCheck, MAX_DREAM_LENGTH,
} from './store.js';
import { analyzeDream, friendlyError, isDemo } from './ai.js';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function formatDay(time) {
  return new Date(time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// getState(): current app state; commit(next): save it; openThoughts(): last
// night's open parked thoughts; onCrisis(): show the 988 card.
export function dreamSection({ getState, commit, openThoughts, onCrisis }) {
  const section = el('section', { className: 'dream-card', id: 'dream-card' });
  let editing = false;
  let recognition = null;

  function render() {
    recognition?.abort();
    const dream = dreamForDay(getState());
    const past = (getState().dreams ?? []).filter((d) => d !== dream);
    const body = dream && !editing ? savedView(dream) : (editing || section.dataset.open ? editor(dream) : collapsed());
    section.replaceChildren(...body, ...(past.length ? [journal(past)] : []));
  }

  function collapsed() {
    const open = el('button', { type: 'button', className: 'dream-open', textContent: '☾ Note last night’s dream' });
    open.addEventListener('click', () => {
      section.dataset.open = 'true';
      render();
      section.querySelector('textarea')?.focus();
    });
    return [open];
  }

  function editor(dream) {
    const input = el('textarea', {
      id: 'dream-input',
      className: 'dream-input',
      rows: 4,
      maxLength: MAX_DREAM_LENGTH,
      placeholder: 'Write it down before it fades… where were you, who was there, how did it feel?',
      value: dream?.text ?? '',
    });
    const save = el('button', { type: 'button', className: 'btn btn-primary', textContent: 'Save' });
    const cancel = el('button', { type: 'button', className: 'btn btn-quiet', textContent: 'Cancel' });
    save.addEventListener('click', () => {
      const text = input.value;
      if (!text.trim()) return;
      commit(dream ? updateDream(getState(), dream.id, text) : addDream(getState(), text).state);
      editing = false;
      delete section.dataset.open;
      render();
    });
    cancel.addEventListener('click', () => {
      editing = false;
      delete section.dataset.open;
      render();
    });
    const actions = [cancel, save];
    if (SpeechRecognition) actions.unshift(dictateButton(input));
    return [
      el('h2', { className: 'dream-heading', textContent: 'Last night’s dream' }),
      el('label', { htmlFor: 'dream-input', className: 'sr-only', textContent: 'Your dream' }),
      input,
      el('div', { className: 'dream-actions' }, actions),
    ];
  }

  function dictateButton(input) {
    const button = el('button', { type: 'button', className: 'mic-button dream-mic' });
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';
    button.setAttribute('aria-label', 'Speak your dream');
    button.addEventListener('click', () => {
      if (recognition) { recognition.stop(); return; }
      const start = input.value.trim();
      recognition = new SpeechRecognition();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.onresult = (event) => {
        const said = [...event.results].map((r) => r[0].transcript).join(' ').trim();
        input.value = [start, said].filter(Boolean).join(' ');
      };
      recognition.onend = () => {
        recognition = null;
        button.classList.remove('is-listening');
      };
      button.classList.add('is-listening');
      recognition.start();
    });
    return button;
  }

  function savedView(dream) {
    const reflect = el('button', {
      type: 'button',
      className: 'talk-button dream-reflect',
      textContent: dream.reflection ? '✦ Reflect again' : '✦ Reflect with Claude',
    });
    const edit = el('button', { type: 'button', className: 'inline-link', textContent: 'Edit' });
    const remove = el('button', { type: 'button', className: 'inline-link', textContent: 'Delete' });
    const status = el('p', { className: 'dream-status', hidden: true });
    status.setAttribute('role', 'status');

    edit.addEventListener('click', () => { editing = true; render(); });
    remove.addEventListener('click', () => {
      commit(deleteDream(getState(), dream.id));
      render();
    });
    reflect.addEventListener('click', async () => {
      if (crisisCheck(dream.text)) {
        onCrisis();
        return;
      }
      reflect.disabled = true;
      status.hidden = false;
      status.textContent = 'Reflecting on your dream…';
      try {
        const reflection = await analyzeDream({ dream: dream.text, thoughts: openThoughts() });
        commit(setDreamReflection(getState(), dream.id, reflection));
        render();
      } catch (error) {
        status.textContent = friendlyError(error);
        reflect.disabled = false;
      }
    });

    return [
      el('h2', { className: 'dream-heading', textContent: 'Last night’s dream' }),
      el('blockquote', { className: 'dream-text', textContent: dream.text }),
      el('div', { className: 'dream-actions dream-actions-saved' }, [reflect, edit, remove]),
      status,
      ...(dream.reflection ? [reflectionCard(dream.reflection)] : []),
      el('p', { className: 'dream-privacy', textContent: 'Reflecting sends this dream and last night’s parked thoughts to Claude.' }),
    ];
  }

  function reflectionCard(r) {
    const chips = [...r.feelings, ...r.themes].map((t) => el('span', { className: 'dream-chip', textContent: t }));
    return el('div', { className: 'dream-reflection', id: 'dream-reflection' }, [
      el('h3', { className: 'dream-title', textContent: r.title }),
      el('div', { className: 'dream-chips' }, chips),
      el('p', { className: 'dream-body', textContent: r.reflection }),
      ...(r.connection ? [el('p', { className: 'dream-connection', textContent: r.connection })] : []),
      ...(r.question ? [el('p', { className: 'dream-question', textContent: r.question })] : []),
      ...(isDemo() ? [el('p', { className: 'plan-demo', textContent: 'Demo reflection. Add your API key in Settings for one from Claude.' })] : []),
    ]);
  }

  function journal(past) {
    return el('details', { className: 'dream-journal' }, [
      el('summary', { textContent: `Dream journal (${past.length})` }),
      el('ul', {}, past.map((d) => el('li', {}, [
        el('span', { className: 'dream-journal-date', textContent: formatDay(d.createdAt) }),
        el('span', { className: 'dream-journal-title', textContent: d.reflection?.title ?? '' }),
        el('span', { className: 'dream-journal-text', textContent: d.text }),
      ]))),
    ]);
  }

  render();
  return section;
}
