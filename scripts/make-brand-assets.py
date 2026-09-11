#!/usr/bin/env python3
"""Regenerate the committed brand assets from the source JPEGs in brand/.

Why this script exists
----------------------
brand/logo-kabupaten-lima-puluh-kota.jpeg is a transparent PNG that was saved
as JPEG: its transparency became a baked-in light-gray/white checkerboard, and
brand/logo-k3.jpeg sits on a plain white field. Neither can be keyed with a
global near-white threshold (the checker's gray squares survive) or with
mix-blend-mode tricks (gray squares still read on any surface), and a global
light-pixels test would also delete the white quadrants painted inside the
kabupaten shield. The key below is a border-connected flood fill instead:
starting from every frame-edge pixel it walks inward through pixels that are
both near-neutral and light — which covers the checker's two tones (measured
~254 for white squares, 221-226 for gray squares) and the K3 logo's white
field — and turns exactly that reachable region transparent. Any white the
flood cannot reach (the shield's quadrants, the gear's cut-outs) stays opaque.

Outputs are deterministic and committed; re-run only when a source JPEG
changes:

    src/assets/logo-k3.png               header mark, 128 px tall, transparent
    src/assets/logo-lima-puluh-kota.png  header arms, 128 px tall, transparent
    src/app/icon.png                     128x128 favicon, K3 mark, transparent
    src/app/apple-icon.png               180x180 iOS icon, K3 mark on white

Usage:
    python3 scripts/make-brand-assets.py

Requires Pillow (>= 10). No ImageMagick, no network.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent

# A pixel counts as background when it is near-neutral (JPEG chroma noise on
# the checker stays within a few units) and light. These bounds were measured
# on the committed sources; widen only after a visual re-check of the header.
NEUTRAL_TOLERANCE = 14  # max(r,g,b) - min(r,g,b) must not exceed this
LIGHTNESS_FLOOR = 192   # (max+min)/2 mean channel value must reach this
FEATHER_PX = 1.0        # alpha softening, applied at source resolution
TRIM_PAD_PX = 2         # transparent breathing room kept around each mark
ALPHA_BBOX_THRESHOLD = 8  # alpha above this counts as content when trimming

HEADER_HEIGHT_PX = 128
ICON_SIZE_PX = (128, 128)
ICON_MARK_BOX_PX = 104  # K3 mark fits inside this square, centered
APPLE_SIZE_PX = (180, 180)
APPLE_MARK_BOX_PX = 132  # ... inside this one, on an opaque white canvas

SOURCES = {
    "k3": REPO_ROOT / "brand" / "logo-k3.jpeg",
    "kabupaten": REPO_ROOT / "brand" / "logo-kabupaten-lima-puluh-kota.jpeg",
}

OUTPUTS = {
    "k3_header": REPO_ROOT / "src" / "assets" / "logo-k3.png",
    "kabupaten_header": REPO_ROOT / "src" / "assets" / "logo-lima-puluh-kota.png",
    "icon": REPO_ROOT / "src" / "app" / "icon.png",
    "apple_icon": REPO_ROOT / "src" / "app" / "apple-icon.png",
}


def load_rgb(path: Path) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"missing source: {path} — copy it into brand/ first")
    with Image.open(path) as im:
        return im.convert("RGB")


def is_background(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel
    return (
        max(r, g, b) - min(r, g, b) <= NEUTRAL_TOLERANCE
        and (max(r, g, b) + min(r, g, b)) / 2 >= LIGHTNESS_FLOOR
    )


def key_border_connected(img: Image.Image) -> Image.Image:
    """Return img as RGBA with the border-reachable background made transparent.

    The flood spreads across BOTH checker tones (they are adjacent and both
    pass is_background), so the whole checkerboard drains from the frame edges
    inward while enclosed whites — the shield's quadrants — survive.
    """
    w, h = img.size
    pixels = img.load()
    reachable = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not reachable[i] and is_background(pixels[x, y]):
                reachable[i] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not reachable[i] and is_background(pixels[x, y]):
                reachable[i] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not reachable[i] and is_background(pixels[nx, ny]):
                    reachable[i] = 1
                    queue.append((nx, ny))

    out = img.convert("RGBA")
    alpha = out.getchannel("A").copy()
    alpha_pixels = alpha.load()
    cleared = 0
    for y in range(h):
        for x in range(w):
            if reachable[y * w + x]:
                alpha_pixels[x, y] = 0
                cleared += 1
    out.putalpha(alpha)
    print(f"  keyed {w}x{h}: {cleared} of {w * h} px transparent")
    return out


def feather(img: Image.Image) -> Image.Image:
    """Soften the cut edge by ~1 px so JPEG stair-stepping does not halo."""
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(FEATHER_PX))
    return Image.merge("RGBA", (r, g, b, a))


def trim(img: Image.Image) -> Image.Image:
    """Crop to the mark's bounding box plus a small transparent margin."""
    solid = img.getchannel("A").point(
        lambda a: 255 if a > ALPHA_BBOX_THRESHOLD else 0
    )
    bbox = solid.getbbox()
    if bbox is None:
        raise SystemExit("keying removed everything — check the source JPEG")
    left, top, right, bottom = bbox
    left = max(0, left - TRIM_PAD_PX)
    top = max(0, top - TRIM_PAD_PX)
    right = min(img.width, right + TRIM_PAD_PX)
    bottom = min(img.height, bottom + TRIM_PAD_PX)
    return img.crop((left, top, right, bottom))


def fit_to_height(img: Image.Image, height: int) -> Image.Image:
    width = round(img.width * height / img.height)
    return img.resize((width, height), Image.LANCZOS)


def contain_on_canvas(
    img: Image.Image,
    box: int,
    size: tuple[int, int],
    background: tuple[int, int, int, int] | None,
) -> Image.Image:
    """Scale img to fit inside box x box, centered on a size x size canvas."""
    scale = min(box / img.width, box / img.height)
    scaled = img.resize(
        (round(img.width * scale), round(img.height * scale)), Image.LANCZOS
    )
    canvas = Image.new("RGBA", size, background or (0, 0, 0, 0))
    canvas.paste(
        scaled,
        ((size[0] - scaled.width) // 2, (size[1] - scaled.height) // 2),
        scaled,
    )
    return canvas


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")
    print(f"wrote {path.relative_to(REPO_ROOT)}  {img.size[0]}x{img.size[1]}")


def main() -> None:
    k3 = feather(key_border_connected(load_rgb(SOURCES["k3"])))
    kabupaten = feather(key_border_connected(load_rgb(SOURCES["kabupaten"])))

    k3_mark = trim(k3)
    kab_mark = trim(kabupaten)

    save(fit_to_height(k3_mark, HEADER_HEIGHT_PX), OUTPUTS["k3_header"])
    save(fit_to_height(kab_mark, HEADER_HEIGHT_PX), OUTPUTS["kabupaten_header"])
    save(
        contain_on_canvas(k3_mark, ICON_MARK_BOX_PX, ICON_SIZE_PX, None),
        OUTPUTS["icon"],
    )
    save(
        contain_on_canvas(
            k3_mark, APPLE_MARK_BOX_PX, APPLE_SIZE_PX, (255, 255, 255, 255)
        ),
        OUTPUTS["apple_icon"],
    )


if __name__ == "__main__":
    main()
