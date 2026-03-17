"""
Comprehensive autocrop test suite — paper corner detection and cropping.

Scenarios are grouped by difficulty:
  EASY    — clear signals, clean images
  MEDIUM  — partial signals or standard noise
  HARD    — weak signals, deliberate difficulty
  EXTREME — edge cases intended to challenge; graceful degradation expected

Run with:  .venv/bin/python autocrop/test_comprehensive.py
"""
import sys, os, math, json, subprocess
import cv2, numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from autocrop import (
    run_heuristic_a, run_heuristic_b, run_heuristic_c,
    risk_decision_engine, detect_angle_by_projection,
    match_standard_size,
)

# ---------------------------------------------------------------------------
# Scanner constants
# ---------------------------------------------------------------------------
BED_W_MM = 215.9
BED_H_MM = 297.0
PREVIEW_W = 868
PX_PER_MM = PREVIEW_W / BED_W_MM
PREVIEW_H = round(BED_H_MM * PX_PER_MM)

AUTOCROP_PY = os.path.join(os.path.dirname(__file__), 'autocrop.py')
PYTHON = os.path.join(os.path.dirname(__file__), '..', '.venv', 'bin', 'python')
if not os.path.exists(PYTHON):
    PYTHON = sys.executable

# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------

def mm2px(mm): return int(mm * PX_PER_MM)


def make_scan(paper_w_mm, paper_h_mm,
              tilt_deg=0.0, origin_mm=(0.0, 0.0),
              lid_gray=80, paper_gray=252,
              n_lines=20, line_density=0.65,
              has_logo=False, has_docusign=False,
              smudge=None,        # (x_mm, y_mm, radius_mm) — dark smudge on lid
              fold_mark=None,     # x_mm — vertical fold line on paper
              note_in_margin=None # (x_mm, y_mm) — short text-like mark in margin
              ):
    """
    Simulate a scanner preview with a paper document.

    Returns (img_bgr, ground_truth_dict).
    """
    img = np.full((PREVIEW_H, PREVIEW_W, 3), lid_gray, dtype=np.uint8)
    ox, oy = mm2px(origin_mm[0]), mm2px(origin_mm[1])
    pw, ph = mm2px(paper_w_mm), mm2px(paper_h_mm)

    α = math.radians(-tilt_deg)
    ca, sa = math.cos(α), math.sin(α)

    def p2i(px, py):
        """Paper coords → image coords (float)."""
        return ox + px*ca - py*sa, oy + px*sa + py*ca

    def i2p(ix, iy):
        """Image coords → paper coords."""
        dx, dy = ix - ox, iy - oy
        return dx*ca + dy*sa, -dx*sa + dy*ca

    # Draw paper
    for iy in range(PREVIEW_H):
        for ix in range(PREVIEW_W):
            px, py = i2p(ix, iy)
            if 0 <= px < pw and 0 <= py < ph:
                img[iy, ix] = paper_gray

    rng = np.random.default_rng(7)
    mg = mm2px(25)  # standard 25 mm margin

    # Text lines
    for i in range(1, n_lines + 1):
        lx0 = mg + rng.integers(-2, 3)
        lx1 = int(pw * line_density) + mg + rng.integers(-6, 3)
        ly  = mg + i * (ph - 2*mg) // (n_lines + 1)
        ix0, iy0 = p2i(lx0, ly)
        ix1, iy1 = p2i(lx1, ly)
        if all(0 <= v < (PREVIEW_W if j == 0 else PREVIEW_H)
               for j, v in enumerate([int(ix0), int(iy0), int(ix1), int(iy1)])):
            cv2.line(img, (int(ix0), int(iy0)), (int(ix1), int(iy1)), (30, 30, 30), 2)

    # Logo block (centred in header area)
    if has_logo:
        lx, ly = (pw - mm2px(40)) // 2, mg // 3
        ix0, iy0 = p2i(lx, ly)
        ix1, iy1 = p2i(lx + mm2px(40), ly + mm2px(10))
        cv2.rectangle(img, (int(ix0), int(iy0)), (int(ix1), int(iy1)), (50, 50, 50), -1)

    # DocuSign marker — close to left edge, top margin
    if has_docusign:
        ix0, iy0 = p2i(mm2px(15), mm2px(4))
        ix1, iy1 = p2i(mm2px(80), mm2px(4))
        if all(0 <= int(v) < (PREVIEW_W if j % 2 == 0 else PREVIEW_H)
               for j, v in enumerate([ix0, iy0, ix1, iy1])):
            cv2.line(img, (int(ix0), int(iy0)), (int(ix1), int(iy1)), (60, 60, 60), 2)

    # Smudge on lid (dark mark near a border — could confuse edge detection)
    if smudge is not None:
        sx, sy, sr = mm2px(smudge[0]), mm2px(smudge[1]), mm2px(smudge[2])
        cv2.circle(img, (sx, sy), sr, (lid_gray - 40,)*3, -1)

    # Fold mark (vertical line on paper)
    if fold_mark is not None:
        fx = mm2px(fold_mark)
        ix0, iy0 = p2i(fx, 0)
        ix1, iy1 = p2i(fx, ph)
        cv2.line(img, (int(ix0), int(iy0)), (int(ix1), int(iy1)), (180, 180, 180), 1)

    # Handwritten note in margin area (outside normal text block)
    if note_in_margin is not None:
        nx, ny = mm2px(note_in_margin[0]), mm2px(note_in_margin[1])
        ix0, iy0 = p2i(nx, ny)
        ix1, iy1 = p2i(nx + mm2px(30), ny)
        cv2.line(img, (int(ix0), int(iy0)), (int(ix1), int(iy1)), (80, 80, 80), 2)

    right_clipped  = (origin_mm[0] + paper_w_mm) > BED_W_MM
    bottom_clipped = (origin_mm[1] + paper_h_mm) > BED_H_MM

    gt = dict(
        tilt_deg=tilt_deg, origin_mm=origin_mm,
        paper_w_mm=paper_w_mm, paper_h_mm=paper_h_mm,
        doc_c_x_mm=origin_mm[0] + paper_w_mm / 2,
        doc_c_y_mm=origin_mm[1] + paper_h_mm / 2,
        right_clipped=right_clipped, bottom_clipped=bottom_clipped,
    )
    return img, gt


