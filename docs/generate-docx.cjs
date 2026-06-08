// generate-docx.cjs — Converts MRD_PurchaseInquiry.html to .docx
const HTMLtoDOCX = require('html-to-docx');
const fs         = require('fs');
const path       = require('path');

const INPUT  = path.join(__dirname, 'MRD_PurchaseInquiry.html');
const OUTPUT = path.join(__dirname, 'MRD_PurchaseInquiry.docx');

let html = fs.readFileSync(INPUT, 'utf8');

// html-to-docx crashes on percentage widths in th/td — strip them
html = html.replace(/<(th|td)([^>]*?)style="[^"]*width:[^"]*"([^>]*?)>/gi,
  (m, tag, before, after) => {
    const cleaned = (before + after).replace(/\s+/g, ' ').trim();
    return cleaned ? `<${tag} ${cleaned}>` : `<${tag}>`;
  });

// Also strip width-only style attrs from th/td entirely
html = html.replace(/<(th|td)\s+style="[^"]*"([^>]*)>/gi, '<$1$2>');

(async () => {
  const fileBuffer = await HTMLtoDOCX(html, null, {
    orientation:  'portrait',
    margins: { top: 1080, bottom: 1080, right: 1080, left: 1080 },
    title:        'MRD – Purchase Inquiry | Horizon Enterprise IMS',
    subject:      'Module Requirements Document',
    creator:      'Horizon Enterprise IMS',
    font:         'Calibri',
    fontSize:     22,         // half-points → 11pt
    table:        { row: { cantSplit: false } },
    pageNumber:   true,
  });

  fs.writeFileSync(OUTPUT, fileBuffer);
  console.log(`✅  DOCX saved → ${OUTPUT}`);
})();
