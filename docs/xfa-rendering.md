# XFA PDF → Static PDF: Rendering Pipeline Specification

This document is the authoritative specification for the XFA conversion feature.
It is intended to be complete enough that a developer (or AI agent) with no
prior context could recreate the pipeline from scratch.

---

## Background

XFA (XML Forms Architecture) is a deprecated Adobe proprietary extension for
PDF forms.  It is still in regular use by many government agencies and
organisations worldwide.  XFA PDFs are unreadable in all modern open-source PDF
viewers — they display a "Please wait… your viewer doesn't support this format"
placeholder page instead of actual content.

The goal of this feature is a server-side pipeline that converts an XFA PDF to
a static, non-interactive, printable PDF.  No browser, no display server, no
Adobe software.

---

## Architecture

```
   input.pdf
       │
       ▼
  extract_xfa.mjs          (Node.js — pdfjs-dist)
       │
       ├─ page-1.json  ──┐
       ├─ page-2.json    │  raw XFA tree per page (debug)
       └─ …              │
                         │
       xfa_pages.html ◄──┘  static multi-page HTML
       │
       ▼
  weasyprint xfa_pages.html   (Python — WeasyPrint)
       │
       ▼
   output.pdf
```

The two-step split is necessary because:

1. The only open-source XFA parser that works is **pdfjs-dist** (Node.js npm
   package).  All other tools — Ghostscript, LibreOffice, pypdfium2, poppler —
   render only the "Please wait…" placeholder and cannot access XFA content.

2. **WeasyPrint** (Python) converts HTML+CSS to PDF with high fidelity to
   CSS layout, which is what pdfjs emits.  reportlab (also Python) was tried
   first but required reimplementing too much CSS logic (see Approach history).

The `convert.py` script wraps both steps into a single command.

---

## How pdfjs Represents XFA

`page.getXfa()` returns a tree of nodes.  Each node is a plain object:

```json
{
  "name": "div",
  "attributes": {
    "class": ["xfaPage"],
    "style": {
      "width": "595.32px",
      "height": "842.04px",
      "position": "absolute",
      "top": "0px",
      "left": "0px"
    },
    "id": "p1"
  },
  "value": null,
  "children": [ ... ]
}
```

Key properties:

| Property | Type | Notes |
|----------|------|-------|
| `name` | string | HTML element name (`div`, `span`, `input`, `svg`, `#text`, …) |
| `attributes.class` | array of strings | CSS class names; never a string |
| `attributes.style` | plain object | camelCase keys; pixel values as strings (`"10px"`) |
| `attributes.id` | string | May be duplicated across pages |
| `attributes.src` | string | `blob:nodedata:…` URL for embedded images |
| `attributes.type` | string | For `<input>` elements |
| `attributes.value` | string | Pre-filled field value |
| `value` | string or null | Text content of leaf nodes; also set on `#text` nodes |
| `children` | array | Child nodes; may contain `null` entries |

Positions are **absolute CSS pixels** — pdfjs has already performed the XFA
layout calculation.  No reflow is needed.  All coordinates are relative to the
containing `xfaPage` element.

---

## HTML Generation (`extract_xfa.mjs`)

The Node.js script serialises the pdfjs tree directly to HTML by:

1. Mapping `node.name` → HTML tag name (already correct)
2. Converting `attributes.class` array → `class="…"` string
3. Converting `attributes.style` object → `style="…"` string
   (camelCase keys → kebab-case)
4. Emitting `attributes.id`, `attributes.src`, `attributes.type`,
   `attributes.value` where present
5. Recursing into `node.children`
6. Emitting `node.value` as escaped text for `#text` nodes and leaf elements

The full HTML document wraps all pages in a `<style>` block containing:
- The verbatim pdfjs XFA CSS (from `pdfjs-dist/web/pdf_viewer.css`, xfa rules)
- Print-friendly overrides (see CSS section below)

### The `.xfaLayer` wrapper

Every `xfaPage` div's children must be wrapped in a `<div class="xfaLayer">`:

```html
<div class="xfaPage" style="width:595.32px; height:842.04px;">
  <div class="xfaLayer" style="width:100%;height:100%;">
    <!-- page content -->
  </div>
</div>
```

