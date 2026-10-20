// Fills in the real Department of Justice form (Form 6 and 6A, J480E, March 2025) from inFORMed's answers.
// The blank government PDF is in lib/forms. Its own text boxes and tick boxes are used, so the result is the official form.
// Answers too long for a box go on continuation pages ("Annexure B"), placed straight after Form 6
// (and, for Form 6A answers, straight after Form 6A, so the personal details stay separate).
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, PDFName, PDFCheckBox, rgb } = require('pdf-lib');
const { FIELDS, pickOptions, yesNo, FORM_VERSION } = require('../public/fields.js');

const TEMPLATE = path.join(__dirname, 'forms', 'J480E-2025-03.pdf');
const FORM6_PAGES = 9; // pages 1-9 are Form 6, pages 10-12 are Form 6A

// Official tick box for each option (checked against the March 2025 PDF, box by box).
const BOXES = {
  tp_capacity: {
    'Care Giver': 'Check Box1.0.0', 'Counsellor': 'Check Box1.1.0', 'Educator': 'Check Box1.2.0', 'Family Member': 'Check Box1.3.0',
    'Health Care Personnel': 'Check Box1.4.0', 'Medical Practitioner': 'Check Box1.5.0', 'Official In Public Health Establishment': 'Check Box1.0.1',
    'Related Person (Having a close relationship with Complainant)': 'Check Box1.1.1', 'Social Worker': 'Check Box1.2.1',
    'South African Police Service Member': 'Check Box1.3.1', 'Other (specify)': 'Check Box1.4.1',
  },
  r_relationship: {
    'Boyfriend': 'Check Box2.0.0', 'Girlfriend': 'Check Box2.1.0', 'Ex-Boyfriend': 'Check Box2.2.0', 'Ex-Girlfriend': 'Check Box2.3.0',
    'Brother': 'Check Box2.4.0', 'Sister': 'Check Box3.0.0', 'Husband': 'Check Box3.1.0', 'Current co-resident': 'Check Box3.2.0',
    'Ex-Co-resident in the past year': 'Check Box3.3.0', 'Ex-Husband': 'Check Box3.4.0', 'Ex-Wife': 'Check Box3.5.0', 'Ex-Partner': 'Check Box3.6.0',
    'Parent of child/children': 'Check Box2.0.1', 'Mother-In-law': 'Check Box2.1.1', 'Father-In-law': 'Check Box2.2.1', 'Sister-In-law': 'Check Box2.3.1',
    '(Other) -in-law': 'Check Box2.4.1', 'Stepmother': 'Check Box3.0.1', 'Stepfather': 'Check Box3.1.1', 'Stepsister': 'Check Box3.2.1',
    'Stepbrother': 'Check Box3.3.1', 'Wife': 'Check Box3.4.1', 'Daughter': 'Check Box3.8.0', 'Son': 'Check Box3.9.0', 'Father': 'Check Box3.10.0',
    'Mother': 'Check Box3.11.0', 'Intimate/sexual partner of any duration': 'Check Box3.12.0', 'Partner': 'Check Box3.13.0',
    'Partner in perceived relationship': 'Check Box3.14.0.0', 'Partner in alleged marriage': 'Check Box3.5.1.0', 'Ex-Mother-In-law': 'Check Box3.5.1.1',
    'Ex-Father-In-law': 'Check Box3.6.1.0', 'Ex-Sister-In-law': 'Check Box3.6.1.1', '(Other) Ex-In-law': 'Check Box3.7.1',
    'Related by adoption': 'Check Box3.8.1', '(Other) Step': 'Check Box3.13.1.0', 'Aunt': 'Check Box3.14.1', 'Uncle': 'Check Box3.14.0.1',
    'Cousin': 'Check Box3.14.0.2', 'Nephew': 'Check Box3.14.0.3', 'Niece': 'Check Box3.13.1.2', 'Other (specify)': 'Check Box3.13.1.1',
  },
  // 6(a): left column then right column, in the form's own order (the same order as ABUSE_TYPES)
  t_a: {},
};
['Physical abuse', 'Sexual abuse', 'Emotional, verbal or psychological abuse', 'Economic abuse', 'Intimidation', 'Harassment', 'Sexual harassment',
  'Related person abuse', 'Spiritual abuse', 'Damage to property'].forEach((l, i) => { BOXES.t_a[l] = `Check Box4.${i}.0`; });
