/**
 * extract_xfa.mjs — Extract per-page XFA trees from an XFA PDF and write a
 * static HTML document that WeasyPrint can render to a static PDF.
 *
 * Usage:
 *   node extract_xfa.mjs <input.pdf> [--outdir <dir>]
 *
 * Outputs (in --outdir, defaulting to the directory of this script):
 *   page-N.json    — raw pdfjs XFA tree for page N (debug/diagnostics)
 *   xfa_pages.html — full multi-page HTML document ready for WeasyPrint
 *
 * Requirements:
 *   npm install   (installs pdfjs-dist 5.x — see package.json)
 *   Node.js 18+
 *
 * This script is intentionally self-contained.  It does not spawn sub-processes
 * and has no runtime dependencies beyond pdfjs-dist.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

// pdfjs needs a minimal DOMMatrix stub in Node.js
globalThis.DOMMatrix = class DOMMatrix {
  constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0; }
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

let inputPath = null;
let outDir    = SCRIPT_DIR;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--outdir' && process.argv[i + 1]) {
    outDir = resolve(process.argv[++i]);
  } else if (!inputPath) {
    inputPath = process.argv[i];
  }
}

if (!inputPath) {
  console.error('Usage: node extract_xfa.mjs <input.pdf> [--outdir <dir>]');
  process.exit(1);
}

inputPath = resolve(inputPath);

// ---------------------------------------------------------------------------
// pdfjs initialisation
// ---------------------------------------------------------------------------

const { getDocument } = await import(
  resolve(SCRIPT_DIR, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')
);

const data = readFileSync(inputPath);
const pdf  = await getDocument({
  data: new Uint8Array(data),
  enableXfa: true,
  // pdfjs 5.5.x NodeStandardFontDataFactory uses process.getBuiltinModule('fs')
  // which requires Node.js ≥ 22.  On Node 18 the factory silently fails and
  // pdfjs falls back to its built-in Foxit metrics; the path is still passed so
  // the factory knows where to look when it does work.
  standardFontDataUrl: resolve(SCRIPT_DIR, 'node_modules/pdfjs-dist/standard_fonts') + '/',
  cMapUrl:             resolve(SCRIPT_DIR, 'node_modules/pdfjs-dist/cmaps') + '/',
  cMapPacked: true,
}).promise;

console.log(`Pages: ${pdf.numPages}`);

// ---------------------------------------------------------------------------
// XFA CSS — verbatim from pdfjs-dist/web/pdf_viewer.css (xfa rules only),
// followed by print-friendly overrides.
//
// The pdfjs CSS block must be kept in sync with the pdfjs-dist version in use.
// When upgrading pdfjs-dist, diff the new pdf_viewer.css against the block
// below and update it.  The override section at the end is our own and should
// not be removed during upgrades.
// ---------------------------------------------------------------------------

const XFA_CSS = `
:root{
  --xfa-unfocused-field-background:url("data:image/svg+xml;charset=UTF-8,<svg width='1px' height='1px' xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' style='fill:rgba(0, 54, 255, 0.13);'/></svg>");
  --xfa-focus-outline:auto;
}

@media screen and (forced-colors: active){
  :root{
    --xfa-focus-outline:2px solid CanvasText;
  }
  .xfaLayer *:required{
    outline:1.5px solid selectedItem;
  }
}

.xfaLayer{
  --csstools-color-scheme--light:initial;
  color-scheme:only light;
  background-color:transparent;
}

.xfaLayer .highlight{
  margin:-1px;
  padding:1px;
  background-color:rgb(239 203 237);
  border-radius:4px;
}

.xfaLayer .highlight.appended{
  position:initial;
}

.xfaLayer .highlight.begin{
  border-radius:4px 0 0 4px;
}

.xfaLayer .highlight.end{
  border-radius:0 4px 4px 0;
}

.xfaLayer .highlight.middle{
  border-radius:0;
}

.xfaLayer .highlight.selected{
  background-color:rgb(203 223 203);
}

.xfaPage{
  overflow:hidden;
  position:relative;
}

.xfaContentarea{
  position:absolute;
}

.xfaPrintOnly{
  display:none;
}

.xfaLayer{
  position:absolute;
  text-align:initial;
  top:0;
  left:0;
  transform-origin:0 0;
  line-height:1.2;
}

.xfaLayer *{
  color:inherit;
  font:inherit;
  font-style:inherit;
  font-weight:inherit;
  font-kerning:inherit;
  letter-spacing:-0.01px;
  text-align:inherit;
  text-decoration:inherit;
  box-sizing:border-box;
  background-color:transparent;
  padding:0;
  margin:0;
  pointer-events:auto;
  line-height:inherit;
}

.xfaLayer *:required{
  outline:1.5px solid red;
}

.xfaLayer div,
.xfaLayer svg,
.xfaLayer svg *{
  pointer-events:none;
}

.xfaLayer a{
  color:blue;
}

.xfaRich li{
  margin-left:3em;
}

.xfaFont{
  color:black;
  font-weight:normal;
  font-kerning:none;
  font-size:10px;
  font-style:normal;
  letter-spacing:0;
  text-decoration:none;
  vertical-align:0;
}

.xfaCaption{
  overflow:hidden;
  flex:0 0 auto;
}

.xfaCaptionForCheckButton{
  overflow:hidden;
  flex:1 1 auto;
}

.xfaLabel{
  height:100%;
  width:100%;
}

.xfaLeft{
  display:flex;
  flex-direction:row;
  align-items:center;
}

.xfaRight{
  display:flex;
  flex-direction:row-reverse;
  align-items:center;
}

:is(.xfaLeft, .xfaRight) > :is(.xfaCaption, .xfaCaptionForCheckButton){
  max-height:100%;
}

.xfaTop{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
}

.xfaBottom{
  display:flex;
  flex-direction:column-reverse;
  align-items:flex-start;
}

:is(.xfaTop, .xfaBottom) > :is(.xfaCaption, .xfaCaptionForCheckButton){
  width:100%;
}

.xfaBorder{
  background-color:transparent;
  position:absolute;
  pointer-events:none;
}

.xfaWrapped{
  width:100%;
  height:100%;
}

:is(.xfaTextfield, .xfaSelect):focus{
  background-image:none;
  background-color:transparent;
  outline:var(--xfa-focus-outline);
  outline-offset:-1px;
}

:is(.xfaCheckbox, .xfaRadio):focus{
  outline:var(--xfa-focus-outline);
}

.xfaTextfield,
.xfaSelect{
  height:100%;
  width:100%;
  flex:1 1 auto;
  border:none;
  resize:none;
  background-image:var(--xfa-unfocused-field-background);
}

.xfaSelect{
  padding-inline:2px;
}

:is(.xfaTop, .xfaBottom) > :is(.xfaTextfield, .xfaSelect){
  flex:0 1 auto;
}

.xfaButton{
  cursor:pointer;
  width:100%;
  height:100%;
  border:none;
  text-align:center;
}

.xfaLink{
  width:100%;
  height:100%;
  position:absolute;
  top:0;
  left:0;
}

.xfaCheckbox,
.xfaRadio{
  width:100%;
  height:100%;
  flex:0 0 auto;
  border:none;
}

.xfaRich{
  white-space:pre-wrap;
  width:100%;
  height:100%;
}

.xfaImage{
  object-position:left top;
  object-fit:contain;
  width:100%;
  height:100%;
}

.xfaLrTb,
.xfaRlTb,
.xfaTb{
  display:flex;
  flex-direction:column;
  align-items:stretch;
}

.xfaLr{
  display:flex;
  flex-direction:row;
  align-items:stretch;
}

.xfaRl{
  display:flex;
  flex-direction:row-reverse;
  align-items:stretch;
}

.xfaTb > div{
  justify-content:left;
}

.xfaPosition{
  position:relative;
}

.xfaArea{
  position:relative;
}

.xfaValignMiddle{
  display:flex;
  align-items:center;
}

.xfaTable{
  display:flex;
  flex-direction:column;
  align-items:stretch;
}

.xfaTable .xfaRow{
  display:flex;
  flex-direction:row;
  align-items:stretch;
}

.xfaTable .xfaRlRow{
  display:flex;
  flex-direction:row-reverse;
  align-items:stretch;
  flex:1;
}

.xfaTable .xfaRlRow > div{
  flex:1;
}

:is(.xfaNonInteractive, .xfaDisabled, .xfaReadOnly) :is(input, textarea){
  background:initial;
}

@media print{
  .xfaTextfield,
  .xfaSelect{
    background:transparent;
  }

  .xfaSelect{
    -webkit-appearance:none;
       -moz-appearance:none;
            appearance:none;
    text-indent:1px;
    text-overflow:"";
  }
}

/* ── Print-friendly overrides ──────────────────────────────────────────────
 *
 * These rules follow the pdfjs CSS block and override it for static rendering.
 * They are NOT part of pdfjs-dist — do not replace them during pdfjs upgrades.
 */