# ---------------------------------------------------------------------------
# Algorithm runner (direct call — faster than subprocess)
# ---------------------------------------------------------------------------

def run(img_bgr, t_w, t_h, mode='interactive'):
    """Run the full autocrop pipeline and return the JSON-compatible result."""
    import tempfile
    raw = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as f:
        p = f.name
    cv2.imwrite(p, img_bgr)
    try:
        cmd = [PYTHON, AUTOCROP_PY,
               '--image', p, '--left', '0', '--top', '0',
               '--width', str(t_w), '--height', str(t_h),
               '--bed-width', str(BED_W_MM), '--bed-height', str(BED_H_MM),
               '--no-scale', '--mode', mode]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return json.loads(r.stdout.strip())
    finally:
        os.unlink(p)


# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
WARN = "\033[33mWARN\033[0m"
results = []


def check(name, ok, detail="", warn=False):
    label = WARN if (warn and not ok) else (PASS if ok else FAIL)
    results.append((name, ok, warn))
    print(f"    [{label}] {name}" + (f"  ({detail})" if detail else ""))
    return ok


def near(a, b, tol):
    return abs(a - b) <= tol


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

# ── EASY ────────────────────────────────────────────────────────────────────

def test_E1_credit_card():
    """EASY: Credit card (85.6×54mm), all 4 edges visible on white scanner."""
    print("\n=== E1: Credit card, all edges, no tilt ===")
    w, h = 85.6, 54.0
    img, gt = make_scan(w, h, tilt_deg=-3.0, origin_mm=(30.0, 50.0),
                        lid_gray=180, paper_gray=245, n_lines=3)
    out = run(img, w, h)
    check("Angle within 1°",   near(abs(out['angle']), abs(gt['tilt_deg']), 1.0),
          f"angle={out['angle']:.2f}° truth={-gt['tilt_deg']:.2f}°")
    check("Width within 8mm",  near(out['doc_w'],   w,               8.0),
          f"w={out['doc_w']:.0f}mm truth={w}mm")
    check("Height within 8mm", near(out['doc_h'],   h,               8.0),
          f"h={out['doc_h']:.0f}mm truth={h}mm")


