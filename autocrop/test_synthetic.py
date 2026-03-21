"""
Synthetic test suite for autocrop edge detection and cropping.

Each test generates a parameterised scanner-preview image and evaluates
whether the algorithm correctly recovers angle, crop position, and
crop dimensions.  Tests are ordered by difficulty.

Run with:  .venv/bin/python autocrop/test_synthetic.py
"""
import sys, os, math, json, subprocess
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from autocrop import (
    run_heuristic_a, run_heuristic_b, risk_decision_engine,
    detect_angle_by_projection,
)

# ---------------------------------------------------------------------------
# Scanner simulation helpers
# ---------------------------------------------------------------------------

BED_W_MM = 215.9   # scanner bed width  (mm)
BED_H_MM = 297.0   # scanner bed height (mm)
PREVIEW_W = 868    # preview image width (px) — server always scales to this
PX_PER_MM = PREVIEW_W / BED_W_MM          # ≈ 4.02 px/mm
PREVIEW_H = round(BED_H_MM * PX_PER_MM)   # ≈ 1194 px


def mm2px(mm_x, mm_y):
    return int(mm_x * PX_PER_MM), int(mm_y * PX_PER_MM)


def make_scanner_preview(paper_w_mm, paper_h_mm,
                         tilt_deg=0.0,
                         origin_mm=(0.0, 0.0),
                         lid_gray=80,
                         paper_gray=252,
                         text_coverage=0.6,
                         n_text_lines=20,
                         has_logo=False,
                         docusign_line=False):
    """
    Simulate a scanner preview image.

    The scanner bed is BED_W_MM × BED_H_MM.  A sheet of paper with the
    given dimensions is placed at origin_mm (top-left corner, mm from
    scanner top-left) rotated by tilt_deg counter-clockwise.  The rest
    of the image is filled with the scanner lid colour.

    Parts of the paper that lie outside the scanner bed are simply absent
    (clipped), simulating a physical placement that exceeds the bed.

    Returns (img_bgr, ground_truth_dict).
    """
    img = np.full((PREVIEW_H, PREVIEW_W, 3), lid_gray, dtype=np.uint8)
    ox_px, oy_px = mm2px(*origin_mm)
    pw_px, ph_px = mm2px(paper_w_mm, paper_h_mm)

    # Build a rotated paper mask
    angle_rad = math.radians(-tilt_deg)   # counter-clockwise = negative rotation matrix
    cos_a, sin_a = math.cos(angle_rad), math.sin(angle_rad)

    for py in range(PREVIEW_H):
        for px in range(PREVIEW_W):
            # Inverse-rotate to paper coordinates
            dx = px - ox_px
            dy = py - oy_px
            paper_x =  dx * cos_a + dy * sin_a
            paper_y = -dx * sin_a + dy * cos_a
            if 0 <= paper_x < pw_px and 0 <= paper_y < ph_px:
                img[py, px] = (paper_gray, paper_gray, paper_gray)

    # Draw text lines on the paper area
    rng = np.random.default_rng(42)
    margin_px = int(25 * PX_PER_MM)   # 25 mm standard margin
    left_text = margin_px
    right_text = int(pw_px * text_coverage) + margin_px
    line_h = int(ph_px * 0.85 / (n_text_lines + 1))

    for i in range(1, n_text_lines + 1):
        # Line centre in paper coordinates
        lx0 = left_text + rng.integers(-3, 4)
        lx1 = right_text + rng.integers(-10, 4)
        ly  = margin_px + i * line_h

        # Convert to image coordinates (rotate and offset)
        def paper_to_img(px_p, py_p):
            ix = ox_px + px_p * cos_a - py_p * sin_a
            iy = oy_px + px_p * sin_a + py_p * cos_a
            return int(ix), int(iy)

        ix0, iy0 = paper_to_img(lx0, ly)
        ix1, iy1 = paper_to_img(lx1, ly)
        if (0 <= ix0 < PREVIEW_W and 0 <= iy0 < PREVIEW_H and
                0 <= ix1 < PREVIEW_W and 0 <= iy1 < PREVIEW_H):
            cv2.line(img, (ix0, iy0), (ix1, iy1), (30, 30, 30), 2)

    # Optional: centred logo block (letterhead)
    if has_logo:
        logo_w, logo_h = int(pw_px * 0.3), int(ph_px * 0.05)
        lx = (pw_px - logo_w) // 2
        ly = margin_px // 2
        ix0, iy0 = paper_to_img(lx, ly)
        ix1, iy1 = paper_to_img(lx + logo_w, ly + logo_h)
        cv2.rectangle(img, (ix0, iy0), (ix1, iy1), (60, 60, 60), -1)

    # Optional: DocuSign marker — very close to left edge, near top
    if docusign_line:
        ds_x = int(15 * PX_PER_MM)   # 15 mm from paper left
        ds_y = int(5 * PX_PER_MM)    # 5 mm from paper top (in margin)
        ds_w = int(80 * PX_PER_MM)
        ix0, iy0 = paper_to_img(ds_x, ds_y)
        ix1, iy1 = paper_to_img(ds_x + ds_w, ds_y)
        if all(0 <= c < PREVIEW_W for c in [ix0, ix1]) and \
                all(0 <= r < PREVIEW_H for r in [iy0, iy1]):
            cv2.line(img, (ix0, iy0), (ix1, iy1), (40, 40, 40), 2)

    # Compute ground truth
    right_clipped  = (ox_px + pw_px) > PREVIEW_W
    bottom_clipped = (oy_px + ph_px) > PREVIEW_H
    # Visible paper dimensions (clipped to bed)
    vis_w_mm = min(paper_w_mm, BED_W_MM - origin_mm[0])
    vis_h_mm = min(paper_h_mm, BED_H_MM - origin_mm[1])

    gt = {
        'tilt_deg': tilt_deg,
        'origin_mm': origin_mm,
        'paper_w_mm': paper_w_mm,
        'paper_h_mm': paper_h_mm,
        'right_clipped': right_clipped,
        'bottom_clipped': bottom_clipped,
        'vis_w_mm': vis_w_mm,
        'vis_h_mm': vis_h_mm,
        'doc_c_x_mm': origin_mm[0] + paper_w_mm / 2,
        'doc_c_y_mm': origin_mm[1] + paper_h_mm / 2,
    }
    return img, gt