['Elder abuse', 'Coercive behaviour', 'Abusive behaviour', 'Degrading behaviour', 'Controlling behaviour', 'Exposure of a child to domestic violence',
  'Intimidating behaviour', 'Threatening behaviour', 'Offensive behaviour', 'Humiliating behaviour'].forEach((l, i) => { BOXES.t_a[l] = `Check Box4.${i}.1`; });
const OTHER_TEXT = {
  tp_capacity: { 'Other (specify)': 'Other-p1' },
  r_relationship: { '(Other) -in-law': 'Other Step.1', '(Other) Ex-In-law': 'Other Step.0', '(Other) Step': 'Other.0', 'Other (specify)': 'Other.1.0' },
};
const TERMS = { t_b: 'Check Box4.10.0', t_c: 'Check Box4.11.0', t_d: 'Check Box4.12.0', t_e: 'Check Box4.13.0', t_f: 'Check Box4.14.0', t_g: 'Check Box4.15.0', t_h: 'Check Box4.16.0', t_i: 'Check Box4.10.1' };
// These two government tick boxes are wrongly linked in the PDF: each one appears on page 7 (7(h) Yes / No)
// AND on page 11 (Form 6A consent). They are ticked widget by widget so one never ticks the other.
const LINKED = {
  ohYes: ['Check Box5.0', 7], ohNo: ['Check Box5.1', 7],
  child: ['Check Box5.0', 11], mental: ['Check Box5.1', 11], unconscious: ['Check Box5.2', 11], unable: ['Check Box5.3', 11],
};
const CONSENT = { 'A child who cannot bring the application him/herself': 'child', 'A person with a mental disability': 'mental', 'Unconscious': 'unconscious', 'Unable to provide consent because': 'unable' };

