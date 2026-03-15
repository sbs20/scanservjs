# Autocrop Implementation: Surgical Restore Logic

## Overview
The `autocrop.py` script provides an automated way to detect, deskew, and crop documents from a flatbed scanner preview. It is specifically optimized for "white-on-white" scanning (white paper on a light scanner bed) and preserving word-processor margins.

## The "Surgical Restore" Algorithm

### 1. Bezel Suppression
To prevent the physical plastic frame of the scanner from being detected as a document edge, the script applies a **1.5% white-out "wipe"** to the extreme outer edges of the image.
* **Why:** The scanner bezel often creates high-contrast lines that trick Canny edge detection.
* **Effect:** Anything in the outermost 1.5% of the image is treated as "background."

### 2. Point Cloud Generation
1.  **Preprocessing:** Grayscale conversion and a 5x5 Gaussian blur to reduce sensor noise.
2.  **Edge Detection:** Canny edges are calculated with a sensitive threshold (15, 50).
3.  **Filtering:** Contours are extracted, but only those with an arc length > 50px are kept to ignore dust or small artifacts.
4.  **Cloud:** All remaining valid points are stacked into a single coordinate cloud.

### 3. Margin Recovery (The "Surgical Restore")
Standard cropping "shrink-wraps" the box to the text when the paper edges are invisible. To fix this:
1.  A base `minAreaRect` is calculated from the point cloud.
2.  The coordinates of the 4 corners are inspected.
3.  **The Snap:** If a corner's `x` or `y` coordinate is within 2 pixels of the 1.5% "wipe" boundary, it is "snapped" to the literal hardware limit (`0` or `max`).
4.  **Re-calculation:** The rectangle is re-calculated from these snapped points.



## Communication Bridge
The script is designed to be called by `api.js` via a subprocess. 

### Input Arguments
* `--image`: Path to the source TIF/JPG.
* `--left`, `--top`, `--width`, `--height`: The target "scan area" coordinates in mm.
* `--bed-width`, `--bed-height`: The physical dimensions of the scanner glass in mm.

### Output
Returns a JSON object containing an ImageMagick-compatible SRT (Scale-Rotate-Translate) string:
```json
{
  "magic": "-virtual-pixel white -distort SRT \"...\"",
  "angle": 2.5,
  "doc_w": 215.9,
  "doc_h": 279.4
}
```
