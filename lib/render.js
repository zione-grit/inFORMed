// Turns the filled form into a PDF or Word draft. Used by the website and the chat bots.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const docx = require('docx');
const { SECTIONS, OFFICIAL, FIELDS, ABUSE_TYPES, FORM_VERSION } = require('../public/fields.js');
const LOGO = require('./logo');

const TITLE = 'FORM 6: APPLICATION FOR PROTECTION ORDER';
const SUBTITLE = '[Regulation 7(1)] Section 4(1) of the Domestic Violence Act, 1998 (Act No. 116 of 1998)';
const TITLE_6A = 'FORM 6A: PERSONAL INFORMATION FOR OFFICE USE AND NOT FOR SERVICE ON RESPONDENT';
const SUBTITLE_6A = '[Regulation 7(1A)] Keep this page separate. It is not given to the respondent.';
const DRAFT_NOTE = 'DRAFT prepared with inFORMed, following ' + FORM_VERSION + '. Not yet sworn. Take this draft to the clerk of any Magistrates\u2019 Court. The clerk will help you complete the official form, and you will sign it in front of a commissioner of oaths. Applying is free and you do not need a lawyer or a police case.';
const FOOTER = 'Prepared with inFORMed · Powered by GRIT (Gender Rights in Tech)';

function val(form, id) { return String((form && form[id]) || '').trim(); }

// Official sections of Form 6 then Form 6A, each with its fields.
function officialSections() {
  return OFFICIAL.map(o => ({ ...o, fields: FIELDS.filter(f => f.doc === o.doc && f.ds === o.n) }));
}
function sectionsWithFields() {
  return SECTIONS.map(s => ({ ...s, fields: FIELDS.filter(f => f.s === s.n) }));
}

function abuseLine(abuse) {
  const names = (abuse || []).map(a => (ABUSE_TYPES.find(x => x.id === a) || {}).label).filter(Boolean);
  return names.length ? names.join(', ') : '';
}

// pdf-lib's standard fonts only cover WinAnsi; replace anything else.
function safe(t) {
  return String(t)
    .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ·]/g, '');
}

