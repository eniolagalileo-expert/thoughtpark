# ThoughtPark

**Park your racing thoughts for the night, and find them waiting in the morning.**

ThoughtPark is a bedtime brain dump for people who can't fall asleep because their mind keeps looping. At night you type out each thought and make one small decision: **Tomorrow** (keep it for the morning) or **Let it go** (release it for good). When everything is parked, the screen goes quiet. In the morning, the thoughts you kept are waiting as a short checklist.

<p>
  <img src="docs/screenshots/phone-night.png" alt="Night screen: thought cards with Let it go and Tomorrow buttons over a starry sky" width="200">
  <img src="docs/screenshots/phone-goodnight.png" alt="Goodnight screen: All parked. Goodnight, with parked thoughts shown as stars" width="200">
  <img src="docs/screenshots/phone-breathing.png" alt="Breathing moment: a glowing circle with Breathe out and seconds remaining" width="200">
  <img src="docs/screenshots/phone-morning.png" alt="Morning screen: a checklist of last night's parked thoughts" width="200">
</p>

## Why

Lying awake replaying the day, or rehearsing tomorrow, is one of the most common reasons people struggle to fall asleep. In a sleep-lab study, people who spent five minutes writing a specific to-do list before bed fell asleep about nine minutes faster than people who wrote about tasks they'd already finished ([Scullin et al., 2018, *Journal of Experimental Psychology: General*](https://ncbi.nlm.nih.gov/pmc/articles/PMC5758411)).

ThoughtPark turns that into a calm nightly ritual. You don't only write thoughts down; you decide what each one is. Knowing the important ones will be waiting in the morning makes it safe to stop holding them tonight.

## What it does

- **Park or let go.** Each thought becomes a card. "Let it go" makes it blur and drift away, and it's never saved. "Tomorrow" parks it.
- **Moon and sun.** A crescent moon watches over the night; in the morning it sets and the sun rises in its place.
- **Your thoughts become stars.** Every parked thought appears as a star in the night sky behind the app, always in the same place. Hover over a star (or tap it on a phone) to see which thought it is and when you parked it. Letting a thought go sends a shooting star across the sky.
- **Gentle prompts.** If you stop typing, soft questions appear ("Someone you need to reply to?") to help you empty your mind completely.
- **All parked. Goodnight.** When nothing is left, a quiet goodnight screen shows what you parked and released.
- **One minute of breathing.** An optional guided minute (4 seconds in, 6 seconds out), then the screen dims to near-black.
- **Morning handoff.** At sunrise each star falls from the sky into your checklist, and a line sums up your night: "Last night you parked 3 thoughts and let go of 2. You slept on it." (Only the counts are kept.)
- **Does it still matter?** Worries often look smaller in the morning. Check an item off (a small burst of sun rays) or let it go if it doesn't matter anymore, and watch it shimmer like a rainbow and burst into sparkles. When everything is done: "All clear. Have a good day." 
- **Forgiving.** Every park or release can be undone for 5 seconds, which helps with half-asleep taps.
- **Private by design.** No account and no server. Everything stays in your browser on your device, and released thoughts are never stored.
- **Accessible.** Works with keyboard and screen readers, and respects your device's reduced-motion setting.

The app picks Night or Morning from the time of day (morning is 5 am to 5 pm). The toggle in the corner switches manually.

## Try it

**Live:** _link added at submission_

**Run locally** (no install needed, Node 18+ or Python 3):

```bash
git clone <this repo>
cd thoughtpark
npm start          # or: python3 -m http.server 8000
```

Then open the URL it prints (for example http://localhost:3000). A local server is needed because the app uses JavaScript modules.

**Tests:**

```bash
npm test           # runs node --test on the data logic
```

## How it's built

Plain HTML, CSS, and JavaScript with no framework, no build step, and no dependencies.

| File | What it does |
|---|---|
| `index.html` | Page shell: sky layer, header with the Night/Morning toggle, main screen, undo toast |
| `css/style.css` | Night and morning themes, cards, sky, breathing circle, reduced-motion rules |
| `js/store.js` | Pure logic with no DOM: adding, parking, releasing, morning order and let go, last night's counts, saving and loading, star positions, prompts, breathing timing |
| `js/sky.js` | The night sky: decorative stars, one star per parked thought with hover/tap info, shooting stars |
| `js/app.js` | Screens and interactions: Night, Goodnight, Breathing, Morning (falling stars, sun-ray burst, All clear), undo, prompts |
| `tests/store.test.js` | 25 unit tests for `store.js` using Node's built-in test runner |

Data is one JSON object in `localStorage` under `thoughtpark:v1`, holding pending and parked thoughts plus last night's two counts. If storage is blocked, the app still works for the session and says that saving is off.

## How this was made

This project was built for Devpost's **Build With AI: Basics** hackathon using the [Devpost Learn Skill Pack](https://github.com/challengepost/learn-ai-basics). It follows a plan-first workflow: scope → product requirements → technical spec → build in small, verified slices. The planning documents are in [`devpost/`](devpost/):

- [`scope.md`](devpost/scope.md): the idea and the proof-of-concept boundary
- [`prd.md`](devpost/prd.md): the product requirements
- [`spec.md`](devpost/spec.md): the technical plan
- [`checklist.md`](devpost/checklist.md): the build slices and revisions

The code was written with **Claude Code** (Anthropic) as the AI coding agent. Details the agent proposed rather than the builder are marked "(proposed)" in the planning docs. No pre-existing code was used apart from the Skill Pack's planning skills, which are included as installed. The only external resource is the Nunito font from Google Fonts.

## What's next

- Voice input, so thoughts can be spoken with eyes half-closed
- A morning sleep rating, to see which nights went better
- Carrying unfinished morning items into the next night
- Optional sync across devices

## License

[MIT](LICENSE)