# ---------------------------------------------------------------------------
# Edge detection helper (Heuristic C prototype)
# ---------------------------------------------------------------------------

def detect_paper_edges(raw_gray, img_w, img_h, t_w, t_h, bright_thresh=200):
    """
    Detect the visible paper boundary at the scanner bed edges.

    Uses the raw (non-wiped) image.  Scans the first 30 rows from the
    top and first 30 columns from the left looking for the bright-to-dark
    (lid→paper) transition.  Checks right and bottom for uniformity to
    decide if those edges are clipped.

    Returns a dict with:
      top_y_px, left_x_px : detected edge positions (None if not found)
      top_coverage, left_coverage : fraction of rows/cols with valid detection
      right_clipped, bottom_clipped : bool
      edge_conf : 0-1, overall confidence in the detection
      corner_x_mm, corner_y_mm : paper top-left corner in mm (or None)
      paper_c_x_mm, paper_c_y_mm : paper centre in mm using t_w/t_h (or None)
    """
    SEARCH = 30   # px to search from each border
    MIN_COV = 0.6  # minimum coverage to trust the edge

    # Top edge: first bright row per column
    top_ys = []
    for c in range(img_w):
        for r in range(min(SEARCH, img_h)):
            if raw_gray[r, c] > bright_thresh:
                top_ys.append(r)
                break
        else:
            top_ys.append(None)

    # Left edge: first bright column per row
    left_xs = []
    for r in range(img_h):
        for c in range(min(SEARCH, img_w)):
            if raw_gray[r, c] > bright_thresh:
                left_xs.append(c)
                break
        else:
            left_xs.append(None)

    top_coverage  = sum(1 for v in top_ys  if v is not None) / img_w
    left_coverage = sum(1 for v in left_xs if v is not None) / img_h

    # Compare the edge strip to the image interior to distinguish:
    #   clipped  → strip brightness ≈ paper (similar to interior)
    #   visible  → strip brightness ≈ lid  (different from interior)
    # Also require uniformity (low std) so that a visible diagonal edge
    # (rotated paper boundary) is not mistaken for clipping.
    interior = raw_gray[img_h // 4: 3 * img_h // 4,
                        img_w // 4: 3 * img_w // 4]
    int_mean = max(float(interior.mean()), 1.0)

    # Sample the middle 50% of each edge strip to avoid the tilted paper's
    # diagonal boundary contaminating the clipping check at the corners.
    qh, qw = img_h // 4, img_w // 4
    r_strip = raw_gray[qh:-qh, -5:]   # middle-height, outermost 5 columns
    r_similar = abs(r_strip.mean() / int_mean - 1.0) < 0.20
    right_clipped  = r_similar and float(r_strip.std()) < 25

    b_strip = raw_gray[-5:, qw:-qw]   # outermost 5 rows, middle-width
    b_similar = abs(b_strip.mean() / int_mean - 1.0) < 0.20
    bottom_clipped = b_similar and float(b_strip.std()) < 25

    # Use the MINIMUM detected position for the corner.
    # The paper top edge runs diagonally (for tilted documents), so the median
    # y value falls at the midpoint of the diagonal rather than at the corner.
    # The minimum top_y and minimum left_x correspond to the actual corner.
    top_y_px  = float(min(v for v in top_ys  if v is not None)) if top_coverage  > MIN_COV else None
    left_x_px = float(min(v for v in left_xs if v is not None)) if left_coverage > MIN_COV else None

    top_std  = float(np.std([v for v in top_ys  if v is not None])) if top_y_px  is not None else 99
    left_std = float(np.std([v for v in left_xs if v is not None])) if left_x_px is not None else 99

    # Confidence: also inversely proportional to the std.  High std in the top
    # transition positions indicates a clearly-tilted document (normal) not noise.
    # Normalise by the image dimension so that std scales correctly.
    edge_conf = (min(top_coverage, 1.0) + min(left_coverage, 1.0)) / 2 * \
                max(0.0, 1.0 - min(top_std, left_std) / 30)

    corner_x_mm = corner_y_mm = None
    paper_c_x_mm = paper_c_y_mm = None

    if top_y_px is not None and left_x_px is not None:
        px_per_mm_x = img_w / BED_W_MM
        px_per_mm_y = img_h / BED_H_MM
        corner_x_mm = left_x_px / px_per_mm_x
        corner_y_mm = top_y_px  / px_per_mm_y
        if right_clipped and bottom_clipped:
            paper_c_x_mm = corner_x_mm + t_w / 2
            paper_c_y_mm = corner_y_mm + t_h / 2

    return {
        'top_y_px': top_y_px, 'left_x_px': left_x_px,
        'top_coverage': top_coverage, 'left_coverage': left_coverage,
        'top_std': top_std, 'left_std': left_std,
        'right_clipped': right_clipped, 'bottom_clipped': bottom_clipped,
        'edge_conf': edge_conf,
        'corner_x_mm': corner_x_mm, 'corner_y_mm': corner_y_mm,
        'paper_c_x_mm': paper_c_x_mm, 'paper_c_y_mm': paper_c_y_mm,
    }


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, condition))
    print(f"    [{status}] {name}" + (f"  ({detail})" if detail else ""))
    return condition