/* Windows font substitutes.
 * XFA forms are predominantly authored on Windows and specify fonts that are
 * not present on Linux (Calibri, Cambria, Arial, Times New Roman, etc.).
 * The @font-face rules below map common Windows font names to free
 * metric-compatible substitutes installed by setup.sh.
 * "Metric-compatible" means identical character widths — text fits in
 * containers sized for the original font.
 * See docs/xfa-rendering.md § "Font Dependencies" for the full list. */
/* WeasyPrint resolves local() by PostScript name (nameID=6) or full name (nameID=4).
 * Use the PostScript name first; the full name ("Family Style") is the fallback. */
@font-face { font-family: "Calibri"; font-weight: normal; font-style: normal; src: local("Carlito-Regular"),    local("Carlito Regular"); }
@font-face { font-family: "Calibri"; font-weight: bold;   font-style: normal; src: local("Carlito-Bold"),       local("Carlito Bold"); }
@font-face { font-family: "Calibri"; font-weight: normal; font-style: italic; src: local("Carlito-Italic"),     local("Carlito Italic"); }
@font-face { font-family: "Calibri"; font-weight: bold;   font-style: italic; src: local("Carlito-BoldItalic"), local("Carlito Bold Italic"); }
@font-face { font-family: "Cambria"; font-weight: normal; font-style: normal; src: local("Caladea-Regular"),    local("Caladea Regular"); }
@font-face { font-family: "Cambria"; font-weight: bold;   font-style: normal; src: local("Caladea-Bold"),       local("Caladea Bold"); }
@font-face { font-family: "Cambria"; font-weight: normal; font-style: italic; src: local("Caladea-Italic"),     local("Caladea Italic"); }
@font-face { font-family: "Cambria"; font-weight: bold;   font-style: italic; src: local("Caladea-BoldItalic"), local("Caladea Bold Italic"); }
@font-face { font-family: "Arial";   font-weight: normal; font-style: normal; src: local("LiberationSans"),           local("Liberation Sans"); }
@font-face { font-family: "Arial";   font-weight: bold;   font-style: normal; src: local("LiberationSans-Bold"),      local("Liberation Sans Bold"); }
@font-face { font-family: "Arial";   font-weight: normal; font-style: italic; src: local("LiberationSans-Italic"),    local("Liberation Sans Italic"); }
@font-face { font-family: "Arial";   font-weight: bold;   font-style: italic; src: local("LiberationSans-BoldItalic"),local("Liberation Sans Bold Italic"); }
@font-face { font-family: "Times New Roman"; font-weight: normal; font-style: normal; src: local("LiberationSerif"),           local("Liberation Serif"); }
@font-face { font-family: "Times New Roman"; font-weight: bold;   font-style: normal; src: local("LiberationSerif-Bold"),      local("Liberation Serif Bold"); }
@font-face { font-family: "Times New Roman"; font-weight: normal; font-style: italic; src: local("LiberationSerif-Italic"),    local("Liberation Serif Italic"); }
@font-face { font-family: "Times New Roman"; font-weight: bold;   font-style: italic; src: local("LiberationSerif-BoldItalic"),local("Liberation Serif Bold Italic"); }
@font-face { font-family: "Courier New"; font-weight: normal; font-style: normal; src: local("LiberationMono"),      local("Liberation Mono"); }
@font-face { font-family: "Courier New"; font-weight: bold;   font-style: normal; src: local("LiberationMono-Bold"), local("Liberation Mono Bold"); }
/* "Courier" (without "New") appears in some XFA forms — map the same way. */
@font-face { font-family: "Courier"; font-weight: normal; font-style: normal; src: local("LiberationMono"),      local("Liberation Mono"); }
@font-face { font-family: "Courier"; font-weight: bold;   font-style: normal; src: local("LiberationMono-Bold"), local("Liberation Mono Bold"); }
/* Myriad Pro: Adobe proprietary humanist sans-serif; no free metric-compatible
 * substitute is available in standard Linux repositories.  Map to Liberation Sans
 * as a visually similar fallback — text may overflow slightly in narrow containers. */
