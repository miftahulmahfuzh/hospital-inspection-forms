# Package: hospital-inspection-forms (InsMobile)

**Location**: `.` (repository root — single-package Next.js app)
**Last Updated**: 2026-09-11 11:30 WIB
**Documentation Created**: 2026-09-11 11:30 WIB (initial creation, after task P1-HIF-A000)

## Overview

InsMobile (inspeksi mobile) is a Next.js 16 App Router application for the K3RS
(Komite Kesehatan dan Keselamatan Kerja Rumah Sakit) program of RSUD dr. Achmad
Darwis, Kabupaten Lima Puluh Kota. It replaces three Google Forms: inspectors
fill three checklists from a phone during ward rounds, answers persist in Neon
Postgres, and an admin dashboard recaps findings with an Excel download. The
app is branded InsMobile, with the K3 and Kabupaten Lima Puluh Kota
institutional logos rendered from committed PNG assets that are regenerated
from source JPEGs by a committed Python pipeline.

**Key Responsibilities:**
- Render the three inspection forms (`/forms/[slug]`) as a phone-first tap-to-answer UI with per-device progress persistence
- Accept and validate submissions server-side and store them in a single Neon Postgres table
- Gate an admin dashboard (`/admin`) behind a JWT session cookie and recap submissions/findings per date range
- Export all three forms' rows as a styled three-sheet `.xlsx` workbook
- Own the brand pipeline: source JPEGs under `brand/` → deterministic keying → committed transparent PNGs used by the header and app icons

## Not to be confused with README.md

The user-facing `README.md` at the repo root is written in Indonesian for the
hospital/K3RS audience (setup, env vars, deploy). This file is the
developer-facing package documentation maintained under `.workflows/`.

## Public Surface

