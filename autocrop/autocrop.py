import sys
import json
import cv2
import numpy as np
import math

import argparse


# ============================================================
# Standard Paper Sizes & Matching
# ============================================================

# All sizes in portrait orientation (shorter dimension first).
# Credit card is listed both ways to handle landscape placement.
_STANDARD_SIZES = [
    (53.98,  85.60, 'Credit Card'),
    (54.0,   85.6,  'Credit Card'),       # rounded
    (74.0,  105.0,  'A7'),
    (85.6,   54.0,  'Credit Card-L'),
    (105.0, 148.0,  'A6'),
    (128.0, 178.0,  'Half-Letter'),       # 5×7 in
    (139.7, 215.9,  'Half-Letter-P'),
    (148.0, 210.0,  'A5'),
    (176.0, 250.0,  'B5'),
    (184.2, 266.7,  'Junior Legal'),
    (210.0, 297.0,  'A4'),
    (215.9, 279.4,  'Letter'),
    (215.9, 355.6,  'Legal'),
    (257.0, 364.0,  'B4'),
]


def match_standard_size(w_mm, h_mm, tolerance_mm=8.0):
    """
    Return (matched_w, matched_h, name) for the closest standard paper size
    within tolerance_mm on each dimension, or None if no match.
    Input orientation is normalised (smaller dimension first) so landscape
    placements are also matched.
    """
    w, h = min(w_mm, h_mm), max(w_mm, h_mm)
    best = None
    best_dist = float('inf')
    for sw, sh, name in _STANDARD_SIZES:
        sw2, sh2 = min(sw, sh), max(sw, sh)
        if abs(w - sw2) <= tolerance_mm and abs(h - sh2) <= tolerance_mm:
            dist = math.hypot(w - sw2, h - sh2)
            if dist < best_dist:
                best_dist = dist
                # Return in the same orientation as the input
                if w_mm <= h_mm:
                    best = (sw2, sh2, name)
                else:
                    best = (sh2, sw2, name)
    return best


# ============================================================
# Heuristic C: Paper Corner Detection from Scanner-Border Contrast
# ============================================================

