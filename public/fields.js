// Single source of truth for the protection order application.
// It follows the current official form: Form 6 (Application for protection order) and
// Form 6A (Personal information for office use, NOT served on the respondent),
// Domestic Violence Regulations 2023, court form J480, updated 7 March 2025.
// Loaded by the browser (window.INFORMED) and by the server (require).
(function (root) {
  // Friendly sections shown in the form panel.
  const SECTIONS = [
    { n: 1, title: 'About you' },
    { n: 2, title: 'Someone applying for you', optional: true },
    { n: 3, title: 'The person harming you' },
    { n: 4, title: 'Others affected' },
    { n: 5, title: 'What happened', key: true },
    { n: 6, title: 'Why it is urgent', key: true },
    { n: 7, title: 'What the order should stop', key: true },
    { n: 8, title: 'Extra conditions' },
    { n: 9, title: 'Personal property' },
    { n: 10, title: 'Police station, court and documents' },
  ];

  // Sections of the official forms, in order, for the PDF, Word and preview.
  const OFFICIAL = [
    { doc: '6', n: 1, title: 'Particulars of complainant (victim of domestic violence)' },
    { doc: '6', n: 2, title: 'Particulars of person making the application on behalf of the complainant (if applicable)', optional: true },
    { doc: '6', n: 3, title: 'Particulars of person who committed act of domestic violence (respondent)' },
    { doc: '6', n: 4, title: 'Information regarding acts of domestic violence' },
    { doc: '6', n: 5, title: 'Information regarding urgency of application' },
    { doc: '6', n: 6, title: 'Terms of protection order', intro: 'It is requested that the respondent must be ordered:' },
    { doc: '6', n: 7, title: 'Additional conditions', intro: 'It is also requested that the court must order that:' },
    { doc: '6', n: 8, title: 'Personal property', note: 'Furniture such as beds and lounge suites is not personal property.' },
    { doc: '6', n: 9, title: 'Police station' },
    { doc: '6', n: 10, title: 'Court' },
    { doc: '6', n: 11, title: 'Index of annexures to this form' },
    { doc: '6A', n: 1, title: 'Particulars of complainant (victim of domestic violence)', note: 'Gender, race, type of disability (if any) and marital status: to be completed with the clerk.' },
    { doc: '6A', n: 2, title: 'Particulars of person making the application on behalf of the victim (if applicable)', optional: true },
    { doc: '6A', n: 3, title: 'Persons affected by domestic violence' },
  ];

  // s = friendly section, doc/ds = official form and section. type: text | long | check
  const FIELDS = [
    // About you
    { id: 'c_surname', s: 1, doc: '6', ds: 1, label: 'Surname', type: 'text' },
    { id: 'c_names', s: 1, doc: '6', ds: 1, label: 'Full names', type: 'text' },
    { id: 'c_id', s: 1, doc: '6A', ds: 1, label: 'ID number / date of birth', type: 'text' },
    { id: 'c_address', s: 1, doc: '6A', ds: 1, label: 'Home or temporary address', type: 'text' },
    { id: 'c_phone', s: 1, doc: '6A', ds: 1, label: 'Home/contact telephone number, and cell phone number for application updates', type: 'text' },
    { id: 'c_email', s: 1, doc: '6A', ds: 1, label: 'Email address, or other social media account where the court can contact you', type: 'text' },
    { id: 'c_av', s: 1, doc: '6A', ds: 1, label: 'Would you prefer the matter to be heard through an audiovisual link (if available)? Contact for the link', type: 'text' },
    { id: 'c_work_address', s: 1, doc: '6A', ds: 1, label: 'Work address', type: 'text' },
    { id: 'c_work_phone', s: 1, doc: '6A', ds: 1, label: 'Work telephone number', type: 'text' },
    { id: 'c_relationship', s: 1, doc: '6A', ds: 1, label: 'Nature of domestic relationship with the respondent', type: 'text' },
    { id: 'c_occupation', s: 1, doc: '6A', ds: 1, label: 'Occupation (including learner/student)', type: 'text' },

    // Someone applying on the complainant's behalf
    { id: 'tp_names', s: 2, doc: '6', ds: 2, label: 'Surname and full names', type: 'text' },
    { id: 'tp_capacity', s: 2, doc: '6', ds: 2, label: 'Capacity (care giver, counsellor, educator, family member, health care personnel, medical practitioner, social worker, SAPS member, related person, other)', type: 'text' },
    { id: 'tp_contact', s: 2, doc: '6A', ds: 2, label: 'ID number / date of birth, email, work address and telephone, occupation', type: 'long' },
    { id: 'tp_reason', s: 2, doc: '6A', ds: 2, label: 'Reason(s) why the application is made on behalf of the victim', type: 'long' },
    { id: 'tp_consent', s: 2, doc: '6A', ds: 2, label: 'Written consent of the victim (obtained and attached, or why it is not necessary)', type: 'text' },

    // Respondent
    { id: 'r_relationship', s: 3, doc: '6', ds: 3, label: 'Relationship to you (for example boyfriend, ex-husband, father, sister-in-law, co-resident)', type: 'text' },
    { id: 'r_surname', s: 3, doc: '6', ds: 3, label: 'Surname (if known)', type: 'text' },
    { id: 'r_names', s: 3, doc: '6', ds: 3, label: 'Full names, or the name you know them by', type: 'text' },
    { id: 'r_id', s: 3, doc: '6', ds: 3, label: 'ID number / date of birth if known, or estimated age', type: 'text' },
    { id: 'r_address', s: 3, doc: '6', ds: 3, label: 'Home address (if known)', type: 'text' },
    { id: 'r_phone', s: 3, doc: '6', ds: 3, label: 'Home/work/other contact telephone number and cell phone number (if known)', type: 'text' },
    { id: 'r_email', s: 3, doc: '6', ds: 3, label: 'Email address (if known)', type: 'text' },
    { id: 'r_social', s: 3, doc: '6', ds: 3, label: 'Social media platforms, and the name, handle or number on each account (if known)', type: 'text' },
    { id: 'r_work', s: 3, doc: '6', ds: 3, label: 'Work/school/study address (if known)', type: 'text' },
    { id: 'r_occupation', s: 3, doc: '6', ds: 3, label: 'Occupation, including learner/student (if known)', type: 'text' },

    // Persons affected (Form 6A)
    { id: 'p_people', s: 4, doc: '6A', ds: 3, label: '3.1 Children and adults sharing the residence (name, age, relationship to you)', type: 'long' },
    { id: 'p_how', s: 4, doc: '6A', ds: 3, label: '3.2 How are these persons affected?', type: 'long' },
    { id: 'p_disabilities', s: 4, doc: '6A', ds: 3, label: '3.3 Do any of these persons have disabilities? Details', type: 'long' },
    { id: 'p_witnesses', s: 4, doc: '6A', ds: 3, label: 'Name and contact details of any person who witnessed the incident', type: 'long' },

    // Acts of domestic violence
    { id: 'history', s: 5, doc: '6', ds: 4, label: 'History of abuse (earlier incidents and how things have got worse)', type: 'long', key: true },
    { id: 'inc1_date', s: 5, doc: '6', ds: 4, label: 'Most recent incident: date', type: 'text', key: true },
    { id: 'inc1_place', s: 5, doc: '6', ds: 4, label: 'Most recent incident: place where it happened (or social media account details)', type: 'text' },
    { id: 'inc1_details', s: 5, doc: '6', ds: 4, label: 'Most recent incident: details of what happened', type: 'long', key: true },
    { id: 'inc1_injuries', s: 5, doc: '6', ds: 4, label: 'Most recent incident: any injuries (including what was used)', type: 'long' },
    { id: 'inc1_treatment', s: 5, doc: '6', ds: 4, label: 'Most recent incident: medical, psychological or other treatment received', type: 'text' },
    { id: 'inc1_harm', s: 5, doc: '6', ds: 4, label: 'Most recent incident: harm or damages caused', type: 'text' },
    { id: 'inc2_date', s: 5, doc: '6', ds: 4, label: 'Previous incident: date', type: 'text' },
    { id: 'inc2_place', s: 5, doc: '6', ds: 4, label: 'Previous incident: place where it happened', type: 'text' },
    { id: 'inc2_details', s: 5, doc: '6', ds: 4, label: 'Previous incident: details of what happened', type: 'long' },
    { id: 'inc2_injuries', s: 5, doc: '6', ds: 4, label: 'Previous incident: any injuries (including what was used)', type: 'long' },
    { id: 'inc2_treatment', s: 5, doc: '6', ds: 4, label: 'Previous incident: treatment received', type: 'text' },
    { id: 'inc2_harm', s: 5, doc: '6', ds: 4, label: 'Previous incident: harm or damages caused', type: 'text' },
    { id: 'other_info', s: 5, doc: '6', ds: 4, label: 'Other information the court should know', type: 'long' },

    // Urgency
    { id: 'urg_why', s: 6, doc: '6', ds: 5, label: 'Why is the application urgent?', type: 'long', key: true },
    { id: 'urg_today', s: 6, doc: '6', ds: 5, label: 'Any other reasons why you need a protection order today?', type: 'long' },
    { id: 'urg_same_place', s: 6, doc: '6', ds: 5, label: 'Are you still staying in the same place as the respondent?', type: 'text' },
    { id: 'urg_weapons', s: 6, doc: '6', ds: 5, label: 'Are there firearms or other weapons in the house? Details', type: 'long' },
    { id: 'urg_firearm_work', s: 6, doc: '6', ds: 5, label: 'Does the respondent carry or have access to a firearm for work or other activities? Details', type: 'text' },
    { id: 'urg_fear', s: 6, doc: '6', ds: 5, label: 'Do you fear for your life or safety, or that of your children, relatives or others? Details', type: 'long' },
    { id: 'urg_drugs', s: 6, doc: '6', ds: 5, label: 'Does the respondent use drugs, needing referral to a substance abuse treatment centre? Details', type: 'text' },

    // Terms of protection order
    { id: 't_a', s: 7, doc: '6', ds: 6, label: '(a) Not to commit or attempt to commit these acts towards the complainant', type: 'check' },
    { id: 't_b', s: 7, doc: '6', ds: 6, label: '(b) Not to get the help of another person to commit any of these acts', type: 'check' },
    { id: 't_c', s: 7, doc: '6', ds: 6, label: '(c) Not to enter the shared residence, situated at', type: 'check' },
    { id: 't_d', s: 7, doc: '6', ds: 6, label: '(d) Not to enter a specified part of the shared residence, namely', type: 'check' },
    { id: 't_e', s: 7, doc: '6', ds: 6, label: "(e) Not to enter the complainant's residence, situated at", type: 'check' },
    { id: 't_f', s: 7, doc: '6', ds: 6, label: "(f) Not to enter the complainant's workplace or place of studies, namely", type: 'check' },
    { id: 't_g', s: 7, doc: '6', ds: 6, label: '(g) Not to prevent the complainant or any child who lives or lived in the shared residence from entering or remaining in it', type: 'check' },
    { id: 't_h', s: 7, doc: '6', ds: 6, label: '(h) Not to disclose or make available any electronic communication, especially', type: 'check' },
    { id: 't_i', s: 7, doc: '6', ds: 6, label: '(i) Not to commit any other act, namely', type: 'check' },

    // Additional conditions
    { id: 'o_a', s: 8, doc: '6', ds: 7, label: '(a) A peace officer to accompany the complainant to collect personal property', type: 'check' },
    { id: 'o_b', s: 8, doc: '6', ds: 7, label: '(b) A member of SAPS to seize these weapons in the possession of the respondent', type: 'check' },
    { id: 'o_c', s: 8, doc: '6', ds: 7, label: '(c) Respondent to pay interim rent or mortgage payments until the return date', type: 'check' },
    { id: 'o_d', s: 8, doc: '6', ds: 7, label: '(d) Respondent to pay interim maintenance until the return date', type: 'check' },
    { id: 'o_e', s: 8, doc: '6', ds: 7, label: '(e) Respondent to pay interim emergency monetary relief until the return date (food, transport, medical, counselling, school fees, relocation, household bills)', type: 'check' },
    { id: 'o_f', s: 8, doc: '6', ds: 7, label: '(f) Respondent refused any contact with these children until the return date', type: 'check' },
    { id: 'o_g', s: 8, doc: '6', ds: 7, label: '(g) Respondent granted this contact with the children until the return date', type: 'check' },
    { id: 'o_h', s: 8, doc: '6', ds: 7, label: "(h) The complainant's home, study or work details not to be disclosed to the respondent", type: 'check' },
    { id: 'o_i', s: 8, doc: '6', ds: 7, label: '(i) Other conditions requested', type: 'check' },

    // Property, police station, court, annexures
    { id: 'property', s: 9, doc: '6', ds: 8, label: 'Property description, why it is your personal property, and the address where it is kept', type: 'long' },
    { id: 'police_station', s: 10, doc: '6', ds: 9, label: 'I am likely to report a breach of the protection order at this police station', type: 'text' },
    { id: 'court', s: 10, doc: '6', ds: 10, label: 'The court I will be able to attend', type: 'text' },
    { id: 'annexures', s: 10, doc: '6', ds: 11, label: 'Documents I will attach (photos, medical records, screenshots, witness statements)', type: 'long' },
  ];

  // The acts listed in Form 6, section 6(a).
  const ABUSE_TYPES = [
    { id: 'physical', label: 'Physical abuse' },
    { id: 'sexual', label: 'Sexual abuse' },
    { id: 'emotional', label: 'Emotional, verbal or psychological abuse' },
    { id: 'economic', label: 'Economic abuse' },
    { id: 'intimidation', label: 'Intimidation' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'sexual_harassment', label: 'Sexual harassment' },
    { id: 'related_person', label: 'Related person abuse' },
    { id: 'spiritual', label: 'Spiritual abuse' },
    { id: 'property_damage', label: 'Damage to property' },
    { id: 'elder', label: 'Elder abuse' },
    { id: 'coercive', label: 'Coercive behaviour' },
    { id: 'abusive', label: 'Abusive behaviour' },
    { id: 'degrading', label: 'Degrading behaviour' },
    { id: 'controlling', label: 'Controlling behaviour' },
    { id: 'child_exposure', label: 'Exposure of a child to domestic violence' },
    { id: 'intimidating', label: 'Intimidating behaviour' },
    { id: 'threatening', label: 'Threatening behaviour' },
    { id: 'offensive', label: 'Offensive behaviour' },
    { id: 'humiliating', label: 'Humiliating behaviour' },
  ];

  const DOCS = [
    { id: 'form', short: 'Application form (Form 6)' },
    { id: 'language', short: 'Effective language guide' },
    { id: 'rights', short: 'Rights & referral guide' },
    { id: 'magistrates', short: 'What magistrates look for' },
    { id: 'guide', short: 'GRIT protection order guide' },
  ];

  const LANGS = [
    { id: 'auto', label: 'Match my language' },
    { id: 'en', label: 'English' },
    { id: 'zu', label: 'isiZulu' },
    { id: 'af', label: 'Afrikaans' },
  ];

  const FORM_VERSION = 'Form 6 and Form 6A, Domestic Violence Regulations (J480, updated 7 March 2025)';

  const API = { SECTIONS, OFFICIAL, FIELDS, ABUSE_TYPES, DOCS, LANGS, FORM_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.INFORMED = API;
})(typeof window !== 'undefined' ? window : this);