### HTTP routes (Next.js App Router)

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/` | GET | public | Landing page: InsMobile hero, form chooser, footer |
| `/forms/[slug]` | GET | public | One checklist, statically generated for the three known slugs |
| `/admin` | GET | session | Recap dashboard; redirects to `/admin/login` when unauthenticated; `force-dynamic` |
| `/admin/login` | GET | public | Login form |
| `/api/submit` | POST | public | Validates and stores one submission; returns `{ ok, id }` (201) or `{ error }` |
| `/api/admin/login` | POST | public | Checks credentials, sets the `k3rs_admin` JWT cookie |
| `/api/admin/logout` | POST | n/a | Clears the cookie, 303 redirect to `/admin/login` |
| `/api/admin/export` | GET | session | Streams a three-sheet `.xlsx`; `force-dynamic`, honors `?from`/`?to` |

`[slug]` is pre-rendered via `generateStaticParams` over `FORMS`; unknown slugs 404.

### Shared modules (`src/lib`)

- `db.ts` — `sql` (Neon HTTP client bound at module load from `DATABASE_URL`, falling back to `DATABASE_URL_UNPOOLED`), `SubmissionRow` type, `ensureSchema()` (memoized `CREATE TABLE IF NOT EXISTS` + two indexes; retried on next request if it fails)
- `auth.ts` — `SESSION_COOKIE` (`"k3rs_admin"`), `checkCredentials()`, `createSessionToken()` (HS256, 12 h), `verifySessionToken()`, `sessionCookieOptions` (httpOnly, lax, secure in production), `isAuthenticated()` (server components/route handlers only — reads `next/headers` cookies)
- `forms.ts` — `QuestionType`, `Question`, `Section`, `FormDef` types; `FORMS` (the three checklists, question ids carried over from the original Google `entry.<id>` numbers), `FORM_BY_SLUG`, `getForm()`, `allQuestions()` (flat display/column order), `FINDING_VALUES` (`{"Tidak", "Rusak"}`), `countFindings()`
- `queries.ts` — `DateRange`, `parseRange()` (falls back to open bounds `1900-01-01`/`9999-12-31` on absent or malformed input), `isOpenRange()`, `FormSummary`, `getSummary()`, `getRecent()` (default limit 50), `getAllForForm()` (oldest first — export row order). All date/timestamp columns are cast to strict ISO strings because the Neon driver returns `Date` objects that mis-serialize across the server/client boundary.

### Shared components (`src/components`)

- `SiteHeader` — `{ right?: ReactNode }`; renders the kabupaten arms then the K3 mark (institution, then subject matter) next to the "InsMobile" wordmark; used by all five page routes. Images use `preload` (`priority` is deprecated in Next 16) and `alt=""` because the adjacent wordmark carries the meaning.
- `InspectionForm` — client component; localStorage-backed answer draft per form, evacuation-rail section progress, submits to `/api/submit`, clears storage on success.
- `LoginForm` — client component for `/admin/login`.

### Brand assets

- Sources of truth (committed copies of Arif's originals — copied, never moved): `brand/logo-k3.jpeg`, `brand/logo-kabupaten-lima-puluh-kota.jpeg`
- Generated, committed, and statically imported by `SiteHeader`: `src/assets/logo-k3.png`, `src/assets/logo-lima-puluh-kota.png`
- Generated, committed, and picked up by Next's metadata file conventions: `src/app/icon.png` (favicon) and `src/app/apple-icon.png` (iOS icon)

## Internal Architecture

### Brand asset pipeline (`scripts/make-brand-assets.py`)

Regenerates all four PNGs deterministically; re-run only when a source JPEG changes:

```
python3 scripts/make-brand-assets.py    # requires Pillow >= 10, no network
```

Pipeline per source: load RGB → **border-connected flood-fill key** → 1 px alpha feather → trim to content bbox (+2 px pad) → resize. The keying is the non-obvious part:

- `logo-k3.jpeg` sits on plain white; `logo-kabupaten-lima-puluh-kota.jpeg` is a transparent PNG that was saved as JPEG, so its transparency became a baked-in light-gray/white checkerboard.
- Neither responds to a global near-white threshold (the checker's gray squares survive) nor to `mix-blend-mode` tricks. A global light-pixel test would also delete the white quadrants painted inside the kabupaten shield.
- The key instead floods inward from every frame-edge pixel through pixels that are both near-neutral (max−min channel ≤ 14) and light (mean channel ≥ 192). This drains both checker tones (~254 white, ~221–226 gray) and the K3 white field, while white the flood cannot reach — the shield's quadrants, the gear's cut-outs — stays opaque.

Outputs: header marks at 128 px tall (`logo-k3.png` 132x128, `logo-lima-puluh-kota.png` 110x128), a 128x128 transparent favicon (K3 mark in a 104 px box), and a 180x180 apple icon (K3 mark in a 132 px box on opaque white).

### Request data flow

- **Submission**: `InspectionForm` (localStorage draft) → `POST /api/submit` → rebuild the answer map strictly from the `FormDef` (unknown keys dropped, options/date/length validated, required enforced) → `ensureSchema()` → insert with `findings = countFindings(answers)` → `RETURNING id`.
- **Admin read**: `/admin` server component → `isAuthenticated()` → `getSummary()` + `getRecent()` in parallel → per-form totals and the 50 most recent rows; the chosen date range is forwarded into the export link.
- **Export**: `GET /api/admin/export` → auth check → per form, `getAllForForm()` → ExcelJS sheet (frozen header row, themed ink header, alarm/safe cell coloring for `Tidak`/`Rusak` vs `Ya`/`Baik`, date answers stored as real dates with `yyyy-mm-dd` format, `submitted-at` written as a preformatted WIB string) → streamed attachment `Inspeksi-K3RS_<range>.xlsx` with `workbook.creator = "InsMobile · RSUD dr. Achmad Darwis"`.
- **Brand**: `brand/*.jpeg` → `make-brand-assets.py` → committed PNGs → static imports and Next metadata icons. Nothing at runtime reads `brand/`.

### Form definition as the spine

`src/lib/forms.ts` was generated from the original Google Forms HTML and is now the single source of truth consumed by rendering, validation, persistence (question ids are the JSONB keys), admin summary, and export column order. Question ids must never be reused or changed — old data binds to its columns through them.

## Dependencies

### Runtime (npm)

- `next` 16.3.4 — framework; note the repo's AGENTS.md warning that this Next.js differs from training data; consult `node_modules/next/dist/docs/` before writing framework code
- `react` / `react-dom` 19.2.8
- `@neondatabase/serverless` — Neon over HTTP; the pooled integration URL is expected
- `exceljs` — `.xlsx` generation in the export route
- `jose` — HS256 session JWT sign/verify

### Dev

- `tailwindcss` 4 via `@tailwindcss/postcss` (theme tokens declared in `@theme` inside `globals.css`), `eslint` + `eslint-config-next`, `typescript`

### Brand pipeline (Python)

- `Pillow` ≥ 10 (system `python3` had 12.3.0) — the only non-npm toolchain; Node is deliberately not used for imaging

### Project-internal module graph

`components` and `app` import only from `src/lib` (plus `next/image`, `next/link`, `next/navigation`); `lib/queries` builds on `lib/db`; nothing outside `src/` is imported at runtime.

## Reverse Dependencies (consumers within the repo)

- `SiteHeader` — consumed by all five routes (`/`, `/forms/[slug]`, `/admin`, `/admin/login`, 404); rebranding it rebrands everything at once
- `lib/forms` — consumed by `/` (chooser), `/forms/[slug]` (params + metadata), `InspectionForm` (render/validation hints), `/api/submit` (validation), `/api/admin/export` (sheet/column shape), `/admin` (titles)
- `lib/db` — consumed by `lib/queries`, `/api/submit`
- `lib/auth` — consumed by the three `/api/admin/*` routes and the `/admin` page guard
- `lib/queries` — consumed by `/admin` and `/api/admin/export`
- `scripts/make-brand-assets.py` — consumes only `brand/*.jpeg`; consumed by no runtime code (regeneration is a manual step)

## Concurrency

Not designed for concurrent use — a standard Next.js server handles requests; there are no worker threads, channels, or background jobs. The one synchronization concern is internal: `ensureSchema()` memoizes a single in-flight promise per process (`ensured ??=`), resetting it on failure so the next request retries; concurrent first requests share one schema-creation pass.

## Error Handling

- Route handlers return JSON `{ error }` with Indonesian messages: 400 for validation (including per-question messages from `/api/submit`), 401 for bad credentials or missing session, 500 for DB/export failures (logged with `console.error`, generic message to the client)
- Login failures are deliberately vague — one message whether the username or the password was wrong; credential comparison is constant-time and evaluates both fields so timing does not leak which half failed
- Missing configuration throws at module evaluation or call time with actionable messages (`db.ts` for `DATABASE_URL`, `auth.ts` for `SESSION_SECRET` < 32 chars and `ADMIN_USERNAME`/`ADMIN_PASSWORD`) — these surface as build/deploy errors, not runtime 200s
- No custom error classes, no sentinels, no panics-by-design; `make-brand-assets.py` exits with a message when a source is missing or keying removed everything

## Performance

- Form pages are statically generated; `/admin` and the export route are `force-dynamic`
- Neon's HTTP driver means one request per query — no pool to tune, but each query is a round trip; the admin page issues exactly two (summary + recent) in parallel
- Header logos are statically imported (Next emits dimension attributes and self-hosts them); `preload` keeps them out of the lazy-load path
- `make-brand-assets.py` is O(width×height) flood fill + a few LANCZOS resamples; it is a build-time tool, not on any request path

## Configuration and Initialization

| Env var | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon connection string (pooled); `DATABASE_URL_UNPOOLED` accepted as fallback |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | yes | `/admin` credentials |
| `SESSION_SECRET` | yes | HS256 signing key, ≥ 32 random characters |

Schema creation is automatic on first query — no migration step. npm scripts: `dev`, `build`, `start`, `lint`, `seed:demo` (inserts 9 demo submissions via `POST /api/submit` so they are validated like real ones; `--clean` removes only the ids it created; refuses to seed a non-empty table without `--force`). Note that `next build` itself requires `DATABASE_URL` because `db.ts` throws at module evaluation during page-data collection.

## Usage

### Local development

```bash
npm install
cp .env.example .env.local   # then fill in the four values
npm run dev
```

### Regenerating brand assets

```bash
python3 scripts/make-brand-assets.py
```

Run only after replacing a JPEG in `brand/`; review the header and icons visually before committing the four PNGs. The outputs are deterministic — identical inputs yield identical PNGs, so they are safe to commit.

### Rebranding surface map

Everything user-visible that names or marks the product lives in: `SiteHeader.tsx` (logos + wordmark), `layout.tsx` (`metadata.title` default + `%s · InsMobile` template, description), `page.tsx` (hero eyebrow, footer), `globals.css` (`.wordmark`), `api/admin/export/route.ts` (`workbook.creator`), and the four generated PNGs.

## Gotchas

- The wordmark must stay camelCase ("InsMobile", never "INSMOBILE"). `.signage` uppercases everything, and `normal-case` cannot override it: Tailwind v4 puts utilities in `@layer utilities` while every rule in `globals.css` is unlayered, and unlayered declarations beat layered ones regardless of order. The unlayered `.wordmark { text-transform: none }` declared after `.signage` is what wins.
- Use `preload`, not `priority`, on `next/image` — `priority` is deprecated as of Next.js 16.
- Never hand-edit `src/assets/*.png`, `icon.png`, or `apple-icon.png`; edit/regenerate from `brand/` instead. Likewise never move or delete Arif's original JPEGs — `brand/` holds copies.
- The kabupaten source's checkerboard means any future keying change must keep the border-connected flood approach; a global near-white threshold reintroduces checker squares, and a global light-pixel test erases the shield's white quadrants.
- Do not rename question ids in `forms.ts` — they are the JSONB keys binding stored answers to export columns. Add new questions with fresh ids only.
- `.field` keeps `min-width: 0` on purpose: iOS Safari gives form controls an intrinsic min-content width that would otherwise push date inputs past the page gutter. Removing it reintroduces that bug.
- The header must stay ≤ 5.5rem tall — `html` reserves exactly that as `scroll-padding-top` for the sticky rail.

## Notes

- Documentation created 2026-09-11 after task **P1-HIF-A000** (phase 1 of plan set `INSMOBILE_BRANDING_PLAN.md`, plan at `.workflows/plan/P1-HIF-A000.md`): the InsMobile rebrand. That task added the `brand/` pipeline (`make-brand-assets.py` and the two source JPEGs), generated the four PNGs, rebranded `SiteHeader`/metadata/landing footer/`.xlsx` creator, and added the `.wordmark` class. All changes were branding-only; no behavioral surface changed.
- Prior history (pre-branding): the app was scaffolded as the K3RS inspection site replacing three Google Forms; an earlier fix stopped iOS Safari date inputs overflowing their gutter.
- Upcoming phases of the plan set, if any, are tracked in `.workflows/todos.md`.
