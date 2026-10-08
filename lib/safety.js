// Fixed safety replies. These are sent word for word and never written by the model.
// Two layers: (1) GRIT's trigger phrases, checked before the model is called;
// (2) the model's own safety flag, which catches other wording and other languages.

const KWANELE = 'Android - https://play.google.com/store/apps/details?id=com.ads.apps.kwanele or iOS - https://apps.apple.com/us/app/kwanele/id1616602924';

const REPLIES = {
  suicidal: "I am so sorry that you are feeling suicidal, but I am really glad you felt you could talk about it. I am not a human and so I might not be able to support you in a way that captures the nuance of what you are going through. Here is a number to SADAG. You don't need airtime to call and a person can support you 24/7. Their number is 0800 567 567. You can also look at their website: https://www.sadag.org",
  goodbye: "If you ever have more questions, please come back and ask. I'm here to help whenever you need. Goodbye for now!",
  tracking: 'I do not give your information to anyone. In this demo, our chat is not saved after you close it.',
  harm_other: 'You must be really hurting to be feeling this way. I am a chatbot, so I don\'t always know how to understand human emotions. The GRIT team knows all about working with difficult and painful feelings. Please WhatsApp them on 072 737 8819.',
  death: `I'm a chatbot, and this sounds like a human emergency. If you have time to plan how to get out of danger, ask me about a safety plan. If this is an emergency and you need help right now, call the ambulance on 10177 or the police on 10111. These numbers are free so you don't need airtime. You can also download the GRIT app which will connect you to help using this link: ${KWANELE}.`,
  injured_now: "I'm a chatbot, and this sounds like a human emergency. If you have time to plan how to get out of danger, ask me about a safety plan. If this is an emergency and you need help right now, call the ambulance on 10177 or the police on 10111. These numbers are free so you don't need airtime.",
  rape: 'No one deserves to go through what you are going through, it is not your fault. How can I help?',
  immediate_danger: `I'm a chatbot, and this sounds like a human emergency. If you have time to plan how to get out of danger, ask me about a safety plan. If this is an emergency and you need help right now, call the ambulance on 10177 or the police on 10111. These numbers are free so you don't need airtime. You can also download the GRIT app which will connect you to help using this link: ${KWANELE}.`,
};

// GRIT's trigger list (from the system prompt), checked as phrases.
const TRIGGERS = [
  { kind: 'suicidal', phrases: ['suicide', 'suicidal', 'i want to die'] },
  { kind: 'tracking', phrases: ['our conversation being tracked', 'this conversation being tracked', 'tracking conversation', 'conversation tracked', 'tracking this conversation', 'tracking our conversation'] },
  { kind: 'harm_other', phrases: ['i want to kill him', 'i want to kill her', 'i want to murder him', 'i want to murder her'] },
  { kind: 'death', phrases: ['she is dead', 'he is dead', 'is she dead', 'is he dead'] },
  { kind: 'injured_now', phrases: ['i am injured'] },
  { kind: 'rape', phrases: ['he raped me', 'she raped me'] },
  { kind: 'immediate_danger', phrases: ['i am in danger'] },
  { kind: 'goodbye', phrases: ['goodbye'] },
];

// Kinds that are crisis cards (shown with call buttons) rather than ordinary replies.
const CRISIS = new Set(['suicidal', 'harm_other', 'death', 'injured_now', 'immediate_danger']);

function norm(t) {
  return ' ' + String(t || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
}

function checkTriggers(text) {
  const t = norm(text);
  for (const g of TRIGGERS) {
    for (const p of g.phrases) if (t.includes(' ' + p + ' ')) return g.kind;
  }
  return null;
}

module.exports = { REPLIES, CRISIS, checkTriggers };
