---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast (learner approved)

## Slices

- [ ] **1. You can type thoughts at night and park or release each one**
  Becomes usable: The Night screen runs in the browser: type a thought, it appears as a card, tap "Let it go" and it fades and drifts away, tap "Tomorrow" and the parked counter goes up.
  Why now: This is the kernel (`scope.md > The Unique Kernel`). Building it first proves the core feeling before anything else, and it includes the scaffold, the data logic, and its tests.
  PRD ref: `prd.md > The Core Journey` (steps 1–5), `prd.md > Adding thoughts`, `prd.md > Parking thoughts (the kernel)`
  Spec ref: `spec.md > Store (js/store.js)`, `spec.md > Night screen (js/app.js → renderNight)`, `spec.md > File Structure`, `spec.md > Look and Feel`
  Build: Create `index.html`, `css/style.css` (night theme), `js/store.js` (add, release, park, validation), `js/app.js` (Night screen, cards, fade/drift and slide animations, counter), `package.json` with start/test scripts, and `tests/store.test.js`.
  Verify (mechanical): `node --test` passes (add trims and rejects empty text, caps at 280, release removes from pending, park moves to parked); serve the folder and load the page in headless Chrome with no console errors; a scripted run adds three thoughts, releases one and parks two, and the DOM shows 0 cards and "Parked for tomorrow: 2".
  Learner check: Open the app, type three thoughts, let one go and park two. You should see the released one drift away and the counter show 2.
  Commit: `Add night screen: add, park, and release thoughts`

- [ ] **2. Parked thoughts are waiting in the morning**
  Becomes usable: Close and reopen the browser, switch to Morning, and your "Tomorrow" thoughts appear as a checklist on a dawn-colored screen; check one off and it moves to the bottom and fades.
  Why now: The night-to-morning handoff is the other half of the kernel and depends on saving working correctly, which is the riskiest assumption left.
  PRD ref: `prd.md > The Core Journey` (steps 7–9), `prd.md > Morning list`, `prd.md > Screens and Layout`, `prd.md > States and Boundaries` (Persistence, Unfinished parking)
  Spec ref: `spec.md > Data Model`, `spec.md > Morning screen (renderMorning)`, `spec.md > Mode toggle and theme`, `spec.md > Store (js/store.js)`
  Build: Add `load()`/`save()` with the `thoughtpark:v1` key, `toggleDone`, `clearDone`, `modeForHour`; the Morning screen and morning theme; the Night/Morning toggle; clock-based starting screen; unparked cards restored on reload.
  Verify (mechanical): new unit tests pass (`modeForHour` boundaries at 4, 5, 16, 17; toggleDone; clearDone on next park; load of corrupted JSON returns the empty default); headless browser: park two thoughts, reload the page, switch to Morning, confirm both listed; check one off, reload, confirm it's still checked and last.
  Learner check: Park two thoughts, close the tab, reopen it, and press "Morning". Both thoughts should be there; tick one off.
  Commit: `Add morning list with saved parked thoughts`

- [ ] **3. The night ends calmly and mistakes can be undone**
  Becomes usable: Parking the last card brings up "All parked. Goodnight." with counts; a 5-second Undo appears after every park or release; first-use hint, empty-morning message, and the "saving is off" notice all appear when they should.
  Why now: These complete the journey and the states the PRD calls out, on top of a working kernel.
  PRD ref: `prd.md > Goodnight`, `prd.md > Parking thoughts (the kernel)` (Undo), `prd.md > States and Boundaries`
  Spec ref: `spec.md > Goodnight screen (renderGoodnight)`, `spec.md > Undo toast`, `spec.md > Important Failure Modes`
  Build: Goodnight screen with session counts and "Add another thought"; Undo toast calling `restore()`; first-use hint using `seenHint`; empty-morning state; storage-unavailable detection and notice.
  Verify (mechanical): unit test for `restore()`; headless browser: release then Undo restores the card; parking the last card shows Goodnight with correct counts; empty storage shows the hint and the empty-morning message; simulated storage failure shows the notice without errors.
  Learner check: Park your last thought and read the Goodnight screen; then let a thought go and press Undo before it disappears.
  Commit: `Add goodnight screen, undo, and empty states`

- [ ] **4. It looks and feels finished, and anyone can run it**
  Becomes usable: A polished, phone-friendly app with reduced-motion support, plus a README, license, and screenshots so judges understand and run it.
  Why now: Design is a judging criterion, and polish is safest once all behavior works.
  PRD ref: `prd.md > Look and Feel`, `prd.md > What We're Building`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Where It Runs and How Someone Tries It`, `spec.md > File Structure`
  Build: Visual pass on spacing, type, colors, focus states and button sizes; `prefers-reduced-motion`; mobile layout check; `README.md` (what, why, how to run, how it was built with the Devpost Learn Skill Pack and Claude Code, screenshots); `LICENSE` (MIT).
  Verify (mechanical): all tests pass; headless screenshots at 390×844 and 1280×800 in night and morning show no overflow or layout breaks; no console errors; README run steps work from a clean clone.
  Learner check: Open the app on your phone-sized window and desktop, try the whole night-to-morning journey, and say what you'd change.
  Commit: `Polish design, add README and license`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 2 (night parking and morning handoff both working)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

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