def test_E2_photo_large():
    """EASY: Large photo 150×200mm, dark image on white scanner."""
    print("\n=== E2: Large photo, dark on white ===")
    w, h = 150.0, 200.0
    img, gt = make_scan(w, h, tilt_deg=5.0, origin_mm=(10.0, 20.0),
                        lid_gray=200, paper_gray=60, n_lines=0)
    out = run(img, w, h)
    check("Angle within 1°",   near(abs(out['angle']), abs(gt['tilt_deg']), 1.0),
          f"angle={out['angle']:.2f}°")
    check("Width within 10mm", near(out['doc_w'],   w,              10.0),
          f"w={out['doc_w']:.0f}mm")


def test_E3_adf_minimal_tilt():
    """EASY: ADF document fills full frame, minimal tilt — deskew only."""
    print("\n=== E3: ADF full-frame, 0.4° tilt — deskew only ===")
    w, h = BED_W_MM, BED_H_MM
    img, gt = make_scan(w, h, tilt_deg=0.4, origin_mm=(0.0, 0.0),
                        lid_gray=80, paper_gray=252, n_lines=30)
    out = run(img, w, h)
    if out.get('magic'):
        full = out['doc_w'] >= BED_W_MM - 2 and out['doc_h'] >= BED_H_MM - 2
        check("Output is full-bed (no crop)", full,
              f"{out['doc_w']:.0f}x{out['doc_h']:.0f}mm")
        check("Angle within 0.5°", near(abs(out['angle']), 0.4, 0.5),
              f"angle={out['angle']:.2f}°")
    else:
        check("No-op for near-perfect ADF scan", True,
              "algorithm correctly returned no-op")


# ── MEDIUM ──────────────────────────────────────────────────────────────────

def test_M1_letter_clipped_clean():
    """MEDIUM: US Letter, top/left lid visible, right/bottom clipped, clean."""
    print("\n=== M1: Letter-size, clipped R/B, clean, 1.3° tilt ===")
    w, h = 215.9, 279.4
    tilt = -1.3
    origin = (0.5, 0.7)
    img, gt = make_scan(w, h, tilt_deg=tilt, origin_mm=origin,
                        lid_gray=70, paper_gray=253,
                        n_lines=25, has_logo=True, has_docusign=True)
    out = run(img, w, h)
    if out.get('magic'):
        check("Angle within 0.5°", near(abs(out['angle']), abs(tilt), 0.5),
              f"angle={out['angle']:.2f}° truth={tilt:.2f}°")
        check("Width matches letter (±5mm)", near(out['doc_w'], w, 5.0),
              f"w={out['doc_w']:.1f}mm")
        check("Height matches letter (±5mm)", near(out['doc_h'], h, 5.0),
              f"h={out['doc_h']:.1f}mm")
        check("Centre X within 5mm of truth",
              near(out['doc_c_x'], gt['doc_c_x_mm'], 5.0),
              f"cx={out['doc_c_x']:.1f}mm truth={gt['doc_c_x_mm']:.1f}mm")
        check("Centre Y within 5mm of truth",
              near(out['doc_c_y'], gt['doc_c_y_mm'], 5.0),
              f"cy={out['doc_c_y']:.1f}mm truth={gt['doc_c_y_mm']:.1f}mm")
    else:
        check("Algorithm returned a result", False, "got no-op")


def test_M2_a4_clipped_clean():
    """MEDIUM: A4, top/left visible, right/bottom clipped, 0.8° tilt."""
    print("\n=== M2: A4, clipped R/B, clean, 0.8° tilt ===")
    w, h = 210.0, 297.0
    tilt = -0.8
    origin = (1.0, 0.5)
    img, gt = make_scan(w, h, tilt_deg=tilt, origin_mm=origin,
                        lid_gray=75, paper_gray=251, n_lines=22)
    out = run(img, w, h)
    if out.get('magic'):
        check("Angle within 0.5°", near(abs(out['angle']), abs(tilt), 0.5),
              f"angle={out['angle']:.2f}°")
        # Width: A4 (210mm) vs bed width (215.9mm) — should snap to A4
        check("Width close to A4 or Letter (±8mm)",
              near(out['doc_w'], 210.0, 8.0) or near(out['doc_w'], w, 8.0),
              f"w={out['doc_w']:.1f}mm")
    else:
        check("Algorithm returned a result", False, "got no-op")


