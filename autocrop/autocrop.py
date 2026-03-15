import sys
import json
import cv2
import numpy as np
import math

import argparse

def main():
    parser = argparse.ArgumentParser(description="Auto-Crop and Deskew for Scanservjs")
    parser.add_argument('--image', type=str, required=True, help='Path to the preview image')
    parser.add_argument('--left', type=float, required=True, help='Target box left coordinate (mm)')
    parser.add_argument('--top', type=float, required=True, help='Target box top coordinate (mm)')
    parser.add_argument('--width', type=float, required=True, help='Target box width (mm)')
    parser.add_argument('--height', type=float, required=True, help='Target box height (mm)')
    parser.add_argument('--bed-width', type=float, required=True, help='Scanner bed width (mm)')
    parser.add_argument('--bed-height', type=float, required=True, help='Scanner bed height (mm)')
    parser.add_argument('--debug', action='store_true', help='Output visual debug images')
    
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

    img = cv2.imread(img_path)
    if img is None:
        print(json.dumps({"error": "Cannot read image"}))
        return

    img_h, img_w = img.shape[:2]
    
    # 1. Bezel Wipe: 1.5% margin on all sides
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
    
    # 2. Point Cloud Generation
    blurred = cv2.GaussianBlur(masked, (5, 5), 0)
    edges = cv2.Canny(blurred, 15, 50)
    
    if args.debug:
        cv2.imwrite(img_path + ".debug-2-edges.jpg", edges)
    
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    valid_contours = [c for c in contours if cv2.arcLength(c, False) >= 50]
    
    if args.debug:
        debug_contours = img.copy()
        cv2.drawContours(debug_contours, valid_contours, -1, (0, 255, 0), 2)
        cv2.imwrite(img_path + ".debug-3-contours.jpg", debug_contours)

    if not valid_contours:
        print(json.dumps({"error": "No valid document points found"}))
        return
        
    points = np.vstack(valid_contours)
    
    # 3. The Base Rect
    rect = cv2.minAreaRect(points)

    # 4. The Surgical Restore (Anti-Shrink-Wrap)
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

    # 5. Final Rect
    rect = cv2.minAreaRect(np.float32(box))
    
    if args.debug:
        final_box = cv2.boxPoints(rect)
        debug_rect = img.copy()
        cv2.drawContours(debug_rect, [np.int32(final_box)], 0, (0, 0, 255), 2)
        cv2.imwrite(img_path + ".debug-4-rect.jpg", debug_rect)
    
    c_x_px, c_y_px = rect[0]
    w_px, h_px = rect[1]
    angle_deg = rect[2]

    # Convert to mm
    px_per_mm_x = img_w / bed_w if bed_w else 1
    px_per_mm_y = img_h / bed_h if bed_h else 1

    doc_c_x = c_x_px / px_per_mm_x
    doc_c_y = c_y_px / px_per_mm_y
    doc_w_mm = w_px / px_per_mm_x
    doc_h_mm = h_px / px_per_mm_y

    # Deskew angle normalization: only fix fine-grained skew within [-45, 45].
    # Structural rotation (90/180/270) should be handled manually by the user.
    # OpenCV angle is in [-90, 0).
    if angle_deg < -45:
        rotate_angle = -(angle_deg + 90)
        # It's vertical relative to the rect, so swap dimensions to reflect its final orientation
        doc_w_mm = h_px / px_per_mm_x
        doc_h_mm = w_px / px_per_mm_y
    else:
        rotate_angle = -angle_deg
        doc_w_mm = w_px / px_per_mm_x
        doc_h_mm = h_px / px_per_mm_y

    # Logic to decide if we should scale to fit the target box (format matching)
    # or just stay at 1:1 (full bed scanning).
    is_full_bed = (t_w >= bed_w - 1.0) and (t_h >= bed_h - 1.0)
    
    if is_full_bed:
        sx = 1.0
        sy = 1.0
    else:
        rx = t_w / doc_w_mm if doc_w_mm > 0 else 1.0
        ry = t_h / doc_h_mm if doc_h_mm > 0 else 1.0
        
        # Scaling tolerances: 2% rule for "silent fit"
        # ratio_diff is the difference between the width-scale and height-scale.
        # If they are very close, we can stretch slightly to fill the target box.
        diff = abs(rx - ry)
        avg = (rx + ry) / 2.0
        if (diff / avg) <= 0.02:
            # Match exactly (minor stretch)
            sx = rx
            sy = ry
        else:
            # Padded fit (white bars) - use the scale that fits the whole doc inside the box
            s = min(rx, ry)
            sx = s
            sy = s

    # Formulate pixel coordinates using placeholders for physical-to-pixel mapping.
    # OX/OY = Input image offset, IW/IH = Input image size, TCX/TCY = Output grid center.
    fx_cx = f"%[fx:((({doc_c_x:.6f} - {{OX}}) / {{IW}}) * w)]"
    fx_cy = f"%[fx:((({doc_c_y:.6f} - {{OY}}) / {{IH}}) * h)]"
    
    # Target center: Keep the document at its physical bed location.
    # This ensures that manual cropping/panning works intuitively.
    fx_tx = f"%[fx:((({doc_c_x:.6f} - {{OX}}) / {{IW}}) * w)]"
    fx_ty = f"%[fx:((({doc_c_y:.6f} - {{OY}}) / {{IH}}) * h)]"
    
    srt_str = f"{fx_cx},{fx_cy} {sx:f},{sy:f} {rotate_angle:.6f} {fx_tx},{fx_ty}"
    # Restore reference implementation's magic string but keep -background white
    magic_str = f"-background white -virtual-pixel white -distort SRT \"{srt_str}\" +repage"

    output = {
        "magic": magic_str,
        "angle": rotate_angle,
        "doc_w": doc_w_mm,
        "doc_h": doc_h_mm,
        "doc_c_x": doc_c_x,
        "doc_c_y": doc_c_y
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
