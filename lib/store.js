// Conversation state for Telegram and WhatsApp (the website keeps state in the browser).
// Uses Upstash Redis over REST when configured (Vercel Marketplace > Upstash adds the env vars).
// Without it, falls back to memory, which is lost whenever Vercel starts a new instance.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TTL = Number(process.env.CHAT_TTL_HOURS || 24) * 3600; // chats are deleted automatically after this
const mem = new Map();

async function cmd(args) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(args) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

async function get(key) {
  if (!URL_) return mem.get(key) || null;
  const v = await cmd(['GET', key]);
  return v ? JSON.parse(v) : null;
}
async function set(key, value) {
  if (!URL_) { mem.set(key, value); return; }
  await cmd(['SET', key, JSON.stringify(value), 'EX', String(TTL)]);
}
async function del(key) {
  if (!URL_) { mem.delete(key); return; }
  await cmd(['DEL', key]);
}
// Returns true the first time an id is seen (webhooks can be delivered twice).
async function firstTime(id) {
  if (!URL_) { if (mem.has('seen:' + id)) return false; mem.set('seen:' + id, 1); return true; }
  const r = await cmd(['SET', 'seen:' + id, '1', 'NX', 'EX', '3600']);
  return r === 'OK';
}
module.exports = { get, set, del, firstTime, persistent: !!URL_ };