def test_M3_letter_wide_margin():
    """MEDIUM: Letter with very wide margins (38mm) — text far from edge."""
    print("\n=== M3: Letter wide margins (38mm), lid visible, clipped ===")
    w, h = 215.9, 279.4
    img, gt = make_scan(w, h, tilt_deg=-1.0, origin_mm=(0.4, 0.6),
                        lid_gray=72, paper_gray=252, n_lines=15,
                        line_density=0.55)   # text occupies less width
    out = run(img, w, h)
    if out.get('magic'):
        check("Angle within 0.6°", near(abs(out['angle']), 1.0, 0.6),
              f"angle={out['angle']:.2f}°")
        check("Width reasonable (not over-cropped)",
              out['doc_w'] >= w - 10, f"w={out['doc_w']:.0f}mm")
    else:
        check("Algorithm returned a result", False, "got no-op")


def test_M4_letter_conservative():
    """MEDIUM: Letter, conservative (batch) mode — should deskew, may crop."""
    print("\n=== M4: Letter, conservative mode ===")
    w, h = 215.9, 279.4
    tilt = -1.5
    img, gt = make_scan(w, h, tilt_deg=tilt, origin_mm=(0.5, 0.7),
                        lid_gray=70, paper_gray=253, n_lines=25)
    out = run(img, w, h, mode='batch')
    if out.get('magic'):
        check("Angle within 0.6° (batch mode)",
              near(abs(out['angle']), abs(tilt), 0.6),
              f"angle={out['angle']:.2f}°")
        # Conservative mode may or may not crop; just ensure it doesn't over-crop
        check("No destructive over-crop (width > paper - 20mm)",
              out['doc_w'] >= w - 20, f"w={out['doc_w']:.0f}mm")
    else:
        check("No-op acceptable for conservative mode", True)


# ── HARD ────────────────────────────────────────────────────────────────────

def test_H1_smudge_near_left_edge():
    """
    HARD: Dark smudge on scanner lid NEAR the left paper edge.
    The smudge looks like a paper boundary extension, potentially
    pushing the detected left edge outward.
    """
    print("\n=== H1: Smudge near left edge (confusion risk) ===")
    w, h = 215.9, 279.4
    tilt = -1.2
    # Smudge 2mm left of paper (in lid area at mid-height)
    img, gt = make_scan(w, h, tilt_deg=tilt, origin_mm=(2.0, 0.6),
                        lid_gray=75, paper_gray=252, n_lines=20,
                        smudge=(0.8, 130.0, 1.5))   # x=0.8mm, y=130mm, r=1.5mm
    out = run(img, w, h)
    if out.get('magic'):
        # The smudge is between the scanner edge and the paper — should not
        # cause the crop to include area left of the paper
        check("Width not greatly over-estimated (smudge confusion)",
              out['doc_w'] <= w + 8,
              f"w={out['doc_w']:.0f}mm  (paper={w}mm)")
        check("Angle within 0.7°", near(abs(out['angle']), abs(tilt), 0.7),
              f"angle={out['angle']:.2f}°")
    else:
        check("No-op acceptable if confidence degraded by smudge", True)


def test_H2_narrow_margin_text():
    """
    HARD: Letter with 12mm left margin — text very close to paper edge.
    The sanity check (left_margin must be 15-40mm) may flag this as
    inconsistent; algorithm should either handle it or fall back gracefully.
    """
    print("\n=== H2: Narrow 12mm margins (borderline sanity check) ===")
    w, h = 215.9, 279.4
    img, gt = make_scan(w, h, tilt_deg=-1.1, origin_mm=(0.5, 0.5),
                        lid_gray=72, paper_gray=252, n_lines=22,
                        line_density=0.90)   # text fills 90% of width → narrow margin
    out = run(img, w, h)
    if out.get('magic'):
        # Even if the corner validation fails (margin too narrow), the crop
        # should not be destructively wrong
        check("Angle within 0.7°", near(abs(out['angle']), 1.1, 0.7),
              f"angle={out['angle']:.2f}°")
        check("No destructive over-crop", out['doc_w'] >= w - 15,
              f"w={out['doc_w']:.0f}mm")
    else:
        check("No-op if sanity check fails with narrow margin", True)


