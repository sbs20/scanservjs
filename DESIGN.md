# Document Editor — Design & Implementation Plan

> **Revision 2** — Updated after user feedback and tool-chain research.

## 1. Overview

A document editor accessible from the Files tab that enables users to perform
common post-scan document assembly and page-level operations — the kind of
tasks that are painful with heavyweight tools but that dedicated scanner
software rarely provides.

**Design philosophy:** Quick fixes incidental to scanning. Not a PDF editor.
Not a DTP tool. A document assembler with page-level operations.

### 1.1 Entry Points

From the Files tab, the user can enter the editor in two ways:

1. **Multi-file merge:** Select multiple files (any mix of PDF, JPG, PNG, TIF)
   → click "Edit" in the toolbar → opens the editor with all selected files'
   pages concatenated in selection order.

2. **Single-file edit:** Click an "Edit" icon on an individual file (PDF or
   multi-page TIF) → opens the editor showing that document's pages. Save
   overwrites the original; "Save As" creates a new file.

In both cases, the editor presents the same UI: a page-level view of the
assembled document.

---

## 2. User Interface

### 2.1 Editor Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [Undo] [Redo] | [Add Pages...] [Add Blank]       │
│           [Duplex Merge ▾] [Reverse] | [Paper Size ▾]       │
│           [Save] [Save As] [Cancel]                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │  1  │  │  2  │  │  3  │  │  4  │  │  5  │  │  6  │    │
│  │     │  │     │  │     │  │     │  │     │  │     │    │
│  │thumb│  │thumb│  │thumb│  │thumb│  │thumb│  │thumb│    │
│  │     │  │     │  │     │  │     │  │     │  │     │    │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘    │
│  [↻ ↺ ✕]  (shown on hover/select for each page)            │
│                                                              │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                        │
│  │  7  │  │  8  │  │  9  │  │ 10  │                        │
│  │     │  │     │  │     │  │     │                        │
│  └─────┘  └─────┘  └─────┘  └─────┘                        │
│                                                              │
│  Status: 10 pages · Source: scan_2024-01-15.pdf + 2 images  │
└─────────────────────────────────────────────────────────────┘
```

**Key UI elements:**

- **Thumbnail grid:** Draggable page thumbnails in a responsive CSS grid.
  Multi-select via Ctrl/Shift-click or checkbox overlay. Touch-friendly drag
  on mobile.
- **Per-page actions:** Shown on hover/select — Rotate CW, Rotate CCW, Delete.
  Rotate applies only to the selected page(s).
- **Toolbar:** Document-level operations. Only operations applicable to the
  current state are enabled.
- **Page numbers:** Displayed below each thumbnail. Update live during
  drag-reorder.
- **Source indicators:** Small badge or subtitle on each thumbnail showing the
  original source file (helps when merging multiple documents).

### 2.2 Full-screen Dialog

The editor opens as a near-full-screen Vuetify dialog (matching the existing
preview dialog pattern: `width="95vw" max-width="1400px" height="92vh"`).
This keeps the user within the SPA and avoids route changes.

### 2.3 Mobile Considerations

- Thumbnail grid wraps naturally (CSS grid / flexbox).
- Toolbar collapses into an overflow menu (existing Vuetify pattern with
  `v-menu` on `smAndDown`).
- Drag-to-reorder works via touch events (use `vuedraggable` which wraps
  SortableJS with built-in touch support).
- Per-page actions accessible via long-press or selection + toolbar.

---

## 3. Operations

### 3.1 Page-Level Operations

| Operation | Applies to | Implementation |
|-----------|-----------|----------------|
| **Reorder** | Any page(s) | Drag-and-drop in thumbnail grid |
| **Delete** | Selected page(s) | Remove from page list |
| **Rotate CW/CCW** | Selected page(s) | 90° increments, tracked as metadata |
| **Add blank page** | Insert point | Insert blank page after selection or at end |
| **Add pages from file** | Document | File picker → append pages from another output file |

### 3.2 Document-Level Operations

| Operation | Description |
|-----------|------------|
| **Interleave** | Takes two halves of the page list and interleaves them (odd/even merge for duplex scanning) |
| **Swap pairs** | Swaps each pair of pages: (1,2)→(2,1), (3,4)→(4,3), etc. (fixes odd/even ordering mistakes) |
| **Reverse** | Reverses the entire page order (common for face-down ADF scanning) |

### 3.3 Paper Size / Fit Operations

When saving, the user can optionally specify a target paper size. This is
a document-level setting, not per-page.

**Options (presented as a simple dropdown + radio group):**

- **No adjustment** (default) — pages retain their original dimensions
- **Fit to page** — scale content proportionally to fit within target paper
  size, adding white margins as needed (no cropping)
- **Fill page** — scale content proportionally to fill target paper size,
  cropping overflow (center-crop)
- **Stretch to page** — stretch content to exactly match target paper size
  (distorts aspect ratio — useful for minor corrections)

The paper size list comes from the existing `config.paperSizes` already
available in the app context.

**Implementation:** See Section 7.3 for the two-tier approach using pikepdf
(OCR-safe MediaBox adjustment) and Ghostscript (content scaling fallback).

### 3.4 Duplex Merge Templates

Preset operations for the most common scanning workflow — scanning a two-sided
document on a simplex scanner:

| Template | Action |
|----------|--------|
| **Duplex merge (standard)** | Interleave with second half reversed (scan front sides 1,3,5..., flip stack, scan back sides ...6,4,2) |
| **Duplex merge (reverse)** | Interleave without reversing second half (for scanners that reverse ADF direction) |

Templates are applied as a single undoable action. Exposed as a dropdown
button in the toolbar.

**Typical duplex workflow:**
1. Scan all front sides → saves as `fronts.pdf`
2. Flip the paper stack
3. Scan all back sides → saves as `backs.pdf`
4. Select both files in Files tab → click Edit
5. Click "Duplex Merge (Standard)" → pages interleave correctly
6. Save as `document.pdf`

### 3.5 N-up Grid Layout (Phase 2)

Simple mechanism to arrange multiple images or scanned items (photos, ID cards,
business cards) into a grid on a single page. This is a distinct operation from
page reordering — it composites multiple source pages into fewer output pages.

| Layout | Description |
|--------|------------|
| **2-up** | 2 images side-by-side on a landscape page |
| **4-up** | 2×2 grid on a single page |
| **Custom grid** | User-specified rows × columns (stretch goal) |

**Implementation approach:** A small Python helper script using ReportLab's
`canvas.drawImage()` for JPEG passthrough (near-zero memory — embeds compressed
JPEG streams directly into PDF without decoding pixels). For non-JPEG inputs,
images are pre-converted to JPEG via ImageMagick before passing to ReportLab.

This deliberately converts content to raster — acceptable for photos and ID
cards where the source is already raster data. PDF pages with vector/OCR content
would need to be rasterized first (via `convert` or `gs`), which is a lossy
operation. The UI should warn when applying N-up to PDF sources.

**Memory cost:** ~8 MB for 4 × 2 MB JPEGs (just the compressed file data in
memory), compared to ~250 MB if ImageMagick decoded them with Q16. This makes
it safe on the 1 GB ARM device even for high-resolution scans.

**Scope:** Deferred to Phase 2 of implementation. The core value in v1 is page
assembly and duplex merge.

### 3.6 Replace Page

Instead of a dedicated "replace" button, the workflow is natural:

1. Delete the bad page
2. Use "Add Pages" to insert a new scan from the file list
3. Drag the new page to the correct position

This avoids adding UI complexity for a rarely-needed operation while still
fully supporting the workflow.

---

## 4. Architecture

### 4.1 Edit-List Model (Core Design Principle)

**The editor never modifies source data.** All editing operations manipulate
an in-memory edit list — a lightweight array of page descriptors. Source files
and extracted pages remain untouched on disk throughout the session. Only when
the user clicks "Save" does the server read the edit list and assemble the
final document.

This is crucial for:
- **Resource efficiency:** No intermediate files are created for reorder,
  delete, or rotate operations.
- **Undo/redo:** Simply swap edit-list snapshots (tiny JSON arrays).
- **Crash safety:** If the browser closes, source files are intact. Only the
  unsaved edit list is lost (acceptable — it's the user's in-progress work).
- **Disk longevity:** Minimizes writes. The only disk I/O during editing is
  thumbnail generation (lazy, cached).

### 4.2 Session Model

```
Client                          Server
  │                                │
  │  POST /api/v1/editor/sessions  │
  │  {files: ["scan1.pdf", ...]}   │
  │  ─────────────────────────────>│  Create session dir in temp/
  │  {sessionId, pages: [...]}     │  Extract page metadata + dimensions
  │  <─────────────────────────────│  (lazy extraction — see 4.4)
  │                                │
  │  GET .../sessions/:id/pages/   │
  │      :page/thumbnail           │
  │  ─────────────────────────────>│  Extract page on demand, generate
  │  <─ JPEG thumbnail ───────────│  and cache thumbnail
  │                                │
  │  (All edits are client-side    │
  │   edit-list manipulation —     │
  │   no server calls)             │
  │                                │
  │  POST .../sessions/:id/save    │
  │  {editList, filename, opts}    │
  │  ─────────────────────────────>│  Assemble final PDF from edit list
  │  {file: FileInfo}              │  using pikepdf + convert
  │  <─────────────────────────────│
  │                                │
  │  DELETE .../sessions/:id       │  Clean up temp files
  │  ─────────────────────────────>│
  │                                │
  │  (heartbeat every 2 min to     │
  │   keep session alive)          │