@font-face { font-family: "Myriad Pro"; font-weight: normal; font-style: normal; src: local("LiberationSans"),      local("Liberation Sans"); }
@font-face { font-family: "Myriad Pro"; font-weight: bold;   font-style: normal; src: local("LiberationSans-Bold"), local("Liberation Sans Bold"); }

body { margin: 0; background: white; }
.xfaPage { page-break-after: always; break-after: page; background: white; }

/* Suppress the blue fill tile that pdfjs uses to indicate unfocused fields. */
:root { --xfa-unfocused-field-background: none; --xfa-focus-outline: none; }
/* Form fields must be white, not transparent.  Transparent would let any
 * coloured section background (e.g. grey header boxes) show through the field,
 * making the field appear grey.  Adobe Reader always renders fields with a
 * white fill regardless of the surrounding background. */
input:not([type=checkbox]):not([type=radio]), textarea, select {
  background: white !important; outline: none;
}

/* Checkboxes and radio buttons: render as visible bordered boxes/circles. */
input.xfaCheckbox {
  display: inline-block !important;
  border: 1px solid #000 !important;
  background: white !important;
}
input.xfaRadio {
  display: inline-block !important;
  border: 1px solid #000 !important;
  border-radius: 50% !important;
  background: white !important;
}

/* Show print-only elements (pdfjs hides them for screen display). */
.xfaPrintOnly { display: block; }

