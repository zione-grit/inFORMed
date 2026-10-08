// Single source of truth for the protection order form (Form 2, s4(1) Domestic Violence Act 116 of 1998).
// Loaded by the browser (window.INFORMED) and by the server (require).
(function (root) {
  const SECTIONS = [
    { n: 1, title: 'About you', formTitle: 'Particulars of complainant' },
    { n: 2, title: 'Someone applying for you', formTitle: 'Person applying on behalf of the complainant (if applicable)', optional: true },
    { n: 3, title: 'The person harming you', formTitle: 'Particulars of respondent' },
    { n: 4, title: 'Others affected', formTitle: 'Persons affected by domestic violence' },
    { n: 5, title: 'What happened', formTitle: 'Information regarding acts of domestic violence', key: true },
    { n: 6, title: 'Why it is urgent', formTitle: 'Information regarding urgency of application', key: true },
    { n: 7, title: 'What the order should stop', formTitle: 'Terms of protection order', key: true },
    { n: 8, title: 'Extra conditions', formTitle: 'Additional conditions' },
    { n: 9, title: 'Personal property', formTitle: 'Personal property' },
    { n: 10, title: 'Police station', formTitle: 'Police station reporting' },
  ];

  // type: text (short), long (narrative), check (tick box with optional details)
  const FIELDS = [
    { id: 'c_surname', s: 1, label: 'Surname', type: 'text' },
    { id: 'c_names', s: 1, label: 'Full names', type: 'text' },
    { id: 'c_id', s: 1, label: 'ID number / date of birth', type: 'text' },
    { id: 'c_address', s: 1, label: 'Home or temporary address', type: 'text' },
    { id: 'c_phone', s: 1, label: 'Contact number', type: 'text' },
    { id: 'c_work_address', s: 1, label: 'Work address', type: 'text' },
    { id: 'c_work_phone', s: 1, label: 'Work telephone number', type: 'text' },
    { id: 'c_relationship', s: 1, label: 'Relationship with the respondent', type: 'text' },
    { id: 'c_occupation', s: 1, label: 'Occupation', type: 'text' },

    { id: 'tp_details', s: 2, label: 'Name, contact details, relationship, and why they apply for you', type: 'long' },

    { id: 'r_surname', s: 3, label: 'Surname', type: 'text' },
    { id: 'r_names', s: 3, label: 'Full names', type: 'text' },
    { id: 'r_id', s: 3, label: 'ID number / date of birth', type: 'text' },
    { id: 'r_address', s: 3, label: 'Home address', type: 'text' },
    { id: 'r_phone', s: 3, label: 'Contact number', type: 'text' },
    { id: 'r_work_address', s: 3, label: 'Work address', type: 'text' },
    { id: 'r_work_phone', s: 3, label: 'Work telephone number', type: 'text' },
    { id: 'r_occupation', s: 3, label: 'Occupation', type: 'text' },

    { id: 'p_people', s: 4, label: '4.1 Children and adults sharing the home (name, age, relationship)', type: 'long' },
    { id: 'p_how', s: 4, label: '4.2 How these persons are affected', type: 'long' },
    { id: 'p_disabilities', s: 4, label: '4.3 Disabilities, if any', type: 'long' },

    { id: 'acts', s: 5, label: 'Full details of all incidents', type: 'long', key: true },
    { id: 'weapons', s: 5, label: 'Firearms or dangerous weapons used or threatened', type: 'long' },
    { id: 'injuries', s: 5, label: 'Injuries and medical treatment', type: 'long' },

    { id: 'urgency', s: 6, label: 'Why the court must deal with this urgently', type: 'long', key: true },

    { id: 't_a', s: 7, label: '(a) Not to commit any act of domestic violence', type: 'check' },
    { id: 't_b', s: 7, label: '(b) Not to get the help of another person to commit any act of domestic violence', type: 'check' },
    { id: 't_c', s: 7, label: '(c) Not to enter the shared residence, situated at', type: 'check' },
    { id: 't_d', s: 7, label: '(d) Not to enter a specified part of the shared residence, namely', type: 'check' },
    { id: 't_e', s: 7, label: "(e) Not to enter the complainant's residence, situated at", type: 'check' },
    { id: 't_f', s: 7, label: "(f) Not to enter the complainant's place of employment, namely", type: 'check' },
    { id: 't_g', s: 7, label: '(g) Not to prevent the complainant or any child from entering or remaining in the shared residence', type: 'check' },
    { id: 't_h', s: 7, label: '(h) Not to commit any other act, namely', type: 'check' },

    { id: 'o_a', s: 8, label: '(a) A peace officer to accompany the complainant to collect personal property', type: 'check' },
    { id: 'o_b', s: 8, label: '(b) SAPS to seize these arms or dangerous weapons', type: 'check' },
    { id: 'o_c', s: 8, label: '(c) Respondent to pay rent or mortgage', type: 'check' },
    { id: 'o_d', s: 8, label: '(d) Respondent to pay emergency monetary relief', type: 'check' },
    { id: 'o_e', s: 8, label: '(e) Respondent refused contact with these children', type: 'check' },
    { id: 'o_f', s: 8, label: '(f) Respondent granted this contact with the children', type: 'check' },
    { id: 'o_g', s: 8, label: "(g) The complainant's physical address not to be disclosed to the respondent", type: 'check' },
    { id: 'o_i', s: 8, label: '(i) Other conditions requested', type: 'check' },

    { id: 'property', s: 9, label: 'Property, why it is yours, and where it is kept', type: 'long' },

    { id: 'police_station', s: 10, label: 'I am likely to report a breach at this police station', type: 'text' },
  ];

  const ABUSE_TYPES = [
    { id: 'physical', label: 'Physical' },
    { id: 'sexual', label: 'Sexual' },
    { id: 'emotional', label: 'Emotional, verbal or psychological' },
    { id: 'economic', label: 'Economic' },
    { id: 'intimidation', label: 'Intimidation' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'sexual_harassment', label: 'Sexual harassment' },
    { id: 'related_person', label: 'Related person abuse' },
    { id: 'spiritual', label: 'Spiritual' },
    { id: 'property_damage', label: 'Damage to property' },
    { id: 'elder', label: 'Elder abuse' },
    { id: 'coercive', label: 'Coercive behaviour' },
    { id: 'controlling', label: 'Controlling behaviour' },
    { id: 'child_exposure', label: 'Exposing a child to domestic violence' },
  ];

  const DOCS = [
    { id: 'form', short: 'Application form' },
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

  const API = { SECTIONS, FIELDS, ABUSE_TYPES, DOCS, LANGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.INFORMED = API;
})(typeof window !== 'undefined' ? window : this);
