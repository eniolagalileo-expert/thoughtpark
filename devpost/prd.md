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
6. When no unparked cards are left (and at least one thought was parked), the Goodnight screen appears: "All parked. Goodnight." with the number of thoughts released and parked, over the night sky of their parked stars.
6a. Optional: they tap "Breathe for a minute" for a 60-second guided breathing animation, after which the screen dims to near-black.
7. **Morning.** When the user opens ThoughtPark in the morning, a soft sunrise fades the stars away and the Morning screen shows "Good morning" and last night's Tomorrow thoughts as a checklist.
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

### Night sky
Added after the first checkpoint at the learner's request (Innovation, Design).
- As someone parking thoughts, I want to see them become something calm and beautiful, so letting go feels good.
  - [ ] Behind the Night and Goodnight screens, a dark sky shows faint decorative stars plus one brighter star for each open parked thought.
  - [ ] Parking a thought adds its star with a gentle twinkle-in; the star keeps the same position every time the app opens.
  - [ ] Letting a thought go sends a shooting star across the sky that disappears.
  - [ ] Undo restores the sky to match (the star returns or disappears).
  - [ ] Hovering a star with the mouse (or tapping it on a phone) shows that thought's text and when it was parked; moving away or tapping elsewhere hides it. (Added at the learner's request during final review.)
  - [ ] Switching to Morning plays a short sunrise: the sky warms and the stars fade as the checklist appears.
  - [ ] A crescent moon is visible in the night sky; in the morning the moon sets and a sun with slowly turning rays rises in its place, without covering any text. (Added at the learner's request during final review.)
  - [ ] With reduced motion, stars appear and disappear without movement.

### Gentle prompts
Added after the first checkpoint at the learner's request (Impact).
- As someone whose mind feels full but can't name what's in it, I want a gentle nudge so I can empty my head completely.
  - [ ] When the text box is empty and the user hasn't typed for 6 seconds, a soft prompt appears under the box (for example "Anything about work?").
  - [ ] A new prompt replaces it every 6 seconds while the box stays empty and untouched, cycling through a fixed list.
  - [ ] Typing hides the prompt immediately.

### Breathing moment
Idea A from scope, moved into the POC by the learner (Impact).
- As someone who has parked everything, I want one minute of calm breathing so I fall asleep more easily.
  - [ ] The Goodnight screen has a "Breathe for a minute" button.
  - [ ] It shows a circle that grows while "Breathe in" (4 seconds) and shrinks while "Breathe out" (6 seconds), six times, with a small time-remaining display.
  - [ ] A "Stop" button returns to the Goodnight screen at any time.
  - [ ] After one minute the screen dims to near-black with "Goodnight"; tapping it returns to the Goodnight screen.
  - [ ] With reduced motion the circle doesn't scale; only the words change.

### Goodnight
- [ ] When the last unparked card is parked, the Goodnight screen appears with the correct counts.
- [ ] "Add another thought" returns to the Night screen with an empty box.

### Morning list
Source: `scope.md > What "Working" Looks Like`.
- As someone who parked thoughts last night, I want to see them in the morning so I can act on them.
  - [ ] The Morning screen lists every thought parked as Tomorrow that isn't checked off, newest first.
  - [ ] Tapping an item checks it off: it gets a checkmark, moves to the bottom, and fades.
  - [ ] Checked items are cleared automatically the next time the user parks new thoughts (proposed).

### Morning moments
Added at the learner's request during final review ("add some animations and some new idea" for the morning); learner approved all four.
- **Stars fall into the list.** When the Morning screen opens, each open parked thought's star drops from its place in the sky into its checklist item, one after another, and the item appears as the star lands.
  - [ ] With two or more parked thoughts, a falling star is visible for each and every item is visible when they finish.
  - [ ] With reduced motion, items appear without falling stars.
- **Checking off feels good.** Ticking an item sends a short burst of sun rays from its checkbox. When every item is checked, "All clear. Have a good day." appears and the morning sun glows brighter.
  - [ ] A burst appears on check-off and disappears by itself.
  - [ ] "All clear" appears only when every listed item is checked, and disappears if one is unchecked.
- **"Doesn't matter anymore."** Each open morning item has a quiet "Let go" button. It releases that thought, which lights up with a rainbow shimmer and bursts into colorful sparkles as it fades (learner request), and is not kept; the usual 5-second Undo applies.
  - [ ] Let go removes the item for good after its animation; Undo brings it back.
  - [ ] Letting go of the last item shows the empty-morning message.
- **Last night's summary.** Under "Good morning": "Last night you parked 3 thoughts and let go of 2. You slept on it." Only the two counts are saved, never the released text.
  - [ ] The counts match the parks and releases made at night since the Morning screen was last opened.
  - [ ] The line is hidden when nothing was parked or released.

### AI companion
Added at the learner's request during final review; learner approved features 1, 2, 4, and 5 of the proposal (not AI sorting).

**Settings and privacy**
- A settings button in the header opens a panel where the user pastes their own Anthropic API key. The key is kept only in this browser and sent only to Anthropic.
- The panel explains plainly: only thoughts you choose to talk through, speak, or plan are sent to Claude; nothing else leaves the device.
- Without a key the app runs in **demo mode**: every AI answer is a clearly labeled sample ("Demo reply — add your API key for real answers").
  - [ ] Saving a key switches demo labels off; removing it switches them back on.

**Talk it through**
- As someone lying awake with a thought, I want a short, calm conversation that helps me settle it, so I can park it with a clear note.
- Available from every night card and every open morning item ("Talk").
- A chat panel opens with the thought at the top. Claude writes the first message, adapted to what the thought is: a worry (gentle questions: what's most likely, what's in your control, is this for tonight or tomorrow), a task (one tiny first step), or a regret (a kinder view and an invitation to let it go). Replies stream in word by word, stay short (2–4 sentences), and the conversation wraps up after about three exchanges.
- "Park with this note" asks Claude for a one-line note (for example "First step: open the passport form, 5 min"), saves it on the thought, and parks it (from a night card) or updates it (from the morning). The note appears under the thought on cards, in the morning list, and in the star's info.
- "Close" keeps the thought as it was. The conversation itself is never saved.
  - [ ] The first reply streams in without the user typing anything.
  - [ ] After "Park with this note", the thought shows its note everywhere it appears.
  - [ ] An API error (bad key, no network, rate limit) shows a plain message in the chat and nothing is lost.

**Speak instead of type**
- A microphone button next to Add. The user talks; when they stop, the words are split into separate thoughts that appear as cards.
  - [ ] With a key, Claude splits the words into thoughts; without a key, a simple split on sentences and "and" is used.
  - [ ] If the browser has no speech recognition, the button is hidden.

**Morning plan**
- "Make my morning plan" above the morning list. Claude orders the open thoughts into a short plan with one line each and a friendly one-sentence opener.
  - [ ] The plan shows as a card above the list; each step names its thought.
  - [ ] It only uses open (unchecked) thoughts; with none open, the button is hidden.

**Safety**
- Before anything is sent to Claude, the app checks the text for signs of crisis (for example "kill myself", "want to die", "hurt myself"). If found, it shows a calm card: "You don't have to carry this alone. Call or text 988 (Suicide & Crisis Lifeline, US), available 24/7," with a link, and does not start a chat.
- Claude's instructions also say to point to 988 if risk appears in conversation.
  - [ ] Crisis wording always shows the 988 card and never calls the API.

### Dream journal
Added at the learner's request during final review ("In the Morning section, there should be note dream at last night. Also the claude can analyze that dream.").
- **Note a dream.** At the top of the Morning screen, "☾ Note last night's dream" opens a text box (with a microphone button where the browser supports speech). Saving keeps the dream on this device, one per morning; it can be edited or deleted.
  - [ ] A saved dream shows on the Morning screen and survives reloading; Delete removes it for good.
- **Reflect with Claude.** "✦ Reflect with Claude" sends the dream and the thoughts parked last night and shows a short reflection: a title, the feelings and themes noticed, two or three sentences of grounded observation, any clear echo of last night's parked thoughts, and one gentle question. The reflection is saved with the dream.
  - Claude is told that dreams have no fixed hidden meanings: no symbol dictionaries, no predictions, no diagnosis.
  - [ ] The request contains the dream and last night's open parked thoughts only; the reflection shows and survives reloading.
  - [ ] Crisis wording in a dream shows the 988 card and sends nothing.
  - [ ] Demo mode shows a labeled sample reflection with no network call; API errors show a plain message.
- **Dream journal.** Earlier dreams are listed under "Dream journal (N)" with their dates and reflection titles; the newest 60 are kept.

### Calendar
Added at the learner's request during final review ("Make the calendar and store all of them per day").
- Every night is kept as a day in a calendar: the thoughts parked that night (with notes), what became of each (done, let go in the morning, or still open), how many thoughts were let go that night (count only; released text is never stored), and the dream noted the next morning with its reflection title.
- A night runs from 5:00 am to 5:00 am, so a thought parked at 1 am belongs to the previous evening; a dream noted in the morning belongs to the night before.
- "Your calendar" next to "How it works" opens a month view: days with parked thoughts show a dot, days with a dream show a small moon; today is outlined. Previous and next month buttons. Tapping a day shows that night's details; an empty day says so.
- Each night also lists the sleep tools used (learner request: "Helping to fall asleep action should be added in calendar"): which tool, its choice (sound and timer, story setting), when it started, how long it ran, and whether it ran to the end or was stopped. Such nights get a small "z" mark.
- Parked thoughts saved before the calendar existed are added to it automatically. The newest 365 nights are kept.
  - [ ] Parking, letting go, checking off, morning let go, notes, and undo all show correctly in that night's entry.
  - [ ] The calendar survives reloading; released thought text never appears in saved data.

### More ideas (learner-approved batch)
The learner asked "any other ideas like mine?", and approved all six proposals ("add those functions as a code").

**Three good things.** On the Goodnight screen: "One good thing about today" with a small text box; up to three per night, shown on Goodnight and in the calendar. Kept on the device.
  - [ ] Saved things appear on Goodnight and in that night's calendar entry; a fourth can't be added.

**Sleep rating and weekly insights.** A morning card asks "How did you sleep?" with five moons; the rating is saved on last night and shown in the calendar (and can be changed). In the calendar, "✦ This week's insights" sends a summary of the last seven nights (counts, recurring words, sleep tools and whether they ran to the end, ratings, good things, dream titles; no full thought text) to Claude and shows a headline, two to four observations, and one suggestion. A local line always shows the average rating with and without sleep tools when there is enough data. Demo mode shows a labeled sample.
  - [ ] Rating persists and shows in the calendar; insights request contains no full thought text.

**Worries that keep coming back.** When the same key word appears in parked thoughts on three or more different nights in the last 14, a card appears on both screens: "This keeps coming back: presentation (4 nights)". "✦ Make a daytime plan" opens Talk it through in daytime mode for that worry and saves the resulting note on the card; "Not now" hides it for 7 days.
  - [ ] A word parked on three nights shows the card; two nights don't; Not now hides it; the plan note shows on the card.

**Worry time.** A CBT technique: a 15-minute daytime session for worries. "Worry time" on the Morning screen (and suggested at the chosen time of day, default 5 pm, set in Settings) shows unchecked parked thoughts one at a time with Done, Talk it through, Let go, and Next, and a 15-minute countdown. When time is up: "Worry time is over. The rest can wait."
  - [ ] Actions update the list and calendar outcomes; the session ends at 15 minutes.

**Eyes-closed voice mode.** In Talk it through, "Voice mode" dims the panel almost to black, reads each reply aloud slowly, then listens; what the person says is sent as their reply. The crisis check still runs on everything said. Hidden where speech recognition or speech synthesis is unavailable.
  - [ ] Replies are spoken, speech is sent after the reply finishes, crisis words show the 988 card.

**Install as an app, with a bedtime reminder.** A web app manifest, icons, and a service worker so ThoughtPark can be installed to the home screen and opens offline (AI features need a connection). Settings has a bedtime (default 10:30 pm): "Remind me while ThoughtPark is open" shows a notification at bedtime if permission is granted, and "Add a daily reminder to my calendar" downloads a repeating calendar event (.ics) with an alert, which works even when the app is closed.
  - [ ] The page registers a service worker and works offline after one visit; the .ics file has a daily rule at the chosen time.

### Help me fall asleep
Added at the learner's request during final review ("You can add an idea which the service can help to fall asleep easily"); the learner asked the agent to choose. The Goodnight screen offers four tools under "Help me fall asleep": Breathe (the existing minute), Mind shuffle, Sleep sounds, and Sleep story.

- **Mind shuffle.** Based on Luc Beaudoin's cognitive shuffle (serial diverse imagining). A calm seed word is spelled out one letter at a time; for each letter, a few simple, unrelated things starting with it fade in slowly ("B… a bicycle… a blanket… a blueberry"), one every ~7 seconds, for five minutes, then the screen dims to near-black.
  - [ ] Words and items change slowly; Stop returns to Goodnight; after the session the dim "Goodnight" screen appears.
- **Sleep sounds.** Rain, ocean, or brown noise generated in the browser, with a timer (15, 30, or 60 minutes) that fades the sound out; the screen dims while it plays.
  - [ ] Choosing a sound starts it; choosing a timer ends it with a fade; Stop silences it immediately.
- **Sleep story (AI).** The user picks a setting (a lighthouse, a night train, a winter cabin, a quiet garden). Claude writes a slow, gentle, deliberately uneventful story of about 350 words, shown in dim text and read aloud by the device's voice at a slow pace. Demo mode uses a built-in sample story, labeled.
  - [ ] The story streams in; reading aloud can be turned off; Stop ends both text and voice.
- All four respect reduced motion and never send the user's thoughts anywhere (the story request contains only the chosen setting).

## States and Boundaries
- **First visit guide:** on the very first visit, a short welcome guide opens: four steps (empty your mind, park or let go, talk it through, wake up to your list) with Back, Next, and Skip, and a note that everything stays on the device. It never opens again by itself; a "How it works" link under each screen title reopens it. (Added at the learner's request during final review: "When the user who is the first in this website visit… he will misunderstand what it is.")
- **First use:** the Night screen shows a one-line hint under the box: "Type each thought, then park it. They'll be waiting in the morning."
- **Nothing to park yet:** the Night screen shows only the text box and the hint.
- **Morning with nothing parked:** "Nothing was parked. Clear mind, clear day." and a link to the Night screen.
- **Unfinished parking:** if the user closes the app with unparked cards, they're still there next time on the Night screen (proposed).
- **Persistence:** parked thoughts, checked state, unparked cards, dreams and their reflections, and last night's two counts are saved on this device and survive closing and reopening the browser. "Let it go" thoughts are never saved.
- **Boundary:** one person, one device. No accounts, no sharing. AI features use the user's own API key; the app has no server.

## Product Decisions
- **Manual one-tap sorting, not AI sorting** — learner approved in scope: the decision itself settles the mind, and no API key is needed.
- **Brain dump first; wind-down and sleep rating later** — learner asked for a mix of three ideas; the approved scope keeps the brain dump as the core.
- **Time-of-day switching with a manual toggle** (proposed) — feels automatic in real use; the toggle makes the demo possible without waiting for morning.
- **Undo for 5 seconds** (proposed) — tapping the wrong button half-asleep is likely.
- **Night sky, gentle prompts, and a 60-second breathing moment** — the learner asked to improve the idea after trying the first build and approved these three additions; they strengthen the design and impact without adding accounts, servers, or keys.

## What We're Building
- Night screen: add thoughts, park each as Tomorrow or Let it go, with the fade animation and undo
- Goodnight screen with counts
- Morning screen: checklist of parked thoughts with check-off
- Time-of-day screen choice plus a manual Night/Morning toggle
- Night sky with stars, shooting stars, and sunrise; star info on hover or tap
- Morning moments: stars falling into the list, check-off burst and "All clear", morning "Let go", last night's summary
- Gentle prompts when the user stops typing
- 60-second breathing moment after Goodnight
- Saving on the device between sessions
- Night and morning visual themes

## Deferred From the POC
- **Morning sleep rating and history** (scope idea C) — needs charts and several days of data to show value.
- **AI suggestions for sorting thoughts** — declined by the learner; the manual decision is the kernel.
- **Syncing across devices** — would need accounts and a backend.

## Possible Later Enhancements
- Voice input so thoughts can be spoken with eyes half-closed.
- A gentle reminder at bedtime.
- Carrying unchecked morning items into the next night's list.

## Non-Goals
- Not therapy or medical advice: Talk it through is a short reflective aid, says so in the settings panel, and points to 988 when there are signs of crisis.
- Not a sleep tracker: no sensors, wearables, or sleep scores.
- Not a journal: released thoughts are deliberately never kept.
- Not a to-do app: no due dates, priorities, or categories.

## Open Questions
None blocking `4-spec`.
