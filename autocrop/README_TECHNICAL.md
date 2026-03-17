# Autocrop Implementation: Risk-Based Dual-Heuristic Engine

## Overview

`autocrop.py` provides automated document detection, deskewing, and cropping
for scanner preview images.  It uses two complementary heuristics and a
**Risk Decision Engine** to select the safest transformation available for the
image type and the current execution mode.

---

## Architecture

### Heuristic B: Contour/Edge Analysis (original "Smart-Anchor")

Works well when the document has visible edges against the scanner bed (e.g.
dark paper, photos, ID cards, documents on a flatbed with a coloured mat).

**Pipeline**

1. **Bezel Wipe** — 1.5% white-out margin suppresses scanner bezel interference.
2. **Point Cloud** — Gaussian blur → Canny edges → contour extraction.
   Only contours with arc length ≥ 50 px are kept.
3. **Base Rect** — `cv2.minAreaRect` on the merged point cloud.
4. **Surgical Restore** — Corners that were "shrunk" by the wipe are snapped
   back to the physical image boundary so that white-on-white documents whose
   paper edge is invisible still get the correct full-page crop.
5. **Final Rect** — `minAreaRect` re-calculated from the snapped corners.

**Output** — `angle_deg` (OpenCV convention, `[-90, 0)`), center `(c_x_px, c_y_px)`,
dimensions `(w_px, h_px)` in pixels.

---

### Heuristic A: Text Presence & Skew Detection (new)

Works well for white-on-white business letters where the paper edges are
invisible to Canny edge detection.

**Pipeline**

1. Gaussian blur → adaptive threshold (THRESH_BINARY_INV) to detect dark pixels
   (text, lines, marks) on a light background.
2. Horizontal morphological dilation (40×1 kernel, 2 iterations) merges
   individual characters into text-line blobs.
3. `HoughLinesP` on the dilated image finds text baselines.
4. Only near-horizontal lines (|angle| ≤ 20°) are kept; the **median angle**
   becomes the deskew correction.
5. A **confidence score** (0–1) is computed from the number of detected lines
   (more = better) and their angular consistency (lower std dev = better),
   weighted 30/70 to penalise images whose many detected "lines" are incoherent
   (photos, random blobs).
6. Separately, a **`textlines_bbox`** is derived from only the high-aspect-ratio
   blobs (wide, narrow = genuine text baselines).  This is used by the dirty-pixel
   check to distinguish intentional content in the margins from text proper.

**Output** — `text_angle` (degrees, positive = clockwise), `text_bbox` (all
significant content), `textlines_bbox` (text-line blobs only),
`text_confidence_score` (0–1).

---

### Dirty Pixel Safety Check

Before committing to a tight text-based crop (Risk Level 1) the engine asks:
*"Is there meaningful content outside the text-line area?"*

Content outside `textlines_bbox` + a 3% safety margin is measured.  If more
than **0.1%** of the total image area consists of dark pixels in that region
(≈ a 30×30 block on an 800×1100 preview), the tight crop is considered unsafe.
This detects stamps, signatures, logos, and border decorations in the margins
that a text-only crop would truncate.

---

### Risk Decision Engine

Merges the two heuristic outputs into a single transformation decision.

| Risk Level | Trigger | Action |
|---|---|---|
| 0 – No-op | Heuristic B missing and text heuristic low/unsafe, **or** batch-mode cap | Return `{"magic": null}` — no transformation applied |
| 1 – Text focus | Text confidence ≥ 0.5, dirty pixel check passes | Deskew using `text_angle`; crop to `text_bbox` |
| 2 – Combined | Text confidence ≥ 0.5, dirty pixel check fails (margins have content) | Deskew using `text_angle`; crop using contour-derived boundary |
| 3 – Contour only | Text confidence < 0.5 (photo, graphic, blank page) | Ignore text signals; use Heuristic B entirely |

**Batch-mode cap:** When `--mode batch` (e.g. ADF scanning), Risk Levels 1 and 2
additionally require `text_confidence ≥ 0.65` (the "clear" threshold).  Risk
Level 3 is always demoted to 0 in batch mode because a photo-only crop without
a text anchor is too risky to apply automatically.

---

## Input Arguments

| Argument | Type | Description |
|---|---|---|
| `--image` | path | Source preview image (TIF or JPG) |
| `--left` | float | Scan area left coordinate (mm) |
| `--top` | float | Scan area top coordinate (mm) |
| `--width` | float | Scan area width (mm) |
| `--height` | float | Scan area height (mm) |
| `--bed-width` | float | Scanner bed width (mm) |
| `--bed-height` | float | Scanner bed height (mm) |
| `--mode` | `interactive`\|`batch` | Safety profile (default: `interactive`) |
| `--debug` | flag | Write intermediate images to disk alongside the source |

## Output (stdout)

```json
{
  "magic": "-background white -virtual-pixel white -distort SRT \"...\" +repage",
  "angle": 2.5,
  "doc_w": 215.9,
  "doc_h": 279.4,
  "doc_c_x": 107.9,
  "doc_c_y": 148.5
}
```

When the engine decides no transformation is warranted (Risk Level 0):

```json
{"magic": null}
```

The caller (`api.js`) already handles `magic: null` as "no autocrop applied".

---

## Running the Tests

```bash
# From the repo root
.venv/bin/python autocrop/test_autocrop.py
```

Tests use synthetic scanner-preview images generated in-process (no fixture
files required).