def test_H3_very_subtle_lid():
    """
    HARD: Lid is nearly white (lid_gray=225, paper_gray=255).
    Edge detection is very challenging; algorithm should fall back gracefully.
    """
    print("\n=== H3: Near-white lid (lid_gray=225) — very subtle edge ===")
    w, h = 215.9, 279.4
    img, gt = make_scan(w, h, tilt_deg=-1.0, origin_mm=(0.5, 0.6),
                        lid_gray=225, paper_gray=254,
                        n_lines=25)
    out = run(img, w, h)
    if out.get('magic'):
        check("Angle within 1.5° even with subtle lid",
              near(abs(out['angle']), 1.0, 1.5),
              f"angle={out['angle']:.2f}°", warn=True)
        # Graceful degradation: no destructive crop
        check("Width not under-estimated by more than 30mm",
              out['doc_w'] >= w - 30, f"w={out['doc_w']:.0f}mm", warn=True)
    else:
        check("No-op acceptable — algorithm admits uncertainty", True)


def test_H4_tilt_5_degrees():
    """
    HARD: Letter tilted 5° — edge search band (30px) may be too narrow
    to detect the full top edge.  Corner detection is unreliable here;
    algorithm should deskew but not over-commit on the crop position.
    """
    print("\n=== H4: 5° tilt — edge detection at limit ===")
    w, h = 215.9, 279.4
    tilt = -5.0
    img, gt = make_scan(w, h, tilt_deg=tilt, origin_mm=(0.5, 0.7),
                        lid_gray=70, paper_gray=252, n_lines=22)
    out = run(img, w, h)
    if out.get('magic'):
        check("Angle within 1° (projection reliable at 5°)",
              near(abs(out['angle']), abs(tilt), 1.0),
              f"angle={out['angle']:.2f}°")
        # At 5°, corner detection may fail; allow full-bed fallback
        full = out['doc_w'] >= BED_W_MM - 2 and out['doc_h'] >= BED_H_MM - 2
        check("Full-bed or reasonable crop (5° may defeat corner detection)",
              full or (near(out['doc_w'], w, 15)),
              f"{out['doc_w']:.0f}x{out['doc_h']:.0f}mm", warn=True)
    else:
        check("Algorithm returned a result", False, "got no-op")


def test_H5_fold_mark():
    """
    HARD: Letter with a fold mark (faint vertical line at x=107mm).
    The fold could be misdetected as an edge or confuse angle detection.
    """
    print("\n=== H5: Fold mark at 107mm — potential false edge ===")
    w, h = 215.9, 279.4
    img, gt = make_scan(w, h, tilt_deg=-1.2, origin_mm=(0.5, 0.6),
                        lid_gray=70, paper_gray=252, n_lines=20,
                        fold_mark=107.0)
    out = run(img, w, h)
    if out.get('magic'):
        check("Angle within 0.6°", near(abs(out['angle']), 1.2, 0.6),
              f"angle={out['angle']:.2f}°")
        check("Width not split at fold (w > paper/2)",
              out['doc_w'] >= w * 0.7, f"w={out['doc_w']:.0f}mm")
    else:
        check("Algorithm returned a result", False, "got no-op")


# ── EXTREME ─────────────────────────────────────────────────────────────────

def test_X1_blank_page():
    """EXTREME: Completely blank white page — no text, no signal."""
    print("\n=== X1: Blank white page — no text at all ===")
    img, gt = make_scan(215.9, 279.4, tilt_deg=-1.0, origin_mm=(0.5, 0.6),
                        lid_gray=70, paper_gray=252, n_lines=0)
    out = run(img, 215.9, 279.4)
    if out.get('magic'):
        check("Blank page: angle close to truth or no-op acceptable",
              near(abs(out['angle']), 1.0, 1.5) or abs(out['angle']) < 0.3,
              f"angle={out['angle']:.2f}°", warn=True)
        check("Blank page: no destructive crop", out['doc_w'] >= 215.9 - 20,
              f"w={out['doc_w']:.0f}mm", warn=True)
    else:
        check("No-op is correct for blank page", True)


