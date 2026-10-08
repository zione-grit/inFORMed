// Reads a reply aloud (only when the person taps "Listen").
const { speak } = require('../lib/voice');
const { overLimit, ip, codeOk } = require('../lib/guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only.');
  if (!codeOk(req.headers['x-demo-code'])) return res.status(401).send('Wrong or missing access code.');
  if (await overLimit('speak:' + ip(req))) return res.status(429).send('Limit reached.');
  try {
    const { text, lang } = req.body || {};
    if (!text) return res.status(400).send('No text.');
    const buf = await speak(text, lang);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('Speak error:', e.message);
    return res.status(500).send('Could not read this aloud.');
  }
};
