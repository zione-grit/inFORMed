// Open https://YOUR-SITE.vercel.app/api/setup-telegram?code=YOUR_TELEGRAM_WEBHOOK_SECRET once to connect the bot.
module.exports = async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send('Add TELEGRAM_WEBHOOK_SECRET in Vercel first, then redeploy.');
  if (req.query.code !== secret) return res.status(401).send('Add ?code=YOUR_TELEGRAM_WEBHOOK_SECRET to the address.');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).send('Add TELEGRAM_BOT_TOKEN in Vercel first, then redeploy.');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const body = { url: `https://${host}/api/telegram`, allowed_updates: ['message'], drop_pending_updates: true };
  body.secret_token = secret;
  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commands: [
    { command: 'start', description: 'Start again' }, { command: 'ask', description: 'Ask about protection orders' }, { command: 'fill', description: 'Help me fill in my form' }, { command: 'form', description: 'See your application so far' },
    { command: 'pdf', description: 'Get your application as a PDF' }, { command: 'word', description: 'Get your application as a Word document' },
    { command: 'language', description: 'Change language' }, { command: 'delete', description: 'Delete this conversation' }, { command: 'help', description: 'Help and emergency numbers' },
  ] }) });
  res.status(j.ok ? 200 : 500).send(j.ok ? `Telegram is connected to ${body.url}. Open your bot in Telegram and send /start.` : 'Telegram said: ' + j.description);
};