/* Clip wrapper children only when they appear inside a flex layout container.
 * Applying overflow:hidden unconditionally clips content in leaf containers
 * whose declared height is smaller than their actual content.
 * Restricting to direct children of flex containers prevents column bleed
 * while allowing leaf-level wrappers to grow naturally. */
.xfaLr    > .xfaWrapper,
.xfaRl    > .xfaWrapper,
.xfaTb    > .xfaWrapper,
.xfaLrTb  > .xfaWrapper,
.xfaRlTb  > .xfaWrapper { overflow: hidden; }

/* Remove xfaRich padding that would push text below the container boundary
 * when the container is smaller than the default padding. */
.xfaRich { padding-top: 0 !important; padding-bottom: 0 !important; }

/* WeasyPrint 68.x bug: justify-content:center in flex-direction:column renders
 * text upside-down.  Override to flex-start for all xfaRich containers.
 * If WeasyPrint fixes this in a future version, this override can be removed. */
.xfaRich { justify-content: flex-start !important; }
`;

// ---------------------------------------------------------------------------
// HTML serialisation helpers
// ---------------------------------------------------------------------------

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/** camelCase → kebab-case for CSS property names. */
function camelToKebab(s) {
  return s.replace(/([A-Z])/g, m => '-' + m.toLowerCase());
}

function styleToCSS(styleObj) {
  if (!styleObj || typeof styleObj !== 'object') return '';
  return Object.entries(styleObj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const prop = camelToKebab(k);
      // pdfjs sometimes emits `background-color: linear-gradient(…)` which is
      // invalid CSS (gradients are only valid for `background`, not
      // `background-color`).  Remap to the shorthand property.
      if (prop === 'background-color' && String(v).startsWith('linear-gradient')) {
        return `background: ${v}`;
      }
      return `${prop}: ${v}`;
    })
    .join('; ');
}

/** HTML5 void elements — no closing tag. */
const VOID = new Set([
  'area','base','br','col','embed','hr','img','input',
  'link','meta','param','source','track','wbr',
]);

/**
 * Return all text content of a node up to a depth limit.
 *
 * The depth limit is intentional: it lets us detect text that is a *direct*
 * or *near* descendant without matching ancestors that only contain the text
 * via a very deep sub-tree (which would risk false positives).
 *
 * Known hack: depth=4 is tuned to the ECHR application form structure.
 * If a different XFA document places the "Adobe Reader" warning at a depth
 * greater than 4, the suppression logic below will fail to match it.
 */
function getTextContent(node, depth = 4) {
  if (!node || typeof node !== 'object') return '';
  const own = String(node.value ?? '');
  if (depth <= 0) return own;
  const childText = (node.children || []).map(c => getTextContent(c, depth - 1)).join('');
  return own + childText;
}

/**
 * Walk the tree and resolve any blob:nodedata: src attributes to base64 data URIs.
 * pdfjs registers these blobs via URL.createObjectURL in Node.js; fetch() can read them.
 */
async function resolveBlobs(node) {
  if (!node || typeof node !== 'object') return;
  const attrs = node.attributes;
  if (attrs && attrs.src && typeof attrs.src === 'string' && attrs.src.startsWith('blob:')) {
    try {
      const resp = await fetch(attrs.src);
      const buf  = await resp.arrayBuffer();
      const mime = resp.headers.get('content-type') || 'image/png';
      attrs.src  = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
    } catch (_) {
      attrs.src = ''; // leave broken-image placeholder
    }
  }
  for (const child of (node.children || [])) {
    await resolveBlobs(child);
  }
}

/**
 * Serialise a pdfjs XFA tree node to an HTML string.
 *
 * The XFA tree uses standard HTML element names (div, span, input, svg, …),
 * class arrays, and style objects with camelCase keys and CSS pixel values.
 * Text content is in value properties on #text nodes or on leaf elements.
 *
 * Special cases handled here (see docs/xfa-rendering.md for rationale):
 *  - SVG background boxes → CSS background div
 *  - xfaRich flex-column with many <p> children → equal-height flex rows
 *  - "Adobe Reader" overlay → suppressed
 *  - xfaPage wrapper → .xfaLayer div inserted to activate pdfjs CSS resets
 *
 * @param {object} node  - pdfjs XFA tree node
 * @param {object} ctx   - rendering context (currently unused, reserved for future use)
 */
function nodeToHTML(node, ctx = {}) {
  if (!node || typeof node !== 'object') return '';
  const name = node.name;
  if (!name) return '';

  // Text node — emit escaped text content, no tag.
  if (name === '#text') {
    return escHtml(node.value ?? '');
  }

  // SVG with a single background rect — convert to a CSS background div so
  // WeasyPrint renders the fill/stroke correctly.
  //
  // KNOWN HACK: This assumes that any SVG with exactly one <rect> child is a
  // background box.  Actual SVG drawings, charts, or complex shapes will be
  // silently dropped.  If a document uses SVG for real graphics, add handling
  // here and emit an actual <svg> element.
  if (name === 'svg') {
    const svgChildren = (node.children || []).filter(Boolean);
    const rects = svgChildren.filter(c => c.name === 'rect');
    const lines = svgChildren.filter(c => c.name === 'line');

    // Single background rect → CSS background div (WeasyPrint ignores SVG fill).
    // KNOWN HACK: treats any single-rect SVG as a background box; real SVG
    // graphics with one rect would be misrendered.
    if (rects.length === 1 && lines.length === 0) {
      const rs     = rects[0].attributes?.style || {};
      const fill   = rs.fill;
      const stroke = rs.stroke;
      const sw     = rs.strokeWidth || '0.5px';
      const css = [
        'position:absolute', 'top:0', 'left:0',
        'width:100%', 'height:100%', 'box-sizing:border-box',
        ...(fill   && fill   !== 'none' && fill   !== 'transparent' ? [`background-color:${fill}`]      : []),
        ...(stroke && stroke !== 'none'                              ? [`border:${sw} solid ${stroke}`]  : []),
      ].join(';');
      return `<div style="${css}"></div>`;
    }

    // Single line → CSS border div.
    // pdfjs emits vertical/horizontal divider lines as SVG <line> elements
    // inside a zero-width (or zero-height) wrapper.  Convert to a CSS border
    // so WeasyPrint renders the line without needing full SVG support.
    if (lines.length === 1 && rects.length === 0) {
      const la  = lines[0].attributes || {};
      const ls  = la.style || {};
      const stroke = ls.stroke || '#000000';
      const sw     = ls.strokeWidth || '0.5px';
      const x1 = String(la.x1 ?? '0'), x2 = String(la.x2 ?? '0');
      const y1 = String(la.y1 ?? '0'), y2 = String(la.y2 ?? '0');
      const isVertical   = x1 === x2;
      const isHorizontal = y1 === y2;
      if (isVertical) {
        return `<div style="position:absolute;top:0;left:0;width:0;height:100%;` +
               `border-left:${sw} solid ${stroke};overflow:visible;pointer-events:none;"></div>`;
      }
      if (isHorizontal) {
        return `<div style="position:absolute;top:0;left:0;width:100%;height:0;` +
               `border-top:${sw} solid ${stroke};overflow:visible;pointer-events:none;"></div>`;
      }
    }

    return ''; // skip complex SVGs (charts, diagrams, etc.)
  }

  const attrs    = node.attributes || {};
  const classes  = attrs.class || [];
  const style    = attrs.style  || {};
  // `let` so that the xfaRich flex-column handler can strip <br> elements below.
  let children = node.children || [];

  // Suppress the "Please note this form requires Adobe Reader" overlay element.
  // XFA PDFs embed this warning for non-Adobe viewers.  Since we render the
  // content ourselves, the warning must not appear.
  //
  // KNOWN HACK: depth=4 is tuned to the ECHR form.  See getTextContent() above.
  if (getTextContent(node).includes('Adobe Reader')) return '';

  if (classes.includes('xfaRich') && style.flexDirection === 'column') {
    const pCount    = children.filter(c => c && c.name === 'p').length;
    const spanCount = children.filter(c => c && c.name === 'span').length;

    // Tall <p>-based lists: give each row equal flex height so it aligns with
    // absolutely-positioned sibling input fields, and strip the <br> inside
    // each <p> that would otherwise double the line count.
    // KNOWN HACK: pCount > 5 is arbitrary; a short list (≤5 <p> items) that
    // also needs alignment with sibling rows would not be caught here.
    if (pCount > 5) {
      const richStyle = styleToCSS(Object.assign({}, style, { alignItems: 'stretch', height: '100%' }));
      const richAttr  = richStyle ? ` style="${escAttr(richStyle)}"` : '';
      const innerHTML = children.map(child => {
        if (!child || child.name !== 'p') return nodeToHTML(child, ctx);
        const pContent = (child.children || [])
          .filter(c => c && c.name !== 'br')
          .map(c => nodeToHTML(c, ctx))
          .join('');
        return `<p style="flex:1 0 0;overflow:hidden;min-height:0">${pContent}</p>`;
      }).join('');
      return `<div${richAttr}>${innerHTML}</div>`;
    }

    // Span-based inline content: WeasyPrint produces an unexplained rendering
    // gap between <span> flex items in column-direction flex containers when
    // rendered in print-page context.  Work around by switching to
    // display:block so spans flow as inline elements with <br> acting as
    // explicit line breaks — matching the original XFA authoring intent.
    if (spanCount > 0 && pCount === 0) {
      const blockStyle = styleToCSS(
        Object.assign({}, style, { display: 'block', flexDirection: undefined,
                                   justifyContent: undefined, alignItems: undefined })
      );
      const blockAttr = blockStyle ? ` style="${escAttr(blockStyle)}"` : '';
      const classList  = classes.join(' ');
      const innerHTML  = children.map(c => nodeToHTML(c, ctx)).join('');
      return `<div class="${escAttr(classList)}"${blockAttr}>${innerHTML}</div>`;
    }

    // All other flex-column xfaRich divs: strip direct-child <br> elements.
    // In a flex container every child is already a block-level row, so <br>
    // between items creates empty rows and inflates the container height,
    // causing content to overflow into adjacent sections.
    children = children.filter(c => c && c.name !== 'br');
  }

  // xfaWrapper elements that contain an image-only draw (e.g. a "Lines" overlay
  // image) must be raised above the white-background text fields so the overlay
  // graphic remains visible.  Without z-index: 1, the white field background
  // (needed to hide grey section backgrounds) covers the overlay image.
  let effectiveStyle = style;
  if (classes.includes('xfaWrapper')) {
    const hasImageOverlay = children.some(c => {
      if (!c || c.name !== 'div') return false;
      const cc = c.attributes?.class || [];
      if (!cc.includes('xfaDraw')) return false;
      const gc = (c.children || []).filter(Boolean);
      return gc.length === 1 && gc[0].name === 'img';
    });
    if (hasImageOverlay) effectiveStyle = Object.assign({}, style, { zIndex: '1' });
  }

  const parts = [];
  if (classes.length > 0) parts.push(`class="${escAttr(classes.join(' '))}"`);
  if (attrs.id)            parts.push(`id="${escAttr(attrs.id)}"`);
  const css = styleToCSS(effectiveStyle);
  if (css)                 parts.push(`style="${escAttr(css)}"`);

  // For img, include the resolved src and alt.
  if (name === 'img') {
    if (attrs.src) parts.push(`src="${escAttr(attrs.src)}"`);
    if (attrs.alt != null) parts.push(`alt="${escAttr(String(attrs.alt))}"`);
  }

  // For input, include value and type so pre-filled fields render correctly.
  if (name === 'input') {
    if (attrs.type)  parts.push(`type="${escAttr(String(attrs.type))}"`);
    if (attrs.value != null && attrs.value !== '') {
      parts.push(`value="${escAttr(String(attrs.value))}"`);
    }
  }

  const attrStr = parts.length ? ' ' + parts.join(' ') : '';

  if (VOID.has(name)) {
    return `<${name}${attrStr}>`;
  }

  // Some nodes (e.g. <span>) carry their text in a `value` property rather
  // than a child #text node.
  const inlineText = node.value != null ? escHtml(node.value) : '';
  const childHTML  = children.map(c => nodeToHTML(c, ctx)).join('');

  // xfaPage: wrap children in .xfaLayer so pdfjs CSS resets apply.
  // Without this wrapper, font inheritance and background resets from .xfaLayer *
  // do not apply and the entire layout breaks.
  if (classes.includes('xfaPage')) {
    const inner = `<div class="xfaLayer" style="width:100%;height:100%;">${inlineText}${childHTML}</div>`;
    return `<${name}${attrStr}>${inner}</${name}>`;
  }

  return `<${name}${attrStr}>${inlineText}${childHTML}</${name}>`;
}

