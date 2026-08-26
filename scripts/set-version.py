#!/usr/bin/env python3
"""Write one version, derived from the git tag, into every manifest that carries it."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")


def from_git() -> str:
    tag = subprocess.run(
        ["git", "describe", "--tags", "--abbrev=0"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return tag.removeprefix("v") if tag else "0.0.0"


def patch_json(path: Path, version: str) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def patch_line(path: Path, pattern: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    patched, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f"could not find a version line in {path}")
    path.write_text(patched, encoding="utf-8")


def main(argv: list[str]) -> int:
    version = (argv[0] if argv else from_git()).removeprefix("v")
    if not SEMVER.match(version):
        raise SystemExit(f"not a semantic version: {version!r}")

    patch_json(ROOT / "app" / "package.json", version)
    patch_json(ROOT / "app" / "src-tauri" / "tauri.conf.json", version)
    patch_line(ROOT / "app" / "src-tauri" / "Cargo.toml", r'^version = ".*"$', f'version = "{version}"')
    patch_line(
        ROOT / "core" / "src" / "iconstate" / "_version.py",
        r'^__version__ = ".*"$',
        f'__version__ = "{version}"',
    )

    print(version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