// Text: inFORMed field -> official box (a list = consecutive lines of one answer).
const TEXT = {
  c_surname: { copies: ['Surname', 'Surname_3'] }, c_names: { copies: ['Full names', 'Full names_4'] },
  c_id: 'ID NoDate of birth', c_address: 'Home or temporary address',
  c_phone: 'Cell phone number to which messages can be sent to keep you up to date with the progress of your application',
  c_email: 'Email address', c_av: 'Would you prefer to have the matter heard through audio visual link if available',
  c_work_address: 'Work address', c_work_phone: 'Work telephone number',
  c_relationship: 'Nature of domestic relationship with person who committed the act of domestic violence Respondent', c_occupation: 'Occupation incl learnerstudent',
  tp_names: { copies: ['Full names_2', 'Full names_5'] }, tp_contact: 'ID NoDate of birth_2', tp_reason: 'State reasons why application is made on behalf of the victim',
  r_surname: 'Surname if known', r_names: 'Full names or name known to you by', r_id: 'ID NoDate of birth if known or estimated age',
  r_address: 'Home address if known', r_phone: 'Homework other contact telephone number if known', r_email: 'Email address if known',
  r_social: 'Social media platforms on which the respondent has accounts if known', r_work: 'Workschoolstudy address if known',
  r_occupation: 'Occupation incl learnerstudent if known',
  history: 'Any other information regarding the Respondent that may be relevantassist in identifying or tracing the RespondentRow1', // the PDF's name for the "History of abuse" box
  inc1_date: 'Date', inc1_place: 'Place where it happened If on social media provide social media account details where it took place',
  inc1_details: 'State details of what happened', inc1_injuries: 'Any injuries If yes  provide details including what was used to cause such injuries',
  inc1_treatment: 'Any medical or psychological or other treatment received', inc1_harm: 'Harm or damages caused  give details',
  inc2_place: 'Place where it happened If on social media provide social media account details where it took place_2',
  inc2_details: 'State details of what happened_2', inc2_injuries: 'Any injuries If yes provide details including what was used to cause such injuries',
  inc2_treatment: 'Any medical or psychological or other treatment received_2', inc2_harm: 'Harm or damages caused  give details_2',
  other_info: 'Any other information regarding the acts of domestic violence that you think the court should know ofRow1',
  urg_why: 'Why is the application urgent', urg_today: 'Any other reasons why you need to get a protection order today',
  urg_same_place: 'Are you still staying in the same place as the respondent', urg_weapons: 'Are there firearms or other weapons in the house Give details',
  urg_firearm_work: 'Does the respondent carry  have access to a firearm for work purposes  activities Give details',
  urg_fear: 'Do you fear for your life or safety or the safety of your children or other relatives or people you know Give details',
  urg_drugs: 'Does the respondent make use of drugs necessitating the need for referral to treatment centre for substance abuse Give details',
  t_c: 'Not to enter the shared residence situated at', t_d: 'Not to enter a specified part of the shared residence namely',
  t_e: 'Not to enter the complainants residence situated at', t_f: 'Not to enter the complainants workplace or place of studies namely',
  t_g: ['or remaining in the shared residence or any part thereof to wit 1', 'or remaining in the shared residence or any part thereof to wit 2'],
  t_h: ['J480E 1', 'J480E 2', 'J480E 3', 'J480E 4'],
  t_i: ['Not to commit any other act namely 1', 'Not to commit any other act namely 2', 'Not to commit any other act namely 3', 'Not to commit any other act namely 4'],
  o_a: 'Peace Officer p8', o_b: ['respondent 1', 'respondent 2', 'respondent 3'],
  o_c: ['The respondent is to pay the following rent or mortgage payments 1', 'The respondent is to pay the following rent or mortgage payments 2'],
  o_d: ['The respondent is to pay the following maintenance 1', 'The respondent is to pay the following maintenance 2'],
  o_e: ['fees relocation costs household bills etc 1', 'fees relocation costs household bills etc 2', 'fees relocation costs household bills etc 3'],
  o_f: [1, 2, 3].map(n => 'The respondent is refused any contact with the following child or children ' + n),
  o_g: [1, 2, 3].map(n => 'The respondent is granted the following contact with the abovementioned child or children ' + n),
  o_i: ['Other conditions requested 1', 'Other conditions requested 2', 'Other conditions requested 3', 'Other conditions requested 4', 'J480E 1_2', 'J480E 2_2', 'J480E 3_2'],
  property: 'Property description p9.0', police_station: '9 Breach', court: '10 The court I will be able to attend is',
  p_how: '32 How are these persons affectedRow1', p_disabilities: '33 Do any of these persons suffer disabilities If so give detailsRow1',
  p_witnesses: ['Name and contact details of any persons who witnessed the incident', 'Name and contact details of any persons who witnessed the incident_2'],
};
const ANNEX_A = 'Give short description of Annexure for example statement of witness X CD with photographsA Personal information which may not be served on the respondent';
const ANNEX = ['B', 'C', 'D', 'E'].map(l => 'Give short description of Annexure for example statement of witness X CD with photographs' + l);

