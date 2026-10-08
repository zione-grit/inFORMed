// Builds the PDF or Word draft from the form the browser sends. Nothing is stored.
const { toPdf, toDocx } = require('../lib/render');
const { overLimit, ip } = require('../lib/guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST only.');
  try {
    const { form = {}, abuse = [], format = 'pdf', demo = false } = req.body || {};
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