Without this wrapper, the `.xfaLayer *` CSS resets from pdfjs (font
inheritance, background-color reset, box-sizing) do not apply and the entire
layout breaks.

---

## CSS Strategy

The HTML document embeds two CSS blocks:

### Block 1: pdfjs XFA CSS (verbatim copy)

Copied from `pdfjs-dist/web/pdf_viewer.css`, rules containing `xfa`.
This provides:

- `.xfaLayer *` — font inheritance, box-sizing, background reset
- `.xfaFont`, `.xfaRich`, `.xfaWrapped`, `.xfaPosition`, `.xfaArea`
- `.xfaTextfield`, `.xfaSelect` — form field sizing
- `.xfaTb`, `.xfaLr`, `.xfaTable` — flex layout containers
- `.xfaLeft`, `.xfaRight`, `.xfaTop`, `.xfaBottom` — caption placement
- `.xfaPage`, `.xfaContentarea` — page and content area positioning

**Upgrade note:** When upgrading pdfjs-dist, diff the new `pdf_viewer.css`
against the CSS block in `extract_xfa.mjs` and apply the delta.  Only the
block between the pdfjs block comments should change; the override section
below it should be left intact.

### Block 2: Print-friendly overrides

Applied after the pdfjs block; must not be removed during pdfjs upgrades.

| Override | Reason |
|----------|--------|
| `@font-face` for Windows fonts | XFA forms created on Windows commonly specify fonts that are not available on Linux (Calibri, Arial, Times New Roman, etc.). CSS `@font-face` with `local()` names maps these to available substitutes. See Font Dependencies section. |
| `--xfa-unfocused-field-background: none` | Without this, every input/textarea fills with a blue SVG tile — the default pdfjs value for screen display. |
| `.xfaPrintOnly { display: block }` | pdfjs hides these for screen display; they must be visible in a static PDF. |
| `.xfaLr > .xfaWrapper`, etc. `{ overflow: hidden }` | Clips absolute-positioned children inside flex containers to prevent column bleed. Applied only to direct children of flex layout containers — not to all `.xfaWrapper` elements — because leaf-level containers sometimes have a declared height smaller than their actual content. Applying overflow:hidden unconditionally would clip that content. |
| `input, textarea, select { background: white !important }` | Prevents the coloured section background (e.g. `#f3f3f3` grey header boxes from the SVG→CSS rect conversion) from showing through transparent input fields. Adobe Reader always fills fields with white regardless of the surrounding background. |
| `.xfaRich { padding-top: 0 !important }` | Some xfaRich containers are very small; default padding pushes text below the visible area. |
| `.xfaRich { justify-content: flex-start !important }` | WeasyPrint 68.x bug: `justify-content: center` in a flex column renders text upside-down. See Known Issues. |

A `@page { size: Wpx Hpx; margin: 0; }` rule is emitted dynamically at the end of the style block, using the first page's viewport dimensions.  Without this, WeasyPrint defaults to A4 regardless of the form's actual paper size.

---

## Font Dependencies

### The problem: Windows fonts on Linux

XFA forms are predominantly authored on Windows and frequently specify
Windows-only fonts (Calibri, Arial, Times New Roman, Courier New, Tahoma,
Segoe UI, and others).  These fonts are not present on a standard Linux server.
When a form font is missing, the renderer falls back to a generic family
(usually DejaVu or Liberation), which may have different character metrics —
causing text to overflow or be clipped in containers sized for the original font.

**Do not assume any specific font is pre-installed on the target system.**
Even fonts that appear standard (Liberation, DejaVu) may not be present on a
minimal Debian installation.

### Metric-compatible substitutes

For the most common Windows fonts, free metric-compatible substitutes are
available in the Debian/Ubuntu repositories:

