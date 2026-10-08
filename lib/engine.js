// One conversational turn: safety check, model call, structured result.
// Shared by the website (api/chat.js), Telegram and WhatsApp.
const { prompt, docs } = require('./knowledge');
const { FIELDS, ABUSE_TYPES, DOCS, FORM_VERSION } = require('../public/fields.js');
const { REPLIES, CRISIS, checkTriggers } = require('./safety');

const MODEL = process.env.MODEL || 'gpt-4.1';
const FIELD_IDS = FIELDS.map(f => f.id);
const FALLBACK = "I'm sorry, I had trouble answering just now. If you are in danger, call the police on 10111, or the GBV Command Centre on 0800 428 428 (free, 24 hours). Please try sending your message again.";

const REFERENCE = '\n\n====\nREFERENCE MATERIAL (your domain knowledge; ground your guidance in it). Each document has an id in brackets.\n\n' +
  docs.map(d => `### DOCUMENT [${d.id}]: ${d.title}\n${d.text}`).join('\n\n---\n\n');

const LANG_RULE = {
  auto: 'the same language the person writes in (any South African language; if they mix languages, mirror their mix). Keep it simple and everyday',
  en: 'natural South African English',
  zu: 'isiZulu, simple and everyday (not formal or literary), even if the person writes in English. Keep phone numbers and names as they are',
  af: 'Afrikaans, simple and everyday, even if the person writes in English. Keep phone numbers and names as they are',
};

const CHANNEL_RULE = {
  web: 'the inFORMed website. The button is called "Generate Protection Order".',
  telegram: 'Telegram. Instead of a button, tell them to send /pdf for a PDF or /word for a Word document.',
  whatsapp: 'WhatsApp. Instead of a button, tell them to send the word PDF or WORD to receive the document.',
};

const SAFETY_KINDS = ['none', 'immediate_danger', 'suicidal', 'harm_other', 'injured_now', 'death'];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'updates', 'abuse_types', 'sources', 'grounding', 'safety', 'ready', 'language'],
  properties: {
    reply: { type: 'string' },
    updates: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['field', 'value'],
        properties: { field: { type: 'string', enum: FIELD_IDS }, value: { type: 'string' } },
      },
    },
    abuse_types: { type: 'array', items: { type: 'string', enum: ABUSE_TYPES.map(a => a.id) } },
    sources: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['doc', 'note'],
        properties: { doc: { type: 'string', enum: DOCS.map(d => d.id) }, note: { type: 'string' } },
      },
    },
    grounding: { type: 'string', enum: ['documents', 'general', 'none'] },
    safety: { type: 'string', enum: SAFETY_KINDS },
    ready: { type: 'boolean' },
    language: { type: 'string', enum: ['en', 'zu', 'af', 'other'] },
  },
};

function fieldGuide() {
  return FIELDS.map(f => `${f.id} = Form ${f.doc} section ${f.ds}: ${f.label}${f.type === 'check' ? ' [tick box]' : f.type === 'long' ? ' [long text]' : ''}`).join('\n');
}
const FIELD_GUIDE = fieldGuide();


const SWITCH_HINT = {
  web: 'the "Help me fill in my form" button',
  telegram: 'sending /fill',
  whatsapp: 'sending the word FILL',
};

// "Ask" mode: the person wants to understand protection orders, the form, the process and legal words.
const ASK_RULES = channel => `MODE: ASK A QUESTION. The person wants to understand protection orders, the court process, the form, or legal words. They are not filling in the form right now.
- Answer their question clearly and kindly in plain, everyday language, as if explaining to a friend. Explain any legal word you use. Keep it short: two to five sentences, or a short list when steps are clearer.
- Base your answer on the reference documents first, and set "grounding" to "documents".
- If the documents do not cover the question, you may still answer from your general knowledge of South African law and services. Then set "grounding" to "general", and say gently in the reply that this is general information which they can confirm with the court clerk or Legal Aid South Africa. Never invent phone numbers, addresses, fees, deadlines, case law or names of officials. If you are not sure, say so honestly rather than guessing.
- Stay within protection orders, domestic violence, safety, the court process and related support. For unrelated topics, kindly say what you can help with.
- If they start telling you about their own situation, listen and respond with care, and gently offer to help them put it into their application, which they can start with ${SWITCH_HINT[channel] || SWITCH_HINT.web}.
- Keep the conversation going: end each answer with ONE gentle, open offer, for example asking if there is anything else they would like to know, or whether they would like help filling in their form. Vary the wording; do not repeat the same sentence every time.
- "updates" must be an empty array in this mode. "ready" is false.`;

// "Fill" mode: the original inFORMed flow, gathering the application step by step.
const FILL_RULES = `MODE: HELP ME FILL IN MY FORM. Follow the original inFORMed conversation flow above: warm, patient, ONE question at a time.
- If the person asks a question about the law or the process, answer it briefly first (using the reference documents; if they do not cover it, give general information and say so), then continue with one gentle question.
- Use "updates" to fill in the form as described below.`;

