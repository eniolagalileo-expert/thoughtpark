---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner approved)

## Slices

- [x] **1. You can type thoughts at night and park or release each one**
  Becomes usable: The Night screen runs in the browser: type a thought, it appears as a card, tap "Let it go" and it fades and drifts away, tap "Tomorrow" and the parked counter goes up.
  Why now: This is the kernel (`scope.md > The Unique Kernel`). Building it first proves the core feeling before anything else, and it includes the scaffold, the data logic, and its tests.
  PRD ref: `prd.md > The Core Journey` (steps 1–5), `prd.md > Adding thoughts`, `prd.md > Parking thoughts (the kernel)`
  Spec ref: `spec.md > Store (js/store.js)`, `spec.md > Night screen (js/app.js → renderNight)`, `spec.md > File Structure`, `spec.md > Look and Feel`
  Build: Create `index.html`, `css/style.css` (night theme), `js/store.js` (add, release, park, validation), `js/app.js` (Night screen, cards, fade/drift and slide animations, counter), `package.json` with start/test scripts, and `tests/store.test.js`.
  Verify (mechanical): `node --test` passes (add trims and rejects empty text, caps at 280, release removes from pending, park moves to parked); serve the folder and load the page in headless Chrome with no console errors; a scripted run adds three thoughts, releases one and parks two, and the DOM shows 0 cards and "Parked for tomorrow: 2".
  Learner check: Open the app, type three thoughts, let one go and park two. You should see the released one drift away and the counter show 2.
  Commit: `Add night screen: add, park, and release thoughts`

- [x] **2. Parked thoughts are waiting in the morning**
  Becomes usable: Close and reopen the browser, switch to Morning, and your "Tomorrow" thoughts appear as a checklist on a dawn-colored screen; check one off and it moves to the bottom and fades.
  Why now: The night-to-morning handoff is the other half of the kernel and depends on saving working correctly, which is the riskiest assumption left.
  PRD ref: `prd.md > The Core Journey` (steps 7–9), `prd.md > Morning list`, `prd.md > Screens and Layout`, `prd.md > States and Boundaries` (Persistence, Unfinished parking)
  Spec ref: `spec.md > Data Model`, `spec.md > Morning screen (renderMorning)`, `spec.md > Mode toggle and theme`, `spec.md > Store (js/store.js)`
  Build: Add `load()`/`save()` with the `thoughtpark:v1` key, `toggleDone`, `clearDone`, `modeForHour`; the Morning screen and morning theme; the Night/Morning toggle; clock-based starting screen; unparked cards restored on reload.
  Verify (mechanical): new unit tests pass (`modeForHour` boundaries at 4, 5, 16, 17; toggleDone; clearDone on next park; load of corrupted JSON returns the empty default); headless browser: park two thoughts, reload the page, switch to Morning, confirm both listed; check one off, reload, confirm it's still checked and last.
  Learner check: Park two thoughts, close the tab, reopen it, and press "Morning". Both thoughts should be there; tick one off.
  Commit: `Add morning list with saved parked thoughts`

