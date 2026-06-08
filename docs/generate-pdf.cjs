// generate-pdf.cjs — Converts IMS_API_Reference.md to PDF with embedded images
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DOCS_DIR = __dirname;
const MD_FILE  = path.join(DOCS_DIR, 'IMS_API_Reference.md');
const PDF_FILE = path.join(DOCS_DIR, 'IMS_API_Reference.pdf');
const SS_DIR   = path.join(DOCS_DIR, 'screenshots');

// ── 1. Read markdown ──────────────────────────────────────────────────
let md = fs.readFileSync(MD_FILE, 'utf8');

// ── 2. Replace image references with base64 data URIs ─────────────────
md = md.replace(/!\[([^\]]*)\]\(screenshots\/([^)]+)\)/g, (match, alt, file) => {
  const imgPath = path.join(SS_DIR, file);
  if (!fs.existsSync(imgPath)) return match;
  const b64 = fs.readFileSync(imgPath).toString('base64');
  const ext = path.extname(file).slice(1).replace('jpg', 'jpeg');
  return `![${alt}](data:image/${ext};base64,${b64})`;
});

// ── 3. Convert markdown to HTML (manual — no external dep needed) ──────
function mdToHtml(text) {
  const lines = text.split('\n');
  const out   = [];
  let inCode  = false;
  let inTable = false;
  let inList  = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Fenced code blocks
    if (line.trim().startsWith('```')) {
      if (!inCode) { out.push('<pre><code>'); inCode = true; }
      else          { out.push('</code></pre>'); inCode = false; }
      continue;
    }
    if (inCode) { out.push(escHtml(line)); continue; }

    // Tables
    if (line.trim().startsWith('|')) {
      if (!inTable) { out.push('<table>'); inTable = true; }
      if (line.includes('|---|') || line.match(/\|[-: ]+\|/)) continue; // separator
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const tag = out.filter(l => l === '<table>').length > 0 && !out.slice(-4).some(l => l.includes('<tr>'))
        ? 'th' : 'td';
      out.push('<tr>' + cells.map(c => `<${tag}>${inline(c.trim())}</${tag}>`).join('') + '</tr>');
      continue;
    } else if (inTable) {
      out.push('</table>'); inTable = false;
    }

    // Headings
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) { out.push(`<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`); continue; }

    // Horizontal rule
    if (line.match(/^---+$/)) { out.push('<hr>'); continue; }

    // Blockquote
    if (line.startsWith('> ')) { out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); continue; }

    // List items
    if (line.match(/^[\s]*[-*+]\s/) || line.match(/^[\s]*\d+\.\s/)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[\s]*[-*+\d.]+\s/, ''))}</li>`);
      continue;
    } else if (inList) { out.push('</ul>'); inList = false; }

    // Images (base64 or URL)
    const imgM = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgM) { out.push(`<img src="${imgM[2]}" alt="${escHtml(imgM[1])}" style="max-width:100%;border-radius:6px;margin:12px 0;">`); continue; }

    // Blank line
    if (!line.trim()) { out.push('<br>'); continue; }

    out.push(`<p>${inline(line)}</p>`);
  }

  if (inTable) out.push('</table>');
  if (inList)  out.push('</ul>');
  if (inCode)  out.push('</code></pre>');
  return out.join('\n');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0;">')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/⚠️/g, '⚠️');
}

const body = mdToHtml(md);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: #1a1a2e;
    padding: 32px 40px;
    max-width: 960px;
    margin: 0 auto;
  }
  h1 { font-size: 22px; color: #0f3460; border-bottom: 3px solid #0f3460; padding-bottom: 8px; margin: 24px 0 8px; }
  h2 { font-size: 16px; color: #16213e; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 20px 0 8px; }
  h3 { font-size: 13px; color: #2d3748; margin: 16px 0 6px; }
  h4 { font-size: 12px; color: #4a5568; margin: 12px 0 4px; }
  p  { margin: 6px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
  code {
    background: #f1f5f9;
    color: #c7254e;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 10px;
  }
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 14px 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 10px 0;
    font-size: 10px;
    line-height: 1.5;
  }
  pre code { background: none; color: inherit; padding: 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 10.5px;
  }
  th {
    background: #0f3460;
    color: #fff;
    padding: 7px 10px;
    text-align: left;
    font-weight: 600;
  }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote {
    border-left: 4px solid #fbbf24;
    background: #fffbeb;
    padding: 8px 14px;
    margin: 10px 0;
    border-radius: 0 4px 4px 0;
    color: #78350f;
    font-size: 10.5px;
  }
  ul { padding-left: 20px; margin: 6px 0; }
  li { margin: 3px 0; }
  img { max-width: 100%; border-radius: 6px; border: 1px solid #e2e8f0; margin: 12px 0; display: block; }
  br  { display: block; margin: 4px 0; content: ''; }
  strong { color: #1a1a2e; }
</style>
</head>
<body>
${body}
</body>
</html>`;

// ── 4. Generate PDF via Playwright ─────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.pdf({
    path:   PDF_FILE,
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
  });

  await browser.close();
  console.log(`✅  PDF saved → ${PDF_FILE}`);
})();
