// Claude calls for the AI companion: Talk it through, notes, voice splitting,
// and the morning plan. Uses the person's own API key, straight from the
// browser to Anthropic. Without a key, every function returns a clearly
// labeled demo answer and nothing leaves the device.

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';
const MODEL = 'claude-opus-5';
const KEY_STORAGE = 'thoughtpark:apiKey';

// Server-side refusal fallback: if a request is declined, Anthropic re-runs it
// on its recommended fallback model inside the same call.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

let sdk = null;
let client = null;
let clientKey = '';

// ---- The API key ----------------------------------------------------------

export function getKey() {
  try { return window.localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export function setKey(key) {
  try { window.localStorage.setItem(KEY_STORAGE, key.trim()); return true; } catch { return false; }
}

export function removeKey() {
  try { window.localStorage.removeItem(KEY_STORAGE); } catch { /* nothing to remove */ }
  client = null;
  clientKey = '';
}

export function isDemo() {
  return !getKey();
}

async function getClient() {
  const key = getKey();
  if (client && clientKey === key) return client;
  sdk ??= await import(SDK_URL);
  // Safe in the browser here: the key belongs to the person using the page.
  client = new sdk.default({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
  clientKey = key;
  return client;
}

// Turn SDK errors into short, calm messages for the chat.
export function friendlyError(error) {
  const Anthropic = sdk?.default;
  if (Anthropic) {
    if (error instanceof Anthropic.AuthenticationError) return 'That API key didn’t work. Check it in Settings.';
    if (error instanceof Anthropic.PermissionDeniedError) return 'This API key isn’t allowed to use Claude. Check it in Settings.';
    if (error instanceof Anthropic.RateLimitError) return 'Claude is busy right now. Try again in a minute.';
    if (error instanceof Anthropic.APIConnectionError) return 'Can’t reach Claude. Check your internet connection.';
    if (error instanceof Anthropic.APIError) return `Claude couldn’t answer (error ${error.status ?? 'unknown'}). Try again.`;
  }
  if (error instanceof RefusalError) return error.message;
  return 'Something went wrong reaching Claude. Try again.';
}

class RefusalError extends Error {}

function checkStop(message) {
  if (message.stop_reason === 'refusal') {
    throw new RefusalError('Claude can’t help with this one. If you’re struggling, you can call or text 988 any time.');
  }
}

function textOf(message) {
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// ---- Talk it through ------------------------------------------------------

const TALK_SYSTEM = `You are ThoughtPark's bedtime companion. The person has a thought on their mind and wants to settle it so they can rest.

First work out what kind of thought it is and respond to that:
- A worry: ask one gentle question at a time — what's most likely to happen, what's in their control, whether anything is needed tonight.
- A task: help them find one tiny, concrete first step for tomorrow, and reassure them it can wait until then.
- A regret or replayed moment: offer a kinder, realistic view and invite them to let it go.

At night, be calm and slow. In the morning, be brisk and practical: help them decide the next step, or notice that it doesn't matter anymore.

Keep every reply to two to four short sentences in plain, warm language. No lists, headings, or emoji. Aim to wrap up within about three exchanges: when the thought feels settled, say so and suggest parking it.

You are not a therapist and you don't diagnose. If they mention wanting to harm themselves or not wanting to live, respond with care and encourage them to call or text 988 (Suicide & Crisis Lifeline, US) right away, or local emergency services.`;

function framing(thought, mode) {
  return `It's ${mode === 'morning' ? 'morning' : 'night'}. The thought on my mind: "${thought}"`;
}

// Stream Claude's next reply. `history` holds earlier turns as
// { role: 'assistant' | 'user', content: string }, starting after the framing.
export async function talkStream({ thought, mode, history, onText }) {
  if (isDemo()) return demoStream(demoTalk(thought, history), onText);
  const api = await getClient();
  const stream = api.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: TALK_SYSTEM,
    messages: [{ role: 'user', content: framing(thought, mode) }, ...history],
    ...FALLBACK,
  });
  stream.on('text', (delta) => onText(delta));
  const message = await stream.finalMessage();
  checkStop(message);
  return textOf(message);
}

// ---- Structured answers ---------------------------------------------------

async function structured({ system, content, schema, maxTokens = 2000 }) {
  const api = await getClient();
  const message = await api.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }],
    ...FALLBACK,
  });
  checkStop(message);
  return JSON.parse(textOf(message));
}

const NOTE_SCHEMA = {
  type: 'object',
  properties: { note: { type: 'string' } },
  required: ['note'],
  additionalProperties: false,
};

