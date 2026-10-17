// Translates the form so it can be read aloud in isiZulu or Afrikaans ("Hear my form").
// Only for listening: the form and the PDF/Word drafts stay in English. Nothing is stored.
const { translateForListening } = require('../lib/engine');
const { overLimit, ip, codeOk } = require('../lib/guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  if (!codeOk(req.headers['x-demo-code'])) return res.status(401).json({ error: 'Wrong or missing access code.' });
  const { text, lang } = req.body || {};
  if (!text || !['zu', 'af'].includes(lang)) return res.status(400).json({ error: 'Nothing to translate.' });
  if (await overLimit('translate:' + ip(req), { perHour: 40, global: false })) return res.status(429).json({ error: 'Limit reached.' });
  try {
    return res.status(200).json({ text: await translateForListening(text, lang) });
  } catch (e) {
    console.error('Translate error:', e.message); // never logs the form
    return res.status(500).json({ error: 'Could not translate.' });
  }
};
