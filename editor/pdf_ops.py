#!/usr/bin/env python3
"""PDF operations helper for scanservjs editor.

Invoked by Node.js via Process.spawn(). Commands:

  info <file>                              → JSON page metadata to stdout
  extract <file> <page> <output>           → extract single page (1-based)
  extract-rotate <file> <page> <deg> <out> → extract + rotate
  merge <output> <input1> [input2...]      → merge PDFs
  blank <width_pts> <height_pts> <output>  → create blank page PDF
"""

import json
import sys

import pikepdf


def cmd_info(args):
    """Print page dimensions as JSON."""
    if len(args) != 1:
        print('Usage: info <file>', file=sys.stderr)
        sys.exit(1)
    pdf = pikepdf.Pdf.open(args[0])
    pages = []
    for page in pdf.pages:
        box = page.mediabox
        # MediaBox is [x0, y0, x1, y1] in points
        width = float(box[2]) - float(box[0])
        height = float(box[3]) - float(box[1])
        pages.append({'width': round(width, 2), 'height': round(height, 2)})
    json.dump({'pages': pages}, sys.stdout)
    sys.stdout.write('\n')


def cmd_extract(args):
    """Extract a single page (1-based) to output file."""
    if len(args) != 3:
        print('Usage: extract <file> <page> <output>', file=sys.stderr)
        sys.exit(1)
    src_path, page_num, out_path = args[0], int(args[1]), args[2]
    src = pikepdf.Pdf.open(src_path)
    dst = pikepdf.Pdf.new()
    dst.pages.append(src.pages[page_num - 1])
    dst.save(out_path)


def cmd_extract_rotate(args):
    """Extract a single page and rotate it."""
    if len(args) != 4:
        print('Usage: extract-rotate <file> <page> <degrees> <output>',
              file=sys.stderr)
        sys.exit(1)
    src_path, page_num = args[0], int(args[1])
    degrees, out_path = int(args[2]), args[3]
    src = pikepdf.Pdf.open(src_path)
    dst = pikepdf.Pdf.new()
    dst.pages.append(src.pages[page_num - 1])
    dst.pages[0].rotate(degrees, relative=True)
    dst.save(out_path)


def cmd_merge(args):
    """Merge multiple PDF files into one."""
    if len(args) < 2:
        print('Usage: merge <output> <input1> [input2...]', file=sys.stderr)
        sys.exit(1)
    out_path = args[0]
    input_paths = args[1:]
    dst = pikepdf.Pdf.new()
    # Keep source PDFs open until save completes (pikepdf requirement)
    sources = []
    for inp in input_paths:
        src = pikepdf.Pdf.open(inp)
        sources.append(src)
        dst.pages.extend(src.pages)
    dst.save(out_path)


def cmd_blank(args):
    """Create a blank white PDF page with given dimensions in points."""
    if len(args) != 3:
        print('Usage: blank <width_pts> <height_pts> <output>', file=sys.stderr)
        sys.exit(1)
    width, height, out_path = float(args[0]), float(args[1]), args[2]
    pdf = pikepdf.Pdf.new()
    pdf.add_blank_page(page_size=(width, height))
    pdf.save(out_path)


def cmd_resize_mediabox(args):
    """Set MediaBox of all pages to target dimensions (OCR-safe, no content scaling).

    Adjusts only page metadata — content streams, fonts, and OCR layers are
    untouched.  Any existing CropBox is removed so it does not constrain the
    new MediaBox.
    """
    if len(args) != 4:
        print('Usage: resize-mediabox <input> <width_pts> <height_pts> <output>',
              file=sys.stderr)
        sys.exit(1)
    in_path, width, height, out_path = args[0], float(args[1]), float(args[2]), args[3]
    pdf = pikepdf.Pdf.open(in_path)
    for page in pdf.pages:
        page.mediabox = pikepdf.Array([0, 0, width, height])
        if '/CropBox' in page:
            del page['/CropBox']
    pdf.save(out_path)


