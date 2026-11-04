#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "  Draythos — Vhagar Backend Launcher"
echo "========================================="

# ── Check Python 3 ────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 is not installed or not on PATH."
    echo "Please install Python 3.10+ and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')

if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]; }; then
    echo "ERROR: Python 3.10+ is required. Found Python $PYTHON_VERSION."
    exit 1
fi

echo "✓ Python $PYTHON_VERSION detected"

# ── Create virtual environment if missing ─────────────────────────
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "✓ Virtual environment created at $VENV_DIR"
else
    echo "✓ Virtual environment found"
fi

# ── Activate venv ─────────────────────────────────────────────────
source "$VENV_DIR/bin/activate"

# ── Install / upgrade dependencies ────────────────────────────────
echo "Installing dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "✓ Dependencies installed"

# ── Create data directories ───────────────────────────────────────
mkdir -p data/documents data/index_overflow data/working_copies logs
echo "✓ Data directories ready"

# ── Start Vhagar ──────────────────────────────────────────────────
echo ""
echo "Starting Vhagar server..."
echo "-----------------------------------------"
python3 -m vhagar "$@"
