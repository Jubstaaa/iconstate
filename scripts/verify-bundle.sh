#!/usr/bin/env bash
set -euo pipefail

# The app is one binary now, so this only checks that the bundle holds a working
# one — and that the same binary comes back out of the mounted dmg.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app/src-tauri/target/release/bundle/macos/IconState.app"
BINARY="$APP/Contents/MacOS/iconstate"

[ -x "$BINARY" ] || { echo "binary missing from the bundle: $BINARY"; exit 1; }
echo "bundled binary: $(du -h "$BINARY" | cut -f1)"

codesign --verify --deep --strict "$APP"
echo "bundle signature verifies"

DMG="$(ls "$ROOT/app/src-tauri/target/release/bundle/dmg/"*.dmg 2>/dev/null | head -1 || true)"
if [ -n "$DMG" ]; then
    MOUNT="$(hdiutil attach -nobrowse -readonly "$DMG" | sed -n 's|.*\(/Volumes/.*\)|\1|p' | tail -1)"
    trap 'hdiutil detach "$MOUNT" -quiet || true' EXIT
    [ -x "$MOUNT/IconState.app/Contents/MacOS/iconstate" ] || { echo "dmg has no binary"; exit 1; }
    echo "dmg carries the app at $MOUNT"
fi
