#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRIPLE="$(rustc -vV | awk '/^host:/ {print $2}')"
OUT="$ROOT/app/src-tauri/binaries"

BINARY="$OUT/iconstate-core-$TRIPLE"

if [ -x "$BINARY" ] && [ -z "$(find "$ROOT/core/src" "$ROOT/core/pyproject.toml" "$ROOT/core/entrypoint.py" -newer "$BINARY" -print -quit)" ]; then
    echo "sidecar up to date: $BINARY"
    exec "$BINARY" --version
fi

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
cp "$ROOT/core/dist/iconstate-core" "$BINARY"
chmod +x "$BINARY"

echo "sidecar ready: $BINARY"
"$BINARY" --version
