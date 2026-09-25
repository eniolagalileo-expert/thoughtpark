---
doc: spec
status: approved
---

# ThoughtPark — Technical Spec

## How This Works, In Plain Language
ThoughtPark is a single web page that runs entirely in the browser: one HTML file for structure, one CSS file for the night and morning looks, and one JavaScript file for the behavior. There is no server and no account.

Everything the app needs to remember (the thoughts you parked for tomorrow, which ones you've checked off, and any cards you haven't parked yet) is kept in the browser's `localStorage`, a small notepad the browser keeps for one website on one device. Thoughts you "let go" are never written there, so they are truly gone.

When the page opens, it looks at the clock: between 5 am and 5 pm it shows the Morning screen, otherwise the Night screen. A small toggle lets you switch by hand.

Why this shape: the whole proof is about how parking a thought *feels* and whether it's waiting in the morning. Nothing about that needs a server, a database, or a framework, and a plain static page can be opened from a file or hosted free on GitHub Pages.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. The user opens `index.html` → `app.js` loads saved data from `localStorage` → picks Night or Morning by the current hour → renders that screen.
2. Night: the user types a thought and presses Enter → `app.js` creates `{id, text, createdAt}` in the `pending` list → saves → renders a new card.
3. The user taps **Let it go** → the card gets the `releasing` CSS class (fade and drift, about 1.5 s) → the thought is removed from `pending` and saved → a 5-second Undo toast appears, holding the removed thought in memory only.
4. The user taps **Tomorrow** → the card slides out → the thought moves from `pending` to `parked` with `parkedAt` → saved → the "Parked for tomorrow: N" counter updates → Undo toast appears.
5. `pending` becomes empty (and something was handled in this session) → Goodnight screen renders with the session counts.
6. Morning: `app.js` renders `parked` items → the user taps one → it's marked `done: true`, saved, and re-sorted to the bottom with a faded style.
7. The next time a thought is parked at night, items with `done: true` are cleared from `parked`.

## Stack
- **HTML, CSS, and plain JavaScript (ES2020), no framework, no build step.** Rationale: three screens and one list don't need a framework, and it runs by double-clicking the file. Tradeoff accepted: rendering is written by hand (small `render()` functions), which is fine at this size.
- **`localStorage`** for saving on the device. Docs: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- **CSS transitions and `prefers-reduced-motion`** for the animations. Docs: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- **Font: "Nunito"** from Google Fonts (rounded, friendly sans-serif), with `system-ui` fallback so it still looks right offline. Docs: https://fonts.google.com/specimen/Nunito
- **Tests: Node's built-in test runner** (`node --test`, Node 18+; this machine has Node 22) for the pure logic in `store.js`. Docs: https://nodejs.org/api/test.html

## Where It Runs and How Someone Tries It
- **Runtime:** any modern browser (Chrome, Safari, Firefox, Edge), desktop or phone. No API keys.
- **Run locally:** `npx serve .` (or `python3 -m http.server 8000`) in the project folder, then open the printed URL. A server is used rather than double-clicking because ES modules need an `http://` origin.
- **Demo recording:** open the app in a browser window sized like a phone (or Chrome DevTools device mode), record with macOS Cmd+Shift+5. Use the Night/Morning toggle to show the morning handoff.
- **Tests:** `node --test`.
- **Optional deployment (recommended, free):** GitHub Pages from the `main` branch root, so judges can try it with one click. Steps are recorded for `6-ship`: push to a public repo → Settings → Pages → Deploy from branch → `main` / root.
- **Submission still requires** the demo video and the public GitHub repository; the live link is extra.

## Look and Feel
From `prd.md > Look and Feel`.