| Windows/Adobe font | Substitute | Debian/Ubuntu package | Notes |
|-------------------|------------|----------------------|-------|
| Calibri | Carlito | `fonts-crosextra-carlito` | Metric-compatible |
| Cambria | Caladea | `fonts-crosextra-caladea` | Metric-compatible |
| Arial | Liberation Sans | `fonts-liberation` | Metric-compatible |
| Times New Roman | Liberation Serif | `fonts-liberation` | Metric-compatible |
| Courier New | Liberation Mono | `fonts-liberation` | Metric-compatible |
| Myriad Pro | Liberation Sans | `fonts-liberation` | Visual match only; not metric-compatible; text may overflow in narrow containers |
| Various | Noto families | `fonts-noto-core`, `fonts-noto-extra` | For non-Latin scripts |
| General fallback | DejaVu | `fonts-dejavu-core` | Final fallback |

"Metric-compatible" means the substitute has identical character widths to the
original, so text wraps and fits in identically-sized containers.  Layout
differences from a non-metric substitute are much harder to fix.

The CSS `@font-face` rules in `extract_xfa.mjs` map common Windows font names
to their substitutes via `local("substitute name")`.  This only works if the
substitute font is actually installed on the host system.

### Debian package integration

The fonts above must be listed as `Depends:` in the Debian package control file
(`makedeb.sh` / `debian/control`).  **This is not yet done** — integration with
the packaging is deferred until this feature is merged into the production branch.

When that work is done, add the following to the Depends line in the package:

```
fonts-crosextra-carlito,
fonts-crosextra-caladea,
fonts-liberation,
fonts-dejavu-core,
fonts-noto-core
```

All of these packages are available in Debian 11+ and Ubuntu 20.04+.
They are free/libre licensed (SIL Open Font Licence or equivalent).

### WeasyPrint installation

WeasyPrint is not in the Debian package's current Python venv.  When
integration is done, add `weasyprint` to the appropriate `requirements.txt`
and ensure the postinst script installs it (as done for the editor feature).

The system package `python3-weasyprint` exists in Ubuntu 24.04 but may be an
older version.  Install via pip to ensure version ≥68.0.

---

## Special Cases in HTML Generation

These are the non-trivial transformations applied in `nodeToHTML()`.

### 1. SVG shapes → CSS equivalents

pdfjs emits background boxes and rule lines as SVG elements.  WeasyPrint's SVG
support is incomplete and does not reliably render CSS properties (`fill`,
`stroke`) on SVG elements.  Two cases are handled by converting to CSS:

**Background rect** — `<svg><rect style="fill:…; stroke:…">`:

```html
<div style="position:absolute;top:0;left:0;width:100%;height:100%;
            box-sizing:border-box;background-color:#f3f3f3;
            border:0.5px solid #999999"></div>
```

**Rule line** — `<svg width="0.5px" height="100%"><line x1="50%" y1=0 x2="50%" y2="100%">`:
Converted to a zero-width div with a CSS border:

```html
<!-- vertical line -->
<div style="position:absolute;top:0;left:0;width:0;height:100%;
            border-left:0.5px solid #999999;overflow:visible"></div>
<!-- horizontal line -->
<div style="position:absolute;top:0;left:0;width:100%;height:0;
            border-top:0.5px solid #999999;overflow:visible"></div>
```

**Known limitation:** Any SVG that is not a single-rect or single-line shape
(e.g. a chart, logo, or diagram) will be silently dropped.  If a document
contains real SVG graphics, the SVG conversion logic in `nodeToHTML()` must
be extended to emit a real `<svg>` element.

### 2. xfaRich numbered list alignment

For pages with a numbered list of items alongside a grid of input fields,
pdfjs places the numbers in an xfaRich `div[style="display:flex; flex-direction:column"]`
containing one `<p>` per item.  Each `<p>` ends with a `<br>`, which doubles
the line count and causes misalignment with sibling input rows.

Fix: if the xfaRich container is a flex column with more than 5 `<p>` children:
1. Set `height: 100%` on the container
2. Set `flex: 1 0 0; overflow: hidden; min-height: 0` on each `<p>`
3. Strip `<br>` children from each `<p>`

**Known limitation:** The threshold of 5 `<p>` children is arbitrary.  A
different document might have a short numbered list (≤5 items) that should also
get this treatment, or a long non-list flex column that incorrectly triggers it.

### 3. "Adobe Reader" overlay suppression

