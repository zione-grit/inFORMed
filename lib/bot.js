// Channel-neutral conversation logic for Telegram and WhatsApp.
// Returns a list of things to send: { text, buttons? } or { doc: 'pdf' | 'docx' }.
const { turn, applyUpdates } = require('./engine');
const { toText } = require('./render');
const { DOCS } = require('../public/fields.js');
const store = require('./store');
const { codeOk, overLimit, LIMIT_REPLY } = require('./guard');
const { FILL_OPENING, ASK_OPENING } = require('./openings');

const LANG_BUTTONS = ['English', 'isiZulu', 'Afrikaans'];
const LANG_IDS = { english: 'en', isizulu: 'zu', afrikaans: 'af' };
const MODE_BUTTONS = ['Ask a question', 'Fill in my form'];

function c(channel) {
  return channel === 'telegram'
    ? { ask: '/ask', fill: '/fill', form: '/form', pdf: '/pdf', word: '/word', lang: '/language', del: '/delete' }
    : { ask: 'ASK', fill: 'FILL', form: 'FORM', pdf: 'PDF', word: 'WORD', lang: 'LANGUAGE', del: 'DELETE' };
}

function help(channel) {
  const k = c(channel);
  return `You can type or send a voice note at any time. You can also send:\n${k.ask} to ask about protection orders and legal words\n${k.fill} to get help filling in your application\n${k.form} to see your application so far\n${k.pdf} or ${k.word} to get it as a document\n${k.lang} to change language\n${k.del} to delete this conversation\n\nIf you are in danger right now, call the police on 10111 or the GBV Command Centre on 0800 428 428 (free, 24 hours).`;
}

function command(text, channel) {
  const t = String(text || '').trim().toLowerCase().replace(/@\w+$/, '');
  if (t === 'ask a question') return 'ask';
  if (t === 'fill in my form') return 'fill';
  const map = channel === 'telegram'
    ? { '/start': 'start', '/ask': 'ask', '/fill': 'fill', '/form': 'form', '/pdf': 'pdf', '/word': 'docx', '/language': 'language', '/delete': 'delete', '/help': 'help' }
    : { start: 'start', ask: 'ask', fill: 'fill', form: 'form', pdf: 'pdf', word: 'docx', language: 'language', delete: 'delete', help: 'help' };
  return map[t] || null;
}

function opening(mode, channel) {
  return mode === 'fill' ? FILL_OPENING + '\n\nWhenever you’re ready, can you tell me a little about what brings you here today? You can type, or send a voice note.'
    : ASK_OPENING + `\n\nYou can type, or send a voice note. When you want help with your application, send ${c(channel).fill}.`;
}

// voice: true when the text came from a voice note (we show what we heard, so they can correct it)
async function handle({ channel, userKey, text, msgId, voice = false }) {
  if (msgId && !(await store.firstTime(channel + ':' + msgId))) return [];
  const key = `chat:${channel}:${userKey}`;
  let s = (await store.get(key)) || { authed: !process.env.DEMO_PASSCODE, lang: 'auto', mode: null, messages: [], form: {}, abuse: [] };
  const cmd = voice ? null : command(text, channel);

  if (cmd === 'delete') {
    await store.del(key);
    return [{ text: 'Done. This conversation and your draft application have been deleted from inFORMed. You can start again any time.' }];
  }

  if (!s.authed) {
    if (!voice && codeOk(text)) {
      s.authed = true; s.started = true;
      await store.set(key, s);
      return [{ text: 'Thank you. Which language would you like to use?', buttons: LANG_BUTTONS }];
    }
    await store.set(key, s);
    return [{ text: 'Welcome to inFORMed, powered by GRIT (Gender Rights in Tech). This is a demo. Please send the access code you were given.' }];
  }

  const langPick = voice ? null : LANG_IDS[String(text || '').trim().toLowerCase()];
  if (langPick) {
    s.lang = langPick; s.started = true;
    await store.set(key, s);
    if (!s.mode) return [{ text: 'Thank you. What would you like to do?', buttons: MODE_BUTTONS }];
    return [{ text: `Okay, I will reply in ${text.trim()} from now on.` }];
  }

  if (cmd === 'start' || !s.started) {
    s = { ...s, started: true, mode: null, messages: [], form: {}, abuse: [] };
    await store.set(key, s);
    return [{ text: 'Welcome to inFORMed, your protection order support assistant, powered by GRIT (Gender Rights in Tech). Which language would you like to use?', buttons: LANG_BUTTONS }];
  }
  if (cmd === 'ask' || cmd === 'fill') {
    s.mode = cmd;
    const o = opening(cmd, channel);
    s.messages.push({ role: 'assistant', content: o });
    await store.set(key, s);
    return [{ text: o }];
  }
  if (cmd === 'language') return [{ text: 'Which language would you like to use?', buttons: LANG_BUTTONS }];
  if (cmd === 'help') return [{ text: help(channel) }];
  if (cmd === 'form') return [{ text: toText(s.form, s.abuse).slice(0, 3900) }];
  if (cmd === 'pdf' || cmd === 'docx') {
    if (!Object.values(s.form).some(Boolean)) return [{ text: `Your application is still empty. Send ${c(channel).fill} and tell me what happened, and I will fill it in as we talk.` }];
    return [{ text: 'Here is your draft. Take it to the clerk at any Magistrates’ Court. Applying is free, and you do not need a lawyer or a police case.' }, { doc: cmd }];
  }

  const over = await overLimit(channel + ':' + userKey);
  if (over) return [{ text: LIMIT_REPLY[over] }];
  if (!s.mode) { s.mode = 'ask'; s.messages.push({ role: 'assistant', content: ASK_OPENING }); }
  s.messages.push({ role: 'user', content: String(text).slice(0, 4000) });
  const r = await turn({ messages: s.messages, form: s.form, abuse: s.abuse, lang: s.lang, channel, mode: s.mode });
  s.form = applyUpdates(s.form, r.updates);
  if (Array.isArray(r.abuse_types) && s.mode === 'fill') s.abuse = r.abuse_types;
  s.messages.push({ role: 'assistant', content: r.reply });
  s.messages = s.messages.slice(-40);
  await store.set(key, s);

  let reply = r.reply;
  if (!r.fixed) {
    const names = [...new Set((r.sources || []).map(x => (DOCS.find(d => d.id === x.doc) || {}).short).filter(Boolean))];
    if (r.grounding === 'general') reply += '\n\n— General information, not from GRIT’s guides. Please check with the court clerk.';
    else if (names.length && process.env.SHOW_SOURCES === '1') reply += `\n\n— Based on: ${names.join(', ')}`; // developer setting
  }
  const out = [];
  if (voice) out.push({ text: `\u{1F399} I heard: “${String(text).slice(0, 600)}”` });
  out.push({ text: reply });
  return out;
}

module.exports = { handle, help };
