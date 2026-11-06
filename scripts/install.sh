#!/usr/bin/env bash
set -euo pipefail

# Fetch the latest release, put it in /Applications and clear the quarantine
# flag. That last step is the whole reason this script exists: the build is not
# signed with an Apple developer certificate, and recent macOS calls unsigned
# downloads damaged rather than asking.

REPO="Jubstaaa/iconstate"
APP="IconState.app"
TARGET="/Applications/$APP"

[ "$(uname -s)" = "Darwin" ] || { echo "IconState is macOS only."; exit 1; }
[ "$(uname -m)" = "arm64" ] || { echo "IconState needs an Apple silicon Mac."; exit 1; }

echo "Looking up the latest release…"
DMG_URL="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o '"browser_download_url": *"[^"]*\.dmg"' \
    | head -1 \
    | sed 's/.*"\(https[^"]*\)"/\1/')"

[ -n "$DMG_URL" ] || { echo "No .dmg in the latest release."; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Downloading $(basename "$DMG_URL")…"
curl -fsSL "$DMG_URL" -o "$WORK/iconstate.dmg"

MOUNT="$(hdiutil attach -nobrowse -readonly "$WORK/iconstate.dmg" | sed -n 's|.*\(/Volumes/.*\)|\1|p' | tail -1)"
trap 'hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

if [ -d "$TARGET" ]; then
    echo "Replacing the copy already in /Applications…"
    rm -rf "$TARGET"
fi

echo "Installing to ${TARGET}…"
cp -R "$MOUNT/$APP" /Applications/
xattr -dr com.apple.quarantine "$TARGET"

# The app doubles as a command line tool; link it where the shell will find it.
for BIN in /opt/homebrew/bin /usr/local/bin; do
    if [ -d "$BIN" ] && [ -w "$BIN" ]; then
        ln -sf "$TARGET/Contents/MacOS/iconstate" "$BIN/iconstate"
        echo "Linked the command line tool to $BIN/iconstate."
        break
    fi
done

echo
echo "Installed. Plug an iPhone in over USB, tap Trust on it, and open IconState."
open "$TARGET"