```

### 4.3 Page Representation (Client-Side Edit List)

Each page in the editor is represented as:

```javascript
{
  id: "uuid-v4",          // Stable identity for drag-and-drop / undo
  source: "scan1.pdf",    // Original source filename
  sourceType: "pdf",      // "pdf", "image"
  pageNum: 3,             // 1-based page number in source (1 for images)
  rotation: 0,            // Cumulative rotation: 0, 90, 180, 270
  width: 595,             // Original width (points for PDF, pixels for image)
  height: 842,            // Original height
  isBlank: false          // True for inserted blank pages
}
```

All editing operations (reorder, delete, rotate, add blank) manipulate this
array. Only "Save" sends the final arrangement back to the server.

### 4.4 Lazy Page Extraction Strategy

Session creation does **not** extract all pages upfront. Instead:

1. **Session creation** (`POST /sessions`):
   - For PDFs: run `pikepdf` to read page count and MediaBox dimensions.
     This is fast (~ms) and reads only PDF metadata, not page content.
   - For images: read dimensions via `identify` (ImageMagick) or PIL.
   - Return the page list with dimensions. No pages extracted yet.

2. **Thumbnail request** (`GET /sessions/:id/pages/:idx/thumbnail`):
   - If thumbnail is already cached → return it.
   - If not → extract that single page to a temp file, generate thumbnail,
     cache it, return it.
   - For PDFs: `pikepdf` can extract a single page to a temp file on demand.
   - For images: generate thumbnail directly from source via `convert`.

3. **Save** (`POST /sessions/:id/save`):
   - Extract only the pages that appear in the final edit list.
   - Pages the user deleted are never extracted at all.

**Benefits:**
- Session creation is near-instant (metadata only).
- Disk usage grows incrementally as the user scrolls through thumbnails.
- A 200-page PDF doesn't create 200 temp files upfront — only visible pages
  are extracted.
- Deleted pages are never extracted, saving disk I/O entirely.

### 4.5 Server-Side Session Directory

```
data/temp/editor-{sessionId}/
├── pages/               # Extracted individual page files (on-demand)
│   ├── page-001.pdf     # Extracted when thumbnail first requested
│   ├── page-005.jpg     # Symlink to source image (or copy)
│   └── ...
├── thumbs/              # Thumbnails for UI (on-demand, cached)
│   ├── page-001.jpg
│   └── ...
└── manifest.json        # Session metadata, timestamps
```

**Image source files:** Symlinked (not copied) from the output directory into
the session's `pages/` directory. This avoids doubling disk usage for images.
If the filesystem doesn't support symlinks, fall back to hardlinks, then copy.

### 4.6 Undo/Redo

Implemented entirely client-side using a simple state snapshot stack:

```javascript
class UndoStack {
  constructor() {
    this.history = [];   // Array of page-list snapshots
    this.pointer = -1;   // Current position
  }

