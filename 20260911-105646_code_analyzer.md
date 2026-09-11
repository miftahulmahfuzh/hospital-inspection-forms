# Code Analysis: InsMobile branding + institutional logos

**Type:** Feature Implementation
**Date:** 2026-09-11 10:56 WIB
**Session ID:** 20260911-105646
**Plan:** `INSMOBILE_BRANDING_PLAN.md` (1 phase)
**Worktree:** `/home/miftah/.worktrees/hospital-inspection-forms/insmobile-branding` — branch `feature/insmobile-branding` (base `origin/main` @ d7c2aae)

---

## User Input

### Original User Request

> my little brother sent this through whatsapp (bang adek is me):
> [10:42 AM, 9/11/2026] Arif Rahman: assalamualaikum bang adek, setelah bimbingan sama mentor kemarin ada beberapa pertanyaan yang direvisi ternyata bang adek
> [10:43 AM, 9/11/2026] Arif Rahman: terus, arif kemarin bikin singkatannya InsMobile (inspeksi mobile). Kira kira bisa dimasukkan kata kata itu di dalam dashboard nya nanti bang adek?
>  @Rancangan Aktualisasi_4.1.2 Arif Rahman Hakim.pdf @PPT Rancangan Aktualisasi_4.1.2 Arif Rahman Hakim.pdf .
> [10:44 AM, 9/11/2026] Arif Rahman: itu proposal arif kemarin bang adek
> [10:51 AM, 9/11/2026] Arif Rahman: mau nambahin logo juga untuk itu bisa bang adek? ada logo kabupaten lima puluh kota nya sama logo k3
>  @logo-k3.jpeg @logo-kabupaten-lima-puluh-kota.jpeg .

### User-Provided Context

- Arif's mentor asked for revisions to "beberapa pertanyaan" after yesterday's bimbingan — **the revised questions themselves were not shared**, so nothing about them is actionable in this run.
- The proposal PDF (54 pages) and slide deck are in the repo root, untracked. The proposal's official title (extracted from pages 1–4): *"Digitalisasi Pencatatan, Pembuatan, dan Pelaporan Hasil Inspeksi K3RS Menggunakan Sistem Inspeksi Mobile (InsMobile) di RSUD dr. Achmad Darwis"* — an actualization project for Pelatihan Dasar CPNS Golongan III Angkatan IV, Kabupaten Lima Puluh Kota, 2026. "InsMobile" = "Sistem Inspeksi Mobile".

### User-Provided Files

- `logo-k3.jpeg` — 1024×576 progressive JPEG, green K3 gear-and-cross mark centered on a **plain white** background.
- `logo-kabupaten-lima-puluh-kota.jpeg` — 554×554 progressive JPEG of the regency arms, on a **baked-in checkerboard** — a transparent PNG that was saved as JPEG, so the "transparency" is literal gray/white squares in the pixels.
- `Rancangan Aktualisasi_4.1.2 Arif Rahman Hakim.pdf` — the proposal (read-only context).
- `PPT Rancangan Aktualisasi_4.1.2 Arif Rahman Hakim.pdf` — the deck (read-only context).

All four are **untracked** in git — a fresh worktree does not contain them; implementation must copy them in from the primary checkout.

### Requirement IDs

| ID | What the user asked for |
|---|---|
| R1 | Masukkan nama **InsMobile** (inspeksi mobile) ke dalam dashboard aplikasi |
| R2 | Tambahkan dua logo — **logo K3** dan **logo Kabupaten Lima Puluh Kota** — ke tampilan situs |

("Beberapa pertanyaan yang direvisi" dari mentor belum dirinci — bukan deliverable pada run ini; lihat Out of scope.)

---

## Detailed Requirements Understanding

**Problem/Requirement Statement**: The site is currently branded generically as "Inspeksi K3RS". Arif's actualization report names the system **InsMobile**, and his evaluation requires the delivered product (and its dashboard) to carry that name, plus the two institutional marks (K3 occupational-safety gear; Kabupaten Lima Puluh Kota arms) that also appear on his report cover. The brand name and both logos must appear in the app's chrome — header on every page (which includes the `/admin` dashboard), browser-tab metadata, landing page, and the exported Excel workbook's creator field.

**Success Criteria**:
- "InsMobile" is visibly the product name on `/admin` (dashboard), `/admin/login`, `/`, `/forms/*`, and 404 — i.e. everywhere `SiteHeader` renders.
- Both logos render beside the wordmark in the header, on the white header surface, with no checkerboard artifact from the kabupaten JPEG.
- Browser tab title carries InsMobile (`InsMobile · Inspeksi K3RS`, pages `… · InsMobile`); favicon/icon derive from the K3 mark.
- Brand casing "InsMobile" survives visually — the `.signage` class must NOT uppercase it.
- `npm run build` and `npm run lint` pass; no layout regression at 360 px phone width; sticky rail offsets unaffected.

