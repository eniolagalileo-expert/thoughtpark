// The night sky behind the screens: faint decorative stars, the moon, one
// bright star per parked thought, shooting stars for released thoughts, and
// the sun that rises in the morning.
import { starPosition } from './store.js';

const sky = document.getElementById('sky');
const decor = el('div', 'sky-decor');
const stars = el('div', 'sky-stars');
const sun = el('div', 'sky-sun');
const sunDisc = el('div', 'sky-sun-disc');
const moon = el('div', 'sky-moon');
sky.append(decor, sun, sunDisc, moon, stars);

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

// Seeded random numbers, so the decorative stars look the same every visit.
function seeded(seed) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(7);
for (let i = 0; i < 45; i += 1) {
  const dot = el('span', 'sky-dot');
  dot.style.left = `${random() * 100}%`;
  dot.style.top = `${random() * 75}%`;
  dot.style.animationDelay = `${(random() * 6).toFixed(2)}s`;
  dot.style.opacity = (0.25 + random() * 0.4).toFixed(2);
  decor.append(dot);
}

// ---- Star info tooltip ----------------------------------------------------

// Lives outside the sky so it can sit above the page content.
const tooltip = el('div', 'star-tip');
tooltip.id = 'star-tip';
tooltip.setAttribute('role', 'tooltip');
tooltip.hidden = true;
const tipText = el('p', 'star-tip-text');
const tipNote = el('p', 'star-tip-note');
const tipMeta = el('p', 'star-tip-meta');
tooltip.append(tipText, tipNote, tipMeta);
document.body.append(tooltip);

const thoughtsById = new Map();
let tipFor = null;

function formatParkedAt(time) {
  if (!time) return 'Parked for tomorrow';
  const when = new Date(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Parked at ${when} · waiting for tomorrow`;
}

function showTip(star) {
  const thought = thoughtsById.get(star.dataset.id);
  if (!thought) return;
  tipFor = star.dataset.id;
  tipText.textContent = thought.text;
  tipNote.textContent = thought.note ? `✦ ${thought.note}` : '';
  tipNote.hidden = !thought.note;
  tipMeta.textContent = formatParkedAt(thought.parkedAt);
  tooltip.hidden = false;
  star.classList.add('is-active');

  // Place it above the star, or below when the star is near the top; keep it on screen.
  const s = star.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(Math.max(s.left + s.width / 2 - t.width / 2, margin), window.innerWidth - t.width - margin);
  const above = s.top - t.height - 14;
  const top = above > margin ? above : s.bottom + 14;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function hideStarInfo() {
  tooltip.hidden = true;
  tipFor = null;
  for (const star of stars.querySelectorAll('.is-active')) star.classList.remove('is-active');
}

// Mouse: hover shows the info. Touch: tap toggles it; tapping anywhere else hides it.
stars.addEventListener('pointerover', (event) => {
  const star = event.target.closest('.sky-star');
  if (star && event.pointerType === 'mouse') showTip(star);
});
stars.addEventListener('pointerout', (event) => {
  const star = event.target.closest('.sky-star');
  if (star && event.pointerType === 'mouse' && !star.contains(event.relatedTarget)) hideStarInfo();
});
stars.addEventListener('click', (event) => {
  const star = event.target.closest('.sky-star');
  if (!star) return;
  event.stopPropagation();
  if (event.pointerType === 'mouse') return; // hover already handles the mouse
  if (tipFor === star.dataset.id) hideStarInfo();
  else { hideStarInfo(); showTip(star); }
});
document.addEventListener('click', hideStarInfo);
window.addEventListener('resize', hideStarInfo);

// ---- Stars for parked thoughts --------------------------------------------

// Draw one bright star per open parked thought. New stars twinkle in;
// stars whose thought was un-parked or checked off disappear.
export function renderSky(parkedThoughts) {
  thoughtsById.clear();
  for (const thought of parkedThoughts) thoughtsById.set(thought.id, thought);
  if (tipFor && !thoughtsById.has(tipFor)) hideStarInfo();

  for (const star of [...stars.children]) {
    if (!thoughtsById.has(star.dataset.id)) star.remove();
  }
  const existing = new Set([...stars.children].map((s) => s.dataset.id));
  for (const thought of parkedThoughts) {
    if (existing.has(thought.id)) continue;
    const { x, y, size } = starPosition(thought.id);
    const star = el('span', 'sky-star is-new');
    star.dataset.id = thought.id;
    star.style.left = `${x}%`;
    star.style.top = `${y}%`;
    star.style.setProperty('--size', `${size}px`);
    star.addEventListener('animationend', () => star.classList.remove('is-new'), { once: true });
    stars.append(star);
  }
}

// A released thought streaks across the sky and disappears.
export function shootingStar() {
  const streak = el('span', 'sky-shooting');
  streak.style.top = `${8 + Math.random() * 30}%`;
  streak.style.left = `${45 + Math.random() * 40}%`;
  sky.append(streak);
  streak.addEventListener('animationend', () => streak.remove(), { once: true });
  setTimeout(() => streak.remove(), 3000); // fallback if animations are off
}
