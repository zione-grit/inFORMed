# inFORMed (demo prototype)

Trauma-informed protection order assistant. Powered by GRIT (Gender Rights in Tech).

Two ways to use it, on every channel:

- **Ask a question** (default): explains protection orders, the court process and legal words. Answers come from GRIT's documents first. If they don't cover a question, the AI answers from general knowledge and the reply is clearly labelled "General information, not from GRIT's guides".
- **Fill in my form**: the original inFORMed flow, with the original opening, one gentle question at a time, and the Generate Protection Order button.

People can type or speak: a microphone on the website, and voice notes on Telegram and WhatsApp. Replies can be read aloud with **Listen**, or every time if the person turns on **Read aloud**. Nothing plays by itself unless they choose that, so nobody nearby hears unexpectedly.

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
api/translate.js       translates the form for "Hear my form" in isiZulu or Afrikaans (listening only)
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

- `LIMIT_PER_HOUR` (default 150): messages one person can send in an hour (by internet address on the website, by chat on Telegram and WhatsApp).
- `LIMIT_PER_DAY` (default 3000): messages across everyone per day. When it is reached, the bot says so and still gives the emergency numbers. Listening (read aloud) and voice recordings have their own separate limits and do not count as messages.
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
5. Open your bot in Telegram (https://t.me/inFORMed_grit_bot) and send `/start` (and the access code, if you set one). The website does not link to the bot at the moment (see "Home page" below).

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

## The form

The draft follows the current official application: **Form 6** (Application for protection order) and **Form 6A** (Personal information for office use, not served on the respondent), Domestic Violence Regulations 2022 (published 14 April 2023), court form J480 as updated on 7 March 2025: https://www.justice.gov.za/forms/dva/dv-Form06-J480.pdf

GRIT's original reference document and system prompt describe the older "Form 2" from the 1999 regulations, which were repealed. The model is told to use the Form 6/6A fields, and the reference document in `lib/knowledge.js` now describes Form 6/6A. Re-check the form on the Justice website before going live, because it can change again.

## Keeping the form

- The chat is never saved.
- The form is kept in the open browser tab (sessionStorage), so a reload or a dropped connection loses nothing. Closing the tab, Quick exit or Start over clears it.
- "Save to finish later" locks the form with a PIN the person chooses (AES-GCM encryption, key derived with PBKDF2) and keeps it on that device only (localStorage). It is never sent to the server. "Continue a saved application" on the home page is always shown, so it does not reveal whether anything is saved. A forgotten PIN cannot be recovered.

## Visual design

The look follows Shamryn Brittan's GRIT design concept (October 2026): GRIT navy and blue, Hanken Grotesk, the paper-slip inFORMed wordmark, and paper-style form panel and dialogs. All the working features underneath are unchanged.

The design's images are in `public/img/` (Shamryn's files, compressed for the web): `bg-blue.webp` and `bg-blue-tall.webp` (page background on wide and tall screens), `about-grit.webp` (About GRIT photo), `community.webp` (first Good to know card), `grit-logo-blue.webp` and `logo-paper.webp` (logos). To replace a picture, put a new file in with the same name and push.

Direct-to-form link: `https://informedgrit.vercel.app/form` opens straight into "Help me fill in my form".

## Home page and voice

- **The form comes first.** The main button is "Start my form". "Ask a question" is lower down, under "Want to learn more before you start?".
- **WhatsApp:** the header shows a WhatsApp button that says "WhatsApp: coming soon". The website no longer links to Telegram (the Telegram bot still works for anyone who already has it). When the WhatsApp channel is live, change the button in `public/index.html` (`id="waBtn"`) into a link to the WhatsApp number.
- **For people who find reading hard:**
  - "Listen: how this works" on the home page reads a short spoken guide (`guideAudio` in `public/i18n.js`).
  - The main actions have pictures as well as words.
  - In the chat, the microphone is the big button whenever the message box is empty, like sending a voice note.
  - A sound meter moves while someone speaks, so they can see the phone is hearing them.
- **Speaking instead of typing** works the same way everywhere, like a voice note:
  - Tap the microphone to start and tap it again to stop. It never stops on silence, because people often pause while telling a painful story.
  - There is a 3-minute safety limit. The timer turns orange at 2½ minutes. At 3 minutes it stops and keeps the words, and the person can record more.
  - Nothing is ever sent by itself. The words appear in the box with "Is this what you said?" and three buttons: **Hear it** (reads the words back, for people who cannot read them), **Say it again** and **Send**. People who can read can also correct the words by typing.
  - The AI is told when a message was spoken. It then gently repeats important details back ("Did I hear correctly that this happened on Friday 2 October?"), because names, dates and places are the words speech recognition gets wrong most. It also checks weapons (a misheard "gun" or "knife") and children, because both change how urgent the case is. This also applies to voice notes on Telegram and WhatsApp.
- **Hear my form** (next to every Preview form button, and in the preview) reads the whole application aloud: every filled-in section, with its heading. The application is sworn evidence, and what the person says in court must match it, so people who cannot read need to know exactly what they are swearing to. In English it reads the exact words. In isiZulu or Afrikaans it first says that the form itself stays in English, then reads a faithful translation (made by `api/translate.js`, for listening only, limited to 40 per hour per internet address). The PDF and Word drafts are never translated.
- **Read aloud** (switch at the top of the chat, off by default) does only one thing: it reads every answer out loud by itself. When it is off, nothing plays unless someone taps Listen.
- **Faster listening:** long answers are read in pieces. The first piece is short, so it starts quickly, and the next piece loads while the one before is playing. Each piece counts towards the listening limit, which is now 600 per hour per internet address.

## Page languages

Choosing isiZulu or Afrikaans switches all the page text: home page, buttons, chat messages, dialogs and help numbers. "Match my language" starts in the phone's language (if it is isiZulu or Afrikaans), and switches after the person's first message, in the language they wrote in. The form itself (form panel fields, preview, PDF and Word) stays in English, because it is filled in English for the court. This is enforced in code, not only asked of the AI: when the conversation is not in English, every form update goes through a separate translation step (`ensureEnglish` in `lib/engine.js`) before it reaches the form, and anything typed into the form panel in another language is translated when the PDF or Word draft is made. Words someone said are kept in English with the original words in brackets. The scripted demo and the fixed safety replies are also still in English.

All interface text is in `public/i18n.js`. The isiZulu and Afrikaans text is a **draft** and must be checked by GRIT's native speakers. To correct a line, change the text after the colon and keep the key before it. No other code needs to change.

## Sources (developer view)

Users do not see which document each answer came from. To see it, open the site with `?sources` at the end of the address (for example `https://YOUR-SITE.vercel.app/?sources`). The "Based on" labels and a "Sources (developer view)" button then appear for that browser tab. For Telegram and WhatsApp, set `SHOW_SOURCES=1` in Vercel. The "General information, not from GRIT's guides" label stays visible to everyone, because it tells people to check that answer with the court clerk.

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