XFA PDFs often embed a warning element for non-Adobe viewers:
"Please note: this form requires Adobe Reader…".  Since we render the content
ourselves, this must be suppressed.

Fix: if the text content of a node (up to depth 4) contains "Adobe Reader",
emit an empty string.

**Known limitation:** The depth limit of 4 is tuned to one specific form
structure.  In another document, the text may be nested more deeply and the
check will miss it.  The exact warning text may also differ between documents or
be localised.

### 4. Blob URL resolution for embedded images

pdfjs registers embedded images as `blob:nodedata:…` URLs via
`URL.createObjectURL`.  These URLs are only valid within the same Node.js
process that created them, and WeasyPrint cannot access them.

Fix: before serialising a page, walk the tree and replace any `blob:` src with
a base64 data URI by calling `fetch(blobUrl)`.

### 5. CSS gradient backgrounds

pdfjs sometimes emits gradient backgrounds as `style.backgroundColor = "linear-gradient(…)"`.
`background-color` does not accept gradient values (only `background` does),
so browsers accept it as an extension but WeasyPrint correctly rejects it.

Fix: in `styleToCSS()`, detect `background-color` with a gradient value and
emit `background` instead.  This is handled in the `styleToCSS` function in
`extract_xfa.mjs`.

### 6. `.xfaPage` → `.xfaLayer` wrapper

Each `xfaPage` div's children are wrapped in a `<div class="xfaLayer">`.
Without this, the `.xfaLayer *` CSS resets from pdfjs do not activate and the
layout breaks completely (font inheritance fails, backgrounds appear, etc.).

---

## Known Issues and Workarounds

### WeasyPrint `justify-content: center` bug

**Symptom:** Label text in certain layouts appears upside-down.

**Root cause:** WeasyPrint 68.x has a bug where `justify-content: center` in a
`flex-direction: column` container renders text upside-down.

**Workaround:** Override all `.xfaRich` to `justify-content: flex-start !important`.

**Impact:** Labels that should be vertically centred are instead top-aligned.
Usually invisible at small container heights but may be noticeable in taller
containers.

**When to revisit:** Check the WeasyPrint changelog for fixes to flex column
vertical alignment.  If fixed, remove the `justify-content: flex-start !important`
override and test affected pages.

### Font metric differences

**Symptom:** Text overflows its container box, or is clipped at the right edge.

**Root cause:** The substitute font does not have identical character metrics to
the font specified in the form.

**Fix:** Check which font the form specifies (look at `font-family` in `style`
objects in the page JSON).  Find a metric-compatible substitute and add a
`@font-face` rule with `local("substitute")` to the CSS overrides section in
`extract_xfa.mjs`.  Then ensure the substitute font is installed (see Font
Dependencies).

### Header z-ordering

**Symptom:** Absolutely-positioned header elements (title, warning box) overlap
incorrectly on the first page of some forms.

**Root cause:** Both elements are `position: absolute` with overlapping vertical
extents.  WeasyPrint renders them in document order without the browser's z-index
stacking context adjustments.

**Status:** Low priority cosmetic issue; no fix applied.

### Data-driven subform repetition not rendered

**Symptom:** A form with repeating sections (e.g. multiple line items in an
invoice) shows only one instance of the repeating section, even if the PDF's
dataset contains data for multiple instances.

**Root cause:** XFA supports data-driven subform instantiation: if the dataset
contains N elements matching a repeating `<subform>` template (controlled by
`<occur min="0" max="N">`), XFA renders N instances of the subform.  This
feature requires the XFA engine to perform full data binding, merging the
`<xfa:data>` stream with the form template.

pdfjs only partially implements XFA data binding.  It respects `occur initial="N"`
to create the initial count of instances, but does not enumerate the dataset to
expand additional instances beyond that initial count.  The rendered tree
returned by `page.getXfa()` therefore contains only as many subform instances
as `occur initial` specifies (typically 1).

**Workaround:** None currently implemented.  This is a pdfjs limitation.
The output will show the first instance of each repeating subform but omit
additional data-bound instances.  Forms that rely heavily on dynamic repetition
will be materially incomplete.

