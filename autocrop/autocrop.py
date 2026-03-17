import sys
import json
import cv2
import numpy as np
import math

import argparse


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

    return {
        'text_angle': median_angle,
        'text_bbox': text_bbox,
        'textlines_bbox': textlines_bbox,
        'text_confidence_score': confidence,
        'thresh': thresh,
        'n_lines': n_lines,
        'angle_std': angle_std,
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


def risk_decision_engine(heuristic_a, heuristic_b, mode):
    """
    Merge Heuristic A (text) and B (contour) into a single result dict.
    Returns None for risk-level 0 (no-op / don't transform).
    Returns dict(risk_level, rotate_angle, c_x_px, c_y_px, w_px, h_px) otherwise.
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
                if doc_area / img_area < 0.72:
                    pass  # clearly smaller than bed → keep risk-3
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

        # Full-bed guard: if text spans > 90% in both dimensions, there is no
        # meaningful crop to perform (e.g. white-on-white A4 letter filling the
        # full A4 bed).  Only apply the deskew angle — keep full bed dimensions.
        if (bw / img_w_t) > 0.90 and (bh / img_h_t) > 0.90:
            c_x_px = img_w_t / 2.0
            c_y_px = img_h_t / 2.0
            w_px = float(img_w_t)
            h_px = float(img_h_t)
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
    rot, swap = rect_to_rotate_angle(b['angle_deg'])
    w_px = b['h_px'] if swap else b['w_px']
    h_px = b['w_px'] if swap else b['h_px']

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
            w_px = float(img_w_t)
            h_px = float(img_h_t)

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
    margin_x = int(img_w * 0.015)
    margin_y = int(img_h * 0.015)

    masked = gray.copy()
    masked[0:margin_y, :] = 255
    masked[-margin_y:, :] = 255
    masked[:, 0:margin_x] = 255
    masked[:, -margin_x:] = 255

    if args.debug:
        cv2.imwrite(img_path + ".debug-1-wipe.jpg", masked)

    # ── Step 2: Run both heuristics ─────────────────────────────────────────
    heuristic_b = run_heuristic_b(
        masked, img_w, img_h, margin_x, margin_y,
        debug=args.debug, img_path=img_path, img_orig=img
    )
    heuristic_a = run_heuristic_a(
        masked, debug=args.debug, img_path=img_path
    )

    if args.debug:
        sys.stderr.write(
            f"[autocrop] mode={mode} "
            f"text_conf={heuristic_a['text_confidence_score']:.3f} "
            f"text_angle={heuristic_a['text_angle']:.2f} "
            f"n_lines={heuristic_a.get('n_lines', 0)} "
            f"heuristic_b={'ok' if heuristic_b else 'none'}\n"
        )

    # ── Step 3: Risk decision engine ────────────────────────────────────────
    result = risk_decision_engine(heuristic_a, heuristic_b, mode)

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

    # ── Step 5: Scale-to-fit logic (unchanged from original) ─────────────────
    is_full_bed = (t_w >= bed_w - 1.0) and (t_h >= bed_h - 1.0)

    if is_full_bed:
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