def run_heuristic_c(raw_gray, img_w, img_h, t_w, t_h, bed_w, bed_h,
                    text_bbox=None, bright_thresh=200, search_px=30,
                    debug=False, img_path=None):
    """
    Detect the paper boundary at the scanner bed edges using the contrast
    between the scanner lid (darker) and the paper (brighter) in the RAW
    (non-wiped) grayscale image.

    The scanner bezel / lid is typically 30-150 gray units darker than
    the paper surface.  This contrast is only visible in the first few
    pixels at the image borders and is destroyed by the 1.5% bezel wipe.
    This function must therefore receive the raw image before any wipe.

    Returns a dict with positioning information and a confidence score
    (0–1).  Returns {'overall_conf': 0.0, ...} when detection fails.
    """
    px_per_mm_x = img_w / bed_w
    px_per_mm_y = img_h / bed_h
    MIN_COV = 0.5   # minimum fraction of rows/cols with a detected transition

    # ── Guard: only apply to bright-paper documents ───────────────────────
    # For dark documents (photos, coloured paper) the scanner lid is brighter
    # than the document surface.  Heuristic C would incorrectly treat the
    # bright lid pixels at row 0 / col 0 as the paper boundary.  Detect this
    # by comparing the image interior mean to the bright_thresh; if the
    # document content is predominantly dark, return immediately.
    interior_mean = float(raw_gray[img_h // 4: 3 * img_h // 4,
                                   img_w // 4: 3 * img_w // 4].mean())
    if interior_mean < 180:
        return {'overall_conf': 0.0, 'corner_x_mm': None, 'corner_y_mm': None,
                'right_clipped': False, 'bottom_clipped': False,
                'top_coverage': 0.0, 'left_coverage': 0.0}

    # ── Top edge: first bright row per column ─────────────────────────────
    top_ys = []
    for c in range(img_w):
        for r in range(min(search_px, img_h)):
            if int(raw_gray[r, c]) > bright_thresh:
                top_ys.append(r)
                break
        else:
            top_ys.append(None)

    # ── Left edge: first bright column per row ────────────────────────────
    left_xs = []
    for r in range(img_h):
        for c in range(min(search_px, img_w)):
            if int(raw_gray[r, c]) > bright_thresh:
                left_xs.append(c)
                break
        else:
            left_xs.append(None)

    # ── Right edge (middle rows): first bright column from the right ───────
    # Use a larger search band: paper edges can be up to ~30 mm from the
    # scanner border (≈ 120 px at 4 px/mm).
    right_search = min(int(img_w * 0.15), img_w // 2)
    right_xs_mid = []
    for r in range(img_h // 4, 3 * img_h // 4):
        for c in range(img_w - 1, img_w - 1 - right_search, -1):
            if int(raw_gray[r, c]) > bright_thresh:
                right_xs_mid.append(c)
                break
        else:
            right_xs_mid.append(None)

    # ── Bottom edge (middle cols): first bright row from the bottom ────────
    bottom_search = min(int(img_h * 0.15), img_h // 2)
    bottom_ys_mid = []
    for c in range(img_w // 4, 3 * img_w // 4):
        for r in range(img_h - 1, img_h - 1 - bottom_search, -1):
            if int(raw_gray[r, c]) > bright_thresh:
                bottom_ys_mid.append(r)
                break
        else:
            bottom_ys_mid.append(None)

    top_valid  = [v for v in top_ys  if v is not None]
    left_valid = [v for v in left_xs if v is not None]
    top_cov  = len(top_valid)  / img_w
    left_cov = len(left_valid) / img_h

    right_valid_mid  = [v for v in right_xs_mid  if v is not None]
    bottom_valid_mid = [v for v in bottom_ys_mid if v is not None]

    # Detected paper boundaries from right/bottom scan (for visible edges)
    # Use MAXIMUM position: the farthest bright pixel from the image edge is
    # the paper boundary (the minimum would be the outermost lid pixel).
    right_x_px  = float(max(right_valid_mid))  if len(right_valid_mid)  > img_h // 8 else None
    bottom_y_px = float(max(bottom_valid_mid)) if len(bottom_valid_mid) > img_w // 8 else None

    # ── Clipping detection (middle 50% strip, 5-pixel border) ────────────
    qh, qw = img_h // 4, img_w // 4
    interior = raw_gray[qh:-qh, qw:-qw]
    int_mean = max(float(interior_mean), 1.0)

    def _clipped(strip):
        return (abs(float(strip.mean()) / int_mean - 1.0) < 0.20
                and float(strip.std()) < 25)

    right_clipped  = _clipped(raw_gray[qh:-qh, -5:])
    bottom_clipped = _clipped(raw_gray[-5:, qw:-qw])

    if top_cov < MIN_COV and left_cov < MIN_COV:
        return {'overall_conf': 0.0, 'corner_x_mm': None, 'corner_y_mm': None,
                'right_clipped': right_clipped, 'bottom_clipped': bottom_clipped,
                'top_coverage': top_cov, 'left_coverage': left_cov}

    # ── Corner position: MINIMUM detected value, not median ───────────────
    # The paper edge runs diagonally for tilted documents.  The minimum y
    # in the top scan corresponds to the actual top-left corner of the paper;
    # the median would give the midpoint of the diagonal.
    top_y_px  = float(min(top_valid))  if top_cov  >= MIN_COV else None
    left_x_px = float(min(left_valid)) if left_cov >= MIN_COV else None

    # Guard: if the minimum transition is at pixel 0 or 1, the scan is
    # detecting the scanner background (which is bright throughout) rather
    # than a real lid→paper boundary.  Null out that edge so it does not
    # anchor the crop to the scanner origin.
    if top_y_px is not None and top_y_px <= 1:
        # Check if most transitions are also near 0 (background, not edge)
        near_zero_frac = sum(1 for v in top_valid if v <= 2) / max(len(top_valid), 1)
        if near_zero_frac > 0.5:
            top_y_px = None
            top_cov  = 0.0
    if left_x_px is not None and left_x_px <= 1:
        near_zero_frac = sum(1 for v in left_valid if v <= 2) / max(len(left_valid), 1)
        if near_zero_frac > 0.5:
            left_x_px = None
            left_cov  = 0.0

    top_std   = float(np.std(top_valid))  if top_valid  else 99.0
    left_std  = float(np.std(left_valid)) if left_valid else 99.0

    corner_x_mm = left_x_px / px_per_mm_x if left_x_px is not None else None
    corner_y_mm = top_y_px  / px_per_mm_y if top_y_px  is not None else None

    # ── Paper dimension estimation ─────────────────────────────────────────
    is_full_bed_intent = (t_w >= bed_w - 1.0) and (t_h >= bed_h - 1.0)
    cx0 = corner_x_mm or 0.0
    cy0 = corner_y_mm or 0.0

    # Width: prefer detected right edge → user t_w → full extent to bed edge
    if right_x_px is not None and not right_clipped:
        paper_w_mm = right_x_px / px_per_mm_x - cx0
    elif right_clipped and not is_full_bed_intent:
        paper_w_mm = t_w
    else:
        paper_w_mm = bed_w - cx0

    # Height: prefer detected bottom edge → user t_h → full extent to bed edge
    if bottom_y_px is not None and not bottom_clipped:
        paper_h_mm = bottom_y_px / px_per_mm_y - cy0
    elif bottom_clipped and not is_full_bed_intent:
        paper_h_mm = t_h
    else:
        paper_h_mm = bed_h - cy0

    # ── Standard size snap ────────────────────────────────────────────────
    # Snap to a known paper size when dimensions are close — but do NOT snap
    # if the raw detected dimensions are already very close to the user-specified
    # t_w / t_h (within 3 mm).  Snapping in that case would override an accurate
    # user selection with a different standard size (e.g. Letter snapped to A4).
    close_to_user = (abs(paper_w_mm - t_w) < 3.0 and abs(paper_h_mm - t_h) < 3.0)
    matched = None if close_to_user else match_standard_size(paper_w_mm, paper_h_mm,
                                                              tolerance_mm=10.0)
    matched_size = None
    if matched:
        matched_size = matched[2]
        # Snap dimensions — preserve orientation
        if paper_w_mm <= paper_h_mm:
            paper_w_mm, paper_h_mm = (min(matched[0], matched[1]),
                                      max(matched[0], matched[1]))
        else:
            paper_w_mm, paper_h_mm = (max(matched[0], matched[1]),
                                      min(matched[0], matched[1]))

    # ── Document centre ───────────────────────────────────────────────────
    if corner_x_mm is not None and corner_y_mm is not None:
        doc_c_x_mm = corner_x_mm + paper_w_mm / 2.0
        doc_c_y_mm = corner_y_mm + paper_h_mm / 2.0
    elif corner_y_mm is not None:
        doc_c_x_mm = bed_w / 2.0            # horizontal: centre on bed
        doc_c_y_mm = corner_y_mm + paper_h_mm / 2.0
    elif corner_x_mm is not None:
        doc_c_x_mm = corner_x_mm + paper_w_mm / 2.0
        doc_c_y_mm = bed_h / 2.0            # vertical: centre on bed
    else:
        return {'overall_conf': 0.0, 'corner_x_mm': None, 'corner_y_mm': None,
                'right_clipped': right_clipped, 'bottom_clipped': bottom_clipped,
                'top_coverage': top_cov, 'left_coverage': left_cov}

    # ── Text-body margin sanity check ─────────────────────────────────────
    corner_validated = False
    if text_bbox is not None and corner_x_mm is not None and corner_y_mm is not None:
        bx, by, _bw, _bh = text_bbox
        margin_left_mm = (bx / px_per_mm_x) - corner_x_mm
        margin_top_mm  = (by / px_per_mm_y) - corner_y_mm
        # Standard margins: 15–40 mm.  DocuSign markers can be as close as
        # 10 mm; generous upper bound of 50 mm for unusual layouts.
        corner_validated = (10.0 <= margin_left_mm <= 50.0 and
                            10.0 <= margin_top_mm  <= 55.0)

    # ── Confidence score ─────────────────────────────────────────────────
    top_rel  = max(0.0, 1.0 - top_std  / search_px)
    left_rel = max(0.0, 1.0 - left_std / search_px)
    edge_conf = (top_cov * top_rel + left_cov * left_rel) / 2.0

    validation_bonus = 0.15 if corner_validated else 0.0
    size_bonus       = 0.10 if matched_size     else 0.0
    one_edge_penalty = 0.15 if (top_cov < MIN_COV) != (left_cov < MIN_COV) else 0.0

    overall_conf = min(1.0, edge_conf + validation_bonus + size_bonus - one_edge_penalty)

    if debug and img_path:
        dbg = cv2.cvtColor(raw_gray, cv2.COLOR_GRAY2BGR)
        # Draw detected edges
        for c, r in enumerate(top_ys):
            if r is not None:
                cv2.circle(dbg, (c, r), 1, (0, 255, 0), -1)
        for r, c in enumerate(left_xs):
            if c is not None:
                cv2.circle(dbg, (c, r), 1, (255, 0, 0), -1)
        if corner_x_mm is not None and corner_y_mm is not None:
            cx = int(corner_x_mm * px_per_mm_x)
            cy = int(corner_y_mm * px_per_mm_y)
            cv2.circle(dbg, (cx, cy), 5, (0, 0, 255), -1)
            cv2.putText(dbg, f"C conf={overall_conf:.2f} {matched_size or ''}",
                        (cx + 8, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
        cv2.imwrite(img_path + ".debug-C-edges.jpg", dbg)

    return {
        'corner_x_mm': corner_x_mm,
        'corner_y_mm': corner_y_mm,
        'paper_w_mm':  paper_w_mm,
        'paper_h_mm':  paper_h_mm,
        'doc_c_x_mm':  doc_c_x_mm,
        'doc_c_y_mm':  doc_c_y_mm,
        'overall_conf':    overall_conf,
        'right_clipped':   right_clipped,
        'bottom_clipped':  bottom_clipped,
        'top_coverage':    top_cov,
        'left_coverage':   left_cov,
        'matched_size':    matched_size,
        'corner_validated': corner_validated,
    }


# Confidence thresholds for applying the Heuristic C override
_HC_CONF_INTERACTIVE = 0.40
_HC_CONF_BATCH       = 0.60


# ============================================================
# Heuristic B: Contour/Edge Analysis (original "Smart-Anchor")
# ============================================================

def run_heuristic_b(masked, img_w, img_h, margin_x, margin_y,
                    debug=False, img_path=None, img_orig=None):
    """
    Original document detection via Canny edges + minAreaRect + Surgical Restore.
    Returns dict(angle_deg, c_x_px, c_y_px, w_px, h_px) or None if no contours found.
    angle_deg is in the OpenCV minAreaRect convention: [-90, 0).
    """
    blurred = cv2.GaussianBlur(masked, (5, 5), 0)
    edges = cv2.Canny(blurred, 15, 50)

    if debug and img_path:
        cv2.imwrite(img_path + ".debug-2-edges.jpg", edges)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    valid_contours = [c for c in contours if cv2.arcLength(c, False) >= 50]

    if debug and img_path and img_orig is not None:
        debug_img = img_orig.copy()
        cv2.drawContours(debug_img, valid_contours, -1, (0, 255, 0), 2)
        cv2.imwrite(img_path + ".debug-3-contours.jpg", debug_img)

    if not valid_contours:
        return None

    points = np.vstack(valid_contours)
    rect = cv2.minAreaRect(points)

    # Surgical Restore: snap corners touching the wipe boundary back to image edge
    box = cv2.boxPoints(rect)
    for i in range(4):
        x, y = box[i]
        if abs(x - margin_x) <= 2:
            box[i][0] = 0
        elif abs(x - (img_w - margin_x)) <= 2:
            box[i][0] = img_w
        if abs(y - margin_y) <= 2:
            box[i][1] = 0
        elif abs(y - (img_h - margin_y)) <= 2:
            box[i][1] = img_h

    rect = cv2.minAreaRect(np.float32(box))

    if debug and img_path and img_orig is not None:
        final_box = cv2.boxPoints(rect)
        debug_img = img_orig.copy()
        cv2.drawContours(debug_img, [np.int32(final_box)], 0, (0, 0, 255), 2)
        cv2.imwrite(img_path + ".debug-4-rect.jpg", debug_img)

    c_x_px, c_y_px = rect[0]
    w_px, h_px = rect[1]
    angle_deg = rect[2]

    return {
        'angle_deg': angle_deg,
        'c_x_px': float(c_x_px),
        'c_y_px': float(c_y_px),
        'w_px': float(w_px),
        'h_px': float(h_px),
    }


# ============================================================
# Projection Variance Angle Detection
# ============================================================

def detect_angle_by_projection(thresh, img_h, img_w,
                                coarse_step=0.5, fine_step=0.1,
                                angle_range=15.0, trim_frac=0.15):
    """
    Find the document skew angle by maximising the variance of horizontal
    row projections.  When text is aligned horizontally, the row sums
    alternate sharply between dense (text) and sparse (inter-line gap)
    values, giving maximum variance.

    Works at any resolution and is immune to the scanner-border artefacts
    that confound HoughLinesP on low-resolution previews (where individual
    character strokes dominate rather than full-line blobs).

    Returns (angle_deg, peak_ratio) where:
      angle_deg   — rotation to apply to make text horizontal (OpenCV
                    convention: negative = clockwise).  The caller passes
                    this directly as text_angle to text_angle_to_rotate_angle().
      peak_ratio  — variance at peak / variance at 0°.  > 1 means a real
                    tilt was detected; higher = stronger signal.
    """
    # Trim top and bottom borders to exclude scanner-edge artefacts.
    trim = int(img_h * trim_frac)
    t_mid = thresh[trim: img_h - trim, :]
    h2, w2 = t_mid.shape
    center = (w2 // 2, h2 // 2)

    def best_in_range(lo, hi, step):
        best_a, best_v = 0.0, 0.0
        var_0 = 0.0
        for a in np.arange(lo, hi + step / 2, step):
            M = cv2.getRotationMatrix2D(center, float(a), 1.0)
            rot = cv2.warpAffine(t_mid, M, (w2, h2), borderValue=0)
            v = float(np.var(np.sum(rot.astype(np.float32), axis=1)))
            if abs(a) < step / 2:
                var_0 = v
            if v > best_v:
                best_v = v
                best_a = float(a)
        return best_a, best_v, var_0

    # Coarse pass, then refine around the peak.
    best_coarse, _, _ = best_in_range(-angle_range, angle_range, coarse_step)
    best_fine, best_v, var_0 = best_in_range(
        best_coarse - coarse_step, best_coarse + coarse_step, fine_step)

    peak_ratio = best_v / max(var_0, 1.0)
    return best_fine, peak_ratio


# ============================================================
# Heuristic A: Text Presence & Skew Detection
# ============================================================

def run_heuristic_a(masked, debug=False, img_path=None):
    """
    Text-based analysis for white-on-white documents.
    Pipeline: blur -> adaptive threshold -> horizontal dilation -> HoughLinesP.
    Returns dict(text_angle, text_bbox, text_confidence_score, thresh).
    text_angle: degrees from horizontal, in [-20, 20].  Positive = clockwise tilt.
    text_bbox: (x, y, w, h) in pixels, or None.
    text_confidence_score: 0.0–1.0.
    """
    img_h, img_w = masked.shape[:2]

    blurred = cv2.GaussianBlur(masked, (3, 3), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        15, 5
    )

    if debug and img_path:
        cv2.imwrite(img_path + ".debug-A1-thresh.jpg", thresh)

    # Merge words into text lines with a wide horizontal kernel
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    dilated = cv2.dilate(thresh, kernel, iterations=2)

    if debug and img_path:
        cv2.imwrite(img_path + ".debug-A2-dilated.jpg", dilated)

    # Bounding box of all significant text content
    text_contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = img_w * img_h * 0.0001  # >= 0.01% of image area
    significant = [c for c in text_contours if cv2.contourArea(c) > min_area]

    if not significant:
        return {
            'text_angle': 0.0,
            'text_bbox': None,
            'textlines_bbox': None,
            'text_confidence_score': 0.0,
            'thresh': thresh,
        }

    all_points = np.vstack(significant)
    bx, by, bw, bh = cv2.boundingRect(all_points)
    text_bbox = (bx, by, bw, bh)

    # HoughLinesP to detect horizontal text baselines
    lines = cv2.HoughLinesP(
        dilated,
        rho=1,
        theta=np.pi / 180,
        threshold=30,
        minLineLength=int(img_w * 0.05),
        maxLineGap=int(img_w * 0.02),
    )

    if lines is None or len(lines) < 3:
        return {
            'text_angle': 0.0,
            'text_bbox': text_bbox,
            'textlines_bbox': text_bbox,
            'text_confidence_score': 0.1,
            'thresh': thresh,
        }

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 == x1:
            continue
        # Ensure left-to-right direction for consistent sign
        if x2 < x1:
            x1, y1, x2, y2 = x2, y2, x1, y1
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        if abs(angle) <= 20:
            angles.append(angle)

    if len(angles) < 3:
        return {
            'text_angle': 0.0,
            'text_bbox': text_bbox,
            'textlines_bbox': text_bbox,
            'text_confidence_score': 0.15,
            'thresh': thresh,
        }

    # Refine the angle estimate using the dominant cluster rather than the
    # global median.  Business letters often have bimodal distributions: body
    # text at one angle and headers/footers/logos at a different angle; the
    # global median can land between the two clusters.
    #
    # Slide a ±3° window to find the centre with the most agreeing lines and
    # use the median of that cluster as the angle estimate.  Confidence is
    # intentionally based on ALL detected lines (including off-cluster ones),
    # which correctly penalises bimodal / inconsistent distributions.  Using
    # only the cluster for confidence would inflate scores for documents with
    # few but tightly-grouped lines (e.g. edge artefacts on photos).
    angles_arr = np.array(angles, dtype=float)
    best_center = float(np.median(angles_arr))
    best_count = 0
    for candidate in angles_arr:
        mask = np.abs(angles_arr - candidate) <= 3.0
        if mask.sum() > best_count:
            best_count = int(mask.sum())
            best_center = float(np.median(angles_arr[mask]))

    median_angle = float(np.median(angles_arr[np.abs(angles_arr - best_center) <= 3.0]))
    n_lines = len(angles)                             # total qualifying lines
    angle_std = float(np.std(angles_arr))             # global std for confidence

    # Score: rewards many parallel lines AND global angular consistency.
    # High global std (bimodal distribution) → low confidence → risk-3 fallback.
    line_score = min(1.0, (n_lines - 3) / 7.0)          # 0.0 at 3, 1.0 at 10+
    consistency_score = max(0.0, 1.0 - angle_std / 5.0)  # 1.0 at 0°, 0.0 at 5°+
    confidence = 0.3 * line_score + 0.7 * consistency_score

    # Compute a tighter bbox from only "line-shaped" blobs (text baselines).
    # This separates genuine text lines from stamps, logos, or border art so
    # that check_dirty_pixels can reliably detect out-of-bounds content.
    textline_contours = []
    for c in significant:
        bx_, by_, bw_, bh_ = cv2.boundingRect(c)
        if bw_ > 0 and bh_ > 0:
            ar = bw_ / bh_
            if ar > 3.0 or bw_ > img_w * 0.15:
                textline_contours.append(c)

    if textline_contours:
        tl_pts = np.vstack(textline_contours)
        tbx, tby, tbw, tbh = cv2.boundingRect(tl_pts)
        textlines_bbox = (tbx, tby, tbw, tbh)
    else:
        textlines_bbox = text_bbox  # fallback: use full content bbox

    # Replace the HoughLinesP-derived angle with the projection-variance
    # result, which is robust against the scanner-border artefacts that
    # dominate the HoughLinesP output at 100 dpi preview resolution.
    # (At 100 dpi, the 40×1 dilation does not effectively merge characters
    # into line-length blobs; individual strokes at ≈45° swamp the ±20°
    # filter and all qualifying lines come from scanner top/bottom edges.)
    proj_angle, proj_peak_ratio = detect_angle_by_projection(thresh, img_h, img_w)

    return {
        'text_angle': proj_angle,   # projection-variance angle (accurate)
        'text_bbox': text_bbox,
        'textlines_bbox': textlines_bbox,
        'text_confidence_score': confidence,
        'thresh': thresh,
        'n_lines': n_lines,
        'angle_std': angle_std,
        'proj_peak_ratio': proj_peak_ratio,
    }


# ============================================================
# Dirty Pixel Safety Check
# ============================================================

def check_dirty_pixels(thresh_img, text_bbox, img_w, img_h, safety_margin_frac=0.03):
    """
    Returns True if it is safe to crop tightly to text_bbox (no significant
    high-contrast content outside the bbox + margin).  Returns False if
    'dirty' pixels (stamps, signatures, border markings) exist outside.
    """
    if text_bbox is None:
        return False

    bx, by, bw, bh = text_bbox
    mx = int(img_w * safety_margin_frac)
    my = int(img_h * safety_margin_frac)

    ex1 = max(0, bx - mx)
    ey1 = max(0, by - my)
    ex2 = min(img_w, bx + bw + mx)
    ey2 = min(img_h, by + bh + my)

    # Mask the OUTSIDE region (everything not in the expanded bbox)
    outside_mask = np.zeros(thresh_img.shape, dtype=np.uint8)
    outside_mask[:ey1, :] = 255
    outside_mask[ey2:, :] = 255
    outside_mask[ey1:ey2, :ex1] = 255
    outside_mask[ey1:ey2, ex2:] = 255

    outside_dark = cv2.bitwise_and(thresh_img, outside_mask)
    dirty_ratio = np.count_nonzero(outside_dark) / (img_w * img_h)

    # More than 0.1% dark pixels outside = dirty (signatures, stamps, border art).
    # At a typical 800x1100 preview resolution this corresponds to ~880 pixels
    # (roughly a 30x30px block), which catches stamps/signatures while ignoring
    # isolated dust specks (typically single-digit pixel counts).
    return dirty_ratio <= 0.001


# ============================================================
# Angle → rotate_angle conversion helpers
# ============================================================

def rect_to_rotate_angle(angle_deg):
    """
    Convert minAreaRect angle [-90, 0) to the correction rotate_angle and
    return (rotate_angle, swap_dims).  swap_dims is True when the rect's
    short axis is labelled as width (i.e. the document is portrait but the
    rect reports it as landscape-ish).
    """
    if angle_deg < -45:
        return -(angle_deg + 90), True
    else:
        return -angle_deg, False


def text_angle_to_rotate_angle(text_angle):
    """
    text_angle from atan2 is in [-20, 20] degrees with clockwise = positive.
    A clockwise tilt requires a counter-clockwise correction → negative angle.
    ImageMagick SRT: positive = counter-clockwise, so we negate.
    """
    return -text_angle


# ============================================================
# Risk Decision Engine
# ============================================================

# Confidence thresholds
_HIGH_CONF = 0.5   # minimum for interactive level-1/2
_CLEAR_CONF = 0.65  # minimum for batch level-1/2


def risk_decision_engine(heuristic_a, heuristic_b, mode,
                         t_w=None, t_h=None, bed_w=None, bed_h=None):
    """
    Merge Heuristic A (text) and B (contour) into a single result dict.
    Returns None for risk-level 0 (no-op / don't transform).
    Returns dict(risk_level, rotate_angle, c_x_px, c_y_px, w_px, h_px) otherwise.

    t_w, t_h: user-selected target scan dimensions (mm).  Used to cap the
    full-bed guard output to the actual scan area, preventing the padded
    preview height (which represents the full scanner bed) from inflating
    the output dimensions beyond the user's chosen paper size.
    """
    text_conf = heuristic_a['text_confidence_score']
    text_angle = heuristic_a['text_angle']
    text_bbox = heuristic_a['text_bbox']
    textlines_bbox = heuristic_a.get('textlines_bbox', text_bbox)
    thresh = heuristic_a['thresh']

    # Use the tighter textlines_bbox (only line-shaped blobs) for the dirty
    # pixel check so that stamps/logos outside the text area are caught even
    # when they have been absorbed into the wider text_bbox.
    is_clean = check_dirty_pixels(thresh, textlines_bbox,
                                  thresh.shape[1], thresh.shape[0])
    high_conf = text_conf >= _HIGH_CONF
    clear_conf = text_conf >= _CLEAR_CONF

    # --- Determine raw risk level ---
    if heuristic_b is None:
        if high_conf and text_bbox is not None and is_clean:
            risk_level = 1
        else:
            risk_level = 0
    elif not high_conf:
        # Low text confidence: photo, graphic, or blank page → rely on contour
        risk_level = 3
    elif is_clean:
        risk_level = 1  # safe tight crop around text
    else:
        risk_level = 2  # text deskew + contour crop boundary

    # --- Batch-mode safety cap ---
    if mode == 'batch':
        if risk_level == 3:
            # Contour-only crop in batch is generally risky (no text anchor).
            # Exception: allow it when the contour detection shows the document
            # is clearly smaller than the scanner bed in both dimensions, which
            # indicates a high-confidence edge detection (visible document on bed).
            # This covers flatbed scans of photos, IDs, and non-text documents.
            if heuristic_b is not None:
                img_area = thresh.shape[0] * thresh.shape[1]
                doc_area = heuristic_b['w_px'] * heuristic_b['h_px']
                # Allow risk-3 only when the document occupies significantly
                # less area than the image, indicating clear visible edges.
                # This keeps conservative mode safe for ADF (document fills bed,
                # area ratio ≈ 1) while enabling it for clearly cropped docs.
                img_w_b = thresh.shape[1]
                img_h_b = thresh.shape[0]
                b_w = heuristic_b['w_px'] if heuristic_b['angle_deg'] >= -45 else heuristic_b['h_px']
                b_h = heuristic_b['h_px'] if heuristic_b['angle_deg'] >= -45 else heuristic_b['w_px']
                contour_fills_image = (b_w / img_w_b > 0.99) and (b_h / img_h_b > 0.99)
                if doc_area / img_area < 0.72:
                    pass  # clearly smaller than bed → keep risk-3
                elif text_conf > 0.15 and not contour_fills_image:
                    # Large document with text and a non-trivial contour: the
                    # full-bed guard will apply in the output step (no actual
                    # crop), so this is safe in batch — it is just a deskew.
                    pass
                else:
                    risk_level = 0
            else:
                risk_level = 0
        elif risk_level in (1, 2) and not clear_conf:
            # Not confident enough for automatic crop → no-op
            risk_level = 0

    # --- Translate to output parameters ---
    if risk_level == 0:
        return None

    if risk_level == 1:
        bx, by, bw, bh = text_bbox
        img_w_t = thresh.shape[1]
        img_h_t = thresh.shape[0]

        # Full-bed guard: apply when text spans > 80% of the image in both
        # dimensions, OR when the user explicitly selected the full scanner
        # bed as the target (ADF / no-paper-size-override).  In either case
        # the text bounding box is unreliable as a crop boundary and we should
        # only apply the deskew angle, returning the user's target dimensions.
        is_full_bed_intent = bool(t_w and bed_w and t_h and bed_h and
                                  t_w >= bed_w - 1.0 and t_h >= bed_h - 1.0)
        if is_full_bed_intent or ((bw / img_w_t) > 0.80 and (bh / img_h_t) > 0.80):
            cap_w = int(t_w / bed_w * img_w_t) if (t_w and bed_w) else img_w_t
            cap_h = int(t_h / bed_h * img_h_t) if (t_h and bed_h) else img_h_t
            w_px = float(min(img_w_t, cap_w))
            h_px = float(min(img_h_t, cap_h))
            c_x_px = w_px / 2.0
            c_y_px = h_px / 2.0
        else:
            c_x_px = bx + bw / 2.0
            c_y_px = by + bh / 2.0
            w_px = float(bw)
            h_px = float(bh)

        return {
            'risk_level': 1,
            'rotate_angle': text_angle_to_rotate_angle(text_angle),
            'c_x_px': c_x_px,
            'c_y_px': c_y_px,
            'w_px': w_px,
            'h_px': h_px,
            'swap_dims': False,
        }

    if risk_level == 2:
        b = heuristic_b
        _, swap = rect_to_rotate_angle(b['angle_deg'])
        w_px = b['h_px'] if swap else b['w_px']
        h_px = b['w_px'] if swap else b['h_px']

        # Apply the same full-bed guard as risk-1: when the document fills most
        # of the image, the contour is measuring the ink area rather than the
        # paper boundary.  Force full-bed / scan-size dimensions in that case.
        if text_conf > 0.15:
            img_w_t = thresh.shape[1]
            img_h_t = thresh.shape[0]
            if (w_px / img_w_t) > 0.80 and (h_px / img_h_t) > 0.80:
                cap_w = int(t_w / bed_w * img_w_t) if (t_w and bed_w) else img_w_t
                cap_h = int(t_h / bed_h * img_h_t) if (t_h and bed_h) else img_h_t
                w_px = float(min(img_w_t, cap_w))
                h_px = float(min(img_h_t, cap_h))

        return {
            'risk_level': 2,
            'rotate_angle': text_angle_to_rotate_angle(text_angle),
            'c_x_px': b['c_x_px'],
            'c_y_px': b['c_y_px'],
            'w_px': w_px,
            'h_px': h_px,
            'swap_dims': swap,
        }

    # risk_level == 3
    b = heuristic_b
    rot_contour, swap = rect_to_rotate_angle(b['angle_deg'])
    w_px = b['h_px'] if swap else b['w_px']
    h_px = b['w_px'] if swap else b['h_px']

    # For the rotation, prefer the projection-variance angle (from heuristic_a)
    # over the contour bounding-rect angle.  The contour angle is the angle of
    # the ink bounding box, which for white-on-white documents is dominated by
    # the nearly-rectangular text content and gives a near-zero angle even for
    # noticeably tilted documents.  The projection angle is directly measured
    # from the text-line periodicity and is much more accurate.
    # When the projection signal is weak (e.g. blank page), fall back to
    # the contour angle.
    proj_peak = heuristic_a.get('proj_peak_ratio', 0.0)
    if proj_peak > 1.1:
        rot = text_angle_to_rotate_angle(heuristic_a['text_angle'])
    else:
        rot = rot_contour

    # Full-bed guard for large text documents: when text lines are present
    # (any positive text confidence) and the contour bounding box covers most
    # of the bed, the document is a white-on-white page whose ink content area
    # is smaller than the physical paper.  Cropping to the ink boundary would
    # cut into the paper margins, so we fall back to full image dimensions.
    # This is the typical business-letter-on-flatbed case.
    if text_conf > 0.15:
        img_w_t = thresh.shape[1]
        img_h_t = thresh.shape[0]
        if (w_px / img_w_t) > 0.80 and (h_px / img_h_t) > 0.80:
            # Cap to actual scan dims (t_w/t_h) to avoid using the padded
            # preview height when the user selected a paper shorter than the bed.
            cap_w = int(t_w / bed_w * img_w_t) if (t_w and bed_w) else img_w_t
            cap_h = int(t_h / bed_h * img_h_t) if (t_h and bed_h) else img_h_t
            w_px = float(min(img_w_t, cap_w))
            h_px = float(min(img_h_t, cap_h))

    return {
        'risk_level': 3,
        'rotate_angle': rot,
        'c_x_px': b['c_x_px'],
        'c_y_px': b['c_y_px'],
        'w_px': w_px,
        'h_px': h_px,
        'swap_dims': swap,
    }


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Auto-Crop and Deskew for Scanservjs")
    parser.add_argument('--image', type=str, required=True,
                        help='Path to the preview image')
    parser.add_argument('--left', type=float, required=True,
                        help='Target box left coordinate (mm)')
    parser.add_argument('--top', type=float, required=True,
                        help='Target box top coordinate (mm)')
    parser.add_argument('--width', type=float, required=True,
                        help='Target box width (mm)')
    parser.add_argument('--height', type=float, required=True,
                        help='Target box height (mm)')
    parser.add_argument('--bed-width', type=float, required=True,
                        help='Scanner bed width (mm)')
    parser.add_argument('--bed-height', type=float, required=True,
                        help='Scanner bed height (mm)')
    parser.add_argument('--mode', choices=['interactive', 'batch'],
                        default='interactive',
                        help='interactive: allow up to risk-3 crops; '
                             'batch: conservative, only high-confidence crops')
    parser.add_argument('--no-scale', action='store_true',
                        help='Force scale factors sx=sy=1.0 (disable scale-to-fit). '
                             'Use when the caller handles sizing externally, e.g. '
                             'scan-controller automatic mode.')
    parser.add_argument('--debug', action='store_true',
                        help='Output visual debug images')

    try:
        args = parser.parse_args()
    except SystemExit:
        print(json.dumps({"error": "Argument parsing error"}))
        return

    img_path = args.image
    t_x = args.left
    t_y = args.top
    t_w = args.width
    t_h = args.height
    bed_w = args.bed_width
    bed_h = args.bed_height
    mode = args.mode

    img = cv2.imread(img_path)
    if img is None:
        print(json.dumps({"error": "Cannot read image"}))
        return

    img_h, img_w = img.shape[:2]

    # ── Step 1: Bezel Wipe (1.5% margin on all sides) ──────────────────────
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # raw_gray is preserved before the wipe for Heuristic C (border edge detection)
    raw_gray = gray
    margin_x = int(img_w * 0.015)
    margin_y = int(img_h * 0.015)

    masked = gray.copy()
    masked[0:margin_y, :] = 255
    masked[-margin_y:, :] = 255
    masked[:, 0:margin_x] = 255
    masked[:, -margin_x:] = 255

    if args.debug:
        cv2.imwrite(img_path + ".debug-1-wipe.jpg", masked)

    # ── Step 2: Run all heuristics ──────────────────────────────────────────
    heuristic_b = run_heuristic_b(
        masked, img_w, img_h, margin_x, margin_y,
        debug=args.debug, img_path=img_path, img_orig=img
    )
    heuristic_a = run_heuristic_a(
        masked, debug=args.debug, img_path=img_path
    )
    heuristic_c = run_heuristic_c(
        raw_gray, img_w, img_h, t_w, t_h, bed_w, bed_h,
        text_bbox=heuristic_a.get('text_bbox'),
        debug=args.debug, img_path=img_path
    )

    if args.debug:
        sys.stderr.write(
            f"[autocrop] mode={mode} "
            f"text_conf={heuristic_a['text_confidence_score']:.3f} "
            f"text_angle={heuristic_a['text_angle']:.2f} "
            f"n_lines={heuristic_a.get('n_lines', 0)} "
            f"heuristic_b={'ok' if heuristic_b else 'none'} "
            f"hc_conf={heuristic_c['overall_conf']:.2f} "
            f"hc_snap={heuristic_c.get('matched_size') or '-'}\n"
        )

    # ── Step 3: Risk decision engine ────────────────────────────────────────
    result = risk_decision_engine(heuristic_a, heuristic_b, mode,
                                  t_w=t_w, t_h=t_h, bed_w=bed_w, bed_h=bed_h)

    if result is None:
        # Risk level 0: return no-op (caller will not apply any transformation)
        print(json.dumps({"magic": None}))
        return

    rotate_angle = result['rotate_angle']
    c_x_px = result['c_x_px']
    c_y_px = result['c_y_px']
    w_px = result['w_px']
    h_px = result['h_px']

    # ── Step 4: Convert pixels → mm ─────────────────────────────────────────
    px_per_mm_x = img_w / bed_w if bed_w else 1
    px_per_mm_y = img_h / bed_h if bed_h else 1

    doc_c_x = c_x_px / px_per_mm_x
    doc_c_y = c_y_px / px_per_mm_y
    doc_w_mm = w_px / px_per_mm_x
    doc_h_mm = h_px / px_per_mm_y

    # ── Step 4b: Heuristic C override ────────────────────────────────────────
    # When the paper-corner detection has sufficient confidence, override the
    # document centre and dimensions with the corner-anchored values.
    # The rotation angle is NOT overridden — it comes from the projection method
    # in Heuristic A which is far more accurate than anything derivable from
    # the 1-5 px border strip that Heuristic C uses.
    hc_conf = heuristic_c.get('overall_conf', 0.0)
    hc_thresh = _HC_CONF_BATCH if mode == 'batch' else _HC_CONF_INTERACTIVE
    hc_applies = (
        hc_conf >= hc_thresh
        and heuristic_c.get('doc_c_x_mm') is not None
        and heuristic_c.get('doc_c_y_mm') is not None
        and heuristic_c.get('paper_w_mm') is not None
        and heuristic_c.get('paper_h_mm') is not None
        # Sanity: dimensions must be plausible (not smaller than 30mm or
        # larger than the scanner bed + 5mm margin)
        and heuristic_c['paper_w_mm'] > 30.0
        and heuristic_c['paper_h_mm'] > 30.0
        and heuristic_c['paper_w_mm'] <= bed_w + 5.0
        and heuristic_c['paper_h_mm'] <= bed_h + 5.0
    )
    if hc_applies:
        doc_c_x  = heuristic_c['doc_c_x_mm']
        doc_c_y  = heuristic_c['doc_c_y_mm']
        doc_w_mm = heuristic_c['paper_w_mm']
        doc_h_mm = heuristic_c['paper_h_mm']
        if args.debug:
            sys.stderr.write(
                f"[autocrop] heuristic_c override: "
                f"centre=({doc_c_x:.1f},{doc_c_y:.1f})mm "
                f"dims={doc_w_mm:.1f}x{doc_h_mm:.1f}mm "
                f"snap={heuristic_c.get('matched_size') or 'none'}\n"
            )

    # ── Step 5: Scale-to-fit logic ───────────────────────────────────────────
    # --no-scale forces sx=sy=1.0 regardless of paper-size selection.
    # This is used by the automatic scan-time path (scan-controller) to prevent
    # scale-to-fit from distorting the output when the scan was done with a
    # paper size shorter than the full bed.
    if args.no_scale:
        sx = 1.0
        sy = 1.0
    elif (t_w >= bed_w - 1.0) and (t_h >= bed_h - 1.0):
        # Target dimensions equal the full bed: no scaling needed.
        sx = 1.0
        sy = 1.0
    else:
        rx = t_w / doc_w_mm if doc_w_mm > 0 else 1.0
        ry = t_h / doc_h_mm if doc_h_mm > 0 else 1.0
        diff = abs(rx - ry)
        avg = (rx + ry) / 2.0
        if (diff / avg) <= 0.02:
            sx = rx
            sy = ry
        else:
            s = min(rx, ry)
            sx = s
            sy = s

    # ── Step 6: Build ImageMagick SRT string ─────────────────────────────────
    # Source center: document center in input pixels (rotate around this point).
    fx_cx = f"%[fx:((({doc_c_x:.6f} - {{OX}}) / {{IW}}) * w)]"
    fx_cy = f"%[fx:((({doc_c_y:.6f} - {{OY}}) / {{IH}}) * h)]"
    # Destination center: always the image center so that the document ends up
    # centred in the output regardless of where it sat on the scanner bed.
    # The downstream surgical crop (`-gravity center -extent WxH`) then extracts
    # the document precisely.  When the scan was pre-cropped to the document area
    # (magic-wand workflow) the document centre already coincides with the image
    # centre, so this has no practical effect on that path.
    fx_tx = "%[fx:w/2]"
    fx_ty = "%[fx:h/2]"

    srt_str = f"{fx_cx},{fx_cy} {sx:f},{sy:f} {rotate_angle:.6f} {fx_tx},{fx_ty}"
    magic_str = (f"-background white -virtual-pixel white "
                 f"-distort SRT \"{srt_str}\" +repage")

    output = {
        "magic": magic_str,
        "angle": rotate_angle,
        "doc_w": doc_w_mm,
        "doc_h": doc_h_mm,
        "doc_c_x": doc_c_x,
        "doc_c_y": doc_c_y,
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