- **Night palette:** background `#0e1424` (deep navy), surface `#18203a`, text `#e7e4da` (soft off-white), muted text `#9aa0b4`, accent `#f2cf7a` (moonlight).
- **Morning palette:** background `#f7efe4` (dawn), surface `#fffaf3`, text `#2b2a33`, muted `#6f6a73`, accent `#d9a441`.
- Themes are CSS custom properties on `body[data-theme="night"|"morning"]`.
- **Type:** Nunito, 18px base, 1.5 line height; headings 28–32px, weight 700.
- **Density:** one centered column, max width 480px, 24px padding, generous gaps.
- **Motion:** 300–400 ms eases for most transitions; "Let it go" is 1.5 s fade plus upward drift and slight blur. All motion is reduced to a quick fade under `prefers-reduced-motion`.
- **Copy tone:** short, calm, second person. "What's on your mind?", "All parked. Goodnight."
- **Avoid:** badges, streaks, bright saturated colors, confetti.

## Components

### Store (`js/store.js`)
Pure functions over the saved data, with no DOM access so they can be tested in Node: `load()`, `save()`, `addThought(text)`, `releaseThought(id)`, `parkThought(id)`, `restore(thought, from)`, `toggleDone(id)`, `clearDone()`, `modeForHour(hour)`. Validates text (trims, rejects empty, caps at 280).
PRD ref: `prd.md > Adding thoughts`, `prd.md > Parking thoughts (the kernel)`, `prd.md > Morning list`, `prd.md > States and Boundaries`.

### Night screen (`js/app.js` → `renderNight`)
Text box with `maxlength="280"`, Add button, first-use hint, pending thought cards with Tomorrow and Let it go buttons, and the parked counter.
PRD ref: `prd.md > Adding thoughts`, `prd.md > Parking thoughts (the kernel)`.

### Goodnight screen (`renderGoodnight`)
Message, session counts (parked and released since the Night screen opened), and "Add another thought."
PRD ref: `prd.md > Goodnight`.

### Morning screen (`renderMorning`)
"Good morning," checklist of parked thoughts (unchecked first, newest first), empty-state message, "Park new thoughts" link.
PRD ref: `prd.md > Morning list`, `prd.md > States and Boundaries`.

### Morning moments (`renderMorning`, `arriveFromSky`, `sunburst`)
- **Falling stars:** after the Morning screen renders, each item whose star is in the sky gets a temporary fixed-position `.falling-star` at the star's on-screen position, animated with the Web Animations API to the item's checkbox; the item fades in when its star lands. Skipped under reduced motion.
- **Check-off burst and All clear:** a `.sunburst` element (CSS conic-gradient rays) is added to the checkbox on check-off and removes itself. `body.is-all-clear` brightens `.sky-sun` and shows the All clear line when every item is done.
- **Morning Let go:** `letGoParked(state, id)` in `store.js`; reuses the undo toast (kind `dismissed`).
- **Last night's summary:** `state.night = { parked, released, seen }`. `recordNight(state, kind)` counts night parks and releases, starting fresh after the Morning screen has been seen; `markNightSeen` runs when Morning renders; `nightSummary(night)` builds the sentence.
PRD ref: `prd.md > Morning moments`.

### Mode toggle and theme
Chooses Night or Morning from `modeForHour(new Date().getHours())` on load; a small "Night / Morning" toggle in the top corner overrides it for the session and switches `data-theme`.
PRD ref: `prd.md > Screens and Layout`.

### Night sky (`js/sky.js`)
A fixed, full-screen layer behind the content (`<div id="sky">`), drawn with plain DOM elements and CSS animation, not a canvas. Holds a CSS crescent moon and a sun disc with rotating rays that swap places on the theme change, in a strip of sky kept free above the content (the screen has extra top padding), ~45 faint decorative stars (fixed seed) and one bright star per open parked thought. Star positions come from `starPosition(id)` in `store.js`, a hash of the thought's id, so each star stays put between visits. Exposes `renderSky(parked)`, `shootingStar()`, and `hideStarInfo()`; the sunrise is pure CSS driven by `body[data-theme]`. Bright stars accept pointer events (with an enlarged invisible hit area) and show a tooltip with the thought's text and parked time: hover for mouse, tap to toggle for touch. Empty areas of the page content pass pointer events through so stars behind them stay reachable. Hidden in the morning theme after the sunrise transition.
PRD ref: `prd.md > Night sky`.

