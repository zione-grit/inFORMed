# inFORMed (demo prototype)

Trauma-informed protection order assistant. Powered by GRIT (Gender Rights in Tech).

Two ways to use it, on every channel:

- **Ask a question** (default): explains protection orders, the court process and legal words. Answers come from GRIT's documents first. If they don't cover a question, the AI answers from general knowledge and the reply is clearly labelled "General information, not from GRIT's guides".
- **Fill in my form**: the original inFORMed flow, with the original opening, one gentle question at a time, and the Generate Protection Order button.

People can type or speak: a microphone on the website, and voice notes on Telegram and WhatsApp. Replies can be read aloud with **Listen**. This only happens when tapped, never automatically, so nobody nearby hears unexpectedly.

One Vercel project runs three channels:

| Channel | Chat | Live form panel | PDF / Word | Sources view | Demo mode |
|---|---|---|---|---|---|
| Website | yes | yes, fills in as you talk, editable | yes (buttons) | yes (drawer + "Based on" chips) | yes (scripted, no AI calls) |
| Telegram | yes | `/form` shows it as text | yes (`/pdf`, `/word`, sent as a file) | "Based on" line under replies | no |
| WhatsApp | yes | `FORM` shows it as text | yes (`PDF`, `WORD`, sent as a file) | "Based on" line under replies | no |

## Files

```
public/index.html      the website (home page, chat, form panel, demo, sources)
public/fields.js       the form definition, shared by the website and the server
public/docs.json       the four reference documents, for the sources view
public/grit-logo.png   GRIT logo (colour), used on light backgrounds
public/grit-logo-white.png  GRIT logo (white), used in dark mode and on the teal card
lib/logo.js            small copy of the logo inside the PDF and Word drafts
api/chat.js            website chat endpoint
api/document.js        builds the PDF or Word draft
api/telegram.js        Telegram webhook
api/setup-telegram.js  one-time Telegram connection
api/whatsapp.js        WhatsApp Cloud API webhook
api/transcribe.js      voice to text (website microphone)
api/speak.js           read a reply aloud (Listen button)
lib/knowledge.js       system prompt (v8.14), the four documents, and GRIT's protection order guide (Zuzi KB LEGAL-01)
lib/openings.js        opening messages (the fill opening is the original, word for word)
lib/voice.js           OpenAI speech to text and text to speech
lib/engine.js          one turn: safety check, model call, structured result
lib/safety.js          fixed safety replies (GRIT's trigger list)
lib/render.js          PDF, Word and text versions of the form
lib/bot.js             shared Telegram/WhatsApp conversation logic
lib/store.js           chat state for Telegram/WhatsApp (Upstash Redis)
```

## 1. Website (do this first)

1. Upload this folder to a new **private** GitHub repository. Do not put keys in any file.
2. Vercel: **Add New → Project**, import the repository, keep the default settings, **Deploy**.
3. **Settings → Environment Variables**, add:
   - `OPENAI_API_KEY`: a separate key with a monthly spend limit, not the Zuzi key
   - `DEMO_PASSCODE` (optional): leave it out to let anyone with the link use it. Add it only if you want an access code.
4. **Deployments → ⋯ → Redeploy**.
5. Open the link. Try **Watch a demo** first (it needs no key), then **Start talking**.

Optional: `MODEL` (default `gpt-4.1`), `TRANSCRIBE_MODEL` (default `gpt-4o-transcribe`), `TTS_MODEL` (default `gpt-4o-mini-tts`), `TTS_VOICE` (default `sage`).

### Limits (when there is no access code)

- `LIMIT_PER_HOUR` (default 40): messages one person can send in an hour (by internet address on the website, by chat on Telegram and WhatsApp).
- `LIMIT_PER_DAY` (default 600): messages across everyone per day. When it is reached, the bot says so and still gives the emergency numbers.
- Connect **Upstash Redis** (see Telegram step 2) so these limits are shared across all of Vercel's servers. Without it, each server counts on its own and the limits are only rough.
- Also set a **monthly budget limit** on the OpenAI key (platform.openai.com → Settings → Limits). That is the final safety net for cost.

## 2. Telegram (about 10 minutes)

