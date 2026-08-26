#!/usr/bin/env python3
"""Copy webfonts and icons to the paths GitHub Pages serves from the source tree."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONTS_PUBLIC = PUBLIC / "fonts"
FONTS_ROOT = ROOT / "fonts"

FONT_FILES = [
    (
        ROOT / "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-standard-normal.woff2",
        "fraunces-latin-standard-normal.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-standard-italic.woff2",
        "fraunces-latin-standard-italic.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2",
        "ibm-plex-sans-latin-400-normal.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2",
        "ibm-plex-sans-latin-400-italic.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2",
        "ibm-plex-sans-latin-500-normal.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2",
        "ibm-plex-sans-latin-600-normal.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
        "ibm-plex-mono-latin-400-normal.woff2",
    ),
    (
        ROOT / "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
        "ibm-plex-mono-latin-500-normal.woff2",
    ),
]

ROOT_COPIES = [
    PUBLIC / "og.png",
    PUBLIC / "og.svg",
    PUBLIC / "apple-touch-icon.png",
    PUBLIC / "favicon.svg",
    PUBLIC / "404.html",
    PUBLIC / "robots.txt",
    PUBLIC / "site.webmanifest",
    PUBLIC / ".nojekyll",
]


def copy_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    print(f"copied {src.relative_to(ROOT)} -> {dest.relative_to(ROOT)}")


def main() -> None:
    missing = [str(src) for src, _ in FONT_FILES if not src.is_file()]
    if missing:
        raise SystemExit("Missing font sources. Run npm install first:\n" + "\n".join(missing))

    FONTS_PUBLIC.mkdir(parents=True, exist_ok=True)
    FONTS_ROOT.mkdir(parents=True, exist_ok=True)

    for src, name in FONT_FILES:
        copy_file(src, FONTS_PUBLIC / name)
        copy_file(src, FONTS_ROOT / name)

    for src in ROOT_COPIES:
        if src.is_file():
            copy_file(src, ROOT / src.name)
        else:
            print(f"skip missing {src.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
