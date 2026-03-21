#!/usr/bin/env python3
"""
convert.py — Convert an XFA PDF to a static flat PDF.

Pipeline:
  1. node extract_xfa.mjs <input.pdf> --outdir <tmpdir>
     → writes xfa_pages.html (+ page-N.json debug files)
  2. weasyprint xfa_pages.html <output.pdf>

Usage:
  python3 convert.py <input.pdf> [output.pdf]

  If output.pdf is omitted it defaults to <input_stem>_flat.pdf in the same
  directory as the input.

Environment:
  Requires Node.js 18+ on PATH and WeasyPrint available either in the .venv
  created by setup.sh, at WEASYPRINT env var, or on PATH.

Exit codes:
  0  success
  1  usage error
  2  extraction failed
  3  rendering failed
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()


def find_weasyprint():
    """Return the path to the weasyprint executable."""
    # 1. Caller-supplied override
    env_wp = os.environ.get('WEASYPRINT')
    if env_wp and shutil.which(env_wp):
        return env_wp

    # 2. Local venv created by setup.sh
    venv_wp = SCRIPT_DIR / '.venv' / 'bin' / 'weasyprint'
    if venv_wp.exists():
        return str(venv_wp)

    # 3. Anything on PATH
    wp = shutil.which('weasyprint')
    if wp:
        return wp

    return None


def run(cmd, desc, exit_code):
    """Run a command, printing stdout/stderr and exiting on failure."""
    result = subprocess.run(cmd, capture_output=False, text=True)
    if result.returncode != 0:
        print(f'Error: {desc} failed (exit {result.returncode})', file=sys.stderr)
        sys.exit(exit_code)


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    input_pdf = Path(sys.argv[1]).resolve()
    if not input_pdf.exists():
        print(f'Error: {input_pdf} not found', file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) >= 3:
        output_pdf = Path(sys.argv[2]).resolve()
    else:
        output_pdf = input_pdf.parent / f'{input_pdf.stem}_flat.pdf'

    weasyprint = find_weasyprint()
    if not weasyprint:
        print(
            'Error: weasyprint not found.\n'
            '  Run setup.sh to create the .venv, or set the WEASYPRINT environment variable.',
            file=sys.stderr,
        )
        sys.exit(1)

    with tempfile.TemporaryDirectory(prefix='xfa_convert_') as tmpdir:
        print(f'Extracting XFA from {input_pdf.name}…')
        run(
            ['node', str(SCRIPT_DIR / 'extract_xfa.mjs'), str(input_pdf), '--outdir', tmpdir],
            desc='XFA extraction',
            exit_code=2,
        )

        html_path = Path(tmpdir) / 'xfa_pages.html'
        if not html_path.exists():
            print('Error: extract_xfa.mjs did not write xfa_pages.html', file=sys.stderr)
            sys.exit(2)

        print(f'Rendering to {output_pdf.name}…')
        run(
            [weasyprint, str(html_path), str(output_pdf)],
            desc='WeasyPrint rendering',
            exit_code=3,
        )

    print(f'Done → {output_pdf}')


if __name__ == '__main__':
    main()
