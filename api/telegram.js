// Telegram webhook. Set up once with /api/setup-telegram (see README).
const { waitUntil } = require('@vercel/functions');
const { handle } = require('../lib/bot');
const { toPdf, toDocx } = require('../lib/render');
const store = require('../lib/store');
const { transcribe } = require('../lib/voice');

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function tg(method, body) {
  const r = await fetch(`${API()}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) console.error('Telegram error:', method, j.description);
  return j;
}

async function sendDoc(chatId, format, s) {
  const isWord = format === 'docx';
  const buf = isWord ? await toDocx(s.form, s.abuse) : await toPdf(s.form, s.abuse);
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('document', new Blob([buf], { type: isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf' }), `protection-order-draft.${isWord ? 'docx' : 'pdf'}`);
  await fetch(`${API()}/sendDocument`, { method: 'POST', body: fd });
}

async function process_(update) {
  const m = update.message;
  if (!m || !m.chat || m.chat.type !== 'private') return;
  const chatId = m.chat.id;
  let text = m.text, voice = false;
  const audio = m.voice || m.audio;
  if (!text && audio) {
    await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
    try {
      const f = await tg('getFile', { file_id: audio.file_id });
      const r = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${f.result.file_path}`);
      const s0 = await store.get(`chat:telegram:${chatId}`);
      text = await transcribe(Buffer.from(await r.arrayBuffer()), audio.mime_type || 'audio/ogg', (s0 && s0.lang) || 'auto');
      voice = true;
    } catch (e) { console.error('Telegram voice error:', e.message); }
    if (!text) return tg('sendMessage', { chat_id: chatId, text: 'Sorry, I could not hear that voice note clearly. Please try again, or type your message.' });
  }
  if (!text) return tg('sendMessage', { chat_id: chatId, text: 'I can read text messages and voice notes. Please type, or send a voice note.' });
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const actions = await handle({ channel: 'telegram', userKey: String(chatId), text, voice, msgId: update.update_id });
  for (const a of actions) {
    if (a.doc) {
      await tg('sendChatAction', { chat_id: chatId, action: 'upload_document' });
      const s = await store.get(`chat:telegram:${chatId}`);
      await sendDoc(chatId, a.doc, s);
    } else {
      const markup = a.buttons
        ? { keyboard: [a.buttons.map(b => ({ text: b }))], resize_keyboard: true, one_time_keyboard: true }
        : { remove_keyboard: true };
      await tg('sendMessage', { chat_id: chatId, text: a.text, reply_markup: markup, disable_web_page_preview: true });
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('inFORMed Telegram webhook is running.');
  if (!process.env.TELEGRAM_BOT_TOKEN) return res.status(500).send('Missing TELEGRAM_BOT_TOKEN');
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) return res.status(401).send('Bad secret');
  // Answer Telegram at once, keep working in the background.
  waitUntil(process_(req.body || {}).catch(e => console.error('Telegram handler error:', e.message)));
  return res.status(200).json({ ok: true });
};
