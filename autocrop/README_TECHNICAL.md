# Autocrop Technical Reference

`autocrop.py` — automated document detection, deskewing, and cropping
for scanner preview images.

---

## The Core Problem

Documents on a flatbed scanner fall into three regimes:

| Regime | Examples | Paper edge visible? | Text present? |
|--------|----------|---------------------|---------------|
| High-contrast | Photos, ID cards, dark documents | Yes — Canny edges work | Maybe |
| White-on-white | Business letters, printed forms | No — paper blends into lid | Yes |
| Partial visibility | Letter clipped at R/B, lid on top/left | Top + left edges visible | Yes |

Each regime requires different signals.  The algorithm runs three heuristics
in parallel and combines their outputs in a **Risk Decision Engine**.

---

## Processing Pipeline

```
Raw image (BGR)
    │
    ├─► Heuristic C   ← raw_gray BEFORE wipe (border contrast)
    │
    ├─► Bezel Wipe (1.5% margin → white)
    │       │
    │       ├─► Heuristic B   (Canny edge contours)
    │       └─► Heuristic A   (text angle via projection variance)
    │
    └─► Risk Decision Engine
            │
            ├─► Override with Heuristic C when confident
            │
            └─► SRT magic string → JSON output
```

---

## Heuristic B — Contour / Edge Analysis ("Smart-Anchor")

**Purpose:** Detect the document boundary when it has tonal contrast against
the scanner bed (photos, ID cards, dark documents).

**Pipeline:**

1. **Bezel Wipe** — 1.5% white-out margin on all sides suppresses the scanner
   bezel, which would otherwise be detected as a document edge.
2. **Point Cloud** — Gaussian blur (5×5) → Canny edges (thresholds 15, 50) →
   contour extraction.  Only contours with arc length ≥ 50 px are kept.
3. **Base Rect** — `cv2.minAreaRect` on all valid contour points merged into
   a single point cloud.
4. **Surgical Restore** — Corners within 2 px of the wipe boundary are snapped
   back to the physical image edge.  Without this, white-on-white documents
   (whose paper edges are invisible to Canny) would have their margins
   incorrectly shrunk.
5. **Final Rect** — `minAreaRect` re-calculated from the snapped corners.

**Output:** `angle_deg` (OpenCV convention, `[-90, 0)`), `c_x_px`, `c_y_px`,
`w_px`, `h_px`.

---

## Heuristic A — Text Presence & Skew Detection

**Purpose:** Detect the document angle and confirm text presence for
white-on-white documents where Canny edges are absent.

### Step 1 — Adaptive Thresholding

Gaussian blur (3×3) → `adaptiveThreshold(THRESH_BINARY_INV, blockSize=15,
C=5)` → ink pixels become white (255) on a black (0) background.

### Step 2 — Horizontal Dilation

`cv2.dilate` with a 40×1 kernel for 2 iterations merges individual characters
into text-line blobs.  **At 100 dpi preview resolution this dilation does NOT
reliably produce long horizontal blobs** — individual character strokes dominate
and appear at ≈ 45° in `HoughLinesP`.  The angle is therefore computed by a
separate projection-variance method (Step 4).

### Step 3 — Text Confidence via HoughLinesP

`HoughLinesP` on the dilated image detects linear features.  Only lines with
`|angle| ≤ 20°` are kept.

**Dominant-cluster angle** (used only for the confidence formula, not for the
final angle): a ±3° sliding window finds the densest cluster of agreeing lines
and computes the cluster median.  This prevents the global median from landing
between two clusters (e.g. body text at 0° and header/logo at 10°).

**Confidence score** — computed from ALL detected lines (not just the cluster):

```
line_score        = min(1.0, (n_lines - 3) / 7)     # 0 at 3, 1 at 10+
consistency_score = max(0.0, 1 - global_std / 5.0)  # 1 at 0°, 0 at 5°+
text_confidence   = 0.3 * line_score + 0.7 * consistency_score
```

