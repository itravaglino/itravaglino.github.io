#!/usr/bin/env python3
"""Generate apple-touch-icon.png and og.png without third-party deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public"

BG = (0x13, 0x11, 0x0F)
INK = (0xF3, 0xEA, 0xDC)
ACCENT = (0xC9, 0x86, 0x5A)
MUTE = (0xC9, 0xBB, 0xA8)
DIM = (0x9A, 0x8D, 0x7C)


def png_rgba(width: int, height: int, pixels: bytearray) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = width * 3
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(bytes(raw), 9)),
            chunk(b"IEND", b""),
        ]
    )


def fill(px: bytearray, w: int, h: int, color: tuple[int, int, int]) -> None:
    r, g, b = color
    for i in range(0, w * h * 3, 3):
        px[i] = r
        px[i + 1] = g
        px[i + 2] = b


def rect(
    px: bytearray,
    w: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[int, int, int],
) -> None:
    r, g, b = color
    limit = len(px)
    h = limit // (w * 3)
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(w, x1)
    y1 = min(h, y1)
    for y in range(y0, y1):
        row = y * w * 3
        for x in range(x0, x1):
            i = row + x * 3
            px[i] = r
            px[i + 1] = g
            px[i + 2] = b


# 5x7 glyphs
GLYPHS = {
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "A": ["00100", "01010", "10001", "10001", "11111", "10001", "10001"],
    "V": ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00100", "00100"],
    "·": ["00000", "00000", "00100", "00000", "00000", "00000", "00000"],
    "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
}


def blit_text(
    px: bytearray,
    w: int,
    text: str,
    x: int,
    y: int,
    scale: int,
    color: tuple[int, int, int],
    tracking: int = 1,
) -> None:
    cx = x
    for ch in text.upper():
        glyph = GLYPHS.get(ch, GLYPHS[" "])
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "1":
                    rect(
                        px,
                        w,
                        cx + gx * scale,
                        y + gy * scale,
                        cx + (gx + 1) * scale,
                        y + (gy + 1) * scale,
                        color,
                    )
        cx += 5 * scale + tracking * scale
    cx -= tracking * scale


def write(name: str, width: int, height: int, pixels: bytearray) -> None:
    path = OUT / name
    path.write_bytes(png_rgba(width, height, pixels))
    print(f"wrote {path}")


def text_width(text: str, scale: int, tracking: int) -> int:
    n = len(text)
    return n * 5 * scale + max(0, n - 1) * tracking * scale


def apple_touch() -> None:
    w = h = 180
    px = bytearray(w * h * 3)
    fill(px, w, h, BG)
    scale = 12
    tracking = 2
    tw = text_width("IT", scale, tracking)
    th = 7 * scale
    blit_text(px, w, "IT", (w - tw) // 2, (h - th) // 2, scale, INK, tracking=tracking)
    write("apple-touch-icon.png", w, h, px)


def og() -> None:
    w, h = 1200, 630
    px = bytearray(w * h * 3)
    fill(px, w, h, BG)
    # frame
    rect(px, w, 0, 72, w, 73, ACCENT)
    rect(px, w, 0, 557, w, 558, ACCENT)
    rect(px, w, 64, 0, 65, h, ACCENT)
    rect(px, w, 1135, 0, 1136, h, ACCENT)
    blit_text(px, w, "IGNACIO", 96, 120, 5, ACCENT, tracking=3)
    blit_text(px, w, "TRAVAGLINO", 96, 250, 12, INK, tracking=2)
    blit_text(px, w, "GENERAL DEVELOPER  PHYSICIST", 96, 420, 4, MUTE, tracking=2)
    blit_text(px, w, "CORDOBA  FAMAF  APPLIED AI", 96, 500, 3, DIM, tracking=2)
    write("og.png", w, h, px)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    apple_touch()
    og()
