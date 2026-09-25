// The night sky behind the screens: faint decorative stars, one bright star
// per parked thought, shooting stars for released thoughts, and a sunrise.
import { starPosition } from './store.js';

const sky = document.getElementById('sky');
const decor = el('div', 'sky-decor');
const stars = el('div', 'sky-stars');
const sun = el('div', 'sky-sun');
sky.append(decor, sun, stars);

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

// Draw one bright star per open parked thought. New stars twinkle in;
// stars whose thought was un-parked or checked off fade out.
export function renderSky(parkedThoughts) {
  const wanted = new Map(parkedThoughts.map((t) => [t.id, t]));
  for (const star of [...stars.children]) {
    if (!wanted.has(star.dataset.id)) star.remove();
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
