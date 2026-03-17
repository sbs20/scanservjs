# Autocrop Implementation: Risk-Based Dual-Heuristic Engine

## Overview

`autocrop.py` provides automated document detection, deskewing, and cropping
for scanner preview images.  It uses two complementary heuristics and a
**Risk Decision Engine** that selects the safest transformation available for
the image type and the current execution mode.

The fundamental challenge is that documents come in two distinct regimes:

| Regime | Examples | Visible edges? | Text present? |
|--------|----------|----------------|---------------|
| High-contrast | photos, ID cards, dark documents on white bed | Yes — Canny edges work | Maybe |
| White-on-white | business letters, printed forms on flatbed | No — paper blends into lid | Yes |

The algorithm must classify the document into the appropriate regime and apply
the right strategy.

---

## Architecture

### Heuristic B: Contour/Edge Analysis ("Smart-Anchor")

Works well when the document has a clear tonal contrast against the scanner
bed, such as photos, ID cards, or coloured documents.

**Pipeline**

1. **Bezel Wipe** — 1.5% white-out margin suppresses scanner bezel artefacts.
2. **Point Cloud** — Gaussian blur → Canny edges → contour extraction.
   Only contours with arc length ≥ 50 px are kept.
3. **Base Rect** — `cv2.minAreaRect` on the merged point cloud.
4. **Surgical Restore** — Corners within 2 px of the wipe boundary are
   "snapped" back to the image edge so that documents whose paper edges are
   invisible still receive a full-page crop.
5. **Final Rect** — `minAreaRect` re-calculated from snapped corners.

**Output** — `angle_deg` (OpenCV convention, `[-90, 0)`), center
`(c_x_px, c_y_px)`, dimensions `(w_px, h_px)` in pixels.

---

### Heuristic A: Text Presence & Skew Detection

Works well for white-on-white business letters where paper edges are
invisible to Canny edge detection.

**Pipeline**

1. Gaussian blur → adaptive threshold (THRESH_BINARY_INV) to find dark ink
   on a light background.
2. Horizontal morphological dilation (40×1 kernel, 2 iterations) merges
   characters into text-line blobs.
3. `HoughLinesP` on the dilated image finds text baselines.
4. Only near-horizontal lines (|angle| ≤ 20°) are kept.
5. **Dominant cluster detection**: rather than using the global median
   (which can land between two clusters), a ±3° sliding window identifies
   the angle with the most agreeing lines.  The cluster median becomes the
   deskew angle estimate.  This handles the bimodal case common in business
   letters, where body text sits at one angle and headers/footers/logos sit
   at another.
