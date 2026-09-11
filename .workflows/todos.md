# Todos: hospital-inspection-forms

**Package Path**: `.`
**Package Code**: HIF
**Last Updated**: 2026-09-11 11:27
**Total Active Tasks**: 0

## Quick Stats
- P0 Critical: 0
- P1 High: 0
- P2 Medium: 0
- P3 Low: 0
- P4 Backlog: 0
- Blocked: 0
- Completed: 1

---

## Active Tasks

### [P0] Critical

### [P1] High

### [P2] Medium

### [P3] Low

### [P4] Backlog

### 🚫 Blocked

---

## Completed Tasks

### [P1] High
- [x] **P1-HIF-A000** Phase 1: InsMobile wordmark + K3 & Kabupaten Lima Puluh Kota logos across the app
  - **Difficulty**: NORMAL
  - **Type**: Feature
  - **Context**: Owns the brand asset pipeline (key + trim + resize the two JPEGs → committed PNGs) and all branding surfaces: SiteHeader rebrand (logos + "InsMobile" wordmark) covering dashboard and every other route; root metadata (title/template/description); `icon.png` + `apple-icon.png`; landing hero eyebrow + footer; `.xlsx` `workbook.creator`; README title/note. Exit criteria: dashboard (`/admin`), login, landing, form pages and 404 all show the InsMobile wordmark with both logos in a clean white header; tab title/metadata carry InsMobile; icons derive from the K3 mark; exported `.xlsx` creator reads "InsMobile · RSUD dr. Achmad Darwis"; `npm run build` and `npm run lint` pass; wordmark reads "InsMobile" never "INSMOBILE"; kabupaten logo keyed border-connected (no checkerboard artifact); header ≤ 5.5rem tall, no horizontal overflow at 360px; no changes outside branding surfaces; Arif's original root JPEGs copied never moved/deleted.
  - **Status**: completed
  - **Plan Set**: `INSMOBILE_BRANDING_PLAN.md` (phase 1 of 1)
  - **Satisfies**: R1 — Masukkan nama InsMobile (inspeksi mobile) ke dalam dashboard aplikasi; R2 — Tambahkan logo K3 dan logo Kabupaten Lima Puluh Kota ke tampilan situs
  - **Depends on**: (none)
  - **Plan**: `.workflows/plan/P1-HIF-A000.md`
  - **Completed**: 2026-09-11 11:27
  - **Method**: /do
  - **Files**: README.md, src/app/api/admin/export/route.ts, src/app/globals.css, src/app/layout.tsx, src/app/page.tsx, src/components/SiteHeader.tsx, brand/logo-k3.jpeg, brand/logo-kabupaten-lima-puluh-kota.jpeg, scripts/make-brand-assets.py, src/assets/logo-k3.png, src/assets/logo-lima-puluh-kota.png, src/app/icon.png, src/app/apple-icon.png, .workflows/todos.md, .workflows/plan/P1-HIF-A000.md, INSMOBILE_BRANDING_PLAN.md
  - **Drift**:
    - No code drift — all six quoted code locations matched the phase plan byte-for-byte.
    - Plan's Verification setup under-stated env needs: `next build` itself requires DATABASE_URL (src/lib/db.ts throws at module evaluation during page-data collection), not just the manual dev check. Resolved by copying the gitignored .env.local from the primary checkout into the worktree — untracked, gitignored, NOT part of the commit.
    - update-todos prerequisite .workflows/package_readme.md was absent; todos.md was initialized anyway via the skill's fallback path. readme-updater must create package_readme.md (invoke /update-readme).
  - **Decided**:
    - Build failed on missing DATABASE_URL (env prerequisite, not drift) → copied gitignored .env.local from primary checkout into the worktree, untracked and never committed (rung 6: surrounding convention — the primary checkout builds with exactly this file)

---

## Archive