Using the global std for confidence is intentional: a photo with a few
accidental horizontal edge artefacts produces a tight cluster but inconsistent
global distribution, correctly keeping confidence low.

### Step 4 — Projection Variance Angle Detection

`detect_angle_by_projection()` is the actual source of the deskew angle.

For each candidate angle θ in [−15°, +15°] at 0.5° steps, the middle 70% of
the thresholded image is rotated by θ and the variance of the row sums is
computed.  At the true text angle the row sums alternate sharply between dense
(text line) and sparse (inter-line gap) values, giving **maximum variance**.

The coarse pass is followed by a fine refinement pass at 0.1° steps around the
peak.

**Why projection instead of HoughLinesP for the angle?**
At 100 dpi, the 40×1 horizontal dilation does not produce long line-length
blobs.  The vast majority of `HoughLinesP` detections are near-vertical
character strokes (≈ 45°) that are filtered out by the ±20° cut.  The
remaining ≈ 60 qualifying lines all come from scanner border artefacts at the
image top and bottom — not from the document body — and their median angle is
misleading.  The projection method is immune to this: it integrates over the
middle 70% of the image, skipping the borders entirely.

**Output:** `text_angle` (from projection, used for `rotate_angle`),
`text_bbox`, `textlines_bbox`, `text_confidence_score`, `proj_peak_ratio`.

---

## Heuristic C — Paper Corner Detection

**Purpose:** Position the document crop precisely when the scanner lid creates
a faint but detectable contrast at the image borders.  Operates on the **raw
(non-wiped) grayscale image**.

### Regime

The scanner lid / cover is typically 30–150 gray units darker than white paper.
This contrast is only visible in the first 1–5 pixels at the image boundary and
is destroyed by the 1.5% bezel wipe.  Heuristic C is therefore the only
component that receives the raw image.

### Guards (applied before any scan)

1. **Dark-document guard** — if `interior_mean < 180` (image centre is
   predominantly dark), the document surface is darker than the scanner lid
   (e.g. a photo on a white bed).  `HoughLinesP` would detect the bright lid
   at row/col 0, not a paper edge.  Returns confidence 0.

2. **Background guard** — if > 50% of top-edge transitions are at row ≤ 1,
   the bright scanner background is triggering at the very border (no lid
   visible, paper starts at the scanner edge).  Nulls out that edge with
   coverage 0.

### Edge Scanning

| Scan | Direction | Search width | Metric | Use |
|------|-----------|--------------|--------|-----|
| **Top** | ↓ from row 0 | 30 px | First bright pixel per column | Paper top edge y-position |
| **Left** | → from col 0 | 30 px | First bright pixel per row | Paper left edge x-position |
| **Right** | ← from col N | 15% of image width | Last bright pixel per middle-50%-height row | Right edge or clipping |
| **Bottom** | ↑ from row M | 15% of image height | Last bright pixel per middle-50%-width col | Bottom edge or clipping |

**Bright threshold:** pixel value > 200.

### Corner Position — Minimum, Not Median

For a tilted document the paper edge runs diagonally.  The **minimum** detected
y-value in the top scan is the actual top-left corner; the median would give the
midpoint of the diagonal (systematically offset by half the tilt-induced span).

### Clipping Detection

The outermost 5 pixels in the middle 50% of each edge are compared to the image
interior mean:

```
right_clipped  = |strip_mean / interior_mean − 1| < 0.20  AND  strip_std < 25
bottom_clipped = same logic for bottom strip
```

When the paper extends to the scanner edge (clipped), the strip is uniformly
bright like the paper interior.  When the paper ends before the scanner edge,
the strip is the scanner lid colour — different from the paper interior.

### Paper Dimension Estimation

| Right clipped | Bottom clipped | Width | Height |
|---|---|---|---|
| Yes, user ≠ full-bed | — | `t_w` (user-specified) | detected or `bed_h − corner_y` |
| Yes, full-bed intent | — | `bed_w − corner_x` | detected or `bed_h − corner_y` |
| No | — | `right_x − corner_x` (detected) | — |
| — | Yes, user ≠ full-bed | — | `t_h` (user-specified) |
| — | Yes, full-bed intent | — | `bed_h − corner_y` |
| — | No | — | `bottom_y − corner_y` (detected) |