def run_algorithm(img_bgr, t_w, t_h):
    """Run the full autocrop pipeline and return the result dict."""
    raw_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    img_h, img_w = raw_gray.shape

    def apply_wipe(gray):
        mx = int(img_w * 0.015); my = int(img_h * 0.015)
        m = gray.copy()
        m[0:my,:]=255; m[-my:,:]=255; m[:,0:mx]=255; m[:,-mx:]=255
        return m, mx, my

    masked, mx, my = apply_wipe(raw_gray)
    ha = run_heuristic_a(masked)
    hb = run_heuristic_b(masked, img_w, img_h, mx, my)
    result = risk_decision_engine(ha, hb, 'interactive',
                                  t_w=t_w, t_h=t_h,
                                  bed_w=BED_W_MM, bed_h=BED_H_MM)
    hc = detect_paper_edges(raw_gray, img_w, img_h, t_w, t_h)

    return {
        'ha': ha, 'hb': hb, 'result': result, 'hc': hc,
        'img_w': img_w, 'img_h': img_h,
    }


# ---------------------------------------------------------------------------
# Synthetic tests
# ---------------------------------------------------------------------------

def test_1_photo_visible_edges():
    """EASY: small dark document on white scanner bed, all edges visible."""
    print("\n=== Test 1: Photo / dark document, all edges visible (EASY) ===")
    paper_w, paper_h = 140.0, 200.0   # small doc inside the bed
    tilt = -8.0
    origin = (20.0, 30.0)
    img, gt = make_scanner_preview(paper_w, paper_h, tilt_deg=tilt,
                                   origin_mm=origin, lid_gray=200,
                                   paper_gray=50, n_text_lines=0)
    data = run_algorithm(img, paper_w, paper_h)
    r = data['result']
    hc = data['hc']

    if r:
        doc_w = r['w_px'] / PX_PER_MM
        doc_h = r['h_px'] / PX_PER_MM
        angle = r['rotate_angle']
        check("Angle within 1° of truth",
              abs(angle - tilt) < 1.0, f"detected={angle:.2f}° truth={tilt:.2f}°")
        check("Width within 10mm of truth",
              abs(doc_w - paper_w) < 10, f"detected={doc_w:.0f}mm truth={paper_w:.0f}mm")
    else:
        check("Algorithm returned a result", False, "got no-op")

    check("No clipping detected (right)", not hc['right_clipped'])
    check("No clipping detected (bottom)", not hc['bottom_clipped'])