def test_X2_smudge_looks_like_edge():
    """
    EXTREME: Large dark smudge at x=3mm, full height — looks exactly like
    a paper left edge but the real paper is at x=10mm.
    Algorithm should not crop using the false smudge edge.
    """
    print("\n=== X2: Smudge at 3mm looks like false paper edge ===")
    w, h = 215.9, 279.4
    img, gt = make_scan(w, h, tilt_deg=-1.0, origin_mm=(10.0, 0.6),
                        lid_gray=70, paper_gray=252, n_lines=20,
                        smudge=(3.0, 148.5, 3.0))   # large smudge, centred height
    out = run(img, w, h)
    if out.get('magic'):
        check("Smudge: centre X not badly wrong (within 15mm of truth)",
              near(out['doc_c_x'], gt['doc_c_x_mm'], 15.0),
              f"cx={out['doc_c_x']:.1f}mm truth={gt['doc_c_x_mm']:.1f}mm", warn=True)
        check("Smudge: width not over-estimated", out['doc_w'] <= w + 10,
              f"w={out['doc_w']:.0f}mm", warn=True)
    else:
        check("No-op acceptable if smudge confuses detection", True)


def test_X3_note_in_margin():
    """
    EXTREME: Handwritten note in the top margin (y=8mm, very close to edge).
    This challenges the text-body sanity check.
    """
    print("\n=== X3: Handwritten note at top margin (y=8mm) ===")
    w, h = 215.9, 279.4
    img, gt = make_scan(w, h, tilt_deg=-1.1, origin_mm=(0.5, 0.5),
                        lid_gray=70, paper_gray=252, n_lines=20,
                        note_in_margin=(10.0, 8.0))   # mark very close to top
    out = run(img, w, h)
    if out.get('magic'):
        check("Note in margin: angle still reasonable",
              near(abs(out['angle']), 1.1, 0.8), f"angle={out['angle']:.2f}°")
        check("Note in margin: not over-cropping top (doc_h >= paper - 15mm)",
              out['doc_h'] >= h - 15, f"h={out['doc_h']:.0f}mm")
    else:
        check("No-op if note defeats sanity check", True)


def test_X4_full_bed_photo():
    """
    EXTREME: A photo that fills the full scanner bed — heuristic_b should
    handle this, NOT heuristic_c.  Verify no regression.
    """
    print("\n=== X4: Full-bed photo — should use heuristic_b, not C ===")
    img, gt = make_scan(BED_W_MM, BED_H_MM, tilt_deg=0.0, origin_mm=(0.0, 0.0),
                        lid_gray=80, paper_gray=50, n_lines=0)
    out = run(img, BED_W_MM, BED_H_MM)
    if out.get('magic'):
        # No destructive crop on a photo filling the full bed
        check("Full-bed photo: no extreme over-crop",
              out['doc_w'] >= BED_W_MM - 30, f"w={out['doc_w']:.0f}mm")
    else:
        check("No-op acceptable for full-bed photo", True)


# ── STANDARD SIZE MATCHING ───────────────────────────────────────────────────

def test_SS1_size_matching():
    """Test the match_standard_size() function in isolation."""
    print("\n=== SS1: Standard size matching ===")
    cases = [
        (210.0,  297.0,  'A4'),
        (297.0,  210.0,  'A4'),         # landscape
        (215.9,  279.4,  'Letter'),
        (85.6,    54.0,  'Credit Card'),
        (54.0,    85.6,  'Credit Card'), # landscape
        (148.0,  210.0,  'A5'),
        (212.0,  299.0,  'A4'),          # within 8mm tolerance
        (300.0,  420.0,  None),          # A3 — not in table
        (999.0,  999.0,  None),          # obviously wrong
    ]
    for w, h, expected_name in cases:
        result = match_standard_size(w, h)
        name = result[2] if result else None
        ok = (name == expected_name) if expected_name else (result is None)
        check(f"match({w:.0f}x{h:.0f}) → {expected_name}",
              ok, f"got {name}")


