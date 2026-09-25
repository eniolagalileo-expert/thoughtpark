// "Your calendar": a month of nights. Each night shows what was parked, what
// became of it, how many thoughts were let go, and the dream noted after it.
import { monthMarks, nightDetails, nightKey, SLEEP_AIDS, weekSummary, weekHasData, ratingStats } from './store.js';
import { weeklyInsights, friendlyError, isDemo } from './ai.js';

const dialog = document.getElementById('calendar');
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const OUTCOME_LABELS = { done: 'Done', 'let-go': 'Let go' };

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) node.append(child);
  return node;
}

function keyFor(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function longDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

export function openCalendar({ getState }) {
  const tonight = nightKey(Date.now());
  const [ty, tm] = tonight.split('-').map(Number);
  let year = ty;
  let month = tm - 1;
  let selected = tonight;

  const title = el('h2', { className: 'sheet-title', id: 'calendar-title' });
  const prev = el('button', { type: 'button', className: 'icon-button cal-nav', textContent: '‹' });
  const next = el('button', { type: 'button', className: 'icon-button cal-nav', textContent: '›' });
  prev.setAttribute('aria-label', 'Previous month');
  next.setAttribute('aria-label', 'Next month');
  const grid = el('div', { className: 'cal-grid', role: 'grid' });
  const detail = el('section', { className: 'cal-detail', id: 'cal-detail' });
  detail.setAttribute('aria-live', 'polite');
  const close = el('button', { type: 'button', className: 'icon-button sheet-close', textContent: '×' });
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => dialog.close());

  prev.addEventListener('click', () => { month -= 1; if (month < 0) { month = 11; year -= 1; } renderMonth(); });
  next.addEventListener('click', () => { month += 1; if (month > 11) { month = 0; year += 1; } renderMonth(); });

  dialog.replaceChildren(
    el('header', { className: 'sheet-header' }, [
      el('div', { className: 'cal-heading' }, [prev, title, next]),
      close,
    ]),
    grid,
    el('p', { className: 'cal-legend' }, [
      el('span', { className: 'cal-dot' }), ' thoughts  ',
      el('span', { className: 'cal-z', textContent: 'z' }), ' fell-asleep help  ',
      el('span', { className: 'cal-moon', textContent: '☾' }), ' dream',
    ]),
    detail,
    insightsSection(),
    el('p', { className: 'cal-privacy', textContent: 'Saved only on this device. Thoughts you let go at night are never stored, only counted.' }),
  );

  function insightsSection() {
    const button = el('button', { type: 'button', className: 'talk-button cal-insights-button', id: 'insights-button' }, [
      el('span', { className: 'talk-icon', textContent: '✦' }), 'This week’s insights',
    ]);
    const card = el('div', { className: 'cal-insights', id: 'cal-insights', hidden: true });
    card.setAttribute('aria-live', 'polite');
    const stats = ratingStats(getState());
    const local = stats.with.n >= 2 && stats.without.n >= 2
      ? [el('p', { className: 'cal-stat', textContent: `Average sleep rating: ${stats.with.avg} on nights with a sleep tool, ${stats.without.avg} without.` })]
      : [];
    button.addEventListener('click', async () => {
      const summary = weekSummary(getState(), tonight);
      card.hidden = false;
      if (!weekHasData(summary)) {
        card.replaceChildren(el('p', { className: 'cal-empty', textContent: 'Nothing saved in the last 7 nights yet. Park some thoughts and rate your sleep, then check back.' }));
        return;
      }
      button.disabled = true;
      card.replaceChildren(el('p', { className: 'plan-loading', textContent: 'Looking at your week…' }));
      try {
        const insight = await weeklyInsights(summary);
        card.replaceChildren(
          el('h3', { className: 'cal-insights-title', textContent: insight.headline }),
          el('ul', { className: 'cal-insights-list' }, insight.observations.map((o) => el('li', { textContent: o }))),
          el('p', { className: 'cal-suggestion', textContent: insight.suggestion }),
          ...(isDemo() ? [el('p', { className: 'plan-demo', textContent: 'Demo insights. Add your API key in Settings for insights from Claude.' })] : []),
        );
      } catch (error) {
        card.replaceChildren(el('p', { className: 'plan-error', textContent: friendlyError(error) }));
      } finally {
        button.disabled = false;
      }
    });
    return el('section', { className: 'cal-insights-section' }, [
      button,
      ...local,
      card,
      el('p', { className: 'cal-privacy', textContent: 'Insights send Claude a summary of the last 7 nights: counts, repeated key words, sleep tools, ratings, good things, and dream titles. Not your thoughts themselves.' }),
    ]);
  }

  function renderMonth() {
    title.textContent = new Date(year, month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
    const marks = monthMarks(getState(), year, month);
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells = WEEKDAYS.map((d) => el('span', { className: 'cal-weekday', textContent: d }));
    for (let i = 0; i < first; i += 1) cells.push(el('span', { className: 'cal-blank' }));
    for (let day = 1; day <= days; day += 1) {
      const key = keyFor(year, month, day);
      const mark = marks[key];
      const button = el('button', { type: 'button', className: 'cal-day' }, [
        el('span', { className: 'cal-num', textContent: String(day) }),
        el('span', { className: 'cal-marks' }, [
          ...(mark?.thoughts ? [el('span', { className: 'cal-dot' })] : []),
          ...(mark?.aids ? [el('span', { className: 'cal-z', textContent: 'z' })] : []),
          ...(mark?.dream ? [el('span', { className: 'cal-moon', textContent: '☾' })] : []),
        ]),
      ]);
      button.dataset.key = key;
      if (key === tonight) button.classList.add('is-today');
      if (key === selected) button.setAttribute('aria-pressed', 'true');
      if (key > tonight) button.disabled = true;
      button.setAttribute('aria-label', `${longDate(key)}${mark?.thoughts ? ', thoughts saved' : ''}${mark?.aids ? ', sleep tools used' : ''}${mark?.dream ? ', dream noted' : ''}`);
      button.addEventListener('click', () => {
        selected = key;
        for (const b of grid.querySelectorAll('.cal-day')) b.removeAttribute('aria-pressed');
        button.setAttribute('aria-pressed', 'true');
        renderDetail();
      });
      cells.push(button);
    }
    grid.replaceChildren(...cells);
  }

  function renderDetail() {
    const night = nightDetails(getState(), selected);
    const parts = [el('h3', { className: 'cal-detail-title', textContent: `The night of ${longDate(selected)}` })];
    if (night.rating) {
      parts.push(el('p', { className: 'cal-rating', textContent: `Slept: ${'☾'.repeat(night.rating)}${'·'.repeat(5 - night.rating)} ${night.rating} of 5` }));
    }
    if (!night.parked.length && !night.released && !night.aids.length && !night.good.length && !night.dream && !night.rating) {
      parts.push(el('p', { className: 'cal-empty', textContent: 'Nothing saved for this night.' }));
    }
    if (night.parked.length) {
      parts.push(el('ul', { className: 'cal-thoughts' }, night.parked.map((t) => el('li', {}, [
        el('span', { className: 'cal-thought', textContent: t.text }),
        ...(t.note ? [el('span', { className: 'cal-note', textContent: t.note })] : []),
        el('span', {
          className: `cal-outcome cal-outcome-${t.outcome ?? 'open'}`,
          textContent: OUTCOME_LABELS[t.outcome] ?? (selected === nightKey(Date.now()) ? 'Parked' : 'Still open'),
        }),
      ]))));
    }
    if (night.released) {
      parts.push(el('p', { className: 'cal-released', textContent: `Let go of ${night.released} thought${night.released === 1 ? '' : 's'} that night.` }));
    }
    if (night.good.length) {
      parts.push(el('div', { className: 'cal-good' }, [
        el('p', { className: 'cal-good-label', textContent: 'Good things' }),
        el('ul', {}, night.good.map((g) => el('li', { textContent: g }))),
      ]));
    }
    if (night.aids.length) {
      parts.push(el('div', { className: 'cal-aids' }, [
        el('p', { className: 'cal-aids-label', textContent: 'Help falling asleep' }),
        el('ul', {}, night.aids.map((a) => el('li', {}, [
          el('span', { className: 'cal-aid-name', textContent: `${SLEEP_AIDS[a.tool]}${a.detail ? `: ${a.detail}` : ''}` }),
          el('span', { className: 'cal-aid-meta', textContent: aidMeta(a) }),
        ]))),
      ]));
    }
    if (night.dream) {
      parts.push(el('div', { className: 'cal-dream' }, [
        el('p', { className: 'cal-dream-label', textContent: `☾ Dream${night.dream.reflection ? `: ${night.dream.reflection.title}` : ''}` }),
        el('p', { className: 'cal-dream-text', textContent: night.dream.text }),
      ]));
    }
    detail.replaceChildren(...parts);
  }

  renderMonth();
  renderDetail();
  dialog.showModal();
}

// "at 11:42 pm · 5 min · ran to the end"
function aidMeta(aid) {
  const time = new Date(aid.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const parts = [`at ${time}`];
  if (Number.isInteger(aid.minutes)) parts.push(aid.minutes < 1 ? 'under a minute' : `${aid.minutes} min`);
  if (aid.finished === true) parts.push('ran to the end');
  else if (aid.finished === false) parts.push('stopped');
  return parts.join(' · ');
}