function safe(t) {
  return String(t).replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, '');
}
function wrap(text, font, size, width) {
  const out = [];
  for (const para of safe(text).split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) <= width) line = test;
      else { if (line) out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

async function fillOfficial(formData) {
  const v = id => String((formData && formData[id]) || '').trim();
  const pdf = await PDFDocument.load(fs.readFileSync(TEMPLATE));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const form = pdf.getForm();
  const pages = pdf.getPages();
  const pageNo = new Map(pages.map((p, i) => [p.ref.toString(), i + 1]));
  // A few government boxes are stored upside down, which makes their text invisible; straighten them first.
  form.getFields().forEach(f => f.acroField.getWidgets().forEach(w => {
    const r = w.getRectangle();
    if (r.width < 0 || r.height < 0) w.setRectangle({ x: Math.min(r.x, r.x + r.width), y: Math.min(r.y, r.y + r.height), width: Math.abs(r.width), height: Math.abs(r.height) });
  }));
  const cont = { '6': [], '6A': [] };          // answers moved to continuation pages
  const label = id => (FIELDS.find(f => f.id === id) || {}).label || id;
  const docOf = id => (FIELDS.find(f => f.id === id) || {}).doc || '6';

  function tick(name) { const f = form.getFieldMaybe ? form.getFieldMaybe(name) : form.getField(name); if (f && f instanceof PDFCheckBox) f.check(); }
  const drawn = []; // linked boxes: the tick is drawn straight onto the page, at that one box only
  function tickWidget([name, page]) {
    form.getField(name).acroField.getWidgets().forEach(w => { if (pageNo.get(String(w.P())) === page) drawn.push([page, w.getRectangle()]); });
  }
  function boxSize(name) { const w = form.getTextField(name).acroField.getWidgets()[0].getRectangle(); return { w: Math.abs(w.width) - 4, h: Math.abs(w.height) - 2 }; } // some boxes are stored upside down
  // Put text in one box, shrinking a little if needed; otherwise move it to the continuation pages.
  function put(id, names, text) {
    names = [].concat(names); if (!text) return;
    const ref = () => `See continuation, Annexure B (${label(id).replace(/\s*\(.*$/, '')}).`;
    if (names.length > 1) { // several one-line boxes for one answer
      for (const size of [9, 8]) {
        const lines = wrap(text, font, size, boxSize(names[0]).w);
        if (lines.length <= names.length) { names.forEach((n, i) => set(n, lines[i] || '', size)); return; }
      }
      cont[docOf(id)].push([label(id), text]); set(names[0], ref(), 8); return;
    }
    const { w, h } = boxSize(names[0]);
    for (const size of [9, 8, 7]) {
      const lines = wrap(text, font, size, w);
      if (lines.length * size * 1.18 <= h) { set(names[0], lines.join('\n'), size, lines.length > 1); return; }
    }
    cont[docOf(id)].push([label(id), text]); set(names[0], ref(), 7, true);
  }
  function set(name, text, size, multi) {
    const f = form.getTextField(name);
    if (multi || String(text).includes('\n')) f.enableMultiline();
    f.setText(safe(text));
    try { f.setFontSize(size); } catch (e) { f.acroField.setDefaultAppearance(`/Helv ${size} Tf 0 g`); } // some government boxes have no font setting
  }

  // tick lists
  for (const id of ['tp_capacity', 'r_relationship']) {
    const { on, detail } = pickOptions(id, v(id));
    on.forEach(l => { if (BOXES[id][l]) tick(BOXES[id][l]); const t = OTHER_TEXT[id] && OTHER_TEXT[id][l]; if (t && detail[l]) put(id, t, detail[l]); });
  }
  if (v('t_a')) pickOptions('t_a', v('t_a')).on.forEach(l => BOXES.t_a[l] && tick(BOXES.t_a[l]));
  for (const id in TERMS) if (v(id)) tick(TERMS[id]);
  const oh = yesNo(v('o_h')); if (oh) tickWidget(oh === 'Yes' ? LINKED.ohYes : LINKED.ohNo);
  const consent = pickOptions('tp_consent', v('tp_consent'));
  consent.on.forEach(l => { if (CONSENT[l]) tickWidget(LINKED[CONSENT[l]]); });
  if (consent.detail['Unable to provide consent because']) put('tp_consent', ['unable to provide consent because 1', 'unable to provide consent because 2', 'unable to provide consent because 3'], consent.detail['Unable to provide consent because']);

  // text answers
  for (const id in TEXT) {
    let text = v(id);
    if (!text) continue;
    if (/^[to]_/.test(id) && /^requested$/i.test(text)) { if (id === 'o_a') text = 'a member of the South African Police Service'; else continue; }
    if (id === 'inc2_place' && v('inc2_date')) text = 'Date: ' + v('inc2_date') + '. ' + text; // the form has no date box for the second incident
    if (TEXT[id].copies) TEXT[id].copies.forEach(n => put(id, n, text)); else put(id, TEXT[id], text);
  }
  if (v('inc2_date') && !v('inc2_place')) put('inc2_place', TEXT.inc2_place, 'Date: ' + v('inc2_date'));
  // 3.1 people sharing the residence: one per line, "name; age; relationship"
  const people = v('p_people').split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (people.length) {
    if (people.length <= 7) people.forEach((l, i) => { const [n, a, r] = l.split(/\s*[;|]\s*/); put('p_people', `NameRow${i + 1}`, n || l); if (a) put('p_people', `AgeRow${i + 1}`, a); if (r) put('p_people', `Relationship to complainantRow${i + 1}`, r); });
    else { cont['6A'].push([label('p_people'), v('p_people')]); set('NameRow1', 'See continuation after Form 6A.', 8); }
  }

  // 11. Index of annexures: A is Form 6A itself; B is the continuation (if any); then the person's documents
  const annexes = [];
  if (cont['6'].length || cont['6A'].length) annexes.push('Continuation of answers that did not fit on this form (prepared with inFORMed)');
  if (consent.on.has('Written consent has been obtained and is attached')) annexes.push('Written consent of the victim');
  v('annexures').split(/\n+|;\s*/).map(s => s.replace(/^\s*[-\d.)]+\s*/, '').trim()).filter(Boolean).forEach(a => annexes.push(a));
  put('annexures', ANNEX_A, 'Form 6A: Personal information (not for service on the respondent)');
  annexes.slice(0, 4).forEach((a, i) => put('annexures', ANNEX[i], a));
  if (annexes.length > 4) cont['6'].push(['Further annexures', annexes.slice(4).join('\n')]);

  form.updateFieldAppearances(font);
  form.flatten();
  for (const [page, r] of drawn) {
    const pg = pages[page - 1], cx = r.x + r.width / 2, cy = r.y + r.height / 2, d = Math.min(r.width, r.height) * 0.3;
    pg.drawLine({ start: { x: cx - d, y: cy - d }, end: { x: cx + d, y: cy + d }, thickness: 1.2 });
    pg.drawLine({ start: { x: cx - d, y: cy + d }, end: { x: cx + d, y: cy - d }, thickness: 1.2 });
  }
  // Remove anything interactive that is left (the certificate boxes and the linked tick boxes), so the file is a clean printable form.
  pages.forEach(p => { if (p.node.get(PDFName.of('Annots'))) p.node.delete(PDFName.of('Annots')); });
  if (pdf.catalog.get(PDFName.of('AcroForm'))) pdf.catalog.delete(PDFName.of('AcroForm'));

  // continuation pages
  const W = 595.28, H = 841.89, M = 50;
  function addCont(items, at, title) {
    if (!items.length) return 0;
    let page, y, added = 0;
    const np = () => { page = pdf.insertPage(at + added, [W, H]); added++; y = H - M;
      page.drawText(safe(title), { x: M, y: y - 12, size: 12, font: bold }); y -= 22;
      wrap('Continuation of answers to the application for a protection order (' + FORM_VERSION + '), prepared with inFORMed.', font, 8.5, W - 2 * M).forEach(l => { page.drawText(l, { x: M, y: y - 9, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) }); y -= 11; }); y -= 13; };
    np();
    for (const [lab, text] of items) {
      const lines = wrap(text, font, 10, W - 2 * M);
      if (y < M + 60) np();
      page.drawText(safe(lab), { x: M, y: y - 10, size: 10, font: bold }); y -= 16;
      for (const l of lines) { if (y < M + 20) np(); page.drawText(l, { x: M, y: y - 10, size: 10, font }); y -= 13.5; }
      y -= 10;
    }
    return added;
  }
  const a6 = addCont(cont['6'], FORM6_PAGES, 'ANNEXURE B: CONTINUATION OF FORM 6');
  addCont(cont['6A'], pdf.getPageCount(), 'CONTINUATION OF FORM 6A: PERSONAL INFORMATION - NOT FOR SERVICE ON RESPONDENT');
  void a6;
  // Copy into a fresh file so no leftover form objects remain (some PDF readers warn about them otherwise).
  const out = await PDFDocument.create();
  (await out.copyPages(pdf, pdf.getPageIndices())).forEach(p => out.addPage(p));
  out.setTitle('Protection order application (Form 6 and 6A)');
  out.setProducer('inFORMed by GRIT');
  return Buffer.from(await out.save());
}

module.exports = { fillOfficial, BOXES, TEXT };
