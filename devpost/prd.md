---
doc: prd
status: approved
---

# ThoughtPark — Product Requirements

A bedtime brain dump for someone whose racing thoughts keep them awake: park each thought as "Tomorrow" or "Let it go," then find the Tomorrow ones waiting in the morning.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

> **How this PRD was made:** the learner asked the agent to stop asking questions and draft the details. Everything below develops the approved scope; detailed choices the learner didn't make themselves are marked **(proposed)** and are confirmed by the learner's approval of this document.

## The Core Journey
Source: `scope.md > The Core Loop`.

1. **Night.** The user opens ThoughtPark. It shows the Night screen with a single text box: "What's on your mind?"
2. They type a thought and press Enter (or the Add button). The thought appears as a card below the box. They add as many as they want.
3. Each card has two buttons: **Tomorrow** and **Let it go**.
4. Tapping **Let it go** makes the card slowly fade and drift away, then it's gone for good.
5. Tapping **Tomorrow** makes the card slide into a small "Parked for tomorrow" count at the bottom of the screen.
6. When no unparked cards are left (and at least one thought was parked), the Goodnight screen appears: "All parked. Goodnight." with the number of thoughts released and parked.
7. **Morning.** When the user opens ThoughtPark in the morning, the Morning screen shows "Good morning" and last night's Tomorrow thoughts as a checklist.
8. They check items off as they deal with them. Checked items move to the bottom and fade.
9. Success: the thoughts they parked at night were really waiting for them in the morning, so parking them at night felt safe.

## Screens and Layout
Three screens in a single page, one column, centered, phone-friendly (proposed):

- **Night screen:** app name and a small moon at the top; text box and Add button; the list of unparked thought cards; a "Parked for tomorrow: N" counter pinned at the bottom.
- **Goodnight screen:** full-screen calm message, counts ("2 parked, 1 let go"), and a small "Add another thought" link back to the Night screen.
- **Morning screen:** "Good morning" heading, the checklist of parked thoughts, and a small link "Park new thoughts" that goes to the Night screen.

**Switching between night and morning (proposed):** the app picks the screen from the time of day. Morning is 5:00 am – 5:00 pm, Night is the rest. A small toggle ("Night / Morning") in the corner lets the user switch manually, which is also what the demo video uses.

## Look and Feel
Source: `scope.md > Inspiration & Identity`.

- **Night:** very dark navy background, soft off-white text, a muted warm accent (moonlight yellow) for the moon and Tomorrow button. Low contrast glare, no pure white.
- **Morning:** soft pale background (warm dawn tint), dark text, same accent.
- **Type:** one rounded, friendly sans-serif; large comfortable text; generous spacing (proposed).
- **Motion:** slow, gentle transitions. The "Let it go" fade and drift is the signature moment. Respect the device's reduced-motion setting.
- **Avoid:** bright colors, badges, streaks, gamification, busy layouts.

## Features and Behavior

### Adding thoughts
- As someone lying awake, I want to type out each thought quickly so it's out of my head.
  - [ ] Typing a thought and pressing Enter or Add creates a card with that text and clears the box, which keeps focus for the next thought.
  - [ ] Empty or whitespace-only input does nothing.
  - [ ] Long thoughts (up to 280 characters) wrap inside the card; typing stops at 280 characters.

### Parking thoughts (the kernel)
Source: `scope.md > The Unique Kernel`.
- As someone lying awake, I want to decide once for each thought whether it's for tomorrow or not worth keeping, so I can stop holding it.
  - [ ] Each unparked card shows Tomorrow and Let it go buttons.
  - [ ] Let it go: the card fades and drifts upward over about 1.5 seconds, then is removed and never stored.
  - [ ] Tomorrow: the card slides away and the "Parked for tomorrow" count goes up by one.
  - [ ] **Undo (proposed):** right after either action, a small "Undo" appears for 5 seconds and restores the card.

### Goodnight
- [ ] When the last unparked card is parked, the Goodnight screen appears with the correct counts.
- [ ] "Add another thought" returns to the Night screen with an empty box.

### Morning list
Source: `scope.md > What "Working" Looks Like`.
- As someone who parked thoughts last night, I want to see them in the morning so I can act on them.
  - [ ] The Morning screen lists every thought parked as Tomorrow that isn't checked off, newest first.
  - [ ] Tapping an item checks it off: it gets a checkmark, moves to the bottom, and fades.
  - [ ] Checked items are cleared automatically the next time the user parks new thoughts (proposed).

## States and Boundaries
- **First use:** the Night screen shows a one-line hint under the box: "Type each thought, then park it. They'll be waiting in the morning."
- **Nothing to park yet:** the Night screen shows only the text box and the hint.
- **Morning with nothing parked:** "Nothing was parked. Clear mind, clear day." and a link to the Night screen.
- **Unfinished parking:** if the user closes the app with unparked cards, they're still there next time on the Night screen (proposed).
- **Persistence:** parked thoughts, checked state, and unparked cards are saved on this device and survive closing and reopening the browser. "Let it go" thoughts are never saved.
- **Boundary:** one person, one device. No accounts, no sharing.

## Product Decisions
- **Manual one-tap sorting, not AI sorting** — learner approved in scope: the decision itself settles the mind, and no API key is needed.
- **Brain dump first; wind-down and sleep rating later** — learner asked for a mix of three ideas; the approved scope keeps the brain dump as the core.
- **Time-of-day switching with a manual toggle** (proposed) — feels automatic in real use; the toggle makes the demo possible without waiting for morning.
- **Undo for 5 seconds** (proposed) — tapping the wrong button half-asleep is likely.

## What We're Building
- Night screen: add thoughts, park each as Tomorrow or Let it go, with the fade animation and undo
- Goodnight screen with counts
- Morning screen: checklist of parked thoughts with check-off
- Time-of-day screen choice plus a manual Night/Morning toggle
- Saving on the device between sessions
- Night and morning visual themes

## Deferred From the POC
- **Guided wind-down after parking** (scope idea A) — adds a second flow; the kernel works without it.
- **Morning sleep rating and history** (scope idea C) — needs charts and several days of data to show value.
- **AI help sorting or rephrasing thoughts** — needs an API key and adds cost.
- **Syncing across devices** — would need accounts and a backend.

## Possible Later Enhancements
- Voice input so thoughts can be spoken with eyes half-closed.
- A gentle reminder at bedtime.
- Carrying unchecked morning items into the next night's list.

## Non-Goals
- Not a sleep tracker: no sensors, wearables, or sleep scores.
- Not a journal: released thoughts are deliberately never kept.
- Not a to-do app: no due dates, priorities, or categories.

## Open Questions
None blocking `4-spec`.