  push(pageList) {
    // Truncate any redo history beyond current pointer
    this.history = this.history.slice(0, this.pointer + 1);
    // Deep-clone and push
    this.history.push(JSON.parse(JSON.stringify(pageList)));
    this.pointer++;
  }

  undo() { return this.pointer > 0 ? this.history[--this.pointer] : null; }
  redo() { return this.pointer < this.history.length - 1 ? this.history[++this.pointer] : null; }
  get canUndo() { return this.pointer > 0; }
  get canRedo() { return this.pointer < this.history.length - 1; }
}
```

Each page object is ~100 bytes JSON. Even 200 undo steps for a 500-page
document would use ~10 MB — negligible. No server interaction needed.

**Keyboard shortcuts:** Ctrl+Z for undo, Ctrl+Shift+Z (or Ctrl+Y) for redo.

---

## 5. API Endpoints

All under `/api/v1/editor/`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions` | Create editing session from selected files |
| `GET` | `/sessions/:id` | Get session metadata (page list, source info) |
| `GET` | `/sessions/:id/pages/:idx/thumbnail` | Get page thumbnail (lazy generation) |
| `POST` | `/sessions/:id/pages` | Add pages from another file to the session |
| `POST` | `/sessions/:id/save` | Assemble and save the final document |
| `DELETE` | `/sessions/:id` | Destroy session and clean up temp files |

### 5.1 Session Creation

**Request:**
```json
POST /api/v1/editor/sessions
{
  "files": ["scan_2024-01-15.pdf", "photo.jpg"]
}
```

**Response:**
```json
{
  "sessionId": "a1b2c3d4",
  "pages": [
    {"source": "scan_2024-01-15.pdf", "sourceType": "pdf", "pageNum": 1, "width": 595, "height": 842},
    {"source": "scan_2024-01-15.pdf", "sourceType": "pdf", "pageNum": 2, "width": 595, "height": 842},
    {"source": "scan_2024-01-15.pdf", "sourceType": "pdf", "pageNum": 3, "width": 595, "height": 842},
    {"source": "photo.jpg", "sourceType": "image", "pageNum": 1, "width": 3024, "height": 4032}
  ]
}
```

Note: no page extraction happens here. Only metadata (page count, dimensions)
is read. Response is near-instant.