6. **Confidence score** — deliberately computed from ALL detected lines
   (not just the dominant cluster), penalising bimodal / inconsistent
   distributions:
   - `line_score` = f(total qualifying lines), rewarding more lines
   - `consistency_score` = f(global angle std), penalising inconsistency
   - `confidence = 0.3 * line_score + 0.7 * consistency_score`

   Using all-lines std for confidence is intentional: a photo with a few
   coincidentally-horizontal edge artefacts has a high cluster fraction but
   the global distribution would still be inconsistent.  Bimodal business
   letters (body text vs headers) score low confidence and fall to risk-3,
   where the contour angle is used (which is fine — they're well-placed).

7. A `textlines_bbox` is computed from only the high-aspect-ratio blobs
   (wide, narrow = genuine text baselines), used by the dirty-pixel check.

**Output** — `text_angle`, `text_bbox`, `textlines_bbox`,
`text_confidence_score`.

---

### Dirty Pixel Safety Check

Before committing to a tight text-based crop (Risk Level 1), checks whether
significant content exists *outside* the text-line area that would be
truncated.  More than 0.1% dark pixels outside `textlines_bbox` + a 3%
safety margin indicates stamps, signatures, or border decorations → crop
is unsafe → escalate to Risk Level 2.

---

### Risk Decision Engine

Merges both heuristics into a single transformation decision.

| Risk Level | Trigger | Action |
|---|---|---|
| **0 — No-op** | batch mode with insufficient evidence; or no signals | Return `{"magic": null}` |
| **1 — Text focus** | text_conf ≥ 0.5, margins clean | Deskew by `text_angle`; crop to `text_bbox` (with full-bed guard) |
| **2 — Combined** | text_conf ≥ 0.5, dirty margins | Deskew by `text_angle`; crop to contour bounds |
| **3 — Contour only** | text_conf < 0.5 | Use Heuristic B entirely (with full-bed guard) |

#### Full-bed guard (Risk Levels 1 and 3)

When text lines are present (`text_conf > 0.15`) and the contour or text
bounding box covers > 90% (risk-1) or > 80% (risk-3) of the image in both
dimensions, the document is a white-on-white page whose ink content area
is smaller than the physical paper.  Cropping to the ink boundary would
remove paper margins.  The full-bed guard replaces the crop dimensions with
the full image, preserving margins while still applying the deskew.

**Example**: a business letter fills A4 paper (210×297 mm) on a 215.9×297 mm
bed.  The ink area detected might be 203×282 mm.  Without the guard, the
output would be 203×282 mm — removing the 7-15 mm paper margins.  With the
guard, it becomes 215.9×297 mm (full bed) with just the deskew angle applied.

#### Batch-mode safety caps

| Risk Level | Batch behaviour |
|---|---|
| 3 (contour-only) | Allowed only when document area < 72% of image area, indicating clearly visible edges.  Full-bed contour crops (area ≥ 72%) are demoted to 0 to avoid destructive ADF crops. |
| 1 or 2 | Allowed only when `text_conf ≥ 0.65` (the "clear" threshold). |

---

### SRT Output and Centering

The ImageMagick SRT transform is `cx,cy  sx,sy  angle  tx,ty` where:
- `cx,cy` = source centre = document centre in input pixels (pivot for rotation)
- `sx,sy` = scale factors (always 1.0,1.0 when called from automatic scan mode)
- `tx,ty` = **destination centre = image centre (`w/2, h/2`)**

Setting `tx,ty = w/2, h/2` moves the document to the image centre after
rotation.  The downstream surgical crop (`-gravity center -extent WxH`) then
correctly extracts the document regardless of where it sat on the scanner bed.
When the scan was pre-cropped to the document area (magic-wand interactive
workflow), the document centre already coincides with the image centre, so
this has no practical effect on that path.

---

## Document Type Classification

| Signal | Regime |
|--------|--------|
| text_conf ≥ 0.5 | Text document → Risk 1 or 2 |
| text_conf 0.15–0.5 | Ambiguous: use contour (Risk 3); full-bed guard prevents margin loss |
| text_conf < 0.15 | Photo / blank → Risk 3 (contour only) |
| Contour area < 72% | Document clearly smaller than bed → Risk 3 (contour crops allowed in batch) |
| Contour area ≥ 72% | Document fills bed → batch mode caps Risk 3 to no-op |

---

## Input Arguments

| Argument | Type | Description |
|---|---|---|
| `--image` | path | Source preview image (TIF or JPG) |
| `--left` | float | Scan area left coordinate (mm) |
| `--top` | float | Scan area top coordinate (mm) |
| `--width` | float | Scan area width (mm) — use bed dimensions when called from scan-controller |
| `--height` | float | Scan area height (mm) — use bed dimensions when called from scan-controller |
| `--bed-width` | float | Scanner bed width (mm) |
| `--bed-height` | float | Scanner bed height (mm) |
| `--mode` | `interactive`\|`batch` | Safety profile (default: `interactive`) |
| `--debug` | flag | Write intermediate images alongside source |

**Note:** `scan-controller.js` always passes bed dimensions as `--width`/`--height`
so that `is_full_bed=True` and no spurious scale-to-fit occurs.  The wand
endpoint (`api.js`) always passes `--mode interactive`.

## Output (stdout)

```json
{
  "magic": "-background white -virtual-pixel white -distort SRT \"...\" +repage",
  "angle": 2.5,
  "doc_w": 215.9,
  "doc_h": 297.0,
  "doc_c_x": 107.9,
  "doc_c_y": 148.5
}
```

When the engine decides no transformation is warranted (Risk Level 0):
```json
{"magic": null}
```

---

## Known Limitations and Future Work

1. **Business letter detection via paper-size prior**: The current algorithm
   uses full-bed dimensions for large text documents, which is correct when
   the user has selected the full scanner bed.  When the user has pre-selected
   a specific paper size (e.g., A4 = 210×297 mm on a 215.9×297 mm scanner),
   the algorithm could use that as the crop target to provide tighter
   centering.  Not yet implemented.

2. **Bimodal business letters**: Documents where headers/footers are at a
   different angle than body text result in low text_conf → risk-3 → contour
   angle is used.  This gives the correct deskew angle for well-placed
   documents.  For significantly tilted bimodal documents, the contour angle
   is still reliable.

3. **ADF automatic mode**: The `autoCropMode` setting triggers per-page
   automatic autocrop in `scan-controller.js`.  Text documents (risk-1/2)
   with high confidence get their deskew applied.  Contour-only crops for
   full-bed documents are suppressed in batch mode (risk-3 → no-op when
   area ≥ 72%), preventing destructive ADF crops.

4. **PDF editor action**: Applying autocrop from the editor to selected pages
   is not yet implemented.

---

## Running the Tests

```bash
.venv/bin/python autocrop/test_autocrop.py
```

Tests use synthetic scanner-preview images generated in-process.  18 tests
covering all heuristics, risk levels, dirty-pixel check, and full script
invocation.

## Test Document Reference

| Document | Description | Expected interactive | Expected batch |
|---|---|---|---|
| Business letter (A4, white-on-white) | Full-page text, bimodal angle dist | 0.15° deskew, full bed | no-op |
| Tilted dark-edge doc | Photo-type, visible edges | −11.2°, 65×78% crop | −11.2°, 65×78% crop |
| Full-bed letter (well-placed) | Dense text, near-0° | 0.75° deskew, full bed | 0.75° deskew, full bed |
| Dark-edge small document | Smaller doc on bed | −11.1°, 65×73% crop | −11.1°, 65×73% crop |
