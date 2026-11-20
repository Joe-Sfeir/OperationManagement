// Builds reference/concepts/contact_sheet.html: every concept prompt from
// docs/STYLE_BIBLE.md, the reference photo to attach, and the generated
// variations found in reference/concepts/ (approved ones from approved/).
//
// Usage: npm run concepts:sheet      (re-run after adding or approving images)
//
// File naming: reference/concepts/<slug>-v<n>.<png|jpg|jpeg|webp>
//   e.g. machine-hero-v1.png. Slugs are printed on the sheet.
// Approving: copy the file, same name, into reference/concepts/approved/.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette, neutral, font } from '../src/design/tokens.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const conceptsDir = join(root, 'reference/concepts');
const approvedDir = join(conceptsDir, 'approved');
const photosDir = join(root, 'reference/photos');
const outFile = join(conceptsDir, 'contact_sheet.html');
const VARIATIONS = 3;
const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ---- Parse the bible -------------------------------------------------------
const bible = readFileSync(join(root, 'docs/STYLE_BIBLE.md'), 'utf8');
const anchor = bible.match(/\*\*Style anchor\*\*[^\n]*\n+```text\n([\s\S]*?)\n```/)?.[1]?.trim();
if (!anchor) throw new Error('Style anchor block not found in STYLE_BIBLE.md');
const elements = [...bible.matchAll(/^(\d+)\. \*\*(.+?):\*\* `(.+)`\s*$/gm)].map((m) => ({
  n: Number(m[1]),
  name: m[2],
  slug: m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  prompt: `${anchor}. ${m[3]}`,
}));
if (elements.length === 0) throw new Error('No element prompts found in STYLE_BIBLE.md');

// ---- Which photo to attach (from the bible's References paragraph) ---------
// `match` is tested against file names in reference/photos/.
const refs = {
  'machine-hero': [
    { label: 'Plan-view drawing from the manual (layout)', match: /plan/i },
    { label: 'Hoist photo (real colours and clutter)', match: /hoist|demould/i },
  ],
  'oven-close-up': [{ label: 'Cooking chamber drawing', match: /cook|oven/i }],
  'cooling-chamber': [{ label: 'Cooling chamber drawing', match: /cool/i }],
  demoulding: [{ label: 'Hoist photo', match: /hoist|demould/i }],
  'raw-material-hall': [{ label: 'Extruder and silo photo', match: /extrud|silo|raw/i }],
  'sourcing-map': [],
  'full-dashboard': [
    { label: 'HMI page 0 (what operators already look at)', match: /hmi/i },
    { label: 'Console photo', match: /console/i },
  ],
};

const listImages = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => IMG.has(extname(f).toLowerCase())).sort() : [];
const concepts = listImages(conceptsDir);
const approved = new Set(listImages(approvedDir));
const photos = listImages(photosDir);
const rel = (p) => relative(conceptsDir, p).split('\\').join('/');

const slugs = elements.map((e) => e.slug).sort((a, b) => b.length - a.length);
const slugOf = (file) => slugs.find((s) => file.toLowerCase().startsWith(s + '-')) ?? null;
const unmatched = concepts.filter((f) => !slugOf(f));

// ---- HTML -------------------------------------------------------------------
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function slot(el, v) {
  const file = concepts.find((f) => f.toLowerCase().replace(extname(f), '') === `${el.slug}-v${v}`);
  const appr = file && approved.has(file);
  if (!file) {
    return `<figure class="slot empty"><div class="ph"><span>v${v} missing</span><code>${esc(el.slug)}-v${v}.png</code></div></figure>`;
  }
  return `<figure class="slot${appr ? ' approved' : ''}">
    <a href="${esc(rel(join(conceptsDir, file)))}"><img src="${esc(rel(join(conceptsDir, file)))}" alt="${esc(el.name)}, variation ${v}" loading="lazy"></a>
    <figcaption><code>${esc(file)}</code>${appr ? '<span class="tag">Approved</span>' : ''}</figcaption>
  </figure>`;
}

function extras(el) {
  const more = concepts.filter((f) => slugOf(f) === el.slug && !/-v[1-3]\.[a-z]+$/i.test(f));
  return more
    .map(
      (f) => `<figure class="slot${approved.has(f) ? ' approved' : ''}">
    <a href="${esc(f)}"><img src="${esc(f)}" alt="${esc(el.name)}, ${esc(f)}" loading="lazy"></a>
    <figcaption><code>${esc(f)}</code>${approved.has(f) ? '<span class="tag">Approved</span>' : ''}</figcaption></figure>`,
    )
    .join('');
}

function refList(el) {
  const list = refs[el.slug] ?? [];
  if (list.length === 0) return '<p class="muted">No photo to attach.</p>';
  return `<ul class="refs">${list
    .map((r) => {
      const hits = photos.filter((p) => r.match.test(p));
      const body = hits.length
        ? hits.map((h) => `<a href="${esc(rel(join(photosDir, h)))}"><img src="${esc(rel(join(photosDir, h)))}" alt="${esc(r.label)}"></a>`).join('')
        : '<span class="muted">not in reference/photos/ yet</span>';
      return `<li><span>${esc(r.label)}</span>${body}</li>`;
    })
    .join('')}</ul>`;
}

