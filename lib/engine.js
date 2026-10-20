// One conversational turn: safety check, model call, structured result.
// Shared by the website (api/chat.js), Telegram and WhatsApp.
const { prompt, docs } = require('./knowledge');
const { FIELDS, ABUSE_TYPES, DOCS, FORM_VERSION, OPTIONS } = require('../public/fields.js');
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
        properties: { field: { type: 'string', enum: FIELD_IDS }, value: { type: 'string', description: 'Form text. ALWAYS in English, whatever language the chat is in.' } },
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
  return FIELDS.map(f => `${f.id} = Form ${f.doc} section ${f.ds}: ${f.label}${f.type === 'check' ? ' [tick box]' : f.type === 'long' ? ' [long text]' : ''}`
    + (OPTIONS[f.id] ? `\n   Official tick list for ${f.id} (use these names exactly, separated by "; "): ${OPTIONS[f.id].map(o => o.label + (o.other ? ': <their words>' : '')).join(' | ')}` : '')).join('\n');
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
- ALWAYS write every form value in clear English, because it goes to court. This applies even when your reply is in isiZulu, Afrikaans or any other language: translate what the person said into English for the form. Your reply follows the chat language; the form never does.
- Write in the first person as the complainant ("On 2 October 2026 at about 11pm the respondent..."). Call the other person "the respondent".
- Use ONLY facts the person has actually given. Never invent or guess names, dates, places, numbers, injuries, witnesses or quotes. If they give an approximate time, keep it approximate ("around mid-June 2026"). Leave out anything not known.
- Apply the effective-language principles from the reference documents: exact dates and times, places, concrete actions, threats quoted in the person's own words, frequency, escalation, and the effect on children.
- IMPORTANT: the form is the current official ${FORM_VERSION}. The older "Form 2" section numbers mentioned earlier in these instructions no longer apply; use the field ids below. The same information is still needed.
- For long-text fields, always send the COMPLETE updated text, merging what is already in the current form with the new details.
- Incidents: put the most recent incident in the inc1_* fields and the incident before it (or another serious one) in the inc2_* fields. When a newer incident is told, move the old inc1 details to inc2 or into "history". Put all earlier incidents and the pattern of escalation in "history", in date order, numbered, one short paragraph each.
- Urgency (urg_* fields): answer each official question separately, using only what the person said.
- Tick boxes (Form 6 section 6 "Terms of protection order", fields t_a to t_i, and section 7 "Additional conditions", fields o_a to o_i): these are the protections the person asks the court for, and an application without them asks for nothing. You must ASK about them; do not wait for the person to bring them up.
  - When: once the main story is told (the most recent incident and the urgency questions), and before you treat the conversation as complete. Ask gently, in plain words, ONE protection per message (GRIT's one-question rule still applies), and only about the ones that fit their story. Never read out the legal list.
  - Always ask first whether they want the court to order the respondent to stop the abuse, and not to get anyone else to do it for him. If they say yes, or they have already said they want the abuse to stop or want protection, tick t_a and t_b. For t_a, set the value to the acts from the official list that match the abuse described, for example "Physical abuse; Emotional, verbal or psychological abuse; Threatening behaviour".
  - Then ask only where it fits: staying away from the home they share (t_c, with the address) or part of it (t_d); from their own home (t_e, address) or their work, school or place of study (t_f, name and address); not stopping them or their children from getting into the home (t_g); not sharing their photos, videos or messages (t_h); anything else they want stopped (t_i). If they mentioned a weapon or firearm, ask whether they want the police to take it away (o_b, list the weapons). Ask whether they need a police officer to go with them to fetch their belongings (o_a), and whether they need help with rent or bond payments (o_c), maintenance (o_d) or emergency money for food, transport or medical costs (o_e). If children are involved, ask about the respondent's contact with them (o_f refused contact, or o_g contact on stated terms, with the children's names). Ask whether their home, work or school address should be kept from the respondent (o_h). Other conditions go in o_i.
  - If the person clearly says they want one of these at any point ("I want him to stop coming to my work"), tick it straight away without asking again.
  - Set each value to the needed details (an address, the list of weapons, the children's names), or "Requested" when no detail is needed. Send an empty string to untick if they change their mind.
  - For t_a, write the acts using the official names from the t_a tick list, separated by "; ", and only acts the person has actually described. Each name you write ticks that box on the official form, so never add one they did not describe.
  - o_h (keep their home, work or study details from the respondent): write "Yes" or "No" only once the person has answered. Leave it empty if they have not.
- Official tick lists (r_relationship, tp_capacity, tp_consent and t_a): each name you write ticks that box on the real government form. Use the exact names from the list, separated by "; ", and tick only what the person's own words clearly support. For example "my baby daddy" is "Parent of child/children", and "we used to date" is "Ex-Boyfriend" or "Ex-Girlfriend"; add "Current co-resident" only if they said they live together. More than one may apply (for example "Ex-Boyfriend; Parent of child/children"). If a relationship is not listed, use the matching "Other" option with their words after a colon, for example "(Other) -in-law: brother-in-law" or "Other (specify): the man my mother stays with". If you are not sure which applies, ask one gentle question instead of guessing. Do not put the relationship in other words in r_relationship; c_relationship (Form 6A) is where it is described in a sentence.
- p_people (Form 6A 3.1): one person per line, written as "name; age; relationship to you", for example "Thabo; 4; son".
  - "ready" must stay false until you have asked about these protections and at least t_a is ticked or the person has said they do not want it.
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

async function callModel(input, instructions, schema = SCHEMA, name = 'informed_turn', temperature = 0.4) {
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
        ...(/^gpt-4/.test(MODEL) ? { temperature } : {}),
        text: { format: { type: 'json_schema', name, strict: true, schema } },
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

// The form must always be in English. When the conversation is not in English, every form
// update goes through a separate translation step before it reaches the form.
const EN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['updates'],
  properties: { updates: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['field', 'value'],
    properties: { field: { type: 'string', enum: FIELD_IDS }, value: { type: 'string' } } } } },
};
const EN_RULES = `You prepare text for a South African court form (protection order application, Form 6 and 6A).
You receive a JSON list of form fields. Return the same list with every value in clear, plain English.
- If a value is already in English, return it unchanged.
- Translate isiZulu, Afrikaans or any other language into English faithfully. Do not add, remove, soften or strengthen any fact.
- Keep names of people and places, addresses, dates, times, numbers, ID numbers and phone numbers exactly as they are.
- Keep the first-person voice ("I", "me") and keep calling the other person "the respondent".
- For words someone said (threats, insults), give the English translation in quotation marks followed by the original words in brackets, for example: "I will kill you" (original words: "Ngizokubulala").
- Keep the same field ids and the same order. Never leave a field out.`;
function looksEnglish(text) {
  const t = ' ' + String(text).toLowerCase().replace(/[^a-z' ]+/g, ' ') + ' ';
  const en = (t.match(/ (the|and|i|me|my|he|she|was|to|of|in|on|at|a|it|with|not|for|is|have|has|respondent) /g) || []).length;
  const words = t.split(/\s+/).filter(Boolean).length || 1;
  return en / words > 0.12;
}
async function ensureEnglish(updates, convLang, uiLang) {
  if (!updates.length) return updates;
  const nonEnglishChat = (convLang && convLang !== 'en') || (uiLang && uiLang !== 'en' && uiLang !== 'auto');
  const suspect = updates.some(u => u.value && u.value.trim().split(/\s+/).length >= 4 && !looksEnglish(u.value));
  if (!nonEnglishChat && !suspect) return updates;
  try {
    const out = await callModel([{ role: 'user', content: JSON.stringify(updates) }], EN_RULES, EN_SCHEMA, 'english_form_text', 0);
    const fixed = (out.updates || []).filter(u => FIELD_IDS.includes(u.field));
    if (fixed.length !== updates.length) return updates;
    return fixed.map(u => ({ field: u.field, value: String(u.value).slice(0, 8000) }));
  } catch (e) {
    console.error('English step error:', e.message);
    return updates;
  }
}

// Returns { reply, updates, abuse_types, sources, safety, ready, fixed, crisis, degraded }
// Spoken messages are turned into text automatically, so names, dates, places and numbers can be misheard.
const VOICE_RULE = `

SPOKEN MESSAGE: the person's latest message was spoken and turned into text automatically. Some words may be wrong, especially names, dates, times, places, addresses, ID and phone numbers, weapons (for example gun, knife, panga) and children (how many, their names, whether they were there or hurt). The person may not be able to read well, so do not ask them to check the text. If the message gives an important detail of that kind, or a word seems out of place, gently say it back in your reply and ask if it is right (for example: "Did I hear correctly that this happened on Friday 2 October?"). Confirm at most two details per reply, and only details that matter for the form or the answer. If what they said does not make sense, kindly ask them to say it again.`;

async function turn({ messages, form = {}, abuse = [], lang = 'auto', channel = 'web', mode = 'fill', voice = false }) {
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
    const out = await callModel(msgs, prompt + REFERENCE + runtimeRules({ lang, channel, form, abuse, mode }) + (voice ? VOICE_RULE : ''));
    let updates = (out.updates || []).filter(u => FIELD_IDS.includes(u.field)).map(u => ({ field: u.field, value: String(u.value).slice(0, 8000) }));
    if (mode === 'fill') updates = await ensureEnglish(updates, out.language, lang);
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

// "Hear my form" in isiZulu or Afrikaans: a faithful translation, only so the person understands what they will swear to.
// The form itself always stays in English.
const TR_LANG = { zu: 'isiZulu', af: 'Afrikaans' };
const TR_SCHEMA = { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } };
async function translateForListening(text, lang) {
  const name = TR_LANG[lang]; if (!name) return String(text);
  const rules = `Translate this draft South African protection order application from English into ${name}, so the applicant can hear and understand exactly what it says before swearing to it. Translate faithfully and completely. Do not add, remove, soften, explain or summarise anything. Keep people's names, dates, times, addresses, phone and ID numbers exactly as written. Write it as plain sentences that sound natural when read aloud. Return only the translation in "text".`;
  const out = await callModel([{ role: 'user', content: String(text).slice(0, 20000) }], rules, TR_SCHEMA, 'listen_translation', 0.2);
  return String(out.text || '');
}

module.exports = { turn, applyUpdates, ensureEnglish, translateForListening, FALLBACK };