def _inject_ctm(pdf, page, scale, tx, ty):
    """Prepend a uniform-scale CTM transform to page content, wrapped in q/Q.

    Inserts: q <scale> 0 0 <scale> <tx> <ty> cm
    before existing content and appends Q, preserving the graphics state for
    any content that follows.  Works with both single-stream and multi-stream
    pages.  OCR-safe: only the coordinate transform changes, not the content.
    """
    pre = f'q {scale:.6f} 0 0 {scale:.6f} {tx:.6f} {ty:.6f} cm\n'.encode()
    suf = b'\nQ\n'
    pre_stream = pikepdf.Stream(pdf, pre)
    suf_stream = pikepdf.Stream(pdf, suf)

    try:
        existing = page['/Contents']
    except KeyError:
        existing = None

    if existing is None:
        page['/Contents'] = pikepdf.Array([pre_stream, suf_stream])
    elif isinstance(existing, pikepdf.Array):
        page['/Contents'] = pikepdf.Array([pre_stream, *list(existing), suf_stream])
    else:
        # Single stream (direct or via indirect reference)
        page['/Contents'] = pikepdf.Array([pre_stream, existing, suf_stream])


def cmd_place_on_page(args):
    """Place page content onto a target page with the specified fit mode.

    Usage: place-on-page <input> <target_w_pts> <target_h_pts> <fit_mode> <margin_pts> <output>

    fit_mode values:
      set-size  Adjust MediaBox only — no content scaling (OCR-safe)
      fit       Scale content proportionally to fit within (target − 2×margin),
                centred, with white margins as needed
      fill      Scale content proportionally to fill (target − 2×margin),
                centred, cropping overflow at the MediaBox boundary

    All modes are OCR-safe: fit/fill use a pikepdf CTM transform rather than
    Ghostscript re-rendering.
    """
    if len(args) != 6:
        print(
            'Usage: place-on-page <input> <target_w_pts> <target_h_pts>'
            ' <fit_mode> <margin_pts> <output>',
            file=sys.stderr)
        sys.exit(1)
    in_path = args[0]
    target_w = float(args[1])
    target_h = float(args[2])
    fit_mode = args[3]   # 'set-size' | 'fit' | 'fill'
    margin_pts = float(args[4])
    out_path = args[5]

    pdf = pikepdf.Pdf.open(in_path)
    for page in pdf.pages:
        box = page.mediabox
        src_x0 = float(box[0])
        src_y0 = float(box[1])
        src_w = float(box[2]) - src_x0
        src_h = float(box[3]) - src_y0

        if fit_mode == 'set-size':
            page.mediabox = pikepdf.Array([0, 0, target_w, target_h])
            if '/CropBox' in page:
                del page['/CropBox']
            continue

        # Degenerate page guard
        if src_w <= 0 or src_h <= 0:
            page.mediabox = pikepdf.Array([0, 0, target_w, target_h])
            if '/CropBox' in page:
                del page['/CropBox']
            continue

        avail_w = max(1.0, target_w - 2 * margin_pts)
        avail_h = max(1.0, target_h - 2 * margin_pts)

        if fit_mode == 'fit':
            scale = min(avail_w / src_w, avail_h / src_h)
        else:  # fill
            scale = max(avail_w / src_w, avail_h / src_h)

        # Centre scaled content on the target page, accounting for any
        # non-zero source origin.
        tx = (target_w - src_w * scale) / 2 - src_x0 * scale
        ty = (target_h - src_h * scale) / 2 - src_y0 * scale

        _inject_ctm(pdf, page, scale, tx, ty)
        page.mediabox = pikepdf.Array([0, 0, target_w, target_h])
        if '/CropBox' in page:
            del page['/CropBox']

    pdf.save(out_path)


COMMANDS = {
    'info': cmd_info,
    'extract': cmd_extract,
    'extract-rotate': cmd_extract_rotate,
    'merge': cmd_merge,
    'blank': cmd_blank,
    'resize-mediabox': cmd_resize_mediabox,
    'place-on-page': cmd_place_on_page,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f'Usage: {sys.argv[0]} <command> [args...]', file=sys.stderr)
        print(f'Commands: {", ".join(COMMANDS.keys())}', file=sys.stderr)
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == '__main__':
    main()