// A one-line note to park with the thought, from the conversation so far.
export async function noteFor({ thought, mode, history }) {
  if (isDemo()) return demoNote(thought);
  const transcript = history.map((m) => `${m.role === 'user' ? 'Me' : 'Companion'}: ${m.content}`).join('\n');
  const { note } = await structured({
    system: 'You write the short note someone keeps with a thought after talking it through. Write one line, at most 12 words, in their voice, plain and calm. For a task, name the first step. For a worry, name what is and isn’t in their control. For a regret, a kind reminder. No quotes or emoji.',
    content: `${framing(thought, mode)}\n\nOur conversation:\n${transcript || '(no conversation yet)'}\n\nWrite the note.`,
    schema: NOTE_SCHEMA,
  });
  return note;
}

const SPLIT_SCHEMA = {
  type: 'object',
  properties: { thoughts: { type: 'array', items: { type: 'string' } } },
  required: ['thoughts'],
  additionalProperties: false,
};

// Split spoken words into separate thoughts. Returns null in demo mode so the
// caller can use the local splitter instead.
export async function splitThoughts(transcript) {
  if (isDemo()) return null;
  const { thoughts } = await structured({
    system: 'Split what someone said at bedtime into the separate thoughts on their mind. Keep each one short and in their own words (first person), fix obvious speech-to-text mistakes, drop filler words, and do not add anything they didn’t say.',
    content: transcript,
    schema: SPLIT_SCHEMA,
  });
  return thoughts.map((t) => t.trim()).filter(Boolean);
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    opener: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, action: { type: 'string' } },
        required: ['id', 'action'],
        additionalProperties: false,
      },
    },
  },
  required: ['opener', 'steps'],
  additionalProperties: false,
};

// Order the morning's open thoughts into a short plan.
export async function morningPlan(items) {
  if (isDemo()) return demoPlan(items);
  const list = items.map((t) => `- id ${t.id}: ${t.text}${t.note ? ` (note: ${t.note})` : ''}`).join('\n');
  const plan = await structured({
    system: 'You turn the thoughts someone parked last night into a short, realistic morning plan. Order them sensibly (quick wins and time-sensitive things first). For each, write one short action line (at most 14 words) that says what to do and roughly when. Start with a one-sentence friendly opener. Use each id exactly once and only ids from the list.',
    content: `My parked thoughts:\n${list}`,
    schema: PLAN_SCHEMA,
  });
  const known = new Set(items.map((t) => t.id));
  return { opener: plan.opener, steps: plan.steps.filter((s) => known.has(s.id)) };
}

// ---- Demo mode --------------------------------------------------------------

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function demoStream(text, onText) {
  for (const word of text.split(/(?<= )/)) {
    await wait(35);
    onText(word);
  }
  return text;
}

function kindOf(thought) {
  const t = thought.toLowerCase();
  if (/\b(said|did|should have|shouldn'?t have|embarrass|awkward|regret|mistake)\b/.test(t)) return 'regret';
  if (/\b(what if|worr|scared|afraid|anxious|nervous|might|going to go)\b/.test(t)) return 'worry';
  return 'task';
}

function demoTalk(thought, history) {
  const turn = history.filter((m) => m.role === 'assistant').length;
  const kind = kindOf(thought);
  const replies = {
    worry: [
      'That sounds like it’s been sitting heavy tonight. If you picture tomorrow realistically, what’s the most likely way this goes?',
      'That’s fair. Which part of it is actually in your hands, and is any of it something you can do tonight?',
      'Then it can wait until morning, and you’ll handle it with more energy than you have right now. Want to park it?',
    ],
    task: [
      'Good catch getting it out of your head. What’s the smallest first step you could take tomorrow, something that takes five minutes?',
      'That’s a solid first step, and it doesn’t need you tonight. Shall we park it with that note?',
      'It’s written down and waiting for you. You can let your mind rest now.',
    ],
    regret: [
      'Moments like that replay loudly at night. Most people barely remember what someone else said an hour later. What do you think they actually noticed?',
      'It sounds like you care about how you come across, which is a kind thing. Is there anything worth doing about it, or can it go?',
      'Then you can let this one go. It doesn’t need to come to bed with you.',
    ],
  };
  const list = replies[kind];
  return list[Math.min(turn, list.length - 1)];
}

function demoNote(thought) {
  const kind = kindOf(thought);
  if (kind === 'worry') return 'Most of this is out of my hands; tomorrow I’ll handle my part.';
  if (kind === 'regret') return 'Nobody remembers it like I do. It can go.';
  return 'First step tomorrow: five minutes, just to start.';
}

function demoPlan(items) {
  const times = ['first thing', 'after breakfast', 'mid-morning', 'before lunch', 'this afternoon'];
  return {
    opener: 'Here’s a gentle order for your morning.',
    steps: items.map((t, i) => ({ id: t.id, action: `${times[Math.min(i, times.length - 1)]}: ${t.note || t.text}` })),
  };
}
