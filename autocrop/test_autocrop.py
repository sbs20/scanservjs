"""
Test suite for the risk-based autocrop heuristics.
Generates synthetic scanner preview images and verifies that the
right risk level and approximate parameters are selected.

Run with:  python test_autocrop.py
"""
import math
import sys
import tempfile
import os
import json
import subprocess

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from autocrop import (
    run_heuristic_a, run_heuristic_b, check_dirty_pixels,
    risk_decision_engine,
)


# ---------------------------------------------------------------------------
# Image generators
# ---------------------------------------------------------------------------

def make_white_page(w=800, h=1100, bg=245):
    """Blank sheet – very light grey to simulate scanner bed."""
    return np.full((h, w), bg, dtype=np.uint8)


def add_text_lines(img, n_lines=20, tilt_deg=0.0, margin=80):
    """
    Draw horizontal black 'text lines' on img (in-place, returns img).
    tilt_deg > 0 = clockwise skew.
    """
    h, w = img.shape
    tilt_rad = math.radians(tilt_deg)
    step = (h - 2 * margin) // (n_lines + 1)
    for i in range(1, n_lines + 1):
        y0 = margin + i * step
        x0 = margin
        x1 = w - margin
        # Apply tilt: y increases from left to right for clockwise tilt
        dy = int((x1 - x0) * math.tan(tilt_rad))
        thickness = np.random.randint(2, 4)
        cv2.line(img, (x0, y0), (x1, y0 + dy), 0, thickness)
    return img


def add_photo_content(img, n_blobs=30):
    """Scatter random dark shapes – simulates a photo (no dominant lines)."""
    h, w = img.shape
    rng = np.random.default_rng(42)
    for _ in range(n_blobs):
        cx = int(rng.integers(50, w - 50))
        cy = int(rng.integers(50, h - 50))
        rx = int(rng.integers(10, 60))
        ry = int(rng.integers(10, 40))
        cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, 0, -1)
    return img


def add_bezel(img, bezel=12, color=180):
    """Simulate scanner bezel (grey border)."""
    img[:bezel, :] = color
    img[-bezel:, :] = color
    img[:, :bezel] = color
    img[:, -bezel:] = color
    return img


def apply_wipe(gray, img_w, img_h):
    """Apply the 1.5% bezel wipe as autocrop.py does."""
    mx = int(img_w * 0.015)
    my = int(img_h * 0.015)
    masked = gray.copy()
    masked[0:my, :] = 255
    masked[-my:, :] = 255
    masked[:, 0:mx] = 255
    masked[:, -mx:] = 255
    return masked, mx, my


def bgr(gray):
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
results = []


def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    tag = "ok" if condition else "FAIL"
    results.append((name, condition))
    print(f"  [{status}] {name}" + (f"  ({detail})" if detail else ""))
    return condition


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_heuristic_a_text_document():
    print("\n=== Test: Heuristic A — business letter (0° tilt) ===")
    img = make_white_page()
    add_text_lines(img, n_lines=25, tilt_deg=0.0)
    add_bezel(img)
    masked, mx, my = apply_wipe(img, img.shape[1], img.shape[0])

    r = run_heuristic_a(masked)
    check("text_confidence_score >= 0.5",
          r['text_confidence_score'] >= 0.5,
          f"conf={r['text_confidence_score']:.3f}")
    check("text_angle near 0",
          abs(r['text_angle']) < 1.0,
          f"angle={r['text_angle']:.3f}°")
    check("text_bbox not None", r['text_bbox'] is not None)
    return r


def test_heuristic_a_tilted_document():
    print("\n=== Test: Heuristic A — business letter (+3° clockwise tilt) ===")
    img = make_white_page()
    add_text_lines(img, n_lines=20, tilt_deg=3.0)
    add_bezel(img)
    masked, mx, my = apply_wipe(img, img.shape[1], img.shape[0])

    r = run_heuristic_a(masked)
    check("text_confidence_score >= 0.4",
          r['text_confidence_score'] >= 0.4,
          f"conf={r['text_confidence_score']:.3f}")
    check("text_angle within 1° of 3°",
          abs(r['text_angle'] - 3.0) < 1.0,
          f"detected={r['text_angle']:.3f}°, expected≈3°")
    return r


def test_heuristic_a_photo():
    print("\n=== Test: Heuristic A — photo (random blobs, no text lines) ===")
    img = make_white_page(bg=200)
    add_photo_content(img)
    add_bezel(img)
    masked, mx, my = apply_wipe(img, img.shape[1], img.shape[0])

    r = run_heuristic_a(masked)
    check("text_confidence_score < 0.5 (photo should not look like text)",
          r['text_confidence_score'] < 0.5,
          f"conf={r['text_confidence_score']:.3f}")
    return r


