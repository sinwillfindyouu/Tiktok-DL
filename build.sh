#!/usr/bin/env bash
# Build script untuk deployment ke Vercel (via GitHub).
#
# Catatan: Vercel Python runtime sebenarnya sudah otomatis menjalankan
# `pip install -r requirements.txt` saat build. Script ini disediakan agar
# dapat dipakai sebagai "Build Command" di dashboard Vercel
# (Project > Settings > Build & Development Settings > Build Command: bash build.sh)
# atau untuk menambahkan langkah custom lain (contoh: install binary tambahan).

set -euo pipefail

echo "==> Python version: $(python --version 2>/dev/null || python3 --version)"

echo "==> Upgrading pip ..."
python -m pip install --upgrade pip || python3 -m pip install --upgrade pip

echo "==> Installing requirements.txt ..."
pip install -r requirements.txt 2>/dev/null || python3 -m pip install -r requirements.txt

echo "==> Build complete."