async function toPdf(form, abuse, meta = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Protection order application (draft)');
  pdf.setProducer('inFORMed by GRIT');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M;
  const ink = rgb(0.13, 0.16, 0.17), soft = rgb(0.38, 0.42, 0.43), teal = rgb(0.11, 0.37, 0.42);
  let page, y;
  const pages = [];
  function newPage() { page = pdf.addPage([W, H]); pages.push(page); y = H - M; }
  function ensure(h) { if (y - h < M + 20) newPage(); }
  function wrap(text, f, size, width) {
    const out = [];
    for (const para of safe(text).split(/\n/)) {
      if (!para.trim()) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/\s+/)) {
        const test = line ? line + ' ' + word : word;
        if (f.widthOfTextAtSize(test, size) <= width) line = test;
        else { if (line) out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }
  function text(t, { f = font, size = 10, color = ink, indent = 0, gap = 3 } = {}) {
    const lines = wrap(t, f, size, CW - indent);
    for (const l of lines) {
      ensure(size + gap);
      page.drawText(l, { x: M + indent, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  }
  function rule() { ensure(8); page.drawLine({ start: { x: M, y: y - 2 }, end: { x: W - M, y: y - 2 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.8) }); y -= 8; }
  function box(checked) {
    page.drawRectangle({ x: M, y: y - 10, width: 9, height: 9, borderColor: ink, borderWidth: 0.8 });
    if (checked) page.drawText('X', { x: M + 1.6, y: y - 8.6, size: 8, font: bold, color: ink });
  }

  newPage();
  const logo = await pdf.embedPng(LOGO);
  page.drawImage(logo, { x: W - M - 40, y: H - M - 46, width: 40, height: 48 });
  text(TITLE, { f: bold, size: 15, color: teal });
  text(SUBTITLE, { size: 10, color: soft, gap: 8 });
  y = Math.min(y, H - M - 54);
  page.drawRectangle({ x: M, y: y - 52, width: CW, height: 50, color: rgb(0.94, 0.96, 0.97) });
  y -= 6;
  text(DRAFT_NOTE, { size: 8.5, color: ink, indent: 8, gap: 2.5 });
  y -= 14;
  if (meta.demo) { text('DEMO: this application is about an invented person.', { f: bold, size: 9, color: rgb(0.6, 0.2, 0.2), gap: 6 }); }
  text('PART A: APPLICATION', { f: bold, size: 11, gap: 8 });

  function signature(who) {
    ensure(60); y -= 12;
    text(who + ': ______________________________     Date: ______________', { size: 10, gap: 14 });
  }
  let curDoc = '6';
  for (const s of officialSections()) {
    const any = s.fields.some(f => val(form, f.id));
    if (s.optional && !any) continue;
    if (s.doc !== curDoc) {
      signature('Signature of complainant / person applying on behalf of complainant');
      text('PART B: CERTIFICATE (completed by the Commissioner of Oaths or Justice of the Peace when the application is sworn or affirmed)', { f: bold, size: 9, color: soft, gap: 4 });
      curDoc = s.doc; newPage();
      text(TITLE_6A, { f: bold, size: 13, color: teal, gap: 4 });
      text(SUBTITLE_6A, { size: 9.5, color: soft, gap: 10 });
    }
    ensure(80);
    y -= 4;
    text(`${s.n}. ${s.title.toUpperCase()}`, { f: bold, size: 10.5, color: teal, gap: 5 });
    rule();
    if (s.intro) text(s.intro, { size: 9.5, color: ink, gap: 5 });
    if (s.note) text(s.note, { size: 8.5, color: soft, gap: 5 });
    for (const f of s.fields) {
      const v = val(form, f.id);
      if (f.type === 'check') {
        ensure(16);
        box(!!v);
        const lines = wrap(f.label, font, 9.5, CW - 16);
        lines.forEach((l, i) => { if (i) ensure(13); page.drawText(l, { x: M + 16, y: y - 9.5, size: 9.5, font, color: ink }); y -= 13; });
        if (v && v.toLowerCase() !== 'requested') text(v, { size: 9.5, indent: 16, color: ink, gap: 3 });
        y -= 3;
      } else {
        text(f.label + ':', { f: bold, size: 9, color: soft, gap: 2 });
        text(v || '\u2014', { size: 10, color: v ? ink : soft, indent: 0, gap: 3.5 });
        y -= 5;
      }
    }
  }
  signature('Signature of complainant / person applying on behalf of complainant');
  text('PART B: CERTIFICATE (completed by the Commissioner of Oaths or Justice of the Peace)', { f: bold, size: 9, color: soft, gap: 4 });

  pages.forEach((p, i) => {
    p.drawText(safe(FOOTER), { x: M, y: 28, size: 7.5, font, color: soft });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 7.5), y: 28, size: 7.5, font, color: soft });
  });
  return Buffer.from(await pdf.save());
}

async function toDocx(form, abuse, meta = {}) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Footer, AlignmentType, BorderStyle, ShadingType, ImageRun } = docx;
  const kids = [];
  const P = (runs, opts = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], ...opts });
  kids.push(P(new ImageRun({ data: LOGO, transformation: { width: 50, height: 60 } }), { alignment: AlignmentType.RIGHT }));
  kids.push(P(new TextRun({ text: TITLE, bold: true, size: 30, color: '1D5E6B' })));
  kids.push(P(new TextRun({ text: SUBTITLE, size: 20, color: '606B6D' }), { spacing: { after: 200 } }));
  kids.push(P(new TextRun({ text: DRAFT_NOTE, size: 18 }), { shading: { type: ShadingType.CLEAR, fill: 'EEF4F2', color: 'auto' }, spacing: { after: 200 } }));
  if (meta.demo) kids.push(P(new TextRun({ text: 'DEMO: this application is about an invented person.', bold: true, color: '993333', size: 18 })));
  kids.push(P(new TextRun({ text: 'PART A: APPLICATION', bold: true, size: 22 }), { spacing: { before: 200, after: 120 } }));

  const sig = () => {
    kids.push(P(new TextRun({ text: 'Signature of complainant / person applying on behalf of complainant: ______________________________     Date: ______________', size: 20 }), { spacing: { before: 400, after: 200 } }));
    kids.push(P(new TextRun({ text: 'PART B: CERTIFICATE (completed by the Commissioner of Oaths or Justice of the Peace when the application is sworn or affirmed)', bold: true, size: 18, color: '606B6D' })));
  };
  let curDoc = '6';
  for (const s of officialSections()) {
    const any = s.fields.some(f => val(form, f.id));
    if (s.optional && !any) continue;
    if (s.doc !== curDoc) {
      sig(); curDoc = s.doc;
      kids.push(P(new TextRun({ text: TITLE_6A, bold: true, size: 26, color: '1D5E6B' }), { pageBreakBefore: true }));
      kids.push(P(new TextRun({ text: SUBTITLE_6A, size: 19, color: '606B6D' }), { spacing: { after: 160 } }));
    }
    kids.push(P(new TextRun({ text: `${s.n}. ${s.title.toUpperCase()}`, bold: true, color: '1D5E6B', size: 21 }), {
      heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C9D3CF', space: 2 } },
    }));
    if (s.intro) kids.push(P(new TextRun({ text: s.intro, size: 20 }), { spacing: { after: 80 } }));
    if (s.note) kids.push(P(new TextRun({ text: s.note, size: 17, color: '606B6D', italics: true }), { spacing: { after: 80 } }));
    for (const f of s.fields) {
      const v = val(form, f.id);
      if (f.type === 'check') {
        kids.push(P([new TextRun({ text: (v ? '\u2612 ' : '\u2610 '), size: 22 }), new TextRun({ text: f.label, size: 20 })], { spacing: { before: 60 } }));
        if (v && v.toLowerCase() !== 'requested') kids.push(P(new TextRun({ text: v, size: 20 }), { indent: { left: 360 } }));
      } else {
        kids.push(P(new TextRun({ text: f.label + ':', bold: true, size: 18, color: '606B6D' }), { spacing: { before: 100 } }));
        const lines = (v || '\u2014').split(/\n/);
        lines.forEach(l => kids.push(P(new TextRun({ text: l, size: 21, color: v ? '222829' : '8A9496' }))));
      }
    }
  }
  sig();

  const doc = new Document({
    creator: 'inFORMed by GRIT',
    title: 'Protection order application (draft)',
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      footers: { default: new Footer({ children: [P(new TextRun({ text: FOOTER, size: 15, color: '8A9496' }), { alignment: AlignmentType.CENTER })] }) },
      children: kids,
    }],
  });
  return Packer.toBuffer(doc);
}

// Plain-text summary for chat channels.
function toText(form, abuse) {
  const out = ['Your protection order application (draft)', ''];
  const types = abuseLine(abuse);
  if (types) out.push('Types of abuse described: ' + types, '');
  for (const s of sectionsWithFields()) {
    const filled = s.fields.filter(f => val(form, f.id));
    if (!filled.length) continue;
    out.push(`Section ${s.n}: ${s.title}`);
    for (const f of filled) {
      const v = val(form, f.id);
      out.push(f.type === 'check' ? `[x] ${f.label}${v.toLowerCase() !== 'requested' ? ': ' + v : ''}` : `${f.label}: ${v}`);
    }
    out.push('');
  }
  if (out.length <= 3) return 'Nothing has been added to your application yet. When you are ready, tell me what happened, and I will start filling it in.';
  return out.join('\n').trim();
}

module.exports = { toPdf, toDocx, toText, officialSections };