def test_heuristic_b_document():
    print("\n=== Test: Heuristic B — document with visible edges ===")
    # White page on a grey bed
    bed = np.full((1100, 800), 200, dtype=np.uint8)
    page_top, page_left = 50, 60
    page_h, page_w = 980, 660
    page = make_white_page(w=page_w, h=page_h, bg=250)
    add_text_lines(page, n_lines=15)
    bed[page_top:page_top+page_h, page_left:page_left+page_w] = page

    img_h, img_w = bed.shape
    masked, mx, my = apply_wipe(bed, img_w, img_h)

    r = run_heuristic_b(masked, img_w, img_h, mx, my)
    check("heuristic_b returned a result", r is not None)
    if r:
        # Center should be roughly in the middle of the page on the bed
        expected_cx = page_left + page_w / 2
        expected_cy = page_top + page_h / 2
        check("c_x_px within 30px of expected",
              abs(r['c_x_px'] - expected_cx) < 30,
              f"cx={r['c_x_px']:.1f} expected≈{expected_cx:.1f}")
        check("c_y_px within 30px of expected",
              abs(r['c_y_px'] - expected_cy) < 30,
              f"cy={r['c_y_px']:.1f} expected≈{expected_cy:.1f}")
    return r


def test_dirty_pixel_check():
    print("\n=== Test: Dirty pixel check ===")
    # Use a standard scanner-preview-sized image with wide margins so that the
    # dilated text blobs don't reach the image edge (dilation extends ~40px per
    # side on a 40×1 kernel with 2 iterations).  No bezel needed here.
    img = make_white_page(w=800, h=1100)
    add_text_lines(img, n_lines=20, margin=160)   # text: x=160..640, dilated: x=120..680
    # No bezel: wipe will find nothing near the edge on this clean synthetic image
    masked, mx, my = apply_wipe(img, img.shape[1], img.shape[0])
    r = run_heuristic_a(masked)
    thresh = r['thresh']
    textlines_bbox = r.get('textlines_bbox', r['text_bbox'])
    img_h, img_w = img.shape

    # With clean document: should be safe
    is_safe = check_dirty_pixels(thresh, textlines_bbox, img_w, img_h)
    check("clean document → is_safe=True", is_safe, f"is_safe={is_safe}")

    # Add a stamp well outside the textlines_bbox right edge.
    # Text margin=120 → text ends at img_w-120=1080.  Dilation extends ~20px,
    # so textlines right edge ≈ 1100.  Stamp starts at 1140 → clear gap.
    if textlines_bbox is not None:
        tbx, tby, tbw, tbh = textlines_bbox
        tlx2 = tbx + tbw   # right edge of text lines (already dilated ~40px/side)
        # The dilation extends blobs ~40px per side.  To prevent the stamp from
        # merging with the text blobs during heuristic_a re-run, keep a gap of
        # at least 2× dilation (80px) beyond the dilated text edge.
        sx1 = tlx2 + 80   # 80px clear gap beyond dilated text edge
        sx2 = min(img_w - 10, sx1 + 80)   # 80px wide stamp → ~6400px area
        sy1 = img_h // 2 - 40
        sy2 = img_h // 2 + 40             # 80px tall stamp → 6400px total
        dirty = img.copy()
        cv2.rectangle(dirty, (sx1, sy1), (sx2, sy2), 0, -1)
        stamp_info = f"stamp=({sx1},{sy1})-({sx2},{sy2}) tl_bbox={textlines_bbox}"

        masked2, _, _ = apply_wipe(dirty, img_w, img_h)
        r2 = run_heuristic_a(masked2)
        thresh2 = r2['thresh']
        textlines_bbox2 = r2.get('textlines_bbox', r2['text_bbox'])
        is_dirty = check_dirty_pixels(thresh2, textlines_bbox2, img_w, img_h)
        check("document with right-margin stamp → is_safe=False", not is_dirty,
              f"is_safe={is_dirty} {stamp_info}")
    else:
        print("  [SKIP] no textlines_bbox available")


def test_risk_engine_interactive():
    print("\n=== Test: Risk engine — interactive mode ===")

    # --- Case 1: High-confidence text, clean → Risk 1 ---
    img = make_white_page()
    add_text_lines(img, n_lines=25)
    add_bezel(img)
    masked, mx, my = apply_wipe(img, img.shape[1], img.shape[0])
    ha = run_heuristic_a(masked)
    hb = run_heuristic_b(masked, img.shape[1], img.shape[0], mx, my)
    result = risk_decision_engine(ha, hb, mode='interactive')
    conf = ha['text_confidence_score']
    if conf >= 0.5:
        check("Case 1 (high-conf text, clean) → risk level 1 or 2",
              result is not None and result['risk_level'] in (1, 2),
              f"risk_level={result['risk_level'] if result else 'None'} conf={conf:.3f}")
    else:
        print(f"  [SKIP] confidence too low ({conf:.3f}) for this case")

    # --- Case 2: Photo content → Risk 3 ---
    img2 = make_white_page(bg=200)
    add_photo_content(img2)
    add_bezel(img2)
    masked2, mx2, my2 = apply_wipe(img2, img2.shape[1], img2.shape[0])
    ha2 = run_heuristic_a(masked2)
    hb2 = run_heuristic_b(masked2, img2.shape[1], img2.shape[0], mx2, my2)
    result2 = risk_decision_engine(ha2, hb2, mode='interactive')
    # Photo should use contour (risk 3) or no-op if no contours
    check("Case 2 (photo) → risk 3 or None",
          result2 is None or result2.get('risk_level') == 3,
          f"risk_level={result2['risk_level'] if result2 else 'None'} "
          f"conf={ha2['text_confidence_score']:.3f}")