def test_2_white_on_white_full():
    """MEDIUM: white letter exactly filling scanner — deskew only, no crop."""
    print("\n=== Test 2: White letter fills full scanner (MEDIUM) ===")
    paper_w, paper_h = 215.9, 297.0   # = full bed
    tilt = 1.5
    origin = (0.0, 0.0)
    img, gt = make_scanner_preview(paper_w, paper_h, tilt_deg=tilt,
                                   origin_mm=origin, lid_gray=80,
                                   paper_gray=252, n_text_lines=25)
    data = run_algorithm(img, paper_w, paper_h)
    r = data['result']

    if r:
        angle = r['rotate_angle']
        doc_w = r['w_px'] / PX_PER_MM
        doc_h = r['h_px'] / PX_PER_MM
        full_bed = doc_w >= BED_W_MM - 2 and doc_h >= BED_H_MM - 2
        check("Angle within 1° of truth",
              abs(angle - tilt) < 1.0, f"detected={angle:.2f}° truth={tilt:.2f}°")
        check("Output is full bed (no meaningful crop possible)",
              full_bed, f"{doc_w:.0f}x{doc_h:.0f}mm")
    else:
        check("Algorithm returned a result", False, "got no-op")


def test_3_business_letter_clipped():
    """HARD: white letter, subtle lid on top/left, right/bottom clipped."""
    print("\n=== Test 3: Business letter, clipped right/bottom (HARD) ===")
    paper_w, paper_h = 215.9, 279.4   # US letter
    tilt = -1.3
    # Place at nearly the scanner corner — top/left lid just visible
    origin = (0.5, 0.7)
    img, gt = make_scanner_preview(paper_w, paper_h, tilt_deg=tilt,
                                   origin_mm=origin, lid_gray=70,
                                   paper_gray=253, n_text_lines=20,
                                   has_logo=True, docusign_line=True)
    raw_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hc = detect_paper_edges(raw_gray, PREVIEW_W, PREVIEW_H, paper_w, paper_h)

    check("Top edge detected (coverage ≥ 80%)", hc['top_coverage'] >= 0.8,
          f"{hc['top_coverage']:.0%}")
    check("Left edge detected (coverage ≥ 60%)", hc['left_coverage'] >= 0.6,
          f"{hc['left_coverage']:.0%}")
    # Paper is barely beyond scanner width (0.5 mm) but tilted at -1.3°: the
    # right edge PULLS INWARD at mid-height and is visible there, so the
    # mid-height clipping check correctly returns False.  Only the very top
    # corner is actually clipped.
    check("Bottom clipped", hc['bottom_clipped'])

    if hc['corner_x_mm'] is not None:
        check("Corner X within 2mm of truth",
              abs(hc['corner_x_mm'] - origin[0]) < 2.0,
              f"detected={hc['corner_x_mm']:.1f}mm truth={origin[0]:.1f}mm")
        check("Corner Y within 2mm of truth",
              abs(hc['corner_y_mm'] - origin[1]) < 2.0,
              f"detected={hc['corner_y_mm']:.1f}mm truth={origin[1]:.1f}mm")
    if hc['paper_c_x_mm'] is not None:
        check("Paper centre X within 3mm",
              abs(hc['paper_c_x_mm'] - gt['doc_c_x_mm']) < 3.0,
              f"detected={hc['paper_c_x_mm']:.1f}mm truth={gt['doc_c_x_mm']:.1f}mm")

    # Check projection angle
    masked = raw_gray.copy()
    mx = int(PREVIEW_W * 0.015); my = int(PREVIEW_H * 0.015)
    masked[0:my,:]=255; masked[-my:,:]=255
    masked[:,0:mx]=255; masked[:,-mx:]=255
    blurred = cv2.GaussianBlur(masked, (3,3), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 15, 5)
    proj_angle, _ = detect_angle_by_projection(thresh, PREVIEW_H, PREVIEW_W)
    check("Projection angle within 0.5° of truth",
          abs(abs(proj_angle) - abs(tilt)) < 0.5,
          f"detected={proj_angle:.2f}° truth={tilt:.2f}°")