1. In Telegram, message **@BotFather**, send `/newbot`, choose a name (e.g. *inFORMed by GRIT*) and a username ending in `bot`. Copy the token.
2. Vercel: add the **Upstash Redis** integration (Storage tab, or Marketplace → Upstash → Redis, free plan) and connect it to this project. It adds the connection variables automatically. Without it, the bot forgets conversations between messages.
3. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`: the token from BotFather
   - `TELEGRAM_WEBHOOK_SECRET`: any random string of letters and numbers
4. Redeploy, then open once in your browser:
   `https://YOUR-SITE.vercel.app/api/setup-telegram?code=YOUR_TELEGRAM_WEBHOOK_SECRET`
5. Open your bot in Telegram and send `/start` (and the access code, if you set one).

## 3. WhatsApp (about 30 to 45 minutes, needs a Meta developer account)

**About using your own number:** a number connected to the WhatsApp Cloud API stops working in the normal WhatsApp app. For the demo, use Meta's **free test number** instead. It can message up to five phone numbers you verify, and yours can be one of them.

1. Go to developers.facebook.com → **My Apps → Create App** → type **Business** → add the **WhatsApp** product.
2. In **WhatsApp → API Setup**: note the **Phone number ID** of the test number, and add your own number (and anyone else on the call) under **To**. Each one gets a code to verify.
3. Make a **permanent token**. The token on the API Setup page expires after 24 hours, so do not use it for the call. Go to business.facebook.com → **Settings → Users → System users** → add a system user (Admin) → **Add assets** → your app → **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Vercel environment variables:
   - `WHATSAPP_TOKEN`: the permanent token
   - `WHATSAPP_PHONE_NUMBER_ID`: from step 2
   - `WHATSAPP_VERIFY_TOKEN`: any random string you choose
   Upstash Redis must be connected (see Telegram step 2). Redeploy.
5. Meta app → **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://YOUR-SITE.vercel.app/api/whatsapp`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`
   - Then **Manage** webhook fields and subscribe to **messages**.
6. From your verified phone, send "hi" to the test number. It asks for your language (and the access code first, if you set one).

Words the WhatsApp bot understands: `ASK`, `FILL`, `FORM`, `PDF`, `WORD`, `LANGUAGE`, `DELETE`, `HELP`. Telegram uses the same as commands (`/ask`, `/fill`, ...). Voice notes work on both.

## Safety design

- GRIT's trigger phrases are checked **before** the model is called, and answered word for word.
- The model also flags danger in any wording or language (`safety` field). When it does, its reply is **replaced** by the same fixed message. The model never writes a crisis reply.
- Crisis replies on the website show tap-to-call buttons (10111, 10177, GBV Command Centre).
- **Quick exit** button on every page: clears the page and goes to a weather search.
- Website conversations live only in the open browser tab. Nothing is saved on the server, and OpenAI is called with `store: false`.
- Telegram and WhatsApp keep the conversation in Redis for 24 hours (`CHAT_TTL_HOURS`), and `DELETE` / `/delete` removes it immediately.
- The model never logs what people write; only error messages are logged.

## Changes from GRIT's v8.14 system prompt

- The "is this conversation tracked" reply said the chat is used to train the bot. That is not true for this build (`store: false`), so it now says the chat is not saved after it is closed. Please confirm the wording with GRIT.
- A short block was added at the end telling the model how to return the form fields, the sources it used and a safety flag, and how to behave in Ask mode (plain answers, labelled general-knowledge fallback, keep the conversation going). The original prompt is otherwise unchanged.
- GRIT's approved protection order guide (Zuzi KB LEGAL-01) was added as a fifth source, mainly for Ask mode.

## Before real users (not needed for the demo)

- Voice: test isiZulu speech recognition and read-aloud with native speakers. They are passed as hints, and quality for isiZulu is not yet known. Afrikaans and English are supported directly.
- isiZulu and Afrikaans replies are written by the model. Native speakers at GRIT should review them, and the fixed safety replies need GRIT-approved translations (currently sent in English).
- Safeguarding sign-off on the crisis replies and flow.
- Verify Meta's webhook signature (`X-Hub-Signature-256`) against the raw request body.
- A shared rate limit (the current one is per server instance) and a POPIA review of the 24-hour bot storage.
- Brand colours are taken from the GRIT logo (navy, teal, indigo). Change the tokens at the top of `public/index.html` if GRIT has official colour codes.
- Using conversations to improve the bot needs survivors' informed opt-in consent, POPIA compliance and GRIT's written authorisation and safeguarding sign-off. This build saves nothing for training.