**When to revisit:** Monitor pdfjs-dist release notes for improvements to XFA
data binding support.  The relevant pdfjs source is in
`src/core/xfa/bind.js` (data binding) and `src/core/xfa/xfa_object.js`
(`occur` handling).

### WeasyPrint warnings (non-fatal, seen with pdfjs-dist 5.5)

| Warning | Cause | Impact |
|---------|-------|--------|
| `@media screen and (forced-colors: active)` parse error | WeasyPrint parses `**` inside media query incorrectly | None — only affects high-contrast mode |
| `Invalid or unsupported selector '.xfaLayer *:required'` | WeasyPrint does not support `*:required` | None — only affects required-field outlines in browser |
| `Ignored fill/stroke-width/stroke` | SVG presentation attributes on non-SVG elements | None — already handled by SVG→CSS conversion |
| `Anchor defined twice` | Duplicate `id` attributes across pages | None |

---

## Integration with the Node.js Server

The conversion is not yet integrated into the scanservjs server.  When
integration is ready:

```javascript
const { execFile } = require('child_process');
const path = require('path');

const XFA_CONVERT = path.join(__dirname, '../xfa-convert');

async function convertXfaPdf(inputPath, outputPath) {
  await execFile(
    'python3',
    [path.join(XFA_CONVERT, 'convert.py'), inputPath, outputPath],
    { cwd: XFA_CONVERT }
  );
}
```

### Temp file isolation

The `extract_xfa.mjs --outdir <dir>` flag writes per-request temp files to a
caller-supplied directory.  For concurrent server use, pass a unique temp
directory per request (e.g. `os.tmpdir() + '/xfa_' + requestId`).

### Memory and CPU

- **Node.js extraction:** pdfjs loads the entire PDF into memory.  For a typical
  multi-page A4 form, peak RSS is ~150 MB.  On low-memory ARM devices (1 GB),
  limit concurrent XFA conversions to 1 (via a semaphore or queue) to avoid OOM.
- **WeasyPrint:** peak RSS is ~120 MB for a similar document.
- **Combined:** ~270 MB peak.  Budget 5–10 s on an ARM Cortex-A72.

---

## Approach History (summary)

### Attempt 1 — reportlab renderer

Parsed pdfjs XFA JSON and re-drew using reportlab's canvas API.  Result: readable
but significant rendering failures (two-column bleed, border properties, relative
units, transform issues).  Not worth continuing — too much CSS complexity to
re-implement by hand.

### Attempt 2 — WeasyPrint with minimal CSS

Serialised the pdfjs tree to HTML with a minimal `<style>` block.  Result:
two key failures:
1. Input fields rendered as solid blue rectangles (the `--xfa-unfocused-field-background` CSS variable).
2. Layout broken — font properties not inherited (missing `.xfaLayer *` resets).

Chrome rendered the same broken output, proving the HTML was wrong rather than
WeasyPrint.

### Attempt 3 — WeasyPrint with full pdfjs XFA CSS (current)

Embedded the complete XFA CSS from pdfjs, overrode the blue fill variable,
added the `.xfaLayer` wrapper, and applied print-friendly overrides.  This
produced a dramatically better output:

- Clean multi-column layouts
- All input fields rendered as bordered empty rectangles
- Full paragraph text readable without truncation
- Section headings, field labels, and placeholder text all correct

Subsequent sessions fixed additional issues (section backgrounds, numbered list
alignment, upside-down text) via special-case handling in `nodeToHTML`.

---

## File Map

| File | Purpose |
|------|---------|
| `xfa-convert/extract_xfa.mjs` | Step 1: Node.js XFA extractor + HTML generator |
| `xfa-convert/convert.py` | Full pipeline wrapper: extraction + WeasyPrint |
| `xfa-convert/setup.sh` | One-time environment setup (npm, .venv, fonts) |
| `xfa-convert/requirements.txt` | Python dependencies (WeasyPrint) |
| `xfa-convert/package.json` | Node.js dependencies (pdfjs-dist) |
| `xfa-convert/.gitignore` | Excludes `node_modules/`, `.venv/`, generated files |
| `docs/xfa-rendering.md` | This document |
| `docs/AGENT.md` | Step-by-step debugging guide for AI agents |
