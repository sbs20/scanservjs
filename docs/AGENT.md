# AGENT.md — AI Guidance for XFA Rendering Debugging

This file tells an AI agent (Claude or similar) how to diagnose and fix
rendering problems when converting an XFA PDF to a static PDF using this
pipeline.

Read `docs/xfa-rendering.md` first for full background.  This file assumes
you understand the pipeline architecture.

---

## Step 0: Understand the output

The pipeline produces a static PDF.  Before debugging, you need to be able to
*see* what is wrong.  Use ImageMagick to render individual pages to JPEG:

```bash
convert -density 150 output.pdf[0] page1.jpg    # page 1 (0-indexed)
convert -density 150 output.pdf[11] page12.jpg  # page 12
```

Read the JPEGs using your image-viewing tools.  Compare the expected form layout
against what you see.  If you have the original PDF open in Adobe Reader (or
another viewer that supports XFA), take reference screenshots at the same
resolution for comparison.

---

## Step 1: Identify the page and element

Describe the problem precisely:
- Which page number?
- Which section/field label?
- What does it look like? (missing, wrong position, wrong colour, clipped, etc.)
- What should it look like?

---

## Step 2: Find the XFA tree node

The extraction step writes `page-N.json` for each page.  These files contain
the raw pdfjs XFA tree.

```bash
# Run extraction to get page-N.json files
node xfa-convert/extract_xfa.mjs test.pdf --outdir /tmp/xfa_debug
```

Now search for the element:

```bash
# Search for a field label by text
grep -r '"value": "First name"' /tmp/xfa_debug/

# Search for an element class
grep -r '"xfaRich"' /tmp/xfa_debug/page-3.json | head -20
```

The JSON files have the full tree.  Read the relevant page file and trace the
path from the root to the problematic element.

---

## Step 3: Reproduce in the browser (Chrome)

Open `xfa_pages.html` (generated in the same outdir) in Chrome DevTools.

```bash
# Generate the HTML
node xfa-convert/extract_xfa.mjs test.pdf --outdir /tmp/xfa_debug
# Then open /tmp/xfa_debug/xfa_pages.html in Chrome
```

If Chrome also renders it incorrectly, the bug is in the HTML generation
(`extract_xfa.mjs`).  If Chrome is correct and WeasyPrint is wrong, the bug is
a WeasyPrint limitation.

---

## Step 4: Common rendering problems and fixes

### Problem: Element is invisible

Checklist:
1. Is the element's CSS `visibility: hidden` or `display: none`?
2. Is the element outside the page bounds (negative `left` or `top`)?
3. Is the element clipped by a parent with `overflow: hidden`?
4. Is the background colour the same as the text colour?

For `.xfaPrintOnly` elements: these must be visible in print output.
The CSS override `.xfaPrintOnly { display: block }` should handle this.
Check that the override is present in `extract_xfa.mjs`.

### Problem: Form fields appear as blue rectangles

The CSS variable `--xfa-unfocused-field-background` defaults to a blue SVG
tile.  The override `:root { --xfa-unfocused-field-background: none }` must be
present.  Check `extract_xfa.mjs`.

### Problem: Section background or border missing

pdfjs emits section backgrounds as `<svg><rect fill="…" stroke="…">`.
WeasyPrint ignores SVG `fill` as a CSS property.

Fix: add special-case handling in `nodeToHTML()` to detect an SVG with a
single `<rect>` child and emit a CSS background `<div>` instead.  See the
existing implementation in `extract_xfa.mjs` and `docs/xfa-rendering.md`.

### Problem: Text in the wrong position

1. Check the element's `style.top` and `style.left` in the JSON tree.
2. Check for a CSS `transform: translate(…)` — WeasyPrint supports this.
3. Check if an ancestor has `position: absolute` without the element having
   its own position; the browser and WeasyPrint may differ on stacking.

### Problem: Text is clipped or truncated

1. Check the container's `style.height` and compare to the text size.
2. Does the container have `overflow: hidden`?  If the text is larger than the
   container, it will be clipped.
3. Is the xfaRich container's `padding-top` larger than its height?
   Fix by zeroing the padding in the CSS overrides:
   `.xfaRich { padding-top: 0 !important; padding-bottom: 0 !important; }`