- [x] **3. The night ends calmly and mistakes can be undone**
  Becomes usable: Parking the last card brings up "All parked. Goodnight." with counts; a 5-second Undo appears after every park or release; first-use hint, empty-morning message, and the "saving is off" notice all appear when they should.
  Why now: These complete the journey and the states the PRD calls out, on top of a working kernel.
  PRD ref: `prd.md > Goodnight`, `prd.md > Parking thoughts (the kernel)` (Undo), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Goodnight screen (renderGoodnight)`, `spec.md > Undo toast`, `spec.md > Important Failure Modes`
  Build: Goodnight screen with session counts and "Add another thought"; Undo toast calling `restore()`; first-use hint using `seenHint`; empty-morning state; storage-unavailable detection and notice.
  Verify (mechanical): unit test for `restore()`; headless browser: release then Undo restores the card; parking the last card shows Goodnight with correct counts; empty storage shows the hint and the empty-morning message; simulated storage failure shows the notice without errors.
  Learner check: Park your last thought and read the Goodnight screen; then let a thought go and press Undo before it disappears.
  Commit: `Add goodnight screen, undo, and empty states`

- [x] **4. Your thoughts become stars, and prompts help you empty your mind**
  Becomes usable: A night sky sits behind the Night and Goodnight screens; each parked thought is a star that stays in place, letting a thought go sends a shooting star, switching to Morning plays a sunrise; when you stop typing, gentle prompts appear under the box.
  Why now: Learner-approved improvements that build on the working journey from slices 1–3 (star positions depend on saved parked thoughts, and the shooting star hooks into release and undo).
  PRD ref: `prd.md > Night sky`, `prd.md > Gentle prompts`
  Spec ref: `spec.md > Night sky (js/sky.js)`, `spec.md > Gentle prompts (js/app.js → prompt timer)`, `spec.md > Look and Feel`
  Build: `js/sky.js` with decorative stars, `renderSky`, `shootingStar`, `sunrise`; `starPosition(id)`, `PROMPTS`, `promptAt(n)` in `store.js`; wire sky updates into park, release, undo, and mode switch; prompt idle timer on the Night screen; reduced-motion versions.
  Verify (mechanical): unit tests for `starPosition` (stable, inside bounds) and `promptAt` (cycles); headless browser: parking two thoughts shows two bright stars at the same positions after reload; releasing creates a shooting-star element that is removed afterwards; undo updates the star count; after 6 idle seconds a prompt is visible and typing hides it; switching to Morning hides the stars; no console errors.
  Learner check: Park a few thoughts and watch stars appear; let one go and watch the shooting star; then wait without typing and read the prompt.
  Commit: `Add night sky stars and gentle prompts`

- [x] **5. One minute of breathing before sleep**
  Becomes usable: From the Goodnight screen, "Breathe for a minute" runs a 60-second breathe-in/breathe-out circle, then dims to a near-black "Goodnight."
  Why now: Completes the night journey after Goodnight exists (slice 3); independent of the sky.
  PRD ref: `prd.md > Breathing moment`, `prd.md > The Core Journey` (step 6a)
  Spec ref: `spec.md > Breathing moment (renderBreathing)`
  Build: `breathPhase(elapsedMs)` in `store.js`; breathing view with circle, label, time remaining, Stop; end overlay; reduced-motion behavior.
  Verify (mechanical): unit tests for `breathPhase` at 0, 3.9 s, 4 s, 9.9 s, 10 s, 59.9 s, and 60 s (phase, cycle, done); headless browser with a sped-up clock: the label alternates, Stop returns to Goodnight, and the end overlay appears after the full minute; no console errors.
  Learner check: Park your last thought, tap "Breathe for a minute", follow a few breaths, then press Stop.
  Commit: `Add one-minute breathing moment`

- [x] **6. It looks and feels finished, and anyone can run it**
  Becomes usable: A polished, phone-friendly app with reduced-motion support, plus a README, license, and screenshots so judges understand and run it.
  Why now: Design is a judging criterion, and polish is safest once all behavior works.
  PRD ref: `prd.md > Look and Feel`, `prd.md > What We're Building`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > File Structure`
  Build: Visual pass on spacing, type, colors, focus states and button sizes; `prefers-reduced-motion`; mobile layout check; `README.md` (what, why, how to run, how it was built with the Devpost Learn Skill Pack and Claude Code, screenshots); `LICENSE` (MIT).
  Verify (mechanical): all tests pass; headless screenshots at 390×844 and 1280×800 in night and morning show no overflow or layout breaks; no console errors; README run steps work from a clean clone.
  Learner check: Open the app on your phone-sized window and desktop, try the whole night-to-morning journey, and say what you'd change.
  Commit: `Polish design, add README and license`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2 (night parking and morning handoff both working). Learner feedback: asked what the project is and to improve the idea; approved three additions (night sky stars, gentle prompts, breathing moment). Learner did not report on hands-on use.
- [ ] Final kick-the-tires exploration and feedback completed — learner tried the app and asked for star info and morning improvements; in progress

## Final Review

- [x] Star info: hovering or tapping a parked star shows its thought and parked time — learner request at final review; verified on desktop (hover) and phone (tap), all slice checks re-run.
- [x] Morning moments: stars fall into the list, check-off burst and All clear, morning Let go, last night's summary — learner request at final review; learner approved all four. Verified: 20 browser checks (normal and reduced motion), 4 new unit tests, all earlier checks re-run.
- [x] Moon at night, sun in the morning, and a visible morning Let go animation — learner feedback ("In the morning, there should be a sun… even I click let it go, I can't see any animation. In the night, there should be a moon"). The Let go bug: the arrival animation rule overrode the release animation; fixed with a more specific selector and verified by reading the running animation name.
- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Added slices 4 (night sky and gentle prompts) and 5 (breathing moment); polish became slice 6 — at the first checkpoint the learner asked to improve the idea and approved three additions, recorded in `scope.md`, `prd.md`, and `spec.md`.
- Undo restores a saved copy of the state from just before the action instead of a `restore()` helper, and is verified in the browser rather than a unit test — this reverses the action exactly, including checked-off morning items that parking clears.
- The sunrise is driven by CSS on the theme change rather than a `sunrise()` function in `sky.js` — a CSS transition on `body[data-theme]` was simpler and already plays whenever the mode changes.
- On the Goodnight and Breathing screens the sky layer now sits above the text (buttons stay on top), and star positions start below the header — found while verifying star info: stars behind text or the header couldn't be hovered.