// ---------------------------------------------------------------------------
// Main extraction loop
// ---------------------------------------------------------------------------

const pageData = [];

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const xfa  = await page.getXfa();
  const vp   = page.getViewport({ scale: 1 });

  writeFileSync(resolve(outDir, `page-${i}.json`), JSON.stringify({
    pageNum:  i,
    widthPx:  vp.width,
    heightPx: vp.height,
    tree:     xfa,
  }, null, 2));

  if (xfa) await resolveBlobs(xfa);
  pageData.push({ xfa, widthPx: vp.width, heightPx: vp.height });
  console.log(`  page ${i}: ${Math.round(vp.width)}x${Math.round(vp.height)}px`);
}

// Emit a @page size rule so WeasyPrint uses the correct paper size.
// WeasyPrint defaults to A4 when no @page rule is present; XFA forms may
// use A4, US Letter, or other sizes.  We derive the size from the first
// page's viewport.  If all pages share the same size (the common case), a
// single rule suffices.  Mixed-size documents are not handled here — they
// would require named @page rules; this is a known limitation.
const { widthPx: pw, heightPx: ph } = pageData[0] ?? { widthPx: 595.28, heightPx: 841.89 };
const pageSizeCSS = `@page { size: ${pw}px ${ph}px; margin: 0; }`;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${XFA_CSS}
${pageSizeCSS}
</style>
</head>
<body>
${pageData.map(p => p.xfa ? nodeToHTML(p.xfa) : '').join('\n')}
</body>
</html>`;

writeFileSync(resolve(outDir, 'xfa_pages.html'), html);
console.log(`Done. Wrote page-N.json files and xfa_pages.html to ${outDir}`);