### Problem: Text overflows its container box

Most likely cause: the font specified in the form is not installed, and the
fallback font has wider characters.  Inspect the `font-family` in the element's
style.  Find a metric-compatible substitute for that font and add a `@font-face`
rule.  See the Font Dependencies section in `docs/xfa-rendering.md`.

```bash
# Check which fonts are referenced by the form on a given page
grep -o '"fontFamily":"[^"]*"' /tmp/xfa_debug/page-1.json | sort | uniq

# Check what's installed
fc-list | sort
```

### Problem: Numbered list rows misalign with input fields

The `pCount > 5` path in `nodeToHTML()` handles this.  If the threshold is
wrong (too low or too high), adjust it.  See `docs/xfa-rendering.md`,
section "xfaRich numbered list alignment".

### Problem: Text is upside-down

WeasyPrint 68.x bug: `justify-content: center` in `flex-direction: column`
renders text upside-down.  The CSS override `.xfaRich { justify-content: flex-start !important }`
must be present in `extract_xfa.mjs`.

### Problem: Image is missing

pdfjs embeds images as `blob:nodedata:…` URLs.  The `resolveBlobs()` function
in `extract_xfa.mjs` converts these to base64 data URIs before writing the HTML.
If an image is missing:
1. Check the node's `attributes.src` in the JSON.
2. If it is still `blob:…` in the JSON, the extraction ran without blob
   resolution (this should not happen normally).
3. If it is empty (`""`), the fetch failed — check if pdfjs registered the blob
   correctly.

---

## Step 5: Editing `extract_xfa.mjs`

Most fixes involve editing either:
- The CSS overrides at the bottom of the `XFA_CSS` template literal
- The `nodeToHTML()` function for structural transformations

After each edit, regenerate and re-render:

```bash
node xfa-convert/extract_xfa.mjs test.pdf --outdir /tmp/xfa_debug
.venv/bin/weasyprint /tmp/xfa_debug/xfa_pages.html /tmp/xfa_debug/output.pdf
convert -density 150 /tmp/xfa_debug/output.pdf[N] /tmp/page_N.jpg
```

Iterate until the page looks correct, then verify that no previously correct
pages have regressed by checking a representative sample.

Always test against all available test cases (see `output/test-cases.md` in the
project sandbox directory) when changing shared code paths.

---

## Step 6: Document the fix

After fixing, update `docs/xfa-rendering.md`:
- Add the new special case to the "Special Cases" section
- Note any new known limitations
- If a known issue is resolved, move it from "Known Issues" to the special
  cases section or remove it

---

## Boundaries of what this pipeline can fix

Some rendering problems cannot be fixed without changing the approach entirely:

- **Complex SVG graphics:** The current pipeline drops SVGs with more than one
  `<rect>` child.  Forms with logos, diagrams, or charts require proper SVG
  rendering support.
- **XFA JavaScript / FormCalc:** Calculated field values are not evaluated.
  Fields with calculated content will appear blank.
- **Right-to-left text (Arabic, Hebrew):** WeasyPrint supports BiDi text but
  only if the correct fonts are installed.  Noto fonts (`fonts-noto-core`) cover
  most scripts.
- **PDF layers / optional content:** Not supported; all layers are collapsed.

---

## Quick reference: file locations

| Need | Command |
|------|---------|
| Raw XFA tree for page N | `page-N.json` in outdir |
| Generated HTML | `xfa_pages.html` in outdir |
| Render HTML to PDF | `.venv/bin/weasyprint xfa_pages.html output.pdf` |
| Render PDF page to JPEG | `convert -density 150 output.pdf[N] page.jpg` |
| Check installed fonts | `fc-list` |
| Check fonts in form | `grep -o '"fontFamily":"[^"]*"' page-N.json \| sort \| uniq` |
| Install font packages | `sudo apt-get install fonts-crosextra-carlito fonts-liberation fonts-dejavu-core` |
| Check WeasyPrint version | `.venv/bin/weasyprint --version` |
| List test cases | See `output/test-cases.md` in project sandbox |
