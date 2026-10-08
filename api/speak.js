// Reads a reply aloud (only when the person taps "Listen").
// GET /api/speak?t=<base64url text>&l=<lang>  — streams MP3 so playback starts quickly.
const { speakStream } = require('../lib/voice');
const { overLimit, ip, codeOk } = require('../lib/guard');

function fromB64url(s) {
  return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const text = req.method === 'GET' ? fromB64url(q.t) : (req.body || {}).text;
  const lang = req.method === 'GET' ? q.l : (req.body || {}).lang;
  const code = req.method === 'GET' ? q.c : req.headers['x-demo-code'];
  if (!codeOk(code)) return res.status(401).send('Wrong or missing access code.');
  if (!text) return res.status(400).send('No text.');
  // Listening has its own, generous limit and does not count towards the message limits.
  if (await overLimit('speak:' + ip(req), { perHour: 300, global: false })) return res.status(429).send('Limit reached.');
  try {
    const upstream = await speakStream(text, lang);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (e) {
    console.error('Speak error:', e.message);
    if (!res.headersSent) return res.status(500).send('Could not read this aloud.');
    return res.end();
  }
};