After computing raw dimensions, a **standard-size snap** is attempted (unless
the raw dimensions are already within 3 mm of the user-specified `t_w`/`t_h`,
in which case the user's selection takes priority).

### Standard Size Table

| Name | Width (mm) | Height (mm) |
|------|-----------|------------|
| Credit Card | 53.98 | 85.60 |
| A7 | 74 | 105 |
| A6 | 105 | 148 |
| Half-Letter | 128 | 178 |
| A5 | 148 | 210 |
| B5 | 176 | 250 |
| Junior Legal | 184.2 | 266.7 |
| A4 | 210 | 297 |
| Letter | 215.9 | 279.4 |
| Legal | 215.9 | 355.6 |
| B4 | 257 | 364 |

All sizes are matched in both portrait and landscape orientations.  Tolerance
is ±10 mm per dimension.

### Text-Body Margin Validation

If `text_bbox` is available (from Heuristic A), the margin between the detected
corner and the first text pixel is checked:

```
left_margin = (text_bbox.x / px_per_mm_x) − corner_x_mm
top_margin  = (text_bbox.y / px_per_mm_y) − corner_y_mm
valid = 10 mm ≤ left_margin ≤ 50 mm  AND  10 mm ≤ top_margin ≤ 55 mm
```

The generous upper bound (50 mm) accommodates wide-margin legal documents; the
lower bound (10 mm) allows for narrow-margin forms and DocuSign markers that
begin close to the paper edge.

### Confidence Score

```
top_rel  = max(0, 1 − top_std  / search_px)
left_rel = max(0, 1 − left_std / search_px)
edge_conf = (top_cov × top_rel + left_cov × left_rel) / 2

validation_bonus = 0.15  if corner_validated else 0
size_bonus       = 0.10  if matched to standard size else 0
one_edge_penalty = 0.15  if only one of top/left detected else 0

overall_conf = min(1.0, edge_conf + validation_bonus + size_bonus − one_edge_penalty)
```

The confidence correctly degrades for:
- Very tilted documents (high std → low `top_rel`)
- Documents placed at the scanner origin (≥50% transitions at row/col 0-1 → edge nulled out)
- Only one visible edge
- Text body not consistent with the detected corner

**Override thresholds:**
- Interactive mode: `overall_conf ≥ 0.40`
- Batch (conservative) mode: `overall_conf ≥ 0.60`

---

## Risk Decision Engine

Merges Heuristics A and B to select a transformation level.  Heuristic C is
applied as a post-step override and does not feed into risk-level selection.

### Risk Level Selection

| Condition | Risk Level |
|-----------|-----------|
| `heuristic_b` is None AND text not confident | **0 — No-op** |
| text_conf < 0.5 | **3 — Contour only** |
| text_conf ≥ 0.5 AND dirty-pixel check passes | **1 — Text focus** |
| text_conf ≥ 0.5 AND dirty-pixel check fails | **2 — Combined** |

### Risk Level Actions

| Level | Rotation source | Crop source | Notes |
|-------|----------------|-------------|-------|
| 0 | — | — | `{"magic": null}` |
| 1 | `text_angle` (projection) | `text_bbox` | Full-bed guard applies |
| 2 | `text_angle` (projection) | Heuristic B contour | Full-bed guard applies |
| 3 | `text_angle` (projection) | Heuristic B contour | Full-bed guard applies |

**Note:** At all risk levels the deskew angle now comes from the
projection-variance method (Heuristic A Step 4), not from the
HoughLinesP cluster or from the contour bounding-rect angle.  The
contour bounding-rect angle was unreliable for white-on-white documents
(it reflects the orientation of the ink bounding box rather than the
physical paper tilt).

### Full-Bed Guard

Applied at risk levels 1, 2, and 3.  Fires when the crop source (text_bbox or
contour) spans > 80% of the image in both dimensions, **or** when the user
explicitly selected the full scanner bed (`t_w ≈ bed_w AND t_h ≈ bed_h`).  In
either case the crop dimensions are replaced with the actual scan dimensions
(`t_w × t_h`), capped to the preview image size.

**Why 80%?**  A standard 25 mm margin on each side of an A4/Letter page leaves
approximately 83–89% of the paper covered by text.  The old 90% threshold was
too conservative and failed to trigger for documents with normal margins.

**Why use t_w/t_h and not img_w/img_h?**  The server always pads the preview
to represent the full scanner bed height (297 mm = 1194 px) regardless of the
actual scan height.  For a letter-size scan (279.4 mm), the last 17.6 mm
(71 px) of the preview is white padding.  Using img_h would inflate the output
height to 297 mm instead of the correct 279.4 mm.

### Batch-Mode Safety Caps

| Risk Level | Batch behaviour |
|-----------|----------------|
| **1 or 2** | Allowed only when `text_conf ≥ 0.65` |
| **3 (contour)** | Allowed when contour area < 72% of image (clearly visible edges), OR when contour area ≥ 72% but `text_conf > 0.15` AND contour does not fill 99%+ of image (large text document → deskew-only, full-bed guard prevents harmful crop) |
| **3 (contour)** | Demoted to 0 when contour fills 99%+ of image AND `text_conf ≤ 0.15` (photo or blank page filling the full frame) |

### Heuristic C Override

After the risk engine computes `doc_c_x`, `doc_c_y`, `doc_w_mm`, `doc_h_mm`,
Heuristic C overrides these values when its confidence meets the threshold:

```python
if hc_conf ≥ threshold:
    doc_c_x  = hc['doc_c_x_mm']
    doc_c_y  = hc['doc_c_y_mm']
    doc_w_mm = hc['paper_w_mm']
    doc_h_mm = hc['paper_h_mm']
# rotate_angle is NEVER overridden — always from projection variance
```

This is the primary mechanism for producing a correctly-positioned paper-size
crop for business letters and other white-on-white documents where the paper
corner is detectable at the scanner border.

---

## SRT Output and Centering

The ImageMagick SRT distort string has the form `cx,cy  sx,sy  angle  tx,ty`:

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `cx, cy` | document centre in input image (pixels, as `%[fx:...]`) | Rotation pivot |
| `sx, sy` | `1.0, 1.0` (always; `--no-scale` forces this) | No scale |
| `angle` | `rotate_angle` (from projection variance, negated) | Deskew correction |
| `tx, ty` | `%[fx:w/2], %[fx:h/2]` | Move document to image centre |

Setting `tx,ty = w/2, h/2` moves the document centre to the image centre after
rotation.  The downstream surgical crop (`-gravity center -extent WxH +repage`)
then extracts the document regardless of where it sat on the scanner bed.

**`--no-scale` flag** — when called from `scan-controller.js` (automatic mode),
this flag forces `sx=sy=1.0` and disables scale-to-fit logic.  Without it, a
letter-size scan (279.4 mm height) on a 297 mm bed would trigger scale-to-fit
and distort the output.

---

## Caller Conventions

### `scan-controller.js` (automatic mode)

```
--width {actual_scan_width}  --height {actual_scan_height}
--bed-width {bed_w}  --bed-height {bed_h}
--no-scale
--mode {batch | interactive}
```

Actual scan dimensions are passed (not bed dimensions) so Heuristic C can
correctly size the crop to the user-selected paper format.

### `api.js` wand endpoint (interactive mode)

```
--width {bed_w}  --height {bed_h}    ← full bed always
--bed-width {bed_w}  --bed-height {bed_h}
--mode interactive                   ← always interactive, regardless of UI setting
```

The wand always uses interactive mode and passes full-bed dimensions.  The user
is expected to review the result; the autoCropMode dropdown setting is for the
automatic per-page path only.

---

## Command-Line Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--image` | ✓ | Path to the preview image (TIF or JPG) |
| `--left` | ✓ | Scan area left coordinate (mm) |
| `--top` | ✓ | Scan area top coordinate (mm) |
| `--width` | ✓ | Scan area width (mm) |
| `--height` | ✓ | Scan area height (mm) |
| `--bed-width` | ✓ | Scanner physical bed width (mm) |
| `--bed-height` | ✓ | Scanner physical bed height (mm) |
| `--mode` | | `interactive` (default) or `batch` |
| `--no-scale` | | Disable scale-to-fit; force `sx=sy=1.0` |
| `--debug` | | Write intermediate debug images alongside source |

---

## JSON Output (stdout)

On success:
```json
{
  "magic": "-background white -virtual-pixel white -distort SRT \"...\" +repage",
  "angle": 1.30,
  "doc_w": 215.9,
  "doc_h": 279.4,
  "doc_c_x": 108.4,
  "doc_c_y": 140.4
}
```

When no transformation is warranted (risk level 0 or batch cap):
```json
{"magic": null}
```

---

## Typical Scenarios and Expected Behaviour

| Scenario | text_conf | Heuristic C | Risk | Result |
|----------|-----------|-------------|------|--------|
| ADF document, 0.4° tilt, fills frame | High (0.85+) | Background guard fires (transitions at row 0) | 1 | Deskew only, full bed |
| Letter, top+left lid visible, R+B clipped | Low (0.30) | Detects corner; snaps to Letter | 3 + C override | Deskew + letter-size crop |
| Photo, tilted 11°, clear dark edges | Very low (0.30) | Dark-document guard fires | 3 | 11° deskew + contour crop |
| Credit card, 3° tilt, all edges visible | Low | Detects corner; snaps to Credit Card | 3 + C override (if conf ≥ 0.4) | 3° deskew + card crop |
| Business letter, bimodal angle dist | Low (0.30) | Detects corner; snaps to Letter | 3 + C override | Deskew + letter-size crop |
| Blank page | 0 | Background guard fires | 0 | No-op |
| Near-white lid (lid_gray 225) | Low | Low confidence — below threshold | 3 | Deskew only, no crop |

---

## Test Suites

```bash
# Unit tests: heuristics, risk engine, direty-pixel check
.venv/bin/python autocrop/test_autocrop.py         # 18/18

# Synthetic scanner simulations: 6 scenarios with known ground truth
.venv/bin/python autocrop/test_synthetic.py        # 18/19

# Comprehensive scenarios: EASY → EXTREME + regression guards
.venv/bin/python autocrop/test_comprehensive.py    # 49/49
```

`test_comprehensive.py` covers: credit card, large photo, ADF full-frame,
Letter/A4 clipped, wide margins, conservative mode, smudges near edges,
narrow margins, near-white lid, 5° tilt, fold marks, blank pages, false-edge
smudges, DocuSign markers in top margin, full-bed photo regression, and
regression against real scan files (`preview2.tif`, `business.pdf`).

---

## Known Limitations

1. **Heuristic C requires visible lid contrast.**  If the paper is placed flush
   with the scanner origin (no lid visible at any border) and both right and
   bottom edges are also clipped, there are no detectable boundaries and
   Heuristic C returns confidence 0.  The algorithm falls back to deskew-only.

2. **Projection variance sign ambiguity on perfectly symmetric synthetic images.**
   For real scans the asymmetric scanner background biases the projection peak
   toward the correct sign.  Synthetic tests use absolute-value angle comparisons
   to tolerate this known ambiguity.

3. **ADF automatic cropping.**  The `autoCropMode` setting triggers per-page
   automatic autocrop in `scan-controller.js` but there is no hardware preview
   of each ADF page.  The algorithm runs on the preview that was captured for
   the flatbed preview (if available).  Per-page ADF previews are not yet
   implemented.

4. **PDF editor action.**  Applying autocrop from the editor to selected pages
   is not yet implemented.