**Key Considerations**:
- **Checkerboard is baked into the kabupaten JPEG.** Global white-threshold or `mix-blend-mode: multiply` will still show gray squares. The working approach is border-connected flood-fill keying (PIL 12.3.0 is installed): flood from the image border across both checker tones, keep interior whites (the "50" shield has white quadrants), feather 1 px, export RGBA PNG.
- **`.signage` uppercases.** Wordmark needs `normal-case` (or a non-`signage` treatment) to render "InsMobile" rather than "INSMOBILE".
- **Header height budget.** `.rail { top: 5.5rem }` and `scroll-padding-top: 5.5rem` assume the header stays ≤ 5.5rem tall. Logo height ≈ 28 px keeps it there; anything taller breaks rail alignment and anchor jumps.
- **Header surface is white** (`bg-surface`), so the K3 logo's white JPEG background is invisible there — but the kabupaten checkerboard would still show on white; keying is required regardless of surface.
- Next.js is **16.3.4** (newer than training data). Bundled docs confirm: `icon.(ico|jpg|jpeg|png|svg)` / `apple-icon.(jpg|jpeg|png)` file conventions in `app/**/*`; `next/image` with static imports unchanged. Docs live at `node_modules/next/dist/docs/01-app/…` (see Reference List).
- The two logos sit next to each other (institution + subject-matter), standard Indonesian government document pairing: regency arms left, K3 gear right of it, then the wordmark.
- Exported `.xlsx` already carries branding via `workbook.creator` — renaming it keeps downloaded artifacts consistent with the new name.

---

## Analysis Scope

### Explicitly Mentioned Files
- `logo-k3.jpeg` (repo root, untracked)
- `logo-kabupaten-lima-puluh-kota.jpeg` (repo root, untracked)
- `Rancangan Aktualisasi_4.1.2 Arif Rahman Hakim.pdf` (context only)
- `PPT Rancangan Aktualisasi_4.1.2 Arif Rahman Hakim.pdf` (context only)

### Discovered Related Files
- `src/components/SiteHeader.tsx` — the shared brand chrome; renders on all five routes
- `src/app/layout.tsx` — root metadata (title, template, description), fonts, theme color
- `src/app/page.tsx` — landing hero eyebrow + footer lines
- `src/app/admin/page.tsx` — the dashboard (gets branding via SiteHeader)
- `src/app/admin/login/page.tsx`, `src/app/forms/[slug]/page.tsx`, `src/app/not-found.tsx` — other SiteHeader consumers (no direct edits needed)
- `src/app/api/admin/export/route.ts` — `workbook.creator` branding stamp
- `src/app/favicon.ico` — existing 16/32 px icon (keep)
- `src/app/globals.css` — `.signage`, `.eyebrow`, palette tokens
- `next.config.ts` — empty config; no image domains needed (local assets only)
- `public/` — empty directory
- `README.md` — repo doc titled "Inspeksi K3RS"
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md` — icon file conventions (Next 16)
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` — next/image (Next 16)

---

## Current Dataflow

This is a render-time branding change; the only "data" is the metadata and the static assets.

### Entry Point: Root layout metadata
**Location:** `src/app/layout.tsx:22-33`
**Trigger:** every route render (static export of `<head>`)
**Output:** `<title>` "Inspeksi K3RS" / `%s · Inspeksi K3RS`; `<meta name="description">`; `theme-color #14261c`; `favicon.ico` link via file convention.

### Processing Chain: Brand chrome
1. **Component:** `SiteHeader({ right })`
   - **Location:** `src/components/SiteHeader.tsx:3-15`
   - **Render:** `bg-surface` bar, `max-w-5xl`, link `/` with `.signage` span "Inspeksi K3RS" + `.eyebrow` span "RSUD dr. Achmad Darwis" (hidden < sm), optional `right` slot (Admin link on `/`, Keluar button on `/admin`).
   - **Used by:** `page.tsx:8`, `admin/page.tsx:73`, `admin/login/page.tsx:15`, `forms/[slug]/page.tsx:33`, `not-found.tsx:7` — all five routes, including the dashboard.
2. **Landing copy:** `src/app/page.tsx:18` hero eyebrow "Komite K3RS · Formulir Pemeriksaan"; `page.tsx:76-81` footer "Komite Kesehatan dan Keselamatan Kerja Rumah Sakit · RSUD dr. Achmad Darwis".
3. **Export artifact:** `src/app/api/admin/export/route.ts:39` sets `workbook.creator = "Inspeksi K3RS · RSUD dr. Achmad Darwis"` on the downloaded `.xlsx`.

### Data Persistence
None affected. `submissions` table, auth cookies, and form schemas (`src/lib/forms.ts`) are untouched. `forms.ts:128` mentions "RSUD dr. Achmad Darwis" as a location inside a form description — correct as-is, no change.

### Exit Points
- Rendered `<head>` (title/description/icons) on all routes
- Header DOM on all five routes
- `.xlsx` creator metadata on `/api/admin/export`

