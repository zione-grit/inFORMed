// Builds the PDF or Word draft from the form the browser sends. Nothing is stored.
const { toPdf, toDocx } = require('../lib/render');
const { ensureEnglish } = require('../lib/engine');
const { overLimit, ip } = require('../lib/guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only.');
  try {
    let { form = {}, abuse = [], format = 'pdf', demo = false } = req.body || {};
    // The person may have typed into the form panel in another language: make sure the court draft is English.
    if (process.env.OPENAI_API_KEY) {
      const items = Object.entries(form).filter(([, v]) => String(v || '').trim()).map(([field, value]) => ({ field, value: String(value) }));
      const fixed = await ensureEnglish(items, null, null);
      if (fixed !== items) { form = { ...form }; for (const u of fixed) form[u.field] = u.value; }
    }
    const isWord = format === 'docx';
    const buf = isWord ? await toDocx(form, abuse, { demo }) : await toPdf(form, abuse, { demo });
    res.setHeader('Content-Type', isWord ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protection-order-draft.${isWord ? 'docx' : 'pdf'}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('Document error:', e.message);
    return res.status(500).send('Could not build the document.');
  }
};
