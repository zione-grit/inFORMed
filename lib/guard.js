// Optional access code, and message limits shared across all Vercel instances.
// Limits use Upstash Redis when it is connected; without it they fall back to
// per-instance memory, which is only a rough brake.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const PER_HOUR = Number(process.env.LIMIT_PER_HOUR || 40);  // messages per person (IP or chat) per hour
const PER_DAY = Number(process.env.LIMIT_PER_DAY || 600);   // messages across everyone per day

const mem = new Map();
function memCount(key, ttlMs) {
  const now = Date.now();
  const e = mem.get(key);
  if (!e || e.until < now) { mem.set(key, { n: 1, until: now + ttlMs }); return 1; }
  e.n += 1; return e.n;
}
async function count(key, ttlSec) {
  if (!URL_) return memCount(key, ttlSec * 1000);
  try {
    const r = await fetch(URL_ + '/pipeline', {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(ttlSec), 'NX']]),
    });
    const j = await r.json();
    return Number(j[0].result);
  } catch (e) {
    console.error('Limit store error:', e.message);
    return memCount(key, ttlSec * 1000);
  }
}

// Returns null when allowed, or a reason: 'person' or 'everyone'.
async function overLimit(who) {
  const hour = Math.floor(Date.now() / 3600000), day = Math.floor(Date.now() / 86400000);
  const mine = await count(`lim:h:${hour}:${who}`, 3700);
  if (mine > PER_HOUR) return 'person';
  const all = await count(`lim:d:${day}`, 90000);
  if (all > PER_DAY) return 'everyone';
  return null;
}

const LIMIT_REPLY = {
  person: "You've sent a lot of messages in a short time, so I need to pause for a little while. Please come back in an hour. If you are in danger, call the police on 10111 or the GBV Command Centre on 0800 428 428 (free, 24 hours).",
  everyone: "This demo has reached its limit for today. Please try again tomorrow. If you are in danger, call the police on 10111 or the GBV Command Centre on 0800 428 428 (free, 24 hours).",
};

function ip(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'; }
// The access code is optional: leave DEMO_PASSCODE empty in Vercel to open the link to anyone.
function codeOk(given) { const pass = process.env.DEMO_PASSCODE || ''; return !pass || String(given || '').trim() === pass; }
function codeRequired() { return !!process.env.DEMO_PASSCODE; }

module.exports = { overLimit, LIMIT_REPLY, ip, codeOk, codeRequired };