### Gentle prompts (`js/app.js` → prompt timer)
A 6-second idle timer on the Night screen. When the text box is empty and untouched, shows `promptAt(n)` from the fixed `PROMPTS` list in `store.js` under the box and advances every 6 seconds; any input hides it and resets the timer. Timer is cleared when leaving the Night screen.
PRD ref: `prd.md > Gentle prompts`.

### Breathing moment (`renderBreathing`)
Full-screen view started from Goodnight. Uses `breathPhase(elapsedMs)` from `store.js` (4 s in, 6 s out, 6 cycles = 60 s) on a `requestAnimationFrame` loop to set the label, the remaining seconds, and the circle's scale. Stop returns to Goodnight; the end state is a near-black "Goodnight" overlay.
PRD ref: `prd.md > Breathing moment`.

### AI client (`js/ai.js`)
Wraps the official Anthropic TypeScript/JavaScript SDK (`@anthropic-ai/sdk` 0.128.0), loaded in the browser as an ES module from jsdelivr (`https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm`), no build step. The client is created with the user's own key and `dangerouslyAllowBrowser: true` (safe here because the key belongs to the person using the page and never leaves their browser except to Anthropic).
- Model: `claude-opus-5` with adaptive thinking (the default), `output_config.effort: "low"` for fast, short replies.
- Refusal fallback: `client.beta.messages` with `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`; `stop_reason === "refusal"` is still checked and shown as a gentle message.
- `talkStream({ thought, mode, history, onText })`: streams a chat reply with `stream.on("text")` and `finalMessage()`.
- `noteFor({ thought, history })`, `splitThoughts(transcript)`, `morningPlan(items)`: single calls with `output_config.format` JSON schemas (`additionalProperties: false`), parsed with `JSON.parse`.
- Errors use the SDK's typed classes (`AuthenticationError`, `RateLimitError`, `APIConnectionError`, `APIError`) mapped to plain messages.
- Demo mode (no key): each function returns labeled sample output without network calls.
- The key is stored in `localStorage` under `thoughtpark:apiKey`, separate from app data.
PRD ref: `prd.md > AI companion`.

### Safety check (`store.js` → `crisisCheck`)
Pure function run on any text before it is sent to Claude; a match shows the 988 card instead. Tested.
PRD ref: `prd.md > AI companion` (Safety).

### Talk panel, settings panel, voice, morning plan (`js/app.js`)
- Talk panel: a modal bottom sheet (`<dialog>`) with the thought, streamed messages, a text box, "Park with this note", and "Close". Conversation history lives in memory only.
- Settings panel: `<dialog>` with a password-type key field, Save, Remove, demo-mode status, and the privacy note.
- Voice: the browser's `SpeechRecognition` / `webkitSpeechRecognition`; hidden if unavailable. Transcript → `splitThoughts` (AI) or `splitLocally` (store.js, tested).
- Morning plan: button + card above the morning list.
PRD ref: `prd.md > AI companion`.

### Welcome guide (`js/guide.js`)
A four-step `<dialog>` guide with Back / Next / Skip and step dots, opened on load when `state.seenGuide` is false and from "How it works" links. Closing it by any means sets `seenGuide: true`.
PRD ref: `prd.md > States and Boundaries` (First visit guide).

### Dream journal (`js/dreams.js`)
The Morning screen's dream card: collapsed button, text box with optional dictation, saved view with Reflect / Edit / Delete, the reflection card, and the past-dreams list. Data helpers in `store.js` (tested): `addDream`, `updateDream`, `deleteDream`, `setDreamReflection`, `dreamForDay`; dreams are `{ id, text, createdAt, reflection? }` in `state.dreams`, newest first, capped at 60. `analyzeDream({ dream, thoughts })` in `ai.js` returns structured JSON `{ title, feelings[], themes[], reflection, connection, question }`.
PRD ref: `prd.md > Dream journal`.

