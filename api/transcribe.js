// Turns a voice recording into text. The audio is sent to OpenAI and not kept.
const { transcribe } = require('../lib/voice');
const { overLimit, LIMIT_REPLY, ip, codeOk } = require('../lib/guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  if (!codeOk(req.headers['x-demo-code'])) return res.status(401).json({ error: 'Wrong or missing access code.' });
  const over = await overLimit('web:' + ip(req));
  if (over) return res.status(429).json({ error: LIMIT_REPLY[over] });
  try {
    const { audio, mime, lang } = req.body || {};
    if (!audio) return res.status(400).json({ error: 'No audio.' });
    const buf = Buffer.from(String(audio), 'base64');
    if (buf.length > 3.2 * 1024 * 1024) return res.status(413).json({ error: 'That recording is too long. Please keep it under about three minutes.' });
    const text = await transcribe(buf, mime, lang);
    return res.status(200).json({ text });
  } catch (e) {
    console.error('Transcribe error:', e.message);
    return res.status(200).json({ error: 'Sorry, I could not hear that clearly. Please try again, or type your message.' });
  }
};