### 5.2 Add Pages

Allows adding pages from another output file to an existing session.

**Request:**
```json
POST /api/v1/editor/sessions/:id/pages
{
  "file": "scan_2024-01-16.pdf",
  "pageRange": "3-5"
}
```

### 5.3 Save

**Request:**
```json
POST /api/v1/editor/sessions/:id/save
{
  "pages": [
    {"source": "scan_2024-01-15.pdf", "pageNum": 3, "rotation": 90},
    {"source": "scan_2024-01-15.pdf", "pageNum": 1, "rotation": 0},
    {"source": "blank", "pageNum": 1, "rotation": 0},
    {"source": "photo.jpg", "pageNum": 1, "rotation": 270}
  ],
  "filename": "assembled.pdf",
  "paperSize": null,
  "fitMode": "none"
}
```

---

## 6. Resource Management

### 6.1 Dynamic Resource Monitoring

Rather than imposing an arbitrary hard page limit, the editor monitors
available resources and adapts:

**Server-side checks (at session creation and periodically):**

```javascript
// Available memory (Linux)
const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
const available = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;

// Available disk space
const { available: diskAvail } = fs.statfsSync(config.tempDirectory);
```

**Thresholds (configurable):**

| Resource | Warning | Reject new work |
|----------|---------|----------------|
| Available memory | < 200 MB | < 100 MB |
| Available disk | < 500 MB | < 200 MB |

