#!/bin/bash
# setup.sh — Set up the xfa-convert runtime environment.
#
# Installs:
#   1. Node.js pdfjs-dist npm package (into node_modules/)
#   2. Python .venv with WeasyPrint
#   3. Fonts commonly needed for XFA form rendering (see notes below)
#
# Font note:
#   XFA forms are predominantly authored on Windows and specify Windows-only
#   fonts (Calibri, Arial, Times New Roman, etc.) that are not present on a
#   typical Linux server.  This script installs free metric-compatible
#   substitutes from standard Debian/Ubuntu repositories.  "Metric-compatible"
#   means the substitute has identical character widths, so text lays out
#   identically to the original font.
#
#   When this feature is integrated into the Debian package, the same fonts
#   should be listed as Depends: in the package control file rather than
#   installed here.  See docs/xfa-rendering.md § "Debian package integration".
#
# Safe to re-run (idempotent).
#
# Usage:
#   ./setup.sh [--no-npm] [--no-venv] [--no-fonts]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NO_NPM=0; NO_VENV=0; NO_FONTS=0
for arg in "$@"; do
  case "$arg" in
    --no-npm)   NO_NPM=1 ;;
    --no-venv)  NO_VENV=1 ;;
    --no-fonts) NO_FONTS=1 ;;
  esac
done

# ── 1. Node.js dependencies ──────────────────────────────────────────────────
if [ "$NO_NPM" -eq 0 ]; then
  echo "[npm] Installing pdfjs-dist…"
  npm install --prefix "$SCRIPT_DIR" --silent
  echo "[npm] Done."
fi

# ── 2. Python venv + WeasyPrint ──────────────────────────────────────────────
if [ "$NO_VENV" -eq 0 ]; then
  VENV="$SCRIPT_DIR/.venv"

  if python3 -c "import weasyprint; assert tuple(int(x) for x in weasyprint.__version__.split('.')[:2]) >= (68,0)" 2>/dev/null; then
    echo "[venv] System WeasyPrint ≥68.0 already available — skipping .venv creation."
  else
    if [ ! -d "$VENV" ]; then
      echo "[venv] Creating Python virtual environment…"
      python3 -m venv "$VENV"
      "$VENV/bin/pip" install --quiet --upgrade pip
    fi
    echo "[venv] Installing WeasyPrint…"
    "$VENV/bin/pip" install --quiet -r "$SCRIPT_DIR/requirements.txt"
    echo "[venv] Done."
  fi
fi

# ── 3. Fonts ─────────────────────────────────────────────────────────────────
# Metric-compatible substitutes for common Windows fonts used in XFA forms.
# All packages are available in Debian 11+ / Ubuntu 20.04+ under SIL Open Font
# Licence or equivalent free/libre licences.
if [ "$NO_FONTS" -eq 0 ]; then
  _install_apt_fonts() {
    local missing=()
    local packages=(
      fonts-crosextra-carlito   # Calibri substitute (metric-compatible)
      fonts-crosextra-caladea   # Cambria substitute (metric-compatible)
      fonts-liberation          # Arial, Times New Roman, Courier New substitutes
      fonts-dejavu-core         # General fallback (DejaVu Sans/Serif/Mono)
      fonts-noto-core           # Broad script coverage for non-Latin text
    )
    for pkg in "${packages[@]}"; do
      if ! dpkg -l "$pkg" 2>/dev/null | grep -q '^ii'; then
        missing+=("$pkg")
      fi
    done
    if [ "${#missing[@]}" -gt 0 ]; then
      echo "[fonts] Installing: ${missing[*]}"
      sudo apt-get install -y --no-install-recommends "${missing[@]}"
    else
      echo "[fonts] All font packages already installed."
    fi
  }

  # Fallback: download only Carlito from Google Fonts CDN if apt is unavailable.
  # Carlito is published under SIL Open Font Licence 1.1 — freely distributable.
  _install_carlito_fallback() {
    if fc-list | grep -qi "carlito"; then
      return
    fi
    echo "[fonts] apt unavailable; downloading Carlito from Google Fonts CDN…"
    FONT_DIR="${HOME}/.local/share/fonts/carlito"
    mkdir -p "$FONT_DIR"
    BASE="https://fonts.gstatic.com/s/carlito/v25"
    declare -A URLS=(
      ["Carlito-Regular.ttf"]="${BASE}/3Jn9SDPw3m-pk039PDCLTXkJ2gA8.ttf"
      ["Carlito-Bold.ttf"]="${BASE}/3Jn4SDPw3m-pk039BMIQR0Qf2PQ.ttf"
      ["Carlito-Italic.ttf"]="${BASE}/3Jn-SDPw3m-pk039PMgKT6kI2gA.ttf"
      ["Carlito-BoldItalic.ttf"]="${BASE}/3Jn_SDPw3m-pk039BMiQjVhkf2gA.ttf"
    )
    for name in "${!URLS[@]}"; do
      dest="$FONT_DIR/$name"
      if [ ! -f "$dest" ]; then
        echo "  Downloading $name…"
        curl -fsSL -o "$dest" "${URLS[$name]}"
      fi
    done
    echo "[fonts] Carlito installed to $FONT_DIR"
    echo "[fonts] Note: other substitutes (Liberation, DejaVu, Noto) not installed."
    echo "[fonts]       Install them manually or use apt if available."
  }

  if command -v apt-get >/dev/null 2>&1; then
    _install_apt_fonts
  else
    _install_carlito_fallback
  fi

  fc-cache -f
fi

echo ""
echo "Setup complete."
echo "  Node:       $(node --version 2>/dev/null || echo 'not found')"
VENV="$SCRIPT_DIR/.venv"
WP_BIN="$VENV/bin/weasyprint"
if [ -x "$WP_BIN" ]; then
  echo "  WeasyPrint: $("$WP_BIN" --version 2>/dev/null || echo 'unknown')"
elif python3 -c 'import weasyprint; print(weasyprint.__version__)' 2>/dev/null; then
  echo "  WeasyPrint: (system)"
else
  echo "  WeasyPrint: not found"
fi
echo "  Fonts:      $(fc-list | grep -iE 'carlito|liberation|dejavu|noto' | wc -l) relevant font files found"
