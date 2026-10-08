// Speech to text and text to speech through OpenAI. Audio is never stored.
const BASE = () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const STT_MODEL = process.env.TRANSCRIBE_MODEL || 'gpt-4o-transcribe';
const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.TTS_VOICE || 'sage';

const HINT = {
  zu: 'The speaker is South African and may speak isiZulu, or mix isiZulu and English.',
  af: 'The speaker is South African and may speak Afrikaans, or mix Afrikaans and English.',
  en: 'The speaker is South African and speaks English, possibly mixed with other South African languages.',
  auto: 'The speaker is South African and may speak English or another South African language, or mix them.',
};

function ext(mime) {
  if (/ogg|opus/.test(mime)) return 'ogg';
  if (/mp4|m4a|aac/.test(mime)) return 'm4a';
  if (/mpeg|mp3/.test(mime)) return 'mp3';
  if (/wav/.test(mime)) return 'wav';
  return 'webm';
}

async function transcribe(buf, mime = 'audio/webm', lang = 'auto') {
  const fd = new FormData();
  const type = String(mime).split(';')[0];
  fd.append('file', new Blob([buf], { type }), 'voice.' + ext(type));
  fd.append('model', STT_MODEL);
  // Language codes are only passed where support is known; isiZulu is auto-detected with a hint.
  if (lang === 'af' || lang === 'en') fd.append('language', lang);
  fd.append('prompt', HINT[lang] || HINT.auto);
  const r = await fetch(BASE() + '/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.statusText);
  return String(j.text || '').trim();
}

async function speak(text, lang = 'auto') {
  const r = await fetch(BASE() + '/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: TTS_MODEL, voice: TTS_VOICE, response_format: 'mp3',
      input: String(text).slice(0, 3000),
      instructions: 'Speak warmly, calmly and a little slowly, like a caring South African community member. Gentle, never rushed.' + (lang === 'zu' ? ' The text is in isiZulu.' : lang === 'af' ? ' The text is in Afrikaans.' : ''),
    }),
  });
  if (!r.ok) throw new Error('TTS ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

module.exports = { transcribe, speak };