When approaching limits:
- **Warn** the user ("Low memory — consider saving and re-editing with fewer
  pages").
- **Refuse** to create new sessions or add more pages if critically low.
- **Never** silently fail or corrupt data.

**Client-side adaptation:**
- For documents with many pages (>50), use virtualized scrolling — only render
  thumbnail `<img>` elements for pages in/near the viewport. Use
  IntersectionObserver to load thumbnails lazily.
- This keeps DOM size manageable regardless of page count.

### 6.2 Memory Budget for External Tools

| Tool | Typical RAM | Max RAM | Notes |
|------|------------|---------|-------|
| pikepdf (Python) | 5-35 MB | ~50 MB | C++ backend (libqpdf), processes PDF structure only |
| ImageMagick convert | 20-50 MB | ~100 MB | For thumbnail generation (single image at a time) |
| jpegtran | 2-5 MB | ~10 MB | Lossless JPEG rotation, tiny footprint |
| ReportLab (N-up) | 10-20 MB | ~30 MB | JPEG passthrough, no pixel decoding |
| Ghostscript | 30-80 MB | ~150 MB | Only used for content-scaling paper-size changes |

**Compare with pdftk-java:** 50-100+ MB (JVM baseline) + document-proportional
heap. pikepdf is 3-10× lighter for the same operations.

**Sequential execution:** All external tools are invoked sequentially (never
in parallel) to keep peak memory bounded. The save pipeline processes one page
at a time where possible.

### 6.3 Disk Usage Strategy (SD Card Awareness)

| Concern | Mitigation |
|---------|-----------|
| Temp file proliferation | Lazy extraction — only extract pages that are viewed or saved |
| Source duplication | Symlink image files instead of copying |
| Thumbnail accumulation | Generate on demand, cap at ~256px, JPEG quality 60 |
| Failed saves leave garbage | Write to temp file first, atomic rename to final destination |
| Session abandonment | TTL-based cleanup (see 6.4) + startup cleanup |
| SD card write amplification | Minimize random writes; batch operations where possible |

**Estimated disk usage per session:**
- 200-page scanned PDF (150 MB): ~500 KB metadata + thumbnails grow
  incrementally (~20 KB each × pages viewed).
- Full extraction (at save time) of all 200 pages: ~150 MB temp (same as
  source since pikepdf extraction is structural, not re-encoding).
- The temp directory is cleaned up immediately after save completes.

### 6.4 Orphan Session Cleanup

Sessions can become orphaned if the user closes the browser, the network
disconnects, or the server restarts.

**Strategy:**

1. **manifest.json timestamps:** Each session records `createdAt` and
   `lastAccessedAt`. Updated on every API call to that session.
2. **Startup cleanup:** On server start, delete any `editor-*` directories
   in `config.tempDirectory`. No persistent state survives a restart.
3. **TTL-based expiry:** A lightweight interval (every 5 minutes) checks for
   sessions older than 1 hour (configurable) with no recent access. Deletes
   the entire session directory.
4. **Client heartbeat:** The editor UI sends a lightweight `GET` to the
   session endpoint every 2 minutes to update `lastAccessedAt`.
5. **Single-session limit:** Only one editor session active at a time. Creating
   a new session while one exists prompts the user to close the existing one
   (or force-close it).

---

## 7. Tool Chain

### 7.1 Primary: pikepdf (Python, backed by libqpdf C++)

**pikepdf** replaces pdftk-java as the primary PDF manipulation tool. It
provides all needed operations with 3-10× lower memory overhead (no JVM).

| Operation | pikepdf approach | Memory |
|-----------|-----------------|--------|
| Get page count | `len(Pdf.open(f).pages)` | ~5 MB |
| Get page dimensions | `page.mediabox` | ~5 MB |
| Extract single page | `dst.pages.append(src.pages[n])` ; `dst.save()` | ~10 MB |
| Rotate page | `page.rotate(90, relative=True)` | metadata-only |
| Merge pages | Append pages from multiple sources | ~20-50 MB |
| Split PDF | Iterate pages, save each | sequential, ~10 MB peak |

**Availability:**
- Debian Bookworm (stable): `python3-pikepdf` 6.0.0 — arm64, armhf, armel
- Debian Bullseye (oldstable): `python3-pikepdf` — available
- Ubuntu 24.04: `python3-pikepdf` 8.7.1 — available
- Depends on `libqpdf` (C++ library, already installed on this system)

**Installation:** Added as a dependency in the Debian package, or installed
via `pip install pikepdf` into the project's `.venv/`.

**Lossless guarantees:** pikepdf/qpdf operates on PDF structure (object
graphs) without interpreting or re-rendering page content. All OCR text layers,
fonts, vector graphics, and embedded images pass through untouched.

### 7.2 Image Handling: ImageMagick + jpegtran

| Operation | Tool | Notes |
|-----------|------|-------|
| Image thumbnails | `convert source[0] -resize 256 -quality 60 thumb.jpg` | One at a time, ~20 MB |
| Image → single-page PDF | `convert img.jpg img.pdf` | For assembly into mixed PDF |
| JPEG rotation | `jpegtran -rotate 90 -perfect -outfile out.jpg in.jpg` | **Lossless** — no re-encoding |
| Non-JPEG rotation | `convert in.png -rotate 90 out.png` | Re-encodes, lossless for PNG/TIF |
| Blank page creation | `convert xc:white -page <size> blank.pdf` | Tiny file |
| Multi-page TIFF split | `convert input.tif[N] page-N.tif` | Extract single frame |

**jpegtran** (`libjpeg-turbo-progs`) is an optional dependency with graceful
fallback to ImageMagick. Available in Debian `main` since Jessie (2015) for
all ARM architectures. Uses NEON SIMD on ARM — extremely fast.

**Tool detection at startup:**
```javascript
const hasJpegtran = Process.canExecute('jpegtran -version');
const rotateJpeg = hasJpegtran
  ? (input, degrees, output) => `jpegtran -rotate ${degrees} -perfect -copy all -outfile '${output}' '${input}'`
  : (input, degrees, output) => `convert '${input}' -rotate ${degrees} '${output}'`;
```

### 7.3 Paper Size Adjustment: Two-Tier Approach

Paper size adjustment is the trickiest operation to get right because of the
OCR preservation requirement.

**Tier 1: pikepdf MediaBox adjustment (OCR-safe, no content scaling)**

For cases where the user wants to change the declared page size without scaling
content (e.g., an A4 scan that's slightly off-size, or adding margins):

```python
import pikepdf
pdf = pikepdf.Pdf.open('input.pdf')
for page in pdf.pages:
    page.mediabox = pikepdf.Array([0, 0, target_width_pts, target_height_pts])
    # Optionally adjust CropBox too
pdf.save('output.pdf')
```

This modifies only the page dictionary — zero impact on content, fonts, OCR,
or embedded images. Instant, negligible memory.

**Tier 2: Ghostscript content scaling (when the user explicitly wants scaling)**

For "Fit to page" / "Fill page" / "Stretch" modes where content must be
rescaled to match the target dimensions:

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
   -dPDFFitPage -dFIXEDMEDIA \
   -dDEVICEWIDTHPOINTS=595 -dDEVICEHEIGHTPOINTS=842 \
   -sOutputFile=output.pdf -dNOPAUSE -dBATCH input.pdf
```

**OCR warning:** Ghostscript re-renders the PDF through its interpreter. While
it preserves text as text objects (not rasterizing), it can damage Tesseract's
OCR text layers (invisible positioned text). The UI should display a warning
when content scaling is selected:

> "Content scaling may affect searchable text in OCR'd documents. For best
> OCR preservation, use 'No adjustment' or 'Set page size only' (no scaling)."

**Decision tree in the save pipeline:**

```
Paper size requested?
├── No → skip (default)
├── "Set size only" → pikepdf MediaBox (Tier 1, OCR-safe)
└── "Fit/Fill/Stretch" → Ghostscript (Tier 2, with OCR warning)
```

### 7.4 N-up Grid Assembly: ReportLab (Phase 2)

For compositing multiple images into a grid layout:

```python
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

c = canvas.Canvas("nup.pdf", pagesize=landscape(A4))
# drawImage uses JPEG passthrough — no pixel decoding
c.drawImage("scan1.jpg", x1, y1, cell_w, cell_h)
c.drawImage("scan2.jpg", x2, y2, cell_w, cell_h)
c.save()
```

**Memory:** ~8 MB for 4 × 2 MB JPEGs. The JPEG data is embedded directly
into the PDF without decoding to pixels. Compare: ImageMagick `montage` would
use ~250 MB (Q16) for the same 4 images.

**For non-JPEG inputs:** Pre-convert to JPEG via `convert` (one at a time),
then feed to ReportLab. This adds one re-encoding step but keeps memory
bounded.

**ReportLab availability:** Already installed system-wide (`reportlab 4.1.0`,
`Pillow 10.2.0`). Also available in Debian repos as `python3-reportlab`.

### 7.5 pdftk-java as Fallback

If pikepdf is not available (older system, minimal install), the editor falls
back to pdftk-java for PDF operations. The code abstracts PDF operations
behind a tool-agnostic interface:

```javascript
// Abstract interface (in editor-session.js)
class PdfTool {
  async getPageCount(file) { ... }
  async getPageDimensions(file, page) { ... }
  async extractPage(file, page, output) { ... }
  async rotatePage(file, page, degrees, output) { ... }
  async mergePages(files, output) { ... }
}

// Implementations
class PikepdfTool extends PdfTool { ... }  // preferred
class PdftkTool extends PdfTool { ... }    // fallback
```

**Tool detection at startup:** Try `python3 -c "import pikepdf"`. If it
succeeds, use pikepdf. Otherwise, try `pdftk --version`. If neither is
available, the editor feature is disabled (with a helpful message about
installing dependencies).

**JVM memory limit for pdftk fallback:** When using pdftk-java, set
`_JAVA_OPTIONS=-Xmx128m` in the process environment to cap JVM heap.

---

## 8. Assembly Pipeline (Save)

When the user clicks Save, the server receives the edit list and assembles
the final PDF. This is the only operation that does significant I/O.

### 8.1 Pipeline Steps

```
Edit List → Prepare Pages → Merge → (Optional: Paper Size) → Atomic Write
```

**Step 1: Prepare pages (sequential, one at a time)**

For each page in the edit list:

- **PDF page, rotation=0:** Extract from source via pikepdf (if not already
  extracted for thumbnail). Write to `pages/prepared-NNN.pdf`.
- **PDF page, rotation≠0:** Extract and rotate in one pikepdf operation.
  Lossless — only modifies page dictionary.
- **Image, rotation=0:** Convert to single-page PDF via `convert`.
- **Image (JPEG), rotation≠0:** Rotate losslessly with `jpegtran`, then
  convert to PDF. (If jpegtran unavailable, rotate during convert.)
- **Image (non-JPEG), rotation≠0:** Rotate and convert in one `convert` call.
- **Blank page:** Create via `convert xc:white -page <size> blank.pdf`.

Each page is processed and written individually. Peak memory: one page at a
time (~10-50 MB depending on tool).

**Step 2: Merge all prepared pages**

```python
# pikepdf merge — processes PDF structure, not content
output = pikepdf.Pdf.new()
for prepared_file in prepared_files:
    src = pikepdf.Pdf.open(prepared_file)
    output.pages.extend(src.pages)
output.save('assembled.pdf')
```

Memory: proportional to the number of PDF object references, not page content.
A 200-page merge might use ~30-50 MB.

**Step 3: Paper size adjustment (optional)**

Apply Tier 1 (pikepdf MediaBox) or Tier 2 (Ghostscript) per Section 7.3.

**Step 4: Atomic write to output directory**

```javascript
// Write to temp file in output directory
const tempPath = `${config.outputDirectory}/.tmp-${sessionId}.pdf`;
await fs.promises.rename(assembledPath, tempPath);
// Atomic rename to final destination
await fs.promises.rename(tempPath, `${config.outputDirectory}/${filename}`);
// Invalidate thumbnail cache
const thumbPath = `${config.thumbnailDirectory}/${filename}`;
if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
```

If saving over an existing file (single-file edit → Save), the atomic rename
ensures the old file is fully replaced — never a partial write.

### 8.2 Progress Reporting

For large documents, the save operation may take several seconds. Report
progress via the response (polling) or chunked response:

**Option A (simpler):** The save endpoint returns immediately with a job ID.
The client polls `GET /sessions/:id/save-status` for progress.

**Option B (simpler still):** Show a loading mask with an indeterminate
progress bar (existing `$emit('mask', 1)` pattern). For most documents (< 50
pages), save completes in under 3 seconds. Only consider progress reporting
if testing shows unacceptable waits.

**Recommendation:** Start with Option B. Add polling if needed.

---

## 9. Lossless Transformation Matrix

| Source type | Operation | Tool | Lossless? |
|-------------|-----------|------|-----------|
| PDF page | Read metadata | pikepdf | Yes — reads PDF dictionary only |
| PDF page | Extract | pikepdf | Yes — structural extraction |
| PDF page | Rotate | pikepdf `.rotate()` | Yes — modifies page dictionary only |
| PDF page | Merge | pikepdf | Yes — structural merge |
| PDF page | Set page size | pikepdf MediaBox | Yes — modifies page dictionary only |
| PDF page | Scale to fit | Ghostscript -dPDFFitPage | **Mostly** — re-renders PDF; visible text preserved, OCR layers at risk |
| JPEG | Rotate | jpegtran | Yes — no re-encoding |
| JPEG | → PDF | convert / ReportLab | ReportLab: JPEG passthrough (lossless embed). convert: re-encodes. |
| PNG/TIF | Rotate | convert | Yes for lossless formats (PNG→PNG, TIF→TIF) |
| PNG/TIF | → PDF | convert | Embedded as-is in PDF |

**OCR preservation summary:** All pikepdf operations fully preserve OCR.
Ghostscript content scaling may damage OCR layers — clearly warned in UI.

---

## 10. Development Workflow

### Commit Strategy

Use **incremental commits** during initial development. The history will be
squashed before the first public release / upstream PR submission. Commit
messages should be concise and descriptive of the change (not conversational),
but they're primarily for developer orientation during active development —
not for a polished public history.

**Pattern:** `feat(editor): <what changed>` for features,
`fix(editor): <what>` for fixes, `refactor(editor): <what>` for restructuring.

> **TODO (pre-release):** Before the first full public announcement, squash
> the commit history into clean, reviewable commits and update this section
> to reflect the final commit policy.

---

## 11. Implementation Plan

### Phase 1: Core Infrastructure + Minimal UI

**Goal:** End-to-end working editor with basic operations.

**Server (app-server):** ✅ Complete
1. ✅ `editor/pdf_ops.py` — pikepdf wrapper (info, extract, extract-rotate, merge, blank)
2. ✅ `classes/pdf-tool.js` — abstract PDF operations interface
3. ✅ `classes/pikepdf-tool.js` — pikepdf implementation (Python child process)
4. ✅ `classes/pdftk-tool.js` — pdftk fallback implementation
5. ✅ `classes/editor-session.js` — session lifecycle, page extraction,
   manifest management, cleanup
6. ✅ `editor-api.js` — editor API methods, tool detection, single-session
7. ✅ `express-configurer.js` — 6 editor endpoints + startup/TTL cleanup

**Client (app-ui):**
1. Create `components/Editor.vue` — editor dialog with thumbnail grid
2. Create `classes/undo-stack.js` — undo/redo state management
3. Modify `components/Files.vue` — add "Edit" entry points
4. Add `vuedraggable@next` npm dependency
5. Add translation strings to `locales/en.json`

**Python (new):**
1. Create `editor/pdf_ops.py` — pikepdf wrapper script (invoked by Node.js
   via `Process.spawn()`)

### Phase 2: Duplex Templates + Polish

1. Implement interleave / swap-pairs / reverse algorithms (client-side)
2. Add duplex merge template buttons
3. Paper size dropdown + fit mode selector
4. Implement two-tier paper size adjustment
5. Keyboard shortcuts (Ctrl+Z, Ctrl+S, Delete, Ctrl+A)
6. Mobile touch optimization
7. IntersectionObserver for lazy thumbnail loading
8. Error handling (corrupt files, disk full, tool not found)
9. i18n for all new strings (start with English, add others incrementally)

### Phase 3: N-up Grid Layout

1. Create `editor/nup.py` — ReportLab-based grid compositor
2. Add N-up button/dialog to editor UI (grid size selection)
3. Add "composite pages" operation to edit list
4. Test memory usage on ARM device

### Phase 4: Extended Polish

1. Progress reporting for large documents
2. Drag-select (rubber band) for page selection
3. Page range selection (Shift+click on first and last)
4. Copy/paste pages between editor sessions (stretch)
5. Comprehensive i18n
6. ARM device performance testing and optimization

---

## 12. Dependencies

### System packages

| Package | Purpose | Debian `main`? | ARM? | Required? |
|---------|---------|---------------|------|-----------|
| python3-pikepdf | PDF manipulation (via libqpdf C++) | Yes (Bookworm+) | arm64, armhf | **Preferred** |
| pdftk-java | PDF manipulation (fallback) | Yes | all | Fallback only |
| ghostscript (gs) | PDF content scaling | Yes | all | Only for fit/scale |
| imagemagick (convert) | Images, thumbnails | Yes | all | Yes |
| poppler-utils (pdfinfo) | PDF metadata (fallback) | Yes | all | Optional |
| libjpeg-turbo-progs (jpegtran) | Lossless JPEG rotation | Yes | all | Optional, graceful fallback |

### Python packages (in project .venv)

| Package | Purpose | Already available? |
|---------|---------|-------------------|
| pikepdf | PDF operations | System package or pip install |
| reportlab | N-up grid layout (Phase 2) | System-wide (4.1.0) |
| Pillow | Image dimensions (used by reportlab) | System-wide (10.2.0) |

### npm packages

| Package | Purpose | Size |
|---------|---------|------|
| vuedraggable@next | Drag-and-drop page reordering | ~30 KB (wraps SortableJS) |

Session IDs use Node.js built-in `crypto.randomUUID()` — no additional package.

---

## 13. Alternatives Considered

### 13.1 Client-Side PDF Processing (pdf-lib / pdf.js)

**Pros:** No server round-trips, works offline, no temp files.
**Cons:** Memory unbounded (entire PDF in browser), can't use system tools,
OCR preservation harder, adds 600+ KB of JS (pdf.js for rendering).
**Verdict:** Hybrid server-side approach is better for constrained devices.

### 13.2 pdftk-java as Primary Tool

**Pros:** Already installed, well-known.
**Cons:** JVM startup ~50-80 MB overhead, heap can reach 200 MB, slow startup
(~1-2s for JVM), cannot modify MediaBox (can't do OCR-safe paper size changes).
**Verdict:** Kept as fallback. pikepdf is superior in every dimension for this
use case.

### 13.3 qpdf CLI as Primary Tool

**Pros:** C++, lightweight, all needed operations.
**Cons:** Not installed (pikepdf wraps the same libqpdf but as a Python API,
giving us more flexibility for complex operations like N-up).
**Verdict:** pikepdf gives us qpdf's engine plus Python's flexibility.

### 13.4 Pre-Building a Master PDF at Session Creation

**Pros:** Simpler assembly at save time.
**Cons:** Forces upfront extraction + merge + image→PDF conversion. More disk
I/O, slower session creation, wastes work on pages that get deleted.
**Verdict:** Lazy extraction with edit-list model is strictly better.

### 13.5 ImageMagick `montage` for N-up

**Pros:** Already installed, single command.
**Cons:** Loads all images into RAM simultaneously. With Q16 (Debian default),
4 × 300dpi A4 images = ~250 MB. At 600dpi, exceeds 1 GB.
**Verdict:** ReportLab's JPEG passthrough is ~30× more memory-efficient.

---

## 14. File Structure (New/Modified)

```
app-server/src/
├── classes/
│   ├── editor-session.js       # NEW — session lifecycle, cleanup
│   ├── pdf-tool.js             # NEW — abstract PDF operations interface
│   ├── pikepdf-tool.js         # NEW — pikepdf implementation
│   └── pdftk-tool.js           # NEW — pdftk fallback implementation
├── editor-api.js               # NEW — editor API methods
└── express-configurer.js       # MODIFIED — register editor endpoints

app-ui/src/
├── components/
│   ├── Editor.vue              # NEW — editor dialog component
│   └── Files.vue               # MODIFIED — add Edit entry points
├── classes/
│   └── undo-stack.js           # NEW — undo/redo state management
└── locales/
    ├── en.json                 # MODIFIED — add editor.* strings
    └── (other locales...)      # MODIFIED — add editor.* strings

editor/                         # NEW — Python helper scripts
├── pdf_ops.py                  # pikepdf wrapper (split, merge, rotate, resize)
├── nup.py                      # ReportLab N-up compositor (Phase 2)
└── requirements.txt            # pikepdf, reportlab, Pillow

package.json                    # MODIFIED — add vuedraggable dependency
```

---

## 15. Testing Strategy

### Unit Tests
- `UndoStack` class — push/undo/redo/truncation
- Interleave / swap-pairs / reverse algorithms
- Edit-list manipulation functions
- Paper size conversion (mm → points)
- Tool detection logic (pikepdf vs pdftk fallback)

### Integration Tests
- Full session lifecycle: create → thumbnails → save → verify output
- PDF with OCR → edit → save → verify OCR text preserved (`pdftotext` check)
- Multi-format merge (PDF + JPG + PNG + TIF) → verify page count
- Duplex merge template → verify page order
- Paper size adjustment (both tiers) → verify output dimensions
- Session cleanup after TTL expiry
- Atomic save (kill during save → verify no corruption)

### Manual / Device Tests
- ARM device (1 GB RAM): create session with 100-page PDF, observe memory
  via `htop`, verify no OOM
- Mobile browser: drag-and-drop pages, touch interactions
- Slow network: thumbnail lazy loading behavior
- Browser close during active session → verify cleanup
- Concurrent access attempt → verify single-session enforcement

---

## 16. Open Items for Future Discussion

1. **Page annotations (out of scope for v1):** Adding text, checkmarks,
   signatures. Requires a fundamentally different UI (page-level canvas editor
   vs. thumbnail grid). Potentially a separate feature branch if demand exists.

2. **Batch processing:** Apply the same edit operations to multiple documents.
   Could be valuable for standardizing paper size across a batch of scans.

3. **Scan-to-editor workflow:** "Scan and edit" button that goes directly from
   scanning to the editor without returning to the Files tab.

4. **Editor bookmarks/sections:** For very long documents, collapsible
   section headers or bookmarks within the editor view.