### Calendar (`js/calendar.js`)
`state.history` maps a night key (`YYYY-MM-DD`, local; `nightKey(ts)` is the date of `ts − 5 h`) to `{ parked: [{ id, text, note?, outcome? }], released }`. The pure functions that already change thoughts also keep history current, so undo (which restores a whole-state snapshot) stays correct: `parkThought` adds the entry, `releaseThought` counts, `toggleDone` sets or clears `outcome: "done"`, `letGoParked` sets `outcome: "let-go"`, `setNote` updates the note. Sleep tools add `aids: [{ id, tool, startedAt, detail?, minutes?, finished? }]` to the night via `startSleepAid`, `updateSleepAid`, and `endSleepAid` (called from `app.js`: started when a tool begins or a sound is first chosen, ended as finished when a tool dims the screen, as stopped on Stop or a mode switch). `withHistoryBackfill` adds older parked thoughts on load; history is capped at 365 nights. `dreamNightKey(ts)` assigns a dream to the night before the morning it was noted. `calendar.js` renders the month grid and day detail in a `<dialog>`.
PRD ref: `prd.md > Calendar`.

### Sleep tools (`js/sleep.js`, `js/sounds.js`)
- `sleep.js`: full-screen views for Mind shuffle, Sleep sounds, and Sleep story, sharing Stop and the dim end screen with the breathing moment. Mind shuffle uses `shuffleSequence(word)` from `store.js` (pure, tested) with a built-in list of calm nouns per letter.
- `sounds.js`: Web Audio API. One looping noise buffer (white, or brown by integration) through filters and gain: rain = band-passed white noise with random short "drop" bursts; ocean = low-passed brown noise with a slow gain wave; brown noise = brown noise. A master gain ramps down over 20 seconds when the timer ends.
- Sleep story: `sleepStory({ setting, onText })` in `ai.js`, streamed like Talk it through; spoken with `speechSynthesis` sentence by sentence (rate 0.85, pitch 0.9). Demo mode returns a built-in story.
PRD ref: `prd.md > Help me fall asleep`.

### Undo toast
After release or park, shows "Released · Undo" or "Parked · Undo" for 5 seconds; Undo calls `restore()`. Only the most recent action can be undone.
PRD ref: `prd.md > Parking thoughts (the kernel)`.

## Data Model
One JSON object in `localStorage` under the key `thoughtpark:v1`:

```json
{
  "pending": [{ "id": "k3f9a", "text": "Email Sam about Friday", "createdAt": 1790000000000 }],
  "parked":  [{ "id": "p81xz", "text": "Pay the electric bill", "createdAt": 1790000000000, "parkedAt": 1790000100000, "done": false }],
  "seenHint": true,
  "night": { "parked": 2, "released": 1, "seen": false },
  "dreams": [{ "id": "d1x", "text": "I was on a train…", "createdAt": 1790000200000, "reflection": { "title": "The long train", "feelings": ["calm"], "themes": ["travel"], "reflection": "…", "connection": "", "question": "…" } }]
}
```

- `pending`: typed but not yet parked. Survives closing the app (`prd.md > States and Boundaries > Unfinished parking`).
- `parked`: Tomorrow thoughts. `done` is set in the morning; done items are cleared on the next park.
- `night`: only the counts of last night's parks and releases, for the morning summary.
- Released thoughts are never written. The undo buffer and session counts live in memory only.
- If saved data is missing or unreadable, start from the empty default.

## File Structure

