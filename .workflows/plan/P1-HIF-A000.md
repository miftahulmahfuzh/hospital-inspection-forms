> Adopted from `INSMOBILE_BRANDING_PLAN.md` phase 1. Source: `.workflows/plan/insmobile-branding/phase-1.md`.
> Written and reconciled by /analyze — edit the source, not this copy.

# Phase 1: InsMobile wordmark + K3 & Kabupaten Lima Puluh Kota logos across the app

**Plan set:** `INSMOBILE_BRANDING_PLAN.md`
**Analysis:** `20260911-105646_code_analyzer.md`
**Satisfies:** R1 (InsMobile name in the dashboard/app), R2 (K3 + Kabupaten Lima Puluh Kota logos on the site)
**Depends on:** none
**Difficulty:** NORMAL
**Package:** `src/` (components, app routes), `scripts/`, `brand/`, `src/assets/`

---

## Goal

The app is visibly branded **InsMobile**: the shared `SiteHeader` on all five routes (including `/admin`) shows the two institutional marks next to an "InsMobile" wordmark, metadata titles/icon carry the name, the landing hero and footer say InsMobile, and the exported `.xlsx` names InsMobile as its creator. The two source JPEGs — one on plain white, one on a **baked-in checkerboard** — are committed under `brand/` and deterministically converted to clean transparent PNGs by a committed, re-runnable PIL script.

### Deviations from the coordinator's brief — the docs/cascade win, as instructed

1. **`preload`, not `priority`.** The brief said `priority` on the header images. `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md:291-293` (Next 16.3.4, resolved from the primary checkout at `/home/miftah/hospital-inspection-forms/node_modules/...`; the worktree has no `node_modules` yet): *"Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property."* The plan uses `preload`, the direct successor with the same eager-loading semantics.
2. **A `.wordmark` class, not `normal-case`.** The brief suggested `normal-case` as the uppercase opt-out. It cannot work in this codebase: Tailwind v4 puts utilities in `@layer utilities` (`node_modules/tailwindcss/index.css` declares `@layer theme, base, components, utilities`), while `.signage` (`src/app/globals.css:71-77`) is written *after* the `@import "tailwindcss"` as plain **unlayered** CSS — and unlayered author declarations beat layered ones in the cascade regardless of order or specificity. `className="signage normal-case"` would still render "INSMOBILE". The plan adds an unlayered `.wordmark { text-transform: none; }` *after* `.signage` in globals.css, which wins on source order.
3. **`brand/` copies keep the sources' real filenames** — `brand/logo-kabupaten-lima-puluh-kota.jpeg`, not a shortened name. The generated header PNG uses the index's exact name `src/assets/logo-lima-puluh-kota.png`.

