#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRIPLE="$(rustc -vV | awk '/^host:/ {print $2}')"
OUT="$ROOT/app/src-tauri/binaries"

cd "$ROOT/core"
[ -d .venv ] || uv venv --python 3.12
uv pip install -q -e . --group dev

.venv/bin/pyinstaller \
    --noconfirm \
    --clean \
    --onefile \
    --name iconstate-core \
    --distpath "$ROOT/core/dist" \
    --workpath "$ROOT/core/build" \
    --specpath "$ROOT/core/build" \
    --collect-all pymobiledevice3 \
    --hidden-import iconstate.device \
    entrypoint.py

mkdir -p "$OUT"
cp "$ROOT/core/dist/iconstate-core" "$OUT/iconstate-core-$TRIPLE"
chmod +x "$OUT/iconstate-core-$TRIPLE"

echo "sidecar ready: $OUT/iconstate-core-$TRIPLE"
"$OUT/iconstate-core-$TRIPLE" --version
