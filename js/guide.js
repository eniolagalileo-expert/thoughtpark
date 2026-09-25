// The welcome guide: four short steps explaining ThoughtPark to a first-time
// visitor. Opens by itself once, and again from any "How it works" link.

const dialog = document.getElementById('guide');

const STEPS = [
  {
    art: 'moon',
    title: 'Empty your mind',
    body: 'Lying awake with thoughts on repeat? Type each one, or tap the microphone and say them all. One thought per card.',
  },
  {
    art: 'stars',
    title: 'Park it or let it go',
    body: 'Tap Tomorrow to park a thought for the morning. It becomes a star in your night sky. Tap Let it go and it’s gone for good, like a shooting star.',
  },
  {
    art: 'spark',
    title: 'Talk it through',
    body: 'Stuck on one? Talk it through with Claude, a calm AI companion, for a minute. It helps you settle the thought and parks it with a short note. Add your API key in Settings (✦), or try the demo.',
  },
  {
    art: 'sun',
    title: 'Wake up to your list',
    body: 'In the morning, your parked thoughts are waiting. Check them off, let go of the ones that don’t matter anymore, or get a short plan for the day.',
  },
];

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

// `onClose` runs however the guide is closed (Start, Skip, ×, Esc, backdrop).
export function openGuide({ onClose } = {}) {
  let index = 0;

  const art = el('div', { className: 'guide-art' });
  const count = el('p', { className: 'guide-count' });
  const title = el('h2', { className: 'guide-title', id: 'guide-title' });
  const body = el('p', { className: 'guide-body' });
  const fine = el('p', {
    className: 'guide-fine',
    textContent: 'Private by design: your thoughts stay on this device. ThoughtPark isn’t medical advice. In a crisis, call or text 988.',
  });
  const dots = el('div', { className: 'guide-dots' }, STEPS.map((_, i) => {
    const dot = el('button', { type: 'button', className: 'guide-dot' });
    dot.setAttribute('aria-label', `Step ${i + 1}`);
    dot.addEventListener('click', () => show(i));
    return dot;
  }));
  const skip = el('button', { type: 'button', className: 'btn btn-quiet guide-skip', textContent: 'Skip' });
  const back = el('button', { type: 'button', className: 'btn btn-quiet', textContent: 'Back' });
  const next = el('button', { type: 'button', className: 'btn btn-primary guide-next' });
  skip.addEventListener('click', () => dialog.close());
  back.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => (index === STEPS.length - 1 ? dialog.close() : show(index + 1)));

  const panel = el('div', { className: 'guide-panel' }, [art, count, title, body]);
  dialog.replaceChildren(
    el('p', { className: 'guide-welcome', textContent: 'Welcome to ThoughtPark' }),
    panel,
    fine,
    dots,
    el('div', { className: 'guide-actions' }, [skip, back, next]),
  );

  function show(i) {
    index = Math.max(0, Math.min(STEPS.length - 1, i));
    const step = STEPS[index];
    art.className = `guide-art guide-art-${step.art}`;
    count.textContent = `${index + 1} of ${STEPS.length}`;
    title.textContent = step.title;
    body.textContent = step.body;
    panel.classList.remove('is-fresh');
    void panel.offsetWidth; // restart the fade
    panel.classList.add('is-fresh');
    fine.hidden = index !== STEPS.length - 1;
    back.hidden = index === 0;
    skip.hidden = index === STEPS.length - 1;
    next.textContent = index === STEPS.length - 1 ? 'Start' : 'Next';
    [...dots.children].forEach((dot, n) => dot.setAttribute('aria-current', n === index ? 'step' : 'false'));
    next.focus();
  }

  const onKey = (event) => {
    if (event.key === 'ArrowRight') show(index + 1);
    if (event.key === 'ArrowLeft') show(index - 1);
  };
  dialog.addEventListener('keydown', onKey);
  dialog.addEventListener('close', () => {
    dialog.removeEventListener('keydown', onKey);
    onClose?.();
  }, { once: true });

  dialog.showModal();
  show(0);
}