```
build-with-ai/
├── index.html          # Page shell: header with toggle, <main> for screens, toast area
├── css/
│   └── style.css       # Night/morning themes, layout, cards, animations, reduced motion
├── js/
│   ├── store.js        # Pure data logic, prompts, breathing timing, star positions, load/save (tested)
│   ├── sky.js          # Night sky layer: stars, shooting stars, sunrise
│   ├── ai.js           # Claude calls (talk, note, split, plan), demo mode, key storage
│   ├── companion.js    # Talk it through, Settings, and 988 panels
│   ├── guide.js        # First-visit welcome guide
│   ├── dreams.js       # Morning dream card, reflection, and journal
│   ├── calendar.js     # Month calendar of past nights
│   ├── sleep.js        # Help me fall asleep: mind shuffle, sleep sounds, sleep story
│   ├── sounds.js       # Generated rain, ocean, and brown noise (Web Audio)
│   └── app.js          # Screens, event handlers, mode toggle, undo toast, prompt timer, breathing
├── tests/
│   └── store.test.js   # node --test unit tests for store.js
├── package.json        # "type": "module", scripts: start, test (no dependencies)
├── README.md           # What it is, how to run, screenshots, AI tools disclosure
├── LICENSE             # MIT
├── devpost/            # Devpost learning workspace (scope, prd, spec, checklist)
└── .agents/ .claude/ agent/ skills-lock.json   # Devpost Learn Skill Pack (installed)
```

## External Services and Dependencies
- **Anthropic Messages API** via `@anthropic-ai/sdk` 0.128.0 (jsdelivr ESM). Calls go from the browser to `api.anthropic.com` with the user's key. Model `claude-opus-5`, effort `low`; about a few cents per night of use. Docs: https://docs.anthropic.com/en/api/messages
- **Web Audio API** for sleep sounds and **speechSynthesis** for reading the sleep story aloud; both built into the browser. Docs: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API, https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- **Browser speech recognition** (Web Speech API; in Chrome, audio is processed by Google's speech service). Docs: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- **Google Fonts (Nunito)** — CSS link `https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap`. No key, free. Falls back to `system-ui` when offline.
- **GitHub Pages (optional hosting)** — free for public repos. Docs: https://docs.github.com/en/pages
- The AI features need the user's own Anthropic API key; everything else needs no keys and costs nothing.

## Important Failure Modes
- **`localStorage` unavailable** (private browsing or blocked storage) → the app still works for the session and shows a small note: "Saving is off in this browser, so thoughts won't be kept overnight."
- **Saved data corrupted** → `load()` catches the parse error and starts empty rather than crashing.
- **Clock-based mode is wrong for someone's schedule** (for example, night-shift workers) → the manual toggle is always visible.

## What Was Simplified and Why
- **Clock-based mode with a toggle** instead of detecting the user's real bedtime and wake time — the toggle proves the handoff; learning a schedule would need history and settings.
- **`localStorage` on one device** instead of an account with sync — the kernel is the nightly park-and-return, which works on one device. Sync would need auth and a backend.
- **Single-level undo** instead of full history — covers the half-asleep mis-tap the PRD cares about.
- **DOM + CSS stars** instead of a canvas or WebGL scene — a few dozen elements animate smoothly, stay accessible to `prefers-reduced-motion`, and need no library.

## Decisions and Open Issues
- **AI companion with the user's own key, straight from the browser** — agent recommendation accepted by the learner. Tradeoff: no server to run or pay for, but each user needs their own key; judges without one see labeled demo replies. A hosted proxy would be the next step for a real launch.
- **`claude-opus-5` at low effort** — the skill's default model; low effort keeps replies short and quick for a bedtime chat.
- **Plain HTML/CSS/JS with `localStorage`** — agent recommendation, accepted by the learner's approval of this spec. Tradeoff: hand-written rendering instead of a framework's components.
- **GitHub Pages deploy** — agent recommendation, optional; decided in `6-ship`.
- **Night sky, gentle prompts, breathing moment** — learner-approved additions after the first checkpoint; implemented with the same no-framework stack.
- **Learner uncertainty:** none identified. The learner asked the agent to proceed without further questions, so no uncertainty was explored; noted rather than invented.
- **Open:** none. `prd.md > Open Questions` had nothing blocking.
