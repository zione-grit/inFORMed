// WhatsApp Cloud API webhook (Meta). See README for setup with Meta's free test number.
const { waitUntil } = require('@vercel/functions');
const { handle } = require('../lib/bot');
const { toPdf, toDocx } = require('../lib/render');
const store = require('../lib/store');
const { transcribe } = require('../lib/voice');

const GRAPH = 'https://graph.facebook.com/v21.0';
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const auth = () => ({ Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` });

async function wa(body) {
  const r = await fetch(`${GRAPH}/${PHONE_ID()}/messages`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', ...body }) });
  if (!r.ok) console.error('WhatsApp error:', r.status, (await r.text()).slice(0, 300));
}

async function sendText(to, text, buttons) {
  if (buttons && buttons.length <= 3) {
    return wa({ to, type: 'interactive', interactive: { type: 'button', body: { text: text.slice(0, 1024) }, action: { buttons: buttons.map((b, i) => ({ type: 'reply', reply: { id: 'b' + i, title: b } })) } } });
  }
  return wa({ to, type: 'text', text: { body: text.slice(0, 4096), preview_url: false } });
}

async function sendDoc(to, format, s) {
  const isWord = format === 'docx';
  const mime = isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
  const name = `protection-order-draft.${isWord ? 'docx' : 'pdf'}`;
  const buf = isWord ? await toDocx(s.form, s.abuse) : await toPdf(s.form, s.abuse);
  const fd = new FormData();
  fd.append('messaging_product', 'whatsapp');
  fd.append('type', mime);
  fd.append('file', new Blob([buf], { type: mime }), name);
  const up = await fetch(`${GRAPH}/${PHONE_ID()}/media`, { method: 'POST', headers: auth(), body: fd });
  const j = await up.json();
  if (!j.id) { console.error('WhatsApp upload failed'); return sendText(to, 'Sorry, I could not send the document just now. Please try again.'); }
  return wa({ to, type: 'document', document: { id: j.id, filename: name } });
}

async function process_(body) {
  const changes = (body.entry || []).flatMap(e => e.changes || []);
  for (const c of changes) {
    for (const m of (c.value && c.value.messages) || []) {
      const from = m.from;
      const text = m.type === 'text' ? m.text.body
        : m.type === 'interactive' ? (m.interactive.button_reply || m.interactive.list_reply || {}).title
        : m.type === 'button' ? m.button.text : null;
      let body = text, voice = false;
      if (!body && m.type === 'audio' && m.audio && m.audio.id) {
        try {
          const meta = await (await fetch(`${GRAPH}/${m.audio.id}`, { headers: auth() })).json();
          const bin = await fetch(meta.url, { headers: auth() });
          const st = await store.get(`chat:whatsapp:${from}`);
          body = await transcribe(Buffer.from(await bin.arrayBuffer()), meta.mime_type || m.audio.mime_type || 'audio/ogg', (st && st.lang) || 'auto');
          voice = true;
        } catch (e) { console.error('WhatsApp voice error:', e.message); }
        if (!body) { await sendText(from, 'Sorry, I could not hear that voice note clearly. Please try again, or type your message.'); continue; }
      }
      if (!body) { await sendText(from, 'I can read text messages and voice notes. Please type, or send a voice note.'); continue; }
      const actions = await handle({ channel: 'whatsapp', userKey: from, text: body, voice, msgId: m.id });
      for (const a of actions) {
        if (a.doc) await sendDoc(from, a.doc, await store.get(`chat:whatsapp:${from}`));
        else await sendText(from, a.text, a.buttons);
      }
    }
  }
}

// Production TODO: verify Meta's X-Hub-Signature-256 against the raw request body.

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && q['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(q['hub.challenge']);
    return res.status(403).send('Verification failed');
  }
  if (req.method !== 'POST') return res.status(405).send('POST only');
  if (!process.env.WHATSAPP_TOKEN || !PHONE_ID()) return res.status(200).send('not configured');
  waitUntil(process_(req.body || {}).catch(e => console.error('WhatsApp handler error:', e.message)));
  return res.status(200).send('ok');
};