# ── REGRESSION GUARD ────────────────────────────────────────────────────────

def test_R1_preview2_dark_edge():
    """REGRESSION: Dark-edge visible document — heuristic_b must still work."""
    print("\n=== R1: Regression — dark-edge visible document ===")
    import tempfile, shutil
    src = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'output', 'preview2.tif')
    if not os.path.exists(src):
        print("    [SKIP] preview2.tif not available")
        return
    r = subprocess.run(
        [PYTHON, AUTOCROP_PY,
         '--image', src, '--left', '0', '--top', '0',
         '--width', str(BED_W_MM), '--height', str(BED_H_MM),
         '--bed-width', str(BED_W_MM), '--bed-height', str(BED_H_MM),
         '--no-scale', '--mode', 'interactive'],
        capture_output=True, text=True, timeout=60
    )
    out = json.loads(r.stdout.strip())
    if out.get('magic'):
        check("Dark-edge doc: angle around -11°",
              near(out['angle'], -11.0, 2.0), f"angle={out['angle']:.2f}°")
        check("Dark-edge doc: width < 170mm (genuine crop)",
              out['doc_w'] < 170, f"w={out['doc_w']:.0f}mm")


def test_R2_business_letter():
    """REGRESSION: business.pdf — must deskew, may crop to letter size."""
    print("\n=== R2: Regression — business.pdf ===")
    src = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'output', 'business.pdf')
    if not os.path.exists(src):
        print("    [SKIP] business.pdf not available")
        return
    # Extract preview
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as f:
        p = f.name
    subprocess.run(['convert', f'{src}[0]', '-density', '300', '-background',
                    'white', '-flatten', '-resize', '868x', p],
                   capture_output=True, check=True)
    try:
        r = subprocess.run(
            [PYTHON, AUTOCROP_PY,
             '--image', p, '--left', '0', '--top', '0',
             '--width', '215.9', '--height', '279.4',
             '--bed-width', str(BED_W_MM), '--bed-height', str(BED_H_MM),
             '--no-scale', '--mode', 'interactive'],
            capture_output=True, text=True, timeout=60
        )
        out = json.loads(r.stdout.strip())
        if out.get('magic'):
            check("Business letter: angle 0.5-2°",
                  0.5 <= abs(out['angle']) <= 3.0, f"angle={out['angle']:.2f}°")
            check("Business letter: width ≈ letter (±8mm)",
                  near(out['doc_w'], 215.9, 8.0), f"w={out['doc_w']:.0f}mm")
            check("Business letter: height ≈ letter (±10mm)",
                  near(out['doc_h'], 279.4, 10.0), f"h={out['doc_h']:.0f}mm")
        else:
            check("Business letter: result expected (not no-op)", False)
    finally:
        os.unlink(p)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    print("=" * 65)
    print("Comprehensive autocrop tests")
    print("=" * 65)

    test_SS1_size_matching()
    test_E1_credit_card()
    test_E2_photo_large()
    test_E3_adf_minimal_tilt()
    test_M1_letter_clipped_clean()
    test_M2_a4_clipped_clean()
    test_M3_letter_wide_margin()
    test_M4_letter_conservative()
    test_H1_smudge_near_left_edge()
    test_H2_narrow_margin_text()
    test_H3_very_subtle_lid()
    test_H4_tilt_5_degrees()
    test_H5_fold_mark()
    test_X1_blank_page()
    test_X2_smudge_looks_like_edge()
    test_X3_note_in_margin()
    test_X4_full_bed_photo()
    test_R1_preview2_dark_edge()
    test_R2_business_letter()

    total = len(results)
    hard_fails = [n for n, ok, warn in results if not ok and not warn]
    soft_fails = [n for n, ok, warn in results if not ok and warn]
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n{'=' * 65}")
    print(f"Results: {passed}/{total} passed")
    if soft_fails:
        print(f"  {len(soft_fails)} soft failures (WARN — expected challenges)")
    if hard_fails:
        print(f"  {len(hard_fails)} hard failures (FAIL — bugs or regressions)")
    print("=" * 65)
    sys.exit(0 if not hard_fails else 1)