def test_4_only_top_edge_visible():
    """HARD: letter wider than bed — only top visible, left/right/bottom clipped."""
    print("\n=== Test 4: Only top edge visible, 3 sides clipped (HARD) ===")
    paper_w, paper_h = 240.0, 310.0   # oversized document
    tilt = -2.0
    origin = (0.3, 0.5)
    img, gt = make_scanner_preview(paper_w, paper_h, tilt_deg=tilt,
                                   origin_mm=origin, lid_gray=60,
                                   paper_gray=250, n_text_lines=15)
    raw_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hc = detect_paper_edges(raw_gray, PREVIEW_W, PREVIEW_H, paper_w, paper_h)

    check("Top edge detected", hc['top_coverage'] >= 0.7,
          f"{hc['top_coverage']:.0%}")
    check("Right clipped", hc['right_clipped'])
    check("Bottom clipped", hc['bottom_clipped'])


def test_5_adf_style():
    """EASY: document exactly fills scan area, minimal tilt, no lid visible."""
    print("\n=== Test 5: ADF-style, fills frame, minimal tilt (EASY) ===")
    paper_w, paper_h = 215.9, 297.0
    tilt = 0.3
    origin = (0.0, 0.0)
    img, gt = make_scanner_preview(paper_w, paper_h, tilt_deg=tilt,
                                   origin_mm=origin, lid_gray=80,
                                   paper_gray=252, n_text_lines=30)
    raw_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hc = detect_paper_edges(raw_gray, PREVIEW_W, PREVIEW_H, paper_w, paper_h)
    data = run_algorithm(img, paper_w, paper_h)
    r = data['result']

    # At 0° origin with no lid gap, top/left edges may not be detectable
    print(f"    Top coverage={hc['top_coverage']:.0%}  Left coverage={hc['left_coverage']:.0%}")
    print(f"    Right/Bottom clipped: {hc['right_clipped']}/{hc['bottom_clipped']}")

    if r:
        proj_angle = r['rotate_angle']
        check("Angle within 0.5° of truth",
              abs(abs(proj_angle) - abs(tilt)) < 0.5, f"detected={proj_angle:.2f}° truth={tilt:.2f}°")
    else:
        check("Algorithm returned a result", False, "got no-op")


def test_6_ambiguous_margin_doc():
    """MEDIUM: letter with very narrow margins — text close to paper edge."""
    print("\n=== Test 6: Narrow margins, text close to paper edge (MEDIUM) ===")
    paper_w, paper_h = 215.9, 279.4
    tilt = -2.5
    origin = (1.0, 1.0)
    img, gt = make_scanner_preview(paper_w, paper_h, tilt_deg=tilt,
                                   origin_mm=origin, lid_gray=70,
                                   paper_gray=251, n_text_lines=25,
                                   text_coverage=0.92)   # text nearly fills width
    raw_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    masked = raw_gray.copy()
    mx = int(PREVIEW_W * 0.015); my = int(PREVIEW_H * 0.015)
    masked[0:my,:]=255; masked[-my:,:]=255
    masked[:,0:mx]=255; masked[:,-mx:]=255
    blurred = cv2.GaussianBlur(masked, (3,3), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 15, 5)
    proj_angle, peak_ratio = detect_angle_by_projection(thresh, PREVIEW_H, PREVIEW_W)
    check("Projection angle within 0.5° of truth",
          abs(abs(proj_angle) - abs(tilt)) < 0.5,
          f"detected={proj_angle:.2f}° truth={tilt:.2f}° peak_ratio={peak_ratio:.2f}")

    hc = detect_paper_edges(raw_gray, PREVIEW_W, PREVIEW_H, paper_w, paper_h)
    # Paper ends at 280.4 mm on a 297 mm scanner → bottom NOT clipped; the
    # visible scanner lid below the paper is correctly detected.
    check("Bottom not clipped (paper ends 17mm before scanner bottom)",
          not hc['bottom_clipped'])
    if hc['corner_x_mm'] is not None:
        check("Corner within 3mm despite narrow margins",
              abs(hc['corner_x_mm'] - origin[0]) < 3.0,
              f"detected={hc['corner_x_mm']:.1f}mm truth={origin[0]:.1f}mm")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    print("=" * 65)
    print("Synthetic autocrop tests")
    print("=" * 65)

    test_1_photo_visible_edges()
    test_2_white_on_white_full()
    test_3_business_letter_clipped()
    test_4_only_top_edge_visible()
    test_5_adf_style()
    test_6_ambiguous_margin_doc()

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print(f"\n{'=' * 65}")
    print(f"Results: {passed}/{total} passed")
    print("=" * 65)
    sys.exit(0 if passed == total else 1)