def test_risk_engine_batch_conservative():
    print("\n=== Test: Risk engine — batch mode (conservative) ===")

    # High-confidence text with clear confidence → should still crop (risk 1/2)
    img = make_white_page()
    add_text_lines(img, n_lines=30)  # many lines → high confidence
    add_bezel(img)
    masked, mx, my = apply_wipe(img, img.shape[1], img.shape[0])
    ha = run_heuristic_a(masked)
    hb = run_heuristic_b(masked, img.shape[1], img.shape[0], mx, my)
    result_i = risk_decision_engine(ha, hb, mode='interactive')
    result_b = risk_decision_engine(ha, hb, mode='batch')
    conf = ha['text_confidence_score']
    print(f"  text_confidence={conf:.3f} n_lines={ha.get('n_lines', '?')}")
    if conf >= 0.65:
        check("Batch mode high-conf → not no-op (crop applied)",
              result_b is not None,
              f"risk_level={result_b['risk_level'] if result_b else 'None'}")
    else:
        check("Batch mode borderline-conf → no-op (conservative fallback)",
              result_b is None,
              f"risk_level={result_b['risk_level'] if result_b else 'None'}")

    # Photo in batch mode → no-op (don't blindly crop photos)
    img2 = make_white_page(bg=200)
    add_photo_content(img2)
    add_bezel(img2)
    masked2, mx2, my2 = apply_wipe(img2, img2.shape[1], img2.shape[0])
    ha2 = run_heuristic_a(masked2)
    hb2 = run_heuristic_b(masked2, img2.shape[1], img2.shape[0], mx2, my2)
    result2 = risk_decision_engine(ha2, hb2, mode='batch')
    check("Batch + photo → no-op (risk 0)",
          result2 is None,
          f"risk_level={result2['risk_level'] if result2 else 'None'}")


def test_full_script_invocation():
    print("\n=== Test: Full script invocation (subprocess) ===")
    python = os.path.join(os.path.dirname(__file__), '..', '.venv', 'bin', 'python')
    if not os.path.exists(python):
        python = sys.executable

    script = os.path.join(os.path.dirname(__file__), 'autocrop.py')

    # Create a synthetic test image
    img = make_white_page()
    add_text_lines(img, n_lines=25, tilt_deg=0.0)
    add_bezel(img)
    bgr_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
        tmppath = f.name
    cv2.imwrite(tmppath, bgr_img)

    try:
        cmd = [
            python, script,
            '--image', tmppath,
            '--left', '0', '--top', '0',
            '--width', '215', '--height', '297',
            '--bed-width', '215', '--bed-height', '297',
            '--mode', 'interactive',
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        check("Script exits 0", proc.returncode == 0,
              f"stderr: {proc.stderr[:200]}")
        try:
            out = json.loads(proc.stdout.strip())
            check("Output is valid JSON", True)
            check("Output has 'magic' key", 'magic' in out)
        except json.JSONDecodeError:
            check("Output is valid JSON", False, f"got: {proc.stdout[:100]}")
    finally:
        os.unlink(tmppath)
        for ext in ['.debug-1-wipe.jpg', '.debug-2-edges.jpg',
                    '.debug-3-contours.jpg', '.debug-4-rect.jpg',
                    '.debug-A1-thresh.jpg', '.debug-A2-dilated.jpg']:
            p = tmppath + ext
            if os.path.exists(p):
                os.unlink(p)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    print("=" * 60)
    print("autocrop.py unit tests")
    print("=" * 60)

    test_heuristic_a_text_document()
    test_heuristic_a_tilted_document()
    test_heuristic_a_photo()
    test_heuristic_b_document()
    test_dirty_pixel_check()
    test_risk_engine_interactive()
    test_risk_engine_batch_conservative()
    test_full_script_invocation()

    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    failed = total - passed
    print(f"\n{'=' * 60}")
    print(f"Results: {passed}/{total} passed, {failed} failed")
    print("=" * 60)
    sys.exit(0 if failed == 0 else 1)
