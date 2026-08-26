#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app/src-tauri/target/release/bundle/macos/IconState.app"
SIDECAR="$APP/Contents/MacOS/iconstate-core"

[ -x "$SIDECAR" ] || { echo "sidecar missing from the bundle: $SIDECAR"; exit 1; }

echo "packaged core version: $("$SIDECAR" --version)"
"$SIDECAR" show -i "$ROOT/reference/fixtures/iconstate-original.json" > /dev/null
echo "packaged core parsed the golden fixture"

DMG="$(ls "$ROOT/app/src-tauri/target/release/bundle/dmg/"*.dmg 2>/dev/null | head -1 || true)"
if [ -n "$DMG" ]; then
    MOUNT="$(hdiutil attach -nobrowse -readonly "$DMG" | sed -n 's|.*\(/Volumes/.*\)|\1|p' | tail -1)"
    trap 'hdiutil detach "$MOUNT" -quiet || true' EXIT
    "$MOUNT/IconState.app/Contents/MacOS/iconstate-core" --version > /dev/null
    echo "dmg sidecar runs from $MOUNT"
fi