const total = elements.length * VARIATIONS;
const have = elements.reduce(
  (n, el) => n + [1, 2, 3].filter((v) => concepts.some((f) => f.toLowerCase().replace(extname(f), '') === `${el.slug}-v${v}`)).length,
  0,
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Concept contact sheet</title>
<style>
@font-face { font-family: "IBM Plex Sans"; font-weight: 400; src: url("../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Sans"; font-weight: 600; src: url("../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 400; src: url("../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2") format("woff2"); }
:root {
  --canvas: ${palette.canvas}; --panel: ${palette.panel}; --hair: ${neutral.hairline}; --hair2: ${neutral.hairlineStrong};
  --text: ${neutral.text}; --muted: ${neutral.textMuted}; --faint: ${neutral.textFaint};
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--canvas); color: var(--text); font: 14px/20px ${font.sans}; -webkit-font-smoothing: antialiased; }
code, .mono { font-family: ${font.mono}; font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
header.top { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid var(--hair); }
h1 { font-size: 14px; font-weight: 600; margin: 0; }
h2 { font-size: 14px; font-weight: 600; margin: 0; }
p { margin: 0; }
.muted { color: var(--muted); font-size: 12px; line-height: 16px; }
main { max-width: 1520px; margin: 0 auto; padding: 24px; display: grid; gap: 16px; }
.how { display: grid; gap: 4px; padding: 16px; border: 1px solid var(--hair); border-radius: 8px; background: var(--panel); }
.how ol { margin: 4px 0 0; padding-left: 20px; display: grid; gap: 4px; }
.el { display: grid; grid-template-columns: minmax(280px, 5fr) 7fr; gap: 16px; padding: 16px; border: 1px solid var(--hair); border-radius: 8px; background: var(--panel); }
.el .meta { display: grid; gap: 12px; align-content: start; min-width: 0; }
.el .title { display: flex; gap: 12px; align-items: baseline; }
.el .title .mono { color: var(--muted); }
.prompt { position: relative; margin: 0; padding: 12px; border: 1px solid var(--hair); border-radius: 4px; white-space: pre-wrap; word-break: break-word; color: var(--muted); }
.prompt b { color: var(--text); font-weight: 400; }
button { font: 12px/16px ${font.sans}; color: var(--text); background: transparent; border: 1px solid var(--hair2); border-radius: 4px; padding: 6px 10px; cursor: pointer; transition: border-color 150ms cubic-bezier(.42,0,.58,1); }
button:hover { border-color: var(--muted); }
.refs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.refs li { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; line-height: 16px; }
.refs li > span:first-child::before { content: "Attach: "; color: var(--muted); }
.refs img { height: 48px; border-radius: 4px; border: 1px solid var(--hair); }
.slots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-content: start; }
.slot { margin: 0; display: grid; gap: 6px; min-width: 0; }
.slot img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 4px; border: 1px solid var(--hair); display: block; background: var(--canvas); }
.slot.approved img { border: 2px solid var(--text); }
.slot figcaption { display: flex; gap: 8px; align-items: center; justify-content: space-between; min-width: 0; }
.slot figcaption code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
.tag { font-size: 12px; line-height: 16px; padding: 0 6px; border: 1px solid var(--text); border-radius: 4px; }
.ph { aspect-ratio: 4 / 3; border: 1px dashed var(--hair2); border-radius: 4px; display: grid; place-content: center; gap: 4px; text-align: center; padding: 8px; }
.ph span { color: var(--muted); font-size: 12px; }
.ph code { color: var(--faint); word-break: break-all; }
@media (max-width: 900px) {
  main { padding: 16px; }
  header.top { padding: 12px 16px; }
  .el { grid-template-columns: 1fr; }
}
@media (max-width: 520px) { .slots { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { * { transition-duration: 0ms !important; } }
</style>
</head>
<body>
<header class="top">
  <h1>Concept contact sheet</h1>
  <p class="muted"><span class="mono">${have}</span> of <span class="mono">${total}</span> variations in place, <span class="mono">${approved.size}</span> approved. Prompts read from docs/STYLE_BIBLE.md.</p>
</header>
<main>
  <section class="how" aria-label="How to fill this sheet">
    <h2>Fill and approve</h2>
    <ol class="muted">
      <li>Copy a prompt (style anchor already included) into Nano Banana, Higgsfield or Midjourney, and attach the listed photo.</li>
      <li>Save three variations into <code>reference/concepts/</code> using the file names in the empty slots.</li>
      <li>Run <code>npm run concepts:sheet</code> to refresh this page.</li>
      <li>Copy the ones you approve, same name, into <code>reference/concepts/approved/</code>. They get a white frame here.</li>
    </ol>
  </section>
${elements
  .map(
    (el) => `  <article class="el" id="${el.slug}">
    <div class="meta">
      <div class="title"><span class="mono">${el.n}</span><h2>${esc(el.name)}</h2><code class="muted">${el.slug}</code></div>
      ${refList(el)}
      <pre class="prompt mono" id="p-${el.slug}">${esc(anchor)}. <b>${esc(el.prompt.slice(anchor.length + 2))}</b></pre>
      <div><button type="button" data-copy="p-${el.slug}">Copy prompt</button></div>
    </div>
    <div class="slots">${[1, 2, 3].map((v) => slot(el, v)).join('')}${extras(el)}</div>
  </article>`,
  )
  .join('\n')}
${
  unmatched.length
    ? `  <section class="how"><h2>Not matched to a prompt</h2><p class="muted">Rename these to &lt;slug&gt;-v&lt;n&gt;: ${unmatched.map((f) => `<code>${esc(f)}</code>`).join(', ')}</p></section>`
    : ''
}
</main>
<script>
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-copy]');
  if (!b) return;
  const text = document.getElementById(b.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById(b.dataset.copy)); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected, press Ctrl+C'; }
  setTimeout(() => (b.textContent = 'Copy prompt'), 1500);
});
</script>
</body>
</html>
`;

writeFileSync(outFile, html);
console.log(`wrote ${relative(root, outFile)}: ${elements.length} prompts, ${have}/${total} variations, ${approved.size} approved, ${photos.length} photos`);