---

## Key Data Structures

### Component: `SiteHeader`
**Location:** `src/components/SiteHeader.tsx:3`
**Props:** `{ right?: React.ReactNode }` — server component, no state.
**Used In:** all five route files listed above.

### Metadata object
**Location:** `src/app/layout.tsx:22-29`
**Fields:** `title.default`, `title.template`, `description`.

### Design tokens
**Location:** `src/app/globals.css:9-26` (`@theme`) — `--color-surface: #ffffff` (header bg), `--color-ink`, `--color-safe: #0f7a3d` (≈ K3 logo green #1e6b38-ish), `.signage` uppercase transform at `globals.css:71-77`.

---

## Dependencies

### Configuration / Environment / External Services
- **Next 16.3.4** — icon file conventions & `next/image` per bundled docs (paths above); no `next.config.ts` changes required for local static images.
- **PIL (Pillow) 12.3.0** — installed on this machine; available for the one-time logo-keying script. No ImageMagick/inkscape on PATH.
- **Vercel deployment** — `next/image` local optimization works unconfigured.
- No DB, env var, or API contract changes.

---

## Reference List

| Symbol / string | File:line | Kind | Notes |
|---|---|---|---|
| `Inspeksi K3RS` (title.default) | `src/app/layout.tsx:24` | config | → InsMobile rebrand |
| `%s · Inspeksi K3RS` (title.template) | `src/app/layout.tsx:25` | config | → `%s · InsMobile` |
| description "Formulir inspeksi K3RS RSUD…" | `src/app/layout.tsx:27-28` | config | prefix InsMobile |
| `Inspeksi K3RS` header wordmark | `src/components/SiteHeader.tsx:8` | def | becomes InsMobile wordmark + logos |
| `RSUD dr. Achmad Darwis` eyebrow | `src/components/SiteHeader.tsx:9` | def | becomes "Inspeksi K3RS · RSUD dr. Achmad Darwis" |
| `SiteHeader` import | `src/app/page.tsx:3`, `src/app/admin/page.tsx:13`, `src/app/admin/login/page.tsx:4`, `src/app/forms/[slug]/page.tsx:4`, `src/app/not-found.tsx:2` | call | consumers; no signature change planned |
| `Komite K3RS · Formulir Pemeriksaan` hero eyebrow | `src/app/page.tsx:18` | def | prepend InsMobile |
| footer "Komite Kesehatan dan K3…" | `src/app/page.tsx:76-81` | def | prepend InsMobile |
| `workbook.creator` | `src/app/api/admin/export/route.ts:39` | def | → "InsMobile · RSUD dr. Achmad Darwis" |
| `favicon.ico` | `src/app/favicon.ico` | config | keep; add `icon.png`/`apple-icon.png` beside it |
| `# Inspeksi K3RS` | `README.md:1`, `README.md:3` | doc | retitle + name note |
| `.signage` (uppercase) | `src/app/globals.css:71-77` | def | wordmark must opt out via `normal-case` |
| `--color-surface` | `src/app/globals.css:11` | config | header surface (white) logos sit on |
| `.rail { top: 5.5rem }` / `scroll-padding-top` | `src/app/globals.css:87-89, 28-32` | config | header-height budget ≤ 5.5rem |
| RSUD mention in APAR form description | `src/lib/forms.ts:128` | doc | location reference — unchanged |
| `logo-k3.jpeg`, `logo-kabupaten-lima-puluh-kota.jpeg` | repo root | asset | untracked; copy into `brand/` and commit |

---

## Impact Points (files that WILL need changes)

1. `scripts/make-brand-assets.py` (new) — deterministic PIL pipeline: key checkerboard/white → alpha, trim, resize, emit `src/assets/logo-k3.png`, `src/assets/logo-lima-puluh-kota.png`, `src/app/icon.png`, `src/app/apple-icon.png`; consumes copies of the JPEGs in `brand/` — phase 1
2. `brand/logo-k3.jpeg`, `brand/logo-lima-puluh-kota.jpeg` (new, committed copies of Arif's originals; originals at root left untouched) — phase 1
3. `src/assets/logo-k3.png`, `src/assets/logo-lima-puluh-kota.png` (new, generated) — phase 1
4. `src/app/icon.png`, `src/app/apple-icon.png` (new, generated; `favicon.ico` kept) — phase 1
5. `src/components/SiteHeader.tsx` — logos + InsMobile wordmark — phase 1
6. `src/app/layout.tsx` — metadata rebrand — phase 1
7. `src/app/page.tsx` — hero eyebrow + footer — phase 1
8. `src/app/api/admin/export/route.ts` — workbook.creator — phase 1
9. `README.md` — title + name note — phase 1

**Explicitly not impacted:** DB schema, auth, form schemas/questions, API contracts, seed script, `docs/screenshots/*` (they will show the old header until re-shot — accepted, see plan Out of scope).

**This document describes. The plan files prescribe.**