function runtimeRules({ lang, channel, form, abuse, mode }) {
  const filled = {};
  for (const k of FIELD_IDS) if (form && form[k]) filled[k] = String(form[k]).slice(0, 6000);
  return `

====
HOW TO RESPOND IN THIS APP (this overrides the output-format notes above where they conflict)
Answer with one JSON object that matches the schema.

${mode === 'ask' ? ASK_RULES(channel) : FILL_RULES}

"reply": write it in ${LANG_RULE[lang] || LANG_RULE.auto}. Never put JSON, field names or the form itself in the reply.

"grounding": "documents" if your answer is based on the reference documents above; "general" if the documents do not cover it and you answered from your general knowledge; "none" for ordinary conversation (greetings, thanks, emotional support, a single question about their story).

"updates": fill the protection order form from what the person has told you.
- Write all form text in clear English, because it goes to court, even when the chat is in another language.
- Write in the first person as the complainant ("On 2 October 2026 at about 11pm the respondent..."). Call the other person "the respondent".
- Use ONLY facts the person has actually given. Never invent or guess names, dates, places, numbers, injuries, witnesses or quotes. If they give an approximate time, keep it approximate ("around mid-June 2026"). Leave out anything not known.
- Apply the effective-language principles from the reference documents: exact dates and times, places, concrete actions, threats quoted in the person's own words, frequency, escalation, and the effect on children.
- IMPORTANT: the form is the current official ${FORM_VERSION}. The older "Form 2" section numbers mentioned earlier in these instructions no longer apply; use the field ids below. The same information is still needed.
- For long-text fields, always send the COMPLETE updated text, merging what is already in the current form with the new details.
- Incidents: put the most recent incident in the inc1_* fields and the incident before it (or another serious one) in the inc2_* fields. When a newer incident is told, move the old inc1 details to inc2 or into "history". Put all earlier incidents and the pattern of escalation in "history", in date order, numbered, one short paragraph each.
- Urgency (urg_* fields): answer each official question separately, using only what the person said.
- Tick boxes (Form 6 sections 6 and 7): only fill one when the person has said they want that protection. Set the value to the needed details (an address, the list of weapons, the children's names), or "Requested" when no detail is needed. Send an empty string to untick. For t_a, list the acts from the official list that match the abuse described, for example "Physical abuse, Emotional, verbal or psychological abuse, Threatening behaviour".
- The complainant's address and contact details go in the Form 6A fields (c_id, c_address, c_phone ...), which are not given to the respondent. You may reassure the person of this if they are worried.
- Do not ask about gender, race, disability or marital status; the clerk completes these.
- Send only fields that change in this turn; use an empty array if nothing changes. The person can also edit the form themselves, so treat the current form below as correct.
Field ids:
${FIELD_GUIDE}

"abuse_types": every type of domestic violence under the Act that the person's account so far shows. Send the full list every time.

"sources": the reference documents that shaped this reply or this turn's form wording, each with a plain note of at most 15 words saying what you drew from it. Use an empty array if none did.

"safety": classify ONLY the person's latest message. "immediate_danger" if they are in danger right now (for example, the respondent is there now, or is on his way). "suicidal" if they say they want to die or end their life. "harm_other" if they say they want to kill or seriously hurt someone. "injured_now" if they are hurt right now and need medical help. "death" if someone may be dead. Otherwise "none". Past incidents told as part of their story are "none".

"ready": true once the Conversation Completion criteria above are met.

"language": the language the person's latest message is mainly written in: "en" (English), "zu" (isiZulu), "af" (Afrikaans), or "other".

The person is using ${CHANNEL_RULE[channel] || CHANNEL_RULE.web}

Abuse types recognised so far: ${(abuse || []).join(', ') || 'none yet'}
CURRENT FORM (what is filled so far):
${JSON.stringify(filled)}`;
}

function cleanMessages(messages) {
  return (messages || []).slice(-40)
    .filter(m => m && m.content)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 4000) }));
}

async function callModel(input, instructions) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 50000);
  try {
    const r = await fetch((process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') + '/responses', {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        instructions,
        input,
        store: false,
        ...(/^gpt-4/.test(MODEL) ? { temperature: 0.4 } : {}),
        text: { format: { type: 'json_schema', name: 'informed_turn', strict: true, schema: SCHEMA } },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || r.statusText);
    const text = j.output_text ?? (j.output || []).flatMap(o => o.content || []).map(c => c.text || '').join('');
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

// Returns { reply, updates, abuse_types, sources, safety, ready, fixed, crisis, degraded }
async function turn({ messages, form = {}, abuse = [], lang = 'auto', channel = 'web', mode = 'fill' }) {
  mode = mode === 'ask' ? 'ask' : 'fill';
  const msgs = cleanMessages(messages);
  const last = [...msgs].reverse().find(m => m.role === 'user');

  // Layer 1: GRIT trigger phrases, before any model call.
  const hit = last && checkTriggers(last.content);
  if (hit) {
    return { reply: REPLIES[hit], updates: [], abuse_types: abuse, sources: [], safety: hit, ready: false, fixed: true, crisis: CRISIS.has(hit) };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { reply: 'The server is missing OPENAI_API_KEY.', updates: [], abuse_types: abuse, sources: [], safety: 'none', ready: false, degraded: true };
  }
  try {
    const out = await callModel(msgs, prompt + REFERENCE + runtimeRules({ lang, channel, form, abuse, mode }));
    const updates = (out.updates || []).filter(u => FIELD_IDS.includes(u.field)).map(u => ({ field: u.field, value: String(u.value).slice(0, 8000) }));
    // Layer 2: the model's safety flag replaces its reply with the fixed message.
    if (out.safety && out.safety !== 'none' && REPLIES[out.safety]) {
      return { ...out, updates, reply: REPLIES[out.safety], fixed: true, crisis: CRISIS.has(out.safety) };
    }
    return { ...out, updates: mode === 'ask' ? [] : updates, fixed: false, crisis: false };
  } catch (e) {
    console.error('Model error:', e.message); // never logs what the person wrote
    return { reply: FALLBACK, updates: [], abuse_types: abuse, sources: [], safety: 'none', ready: false, degraded: true };
  }
}

function applyUpdates(form, updates) {
  const f = { ...(form || {}) };
  for (const u of updates || []) f[u.field] = u.value;
  return f;
}

module.exports = { turn, applyUpdates, FALLBACK };