Both source files were probed for this plan (read-only, via Pillow 12.3.0 on system `python3`):
- `logo-k3.jpeg` — 1024x576 RGB, plain-white background (corners `255,255,255`); mark bbox after white-keying: 536x519 px.
- `logo-kabupaten-lima-puluh-kota.jpeg` — 554x554 RGB, checkerboard of ~`254` white and ~`221-226` gray squares (~13-14 px cells); border-connected flood fill with the bounds below removes 67.2% of pixels, preserves 19,480 interior white pixels (the shield's white quadrants), leaves exactly **1** connected content component (no stray JPEG specks), content bbox 330x387 px.

## Interface Contract

The reconciler reads this section to detect cross-phase conflicts. This is a single-phase set; the contract documents the blast radius anyway.

**Deletes:** nothing.
**Renames:** nothing. No symbol renames, no string->symbol moves.
**Creates:**
- `brand/logo-k3.jpeg`, `brand/logo-kabupaten-lima-puluh-kota.jpeg` — committed copies of Arif's untracked originals (copied, never moved)
- `scripts/make-brand-assets.py` — re-runnable asset pipeline
- `src/assets/logo-k3.png` (132x128), `src/assets/logo-lima-puluh-kota.png` (110x128) — transparent header marks, statically imported (dimensions validated by running the script)
- `src/app/icon.png` (128x128, K3 mark on transparent), `src/app/apple-icon.png` (180x180, K3 mark on white) — Next 16 metadata file conventions
- `.wordmark` CSS class (`src/app/globals.css`, unlayered, `text-transform: none`)
**Signature changes:** none — `SiteHeader({ right }: { right?: React.ReactNode })` keeps its props and its `Link href="/"` behavior; all five consumers (`page.tsx`, `admin/page.tsx`, `admin/login/page.tsx`, `forms/[slug]/page.tsx`, `not-found.tsx`) compile unchanged.
**Requires (from earlier phases):** none.
**Leaves alone (owned by others / out of scope):** `src/app/favicon.ico` (KEPT byte-for-byte, still the only `.ico`); `src/app/admin/page.tsx` and `admin/login/page.tsx` (their titles flow through the new template — no edit); `src/lib/forms.ts`; `scripts/seed-demo.mjs`; `docs/screenshots/*`; DB schema, auth, API request/response shapes; Arif's originals at `/home/miftah/hospital-inspection-forms/logo-*.jpeg`; the export *filename* `Inspeksi-K3RS_${stamp}.xlsx` (`route.ts:112` — only `workbook.creator` is in scope).

## Files

| File | Action | What changes |
|---|---|---|
| `brand/logo-k3.jpeg` | create (copy) | byte copy of `/home/miftah/hospital-inspection-forms/logo-k3.jpeg` |
| `brand/logo-kabupaten-lima-puluh-kota.jpeg` | create (copy) | byte copy of `/home/miftah/hospital-inspection-forms/logo-kabupaten-lima-puluh-kota.jpeg` |
| `scripts/make-brand-assets.py` | create | complete PIL pipeline (key -> feather -> trim -> resize -> 4 outputs) |
| `src/assets/logo-k3.png` | create (generated) | K3 mark, transparent, 128 px tall — committed |
| `src/assets/logo-lima-puluh-kota.png` | create (generated) | kabupaten arms, transparent, 128 px tall — committed |
| `src/app/icon.png` | create (generated) | 128x128, K3 mark on transparent — committed; `favicon.ico` kept |
| `src/app/apple-icon.png` | create (generated) | 180x180, K3 mark on white — committed |
| `src/app/globals.css` | modify | add unlayered `.wordmark` after `.signage` (after line 77) |
| `src/components/SiteHeader.tsx` | modify | full rewrite: both logos + InsMobile wordmark + new eyebrow |
| `src/app/layout.tsx` | modify | metadata title.default / title.template / description (lines 22-29) |
| `src/app/page.tsx` | modify | hero eyebrow (line 18) + footer line (lines 77-80) |
| `src/app/api/admin/export/route.ts` | modify | `workbook.creator` (line 39) |
| `README.md` | modify | title (line 1) + one-line name note |

## Implementation Steps

### Step 1: Copy Arif's source JPEGs into `brand/`
**File:** `brand/logo-k3.jpeg`, `brand/logo-kabupaten-lima-puluh-kota.jpeg` (new)
**Change:** Copy — never move — from the primary checkout where the untracked originals live. They do not exist in this worktree.
**Code:**
```bash
cd /home/miftah/.worktrees/hospital-inspection-forms/insmobile-branding
mkdir -p brand
cp /home/miftah/hospital-inspection-forms/logo-k3.jpeg brand/logo-k3.jpeg
cp /home/miftah/hospital-inspection-forms/logo-kabupaten-lima-puluh-kota.jpeg \
   brand/logo-kabupaten-lima-puluh-kota.jpeg
# originals must still exist afterwards — copy semantics proof:
ls -la /home/miftah/hospital-inspection-forms/logo-k3.jpeg \
       /home/miftah/hospital-inspection-forms/logo-kabupaten-lima-puluh-kota.jpeg
cmp /home/miftah/hospital-inspection-forms/logo-k3.jpeg brand/logo-k3.jpeg
cmp /home/miftah/hospital-inspection-forms/logo-kabupaten-lima-puluh-kota.jpeg \
    brand/logo-kabupaten-lima-puluh-kota.jpeg
```
**Impact:** Two new committed files; primary checkout untouched. `.gitignore` needs no change (nothing ignores `brand/`).

### Step 2: Write the asset pipeline `scripts/make-brand-assets.py`
**File:** `scripts/make-brand-assets.py` (new)
**Change:** Complete script below. Keying is a **border-connected flood fill across both checker tones** (near-neutral AND light covers ~254 white squares, ~221-226 gray squares, and the K3 white field) — a global near-white threshold is wrong (gray squares survive) and a global light-pixel threshold is wrong (it eats the shield's white quadrants). Interior whites the flood cannot reach stay opaque. Then: 1 px alpha feather, trim to content bbox + 2 px pad, LANCZOS resize to explicit output sizes.
**Code:**
```python
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
```
**Impact:** New script, no build impact (not imported by the app). Running it is Step 3.

### Step 3: Run the pipeline and commit its outputs
**File:** `src/assets/logo-k3.png`, `src/assets/logo-lima-puluh-kota.png`, `src/app/icon.png`, `src/app/apple-icon.png` (new, generated)
**Change:** Generate, then verify determinism (a second run must be byte-identical on the same Pillow).
**Code:**
```bash
cd /home/miftah/.worktrees/hospital-inspection-forms/insmobile-branding
python3 scripts/make-brand-assets.py
sha256sum src/assets/*.png src/app/icon.png src/app/apple-icon.png > /tmp/brand-assets.sha
python3 scripts/make-brand-assets.py
sha256sum -c /tmp/brand-assets.sha   # all OK — re-runnable and deterministic
```
Expected (validated while planning — this exact script ran against the real sources): four files, header PNGs 128 px tall (k3 **132 px** wide, kabupaten **110 px** wide), `icon.png` 128x128 RGBA with transparency (corner alpha 0), `apple-icon.png` 180x180 opaque white. Kabupaten output corners fully transparent, shield quadrants opaque. `src/app/favicon.ico` is NOT touched.
**Impact:** The four PNGs are committed build inputs — `next build` does not regenerate them. Delete risk: none; regenerable from `brand/` any time.

### Step 4: Add the `.wordmark` override to globals.css
**File:** `src/app/globals.css:77` (insert immediately after the `.signage { ... }` block that ends on line 77)
**Change:** An unlayered class, later in source order than `.signage`, that returns `text-transform` to `none`. Same specificity, same (un)layered status, later order -> wins. Do NOT "simplify" this to a Tailwind `normal-case` utility — see the Deviations section for why that loses the cascade.
**Code:**
```css
/*
 * Header wordmark keeps its camelCase. .signage uppercases everything it
 * touches, and a Tailwind utility cannot override it: every rule in this file
 * is unlayered, and unlayered declarations beat @layer utilities (where
 * `normal-case` lives) regardless of order. Same trick, then — unlayered,
 * declared after .signage, so it wins on source order.
 */
.wordmark {
  text-transform: none;
}
```
**Impact:** One new class; nothing else in the file changes. `.rail { top: 5.5rem }` (globals.css:86-90) and `scroll-padding-top: 5.5rem` (globals.css:28-32) are untouched — the header must stay within their 5.5rem budget (see Step 5 impact math).

### Step 5: Rewrite `SiteHeader.tsx` — logos + InsMobile wordmark
**File:** `src/components/SiteHeader.tsx:1-15` (whole file replaced)
**Change:** Both marks left of the wordmark — kabupaten arms first, then K3 gear (institution, then subject matter, the standard Indonesian government document pairing) — as `next/image` **static imports** from `src/assets/`, `h-7` (28 px), `preload` (Next 16 spelling of the deprecated `priority`; see Deviations), `alt=""` (decorative: the wordmark carries the meaning, per the image.md accessibility guidance). The existing `right` prop, `Link href="/"`, `bg-surface`/`border-rule` styling, `max-w-5xl` and `px-5 py-3.5` rhythm are kept. The eyebrow becomes "Inspeksi K3RS · RSUD dr. Achmad Darwis".
**Code:**
```tsx
import Image from "next/image";
import Link from "next/link";

import logoK3 from "@/assets/logo-k3.png";
import logoKabupaten from "@/assets/logo-lima-puluh-kota.png";

// Both institutional marks sit left of the wordmark: kabupaten arms first, then
// the K3 gear — institution, then subject matter. `preload` (not `priority`,
// which Next 16 deprecates) keeps the brand chrome out of the lazy-load path;
// alt="" because the wordmark next to them carries the meaning.
export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center gap-2">
            <Image src={logoKabupaten} alt="" className="h-7 w-auto" preload />
            <Image src={logoK3} alt="" className="h-7 w-auto" preload />
          </span>
          <span className="flex items-baseline gap-2.5">
            {/* .wordmark (unlayered, after .signage in globals.css) wins the
                cascade over .signage's uppercase — "InsMobile", never
                "INSMOBILE". */}
            <span className="signage wordmark text-lg text-ink">InsMobile</span>
            <span className="eyebrow hidden sm:inline">
              Inspeksi K3RS · RSUD dr. Achmad Darwis
            </span>
          </span>
        </Link>
        {right}
      </div>
    </header>
  );
}
```
**Impact:** Renders on all five routes. Height budget: tallest row item is the 28 px logo strip; 28 px content + 2x14 px (`py-3.5`) = **56 px <= 88 px (5.5rem)** — `.rail`'s `top` and `scroll-padding-top` stay correct. Width at 360 px: 320 px content after `px-5`; logos ~24 + ~29 px + 8 px gap + 10 px gap + "InsMobile" ~85 px = ~156 px, plus the `right` slot (max ~90 px) — no overflow; the eyebrow is `hidden` below `sm` exactly as before. Static imports give Next the intrinsic dimensions, so no `width`/`height` props are needed and no layout shift occurs.

### Step 6: Rebrand root metadata in `layout.tsx`
**File:** `src/app/layout.tsx:22-29`
**Change:** Replace the `metadata` export only. Everything else in the file (fonts, viewport, JSX) stays byte-identical.
**Code:**
```tsx
export const metadata: Metadata = {
  title: {
    default: "InsMobile · Inspeksi K3RS",
    template: "%s · InsMobile",
  },
  description:
    "InsMobile — sistem inspeksi mobile K3RS RSUD dr. Achmad Darwis. Formulir lingkungan kerja, kondisi APAR, dan sarana tanggap darurat.",
};
```
**Impact:** `/` renders `<title>InsMobile · Inspeksi K3RS</title>`; `/admin` becomes "Rekap admin · InsMobile" via the existing `title: "Rekap admin"`; login becomes "Masuk admin · InsMobile"; form pages become "<Form title> · InsMobile". `icon.png`/`apple-icon.png` are picked up purely by file convention — no config export needed (app-icons.md, Image files section). `favicon.ico` link is emitted alongside.

### Step 7: Landing page strings in `page.tsx`
**File:** `src/app/page.tsx:18` and `src/app/page.tsx:76-81`
**Change:** Exact JSX diffs — hero eyebrow gains the "InsMobile · " prefix; footer line gains the "InsMobile · " prefix.
**Code (line 18):**
```tsx
          <p className="eyebrow">InsMobile · Komite K3RS · Formulir Pemeriksaan</p>
```
**Code (lines 76-81, footer block):**
```tsx
      <footer className="mx-auto max-w-5xl px-5 pb-10">
        <p className="text-xs text-ink-soft">
          InsMobile · Komite Kesehatan dan Keselamatan Kerja Rumah Sakit · RSUD
          dr. Achmad Darwis
        </p>
      </footer>
```
**Impact:** Copy-only. The `eyebrow` class uppercases visually (intended — eyebrows are uppercase by design); the footer is plain lowercase text.

### Step 8: Export workbook creator
**File:** `src/app/api/admin/export/route.ts:39`
**Change:** One line.
**Code:**
```ts
    workbook.creator = "InsMobile · RSUD dr. Achmad Darwis";
```
**Impact:** Downloaded `.xlsx` file properties show the new creator. Deliberately untouched: the download *filename* `Inspeksi-K3RS_${stamp}.xlsx` on line 112 (see Handoffs). API request/response shapes unchanged.

### Step 9: README title + name note
**File:** `README.md:1-5`
**Change:** Retitle and add the one-line provenance note (README is in Indonesian; keep the rest of the file byte-identical).
**Code:**
```markdown
# InsMobile (Inspeksi K3RS)

Nama **InsMobile** (inspeksi mobile) adalah nama sistem ini dalam Rancangan
Aktualisasi Arif Rahman Hakim — PD CPNS Kabupaten Lima Puluh Kota 2026.

Website pemeriksaan K3RS untuk **RSUD dr. Achmad Darwis**. Tiga formulir
diisi dari ponsel saat ronde, tersimpan di Neon Postgres, dan direkap di
`/admin` dengan unduhan Excel.
```
**Impact:** Doc-only. The existing screenshot images referenced further down still show the old header — accepted (see Handoffs).

## Verification

**Setup (one-time, this worktree):** the worktree has no `node_modules` yet — run `npm install` in the worktree root before anything else (`next build` also generates the gitignored `next-env.d.ts` that types the static PNG imports). Pillow is already on system `python3`.

**Build:**
```bash
cd /home/miftah/.worktrees/hospital-inspection-forms/insmobile-branding
npm install
npm run build
```
**Tests (no test suite exists; lint is the gate):**
```bash
npm run lint
```
**Manual check** (`npm run dev`, then — DB-dependent pages need `.env.local`; if the dashboard errors on DB, the header/title checks still stand):
1. `/admin` (logged in) — header shows kabupaten arms, then K3 gear, then the wordmark **"InsMobile"**, with the "Inspeksi K3RS · RSUD dr. Achmad Darwis" eyebrow on >= sm viewports.
2. Browser tab on `/admin` reads **"Rekap admin · InsMobile"**; on `/` reads "InsMobile · Inspeksi K3RS"; on a form page reads "<Formulir> · InsMobile".
3. The kabupaten mark shows **no checkerboard** — zoom to 200%: gray squares gone, the shield's white quadrants intact, on the white header surface and on the `--color-paper` background.
4. The wordmark reads **"InsMobile"**, not "INSMOBILE" (case check in devtools computed style: `text-transform: none`).
5. At **360 px** viewport width: no horizontal scrollbar/overflow anywhere in the header on `/` and `/admin`.
6. Measure the header element's bounding box in devtools: **<= 88 px (5.5rem)** tall; the sticky rail on a form page still aligns under it when scrolling.
7. Favicon in the tab is the K3 mark (PNG); `/favicon.ico` still resolves; view-source shows both the `favicon.ico` link and the generated `/icon` link; `/apple-icon.png` returns 180x180 white-backed.
8. On `/`: hero eyebrow reads "InsMobile · Komite K3RS · Formulir Pemeriksaan"; footer starts with "InsMobile · ".
9. From `/admin`, download the Excel export and check file properties: creator = "InsMobile · RSUD dr. Achmad Darwis".
10. `git status` in the **primary checkout** (`/home/miftah/hospital-inspection-forms`) shows no changes — originals only ever read.
11. Commit contents: `brand/` (2 JPEGs), `scripts/make-brand-assets.py`, `src/assets/` (2 PNGs), `src/app/icon.png`, `src/app/apple-icon.png`, the 5 modified files, and NOT `next-env.d.ts` (gitignored).

**Exit criteria:** the index's Phase 1 exit line holds — dashboard, login, landing, form pages and 404 all show the InsMobile wordmark with both logos in a clean white header; tab title/metadata carry InsMobile; icons derive from the K3 mark; exported `.xlsx` creator reads "InsMobile · RSUD dr. Achmad Darwis"; and `npm run build` + `npm run lint` pass with invariants 1-6 intact.

## Handoffs

- **`docs/screenshots/*` are stale the moment this lands** (they show "Inspeksi K3RS", no logos). Re-shooting needs seed data + screenshot tooling and is explicitly out of scope for this set — flag to the user; README's "Tampilan"/admin sections display them.
- **Export filename** `Inspeksi-K3RS_${stamp}.xlsx` (`src/app/api/admin/export/route.ts:112`) still uses the old product name. Scope named only `workbook.creator`, so it stays; if Arif wants the downloaded file renamed too, it is a one-line follow-up.
- **Mentor's revised questions**: still nothing to plan against (content never shared) — when Arif lists them, run a new `/analyze`; they touch `src/lib/forms.ts`, which this phase must not touch.
- **Assumptions about other phases:** none — this is the only phase; nothing here expects prior work.

## Rollback

Single phase on its own branch: `git revert <phase commit>` (or `git checkout main -- README.md src/ && rm -rf brand src/assets scripts/make-brand-assets.py src/app/icon.png src/app/apple-icon.png`) restores the previous branding byte-for-byte. Every created file is additive (nothing moved, nothing deleted, `favicon.ico` untouched), and the primary checkout's root files are never written, so there is nothing to restore outside the branch. `src/assets/` and `brand/` can be removed wholesale — only `SiteHeader.tsx` imports from them, and it reverts with the same commit.
